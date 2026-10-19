import { getHero, getHeroKind, getHeroJobs, getSelectedHero, HEROES, HERO_JOBS, SKILL_DEFINITIONS, HERO_ACTIVE_SKILLS, getActiveSkillLoadout } from './heroes.js';
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
const BASE_SKILLS = ['dash', 'cleave', 'whirlwind'];
const HERO_DEFAULTS = Object.freeze({
  summoner: Object.freeze({ job:'summoner', skills:Object.freeze(['summonGuard','recallSummons','summonElite']) }),
  blink: Object.freeze({ job:'blink', skills:Object.freeze(['markBlade','blinkStrike','blinkStorm']) }),
  mage: Object.freeze({ job:'mage', skills:Object.freeze(['flameBreath','frostAura','rockWall']) }),
  grappler:Object.freeze({job:'brawler',skills:Object.freeze(['grappleHook', 'grappleSlam', 'grappleClash'])}),
  rift:Object.freeze({job:'rift_apprentice',skills:Object.freeze(['riftGate', 'riftStep', 'riftBarrage'])}),
  magnet:Object.freeze({job:'scrap_apprentice',skills:Object.freeze(['magnetField', 'magnetLance', 'magnetCrush'])}),
  sword:Object.freeze({job:'sword_apprentice',skills:Object.freeze(['swordFocus', 'swordRecall', 'swordUnion'])}),
  spiral:Object.freeze({job:'shadow_novice',skills:Object.freeze(['spiralOrb', 'spiralClone', 'spiralConvergence'])}),
  petal:Object.freeze({job:'petal_apprentice',skills:Object.freeze(['petalSweep', 'petalPierce', 'petalBloom'])}),
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
  { id: 'blade-trial', name: '剑阵挑战', region: '挑战场', description: '诱出两次扇斩，抓住收盾破绽集中反击。', x: 66, y: 38, duration: 120, difficulty: 2, enemies: ['guard_basic', 'archer_elite', 'brute'], boss: { name: '铁誓盾卫', kind: 'trial_commander', abilityId: 'trialBulwark', hp: 11500, damage: 22, spawnAt: 100, hint: '诱出两次扇斩，抓住收盾破绽集中反击。' }, eliteWaves: [['kilnGuard'], ['kilnGuard'], ['kilnGuard']], rewards: { gold: 180, materials: 24, xp: 90 }, spawnScale: .9, unitDrops: [], requires: 'moss-gate' },
  { id: 'swift-trial', name: '迅刃挑战', region: '挑战场', description: '逐段横移避开突进，落击之后近身反打。', x: 72, y: 58, duration: 120, difficulty: 2, enemies: ['runner', 'scout_basic', 'archer_elite'], boss: { name: '逐风猎刃', kind: 'trial_swift', abilityId: 'trialPursuer', hp: 11000, damage: 22, spawnAt: 100, hint: '逐段横移避开突进，落击之后近身反打。' }, eliteWaves: [['laneGunner'], ['laneGunner'], ['laneGunner']], rewards: { gold: 180, materials: 24, xp: 90 }, spawnScale: 1.25, unitDrops: [], requires: 'moss-gate' },
  { id: 'summoner-trial', name: '契灵挑战', region: '挑战场', description: '集火拆除缚魂节点，在断链破绽中倾泻火力。', x: 78, y: 30, duration: 120, difficulty: 2, enemies: ['guard_basic', 'brute', 'archer_elite'], boss: { name: '缚魂司祭', kind: 'trial_summoner', abilityId: 'trialBinder', hp: 11000, damage: 20, spawnAt: 100, hint: '集火拆除缚魂节点，在断链破绽中倾泻火力。' }, eliteWaves: [['kilnGuard'], ['kilnGuard'], ['kilnGuard']], rewards: { gold: 180, materials: 24, xp: 90 }, spawnScale: .95, unitDrops: [], requires: 'moss-gate' },
  { id: 'blink-trial', name: '瞬印挑战', region: '挑战场', description: '辨认圆印爆破顺序，预布飞镖穿过错时裂隙。', x: 82, y: 47, duration: 120, difficulty: 2, enemies: ['runner', 'scout_basic', 'archer_elite'], boss: { name: '镜隙行者', kind: 'trial_blink', abilityId: 'trialRift', hp: 11000, damage: 22, spawnAt: 100, hint: '辨认圆印爆破顺序，预布飞镖穿过错时裂隙。' }, eliteWaves: [['laneGunner'], ['laneGunner'], ['laneGunner']], rewards: { gold: 180, materials: 24, xp: 90 }, spawnScale: 1.25, unitDrops: [], requires: 'moss-gate' },
  { id: 'mage-trial', name: '元素挑战', region: '挑战场', description: '辨别内外圈，保留爆发打断聚能，失败及时撤离。', x: 86, y: 65, duration: 120, difficulty: 2, enemies: ['guard_basic', 'runner', 'brute'], boss: { name: '三相观测者', kind: 'trial_mage', abilityId: 'trialPrism', hp: 11500, damage: 22, spawnAt: 100, hint: '辨别内外圈，保留爆发打断聚能，失败及时撤离。' }, eliteWaves: [['blastBeetle'], ['blastBeetle'], ['blastBeetle']], rewards: { gold: 180, materials: 24, xp: 90 }, spawnScale: 1, unitDrops: [], requires: 'moss-gate' },
].map(item => Object.freeze(item)));

