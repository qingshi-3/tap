// Read-only synthetic unit strength and growth probe. Run: npx vite-node scripts/unit-strength-v09.ts
// @ts-expect-error Node host modules are deliberately absent from the browser tsconfig.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
// @ts-expect-error Node host module.
import { createHash } from 'node:crypto';
import { DRAFT_POOL, unitDef } from '../src/core/data';
import { simulate } from '../src/core/engine';
import { newRun } from '../src/core/run';
import { prepEvent } from '../src/core/preparation';
import type { UnitDef, Slotted, Copies } from '../src/core/types';
declare const process: { env: Record<string,string|undefined>; exit(n:number):never };
const smoke=process.env.UNIT_SMOKE==='1';
const selected=smoke?DRAFT_POOL.filter(x=>['a_seed','d_artificer','n_gladiator'].includes(x.id)):DRAFT_POOL;
const dir='../output/strength-audit-20261022/units/'+(smoke?'smoke/':'');mkdirSync(dir,{recursive:true});
const write=(name:string,data:unknown)=>writeFileSync(dir+name,JSON.stringify(data,null,2));
const sha=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
const files=['src/core/data.ts','src/core/content.ts','src/core/engine.ts','src/core/power.ts','src/core/preparation.ts','src/core/types.ts'];
const hashes=()=>Object.fromEntries(files.map(f=>[f,sha(f)]));const before=hashes();
const design=JSON.parse(readFileSync('../output/six-tier-rework-20261022/unit-rework.json','utf8'));
const features=(d:UnitDef)=>new Set([...(d.tags??[]).map(t=>t.replace(/^[给吃读]/,'')),...Object.keys(d.traits??{})]);
const overlap=(a:UnitDef,b:UnitDef)=>[...features(a)].filter(t=>features(b).has(t)&&!['前排','输出','辅助','培养','购买','出售','升星'].includes(t)).length;
const family=(d:UnitDef)=>d.onAllyFaint?.some(e=>e.op==='summon')||d.tags?.includes('召唤')?'summon':d.traits?.charge?'charge':d.tags?.some(t=>t.includes('寒意'))?'freeze':d.tags?.some(t=>t.includes('灼烧'))?'burn':d.tags?.some(t=>t.includes('轮换'))?'rotate':d.tags?.some(t=>t.includes('亡语'))?'death':d.cast?'caster':d.traits?.combo?'combo':d.traits?.duel?'duel':d.traits?.armor?'armor':d.prep?.length?'prep':'physical';
const match=(a:UnitDef,b:UnitDef)=>overlap(a,b)*2+(family(a)===family(b)?8:0)+['前排','输出','辅助','施法'].filter(t=>a.tags?.includes(t)&&b.tags?.includes(t)).length*3;
const pairs:Record<string,string[]>={summon:['a_seed','d_glass'],charge:['d_keeper','d_hourglass'],freeze:['v_chaser','v_scout'],burn:['m_shaman','m_harvester'],rotate:['l_shield','l_windblade'],death:['a_seed','a_reaper'],caster:['l_priest','s_caster'],combo:['n_breaker','s_dancer'],duel:['s_fox','s_backstab'],armor:['l_priest','v_bear'],prep:['n_gladiator','s_wind'],physical:['n_breaker','s_dancer']};
const normal=['e_brute','e_golem','e_raider','e_assassin','e_silencer'];
const counters:Record<string,string[]>={summon:['e_exile','e_crusher','e_lich','e_pyre','e_warlord'],charge:['e_guardian','e_silencer','e_assassin','e_lich','e_curser'],freeze:['e_warlord','e_brute','e_assassin','e_curser','e_twin'],burn:['m_heart','e_lich','e_assassin','e_pyre','e_warlord'],rotate:['e_guardian','e_silencer','e_assassin','e_lich','e_curser'],death:['e_exile','e_crusher','e_lich','e_pyre','e_warlord'],caster:['e_guardian','e_assassin','e_silencer','e_lich','e_curser'],combo:['e_golem','e_thorn','e_guardian','e_curser','e_lich'],duel:['e_guardian','e_golem','e_assassin','e_curser','e_lich'],armor:['e_pyre','e_lich','m_shaman','e_assassin','e_warlord'],prep:['e_brute','e_golem','e_assassin','e_curser','e_lich'],physical:['e_golem','e_thorn','e_guardian','e_curser','e_lich']};
const investments=[{id:'none',points:0,train:{}},{id:'balanced4',points:4,train:{atk:2,hp:2}},{id:'balanced12',points:12,train:{atk:6,hp:6}},{id:'power4',points:4,train:{power:4}},{id:'power12',points:12,train:{power:12}}];
const rows:any[]=[];const cache=new Map<string,any>();let faults=0;
function run(setup:any,slot:number|null){
 const key=JSON.stringify([setup,slot]);if(cache.has(key))return cache.get(key);
 const out=simulate({...setup,record:true});if(out.fault)faults++;
 const actor=out.initial.find(u=>u.side===0&&u.slot===slot),uid=actor?.uid;
 const a:any={actions:0,casts:0,charges:0,firstActionBeat:null,firstChargeBeat:null,summons:0,triggerLabels:0,healEventAmount:0,blockGranted:0,chillApplied:0,burnApplied:0,directEffectiveDamage:0,deathBeat:null,aliveEnd:false,allyDeathsWhileAlive:0,enemyFrozenWhileAlive:0,summonActed:0,summonDiedBeforeAction:0};
 const ally=new Set(out.initial.filter(u=>u.side===0).map(u=>u.uid)),foe=new Set(out.initial.filter(u=>u.side===1).map(u=>u.uid));
 const child=new Set<number>(),acted=new Set<number>();let beat=0,fatigue=false;let prev=new Map(out.initial.map(u=>[u.uid,u.hp]));
 for(const {ev,snap} of out.log){
  if(ev.t==='beat')beat=ev.n;
  for(const u of snap)(u.side===0?ally:foe).add(u.uid);
  const alive=!!snap.find(u=>u.uid===uid&&u.alive&&u.hp>0);
  if(ev.t==='dmg'&&ev.kind==='fatigue')fatigue=true;
  if(ev.t==='act'&&ev.uid===uid){a.actions++;a.firstActionBeat??=beat;if(ev.mode==='cast')a.casts++;if(ev.mode==='charge'){a.charges++;a.firstChargeBeat??=beat;}}
  if(ev.t==='dmg'&&ev.src===uid&&foe.has(ev.tgt)&&ev.kind!=='fatigue')a.directEffectiveDamage+=Math.min(ev.n,Math.max(0,prev.get(ev.tgt)??ev.n));
  if(ev.t==='trigger'&&ev.src===uid)a.triggerLabels++;
  if(ev.t==='heal'&&ev.src===uid)a.healEventAmount+=ev.n;
  if(ev.t==='block'&&ev.src===uid)a.blockGranted+=ev.n;
  if(ev.t==='chill'&&ev.src===uid)a.chillApplied+=ev.n;
  if(ev.t==='burn'&&ev.src===uid)a.burnApplied+=ev.n;
  if(ev.t==='summon'&&ev.src===uid){a.summons++;child.add(ev.uid);}
  if(ev.t==='act'&&child.has(ev.uid))acted.add(ev.uid);
  if(ev.t==='death'&&ev.tgt===uid)a.deathBeat??=beat;
  if(ev.t==='death'&&ally.has(ev.tgt)&&ev.tgt!==uid&&alive)a.allyDeathsWhileAlive++;
  if(ev.t==='frozenSkip'&&foe.has(ev.uid)&&alive)a.enemyFrozenWhileAlive++;
  if(ev.t==='death'&&child.has(ev.tgt)&&!acted.has(ev.tgt))a.summonDiedBeforeAction++;
  prev=new Map(snap.map(u=>[u.uid,u.hp]));
 }
 a.summonActed=acted.size;const last=out.log.at(-1)?.snap??out.afterStart;a.aliveEnd=!!last.find(u=>u.uid===uid&&u.alive&&u.hp>0);
 const result={result:out.result,beats:out.beats,rounds:out.rounds,fatigue,fault:out.fault??null,metrics:out.metrics,actor:uid===undefined?null:a,remainingPlayerHp:last.filter(u=>u.side===0&&u.alive).reduce((n,u)=>n+u.hp,0),remainingEnemyHp:last.filter(u=>u.side===1&&u.alive).reduce((n,u)=>n+u.hp,0)};cache.set(key,result);return result;
}
if(process.env.UNIT_STAGE_ONLY==='1') {
 const staged:any[]=[];
 for(const d of DRAFT_POOL){
  const reference=DRAFT_POOL.filter(x=>x.tier===d.tier&&x.id!==d.id).sort((a,b)=>match(d,b)-match(d,a)||a.id.localeCompare(b.id))[0];
  for(const context of ['basic','synergy'])for(const slot of [0,4])for(const investment of investments.slice(0,3))for(const pressure of ['opening','standard']) {
   const allies=context==='basic'?['n_bulwark','n_archer','n_gladiator','n_thorn']:[...pairs[family(d)].filter(id=>id!==d.id),'n_bulwark','n_archer','n_gladiator','n_thorn'].slice(0,4);
   const entry=(id:string)=>({defId:id,ownedId:1,copies:1,train:investment.train});
   const arranged=context==='basic'||slot===0?allies:[...allies].reverse();
   const line:any[]=arranged.map((defId,i)=>({defId,ownedId:10+i,copies:1}));line.splice(slot,0,entry(d.id));
   const enemy=pressure==='opening'?Array.from({length:5},()=>({defId:'e_skel',atk:1,hp:3})):normal.map(defId=>({defId,level:1}));
   const setup={player:line,enemy,seed:841022,chapter:1};
   staged.push({id:d.id,level:1,context,slot,investment:investment.id,points:investment.points,pressure,reference:reference.id,allies:arranged,enemy,actual:run(setup,slot),ref:run({...setup,player:line.map((x,i)=>i===slot?entry(reference.id):x)},slot)});
  }
 }
 write('one-star-accessibility.json',{synthetic:true,purpose:'Supplement fixed two-star stress floor; not an expedition encounter claim',rows:staged,uniqueBattles:cache.size,faults,hashesBefore:before,hashesAfter:hashes()});
 console.log(JSON.stringify({stageRows:staged.length,battles:cache.size,faults}));process.exit(0);
}
for(const d of selected){
 const pick=(pool:UnitDef[])=>pool.filter(x=>x.id!==d.id).sort((a,b)=>match(d,b)-match(d,a)||a.id.localeCompare(b.id))[0];
 const reference=pick(DRAFT_POOL.filter(x=>x.tier===d.tier))!;
 const lower=d.tier>1?pick(DRAFT_POOL.filter(x=>x.tier===d.tier-1))!:null;
 const f=family(d);const synergy=[...pairs[f].filter(id=>id!==d.id),'n_bulwark','n_archer','n_gladiator','n_thorn'].slice(0,4);
 for(const level of [1,2,3])for(const slot of [0,4])for(const context of ['basic','synergy','counter'])for(const investment of investments){
  const allies=context==='basic'?['n_bulwark','n_archer','n_gladiator','n_thorn']:synergy;
  const entry=(id:string)=>({defId:id,ownedId:slot+1,copies:([1,2,4] as Copies[])[level-1],train:investment.train});
  const arranged=context==='basic'||slot===0?allies:[...allies].reverse();
  const line:any[]=arranged.map((id,i)=>({defId:id,ownedId:10+i,copies:1}));line.splice(slot,0,entry(d.id));
  // Enemy star and authored panel are fixed across all candidate/reference/investment arms.
  const enemy=(context==='counter'?counters[f]:normal).map(defId=>({defId,level:2,atk:Math.max(3,unitDef(defId).atk),hp:unitDef(defId).hp+8}));
  const setup={player:line,enemy,seed:841022,chapter:1};
  const actual=run(setup,slot),ref=run({...setup,player:line.map((x,i)=>i===slot?entry(reference.id):x)},slot),empty=run({...setup,player:line.map((x,i)=>i===slot?null:x)},null);
  const lowerResult=lower?run({...setup,player:line.map((x,i)=>i===slot?entry(lower.id):x)},slot):null;
  rows.push({id:d.id,name:d.name,tier:d.tier,family:f,level,slot,context,investment:investment.id,trainingPoints:investment.points,copies:[1,2,4][level-1],buyCost:3*[1,2,4][level-1],allies:arranged,enemy,reference:reference.id,lower:lower?.id??null,actual,ref,empty,lowerResult});
 }
 console.log(d.id,rows.length);
}
// Preparation-only hooks require successful committed events, not combat labels.
// These synthetic events measure exact bounded production; they do not claim legal gold/offer availability.
const prep:any[]=[];
for(const d of selected.filter(x=>x.prep?.length))for(const level of [1,2,3])for(const rounds of [0,1,3]){
 const r=newRun('kaleos',841022);const src:Slotted={defId:d.id,ownedId:1,copies:([1,2,4] as Copies[])[level-1]};
 const wanted=d.prep!.find(e=>e.tag||e.targetTag);const tag=wanted?.tag??wanted?.targetTag;
 const subjectDef=DRAFT_POOL.filter(x=>x.id!==d.id&&(!tag||(x.tags??[]).some(t=>t===tag||t.replace(/^[给吃读]/,'')===tag.replace(/^[给吃读]/,'')))).sort((a,b)=>a.tier-b.tier||a.id.localeCompare(b.id))[0];
 const subjects=[2,3,4,5].map(ownedId=>({defId:subjectDef.id,ownedId,copies:1 as Copies}));r.slots=[subjects[0],src,...subjects.slice(1)];r.bench=[null,null,null];
 for(let round=0;round<rounds;round++){
  r.prepUses={};r.prepCommitted=false;
  for(const event of ['buy','sell','upgrade','train','endPrep'] as const){
   if(!d.prep!.some(e=>e.event===event))continue;
   for(let repeat=0;repeat<3;repeat++){
    const fx=d.prep!.find(e=>e.event===event)!;
    const subject=fx.scope==='self'?src:subjects[repeat%subjects.length];
    prepEvent(r,event,event==='endPrep'?undefined:subject);
   }
  }
 }
 prep.push({id:d.id,level,rounds,syntheticSuccessfulEvents:true,subject:subjectDef.id,costContext:{sourceGold:3*[1,2,4][level-1],sourceBattleSlots:1,rounds,notes:'Field engine occupies one of five battle slots. This feeds three synthetic attempts per selected event/round to stress actual caps, not free legal transactions. Ally buy/sell events require traded bodies, at least net2 gold per one-star buy/sell; upgrades require extra copies (2/4 total); training consumes points. Self-buy is one real identity purchase only: repeated synthetic attempts do not model repeat purchase of same body.'},source:src.growth??{},targets:r.slots.filter(Boolean).map(u=>({id:u!.ownedId,defId:u!.defId,growth:u!.growth??{}})),limits:d.prep});
}
const summaries:any[]=[];
const win=(x:any)=>x.result==='win'?1:x.result==='lose'?-1:0;
for(const d of selected){
 const subset=rows.filter(r=>r.id===d.id),zero=subset.filter(r=>r.investment==='none');
 const mean=(v:number[])=>v.reduce((a,b)=>a+b,0)/Math.max(1,v.length);
 const marginal=(investment:string)=>{const values=subset.filter(r=>r.investment===investment).map(r=>{const base=zero.find(z=>z.level===r.level&&z.slot===r.slot&&z.context===r.context)!;return{outcome:win(r.actual)-win(base.actual),damage:r.actual.metrics.attackDamage+r.actual.metrics.spellDamage+r.actual.metrics.burnDamage-base.actual.metrics.attackDamage-base.actual.metrics.spellDamage-base.actual.metrics.burnDamage,support:r.actual.metrics.healing+r.actual.metrics.mitigated-base.actual.metrics.healing-base.actual.metrics.mitigated};});return{outcomeImproved:values.filter(x=>x.outcome>0).length,outcomeWorsened:values.filter(x=>x.outcome<0).length,meanTeamDamageDelta:mean(values.map(x=>x.damage)),meanHealingMitigationDelta:mean(values.map(x=>x.support))};};
 const byContext=Object.fromEntries(['basic','synergy','counter'].map(c=>{const a=zero.filter(r=>r.context===c);return[c,{wins:a.filter(r=>r.actual.result==='win').length,rows:a.length,meanDeltaVsRef:mean(a.map(r=>win(r.actual)-win(r.ref))),noAction:a.filter(r=>!r.actual.actor.actions).length,meanDamage:mean(a.map(r=>r.actual.actor.directEffectiveDamage)),meanTriggers:mean(a.map(r=>r.actual.actor.triggerLabels))}];}));
 const flags:string[]=[];if(!d.cast&&!d.chargeSkill)flags.push('法强非直接投资轴：无施法伤害/治疗/状态效果，先查技能再投资');
 const m4=marginal('balanced4'),m12=marginal('balanced12');if(m12.outcomeImproved===0&&m12.meanTeamDamageDelta<=0&&m12.meanHealingMitigationDelta<=0)flags.push('合成样本中重攻血投资无可见团队边际收益');
 const hasPrep=!!d.prep?.length;
 const similar=zero.filter(r=>r.actual.result===r.ref.result&&Math.abs(r.actual.metrics.attackDamage+r.actual.metrics.spellDamage+r.actual.metrics.burnDamage-r.ref.metrics.attackDamage-r.ref.metrics.spellDamage-r.ref.metrics.burnDamage)<5).length;
 if(similar>=14)flags.push('本场景未区分：至少14/18格同结果且伤害差<5，须检查支持/触发条件；不是机制同质');
 const positive=zero.filter(r=>win(r.actual)>win(r.ref)).length,negative=zero.filter(r=>win(r.actual)<win(r.ref)).length;
 if(positive>=8)flags.push('相对同阶替代爆发风险：至少8/18格结果更好（不是全卡排行）');
 const lowerWins=zero.filter(r=>r.lowerResult&&win(r.actual)>win(r.lowerResult)).length,lowerLosses=zero.filter(r=>r.lowerResult&&win(r.actual)<win(r.lowerResult)).length;
 if(!hasPrep&&d.tier>1&&lowerWins<lowerLosses)flags.push('较低阶场景结果更差：仅为场景比较，需先核对职责，不是换卡建议');
 if((byContext.synergy as any).wins>(byContext.basic as any).wins+2)flags.push('成型依赖候选：协同胜格比基础多至少3/6，队友与阵形改变的贡献未归个人');
 if(d.prep?.length)flags.push('备战事件收益见prep-growth；纯战斗行不能评价整张养成卡');
 summaries.push({id:d.id,name:d.name,tier:d.tier,family:family(d),definition:d,designDifference:design.units.find((x:any)=>x.id===d.id)?.difference,reference:zero[0].reference,lower:zero[0].lower,cells:subset.length,oneStar:zero.filter(r=>r.level===1).map(r=>({context:r.context,slot:r.slot,result:r.actual.result,reference:r.ref.result,actor:r.actual.actor})),byContext,balanced4:m4,balanced12:m12,power4:marginal('power4'),power12:marginal('power12'),similarCells:similar,betterVsReference:positive,worseVsReference:negative,betterVsLower:lowerWins,worseVsLower:lowerLosses,flags});
}
// Exclude unmatched heuristic arms from replacement judgments; retain them only as labelled scene evidence.
function comparable(a:UnitDef,b:UnitDef|undefined){
 if(!b||a.prep?.length||b.prep?.length||family(a)!==family(b))return false;
 const roles=['前排','输出','辅助','施法','召唤'];if(!roles.some(t=>a.tags?.includes(t)&&b.tags?.includes(t)))return false;
 const ops=(d:UnitDef)=>Object.values(d).filter(Array.isArray).flat().filter((e:any)=>e&&typeof e==='object'&&e.op).map((e:any)=>e.op);
 const traits=['armor','thorns','rotate','combo','duel','snipe','splash'];
 return ops(a).some(x=>ops(b).includes(x))||traits.some(t=>(a.traits as any)?.[t]&&(b.traits as any)?.[t])||!!a.special&&a.special===b.special;
}
for(const row of rows){
 row.referenceComparable=comparable(unitDef(row.id),unitDef(row.reference));
 row.lowerComparable=!!row.lower&&comparable(unitDef(row.id),unitDef(row.lower));
 row.comparisonNote='Unmatched references are scene comparisons only; not replacement recommendations.';
}
for(const summary of summaries){
 const row=rows.find(r=>r.id===summary.id)!;
 summary.referenceComparable=row.referenceComparable;summary.lowerComparable=row.lowerComparable;
 summary.flags=summary.flags.filter((f:string)=>!f.includes('不划算')&&!f.includes('场景结果更差')&&!f.includes('同阶替代近似'));
 if(!row.referenceComparable){summary.screeningReference=summary.reference;summary.reference=null;summary.betterVsReference=null;summary.worseVsReference=null;summary.similarCells=null;summary.flags=summary.flags.filter((f:string)=>!f.includes('爆发风险')&&!f.includes('本场景未区分'));summary.flags.push('同阶职责匹配NA；原启发式参照仅保留原始场景，不作换卡/同质判断');}
 if(!row.lowerComparable){summary.screeningLower=summary.lower;summary.lower=null;summary.betterVsLower=null;summary.worseVsLower=null;}
 if(row.referenceComparable&&summary.similarCells>=14&&!summary.flags.some((f:string)=>f.includes('未区分')))summary.flags.push('本场景未区分：同结果近伤害，不是机制同质，需核对支持/条件反例');
}
const after=hashes();write('method.json',{synthetic:true,seed:841022,units:selected.length,rows:rows.length,uniqueBattles:cache.size,nominalBattles:rows.reduce((n,r)=>n+(r.lower?4:3),0),faults,sourceBefore:before,sourceAfter:after,changed:files.filter(f=>before[f]!==after[f]),axes:{stars:[1,2,3],positions:[0,4],contexts:['basic','synergy','counter'],investments},limitations:['Not a legal expedition or player win-rate estimate.','Allies fixed one-star; enemy fixed two-star +8hp; candidate star comparison costs 3/6/12 gold.','Reference chosen by same-tier predeclared mechanic-family + role-tag overlap, deterministic ID tie; not tuned from outcomes.','Lower tier reference same star/cost/investment; no offer scarcity or refresh price.','No combined scalar power score. Team damage excludes thorns in its small screening proxy; detailed metrics retain thorns.','Preparation harness feeds labelled synthetic successful events to real prepEvent; repeated scopes stress caps, not gold/stock legal transactions.','Direct actor effective damage uses prior log HP; burn descendants not re-attributed; heal/block event amounts are raw, team metrics actual.']});
write('cells.json',rows);write('by-id.json',Object.fromEntries(summaries.map(r=>[r.id,r])));write('prep-growth.json',prep);
let md='# 112普通卡受控强度与成长诊断\n\n合成fixture，仅用于机制比较，不代表合法远征可得性或玩家胜率。完整控制变量见method.json，逐ID见by-id.json，逐格含参照/空槽/低一阶对照见cells.json。\n\n|ID|阶/族|同阶参照|较参照更好/更差格(18零投入)|平衡4→12点改善格|较低阶更好/更差|筛查标记|\n|---|---|---|---|---|---|---|\n';
for(const r of summaries)md+=`|${r.id} ${r.name}|${r.tier}/${r.family}|${r.reference}|${r.betterVsReference}/${r.worseVsReference}|${r.balanced4.outcomeImproved}→${r.balanced12.outcomeImproved}|${r.betterVsLower}/${r.worseVsLower}|${r.flags.join('；')||'本筛查未命中，不等于证明平衡'}|\n`;
md+='\n## 风险筛查入口\n\n以下按证据触发，不是总强度榜。\n';for(const r of summaries.filter(r=>r.flags.some((x:string)=>x.includes('爆发风险')||x.includes('不划算')||x.includes('无可见'))))md+=`\n- ${r.id}：${r.flags.join('；')}。参照${r.reference}，低阶${r.lower??'无'}。\n`;
writeFileSync(dir+'REPORT.md',md);console.log(JSON.stringify({rows:rows.length,battles:cache.size,faults,changed:files.filter(f=>before[f]!==after[f])}));
