// Camera overscan keeps the playable world edge away from the touch HUD. This
// transforms the view only; actors retain their original world collision bounds.
export function getBattleCamera(game, width = game.viewport?.width || 844, height = game.viewport?.height || 390) {
  const padding = 120;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  return { x: clamp(game.player.x - width / 2, -padding, game.world.width - width + padding),
    y: clamp(game.player.y - height / 2, -padding, game.world.height - height + padding) };
}
