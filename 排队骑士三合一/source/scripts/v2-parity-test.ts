// v2 引擎与原型逐局对比：同一组队伍、同一种子、同一串英雄操作，两边的完整战斗日志（每条事件和快照）必须一模一样。
// 覆盖：四流派 + 随机混搭、机制遭遇（含遭遇系数）、三幕、三名英雄、全部分支组合、整局技、战中随机操作。
// 用法：pnpm test:v2:parity [局数=600]
import * as V2 from '../src/core/v2/engine';
import * as V2Teams from '../src/core/v2/teams';
import type { Faction, HeroId } from '../src/core/v2/types';

// 原型是纯 JS，没有类型：`as string` 让 TypeScript 不解析它，vite-node 仍按相对路径加载
type Mod = Record<string, any>;
const P: Mod = await import('../../prototype/engine.js' as string);
const PT: Mod = await import('../../prototype/teams.js' as string);

const proc = (globalThis as unknown as { process: { argv: string[]; exit(code: number): never } }).process;
const N = Number(proc.argv[2] || 600);
const HEROES: HeroId[] = ['dispatcher', 'pusher', 'chrono'];
const BRANCH_SETS: Record<HeroId, string[]> = {
  dispatcher: ['', 'd_orderRage', 'd_rotateHeal+d_rallyFury'],
  pusher: ['', 'p_hookExpose', 'p_shoveFreeze+p_huntBehead'],
  chrono: ['', 'c_delayAll', 'c_hasteEmpower+c_stopCounter'],
};
const FACTIONS: Array<Faction | null> = [null, 'shield', 'blade', 'abyss', 'frost'];
const ENC = Object.keys(V2Teams.ENCOUNTERS);

// 两边的组队函数必须给出同样的队伍（同一个种子的随机数序列）
function teamsFor(i: number) {
  const stage = V2Teams.STAGES[i % 3];
  const r1 = V2Teams.mulberry(1000 + i), r2 = PT.mulberry(1000 + i);
  const f = FACTIONS[i % FACTIONS.length];
  const L1 = V2Teams.makeTeam(stage, r1, f), L2 = PT.makeTeam(PT.STAGES[i % 3], r2, f);
  const useEnc = i % 2 === 1;
  const name = ENC[i % ENC.length];
  const R1 = useEnc ? V2Teams.makeEncounter(name, stage, r1) : V2Teams.makeTeam(stage, r1);
  const R2 = useEnc ? PT.makeEncounter(name, PT.STAGES[i % 3], r2) : PT.makeTeam(PT.STAGES[i % 3], r2);
  return { L1, L2, R1, R2 };
}

// 同一串英雄操作：每个窗口用独立的随机数从合法操作里挑（也可能不操作），两边必须给出同样的候选列表
function play(E: Mod, s: any, pick: () => number, mismatch: (why: string) => void, other: any, O: Mod) {
  const step = (a: any, b: any) => {
    const oa = E.heroOptions(a), ob = O.heroOptions(b);
    if (JSON.stringify(oa) !== JSON.stringify(ob)) { mismatch(`候选操作不同：${JSON.stringify(oa)} vs ${JSON.stringify(ob)}`); return false; }
    if (!oa.length) return true;
    const r = pick();
    if (r < 0.35) return true;
    const act = oa[Math.floor(r * 1000) % oa.length];
    const okA = E.heroAct(a, act), okB = O.heroAct(b, act);
    if (okA !== okB) { mismatch(`操作结果不同：${act.type}`); return false; }
    return true;
  };
  if (!step(s, other)) return;
  E.startBattle(s); O.startBattle(other);
  for (let guard = 0; guard < 40 && !s.result; guard++) {
    for (let k = 0; k < 2 && !s.result; k++) if (!step(s, other)) return;
    E.advance(s); O.advance(other);
  }
}

let fails = 0, logs = 0;
for (let i = 0; i < N; i++) {
  const { L1, L2, R1, R2 } = teamsFor(i);
  if (JSON.stringify(L1) !== JSON.stringify(L2) || JSON.stringify(R1) !== JSON.stringify(R2)) {
    console.log(`#${i} 组队不同`); fails++; continue;
  }
  const hero = HEROES[i % 3];
  const branches = BRANCH_SETS[hero][Math.floor(i / 3) % 3];
  const seed = 7 + i * 13;
  const a = V2.createBattle(L1, R1, seed, { hero, branches });
  const b = P.createBattle(L2, R2, seed, { hero, branches });
  const rng = V2Teams.mulberry(99 + i);
  let bad = '';
  play(V2, a, rng, (w) => (bad ||= w), b, P);
  if (!bad) {
    if (a.result !== b.result || a.round !== b.round) bad = `结果不同：${a.result}/${a.round} vs ${b.result}/${b.round}`;
    else if (a.log.length !== b.log.length) bad = `日志条数不同：${a.log.length} vs ${b.log.length}`;
    else for (let k = 0; k < a.log.length; k++) {
      const x = JSON.stringify(a.log[k]), y = JSON.stringify(b.log[k]);
      if (x !== y) { bad = `第 ${k} 条日志不同：\n    v2   ${x.slice(0, 300)}\n    原型 ${y.slice(0, 300)}`; break; }
    }
  }
  logs += a.log.length;
  if (bad) { fails++; if (fails <= 5) console.log(`#${i}（${hero}${branches ? ' ' + branches : ''}）${bad}`); }
}
console.log(`v2 对原型逐局对比：${N} 局，${logs} 条日志，${fails ? `不一致 ${fails} 局` : '全部一致'}`);
if (fails) proc.exit(1);
