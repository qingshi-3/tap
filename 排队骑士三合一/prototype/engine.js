// 排队战斗引擎原型：实现《排队战斗系统核心设计文档》中原型用得到的规则子集。
// 状态是纯数据（可 structuredClone），流程是显式状态机：
//   createBattle → startBattle → [heroAct*] → advance → [heroAct*] → advance … 直到 s.result
// 每次 advance 跑完一整轮（攻击前 → 交锋 → 交锋后），停在英雄操作窗口。
import { CARDS } from './cards.js';

export const CFG = { fatigueStart: 10, depthCap: 10, maxRounds: 30, capacity: 5, energyCap: 6, hpScale: 0.65, energyStart: 1, ultCharge: 4, hero: 'dispatcher', energyPerRound: 2, thaw: 1, freezeMax: 2, huntBonus: 3, huntRounds: 2, sweepRatio: 1, branches: '' };

// ---------- 基础 ----------
const U = (s, uid) => s.units[uid];
export const line = (s, side) => s.lines[side].map((id) => s.units[id]);
export const front = (s, side) => s.units[s.lines[side][0]];
export const idx = (s, u) => s.lines[u.side].indexOf(u.uid);
const foe = (side) => 1 - side;
const alive = (u) => u && !u.dead;
export const lv3 = (u) => u.lvl >= 3;
export const def = (u) => CARDS[u.id];

function rand(s) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}

export function snapshot(s) {
  return {
    lines: s.lines.map((ids) => ids.map((id) => {
      const u = s.units[id];
      return { uid: u.uid, id: u.id, lvl: u.lvl, atk: u.atk, hp: u.hp, maxHp: u.maxHp, block: u.block, shield: u.shield, armor: u.armor, charge: u.charge, size: u.size, combo: u.combo, stun: u.stun, thaw: u.thaw, mark: u.mark, vuln: u.vulnRounds ? u.vuln : 0, scale: u.scale, atkScale: u.atkScale, obstacle: u.obstacle, extra: u.extra.slice() };
    })),
    energy: s.energy, ultMeter: s.ultMeter, ultUsed: s.ultUsed, round: s.round,
  };
}

function log(s, t, data = {}) {
  s.log.push({ t, round: s.round, ...data, snap: snapshot(s) });
}

// ---------- 创建 ----------
export function makeUnit(s, side, spec) {
  const d = CARDS[spec.id];
  if (!d) throw new Error('unknown card ' + spec.id);
  const lvl = spec.lvl || 1;
  const mul = lvl === 1 ? 1 : lvl === 2 ? 1.5 : 2;
  // 遭遇的数值强度（敌人的"数值"维度，见 teams.js ENC_SCALE）：scale 乘血量，atkScale 乘伤害（缺省同 scale）
  const sc = spec.scale || 1, as = spec.atkScale ?? sc;
  const u = {
    uid: s.nextUid++, side, id: d.id, lvl, scale: sc, atkScale: as,
    atk: Math.floor(d.atk * mul * as + 1e-9), hp: Math.max(1, Math.round(d.hp * mul * sc * (d.faction === 'token' ? 1 : CFG.hpScale))), // 召唤物身材很小，不再缩放 maxHp: 0,
    block: 0, armor: d.armor || 0, shield: 0, size: d.size || 1,
    charge: 0, combo: 0, stun: 0, thaw: 0, frozen: 0, mark: 0, vuln: 0, vulnRounds: 0, tmpAtk: 0, uses: {}, dead: false, summoned: false,
    obstacle: !!d.obstacle, token: d.faction === 'token', extra: [],
  };
  u.maxHp = u.hp;
  return u;
}

export function createBattle(left, right, seed = 1, opts = {}) {
  const s = {
    seed: (seed >>> 0) || 1, nextUid: 1, units: {}, lines: [[], []], round: 0,
    phase: 'setup', result: null, log: [],
    energy: CFG.energyStart, ultMeter: 0, ultUsed: false, ultArmed: false, regroup: opts.regroup ?? 2,
    hero: opts.hero ?? CFG.hero, passiveUsed: false, heroActing: false,
    branches: (opts.branches ?? CFG.branches ?? '').split(/[+,]/).filter(Boolean),
    frontUid: [0, 0], atomic: 0, depth: 0, reg: {}, grave: [[], []],
    stats: { heroActions: 0, refills: [0, 0] },
  };
  for (const [side, specs] of [[0, left], [1, right]]) {
    let used = 0;
    for (const sp of specs) {
      const u = makeUnit(s, side, sp);
      if (used + u.size > CFG.capacity) continue;
      used += u.size;
      s.units[u.uid] = u;
      s.lines[side].push(u.uid);
    }
  }
  log(s, 'setup');
  return s;
}

// ---------- 队列（先进先出 + 深度上限） ----------
// 队列只在一次结算调用内部存在，窗口时总是空的，因此状态仍可克隆。
const QUEUE = new WeakMap();
const q = (s) => { if (!QUEUE.has(s)) QUEUE.set(s, []); return QUEUE.get(s); };

function enqueue(s, run, label) {
  const depth = s.depth + 1;
  if (depth > CFG.depthCap) { log(s, 'chaincap', { label }); return; }
  q(s).push({ run, depth, label });
}

