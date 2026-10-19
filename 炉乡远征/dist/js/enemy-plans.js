import { AUTHORED_ENEMY_PLANS, AUTHORED_ENEMY_PLAN_VARIANTS, PRE_EXPANSION_LEVEL_IDS, CONTENT_VERSION } from './campaign-content.js';
import { EXPEDITION_LEVELS } from './expedition-data.js';
import { getCard } from './cards.js';

// Authored encounter packages. These are copied into new battles; saved matches
// never consult a later balance revision. No player inventory constraints apply.
const chapters = [
  { attackBonus: 0, healthBonus: 0, spellRank: 0, mana: 2, generalHealth: 14 },
  { attackBonus: 0, healthBonus: 1, spellRank: 0, mana: 3, generalHealth: 22 },
  { attackBonus: 0, healthBonus: 1, spellRank: 0, mana: 4, generalHealth: 24 },
  { attackBonus: 1, healthBonus: 2, spellRank: 1, mana: 4, generalHealth: 27 },
  { attackBonus: 1, healthBonus: 3, spellRank: 1, mana: 5, generalHealth: 29 },
  { attackBonus: 1, healthBonus: 4, spellRank: 1, mana: 5, generalHealth: 32 },
];
// Each row: identity, counterplay, behavior per army, full ordered supply decks.
const encounters = [
  ['边哨巡逻', '先击败前排随从，再接近敌方主将。', ['assault'], [[14,14,9]]],
  ['双路斥候', '敌军混入中立射手；保护后排，利用侧路接近射手。', ['flank'], [[14,10021,9,14]]],
  ['守夜巡军', '把受伤部队移到后方，保护主将完成坚守。', ['assault'], [[14,9,10021,14,9]]],
  ['隘口守卫', '前排保护后方部队，可从侧面绕行。', ['defend'], [[14,11,10021,14,20043,9]]],
  ['恢复防线', '治疗支援会延长正面战斗；先处理支援或快速集火。', ['support'], [[10981,14,15,20043,10021,14]]],
  ['重装关隘', '重装兵较耐久；保存法术，先拆掉后排支援。', ['defend'], [[11,10021,14,10981,20066,11]]],
  ['两军前哨', '两支敌军互相攻击；先稳住自己的阵地。', ['defend','assault'], [[14,15,10981,11,20043],[9,10021,14,20066,9]]],
  ['争夺渡口', '两军各有恢复与火力，选择介入时机。', ['support','flank'], [[15,10981,14,20043,16,11],[10019,9,10021,20066,14,9]]],
  ['三旗攻坚', '保护主将完成坚守，无需击败全部敌军。', ['defend','assault'], [[11,15,10981,20043,17,16],[9,10019,10021,20066,11,14]]],
  ['沙海火线', '远程部队掩护沙魔，可绕侧攻击方尖碑。', ['defend'], [[214,213,211,10021,20095,213,20151]]],
  ['沙丘护送线', '支援部队会强化沙魔，可先攻击支援部队。', ['support'], [[211,215,213,10981,20095,214,20151]]],
  ['沙海军团', '方尖碑持续召唤沙魔，并有爆破部队掩护。', ['defend'], [[215,213,19037,214,20151,209,20095,213]]],
  ['暗影前锋', '敌军偏向后排突袭，保持护卫相邻。', ['flank'], [[110,109,10019,20081,115,10012,20086]]],
  ['腐化祭坛', '先击败召唤暗灵或因死亡强化的敌人。', ['support'], [[317,308,311,20072,19050,316,20052,308]]],
  ['暗影会战', '突击与召唤两支敌军也会互攻，别同时承受两边火力。', ['flank','support'], [[110,10012,109,20081,111,20086],[317,19050,311,20072,316,20052]]],
  ['冰原防线', '冰墙和潜入部队封路；保留机动单位绕开正面。', ['defend'], [[505,20149,10021,503,20139,511,10981]]],
  ['重生攻坚', '及时处理重生卵，避免把每轮行动都花在重复清兵。', ['assault'], [[412,19027,402,20116,10012,413,20117]]],
  ['冰原围城', '两支敌军也会互相攻击，保护主将完成坚守。', ['defend','assault'], [[505,20149,511,20139,19027,513],[412,19050,402,20116,413,20117]]],
];
// Schema 6 encounter decks. Each array is one army's complete draw pile,
// including its opening hand, in draw order. Repeated IDs are intentional;
// enemy armies have no player faction, 30-card or three-copy restriction.
const drawDecks = {
  'border-01': [[14,14,9,14,10021,9,14,14,9,10021,14,9]],
  'border-02': [[14,10021,9,14,14,10021,9,14,14,10021,9,14]],
  'border-03': [[14,9,10021,14,9,14,9,10021,14,9,14,9,10021,14,9]],
  'road-01': [[14,11,10021,14,20043,9,14,11,10021,14,20043,9,14,11,10021,14,20043,9]],
  'road-02': [[10981,14,15,20043,10021,14,10981,14,15,20043,10021,14,10981,14,15,20043,10021,14]],
  'road-03': [[11,10021,14,10981,20066,11,11,10021,14,10981,20066,11,11,10021,14,10981,20066,11]],
  'banners-01': [[14,15,10981,11,20043,14,15,10981,11,20043,14,15,10981,11,20043],[9,10021,14,20066,9,9,10021,14,20066,9,9,10021,14,20066,9]],
  'banners-02': [[15,10981,14,20043,16,11,15,10981,14,20043,16,11,15,10981,14,20043,16,11],[10019,9,10021,20066,14,9,10019,9,10021,20066,14,9,10019,9,10021,20066,14,9]],
  'banners-03': [[11,15,10981,20043,17,16,11,15,10981,20043,17,16,11,15,10981,20043,17,16],[9,10019,10021,20066,11,14,9,10019,10021,20066,11,14,9,10019,10021,20066,11,14]],
  'sand-01': [[214,213,211,10021,20095,213,20151,214,213,211,10021,20095,213,20151,214,213,211,10021,20095,213,20151]],
  'sand-02': [[211,215,213,10981,20095,214,20151,211,215,213,10981,20095,214,20151,211,215,213,10981,20095,214,20151]],
  'sand-03': [[215,213,19037,214,20151,209,20095,213,215,213,19037,214,20151,209,20095,213,215,213,19037,214,20151,209,20095,213]],
  'shadow-01': [[110,109,10019,20081,115,10012,20086,110,109,10019,20081,115,10012,20086,110,109,10019,20081,115,10012,20086]],
  'shadow-02': [[317,308,311,20072,19050,316,20052,308,317,308,311,20072,19050,316,20052,308,317,308,311,20072,19050,316,20052,308]],
  'shadow-03': [[110,10012,109,20081,111,20086,110,10012,109,20081,111,20086,110,10012,109,20081,111,20086],[317,19050,311,20072,316,20052,317,19050,311,20072,316,20052,317,19050,311,20072,316,20052]],
  'frost-01': [[505,20149,10021,503,20139,511,10981,505,20149,10021,503,20139,511,10981,505,20149,10021,503,20139,511,10981]],
  'frost-02': [[412,19027,402,20116,10012,413,20117,412,19027,402,20116,10012,413,20117,412,19027,402,20116,10012,413,20117]],
  'frost-03': [[505,20149,511,20139,19027,513,505,20149,511,20139,19027,513,505,20149,511,20139,19027,513],[412,19050,402,20116,413,20117,412,19050,402,20116,413,20117,412,19050,402,20116,413,20117]],
};
// Per-level/per-owner overrides belong here, not in engine branches. Any field
// below (including deck) may be replaced for an authored encounter.
const drawOverrides = {};
const drawDefaults = { openingHandSize: 3, drawPerTurn: 1, handLimit: 8,
  fatigueDamage: 2, replacePerTurn: 0, shuffleDeck: false };

