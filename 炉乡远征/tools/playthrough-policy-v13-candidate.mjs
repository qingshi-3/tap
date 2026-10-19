// Pure, bounded tactical policy. Only applyAction mutates its explicitly supplied state.
import {getBattleCard,effectiveAttack,findGeneral,attackPositions,movementPositions,summonPositions,spellTargets,spellPositions,battleCommandTargets,canUseHandCard,canReplaceHandCard,toggleMulligan,confirmMulligan,replaceHandCard,attackUnit,moveUnit,playCard,castSpell,useBattleCommand,endTurn,getOpeningFollowup,getSpellFollowup,simulateAttackUnit,restoreMatch,validateMatch} from '../dist/js/engine.js';
import {cardAttackRange} from '../dist/js/attack-range.js';
export const POLICY_VERSION='tactical-v13c-native-flight-backstab-allocator';
const near=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))<=1;
const dist=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
const walkDist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
// Mirror the existing expansion actionQuota contract without introducing a
// relative import that the runner's isolated data-module loader cannot resolve.
function actionQuota(s,u,c){const middle=(s.board.columns-1)/2,enemyHalf=u.owner===0?u.x>middle:u.x<middle;return s.schemaVersion===7&&s.contentVersion==='campaign-2026-10-14-v2'&&(c.celerity||c.infiltrateCelerity&&enemyHalf)?2:1;}
function approachSteps(c,source,target){const dx=Math.abs(source.x-target.x),dy=Math.abs(source.y-target.y),range=cardAttackRange(c);if(c.blast)return Math.min(dx+Math.max(0,dy-range),dy+Math.max(0,dx-range),Math.max(0,dx-1)+Math.max(0,dy-1));return Math.max(0,dx-range)+Math.max(0,dy-range);}
const card=(s,u)=>{
 const base=getBattleCard(s,u.cardId,u.owner);if(!base)return base;
 const expanded=s.schemaVersion===7&&s.contentVersion==='campaign-2026-10-14-v2';
 const rule=s.schemaVersion===7&&u.silenced?Object.fromEntries(Object.entries(base).filter(([key])=>['id','name','type','faction','cost','attack','health','description','sprite','art'].includes(key)||expanded&&key==='race')):base;
 return expanded&&(u.flyingBuff||u.frenzyBuff||u.generalImmuneBuff)?{...rule,flying:rule.flying||u.flyingBuff,frenzy:rule.frenzy||u.frenzyBuff,generalImmune:rule.generalImmune||u.generalImmuneBuff}:rule;
};
const clone=s=>structuredClone(s);
function prospectiveThreat(s,target){
 let sum=0;for(const e of s.units){
  if(e.owner===target.owner||e.health<=0||e.stunTurns>0||e.hatchCardId)continue;const c=card(s,e);
  const blockers=s.units.filter(u=>u.owner!==e.owner&&u.health>0&&near(e,u)&&(card(s,u)?.provoke||u.provokeBuff));if(blockers.length&&!blockers.some(u=>u.unitId===target.unitId))continue;
  const quota=actionQuota(s,e,c),steps=c.obelysk||c.speed===0||blockers.length?0:2*quota;
  const reachable=approachSteps(c,e,target)<=steps||c.flying&&steps>0;
  if(reachable)sum+=(effectiveAttack(s,e)+(c.backstab&&e.y===target.y&&e.x===target.x+(target.owner===0?-1:1)?Number(c.backstab):0))*quota;
 }return sum;
}
// For the general, terrain and occupied paths materially change whether retreat
// is useful. Query native legality on a next-turn-ready copy; never mutate play.
function legalGeneralThreat(s,target){
 let sum=0;
 for(const e of s.units){
  if(e.owner===target.owner||e.health<=0||e.stunTurns>0||e.hatchCardId)continue;
  const c=card(s,e),quota=actionQuota(s,e,c);
  // Geometry is a lower bound only: impossible distances can skip the native
  // query, while every geometrically possible threat still checks real paths.
  const steps=c.obelysk||c.speed===0?0:2*quota;
  if(!c.flying&&approachSteps(c,e,target)>steps)continue;
  const ready={...s,currentPlayer:e.owner,units:s.units.map(u=>({...u,moved:false,attacked:false,summonedThisTurn:false,movesUsed:0,attacksUsed:0}))};
  const source=ready.units.find(u=>u.unitId===e.unitId),positions=[{x:e.x,y:e.y},...movementPositions(ready,source)];
  let reachable=false;
  const seen=new Set(positions.map(p=>`${p.x},${p.y}`));
  for(let i=0;i<positions.length;i++){
   const p=positions[i],moved={...ready,units:ready.units.map(u=>u.unitId===e.unitId?{...u,...p}:u)},unit=moved.units.find(u=>u.unitId===e.unitId);
   if(attackPositions(moved,unit).some(t=>t.unitId===target.unitId)){reachable=true;break;}
   // The first wave is the original square plus one move. Expand only that wave.
   if(quota>1&&!p.second)for(const next of movementPositions(moved,unit)){const key=`${next.x},${next.y}`;if(!seen.has(key)){seen.add(key);positions.push({...next,second:true});}}
  }
  if(reachable)sum+=effectiveAttack(s,e)*quota;
 }
 return sum;
}
function generalRiskWeight(s,g,clockPressure=false){
 if(s.objective?.type==='survive')return 2.6;
 const remaining=Math.max(1,(s.turnLimit??20)-(s.round??1)+1);
 // Health is a resource in a timed assault. Preserve the separate lethal penalty.
 return (clockPressure?1.3:1.7)*Math.max(.4,Math.min(1,12/Math.max(1,g.health)))*Math.min(1,remaining/6);
}
// Only visible enemies and a public ally-targeted general command are inspected.
// No enemy hand, draw pile, future summons or sampled autoAct response is read.
function visibleCoreKill(s,target){
 for(const enemy of s.units){
  if(enemy.owner===target.owner||enemy.health<=0||enemy.stunTurns>0||enemy.hatchCardId)continue;
  const rule=s.enemyPlan?.players?.[enemy.owner];
  const ready={...clone(s),phase:'ai',currentPlayer:enemy.owner};
  ready.units=ready.units.map(u=>u.owner===enemy.owner?{...u,moved:false,attacked:false,summonedThisTurn:false,movesUsed:0,attacksUsed:0}:u);
  const player=ready.players[enemy.owner];player.bbsUsed=false;player.turnTriggers={};
  player.mana=Math.min(rule?.manaCap??30,player.maxMana+(rule?.manaGrowth??1));
  const variants=[ready],command=battleCommandTargets(ready,enemy.owner);
  if(command.available&&command.type==='ally'&&command.unitIds.includes(enemy.unitId)){const buffed=clone(ready);if(useBattleCommand(buffed,enemy.unitId,enemy.owner))variants.push(buffed);}
  for(const variant of variants){
   const source=variant.units.find(u=>u.unitId===enemy.unitId),c=card(variant,source),steps=c.obelysk||c.speed===0?0:c.celerity||c.infiltrateCelerity?4:2;
   if(!c.flying&&approachSteps(c,source,target)>steps)continue;
   const queue=[{state:variant,depth:0}],seen=new Set([`${source.x},${source.y}`]);
   for(let i=0;i<queue.length;i++){
    const {state,depth}=queue[i],unit=state.units.find(u=>u.unitId===enemy.unitId);
    if(attackPositions(state,unit).some(t=>t.unitId===target.unitId)){
     let hit=simulateAttackUnit(state,unit.unitId,target.unitId,enemy.owner);
     if(hit&&!hit.units.some(u=>u.unitId===target.unitId&&u.health>0))return true;
     const attacker=hit?.units.find(u=>u.unitId===enemy.unitId);
     if(attacker&&attackPositions(hit,attacker).some(t=>t.unitId===target.unitId)){hit=simulateAttackUnit(hit,attacker.unitId,target.unitId,enemy.owner);if(hit&&!hit.units.some(u=>u.unitId===target.unitId&&u.health>0))return true;}
    }
    if(depth>=2)continue;
    for(const position of movementPositions(state,unit)){const key=`${position.x},${position.y}`;if(seen.has(key))continue;seen.add(key);const moved=clone(state);if(moveUnit(moved,unit.unitId,position.x,position.y,enemy.owner))queue.push({state:moved,depth:depth+1});}
   }
  }
 }
 return false;
}
function deploymentRisk(after){
 let loss=0;
 for(const unit of after.units){
  if(unit.owner!==0||unit.token||!unit.summonedThisTurn)continue;
  const c=card(after,unit);if(c.cost<3||!(c.flying||c.ranged||c.blast||c.celerity||c.infiltrateCelerity))continue;
  const canActivate=after.players[0].hand.some((id,i)=>{const spell=getBattleCard(after,id,0);return spell.refresh&&canUseHandCard(after,i,0)&&spellTargets(after,spell,0).some(target=>target.unitId===unit.unitId);});
  if(!canActivate&&visibleCoreKill(after,unit))loss+=printedValue(after,unit);
 }
 // A core that one visible enemy can kill before its first action has no current
 // material value. Discount exactly its printed value, rather than tuning a new
 // arbitrary global aggression weight. Cheap scouts and immediate rush trades
 // remain available; the main score still rewards objective proximity.
 return loss;
}
function printedValue(s,u){
 const c=card(s,u),atk=effectiveAttack(s,u)*actionQuota(s,u,c),hatch=u.hatchCardId?getBattleCard(s,u.hatchCardId,u.owner):null;
 const eggValue=hatch?Math.min(20,(hatch.attack*1.15+hatch.health*.65)*.8):0;
 return 2+(c.cost??1)*1.1+Math.min(u.health,14)*.65+atk*1.15+(c.ranged||c.blast?4:0)+(c.provoke||u.provokeBuff?2:0)+(c.obelysk?3:0)+(c.grow?2+Math.min(c.grow,4):0)+(c.rebirth&&!u.reborn?3.5:0)+(c.frenzy?2:0)+eggValue;
}
// Assess only the visible board and remaining objective time. An army that
// cannot reach the target is not equivalent to an army already applying pressure.
function objectivePressure(s){if(s.objective?.type==='survive')return 0;const ratio=Math.min(1,(s.round??0)/Math.max(1,s.turnLimit??20));return 1+ratio*1.8;}
function attackGap(c,pos,target){const range=cardAttackRange(c);if(c.blast){if(near(pos,target))return 0;const axis=Math.min(Math.abs(pos.x-target.x),Math.abs(pos.y-target.y));return Math.max(0,dist(pos,target)-range)+axis*1.5;}if(c.ranged)return Math.max(0,dist(pos,target)-range);return Math.max(0,dist(pos,target)-1);}
// Credit the printed rear-strike mechanism only when the native board permits
// its flight, attack and survival. A newly deployed unit projects its first
// activation; existing units retain their actual action counters.
function flyingRearPotential(s,u){
 const c=card(s,u);if(!c.flying||!c.backstab||u.stunTurns>0||u.hatchCardId)return null;
 if(u.summonedThisTurn&&visibleCoreKill(s,u))return null;
 const ready=clone(s),source=ready.units.find(v=>v.unitId===u.unitId);
 if(source.summonedThisTurn){Object.assign(source,{summonedThisTurn:false,moved:false,attacked:false,movesUsed:0,attacksUsed:0});ready.players[u.owner].turnTriggers={};}
 let best=null;
 for(const target of ready.units.filter(v=>v.owner!==u.owner&&card(ready,v).type==='general')){
  const rear={x:target.x+(target.owner===0?-1:1),y:target.y};
  const trial=clone(ready),attacker=trial.units.find(v=>v.unitId===u.unitId);
  if(attacker.x!==rear.x||attacker.y!==rear.y){
   if(!movementPositions(trial,attacker).some(p=>p.x===rear.x&&p.y===rear.y)||!moveUnit(trial,attacker.unitId,rear.x,rear.y,u.owner))continue;
  }
  if(!attackPositions(trial,attacker).some(v=>v.unitId===target.unitId))continue;
  const hit=simulateAttackUnit(trial,u.unitId,target.unitId,u.owner);if(!hit)continue;
  const survivor=hit.units.find(v=>v.unitId===u.unitId),victim=hit.units.find(v=>v.unitId===target.unitId);
  if(!survivor&&!(hit.phase==='over'&&hit.result==='win'))continue;
  const damage=target.health-(victim?.health??0),counterLoss=u.health-(survivor?.health??0);
  const bonus=Math.max(0,damage-effectiveAttack(trial,attacker))*1.15-counterLoss*.65;
  if(!best||bonus>best.bonus)best={bonus,damage,counterLoss,targetId:target.unitId,rear};
 }
 return best;
}
export function evaluatePosition(s,{aggression=1,clockPressure=false,counterGrowth17=false}={}){
 if(s.phase==='over')return s.result==='win'?1e6:-1e6;const g=findGeneral(s,0);if(!g)return -1e6;
 const survive=s.objective?.type==='survive',pressure=objectivePressure(s)+(clockPressure?0.6:0);
 const enemies=s.units.filter(u=>u.owner!==0&&u.health>0),generals=enemies.filter(u=>card(s,u).type==='general');
 const danger=legalGeneralThreat(s,g),tokens=s.units.filter(u=>u.owner===0&&u.token&&u.health>0).length;
 let score=g.health*6.5-danger*generalRiskWeight(s,g,clockPressure);if(danger>=g.health)score-=300+(danger-g.health)*20;if(g.health<8)score-=(8-g.health)*9;
 if(!survive&&generals.length){const distance=Math.min(...generals.map(e=>walkDist(g,e)));score-=distance*pressure*.7;}
 for(const u of s.units){
  if(u.health<=0)continue;const c=card(s,u);
  if(c.type==='general'){if(u.owner!==0)score-=u.health*(survive?.2:(5+pressure*2)*aggression);continue;}
  const value=printedValue(s,u);
  if(u.owner!==0){score-=value*1.05;continue;}
  const flight=!survive?flyingRearPotential(s,u):null;
  const nearest=enemies.length?Math.min(...enemies.map(e=>attackGap(c,u,e))):0;
  const goalGap=generals.length?Math.min(...generals.map(e=>attackGap(c,u,e))):0;
  const gap=flight?0:!survive?nearest*.4+goalGap*.6:nearest;
  const readiness=survive?1:Math.max(.25,1-gap*.065);
  // Distant surplus tokens or excessive health do not solve a timed attack.
  const tokenScale=u.token?Math.min(1,4/Math.max(4,tokens)):1;
  score+=value*readiness*tokenScale;
  if(flight)score+=flight.bonus;
  const threat=prospectiveThreat(s,u);score-=Math.min(u.health,threat)*(clockPressure?.2:.35);if(threat>=u.health)score-=value*.12;
  if(!survive&&!c.obelysk)score-=gap*pressure*(c.ranged||c.blast?1.35:.9);
  if(c.obelysk&&!survive)score-=Math.max(0,gap-2)*pressure*.6;
  if(c.ranged)score-=enemies.filter(e=>near(e,u)).length*2;
  const ownNear=near(g,u);if(c.zeal&&ownNear)score+=1.2;
  if(c.provoke&&ownNear&&danger>0)score+=2;if(u.specialization==='bodyguard'&&ownNear&&danger>0)score+=1.2;
 }
 if(counterGrowth17)for(const e of enemies){const c=card(s,e);if(c.type!=='general'&&(c.grow||c.ranged||c.blast))score-=printedValue(s,e)*2+effectiveAttack(s,e)*2;}
 if(survive)score+=s.round*1.5;score+=s.players[0].mana*.12+s.players[0].hand.length*.35;return score-deploymentRisk(s);
}
export function applyAction(s,a){switch(a.kind){case'mulligan':s.mulligan=[];for(const i of a.mulliganIndices??[])if(!toggleMulligan(s,i))return false;return confirmMulligan(s);case'replace':return replaceHandCard(s,a.handIndex,0);case'attack':return attackUnit(s,a.sourceId,a.targetId,0);case'move':return moveUnit(s,a.unitId,a.x,a.y,0);case'summon':return playCard(s,a.handIndex,a.x,a.y,0,a.openingTarget??null);case'spell':return castSpell(s,a.handIndex,a.target??null,0);case'bbs':return useBattleCommand(s,a.targetId??a.target??null,0);case'end-turn':return endTurn(s,0,true);default:return false;}}
function movementPriority(s,u,p,enemies){
 const c=card(s,u),generals=enemies.filter(e=>card(s,e).type==='general'),pressure=objectivePressure(s);
 const nearest=generals.length?Math.min(...generals.map(e=>walkDist(e,p))):0;
 if(c.type==='general'){const threat=legalGeneralThreat({...s,units:s.units.map(v=>v.unitId===u.unitId?{...u,...p}:v)},{...u,...p});return -threat*generalRiskWeight(s,u)-nearest*pressure;}
 const gap=enemies.length?Math.min(...enemies.map(e=>attackGap(c,p,e))):0;
 return -gap*2-nearest*pressure*.35-(c.ranged?enemies.filter(e=>near(e,p)).length*8:0);
}
function candidateActions(s){const actions=[],g=findGeneral(s,0),enemy=s.units.filter(u=>u.owner!==0&&u.health>0);for(const u of s.units.filter(u=>u.owner===0)){for(const t of attackPositions(s,u))actions.push({kind:'attack',sourceId:u.unitId,targetId:t.unitId,reason:'比较合法攻击收益与反击代价'});let moves=movementPositions(s,u);if(moves.length>10)moves=moves.sort((a,b)=>movementPriority(s,u,b,enemy)-movementPriority(s,u,a,enemy)).slice(0,10);for(const p of moves)actions.push({kind:'move',unitId:u.unitId,x:p.x,y:p.y,reason:card(s,u).type==='general'?'主将避险或合法接敌':'机动接敌、保护主将与远程距离'});}
 for(let i=0;i<s.players[0].hand.length;i++){if(!canUseHandCard(s,i,0))continue;const id=s.players[0].hand[i],c=getBattleCard(s,id,0);if(c.type==='unit'){let positions=summonPositions(s,0,id);const score=p=>{const d=enemy.length?Math.min(...enemy.map(e=>dist(e,p))):0;return(c.ranged||c.blast?-Math.min(...enemy.map(e=>attackGap(c,p,e)))*1.8:-d*.6)+(c.provoke&&near(p,g)&&prospectiveThreat(s,g)>0?4:0)+(c.zeal&&near(p,g)?2:0)+(s.board?.tiles??[]).some(t=>t.type==='outpost'&&t.x===p.x&&t.y===p.y?true:false)*3};positions=positions.sort((a,b)=>score(b)-score(a)).slice(0,6);for(const p of positions){const follow=getOpeningFollowup(s,id,p,0),openingTarget=follow?.cells?.find(pos=>s.units.some(u=>u.owner!==0&&u.x===pos.x&&u.y===pos.y))??null;if(follow?.type==='cell'){const targetScore=target=>{const nearest=enemy.length?Math.min(...enemy.map(e=>attackGap(c,target,e))):0;return -nearest*.8-prospectiveThreat(s,{...target,owner:0})*.35+(enemy.filter(e=>near(e,target)).length)*(c.openingClone?0:2);};for(const target of [...follow.cells].sort((a,b)=>targetScore(b)-targetScore(a)).slice(0,12))actions.push({kind:'summon',handIndex:i,cardId:id,x:p.x,y:p.y,openingTarget:target,reason:'在合法自由格执行入场复制或格目标效果'});}if(follow?.type==='unit')for(const unitId of follow.unitIds){const next=getOpeningFollowup(s,id,p,0,unitId),targets=next?.type==='cell'?next.cells.map(cell=>({unitId,cell})):[{unitId}];for(const target of targets)actions.push({kind:'summon',handIndex:i,cardId:id,x:p.x,y:p.y,openingTarget:target,reason:'legal opening followup'});}actions.push({kind:'summon',handIndex:i,cardId:id,x:p.x,y:p.y,openingTarget,reason:'以真实费用部署，比较前线/远程/护将位置'});}}else if(c.type==='spell'){const beneficial=['heal','roar','bond','firstWish','greaterFortitude','innerFocus'].includes(c.effect),harmful=['strike','phoenixFire','voidPulse','flashFreeze'].includes(c.effect);if(c.effect==='tempest'||c.target==='self'||c.target==='none'||c.target==='enemyArea'||c.target==='allMinions')actions.push({kind:'spell',handIndex:i,cardId:id,target:null,reason:'全局法术比较敌我净收益'});else if(c.target==='areaCell')for(const p of spellPositions(s,c,0))actions.push({kind:'spell',handIndex:i,cardId:id,target:p,reason:'全棋盘合法区域锚点，含边缘裁切'});else if(c.target==='occupiedCell')for(const t of spellTargets(s,c,0))actions.push({kind:'spell',handIndex:i,cardId:id,target:{x:t.x,y:t.y},reason:'可占用格的合法法术目标'});else if(c.target==='cell')for(const p of spellPositions(s,c,0).sort((a,b)=>Math.min(...enemy.map(e=>dist(e,a)))-Math.min(...enemy.map(e=>dist(e,b)))).slice(0,12))actions.push({kind:'spell',handIndex:i,cardId:id,target:p,reason:'合法格法术'});else {for(const t of spellTargets(s,c,0)){if(c.followup){const f=getSpellFollowup(s,c,t.unitId,0);if(f?.type==='unit')for(const id of f.unitIds)actions.push({kind:'spell',handIndex:i,cardId:c.id,target:{unitIds:[t.unitId,id]},reason:'legal two-unit spell'});if(f?.type==='cell')for(const cell of f.cells)actions.push({kind:'spell',handIndex:i,cardId:c.id,target:{unitId:t.unitId,cell},reason:'legal unit-cell spell'});continue;}if(beneficial&&t.owner!==0||harmful&&t.owner===0)continue;actions.push({kind:'spell',handIndex:i,cardId:id,target:t.unitId,targetId:t.unitId,reason:beneficial?'治疗/强化己方有效目标':'法术清除威胁或斩杀'});}}}}
 const b=battleCommandTargets(s,0);if(b.available){for(const id of b.unitIds)actions.push({kind:'bbs',targetId:id,reason:'1费主将技能的合法目标增益'});if(b.type==='self')actions.push({kind:'bbs',target:null,reason:'使用主将自身技能'});for(const p of b.cells.slice(0,5))actions.push({kind:'bbs',target:p,reason:'主将技能部署'});}actions.push({kind:'end-turn',reason:'保留生命/资源后结束回合'});return actions;}
