import sheet from '../assets/spell-collect.png';
import { h } from '../qb/dom';

// pixelfx pickups/collect-burst, 42 frames at 30 fps. See the adjacent asset license.
export function spellFeedback(parent: HTMLElement, x: number, y: number) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const effect = h('span', { class: 'spell-collect', 'aria-hidden': 'true',
    style: { left: `${x - 56}px`, top: `${y - 64}px`, backgroundImage: `url("${sheet}")` } });
  parent.appendChild(effect);
  const frames = Array.from({ length: 42 }, (_, i) => ({
    backgroundPosition: `${-(i % 7) * 112}px ${-Math.floor(i / 7) * 108}px`,
    offset: i / 41,
  }));
  const motion = effect.animate(frames, { duration: 1380, easing: 'steps(1,end)' });
  void motion.finished.then(() => effect.remove(), () => effect.remove());
}
