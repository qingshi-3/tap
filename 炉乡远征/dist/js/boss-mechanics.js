// Campaign boss rules. A boss is bespoke code keyed by id (Hearthstone-adventure style):
// telegraphed intents, rule passives and HP phases. All boss state lives in state.boss
// so saves stay one JSON value; randomness only through the match's seeded stream.
export const ICE_SHARD_ID = 9001;
export const BOSS_CARDS = Object.freeze({
  [ICE_SHARD_ID]: { id: ICE_SHARD_ID, name: '冰棱', type: 'unit', faction: 6, cost: 0, attack: 0, health: 3, speed: 0, wall: true, token: true, spriteFrom: 525,
    description: '冰墙：不能移动。被摧毁时碎裂，对相邻所有单位造成2点伤害。' },
});

const living = state => state.units.filter(unit => unit.health > 0);
const near = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
const key = cell => `${cell.x},${cell.y}`;

function announce(state, text) {
  state.boss.announce = { serial: (state.boss.announce?.serial ?? 0) + 1, text };
}

// ---- 霜墙女王 ----
// 霜甲：女王身边有≥2面冰棱时，每次受到的伤害至多为1。
// 冰封：女王回合结束时标记你的主将（及阶段二起一名攻击最高的随从）所在格；
//       她的下回合开始时，标记格上的单位受到3点伤害并被冻结，空格则长出冰棱。
// 碎冰：冰棱被摧毁时对相邻所有单位造成2点伤害，无视霜甲。
// 凛冬（生命≤一半，一次）：冻结所有贴着冰棱的敌方单位，并在女王身边补满冰棱。
const FROST_QUEEN = {
  name: '霜墙女王',
  rooted: true,
  rules: [
    { id: 'throne', title: '王座', text: '女王坐镇王座，不会移动。' },
    { id: 'armor', title: '霜甲', text: '身边有3面冰棱时，每次受到的伤害至多为1。' },
    { id: 'mark', title: '冰封', text: '回合结束时标记你的主将所在格；下回合开始，留在格上的单位受到3点伤害并冻结，空格长出冰棱。' },
    { id: 'shatter', title: '碎冰', text: '冰棱被摧毁时对相邻所有单位造成2点伤害，无视霜甲。' },
    { id: 'winter', title: '凛冬', text: '生命降到一半时，冻结所有贴着冰棱的敌人，并在身边补满冰棱。' },
  ],
  phases: [{ hpBelow: 0.5, enter: 'winter' }],
  shards(state) { return living(state).filter(unit => unit.cardId === ICE_SHARD_ID); },
  armored(state, api) {
    const queen = api.general(state.boss.owner);
    return !!queen && this.shards(state).filter(shard => near(shard, queen)).length >= 3;
  },
  damage(state, unit, amount, context, api) {
    if (unit !== api.general(state.boss.owner) || context.shatter || context.destroy || amount <= 1) return amount;
    return this.armored(state, api) ? 1 : amount;
  },
  turnEnd(state, api) {
    const foes = living(state).filter(unit => unit.owner !== state.boss.owner);
    const general = foes.find(unit => api.rule(unit)?.type === 'general');
    const marks = general ? [{ x: general.x, y: general.y }] : [];
    if (state.boss.phase >= 1) {
      const minion = foes.filter(unit => api.rule(unit)?.type === 'unit' && unit.cardId !== ICE_SHARD_ID)
        .sort((a, b) => api.attack(b) - api.attack(a) || a.unitId - b.unitId)[0];
      if (minion) marks.push({ x: minion.x, y: minion.y });
    }
    state.boss.marks = marks;
    if (marks.length) announce(state, '霜墙女王标记了冰封位置');
  },
  turnStart(state, api) {
    const marks = state.boss.marks;
    state.boss.marks = [];
    for (const cell of marks) {
      if (state.phase === 'over') return;
      const unit = living(state).find(entry => entry.x === cell.x && entry.y === cell.y);
      if (!unit) { api.summon(ICE_SHARD_ID, state.boss.owner, cell.x, cell.y, { token: true }); continue; }
      if (unit.owner === state.boss.owner) continue;
      api.damage(unit, 3, { sourceOwner: state.boss.owner, boss: true });
      if (state.units.includes(unit)) freeze(unit);
    }
  },
  death(state, unit, api) {
    if (unit.cardId !== ICE_SHARD_ID) return;
    for (const victim of living(state).filter(other => other !== unit && near(other, unit))) {
      if (state.phase === 'over') return;
      api.damage(victim, 2, { sourceOwner: state.boss.owner, shatter: true });
    }
  },
  winter(state, api) {
    const queen = api.general(state.boss.owner);
    if (queen) for (const cell of api.free(queen).slice(0, 3)) api.summon(ICE_SHARD_ID, state.boss.owner, cell.x, cell.y, { token: true });
    const shards = this.shards(state);
    for (const foe of living(state).filter(unit => unit.owner !== state.boss.owner && shards.some(shard => near(shard, unit)))) freeze(foe);
    announce(state, '凛冬降临：冰棱重新环绕女王');
  },
};

