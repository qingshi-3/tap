import { getAttackUpgradeChoices, applyAttackUpgrade } from './attack-progression.js';
import { WEAPONS } from './combat-content.js';
import { HERO_PERKS } from './hero-kit.js';

export const COMMON_SLOT_LIMIT = 2;
export const GROWTH_STATS = [
  {id:'damage',name:'战意',description:'全部伤害 +10% 基础值。',icon:'✧',max:4},
  {id:'area',name:'延展',description:'范围半径或命中宽度 +10%；扇形角度、施法距离与位移距离不变。',icon:'◌',max:4},
  {id:'haste',name:'技能急速',description:'技能与通用能力释放频率 +10%；持续伤害的跳伤间隔不变。',icon:'⌛',max:4},
  {id:'attackSpeed',name:'连击',description:'英雄普攻与契灵攻击频率 +10%；不延长无敌。',icon:'»',max:4},
  {id:'duration',name:'绵延',description:'持续伤害区域时间 +10%；不延长护盾、无敌或瞬移保护。',icon:'∞',max:3},
  {id:'vitality',name:'体魄',description:'最大生命 +12，同时恢复 12 点生命。',icon:'♡',max:3},
  {id:'speed',name:'轻步',description:'移动速度 +5% 基础值；不改变突进距离。',icon:'➤',max:3},
  {id:'pickup',name:'集魂',description:'魂晶吸附范围 +20% 基础值。',icon:'✦',max:3},
];
export function getOwnedCommon(game) { return WEAPONS.filter(w => game.upgrades[w.id] > 0); }
export function getCommonEvolutionState(game, id) {
  const weapon=WEAPONS.find(w=>w.id===id);
  if(!weapon)return null;
  const duration=Number(game.duration), requiredTime=Math.min(90,Math.max(40,(Number.isFinite(duration)&&duration>0?duration:360)*.25));
  const level=Math.max(0,Number(game.upgrades?.[id])||0), growthRank=Math.max(0,Number(game.growth?.[weapon.requiredGrowth])||0);
  const elapsed=Math.max(0,Number(game.time)||0), remainingLevels=Math.max(0,weapon.basicMax-level), remainingRank=Math.max(0,1-growthRank), remainingTime=Math.max(0,requiredTime-elapsed);
  const evolved=level>=weapon.max, eligible=!evolved&&!remainingLevels&&!remainingRank&&!remainingTime;
  return {eligible,evolved,requiredGrowth:weapon.requiredGrowth,requiredRank:1,requiredTime,remainingLevels,remainingRank,remainingTime,reason:evolved?'evolved':remainingLevels?'level':remainingRank?'growth':remainingTime?'time':'ready'};
}
// Old ranks remain readable; draft the skill specializations rather than charging again for auto-chain features.
// Historical run ranks remain readable, but retired-button upgrades must never
// consume a new level-up choice after the two-active simplification.
const RETIRED_SKILL_PERKS=new Set(['sword_focus','spiral_control','petal_current','magnet_press']);
function perksFor(game) { return (HERO_PERKS[game.heroId || 'commander'] || []).filter(perk=>perk.category==='heroSkill'&&!RETIRED_SKILL_PERKS.has(perk.id)); }
function durationEligible(game) {
  return game.evolutions.meteor==='a' || game.evolutions.mine==='b' || game.skillLoadout.some(id=>['flameBreath','rockWall','frostAura','swordField','magnetField','spiralOrb','spiralClone','spiralConvergence','petalBloom'].includes(id)) || getOwnedCommon(game).some(w=>w.tags?.includes('duration'));
}
export function buildUpgradePool(game) {
  const pool = [...getAttackUpgradeChoices(game)], owned = getOwnedCommon(game);
  for (const perk of perksFor(game)) {
    const rank = game.heroPerks[perk.id] || 0;
    if(rank < perk.max) pool.push({id:`hero:${perk.id}`,category:perk.category || 'hero',tag:perk.category==='heroSkill'?'专属战技':'英雄机制',title:`${perk.name} · ${rank+1}/${perk.max}`,description:perk.description,icon:perk.icon || '✧',level:rank+1});
  }
  for (const weapon of WEAPONS) {
    const rank = game.upgrades[weapon.id] || 0;
    // Existing harnesses without a campaign snapshot keep the full content pool.
    // Owned ranks remain upgradeable even if a caller supplies a narrower snapshot.
    if (!rank && game.availableCommonIds !== undefined && !game.availableCommonIds.includes(weapon.id)) continue;
    if (!rank && owned.length >= COMMON_SLOT_LIMIT) continue;
    if (rank >= weapon.max) continue;
    if (rank >= weapon.basicMax) {
      if(!getCommonEvolutionState(game,weapon.id).eligible)continue;
      for (const branch of weapon.branches) pool.push({id:`evolve:${weapon.id}:${branch.id}`,category:'evolution',tag:'进化 · 二选一',weaponId:weapon.id,branchId:branch.id,title:branch.name,description:`${branch.description} 本局锁定此路线。`,icon:weapon.icon,level:weapon.max,evolved:true});
    } else pool.push({id:`common:${weapon.id}`,category:'common',tag:rank?'通用强化':`通用能力 · ${owned.length}/2 槽`,weaponId:weapon.id,title:`${weapon.name} · Lv.${rank+1}`,description:weapon.levelDescriptions?.[rank] || weapon.description,icon:weapon.icon,level:rank+1});
  }
  for (const stat of GROWTH_STATS) {
    const rank = game.growth[stat.id] || 0;
    if(rank >= stat.max || stat.id==='duration' && !durationEligible(game)) continue;
    pool.push({id:`stat:${stat.id}`,category:'stat',tag:'基础属性',title:`${stat.name} · ${rank+1}/${stat.max}`,description:stat.description,icon:stat.icon,level:rank+1});
  }
  return pool;
}
export function makeUpgradeChoices(game, random) {
  const pool = buildUpgradePool(game), result=[];
  const pick = entries => {
    const available=entries.filter(c=>!result.some(r=>r.id===c.id));
    if(available.length) result.push(available[Math.min(available.length-1,Math.floor(random()*available.length))]);
  };
  const evolutions=pool.filter(c=>c.category==='evolution'), attacks=pool.filter(c=>c.category==='attack');
  const requiredStats=getOwnedCommon(game).filter(w=>game.upgrades[w.id]===w.basicMax&&getCommonEvolutionState(game,w.id).remainingRank>0).map(w=>`stat:${w.requiredGrowth}`);
  const missingStats=pool.filter(c=>requiredStats.includes(c.id));
  const pickSupport=entries=>pick(missingStats.length?missingStats:entries);
  const attackBranches=attacks.length===2;
  // Rotate competing branch windows on presentation, including repeated refusal.
  const commonWindow=evolutions.length&&(!attackBranches||game._growthBranchTurn==='common');
  if(commonWindow){
    const id=evolutions[Math.floor(random()*evolutions.length)].weaponId;
    result.push(...evolutions.filter(c=>c.weaponId===id));
    pickSupport(attacks.length===1?attacks:pool.filter(c=>!['attack','evolution'].includes(c.category)));
    if(attackBranches)game._growthBranchTurn='attack';
  }else if(attackBranches){
    result.push(...attacks);pickSupport(pool.filter(c=>!['attack','evolution'].includes(c.category)));
    if(evolutions.length)game._growthBranchTurn='common';
  }else{
    pick(attacks.length?attacks:pool.filter(c=>c.id.startsWith('hero:')));
    const common=pool.filter(c=>c.category==='common'),upgrades=common.filter(c=>game.upgrades[c.weaponId]>0),acquire=common.filter(c=>!game.upgrades[c.weaponId]);
    pick(upgrades.length&&(!acquire.length||random()<.45)?upgrades:acquire);
    pickSupport(pool.filter(c=>c.id.startsWith('hero:')||c.category==='stat'));
  }
  const fallback=pool.filter(c=>!(commonWindow&&attackBranches&&c.category==='attack')&&!(attackBranches&&!commonWindow&&c.category==='evolution'));
  while(result.length<3 && fallback.some(c=>!result.some(r=>r.id===c.id))) pick(fallback);
  // Exhaustion rewards keep late runs valid without adding hidden permanent stats.
  const supplies=[
    {id:'supply:heal',title:'应急补给',description:'在脚下放置生命补给，可留待受伤时拾取。',icon:'♡'},
    {id:'supply:magnet',title:'魂晶牵引',description:'开启 8 秒魂晶磁吸。',icon:'✦'},
    {id:'supply:focus',title:'战技整备',description:'所有主动技能冷却缩短 3 秒。',icon:'⌛'},
  ];
  for(const c of supplies) if(result.length<3) result.push({...c,category:'supply',tag:'战地补给'});
  return result;
}
export function applyGrowthUpgrade(game, id) {
  const choice=buildUpgradePool(game).find(c=>c.id===id);
  if(!choice)return false;
  const [kind,key,branch] = id.split(':');
  if(kind==='attack')return applyAttackUpgrade(game,id);
  if(kind==='hero') game.heroPerks[key]=(game.heroPerks[key]||0)+1;
  else if(kind==='stat') {
    game.growth[key]=(game.growth[key]||0)+1;
    if(key==='vitality'){game.player.maxHp+=12;game.player.hp=Math.min(game.player.maxHp,game.player.hp+12);}
    if(key==='speed')game.player.speed=205*(1+.05*game.growth.speed);
  } else if(kind==='common')game.upgrades[key]=(game.upgrades[key]||0)+1;
  else if(kind==='evolve'){game.evolutions[key]=branch;game.upgrades[key]=WEAPONS.find(w=>w.id===key).max;}
  else return false;
  return true;
}

