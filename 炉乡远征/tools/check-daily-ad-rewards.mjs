import assert from 'node:assert/strict';
import { PlayerProfile, normalizeProfile, validProfile } from '../dist/js/profile.js';
import { beijingDay, validDay, rollDailyReward, DAILY_AD_REWARDS } from '../dist/js/daily-ad-rewards.js';
import { SAVE_KEYS } from '../dist/js/storage-keys.js';
class Memory { data=new Map();fail=false;after=false;getItem(k){return this.data.get(k)??null}removeItem(k){this.data.delete(k)}setItem(k,v){if(this.fail&&!this.after)throw Error('quota');this.data.set(k,v);if(this.fail&&this.after){this.fail=false;throw Error('after write')}} }
const day1=Date.parse('2026-10-13T15:59:00Z'),day2=Date.parse('2026-10-13T16:01:00Z'),kind='gold';
function fixture(){const m=new Memory();let time=day1;const p=new PlayerProfile(m,{now:()=>time,rng:()=>0});return{m,p,setTime(value){time=value},now:()=>time}};
assert.equal(beijingDay(day1),'2026-10-13');assert.equal(beijingDay(day2),'2026-10-14');assert.equal(validDay('2026-02-30'),false);
assert.deepEqual(Object.keys(DAILY_AD_REWARDS),['gold'],'only the gold daily ad remains');
{
 const {p,m,now}=fixture();
 const before=p.state;assert.ok(p.beginDailyAd(kind,'cancel').ok);assert.ok(p.cancelDailyAd(kind,'cancel').ok);assert.equal(p.state.dailyAds[kind].claimedDay,null);assert.ok(p.beginDailyAd(kind,'first').ok);
 const pending=p.state;m.fail=true;assert.equal(p.completeDailyAd(kind,'first').ok,false);assert.deepEqual(p.state,pending);assert.deepEqual(JSON.parse(m.getItem(SAVE_KEYS.profile)),pending);m.fail=false;
 assert.ok(p.completeDailyAd(kind,'first').ok);assert.equal(p.state.dailyAds[kind].claimedDay,'2026-10-13');assert.ok(p.completeDailyAd(kind,'first').duplicate);assert.equal(p.beginDailyAd(kind,'second').ok,false);
 assert.equal(p.dailyAdOffer(kind).eligible,false);
 assert.equal(p.state.coins,before.coins+100);
 const reloaded=new PlayerProfile(m,{now});assert.equal(reloaded.dailyAdOffer(kind).available,false);
}
assert.equal(fixture().p.beginDailyAd('orb','x').ok,false,'removed orb ad is unknown');
{
 const {p,m,now,setTime}=fixture();
 assert.ok(p.beginDailyAd(kind,'night').ok);setTime(day2);assert.ok(p.beginDailyAd(kind,'night').duplicate);assert.equal(p.state.dailyAds[kind].pending.day,'2026-10-13');
 assert.ok(p.completeDailyAd(kind,'night').ok);assert.equal(p.state.dailyAds[kind].claimedDay,'2026-10-13');assert.equal(p.dailyAdOffer(kind).available,true);assert.ok(p.beginDailyAd(kind,'today').ok);assert.ok(p.completeDailyAd(kind,'today').ok);assert.equal(p.state.dailyAds[kind].claimedDay,'2026-10-14');
 setTime(day1);assert.equal(p.dailyAdOffer(kind).available,false);assert.match(p.dailyAdOffer(kind).reason,/早于/);assert.equal(p.beginDailyAd(kind,'rollback').ok,false);assert.equal(new PlayerProfile(m,{now}).dailyAdOffer(kind).available,false);
}
{
 const{p,m,now}=fixture();const first=p.beginDailyAd(kind,'old');assert.ok(first.ok);const q=new PlayerProfile(m,{now});assert.ok(q.beginDailyAd(kind,'new').ok);
 assert.equal(p.completeDailyAd(kind,'old').ok,false,'stale owner cannot overwrite newer reservation');assert.equal(q.completeDailyAd(kind,'old').ok,false,'old callback cannot claim replacement');assert.ok(q.completeDailyAd(kind,'new').ok);
}
{
 const{p,m}=fixture();assert.ok(p.beginDailyAd('gold','after').ok);const raw=m.getItem(SAVE_KEYS.profile),pending=p.state;m.fail=true;m.after=true;assert.equal(p.completeDailyAd('gold','after').ok,false);assert.equal(m.getItem(SAVE_KEYS.profile),raw);assert.deepEqual(p.state,pending);assert.ok(p.completeDailyAd('gold','after').ok);
 for(const mutate of [s=>s.dailyAds.gold.claimedDay='2026-02-30',s=>s.dailyAds.gold.extra=1,s=>s.dailyAds.orb={claimedDay:null,roll:null,pending:null,lastClaim:null}]){const state=p.state;mutate(state);assert.equal(validProfile(state),false,String(mutate));assert.equal(normalizeProfile(state),null,String(mutate));}
}
for(const [value,expected]of [[0,100],[0.3999,100],[0.4,200],[0.75,500],[0.95,1000]])assert.equal(rollDailyReward('gold',()=>value),expected);
{
 const m=new Memory();let count=0;const p=new PlayerProfile(m,{now:()=>day1,rng:()=>{count++;return 0.99}});
 assert.equal(p.dailyAdOffer('gold').eligible,true);assert.ok(p.beginDailyAd('gold','cancel-roll').ok);assert.equal(p.state.dailyAds.gold.roll.amount,1000);assert.ok(p.cancelDailyAd('gold','cancel-roll').ok);assert.ok(p.beginDailyAd('gold','new-roll').ok);assert.equal(count,1);const pending=p.state;m.fail=true;assert.equal(p.completeDailyAd('gold','new-roll').ok,false);m.fail=false;assert.deepEqual(p.state,pending);assert.equal(p.completeDailyAd('gold','new-roll').amount,1000);assert.equal(count,1);
}
{
 const {p,setTime}=fixture();assert.ok(p.beginDailyAd('gold','yesterday-pending').ok);const old=p.state.dailyAds.gold.roll;setTime(day2);assert.ok(p.beginDailyAd('gold','today-pending').ok);assert.equal(p.state.dailyAds.gold.pending.day,'2026-10-14');assert.notDeepEqual(p.state.dailyAds.gold.roll,old);assert.equal(p.completeDailyAd('gold','yesterday-pending').ok,false);assert.ok(p.completeDailyAd('gold','today-pending').ok);assert.equal(p.state.dailyAds.gold.claimedDay,'2026-10-14');
}
console.log('Daily ad rewards passed: Beijing midnight, atomic quota, save retry/rollback, cross-midnight frozen day, same-day limit, stale owners/requests, clock rollback, strict profile schema.');
