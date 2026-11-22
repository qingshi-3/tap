import { ARCHETYPES, type ArchetypeId, type CardRole } from '../core/archetypes';
import { ARCHETYPE_COLORS } from './archetypes';
import { h } from './dom';
import './css/support-systems.css';

export interface SupportIdentity { archetypes?:readonly ArchetypeId[]; role?:CardRole }
export const supportIdentity = (item: SupportIdentity) =>
  item.archetypes?.length ? item.archetypes.map(id => ARCHETYPES[id].name).join(' · ') : '通用';
export function supportBadges(item: SupportIdentity) {
  return h('div', { class:'support-badges' },
    ...(item.archetypes?.length ? item.archetypes.map(id => h('span', { class:'support-tag', style:`--support-color:${ARCHETYPE_COLORS[id]}` }, ARCHETYPES[id].name)) : [h('span', { class:'support-tag' }, '通用')]));
}
export function supportGuide(item: SupportIdentity) {
  return supportBadges(item);
}

/** 只补充正文尚未说明的限次归属。 */
export function supportCounterNote(item: { text:string; counterScope?:'team'|'holder' }) {
  if (!item.counterScope || !/(?:每场|每回合).*次/.test(item.text) || /全队|每人|每位/.test(item.text)) return '';
  return item.counterScope === 'team' ? '触发次数全队共用。' : '每位持有者分别计次。';
}
