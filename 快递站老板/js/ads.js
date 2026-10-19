import { dispatch, adRewardAvailable } from './engine.js';

export const AD_UNIT_ID = '1054324';
const usedInstances = new WeakSet();

/** A viewing owns its instance, callbacks and persisted pending request. */
export function createRewardAds({ getState, save, onBusy = () => {}, onResult = () => {}, host = () => globalThis.tap, timeoutMs = 120000 }) {
  let active = null;
  const available = () => { try { return typeof host()?.createRewardedVideoAd === 'function'; } catch { return false; } };
  const persist = state => { try { return save(state); } catch { return { ok: false, message: '无法保存进度，请重试保存' }; } };
  function finish(r, message, options = {}) {
    if (active !== r) return;
    active = null;
    clearTimeout(r.timer);
    globalThis.removeEventListener?.('pagehide', r.hide);
    try { r.ad?.offClose?.(r.close); r.ad?.offError?.(r.error); } catch {}
    try { r.ad?.destroy?.(); } catch {}
    if (getState() === r.state && r.state.adRewards?.pending?.id === r.id) {
      dispatch(r.state, { type: 'CANCEL_AD', id: r.id });
      const saved = persist(r.state);
      if (!saved?.ok) { options.saveFailed = true; message = saved?.message || '无法保存进度，请重试保存'; }
    }
    onBusy(false);
    onResult(message, options);
  }
  function cancel() { if (active) finish(active, '广告已取消，未领取奖励'); }
  function request() {
    if (active) return false;
    if (!available()) { onResult('仅在TapTap内可观看广告', {}); return false; }
    const state = getState();
    if (!adRewardAvailable(state)) { onResult('今天无法领取广告奖励', {}); return false; }
    const id = globalThis.crypto?.randomUUID?.() || `ad_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    if (!dispatch(state, { type: 'BEGIN_AD', id }).ok) return false;
    const checkpoint = persist(state);
    if (!checkpoint?.ok) {
      dispatch(state, { type: 'CANCEL_AD', id });
      onResult(checkpoint?.message || '无法保存进度，请重试保存', { saveFailed: true });
      return false;
    }
    const r = { id, state, day: state.day, phase: state.phase, showing: false, ad: null };
    active = r; onBusy(true);
    r.hide = cancel;
    globalThis.addEventListener?.('pagehide', r.hide);
    r.timer = setTimeout(() => finish(r, '广告等待超时，未领取奖励'), timeoutMs);
    r.error = () => finish(r, '广告暂时无法播放，未领取奖励');
    r.close = response => {
      if (active !== r) return;
      if (!r.showing || response?.isEnded !== true) return finish(r, '未完整观看广告，未领取奖励');
      if (getState() !== state || state.day !== r.day || state.phase !== r.phase || state.adRewards?.pending?.id !== id) return finish(r, '进度已变化，未领取奖励');
      if (!dispatch(state, { type: 'GRANT_AD', id }).ok) return finish(r, '广告请求已失效');
      const saved = persist(state);
      finish(r, saved?.ok ? '已领取20金币' : (saved?.message || '奖励尚未保存，请重试保存'), { granted: true, saveFailed: !saved?.ok });
    };
    try {
      const ad = host().createRewardedVideoAd({ adUnitId: AD_UNIT_ID });
      if (!ad || typeof ad !== 'object' || usedInstances.has(ad)) throw Error('reused or missing instance');
      usedInstances.add(ad); r.ad = ad;
      if (!['onClose', 'onError', 'show'].every(key => typeof ad[key] === 'function')) throw Error('incomplete SDK');
      ad.onClose(r.close); ad.onError(r.error);
      const show = () => { if (active !== r) return; r.showing = true; return ad.show(); };
      Promise.resolve().then(show).catch(async () => {
        if (active !== r) return;
        r.showing = false;
        try {
          if (typeof ad.load !== 'function') throw Error('load unavailable');
          await ad.load();
          if (active !== r) return;
          await show();
        } catch { r.error(); }
      });
    } catch { r.error(); }
    return true;
  }
  return { available, request, cancel, get busy() { return !!active; } };
}
