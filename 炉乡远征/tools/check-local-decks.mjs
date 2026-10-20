import assert from 'node:assert/strict';
import {LocalDecks, localDeckKey, validateLocalDeck} from '../dist/js/local-decks.js';
import {makeStarterDeck, starterInventory, validatePlayerDeck} from '../dist/js/battle-deck.js';
import {FACTIONS} from '../dist/js/factions.js';
import {ExpeditionUI} from '../dist/js/expedition-ui.js';
import {EXPEDITION_LEVELS} from '../dist/js/expedition-data.js';

class MemoryStorage {
  data = new Map(); fail = false; mutateThenThrow = false;
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key,value) {
    if (this.fail) throw new Error('quota full');
    this.data.set(key,String(value));
    if (this.mutateThenThrow && key.startsWith(localDeckKey(''))) throw new Error('adapter failed after write');
  }
  removeItem(key) { this.data.delete(key); }
}
const inventory = starterInventory();
const deck = faction => makeStarterDeck(faction.heroIds[0],inventory);
const storage = new MemoryStorage();
const local = new LocalDecks(storage);
for (const faction of FACTIONS) {
  const original = deck(faction);
  assert.deepEqual(local.get(faction.id,original,inventory),original);
  const partial = original.slice(0,29);
  assert.equal(local.set(faction.id,partial,inventory).ok,true);
  assert.equal(local.save(faction.id,inventory).ok,true);
  assert.equal(validatePlayerDeck(partial,faction.heroIds[0],inventory),false,'profile contract stays exact-30');
}
const reopened = new LocalDecks(storage);
for (const faction of FACTIONS) assert.deepEqual(reopened.get(faction.id,deck(faction),inventory),deck(faction).slice(0,29),'six factions reload independently');

const faction = FACTIONS[0], original = deck(faction), id = original[0];
assert.match(validateLocalDeck([...original,id],faction.id,inventory),/最多30/);
assert.match(validateLocalDeck([id,id,id,id],faction.id,inventory),/最多3/);
assert.match(validateLocalDeck([FACTIONS[1].unitIds[0]],faction.id,inventory),/其他阵营/);
assert.match(validateLocalDeck([99999999],faction.id,inventory),/未知卡牌/);
assert.match(validateLocalDeck([id],faction.id,{...inventory,units:inventory.units.filter(value => value !== id)}),/尚未拥有/);
assert.equal(validateLocalDeck([],faction.id,inventory),'');

const conflictA = new LocalDecks(storage), conflictB = new LocalDecks(storage);
conflictA.get(faction.id,original,inventory); conflictB.get(faction.id,original,inventory);
conflictA.set(faction.id,original.slice(0,28),inventory); assert.equal(conflictA.save(faction.id,inventory).ok,true);
const newer = storage.getItem(localDeckKey(faction.id));
conflictB.set(faction.id,[],inventory); assert.equal(conflictB.save(faction.id,inventory).ok,false);
assert.equal(storage.getItem(localDeckKey(faction.id)),newer,'stale tab must not overwrite');

for (const raw of ['{"schemaVersion":99,"factionId":1,"deck":[]}', '{broken', '{"schemaVersion":1,"factionId":1,"deck":[99999999]}']) {
  const badStorage = new MemoryStorage(); badStorage.setItem(localDeckKey(1),raw);
  const bad = new LocalDecks(badStorage);
  assert.deepEqual(bad.get(1,original,inventory),original);
  assert.ok(bad.error(1));
  bad.set(1,[],inventory);
  assert.equal(bad.save(1,inventory).ok,false);
  assert.equal(badStorage.getItem(localDeckKey(1)),raw,'unknown/corrupt originals stay untouched');
}

const failures = new MemoryStorage(), failed = new LocalDecks(failures);
failed.get(1,original,inventory); failed.set(1,original.slice(0,29),inventory); assert.equal(failed.save(1,inventory).ok,true);
const beforeFailure = failures.getItem(localDeckKey(1));
failed.set(1,original.slice(0,28),inventory); failures.fail = true;
assert.equal(failed.save(1,inventory).ok,false);
assert.equal(failures.getItem(localDeckKey(1)),beforeFailure);
assert.equal(failed.get(1,original,inventory).length,28,'failed save retains edited memory');
failures.fail = false; assert.equal(failed.save(1,inventory).ok,true,'transient failure can retry');
const adapterStorage = new MemoryStorage(), adapter = new LocalDecks(adapterStorage);
adapter.get(1,original,inventory); adapterStorage.mutateThenThrow = true;
assert.equal(adapter.save(1,inventory).ok,false);
assert.equal(adapterStorage.getItem(localDeckKey(1)),null,'guard restores failed own write');

// Exercise actual add/remove/return/default/start handlers, not source strings.
function harness(store = new MemoryStorage()) {
  const ui = Object.create(ExpeditionUI.prototype);
  ui.progress = {state:{selectedHeroId:faction.heroIds[0],inventory,decks:{[faction.id]:original}},setBattleDeck:cards => ({ok:validatePlayerDeck(cards,faction.heroIds[0],inventory),error:'必须30张'})};
  ui.localDecks = new LocalDecks(store); ui.page = 'prep'; ui.returnMission = EXPEDITION_LEVELS[0].id;
  ui.render = () => { ui.rendered = (ui.rendered || 0) + 1; };
  ui.navigate = page => { ui.page = page; };
  ui.root = {querySelector:() => null}; ui.onStart = () => {ui.started = true;};
  return ui;
}
function click(ui,action,extra = {}) {
  const target = {dataset:{action,...extra},disabled:false};
  ui.handleClick({target:{closest:() => target}});
}
const uiStorage = new MemoryStorage(), ui = harness(uiStorage);
ui.draftDeck();
click(ui,'deck-remove',{cardId:String(id)});
click(ui,'deck-remove',{cardId:String(id)});
click(ui,'deck-add',{cardId:String(id)});
click(ui,'return-mission');
assert.equal(ui.page,'expedition');
assert.equal(harness(uiStorage).draftDeck().length,29,'latest repeated edits survive returning/reopening');
ui.page = 'prep'; click(ui,'deck-default'); assert.deepEqual(ui.draftDeck(),original,ui.deckMessage);
click(ui,'return-mission'); assert.deepEqual(harness(uiStorage).draftDeck(),original,'default survives next return');
ui.page = 'prep'; click(ui,'deck-remove',{cardId:String(id)}); uiStorage.fail = true;
click(ui,'return-mission'); assert.equal(ui.page,'prep'); assert.match(ui.deckMessage,/quota full/); assert.equal(ui.draftDeck().length,29);
click(ui,'start',{levelId:ui.returnMission}); assert.equal(ui.started,undefined,'save failure prevents start');
uiStorage.fail = false; click(ui,'start',{levelId:ui.returnMission}); assert.equal(ui.started,undefined,'partial deck never starts');
click(ui,'deck-default'); click(ui,'start',{levelId:ui.returnMission}); assert.equal(ui.started,true,'complete local deck submits then starts');
const profileFailure = harness(); profileFailure.draftDeck(); profileFailure.progress.setBattleDeck = () => ({ok:false,error:'profile conflict'});
click(profileFailure,'start',{levelId:profileFailure.returnMission}); assert.equal(profileFailure.started,undefined); assert.equal(profileFailure.deckMessage,'profile conflict');
console.log('Local deck behavior checks passed: isolation, partial reload, validation, guarded failures and actual UI save/start paths.');
