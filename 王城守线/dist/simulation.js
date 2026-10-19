import { STAGES, WORLD, getStage } from "./levels.js";
import { ABILITY_STATS, FAMILY_STATS, SPAWN_GAPS, STAGE_BALANCE, WAVE_PLANS } from "./balance.js";

const tower = (
  id,
  name,
  cost,
  role,
  summary,
  damage,
  range,
  interval,
  extra = {},
) => ({
  id,
  name,
  cost,
  icon: `${extra.category === "unit" ? "unit" : "tower"}.${id}`,
  category: extra.category ?? "tower",
  role,
  summary,
  damage,
  damageType: extra.damageType ?? "physical",
  range,
  interval,
  projectileSpeed: extra.projectileSpeed ?? 360,
  splash: 0,
  armorPierce: 0,
  slow: 0,
  color: "#e5cb78",
  ...extra,
});
export const TOWER_TYPES = Object.freeze({
  archer: tower(
    "archer",
    "弓箭塔",
    70, "弓箭系", "快速射击单个地面或空中目标。", 5, 140, 0.8,
    { family: "archer", projectileSpeed: 500 },
  ),
  mage: tower(
    "mage",
    "秘法塔",
    100, "法师系", "以魔法攻击单个目标，无视物理护甲。", 13, 140, 1.5,
    {
      family: "mage", damageType: "magic", projectileSpeed: 300,
      color: "#91c4e2",
    },
  ),
  guardian: tower(
    "guardian",
    "守军营地",
    70, "兵营系", "派出三名士兵阻挡地面敌人，阵亡后自动补员。", 0, 145, 1,
    { family: "barracks", barracks: true, color: "#d78d62" },
  ),
  catapult: tower(
    "catapult",
    "投石车",
    125, "炮兵系", "轰击地面目标，对密集敌人造成范围伤害。", 15, 160, 3,
    {
      family: "artillery", projectileSpeed: 190, splash: 62.4,
      damageType: "explosive",
      groundOnly: true,
      color: "#d5a36a",
    },
  ),
  frost: tower(
    "frost",
    "霜弓猎手",
    70, "弓箭系", "以冰晶箭射击单个地面或空中目标。", 5, 140, 0.8,
    {
      category: "unit",
      sprite: "frost", family: "archer", projectileSpeed: 500,
      color: "#82d9ed",
    },
  ),
  storm: tower(
    "storm",
    "风暴使者",
    125, "炮兵系", "雷霆在地面爆发，对密集敌人造成范围伤害。", 15, 160, 3,
    {
      category: "unit",
      sprite: "storm", family: "artillery", damageType: "explosive",
      projectileSpeed: 240, splash: 62.4, groundOnly: true,
      color: "#b7a6ff",
    },
  ),
  flame: tower(
    "flame",
    "焰血术士",
    100, "法师系", "以火焰法术攻击单个目标，无视物理护甲。", 13, 140, 1.5,
    {
      category: "unit",
      sprite: "flame", family: "mage", damageType: "magic", projectileSpeed: 300,
      color: "#ef754c",
    },
  ),
  sentinel: tower(
    "sentinel",
    "铁誓卫士",
    70, "兵营系", "率领三名士兵阻挡地面敌人，阵亡后自动补员。", 0, 145, 1,
    {
      category: "unit",
      sprite: "sentinel", family: "barracks", barracks: true,
      color: "#d7c7a1",
    },
  ),
});
const enemy = (name, hp, speed, armor, reward, breach, size, extra = {}) => ({
  name,
  hp,
  speed,
  armor,
  reward,
  breach,
  size,
  magicResist: 0,
  ...extra,
});
export const ENEMY_TYPES = Object.freeze({
  grunt: enemy("哥布林", 20, 46.1, 0, 3, 1, 23, {
    attack: [1, 4], attackInterval: 1,
    sprite: "grunt",
    visibleHeight: 52,
  }),
  runner: enemy("座狼", 35, 96, 0, 5, 1, 21, {
    attack: [1, 3], attackInterval: 1.47, meleeDodge: 0.3,
    sprite: "runner",
    visibleHeight: 64,
  }),
  armored: enemy("兽人", 80, 30.7, 0.3, 9, 1, 26, {
    attack: [4, 8], attackInterval: 1,
    sprite: "armored",
    visibleHeight: 66,
  }),
  flyer: enemy("石像鬼", 90, 46.1, 0, 12, 1, 23, {
    sprite: "flyer",
    flying: true,
    visibleHeight: 64,
  }),
  swarm: enemy("虫群", 38, 61, 0, 4, 1, 15, {
    sprite: "swarm",
    duelyst: true,
    visibleHeight: 44,
  }),
  shaman: enemy("萨满", 100, 38.4, 0, 10, 1, 24, {
    sprite: "shaman",
    duelyst: true,
    visibleHeight: 70,
    magicResist: 0.85, attack: [3, 5], attackInterval: 1.6,
    healRadius: 105,
    healAmount: 50, healInterval: 8, healMaxTargets: 3,
  }),
  wraith: enemy("幽魂", 126, 55, 0, 14, 2, 22, {
    sprite: "wraith",
    duelyst: true,
    visibleHeight: 70,
    magicResist: 0.52,
  }),
  juggernaut: enemy("食人魔", 800, 26.9, 0, 50, 3, 31, {
    attack: [40, 60], attackInterval: 1,
    sprite: "juggernaut",
    duelyst: true,
    visibleHeight: 92,
  }),
  boss: enemy("破城巨兽", 1260, 22, 13, 115, 6, 39, {
    sprite: "boss",
    visibleHeight: 96,
    magicResist: 0.12,
    boss: true,
  }),
});
export const MAX_TOWER_LEVEL = 3;
const mix = (s, w) =>
  (WAVE_PLANS[s.id] ?? WAVE_PLANS.greenway)[Math.max(1, w) - 1] ?? [];
