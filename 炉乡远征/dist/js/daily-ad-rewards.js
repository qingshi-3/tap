// Local-clock quota, not server-authoritative anti-cheat or cross-device accounting.
export const DAILY_AD_REWARDS = Object.freeze({gold:Object.freeze([{amount:100,weight:40},{amount:200,weight:35},{amount:500,weight:20},{amount:1000,weight:5}])});
export const initialDailyAds = () => ({ gold: { claimedDay:null, roll:null, pending:null, lastClaim:null } });
export function beijingDay(now = Date.now()) {const date=new Date(Number(now)+8*60*60*1000);if(!Number.isFinite(date.getTime()))throw new Error('本机日期无效，暂时无法领取广告奖励。');return date.toISOString().slice(0,10)}
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,expected)=>object(value)&&Object.keys(value).sort().join('|')===[...expected].sort().join('|');
export function validDay(day){if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;const date=new Date(`${day}T00:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day}
const amount=value=>Number.isSafeInteger(value)&&value>0;
export function validateDailyAds(value){
 if(!keys(value,['gold']))return false;
 for(const kind of ['gold']){const q=value[kind];if(!keys(q,['claimedDay','roll','pending','lastClaim'])||!(q.claimedDay===null||validDay(q.claimedDay)))return false;
  if(q.roll!==null&&(!keys(q.roll,['day','amount'])||!validDay(q.roll.day)||!amount(q.roll.amount)))return false;
  for(const key of ['pending','lastClaim']){const c=q[key];if(c!==null&&(!keys(c,['day','requestId','amount'])||!validDay(c.day)||typeof c.requestId!=='string'||!c.requestId||!amount(c.amount)))return false}
  if((q.claimedDay===null)!==(q.lastClaim===null)||q.lastClaim&&q.lastClaim.day!==q.claimedDay)return false;
  if(q.pending&&(!q.roll||q.pending.day!==q.roll.day||q.pending.amount!==q.roll.amount))return false;
 }
 return true;
}
export function dailyAdStatus(quota,day){const available=quota.claimedDay===null||day>quota.claimedDay;return{day,available,reason:available?'每天1次，北京时间零点刷新':day<quota.claimedDay?'本机日期早于上次领取日期，暂不可领取':'今日已领取，北京时间零点刷新'}}
export function dailyRewardRange(kind){const values=DAILY_AD_REWARDS[kind];if(!values)return null;const min=Math.min(...values.map(v=>v.amount)),max=Math.max(...values.map(v=>v.amount));return{min,max,range:`${min}～${max}`}}
export function rollDailyReward(kind,rng){const values=DAILY_AD_REWARDS[kind],roll=rng();if(!values||!Number.isFinite(roll)||roll<0||roll>=1)throw new Error('奖励随机数无效。');let cursor=roll*values.reduce((n,v)=>n+v.weight,0);for(const value of values){cursor-=value.weight;if(cursor<0)return value.amount}return values.at(-1).amount}
export function watchDailyAdRefresh(refresh) {
 let timer;
 const schedule=()=>{clearTimeout(timer);const shifted=Date.now()+8*60*60*1000;timer=setTimeout(()=>{refresh();schedule()},86400000-((shifted%86400000+86400000)%86400000)+50)};
 const visible=()=>{if(!document.hidden){refresh();schedule()}};
 document.addEventListener('visibilitychange',visible);schedule();
 return ()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',visible)};
}