function drain(s) {
  const queue = q(s);
  while (queue.length) {
    const it = queue.shift();
    const saved = s.depth;
    s.depth = it.depth;
    s.atomic++;               // 每个衍生攻击 / 施法都是一个新的原子动作（R2）
    it.run();
    resolveDeaths(s);
    s.depth = saved;
  }
  s.depth = 0;
  s.reg = {};
}

// ---------- 事件 ----------
// 同一原子动作内，同一单位对同一事件只登记一次（安全锁 2）。
function emit(s, ev, payload = {}, onlySide = null) {
  const order = [];
  const n = Math.max(s.lines[0].length, s.lines[1].length);
  for (let i = 0; i < n; i++) for (const side of [0, 1]) {
    const id = s.lines[side][i];
    if (id) order.push(s.units[id]);
  }
  for (const u of order) {
    if (!alive(u) || (onlySide !== null && u.side !== onlySide)) continue;
    const hs = [CARDS[u.id].on?.[ev], ...u.extra.map((id) => CARDS[id].on?.[ev])];
    hs.forEach((h, k) => {
      if (!h || !alive(u)) return;
      const key = `${s.atomic}|${u.uid}|${ev}|${payload.unit?.uid ?? ''}|${k}`;
      if (s.reg[key]) return;
      s.reg[key] = 1;
      h(s, u, payload, API);
    });
  }
}

// ---------- 状态修改（直接结算） ----------
function addBlock(s, u, n = 1) { if (!alive(u)) return; u.block += n; log(s, 'block', { uid: u.uid, n }); }
function addShield(s, u, n) { if (!alive(u)) return; u.shield += n; log(s, 'shield', { uid: u.uid, n }); }
function buff(s, u, atk = 0, hp = 0) {
  if (!alive(u)) return;
  u.atk += atk; u.hp += hp; u.maxHp += hp;
  log(s, 'buff', { uid: u.uid, atk, hp });
}
function heal(s, u, n) {
  if (!alive(u) || u.obstacle || u.hp >= u.maxHp) return;
  const v = Math.min(n, u.maxHp - u.hp);
  u.hp += v;
  log(s, 'heal', { uid: u.uid, n: v });
}
function useOnce(u, key, max) {
  const n = u.uses[key] || 0;
  if (n >= max) return false;
  u.uses[key] = n + 1;
  return true;
}

// ---------- 伤害 ----------
function injure(s, tgt, dmg, src, kind, noShare = false) {
  if (!alive(tgt) || dmg <= 0) return 0;
  // 伤害分摊（零件 17）：铁崖守护者
  if (!noShare) {
    const sharer = line(s, tgt.side).find((x) => alive(x) && x !== tgt && CARDS[x.id].share);
    if (sharer) {
      const part = Math.floor(dmg * CARDS[sharer.id].share(sharer));
      if (part > 0) { dmg -= part; injure(s, sharer, part, src, kind, true); }
    }
  }
  let absorbed = 0;
  if (tgt.shield > 0) { absorbed = Math.min(tgt.shield, dmg); tgt.shield -= absorbed; dmg -= absorbed; }
  if (dmg <= 0) { log(s, 'absorb', { uid: tgt.uid, n: absorbed }); return 0; }
  tgt.hp -= dmg;
  log(s, 'damage', { uid: tgt.uid, n: dmg, src: src?.uid, kind, absorbed });
  if (tgt.hp <= 0) tgt.dead = true;
  emit(s, 'damaged', { unit: tgt, amount: dmg, src });
  return dmg;
}

// 一次攻击命中一个目标：受击（碎盾 → 格挡 → 护甲）→ 受伤
function attackHit(s, src, tgt, atkVal, opts = {}) {
  if (!alive(tgt)) return;
  let dmg = atkVal + (tgt.mark && atkVal > 0 ? CFG.huntBonus : 0);
  if (tgt.vulnRounds && dmg > 0) dmg = Math.round(dmg * (1 + tgt.vuln)); // 分支的按比例易伤
  if (opts.shatter && tgt.block > 0) { tgt.block = 0; log(s, 'shatter', { uid: tgt.uid }); }
  let blockUsed = false;
  if (dmg > 0 && tgt.block > 0) { tgt.block--; dmg = 0; blockUsed = true; }
  else dmg = Math.max(0, dmg - tgt.armor);
  log(s, 'hit', { src: src.uid, uid: tgt.uid, raw: atkVal, dmg, blockUsed, kind: opts.label || 'attack' });
  emit(s, 'hit', { unit: tgt, src, blockUsed });
  if (blockUsed) emit(s, 'blockConsumed', { unit: tgt });
  if (dmg > 0) injure(s, tgt, dmg, src, 'attack');
}

// 援护 / 范围嘲讽（零件 11，含 R6：也拦截狙击）
function redirect(s, tgt, kind) {
  if (!alive(tgt)) return tgt;
  const ln = line(s, tgt.side);
  const ti = ln.indexOf(tgt);
  for (const g of ln) {
    if (!alive(g) || g === tgt) continue;
    const t = CARDS[g.id].taunt?.(g);
    if (!t) continue;
    const gi = ln.indexOf(g);
    const covers = t === 'all' || (t === 'adjacent' && Math.abs(gi - ti) === 1) || (t === 'behind' && ti > gi);
    if (covers) {
      log(s, 'redirect', { from: tgt.uid, uid: g.uid, kind });
      emit(s, 'redirected', { unit: g });
      return g;
    }
  }
  return tgt;
}

