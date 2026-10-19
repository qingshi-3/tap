import { getHero, getHeroKind, getHeroJobs, getSelectedHero, HEROES, HERO_JOBS, SKILL_DEFINITIONS } from './heroes.js';
import { recommendedSkills } from './profession-content.js';

export const STORAGE_KEY = 'pixel-survivor.campaign.v2';
export const LEGACY_STORAGE_KEY = 'pixel-survivor.campaign.v1';
export const PROFILE_SCHEMA_VERSION = 2;
export const DAILY_CHECKIN_REWARD = Object.freeze({ gold: 60, materials: 8 });
const baselines = new WeakMap();
const bind = (profile, raw) => { baselines.set(profile, raw); return profile; };
const JOB_IDS = Object.keys(HERO_JOBS);
const SKILL_IDS = Object.keys(SKILL_DEFINITIONS);
const HERO_IDS = HEROES.map(hero => hero.id);
const COMMANDER_JOB_IDS = ['fighter','blade_master','swift_blade'];
const COMMANDER_SKILL_IDS = ['dash','cleave','guard','swordField','bladeWave','whirlwind','quickCut'];
const BASE_SKILLS = ['dash', 'cleave', 'guard'];
const HERO_DEFAULTS = Object.freeze({
  summoner: Object.freeze({ job:'summoner', skills:Object.freeze(['summonGuard','recallSummons','summonElite']) }),
  blink: Object.freeze({ job:'blink', skills:Object.freeze(['markBlade','blinkStrike','blinkStorm']) }),
  mage: Object.freeze({ job:'mage', skills:Object.freeze(['flameBreath','rockWall','frostAura']) }),
});
const TRIAL_IDS = Object.values(HERO_JOBS).map(job=>job.trialId).filter(Boolean);

export const UNITS = Object.freeze([
  { id: 'stone-guard', name: '磐石卫', kind: 'guard_basic', role: 'guard', tier: 1, attack: 10, hp: 72 },
  { id: 'wind-scout', name: '逐风斥候', kind: 'scout_basic', role: 'ranger', tier: 1, attack: 15, hp: 42 },
  { id: 'herb-mender', name: '青芽医士', kind: 'healer_basic', role: 'healer', tier: 1, attack: 8, hp: 50 },
  { id: 'ember-archer', name: '烬羽弓手', kind: 'archer_elite', role: 'ranger', tier: 2, attack: 23, hp: 52 },
  { id: 'iron-vanguard', name: '铁壁先锋', kind: 'guard_elite', role: 'guard', tier: 2, attack: 17, hp: 110 },
  { id: 'moon-priest', name: '月泉祭司', kind: 'healer_elite', role: 'healer', tier: 3, attack: 20, hp: 82 },
].map(unit => Object.freeze({ ...unit, description: '旧战团成员，现于营地休整。' })));

export const DUNGEONS = Object.freeze([
  { id: 'moss-gate', name: '苔痕关', region: '青原', description: '诱导重锤落点，横移避开相连的裂地。', x: 22, y: 65, duration: 360, difficulty: 1, enemies: ['grunt', 'runner', 'scout_basic', 'guard_basic', 'brute', 'archer_elite'], boss: { name: '裂垒执锤者', kind: 'boss_kron', abilityId: 'faultwarden', hp: 18000, damage: 20, spawnAt: 300 }, eliteWaves: [['kilnGuard'], ['laneGunner'], ['kilnGuard']], rewards: { gold: 420, materials: 48, xp: 120 }, unitDrops: [], requires: null },
  { id: 'ember-trail', name: '烬火古道', region: '赤岭', description: '把火种留在身后，沿焰环缺口寻找反击位置。', x: 45, y: 48, duration: 420, difficulty: 2, enemies: ['runner', 'brute', 'archer_elite', 'guard_basic'], boss: { name: '烬环织焰者', kind: 'boss_cindera', abilityId: 'cinderweaver', hp: 26000, damage: 28, spawnAt: 350 }, eliteWaves: [['blastBeetle'], ['laneGunner'], ['kilnGuard', 'blastBeetle']], rewards: { gold: 620, materials: 72, xp: 180 }, spawnScale: 1.15, unitDrops: [], requires: 'moss-gate' },
  { id: 'blade-trial', name: '剑阵试炼', region: '试炼场', description: '清理护炉阵中的敌群，抓住重锤收招的破绽。', x: 66, y: 38, duration: 120, difficulty: 2, enemies: ['guard_basic', 'archer_elite', 'brute'], boss: { name: '裂垒教官', kind: 'boss_kron', abilityId: 'faultwarden', hp: 14500, damage: 24, spawnAt: 100 }, eliteWaves: [['kilnGuard'], ['kilnGuard'], ['kilnGuard']], rewards: { gold: 180, materials: 24, xp: 90 }, spawnScale: .9, unitDrops: [], requires: 'moss-gate' },
  { id: 'swift-trial', name: '迅刃试炼', region: '试炼场', description: '穿过炮道间隙，避开裂地后近身反击。', x: 72, y: 58, duration: 120, difficulty: 2, enemies: ['runner', 'scout_basic', 'archer_elite'], boss: { name: '裂垒教官', kind: 'boss_kron', abilityId: 'faultwarden', hp: 13200, damage: 26, spawnAt: 100 }, eliteWaves: [['laneGunner'], ['laneGunner'], ['laneGunner']], rewards: { gold: 180, materials: 24, xp: 90 }, spawnScale: 1.25, unitDrops: [], requires: 'moss-gate' },
  { id: 'summoner-trial', name: '契灵试炼', region: '试炼场', description: '号令契灵集火护炉卫，带领它们脱离落锤区。', x: 78, y: 30, duration: 120, difficulty: 2, enemies: ['guard_basic', 'brute', 'archer_elite'], boss: { name: '裂垒教官', kind: 'boss_kron', abilityId: 'faultwarden', hp: 14500, damage: 24, spawnAt: 100 }, eliteWaves: [['kilnGuard'], ['kilnGuard'], ['kilnGuard']], rewards: { gold: 180, materials: 24, xp: 90 }, spawnScale: .95, unitDrops: [], requires: 'moss-gate' },
  { id: 'blink-trial', name: '瞬印试炼', region: '试炼场', description: '先布地面飞镖，无敌穿越炮道与焰环，留意最后的落点。', x: 82, y: 47, duration: 120, difficulty: 2, enemies: ['runner', 'scout_basic', 'archer_elite'], boss: { name: '织焰教官', kind: 'boss_cindera', abilityId: 'cinderweaver', hp: 13200, damage: 26, spawnAt: 100 }, eliteWaves: [['laneGunner'], ['laneGunner'], ['laneGunner']], rewards: { gold: 180, materials: 24, xp: 90 }, spawnScale: 1.25, unitDrops: [], requires: 'moss-gate' },
  { id: 'mage-trial', name: '元素试炼', region: '试炼场', description: '用元素火力打断甲虫蓄爆，规划火种间的安全路线。', x: 86, y: 65, duration: 120, difficulty: 2, enemies: ['guard_basic', 'runner', 'brute'], boss: { name: '织焰教官', kind: 'boss_cindera', abilityId: 'cinderweaver', hp: 14000, damage: 25, spawnAt: 100 }, eliteWaves: [['blastBeetle'], ['blastBeetle'], ['blastBeetle']], rewards: { gold: 180, materials: 24, xp: 90 }, spawnScale: 1, unitDrops: [], requires: 'moss-gate' },
].map(item => Object.freeze(item)));

