import assert from 'node:assert/strict';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';
import { createExpeditionMatch } from '../dist/js/expedition-engine.js';

const KEY = 'duelyst-h5.safe-v1.expedition';

class MemoryStorage {
  data = new Map([['duelyst-h5.safe-v1.namespace', '{"version":1}']]);
  writes = 0;
  failWrites = false;
  removeItem(key) { this.data.delete(key); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) {
    if (this.failWrites) throw new Error('quota exceeded');
    this.writes += 1;
    this.data.set(key, value);
  }
}

const win = (progress, runId = 'run-win') => {
  const state = progress.state;
  const match = createExpeditionMatch('border-01', state.training, state.squad, state.selectedHeroId);
  match.runId = runId;
  match.phase = 'over';
  match.winner = 0;
  match.result = 'win';
  return match;
};

{
  const storage = new MemoryStorage();
  const progress = new ExpeditionProgress(storage);
  const match = win(progress);
  const state = progress.state;
  const playing = createExpeditionMatch('border-01', state.training, state.squad, state.selectedHeroId);
  playing.runId = match.runId;
  assert.equal(progress.saveBattle(playing).ok, true);
  const settled=progress.settle(match);assert.deepEqual(settled,{ok:true,amount:100,firstClear:true,factionFirst:true,duplicate:false,coins:200,tickets:progress.recruitmentConfig.victoryTickets,unlocked:{units:[],spells:[]},reward:progress.state.battleRewards[match.runId]});
  const writes = storage.writes;
  assert.deepEqual(progress.settle(match), { ok: true, amount: 100, firstClear: true, duplicate: true, coins: 200, tickets: progress.recruitmentConfig.victoryTickets, unlocked: { units: [], spells: [] } });
  assert.equal(storage.writes, writes, 'settling one run twice must not write or award twice');
  assert.equal(progress.saveBattle(match).ok, false, 'a settled run must not become active again');
  assert.match(progress.saveBattle(match).error, /已经结算/);
  assert.equal(new ExpeditionProgress(storage).state.coins, 200);
}

{
  const storage = new MemoryStorage();
  const progress = new ExpeditionProgress(storage);
  assert.equal(progress.saveBattle({ mode: 'expedition' }).ok, false);
  assert.match(progress.error, /快照无效/);
  assert.equal(storage.writes, 0);
}

{
  const storage = new MemoryStorage();
  const progress = new ExpeditionProgress(storage);
  const before = progress.state;
  storage.failWrites = true;
  assert.equal(progress.train(14).ok, false);
  assert.deepEqual(progress.state, before, 'failed storage write must not commit training or coins in memory');
  assert.match(progress.error, /未保存.*quota exceeded/);
}

for (const raw of ['{broken', JSON.stringify({ schemaVersion: 99, coins: 999 })]) {
  const storage = new MemoryStorage();
  storage.data.set(KEY, raw);
  const progress = new ExpeditionProgress(storage);
  assert.ok(progress.error);
  assert.equal(progress.train(14).ok, false);
  assert.equal(storage.getItem(KEY), raw, 'unknown saves must remain byte-for-byte unchanged');
  assert.equal(storage.writes, 0);
}

{
  const storage = new MemoryStorage();
  const progress = new ExpeditionProgress(storage);
  assert.equal(progress.setSquad([9, 9, 14]).ok, false);
  assert.equal(storage.writes, 0);
  assert.equal(progress.train(14).ok, true);
  assert.equal(progress.state.coins, 60);
  assert.equal(progress.state.training[14], 1);
}

{
  const storage = new MemoryStorage();
  const progress = new ExpeditionProgress(storage);
  const legacy = progress.state; legacy.completed = ['border-01','border-02','border-03','road-01','road-02','road-03','banners-01','banners-02','banners-03'];
  legacy.accountStageClaims=Object.fromEntries(legacy.completed.map(id=>[id,'legacy']));
  legacy.inventory.units.push(...[15,16,17].filter(id=>!legacy.inventory.units.includes(id))); assert.equal(progress.replaceState(legacy).ok,true);
  const before = progress.state; const writes = storage.writes;
  assert.match(progress.setSquad([17, 16, 15]).error, /\u603b\u8d39\u7528\u4e0d能\u8d85\u8fc7 4/);
  assert.deepEqual(progress.state, before, 'over-budget squad must not change in-memory progress');
  assert.equal(storage.writes, writes, 'over-budget squad must not write storage');
  assert.equal(progress.state.coins, before.coins, 'over-budget squad must not spend coins');
  assert.deepEqual(progress.setSquad([14, 9, 17]), { ok: true, squad: [14, 9, 17] });
}

{
  const storage = new MemoryStorage();
  const legacyState = new ExpeditionProgress(storage).state;
  legacyState.schemaVersion = 4; for (const key of ['giftCodeClaims','dailyAds','inventory','spellTraining','factionSpells','spellModes','specializations','recruitment','factionDecks','factionCompleted','legacyUnlockedLevels','growthVersion','accountStageClaims','factionChapterClaims','battleRewards']) delete legacyState[key];
  legacyState.training = Object.fromEntries(Object.entries(legacyState.training).filter(([id])=>[14,9,15,16,11,17,110,115,109,108,111,116,213,211,214,209,215,216,308,317,311,309,310,316,406,412,410,402,404,413,505,506,503,526,511,513].includes(Number(id))));
  legacyState.squad = [17, 16, 15];
  legacyState.factionSquads[1] = [17, 16, 15];
  storage.data.set(KEY, JSON.stringify(legacyState));
  const loaded = new ExpeditionProgress(storage);
  assert.equal(loaded.error, '');
  assert.deepEqual(loaded.state.squad, [17, 16, 15], 'existing over-budget squad saves remain loadable');
  assert.equal(storage.getItem(`${KEY}.legacy-v4-backup`), JSON.stringify(legacyState), 'schema4 over-budget squad must be backed up before schema6 migration');
  assert.equal(loaded.state.schemaVersion,13);
}

console.log('expedition progress checks passed');