// 施法：跳过受击，直接受伤
function castDamage(s, src, tgt, n, label = 'cast') {
  enqueue(s, () => {
    // 来源已阵亡时，已触发的施法照常执行（安全锁 2）
    let t = typeof tgt === 'function' ? tgt() : tgt;
    if (!alive(t)) return;
    t = redirect(s, t, 'cast');
    // 霜龙：被冰冻的敌人受到的施法 +1
    const m = t.stun && line(s, src.side).some((x) => alive(x) && CARDS[x.id].frostCast) ? 1 : 0;
    log(s, 'cast', { src: src.uid, uid: t.uid, n: n + m, label });
    injure(s, t, n + m, src, 'cast');
  }, label);
}

// 额外的单向攻击（连击、协同、狙击），没有反撞
function extraAttack(s, src, getTgt, opts = {}) {
  enqueue(s, () => {
    if (!alive(src)) return;
    let t = getTgt();
    if (!alive(t)) return;
    if (opts.snipe) t = redirect(s, t, 'snipe');
    log(s, 'attack', { src: src.uid, uid: t.uid, label: opts.label });
    attackHit(s, src, t, src.atk, opts);
  }, opts.label || 'extra');
}

// ---------- 位置变化 ----------
function moved(s, side, units, why) {
  log(s, 'move', { side, why, uids: units.map((u) => u.uid) });
  for (const u of units) emit(s, 'swapped', { unit: u, why });
  if (side === 0 && why === 'swap') heroPassive(s, 'ownMove');
  refreshFront(s);
}

function swapUnits(s, a, b) {
  if (!alive(a) || !alive(b) || a.side !== b.side || a.size > 1 || b.size > 1 || a.obstacle || b.obstacle) return false;
  const L = s.lines[a.side];
  const i = L.indexOf(a.uid), j = L.indexOf(b.uid);
  if (i < 0 || j < 0) return false;
  L[i] = b.uid; L[j] = a.uid;
  moved(s, a.side, [a, b], 'swap');
  return true;
}

// 重力井：敌方位移效果对己方失效
const anchored = (s, side) => line(s, side).some((x) => alive(x) && CARDS[x.id].anchor);
function knockback(s, side) {
  if (anchored(s, side)) { log(s, 'anchored', { side }); return; }
  const f = front(s, side);
  if (!alive(f) || s.lines[side].length < 2 || f.obstacle) return;
  if (f.size > 1) { f.armor -= 1; log(s, 'stagger', { uid: f.uid }); return; } // 巨型免疫轻度位移，改为破甲 1
  s.lines[side].push(s.lines[side].shift());
  moved(s, side, [f], 'knockback');
}

function pullToFront(s, u) {
  if (!alive(u) || idx(s, u) <= 0 || u.obstacle) return;
  if (anchored(s, u.side)) { log(s, 'anchored', { side: u.side }); return; }
  if (u.size > 1) { u.armor -= 1; log(s, 'stagger', { uid: u.uid }); return; }
  const L = s.lines[u.side];
  L.splice(L.indexOf(u.uid), 1);
  L.unshift(u.uid);
  moved(s, u.side, [u], 'pull');
}

function moveToFront(s, u, why) {
  const L = s.lines[u.side];
  L.splice(L.indexOf(u.uid), 1);
  L.unshift(u.uid);
  moved(s, u.side, [u], why);
}

// 冰冻（卡牌造成）：障碍物免疫；已冰冻或刚解冻的目标不能再冻
function freeze(s, u, src = null) {
  if (!alive(u) || u.obstacle || u.stun || u.thaw) return false;
  u.stun = s.inClash ? 2 : 1; // 交锋中被冻：跳过下一轮（本轮结束时只减 1）
  log(s, 'stun', { uid: u.uid, src: src?.uid });
  return true;
}

// ---------- 召唤 / 吞噬 / 复活 ----------
const used = (s, side) => line(s, side).reduce((n, u) => n + u.size, 0);
// 扩编（零件 27）：容量 = 基础 + 在场扩编光环
export const cap = (s, side) => CFG.capacity + line(s, side).reduce((n, u) => n + (alive(u) && CARDS[u.id].expand ? CARDS[u.id].expand(u) : 0), 0);
export const freeSlots = (s, side) => cap(s, side) - used(s, side);
export const isFull = (s, side) => freeSlots(s, side) <= 0;

// 召唤（零件 26）：默认填入 1 号位，按召唤入场（不触发补位时）；满格失败，广播 summonFail 供溢出转化读取
function summon(s, side, id, lvl = 1, where = 'front', src = null) {
  const u = makeUnit(s, side, { id, lvl });
  if (used(s, side) + u.size > cap(s, side)) {
    log(s, 'summonFail', { side, id, src: src?.uid });
    emit(s, 'summonFail', { side, src });
    return null;
  }
  s.units[u.uid] = u;
  if (where === 'front') { s.lines[side].unshift(u.uid); u.summoned = true; }
  else s.lines[side].push(u.uid);
  log(s, 'summon', { uid: u.uid, src: src?.uid });
  emit(s, 'summoned', { unit: u });
  refreshFront(s);
  return u;
}

