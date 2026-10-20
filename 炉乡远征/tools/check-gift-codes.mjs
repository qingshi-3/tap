import assert from 'node:assert/strict';
import {PlayerProfile,normalizeProfile} from '../dist/js/profile.js';
import {SAVE_KEYS,V1_KEYS} from '../dist/js/storage-keys.js';
import {GIFT_CODES} from '../dist/js/gift-codes.js';
import {PlayerCloud} from '../dist/js/player-cloud.js';
class Memory{data=new Map;fail=false;getItem(k){return this.data.get(k)??null}setItem(k,v){if(this.fail&&k===SAVE_KEYS.profile)throw Error('quota');this.data.set(k,String(v))}removeItem(k){this.data.delete(k)}}
const COINS=GIFT_CODES.find(g=>g.code==='LX2026').coins;assert.equal(COINS,1800);
let cases=0;
// A stored receipt keeps the amount it was granted at, survives reload, and blocks a repeat claim.
{
 const m=new Memory,s=new PlayerProfile(m).state;
 s.giftCodeClaims={'return-20261016':{code:'LX2026',coins:400}};
 m.setItem(SAVE_KEYS.profile,JSON.stringify(s));let p=new PlayerProfile(m);
 assert.equal(p.error,'');assert.deepEqual(p.state,s);assert.match(p.redeemGiftCode('LX2026').error,/已领取/);
 assert.ok(p.selectHero(101).ok);const saved=p.state;p=new PlayerProfile(m);assert.deepEqual(p.state,saved);
 assert.match(p.redeemGiftCode('LX2026').error,/已领取/);cases++;
 for(const receipt of [{code:'LX2026',coins:200,orbs:10},{code:'OTHER',coins:200},{code:'LX2026',coins:-1},{code:'LX2026'}]){
   const corrupt=structuredClone(s);corrupt.giftCodeClaims['return-20261016']=receipt;
   assert.equal(normalizeProfile(corrupt),null,JSON.stringify(receipt));cases++;
 }
}
// New profile: normalized input redeems once, persists through reload and later changes.
{
 const m=new Memory;let p=new PlayerProfile(m);const before=p.state;
 assert.deepEqual(p.redeemGiftCode('  ｌｘ２０２６ '),{ok:true,duplicate:false,coins:COINS,code:'LX2026'});assert.equal(p.state.coins,before.coins+COINS);
 assert.ok(p.selectHero(201).ok);const saved=p.state;p=new PlayerProfile(m);assert.deepEqual(p.state,saved);assert.match(p.redeemGiftCode('LX2026').error,/已领取/);assert.deepEqual(p.state,saved);cases++;
}
// The one-time safe-v1 import converts an old coins+orbs receipt to gold and still blocks the code.
{
 const m=new Memory;m.setItem(V1_KEYS.expedition,JSON.stringify({coins:50,giftCodeClaims:{'return-20261016':{code:'LX2026',coins:1200,orbs:30}}}));
 const p=new PlayerProfile(m);assert.equal(p.error,'');assert.deepEqual(p.state.giftCodeClaims,{'return-20261016':{code:'LX2026',coins:1800}});assert.match(p.redeemGiftCode('LX2026').error,/已领取/);cases++;
 const fresh=new Memory;fresh.setItem(V1_KEYS.expedition,JSON.stringify({coins:50}));const q=new PlayerProfile(fresh),coins=q.state.coins;assert.ok(q.redeemGiftCode('lx2026').ok);assert.equal(q.state.coins,coins+COINS);cases++;
}
for(const invalid of [null,undefined,{},123,'','LX2026!','LX 2026','LX2026\u200b','bad','L'.repeat(100)]){const p=new PlayerProfile(new Memory),before=p.state;assert.equal(p.redeemGiftCode(invalid).ok,false);assert.deepEqual(p.state,before);cases++}
{
 const m=new Memory,p=new PlayerProfile(m),before=p.state;m.fail=true;assert.equal(p.redeemGiftCode('LX2026').ok,false);assert.deepEqual(p.state,before);m.fail=false;assert.ok(p.redeemGiftCode('LX2026').ok);assert.match(new PlayerProfile(m).redeemGiftCode('LX2026').error,/已领取/);cases++;
}
{
 const m=new Memory,a=new PlayerProfile(m),b=new PlayerProfile(m);assert.ok(a.redeemGiftCode('LX2026').ok);const raw=m.getItem(SAVE_KEYS.profile);assert.equal(b.redeemGiftCode('LX2026').ok,false);assert.equal(m.getItem(SAVE_KEYS.profile),raw);cases++;
}
{const m=new Memory,s=new PlayerProfile(m).state;s.coins=Number.MAX_SAFE_INTEGER;m.setItem(SAVE_KEYS.profile,JSON.stringify(s));const p=new PlayerProfile(m),raw=m.getItem(SAVE_KEYS.profile);assert.equal(p.error,'');assert.equal(p.redeemGiftCode('LX2026').ok,false);assert.equal(m.getItem(SAVE_KEYS.profile),raw);cases++}
for(const mutate of [s=>s.version=99,s=>s.giftCodeClaims={'unknown':{}},s=>s.giftCodeClaims=[],s=>s.future=true]){const m=new Memory,s=new PlayerProfile(m).state;mutate(s);assert.equal(normalizeProfile(s),null);const raw=JSON.stringify(s);m.setItem(SAVE_KEYS.profile,raw);assert.equal(new PlayerProfile(m).redeemGiftCode('LX2026').ok,false);assert.equal(m.getItem(SAVE_KEYS.profile),raw);cases++}
{
 const m=new Memory,p=new PlayerProfile(m);assert.ok(p.redeemGiftCode('LX2026').ok);assert.ok(p.selectHero(301).ok);const expected=p.state;
 const transport={available:true,remote:null,async read(){return structuredClone(this.remote)},async write(data,token){assert.equal(token,this.remote?.token??null);this.remote={token:'cloud',data:structuredClone(data)};return {ok:true,token:'cloud'}}};
 const cloud=new PlayerCloud({storage:m,transport});assert.ok((await cloud.initialize()).ok);assert.ok((await cloud.sync()).ok);cloud.dispose();const destination=new Memory,restored=new PlayerCloud({storage:destination,transport});assert.ok((await restored.initialize()).ok);assert.deepEqual(new PlayerProfile(destination).state,expected);assert.match(new PlayerProfile(destination).redeemGiftCode('LX2026').error,/已领取/);restored.dispose();cases++;
}
console.log(JSON.stringify({passed:true,cases,coverage:['stored receipt','new redeem/reload','safe-v1 import receipt','invalid input','failed save retry','stale page','overflow','strict incompatible data','cloud roundtrip']}));
