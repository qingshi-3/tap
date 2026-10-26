import { CARD, SHOP_POOL, card } from '../../src/core/data';
import { simulate, type BattleOut, type UnitSpec } from '../../src/core/engine';

type Level = 1 | 2 | 3;
type Growth = 0 | 6 | 18;
type Side = 0 | 1;

interface Shell {
  role: string;
  support: string[];
}
interface FoeCase {
  id: string;
  note: string;
  make: (level: Level, growth: Growth) => UnitSpec[];
}
interface Setup {
  role: string;
  support: string[];
  position: number;
  level: Level;
  growth: Growth;
  foe: string;
}
interface ArmScore {
  factual: number;
  blank: number;
  delta: number;
  wins: number;
  draws: number;
  blankWins: number;
  blankDraws: number;
}
export interface NicheRow {
  unit: string;
  applicable: true;
  bestSetup: Setup;
  trainDelta: number;
  holdoutDelta: number;
  n: number;
  scores: ArmScore;
  details: {
    trainN: number;
    holdoutSeeds: number;
    leftDelta: number;
    rightDelta: number;
    peers?: { alternative: string; n: number; unitScore: number; alternativeScore: number; delta: number }[];
  };
}
export interface SummonSpaceRow {
  unit: 'm_raptor' | 'm_rex' | 'm_kujata' | 'm_titan';
  foe: string;
  level: Level;
  growth: Growth;
  size: 3 | 4 | 5;
  n: number;
  openScore: number;
  filledScore: number;
  delta: number;
  openSummons: number;
  filledSummons: number;
}

const BLANK = '__niche_blank__';
const FILL = '__niche_fill__';
const cap = (n: number) => Math.max(1, Math.min(50, n));
const unit = (def: string, level: Level, growth: Growth, atk?: number, hp?: number, oid?: number): UnitSpec => {
  const d = card(def);
  const copies = [0, 2, 5][level - 1];
  return {
    def, lvl: level,
    atk: cap(atk ?? d.atk + copies + growth),
    hp: cap(hp ?? d.hp + copies + growth),
    oid,
    ...(d.ab === 'egg' ? { bank: Math.min(40, growth) } : {}),
  };
};
const fixed = (def: string, level: Level, atk: number, hp: number): UnitSpec => ({ def, lvl: level, atk: cap(atk), hp: cap(hp) });
const score = (out: BattleOut, side: Side) => out.result === 'draw' ? .5 : (out.result === 'win') === (side === 0) ? 1 : 0;
const play = (ours: UnitSpec[], foes: UnitSpec[], seed: number, side: Side) => side === 0 ? simulate(ours, foes, seed) : simulate(foes, ours, seed);

