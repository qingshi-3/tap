import './css/audio-settings.css';
import { getVolumes, isMuted, setMuted, setVolume, sfx, unlockAudio, MUSIC_TRACKS, getMusicSelection, setMusicSelection, type MusicSelection } from './audio';
import { h } from './dom';

/** Shared by the title settings and the in-game menu; values apply immediately. */
export function audioSettings(onChange?: () => void) {
  const volumes = getVolumes();
  const rows = (['master', 'sfx', 'bgm'] as const).map(channel => {
    const name = { master: '总音量', sfx: '音效', bgm: 'BGM' }[channel];
    const value = Math.round((channel === 'master' && isMuted() ? 0 : volumes[channel]) * 100);
    const slider = h('input', { type: 'range', min: 0, max: 100, step: 1, value, 'aria-label': name });
    const output = h('output', { 'aria-hidden': 'true' }, `${value}%`);
    const paint = () => {
      output.textContent = `${slider.value}%`;
      slider.style.setProperty('--volume', `${slider.value}%`);
      slider.setAttribute('aria-valuetext', `${slider.value}%`);
    };
    paint();
    slider.addEventListener('input', () => {
      // A legacy mute is represented by the master slider at zero. Explicitly
      // adjusting master takes control without changing the two channel levels.
      setVolume(channel, Number(slider.value) / 100);
      if (channel === 'master') setMuted(false);
      unlockAudio();
      paint();
      onChange?.();
    });
    slider.addEventListener('change', () => { if (channel !== 'bgm') sfx.click(); });
    return h('label', { class: 'audio-row' }, h('span', null, name), slider, output);
  });
  const music = h('select', { 'aria-label': '局内配乐' },
    h('option', { value: 'random' }, '随机'),
    MUSIC_TRACKS.map(track => h('option', { value: track.id }, track.label)));
  music.value = getMusicSelection();
  music.addEventListener('change', () => {
    setMusicSelection(music.value as MusicSelection);
    unlockAudio();
  });
  return h('div', { class: 'audio-settings' }, rows,
    h('label', { class: 'audio-track' }, h('span', null, '局内配乐'), music));
}
