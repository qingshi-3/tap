import { getCareerWeapon } from './profession-content.js';
export const ATTACK_DAMAGE_SCALE=Object.freeze([1,1.15,1.3,1.5]);
export const BASIC_WEAPON_GEOMETRY=Object.freeze({
 commander:Object.freeze({range:[210,270,300,320],halfWidth:[18,26,28,36],projectiles:[1,1,2,3],pierce:[3,5,5,6]}),
 summoner:Object.freeze({range:520,projectiles:[1,2,3,3],chainRadius:150}),
 blink:Object.freeze({range:570,projectiles:[1,3,3,5],fanAngle:.24,outerAngle:.48,focusedAngle:.08}),
 mage:Object.freeze({range:500,projectiles:[1,2,3,3],blastRadius:[42,50,56,80]})
});
export function ensureAttackProgress(game){
 const p=game.attackProgress;
 if(!p||!Number.isInteger(p.rank)||p.rank<1||p.rank>4||p.rank===4&&!['a','b'].includes(p.branch))game.attackProgress={rank:1,branch:null};
 if(game.attackProgress.rank<4)game.attackProgress.branch=null;
 return game.attackProgress;
}
function dataFor(game,index){return getCareerWeapon(game,index)||getCareerWeapon({heroId:"commander"},index);}
export function getAttackProgressionInfo(game){const p=ensureAttackProgress(game),data=dataFor(game,p.rank===4?(p.branch==='a'?3:4):p.rank-1);return {...p,name:data[0],damageMultiplier:ATTACK_DAMAGE_SCALE[p.rank-1],description:data[1],meter:`专属${['Ⅰ','Ⅱ','Ⅲ','Ⅳ'][p.rank-1]} · ${data[0]}`};}
export function getAttackUpgradeChoices(game){const p=ensureAttackProgress(game);if(p.rank===4)return [];return (p.rank===3?[['a',3],['b',4]]:[[`rank${p.rank+1}`,p.rank]]).map(([id,index])=>({id:`attack:${id}`,category:'attack',tag:p.rank===3?'专属武器进化 · 本局二选一':'专属武器成长',title:`专属${['Ⅰ','Ⅱ','Ⅲ','Ⅳ'][Math.min(p.rank,3)]} · ${dataFor(game,index)[0]}`,description:dataFor(game,index)[1],icon:'✦',level:p.rank+1}));}
export function applyAttackUpgrade(game,id){if(!getAttackUpgradeChoices(game).some(c=>c.id===id))return false;const p=ensureAttackProgress(game);p.rank++;p.branch=p.rank===4?id.split(':')[1]:null;return true;}