export const BUILDINGS = Object.freeze([
  { id: 'hall', name: '体能与战意', description: '每级为英雄增加 12 点生命与 7% 伤害。', maxLevel: 5, baseCost: 35 },
  { id: 'barracks', name: '训练效率', description: '每级使英雄训练所需金币减少 10。', maxLevel: 5, baseCost: 30 },
  { id: 'workshop', name: '战利品收益', description: '每级使远征材料收益提高 8%。', maxLevel: 5, baseCost: 40 },
]);

const UNIT_IDS = new Set(UNITS.map(x => x.id));
const DUNGEON_IDS = new Set(DUNGEONS.map(x => x.id));
const CLEARED_IDS = new Set([...DUNGEON_IDS, 'iron-quarry', 'moon-ruins']);
const BUILDING_IDS = BUILDINGS.map(x => x.id);
const integer = (v, min = 0) => Number.isInteger(v) && v >= min;
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const exactKeys = (v, keys) => object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uniqueStrings = (v, allowed = null) => Array.isArray(v) && new Set(v).size === v.length && v.every(x => typeof x === 'string' && x && (!allowed || allowed.includes(x)));
const clone = v => JSON.parse(JSON.stringify(v));

function validBase(profile) {
  if (!object(profile) || ![1,PROFILE_SCHEMA_VERSION].includes(profile.version) || !integer(profile.gold) || !integer(profile.materials) || !object(profile.roster)) return false;
  for (const [id, entry] of Object.entries(profile.roster)) if (!UNIT_IDS.has(id) || !exactKeys(entry, ['level', 'copies']) || !integer(entry.level, 1) || entry.level > 30 || !integer(entry.copies)) return false;
  if (!uniqueStrings(profile.squad) || profile.squad.length > 3 || profile.squad.some(id => !Object.hasOwn(profile.roster, id))) return false;
  if (!exactKeys(profile.buildings, BUILDING_IDS) || BUILDINGS.some(b => !integer(profile.buildings[b.id]) || profile.buildings[b.id] > b.maxLevel)) return false;
  if (!uniqueStrings(profile.cleared) || profile.cleared.some(id => !CLEARED_IDS.has(id)) || !uniqueStrings(profile.settledRuns) || profile.settledRuns.some(id => id.length > 160)) return false;
  const reward=profile.lastReward;
  if(reward===null)return true;
  if(!object(reward))return false;
  const rewardKeys=['gold','materials','xp','unitId','firstClear','victory','runId','runDuration','adBonusClaimed','adBonusGold','adBonusMaterials'];
  if(Object.keys(reward).some(key=>!rewardKeys.includes(key)))return false;
  if(Object.hasOwn(reward,'runDuration')&&(!Number.isFinite(reward.runDuration)||reward.runDuration<0))return false;
  if(Object.hasOwn(reward,'adBonusClaimed')||Object.hasOwn(reward,'adBonusGold')||Object.hasOwn(reward,'adBonusMaterials'))return reward.adBonusClaimed===true && integer(reward.gold,1) && integer(reward.adBonusGold,1) && reward.adBonusGold===Math.floor(reward.gold*.5) && (!Object.hasOwn(reward,'adBonusMaterials') || (integer(reward.materials) && integer(reward.adBonusMaterials) && reward.adBonusMaterials===Math.floor(reward.materials*.25))) && Number.isFinite(reward.runDuration) && reward.runDuration>=60 && typeof reward.runId==='string' && profile.settledRuns.includes(reward.runId);
  return true;
}

