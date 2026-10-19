const AD_UNIT_ID = '1054323';
const LOAD_TIMEOUT_MS = 15_000;
const PLAYBACK_TIMEOUT_MS = 120_000;

function errorMessage(error, fallback = '广告暂时无法播放') {
  let code;
  let detail;
  try {
    code = error?.errCode;
    detail = error?.errMsg ?? error?.message;
  } catch {
    return fallback;
  }
  const parts = [];
  if (code !== undefined && code !== null && String(code)) parts.push(`错误码 ${String(code).slice(0, 40)}`);
  if (detail) parts.push(String(detail).slice(0, 160));
  return parts.join('：') || fallback;
}

function safely(action) {
  try { action(); } catch { /* Host cleanup must not replace the playback result. */ }
}

class RewardedAdAdapter {
  constructor() {
    this.active = null;
    this.preloaded = null;
    this.creationError = null;
    this.nextToken = 1;
    this.prepare();
  }

  createSlot() {
    let tap;
    try {
      tap = globalThis.tap;
    } catch (error) {
      this.creationError = error;
      return null;
    }
    if (typeof tap?.createRewardedVideoAd !== 'function') {
      this.creationError = null;
      return null;
    }

    let ad;
    try {
      ad = tap.createRewardedVideoAd({ adUnitId: AD_UNIT_ID });
    } catch (error) {
      this.creationError = error;
      return null;
    }
    if (!ad || typeof ad.show !== 'function') {
      safely(() => ad?.destroy?.());
      this.creationError = new Error('宿主返回了无效的广告实例');
      return null;
    }
    this.creationError = null;

    let timer;
    let onLoad;
    let onError;
    let abortPreload;
    const ready = new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        safely(() => ad.offLoad?.(onLoad));
        safely(() => ad.offError?.(onError));
      };
      onLoad = () => { cleanup(); resolve(); };
      onError = (error) => { cleanup(); reject(error); };
      abortPreload = () => onError(new Error('广告加载已取消'));
      safely(() => ad.onLoad?.(onLoad));
      safely(() => ad.onError?.(onError));
      timer = setTimeout(() => {
        cleanup();
        reject(new Error('广告加载超时'));
      }, LOAD_TIMEOUT_MS);
      try {
        const loading = ad.load?.();
        if (loading?.catch) loading.catch(onError);
        else if (typeof ad.onLoad !== 'function') onLoad();
      } catch (error) {
        onError(error);
      }
    });
    // Preloading starts immediately; keep a rejection handled until a click consumes it.
    ready.catch(() => {});
    return { ad, ready, abortPreload };
  }

  prepare() {
    if (!this.preloaded && !this.active) this.preloaded = this.createSlot();
  }

  async show({ isContextValid } = {}) {
    if (this.active) return { status: 'busy', message: '已有广告正在播放' };
    if (isContextValid && !this.contextIsValid(isContextValid)) {
      return { status: 'cancelled', message: '当前操作已结束' };
    }

    const slot = this.preloaded ?? this.createSlot();
    this.preloaded = null;
    if (!slot) {
      return this.creationError
        ? { status: 'error', message: errorMessage(this.creationError) }
        : { status: 'unavailable', message: '当前环境不支持激励视频' };
    }

    const token = this.nextToken++;
    return new Promise((resolve) => {
      const request = {
        token, ad: slot.ad, resolve, timer: null, listeners: null,
        abortPreload: slot.abortPreload, isContextValid
      };
      this.active = request;
      void this.run(request, slot.ready);
    });
  }

  contextIsValid(check) {
    try { return check() !== false; } catch { return false; }
  }

  isCurrent(request) {
    return this.active?.token === request.token;
  }

  async run(request, preloadReady) {
    try { await preloadReady; } catch { /* show() gets one normal recovery attempt below. */ }
    if (!this.isCurrent(request)) return;

    const onClose = (result) => {
      if (!this.isCurrent(request)) return;
      const valid = !request.isContextValid || this.contextIsValid(request.isContextValid);
      this.finish(request, result?.isEnded === true && valid
        ? { status: 'completed' }
        : { status: 'cancelled', message: valid ? '广告未完整观看' : '当前操作已结束' });
    };
    const onError = (error) => {
      if (!this.isCurrent(request)) return;
      if (request.recoveryStarted) this.finish(request, { status: 'error', message: errorMessage(error) });
      else void this.recover(request, error);
    };
    request.listeners = { onClose, onError };
    safely(() => request.ad.onClose?.(onClose));
    safely(() => request.ad.onError?.(onError));
    request.timer = setTimeout(() => {
      if (this.isCurrent(request)) this.finish(request, { status: 'error', message: '广告播放超时' });
    }, PLAYBACK_TIMEOUT_MS);

    try {
      await Promise.resolve(request.ad.show());
    } catch (firstError) {
      await this.recover(request, firstError);
    }
    // A resolved show() only means presentation started. onClose decides completion.
  }

  async recover(request, firstError) {
    if (!this.isCurrent(request) || request.recoveryStarted) return;
    request.recoveryStarted = true;
    try {
      await Promise.resolve(request.ad.load?.());
      if (!this.isCurrent(request)) return;
      await Promise.resolve(request.ad.show());
    } catch (retryError) {
      if (this.isCurrent(request)) {
        this.finish(request, { status: 'error', message: errorMessage(retryError, errorMessage(firstError)) });
      }
    }
  }

  finish(request, result, prepareNext = true) {
    if (!this.isCurrent(request)) return;
    this.active = null;
    clearTimeout(request.timer);
    request.abortPreload?.();
    const { onClose, onError } = request.listeners ?? {};
    safely(() => request.ad.offClose?.(onClose));
    safely(() => request.ad.offError?.(onError));
    safely(() => request.ad.destroy?.());
    request.resolve(result);
    if (prepareNext) this.prepare();
  }

  cancel() {
    const request = this.active;
    if (!request) return;
    this.finish(request, { status: 'cancelled', message: '已取消广告播放' }, false);
  }
}

export const rewardedAd = new RewardedAdAdapter();

