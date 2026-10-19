import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {ExpeditionProgress,normalizeExpeditionState} from '../dist/js/expedition-progress.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
import {PlayerCloud} from '../dist/js/player-cloud.js';
class Memory{data=new Map;fail=false;getItem(k){return this.data.get(k)??null}setItem(k,v){if(this.fail&&k===SAVE_KEYS.expedition)throw Error('quota');this.data.set(k,String(v))}removeItem(k){this.data.delete(k)}}
const fixture=JSON.parse(await readFile(new URL('./fixtures/save-contract-profile12-pre-gifts-2026-10-16.json',import.meta.url)));
let cases=0;
// Local-preview claim remains readable after the public reward is increased.
{
 const m=new Memory,s=new ExpeditionProgress(m).state;
 s.giftCodeClaims={'return-20261016':{code:'LX2026',coins:200,orbs:10}};
 m.setItem(SAVE_KEYS.expedition,JSON.stringify(s));let p=new ExpeditionProgress(m);
 assert.equal(p.error,'');assert.deepEqual(p.state,s);assert.match(p.redeemGiftCode('LX2026').error,/已领取/);
 assert.ok(p.train(9).ok);const saved=p.state;p=new ExpeditionProgress(m);assert.deepEqual(p.state,saved);
 assert.match(p.redeemGiftCode('LX2026').error,/已领取/);cases++;
 for(const receipt of [{code:'LX2026',coins:1200,orbs:10},{code:'LX2026',coins:200,orbs:30}]){
   const corrupt=structuredClone(s);corrupt.giftCodeClaims['return-20261016']=receipt;
   assert.equal(normalizeExpeditionState(corrupt),null);cases++;
 }
}
for(const old of [null,...fixture.profiles]){
 const m=new Memory;if(old)m.setItem(SAVE_KEYS.expedition,JSON.stringify(old));let p=new ExpeditionProgress(m);const before=p.state;
 if(old){assert.equal(m.getItem(SAVE_KEYS.expedition+'.legacy-v12-backup'),JSON.stringify(old));const restored=structuredClone(p.state);delete restored.giftCodeClaims;restored.schemaVersion=12;assert.deepEqual(restored,old)}
 assert.deepEqual(p.redeemGiftCode('  ｌｘ２０２６ '),{ok:true,duplicate:false,coins:1200,orbs:30,code:'LX2026'});assert.equal(p.state.coins,before.coins+1200);assert.equal(p.state.recruitment.tickets,before.recruitment.tickets+30);
 assert.ok(p.train(9).ok);assert.ok(p.drawRecruitment().ok);const saved=p.state;p=new ExpeditionProgress(m);assert.deepEqual(p.state,saved);assert.match(p.redeemGiftCode('LX2026').error,/已领取/);assert.deepEqual(p.state,saved);cases++;
}
for(const invalid of [null,undefined,{},123,'','LX2026!','LX 2026','LX2026\u200b','bad','L'.repeat(100)]){const p=new ExpeditionProgress(new Memory),before=p.state;assert.equal(p.redeemGiftCode(invalid).ok,false);assert.deepEqual(p.state,before);cases++}
{
 const m=new Memory,p=new ExpeditionProgress(m),before=p.state;m.fail=true;assert.equal(p.redeemGiftCode('LX2026').ok,false);assert.deepEqual(p.state,before);m.fail=false;assert.ok(p.redeemGiftCode('LX2026').ok);assert.match(new ExpeditionProgress(m).redeemGiftCode('LX2026').error,/已领取/);cases++;
}
{
 const m=new Memory,a=new ExpeditionProgress(m),b=new ExpeditionProgress(m);assert.ok(a.redeemGiftCode('LX2026').ok);const raw=m.getItem(SAVE_KEYS.expedition);assert.equal(b.redeemGiftCode('LX2026').ok,false);assert.equal(m.getItem(SAVE_KEYS.expedition),raw);cases++;
}
for(const field of ['coins','orbs']){const m=new Memory,s=new ExpeditionProgress(m).state;if(field==='coins')s.coins=Number.MAX_SAFE_INTEGER;else s.recruitment.tickets=Number.MAX_SAFE_INTEGER;m.setItem(SAVE_KEYS.expedition,JSON.stringify(s));const p=new ExpeditionProgress(m),raw=m.getItem(SAVE_KEYS.expedition);assert.equal(p.error,'');assert.equal(p.redeemGiftCode('LX2026').ok,false);assert.equal(m.getItem(SAVE_KEYS.expedition),raw);cases++}
for(const mutate of [s=>s.schemaVersion=99,s=>s.giftCodeClaims={'unknown':{}},s=>s.giftCodeClaims={'return-20261016':{code:'LX2026',coins:201,orbs:10}},s=>s.giftCodeClaims=[],s=>s.future=true]){const m=new Memory,s=new ExpeditionProgress(m).state;mutate(s);assert.equal(normalizeExpeditionState(s),null);const raw=JSON.stringify(s);m.setItem(SAVE_KEYS.expedition,raw);assert.equal(new ExpeditionProgress(m).redeemGiftCode('LX2026').ok,false);assert.equal(m.getItem(SAVE_KEYS.expedition),raw);cases++}
{
 const m=new Memory,p=new ExpeditionProgress(m,{rng:()=>0});m.fail=true;assert.equal(p.drawRecruitment().ok,false);m.fail=false;const before=p.state;assert.match(p.redeemGiftCode('LX2026').error,/冻结/);assert.deepEqual(p.state,before);assert.ok(p.drawRecruitment().ok);assert.ok(p.redeemGiftCode('LX2026').ok);cases++;
}
{
 const m=new Memory,p=new ExpeditionProgress(m);assert.ok(p.redeemGiftCode('LX2026').ok);assert.ok(p.train(9).ok);const expected=p.state;
 const transport={available:true,remote:null,async read(){return structuredClone(this.remote)},async write(data,token){assert.equal(token,this.remote?.token??null);this.remote={token:'cloud',data:structuredClone(data)};return {ok:true,token:'cloud'}}};
 const cloud=new PlayerCloud({storage:m,transport});assert.ok((await cloud.initialize()).ok);assert.ok((await cloud.sync()).ok);cloud.dispose();const destination=new Memory,restored=new PlayerCloud({storage:destination,transport});assert.ok((await restored.initialize()).ok);assert.deepEqual(new ExpeditionProgress(destination).state,expected);assert.match(new ExpeditionProgress(destination).redeemGiftCode('LX2026').error,/已领取/);restored.dispose();cases++;
}
// Every supported frozen historical profile remains eligible after migration.
for (const name of ['save-contract-0.1.9.json','save-contract-profile8-pre-daily-2026-10-13.json','save-contract-0.3.8-pre-expansion.json','save-contract-profile10-pre-random-2026-10-14.json','save-contract-profile11-pre-fragments-2026-10-15.json']) {
 const frozen=JSON.parse(await readFile(new URL('./fixtures/'+name,import.meta.url)));
 for (const source of frozen.profiles) {const m=new Memory;m.setItem(SAVE_KEYS.expedition,JSON.stringify(source));const p=new ExpeditionProgress(m);assert.equal(p.error,'');const before=p.state;assert.ok(p.redeemGiftCode('lx2026').ok);assert.equal(p.state.coins,before.coins+1200);assert.equal(p.state.recruitment.tickets,before.recruitment.tickets+30);assert.match(new ExpeditionProgress(m).redeemGiftCode('LX2026').error,/已领取/);cases++;}
}
const report={passed:true,cases,schema:13,schema12Fixture:'tools/fixtures/save-contract-profile12-pre-gifts-2026-10-16.json',coverage:['new and schema12 redeem/spend/reload','invalid input','failed save retry','stale page','overflow','strict incompatible data','pending draw','cloud roundtrip']};
await mkdir(new URL('../output/gift-codes/',import.meta.url),{recursive:true});await writeFile(new URL('../output/gift-codes/core.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));