// Each shell is authored around the card's actual trigger. Order matters before candidate insertion.
const SHELLS: Record<string, Shell> = {
  l_shield: { role: 'rotate-front', support: ['l_windblade', 'n_medic', 'l_caliber', 's_step'] },
  l_windblade: { role: 'ally-retreat', support: ['l_shield', 'l_vigil', 'n_medic', 'l_caliber'] },
  s_dart: { role: 'hurt-follower', support: ['l_shield', 'n_medic', 'v_guard', 's_dancer'] },
  s_fox: { role: 'opening-shot', support: ['s_viper', 'v_guard', 's_dancer', 'l_shield'] },
  a_imp: { role: 'death-summon', support: ['a_reaper', 'a_ritualist', 'm_incubator'] },
  a_spine: { role: 'ally-death', support: ['a_imp', 'a_graveguard', 'a_reaper', 'a_ritualist'] },
  m_egg: { role: 'death-hatch', support: ['m_incubator', 'm_whelp', 'm_bloodcaller'] },
  m_whelp: { role: 'summon-payoff', support: ['m_raptor', 'a_imp', 'm_incubator'] },
  v_guard: { role: 'block-front', support: ['v_bear', 'v_queen', 's_dart', 'n_medic'] },
  l_vigil: { role: 'retreat-block', support: ['l_windblade', 'n_medic', 'l_caliber', 's_step'] },
  n_tether: { role: 'forced-retreat', support: ['s_fox', 's_dart', 'n_medic', 'l_windblade'] },
  s_step: { role: 'step-shot', support: ['l_shield', 'l_caliber', 's_viper', 'n_medic'] },
  a_graveguard: { role: 'reborn-front', support: ['a_reaper', 'a_ritualist', 'a_spine', 'm_incubator'] },
  a_reaper: { role: 'ally-death-grow', support: ['a_imp', 'a_graveguard', 'a_ritualist', 'a_spine'] },
  m_raptor: { role: 'opening-summon-space', support: ['m_incubator', 'm_whelp', 'm_bloodcaller'] },
  v_snowman: { role: 'shield-ahead', support: ['v_sentinel', 'v_bear', 'v_queen', 'l_shield'] },
  v_scout: { role: 'opening-front-debuff', support: ['v_guard', 's_dancer', 's_viper', 'l_shield'] },
  n_medic: { role: 'low-damage-long-rotate', support: ['l_shield', 'l_shield', 'l_windblade', 's_step'] },
  s_dancer: { role: 'clash-follower', support: ['v_guard', 's_viper', 's_dart', 'l_shield'] },
  a_ritualist: { role: 'triple-death-summon', support: ['a_imp', 'a_graveguard', 'a_reaper'] },
  m_incubator: { role: 'summon-buff', support: ['m_raptor', 'a_imp', 'm_whelp'] },
  m_kujata: { role: 'hurt-summon-space', support: ['m_incubator', 'm_whelp', 'm_bloodcaller'] },
  l_caliber: { role: 'step-buff', support: ['l_shield', 'l_vigil', 's_step', 'l_knight'] },
  l_knight: { role: 'repeat-step', support: ['l_shield', 'l_caliber', 'n_medic', 'l_windblade'] },
  s_hunter: { role: 'highest-hp-opening', support: ['s_viper', 'v_guard', 's_dancer', 'l_shield'] },
  a_chanter: { role: 'grant-reborn', support: ['a_imp', 'a_reaper', 'a_ritualist', 'a_spine'] },
  a_cult: { role: 'death-transfer', support: ['v_guard', 'a_reaper', 'a_ritualist', 'a_spine'] },
  m_rex: { role: 'opening-summon-space', support: ['m_incubator', 'm_whelp', 'm_bloodcaller'] },
  v_keeper: { role: 'post-clash-shield', support: ['v_sentinel', 'v_bear', 'v_queen', 'l_shield'] },
  v_sentinel: { role: 'shielded-clash', support: ['v_snowman', 'v_bear', 'v_queen', 'v_keeper'] },
  l_storm: { role: 'retreat-shot', support: ['l_shield', 'l_vigil', 'n_medic', 'l_caliber'] },
  s_viper: { role: 'skill-damage-aura', support: ['s_fox', 's_dart', 's_hunter', 's_dancer'] },
  s_master: { role: 'backline-opening-volley', support: ['v_guard', 's_viper', 's_dart', 's_hunter'] },
  a_engulf: { role: 'enemy-death-permanent', support: ['s_hunter', 's_fox', 'v_guard', 's_dancer'] },
  m_bloodcaller: { role: 'summon-percent-buff', support: ['m_raptor', 'a_imp', 'm_incubator'] },
  m_mankator: { role: 'splash-wide', support: ['v_guard', 's_viper', 's_dancer', 'l_shield'] },
  v_bear: { role: 'friendly-block-payoff', support: ['v_guard', 'v_snowman', 'v_queen', 'v_keeper'] },
  v_rhyno: { role: 'front-kill-chain', support: ['v_snowman', 'v_guard', 's_viper', 'l_shield'] },
  l_archon: { role: 'step-retreat-repeat', support: ['s_step', 'l_vigil', 'l_caliber', 'l_storm'] },
  s_lord: { role: 'backline-clash-volley', support: ['v_guard', 's_viper', 's_dancer', 's_hunter'] },
  a_matriarch: { role: 'death-copy', support: ['a_imp', 'a_graveguard', 'a_reaper', 'm_incubator'] },
  a_nightmare: { role: 'death-aoe', support: ['a_reaper', 'a_ritualist', 'a_spine', 's_viper'] },
  m_titan: { role: 'triple-death-summon-space', support: ['m_incubator', 'm_whelp'] },
  m_heart: { role: 'token-summon-payoff', support: ['m_raptor', 'a_imp', 'm_incubator'] },
  v_queen: { role: 'team-block-retaliate', support: ['v_guard', 'v_snowman', 'v_bear', 'v_sentinel'] },
  v_wyvern: { role: 'opening-wide-debuff', support: ['v_guard', 's_dancer', 's_viper', 'l_shield'] },
};

