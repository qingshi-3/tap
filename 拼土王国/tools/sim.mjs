// Balance bot: node tools/sim.mjs [runs] [strategy]  strategy: smart | lazy
import * as R from '../dist/rules.js';
const runs = +(process.argv[2] || 30), strat = process.argv[3] || 'smart';
let WOODW = 0.8, FOODW = 0.6;
function value(d) { return d ? d.gold + d.food * FOODW + d.wood * WOODW + d.fame * 6 + d.pop * 0.5 : -1e9; }
function bestBuild(s, types) {
  let best = null;
  for (const type of types) for (const t of s.tiles) for (let rot = 0; rot < 4; rot++) {
    const p = R.previewBuild(s, type, t.x, t.y, rot);
    if (!p.ok) continue;
    const def = R.BUILDINGS[type];
    let v = value(p.delta) / (def.gold + def.wood + 4) + (def.basic ? 0 : 0.25);
    if (type === 'tower' || type === 'barracks') {
      const g = R.guardMap(s, { id: -1, type, x: t.x, y: t.y, rot, level: 1, damaged: false }), base = R.guardMap(s);
      v = s.threats.filter(c => g.has(`${c.x},${c.y}`) && !base.has(`${c.x},${c.y}`)).length * 1.2;
    }
    if (type === 'house') { const w = R.workers(s); v = (w.free < 2 ? 1 : 0.2) + value(p.delta) / 20; }
    if (!best || v > best.v) best = { type, x: t.x, y: t.y, rot, v };
  }
  return best;
}
function run(seed) {
  const s = R.createGame(seed);
  while (s.status === 'playing') {
    const due = R.tributeOf(s), reserve = R.seasonOf(s) === 3 ? due : R.seasonOf(s) === 2 ? due * 0.6 : 0;
    // land: cheapest first placement, prefer adjacency to territory density
    if (strat === 'smart' || R.seasonOf(s) === 0) {
      let lb = null;
      for (let i = 0; i < 3; i++) for (let rot = 0; rot < 4; rot++) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!R.canPlaceLand(s, i, x, y, rot).ok) continue;
        const cells = R.landCells(s, i, x, y, rot), own = new Set(s.tiles.map(t => `${t.x},${t.y}`));
        const touch = cells.reduce((n, c) => n + [[1,0],[-1,0],[0,1],[0,-1]].filter(([a,b]) => own.has(`${c.x+a},${c.y+b}`)).length, 0);
        const v = touch + cells.length * 1.5 - s.landOffers[i].cost * 0.1 + cells.filter(c => c.treasure).length * 4;
        if (!lb || v > lb.v) lb = { i, x, y, rot, v };
      }
      if (lb && s.gold - s.landOffers[lb.i].cost >= reserve && s.tiles.filter(t=>!R.buildingAt(s,t.x,t.y)).length < 18) R.placeLand(s, lb.i, lb.x, lb.y, lb.rot);
    }
    if (strat === 'smart') { if (s.hand.length < R.HAND_LIMIT) R.takeDraft(s, 0); else R.skipDraft(s); }
    WOODW = s.wood < 8 || s.hand.some(t => R.BUILDINGS[t].wood > s.wood) ? 2 : 0.6; FOODW = R.forecast(s).food < 2 ? 1.4 : 0.3;
    for (let k = 0; k < 8; k++) {
      const types = strat === 'smart' ? [...new Set([...R.BASIC, ...s.hand])] : ['farm', 'house', 'lumber'];
      const b = bestBuild(s, types);
      if (!b || b.v <= 0.05 || s.gold - R.BUILDINGS[b.type].gold < reserve) break;
      R.build(s, b.type, b.x, b.y, b.rot);
    }
    for (const b of s.buildings) if (b.damaged && s.gold - R.repairCost(b) > reserve) R.repair(s, b.id);
    if (strat === 'smart' && R.seasonOf(s) < 2) for (const b of s.buildings) { const c = R.upgradeCost(b); if (c && s.gold - c.gold > reserve + 20) R.upgrade(s, b.id); }
    if (globalThis.TRACE && seed===1000) { const f=R.forecast(s); const cnt={}; s.buildings.forEach(b=>cnt[b.type]=(cnt[b.type]||0)+1); console.log(`T${s.turn} g${s.gold} +${f.gold} food${s.food}+${f.food} w${s.wood}+${f.wood} pop${f.population} free${R.workers(s).free} tiles${s.tiles.length} hand${s.hand} ${JSON.stringify(cnt)}`); }
    R.nextTurn(s);
  }
  return { status: s.status, year: R.yearOf(s), score: R.score(s).total, stars: R.score(s).stars, fame: s.fame, gold: s.gold, pop: R.workers(s).population, tiles: s.tiles.length, b: s.buildings.length, d: s.stats.defended, p: s.stats.plundered };
}
if (process.env.TRACE) { globalThis.TRACE = true; }
const res = Array.from({ length: runs }, (_, i) => run(1000 + i));
const won = res.filter(r => r.status === 'won');
const avg = k => (res.reduce((a, r) => a + r[k], 0) / res.length).toFixed(1);
console.log(strat, `win ${won.length}/${runs}`, 'lostYears', res.filter(r => r.status === 'lost').map(r => r.year).join(','), 'stars', [1,2,3].map(n => won.filter(r => r.stars === n).length).join('/'));
console.log('avg score', avg('score'), 'fame', avg('fame'), 'gold', avg('gold'), 'pop', avg('pop'), 'tiles', avg('tiles'), 'bld', avg('b'), 'def/plunder', avg('d'), avg('p'));
