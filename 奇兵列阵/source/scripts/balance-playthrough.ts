/** Paired legal-expedition balance driver. npx vite-node scripts/balance-playthrough.ts
 * SEEDS_PER_CELL=32 START=0 BOSS_OPT=12 OUT_DIR=... FLOWS=action,burn,... HEROES=argeon,...
 * No inventory/resource injection; no player storage; baseline directory is read-only.
 */
// @ts-expect-error Node host module, intentionally no browser @types/node dependency.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
// @ts-expect-error Node host module.
import { resolve, join } from 'node:path';
// @ts-expect-error Node host module.
import { createHash } from 'node:crypto';
// @ts-expect-error Node host module. Compression affects evidence files only.
import { gzipSync } from 'node:zlib';
declare const process: { env:Record<string,string|undefined>; cwd():string; exitCode?:number };
import * as beforeRun from './fixtures/qibing-v014-balance/before/core/run';
import * as beforeEngine from './fixtures/qibing-v014-balance/before/core/engine';
import * as beforeData from './fixtures/qibing-v014-balance/before/core/data';
import * as beforeContent from './fixtures/qibing-v014-balance/before/core/content';
import * as afterRun from '../src/core/run';
import * as afterEngine from '../src/core/engine';
import * as afterData from '../src/core/data';
import * as afterContent from '../src/core/content';
import type { RunState } from '../src/core/run';
import type { BattleOutput, Effect, Slotted, UnitDef } from '../src/core/types';

