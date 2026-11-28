// 公会经营逻辑：纯函数式地修改 state，无 DOM。
import {
  ARCHETYPES, BOSSES, ENEMIES, ENEMY_TIERS, FACILITIES, LEGENDS, NAMES, QUEST_KINDS, RACES, RANKS,
  REGIONS, RIVAL_GUILDS, ROLES, SEASON_DAYS, SKILLS, TRAITS, WEEK_DAYS, raceRelation,
} from './data.js';
import {makeRng} from './rng.js';
import {createBattle, runHeadless} from './battle.js';

export const MAX_TEAM = 4;
export const DISPATCH_ENERGY = 30;
export const BOND_LEVEL = 60;

function rngOf(state) {
  const r = makeRng(state.seed);
  return Object.assign(r, {save: () => { state.seed = r.state(); }});
}

function uid(state, prefix) {
  state.nextId = (state.nextId || 1) + 1;
  return prefix + state.nextId;
}

export function rankIndex(state) {
  return RANKS.findIndex(r => r.id === state.rank);
}

export function dormCap(state) {
  return [0, 5, 8, 12][state.facilities.dorm];
}

export function xpNeed(level) {
  return 60 + level * 40;
}

// ---------- 成员 ----------
export function baseStats(level) {
  return {hp: 150 + 17 * level, atk: 17 + 2.7 * level, def: 9 + 1.5 * level};
}

export function memberStats(m) {
  const b0 = baseStats(m.level);
  const role = ROLES[m.role];
  const base = (m.legend ? 1.3 : 1) * (1 + 0.08 * (m.gear || 0)) * (m.awakened ? 1.2 : 1);
  const warlike = m.trait === 'warlike' ? 1.1 : 1;
  return {
    maxHp: Math.round(b0.hp * role.hp * base),
    atk: Math.round(b0.atk * role.atk * base * warlike),
    def: Math.round(b0.def * role.def * base),
  };
}

export function memberPower(m) {
  const s = memberStats(m);
  return Math.round(s.maxHp / 6 + s.atk * 2.2 + s.def * 1.2);
}

const WISHES = [
  {kind: 'quests', n: 6, text: '完成 6 次委托'},
  {kind: 'boss', n: 1, text: '亲手击败一名首领'},
  {kind: 'wins', n: 4, text: '连同伙伴赢下 4 场战斗'},
  {kind: 'savings', n: 260, text: '个人积蓄达到 260 金'},
  {kind: 'bond', n: 1, text: '结下一段搭档之缘'},
  {kind: 'diverse', n: 3, text: '与 3 个不同种族的同伴并肩作战'},
];

function makeMember(state, rng, tpl, level, legend = false) {
  const name = legend ? tpl.name : rng.pick(NAMES[tpl.race]);
  const wish = {...rng.pick(WISHES), progress: 0, seen: []};
  const m = {
    id: uid(state, 'm'), name, title: tpl.title, race: tpl.race, role: tpl.role, unit: tpl.unit,
    skill: tpl.skill, fx: tpl.fx, proj: tpl.proj || null, legend: legend ? tpl.id : null, bio: tpl.bio || null,
    level, xp: 0, gear: 0, loyalty: legend ? 70 : rng.int(48, 62), energy: 100,
    trait: rng.pick(Object.keys(TRAITS)), wish, awakened: false, savings: 0,
    record: {quests: 0, wins: 0, bossKills: 0}, joinedDay: state.day, awayUntil: 0, injuredUntil: 0,
    affinity: {}, questId: null,
  };
  return m;
}

function joinGuild(state, rng, m) {
  for (const o of state.members) {
    const base = raceRelation(m.race, o.race) + rng.int(-6, 6);
    m.affinity[o.id] = base;
    o.affinity[m.id] = base;
  }
  state.members.push(m);
}

export function memberStatus(state, m) {
  if (m.awayUntil > state.day) return 'away';
  if (m.injuredUntil > state.day) return 'injured';
  if (m.questId) return 'assigned';
  if (m.energy < DISPATCH_ENERGY) return 'tired';
  return 'ready';
}

export const STATUS_TEXT = {away: '出征中', injured: '负伤', assigned: '待出发', tired: '疲惫', ready: '可出征'};

export function bondsOf(state, m) {
  return state.members.filter(o => o.id !== m.id && (m.affinity[o.id] || 0) >= BOND_LEVEL);
}

export function diversity(state) {
  return new Set(state.members.map(m => m.race)).size;
}

