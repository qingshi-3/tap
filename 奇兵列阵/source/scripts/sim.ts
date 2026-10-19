// v0.7 整局无头模拟：3 章 × 9 节点。真实招募 + 启发式备战 / 培养 / 商店 / 分岔。
// SEEDS=300 默认；每个种子随机 4 阵营、轮换 7 名主将。
declare const process: { env: Record<string, string | undefined>; exit(code: number): never };
import { GENERALS, unitDef } from '../src/core/data';
import { TOTAL_BATTLES } from '../src/core/route';
import { simulate, levelStats } from '../src/core/engine';
import { allocPoint, applyResult, battleNo, buildBattle, buy, chooseReward, choosePromo, currentNode, equip, getOwned, leaveShop, moveSlot, newRun, pickFork, rollDraft, screen, takeDraft, type RunState } from '../src/core/run';
import { levelFromCopies, type Slotted, type UnitDef } from '../src/core/types';

const SEEDS = Number(process.env.SEEDS ?? 300);

const lvl = (u: Slotted) => levelFromCopies(u.copies);
const tri = (t: [number, number, number] | undefined, l: number) => (t ? t[l - 1] : 0);

/** 粗估单位价值：身材 + 稀有度 + 能力 */
function worth(d: UnitDef, level: number) {
  const s = levelStats(d.id, level);
  return s.atk * 1.4 + s.hp * 0.7 + d.tier * 3 + (d.cast ? 3 : 0) + tri(d.traits?.power, level) * 3 + tri(d.traits?.armor, level) * 3;
}
/** 适合站前排的程度 */
function tank(d: UnitDef, level: number) {
  const s = levelStats(d.id, level), t = d.traits ?? {};
  let v = s.hp + tri(t.armor, level) * 4 + tri(t.thorns, level) * 2 + (t.reborn ? 4 : 0);
  if (d.special === 'keeper') v += 6;
  if (d.onHurt) v += 4;
  if (d.cast || t.snipe || t.power) v -= 8;
  if (d.onFaint?.some(e => e.op === 'summon')) v += 3;
  return v;
}

const SLOTS_ALL = [0, 1, 2, 3, 4, 5, 6, 7];
function owned(r: RunState) { return SLOTS_ALL.map(i => ({ i, u: getOwned(r, i) })).filter(x => x.u) as { i: number; u: Slotted }[]; }
function factionCount(r: RunState) {
  const c: Record<string, number> = {};
  for (const { u } of owned(r)) c[unitDef(u.defId).faction] = (c[unitDef(u.defId).faction] ?? 0) + 1;
  return c;
}

function pickScore(r: RunState, id: string) {
  const d = unitDef(id), fc = factionCount(r);
  let s = worth(d, 1) + (d.faction !== 'neutral' ? (fc[d.faction] ?? 0) * 1.5 : 0);
  if (owned(r).some(x => x.u.defId === id && x.u.copies === 1)) s += 10;
  if (owned(r).some(x => x.u.defId === id && x.u.copies === 2)) s += 4;
  return s;
}

function doPick(r: RunState) {
  const scored = r.draft.map((id, i) => ({ i, id, s: pickScore(r, id) })).sort((a, b) => b.s - a.s);
  const best = scored[0];
  if (!best) { r.picks = 0; return; }
  const all = owned(r);
  const same = all.find(x => x.u.defId === best.id && x.u.copies === 1);
  let slot: number | undefined = same?.i;
  if (slot === undefined) for (const i of SLOTS_ALL) if (slot === undefined && !getOwned(r, i)) slot = i;
  if (slot === undefined) {
    const weakest = all.filter(x => x.u.copies === 1).sort((a, b) => worth(unitDef(a.u.defId), 1) - worth(unitDef(b.u.defId), 1))[0];
    if (!weakest || worth(unitDef(weakest.u.defId), 1) >= best.s - 4) { r.picks--; if (r.picks > 0) rollDraft(r); return; }
    slot = weakest.i;
  }
  const k = takeDraft(r, best.i, slot, true);
  if (k === 'invalid' || k === 'confirm') { r.picks--; return; }
  const twos = owned(r).filter(x => x.u.copies === 2);
  for (const a of twos) for (const b of twos) if (a.i !== b.i && a.u.defId === b.u.defId && getOwned(r, a.i) && getOwned(r, b.i)) moveSlot(r, a.i, b.i);
}

function arrange(r: RunState) {
  const all = owned(r).map(x => x.u);
  const top = [...all].sort((a, b) => worth(unitDef(b.defId), lvl(b)) - worth(unitDef(a.defId), lvl(a))).slice(0, 5);
  const order = [...top].sort((a, b) => tank(unitDef(b.defId), lvl(b)) - tank(unitDef(a.defId), lvl(a)));
  const rest = all.filter(u => !order.includes(u));
  r.slots = [...order, ...Array(5 - order.length).fill(null)];
  r.bench = [rest[0] ?? null, rest[1] ?? null, rest[2] ?? null];
}

