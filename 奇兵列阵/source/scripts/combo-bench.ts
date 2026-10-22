// 场景只取不饱和的章节/星级；饱和列自动排除出综合百分位。
// 推荐阵容强度校验：固定 5 人 + 推荐主将，不带装备和培养，打每章全部战斗节点。
// 与同条件下的随机同阵营阵容（4 本阵营 + 1 中立，前排按坦度排）比较，给出百分位。
// 另做推荐阵容两两互打（双方都不带主将）。
// RANDOM=300 随机阵容数；只看结论，不进构建。
declare const process: { env: Record<string, string | undefined> };
import { COMBOS } from '../src/core/combos';
import { DRAFT_POOL, FACTION_ORDER, unitDef } from '../src/core/data';
import { simulate, levelStats } from '../src/core/engine';
import { chapter, type RouteNode } from '../src/core/route';
import type { Copies, EnemyEntry, Faction } from '../src/core/types';

const RANDOM = Number(process.env.RANDOM ?? 300);
const SEEDS = [11, 23, 37, 41, 53, 67];

const nodesOf = (ch: number): RouteNode[] => chapter(ch).stages.flatMap((s) =>
  s.type === 'shop' ? [] : s.type === 'fork' ? [s.elite, s.normal] : s.type === 'boss' ? [s.main] : [s.main, ...(s.variant ? [s.variant] : [])]);

const copies = (lv: number) => (lv === 3 ? 4 : lv === 2 ? 2 : 1) as Copies;
const team = (ids: string[], lv: number) => ids.map((defId, i) => ({ defId, ownedId: i + 1, copies: copies(lv) }));

/** 一个阵容打一章全部节点的得分（胜 1、平 0.5） */
function score(ids: string[], general: string | null, ch: number, lv: number) {
  let s = 0, n = 0;
  for (const node of nodesOf(ch)) for (const seed of SEEDS) {
    const out = simulate({ player: team(ids, lv), enemy: node.lineup, general: general ? { id: general, power: ch, passives: [] } : null, seed, record: false });
    s += out.result === 'win' ? 1 : out.result === 'draw' ? 0.5 : 0; n++;
  }
  return s / n;
}

let rng = 12345;
const rand = (k: number) => { rng = (Math.imul(rng, 1103515245) + 12345) >>> 0; return rng % k; };
const sample = <T>(a: T[], k: number) => { const c = [...a], o: T[] = []; while (o.length < k && c.length) o.push(c.splice(rand(c.length), 1)[0]); return o; };
const tank = (id: string) => {
  const d = unitDef(id), t = d.traits ?? {};
  return levelStats(id, 1).hp + (t.armor?.[0] ?? 0) * 4 + (t.reborn ? 4 : 0) + (d.special === 'keeper' ? 6 : 0) - (d.cast || t.snipe ? 8 : 0);
};
function randomTeam(f: Faction) {
  const own = sample(DRAFT_POOL.filter((d) => d.faction === f).map((d) => d.id), 4);
  const neu = sample(DRAFT_POOL.filter((d) => d.faction === 'neutral').map((d) => d.id), 1);
  return [...own, ...neu].sort((a, b) => tank(b) - tank(a));
}

const SCEN: { name: string; ch: number; lv: number }[] = [
  { name: '1章1星', ch: 0, lv: 1 }, { name: '1章2星', ch: 0, lv: 2 }, { name: '2章2星', ch: 1, lv: 2 }, { name: '2章3星', ch: 1, lv: 3 },
];
const facGen: Partial<Record<Faction, string>> = {};
for (const c of COMBOS) facGen[c.faction] ??= c.general;

// 随机阵容分布（按阵营带该阵营推荐主将）
const dist = SCEN.map(() => [] as number[]);
const facAvg: Record<string, number[]> = {};
for (let i = 0; i < RANDOM; i++) {
  const f = FACTION_ORDER[i % FACTION_ORDER.length] as Faction;
  if (f === 'neutral') continue;
  const ids = randomTeam(f);
  SCEN.forEach((sc, k) => {
    const v = score(ids, facGen[f] ?? null, sc.ch, sc.lv);
    dist[k].push(v);
    (facAvg[`${f}:${k}`] ??= []).push(v);
  });
}
dist.forEach((d) => d.sort((a, b) => a - b));
const pctile = (k: number, v: number) => Math.round((dist[k].filter((x) => x < v).length + dist[k].filter((x) => x === v).length / 2) / dist[k].length * 100);
const f2 = (v: number) => (v * 100).toFixed(0).padStart(3) + '%';
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

console.log(`随机阵容 ${dist[0].length} 个；各场景随机阵容中位得分：` + SCEN.map((sc, k) => `${sc.name} ${f2(dist[k][dist[k].length >> 1])}`).join('  '));
// 饱和场景（随机阵容中位 ≤5% 或 ≥95%）百分位没有区分度，不计入综合
const live = dist.map((d) => { const m = d[d.length >> 1]; return m > 0.05 && m < 0.95; });
console.log('计入综合的场景：' + SCEN.filter((_, k) => live[k]).map((s) => s.name).join('、'));
console.log('\n阵容　　　　　 ' + SCEN.map((s) => `${s.name}(百分位)`.padEnd(14)).join(''));
const totals: { name: string; avg: number }[] = [];
for (const c of COMBOS) {
  const row = SCEN.map((sc, k) => { const v = score(c.units, c.general, sc.ch, sc.lv); return { v, p: pctile(k, v) }; });
  totals.push({ name: c.name, avg: mean(row.filter((_, k) => live[k]).map((x) => x.p)) });
  console.log(`${c.name.padEnd(7, '　')} ` + row.map((x) => `${f2(x.v)} (P${String(x.p).padStart(3)})`.padEnd(14)).join(''));
}
console.log('\n随机阵容按阵营平均：');
for (const f of FACTION_ORDER) if (f !== 'neutral') console.log(`  ${f.padEnd(7)} ` + SCEN.map((sc, k) => `${sc.name} ${f2(mean(facAvg[`${f}:${k}`] ?? []))}`).join('  '));

// 两两互打：2 星、双方无主将；A 当玩家方、B 当敌方，各打 3 种子再交换
const entries = (ids: string[], lv: number): EnemyEntry[] => ids.map((defId) => ({ defId, level: lv }));
const rr = COMBOS.map(() => 0);
for (let a = 0; a < COMBOS.length; a++) for (let b = 0; b < COMBOS.length; b++) if (a !== b) for (const seed of SEEDS) {
  const out = simulate({ player: team(COMBOS[a].units, 2), enemy: entries(COMBOS[b].units, 2), general: null, seed, record: false });
  const v = out.result === 'win' ? 1 : out.result === 'draw' ? 0.5 : 0;
  rr[a] += v; rr[b] += 1 - v;
}
const games = (COMBOS.length - 1) * 2 * SEEDS.length;
console.log('\n互打胜率（2 星，无主将）：');
COMBOS.map((c, i) => ({ c, w: rr[i] / games })).sort((x, y) => y.w - x.w).forEach(({ c, w }) => console.log(`  ${c.name.padEnd(7, '　')} ${f2(w)}`));
console.log('\n综合百分位：' + totals.sort((x, y) => y.avg - x.avg).map((t) => `${t.name} ${t.avg.toFixed(0)}`).join('，'));