// 吞噬（零件 21）：消灭一名友军，正常触发其亡语；吞噬者获得其伤害（可选血量、技能）
function devour(s, eater, victim, opts = {}) {
  if (!alive(eater) || !alive(victim) || victim.obstacle || victim === eater) return false;
  log(s, 'devour', { src: eater.uid, uid: victim.uid });
  const atk = victim.atk, hp = opts.hp ? victim.hp : 0;
  if (opts.steal && CARDS[victim.id].on) eater.extra.push(victim.id);
  victim.dead = true;
  buff(s, eater, atk, hp);
  resolveDeaths(s);
  return true;
}

// 复活（零件 22）：从己方坟场按 pick 选一个，以初始面板召唤入场
function revive(s, side, pick, where = 'back', hp = 0) {
  const g = s.grave[side];
  if (!g.length || freeSlots(s, side) <= 0) return null;
  const e = pick(g);
  if (!e) return null;
  const u = summon(s, side, e.id, e.lvl, where);
  if (!u) return null;
  g.splice(g.indexOf(e), 1);
  if (hp) u.hp = Math.min(u.hp, hp);
  log(s, 'revive', { uid: u.uid });
  return u;
}

// 新队首检测：任何非召唤方式进入 1 号位都触发【补位时】（R3）
function refreshFront(s) {
  for (const side of [0, 1]) {
    const f = front(s, side);
    if (!f) { s.frontUid[side] = 0; continue; }
    if (f.uid === s.frontUid[side]) continue;
    s.frontUid[side] = f.uid;
    if (f.summoned) { f.summoned = false; continue; }
    s.stats.refills[side]++;
    log(s, 'enterFront', { uid: f.uid, side });
    emit(s, 'enterFront', { unit: f });
    emit(s, 'sideRefill', { side, unit: f });
    heroPassive(s, side === 0 ? 'ownMove' : 'enemyRefill');
  }
}

function resolveDeaths(s) {
  for (let guard = 0; guard < 20; guard++) {
    const dead = [];
    const n = Math.max(s.lines[0].length, s.lines[1].length);
    for (let i = 0; i < n; i++) for (const side of [0, 1]) {
      const u = s.units[s.lines[side][i]];
      if (u && u.dead) dead.push(u);
    }
    if (!dead.length) break;
    for (const u of dead) u.deadIdx = s.lines[u.side].indexOf(u.uid);
    for (const u of dead) s.lines[u.side] = s.lines[u.side].filter((id) => id !== u.uid);
    for (const u of dead) {
      log(s, 'death', { uid: u.uid });
      if (!u.token) s.grave[u.side].push({ id: u.id, lvl: u.lvl, tier: CARDS[u.id].tier });
      const rattles = [CARDS[u.id], ...u.extra.map((id) => CARDS[id])].map((d) => d.on?.death).filter(Boolean);
      if (rattles.length) {
        // 触发共鸣（零件 24）：持有者在场存活时亡语触发两次
        const times = line(s, u.side).some((x) => alive(x) && CARDS[x.id].resonance) ? 2 : 1;
        for (let k = 0; k < times; k++) {
          for (const h of rattles) h(s, u, {}, API);
          log(s, 'deathrattle', { uid: u.uid });
          emit(s, 'deathrattle', { unit: u });
          if (u.side === 0) heroPassive(s, 'ownMove');
        }
      }
      emit(s, 'allyDeath', { unit: u });
    }
    refreshFront(s);
  }
}

function checkEnd(s) {
  if (s.result) return true;
  const fighters = (side) => line(s, side).filter((u) => !u.obstacle).length;
  const a = fighters(0), b = fighters(1);
  if (a && b && s.round < CFG.maxRounds) return false;
  s.result = !a && !b ? 'draw' : !b ? 'win' : !a ? 'lose' : 'draw';
  s.phase = 'end';
  log(s, 'end', { result: s.result });
  return true;
}

// ---------- 英雄 ----------
// 能量：开局 CFG.energyStart，每轮交锋后 +CFG.energyPerRound，上限 CFG.energyCap；被动每轮最多 +1。
// 奥义不花能量：独立充能条每轮交锋后 +1，满 CFG.ultCharge 可用，每场 1 次。
const PASSIVE_KIND = { dispatcher: 'ownMove', pusher: 'enemyRefill', chrono: 'chargeFired' };
function heroPassive(s, kind) {
  if (s.passiveUsed || s.round === 0 || s.heroActing || PASSIVE_KIND[s.hero] !== kind) return;
  s.passiveUsed = true;
  gainEnergy(s, 1, 'passive');
}
function gainEnergy(s, n, why) {
  const before = s.energy;
  s.energy = Math.min(CFG.energyCap, s.energy + n);
  if (s.energy !== before) log(s, 'energy', { n: s.energy - before, why });
}

export const HEROES = {
  dispatcher: { name: '调度者', verb: '调度触发', passive: '调度：己方每发生一次补位或亡语，能量 +1（每轮最多 +1）' },
  pusher:     { name: '推阵者', verb: '推拉敌人', passive: '压迫：敌方每发生一次补位，能量 +1（每轮最多 +1）' },
  chrono:     { name: '时序者', verb: '推进 / 延后冷却', passive: '节拍：己方每释放一次蓄力技能，能量 +1（每轮最多 +1）' },
};

