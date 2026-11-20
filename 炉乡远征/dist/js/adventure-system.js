import { ADVENTURE_CARDS, getAdventureDefinition } from './adventure-content.js';

const copy = (v) => JSON.parse(JSON.stringify(v));
const integer = (n, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(n) && n >= min && n <= max;
const exact = (v, keys) =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).sort().join(',') === keys.split(',').sort().join(',');
const man = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const live = (s, id) => s.units.find((u) => u.unitId === id && u.health > 0);
const general = (s, o) =>
  s.units.find((u) => u.owner === o && u.cardId === s.players[o]?.generalId && u.health > 0);
const at = (s, c) => s.units.find((u) => u.x === c.x && u.y === c.y && u.health > 0);
const inside = (s, c) =>
  integer(c?.x, 0, s.board.columns - 1) && integer(c?.y, 0, s.board.rows - 1);
const wall = (s, c) => s.board.tiles.some((t) => t.type === 'wall' && t.x === c.x && t.y === c.y);
const cells = (s) =>
  Array.from({ length: s.board.rows * s.board.columns }, (_, i) => ({
    x: i % s.board.columns,
    y: Math.floor(i / s.board.columns),
  }));
const sortCell = (a, b) => a.y - b.y || a.x - b.x;
const friendIds = [9201, 9202, 9203, 9204];
const abilities = {
  9201: { id: 'chain-lightning', cost: 1, type: 'unit' },
  9202: { id: 'arcane-beam', cost: 2, type: 'direction' },
  9203: { id: 'black-hole', cost: 2, type: 'cell' },
  9204: { id: 'meteor', cost: 3, type: 'cell' },
};
const directions = {
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
  north: { x: 0, y: -1 },
};
const actions = new WeakMap();

// Supercover: a diagonal crossing inspects both corner cells, never threads a wall.
export function adventureLineOfSight(s, a, b) {
  let x = a.x,
    y = a.y,
    ix = 0,
    iy = 0;
  const nx = Math.abs(b.x - x),
    ny = Math.abs(b.y - y),
    sx = Math.sign(b.x - x),
    sy = Math.sign(b.y - y);
  while (ix < nx || iy < ny) {
    const decision = (1 + 2 * ix) * ny - (1 + 2 * iy) * nx;
    if (decision === 0) {
      if (wall(s, { x: x + sx, y }) || wall(s, { x, y: y + sy })) return false;
      x += sx;
      y += sy;
      ix++;
      iy++;
    } else if (decision < 0) {
      x += sx;
      ix++;
    } else {
      y += sy;
      iy++;
    }
    if (wall(s, { x, y })) return false;
  }
  return true;
}
export const adventureIdentityLocked = (s, u) =>
  !!s.adventure &&
  !!u &&
  (s.adventure.units.some((q) => q.unitId === u.unitId) ||
    s.adventure.sources.some((q) => q.unitId === u.unitId));
export const adventureRooted = (s, u) =>
  !!s.adventure &&
  !!u &&
  ((!!s.adventure.config.boss && u.cardId === s.players[1]?.generalId) || u.cardId === 9231);
