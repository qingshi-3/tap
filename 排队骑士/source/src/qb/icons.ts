// 24×24 线面结合图标，currentColor 着色
export const ICON = {
  // 攻击：斜握的单刃斧，实心剪影保证小尺寸可读
  sword: '<g transform="translate(1.6 1) scale(.9) rotate(22 12 12)"><path d="M11.5 4.5C9 3.6 6 2.6 3.2 2.6 1.6 6.4 1.6 11.6 3.2 15.4 6 15.4 9 14.4 11.5 13.5Z" fill="currentColor"/><path d="M14 2V23" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="11" y="5" width="6" height="8" rx="1.2" fill="currentColor"/></g>',
  heart: '<path d="M12 20.5s-8-4.7-8-10.6C4 7 6.2 4.8 8.8 4.8c1.4 0 2.6.7 3.2 1.8.6-1.1 1.8-1.8 3.2-1.8C17.8 4.8 20 7 20 9.9c0 5.9-8 10.6-8 10.6Z" fill="currentColor"/>',
  shield: '<path d="M12 2.8 19.5 5.6v6.2c0 4.6-3.1 8-7.5 9.6-4.4-1.6-7.5-5-7.5-9.6V5.6Z" fill="currentColor"/>',
  skull: '<path d="M12 3c-4.6 0-8 3.2-8 7.6 0 2.5 1.2 4.3 3 5.4V19a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3c1.8-1.1 3-2.9 3-5.4C20 6.2 16.6 3 12 3Z" fill="currentColor"/><circle cx="8.8" cy="11" r="2" fill="#000" opacity=".75"/><circle cx="15.2" cy="11" r="2" fill="#000" opacity=".75"/><path d="M10 17h4" stroke="#000" opacity=".6" stroke-width="1.6"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 3.8l3 2.2 3-2.2M9 20.2l3-2.2 3 2.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  swap: '<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  fire: '<path d="M12 2.5c1 3.2 4.8 5 4.8 9.8a4.8 4.8 0 0 1-9.6 0c0-2 1-3.4 2.2-4.4.1 1.6.8 2.6 1.8 3 .2-3.4-.4-5.8.8-8.4Z" fill="currentColor"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5Z" fill="currentColor"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  play: '<path d="M7 4.5v15l12-7.5Z" fill="currentColor"/>',
  ff: '<path d="M3 5v14l9-7Zm9 0v14l9-7Z" fill="currentColor"/>',
  skip: '<path d="M4 5v14l10-7Zm12 0h3v14h-3Z" fill="currentColor"/>',
  check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  x: '<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  star: '<path d="m12 2.5 2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8Z" fill="currentColor"/>',
  target: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  info: '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.2v.2" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  diamond: '<path d="M12 2 21 12 12 22 3 12Z" fill="currentColor"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  book: '<path d="M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4Zm16 0h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  bolt: '<path d="M13.5 2 5 13.5h6L10 22l9-12h-6Z" fill="currentColor"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 9v6l5-3Z" fill="currentColor"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  plate: '<path d="M5 4.5 12 3l7 1.5V11c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10Z" fill="currentColor" opacity=".3"/><path d="M5 4.5 12 3l7 1.5V11c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10ZM5 9.5h14M12 3v18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  spikes: '<path d="M3 20 6 9l3 11 3-15 3 15 3-11 3 11Z" fill="currentColor" opacity=".3"/><path d="M3 20 6 9l3 11 3-15 3 15 3-11 3 11Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  burst: '<path d="m12 2 2.2 6 6.3-1.6-4 5.1 4 5.1-6.3-1.6L12 21l-2.2-6-6.3 1.6 4-5.1-4-5.1 6.3 1.6Z" fill="currentColor" opacity=".3"/><path d="m12 2 2.2 6 6.3-1.6-4 5.1 4 5.1-6.3-1.6L12 21l-2.2-6-6.3 1.6 4-5.1-4-5.1 6.3 1.6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  sparkle: '<path d="M12 2c.8 5 2.6 7.6 8 10-5.4 2.4-7.2 5-8 10-.8-5-2.6-7.6-8-10 5.4-2.4 7.2-5 8-10Z" fill="currentColor"/>',
  combo: '<path d="M4 15 15 4M9 20 20 9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M15 4h4v4M20 9v4h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>',
  snipe: '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  guard: '<path d="M12 2.8 19.5 5.6v6.2c0 4.6-3.1 8-7.5 9.4-4.4-1.4-7.5-4.8-7.5-9.4V5.6Z" fill="currentColor" opacity=".3"/><path d="M12 2.8 19.5 5.6v6.2c0 4.6-3.1 8-7.5 9.4-4.4-1.4-7.5-4.8-7.5-9.4V5.6ZM8.5 12l2.5 2.5 4.5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
  wand: '<path d="M4 20 15 9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M17 2.5l1.1 2.9 2.9 1.1-2.9 1.1L17 10.5l-1.1-2.9L13 6.5l2.9-1.1Z" fill="currentColor"/><circle cx="20" cy="13" r="1.3" fill="currentColor" opacity=".7"/><circle cx="10" cy="4" r="1.1" fill="currentColor" opacity=".7"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9.5 18.5 12 16l2.5 2.5Z" fill="currentColor"/>',
  hit: '<path d="m12 2 1.8 5.6L19 4.5l-2.6 5.1L22 12l-5.6 1.4 2.6 5.6-5.4-2.9L12 22l-1.6-5.9L5 19l2.6-5.6L2 12l5.6-2.4L5 4.5l5.2 3.1Z" fill="currentColor" opacity=".35"/><path d="m12 7 1.2 3.2 3.3.3-2.5 2.2.8 3.3-2.8-1.8-2.8 1.8.8-3.3-2.5-2.2 3.3-.3Z" fill="currentColor"/>',
  tomb: '<path d="M6 21V10a6 6 0 0 1 12 0v11Z" fill="currentColor" opacity=".3"/><path d="M6 21V10a6 6 0 0 1 12 0v11M3.5 21h17M12 9v7M9.5 11.5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  kill: '<path d="M4 4l9 9M20 4l-9 9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M7 17l-3 3M17 17l3 3M5.5 14.5l4 4M18.5 14.5l-4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  filter: '<path d="M3.5 5h17l-6.5 7.5V19l-4 2v-8.5Z" fill="currentColor"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
};

export type IconName = keyof typeof ICON;

export function icon(name: IconName, cls = '') {
  const s = document.createElement('span');
  s.className = `ic ${cls}`;
  s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
  return s;
}