// pick：选目标的方式。ally1 / ally2adj / allyBack / enemy1 / enemy2 / none / order
export const HERO_SKILLS = {
  // 调度者
  order:   { hero: 'dispatcher', name: '号令', cost: 2, pick: 'ally1', text: '立即触发一名友军自身的一个触发技能（开战时 / 补位时 / 交锋后 / 亡语 / 战备结束时，按卡面；亡语不会令其阵亡）' },
  rotate:  { hero: 'dispatcher', name: '轮换', cost: 3, pick: 'none', text: '把 1 号位友军送到队尾并恢复 3 点血量，后排补位（触发补位时）' },
  rally:   { hero: 'dispatcher', name: '总动员', cost: 'ult', pick: 'none', text: '奥义（充能满后可用，每场 1 次）：己方全体从队首到队尾，各触发一次自身的触发技能（同号令），并各获得 1 层格挡' },
  redeploy:{ hero: 'dispatcher', name: '再部署', cost: 0, pick: 'none', pre: true, text: '整局技（每局 2 次）：本场己方的【战备结束时】和【开战时】效果各再触发一次' },
  // 推阵者
  hook:    { hero: 'pusher', name: '钩索', cost: 2, pick: 'enemy1', text: '把一名敌方后排单位拉到 1 号位（受援护拦截；巨型改为破甲 1）' },
  shove:   { hero: 'pusher', name: '震退', cost: 3, pick: 'none', text: '把敌方 1 号位击退到队尾（巨型改为破甲 1）' },
  hunt:    { hero: 'pusher', name: '围猎', cost: 'ult', pick: 'enemy1', text: '奥义（充能满后可用，每场 1 次）：把任意一名敌人拉到 1 号位（无视援护和稳固，可拉巨型），它 2 轮内受到的攻击伤害 +3' },
  scout:   { hero: 'pusher', name: '侦察', cost: 0, pick: 'enemy2', pre: true, text: '整局技（每局 2 次）：第一轮之前交换两名敌人的位置' },
  // 时序者
  haste:   { hero: 'chrono', name: '加速', cost: 2, pick: 'ally1', text: '一名友军的蓄力 +2（蓄满立即释放）' },
  delay:   { hero: 'chrono', name: '迟滞', cost: 3, pick: 'enemy1', text: '一名敌人的蓄力 −2；若它没有蓄力技能，改为冰冻一轮（下一轮不能攻击；不能连续两轮冰冻同一目标，每个目标每场最多冰冻 2 次）' },
  timestop:{ hero: 'chrono', name: '时停', cost: 'ult', pick: 'none', text: '奥义（充能满后可用，每场 1 次）：下一轮敌方全体停摆：不攻击，蓄力不增长（不计入冰冻次数）' },
  rehearse:{ hero: 'chrono', name: '预演', cost: 0, pick: 'none', pre: true, text: '整局技（每局 2 次）：开战前己方全部蓄力 +1' },
};

export function heroOptions(s) {
  if (s.result || (s.phase !== 'window' && s.phase !== 'setup')) return [];
  const L = line(s, 0), E = line(s, 1);
  const out = [];
  const can = (k) => s.energy >= HERO_SKILLS[k].cost;
  const ultOk = () => !s.ultUsed && s.ultMeter >= CFG.ultCharge;
  // 整局技（CONTENT-DESIGN 9.4）：侦察、预演在战前（布阵阶段）；重整在开战时之后、第一轮之前（第 0 轮窗口）
  if (s.phase === 'setup' || s.round === 0) {
    if (s.regroup <= 0) return out;
    const pre = s.phase === 'setup';
    if (pre && s.hero === 'dispatcher' && !s.redeploy && L.some((u) => CARDS[u.id].on?.prep || CARDS[u.id].on?.start)) out.push({ type: 'redeploy' });
    if (pre && s.hero === 'pusher') for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++)
      if (E[i].size === 1 && E[j].size === 1) out.push({ type: 'scout', a: E[i].uid, b: E[j].uid });
    if (pre && s.hero === 'chrono' && L.some((u) => CARDS[u.id].charge)) out.push({ type: 'rehearse' });
    return out;
  }
  if (s.hero === 'dispatcher') {
    if (can('order')) for (const u of L) if (triggerOf(u)) out.push({ type: 'order', a: u.uid });
    if (can('rotate') && L.length > 1 && L[0].size === 1 && !L[0].obstacle) out.push({ type: 'rotate' });
    if (ultOk()) out.push({ type: 'rally' });
  }
  if (s.hero === 'pusher') {
    if (can('hook')) for (let i = 1; i < E.length; i++) if (!E[i].obstacle) out.push({ type: 'hook', a: E[i].uid });
    if (can('shove') && E.length > 1 && !E[0].obstacle) out.push({ type: 'shove' });
    if (ultOk()) for (const u of E) out.push({ type: 'hunt', a: u.uid });
  }
  if (s.hero === 'chrono') {
    if (can('haste')) for (const u of L) if (CARDS[u.id].charge || (hasB(s, 'c_hasteEmpower') && u.atk > 0 && !u.obstacle && !u.uses.empower)) out.push({ type: 'haste', a: u.uid });
    if (can('delay')) for (const u of E) if (CARDS[u.id].charge ? u.charge > 0 : !u.obstacle && !u.stun && !u.thaw && u.frozen < CFG.freezeMax) out.push({ type: 'delay', a: u.uid });
    if (ultOk() && E.length) out.push({ type: 'timestop' });
  }
  return out;
}

