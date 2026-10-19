import assert from 'node:assert/strict';
import { assetImage, assetFailures } from '../dist/js/asset-loading.js';
import { BoardRenderer } from '../dist/js/renderer.js';
import { EFFECT_MANIFEST } from '../dist/js/effect-manifest.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
const flush = async () => { for (let i=0;i<20;i++) await Promise.resolve(); };
const originals = Object.fromEntries(['Image','document','location','window','DOMParser','fetch','setTimeout','clearTimeout'].map(key=>[key,globalThis[key]]));
const timers = new Map(), images = [];
let nextTimer = 0, fetches = 0;
class StubImage {
  constructor() { this.decoding=deferred(); this.decodeCalls=0; images.push(this); }
  set src(value) { this.url=value; if (value==='throw-src.png') throw Error('source setter failed'); }
  get src() { return this.url; }
  decode() { this.decodeCalls++; return this.decoding.promise; }
  loaded() { this.onload?.(); }
  failed() { this.onerror?.(); }
}
globalThis.Image=StubImage;
globalThis.document={baseURI:'https://assets.test/',createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
globalThis.window={matchMedia:()=>({matches:false,addEventListener(){}})};
const key=textContent=>({textContent}), value=(tagName,textContent)=>({tagName,textContent});
const dict=entries=>({tagName:'dict',children:entries.flatMap(([name,val])=>[key(name),val])});
const prefixes=new Set(Object.values(EFFECT_MANIFEST.bodies).flatMap(body=>Object.values(body.states).map(s=>s.prefix)));
Object.values(EFFECT_MANIFEST.spellArtSpecs).forEach(spec=>prefixes.add(spec.prefix));
const plistRoot=dict([['frames',dict([...prefixes].map(prefix=>[`${prefix}000.png`,dict([
 ['frame',value('string','{{0,0},{10,10}}')],['sourceSize',value('string','{10,10}')]
])]))]]);
globalThis.DOMParser=class { parseFromString() { return {querySelector:()=>plistRoot}; } };
globalThis.fetch=async()=>{fetches++;return {ok:true,text:async()=>'<plist><dict/></plist>'};};
globalThis.setTimeout=(fn,ms)=>{assert.equal(ms,12000);const id=++nextTimer;timers.set(id,fn);return id;};
globalThis.clearTimeout=id=>timers.delete(id);
const expire = () => { for (const [id,fn] of [...timers]) { timers.delete(id); fn(); } };
try {
  {
    const start=images.length;
    const queued=Array.from({length:13},(_,i)=>assetImage(`/queue-${i}.png`));
    await flush();assert.equal(images.length-start,6);assert.equal(timers.size,6,'queued work has no deadline before acquiring a slot');
    expire();await flush();assert.equal(images.length-start,12);assert.equal(timers.size,6,'only next six own fresh deadlines');
    for(const image of images.slice(start+6,start+12)){image.loaded();image.decoding.resolve();}
    await flush();assert.equal(images.length-start,13);assert.equal(timers.size,1);
    images.at(-1).loaded();images.at(-1).decoding.resolve();
    const result=await Promise.all(queued);assert.ok(result.slice(0,6).every(v=>v===null));assert.ok(result.slice(6).every(Boolean),'queue waiting does not consume the next batch deadline');
  }
  {
    const start=images.length, p=assetImage('/decoded.png'), q=assetImage('https://assets.test/decoded.png');
    assert.equal(p,q,'same URL shares the in-flight promise'); await flush(); assert.equal(images.length,start+1);
    const image=images.at(-1); let successful=false; p.then(v=>{successful=!!v;});
    image.loaded(); await flush(); assert.equal(successful,false,'onload is not decode completion'); assert.equal(image.decodeCalls,1);
    image.decoding.resolve(); assert.equal(await p,image); assert.equal(successful,true);
    assert.equal(await assetImage('/decoded.png'),image); assert.equal(images.length,start+1,'successful image remains cached');
  }
  {
    const p=assetImage('/decode-failed.png'); await flush(); const image=images.at(-1); image.loaded(); image.decoding.reject(Error('decode failed'));
    assert.equal(await p,null); assert.ok(assetFailures.has('/decode-failed.png'));
    const retry=assetImage('/decode-failed.png'); await flush(); const fresh=images.at(-1); assert.notEqual(fresh,image); fresh.loaded(); fresh.decoding.resolve(); assert.equal(await retry,fresh);
  }
  {
    const p=assetImage('/network-failed.png'); await flush(); const image=images.at(-1); image.failed(); assert.equal(await p,null); assert.equal(image.decodeCalls,0);
    const retry=assetImage('/network-failed.png'); await flush(); const fresh=images.at(-1); fresh.loaded(); fresh.decoding.resolve(); assert.equal(await retry,fresh);
    assert.equal(await assetImage('throw-src.png'),null,'synchronous failures resolve instead of hanging');
  }
  {
    const p=assetImage('/network-timeout.png'); await flush(); const old=images.at(-1), lateLoad=old.onload;
    expire(); assert.equal(await p,null); lateLoad(); await flush(); assert.equal(old.decodeCalls,0,'late network completion cannot restart a timed out request');
    const retry=assetImage('/network-timeout.png'); await flush(); const fresh=images.at(-1); fresh.loaded(); fresh.decoding.resolve(); assert.equal(await retry,fresh);
  }
  {
    const p=assetImage('/decode-timeout.png'); await flush(); const old=images.at(-1); old.loaded(); await flush(); expire(); assert.equal(await p,null);
    const retry=assetImage('/decode-timeout.png'); await flush(); const fresh=images.at(-1); fresh.loaded(); fresh.decoding.resolve(); assert.equal(await retry,fresh);
    old.decoding.resolve(); await flush(); assert.equal(await assetImage('/decode-timeout.png'),fresh,'late decode cannot overwrite a successful retry');
  }
  {
    const first=assetImage('blob:fixture'); await flush(); const a=images.at(-1); const second=assetImage('blob:fixture'); await flush(); const b=images.at(-1);
    assert.notEqual(a,b,'blob lifetimes do not enter the persistent URL cache'); a.loaded(); b.loaded(); a.decoding.resolve(); b.decoding.resolve(); assert.equal(await first,a); assert.equal(await second,b);
  }
  {
    const renderer=new BoardRenderer({getContext:()=>({})}), effects=deferred(); let effectsLoads=0;
    renderer.effects.load=()=>{effectsLoads++;return effects.promise;};
    const firstProgress=[], lateProgress=[]; let nested=null;
    const start=images.length;
    const first=renderer.load(progress=>{firstProgress.push(progress); if (!nested) nested=renderer.load(p=>lateProgress.push(p));});
    await flush();const created=images.length-start, requests=fetches;
    const concurrent=renderer.load(()=>{throw Error('subscriber failure');});
    assert.equal(first,concurrent); assert.equal(first,nested); assert.equal(effectsLoads,1); assert.equal(images.length-start,created); assert.equal(fetches,requests);
    assert.ok(firstProgress[0].total>0); assert.deepEqual(lateProgress[0],firstProgress[0],'reentrant subscriber immediately receives current progress');
    await flush();
    const afterStart=[]; assert.equal(renderer.load(p=>afterStart.push(p)),first); assert.deepEqual(afterStart[0],firstProgress.at(-1),'late subscriber receives the completed count, not zero');
    let handled=start, failedPath;
    // Drain each bounded batch; the first tile remains an optional failure.
    for(let round=0;round<100;round++){
      for(const image of images.slice(handled)){
        if(image.src.includes('/tiles/tile_board@2x.png')){failedPath=image.src;image.failed();}
        else {image.loaded();image.decoding.resolve();}
      }
      handled=images.length;await flush();
      if(firstProgress.at(-1).completed===firstProgress.at(-1).total-1)break;
    }
    assert.equal(renderer.ready,false,'effects preparation also gates renderer ready');
    const almost=firstProgress.at(-1); assert.equal(almost.completed,almost.total-1); assert.deepEqual(lateProgress.at(-1),almost); assert.deepEqual(afterStart.at(-1),almost);
    effects.resolve(); const result=await first; assert.equal(renderer.ready,true); assert.ok(result.failures.includes(failedPath));
    assert.equal(renderer.images.get('tile-board'),null,'optional tile art failure retains readable fallback'); assert.ok(renderer.atlases.size>0,'atlas preparation finishes before ready');
    assert.equal(firstProgress.at(-1).completed,firstProgress.at(-1).total);
    const readyProgress=[], oldCount=firstProgress.length,finalCreated=images.length-start; assert.equal(renderer.load(p=>readyProgress.push(p)),first); assert.deepEqual(readyProgress,[firstProgress.at(-1)]); assert.equal(firstProgress.length,oldCount); assert.equal(effectsLoads,1); assert.equal(images.length-start,finalCreated);
  }
  assert.equal(timers.size,0,'all preparation deadlines are cleared');
  console.log('Asset loading checks passed: decode gating, shared URL cache, failure/retry, bounded network/decode, shared renderer load and late progress.');
} finally {
  for (const [key,value] of Object.entries(originals)) { if (value===undefined) delete globalThis[key]; else globalThis[key]=value; }
}
