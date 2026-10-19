import { getSelectedHero, HERO_JOBS, SKILL_DEFINITIONS } from './heroes.js';

const STORAGE_KEY = 'pixel-survivor.campaign.v1';
const BACKUP_KEY = 'pixel-survivor.campaign.v1.pre-solo';
const JOB_BACKUP_KEY = 'pixel-survivor.campaign.v1.pre-job';
const GROWTH_BACKUP_KEY = 'pixel-survivor.campaign.v1.pre-progression';
const JOB_IDS = Object.keys(HERO_JOBS);
const SKILL_IDS = Object.keys(SKILL_DEFINITIONS);
const BASE_SKILLS = ['dash', 'cleave', 'guard'];
const TRIAL_IDS = ['blade-trial', 'swift-trial'];

export const UNITS = Object.freeze([
  { id: 'stone-guard', name: '磐石卫', kind: 'guard_basic', role: 'guard', tier: 1, attack: 10, hp: 72 },
  { id: 'wind-scout', name: '逐风斥候', kind: 'scout_basic', role: 'ranger', tier: 1, attack: 15, hp: 42 },
  { id: 'herb-mender', name: '青芽医士', kind: 'healer_basic', role: 'healer', tier: 1, attack: 8, hp: 50 },
  { id: 'ember-archer', name: '烬羽弓手', kind: 'archer_elite', role: 'ranger', tier: 2, attack: 23, hp: 52 },
  { id: 'iron-vanguard', name: '铁壁先锋', kind: 'guard_elite', role: 'guard', tier: 2, attack: 17, hp: 110 },
  { id: 'moon-priest', name: '月泉祭司', kind: 'healer_elite', role: 'healer', tier: 3, attack: 20, hp: 82 },
].map(unit => Object.freeze({ ...unit, description: '旧战团成员，现于营地休整。' })));

export const DUNGEONS = Object.freeze([
  { id: 'moss-gate', name: '苔痕关', region: '青原', description: '突破荒废关隘的围攻。', x: 22, y: 65, duration: 360, difficulty: 1, enemies: ['grunt', 'runner', 'scout_basic', 'guard_basic', 'brute', 'archer_elite'], boss: { name: '关隘监军', kind: 'brute', hp: 18000, damage: 20, spawnAt: 300 }, rewards: { gold: 420, materials: 48, xp: 120 }, unitDrops: [], requires: null },
  { id: 'ember-trail', name: '烬火古道', region: '赤岭', description: '沿燃烧古道追击溃军。', x: 45, y: 48, duration: 420, difficulty: 2, enemies: ['runner', 'brute', 'archer_elite', 'guard_basic'], boss: { name: '烬甲统领', kind: 'brute', hp: 26000, damage: 28, spawnAt: 350 }, rewards: { gold: 620, materials: 72, xp: 180 }, spawnScale: 1.15, unitDrops: [], requires: 'moss-gate' },
  { id: 'blade-trial', name: '剑阵试炼', region: '试炼场', description: '在剑影围攻中证明对剑阵的掌控。', x: 66, y: 38, duration: 120, difficulty: 2, enemies: ['guard_basic', 'archer_elite', 'brute'], boss: { name: '剑阵教官', kind: 'guard_elite', hp: 14500, damage: 24, spawnAt: 100 }, rewards: { gold: 180, materials: 24, xp: 90 }, spawnScale: .9, unitDrops: [], requires: 'moss-gate' },
  { id: 'swift-trial', name: '迅刃试炼', region: '试炼场', description: '在高速追猎中证明迅刃的身法。', x: 72, y: 58, duration: 120, difficulty: 2, enemies: ['runner', 'scout_basic', 'archer_elite'], boss: { name: '逐风教官', kind: 'scout_basic', hp: 13200, damage: 26, spawnAt: 100 }, rewards: { gold: 180, materials: 24, xp: 90 }, spawnScale: 1.25, unitDrops: [], requires: 'moss-gate' },
].map(item => Object.freeze(item)));

