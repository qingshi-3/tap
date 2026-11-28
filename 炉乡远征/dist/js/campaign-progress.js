import { SAVE_KEYS, ensureSaveNamespace, guardedWrite } from './storage-contract.js';
const STORAGE_KEY = SAVE_KEYS.campaign;
const GAME_ID = 'duelyst-h5';
const SCHEMA_VERSION = 1;

function levelIdsFrom(levels) {
  if (!Array.isArray(levels)) return [];
  const ids = levels.map((level) => typeof level === 'string' ? level : level?.id);
  if (ids.some((id) => typeof id !== 'string' || id.length === 0) || new Set(ids).size !== ids.length) {
    throw new TypeError('Campaign levels must have unique, non-empty string ids.');
  }
  return ids;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export class CampaignProgress {
  #raw = null;
  #storage;
  #levelIds;
  #known;
  #completed = new Set();
  #attempted = new Set();
  #lastLevelId = null;
  #error = null;

  constructor(levels, storage) {
    this.#levelIds = levelIdsFrom(levels);
    this.#known = new Set(this.#levelIds);
    if (arguments.length >= 2) {
      this.#storage = storage;
    } else {
      try {
        this.#storage = globalThis.localStorage;
      } catch (cause) {
        this.#error = `读取进度失败：${errorMessage(cause)}`;
        return;
      }
    }
    try { ensureSaveNamespace(this.#storage); } catch (cause) { this.#error = `存档迁入失败：${errorMessage(cause)}`; return; }
    this.#load();
  }

  get completed() { return new Set(this.#completed); }
  get attempted() { return new Set(this.#attempted); }
  get error() { return this.#error; }
  get lastLevelId() { return this.#lastLevelId; }

  import(snapshot) {
    return this.observe(snapshot);
  }

  observe(snapshot) {
    if (this.#error || !this.#isChallengeSnapshot(snapshot)) {
      return { firstClear: false, chapterCompleted: false };
    }

    const completed = new Set(this.#completed);
    const attempted = new Set(this.#attempted);
    const levelId = this.#known.has(snapshot.levelId) ? snapshot.levelId : null;
    const firstClear = Boolean(levelId && snapshot.phase === 'over' && snapshot.winner === 0 && !this.#completed.has(levelId));
    if (Array.isArray(snapshot.completedLevels)) {
      for (const id of snapshot.completedLevels) {
        if (this.#known.has(id)) completed.add(id);
      }
    }

    if (levelId) attempted.add(levelId);
    if (levelId && snapshot.phase === 'over' && snapshot.winner === 0) completed.add(levelId);

    const lastLevelId = levelId ?? this.#lastLevelId;
    const changed = !setsEqual(completed, this.#completed)
      || !setsEqual(attempted, this.#attempted)
      || lastLevelId !== this.#lastLevelId;
    const chapterCompleted = firstClear && completed.size === this.#levelIds.length;
    if (!changed) return { firstClear: false, chapterCompleted: false };

    const record = {
      game: GAME_ID,
      schemaVersion: SCHEMA_VERSION,
      completedLevelIds: this.#ordered(completed),
      attemptedLevelIds: this.#ordered(attempted),
      lastLevelId,
      updatedAt: Date.now()
    };

    try {
      if (!this.#storage || typeof this.#storage.setItem !== 'function') throw new Error('storage is unavailable');
      this.#raw = guardedWrite(this.#storage, STORAGE_KEY, this.#raw, JSON.stringify(record));
    } catch (cause) {
      this.#error = `写入进度失败，未保存：${errorMessage(cause)}`;
      return { firstClear: false, chapterCompleted: false };
    }

    this.#completed = completed;
    this.#attempted = attempted;
    this.#lastLevelId = lastLevelId;
    return { firstClear, chapterCompleted };
  }

  #load() {
    let raw;
    try {
      if (!this.#storage || typeof this.#storage.getItem !== 'function') throw new Error('storage is unavailable');
      raw = this.#storage.getItem(STORAGE_KEY);
    } catch (cause) {
      this.#error = `读取进度失败：${errorMessage(cause)}`;
      return;
    }
    this.#raw = raw;
    if (raw == null) return;

    let record;
    try {
      record = JSON.parse(raw);
    } catch {
      this.#error = '进度格式不支持，原件已保留。';
      return;
    }
    if (!this.#validRecord(record)) {
      this.#error = '进度格式不支持，原件已保留。';
      return;
    }
    this.#completed = new Set(record.completedLevelIds);
    this.#attempted = new Set(record.attemptedLevelIds);
    this.#lastLevelId = record.lastLevelId;
  }

  #validRecord(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
    const keys = Object.keys(record).sort();
    const expected = ['attemptedLevelIds', 'completedLevelIds', 'game', 'lastLevelId', 'schemaVersion', 'updatedAt'].sort();
    if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return false;
    if (record.game !== GAME_ID || record.schemaVersion !== SCHEMA_VERSION) return false;
    if (!isStringArray(record.completedLevelIds) || !isStringArray(record.attemptedLevelIds)) return false;
    if (new Set(record.completedLevelIds).size !== record.completedLevelIds.length) return false;
    if (new Set(record.attemptedLevelIds).size !== record.attemptedLevelIds.length) return false;
    if (record.completedLevelIds.some((id) => !this.#known.has(id))) return false;
    if (record.attemptedLevelIds.some((id) => !this.#known.has(id))) return false;
    if (record.lastLevelId !== null && !this.#known.has(record.lastLevelId)) return false;
    return typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt) && record.updatedAt >= 0;
  }

  #ordered(ids) {
    return this.#levelIds.filter((id) => ids.has(id));
  }

  #isChallengeSnapshot(snapshot) {
    return snapshot != null
      && typeof snapshot === 'object'
      && snapshot.mode === 'challenge'
      && this.#known.has(snapshot.levelId)
      && typeof snapshot.runId === 'string'
      && snapshot.runId.length > 0
      && ['playing', 'over'].includes(snapshot.phase)
      && [null, 0, 1].includes(snapshot.winner)
      && Array.isArray(snapshot.completedLevels);
  }
}

function setsEqual(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function errorMessage(cause) {
  return cause instanceof Error ? cause.message : String(cause);
}