// ---------- 新局 ----------
export function newGame(seed = Date.now() % 1e9, guildName = '黎明之焰') {
  const state = {
    version: 1, seed, nextId: 1, guildName, day: 1, gold: 260, fame: 0, mats: 3, rank: 'F', taxRate: 0.4,
    facilities: {hall: 1, dorm: 1, training: 0, cellar: 0, forge: 0, altar: 0},
    members: [], visitors: [], quests: [], log: [], events: [],
    rivals: RIVAL_GUILDS.map((g, i) => ({...g, fame: 30 + i * 25})),
    summoned: [], season: 1, seasonWins: 0, history: [], stats: {quests: 0, wins: 0, bossKills: 0, peakMembers: 3},
    tutorial: 0,
  };
  const rng = rngOf(state);
  for (const id of ['k_guard', 'e_assassin', 'd_cleric']) {
    joinGuild(state, rng, makeMember(state, rng, ARCHETYPES.find(a => a.id === id), 2));
  }
  state.members[0].trait = 'loyal';
  rng.save();
  refreshVisitors(state);
  refreshBoard(state);
  addLog(state, `「${guildName}」在破旧的酒馆里挂出了公会旗帜。`);
  return state;
}

export function addLog(state, text, tone = '') {
  state.log.unshift({day: state.day, text, tone});
  state.log.length = Math.min(state.log.length, 80);
}

// ---------- 招募 ----------
export function hireCost(level) {
  return 50 + level * 28;
}

export function refreshVisitors(state) {
  const rng = rngOf(state);
  state.visitors = state.visitors.filter(v => v.leaveDay > state.day);
  const want = state.facilities.hall + 1;
  const r = rankIndex(state);
  const d = diversity(state);
  while (state.visitors.length < want) {
    // 包容度越高，越容易遇到来自更多种族的来访者
    const pool = ARCHETYPES.filter(a => d >= 4 || rng.chance(0.75) || !state.members.some(m => m.race === a.race));
    const tpl = rng.pick(pool.length ? pool : ARCHETYPES);
    const level = Math.max(1, r * 3 + rng.int(1, 3));
    const m = makeMember(state, rng, tpl, level);
    m.leaveDay = state.day + rng.int(1, 2);
    m.fee = hireCost(level);
    state.visitors.push(m);
  }
  rng.save();
}

export function recruit(state, visitorId) {
  const v = state.visitors.find(x => x.id === visitorId);
  if (!v) return '来访者已经离开';
  if (state.members.length >= dormCap(state)) return '宿舍已满，请先扩建宿舍';
  const reluctant = hostileWith(state, v);
  const fee = v.fee + (reluctant ? Math.round(v.fee * 0.5) : 0);
  if (state.gold < fee) return '金币不足';
  state.gold -= fee;
  state.visitors = state.visitors.filter(x => x !== v);
  delete v.fee; delete v.leaveDay;
  const rng = rngOf(state);
  joinGuild(state, rng, v);
  rng.save();
  state.stats.peakMembers = Math.max(state.stats.peakMembers, state.members.length);
  addLog(state, `${RACES[v.race].name}的${v.name}加入了公会。`, 'good');
  return null;
}

export function hostileWith(state, v) {
  return state.members.find(m => raceRelation(m.race, v.race) <= -25) || null;
}

export function recruitFee(state, v) {
  return v.fee + (hostileWith(state, v) ? Math.round(v.fee * 0.5) : 0);
}

export function dismiss(state, memberId) {
  const m = state.members.find(x => x.id === memberId);
  if (!m || memberStatus(state, m) === 'away') return '出征中的成员无法除名';
  unassignMember(state, m);
  state.members = state.members.filter(x => x !== m);
  for (const o of state.members) {
    if ((o.affinity[m.id] || 0) > 30) o.loyalty = Math.max(0, o.loyalty - 6);
    delete o.affinity[m.id];
  }
  addLog(state, `${m.name}离开了公会。`, 'bad');
  return null;
}

// ---------- 设施 ----------
export function buildCost(state, id) {
  const f = FACILITIES[id];
  const lvl = state.facilities[id];
  if (lvl >= f.max) return null;
  // 已有设施的第 lvl+1 级需要公会达到对应等级；祭坛额外高一级
  const rank = lvl + (id === 'altar' ? 1 : 0);
  return {gold: f.cost[lvl], mats: f.mats[lvl], rank};
}

