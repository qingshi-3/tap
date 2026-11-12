// New archetype integration contract. Run: npx vite-node scripts/archetype-run-test.ts
// This suite uses the current public API, never the frozen balance snapshots.
import {
  newRun, trialFight, fight, settleBattle, save, load, saveStatus,
  SAVE_KEY, SAVE_VERSION, LEGACY_SAVE_KEY, type RunState,
  activeCardPool, searchPool, rebornPool, morphPool, reroll,
  buy, moveOwned, resolveEvent, useFood, pickDiscover, useHero,
  type Owned,
  payBlood, sell, ownedHp, endTurn, castHandSpell, HAND_BASE,
  STAT_CAP,
  autoSlot,
} from '../src/core/run';
import { card, SHOP_POOL, FOOD } from '../src/core/data';
import { ARCHETYPE_IDS, ruleNumber } from '../src/core/archetypes';
import { PREP_ARCHETYPES, BATTLE_ARCHETYPES } from '../src/core/archetypePool';
import { simulate } from '../src/core/engine';
import { focusUid } from '../src/core/demo';
import { battleTimeline } from '../src/ui/battleTimeline';

const failures: string[] = [];
let checks = 0;
function ok(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function same(actual: unknown, expected: unknown, message: string) {
  ok(JSON.stringify(actual) === JSON.stringify(expected), message);
}
function test(name: string, run: () => void) {
  checks++;
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failures.push(`${name}: ${String(error)}`); console.error(`FAIL ${name}: ${String(error)}`); }
}
const clone = <T>(value: T): T => structuredClone(value);
const owned = (r: RunState, def: string): Owned => ({ oid: r.nextId++, def, copies: 1, atkBonus: 0, hpBonus: 0 });
function fixture(archetype: (typeof ARCHETYPE_IDS)[number]) {
  for (let seed = 1; seed < 100; seed++) {
    const r = newRun(seed);
    if (r.activeArchetypes.includes(archetype)) { r.gold = 100; r.act = 2; r.tavern = 6; return r; }
  }
  throw new Error(`could not draw ${archetype}`);
}
function legalOptions(r: RunState) {
  const allowed = new Set(activeCardPool(r).map(c => c.id));
  for (const s of r.shop) if (s.kind === 'unit') ok(allowed.has(s.def), `shop leaked ${s.def}`);
  for (const d of r.discover ?? []) if (d.mode !== 'spell') {
    ok(new Set(d.opts).size === d.opts.length, 'duplicate discovery choice');
    for (const id of d.opts) ok(allowed.has(id), `${d.src} leaked ${id}`);
  }
}
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key),
  },
});

test('same seed reproduces complete opening state', () => {
  for (const seed of [1, 19, 2468, 99991]) same(newRun(seed), newRun(seed), `opening seed ${seed}`);
});

test('complete catalog has eleven eight-card archetypes and six utility cards', () => {
  ok(SHOP_POOL.length === 94, `expected 94 playable cards, got ${SHOP_POOL.length}`);
  ok(new Set(SHOP_POOL.map(c => c.id)).size === SHOP_POOL.length, 'duplicate card id');
  ok(SHOP_POOL.filter(c => !c.archetype).length === 6, 'utility card count');
  for (const id of ARCHETYPE_IDS) {
    const cards = SHOP_POOL.filter(c => c.archetype === id);
    ok(cards.length === 8, `${id} needs eight cards`);
    const roles = Object.fromEntries(['starter', 'engine', 'cover', 'terminal', 'bridge'].map(role => [role, cards.filter(c => c.role === role).length]));
    same(roles, { starter: 2, engine: 3, cover: 1, terminal: 1, bridge: 1 }, `${id} role distribution`);
  }
  for (const c of SHOP_POOL) for (const rule of c.rules ?? []) {
    for (const level of [1, 2]) {
      const n = ruleNumber(rule.n, level), hp = ruleNumber(rule.hp, level);
      ok(Number.isSafeInteger(n) && n >= 0 && Number.isSafeInteger(hp) && hp >= 0, `${c.id} invalid rule values`);
    }
    for (const limit of [rule.limit, rule.every]) ok(limit === undefined || Number.isSafeInteger(limit) && limit > 0, `${c.id} invalid trigger cap`);
  }
});