/** 培养：法强给施法者或主将，生命/格挡给队首，其余给最强输出；装备依次给队首、最强输出 */
function train(r: RunState) {
  const field = r.slots.map((u, i) => ({ u, i })).filter(x => x.u) as { i: number; u: Slotted }[];
  if (!field.length) return;
  const carry = [...field].sort((a, b) => levelStatsAtk(b.u) - levelStatsAtk(a.u))[0].i;
  const caster = field.find(x => unitDef(x.u.defId).cast)?.i;
  for (const type of Object.keys(r.stash)) {
    while (r.stash[type] > 0) {
      const to = type === 'power' ? (caster ?? 'general') : type === 'hp' || type === 'block' ? 0 : carry;
      if (!allocPoint(r, to, type) && !allocPoint(r, carry, type) && !allocPoint(r, 'general', type)) break;
    }
  }
  let k = 0;
  while (r.bag.length && k < 4) {
    const target = [0, carry, 1, 2][k++];
    if (getOwned(r, target) && !(getOwned(r, target)!.equips?.length)) equip(r, 0, target);
  }
}
const levelStatsAtk = (u: Slotted) => levelStats(u.defId, lvl(u)).atk;

function shop(r: RunState) {
  const s = r.shop!;
  for (let i = 0; i < s.equips.length; i++) if (r.gold >= s.equips[i].price + 2) buy(r, 'equips', i);
  if (r.gold >= s.pack.price) buy(r, 'pack');
  for (let i = 0; i < s.units.length; i++) if (r.gold >= s.units[i].price && pickScore(r, s.units[i].id) >= 18) buy(r, 'units', i);
  leaveShop(r);
}

interface Stat { n: number; win: number; draw: number; beats: number; timeout: number; name: string }
const stage: Stat[] = Array.from({ length: TOTAL_BATTLES }, () => ({ n: 0, win: 0, draw: 0, beats: 0, timeout: 0, name: '' }));
const gens: Record<string, { runs: number; wins: number; clears: number }> = {};
const trig: Record<string, { battles: number; fires: number; wins: number }> = {};
const nodes: Record<string, { n: number; win: number }> = {};
let battles = 0, faults = 0, runs = 0, clears = 0, winsTotal = 0, elitePicks = 0, forks = 0;

for (let s = 0; s < SEEDS; s++) {
  const g = GENERALS[s % GENERALS.length].id;
  const r = newRun(g, 1000 + s * 7919);
  let guard = 0;
  while (!r.over && guard++ < 200) {
    const sc = screen(r);
    if (sc === 'promo') { choosePromo(r, 0); continue; }
    if (sc === 'reward') { chooseReward(r, 0); continue; }
    if (sc === 'shop') { shop(r); continue; }
    if (sc === 'fork') { const e = r.lives >= 2; forks++; if (e) elitePicks++; pickFork(r, e ? 'elite' : 'normal'); continue; }
    while (r.picks > 0) doPick(r);
    arrange(r);
    train(r);
    const node = currentNode(r), b = battleNo(r);
    const out = simulate({ ...buildBattle(r), record: false });
    battles++;
    if (out.fault) faults++;
    const S = stage[b]; S.n++; S.beats += out.beats; S.name ||= `${r.chapter + 1}-${r.node + 1}`;
    if (out.result === 'win') S.win++;
    const N = (nodes[`${r.chapter + 1}-${r.node + 1} ${node.name}`] ??= { n: 0, win: 0 }); N.n++; if (out.result === 'win') N.win++;
    if (out.beats >= 60) S.timeout++;
    if (out.result === 'draw') S.draw++;
    for (const id of new Set(r.slots.filter(Boolean).map(u => u!.defId))) {
      const t = (trig[id] ??= { battles: 0, fires: 0, wins: 0 });
      t.battles++; if (out.result === 'win') t.wins++; t.fires += out.triggers?.[id] ?? 0;
    }
    // 首领平局不推进，模拟里按失败计
    applyResult(r, out.result === 'draw' && node.kind === 'boss' ? 'lose' : out.result, out.gold ?? 0);
  }
  runs++; winsTotal += r.wins;
  if (r.over === 'victory') clears++;
  const G = (gens[g] ??= { runs: 0, wins: 0, clears: 0 }); G.runs++; G.wins += r.wins; if (r.over === 'victory') G.clears++;
}

const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) + '%' : '-');
console.log(`局数 ${runs}，战斗 ${battles}，fault ${faults}，平均胜场 ${(winsTotal / runs).toFixed(2)}/${TOTAL_BATTLES}，通关率 ${pct(clears, runs)}，分岔选精英 ${pct(elitePicks, forks)}`);
console.log('\n战  节点  场次  胜率   平局  平均拍');
stage.forEach((S, i) => console.log(`${String(i + 1).padStart(2)} ${S.name.padEnd(5)} ${String(S.n).padStart(5)} ${pct(S.win, S.n).padStart(6)} ${pct(S.draw, S.n).padStart(6)} ${(S.beats / (S.n || 1)).toFixed(1)}`));
console.log('\n节点胜率：\n' + Object.entries(nodes).sort().map(([k, N]) => `  ${k} ${pct(N.win, N.n)}(${N.n})`).join('\n'));
console.log('\n主将     平均胜场  通关率');
for (const [k, G] of Object.entries(gens)) console.log(`${k.padEnd(8)} ${(G.wins / G.runs).toFixed(2).padStart(6)}  ${pct(G.clears, G.runs)}`);
console.log('\n卡牌　　　　 每场触发 上场胜率 (上场数)');
Object.entries(trig).filter(([, t]) => t.battles >= 50).sort((a, b) => b[1].wins / b[1].battles - a[1].wins / a[1].battles).slice(0, 40)
  .forEach(([id, t]) => console.log(`${unitDef(id).name.padEnd(6, '　')} ${(t.fires / t.battles).toFixed(2).padStart(6)}  ${pct(t.wins, t.battles).padStart(6)}  (${t.battles})`));