export const BUILDINGS = Object.freeze([
  { id: 'hall', name: '远征厅', description: '每级为英雄增加 12 点生命与 7% 伤害。', maxLevel: 5, baseCost: 35 },
  { id: 'barracks', name: '训练场', description: '每级使英雄训练所需金币减少 10。', maxLevel: 5, baseCost: 30 },
  { id: 'workshop', name: '工坊', description: '每级使远征材料收益提高 8%。', maxLevel: 5, baseCost: 40 },
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
  if (!object(profile) || profile.version !== 1 || !integer(profile.gold) || !integer(profile.materials) || !object(profile.roster)) return false;
  for (const [id, entry] of Object.entries(profile.roster)) if (!UNIT_IDS.has(id) || !exactKeys(entry, ['level', 'copies']) || !integer(entry.level, 1) || entry.level > 30 || !integer(entry.copies)) return false;
  if (!uniqueStrings(profile.squad) || profile.squad.length > 3 || profile.squad.some(id => !Object.hasOwn(profile.roster, id))) return false;
  if (!exactKeys(profile.buildings, BUILDING_IDS) || BUILDINGS.some(b => !integer(profile.buildings[b.id]) || profile.buildings[b.id] > b.maxLevel)) return false;
  if (!uniqueStrings(profile.cleared) || profile.cleared.some(id => !CLEARED_IDS.has(id)) || !uniqueStrings(profile.settledRuns) || profile.settledRuns.some(id => id.length > 160)) return false;
  return profile.lastReward === null || object(profile.lastReward);
}

function validOldProfile(profile) {
  const keys = ['version', 'gold', 'materials', 'roster', 'squad', 'buildings', 'cleared', 'settledRuns', 'lastReward'];
  const legacyCleared = new Set(['moss-gate', 'ember-trail', 'iron-quarry', 'moon-ruins']);
  if (!object(profile) || !keys.every(k => Object.hasOwn(profile, k)) || !validBase(profile) || profile.cleared.some(id => !legacyCleared.has(id))) return false;
  if (!Object.hasOwn(profile, 'heroes')) return Object.keys(profile).length === keys.length;
  if (Object.keys(profile).length !== keys.length + 1 || !exactKeys(profile.heroes, ['commander'])) return false;
  const h = profile.heroes.commander;
  if (!object(h) || !integer(h.level, 1) || h.level > 30) return false;
  return exactKeys(h, ['level'])
    || (exactKeys(h, ['level', 'job']) && (h.job === 'fighter' || h.job === 'blade_master'));
}

function validProfile(profile) {
  if (!validBase(profile) || !exactKeys(profile, ['version', 'gold', 'materials', 'roster', 'squad', 'buildings', 'cleared', 'settledRuns', 'lastReward', 'heroes', 'progression'])) return false;
  if (!exactKeys(profile.heroes, ['commander'])) return false;
  const h = profile.heroes.commander;
  if (!exactKeys(h, ['level', 'experience', 'job', 'unlockedJobs', 'skillLoadout']) || !integer(h.level, 1) || h.level > 30 || !integer(h.experience) || h.experience >= h.level * 100 || (h.level === 30 && h.experience !== 0) || !JOB_IDS.includes(h.job)) return false;
  if (!uniqueStrings(h.unlockedJobs, JOB_IDS) || !h.unlockedJobs.includes('fighter') || !h.unlockedJobs.includes(h.job)) return false;
  if (!Array.isArray(h.skillLoadout) || h.skillLoadout.length !== 3 || new Set(h.skillLoadout).size !== 3 || h.skillLoadout.some(id => !SKILL_IDS.includes(id) || !SKILL_DEFINITIONS[id].jobs.includes(h.job) || SKILL_DEFINITIONS[id].level > h.level)) return false;
  const p = profile.progression;
  return exactKeys(p, ['claimedQuests', 'dungeonWins', 'kills']) && uniqueStrings(p.claimedQuests) && p.claimedQuests.every(id => QUESTS.some(quest => quest.id === id)) && object(p.dungeonWins)
    && Object.keys(p.dungeonWins).every(id => DUNGEON_IDS.has(id) && integer(p.dungeonWins[id])) && integer(p.kills);
}

function makeProfile(base = null) {
  const source = base ? clone(base) : { version: 1, gold: 300, materials: 30, roster: { 'stone-guard': { level: 1, copies: 0 }, 'wind-scout': { level: 1, copies: 0 } }, squad: ['stone-guard', 'wind-scout'], buildings: { hall: 0, barracks: 0, workshop: 0 }, cleared: [], settledRuns: [], lastReward: null };
  const oldHero = source.heroes?.commander;
  const job = JOB_IDS.includes(oldHero?.job) ? oldHero.job : 'fighter';
  source.cleared = source.cleared.filter(id => CLEARED_IDS.has(id));
  const level = integer(oldHero?.level, 1) ? Math.min(30, oldHero.level) : 1;
  const skillLoadout = job === 'blade_master' && level >= 3 ? ['dash', 'cleave', 'swordField'] : BASE_SKILLS.slice();
  source.heroes = { commander: { level, experience: 0, job, unlockedJobs: job === 'fighter' ? ['fighter'] : ['fighter', job], skillLoadout } };
  source.progression = { claimedQuests: [], dungeonWins: Object.fromEntries(source.cleared.filter(id => DUNGEON_IDS.has(id)).map(id => [id, 1])), kills: 0 };
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

export function saveProfile(profile) {
  if (!validProfile(profile)) return { ok: false, error: '档案格式无效，未写入存档。' };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); return { ok: true, error: null }; }
  catch (error) { return { ok: false, error: `无法保存档案：${error instanceof Error ? error.message : '存储不可用'}` }; }
}

