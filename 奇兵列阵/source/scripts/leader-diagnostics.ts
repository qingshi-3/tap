/** Future run observer only: no policy selection, result changes or resource mutation. */
import { unitDef } from '../src/core/data';
import type { BattleSetup } from '../src/core/engine';
import type { RunState } from '../src/core/run';
import type { BattleOutput, UnitState } from '../src/core/types';

const GRANT_KEYWORD: Record<string, string> = { snipe: '狙击', combo: '连击', reborn: '复生', taunt: '嘲讽', rotate: '轮换', duel: '决斗', splash: '溅射', armor: '护甲', power: '法强', thorns: '反击' };
const keywordSet = (u: UnitState) => new Set([...(unitDef(u.defId).keywords ?? []), ...Object.entries(u.grants).filter(([, value]) => !!value).map(([key]) => GRANT_KEYWORD[key]).filter(Boolean)]);
const initialField = (out: BattleOutput) => out.initial.filter(u => u.side === 0 && u.alive && !u.reserve);

export function measureLeaderBattle(r: RunState, setup: BattleSetup, out: BattleOutput) {
  const field = initialField(out), reserve = out.initial.filter(u => u.side === 0 && u.reserve);
  const all = [...r.slots, ...r.bench].filter(u => !!u);
  const grants = field.map(keywordSet), kinds = new Set(grants.flatMap(s => [...s]));
  const enemyKinds = out.initial.filter(u => u.side === 1).flatMap(u => [...keywordSet(u)]);
  const keywordRecipients = Math.max(0, ...[...kinds].map(k => grants.filter(s => s.has(k)).length));
  const moved = new Set<number>();
  const enemyOrder = setup.enemy.map((u, i) => u ? i : null);
  for (const [a, b] of setup.swaps ?? []) {
    if (enemyOrder[a] !== null) moved.add(enemyOrder[a]!);
    if (enemyOrder[b] !== null) moved.add(enemyOrder[b]!);
    [enemyOrder[a], enemyOrder[b]] = [enemyOrder[b], enemyOrder[a]];
  }
  const snapshotsAvailable = out.log.length > 0;
  const labels: Record<string, number> = {}, firstRegularByRound: Record<number, string> = {}, lastRegularByRound: Record<number, string> = {};
  const reserveUids = new Set(reserve.map(u => u.uid)), entered = new Set<number>(), acting = new Set<number>();
  const aliveAtEnd = out.log.at(-1)?.snap ?? out.afterStart;
  let round = 1, firstTwoDirectKills = 0, firstTwoEnemyDeaths = 0, firstTwoPlayerDeaths = 0;
  const lastDamage = new Map<number, { sourceSide?: number; kind: string }>();
  for (const { ev, snap } of out.log) {
    if (ev.t === 'beat') round = ev.round ?? round;
    if (ev.t === 'gen') labels[ev.label] = (labels[ev.label] ?? 0) + 1;
    if (ev.t === 'dmg') lastDamage.set(ev.tgt, { sourceSide: snap.find(u => u.uid === ev.src)?.side, kind: ev.kind });
    if (ev.t === 'death' && round <= 2) {
      const u = snap.find(u => u.uid === ev.tgt);
      if (u?.side === 1) {
        firstTwoEnemyDeaths++;
        const damage = lastDamage.get(ev.tgt);
        if (damage?.sourceSide === 0 && ['attack', 'ability'].includes(damage.kind)) firstTwoDirectKills++;
      } else if (u?.side === 0) firstTwoPlayerDeaths++;
    }
    if (ev.t === 'summon' && reserveUids.has(ev.uid)) entered.add(ev.uid);
    if (ev.t === 'act' && ev.side === 0) {
      if (reserveUids.has(ev.uid)) acting.add(ev.uid);
      if (ev.mode !== 'extra') {
        const id = snap.find(u => u.uid === ev.uid)?.defId ?? '?';
        firstRegularByRound[round] ??= id;
        lastRegularByRound[round] = id;
      }
    }
  }
  return {
    identity: { general: r.general, seed: r.seed, chapter: r.chapter + 1, node: r.node + 1, passives: [...r.passives] },
    outcome: { result: out.result, beats: out.beats, rounds: out.rounds, metrics: out.metrics ?? null },
    opportunity: {
      activeUnits: field.length, activeVacancies: 5 - field.length, reserveUnits: reserve.length,
      ordinaryCasters: field.filter(u => !!unitDef(u.defId).cast).length,
      damagingOrdinaryCasters: field.filter(u => unitDef(u.defId).cast?.some(e => ['dmg', 'burn'].includes(e.op))).length,
      limitedCasters: field.filter(u => u.charges !== undefined).length,
      chargeUnits: field.filter(u => !!u.chargeMax).length,
      frontTriggers: field.filter(u => !!unitDef(u.defId).onFront).map(u => u.defId),
      rearTriggers: field.filter(u => !!unitDef(u.defId).onRear).map(u => u.defId),
      deathTriggers: field.filter(u => !!unitDef(u.defId).onRattle).map(u => u.defId),
      movedEnemies: moved.size, swapsUsed: setup.swaps?.length ?? 0,
      declaredKeywordKinds: kinds.size,
      declaredKeywordKindsIncludingEnemy: new Set([...kinds, ...enemyKinds]).size,
      maxSharedKeywordRecipients: keywordRecipients,
      reserveWithFieldVacancy: reserve.length > 0 && field.length < 5,
      mercOffered: !!r.merc, mercUsed: !!r.merc?.sold,
      mercSkippedAtFullInventory: r.general === 'hank' && !!r.merc && !r.merc.sold && all.length === 8,
      activeTemps: field.filter(u => u.temp).length,
      eggs: all.filter(u => u.defId === 'x_egg').length,
      eggStatsBefore: r.eggStats ? { ...r.eggStats } : null,
      dragonsOnField: r.slots.filter(u => u && ['x_bone', 'x_fire', 'x_frostd', 'x_wind', 'x_brood'].includes(u.defId)).map(u => u!.defId),
      dragonsOnBench: r.bench.filter(u => u && ['x_bone', 'x_fire', 'x_frostd', 'x_wind', 'x_brood'].includes(u.defId)).map(u => u!.defId),
      powerToGeneral: r.genPower,
      trainingByUnit: all.map(u => ({ id: u.defId, copies: u.copies, train: { ...u.train }, equips: [...(u.equips ?? [])] })),
    },
    // null means unobserved, never "zero triggers" when record:false.
    recorded: snapshotsAvailable ? {
      genLabels: labels, firstTwoDirectKills, firstTwoEnemyDeaths, firstTwoPlayerDeaths,
      firstRegularByRound, lastRegularByRound,
      reserveEntered: entered.size, reserveActed: acting.size,
      reserveNeverEntered: reserve.filter(u => !entered.has(u.uid)).map(u => u.defId),
      emptyLimitedCasters: aliveAtEnd.filter(u => u.side === 0 && u.charges === 0).map(u => u.defId),
      afterStartActive: out.afterStart.filter(u => u.side === 0 && u.alive && !u.reserve).map(u => u.defId),
    } : null,
  };
}