function validOldProfile(profile) {
  const keys = ['version', 'gold', 'materials', 'roster', 'squad', 'buildings', 'cleared', 'settledRuns', 'lastReward'];
  const legacyCleared = new Set(['moss-gate', 'ember-trail', 'iron-quarry', 'moon-ruins']);
  if (profile?.version !== 1 || !object(profile) || !keys.every(k => Object.hasOwn(profile, k)) || !validBase(profile) || profile.cleared.some(id => !legacyCleared.has(id))) return false;
  if (!Object.hasOwn(profile, 'heroes')) return Object.keys(profile).length === keys.length;
  if (Object.keys(profile).length !== keys.length + 1 || !exactKeys(profile.heroes, ['commander'])) return false;
  const h = profile.heroes.commander;
  if (!object(h) || !integer(h.level, 1) || h.level > 30) return false;
  return exactKeys(h, ['level'])
    || (exactKeys(h, ['level', 'job']) && (h.job === 'fighter' || h.job === 'blade_master'));
}

function validPreHeroesProfile(profile) {
  if (profile?.version !== 1 || !validBase(profile) || !exactKeys(profile, ['version', 'gold', 'materials', 'roster', 'squad', 'buildings', 'cleared', 'settledRuns', 'lastReward', 'heroes', 'progression'])) return false;
  if (!exactKeys(profile.heroes, ['commander'])) return false;
  const h = profile.heroes.commander;
  if (!exactKeys(h, ['level', 'experience', 'job', 'unlockedJobs', 'skillLoadout']) || !integer(h.level, 1) || h.level > 30 || !integer(h.experience) || h.experience >= h.level * 100 || (h.level === 30 && h.experience !== 0) || !COMMANDER_JOB_IDS.includes(h.job)) return false;
  if (!uniqueStrings(h.unlockedJobs, COMMANDER_JOB_IDS) || !h.unlockedJobs.includes('fighter') || !h.unlockedJobs.includes(h.job)) return false;
  if (!Array.isArray(h.skillLoadout) || h.skillLoadout.length !== 3 || new Set(h.skillLoadout).size !== 3 || h.skillLoadout.some(id => !COMMANDER_SKILL_IDS.includes(id) || !SKILL_DEFINITIONS[id].jobs.includes(h.job) || SKILL_DEFINITIONS[id].level > h.level)) return false;
  const p = profile.progression;
  return exactKeys(p, ['claimedQuests', 'dungeonWins', 'kills']) && uniqueStrings(p.claimedQuests) && p.claimedQuests.every(id => QUESTS.some(quest => quest.id === id)) && object(p.dungeonWins)
    && Object.keys(p.dungeonWins).every(id => CLEARED_IDS.has(id) && integer(p.dungeonWins[id])) && integer(p.kills);
}

function validHeroProgress(hero, heroId) {
  const expectedJob = HERO_DEFAULTS[heroId]?.job;
  if (!exactKeys(hero, ['level','experience','job','unlockedJobs','skillLoadout']) || !integer(hero.level,1) || hero.level>30 || !integer(hero.experience) || hero.experience>=hero.level*100 || (hero.level===30&&hero.experience!==0) || !JOB_IDS.includes(hero.job)) return false;
  if (!uniqueStrings(hero.unlockedJobs,JOB_IDS) || !hero.unlockedJobs.includes(hero.job)) return false;
  const ownedJobs=getHeroJobs(heroId).map(job=>job.id);
  if (!ownedJobs.includes(hero.job) || hero.unlockedJobs.some(id=>!ownedJobs.includes(id))) return false;
  if (expectedJob && !hero.unlockedJobs.includes(expectedJob)) return false;
  return Array.isArray(hero.skillLoadout) && hero.skillLoadout.length===3 && new Set(hero.skillLoadout).size===3 && hero.skillLoadout.every(id=>SKILL_IDS.includes(id)&&SKILL_DEFINITIONS[id].jobs.includes(hero.job)&&SKILL_DEFINITIONS[id].level<=hero.level);
}

function validProfile(profile) {
  const keys=['version','gold','materials','roster','squad','buildings','cleared','settledRuns','lastReward','heroes','progression','selectedHero'];
  if(Object.hasOwn(profile ?? {},'dailyCheckin')) { keys.push('dailyCheckin'); if(!validDailyCheckin(profile.dailyCheckin))return false; }
  if (profile?.version !== PROFILE_SCHEMA_VERSION || !validBase(profile) || !exactKeys(profile, keys)) return false;
  if (!HERO_IDS.includes(profile.selectedHero) || !exactKeys(profile.heroes,HERO_IDS) || !HERO_IDS.every(id=>validHeroProgress(profile.heroes[id],id))) return false;
  if (!profile.heroes.commander.unlockedJobs.includes('fighter')) return false;
  const p=profile.progression;
  return exactKeys(p,['claimedQuests','dungeonWins','kills'])&&uniqueStrings(p.claimedQuests)&&p.claimedQuests.every(id=>QUESTS.some(q=>q.id===id))&&object(p.dungeonWins)&&Object.keys(p.dungeonWins).every(id=>CLEARED_IDS.has(id)&&integer(p.dungeonWins[id]))&&integer(p.kills);
}

