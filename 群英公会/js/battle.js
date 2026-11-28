// 半自动战斗引擎：纯逻辑、可确定性重放。视图只读取 events 播放动画与特效。
import {ROLES, SKILLS} from './data.js';
import {makeRng} from './rng.js';

export const BATTLE_LIMIT = 60000;
const MELEE_DELAY = 380;
const RANGED_DELAY = 460;
const SKILL_DELAY = 420;
const ULT_EVERY = 11000;
const ULT_CHARGE = 3600;

// spec: {id, name, unit, role, maxHp, atk, def, skill, fx, proj, boss, memberId, race}
export function createBattle({allies, enemies, seed = 1, pairs = [], commandPoints = 3, auto = false}) {
  const rng = makeRng(seed);
  const units = [];
  const add = (spec, side, i) => {
    const role = ROLES[spec.role];
    units.push({
      ...spec,
      key: side + i,
      side,
      row: spec.boss ? 0 : role.row,
      ranged: role.range === 'ranged' && !spec.boss,
      interval: Math.round((spec.boss ? 1700 : role.interval) * rng.range(0.92, 1.08)),
      hp: spec.maxHp,
      nextAt: rng.int(150, 700),
      skillAt: spec.skill ? rng.int(2500, 4500) : Infinity,
      shield: 0, taunt: 0, burnUntil: 0, burnDps: 0, burnTick: 0, freezeUntil: 0, stunUntil: 0,
      breakUntil: 0, buffUntil: 0, buff: 0, alive: true, dealt: 0,
      ult: spec.boss ? {nextAt: rng.int(6500, 8000), chargeUntil: 0} : null,
    });
  };
  allies.forEach((s, i) => add(s, 'A', i));
  enemies.forEach((s, i) => add(s, 'E', i));
  const keyOf = id => units.find(u => u.side === 'A' && u.memberId === id)?.key;
  const unison = pairs
    .map(([a, b]) => ({a: keyOf(a), b: keyOf(b), gauge: 0, used: false}))
    .filter(p => p.a && p.b);
  return {t: 0, rng, units, pending: [], events: [], log: [], over: false, winner: null, points: commandPoints, unison, auto};
}

const alive = (b, side) => b.units.filter(u => u.side === side && u.alive);
const foe = side => (side === 'A' ? 'E' : 'A');
const disabled = (b, u) => b.t < u.freezeUntil || b.t < u.stunUntil || (u.ult && u.ult.chargeUntil > b.t);

function emit(b, e) {
  e.t = b.t;
  b.events.push(e);
  b.log.push(e);
}

function pickTarget(b, u, mode) {
  const list = alive(b, foe(u.side));
  if (!list.length) return null;
  const taunters = list.filter(x => x.taunt > b.t);
  if (mode !== 'back' && taunters.length) return taunters[0];
  if (mode === 'back') return list.reduce((a, x) => (x.row > a.row || (x.row === a.row && x.hp < a.hp) ? x : a));
  if (mode === 'weak') return list.reduce((a, x) => (x.hp / x.maxHp < a.hp / a.maxHp ? x : a));
  if (mode === 'strong') return list.reduce((a, x) => (x.atk > a.atk ? x : a));
  if (mode === 'random') return b.rng.pick(list);
  const minRow = Math.min(...list.map(x => x.row));
  const front = list.filter(x => x.row === minRow);
  return b.rng.pick(front);
}

function atkOf(b, u) {
  return u.atk * (1 + (b.t < u.buffUntil ? u.buff : 0));
}

