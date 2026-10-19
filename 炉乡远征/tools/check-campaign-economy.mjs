import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ExpeditionProgress,validateExpeditionState,normalizeExpeditionState} from '../dist/js/expedition-progress.js';
import {createExpeditionMatch,validateMatch,restoreMatch,autoAct,endTurn} from '../dist/js/engine.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';
import {FACTIONS} from '../dist/js/factions.js';
import {ALL_RECRUITMENT_IDS} from '../dist/js/recruitment-catalog.js';
import {SAVE_KEYS} from '../dist/js/storage-keys.js';
const KEY=SAVE_KEYS.expedition;
class Storage{data=new Map();fail=false;after=false;getItem(k){return this.data.get(k)??null;}removeItem(k){this.data.delete(k);}setItem(k,v){if(this.fail)throw Error('quota');this.data.set(k,String(v));if(this.after&&k===KEY){this.after=false;throw Error('after write');}}}
const reload=s=>{const p=new ExpeditionProgress(s);assert.equal(p.error,'');assert.ok(validateExpeditionState(p.state));return p;};
const open=(p,id)=>createExpeditionMatch(id,p.state.training,p.state.squad,p.state.selectedHeroId,p.getBattleLoadout());
function win(p,id){const s=open(p,id);assert.equal(s.schemaVersion,7);assert.ok(p.saveBattle(s).ok);Object.assign(s,{phase:'over',winner:0,result:'win'});assert.ok(validateMatch(s));return s;}
// Ledger tests use valid terminal snapshots, not a claim of balance or player victory rate.
{
 const storage=new Storage();let p=reload(storage);for(const f of FACTIONS){assert.ok(p.selectHero(f.heroIds[0]).ok);const before=p.state.coins,orbs=p.state.recruitment.tickets;for(const level of EXPEDITION_LEVELS){const match=win(p,level.id),r=p.settle(match);assert.ok(r.ok,r.error);const raw=storage.getItem(KEY);assert.ok(p.settle(match).duplicate);assert.equal(storage.getItem(KEY),raw);p=reload(storage);}assert.equal(p.state.coins-before,f.id===1?5890:2070);assert.equal(p.state.recruitment.tickets-orbs,f.id===1?40:10);assert.equal(p.getFactionProgress(f.id).completed.length,30);}
 assert.equal(p.state.coins,16340);assert.equal(p.state.recruitment.tickets,100);assert.equal(Object.keys(p.state.accountStageClaims).length,30);assert.equal(Object.keys(p.state.factionChapterClaims).length,60);
 const match=win(p,'road-01'),coins=p.state.coins,tickets=p.state.recruitment.tickets;assert.ok(p.settle(match).ok);assert.equal(p.state.coins-coins,40);assert.equal(p.state.recruitment.tickets,tickets);
}
{
 const storage=new Storage();let p=reload(storage);for(const level of EXPEDITION_LEVELS)for(const f of [...FACTIONS].reverse()){assert.ok(p.selectHero(f.heroIds[0]).ok);assert.ok(p.settle(win(p,level.id)).ok);p=reload(storage);}assert.equal(p.state.coins,16340);assert.equal(p.state.recruitment.tickets,100);
}
{
 const storage=new Storage();let p=reload(storage);assert.ok(p.train(14).ok);assert.equal(p.train(14).ok,false);assert.deepEqual(p.getUnitTrainingBonus(14),{attack:0,health:1});
 for(const level of EXPEDITION_LEVELS.slice(0,3))assert.ok(p.settle(win(p,level.id)).ok);
 assert.ok(p.train(14).ok);assert.deepEqual(p.getUnitTrainingBonus(14),{attack:0,health:1});assert.ok(p.setSpecialization(14,'skirmish').ok);assert.equal(p.train(14).ok,false);
 assert.ok(p.trainSpell(20174).ok);assert.equal(p.trainSpell(20174).ok,false);p=reload(storage);assert.equal(p.state.specializations[14],'skirmish');
 assert.ok(p.selectHero(201).ok);assert.equal(p.trainSpell(20073).ok,false);
 const match=open(p,'border-01');assert.ok(p.saveBattle(match).ok);const frozen=p.state.battleRewards[match.runId];const state=p.state;state.inventory.units.push(...ALL_RECRUITMENT_IDS.filter(id=>!state.inventory.units.includes(id)));assert.ok(p.replaceState(state).ok);Object.assign(match,{phase:'over',winner:0,result:'win'});assert.ok(p.settle(match).ok);assert.equal(p.state.recruitment.victoryClaims[match.runId],frozen.tickets,'ownership changes do not change frozen rewards');
 const preview=p.rewardPreview('road-01');assert.equal(preview.compensationCoins,20);assert.equal(preview.tickets,0);
}
{
 const storage=new Storage();let p=reload(storage);const match=open(p,'border-01');storage.after=true;assert.equal(p.saveBattle(match).ok,false);assert.equal(storage.getItem(KEY),null);assert.equal(p.state.activeBattle,null);
 assert.ok(p.saveBattle(match).ok);const receipt=p.state.battleRewards[match.runId];const state=p.state;state.inventory.units.push(...ALL_RECRUITMENT_IDS.filter(id=>!state.inventory.units.includes(id)));assert.ok(p.replaceState(state).ok);Object.assign(match,{phase:'over',winner:0,result:'win'});const before=p.state,raw=storage.getItem(KEY);storage.after=true;assert.equal(p.settle(match).ok,false);assert.deepEqual(p.state,before);assert.equal(storage.getItem(KEY),raw);assert.ok(p.settle(match).ok);assert.deepEqual(p.state.battleRewards[match.runId],receipt);
}
{
 const storage=new Storage(),p=reload(storage),a=open(p,'border-01'),b=open(p,'border-01');assert.ok(p.saveBattle(a).ok);assert.ok(p.saveBattle(b).ok);Object.assign(a,{phase:'over',winner:0,result:'win'});Object.assign(b,{phase:'over',winner:0,result:'win'});assert.ok(p.settle(a).ok);const before=p.state;assert.equal(p.settle(b).ok,false);assert.deepEqual(p.state,before);
}
// Production random recruitment preserves economy facts while batches save atomically.
{
 const storage=new Storage();let p=reload(storage);for(const level of EXPEDITION_LEVELS.slice(0,3))assert.ok(p.settle(win(p,level.id)).ok);
 const state=p.state;state.recruitment.tickets=300;assert.ok(p.replaceState(state).ok);
 p=new ExpeditionProgress(storage,{rng:()=>0.99999});assert.equal(p.setRecruitmentFocus(17).ok,false);
 const first=p.drawRecruitment();assert.ok(first.ok);assert.equal(first.newUnitIds.length,0);assert.equal(first.draws[0].guaranteed,false);assert.equal(first.draws[0].rewards[0].amount,5);assert.equal(first.coins,20);
 const before=p.state,raw=storage.getItem(KEY);storage.after=true;assert.equal(p.drawRecruitment('premium',10).ok,false);assert.deepEqual(p.state,before);assert.equal(storage.getItem(KEY),raw);
 const batch=p.drawRecruitment('premium',10);assert.ok(batch.ok);assert.equal(batch.count,10);assert.ok(batch.newUnitIds.length>=1);assert.equal(batch.tickets,before.recruitment.tickets-10);assert.deepEqual(reload(storage).state,p.state);
 // Collect all available units through real paid batches, excluding each acquired unit immediately.
 let calls=0;p=new ExpeditionProgress(storage,{rng:()=>calls++%2===0?0.99999:0});
 while(!p.recruitmentStatus().allOwned){const targets=p.recruitmentStatus().eligibleTargets,paid=p.drawRecruitment('premium',10);assert.ok(paid.ok,paid.error);assert.equal(paid.coins,paid.count*20);assert.ok(paid.draws.every(d=>targets.includes(d.rewards[0].cardId)));}
 assert.equal(p.recruitmentStatus().allOwned,true);
 const owned=p.state;owned.recruitment.tickets=7;assert.ok(p.replaceState(owned).ok);const preview=p.rewardPreview('road-01');assert.equal(preview.compensationCoins,20);const coins=p.state.coins;assert.ok(p.settle(win(p,'road-01')).ok);p=reload(storage);assert.equal(p.state.coins-coins,150);assert.equal(p.state.recruitment.tickets,7);
 // Completed collections preserve existing balances and reject fresh draws without a write.
 const completed=p.state,completedRaw=storage.getItem(KEY);assert.equal(p.drawRecruitment().ok,false);assert.equal(p.drawRecruitment('premium',10).ok,false);assert.deepEqual(p.state,completed);assert.equal(storage.getItem(KEY),completedRaw);
}
// Unmodified0.2.1 runtime specimen: legacy paid growth and exact old battle preserved, two real continued actions.
{
 const fixture=JSON.parse(await readFile(new URL('./fixtures/save-contract-0.2.1.json',import.meta.url)));const storage=new Storage(),raw=JSON.stringify(fixture.profile);storage.setItem(KEY,raw);let p=reload(storage);assert.equal(storage.getItem(`${KEY}.legacy-v7-backup`),raw);assert.equal(p.state.growthVersion[14],'legacy-v1');assert.equal(p.state.growthVersion[9],'low-v2');assert.deepEqual(p.state.activeBattle,fixture.profile.activeBattle);assert.deepEqual(p.getUnitTrainingBonus(14),{attack:0,health:1});
 for(let i=0;i<2;i++){const match=restoreMatch(p.state.activeBattle);assert.ok(endTurn(match,match.currentPlayer,true));assert.ok(p.saveBattle(match).ok);p=reload(storage);assert.deepEqual(p.state.activeBattle,match);}assert.equal(p.getFactionProgress().completed.length,0);
}
{
 const fixture=JSON.parse(await readFile(new URL('./fixtures/save-contract-0.2.1.json',import.meta.url))),storage=new Storage();storage.setItem(KEY,JSON.stringify(fixture.profile));const p=reload(storage),old=structuredClone(fixture.profile.activeBattle);assert.ok(p.settle(win(p,'border-01')).ok);Object.assign(old,{phase:'over',winner:0,result:'win'});const before=p.state;assert.equal(p.settle(old).ok,false,'old opening and new opening cannot both claim account first');assert.deepEqual(p.state,before);
}
// Continuing an old activity is a newly observed faction victory, not guessed past progress.
{
 const fixture=JSON.parse(await readFile(new URL('./fixtures/save-contract-0.2.1.json',import.meta.url))),storage=new Storage();storage.setItem(KEY,JSON.stringify(fixture.profile));let p=reload(storage);const originalSettlements=structuredClone(p.state.settlements),match=restoreMatch(p.state.activeBattle);let actions=0;
 while(match.phase!=='over'&&actions++<600){assert.ok(autoAct(match));assert.ok(validateMatch(match));}
 assert.equal(match.result,'win');assert.ok(p.saveBattle(match).ok);p=reload(storage);const before=p.state.coins,orbs=p.state.recruitment.tickets;const settled=p.settle(p.state.activeBattle);assert.ok(settled.ok,settled.error);assert.equal(settled.amount,100);assert.equal(settled.tickets,1);assert.equal(settled.reward.chapterCoins,0);p=reload(storage);
 assert.equal(p.state.coins-before,100);assert.equal(p.state.recruitment.tickets-orbs,1);assert.deepEqual(p.getFactionProgress(1).completed,['border-01']);assert.equal(p.isUnlocked('border-02',1),true);assert.equal(p.isUnlocked('border-02',2),false);
 for(const [id,record]of Object.entries(originalSettlements))assert.deepEqual(p.state.settlements[id],record);
 const raw=storage.getItem(KEY);assert.ok(p.settle(match).duplicate);assert.equal(storage.getItem(KEY),raw);assert.ok(p.saveBattle(open(p,'border-02')).ok,'next stage can start immediately after reloading');
}
// A real new battle is played through public actions to victory, then saved and settled once.
{
 const storage=new Storage();let p=reload(storage),match=open(p,'border-01');assert.ok(p.saveBattle(match).ok);let actions=0;while(match.phase!=='over'&&actions++<600){assert.ok(autoAct(match));assert.ok(validateMatch(match));}assert.equal(match.result,'win');assert.ok(p.saveBattle(match).ok);p=reload(storage);assert.ok(p.settle(p.state.activeBattle).ok);p=reload(storage);assert.deepEqual(p.getFactionProgress().completed,['border-01']);
}
for(const mutate of [s=>s.schemaVersion=99,s=>s.growthVersion[14]='future',s=>s.recruitment.misses[17]=4,s=>s.factionCompleted[1].push('unknown'),s=>delete s.accountStageClaims]){const state=reload(new Storage()).state;mutate(state);assert.equal(normalizeExpeditionState(state),null);}
console.log('campaign economy passed: six/alternating routes, 16340 total coins and100 total orbs (including100 starter coins and10 starter orbs), frozen rewards/failures, growth gates, atomic random batches, old save and real schema7 victory');
