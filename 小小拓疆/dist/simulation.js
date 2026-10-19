import { BUILDINGS, LEVEL, UNIT_TYPES } from "./level.js";
import { RoadNavigation } from "./navigation.js";

const FACTIONS = ["player", "enemy", "rival"];
const SITES = new Set(["castle", "town", "tower"]);
const ALLOWED = { castle: ["guard", "archer", "cavalry", "siege"], town: ["guard", "archer"], tower: ["guard", "magic"] };
const HP = { castle: 1000, town: 500, tower: 500 };
const YIELD = { castle: [3, 1, 2], town: [2, 0, 1], tower: [1, 2, 1] };
const OGRE = { hp: 400, damage: 34, range: 28, speed: 58, interval: 1.2, supply: 0, soldiers: 1 };
const LEVEL_MULTIPLIER = [1, 1, 1.15, 1.3];
const ROAD_SNAP = 60;
const CASUALTY_LIFETIME = 1.5;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class Simulation {
  constructor() {
    this.navigation = new RoadNavigation(LEVEL);
    this.state = {
      time: 0, gold: { ...LEVEL.startingGold }, mana: { ...LEVEL.startingMana },
      nodes: LEVEL.nodes.map((n) => ({ ...n, hp: HP[n.kind] || 0, maxHp: HP[n.kind] || 0, level: 1, captureProgress: 0, captureOwner: null })),
      slots: LEVEL.slots.map((s) => ({ ...s, owner: LEVEL.nodes.find((n) => n.id === s.hostId)?.owner || "neutral", building: null })),
      units: [], casualties: [], effects: [], winner: null, events: [{ time: 0, text: "三方拓疆开始。" }],
    };
    this.nextUnit = 1; this.nextEffect = 1; this.incomeClock = 0; this.aiClock = 1;
    for (const row of LEVEL.initialUnits) for (let i = 0; i < (row.count || 1); i += 1) this._spawn(row.owner, row.kind, row.nodeId, true);
    for (const n of this.state.nodes.filter((x) => x.kind === "ogre")) this._spawn("ogre", "guard", n.id, false);
  }

  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || this.state.winner) return;
    for (let left = Math.min(dt, 1); left > 0;) { const slice = Math.min(.1, left); this._tick(slice); left -= slice; }
  }

  command(a) {
    if (this.state.winner) return this._result(false, "战斗已经结束。");
    const type = a?.type || a?.action;
    if (type === "recruit") return this._recruit("player", a.nodeId, a.kind);
    if (type === "build") return this._build("player", a.slotId, a.building);
    if (type === "upgrade") return this._upgrade("player", a.nodeId);
    if (type === "move") return this._move("player", a.unitIds, a.target);
    if (type === "heal") return this._heal("player", a.x, a.y);
    return this._result(false, "未知指令。");
  }

  population(owner) {
    const used = this.state.units.filter((u) => u.owner === owner && u.hp > 0).reduce((n, u) => n + (UNIT_TYPES[u.kind]?.supply || 0), 0);
    return { used, cap: this.income(owner).cap };
  }

  income(owner) {
    const out = { gold: 0, mana: 0, cap: 0 };
    for (const n of this.state.nodes) if (n.owner === owner && n.hp > 0 && YIELD[n.kind]) { out.gold += YIELD[n.kind][0]; out.mana += YIELD[n.kind][1]; out.cap += YIELD[n.kind][2]; }
    for (const s of this.state.slots) if (s.owner === owner && s.building) {
      const host = this._node(s.hostId);
      if (!host || host.hp <= 0 || host.owner !== owner) continue;
      if (s.building.type === "mine") out.gold += 2;
      if (s.building.type === "obelisk") out.mana += 1;
      if (s.building.type === "farm") out.cap += 1;
    }
    return out;
  }

  recruitQuote(nodeId, kind, owner = "player") {
    const n = this._node(nodeId), spec = UNIT_TYPES[kind]; let message = "";
    if (!n || !SITES.has(n.kind)) message = "该位置不能招募。";
    else if (n.owner !== owner) message = "只能在己方据点招募。";
    else if (n.hp <= 0) message = "废墟不能招募。";
    else if (!spec || !ALLOWED[n.kind].includes(kind)) message = "该据点不能招募此兵种。";
    else if ((this.state.gold[owner] || 0) < spec.cost) message = "金币不足。";
    else if (this.population(owner).used + spec.supply > this.population(owner).cap) message = "编制已满，建农场或占领据点可扩编。";
    return { ok: !message, cost: spec?.cost || 0, supply: spec?.supply || 0, message };
  }

  upgradeCost(nodeId) {
    const n = this._node(nodeId);
    return n && n.owner === "player" && SITES.has(n.kind) && n.hp > 0 && n.level < 3 ? n.level * 150 : null;
  }
  projectRoad(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const projected = this.navigation.project(x, y);
    return projected && projected.distanceToInput <= ROAD_SNAP ? projected : null;
  }

  _tick(dt) {
    this.state.time += dt; this.incomeClock += dt;
    this.state.casualties = this.state.casualties.filter((u) => u.expiresAt > this.state.time);
    if (this.incomeClock >= 1) { const seconds = Math.floor(this.incomeClock); this.incomeClock -= seconds; for (const f of FACTIONS) { const v = this.income(f); this.state.gold[f] += v.gold * seconds; this.state.mana[f] += v.mana * seconds; } }
    for (const u of this.state.units) { u.visualAction = u.garrisoned ? "garrison" : "idle"; u.locked = Boolean(u.meleeTarget); u.inCombat = false; }
    this._defense(); this._combat(dt); this._movement(dt); this._effects(dt); this._capture(dt); this._repair(dt);
    this.aiClock -= dt; if (this.aiClock <= 0) { this._ai(); this.aiClock = 1.5; }
    this._winner();
  }

  _recruit(owner, nodeId, kind, silent = false) {
    const q = this.recruitQuote(nodeId, kind, owner); if (!q.ok) return this._result(false, q.message);
    this.state.gold[owner] -= q.cost; const unit = this._spawn(owner, kind, nodeId, true);
    if (!silent) this._event(`${this._node(nodeId).name}招募了${UNIT_TYPES[kind].name}。`);
    return { ok: true, message: "招募完成。", unit };
  }

  _build(owner, slotId, kind, silent = false) {
    const s = this.state.slots.find((x) => x.id === slotId), host = s && this._node(s.hostId), spec = BUILDINGS[kind];
    if (!s || !host) return this._result(false, "找不到资源位。");
    if (host.owner !== owner || host.hp <= 0) return this._result(false, "资源位的据点不属于己方。");
    if (s.building) return this._result(false, "资源位已被占用。");
    if (!spec) return this._result(false, "未知建筑。");
    if (this.state.gold[owner] < spec.cost) return this._result(false, "金币不足。");
    this.state.gold[owner] -= spec.cost; s.owner = owner; s.building = { type: kind };
    if (!silent) this._event(`建成${spec.name}。`); return this._result(true, `已建造${spec.name}。`);
  }

  _upgrade(owner, id, silent = false) {
    const n = this._node(id); if (!n || n.owner !== owner || !SITES.has(n.kind) || n.hp <= 0) return this._result(false, "该据点不能升级。");
    if (n.level >= 3) return this._result(false, "据点已满级。");
    const cost = n.level * 150; if (this.state.gold[owner] < cost) return this._result(false, "金币不足。");
    this.state.gold[owner] -= cost; n.level += 1; n.maxHp *= 1.25; n.hp = n.maxHp;
    if (!silent) this._event(`${n.name}升至${n.level}级。`); return this._result(true, "升级完成。");
  }

  _move(owner, ids, target, manual = true) {
    if (!Array.isArray(ids) || !ids.length) return this._result(false, "请先选择编队。");
    const units = ids.map((id) => this.state.units.find((u) => u.id === id));
    if (units.some((u) => !u || u.owner !== owner)) return this._result(false, "编队选择无效。");
    if (units.some((u) => u.locked || u.meleeTarget)) return this._result(false, "近战中的编队无法改令。");
    let loc = null, nodeId = null;
    if (target?.nodeId) { nodeId = target.nodeId; loc = this.navigation.atNode(nodeId); }
    else if (Number.isFinite(target?.x) && Number.isFinite(target?.y)) loc = this.projectRoad(target.x, target.y);
    if (!loc) return this._result(false, "目标不在可通行道路上。");
    const orders = [];
    for (const u of units) {
      const start = this.projectRoad(u.x, u.y), route = this.navigation.route(start, loc);
      if (!start || !route) return this._result(false, "至少一支编队无法到达目标，未下达任何命令。");
      orders.push([u, route]);
    }
    for (const [u, route] of orders) {
      u.garrisoned = false; u.route = route.points; u.routeIndex = 1; u.nodeId = null; u.roadId = route.start?.roadId || null;
      u.targetNodeId = nodeId; u.garrisonTarget = nodeId && this._node(nodeId)?.owner === owner ? nodeId : null;
      if (manual) u.defenseHome = null;
      if (u.routeIndex >= u.route.length) this._arrive(u);
    }
    return this._result(true, `已向${units.length}支编队下达命令。`);
  }

  _heal(owner, x, y, silent = false) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > LEVEL.world.width || y > LEVEL.world.height) return this._result(false, "治疗位置无效。");
    if (this.state.mana[owner] < 50) return this._result(false, "法力不足。");
    this.state.mana[owner] -= 50; this.state.effects.push({ id: `e${this.nextEffect++}`, owner, x, y, radius: 150, remaining: 12, type: "heal" });
    if (!silent) this._event("治疗旗已经展开。"); return this._result(true, "治疗旗生效，持续12秒。");
  }

  _spawn(owner, kind, nodeId, garrisoned) {
    const n = this._node(nodeId), base = owner === "ogre" ? OGRE : UNIT_TYPES[kind], at = this.navigation.atNode(nodeId);
    const multiplier = owner === "ogre" ? 1 : LEVEL_MULTIPLIER[n.level] || 1;
    const u = { id: `u${this.nextUnit++}`, owner, kind, x: n.x, y: n.y, hp: base.hp * multiplier, maxHp: base.hp * multiplier, damage: base.damage * multiplier, soldiers: base.soldiers, nodeId, garrisoned, visualAction: garrisoned ? "garrison" : "idle", facing: 1, route: [], locked: false, inCombat: false, routeIndex: 0, cooldown: 0, attackStartedAt: null, attackSerial: 0, roadId: at?.roadId || null, targetNodeId: null, garrisonTarget: null, defenseHome: null, meleeTarget: null };
    this.state.units.push(u); return u;
  }

  _movement(dt) {
    for (const u of this.state.units) {
      if (u.garrisoned || u.inCombat || u.routeIndex >= u.route.length) continue;
      u.visualAction = "move"; let travel = UNIT_TYPES[u.kind].speed * dt;
      while (travel > .001 && u.routeIndex < u.route.length) { const p = u.route[u.routeIndex], len = distance(u, p); if (len <= travel + .001) { u.x = p.x; u.y = p.y; travel -= len; u.routeIndex += 1; } else { const r = travel / len; u.facing = p.x >= u.x ? 1 : -1; u.x += (p.x - u.x) * r; u.y += (p.y - u.y) * r; travel = 0; } }
      const currentRoad = this.projectRoad(u.x, u.y); if (currentRoad) u.roadId = currentRoad.roadId;
      if (u.routeIndex >= u.route.length) this._arrive(u);
    }
  }

  _arrive(u) {
    u.route = []; u.routeIndex = 0; u.nodeId = u.targetNodeId; u.targetNodeId = null;
    if (u.garrisonTarget && this._node(u.garrisonTarget)?.owner === u.owner) { u.garrisoned = true; u.nodeId = u.garrisonTarget; u.garrisonTarget = null; }
    if (u.defenseHome) {
      const home = this._node(u.defenseHome);
      if (!home || home.owner !== u.owner || home.hp <= 0) u.defenseHome = null;
      else if (distance(u, home) < 5) { u.garrisoned = true; u.nodeId = home.id; u.defenseHome = null; }
    }
    const arrivedSite = u.nodeId && this._node(u.nodeId);
    if (arrivedSite && SITES.has(arrivedSite.kind) && arrivedSite.owner === u.owner && arrivedSite.hp > 0) {
      u.garrisoned = true;
      u.garrisonTarget = null;
    }
    const n = u.nodeId && this._node(u.nodeId); if (n?.kind === "chest" && n.owner === "neutral") { n.owner = u.owner; if (FACTIONS.includes(u.owner)) this.state.gold[u.owner] += 500; this._event("宝箱开启，获得500金币。"); }
  }

  _combat(dt) {
    const active = this.state.units.filter((u) => !u.garrisoned);
    const unitDamage = new Map(), nodeDamage = new Map(), engaged = new Set();
    for (const u of active) {
      u.cooldown = Math.max(0, u.cooldown - dt); const spec = u.owner === "ogre" ? OGRE : UNIT_TYPES[u.kind];
      const target = active.filter((v) => v.owner !== u.owner && distance(u, v) <= spec.range && this._roadContact(u, v, spec.range)).sort((a, b) => distance(u, a) - distance(u, b))[0];
      u.meleeTarget = target && spec.range <= 30 ? target.id : null;
      if (target) { engaged.add(u.id); u.inCombat = true; }
      if (target && u.cooldown <= 0) { this._startAttack(u, target); unitDamage.set(target.id, (unitDamage.get(target.id) || 0) + u.damage); u.cooldown = spec.interval; continue; }
      const n = u.owner === "ogre" ? null : this.state.nodes.find((x) => SITES.has(x.kind) && x.hp > 0 && x.owner !== u.owner && distance(u, x) <= spec.range + 24 && this._roadContact(u, x, spec.range + 24));
      if (n) { engaged.add(u.id); u.inCombat = true; }
      if (n && u.cooldown <= 0) { this._startAttack(u, n); nodeDamage.set(n.id, (nodeDamage.get(n.id) || 0) + u.damage); u.cooldown = spec.interval; }
    }
    for (const u of active) u.hp -= unitDamage.get(u.id) || 0;
    for (const n of this.state.nodes) n.hp = Math.max(0, n.hp - (nodeDamage.get(n.id) || 0));
    const casualties = this.state.units.filter((u) => u.hp <= 0);
    const dead = new Set(casualties.map((u) => u.id));
    for (const u of casualties) this.state.casualties.push({
      id: u.id, owner: u.owner, kind: u.kind, x: u.x, y: u.y, facing: u.facing,
        soldiers: Math.max(1,Math.ceil(u.soldiers * Math.min(1, (u.hp+(unitDamage.get(u.id)||0))/u.maxHp))), visualAction: "death", deathStartedAt: this.state.time,
      expiresAt: this.state.time + CASUALTY_LIFETIME,
    });
    this.state.units = this.state.units.filter((u) => u.hp > 0);
    for (const u of this.state.units) {
      if (dead.has(u.meleeTarget) || !this.state.units.some((v) => v.id === u.meleeTarget)) u.meleeTarget = null;
      u.locked = Boolean(u.meleeTarget);
      if (engaged.has(u.id)) { u.visualAction = "attack"; u.inCombat = true; }
    }
  }

  _defense() {
    for (const u of this.state.units.filter((x) => x.garrisoned)) { const home = this._node(u.nodeId), enemy = this.state.units.find((v) => !v.garrisoned && v.owner !== u.owner && distance(v, home) <= 170); if (enemy) { u.garrisoned = false; u.defenseHome = home.id; this._move(u.owner, [u.id], { x: enemy.x, y: enemy.y }, false); u.defenseHome = home.id; } }
    for (const u of this.state.units.filter((x) => x.defenseHome && !x.garrisoned && !x.meleeTarget)) {
      const home = this._node(u.defenseHome);
      if (!home || home.owner !== u.owner || home.hp <= 0) { u.defenseHome = null; continue; }
      const danger = this.state.units.some((v) => !v.garrisoned && v.owner !== u.owner && distance(v, home) <= 190);
      if (!danger && u.targetNodeId !== home.id) this._move(u.owner, [u.id], { nodeId: home.id }, false);
    }
  }

  _effects(dt) {
    for (const e of this.state.effects) { e.remaining -= dt; if (e.type === "heal") for (const u of this.state.units) if (u.owner === e.owner && distance(u, e) <= e.radius) u.hp = Math.min(u.maxHp, u.hp + 8 * dt); }
    this.state.effects = this.state.effects.filter((e) => e.remaining > 0);
  }

  _repair(dt) {
    for (const u of this.state.units) if (u.garrisoned) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .05 * dt);
    for (const n of this.state.nodes) {
      if (!SITES.has(n.kind) || n.hp <= 0 || n.hp >= n.maxHp) continue;
      const threatened = this.state.units.some((u) => !u.garrisoned && u.owner !== n.owner && distance(u, n) <= 190);
      if (!threatened) n.hp = Math.min(n.maxHp, n.hp + 2 * dt);
    }
  }

  _capture(dt) {
    for (const n of this.state.nodes.filter((x) => SITES.has(x.kind) && x.hp <= 0)) {
      const owners = [...new Set(this.state.units.filter((u) => !u.garrisoned && FACTIONS.includes(u.owner) && distance(u, n) <= 65).map((u) => u.owner))];
      if (owners.length !== 1) { n.captureProgress = 0; n.captureOwner = null; continue; }
      if (n.captureOwner !== owners[0]) { n.captureOwner = owners[0]; n.captureProgress = 0; } n.captureProgress += dt;
      if (n.captureProgress < 4 - .001) continue;
      n.owner = n.captureOwner; n.level = 1; n.maxHp = HP[n.kind]; n.hp = n.maxHp * .35; n.captureProgress = 0; n.captureOwner = null;
      for (const s of this.state.slots.filter((x) => x.hostId === n.id)) { s.owner = n.owner; s.building = null; } this._event(`${n.name}被占领。`);
      for (const u of this.state.units) {
        if (u.owner !== n.owner || u.nodeId !== n.id || u.route.length || u.targetNodeId) continue;
        u.garrisoned = true;
        u.garrisonTarget = null;
        u.defenseHome = null;
      }
    }
  }

  _ai() {
    for (const owner of ["enemy", "rival"]) {
      const sites = this.state.nodes.filter((n) => n.owner === owner && SITES.has(n.kind) && n.hp > 0);
      for (const n of sites) { const kind = ALLOWED[n.kind].find((k) => this.recruitQuote(n.id, k, owner).ok); if (kind && this.state.units.filter((u) => u.owner === owner).length < 8) this._recruit(owner, n.id, kind, true); }
      const slot = this.state.slots.find((s) => s.owner === owner && !s.building && this._node(s.hostId)?.hp > 0); if (slot) this._build(owner, slot.id, this.population(owner).cap - this.population(owner).used < 2 ? "farm" : "mine", true);
      const ready = this.state.units.filter((u) => u.owner === owner && !u.meleeTarget && (u.garrisoned || (!u.route.length && !u.defenseHome))), from = ready[0] || sites[0];
      const target = from && this.state.nodes.filter((n) => SITES.has(n.kind) && n.owner !== owner).sort((a, b) => distance(from, a) - distance(from, b))[0];
      if (ready.length > 1 && target) this._move(owner, ready.slice(0, 2).map((u) => u.id), { nodeId: target.id }, false);
    }
  }

  _winner() {
    const alive = FACTIONS.filter((f) => this.state.nodes.some((n) => SITES.has(n.kind) && n.owner === f && n.hp > 0));
    if (!alive.includes("player")) this.state.winner = "enemy"; else if (alive.length === 1) this.state.winner = "player";
    if (this.state.winner && !this.ended) { this.ended = true; this._event(this.state.winner === "player" ? "胜利！" : "战败。" ); }
  }
  _roadContact(a, b, range) {
    const pa = this.navigation.project(a.x, a.y), pb = this.navigation.project(b.x, b.y);
    if (!pa || !pb || pa.distanceToInput > 28 || pb.distanceToInput > 28) return false;
    if (pa.roadId === pb.roadId) return true;
    return this.state.nodes.some((n) => distance(a, n) <= range + 24 && distance(b, n) <= range + 24);
  }
  _startAttack(unit, target) {
    unit.visualAction = "attack";
    unit.attackStartedAt = this.state.time;
    unit.attackSerial = (unit.attackSerial || 0) + 1;
    if (target.x !== unit.x) unit.facing = target.x >= unit.x ? 1 : -1;
  }
  _node(id) { return this.state.nodes.find((n) => n.id === id); }
  _event(text) { this.state.events.push({ time: this.state.time, text }); if (this.state.events.length > 40) this.state.events.shift(); }
  _result(ok, message) { return { ok, message }; }
}
