// 推荐阵容爬山搜索：从每套推荐阵容出发，逐个换人（本阵营 + 中立）或换位，得分提高就接受。
// 得分 = 1章1星 / 2章2星 / 3章3星 打全部战斗节点，敌方数值再乘 0.7~1.15 四档，取胜场比例。
// ONLY=名字 只搜一套；只看结论，不进构建。
declare const process: { env: Record<string, string | undefined> };
import { COMBOS } from '../src/core/combos';
import { DRAFT_POOL, unitDef } from '../src/core/data';
import { simulate } from '../src/core/engine';
import { chapter, type RouteNode } from '../src/core/route';
import type { Copies } from '../src/core/types';

const MULTS = [0.7, 0.85, 1, 1.15];
const SCEN = [{ ch: 0, lv: 1 }, { ch: 1, lv: 2 }, { ch: 2, lv: 3 }];
const nodesOf = (ch: number): RouteNode[] => chapter(ch).stages.flatMap((s) =>
  s.type === 'shop' ? [] : s.type === 'fork' ? [s.elite, s.normal] : s.type === 'boss' ? [s.main] : [s.main, ...(s.variant ? [s.variant] : [])]);
const scaled = SCEN.map((sc) => nodesOf(sc.ch).flatMap((n) => MULTS.map((m) => n.lineup.map((e) => e && {
  ...e, ...(e.atk !== undefined ? { atk: Math.max(1, Math.round(e.atk * m)) } : {}), ...(e.hp !== undefined ? { hp: Math.max(1, Math.round(e.hp * m)) } : {}),
}))));
const copies = (lv: number) => (lv === 3 ? 4 : lv === 2 ? 2 : 1) as Copies;

const cache = new Map<string, number[]>();
function score(ids: string[], general: string) {
  const key = ids.join(',') + '|' + general;
  let v = cache.get(key);
  if (!v) {
    v = SCEN.map((sc, k) => {
      let s = 0;
      for (const enemy of scaled[k]) {
        const out = simulate({ player: ids.map((defId, i) => ({ defId, ownedId: i + 1, copies: copies(sc.lv) })), enemy, general: { id: general, power: sc.ch, passives: [] }, seed: 7, record: false });
        s += out.result === 'win' ? 1 : out.result === 'draw' ? 0.5 : 0;
      }
      return s / scaled[k].length;
    });
    cache.set(key, v);
  }
  return v;
}
const total = (v: number[]) => v[0] + v[1] + v[2];

const only = process.env.ONLY;
for (const c of COMBOS) {
  if (only && c.name !== only) continue;
  const pool = DRAFT_POOL.filter((d) => d.faction === c.faction || d.faction === 'neutral').map((d) => d.id);
  let cur = [...c.units], best = total(score(cur, c.general));
  const start = score(cur, c.general);
  for (let step = 0; step < Number(process.env.STEPS ?? 12); step++) {
    let bestN: string[] | null = null, bestV = best;
    for (let i = 0; i < 5; i++) {
      for (const id of pool) if (!cur.includes(id)) {
        const n = [...cur]; n[i] = id;
        const v = total(score(n, c.general)); if (v > bestV + 1e-9) { bestV = v; bestN = n; }
      }
      for (let j = i + 1; j < 5; j++) {
        const n = [...cur]; [n[i], n[j]] = [n[j], n[i]];
        const v = total(score(n, c.general)); if (v > bestV + 1e-9) { bestV = v; bestN = n; }
      }
    }
    if (!bestN) break;
    cur = bestN; best = bestV;
  }
  const end = score(cur, c.general);
  const p = (v: number[]) => v.map((x) => (x * 100).toFixed(0).padStart(3) + '%').join(' ');
  console.log(`${c.name}  原 ${p(start)} → 新 ${p(end)}\n  原: ${c.units.map((id) => unitDef(id).name).join(' / ')}\n  新: ${cur.map((id) => unitDef(id).name).join(' / ')}  [${cur.join(',')}]`);
}
