import { loadCareer } from '../core/career';
import { BOARD_DEFS, getBoardScores } from '../core/leaderboards';

type Callback = { onSuccess: (result?: unknown) => void; onFailure: (code?: unknown, message?: unknown) => void };
interface LeaderboardManager {
  submitScores(options: { scores: { leaderboardId: string; score: number }[]; callback: Callback }): void;
  openLeaderboard(options: { leaderboardId: string; collection: 'public'; callback: Callback }): void;
}
interface LeaderboardSdk { getLeaderboardManager(): LeaderboardManager }

const sdk = (): LeaderboardManager | null => {
  try {
    const tap = (globalThis as typeof globalThis & { tap?: LeaderboardSdk }).tap;
    return tap?.getLeaderboardManager?.() ?? null;
  } catch { return null; }
};
const REQUEST_TIMEOUT = 15_000;
let syncing: Promise<string | null> | null = null;
let submissionUncertain = false;
let opening = false;

/** 提交绝对值；平台 best/latest 分别拥有累计峰值和可下降的胜率，禁止 sum 重试累加。 */
export function syncCareerLeaderboards(): Promise<string | null> {
  if (syncing) return syncing;
  if (submissionUncertain) return Promise.resolve('上次成绩同步仍在处理中，请稍后再试。');
  syncing = submitLatest().catch(() => '成绩同步失败，请稍后再试。').finally(() => { syncing = null; });
  return syncing;
}

async function submitLatest(): Promise<string | null> {
  // A successful callback may follow another local settlement. Serialize a fresh snapshot after it.
  for (let pass = 0; pass < 3; pass++) {
    const profile = loadCareer();
    if (profile.storageStatus !== 'ok') return '本地战绩未能保存，暂不上传成绩。';
    const scores = getBoardScores(profile).filter(board => board.configured && board.platformId)
      .map(board => ({ leaderboardId: board.platformId!, score: board.value }));
    if (!scores.length) return null;
    const manager = sdk();
    if (!manager) return '请在 TapTap 中打开游戏以同步和查看排行榜。';
    const snapshot = JSON.stringify(scores);
    const error = await new Promise<string | null>(resolve => {
      let returned = false;
      let completed = false;
      const timer = setTimeout(() => {
        returned = true;
        // The host may still commit a timed-out latest score. Do not send a newer score out of order.
        submissionUncertain = true;
        resolve('成绩同步超时，请稍后再试。');
      }, REQUEST_TIMEOUT);
      const finish = (error: string | null) => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        submissionUncertain = false;
        if (!returned) { returned = true; resolve(error); }
      };
      try {
        manager.submitScores({ scores, callback: {
          onSuccess: () => finish(null),
          onFailure: () => finish('成绩同步失败，请稍后再试。'),
        } });
      } catch { finish('当前环境无法同步排行榜成绩。'); }
    });
    if (error) return error;
    const latest = getBoardScores(loadCareer()).filter(board => board.configured && board.platformId)
      .map(board => ({ leaderboardId: board.platformId!, score: board.value }));
    if (JSON.stringify(latest) === snapshot) return null;
  }
  return '最新成绩尚未同步完成，请稍后重新打开榜单。';
}

export async function openCareerLeaderboard(key: string): Promise<string | null> {
  const board = BOARD_DEFS.find(item => item.key === key);
  if (!board?.platformId) return '这个榜单尚未在 TapTap 开通。';
  if (opening) return '正在打开排行榜，请稍候。';
  const manager = sdk();
  if (!manager) return '请在 TapTap 中打开游戏以查看排行榜。';
  opening = true;
  try {
    const error = await syncCareerLeaderboards();
    if (error) return error;
    return await new Promise<string | null>(resolve => {
      let settled = false;
      const finish = (error: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(error);
      };
      const timer = setTimeout(() => finish('排行榜打开超时，请稍后再试。'), REQUEST_TIMEOUT);
      try {
        manager.openLeaderboard({ leaderboardId: board.platformId!, collection: 'public', callback: {
          onSuccess: () => finish(null),
          onFailure: () => finish('排行榜暂时无法打开，请稍后再试。'),
        } });
      } catch { finish('当前环境无法打开排行榜。'); }
    });
  } finally { opening = false; }
}
