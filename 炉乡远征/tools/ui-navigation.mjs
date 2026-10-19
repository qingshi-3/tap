// Follow the same menu -> feature route as the player; never invoke UI handlers.
export async function navigateCamp(root, destination, activate = locator => locator.tap()) {
  if (await root.getAttribute('data-page') === destination) return;
  if (await root.getAttribute('data-page') !== 'menu') {
    await activate(root.locator('[data-action="nav"][data-page="menu"]').first());
  }
  if (destination !== 'menu') await activate(root.locator(`[data-action="nav"][data-page="${destination}"]`).first());
  // Rendering restores focus on the next frame; wait before the next keyboard action.
  await root.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
