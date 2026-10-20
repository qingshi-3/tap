/** Reproducible synthetic inventory benchmark; does not estimate player completion rates.
 * npm exec vite-node scripts/boss-bench.ts -- before|compare
 * Frozen historical modules are read only. No game/save files are changed.
 */
// Host-only benchmark imports; this browser project intentionally has no @types/node dependency.
// @ts-expect-error Node supplies this module when vite-node executes the benchmark.
import { mkdirSync, writeFileSync } from 'node:fs';
// @ts-expect-error Node supplies this module when vite-node executes the benchmark.
import { resolve } from 'node:path';
// @ts-expect-error Node supplies this module when vite-node executes the benchmark.
import { createHash } from 'node:crypto';
declare const process: { argv: string[]; cwd(): string };
import { simulate as oldSim } from '../../../../qibing-boss-encounters/before/core/engine';
import { chapter as oldChapter } from '../../../../qibing-boss-encounters/before/core/route';
import { unitDef } from '../../../../qibing-boss-encounters/before/core/data';
import { EQUIP_MAP } from '../../../../qibing-boss-encounters/before/core/content';
import { newRun, rollPoints, tierCap } from '../../../../qibing-boss-encounters/before/core/run';

const mode = process.argv.includes('compare') ? 'compare' : 'before';
const output = resolve(process.cwd(), '../../../qibing-boss-encounters/benchmark');
mkdirSync(output, { recursive: true });
const clone = <T>(x: T): T => structuredClone(x);
const mean = (xs: number[]) => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0;
const pct = (n: number) => `${(n*100).toFixed(1)}%`;
const profiles = [
  { id:'front-single', name:'正面单核', general:'hank', units:['n_bulwark','n_merc','n_envoy','n_breaker','n_marshal'], core:1, eq:'eq_combo' },
  { id:'front-dual', name:'正面双核', general:'vulkan', units:['m_hide','m_rex','m_mankator','m_vindicator','m_kujata'], core:1, eq:'eq_belt' },
  { id:'snipe', name:'狙击多段', general:'kaleos', units:['n_bulwark','s_ninja','s_backstab','s_master','s_dancer'], core:3, eq:'eq_bow' },
  { id:'spell', name:'法术单点', general:'lilithe', units:['a_matriarch','a_brood','a_cult','a_solus','a_engulf'], core:2, eq:'eq_tome' },
  { id:'burn', name:'灼烧', general:'vulkan', units:['m_hide','m_raptor','m_mender','m_bloodcaller','m_titan'], core:1, eq:'eq_flame' },
  { id:'sustain', name:'续航', general:'argeon', units:['l_knight','l_martyr','l_archon','l_mender','l_priest'], core:0, eq:'eq_belt' },
  { id:'control', name:'寒意控制', general:'faie', units:['v_keeper','v_wyvern','v_sentinel','v_mage','v_queen'], core:1, eq:'eq_frost' },
  { id:'spell-aoe', name:'法术群伤', general:'lilithe', units:['a_matriarch','a_brood','a_ritualist','a_solus','a_cult'], core:2, eq:'eq_tome' },
];
// Explicit first-chapter replacements: legendary recruitment is not yet open at battle index 6.
const early: Record<string,string> = { n_marshal:'n_thorn', m_mankator:'m_mender', m_vindicator:'m_raptor', s_master:'s_hunter', a_matriarch:'a_jugg', a_solus:'a_spine', l_archon:'l_shield', v_wyvern:'v_shard', v_queen:'v_wall', m_titan:'m_rex' };
const pointBudgets = [[10,15,18],[25,33,39],[43,51,60]];
const copyBudgets = [[6,8,10],[8,10,12],[10,12,14]];
const snapshots: any[] = [];
for (let ch=0; ch<3; ch++) for (const p of profiles) for (let budget=0;budget<3;budget++) for(let variant=0;variant<4;variant++) {
  const seed = 41000 + ch*1000 + profiles.indexOf(p)*100 + budget*10 + variant;
  const cap = tierCap(ch*7+6);
  const ids = p.units.map(id => unitDef(id).tier > cap ? early[id] : id);
  if(ids.some(id=>!id || unitDef(id).tier>cap)) throw Error(`Invalid quality ${p.id}`);
  const team:any[] = ids.map((defId,i)=>({defId,ownedId:i+1,copies:1,train:{},equips:[]}));
  let left=copyBudgets[ch][budget]-5;
  const order=[p.core,0, (p.core+1)%5,4,2,3,1].filter((x,i,a)=>a.indexOf(x)===i);
  for(const i of order) if(left){team[i].copies=2;left--;}
  // Later chapters allow at most two 3-star units, with exact paired-copy cost.
  if(ch>0) for(const i of order.slice(0,2)) if(left>=2){team[i].copies=4;left-=2;}
  const spentCopies=team.reduce((n,u)=>n+u.copies,0);
  // Use actual weighted point generator. Vary distribution without changing the sampled point inventory.
  const r = newRun(p.general,seed); r.slots=clone(team);
  const points=rollPoints(r,pointBudgets[ch][budget]); let genPower=0;
  points.forEach((kind,i)=>{
    let dst=kind==='hp'||kind==='block' ? (variant===1 ? i%2 : 0) : p.core;
    if(kind==='power') {
      const casters=team.map((u,j)=>unitDef(u.defId).cast?j:-1).filter(j=>j>=0);
      if(!casters.length || i%3===0){genPower++;return;}
      dst=casters[(i+variant)%casters.length];
    } else if(kind==='atk' && variant>=2) dst=order[(i+variant)%Math.min(3,order.length)];
    team[dst].train[kind]=(team[dst].train[kind]??0)+1;
  });
  const inventory=[p.eq,'eq_belt','eq_ice'].slice(0,budget+1);
  const equipSlots=[p.core,0,4,1,2,3].filter((x,i,a)=>a.indexOf(x)===i);
  inventory.forEach((id,i)=>team[equipSlots[i]].equips.push(id));
  const passives=ch===0?[]:ch===1?['g_wall','g_morale']:['g_wall','g_morale','g_revive'];
  const budgetName=['low','mid','high'][budget];
  const id=`c${ch+1}-${p.id}-${budgetName}-v${variant}`;
  const equipGold=inventory.reduce((n,e)=>n+EQUIP_MAP[e].price,0);
  if(equipGold>18+ch*24)throw Error('Equipment over conservative guaranteed normal-win gold budget');
  if(team.some(u=>u.equips.length>1))throw Error('Equipment slot cap exceeded');
  snapshots.push({id,ch,profile:p.id,profileName:p.name,budget:budgetName,variant,seed,player:team,general:{id:p.general,power:genPower,passives},resources:{points,pointCount:points.length,spentCopies,copyBudget:copyBudgets[ch][budget],equipGold,inventory,unspentCopyBudget:left,tierCap:cap,availableRecruitPicks:2*(ch*7+7)}});
}
writeFileSync(resolve(output,'matrix.json'),JSON.stringify({notice:'Synthetic feasible inventories, not sampled acquisition histories or player completion rates.',snapshots},null,2));