const audio = (g, n) => {
  (g.audioEvents ??= []).push(n);
  if (g.audioEvents.length > 32)
    g.audioEvents.splice(0, g.audioEvents.length - 32);
};
const fx = (g, e) => {
  (g.effects ??= []).push({ age: 0, duration: 0.35, ...e });
  if (g.effects.length > 120) g.effects.splice(0, g.effects.length - 120);
};
function wavePlan(s, w) {
  let at = 0.65,
    q = [];
  for (const [type, count] of mix(s, w)) {
    let gap = SPAWN_GAPS[type] ?? SPAWN_GAPS.default;
    for (let i = 0; i < count; i++) {
      q.push({ type, at });
      at += gap;
    }
    at += SPAWN_GAPS.group;
  }
  return q;
}
export function createGame(id) {
  let s = getStage(id);
  const reference = STAGE_BALANCE[s.id] ?? STAGE_BALANCE.greenway;
  return {
    stageId: s.id,
    phase: "deploy",
    paused: false,
    speed: 1,
    gold: reference.startingGold,
    lives: reference.lives,
    wave: 0,
    maxWaves: reference.waves,
    waveElapsed: 0,
    spawnQueue: [],
    enemies: [],
    towers: [],
    soldiers: [],
    projectiles: [],
    effects: [],
    audioEvents: [],
    placementType: null,
    selectedTowerId: null,
    nextTowerId: 1,
    nextEnemyId: 1,
    nextSoldierId: 1,
    rng: 0x6d2b79f5 ^ s.number,
    abilities: { reinforcements: 0, rain: 0 },
    targeting: null,
    stats: { damageDealt: 0, kills: 0, breaches: 0 },
    events: [],
    stageWon: false,
    stageLost: false,
    elapsed: 0,
  };
}
export function beginWave(g) {
  if (!["deploy", "intermission"].includes(g.phase) || g.wave >= g.maxWaves)
    return false;
  g.wave++;
  g.waveElapsed = 0;
  g.spawnQueue = wavePlan(getStage(g.stageId), g.wave);
  g.phase = "combat";
  g.placementType = null;
  g.selectedTowerId = null;
  g.events.push({ type: "wave", text: `第 ${g.wave} 波来袭` });
  audio(g, "wave");
  return true;
}
export function requestPlacement(g, t) {
  if (!TOWER_TYPES[t] || ["victory", "defeat"].includes(g.phase)) return false;
  if (g.gold < TOWER_TYPES[t].cost) {
    g.events.push({ type: "message", text: "金币不足，先击退一波敌人。" });
    return false;
  }
  g.placementType = t;
  g.selectedTowerId = null;
  return true;
}
export function cancelPlacement(g) {
  g.placementType = null;
}
export function placeTower(g, p) {
  if (["victory", "defeat"].includes(g.phase))
    return { ok: false, message: "本场战斗已经结束。" };
  let s = getStage(g.stageId),
    d = TOWER_TYPES[g.placementType];
  if (!d) return { ok: false, message: "先选择一种防御塔。" };
  if (p < 0 || p >= s.pads.length || g.towers.some((t) => t.padIndex === p))
    return { ok: false, message: "这个位置无法建造。" };
  if (g.gold < d.cost) return { ok: false, message: "金币不足。" };
  g.gold -= d.cost;
  let [x, y] = s.pads[p],
    t = {
      id: g.nextTowerId++,
      type: d.id,
      level: 1,
      padIndex: p,
      x,
      y,
      cooldown: 0.25,
      targetId: null,
      flash: 0,
      attackLeft: 0,
      attackAge: 0,
      facing: 1,
      rally: null,
    };
  g.towers.push(t);
  if (d.barracks) {
    const rally = nearestPathPoint(s, { x, y }, x, y + 74);
    t.rally = rally;
    syncBarracks(g, t, true);
  }
  g.selectedTowerId = t.id;
  g.placementType = null;
  g.events.push({ type: "build", text: `建成${d.name}` });
  audio(g, "build");
  fx(g, { kind: "summon", x, y, duration: 0.65, color: d.color });
  return { ok: true, tower: t };
}
export function selectTower(g, id) {
  if (["victory", "defeat"].includes(g.phase)) return;
  g.selectedTowerId = id;
  g.placementType = null;
}
export function upgradeCost(t) {
  const family = FAMILY_STATS[TOWER_TYPES[t.type].family];
  return family?.costs[t.level] ?? 0;
}
function spent(type, l) {
  const family = FAMILY_STATS[TOWER_TYPES[type].family];
  return family ? family.costs.slice(1, l).reduce((a, b) => a + b, 0) : 0;
}
export function sellValue(t, game) {
  const fraction = game?.phase === "deploy" && game.wave === 0 ? 1 : 0.6;
  return Math.floor((TOWER_TYPES[t.type].cost + spent(t.type, t.level)) * fraction);
}
export function getMaxTowerLevel(game) {
  return STAGE_BALANCE[game.stageId]?.towerLevelCap ?? getStage(game.stageId).towerLevelCap ?? 3;
}
export function upgradeTower(g, id) {
  if (["victory", "defeat"].includes(g.phase))
    return { ok: false, message: "本场战斗已经结束。" };
  let t = g.towers.find((x) => x.id === id);
  if (!t) return { ok: false, message: "这座塔已经不在战场上。" };
  if (t.level >= getMaxTowerLevel(g)) return { ok: false, message: "本关尚未开放更高等级。" };
  let c = upgradeCost(t);
  if (g.gold < c) return { ok: false, message: "金币不足，暂时无法升级。" };
  g.gold -= c;
  t.level++;
  if (TOWER_TYPES[t.type].barracks) syncBarracks(g, t, false);
  t.flash = 0.55;
  g.events.push({
    type: "upgrade",
    text: `${TOWER_TYPES[t.type].name}升至 ${t.level} 级`,
  });
  audio(g, "upgrade");
  return { ok: true, tower: t };
}
export function sellTower(g, id) {
  if (["victory", "defeat"].includes(g.phase))
    return { ok: false, message: "本场战斗已经结束。" };
  let i = g.towers.findIndex((t) => t.id === id);
  if (i < 0) return { ok: false, message: "这座塔已经不在战场上。" };
  let [t] = g.towers.splice(i, 1),
    refund = sellValue(t, g);
  g.projectiles = g.projectiles.filter((p) => p.towerId !== id);
  g.soldiers = g.soldiers.filter((s) => s.towerId !== id);
  g.gold += refund;
  g.selectedTowerId = null;
  g.events.push({ type: "sell", text: `拆除返还 ${refund} 金币` });
  return { ok: true, refund };
}
function spawn(g, it) {
  let b = ENEMY_TYPES[it.type],
    s = getStage(g.stageId),
    hp = b.hp;
  return {
    id: g.nextEnemyId++,
    type: it.type,
    x: s.path[0][0],
    y: s.path[0][1],
    waypoint: 1,
    travelled: 0,
    hp,
    maxHp: hp,
    speed: b.speed,
    armor: b.armor,
    magicResist: b.magicResist,
    reward: b.reward,
    breach: b.breach,
    radius: b.size / 2,
    flying: !!b.flying,
    slowLeft: 0,
    slowFactor: 1,
    burnLeft: 0,
    burnDps: 0,
    burnTick: 0,
    stunLeft: 0,
    stunImmuneLeft: 0,
    healCooldown: b.healInterval ? 1 : 0,
    attackCooldown: 0,
    blockedBy: null,
    pathIndex: it.pathIndex ?? 0,
    flash: 0,
  };
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const random = (g) => {
  g.rng = (Math.imul(g.rng >>> 0, 1664525) + 1013904223) >>> 0;
  return g.rng / 4294967296;
};
const roll = (g, [low, high]) => low + Math.floor(random(g) * (high - low + 1));
const rollProjectile = (g, [low, high]) => Math.ceil(low + random(g) * (high - low));
const getEnemyPath = (stage, enemy) => stage.paths?.[enemy.pathIndex ?? 0] ?? stage.path;
function nearestPathPoint(stage, origin, x, y) {
  let best = { x: origin.x, y: origin.y }, bestD = Infinity;
  for (const path of stage.paths ?? [stage.path]) for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const point = { x: ax + dx * t, y: ay + dy * t }, d = Math.hypot(point.x - x, point.y - y);
    if (d < bestD && Math.hypot(point.x - origin.x, point.y - origin.y) <= FAMILY_STATS.barracks.rallyRadius) {
      best = point; bestD = d;
    }
  }
  return best;
}
function soldierPosition(rally, index) {
  const offsets = [[-15, 6], [15, 6], [0, -10]];
  const [dx, dy] = offsets[index] ?? [0, 0];
  return { x: rally.x + dx, y: rally.y + dy };
}
function syncBarracks(g, tower, initial) {
  const stats = getTowerStats(tower), existing = g.soldiers.filter((s) => s.towerId === tower.id);
  for (let i = 0; i < FAMILY_STATS.barracks.soldiers; i++) {
    const position = soldierPosition(tower.rally, i), soldier = existing[i];
    if (soldier) {
      const ratio = soldier.maxHp ? soldier.hp / soldier.maxHp : 1;
      soldier.level = tower.level; soldier.maxHp = stats.soldierHp;
      if (!soldier.deadLeft) soldier.hp = Math.max(1, Math.round(stats.soldierHp * ratio));
    } else g.soldiers.push({
      id: g.nextSoldierId++, towerId: tower.id, ...position, homeX: position.x, homeY: position.y, hp: stats.soldierHp,
      maxHp: stats.soldierHp, deadLeft: initial ? 0 : FAMILY_STATS.barracks.respawn,
      targetId: null, attackLeft: 0, attackAge: 0, attackCooldown: 0,
      outOfCombat: 0, facing: 1, moving: false, level: tower.level, reinforcement: false, lifeLeft: null,
    });
  }
}
export function setRallyPoint(g, towerId, x, y) {
  const tower = g.towers.find((t) => t.id === towerId);
  if (!tower || !TOWER_TYPES[tower.type].barracks) return { ok: false, message: "请选择一座兵营。" };
  if (Math.hypot(x - tower.x, y - tower.y) > FAMILY_STATS.barracks.rallyRadius)
    return { ok: false, message: "集结点超出兵营范围。" };
  tower.rally = nearestPathPoint(getStage(g.stageId), tower, x, y);
  g.soldiers.filter((s) => s.towerId === tower.id).forEach((s, i) => {
    const position = soldierPosition(tower.rally, i);
    for (const enemy of g.enemies) if (enemy.blockedBy === s.id) enemy.blockedBy = null;
    Object.assign(s, { homeX: position.x, homeY: position.y, targetId: null, moving: !s.deadLeft });
  });
  g.targeting = null;
  return { ok: true, rally: tower.rally };
}
export function getTowerStats(t) {
  const d = TOWER_TYPES[t.type], family = FAMILY_STATS[d.family], i = Math.max(0, t.level - 1);
  if (d.barracks) return {
    family: d.family, range: family.rallyRadius, damage: 0, damageBounds: family.damage[i],
    interval: family.interval[i], soldierHp: family.hp[i], soldierArmor: family.armor[i],
    projectileSpeed: 0, splash: 0, armorPierce: 0, slow: 0, damageType: "physical", burn: 0, stun: 0, chain: 0,
  };
  const bounds = family.damage[i];
  return {
    family: d.family, range: family.range[i], damage: bounds[1], damageBounds: bounds,
    interval: family.interval[i], projectileSpeed: family.projectileSpeed,
    splash: family.splash?.[i] ?? 0, armorPierce: 0, slow: 0,
    damageType: family.damageType, burn: 0, stun: 0, chain: 0,
  };
}
function damage(
  g,
  e,
  n,
  p = 0,
  slow = 0,
  type = "physical",
  burn = 0,
  stun = 0,
  melee = false,
) {
  if (!g.enemies.includes(e)) return;
  if (melee && e.meleeDodge && random(g) < e.meleeDodge) return;
  const protection = type === "magic" ? e.magicResist : type === "explosive" ? e.armor / 2 : type === "true" ? 0 : e.armor;
  const oldHp = e.hp;
  e.hp -= Math.max(0, Math.floor(n * (1 - Math.max(0, Math.min(1, protection)))));
  g.stats ??= { damageDealt: 0, kills: 0, breaches: 0 };
  g.stats.damageDealt += Math.max(0, Math.min(oldHp, oldHp - e.hp));
  e.flash = 0.14;
  if (slow) {
    const factor = 1 - slow;
    if (!e.slowLeft || factor < e.slowFactor) {
      e.slowFactor = factor;
      e.slowLeft = 1.7;
    } else if (factor === e.slowFactor) {
      e.slowLeft = Math.max(e.slowLeft, 1.7);
    }
  }
  if (burn && burn >= e.burnDps) {
    e.burnDps = burn;
    e.burnLeft = 2.6;
  }
  if (stun && !e.stunImmuneLeft) {
    e.stunLeft = ENEMY_TYPES[e.type].boss
      ? Math.min(0.14, stun * 0.4)
      : Math.min(0.35, stun);
    e.stunImmuneLeft = 2;
  }
  if (e.hp <= 0) {
    g.gold += e.reward;
    g.stats.kills++;
    g.enemies.splice(g.enemies.indexOf(e), 1);
    g.events.push({ type: "kill", text: `+${e.reward}` });
  }
}
function move(e, path, dt) {
  if (e.stunLeft || e.blockedBy) return false;
  let b = e.speed * (e.slowLeft ? e.slowFactor : 1) * dt;
  while (b > 0 && e.waypoint < path.length) {
    let [x, y] = path[e.waypoint],
      dx = x - e.x,
      dy = y - e.y,
      d = Math.hypot(dx, dy);
    if (d <= b) {
      e.x = x;
      e.y = y;
      e.travelled += d;
      b -= d;
      e.waypoint++;
    } else {
      e.x += (dx / d) * b;
      e.y += (dy / d) * b;
      e.travelled += b;
      b = 0;
    }
  }
  return e.waypoint >= path.length;
}
function shots(g, dt) {
  for (const t of g.towers) {
    if (TOWER_TYPES[t.type].barracks) continue;
    t.cooldown = Math.max(0, t.cooldown - dt);
    t.attackLeft = Math.max(0, (t.attackLeft ?? 0) - dt);
    if (t.attackLeft) t.attackAge = (t.attackAge ?? 0) + dt;
    let s = getTowerStats(t),
      d = TOWER_TYPES[t.type],
      target = g.enemies
        .filter(
          (e) =>
            (!d.groundOnly || !e.flying) && dist(t, e) <= s.range + e.radius,
        )
        .sort((a, b) => b.travelled - a.travelled)[0];
    if (!target) {
      t.targetId = null;
      continue;
    }
    t.targetId = target.id;
    t.facing = target.x < t.x ? -1 : 1;
    if (t.cooldown) continue;
    t.cooldown = s.interval;
    t.attackLeft = 0.55;
    t.attackAge = 0;
    audio(
      g,
      d.melee
        ? "melee"
        : t.type === "flame"
          ? "fire"
          : t.type === "frost" ? "ice"
            : t.type === "catapult" ? "siege"
              : ["mage", "storm"].includes(t.type) ? "magic" : "arrow",
    );
    g.projectiles.push({
      towerId: t.id,
      x: t.x,
      y: t.y - 20,
      targetId: target.id,
      impactX: target.x,
      impactY: target.y,
      speed: s.projectileSpeed,
      ...s,
      damage: s.damageType === "explosive" ? s.damageBounds[1] : rollProjectile(g, s.damageBounds),
      color: d.color,
      kind: t.type,
      groundOnly: !!d.groundOnly,
      ttl: d.melee ? 0.12 : 3.5,
    });
  }
  for (let i = g.projectiles.length - 1; i >= 0; i--) {
    let p = g.projectiles[i],
      target = g.enemies.find((e) => e.id === p.targetId);
    p.ttl -= dt;
    if (target) {
      p.impactX = target.x;
      p.impactY = target.y;
    }
    let dx = p.impactX - p.x,
      dy = p.impactY - p.y,
      d = Math.hypot(dx, dy),
      step = p.speed * dt;
    if (d <= step + 8 || p.ttl <= 0) {
      if (p.chain && target) {
        let cur = target,
          hit = [],
          fromX = p.x,
          fromY = p.y;
        for (let j = 0; j < Math.min(3, p.chain) && cur; j++) {
          hit.push(cur.id);
          fx(g, {
            kind: "lightning",
            fromX,
            fromY,
            x: cur.x,
            y: cur.y,
            duration: 0.22,
            color: p.color,
          });
          const origin = cur;
          damage(
            g,
            cur,
            Math.round(p.damage * (1 - j * 0.22)),
            p.armorPierce,
            0,
            p.damageType,
          );
          fromX = origin.x;
          fromY = origin.y;
          cur = g.enemies.filter(
            (e) => !hit.includes(e.id) && dist(origin, e) <= 92,
          )[0];
        }
      } else {
        let victims = p.splash
          ? g.enemies.filter(
              (e) =>
                (!p.groundOnly || !e.flying) &&
                dist(e, { x: p.impactX, y: p.impactY }) <= p.splash + e.radius,
            )
          : target
            ? [target]
            : [];
        for (const e of [...victims]) {
          let hitDamage = p.damage;
          if (p.damageType === "explosive") {
            const away = Math.hypot(e.x - p.impactX, e.y - p.impactY);
            const min = p.damageBounds[0], max = p.damageBounds[1];
            hitDamage = Math.max(min, Math.floor(max - (max - min) * Math.min(1, away / p.splash)));
          }
          damage(
            g,
            e,
            hitDamage,
            p.armorPierce,
            p.slow,
            p.damageType,
            p.burn,
            p.stun,
          );
        }
      }
      fx(g, {
        kind:
          p.kind === "flame"
            ? "fire"
            : p.kind === "storm"
              ? "lightning"
              : p.kind === "sentinel"
                ? "melee"
                : p.slow
                  ? "ice"
                  : "hit",
        x: p.impactX,
        y: p.impactY,
        duration: 0.35,
        color: p.color,
      });
      audio(g, p.kind === "sentinel" ? "melee" : "impact");
      g.projectiles.splice(i, 1);
    } else {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
  }
}
function hurtSoldier(g, soldier, amount) {
  const tower = g.towers.find((t) => t.id === soldier.towerId);
  const armor = soldier.reinforcement ? 0 : tower ? getTowerStats(tower).soldierArmor : 0;
  soldier.hp -= Math.max(0, amount - Math.floor(amount * armor));
  if (soldier.hp > 0) return;
  for (const enemy of g.enemies) if (enemy.blockedBy === soldier.id) enemy.blockedBy = null;
  soldier.hp = 0;
  soldier.targetId = null;
  if (soldier.reinforcement) g.soldiers.splice(g.soldiers.indexOf(soldier), 1);
  else soldier.deadLeft = FAMILY_STATS.barracks.respawn;
}
function soldiers(g, dt) {
  for (const soldier of [...g.soldiers]) {
    if (soldier.lifeLeft != null && (soldier.lifeLeft -= dt) <= 0) {
      for (const enemy of g.enemies) if (enemy.blockedBy === soldier.id) enemy.blockedBy = null;
      g.soldiers.splice(g.soldiers.indexOf(soldier), 1);
      continue;
    }
    if (soldier.deadLeft > 0) {
      soldier.deadLeft = Math.max(0, soldier.deadLeft - dt);
      if (!soldier.deadLeft) {
        const tower = g.towers.find((t) => t.id === soldier.towerId);
        if (!tower) continue;
        const position = soldierPosition(tower.rally, g.soldiers.filter((s) => s.towerId === tower.id).indexOf(soldier));
        Object.assign(soldier, position, { homeX: position.x, homeY: position.y, hp: soldier.maxHp, outOfCombat: 0, moving: false });
        fx(g, { kind: "summon", x: soldier.x, y: soldier.y, duration: 0.5 });
      }
      continue;
    }
    soldier.attackCooldown = Math.max(0, soldier.attackCooldown - dt);
    soldier.attackLeft = Math.max(0, soldier.attackLeft - dt);
    if (soldier.attackLeft) soldier.attackAge += dt;
    let target = g.enemies.find((e) => e.id === soldier.targetId && !e.flying && dist(soldier, e) <= 34);
    if (!target && soldier.targetId) {
      const stale = g.enemies.find((e) => e.id === soldier.targetId);
      if (stale?.blockedBy === soldier.id) stale.blockedBy = null;
    }
    if (!target) {
      target = g.enemies.filter((e) => !e.flying && !e.blockedBy && dist(soldier, e) <= 28)
        .sort((a, b) => b.travelled - a.travelled)[0];
      soldier.targetId = target?.id ?? null;
    }
    if (!target) {
      soldier.outOfCombat += dt;
      const tower = g.towers.find((t) => t.id === soldier.towerId);
      const regen = soldier.reinforcement ? 3 : FAMILY_STATS.barracks.regen[(tower?.level ?? 1) - 1];
      if (soldier.outOfCombat >= 2) soldier.hp = Math.min(soldier.maxHp, soldier.hp + regen * dt);
      if (soldier.homeX != null) {
        const dx = soldier.homeX - soldier.x, dy = soldier.homeY - soldier.y, distance = Math.hypot(dx, dy), step = 75 * dt;
        if (distance > 2) {
          soldier.x += dx / distance * Math.min(step, distance); soldier.y += dy / distance * Math.min(step, distance);
          soldier.facing = dx < 0 ? -1 : 1; soldier.moving = true;
        } else soldier.moving = false;
      }
      continue;
    }
    soldier.outOfCombat = 0;
    target.blockedBy = soldier.id;
    soldier.facing = target.x < soldier.x ? -1 : 1;
    const enemyType = ENEMY_TYPES[target.type];
    target.attackCooldown = Math.max(0, target.attackCooldown - dt);
    if (!target.attackCooldown && enemyType.attack) {
      target.attackCooldown = enemyType.attackInterval;
      hurtSoldier(g, soldier, roll(g, enemyType.attack));
      if (!g.soldiers.includes(soldier) || soldier.deadLeft) continue;
    }
    if (!soldier.attackCooldown) {
      const tower = g.towers.find((t) => t.id === soldier.towerId);
      const bounds = soldier.reinforcement ? ABILITY_STATS.reinforcements.damage : getTowerStats(tower).damageBounds;
      const interval = soldier.reinforcement ? ABILITY_STATS.reinforcements.interval : getTowerStats(tower).interval;
      soldier.attackCooldown = interval; soldier.attackLeft = 0.35; soldier.attackAge = 0;
      damage(g, target, roll(g, bounds), 0, 0, "physical", 0, 0, true);
      fx(g, { kind: "melee", x: target.x, y: target.y, duration: 0.22 });
    }
  }
}
export function getAbilityState(g, kind) {
  kind = kind === "reinforce" ? "reinforcements" : kind === "meteor" ? "rain" : kind;
  const stage = getStage(g.stageId), cooldown = Math.max(0, g.abilities?.[kind] ?? 0);
  const unlocked = kind === "reinforcements"
    ? stage.number > 1 || g.wave >= 3
    : kind === "rain" ? stage.number > 1 || g.wave >= 7 : false;
  return { unlocked, ready: unlocked && cooldown <= 0 && !g.paused && !["victory", "defeat"].includes(g.phase), cooldown };
}
export function castAbility(g, kind, x, y) {
  kind = kind === "reinforce" ? "reinforcements" : kind === "meteor" ? "rain" : kind;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > WORLD.width || y > WORLD.height)
    return { ok: false, message: "目标位置无效。" };
  const state = getAbilityState(g, kind);
  if (!state.unlocked) return { ok: false, message: "能力尚未解锁。" };
  if (!state.ready) return { ok: false, message: "能力仍在冷却。" };
  if (kind === "reinforcements") {
    const stats = ABILITY_STATS.reinforcements;
    for (let i = 0; i < stats.count; i++) g.soldiers.push({
      id: g.nextSoldierId++, towerId: null, x: x + (i ? 12 : -12), y, homeX: x + (i ? 12 : -12), homeY: y,
      hp: stats.hp, maxHp: stats.hp, deadLeft: 0, targetId: null,
      attackLeft: 0, attackAge: 0, attackCooldown: 0, outOfCombat: 0,
      facing: 1, moving: false, level: 1, reinforcement: true, lifeLeft: stats.duration,
    });
    g.abilities.reinforcements = stats.cooldown;
    fx(g, { kind: "summon", x, y, duration: 0.65 });
    audio(g, "build");
  } else if (kind === "rain") {
    const stats = ABILITY_STATS.rain;
    for (let i = 0; i < stats.meteors; i++) {
      const angle = i * Math.PI * 2 / stats.meteors, impact = { x: x + Math.cos(angle) * 18, y: y + Math.sin(angle) * 18 };
      fx(g, { kind: "fire", ...impact, duration: 0.55 });
      for (const enemy of [...g.enemies].filter((e) => dist(e, impact) <= stats.radius + e.radius))
        damage(g, enemy, roll(g, stats.damage), 0, 0, "true");
    }
    g.abilities.rain = stats.cooldown;
    audio(g, "fire");
  } else return { ok: false, message: "未知能力。" };
  g.targeting = null;
  return { ok: true };
}
export function tick(g, raw) {
  if (g.paused || ["victory", "defeat"].includes(g.phase)) return;
  let dt = Math.min(0.05, Math.max(0, raw)) * g.speed;
  (g.effects ??= []).forEach((e) => (e.age += dt));
  g.effects = g.effects.filter((e) => e.age < e.duration).slice(-120);
  g.abilities ??= { reinforcements: 0, rain: 0 };
  for (const kind of Object.keys(g.abilities)) g.abilities[kind] = Math.max(0, g.abilities[kind] - dt);
  if (g.phase !== "combat") {
    soldiers(g, dt);
    return;
  }
  let s = getStage(g.stageId);
  g.elapsed += dt;
  g.waveElapsed += dt;
  while (g.spawnQueue.length && g.spawnQueue[0].at <= g.waveElapsed)
    g.enemies.push(spawn(g, g.spawnQueue.shift()));
  soldiers(g, dt);
  for (const e of [...g.enemies]) {
    e.slowLeft = Math.max(0, e.slowLeft - dt);
    if (!e.slowLeft) e.slowFactor = 1;
    e.stunLeft = Math.max(0, e.stunLeft - dt);
    e.stunImmuneLeft = Math.max(0, e.stunImmuneLeft - dt);
    e.flash = Math.max(0, e.flash - dt);
    if (e.burnLeft) {
      e.burnLeft = Math.max(0, e.burnLeft - dt);
      e.burnTick -= dt;
      if (e.burnTick <= 0) {
        e.burnTick = 0.25;
        damage(g, e, e.burnDps * 0.25, 999, 0, "magic");
      }
      if (!e.burnLeft) e.burnDps = 0;
    }
    if (!g.enemies.includes(e)) continue;
    let b = ENEMY_TYPES[e.type];
    if (b.healInterval && (e.healCooldown -= dt) <= 0) {
      e.healCooldown = b.healInterval;
      for (const a of g.enemies
        .filter((a) => a.hp > 0 && a.hp < a.maxHp && dist(e, a) <= b.healRadius)
        .slice(0, b.healMaxTargets ?? 3)) {
        a.hp = Math.min(a.maxHp, a.hp + b.healAmount);
        fx(g, {
          kind: "heal",
          fromX: e.x,
          fromY: e.y,
          x: a.x,
          y: a.y,
          duration: 0.55,
        });
      }
    }
    if (g.enemies.includes(e) && move(e, getEnemyPath(s, e), dt)) {
      g.lives = Math.max(0, g.lives - e.breach);
      g.stats.breaches++;
      g.enemies.splice(g.enemies.indexOf(e), 1);
      g.events.push({ type: "breach", text: `城门受损 −${e.breach}` });
    }
  }
  shots(g, dt);
  if (g.lives <= 0) {
    g.phase = "defeat";
    g.stageLost = true;
    g.events.push({ type: "defeat", text: "城门失守" });
  } else if (!g.spawnQueue.length && !g.enemies.length) {
    if (g.wave >= g.maxWaves) {
      g.phase = "victory";
      g.stageWon = true;
      g.events.push({ type: "victory", text: "关隘守住了" });
    } else {
      g.phase = "intermission";
      g.events.push({ type: "clear", text: `第 ${g.wave} 波已击退` });
    }
  }
}
export function togglePause(g) {
  if (!["victory", "defeat"].includes(g.phase)) g.paused = !g.paused;
}
export function toggleSpeed(g) {
  g.speed = g.speed === 1 ? 1.6 : 1;
  return g.speed;
}
export function consumeEvents(g) {
  return g.events.splice(0);
}
export function getSelectedTower(g) {
  return g.towers.find((t) => t.id === g.selectedTowerId) ?? null;
}
export function hitTower(g, x, y, r = 42) {
  return (
    [...g.towers]
      .reverse()
      .find((t) => Math.hypot(t.x - x, t.y - 22 - y) <= r) ?? null
  );
}
export function hitPad(g, x, y, r = 38) {
  let p = getStage(g.stageId).pads;
  return p.findIndex(
    ([a, b], i) =>
      !g.towers.some((t) => t.padIndex === i) && Math.hypot(a - x, b - y) <= r,
  );
}
export function getWaveDescription(s, w) {
  return mix(s, w)
    .map(([t, n]) => `${ENEMY_TYPES[t].name}×${n}`)
    .join("、");
}
export { STAGES, WORLD, getStage };
