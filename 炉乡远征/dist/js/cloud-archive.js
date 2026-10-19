import { CLOUD_ARCHIVE_NAME } from './storage-contract.js';
const DEFAULT_ARCHIVE_NAME = CLOUD_ARCHIVE_NAME;
const MIN_WRITE_INTERVAL = 60_000;
const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;

class RequestTimeoutError extends Error {
  constructor(method) {
    super(`${method} timed out`);
    this.name = 'RequestTimeoutError';
    this.method = method;
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
    this.fileSequence = 0;

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
    return this._enqueue(() => this._writeDirect(snapshot, serialized, expectedToken, beforeMutation));
  }

  _enqueue(operation) {
    const result = this.queue.then(operation, operation);
    this.queue = result.catch(() => {});
    return result;
  }

  _status(kind, message, details = {}) {
    try { this.onStatus(message, { kind, ...details }); } catch { /* Status observers must not break persistence. */ }
  }

  _request(target, method, options = {}) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.transportBlocked = true;
        reject(new RequestTimeoutError(method));
      }, this.timeoutMs);
      const finish = (callback) => (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        callback(value);
      };
      try {
        target[method]({ ...options, success: finish(resolve), fail: finish(reject) });
      } catch (error) {
        finish(reject)(error);
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
    const targetFilePath = `${this.tap.env.USER_DATA_PATH}/cloud-archive-download-${Date.now()}-${++this.fileSequence}.json`;
    const downloaded = await this._request(this.cloud, 'getArchiveData', {
      archiveUUID: archive.uuid,
      archiveFileId: archive.fileId,
      targetFilePath
    });
    const filePath = downloaded?.filePath ?? targetFilePath;
    const file = await this._request(this.fs, 'readFile', { filePath, encoding: 'utf8' });
    const parsed = JSON.parse(file?.data);
    const result = { data: cloneJson(parsed), token: archiveToken(archive) };
    this._status('read', 'TapTap cloud archive read.', { token: result.token });
    return result;
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
      return { ok: false, token: null, error: `Unable to verify remote archive: ${errorMessage(error)}` };
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

    const uploadPath = `${this.tap.env.USER_DATA_PATH}/cloud-archive-upload-${Date.now()}-${++this.fileSequence}.json`;
    try {
      await this._request(this.fs, 'writeFile', { filePath: uploadPath, data: serialized, encoding: 'utf8' });
    } catch (error) {
      return { ok: false, token: currentToken, error: `Unable to stage cloud archive: ${errorMessage(error)}` };
    }

    let archive;
    try {
      archive = await this._findArchive();
    } catch (error) {
      return { ok: false, token: currentToken, error: `Unable to verify remote archive after staging: ${errorMessage(error)}` };
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
      await this._request(this.cloud, method, options);
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        this.writeBlocked = true;
        this._status('uncertain', 'Cloud mutation timed out; cloud access is blocked until reload.');
        return {
          ok: false,
          token: currentToken,
          error: `${method} timed out; the server outcome is unknown. Reload before another write.`,
          remote,
          uncertain: true
        };
      }
      return { ok: false, token: currentToken, error: `${method} failed: ${errorMessage(error)}` };
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
        uncertain: true
      };
    }
  }
}
