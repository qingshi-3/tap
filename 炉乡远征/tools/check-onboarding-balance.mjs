import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {autoAct,createExpeditionMatch,findGeneral,endTurn,moveUnit,attackUnit,playCard,castSpell,useBattleCommand,effectiveAttack,validateMatch} from '../dist/js/engine.js';
import {EXPEDITION_LEVELS,TRAINABLE_IDS,TRAINING_COSTS} from '../dist/js/expedition-data.js';
import {CARDS} from '../dist/js/cards.js';
import {FACTIONS,HEROES} from '../dist/js/factions.js';
import {ExpeditionProgress} from '../dist/js/expedition-progress.js';
const OUT=new URL('../output/',import.meta.url);mkdirSync(OUT,{recursive:true});
const labelArg=process.argv.indexOf('--label'),LABEL=labelArg<0?'':process.argv[labelArg+1];
if(LABEL&&!/^[a-z0-9-]+$/i.test(LABEL))throw Error('label must contain letters/numbers/hyphens');
const output=(kind)=>new URL(`onboarding-balance-${LABEL?LABEL+'-':''}${kind}.json`,OUT);
const RANKS=[0,2,4],LIMIT=1800;
const clone=value=>structuredClone(value);
function trainingFor(faction,rank){return Object.fromEntries(TRAINABLE_IDS.map(id=>[id,faction.unitIds.includes(id)?rank:0]));}
function simulate(heroId,levelId,training,policy='auto',squadOverride=null){
 const faction=FACTIONS.find(f=>f.heroIds.includes(heroId));const squad=squadOverride??faction.defaultSquad;const state=createExpeditionMatch(levelId,training,squad,heroId);
 let actions=0,openingDelayed=false,serial=-1,budget=null,turnActions=0;const mistakes=[],badHeals=[],badSpells=[];
 while(state.phase!=='over'&&actions<LIMIT){
  const own=state.currentPlayer===0;const targetsBefore=new Map(state.units.map(u=>[u.unitId,{...u}]));
  if(own&&state.turnSerial!==serial){serial=state.turnSerial;turnActions=0;budget=null;
   if(policy==='miss-last-action'){const probe=clone(state);let planned=0;while(probe.phase!=='over'&&probe.currentPlayer===0&&planned<100){autoAct(probe,0);if(probe.lastAction?.kind==='end-turn')break;planned++;}budget=Math.max(0,planned-1);}
  }
  let handled=false;
  if(own&&policy==='delay-opening'&&!openingDelayed){openingDelayed=true;mistakes.push({round:state.round,type:'skip-opening-turn'});handled=endTurn(state,0,true);}
  else if(own&&policy==='miss-last-action'&&turnActions>=budget){mistakes.push({round:state.round,type:'end-one-action-early',completed:turnActions});handled=endTurn(state,0,true);}
  else if(own&&policy==='cautious-general'){
   const probe=clone(state);autoAct(probe,0);const a=probe.lastAction,g=findGeneral(state,0);if(g&&a?.unitId===g.unitId&&a.kind==='move'){
    const projected=findGeneral(probe,0);const danger=probe.units.filter(u=>u.owner!==0&&Math.max(Math.abs(u.x-projected.x),Math.abs(u.y-projected.y))<=1).reduce((n,u)=>n+u.attack+(u.attackBuff??0),0);
    if(danger>=Math.max(3,g.health/3)){mistakes.push({round:state.round,type:'decline-general-exposure-end-turn',danger});handled=endTurn(state,0,true);}
   }
  }
  if(!handled){if(own&&policy==='reasonable-guard')guardedAct(state,mistakes);else if(own&&policy.startsWith('reasonable-'))reasonableAct(state,mistakes);else autoAct(state,state.currentPlayer);}const a=state.lastAction,t=targetsBefore.get(a?.targetId);if(own&&a?.kind==='spell'&&a.effect==='heal'&&t?.owner!==0)badHeals.push({round:state.round,spell:a.cardId,target:a.targetId,targetCard:t?.cardId,targetOwner:t?.owner,hpBefore:t?.health,hpAfter:state.units.find(u=>u.unitId===t?.unitId)?.health??0});if(own&&wrongTeamSpell(a,t))badSpells.push({round:state.round,spell:a.cardId,effect:a.effect,targetCard:t.cardId,targetOwner:t.owner,hpBefore:t.health,hpAfter:state.units.find(u=>u.unitId===t.unitId)?.health??0});if(own)turnActions++;actions++;
 }
 const report={heroId,hero:HEROES[heroId].name,factionId:faction.id,levelId,policy,squad,training:Object.fromEntries(squad.map(id=>[id,training[id]??0])),result:state.phase==='over'?state.result:'timeout',reason:state.resultReason??'action-cap',round:state.round,actions,generalHp:findGeneral(state,0)?.health??0,remainingUnits:state.units.filter(u=>u.owner===0).length,badHeals,badSpells,enemyHp:state.players.filter(p=>p.id!==0).map(p=>({owner:p.id,hp:findGeneral(state,p.id)?.health??0})),mistakes};
 return {state,report};
}
function replayChosen(state,a){const index=state.players[0].hand.indexOf(a.cardId);switch(a.kind){case 'move':return moveUnit(state,a.unitId,a.x,a.y,0);case 'attack':return attackUnit(state,a.sourceId??a.unitId,a.targetId,0);case 'summon':return playCard(state,index,a.x,a.y,0);case 'spell':return castSpell(state,index,a.cell??a.targetId??null,0);case 'bbs':return useBattleCommand(state,HEROES[state.players[0].generalId].target==='self'?null:a.cell??a.targetId??null,0);case 'end-turn':return endTurn(state,0,true);default:throw Error('unsupported replay action '+a.kind);}}
function wrongTeamSpell(a,target){if(a?.kind!=='spell'||!target)return false;const support=['heal','bond','buff','buffDraw','refresh'];const harm=['strike','flashFreeze','damage','drain','stun','phoenixFire','voidPulse','damageArea'];return support.includes(a.effect)?target.owner!==0:harm.includes(a.effect)?target.owner===0:false;}
function reasonableAct(state,declines){const decision=clone(state);for(let attempt=0;attempt<=state.players[0].hand.length;attempt++){const probe=clone(decision);autoAct(probe,0);const a=probe.lastAction,target=state.units.find(u=>u.unitId===a?.targetId);if(wrongTeamSpell(a,target)){declines.push({round:state.round,type:'decline-wrong-team-spell',effect:a.effect,spell:a.cardId,targetId:target.unitId,targetCard:target.cardId});const index=decision.players[0].hand.lastIndexOf(a.cardId);assert.ok(index>=0);decision.players[0].hand.splice(index,1);continue;}assert.ok(replayChosen(state,a),'reasonable chosen action legal '+JSON.stringify(a));assert.ok(validateMatch(state),'reasonable real snapshot validates');return;}throw Error('heal decision loop cap');}
class MemoryStorage{data=new Map();getItem(key){return this.data.get(key)??null;}setItem(key,value){this.data.set(key,String(value));}removeItem(key){this.data.delete(key);}}
function invest(p,squad){const upgrades=[];while(true){const s=p.state,candidates=squad.filter(id=>s.training[id]<TRAINING_COSTS.length).sort((a,b)=>s.training[a]-s.training[b]||squad.indexOf(a)-squad.indexOf(b));const id=candidates[0];if(id==null||s.coins<TRAINING_COSTS[s.training[id]])break;const r=p.train(id);assert.ok(r.ok,r.error);upgrades.push(r);}return upgrades;}
function guardedThreat(state,g){if(!g)return Infinity;return state.units.filter(u=>u.owner!==0&&u.health>0&&(CARDS[u.cardId]?.ranged||Math.max(Math.abs(u.x-g.x),Math.abs(u.y-g.y))<=3)).reduce((n,u)=>n+effectiveAttack(state,u),0);}
function guardedAct(state,declines){const before=findGeneral(state,0),probe=clone(state);reasonableAct(probe,[]);const proposed=probe.lastAction,after=findGeneral(probe,0);let chosen=proposed;const generalAction=(proposed.sourceId??proposed.unitId)===before?.unitId;
 const dangerMove=generalAction&&proposed.kind==='move'&&guardedThreat(probe,after)>=Math.max(6,before.health/3)&&guardedThreat(probe,after)>=guardedThreat(state,before);
 const dangerAttack=generalAction&&proposed.kind==='attack'&&(!after||(after.health<before.health&&(after.health<=guardedThreat(probe,after)+2||before.health-after.health>=6)));
 if(dangerMove||dangerAttack){const decision=clone(state),g=findGeneral(decision,0);g.moved=true;g.attacked=true;reasonableAct(decision,declines);chosen=decision.lastAction;declines.push({round:state.round,type:'avoid-general-risk',declined:proposed,chosen});}
 assert.ok(replayChosen(state,chosen),'guarded actual action legal');assert.ok(validateMatch(state));}
