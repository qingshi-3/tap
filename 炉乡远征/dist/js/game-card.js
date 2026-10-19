import { compactCardDescription, createKeywordStrip } from './card-keywords.js';
import { cardAttackRange } from './attack-range.js';
import { HEROES } from './factions.js';
const TYPE_LABELS = { unit: '随从', spell: '法术', general: '主将' };

function add(parent, tag, className, value) {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = value;
  parent.append(el);
  return el;
}

export function createGameCard(card, { drawArt, interactiveKeywords = false, presentation } = {}) {
  const root = document.createElement('article');
  const entity = card?.type === 'unit' || card?.type === 'general';
  root.className = `game-card game-card-${card?.type || 'unknown'}${entity ? ' is-entity' : ''}${presentation === 'collection' ? ' is-collection' : ''}`;
  root.dataset.faction = String(card.faction ?? 1);
  root.style.setProperty('--card-frame', `url('./assets/card-backgrounds/${card.faction === 0 ? 'neutral-unit' : `f${card.faction || 1}-${card.type === 'spell' ? 'spell' : 'unit'}`}.png')`);
  const frame = document.createElement('div'); frame.className = 'game-card-frame';
  const art = document.createElement('div'); art.className = 'game-card-art';
  const canvas = document.createElement('canvas');
  canvas.width = 224; canvas.height = 176; canvas.dataset.cardArt = String(card.id); art.append(canvas);
  if (card.cost != null) {
    const cost = add(root, 'span', 'game-card-cost card-stat-badge card-stat-mana', String(card.cost));
    cost.setAttribute('aria-label', `${card.cost} 费`);
  }
  const attackRange = cardAttackRange(card);
  if (attackRange !== null) {
    const range = add(root, 'span', 'game-card-range card-stat-badge card-stat-range', Number.isFinite(attackRange) ? String(attackRange) : '∞');
    range.setAttribute('aria-label', Number.isFinite(attackRange) ? `攻击射程 ${attackRange} 格` : '无限射程');
  }
  const caption = document.createElement('div'); caption.className = 'game-card-caption';
  add(caption, 'strong', 'game-card-name', card.name || '未知卡牌');
  add(caption, 'span', 'game-card-type', TYPE_LABELS[card.type] || '卡牌');
  const description = document.createElement('div'); description.className = 'game-card-description';
  const keywords = createKeywordStrip(card, { interactive: interactiveKeywords, host: root });
  const collectionHero = presentation === 'collection' && card.type === 'general' ? HEROES[card.id] : null;
  if (collectionHero) {
    const abilities = document.createElement('div'); abilities.className = 'collection-card-abilities';
    for (const [kind, name] of [[`指令 · ${collectionHero.cost}费`, collectionHero.activeName], ['被动', collectionHero.passiveName]]) {
      const ability = document.createElement('div'); ability.className = 'collection-card-ability';
      add(ability, 'span', 'collection-ability-kind', kind);
      add(ability, 'strong', 'collection-ability-name', name);
      abilities.append(ability);
    }
    description.append(abilities);
  } else {
    // Keep the original keyword label nodes; collection layout supplies room
    // for their names. Full effects remain in the existing read-only details.
    if (keywords.childElementCount) description.append(keywords);
    const text = presentation === 'collection' && keywords.childElementCount ? '' : compactCardDescription(card);
    if (text) add(description, 'p', 'game-card-rule', text);
  }
  root.append(frame, art, caption, description);
  root.closeKeywords = () => keywords.closeKeywords?.();
  if (entity) {
    const stats = document.createElement('div'); stats.className = 'game-card-stats';
    const attack = add(stats, 'span', 'game-card-attack', card.attack == null ? '—' : String(card.attack));
    const health = add(stats, 'span', 'game-card-health', card.health == null ? '—' : String(card.health));
    attack.setAttribute('aria-label', `攻击 ${card.attack ?? '未知'}`);
    health.setAttribute('aria-label', `生命 ${card.health ?? '未知'}`);
    root.append(stats);
  }
  if (typeof drawArt === 'function') {
    try { const result = drawArt(canvas, card.id); if (result?.catch) result.catch(() => {}); } catch (_) {}
  }
  return root;
}

export { TYPE_LABELS };