test('opening chooses six distinct archetypes including supply', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 80; seed++) {
    const r = newRun(seed);
    ok(r.activeArchetypes.length === 6 && new Set(r.activeArchetypes).size === 6, `bad draft at seed ${seed}`);
    ok(r.activeArchetypes.includes('supply'), 'supply missing');
    ok(r.activeArchetypes.every(id => ARCHETYPE_IDS.includes(id)), 'unknown archetype drawn');
    ok(PREP_ARCHETYPES.filter(id => r.activeArchetypes.includes(id)).length >= 2, 'too few prep archetypes');
    ok(BATTLE_ARCHETYPES.filter(id => r.activeArchetypes.includes(id)).length >= 2, 'too few battle archetypes');
    const bridges = new Set(SHOP_POOL.filter(c => c.archetype && c.bridge && r.activeArchetypes.includes(c.archetype) && r.activeArchetypes.includes(c.bridge))
      .map(c => [c.archetype!, c.bridge!].sort().join('/')));
    ok(bridges.size >= 2, `seed ${seed} has fewer than two bridge pairs`);
    seen.add(r.activeArchetypes.join(','));
    legalOptions(r);
  }
  ok(seen.size > 10, 'draft does not vary across seeds');
});

test('all public unit candidate pools and rerolls respect run draft', () => {
  for (const seed of [17, 38, 59, 80, 101]) {
    const r = newRun(seed);
    for (const act of [0, 1, 2]) {
      r.act = act;
      const allowed = new Set(activeCardPool(r).map(c => c.id));
      if (act < 2) ok(activeCardPool(r).every(c => c.role !== 'terminal'), 'terminal unlocked before act three');
      for (const c of SHOP_POOL) {
        const o = owned(r, c.id);
        for (const p of [searchPool(r, o), rebornPool(o, r), morphPool(o, r)])
          for (const option of p) ok(allowed.has(option.id), `${c.id} candidate leaked ${option.id}`);
      }
      for (let tier = 1; tier <= 6; tier++) {
        r.tavern = tier; r.gold = 100;
        for (let i = 0; i < 5; i++) { ok(reroll(r), 'reroll failed'); legalOptions(r); }
      }
    }
  }
});

test('discovery spells, hero, camp upgrade, morph and mercenary cannot escape draft', () => {
  for (const seed of [92, 103, 114]) {
    const base = newRun(seed, { hero: 'seer' }); base.tavern = 3; base.gold = 100;
    const def = activeCardPool(base).find(c => c.tier < 6)!.id;
    base.queue[0] = owned(base, def);
    for (const spell of ['x_search', 'x_recruit', 'x_draft', 'x_reborn']) {
      const r = clone(base), sid = r.nextId++;
      if (spell === 'x_search' || spell === 'x_reborn') {
        const candidate = activeCardPool(r).find(c => (spell === 'x_search' ? searchPool(r, owned(r, c.id)) : rebornPool(owned(r, c.id), r)).length > 0);
        ok(candidate, `no legal target for ${spell}`);
        r.queue[0] = owned(r, candidate.id);
      }
      r.shop.push({ sid, kind: 'food', def: spell, locked: false, free: true });
      const result = useFood(r, sid, 0);
      ok(result.ok, `${spell} could not be used in fixture`);
      legalOptions(r);
      if (r.discover?.length) { pickDiscover(r, 0); legalOptions(r); }
    }
    const hero = clone(base); ok(useHero(hero), 'seer unavailable'); legalOptions(hero);
    const fire = clone(base); fire.event = 'fire';
    ok(resolveEvent(fire, 0, 0).ok, 'fire upgrade failed'); legalOptions(fire);
    const morph = clone(base); morph.event = 'morph';
    const options = morphPool(morph.queue[0]!, morph);
    if (options.length) {
      ok(resolveEvent(morph, 0, 0).ok, 'morph failed');
      ok(activeCardPool(morph).some(c => c.id === morph.queue[0]!.def), 'morph event escaped draft');
    }
    const merc = clone(base); merc.event = 'merc';
    ok(resolveEvent(merc, 0).ok, 'mercenary failed');
    ok(merc.queue.every(o => !o || activeCardPool(merc).some(c => c.id === o.def)), 'mercenary escaped draft');
  }
});