const alternativeDraftCache = new WeakMap();
// Cache both success and exhaustion while upgrade simulation is frozen. Include pool inputs
// by value so in-place rank/unlock edits invalidate the probe as well as new choice arrays.
export function findAlternativeUpgradeChoices(game) {
  const key=JSON.stringify([game._seed,game._growthBranchTurn,game.time,game.duration,game.heroId,game.player?.heroId,
    game.attackProgress,game.upgrades,game.evolutions,game.growth,game.heroPerks,game.skillLoadout,game.availableCommonIds,
    game.choices.map(c=>c.id)]);
  const cached=alternativeDraftCache.get(game);
  if(cached?.choices===game.choices && cached.key===key)return cached.result;
  const previous = [...game.choices].map(c=>c.id).sort().join('|');
  let seed = game._seed >>> 0;
  const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  for(let attempt=0;attempt<256;attempt++) {
    const draft = {...game, attackProgress:game.attackProgress ? {...game.attackProgress} : undefined};
    const choices = makeUpgradeChoices(draft,random);
    if(choices.map(c=>c.id).sort().join('|')!==previous) {
      const result={choices, branchTurn:draft._growthBranchTurn, seed};
      alternativeDraftCache.set(game,{choices:game.choices,key,result});
      return result;
    }
  }
  alternativeDraftCache.set(game,{choices:game.choices,key,result:null});
  return null;
}
