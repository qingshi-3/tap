// 激励广告 mock：沿用奇兵列阵的样式，倒计时结束视为看完。发布时换成 TapTap 广告接入。
import { sfx } from '../qb/audio';
import { h, wait } from '../qb/dom';
import { icon } from '../qb/icons';

const DURATION = 2500;

export async function showRewardedAd(host: HTMLElement, title: string, desc: string): Promise<boolean> {
  const steps = 10;
  const bars = Array.from({ length: steps }, () => h('i'));
  const count = h('div', { class: 'rewarded-countdown' }, `${Math.ceil(DURATION / 1000)}s`);
  const state = h('div', { class: 'rewarded-state' }, '广告播放中…');
  const card = h('div', { class: 'rewarded-card' },
    h('div', { class: 'rewarded-head' }, h('span', { class: 'rewarded-ad-tag' }, 'AD'), count),
    h('div', { class: 'rewarded-scene' }, h('div', { class: 'rewarded-grid' }), h('span', { class: 'rewarded-orb' }), h('span', { class: 'rewarded-orb o2' }), h('span', { class: 'rewarded-orb o3' }),
      h('div', { class: 'rewarded-mark' }, icon('play'))),
    h('div', { class: 'rewarded-copy' }, h('h2', null, title), h('p', null, desc)),
    h('div', { class: 'rewarded-progress' }, ...bars),
    state,
    h('div', { class: 'rewarded-foot' }, '试玩版为模拟广告'));
  const ov = h('div', { class: 'rewarded-ov' }, card);
  host.appendChild(ov);
  const t0 = performance.now();
  for (let i = 0; i < steps; i++) {
    await wait(DURATION / steps);
    bars[i].classList.add('on');
    count.textContent = `${Math.max(0, Math.ceil((DURATION - (performance.now() - t0)) / 1000))}s`;
  }
  card.classList.add('complete');
  state.textContent = '奖励已发放';
  count.textContent = '完成';
  sfx.reward();
  await wait(500);
  ov.remove();
  return true;
}