test('explicit empty-slot recruiting preserves duplicates until explicit merge', () => {
  const r = newRun(98); r.gold = 100;
  const def = activeCardPool(r).find(c => c.archetype === 'pair')?.id ?? activeCardPool(r)[0].id;
  for (let slot = 0; slot < 2; slot++) {
    const sid = r.nextId++;
    r.shop.push({ sid, kind: 'unit', def, locked: false, free: false });
    ok(buy(r, sid, slot).ok, 'explicit placement failed');
  }
  ok(r.queue[0]?.copies === 1 && r.queue[1]?.copies === 1, 'duplicates auto-merged despite explicit placement');
  const result = moveOwned(r, 1, 0);
  ok(result?.merged && Number(r.queue[0]?.copies) === 2 && !r.queue[1], 'explicit drag did not merge duplicates');
});

test('quick recruit places pair units adjacent while explicit dragging can still merge', () => {
  const r = fixture('pair'), def = 'rw_pair_cadet';
  r.queue[2] = owned(r, def);
  const slot = autoSlot(r, def);
  ok(slot === 1 || slot === 3, 'quick recruit destroyed a pair by merging');
  const sid = r.nextId++;
  r.shop.push({ sid, kind: 'unit', def, locked: false, free: false });
  ok(buy(r, sid, slot).ok && r.queue[2]!.copies === 1, 'quick recruit did not preserve original copy');
  ok(moveOwned(r, slot, 2)?.merged, 'pair copies could not be explicitly merged');
});

test('blood payment spends permanent life once and never kills its owner', () => {
  const r = fixture('blood'); r.queue[0] = owned(r, 'rw_blood_cutpurse');
  const hp = ownedHp(r.queue[0]!), gold = r.gold;
  ok(payBlood(r, 0).ok, 'first blood payment rejected');
  ok(ownedHp(r.queue[0]!) === hp - 1 && r.gold === gold + 1, 'payment did not exchange one permanent hp for gold');
  const once = JSON.stringify(r);
  ok(!payBlood(r, 0).ok, 'same owner paid again this turn');
  same(JSON.stringify(r), once, 'rejected repeat payment mutated run');
  r.queue[0] = owned(r, 'rw_blood_cutpurse'); r.queue[0]!.hpBonus = 1 - card('rw_blood_cutpurse').hp;
  const weak = JSON.stringify(r);
  ok(!payBlood(r, 0).ok, 'one-hp unit paid blood');
  same(JSON.stringify(r), weak, 'failed fatal payment mutated run');
});

test('generated gold is team-capped even after replacing payment owners', () => {
  const r = fixture('blood'), gold = r.gold;
  for (let i = 0; i < 12; i++) { r.queue[0] = owned(r, 'rw_blood_cutpurse'); payBlood(r, 0); }
  ok(r.gold - gold === 4 && r.tc.generatedGold === 4, 'replacing instances bypassed four-gold cap');
});

test('blood payment has a real hp cost after capped-stat merges', () => {
  const r = fixture('blood'); r.queue[0] = owned(r, 'rw_blood_cutpurse');
  r.queue[0]!.hpBonus = STAT_CAP;
  const before = ownedHp(r.queue[0]!);
  ok(payBlood(r, 0).ok, 'capped owner could not pay');
  ok(ownedHp(r.queue[0]!) === before - 1, 'overflow bonus absorbed permanent blood cost');
});

test('paid trade cycles cannot generate unbounded gold', () => {
  const r = fixture('trade'), initialGold = r.gold;
  for (let i = 0; i < 12; i++) {
    const sid = r.nextId++;
    r.shop.push({ sid, kind: 'unit', def: 'rw_trade_broker', locked: false, free: false });
    ok(buy(r, sid, 0).ok && sell(r, 0), 'trade cycle failed');
  }
  ok(r.gold <= initialGold && r.tc.generatedGold <= 4, 'trade has a free gold loop');
  ok(r.tc.bought === 12 && r.tc.sold === 12, 'paid trade counts incorrect');
});