function dealDamage(b, src, tgt, raw, opts = {}) {
  if (!tgt.alive) return 0;
  const def = tgt.def * (b.t < tgt.breakUntil ? 0.45 : 1);
  const crit = !opts.noCrit && b.rng.chance(0.12);
  let dmg = raw * (60 / (60 + def)) * b.rng.range(0.9, 1.1) * (crit ? 1.6 : 1);
  dmg = Math.max(1, Math.round(dmg));
  let absorbed = 0;
  if (tgt.shield > 0) {
    absorbed = Math.min(tgt.shield, dmg);
    tgt.shield -= absorbed;
  }
  const hpLoss = dmg - absorbed;
  tgt.hp = Math.max(0, tgt.hp - hpLoss);
  if (src) {
    src.dealt += dmg;
    for (const p of b.unison) if (!p.used && (p.a === src.key || p.b === src.key)) p.gauge = Math.min(100, p.gauge + dmg / 6 + 2);
  }
  emit(b, {type: 'hit', src: src?.key, tgt: tgt.key, dmg, crit, absorbed, fx: opts.fx, kind: opts.kind});
  if (tgt.hp <= 0) {
    tgt.alive = false;
    tgt.shield = 0;
    emit(b, {type: 'death', tgt: tgt.key, by: src?.key});
  }
  return dmg;
}

function heal(b, src, tgt, amount, fx) {
  if (!tgt.alive) return;
  const v = Math.round(Math.min(tgt.maxHp - tgt.hp, amount));
  tgt.hp += v;
  emit(b, {type: 'heal', src: src?.key, tgt: tgt.key, amount: v, fx});
}

function schedule(b, at, fn) {
  b.pending.push({at, fn});
}

function basicAttack(b, u) {
  const mode = u.role === 'assassin' ? 'back' : u.ranged ? (u.role === 'archer' ? 'weak' : 'random') : 'front';
  const tgt = pickTarget(b, u, mode);
  if (!tgt) return;
  const delay = u.ranged ? RANGED_DELAY : MELEE_DELAY;
  emit(b, {type: 'attack', src: u.key, tgt: tgt.key, ranged: u.ranged, proj: u.proj, delay});
  const mult = u.role === 'cleric' ? 0.8 : 1;
  schedule(b, b.t + delay, () => {
    const t = tgt.alive ? tgt : pickTarget(b, u, mode);
    if (t && u.alive) dealDamage(b, u, t, atkOf(b, u) * mult, {fx: u.fx, kind: 'basic'});
  });
}

