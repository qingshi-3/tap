import { SHOP_POOL } from '../../src/core/data';
import { simulate, type UnitSpec } from '../../src/core/engine';

export function runInvariants(count = 10000) {
  let state = 20261024;
  const rnd = () => ((state = Math.imul(state, 1664525) + 1013904223 >>> 0) / 4294967296);
  const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  const failures: { id: string; case: number; detail: string; left: UnitSpec[]; right: UnitSpec[]; seed: number }[] = [];
  const covered = new Set<string>();
  const coveredStars = new Set<string>();
  let largestEvents = 0, draws = 0, leftWins = 0, mirroredWins = 0, battles = 0;
  for (let i = 0; i < count; i++) {
    const team = () => Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => {
      const d = pick(SHOP_POOL);
      return { def: d.id, lvl: pick([1, 2, 3] as const satisfies readonly (1 | 2 | 3)[]) as 1 | 2 | 3,
        atk: 1 + Math.floor(rnd() * 50), hp: 1 + Math.floor(rnd() * 50),
        ench: pick([null, 'rotate', 'iron', 'chili', 'amulet', 'shroom', 'wine'] as (UnitSpec['ench'])[]),
        lamp: rnd() < .15, bank: d.ab === 'egg' ? Math.floor(rnd() * 49) : 0 };
    });
    const left = team(), right = team(), seed = 1 + Math.floor(rnd() * 1e8);
    for (const u of [...left, ...right]) { covered.add(u.def); coveredStars.add(`${u.def}/${u.lvl}`); }
    const before = JSON.stringify([left, right]);
    try {
      const a = simulate(left, right, seed), b = simulate(left, right, seed), mirror = simulate(right, left, seed);
      battles += 3;
      const fail = (id: string, detail: string) => failures.push({ id, case: i, detail, left, right, seed });
      if (JSON.stringify(a) !== JSON.stringify(b)) fail('determinism', '同种子输入产生不同事件');
      if (before !== JSON.stringify([left, right])) fail('input-mutation', '纯函数修改输入');
      const numeric = a.events.every((e) => Object.entries(e).every(([key, value]) => typeof value !== 'number' || (Number.isFinite(value) && (key !== 'block' || value >= 0))));
      if (!numeric) fail('finite-state', '事件存在非有限数或负格挡');
      const clashes = a.events.filter((e) => e.t === 'clash').length;
      if (clashes > 30) fail('clash-limit', `交锋=${clashes}`);
      if (a.events.at(-1)?.t !== 'end') fail('termination', '无end事件');
      const live = new Map(a.init.map((u) => [u.uid, { side: u.side, hp: u.hp }]));
      for (const e of a.events) {
        if (e.t === 'summon') live.set(e.unit.uid, { side: e.unit.side, hp: e.unit.hp });
        if (e.t === 'die') live.delete(e.uid);
        if (e.t === 'dmg' || e.t === 'heal') { const u = live.get(e.tgt); if (u) u.hp = e.hp; }
        if (e.t === 'buff') { const u = live.get(e.tgt); if (u) u.hp = e.nowHp; }
        for (const side of [0, 1]) if ([...live.values()].filter((u) => u.side === side && u.hp > 0).length > 5) {
          fail('live-capacity', `事件${e.t}后存活超过5`); break;
        }
      }
      const alive = [0, 1].map((side) => [...live.values()].filter((u) => u.side === side && u.hp > 0).length);
      const expected = alive[0] && !alive[1] ? 'win' : alive[1] && !alive[0] ? 'lose' : 'draw';
      if (a.result !== expected) fail('result-consistency', `结果=${a.result}，事件存活=${alive}`);
      largestEvents = Math.max(largestEvents, a.events.length);
      draws += a.result === 'draw' ? 1 : 0;
      leftWins += a.result === 'win' ? 1 : a.result === 'draw' ? .5 : 0;
      mirroredWins += mirror.result === 'win' ? 1 : mirror.result === 'draw' ? .5 : 0;
    } catch (e) {
      failures.push({ id: 'exception', case: i, detail: String(e), left, right, seed });
    }
  }
  return { cases: count, battles, failures, largestEvents, draws, coveredUnits: [...covered].sort(), coveredUnitStars: [...coveredStars].sort(),
    leftScore: leftWins / count, reversedLeftScore: mirroredWins / count,
    firstSideAdvantage: (leftWins + mirroredWins) / (2 * count) - .5,
    note: '合法面板/队长内的随机压力测试，覆盖全部卡池并附魔；不保证状态来自真实商店，不作为平衡胜率。左右交换结果不要求反对称，因为正式引擎存在交替开战顺序；只量化偏差。' };
}