test('free recruits do not advance paid-buy counters or generate own-buy rewards', () => {
  const r = fixture('rune');
  for (let slot = 0; slot < 3; slot++) {
    const sid = r.nextId++;
    r.shop.push({ sid, kind: 'unit', def: 'rw_rune_satchel', locked: false, free: true, price: 0 });
    ok(buy(r, sid, slot).ok, 'free recruit failed');
  }
  ok(r.tc.bought === 0 && r.tc.generatedSpells === 0, 'free recruit generated paid-buy resources');
});

test('generated spell limit survives owner replacement', () => {
  const r = fixture('rune');
  for (let i = 0; i < 8; i++) {
    const sid = r.nextId++;
    r.shop.push({ sid, kind: 'unit', def: 'rw_rune_satchel', locked: false, free: false });
    ok(buy(r, sid, 0).ok && sell(r, 0), 'spell generator cycle failed');
  }
  ok(r.tc.generatedSpells === 2, 'spell generation exceeded team cap or did not trigger');
  const generated = [...r.hand.filter(Boolean), ...(r.rewards ?? []).map(x => x.card)];
  ok(generated.length === 2, 'generated spell cards were duplicated or dropped');
  ok(generated.every(x => x && FOOD[x.def]?.spell), 'temporary spell generator produced supplies that cannot advance chanting');
});

test('generated ration limit survives owner replacement', () => {
  const r = fixture('supply');
  for (let i = 0; i < 8; i++) {
    const sid = r.nextId++;
    r.shop.push({ sid, kind: 'unit', def: 'rw_common_cook', locked: false, free: false });
    ok(buy(r, sid, 0).ok && sell(r, 0), 'ration generator cycle failed');
  }
  ok(r.tc.generatedRations === 2, 'ration generation exceeded team cap or did not trigger');
  ok(r.shop.filter(s => s.kind === 'food' && s.free && s.price === 0).length === 2, 'generated rations duplicated or dropped');
});

test('spell seal honors per-owner limit and repeated end-turn is inert', () => {
  const r = fixture('rune'); r.queue[0] = owned(r, 'rw_rune_scribe');
  for (let i = 0; i < 5; i++) {
    r.hand[0] = { kind: 'spell', oid: r.nextId++, def: 'x_coin', source: 'test', obtainedTurn: r.turn };
    ok(castHandSpell(r, HAND_BASE, null).ok, 'seal fixture spell rejected');
  }
  ok(r.tc.spells === 5 && r.queue[0]!.seal === 4, 'scribe did not stop after two triggers');
  endTurn(r); const ended = JSON.stringify(r);
  endTurn(r); same(JSON.stringify(r), ended, 'end-turn effects repeated');
});

test('new movement and counter events remain visible to playback consumers', () => {
  const battle = simulate([
    { def: 'rw_wheel_courier', lvl: 1, atk: 1, hp: 30 },
    { def: 'rw_charge_sling', lvl: 1, atk: 1, hp: 30 },
  ], [{ def: 'e_skel', lvl: 1, atk: 1, hp: 100 }], 222);
  const moves = battle.events.filter(e => e.t === 'move');
  const counters = battle.events.filter(e => e.t === 'counter');
  ok(moves.length && counters.length, 'fixture did not exercise new event types');
  for (const e of [...moves, ...counters]) same(focusUid(e), e.uid, `demo lost ${e.t} focus`);
  const lines = battleTimeline(battle).flatMap(page => page.lines);
  for (const move of moves) {
    const reason = move.reason;
    ok(reason && lines.some(line => line.includes(reason)), 'timeline omitted movement reason');
  }
});

test('preview and preview settlement preserve real state and future battle', () => {
  const r = newRun(7766);
  const control = clone(r), before = JSON.stringify(r);
  const preview = trialFight(r);
  same(JSON.stringify(r), before, 'preview changed run state');
  settleBattle(r, preview);
  same(JSON.stringify(r), before, 'preview was allowed to settle');
  same(fight(r), fight(control), 'preview changed real battle seed or effects');
});