export function validateEnemyPlan(plan, levelId, ownerIds = null) {
  const level = EXPEDITION_LEVELS.find(entry => entry.id === levelId);
  if (!level || !plan || ![2,3].includes(plan.version) || typeof plan.label !== 'string' || typeof plan.hint !== 'string' || !plan.players) return false;
  // Saved matches provide their frozen army identities; new matches use the
  // authored level. Updating an encounter must not invalidate an older battle.
  const owners = ownerIds ?? [...new Set(level.enemies.map(enemy => enemy.owner))];
  if (!Array.isArray(owners) || owners.length < 1 || owners.length > 2 || new Set(owners).size !== owners.length || owners.some(owner => !Number.isInteger(owner) || owner < 1 || owner > 2)) return false;
  if (Object.keys(plan.players).length !== owners.length) return false;
  return owners.every(owner => {
    const p = plan.players[owner];
    if (!p || !Array.isArray(p.deck) || p.deck.length > 300 || p.deck.some(id => !Number.isInteger(id) || !['unit','spell'].includes(getCard(id)?.type))) return false;
    const limits = {attackBonus:100, healthBonus:100, spellRank:2, mana:30, maxMana:30, manaGrowth:30, manaCap:30, generalHealth:1000, openingHandSize:30, drawPerTurn:10, handLimit:30, fatigueDamage:30, replacePerTurn:5};
    if (Object.entries(limits).some(([key,max]) => !Number.isInteger(p[key]) || p[key] < 0 || p[key] > max)) return false;
    if (plan.version===3) {
      if (!['campaign-2026-10-13-v1','campaign-2026-10-14-v2'].includes(plan.contentVersion) || p.attackBonus!==0 || p.healthBonus!==0 || p.spellRank!==0 || p.spellMode!=='base' || !Number.isInteger(p.generalAttack) || p.generalAttack<0 || p.generalAttack>100 || getCard(p.generalId)?.type!=='general' || !p.unitStats || !Array.isArray(p.garrison) || !p.garrison.length) return false;
      if (p.garrison.some(entry=>!getCard(entry.id) || !Number.isInteger(entry.x) || !Number.isInteger(entry.y) || entry.x<0 || entry.y<0 || !Number.isInteger(entry.attack) || entry.attack<0 || !Number.isInteger(entry.health) || entry.health<1)) return false;
      const generals=p.garrison.filter(entry=>getCard(entry.id)?.type==='general');
      if(generals.length!==1 || generals[0].id!==p.generalId || generals[0].attack!==p.generalAttack || generals[0].health!==p.generalHealth) return false;
      const required=[...new Set([...p.deck,...p.garrison.map(entry=>entry.id)])].filter(id=>getCard(id)?.type==='unit'&&!getCard(id)?.token);
      if(Object.keys(p.unitStats).length!==required.length || required.some(id=>!p.unitStats[id] || Object.keys(p.unitStats[id]).length!==3 || ['cost','attack','health'].some(key=>!Number.isInteger(p.unitStats[id][key])||p.unitStats[id][key]<0||p.unitStats[id][key]>100) || p.unitStats[id].health<1)) return false;
      if(p.garrison.filter(entry=>getCard(entry.id)?.type==='unit').some(entry=>entry.attack!==p.unitStats[entry.id]?.attack||entry.health!==p.unitStats[entry.id]?.health)) return false;
    }
    return p.generalHealth > 0 && p.handLimit > 0 && p.openingHandSize <= p.handLimit && p.openingHandSize <= p.deck.length && p.mana <= p.maxMana && p.maxMana <= p.manaCap && typeof p.shuffleDeck === 'boolean' && ['assault','defend','support','flank'].includes(p.behavior);
  });
}