export function loadProfile() {
  let raw;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (error) { return { profile: null, error: `无法读取档案：${error instanceof Error ? error.message : '存储不可用'}` }; }
  if (raw === null) { const profile = makeProfile(); const saved = saveProfile(profile); return saved.ok ? { profile, error: null } : { profile: null, error: saved.error }; }
  try {
    const parsed = JSON.parse(raw);
    if (validProfile(parsed)) return { profile: parsed, error: null };
    if (!validOldProfile(parsed)) return { profile: null, error: '存档版本或内容无法识别，原存档已保留。' };
    const migrated = makeProfile(parsed);
    try {
      backupRaw(Object.hasOwn(parsed, 'heroes') ? GROWTH_BACKUP_KEY : BACKUP_KEY, raw);
      if (parsed.heroes?.commander && !Object.hasOwn(parsed.heroes.commander, 'job')) backupRaw(JOB_BACKUP_KEY, raw);
    } catch (error) { return { profile: null, error: `无法备份旧档案：${error instanceof Error ? error.message : '存储不可用'}。原存档未修改。` }; }
    const saved = saveProfile(migrated);
    return saved.ok ? { profile: migrated, error: null } : { profile: null, error: `${saved.error} 原存档已备份且未覆盖。` };
  } catch { return { profile: null, error: '存档已损坏，原存档已保留。' }; }
}

function commit(profile, mutate) {
  if (!validProfile(profile)) return { ok: false, message: '当前档案无效，操作已取消。' };
  const next = clone(profile), result = mutate(next);
  if (!result.ok) return result;
  const saved = saveProfile(next);
  if (!saved.ok) return { ok: false, message: saved.error };
  for (const key of Object.keys(profile)) delete profile[key];
  Object.assign(profile, next);
  return result;
}

export function getRecruitCost() { return 100; }
export function recruit() { return { ok: false, message: '独行远征不再招募随行伙伴。' }; }
export function toggleSquad() { return { ok: false, message: '独行远征不使用同伴编队。' }; }
export function getHeroTrainingCost(profile) {
  const level = profile?.heroes?.commander?.level;
  if (!integer(level, 1) || level >= 30) return null;
  const barracks = integer(profile?.buildings?.barracks) ? profile.buildings.barracks : 0;
  return { gold: Math.max(30, 80 + level * 30 - barracks * 10), materials: 10 + level * 5 };
}
export function getTrainingCost(profile, id) { return id === 'commander' ? getHeroTrainingCost(profile) : null; }
export function trainHero(profile) {
  return commit(profile, next => {
    const cost = getHeroTrainingCost(next), hero = next.heroes.commander;
    if (!cost) return { ok: false, message: '风刃指挥官已达到最高等级。' };
    if (next.gold < cost.gold || next.materials < cost.materials) return { ok: false, message: `训练需要 ${cost.gold} 金币与 ${cost.materials} 份材料。` };
    next.gold -= cost.gold; next.materials -= cost.materials; hero.level++;
    if (hero.level === 30) hero.experience = 0;
    return { ok: true, message: `风刃指挥官升至 ${hero.level} 级。` };
  });
}
export function trainUnit(profile, id) { return id === 'commander' ? trainHero(profile) : { ok: false, message: '旧战团成员不再参与远征训练。' }; }

