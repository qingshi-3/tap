import assert from 'node:assert/strict';
import { createBattleCommandPreview } from '../dist/js/battle-command-preview.js';
import { createChallengeMatch, battleCommandTargets, useBattleCommand, restoreMatch, effectiveAttack } from '../dist/js/engine.js';

// Exercise the production gesture callbacks and rules without a browser or save writes.
class Node {
  handlers = new Map(); attributes = new Map(); children = new Map();
  hidden = false; disabled = false; dataset = {}; offsetWidth = 220; offsetHeight = 300;
  style = { setProperty() {} }; captured = null;
  addEventListener(type, callback) { const list = this.handlers.get(type) || []; list.push(callback); this.handlers.set(type, list); }
  fire(type, fields = {}) { for (const callback of this.handlers.get(type) || []) callback({ target: this, isPrimary: true, button: 0, pointerId: 1, clientX: 100, clientY: 100, detail: 1, preventDefault() {}, ...fields }); }
  append() {} setAttribute(key, value) { this.attributes.set(key, value); }
  querySelector(key) { if (!this.children.has(key)) this.children.set(key, new Node()); return this.children.get(key); }
  getContext() { return { clearRect() {}, drawImage() {} }; }
  getBoundingClientRect() { return { left: 600, top: 300, bottom: 360, width: 60, height: 60 }; }
  contains(target) { return target === this; } focus() {}
  setPointerCapture(id) { this.captured = id; }
  hasPointerCapture(id) { return this.captured === id; }
  releasePointerCapture() { this.captured = null; this.fire('lostpointercapture'); }
}
const created=[];
globalThis.document = new Node(); document.body = new Node(); document.createElement = () => {const node=new Node();created.push(node);return node;};
globalThis.window = new Node(); globalThis.innerWidth = 844; globalThis.innerHeight = 390;
let timer = null;
const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout;
globalThis.setTimeout = callback => (timer = callback);
globalThis.clearTimeout = () => { timer = null; };
try {
  const button = new Node(); let state, selected, confirms, drops, cancels, aims;
  const target = () => state.units.find(unit => unit.cardId === 14);
  const read = () => ({ battleKey: state, interactionKey: `${state.runId}:${state.round}:${state.currentPlayer}:${state.phase}`,
    visible: true, available: battleCommandTargets(state).available, selected, targetType: battleCommandTargets(state).type,
    name: '狮王怒吼', cost: 1, faction: 1, description: '友方随从增加2攻击。每回合1次。' });
  const controller = createBattleCommandPreview({ button, read,
    onOpen() { selected = false; controller.sync(); },
    onConfirm() { confirms++;selected = true;
      if(battleCommandTargets(state).type==='self'){assert.equal(useBattleCommand(state,null),true);selected=false;}
      controller.sync(); },
    onCancel() { cancels++; selected = false; }, onAim() { aims++; },
    onDrop() { drops++; assert.equal(useBattleCommand(state, battleCommandTargets(state).type==='self'?null:target().unitId), true); selected = false; }
  });
  const panel=created[0];
  function fresh(restored = false) {
    state = createChallengeMatch('command-before-attack');
    if (restored) state = restoreMatch(JSON.parse(JSON.stringify(state)));
    selected = false; confirms = drops = cancels = aims = 0; controller.close();
  }
  function tap() { button.fire('pointerdown'); button.fire('pointerup'); button.fire('click'); }
  for (const restored of [false, true]) {
    fresh(restored); tap();
    assert.equal(selected, false); assert.equal(confirms, 0); assert.equal(state.players[0].mana, 1);
    assert.equal(button.attributes.get('aria-expanded'), 'true');
    button.fire('keydown',{key:'Enter'});
    assert.equal(selected,true);assert.equal(confirms,1);
    assert.equal(useBattleCommand(state, target().unitId), true);
    assert.equal(state.players[0].mana, 0); assert.equal(effectiveAttack(state, target()), 3);
    state = restoreMatch(JSON.parse(JSON.stringify(state)));
    assert.equal(state.players[0].bbsUsed, true);
    state.players[0].mana = 1;
    assert.equal(battleCommandTargets(state).available, false, 'save/resume preserves the once-per-turn limit even with mana');
    assert.equal(useBattleCommand(state, target().unitId), false);
  }
  fresh(); button.fire('pointerdown'); button.fire('pointermove', { clientX: 130 });
  assert.equal(button.hasPointerCapture(1), true); assert.equal(selected, true);
  button.fire('pointerup', { clientX: 200 }); button.fire('click');
  assert.deepEqual([confirms, aims, drops, cancels], [1, 1, 1, 0]); assert.equal(state.players[0].mana, 0);
  fresh(); button.fire('pointerdown'); timer(); button.fire('pointerup'); button.fire('click');
  assert.equal(selected, false); assert.equal(confirms, 0); assert.equal(state.players[0].mana, 1);
  assert.equal(button.attributes.get('aria-expanded'), 'true');
  // A hold must never lock out the same finger's later drag.
  fresh();button.fire('pointerdown');timer();button.fire('pointermove',{clientX:130});button.fire('pointerup',{clientX:200});
  assert.deepEqual([confirms,drops],[1,1]);assert.equal(state.players[0].mana,0);
  // The enlarged spell itself is also a stable drag source.
  fresh();tap();panel.fire('pointerdown');panel.fire('pointermove',{clientX:130});
  assert.equal(panel.hasPointerCapture(1),true);assert.equal(panel.hidden,false);assert.equal(panel.style.opacity,'0');
  panel.fire('pointerup',{clientX:200});panel.fire('click');
  assert.deepEqual([confirms,drops,cancels],[1,1,0]);assert.equal(state.players[0].mana,0);
  fresh(); button.fire('pointerdown'); button.fire('pointermove', { clientX: 130 }); button.fire('pointercancel');
  assert.deepEqual([selected, drops, cancels], [false, 0, 1]); assert.equal(state.players[0].mana, 1);
  fresh(); button.fire('pointerdown'); button.fire('pointermove', { clientX: 130 }); button.fire('lostpointercapture');
  assert.deepEqual([selected, drops, cancels], [false, 0, 1]);
  fresh(); button.fire('pointerdown'); state.round++; controller.sync(); button.fire('pointerup');
  assert.equal(confirms, 0); assert.equal(state.players[0].mana, 1);
  fresh();button.fire('keydown',{key:'Enter'});assert.equal(selected,true);
  document.fire('keydown',{key:'Escape'});assert.equal(panel.hidden,true);
  fresh();state=createChallengeMatch('magmar-grow-and-rebirth');state.players[0].mana=1;
  assert.equal(battleCommandTargets(state).type,'self');
  tap();assert.equal(state.players[0].mana,0);assert.equal(state.players[0].bbsUsed,true);assert.equal(confirms,1);
  fresh();state=createChallengeMatch('magmar-grow-and-rebirth');state.players[0].mana=1;
  button.fire('pointerdown');timer();button.fire('pointerup');button.fire('click');
  assert.equal(state.players[0].mana,1);assert.equal(state.players[0].bbsUsed,false);assert.equal(confirms,0);
  assert.equal(panel.hidden,false,'self long press only reads');
  fresh();state=createChallengeMatch('magmar-grow-and-rebirth');state.players[0].mana=1;
  button.fire('pointerdown');timer();button.fire('pointermove',{clientX:130});button.fire('pointerup',{clientX:200});button.fire('click');
  assert.equal(state.players[0].mana,1);assert.equal(state.players[0].bbsUsed,false);assert.equal(confirms,0);
  fresh();state=createChallengeMatch('magmar-grow-and-rebirth');state.players[0].mana=1;
  button.fire('pointerdown');button.fire('pointermove',{clientX:130});
  assert.equal(state.players[0].mana,1,'self command cannot spend mana while dragging');
  button.fire('pointerup',{clientX:200});
  button.fire('click');
  assert.equal(state.players[0].mana,1);assert.equal(state.players[0].bbsUsed,false);assert.equal(confirms,0);
  fresh();state=createChallengeMatch('magmar-grow-and-rebirth');state.players[0].mana=1;
  button.fire('pointerdown');button.fire('pointermove',{clientX:130});button.fire('pointercancel');
  assert.equal(state.players[0].mana,1);assert.equal(state.players[0].bbsUsed,false);
  console.log('Battle command gesture passed: targeted tap reads and button/held/preview drags cast; self tap casts but hold/drag do not; keyboard, save limits and cancellation.');
} finally { globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout; }
