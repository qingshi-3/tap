// User-owned source: zhenlie-demo/source/src/ui/pixel.ts. Keep the original
// generator and palette; this entry only installs them in the host UI.
import { installPixelSprites } from '../vendor/qibing-ui/pixel.js';
import './qibing-motion.js';

installPixelSprites();
document.documentElement.dataset.ui = 'qibing';

// Read the existing host settings at each activation: never create a second
// MenuMusic instance or persist an independent UI-audio preference.
import { getMenuMusicStatus } from './menu-music.js';
import { setMuted, setVolume, unlockAudio, sfx } from '../vendor/qibing-ui/audio.js';

document.addEventListener('click', event => {
  if (!event.isTrusted || document.hidden) return;
  const button = event.target.closest?.('button');
  if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
  // Battle card/board commands retain their own existing audio behavior.
  if (button.closest('#match,#board,.hand-zone,.hand-card,.game-card')) return;
  const preferences = getMenuMusicStatus()?.preferences;
  if (!preferences) return;
  setVolume(preferences.volume);
  setMuted(preferences.muted || preferences.volume === 0);
  if (preferences.muted || preferences.volume === 0) return;
  unlockAudio();
  if (button.dataset.action === 'select-faction') sfx.pick();
  else sfx.click();
});