function makeProfile(base = null) {
  const source = base ? clone(base) : { version: PROFILE_SCHEMA_VERSION, gold: 300, materials: 30, roster: { 'stone-guard': { level: 1, copies: 0 }, 'wind-scout': { level: 1, copies: 0 } }, squad: ['stone-guard', 'wind-scout'], buildings: { hall: 0, barracks: 0, workshop: 0 }, cleared: [], settledRuns: [], lastReward: null };
  const oldHero = source.heroes?.commander;
  const job = COMMANDER_JOB_IDS.includes(oldHero?.job) ? oldHero.job : 'fighter';
  const level = integer(oldHero?.level, 1) ? Math.min(30, oldHero.level) : 1;
  const skillLoadout = job === 'blade_master' && level >= 3 ? ['dash', 'cleave', 'swordField'] : BASE_SKILLS.slice();
  source.selectedHero = 'commander';
  source.heroes = {
    commander: { level, experience: integer(oldHero?.experience) ? oldHero.experience : 0, job, unlockedJobs: Array.isArray(oldHero?.unlockedJobs) ? [...oldHero.unlockedJobs] : (job === 'fighter' ? ['fighter'] : ['fighter', job]), skillLoadout: Array.isArray(oldHero?.skillLoadout) ? [...oldHero.skillLoadout] : skillLoadout },
    ...Object.fromEntries(Object.entries(HERO_DEFAULTS).map(([id,data])=>[id,{level:1,experience:0,job:data.job,unlockedJobs:[data.job],skillLoadout:[...data.skills]}])),
  };
  if (!object(source.progression)) source.progression = { claimedQuests: [], dungeonWins: Object.fromEntries(source.cleared.filter(id => DUNGEON_IDS.has(id)).map(id => [id, 1])), kills: 0 };
  source.version = PROFILE_SCHEMA_VERSION;
  return source;
}

function backupRaw(key, raw) {
  if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
  else if (localStorage.getItem(key) !== raw) {
    let suffix = Date.now();
    let nextKey = `${key}.${suffix}`;
    while (localStorage.getItem(nextKey) !== null) nextKey = `${key}.${++suffix}`;
    localStorage.setItem(nextKey, raw);
  }
}

export function validateProfile(profile) { return validProfile(profile); }
export function getLocalProfileRaw() { return localStorage.getItem(STORAGE_KEY); }
export function getLocalSavedAt() { try{return localStorage.getItem(`${STORAGE_KEY}.saved-at`);}catch{return null;} }
export function restoreCloudProfile(profile, incoming, expectedRaw) {
  if(!validProfile(profile) || !validProfile(incoming))return {ok:false,error:'档案格式无效，未恢复。'};
  const next=bind(clone(incoming),baselines.get(profile));
  try {
    const raw=getLocalProfileRaw();
    if(raw!==expectedRaw)return {ok:false,error:'本机进度已变化，请重新查看后恢复。'};
    if(typeof raw!=='string')return {ok:false,error:'本机原档案缺失，未恢复。'};
    backupRaw(`${STORAGE_KEY}.before-cloud-restore`,raw);
  }catch{return {ok:false,error:'无法备份本机原档案，当前进度未修改。'};}
  const saved=saveProfile(next);
  if(!saved.ok)return saved;
  for(const key of Object.keys(profile))delete profile[key];
  Object.assign(profile,next);
  baselines.set(profile,baselines.get(next));
  return {ok:true};
}
// Baselines belong to loaded objects, never arbitrary clones or the latest storage read.
// localStorage has no atomic cross-process CAS; this guards sequential stale writers.
export function saveProfile(profile) {
  if (!validProfile(profile) || !baselines.has(profile)) return { ok:false,error:'档案未可靠读取或格式无效，未写入存档。' };
  const expected = baselines.get(profile), serialized = JSON.stringify(profile);
  try {
    if (getLocalProfileRaw() !== expected) return {ok:false,error:'本机进度已变化，请重新进入游戏；旧页面未覆盖存档。'};
    if (expected !== null && expected !== serialized) localStorage.setItem(`${STORAGE_KEY}.before-write`, expected);
    if (getLocalProfileRaw() !== expected) return {ok:false,error:'本机进度已变化，未写入存档。'};
    localStorage.setItem(STORAGE_KEY, serialized);
    if (getLocalProfileRaw() !== serialized) return {ok:false,error:'本机进度已变化，保存结果不确定，请重新进入游戏。'};
    baselines.set(profile, serialized);
    try { localStorage.setItem(`${STORAGE_KEY}.saved-at`,new Date().toISOString()); } catch {}
    return {ok:true,error:null};
  } catch(error) { return {ok:false,error:`无法保存档案：${error instanceof Error?error.message:'存储不可用'}。请保留页面；写入结果可能不确定，原始记录保留在原槽或备份中。`}; }
}

// v1 shapes are frozen historical contracts. Unknown fields/versions never migrate.
export function migrateLegacyProfile(parsed) {
  if (parsed?.version !== 1 || Object.hasOwn(parsed,'dailyCheckin')) return null;
  const current = {...clone(parsed),version:PROFILE_SCHEMA_VERSION};
  if (validProfile(current)) return current;
  if (validPreHeroesProfile(parsed) || validOldProfile(parsed)) {
    const next=makeProfile(parsed);return validProfile(next)?next:null;
  }
  return null;
}
export function loadProfile() {
  let raw, legacy;
  try { raw=getLocalProfileRaw(); } catch(error) { return {profile:null,error:'无法读取档案，原记录未修改。'}; }
  if (raw !== null) {
    try { const parsed=JSON.parse(raw);return validProfile(parsed)?{profile:bind(parsed,raw),error:null}:{profile:null,error:'存档版本或内容无法识别，原存档已保留。'}; }
    catch { return {profile:null,error:'存档已损坏，原存档已保留。'}; }
  }
  try { legacy=localStorage.getItem(LEGACY_STORAGE_KEY); } catch { return {profile:null,error:'无法读取旧档案，未创建新档案。'}; }
  let profile;
  if (legacy !== null) {
    try { profile=migrateLegacyProfile(JSON.parse(legacy)); } catch {}
    if (!profile) return {profile:null,error:'旧存档版本或内容无法识别，原存档已保留。'};
    try { backupRaw(`${STORAGE_KEY}.imported-v1`,legacy);if(localStorage.getItem(LEGACY_STORAGE_KEY)!==legacy)return {profile:null,error:'旧档案已变化，请重新进入游戏。'}; }
    catch { return {profile:null,error:'无法备份旧档案，原存档未修改。'}; }
  } else profile=makeProfile();
  bind(profile,null);const saved=saveProfile(profile);
  return saved.ok?{profile,error:null}:{profile:null,error:saved.error};
}

