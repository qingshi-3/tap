// Keep the original public string schema so existing battle saves remain readable.
export const BATTLE_HISTORY_LIMIT = 240;
export const SPELL_HISTORY_PREFIX = '法术结算：';

// One public transaction per successful cast. Only the played card and visible
// board are retained; no hand, draw-pile or private opponent information is saved.
export function withSpellHistory(state, handIndex, argument, owner, operation) {
  const cardId = state.players?.[owner]?.hand?.[handIndex];
  const before = state.units.map(unit => ({ ...unit }));
  const beforeCreep = { ...state.creepCells }, beforeDeathDraw = state.players[owner]?.deathDraw;
  const oldLog = [...state.log];
  const round = state.round;
  const result = operation();
  if (!result || state.lastAction?.kind !== 'spell') return result;
  let shared = Math.min(oldLog.length, state.log.length);
  while (shared && !oldLog.slice(-shared).every((row, index) => row === state.log[index])) shared--;
  const rows = state.log.slice(shared);
  const units = new Map(before.map(unit => [unit.unitId, unit]));
  const after = new Map(state.units.map(unit => [unit.unitId, unit]));
  const changes = [];
  const describe = unit => ({ targetId:unit.cardId, targetOwner:unit.owner, targetUnitId:unit.unitId, targetName:state.battleCards?.[unit.owner]?.[unit.cardId]?.name });
  for (const unit of state.units) {
    const old = units.get(unit.unitId);
    if (!old) { changes.push({ ...describe(unit), kind:'summon', label:'召唤', cell:{x:unit.x,y:unit.y} }); continue; }
    if (old.x !== unit.x || old.y !== unit.y) changes.push({ ...describe(unit), kind:'move', label:'移位', cell:{x:unit.x,y:unit.y} });
    if (old.cardId !== unit.cardId) changes.push({ ...describe(unit), kind:'status', label:'变形' });
    if (old.owner !== unit.owner) changes.push({ ...describe(unit), kind:'status', label:'控制权改变' });
    // Legacy effect logs carry damage, healing and buffs. Diffs fill the gaps
    // for paths that have no public prose (teleports and no-damage outcomes).
    for (const [field,label] of [['stunTurns','冻结'],['silenced','驱散'],['flyingBuff','飞行'],['frenzyBuff','狂暴'],['provokeBuff','嘲讽']]) {
      if (Boolean(old[field]) !== Boolean(unit[field])) changes.push({ ...describe(unit), kind:'status', label:unit[field] ? label : `${label}结束` });
    }
  }
  for (const unit of before) if (!after.has(unit.unitId)) changes.push({ ...describe(unit), kind:'death', label:'击败' });
  for (const key of new Set([...Object.keys(beforeCreep), ...Object.keys(state.creepCells ?? {})])) {
    if (beforeCreep[key] === state.creepCells?.[key]) continue;
    const [x,y] = key.split(',').map(Number);
    changes.push({kind:'status',label:state.creepCells?.[key] == null ? '净除' : '腐化',cell:{x,y}});
  }
  if (beforeDeathDraw !== state.players[owner]?.deathDraw) changes.push({kind:'status',label:'亡时抽牌'});
  const action = state.lastAction;
  const requested = typeof argument === 'number' ? [argument] : argument?.unitIds ?? [argument?.unitId].filter(Number.isInteger);
  const targetIds = [...new Set([...requested, action.targetId, ...(action.targetIds ?? [])].filter(Number.isInteger))];
  const targets = targetIds.map(id => after.get(id) ?? units.get(id)).filter(Boolean).map(describe);
  const cell = action.cell ?? (argument && Number.isInteger(argument.x) && Number.isInteger(argument.y) ? argument : argument?.cell);
  const record = { cardId, casterId:state.players[owner]?.generalId, casterName:owner > 0 ? state.players[owner]?.name : null, owner, round, targets, cell:cell ? {x:cell.x,y:cell.y} : null, changes, rows };
  appendBattleLog(state, SPELL_HISTORY_PREFIX + JSON.stringify(record), owner);
  return result;
}
export function appendBattleLog(state, message, owner = state.currentPlayer) {
  const turn = state.round > 0 ? `第${state.round}回合` : '起手';
  const side = owner === 0 ? '我方' : '敌方';
  state.log.push(`${turn} · ${side}｜${message}`);
  const earliest = Math.max(1, state.round - 1);
  state.log = state.log.filter(row => {
    const match = row.match(/^第(\d+)回合\s*·/);
    return match ? Number(match[1]) >= earliest && Number(match[1]) <= state.round : state.round === 0;
  });
  if (state.log.length > BATTLE_HISTORY_LIMIT) state.log.splice(0, state.log.length - BATTLE_HISTORY_LIMIT);
}
