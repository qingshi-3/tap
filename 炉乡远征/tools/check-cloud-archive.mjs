import assert from 'node:assert/strict';
import { CloudArchive } from '../dist/js/cloud-archive.js';
import { PlayerCloud } from '../dist/js/player-cloud.js';

let fakeSequence = 0;
function fakeTap(controls = {}) {
  const root = `/user-${++fakeSequence}`;
  const files = new Map();
  const directories = new Set();
  const saves = [];
  const pending = new Map();
  let sequence = 0;
  const calls = { getArchiveList: 0, stat: [], unlink: [], write: [], download: [] };
  const missing = () => ({ errCode: 1300002, errMsg: 'no such file or directory' });
  function schedule(method, mode, work) {
    if (mode === 'timeout' || mode === 'defer') {
      if (!pending.has(method)) pending.set(method, []);
      pending.get(method).push(work);
    } else queueMicrotask(work);
  }
  function stats(path) {
    return { size: directories.has(path) ? 0 : Buffer.byteLength(files.get(path) ?? '', 'utf8'),
      isFile: () => !directories.has(path), isDirectory: () => directories.has(path) };
  }
  const fs = {
    writeFile({ filePath, data, success, fail }) {
      calls.write.push(filePath);
      schedule('writeFile', controls.write, () => {
        files.set(filePath, data);
        if (controls.write === 'failure' || controls.write === 'quota') fail({ errCode: 1300202, errMsg: 'writeFile:fail the maximum size of the file storage limit is exceeded' });
        else success({});
      });
    },
    readFile({ filePath, success, fail }) {
      schedule('readFile', controls.read, () => controls.read === 'failure' ? fail(new Error('read failed')) : files.has(filePath) ? success({ data: files.get(filePath) }) : fail(missing()));
    },
    stat({ path, recursive, success, fail }) {
      calls.stat.push({ path, recursive });
      schedule('stat', controls.scan, () => {
        if (controls.scan === 'failure') return fail(new Error('root scan denied'));
        if (path !== root) return files.has(path) || directories.has(path) ? success({ stats: controls.fileStats ?? stats(path) }) : fail(missing());
        assert.equal(recursive, true);
        if (controls.scan === 'malformed') return success({ stats: stats(root) });
        const entries = [...new Set([...files.keys(), ...directories])].map(path => ({ path, stats: stats(path) }));
        entries.push(...(controls.scanExtra ?? []).map(path => ({ path, stats: stats(path) })));
        success({ stats: controls.scan === 'object' ? Object.fromEntries(entries.map(entry => [entry.path, entry.stats])) : entries });
      });
    },
    unlink({ filePath, success, fail }) {
      calls.unlink.push(filePath);
      schedule('unlink', controls.unlink, () => {
        if (controls.failUnlink?.has(filePath)) return fail(new Error('permission denied'));
        if (!files.has(filePath)) return fail(missing());
        files.delete(filePath); success({});
      });
    }
  };
  const cloud = {
    getArchiveList({ success }) {
      calls.getArchiveList += 1;
      schedule('getArchiveList', controls.list, () => {
        controls.beforeList?.(calls.getArchiveList);
        success(controls.list === 'malformed' ? {} : { saves: saves.map((save) => ({ ...save })) });
      });
    },
    getArchiveData({ archiveUUID, archiveFileId, targetFilePath, success, fail }) {
      calls.download.push(targetFilePath);
      const save = saves.find((item) => item.uuid === archiveUUID && item.fileId === archiveFileId);
      schedule('getArchiveData', controls.download, () => {
        if (!save) fail(new Error('missing archive'));
        else {
          files.set(targetFilePath, save.data);
          if (controls.download === 'failure') fail(new Error('download failed after partial write'));
          else success({ filePath: controls.downloadPath ?? targetFilePath });
        }
      });
    },
    createArchive(options) { mutate(options, null); },
    updateArchive(options) { mutate(options, options.archiveUUID); }
  };
  function mutate(options, uuid) {
    schedule('mutation', controls.mutation, () => {
      if (controls.mutation === 'rate-limit') return options.fail({ errCode: 400001, errMsg: 'upload frequency exceeded' });
      if (controls.mutation === 'failure') return options.fail(new Error('server rejected'));
      assert.ok(files.has(options.archiveFilePath), 'SDK mutation retains its upload until the callback');
      const existing = saves.find((save) => save.uuid === uuid);
      const record = existing ?? { name: options.archiveMetaData.name, uuid: `uuid-${++sequence}`, fileId: '' };
      record.fileId = `file-${++sequence}`;
      record.data = controls.afterMutationData === undefined ? files.get(options.archiveFilePath) : JSON.stringify(controls.afterMutationData);
      if (!existing) saves.push(record);
      options.success({ uuid: record.uuid, fileId: record.fileId });
    });
  }
  return {
    tap: { env: { USER_DATA_PATH: root }, getCloudSaveManager: () => cloud, getFileSystemManager: () => fs },
    saves, calls, files, directories, root, fs, controls, pending,
    deliver(method) { const work = pending.get(method)?.shift(); assert.ok(work, `pending ${method}`); work(); },
    addRemote(data) { saves.push({ name: 'duelyst_player_safe_v1', uuid: `uuid-${++sequence}`, fileId: `file-${++sequence}`, data: JSON.stringify(data) }); },
    setRemote(data) {
      const save = saves[0];
      save.fileId = `file-${++sequence}`;
      save.data = JSON.stringify(data);
    }
  };
}

