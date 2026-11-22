import { ARCHETYPE_IDS, type ArchetypeId } from './archetypes';
import { SHOP_POOL, type CardDef } from './data';

export const PREP_ARCHETYPES: readonly ArchetypeId[] = ['blood', 'trade', 'rune', 'pair', 'supply'];
export const BATTLE_ARCHETYPES: readonly ArchetypeId[] = ['wheel', 'charge', 'ember', 'nest', 'hunt', 'formation'];
export const ARCHETYPE_BRIDGES: readonly (readonly [ArchetypeId, ArchetypeId])[] = [
  ['wheel', 'rune'], ['ember', 'nest'], ['charge', 'formation'], ['blood', 'ember'],
  ['trade', 'pair'], ['hunt', 'charge'], ['nest', 'wheel'], ['rune', 'blood'],
];
export interface PoolState { activeArchetypes: ArchetypeId[]; act: number }
export function chooseArchetypes(seed: number): ArchetypeId[] {
  let state = (seed ^ 0x51a71e) >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let attempt = 0; attempt < 256; attempt++) {
    const rest = ARCHETYPE_IDS.filter(id => id !== 'supply');
    const selected: ArchetypeId[] = ['supply'];
    while (selected.length < 6) selected.push(rest.splice(Math.floor(random() * rest.length), 1)[0]);
    if (PREP_ARCHETYPES.filter(id => selected.includes(id)).length < 2 || BATTLE_ARCHETYPES.filter(id => selected.includes(id)).length < 2) continue;
    if (ARCHETYPE_BRIDGES.filter(pair => pair.every(id => selected.includes(id))).length >= 2) return selected;
  }
  return ['supply', 'wheel', 'nest', 'ember', 'rune', 'blood'];
}
export function cardAvailable(r: PoolState, c: CardDef | undefined): boolean {
  return !!c && !c.legacy && !c.token && !c.enemy && (!c.archetype || r.activeArchetypes.includes(c.archetype))
    && (c.role !== 'terminal' || r.act >= 2);
}
export const activeCardPool = (r: PoolState): CardDef[] => SHOP_POOL.filter(c => cardAvailable(r, c));
export function relatedCards(a: CardDef, b: CardDef): boolean {
  if (a.id === b.id) return true;
  if (a.archetype && b.archetype) return a.archetype === b.archetype || a.bridge === b.archetype || b.bridge === a.archetype;
  return false;
}