export const BUILDINGS = Object.freeze([
  { id: 'hall', name: '体能与战意', description: '每级为英雄增加 12 点生命与 7% 伤害。', maxLevel: 5, baseCost: 35 },
  { id: 'barracks', name: '训练效率', description: '每级使英雄训练所需金币减少 10、材料减少 5%，材料向上取整。', maxLevel: 5, baseCost: 30 },
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
  if(h.job==='blade_master'&&h.skillLoadout.some(id=>['whirlwind','quickCut'].includes(id)))return false;
  const p = profile.progression;
  return exactKeys(p, ['claimedQuests', 'dungeonWins', 'kills']) && uniqueStrings(p.claimedQuests) && p.claimedQuests.every(id => ['main-moss','main-ember','job-blade','job-swift','job-summoner','job-blink','job-mage'].includes(id)) && object(p.dungeonWins)
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

const LEGACY_HERO_IDS = ['commander','summoner','blink','mage'];
const PREVIOUS_HERO_IDS = [...LEGACY_HERO_IDS,'grappler','rift','magnet'];
const LEGACY_JOB_IDS=['fighter','swift_blade','blade_master','summoner','summoner_master','blink','blink_master','mage','mage_master'];
const PREVIOUS_JOB_IDS=[...LEGACY_JOB_IDS,'brawler','grappler','titan_grappler','rift_apprentice','rift_weaver','rift_sovereign','scrap_apprentice','magnet_master','magnet_sovereign'];
const LEGACY_QUEST_IDS=['main-moss','main-ember','job-blade','job-swift','job-summoner','job-blink','job-mage'];
const PREVIOUS_QUEST_IDS=[...LEGACY_QUEST_IDS,'job-grappler-2','job-grappler-3','job-rift-2','job-rift-3','job-magnet-2','job-magnet-3'];
function validProfile(profile, heroIds=HERO_IDS) {
  const keys=['version','gold','materials','roster','squad','buildings','cleared','settledRuns','lastReward','heroes','progression','selectedHero'];
  if(Object.hasOwn(profile ?? {},'dailyCheckin')) { keys.push('dailyCheckin'); if(!validDailyCheckin(profile.dailyCheckin))return false; }
  if (profile?.version !== PROFILE_SCHEMA_VERSION || !validBase(profile) || !exactKeys(profile, keys)) return false;
  if (!heroIds.includes(profile.selectedHero) || !exactKeys(profile.heroes,heroIds) || !heroIds.every(id=>validHeroProgress(profile.heroes[id],id))) return false;
  if (!profile.heroes.commander.unlockedJobs.includes('fighter')) return false;
  if(heroIds!==HERO_IDS){
    const allowedJobs=heroIds===LEGACY_HERO_IDS?LEGACY_JOB_IDS:PREVIOUS_JOB_IDS,allowedQuests=heroIds===LEGACY_HERO_IDS?LEGACY_QUEST_IDS:PREVIOUS_QUEST_IDS;
    if(!Array.isArray(profile.progression?.claimedQuests))return false;
    if(profile.heroes.commander.job==='blade_master'&&profile.heroes.commander.skillLoadout.some(id=>['whirlwind','quickCut'].includes(id)))return false;
    if(heroIds.some(id=>profile.heroes[id].unlockedJobs.some(job=>!allowedJobs.includes(job)))||profile.progression?.claimedQuests?.some(id=>!allowedQuests.includes(id)))return false;
  }
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

// Only the two published exact four/seven-hero shapes may be expanded; no partial shapes.
export function normalizeProfile(parsed) {
  if(validProfile(parsed))return clone(parsed);
  if(!validProfile(parsed,LEGACY_HERO_IDS)&&!validProfile(parsed,PREVIOUS_HERO_IDS))return null;
  const next=clone(parsed);
  for(const id of HERO_IDS.filter(id=>!Object.hasOwn(parsed.heroes,id))) {
    const data=HERO_DEFAULTS[id];next.heroes[id]={level:1,experience:0,job:data.job,unlockedJobs:[data.job],skillLoadout:[...data.skills]};
  }
  return validProfile(next)?next:null;
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
  const normalized=validProfile(current,LEGACY_HERO_IDS)?normalizeProfile(current):null;
  if(normalized)return normalized;
  if (validPreHeroesProfile(parsed) || validOldProfile(parsed)) {
    const next=makeProfile(parsed);return validProfile(next)?next:null;
  }
  return null;
}
export function loadProfile() {
  let raw, legacy;
  try { raw=getLocalProfileRaw(); } catch(error) { return {profile:null,error:'无法读取档案，原记录未修改。'}; }
  if (raw !== null) {
    try { const parsed=normalizeProfile(JSON.parse(raw));return parsed?{profile:bind(parsed,raw),error:null}:{profile:null,error:'存档版本或内容无法识别，原存档已保留。'}; }
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
  return { gold: Math.max(30, 80 + level * 30 - barracks * 10), materials: Math.ceil((10 + level * 5) * (1 - Math.min(5, barracks) * .05)) };
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
// Reorder only the two live skills. The third historical ID remains a legal saved payload.
function storeActiveOrder(hero,heroId,order){const allowed=HERO_ACTIVE_SKILLS[heroId],positions=hero.skillLoadout.map((id,i)=>allowed.includes(id)?i:-1).filter(i=>i>=0);for(let i=0;positions.length<2&&i<hero.skillLoadout.length;i++)if(!positions.includes(i))positions.push(i);positions.sort((a,b)=>a-b);order.forEach((id,i)=>{hero.skillLoadout[positions[i]]=id;});}
export function equipRecommendedSkills(profile) {
 return commit(profile,next=>{const hero=getActiveHeroProgress(next),ids=getActiveSkillLoadout(next.selectedHero);if(ids.some(id=>!unlockedSkill(next,SKILL_DEFINITIONS[id])))return {ok:false,message:'推荐战技尚未解锁。'};storeActiveOrder(hero,next.selectedHero,ids);return {ok:true,message:'已装备两项主动战技；平A自动施放。'};});
}
export function selectCampaignHero(profile,id,jobId){
  return commit(profile,next=>{
    const meta=getHero(id);if(!meta)return {ok:false,message:'未知英雄。'};
    const hero=next.heroes[id],target=jobId===undefined?hero.job:jobId,job=HERO_JOBS[target];
    if(!job)return {ok:false,message:'未知职业阶段。'};
    if(job.heroId!==id)return {ok:false,message:'该阶段不属于当前英雄。'};
    if(job.tier>highestOwnedTier(hero))return {ok:false,message:'请先领取该阶段的晋升。'};
    if(next.selectedHero===id&&hero.job===target)return {ok:false,message:'已出战。'};
    next.selectedHero=id;
    // Historical saves can own tier III without listing the intermediate tier.
    if(!hero.unlockedJobs.includes(target))hero.unlockedJobs.push(target);
    applySelectedJob(hero,target,id);
    return {ok:true,message:`${meta.name} · ${job.name}已出战。`};
  });
}

function unlockedSkill(profile, skill) {
  const hero = getActiveHeroProgress(profile);
  return skill.level <= hero.level && skill.jobs.includes(hero.job);
}
export function getAvailableSkills(profile) {
  if (!validProfile(profile)) return [];
  const hero=getActiveHeroProgress(profile);
  return Object.values(SKILL_DEFINITIONS).filter(skill=>HERO_ACTIVE_SKILLS[profile.selectedHero].includes(skill.id)&&skill.jobs.includes(hero.job)).map(skill => ({ ...skill, jobs: [...skill.jobs], unlocked: unlockedSkill(profile, skill) }));
}
export function getSkillLoadout(profile) { return validProfile(profile) ? [...getActiveHeroProgress(profile).skillLoadout] : BASE_SKILLS.slice(); }
export function getActiveCampaignSkills(profile){return validProfile(profile)?getActiveSkillLoadout(profile.selectedHero,getActiveHeroProgress(profile).skillLoadout):getActiveSkillLoadout('commander');}
export function equipSkill(profile, slotIndex, skillId) {
 return commit(profile,next=>{if(!integer(slotIndex)||slotIndex>1||!HERO_ACTIVE_SKILLS[next.selectedHero].includes(skillId))return {ok:false,message:'主动技能槽或技能无效。'};if(!unlockedSkill(next,SKILL_DEFINITIONS[skillId]))return {ok:false,message:'该技能尚未解锁。'};const hero=getActiveHeroProgress(next),order=getActiveSkillLoadout(next.selectedHero,hero.skillLoadout),other=order.indexOf(skillId);if(other!==slotIndex)[order[slotIndex],order[other]]=[order[other],order[slotIndex]];storeActiveOrder(hero,next.selectedHero,order);return {ok:true,message:`${SKILL_DEFINITIONS[skillId].name}已装备。`};});
}

function highestOwnedTier(hero){return Math.max(...hero.unlockedJobs.map(id=>HERO_JOBS[id]?.tier||0));}
function applySelectedJob(hero,id,heroId){
  hero.job=id;
  const legal=skillId=>{const skill=SKILL_DEFINITIONS[skillId];return Boolean(skill&&skill.level<=hero.level&&skill.jobs.includes(id));};
  const recommended=recommendedSkills(id,hero.level,getHero(heroId).skills.map(skill=>skill.id));
  hero.skillLoadout=[...new Set([...hero.skillLoadout.filter(legal),...recommended.filter(legal),...getHero(heroId).skills.map(skill=>skill.id).filter(legal)])].slice(0,3);
}
export function getJobState(profile,id){
  const job=HERO_JOBS[id];if(!job)return null;
  const valid=validProfile(profile),hero=valid?profile.heroes[job.heroId]:null;
  const claimed=Boolean(valid&&job.questId&&profile.progression.claimedQuests.includes(job.questId));
  const highest=hero?highestOwnedTier(hero):0,unlocked=highest>=job.tier,levelNeeded=job.tier===3?6:3;
  const levelComplete=Boolean(hero&&hero.level>=levelNeeded),clearComplete=Boolean(valid&&profile.cleared.includes(job.tier===3?'ember-trail':'moss-gate')),previousComplete=job.tier!==3||highest>=2;
  return {unlocked,highestTier:highest,active:hero?.job===id,completed:unlocked,readyToClaim:Boolean(job.tier>1&&!unlocked&&!claimed&&levelComplete&&clearComplete&&previousComplete),questId:job.questId,trialId:null,description:job.description,requirement:job.tier===1?'初始阶段':`该英雄达到${levelNeeded}级并通关${job.tier===3?'烬火古道，且已晋升二阶':'苔痕关'}`,steps:job.tier===1?[]:[{label:`该英雄达到 ${levelNeeded} 级`,complete:levelComplete},{label:`通关${job.tier===3?'烬火古道':'苔痕关'}`,complete:clearComplete},...(job.tier===3?[{label:'已晋升二阶',complete:previousComplete}]:[]),{label:'免费领取并解锁',complete:unlocked||claimed}]};
}
// Compatibility entry point shares the same owned-tier selection transaction.
export function switchJob(profile,id){
  return selectCampaignHero(profile,profile?.selectedHero,id);
}
export function promoteHero(profile) { return switchJob(profile, 'blade_master'); }

const QUESTS = [
  { id: 'main-moss', name: '突破苔痕关', description: '完成第一场远征。', target: 1, dungeonId: 'moss-gate', rewards: { gold: 200, materials: 20 } },
  { id: 'main-ember', name: '清剿烬火古道', description: '继续深入赤岭。', target: 1, dungeonId: 'ember-trail', rewards: { gold: 300, materials: 35 } },
  { id: 'job-blade', name: '剑阵挑战', description: '完成剑阵挑战，领取挑战奖励。', target: 1, dungeonId: 'blade-trial', jobId: 'blade_master', rewards: { gold: 100, materials: 15 } },
  { id: 'job-swift', name: '迅刃挑战', description: '完成迅刃挑战，领取挑战奖励。', target: 1, dungeonId: 'swift-trial', jobId: 'swift_blade', rewards: { gold: 100, materials: 15 } },
  { id: 'job-summoner', name: '契灵挑战', description: '完成契灵挑战，领取挑战奖励。', target: 1, dungeonId: 'summoner-trial', heroId: 'summoner', jobId: 'summoner_master', rewards: { gold: 100, materials: 15 } },
  { id: 'job-blink', name: '瞬印挑战', description: '完成瞬印挑战，领取挑战奖励。', target: 1, dungeonId: 'blink-trial', heroId: 'blink', jobId: 'blink_master', rewards: { gold: 100, materials: 15 } },
  { id: 'job-mage', name: '元素挑战', description: '完成元素挑战，领取挑战奖励。', target: 1, dungeonId: 'mage-trial', heroId: 'mage', jobId: 'mage_master', rewards: { gold: 100, materials: 15 } },
  {id:'job-grappler-2',name:'魔手二阶晋升',description:'达到该英雄3级，通关苔痕关后免费领取并解锁。',target:1,dungeonId:'moss-gate',heroId:'grappler',jobId:'grappler',mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'job-grappler-3',name:'魔手三阶晋升',description:'达到该英雄6级，通关烬火古道后免费领取并解锁。',target:1,dungeonId:'ember-trail',heroId:'grappler',jobId:'titan_grappler',mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'job-rift-2',name:'界门二阶晋升',description:'达到该英雄3级，通关苔痕关后免费领取并解锁。',target:1,dungeonId:'moss-gate',heroId:'rift',jobId:'rift_weaver',mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'job-rift-3',name:'界门三阶晋升',description:'达到该英雄6级，通关烬火古道后免费领取并解锁。',target:1,dungeonId:'ember-trail',heroId:'rift',jobId:'rift_sovereign',mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'job-magnet-2',name:'磁械二阶晋升',description:'达到该英雄3级，通关苔痕关后免费领取并解锁。',target:1,dungeonId:'moss-gate',heroId:'magnet',jobId:'magnet_master',mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'job-magnet-3',name:'磁械三阶晋升',description:'达到该英雄6级，通关烬火古道后免费领取并解锁。',target:1,dungeonId:'ember-trail',heroId:'magnet',jobId:'magnet_sovereign',mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'ascend-commander-2',name:'二阶晋升',description:'该英雄达到3级，通关苔痕关后免费领取并解锁。',target:1,dungeonId:'moss-gate',heroId:'commander',jobId:Object.values(HERO_JOBS).find(j=>j.heroId==='commander'&&j.tier===2).id,mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'ascend-commander-3',name:'三阶晋升',description:'该英雄达到6级，通关烬火古道后免费领取并解锁。',target:1,dungeonId:'ember-trail',heroId:'commander',jobId:Object.values(HERO_JOBS).find(j=>j.heroId==='commander'&&j.tier===3).id,mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'ascend-summoner-2',name:'二阶晋升',description:'该英雄达到3级，通关苔痕关后免费领取并解锁。',target:1,dungeonId:'moss-gate',heroId:'summoner',jobId:Object.values(HERO_JOBS).find(j=>j.heroId==='summoner'&&j.tier===2).id,mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'ascend-summoner-3',name:'三阶晋升',description:'该英雄达到6级，通关烬火古道后免费领取并解锁。',target:1,dungeonId:'ember-trail',heroId:'summoner',jobId:Object.values(HERO_JOBS).find(j=>j.heroId==='summoner'&&j.tier===3).id,mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'ascend-blink-2',name:'二阶晋升',description:'该英雄达到3级，通关苔痕关后免费领取并解锁。',target:1,dungeonId:'moss-gate',heroId:'blink',jobId:Object.values(HERO_JOBS).find(j=>j.heroId==='blink'&&j.tier===2).id,mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'ascend-blink-3',name:'三阶晋升',description:'该英雄达到6级，通关烬火古道后免费领取并解锁。',target:1,dungeonId:'ember-trail',heroId:'blink',jobId:Object.values(HERO_JOBS).find(j=>j.heroId==='blink'&&j.tier===3).id,mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'ascend-mage-2',name:'二阶晋升',description:'该英雄达到3级，通关苔痕关后免费领取并解锁。',target:1,dungeonId:'moss-gate',heroId:'mage',jobId:Object.values(HERO_JOBS).find(j=>j.heroId==='mage'&&j.tier===2).id,mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'ascend-mage-3',name:'三阶晋升',description:'该英雄达到6级，通关烬火古道后免费领取并解锁。',target:1,dungeonId:'ember-trail',heroId:'mage',jobId:Object.values(HERO_JOBS).find(j=>j.heroId==='mage'&&j.tier===3).id,mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'ascend-sword-2',name:'二阶晋升',description:'该英雄达到3级，通关苔痕关后免费领取并解锁。',target:1,dungeonId:'moss-gate',heroId:'sword',jobId:Object.values(HERO_JOBS).find(j=>j.heroId==='sword'&&j.tier===2).id,mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'ascend-sword-3',name:'三阶晋升',description:'该英雄达到6级，通关烬火古道后免费领取并解锁。',target:1,dungeonId:'ember-trail',heroId:'sword',jobId:Object.values(HERO_JOBS).find(j=>j.heroId==='sword'&&j.tier===3).id,mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'ascend-spiral-2',name:'二阶晋升',description:'该英雄达到3级，通关苔痕关后免费领取并解锁。',target:1,dungeonId:'moss-gate',heroId:'spiral',jobId:Object.values(HERO_JOBS).find(j=>j.heroId==='spiral'&&j.tier===2).id,mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'ascend-spiral-3',name:'三阶晋升',description:'该英雄达到6级，通关烬火古道后免费领取并解锁。',target:1,dungeonId:'ember-trail',heroId:'spiral',jobId:Object.values(HERO_JOBS).find(j=>j.heroId==='spiral'&&j.tier===3).id,mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'ascend-petal-2',name:'二阶晋升',description:'该英雄达到3级，通关苔痕关后免费领取并解锁。',target:1,dungeonId:'moss-gate',heroId:'petal',jobId:Object.values(HERO_JOBS).find(j=>j.heroId==='petal'&&j.tier===2).id,mainProgression:true,rewards:{gold:0,materials:0}},
  {id:'ascend-petal-3',name:'三阶晋升',description:'该英雄达到6级，通关烬火古道后免费领取并解锁。',target:1,dungeonId:'ember-trail',heroId:'petal',jobId:Object.values(HERO_JOBS).find(j=>j.heroId==='petal'&&j.tier===3).id,mainProgression:true,rewards:{gold:0,materials:0}},
];
export function getQuestStates(profile) {
  if (!validProfile(profile)) return [];
  return QUESTS.filter(q=>!q.jobId||HERO_JOBS[q.jobId]?.heroId===profile.selectedHero).map(q => { const stage=q.mainProgression?getJobState(profile,q.jobId):null,progress=stage?(stage.readyToClaim||stage.unlocked?1:0):Math.min(q.target,profile.progression.dungeonWins[q.dungeonId]||0); return { id: q.id, name: q.name, description: q.description, progress, target: q.target, ready: q.mainProgression?getJobState(profile,q.jobId).readyToClaim:progress >= q.target && !profile.progression.claimedQuests.includes(q.id), claimed: Boolean(stage?.unlocked||profile.progression.claimedQuests.includes(q.id)), dungeonId: q.dungeonId, rewards: clone(q.rewards) }; });
}
export function claimQuest(profile, id) {
  return commit(profile, next => {
    const quest = QUESTS.find(q => q.id === id);
    if (!quest) return { ok: false, message: '未知任务。' };
    if (quest.jobId && HERO_JOBS[quest.jobId]?.heroId!==next.selectedHero) return { ok: false, message: '该任务不属于当前英雄。' };
    if (next.progression.claimedQuests.includes(id)) return { ok: false, message: '任务奖励已经领取。' };
    if (quest.mainProgression ? !getJobState(next,quest.jobId).readyToClaim : (next.progression.dungeonWins[quest.dungeonId] || 0) < quest.target) return { ok: false, message: '任务尚未完成。' };
    next.progression.claimedQuests.push(id); next.gold += quest.rewards.gold; next.materials += quest.rewards.materials;
    const heroId=quest.heroId||HERO_JOBS[quest.jobId]?.heroId;
    if(quest.mainProgression&&heroId){const hero=next.heroes[heroId];if(!hero.unlockedJobs.includes(quest.jobId))hero.unlockedJobs.push(quest.jobId);}
    return {ok:true,message:quest.mainProgression?`已解锁${HERO_JOBS[quest.jobId].name}，可选择出战。`:'挑战或任务奖励已领取。'};
  });
}

export function getBuildingCost(profile, id) { const b = BUILDINGS.find(x => x.id === id), level = profile?.buildings?.[id]; return b && integer(level) && level < b.maxLevel ? b.baseCost * (level + 1) : null; }
export function getBuildingGoldCost(profile, id) {
  const materials = getBuildingCost(profile, id);
  return materials === null ? null : materials * 8;
}
// Alternative full payments let surplus gold fund shared growth without mixing currencies.
export function upgradeBuilding(profile, id, payment = 'materials') {
  return commit(profile, next => {
    if (payment !== 'materials' && payment !== 'gold') return { ok: false, message: '未知强化付款方式。' };
    const b = BUILDINGS.find(x => x.id === id), cost = payment === 'gold' ? getBuildingGoldCost(next, id) : getBuildingCost(next, id);
    if (!b) return { ok: false, message: '未知建筑。' };
    if (cost === null) return { ok: false, message: `${b.name}已达到最高等级。` };
    if (next[payment] < cost) return { ok: false, message: `升级需要 ${cost} ${payment === 'gold' ? '金币' : '份材料'}。` };
    next[payment] -= cost; next.buildings[id]++;
    return { ok: true, message: `${b.name}升至 ${next.buildings[id]} 级。` };
  });
}

export function getDungeonLockReason(profile, dungeon) {
  const item = typeof dungeon === 'string' ? DUNGEONS.find(x => x.id === dungeon) : dungeon;
  if (!item || !validProfile(profile)) return '档案或副本无效。';
  const trialJob=Object.values(HERO_JOBS).find(job=>job.trialId===item.id);
  if (trialJob && profile.selectedHero !== trialJob.heroId) return trialJob.heroId==='commander'?'这是剑士挑战，请先选择风刃指挥官。':`这是${getHero(trialJob.heroId).name}的英雄挑战。`;
  if (item.requires && !profile.cleared.includes(item.requires)) return '需要先通关苔痕关。';
  if (trialJob && profile.heroes[trialJob.heroId].level < 3) return '英雄挑战需要该英雄达到 3 级。';
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
  return { dungeon: clone(dungeon), companions: [], heroId:hero.id, heroKind: getHeroKind(hero.id,progress.job), heroName: hero.name, heroJob: progress.job, heroSkills: getActiveCampaignSkills(profile), heroBonus: { hp: hall * 12 + (level - 1) * 10, damage: hall * .07 + (level - 1) * .05 } };
}

// The release gate detects removal/renaming of identifiers referenced by saves.
export function getSaveContentIds() {
  return {heroes:[...HERO_IDS],jobs:[...JOB_IDS],skills:[...SKILL_IDS],units:[...UNIT_IDS],buildings:[...BUILDING_IDS],cleared:[...CLEARED_IDS],quests:QUESTS.map(q=>q.id)};
}
