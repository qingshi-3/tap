import {
  EXPANSION_VERSION,
  RECRUITMENT_VERSION,
  TURN_START_DRAW_VERSION,
} from "../dist/js/expansion-mechanics.js";
import { createHash } from "node:crypto";
// Isolated tactical rehearsals. Does not fabricate profile victories or write player saves.
import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  appendFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import * as engine from "../dist/js/engine.js";
import { ExpeditionProgress } from "../dist/js/expedition-progress.js";
import { CARD_ACQUISITION } from "../dist/js/campaign-content.js";
import { getCard } from "../dist/js/cards.js";
import { getHero } from "../dist/js/factions.js";
import { makeStarterDeck, validatePlayerDeck } from "../dist/js/battle-deck.js";
import { ADVENTURE_LEVELS } from "../dist/js/adventure-content.js";
const args = Object.fromEntries(
  process.argv.slice(2).map((v) => {
    const [k, ...rest] = v.replace(/^--/, "").split("=");
    return [k, rest.join("=")];
  }),
);
const csv = (value, fallback) => String(value ?? fallback).split(",");
const heroes = csv(args.heroes, "1,101,201,301,401,501").map(Number);
const levels = csv(
  args.levels,
  "storm-01,storm-03,storm-06,storm-09,starfall-01,starfall-03,starfall-06,starfall-09",
);
const seeds = csv(args.seeds, "11").map(Number),
  profiles = csv(args.profiles, "mid,late,starter-trained"),
  modes = csv(args.modes, "aware");
