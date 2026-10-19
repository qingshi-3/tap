import { getSelectedHero } from './heroes.js';

const STORAGE_KEY = 'pixel-survivor.campaign.v1';
const BACKUP_KEY = 'pixel-survivor.campaign.v1.pre-solo';
const LEGACY_DUNGEON_IDS = new Set(['moss-gate', 'ember-trail', 'iron-quarry', 'moon-ruins']);

export const UNITS = Object.freeze([
  { id: 'stone-guard', name: '磐石卫', kind: 'guard_basic', role: 'guard', tier: 1, attack: 10, hp: 72 },
  { id: 'wind-scout', name: '逐风斥候', kind: 'scout_basic', role: 'ranger', tier: 1, attack: 15, hp: 42 },
  { id: 'herb-mender', name: '青芽医士', kind: 'healer_basic', role: 'healer', tier: 1, attack: 8, hp: 50 },
  { id: 'ember-archer', name: '烬羽弓手', kind: 'archer_elite', role: 'ranger', tier: 2, attack: 23, hp: 52 },
  { id: 'iron-vanguard', name: '铁壁先锋', kind: 'guard_elite', role: 'guard', tier: 2, attack: 17, hp: 110 },
  { id: 'moon-priest', name: '月泉祭司', kind: 'healer_elite', role: 'healer', tier: 3, attack: 20, hp: 82 },
].map(unit => Object.freeze({ ...unit, description: '旧战团成员，现于营地休整。' })));

export const DUNGEONS = Object.freeze([{
  id: 'moss-gate', name: '苔痕关', region: '青原',
  description: '荒废关隘盘踞着游荡兵卒。突破围攻，击败关隘监军。',
  x: 22, y: 65, duration: 90, difficulty: 1,
  enemies: ['grunt', 'runner'],
  boss: { name: '关隘监军', kind: 'brute', hp: 2200, damage: 18 },
  rewards: { gold: 120, materials: 12 }, unitDrops: [], requires: null,
}]);

export const BUILDINGS = Object.freeze([
  { id: 'hall', name: '远征厅', description: '每级为英雄增加 12 点生命与 7% 伤害。', maxLevel: 5, baseCost: 35 },
  { id: 'barracks', name: '训练场', description: '每级使英雄训练所需金币减少 10。', maxLevel: 5, baseCost: 30 },
  { id: 'workshop', name: '工坊', description: '每级使远征材料收益提高 8%。', maxLevel: 5, baseCost: 40 },
]);

const UNIT_IDS = new Set(UNITS.map(unit => unit.id));
const BUILDING_IDS = BUILDINGS.map(building => building.id);
const integer = (value, min = 0) => Number.isInteger(value) && value >= min;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value)
  && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));
const clone = value => JSON.parse(JSON.stringify(value));

function validLegacyProfile(profile) {
  const keys = ['version', 'gold', 'materials', 'roster', 'squad', 'buildings', 'cleared', 'settledRuns', 'lastReward'];
  if (!exactKeys(profile, keys) || profile.version !== 1 || !integer(profile.gold) || !integer(profile.materials)) return false;
  if (!object(profile.roster)) return false;
  for (const [id, entry] of Object.entries(profile.roster)) {
    if (!UNIT_IDS.has(id) || !exactKeys(entry, ['level', 'copies']) || !integer(entry.level, 1) || entry.level > 30 || !integer(entry.copies)) return false;
  }
  if (!Array.isArray(profile.squad) || profile.squad.length > 3 || new Set(profile.squad).size !== profile.squad.length) return false;
  if (profile.squad.some(id => !Object.hasOwn(profile.roster, id))) return false;
  if (!exactKeys(profile.buildings, BUILDING_IDS)) return false;
  for (const building of BUILDINGS) {
    if (!integer(profile.buildings[building.id]) || profile.buildings[building.id] > building.maxLevel) return false;
  }
  if (!Array.isArray(profile.cleared) || new Set(profile.cleared).size !== profile.cleared.length) return false;
  if (profile.cleared.some(id => !LEGACY_DUNGEON_IDS.has(id))) return false;
  if (!Array.isArray(profile.settledRuns) || new Set(profile.settledRuns).size !== profile.settledRuns.length) return false;
  if (profile.settledRuns.some(id => typeof id !== 'string' || !id || id.length > 160)) return false;
  return profile.lastReward === null || object(profile.lastReward);
}

function validProfile(profile) {
  if (!exactKeys(profile, ['version', 'gold', 'materials', 'roster', 'squad', 'buildings', 'cleared', 'settledRuns', 'lastReward', 'heroes'])) return false;
  const legacyShape = clone(profile);
  delete legacyShape.heroes;
  return validLegacyProfile(legacyShape)
    && exactKeys(profile.heroes, ['commander'])
    && exactKeys(profile.heroes.commander, ['level'])
    && integer(profile.heroes.commander.level, 1)
    && profile.heroes.commander.level <= 30;
}

function initialProfile() {
  return {
    version: 1, gold: 300, materials: 30,
    roster: { 'stone-guard': { level: 1, copies: 0 }, 'wind-scout': { level: 1, copies: 0 } },
    squad: ['stone-guard', 'wind-scout'],
    buildings: { hall: 0, barracks: 0, workshop: 0 },
    cleared: [], settledRuns: [], lastReward: null,
    heroes: { commander: { level: 1 } },
  };
}

export function saveProfile(profile) {
  if (!validProfile(profile)) return { ok: false, error: '档案格式无效，未写入存档。' };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: `无法保存档案：${error instanceof Error ? error.message : '存储不可用'}` };
  }
}

