import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/engine';
import { chapter } from '../src/core/route';
import type { EnemyEntry } from '../src/core/types';

const E = (defId: string, extra: Partial<EnemyEntry> = {}): EnemyEntry => ({ defId, ...extra });
function step(b: Battle, n = 1) {
  const pipeline = b as unknown as { startPhase(): void; doBeat(): void };
  if (b.beat === 0) pipeline.startPhase();
  for (let i = 0; i < n && !b.outcome(); i++) pipeline.doBeat();
  return b.log.map((x) => x.ev);
}
const make = (player: EnemyEntry[], enemy: EnemyEntry[]) => new Battle({ player, enemy });

describe('内容调整：真实攻防与技能职能', () => {
  // 一星岚刃、背刺者击败对手追击已由balance-revision覆盖，此处只补二/三星。
  it.each([[2, 3], [3, 4]] as const)('岚刃%i星每段只对正护甲追加%i伤害', (level, bonus) => {
    for (const armor of [0, 1]) {
      const b = make([E('s_xyle', { level, atk: 4, hp: 100 })], [E('e_skel', { armor, hp: 100, atk: 1 })]);
      const ev = step(b);
      const hits = ev.filter((e) => e.t === 'dmg' && e.src === 1 && e.kind === 'attack');
      expect(hits.map((e) => e.t === 'dmg' ? e.n : 0)).toEqual(armor ? [2 + bonus - 1, 2 + bonus - 1] : [2, 2]);
    }
  });

  it.each([1, 2, 3] as const)('献祭术士%i星阵亡只增强相邻友军，并提高后续技能实际寒意', level => {
    const b = make([
      E('v_mage', { hp: 100 }), E('a_cult', { level, hp: 1 }), E('n_medic', { hp: 100 }), E('n_archer', { hp: 100 }),
    ], [E('x_egg', { hp: 1000 }), E('s_fox', { atk: 10, hp: 1000 })]);
    const ev = step(b, 4);
    expect(b.units[1].alive).toBe(false);
    expect(b.units[0].grants.power).toBe(level + 1);
    expect(b.units[2].grants.power).toBe(level + 1);
    expect(b.units[3].grants.power ?? 0).toBe(0);
    const chills = ev.filter((e) => e.t === 'chill' && e.src === 1);
    expect(chills.map((e) => e.t === 'chill' ? e.n : 0)).toEqual([3, 4 + level]);
  });

  it('一星魂缚吟者固有法强2使蓄力群伤每个目标从2变为3', () => {
    const b = make([E('a_chanter', { hp: 100 })], [E('e_skel', { hp: 100, atk: 1 }), E('e_skel', { hp: 100, atk: 1 })]);
    b.units[0].charge = 2;
    const ev = step(b);
    expect(b.power(b.units[0])).toBe(2);
    expect(ev.filter((e) => e.t === 'dmg' && e.src === 1 && e.kind === 'ability').map((e) => e.t === 'dmg' ? e.n : 0)).toEqual([3, 3]);
  });

  it('霜脊地龙没有无效法强，冻结后对队尾兑现直伤', () => {
    const b = make([E('v_drake', { hp: 100 }), E('v_chaser', { hp: 100 })], [E('e_skel', { hp: 100, atk: 1 }), E('e_skel', { hp: 100, atk: 1 })]);
    const ev = step(b, 5);
    expect(b.power(b.units[0])).toBe(0);
    const hits = ev.filter(e => e.t === 'dmg' && e.src === 1 && e.kind === 'ability');
    expect(hits.length).toBeGreaterThan(0);
    // One-star base 4 plus half of its unmodified 3 attack, rounded down.
    expect(hits.every(e => e.t === 'dmg' && e.tgt === 4 && e.n === 5)).toBe(true);
  });

  it('第四战石魔护甲覆盖为1，其他石魔仍为2，实际普攻减伤相符', () => {
    const stages = chapter(0).stages;
    const first = stages[4];
    if (first.type !== 'battle') throw new Error('fourth battle missing');
    const firstGolem = first.main.lineup.find((e) => e?.defId === 'e_golem')!;
    const laterGolems = [...stages.filter((_, i) => i !== 4), ...chapter(1).stages, ...chapter(2).stages].flatMap((s) => s.type === 'battle' ? [s.main, ...(s.variant ? [s.variant] : [])] : s.type === 'fork' ? [s.normal, s.elite] : s.type === 'boss' ? [s.main] : [])
      .flatMap((s) => s.lineup.filter((e): e is EnemyEntry => e?.defId === 'e_golem'));
    laterGolems.push({ defId: 'e_golem', hp: 100 });
    for (const [entry, armor] of [[firstGolem, 1], ...laterGolems.map((e) => [e, 2] as const)] as const) {
      const b = make([E('n_merc', { atk: 4, hp: 100 })], [entry]);
      expect(b.armor(b.units[1])).toBe(armor);
      const hit = step(b).find((e) => e.t === 'dmg' && e.src === 1 && e.kind === 'attack');
      expect(hit).toMatchObject({ n: 4 - armor });
    }
  });

  it('沙嚎者7血可活过两次3伤，旧5血在第二击阵亡', () => {
    const current = make([E('d_howler')], [E('e_skel', { atk: 3, hp: 1000 })]);
    const old = make([E('d_howler', { hp: 5 })], [E('e_skel', { atk: 3, hp: 1000 })]);
    step(current, 2); step(old, 2);
    expect(current.units[0].maxHp).toBe(7);
    expect(current.units[0]).toMatchObject({ alive: true, hp: 1 });
    expect(old.units[0].alive).toBe(false);
  });
});
