import { CAMPAIGN_UNIT_IDS, SPELL_IDS } from './campaign-rules.js';
import { validateRecruitmentDoubles } from './recruitment-double.js';
import { ALL_RECRUITMENT_IDS } from './recruitment-catalog.js';

const integer = (v, min = 0) => Number.isSafeInteger(v) && v >= min;
const object = v => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const keys = (v, expected) => object(v) && Object.keys(v).sort().join('|') === [...expected].sort().join('|');
export const recruitmentCardKind = id => CAMPAIGN_UNIT_IDS.includes(id) ? 'units' : SPELL_IDS.includes(id) ? 'spells' : null;
export function validateRecruitmentConfig(v) {
  if (v?.schemaVersion === 3) return validateNewRandomConfig(v);
  if (v?.schemaVersion === 2) return validateRandomConfig(v);
  if (!keys(v, ['schemaVersion','victoryTickets','adTickets','adEnabled','pools','recipes']) || v.schemaVersion !== 1 || !integer(v.victoryTickets) || !integer(v.adTickets) || typeof v.adEnabled !== 'boolean' || !Array.isArray(v.pools) || !Array.isArray(v.recipes)) return false;
  const recipes = new Set();
  for (const r of v.recipes) {
    if (!keys(r,['cardId','fragmentsRequired']) || !recruitmentCardKind(r.cardId) || !integer(r.fragmentsRequired,1) || recipes.has(r.cardId)) return false;
    recipes.add(r.cardId);
  }
  const pools = new Set();
  for (const p of v.pools) {
    if (!keys(p,['id','name','ticketCost','entries']) || typeof p.id !== 'string' || !p.id.trim() || typeof p.name !== 'string' || !p.name.trim() || pools.has(p.id) || !integer(p.ticketCost,1) || !Array.isArray(p.entries) || !p.entries.length) return false;
    pools.add(p.id); const cards = new Set(); let total = 0;
    for (const e of p.entries) {
      if (!keys(e,['cardId','weight','fragments']) || !recruitmentCardKind(e.cardId) || !recipes.has(e.cardId) || cards.has(e.cardId) || !integer(e.weight,1) || !integer(e.fragments,1)) return false;
      cards.add(e.cardId); total += e.weight;
      if (!integer(total,1)) return false;
    }
  }
  return true;
}
export const PREMIUM_IDS = Object.freeze([17,116,215,310,404,526]);
export function initialRecruitment() { return { tickets: 0, fragments: {}, victoryClaims: {}, adClaims: {}, focus: null, misses: Object.fromEntries(PREMIUM_IDS.map(id=>[id,0])), random:{totalDraws:0,drawsSinceUnit:0,legacyGuarantees:{},legacyUnitGuarantee:null},lastReceipt:null,doubles:{claims:{}} }; }
export function normalizeRecruitment(v) {
  const state={ ...structuredClone(v), focus:v.focus??null, misses:v.misses??Object.fromEntries(PREMIUM_IDS.map(id=>[id,0])) };
  // Each independent old target counter was a paid entitlement. Keep its bytes
  // and expose a separate consumable countdown instead of silently retargeting.
  state.random??={totalDraws:0,drawsSinceUnit:0,legacyGuarantees:Object.fromEntries(PREMIUM_IDS.filter(id=>state.misses[id]>0).map(id=>[id,4-state.misses[id]]))};
  return upgradeRecruitment(state);
}
// Historical fragments and receipts survive pool removal and configuration changes.
export function validateRecruitmentState(v, settlements, legacy = false, version = 11) {
  if (!object(settlements)) return false;
  const expected=legacy?['tickets','fragments','victoryClaims','adClaims']:['tickets','fragments','victoryClaims','adClaims','focus','misses'];
  if(version>=11)expected.push('random');
  if(version>=12)expected.push('lastReceipt','doubles');
  if (!keys(v,expected) || !integer(v.tickets) || !object(v.fragments) || !object(v.victoryClaims) || !object(v.adClaims)) return false;
  if (!legacy && (!(v.focus===null||PREMIUM_IDS.includes(v.focus)) || !keys(v.misses,PREMIUM_IDS.map(String)) || PREMIUM_IDS.some(id=>!integer(v.misses[id])||v.misses[id]>3))) return false;
  if(version>=11){const r=v.random;if(!keys(r,version>=12?['totalDraws','drawsSinceUnit','legacyGuarantees','legacyUnitGuarantee']:['totalDraws','drawsSinceUnit','legacyGuarantees'])||!integer(r.totalDraws)||!integer(r.drawsSinceUnit)||r.drawsSinceUnit>9||r.drawsSinceUnit>r.totalDraws||!object(r.legacyGuarantees)||Object.entries(r.legacyGuarantees).some(([id,n])=>!PREMIUM_IDS.includes(Number(id))||String(Number(id))!==id||!integer(n,1)||n>3||n>4-v.misses[id]||!v.misses[id]))return false;}
  if(version>=12&&(!(v.random.legacyUnitGuarantee===null||integer(v.random.legacyUnitGuarantee,1)&&v.random.legacyUnitGuarantee<=10)||!validateRecruitmentDoubles(v)))return false;
  if (Object.entries(v.fragments).some(([id,n]) => !/^[1-9]\d*$/.test(id) || !integer(Number(id),1) || !integer(n))) return false;
  for (const [runId,n] of Object.entries(v.victoryClaims)) if (!runId || !Object.hasOwn(settlements,runId) || !integer(n)) return false;
  for (const [runId,c] of Object.entries(v.adClaims)) {
    if (!Object.hasOwn(v.victoryClaims,runId) || !keys(c,['status','requestId','amount','requestIds']) || !['pending','claimed','cancelled'].includes(c.status) || typeof c.requestId !== 'string' || !c.requestId || !integer(c.amount)) return false;
    if (!Array.isArray(c.requestIds) || new Set(c.requestIds).size !== c.requestIds.length || c.requestIds.some(id=>typeof id !== 'string' || !id) || !c.requestIds.includes(c.requestId)) return false;
  }
  return true;
}
function validateRandomConfig(v){
  if(!keys(v,['schemaVersion','victoryTickets','adTickets','adEnabled','pools','recipes','random']))return false;
  const base={...v,schemaVersion:1};delete base.random;if(!validateRecruitmentConfig(base))return false;
  const r=v.random;
  if(!keys(r,['pityEvery','firstDrawGuaranteed','coinsPerFragment','rewards'])||r.pityEvery!==10||r.firstDrawGuaranteed!==true||r.coinsPerFragment!==10||!Array.isArray(r.rewards)||!r.rewards.length)return false;
  let total=0;const seen=new Set();
  for(const e of r.rewards){const tag=`${e.kind}:${e.amount}`;if(!keys(e,['kind','amount','weight'])||!['fragments','coins'].includes(e.kind)||!integer(e.amount,1)||!integer(e.weight,1)||seen.has(tag))return false;seen.add(tag);total+=e.weight;}
  return total===10000&&v.pools.length===1&&v.pools[0].id==='premium'&&v.pools[0].ticketCost===1&&v.pools[0].entries.length===ALL_RECRUITMENT_IDS.length&&v.pools[0].entries.every(e=>e.weight===1&&ALL_RECRUITMENT_IDS.includes(e.cardId))&&v.recipes.length===ALL_RECRUITMENT_IDS.length&&v.recipes.every(e=>e.fragmentsRequired===12&&ALL_RECRUITMENT_IDS.includes(e.cardId));
}
export function recruitmentDraw(pool, rng) {
  const roll = rng();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error('抽奖随机值无效。');
  let cursor = roll * pool.entries.reduce((n,e)=>n+e.weight,0);
  for (const entry of pool.entries) { if (cursor < entry.weight) return entry; cursor -= entry.weight; }
  return pool.entries.at(-1);
}

