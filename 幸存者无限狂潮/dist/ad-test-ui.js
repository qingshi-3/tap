import {RewardedAd} from './rewarded-ad.js';

// A separate adapter isolates test playback from settlement receipts and gold grants.
export function createAdTestUI(dialog) {
  const adapter = new RewardedAd();
  const button = document.getElementById('ad-self-test');
  const status = document.getElementById('ad-self-test-status');
  let generation = 0, busy = false;
  function sync() {
    button.disabled = busy || !adapter.available || adapter.blocked;
    button.textContent = busy ? '广告播放中…' : '广告自测（不发奖励）';
  }
  function open() {
    sync();
    status.textContent = adapter.blocked
      ? '旧广告请求未确认结束，请重新进入游戏后再测试。'
      : adapter.available
        ? '直接测试 TapTap 视频播放，不发放金币或材料。'
        : '请在 TapTap 手机试玩中测试，普通浏览器不支持广告播放。';
  }
  function cancel() { generation++; busy = false; adapter.cancel(); sync(); }
  button.addEventListener('click', async () => {
    if (busy || !dialog.open) return;
    const current = ++generation;
    busy = true; sync(); status.textContent = '正在加载视频，本次自测不会发放奖励…';
    try {
      const result = await adapter.selfTest({isContextValid: () => current === generation && dialog.open});
      if (current !== generation || !dialog.open) return;
      status.textContent = result.status === 'completed'
        ? '视频完整播放成功。自测不发奖励，结算奖励仍需在远征结束后验证。'
        : result.message || '视频未完整播放，未发放奖励。';
    } catch { if (current === generation && dialog.open) status.textContent = '广告测试失败，游戏进度未修改。'; }
    finally { if (current === generation) { busy = false; sync(); } }
  });
  dialog.addEventListener('close', cancel);
  window.addEventListener('pagehide', cancel);
  return {open};
}