function commit(profile, mutate) {
  if (!validProfile(profile)) return { ok: false, message: '当前档案无效，操作已取消。' };
  const next = bind(clone(profile),baselines.get(profile)), result = mutate(next);
  if (!result.ok) return result;
  const saved = saveProfile(next);
  if (!saved.ok) return { ok: false, message: saved.error };
  for (const key of Object.keys(profile)) delete profile[key];
  Object.assign(profile, next);
  baselines.set(profile,baselines.get(next));
  return result;
}

function validCheckinDay(day) {
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<'0001-01-01')return false;
  const date=new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day;
}
function validDailyCheckin(record) {
  return exactKeys(record,['day','bonusClaimed','totalDays'])&&validCheckinDay(record.day)&&typeof record.bonusClaimed==='boolean'&&Number.isSafeInteger(record.totalDays)&&record.totalDays>0;
}
// A fixed UTC+8 day avoids timezone settings changing the reward boundary.
function checkinDay(now) {
  const timestamp=now instanceof Date?now.getTime():now;
  if(typeof timestamp!=='number'||!Number.isFinite(timestamp))return null;
  const date=new Date(timestamp+8*60*60*1000);
  if(!Number.isFinite(date.getTime()))return null;
  const day=date.toISOString().slice(0,10);
  return validCheckinDay(day)?day:null;
}
export function getDailyCheckinState(profile,now=Date.now()) {
  const day=checkinDay(now), valid=validProfile(profile), record=valid?profile.dailyCheckin:null;
  const clockRollback=Boolean(day&&record&&day<record.day);
  const baseClaimed=Boolean(day&&record&&day===record.day);
  const bonusClaimed=baseClaimed&&record.bonusClaimed;
  return {day,canClaim:Boolean(valid&&day&&!clockRollback&&!baseClaimed),canDouble:Boolean(valid&&day&&baseClaimed&&!bonusClaimed),baseClaimed,bonusClaimed,totalDays:record?.totalDays??0,clockRollback,reward:DAILY_CHECKIN_REWARD};
}
function commitCheckin(profile,mutate) {
  if(!validProfile(profile))return {ok:false,message:'当前档案无效，签到已取消。'};
  try {
    const raw=getLocalProfileRaw();
    if(baselines.has(profile)&&raw!==baselines.get(profile))return {ok:false,message:'本机进度已变化，请重新进入游戏后签到。'};
    if(!baselines.has(profile)) {
      if(raw!==null)return {ok:false,message:'档案未可靠读取，请重新进入游戏后签到。'};
      bind(profile,null);
    }
  } catch { return {ok:false,message:'无法读取档案，签到已取消。'}; }
  return commit(profile,mutate);
}
export function claimDailyCheckin(profile,now=Date.now()) {
  return commitCheckin(profile,next=>{
    const state=getDailyCheckinState(next,now);
    if(!state.canClaim)return {ok:false,message:state.clockRollback?'设备日期早于已签到日期，请校准时间。':state.day?'今日已经签到。':'设备日期无效，签到已取消。'};
    const totalDays=state.totalDays+1;
    if(!Number.isSafeInteger(totalDays)||!Number.isSafeInteger(next.gold+DAILY_CHECKIN_REWARD.gold)||!Number.isSafeInteger(next.materials+DAILY_CHECKIN_REWARD.materials))return {ok:false,message:'签到数值超出支持范围。'};
    next.gold+=DAILY_CHECKIN_REWARD.gold;next.materials+=DAILY_CHECKIN_REWARD.materials;
    next.dailyCheckin={day:state.day,bonusClaimed:false,totalDays};
    return {ok:true,message:'签到奖励已领取。',day:state.day,reward:DAILY_CHECKIN_REWARD,totalDays};
  });
}
// The caller must supply a completed ad receipt. An old-day receipt remains valid
// across midnight only while its original base claim is still the active record.
export function grantDailyCheckinBonus(profile,day,now=Date.now()) {
  return commitCheckin(profile,next=>{
    const today=checkinDay(now),record=next.dailyCheckin;
    if(!validCheckinDay(day)||!today||!record||record.day!==day||today<day)return {ok:false,message:'签到日期已变化或设备时间异常，未发放额外奖励。'};
    if(record.bonusClaimed)return {ok:false,message:'本次签到额外奖励已经领取。'};
    if(!Number.isSafeInteger(next.gold+DAILY_CHECKIN_REWARD.gold)||!Number.isSafeInteger(next.materials+DAILY_CHECKIN_REWARD.materials))return {ok:false,message:'签到数值超出支持范围。'};
    next.gold+=DAILY_CHECKIN_REWARD.gold;next.materials+=DAILY_CHECKIN_REWARD.materials;record.bonusClaimed=true;
    return {ok:true,message:'签到额外奖励已领取。',day,reward:DAILY_CHECKIN_REWARD,totalDays:record.totalDays};
  });
}

