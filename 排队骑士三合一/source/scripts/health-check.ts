import {newRun,settleBattle,adSaveHeart,maxLives,load,SAVE_KEY,type Diff} from '../src/core/run';
import {createRehearsal} from '../src/core/rehearsal';
const check=(x:unknown,s:string)=>{if(!x)throw Error(s)};
for(const diff of [0,1,2] as Diff[]) {
 const r=newRun(6432,{diff});
 check(r.lives===[5,3,2][diff]&&maxLives(r)===r.lives,'initial lives');
 r.turn=5;r.lives=1;r.gold=0;
 const snap=structuredClone(r);
 settleBattle(r,{result:'lose',perm:{}});
 check(r.phase==='lost'&&r.lives===0&&r.lastLoss===1,'fatal actual loss');
 const session=createRehearsal(r,snap,'lose');
 check(adSaveHeart(r),'fatal protection');
 check(r.phase==='prep'&&r.lives===1&&r.turn===6&&r.gold===10&&r.history.at(-1)==='lose','restore and advance once');
 check(!session.canRetry()&&!adSaveHeart(r),'no duplicate rescue');
 settleBattle(r,{result:'lose',perm:{}});check(adSaveHeart(r)&&r.adSave===2,'second protection');
 settleBattle(r,{result:'lose',perm:{}});check(!adSaveHeart(r)&&r.phase==='lost','cap two');
}
const r=newRun(6432);r.turn=5;r.lives=5;
settleBattle(r,{result:'lose',perm:{}});const turn=r.turn;
check(r.lives===3&&adSaveHeart(r)&&Number(r.lives)===5&&r.turn===turn,'nonfatal no double advance');
const storage=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)}});
const legacy=newRun(6432);legacy.lives=9;storage.set(SAVE_KEY,JSON.stringify(legacy));
check(load()?.lives===5,'legacy capped');check(JSON.parse(storage.get(SAVE_KEY+'_before_health_532')!).lives===9,'original backup');
check(JSON.parse(storage.get(SAVE_KEY)!).lives===9,'read leaves original intact');
console.log('Health protection checks passed: 5/3/2, fatal/nonfatal restoration, one advance, limits, retry exclusion, legacy backup.');
