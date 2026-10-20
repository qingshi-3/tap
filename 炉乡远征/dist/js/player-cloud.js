import { SAVE_KEYS, CLOUD_META_KEY, ensureStorage, guardedWrite } from './storage-contract.js';
import { CloudArchive } from './cloud-archive.js';
import { normalizeProfile } from './profile.js';

const GAME = 'duelyst-h5';
const APP_ID = 970030;
const SCHEMA_VERSION = 2;
const MIN_SYNC_INTERVAL = 60_000;
const KEYS = SAVE_KEYS;
const META_KEY = CLOUD_META_KEY;
const LOCAL_BACKUP_KEY = `${META_KEY}.local-backup`;
const REMOTE_BACKUP_KEY = `${META_KEY}.remote-backup`;
const UNKNOWN_META_BACKUP_KEY = `${META_KEY}.unknown-backup`;
const JOURNAL_KEY = `${META_KEY}.restore-journal`;
const clone = (value) => JSON.parse(JSON.stringify(value));

export class PlayerCloud {
  constructor({ storage, transport = new CloudArchive(), legacyTransport, onChange = () => {}, onRestore = () => {} } = {}) {
    if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
    this.legacyTransport = legacyTransport ?? null;
    this.legacyRemote = false;
    this.storage = storage; this.transport = transport; this.onChange = onChange; this.onRestore = onRestore;
    this.paused = false; this.disposed = false; this.timer = null; this.busy = false; this.queued = false; this.lastSyncAt = 0;
    this.remote = null; this.remoteLocalFingerprint = null; this.meta = null; this.unknownMetaRaw = null; this.blocked = false;
    this.view = { status: 'idle', label: '云存档尚未连接', error: '', available: Boolean(transport?.available), localSummary: null,
      cloudSummary: null, hasRemote: false, conflict: false, blocked: false };
    try { ensureStorage(storage); } catch { this.blocked = true; }
    if (this.blocked) Object.assign(this.view, { status: 'error', label: '本地恢复日志无法回滚，云同步已停用。', error: '本地恢复日志无法回滚，云同步已停用。', blocked: true });
    this.meta = this.#readMeta();
    try { this.metaRaw = this.storage.getItem(META_KEY); } catch { this.blocked = true; }
    if (this.unknownMetaRaw !== null) { this.blocked = true; this.view.blocked = true; }
    if (!this.blocked) this.#recoverJournal();
    if (this.blocked) Object.assign(this.view, { status: 'error', label: '存档版本不支持或恢复未完成，已停用云同步以保护原件。', error: '存档版本不支持或恢复未完成。', blocked: true });
    this.#updateLocalSummary();
  }

  get state() { return clone(this.view); }
  get paused() { return Boolean(this._paused); }
  set paused(value) {
    const next = Boolean(value);
    if (next && this.timer) { clearTimeout(this.timer); this.timer = null; this.queued = true; }
    this._paused = next;
    if (!next && this.queued && !this.disposed) this.#schedule();
  }

