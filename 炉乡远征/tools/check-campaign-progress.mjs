import assert from 'node:assert/strict';
import { CampaignProgress } from '../dist/js/campaign-progress.js';

const IDS = ['roar-lethal', 'break-the-guard', 'lightchaser-bond'];
const KEY = 'duelyst-h5.safe-v1.campaign';

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

function snapshot(overrides = {}) {
  return { schemaVersion: 2, mode: 'challenge', levelId: IDS[0], runId: 'run-1', phase: 'playing', winner: null, completedLevels: [], ...overrides };
}

{
  const storage = new MemoryStorage();
  const oldMatch = snapshot({ levelId: IDS[1], completedLevels: [IDS[0], 'unknown-level'] });
  const before = structuredClone(oldMatch);
  const progress = new CampaignProgress(IDS, storage);
  assert.deepEqual(progress.import(oldMatch), { firstClear: false, chapterCompleted: false });
  assert.deepEqual([...progress.completed], [IDS[0]]);
  assert.deepEqual([...progress.attempted], [IDS[1]]);
  assert.deepEqual(oldMatch, before, 'import must not mutate the old match snapshot');
}

{
  const storage = new MemoryStorage();
  const progress = new CampaignProgress(IDS, storage);
  const win = snapshot({ phase: 'over', winner: 0, completedLevels: [IDS[0]] });
  assert.deepEqual(progress.observe(win), { firstClear: true, chapterCompleted: false });
  const writes = storage.writes;
  assert.deepEqual(progress.observe(win), { firstClear: false, chapterCompleted: false });
  assert.equal(storage.writes, writes, 'repeated result must not write or reward again');
  progress.observe(snapshot({ levelId: IDS[1], phase: 'over', winner: 0 }));
  assert.deepEqual(progress.observe(snapshot({ levelId: IDS[2], phase: 'over', winner: 0 })), { firstClear: true, chapterCompleted: true });
  assert.deepEqual([...progress.completed], IDS);

  progress.observe(snapshot({ levelId: IDS[0], completedLevels: [] }));
  assert.deepEqual([...progress.completed], IDS, 'restoring an older match must not regress permanent progress');
  assert.deepEqual(new CampaignProgress(IDS, storage).completed, new Set(IDS));
}

{
  const storage = new MemoryStorage();
  const progress = new CampaignProgress(IDS, storage);
  storage.failWrites = true;
  assert.deepEqual(progress.observe(snapshot({ phase: 'over', winner: 0 })), { firstClear: false, chapterCompleted: false });
  assert.equal(progress.completed.size, 0, 'failed writes must not commit candidate state');
  assert.match(progress.error, /写入进度失败，未保存.*quota exceeded/i);
}

for (const raw of [
  JSON.stringify({ game: 'duelyst-h5', schemaVersion: 99 }),
  '{broken json'
]) {
  const storage = new MemoryStorage();
  storage.data.set(KEY, raw);
  const progress = new CampaignProgress(IDS, storage);
  assert.ok(progress.error);
  progress.observe(snapshot({ phase: 'over', winner: 0 }));
  assert.equal(storage.getItem(KEY), raw, 'unreadable records must be preserved byte-for-byte');
  assert.equal(storage.writes, 0);
}

{
  const storage = new MemoryStorage();
  const progress = new CampaignProgress(IDS, storage);
  assert.deepEqual(progress.observe(null), { firstClear: false, chapterCompleted: false });
  assert.deepEqual(progress.import(null), { firstClear: false, chapterCompleted: false });
  assert.equal(storage.writes, 0);
}

console.log('campaign progress checks passed');
