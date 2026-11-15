/** Broad silhouettes on a 20 px grid; each icon uses only a few solid planes. */
export type HudIconName = 'archetypes' | 'map' | 'help' | 'book' | 'menu';

const C = {
  ink: '#29243d', gold: '#d9ac67', light: '#ffe3a5',
  paper: '#ead8ad', shade: '#b89b70', teal: '#65a8a6',
} as const;
type Color = keyof typeof C;
const path = (d: string, color: Color) => `<path d="${d}" fill="${C[color]}"/>`;

const ART: Record<HudIconName, string> = {
  archetypes: [
    // Three distinct cards form a build; the central card carries one bold emblem.
    path('M1 5H5V7H8V18H4V16H1Z', 'teal'),
    path('M15 5H19V16H16V18H12V7H15Z', 'paper'),
    path('M5 1H15V19H5Z', 'ink'),
    path('M7 3H13V17H7Z', 'gold'),
    path('M7 3H13V5H7Z', 'light'),
    path('M9 8H11V10H12V12H11V14H9V12H8V10H9Z', 'ink'),
  ].join(''),
  map: [
    // Three large parchment folds and a single continuous route.
    path('M1 4L7 2L13 4L19 2V16L13 18L7 16L1 18Z', 'shade'),
    path('M1 4L7 2V14L1 16ZM13 4L19 2V14L13 16Z', 'paper'),
    path('M7 2L13 4V16L7 14Z', 'light'),
    path('M4 11H8V8H12V6H16V8H14V10H10V13H4Z', 'teal'),
  ].join(''),
  help: [
    // Large question mark, readable without a surrounding plaque.
    path('M6 2H14V4H17V10H14V12H12V15H8V10H11V8H13V6H7V8H3V5H6ZM8 17H12V20H8Z', 'gold'),
    path('M6 2H14V4H6ZM3 5H7V7H3ZM8 17H12V18H8Z', 'light'),
  ].join(''),
  book: [
    // Open pages and one clear central fold; no tiny jewels or page marks.
    path('M1 3H7L10 5L13 3H19V18H13L10 20L7 18H1Z', 'gold'),
    path('M2 2H7L9 4V16L7 15H2Z', 'paper'),
    path('M11 4L13 2H18V15H13L11 16Z', 'light'),
    path('M9 4H11V18H9Z', 'ink'),
  ].join(''),
  menu: [
    // Wide gear teeth and an uncluttered central opening.
    path('M7 1H13V4H16V7H19V13H16V16H13V19H7V16H4V13H1V7H4V4H7Z', 'gold'),
    path('M7 1H13V3H7ZM4 4H7V6H4ZM1 7H4V10H1Z', 'light'),
    path('M7 6H13V7H14V13H13V14H7V13H6V7H7Z', 'ink'),
  ].join(''),
};

export function hudIcon(name: HudIconName): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'hud-tool-icon';
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 20 20" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" focusable="false" aria-hidden="true">${ART[name]}</svg>`;
  return wrapper;
}
