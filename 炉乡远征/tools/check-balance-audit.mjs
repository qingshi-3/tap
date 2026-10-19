// Read-only audit: deterministic heuristic probes are not human win rates.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {CARDS} from '../dist/js/cards.js';
import {FACTIONS} from '../dist/js/factions.js';
import {makeStarterDeck,validatePlayerDeck} from '../dist/js/battle-deck.js';
import {CAMPAIGN_UNIT_IDS,SPELL_IDS,isSpellTrainable,getSpellUpgrade} from '../dist/js/campaign-rules.js';
import {EXPEDITION_LEVELS,TRAINING_COSTS} from '../dist/js/expedition-data.js';
import {getEnemyPlan} from '../dist/js/enemy-plans.js';
import {DAILY_AD_REWARDS} from '../dist/js/daily-ad-rewards.js';
import {createExpeditionMatch,confirmMulligan,autoAct,findGeneral,validateMatch} from '../dist/js/engine.js';
const out=new URL('../output/quality-audit/',import.meta.url);mkdirSync(out,{recursive:true});
const units=CAMPAIGN_UNIT_IDS.map(id=>CARDS[id]),spells=SPELL_IDS.map(id=>CARDS[id]);
for(const c of units)for(const k of ['cost','attack','health'])assert.ok(Number.isInteger(c[k])&&c[k]>=0);
for(const c of spells){assert.ok(Number.isInteger(c.cost)&&c.cost>=0);if(isSpellTrainable(c.id)){const base=getSpellUpgrade(c.id,0),power=getSpellUpgrade(c.id,2,'power');assert.notDeepEqual({...base,campaignRank:2,campaignMode:'power'},power,`actual power benefit ${c.id}`);}}
const levels=EXPEDITION_LEVELS.map((l,i)=>({stage:i+1,id:l.id,objective:l.objective,turnLimit:l.turnLimit,reward:l.reward,armies:Object.entries(getEnemyPlan(l.id,3).players).map(([owner,p])=>({owner:Number(owner),generalId:p.generalId,generalAttack:p.generalAttack,generalHealth:p.generalHealth,mana:p.mana,opening:p.openingHandSize,deck:p.deck.length,fatigueStartsOnDraw:p.deck.length-p.openingHandSize+1,garrison:p.garrison,unitStats:p.unitStats}))}));
const originalRandom=Math.random;let seed=1;
function rng(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const probes=[];
try{Math.random=rng;for(const f of FACTIONS)for(const hero of f.heroIds)for(const stage of [1,2,3,6,9,12,15,18])for(const startSeed of [11,29]){seed=startSeed;const level=EXPEDITION_LEVELS[stage-1],rank=stage<=3?1:stage<=9?2:stage<=15?3:4,deck=makeStarterDeck(hero);assert.ok(validatePlayerDeck(deck,hero));const training=Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id=>[id,rank]));const s=createExpeditionMatch(level.id,training,null,hero,{deck,spells:f.spellIds.slice(0,2),spellTraining:{},spellModes:{},specializations:{},growthVersion:Object.fromEntries(CAMPAIGN_UNIT_IDS.map(id=>[id,'low-v2']))});confirmMulligan(s);let actions=0;while(s.phase!=='over'&&actions++<1000)assert.ok(autoAct(s));assert.ok(validateMatch(s));probes.push({hero,stage,seed:startSeed,rank,result:s.result,reason:s.resultReason,round:s.round,hp:findGeneral(s,0)?.health??0,actions});}}
finally{Math.random=originalRandom;}
const report={notice:'192 independent seeded autoAct probes with default decks and the legally open unit rank before each stage. No progression, affordability, spell upgrades, specializations, deck optimization or human decisions; losses never prove impossibility.',counts:{units:units.length,spells:spells.length,trainableSpells:spells.filter(c=>isSpellTrainable(c.id)).length},economy:{unitFull:TRAINING_COSTS.reduce((a,b)=>a+b,0),allUnits:units.length*380,allTrainableSpells:spells.filter(c=>isSpellTrainable(c.id)).length*160,firstRoute:80+360+EXPEDITION_LEVELS.reduce((n,l)=>n+l.reward.first,0),laterRoute:360+EXPEDITION_LEVELS.reduce((n,l)=>n+l.reward.repeat,0),dailyMean:Object.fromEntries(Object.entries(DAILY_AD_REWARDS).map(([k,v])=>[k,v.reduce((n,x)=>n+x.amount*x.weight,0)/v.reduce((n,x)=>n+x.weight,0)]))},levels,probes,summary:FACTIONS.flatMap(f=>f.heroIds.map(hero=>({hero,samples:probes.filter(p=>p.hero===hero).length,wins:probes.filter(p=>p.hero===hero&&p.result==='win').length,early:probes.filter(p=>p.hero===hero&&p.stage<=3).map(p=>({stage:p.stage,seed:p.seed,result:p.result}))})))};
writeFileSync(new URL('balance-data.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({economy:report.economy,summary:report.summary}));