const FLOW_NAMES={action:'立即攻击/行动次数/普攻联动',burn:'灼烧混搭',frost:'寒意冻结混搭',spell:'施法混搭',defense:'护甲格挡/反击护卫',healing:'治疗/复生',summon:'召唤/阵亡收益',sacrifice:'献祭/复生耗材/收益核心',vuln:'易伤供给/多段消费'} as const;
type Flow=keyof typeof FLOW_NAMES;
type Phase='before'|'after';
const POLICY_REVISION='benefit-aware-v2';
interface Modules { run:typeof afterRun; engine:typeof afterEngine; data:typeof afterData; content:typeof afterContent }
const modules:Record<Phase,Modules>={before:{run:beforeRun,engine:beforeEngine,data:beforeData,content:beforeContent} as unknown as Modules,after:{run:afterRun,engine:afterEngine,data:afterData,content:afterContent}};
const integer=(key:string,fallback:number,min:number,max:number)=>{const n=Number(process.env[key]??fallback);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${key} must be integer ${min}..${max}`);return n;};
const sampleCount=integer('SEEDS_PER_CELL',32,1,1000),start=integer('START',0,0,1000000),optCount=integer('BOSS_OPT',12,0,24);
const flows=(process.env.FLOWS??Object.keys(FLOW_NAMES).join(',')).split(',') as Flow[];
if(flows.some(f=>!(f in FLOW_NAMES)))throw new Error('Unknown FLOWS');
const heroes=(process.env.HEROES??afterContent.GENERALS.map(g=>g.id).join(',')).split(',');
if(heroes.some(h=>!afterContent.GENERALS.some(g=>g.id===h)))throw new Error('Unknown HEROES');
const outputDir=resolve(process.env.OUT_DIR??resolve(process.cwd(),'output/qibing-v014-balance/validation'));
mkdirSync(outputDir,{recursive:true});
const write=(file:string,value:unknown)=>{const absolute=join(outputDir,file);mkdirSync(resolve(absolute,'..'),{recursive:true});writeFileSync(absolute,JSON.stringify(value,null,2),'utf8');};
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const sourceHashes:Record<string,string>={};
for(const phase of ['before','after'] as Phase[])for(const file of ['run','engine','data','content','route','encounterRules','power','battleStats','recommend','rng','types']){
 const root=phase==='before'?'scripts/fixtures/qibing-v014-balance/before/core':'src/core';
 sourceHashes[`${phase}/${file}`]=hash(readFileSync(resolve(process.cwd(),root,`${file}.ts`),'utf8'));
}
sourceHashes.driver=hash(readFileSync(resolve(process.cwd(),'scripts/balance-playthrough.ts'),'utf8'));
const seedGroups:Record<string,number[]>={};
for(const hero of heroes){const list:number[]=[];for(let index=start;list.length<sampleCount;index++){
 const seed=1000+index*7919;
 if(beforeRun.generalChoices(seed).includes(hero)&&afterRun.generalChoices(seed).includes(hero))list.push(seed);
 if(index>start+sampleCount*100)throw new Error(`Could not find eligible seeds for ${hero}`);
}seedGroups[hero]=list;}
write('manifest.json',{schema:1,created:new Date().toISOString(),policyRevision:POLICY_REVISION,parameters:{SEEDS_PER_CELL:sampleCount,START:start,BOSS_OPT:optCount,FLOWS:flows,HEROES:heroes},flows:FLOW_NAMES,sourceHashes,seeds:seedGroups,scope:'Each hero is actually offered by both versions. No official-recommended roster list. Strategy labels are priorities, not evidence of pure or formed builds. Own-route results and same-acquired-inventory tactical searches have separate denominators.'});

const level=(u:Slotted)=>u.copies===4?3:u.copies===2?2:1;
const effects=(d:UnitDef):Effect[]=>[...(d.cast??[]),...(d.onStart??[]),...(d.afterAttack??[]),...(d.onHurt??[]),...(d.onKill??[]),...(d.onRattle??[]),...(d.onAllyFaint??[]),...(d.onBeatEnd??[]),...(d.onRevive??[])];
const has=(d:UnitDef,op:Effect['op'])=>effects(d).some(e=>e.op===op);
const deathSummoner=(d:UnitDef)=>(d.onRattle??[]).some(e=>e.op==='summon');
const healing=(d:UnitDef)=>has(d,'heal');
const healerValue=(d:UnitDef)=>(d.cast??[]).filter(e=>e.op==='heal').reduce((n,e)=>n+(e.to==='allies'?18:e.to==='adjacent'?10:4),0);
const tri=(values:readonly number[]|undefined,l:number)=>values?.[l-1]??0;
function affinity(d:UnitDef,flow:Flow):number{
 switch(flow){
 case 'action':return (has(d,'extraAct')?14:0)+(has(d,'addAction')?14:0)+(d.traits?.combo?7:0)+(d.afterAttack?.length?4:0)+(d.special==='monk'?5:0);
 case 'burn':return (has(d,'burn')?15:0)+(d.traits?.combo?5:0)+(healing(d)?3:0);
 case 'frost':return (has(d,'chill')?15:0)+(has(d,'extraAct')?4:0)+(d.traits?.armor?3:0);
 case 'spell':return ((d.cast??[]).some(e=>e.op==='dmg')?23:d.cast?5:0)+((d.cast??[]).some(e=>e.op==='dmg'&&e.to==='enemyAll')?8:0)+(d.special==='matriarch'?18:0)+(d.special==='solus'?20:0)+(d.special==='brood'?10:0)+(healing(d)?4:0);
 case 'defense':return (d.traits?.armor?9:0)+(d.traits?.thorns?8:0)+(d.traits?.taunt?7:0)+(has(d,'block')?6:0)+(healing(d)?5:0);
 case 'healing':return (healing(d)?10:0)+healerValue(d)+(d.traits?.reborn?10:0)+(d.hp>=8?3:0);
 case 'summon':return (deathSummoner(d)?13:0)+(d.onAllyFaint?.length?12:0)+(d.traits?.reborn?4:0)+(healing(d)?3:0);
 case 'sacrifice':return (has(d,'sacrifice')?14:0)+(deathSummoner(d)?10:0)+(d.traits?.reborn?9:0)+(d.onAllyFaint?.length?9:0);
 case 'vuln':return (has(d,'weaken')?13:0)+(d.traits?.combo?11:0)+(has(d,'extraAct')?7:0)+(d.special==='monk'?10:0)+(healing(d)?5:0);
 }
}
interface ResourceCost {goldSpent:number;saleGold:number;recruited:number;merges:number;rerolls:number;shopPurchases:number;spellsUsed:number;allocations:Record<string,number>}
const emptyCost=():ResourceCost=>({goldSpent:0,saleGold:0,recruited:0,merges:0,rerolls:0,shopPurchases:0,spellsUsed:0,allocations:{}});
interface Observed {damagingCasterHits:number|null;actionGains:number|null;extraActs:number|null;friendlyDeaths:number|null;generalProcs:number|null}
function observed(out:BattleOutput,logged:boolean,m?:Modules):Observed{
 if(!logged)return {damagingCasterHits:null,actionGains:null,extraActs:null,friendlyDeaths:null,generalProcs:null};
 const o:Observed={damagingCasterHits:0,actionGains:0,extraActs:0,friendlyDeaths:0,generalProcs:0};
 for(const row of out.log){const e=row.ev;
  if(m&&e.t==='dmg'&&e.kind==='ability'&&e.n>0&&e.src!==undefined){const src=row.snap.find(u=>u.uid===e.src),target=row.snap.find(u=>u.uid===e.tgt);if(src?.side===0&&target?.side===1&&(m.data.unitDef(src.defId).cast??[]).some(f=>f.op==='dmg'))o.damagingCasterHits!++;}
  if(e.t==='actionGain'&&row.snap.some(u=>u.uid===e.uid&&u.side===0))o.actionGains!+=e.n;
  if(e.t==='act'&&e.side===0&&e.mode==='extra')o.extraActs!++;
  if(e.t==='death'&&row.snap.some(u=>u.uid===e.tgt&&u.side===0))o.friendlyDeaths!++;
  if(e.t==='gen')o.generalProcs!++;
 }return o;
}
function outcome(out:BattleOutput,logged:boolean,m?:Modules){return {result:out.result,beats:out.beats,metrics:out.metrics??{},observed:observed(out,logged,m),fault:out.fault??null};}
type Outcome=ReturnType<typeof outcome>;
function supply(m:Modules,r:RunState){
 const sources:Record<string,string[]>={burn:[],chill:[],spell:[],armor:[],block:[],guard:[],thorns:[],heal:[],revive:[],summon:[],sacrifice:[],extra:[],actions:[],vuln:[],multiHit:[],faintPayoff:[],extraNormal:[],extraForced:[],extraCapacity:[],damageReduction:[],castDamage:[],castSupport:[],castPayoff:[]};
 const add=(key:string,id:string)=>{if(!sources[key].includes(id))sources[key].push(id);};
 const addEffects=(es:Effect[],id:string)=>{for(const e of es){const key=({burn:'burn',chill:'chill',block:'block',heal:'heal',summon:'summon',sacrifice:'sacrifice',extraAct:'extra',addAction:'actions',vuln:'vuln'} as Partial<Record<Effect['op'],string>>)[e.op];if(key)add(key,id);if(e.op==='extraAct')add('extraNormal',id);if(e.op==='grant'&&e.grant){const k=({armor:'armor',guard:'guard',thorns:'thorns',reborn:'revive',combo:'multiHit',splash:'multiHit'} as Record<string,string>)[e.grant];if(k)add(k,id);}}};
 for(const u of r.slots){if(!u)continue;const d=m.data.unitDef(u.defId),id=`unit:${d.id}#${u.ownedId}`;
  addEffects(effects(d),id);if(d.cast){add('spell',id);add(d.cast.some(e=>e.op==='dmg')?'castDamage':'castSupport',id);}if(['solus','matriarch','brood'].includes(d.special??''))add('castPayoff',id);if(d.onAllyFaint?.length)add('faintPayoff',id);if(d.special==='wyvern'){add('extra',id);add('extraNormal',id);}
  for(const [key,val] of Object.entries(d.traits??{}))if(val){const k=({armor:'armor',guard:'guard',thorns:'thorns',reborn:'revive',combo:'multiHit',splash:'multiHit'} as Record<string,string>)[key];if(k)add(k,id);}
  if((u.train?.block??0)>0)add('block',`training:${u.ownedId}`);
  for(const eq of u.equips??[]){const e=m.content.EQUIP_MAP[eq];addEffects([...(e.onStart??[]),...(e.afterAttack??[])],`equip:${eq}#${u.ownedId}`);for(const [key,val]of Object.entries(e.grants??{}))if(val){const k=({armor:'armor',guard:'guard',thorns:'thorns',reborn:'revive',combo:'multiHit',splash:'multiHit'} as Record<string,string>)[key];if(k)add(k,`equip:${eq}#${u.ownedId}`);}}
 }
 const generalKeys:Record<string,string[]>={argeon:['heal','block'],kaleos:['spell'],lilithe:['spell','heal'],vulkan:['burn'],faie:['chill'],zirix:['vuln'],hank:['extra']};
 for(const k of generalKeys[r.general]??[])add(k,`general:${r.general}`);
 if(r.general==='hank')add('extraForced',`general:${r.general}`);
 const passives:Record<string,string[]>={g_first:['extra','extraForced'],g_chain:['extraCapacity'],g_revive:['revive'],g_martyr:['faintPayoff'],g_core:['damageReduction'],g_weak:['vuln'],g_tide:['chill']};
 for(const p of r.passives)for(const k of passives[p]??[])add(k,`passive:${p}`);
 if(r.passives.includes('kaleos_3')){add('extra','passive:kaleos_3');add('extraForced','passive:kaleos_3');}
 const spellKeys:Record<string,string[]>={sp_haste:['actions'],sp_revive:['revive'],sp_freeze:['chill'],sp_firerain:['burn'],sp_shield:['block']};
 for(const s of r.activeSpells)for(const k of spellKeys[s]??[])add(k,`spell:${s}`);
 return sources;
}
function mechanism(flow:Flow,s:ReturnType<typeof supply>,o:Outcome){
 const mt=o.metrics as Record<string,number>,n=(key:string)=>mt[key]??0;
 const supplied:Record<Flow,boolean>={action:s.extra.length+s.actions.length>0,burn:s.burn.length>0,frost:s.chill.length>0,spell:s.castDamage.length>0,defense:s.armor.length+s.block.length+s.guard.length+s.thorns.length+s.damageReduction.length>0,healing:s.heal.length+s.revive.length>0,summon:s.summon.length>0,sacrifice:s.sacrifice.length>0,vuln:s.vuln.length>0};
 const activated:Record<Flow,boolean>={action:n('extraActions')>0||(o.observed.actionGains??0)>0,burn:n('burnDamage')>0,frost:n('freezes')>0,spell:(o.observed.damagingCasterHits??0)>0,defense:n('mitigated')+n('guards')+n('thornsDamage')>0,healing:n('healing')+n('revives')>0,summon:n('summons')>0,sacrifice:n('sacrifices')>0,vuln:n('vulnConsumed')>0};
 return {supplied:supplied[flow],activated:activated[flow],castingOccurred:n('casts')>0,damagingCasterPresent:s.castDamage.length>0,damagingCasterHitEvents:o.observed.damagingCasterHits,spellDamageIncludesGeneral:true,sources:s,definition:'Supplied = actual equipped/unit/general/spell source; activated = actual nonzero relevant metric/event. Neither implies a pure build or sufficient synergy.'};
}