function freeze(unit) { unit.stunTurns = Math.max(1, unit.stunTurns ?? 0); unit.moved = true; unit.attacked = true; }

export const BOSSES = Object.freeze({ 'frost-queen': FROST_QUEEN });
export const bossDefinition = id => (Object.hasOwn(BOSSES, id) ? BOSSES[id] : null);
export const bossRules = state => (state?.boss ? bossDefinition(state.boss.id)?.rules ?? [] : []);
// Rooted bosses hold their ground; the fight is about reaching them, not chasing them.
export const bossRooted = (state, unit) => !!state?.boss && !!bossDefinition(state.boss.id)?.rooted && unit.owner === state.boss.owner && unit.cardId === state.players[state.boss.owner].generalId;
export const bossMarks = state => state?.boss?.marks ?? [];
export const bossArmored = (state, api) => !!state?.boss && !!bossDefinition(state.boss.id)?.armored?.(state, api);

export function validBossConfig(config) {
  return config === undefined || !!config && typeof config === 'object' && Object.keys(config).join() === 'id' && !!bossDefinition(config.id);
}
export function initBoss(config, owner = 1) {
  return config ? { id: config.id, owner, phase: 0, marks: [], announce: null } : undefined;
}
export function validateBossState(state) {
  const boss = state.boss;
  if (boss === undefined) return true;
  const board = state.board, int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  if (!boss || typeof boss !== 'object' || Object.keys(boss).sort().join() !== 'announce,id,marks,owner,phase') return false;
  const def = bossDefinition(boss.id);
  if (!def || !int(boss.owner, 1, state.players.length - 1) || !int(boss.phase, 0, def.phases.length)) return false;
  if (!Array.isArray(boss.marks) || boss.marks.length > 8 || boss.marks.some(c => !int(c?.x, 0, board.columns - 1) || !int(c?.y, 0, board.rows - 1) || Object.keys(c).length !== 2)) return false;
  if (new Set(boss.marks.map(key)).size !== boss.marks.length) return false;
  return boss.announce === null || !!boss.announce && int(boss.announce.serial, 1, Number.MAX_SAFE_INTEGER) && typeof boss.announce.text === 'string';
}

// Engine hooks. Each is a no-op without state.boss.
export function bossTurnStart(state, playerId, api) {
  const def = state.boss && bossDefinition(state.boss.id);
  if (def && playerId === state.boss.owner) def.turnStart?.(state, api);
}
export function bossTurnEnd(state, playerId, api) {
  const def = state.boss && bossDefinition(state.boss.id);
  if (def && playerId === state.boss.owner && state.phase !== 'over') def.turnEnd?.(state, api);
}
export function bossDamage(state, unit, amount, context, api) {
  const def = state.boss && bossDefinition(state.boss.id);
  return def?.damage ? def.damage(state, unit, amount, context, api) : amount;
}
// After damage settles: enter each HP phase once, in order.
export function bossAfterDamage(state, unit, api) {
  const def = state.boss && bossDefinition(state.boss.id), boss = state.boss;
  if (!def || state.phase === 'over' || unit !== api.general(boss.owner) || unit.health <= 0) return;
  while (boss.phase < def.phases.length && unit.health <= Math.floor((unit.maxHealth + unit.healthBuff) * def.phases[boss.phase].hpBelow)) {
    const phase = def.phases[boss.phase++];
    def[phase.enter]?.(state, api);
  }
}
export function bossDeath(state, unit, api) {
  const def = state.boss && bossDefinition(state.boss.id);
  if (def && state.phase !== 'over') def.death?.(state, unit, api);
}
