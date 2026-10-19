import { CARDS, getCard } from './cards.js';
import { getBattleCard } from './engine.js';
import { getHero } from './factions.js';
import { EFFECT_MANIFEST } from './effect-manifest.js';

// Match-local roots, never the complete frozen battleCards table: that table
// deliberately contains rules for cards which this encounter cannot produce.
export function battleCardIds(state) {
  const ids = new Set(), pending = [];
  const add = value => { const id = Number(value); if (getCard(id) && !ids.has(id)) { ids.add(id); pending.push(id); } };
  for (const player of state?.players ?? []) {
    add(player.generalId);
    for (const id of [...(player.deck ?? []), ...(player.hand ?? [])]) add(id);
  }
  for (const unit of state?.units ?? []) { add(unit.cardId); add(unit.hatchCardId); for(const id of unit.grantedDyingSpawns??[]) add(id); }
  for (const id of [...(state?.squad ?? []), ...(state?.loadout?.deck ?? []), ...(state?.loadout?.spells ?? [])]) add(id);
  for (const plan of Object.values(state?.enemyPlan?.players ?? {})) {
    add(plan.generalId);
    for (const id of plan.deck ?? []) add(id);
    for (const unit of plan.garrison ?? []) add(unit.id ?? unit.cardId);
  }
  while (pending.length) {
    const id = pending.shift();
    // Current and supported frozen historical rules can differ. Include both
    // dependency sets, but do not load unrelated cards merely present in a save.
    const rules = [CARDS[id], ...(state?.players ?? []).map(player => getBattleCard(state, id, player.id))].filter(Boolean);
    for (const card of rules) {
      for (const key of ['summon', 'deathSpawn', 'transform', 'deathWatchSpawn', 'hatchCardId', 'handSummonSpawn', 'damageGenerate','dyingSpawn','openingGrantDyingSpawnToAllies']) add(card[key]);
      if (card.dyingWolf) add(typeof card.dyingWolf === 'number' ? card.dyingWolf : 504);
      if (card.openingDervish || card.obelysk) add(217);
      if (card.openingWraith || card.dyingSpawnCount) add(315);
      if (card.rebirth || card.endSpawnEgg || card.effect === 'eggMorph') add(411);
    }
    // Engine-native commander summons and Lilithe's death passive.
    for (const token of ({ 123: [108], 201: [225], 301: [315] })[id] ?? []) add(token);
  }
  return [...ids].sort((a, b) => a - b);
}

export function effectDependencies(cardIds, manifest = EFFECT_MANIFEST) {
  const keys = new Set(['FX.Modifiers.ModifierGenericBuff']);
  for (const id of cardIds) {
    for (const source of [manifest.cardRecipes?.[id], manifest.spellRecipes?.[id], manifest.spellRecipes?.[getCard(id)?.effect], manifest.cardRecipes?.[getHero(id)?.bbsCardId], manifest.spellRecipes?.[getHero(id)?.bbsCardId]]) {
      for (const key of Array.isArray(source) ? source : source ? [source] : []) keys.add(key);
    }
  }
  const resources = new Set(), staticPaths = new Set(), particles = new Set();
  const inspect = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'chooseOneRandomly') for (const choice of item ?? []) if (typeof choice === 'string') inspect({ resource: choice });
      if (['spriteIdentifier', 'resource', 'name'].includes(key)) {
        for (const raw of Array.isArray(item) ? item : [item]) {
          if (typeof raw !== 'string') continue;
          const name = raw.replace(/^RSX\.|\.name$/g, '');
          if (manifest.resources?.[name]) resources.add(name);
          else if (/\.png$/i.test(raw)) staticPaths.add(raw);
        }
      }
      if (['plist', 'plistFile'].includes(key) && manifest.particles?.[item]) particles.add(item);
      // Include every random branch, not flatten's one chosen playback branch.
      if (typeof item === 'object') inspect(item);
    }
  };
  const recipes = [...keys].map(key => manifest.recipes?.[key]).filter(Boolean);
  recipes.forEach(inspect);
  return { resources: [...resources], staticPaths: [...staticPaths], particles: [...particles], recipes };
}
