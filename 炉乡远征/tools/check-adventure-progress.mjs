import { ALL_RECRUITMENT_IDS } from "../dist/js/recruitment-catalog.js";
import { getUnlockRewards } from "../dist/js/campaign-rules.js";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  ExpeditionProgress,
  normalizeExpeditionState,
  validateExpeditionState,
} from "../dist/js/expedition-progress.js";
import {
  ADVENTURE_LEVEL_IDS,
  ADVENTURE_PACKAGE_ID,
  ORIGINAL_CAMPAIGN_LEVEL_IDS,
  countAdventureCompletions,
} from "../dist/js/adventure-access.js";
import {
  platformProgressStats,
  localAchievements,
  CAMPAIGN_PROGRESS_MAX,
} from "../dist/js/platform-progress.js";
import {
  EXPEDITION_LEVELS,
  TRAINING_COSTS,
} from "../dist/js/expedition-data.js";
import { FACTIONS } from "../dist/js/factions.js";
import { SAVE_KEYS } from "../dist/js/storage-keys.js";
import {
  createExpeditionMatch,
  restoreMatch,
  validateMatch,
  confirmMulligan,
  moveUnit,
  movementPositions,
} from "../dist/js/engine.js";
import { PlayerCloud } from "../dist/js/player-cloud.js";
const KEY = SAVE_KEYS.expedition,
  clone = structuredClone;
