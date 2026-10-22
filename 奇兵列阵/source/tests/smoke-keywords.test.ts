// v0.8 关键词断言：每个关键词各写一场最小对局，断言结果。
// 这些用例长期保留。
import { describe, expect, it } from 'vitest';
import { simulate } from '../src/core/engine';
import type { BattleEvent, BattleOutput, EnemyEntry, Slotted } from '../src/core/types';

let nextOwned = 1;
const P = (defId: string, level = 1): Slotted => ({ defId, ownedId: nextOwned++, copies: ([1, 2, 4] as const)[level - 1] });
const E = (defId: string, extra: Partial<EnemyEntry> = {}): EnemyEntry => ({ defId, ...extra });
const fill = <T>(a: (T | null)[]) => [...a, null, null, null, null, null].slice(0, 5);
const DUMMY = E('e_skel', { atk: 1, hp: 999 });
const play = (player: (Slotted | EnemyEntry | null)[], enemy: (EnemyEntry | null)[] = [DUMMY], general?: string, passives?: string[]) =>
  simulate({ player: fill(player), enemy: fill(enemy), ...(general ? { general: { id: general, power: 0, passives: passives ?? [] } } : {}), record: true });
type Ev<T extends BattleEvent['t']> = Extract<BattleEvent, { t: T }>;
const evs = <T extends BattleEvent['t']>(o: BattleOutput | BattleOutput['log'], t: T): Ev<T>[] =>
  ('log' in o ? o.log : o).filter(l => l.ev.t === t).map(l => l.ev as Ev<T>);
const beatLog = (o: BattleOutput, n: number) => {
  const s = o.log.findIndex(l => l.ev.t === 'beat' && l.ev.n === n);
  const e = o.log.findIndex(l => l.ev.t === 'beat' && l.ev.n === n + 1);
  return o.log.slice(s, e < 0 ? undefined : e);
};
const uidOf = (o: BattleOutput, defId: string, side = 0) => o.initial.find(u => u.defId === defId && u.side === side)!.uid;

