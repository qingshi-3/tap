import assert from 'node:assert/strict';
import { createSceneTransitions } from '../dist/js/scene-transitions.js';
import { readFile } from 'node:fs/promises';
function fixture({cached=true,popover=true,modal=true,fail=false}={}) {
  const timers=new Map(), plays=[], root={inert:false}; let next=0, permitted=true, top=false;
  const veil={hidden:false,style:{},setAttribute(){},addEventListener(){},showModal:modal?function(){this.open=true;}:undefined,close(){this.open=false;},remove(){this.removed=true;},matches(){return top;},showPopover:popover?()=>{top=true;}:undefined,hidePopover(){top=false;},animate(frames,options){if(fail)throw Error('test animation failure');const p={frames,options,cancel(){this.cancelled=true;}};plays.push(p);return p;}};
  const doc={defaultView:{Image:class{complete=cached;naturalWidth=cached?2560:0;},setTimeout(fn,ms){timers.set(++next,{fn,ms});return next;},clearTimeout(id){timers.delete(id);}},createElement(){return veil;},body:{append(){}},querySelectorAll(){return [root];}};
  return {api:createSceneTransitions(doc,()=>permitted),veil,root,timers,plays,setPermitted(v){permitted=v;},cover(){[...timers.values()].find(t=>t.ms===450).fn();}};
}
const f=fixture();let commits=0;
assert.equal(f.veil.hidden,true);
const first=f.api.change(()=>++commits);
assert.equal(commits,0);assert.equal(f.root.inert,true);
assert.equal(f.plays[0].options.duration,1000);assert.equal(f.plays[0].frames.length,91);
f.cover();assert.equal(await first,1);assert.equal(f.root.inert,false);
f.plays[0].onfinish();assert.equal(commits,1);assert.equal(f.veil.hidden,true);
const a=f.api.change(()=>++commits), old=f.plays.at(-1);
const b=f.api.change(()=>++commits);
assert.equal(await a,2,'rapid replacement commits accepted work exactly once');
old.onfinish();assert.equal(f.veil.hidden,false,'late old callback cannot hide current animation');
f.api.cancel();assert.equal(await b,3);assert.equal(f.veil.hidden,true);assert.equal(f.root.inert,false);
f.setPermitted(false);const immediate=f.api.change(()=>++commits);assert.equal(commits,4,'reduced motion commits synchronously');await immediate;
f.setPermitted(true);const hidden=f.api.change(()=>++commits);f.setPermitted(false);f.api.cancel();await hidden;assert.equal(commits,5);
f.api.dispose();assert.equal(f.veil.removed,true);
for(const options of [{cached:false},{popover:false,modal:false}]) {const g=fixture(options);let count=0;await g.api.change(()=>count++);assert.equal(count,1);assert.equal(g.plays.length,0);assert.equal(g.root.inert,false);}
const atlas=JSON.parse(await readFile(new URL('../dist/assets/transitions/burn-away.json',import.meta.url),'utf8'));
assert.equal(atlas.frames.length,91);assert.ok(atlas.meta.size.w<=4096&&atlas.meta.size.h<=4096);
assert.equal(atlas.meta.pixelfx.id,'transitions/burn-away');
console.log('Burn-away commit timing, cancellation, late completion, inert restoration, immediate fallback and source atlas passed.');

const broken=fixture({fail:true});let calls=0;await broken.api.change(()=>calls++);assert.equal(calls,1);assert.equal(broken.root.inert,false);assert.equal(broken.veil.hidden,true);
const modal=fixture({popover:false});const mp=modal.api.change(()=>++calls);modal.api.cancel();await mp;assert.equal(calls,2);assert.equal(modal.veil.open,false);