export function heroAct(s, act) {
  if (s.result || (s.phase !== 'window' && s.phase !== 'setup')) return false;
  const legal = act.type === 'regroup'
    ? s.phase === 'window' && s.round === 0 && s.regroup > 0 && s.hero === 'dispatcher' && Array.isArray(act.order)
    : heroOptions(s).some((o) => o.type === act.type && (o.a ?? 0) === (act.a ?? 0) && (o.b ?? 0) === (act.b ?? 0));
  if (!legal) return false;
  const sk = HERO_SKILLS[act.type];
  s.heroActing = true;
  s.atomic++;
  if (sk.pre) s.regroup--;
  else if (sk.cost !== 'ult') s.energy -= sk.cost;
  if (sk.cost === 'ult') s.ultUsed = true;
  log(s, 'hero', { skill: act.type, a: act.a, b: act.b });
  const A = U(s, act.a), B = U(s, act.b);
  switch (act.type) {
    case 'regroup': {
      const order = act.order.filter((id) => s.lines[0].includes(id));
      if (order.length === s.lines[0].length) s.lines[0] = order;
      s.frontUid[0] = s.lines[0][0]; // 开战前重排不算补位
      log(s, 'move', { side: 0, why: 'regroup', uids: [...s.lines[0]] });
      break;
    }
    case 'order': fireTrigger(s, A); if (hasB(s, 'd_orderRage')) tempAtk(s, A, 0.5); break;
    case 'rotate': {
      const f = front(s, 0);
      s.lines[0].push(s.lines[0].shift());
      if (hasB(s, 'd_rotateHeal')) { heal(s, f, Math.max(3, Math.round(f.maxHp * 0.5))); addBlock(s, f, 1); } else heal(s, f, 3);
      moved(s, 0, [f], 'rotate');
      break;
    }
    case 'rally': for (const u of line(s, 0)) { fireTrigger(s, u); if (!u.obstacle) addBlock(s, u, 1); if (hasB(s, 'd_rallyFury') && u.atk > 0) buff(s, u, pctAtk(u, 0.5), 0); } break;
    case 'redeploy': s.redeploy = true; log(s, 'redeploy'); break;
    case 'scout': {
      const L1 = s.lines[1], i = L1.indexOf(A.uid), j = L1.indexOf(B.uid);
      [L1[i], L1[j]] = [L1[j], L1[i]];
      s.frontUid[1] = L1[0];
      log(s, 'move', { side: 1, why: 'scout', uids: [A.uid, B.uid] });
      break;
    }
    case 'hook': { const t = redirect(s, A, 'pull'); pullToFront(s, t); if (hasB(s, 'p_hookExpose')) expose(s, t, 1, 1); break; }
    case 'shove': knockback(s, 1); if (hasB(s, 'p_shoveFreeze')) freeze(s, front(s, 1)); break;
    case 'hunt':
      if (idx(s, A) > 0) moveToFront(s, A, 'hunt');
      if (hasB(s, 'p_huntBehead')) { expose(s, A, 1, 3); freeze(s, A); }
      else { A.mark = CFG.huntRounds; log(s, 'mark', { uid: A.uid }); }
      break;
    case 'haste': addCharge(s, A, 2); if (hasB(s, 'c_hasteEmpower') && A.atk > 0 && !A.uses.empower) { A.uses.empower = 1; buff(s, A, pctAtk(A, 0.2), 0); } break;
    case 'delay':
      if (hasB(s, 'c_delayAll')) for (const x of line(s, 1)) if (x !== A && CARDS[x.id].charge && x.charge > 0) { x.charge--; log(s, 'delay', { uid: x.uid }); }
      if (CARDS[A.id].charge) { A.charge = Math.max(0, A.charge - 2); log(s, 'delay', { uid: A.uid }); }
      else { A.stun = 1; A.frozen++; log(s, 'stun', { uid: A.uid }); }
      break;
    case 'rehearse': for (const u of line(s, 0)) if (CARDS[u.id].charge) addCharge(s, u, 1); break;
    case 'timestop':
      s.halt = s.round + 1;
      for (const u of line(s, 1)) if (!u.obstacle) u.stun = 1;
      log(s, 'halt');
      if (hasB(s, 'c_stopCounter')) tempAtk(s, front(s, 0), 1);
      break;
  }
  s.stats.heroActions++;
  drain(s);
  resolveDeaths(s);
  s.heroActing = false;
  checkEnd(s);
  return true;
}