function scoreCandidates(s,options,limit=10){const base=evaluatePosition(s,options),rows=[];for(const a of candidateActions(s)){const t=restoreMatch(clone(s));if(!applyAction(t,a))continue;if(!validateMatch(t))throw Error('Native candidate action produced an invalid simulation state.');let score=evaluatePosition(t,options);if(a.kind==='end-turn')score-=.05;else if(a.kind==='move')score-=.08;rows.push({a,state:t,score,gain:score-base});}return rows.sort((a,b)=>b.score-a.score).slice(0,limit);}
export function chooseAction(s,options={}){if(options.counterGrowth17&&s.levelId!=='frost-02')options={...options,counterGrowth17:false};if(s.phase==='mulligan'){const mana=s.players[0].mana;if(options.counterGrowth17)return{kind:'mulligan',mulliganIndices:[],reason:'反成长开局：保留可首轮清炮、盾卫联结的组合',policy:'tactical-v3-growth17-opt-in'};if(options.mulliganRanged){const priority=c=>c.ranged?c.id===10021?120:100:c.provoke?70:c.type==='unit'&&c.cost<=2?55:c.effect==='strike'?50:c.type==='unit'?30:c.effect==='heal'?15:0;return{kind:'mulligan',mulliganIndices:s.players[0].hand.map((id,i)=>({i,c:getBattleCard(s,id,0)})).filter(({c})=>!c.ranged).sort((a,b)=>priority(a.c)-priority(b.c)||b.c.cost-a.c.cost).slice(0,2).map(x=>x.i),reason:'独立变体：优先保留远程/护卫，换低即时收益牌寻找远程',policy:'tactical-v1-ranged-mulligan'};}return{kind:'mulligan',mulliganIndices:s.players[0].hand.map((id,i)=>({id,i,c:getBattleCard(s,id,0)})).filter(({c})=>c.type==='spell'&&c.effect!=='strike'&&c.effect!=='heal'||c.cost>mana).sort((a,b)=>b.c.cost-a.c.cost).slice(0,2).map(x=>x.i),reason:'换掉起手高费/缺目标强化牌'};}if(s.currentPlayer!==0||s.phase==='over')return null;
 if(options.counterGrowth17){const hand=s.players[0].hand,g=findGeneral(s,0),allies=s.units.filter(u=>u.owner===0&&card(s,u).type==='unit');if(s.round===1){const shot=hand.indexOf(20066),cannon=s.units.find(u=>u.owner!==0&&u.cardId===406);if(shot>=0&&cannon&&canUseHandCard(s,shot,0)&&getBattleCard(s,20066,0).amount>=cannon.health)return{kind:'spell',handIndex:shot,cardId:20066,target:cannon.unitId,targetId:cannon.unitId,reason:'首轮4伤清除尚未被强化的炮手',policy:'tactical-v3-growth17-opt-in'};const shield=hand.indexOf(19027);if(!allies.length&&shield>=0&&canUseHandCard(s,shield,0)){const cells=summonPositions(s,0,19027),p=cells.find(p=>p.x===g.x+1&&p.y===g.y)??cells[0];if(p)return{kind:'summon',handIndex:shield,cardId:19027,x:p.x,y:p.y,reason:'首轮厚护卫承接满血联结',policy:'tactical-v3-growth17-opt-in'};}const bond=hand.indexOf(20068),target=allies.filter(u=>u.cardId===19027).sort((a,b)=>b.health-a.health)[0];if(bond>=0&&target&&canUseHandCard(s,bond,0)&&s.players[0].mana>=getBattleCard(s,20068,0).cost)return{kind:'spell',handIndex:bond,cardId:20068,target:target.unitId,targetId:target.unitId,reason:'首轮将9血护卫强化为13攻，准备清成长前排',policy:'tactical-v3-growth17-opt-in'};}
 if(s.round===2){const i=hand.indexOf(20068),u=allies.filter(u=>u.cardId===19027&&u.attackBuff<9).sort((a,b)=>b.health-a.health)[0];if(i>=0&&u&&s.players[0].mana>=3)return{kind:'spell',handIndex:i,cardId:20068,target:u.unitId,targetId:u.unitId,reason:'第二轮优先将满血前排护卫联结，再部署支援',policy:'tactical-v3-growth17-opt-in'};}const kills=[];for(const u of allies)for(const p of attackPositions(s,u)){const e=s.units.find(e=>e.unitId===p.unitId),c=card(s,e);if(e.owner!==0&&(c.grow||c.ranged||c.blast)&&effectiveAttack(s,u)>=e.health)kills.push({kind:'attack',sourceId:u.unitId,targetId:e.unitId,value:printedValue(s,e)+(c.grow?20:0)});}if(kills.length){const a=kills.sort((a,b)=>b.value-a.value)[0];delete a.value;return{...a,reason:'优先斩除成长/远程/爆破威胁，避免持续滚雪球',policy:'tactical-v3-growth17-opt-in'};}}
 const top=scoreCandidates(s,options,options.lookahead===false?1:4);if(!top.length)return{kind:'end-turn',reason:'无合法候选'};if(top[0].score>=1e6)return top[0].a;
 // Two-step lookahead sees move→attack, buff→attack and heal→safe position.
 if(options.lookahead!==false)for(const row of top){if(row.state.currentPlayer!==0||row.state.phase==='over')continue;const second=scoreCandidates(row.state,options,1)[0];if(second)row.score=Math.max(row.score,second.score-.08);}
 top.sort((a,b)=>b.score-a.score);const chosen=top[0];if(chosen.a.kind==='end-turn'&&canReplaceHandCard(s,0,0)){const playable=s.players[0].hand.filter((id,i)=>canUseHandCard(s,i,0)&&getBattleCard(s,id,0).type==='unit');if(!playable.length){const worst=s.players[0].hand.map((id,i)=>({id,i,c:getBattleCard(s,id,0)})).sort((a,b)=>(b.c.type==='spell')-(a.c.type==='spell')||b.c.cost-a.c.cost)[0];if(worst&&canReplaceHandCard(s,worst.i,0))return{kind:'replace',handIndex:worst.i,cardId:worst.id,reason:'没有可部署单位时换掉低即时收益手牌'};}}
 return{...chosen.a,score:Number(chosen.score.toFixed(3)),policy:options.counterGrowth17?'tactical-v3-growth17-opt-in':options.clockPressure?'tactical-v2-clock-opt-in':POLICY_VERSION};}
