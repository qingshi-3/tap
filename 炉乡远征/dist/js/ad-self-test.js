import { rewardedAd } from './rewarded-ad.js';

export function createAdSelfTest(dialog) {
  const status = dialog.querySelector('#ad-self-test-status');
  const host = dialog.querySelector('#ad-self-test-host');
  const api = dialog.querySelector('#ad-self-test-api');
  const config = dialog.querySelector('#ad-self-test-config');
  const playback = dialog.querySelector('#ad-self-test-playback');
  const play = dialog.querySelector('#ad-self-test-play');
  const close = dialog.querySelector('#ad-self-test-close');
  let returnFocus = null;
  let playing = false;

  function refresh() {
    try {
      const tap = globalThis.tap;
      const hasHost = tap != null;
      const hasApi = typeof tap?.createRewardedVideoAd === 'function';
      host.textContent = hasHost ? '已检测到' : '未检测到';
      api.textContent = hasApi ? '已检测到' : '未检测到';
      if (config) config.textContent = '已生效（1054323）';
      if (play) play.disabled = playing || !hasApi;
      if (!playing) {
        status.textContent = !hasHost
          ? '未检测到 TapTap 宿主，请用 TapTap 扫自测二维码打开。'
          : !hasApi
            ? '当前宿主未提供激励视频接口，无法试播。'
            : '广告位已配置，点击播放验证。';
      }
    } catch {
      host.textContent = '读取失败';
      api.textContent = '读取失败';
      if (!playing) status.textContent = '无法读取宿主接口，请重新检测。';
    }
  }

  async function playAd() {
    if (playing) return;
    playing = true;
    play.disabled = true;
    playback.textContent = '播放中…';
    status.textContent = '正在播放；本次自测不会发放游戏奖励。';
    const result = await rewardedAd.show({ isContextValid: () => dialog.open });
    playing = false;
    if (result.status === 'completed') {
      playback.textContent = '已看完';
      status.textContent = '试播完成；未发放游戏奖励。';
    } else if (result.status === 'cancelled') {
      playback.textContent = '未看完';
      status.textContent = result.message ?? '广告未完整观看。';
    } else {
      playback.textContent = '错误';
      status.textContent = result.message ?? '广告暂时无法播放。';
    }
    try {
      play.disabled = typeof globalThis.tap?.createRewardedVideoAd !== 'function';
    } catch {
      play.disabled = true;
    }
  }

  close.addEventListener('click', () => {
    rewardedAd.cancel();
    dialog.close();
  });
  dialog.querySelector('#ad-self-test-refresh').addEventListener('click', refresh);
  play.addEventListener('click', () => void playAd());
  dialog.addEventListener('cancel', () => rewardedAd.cancel());
  dialog.addEventListener('close', () => {
    rewardedAd.cancel();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  });
  return {
    open() {
      if (dialog.open) return;
      returnFocus = document.activeElement;
      refresh();
      dialog.showModal();
      close.focus();
    }
  };
}