export function build(state, id) {
  const c = buildCost(state, id);
  if (!c) return '已达最高等级';
  if (rankIndex(state) < c.rank) return `需要公会达到 ${RANKS[c.rank].id} 级`;
  if (state.gold < c.gold || state.mats < c.mats) return '金币或素材不足';
  state.gold -= c.gold;
  state.mats -= c.mats;
  state.facilities[id]++;
  addLog(state, `${FACILITIES[id].name}${state.facilities[id] === 1 ? '落成' : '升至 ' + state.facilities[id] + ' 级'}。`, 'good');
  if (id === 'hall') refreshVisitors(state);
  return null;
}

export function forgeCost(m) {
  return {gold: 40 * (m.gear + 1), mats: 3 + m.gear * 3};
}

export function forge(state, memberId) {
  const m = state.members.find(x => x.id === memberId);
  if (!m) return '找不到成员';
  if (!state.facilities.forge) return '需要先建造锻造坊';
  if (m.gear >= state.facilities.forge * 2) return '已达锻造坊上限';
  const c = forgeCost(m);
  if (state.gold < c.gold || state.mats < c.mats) return '金币或素材不足';
  state.gold -= c.gold;
  state.mats -= c.mats;
  m.gear++;
  m.loyalty = Math.min(100, m.loyalty + 3);
  addLog(state, `${m.name}的装备强化至 +${m.gear}。`);
  return null;
}

export function summonCost(legend) {
  return {gold: 380 * legend.altar, mats: 8 * legend.altar};
}

export function summon(state, legendId) {
  const l = LEGENDS.find(x => x.id === legendId);
  if (!l) return '未知英灵';
  if (state.summoned.includes(legendId)) return '这位英灵已经在公会中';
  if (state.facilities.altar < l.altar) return `需要 ${l.altar} 级英灵祭坛`;
  if (state.members.length >= dormCap(state)) return '宿舍已满';
  const c = summonCost(l);
  if (state.gold < c.gold || state.mats < c.mats) return '金币或素材不足';
  state.gold -= c.gold;
  state.mats -= c.mats;
  const rng = rngOf(state);
  const m = makeMember(state, rng, l, Math.max(3, rankIndex(state) * 3 + 3), true);
  joinGuild(state, rng, m);
  rng.save();
  state.summoned.push(legendId);
  state.stats.peakMembers = Math.max(state.stats.peakMembers, state.members.length);
  addLog(state, `英灵「${l.title}·${l.name}」回应了召唤！`, 'legend');
  return null;
}

// ---------- 委托 ----------
function enemySpec(key, level, idx) {
  const e = ENEMIES[key];
  const role = ROLES[e.role];
  const k = 0.85;
  const b0 = baseStats(level);
  return {
    id: key + idx, name: e.name, unit: e.unit, role: e.role, fx: e.fx, proj: e.proj || null, skill: e.skill || null,
    maxHp: Math.round(b0.hp * role.hp * k), atk: Math.round(b0.atk * role.atk * k), def: Math.round(b0.def * role.def * k),
  };
}

function bossSpec(boss, level) {
  const b0 = baseStats(level);
  return {
    id: boss.id, name: boss.name, unit: boss.unit, role: 'fighter', fx: boss.fx, boss: true, skill: null,
    maxHp: Math.round(b0.hp * 5.5), atk: Math.round(b0.atk * 1.5), def: Math.round(b0.def * 1.3),
  };
}

export function questEnemies(q) {
  return q.enemies.map((e, i) => (e.boss ? bossSpec(BOSSES.find(b => b.id === e.boss), e.level) : e.rival ? rivalSpec(e, i) : enemySpec(e.key, e.level, i)));
}

function rivalSpec(e, i) {
  const tpl = ARCHETYPES.find(a => a.id === e.arch);
  const role = ROLES[tpl.role];
  const b0 = baseStats(e.level);
  return {
    id: 'rv' + i, name: e.name, unit: tpl.unit, role: tpl.role, fx: tpl.fx, proj: tpl.proj || null, skill: tpl.skill,
    maxHp: Math.round(b0.hp * role.hp * 1.05), atk: Math.round(b0.atk * role.atk * 1.05), def: Math.round(b0.def * role.def * 1.05),
  };
}

function tierLevel(tier) {
  return 1 + tier * 3;
}

function questReward(tier, boss) {
  const m = boss ? 2.2 : 1;
  return {gold: Math.round(55 * Math.pow(1.55, tier) * m), fame: Math.round(6 * Math.pow(1.6, tier) * m), mats: Math.round((1 + tier) * (boss ? 3 : 1))};
}