const FOES: FoeCase[] = [
  { id: 'chip-five', note: '小伤持久五人队', make: (l, g) => Array.from({ length: 5 }, () => fixed('l_shield', l, 1 + Math.floor(g / 9), 18 + g)) },
  { id: 'medium-five', note: '中伤五人队', make: (l, g) => Array.from({ length: 5 }, () => fixed('s_fox', l, 5 + Math.floor(g / 3), 10 + g)) },
  { id: 'burst-three', note: '高伤三人队', make: (l, g) => Array.from({ length: 3 }, () => fixed('v_rhyno', l, 14 + Math.floor(g / 2), 10 + g)) },
  { id: 'execution-five', note: '高伤低血队', make: (l, g) => Array.from({ length: 5 }, () => fixed('l_shield', l, 18 + Math.floor(g / 2), 4 + Math.floor(g / 3))) },
  { id: 'tall-two', note: '双高血目标', make: (l, g) => [fixed('v_guard', l, 6 + Math.floor(g / 3), 38 + g), fixed('l_shield', l, 8 + Math.floor(g / 3), 46 + g)] },
  { id: 'shield-wall', note: '全盾机制队', make: (l, g) => ['v_guard', 'v_keeper', 'v_bear', 'v_queen', 'v_snowman'].map((id) => unit(id, l, g)) },
  { id: 'rotate-wheel', note: '轮换机制队', make: (l, g) => ['l_vigil', 'l_shield', 'n_medic', 'l_caliber', 's_step'].map((id) => unit(id, l, g)) },
  { id: 'death-chain', note: '死亡与复生队', make: (l, g) => ['a_imp', 'a_graveguard', 'a_reaper', 'a_ritualist', 'a_spine'].map((id) => unit(id, l, g)) },
  { id: 'summon-open', note: '四人召唤队', make: (l, g) => ['m_raptor', 'm_incubator', 'm_bloodcaller', 'm_whelp'].map((id) => unit(id, l, g)) },
  { id: 'splash-wide', note: '宽队与溅射', make: (l, g) => ['m_mankator', 's_dancer', 's_viper', 's_dart', 's_fox'].map((id) => unit(id, l, g)) },
  { id: 'opening-barrage', note: '开战技能队', make: (l, g) => ['s_fox', 's_hunter', 's_master', 'v_scout', 'v_wyvern'].map((id) => unit(id, l, g)) },
  { id: 'mixed-backline', note: '混合后排队', make: (l, g) => ['v_guard', 's_dart', 's_dancer', 'a_spine', 'm_incubator'].map((id) => unit(id, l, g)) },
];

function combatIds() {
  const shopOnly = new Set(['artificer', 'backstab', 'dune', 'warden', 'ninja', 'mage', 'howler', 'keeper', 'dunecaster', 'hourglass', 'goldob', 'pharaoh', 'onyx', 'worm']);
  return SHOP_POOL.filter((d) => (d.ab || d.kws.some((k) => ['rotate', 'reborn', 'splash'].includes(k))) && !shopOnly.has(d.ab ?? '')).map((d) => d.id);
}
function makeTeam(id: string, setup: Pick<Setup, 'support' | 'position' | 'level' | 'growth'>) {
  const support = setup.support.filter((x) => x !== id).map((x) => unit(x, setup.level, setup.growth));
  support.splice(Math.min(setup.position, support.length), 0, unit(id, setup.level, setup.growth, undefined, undefined, 1));
  return support.slice(0, 5);
}
function blankTeam(team: UnitSpec[], id: string, blankId: string) {
  let changed = false;
  return team.map((u) => {
    if (!changed && u.def === id) { changed = true; return { ...u, def: blankId }; }
    return { ...u };
  });
}
function evaluate(ours: UnitSpec[], blank: UnitSpec[], foes: UnitSpec[], seeds: number[], seedBase: number) {
  const result: ArmScore = { factual: 0, blank: 0, delta: 0, wins: 0, draws: 0, blankWins: 0, blankDraws: 0 };
  let leftDelta = 0, rightDelta = 0;
  for (const seedIndex of seeds) for (const side of [0, 1] as const) {
    const seed = seedBase + seedIndex * 104729;
    const factual = play(ours, foes, seed, side);
    const without = play(blank, foes, seed, side);
    const a = score(factual, side), b = score(without, side), delta = a - b;
    result.factual += a; result.blank += b; result.delta += delta;
    result.wins += a === 1 ? 1 : 0; result.draws += a === .5 ? 1 : 0;
    result.blankWins += b === 1 ? 1 : 0; result.blankDraws += b === .5 ? 1 : 0;
    if (side === 0) leftDelta += delta; else rightDelta += delta;
  }
  return { result, leftDelta, rightDelta, n: seeds.length * 2 };
}