  async initialize() {
    if (this.blocked) return this.#fail('存档版本不支持或恢复未完成，已停用云同步以保护原件。');
    if (!this.view.available) return this.#set({ status: 'unavailable', label: '当前环境没有 TapTap 云存档能力' }, false);
    const initialLocal = this.#capture();
    if (!initialLocal.ok) return this.#fail(initialLocal.error);
    const read = await this.#readRemote();
    if (this.disposed) return { ok: false, disposed: true, error: '云同步已停用。' };
    if (!read.ok) return read;
    if (!read.remote) return this.#set({ status: 'unlinked', label: '云端尚无存档，首次同步需手动确认', conflict: false }, true);
    const local = this.#capture();
    if (!local.ok) return this.#fail(local.error);
    if (fingerprint(local.data) === fingerprint(read.remote.envelope.data)) {
      if (this.legacyRemote && !(await this.#promoteLegacy()).ok) return this.#fail('建立安全代际云槽失败；旧云原件已保留。');
      if (!this.#writeMeta(this.remote.token, local.data)) return this.#fail('无法保存云同步基线。');
      return this.#set({ status: 'synced', label: '本地与云端进度一致', conflict: false }, true);
    }
    if (initialLocal.pristine && local.pristine && initialLocal.fingerprint === local.fingerprint) return this.restore();
    if (this.#baselineMatchesRemote(read.remote)) {
      if (fingerprint(local.data) !== this.meta.fingerprint) this.#schedule();
      return this.#set({ status: 'pending', label: '本地有新进度，等待同步', conflict: false }, true);
    }
    const unchanged = this.meta && fingerprint(local.data) === this.meta.fingerprint;
    return this.#set({ status: 'conflict', label: unchanged ? '云端有较新的进度可恢复' : '本地与云端进度存在冲突', conflict: true }, true);
  }

  notifyLocalChange() {
    if (this.disposed || this.blocked) return false;
    const local = this.#capture();
    if (!local.ok) { this.#fail(local.error); return false; }
    this.#updateLocalSummary(local);
    if (!this.view.available) return false;
    if (this.paused) { if (this.remote && this.#baselineMatchesRemote(this.remote)) this.queued = true; return false; }
    if (this.remote && this.#baselineMatchesRemote(this.remote)) {
      this.#set({ status: 'pending', label: '本地进度已保存，等待云同步', conflict: false }, true);
      this.#schedule(); return true;
    }
    this.#set({ status: this.remote ? 'conflict' : 'unlinked', label: this.remote ? '本地与云端进度存在冲突' : '首次云同步需手动确认', conflict: Boolean(this.remote) }, true);
    return false;
  }

  async sync({ useLocal = false } = {}) { return this.#sync(Boolean(useLocal), false); }

  async refresh() {
    if (this.blocked) return this.#fail('存档版本不支持或恢复未完成，已停用云同步。');
    if (!this.view.available) return { ok: false, unavailable: true, error: 'TapTap cloud is unavailable.' };
    const read = await this.#readRemote();
    if (this.disposed) return { ok: false, disposed: true, error: '云同步已停用。' };
    if (!read.ok) return read;
    const local = this.#capture();
    if (!local.ok) return this.#fail(local.error);
    if (!read.remote) return this.#set({ status: 'unlinked', label: '云端尚无存档', conflict: false }, true);
    const same = fingerprint(local.data) === fingerprint(read.remote.envelope.data);
    if (same) {
      if (this.legacyRemote && !(await this.#promoteLegacy()).ok) return this.#fail('建立安全代际云槽失败；旧云原件已保留。');
      if (!this.#writeMeta(this.remote.token, local.data)) return this.#fail('无法保存云同步基线。');
      return this.#set({ status: 'synced', label: '本地与云端进度一致', conflict: false }, true);
    }
    if (this.#baselineMatchesRemote(read.remote)) {
      this.#set({ status: 'pending', label: '本地有新进度，等待同步', conflict: false }, true);
      if (!this.paused) this.#schedule(); else this.queued = true;
      return { ok: true };
    }
    return this.#set({ status: 'conflict', label: '本地与云端进度存在冲突', conflict: true }, true);
  }

  async restore() {
    if (this.blocked || !this.remote) return { ok: false, error: '没有可恢复的云端进度。' };
    const chosenRemote = clone(this.remote);
    const chosenLocalFingerprint = this.remoteLocalFingerprint;
    const before = this.#capture();
    if (!before.ok) return this.#fail(before.error);
    if (fingerprint(before.data) !== chosenLocalFingerprint) {
      await this.refresh();
      return { ok: false, stale: true, error: '本地进度在确认期间发生变化，请重新选择。' };
    }
    let latest;
    try { latest = await (this.legacyRemote ? this.legacyTransport : this.transport).read(); }
    catch (error) { this.#invalidateRemote(); return this.#fail(`读取云存档失败：${message(error)}`); }
    if (this.disposed) return { ok: false, disposed: true, error: '云同步已停用。' };
    const checked = validateRemote(latest);
    if (!checked.ok || !latest || latest.token !== chosenRemote.token || fingerprint(checked.envelope) !== fingerprint(chosenRemote.envelope)) {
      this.#invalidateRemote();
      await this.refresh();
      return { ok: false, stale: true, error: '云端进度在确认期间发生变化，请重新选择。' };
    }
    const current = this.#capture();
    if (!current.ok) return this.#fail(current.error);
    if (current.fingerprint !== before.fingerprint || current.fingerprint !== chosenLocalFingerprint) {
      this.#invalidateRemote();
      await this.refresh();
      return { ok: false, stale: true, error: '本地进度在确认期间发生变化，请重新选择。' };
    }
    if (this.disposed) return { ok: false, disposed: true, error: '云同步已停用。' };
    let originals;
    try { originals = this.#rawEntries(); }
    catch (error) { return this.#fail(`备份本地进度失败：${message(error)}`); }
    const intended = Object.entries(KEYS).map(([name,key]) => ({name,key,raw:checked.envelope.data[name] === null ? null : JSON.stringify(checked.envelope.data[name])}));
    const journal = { schemaVersion: 2, originals, intended };
    try {
      this.storage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(journal));
      this.storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
      this.#writeData(checked.envelope.data, originals);
      this.storage.removeItem(JOURNAL_KEY);
    } catch (error) {
      const rolledBack = this.#rollback(originals, intended);
      if (rolledBack) { try { this.storage.removeItem(JOURNAL_KEY); } catch { this.blocked = true; } }
      else this.blocked = true;
      if (this.blocked) this.view.blocked = true;
      return this.#fail(`恢复云端进度失败：${message(error)}${this.blocked ? '；回滚未完成' : ''}`);
    }
    if (this.legacyRemote) {
      let promoted;
      try { promoted = await this.transport.write(checked.envelope, null, { beforeMutation: () => this.#capture().ok && !this.blocked && !this.disposed }); } catch (error) { return this.#fail(`旧云档已恢复本机，新云槽建立失败：${message(error)}`); }
      if (!promoted?.ok) return this.#fail('旧云档已恢复本机，新云槽建立失败；旧云槽原件已保留，请刷新。');
      latest.token = promoted.token; this.legacyRemote = false; this.#displayRemote(promoted.token, checked.envelope);
    }
    const metaSaved = this.#writeMeta(latest.token, checked.envelope.data);
    this.remoteLocalFingerprint = fingerprint(checked.envelope.data); this.#updateLocalSummary();
    if (metaSaved) this.#set({ status: 'synced', label: '云端进度已恢复', conflict: false }, true);
    else this.#set({ status: 'error', label: '云端进度已恢复；同步基线保存失败', error: '同步基线保存失败。', conflict: false }, true);
    try { this.onRestore(); } catch {}
    return { ok: true, restored: true, ...(metaSaved ? {} : { warning: '同步基线保存失败。' }) };
  }

  dispose() {
    this.disposed = true; this.queued = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null; this.onChange = () => {}; this.onRestore = () => {};
  }

  async #sync(useLocal, automatic) {
    if (this.disposed || this.blocked) return { ok: false, error: '云同步已停用。' };
    if (!this.view.available) return { ok: false, unavailable: true, error: 'TapTap cloud is unavailable.' };
    if (automatic && this.paused) { this.queued = true; return { ok: false, paused: true }; }
    if (this.busy) { this.queued = true; return { ok: false, pending: true }; }
    const local = this.#capture();
    if (!local.ok) return this.#fail(local.error);
    let expectedToken;
    if (useLocal) {
      if (!this.remote) return { ok: false, error: '尚未读取云端版本，不能覆盖。' };
      expectedToken = this.legacyRemote ? null : this.remote.token;
      try { this.storage.setItem(REMOTE_BACKUP_KEY, JSON.stringify(this.remote)); }
      catch (error) { return this.#fail(`备份云端进度失败：${message(error)}`); }
    } else if (this.meta && this.remote && this.#baselineMatchesRemote(this.remote)) expectedToken = this.meta.token;
    else if (!this.remote && !automatic) expectedToken = null;
    else return { ok: false, conflict: Boolean(this.remote), error: '云端基线未知，请先刷新并选择使用哪个版本。' };

    const data = clone(local.data);
    const envelope = { game: GAME, appId: APP_ID, schemaVersion: SCHEMA_VERSION,
      saveId: this.remote?.envelope.saveId ?? makeUuid(), savedAt: Date.now(), data };
    this.busy = true; this.#set({ status: 'syncing', label: '正在同步云端进度', error: '' }, true);
    let result;
    try { result = await this.transport.write(envelope, expectedToken, { beforeMutation: () => this.#capture().ok && !this.blocked && !this.disposed }); }
    catch (error) { result = { ok: false, error: message(error) }; }
    this.busy = false; this.lastSyncAt = Date.now();
    if (this.disposed) return { ok: false, disposed: true, error: '云同步已停用。' };
    if (!result?.ok) {
      if (result?.conflict) {
        const checked = validateRemote(result.remote);
        if (checked.ok) this.#displayRemote(result.remote.token, checked.envelope);
        else this.#invalidateRemote();
        this.#set({ status: 'conflict', label: '云端已被其他设备更新', error: result.error ?? '', conflict: true }, true);
      } else if (Number.isFinite(result?.retryAfter) && result.retryAfter >= 0) {
        if (automatic) {
          this.#set({ status: 'pending', label: '云同步频率受限，已安排重试', error: '', conflict: false }, true);
          this.#schedule(result.retryAfter);
        } else this.#set({ status: 'pending', label: '云同步频率受限，请稍后重试', error: '', conflict: false }, true);
      } else this.#fail(`云同步失败：${result?.error ?? '未知错误'}`);
      return { ok: false, ...result };
    }
    this.legacyRemote = false; this.#displayRemote(result.token, envelope);
    if (!this.#writeMeta(result.token, data)) return this.#fail('云端已写入，但本地同步基线保存失败。');
    this.#set({ status: 'synced', label: '云端进度已同步', error: '', conflict: false }, true);
    const current = this.#capture();
    if (current.ok && fingerprint(current.data) !== fingerprint(data)) { this.queued = true; this.#schedule(); }
    else this.queued = false;
    return { ok: true, token: result.token };
  }

  #schedule(delay) {
    if (this.disposed || this.timer || this.paused) { this.queued = true; return; }
    const wait = Math.max(0, delay ?? (this.lastSyncAt ? MIN_SYNC_INTERVAL - (Date.now() - this.lastSyncAt) : 0));
    this.queued = true;
    this.timer = setTimeout(() => { this.timer = null; this.queued = false; void this.#sync(false, true); }, wait);
    this.timer.unref?.();
  }

  async #readRemote() {
    let result;
    try { result = await this.transport.read(); }
    catch (error) { this.#invalidateRemote(); return this.#fail(`读取云存档失败：${message(error)}`); }
    if (this.disposed) return { ok: false, disposed: true, error: '云同步已停用。' };
    this.legacyRemote = false;
    if (result === null && this.legacyTransport) {
      try { result = await this.legacyTransport.read(); } catch (error) { this.#invalidateRemote(); return this.#fail(`读取旧云存档失败：${message(error)}`); }
      if (result !== null) this.legacyRemote = true;
    }
    if (result === null) { this.remote = null; this.remoteLocalFingerprint = this.#capture().fingerprint; this.view.hasRemote = false; this.view.cloudSummary = null; return { ok: true, remote: null }; }
    const checked = validateRemote(result);
    if (!checked.ok) { this.#invalidateRemote(); return this.#fail(checked.error); }
    this.#displayRemote(result.token, checked.envelope);
    return { ok: true, remote: this.remote };
  }

  async #promoteLegacy() {
    let result;
    try { result = await this.transport.write(this.remote.envelope, null, { beforeMutation: () => this.#capture().ok && !this.blocked && !this.disposed }); }
    catch (error) { return { ok: false, error: message(error) }; }
    if (!result?.ok) return { ok: false };
    this.legacyRemote = false; this.#displayRemote(result.token, this.remote.envelope);
    return { ok: true };
  }

  #displayRemote(token, envelope) {
    this.remote = { token, envelope: clone(envelope) };
    const local = this.#capture(); this.remoteLocalFingerprint = local.ok ? fingerprint(local.data) : null;
    this.view.hasRemote = true; this.view.cloudSummary = summary(envelope.data, envelope.savedAt);
  }

  #invalidateRemote() {
    this.remote = null; this.remoteLocalFingerprint = null;
    this.view.hasRemote = false; this.view.cloudSummary = null; this.view.conflict = false;
  }

  #baselineMatchesRemote(remote) {
    return !this.legacyRemote && validMeta(this.meta) && this.meta.token === remote.token
      && this.meta.fingerprint === fingerprint(remote.envelope.data);
  }

  #capture() {
    const raws = {};
    try { ensureStorage(this.storage); if (this.metaRaw !== undefined && this.storage.getItem(META_KEY) !== this.metaRaw) throw new Error('云同步元数据已被其他页面更新，请刷新。'); } catch (error) { return { ok: false, error: message(error) }; }
    try { for (const [name, key] of Object.entries(KEYS)) raws[name] = this.storage.getItem(key); }
    catch (error) { return { ok: false, error: `读取本地进度失败：${message(error)}` }; }
    const parsed = {};
    for (const name of Object.keys(KEYS)) {
      if (raws[name] === null) { parsed[name] = null; continue; }
      try { parsed[name] = JSON.parse(raws[name]); } catch { return { ok: false, error: `本地${name}存档格式不支持，原件已保留。` }; }
    }
    const profile = parsed.profile === null ? null : normalizeProfile(parsed.profile);
    if (parsed.profile !== null && !profile) return { ok: false, error: '本地存档格式不支持，原件已保留。' };
    const data = { profile };
    return { ok: true, data, raws, pristine: Object.values(raws).every((raw) => raw === null), fingerprint: fingerprint(data) };
  }

  #rawEntries() { return Object.entries(KEYS).map(([name, key]) => ({ name, key, raw: this.storage.getItem(key) })); }
  #writeData(data, originals) {
    if (originals.some(entry => this.storage.getItem(entry.key) !== entry.raw)) throw new Error('本地进度在恢复期间变化，已停止替换。');
    for (const [name, key] of Object.entries(KEYS)) data[name] === null ? this.storage.removeItem(key) : this.storage.setItem(key, JSON.stringify(data[name])); }
  #rollback(entries, intended = entries) { try {
    if (entries.some((entry,i) => { const raw=this.storage.getItem(entry.key); return raw !== entry.raw && raw !== intended[i].raw; })) return false;
    for (const entry of entries) entry.raw === null ? this.storage.removeItem(entry.key) : this.storage.setItem(entry.key, entry.raw); return true; } catch { return false; } }

  #recoverJournal() {
    let raw;
    try { raw = this.storage.getItem(JOURNAL_KEY); } catch { this.blocked = true; return; }
    if (raw === null) return;
    try {
      const journal = JSON.parse(raw);
      if (!validJournal(journal) || !this.#rollback(journal.originals, journal.intended ?? journal.originals)) throw new Error('invalid restore journal');
      this.storage.removeItem(JOURNAL_KEY);
    } catch { this.blocked = true; }
  }

  #readMeta() {
    let raw; try { raw = this.storage.getItem(META_KEY); } catch { return null; }
    if (raw === null) return null;
    try {
      const value = JSON.parse(raw);
      if (!validMeta(value)) { this.unknownMetaRaw = raw; return null; }
      const baseData = normalizeCloudData(value.baseData);
      if (!baseData) { this.unknownMetaRaw = raw; return null; }
      return { ...value, baseData, fingerprint: fingerprint(baseData) };
    } catch { this.unknownMetaRaw = raw; return null; }
  }

  #writeMeta(token, data) {
    const meta = { schemaVersion: 1, token, fingerprint: fingerprint(data), baseData: clone(data), syncedAt: Date.now() };
    try {
      if (this.unknownMetaRaw !== null) this.storage.setItem(UNKNOWN_META_BACKUP_KEY, this.unknownMetaRaw);
      this.metaRaw = guardedWrite(this.storage, META_KEY, this.metaRaw ?? null, JSON.stringify(meta));
    }
    catch { return false; }
    this.meta = meta; this.unknownMetaRaw = null; return true;
  }

  #updateLocalSummary(local = this.#capture()) { this.view.localSummary = local.ok ? summary(local.data, localSavedAt(local.data)) : null; }
  #set(patch, result) {
    if (patch.status && patch.status !== 'error' && !Object.hasOwn(patch, 'error')) patch = { ...patch, error: '' };
    Object.assign(this.view, patch); this.#updateLocalSummary(); try { this.onChange(this.state); } catch {}
    return typeof result === 'boolean' ? { ok: result } : result;
  }
  #fail(error) { this.#set({ status: 'error', label: error, error }, null); return { ok: false, error }; }
}

function validateRemote(remote) {
  if (!remote || typeof remote.token !== 'string' || !remote.token) return { ok: false, error: '云存档缺少有效版本令牌。' };
  const value = remote.data;
  if (!plain(value) || !exact(value, ['appId', 'data', 'game', 'saveId', 'savedAt', 'schemaVersion']) || value.game !== GAME
    || value.appId !== APP_ID || value.schemaVersion !== SCHEMA_VERSION || !uuid(value.saveId) || !Number.isFinite(value.savedAt) || value.savedAt < 0
    || !plain(value.data) || !exact(value.data, ['profile'])) return { ok: false, error: '云存档格式不受支持，原件未修改。' };
  const data = normalizeCloudData(value.data);
  if (!data) return { ok: false, error: '云端进度内容格式不受支持。' };
  return { ok: true, envelope: { ...clone(value), data } };
}

function normalizeCloudData(value) {
  if (!plain(value) || !exact(value, ['profile'])) return null;
  const profile = value.profile === null ? null : normalizeProfile(value.profile);
  if (value.profile !== null && !profile) return null;
  return { profile };
}

function summary(data, savedAt) { return { coins: data.profile?.coins ?? 0, completed: data.profile?.completed?.length ?? 0,
  cards: (data.profile?.inventory?.units?.length ?? 0) + (data.profile?.inventory?.spells?.length ?? 0),
  savedAt: Number.isFinite(savedAt) ? savedAt : null,
  hasBattle: Boolean(data.profile?.activeBattle && data.profile.activeBattle.phase !== 'over') }; }
function localSavedAt() { return null; }
function validMeta(value) { return plain(value) && exact(value, ['baseData', 'fingerprint', 'schemaVersion', 'syncedAt', 'token']) && value.schemaVersion === 1
  && (value.token === null || typeof value.token === 'string') && typeof value.fingerprint === 'string' && plain(value.baseData)
  && Number.isFinite(value.syncedAt) && value.syncedAt >= 0
  && [fingerprint(value.baseData), legacyFingerprint(value.baseData)].includes(value.fingerprint); }
function validJournal(value) {
  const entries = rows => Array.isArray(rows) && rows.length === Object.keys(KEYS).length && rows.every((entry,i) => plain(entry) && exact(entry,['key','name','raw'])
    && entry.name === Object.keys(KEYS)[i] && entry.key === Object.values(KEYS)[i] && (entry.raw === null || typeof entry.raw === 'string'));
  return plain(value) && ((value.schemaVersion === 1 && exact(value,['originals','schemaVersion']))
    || (value.schemaVersion === 2 && exact(value,['originals','intended','schemaVersion']) && entries(value.intended))) && entries(value.originals);
}
function fingerprint(value) { return JSON.stringify(canonical(value)); }
function legacyFingerprint(value) { return JSON.stringify(value); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!plain(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exact(value, keys) { const actual = Object.keys(value).sort(), expected = [...keys].sort(); return actual.length === expected.length && actual.every((key, i) => key === expected[i]); }
function uuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function makeUuid() { return globalThis.crypto?.randomUUID?.() ?? `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12)}`; }
function message(error) { return error?.message ?? String(error ?? 'unknown error'); }
