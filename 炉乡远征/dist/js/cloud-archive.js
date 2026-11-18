import { CLOUD_ARCHIVE_NAME } from './storage-contract.js';
const DEFAULT_ARCHIVE_NAME = CLOUD_ARCHIVE_NAME;
const MIN_WRITE_INTERVAL = 60_000;
const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;
const CACHE_FILE = /^cloud-archive-(?:download|upload)-[0-9]{13}-[1-9][0-9]*\.json$/;
// Archive slots share USER_DATA_PATH. Locks and leases must outlive one adapter,
// including SDK calls whose JavaScript timeout has fired but whose callback has not.
const cacheRoots = new Map();

function rootState(path) {
  const root = String(path ?? '').replace(/\/+$/, '');
  if (!cacheRoots.has(root)) cacheRoots.set(root, { root, sequence: 0, operations: 0, requests: 0, timedOutRequests: 0, files: new Map(), cleaning: null, listeners: new Map(), activityKey: 'false:false:false' });
  return cacheRoots.get(root);
}

function operationBusy(cache) { return !cache.cleaning && Boolean(cache.operations || cache.requests || cache.files.size); }
function notifyActivity(cache) {
  const key = `${Boolean(cache.cleaning)}:${operationBusy(cache)}:${cache.timedOutRequests > 0}`;
  if (cache.activityKey === key) return;
  cache.activityKey = key;
  // Observers read current state. A listener may dispose another observer, and
  // observer failures must never interrupt SDK completion or lock release.
  for (const listener of [...cache.listeners.keys()]) {
    if (cache.listeners.has(listener)) { try { listener(); } catch {} }
  }
}

function codedError(code, message) { return Object.assign(new Error(message), { code }); }
function normalizeError(error) {
  if (Number(error?.errCode ?? error?.errno ?? error?.code) === 400001) {
    return Object.assign(codedError('CLOUD_RATE_LIMIT', '云同步频率受限，稍后会自动重试。'), { retryAfter: MIN_WRITE_INTERVAL });
  }
  if (Number(error?.errCode ?? error?.errno ?? error?.code) === 1300202
    || /quota|ENOSPC|no space|maximum size of (?:the )?file storage|storage.{0,30}(?:limit|exceed)|exceed.{0,30}storage|total file size.{0,30}exceed|exceed.{0,20}100\s*MB/i.test(errorMessage(error))) {
    return codedError('STORAGE_QUOTA', '同步缓存空间不足，请清理缓存后重试。');
  }
  return error;
}
function failure(error, prefix = '', details = {}) {
  error = normalizeError(error);
  return { ok: false, token: null, ...details,
    ...(Number.isFinite(error?.retryAfter) ? { retryAfter: error.retryAfter } : {}),
    code: error?.code ?? 'CLOUD_ERROR', error: `${prefix}${errorMessage(error)}` };
}
function missingFile(error) { return Number(error?.errCode ?? error?.errno) === 1300002 || /ENOENT|no such file|missing file/i.test(errorMessage(error)); }
function cacheResult(code, error, details = {}) {
  return { ok: false, deletedCount: 0, deletedBytes: 0, failures: [], code, error, ...details };
}

function cacheFileName(root, path) {
  if (typeof path !== 'string') return null;
  const name = path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
  return CACHE_FILE.test(name) && !/[\/\\\r\n]/.test(name) ? name : null;
}

function scanNames(root, stats) {
  // The SDK documents both FileStats[] and a path -> Stats object for recursive stat.
  const paths = Array.isArray(stats) && stats.every(entry => typeof entry?.path === 'string' && entry.stats && typeof entry.stats === 'object') ? stats.map(entry => entry.path)
    : stats && typeof stats === 'object' && typeof stats.isDirectory !== 'function' && typeof stats.isFile !== 'function'
      && !Array.isArray(stats) && Object.values(stats).every(value => value && typeof value === 'object') ? Object.keys(stats) : null;
  if (!paths) throw new Error('Malformed recursive stat response.');
  return [...new Set(paths.map(path => cacheFileName(root, path)).filter(Boolean))];
}

class RequestTimeoutError extends Error {
  constructor(method) {
    super(`${method} timed out`);
    this.name = 'RequestTimeoutError';
    this.method = method;
    this.code = 'CLOUD_TIMEOUT';
  }
}

function errorMessage(error) {
  return error?.errMsg ?? error?.message ?? String(error ?? 'unknown error');
}