function makeQuest(state, rng, tier, opts = {}) {
  const region = rng.pick(Object.keys(REGIONS));
  const kind = rng.pick(QUEST_KINDS);
  const level = tierLevel(tier) + rng.int(0, 2);
  const count = opts.boss ? rng.int(1, 2) : rng.int(2, 4);
  const pool = ENEMY_TIERS[Math.min(tier, ENEMY_TIERS.length - 1)];
  const enemies = [];
  let boss = null;
  if (opts.boss) {
    const cands = BOSSES.filter(b => b.tier <= tier + 1 && b.tier >= tier - 1);
    boss = rng.pick(cands.length ? cands : BOSSES);
    enemies.push({boss: boss.id, level: level + 1});
  }
  for (let i = 0; i < count; i++) enemies.push({key: rng.pick(pool), level: level - (opts.boss ? 1 : 0)});
  const lead = boss ? boss.name : ENEMIES[enemies[0].key].name;
  const title = opts.title || (boss ? `${REGIONS[region].name}·首领「${boss.name}」` : `${REGIONS[region].name}·${kind.name}${lead}`);
  return {
    id: uid(state, 'q'), tier, region, title, kind: kind.id, boss: !!boss, special: opts.special || null,
    desc: opts.desc || (boss ? `${REGIONS[region].name}的${boss.name}正在蹂躏村庄，首领会蓄力释放大招，督战时可下令打断。` : `${kind.verb}${REGIONS[region].name}一带的${lead}。`),
    enemies, days: opts.days || (tier > rankIndex(state) ? 2 : 1), expires: state.day + (opts.expires || rng.int(2, 4)),
    reward: opts.reward || questReward(tier, !!boss), team: [], watch: !!boss || !!opts.special,
  };
}

export function refreshBoard(state) {
  const rng = rngOf(state);
  state.quests = state.quests.filter(q => q.expires > state.day || q.team.length);
  const r = rankIndex(state);
  const want = 3 + Math.floor(r / 2) + (state.facilities.hall >= 3 ? 1 : 0);
  let normal = state.quests.filter(q => !q.special).length;
  while (normal < want) {
    const tier = Math.max(0, Math.min(6, r + rng.pick([-1, 0, 0, 0, 1])));
    const boss = state.day > 2 && rng.chance(0.18) && !state.quests.some(q => q.boss && !q.special);
    state.quests.push(makeQuest(state, rng, tier, {boss}));
    normal++;
  }
  // 晋级试炼
  const next = RANKS[r + 1];
  if (next && state.fame >= next.fame && !state.quests.some(q => q.special === 'promote')) {
    state.quests.unshift(makeQuest(state, rng, r + 1, {
      boss: true, special: 'promote', expires: 99, days: 1,
      title: `晋级试炼·${next.id} 级`, desc: `评议会指派的试炼。击败首领后，公会将晋升为 ${next.id} 级「${next.name}公会」。`,
    }));
  }
  // 公会大赛：每季第 4 周开放
  const dayInSeason = ((state.day - 1) % SEASON_DAYS) + 1;
  if (dayInSeason >= SEASON_DAYS - 6 && !state.quests.some(q => q.special === 'tournament') && state.lastTournament !== state.season) {
    const rival = state.rivals.slice().sort((a, b) => b.fame - a.fame)[0];
    const level = tierLevel(r) + 2;
    const archs = ARCHETYPES.filter(a => a.race === rival.race);
    const enemies = [0, 1, 2].map(i => ({rival: true, arch: (archs[i % archs.length] || ARCHETYPES[i]).id, level, name: rng.pick(NAMES[rival.race])}));
    state.quests.unshift({
      id: uid(state, 'q'), tier: r + 1, region: rival.race, title: `第 ${state.season} 季公会大赛·决赛`, kind: 'tournament', boss: false,
      special: 'tournament', desc: `对手是当季声望第一的「${rival.name}」。最多派出 3 人，胜者独揽全大陆的目光。`,
      enemies, days: 1, expires: state.day + (SEASON_DAYS - dayInSeason) + 1, rival: rival.name,
      reward: {gold: 120 * (r + 2), fame: 50 * (r + 2), mats: 6 + r * 2}, team: [], watch: true, maxTeam: 3,
    });
  }
  rng.save();
}

export function teamLimit(q) {
  return q.maxTeam || MAX_TEAM;
}

function unassignMember(state, m) {
  const q = state.quests.find(x => x.id === m.questId);
  if (q) q.team = q.team.filter(id => id !== m.id);
  m.questId = null;
}

