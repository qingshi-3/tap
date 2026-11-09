import { CARD, type CardDef } from '../../src/core/data';
import {
  GOLD_PER_ROUND,
  PRICE,
  buy,
  endTurn,
  ownedAtk,
  ownedHp,
  playerTeam,
  reroll,
  sell,
  settleBattle,
  useFood,
  type Owned,
  type RunState,
  type ShopItem,
} from '../../src/core/run';
import { QUEUE_MAX, simulate, type Result, type UnitSpec } from '../../src/core/engine';

export type LifecycleRow = {
  unit: string;
  level: number;
  horizon: number;
  n: number;
  statGainDelta: [number, number];
  bankDelta: number;
  goldEarnedDelta: number;
  goldSpentDelta: number;
  scoreDelta: number;
  notes: string[];
};

export type LifecycleAudit = {
  rows: LifecycleRow[];
  battles: number;
  method: string[];
};

type Ledger = {
  statGain: [number, number];
  bank: number;
  goldEarned: number;
  goldSpent: number;
  score: number;
  battles: number;
  notes: string[];
};

const UNITS = [
  'm_egg', 'd_artificer', 's_backstab', 'l_warden', 's_ninja', 'v_mage', 'd_howler',
  'd_keeper', 'd_dunecaster', 'd_hourglass', 'a_engulf', 'd_goldob', 'd_onyx', 'd_worm',
  'd_dune', 'd_pharaoh',
] as const;
const HORIZONS = [1, 3, 5] as const;
const LEVELS = [1, 2, 3] as const;
const copiesFor = (level: number) => ([1, 3, 6] as const)[level - 1];

function memoryState(seed: number): RunState {
  return {
    v: 2, seed: seed || 1, turn: 3, lives: 10, wins: 0, gold: GOLD_PER_ROUND,
    queue: Array(QUEUE_MAX).fill(null), shop: [], nextId: 100, phase: 'prep', history: [],
    canned: 0, rerolls: 0, finalLosses: 0, enemy: { boss: 'wall', units: [] }, pendingFx: [],
  };
}

function owned(def: string, level = 1, oid = 1): Owned {
  return { oid, def, copies: copiesFor(level), atkBonus: 0, hpBonus: 0 };
}

function shopItem(r: RunState, kind: 'unit' | 'food', def: string): ShopItem {
  const out: ShopItem = { sid: r.nextId++, kind, def, locked: false, free: false };
  r.shop.push(out);
  return out;
}

function totalStats(r: RunState): [number, number] {
  return r.queue.reduce<[number, number]>((sum, o) => o
    ? [sum[0] + ownedAtk(o), sum[1] + ownedHp(o)]
    : sum, [0, 0]);
}

function totalBank(r: RunState): number {
  return r.queue.reduce((sum, o) => sum + (o?.bank ?? 0), 0);
}

function setup(unit: string, level: number, seed: number): RunState {
  const r = memoryState(seed);
  const put = (slot: number, def: string, lvl = 1, oid = slot + 1) => { r.queue[slot] = owned(def, lvl, oid); };
  switch (unit) {
    case 's_backstab': put(0, 't_wolf'); put(1, unit, level); break;
    case 'd_howler': put(0, 't_wolf'); put(1, 't_wolf', 1, 3); put(2, unit, level); break;
    case 's_ninja': put(0, 't_wolf'); put(1, unit, level); break;
    case 'l_warden':
      put(0, 'l_shield'); put(1, 'l_vigil', 1, 3); put(2, 'l_knight', 1, 4); put(3, 'l_shield', 1, 5); put(4, unit, level, 6);
      break;
    case 'v_mage': put(0, 't_wolf'); put(1, unit, level); break;
    case 'd_onyx': case 'd_goldob':
      put(0, unit, level); for (let i = 1; i < QUEUE_MAX; i++) put(i, 't_wolf', 1, i + 10);
      break;
    case 'd_artificer': case 'd_worm':
      put(0, unit, level); for (let i = 1; i < QUEUE_MAX; i++) put(i, 't_wolf', 1, i + 10);
      break;
    case 'd_dunecaster': put(1, unit, level, 2); put(2, 't_wolf', 1, 3); break;
    case 'd_hourglass': put(0, unit, level); put(1, 't_wolf', 1, 2); r.turn = 12; break;
    case 'd_keeper':
      put(0, unit, 1); r.queue[0]!.copies = level === 1 ? 1 : level === 2 ? 2 : 5; put(1, 't_wolf', 1, 2);
      break;
    case 'd_pharaoh': put(0, 't_wolf'); put(1, unit, level, 2); break;
    default: put(0, unit, level); put(1, 't_wolf', 1, 2); break;
  }
  return r;
}