// Upgrade only after the caller validates the complete frozen historical profile.
export function upgradeRecruitment(v){
 const state=structuredClone(v);
 if(Object.hasOwn(state,'lastReceipt'))return state;
 for(const [id,n] of Object.entries(state.fragments)){const converted=Math.ceil(n/12*30);if(!Number.isSafeInteger(converted))throw Error('历史碎片超出迁移范围。');state.fragments[id]=converted;}
 state.random.legacyUnitGuarantee=state.random.totalDraws>0?10-state.random.drawsSinceUnit:null;
 state.lastReceipt=null;state.doubles={claims:{}};return state;
}
function validateNewRandomConfig(v){
 if(!keys(v,['schemaVersion','victoryTickets','adTickets','adEnabled','pools','recipes','random']))return false;
 const base={...v,schemaVersion:1};delete base.random;if(!validateRecruitmentConfig(base))return false;
 if(!keys(v.random,['coinsPerDraw','rewards'])||v.random.coinsPerDraw!==20||!Array.isArray(v.random.rewards)||v.random.rewards.length!==3)return false;
 return v.random.rewards.every((e,i)=>keys(e,['kind','amount','weight'])&&e.kind==='fragments'&&e.amount===[1,2,5][i]&&e.weight===[8800,1100,100][i])&&v.pools.length===1&&v.pools[0].id==='premium'&&v.pools[0].ticketCost===1&&v.pools[0].entries.length===ALL_RECRUITMENT_IDS.length&&v.pools[0].entries.every(e=>e.weight===1&&ALL_RECRUITMENT_IDS.includes(e.cardId))&&v.recipes.length===ALL_RECRUITMENT_IDS.length&&v.recipes.every(e=>e.fragmentsRequired===30&&ALL_RECRUITMENT_IDS.includes(e.cardId));
}
