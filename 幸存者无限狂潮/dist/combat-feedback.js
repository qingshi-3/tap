// Transient presentation facts. Never consume gameplay RNG or persist these in a profile.
const LIFETIMES = { hit: .19, kill: .38, pickup: .28, supply: .65, hurt: .3, evolution: .9 };
const PRIORITY = { hit: 0, pickup: 0, kill: 1, supply: 2, hurt: 2, evolution: 3 };
export const MAX_FEEDBACK_EVENTS = 160;
export function createCombatFeedback() {
  return { events: [], totals: Object.fromEntries(Object.keys(LIFETIMES).map(type => [type, 0])), serial: 0 };
}
export function emitCombatFeedback(game, type, data = {}) {
  if (!game || !Object.hasOwn(LIFETIMES, type)) return;
  const state = game.combatFeedback ||= createCombatFeedback();
  state.totals[type]++;
  const id = ++state.serial;
  // Drop expendable sparks first; totals remain exact even when presentation is saturated.
  if (state.events.length >= MAX_FEEDBACK_EVENTS) {
    const index = state.events.findIndex(event => PRIORITY[event.type] <= PRIORITY[type]);
    if (index < 0) return;
    state.events.splice(index, 1);
  }
  const life = LIFETIMES[type];
  state.events.push({ id, type, life, maxLife: life,
    x: Number.isFinite(data.x) ? data.x : game.player?.x || 0,
    y: Number.isFinite(data.y) ? data.y : game.player?.y || 0,
    strength: Math.max(.5, Math.min(3, Number(data.strength) || 1)),
    angle: Number.isFinite(data.angle) ? data.angle : 0, color: data.color || '#fff3c9', boss: !!data.boss });
}
export function tickCombatFeedback(game, dt) {
  if (!game?.combatFeedback || !Number.isFinite(dt) || dt <= 0) return;
  for (const event of game.combatFeedback.events) event.life -= dt;
  game.combatFeedback.events = game.combatFeedback.events.filter(event => event.life > 0);
}
