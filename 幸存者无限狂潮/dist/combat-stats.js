// Run-local growth. Geometry, casting range and movement distance are separate contracts.
const ranks = (game, id, cap = 4) => Math.max(0, Math.min(cap, Number(game.growth?.[id]) || 0));
export function getCombatStats(game) {
  return {
    damage: (game.player?.damageMultiplier || 1) * (1 + ranks(game, 'damage') * .1),
    area: 1 + ranks(game, 'area') * .1,
    haste: 1 + ranks(game, 'haste') * .1,
    attackSpeed: 1 + ranks(game, 'attackSpeed') * .1,
    duration: 1 + ranks(game, 'duration', 3) * .1,
  };
}
const SHAPES = Object.freeze({
  swordFocus:{shape:'circle',radius:75,length:220},
  swordRecall:{shape:'self',radius:65},
  swordUnion:{shape:'circle',radius:95,length:110,duration:1.25},
  spiralOrb:{shape:'capsule',length:210,width:32,radius:55,duration:3},
  spiralClone:{shape:'self',radius:75,duration:5},
  spiralConvergence:{shape:'circle',radius:105,length:110,duration:2.6},
  petalSweep:{shape:'sector',radius:210,angle:1.6},
  petalPierce:{shape:'self',radius:65,length:65},
  petalBloom:{shape:'self',radius:135,duration:2.5},
  grappleHook: { shape:'capsule', length:260, width:22 },
  grappleSlam: { shape:'circle', radius:90, length:78 },
  grappleClash: { shape:'circle', radius:125, length:105 },
  riftGate: { shape:'circle', radius:30, length:240, duration:8 },
  riftStep: { shape:'capsule', length:240, width:30 },
  riftBarrage: { shape:'capsule', length:410, width:26 },
  magnetField: { shape:'self', radius:120, duration:4 },
  magnetLance: { shape:'capsule', length:410, width:14 },
  magnetCrush: { shape:'self', radius:65, duration:4 },
  dash: { shape:'capsule', length:135, width:34, duration:.28 },
  quickCut: { shape:'capsule', length:96, width:34, duration:.16 },
  cleave: { shape:'sector', radius:225, angle:1.4 },
  flameBreath: { shape:'sector', radius:235, angle:1.16, duration:3 },
  swordField: { shape:'circle', radius:175, length:170, duration:5 },
  whirlwind: { shape:'circle', radius:165 },
  frostAura: { shape:'circle', radius:150, duration:6 },
  blinkStrike: { shape:'capsule', radius:96, width:24, length:600, duration:.20 },
  blinkStorm: { shape:'capsule', radius:96, width:24, length:600, duration:.13 },
  rockWall: { shape:'arc', radius:90, angle:Math.PI*5/6, width:22, duration:6 },
  bladeWave: { shape:'capsule', length:640, width:24 },
  markBlade: { shape:'capsule', length:240, width:10 },
  guard: { shape:'self', radius:72, duration:3.2 },
  summonGuard: { shape:'self', radius:54 },
  summonElite: { shape:'self', radius:54 },
  recallSummons: { shape:'self', radius:62 },
});
export function getSkillGeometry(game, id) {
  const hero=game.heroId||game.player?.heroId,job=game.heroJob||game.player?.job;
  if(['commander','summoner','blink','mage'].includes(hero)){
    const tier=['blade_master','summoner_sovereign','blink_sovereign','mage_sovereign'].includes(job)?3:['swift_blade','summoner_master','blink_master','mage_master'].includes(job)?2:1;
    const alias={quickCut:'dash',bladeWave:'cleave',swordField:'whirlwind',guard:'whirlwind'},skill=alias[id]||id;
    const form={dash:{shape:'capsule',length:170,width:tier===3?42:25,duration:.28},cleave:{shape:'sector',radius:tier===3&&game.originalHero?.momentum>=12?230:140,angle:tier===3?2.4:1.8},whirlwind:{shape:'self',radius:tier===3?170:125,duration:2.4},markBlade:{shape:'capsule',length:220,width:25},blinkStrike:{shape:'capsule',length:100,width:25},blinkStorm:{shape:'circle',length:500,radius:40,duration:2.4},flameBreath:tier===1?{shape:'sector',radius:210,angle:1.1,duration:2.5}:{shape:'capsule',length:520,width:25,duration:2.5},frostAura:{shape:'self',radius:145},rockWall:{shape:'circle',length:260,radius:110+12*Math.min(2,game.heroPerks?.mage_stone||0),duration:.75},summonGuard:{shape:'circle',length:200,radius:65},recallSummons:{shape:'self',radius:260},summonElite:{shape:'self',radius:110}}[skill];
    if(form){const result={...form},area=getCombatStats(game).area;if(result.radius)result.radius*=area;if(result.width)result.width*=area;return result;}
  }
  const base = SHAPES[id] || { shape:'self', radius:48 };
  const stats = getCombatStats(game), result = { ...base };
  if (base.shape === 'circle' || base.shape === 'sector' || base.shape === 'arc') result.radius *= stats.area;
  if (base.shape === 'capsule') result.width *= stats.area;
  if (['blinkStrike','blinkStorm'].includes(id)) result.radius *= stats.area;
  if(id==='grappleHook')result.width+=8*Math.min(2,game.heroPerks?.grappler_grip||0);
  if(id==='grappleSlam'||id==='grappleClash')result.radius+=15*Math.min(2,game.heroPerks?.grappler_impact||0);
  if(id==='magnetField')result.radius=(base.radius+12*Math.min(2,game.heroPerks?.magnet_storage||0))*stats.area;
  if(id==='magnetLance')result.width+=5*Math.min(2,game.heroPerks?.magnet_press||0);
  if(id==='riftGate'||id==='riftStep')result.length=Math.min(240,Math.min(game.viewport?.width||844,game.viewport?.height||390)*.42);
  if(id==='riftGate')result.radius=30;
  if(id==='swordFocus')result.length=Math.min(220,Math.min(game.viewport?.width||844,game.viewport?.height||390)*.4);
  if(id==='spiralOrb')result.radius=base.radius*stats.area;
  if(['spiralOrb','spiralClone','spiralConvergence','petalBloom'].includes(id))result.duration*=stats.duration;
  // Protection windows and travel times never scale with duration.
  if (['flameBreath','frostAura','swordField','rockWall'].includes(id)) result.duration *= stats.duration;
  if(id==='magnetField')result.duration*=stats.duration;
  return result;
}
export function getSkillCooldown(game, id, base) {
  const cooldown = base / getCombatStats(game).haste;
  return cooldown;
}
export function pointInSector(point, origin, facing, radius, angle) {
  const dx = point.x-origin.x, dy = point.y-origin.y;
  const delta = Math.atan2(Math.sin(Math.atan2(dy,dx)-facing),Math.cos(Math.atan2(dy,dx)-facing));
  return dx*dx+dy*dy <= radius*radius && Math.abs(delta) <= angle/2;
}
