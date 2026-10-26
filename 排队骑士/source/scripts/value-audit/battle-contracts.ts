import { CARD, SHOP_POOL, card, type CardDef } from '../../src/core/data';
import { MAX_CLASHES, simulate, type BattleOut, type Ev, type UnitSpec } from '../../src/core/engine';

export interface BattleContractCheck {
  id: string;
  unitIds: string[];
  level: number | null;
  status: 'pass' | 'fail';
  expected: string;
  observed: string;
}

type Level = 1 | 2 | 3;
type Verdict = { ok: boolean; observed: string };

const spec = (def: string, lvl: Level, atk = card(def).atk, hp = card(def).hp, extra: Partial<UnitSpec> = {}): UnitSpec =>
  ({ def, lvl, atk, hp, ...extra });
const events = <T extends Ev['t']>(out: BattleOut, t: T) => out.events.filter((e): e is Extract<Ev, { t: T }> => e.t === t);
const uid = (out: BattleOut, def: string, side = 0, occurrence = 0) => out.init.filter((u) => u.def === def && u.side === side)[occurrence]?.uid;
const damageTo = (out: BattleOut, target: number | undefined, kind?: Extract<Ev, { t: 'dmg' }>['kind']) =>
  events(out, 'dmg').filter((e) => e.tgt === target && (!kind || e.kind === kind));
const buffsTo = (out: BattleOut, target: number | undefined) => events(out, 'buff').filter((e) => e.tgt === target);
const summons = (out: BattleOut, def?: string) => events(out, 'summon').filter((e) => !def || e.unit.def === def);
const json = (value: unknown) => JSON.stringify(value);

/**
 * Executable card-text contracts. These intentionally diagnose current behavior rather than
 * redefining it: a mismatch remains a failing row for the value audit to report.
 * Temporary definitions are installed only inside a check and restored in finally blocks.
 */
