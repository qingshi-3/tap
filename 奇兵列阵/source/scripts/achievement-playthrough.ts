/** Legal player-action expedition evidence. Run with: npx vite-node scripts/achievement-playthrough.ts
 * SEEDS=24 (count) or SEEDS=1000,8919 (explicit seeds); START=0 (seed index offset); POLICY=all or comma-separated strategy names
 * OUT_DIR defaults to workspace output/qibing-v014-career/validation. No production storage/files are read or written.
 */
// @ts-expect-error Node host module; the browser project does not install @types/node.
import { mkdirSync, writeFileSync } from 'node:fs';
// @ts-expect-error Node host module; supplied by vite-node.
import { resolve, join } from 'node:path';
// @ts-expect-error Node host module; supplied by vite-node.
import { createHash } from 'node:crypto';
declare const process: { env: Record<string,string|undefined>; cwd():string; exitCode?:number };
import { GENERALS, unitDef } from '../src/core/data';
import { EQUIP_MAP, PASSIVE_MAP } from '../src/core/content';
import { simulate, levelStats } from '../src/core/engine';
import { allOwned, allocPoint, beginBattle, buildBattle, buy, choosePromo, chooseReward, cloneRun,
 currentNode, equip, equipCap, finishBattle, generalChoices, getOwned, leaveShop, moveSlot, newRun,
 shopUnitBuysRemaining, orderOptions, pickFork, placeKind, reroll, screen, sell, takeDraft, useOrder, useSpell, type RunState } from '../src/core/run';
import { loadCareer, recordOfficialBattle, stageRunReplacement } from '../src/core/career';
import { saveRun } from '../src/core/save';
import { ACHIEVEMENTS, getAchievementProgress } from '../src/core/achievements';
import { levelFromCopies, type Slotted, type UnitDef } from '../src/core/types';

