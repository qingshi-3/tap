import assert from 'node:assert/strict';
import { PlayerCloud } from '../dist/js/player-cloud.js';
import { ExpeditionProgress } from '../dist/js/expedition-progress.js';

const EXPEDITION = 'duelyst-h5.safe-v1.expedition';
const META = 'duelyst-h5.safe-v1.cloud-meta';
const LOCAL_BACKUP = `${META}.local-backup`;
const REMOTE_BACKUP = `${META}.remote-backup`;
const UNKNOWN_META_BACKUP = `${META}.unknown-backup`;
const JOURNAL = `${META}.restore-journal`;

class MemoryStorage {
  data = new Map([['duelyst-h5.safe-v1.namespace', '{"version":1}']]);
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

class FakeTransport {
  available = true; remote = null; sequence = 0; writes = [];
  async read() { return this.remote ? structuredClone(this.remote) : null; }
  async write(data, expectedToken) {
    const snapshot = structuredClone(data); this.writes.push({ data: snapshot, expectedToken });
    const token = this.remote?.token ?? null;
    if (token !== expectedToken) return { ok: false, conflict: true, token, error: 'changed', remote: await this.read() };
    this.remote = { token: `token-${++this.sequence}`, data: snapshot };
    return { ok: true, token: this.remote.token };
  }
}

class DeferredReadTransport extends FakeTransport {
  deferRead = false; readGate = null;
  async read() {
    if (this.deferRead) await new Promise((resolve) => { this.readGate = resolve; });
    this.deferRead = false; this.readGate = null;
    return super.read();
  }
}

class FailableReadTransport extends FakeTransport {
  failRead = false;
  async read() { if (this.failRead) throw new Error('offline'); return super.read(); }
}

function expedition(coins = 80) {
  const storage = new MemoryStorage(), state = new ExpeditionProgress(storage).state;
  state.coins = coins; return state;
}
function putExpedition(storage, coins) { storage.setItem(EXPEDITION, JSON.stringify(expedition(coins))); }
function envelope(coins, saveId = '123e4567-e89b-42d3-a456-426614174000') {
  return { game: 'duelyst-h5', appId: 970030, schemaVersion: 1, saveId, savedAt: 100,
    data: { expedition: expedition(coins), campaign: null, match: null } };
}

// A new cloud slot is established only by an explicit sync, then round-trips.
{
  const storage = new MemoryStorage(), transport = new FakeTransport(); putExpedition(storage, 111);
  const cloud = new PlayerCloud({ storage, transport });
  assert.deepEqual(Object.keys(cloud.state).sort(), ['available', 'blocked', 'cacheAvailable', 'cacheBusy', 'cloudSummary', 'conflict', 'error', 'errorCode', 'hasRemote', 'label', 'localSummary', 'operationBusy', 'status'].sort());
  assert.deepEqual(cloud.state.localSummary, { coins: 111, completed: 0, trials: 0, training: 0, savedAt: null, hasBattle: false });
  assert.equal((await cloud.initialize()).ok, true); assert.equal(cloud.state.status, 'unlinked');
  assert.equal(transport.writes.length, 0);
  assert.equal((await cloud.sync()).ok, true); assert.equal(transport.remote.data.data.expedition.coins, 111);
  assert.ok(storage.getItem(META)); assert.equal(cloud.state.status, 'synced');
}

// A pristine device restores a valid cloud snapshot and calls onRestore after all keys commit.
{
  const storage = new MemoryStorage(), transport = new FakeTransport(); transport.remote = { token: 'remote-1', data: envelope(222) };
  let restored = 0; const cloud = new PlayerCloud({ storage, transport, onRestore: () => { restored += 1; } });
  assert.equal((await cloud.initialize()).ok, true);
  assert.equal(JSON.parse(storage.getItem(EXPEDITION)).coins, 222); assert.equal(restored, 1);
  assert.ok(storage.getItem(LOCAL_BACKUP)); assert.equal(cloud.state.status, 'synced');
}

// Local progress created while initialize awaits the cloud is never auto-restored over.
{
  const storage = new MemoryStorage(), transport = new DeferredReadTransport();
  transport.remote = { token: 'slow-init', data: envelope(230) }; transport.deferRead = true;
  const cloud = new PlayerCloud({ storage, transport }); const initializing = cloud.initialize();
  while (!transport.readGate) await new Promise((resolve) => setTimeout(resolve, 0));
  putExpedition(storage, 231); transport.readGate();
  await initializing;
  assert.equal(cloud.state.conflict, true); assert.equal(JSON.parse(storage.getItem(EXPEDITION)).coins, 231);
}

// Conflicting nonempty local data is preserved until the player explicitly chooses local.
{
  const storage = new MemoryStorage(), transport = new FakeTransport(); putExpedition(storage, 333);
  transport.remote = { token: 'remote-old', data: envelope(444) };
  const cloud = new PlayerCloud({ storage, transport }); await cloud.initialize();
  assert.equal(cloud.state.conflict, true); assert.equal(JSON.parse(storage.getItem(EXPEDITION)).coins, 333);
  assert.equal((await cloud.sync({ useLocal: true })).ok, true);
  assert.equal(transport.remote.data.data.expedition.coins, 333);
  assert.equal(JSON.parse(storage.getItem(REMOTE_BACKUP)).envelope.data.expedition.coins, 444);
}

// A recovered refresh clears old errors; a failed read invalidates the displayed overwrite token.
{
  const storage = new MemoryStorage(), transport = new FailableReadTransport(); putExpedition(storage, 340);
  transport.remote = { token: 'read-health', data: envelope(341) };
  const cloud = new PlayerCloud({ storage, transport }); await cloud.initialize();
  transport.failRead = true; assert.equal((await cloud.refresh()).ok, false);
  assert.equal(cloud.state.hasRemote, false); assert.match(cloud.state.error, /读取云存档失败/); assert.doesNotMatch(cloud.state.error, /offline/);
  transport.failRead = false; assert.equal((await cloud.refresh()).ok, true);
  assert.equal(cloud.state.error, ''); assert.equal(cloud.state.hasRemote, true);
  transport.failRead = true; await cloud.refresh(); const writes = transport.writes.length;
  assert.equal((await cloud.sync({ useLocal: true })).ok, false);
  assert.equal(transport.writes.length, writes, 'stale displayed remote must not authorize overwrite');
}

// Two devices sharing a baseline cannot overwrite an unseen token.
{
  const transport = new FakeTransport(), first = new MemoryStorage(); putExpedition(first, 100);
  const a = new PlayerCloud({ storage: first, transport }); await a.initialize(); await a.sync();
  const second = new MemoryStorage(), b = new PlayerCloud({ storage: second, transport }); await b.initialize();
  putExpedition(first, 150); a.notifyLocalChange(); await a.sync();
  putExpedition(second, 175); b.notifyLocalChange();
  const result = await b.sync();
  assert.equal(result.ok, false); assert.equal(result.conflict, true);
  assert.equal(JSON.parse(second.getItem(EXPEDITION)).coins, 175); assert.equal(transport.remote.data.data.expedition.coins, 150);
}

// Refresh recognizes a local descendant of the displayed baseline and queues upload without conflict.
{
  const storage = new MemoryStorage(), transport = new FakeTransport(); putExpedition(storage, 180);
  const cloud = new PlayerCloud({ storage, transport }); await cloud.initialize(); await cloud.sync();
  putExpedition(storage, 181); cloud.paused = true;
  assert.equal((await cloud.refresh()).ok, true); assert.equal(cloud.state.status, 'pending'); assert.equal(cloud.state.conflict, false);
  cloud.dispose();
}

// Unknown cloud and metadata formats never rewrite their originals.
{
  const storage = new MemoryStorage(), transport = new FakeTransport(); putExpedition(storage, 500);
  const unknownMeta = '{"schemaVersion":99}'; storage.setItem(META, unknownMeta);
  transport.remote = { token: 'bad', data: { game: 'somebody-else' } };
  const cloud = new PlayerCloud({ storage, transport }); const result = await cloud.initialize();
  assert.equal(result.ok, false); assert.equal(storage.getItem(META), unknownMeta);
  assert.equal(JSON.parse(storage.getItem(EXPEDITION)).coins, 500); assert.equal(transport.writes.length, 0);
}

// Future metadata is read-only even for an explicit first sync.
{
  const storage = new MemoryStorage(), transport = new FakeTransport(); putExpedition(storage, 510);
  const raw = ' {"schemaVersion":99}\n'; storage.setItem(META, raw);
  const cloud = new PlayerCloud({ storage, transport }); await cloud.initialize();
  assert.equal((await cloud.sync()).ok, false); assert.equal(storage.getItem(META), raw); assert.equal(transport.writes.length, 0);
}

// An unrecoverable journal is visible before domain models are constructed and blocks writes.
{
  const storage = new MemoryStorage(), transport = new FakeTransport();
  storage.setItem(JOURNAL, '{"schemaVersion":99}');
  const cloud = new PlayerCloud({ storage, transport });
  assert.equal(cloud.state.blocked, true); assert.equal((await cloud.sync()).ok, false);
}

// Fatal journal recovery remains visible even when cloud APIs are unavailable.
{
  const storage = new MemoryStorage(), transport = new FakeTransport(); transport.available = false;
  storage.setItem(JOURNAL, '{"schemaVersion":99}');
  const cloud = new PlayerCloud({ storage, transport }); const result = await cloud.initialize();
  assert.equal(result.ok, false); assert.equal(cloud.state.blocked, true); assert.match(cloud.state.error, /恢复未完成/);
}

// A failed multi-key restore rolls back the exact local bytes.
{
  class FailOnceStorage extends MemoryStorage {
    failed = false;
    setItem(key, value) { if (key === EXPEDITION && !this.failed) { this.failed = true; throw new Error('disk full'); } super.setItem(key, value); }
  }
  const storage = new FailOnceStorage(); storage.data.set(EXPEDITION, ` ${JSON.stringify(expedition(610))}\n`);
  const original = storage.getItem(EXPEDITION), transport = new FakeTransport(); transport.remote = { token: 'restore-fail', data: envelope(620) };
  const cloud = new PlayerCloud({ storage, transport }); await cloud.initialize();
  const result = await cloud.restore(); assert.equal(result.ok, false);
  assert.equal(storage.getItem(EXPEDITION), original, 'rollback must restore exact original bytes');
}

// Local edits made while restore rechecks the token make the displayed choice stale.
{
  const storage = new MemoryStorage(), transport = new DeferredReadTransport(); putExpedition(storage, 630);
  transport.remote = { token: 'slow-restore', data: envelope(640) };
  const cloud = new PlayerCloud({ storage, transport }); await cloud.initialize();
  transport.deferRead = true; const restoring = cloud.restore();
  while (!transport.readGate) await new Promise((resolve) => setTimeout(resolve, 0));
  putExpedition(storage, 631); transport.readGate();
  const result = await restoring;
  assert.equal(result.ok, false); assert.equal(result.stale, true);
  assert.equal(JSON.parse(storage.getItem(EXPEDITION)).coins, 631);
}

// A transient read failure while collecting rollback bytes aborts before creating a journal.
{
  class FailRawReadStorage extends MemoryStorage {
    expeditionReads = 0; throwAt = Infinity;
    getItem(key) {
      if (key === EXPEDITION && ++this.expeditionReads === this.throwAt) throw new Error('transient read failure');
      return super.getItem(key);
    }
  }
  const storage = new FailRawReadStorage(); storage.data.set(EXPEDITION, JSON.stringify(expedition(650)));
  const transport = new FakeTransport(); transport.remote = { token: 'raw-read-fail', data: envelope(660) };
  const cloud = new PlayerCloud({ storage, transport }); await cloud.initialize();
  storage.throwAt = storage.expeditionReads + 3;
  const result = await cloud.restore();
  assert.equal(result.ok, false); assert.match(result.error, /transient read failure/);
  assert.equal(storage.getItem(JOURNAL), null); assert.equal(JSON.parse(storage.getItem(EXPEDITION)).coins, 650);
}

// The upload owns an immutable capture; edits made while it is pending remain eligible for the next sync.
{
  class DeferredTransport extends FakeTransport {
    gate = null;
    async write(data, expectedToken) {
      const snapshot = structuredClone(data); this.writes.push({ data: snapshot, expectedToken });
      await new Promise((resolve) => { this.gate = resolve; });
      const token = this.remote?.token ?? null;
      if (token !== expectedToken) return { ok: false, conflict: true, token, remote: await this.read() };
      this.remote = { token: `token-${++this.sequence}`, data: snapshot }; return { ok: true, token: this.remote.token };
    }
  }
  const storage = new MemoryStorage(), transport = new DeferredTransport(); putExpedition(storage, 700);
  const cloud = new PlayerCloud({ storage, transport }); await cloud.initialize();
  const pending = cloud.sync();
  while (!transport.gate) await new Promise((resolve) => setTimeout(resolve, 0));
  putExpedition(storage, 701); cloud.notifyLocalChange(); transport.gate();
  assert.equal((await pending).ok, true); assert.equal(transport.remote.data.data.expedition.coins, 700);
  transport.gate = null; const next = cloud.sync();
  while (!transport.gate) await new Promise((resolve) => setTimeout(resolve, 0));
  transport.gate(); assert.equal((await next).ok, true); assert.equal(transport.remote.data.data.expedition.coins, 701);
  cloud.dispose();
}

// Disposing during a cloud read prevents the delayed result from restoring local keys.
{
  const storage = new MemoryStorage(), transport = new DeferredReadTransport();
  transport.remote = { token: 'disposed-read', data: envelope(800) }; transport.deferRead = true;
  const cloud = new PlayerCloud({ storage, transport }); const pending = cloud.initialize();
  while (!transport.readGate) await new Promise((resolve) => setTimeout(resolve, 0));
  cloud.dispose(); transport.readGate();
  assert.equal((await pending).ok, false); assert.equal(storage.getItem(EXPEDITION), null);
}


// New profile fields take part in synchronization identity even when old summary fields are unchanged.
{
 const storage=new MemoryStorage(),transport=new FakeTransport();putExpedition(storage,800);
 const cloud=new PlayerCloud({storage,transport});assert.ok((await cloud.initialize()).ok);assert.ok((await cloud.sync()).ok);
 const initial=JSON.parse(storage.getItem(EXPEDITION));
 const changed=structuredClone(initial);changed.spellTraining[20174]=1;changed.spellModes[20174]='power';changed.factionSpells[1]=[20043,20174];
 changed.recruitment.focus=17;changed.recruitment.misses[17]=3;changed.growthVersion[14]='legacy-v1';changed.completed=['border-01'];changed.accountStageClaims={'border-01':'legacy'};changed.factionCompleted[1]=['border-01'];changed.legacyUnlockedLevels=['border-01','border-02'];
 changed.recruitment.tickets=7;changed.recruitment.fragments[10021]=3;changed.inventory.units.push(19037);changed.factionDecks[1].reverse();
 changed.settlements['recruitment-cloud']={levelId:'border-01',amount:100,firstClear:true};
 changed.recruitment.victoryClaims['recruitment-cloud']=1;
 changed.recruitment.adClaims['recruitment-cloud']={status:'claimed',requestId:'cloud-ad',amount:2,requestIds:['cloud-ad']};
 storage.setItem(EXPEDITION,JSON.stringify(changed));cloud.notifyLocalChange();assert.ok((await cloud.sync()).ok);
 assert.deepEqual(transport.remote.data.data.expedition,changed,'complete schema8 state must upload despite unchanged coins/unit-training/completed summary');
 const remote=new MemoryStorage(),restore=new PlayerCloud({storage:remote,transport});assert.ok((await restore.initialize()).ok);
 assert.deepEqual(JSON.parse(remote.getItem(EXPEDITION)),changed,'cloud restore must preserve every schema8 field including faction/growth/pity/decks/tickets/fragments/ownership/receipts');
 assert.deepEqual(JSON.parse(remote.getItem(META)).baseData.expedition,changed);
 cloud.dispose();restore.dispose();
}
// Cache maintenance never changes progress, metadata, backups, or restore logs;
// it clears a resolved quota error without initiating another cloud mutation.
{
  class CacheTransport extends FakeTransport {
    cacheAvailable = true; cacheBusy = false; operationBusy = false; cleaning = 0; quota = false;
    async write(data, token) { return this.quota ? { ok: false, code: 'STORAGE_QUOTA', error: 'writeFile fail: Total file size exceeds 100MB' } : super.write(data, token); }
    async clearSyncCache() { this.cleaning += 1; return { ok: true, deletedCount: 3, deletedBytes: 42, failures: [] }; }
  }
  const storage = new MemoryStorage(), transport = new CacheTransport(); putExpedition(storage, 1200);
  const cloud = new PlayerCloud({ storage, transport }); await cloud.initialize(); await cloud.sync();
  storage.setItem(LOCAL_BACKUP, 'local backup bytes'); storage.setItem(REMOTE_BACKUP, 'remote backup bytes'); storage.setItem(UNKNOWN_META_BACKUP, 'original unknown metadata');
  transport.quota = true;
  const failed = await cloud.sync();
  assert.equal(failed.code, 'STORAGE_QUOTA'); assert.match(failed.error, /同步缓存空间不足/);
  assert.doesNotMatch(failed.error, /writeFile|100MB/); assert.equal(cloud.state.errorCode, 'STORAGE_QUOTA');
  const original = new Map(storage.data), writes = transport.writes.length;
  const result = await cloud.clearSyncCache();
  assert.equal(result.deletedCount, 3); assert.equal(result.deletedBytes, 42);
  assert.equal(cloud.state.error, ''); assert.equal(cloud.state.errorCode, '');
  assert.equal(cloud.state.cacheBusy, false); assert.equal(cloud.state.cacheAvailable, true);
  assert.deepEqual(storage.data, original); assert.equal(transport.writes.length, writes);
  cloud.dispose();
}

// Pure SDK errMsg quota failures during reads are localized and identifiable.
{
  const storage = new MemoryStorage(), transport = new FakeTransport(); putExpedition(storage, 1201);
  transport.read = async () => { throw { errMsg: 'writeFile fail: Total file size exceeds 100MB' }; };
  const cloud = new PlayerCloud({ storage, transport });
  const result = await cloud.initialize();
  assert.equal(result.code, 'STORAGE_QUOTA'); assert.match(result.error, /清理缓存/);
  assert.doesNotMatch(cloud.state.label, /writeFile|100MB/); cloud.dispose();
}

// Initialize, refresh, restore, and automatic upload expose their busy state and
// refuse maintenance before the transport is touched, including fallback slots.
for (const operation of ['initialize', 'refresh', 'restore', 'automatic']) {
  const storage = new MemoryStorage(), transport = new DeferredReadTransport(); putExpedition(storage, 1210);
  transport.cacheAvailable = true;
  let cleaned = 0; transport.clearSyncCache = async () => { cleaned += 1; return { ok: true, deletedCount: 0, deletedBytes: 0, failures: [] }; };
  const cloud = new PlayerCloud({ storage, transport });
  if (operation !== 'initialize') await cloud.initialize();
  let pending;
  if (operation === 'restore') {
    transport.remote = { token: 'chosen-cloud', data: envelope(1211) }; await cloud.refresh();
    transport.deferRead = true; pending = cloud.restore();
  } else if (operation === 'automatic') {
    await cloud.sync(); cloud.lastSyncAt = 0;
    let release;
    const write = transport.write.bind(transport);
    transport.write = async (...args) => { await new Promise(resolve => { release = resolve; }); return write(...args); };
    putExpedition(storage, 1212); cloud.notifyLocalChange();
    while (!release) await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(cloud.state.operationBusy, true);
    assert.equal((await cloud.clearSyncCache()).code, 'CACHE_BUSY'); assert.equal(cleaned, 0);
    release();
    while (cloud.state.operationBusy) await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal((await cloud.clearSyncCache()).ok, true); cloud.dispose(); continue;
  } else { transport.deferRead = true; pending = cloud[operation](); }
  while (!transport.readGate) await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(cloud.state.operationBusy, true, operation);
  assert.equal((await cloud.clearSyncCache()).code, 'CACHE_BUSY'); assert.equal(cleaned, 0);
  transport.readGate(); await pending;
  assert.equal(cloud.state.operationBusy, false); cloud.dispose();
}

// While cache deletion is pending, refresh/sync/restore and a second deletion
// are rejected without cloud calls; partial failures retain precise counts.
{
  const storage = new MemoryStorage(), transport = new FakeTransport(); putExpedition(storage, 1220);
  transport.cacheAvailable = true;
  let finish;
  transport.clearSyncCache = () => new Promise(resolve => { finish = resolve; });
  const cloud = new PlayerCloud({ storage, transport }); await cloud.initialize();
  const original = new Map(storage.data), pending = cloud.clearSyncCache();
  assert.equal(cloud.state.cacheBusy, true);
  assert.equal((await cloud.clearSyncCache()).code, 'CACHE_BUSY');
  assert.equal((await cloud.refresh()).code, 'CACHE_BUSY');
  assert.equal((await cloud.restore()).code, 'CACHE_BUSY');
  assert.equal((await cloud.sync()).code, 'CACHE_BUSY');
  finish({ ok: false, code: 'CACHE_PARTIAL_FAILURE', deletedCount: 1, deletedBytes: 7, failures: [{ fileName: 'retained.json', code: 'CACHE_DELETE_FAILED', error: '此同步缓存未能清理。' }], error: '部分同步缓存未能清理。' });
  const result = await pending;
  assert.equal(result.ok, false); assert.equal(result.deletedCount, 1); assert.equal(result.deletedBytes, 7);
  assert.equal(result.failures.length, 1); assert.equal(cloud.state.cacheBusy, false);
  assert.deepEqual(storage.data, original); assert.equal(transport.writes.length, 0); cloud.dispose();
}

{
  const storage = new MemoryStorage(), transport = new FakeTransport();
  const cloud = new PlayerCloud({ storage, transport });
  assert.equal(cloud.state.cacheAvailable, false);
  assert.equal((await cloud.clearSyncCache()).code, 'CACHE_UNAVAILABLE'); cloud.dispose();
}

// Manual latest-sync is a maintenance intent, never permission to replace a
// different valid remote. Virtual timers exercise retries without real waits.
const latestChecks = [];
function latestFixture(transport = new FakeTransport(), legacyTransport) {
  const storage = new MemoryStorage(); putExpedition(storage, 1300);
  const timers = new Map(); let sequence = 0, clock = 100000;
  const cloud = new PlayerCloud({ storage, transport, legacyTransport, setTimer: (fn, delay) => { const id = ++sequence; timers.set(id, { fn, delay }); return id; }, clearTimer: id => timers.delete(id), now: () => clock });
  return { storage, transport, cloud, timers, async tick() {
    assert.equal(timers.size, 1); const [id, timer] = [...timers][0]; timers.delete(id); clock += timer.delay; timer.fn();
    for (let i = 0; i < 100 && cloud.state.operationBusy; i++) await Promise.resolve();
    assert.equal(cloud.state.operationBusy, false); return timer.delay;
  } };
}

{
  const { cloud, storage, transport } = latestFixture();
  const local = storage.getItem(EXPEDITION), result = await cloud.syncLatest();
  assert.equal(result.ok, true); assert.equal(result.cacheResult.code, 'CACHE_UNAVAILABLE');
  assert.equal(transport.remote.data.data.expedition.coins, 1300); assert.equal(storage.getItem(EXPEDITION), local);
  const writes = transport.writes.length; assert.equal((await cloud.syncLatest()).ok, true); assert.equal(transport.writes.length, writes);
  putExpedition(storage, 1301); assert.equal((await cloud.syncLatest()).ok, true); assert.equal(transport.remote.data.data.expedition.coins, 1301);
  cloud.dispose(); latestChecks.push('no scanner: create, equal no-op, same-baseline latest upload, unchanged local bytes');
}

for (const cleanup of ['empty', 'quota', 'partial', 'unavailable']) {
  const fixture = latestFixture(), { cloud, storage, transport } = fixture;
  transport.cacheAvailable = true; let quota = cleanup === 'quota', cleaned = 0;
  const write = transport.write.bind(transport);
  transport.write = (...args) => { assert.equal(quota, false); return write(...args); };
  transport.clearSyncCache = async () => {
    cleaned++; quota = false; putExpedition(storage, 1302);
    return { ok: !['partial', 'unavailable'].includes(cleanup), deletedCount: cleanup === 'empty' ? 0 : 1, deletedBytes: 3,
      ...(cleanup === 'partial' ? { code: 'CACHE_PARTIAL_FAILURE', failures: [{ fileName: 'retained.json' }] } : {}),
      ...(cleanup === 'unavailable' ? { code: 'CACHE_UNAVAILABLE', unavailable: true } : {}) };
  };
  const result = await cloud.syncLatest(); assert.equal(result.ok, true); assert.equal(cleaned, 1);
  assert.equal(transport.remote.data.data.expedition.coins, 1302, 'capture latest after cleanup');
  assert.equal(result.cacheResult.ok, !['partial', 'unavailable'].includes(cleanup));
  cloud.dispose(); latestChecks.push(`${cleanup} cleanup preserves actual outcome and permits safe latest upload`);
}

for (const failure of ['different', 'invalid', 'read-error', 'invalid-local', 'external-meta']) {
  const { cloud, storage, transport } = latestFixture();
  if (failure === 'different') transport.remote = { token: 'other-cloud', data: envelope(1777) };
  if (failure === 'invalid') transport.remote = { token: 'invalid', data: { schemaVersion: 99 } };
  if (failure === 'read-error') transport.read = async () => { throw new Error('offline'); };
  if (failure === 'invalid-local') storage.setItem(EXPEDITION, '{invalid');
  if (failure === 'external-meta') storage.setItem(META, '{"schemaVersion":99}');
  const before = new Map(storage.data), remote = structuredClone(transport.remote), result = await cloud.syncLatest();
  assert.equal(result.ok, false); assert.equal(Boolean(result.conflict), failure === 'different');
  assert.equal(transport.writes.length, 0); assert.deepEqual(transport.remote, remote); assert.deepEqual(storage.data, before);
  cloud.dispose(); latestChecks.push(`${failure}: no overwrite, restore or local reset`);
}

{
  const { cloud, storage, transport } = latestFixture();
  let release; transport.cacheAvailable = true;
  transport.clearSyncCache = () => new Promise(resolve => { release = resolve; });
  const pending = cloud.syncLatest(); assert.equal(cloud.state.operationBusy, true);
  assert.equal((await cloud.syncLatest()).code, 'CACHE_BUSY'); assert.equal((await cloud.refresh()).code, 'CACHE_BUSY');
  assert.equal((await cloud.sync()).code, 'CACHE_BUSY'); assert.equal((await cloud.clearSyncCache()).code, 'CACHE_BUSY');
  putExpedition(storage, 1303); release({ ok: true, deletedCount: 0, deletedBytes: 0, failures: [] });
  assert.equal((await pending).ok, true); assert.equal(transport.remote.data.data.expedition.coins, 1303); assert.equal(transport.writes.length, 1);
  cloud.dispose(); latestChecks.push('one lock across cleanup/read/upload; repeated requests excluded; legal local growth retained');
}

{
  const { cloud, storage, transport } = latestFixture(); const write = transport.write.bind(transport); let attempts = 0;
  transport.write = async (data, token, options) => {
    if (++attempts === 1) putExpedition(storage, 1304);
    if (!options.beforeMutation()) return { ok: false, code: 'LOCAL_CHANGED' };
    return write(data, token);
  };
  const result = await cloud.syncLatest(); assert.equal(result.ok, true); assert.equal(attempts, 2);
  assert.equal(transport.writes.length, 1); assert.equal(transport.remote.data.data.expedition.coins, 1304);
  cloud.dispose(); latestChecks.push('stale prepared capture cancelled before mutation then recaptured');
}

{
  const fixture = latestFixture(), { cloud, storage, transport, timers } = fixture;
  const write = transport.write.bind(transport); let grew = false;
  transport.write = async (...args) => { const result = await write(...args); if (!grew) { grew = true; putExpedition(storage, 1305); } return result; };
  cloud.paused = true; const result = await cloud.syncLatest();
  assert.equal(result.ok, false); assert.equal(result.pending, true); assert.equal(cloud.state.status, 'pending');
  assert.equal(transport.remote.data.data.expedition.coins, 1300); assert.equal(timers.size, 1);
  await fixture.tick(); assert.equal(transport.remote.data.data.expedition.coins, 1305); assert.equal(cloud.state.status, 'synced');
  cloud.dispose(); latestChecks.push('edits during upload remain pending; manual continuation runs while dialog paused');
}

for (const where of ['write', 'read']) {
  const fixture = latestFixture(), { cloud, storage, transport, timers } = fixture;
  const original = transport[where].bind(transport); let rateLimited = true;
  transport[where] = async (...args) => {
    if (rateLimited) { rateLimited = false; if (where === 'read') throw { code: 'CLOUD_RATE_LIMIT', retryAfter: 60000 }; return { ok: false, code: 'CLOUD_RATE_LIMIT', retryAfter: 60000 }; }
    return original(...args);
  };
  cloud.paused = true; const result = await cloud.syncLatest();
  assert.equal(result.pending, true); assert.equal(result.retryAfter, 60000); assert.equal(timers.size, 1);
  putExpedition(storage, 1306); assert.equal(await fixture.tick(), 60000);
  assert.equal(transport.remote.data.data.expedition.coins, 1306); assert.equal(cloud.state.status, 'synced');
  cloud.dispose(); assert.equal(timers.size, 0); latestChecks.push(`${where} rate limit: automatic delayed manual retry takes fresh local data despite pause`);
}

{
  const fixture = latestFixture(), { cloud, storage, transport, timers } = fixture;
  await cloud.syncLatest(); putExpedition(storage, 1307); cloud.notifyLocalChange(); assert.equal(timers.size, 1);
  assert.equal((await cloud.syncLatest()).ok, true); assert.equal(timers.size, 0, 'manual request absorbs scheduled automatic upload');
  cloud.dispose(); latestChecks.push('manual request absorbs old automatic timer without duplicate upload');
}

for (const phase of ['cleanup', 'read', 'write']) {
  const { cloud, storage, transport, timers } = latestFixture(); let release;
  if (phase === 'cleanup') { transport.cacheAvailable = true; transport.clearSyncCache = () => new Promise(resolve => { release = () => resolve({ ok: true }); }); }
  if (phase === 'read') transport.read = () => new Promise(resolve => { release = () => resolve(null); });
  if (phase === 'write') transport.write = (data, token, options) => new Promise(resolve => { release = () => { assert.equal(options.beforeMutation(), false); resolve({ ok: false }); }; });
  const before = new Map(storage.data), pending = cloud.syncLatest();
  for (let i = 0; i < 100 && !release; i++) await Promise.resolve();
  assert.equal(typeof release, 'function'); cloud.dispose(); release(); const result = await pending;
  assert.equal(result.ok, false); assert.equal(result.disposed, true); assert.deepEqual(storage.data, before); assert.equal(timers.size, 0);
  assert.equal(transport.remote, null); latestChecks.push(`dispose during ${phase}: late completion never starts further mutation`);
}

for (const uncertain of [true, false]) {
  const { cloud, transport } = latestFixture(); transport.cacheAvailable = true;
  transport.clearSyncCache = async () => { transport.operationBusy = !uncertain; return { ok: false, uncertain }; };
  const result = await cloud.syncLatest(); assert.equal(result.ok, false); assert.equal(result.code, 'CACHE_BUSY'); assert.equal(transport.writes.length, 0);
  cloud.dispose(); latestChecks.push(`${uncertain ? 'uncertain cleanup' : 'lingering transport activity'} stops sync without forcibly unlocking transport`);
}

const { mkdir, writeFile } = await import('node:fs/promises');
{
  const { cloud, storage, transport } = latestFixture(); await cloud.syncLatest();
  putExpedition(storage, 1310); const write = transport.write.bind(transport);
  transport.write = async (...args) => { transport.remote = { token: 'concurrent-device', data: envelope(1444) }; return write(...args); };
  const before = storage.getItem(EXPEDITION), result = await cloud.syncLatest();
  assert.equal(result.ok, false); assert.equal(result.conflict, true); assert.equal(storage.getItem(EXPEDITION), before);
  assert.equal(transport.remote.data.data.expedition.coins, 1444); cloud.dispose();
  latestChecks.push('cloud changes after fresh read: CAS rejects mutation and preserves both versions');
}

{
  const { cloud, storage, transport } = latestFixture();
  transport.write = async (data, token, options) => { storage.setItem(META, '{"schemaVersion":99}'); assert.equal(options.beforeMutation(), false); return { ok: false, code: 'LOCAL_CHANGED' }; };
  assert.equal((await cloud.syncLatest()).ok, false); assert.equal(transport.remote, null); assert.equal(storage.getItem(META), '{"schemaVersion":99}');
  cloud.dispose(); latestChecks.push('other-page metadata changed during upload: mutation guard refuses overwrite');
}

{
  const fixture = latestFixture(), { cloud, transport, timers } = fixture;
  transport.write = async () => ({ ok: false, uncertain: true, code: 'CLOUD_TIMEOUT', retryAfter: 60000, error: 'server outcome unknown' });
  const result = await cloud.syncLatest(); assert.equal(result.ok, false); assert.equal(result.uncertain, true); assert.equal(timers.size, 0);
  cloud.dispose(); latestChecks.push('uncertain timed-out mutation is never automatically retried');
}

await mkdir(new URL('../output/cloud-sync-latest/', import.meta.url), { recursive: true });
for (const adapterName of ['transport', 'legacyTransport']) for (const flag of ['transportBlocked', 'writeBlocked', 'operationUncertain']) {
  const legacy = new FakeTransport(), fixture = latestFixture(new FakeTransport(), legacy), { cloud, transport, timers } = fixture;
  transport.write = async () => ({ ok: false, retryAfter: 60000 });
  assert.equal((await cloud.syncLatest()).pending, true); assert.equal(timers.size, 1);
  const adapter = adapterName === 'transport' ? transport : legacy; adapter[flag] = true; adapter.operationBusy = true;
  const [id, timer] = [...timers][0]; timers.delete(id); timer.fn();
  assert.equal(timers.size, 0, 'blocked timeout must not become a 1-second polling timer');
  assert.equal(cloud.manualRequested, false); assert.equal(cloud.state.errorCode, 'CLOUD_BLOCKED'); assert.match(cloud.state.error, /重新进入/);
  assert.equal((await cloud.syncLatest()).code, 'CLOUD_BLOCKED'); cloud.dispose();
  latestChecks.push(`${adapterName}.${flag}: pending retry cancelled, no polling or forced lease unlock`);
}

{
  const transport = new DeferredReadTransport(), { cloud, storage, timers } = latestFixture(transport);
  transport.deferRead = true; const pending = cloud.initialize();
  while (!transport.readGate) await Promise.resolve();
  const requested = await cloud.syncLatest(); assert.equal(requested.pending, true); assert.equal(timers.size, 0);
  putExpedition(storage, 1311); transport.readGate(); await pending;
  for (let i = 0; i < 100 && cloud.state.operationBusy; i++) await Promise.resolve();
  assert.equal(transport.remote.data.data.expedition.coins, 1311); assert.equal(transport.writes.length, 1);
  cloud.dispose(); latestChecks.push('manual click during initialize is consumed once by business completion notification, without polling');
}

{
  class ActivityTransport extends FakeTransport {
    operationBusy = false; listener = null;
    subscribeActivity(listener) { this.listener = listener; return () => { this.listener = null; }; }
  }
  const fixture = latestFixture(new ActivityTransport()), { cloud, storage, transport, timers } = fixture;
  const write = transport.write.bind(transport); let limited = true;
  transport.write = (...args) => { if (limited) { limited = false; return { ok: false, retryAfter: 60000 }; } return write(...args); };
  assert.equal((await cloud.syncLatest()).pending, true);
  transport.operationBusy = true; const [id, timer] = [...timers][0]; timers.delete(id); timer.fn();
  assert.equal(timers.size, 0); assert.equal(cloud.manualRequested, true);
  putExpedition(storage, 1312); transport.operationBusy = false; transport.listener();
  for (let i = 0; i < 100 && cloud.state.operationBusy; i++) await Promise.resolve();
  assert.equal(transport.remote.data.data.expedition.coins, 1312); assert.equal(timers.size, 0);
  cloud.dispose(); latestChecks.push('normal transport busy parks manual retry until activity completion; no periodic polling');
}

{
  const legacy = new FakeTransport(); legacy.remote = { token: 'legacy-existing', data: envelope(1300) };
  const fixture = latestFixture(new FakeTransport(), legacy), { cloud, transport, timers } = fixture;
  const write = transport.write.bind(transport); let attempts = 0;
  transport.write = (...args) => { attempts++; if (attempts === 1) return { ok: false, error: 'first promotion failed' }; if (attempts === 2) return { ok: false, retryAfter: 60000 }; return write(...args); };
  assert.equal((await cloud.initialize()).ok, false);
  const result = await cloud.syncLatest(); assert.equal(result.pending, true); assert.equal(result.retryAfter, 60000); assert.equal(timers.size, 1);
  await fixture.tick(); assert.equal(cloud.state.status, 'synced'); assert.equal(transport.remote.data.data.expedition.coins, 1300);
  assert.equal(legacy.remote.token, 'legacy-existing'); assert.equal(attempts, 3); cloud.dispose();
  latestChecks.push('legacy promotion failure then code-less retryAfter retained through refresh; delayed retry establishes new slot safely');
}

for (const method of ['initialize', 'refresh', 'syncLatest']) {
  const legacy = new FakeTransport(); legacy.remote = { token: 'legacy-uncertain', data: envelope(1300) };
  const { cloud, transport, timers, storage } = latestFixture(new FakeTransport(), legacy);
  transport.write = async () => ({ ok: false, uncertain: true, retryAfter: 60000, code: 'CLOUD_TIMEOUT' });
  const before = new Map(storage.data), result = await cloud[method]();
  assert.equal(result.ok, false); assert.equal(result.uncertain, true); assert.equal(result.retryAfter, 60000);
  assert.equal(timers.size, 0); assert.deepEqual(storage.data, before); assert.equal(legacy.remote.token, 'legacy-uncertain');
  cloud.dispose(); latestChecks.push(`${method} retains uncertain legacy promotion outcome without scheduling retry or changing local keys`);
}

{
  class ActivityTransport extends FakeTransport {
    operationBusy = false; operationUncertain = false; listener = null;
    subscribeActivity(listener) { this.listener = listener; return () => { this.listener = null; }; }
  }
  const { cloud, transport, timers } = latestFixture(new ActivityTransport());
  transport.operationBusy = true; assert.equal((await cloud.syncLatest()).pending, true);
  assert.equal(cloud.manualRequested, true); assert.equal(timers.size, 0);
  transport.operationUncertain = true; transport.listener();
  assert.equal(cloud.manualRequested, false); assert.equal(timers.size, 0); assert.equal(cloud.state.errorCode, 'CLOUD_BLOCKED');
  transport.operationBusy = false; transport.operationUncertain = false; transport.listener();
  assert.equal(transport.writes.length, 0, 'late cleanup completion does not resurrect cancelled manual intent');
  assert.equal((await cloud.syncLatest()).ok, true, 'fresh explicit request can run once adapter uncertainty is resolved');
  cloud.dispose(); latestChecks.push('timed-out cleanup activity cancels parked intent; late callback cannot resurrect it; next explicit retry remains possible');
}

{
  const fixture = latestFixture(), { cloud, storage, transport, timers } = fixture;
  await cloud.syncLatest(); const write = transport.write.bind(transport); let release, delayed = true;
  transport.write = async (...args) => { if (delayed) { delayed = false; await new Promise(resolve => { release = resolve; }); } return write(...args); };
  putExpedition(storage, 1313); cloud.notifyLocalChange(); assert.equal(timers.size, 1);
  const [id, timer] = [...timers][0]; timers.delete(id); timer.fn();
  while (!release) await Promise.resolve();
  assert.equal((await cloud.syncLatest()).pending, true); putExpedition(storage, 1314); release();
  for (let i = 0; i < 200 && cloud.state.operationBusy; i++) await Promise.resolve();
  assert.equal(transport.remote.data.data.expedition.coins, 1314); assert.equal(timers.size, 0);
  assert.equal(cloud.state.status, 'synced'); cloud.dispose();
  latestChecks.push('manual click during normal automatic upload is consumed after completion and captures newest local progress');
}

await writeFile(new URL('../output/cloud-sync-latest/service-verification.json', import.meta.url), JSON.stringify({ passed: true, checks: latestChecks, environment: 'In-memory valid profiles and fake transport/virtual timers; physical TapTap host not verified.' }, null, 2) + '\n');
console.log('player cloud checks passed (historical save protection plus manual latest-sync maintenance, conflicts, retries and operation exclusion)');