function boss(ch:number, chapter:any){return chapter(ch).stages.find((x:any)=>x.type==='boss').main;}
const oldBosses=[0,1,2].map(ch=>boss(ch,oldChapter));
function positionOnly(lineup:any[]){const get=(id:string)=>lineup.find(u=>u?.defId===id);return ['e_guardian','e_revenant','e_twin','e_nightk','e_lich'].map(get);}
function tacticPlayer(s:any,tactic:string){
  const player=clone(s.player);
  if(tactic==='swap-front-tail') [player[0],player[4]]=[player[4],player[0]];
  if(tactic==='move-same-equipment') {
    const src=player.findIndex((u:any)=>u.equips.length); const dst=(src+1)%5;
    if(src>=0 && !player[dst].equips.length) player[dst].equips.push(player[src].equips.shift());
    else if(src>=0){const eq=player[src].equips;player[src].equips=player[dst].equips;player[dst].equips=eq;}
  }
  return player;
}
function measure(out:any){
  let beat=0,recallBeat:null|number=null,recallCount=0,recallTrigger=false,emptyRecall=false;
  let fatigue=0,damage=0,enemyFatigue=0,enemyDamage=0,firstHalfBeat:null|number=null;
  const rules:Record<string,number>={};const errors:string[]=[];
  let previous=new Map<number,any>(out.initial.map((u:any)=>[u.uid,u]));
  for(const {ev,snap} of out.log){
    if(ev.t==='beat')beat=ev.n;
    if(ev.t==='dmg'){
      const u=previous.get(ev.tgt);const actual=u?Math.min(Math.max(0,u.hp),Math.max(0,ev.n)):0;
      damage+=actual;if(ev.kind==='fatigue')fatigue+=actual;
      if(u?.side===1){enemyDamage+=actual;if(ev.kind==='fatigue')enemyFatigue+=actual;}
    }
    const king=snap.find((u:any)=>u.defId==='e_nightk' && u.side===1);
    if(firstHalfBeat===null && king?.alive && king.hp>0 && king.hp*2<king.maxHp)firstHalfBeat=beat;
    if(ev.t==='recall'){recallCount++;recallBeat??=beat;}
    if(ev.t==='trigger' && ev.kind==='boss' && snap.find((u:any)=>u.uid===ev.src)?.defId==='e_nightk')recallTrigger=true;
    if(ev.t==='rule'){rules[ev.id]=(rules[ev.id]??0)+1;if(String(ev.id).includes('night'))recallTrigger=true;}
    if(ev.t==='fizzle')errors.push(`fizzle:${ev.reason}`);
    previous=new Map(snap.map((u:any)=>[u.uid,u]));
  }
  emptyRecall=recallTrigger && recallCount===0;
  return {result:out.result,beats:out.beats,recallCount,recallBeat,firstHalfBeat,recallTrigger,emptyRecall,fatigueDamage:fatigue,totalActualDamage:damage,fatigueShare:damage?fatigue/damage:0,enemyFatigueShare:enemyDamage?enemyFatigue/enemyDamage:0,rules,errors,eventCount:out.log.length};
}
const variants:any[]=[{id:'before',simulate:oldSim,bosses:oldBosses}];
const equivalence:any[]=[];
if(mode==='compare'){
  const current=await import('../src/core/engine');const route=await import('../src/core/route');
  const clean=(out:any)=>({...out,log:out.log.filter(({ev}:any)=>ev.t!=='rule')});
  const digest=(out:any)=>createHash('sha256').update(JSON.stringify(clean(out))).digest('hex');
  for(const s of snapshots){
    const setup={player:clone(s.player),enemy:clone(oldBosses[s.ch].lineup),general:clone(s.general),seed:s.seed,record:true};
    const a=oldSim(setup),b=current.simulate(clone(setup));
    const oldHash=digest(a),newHash=digest(b);
    equivalence.push({snapshot:s.id,exact:oldHash===newHash,oldHash,newHash,resultSame:a.result===b.result,beatsSame:a.beats===b.beats});
  }
  variants.push({id:'new',simulate:current.simulate,bosses:[0,1,2].map(ch=>boss(ch,route.chapter))});
  variants.push({id:'position-only',simulate:oldSim,bosses:oldBosses.map((b,ch)=>ch===2?{...b,lineup:positionOnly(b.lineup)}:b)});
}
const rows:any[]=[];
for(const version of variants)for(const s of snapshots){
  if(version.id==='position-only' && s.ch!==2)continue;
  for(const tactic of ['baseline','swap-front-tail','move-same-equipment']){
    const b=version.bosses[s.ch];
    try{
      const setup={player:tacticPlayer(s,tactic),enemy:clone(b.lineup),general:clone(s.general),seed:s.seed,record:true,...(version.id==='new'?{rules:b.rules}:{} )};
      const out=version.simulate(setup);
      rows.push({version:version.id,snapshot:s.id,ch:s.ch,profile:s.profile,budget:s.budget,tactic,...measure(out)});
    }catch(e){rows.push({version:version.id,snapshot:s.id,ch:s.ch,profile:s.profile,budget:s.budget,tactic,error:String(e)});}
  }
}
function summary(rs:any[]){
  const good=rs.filter(r=>!r.error);
  return {n:rs.length,errors:rs.filter(r=>r.error).length,fizzles:good.reduce((n,r)=>n+r.errors.length,0),wins:good.filter(r=>r.result==='win').length,winRate:mean(good.map(r=>+(r.result==='win'))),meanBeats:mean(good.map(r=>r.beats)),meanRecall:mean(good.map(r=>r.recallCount)),recallTriggered:good.filter(r=>r.recallTrigger).length,emptyRecall:good.filter(r=>r.emptyRecall).length,meanRecallBeat:mean(good.filter(r=>r.recallBeat!==null).map(r=>r.recallBeat)),meanFatigueShare:mean(good.map(r=>r.fatigueShare)),meanEnemyFatigueShare:mean(good.map(r=>r.enemyFatigueShare)),rules:good.reduce((a,r)=>{for(const [id,n]of Object.entries(r.rules))a[id]=(a[id]??0)+(n as number);return a;},{})};
}
const groups:any[]=[];
for(const version of variants)for(let ch=0;ch<3;ch++)for(const budget of ['low','mid','high']){
 const rs=rows.filter(r=>r.version===version.id&&r.ch===ch&&r.budget===budget&&r.tactic==='baseline');
 if(rs.length)groups.push({version:version.id,ch,budget,...summary(rs)});
}
const pairs:any[]=[];
for(const v of variants.filter(v=>v.id!=='before'))for(const s of snapshots){
 const a=rows.find(r=>r.version==='before'&&r.snapshot===s.id&&r.tactic==='baseline');
 const b=rows.find(r=>r.version===v.id&&r.snapshot===s.id&&r.tactic==='baseline');if(!a||!b||a.error||b.error)continue;
 pairs.push({version:v.id,snapshot:s.id,ch:s.ch,budget:s.budget,profile:s.profile,before:a.result,after:b.result,beatDelta:b.beats-a.beats,recallDelta:b.recallCount-a.recallCount});
}
const tactics:any[]=[];
for(const version of variants)for(let ch=0;ch<3;ch++){
 const base=rows.filter(r=>r.version===version.id&&r.ch===ch&&r.tactic==='baseline');if(!base.length)continue;
 for(const tactic of ['swap-front-tail','move-same-equipment']){
 const ps=base.map(a=>({a,b:rows.find(b=>b.version===a.version&&b.snapshot===a.snapshot&&b.tactic===tactic)})).filter(p=>p.b&&!p.a.error&&!p.b.error);
 tactics.push({version:version.id,ch,tactic,n:ps.length,rescued:ps.filter(({a,b})=>a.result!=='win'&&b.result==='win').length,lost:ps.filter(({a,b})=>a.result==='win'&&b.result!=='win').length,meanBeatDelta:mean(ps.map(({a,b})=>b.beats-a.beats))});
 }
}
const result={mode,generatedAt:new Date().toISOString(),notice:'Synthetic benchmark win fractions are not player completion rates. No acquisition probability / real-run survival estimate.',summary:summary(rows),groups,pairs,tactics,equivalence,rows};
writeFileSync(resolve(output,`${mode}.json`),JSON.stringify(result,null,2));
const lines=[`# Boss 强度配对基准（${mode}）`,'','这些是合成库存的样本胜率，不代表真实玩家通关率。固定独立库存种子；不通过重复确定性战斗扩充样本。','',`${snapshots.length}份库存，每版本每Boss每预算${profiles.length*4}份；每份再做原位、首尾互换、同件装备换持有者三种配置。总战斗 ${rows.length}。`,'','## 资源边界','','- 首Boss战斗index6仅tier1–3；后期开放tier4。仅本阵营+中立，未模拟招募随机可得性。','- 首章1/2星；后期至多2名三星；精确份数见matrix.json，低/中/高份数预算6–14，未花完的预算不强塞资源。','- 培养点上限按每胜3点、首Boss前6胜推算18/39/60；低预算保留部分未投入。点种类通过旧版rollPoints实际权重抽样，分配用于前排、核心、施法者或主将。','- 装备1/2/3件，金币成本不超过保守正常关卡胜利金币18/42/66；每人最多1件。无一次性法术、无广告资源、无精英额外奖励。','- 第二/三Boss按实际升阶次数带2/3个固定通用被动。被动、具体招募和装备来源均未复现实际抽选，故仅验证“可行资源边界”，不证明这类库存常见。','- 招募份数未超过可领招募次数；未推演此前生存、商店出货概率、四阵营开局抽选或完整run策略。','- 4个变体改变培养类型抽样和分配。各流派使用固定推荐核心，不为获得目标胜率调换样本。','- 同库存对策只换位/转移已拥有装备，不增加培养、星级、装备或法术。','- 疲劳占比按每次扣血前剩余生命截断过量伤害，分母含双方实际扣血；另记录敌方单独占比。','', '|版本|章|预算|胜场/样本|均拍|均召回数|触发/空召回|召回均拍|疲劳占比|敌方疲劳占比|错误|','|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|'];
for(const g of groups)lines.push(`|${g.version}|${g.ch+1}|${g.budget}|${g.wins}/${g.n}|${g.meanBeats.toFixed(1)}|${g.meanRecall.toFixed(2)}|${g.recallTriggered}/${g.emptyRecall}|${g.meanRecallBeat.toFixed(1)}|${pct(g.meanFatigueShare)}|${pct(g.meanEnemyFatigueShare)}|${g.errors}|`);
lines.push('','## 同库存对策','','|版本|章|对策|样本|败转胜|胜转败|均拍变化|','|---|---:|---|---:|---:|---:|---:|');
for(const t of tactics)lines.push(`|${t.version}|${t.ch+1}|${t.tactic}|${t.n}|${t.rescued}|${t.lost}|${t.meanBeatDelta.toFixed(1)}|`);
lines.push('','## 按流派的原位结果','','|版本|章|流派|胜场/样本|均拍|','|---|---:|---|---:|---:|');
for(const v of variants)for(let ch=0;ch<3;ch++)for(const p of profiles){const a=rows.filter(r=>r.version===v.id&&r.ch===ch&&r.profile===p.id&&r.tactic==='baseline');if(a.length){const s=summary(a);lines.push(`|${v.id}|${ch+1}|${p.name}|${s.wins}/${s.n}|${s.meanBeats.toFixed(1)}|`);}}
lines.push('','## 固有机制等价','',''+(equivalence.length?`相同旧敌阵、不传新增rules的${equivalence.length}份库存，剔除rule事件后全输出逐字哈希一致${equivalence.filter(e=>e.exact).length}份；胜负一致${equivalence.filter(e=>e.resultSame).length}份；拍数一致${equivalence.filter(e=>e.beatsSame).length}份。`:'before阶段未运行新版。'),'','## 可复现文件','','`matrix.json` 保存完整库存、培养、装备和种子；对应模式JSON保留每场结果、规则触发次数、召回时间、疲劳与异常。未保存逐事件全日志，以控制体积；按相同快照与种子可重现。', '',`异常场次 ${rows.filter(r=>r.error).length}，fizzle事件 ${result.summary.fizzles}。规则触发总计：${JSON.stringify(result.summary.rules)}。`);
writeFileSync(resolve(output,`${mode}.md`),lines.join('\n'));
console.log(JSON.stringify({mode,output,total:rows.length,summary:result.summary,groups,tactics},null,2));