class IsolatedStorage implements Storage {
 private readonly entries = new Map<string,string>();
 get length() { return this.entries.size; }
 clear() { throw new Error('Harness may not clear progression'); }
 getItem(key:string) { return this.entries.get(key) ?? null; }
 key(index:number) { return [...this.entries.keys()][index] ?? null; }
 removeItem(key:string) { this.entries.delete(key); }
 setItem(key:string,value:string) { this.entries.set(key,value); }
}
// Installed before the first career/save call. Only production save/career modules invoke setItem.
Object.defineProperty(globalThis,'localStorage',{value:new IsolatedStorage(),configurable:true});
const POLICIES = ['balanced','burn','frost','spell','defense','summon','strike','neutral','growth','economy','small','healing','splash','vuln','opening','summon-focused','single-hit'] as const;
type Policy = typeof POLICIES[number];
const requested = process.env.POLICY ?? 'all';
const policies = requested === 'all' ? POLICIES : requested.split(',') as Policy[];
if(policies.some(p => !POLICIES.includes(p))) throw new Error(`Unknown POLICY: ${requested}`);
const rawSeeds = process.env.SEEDS ?? '24';
const count = Number(rawSeeds);
const start = Number(process.env.START ?? '0');
if(!Number.isSafeInteger(start)||start<0)throw new Error('START must be a nonnegative integer seed index');
const seeds = rawSeeds.includes(',') ? rawSeeds.split(',').map(Number) : Array.from({length:count},(_,i)=>1000+(start+i)*7919);
if(!seeds.length || seeds.length > 10000 || seeds.some(s=>!Number.isSafeInteger(s)) || (!rawSeeds.includes(',') && (!Number.isInteger(count) || count<1))) throw new Error('SEEDS must be a positive count <=10000 or explicit comma-separated integer seeds');
const outputDir = resolve(process.env.OUT_DIR ?? resolve(process.cwd(),'../../../qibing-v014-career/validation'));
mkdirSync(join(outputDir,'traces'),{recursive:true});
const write = (file:string,value:unknown) => writeFileSync(join(outputDir,file),JSON.stringify(value,null,2),'utf8');
const sourceHash = createHash('sha256').update(ACHIEVEMENTS.map(a=>`${a.id}:${a.target}:${a.description}`).join('\n')).digest('hex');
const owned = (r:RunState) => allOwned(r).map((u,i)=>({u,i})).filter((x):x is {u:Slotted;i:number}=>!!x.u);
const star = (u:Slotted) => levelFromCopies(u.copies);
const tri = (v:readonly number[]|undefined,l:number) => v?.[l-1] ?? 0;
const deathSummoner = (d:UnitDef) => (d.onRattle ?? []).some(e=>e.op==='summon');
const healingUnit = (d:UnitDef) => [...(d.cast??[]),...(d.onHurt??[]),...(d.afterAttack??[])].some(e=>e.op==='heal');
const growingAttacker = (d:UnitDef) => d.special==='monk'||[...(d.onHurt??[]),...(d.afterAttack??[])].some(e=>e.op==='buff'&&e.to==='self');
const healQuality = (d:UnitDef) => (d.cast??[]).filter(e=>e.op==='heal').reduce((n,e)=>n+(e.to==='allies'?20:e.to==='adjacent'?12:5),0);
const splashUnit = (d:UnitDef) => !!d.traits?.splash || (d.onStart??[]).some(e=>e.op==='grant'&&e.grant==='splash');
function affinity(d:UnitDef,p:Policy) {
 const effects = [...(d.cast ?? []),...(d.onStart ?? []),...(d.onRattle ?? []),...(d.onHurt ?? []),...(d.afterAttack ?? [])];
 const has = (op:string) => effects.some(e=>e.op===op);
 const text = [d.text,...(d.tags ?? [])].join(' ');
 switch(p) {
  case 'burn': return has('burn') || text.includes('灼烧') ? 12 : 0;
  case 'frost': return has('chill') || text.includes('寒意') ? 12 : 0;
  case 'spell': return d.cast ? 12 : 0;
  case 'defense': return (d.traits?.taunt?7:0)+(d.traits?.armor?6:0)+(has('block')?5:0)+(d.traits?.thorns?5:0)+(has('heal')?4:0);
  case 'summon': return (has('summon')?10:0)+(has('sacrifice')?10:0)+(d.traits?.reborn?6:0);
  case 'strike': return (d.traits?.splash?8:0)+(d.traits?.combo?7:0)+(has('extraAct')?8:0)+(has('vuln')?5:0);
  case 'neutral': return d.faction==='neutral'?13:0;
  case 'small': return d.tier*2;
  case 'healing': return (healingUnit(d)?18:0)+healQuality(d)+(d.traits?.reborn?9:0)+(d.hp>=8?6:0);
  case 'splash': return (splashUnit(d)?24:0)+(d.traits?.combo?9:0)+(has('extraAct')?8:0)+(has('heal')?5:0);
  case 'vuln': return (has('vuln')?18:0)+(d.traits?.combo?18:0)+(has('extraAct')?9:0)+(has('heal')?8:0)+(d.traits?.armor?5:0);
  case 'opening': return (d.onStart??[]).reduce((n,e)=>n+(e.op==='dmg'?25:e.op==='buff'?12:e.op==='grant'&&['splash','combo','snipe'].includes(e.grant??'')?14:0),0)+(d.traits?.splash?12:0);
  case 'summon-focused': return deathSummoner(d)?32:has('heal')?8:d.cast?0:4;
  case 'single-hit': return (growingAttacker(d)?28:0)+(has('vuln')?12:0)+(d.onStart??[]).reduce((n,e)=>n+(e.op==='buff'?9:0),0)+(d.cast?-10:d.traits?.combo?-5:6)+(has('heal')?5:0);
  default:return 0;
 }
}
function worth(d:UnitDef,level:number,p:Policy) {
 const s=levelStats(d.id,level);
 return s.atk*1.7+s.hp*.65+d.tier*2+(d.cast?3:0)+tri(d.traits?.armor,level)*4+tri(d.traits?.power,level)*2+affinity(d,p);
}
function ownedValue(u:Slotted,p:Policy) { return worth(unitDef(u.defId),star(u),p)+(u.train?.atk??0)*1.7+(u.train?.hp??0)*1.3+(u.train?.power??0)*3+(u.train?.block??0)*2+(u.equips?.length??0)*3; }
function draftScore(r:RunState,id:string,p:Policy) {
 const d=unitDef(id), same=owned(r).filter(x=>x.u.defId===id);
 if(p==='summon-focused'&&deathSummoner(d))return worth(d,1,p)+(same.length?3:14);
 return worth(d,1,p)+(same.some(x=>x.u.copies===1)?18:0)+(same.some(x=>x.u.copies===2)?8:0);
}
function tank(u:Slotted) {
 const d=unitDef(u.defId),l=star(u),s=levelStats(d.id,l);
 return s.hp+tri(d.traits?.armor,l)*5+tri(d.traits?.thorns,l)*2+(d.traits?.reborn?5:0)+(d.onHurt?3:0)-(d.cast?9:0)-(d.traits?.snipe?5:0);
}
interface Action { index:number; chapter:number; node:number; screen:string; api:string; args:unknown[]; result:unknown; detail?:unknown }
interface Witness { seed:number; general:string; policy:Policy; run:number; trace:string; actionIndex:number; battleIndex:number|null; current:number; target:number; scope:string }
const first = new Map<string,Witness>();
const summaries:unknown[]=[];
let previous:RunState|null=null;
for(let runIndex=0;runIndex<seeds.length;runIndex++) {
 const seed=seeds[runIndex],policy=policies[(start+runIndex)%policies.length], choices=generalChoices(seed);
 const preferred:Partial<Record<Policy,string[]>>={burn:['vulkan'],frost:['faie'],spell:['lilithe'],defense:['argeon'],summon:['lilithe'],strike:['hank'],neutral:['hank'],healing:['argeon','lilithe'],splash:['hank','zirix'],vuln:['zirix','argeon'],opening:['hank','zirix'],'summon-focused':['lilithe','argeon'],'single-hit':['hank','zirix']};
 const general=(preferred[policy]??[]).find(g=>choices.includes(g))??choices[runIndex%choices.length];
 const r=newRun(general,seed),actions:Action[]=[],battles:unknown[]=[];
 let focusOwnedId:number|null=null;
 const traceFile=`traces/run-${String(runIndex+1).padStart(5,'0')}-${seed}-${policy}.json`;
 const act=<T>(api:string,args:unknown[],fn:()=>T,detail?:unknown):T=>{
  const context={chapter:r.chapter,node:r.node,screen:screen(r)};
  const result=fn();actions.push({index:actions.length,...context,api,args,result,detail});
  if(result===false || result==='invalid' || result==='confirm') throw new Error(`${api} was rejected at seed ${seed}: ${JSON.stringify(args)}`);
  return result;
 };
 const persist=()=>{if(!saveRun(r))throw new Error(`Isolated formal save failed seed ${seed}`);};
 const capture=(battleIndex:number|null)=>{
  for(const a of getAchievementProgress(loadCareer()))if(a.completed&&!first.has(a.id))first.set(a.id,{seed,general,policy,run:runIndex+1,trace:traceFile,actionIndex:actions.length-1,battleIndex,current:a.current,target:a.target,scope:a.category==='主将'||a.id.startsWith('streak_')?'cumulative legal run prefix; see earlier run traces':'this formal victorious battle or its expedition result'});
 };
 stageRunReplacement(previous,r);persist();
 actions.push({index:0,chapter:r.chapter,node:r.node,screen:screen(r),api:'newRun',args:[general,seed],result:true,detail:{generalChoices:choices,previousRun:previous?.runId??null}});
 const merge=()=>{
  for(let pass=0;pass<8;pass++){
   const us=owned(r);let done=false;
   for(let a=0;a<us.length&&!done;a++)for(let b=a+1;b<us.length&&!done;b++){
    const x=us[a],y=us[b];
    if(policy==='summon-focused'&&deathSummoner(unitDef(x.u.defId))&&us.filter(z=>deathSummoner(unitDef(z.u.defId))).length<=4)continue;
    if(x.u.defId===y.u.defId&&x.u.copies===y.u.copies&&x.u.copies<4){act('moveSlot',[x.i,y.i,'auto'],()=>moveSlot(r,x.i,y.i,'auto'));done=true;}
   }
   if(!done)break;
  }
 };
 const arrange=()=>{
  const us=owned(r),ranked=[...us].sort((a,b)=>ownedValue(b.u,policy)-ownedValue(a.u,policy));
  let top=ranked.slice(0,policy==='small'?4:5);
  if(policy==='single-hit'&&focusOwnedId!==null){const focus=us.find(x=>x.u.ownedId===focusOwnedId);if(focus&&!top.includes(focus))top=[focus,...top.slice(0,4)];}
  if(policy==='summon-focused'){
   const summons=ranked.filter(x=>deathSummoner(unitDef(x.u.defId))).slice(0,4);
   const support=ranked.filter(x=>!summons.includes(x));top=[...summons,...support].slice(0,5);
  }
  if(policy==='healing'){
   const healers=ranked.filter(x=>healingUnit(unitDef(x.u.defId))).slice(0,2);
   top=[...healers,...ranked.filter(x=>!healers.includes(x))].slice(0,5);
  }
  const order=top.sort((a,b)=>policy==='summon-focused'?(Number(deathSummoner(unitDef(b.u.defId)))-Number(deathSummoner(unitDef(a.u.defId))))||tank(a.u)-tank(b.u):tank(b.u)-tank(a.u)).map(x=>x.u.ownedId);
  for(let to=0;to<order.length;to++){
   const from=owned(r).find(x=>x.u.ownedId===order[to])!.i;
   if(from!==to)act('moveSlot',[from,to,'swap'],()=>moveSlot(r,from,to,'swap'));
  }
  if(policy==='small')for(const x of owned(r).filter(x=>x.i>=4))act('sell',[x.i],()=>sell(r,x.i),{unit:structuredClone(x.u)});
 };
 const take=()=>{
  if(r.orders.length){
   const options=orderOptions(r,r.orders[0]);
   if(options.length){const tags:Partial<Record<Policy,string>>={burn:'灼烧',frost:'寒意',spell:'施法',defense:'护甲',summon:'召唤',strike:'立即攻击',neutral:'neutral',healing:'治疗',splash:'溅射',vuln:'易伤',opening:'连击','summon-focused':'召唤','single-hit':'易伤'};
    const opt=options.includes(tags[policy]??'')?tags[policy]!:options[0];act('useOrder',[0,opt],()=>useOrder(r,0,opt));}
  }
  let candidates=r.draft.map((id,i)=>({id,i,score:draftScore(r,id,policy)})).sort((a,b)=>b.score-a.score);
  if(r.rerolls>0&&r.picks>0&&candidates[0]&&affinity(unitDef(candidates[0].id),policy)===0&&policy!=='balanced'&&policy!=='growth'&&policy!=='economy'&&owned(r).length>=3){
   act('reroll',[],()=>reroll(r),{offered:[...r.draft]});candidates=r.draft.map((id,i)=>({id,i,score:draftScore(r,id,policy)})).sort((a,b)=>b.score-a.score);
  }
  const best=candidates[0];if(!best)throw new Error('No draft candidate while picks remain');
  const us=owned(r);const preserveSummon=policy==='summon-focused'&&deathSummoner(unitDef(best.id))&&us.filter(x=>deathSummoner(unitDef(x.u.defId))).length<=4&&us.length<8;
  const same=preserveSummon?undefined:us.find(x=>x.u.defId===best.id&&x.u.copies===1);
  const empty=Array.from({length:8},(_,i)=>i).find(i=>!getOwned(r,i));
  const weakest=[...us].filter(x=>placeKind(r,best.id,x.i)!=='invalid').sort((a,b)=>ownedValue(a.u,policy)-ownedValue(b.u,policy))[0];
  let target=same?.i??empty??weakest?.i;
  if(target===undefined){const release=[...us].sort((a,b)=>ownedValue(a.u,policy)-ownedValue(b.u,policy))[0];act('sell',[release.i],()=>sell(r,release.i),{reason:'free an actually legal recruitment slot'});target=release.i;}
  const destination=target;
  act('takeDraft',[best.i,destination,true],()=>takeDraft(r,best.i,destination,true),{offered:[...r.draft],chosen:best.id,previousTarget:structuredClone(getOwned(r,destination))});merge();
 };
 const train=()=>{
  const field=owned(r).filter(x=>x.i<5);if(!field.length)throw new Error('Empty lineup');
  const attack=(x:{u:Slotted;i:number})=>{
   const d=unitDef(x.u.defId);return levelStats(d.id,star(x.u)).atk+(x.u.train?.atk??0)+(d.cast?-12:0)+(policy==='single-hit'&&d.traits?.combo?-8:0)+(policy==='splash'&&splashUnit(d)?18:0)+(policy==='summon-focused'&&deathSummoner(d)?-25:0)+(policy==='single-hit'&&growingAttacker(d)?35:0);
  };
  const currentFocus=policy==='single-hit'?field.find(x=>x.u.ownedId===focusOwnedId):undefined;
  const grower=policy==='single-hit'?field.filter(x=>growingAttacker(unitDef(x.u.defId))).sort((a,b)=>attack(b)-attack(a))[0]:undefined;
  const focused=currentFocus&&(!grower||growingAttacker(unitDef(currentFocus.u.defId)))?currentFocus:grower;
  const carry=focused?.i??[...field].sort((a,b)=>attack(b)-attack(a))[0].i;
  if(policy==='single-hit')focusOwnedId=getOwned(r,carry)!.ownedId;
  const healingCaster=[...field].filter(x=>healingUnit(unitDef(x.u.defId))).sort((a,b)=>healQuality(unitDef(b.u.defId))-healQuality(unitDef(a.u.defId)))[0]?.i;
  const caster=field.find(x=>!!unitDef(x.u.defId).cast)?.i;
  for(const type of Object.keys(r.stash))while(r.stash[type]>0){
   const areaHealer=healingCaster!==undefined&&healQuality(unitDef(getOwned(r,healingCaster)!.defId))>=12;
   const healingGeneral=general==='argeon'&&r.passives.includes('argeon_1');
   const generalPower=policy==='healing'?healingGeneral||!areaHealer:['growth','burn','frost','vuln','single-hit','splash','opening'].includes(policy);
   const shieldTarget=policy==='summon-focused'?carry:policy==='healing'?owned(r).find(x=>x.i>=5)?.i??field[field.length-1].i:0;
   const hpTarget=policy==='single-hit'?carry:policy==='healing'?field[(r.stash[type]+runIndex)%field.length].i:shieldTarget;
   const to=type==='power'?(generalPower?'general':policy==='healing'?healingCaster??'general':caster??'general'):type==='hp'?hpTarget:type==='block'?shieldTarget:carry;
   act('allocPoint',[to,type],()=>allocPoint(r,to,type));
  }
  let guard=0;
  while(r.bag.length&&guard++<16){
   const usableBag=r.bag.findIndex(id=>!(policy==='single-hit'&&id==='eq_combo')&&!(policy==='healing'&&['eq_guard','eq_ice'].includes(id))&&!(policy==='summon-focused'&&id==='eq_halo'));
   if(usableBag<0)break;
   const id=r.bag[usableBag],def=EQUIP_MAP[id];
   const targets=[...field].sort((a,b)=>{
    const score=(x:{u:Slotted;i:number})=>{
     if((x.u.equips?.length??0)>=equipCap(r))return -100;
     if(id==='eq_tome')return x.i===(policy==='healing'?healingCaster:caster)?25:0;
     if(id==='eq_combo')return policy==='single-hit'?x.i===carry?-20:8:policy==='splash'?splashUnit(unitDef(x.u.defId))?30:0:policy==='vuln'&&!unitDef(x.u.defId).cast?24:0;
     if(['eq_guard','eq_ice','eq_thorn'].includes(id))return x.i===(policy==='summon-focused'?carry:0)?18:0;
     if(id==='eq_belt'&&policy==='healing')return x.i===healingCaster?22:10;
     return x.i===carry?15:0;
    };
    return score(b)-score(a);
   });
   const target=targets.find(x=>(getOwned(r,x.i)?.equips?.length??0)<equipCap(r));if(!target)break;
   act('equip',[usableBag,target.i],()=>equip(r,usableBag,target.i),{equipment:id,name:def.name});
  }
  if(policy!=='economy')for(let i=r.spells.length-1;i>=0;i--)if(!r.activeSpells.includes(r.spells[i])&&!(policy==='summon-focused'&&r.spells[i]==='sp_revive')&&!(policy==='healing'&&r.spells[i]==='sp_firerain'))act('useSpell',[i],()=>useSpell(r,i));
 };
 let termination='unfinished',error:string|null=null,drawStreak=0,lastDrawKey='';
 try {
  for(let step=0;step<1000&&!r.over;step++){
   const sc=screen(r);
   if(sc==='promo'){
    const score=(id:string)=>{
     const special:Partial<Record<Policy,Record<string,number>>>={
      healing:{argeon_1:40,argeon_4:38,g_surge:30,g_core:24,g_reserve:23,g_dual:22},
      splash:{g_chain:38,g_first:32,hank_3:36,hank_1:30,g_dual:28,zirix_1:26},
      vuln:{zirix_1:40,zirix_2:36,zirix_4:34,zirix_3:30,g_chain:28,g_surge:25,g_core:23},
      opening:{g_first:100,g_breach:40,g_weak:35,g_elite:30,g_dual:25},
      'summon-focused':{g_martyr:40,g_reserve:32,g_elite:29,g_dual:20},
      'single-hit':{hank_1:45,hank_3:42,g_first:36,g_weak:34,g_breach:30,zirix_1:28,g_dual:27},
     };
     return special[policy]?.[id]??(id==='g_dual'?18:id.startsWith(general+'_')?12:id==='g_drill'?10:id==='g_first'?9:policy==='spell'&&id==='g_surge'?20:5);
    };
    const i=r.promo!.map((id,i)=>({id,i})).sort((a,b)=>score(b.id)-score(a.id))[0].i;
    act('choosePromo',[i],()=>choosePromo(r,i),{offered:r.promo!.map(id=>({id,name:PASSIVE_MAP[id].name}))});continue;
   }
   if(sc==='reward'){
    const choices=r.reward!;const score=(id:string)=>{
     if(policy==='healing')return id==='eq_tome'?35:id==='eq_belt'?30:['eq_guard','eq_ice'].includes(id)?15:5;
     if(policy==='splash'||policy==='vuln')return id==='eq_combo'?35:id==='eq_banner'?28:id==='eq_belt'?20:5;
     if(policy==='single-hit'||policy==='opening')return id==='eq_banner'?35:id==='eq_hammer'?30:id==='eq_bow'?25:id==='eq_combo'?-20:5;
     return policy==='burn'&&id==='eq_flame'?20:policy==='frost'&&id==='eq_frost'?20:policy==='spell'&&id==='eq_tome'?20:policy==='defense'&&['eq_guard','eq_ice','eq_thorn'].includes(id)?20:5;
    };
    const i=choices.map((id,i)=>({id,i})).sort((a,b)=>score(b.id)-score(a.id))[0].i;act('chooseReward',[i],()=>chooseReward(r,i),{offered:[...choices]});continue;
   }
   if(sc==='shop'){
    const s=r.shop!;
    for(const x of s.units.map((x,i)=>({...x,i})).sort((a,b)=>draftScore(r,b.id,policy)-draftScore(r,a.id,policy)))
     if(shopUnitBuysRemaining(r)>0&&!x.sold&&r.gold>=x.price&&(owned(r).length<8||owned(r).some(y=>y.u.defId===x.id&&y.u.copies===1))&&(policy!=='economy'||owned(r).some(y=>y.u.defId===x.id))) {act('buy',['units',x.i],()=>buy(r,'units',x.i),{item:x});merge();}
    if(policy!=='economy'){
     if(s.pack&&!s.pack.sold&&r.gold>=s.pack.price)act('buy',['pack'],()=>buy(r,'pack'));
     const equipmentPreference=(id:string)=>policy==='healing'&&['eq_guard','eq_ice'].includes(id)?-20:policy==='healing'&&['eq_tome','eq_belt'].includes(id)?30:['splash','vuln'].includes(policy)&&id==='eq_combo'?30:['single-hit','opening'].includes(policy)&&['eq_banner','eq_hammer','eq_bow'].includes(id)?30:policy==='single-hit'&&id==='eq_combo'?-20:5;
     for(const i of s.equips.map((_,i)=>i).sort((a,b)=>equipmentPreference(s.equips[b].id)-equipmentPreference(s.equips[a].id)))if(equipmentPreference(s.equips[i].id)>=0&&!s.equips[i].sold&&r.gold>=s.equips[i].price&&r.bag.length+owned(r).reduce((n,x)=>n+(x.u.equips?.length??0),0)<5*equipCap(r))act('buy',['equips',i],()=>buy(r,'equips',i),{item:s.equips[i]});
     for(let i=0;i<s.spells.length;i++)if(!s.spells[i].sold&&r.gold>=s.spells[i].price+3)act('buy',['spells',i],()=>buy(r,'spells',i),{item:s.spells[i]});
     if(s.order&&!s.order.sold&&r.gold>=s.order.price+3)act('buy',['order'],()=>buy(r,'order'));
    }
    act('leaveShop',[],()=>leaveShop(r));continue;
   }
   if(sc==='fork'){const choice=r.lives>=2&&policy!=='small'?'elite':'normal';act('pickFork',[choice],()=>pickFork(r,choice));continue;}
   while(r.picks>0)take();merge();arrange();train();persist();
   if(drawStreak>0){
    // A real boss draw leaves the player in prep. Try a different visible formation, never rewrite the result.
    const candidates=owned(r).sort((a,b)=>ownedValue(b.u,policy)-ownedValue(a.u,policy));
    const offset=Math.floor(drawStreak/5)%candidates.length;
    const chosen=[...candidates.slice(offset),...candidates.slice(0,offset)].slice(0,Math.min(policy==='small'?4:5,candidates.length));
    const rotate=drawStreak%chosen.length;
    const order=[...chosen.slice(rotate),...chosen.slice(0,rotate)].map(x=>x.u.ownedId);
    for(let to=0;to<order.length;to++){const from=owned(r).find(x=>x.u.ownedId===order[to])!.i;if(from!==to)act('moveSlot',[from,to,'swap'],()=>moveSlot(r,from,to,'swap'),{reason:'after an actual boss draw, player tries another formation'});}
    persist();
   }
   const checkpoint=cloneRun(r),node=currentNode(r),actionStart=actions.length;
   const setup=buildBattle(r);const out=simulate({...setup,record:false});
   if(out.fault)throw new Error(`Engine fault: ${out.fault}`);
   act('beginBattle',[out.result,out.gold??0],()=>{beginBattle(r,out.result,out.gold??0);return true;});
   recordOfficialBattle(r,out,checkpoint,checkpoint.slots,checkpoint.bench);persist();
   act('finishBattle',[],()=>finishBattle(r));persist();
   const battleIndex=battles.length;
   battles.push({index:battleIndex,actionStart,actionEnd:actions.length-1,node:{chapter:checkpoint.chapter,node:checkpoint.node,name:node.name,kind:node.kind},checkpoint,setup,result:out.result,beats:out.beats,metrics:out.metrics,gold:out.gold??0,triggers:out.triggers,after:{over:r.over,lives:r.lives,chapter:r.chapter,node:r.node,wins:r.wins}});
   capture(battleIndex);
   const key=`${checkpoint.chapter}:${checkpoint.node}`;
   if(out.result==='draw'&&node.kind==='boss'){drawStreak=lastDrawKey===key?drawStreak+1:1;lastDrawKey=key;}else{drawStreak=0;lastDrawKey='';}
   if(battles.length>=150){termination='unfinished-battle-limit';break;}
  }
  if(r.over)termination=r.over;
 }catch(e){termination='harness-error';error=e instanceof Error?e.stack??e.message:String(e);process.exitCode=1;}
 persist();capture(battles.length?battles.length-1:null);
 const summary={run:runIndex+1,seed,general,generalName:GENERALS.find(g=>g.id===general)?.name,policy,termination,error,battles:battles.length,wins:r.wins,lives:r.lives,trace:traceFile};
 write(traceFile,{schema:1,scope:'Normal player API actions only; no advertising; isolated in-memory production saves',seed,general,offeredGenerals:choices,policy,summary,initialRunId:r.runId,actions,battles,finalRun:cloneRun(r),careerAfter:structuredClone(loadCareer())});summaries.push(summary);previous=r;
 console.log(JSON.stringify(summary));
 if(error)break;
}
const profile=loadCareer(),progress=getAchievementProgress(profile);
const coverage=progress.map(a=>({...a,status:first.has(a.id)?'achieved':'unobserved',firstWitness:first.get(a.id)??null}));
write('coverage.json',{schema:1,achievementContractHash:sourceHash,requested:{SEEDS:rawSeeds,START:start,POLICY:requested},scope:'Legal single-device expedition prefixes in isolated storage, not fabricated saves or ad callbacks. Unobserved means not seen in this sample, never impossible.',runs:summaries,achieved:coverage.filter(a=>a.status==='achieved').length,total:ACHIEVEMENTS.length,coverage,finalProfile:profile});
const lines=['# 玩家正常远征成就观测','',`本批 ${summaries.length} 局；观测达成 ${first.size}/${ACHIEVEMENTS.length} 项。未观测不等于不可达。`,'','只使用正常开局、候选招募、同星合成、实体换位、培养、购买、装备、法术、升阶、分岔及真实战斗结算；无广告、无后台修改玩家数值。','',`复现：在 source 目录设置 SEEDS=${rawSeeds}、START=${start}、POLICY=${requested} 后运行 npx vite-node scripts/achievement-playthrough.ts。每项首次证据指向独立局轨迹；累计成就需按此前完整轨迹前缀重放。`,'','| 成就 | 状态 | 首次局/种子/战斗 | 轨迹 |','|---|---|---|---|',...coverage.map(a=>{const w=a.firstWitness;return `| ${a.name} (${a.id}) | ${a.status} | ${w?`${w.run} / ${w.seed} / ${w.battleIndex??'-'}`:'—'} | ${w?`[轨迹](${w.trace}) 动作${w.actionIndex}`:'—'} |`;})];
writeFileSync(join(outputDir,'REPORT.md'),lines.join('\n'),'utf8');
console.log(`Coverage ${first.size}/${ACHIEVEMENTS.length}; evidence ${outputDir}`);