const ENEMIES: UnitSpec[][] = [
  [{ def: 't_wolf', lvl: 1, atk: 2, hp: 3 }],
  [{ def: 't_wolf', lvl: 1, atk: 4, hp: 5 }, { def: 't_bonelet', lvl: 1, atk: 2, hp: 4 }],
  [{ def: 't_flame', lvl: 1, atk: 6, hp: 8 }, { def: 't_wolf', lvl: 1, atk: 4, hp: 6 }],
  [{ def: 't_statue', lvl: 1, atk: 8, hp: 12 }, { def: 't_wolf', lvl: 1, atk: 6, hp: 8 }, { def: 't_bonelet', lvl: 1, atk: 5, hp: 7 }],
  [{ def: 't_wolf', lvl: 1, atk: 10, hp: 10 }],
  [{ def: 't_flame', lvl: 1, atk: 12, hp: 15 }, { def: 't_statue', lvl: 1, atk: 8, hp: 12 }],
  [{ def: 't_bonelet', lvl: 1, atk: 14, hp: 18 }, { def: 't_wolf', lvl: 1, atk: 10, hp: 14 }, { def: 't_flame', lvl: 1, atk: 8, hp: 10 }],
  Array.from({ length: 5 }, () => ({ def: 't_wolf', lvl: 1 as const, atk: 9, hp: 11 })),
];

function ourScore(result: Result, ourSide: 0 | 1): number {
  if (result === 'draw') return 0.5;
  return (result === 'win') === (ourSide === 0) ? 1 : 0;
}

function blankClone(original: CardDef): CardDef {
  return { ...original, kws: [], ab: undefined, v: undefined, u: undefined };
}

function runArm(unit: string, level: number, horizon: number, seed: number, blank: boolean): Ledger {
  const original = CARD[unit];
  if (!original) throw new Error(`unknown lifecycle unit: ${unit}`);
  if (blank) CARD[unit] = blankClone(original);
  try {
    const r = setup(unit, level, seed);
    const startStats = totalStats(r);
    const startBank = totalBank(r);
    let goldEarned = 0;
    let goldSpent = 0;
    let battles = 0;
    const notes: string[] = [];

    for (let round = 0; round < horizon; round++) {
      r.gold = GOLD_PER_ROUND;
      r.rerolls = 0;
      if (unit === 'd_artificer' || unit === 'd_worm') {
        if (round === horizon - 1) {
          const out = sell(r, 0);
          goldEarned += out?.gold ?? 0;
          notes.push(`末轮仅出售一次；沉没购买价${copiesFor(level) * PRICE}金`);
        }
      } else if (unit === 'd_hourglass') {
        for (let i = 0; i < 4; i++) {
          const before = r.gold; reroll(r); goldSpent += before - r.gold;
        }
        notes.push('每轮两臂均真实刷新4次');
      } else if (unit === 'd_pharaoh') {
        for (let i = 0; i < 2; i++) {
          const s = shopItem(r, 'food', 'f_bread'); const before = r.gold; useFood(r, s.sid, 0); goldSpent += before - r.gold;
        }
        notes.push('每轮两臂均真实购买2份面包');
      } else if (unit === 'd_dunecaster') {
        const s = shopItem(r, 'unit', 't_wolf');
        let before = r.gold; buy(r, s.sid, 0); goldSpent += before - r.gold;
        before = r.gold; const out = sell(r, 0); goldEarned += r.gold - before;
        if (!out) notes.push('白板买卖动作未完成');
        notes.push('每轮在空位真实买卖1个无技能白板');
      } else if (unit === 'd_keeper') {
        if (round === 0) {
          const s = shopItem(r, 'food', 'f_elixir'); const before = r.gold; useFood(r, s.sid, 0); goldSpent += before - r.gold;
          notes.push(`首轮起始${level === 1 ? 1 : level === 2 ? 2 : 5}份，付3金吃秘药；${level === 1 ? '不跨星' : `跨到${level}星`}`);
        }
        endTurn(r);
      } else if (unit === 'd_goldob') {
        r.gold = 4;
        const before = r.gold; endTurn(r); goldSpent += before - r.gold;
        notes.push('每轮给定4余金；实际消耗作为机会成本列入goldSpent');
      } else if (unit === 'd_dune') {
        // Its action is turn start, reached through the public settlement path below.
      } else if (unit === 'a_engulf') {
        const prey = Array.from({ length: 3 }, () => ({ def: 't_wolf', lvl: 1 as const, atk: 1, hp: 1 }));
        const out = simulate(playerTeam(r), prey, seed * 97 + round); battles++;
        r.turn = 3; r.wins = 0; settleBattle(r, { result: 'draw', perm: out.perm });
        notes.push('每轮击杀3个白板敌人并由settleBattle写回perm');
        continue;
      } else {
        endTurn(r);
      }

      r.turn = 3;
      r.wins = 0;
      settleBattle(r, { result: 'draw', perm: {} });
      if (unit === 'd_dune') {
        const income = r.pendingFx.reduce((n, f) => n + (f.kind === 'gold' ? f.n : 0), 0);
        goldEarned += income;
        notes.push('每轮用settleBattle(draw)真实进入下回合收金');
      }
    }

    const finalStats = totalStats(r);
    const team = playerTeam(r);
    let score = 0;
    for (let enemyIndex = 0; enemyIndex < ENEMIES.length; enemyIndex++) {
      const battleSeed = seed * 1009 + enemyIndex * 37;
      const left = simulate(team, ENEMIES[enemyIndex], battleSeed); battles++; score += ourScore(left.result, 0);
      const right = simulate(ENEMIES[enemyIndex], team, battleSeed); battles++; score += ourScore(right.result, 1);
    }
    return {
      statGain: [finalStats[0] - startStats[0], finalStats[1] - startStats[1]],
      bank: totalBank(r) - startBank,
      goldEarned,
      goldSpent,
      score: score / (ENEMIES.length * 2),
      battles,
      notes,
    };
  } finally {
    if (blank) CARD[unit] = original;
  }
}