export function runNiche(seeds = 16): { rows: NicheRow[]; summonSpace: SummonSpaceRow[]; battles: number; method: Record<string, unknown> } {
  const ids = combatIds();
  const rows: NicheRow[] = [];
  const summonSpace: SummonSpaceRow[] = [];
  const previousBlank = CARD[BLANK];
  const previousFill = CARD[FILL];
  let battles = 0;
  CARD[BLANK] = { id: BLANK, name: '定向审计白板', tier: 1, atk: 1, hp: 1, kws: [], line: 'enemy', text: '' };
  CARD[FILL] = { id: FILL, name: '中性补位', tier: 1, atk: 2, hp: 3, kws: [], line: 'enemy', text: '' };
  try {
    for (const id of ids) {
      const shell = SHELLS[id];
      if (!shell) throw new Error(`缺少定向壳：${id}`);
      const d = card(id);
      const blankId = `__niche_without_${id}`;
      const previous = CARD[blankId];
      CARD[blankId] = { ...d, id: blankId, ab: undefined, v: undefined, u: undefined, kws: [], perm: false, text: '' };
      try {
        let best: { setup: Setup; delta: number; n: number } | null = null;
        for (const level of [1, 2, 3] as const) for (const growth of [0, 6, 18] as const) {
          for (let position = 0; position <= shell.support.length; position++) for (const foe of FOES) {
            const setup: Setup = { role: shell.role, support: [...shell.support], position, level, growth, foe: foe.id };
            const ours = makeTeam(id, setup);
            const blank = blankTeam(ours, id, blankId);
            const train = evaluate(ours, blank, foe.make(level, growth), [1, 2], 310001);
            battles += train.n * 2;
            if (!best || train.result.delta / train.n > best.delta / best.n) best = { setup, delta: train.result.delta, n: train.n };
          }
        }
        if (!best) throw new Error(`没有可用场景：${id}`);
        const foe = FOES.find((x) => x.id === best!.setup.foe)!;
        const ours = makeTeam(id, best.setup);
        const blank = blankTeam(ours, id, blankId);
        const holdoutSeeds = Array.from({ length: Math.max(1, seeds) }, (_, i) => i + 1);
        const holdout = evaluate(ours, blank, foe.make(best.setup.level, best.setup.growth), holdoutSeeds, 1700003);
        battles += holdout.n * 2;
        let peers: NicheRow['details']['peers'];
        if (id === 'v_queen') {
          peers = [];
          const enemy = foe.make(best.setup.level, best.setup.growth);
          const otherSixes = ids.filter((other) => other !== id && card(other).tier === 6);
          for (const alternative of otherSixes) {
            const other = ours.map((u) => u.oid === 1 ? unit(alternative, best!.setup.level, best!.setup.growth, undefined, undefined, 1) : { ...u });
            let unitScore = 0, alternativeScore = 0;
            for (const seedIndex of holdoutSeeds) for (const side of [0, 1] as const) {
              const seed = 2300003 + seedIndex * 104729;
              unitScore += score(play(ours, enemy, seed, side), side);
              alternativeScore += score(play(other, enemy, seed, side), side);
              battles += 2;
            }
            const n = holdoutSeeds.length * 2;
            peers.push({ alternative, n, unitScore: unitScore / n, alternativeScore: alternativeScore / n, delta: (unitScore - alternativeScore) / n });
          }
        }
        rows.push({
          unit: id, applicable: true, bestSetup: best.setup,
          trainDelta: best.delta / best.n, holdoutDelta: holdout.result.delta / holdout.n, n: holdout.n,
          scores: holdout.result,
          details: {
            trainN: best.n, holdoutSeeds: holdoutSeeds.length,
            leftDelta: holdout.leftDelta / holdoutSeeds.length, rightDelta: holdout.rightDelta / holdoutSeeds.length,
            ...(peers ? { peers } : {}),
          },
        });
      } finally {
        if (previous) CARD[blankId] = previous;
        else delete CARD[blankId];
      }
    }

    const summonIds = ['m_raptor', 'm_rex', 'm_kujata', 'm_titan'] as const;
    const studySupport: Record<(typeof summonIds)[number], string[]> = {
      m_raptor: ['m_incubator', 'm_whelp', 'm_bloodcaller', 'm_heart'],
      m_rex: ['m_incubator', 'm_whelp', 'm_bloodcaller', 'm_heart'],
      m_kujata: ['m_incubator', 'm_whelp', 'm_bloodcaller', 'm_heart'],
      m_titan: ['m_incubator', 'm_whelp', 'm_bloodcaller', 'm_heart'],
    };
    const studySeeds = Array.from({ length: Math.max(1, seeds) }, (_, i) => i + 1);
    for (const id of summonIds) for (const foe of FOES) for (const level of [1, 2, 3] as const) for (const growth of [0, 6, 18] as const) for (const size of [3, 4, 5] as const) {
      const base = [unit(id, level, growth, undefined, undefined, 1), ...studySupport[id].slice(0, size - 1).map((x) => unit(x, level, growth))];
      const copyBonus = [0, 2, 5][level - 1];
      const filled = [...base, ...Array.from({ length: 5 - base.length }, () => ({
        def: FILL, lvl: level, atk: cap(2 + copyBonus + growth), hp: cap(3 + copyBonus + growth),
      }))];
      const fixedFoe = foe.make(level, growth);
      let openScore = 0, filledScore = 0, openSummons = 0, filledSummons = 0;
      for (const seedIndex of studySeeds) for (const side of [0, 1] as const) {
        const seed = 2900009 + seedIndex * 65537;
        const open = play(base, fixedFoe, seed, side), full = play(filled, fixedFoe, seed, side);
        openScore += score(open, side); filledScore += score(full, side);
        const openUid = open.init.find((u) => u.side === side && u.def === id)?.uid;
        const fullUid = full.init.find((u) => u.side === side && u.def === id)?.uid;
        openSummons += open.events.filter((e) => e.t === 'summon' && e.src === openUid).length;
        filledSummons += full.events.filter((e) => e.t === 'summon' && e.src === fullUid).length;
        battles += 2;
      }
      const n = studySeeds.length * 2;
      summonSpace.push({ unit: id, foe: foe.id, level, growth, size, n, openScore: openScore / n, filledScore: filledScore / n, delta: (openScore - filledScore) / n, openSummons: openSummons / n, filledSummons: filledSummons / n });
    }
  } finally {
    if (previousBlank) CARD[BLANK] = previousBlank; else delete CARD[BLANK];
    if (previousFill) CARD[FILL] = previousFill; else delete CARD[FILL];
  }
  return {
    rows, summonSpace, battles,
    method: {
      train: '每单位在手工定向支持壳中扫描全部位置、★1/2/3、成长+0/+6/+18和12类敌人；2个探索种子且左右各一次，只用于选场景。',
      holdout: `固定所选场景后，以不同seed域的${Math.max(1, seeds)}个种子、左右各一次验证；holdoutDelta才是报告效果。`,
      control: '同身材clone仅移除候选原生技能与天生关键词；队友、敌人、位置、随机种子完全配对。胜=1、平=.5、负=0。',
      warning: '探索最大值存在选择偏差，不把trainDelta当作真实效果；holdout仍是定向有利壳结果，不代表自然出现率或全局强度。',
      availability: 'niche支持单位不按候选阶层限制；这些是用于兑现技能的成熟跨阶定向壳，不代表候选初次出现回合可达。',
      foes: FOES.map(({ id, note }) => ({ id, note })),
      summonSpace: '四张召唤牌按12类敌人×★1/2/3×成长+0/+6/+18×队伍3/4/5人展开。每个条件内原base完全不变，另一臂只用无技能中性单位补到5人；补位体为基础2/3加对应copy bonus与growth。同一条件共享敌人、seed和左右侧。跨size会增加一名定向支持，是明确的阵容规模维度，不能把不同size间差值解释为只改变空位的单因素效应。',
    },
  };
}
