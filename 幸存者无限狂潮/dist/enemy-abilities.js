import { getEnemyContent } from './enemy-content.js';
import { getBattleCamera } from './battle-camera.js';
import { initTrialBoss, isTrialBoss, updateTrialBoss, damageTrialBoss, clearTrialOwned } from './trial-bosses.js';
export { getTrialDamageMultiplier, isTrialBoss } from './trial-bosses.js';

const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const deltaAngle = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const livingOwner = (game, id) => game.enemies.find(e => e.id === id && !e.dead);
const targets = game => [game.player, ...game.companions.filter(c => c.hp > 0 && !c.incapacitated)];

export function pointHitsEnemyGeometry(point, geometry) {
  const padding = point.radius || 0, d = dist(point, geometry);
  if (geometry.shape === 'line') {
    const dx = geometry.toX - geometry.x, dy = geometry.toY - geometry.y;
    const t = clamp(((point.x - geometry.x) * dx + (point.y - geometry.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(point.x - geometry.x - dx * t, point.y - geometry.y - dy * t) <= geometry.width / 2 + padding;
  }
  if (geometry.shape === 'sector') return d <= geometry.radius + padding &&
    (d <= padding || Math.abs(deltaAngle(Math.atan2(point.y - geometry.y, point.x - geometry.x), geometry.angle)) <= geometry.width / 2 + Math.asin(Math.min(1, padding / Math.max(d, .001))));
  if (geometry.shape === 'ring') {
    if (d + padding < geometry.innerRadius || d - padding > geometry.outerRadius) return false;
    // An entity must fit inside the opening; its centre alone is insufficient.
    const clearance = Math.asin(Math.min(1, padding / Math.max(d, .001)));
    return Math.abs(deltaAngle(Math.atan2(point.y - geometry.y, point.x - geometry.x), geometry.gapAngle)) >= geometry.gapWidth / 2 - clearance;
  }
  return d <= geometry.radius + padding;
}

function viewBounds(game) {
  const width = game.viewport?.width || 844, height = game.viewport?.height || 390;
  const {x,y}=getBattleCamera(game,width,height);
  // Keep starts clear of the top HUD and bottom touch controls. Geometry never
  // changes after its warning is published, even when the camera subsequently pans.
  return { left: x + 20, right: x + width - 20, top: y + 74, bottom: y + height - 12 };
}
function visible(game, e, padding = 20) {
  const b = viewBounds(game);
  return e.x - padding >= b.left && e.x + padding <= b.right && e.y - padding >= b.top && e.y + padding <= b.bottom;
}
function fits(game, g) {
  const b = viewBounds(game);
  // Only the portion reachable inside the world must be readable. Overscan
  // presents its border, but off-world circle/sector outlines may be clipped.
  const readable=(x,y)=>x<0||y<0||x>game.world.width||y>game.world.height||
    (x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom);
  if(!readable(g.x,g.y))return false;
  if (g.shape === 'line') {
    const angle=Math.atan2(g.toY-g.y,g.toX-g.x),nx=-Math.sin(angle)*g.width/2,ny=Math.cos(angle)*g.width/2;
    for(let i=0;i<=24;i++)for(const side of [-1,0,1]){
      const t=i/24;if(!readable(g.x+(g.toX-g.x)*t+nx*side,g.y+(g.toY-g.y)*t+ny*side))return false;
    }
    for(const end of [{x:g.x,y:g.y},{x:g.toX,y:g.toY}])for(let i=0;i<16;i++){
      const a=i*TAU/16;if(!readable(end.x+Math.cos(a)*g.width/2,end.y+Math.sin(a)*g.width/2))return false;
    }return true;
  }
  if (g.shape === 'sector') {
    // Inspect the authored sector boundary, rather than requiring its unused rear circle.
    for (let i = 0; i <= 20; i++) { const a = g.angle - g.width / 2 + g.width * i / 20;
      for(let step=1;step<=4;step++){
        const x = g.x + Math.cos(a) * g.radius*step/4, y = g.y + Math.sin(a) * g.radius*step/4;
        if (!readable(x,y)) return false;
      }
    }
    return true;
  }
  for(let i=0;i<40;i++)for(let step=1;step<=4;step++){
    const a=i*TAU/40,r=g.radius*step/4;if(!readable(g.x+Math.cos(a)*r,g.y+Math.sin(a)*r))return false;
  }return true;
}
function circleAtPlayer(game, radius) {
  return { shape: 'circle', x: game.player.x, y: game.player.y, radius };
}
export function getEnemyApproachPoint(game, e) {
  const b=viewBounds(game),centre={x:(b.left+b.right)/2,y:(b.top+b.bottom)/2};
  if(e.abilityId==='faultwarden'&&faultSequence(e.abilityState?.phase||1)[e.abilityState?.index||0]==='sweep'){
    const candidates=[];
    for(const x of [centre.x,b.left+120,b.right-120])for(const y of [centre.y,b.top+120,b.bottom-120]){
      const g={shape:'sector',x,y,radius:120,width:110*Math.PI/180,angle:Math.atan2(game.player.y-y,game.player.x-x)};
      if(visible(game,g,e.radius||20)&&fits(game,g))candidates.push({x,y});
    }
    candidates.sort((a,c)=>dist(a,e)-dist(c,e));return candidates[0]||centre;
  }
  return centre;
}
function addHazard(game, e, type, geometry, duration, extra = {}) {
  const content = getEnemyContent(e.abilityId);
  const h = { id: game._nextId++, ownerId: e.id, type, move: e.abilityState?.move,
    ...geometry, remaining: duration, total: duration, life: duration, maxLife: duration,
    hostile: true, telegraph: type === 'warning', color: content?.color || '#ffa06b', ...extra };
  game.enemyHazards.push(h); return h;
}
function hurtTargets(game, geometry, amount, api, hitIds = null) {
  for (const t of targets(game)) {
    const key = t === game.player ? 'player' : t.id;
    if (hitIds?.has(key) || !pointHitsEnemyGeometry(t, geometry)) continue;
    hitIds?.add(key);
    if (t === game.player) api.hurtPlayer(amount); else api.hurtCompanion(t, amount);
  }
}
function clearType(game, ownerId, type) { game.enemyHazards = game.enemyHazards.filter(h => h.ownerId !== ownerId || h.type !== type); }
function warn(game, e, move, geometry, time) {
  const s = e.abilityState; s.move = move; s.geometry = geometry; s.remaining = time; s.total = time; s.stage = 'warning';
  addHazard(game, e, 'warning', geometry, time);
  e.anim = 'attack'; e.animTime = 0; e.animDuration = time;
  e.animHoldFrame = e.abilityId === 'faultwarden' ? (move === 'sweep' ? 4 : 7) : e.abilityId === 'cinderweaver' ? 15 : e.abilityId === 'laneGunner' ? 4 : null;
}
function rest(e, time, next) { Object.assign(e.abilityState, { stage: 'rest', move: 'recovery', remaining: time, total: time, next }); e.anim = 'idle'; e.animTime = 0; e.animHoldFrame = null; }

export function initEnemyAbility(game, e, abilityId) {
  if(initTrialBoss(game,e,abilityId))return true;
  const content = getEnemyContent(abilityId); if (!content) return false;
  e.abilityId = abilityId; e.kind = content.kind; e.name = e.name || content.name;
  e.abilityState = { stage: 'idle', move: 'approach', remaining: e.boss ? 1.3 : .9, total: e.boss ? 1.3 : .9, index: 0, phase: 1, waitForView: true, interruptedDamage: 0 };
  game.enemyHazards ||= []; return true;
}
export function cancelEnemyOwned(game, ownerId) {
  clearTrialOwned(game,ownerId);
  game.enemyHazards = (game.enemyHazards || []).filter(h => h.ownerId !== ownerId);
  game.enemyProjectiles = game.enemyProjectiles.filter(p => p.ownerId !== ownerId);
  const e = game.enemies.find(e => e.id === ownerId);
  if (e) { e.abilityState = null; e.attackWarning = null; e.bossState = null; }
}
export function clearEnemyAbilities(game) {
  for(const e of game.enemies)if(isTrialBoss(e))clearTrialOwned(game,e.id);
  game.enemyHazards = []; game.enemyProjectiles = [];
  for (const e of game.enemies) { e.abilityState = null; e.attackWarning = null; e.bossState = null; }
}
export function onEnemyDamaged(game, e, actual) {
  if(isTrialBoss(e)){damageTrialBoss(game,e,actual,{clearType});return;}
  const s = e.abilityState;
  if (e.abilityId !== 'blastBeetle' || s?.stage !== 'warning' || s.move !== 'detonate') return;
  s.interruptedDamage += actual;
  if (e.hp > 0 && s.interruptedDamage >= e.maxHp * .18) {
    clearType(game, e.id, 'warning'); rest(e, 1.2, 'cooldown'); s.interruptedDamage = 0; s.cooldown = 4.8;
    game.announcement = { text: '蓄爆已打断', remaining: 1.2 };
  }
}

function faultSequence(phase) { return phase === 2 ? ['wedge', 'sweep', 'wedge', 'fault'] : ['wedge', 'wedge', 'fault', 'sweep']; }
function beginFault(game, e) {
  const s = e.abilityState, move = faultSequence(s.phase)[s.index];
  if (move === 'wedge') { warn(game, e, move, circleAtPlayer(game, 48), 1.15); return true; }
  if (move === 'fault') {
    const marks = game.enemyHazards.filter(h => h.ownerId === e.id && h.type === 'scar');
    const a = marks.length > 1 ? marks[0] : e, b = marks.at(-1) || game.player;
    const length = Math.min(240, dist(a, b)), angle = Math.atan2(b.y - a.y, b.x - a.x);
    const g = { shape: 'line', x: a.x, y: a.y, toX: a.x + Math.cos(angle) * length, toY: a.y + Math.sin(angle) * length, width: 42, length, angle };
    if (!fits(game, g)) {
      // The player successfully left the marked area. Do not wait indefinitely
      // for an old offscreen corridor or move its already advertised anchors.
      clearType(game,e.id,'scar');s.index=0;rest(e,1.4,'attack');return true;
    }
    warn(game, e, move, g, 1.25); return true;
  }
  const g = { shape: 'sector', x: e.x, y: e.y, angle: Math.atan2(game.player.y - e.y, game.player.x - e.x), radius: 120, width: 110 * Math.PI / 180 };
  if (!fits(game, g)) return false;
  warn(game, e, move, g, 1); return true;
}
function phaseBoundary(game, e) {
  const s = e.abilityState;
  if (s.phase === 1 && e.hp / e.maxHp < .45) {
    // Finish the current attack, discard harmless marks, then show a full cue.
    s.phase = 2; s.index = 0; clearType(game, e.id, 'scar');clearType(game,e.id,'seed');
    s.stage = 'phase'; s.move = 'phaseChange'; s.remaining = 1; s.total = 1;
    addHazard(game, e, 'impact', { shape: 'circle', x: e.x, y: e.y, radius: e.radius + 18 }, 1, { hostile: false });
    game.announcement = { text: `${e.name} · 招式变阵`, remaining: 2 };
    return true;
  }
  return false;
}
function finishFault(game, e, api) {
  const s = e.abilityState, g = s.geometry, move = s.move;
  clearType(game, e.id, 'warning');
  hurtTargets(game, g, e.damage * (move === 'wedge' ? .8 : move === 'sweep' ? .85 : 1), api);
  addHazard(game, e, 'impact', g, move === 'fault' ? .35 : .45);
  if (move === 'wedge') {
    const marks = game.enemyHazards.filter(h => h.ownerId === e.id && h.type === 'scar');
    if (!marks.length || marks.every(m => dist(m, g) >= 80)) addHazard(game, e, 'scar', g, 30, { hostile: false });
  } else if (move === 'fault') clearType(game, e.id, 'scar');
  s.index = (s.index + 1) % faultSequence(s.phase).length;
  if (phaseBoundary(game, e)) return;
  rest(e, move === 'fault' ? 1.4 : move === 'sweep' ? 1.1 : .65, 'attack');
  e.anim = 'attack'; e.animTime = 1.2; e.animDuration = 2.3;
}

function cinderSequence(phase) { return phase === 2 ? ['sow', 'sow', 'ignite', 'emberRing'] : ['sow', 'sow', 'emberRing', 'ignite']; }
function activeEliteDanger(game, exceptId) {
  return game.enemies.some(e => !e.dead && !e.boss && e.id !== exceptId && e.abilityState?.stage === 'warning') ||
    game.enemyProjectiles.some(p => !p.hit && p.kind === 'laneShell');
}
function bossDanger(game) {
  const b = game.boss;
  return b && !b.dead && (b.abilityState?.stage === 'warning' || b.abilityState?.stage === 'ringActive');
}
function beginCinder(game, e) {
  const s = e.abilityState, move = cinderSequence(s.phase)[s.index];
  if (move === 'sow') {
    const g = circleAtPlayer(game, 38), seeds = game.enemyHazards.filter(h => h.ownerId === e.id && h.type === 'seed');
    if (seeds.length && dist(seeds[0], g) < 100) {
      const angle = Math.atan2(e.y - seeds[0].y, e.x - seeds[0].x);
      // Reserve readability for the later radius-66 ignition before publishing
      // this point. At the boundary, shortening/repeating is preferable to
      // moving an advertised point or cancelling every cycle at ignition.
      for(let offset=100;offset>=0;offset-=10){
        const x=clamp(seeds[0].x+Math.cos(angle)*offset,0,game.world.width),y=clamp(seeds[0].y+Math.sin(angle)*offset,0,game.world.height);
        if(fits(game,{shape:'circle',x,y,radius:66})){g.x=x;g.y=y;break;}
      }
    }
    warn(game, e, move, g, 1.1); return true;
  }
  if (move === 'emberRing') {
    const b = viewBounds(game), maximum = Math.min(180, e.x - b.left, b.right - e.x, e.y - b.top, b.bottom - e.y) - 11;
    if (maximum < 90) return false;
    const g = { shape: 'ring', x: e.x, y: e.y, radius: maximum + 11, width: 22, startRadius: 70, endRadius: maximum,
      innerRadius: 59, outerRadius: maximum + 11, gapAngle: Math.atan2(game.player.y - e.y, game.player.x - e.x), gapWidth: 100 * Math.PI / 180 };
    warn(game, e, move, g, 1.2); return true;
  }
  const seeds = game.enemyHazards.filter(h => h.ownerId === e.id && h.type === 'seed');
  const geometries = seeds.map(h => ({ shape: 'circle', x: h.x, y: h.y, radius: 66, seedId: h.id }));
  if (!geometries.every(g => fits(game, g))) {
    clearType(game,e.id,'seed');s.index=0;rest(e,1.6,'attack');return true;
  }
  // Even when a seed aged out, preserve the same advertised recovery beat.
  s.move = move; s.geometry = geometries; s.remaining = 1.2; s.total = 1.2; s.stage = 'warning';
  for (const g of geometries) addHazard(game, e, 'warning', g, 1.2);
  e.anim = 'attack'; e.animTime = 0; e.animDuration = 1.2; e.animHoldFrame = 15;
  return true;
}
function finishCinder(game, e, api) {
  const s = e.abilityState, move = s.move, g = s.geometry;
  clearType(game, e.id, 'warning'); e.animHoldFrame = null;
  if (move === 'sow') {
    const seeds = game.enemyHazards.filter(h => h.ownerId === e.id && h.type === 'seed');
    if (seeds.length >= 2) { const oldest = seeds[0]; game.enemyHazards = game.enemyHazards.filter(h=>h !== oldest); }
    addHazard(game, e, 'seed', g, 7, { damage: e.damage * .3, contacts: new Map() });
  } else if (move === 'emberRing') {
    addHazard(game, e, 'ring', { ...g, radius: 81, innerRadius: 59, outerRadius: 81 }, 1.1, { damage: e.damage * .9, hitIds: new Set(), elapsed: 0 });
    s.stage = 'ringActive'; s.remaining = 1.1; s.total = 1.1;
    e.anim = 'attack'; e.animTime = 3.1; e.animDuration = 4;
    return;
  } else {
    const hits = new Set();
    for (const geometry of g) {
      if(!game.enemyHazards.some(h=>h.type==='seed'&&h.id===geometry.seedId&&h.remaining>0))continue;
      hurtTargets(game, geometry, e.damage * .85, api, hits); addHazard(game, e, 'impact', geometry, .45);
    }
    clearType(game, e.id, 'seed');
  }
  s.index = (s.index + 1) % cinderSequence(s.phase).length;
  if (phaseBoundary(game, e)) return;
  rest(e, move === 'ignite' ? 1.6 : .65, 'attack');
  if(s.index===0)s.repositionPending=true;
  e.anim = 'attack'; e.animTime = move === 'ignite' ? 3.1 : 2.1; e.animDuration = 4;
}
function beginElite(game, e) {
  const s = e.abilityState;
  if (bossDanger(game) || activeEliteDanger(game, e.id)) return false;
  if (e.abilityId === 'kilnGuard') {
    if (game.enemyHazards.some(h=>h.type === 'aura' && h.remaining > 0)) return false;
    const g = { shape: 'circle', x: e.x, y: e.y, radius: 95 };
    if (!fits(game, g)) return false;
    warn(game, e, 'kiln', g, .8); e.animHoldFrame = 4; return true;
  }
  if (e.abilityId === 'blastBeetle') {
    if (dist(e, game.player) > 110 || !visible(game, e, 78)) return false;
    warn(game, e, 'detonate', { shape: 'circle', x: e.x, y: e.y, radius: 78 }, 1.5);
    s.interruptedDamage = 0; e.anim = 'explode'; e.animHoldFrame = 6; return true;
  }
  if (e.abilityId === 'laneGunner') {
    if (game.enemyProjectiles.filter(p=>p.kind === 'laneShell'&&!p.hit).length) return false;
    const angle = Math.atan2(game.player.y-e.y,game.player.x-e.x), b = viewBounds(game);
    const dx = Math.cos(angle), dy = Math.sin(angle), offset = 45;
    // Two radius-9 shells at +/-45 leave a 72-unit clear corridor.
    const lanes = [-1,1].map(sign => {
      const x = e.x - dy * offset * sign, y = e.y + dx * offset * sign;
      let length = Math.min(300, dist(e,game.player) + 60);
      if(dx>0)length=Math.min(length,(b.right-9-x)/dx);else if(dx<0)length=Math.min(length,(b.left+9-x)/dx);
      if(dy>0)length=Math.min(length,(b.bottom-9-y)/dy);else if(dy<0)length=Math.min(length,(b.top+9-y)/dy);
      return { shape:'line',x,y,toX:x+dx*length,toY:y+dy*length,width:18,length,angle };
    });
    if(lanes.some(g=>g.length<72 || !fits(game,g)))return false;
    s.move='salvo';s.geometry=lanes;s.stage='warning';s.remaining=.95;s.total=.95;
    for(const g of lanes)addHazard(game,e,'warning',g,.95);
    e.anim='attack';e.animTime=0;e.animDuration=.95;e.animHoldFrame=4;return true;
  }
  return false;
}
function finishElite(game,e,api) {
  const s=e.abilityState,g=s.geometry;clearType(game,e.id,'warning');e.animHoldFrame=null;
  if(e.abilityId==='kilnGuard'){
    addHazard(game,e,'aura',g,2.5,{hostile:false});s.stage='auraActive';s.remaining=2.5;s.total=2.5;
    e.anim='attack';e.animHoldFrame=4;return;
  }
  if(e.abilityId==='laneGunner'){
    for(const lane of g)game.enemyProjectiles.push({id:game._nextId++,ownerId:e.id,kind:'laneShell',resourceKey:'f2_flareslinger',x:lane.x,y:lane.y,
      vx:Math.cos(lane.angle)*155,vy:Math.sin(lane.angle)*155,radius:9,damage:e.damage,life:lane.length/155,maxLife:lane.length/155});
    rest(e,1.5,'cooldown');s.cooldown=3;e.anim='attack';e.animTime=.5;e.animDuration=2.5;return;
  }
  hurtTargets(game,g,e.damage*.8,api);addHazard(game,e,'impact',g,.5);
  // The regular death hook owns all rewards and cleanup. Only visual animation
  // changes afterward; there is never a posthumous bomb.
  api.damageEnemy(e,e.hp);e.anim='explode';e.animTime=1;e.animDuration=1.9;e.deathLife=.9;e.animHoldFrame=null;
}

export function updateEnemyAbility(game, e, dt, api) {
  if(isTrialBoss(e))return updateTrialBoss(game,e,dt,api,{viewBounds,visible,addHazard,clearType,hurtTargets});
  const s = e.abilityState; if (!s || e.dead) return false;
  // The new kits share the engine's freeze/slow clock, including windups.
  if (s.stage === 'warning') {
    s.remaining = Math.max(0, s.remaining - dt);
    for (const h of game.enemyHazards) if (h.ownerId === e.id && h.type === 'warning') h.remaining = h.life = s.remaining;
    if (s.remaining <= 0) {
      if (e.abilityId === 'faultwarden') finishFault(game, e, api);
      else if (e.abilityId === 'cinderweaver') finishCinder(game,e,api);
      else finishElite(game,e,api);
    }
    return true;
  }
  if (s.stage === 'ringActive' || s.stage === 'auraActive') {
    const type = s.stage === 'ringActive' ? 'ring' : 'aura';
    if (game.enemyHazards.some(h=>h.ownerId===e.id&&h.type===type&&h.remaining>0)) return true;
    if (type === 'ring') {
      s.index=(s.index+1)%cinderSequence(s.phase).length;
      if(phaseBoundary(game,e))return true;
      rest(e,s.index===0?1.6:1.1,'attack');
      if(s.index===0)s.repositionPending=true;
    } else { rest(e,2.7,'cooldown'); }
    return true;
  }
  if (s.stage === 'phase' || s.stage === 'rest') {
    s.remaining = Math.max(0, s.remaining - dt); if (s.remaining > 0) return true;
    s.stage = 'idle'; s.move = 'approach'; s.remaining = 0;
    if(s.next==='cooldown'&&s.cooldown){s.remaining=s.cooldown;s.cooldown=0;}
    if(s.repositionPending){
      s.repositionPending=false;s.move='reposition';s.remaining=.75;s.waitForView=false;
      const b=viewBounds(game),a=Math.atan2(e.y-game.player.y,e.x-game.player.x)+Math.PI/2;
      s.repositionPoint={x:clamp(e.x+Math.cos(a)*55,b.left+e.radius,b.right-e.radius),y:clamp(e.y+Math.sin(a)*55,b.top+e.radius,b.bottom-e.radius)};
    }
  }
  s.remaining = Math.max(0, s.remaining - dt);
  if (s.remaining > 0) return false;
  if (!visible(game, e)) { s.waitForView = true; return false; }
  if (e.abilityId === 'faultwarden') {
    if(activeEliteDanger(game,e.id))return false;
    const started = beginFault(game, e); s.waitForView = !started; return started;
  }
  if(e.abilityId==='cinderweaver'){
    if(activeEliteDanger(game,e.id))return false;
    const started=beginCinder(game,e);s.waitForView=!started;return started;
  }
  const started=beginElite(game,e);s.waitForView=!started;return started;
}

export function updateEnemyHazards(game, dt, api) {
  // Warnings are timed by their owner's slowed/frozen state above. Only actual
  // independent hazards and harmless tail frames advance with world time here.
  for (const h of game.enemyHazards) {
    if (!livingOwner(game, h.ownerId)) { h.life = h.remaining = 0; continue; }
    if (h.type === 'seed') {
      for(const t of targets(game)){const key=t===game.player?'player':t.id;const until=h.contacts.get(key)||0;
        if(until<=game.time&&pointHitsEnemyGeometry(t,h)){h.contacts.set(key,game.time+.8);if(t===game.player)api.hurtPlayer(h.damage);else api.hurtCompanion(t,h.damage);}}
    }
    if(h.type==='ring'){
      const previous=h.innerRadius;h.elapsed=Math.min(h.total,h.elapsed+dt);
      const r=h.startRadius+(h.endRadius-h.startRadius)*h.elapsed/h.total;
      h.radius=h.outerRadius=r+h.width/2;h.innerRadius=r-h.width/2;
      hurtTargets(game,{...h,innerRadius:Math.min(previous,h.innerRadius)},h.damage,api,h.hitIds);
    }
    if (h.type !== 'warning') { h.remaining -= dt; h.life = h.remaining; }
  }
  game.enemyHazards = game.enemyHazards.filter(h => h.remaining > 0);
  for(const e of game.enemies)e.kilnProtected=!e.dead&&!e.boss&&!e.elite&&game.enemyHazards.some(h=>h.type==='aura'&&h.ownerId!==e.id&&dist(e,h)<=h.radius);
}
