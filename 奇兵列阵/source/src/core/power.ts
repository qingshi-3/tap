import type { Effect } from './types';

const POWERED = new Set(['dmg', 'heal', 'burn', 'chill']);
const GROUP_TARGETS = new Set<Effect['to']>(['allies', 'others', 'enemyAll', 'burningEnemies', 'otherEnemies']);
/** 与实际施法共用：不影响非施法、零基础及不受法强的效果。 */
export function effectAmount(effect: Effect, base: number, power: number, cast: boolean) {
  return base + (cast && base > 0 && POWERED.has(effect.op) ? GROUP_TARGETS.has(effect.to) ? Math.floor(power / 2) : power : 0);
}
export const halfPower = (effect: Effect) => GROUP_TARGETS.has(effect.to);
