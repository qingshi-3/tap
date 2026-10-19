/** 打印第一波敌人的真实行军路径，用来确定可靠的防守站位（只读规则，不改状态）。 */
import { createGame, applyAction, step } from '../src/core/index.ts';

const state = createGame(20261013);
console.log('map', state.mapId, `${state.map.width}x${state.map.height}`, 'core', JSON.stringify(state.map.core));
console.log('gates', JSON.stringify(state.map.gates));
applyAction(state, { type: 'startWave' });

const track = new Map<number, string[]>();
for (let i = 0; i < 2400 && state.phase === 'combat'; i++) {
  step(state, 1);
  if (i % 150 !== 0) continue;
  for (const u of state.units) {
    if (u.team !== 'enemy') continue;
    const list = track.get(u.id) ?? [];
    list.push(`${Math.floor(u.x)},${Math.floor(u.y)}`);
    track.set(u.id, list);
  }
}
for (const [id, path] of [...track].slice(0, 4)) {
  console.log(`enemy#${id} path: ${path.join(' -> ')}`);
}
// 给出路径经过的格子热度，便于选防守点
const heat = new Map<string, number>();
for (const [, path] of track) for (const cell of path) heat.set(cell, (heat.get(cell) ?? 0) + 1);
const hot = [...heat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log('hottest cells:', hot.map(([c, n]) => `${c}(${n})`).join(' '));