export function adventureBeginAction(s) {
  if (s.adventure && !actions.has(s)) actions.set(s, []);
}
function step(s, value) {
  const list = actions.get(s);
  if (list) list.push({ ...copy(value), sequence: list.length });
}
export function adventureFinishAction(s) {
  if (!s.adventure) return;
  adventureSync(s);
  const a = s.adventure,
    g = general(s, 1),
    def = a.config;
  if (g && !a.phase && def.boss && g.health <= def.boss.threshold) {
    a.phase = 1;
    g.attack = def.boss.attack2 ?? 5;
    step(s, { kind: 'phase', phase: 1, unitId: g.unitId });
  }
  if (s.phase === 'over') {
    a.events = [];
    a.pending = [];
  }
  const steps = actions.get(s);
  if (steps?.length && s.lastAction) s.lastAction.steps = steps;
  actions.delete(s);
}
export function initAdventure(s, api) {
  const def = getAdventureDefinition(s.levelId);
  if (!def) return;
  const a = (s.adventure = {
    version: 1,
    revision: def.revision,
    levelId: s.levelId,
    config: copy(def),
    units: [],
    reserves: {},
    pending: [],
    sources: [],
    events: [],
    nextEvent: 1,
    phase: 0,
    center: 0,
    nextKind: 'gravity',
    deployments: 0,
  });
  for (const d of def.allies ?? []) {
    const u = api.summon(d.cardId, 0, d.x, d.y, {
      token: true,
      skipOpening: true,
      encounterBody: true,
    });
    if (!u) throw Error('冒险友军落点无效');
    u.moved = u.attacked = u.summonedThisTurn = false;
    u.movesUsed = u.attacksUsed = 0;
    a.units.push({ unitId: u.unitId, cardId: u.cardId, usedTurn: -1, charge: d.charge ?? 0 });
    a.reserves[u.cardId] = 1;
  }
  for (const d of def.sources ?? []) {
    const u = api.summon(d.cardId, 1, d.x, d.y, {
      token: true,
      skipOpening: true,
      encounterBody: true,
    });
    if (!u) throw Error('冒险来源落点无效');
    a.sources.push({ unitId: u.unitId, closed: false });
  }
}
function chain(s, origin, first, reflection = false) {
  const path = [],
    seen = new Set([origin.unitId]);
  let node = first;
  while (node && path.length < (reflection ? 3 : 4)) {
    path.push({
      unitId: node.unitId,
      x: node.x,
      y: node.y,
      owner: node.owner,
      cardId: node.cardId,
    });
    seen.add(node.unitId);
    const previous = node;
    node = s.units
      .filter(
        (u) =>
          u.health > 0 &&
          !seen.has(u.unitId) &&
          (reflection
            ? u.owner !== origin.owner
            : u.owner !== origin.owner || (!u.silenced && [9201, 9202].includes(u.cardId))) &&
          man(previous, u) <= 2 &&
          adventureLineOfSight(s, previous, u),
      )
      .sort(
        (a, b) =>
          man(previous, a) - man(previous, b) ||
          (a.owner === origin.owner) - (b.owner === origin.owner) ||
          a.unitId - b.unitId,
      )[0];
  }
  return path;
}
function hit(s, u, n, api, context = {}) {
  if (s.phase === 'over' || !live(s, u?.unitId)) return;
  const amount = api.damage(u, n, {
    sourceOwner: context.sourceOwner ?? 0,
    adventure: true,
    ...context,
  });
  step(s, {
    kind: 'hit',
    unitId: u.unitId,
    cell: { x: u.x, y: u.y },
    amount,
    sourceId: context.sourceId ?? null,
  });
}
function runChain(s, origin, path, api) {
  let from = { x: origin.x, y: origin.y };
  for (const p of path) {
    if (s.phase === 'over') break;
    step(s, { kind: 'chain', from, to: { x: p.x, y: p.y }, unitId: p.unitId });
    from = { x: p.x, y: p.y };
    const u = live(s, p.unitId);
    if (!u) continue;
    if (u.owner !== origin.owner)
      hit(s, u, 3, api, { sourceOwner: origin.owner, sourceId: origin.unitId });
    else if (u.cardId === 9202 && !u.silenced) {
      const q = s.adventure.units.find((q) => q.unitId === u.unitId);
      if (q) {
        q.charge = Math.min(2, q.charge + 1);
        step(s, { kind: 'charge', unitId: u.unitId, charge: q.charge });
      }
    }
  }
}
export function adventureIncomingDamage(s, u, n, context, api) {
  if (
    !s.adventure ||
    !context.stormStrike ||
    u.silenced ||
    u.owner !== 0 ||
    ![9201, 9202].includes(u.cardId)
  )
    return n;
  step(s, { kind: 'absorb', unitId: u.unitId, cell: { x: u.x, y: u.y } });
  if (u.cardId === 9202) {
    const q = s.adventure.units.find((q) => q.unitId === u.unitId);
    if (q) {
      q.charge = Math.min(2, q.charge + 1);
      step(s, { kind: 'charge', unitId: u.unitId, charge: q.charge });
    }
  } else {
    const first = s.units
      .filter(
        (v) =>
          v.owner !== u.owner && v.health > 0 && man(u, v) <= 3 && adventureLineOfSight(s, u, v),
      )
      .sort((a, b) => man(u, a) - man(u, b) || a.unitId - b.unitId)[0];
    if (first) runChain(s, u, chain(s, u, first, true), api);
  }
  return 0;
}
function ray(s, u, d, limit = 7) {
  const delta = directions[d],
    out = [];
  if (!delta) return out;
  for (let i = 1; i <= limit; i++) {
    const c = { x: u.x + i * delta.x, y: u.y + i * delta.y };
    if (!inside(s, c) || wall(s, c)) break;
    out.push(c);
  }
  return out;
}
function pull(s, center, rounds, api, boss = false) {
  for (let round = 0; round < rounds && s.phase !== 'over'; round++) {
    const targets = s.units
      .filter(
        (u) =>
          u.health > 0 &&
          cheb(u, center) <= 2 &&
          !adventureRooted(s, u) &&
          (boss || (u.owner !== 0 && api.rule(u)?.type === 'unit')),
      )
      .sort((a, b) => man(a, center) - man(b, center) || a.unitId - b.unitId);
    for (const u of targets) {
      if (s.phase === 'over' || !live(s, u.unitId)) break;
      const choices = [
        { x: u.x + 1, y: u.y },
        { x: u.x - 1, y: u.y },
        { x: u.x, y: u.y + 1 },
        { x: u.x, y: u.y - 1 },
      ]
        .filter((c) => inside(s, c) && !wall(s, c) && !at(s, c) && man(c, center) < man(u, center))
        .sort(sortCell);
      if (!choices.length) {
        step(s, { kind: 'blocked', unitId: u.unitId, cell: { x: u.x, y: u.y }, round });
        continue;
      }
      const from = { x: u.x, y: u.y };
      Object.assign(u, choices[0]);
      step(s, { kind: 'move', unitId: u.unitId, from, to: choices[0], round });
    }
    api.refresh();
  }
}
function meteorCells(s, c) {
  return cells(s)
    .filter((p) => cheb(p, c) <= 1)
    .sort((a, b) => (man(a, c) === 0 ? -1 : man(b, c) === 0 ? 1 : sortCell(a, b)));
}
function areaDamage(s, positions, api, damage, owner = 1, friendly = false) {
  const targets = positions.map((c) => ({ c, id: at(s, c)?.unitId }));
  for (const { c, id } of targets) {
    if (s.phase === 'over') break;
    const u = live(s, id);
    if (u && (friendly || u.owner !== owner))
      hit(s, u, typeof damage === 'function' ? damage(c) : damage, api, { sourceOwner: owner });
  }
}
function baseAvailability(s, u, q) {
  if (!s.adventure || !u || !q) return '不是可操作的关卡友军';
  if (s.phase !== 'playing' || s.currentPlayer !== 0 || u.owner !== 0) return '尚未轮到玩家行动';
  if (u.silenced) return '已沉默';
  if (u.stunTurns || u.summonedThisTurn) return '当前不能行动';
  if (q.usedTurn === s.players[0].turnsStarted) return '本回合已使用';
  if (u.attacked) return '没有攻击机会';
  if (s.players[0].mana < (abilities[u.cardId]?.cost ?? Infinity)) return '法力不足';
  return '';
}
export function adventureAbilityOptions(s, unitId) {
  const u = live(s, unitId),
    q = s.adventure?.units.find((q) => q.unitId === unitId),
    def = abilities[u?.cardId];
  if (!def)
    return { available: false, reason: '没有关卡技能', unitIds: [], cells: [], directions: [] };
  const options = {
    abilityId: def.id,
    cost: def.cost,
    type: def.type,
    charge: q?.charge ?? 0,
    used: q?.usedTurn === s.players[0].turnsStarted,
    unitIds: [],
    cells: [],
    directions: [],
    available: false,
    reason: baseAvailability(s, u, q),
  };
  if (def.type === 'unit')
    options.unitIds = s.units
      .filter(
        (v) =>
          v !== u &&
          v.health > 0 &&
          (v.owner !== u.owner || (!v.silenced && [9201, 9202].includes(v.cardId))) &&
          man(u, v) <= 3 &&
          adventureLineOfSight(s, u, v),
      )
      .map((v) => v.unitId);
  if (def.type === 'direction')
    options.directions = Object.keys(directions).filter((d) =>
      ray(s, u, d).some((c) => at(s, c)?.owner === 1),
    );
  if (def.type === 'cell')
    options.cells = cells(s).filter(
      (c) =>
        !wall(s, c) &&
        man(u, c) <= (u.cardId === 9203 ? 4 : 5) &&
        adventureLineOfSight(s, u, c) &&
        s.units.some(
          (v) =>
            v.owner === 1 &&
            v.health > 0 &&
            (u.cardId === 9204
              ? cheb(v, c) <= 1
              : !adventureRooted(s, v) &&
                ADVENTURE_CARDS[v.cardId]?.type !== 'general' &&
                cheb(v, c) <= 2 &&
                [
                  { x: v.x + 1, y: v.y },
                  { x: v.x - 1, y: v.y },
                  { x: v.x, y: v.y + 1 },
                  { x: v.x, y: v.y - 1 },
                ].some((p) => inside(s, p) && !wall(s, p) && !at(s, p) && man(p, c) < man(v, c))),
        ),
    );
  options.available =
    !options.reason &&
    (options.unitIds.length > 0 || options.cells.length > 0 || options.directions.length > 0);
  if (!options.available && !options.reason) options.reason = '没有合法目标';
  return options;
}
export function executeAdventureAbility(s, command, api) {
  const u = live(s, command?.unitId),
    q = s.adventure?.units.find((q) => q.unitId === u?.unitId),
    options = adventureAbilityOptions(s, u?.unitId);
  if (
    !options.available ||
    command.abilityId !== options.abilityId ||
    command.revision !== s.revision
  )
    return { ok: false, reason: options.reason || '战局已变化' };
  let path,
    positions,
    targetIds = [],
    c = command.cell;
  if (options.type === 'unit') {
    const id = command.targetId ?? command.targetUnitId;
    if (!options.unitIds.includes(id)) return { ok: false, reason: '无效传导目标' };
    path = chain(s, u, live(s, id));
    targetIds = path.map((p) => p.unitId);
  }
  if (options.type === 'direction') {
    if (!options.directions.includes(command.direction))
      return { ok: false, reason: '该方向没有敌军' };
    positions = ray(s, u, command.direction);
    targetIds = positions
      .map((p) => at(s, p))
      .filter((v) => v?.owner !== u.owner && v)
      .map((v) => v.unitId);
  }
  if (options.type === 'cell' && !options.cells.some((p) => p.x === c?.x && p.y === c?.y))
    return { ok: false, reason: '落点不可见或超出范围' };
  if (u.cardId === 9204) {
    positions = meteorCells(s, c);
    targetIds = positions
      .map((p) => at(s, p))
      .filter((v) => v && v.owner !== u.owner)
      .map((v) => v.unitId);
    if (!targetIds.length) return { ok: false, reason: '范围内没有敌人' };
  }
  if (u.cardId === 9203) {
    const possible = s.units.some(
      (v) =>
        v.owner !== 0 &&
        api.rule(v)?.type === 'unit' &&
        !adventureRooted(s, v) &&
        cheb(v, c) <= 2 &&
        [
          { x: v.x + 1, y: v.y },
          { x: v.x - 1, y: v.y },
          { x: v.x, y: v.y + 1 },
          { x: v.x, y: v.y - 1 },
        ].some((p) => inside(s, p) && !wall(s, p) && !at(s, p) && man(p, c) < man(v, c)),
    );
    if (!possible) return { ok: false, reason: '没有敌人可被牵引' };
  }
  s.players[0].mana -= options.cost;
  q.usedTurn = s.players[0].turnsStarted;
  u.attacksUsed = (u.attacksUsed ?? 0) + 1;
  u.attacked = u.attacksUsed >= api.quota(u);
  step(s, {
    kind: 'cast',
    abilityId: options.abilityId,
    unitId: u.unitId,
    cell: c ?? null,
    direction: command.direction ?? null,
  });
  if (u.cardId === 9201) runChain(s, u, path, api);
  if (u.cardId === 9202) {
    const damage = q.charge === 2 ? 10 : 6;
    if (q.charge === 2) q.charge = 0;
    step(s, { kind: 'beam', unitId: u.unitId, from: { x: u.x, y: u.y }, cells: positions, damage });
    areaDamage(s, positions, api, damage, 0);
  }
  if (u.cardId === 9203) pull(s, c, 2, api);
  if (u.cardId === 9204) {
    step(s, { kind: 'meteor', cell: c, cells: positions });
    areaDamage(s, positions, api, (p) => (p.x === c.x && p.y === c.y ? 10 : 6), 0);
  }
  api.refresh();
  s.lastAction = {
    kind: 'adventure',
    effect: options.abilityId,
    cardId: u.cardId,
    sourceId: u.unitId,
    targetIds,
    cell: c ?? null,
    statChanges: [],
  };
  return { ok: true, cost: options.cost, cells: positions ?? [], targetIds };
}
export function adventureDeath(s, u) {
  const a = s.adventure;
  if (!a) return;
  const q = a.units.find((q) => q.unitId === u.unitId);
  if (q && s.phase !== 'over' && a.reserves[q.cardId] > 0) {
    a.reserves[q.cardId] = 0;
    a.pending.push({ cardId: q.cardId, due: s.players[0].turnsStarted + 1 });
  }
  adventureSync(s);
}
export function adventureSync(s) {
  const a = s.adventure;
  if (!a) return;
  for (const source of a.sources) {
    const u = live(s, source.unitId);
    if (!u || u.silenced || u.owner !== 1 || u.cardId !== 9231) source.closed = true;
  }
  a.events = a.events
    .map((e) => ({
      ...e,
      sources: e.sources.filter((id) => !a.sources.find((q) => q.unitId === id)?.closed),
    }))
    .filter((e) => !e.bound || e.sources.length);
  if (s.phase === 'over') {
    a.events = [];
    a.pending = [];
  }
}
function event(s, kind, positions, extra = {}) {
  if (!positions.length) return;
  const a = s.adventure;
  a.events.push({
    id: a.nextEvent++,
    kind,
    cells: positions.map((c) => ({ x: c.x, y: c.y })),
    due: s.players[1].turnsStarted + 1,
    damage: 0,
    rounds: 0,
    sources: [],
    bound: false,
    ...extra,
  });
}
const playerTargets = (s) => s.units.filter((u) => u.owner === 0 && u.health > 0);
const strongest = (s, ordinary = false) =>
  playerTargets(s)
    .filter(
      (u) => u.cardId !== s.players[0].generalId && (!ordinary || !friendIds.includes(u.cardId)),
    )
    .sort(
      (a, b) => b.attack + b.attackBuff - (a.attack + a.attackBuff) || a.unitId - b.unitId,
    )[0] ?? general(s, 0);
