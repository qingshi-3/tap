// KR1 mobile/Steam Campaign, Normal, with no purchased star upgrades.
// Spawn gaps and projectile speeds are presentation adaptations: the cited public
// references do not publish original per-group spawn timing or pixel velocity.
export const FAMILY_STATS = Object.freeze({
  archer: Object.freeze({
    costs: [70, 110, 160], damage: [[4, 6], [7, 11], [10, 16]],
    interval: [0.8, 0.6, 0.5], range: [140, 160, 180], damageType: "physical",
    projectileSpeed: 500,
  }),
  mage: Object.freeze({
    costs: [100, 160, 240], damage: [[9, 17], [23, 43], [40, 74]],
    interval: [1.5, 1.5, 1.5], range: [140, 160, 180], damageType: "magic",
    projectileSpeed: 300,
  }),
  artillery: Object.freeze({
    costs: [125, 220, 320], damage: [[8, 15], [20, 40], [30, 60]],
    interval: [3, 3, 3], range: [160, 160, 179.2], splash: [62.4, 62.4, 67.2],
    damageType: "explosive", projectileSpeed: 190, groundOnly: true,
  }),
  barracks: Object.freeze({
    costs: [70, 110, 160], soldiers: 3, hp: [50, 100, 150],
    damage: [[1, 3], [3, 4], [6, 10]], armor: [0, 0.15, 0.3],
    interval: [1, 1.37, 1.37], regen: [5, 7, 10], respawn: 10, rallyRadius: 145,
  }),
});

export const STAGE_BALANCE = Object.freeze({
  greenway: Object.freeze({ startingGold: 265, lives: 20, towerLevelCap: 1, waves: 7 }),
  "old-ford": Object.freeze({ startingGold: 220, lives: 20, towerLevelCap: 2, waves: 7 }),
  mirewatch: Object.freeze({ startingGold: 300, lives: 20, towerLevelCap: 2, waves: 11 }),
});

export const WAVE_PLANS = Object.freeze({
  greenway: [[['grunt',3]],[['grunt',6]],[['grunt',9]],[['grunt',4],['armored',1]],[['armored',3]],[['grunt',10],['armored',4]],[['grunt',16]]],
  "old-ford": [[['grunt',20]],[['grunt',24]],[['grunt',12],['armored',4]],[['runner',6]],[['grunt',20],['armored',6]],[['grunt',10],['armored',6],['runner',6]],[['grunt',20],['armored',10],['runner',10]]],
  mirewatch: [[['grunt',24]],[['armored',5],['grunt',5]],[['runner',12]],[['grunt',40]],[['grunt',25],['runner',10]],[['armored',10]],[['grunt',20],['armored',9],['shaman',2]],[['grunt',25],['armored',12],['shaman',2]],[['grunt',45],['runner',10],['armored',6],['shaman',2]],[['grunt',20],['shaman',2],['juggernaut',1]],[['grunt',20],['armored',16],['shaman',4],['juggernaut',2]]],
});

export const SPAWN_GAPS = Object.freeze({ default: 0.52, runner: 0.42, juggernaut: 1.2, group: 0.55 });
export const ABILITY_STATS = Object.freeze({
  reinforcements: Object.freeze({ cooldown: 10, duration: 20, count: 2, hp: 30, damage: [1, 2], interval: 1 }),
  rain: Object.freeze({ cooldown: 80, meteors: 3, damage: [30, 60], radius: 68 }),
});
export const ADAPTATION_NOTES = Object.freeze({
  spawnGaps: "presentation pacing; no public per-group timing source was found",
  soldierMoveSpeed: "75 world units/s presentation adaptation",
  soldierAttackInterval: "levels 2-3 use Wikily's current 1.37 s entry; older community tables conflict",
  barracksUpgrade: "living soldiers preserve HP ratio; dead soldiers remain on their replacement timer",
});