const out = new URL(
  `../output/adventure-balance/${args.tag ?? "probe"}/`,
  import.meta.url,
);
mkdirSync(out, { recursive: true });
const maxActions = Number(args["max-actions"] ?? 500);
class MemoryStorage {
  data = new Map();
  getItem(k) {
    return this.data.get(k) ?? null;
  }
  setItem(k, v) {
    this.data.set(k, String(v));
  }
  removeItem(k) {
    this.data.delete(k);
  }
}
function build(hero, kind) {
  const p = new ExpeditionProgress(new MemoryStorage());
  assert.equal(p.error, "");
  assert.ok(p.selectHero(hero).ok);
  const base = p.getBattleLoadout(),
    faction = getHero(hero).faction,
    stage = kind.startsWith("mid") ? 15 : 30;
  const available = CARD_ACQUISITION.filter(
    (c) =>
      c.acquisition === "initial" ||
      (Number.isInteger(c.level) && c.level <= stage),
  );
  const inventory = {
    units: available.filter((c) => c.type === "unit").map((c) => c.id),
    spells: available.filter((c) => c.type === "spell").map((c) => c.id),
  };
  let deck = makeStarterDeck(hero);
  if (!kind.startsWith("starter")) {
    const score = (id) => {
      const c = getCard(id);
      if (c.type === "spell")
        return c.effect === "strike" ? 8 : c.effect === "heal" ? 4 : 1;
      return (
        (c.ranged ? 11 : 0) +
        (c.provoke ? 3 : 0) +
        (c.flying ? 4 : 0) +
        (c.rush ? 2 : 0) +
        (c.attack + c.health) / Math.max(1, c.cost) -
        (c.cost > 5 ? 4 : 0)
      );
    };
    const candidates = available
      .filter((c) => !c.faction || c.faction === faction)
      .map((c) => c.id)
      .filter((id) => getCard(id));
    let selected = [...new Set(candidates)]
      .sort((a, b) => score(b) - score(a) || a - b)
      .slice(0, 10);
    if (kind.endsWith("-core")) {
      const middle = {
        1: [11, 21, 12, 8],
        2: [110, 115, 117, 122],
        3: [211, 214, 221, 208],
        4: [308, 311, 319, 318],
        5: [402, 412, 407, 415],
        6: [505, 510, 517, 519],
      };
      const late = {
        1: [11, 8, 22, 13],
        2: [110, 117, 120, 119],
        3: [208, 211, 219, 220],
        4: [308, 318, 321, 314],
        5: [412, 415, 405, 414],
        6: [505, 519, 515, 507],
      };
      const spells = candidates
        .filter((id) => getCard(id).type === "spell")
        .sort((a, b) => score(b) - score(a) || a - b)
        .slice(0, 2);
      selected = [
        ...(kind.startsWith("mid") ? middle : late)[faction],
        10021,
        10017,
        19027,
        10981,
        ...spells,
      ];
      assert.equal(selected.length, 10);
      assert.ok(
        selected.every((id) => candidates.includes(id)),
        `Core deck contains unavailable card ${hero}/${kind}`,
      );
    }
    deck = selected.flatMap((id) => [id, id, id]);
  }
  assert.ok(validatePlayerDeck(deck, hero), `Illegal ${hero}/${kind}`);
  const rank =
    kind === "starter-zero"
      ? 0
      : kind.startsWith("mid") || kind === "starter-mid"
        ? 2
        : 4;
  const training = Object.fromEntries(
    Object.keys(base.growthVersion).map((id) => [
      id,
      deck.includes(+id) ? rank : 0,
    ]),
  );
  // Same unit cultivation in late/starter-trained isolates card-pool strength.
  const loadout = {
    ...base,
    deck,
    spellTraining: {},
    spellModes: {},
    specializations: {},
  };
  return { training, loadout, inventory, rank, stage };
}
if (args["validate-only"] === "true") {
  for (const hero of heroes)
    for (const profile of profiles) {
      const b = build(hero, profile);
      console.log(
        JSON.stringify({
          hero,
          profile,
          deck: b.loadout.deck,
          rank: b.rank,
          legal: true,
        }),
      );
    }
  process.exit(0);
}
function abilityActions(s) {
  const actions = [];
  for (const u of s.units.filter((u) => u.owner === 0)) {
    const o = engine.getAdventureAbilityOptions(s, u.unitId);
    if (!o.available) continue;
    const common = {
      kind: "adventure",
      unitId: u.unitId,
      abilityId: o.abilityId,
      revision: s.revision,
    };
    if (o.type === "unit")
      for (const targetId of o.unitIds) actions.push({ ...common, targetId });
    if (o.type === "direction")
      for (const direction of o.directions)
        actions.push({ ...common, direction });
    if (o.type === "cell")
      for (const cell of o.cells) {
        const action = { ...common, cell };
        if (engine.previewAdventureAbility(s, action).ok) actions.push(action);
      }
  }
  return actions;
}
function extraScore(s) {
  let score = 0;
  for (const q of s.adventure?.units ?? []) score += q.charge * 5;
  for (const marker of engine.adventureMarkers(s)) {
    if (marker.kind === "gravity") continue;
    const u = s.units.find((u) => u.x === marker.x && u.y === marker.y);
    if (!u || u.owner !== 0) continue;
    if (
      marker.intent === "stormStrike" &&
      [9201, 9202].includes(u.cardId) &&
      !u.silenced
    ) {
      score += 8;
      continue;
    }
    score -=
      Math.min(u.health, marker.amount) *
      (getCard(u.cardId)?.type === "general" ? 10 : 4);
    if (marker.amount >= u.health) score -= 35;
  }
  // A ready meteor makes clustering tactically valuable before immediate damage.
  for (const u of s.units.filter((u) => u.owner === 0 && u.cardId === 9204)) {
    const o = engine.getAdventureAbilityOptions(s, u.unitId);
    if (!o.available || s.players[0].mana < 3) continue;
    let best = 0;
    for (const cell of o.cells) {
      let value = 0;
      for (const e of s.units.filter(
        (e) =>
          e.owner === 1 &&
          Math.max(Math.abs(e.x - cell.x), Math.abs(e.y - cell.y)) <= 1,
      ))
        value += Math.min(e.health, e.x === cell.x && e.y === cell.y ? 10 : 6);
      best = Math.max(best, value);
    }
    score += best * 1.5;
  }
  return score;
}
globalThis.__adventureActions = abilityActions;
globalThis.__adventureScore = extraScore;
globalThis.__adventureUse = (s, a) => engine.useAdventureAbility(s, a);
globalThis.__adventureAllowReplace = args["no-replace"] !== "true";
globalThis.__adventureExpandedVersions = [
  EXPANSION_VERSION,
  RECRUITMENT_VERSION,
  TURN_START_DRAW_VERSION,
];
const policyURL = new URL(
  "playthrough-policy-v13-candidate.mjs",
  import.meta.url,
);
let source = readFileSync(policyURL, "utf8").replaceAll(
  "../dist/js/",
  new URL("../dist/js/", import.meta.url).href,
);
source = source.replaceAll(
  "canReplaceHandCard(s,",
  "globalThis.__adventureAllowReplace&&canReplaceHandCard(s,",
);
source = source.replaceAll(
  "s.contentVersion==='campaign-2026-10-14-v2'",
  "globalThis.__adventureExpandedVersions.includes(s.contentVersion)",
);
source = source.replace(
  "switch(a.kind){",
  "switch(a.kind){case'adventure':return globalThis.__adventureUse(s,a);",
);
source = source.replace(
  "return score-deploymentRisk(s);",
  "return score-deploymentRisk(s)+(globalThis.__adventureAware?globalThis.__adventureScore(s):0);",
);
source = source.replace(
  "return actions;}",
  "if(globalThis.__adventureAware)actions.push(...globalThis.__adventureActions(s));return actions;}",
);
for (const injection of [
  "globalThis.__adventureActions(s)",
  "globalThis.__adventureScore(s)",
  "case'adventure'",
  "globalThis.__adventureExpandedVersions.includes(s.contentVersion)",
])
  assert.ok(
    source.includes(injection),
    `Policy adaptation failed: ${injection}`,
  );