export function toggleAssign(state, questId, memberId) {
  const q = state.quests.find(x => x.id === questId);
  const m = state.members.find(x => x.id === memberId);
  if (!q || !m) return '无效操作';
  if (q.team.includes(m.id)) { unassignMember(state, m); return null; }
  const st = memberStatus(state, m);
  if (st === 'away' || st === 'injured') return `${m.name}${STATUS_TEXT[st]}`;
  if (st === 'tired') return `${m.name}太累了，需要休息`;
  if (q.team.length >= teamLimit(q)) return `最多派出 ${teamLimit(q)} 人`;
  if (m.questId) unassignMember(state, m);
  q.team.push(m.id);
  m.questId = q.id;
  return null;
}

export function partnerPairs(state, ids) {
  const pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = state.members.find(m => m.id === ids[i]);
    if (a && (a.affinity[ids[j]] || 0) >= BOND_LEVEL) pairs.push([ids[i], ids[j]]);
  }
  return pairs;
}

export function frictionPairs(state, ids) {
  const pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = state.members.find(m => m.id === ids[i]);
    if (a && (a.affinity[ids[j]] || 0) <= -30) pairs.push([ids[i], ids[j]]);
  }
  return pairs;
}

export function allySpecs(state, ids) {
  const friction = frictionPairs(state, ids);
  return ids.map(id => state.members.find(m => m.id === id)).filter(Boolean).map(m => {
    const s = memberStats(m);
    const bad = friction.some(p => p.includes(m.id));
    return {
      id: m.id, memberId: m.id, name: m.name, unit: m.unit, role: m.role, skill: m.skill, fx: m.fx, proj: m.proj, race: m.race,
      maxHp: s.maxHp, atk: Math.round(s.atk * (bad ? 0.88 : 1)), def: s.def, legend: !!m.legend,
    };
  });
}

export function battleSetup(state, q, seed, auto) {
  return {allies: allySpecs(state, q.team), enemies: questEnemies(q), seed, pairs: partnerPairs(state, q.team), auto};
}

export function estimateWinRate(state, q, ids = q.team, samples = 10) {
  if (!ids.length) return 0;
  let wins = 0;
  for (let i = 0; i < samples; i++) {
    const b = createBattle({allies: allySpecs(state, ids), enemies: questEnemies(q), seed: 1000 + i * 7919, pairs: partnerPairs(state, ids), auto: true});
    if (runHeadless(b).winner === 'A') wins++;
  }
  return wins / samples;
}

// ---------- 夜间结算 ----------
export function prepareNight(state) {
  const rng = rngOf(state);
  const list = state.quests.filter(q => q.team.length).map(q => ({questId: q.id, seed: rng.int(1, 1e9), watch: q.watch}));
  rng.save();
  return list;
}

function changeAffinity(state, a, b, v) {
  const ma = state.members.find(m => m.id === a);
  const mb = state.members.find(m => m.id === b);
  if (!ma || !mb) return;
  const k = (ma.trait === 'bold' || mb.trait === 'bold' ? 1.5 : 1) * (ma.trait === 'loner' || mb.trait === 'loner' ? 0.5 : 1);
  const before = ma.affinity[b] || 0;
  const after = Math.max(-100, Math.min(100, Math.round(before + v * k)));
  ma.affinity[b] = after;
  mb.affinity[a] = after;
  return before < BOND_LEVEL && after >= BOND_LEVEL ? [ma, mb] : null;
}

function gainXp(state, m, xp, report) {
  m.xp += Math.round(xp * (m.trait === 'lazy' ? 0.85 : 1));
  while (m.xp >= xpNeed(m.level) && m.level < 40) {
    m.xp -= xpNeed(m.level);
    m.level++;
    report.levelUps.push(m.id);
  }
}

function changeLoyalty(m, v) {
  if (v < 0 && m.trait === 'loyal') v *= 0.5;
  if (m.trait === 'greedy') v *= 1.8;
  m.loyalty = Math.max(0, Math.min(100, Math.round(m.loyalty + v)));
}