export function loadProfile() {
  let raw;
  try { raw = localStorage.getItem(STORAGE_KEY); }
  catch (error) { return { profile: null, error: `无法读取档案：${error instanceof Error ? error.message : '存储不可用'}` }; }
  if (raw === null) {
    const profile = initialProfile();
    const saved = saveProfile(profile);
    return saved.ok ? { profile, error: null } : { profile: null, error: saved.error };
  }
  try {
    const parsed = JSON.parse(raw);
    if (validProfile(parsed)) return { profile: parsed, error: null };
    if (!validLegacyProfile(parsed)) return { profile: null, error: '存档版本或内容无法识别，原存档已保留。' };
    const migrated = { ...clone(parsed), heroes: { commander: { level: 1 } } };
    try {
      if (localStorage.getItem(BACKUP_KEY) === null) localStorage.setItem(BACKUP_KEY, raw);
    } catch (error) {
      return { profile: null, error: `无法备份旧档案：${error instanceof Error ? error.message : '存储不可用'}。原存档未修改。` };
    }
    const saved = saveProfile(migrated);
    return saved.ok ? { profile: migrated, error: null } : { profile: null, error: `${saved.error} 原存档已备份。` };
  } catch {
    return { profile: null, error: '存档已损坏，原存档已保留。' };
  }
}

function commit(profile, mutate) {
  if (!validProfile(profile)) return { ok: false, message: '当前档案无效，操作已取消。' };
  const next = clone(profile);
  const result = mutate(next);
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

export function getTrainingCost(profile, id) {
  return id === 'commander' ? getHeroTrainingCost(profile) : null;
}

export function trainHero(profile) {
  return commit(profile, next => {
    const hero = next.heroes.commander;
    const cost = getHeroTrainingCost(next);
    if (!cost) return { ok: false, message: '风刃指挥官已达到最高等级。' };
    if (next.gold < cost.gold || next.materials < cost.materials) return { ok: false, message: `训练需要 ${cost.gold} 金币与 ${cost.materials} 份材料。` };
    next.gold -= cost.gold;
    next.materials -= cost.materials;
    hero.level++;
    return { ok: true, message: `风刃指挥官升至 ${hero.level} 级，生命与伤害同步提升。` };
  });
}

export function trainUnit(profile, id) {
  return id === 'commander' ? trainHero(profile) : { ok: false, message: '旧战团成员不再参与远征训练。' };
}

export function getBuildingCost(profile, id) {
  const building = BUILDINGS.find(item => item.id === id);
  const level = profile?.buildings?.[id];
  return building && integer(level) && level < building.maxLevel ? building.baseCost * (level + 1) : null;
}

export function upgradeBuilding(profile, id) {
  return commit(profile, next => {
    const building = BUILDINGS.find(item => item.id === id);
    const cost = getBuildingCost(next, id);
    if (!building) return { ok: false, message: '未知建筑。' };
    if (cost === null) return { ok: false, message: `${building.name}已达到最高等级。` };
    if (next.materials < cost) return { ok: false, message: `升级需要 ${cost} 份材料。` };
    next.materials -= cost;
    next.buildings[id]++;
    return { ok: true, message: `${building.name}升至 ${next.buildings[id]} 级。` };
  });
}

export function isUnlocked(profile, dungeon) {
  const id = typeof dungeon === 'string' ? dungeon : dungeon?.id;
  return validProfile(profile) && id === 'moss-gate';
}

export function settleRun(profile, run) {
  if (!run || typeof run.id !== 'string' || !run.id || run.id.length > 160) return { ok: false, message: '远征记录缺少有效编号。' };
  if (validProfile(profile) && profile.settledRuns.includes(run.id)) {
    const reward = profile.lastReward?.runId === run.id
      ? { ...profile.lastReward, unitId: null }
      : { gold: 0, materials: 0, unitId: null, firstClear: false, victory: Boolean(run.victory) };
    return { ok: true, message: '这次远征已经结算，没有重复发放奖励。', reward };
  }
  return commit(profile, next => {
    const dungeon = DUNGEONS[0];
    if (run.dungeonId !== dungeon.id || typeof run.victory !== 'boolean' || !Number.isFinite(run.kills) || run.kills < 0 || !Number.isFinite(run.time) || run.time < 0) return { ok: false, message: '远征记录不完整。' };
    const progress = run.victory ? 1 : Math.min(.65, Math.max(run.time / dungeon.duration, run.kills / 75) * .65);
    const gold = Math.max(run.victory ? 1 : 0, Math.floor(dungeon.rewards.gold * progress));
    const materials = Math.max(run.victory ? 1 : 0, Math.floor(dungeon.rewards.materials * progress * (1 + next.buildings.workshop * .08)));
    const firstClear = run.victory && !next.cleared.includes(dungeon.id);
    if (firstClear) next.cleared.push(dungeon.id);
    const reward = { gold, materials, unitId: null, firstClear, victory: run.victory };
    next.gold += gold;
    next.materials += materials;
    next.settledRuns.push(run.id);
    next.lastReward = { ...reward, runId: run.id };
    return { ok: true, message: `${run.victory ? '远征胜利' : '远征结束'}，获得 ${gold} 金币与 ${materials} 份材料。`, reward };
  });
}

export function getExpedition(profile, dungeonId) {
  if (!validProfile(profile) || dungeonId !== 'moss-gate') return null;
  const hero = getSelectedHero();
  const level = profile.heroes.commander.level;
  const hall = profile.buildings.hall;
  return {
    dungeon: clone(DUNGEONS[0]), companions: [], heroKind: hero.kind, heroName: hero.name,
    heroBonus: { hp: hall * 12 + (level - 1) * 10, damage: hall * .07 + (level - 1) * .05 },
  };
}