const policy = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
const report = {
  startedAt: new Date().toISOString(),
  transformedPolicyHash: createHash("sha256").update(source).digest("hex"),
  sourceHashes: Object.fromEntries(
    [
      "engine.js",
      "adventure-system.js",
      "adventure-content.js",
      "enemy-plans.js",
    ].map((name) => [
      name,
      createHash("sha256")
        .update(readFileSync(new URL("../dist/js/" + name, import.meta.url)))
        .digest("hex"),
    ]),
  ),
  actionCap: maxActions,
  lookahead: args.lookahead === "true",
  allocatorIsolation:
    "withIsolatedBattleSimulation; live allocator never restored between real actions",
  allowReplace: globalThis.__adventureAllowReplace,
  policy:
    "v13-native (expansion guard corrected for current v4) + adventure candidates, danger avoidance, charge and meteor clustering",
  notice:
    "Independent battle diagnostics; no complete campaign or human-play claim. Card pools reflect authored stage acquisition, not a proven 30-stage route. No recruitment-only cards. No spell cultivation.",
  results: [],
};
if (args["verify-only"] !== "true") {
  const sourceDirectory = new URL("source/", out);
  mkdirSync(sourceDirectory, { recursive: true });
  for (const name of Object.keys(report.sourceHashes))
    writeFileSync(
      new URL(name, sourceDirectory),
      readFileSync(new URL("../dist/js/" + name, import.meta.url)),
    );
  writeFileSync(
    new URL("runner.mjs", sourceDirectory),
    readFileSync(new URL(import.meta.url)),
  );
  writeFileSync(new URL("policy.mjs", sourceDirectory), source);
}
if (args.resume === "true") {
  const previous = JSON.parse(
    readFileSync(new URL("report.json", out), "utf8"),
  );
  assert.deepEqual(
    previous.sourceHashes,
    report.sourceHashes,
    "Resume requires identical battle source hashes",
  );
  assert.equal(
    previous.transformedPolicyHash,
    report.transformedPolicyHash,
    "Resume requires identical policy",
  );
  assert.equal(
    previous.allowReplace,
    report.allowReplace,
    "Resume requires identical replacement policy",
  );
  assert.equal(
    previous.allocatorIsolation,
    report.allocatorIsolation,
    "Resume requires identical allocator isolation",
  );
  assert.equal(
    previous.lookahead ?? false,
    report.lookahead,
    "Resume requires identical lookahead",
  );
  report.results = previous.results.filter((r) => r.result !== "error");
  report.resumedFrom = previous.startedAt;
}
const skippedKeys = new Set();
const battleKey = (r) =>
  [r.hero, r.profile, r.mode, r.seed, r.levelId].join("|");