export function runBattleContracts(): { checks: BattleContractCheck[]; covered: string[] } {
  const checks: BattleContractCheck[] = [];
  const covered = new Set<string>();
  const check = (id: string, unitIds: string[], level: number | null, expected: string, run: () => Verdict) => {
    unitIds.forEach((x) => covered.add(x));
    try {
      const verdict = run();
      checks.push({ id, unitIds, level, status: verdict.ok ? 'pass' : 'fail', expected, observed: verdict.observed });
    } catch (error) {
      checks.push({ id, unitIds, level, status: 'fail', expected, observed: `threw: ${error instanceof Error ? error.message : String(error)}` });
    }
  };
  const levels = (id: string, expected: (lvl: Level) => string, run: (lvl: Level) => Verdict) => {
    for (const lvl of [1, 2, 3] as const) check(`${id}.lv${lvl}`, [id], lvl, expected(lvl), () => run(lvl));
  };

  levels('v_guard', (l) => `开战获得 ${card('v_guard').v![l - 1]} 层格挡，前若干次伤害各消耗一层且不掉血`, (lvl) => {
    const out = simulate([spec('v_guard', lvl, 1, 20)], [spec('l_shield', 1, 1, 20)]);
    const id = uid(out, 'v_guard');
    const gained = events(out, 'block').filter((e) => e.tgt === id).reduce((n, e) => n + e.n, 0);
    const expectedBlocks = card('v_guard').v![lvl - 1];
    const firstHits = damageTo(out, id).slice(0, expectedBlocks);
    return { ok: gained === expectedBlocks && firstHits.length === expectedBlocks && firstHits.every((e) => e.blocked && e.hp === 20), observed: `格挡+${gained}，前${expectedBlocks}次=${json(firstHits.map((e) => ({ blocked: e.blocked, hp: e.hp, block: e.block })))}` };
  });
  levels('v_snowman', (l) => `开战使紧邻身前友军获得 ${card('v_snowman').v![l - 1]} 格挡；自己在队首时没有合法目标`, (lvl) => {
    const out = simulate([spec('l_shield', 1, 0, 30), spec('v_snowman', lvl, 0, 30)], [spec('l_shield', 1, 0, 30)]);
    const front = uid(out, 'l_shield', 0);
    const b = events(out, 'block').find((e) => e.src === uid(out, 'v_snowman') && e.tgt === front);
    return { ok: !!b && b.n === card('v_snowman').v![lvl - 1], observed: b ? `身前格挡+${b.n}` : '未给予格挡' };
  });

  levels('s_fox', (l) => `开战仅随机命中一个敌人 ${card('s_fox').v![l - 1]} 点`, (lvl) => {
    const out = simulate([spec('s_fox', lvl, 1, 30)], [spec('l_shield', 1, 0, 30), spec('l_shield', 1, 0, 30)], 7);
    const src = uid(out, 's_fox');
    const shots = events(out, 'dmg').filter((e) => e.src === src && e.kind === 'shot');
    return { ok: shots.length === 1 && shots[0].n === card('s_fox').v![lvl - 1], observed: json(shots.map((e) => ({ n: e.n, tgt: e.tgt }))) };
  });

  levels('s_hunter', (l) => `开战打当时血量最高者 ${card('s_hunter').v![l - 1]} 点${l === 3 ? '，共2次并每次重新选目标' : '，共1次'}`, (lvl) => {
    const out = simulate([spec('s_hunter', lvl, 1, 40)], [spec('l_shield', 1, 0, 9), spec('l_shield', 1, 0, 20)], 1);
    const src = uid(out, 's_hunter');
    const shots = events(out, 'dmg').filter((e) => e.src === src && e.kind === 'shot');
    const expectedCount = lvl === 3 ? 2 : 1;
    const high = uid(out, 'l_shield', 1, 1);
    return { ok: shots.length === expectedCount && shots.every((e) => e.n === card('s_hunter').v![lvl - 1]) && shots[0]?.tgt === high, observed: json(shots.map((e) => ({ tgt: e.tgt, n: e.n }))) };
  });
  check('s_hunter.retarget.lv3', ['s_hunter'], 3, '★3两次伤害每次重新选择当时血量最高者', () => {
    const out = simulate([spec('s_hunter', 3, 0, 40)], [spec('l_shield', 1, 0, 9), spec('l_shield', 1, 0, 10)]);
    const shots = events(out, 'dmg').filter((e) => e.src === uid(out, 's_hunter') && e.kind === 'shot');
    const targets = [uid(out, 'l_shield', 1, 1), uid(out, 'l_shield', 1, 0)];
    return { ok: shots.length === 2 && shots[0].tgt === targets[0] && shots[1].tgt === targets[1], observed: `目标顺序=${json(shots.map((e) => e.tgt))}` };
  });

  for (const id of ['v_scout', 'v_wyvern'] as const) levels(id, (l) => `${id === 'v_scout' ? '敌方队首' : '敌方全体'}开战减攻 ${card(id).v![l - 1]}，最低为1`, (lvl) => {
    const foes = [spec('l_shield', 1, 7, 30), spec('l_shield', 1, 2, 30)];
    const out = simulate([spec(id, lvl, 0, 40)], foes);
    const src = uid(out, id);
    const debuffs = events(out, 'buff').filter((e) => e.src === src && e.atk < 0);
    const expectedCount = id === 'v_scout' ? 1 : 2;
    return { ok: debuffs.length === expectedCount && debuffs[0]?.atk === -Math.min(card(id).v![lvl - 1], 6), observed: json(debuffs.map((e) => e.atk)) };
  });

  levels('v_queen', (l) => `开战全队各获 ${card('v_queen').v![l - 1]} 格挡；每次我方格挡生效反击 ${card('v_queen').u![l - 1]}`, (lvl) => {
    const out = simulate([spec('l_shield', 1, 1, 30), spec('v_queen', lvl, 1, 30)], [spec('l_shield', 1, 1, 30)]);
    const queen = uid(out, 'v_queen');
    const blocks = events(out, 'block').filter((e) => e.src === queen);
    const shots = events(out, 'dmg').filter((e) => e.src === queen && e.kind === 'shot');
    const blocked = events(out, 'dmg').filter((e) => e.blocked && out.init.find((u) => u.uid === e.tgt)?.side === 0).length;
    return { ok: blocks.length === 2 && blocks.every((e) => e.n === card('v_queen').v![lvl - 1]) && shots.length === blocked && shots.every((e) => e.n === card('v_queen').u![lvl - 1]), observed: `格挡=${json(blocks.map((e) => e.n))}，实际挡住=${blocked}，反击=${json(shots.map((e) => e.n))}` };
  });

  levels('m_raptor', (l) => `开战在身后召唤1个 ${card('m_raptor').v![l - 1]}/${card('m_raptor').v![l - 1]} 小兽`, (lvl) => {
    const out = simulate([spec('m_raptor', lvl, 1, 20)], [spec('l_shield', 1, 0, 30)]);
    const got = summons(out, 't_wolf');
    return { ok: got.length === 1 && got[0].unit.atk === card('m_raptor').v![lvl - 1] && got[0].unit.hp === card('m_raptor').v![lvl - 1] && got[0].order[0][1] === got[0].unit.uid, observed: json(got.map((e) => ({ atk: e.unit.atk, hp: e.unit.hp, order: e.order[0] }))) };
  });
  levels('m_rex', (l) => `开战在身后召唤1个 ${card('m_rex').v![l - 1]}/${card('m_rex').v![l - 1]} 熔岩小蜥`, (lvl) => {
    const out = simulate([spec('m_rex', lvl, 1, 20)], [spec('l_shield', 1, 0, 30)]);
    const got = summons(out, 't_flame');
    return { ok: got.length === 1 && got[0].unit.atk === card('m_rex').v![lvl - 1] && got[0].unit.hp === card('m_rex').v![lvl - 1] && got[0].order[0][1] === got[0].unit.uid, observed: json(got.map((e) => ({ atk: e.unit.atk, hp: e.unit.hp, order: e.order[0] }))) };
  });
  check('summon.full.queue', ['m_raptor', 'm_rex'], 1, '满编时召唤失败，保持5个单位并产生明确失败事件', () => {
    const team = [spec('m_raptor', 1), ...Array.from({ length: 4 }, () => spec('l_shield', 1, 0, 30))];
    const out = simulate(team, [spec('l_shield', 1, 0, 30)]);
    const failed = events(out, 'fizzle').filter((e) => e.uid === uid(out, 'm_raptor') && e.label === '队伍满了');
    return { ok: summons(out, 't_wolf').length === 0 && failed.length === 1 && out.initOrder[0].length === 5, observed: `初始人数=${out.initOrder[0].length}，召唤=${summons(out).length}，失败=${json(failed)}` };
  });

  levels('a_chanter', (l) => `开战仅令身后最多 ${card('a_chanter').v![l - 1]} 名友军获得复生`, (lvl) => {
    const out = simulate([spec('a_chanter', lvl, 0, 30), spec('l_shield', 1, 0, 30), spec('l_shield', 1, 0, 30), spec('l_shield', 1, 0, 30)], [spec('l_shield', 1, 0, 30)]);
    const src = uid(out, 'a_chanter');
    const kw = events(out, 'kw').filter((e) => e.src === src && e.kws.includes('reborn'));
    return { ok: kw.length === card('a_chanter').v![lvl - 1], observed: `授予${kw.length}名` };
  });

  levels('a_imp', (l) => `阵亡原位召唤 ${card('a_imp').v![l - 1]}/${card('a_imp').v![l - 1]} 魂火`, (lvl) => {
    const out = simulate([spec('a_imp', lvl, 0, 1), spec('l_shield', 1, 0, 30)], [spec('l_shield', 1, 2, 30)]);
    const got = summons(out, 't_wisp')[0];
    return { ok: !!got && got.unit.atk === card('a_imp').v![lvl - 1] && got.unit.hp === card('a_imp').v![lvl - 1] && got.order[0][0] === got.unit.uid, observed: got ? json({ atk: got.unit.atk, hp: got.unit.hp, order: got.order[0] }) : '未召唤' };
  });
  levels('m_egg', (l) => `阵亡原位孵出基础1/1加bank的幼龙；星级不直接改变战斗内幼龙，回合成长属于run契约`, (lvl) => {
    const out = simulate([spec('m_egg', lvl, 0, 1, { bank: 4 }), spec('l_shield', 1, 0, 30)], [spec('l_shield', 1, 2, 30)]);
    const got = summons(out, 't_drakelet')[0];
    return { ok: !!got && got.unit.atk === 5 && got.unit.hp === 5 && got.order[0][0] === got.unit.uid, observed: got ? json({ atk: got.unit.atk, hp: got.unit.hp, order: got.order[0] }) : '未召唤' };
  });
  levels('m_titan', (l) => `阵亡召唤3块 ${card('m_titan').v![l - 1]}/${card('m_titan').v![l - 1]} 碎片`, (lvl) => {
    const out = simulate([spec('m_titan', lvl, 0, 1)], [spec('l_shield', 1, 20, 50)]);
    const got = summons(out, 't_statue');
    return { ok: got.length === 3 && got.every((e) => e.unit.atk === card('m_titan').v![lvl - 1] && e.unit.hp === card('m_titan').v![lvl - 1]), observed: json(got.map((e) => `${e.unit.atk}/${e.unit.hp}`)) };
  });
  check('m_titan.capacity', ['m_titan'], 1, '巨像阵亡腾出1格时，3次召唤应尽可能填到5名，即仅成功1块并明确记录另2次失败', () => {
    const out = simulate([spec('m_titan', 1, 0, 1), ...Array.from({ length: 4 }, () => spec('l_shield', 1, 0, 30))], [spec('l_shield', 1, 20, 50)]);
    return { ok: summons(out, 't_statue').length === 1 && events(out, 'fizzle').filter((e) => e.label === '队伍满了').length === 2, observed: `碎片=${summons(out, 't_statue').length}，满编失败=${events(out, 'fizzle').filter((e) => e.label === '队伍满了').length}` };
  });

  levels('a_nightmare', (l) => `阵亡对当时所有存活敌人各造成 ${card('a_nightmare').v![l - 1]} 点`, (lvl) => {
    const out = simulate([spec('a_nightmare', lvl, 0, 1)], [spec('l_shield', 1, 20, 40), spec('l_shield', 1, 0, 40)]);
    const src = uid(out, 'a_nightmare');
    const shots = events(out, 'dmg').filter((e) => e.src === src && e.kind === 'shot');
    return { ok: shots.length === 2 && shots.every((e) => e.n === card('a_nightmare').v![lvl - 1]), observed: json(shots.map((e) => e.n)) };
  });
  levels('a_cult', (l) => `阵亡把自身攻击与最大生命的 ${card('a_cult').v![l - 1]}%（向下取整）交给身后首名友军`, (lvl) => {
    const out = simulate([spec('a_cult', lvl, 10, 1), spec('l_shield', 1, 1, 20)], [spec('l_shield', 1, 20, 40)]);
    const heir = uid(out, 'l_shield', 0);
    const b = buffsTo(out, heir).find((e) => e.src === uid(out, 'a_cult'));
    const p = card('a_cult').v![lvl - 1];
    return { ok: !!b && b.atk === Math.floor(10 * p / 100) && b.hp === Math.floor(1 * p / 100), observed: b ? json({ atk: b.atk, hp: b.hp }) : '未转移' };
  });

  levels('a_graveguard', () => '首次阵亡以保留攻击、1血的自身回到队尾，且不可再次复生', (lvl) => {
    const out = simulate([spec('a_graveguard', lvl, 2, 1), spec('l_shield', 1, 0, 30)], [spec('l_shield', 1, 5, 50)]);
    const revives = events(out, 'summon').filter((e) => e.revive);
    return { ok: revives.length === 1 && revives[0].unit.def === 'a_graveguard' && revives[0].unit.atk === 2 && revives[0].unit.hp === 1 && !revives[0].unit.kws.includes('reborn'), observed: json(revives.map((e) => ({ def: e.unit.def, atk: e.unit.atk, hp: e.unit.hp, kws: e.unit.kws }))) };
  });
  check('reborn.full.after-death-slot', ['a_graveguard'], 1, '复生单位移除后队伍已有空位，应成功回到队尾；占位判断使用移除后的存活数', () => {
    const out = simulate([spec('a_graveguard', 1, 0, 1), ...Array.from({ length: 4 }, () => spec('l_shield', 1, 0, 30))], [spec('l_shield', 1, 2, 50)]);
    const revive = events(out, 'summon').find((e) => e.revive);
    return { ok: !!revive && revive.order[0].length === 5 && revive.order[0][4] === revive.unit.uid, observed: revive ? json(revive.order[0]) : `未复生；${json(events(out, 'fizzle'))}` };
  });

  levels('a_reaper', (l) => `每名友军阵亡时自身 +${card('a_reaper').v![l - 1]}/+${card('a_reaper').v![l - 1]}`, (lvl) => {
    const out = simulate([spec('l_shield', 1, 0, 1), spec('a_reaper', lvl, 1, 30)], [spec('l_shield', 1, 2, 50)]);
    const id = uid(out, 'a_reaper');
    const b = buffsTo(out, id).find((e) => e.src === id);
    return { ok: !!b && b.atk === card('a_reaper').v![lvl - 1] && b.hp === card('a_reaper').v![lvl - 1], observed: b ? json({ atk: b.atk, hp: b.hp }) : '未成长' };
  });
  levels('a_spine', (l) => `每名友军阵亡时打敌方队首 ${card('a_spine').v![l - 1]}`, (lvl) => {
    const out = simulate([spec('l_shield', 1, 0, 1), spec('a_spine', lvl, 0, 30)], [spec('l_shield', 1, 2, 50)]);
    const shots = events(out, 'dmg').filter((e) => e.src === uid(out, 'a_spine') && e.kind === 'shot');
    return { ok: shots.length >= 1 && shots[0].n === card('a_spine').v![lvl - 1], observed: json(shots.map((e) => e.n)) };
  });
  levels('a_ritualist', (l) => `友军阵亡时队尾召唤 ${card('a_ritualist').v![l - 1]}/${card('a_ritualist').v![l - 1]} 骷髅，每场最多3次`, (lvl) => {
    const out = simulate([...Array.from({ length: 4 }, () => spec('l_shield', 1, 0, 1)), spec('a_ritualist', lvl, 0, 50)], [spec('m_mankator', 3, 50, 50)]);
    const got = summons(out, 't_bonelet').filter((e) => e.src === uid(out, 'a_ritualist'));
    return { ok: got.length === 3 && got.every((e) => e.unit.atk === card('a_ritualist').v![lvl - 1]), observed: `召唤${got.length}次：${json(got.map((e) => e.unit.atk))}` };
  });
  levels('a_matriarch', (l) => `友军阵亡时队尾召唤其1/1复制品，每场最多 ${card('a_matriarch').v![l - 1]} 次，自己阵亡不复制自己`, (lvl) => {
    const out = simulate([spec('l_shield', 1, 0, 1), spec('s_fox', 1, 0, 1), spec('a_matriarch', lvl, 0, 40)], [spec('m_mankator', 3, 50, 50)]);
    const src = uid(out, 'a_matriarch');
    const got = events(out, 'summon').filter((e) => e.src === src);
    return { ok: got.length === Math.min(2, card('a_matriarch').v![lvl - 1]) && got.every((e) => e.unit.atk === 1 && e.unit.hp === 1 && e.unit.def !== 'a_matriarch'), observed: json(got.map((e) => ({ def: e.unit.def, atk: e.unit.atk, hp: e.unit.hp }))) };
  });

  levels('m_whelp', (l) => `每次友军被召唤，自身 +${card('m_whelp').v![l - 1]} 攻`, (lvl) => {
    const out = simulate([spec('m_raptor', 1, 0, 20), spec('m_whelp', lvl, 1, 30)], [spec('l_shield', 1, 0, 30)]);
    const id = uid(out, 'm_whelp');
    const b = buffsTo(out, id).find((e) => e.src === id);
    return { ok: !!b && b.atk === card('m_whelp').v![lvl - 1] && b.hp === 0, observed: b ? json({ atk: b.atk, hp: b.hp }) : '未成长' };
  });
  levels('m_incubator', (l) => `每次友军被召唤，使其 +${card('m_incubator').v![l - 1]}/+${card('m_incubator').v![l - 1]}`, (lvl) => {
    const out = simulate([spec('m_raptor', 1, 0, 20), spec('m_incubator', lvl, 0, 30)], [spec('l_shield', 1, 0, 30)]);
    const summoned = summons(out, 't_wolf')[0]?.unit.uid;
    const b = buffsTo(out, summoned).find((e) => e.src === uid(out, 'm_incubator'));
    return { ok: !!b && b.atk === card('m_incubator').v![lvl - 1] && b.hp === card('m_incubator').v![lvl - 1], observed: b ? json({ atk: b.atk, hp: b.hp, nowAtk: b.nowAtk, nowHp: b.nowHp }) : '未强化' };
  });
  levels('m_bloodcaller', (l) => `每次友军被召唤，使其获得巫兽当前攻血的 ${card('m_bloodcaller').v![l - 1]}%（向下取整）`, (lvl) => {
    const out = simulate([spec('m_raptor', 1, 0, 20), spec('m_bloodcaller', lvl, 8, 12)], [spec('l_shield', 1, 0, 30)]);
    const summoned = summons(out, 't_wolf')[0]?.unit.uid;
    const b = buffsTo(out, summoned).find((e) => e.src === uid(out, 'm_bloodcaller'));
    const p = card('m_bloodcaller').v![lvl - 1];
    return { ok: !!b && b.atk === Math.floor(8 * p / 100) && b.hp === Math.floor(12 * p / 100), observed: b ? json({ atk: b.atk, hp: b.hp }) : '未强化' };
  });
  levels('m_heart', (l) => `token召唤物 +${card('m_heart').v![l - 1]}/+${card('m_heart').v![l - 1]} 并获得50%溅射；非token复制品不触发`, (lvl) => {
    const out = simulate([spec('m_raptor', 1, 0, 20), spec('m_heart', lvl, 0, 30)], [spec('l_shield', 1, 0, 30)]);
    const summoned = summons(out, 't_wolf')[0]?.unit.uid;
    const b = buffsTo(out, summoned).find((e) => e.src === uid(out, 'm_heart'));
    const k = events(out, 'kw').find((e) => e.src === uid(out, 'm_heart') && e.tgt === summoned && e.kws.includes('splash'));
    return { ok: !!b && !!k && b.atk === card('m_heart').v![lvl - 1] && b.hp === card('m_heart').v![lvl - 1], observed: `强化=${b ? json({ atk: b.atk, hp: b.hp }) : '无'}，溅射=${!!k}` };
  });

  levels('m_kujata', (l) => `每次实际受伤后队尾召唤 ${card('m_kujata').v![l - 1]}/${card('m_kujata').v![l - 1]} 小兽，每场触发上限 ${card('m_kujata').u![l - 1]} 次且仍受5人容量限制；格挡不算受伤`, (lvl) => {
    const out = simulate([spec('m_kujata', lvl, 0, 40)], [spec('l_shield', 1, 1, 50)]);
    const src = uid(out, 'm_kujata');
    const got = summons(out, 't_wolf').filter((e) => e.src === src);
    const expectedSummons = Math.min(card('m_kujata').u![lvl - 1], 4);
    return { ok: got.length === expectedSummons && got.every((e) => e.unit.atk === card('m_kujata').v![lvl - 1]), observed: `成功召唤${got.length}次，满编失败=${events(out, 'fizzle').filter((e) => e.uid === src).length}，数值=${json(got.map((e) => e.unit.atk))}` };
  });

  levels('s_dart', (l) => `仅身前友军实际受伤时打敌方队首 ${card('s_dart').v![l - 1]}；格挡不触发`, (lvl) => {
    const out = simulate([spec('l_shield', 1, 0, 10), spec('s_dart', lvl, 0, 20)], [spec('l_shield', 1, 1, 50)]);
    const shots = events(out, 'dmg').filter((e) => e.src === uid(out, 's_dart') && e.kind === 'shot');
    return { ok: shots.length > 0 && shots.every((e) => e.n === card('s_dart').v![lvl - 1]), observed: json(shots.map((e) => e.n)) };
  });
  levels('v_bear', (l) => `我方任意格挡生效时自身 +${card('v_bear').v![l - 1]}/+${card('v_bear').v![l - 1]}`, (lvl) => {
    const out = simulate([spec('v_guard', 1, 0, 20), spec('v_bear', lvl, 1, 20)], [spec('l_shield', 1, 1, 40)]);
    const id = uid(out, 'v_bear');
    const b = buffsTo(out, id).find((e) => e.src === id);
    return { ok: !!b && b.atk === card('v_bear').v![lvl - 1] && b.hp === card('v_bear').v![lvl - 1], observed: b ? json({ atk: b.atk, hp: b.hp }) : '未成长' };
  });

  levels('m_mankator', (l) => `交锋对敌方第2位造成本次交锋伤害的 ${card('m_mankator').v![l - 1]}%（向下取整，至少1）`, (lvl) => {
    const out = simulate([spec('m_mankator', lvl, 7, 30)], [spec('l_shield', 1, 0, 30), spec('l_shield', 1, 0, 30)]);
    const second = uid(out, 'l_shield', 1, 1);
    const splash = damageTo(out, second, 'splash')[0];
    const n = Math.max(1, Math.floor(7 * card('m_mankator').v![lvl - 1] / 100));
    return { ok: !!splash && splash.n === n, observed: splash ? `${splash.n}` : '无溅射' };
  });
  levels('v_sentinel', (l) => `有格挡时交锋伤害额外 +${card('v_sentinel').v![l - 1]}，格挡被敌方同时攻击消耗不影响已锁定伤害`, (lvl) => {
    const out = simulate([spec('v_sentinel', lvl, 5, 30, { ench: 'iron' })], [spec('l_shield', 1, 1, 30)]);
    const src = uid(out, 'v_sentinel');
    const hit = events(out, 'dmg').find((e) => e.src === src && e.kind === 'melee');
    return { ok: !!hit && hit.n === 5 + card('v_sentinel').v![lvl - 1], observed: hit ? `${hit.n}` : '无交锋伤害' };
  });
  levels('v_rhyno', (l) => `交锋击杀队首后打新的队首 ${card('v_rhyno').v![l - 1]}`, (lvl) => {
    const out = simulate([spec('v_rhyno', lvl, 10, 30)], [spec('l_shield', 1, 0, 1), spec('l_shield', 1, 0, 30)]);
    const second = uid(out, 'l_shield', 1, 1);
    const shots = damageTo(out, second, 'shot').filter((e) => e.src === uid(out, 'v_rhyno'));
    return { ok: shots.length === 1 && shots[0].n === card('v_rhyno').v![lvl - 1], observed: json(shots.map((e) => e.n)) };
  });

  for (const id of ['l_shield', 'l_vigil', 'l_knight'] as const) covered.add(id);
  levels('l_vigil', (l) => `轮换单位交锋存活后退到队尾，并在退后时获得 ${card('l_vigil').v![l - 1]} 格挡`, (lvl) => {
    const out = simulate([spec('l_vigil', lvl, 0, 30), spec('l_shield', 1, 0, 30)], [spec('l_shield', 1, 0, 30)]);
    const id = uid(out, 'l_vigil');
    const rotate = events(out, 'rotate').find((e) => e.uid === id);
    const b = events(out, 'block').find((e) => e.src === id && e.tgt === id);
    return { ok: !!rotate && rotate.order[0][1] === id && !!b && b.n === card('l_vigil').v![lvl - 1], observed: `轮换=${rotate ? json(rotate.order[0]) : '无'}，格挡=${b?.n ?? 0}` };
  });
  check('l_shield.rotate', ['l_shield'], null, '天生轮换：交锋存活后从队首退到队尾', () => {
    const out = simulate([spec('l_shield', 1, 0, 30), spec('s_fox', 1, 0, 30)], [spec('l_shield', 1, 0, 30)]);
    const id = uid(out, 'l_shield');
    const r = events(out, 'rotate').find((e) => e.uid === id);
    return { ok: !!r && r.order[0][1] === id, observed: r ? json(r.order[0]) : '未轮换' };
  });
  levels('l_knight', (l) => `初始站队首不算上前；之后成为队首时每次 +${card('l_knight').v![l - 1]} 攻`, (lvl) => {
    const out = simulate([spec('l_shield', 1, 0, 30), spec('l_knight', lvl, 1, 30)], [spec('l_shield', 1, 0, 30)]);
    const id = uid(out, 'l_knight');
    const b = buffsTo(out, id).filter((e) => e.src === id && e.atk > 0);
    return { ok: b.length > 0 && b.every((e) => e.atk === card('l_knight').v![lvl - 1]), observed: `上前强化${b.length}次：${json(b.map((e) => e.atk))}` };
  });
  check('step.initial-front', ['s_step'], 1, '“上前时”不在初始队首触发；由换位或前排离开后首次成为队首才触发', () => {
    const initial = simulate([spec('s_step', 1, 0, 30)], [spec('l_shield', 1, 0, 30), spec('l_shield', 1, 0, 30)]);
    const advanced = simulate([spec('l_shield', 1, 0, 30), spec('s_step', 1, 0, 30)], [spec('l_shield', 1, 0, 30), spec('l_shield', 1, 0, 30)]);
    const initialShots = events(initial, 'dmg').filter((e) => e.src === uid(initial, 's_step') && e.kind === 'shot');
    const advancedShots = events(advanced, 'dmg').filter((e) => e.src === uid(advanced, 's_step') && e.kind === 'shot');
    return { ok: initialShots.length === 0 && advancedShots.length > 0 && advancedShots[0].n === card('s_step').v![0], observed: `初始=${initialShots.length}次，上前后=${json(advancedShots.map((e) => e.n))}` };
  });
  levels('s_step', (l) => `上前打敌方第2位 ${card('s_step').v![l - 1]}，没有第2位则打队首`, (lvl) => {
    const out = simulate([spec('l_shield', 1, 0, 30), spec('s_step', lvl, 0, 30)], [spec('l_shield', 1, 0, 40), spec('l_shield', 1, 0, 40)]);
    const second = uid(out, 'l_shield', 1, 1);
    const shot = events(out, 'dmg').find((e) => e.src === uid(out, 's_step') && e.kind === 'shot');
    return { ok: !!shot && shot.tgt === second && shot.n === card('s_step').v![lvl - 1], observed: shot ? json({ tgt: shot.tgt, n: shot.n }) : '未触发' };
  });
  levels('l_caliber', (l) => `友军实际上前时使其 +${card('l_caliber').v![l - 1]}/+${card('l_caliber').v![l - 1]}`, (lvl) => {
    const out = simulate([spec('l_shield', 1, 0, 30), spec('s_fox', 1, 1, 30), spec('l_caliber', lvl, 0, 30)], [spec('l_shield', 1, 0, 30)]);
    const target = uid(out, 's_fox');
    const b = buffsTo(out, target).find((e) => e.src === uid(out, 'l_caliber'));
    return { ok: !!b && b.atk === card('l_caliber').v![lvl - 1] && b.hp === card('l_caliber').v![lvl - 1], observed: b ? json({ atk: b.atk, hp: b.hp }) : '未强化' };
  });
  levels('l_windblade', (l) => `友军实际退后时自身 +${card('l_windblade').v![l - 1]} 攻`, (lvl) => {
    const out = simulate([spec('l_shield', 1, 0, 30), spec('l_windblade', lvl, 1, 30)], [spec('l_shield', 1, 0, 30)]);
    const id = uid(out, 'l_windblade');
    const b = buffsTo(out, id).find((e) => e.src === id);
    return { ok: !!b && b.atk === card('l_windblade').v![lvl - 1], observed: b ? json({ atk: b.atk, nowAtk: b.nowAtk }) : '未强化' };
  });
  levels('n_medic', (l) => `受伤友军退后时回复最多 ${card('n_medic').v![l - 1]}，不超过最大生命`, (lvl) => {
    const out = simulate([spec('l_shield', 1, 0, 10), spec('n_medic', lvl, 0, 30)], [spec('l_shield', 1, 3, 40)]);
    const heals = events(out, 'heal').filter((e) => e.src === uid(out, 'n_medic'));
    return { ok: heals.length > 0 && heals[0].n === Math.min(3, card('n_medic').v![lvl - 1]), observed: json(heals.map((e) => ({ n: e.n, hp: e.hp }))) };
  });
  levels('l_storm', (l) => `友军退后时打敌方队首 ${card('l_storm').v![l - 1]}${l === 3 ? '，并同时打当时第2位' : ''}`, (lvl) => {
    const out = simulate([spec('l_shield', 1, 0, 30), spec('l_storm', lvl, 0, 30)], [spec('l_shield', 1, 0, 40), spec('l_shield', 1, 0, 40)]);
    const shots = events(out, 'dmg').filter((e) => e.src === uid(out, 'l_storm') && e.kind === 'shot');
    return { ok: shots.length >= (lvl === 3 ? 2 : 1) && shots.slice(0, lvl === 3 ? 2 : 1).every((e) => e.n === card('l_storm').v![lvl - 1]), observed: json(shots.map((e) => ({ tgt: e.tgt, n: e.n }))) };
  });
  levels('n_tether', (l) => `每次交锋后让存活队首（术士自己除外）退后，每场最多 ${card('n_tether').v![l - 1]} 次`, (lvl) => {
    const out = simulate([...Array.from({ length: 4 }, () => spec('s_fox', 1, 0, 50)), spec('n_tether', lvl, 0, 50)], [spec('l_shield', 1, 0, 50)]);
    const caster = uid(out, 'n_tether');
    const tags = events(out, 'trigger').filter((e) => e.uid === caster && e.label === '让队首退后');
    const ownRotations = events(out, 'rotate').filter((e) => e.uid === caster);
    return { ok: tags.length === card('n_tether').v![lvl - 1] && ownRotations.length === 0, observed: `触发${tags.length}次，自身退后${ownRotations.length}次` };
  });
  levels('v_keeper', (l) => `每次交锋后给当时队首+1格挡，每场最多 ${card('v_keeper').v![l - 1]} 次`, (lvl) => {
    const out = simulate([spec('l_shield', 1, 0, 50), spec('v_keeper', lvl, 0, 50)], [spec('l_shield', 1, 0, 50)]);
    const src = uid(out, 'v_keeper');
    const blocks = events(out, 'block').filter((e) => e.src === src);
    return { ok: blocks.length === card('v_keeper').v![lvl - 1] && blocks.every((e) => e.n === 1), observed: `结算${blocks.length}次：${json(blocks.map((e) => e.tgt))}` };
  });

  levels('s_dancer', (l) => `紧跟在交锋者身后时，每次交锋按自身攻击的 ${card('s_dancer').v![l - 1]}%（向下取整，至少1）打敌方队首`, (lvl) => {
    const out = simulate([spec('s_fox', 1, 0, 20), spec('s_dancer', lvl, 8, 30)], [spec('l_shield', 1, 0, 40)]);
    const shots = events(out, 'dmg').filter((e) => e.src === uid(out, 's_dancer') && e.kind === 'shot');
    const n = Math.max(1, Math.floor(8 * card('s_dancer').v![lvl - 1] / 100));
    return { ok: shots.length > 0 && shots[0].n === n, observed: json(shots.map((e) => e.n)) };
  });
  levels('s_lord', (l) => `每次交锋让所有后排友军各按自身攻击的 ${card('s_lord').v![l - 1]}%齐射（向下取整，至少1）`, (lvl) => {
    const out = simulate([spec('s_fox', 1, 0, 30), spec('s_lord', lvl, 8, 30), spec('l_shield', 1, 12, 30)], [spec('l_shield', 1, 0, 50)]);
    const firstClash = events(out, 'clash')[0];
    const end = out.events.indexOf(firstClash) + 1;
    const next = out.events.findIndex((e, i) => i >= end && e.t === 'clash');
    const window = out.events.slice(end, next < 0 ? undefined : next).filter((e): e is Extract<Ev, { t: 'dmg' }> => e.t === 'dmg' && e.kind === 'shot');
    const pct = card('s_lord').v![lvl - 1];
    const expected = [Math.max(1, Math.floor(8 * pct / 100)), Math.max(1, Math.floor(12 * pct / 100))];
    return { ok: expected.every((n) => window.some((e) => e.n === n)), observed: `首轮齐射=${json(window.map((e) => ({ src: e.src, n: e.n })))}` };
  });
  check('s_lord.nonstacking', ['s_lord'], 3, '多名宗主不重复齐射，取全队最高比例结算一次', () => {
    const out = simulate([spec('s_fox', 1, 0, 30), spec('s_lord', 1, 8, 30), spec('s_lord', 3, 12, 30)], [spec('l_shield', 1, 0, 100)]);
    const tags = events(out, 'trigger').filter((e) => e.label === '齐射');
    const clashes = events(out, 'clash').length;
    return { ok: tags.length === clashes && tags.every((e) => e.uid === uid(out, 's_lord', 0, 0)), observed: `交锋=${clashes}，齐射标签=${tags.length}，来源=${json(tags.map((e) => e.uid))}` };
  });

  levels('s_master', (l) => `开战时每个后排单位（含宗师自己，若在后排）各对随机敌人造成 ${card('s_master').v![l - 1]}`, (lvl) => {
    const out = simulate([spec('s_fox', 1, 0, 30), spec('s_master', lvl, 0, 30), spec('l_shield', 1, 0, 30)], [spec('l_shield', 1, 0, 50), spec('l_shield', 1, 0, 50)], 9);
    const amount = card('s_master').v![lvl - 1];
    const openingSources = new Set<number | null | undefined>([uid(out, 's_master'), uid(out, 'l_shield', 0)]);
    const openingShots = events(out, 'dmg').filter((e) => e.kind === 'shot' && e.n === amount && openingSources.has(e.src));
    return { ok: openingShots.length >= 2, observed: json(openingShots.map((e) => ({ src: e.src, tgt: e.tgt, n: e.n }))) };
  });
  levels('s_viper', (l) => `友军技能伤害各增加 ${card('s_viper').v![l - 1]}；不增加交锋或溅射伤害`, (lvl) => {
    const out = simulate([spec('s_fox', 1, 5, 30), spec('s_viper', lvl, 0, 30)], [spec('l_shield', 1, 0, 50)], 2);
    const fox = uid(out, 's_fox');
    const shot = events(out, 'dmg').find((e) => e.src === fox && e.kind === 'shot');
    const melee = events(out, 'dmg').find((e) => e.src === fox && e.kind === 'melee');
    return { ok: !!shot && shot.n === card('s_fox').v![0] + card('s_viper').v![lvl - 1] && !!melee && melee.n === 5, observed: `技能=${shot?.n ?? '无'}，交锋=${melee?.n ?? '无'}` };
  });

  levels('a_engulf', (l) => `每场前3名敌方阵亡时自身永久 +${card('a_engulf').v![l - 1]}/+${card('a_engulf').v![l - 1]}，按oid写回`, (lvl) => {
    const out = simulate([spec('s_fox', 1, 20, 40), spec('a_engulf', lvl, 1, 30, { oid: 77 })], [spec('l_shield', 1, 0, 1), spec('l_shield', 1, 0, 1), spec('l_shield', 1, 0, 1), spec('l_shield', 1, 0, 1)]);
    const p = out.perm[77];
    const v = card('a_engulf').v![lvl - 1];
    const buffs = events(out, 'buff').filter((e) => e.src === uid(out, 'a_engulf') && e.perm);
    return { ok: !!p && p.atk === v * 3 && p.hp === v * 3 && buffs.length === 3, observed: `perm=${json(p)}，永久buff事件=${buffs.length}` };
  });
  check('a_engulf.no-oid', ['a_engulf'], 1, '没有存档oid时仍战斗内成长，但不产生不可归属的永久写回', () => {
    const out = simulate([spec('s_fox', 1, 20, 30), spec('a_engulf', 1, 1, 30)], [spec('l_shield', 1, 0, 1)]);
    const buffs = events(out, 'buff').filter((e) => e.src === uid(out, 'a_engulf'));
    return { ok: buffs.length === 1 && !buffs[0].perm && Object.keys(out.perm).length === 0, observed: `buff=${json(buffs)}，perm=${json(out.perm)}` };
  });

  levels('l_archon', (l) => `上前/退后技能额外结算 ${card('l_archon').v![l - 1]} 次；全队多名执政官合计最多额外2次`, (lvl) => {
    const out = simulate([spec('l_vigil', 1, 0, 30), spec('l_knight', 1, 1, 30), spec('l_archon', lvl, 0, 30)], [spec('l_shield', 1, 0, 30)]);
    const vigil = uid(out, 'l_vigil');
    const firstRetreatBlocks = events(out, 'block').filter((e) => e.src === vigil && e.tgt === vigil);
    const knight = uid(out, 'l_knight');
    const stepBuffs = buffsTo(out, knight).filter((e) => e.src === knight);
    const reps = 1 + Math.min(2, card('l_archon').v![lvl - 1]);
    return { ok: firstRetreatBlocks.length >= reps && stepBuffs.length >= reps, observed: `退后结算=${firstRetreatBlocks.length}，上前结算=${stepBuffs.length}，单次期望=${reps}` };
  });
  check('l_archon.cap', ['l_archon', 'l_vigil'], 3, '多个执政官的额外结算总数封顶2，即每个事件最多结算3次', () => {
    const out = simulate([spec('l_vigil', 1, 0, 30), spec('l_archon', 3, 0, 30), spec('l_archon', 3, 0, 30)], [spec('l_shield', 1, 0, 30)]);
    const vigil = uid(out, 'l_vigil');
    const beforeSecondRotate = out.events.findIndex((e) => e.t === 'rotate' && e.uid !== vigil);
    const first = out.events.slice(0, beforeSecondRotate < 0 ? undefined : beforeSecondRotate).filter((e): e is Extract<Ev, { t: 'block' }> => e.t === 'block' && e.src === vigil);
    return { ok: first.length === 3, observed: `首次退后结算${first.length}次` };
  });

  check('hurt.blocked.does-not-trigger-dart', ['s_dart', 'v_guard'], 3, '格挡完整阻止受伤，因此格挡消耗期间飞镖手不得触发', () => {
    const out = simulate([spec('v_guard', 3, 0, 20), spec('s_dart', 3, 0, 20)], [spec('l_shield', 1, 1, 100)]);
    const frontId = uid(out, 'v_guard');
    const dartId = uid(out, 's_dart');
    const firstUnblocked = out.events.findIndex((e) => e.t === 'dmg' && e.tgt === frontId && !e.blocked);
    const early = out.events.slice(0, firstUnblocked < 0 ? undefined : firstUnblocked).filter((e) => e.t === 'trigger' && e.uid === dartId);
    const blocked = damageTo(out, frontId).filter((e) => e.blocked);
    return { ok: blocked.length === 3 && early.length === 0, observed: `先挡住${blocked.length}次，首次掉血前飞镖触发${early.length}次` };
  });
  check('hurt.blocked.does-not-trigger-kujata', ['m_kujata'], 3, '格挡完整阻止受伤，因此格挡消耗期间驮岩兽不得召唤', () => {
    const out = simulate([spec('m_kujata', 3, 0, 20, { ench: 'amulet' })], [spec('l_shield', 1, 1, 100)]);
    const kujata = uid(out, 'm_kujata');
    const firstUnblocked = out.events.findIndex((e) => e.t === 'dmg' && e.tgt === kujata && !e.blocked);
    const earlySummons = out.events.slice(0, firstUnblocked < 0 ? undefined : firstUnblocked).filter((e) => e.t === 'summon' && e.src === kujata);
    return { ok: damageTo(out, kujata).filter((e) => e.blocked).length === 3 && earlySummons.length === 0, observed: `首次掉血前召唤${earlySummons.length}次` };
  });
  check('medic.undamaged-no-trigger', ['n_medic', 'l_shield'], 1, '满血友军退后时医师不触发，也不产生0治疗事件', () => {
    const out = simulate([spec('l_shield', 1, 0, 20), spec('n_medic', 1, 0, 20)], [spec('l_shield', 1, 0, 20)]);
    const medic = uid(out, 'n_medic');
    const retreat = events(out, 'rotate').find((e) => e.uid === uid(out, 'l_shield', 0));
    const heals = events(out, 'heal').filter((e) => e.src === medic);
    const tags = events(out, 'trigger').filter((e) => e.uid === medic && e.label === '友军退后');
    return { ok: !!retreat && heals.length === 0 && tags.length === 0, observed: `退后=${!!retreat}，治疗=${heals.length}，标签=${tags.length}` };
  });
  check('initial-front.step-knight-caliber', ['s_step', 'l_knight', 'l_caliber'], 1, '初始队首不视为上前：影步、骑士自身及机兵友军上前均不得在开战阶段触发', () => {
    const step = simulate([spec('s_step', 1, 0, 30), spec('l_caliber', 1, 0, 30)], [spec('l_shield', 1, 0, 30), spec('l_shield', 1, 0, 30)]);
    const knight = simulate([spec('l_knight', 1, 1, 30), spec('l_caliber', 1, 0, 30)], [spec('l_shield', 1, 0, 30)]);
    const stepEvents = step.events.filter((e) => (e.t === 'trigger' && [uid(step, 's_step'), uid(step, 'l_caliber')].includes(e.uid)) || (e.t === 'dmg' && e.src === uid(step, 's_step') && e.kind === 'shot'));
    const knightEvents = knight.events.filter((e) => e.t === 'trigger' && [uid(knight, 'l_knight'), uid(knight, 'l_caliber')].includes(e.uid));
    return { ok: stepEvents.length === 0 && knightEvents.length === 0, observed: `影步场开战相关=${stepEvents.length}，骑士场开战相关=${knightEvents.length}` };
  });
  check('step.fallback-front', ['s_step'], 2, '上前时没有敌方第2位，则精确命中敌方队首一次', () => {
    const out = simulate([spec('l_shield', 1, 0, 30), spec('s_step', 2, 0, 30)], [spec('l_shield', 1, 0, 50)]);
    const shots = events(out, 'dmg').filter((e) => e.src === uid(out, 's_step') && e.kind === 'shot');
    return { ok: shots.length >= 1 && shots[0].tgt === uid(out, 'l_shield', 1) && shots[0].n === card('s_step').v![1], observed: json(shots.map((e) => ({ tgt: e.tgt, n: e.n }))) };
  });
  check('sentinel.no-block-no-bonus', ['v_sentinel'], 2, '没有格挡时哨兵交锋只造成自身攻击，不获得格挡伤害加成', () => {
    const out = simulate([spec('v_sentinel', 2, 5, 20)], [spec('l_shield', 1, 0, 20)]);
    const hits = events(out, 'dmg').filter((e) => e.src === uid(out, 'v_sentinel') && e.kind === 'melee');
    return { ok: hits.length > 0 && hits.every((e) => e.n === 5), observed: `交锋伤害=${json(hits.map((e) => e.n))}` };
  });
  check('heart.non-token-copy', ['m_heart', 'a_matriarch'], 3, '主母召唤的普通单位复制品不是token，不触发火山之心强化或溅射授予', () => {
    const out = simulate([spec('l_shield', 1, 0, 1), spec('a_matriarch', 1, 0, 30), spec('m_heart', 3, 0, 30)], [spec('l_shield', 1, 2, 100)]);
    const copy = events(out, 'summon').find((e) => e.src === uid(out, 'a_matriarch') && e.unit.def === 'l_shield');
    const heart = uid(out, 'm_heart');
    const heartBuff = copy && events(out, 'buff').find((e) => e.src === heart && e.tgt === copy.unit.uid);
    const heartKw = copy && events(out, 'kw').find((e) => e.src === heart && e.tgt === copy.unit.uid);
    return { ok: !!copy && !heartBuff && !heartKw && copy.unit.atk === 1 && copy.unit.hp === 1, observed: `复制=${copy ? `${copy.unit.atk}/${copy.unit.hp}` : '无'}，心强化=${!!heartBuff}，授词条=${!!heartKw}` };
  });
  check('lord.first-clash.exact-sources', ['s_lord'], 2, '每次交锋恰由每名后排各射击一次，前排不参与齐射', () => {
    const out = simulate([spec('s_fox', 1, 9, 30), spec('s_lord', 2, 8, 30), spec('v_guard', 1, 12, 30)], [spec('l_shield', 1, 0, 100)]);
    const first = out.events.findIndex((e) => e.t === 'clash');
    const next = out.events.findIndex((e, i) => i > first && e.t === 'clash');
    const shots = out.events.slice(first + 1, next < 0 ? undefined : next).filter((e): e is Extract<Ev, { t: 'dmg' }> => e.t === 'dmg' && e.kind === 'shot');
    const expectedSources = [uid(out, 's_lord'), uid(out, 'v_guard')];
    return { ok: shots.length === 2 && expectedSources.every((src) => shots.filter((e) => e.src === src).length === 1) && shots.every((e) => e.src !== uid(out, 's_fox')), observed: `首轮shot=${json(shots.map((e) => ({ src: e.src, n: e.n })))}` };
  });
  check('master.opening.exact-sources', ['s_master'], 2, '宗师开战技恰由每名后排各射击一次，队首不射击', () => {
    const out = simulate([spec('l_shield', 1, 0, 30), spec('s_master', 2, 0, 30), spec('v_guard', 1, 0, 30)], [spec('l_shield', 1, 0, 100)], 17);
    const firstClash = out.events.findIndex((e) => e.t === 'clash');
    const shots = out.events.slice(0, firstClash).filter((e): e is Extract<Ev, { t: 'dmg' }> => e.t === 'dmg' && e.kind === 'shot');
    const expectedSources = [uid(out, 's_master'), uid(out, 'v_guard')];
    return { ok: shots.length === 2 && expectedSources.every((src) => shots.filter((e) => e.src === src).length === 1) && shots.every((e) => e.src !== uid(out, 'l_shield', 0)), observed: `开战shot=${json(shots.map((e) => ({ src: e.src, n: e.n })))}` };
  });
  check('archon.single-retreat-window', ['l_archon', 'l_vigil', 'l_windblade', 'n_medic', 'l_storm'], 3, '一次退后事件中，所有退后类技能在执政官封顶后各精确结算3次', () => {
    const out = simulate([spec('l_vigil', 1, 0, 20), spec('l_windblade', 1, 1, 20), spec('n_medic', 1, 0, 20), spec('l_storm', 1, 0, 20), spec('l_archon', 3, 0, 20)], [spec('l_shield', 1, 6, 100)]);
    const retreat = out.events.findIndex((e) => e.t === 'rotate' && e.uid === uid(out, 'l_vigil'));
    const nextClash = out.events.findIndex((e, i) => i > retreat && e.t === 'clash');
    const window = out.events.slice(retreat + 1, nextClash < 0 ? undefined : nextClash);
    const count = (id: string) => window.filter((e) => e.t === 'trigger' && e.uid === uid(out, id)).length;
    const observed = Object.fromEntries(['l_vigil', 'l_windblade', 'n_medic', 'l_storm'].map((id) => [id, count(id)]));
    return { ok: Object.values(observed).every((n) => n === 3), observed: json(observed) };
  });
  check('archon.single-step-window', ['l_archon', 'l_knight', 'l_caliber', 's_step'], 3, '一次上前事件中，上前类技能在执政官封顶后各精确结算3次', () => {
    const out = simulate([spec('l_vigil', 1, 0, 30), spec('l_knight', 1, 1, 30), spec('s_step', 1, 0, 30), spec('l_caliber', 1, 0, 30), spec('l_archon', 3, 0, 30)], [spec('l_shield', 1, 0, 100), spec('l_shield', 1, 0, 100)]);
    const retreat = out.events.findIndex((e) => e.t === 'rotate' && e.uid === uid(out, 'l_vigil'));
    const nextClash = out.events.findIndex((e, i) => i > retreat && e.t === 'clash');
    const window = out.events.slice(retreat + 1, nextClash < 0 ? undefined : nextClash);
    const knight = uid(out, 'l_knight');
    const caliber = uid(out, 'l_caliber');
    const counts = { knight: window.filter((e) => e.t === 'trigger' && e.uid === knight).length, caliber: window.filter((e) => e.t === 'trigger' && e.uid === caliber && e.label === '友军上前').length };
    return { ok: counts.knight === 3 && counts.caliber === 3, observed: json(counts) };
  });

  check('reborn.preserves-enchantment-and-melee', ['a_graveguard'], 1, '天生复生后保留攻击与战神酒附魔，后续交锋仍有+5伤害，且复生词条已消耗', () => {
    const out = simulate([spec('a_graveguard', 1, 2, 1, { ench: 'wine', oid: 71 }), spec('l_shield', 1, 0, 30)], [spec('l_shield', 1, 3, 100)]);
    const revive = events(out, 'summon').find((e) => e.revive && e.unit.def === 'a_graveguard');
    const hit = revive && events(out, 'dmg').find((e) => e.src === revive.unit.uid && e.kind === 'melee');
    return { ok: !!revive && revive.unit.ench === 'wine' && !revive.unit.kws.includes('reborn') && hit?.n === 7, observed: `复生=${revive ? json({ ench: revive.unit.ench, kws: revive.unit.kws }) : '无'}，后续交锋=${hit?.n ?? '无'}` };
  });
  check('reborn.preserves-oid-for-permanent-writeback', ['a_engulf'], 1, '带临时复生的吞噬之影复生后仍保留oid，随后敌方阵亡的永久成长写回原归属', () => {
    const out = simulate([spec('a_engulf', 1, 1, 1, { lamp: true, oid: 72 }), spec('l_shield', 1, 20, 30)], [spec('l_shield', 1, 2, 10)]);
    const revived = events(out, 'summon').find((e) => e.revive && e.unit.def === 'a_engulf');
    const p = out.perm[72];
    return { ok: !!revived && !!p && p.atk === 1 && p.hp === 1, observed: `复生=${!!revived}，perm[72]=${json(p)}` };
  });
  check('death-summon-before-reborn-capacity', ['a_imp'], 1, '带复生的小鬼阵亡时先原位召唤魂火；魂火占满最后空位后，复生因满编失败', () => {
    const out = simulate([spec('a_imp', 1, 0, 1, { lamp: true }), ...Array.from({ length: 4 }, () => spec('l_shield', 1, 0, 30))], [spec('l_shield', 1, 2, 100)]);
    const dead = uid(out, 'a_imp');
    const summonIndex = out.events.findIndex((e) => e.t === 'summon' && e.src === dead && e.unit.def === 't_wisp');
    const fizzleIndex = out.events.findIndex((e) => e.t === 'fizzle' && e.uid === dead && e.label === '队伍满了');
    const revive = events(out, 'summon').find((e) => e.src === dead && e.revive);
    return { ok: summonIndex >= 0 && fizzleIndex > summonIndex && !revive, observed: `魂火事件=${summonIndex}，复生失败=${fizzleIndex}，复生=${!!revive}` };
  });
  check('queue-input-truncated-to-five', ['l_shield'], null, '每侧输入超过5名时只接纳前5名，后续单位完全不进入初始快照', () => {
    const out = simulate(Array.from({ length: 7 }, () => spec('l_shield', 1, 0, 20)), Array.from({ length: 6 }, () => spec('l_shield', 1, 0, 20)));
    return { ok: out.init.filter((u) => u.side === 0).length === 5 && out.init.filter((u) => u.side === 1).length === 5 && out.initOrder[0].length === 5 && out.initOrder[1].length === 5, observed: `快照=${out.init.filter((u) => u.side === 0).length}/${out.init.filter((u) => u.side === 1).length}` };
  });
  check('empty-team-results', [], null, '空队对空队为平局；仅一侧为空时该侧失败且另一侧获胜，均无交锋', () => {
    const both = simulate([], []);
    const left = simulate([], [spec('l_shield', 1)]);
    const right = simulate([spec('l_shield', 1)], []);
    return { ok: both.result === 'draw' && left.result === 'lose' && right.result === 'win' && [both, left, right].every((o) => events(o, 'clash').length === 0), observed: `结果=${both.result}/${left.result}/${right.result}，交锋=${[both, left, right].map((o) => events(o, 'clash').length).join('/')}` };
  });
  check('simultaneous-front-death-draw', [], null, '双方队首同次交锋互相致死且均无后备时，双方死亡均结算并判平', () => {
    const out = simulate([spec('l_shield', 1, 1, 1)], [spec('l_shield', 1, 1, 1)]);
    const deaths = events(out, 'die');
    return { ok: deaths.length === 2 && new Set(deaths.map((e) => e.uid)).size === 2 && out.result === 'draw', observed: `死亡=${json(deaths.map((e) => e.uid))}，结果=${out.result}` };
  });

  check('death.batch.order', ['a_spine', 'a_nightmare', 'a_reaper'], null, '同一伤害批次标死的单位按当前队列顺序逐个移除，每个阵亡触发都针对当时仍存活/尚未移除的对象', () => {
    const out = simulate([spec('a_nightmare', 1, 0, 1), spec('a_spine', 1, 0, 1), spec('a_reaper', 1, 0, 20)], [spec('m_mankator', 3, 50, 50)]);
    const deaths = events(out, 'die').slice(0, 2).map((e) => e.uid);
    const expected = [uid(out, 'a_nightmare'), uid(out, 'a_spine')];
    return { ok: deaths[0] === expected[0] && deaths[1] === expected[1], observed: `前两次死亡=${json(deaths)}，初始队列期望=${json(expected)}` };
  });
  check('battle.max-clashes.draw', ['l_shield'], null, `双方在 ${MAX_CLASHES} 次交锋后均存活则平局`, () => {
    const out = simulate([spec('l_shield', 1, 0, 1000)], [spec('l_shield', 1, 0, 1000)]);
    return { ok: events(out, 'clash').length === MAX_CLASHES && out.result === 'draw', observed: `交锋=${events(out, 'clash').length}，结果=${out.result}` };
  });
  check('battle.stat-cap', ['l_caliber'], null, '战斗内攻击和最大生命封顶50，事件也应报告实际封顶后的数值', () => {
    const out = simulate([spec('l_shield', 1, 0, 30), spec('s_fox', 1, 49, 49), spec('l_caliber', 3, 0, 30)], [spec('l_shield', 1, 0, 30)]);
    const b = buffsTo(out, uid(out, 's_fox')).find((e) => e.src === uid(out, 'l_caliber'));
    return { ok: !!b && b.nowAtk === 50 && b.nowHp === 50, observed: b ? json({ requestedAtk: b.atk, requestedHp: b.hp, nowAtk: b.nowAtk, nowHp: b.nowHp }) : '未强化' };
  });

  // A synchronous temporary card makes the exact cap observable without adding production data.
  check('battle.temp-definition-restored', [], null, '审计用临时卡定义只在同步检查期间存在，finally后完整还原CARD', () => {
    const id = '__audit_plain__';
    const previous = CARD[id];
    const temp: CardDef = { id, name: '审计沙袋', tier: 1, atk: 0, hp: 1, kws: [], text: '', line: 'enemy', enemy: true };
    try {
      CARD[id] = temp;
      const out = simulate([spec('l_shield', 1, 0, 1000)], [{ def: id, lvl: 1, atk: 0, hp: 1000 }]);
      return { ok: events(out, 'clash').length === MAX_CLASHES, observed: `临时定义交锋=${events(out, 'clash').length}` };
    } finally {
      if (previous) CARD[id] = previous;
      else delete CARD[id];
    }
  });

  // Explicitly list combat-relevant cards omitted by mistake as a diagnostic failure.
  const combatCards = SHOP_POOL.filter((d) => d.ab || d.kws.some((k) => ['rotate', 'reborn', 'splash'].includes(k)))
    .filter((d) => !['artificer', 'backstab', 'dune', 'warden', 'ninja', 'mage', 'howler', 'keeper', 'dunecaster', 'hourglass', 'goldob', 'pharaoh', 'onyx', 'worm'].includes(d.ab ?? ''));
  const missing = combatCards.map((d) => d.id).filter((id) => !covered.has(id));
  check('coverage.combat-cards', missing, null, '所有具有战斗技能或天生战斗关键词的玩家单位都有专项契约', () => ({ ok: missing.length === 0, observed: missing.length ? `缺少：${missing.join('、')}` : `已覆盖${combatCards.length}个战斗单位` }));

  return { checks, covered: [...covered].sort() };
}