class Memory {
  data = new Map();
  fail = false;
  failBackup = false;
  writes = 0;
  getItem(k) {
    return this.data.get(k) ?? null;
  }
  setItem(k, v) {
    if (
      (this.fail && k === KEY) ||
      (this.failBackup && k === KEY + ".legacy-v13-backup")
    )
      throw Error("isolated quota");
    this.data.set(k, String(v));
    if (k === KEY) this.writes++;
  }
  removeItem(k) {
    this.data.delete(k);
  }
}
const load = (m) => {
  const p = new ExpeditionProgress(m);
  assert.equal(p.error, "");
  return p;
};
function facts(n = 31) {
  const s = new ExpeditionProgress(new Memory()).state;
  let left = n;
  for (let f = 1; f <= 6; f++) {
    const count = Math.min(left, 6);
    s.factionCompleted[f] = ORIGINAL_CAMPAIGN_LEVEL_IDS.slice(0, count);
    left -= count;
  }
  assert.equal(left, 0);
  s.completed = [...new Set(Object.values(s.factionCompleted).flat())];
  s.accountStageClaims = Object.fromEntries(
    s.completed.map((id) => [id, "legacy"]),
  );
  for (const [fid, ids] of Object.entries(s.factionCompleted))
    for (const id of ids) {
      const rewards = getUnlockRewards(id, Number(fid));
      for (const kind of ["units", "spells"])
        s.inventory[kind] = [
          ...new Set([...s.inventory[kind], ...rewards[kind]]),
        ];
    }
  return s;
}
function storage(s) {
  const m = new Memory();
  m.setItem(KEY, JSON.stringify(s));
  return m;
}
function act(match) {
  if (match.phase === "mulligan") {
    assert.ok(confirmMulligan(match));
    return;
  }
  const u = match.units.find(
    (u) =>
      u.owner === match.currentPlayer && movementPositions(match, u).length,
  );
  assert.ok(u);
  const t = movementPositions(match, u)[0];
  assert.ok(moveUnit(match, u.unitId, t.x, t.y));
}
// Accounting probe only. Real command/reload coverage below is separate from terminal ledger injection.
function accountingWin(p, match) {
  const terminal = clone(match);
  terminal.phase = "over";
  terminal.winner = 0;
  terminal.result = "win";
  terminal.resultReason = "enemies-eliminated";
  assert.ok(validateMatch(terminal));
  return { result: p.settle(terminal), terminal };
}
const checks = [];
assert.equal(EXPEDITION_LEVELS.length, 48);
assert.equal(CAMPAIGN_PROGRESS_MAX, 48 * 6);
assert.deepEqual(
  EXPEDITION_LEVELS.slice(0, 30).map((l) => l.id),
  ORIGINAL_CAMPAIGN_LEVEL_IDS,
);
{
  const p = load(storage(facts(30)));
  assert.equal(p.adventureAccessStatus().granted, false);
  assert.equal(p.adventureAccessStatus().required, 31);
  for (const id of ADVENTURE_LEVEL_IDS)
    for (const f of FACTIONS) assert.equal(p.isUnlocked(id, f.id), false);
  const completeOld = facts(30);
  completeOld.factionCompleted[1] = [...ORIGINAL_CAMPAIGN_LEVEL_IDS];
  for (let f = 2; f <= 6; f++) completeOld.factionCompleted[f] = [];
  completeOld.completed = [...ORIGINAL_CAMPAIGN_LEVEL_IDS];
  completeOld.accountStageClaims = Object.fromEntries(
    completeOld.completed.map((id) => [id, "legacy"]),
  );
  const q = load(storage(completeOld));
  assert.equal(
    q.isUnlocked("storm-01"),
    false,
    "old30 does not bypass the undecided new-player access policy",
  );
  const forged = {
    factionCompleted: {
      1: [
        ...ORIGINAL_CAMPAIGN_LEVEL_IDS,
        ...ORIGINAL_CAMPAIGN_LEVEL_IDS,
        "invalid",
      ],
      7: ADVENTURE_LEVEL_IDS,
    },
    legacyUnlockedLevels: EXPEDITION_LEVELS.map((l) => l.id),
  };
  assert.equal(countAdventureCompletions(forged), 30);
  checks.push(
    "strict >30 legal unique six-faction facts; neither repeats nor legacy shared access nor original30 unlocks new content",
  );
}
{
  const s = facts(),
    before = clone(s),
    m = storage(s),
    p = load(m);
  assert.equal(p.adventureAccessStatus().completed, 31);
  assert.equal(p.adventureAccessStatus().pendingNotice, true);
  for (const id of ADVENTURE_LEVEL_IDS)
    for (const f of FACTIONS) assert.ok(p.isUnlocked(id, f.id));
  const projected = p.state;
  delete projected.adventureAccess;
  delete before.adventureAccess;
  assert.deepEqual(projected, before, "grant changes access only");
  const writes = m.writes;
  assert.equal(p.reevaluateAdventureAccess().changed, false);
  assert.equal(m.writes, writes);
  m.fail = true;
  assert.equal(p.dismissAdventureGiftNotice().ok, false);
  assert.equal(p.adventureAccessStatus().pendingNotice, false);
  assert.ok(p.adventureAccessStatus().granted);
  m.fail = false;
  const q = load(m);
  assert.ok(q.adventureAccessStatus().pendingNotice);
  assert.ok(q.dismissAdventureGiftNotice().ok);
  assert.equal(load(m).adventureAccessStatus().pendingNotice, false);
  assert.ok(load(m).isUnlocked("starfall-09", 6));
  checks.push(
    "persistent all18/six-faction grant changes no currency/cards/victory/score; idempotent; notice failure session suppression and reload retry",
  );
}
{
  const s = facts(),
    m = storage(s),
    raw = m.getItem(KEY);
  m.fail = true;
  const p = new ExpeditionProgress(m);
  assert.match(p.error, /未保存/);
  assert.equal(p.adventureAccessStatus().granted, false);
  assert.equal(m.getItem(KEY), raw);
  m.fail = false;
  assert.ok(p.reevaluateAdventureAccess().ok);
  assert.ok(p.adventureAccessStatus().granted);
  assert.equal(
    p.state.adventureAccess.entitlements[ADVENTURE_PACKAGE_ID]
      .qualifyingCompletions,
    31,
  );
  const destination = new Memory(),
    q = load(destination);
  destination.fail = true;
  assert.equal(q.replaceState(s).ok, false);
  assert.equal(q.adventureAccessStatus().granted, false);
  destination.fail = false;
  assert.ok(q.replaceState(s).ok);
  assert.ok(q.adventureAccessStatus().granted);
  checks.push(
    "load grant and live import failure preserve bytes/facts/access, then retry persists without ads",
  );
}
const fixtureBytes = await readFile(
  new URL(
    "./fixtures/save-contract-profile13-pre-adventure-2026-11-05.json",
    import.meta.url,
  ),
);
const fixture = JSON.parse(fixtureBytes);
for (const frozen of fixture.profiles) {
  const raw = " " + JSON.stringify(frozen) + "\n",
    m = new Memory();
  m.setItem(KEY, raw);
  let p = load(m);
  assert.equal(p.state.schemaVersion, 14);
  assert.equal(m.getItem(KEY + ".legacy-v13-backup"), raw);
  const back = p.state;
  delete back.adventureAccess;
  back.schemaVersion = 13;
  assert.deepEqual(back, frozen);
  assert.ok(p.train(9).ok);
  p = load(m);
  assert.ok(p.redeemGiftCode("LX2026").ok);
  assert.ok(p.train(11).ok);
  assert.deepEqual(load(m).state, p.state);
  for (const field of ["level", "entitlement", "unknown"]) {
    const bad = clone(frozen);
    if (field === "level") {
      bad.completed = ["storm-01"];
      bad.accountStageClaims = { "storm-01": "legacy" };
    } else if (field === "entitlement")
      bad.adventureAccess = { entitlements: {}, notices: {} };
    else bad.future = 1;
    assert.equal(normalizeExpeditionState(bad), null);
  }
  for (const failStage of ["backup", "profile"]) {
    const d = new Memory();
    d.setItem(KEY, raw);
    d.fail = failStage === "profile";
    d.failBackup = failStage === "backup";
    const q = new ExpeditionProgress(d);
    assert.ok(q.error);
    assert.equal(d.getItem(KEY), raw);
    d.fail = false;
    d.failBackup = false;
    assert.equal(load(d).state.schemaVersion, 14);
  }
}
checks.push(
  "schema13 frozen original30 contract strict validation, exact byte backup, migration failure recovery and two purchase/save/reloads",
);
for (const mutate of [
  (s) => (s.adventureAccess.entitlements[ADVENTURE_PACKAGE_ID].version = 2),
  (s) => (s.adventureAccess.entitlements["unknown"] = {}),
  (s) =>
    (s.adventureAccess.notices[ADVENTURE_PACKAGE_ID] = { dismissed: "yes" }),
  (s) =>
    (s.adventureAccess.entitlements[
      ADVENTURE_PACKAGE_ID
    ].qualifyingCompletions = 30),
]) {
  const s = normalizeExpeditionState(facts());
  mutate(s);
  const m = storage(s),
    raw = m.getItem(KEY);
  assert.equal(normalizeExpeditionState(s), null);
  assert.ok(new ExpeditionProgress(m).error);
  assert.equal(m.getItem(KEY), raw);
}
checks.push(
  "unknown access version/id and damaged grant/notice fields protect original and reject writes",
);
let actionLoops = 0;
for (const faction of FACTIONS)
  for (const levelId of ADVENTURE_LEVEL_IDS) {
    const m = storage(facts());
    let p = load(m);
    assert.ok(p.selectHero(faction.heroIds[0]).ok);
    let match = createExpeditionMatch(
      levelId,
      p.state.training,
      p.state.squad,
      p.state.selectedHeroId,
      p.getBattleLoadout(),
    );
    assert.ok(validateMatch(match));
    assert.ok(p.saveBattle(match).ok);
    p = load(m);
    match = restoreMatch(p.state.activeBattle);
    assert.ok(match);
    act(match);
    assert.ok(p.saveBattle(match).ok);
    p = load(m);
    assert.deepEqual(p.state.activeBattle, match);
    match = restoreMatch(p.state.activeBattle);
    act(match);
    assert.ok(p.saveBattle(match).ok);
    assert.deepEqual(load(m).state.activeBattle, match);
    assert.equal(
      countAdventureCompletions(p.state),
      31,
      "entering and continuing never creates a victory",
    );
    actionLoops++;
  }
