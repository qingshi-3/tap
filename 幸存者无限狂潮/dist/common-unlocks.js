import { WEAPONS } from './combat-content.js';
import { DUNGEONS } from './campaign.js';

// Unlocks are derived from committed expedition records, never written into the save schema.
const RULES = {
  orb: { kind: 'initial', target: 0 },
  orbit: { kind: 'initial', target: 0 },
  nova: { kind: 'initial', target: 0 },
  dagger: { kind: 'kills', target: 250 },
  lightning: { kind: 'clear', dungeonId: 'moss-gate', target: 1 },
  frost: { kind: 'kills', target: 750 },
  meteor: { kind: 'clear', dungeonId: 'ember-trail', target: 1 },
  mine: { kind: 'kills', target: 1500 },
  beam: { kind: 'wins', target: 3 },
  vortex: { kind: 'kills', target: 2500 },
  familiar: { kind: 'wins', target: 6 },
  aegis: { kind: 'kills', target: 4000 },
};
const count = value => Number.isInteger(value) && value >= 0 ? value : 0;

export function getCommonUnlocks(profile) {
  const kills = count(profile?.progression?.kills);
  const wins = DUNGEONS.reduce((sum, dungeon) => sum + count(profile?.progression?.dungeonWins?.[dungeon.id]), 0);
  return WEAPONS.map(({ id }) => {
    const rule = RULES[id];
    if (!rule) throw new Error(`Missing common unlock rule: ${id}`);
    let current = 0, requirement = '初始开放';
    if (rule.kind === 'kills') {
      current = kills;
      requirement = `累计击败 ${rule.target} 名敌人（远征结算后计入）`;
    } else if (rule.kind === 'wins') {
      current = wins;
      requirement = `累计通关 ${rule.target} 次远征（含试炼，可重复）`;
    } else if (rule.kind === 'clear') {
      current = profile?.cleared?.includes(rule.dungeonId) || count(profile?.progression?.dungeonWins?.[rule.dungeonId]) > 0 ? 1 : 0;
      requirement = `首次通关${DUNGEONS.find(dungeon => dungeon.id === rule.dungeonId).name}`;
    }
    return { id, unlocked: current >= rule.target, requirement, progress: Math.min(current, rule.target), current, target: rule.target };
  });
}

export function getUnlockedCommonIds(profile) {
  return getCommonUnlocks(profile).filter(entry => entry.unlocked).map(entry => entry.id);
}
