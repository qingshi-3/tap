// Presentation receipts never enter a save, affect randomness, or replay a rule action.
const pending = new WeakMap();
const stages = new WeakMap();
export function withBattlePresentationStage(state,stage,operation) {
  const old=stages.get(state);stages.set(state,stage);
  try{return operation();}finally{if(old===undefined)stages.delete(state);else stages.set(state,old);}
}
export function recordBattlePresentation(state, event) {
  if (!state || !event) return;
  let list = pending.get(state);
  if (!list) pending.set(state, list = []);
  list.push(Object.freeze({reason:'effect',stage:stages.get(state)??'action',...event}));
}
export function drainBattlePresentation(state) {
  const list = pending.get(state) ?? [];
  pending.delete(state);
  return list.slice();
}
export function clearBattlePresentation(state) { if (state) pending.delete(state); }
