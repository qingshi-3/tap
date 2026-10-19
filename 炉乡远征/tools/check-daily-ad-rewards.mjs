import assert from 'node:assert/strict';
import { ExpeditionProgress, normalizeExpeditionState, validateExpeditionState } from '../dist/js/expedition-progress.js';
import { createExpeditionMatch } from '../dist/js/engine.js';
import { beijingDay, validDay, rollDailyReward } from '../dist/js/daily-ad-rewards.js';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';
import { readFile } from 'node:fs/promises';
class Memory { data=new Map();fail=false;after=false;getItem(k){return this.data.get(k)??null}removeItem(k){this.data.delete(k)}setItem(k,v){if(this.fail&&!this.after)throw Error('quota');this.data.set(k,v);if(this.fail&&this.after){this.fail=false;throw Error('after write')}} }
const day1=Date.parse('2026-10-13T15:59:00Z'),day2=Date.parse('2026-10-13T16:01:00Z');
function fixture(){const m=new Memory();let time=day1;const p=new ExpeditionProgress(m,{now:()=>time,rng:()=>0});const win=id=>{const s=p.state,b=createExpeditionMatch('border-01',s.training,s.squad,s.selectedHeroId);Object.assign(b,{runId:id,phase:'over',winner:0,result:'win'});assert.ok(p.settle(b).ok)};win('a');win('b');return{m,p,win,setTime(value){time=value},now:()=>time}};
assert.equal(beijingDay(day1),'2026-10-13');assert.equal(beijingDay(day2),'2026-10-14');assert.equal(validDay('2026-02-30'),false);
for(const kind of ['gold','orb']){
 const {p,m,now}=fixture(),begin=(id,r)=>p.beginDailyAd(kind,r),complete=(id,r)=>p.completeDailyAd(kind,r),cancel=(id,r)=>p.cancelDailyAd(kind,r);
 const before=p.state;assert.ok(begin('a','cancel').ok);assert.ok(cancel('a','cancel').ok);assert.equal(p.state.dailyAds[kind].claimedDay,null);assert.ok(begin('a','first').ok);
 const pending=p.state;m.fail=true;assert.equal(complete('a','first').ok,false);assert.deepEqual(p.state,pending);assert.deepEqual(JSON.parse(m.getItem(SAVE_KEYS.expedition)),pending);m.fail=false;
 assert.ok(complete('a','first').ok);assert.equal(p.state.dailyAds[kind].claimedDay,'2026-10-13');assert.ok(complete('a','first').duplicate);assert.equal(begin('b','second').ok,false);
 assert.equal(p.dailyAdOffer(kind).eligible,false);
 assert.equal(kind==='gold'?p.state.coins: p.state.recruitment.tickets,kind==='gold'?before.coins+100:before.recruitment.tickets+1);
 const reloaded=new ExpeditionProgress(m,{now});assert.equal(reloaded.dailyAdOffer(kind).available,false);
}
for(const kind of ['gold','orb']){
 const {p,m,now,setTime}=fixture(),begin=(id,r)=>p.beginDailyAd(kind,r),complete=(id,r)=>p.completeDailyAd(kind,r);
 assert.ok(begin('a','night').ok);setTime(day2);assert.ok(begin('a','night').duplicate);assert.equal(p.state.dailyAds[kind].pending.day,'2026-10-13');
 assert.ok(complete('a','night').ok);assert.equal(p.state.dailyAds[kind].claimedDay,'2026-10-13');assert.equal(p.dailyAdOffer(kind).available,true);assert.ok(begin('b','today').ok);assert.ok(complete('b','today').ok);assert.equal(p.state.dailyAds[kind].claimedDay,'2026-10-14');
 setTime(day1);assert.equal(p.dailyAdOffer(kind).available,false);assert.match(p.dailyAdOffer(kind).reason,/早于/);assert.equal(begin('b','rollback').ok,false);assert.equal(new ExpeditionProgress(m,{now}).dailyAdOffer(kind).available,false);
}
{
 const{p,win}=fixture();assert.ok(p.beginDailyAd('gold','gold').ok);assert.ok(p.completeDailyAd('gold','gold').ok);assert.ok(p.beginDailyAd('orb','orb').ok);assert.ok(p.completeDailyAd('orb','orb').ok);win('c');assert.equal(p.resourceRewardOffer('gold').eligible,false);assert.equal(p.resourceRewardOffer('orb').eligible,false);
}
for(const kind of ['gold','orb']){
 const{p,m,now}=fixture();const first=p.beginDailyAd(kind,'old');assert.ok(first.ok);const q=new ExpeditionProgress(m,{now});assert.ok(q.beginDailyAd(kind,'new').ok);
 assert.equal(p.completeDailyAd(kind,'old').ok,false,'stale owner cannot overwrite newer reservation');assert.equal(q.completeDailyAd(kind,'old').ok,false,'old callback cannot claim replacement');assert.ok(q.completeDailyAd(kind,'new').ok);
}
{
 const{p,m}=fixture();assert.ok(p.beginDailyAd('gold','after').ok);const raw=m.getItem(SAVE_KEYS.expedition),pending=p.state;m.fail=true;m.after=true;assert.equal(p.completeDailyAd('gold','after').ok,false);assert.equal(m.getItem(SAVE_KEYS.expedition),raw);assert.deepEqual(p.state,pending);assert.ok(p.completeDailyAd('gold','after').ok);
 for(const mutate of [s=>s.dailyAds.gold.claimedDay='2026-02-30',s=>s.dailyAds.gold.extra=1,s=>s.dailyAds.orb.pending={day:'2026-10-13',runId:'a',requestId:'missing'}]){const state=p.state;mutate(state);assert.equal(validateExpeditionState(state),false);assert.equal(normalizeExpeditionState(state),null);}
}
{
 const frozen=JSON.parse(await readFile(new URL('./fixtures/save-contract-profile8-pre-daily-2026-10-13.json',import.meta.url)));const m=new Memory();m.setItem(SAVE_KEYS.expedition,JSON.stringify(frozen.profiles[0]));const p=new ExpeditionProgress(m,{now:()=>day1});assert.equal(p.state.schemaVersion,13);assert.equal(p.completeReward('profile8-frozen-win','profile8-gold-pending').ok,false);assert.equal(p.completeRecruitmentAd('profile8-frozen-win','profile8-orb-pending').ok,false);assert.equal(p.beginReward('profile8-frozen-win','profile8-gold-pending').ok,false);assert.equal(p.beginRecruitmentAd('profile8-frozen-win','profile8-orb-pending').ok,false);assert.ok(p.beginDailyAd('gold','fresh-gold').ok);assert.ok(p.completeDailyAd('gold','fresh-gold').ok);assert.ok(p.beginDailyAd('orb','fresh-orb').ok);assert.ok(p.completeDailyAd('orb','fresh-orb').ok);
}
for(const [kind,samples] of [['gold',[[0,100],[0.3999,100],[0.4,200],[0.75,500],[0.95,1000]]],['orb',[[0,1],[0.4999,1],[0.5,2],[0.8,3],[0.95,5]]]])for(const [value,expected]of samples)assert.equal(rollDailyReward(kind,()=>value),expected);
{
 const m=new Memory();let count=0;const p=new ExpeditionProgress(m,{now:()=>day1,rng:()=>{count++;return 0.99}});
 assert.equal(p.dailyAdOffer('gold').eligible,true);assert.equal(p.dailyAdOffer('orb').eligible,true);assert.ok(p.beginDailyAd('gold','cancel-roll').ok);assert.equal(p.state.dailyAds.gold.roll.amount,1000);assert.ok(p.cancelDailyAd('gold','cancel-roll').ok);assert.ok(p.beginDailyAd('gold','new-roll').ok);assert.equal(count,1);const pending=p.state;m.fail=true;assert.equal(p.completeDailyAd('gold','new-roll').ok,false);m.fail=false;assert.deepEqual(p.state,pending);assert.equal(p.completeDailyAd('gold','new-roll').amount,1000);assert.equal(count,1);
}
{
 const {p,setTime}=fixture();assert.ok(p.beginDailyAd('gold','yesterday-pending').ok);const old=p.state.dailyAds.gold.roll;setTime(day2);assert.ok(p.beginDailyAd('gold','today-pending').ok);assert.equal(p.state.dailyAds.gold.pending.day,'2026-10-14');assert.notDeepEqual(p.state.dailyAds.gold.roll,old);assert.equal(p.completeDailyAd('gold','yesterday-pending').ok,false);assert.ok(p.completeDailyAd('gold','today-pending').ok);assert.equal(p.state.dailyAds.gold.claimedDay,'2026-10-14');
}
console.log('Daily ad rewards passed: Beijing midnight, atomic quotas, save retry/rollback, cross-midnight frozen day, same-day limits, both resources, stale owners/requests, clock rollback, strict schema9, safe profile8 pending migration.');
