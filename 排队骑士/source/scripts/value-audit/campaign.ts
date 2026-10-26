import { CARD, SHOP_POOL, card } from '../../src/core/data';
import { simulate } from '../../src/core/engine';
import { fight, lvlOf, newRun, playerTeam, settleBattle } from '../../src/core/run';
import { shopTurn } from '../bot';

export function runCampaign(gamesPerSkill: number) {
  const runs: { skill: number; games: number; cleared: number; lost: number; unfinished: number; turns: number; livesOnClear: number }[] = [];
  const units = Object.fromEntries(SHOP_POOL.map((d) => [d.id, { id: d.id, appearances: 0, wins: 0, levels: [0, 0, 0],
    firstTurn: 100, lastTurn: 0, ablationN: 0, marginal: 0, triggers: 0, fizzles: 0, permanentAtk: 0, permanentHp: 0,
    clearedSlots: 0, sumAtk: 0, sumHp: 0 }]));
  const turns: Record<string, { games: number; wins: number; draws: number; stat: number; count: number }> = {};
  const bosses: Record<string, { games: number; wins: number }> = {};
  let battles = 0;
  const score = (r: string) => r === 'win' ? 1 : r === 'draw' ? .5 : 0;
  try {
    for (const skill of [.35, .65, .95]) {
      const group = { skill, games: gamesPerSkill, cleared: 0, lost: 0, unfinished: 0, turns: 0, livesOnClear: 0 };
      for (let i = 0; i < gamesPerSkill; i++) {
        const r = newRun(i * 104729 + 7);
        while (r.phase === 'prep' && r.turn <= 20) {
          shopTurn(r, skill);
          const own = playerTeam(r);
          const out = fight(r);
          battles++;
          const t = turns[`${skill}/${r.turn}`] ??= { games: 0, wins: 0, draws: 0, stat: 0, count: 0 };
          t.games++; t.wins += out.result === 'win' ? 1 : 0; t.draws += out.result === 'draw' ? 1 : 0;
          t.stat += own.reduce((s, u) => s + u.atk + u.hp, 0); t.count += own.length;
          if (r.enemy.boss) { const b = bosses[`${skill}/${r.enemy.boss}`] ??= { games: 0, wins: 0 }; b.games++; b.wins += out.result === 'win' ? 1 : 0; }
          for (let k = 0; k < own.length; k++) {
            const u = own[k], data = units[u.def];
            data.appearances++; data.wins += out.result === 'win' ? 1 : 0; data.levels[u.lvl - 1]++;
            data.firstTurn = Math.min(data.firstTurn, r.turn); data.lastTurn = Math.max(data.lastTurn, r.turn);
            data.sumAtk += u.atk; data.sumHp += u.hp;
            const target = out.init.find((s) => s.side === 0 && s.def === u.def && s.uid === k + 1)?.uid;
            data.triggers += out.events.filter((e) => e.t === 'trigger' && e.uid === target).length;
            data.fizzles += out.events.filter((e) => e.t === 'fizzle' && e.uid === target).length;
            const p = u.oid === undefined ? undefined : out.perm[u.oid];
            data.permanentAtk += p?.atk ?? 0; data.permanentHp += p?.hp ?? 0;
            const id = `__campaign_without_${u.def}`;
            CARD[id] = { ...card(u.def), id, ab: undefined, v: undefined, u: undefined, kws: [], perm: false };
            const counterpart = own.map((s, j) => j === k ? { ...s, def: id, ench: null, lamp: false } : s);
            // Native-card value only: attached food remains in both arms; keywords granted by food are not removed.
            counterpart[k].ench = u.ench;
            counterpart[k].lamp = u.lamp;
            const without = simulate(counterpart, r.enemy.units, (r.seed ^ (r.turn * 7919)) & 0x7fffffff);
            battles++; data.ablationN++; data.marginal += score(out.result) - score(without.result);
            delete CARD[id];
          }
          settleBattle(r, out);
        }
        group.turns += r.turn;
        if (r.phase === 'won') {
          group.cleared++; group.livesOnClear += r.lives;
          for (const o of r.queue) if (o) { units[o.def].clearedSlots++; void lvlOf(o.copies); }
        } else if (r.phase === 'lost') group.lost++; else group.unfinished++;
      }
      runs.push(group);
    }
  } finally {
    for (const d of SHOP_POOL) delete CARD[`__campaign_without_${d.id}`];
  }
  return { battles, runs, units: Object.values(units), turns, bosses, caveats: [
    '同一批种子用于三档启发式bot；skill是评分参数，不是玩家段位。',
    'bot偏好高阶、不能完整识别连锁、不锁店；出现次数与胜率不构成卡牌因果强度。',
    '正常局消融只删除当场原生技能，保留此前成长与补给；它不能测历史商店技能的总价值。',
    '只对当前实现的幽灵库与Boss采样；未重新生成或校准对手。',
    '正常局玩家固定左侧，与正式游戏一致；受控比较另外覆盖左右两侧。',
  ] };
}