export function resolveNight(state, results) {
  const rng = rngOf(state);
  const report = {day: state.day, battles: [], levelUps: [], bonds: [], awakened: [], income: 0, upkeep: 0, lines: []};

  for (const {questId, summary} of results) {
    const q = state.quests.find(x => x.id === questId);
    if (!q) continue;
    const won = summary.winner === 'A';
    const team = q.team.map(id => state.members.find(m => m.id === id)).filter(Boolean);
    const entry = {title: q.title, won, special: q.special, reward: null, team: team.map(m => m.name), ids: team.map(m => m.id)};
    if (won) {
      const gross = q.reward.gold;
      const guildGold = Math.round(gross * state.taxRate);
      const share = Math.round((gross - guildGold) / team.length);
      state.gold += guildGold;
      state.fame += q.reward.fame;
      state.mats += q.reward.mats;
      entry.reward = {gold: guildGold, fame: q.reward.fame, mats: q.reward.mats, share};
      state.stats.wins++;
      if (summary.bossKilled) state.stats.bossKills++;
      for (const m of team) {
        m.savings += share;
        changeLoyalty(m, (0.42 - state.taxRate) * 22);
      }
      if (q.special === 'promote') {
        state.rank = RANKS[rankIndex(state) + 1].id;
        addLog(state, `公会晋升为 ${state.rank} 级「${RANKS[rankIndex(state)].name}公会」！`, 'legend');
        report.promoted = state.rank;
      }
      if (q.special === 'tournament') {
        state.seasonWins++;
        const rv = state.rivals.find(r => r.name === q.rival);
        if (rv) rv.fame = Math.round(rv.fame * 0.85);
        report.tournament = 'win';
      }
      if (q.special === 'raid') addLog(state, '黑暗公会的突袭被击退了。', 'good');
    } else {
      state.fame = Math.max(0, state.fame - Math.round(q.reward.fame * 0.3));
      if (q.special === 'raid') {
        const lost = Math.round(state.gold * 0.25);
        state.gold -= lost;
        addLog(state, `黑暗公会洗劫了金库，损失 ${lost} 金。`, 'bad');
      }
      if (q.special === 'tournament') report.tournament = 'lose';
    }
    if (q.special === 'tournament') state.lastTournament = state.season;
    state.stats.quests++;
    for (const m of team) {
      const a = summary.allies.find(x => x.memberId === m.id);
      m.record.quests++;
      if (won) m.record.wins++;
      if (won && summary.bossKilled) m.record.bossKills++;
      m.energy = Math.max(0, m.energy - (m.trait === 'warlike' ? 38 : DISPATCH_ENERGY));
      m.awayUntil = state.day + q.days;
      m.questId = null;
      if (a && !a.alive) m.injuredUntil = state.day + q.days + (won ? 1 : 2);
      gainXp(state, m, won ? 34 + q.tier * 16 : 14, report);
      for (const o of team) if (o.id < m.id) {
        const bond = changeAffinity(state, m.id, o.id, won ? 7 : 3);
        if (bond) report.bonds.push(bond.map(x => x.id));
      }
      if (m.wish.kind === 'diverse') {
        for (const o of team) if (o.race !== m.race && !m.wish.seen.includes(o.race)) m.wish.seen.push(o.race);
        m.wish.progress = m.wish.seen.length;
      }
    }
    entry.questId = q.id;
    report.battles.push(entry);
    state.quests = state.quests.filter(x => x !== q);
    addLog(state, `${q.title}：${won ? '凯旋' : '败退'}（${team.map(m => m.name).join('、')}）`, won ? 'good' : 'bad');
  }

  // 无人迎战的突袭
  for (const q of state.quests.filter(x => x.special === 'raid' && !x.team.length && x.expires <= state.day + 1)) {
    const lost = Math.round(state.gold * 0.25);
    state.gold -= lost;
    state.fame = Math.max(0, state.fame - 10);
    state.quests = state.quests.filter(x => x !== q);
    report.battles.push({title: q.title, won: false, special: 'raid', reward: null, team: [], ids: [], undefended: true});
    addLog(state, `无人迎战，黑暗公会洗劫了金库，损失 ${lost} 金。`, 'bad');
  }

  // 酒馆营业
  const present = state.members.filter(m => m.awayUntil <= state.day);
  const d = diversity(state);
  const income = Math.round((12 + state.facilities.hall * 14 + state.fame * 0.035 + present.length * 2) * (1 + state.facilities.cellar * 0.15) * (1 + Math.max(0, d - 2) * 0.05));
  state.gold += income;
  report.income = income;
  if (d >= 3) state.fame += d - 2;

  // 留守成员：恢复与训练
  for (const m of state.members) {
    if (m.awayUntil > state.day) continue;
    const rested = !report.battles.some(b => b.ids.includes(m.id));
    if (rested) {
      m.energy = Math.min(100, m.energy + 22 + state.facilities.cellar * 10 + (m.trait === 'lazy' ? 10 : 0));
      if (state.facilities.training) gainXp(state, m, [0, 12, 24, 40][state.facilities.training] * (m.trait === 'loner' ? 1.3 : 1), report);
    }
  }

  // 每周开销
  if (state.day % WEEK_DAYS === 0) {
    const upkeep = Object.values(state.facilities).reduce((s, l) => s + l * 12, 0) + state.members.length * 10;
    report.upkeep = upkeep;
    if (state.gold >= upkeep) {
      state.gold -= upkeep;
      addLog(state, `支付本周伙食与维护费 ${upkeep} 金。`);
    } else {
      state.gold = 0;
      state.fame = Math.max(0, state.fame - 15);
      for (const m of state.members) changeLoyalty(m, -12);
      addLog(state, '金库见底，拖欠了伙食费，成员们怨声载道。', 'bad');
    }
  }

  // 心愿与觉醒
  for (const m of state.members) {
    const w = m.wish;
    if (m.awakened) continue;
    if (w.kind === 'quests') w.progress = m.record.quests;
    if (w.kind === 'boss') w.progress = m.record.bossKills;
    if (w.kind === 'wins') w.progress = m.record.wins;
    if (w.kind === 'savings') w.progress = m.savings;
    if (w.kind === 'bond') w.progress = bondsOf(state, m).length;
    if (w.progress >= w.n) {
      m.awakened = true;
      m.loyalty = 100;
      state.fame += 15;
      report.awakened.push(m.id);
      addLog(state, `${m.name}的心愿「${w.text}」达成，觉醒了！`, 'legend');
    }
  }
  for (const [a, b] of report.bonds) {
    const ma = state.members.find(m => m.id === a);
    const mb = state.members.find(m => m.id === b);
    addLog(state, `${ma.name}与${mb.name}成为了搭档，可在督战时释放合体技！`, 'legend');
  }

  // 对手公会成长
  for (const r of state.rivals) r.fame += Math.round(rng.range(2, 6) * (1 + state.day / 35));

  // 进入下一天
  state.day++;
  if ((state.day - 1) % SEASON_DAYS === 0) {
    state.history.push({season: state.season, fame: state.fame, rank: state.rank, won: state.lastTournament === state.season && report.tournament === 'win'});
    state.season++;
    addLog(state, `第 ${state.season} 季开始了。`);
  }
  rng.save();
  rollEvents(state, report);
  refreshVisitors(state);
  refreshBoard(state);
  return report;
}