export function getRecruitCost() { return 100; }
export function recruit() { return { ok: false, message: '独行远征不再招募随行伙伴。' }; }
export function toggleSquad() { return { ok: false, message: '独行远征不使用同伴编队。' }; }
export function getHeroTrainingCost(profile) {
  const level = getActiveHeroProgress(profile)?.level;
  if (!integer(level, 1) || level >= 30) return null;
  const barracks = integer(profile?.buildings?.barracks) ? profile.buildings.barracks : 0;
  return { gold: Math.max(30, 80 + level * 30 - barracks * 10), materials: 10 + level * 5 };
}
export function getTrainingCost(profile, id) { return !id || id === profile?.selectedHero ? getHeroTrainingCost(profile) : null; }
export function trainHero(profile) {
  return commit(profile, next => {
    const cost = getHeroTrainingCost(next), hero = getActiveHeroProgress(next), meta=getSelectedHero(next);
    if (!cost) return { ok: false, message: `${meta.name}已达到最高等级。` };
    if (next.gold < cost.gold || next.materials < cost.materials) return { ok: false, message: `训练需要 ${cost.gold} 金币与 ${cost.materials} 份材料。` };
    next.gold -= cost.gold; next.materials -= cost.materials; hero.level++;
    if (hero.level === 30) hero.experience = 0;
    return { ok: true, message: `${meta.name}升至 ${hero.level} 级。` };
  });
}
export function trainUnit(profile, id) { return id === profile?.selectedHero ? trainHero(profile) : { ok: false, message: HERO_IDS.includes(id)?'请先选择该英雄。':'旧战团成员不再参与远征训练。' }; }

export function getActiveHeroProgress(profile){return profile?.heroes?.[profile?.selectedHero]||null;}
/** An explicit action replaces all three slots atomically; changing jobs never does. */
export function equipRecommendedSkills(profile) {
  return commit(profile, next => {
    const hero=getActiveHeroProgress(next), base=getHero(next.selectedHero).skills.map(skill=>skill.id);
    const ids=recommendedSkills(hero.job,hero.level,base);
    if(ids.some(id=>!unlockedSkill(next,SKILL_DEFINITIONS[id])))return {ok:false,message:'推荐战技尚未解锁。'};
    hero.skillLoadout=ids;
    return {ok:true,message:'已装备当前等级的推荐三战技。'};
  });
}
export function selectCampaignHero(profile,id){
  return commit(profile,next=>{const hero=getHero(id);if(!hero)return{ok:false,message:'未知英雄。'};next.selectedHero=id;return{ok:true,message:`${hero.name}已整装待发。`};});
}

function unlockedSkill(profile, skill) {
  const hero = getActiveHeroProgress(profile);
  return skill.level <= hero.level && skill.jobs.includes(hero.job);
}
export function getAvailableSkills(profile) {
  if (!validProfile(profile)) return [];
  const hero=getActiveHeroProgress(profile);
  return Object.values(SKILL_DEFINITIONS).filter(skill=>skill.jobs.includes(hero.job)).map(skill => ({ ...skill, jobs: [...skill.jobs], unlocked: unlockedSkill(profile, skill) }));
}
export function getSkillLoadout(profile) { return validProfile(profile) ? [...getActiveHeroProgress(profile).skillLoadout] : BASE_SKILLS.slice(); }
export function equipSkill(profile, slotIndex, skillId) {
  return commit(profile, next => {
    if (!integer(slotIndex) || slotIndex > 2 || !SKILL_DEFINITIONS[skillId]) return { ok: false, message: '技能槽或技能无效。' };
    if (!unlockedSkill(next, SKILL_DEFINITIONS[skillId])) return { ok: false, message: '该技能尚未解锁。' };
    const hero=getActiveHeroProgress(next),other=hero.skillLoadout.indexOf(skillId);
    if (other >= 0 && other !== slotIndex) [hero.skillLoadout[other], hero.skillLoadout[slotIndex]] = [hero.skillLoadout[slotIndex], skillId];
    else hero.skillLoadout[slotIndex] = skillId;
    return { ok: true, message: `${SKILL_DEFINITIONS[skillId].name}已装备。` };
  });
}

export function getJobState(profile, id) {
  const job=HERO_JOBS[id];
  if (!job) return null;
  const valid=validProfile(profile), hero=valid?profile.heroes[job.heroId]:null, claimed=valid&&job.questId?profile.progression.claimedQuests.includes(job.questId):false;
  const mossComplete=valid&&profile.cleared.includes('moss-gate'), trialComplete=valid&&(!job.trialId||(profile.progression.dungeonWins[job.trialId]||0)>0);
  const unlocked=Boolean(hero?.unlockedJobs.includes(id));
  return {
    unlocked, active:Boolean(hero?.job===id), readyToClaim:Boolean(job.questId&&trialComplete&&!claimed), questId:job.questId,
    description:job.description, requirement:job.tier===1?'初始解锁':'英雄达到 3 级、通关苔痕关并完成职业试炼', trialId:job.trialId,
    steps:job.tier===1?[]:[
      {label:'英雄达到 3 级',complete:Boolean(hero&&hero.level>=3)},
      {label:'通关苔痕关',complete:Boolean(mossComplete)},
      {label:'完成职业试炼',complete:Boolean(trialComplete)},
      {label:'领取传承任务',complete:Boolean(claimed)},
    ],
  };
}
export function switchJob(profile, id) {
  return commit(profile, next => {
    const job=HERO_JOBS[id];
    if (!job) return { ok: false, message: '未知职业。' };
    if(job.heroId!==next.selectedHero)return{ok:false,message:'该职业不属于当前英雄。'};
    const hero=next.heroes[job.heroId];
    if (!hero.unlockedJobs.includes(id)) return { ok: false, message: '该职业尚未解锁。' };
    hero.job = id;
    const available = Object.values(SKILL_DEFINITIONS).filter(skill => unlockedSkill(next, skill)).map(skill => skill.id);
    const kept = hero.skillLoadout.filter(skillId => available.includes(skillId));
    hero.skillLoadout = [...new Set([...kept, ...available])].slice(0, 3);
    return { ok: true, message: `已切换为${HERO_JOBS[id].name}。` };
  });
}
export function promoteHero(profile) { return switchJob(profile, 'blade_master'); }