report.skippedBatchSources = [];
for (const file of csv(args["skip-results-from"], "").filter(Boolean)) {
  const prior = JSON.parse(readFileSync(file, "utf8"));
  report.skippedBatchSources.push({
    file,
    sourceHashes: prior.sourceHashes,
    transformedPolicyHash: prior.transformedPolicyHash,
  });
  for (const r of prior.results)
    if (r.result !== "error") skippedKeys.add(battleKey(r));
}
function verifyCapture(directory) {
  return engine.withIsolatedBattleSimulation(() => {
    const initial = JSON.parse(
      readFileSync(new URL("after-mulligan-match.json", directory), "utf8"),
    );
    const commands = JSON.parse(
      readFileSync(new URL("commands.json", directory), "utf8"),
    ).slice(1);
    const expected = JSON.parse(
      readFileSync(new URL("final-match.json", directory), "utf8"),
    );
    const restored = engine.restoreMatch(initial);
    assert.ok(restored, "Captured playing snapshot refused");
    let count = 0,
      failed = null;
    for (const row of commands) {
      const c = row.command;
      if (
        restored.currentPlayer !== row.owner ||
        !(row.owner === 1
          ? engine.autoAct(restored)
          : policy.applyAction(restored, c))
      ) {
        failed = row;
        break;
      }
      count++;
    }
    const comparable = (q) =>
      JSON.stringify({
        phase: q.phase,
        result: q.result,
        round: q.round,
        players: q.players,
        units: q.units,
        adventure: q.adventure,
        expansionRandom: q.expansionRandom,
      });
    const result = {
      ok: !failed,
      identical: !failed && comparable(restored) === comparable(expected),
      commandsReplayed: count,
      result: restored.result,
      round: restored.round,
      hp: engine.findGeneral(restored, 0)?.health ?? 0,
      noChallengeContext: engine.challengeContext(restored) === null,
      failedCommand: failed,
    };
    writeFileSync(
      new URL("ordinary-restore-replay.json", directory),
      JSON.stringify(result, null, 2),
    );
    return result;
  });
}
if (args["verify-only"] === "true") {
  const directory = new URL("matches/", out);
  for (const name of readdirSync(directory)) {
    const match = new URL(name + "/", directory);
    if (existsSync(new URL("commands.json", match)))
      console.log(JSON.stringify({ match: name, ...verifyCapture(match) }));
  }
  process.exit(0);
}
function flush() {
  report.finishedAt = new Date().toISOString();
  report.summary = Object.fromEntries(
    ["win", "loss", "timeout", "error"].map((k) => [
      k,
      report.results.filter((r) => r.result === k).length,
    ]),
  );
  writeFileSync(new URL("report.json", out), JSON.stringify(report, null, 2));
}
for (const hero of heroes)
  for (const profile of profiles)
    for (const mode of modes)
      for (const seed of seeds)
        for (const levelId of levels) {
          assert.ok(ADVENTURE_LEVELS.some((l) => l.id === levelId));
          if (
            args["starter-bosses-only"] === "true" &&
            profile.startsWith("starter") &&
            !ADVENTURE_LEVELS.find((l) => l.id === levelId).boss
          )
            continue;
          if (
            skippedKeys.has(battleKey({ hero, profile, mode, seed, levelId }))
          )
            continue;
          if (
            report.results.some(
              (r) =>
                r.hero === hero &&
                r.profile === profile &&
                r.mode === mode &&
                r.seed === seed &&
                r.levelId === levelId,
            )
          )
            continue;
          const b = build(hero, profile),
            r = {
              hero,
              profile,
              mode,
              seed,
              levelId,
              deck: b.loadout.deck,
              training: b.training,
              rank: b.rank,
              stagePool: b.stage,
              spellTraining: {},
              actions: 0,
              abilities: {},
              mechanics: { hits: 0, moves: 0, absorbs: 0, charges: 0 },
              featureActions: [],
              cardStats: {},
              playerActionLog: [],
              rawCommands: [],
              result: null,
            };
          let s;
          const started = Date.now();
          try {
            s = engine.createExpeditionMatch(
              levelId,
              b.training,
              null,
              hero,
              b.loadout,
              { challengeSeed: seed },
            );
            assert.ok(engine.validateMatch(s), "initial invalid");
            if (args.capture === "true") {
              const dir = new URL(
                `matches/${hero}-${profile}-${mode}-${seed}-${levelId}/`,
                out,
              );
              mkdirSync(dir, { recursive: true });
              writeFileSync(
                new URL("initial-match.json", dir),
                JSON.stringify(s, null, 2),
              );
              writeFileSync(
                new URL("initial-context.json", dir),
                JSON.stringify(engine.challengeContext(s), null, 2),
              );
              writeFileSync(
                new URL("loadout.json", dir),
                JSON.stringify(
                  {
                    hero,
                    levelId,
                    seed,
                    training: b.training,
                    loadout: b.loadout,
                  },
                  null,
                  2,
                ),
              );
              r.snapshotDirectory = dir.href;
            }
            globalThis.__adventureAware = mode === "aware";
            while (s.phase !== "over" && r.actions < maxActions) {
              const summary = (state) => ({
                revision: state.revision,
                context: engine.challengeContext(state),
                expansionRandom: state.expansionRandom,
                players: state.players.map((p) => ({
                  id: p.id,
                  hand: [...p.hand],
                  deck: [...p.deck],
                })),
                units: state.units.map((u) => ({
                  unitId: u.unitId,
                  cardId: u.cardId,
                  owner: u.owner,
                  x: u.x,
                  y: u.y,
                  health: u.health,
                })),
              });
              const beforeSummary = args.capture === "true" ? summary(s) : null;
              const beforeUnits = s.units.map((u) => ({ ...u }));
              const ownerBefore = s.currentPlayer;
              let command = null;
              if (s.currentPlayer === 0) {
                const a = engine.withIsolatedBattleSimulation(() =>
                  policy.chooseAction(s, {
                    lookahead: args.lookahead === "true",
                    clockPressure: true,
                    aggression: 1.2,
                  }),
                );
                assert.ok(a);
                command = a;

                assert.ok(policy.applyAction(s, a), JSON.stringify(a));
                if (a.kind === "adventure")
                  r.abilities[a.abilityId] =
                    (r.abilities[a.abilityId] ?? 0) + 1;
              } else assert.ok(engine.autoAct(s));
              r.rawCommands.push({
                owner: ownerBefore,
                turn: s.players[0].turnsStarted,
                command: command ?? { kind: "auto" },
              });
              if (
                args.capture === "true" &&
                command?.kind === "mulligan" &&
                r.snapshotDirectory
              )
                writeFileSync(
                  new URL("after-mulligan-match.json", r.snapshotDirectory),
                  JSON.stringify(s, null, 2),
                );
              const statsFor = (id) =>
                (r.cardStats[id] ??= {
                  name: getCard(+id)?.name,
                  instances: [],
                  boardSamples: 0,
                  commands: 0,
                  netEnemyDamage: 0,
                  netFriendlyHealing: 0,
                  deaths: 0,
                });
              for (const u of s.units.filter((u) => u.owner === 0)) {
                const q = statsFor(u.cardId);
                if (!q.instances.includes(u.unitId)) q.instances.push(u.unitId);
                q.boardSamples++;
              }
              for (const u of beforeUnits.filter(
                (u) =>
                  u.owner === 0 && !s.units.some((v) => v.unitId === u.unitId),
              ))
                statsFor(u.cardId).deaths++;
              if (ownerBefore === 0 && command) {
                const sourceBefore = beforeUnits.find(
                  (u) => u.unitId === (command.unitId ?? command.sourceId),
                );
                const sourceCard = s.lastAction?.cardId ?? sourceBefore?.cardId;
                const damage = beforeUnits
                  .filter((u) => u.owner === 1)
                  .reduce(
                    (sum, u) =>
                      sum +
                      Math.max(
                        0,
                        u.health -
                          (s.units.find((v) => v.unitId === u.unitId)?.health ??
                            0),
                      ),
                    0,
                  );
                const healing = beforeUnits
                  .filter((u) => u.owner === 0)
                  .reduce(
                    (sum, u) =>
                      sum +
                      Math.max(
                        0,
                        (s.units.find((v) => v.unitId === u.unitId)?.health ??
                          0) - u.health,
                      ),
                    0,
                  );
                if (sourceCard) {
                  const q = statsFor(sourceCard);
                  q.commands++;
                  q.netEnemyDamage += damage;
                  q.netFriendlyHealing += healing;
                }
                r.playerActionLog.push({
                  turn: s.players[0].turnsStarted,
                  kind: command.kind,
                  cardId: sourceCard ?? null,
                  sourceCell: sourceBefore
                    ? { x: sourceBefore.x, y: sourceBefore.y }
                    : null,
                  cell:
                    command.cell ??
                    (command.kind === "move"
                      ? { x: command.x, y: command.y }
                      : null),
                  direction: command.direction ?? null,
                  netEnemyDamage: damage,
                  netFriendlyHealing: healing,
                });
              }
              const steps = s.lastAction?.steps ?? [];
              if (
                command?.kind === "adventure" ||
                steps.some((step) => ["absorb", "event"].includes(step.kind))
              )
                r.featureActions.push({
                  turn: s.players[0].turnsStarted,
                  owner: ownerBefore,
                  command,
                  steps,
                  killed: beforeUnits
                    .filter(
                      (u) =>
                        u.health > 0 &&
                        !s.units.some(
                          (v) => v.unitId === u.unitId && v.health > 0,
                        ),
                    )
                    .map((u) => ({
                      unitId: u.unitId,
                      cardId: u.cardId,
                      owner: u.owner,
                    })),
                  enemyHp: engine.findGeneral(s, 1)?.health ?? 0,
                });
              for (const step of steps) {
                if (step.kind === "hit") r.mechanics.hits++;
                if (step.kind === "move") r.mechanics.moves++;
                if (step.kind === "absorb") r.mechanics.absorbs++;
                if (step.kind === "charge") r.mechanics.charges++;
              }
              r.actions++;
              assert.ok(
                engine.validateMatch(s),
                `invalid after action ${r.actions}`,
              );
            }
            r.result = s.phase === "over" ? s.result : "timeout";
            r.reason = s.resultReason ?? "action-cap";
          } catch (error) {
            r.result = "error";
            r.reason = error.stack;
          }
          if (args.capture === "true" && r.snapshotDirectory && s) {
            const dir = new URL(r.snapshotDirectory);
            writeFileSync(
              new URL("final-match.json", dir),
              JSON.stringify(s, null, 2),
            );
            writeFileSync(
              new URL("commands.json", dir),
              JSON.stringify(r.rawCommands, null, 2),
            );
            if (r.rawCommands[0]?.command?.kind === "mulligan")
              writeFileSync(
                new URL("after-mulligan-commands.json", dir),
                JSON.stringify(r.rawCommands.slice(1), null, 2),
              );
          }
          if (
            args.capture === "true" &&
            r.snapshotDirectory &&
            r.rawCommands[0]?.command?.kind === "mulligan"
          )
            r.ordinaryReplay = verifyCapture(new URL(r.snapshotDirectory));
          r.finalUnits = s?.units.map((u) => ({
            unitId: u.unitId,
            cardId: u.cardId,
            owner: u.owner,
            x: u.x,
            y: u.y,
            health: u.health,
            attack: u.attack,
          }));
          r.round = s?.round;
          r.playerTurns = s?.players?.[0]?.turnsStarted;
          r.hp = s ? (engine.findGeneral(s, 0)?.health ?? 0) : null;
          r.enemyHp = s ? (engine.findGeneral(s, 1)?.health ?? 0) : null;
          r.elapsedMs = Date.now() - started;
          report.results.push(r);
          appendFileSync(
            new URL("results.jsonl", out),
            JSON.stringify(r) + "\n",
          );
          flush();
          console.log(
            JSON.stringify({
              hero,
              profile,
              mode,
              seed,
              levelId,
              result: r.result,
              round: r.round,
              hp: r.hp,
              abilities: r.abilities,
              elapsedMs: r.elapsedMs,
              error: r.result === "error" ? r.reason : undefined,
            }),
          );
        }
