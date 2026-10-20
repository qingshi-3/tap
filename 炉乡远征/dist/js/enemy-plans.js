import { AUTHORED_ENEMY_PLANS } from './campaign-content.js';
import { EXPEDITION_LEVELS } from './expedition-data.js';
import { getCard } from './cards.js';
import { validBossConfig } from './boss-mechanics.js';

// One authored encounter package per level, copied into new battles; saved
// matches never consult a later balance revision.
export function validateEnemyPlan(plan, levelId, ownerIds = null) {
  const level = EXPEDITION_LEVELS.find(entry => entry.id === levelId);
  if (!level || !plan || ![2,3].includes(plan.version) || typeof plan.label !== 'string' || typeof plan.hint !== 'string' || !plan.players) return false;
  // Saved matches provide their frozen army identities; new matches use the
  // authored level. Updating an encounter must not invalidate an older battle.
  const owners = ownerIds ?? [...new Set(level.enemies.map(enemy => enemy.owner))];
  if (!Array.isArray(owners) || owners.length < 1 || owners.length > 2 || new Set(owners).size !== owners.length || owners.some(owner => !Number.isInteger(owner) || owner < 1 || owner > 2)) return false;
  if (Object.keys(plan.players).length !== owners.length) return false;
  if (!validBossConfig(plan.boss)) return false;
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
      if(p.garrison.filter(entry=>getCard(entry.id)?.type==='unit'&&!getCard(entry.id)?.token).some(entry=>entry.attack!==p.unitStats[entry.id]?.attack||entry.health!==p.unitStats[entry.id]?.health)) return false;
    }
    return p.generalHealth > 0 && p.handLimit > 0 && p.openingHandSize <= p.handLimit && p.openingHandSize <= p.deck.length && p.mana <= p.maxMana && p.maxMana <= p.manaCap && typeof p.shuffleDeck === 'boolean' && ['assault','defend','support','flank'].includes(p.behavior);
  });
}

export function getEnemyPlan(levelId) {
  if (!Object.hasOwn(AUTHORED_ENEMY_PLANS, levelId)) return null;
  const plan = structuredClone(AUTHORED_ENEMY_PLANS[levelId]);
  if (!validateEnemyPlan(plan, levelId)) throw new Error(`敌军配置无效：${levelId}`);
  return plan;
}