const QUESTS = [
  { id: 'main-moss', name: '突破苔痕关', description: '完成第一场远征。', target: 1, dungeonId: 'moss-gate', rewards: { gold: 200, materials: 20 } },
  { id: 'main-ember', name: '清剿烬火古道', description: '继续深入赤岭。', target: 1, dungeonId: 'ember-trail', rewards: { gold: 300, materials: 35 } },
  { id: 'job-blade', name: '剑阵传承', description: '完成剑阵试炼，解锁剑阵宗师。', target: 1, dungeonId: 'blade-trial', jobId: 'blade_master', rewards: { gold: 100, materials: 15 } },
  { id: 'job-swift', name: '迅刃传承', description: '完成迅刃试炼，解锁迅刃。', target: 1, dungeonId: 'swift-trial', jobId: 'swift_blade', rewards: { gold: 100, materials: 15 } },
  { id: 'job-summoner', name: '契灵传承', description: '完成契灵试炼，解锁契灵统御者。', target: 1, dungeonId: 'summoner-trial', heroId: 'summoner', jobId: 'summoner_master', rewards: { gold: 100, materials: 15 } },
  { id: 'job-blink', name: '瞬印传承', description: '完成瞬印试炼，解锁瞬印宗师。', target: 1, dungeonId: 'blink-trial', heroId: 'blink', jobId: 'blink_master', rewards: { gold: 100, materials: 15 } },
  { id: 'job-mage', name: '元素传承', description: '完成元素试炼，解锁元素贤者。', target: 1, dungeonId: 'mage-trial', heroId: 'mage', jobId: 'mage_master', rewards: { gold: 100, materials: 15 } },
];
export function getQuestStates(profile) {
  if (!validProfile(profile)) return [];
  return QUESTS.filter(q=>!q.jobId||HERO_JOBS[q.jobId]?.heroId===profile.selectedHero).map(q => { const progress = Math.min(q.target, profile.progression.dungeonWins[q.dungeonId] || 0); return { id: q.id, name: q.name, description: q.description, progress, target: q.target, ready: progress >= q.target && !profile.progression.claimedQuests.includes(q.id), claimed: profile.progression.claimedQuests.includes(q.id), dungeonId: q.dungeonId, rewards: clone(q.rewards) }; });
}
export function claimQuest(profile, id) {
  return commit(profile, next => {
    const quest = QUESTS.find(q => q.id === id);
    if (!quest) return { ok: false, message: '未知任务。' };
    if (quest.jobId && HERO_JOBS[quest.jobId]?.heroId!==next.selectedHero) return { ok: false, message: '该传承任务不属于当前英雄。' };
    if (next.progression.claimedQuests.includes(id)) return { ok: false, message: '任务奖励已经领取。' };
    if ((next.progression.dungeonWins[quest.dungeonId] || 0) < quest.target) return { ok: false, message: '任务尚未完成。' };
    next.progression.claimedQuests.push(id); next.gold += quest.rewards.gold; next.materials += quest.rewards.materials;
    const heroId=quest.heroId||HERO_JOBS[quest.jobId]?.heroId;
    if (quest.jobId && heroId && !next.heroes[heroId].unlockedJobs.includes(quest.jobId)) next.heroes[heroId].unlockedJobs.push(quest.jobId);
    return { ok: true, message: quest.jobId ? `已解锁${HERO_JOBS[quest.jobId].name}。` : '任务奖励已领取。' };
  });
}

export function getBuildingCost(profile, id) { const b = BUILDINGS.find(x => x.id === id), level = profile?.buildings?.[id]; return b && integer(level) && level < b.maxLevel ? b.baseCost * (level + 1) : null; }
export function upgradeBuilding(profile, id) {
  return commit(profile, next => { const b = BUILDINGS.find(x => x.id === id), cost = getBuildingCost(next, id); if (!b) return { ok: false, message: '未知建筑。' }; if (cost === null) return { ok: false, message: `${b.name}已达到最高等级。` }; if (next.materials < cost) return { ok: false, message: `升级需要 ${cost} 份材料。` }; next.materials -= cost; next.buildings[id]++; return { ok: true, message: `${b.name}升至 ${next.buildings[id]} 级。` }; });
}

export function getDungeonLockReason(profile, dungeon) {
  const item = typeof dungeon === 'string' ? DUNGEONS.find(x => x.id === dungeon) : dungeon;
  if (!item || !validProfile(profile)) return '档案或副本无效。';
  const trialJob=Object.values(HERO_JOBS).find(job=>job.trialId===item.id);
  if (trialJob && profile.selectedHero !== trialJob.heroId) return trialJob.heroId==='commander'?'这是剑士转职试炼，请先选择风刃指挥官。':`这是${getHero(trialJob.heroId).name}的职业试炼。`;
  if (item.requires && !profile.cleared.includes(item.requires)) return '需要先通关苔痕关。';
  if (trialJob && profile.heroes[trialJob.heroId].level < 3) return '职业试炼需要英雄达到 3 级。';
  return null;
}
export function isUnlocked(profile, dungeon) { return getDungeonLockReason(profile, dungeon) === null; }