{
  const fake = fakeTap();
  const archive = new CloudArchive({
    tap: fake.tap,
    timeoutMs: 30,
    onStatus() { throw new Error('observer failed'); }
  });
  assert.equal(archive.available, true);
  assert.equal(await archive.read(), null);
  const source = { profile: { wins: 1 }, playtimeSeconds: 9 };
  const created = await archive.write(source, null);
  assert.equal(created.ok, true);
  source.profile.wins = 99;
  assert.deepEqual((await archive.read()).data.profile, { wins: 1 }, 'write snapshots input immediately');
  const limited = await archive.write({ profile: { wins: 2 } }, created.token);
  assert.equal(limited.ok, false);
  assert.ok(limited.retryAfter > 0 && limited.retryAfter <= 60_000);
}

{
  const fake = fakeTap();
  const archive = new CloudArchive({ tap: fake.tap, timeoutMs: 30 });
  const created = await archive.write({ revision: 1 }, null);
  fake.setRemote({ revision: 2 });
  const conflict = await archive.write({ revision: 3 }, created.token);
  assert.equal(conflict.conflict, true);
  assert.deepEqual(conflict.remote.data, { revision: 2 });
}

{
  const fake = fakeTap({ mutation: 'failure' });
  const archive = new CloudArchive({ tap: fake.tap, timeoutMs: 30 });
  const failed = await archive.write({ revision: 1 }, null);
  assert.equal(failed.ok, false);
  assert.match(failed.error, /server rejected/);
}

{
  const fake = fakeTap({ mutation: 'timeout' });
  const archive = new CloudArchive({ tap: fake.tap, timeoutMs: 15 });
  const timedOut = await archive.write({ revision: 1 }, null);
  assert.equal(timedOut.uncertain, true);
  const blocked = await archive.write({ revision: 2 }, null);
  assert.match(blocked.error, /blocked/);
}

{
  const fake = fakeTap({ list: 'timeout' });
  const archive = new CloudArchive({ tap: fake.tap, timeoutMs: 15 });
  await assert.rejects(archive.read(), /timed out/);
  await assert.rejects(archive.read(), /blocked/);
  assert.equal(fake.calls.getArchiveList, 1, 'a timed out SDK call blocks later API calls');
}

{
  const fake = fakeTap({ list: 'malformed' });
  const archive = new CloudArchive({ tap: fake.tap, timeoutMs: 30 });
  await assert.rejects(archive.read(), /malformed response/);
  const failed = await archive.write({ revision: 1 }, null);
  assert.match(failed.error, /malformed response/);
  assert.equal(fake.saves.length, 0, 'malformed list response must never be treated as no archive');
}

{
  const fake = fakeTap({ afterMutationData: { revision: 99 } });
  const archive = new CloudArchive({ tap: fake.tap, timeoutMs: 30 });
  const result = await archive.write({ revision: 1 }, null);
  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  assert.equal(result.uncertain, true);
  assert.deepEqual(result.remote.data, { revision: 99 });
}