test('battle settlement is idempotent', () => {
  const r = newRun(8899);
  const battle = fight(r);
  settleBattle(r, battle);
  const before = JSON.stringify(r);
  settleBattle(r, battle);
  same(JSON.stringify(r), before, 'same battle settled twice');
});

test('new save round trip and legacy isolation', () => {
  storage.clear();
  const legacy = JSON.stringify({ v: SAVE_VERSION - 1, historical: true });
  storage.set(LEGACY_SAVE_KEY, legacy);
  ok(saveStatus() === 'unsupported', 'legacy save should be unsupported');
  const r = newRun(501);
  save(r);
  ok(saveStatus() === 'current', 'new save not recognized');
  const restored = load();
  ok(restored, 'valid new save rejected');
  // Load may materialize optional empty arrays, so compare reproducible gameplay outputs.
  same(fight(restored), fight(clone(r)), 'save altered next battle');
  same(storage.get(LEGACY_SAVE_KEY), legacy, 'legacy record overwritten');
  const old = clone(r); old.v = SAVE_VERSION - 1;
  storage.set(SAVE_KEY, JSON.stringify(old));
  ok(load() === null && saveStatus() === 'unsupported', 'older rules loaded into current run');
});

const malformed: [string, (r: RunState) => void][] = [
  ['unknown unit', r => { r.queue[0] = { oid: r.nextId++, def: '__missing_card', copies: 1, atkBonus: 0, hpBonus: 0 }; }],
  ['duplicate identity', r => { r.shop[1].sid = r.shop[0].sid; }],
  ['unknown archetype', r => { (r.activeArchetypes as string[])[0] = '__unknown'; }],
  ['duplicate archetype', r => { r.activeArchetypes[1] = r.activeArchetypes[0]; }],
  ['disabled shop unit', r => {
    const disabled = SHOP_POOL.find(c => c.archetype && !r.activeArchetypes.includes(c.archetype));
    ok(disabled, 'disabled archetype fixture missing');
    r.shop.push({ sid: r.nextId++, kind: 'unit', def: disabled.id, locked: false, free: false });
  }],
  ['disabled discovery', r => {
    const disabled = SHOP_POOL.find(c => c.archetype && !r.activeArchetypes.includes(c.archetype));
    ok(disabled, 'disabled archetype fixture missing');
    r.discover = [{ opts: [disabled.id], mode: 'gain', src: 'bad', price: 0 }];
  }],
  ...['spells', 'sold', 'generatedGold', 'generatedSpells', 'generatedRations'].flatMap(key => [
    [`negative resource ${key}`, (r: RunState) => { (r.tc as unknown as Record<string, unknown>)[key] = -1; }],
    [`NaN resource ${key}`, (r: RunState) => { (r.tc as unknown as Record<string, unknown>)[key] = Number.NaN; }],
  ] as [string, (r: RunState) => void][]),
  ['negative seal', r => { r.queue[0] = owned(r, activeCardPool(r)[0].id); r.queue[0]!.seal = -1; }],
  ['NaN seal', r => { r.queue[0] = owned(r, activeCardPool(r)[0].id); r.queue[0]!.seal = Number.NaN; }],
  ['negative rule usage', r => { r.tc.ruleUses['1:0'] = -1; }],
  ['NaN rule event count', r => { r.tc.ruleEvents['1:0'] = Number.NaN; }],
  ...['seed', 'worldSeed', 'gold', 'lives', 'act', 'layer', 'tc', 'relics', 'history', 'pendingFx', 'activeArchetypes'].map(key =>
    [`missing ${key}`, (r: RunState) => { delete (r as unknown as Record<string, unknown>)[key]; }] as [string, (r: RunState) => void]),
];
for (const [name, damage] of malformed) test(`save rejects ${name}`, () => {
  const r = newRun(502); damage(r);
  storage.set(SAVE_KEY, JSON.stringify(r));
  ok(load() === null && saveStatus() === 'invalid', 'malformed save accepted');
});

if (failures.length) throw new Error(`${failures.length}/${checks} archetype integration checks failed:\n${failures.join('\n')}`);
console.log(`archetype run checks passed (${checks})`);
