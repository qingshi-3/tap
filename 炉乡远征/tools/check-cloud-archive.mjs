import assert from 'node:assert/strict';
import { CloudArchive } from '../dist/js/cloud-archive.js';

function fakeTap({ mutation = 'success', list = 'success', afterMutationData } = {}) {
  const files = new Map();
  const saves = [];
  let sequence = 0;
  const fs = {
    writeFile({ filePath, data, success }) { files.set(filePath, data); queueMicrotask(() => success({})); },
    readFile({ filePath, success, fail }) {
      queueMicrotask(() => files.has(filePath) ? success({ data: files.get(filePath) }) : fail(new Error('missing file')));
    }
  };
  const cloud = {
    getArchiveList({ success }) {
      calls.getArchiveList += 1;
      if (list === 'timeout') return;
      queueMicrotask(() => success(list === 'malformed' ? {} : { saves: saves.map((save) => ({ ...save })) }));
    },
    getArchiveData({ archiveUUID, archiveFileId, targetFilePath, success, fail }) {
      const save = saves.find((item) => item.uuid === archiveUUID && item.fileId === archiveFileId);
      queueMicrotask(() => {
        if (!save) fail(new Error('missing archive'));
        else { files.set(targetFilePath, save.data); success({ filePath: targetFilePath }); }
      });
    },
    createArchive(options) { mutate(options, null); },
    updateArchive(options) { mutate(options, options.archiveUUID); }
  };
  function mutate(options, uuid) {
    if (mutation === 'timeout') return;
    if (mutation === 'failure') return queueMicrotask(() => options.fail(new Error('server rejected')));
    const existing = saves.find((save) => save.uuid === uuid);
    const record = existing ?? { name: options.archiveMetaData.name, uuid: `uuid-${++sequence}`, fileId: '' };
    record.fileId = `file-${++sequence}`;
    record.data = afterMutationData === undefined
      ? files.get(options.archiveFilePath)
      : JSON.stringify(afterMutationData);
    if (!existing) saves.push(record);
    queueMicrotask(() => options.success({ uuid: record.uuid, fileId: record.fileId }));
  }
  const calls = { getArchiveList: 0 };
  return {
    tap: { env: { USER_DATA_PATH: '/user' }, getCloudSaveManager: () => cloud, getFileSystemManager: () => fs },
    saves, calls,
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

console.log('cloud archive checks passed');