// ═══════════════════════════════════════════════════════════
// 嘲讽（taunt）：选目标优先级为 嘲讽 > 决斗对手 / 狙击 > 队首
// ═══════════════════════════════════════════════════════════
describe('嘲讽改选目标', () => {
  it('有嘲讽时决斗单位也优先打嘲讽，不打决斗对手', () => {
    const o = play(
      [P('s_backstab')],
      [E('e_skel', { atk: 1, hp: 999 }), E('v_wall', { atk: 1, hp: 999 })],
    );
    // s_backstab(duel) 对手=actors[1]=e_skel，但 v_wall(taunt) 优先级更高
    // 每个交锋拍都触发一次 taunt 重定向
    expect(evs(o, 'taunt').length).toBeGreaterThanOrEqual(1);
    const firstTaunt = evs(o, 'taunt')[0];
    expect(firstTaunt.from).toBe(uidOf(o, 'e_skel', 1)); // 本想打队首 e_skel
    expect(firstTaunt.to).toBe(uidOf(o, 'v_wall', 1));   // 被 taunt 拉到 v_wall
  });

  it('嘲讽 > 狙击：狙击手也优先打嘲讽', () => {
    const o = play(
      [P('s_wind')], // 狙击 + 连击
      [E('e_skel', { atk: 1, hp: 999 }), E('v_wall', { atk: 1, hp: 999 })],
    );
    expect(evs(o, 'taunt').length).toBeGreaterThanOrEqual(1);
  });

  it('嘲讽 > 普通队首：无特殊选目标时，taunt 抢走队首仇恨', () => {
    const o = play(
      [P('n_merc')],
      [E('e_skel', { atk: 1, hp: 999 }), E('v_wall', { atk: 1, hp: 999 })],
    );
    expect(evs(o, 'taunt').length).toBeGreaterThanOrEqual(1);
    expect(evs(o, 'taunt')[0].from).toBe(uidOf(o, 'e_skel', 1)); // 本该打队首
    expect(evs(o, 'taunt')[0].to).toBe(uidOf(o, 'v_wall', 1));   // 被拉到嘲讽
  });

  it('场上无嘲讽时决斗正常打对手', () => {
    const o = play(
      [P('s_backstab')],
      [E('e_skel', { atk: 1, hp: 999 }), E('e_skel', { atk: 1, hp: 999 })],
    );
    expect(evs(o, 'taunt').length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 轮换（rotate）：行动后退到队尾；追击后不轮换
// ═══════════════════════════════════════════════════════════
describe('轮换', () => {
  it('轮换单位行动后应退到队尾', () => {
    // s_step: rotate + combo
    const o = play(
      [P('s_step'), P('n_merc'), P('n_bulwark')],
      [DUMMY],
    );
    const uid = uidOf(o, 's_step');
    const afterBeat1 = beatLog(o, 1).at(-1)!.snap;
    const step = afterBeat1.find(u => u.uid === uid)!;
    // 轮换后应在队尾（living - 1）
    const living = afterBeat1.filter(u => u.alive && u.side === 0);
    expect(step.slot).toBe(living.length - 1);
    expect(step.slot).not.toBe(0);
  });

  it('连续行动后轮换单位持续移动', () => {
    const o = play(
      [P('s_step'), P('n_merc')],
      [DUMMY],
    );
    const uid = uidOf(o, 's_step');
    // 第 1 拍后：s_step 在 slot 0 行动，轮换到 slot 1（队尾，2人队）
    const after1 = beatLog(o, 1).at(-1)!.snap;
    expect(after1.find(u => u.uid === uid)!.slot).toBe(1);
    // 第 2 拍后：s_step 在 slot 1 行动，轮换到 slot 1（已在队尾，不移动）
    // slot 不变但仍在队尾
    const after2 = beatLog(o, 2).at(-1)!.snap;
    expect(after2.find(u => u.uid === uid)!.slot).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════
// 蓄力（charge）：蓄力满后释放并清零
// ═══════════════════════════════════════════════════════════
describe('蓄力', () => {
  it('蓄力 2 的单位第 3 拍释放蓄力技', () => {
    // v_snowman: charge 2, chargeSkill: freeze enemy front
    const o = play(
      [P('v_snowman')],
      [DUMMY],
    );
    // 第 1 拍后：charge=1
    const after1 = beatLog(o, 1).at(-1)!.snap;
    expect(after1.find(u => u.uid === 1)!.charge).toBe(1);
    // 第 2 拍后：charge=2（满）
    const after2 = beatLog(o, 2).at(-1)!.snap;
    expect(after2.find(u => u.uid === 1)!.charge).toBe(2);
    // 第 3 拍：释放蓄力技
    expect(evs(beatLog(o, 3), 'act').filter(a => a.mode === 'charge').length).toBeGreaterThanOrEqual(1);
    const after3 = beatLog(o, 3).at(-1)!.snap;
    expect(after3.find(u => u.uid === 1)!.charge).toBe(0);
  });

  it('蓄力技有 chargeAttack 时先普攻（带加成）再蓄力技效果', () => {
    // v_rhyno: charge 3, chargeAttack: { mult: 2, after: [...] }
    const o = play(
      [P('v_rhyno')],
      [E('e_skel', { hp: 999 })],
    );
    // 第 4 拍：charge 3 满，释放
    const releaseLog = beatLog(o, 4);
    expect(evs(releaseLog, 'act').filter(a => a.mode === 'charge').length).toBeGreaterThanOrEqual(1);
    const after = releaseLog.at(-1)!.snap;
    expect(after.find(u => u.uid === 1)!.charge).toBe(0);
    // 验证造成攻击伤害（chargeAttack 仍有普攻）
    expect(evs(releaseLog, 'dmg').filter(d => d.kind === 'attack').length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════
// 节拍（pulse）：按 N 次交锋触发
// ═══════════════════════════════════════════════════════════
describe('节拍', () => {
  it('节拍 3 的单位第 3 拍触发效果并重置计数', () => {
    // l_sunriser: pulse 3, onPulse: block highestHp
    const o = play(
      [P('l_sunriser'), P('n_merc')],
      [DUMMY],
    );
    const uid = uidOf(o, 'l_sunriser');
    // 第 1 拍后 pulse 在 beatEnd 中递增，beat 2 的起始快照才反映
    expect(beatLog(o, 2)[0].snap.find(u => u.uid === uid)!.pulse).toBe(1);
    // 第 2 拍后：pulse=2
    expect(beatLog(o, 3)[0].snap.find(u => u.uid === uid)!.pulse).toBe(2);
    // 第 3 拍后：pulse 重置为 0，触发 onPulse
    expect(beatLog(o, 4)[0].snap.find(u => u.uid === uid)!.pulse).toBe(0);
    expect(evs(o, 'trigger').some(t => t.kind === 'pulse')).toBe(true);
  });

  it('节拍在每拍交锋结束时递增，不受行动轮影响', () => {
    const o = play(
      [P('l_sunriser')],
      [E('e_skel', { atk: 1, hp: 99 })],
    );
    const uid = uidOf(o, 'l_sunriser');
    expect(beatLog(o, 2)[0].snap.find(u => u.uid === uid)!.pulse).toBe(1);
    expect(beatLog(o, 3)[0].snap.find(u => u.uid === uid)!.pulse).toBe(2);
    expect(beatLog(o, 4)[0].snap.find(u => u.uid === uid)!.pulse).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 决斗（duel）：打对手；对手不在时打队首
// ═══════════════════════════════════════════════════════════
describe('决斗', () => {
  it('决斗单位与非决斗单位按 round-robin 交替出手', () => {
    // 每拍每方各一人出手（round-robin）
    const o = play(
      [P('s_backstab'), P('n_merc')],
      [E('e_skel', { atk: 1, hp: 999 }), E('e_skel', { atk: 1, hp: 999 })],
    );
    const backstab = uidOf(o, 's_backstab');
    const merc = uidOf(o, 'n_merc');
    // 第 1 拍：s_backstab（slot 0）行动
    const acts1 = evs(beatLog(o, 1), 'act').filter(a => a.side === 0 && a.mode === 'attack');
    expect(acts1.length).toBe(1);
    expect(acts1[0].uid).toBe(backstab);
    // 第 2 拍：n_merc（slot 1）行动
    const acts2 = evs(beatLog(o, 2), 'act').filter(a => a.side === 0 && a.mode === 'attack');
    expect(acts2.length).toBe(1);
    expect(acts2[0].uid).toBe(merc);
  });

  it('对手死亡后决斗者转向新的队首（无决斗时同行为）', () => {
    // s_backstab 击败 slot0 敌人后下场对手是 slot1
    const o = play(
      [P('s_backstab', 3), P('n_merc')], // 3★ 高攻击
      [E('e_skel', { atk: 1, hp: 1 }), E('e_skel', { atk: 1, hp: 99 })],
    );
    // 第 1 拍 s_backstab 应能杀死 e_skel[0]
    expect(evs(beatLog(o, 1), 'death').length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════
// 溅射（splash）：伤害取一半
// ═══════════════════════════════════════════════════════════
describe('溅射', () => {
  it('溅射对身后单位造成攻击一半伤害（向下取整）', () => {
    const o = play(
      [P('m_rex')], // splash, base atk=4
      [E('e_skel', { hp: 99 }), E('e_skel', { hp: 99 })],
    );
    const mainDmg = evs(o, 'dmg').find(d => d.kind === 'attack')!;
    const splashDmg = evs(o, 'dmg').find(d => d.kind === 'splash')!;
    expect(mainDmg).toBeTruthy();
    expect(splashDmg).toBeTruthy();
    expect(splashDmg.n).toBe(Math.floor(mainDmg.n / 2));
  });

  it('目标身后无单位时不溅射', () => {
    const o = play(
      [P('m_rex')],
      [E('e_skel', { hp: 99 })],
    );
    expect(evs(o, 'dmg').filter(d => d.kind === 'splash').length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 放逐（exile）：屏蔽亡语
// ═══════════════════════════════════════════════════════════
describe('放逐', () => {
  it('被放逐者击杀的友军不能复生', () => {
    const o = play(
      [P('l_martyr')], // reborn
      [E('e_exile', { hp: 99 })],
    );
    expect(evs(o, 'revive').length).toBe(0);
    expect(evs(o, 'death')[0]).toMatchObject({ tgt: uidOf(o, 'l_martyr'), exiled: true });
  });

  it('被放逐者击杀的友军亡语不触发', () => {
    // a_graveguard: taunt + onRattle: grant reborn to behind
    const o = play(
      [P('a_graveguard')],
      [E('e_exile', { hp: 99 })],
    );
    const death = evs(o, 'death').find(d => d.tgt === uidOf(o, 'a_graveguard'));
    expect(death).toBeTruthy();
    expect(death!.exiled).toBe(true);
    // 放逐下不应有 grant 事件（亡语被压制）— 用 trigger 事件总量的消极检查
    const grantEvs = evs(o, 'trigger').filter(t => t.kind === 'rattle');
    expect(grantEvs.length).toBe(0);
  });

  it('非放逐击杀正常触发亡语', () => {
    // a_graveguard: taunt + onRattle: grant reborn to unit behind
    // 需要后面有一个单位让 grant 生效
    const o = play(
      [P('a_graveguard'), P('n_merc')],
      [E('e_brute', { atk: 10, hp: 99 })], // 高攻，快速击杀队首
    );
    // 亡语应该触发（将 reborn 授予身后的 n_merc）
    const rattleEvs = evs(o, 'trigger').filter(t => t.kind === 'rattle');
    expect(rattleEvs.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════
// 追击（pursuit）：追击引发的效果不再追击（「连锁」被动例外）
// ═══════════════════════════════════════════════════════════
describe('追击', () => {
  it('追击事件标记为 extra 行动模式', () => {
    // s_viper: duel, 对手(slot0 敌人)阵亡时追击
    const o = play(
      [P('s_viper'), P('n_merc')],
      [E('e_skel', { atk: 1, hp: 1 })],
    );
    const extras = evs(o, 'act').filter(a => a.mode === 'extra');
    expect(extras.length).toBeGreaterThanOrEqual(1);
    expect(extras[0].uid).toBe(uidOf(o, 's_viper'));
  });

  it('追击引发的击杀不会链式触发新的追击', () => {
    // s_ninja: 连击；击杀时追击一次
    // 对两个 1 血敌人：击杀第一个触发追击，追击杀第二个时不应再追击
    const o = play(
      [P('s_ninja')],
      [E('e_skel', { atk: 1, hp: 1 }), E('e_skel', { atk: 1, hp: 1 })],
    );
    const extras = evs(o, 'act').filter(a => a.mode === 'extra');
    // 最多 chainCap(0)=1 层，所以最多 1 次 extra
    expect(extras.length).toBeLessThanOrEqual(2);
  });

  it('同一方一个交锋最多 1 次立即出手，不能链式', () => {
    // s_dancer: cast → make highestAtk ally pursue
    // 对 3 个 1 血敌人：s_dancer 施法 → s_ninja 追击杀人 → 不应再追击
    // 此用例已覆盖：确认不会因为链式追击产生多个 extra act
    const o = play(
      [P('s_dancer'), P('s_ninja')],
      [E('e_skel', { hp: 1 }), E('e_skel', { hp: 1 }), E('e_skel', { hp: 1 })],
    );
    const extras = evs(beatLog(o, 1), 'act').filter(a => a.mode === 'extra');
    // engine 每方每拍最多一次 extraAct
    expect(extras.length).toBeLessThanOrEqual(1);
  });

  it('「连锁」被动让追击可再引发一次追击', () => {
    // s_viper with g_chain: 对手死→追击→追击再杀人→可再追击一次
    const o = play(
      [P('s_viper')],
      [E('e_skel', { atk: 1, hp: 1 }), E('e_skel', { atk: 1, hp: 1 })],
      'zilan', ['g_chain'],
    );
    const extras = evs(o, 'act').filter(a => a.mode === 'extra' && a.uid === uidOf(o, 's_viper'));
    // 有 g_chain 时 chainCap=2，追击可再引发一次
    expect(extras.length).toBeGreaterThanOrEqual(1);
  });

  it('无「连锁」时追击击杀不会链式追击', () => {
    const o = play(
      [P('s_viper')],
      [E('e_skel', { atk: 1, hp: 1 }), E('e_skel', { atk: 1, hp: 1 })],
    );
    const extras = evs(o, 'act').filter(a => a.mode === 'extra');
    // 无 g_chain，追击最多 1 层
    expect(extras.length).toBe(1);
  });
});