interface BossEvidence {chapter:number;name:string;checkpoint:RunState;actionCount:number;actionHash:string;stage:{promotions:number;expectedPromotions:number;power:number;passives:string[];stageMatches:boolean};cost:ResourceCost;supply:ReturnType<typeof supply>;outcome:Outcome;mechanism:ReturnType<typeof mechanism>}
interface BossAttempt {chapter:number;first:boolean;outcome:Outcome}
interface RunResult {actionTrace:string;inlineActions:boolean;bossAttempts:BossAttempt[];phase:Phase;flow:Flow;hero:string;seed:number;termination:string;error:string|null;actions:number;actionHash:string;cost:ResourceCost;wins:number;lives:number;battles:number;bosses:BossEvidence[];traceFile:string;fullActions?:unknown[]}
function play(m:Modules,phase:Phase,flow:Flow,hero:string,seed:number,keepActions:boolean):RunResult{
 const R=m.run,r=R.newRun(hero,seed),full:unknown[]=[],stream=createHash('sha256'),cost=emptyCost();
 let actionCount=0,battleCount=0,drawStreak=0,drawKey='',error:string|null=null;
 const bosses:BossEvidence[]=[],bossAttempts:BossAttempt[]=[],seen=new Set<number>();
 const owned=()=>R.allOwned(r).map((u,i)=>({u,i})).filter((x):x is {u:Slotted;i:number}=>!!x.u);
 const d=(u:Slotted)=>m.data.unitDef(u.defId);
 const attack=(u:Slotted)=>{const x=d(u);return m.engine.levelStats(x.id,level(u)).atk+(u.train?.atk??0)+(x.cast?-8:0)+(x.traits?.combo?3:0);};
 const value=(u:Slotted)=>{const x=d(u),s=m.engine.levelStats(x.id,level(u));return s.atk*1.8+s.hp*.65+x.tier*2+affinity(x,flow)+(u.train?.atk??0)*1.8+(u.train?.hp??0)*1.3+(u.train?.power??0)*3+(u.equips?.length??0)*3;};
 const tank=(u:Slotted)=>{const x=d(u),l=level(u),s=m.engine.levelStats(x.id,l);return s.hp+(u.train?.hp??0)*2+tri(x.traits?.armor,l)*4+tri(x.traits?.thorns,l)*2+(x.traits?.reborn?5:0)+(x.onHurt?4:0)-(x.cast?9:0);};
 const act=<T>(api:string,args:unknown[],fn:()=>T,detail?:unknown):T=>{
  const context={index:actionCount++,chapter:r.chapter,node:r.node,screen:R.screen(r)},gold=r.gold;const result=fn();
  const row={...context,api,args,result,detail};stream.update(JSON.stringify(row)+'\n');full.push(row);
  if(result===false||result==='invalid'||result==='confirm')throw new Error(`Rejected ${api} ${JSON.stringify(args)}`);
  if(api==='buy'){cost.goldSpent+=Math.max(0,gold-r.gold);cost.shopPurchases++;}if(api==='sell')cost.saleGold+=Math.max(0,r.gold-gold);
  if(api==='reroll')cost.rerolls++;if(api==='useSpell')cost.spellsUsed++;if(api==='takeDraft')cost.recruited++;
  if(api==='moveSlot'&&result==='merge'||api==='takeDraft'&&result==='merge')cost.merges++;
  if(api==='allocPoint'){const key=String(args[1]);cost.allocations[key]=(cost.allocations[key]??0)+1;}
  return result;
 };
 act('newRun',[hero,seed],()=>true,{offered:R.generalChoices(seed)});
 const actionHash=()=>stream.copy().digest('hex');
 const score=(id:string)=>{const x=m.data.unitDef(id),same=owned().filter(z=>z.u.defId===id);const redundantSacrificer=flow==='sacrifice'&&has(x,'sacrifice')&&same.some(z=>z.u.copies===4)?22:0;return -redundantSacrificer+ x.atk*1.8+x.hp*.65+x.tier*2+affinity(x,flow)+(same.some(z=>z.u.copies===1)?15:0)+(same.some(z=>z.u.copies===2)?6:0);};
 const merge=()=>{for(let pass=0;pass<8;pass++){const us=owned();let changed=false;for(let a=0;a<us.length&&!changed;a++)for(let b=a+1;b<us.length&&!changed;b++){const x=us[a],y=us[b];if(x.u.defId!==y.u.defId||x.u.copies!==y.u.copies||x.u.copies===4)continue;
  if((flow==='summon'||flow==='sacrifice')&&deathSummoner(d(x.u))&&us.filter(z=>deathSummoner(d(z.u))).length<=2)continue;
  act('moveSlot',[x.i,y.i,'auto'],()=>R.moveSlot(r,x.i,y.i,'auto'));changed=true;}if(!changed)break;}};
 const fuel=(u:Slotted)=>deathSummoner(d(u))||!!d(u).traits?.reborn;
 const investment=(u:Slotted)=>Object.values(u.train??{}).reduce<number>((n,v)=>n+(v??0),0)+(u.equips?.length??0)*2;
 const arrange=()=>{
  const us=owned(),ranked=[...us].sort((a,b)=>value(b.u)-value(a.u)),required:{u:Slotted;i:number}[]=[];
  const need=(pred:(u:Slotted)=>boolean,n:number)=>{for(const x of ranked.filter(z=>pred(z.u)).slice(0,n))if(!required.includes(x))required.push(x);};
  if(flow==='spell'){need(u=>(d(u).cast??[]).some(e=>e.op==='dmg'),2);need(u=>['solus','matriarch','brood'].includes(d(u).special??''),1);if(required.length<4)need(u=>healing(d(u)),1);}
  if(flow==='summon'){need(u=>deathSummoner(d(u)),2);need(u=>!!d(u).onAllyFaint?.length,1);}
  if(flow==='sacrifice'){
   need(u=>has(d(u),'sacrifice'),1);
   // Treat already trained/equipped units as investments, not disposable ritual fuel.
   const foods=ranked.filter(x=>fuel(x.u)&&!has(d(x.u),'sacrifice')).sort((a,b)=>investment(a.u)-investment(b.u)||tank(b.u)-tank(a.u)).slice(0,2);
   for(const food of foods)if(!required.includes(food))required.push(food);
   need(u=>!fuel(u)&&!d(u).cast&&attack(u)>=3,1);
   if(required.length<5)need(u=>!!d(u).onAllyFaint?.length,1);
  }
  need(u=>affinity(d(u),flow)>=10,1);
  if(required.length<5)need(u=>!d(u).cast&&attack(u)>=3&&(!(flow==='sacrifice'||flow==='summon')||!fuel(u)),1);
  const bestTank=[...ranked].sort((a,b)=>tank(b.u)-tank(a.u))[0];if(bestTank&&!required.includes(bestTank)&&required.length<5)required.push(bestTank);
  let team=[...required,...ranked.filter(x=>!required.includes(x))].slice(0,5).sort((a,b)=>tank(b.u)-tank(a.u));
  if(flow==='sacrifice'){
   const caster=team.find(x=>has(d(x.u),'sacrifice'));
   const foods=team.filter(x=>x!==caster&&fuel(x.u)).sort((a,b)=>investment(a.u)-investment(b.u)).slice(0,2);
   if(caster&&foods.length){
    // Only actual sacrificial/reborn bodies go ahead of the ritualist; the core stays behind.
    const foodsInOrder=foods.length===2?[foods[1],foods[0]]:foods;
    team=[...foodsInOrder,caster,...team.filter(x=>x!==caster&&!foods.includes(x))];
   }
  }else if(flow==='summon'){
   const bodies=team.filter(x=>deathSummoner(d(x.u)));
   const front=team.filter(x=>!bodies.includes(x)).sort((a,b)=>tank(b.u)-tank(a.u))[0];
   team=[...(front?[front]:[]),...bodies,...team.filter(x=>x!==front&&!bodies.includes(x))];
  }
  if(drawStreak>0){const rotate=drawStreak%team.length;team=[...team.slice(rotate),...team.slice(0,rotate)];if(drawStreak>=5){const substitute=ranked.find(x=>!team.includes(x));if(substitute)team[drawStreak%team.length]=substitute;}}
  const ids=team.map(x=>x.u.ownedId);for(let to=0;to<ids.length;to++){const from=owned().find(x=>x.u.ownedId===ids[to])!.i;if(from!==to)act('moveSlot',[from,to,'swap'],()=>R.moveSlot(r,from,to,'swap'));}
 };
 const recruit=()=>{
  if(r.orders.length){const options=R.orderOptions(r,r.orders[0]),tag:Record<Flow,string>={action:'行动次数',burn:'灼烧',frost:'寒意',spell:'施法',defense:'护甲',healing:'复生',summon:'召唤',sacrifice:'献祭',vuln:'易伤'};
   if(options.length){const pick=options.includes(tag[flow])?tag[flow]:options[0];act('useOrder',[0,pick],()=>R.useOrder(r,0,pick));}}
  let choices=r.draft.map((id,i)=>({id,i,value:score(id)})).sort((a,b)=>b.value-a.value);
  if(r.rerolls>0&&owned().length>=3&&choices[0]&&affinity(m.data.unitDef(choices[0].id),flow)<5){act('reroll',[],()=>R.reroll(r),{offered:[...r.draft]});choices=r.draft.map((id,i)=>({id,i,value:score(id)})).sort((a,b)=>b.value-a.value);}
  const chosen=choices[0];if(!chosen)throw new Error('No visible candidate');const us=owned(),empty=Array.from({length:8},(_,i)=>i).find(i=>!R.getOwned(r,i));
  const preserve=(flow==='summon'||flow==='sacrifice')&&deathSummoner(m.data.unitDef(chosen.id))&&us.filter(x=>deathSummoner(d(x.u))).length<2&&empty!==undefined;
  const same=preserve?undefined:us.find(x=>x.u.defId===chosen.id&&x.u.copies===1);
  const weak=[...us].filter(x=>R.placeKind(r,chosen.id,x.i)!=='invalid').sort((a,b)=>value(a.u)-value(b.u))[0];let target=same?.i??empty??weak?.i;
  if(target===undefined){const release=[...us].sort((a,b)=>value(a.u)-value(b.u))[0];act('sell',[release.i],()=>R.sell(r,release.i));target=release.i;}
  const slot=target;act('takeDraft',[chosen.i,slot,true],()=>R.takeDraft(r,chosen.i,slot,true),{offered:[...r.draft],id:chosen.id});merge();
 };
 const equipScore=(id:string)=>flow==='burn'&&id==='eq_flame'?30:flow==='frost'&&id==='eq_frost'?30:['spell','healing'].includes(flow)&&id==='eq_tome'?30:['action','vuln'].includes(flow)&&id==='eq_combo'?30:flow==='healing'&&id==='eq_belt'?26:flow==='defense'&&['eq_thorn','eq_guard','eq_ice'].includes(id)?28:['summon','sacrifice'].includes(flow)&&id==='eq_halo'?25:10;
 // Conservative expected marginal benefit. This is an exposed heuristic, not a balance formula.
 const poweredOps=new Set(['dmg','heal','burn','chill','vuln']);
 const poweredValue=(u:Slotted)=>{
  const x=d(u),l=level(u);let gain=0;
  for(const e of x.cast??[]){if(!poweredOps.has(e.op)||tri(e.v,l)<=0)continue;
   const group=['allies','enemyAll','burningEnemies','otherEnemies','guardAllies'].includes(e.to);
   const weight=e.op==='dmg'?1:e.op==='heal'?.8:e.op==='burn'?.85:e.op==='chill'?.65:.55;
   gain+=weight*(group?1.35:1);
  }
  if(flow==='spell'&&(x.cast??[]).some(e=>e.op==='dmg'))gain*=1.35;
  if(flow==='healing'&&healing(x))gain*=1.3;
  return gain/(1+(u.train?.power??0)*.1);
 };
 const generalValue=()=>{
  const base:Record<string,number>={argeon:1.15,kaleos:1.3,lilithe:1.45,vulkan:1.5,faie:1.05,zirix:.95,hank:1.25};
  let gain=base[hero]??1;
  if(hero==='argeon'&&r.passives.includes('argeon_1'))gain*=1.4;
  if(hero==='lilithe'&&r.passives.includes('lilithe_2'))gain*=1.35;
  if(hero==='kaleos'&&r.passives.includes('kaleos_2'))gain*=1.4;
  if(hero==='zirix'&&r.passives.includes('zirix_1'))gain*=1.35;
  if(r.passives.includes('argeon_4')||r.passives.includes('hank_3'))gain*=1.3;
  return gain/(1+r.genPower*.14);
 };
 const prepare=()=>{
  const field=owned().filter(x=>x.i<5);if(!field.length)throw new Error('Empty field');
  const ritual=flow==='sacrifice'?field.find(x=>has(d(x.u),'sacrifice')):undefined;
  const foodIds=new Set(ritual?field.filter(x=>x.i<ritual.i).map(x=>x.u.ownedId):[]);
  const eligible=field.filter(x=>!foodIds.has(x.u.ownedId)&&!has(d(x.u),'sacrifice'));
  const carry=[...(eligible.length?eligible:field)].sort((a,b)=>attack(b.u)-attack(a.u))[0].i;
  const defenseTarget=ritual?carry:0;
  for(const type of Object.keys(r.stash))while(r.stash[type]>0){
   let to:number|'general';
   if(type==='power'){
    const candidate=[...field].sort((a,b)=>poweredValue(b.u)-poweredValue(a.u))[0];
    to=candidate&&poweredValue(candidate.u)>generalValue()?candidate.i:'general';
   }else to=type==='atk'?carry:type==='hp'&&flow==='healing'?field[(r.stash[type]+seed)%field.length].i:defenseTarget;
   act('allocPoint',[to,type],()=>R.allocPoint(r,to,type),{reason:type==='power'?'positive marginal powered effect or actual general ability; no power on unscaled support':undefined});
  }
  const attacks=(u:Slotted)=>!d(u).cast||d(u).castUses!==undefined;
  const utility=(id:string,x:{u:Slotted;i:number})=>{
   const eq=m.content.EQUIP_MAP[id];
   if((eq.grants?.power??0)>0)return poweredValue(x.u)*20;
   if(eq.afterAttack?.length||eq.grants?.combo||eq.grants?.snipe||eq.special==='hammer')return attacks(x.u)?x.i===carry?24:10:0;
   if(id==='eq_banner')return Math.abs(x.i-carry)===1?22:5;
   if(id==='eq_halo'&&ritual&&foodIds.has(x.u.ownedId))return 25;
   return x.i===defenseTarget?20:8;
  };
  for(let guard=0;r.bag.length&&guard<16;guard++){
   const bagIndex=r.bag.findIndex(id=>field.some(x=>(R.getOwned(r,x.i)?.equips?.length??0)<R.equipCap(r)&&utility(id,x)>0));
   if(bagIndex<0)break;
   const id=r.bag[bagIndex],candidates=[...field].filter(x=>(R.getOwned(r,x.i)?.equips?.length??0)<R.equipCap(r)&&utility(id,x)>0).sort((a,b)=>utility(id,b)-utility(id,a));
   const target=candidates[0];if(!target)break;
   act('equip',[bagIndex,target.i],()=>R.equip(r,bagIndex,target.i),{id,reason:'actual equipment recipient can use the granted effect'});
  }
  for(let i=r.spells.length-1;i>=0;i--)if(!r.activeSpells.includes(r.spells[i]))act('useSpell',[i],()=>R.useSpell(r,i));
 };
 const promoScore=(id:string)=>{
  const byFlow:Record<Flow,Record<string,number>>={action:{g_chain:40,g_first:34,hank_3:35,hank_1:33},burn:{g_dual:25,vulkan_1:40,vulkan_2:38,vulkan_4:36},frost:{g_tide:40,faie_1:38,faie_4:36},spell:{g_surge:40,g_first:20},defense:{g_core:35,g_reserve:30,g_dual:28},healing:{argeon_1:45,argeon_4:40,g_surge:35,g_revive:30},summon:{g_martyr:40,g_revive:30,g_reserve:28},sacrifice:{g_martyr:40,g_revive:38,lilithe_1:35,lilithe_4:32},vuln:{zirix_1:40,zirix_2:38,zirix_3:35,g_chain:30,g_weak:28}};
  return byFlow[flow][id]??(id.startsWith(hero+'_')?20:id==='g_dual'?18:id==='g_drill'?16:id==='g_first'?15:8);
 };
 let termination='unfinished';
 try{for(let step=0;step<1000&&!r.over;step++){
  const sc=R.screen(r);
  if(sc==='promo'){const i=r.promo!.map((id,i)=>({id,i})).sort((a,b)=>promoScore(b.id)-promoScore(a.id))[0].i;act('choosePromo',[i],()=>R.choosePromo(r,i),{offered:[...r.promo!]});continue;}
  if(sc==='reward'){const i=r.reward!.map((id,i)=>({id,i})).sort((a,b)=>equipScore(b.id)-equipScore(a.id))[0].i;act('chooseReward',[i],()=>R.chooseReward(r,i),{offered:[...r.reward!]});continue;}
  if(sc==='shop'){
   const shop=r.shop!;
   for(const x of shop.units.map((x,i)=>({...x,i})).sort((a,b)=>score(b.id)-score(a.id)))if((typeof R.shopUnitBuysRemaining!=='function'||R.shopUnitBuysRemaining(r)>0)&&!x.sold&&r.gold>=x.price&&(owned().length<8||owned().some(y=>y.u.defId===x.id&&y.u.copies===1))){act('buy',['units',x.i],()=>R.buy(r,'units',x.i),{id:x.id,price:x.price});merge();}
   if(shop.pack&&!shop.pack.sold&&r.gold>=shop.pack.price)act('buy',['pack'],()=>R.buy(r,'pack'));
   for(const x of shop.equips.map((x,i)=>({...x,i})).sort((a,b)=>equipScore(b.id)-equipScore(a.id)))if(!x.sold&&r.gold>=x.price&&r.bag.length+owned().reduce((n,y)=>n+(y.u.equips?.length??0),0)<5*R.equipCap(r))act('buy',['equips',x.i],()=>R.buy(r,'equips',x.i),{id:x.id,price:x.price});
   for(let i=0;i<shop.spells.length;i++)if(!shop.spells[i].sold&&r.gold>=shop.spells[i].price+3)act('buy',['spells',i],()=>R.buy(r,'spells',i),{id:shop.spells[i].id,price:shop.spells[i].price});
   if(shop.order&&!shop.order.sold&&r.gold>=shop.order.price+3)act('buy',['order'],()=>R.buy(r,'order'));
   act('leaveShop',[],()=>R.leaveShop(r));continue;
  }
  if(sc==='fork'){const fork=r.lives>=2?'elite':'normal';act('pickFork',[fork],()=>R.pickFork(r,fork));continue;}
  while(r.picks>0)recruit();merge();arrange();prepare();
  const node=R.currentNode(r),isFirst=node.kind==='boss'&&!seen.has(r.chapter),checkpoint=isFirst?R.cloneRun(r):null;
  const setup=R.buildBattle(r),out=m.engine.simulate({...setup,record:isFirst});if(out.fault)throw new Error(`Engine fault: ${out.fault}`);
  battleCount++;
  if(node.kind==='boss')bossAttempts.push({chapter:r.chapter,first:isFirst,outcome:outcome(out,isFirst,m)});
  if(checkpoint){seen.add(checkpoint.chapter);const sources=supply(m,checkpoint),o=outcome(out,true,m),expected=[0,2,3][checkpoint.chapter];bosses.push({chapter:checkpoint.chapter,name:node.name,checkpoint,actionCount,actionHash:actionHash(),stage:{promotions:checkpoint.promoCount,expectedPromotions:expected,power:checkpoint.genPower,passives:[...checkpoint.passives],stageMatches:checkpoint.promoCount===expected},cost:structuredClone(cost),supply:sources,outcome:o,mechanism:mechanism(flow,sources,o)});}
  act('beginBattle',[out.result,out.gold??0],()=>{R.beginBattle(r,out.result,out.gold??0);return true;});act('finishBattle',[],()=>R.finishBattle(r));
  const key=`${r.chapter}:${r.node}`;if(out.result==='draw'&&node.kind==='boss'){drawStreak=drawKey===key?drawStreak+1:1;drawKey=key;}else{drawStreak=0;drawKey='';}
  if(battleCount>=150){termination='unfinished-battle-limit';break;}
 }if(r.over)termination=r.over;}catch(e){termination='harness-error';error=e instanceof Error?e.stack??e.message:String(e);process.exitCode=1;}
 return {actionTrace:`actions/${phase}/${flow}/${hero}/${seed}.json.gz`,inlineActions:keepActions,bossAttempts,phase,flow,hero,seed,termination,error,actions:actionCount,actionHash:actionHash(),cost,wins:r.wins,lives:r.lives,battles:battleCount,bosses,traceFile:`runs/${phase}/${flow}/${hero}/${seed}.json`,fullActions:full};
}