function castSkill(b, u) {
  const s = SKILLS[u.skill];
  const foes = alive(b, foe(u.side));
  const friends = alive(b, u.side);
  if (!foes.length) return;
  const a = atkOf(b, u);
  let targets = [];
  let apply;
  switch (s.kind) {
    case 'shieldAll':
      targets = friends;
      apply = () => targets.forEach(t => { t.shield += Math.round(t.maxHp * s.power); emit(b, {type: 'status', tgt: t.key, status: 'shield', fx: s.fx}); });
      break;
    case 'shieldSelf':
      targets = [u];
      apply = () => { u.shield += Math.round(u.maxHp * s.power); u.taunt = b.t + 4000; emit(b, {type: 'status', tgt: u.key, status: 'shield', fx: s.fx}); };
      break;
    case 'heal': {
      targets = friends.slice().sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp).slice(0, 2);
      apply = () => targets.forEach(t => heal(b, u, t, a * s.power * 1.5, s.fx));
      break;
    }
    case 'healAll':
      targets = friends;
      apply = () => targets.forEach(t => heal(b, u, t, a * s.power * 1.2, 'healPulse'));
      break;
    case 'healAllShield':
      targets = friends;
      apply = () => targets.forEach(t => { heal(b, u, t, a * s.power, 'healPulse'); t.shield += Math.round(t.maxHp * 0.12); });
      break;
    case 'teamBuff':
      targets = friends;
      apply = () => targets.forEach(t => { t.buff = s.power; t.buffUntil = b.t + 6000; emit(b, {type: 'status', tgt: t.key, status: 'buff', fx: 'buff'}); });
      break;
    case 'selfBuff':
      targets = [u];
      apply = () => { u.buff = s.power; u.buffUntil = b.t + 6000; emit(b, {type: 'status', tgt: u.key, status: 'buff', fx: 'buff'}); };
      break;
    case 'cleave':
      targets = foes.slice().sort((x, y) => x.row - y.row).slice(0, 2);
      apply = () => targets.forEach(t => dealDamage(b, u, t, a * s.power, {kind: 'skill'}));
      break;
    case 'strikeBreak':
    case 'strikeStun': {
      targets = [pickTarget(b, u, u.ranged ? 'strong' : 'front')];
      apply = () => targets.forEach(t => {
        dealDamage(b, u, t, a * s.power, {kind: 'skill'});
        if (s.kind === 'strikeBreak') { t.breakUntil = b.t + 5000; emit(b, {type: 'status', tgt: t.key, status: 'break', fx: 'breakArmor'}); }
        else { t.stunUntil = b.t + 1500; emit(b, {type: 'status', tgt: t.key, status: 'stun'}); }
      });
      break;
    }
    case 'backstab':
      targets = [pickTarget(b, u, s.name === '杀意之刃' ? 'weak' : 'back')];
      apply = () => targets.forEach(t => dealDamage(b, u, t, a * s.power, {kind: 'skill'}));
      break;
    case 'multi':
      targets = Array.from({length: s.hits}, () => b.rng.pick(foes));
      apply = () => targets.forEach(t => { if (!t.alive) t = pickTarget(b, u, 'random'); if (t) dealDamage(b, u, t, a * s.power, {kind: 'skill'}); });
      break;
    case 'aoe':
    case 'aoeBurn':
    case 'aoeStun':
      targets = foes;
      apply = () => targets.forEach(t => {
        dealDamage(b, u, t, a * s.power, {kind: 'skill'});
        if (s.kind === 'aoeBurn' && t.alive) { t.burnUntil = b.t + 4000; t.burnDps = a * 0.22; t.burnTick = b.t + 1000; emit(b, {type: 'status', tgt: t.key, status: 'burn', fx: 'burn'}); }
        if (s.kind === 'aoeStun' && t.alive) { t.stunUntil = b.t + 1000; emit(b, {type: 'status', tgt: t.key, status: 'stun'}); }
      });
      break;
    case 'freeze':
      targets = [pickTarget(b, u, 'strong')];
      apply = () => targets.forEach(t => { dealDamage(b, u, t, a * s.power, {kind: 'skill'}); if (t.alive) { t.freezeUntil = b.t + 2500; emit(b, {type: 'status', tgt: t.key, status: 'freeze', fx: 'freeze'}); } });
      break;
    case 'drain':
      targets = [pickTarget(b, u, 'weak')];
      apply = () => targets.forEach(t => { const d = dealDamage(b, u, t, a * s.power, {kind: 'skill'}); heal(b, u, u, d, null); });
      break;
    case 'drainAll':
      targets = foes;
      apply = () => { let sum = 0; targets.forEach(t => { sum += dealDamage(b, u, t, a * s.power, {kind: 'skill'}); }); friends.forEach(f => heal(b, u, f, sum / friends.length * 0.6, null)); };
      break;
    default:
      return basicAttack(b, u);
  }
  targets = targets.filter(Boolean);
  emit(b, {type: 'skill', src: u.key, skill: u.skill, targets: targets.map(t => t.key), fx: s.fx, delay: SKILL_DELAY});
  schedule(b, b.t + SKILL_DELAY, () => { if (u.alive) apply(); });
}

function bossUltimate(b, u) {
  const targets = alive(b, foe(u.side));
  emit(b, {type: 'ultimate', src: u.key, targets: targets.map(t => t.key), fx: 'doom'});
  for (const t of targets) {
    dealDamage(b, u, t, u.atk * 2.1, {noCrit: true, kind: 'ult'});
    if (t.alive) t.stunUntil = b.t + 900;
  }
}

export function chargingBoss(b) {
  return b.units.find(u => u.alive && u.ult && u.ult.chargeUntil > b.t);
}

export function canCommand(b, cmd) {
  if (b.over) return false;
  if (cmd === 'interrupt') return b.points > 0 && !!chargingBoss(b);
  if (cmd === 'rally') return b.points > 0 && alive(b, 'A').length > 0;
  if (cmd === 'unison') return !!readyUnison(b);
  return false;
}

export function readyUnison(b) {
  return b.unison.find(p => !p.used && p.gauge >= 100 && b.units.find(u => u.key === p.a)?.alive && b.units.find(u => u.key === p.b)?.alive);
}

