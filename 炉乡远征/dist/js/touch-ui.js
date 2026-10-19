// Delegate to the game root so dynamically created cards and dialogs are covered.
// Pointer/touch events remain untouched: gameplay dragging and rail scrolling own them.
const gameRoot = document.getElementById('app');
// Native dialogs may focus their first button after a tap. That is not keyboard
// navigation: keep focus for accessibility, but don't draw a touch focus box.
document.documentElement.dataset.inputMode = 'pointer';
document.addEventListener('pointerdown', () => {
  document.documentElement.dataset.inputMode = 'pointer';
}, { capture: true, passive: true });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab' || event.key.startsWith('Arrow')) {
    document.documentElement.dataset.inputMode = 'keyboard';
  }
}, { capture: true });
function suppressNativeGesture(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (target?.isContentEditable || target?.closest('input, textarea')) return;
  event.preventDefault();
}
for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
  gameRoot?.addEventListener(type, suppressNativeGesture, { capture: true });
}
