// TapTap 宿主能力封装：激励视频、排行榜、存档。普通浏览器里自动降级。
import { AD_UNIT_ID, LB_NETWORTH, LB_FASTEST } from './config.js';

const safe = (fn) => { try { fn(); } catch { /* 宿主实现差异，忽略 */ } };
const getTap = () => (typeof globalThis.tap === 'object' && globalThis.tap) || null;
// 浏览器预览（?mockad）用模拟视频，方便走查流程
const mockAd = typeof location !== 'undefined' && /[?&]mockad/.test(location.search);

// 激励视频全局只建一个实例并预加载；onClose 回报 isEnded 才算看完，show 失败时 load 后重试一次
let rv = null;
const rvAd = () => {
  if (rv) return rv;
  try { rv = getTap().createRewardedVideoAd({ adUnitId: AD_UNIT_ID }); } catch { rv = null; }
  if (rv && typeof rv.show === 'function') safe(() => Promise.resolve(rv.load?.()).catch(() => {}));
  else rv = null;
  return rv;
};
export const ads = {
  busy: false,
  get available() {
    if (mockAd) return true;
    const t = getTap();
    return !!(AD_UNIT_ID && t && typeof t.createRewardedVideoAd === 'function');
  },
  preload() { if (!mockAd && this.available) rvAd(); },
  show() {
    if (this.busy) return Promise.resolve({ ok: false, msg: '视频正在播放' });
    if (!this.available) return Promise.resolve({ ok: false, msg: '视频暂不可用' });
    if (mockAd) {
      this.busy = true;
      return new Promise((r) => setTimeout(() => { this.busy = false; r({ ok: true }); }, 1200));
    }
    const ad = rvAd();
    if (!ad) return Promise.resolve({ ok: false, msg: '视频创建失败' });
    this.busy = true;
    return new Promise((resolve) => {
      let done = false;
      const finish = (res) => {
        if (done) return; done = true; this.busy = false; clearTimeout(timer);
        safe(() => ad.offClose?.(onClose));
        resolve(res);
      };
      const timer = setTimeout(() => finish({ ok: false, msg: '视频响应超时' }), 90000);
      const onClose = (res) => finish(res && res.isEnded ? { ok: true } : { ok: false, msg: '视频未看完，没有奖励' });
      safe(() => ad.onClose(onClose));
      Promise.resolve().then(() => ad.show())
        .catch(() => Promise.resolve(ad.load?.()).then(() => ad.show()))
        .catch(() => finish({ ok: false, msg: '视频加载失败，稍后再试' }));
    });
  },
};

const lbm = () => { const t = getTap(); try { return t && t.getLeaderboardManager ? t.getLeaderboardManager() : null; } catch { return null; } };
export const board = {
  get available() { return !!lbm(); },
  submit(netWorth, days) {
    const m = lbm(); if (!m) return;
    const scores = [{ leaderboardId: LB_NETWORTH, score: Math.max(0, Math.round(netWorth)) }];
    if (days) scores.push({ leaderboardId: LB_FASTEST, score: days });
    safe(() => m.submitScores({ scores, callback: { onSuccess() {}, onFailure() {} } }));
  },
  open(which) {
    const m = lbm(); if (!m) return false;
    safe(() => m.openLeaderboard({ leaderboardId: which === 'fast' ? LB_FASTEST : LB_NETWORTH, collection: 'public', callback: { onSuccess() {}, onFailure() {} } }));
    return true;
  },
};

export const store = {
  // Keep unreadable data distinct from an empty slot so the UI cannot overwrite it.
  read(k) {
    let raw;
    try { raw = localStorage.getItem(k); } catch { return { status: 'unavailable' }; }
    if (raw === null) return { status: 'empty' };
    try { return { status: 'ok', value: JSON.parse(raw), raw }; }
    catch { return { status: 'invalid', raw }; }
  },
  get(k, d) { const result = this.read(k); return result.status === 'ok' ? result.value : d; },
  set(k, v) {
    try {
      const raw = JSON.stringify(v);
      localStorage.setItem(k, raw);
      return localStorage.getItem(k) === raw;
    } catch { return false; }
  },
  del(k) {
    try { localStorage.removeItem(k); return localStorage.getItem(k) === null; }
    catch { return false; }
  },
};