const charged = (s) =>
  s.adventure.units
    .map((q) => ({ q, u: live(s, q.unitId) }))
    .filter((v) => v.u?.cardId === 9202)
    .sort((a, b) => b.q.charge - a.q.charge || a.u.unitId - b.u.unitId)[0]?.u;
function line3(s, c, vertical) {
  const n = vertical ? s.board.rows : s.board.columns,
    start = Math.max(0, Math.min(n - 3, (vertical ? c.y : c.x) - 1));
  return [0, 1, 2].map((i) => (vertical ? { x: c.x, y: start + i } : { x: start + i, y: c.y }));
}
export function adventureTurnEnd(s, owner, api) {
  const a = s.adventure;
  if (!a || owner !== 1 || s.phase === 'over') return;
  adventureSync(s);
  const turn = s.players[1].turnsStarted,
    g = general(s, 1),
    pg = general(s, 0),
    script = a.config.script;
  if (!g || !pg) return;
  const strike = (target, damage, sources = []) =>
    target && event(s, 'stormStrike', [target], { damage, sources, bound: sources.length > 0 });
  if (script === 'storm01' && [1, 3, 5].includes(turn)) strike(strongest(s, true), 3);
  if (script === 'storm02' && [2, 4, 6].includes(turn))
    event(s, 'beam', ray(s, g, pg.x < g.x ? 'west' : 'east', 20), { damage: 6 });
  if (script === 'storm03') {
    if (turn % 3 === 0) {
      const d = Object.keys(directions)
        .map((d) => ({ d, c: ray(s, g, d, 20) }))
        .sort(
          (a, b) =>
            b.c.filter((c) => at(s, c)?.owner === 0).length -
            a.c.filter((c) => at(s, c)?.owner === 0).length,
        )[0];
      event(s, 'beam', d.c.some((c) => at(s, c)?.owner === 0) ? d.c : ray(s, g, 'west', 20), {
        damage: 7,
      });
    } else {
      strike(pg, 4);
      if (a.phase) {
        const other = playerTargets(s)
          .filter((u) => u !== pg)
          .sort(
            (u, v) => v.attack + v.attackBuff - (u.attack + u.attackBuff) || u.unitId - v.unitId,
          )[0];
        if (other) strike(other, 4);
      }
    }
  }
  if (script === 'storm06')
    event(s, 'stormStrike', line3(s, pg, turn % 2 === 0), { damage: a.phase ? 5 : 4 });
  if (script === 'storm08' && [1, 3, 5].includes(turn)) strike(charged(s) ?? pg, 3);
  if (script === 'storm09') {
    if (turn % 3 === 0) {
      // The boss owns this telegraph independently of its optional power sources.
      // It replaces all source strikes for this turn, preserving a full response
      // window without adding a third simultaneous danger group.
      const best = Object.keys(directions)
        .map((direction) => ({ cells: ray(s, g, direction, 20) }))
        .sort(
          (a, b) =>
            b.cells.filter((cell) => at(s, cell)?.owner === 0).length -
            a.cells.filter((cell) => at(s, cell)?.owner === 0).length,
        )[0];
      const positions = best.cells.some((cell) => at(s, cell)?.owner === 0)
        ? best.cells
        : ray(s, g, 'west', 20);
      event(s, 'beam', positions, { damage: a.phase ? 8 : 6 });
    } else {
      for (let i = 0; i < a.sources.length; i++) {
        const src = a.sources[i];
        if (src.closed || (!a.phase && (turn % 2 === 1) !== (i === 0))) continue;
        strike(i === 0 ? (charged(s) ?? strongest(s)) : pg, 4, [src.unitId]);
      }
    }
  }
  if (script === 'starfall03' || script === 'starfall09') {
    const centers =
        script === 'starfall03'
          ? [
              { x: 5, y: 1 },
              { x: 6, y: 3 },
              { x: 5, y: 5 },
            ]
          : [
              { x: 3, y: 1 },
              { x: 5, y: 3 },
              { x: 8, y: 3 },
            ],
      c = centers[a.center];
    if (a.nextKind === 'gravity') {
      event(
        s,
        'gravity',
        cells(s).filter((p) => cheb(p, c) <= 2),
        { center: c, rounds: a.phase ? 2 : 1 },
      );
      a.nextKind = 'meteor';
    } else {
      event(s, 'meteor', meteorCells(s, c), { center: c, damage: a.phase ? 6 : 4 });
      a.nextKind = 'gravity';
    }
  }
  if (script === 'starfall06') {
    const c = { x: 5, y: turn % 2 ? 1 : 5 };
    event(s, 'meteor', meteorCells(s, c), { center: c, damage: a.phase ? 6 : 4 });
  }
  // A merged strike keeps every live source: removing one cannot cancel another.
  const merged = [];
  for (const e of a.events) {
    const previous =
      e.kind === 'stormStrike' &&
      e.bound &&
      merged.find(
        (v) =>
          v.kind === e.kind &&
          v.bound &&
          v.due === e.due &&
          JSON.stringify(v.cells) === JSON.stringify(e.cells),
      );
    if (previous) previous.sources.push(...e.sources);
    else merged.push(e);
  }
  a.events = merged;
}
export function adventureTurnStart(s, owner, api) {
  const a = s.adventure;
  if (!a || s.phase === 'over') return;
  adventureSync(s);
  if (owner === 0) {
    for (const p of [...a.pending]) {
      if (p.due > s.players[0].turnsStarted) continue;
      const g = general(s, 0),
        pos =
          g &&
          cells(s)
            .filter((c) => cheb(c, g) === 1 && !wall(s, c) && !at(s, c))
            .sort(sortCell)[0];
      if (!pos) continue;
      const u = api.summon(p.cardId, 0, pos.x, pos.y, {
        token: true,
        skipOpening: true,
        encounterBody: true,
      });
      if (!u) continue;
      u.moved = u.attacked = u.summonedThisTurn = true;
      u.movesUsed = u.attacksUsed = 1;
      a.units.push({ unitId: u.unitId, cardId: u.cardId, usedTurn: -1, charge: 0 });
      a.pending.splice(a.pending.indexOf(p), 1);
      step(s, { kind: 'reserve', unitId: u.unitId, cardId: u.cardId, cell: pos });
    }
    return;
  }
  a.deployments = 0;
  const due = a.events
    .filter((e) => e.due <= s.players[1].turnsStarted)
    .sort((a, b) => a.id - b.id);
  a.events = a.events.filter((e) => !due.includes(e));
  let advance = false;
  for (const e of due) {
    if (s.phase === 'over') break;
    adventureSync(s);
    if (e.bound && !e.sources.some((id) => !a.sources.find((q) => q.unitId === id)?.closed))
      continue;
    step(s, { kind: 'event', eventKind: e.kind, cells: e.cells, center: e.center ?? null });
    if (e.kind === 'gravity') pull(s, e.center, e.rounds, api, true);
    else if (e.kind === 'stormStrike') {
      const targets = e.cells.map((c) => at(s, c)?.unitId);
      for (const id of targets) {
        if (s.phase === 'over') break;
        const u = live(s, id);
        if (u?.owner === 0) hit(s, u, e.damage, api, { sourceOwner: 1, stormStrike: true });
      }
    } else {
      areaDamage(s, e.cells, api, e.damage, 1, e.kind === 'meteor');
      if (e.kind === 'meteor' && ['starfall03', 'starfall09'].includes(a.config.script))
        advance = true;
    }
  }
  // Stage boundary is the whole due batch, before ordinary enemy actions.
  const g = general(s, 1);
  if (g && !a.phase && a.config.boss && g.health <= a.config.boss.threshold) {
    a.phase = 1;
    g.attack = a.config.boss.attack2 ?? 5;
    step(s, { kind: 'phase', phase: 1, unitId: g.unitId });
  }
  if (advance && s.phase !== 'over') {
    const order = a.config.script === 'starfall09' && a.phase ? [0, 2, 1] : [0, 1, 2];
    a.center = order[(order.indexOf(a.center) + 1) % 3];
  }
}
export function adventureMarkers(s) {
  const a = s?.adventure;
  if (!a) return [];
  return a.events.flatMap((e) =>
    e.cells.map((c, i) => ({
      ...c,
      eventId: e.id,
      showLabel: e.center ? c.x === e.center.x && c.y === e.center.y : i === 0,
      kind: e.kind === 'gravity' ? 'gravity' : 'damage',
      amount: e.damage,
      remaining: Math.max(0, e.due - s.players[1].turnsStarted),
      owner: 1,
      intent: e.kind,
      marked: true,
    })),
  );
}
const scheduleRules = {
  storm01: '敌方第1、3、5次行动结束锁定最高攻击随从格，无随从则锁定主将；下次敌方行动开始雷击3伤。',
  storm02:
    '敌方第2、4、6次行动结束预告所在横排、朝玩家主将一侧的光束；下次行动开始各玩家目标6伤，墙阻断。',
  storm03:
    '敌方每次行动结束锁定玩家主将格雷击4伤；第3次及其倍数改为命中玩家最多的正交射线7伤，同数按东南西北。27血及以下攻击5，雷击轮追加最高攻击随从格。',
  storm06:
    '敌方行动结束交替预告主将格横向、纵向连续3格；下次行动开始雷击4伤。32血及以下，新预告5伤、普通攻击5。',
  storm08:
    '敌方第1、3、5次行动结束锁定充能最高的存活炮格，同充能按单位ID；无炮则主将。下次行动开始雷击3伤。',
  storm09:
    '上供能源奇数敌回合末锁定充能最高炮格，无炮选攻击最高随从、再回退主将；下供能源偶数回合锁主将。下次敌回合开始雷击4伤；击败或驱散对应电源取消其预告。第3、6、9等敌回合末改为Boss独立重炮，取命中玩家最多的正交方向至边界，墙阻断，同数按东南西北、无目标朝西，下次敌回合开始各玩家目标6伤，不能吸收充能，拆电源不取消。40血及以下新重炮8伤、普通攻击6；非重炮轮双电源各预告，同格只击中一次。',
  starfall03:
    '中心依次为(5,1)→(6,3)→(5,5)。每处先预告半径2牵引一轮，再预告3×3陨击4伤，均在下一敌回合开始兑现，敌我同伤。28血及以下新预告牵引两轮、陨击6伤、普通攻击5；当前中心先完成陨击。',
  starfall06:
    '每次敌方行动结束依次预告(5,1)、(5,5)的3×3陨击，下一敌回合开始各格4伤，敌我同伤。36血及以下，新预告6伤、普通攻击5。',
  starfall09:
    '中心依次A(3,1)→B(5,3)→C(8,3)。每处先预告半径2牵引一轮，再预告3×3陨击4伤；下一敌回合开始兑现，敌我同伤，C可伤Boss。36血及以下新预告牵引两轮、陨击6伤、普通攻击6；当前中心完成陨击后按A→C→B循环。',
};
const skillRules = {
  9201: '连锁放电：1法力，首目标曼哈顿3格，随后每跳2格，最多4节点，敌人各3伤。未沉默的友方导雷卫中继、棱晶炮充能1；墙和墙角阻断。链路锁定，死亡节点不改后续路径。敌方预告雷击可吸收，向3格内最近敌人反射、随后2格内连跳，最多3敌人。',
  9202: '贯穿炮：2法力，正交7格，墙阻断，敌人各6伤、友军安全；2充能时自动过载10伤并耗尽，1充能普射保留。连锁或敌方预告雷击每次充能1，上限2，未沉默时吸收敌雷。',
  9203: '引力井：2法力，曼哈顿4格内可见中心，切比雪夫半径2，牵引敌方普通随从两轮，每轮正交一步。近者先动，同距按单位ID；候选格按行列，墙和占位阻挡。主将与锚定实体不受玩家牵引。',
  9204: '陨星轰击：3法力，曼哈顿5格内可见中心，3×3中心10伤、外圈6伤、友军安全。墙阻断选中心视线，不阻断爆炸。可以伤害敌将。',
};
export function adventureRules(s) {
  if (!s?.adventure) return [];
  const a = s.adventure;
  return [
    {
      id: `adventure-${s.levelId}`,
      title: '关卡规则',
      text: scheduleRules[a.config.script] ?? '敌军依靠普通行动和有限牌库推进，没有额外灾害排程。',
    },
    {
      id: 'adventure-actions',
      title: '驻场与行动',
      text: '借用友军技能每回合限1次（消耗普攻，不触发反击）；沉默/冻结/召唤等待禁用。每种友军有1名后备，首次阵亡后下回合初从主将旁增援（不可复制/变形/回手）。',
    },
    ...[...new Set(a.config.allies.map((d) => d.cardId))].map((id) => ({
      id: `adventure-skill-${id}`,
      title: ADVENTURE_CARDS[id].name,
      text: skillRules[id],
    })),
  ];
}
export function adventureUnitInfo(s, u) {
  if (!s?.adventure || !u) return null;
  const q = s.adventure.units.find((q) => q.unitId === u.unitId);
  if (q)
    return {
      name: ADVENTURE_CARDS[q.cardId].name,
      label: '驻场单位',
      text: ADVENTURE_CARDS[q.cardId].description,
      charge: q.charge,
      remaining: s.adventure.reserves[q.cardId],
      remainingKind: 'reserve',
      rooted: false,
      used: q.usedTurn === s.players[0].turnsStarted,
    };
  if (u.cardId === 9231)
    return {
      name: '供能源',
      label: s.adventure.sources.find((q) => q.unitId === u.unitId)?.closed ? '关闭' : '供能',
      text: ADVENTURE_CARDS[9231].description,
      rooted: true,
    };
  if (u.cardId === s.players[1]?.generalId)
    return {
      name: s.players[1].name,
      label: s.adventure.phase ? '第二阶段' : '第一阶段',
      text: '预告锁定格子，下一敌方回合开始兑现。',
      rooted: adventureRooted(s, u),
    };
  return null;
}
export const adventureAnnouncement = () => null;
export function validateAdventureState(s) {
  try {
    const a = s.adventure,
      def = getAdventureDefinition(s.levelId);
    if (!a) return !def && !s.enemyPlan?.adventureVersion;
    if (
      !def ||
      s.schemaVersion !== 7 ||
      s.mode !== 'expedition' ||
      s.enemyPlan?.adventureVersion !== 1 ||
      s.enemyPlan.adventureRevision !== def.revision ||
      !exact(
        a,
        'version,revision,levelId,config,units,reserves,pending,sources,events,nextEvent,phase,center,nextKind,deployments',
      ) ||
      a.version !== 1 ||
      a.revision !== def.revision ||
      a.levelId !== s.levelId ||
      JSON.stringify(a.config) !== JSON.stringify(def) ||
      !integer(a.phase, 0, 1) ||
      !integer(a.center, 0, 2) ||
      !integer(a.deployments, 0, 2) ||
      !['gravity', 'meteor'].includes(a.nextKind) ||
      !integer(a.nextEvent, 1)
    )
      return false;
    const roles = [...new Set(def.allies.map((d) => d.cardId))];
    if (
      !exact(a.reserves, roles.join(',')) ||
      roles.some((id) => !integer(a.reserves[id], 0, 1)) ||
      !Array.isArray(a.units) ||
      a.units.length < def.allies.length ||
      a.units.length > def.allies.length + roles.length ||
      new Set(a.units.map((q) => q.unitId)).size !== a.units.length
    )
      return false;
    for (const q of a.units) {
      if (
        !exact(q, 'unitId,cardId,usedTurn,charge') ||
        !integer(q.unitId, 1) ||
        !roles.includes(q.cardId) ||
        !integer(q.usedTurn, -1, s.players[0].turnsStarted) ||
        !integer(q.charge, 0, q.cardId === 9202 ? 2 : 0)
      )
        return false;
      const u = live(s, q.unitId);
      if (u && (u.owner !== 0 || u.cardId !== q.cardId || !u.token)) return false;
    }
    for (const id of roles) {
      const initial = def.allies.filter((d) => d.cardId === id).length,
        total = a.units.filter((q) => q.cardId === id).length;
      if (total > initial + 1 || (a.reserves[id] === 1 && total !== initial)) return false;
    }
    if (
      !Array.isArray(a.pending) ||
      a.pending.length > roles.length ||
      new Set(a.pending.map((p) => p.cardId)).size !== a.pending.length ||
      a.pending.some(
        (p) =>
          !exact(p, 'cardId,due') ||
          !roles.includes(p.cardId) ||
          a.reserves[p.cardId] !== 0 ||
          !integer(p.due, 1, s.players[0].turnsStarted + 1),
      )
    )
      return false;
    if (
      !Array.isArray(a.sources) ||
      a.sources.length !== (def.sources ?? []).length ||
      a.sources.some(
        (q) =>
          !exact(q, 'unitId,closed') ||
          !integer(q.unitId, 1) ||
          typeof q.closed !== 'boolean' ||
          (!q.closed &&
            (!live(s, q.unitId) ||
              live(s, q.unitId).cardId !== 9231 ||
              live(s, q.unitId).owner !== 1 ||
              live(s, q.unitId).silenced)),
      )
    )
      return false;
    if (
      !Array.isArray(a.events) ||
      a.events.length > 2 ||
      new Set(a.events.map((e) => e.id)).size !== a.events.length
    )
      return false;
    for (const e of a.events) {
      const hasCenter = ['gravity', 'meteor'].includes(e.kind);
      if (
        !exact(e, `id,kind,cells,due,damage,rounds,sources,bound${hasCenter ? ',center' : ''}`) ||
        !integer(e.id, 1, a.nextEvent - 1) ||
        !['stormStrike', 'beam', 'gravity', 'meteor'].includes(e.kind) ||
        !integer(e.due, s.players[1].turnsStarted, s.players[1].turnsStarted + 1) ||
        !integer(e.damage, 0, 8) ||
        !integer(e.rounds, 0, 2) ||
        typeof e.bound !== 'boolean' ||
        !Array.isArray(e.sources) ||
        new Set(e.sources).size !== e.sources.length ||
        e.sources.some((id) => !a.sources.some((q) => q.unitId === id && !q.closed)) ||
        e.bound !== !!e.sources.length ||
        !Array.isArray(e.cells) ||
        !e.cells.length ||
        e.cells.length > 25 ||
        e.cells.some((c) => !exact(c, 'x,y') || !inside(s, c)) ||
        new Set(e.cells.map((c) => `${c.x},${c.y}`)).size !== e.cells.length ||
        (hasCenter && (!exact(e.center, 'x,y') || !inside(s, e.center)))
      )
        return false;
      if (e.kind === 'gravity' ? e.damage !== 0 || e.rounds < 1 : e.rounds !== 0 || e.damage < 1)
        return false;
    }
    const allowed =
      {
        storm01: ['stormStrike'],
        storm02: ['beam'],
        storm03: ['stormStrike', 'beam'],
        storm06: ['stormStrike'],
        storm08: ['stormStrike'],
        storm09: ['stormStrike', 'beam'],
        starfall03: ['gravity', 'meteor'],
        starfall06: ['meteor'],
        starfall09: ['gravity', 'meteor'],
      }[def.script] ?? [];
    for (const e of a.events) {
      if (
        !allowed.includes(e.kind) ||
        e.bound !== (def.script === 'storm09' && e.kind === 'stormStrike') ||
        e.due !== s.players[1].turnsStarted + 1
      )
        return false;
      if (e.kind === 'stormStrike') {
        const damages =
          def.script === 'storm01' || def.script === 'storm08'
            ? [3]
            : def.script === 'storm06'
              ? a.phase
                ? [4, 5]
                : [4]
              : [4];
        if (!damages.includes(e.damage) || e.cells.length !== (def.script === 'storm06' ? 3 : 1))
          return false;
        if (
          e.cells.length === 3 &&
          !(
            (e.cells.every((c) => c.y === e.cells[0].y) &&
              e.cells.every((c, i) => c.x === e.cells[0].x + i)) ||
            (e.cells.every((c) => c.x === e.cells[0].x) &&
              e.cells.every((c, i) => c.y === e.cells[0].y + i))
          )
        )
          return false;
      }
      if (e.kind === 'beam') {
        const allowedDamage =
          def.script === 'storm09'
            ? [6, ...(a.phase ? [8] : [])]
            : [def.script === 'storm02' ? 6 : 7];
        if (!allowedDamage.includes(e.damage)) return false;
        const first = e.cells[0],
          last = e.cells.at(-1);
        if (first.x !== last.x && first.y !== last.y) return false;
        const dx = Math.sign(last.x - first.x),
          dy = Math.sign(last.y - first.y);
        if (e.cells.some((c, i) => c.x !== first.x + dx * i || c.y !== first.y + dy * i))
          return false;
      }
      if (e.kind === 'meteor') {
        if (
          ![4, ...(a.phase ? [6] : [])].includes(e.damage) ||
          JSON.stringify(e.cells) !== JSON.stringify(meteorCells(s, e.center))
        )
          return false;
      }
      if (e.kind === 'gravity') {
        if (
          (e.rounds > 1 && !a.phase) ||
          JSON.stringify(e.cells) !== JSON.stringify(cells(s).filter((c) => cheb(c, e.center) <= 2))
        )
          return false;
      }
    }
    if (
      (!def.boss && a.phase !== 0) ||
      new Set([...a.units, ...a.sources].map((q) => q.unitId)).size !==
        a.units.length + a.sources.length
    )
      return false;
    if (s.phase === 'over' && (a.events.length || a.pending.length)) return false;
    for (const u of s.units)
      if (
        (friendIds.includes(u.cardId) && !a.units.some((q) => q.unitId === u.unitId)) ||
        (u.cardId === 9231 && !a.sources.some((q) => q.unitId === u.unitId))
      )
        return false;
    return true;
  } catch {
    return false;
  }
}
