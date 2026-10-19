/** Render-owned world-position history. No entities, simulation clocks or RNG are written. */
export function createMotionTrails({ lifetime = .12, capacity = 192, samplesPerTrack = 6 } = {}) {
  const tracks = new Map();
  let owner = null, lastTime = null, destroyed = false;
  const clear = () => tracks.clear();
  function update(game, time, items, { camera = {x:0,y:0}, width, height, reducedMotion = false } = {}) {
    if (destroyed) return [];
    if (owner !== game || (lastTime !== null && (time < lastTime || time - lastTime > .08))) clear();
    const advanced = owner !== game || lastTime === null || time !== lastTime;
    owner = game; lastTime = time;
    if (reducedMotion) { clear(); return []; }
    const visible = p => p.x >= camera.x - 48 && p.y >= camera.y - 48 && p.x <= camera.x + width + 48 && p.y <= camera.y + height + 48;
    for (const [key, track] of tracks) {
      track.samples = track.samples.filter(p => time - p.time < lifetime && visible(p));
      if (!track.samples.length && time - track.last.time >= lifetime) tracks.delete(key);
    }
    if (advanced) for (const item of items) {
      if (!Number.isFinite(item.x) || !Number.isFinite(item.y) || !visible(item)) { tracks.delete(item.key); continue; }
      let track = tracks.get(item.key);
      if (!track) {
        if (tracks.size >= capacity) tracks.delete(tracks.keys().next().value);
        track = {last:{...item,time}, samples:[]}; tracks.set(item.key,track); continue;
      }
      const previous = track.last, distance = Math.hypot(item.x - previous.x, item.y - previous.y);
      if (distance > 80) track.samples = [];
      else if (distance >= .8 && time - previous.time >= .012) {
        track.samples.push(previous);
        if (track.samples.length > samplesPerTrack) track.samples.shift();
      }
      else if (distance >= .8) continue;
      // Stationary objects refresh their head but emit no additional trail.
      track.last = {...item,time};
    }
    const result = [];
    for (const track of tracks.values()) for (const p of track.samples) {
      const fade = Math.max(0,1-(time-p.time)/lifetime);
      if (fade > 0) result.push({...p,fade});
    }
    return result;
  }
  return {update, clear, destroy(){destroyed=true;clear();owner=null;lastTime=null;}};
}
