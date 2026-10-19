import { LEVEL, BUILDINGS, UNIT_TYPES } from './level.js';
import { Simulation } from './simulation.js';
import { loadArt, artURL, drawBattle, unitScreenPoint, nodeArtSize } from './battle-renderer.js';

const $ = selector => document.querySelector(selector);
const viewport = $('#viewport'), canvas = $('#terrain'), ctx = canvas.getContext('2d');
const mapCtx = $('#minimap').getContext('2d');
const sites = new Set(['castle', 'town', 'tower']);
const allowed = { castle: ['guard', 'archer', 'cavalry', 'siege'], town: ['guard', 'archer'], tower: ['guard', 'magic'] };
const ownerNames = { player: '我方', enemy: '赤旗军', rival: '冰谷军', neutral: '中立', ogre: '食人魔' };
const colors = { player: '#80e3c0', enemy: '#ee8d71', rival: '#b5afff', neutral: '#cec9a5' };
const portrait = matchMedia('(orientation: portrait)'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
let sim = new Simulation(), ready = false, paused = true, speed = 1, shown = false, previous = 0, uiClock = 0;
let selection = { nodeId: null, slotId: null, unitIds: [], spellAim: false }, multi = false;
let camera = { x: 0, y: 0, zoom: .7 }, width = 1, height = 1, dpr = 1;
let contextKey = '', toastTimer, menuPause = true, lastEvent = null, threatId = null, commandMark = null;
const buttons = new Map(), pointers = new Map();
let gesture = null, pinching = false, pinch = null, orderDrag = null;
const node = id => sim.state.nodes.find(n => n.id === id);
const unit = id => sim.state.units.find(u => u.id === id);
const slot = id => sim.state.slots.find(s => s.id === id);
const screen = p => ({ x: (p.x - camera.x) * camera.zoom, y: (p.y - camera.y) * camera.zoom });
const world = p => ({ x: p.x / camera.zoom + camera.x, y: p.y / camera.zoom + camera.y });
const local = e => { const r = viewport.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const notify = text => { $('#toast').textContent = text; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2300); };
const picture = (key, soldier = false) => `<img src="${artURL(key)}" alt="" class="${soldier ? 'soldier-icon' : ''}" draggable="false">`;
const orderAvatar = $('#order-drag-avatar');

function boundedZoom(value) {
  const minimum = Math.max(.52, width / LEVEL.world.width, height / LEVEL.world.height);
  return Math.max(minimum, Math.min(Math.max(1.05, minimum), value));
}
function clampCamera() {
  camera.zoom = boundedZoom(camera.zoom);
  camera.x = Math.max(0, Math.min(LEVEL.world.width - width / camera.zoom, camera.x));
  camera.y = Math.max(0, Math.min(LEVEL.world.height - height / camera.zoom, camera.y));
}
function centerOn(p, start = false) {
  camera.x = p.x - width * (start ? .34 : .5) / camera.zoom;
  camera.y = p.y - height * (start ? .80 : .56) / camera.zoom;
  clampCamera(); renderTargets();
}
function resize() {
  const r = viewport.getBoundingClientRect();
  width = Math.max(1, r.width); height = Math.max(1, r.height); dpr = Math.min(devicePixelRatio || 1, 3);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
  clampCamera(); if (ready) { renderTargets(); positionContext(); }
}
new ResizeObserver(resize).observe(viewport);
function clearSelection() { selection = { nodeId: null, slotId: null, unitIds: [], spellAim: false }; multi = false; contextKey = ''; update(); }
function inspect(kind, id) {
  selection = { nodeId: kind === 'node' ? id : null, slotId: kind === 'slot' ? id : null, unitIds: [], spellAim: false };
  multi = false; contextKey = ''; update();
}
function selectUnit(id) {
  const u = unit(id); if (!u || u.owner !== 'player') return;
  const current = selection.unitIds;
  selection = { nodeId: null, slotId: null, spellAim: false, unitIds: multi ? (current.includes(id) ? current.filter(v => v !== id) : [...current, id]) : [id] };
  contextKey = ''; update();
}
function issue(target, unitIds = selection.unitIds) {
  const result = sim.command({ type: 'move', unitIds, target });
  if (result.ok) {
    const p = target.nodeId ? node(target.nodeId) : sim.projectRoad(target.x, target.y);
    commandMark = p && { x: p.x, y: p.y, until: performance.now() + 900 };
    clearSelection();
  }
  notify(result.message);
}
function mapTap(target, point) {
  if (!ready || sim.state.winner || portrait.matches) return;
  if (selection.spellAim) {
    const result = sim.command({ type: 'heal', ...world(point) }); notify(result.message);
    if (result.ok) clearSelection(); return;
  }
  const el = target?.closest('[data-unit],[data-node],[data-slot]');
  if (el?.dataset.unit) {
    const u = unit(el.dataset.unit); if (!u) return;
    if (u.owner === 'player') {
      // Whole squads can meet on one road point. Repeated taps cycle overlapping
      // squads; additive selection prefers one not already selected.
      const hit = unitScreenPoint(u,sim.state,camera);
      const nearby = u.garrisoned ? [u] : sim.state.units.filter(v => {const p=unitScreenPoint(v,sim.state,camera);return v.owner === 'player' && !v.garrisoned && Math.hypot(p.x-hit.x,p.y-hit.y) < 20;});
      const index = nearby.findIndex(v => selection.unitIds.includes(v.id));
      const next = multi ? nearby.find(v => !selection.unitIds.includes(v.id)) || u : nearby[(index+1)%nearby.length];
      selectUnit(next.id);
    }
    else if (selection.unitIds.length) issue({ x: u.x, y: u.y });
    else notify(`${u.owner === 'ogre' ? '食人魔' : UNIT_TYPES[u.kind].name} · ${Math.ceil(u.hp)} 生命`);
  } else if (el?.dataset.node) {
    if (selection.unitIds.length) issue({ nodeId: el.dataset.node });
    else inspect('node', el.dataset.node);
  } else if (el?.dataset.slot) {
    if (selection.unitIds.length) issue({ nodeId: slot(el.dataset.slot).hostId });
    else inspect('slot', el.dataset.slot);
  } else if (selection.unitIds.length) issue(world(point));
  else clearSelection();
}

function clearOrderDrag() {
  orderDrag = null; orderAvatar.hidden = true; orderAvatar.classList.remove('invalid');
  viewport.classList.remove('order-dragging');
  for (const button of buttons.values()) button.classList.remove('order-hover', 'order-invalid');
}
function orderCandidate(point) {
  const rect = viewport.getBoundingClientRect();
  const surface = document.elementFromPoint(rect.left + point.x, rect.top + point.y);
  if (point.x < 0 || point.y < 0 || point.x > width || point.y > height || !surface?.closest('#viewport') || surface.closest('#context')) {
    return { target: null, preview: null, button: null, valid: false, reason: '已取消移动，请将军团拖到战场目标。' };
  }
  const hit = surface.closest('[data-node],[data-slot]');
  let target = null, preview = null, button = null;
  if (hit?.dataset.node) { preview = node(hit.dataset.node); target = preview && { nodeId: preview.id }; button = hit; }
  else if (hit?.dataset.slot) { const host = slot(hit.dataset.slot) && node(slot(hit.dataset.slot).hostId); preview = host; target = host && { nodeId: host.id }; button = hit; }
  else { const aim = world(point), projected = sim.projectRoad(aim.x, aim.y); if (projected) { preview = projected; target = { x: projected.x, y: projected.y }; } }
  const troops = orderDrag?.unitIds.map(unit).filter(Boolean) || [];
  const locked = troops.some(u => u.locked || u.meleeTarget);
  const destination = target?.nodeId ? sim.navigation.atNode(target.nodeId) : preview;
  const paths = troops.map(troop => {
    const start = sim.projectRoad(troop.x, troop.y);
    return start && destination ? sim.navigation.route(start, destination) : null;
  });
  const path = paths[troops.findIndex(troop => troop.id === orderDrag.sourceId)]?.points;
  return { target, preview, button, path, valid: Boolean(target) && troops.length === orderDrag.unitIds.length && paths.every(Boolean) && !locked && !sim.state.winner, reason: locked ? '近战中的编队无法改令。' : '目标不在可通行道路上。' };
}
function refreshOrderDrag() {
  if (!orderDrag) return;
  for (const button of buttons.values()) button.classList.remove('order-hover', 'order-invalid');
  orderDrag.candidate = orderCandidate(orderDrag.point);
  const candidate = orderDrag.candidate;
  if (candidate.button) candidate.button.classList.add(candidate.valid ? 'order-hover' : 'order-invalid');
  orderAvatar.style.left = `${orderDrag.point.x}px`; orderAvatar.style.top = `${orderDrag.point.y}px`;
  orderAvatar.classList.toggle('invalid', !candidate.valid);
}
function beginOrderDrag(gestureState, point) {
  const dragged = unit(gestureState.unitId); if (!dragged) return;
  const selected = selection.unitIds.filter(id => unit(id)?.owner === 'player');
  const unitIds = selected.includes(dragged.id) ? selected : [dragged.id];
  selection = { nodeId: null, slotId: null, spellAim: false, unitIds }; multi = false; contextKey = '';
  orderDrag = { pointerId: gestureState.id, sourceId: dragged.id, unitIds, point, candidate: null };
  orderAvatar.querySelector('span').innerHTML = picture(dragged.kind);
  orderAvatar.querySelector('b').textContent = unitIds.length > 1 ? unitIds.length : '';
  orderAvatar.hidden = false; viewport.classList.add('order-dragging'); update(); refreshOrderDrag();
}

// A gesture starting on a friendly squad becomes an order drag; a gesture
// starting elsewhere keeps the map-pan behavior. A second pointer always wins.
viewport.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.target.closest('#context') || !ready) return;
  $('#army-roster').hidden=true;
  e.preventDefault(); viewport.setPointerCapture(e.pointerId);
  const p = local(e), hitUnit = e.target.closest('[data-unit]')?.dataset.unit, troop = unit(hitUnit);
  pointers.set(e.pointerId, p);
  if (pointers.size === 1) gesture = { id: e.pointerId, start: p, previous: p, target: e.target, dragged: false, unitId: troop?.owner === 'player' ? troop.id : null };
  else if (pointers.size === 2) {
    clearOrderDrag(); pinching = true;
    const [a, b] = [...pointers.values()]; const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: camera.zoom, world: world(center) };
    selection.nodeId = null; selection.slotId = null; contextKey = ''; update();
  }
});
viewport.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  const p = local(e); pointers.set(e.pointerId, p);
  if (pinching && pointers.size >= 2 && pinch) {
    const [a, b] = [...pointers.values()], center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    camera.zoom = boundedZoom(pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.distance));
    camera.x = pinch.world.x - center.x / camera.zoom; camera.y = pinch.world.y - center.y / camera.zoom;
    clampCamera(); renderTargets(); return;
  }
  if (!gesture || pinching || gesture.id !== e.pointerId) return;
  if (!gesture.dragged && Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > 7) {
    gesture.dragged = true;
    if (gesture.unitId) beginOrderDrag(gesture, p);
    else { selection.nodeId = null; selection.slotId = null; contextKey = ''; update(); }
  }
  if (gesture.dragged && orderDrag) { orderDrag.point = p; refreshOrderDrag(); }
  else if (gesture.dragged) { camera.x -= (p.x - gesture.previous.x) / camera.zoom; camera.y -= (p.y - gesture.previous.y) / camera.zoom; clampCamera(); renderTargets(); }
  gesture.previous = p;
});
function endPointer(e, cancelled) {
  if (!pointers.has(e.pointerId)) return;
  const p = local(e), wasPinching = pinching;
  if (!cancelled && !wasPinching && orderDrag?.pointerId === e.pointerId) {
    orderDrag.point = p; refreshOrderDrag();
    const { candidate, unitIds } = orderDrag; clearOrderDrag();
    if (candidate.valid) issue(candidate.target, unitIds); else notify(candidate.reason);
  } else if (!cancelled && !wasPinching && gesture?.id === e.pointerId && !gesture.dragged) mapTap(gesture.target, p);
  else if (orderDrag?.pointerId === e.pointerId) clearOrderDrag();
  pointers.delete(e.pointerId);
  if (!pointers.size) { gesture = null; pinch = null; pinching = false; clearOrderDrag(); }
}
viewport.addEventListener('pointerup', e => endPointer(e, false));
viewport.addEventListener('pointercancel', e => endPointer(e, true));
$('#world-targets').addEventListener('click', e => { if (e.detail === 0) { const r = e.target.closest('button')?.getBoundingClientRect(), root = viewport.getBoundingClientRect(); if (r) mapTap(e.target, { x: r.x - root.x + r.width / 2, y: r.y - root.y + r.height / 2 }); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { clearOrderDrag(); gesture=null; clearSelection(); } });

function entityButton(key, dataKey, id) {
  if (buttons.has(key)) return buttons.get(key);
  const button = document.createElement('button'); button.dataset[dataKey] = id;
  button.innerHTML = '<span class="name"></span>'; $('#world-targets').append(button); buttons.set(key, button); return button;
}
function place(button, p, size = 100) {
  button.hidden = p.x < -size || p.x > width + size || p.y < -size || p.y > height + size;
  button.style.left = `${p.x}px`; button.style.top = `${p.y}px`;
}
function renderTargets() {
  if (!ready) return;
  const live = new Set();
  for (const n of sim.state.nodes) {
    if (!sites.has(n.kind) && n.kind !== 'chest') continue;
    if (n.kind === 'chest' && n.owner !== 'neutral') continue;
    const key = `n:${n.id}`, b = entityButton(key, 'node', n.id); live.add(key);
    b.className = `world-target ${n.kind === 'chest' ? 'chest' : 'site'}${selection.nodeId === n.id ? ' inspected' : ''}${selection.unitIds.length && n.kind !== 'chest' ? ' destination' : ''}`;
    const artSize = nodeArtSize(n);
    b.style.width = `${Math.max(44, artSize.width * camera.zoom)}px`;
    b.style.height = `${Math.max(44, artSize.height * camera.zoom)}px`;
    b.setAttribute('aria-label', `${n.name}，${ownerNames[n.owner]}`); b.querySelector('.name').textContent = n.name; place(b, screen(n));
  }
  for (const s of sim.state.slots) {
    const key = `s:${s.id}`, b = entityButton(key, 'slot', s.id); live.add(key);
    const host = node(s.hostId), available = host.owner === 'player' && host.hp > 0 && !s.building;
    b.className = `world-target slot${available ? ' available' : ''}${selection.slotId === s.id ? ' inspected' : ''}`;
    b.setAttribute('aria-label', `${host.name}资源位，${s.building ? BUILDINGS[s.building.type].name : available ? '可以建造' : '占领据点后解锁'}`);
    b.querySelector('.name').textContent = `${host.name} · ${s.building ? BUILDINGS[s.building.type].name : '空位'}`; place(b, screen(s));
  }
  for (const u of sim.state.units) {
    const key = `u:${u.id}`, b = entityButton(key, 'unit', u.id); live.add(key);
    b.className = `world-target unit${u.garrisoned ? ' garrison' : ''}${selection.unitIds.includes(u.id) ? ' selected' : ''}`;
    b.setAttribute('aria-label', `${ownerNames[u.owner]}${u.owner === 'ogre' ? '' : UNIT_TYPES[u.kind].name}编队${u.garrisoned ? '，驻防中' : ''}`);
    let p = unitScreenPoint(u,sim.state,camera);
    if (u.garrisoned) {
      const group = sim.state.units.filter(v => v.garrisoned && v.nodeId === u.nodeId), i = group.findIndex(v => v.id === u.id);
      const host = node(u.nodeId); p = screen(host);
      // Keep the soldiers beside their fort, not above the top edge of the screen.
      const column=Math.floor(i/3), row=i%3, rows=Math.min(3,group.length), side=p.x>170?-1:1;
      let top=p.y-26-(rows-1)*46;
      if(p.y>=0&&p.y<=height&&p.x>=0&&p.x<=width)top=Math.max(76,Math.min(height-76-(rows-1)*46,top));
      p.x+=side*(77+column*46); p.y=top+row*46;
      if (!b.querySelector('img')) b.innerHTML = `${picture(u.kind)}<small class="count"></small>`;
      b.querySelector('.count').textContent = Math.max(1, Math.ceil((u.soldiers || 1) * u.hp / u.maxHp));
    } else if (b.querySelector('img')) b.innerHTML = '<span class="name"></span>';
    place(b, p, 70);
  }
  for (const [key, button] of buttons) if (!live.has(key)) { button.remove(); buttons.delete(key); }
}

function action({ attr, art, icon, name, note, soldier = false }) {
  return `<button class="action" ${attr} aria-label="${name}，${note}"><span class="action-art">${art ? picture(art, soldier) : `<i>${icon}</i>`}</span><strong>${name}</strong><small>${note}</small></button>`;
}
function updateContext() {
  const n = node(selection.nodeId), s = slot(selection.slotId), current = n || s;
  $('#context').hidden = !current;
  if (!current) return;
  const host = n || node(s.hostId), owned = host.owner === 'player' && host.hp > 0;
  const key = JSON.stringify([selection.nodeId, selection.slotId, host.owner, host.hp > 0, host.level, s?.building, sim.state.winner]);
  if (key !== contextKey) {
    contextKey = key; let actions = [];
    if (n && sites.has(n.kind) && owned) {
      actions = allowed[n.kind].map(kind => action({ attr: `data-recruit="${kind}"`, art: kind, name: UNIT_TYPES[kind].name, note: `${UNIT_TYPES[kind].cost}金 · ${UNIT_TYPES[kind].supply}编`, soldier: true }));
      const cost = sim.upgradeCost(n.id);
      if (cost !== null) actions.push(action({ attr: 'data-upgrade', icon: '↑', name: '升级城防', note: `${cost}金` }));
    } else if (s && owned && !s.building) {
      actions = Object.entries(BUILDINGS).map(([kind, spec]) => action({ attr: `data-build="${kind}"`, art: kind, name: spec.name, note: `${spec.cost}金 · ${kind === 'mine' ? '+2金/s' : kind === 'farm' ? '+1编制' : '+1法力/s'}` }));
    }
    $('#context-actions').innerHTML = actions.join('');
  }
  $('#context-name').textContent = n ? n.name : s.building ? BUILDINGS[s.building.type].name : '建造资源建筑';
  $('#context-note').textContent = n ? n.kind === 'chest' ? '抵达获得500金币' : `${ownerNames[n.owner]} · ${Math.ceil(n.hp)}/${n.maxHp}` : owned ? s.building ? `${host.name} · 持续产出` : `属于${host.name}` : `占领${host.name}后解锁`;
  $('#context-actions').querySelectorAll('button').forEach(b => {
    let reason = '';
    if (b.dataset.recruit) reason = sim.recruitQuote(n.id, b.dataset.recruit).message;
    if (b.dataset.build && sim.state.gold.player < BUILDINGS[b.dataset.build].cost) reason = '金币不足';
    if (b.hasAttribute('data-upgrade') && sim.state.gold.player < sim.upgradeCost(n.id)) reason = '金币不足';
    b.dataset.reason = reason; b.classList.toggle('unavailable', Boolean(reason)); b.setAttribute('aria-disabled', String(Boolean(reason) || Boolean(sim.state.winner)));
  });
  positionContext();
}
function positionContext() {
  const current = node(selection.nodeId) || slot(selection.slotId); if (!current || $('#context').hidden) return;
  const p = screen(current), box = $('#context'), r = box.getBoundingClientRect();
  const bw = Math.max(r.width, $('#context-actions').scrollWidth), bh = r.height;
  const viewRect = viewport.getBoundingClientRect(), hudRect = $('.hud').getBoundingClientRect();
  const left = hudRect.left-viewRect.left, right = hudRect.right-viewRect.left;
  const top = hudRect.bottom-viewRect.top+6;
  const candidates = [{x:p.x+65,y:p.y-90},{x:p.x-bw-65,y:p.y-90},{x:p.x-bw/2,y:p.y-bh-145},{x:p.x-bw/2,y:p.y+24}];
  const reserved = ['.navigation-tools','.battle-tools'].map(selector=>{const r=$(selector).getBoundingClientRect();return{x:r.left-viewRect.left-4,y:r.top-viewRect.top-4,w:r.width+8,h:r.height+8};});
  const overlap = (a,b) => Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  const choices = candidates.map(c => { const q = { x:Math.max(left,Math.min(right-bw,c.x)), y:Math.max(top,Math.min(height-bh-8,c.y)), w:bw,h:bh }; return {...q,score:Math.hypot(q.x-c.x,q.y-c.y)*10+overlap(q,{x:p.x-58,y:p.y-125,w:116,h:145})+reserved.reduce((a,b)=>a+overlap(q,b),0)}; });
  const best = choices.sort((a,b)=>a.score-b.score)[0]; box.style.left=`${best.x}px`;box.style.top=`${best.y}px`;
}
$('#context-actions').onclick = e => {
  const b = e.target.closest('button'); if (!b || sim.state.winner) return;
  if (b.dataset.reason) { notify(b.dataset.reason); return; }
  let a;
  if (b.dataset.recruit) a = { type:'recruit',nodeId:selection.nodeId,kind:b.dataset.recruit };
  if (b.dataset.build) a = { type:'build',slotId:selection.slotId,building:b.dataset.build };
  if (b.hasAttribute('data-upgrade')) a = { type:'upgrade',nodeId:selection.nodeId };
  if (!a) return;
  const result=sim.command(a);notify(result.message);contextKey='';
  if(result.ok && a.type==='build') clearSelection(); else update();
};
$('#context-close').onclick = clearSelection;
$('#army-status').onclick = () => {
  $('#army-roster').hidden=!$('#army-roster').hidden;
  updateRoster();
};
$('#roster-close').onclick=()=>$('#army-roster').hidden=true;
$('#roster-units').onclick=e=>{
  const id=e.target.closest('[data-roster-unit]')?.dataset.rosterUnit,u=unit(id);if(!u)return;
  $('#army-roster').hidden=true;centerOn(u);selectUnit(id);
};
function updateRoster(){
  if($('#army-roster').hidden)return;
  const alive=sim.state.units.filter(u=>u.owner==='player'&&u.hp>0);
  const key=JSON.stringify(alive.map(u=>[u.id,u.garrisoned,u.nodeId]));
  if($('#roster-units').dataset.key===key)return;
  $('#roster-units').dataset.key=key;
  $('#roster-units').innerHTML=alive.length?alive.map(u=>`<button data-roster-unit="${u.id}">${picture(u.kind)}<span>${UNIT_TYPES[u.kind].name}<small>${u.garrisoned?'驻防 · '+node(u.nodeId).name:'野外行动'}</small></span><b>${UNIT_TYPES[u.kind].supply}编</b></button>`).join(''):'<p>暂无编队，可在己方据点招募。</p>';
}
$('#clear-selection').onclick = clearSelection;
$('#multi').onclick = () => { multi=!multi;update(); };
$('#select-nearby').onclick = () => {
  const ids=sim.state.units.filter(u=>{const p=screen(u);return u.owner==='player'&&p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height;}).map(u=>u.id);
  if(!ids.length){notify('当前视野没有己方编队');return;}
  selection={nodeId:null,slotId:null,unitIds:ids,spellAim:false};multi=false;contextKey='';update();
};
$('#return-home').onclick = () => {
  const first=unit(selection.unitIds[0]);if(!first)return;
  const home=sim.state.nodes.filter(n=>sites.has(n.kind)&&n.owner==='player'&&n.hp>0).sort((a,b)=>Math.hypot(a.x-first.x,a.y-first.y)-Math.hypot(b.x-first.x,b.y-first.y))[0];
  if(home)issue({nodeId:home.id});
};
$('#heal').onclick = () => { const aim=!selection.spellAim;clearSelection();selection.spellAim=aim;update(); };
$('#home').onclick = () => { clearSelection();centerOn(node(LEVEL.playerBaseId),true); };
$('#overview').onclick = e => { const r=e.currentTarget.getBoundingClientRect();const p={x:(e.clientX-r.left)/r.width*LEVEL.world.width,y:(e.clientY-r.top)/r.height*LEVEL.world.height};if(e.detail===0)centerOn(node(LEVEL.playerBaseId),true);else{selection.nodeId=null;selection.slotId=null;contextKey='';centerOn(p);update();} };
$('#threat').onclick = () => { if(threatId) { clearSelection();centerOn(node(threatId)); } };

function drawMinimap() {
  const sx=116/LEVEL.world.width,sy=76/LEVEL.world.height;
  mapCtx.fillStyle='#273921';mapCtx.fillRect(0,0,116,76);mapCtx.strokeStyle='#748366';mapCtx.lineWidth=.7;
  for(const road of LEVEL.roads){mapCtx.beginPath();road.points.forEach((p,i)=>i?mapCtx.lineTo(p.x*sx,p.y*sy):mapCtx.moveTo(p.x*sx,p.y*sy));mapCtx.stroke();}
  for(const n of sim.state.nodes)if(sites.has(n.kind)){mapCtx.fillStyle=colors[n.owner];mapCtx.fillRect(n.x*sx-2,n.y*sy-2,4,4);}
  mapCtx.strokeStyle='#fff1b2';mapCtx.lineWidth=1;mapCtx.strokeRect(camera.x*sx,camera.y*sy,width/camera.zoom*sx,height/camera.zoom*sy);
}
function edgeScrollOrder(dt) {
  if (!orderDrag || dt <= 0) return;
  const edge = 46, p = orderDrag.point;
  const axis = (value, limit) => value < edge ? -(edge - value) / edge : value > limit - edge ? (value - (limit - edge)) / edge : 0;
  const dx = axis(p.x, width), dy = axis(p.y, height); if (!dx && !dy) return;
  const oldX = camera.x, oldY = camera.y, speed = 300 / camera.zoom;
  camera.x += dx * speed * dt; camera.y += dy * speed * dt; clampCamera();
  if (camera.x !== oldX || camera.y !== oldY) { renderTargets(); refreshOrderDrag(); }
}
function drawOrderPreview() {
  if (!orderDrag) return;
  const source = unit(orderDrag.sourceId), candidate = orderDrag.candidate;
  if (!source || !candidate) return;
  const from = unitScreenPoint(source, sim.state, camera);
  const to = candidate.preview ? screen(candidate.preview) : orderDrag.point;
  ctx.save(); ctx.strokeStyle = candidate.valid ? '#ffe28b' : '#ef826d'; ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 3; ctx.setLineDash([9, 7]); ctx.beginPath(); ctx.moveTo(from.x, from.y);
  if (candidate.path?.length) {
    for (const waypoint of candidate.path) { const p = screen(waypoint); ctx.lineTo(p.x, p.y); }
  } else ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = .22; ctx.beginPath(); ctx.arc(to.x, to.y, 19, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(to.x, to.y, 19, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
function update() {
  selection.unitIds=selection.unitIds.filter(id=>unit(id)?.owner==='player');
  $('#gold').textContent=Math.floor(sim.state.gold.player);$('#mana').textContent=Math.floor(sim.state.mana.player);
  const pop=sim.population('player');$('#population').textContent=`${pop.used}/${pop.cap}`;$('#income').textContent=`+${sim.income('player').gold}/s`;
  $('#pause').textContent=paused?(sim.state.time===0?'开战':'继续'):'暂停';
  $('#selection-bar').hidden=!selection.unitIds.length;$('#selection-label').textContent=selection.unitIds.length===1?`${UNIT_TYPES[unit(selection.unitIds[0]).kind].name} · ${unit(selection.unitIds[0]).locked?'接战中':'拖到目标'}`:`已选 ${selection.unitIds.length} 队 · 拖动下令`;
  $('#multi').setAttribute('aria-pressed',String(multi));$('#heal').classList.toggle('active',selection.spellAim);
  const engaged=sim.state.nodes.find(n=>sites.has(n.kind)&&n.owner==='player'&&sim.state.units.some(u=>!u.garrisoned&&u.owner!=='player'&&Math.hypot(u.x-n.x,u.y-n.y)<190));
  threatId=engaged?.id||null;$('#threat').hidden=!engaged;$('#threat').textContent=engaged?`${engaged.name}遇袭 · 点击查看`:'';
  $('#instruction').hidden=Boolean(selection.nodeId||selection.slotId||selection.unitIds.length||(!paused&&!selection.spellAim));
  $('#instruction').textContent=selection.spellAim?'点地图放置治疗旗 · 再点✚取消':sim.state.time===0?'拖军团到道路或据点 · 拖空地查看周边':'战斗已暂停 · 仍可拖军团规划';
  updateContext();renderTargets();updateRoster();
  // Events are a bounded queue; track the last object, not the queue length.
  for(const event of sim.state.events.slice(sim.state.events.indexOf(lastEvent)+1)){if(event.text.includes('被占领'))notify(event.text);}lastEvent=sim.state.events.at(-1);
  if(sim.state.winner&&!shown){shown=true;paused=true;$('#result-title').textContent=sim.state.winner==='player'?'三方战场，尽入疆域':'我方据点失守';$('#result-copy').textContent=`战斗用时 ${Math.floor(sim.state.time/60)}分${Math.floor(sim.state.time%60)}秒。`;$('#result').showModal();}
}
function start() { clearOrderDrag();sim=new Simulation();shown=false;paused=true;speed=1;$('#speed').textContent='1×';lastEvent=null;clearSelection();camera.zoom=.7;centerOn(node(LEVEL.playerBaseId),true);update(); }
$('#pause').onclick=()=>{if(!sim.state.winner&&!portrait.matches){paused=!paused;update();}};
$('#speed').onclick=()=>{speed=speed===1?2:1;$('#speed').textContent=`${speed}×`;};
$('#menu').onclick=()=>{menuPause=paused;paused=true;$('#guide').showModal();update();};
$('#guide-close').onclick=()=>{$('#guide').close();paused=menuPause;update();};
$('#guide').oncancel=()=>{paused=menuPause;update();};
$('#restart').onclick=()=>{$('#guide').close();$('#confirm-restart').showModal();};
$('#cancel-new').onclick=()=>{$('#confirm-restart').close();paused=menuPause;update();};
$('#confirm-restart').oncancel=()=>{paused=menuPause;update();};
$('#confirm-new').onclick=()=>{$('#confirm-restart').close();start();};
$('#again').onclick=()=>{$('#result').close();start();};$('#view-map').onclick=()=>$('#result').close();
portrait.addEventListener('change',()=>{paused=true;pointers.clear();gesture=null;pinch=null;pinching=false;clearOrderDrag();if(ready)update();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){paused=true;pointers.clear();gesture=null;pinch=null;pinching=false;clearOrderDrag();if(ready)update();}});
function frame(now){
  const dt=previous?Math.min(.1,(now-previous)/1000):0;previous=now;
  if(ready){if(!paused&&!portrait.matches)sim.step(dt*speed);edgeScrollOrder(dt);ctx.setTransform(dpr,0,0,dpr,0,0);drawBattle(ctx,width,height,sim.state,selection,reduced.matches,camera);drawOrderPreview();renderTargets();if(orderDrag)refreshOrderDrag();drawMinimap();
    if(commandMark&&now<commandMark.until){const p=screen(commandMark);ctx.strokeStyle='#ffe6a2';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,14,0,Math.PI*2);ctx.stroke();}
    uiClock+=dt;if(uiClock>.15){uiClock=0;update();}
  }requestAnimationFrame(frame);
}
resize();
loadArt().then(()=>{ready=true;$('#loading').hidden=true;centerOn(node(LEVEL.playerBaseId),true);update();}).catch(e=>{$('#loading').textContent='素材加载失败，请刷新重试';console.error(e);});
requestAnimationFrame(frame);