// ---------- 英雄分支（CONTENT-DESIGN 9.2）：效果按比例结算，跟得上各幕的数值 ----------
export const BRANCHES = {
  d_orderRage:   { hero: 'dispatcher', skill: 'order',  name: '激昂号令', text: '被号令的友军本轮攻击 +50%' },
  d_rotateHeal:  { hero: 'dispatcher', skill: 'rotate', name: '轮换疗伤', text: '轮换改为回复 50% 最大血量（至少 3 点），并获得 1 层格挡' },
  d_rallyFury:   { hero: 'dispatcher', skill: 'rally',  name: '总动员·怒', text: '总动员时己方全体本场攻击 +50%' },
  p_hookExpose:  { hero: 'pusher', skill: 'hook',  name: '破绽钩索', text: '钩来的敌人本轮受到的攻击伤害 +100%' },
  p_shoveFreeze: { hero: 'pusher', skill: 'shove', name: '冰封震退', text: '震退后敌方新队首冰冻一轮' },
  p_huntBehead:  { hero: 'pusher', skill: 'hunt',  name: '斩首围猎', text: '围猎改为：受到的攻击伤害 +100%，持续 3 轮，并冰冻一轮' },
  c_delayAll:    { hero: 'chrono', skill: 'delay',    name: '群体迟滞', text: '迟滞时敌方全体蓄力额外 −1' },
  c_hasteEmpower:{ hero: 'chrono', skill: 'haste',    name: '激励加速', text: '加速可以选任何友军，目标本场攻击 +20%（每名友军每场 1 次；有蓄力技能的照常蓄力 +2）' },
  c_stopCounter: { hero: 'chrono', skill: 'timestop', name: '反击时停', text: '时停的那一轮，己方队首攻击 +100%' },
};
const hasB = (s, k) => s.branches.includes(k);
const pctAtk = (u, r) => Math.max(1, Math.round(u.atk * r));
function tempAtk(s, u, r) { if (!alive(u) || u.atk <= 0) return; const n = pctAtk(u, r); u.atk += n; u.tmpAtk += n; log(s, 'buff', { uid: u.uid, atk: n, hp: 0 }); }
function expose(s, u, pct, rounds) { if (!alive(u)) return; u.vuln = Math.max(u.vulnRounds ? u.vuln : 0, pct); u.vulnRounds = Math.max(u.vulnRounds, rounds); log(s, 'vuln', { uid: u.uid, pct }); }

// 调度者：单位自身可被"号令"触发的技能（按卡面顺序取第一个）
const TRIG = ['start', 'enterFront', 'afterClash', 'death', 'prep'];
export function triggerOf(u) {
  for (const d of [CARDS[u.id], ...u.extra.map((id) => CARDS[id])]) for (const k of TRIG) if (d.on?.[k]) return { d, k };
  return null;
}
function fireTrigger(s, u) {
  const tg = triggerOf(u);
  if (!tg || !alive(u)) return;
  log(s, 'order', { uid: u.uid, kind: tg.k });
  if (tg.k === 'death') {
    // 亡语不令其阵亡；"后邻"按当前位置的后一格
    u.deadIdx = idx(s, u) + 1;
    const times = line(s, u.side).some((x) => alive(x) && CARDS[x.id].resonance) ? 2 : 1;
    for (let k = 0; k < times; k++) { tg.d.on.death(s, u, {}, API); log(s, 'deathrattle', { uid: u.uid }); emit(s, 'deathrattle', { unit: u }); }
  } else tg.d.on[tg.k](s, u, { unit: u }, API);
}

// 蓄力：增加计数，满了就释放并重置（零件 25）
function addCharge(s, u, n) {
  const d = CARDS[u.id];
  if (!alive(u) || !d.charge) return;
  if (u.side === 1 && n > 0 && s.halt === s.round) return; // 时停：敌方蓄力不增长
  u.charge = Math.max(0, u.charge + n);
  const need = d.charge(u);
  if (u.charge >= need) {
    u.charge = 0;
    d.fire(s, u, API);
    if (u.side === 0) heroPassive(s, 'chargeFired');
  }
}

// ---------- 流程 ----------
export function startBattle(s) {
  s.frontUid = [s.lines[0][0] || 0, s.lines[1][0] || 0];
  s.phase = 'start';
  log(s, 'start');
  s.atomic++;
  emit(s, 'prep', {}); // 战备结束时（吞噬等）
  drain(s);
  resolveDeaths(s);
  if (s.redeploy) { s.atomic++; emit(s, 'prep', {}, 0); drain(s); resolveDeaths(s); } // 再部署
  s.atomic++;
  emit(s, 'start', {});
  if (s.redeploy) { drain(s); resolveDeaths(s); s.atomic++; emit(s, 'start', {}, 0); }
  drain(s);
  resolveDeaths(s);
  if (!checkEnd(s)) s.phase = 'window';
  return s;
}