export function command(b, cmd) {
  if (!canCommand(b, cmd)) return false;
  if (cmd === 'interrupt') {
    const boss = chargingBoss(b);
    b.points--;
    boss.ult.chargeUntil = 0;
    boss.ult.nextAt = b.t + ULT_EVERY;
    boss.stunUntil = b.t + 2500;
    emit(b, {type: 'interrupt', tgt: boss.key, fx: 'interrupt'});
    dealDamage(b, null, boss, boss.maxHp * 0.06 * (60 + boss.def) / 60, {noCrit: true, kind: 'cmd'});
  } else if (cmd === 'rally') {
    b.points--;
    emit(b, {type: 'rally'});
    for (const u of alive(b, 'A')) {
      heal(b, null, u, u.maxHp * 0.28, 'healPulse');
      u.buff = Math.max(u.buff, 0.3);
      u.buffUntil = b.t + 5000;
    }
  } else if (cmd === 'unison') {
    const p = readyUnison(b);
    p.used = true;
    const ua = b.units.find(u => u.key === p.a);
    const ub = b.units.find(u => u.key === p.b);
    const targets = alive(b, 'E');
    emit(b, {type: 'unison', a: p.a, b: p.b, targets: targets.map(t => t.key)});
    schedule(b, b.t + 900, () => {
      for (const t of alive(b, 'E')) dealDamage(b, ua, t, (ua.atk + ub.atk) * 2.4, {noCrit: true, kind: 'unison'});
    });
  }
  return true;
}

export function step(b, dt) {
  if (b.over) return;
  b.t += dt;
  b.pending.sort((x, y) => x.at - y.at);
  while (b.pending.length && b.pending[0].at <= b.t) b.pending.shift().fn();

  for (const u of b.units) {
    if (!u.alive) continue;
    if (u.burnUntil > b.t && b.t >= u.burnTick) {
      u.burnTick += 1000;
      dealDamage(b, null, u, u.burnDps, {noCrit: true, kind: 'burn', fx: 'burn'});
      if (!u.alive) continue;
    }
    if (u.ult) {
      if (u.ult.chargeUntil && b.t >= u.ult.chargeUntil) {
        u.ult.chargeUntil = 0;
        u.ult.nextAt = b.t + ULT_EVERY;
        bossUltimate(b, u);
        continue;
      }
      if (!u.ult.chargeUntil && b.t >= u.ult.nextAt && !disabled(b, u)) {
        u.ult.chargeUntil = b.t + ULT_CHARGE;
        emit(b, {type: 'telegraph', src: u.key, until: u.ult.chargeUntil, fx: 'telegraph'});
        continue;
      }
    }
    if (disabled(b, u) || b.t < u.nextAt) continue;
    if (b.t >= u.skillAt) {
      castSkill(b, u);
      u.skillAt = b.t + SKILLS[u.skill].cd;
      u.nextAt = b.t + u.interval + 200;
    } else {
      basicAttack(b, u);
      u.nextAt = b.t + u.interval;
    }
  }

  if (b.auto) {
    // 无人督战时，队员只会在危急时刻灌下应急酒
    if (b.points > 0 && alive(b, 'A').some(u => u.hp / u.maxHp < 0.2) && b.rng.chance(0.02)) command(b, 'rally');
  }

  const a = alive(b, 'A').length;
  const e = alive(b, 'E').length;
  if (!a || !e || b.t >= BATTLE_LIMIT) {
    b.over = true;
    b.winner = e === 0 && a > 0 ? 'A' : 'E';
    emit(b, {type: 'end', winner: b.winner, timeout: b.t >= BATTLE_LIMIT});
  }
}

export function runHeadless(b, dt = 50) {
  while (!b.over) step(b, dt);
  b.events.length = 0;
  return summarize(b);
}

export function summarize(b) {
  return {
    winner: b.winner,
    duration: b.t,
    allies: b.units.filter(u => u.side === 'A').map(u => ({memberId: u.memberId, alive: u.alive, hpRatio: u.hp / u.maxHp, dealt: Math.round(u.dealt)})),
    enemiesKilled: b.units.filter(u => u.side === 'E' && !u.alive).length,
    bossKilled: b.units.some(u => u.side === 'E' && u.boss && !u.alive),
    unisonUsed: b.unison.some(p => p.used),
  };
}