function archiveToken(archive) {
  return JSON.stringify([archive.uuid, archive.fileId]);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export class CloudArchive {
  constructor({
    tap = globalThis.tap,
    archiveName = DEFAULT_ARCHIVE_NAME,
    onStatus = () => {},
    intervalMs = MIN_WRITE_INTERVAL,
    timeoutMs = 25_000
  } = {}) {
    this.tap = tap;
    this.archiveName = archiveName;
    this.onStatus = onStatus;
    this.intervalMs = Math.max(MIN_WRITE_INTERVAL, Number(intervalMs) || MIN_WRITE_INTERVAL);
    this.timeoutMs = Math.max(1, Number(timeoutMs) || 25_000);
    this.cloud = null;
    this.fs = null;
    this.queue = Promise.resolve();
    this.lastMutationAt = 0;
    this.writeBlocked = false;
    this.transportBlocked = false;
    this.cache = rootState(tap?.env?.USER_DATA_PATH);

    if (this.available) {
      try {
        this.cloud = tap.getCloudSaveManager();
        this.fs = tap.getFileSystemManager();
      } catch (error) {
        this._status('unavailable', errorMessage(error));
      }
    }
  }

  get available() {
    return Boolean(
      this.tap
      && typeof this.tap.getCloudSaveManager === 'function'
      && typeof this.tap.getFileSystemManager === 'function'
      && typeof this.tap.env?.USER_DATA_PATH === 'string'
      && this.tap.env.USER_DATA_PATH
    );
  }

  get cacheAvailable() { return this.available && ['stat', 'unlink'].every(method => typeof this.fs?.[method] === 'function'); }
  get cacheBusy() { return Boolean(this.cache.cleaning); }
  get operationBusy() { return operationBusy(this.cache); }
  get operationUncertain() { return this.cache.timedOutRequests > 0 || this.transportBlocked || this.writeBlocked; }

  subscribeActivity(listener) {
    if (typeof listener !== 'function') return () => {};
    const listeners = this.cache.listeners;
    listeners.set(listener, (listeners.get(listener) ?? 0) + 1);
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      const count = listeners.get(listener) ?? 0;
      if (count > 1) listeners.set(listener, count - 1);
      else listeners.delete(listener);
    };
  }

  async clearSyncCache() {
    if (!this.cacheAvailable) return cacheResult('CACHE_UNAVAILABLE', '当前环境不支持清理同步缓存。', { unavailable: true });
    if (this.cacheBusy || this.operationBusy) return cacheResult('CACHE_BUSY', '同步或恢复尚未完成，请稍后再清理。', { busy: true });
    const lock = { ended: false };
    this.cache.cleaning = lock;
    notifyActivity(this.cache);
    const result = { ok: true, deletedCount: 0, deletedBytes: 0, failures: [] };
    try {
      let names;
      try {
        // readdir cannot enumerate USER_DATA_PATH in the TapTap SDK. Recursive
        // stat is the documented listing API here; only direct children qualify.
        const scanned = await this._request(this.fs, 'stat', { path: this.cache.root, recursive: true }, null, false);
        names = scanNames(this.cache.root, scanned?.stats);
      } catch (error) {
        return cacheResult(error instanceof RequestTimeoutError ? 'CACHE_TIMEOUT' : 'CACHE_SCAN_FAILED', '无法读取同步缓存，请稍后重试。');
      }
      for (const fileName of names) {
        const filePath = `${this.cache.root}/${fileName}`;
        try {
          const { stats } = await this._request(this.fs, 'stat', { path: filePath, recursive: false }, null, false);
          if (typeof stats?.isFile !== 'function' || typeof stats?.isDirectory !== 'function') throw new Error('Malformed cache file stat response.');
          const directory = stats.isDirectory(), file = stats.isFile();
          if (directory === true && file === false) continue;
          if (directory !== false || file !== true) throw new Error('Invalid cache file type.');
          if (!Number.isFinite(stats.size) || stats.size < 0) throw new Error('Invalid cache file size.');
          await this._request(this.fs, 'unlink', { filePath }, null, false);
          result.deletedCount += 1;
          result.deletedBytes += stats.size;
        } catch (error) {
          if (!missingFile(error)) result.failures.push({ fileName, code: error instanceof RequestTimeoutError ? 'CACHE_TIMEOUT' : 'CACHE_DELETE_FAILED', error: '此同步缓存未能清理，请稍后重试。' });
          if (error instanceof RequestTimeoutError) break;
        }
      }
      if (result.failures.length) Object.assign(result, { ok: false, partial: result.deletedCount > 0, code: 'CACHE_PARTIAL_FAILURE', error: '部分同步缓存未能清理，请稍后重试。' });
      return result;
    } finally {
      lock.ended = true;
      this._releaseCacheLock();
    }
  }

  read() {
    return this._enqueue(() => this._readDirect());
  }

  write(data, expectedToken = null, { beforeMutation } = {}) {
    let serialized;
    let snapshot;
    try {
      serialized = JSON.stringify(data);
      snapshot = JSON.parse(serialized);
    } catch (error) {
      return Promise.resolve({ ok: false, token: null, error: `Snapshot is not JSON serializable: ${errorMessage(error)}` });
    }

    if (new TextEncoder().encode(serialized).byteLength > MAX_ARCHIVE_BYTES) {
      return Promise.resolve({ ok: false, token: null, error: 'Cloud archive exceeds the 10 MB limit.' });
    }
    return this._enqueue(() => this._writeDirect(snapshot, serialized, expectedToken, beforeMutation)).catch(error => failure(error));
  }

  _enqueue(operation) {
    if (this.cacheBusy) return Promise.reject(codedError('CACHE_BUSY', '正在清理同步缓存，请稍后重试。'));
    this.cache.operations += 1;
    const run = async () => {
      try { return await operation(); }
      finally { this.cache.operations -= 1; notifyActivity(this.cache); }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    notifyActivity(this.cache);
    return result;
  }

  _status(kind, message, details = {}) {
    try { this.onStatus(message, { kind, ...details }); } catch { /* Status observers must not break persistence. */ }
  }

  _releaseCacheLock() {
    if (this.cache.cleaning?.ended && !this.cache.requests) this.cache.cleaning = null;
    notifyActivity(this.cache);
  }

  _tempFile(direction) {
    const filePath = `${this.cache.root}/cloud-archive-${direction}-${Date.now()}-${++this.cache.sequence}.json`;
    const lease = { filePath, pending: 0, ended: false, cleanupStarted: false };
    this.cache.files.set(filePath, lease);
    return lease;
  }

  async _endTemp(lease) {
    lease.ended = true;
    if (!lease.pending) await this._cleanTemp(lease);
  }

  async _cleanTemp(lease) {
    if (lease.cleanupStarted || lease.pending || !lease.ended) return;
    lease.cleanupStarted = true;
    try {
      if (typeof this.fs?.unlink === 'function') await this._request(this.fs, 'unlink', { filePath: lease.filePath }, lease, false);
    } catch (error) {
      if (!missingFile(error)) this._status('cache-warning', '同步临时文件未能清理。');
    } finally {
      // A timed out unlink may still be running. Its eventual callback releases
      // this lease; until then both explicit cleanup and new cleanup stay locked.
      if (!lease.pending) this.cache.files.delete(lease.filePath);
      notifyActivity(this.cache);
    }
  }

  _request(target, method, options = {}, lease = null, blockTransport = true) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let completed = false;
      let timedOut = false;
      this.cache.requests += 1;
      if (lease) lease.pending += 1;
      notifyActivity(this.cache);
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        timedOut = true;
        this.cache.timedOutRequests += 1;
        if (blockTransport) this.transportBlocked = true;
        notifyActivity(this.cache);
        reject(new RequestTimeoutError(method));
      }, this.timeoutMs);
      const finish = (callback) => (value) => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        this.cache.requests -= 1;
        if (timedOut) this.cache.timedOutRequests -= 1;
        if (lease) {
          lease.pending -= 1;
          if (lease.ended && !lease.pending) {
            if (lease.cleanupStarted) this.cache.files.delete(lease.filePath);
            else void this._cleanTemp(lease);
          }
        }
        this._releaseCacheLock();
        if (!settled) { settled = true; callback(value); }
      };
      try {
        target[method]({ ...options, success: finish(resolve), fail: finish(error => reject(normalizeError(error))) });
      } catch (error) {
        finish(error => reject(normalizeError(error)))(error);
      }
    });
  }

  _assertReady() {
    if (!this.available || !this.cloud || !this.fs) throw new Error('TapTap cloud archive APIs are unavailable.');
    if (this.transportBlocked) {
      throw new Error('Cloud transport is blocked after a timed out SDK call; reload before using it again.');
    }
  }

  async _findArchive() {
    this._assertReady();
    const result = await this._request(this.cloud, 'getArchiveList');
    if (!result || !Array.isArray(result.saves)) {
      throw new Error('TapTap getArchiveList returned a malformed response.');
    }
    const matches = result.saves
      .filter((save) => save?.name === this.archiveName);
    if (matches.length > 1) throw new Error(`Multiple cloud archives named ${this.archiveName}; refusing an ambiguous operation.`);
    if (!matches.length) return null;
    const source = matches[0];
    const uuid = source.uuid;
    const fileId = source.fileId;
    if (typeof uuid !== 'string' || !uuid || typeof fileId !== 'string' || !fileId) {
      throw new Error(`Cloud archive ${this.archiveName} has invalid identifiers.`);
    }
    return { name: source.name, uuid, fileId };
  }

  async _readDirect() {
    const archive = await this._findArchive();
    if (!archive) return null;
    const lease = this._tempFile('download');
    try {
      const downloaded = await this._request(this.cloud, 'getArchiveData', {
        archiveUUID: archive.uuid,
        archiveFileId: archive.fileId,
        targetFilePath: lease.filePath
      }, lease);
      const filePath = downloaded?.filePath ?? lease.filePath;
      const file = await this._request(this.fs, 'readFile', { filePath, encoding: 'utf8' }, lease);
      const parsed = JSON.parse(file?.data);
      const result = { data: cloneJson(parsed), token: archiveToken(archive) };
      this._status('read', 'TapTap cloud archive read.', { token: result.token });
      return result;
    } finally { await this._endTemp(lease); }
  }

  async _writeDirect(snapshot, serialized, expectedToken, beforeMutation) {
    if (!this.available || !this.cloud || !this.fs) {
      return { ok: false, token: null, error: 'TapTap cloud archive APIs are unavailable.' };
    }
    if (this.transportBlocked) {
      return { ok: false, token: null, error: 'Cloud transport is blocked after a timed out SDK call; reload before using it again.' };
    }
    if (this.writeBlocked) {
      return { ok: false, token: null, error: 'Cloud writes are blocked after an uncertain mutation; reload before writing again.' };
    }

    let remote;
    try {
      remote = await this._readDirect();
    } catch (error) {
      return failure(error, 'Unable to verify remote archive: ');
    }
    const currentToken = remote?.token ?? null;
    if (currentToken !== expectedToken) {
      this._status('conflict', 'TapTap cloud archive changed before write.', { token: currentToken });
      return { ok: false, token: currentToken, error: 'Cloud archive changed.', conflict: true, remote };
    }

    const elapsed = Date.now() - this.lastMutationAt;
    if (this.lastMutationAt && elapsed < this.intervalMs) {
      return {
        ok: false,
        token: currentToken,
        error: 'Cloud archive write is rate limited.',
        retryAfter: this.intervalMs - elapsed
      };
    }

    const lease = this._tempFile('upload');
    const uploadPath = lease.filePath;
    try {
      try {
        await this._request(this.fs, 'writeFile', { filePath: uploadPath, data: serialized, encoding: 'utf8' }, lease);
      } catch (error) {
        return failure(error, 'Unable to stage cloud archive: ', { token: currentToken });
      }

      let archive;
      try {
        archive = await this._findArchive();
      } catch (error) {
        return failure(error, 'Unable to verify remote archive after staging: ', { token: currentToken });
      }
      const checkedToken = archive ? archiveToken(archive) : null;
      if (checkedToken !== expectedToken) {
        let latest = null;
        try { latest = await this._readDirect(); } catch { /* The fingerprint alone still proves a conflict. */ }
        return { ok: false, token: checkedToken, error: 'Cloud archive changed.', conflict: true, remote: latest };
      }

      const options = {
        archiveMetaData: {
          name: this.archiveName,
          summary: 'Player progress',
          playtime: Math.max(0, Math.floor(Number(snapshot?.playtimeSeconds) || 0))
        },
        archiveFilePath: uploadPath
      };
      const method = archive ? 'updateArchive' : 'createArchive';
      if (archive) options.archiveUUID = archive.uuid;
      try { if (beforeMutation && beforeMutation() === false) throw new Error('Local save changed incompatibly before cloud write.'); }
      catch (error) { return { ok: false, token: currentToken, error: errorMessage(error) }; }
      this.lastMutationAt = Date.now();

      try {
        await this._request(this.cloud, method, options, lease);
      } catch (error) {
        if (error instanceof RequestTimeoutError) {
          this.writeBlocked = true;
          this._status('uncertain', 'Cloud mutation timed out; cloud access is blocked until reload.');
          return {
            ok: false,
            token: currentToken,
            error: `${method} timed out; the server outcome is unknown. Reload before another write.`,
            remote,
            uncertain: true,
            code: 'CLOUD_TIMEOUT'
          };
        }
        return failure(error, `${method} failed: `, { token: currentToken });
      }

      try {
        const verified = await this._readDirect();
        if (!verified) throw new Error('Archive was not visible after mutation.');
        if (canonicalJson(verified.data) !== canonicalJson(snapshot)) {
          this.writeBlocked = true;
          return {
            ok: false,
            token: verified.token,
            error: 'Cloud archive content changed during write; reload before another write.',
            conflict: true,
            uncertain: true,
            remote: verified
          };
        }
        this._status('written', 'TapTap cloud archive written.', { token: verified.token });
        return { ok: true, token: verified.token };
      } catch (error) {
        this.writeBlocked = true;
        return {
          ok: false,
          token: null,
          error: `Cloud mutation completed but readback failed: ${errorMessage(error)} Reload before another write.`,
          uncertain: true,
          code: error?.code ?? 'CLOUD_ERROR'
        };
      }
    } finally { await this._endTemp(lease); }
  }
}