function unlockedSkill(profile, skill) {
  const hero = profile.heroes.commander;
  return skill.level <= hero.level && skill.jobs.includes(hero.job);
}
export function getAvailableSkills(profile) {
  if (!validProfile(profile)) return [];
  return Object.values(SKILL_DEFINITIONS).map(skill => ({ ...skill, jobs: [...skill.jobs], unlocked: unlockedSkill(profile, skill) }));
}
export function getSkillLoadout(profile) { return validProfile(profile) ? [...profile.heroes.commander.skillLoadout] : BASE_SKILLS.slice(); }
export function equipSkill(profile, slotIndex, skillId) {
  return commit(profile, next => {
    if (!integer(slotIndex) || slotIndex > 2 || !SKILL_DEFINITIONS[skillId]) return { ok: false, message: '技能槽或技能无效。' };
    if (!unlockedSkill(next, SKILL_DEFINITIONS[skillId])) return { ok: false, message: '该技能尚未解锁。' };
    const other = next.heroes.commander.skillLoadout.indexOf(skillId);
    if (other >= 0 && other !== slotIndex) [next.heroes.commander.skillLoadout[other], next.heroes.commander.skillLoadout[slotIndex]] = [next.heroes.commander.skillLoadout[slotIndex], skillId];
    else next.heroes.commander.skillLoadout[slotIndex] = skillId;
    return { ok: true, message: `${SKILL_DEFINITIONS[skillId].name}已装备。` };
  });
}

const JOB_META = {
  fighter: { description: '攻守均衡的基础职业。', requirement: '初始解锁', trialId: null },
  blade_master: { description: '驾驭剑阵与剑潮。', requirement: '英雄达到 3 级、通关苔痕关并完成剑阵试炼', trialId: 'blade-trial' },
  swift_blade: { description: '以高速位移和旋斩突围。', requirement: '英雄达到 3 级、通关苔痕关并完成迅刃试炼', trialId: 'swift-trial' },
};
export function getJobState(profile, id) {
  if (!JOB_META[id]) return null;
  return { unlocked: validProfile(profile) && profile.heroes.commander.unlockedJobs.includes(id), ...JOB_META[id] };
}
export function switchJob(profile, id) {
  return commit(profile, next => {
    if (!JOB_META[id]) return { ok: false, message: '未知职业。' };
    if (!next.heroes.commander.unlockedJobs.includes(id)) return { ok: false, message: '该职业尚未解锁。' };
    next.heroes.commander.job = id;
    const available = Object.values(SKILL_DEFINITIONS).filter(skill => unlockedSkill(next, skill)).map(skill => skill.id);
    const kept = next.heroes.commander.skillLoadout.filter(skillId => available.includes(skillId));
    next.heroes.commander.skillLoadout = [...new Set([...kept, ...available])].slice(0, 3);
    return { ok: true, message: `已切换为${HERO_JOBS[id].name}。` };
  });
}
export function promoteHero(profile) { return switchJob(profile, 'blade_master'); }