if(process.argv.includes('--midgame-suggestions')){
 const prior=JSON.parse(readFileSync(output('midgame-economy'),'utf8')).results;
 const traces=JSON.parse(readFileSync(new URL('../output/onboarding-balance-lategame-traces.json',import.meta.url),'utf8')).results;
 const guarded=JSON.parse(readFileSync(new URL('../output/onboarding-balance-after4-guard-lategame.json',import.meta.url),'utf8')).results;
 const suggestions=[];for(const heroId of [101,123,501]){const path=prior.find(r=>r.heroId===heroId),faction=FACTIONS.find(f=>f.heroIds.includes(heroId));if(!path?.wall)continue;
 const source=heroId===501?guarded.find(r=>r.levelId===path.wall&&r.result==='win'&&!r.defaultSquad):traces.find(r=>faction.heroIds.includes(r.original.heroId)&&r.winningAlternative);
 const candidate=source?.winningAlternative??source;if(!candidate)continue;const squad=candidate.squad,tests=[];
 for(const rank of [3,4]){const actualTraining={...trainingFor(faction,0),...path.training},training={...actualTraining};for(const id of squad)training[id]=Math.max(rank,training[id]);const cost=squad.reduce((n,id)=>n+TRAINING_COSTS.slice(actualTraining[id],training[id]).reduce((a,b)=>a+b,0),0);tests.push({targetRank:rank,cost,currentCoins:path.coins,shortfall:Math.max(0,cost-path.coins),report:simulate(heroId,path.wall,training,'reasonable-guard',squad).report});}
 suggestions.push({heroId,wall:path.wall,squad,sourceHero:source.original?.heroId??527,sourceLevel:source.original?.levelId??source.levelId,tests});}
 writeFileSync(output('midgame-suggestions'),JSON.stringify({notice:'Only prior verified same-faction squads tested at3/4 using actual currency/training; not exhaustive search.',suggestions},null,2));console.log(JSON.stringify(suggestions.map(r=>({hero:r.heroId,level:r.wall,squad:r.squad,tests:r.tests.map(t=>({rank:t.targetRank,cost:t.cost,hp:t.report.generalHp,result:t.report.result}))})),null,2));process.exit(0);
}
if(process.argv.includes('--midgame-economy')){
 const alternatives=JSON.parse(readFileSync(new URL('../output/onboarding-balance-lategame-traces.json',import.meta.url),'utf8')).results;
 const guardedAlternatives=JSON.parse(readFileSync(new URL('../output/onboarding-balance-after4-guard-lategame.json',import.meta.url),'utf8')).results;
 const paths=[];
 function costToRank(training,squad,rank){return squad.reduce((total,id)=>total+TRAINING_COSTS.slice(training[id]??0,Math.max(training[id]??0,rank)).reduce((n,c)=>n+c,0),0);}
 for(const f of FACTIONS)for(const hero of f.heroIds){const p=new ExpeditionProgress(new MemoryStorage());assert.ok(p.selectHero(hero).ok);const initialUpgrades=invest(p,f.defaultSquad),levels=[],farms=[];let wall=null,suggestion=null;
 for(const level of EXPEDITION_LEVELS){const entry=p.state,record={levelId:level.id,chapterId:level.chapterId,entryCoins:entry.coins,entryTraining:Object.fromEntries(f.defaultSquad.map(id=>[id,entry.training[id]])),farmCount:0,failures:[]};let run=simulate(hero,level.id,entry.training,'reasonable-guard');
 while(run.report.result!=='win'&&record.farmCount<2&&!f.defaultSquad.every(id=>p.state.training[id]===4)){record.failures.push(run.report);let farm=null;for(const id of [...p.state.completed].reverse()){const trial=simulate(hero,id,p.state.training,'reasonable-guard');if(trial.report.result==='win'){farm=trial;break;}}if(!farm)break;const settlement=p.settle(farm.state);assert.ok(settlement.ok);const upgrades=invest(p,f.defaultSquad);farms.push({forLevel:level.id,report:farm.report,settlement,upgrades});record.farmCount++;run=simulate(hero,level.id,p.state.training,'reasonable-guard');}
 record.report=run.report;if(run.report.result==='win'){record.settlement=p.settle(run.state);assert.ok(record.settlement.ok);record.upgrades=invest(p,f.defaultSquad);record.coins=p.state.coins;levels.push(record);continue;}
 record.coins=p.state.coins;wall=level.id;levels.push(record);
 const known=hero===527?guardedAlternatives.find(r=>r.levelId===level.id&&r.result==='win'&&!r.defaultSquad):alternatives.find(r=>r.original.heroId===hero&&r.original.levelId===level.id)?.winningAlternative;
 if(known){const squad=known.squad,tests=[];for(const rank of [3,4]){const training={...p.state.training};for(const id of squad)training[id]=Math.max(rank,training[id]);const trial=simulate(hero,level.id,training,'reasonable-guard',squad),cost=costToRank(p.state.training,squad,rank),shortfall=Math.max(0,cost-p.state.coins),last=EXPEDITION_LEVELS.find(l=>l.id===p.state.completed.at(-1));tests.push({squad,cardNames:squad.map(id=>CARDS[id].name),targetRank:rank,cost,currentCoins:p.state.coins,shortfall,repeatReward:last?.reward.repeat??0,estimatedLatestClearRepeats:last?Math.ceil(shortfall/last.reward.repeat):null,report:trial.report});}suggestion={source:'previously verified same-faction alternative, newly tested using corrected spell targets and guarded general',tests};}
 break;
 }
 const chapters=[...new Set(EXPEDITION_LEVELS.map(l=>l.chapterId))].map(chapterId=>{const entries=levels.filter(l=>l.chapterId===chapterId);return {chapterId,reached:entries.length>0,arrivalRanks:entries[0]?.entryTraining??null,cleared:entries.filter(l=>l.report.result==='win').length,firstWall:entries.find(l=>l.report.result!=='win')?.levelId??null,farmRuns:entries.reduce((n,l)=>n+l.farmCount,0)};});paths.push({heroId:hero,hero:HEROES[hero].name,squad:f.defaultSquad,startingCoins:80,initialUpgrades,completed:p.state.completed,coins:p.state.coins,training:Object.fromEntries(f.defaultSquad.map(id=>[id,p.state.training[id]])),wall,suggestion,chapters,levels,farms});
 }
 writeFileSync(output('midgame-economy'),JSON.stringify({notice:'Correct team spell targets + guarded-general offline heuristic; actual80 coins/rewards/training, no advertisements. At most2 repeat wins per failure before max squad rank; at max rank first failure stops. Only prior verified alternative tested at rank3/4; no exhaustive new search. Scripts are not optimal players or human win rate.',results:paths},null,2));console.log(JSON.stringify(paths.map(r=>({hero:r.heroId,cleared:r.completed.length,wall:r.wall,coins:r.coins,training:r.training,farms:r.farms.length,alternative:r.suggestion?.tests.map(t=>({rank:t.targetRank,cost:t.cost,shortfall:t.shortfall,repeat:t.estimatedLatestClearRepeats,result:t.report.result}))??null})),null,2));process.exit(0);
}
if(process.argv.includes('--heal-review')||process.argv.includes('--reasonable-economy-only')){
 if(!process.argv.includes('--reasonable-economy-only')){
 const reference=JSON.parse(readFileSync(new URL('../output/onboarding-balance-after2-economy.json',import.meta.url),'utf8')).results,audit=[];
 for(const f of FACTIONS)for(const hero of f.heroIds){const path=reference.find(r=>r.heroId===hero&&r.policy==='auto'),entry=path.levels.find(r=>r.levelId==='road-02');if(!entry)continue;for(const variant of ['entry','rank4']){const training=variant==='rank4'?trainingFor(f,4):{...trainingFor(f,0),...entry.entryTraining};audit.push({variant,...simulate(hero,'road-02',training).report});}}
 writeFileSync(output('badheal-audit'),JSON.stringify({notice:'Current real autoAct trace on after2 fifth-level economic entry and rank4, no production rules changed.',results:audit},null,2));console.log('BADHEAL '+JSON.stringify(audit.map(r=>({hero:r.heroId,variant:r.variant,result:r.result,round:r.round,badHeals:r.badHeals}))));
 }
 const paths=[];
 for(const f of FACTIONS)for(const hero of f.heroIds)for(const policy of (process.argv.includes('--reasonable-economy-only')?['reasonable-team-targeting']:['auto','reasonable-team-targeting'])){const p=new ExpeditionProgress(new MemoryStorage());assert.ok(p.selectHero(hero).ok);const initialUpgrades=invest(p,f.defaultSquad),levels=[],farms=[];let blocked=null;
 for(const level of EXPEDITION_LEVELS.slice(0,6)){const entryCoins=p.state.coins,entryTraining=p.state.training,failures=[];let run=simulate(hero,level.id,p.state.training,policy),farmCount=0;
 while(run.report.result!=='win'&&farmCount<30){failures.push(run.report);const s=p.state;if(f.defaultSquad.every(id=>s.training[id]>=4)){blocked='rank4-policy-loss';break;}let farming=null;for(const id of [...s.completed].reverse()){const candidate=simulate(hero,id,s.training,policy);if(candidate.report.result==='win'){farming=candidate;break;}}if(!farming){blocked='no-clearable-unlocked-farm';break;}const settlement=p.settle(farming.state);assert.ok(settlement.ok);const upgrades=invest(p,f.defaultSquad);farms.push({forLevel:level.id,report:farming.report,settlement,upgrades});farmCount++;run=simulate(hero,level.id,p.state.training,policy);}
 const record={levelId:level.id,entryCoins,entryTraining:Object.fromEntries(f.defaultSquad.map(id=>[id,entryTraining[id]])),report:run.report,failures,farmCount};if(run.report.result==='win'){record.settlement=p.settle(run.state);assert.ok(record.settlement.ok);record.upgrades=invest(p,f.defaultSquad);record.coins=p.state.coins;}else{blocked??='farm-cap';record.blocked=blocked;}levels.push(record);if(blocked)break;
 }paths.push({heroId:hero,policy,startingCoins:80,initialUpgrades,completed:p.state.completed,blocked,levels,farms});}
 writeFileSync(output('reasonable-economy'),JSON.stringify({notice:'12 heroes first6 actual economic paths; original auto sensitivity retained. Reasonable player refuses support aimed at enemies or damage/stun aimed at friends by removing only decision-clone card candidates; all chosen actions replay with legal real engine APIs. No enemy AI change, no advertising, no human win-rate claim.',results:paths},null,2));console.log('REASONABLE '+JSON.stringify(paths.map(r=>({hero:r.heroId,policy:r.policy,clears:r.completed.length,blocked:r.blocked,farms:r.levels.filter(l=>l.farmCount).map(l=>({level:l.levelId,count:l.farmCount})),enemyHeals:r.levels.reduce((n,l)=>n+l.report.badHeals.length,0)}))));process.exit(0);
}
if(process.argv.includes('--level-baseline')){
 const levelId=process.argv[process.argv.indexOf('--level-baseline')+1];assert.ok(EXPEDITION_LEVELS.some(l=>l.id===levelId),'known level');const results=[];
 for(const f of FACTIONS)for(const hero of f.heroIds)for(const rank of RANKS)results.push({...simulate(hero,levelId,trainingFor(f,rank)).report,rank});
 writeFileSync(output('level-baseline'),JSON.stringify({notice:'Targeted deterministic autoAct sensitivity, not human win rate.',levelId,results},null,2));console.log(JSON.stringify({levelId,wins:Object.fromEntries(RANKS.map(rank=>[rank,results.filter(r=>r.rank===rank&&r.result==='win').length])),losses:results.filter(r=>r.result!=='win').map(r=>({hero:r.heroId,rank:r.rank,reason:r.reason,hp:r.enemyHp}))}));process.exit(0);
}
if(process.argv.includes('--spell-audit')){
 const results=[];for(const f of FACTIONS)for(const hero of f.heroIds)for(const level of ['road-02','road-03','shadow-02'])for(const rank of RANKS)results.push({...simulate(hero,level,trainingFor(f,rank)).report,rank});
 writeFileSync(output('badspell-audit'),JSON.stringify({notice:'Actual unfiltered autoAct spell targets before action; support enemy or direct damage/stun friendly choices recorded. Legal-target APIs not modified.',results},null,2));console.log(JSON.stringify(results.filter(r=>r.badSpells.length).map(r=>({hero:r.heroId,level:r.levelId,rank:r.rank,result:r.result,bad:r.badSpells})),null,2));process.exit(0);
}
if(process.argv.includes('--lategame')){
const targets=['frost-02','banners-03','shadow-02'];
function run(heroId,levelId,squad,trace=false){const faction=FACTIONS.find(f=>f.heroIds.includes(heroId)),s=createExpeditionMatch(levelId,Object.fromEntries(faction.unitIds.map(id=>[id,4])),squad,heroId),steps=[];let actions=0;while(s.phase!=='over'&&actions++<1800){const owner=s.currentPlayer,g=findGeneral(s,0),before=g?{x:g.x,y:g.y,hp:g.health}:null;autoAct(s,owner);if(trace){const after=findGeneral(s,0);steps.push({round:s.round,owner,action:structuredClone(s.lastAction),before,after:after?{x:after.x,y:after.y,hp:after.health}:null,allies:s.units.filter(u=>u.owner===0).map(u=>({id:u.cardId,x:u.x,y:u.y,hp:u.health})),enemies:s.units.filter(u=>u.owner!==0).map(u=>({id:u.cardId,owner:u.owner,x:u.x,y:u.y,atk:u.attack,hp:u.health}))});}}return {heroId,levelId,squad,result:s.result,reason:s.resultReason,round:s.round,hp:findGeneral(s,0)?.health??0,enemyGenerals:s.players.filter(p=>p.id!==0).map(p=>({owner:p.id,hp:findGeneral(s,p.id)?.health??0})),actions,steps};}
const results=[];for(const f of FACTIONS)for(const h of f.heroIds)for(const l of targets){const original=run(h,l,f.defaultSquad);if(original.result==='win')continue;const traced=run(h,l,f.defaultSquad,true),alternatives=[];let winning=null;for(const a of f.unitIds)for(const b of f.unitIds)for(const c of f.unitIds){if(a===b||a===c||b===c||CARDS[a].cost+CARDS[b].cost>4)continue;const squad=[a,b,c];if(squad.join()===f.defaultSquad.join())continue;const r=run(h,l,squad);alternatives.push({...r,steps:undefined});if(!winning&&r.result==='win')winning={...r,cardNames:squad.map(id=>CARDS[id].name)};}results.push({original:traced,alternatives,winningAlternative:winning,alternativeWins:alternatives.filter(r=>r.result==='win').length});}
writeFileSync(output('lategame-traces'),JSON.stringify({notice:'Only legal same-faction distinct three-unit squads; first two total cost<=4. Full rank4. autoAct deterministic, alternate victory disproves a universal wall but does not prove newbie accessibility.',results},null,2));console.log(JSON.stringify(results.map(r=>({hero:r.original.heroId,level:r.original.levelId,reason:r.original.reason,round:r.original.round,enemy:r.original.enemyGenerals,alternatives:r.alternatives.length,alternativeWins:r.alternativeWins,winning:r.winningAlternative?.squad??null})),null,2));

process.exit(0);
}
if(process.argv.includes('--guard-lategame')){
 const faction=FACTIONS.find(f=>f.heroIds.includes(527)),results=[];
 function threat(state,g){if(!g)return Infinity;return state.units.filter(u=>u.owner!==0&&u.health>0&&(CARDS[u.cardId]?.ranged||Math.max(Math.abs(u.x-g.x),Math.abs(u.y-g.y))<=3)).reduce((n,u)=>n+effectiveAttack(state,u),0);}
 function apply(state,a){const index=state.players[0].hand.indexOf(a.cardId);switch(a.kind){case 'move':return moveUnit(state,a.unitId,a.x,a.y,0);case 'attack':return attackUnit(state,a.sourceId??a.unitId,a.targetId,0);case 'summon':return playCard(state,index,a.x,a.y,0);case 'spell':return castSpell(state,index,a.cell??a.targetId??null,0);case 'bbs':return useBattleCommand(state,HEROES[state.players[0].generalId].target==='self'?null:a.cell??a.targetId??null,0);case 'end-turn':return endTurn(state,0,true);default:throw Error('unsupported guarded action '+a.kind);}}
 for(const levelId of ['frost-02','shadow-02'])for(const a of faction.unitIds)for(const b of faction.unitIds)for(const c of faction.unitIds){if(a===b||a===c||b===c||CARDS[a].cost+CARDS[b].cost>4)continue;
  const state=createExpeditionMatch(levelId,trainingFor(faction,4),[a,b,c],527),trace=[],declines=[];let actions=0;
  while(state.phase!=='over'&&actions++<LIMIT){if(state.currentPlayer!==0){autoAct(state,state.currentPlayer);continue;}const before=findGeneral(state,0),probe=clone(state);reasonableAct(probe,declines);const proposed=probe.lastAction,after=findGeneral(probe,0);let chosen=proposed;
   const generalAction=(proposed.sourceId??proposed.unitId)===before?.unitId;
   const dangerMove=generalAction&&proposed.kind==='move'&&threat(probe,after)>=Math.max(6,before.health/3)&&threat(probe,after)>=threat(state,before);
   const dangerAttack=generalAction&&proposed.kind==='attack'&&(!after||(after.health<before.health&&(after.health<=threat(probe,after)+2||before.health-after.health>=6)));
   if(dangerMove||dangerAttack){const decision=clone(state),g=findGeneral(decision,0);g.moved=true;g.attacked=true;reasonableAct(decision,declines);chosen=decision.lastAction;declines.push({round:state.round,turn:state.turnSerial,declined:proposed,reason:dangerMove?'avoid-general-threat-zone':'avoid-general-counter-loss',hp:before.health,threat:threat(probe,after),chosen});}
   assert.ok(apply(state,chosen),'guarded decision replays a legal engine action '+JSON.stringify({chosen,player:state.players[0],phase:state.phase}));assert.ok(validateMatch(state),'guarded real snapshot has no fabricated action flags');trace.push({round:state.round,action:chosen,hp:findGeneral(state,0)?.health??0});
  }
  results.push({heroId:527,levelId,squad:[a,b,c],defaultSquad:[a,b,c].join()===faction.defaultSquad.join(),result:state.result??'timeout',reason:state.resultReason,round:state.round,hp:findGeneral(state,0)?.health??0,declines,trace});
 }
 writeFileSync(output('guard-lategame'),JSON.stringify({notice:'Offline guarded-general decision policy: clone flags suppress dangerous general actions only for selecting another autoAct action; replay that action via real engine APIs with real flags unchanged. Other units/cards continue. Threat heuristic sums ranged/all enemies within3 cells; not optimal play or human difficulty proof.',results},null,2));console.log(JSON.stringify(results.map(r=>({level:r.levelId,squad:r.squad,default:r.defaultSquad,result:r.result,reason:r.reason,round:r.round,hp:r.hp,declines:r.declines.length})),null,2));process.exit(0);
}
const baseline=[];for(const f of FACTIONS)for(const hero of f.heroIds)for(const rank of RANKS)for(const level of EXPEDITION_LEVELS)baseline.push({...simulate(hero,level.id,trainingFor(f,rank)).report,rank});
assert.equal(baseline.length,648);assert.ok(baseline.every(r=>r.result!=='timeout'));
const summaries=EXPEDITION_LEVELS.map(level=>({level:level.id,byRank:Object.fromEntries(RANKS.map(rank=>[rank,baseline.filter(r=>r.levelId===level.id&&r.rank===rank).filter(r=>r.result==='win').length])),rank0LossHeroes:baseline.filter(r=>r.levelId===level.id&&r.rank===0&&r.result!=='win').map(r=>r.heroId)}));
writeFileSync(output('baseline'),JSON.stringify({notice:'Deterministic autoAct reference, not human win rate or optimal-play proof.',results:baseline,summary:summaries},null,2));console.log('BASELINE '+JSON.stringify(summaries));
if(process.argv.includes('--baseline-only'))process.exit(0);
const policies=['delay-opening','miss-last-action','cautious-general'];const mistakes=[];
for(const f of FACTIONS)for(const hero of f.heroIds)for(const rank of RANKS)for(const level of EXPEDITION_LEVELS.slice(0,6))for(const policy of policies)mistakes.push({...simulate(hero,level.id,trainingFor(f,rank),policy).report,rank});
assert.equal(mistakes.length,648);assert.ok(mistakes.every(r=>r.result!=='timeout'));
writeFileSync(output('mistakes'),JSON.stringify({notice:'Scripted errors applied to autoAct, not a novice model. Delay: skip first own turn. Miss: end each own turn one intended action early. Cautious: decline a general move if adjacent raw enemy attack >= max(3,one-third current HP), then end turn; retains engine choices otherwise.',results:mistakes},null,2));
const economics=[];
for(const f of FACTIONS)for(const heroId of f.heroIds)for(const policy of ['auto','delay-opening','miss-last-action']){
 const p=new ExpeditionProgress(new MemoryStorage());assert.ok(p.selectHero(heroId).ok);const initialUpgrades=invest(p,f.defaultSquad),levels=[],farms=[];let blocked=null;
 for(const level of EXPEDITION_LEVELS){let attempts=0,entryCoins=p.state.coins,entryTraining=p.state.training,run=simulate(heroId,level.id,entryTraining,policy);const failures=[];let farmCount=0;
  while(run.report.result!=='win'&&farmCount<30){failures.push(run.report);const s=p.state;if(f.defaultSquad.every(id=>s.training[id]>=4)){blocked='default-squad-rank4-policy-loss';break;}const completed=[...s.completed].reverse();let farming=null;
   for(const farmId of completed){const test=simulate(heroId,farmId,s.training,policy);if(test.report.result==='win'){farming=test;break;}}
   if(!farming){blocked=completed.length?'no-repeat-clear-under-policy':'first-level-loss-no-unlocked-farm';break;}
   assert.ok(p.settle(farming.state).ok);const upgrades=invest(p,f.defaultSquad);farms.push({forLevel:level.id,levelId:farming.report.levelId,report:farming.report,upgrades,coins:p.state.coins});farmCount++;run=simulate(heroId,level.id,p.state.training,policy);attempts++;
  }
  if(run.report.result==='win'){const settlement=p.settle(run.state);assert.ok(settlement.ok,settlement.error);const upgrades=invest(p,f.defaultSquad);levels.push({levelId:level.id,entryCoins,entryTraining:Object.fromEntries(f.defaultSquad.map(id=>[id,entryTraining[id]])),report:run.report,failedAttempts:failures,extraAttempts:attempts,farmCount,settlement,upgrades,coins:p.state.coins});}
  else{levels.push({levelId:level.id,entryCoins,entryTraining:Object.fromEntries(f.defaultSquad.map(id=>[id,entryTraining[id]])),report:run.report,failedAttempts:failures,farmCount,blocked:blocked??'farm-cap-30'});blocked??='farm-cap-30';break;}
 }
 economics.push({heroId,hero:HEROES[heroId].name,policy,startingCoins:80,investment:'balanced rank order across default three, tie by squad order; spend before first battle and after every clear; no advertisements; repeat latest previously completed level this policy can clear, maximum30 per wall',initialUpgrades,completed:p.state.completed,coins:p.state.coins,training:Object.fromEntries(f.defaultSquad.map(id=>[id,p.state.training[id]])),blocked,levels,farms});
}
writeFileSync(output('economy'),JSON.stringify({results:economics},null,2));
const mistakeSummary=policies.map(policy=>({policy,levels:EXPEDITION_LEVELS.slice(0,6).map(l=>({level:l.id,wins:Object.fromEntries(RANKS.map(rank=>[rank,mistakes.filter(r=>r.policy===policy&&r.rank===rank&&r.levelId===l.id&&r.result==='win').length]))}))}));
const economicSummary=economics.map(r=>({heroId:r.heroId,policy:r.policy,clears:r.completed.length,blocked:r.blocked,wall:r.blocked?r.levels.at(-1)?.levelId:null,farmRuns:r.farms.length,training:r.training}));
const acceptance={
 firstLevelRank0AllHeroes:baseline.filter(r=>r.levelId===EXPEDITION_LEVELS[0].id&&r.rank===0).every(r=>r.result==='win'),
 firstLevelRank0OpeningDelayAllHeroes:mistakes.filter(r=>r.levelId===EXPEDITION_LEVELS[0].id&&r.rank===0&&r.policy==='delay-opening').every(r=>r.result==='win'),
 firstThreeRank0AllHeroes:baseline.filter(r=>EXPEDITION_LEVELS.slice(0,3).some(l=>l.id===r.levelId)&&r.rank===0).every(r=>r.result==='win'),
 firstSixActualEconomyAutoNoMoreThanTwoFarmRunsPerWall:economics.filter(r=>r.policy==='auto').every(r=>EXPEDITION_LEVELS.slice(0,6).every(l=>r.completed.includes(l.id)&&r.levels.find(x=>x.levelId===l.id).farmCount<=2)),
 firstLevelEconomyAutoNoDeadlock:economics.filter(r=>r.policy==='auto').every(r=>r.completed.includes(EXPEDITION_LEVELS[0].id))
};
writeFileSync(output('summary'),JSON.stringify({acceptance,notice:'648 reference simulations +648 scripted-error simulations +36 actual profile economy paths. No player storage used. Deterministic outcomes are policy evidence, never player win rate.',baseline:summaries,mistakes:mistakeSummary,economy:economicSummary},null,2));console.log('ACCEPTANCE '+JSON.stringify(acceptance));console.log('MISTAKES '+JSON.stringify(mistakeSummary));console.log('ECONOMY '+JSON.stringify(economicSummary));
