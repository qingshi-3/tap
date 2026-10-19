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
  assert.deepEqual(Object.keys(cloud.state).sort(), ['available', 'blocked', 'cloudSummary', 'conflict', 'error', 'hasRemote', 'label', 'localSummary', 'status'].sort());
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
  assert.equal(cloud.state.hasRemote, false); assert.match(cloud.state.error, /offline/);
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
console.log('player cloud checks passed');
