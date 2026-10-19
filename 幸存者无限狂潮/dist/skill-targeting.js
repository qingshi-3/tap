const FALLBACK_VIEWPORT_SHORT_SIDE = 420;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export function getFrostAimRange(game) {
  const viewport = game?.viewport || {};
  const shortSide = Math.min(Number(viewport.width) || 720, Number(viewport.height) || FALLBACK_VIEWPORT_SHORT_SIDE);
  return Math.min(220, Math.max(0, shortSide * .48));
}

export function getFrostTarget(game, input = {}) {
  const player = game?.player || { x: 0, y: 0 };
  const world = game?.world || {};
  if (Number.isFinite(input.targetX) && Number.isFinite(input.targetY)) {
    return {
      x: clamp(input.targetX, 0, Number(world.width) || 2400),
      y: clamp(input.targetY, 0, Number(world.height) || 1800),
    };
  }

  const range2 = getFrostAimRange(game) ** 2;
  let target = null, best = range2;
  for (const enemy of game?.enemies || []) {
    if (enemy.dead || enemy.spawnDelay > 0) continue;
    const dx = enemy.x - player.x, dy = enemy.y - player.y, distance = dx * dx + dy * dy;
    if (distance <= best) { best = distance; target = enemy; }
  }
  return target ? { x: target.x, y: target.y } : { x: player.x, y: player.y };
}
export function getBlinkAnchors(game, skillId = 'blinkStrike') {
  const p=game?.player||{x:0,y:0};
  return (game?.heroState?.blinkAnchors||[]).filter(a=>a.remaining>0&&Math.hypot(a.x-p.x,a.y-p.y)<=600).slice().sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)||a.id-b.id);
}
export function resolveBlinkAnchor(game,input={}) {
  const anchors=getBlinkAnchors(game);
  if(input.anchorId!=null)return anchors.find(a=>a.id===input.anchorId)||null;
  if(Number.isFinite(input.targetX)&&Number.isFinite(input.targetY))return anchors.sort((a,b)=>Math.hypot(a.x-input.targetX,a.y-input.targetY)-Math.hypot(b.x-input.targetX,b.y-input.targetY)||a.id-b.id)[0]||null;
  return anchors[0]||null;
}
export function getBlinkRoute(game,input={}) {
  if(input.skillId!=='blinkStorm'){const a=resolveBlinkAnchor(game,input);return a?[{id:a.id,x:a.x,y:a.y}]:[];}
  const left=getBlinkAnchors(game,'blinkStorm').slice(), route=[];let at=game.player;
  while(left.length){left.sort((a,b)=>Math.hypot(a.x-at.x,a.y-at.y)-Math.hypot(b.x-at.x,b.y-at.y)||a.id-b.id);at=left.shift();route.push({id:at.id,x:at.x,y:at.y});}
  return route.concat(route.slice(0,-1).reverse().map(a=>({...a})));
}