function grantExperience(hero, amount) {
  hero.experience += amount;
  while (hero.level < 30) {
    const needed = hero.level * 100;
    if (hero.experience < needed) break;
    hero.experience -= needed; hero.level++;
  }
  if (hero.level >= 30) hero.experience = 0;
}
export function settleRun(profile, run) {
  if (!run || typeof run.id !== 'string' || !run.id || run.id.length > 160) return { ok: false, message: '远征记录缺少有效编号。' };
  if (validProfile(profile) && profile.settledRuns.includes(run.id)) return { ok: true, message: '这次远征已经结算，没有重复发放奖励。', reward: profile.lastReward?.runId === run.id ? { ...profile.lastReward, unitId: null } : { gold: 0, materials: 0, xp: 0, unitId: null, firstClear: false, victory: Boolean(run.victory) } };
  return commit(profile, next => {
    const dungeon = DUNGEONS.find(x => x.id === run.dungeonId);
    const heroId=HERO_IDS.includes(run.heroId)?run.heroId:next.selectedHero;
    const trialJob=Object.values(HERO_JOBS).find(job=>job.trialId===run.dungeonId);
    const inaccessible=!dungeon||dungeon.requires&&!next.cleared.includes(dungeon.requires)||trialJob&&(!HERO_IDS.includes(run.heroId)||heroId!==trialJob.heroId||next.heroes[heroId].level<3);
    if (inaccessible || (run.heroId!==undefined&&!HERO_IDS.includes(run.heroId)) || typeof run.victory !== 'boolean' || !Number.isFinite(run.kills) || run.kills < 0 || !Number.isFinite(run.time) || run.time < 0) return { ok: false, message: '远征记录不完整或副本尚未解锁。' };
    const progress = run.victory ? 1 : Math.min(.65, Math.min(1, run.time / dungeon.duration) * .5 + Math.min(1, run.kills / 650) * .15);
    const gold = Math.max(run.victory ? 1 : 0, Math.floor(dungeon.rewards.gold * progress));
    const materials = Math.max(run.victory ? 1 : 0, Math.floor(dungeon.rewards.materials * progress * (1 + next.buildings.workshop * .08)));
    const xp = Math.floor(dungeon.rewards.xp * progress);
    const firstClear = run.victory && !next.cleared.includes(dungeon.id);
    if (firstClear) next.cleared.push(dungeon.id);
    if (run.victory) next.progression.dungeonWins[dungeon.id] = (next.progression.dungeonWins[dungeon.id] || 0) + 1;
    next.progression.kills += Math.floor(run.kills); next.gold += gold; next.materials += materials; grantExperience(next.heroes[heroId], xp); next.settledRuns.push(run.id);
    const reward = { gold, materials, xp, unitId: null, firstClear, victory: run.victory };
    next.lastReward = { ...reward, runId: run.id, runDuration:run.time };
    return { ok: true, message: `${run.victory ? '远征胜利' : '远征结束'}，获得 ${gold} 金币、${materials} 份材料与 ${xp} 经验。`, reward };
  });
}
export function getAdGoldBonus(profile,runId){
  return getAdRewardBonus(profile,runId).gold;
}
export function getAdRewardBonus(profile,runId){
  const none={gold:0,materials:0};
  if(!validProfile(profile))return none;
  const reward=profile.lastReward;
  if(!reward||reward.runId!==runId||!profile.settledRuns.includes(runId)||reward.adBonusClaimed===true||!integer(reward.gold,1)||!integer(reward.materials)||!Number.isFinite(reward.runDuration)||reward.runDuration<60)return none;
  return {gold:Math.floor(reward.gold*.5),materials:Math.floor(reward.materials*.25)};
}
export function grantAdGoldBonus(profile,runId){
  // Historical gold-only claims remain complete: adding materials must never replay them.
  if(validProfile(profile)&&profile.lastReward?.runId===runId&&profile.lastReward.adBonusClaimed===true)return {ok:true,alreadyClaimed:true,gold:profile.lastReward.adBonusGold,materials:profile.lastReward.adBonusMaterials??0,message:'本局额外奖励已领取，不会重复发放。'};
  const amount=getAdRewardBonus(profile,runId);if(amount.gold<=0)return {ok:false,message:'本局不符合额外奖励领取条件。'};
  return commit(profile,next=>{next.gold+=amount.gold;next.materials+=amount.materials;next.lastReward.adBonusClaimed=true;next.lastReward.adBonusGold=amount.gold;next.lastReward.adBonusMaterials=amount.materials;return {ok:true,...amount,message:`额外金币 +${amount.gold}、材料 +${amount.materials} 已保存。`};});
}

export function getExpedition(profile, dungeonId) {
  const dungeon = DUNGEONS.find(x => x.id === dungeonId);
  if (!validProfile(profile) || !dungeon || !isUnlocked(profile, dungeon)) return null;
  const hero = getSelectedHero(profile), progress=getActiveHeroProgress(profile), level = progress.level, hall = profile.buildings.hall;
  return { dungeon: clone(dungeon), companions: [], heroId:hero.id, heroKind: getHeroKind(hero.id,progress.job), heroName: hero.name, heroJob: progress.job, heroSkills: getSkillLoadout(profile), heroBonus: { hp: hall * 12 + (level - 1) * 10, damage: hall * .07 + (level - 1) * .05 } };
}

// The release gate detects removal/renaming of identifiers referenced by saves.
export function getSaveContentIds() {
  return {heroes:[...HERO_IDS],jobs:[...JOB_IDS],skills:[...SKILL_IDS],units:[...UNIT_IDS],buildings:[...BUILDING_IDS],cleared:[...CLEARED_IDS],quests:QUESTS.map(q=>q.id)};
}
