// 自然获取：使用公开入口，不注入资源。vite-node scripts/v09-journey-test.ts [seed] [count] [combo|baseline]
// @ts-ignore Node modules are available to vite-node.
import { createHash } from 'node:crypto';
// @ts-ignore Node modules are available to vite-node.
import { readFileSync, writeFileSync } from 'node:fs';
import { newRun, fight, settleBattle } from '../src/core/run';
import { shopTurn, nodeStep, setBotTrace, setComboFocus } from './bot';
const args = (globalThis as any).process.argv.slice(2);
const first = Number(args[0] ?? 1), count = Number(args[1] ?? 100), strategy = args[2] ?? 'combo';
setComboFocus(strategy === 'combo');
const sourceVersion = Object.fromEntries(['src/core/data.ts', 'src/core/run.ts', 'src/core/engine.ts', 'scripts/bot.ts', 'scripts/v09-journey-test.ts'].map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
function journey(seed: number) {
  const r = newRun(seed, { diff: 0 });
  const actions: any[] = [], battles: any[] = [], turns: any[] = [];
  let grew = false, echo = false, bone = false, echoPending = 0;
  const echoCards = new Set<number>(), echoBoneTargets = new Set<number>();
  const chain: any[] = [];
  setBotTrace((action, json, state, detail: any) => {
    const before = JSON.parse(json), oldQ = before.queue as any[];
    const growth = state.queue.flatMap(o => {
      const old = oldQ.find(x => x?.oid === o?.oid);
      return o && old && (o.atkBonus > old.atkBonus || o.hpBonus > old.hpBonus) ? [{ oid: o.oid, def: o.def, from: [old.atkBonus, old.hpBonus], to: [o.atkBonus, o.hpBonus] }] : [];
    });
    if (action.startsWith('cast') && detail.out?.ok && detail.out?.fx?.some((fx: any) => fx.label === '施法' && oldQ.some(o => o?.def === 'd_keeper' && o.oid === fx.src)) && growth.length) grew = true;
    const newDiscover = (state.discover?.length ?? 0) > (before.discover?.length ?? 0) ? structuredClone(state.discover) : undefined;
    if (action.startsWith('cast') && detail.detail?.spell === 'x_echo' && detail.out?.ok && newDiscover) {
      const added = newDiscover.slice(before.discover?.length ?? 0);
      echo = true; echoPending += added.length; chain.push({ turn: state.turn, step: 'echo', target: detail.detail.target, options: added });
    }
    if (action === 'discover' && echoPending && before.discover?.[0]?.mode === 'spell') {
      const oldIds = new Set([...(before.hand as any[]).filter(Boolean), ...(before.rewards ?? []).map((x: any) => x.card)].filter(Boolean).map(x => x.oid));
      const produced = [...state.hand.filter(Boolean), ...(state.rewards ?? []).map(x => x.card)].filter(x => x && !oldIds.has(x.oid));
      for (const x of produced) echoCards.add(x!.oid);
      chain.push({ turn: state.turn, step: 'echo-discovery', cards: produced }); echoPending--;
    }
    if (action === 'cast-held' && detail.out?.ok) {
      const removed = (before.hand as any[]).find(x => x && echoCards.has(x.oid) && !state.hand.some(y => y?.oid === x.oid));
      if (removed) {
        chain.push({ turn: state.turn, step: 'cast-echo-card', card: removed, target: detail.detail.target, growth, keeperGrowth: detail.out.fx?.filter((fx: any) => fx.kind === 'buff' && oldQ.some(o => o?.def === 'd_keeper' && o.oid === fx.src)) ?? [] });
        if (removed.def === 'x_bonepact') echoBoneTargets.add(detail.detail.target);
      }
    }
    actions.push({ turn: state.turn, action, detail, beforeGold: before.gold, afterGold: state.gold, growth, newDiscover, beforeHash: createHash('sha256').update(json).digest('hex'), afterHash: createHash('sha256').update(JSON.stringify(state)).digest('hex') });
  });
  for (let guard = 0; r.phase === 'prep' && guard < 45; guard++) {
    const before = { turn: r.turn, act: r.act, layer: r.layer, gold: r.gold, lives: r.lives, tavern: r.tavern };
    shopTurn(r, 1);
    turns.push({ ...before, node: r.map[r.layer]?.[r.path[r.layer]]?.k, afterGold: r.gold, team: r.queue.filter(Boolean).map(o => ({ oid: o!.oid, def: o!.def, atk: o!.atkBonus, hp: o!.hpBonus, granted: o!.granted })) });
    if (nodeStep(r, 1)) continue;
    const out = fight(r), granted = r.queue.filter(o => o?.granted?.id === 'bone');
    const sources = new Set(r.queue.filter(Boolean).flatMap((o, i) => o?.granted?.id === 'bone' ? [out.initOrder[0][i]] : []));
    const soul = out.events.filter(e => e.t === 'summon' && e.unit.def === 't_wisp' && e.src != null && sources.has(e.src));
    if (soul.length) bone = true;
    const echoSources = new Set(r.queue.filter(Boolean).flatMap((o, i) => o && echoBoneTargets.has(o.oid) && o.granted?.id === 'bone' ? [out.initOrder[0][i]] : []));
    const echoSummons = soul.filter(e => e.t === 'summon' && e.src != null && echoSources.has(e.src));
    if (echoSummons.length) chain.push({ turn: r.turn, step: 'echo-bone-summon', result: out.result, boss: r.enemy.boss, summons: echoSummons });
    battles.push({ turn: r.turn, boss: r.enemy.boss, result: out.result, boneSources: granted.map(o => o!.oid), boneSummons: soul });
    settleBattle(r, out);
  }
  setBotTrace();
  return { seed, strategy, source: sourceVersion, phase: r.phase, turn: r.turn, lives: r.lives, grew, echo, bone, chain, turns, battles, actions };
}
let wins = 0, combinations = 0, full = 0, searched = 0;
let best: ReturnType<typeof journey> | undefined;
const complete = (r: ReturnType<typeof journey>) => r.phase === 'won' && r.chain.some(x => x.step === 'cast-echo-card' && x.card.def === 'x_bonepact' && x.keeperGrowth.length) && r.chain.some(x => x.step === 'echo-bone-summon') && r.battles.some(x => x.boss === 'final' && x.result === 'win');
const score = (r: ReturnType<typeof journey>) => Number(r.phase === 'won') * 8 + Number(r.grew) * 4 + Number(r.echo) * 2 + Number(r.bone) * 2;
for (let seed = first; seed < first + count; seed++) {
  const run = journey(seed); searched++;
  if (!best || score(run) > score(best)) best = run;
  if (run.phase === 'won') wins++;
  if (run.grew && run.echo && run.bone) combinations++;
  if (complete(run)) { full++; best = run; break; }
}
const report = JSON.stringify({ first, searched, strategy, wins, combinations, full, best }, null, 2);
if (args[3]) writeFileSync(args[3], report + '\n', 'utf8');
else console.log(report);
if (strategy === 'combo' ? !full : !wins) (globalThis as any).process.exitCode = 1;
