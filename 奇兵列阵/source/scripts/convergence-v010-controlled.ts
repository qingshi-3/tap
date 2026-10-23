declare const process:{env:Record<string,string|undefined>};
// @ts-expect-error Node host.
import {mkdirSync,openSync,writeSync,closeSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
// @ts-expect-error Node host.
import {createHash} from 'node:crypto';
import {Battle} from '../src/core/engine';
import type {BattleSetup} from '../src/core/engine';
import {chapter} from '../src/core/route';
import type {EnemyEntry,Slotted} from '../src/core/types';
const folder='../output/convergence-v010-20261022/controlled';mkdirSync(folder,{recursive:true});
const fd=openSync(`${folder}/cells.jsonl`,'w');const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const files=readdirSync('src/core').filter((p:string)=>p.endsWith('.ts')).map((p:string)=>`src/core/${p}`);const hashes=Object.fromEntries(files.map((p:string)=>[p,hash(p)]));
const scene=(name:string,enemy:EnemyEntry[])=>({name,enemy,chapter:1,rules:undefined as BattleSetup['rules']});
const authored=chapter(0).stages[6];if(authored.type!=='battle')throw new Error('route changed');
const scenes=[scene('同期合成-双前排物攻',[{defId:'e_brute',atk:4,hp:18},{defId:'e_brute',atk:3,hp:14}]),scene('同期合成-前排加狙击',[{defId:'e_brute',atk:4,hp:18},{defId:'e_assassin',atk:3,hp:12}]),scene('同期合成-前排加法术',[{defId:'e_brute',atk:4,hp:18},{defId:'e_lich',atk:2,hp:12},{defId:'e_pyre',atk:2,hp:10}]),{name:`实际1:7-${authored.main.name}`,enemy:authored.main.lineup,chapter:1,rules:authored.main.rules}];
const seeds=Array.from({length:12},(_,i)=>6102201+i*7919);let cells=0,faults=0;const summary:Record<string,any>={};
function team(ids:string[],copies:1|2,investment:number):Slotted[]{const bodies=ids.map((defId,i)=>({defId,ownedId:i+1,copies}as Slotted));if(investment){bodies[0].train={hp:investment/2};const howler=bodies.find(u=>u.defId==='d_howler')??bodies[Math.min(1,bodies.length-1)];howler.train={...howler.train,atk:investment/4,hp:(howler.train?.hp??0)+investment/4};}return bodies;}
function run(suite:string,condition:string,variant:string,setup:BattleSetup,mute?:{slot:number;field:'onAllySummon'|'onAllyFront'}) {
 const b=new Battle({...setup,record:true});if(mute){const uid=b.at(0,mute.slot)?.uid;if(!uid)throw new Error('missing mute source');const old=b.def.bind(b);b.def=u=>u.uid===uid?{...old(u),[mute.field]:undefined}:old(u);}
 const out=b.run_();cells++;if(out.fault)faults++;
 let beat=0,round=0;const wolves=new Map<number,any>(),actions:Record<number,number>={},events:unknown[]=[];
 for(const[eventIndex,frame]of out.log.entries()){const e=frame.ev;if(e.t==='beat'){beat=e.n;round=e.round??0;}
  if(e.t==='summon'){const u=frame.snap.find(u=>u.uid===e.uid);if(u?.side===0&&u.defId==='t_wolf')wolves.set(u.uid,{uid:u.uid,src:e.src,enterBeat:beat,enterRound:round,block:0,firstAction:null,death:null});}
  if(e.t==='block'&&wolves.has(e.uid))wolves.get(e.uid).block+=e.n;
  if(e.t==='act'&&e.side===0){actions[e.uid]=(actions[e.uid]??0)+1;if(wolves.has(e.uid)&&!wolves.get(e.uid).firstAction)wolves.get(e.uid).firstAction={beat,round,mode:e.mode};}
  if(e.t==='death'&&wolves.has(e.tgt))wolves.get(e.tgt).death={beat,round};
  if(e.t==='actionGain'||e.t==='gen'||e.t==='frozenSkip'||e.t==='heal'){const nextBeat=out.log.slice(eventIndex).find(x=>x.ev.t==='beat')?.ev;events.push({beat,round:e.t==='actionGain'&&nextBeat?.t==='beat'?(nextBeat.round??round):round,event:e});}
 }
 const wolf=[...wolves.values()],started=wolf.filter(w=>w.firstAction).length,died=wolf.filter(w=>!w.firstAction&&w.death).length;
 const group=`${suite}/${condition}/${variant}`;const a=summary[group]??={n:0,win:0,lose:0,draw:0,wolves:0,wolfActed:0,wolfDiedBeforeAction:0,wolfShield:0,damage:0,healing:0,extra:0,actionGain:0};a.n++;a[out.result]++;a.wolves+=wolf.length;a.wolfActed+=started;a.wolfDiedBeforeAction+=died;a.wolfShield+=wolf.reduce((n,w)=>n+w.block,0);a.damage+=(out.metrics?.attackDamage??0)+(out.metrics?.spellDamage??0)+(out.metrics?.burnDamage??0);a.healing+=out.metrics?.healing??0;a.extra+=out.metrics?.extraActions??0;a.actionGain+=out.log.filter(x=>x.ev.t==='actionGain'&&x.ev.uid===b.units.find(u=>u.ownedId===setup.general?.commandTarget)?.uid).length;
 writeSync(fd,JSON.stringify({suite,condition,variant,seed:setup.seed,setup,mute,result:out.result,beats:out.beats,rounds:out.rounds,metrics:out.metrics,wolves:wolf,actions,events,fatigue:out.log.some(x=>x.ev.t==='dmg'&&x.ev.kind==='fatigue'),fault:out.fault})+'\n');
}
for(const scene of scenes)for(const copies of [1,2]as const)for(const investment of [0,12])for(const layout of ['supportFront','supportRear','fullFive']as const)for(const seed of seeds) {
 const ids=layout==='supportFront'?['d_keeper','n_merc','n_archer','d_howler']:layout==='supportRear'?['n_bulwark','d_howler','n_archer','d_keeper']:['d_keeper','n_merc','n_medic','n_archer','d_howler'];const slot=ids.indexOf('d_keeper');const condition=`${scene.name}/star${copies===1?1:2}/points${investment}/${layout}`;
 const setup:BattleSetup={player:team(ids,copies,investment),enemy:scene.enemy,rules:scene.rules,chapter:scene.chapter,seed};
 run('wolf',condition,'keeper',setup);run('wolf',condition,'keeperNoProtection',setup,{slot,field:'onAllySummon'});
 const replace=structuredClone(setup);(replace.player[slot]as Slotted).defId='n_thorn';run('wolf',condition,'neutralSameTierPrice',replace);
}
for(const scene of scenes)for(const rotate of [true,false])for(const seed of seeds) {
 const ids=rotate?['s_wind','n_bulwark','n_tether','d_hourglass']:['n_bulwark','n_merc','n_archer','d_hourglass'];const setup:BattleSetup={player:team(ids,2,12),enemy:scene.enemy,rules:scene.rules,chapter:scene.chapter,seed};const condition=`${scene.name}/${rotate?'rotation':'noRotation'}`;
 run('hourglass',condition,'hourglass',setup);run('hourglass',condition,'sameBodyMuted',setup,{slot:3,field:'onAllyFront'});const replacement=structuredClone(setup);(replacement.player[3]as Slotted).defId='n_envoy';run('hourglass',condition,'sameTierNeutralSupport',replacement);
}
const rosters:Record<string,string[]>={physical:['n_bulwark','m_rex','n_breaker','n_archer','s_wind'],summon:['n_bulwark','d_artificer','d_howler','d_keeper','d_glass'],spell:['n_bulwark','a_chanter','v_mage','l_priest','n_archer']};
const pressureNodes=[chapter(1).stages[0],chapter(1).stages[2],chapter(1).stages[8]];
const generalScenes=[...scenes,...pressureNodes.flatMap((stage,i)=>stage.type==='battle'||stage.type==='boss'?[{name:`实际第二章压力${[1,3,9][i]}-${stage.main.name}`,enemy:stage.main.lineup,chapter:2,rules:stage.main.rules}]:[])];
for(const scene of generalScenes)for(const[roster,ids]of Object.entries(rosters))for(const seed of seeds)for(const gen of ['none','reva','zilan','sajj','kaleos']) {
 const player=team(ids,2,12),commandTarget=gen==='zilan'?player[0].ownedId:player[1].ownedId;
 const setup:BattleSetup={player,enemy:scene.enemy,rules:scene.rules,chapter:scene.chapter,seed,bench:1,...(gen==='none'?{}:{general:{id:gen,power:0,passives:[],tacticsVersion:1,commandTarget}}),reserve:[{defId:'n_archer',copies:2,ownedId:99}],...(gen==='reva'?{swaps:[[0,scene.enemy.filter(Boolean).length-1]as[number,number]]}:{})};
 run('general',`${scene.name}/${roster}`,gen,setup);
}
closeSync(fd);const changed=files.filter((p:string)=>hashes[p]!==hash(p));writeFileSync(`${folder}/summary.json`,JSON.stringify({cells,faults,changed,hashes,seedCount:seeds.length,seeds,price:'modern recruit price3; fixed authored acquisition, not legal run',investment:'same total training points; 0 or12, no power on summons',summary},null,2));console.log(JSON.stringify({cells,faults,changed}));if(faults||changed.length)throw new Error('controlled gate');