checks.push(
  "all108 faction/level low-training starter-deck starts, two real commands with save/reload and fixed storage; access evidence, not easy-victory evidence",
);
{
  const m = storage(facts()),
    p = load(m);
  let totalCoins = 0,
    totalOrbs = 0;
  for (const id of ADVENTURE_LEVEL_IDS) {
    const match = createExpeditionMatch(
      id,
      p.state.training,
      p.state.squad,
      p.state.selectedHeroId,
      p.getBattleLoadout(),
    );
    assert.ok(p.saveBattle(match).ok);
    const { result, terminal } = accountingWin(p, match);
    assert.ok(result.ok, result.error);
    totalCoins += result.amount;
    totalOrbs += result.tickets;
    const after = p.state;
    assert.equal(p.settle(terminal).duplicate, true);
    assert.deepEqual(p.state, after);
    assert.deepEqual(load(m).state, after);
  }
  assert.equal(totalCoins, 6720);
  assert.equal(totalOrbs, 24);
  assert.ok(validateExpeditionState(p.state));
  assert.equal(platformProgressStats(p.state).score, 49);
  checks.push(
    "18 noncontinuous node rewards total6720 coins/24orbs; duplicate runId and repeated save preserve claims (terminal accounting probes)",
  );
}
{
  const m = storage(facts()),
    p = load(m),
    before = p.state;
  const match = createExpeditionMatch(
    "starfall-09",
    before.training,
    before.squad,
    before.selectedHeroId,
    p.getBattleLoadout(),
  );
  assert.ok(p.saveBattle(match).ok);
  const frozen = p.state;
  const { terminal } = accountingWin({ settle: (m) => m }, match);
  m.fail = true;
  assert.equal(p.settle(terminal).ok, false);
  assert.deepEqual(p.state, frozen);
  m.fail = false;
  const reward = p.settle(terminal);
  assert.ok(reward.ok);
  assert.equal(reward.reward.chapter, 16);
  assert.equal(reward.reward.chapterCoins, 60);
  assert.deepEqual(p.state.completed, [...before.completed, "starfall-09"]);
  assert.deepEqual(
    p.state.inventory,
    before.inventory,
    "jumping never grants earlier milestones",
  );
  assert.equal(p.getFactionProgress(1).unitRankCap, 4);
  assert.deepEqual(p.state.training, before.training);
  const coins = p.state.coins;
  assert.ok(p.train(9).ok);
  assert.equal(p.state.coins, coins - TRAINING_COSTS[before.training[9]]);
  assert.deepEqual(load(m).state, p.state);
  const loss = createExpeditionMatch(
    "storm-09",
    p.state.training,
    p.state.squad,
    p.state.selectedHeroId,
    p.getBattleLoadout(),
  );
  assert.ok(p.saveBattle(loss).ok);
  loss.phase = "over";
  loss.winner = 1;
  loss.result = "loss";
  assert.ok(p.saveBattle(loss).ok);
  assert.ok(p.clearBattle().ok);
  const retry = createExpeditionMatch(
    "storm-09",
    p.state.training,
    p.state.squad,
    p.state.selectedHeroId,
    p.getBattleLoadout(),
  );
  assert.notEqual(loss.runId, retry.runId);
  assert.ok(p.saveBattle(retry).ok);
  assert.ok(load(m).isUnlocked("storm-09"));
  checks.push(
    "direct48 sparse completion, exact node reward, failed settlement retry, purchased growth only; loss/retry keeps grant without ads (terminal accounting probes)",
  );
}
{
  const s = facts(30);
  s.factionCompleted[6] = [];
  s.factionCompleted[5].push("banners-01");
  s.completed.push("banners-01");
  s.accountStageClaims["banners-01"] = "legacy"; // still30 unique facts distributed, border02 for faction6 is open via legacy access only
  s.legacyUnlockedLevels = ["border-02"];
  assert.equal(countAdventureCompletions(s), 31); // source carries31; remove one to target30
  s.factionCompleted[5].pop();
  assert.equal(countAdventureCompletions(s), 30);
  const m = storage(s),
    p = load(m);
  assert.ok(p.selectHero(FACTIONS[5].heroIds[0]).ok);
  const match = createExpeditionMatch(
    "border-02",
    p.state.training,
    p.state.squad,
    p.state.selectedHeroId,
    p.getBattleLoadout(),
  );
  assert.ok(p.saveBattle(match).ok);
  assert.equal(p.adventureAccessStatus().granted, false);
  const { result } = accountingWin(p, match);
  assert.ok(result.ok, result.error);
  assert.equal(countAdventureCompletions(p.state), 31);
  assert.ok(p.adventureAccessStatus().granted);
  assert.ok(load(m).isUnlocked("starfall-09", 1));
  checks.push(
    "existing old-level in-flight victory can cross30 to31 and atomically grant without ad callbacks (terminal accounting probe)",
  );
}
{
  const source = facts(),
    envelope = {
      game: "duelyst-h5",
      appId: 970030,
      schemaVersion: 1,
      saveId: "123e4567-e89b-42d3-a456-426614174000",
      savedAt: 1,
      data: { expedition: source, campaign: null, match: null },
    };
  const transport = {
    available: true,
    async read() {
      return { token: "remote", data: clone(envelope) };
    },
    async write() {
      return { ok: false, error: "offline" };
    },
  };
  const m = new Memory(),
    cloud = new PlayerCloud({ storage: m, transport });
  assert.ok((await cloud.initialize()).ok);
  const p = load(m);
  assert.ok(p.adventureAccessStatus().granted);
  assert.equal(p.adventureAccessStatus().pendingNotice, true);
  cloud.dispose();
  checks.push(
    "legal cloud restore reevaluates within normalized persisted profile, no ad capability and no network grant dependency",
  );
}
{
  const p = load(storage(facts())),
    base = p.state.coins,
    orbs = p.state.recruitment.tickets;
  let coins = 0,
    tickets = 0;
  for (const faction of FACTIONS) {
    assert.ok(p.selectHero(faction.heroIds[0]).ok);
    for (const id of ADVENTURE_LEVEL_IDS) {
      const match = createExpeditionMatch(
        id,
        p.state.training,
        p.state.squad,
        p.state.selectedHeroId,
        p.getBattleLoadout(),
      );
      assert.ok(p.saveBattle(match).ok);
      const { result } = accountingWin(p, match);
      assert.ok(result.ok, result.error);
      coins += result.amount;
      tickets += result.tickets;
    }
  }
  assert.equal(coins, 15570);
  assert.equal(tickets, 54);
  assert.equal(p.state.coins, base + coins);
  assert.equal(p.state.recruitment.tickets, orbs + tickets);
  const repeat = createExpeditionMatch(
    "starfall-09",
    p.state.training,
    p.state.squad,
    p.state.selectedHeroId,
    p.getBattleLoadout(),
  );
  assert.ok(p.saveBattle(repeat).ok);
  const { result } = accountingWin(p, repeat);
  assert.ok(result.ok);
  assert.equal(result.reward.chapterCoins, 0);
  assert.equal(result.tickets, 0);
  assert.equal(result.amount, EXPEDITION_LEVELS.at(-1).reward.repeat);
  assert.deepEqual(load(storage(p.state)).state, p.state);
  const s = facts();
  s.inventory.units = [
    ...new Set([...s.inventory.units, ...ALL_RECRUITMENT_IDS]),
  ];
  const q = load(storage(s));
  const full = createExpeditionMatch(
    "storm-03",
    q.state.training,
    q.state.squad,
    q.state.selectedHeroId,
    q.getBattleLoadout(),
  );
  assert.ok(q.saveBattle(full).ok);
  const frozen = q.state.battleRewards[full.runId];
  assert.equal(frozen.tickets, 0);
  assert.equal(frozen.compensationCoins, 40);
  const { result: r } = accountingWin(q, full);
  assert.ok(r.ok);
  assert.equal(
    r.amount,
    EXPEDITION_LEVELS.find((l) => l.id === "storm-03").reward.first + 60 + 40,
  );
  assert.equal(r.tickets, 0);
  checks.push(
    "all108 new-node settlement ledger15570coins/54orbs; chapter rewards once; full collection frozen compensation40coins on chapter-first (terminal accounting probes)",
  );
}
{
  const forged = normalizeExpeditionState(facts());
  for (let id = 1; id <= 6; id++) forged.factionCompleted[id] = [];
  assert.equal(countAdventureCompletions(forged), 0);
  assert.equal(validateExpeditionState(forged), false);
  assert.equal(normalizeExpeditionState(forged), null);
  const m = storage(forged),
    raw = m.getItem(KEY),
    p = new ExpeditionProgress(m);
  assert.ok(p.error);
  assert.equal(p.isUnlocked("storm-01"), false);
  assert.equal(m.getItem(KEY), raw);
  const q = load(new Memory());
  assert.equal(q.replaceState(forged).ok, false);
  const mismatched = normalizeExpeditionState(facts());
  mismatched.adventureAccess.entitlements[
    ADVENTURE_PACKAGE_ID
  ].qualifyingCompletions = 32;
  assert.equal(normalizeExpeditionState(mismatched), null);
  checks.push(
    "grant evidence cannot exceed legal retained faction victory facts; forged zero-progress/overclaimed qualification denied locally and on normalize/import",
  );
}
// Mode ownership is based on property presence, including undefined before JSON serialization.
{
  for (const marker of [
    null,
    undefined,
    { version: 1, runId: "isolated-roguelike", seed: 42 },
  ]) {
    const m = storage(facts()),
      p = load(m),
      s = p.state;
    const battle = createExpeditionMatch(
      "storm-01",
      s.training,
      s.squad,
      s.selectedHeroId,
      p.getBattleLoadout(),
    );
    assert.ok(p.saveBattle(battle).ok);
    const before = p.state,
      raw = m.getItem(KEY),
      foreign = clone(battle);
    foreign.roguelike = marker;
    assert.equal(Object.hasOwn(foreign, "roguelike"), true);
    assert.equal(
      p.saveBattle(foreign).ok,
      false,
      "foreign mode never enters permanent campaign slot",
    );
    foreign.phase = "over";
    foreign.winner = 0;
    foreign.result = "win";
    foreign.resultReason = "enemies-eliminated";
    assert.equal(
      p.settle(foreign).ok,
      false,
      "foreign mode never receives campaign rewards",
    );
    assert.deepEqual(p.state, before);
    assert.equal(m.getItem(KEY), raw);
    const profile = clone(before);
    profile.activeBattle = foreign;
    assert.equal(validateExpeditionState(profile), false);
    assert.equal(normalizeExpeditionState(profile), null);
    assert.equal(load(new Memory()).replaceState(profile).ok, false);
    if (marker !== undefined) {
      const persisted = JSON.parse(JSON.stringify(profile));
      assert.equal(
        normalizeExpeditionState(persisted),
        null,
        "serialized foreign mode cannot enter cloud/profile import",
      );
    }
  }
  checks.push(
    "roguelike own-property null/undefined/object rejected by battle save, settlement and active-profile import without reward or byte changes",
  );
}
const report = {
  passed: true,
  schema: 14,
  namespace: KEY,
  actionLoops,
  checks,
  fixtureSha256: createHash("sha256").update(fixtureBytes).digest("hex"),
  combatVictoryEvidence: false,
};
await mkdir(new URL("../output/adventure-progress/", import.meta.url), {
  recursive: true,
});
await writeFile(
  new URL("../output/adventure-progress/core.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