// ---------- 随机事件 ----------
function rollEvents(state, report) {
  const rng = rngOf(state);
  const present = state.members.filter(m => m.awayUntil <= state.day);
  // 宿怨冲突
  const feuds = [];
  for (let i = 0; i < present.length; i++) for (let j = i + 1; j < present.length; j++) {
    if ((present[i].affinity[present[j].id] || 0) <= -30) feuds.push([present[i], present[j]]);
  }
  if (feuds.length && rng.chance(0.45)) {
    const [a, b] = rng.pick(feuds);
    state.events.push({id: uid(state, 'ev'), kind: 'feud', a: a.id, b: b.id, title: '大厅里打起来了',
      text: `${RACES[a.race].name}的${a.name}和${RACES[b.race].name}的${b.name}为了一张桌子大打出手，酒杯碎了一地。`,
      options: [
        {id: 'mediate', label: '自掏腰包请两人喝和解酒（-30 金）'},
        {id: 'duel', label: '让他们去训练场比试一场'},
        {id: 'punish', label: '各罚扫一周茅厕'},
      ]});
  }
  // 挖角
  const unhappy = state.members.filter(m => m.loyalty < 22 && m.awayUntil <= state.day);
  if (unhappy.length && rng.chance(0.6)) {
    const m = rng.pick(unhappy);
    const rival = rng.pick(state.rivals);
    const cost = 40 + m.level * 22;
    state.events.push({id: uid(state, 'ev'), kind: 'poach', a: m.id, cost, title: '挖角',
      text: `「${rival.name}」的人在酒馆角落和${m.name}窃窃私语，开出了更好的分成。${m.name}看起来动心了。`,
      options: [{id: 'keep', label: `加薪挽留（-${cost} 金）`}, {id: 'promise', label: '承诺下调抽成（抽成 -10%）'}, {id: 'let', label: '随他去吧'}]});
  }
  // 黑暗公会突袭
  if (state.day > 9 && rng.chance(0.07) && !state.quests.some(q => q.special === 'raid')) {
    const r = rankIndex(state);
    const level = tierLevel(r) + 1;
    state.quests.unshift({
      id: uid(state, 'q'), tier: r, region: 'undead', title: '防卫战·黑暗公会来袭', kind: 'raid', boss: false, special: 'raid',
      desc: '黑暗公会「冥火」今晚要洗劫我们的金库！若不迎战，将损失四分之一金币。', days: 0, expires: state.day + 1,
      enemies: [{key: 'darkKnight', level}, {key: 'darkMage', level}, {key: 'darkKnight', level: level - 1}],
      reward: {gold: 80 + r * 40, fame: 20 + r * 10, mats: 3 + r}, team: [], watch: true,
    });
    addLog(state, '探子回报：黑暗公会今晚要来袭击公会！', 'bad');
  }
  // 小事件
  const roll = rng();
  if (present.length >= 2 && roll < 0.25) {
    const host = rng.pick(present.filter(m => m.trait === 'bold').length ? present.filter(m => m.trait === 'bold') : present);
    for (const o of present) if (o !== host) changeAffinity(state, host.id, o.id, 4);
    addLog(state, `${host.name}请全场喝了一轮，大厅里笑声不断。`, 'good');
  } else if (roll < 0.38) {
    state.events.push({id: uid(state, 'ev'), kind: 'merchant', title: '流浪商人', text: '一位戴兜帽的商人推着满车魔物素材路过。',
      options: [{id: 'buy', label: '买下 5 份素材（-70 金）'}, {id: 'pass', label: '不需要'}]});
  } else if (roll < 0.46 && state.fame > 40) {
    const gain = 10 + rankIndex(state) * 6;
    state.fame += gain;
    addLog(state, `吟游诗人在王都传唱公会的事迹，声望 +${gain}。`, 'good');
  }
  if (state.tutorial < 1 && state.day === 2) state.tutorial = 1;
  rng.save();
}

