/** 首遇提示与新手引导：看过的提示 ID 存独立键，不进远征存档 */
const KEY = 'zl_coach';

export function seenHints(): Set<string> {
  try { return new Set((localStorage.getItem(KEY) || '').split(',').filter(Boolean)); } catch { return new Set(); }
}

export function markHint(id: string) {
  const s = seenHints();
  s.add(id);
  try { localStorage.setItem(KEY, [...s].join(',')); } catch { /* 存储不可用时本次会话内再出现一次也无妨 */ }
}

export function resetHints() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