export function runLifecycle(seeds = 16): LifecycleAudit {
  const rows: LifecycleRow[] = [];
  let battles = 0;
  const sampleCount = Math.max(1, Math.floor(seeds));
  for (const unit of UNITS) for (const level of LEVELS) for (const horizon of HORIZONS) {
    const sums = { stat: [0, 0] as [number, number], bank: 0, earned: 0, spent: 0, score: 0 };
    const notes = new Set<string>();
    for (let sample = 0; sample < sampleCount; sample++) {
      const seed = sample + 1;
      const active = runArm(unit, level, horizon, seed, false);
      const blank = runArm(unit, level, horizon, seed, true);
      sums.stat[0] += active.statGain[0] - blank.statGain[0];
      sums.stat[1] += active.statGain[1] - blank.statGain[1];
      sums.bank += active.bank - blank.bank;
      sums.earned += active.goldEarned - blank.goldEarned;
      sums.spent += active.goldSpent - blank.goldSpent;
      sums.score += active.score - blank.score;
      battles += active.battles + blank.battles;
      active.notes.forEach((note) => notes.add(note));
    }
    const mean = (n: number) => n / sampleCount;
    rows.push({
      unit, level, horizon, n: sampleCount,
      statGainDelta: [mean(sums.stat[0]), mean(sums.stat[1])],
      bankDelta: mean(sums.bank),
      goldEarnedDelta: mean(sums.earned),
      goldSpentDelta: mean(sums.spent),
      scoreDelta: mean(sums.score),
      notes: [...notes, '各Delta为原能力轨迹减同面板空能力轨迹的样本均值'],
    });
  }
  return {
    rows,
    battles,
    method: [
      `默认${sampleCount}个受控种子；每条row的n为种子样本数，所有Delta均为样本均值。`,
      '高星与初始Owned、金币、位置由脚本控制；每轮金币重置为10，不跨回合累加，轨迹用于归因而非模拟正常淘汰流程。',
      '空能力对照临时替换CARD[id]为同面板、无ab/kws/v/u克隆；每次在finally恢复，不修改CARDS或SHOP_POOL。',
      '回合结束能力走endTurn；回合开始、战斗永久写回走settleBattle(draw)；控制轨迹固定turn=3以进入固定wall Boss，不读取幽灵对手。',
      '最终价值使用8组固定无技能敌阵；同一固定种子分别把待测阵容放左右两侧，以simulate纯函数计win=1/draw=0.5/lose=0。',
      '额外金币不自动购买战力；goldEarned与goldSpent独立记录。金焰方尖碑的余金消耗与属性收益同列，支出表示机会成本。',
      'statGainDelta只计最终Owned面板攻血；bankDelta单列。scoreDelta捕获蛋孵化、附魔/战斗能力及永久成长带来的最终战斗差异。',
      '出售型单位持有到末轮并只出售一次；购买价作为沉没成本写入notes，不伪造每轮重生或把毛返还当净收益。',
    ],
  };
}