interface Plan {key:string;moves:[number,number][]}
function plans(checkpoint:RunState):Plan[]{
 const populated=checkpoint.slots.map((u,i)=>u?i:-1).filter(i=>i>=0),bench=checkpoint.bench.map((u,i)=>u?i+5:-1).filter(i=>i>=5);
 const result:Plan[]=[{key:'original',moves:[]}];
 for(let i=1;i<populated.length;i++)result.push({key:`front-${i}`,moves:[[populated[0],populated[i]]]});
 for(const b of bench)for(const f of populated)result.push({key:`bench-${b}-to-${f}`,moves:[[b,f]]});
 for(let i=0;i<populated.length;i++)for(let j=i+1;j<populated.length;j++)if(i>0)result.push({key:`swap-${i}-${j}`,moves:[[populated[i],populated[j]]]});
 result.push({key:'reverse',moves:[[0,4],[1,3]]});return result.slice(0,Math.max(1,optCount));
}
function tactical(m:Modules,checkpoint:RunState,candidates:Plan[]){
 const run=(plan:Plan,logged:boolean)=>{const r=m.run.cloneRun(checkpoint);for(const[from,to]of plan.moves){if(!m.run.getOwned(r,from))continue;const res=m.run.moveSlot(r,from,to,'swap');if(res==='invalid')throw new Error(`Invalid tactical swap ${plan.key}`);}const out=m.engine.simulate({...m.run.buildBattle(r),record:logged});if(out.fault)throw new Error(`Tactical engine fault ${out.fault}`);return {plan,outcome:outcome(out,logged,m),slots:r.slots,bench:r.bench};};
 const original=run(candidates[0],true);let best=original;const results:unknown[]=[];
 const rank=(o:Outcome)=>o.result==='win'?2000-o.beats:o.result==='draw'?1000:0;
 for(const plan of candidates){const result=plan===candidates[0]?original:run(plan,false);results.push({plan,outcome:result.outcome});if(rank(result.outcome)>rank(best.outcome))best=result;}
 if(best.plan!==candidates[0])best=run(best.plan,true);
 return {original,optimized:best,candidates:results};
}
interface PairResult {flow:Flow;hero:string;seed:number;chapter:number;snapshot:string;before:ReturnType<typeof tactical>;after:ReturnType<typeof tactical>;candidateCount:number}
const runs:RunResult[]=[],pairs:PairResult[]=[];
for(const flow of flows)for(const hero of heroes){
 const cell:RunResult[]=[];
 for(let index=0;index<seedGroups[hero].length;index++){
  const seed=seedGroups[hero][index];
  for(const phase of ['before','after'] as Phase[]){const result=play(modules[phase],phase,flow,hero,seed,index<2);
   // Every completed, failed, unfinished or errored run retains every attempted legal action.
   // Gzip compresses audit evidence, never game data; release action arrays before the next run.
   const auditPath=join(outputDir,result.actionTrace);mkdirSync(resolve(auditPath,'..'),{recursive:true});
   writeFileSync(auditPath,gzipSync(JSON.stringify({schema:1,phase,flow,hero,seed,actionHash:result.actionHash,hashEncoding:'sha256 of JSON.stringify(action) plus newline, in order',actions:result.fullActions??[]})));
   if(!result.inlineActions)delete result.fullActions;
   write(result.traceFile,result);delete result.fullActions;runs.push(result);cell.push(result);
   if(phase==='before')for(const boss of result.bosses){const candidates=plans(boss.checkpoint),pair:PairResult={flow,hero,seed,chapter:boss.chapter,snapshot:result.traceFile,before:tactical(modules.before,boss.checkpoint,candidates),after:tactical(modules.after,boss.checkpoint,candidates),candidateCount:candidates.length};
    write(`pairs/${flow}/${hero}/${seed}-boss-${boss.chapter+1}.json`,pair);pairs.push(pair);}
  }
 }
 console.log(JSON.stringify({flow,hero,runs:cell.length,beforeClears:cell.filter(r=>r.phase==='before'&&r.termination==='victory').length,afterClears:cell.filter(r=>r.phase==='after'&&r.termination==='victory').length,errors:cell.filter(r=>r.error).length}));
}
const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
function resultStats(list:Outcome[]){return {n:list.length,win:list.filter(o=>o.result==='win').length,draw:list.filter(o=>o.result==='draw').length,lose:list.filter(o=>o.result==='lose').length,winningBeatsMean:mean(list.filter(o=>o.result==='win').map(o=>o.beats))};}
const ownRoute=[] as unknown[],paired=[] as unknown[];
for(const flow of flows)for(const hero of heroes)for(let chapter=0;chapter<3;chapter++){
 const row:Record<string,unknown>={flow,hero,chapter};
 for(const phase of ['before','after'] as Phase[]){const group=runs.filter(r=>r.flow===flow&&r.hero===hero&&r.phase===phase),reached=group.flatMap(r=>r.bosses.filter(b=>b.chapter===chapter)),results=resultStats(reached.map(b=>b.outcome)),metricKeys=new Set(reached.flatMap(b=>Object.keys(b.outcome.metrics)));
  row[phase]={runs:group.length,reached:reached.length,reachRate:reached.length/group.length,firstEncounter:results,firstWinRateAmongReached:reached.length?results.win/reached.length:null,firstWinRateAmongStarts:results.win/group.length,fullClears:group.filter(r=>r.termination==='victory').length,defeats:group.filter(r=>r.termination==='defeat').length,unfinished:group.filter(r=>r.termination.startsWith('unfinished')).length,errors:group.filter(r=>r.error).length,repeatBossAttempts:resultStats(group.flatMap(r=>r.bossAttempts.filter(a=>a.chapter===chapter&&!a.first).map(a=>a.outcome))),stageMismatch:reached.filter(b=>!b.stage.stageMatches).length,meanPower:mean(reached.map(b=>b.stage.power)),promotionCounts:reached.map(b=>b.stage.promotions),meanGoldSpentAtBoss:mean(reached.map(b=>b.cost.goldSpent)),meanAllocationOperationsAtBoss:mean(reached.map(b=>Object.values(b.cost.allocations).reduce((a,b)=>a+b,0))),meanFieldTrainingAtBoss:mean(reached.map(b=>b.checkpoint.slots.reduce((n,u)=>n+Object.values(u?.train??{}).reduce<number>((a,v)=>a+(v??0),0),0))),meanBenchTrainingAtBoss:mean(reached.map(b=>b.checkpoint.bench.reduce((n,u)=>n+Object.values(u?.train??{}).reduce<number>((a,v)=>a+(v??0),0),0))),castingOccurred:reached.filter(b=>b.mechanism.castingOccurred).length,damagingCasterPresent:reached.filter(b=>b.mechanism.damagingCasterPresent).length,damagingCasterActivated:reached.filter(b=>(b.mechanism.damagingCasterHitEvents??0)>0).length,supplied:reached.filter(b=>b.mechanism.supplied).length,activated:reached.filter(b=>b.mechanism.activated).length,activatedAndWon:reached.filter(b=>b.mechanism.activated&&b.outcome.result==='win').length,meanMetrics:Object.fromEntries([...metricKeys].map(k=>[k,mean(reached.map(b=>(b.outcome.metrics as Record<string,number>)[k]??0))]))};
 }
 ownRoute.push(row);const ps=pairs.filter(p=>p.flow===flow&&p.hero===hero&&p.chapter===chapter);
 const changes={improved:0,worsened:0,same:0},rank=(o:Outcome)=>o.result==='win'?2:o.result==='draw'?1:0;
 for(const p of ps){const diff=rank(p.after.original.outcome)-rank(p.before.original.outcome);if(diff>0)changes.improved++;else if(diff<0)changes.worsened++;else changes.same++;}
 paired.push({flow,hero,chapter,acquiredBeforeSnapshots:ps.length,original:{before:resultStats(ps.map(p=>p.before.original.outcome)),after:resultStats(ps.map(p=>p.after.original.outcome)),changes},tacticalUpperBound:{candidateCount:optCount||1,before:resultStats(ps.map(p=>p.before.optimized.outcome)),after:resultStats(ps.map(p=>p.after.optimized.outcome)),warning:'Same legitimately acquired before inventory. Deterministic search over at most BOSS_OPT legal swap formations including original, selected with combat outcome knowledge. Not ordinary player first-attempt success or whole-run clear rate.'}});
}
write('summary.json',{schema:1,policyRevision:POLICY_REVISION,parameters:{SEEDS_PER_CELL:sampleCount,START:start,BOSS_OPT:optCount,FLOWS:flows,HEROES:heroes},sourceHashes,runs:runs.map(({bosses,...r})=>({...r,reachedBosses:bosses.map(b=>b.chapter),keepsFullActions:true,inlineActions:r.inlineActions})),ownRoute,paired,method:'Every own-route defeat/unfinished/error remains in its starting denominator. Boss first encounters only; replay attempts never replace them. Each before snapshot is generated by that completed prefix of legal player API actions, with exact stars, training, equips, spells, genPower and passives. Same inventory means same acquired player data, each version uses its own buildBattle/engine and balance definitions.'});
const lines=['# 合法远征与三首领配对对照','',`每cell ${sampleCount}局；${flows.length}种策略 × ${heroes.length}名主将 × 2版本；START=${start}，BOSS_OPT=${optCount}。`,'','本报告是自动策略对可见候选的合法操作抽样，不是普通玩家难度或全玩家通关率。机制来源、实际触发和战斗结果分别记录；策略标签不代表纯流派。首遇前主将法强、真实升阶次数和全部被动见每局bosses[].checkpoint。','',`完整JSON：[summary.json](summary.json)，版本与合法种子：[manifest.json](manifest.json)。每局完整动作均保留在actions/目录的独立gzip审计文件，逐局JSON内有路径及动作哈希；每cell每版本前2局另外内嵌动作便于阅读。所有首领首遇快照保持原样，内存不累计保留全量动作数组。失败、未结束和错误均保留分母。`,'','同库存配对只使用before正常游玩获得的快照。换位搜索只调用moveSlot(...,swap)，不增加、替换或重新培养单位；此部分是至多24候选的战术搜索上界，不能当作普通玩家首战或整局通关率。','',`运行结果：${runs.length}局；错误${runs.filter(r=>r.error).length}，未结束${runs.filter(r=>r.termination.startsWith('unfinished')).length}。`];
writeFileSync(join(outputDir,'REPORT.md'),lines.join('\n'),'utf8');
console.log(`Wrote ${runs.length} legal runs and ${pairs.length} acquired-inventory Boss pairs to ${outputDir}`);