export function getEnemyPlan(levelId, version = 1, factionId = 1) {
  if(version===3) { const plan=structuredClone(AUTHORED_ENEMY_PLAN_VARIANTS[levelId]?.[factionId] ?? AUTHORED_ENEMY_PLANS[levelId]); if(!validateEnemyPlan(plan,levelId))throw new Error('正式敌军配置无效。'); return plan; }
  const index = EXPEDITION_LEVELS.findIndex(level => level.id === levelId);
  if (index < 0) return null;
  if(index>=PRE_EXPANSION_LEVEL_IDS.length)throw new Error('新增关卡只支持正式内容战斗。');
  const level = EXPEDITION_LEVELS[index], baseline = chapters[Math.floor(index / 3)];
  const [label, hint, behaviors, decks] = encounters[index];
  const owners = [...new Set(level.enemies.map(enemy => enemy.owner))].sort((a,b) => a-b);
  const players = Object.fromEntries(owners.map((owner, i) => [owner, {
    ...baseline, generalHealth: index === 0 ? 12 : baseline.generalHealth + (index % 3 === 2 ? 2 : 0),
    mana: baseline.mana, maxMana: baseline.mana, manaGrowth: 1, manaCap: 9,
    drawPerTurn: 1, handLimit: 8, behavior: behaviors[i] ?? 'assault', deck: [...(decks[i] ?? decks[0])],
  }]));
  if (version === 1) return { version: 1, label, hint, chapter: Math.floor(index / 3) + 1, players };
  if (version !== 2) throw new Error('不支持的敌军配置版本。');
  owners.forEach((owner, i) => Object.assign(players[owner], drawDefaults,
    {deck: [...drawDecks[levelId][i]]}, structuredClone(drawOverrides[levelId]?.[owner] ?? {})));
  const plan = { version: 2, label, hint, chapter: Math.floor(index / 3) + 1, players };
  if (!validateEnemyPlan(plan, levelId)) throw new Error(`敌军配置无效：${levelId}`);
  return plan;
}
export const ENEMY_PLAN_ROWS = Object.freeze(EXPEDITION_LEVELS.filter(level=>PRE_EXPANSION_LEVEL_IDS.includes(level.id)).map(level => ({ levelId: level.id, ...getEnemyPlan(level.id) })));
export const ENEMY_DRAW_PLAN_ROWS = Object.freeze(EXPEDITION_LEVELS.filter(level=>PRE_EXPANSION_LEVEL_IDS.includes(level.id)).map(level => ({levelId:level.id,...getEnemyPlan(level.id,2)})));
