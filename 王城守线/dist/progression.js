export const PROGRESS_KEY = 'castle-ward-h5.progress.v2';
export const LEGACY_PROGRESS_KEY = 'castle-ward-h5.progress.v1';

export function createProgress(stageIds) {
  return { schema: 2, unlocked: { [stageIds[0]]: true }, wins: {}, stars: {} };
}

function assertIdMap(value, validIds, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(`invalid ${label}`);
  for (const [id, state] of Object.entries(value)) if (!validIds.has(id) || state !== true) throw new Error(`invalid ${label}`);
}

export function parseProgressV2(raw, stageIds) {
  const data = JSON.parse(raw);
  const validIds = new Set(stageIds);
  if (data?.schema !== 2) throw new Error('unknown progress schema');
  assertIdMap(data.unlocked, validIds, 'unlocked stages');
  assertIdMap(data.wins, validIds, 'wins');
  if (!data.stars || Array.isArray(data.stars) || typeof data.stars !== 'object') throw new Error('invalid stars');
  if (data.unlocked[stageIds[0]] !== true) throw new Error('first stage is missing');
  for (const [id, stars] of Object.entries(data.stars)) {
    if (!validIds.has(id) || !Number.isInteger(stars) || stars < 1 || stars > 3 || data.wins[id] !== true) throw new Error('invalid stars');
  }
  for (const id of Object.keys(data.wins)) if (data.unlocked[id] !== true) throw new Error('win is not unlocked');
  return { schema: 2, unlocked: { ...data.unlocked }, wins: { ...data.wins }, stars: { ...data.stars } };
}

export function migrateProgressV1(raw, stageIds) {
  const data = JSON.parse(raw);
  const validIds = new Set(stageIds);
  if (data?.version !== 1 || !Array.isArray(data.unlocked) || !Array.isArray(data.wins)) throw new Error('unknown legacy format');
  if (!data.unlocked.every(id => validIds.has(id)) || !data.wins.every(id => validIds.has(id))) throw new Error('unknown legacy stage');
  if (!data.unlocked.includes(stageIds[0])) throw new Error('legacy first stage is missing');
  if (!data.wins.every(id => data.unlocked.includes(id))) throw new Error('legacy win is not unlocked');
  return {
    schema: 2,
    unlocked: Object.fromEntries([...new Set(data.unlocked)].map(id => [id, true])),
    wins: Object.fromEntries([...new Set(data.wins)].map(id => [id, true])), stars: {}
  };
}

export function loadProgress(storage, stageIds) {
  const fallback = createProgress(stageIds);
  try {
    const current = storage.getItem(PROGRESS_KEY);
    if (current !== null) return { value: parseProgressV2(current, stageIds), issue: null, needsSave: false };
    const legacy = storage.getItem(LEGACY_PROGRESS_KEY);
    if (legacy === null) return { value: fallback, issue: null, needsSave: false };
    return { value: migrateProgressV1(legacy, stageIds), issue: null, needsSave: true };
  } catch (error) {
    const dataIssue = error instanceof SyntaxError || /unknown|invalid|missing|unlocked/.test(error?.message ?? '');
    return { value: fallback, issue: dataIssue
      ? '现有进度无法识别，原数据已保留。你可以继续体验，但本次进度不会写入浏览器。'
      : '浏览器不允许读取本地进度。你可以继续体验，但本次进度不会写入浏览器。', needsSave: false, canSave: false };
  }
}

export function victoryStars(lives) {
  return lives >= 18 ? 3 : lives >= 6 ? 2 : 1;
}

export function recordVictory(current, stageIds, stageId, lives) {
  const stageIndex = stageIds.indexOf(stageId);
  if (stageIndex < 0) throw new Error('unknown victory stage');
  const earned = victoryStars(lives);
  const next = stageIds[stageIndex + 1] ?? null;
  const best = Math.max(current.stars[stageId] ?? 0, earned);
  return { progress: { schema: 2,
    unlocked: { ...current.unlocked, [stageId]: true, ...(next ? { [next]: true } : {}) },
    wins: { ...current.wins, [stageId]: true }, stars: { ...current.stars, [stageId]: best }
  }, earned, best, next };
}