const QUESTS = [
  { id: 'main-moss', name: '突破苔痕关', description: '完成第一场远征。', target: 1, dungeonId: 'moss-gate', rewards: { gold: 200, materials: 20 } },
  { id: 'main-ember', name: '清剿烬火古道', description: '继续深入赤岭。', target: 1, dungeonId: 'ember-trail', rewards: { gold: 300, materials: 35 } },
  { id: 'job-blade', name: '剑阵传承', description: '完成剑阵试炼，解锁剑阵宗师。', target: 1, dungeonId: 'blade-trial', jobId: 'blade_master', rewards: { gold: 100, materials: 15 } },
  { id: 'job-swift', name: '迅刃传承', description: '完成迅刃试炼，解锁迅刃。', target: 1, dungeonId: 'swift-trial', jobId: 'swift_blade', rewards: { gold: 100, materials: 15 } },
];
export function getQuestStates(profile) {
  if (!validProfile(profile)) return [];
  return QUESTS.map(q => { const progress = Math.min(q.target, profile.progression.dungeonWins[q.dungeonId] || 0); return { id: q.id, name: q.name, description: q.description, progress, target: q.target, ready: progress >= q.target && !profile.progression.claimedQuests.includes(q.id), claimed: profile.progression.claimedQuests.includes(q.id), dungeonId: q.dungeonId, rewards: clone(q.rewards) }; });
}
export function claimQuest(profile, id) {
  return commit(profile, next => {
    const quest = QUESTS.find(q => q.id === id);
    if (!quest) return { ok: false, message: '未知任务。' };
    if (next.progression.claimedQuests.includes(id)) return { ok: false, message: '任务奖励已经领取。' };
    if ((next.progression.dungeonWins[quest.dungeonId] || 0) < quest.target) return { ok: false, message: '任务尚未完成。' };
    next.progression.claimedQuests.push(id); next.gold += quest.rewards.gold; next.materials += quest.rewards.materials;
    if (quest.jobId && !next.heroes.commander.unlockedJobs.includes(quest.jobId)) next.heroes.commander.unlockedJobs.push(quest.jobId);
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
  if (item.requires && !profile.cleared.includes(item.requires)) return '需要先通关苔痕关。';
  if (TRIAL_IDS.includes(item.id) && profile.heroes.commander.level < 3) return '职业试炼需要英雄达到 3 级。';
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
    if (!dungeon || getDungeonLockReason(next, dungeon) || typeof run.victory !== 'boolean' || !Number.isFinite(run.kills) || run.kills < 0 || !Number.isFinite(run.time) || run.time < 0) return { ok: false, message: '远征记录不完整或副本尚未解锁。' };
    const progress = run.victory ? 1 : Math.min(.65, Math.min(1, run.time / dungeon.duration) * .5 + Math.min(1, run.kills / 650) * .15);
    const gold = Math.max(run.victory ? 1 : 0, Math.floor(dungeon.rewards.gold * progress));
    const materials = Math.max(run.victory ? 1 : 0, Math.floor(dungeon.rewards.materials * progress * (1 + next.buildings.workshop * .08)));
    const xp = Math.floor(dungeon.rewards.xp * progress);
    const firstClear = run.victory && !next.cleared.includes(dungeon.id);
    if (firstClear) next.cleared.push(dungeon.id);
    if (run.victory) next.progression.dungeonWins[dungeon.id] = (next.progression.dungeonWins[dungeon.id] || 0) + 1;
    next.progression.kills += Math.floor(run.kills); next.gold += gold; next.materials += materials; grantExperience(next.heroes.commander, xp); next.settledRuns.push(run.id);
    const reward = { gold, materials, xp, unitId: null, firstClear, victory: run.victory };
    next.lastReward = { ...reward, runId: run.id };
    return { ok: true, message: `${run.victory ? '远征胜利' : '远征结束'}，获得 ${gold} 金币、${materials} 份材料与 ${xp} 经验。`, reward };
  });
}

export function getExpedition(profile, dungeonId) {
  const dungeon = DUNGEONS.find(x => x.id === dungeonId);
  if (!validProfile(profile) || !dungeon || !isUnlocked(profile, dungeon)) return null;
  const hero = getSelectedHero(), level = profile.heroes.commander.level, hall = profile.buildings.hall;
  return { dungeon: clone(dungeon), companions: [], heroKind: hero.kind, heroName: hero.name, heroJob: profile.heroes.commander.job, heroSkills: getSkillLoadout(profile), heroBonus: { hp: hall * 12 + (level - 1) * 10, damage: hall * .07 + (level - 1) * .05 } };
}