function clash(s) {
  const A = front(s, 0), B = front(s, 1);
  if (!A || !B) return;
  // 同步快照（安全锁 1）
  const snapAtk = { [A.uid]: A.atk, [B.uid]: B.atk };
  const plans = [];
  for (let [att, side] of [[A, 0], [B, 1]]) {
    if (att.obstacle) { att = line(s, side)[1]; if (!att || att.obstacle) continue; snapAtk[att.uid] = att.atk; }
    if (att.stun) { log(s, 'stunned', { uid: att.uid }); continue; }
    if (att.atk <= 0) continue;
    const targetsSide = foe(side);
    let targets;
    if (att.size > 1) {
      // 巨型横扫前 N 格
      targets = [];
      let slots = 0;
      for (const v of line(s, targetsSide)) { if (slots >= att.size) break; targets.push(v); slots += v.size; }
    } else targets = [front(s, targetsSide)];
    plans.push({ att, side, targets });
  }
  // 插队（R4）：队首将受致命一击时，插队者顶上并承受这一击
  for (const p of plans) {
    const tside = foe(p.side);
    const f = front(s, tside);
    if (!f || !p.targets.includes(f)) continue;
    const dmg = f.block > 0 ? 0 : Math.max(0, snapAtk[p.att.uid] - f.armor);
    if (dmg < f.hp + f.shield) continue;
    const ins = line(s, tside).find((x) => alive(x) && x !== f && x.size === 1 && CARDS[x.id].insert?.(s, x));
    if (!ins) continue;
    log(s, 'insert', { uid: ins.uid, saved: f.uid });
    moveToFront(s, ins, 'insert');
    CARDS[ins.id].onInsert?.(s, ins, {}, API);
    p.targets = p.targets.map((t) => (t === f ? ins : t));
    // 对方的攻击者若是被换下的单位，仍按原计划出手（它已在快照里）
  }
  for (const p of plans) {
    s.atomic++;
    log(s, 'attack', { src: p.att.uid, uids: p.targets.map((t) => t.uid), label: 'clash' });
    // 巨型横扫：第 2 格起按 CFG.sweepRatio 结算
    p.targets.forEach((t, k) => attackHit(s, p.att, t, k ? Math.floor(snapAtk[p.att.uid] * CFG.sweepRatio) : snapAtk[p.att.uid], { shatter: CARDS[p.att.id].shatter, label: 'clash' }));
    emit(s, 'clashAttack', { unit: p.att, target: p.targets[0] });
  }
  // 双锋：己方 2 号位同时攻击敌方 1 号位（单向）
  if (s.ultArmed) {
    s.ultArmed = false;
    const second = line(s, 0)[1];
    if (alive(second) && second.atk > 0) extraAttack(s, second, () => front(s, 1), { label: 'ult' });
  }
  // 连击
  for (const p of plans) {
    const n = p.att.combo;
    if (!n) continue;
    p.att.combo = 0;
    for (let i = 0; i < n; i++) extraAttack(s, p.att, () => front(s, foe(p.side)), { label: 'combo' });
  }
}

export function advance(s) {
  if (s.result || s.phase !== 'window') return s;
  s.round++;
  s.passiveUsed = false;
  s.phase = 'round';
  log(s, 'round');
  // ① 攻击前
  const fronts = [s.lines[0][0], s.lines[1][0]];
  s.atomic++;
  emit(s, 'beforeAttack', {});
  drain(s);
  resolveDeaths(s);
  if (checkEnd(s)) return s;
  // R1：攻击前击杀了任一队首，本轮双方的常规攻击都作废
  const voided = fronts.some((id) => s.units[id].dead);
  if (!voided) { s.inClash = true; clash(s); drain(s); resolveDeaths(s); s.inClash = false; }
  else log(s, 'void');
  // 冰冻只持续一轮；解冻后 CFG.thaw 轮内不能再被冰冻
  for (const side of [0, 1]) for (const u of line(s, side)) {
    if (u.stun) { u.stun--; if (!u.stun) u.thaw = CFG.thaw + 1; }
    if (u.thaw) u.thaw--;
    if (u.mark) u.mark--;
    if (u.vulnRounds) u.vulnRounds--;
    if (u.tmpAtk) { u.atk -= u.tmpAtk; u.tmpAtk = 0; }
  }
  if (checkEnd(s)) return s;
  // ⑥ 交锋后：灼烧（原型未使用）→ 疲劳 → 自动触发器 → 英雄
  if (s.round >= CFG.fatigueStart) {
    const n = s.round - CFG.fatigueStart + 1;
    log(s, 'fatigue', { n });
    for (const side of [0, 1]) for (const u of line(s, side)) injure(s, u, n, null, 'fatigue');
    resolveDeaths(s);
    if (checkEnd(s)) return s;
  }
  s.atomic++;
  emit(s, 'afterClash', {});
  drain(s);
  resolveDeaths(s);
  if (checkEnd(s)) return s;
  gainEnergy(s, CFG.energyPerRound, 'round');
  if (!s.ultUsed && s.ultMeter < CFG.ultCharge) s.ultMeter++;
  s.phase = 'window';
  return s;
}

// 不用英雄，直接打到结束
export function runToEnd(s) {
  if (s.phase === 'setup') startBattle(s);
  while (!s.result) advance(s);
  return s;
}

// ---------- 给卡牌用的接口 ----------
export const API = {
  line, front, idx, lv3, useOnce, addBlock, addShield, buff, heal,
  castDamage, extraAttack, swapUnits, knockback, pullToFront, redirect, rand, addCharge,
  summon, devour, revive, freeSlots, injure, freeze, cap, isFull, def, log,
  back: (s, u) => { const L = line(s, u.side); return L[L.indexOf(u) + 1]; },
  ahead: (s, u) => { const L = line(s, u.side); return L[L.indexOf(u) - 1]; },
  behind: (s, u) => { const L = line(s, u.side); return L.slice(L.indexOf(u) + 1); },
  enemyFront: (s, u) => front(s, foe(u.side)),
  enemyTail: (s, u) => { const L = line(s, foe(u.side)); return L[L.length - 1]; },
  allies: (s, u) => line(s, u.side),
  isAlly: (a, b) => a && b && a.side === b.side,
};