{
  const fake = fakeTap();
  fake.saves.push(
    { name: 'duelyst_player_safe_v1', uuid: 'a', fileId: '1', data: '{}' },
    { name: 'duelyst_player_safe_v1', uuid: 'b', fileId: '2', data: '{}' }
  );
  const archive = new CloudArchive({ tap: fake.tap, timeoutMs: 30 });
  await assert.rejects(archive.read(), /Multiple cloud archives/);
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

// Real production operations leave no staging files after success, rejection,
// rate limiting, or a verified conflict, including repeated synchronization.
{
  const fake = fakeTap(), archive = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  let token = null;
  for (let revision = 1; revision <= 25; revision++) {
    archive.lastMutationAt = 0;
    const result = await archive.write({ revision, text: '炉乡远征' }, token);
    assert.equal(result.ok, true); token = result.token;
    assert.deepEqual((await archive.read()).data, { revision, text: '炉乡远征' });
    assert.equal(fake.files.size, 0, `sync ${revision} must release all temporary files`);
  }
  assert.ok((await archive.write({ revision: 26 }, token)).retryAfter);
  assert.equal(fake.files.size, 0, 'rate-limited verification releases its download');
  fake.setRemote({ revision: 27 });
  assert.equal((await archive.write({ revision: 28 }, token)).conflict, true);
  assert.equal(fake.files.size, 0, 'early conflict releases its download');
}

for (const stage of ['write', 'download', 'read', 'mutation']) {
  const fake = fakeTap({ [stage]: 'failure' });
  const archive = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  if (stage === 'download' || stage === 'read') fake.addRemote({ revision: 1 });
  if (stage === 'download' || stage === 'read') await assert.rejects(archive.read());
  else assert.equal((await archive.write({ revision: 2 }, null)).ok, false);
  assert.equal(fake.files.size, 0, `${stage} failure cleans even a partial temporary file`);
}

{
  const fake = fakeTap(), archive = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  fake.addRemote({ revision: 1 }); fake.saves[0].data = '{broken';
  await assert.rejects(archive.read(), SyntaxError);
  assert.equal(fake.files.size, 0, 'invalid JSON releases the download without changing the cloud source');
  assert.equal(fake.saves[0].data, '{broken');
}

{
  const fake = fakeTap(), archive = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  const result = await archive.write({ revision: 1 }, null, { beforeMutation: () => false });
  assert.equal(result.ok, false); assert.equal(fake.saves.length, 0); assert.equal(fake.files.size, 0);
}

{
  const fake = fakeTap({ beforeList(call) { if (call === 2) fake.addRemote({ revision: 2 }); } });
  const archive = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  assert.equal((await archive.write({ revision: 1 }, null)).conflict, true);
  assert.equal(fake.files.size, 0, 'post-staging conflict cleans both upload and latest remote download');
}

// Both documented recursive-stat representations are supported. A strict direct
// child filter protects formal saves, backups, directories and hostile paths.
for (const scan of ['array', 'object']) {
  const fake = fakeTap({ scan }), archive = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  const first = 'cloud-archive-download-1720000000000-1.json', second = 'cloud-archive-upload-1720000000001-2.json';
  fake.files.set(`${fake.root}/${first}`, '中'); fake.files.set(`${fake.root}/${second}`, 'abc');
  const preserved = [
    'player-save.json', 'player-save.backup.json', 'duelyst-h5.safe-v1.expedition',
    'cloud-archive-download-1720000000000-1.json.backup', 'cloud-archive-upload-1720000000000-0.json',
    'cloud-archive-download-1720000000000-1.json\n', 'cloud-archive-download-1720000000000-1.json/child',
    'sub/cloud-archive-upload-1720000000001-2.json', '../cloud-archive-upload-1720000000001-2.json'
  ];
  for (const name of preserved) fake.files.set(`${fake.root}/${name}`, 'preserve');
  const directory = `${fake.root}/cloud-archive-upload-1720000000002-3.json`;
  fake.directories.add(directory);
  fake.controls.scanExtra = [`${fake.root}-other/${first}`, `/outside/${first}`, `../${first}`, `${fake.root}\\${first}`, `${fake.root}/../${first}`];
  const before = new Map(fake.files);
  const result = await archive.clearSyncCache();
  assert.deepEqual(result, { ok: true, deletedCount: 2, deletedBytes: 6, failures: [] });
  for (const name of preserved) assert.equal(fake.files.get(`${fake.root}/${name}`), before.get(`${fake.root}/${name}`));
  assert.ok(fake.directories.has(directory));
  assert.deepEqual(new Set(fake.calls.unlink), new Set([`${fake.root}/${first}`, `${fake.root}/${second}`]));
  assert.equal((await archive.clearSyncCache()).deletedCount, 0, 'repeated cleanup is idempotent');
}

{
  const fake = fakeTap(), archive = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  const good = `${fake.root}/cloud-archive-upload-1720000000000-1.json`, bad = `${fake.root}/cloud-archive-download-1720000000001-2.json`;
  fake.files.set(good, '1234'); fake.files.set(bad, '12'); fake.controls.failUnlink = new Set([bad]);
  const result = await archive.clearSyncCache();
  assert.equal(result.ok, false); assert.equal(result.partial, true);
  assert.equal(result.deletedCount, 1); assert.equal(result.deletedBytes, 4);
  assert.equal(result.failures.length, 1); assert.equal(result.failures[0].fileName, bad.slice(fake.root.length + 1));
  assert.equal(fake.files.get(bad), '12');
  fake.controls.failUnlink.clear();
  assert.equal((await archive.clearSyncCache()).deletedCount, 1);
}

for (const scan of ['failure', 'malformed']) {
  const fake = fakeTap({ scan }), archive = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  const path = `${fake.root}/cloud-archive-upload-1720000000000-1.json`; fake.files.set(path, '123');
  const result = await archive.clearSyncCache();
  assert.equal(result.ok, false); assert.equal(result.code, 'CACHE_SCAN_FAILED');
  assert.equal(fake.files.get(path), '123'); assert.deepEqual(fake.calls.unlink, []);
}

// A read is reserved before its queue runs. Other instances of either archive
// slot cannot clean the shared directory, and target names never collide.
{
  const fake = fakeTap({ download: 'defer' }); fake.addRemote({ revision: 1 });
  const a = new CloudArchive({ tap: fake.tap, timeoutMs: 1000 }), b = new CloudArchive({ tap: fake.tap, timeoutMs: 1000 });
  const first = a.read();
  assert.equal((await b.clearSyncCache()).code, 'CACHE_BUSY');
  const second = b.read(); await tick();
  assert.equal(fake.calls.download.length, 2);
  assert.equal(new Set(fake.calls.download).size, 2, 'two adapter instances allocate distinct names');
  assert.equal((await b.clearSyncCache()).code, 'CACHE_BUSY');
  fake.deliver('getArchiveData'); fake.deliver('getArchiveData'); await Promise.all([first, second]);
  assert.equal(fake.files.size, 0); assert.equal((await b.clearSyncCache()).ok, true);
}

// JavaScript timeouts are not SDK completion. Delayed callbacks may still need
// to write/read an upload/download; cleanup waits for them, including failures.
for (const stage of ['writeFile', 'getArchiveData', 'readFile', 'mutation']) {
  const control = { writeFile: 'write', getArchiveData: 'download', readFile: 'read', mutation: 'mutation' }[stage];
  const fake = fakeTap({ [control]: 'timeout' });
  const a = new CloudArchive({ tap: fake.tap, timeoutMs: 12 }), b = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  if (stage === 'getArchiveData' || stage === 'readFile') fake.addRemote({ revision: 1 });
  if (stage === 'getArchiveData' || stage === 'readFile') await assert.rejects(a.read(), /timed out/);
  else assert.equal((await a.write({ revision: 1 }, null)).ok, false);
  const held = [...fake.files.keys()];
  assert.equal(a.operationBusy, true, `${stage}: the unfinished callback stays visible after operation timeout`);
  assert.equal((await b.clearSyncCache()).code, 'CACHE_BUSY');
  assert.deepEqual([...fake.files.keys()], held);
  fake.deliver(stage); await tick();
  assert.equal(fake.files.size, 0, `${stage}: late completion releases its own file`);
  assert.equal((await b.clearSyncCache()).ok, true);
}

// Explicit cleanup itself owns the shared lock until any timed out filesystem
// callback completes. It reports only confirmed deletion counts and bytes.
{
  const fake = fakeTap({ unlink: 'timeout' });
  const a = new CloudArchive({ tap: fake.tap, timeoutMs: 12 }), b = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  const path = `${fake.root}/cloud-archive-upload-1720000000000-1.json`; fake.files.set(path, '123');
  const cleaning = a.clearSyncCache();
  assert.equal((await b.clearSyncCache()).code, 'CACHE_BUSY');
  await assert.rejects(b.read(), error => error.code === 'CACHE_BUSY');
  assert.equal((await b.write({ revision: 1 }, null)).code, 'CACHE_BUSY');
  const result = await cleaning;
  assert.equal(result.ok, false); assert.equal(result.deletedCount, 0); assert.equal(result.deletedBytes, 0);
  assert.equal((await b.clearSyncCache()).code, 'CACHE_BUSY');
  fake.deliver('unlink'); await tick();
  assert.equal(fake.files.has(path), false); assert.equal((await b.clearSyncCache()).ok, true);
}

{
  const fake = fakeTap({ scan: 'timeout' });
  const a = new CloudArchive({ tap: fake.tap, timeoutMs: 12 }), b = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  assert.equal((await a.clearSyncCache()).code, 'CACHE_TIMEOUT');
  assert.equal((await b.clearSyncCache()).code, 'CACHE_BUSY');
  fake.deliver('stat'); await tick(); fake.controls.scan = 'array';
  assert.equal((await b.clearSyncCache()).ok, true);
}

{
  const fake = fakeTap({ unlink: 'timeout' }); fake.addRemote({ revision: 1 });
  const a = new CloudArchive({ tap: fake.tap, timeoutMs: 12 }), b = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  assert.deepEqual((await a.read()).data, { revision: 1 });
  assert.equal(fake.files.size, 1, 'an automatic unlink with no callback remains protected');
  assert.equal((await b.clearSyncCache()).code, 'CACHE_BUSY');
  fake.deliver('unlink'); await tick();
  assert.equal(fake.files.size, 0); assert.equal((await b.clearSyncCache()).ok, true);
}

{
  const fake = fakeTap(), archive = new CloudArchive({ tap: fake.tap, timeoutMs: 50 }); fake.addRemote({ revision: 1 });
  fake.controls.failUnlink = { has: () => true };
  assert.deepEqual((await archive.read()).data, { revision: 1 });
  assert.equal(fake.files.size, 1, 'completed cleanup failure leaves a recoverable cache');
  fake.controls.failUnlink = new Set();
  assert.equal((await archive.clearSyncCache()).deletedCount, 1);
}

// Malformed metadata for a matching file is a failure, never "nothing to clean".
{
  const fake = fakeTap({ fileStats: { size: 5 } }), archive = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  const path = `${fake.root}/cloud-archive-upload-1720000000000-1.json`; fake.files.set(path, '12345');
  const result = await archive.clearSyncCache();
  assert.equal(result.ok, false); assert.equal(result.deletedCount, 0); assert.equal(result.failures.length, 1);
  assert.equal(result.code, 'CACHE_PARTIAL_FAILURE'); assert.equal(fake.files.get(path), '12345'); assert.deepEqual(fake.calls.unlink, []);
}

function memoryStorage() {
  const data = new Map([['duelyst-h5.safe-v1.namespace', '{"version":1}']]);
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}

// Production PlayerCloud observers are notified when a late SDK callback frees
// the shared root. No new user action, state polling, or UI timer is necessary.
for (const stage of ['stat', 'unlink']) {
  const fake = fakeTap({ [stage === 'stat' ? 'scan' : 'unlink']: 'timeout' });
  const path = `${fake.root}/cloud-archive-upload-1720000000000-1.json`; fake.files.set(path, '12345');
  const transport = new CloudArchive({ tap: fake.tap, timeoutMs: 12 }), other = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  const firstEvents = [], otherEvents = [], disposedEvents = [];
  const first = new PlayerCloud({ storage: memoryStorage(), transport, onChange: state => firstEvents.push(state) });
  const second = new PlayerCloud({ storage: memoryStorage(), transport: other, onChange: state => otherEvents.push(state) });
  const disposed = new PlayerCloud({ storage: memoryStorage(), transport: other, onChange: state => disposedEvents.push(state) });
  const result = await first.clearSyncCache();
  assert.equal(result.ok, false); assert.equal(firstEvents.at(-1).cacheBusy, true); assert.equal(otherEvents.at(-1).cacheBusy, true);
  disposed.dispose(); const disposedCount = disposedEvents.length;
  const firstCount = firstEvents.length, otherCount = otherEvents.length;
  fake.deliver(stage); await tick();
  assert.ok(firstEvents.length > firstCount, `${stage}: initiating PlayerCloud receives late-release onChange`);
  assert.ok(otherEvents.length > otherCount, `${stage}: another instance receives shared late-release onChange`);
  for (const events of [firstEvents, otherEvents]) {
    assert.equal(events.at(-1).cacheBusy, false); assert.equal(events.at(-1).operationBusy, false);
  }
  assert.equal(disposedEvents.length, disposedCount, 'disposed PlayerCloud receives no late callback');
  fake.controls.scan = 'array'; fake.controls.unlink = 'success';
  assert.equal((await second.clearSyncCache()).ok, true);
  first.dispose(); second.dispose();
  assert.equal(transport.cache.listeners.size, 0, 'dispose releases both primary and legacy-root subscriptions');
}

// With two overdue SDK calls, only completion of the last call reports idle.
{
  const fake = fakeTap({ download: 'timeout' }); fake.addRemote({ revision: 1 });
  const a = new CloudArchive({ tap: fake.tap, timeoutMs: 12 }), b = new CloudArchive({ tap: fake.tap, timeoutMs: 12 });
  const events = [], observer = new PlayerCloud({ storage: memoryStorage(), transport: a, onChange: state => events.push(state) });
  await Promise.all([assert.rejects(a.read()), assert.rejects(b.read())]);
  assert.equal(events.at(-1).operationBusy, true);
  const count = events.length;
  fake.deliver('getArchiveData'); await tick();
  assert.equal(events.slice(count).some(state => !state.operationBusy), false, 'first late callback cannot announce idle while the second still owns a lease');
  fake.deliver('getArchiveData'); await tick();
  assert.equal(events.at(-1).operationBusy, false); assert.equal(fake.files.size, 0); observer.dispose();
}

// Quota recognition includes the exact reported host wording without an errno.
for (const error of [{ errCode: 1300202 }, { errMsg: 'writeFile fail: Total file size exceeds 100MB' }]) {
  const fake = fakeTap(); fake.fs.writeFile = ({ fail }) => queueMicrotask(() => fail(error));
  const archive = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  const result = await archive.write({ revision: 1 }, null);
  assert.equal(result.code, 'STORAGE_QUOTA'); assert.match(result.error, /清理缓存/);
  assert.equal(fake.files.size, 0); assert.equal(fake.saves.length, 0);
}

{
  const fake = fakeTap({ scan: 'timeout' });
  const archive = new CloudArchive({ tap: fake.tap, timeoutMs: 5 });
  const other = new CloudArchive({ tap: fake.tap, timeoutMs: 5 });
  const uncertain = [];
  const unsubscribe = other.subscribeActivity(() => uncertain.push(other.operationUncertain));
  assert.equal((await archive.clearSyncCache()).code, 'CACHE_TIMEOUT');
  assert.equal(archive.operationUncertain, true);
  assert.equal(other.operationUncertain, true, 'uncertain SDK operations are shared across adapters');
  assert.equal(uncertain.at(-1), true);
  fake.deliver('stat'); await tick();
  assert.equal(archive.operationUncertain, false);
  assert.equal(uncertain.at(-1), false, 'late completion clears the uncertainty and notifies observers');
  unsubscribe();
}

{
  const fake = fakeTap({ mutation: 'rate-limit' });
  const archive = new CloudArchive({ tap: fake.tap, timeoutMs: 50 });
  const result = await archive.write({ revision: 1 }, null);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CLOUD_RATE_LIMIT');
  assert.equal(result.retryAfter, 60_000);
  assert.equal(fake.files.size, 0, 'rate-limited uploads release their temporary file');
  assert.equal(fake.saves.length, 0, 'rate limiting does not create a cloud archive');
}

console.log('cloud archive checks passed (temporary-file lifecycle, shared locks, legacy-cache cleanup, quota errors and upload rate limits)');
