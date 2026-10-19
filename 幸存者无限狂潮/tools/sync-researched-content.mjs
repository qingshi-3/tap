// Explicit content synchronization from the reviewed design. Does not alter saves or task status.
import {readFile,writeFile} from 'node:fs/promises';
import {HEROES,HERO_JOBS,SKILL_DEFINITIONS} from '../dist/heroes.js';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8'),write=(p,s)=>writeFile(new URL(p,root),s);
const design=JSON.parse(await read('output/hero-ascension/combat-design-reviewed.json'));
const ids={commander:['dash','cleave','whirlwind'],summoner:['summonGuard','recallSummons','summonElite'],blink:['markBlade','blinkStrike','blinkStorm'],mage:['flameBreath','frostAura','rockWall'],grappler:['grappleHook','grappleSlam','grappleClash'],rift:['riftGate','riftStep','riftBarrage'],magnet:['magnetField','magnetLance','magnetCrush'],sword:['swordFocus','swordRecall','swordUnion'],spiral:['spiralOrb','spiralClone','spiralConvergence'],petal:['petalSweep','petalPierce','petalBloom']};
const names={summonGuard:'军令集结',recallSummons:'灵骸爆破',summonElite:'巨灵降临',markBlade:'影袭切入',blinkStrike:'归影脱身',blinkStorm:'死印追猎',flameBreath:'焰息',frostAura:'霜环护身',rockWall:'陨星天降',grappleClash:'魔手投杀',riftBarrage:'界晶轰流',magnetLance:'磁轨轰击',magnetCrush:'机甲展开',spiralConvergence:'巨丸破阵',petalSweep:'散华布刃',petalPierce:'回羽牵刃',petalBloom:'千花羽舞'};
const shapes={markBlade:'dash',blinkStrike:'dash',blinkStorm:'circle',summonGuard:'line',recallSummons:'circle',summonElite:'circle',frostAura:'self',rockWall:'circle',spiralClone:'circle',spiralConvergence:'line',swordRecall:'line',petalPierce:'self',petalBloom:'self',magnetCrush:'self'};
const skills=structuredClone(SKILL_DEFINITIONS),jobs=structuredClone(HERO_JOBS),heroes=structuredClone(HEROES);
const combat={},progress={};
for(const h of design.heroes){
 const chain=Object.values(jobs).filter(j=>j.heroId===h.id).sort((a,b)=>a.tier-b.tier);
 const hero=heroes.find(x=>x.id===h.id);Object.assign(hero,{description:h.identity,passive:h.identity,subtitle:h.tierIdentity[0],skills:ids[h.id]});
 progress[h.id]={jobs:chain.map(j=>j.id),identity:h.identity,tierIdentity:h.tierIdentity,basic:h.basic.map(b=>b.ranks)};
 for(const [i,j]of chain.entries()){
  Object.assign(j,{benefit:h.tierIdentity[i]+'。'+h.basic[i].ranks[0],description:h.active.map(a=>a.stages[i]).join(' ')});
  combat[j.id]={loop:h.tierIdentity[i],basic:h.basic[i].ranks[0],skills:Object.fromEntries(h.active.map((a,k)=>[ids[h.id][k],a.stages[i]]))};
 }
 for(const [i,id]of ids[h.id].entries())Object.assign(skills[id],{name:names[id]||skills[id].name,description:h.active[i].stages[0],jobs:chain.map(j=>j.id),level:1,...(shapes[id]?{aimType:shapes[id]}:{})});
}
jobs.blade_master.name='风刃剑圣';jobs.rift_sovereign.name='界门主宰';
// The old spell IDs keep their saves, while E frost and R meteor exchange roles.
skills.frostAura.cooldown=12;skills.rockWall.cooldown=22;
// Old loadouts remain valid; their IDs are aliases of the current three techniques.
const aliases={guard:'whirlwind',swordField:'whirlwind',bladeWave:'cleave',quickCut:'dash'};
for(const [id,target]of Object.entries(aliases))Object.assign(skills[id],{name:skills[target].name,description:skills[target].description,aimType:skills[target].aimType});
const previous=await read('dist/heroes.js'),suffix=previous.slice(previous.indexOf('export function getHero('));
await write('dist/heroes.js',`// Stable content IDs are retained across the researched combat redesign.\nexport const SKILL_DEFINITIONS=Object.freeze(${JSON.stringify(skills,null,2)});\nconst RAW_HEROES=${JSON.stringify(heroes,null,2)};\nexport const HEROES=Object.freeze(RAW_HEROES.map(h=>Object.freeze({...h,skills:Object.freeze(h.skills.map((id,i)=>Object.freeze({key:['Q','E','R'][i],id,name:SKILL_DEFINITIONS[id].name,description:SKILL_DEFINITIONS[id].description})))})));\nexport const HERO_JOBS=Object.freeze(${JSON.stringify(jobs,null,2)});\n${suffix}`);
await write('dist/profession-content.js',`// Player-facing career and run-local weapon changes from the reviewed design.\nexport const JOB_COMBAT=Object.freeze(${JSON.stringify(combat,null,2)});\nexport const HERO_PROGRESSIONS=Object.freeze(${JSON.stringify(progress,null,2)});\nconst aliases=${JSON.stringify(aliases)};\nexport function getJobCombat(job){return JOB_COMBAT[job]||null;}\nexport function getJobSkillDescription(job,id,fallback=''){return JOB_COMBAT[job]?.skills[aliases[id]||id]||fallback;}\nexport function recommendedSkills(job,level,fallback){return Object.keys(JOB_COMBAT[job]?.skills||{}).length?Object.keys(JOB_COMBAT[job].skills):[...fallback];}\nexport function getCareerWeapon(game,index){\n const h=HERO_PROGRESSIONS[game.heroId||game.player?.heroId];if(!h)return null;\n const tier=Math.max(0,h.jobs.indexOf(game.heroJob||game.player?.job));let description=h.basic[tier][Math.min(3,index)];\n if(index>=3){const split=description.match(/^A[：:]?([\\s\\S]*?)[；;]B[：:]?([\\s\\S]*)$/);if(split)description=split[index===3?1:2];}\n return [h.tierIdentity[tier]+' · '+['起式','衍式','化式','清群','破强'][index],description];\n}\n`);
console.log('Synchronized ten heroes, thirty careers, ninety active forms and independent weapon descriptions.');