export function resolveEvent(state, eventId, optionId) {
  const ev = state.events.find(e => e.id === eventId);
  if (!ev) return null;
  const rng = rngOf(state);
  const a = state.members.find(m => m.id === ev.a);
  const b = state.members.find(m => m.id === ev.b);
  let text = '';
  if (ev.kind === 'feud' && a && b) {
    if (optionId === 'mediate') {
      if (state.gold < 30) return '金币不足';
      state.gold -= 30;
      changeAffinity(state, a.id, b.id, 18);
      text = `两人碰了杯，嘴上还在较劲，但气氛缓和了不少。`;
    } else if (optionId === 'duel') {
      const win = memberPower(a) * rng.range(0.7, 1.3) > memberPower(b) * rng.range(0.7, 1.3) ? a : b;
      const lose = win === a ? b : a;
      changeLoyalty(win, 6); changeLoyalty(lose, -6);
      lose.energy = Math.max(0, lose.energy - 25);
      changeAffinity(state, a.id, b.id, 10);
      gainXp(state, a, 20, {levelUps: []}); gainXp(state, b, 20, {levelUps: []});
      text = `${win.name}赢了。打完后两人竟然勾肩搭背去喝酒了。`;
    } else {
      changeLoyalty(a, -6); changeLoyalty(b, -6);
      changeAffinity(state, a.id, b.id, 6);
      text = '两人一边刷茅厕一边互相埋怨，总算没再动手。';
    }
  } else if (ev.kind === 'poach' && a) {
    if (optionId === 'keep') {
      if (state.gold < ev.cost) return '金币不足';
      state.gold -= ev.cost;
      a.savings += ev.cost;
      changeLoyalty(a, 35);
      text = `${a.name}收下了加薪，决定留下。`;
    } else if (optionId === 'promise') {
      state.taxRate = Math.max(0.1, Math.round((state.taxRate - 0.1) * 100) / 100);
      for (const m of state.members) changeLoyalty(m, 8);
      text = `你当众宣布下调抽成到 ${Math.round(state.taxRate * 100)}%，大家一片欢呼。`;
    } else {
      dismiss(state, a.id);
      text = `${a.name}收拾行囊投奔了对手公会。`;
    }
  } else if (ev.kind === 'merchant') {
    if (optionId === 'buy') {
      if (state.gold < 70) return '金币不足';
      state.gold -= 70;
      state.mats += 5;
      text = '素材入库。';
    } else text = '商人耸耸肩走了。';
  }
  rng.save();
  state.events = state.events.filter(e => e !== ev);
  if (text) addLog(state, text);
  return {text};
}

export function setTax(state, rate) {
  state.taxRate = Math.max(0.1, Math.min(0.7, Math.round(rate * 100) / 100));
}

export function guildRanking(state) {
  return [...state.rivals.map(r => ({name: r.name, fame: r.fame, race: r.race})), {name: state.guildName, fame: state.fame, me: true}]
    .sort((a, b) => b.fame - a.fame);
}

export function skillOf(m) {
  return SKILLS[m.skill];
}
