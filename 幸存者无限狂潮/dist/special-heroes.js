import { getCombatStats, getSkillGeometry } from './combat-stats.js';
import { ensureAttackProgress, ATTACK_DAMAGE_SCALE } from './attack-progression.js';

export const SPECIAL_HERO_IDS=Object.freeze(['grappler','rift','magnet']);
export const SPECIAL_HERO_PERKS=Object.freeze({
 grappler:[{id:'grappler_grip',name:'稳擒',description:'持敌时间 +0.4秒，抓取宽度 +8。',icon:'✊',max:2,category:'heroSkill'},{id:'grappler_impact',name:'裂地',description:'投掷落点与追震范围 +15，落地及追震伤害 +15%。',icon:'◉',max:2,category:'heroSkill'}],
 rift:[{id:'rift_hold',name:'稳界',description:'远门保留 +2秒。',icon:'◌',max:2,category:'heroSkill'},{id:'rift_barrage',name:'贯界',description:'重火力射击窗 +0.4秒，单敌预算封顶。',icon:'✥',max:2,category:'heroSkill'}],
 magnet:[{id:'magnet_storage',name:'蓄铁',description:'捕获弹仓 +1，捕弹范围 +12。',icon:'◆',max:2,category:'heroSkill'},{id:'magnet_press',name:'锻压',description:'轨炮宽度 +5，榴弹爆破半径 +12。',icon:'➞',max:2,category:'heroSkill'}],
});
const alive=e=>e&&!e.dead&&e.hp>0&&!(e.spawnDelay>0);
const immovable=e=>e.boss||e.trialConstruct||e.construct||e.mechanicConstruct;
const heavy=e=>immovable(e)||e.kind==='brute'||e.kind==='guard'||(e.radius||0)>=26;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const d2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const angle=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const point=(p,a,n)=>({x:p.x+Math.cos(a)*n,y:p.y+Math.sin(a)*n});
const perk=(g,id)=>clamp(Number(g.heroPerks?.[id])||0,0,2);
const enemy=(g,id)=>(g.enemies||[]).find(e=>e.id===id&&alive(e));
const facing=g=>g.player.facing<0?Math.PI:0;
const aimAngle=(g,a)=>typeof a==='number'?a:a&&(a.x||a.y)?Math.atan2(a.y||0,a.x||0):facing(g);
function bounded(g,p,r=24){return {x:clamp(p.x,r,(g.world?.width||2400)-r),y:clamp(p.y,r,(g.world?.height||1800)-r)};}
function segmentDistance(e,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((e.x-a.x)*dx+(e.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.sqrt(d2(e,{x:a.x+t*dx,y:a.y+t*dy}));}
function near(g,p,r,cap=12){return(g.enemies||[]).filter(alive).filter(e=>d2(e,p)<=(r+(e.radius||18))**2).sort((a,b)=>d2(a,p)-d2(b,p)||a.id-b.id).slice(0,cap);}
function hit(g,api,e,n,category='basic',budget=null,limit=Infinity){if(!alive(e)||n<=0)return;if(category.startsWith('basic')&&g.specialHero?.heldSlots.some(h=>h.enemyId===e.id))return;if(budget){const used=budget.get(e.id)||0;n=Math.min(n,Math.max(0,limit-used));budget.set(e.id,used+n);}if(n>0)api.damage(e,n,'#e3f5ff',category);}
function circle(g,p,r,n,api,category='active',budget=null,limit=Infinity){for(const e of near(g,p,r,Infinity))hit(g,api,e,n,category,budget,limit);}
// Eligibility precedes ordering. Nearby off-axis bodies cannot erase a real lane hit.
function sweep(g,a,b,width,n,api,ids=new Set(),category='active',budget=null,limit=Infinity){const candidates=(g.enemies||[]).filter(alive).filter(e=>!ids.has(e.id)&&!(category.startsWith('basic')&&g.specialHero?.heldSlots.some(h=>h.enemyId===e.id))&&segmentDistance(e,a,b)<=width+(e.radius||18)).sort((x,y)=>d2(x,a)-d2(y,a)||x.id-y.id);for(const e of candidates){ids.add(e.id);hit(g,api,e,n,category,budget,limit);}return ids;}

function fx(g,style,data){const s=g.specialHero;if(!s)return;(g.heroEffects||=[]).push({visualKind:'newHero',heroId:s.heroId,tier:s.tier,style,shape:'circle',life:.28,maxLife:.28,...data});if(g.heroEffects.length>160)g.heroEffects.splice(0,g.heroEffects.length-160);}
function release(e){if(e?.specialHeld){delete e.specialHeld;e.frozen=e._specialFrozen||0;delete e._specialFrozen;delete e.specialLift;e.slow=Math.max(e.slow||0,.15);}}
function controlled(e){if(!e.specialHeld){e._specialFrozen=e.frozen||0;e.specialHeld=true;e.frozen=Infinity;e.attackWarning=null;}}
function move(g,e,to,api){to=bounded(g,to,e.radius||24);if(api.movementHitsWall?.(e.x,e.y,to.x,to.y,e.radius||24))return false;e.x=to.x;e.y=to.y;return true;}
function unsafe(g,p,api){if(api.isUnsafePosition?.(p.x,p.y,g.player.radius))return true;return(g.enemies||[]).some(e=>alive(e)&&e.attackWarning&&d2(e,p)<((e.attackWarning.radius||90)+g.player.radius)**2);}
function legalDestination(g,wanted,api){const p=g.player;for(let f=1;f>=.05;f-=.05){const to=bounded(g,{x:p.x+(wanted.x-p.x)*f,y:p.y+(wanted.y-p.y)*f},p.radius);if(!api.movementHitsWall?.(p.x,p.y,to.x,to.y,p.radius)&&!api.movementHitsDanger?.(p.x,p.y,to.x,to.y,p.radius)&&!unsafe(g,to,api))return to;}return null;}
function pending(g,delay,fn){const s=g.specialHero;if(s.pending.length<24)s.pending.push({delay,fn});}
function motion(g,e,to,duration,done,api,kind='grab',damage=0,category='active',arc=null){
 const s=g.specialHero;if(e!==g.player){controlled(e);s.motions=s.motions.filter(m=>m.enemyId!==e.id);}if(s.motions.length>=8){release(e);return;}
 s.motions.push({enemyId:e===g.player?null:e.id,from:{x:e.x,y:e.y},to:bounded(g,to,e.radius||24),elapsed:0,duration,done,kind,damage,category,arc,hitIds:new Set([e.id])});
}
export function specialHeroTier(g){const j=g.heroJob||g.player?.job;return ['titan_grappler','rift_sovereign','magnet_sovereign'].includes(j)?3:['grappler','rift_weaver','magnet_master'].includes(j)?2:1;}
export function ensureSpecialHero(g){const id=g.heroId||g.player?.heroId;if(!SPECIAL_HERO_IDS.includes(id))return null;if(g.specialHero?.heroId!==id){clearSpecialHero(g);g.specialHero={heroId:id,tier:specialHeroTier(g),clock:.12,combo:0,serial:0,heldId:null,heldSlots:[],heldTime:0,motions:[],throws:[],gates:[],echoGates:[],autoGates:[],bolts:[],beams:[],scraps:[],fieldTime:0,fieldCaptured:0,shieldHP:0,trails:[],pending:[],armorTime:0,heat:0,gunMode:'normal',gunTime:0,marks:new Map()};}g.specialHero.tier=specialHeroTier(g);return g.specialHero;}
export function clearSpecialHero(g){for(const e of g.enemies||[])release(e);g.specialHero=null;g.heroEffects=(g.heroEffects||[]).filter(f=>f.visualKind!=='newHero');}
function syncHeld(s){s.heldId=s.heldSlots[0]?.enemyId??null;s.heldTime=s.heldSlots[0]?.remaining||0;}
function dropHeld(g){const s=g.specialHero;for(const h of s.heldSlots)release(enemy(g,h.enemyId));s.heldSlots=[];syncHeld(s);}
function heldEnemies(g){return g.specialHero.heldSlots.map(h=>enemy(g,h.enemyId)).filter(Boolean);}
function hold(g,e,a,side){const s=g.specialHero;if(!alive(e)||heavy(e)||s.heldSlots.length>=(s.tier===3?2:1)||s.heldSlots.some(h=>h.enemyId===e.id))return release(e);controlled(e);s.heldSlots.push({enemyId:e.id,angle:a,side,remaining:e.elite?1.3:3+.4*perk(g,'grappler_grip'),hp:32,blocks:2});syncHeld(s);}
function arc(g,e,a,span,r,n,api,done,kind='sweep',category='active'){motion(g,e,point(g.player,a+span,r),.38,done,api,kind,n,category,{angle:a,span,r});}
function throwEnemy(g,e,a,api,{short=false,category='active',delay=0,offset=0}={}){
 const s=g.specialHero,r=ensureAttackProgress(g),st=getCombatStats(g);if(!e||heavy(e))return false;
 s.heldSlots=s.heldSlots.filter(h=>h.enemyId!==e.id);syncHeld(s);s.motions=s.motions.filter(m=>m.enemyId!==e.id);controlled(e);
 const distance=short?(r.branch==='a'?145:130):240+offset,damage=(short?35:92)*st.damage*(category==='active'?1:ATTACK_DAMAGE_SCALE[r.rank-1]),impact=perk(g,'grappler_impact');
 s.throws.push({enemyId:e.id,x:e.x,y:e.y,angle:a,vx:Math.cos(a)*600,vy:Math.sin(a)*600,remaining:distance/600,delay,hitIds:new Set([e.id]),damage,landingDamage:damage*(1+.15*impact),shockRadius:125*st.area+15*impact,radius:(short&&r.branch==='a'?35:22)*st.area,short,impactRadius:(short?(s.tier>=2&&r.rank>=3?85:55):90)*st.area+15*impact,roll:short&&r.rank>=3&&s.tier===2,category,shock:!short&&s.tier>=2});
 while(s.throws.length>4){release(enemy(g,s.throws[0].enemyId));s.throws.shift();}return true;
}
function physical(g,a,reach,width,n,api,category='active'){sweep(g,g.player,point(g.player,a,reach),width,n,api,new Set(),category);fx(g,'grapplePunch',{...g.player,angle:a,radius:reach,width:width*2,combo:category.startsWith('basic')?g.specialHero.combo:0,handSide:g.specialHero.combo===2?-1:1,category,sound:'bladeCut'});}
// Wide basic sweeps share one hit set: intersecting rays never multiply damage.
function basicFan(g,a,reach,span,n,api){for(const e of near(g,g.player,reach,Infinity)){const allowance=Math.asin(Math.min(1,(e.radius||18)/(Math.sqrt(d2(g.player,e))||1)));if(Math.abs(delta(angle(g.player,e),a))<=span/2+allowance)hit(g,api,e,n,'basic');}fx(g,'grappleFan',{...g.player,angle:a,radius:reach,span,life:.28,maxLife:.28});}
function basicGround(g,at,r,n,api,budget=null,limit=Infinity){circle(g,at,r,n,api,'basicSecondary',budget,limit);fx(g,'grappleSlam',{...at,radius:r});}
function grappleBasic(g,a,target,api){
 const s=g.specialHero,r=ensureAttackProgress(g),st=getCombatStats(g),p=g.player,n=28*st.damage*ATTACK_DAMAGE_SCALE[r.rank-1],high=s.tier>=2&&r.rank>=3,reach=(high?(s.tier===3?140:120):92)*st.area;s.combo=s.combo%3+1;
 if(high&&r.branch==='a')basicFan(g,a,reach,Math.PI*1.35,n,api);else physical(g,high&&r.branch==='b'?a-.18:a,reach,high?(s.tier===3?55:45)*st.area:s.tier===3?40:28,n,api,'basic');
 if(high&&r.branch==='b')pending(g,.1,()=>physical(g,a+.18,reach,45*st.area,n*.6,api,'basicSecondary'));if(s.combo!==3)return;
 const free=near(g,p,reach,Infinity).find(e=>!heavy(e)&&!e.specialHeld),occupied=s.heldSlots.length>0;
 if(r.branch==='b'&&!high){physical(g,a,reach,22,n*.7,api,'basicSecondary');pending(g,.1,()=>physical(g,a,reach,22,n*.7,api,'basicSecondary'));}
 if(s.tier===1){
  if(r.rank>=2&&target&&!immovable(target)){target.frozen=Math.max(target.frozen||0,.2);fx(g,'grappleLift',{...target,radius:28});}
  if(r.branch==='a'){circle(g,p,130*st.area,n*.65,api,'basicSecondary');fx(g,'grappleShock',{...p,radius:130*st.area});}
  const victims=r.branch==='a'?near(g,p,reach,Infinity).filter(e=>!heavy(e)&&!e.specialHeld).slice(0,5):free?[free]:[];
  for(const e of victims)motion(g,e,point(e,a,65),.16,e=>release(e),api,'push',r.rank>=3?n*.6:0,'basicSecondary');
 }else if(s.tier===2){
  if(occupied){if(high)basicGround(g,point(p,a,80),78*st.area,n*.75,api);return;}if(r.rank>=2)basicGround(g,point(p,a,high?75:55),(high?78:58)*st.area,n*.65,api);
  if(free){if(r.branch==='b')hit(g,api,free,n,'basicSecondary');throwEnemy(g,free,r.branch==='a'?a-.4:a,api,{short:true,category:'basicSecondary'});}else{physical(g,a,reach,high?48*st.area:32,n*.8,api,'basicSecondary');}
 }else{
  if(occupied){if(high)basicGround(g,point(p,a,85),85*st.area,n*.8,api);else if(r.rank>=2)physical(g,a,reach,32,n*.75,api,'basicSecondary');return;}
  const victims=near(g,p,reach,Infinity).filter(e=>!heavy(e)&&!e.specialHeld).slice(0,r.rank>=3?2:1);
  if(r.branch==='a'&&victims.length){for(let i=0;i<victims.length;i++)arc(g,victims[i],a+i*Math.PI,Math.PI*1.8,high?100*st.area:72,n*.8,api,e=>{basicGround(g,e,(high?85:65)*st.area,n*.6,api);release(e);},'basicSweep','basicSecondary');}
  else if(victims.length===2&&r.rank>=3&&r.branch!=='b'){const impactBudget=new Map();for(const e of victims)motion(g,e,point(p,a,70),.24,e=>{hit(g,api,e,n,'basicSecondary');fx(g,'grappleCollision',{...e,radius:28,angle:a});if(high)basicGround(g,e,85*st.area,n*.65,api,impactBudget,n*.65);release(e);},api,'clash',n*.7,'basicSecondary');}
  else if(victims.length&&r.branch!=='b'){arc(g,victims[0],a-.8,r.branch==='a'?Math.PI*1.8:1.6,72,n*.8,api,e=>{if(r.rank>=2){circle(g,e,65*st.area,n*.6,api,'basicSecondary');fx(g,'grappleSlam',{...e,radius:65});}release(e);},'basicSweep','basicSecondary');}
  else{physical(g,a,reach,high?55*st.area:40,n,api,'basicSecondary');if(high)basicGround(g,point(p,a,85),85*st.area,n*.65,api);}
 }
}
function makeGate(g,p,a,temporary=false){const s=g.specialHero;return {id:++s.serial,...bounded(g,p,30),angle:a,remaining:temporary?3:8+2*perk(g,'rift_hold'),role:'exit',temporary};}
const exit=g=>g.specialHero.gates.find(v=>v.remaining>0)||null;
const source=g=>exit(g)||g.player;
function targetAt(g,p,r=480,elite=false){const list=near(g,p,r,Infinity).filter(e=>!e.specialHeld&&!g.specialHero.heldSlots.some(h=>h.enemyId===e.id));return elite?list.find(e=>e.boss||e.elite)||list[0]:list[0];}
function sideTarget(g,at,a,side,range=360){return near(g,at,range,Infinity).find(e=>!e.specialHeld&&delta(angle(at,e),a)*side>.28);}
function addBolt(g,spec){const s=g.specialHero;if(s.bolts.length>=48)return false;const speed=spec.speed||500,distance=spec.distance||360;s.bolts.push({id:++s.serial,x:spec.x,y:spec.y,vx:Math.cos(spec.angle)*speed,vy:Math.sin(spec.angle)*speed,speed,life:distance/speed,hitIds:new Set(),width:8,pierce:1,category:'basic',style:'magnetBolt',...spec});return true;}
function beam(g,spec){const s=g.specialHero;if(s.beams.length>=8)return;const st=getCombatStats(g);s.beams.push({id:++s.serial,angle:spec.angle,delay:.18,remaining:.22,tick:0,length:350,width:15*st.area,damage:26*st.damage,category:'basic',track:0,budget:new Map(),budgetCap:160*st.damage,rank:ensureAttackProgress(g).rank,branch:ensureAttackProgress(g).branch,...spec});}
function riftBasic(g,a,api){
 const s=g.specialHero,r=ensureAttackProgress(g),st=getCombatStats(g),at=source(g),range=s.tier===1?350:s.tier===2?(r.branch==='b'?440:350):360,target=targetAt(g,at,range,r.branch==='b'),out=target?angle(at,target):a;s.riftEntryAngle=a;s.combo=s.combo%3+1;
 if(s.tier===1){const gate=exit(g),entry=point(g.player,a,30);const shot=(drill,delay=0)=>{const fire=()=>{const current=exit(g),at=current?point(g.player,a,30):g.player;addBolt(g,{...at,angle:a,speed:440,distance:current?22:350,width:10*st.area,damage:29*st.damage*ATTACK_DAMAGE_SCALE[r.rank-1],pierce:drill?4:2,style:drill?'riftDrill':'riftBolt',phase:current?'entry':'flight',exitId:current?.id,exitAngle:out,exitDistance:350,burst:r.rank>=2?42:0,split:r.branch==='a',returnBurst:r.branch==='b',category:'basic'});};if(delay)pending(g,delay,fire);else fire();};shot(r.branch==='b');if(r.rank>=3&&r.branch!=='b')shot(true,.18);}
 else if(s.tier===2){const high=r.rank>=3,spec={angle:out,damage:42*st.damage*ATTACK_DAMAGE_SCALE[r.rank-1],burst:r.rank>=2?48:0,length:r.branch==='b'?440:350};
  if(high){const side=s.combo%2?-1:1,other=sideTarget(g,at,out,side,350);beam(g,{...spec,angle:r.branch==='a'?(sideTarget(g,at,out,-1,350)?angle(at,sideTarget(g,at,out,-1,350)):out-.4):out,delay:.14,remaining:.26});beam(g,{...spec,angle:r.branch==='a'?(sideTarget(g,at,out,1,350)?angle(at,sideTarget(g,at,out,1,350)):out+.4):r.branch==='b'?out:other?angle(at,other):out+side*.32,delay:.4,remaining:.26});}
  else beam(g,spec);
 }
 else{const high=r.rank>=3;beam(g,{angle:out,delay:.08,remaining:high?.86:.7,tick:0,track:high?5.8:2.4,damage:15*st.damage*ATTACK_DAMAGE_SCALE[r.rank-1],length:360,width:(high?21:17)*st.area,rank:r.rank,branch:r.branch,refract:r.rank>=2,pulse:r.rank>=3,coverage:high&&r.branch!=='b',budgetCap:165*st.damage});}
 fx(g,'riftCharge',{...at,radius:s.tier===3?43:30,angle:out,life:.3,maxLife:.3,sound:'orb'});
}
function ammoCap(g){return 6+perk(g,'magnet_storage');}
function consumeAmmo(g){const s=g.specialHero,n=s.scraps.length;s.scraps=[];return n;}
function gunShot(g,a,n,api,spec={}){g.specialHero.visualAim=a;if(spec.basicSide){(g.specialHero.basicGunAngles||={})[spec.basicSide]=a;(g.specialHero.basicGunOffsets||={})[spec.basicSide]={x:(spec.x??g.player.x)-g.player.x,y:(spec.y??g.player.y)-g.player.y};}const st=getCombatStats(g),r=ensureAttackProgress(g);addBolt(g,{...g.player,angle:a,speed:600,distance:360,width:7*st.area,damage:n*st.damage*(spec.category==='active'?1:ATTACK_DAMAGE_SCALE[r.rank-1]),style:'magnetBolt',...spec});fx(g,'magnetMuzzle',{x:spec.x??g.player.x,y:spec.y??g.player.y,angle:a,boltStyle:spec.style||'magnetBolt',shoulder:spec.shoulder||0,radius:28,sound:'orb'});}
function magnetBasic(g,a,api){
 const s=g.specialHero,r=ensureAttackProgress(g),st=getCombatStats(g);s.combo=s.combo%3+1;
 if(s.armorTime>0){gunShot(g,a,14,api,{heat:true,category:'active'});if(s.tier>=2&&s.combo===3){const target=targetAt(g,g.player,480),landing=target?point(target,a,65):point(g.player,a,260);for(const side of[-1,1]){const origin=point(g.player,a+side*Math.PI/2,30),goal=point(landing,a+side*Math.PI/2,32),da=angle(origin,goal),distance=Math.sqrt(d2(origin,goal));gunShot(g,da,35,api,{x:origin.x,y:origin.y,style:'magnetGrenade',burst:65,pierce:8,distance,category:'active',shoulder:side,landing:goal});}}if(s.tier===3&&s.heat>=6){s.heat=0;s.gunMode='cannon';s.gunTime=.45;gunShot(g,a,100,api,{style:'magnetCannon',pierce:8,burst:80,category:'active'});}s.clock=.14/st.attackSpeed;return;}
 if(s.tier===1){gunShot(g,a,24,api,{marks:r.branch==='b',pierce:1});if(r.rank>=2)pending(g,.12,()=>gunShot(g,a,20,api,{pierce:2,marks:r.branch==='b'}));if(r.rank>=3&&s.combo===3){for(const da of [-.25,0,.25])gunShot(g,a+da,12,api,{distance:190});if(r.branch==='a')for(let i=1;i<=2;i++)pending(g,.14+i*.1,()=>gunShot(g,a,14,api));}}
 else if(s.tier===2){const high=r.rank>=3;s.gunMode='rail';s.gunTime=.35;fx(g,'magnetCharge',{...g.player,angle:a,radius:30,life:.22,maxLife:.22});const spec={pierce:8,width:(high?14:11)*st.area,style:'magnetRail',shell:r.rank>=2,ground:r.rank>=3,drill:r.branch==='b'};pending(g,.2,()=>gunShot(g,a,43,api,spec));if(r.branch==='a'){const side=s.combo%2?-1:1;pending(g,.36,()=>{const alt=sideTarget(g,g.player,a,side,360)||targetAt(g,g.player,360);if(alt)gunShot(g,angle(g.player,alt),35,api,spec);});}}
 else{
  const high=r.rank>=3,p=g.player,main={heat:true,pierce:high?3:1},origin=side=>point(p,a+side*Math.PI/2,14);
  const fireMain=side=>{const from=origin(side),target=targetAt(g,p,360),out=high&&r.branch!=='b'&&target?angle(from,target):a;gunShot(g,out,15,api,high?{...main,...from,basicSide:side}:main);};
  const fireSide=(side,n,opts={})=>{const from=origin(side),target=sideTarget(g,p,a,side,360)||targetAt(g,p,360);if(target)gunShot(g,angle(from,target),n,api,{...opts,pierce:2,distance:360,...from,basicSide:side});};
  fireMain(-1);pending(g,.11,()=>fireMain(1));
  if(r.rank>=2&&r.branch!=='b')for(const side of [-1,1])pending(g,.22,()=>{if(high)fireSide(side,12);else gunShot(g,a+side*.45,12,api,{distance:200,pierce:1});});
  if(s.combo===3){const hot=s.heat>=3;s.heat=Math.max(0,s.heat-3);if(r.branch==='b'){s.gunMode='cannon';s.gunTime=.45;gunShot(g,a,hot?90:55,api,{style:'magnetCannon',pierce:8,width:12*st.area,heat:true,drillElite:true,hot,burst:high?55:0,axialFragments:high?3:0});}else gunShot(g,a,hot?42:25,api,{style:'magnetHot',pierce:high?4:1,burst:high?(hot?60:35):hot?45:0,hot,heat:true,heavyNext:hot&&r.rank>=3});}
  if(r.branch==='a')for(let i=1;i<=3;i++){const side=i%2?-1:1;pending(g,.22+i*.1,()=>fireSide(side,12,{heat:true}));}
 }
 s.clock=(s.tier===1?.82:s.tier===2?(r.rank>=3?.78:1):(r.rank>=3?.42:.48))/st.attackSpeed;

}
function basic(g,api){const s=g.specialHero,p=g.player,st=getCombatStats(g),r=ensureAttackProgress(g),high=s.tier>=2&&r.rank>=3,reach=high?(s.tier===3?140:120):92,width=high?(s.tier===3?55:45):s.tier===3?40:28,range=s.heroId==='grappler'?(reach+(r.branch==='a'&&high?0:width))*st.area:s.heroId==='rift'?(s.tier===1?350:s.tier===2?(r.branch==='b'?440:350):360):360,target=targetAt(g,s.heroId==='rift'?source(g):p,range),a=target?angle(p,target):facing(g);if(!target){s.clock=.12;return;}
 if(s.heroId==='grappler'){grappleBasic(g,a,target,api);s.clock=(s.tier>=2&&ensureAttackProgress(g).rank>=3?(s.tier===3?.44:.48):.62)/st.attackSpeed;}else if(s.heroId==='rift'){riftBasic(g,a,api);s.clock=(ensureAttackProgress(g).rank>=3?(s.tier===3?.88:.78):(s.tier===3?1.05:.85))/st.attackSpeed;}else magnetBasic(g,a,api);
 p.facing=Math.cos(a)>=0?1:-1;if(!(p.animSource==='skill'&&p.animTime<p.animDuration)){p.anim='attack';p.animTime=0;p.animDuration=.28;p.animSource='auto';p.animFacing=p.facing;}
}
function grappleCast(g,id,a,api){
 const s=g.specialHero,p=g.player,st=getCombatStats(g),geom=getSkillGeometry(g,id),power=st.damage*(1+.15*perk(g,'grappler_impact'));
 if(id==='grappleHook'){
  dropHeld(g);for(const m of s.motions)if(m.kind.startsWith('grab'))release(enemy(g,m.enemyId));s.motions=s.motions.filter(m=>!m.kind.startsWith('grab'));const end=point(p,a,geom.length),width=geom.width+(s.tier>=2?28:0),targets=(g.enemies||[]).filter(alive).filter(e=>!e.specialHeld&&segmentDistance(e,p,end)<=width+(e.radius||18)&&Math.cos(angle(p,e)-a)>0).sort((x,y)=>d2(p,x)-d2(p,y));
  let chosen;if(s.tier===3){const left=targets.find(e=>!heavy(e)&&delta(angle(p,e),a)<=0),right=targets.find(e=>!heavy(e)&&delta(angle(p,e),a)>0);chosen=[left,right].filter(Boolean);}else{const light=targets.find(e=>!heavy(e));chosen=light?[light]:[];}
  fx(g,'grappleHook',{...p,toX:end.x,toY:end.y,angle:a,width,capturedIds:chosen.map(e=>e.id),life:.35,maxLife:.35,radius:width});
  if(chosen.length){for(const e of chosen){const side=s.tier===3?(delta(angle(p,e),a)<=0?-1:1):0;hit(g,api,e,24*st.damage,'active');if(alive(e)){motion(g,e,point(p,a+side*.5,p.radius+e.radius+14),s.tier===2?.38:.28,e=>hold(g,e,a,side),api,s.tier===2?'grabArc':'grab',s.tier>=2?24*st.damage:0);if(s.tier===2){const m=s.motions.at(-1);if(m?.enemyId===e.id)m.curve=(delta(angle(p,e),a)<0?-1:1)*65;}}}}
  else if(targets[0]){const e=targets[0],dist=Math.min(120,Math.max(0,Math.sqrt(d2(p,e))-p.radius-e.radius-48)),to=legalDestination(g,point(p,a,dist),api);if(to&&d2(p,to)>1)motion(g,p,to,.22,()=>physical(g,a,110*st.area,s.tier>=2?44:28,72*st.damage,api),api,'pullSelf');else physical(g,a,110*st.area,32,72*st.damage,api);}
 }else if(id==='grappleSlam'){
  const held=heldEnemies(g);s.heldSlots=[];syncHeld(s);const center=bounded(g,point(p,a,78));
  if(held.length){const slam=e=>{e.specialLift=36;motion(g,e,center,.2,e=>{release(e);hit(g,api,e,70*power,'active');circle(g,e,geom.radius,66*power,api);fx(g,'grappleSlam',{...e,radius:geom.radius});},api,'slam');};if(s.tier===3&&held.length===2){for(let i=0;i<held.length;i++){arc(g,held[i],a+(i?-1:1)*.8,(i?1:-1)*1.6,75,45*power,api,()=>{});s.motions.at(-1).delay=i*.18;}pending(g,.6,()=>{for(const e of held)if(alive(e)&&e.specialHeld)slam(e);});}else for(let i=0;i<held.length;i++){if(s.tier>=2)arc(g,held[i],a+(i?-1:1)*.8,(i?1:-1)*1.6,75,45*power,api,slam);else slam(held[i]);}}
  else{fx(g,'grappleDown',{...center,angle:a,life:.23,maxLife:.23});physical(g,a,105*st.area,s.tier>=2?60:32,48*power,api);pending(g,.23,()=>{circle(g,center,geom.radius,80*power,api);fx(g,s.tier===3?'grappleClash':'grappleSlam',{...center,radius:geom.radius,angle:a,impactOnly:true});});}
 }else if(id==='grappleClash'){
  let victims=heldEnemies(g);if(!victims.length){const e=near(g,p,110*st.area,Infinity).find(e=>!heavy(e)&&!e.specialHeld);if(e)victims=[e];}
  if(victims.length){s.heldSlots=[];syncHeld(s);for(let i=0;i<victims.length;i++){const e=victims[i],launch=e=>throwEnemy(g,e,a+(s.tier===3?(i?-.14:.14):0),api,{delay:s.tier===3?i*.18:0,offset:s.tier===3?i*70:0});if(s.tier===2)arc(g,e,a,Math.PI*2,75,50*power,api,launch,'spin');else{e.specialLift=s.tier===3?65:30;launch(e);}}}
  else if(s.tier===3){for(let i=0;i<2;i++){const delay=.25+i*.22,center=bounded(g,point(p,a,180+i*70));fx(g,'grappleDown',{...center,angle:a,life:delay,maxLife:delay});pending(g,delay,()=>{circle(g,center,geom.radius,100*power,api);fx(g,'grappleSlam',{...center,radius:geom.radius});});}}
  else{physical(g,a,200*st.area,50,100*power,api);if(s.tier===2){circle(g,p,125*st.area,45*power,api);fx(g,'grappleShock',{...p,radius:125*st.area});}}
 }else return null;
 return true;
}
function riftCast(g,id,a,api){
 const s=g.specialHero,p=g.player,st=getCombatStats(g),geom=getSkillGeometry(g,id);
 if(id==='riftGate'){
  if(s.riftHeavy&&s.tier===3&&s.riftHeavy.relocated)return false;const to=bounded(g,point(p,a,geom.length),30);if(api.movementHitsWall?.(p.x,p.y,to.x,to.y,30))return false;
  const gate=makeGate(g,to,a),target=s.tier>=2?near(g,to,70,8).find(e=>e.elite||e.boss):null;if(target){gate.followId=target.id;gate.followTime=2;gate.offsetX=gate.x-target.x;gate.offsetY=gate.y-target.y;}
  s.gates=[gate];s.echoGates=[];s.autoGates=[];if(s.riftHeavy)s.riftHeavy.relocated=true;
  if(s.tier>=2){const from=point(gate,a-Math.PI/2,80),end=point(gate,a+Math.PI/2,80);sweep(g,from,end,22*st.area,55*st.damage,api);fx(g,'riftSweep',{...from,toX:end.x,toY:end.y,angle:a+Math.PI/2,width:22*st.area,radius:80});}
  if(s.tier===3)s.transport={remaining:1.5,count:0,ids:new Set(),angle:a};fx(g,'riftGate',{...gate,radius:30,angle:a});
 }else if(id==='riftStep'){
  const gate=exit(g),wanted=gate||bounded(g,point(p,a,geom.length)),to=legalDestination(g,wanted,api);if(!to)return false;const from={x:p.x,y:p.y};p.x=to.x;p.y=to.y;p.invulnerable=Math.max(p.invulnerable||0,.35+.15*perk(g,'rift_hold'));
  if(s.tier>=2)s.trails.push({...from,remaining:1.5,tick:0,width:68,angle:a,kind:'wall'});
  if(s.tier===3){s.trails.push({...from,remaining:1.1,tick:0,width:80,angle:a,kind:'rift'});s.trails.push({...p,remaining:1.5,tick:0,width:68,angle:a,kind:'wall'});}
  fx(g,'riftStep',{...from,toX:p.x,toY:p.y,angle:a,radius:26,life:.4,maxLife:.4});
 }else if(id==='riftBarrage'){
  if(!exit(g))s.gates=[makeGate(g,point(p,a,80),a,true)];const target=targetAt(g,source(g),geom.length,true),budget=new Map(),duration=1.7+.4*perk(g,'rift_barrage');s.riftHeavy={remaining:duration+.3,relocated:false};
  s.beams=s.beams.filter(b=>b.category!=='active');beam(g,{angle:a,delay:.3,remaining:duration,length:geom.length,width:geom.width,damage:23*st.damage,category:'active',track:s.tier>=2?1.5:0,targetId:target?.id,budget,budgetCap:285*st.damage,heavy:true});
  if(s.tier===3)for(const side of [-1,1])beam(g,{angle:a+side*.35,delay:.3,remaining:duration,length:300,width:18*st.area,damage:12*st.damage,category:'active',track:2.2,side,targetId:target?.id,budget,budgetCap:285*st.damage,heavy:true,age:0});
  fx(g,'riftCharge',{...source(g),radius:70,angle:a,life:.3,maxLife:.3});
 }else return null;
 return true;
}
function closeField(g,api){const s=g.specialHero;if(!(s.fieldTime>0))return;s.fieldTime=0;s.shieldHP=0;if(s.tier===3){const a=s.fieldAngle||facing(g);sweep(g,g.player,point(g.player,a,145),75,30*getCombatStats(g).damage,api);for(const e of near(g,g.player,145))if(!heavy(e)&&!e.specialHeld&&Math.abs(delta(angle(g.player,e),a))<1.2)move(g,e,point(e,a,35),api);fx(g,'magnetRepel',{...g.player,angle:a,radius:130});}}
function magnetCast(g,id,a,api){
 const s=g.specialHero,st=getCombatStats(g),geom=getSkillGeometry(g,id);
 if(id==='magnetField'){s.fieldTime=Math.min(4,geom.duration);s.fieldCaptured=0;s.fieldAngle=a;s.fieldRadius=geom.radius;s.shieldHP=40+(s.tier-1)*20;if(s.scraps.length>=ammoCap(g))closeField(g,api);fx(g,'magnetField',{...g.player,angle:a,radius:geom.radius});}
 else if(id==='magnetLance'){
  const count=consumeAmmo(g);if(s.tier===3&&s.armorTime>0){const heat=s.heat;s.heat=0;s.armorTime=0;s.gunMode='cannon';s.gunTime=.5;gunShot(g,a,95+heat*8,api,{pierce:10,style:'magnetCannon',burst:80,fragments:count,category:'active'});}
  else{const shots=s.tier===3?Math.min(5,2+Math.ceil(count/2)):1;for(let i=0;i<shots;i++)pending(g,i*.14,()=>gunShot(g,a,62,api,{style:s.tier===1?'magnetGrenade':'magnetDrill',pierce:s.tier===1?1:8,distance:geom.length,width:geom.width,burst:60+12*perk(g,'magnet_press'),fragments:i===0?count:0,category:'active'}));}
 }else if(id==='magnetCrush'){const count=consumeAmmo(g);s.armorTime=4*st.duration;s.heat=Math.min(6,count);s.clock=0;s.gunMode='armor';s.gunTime=s.armorTime;fx(g,'magnetAssemble',{...g.player,radius:55+s.tier*12,angle:a,life:.55,maxLife:.55});}
 else return null;
 return true;
}
export function castSpecialHero(g,id,aim,api){if(g.phase!=='playing'||g.player.hp<=0)return null;const s=ensureSpecialHero(g);if(!s)return null;const a=aimAngle(g,aim);let result;if(id.startsWith('grapple')&&s.heroId==='grappler')result=grappleCast(g,id,a,api);else if(id.startsWith('rift')&&s.heroId==='rift')result=riftCast(g,id,a,api);else if(id.startsWith('magnet')&&s.heroId==='magnet')result=magnetCast(g,id,a,api);else return null;if(result)fx(g,id,{shape:'sound',...g.player,radius:0,sound:s.heroId==='grappler'?'groundSlam':id==='riftStep'?'teleport':'orb',life:.12,maxLife:.12});return result;}
// Actual attacker coordinates are required; hazards and Boss mechanics bypass finite shields.
export function absorbSpecialHeroDamage(g,amount,attacker){const s=g.specialHero;if(!s||g.phase!=='playing'||!attacker||immovable(attacker)||attacker.mechanic||attacker.hazard||attacker.kind==='laneShell'||attacker.source==='mechanic')return amount;
 const a=angle(g.player,attacker);if(s.heroId==='grappler'){const slot=s.heldSlots.find(h=>alive(enemy(g,h.enemyId))&&h.hp>0&&h.blocks>0&&Math.abs(delta(a,h.angle))<1);if(slot){const absorbed=Math.min(amount,slot.hp);slot.hp-=absorbed;slot.blocks--;fx(g,'grappleBlock',{...enemy(g,slot.enemyId),radius:32});if(slot.hp<=0||slot.blocks<=0){release(enemy(g,slot.enemyId));s.heldSlots=s.heldSlots.filter(h=>h!==slot);syncHeld(s);}return amount-absorbed;}}
 if(s.heroId==='magnet'&&s.fieldTime>0&&s.shieldHP>0&&(s.tier>=2||Math.abs(delta(a,s.fieldAngle))<1)){const n=Math.min(amount,s.shieldHP);s.shieldHP-=n;if(s.shieldHP<=0)s.closeFieldRequested=true;fx(g,'magnetBlock',{...g.player,angle:a,radius:36});return amount-n;}return amount;
}
export function captureSpecialProjectile(g,shot,from,to){const s=g.specialHero;if(!s||g.phase!=='playing'||shot.hit||shot.kind!=='enemyOrb'||shot.boss||shot.mechanic||shot.hazard)return false;
 if(s.heroId==='grappler'){for(const h of s.heldSlots){const e=enemy(g,h.enemyId);if(e&&segmentDistance(e,from,to)<=e.radius+(shot.radius||0)&&Math.abs(delta(angle(g.player,from),h.angle))<1){const damage=shot.damage||10,remain=absorbSpecialHeroDamage(g,damage,from);if(remain<damage){shot.damage=remain;if(remain===0){shot.hit=true;return true;}}}}return false;}
 if(s.heroId!=='magnet'||s.fieldTime<=0||s.shieldHP<=0||s.scraps.length>=ammoCap(g))return false;const radius=getSkillGeometry(g,'magnetField').radius;
 if(segmentDistance(g.player,from,to)>radius+(shot.radius||0)||(s.tier===1&&Math.abs(delta(angle(g.player,from),s.fieldAngle))>1))return false;
 shot.hit=true;s.fieldCaptured++;s.shieldHP=Math.max(0,s.shieldHP-8);s.scraps.push({id:++s.serial,angle:s.serial*2.4,radius:48,charge:1});fx(g,'magnetCapture',{...from,toX:g.player.x,toY:g.player.y,radius:14,life:.3,maxLife:.3});
 if(s.scraps.length>=ammoCap(g)||s.shieldHP<=0)s.closeFieldRequested=true;return true;
}
export function getSpecialHeroAim(g,id,aim={x:1,y:0}){const p=g.player,a=aimAngle(g,aim),geo=getSkillGeometry(g,id),s=g.specialHero;const capsule=(at,to,width)=>({kind:'capsule',...at,toX:to.x,toY:to.y,width,angle:angle(at,to)});
 if(id==='grappleHook')return capsule(p,point(p,a,geo.length),geo.width+(specialHeroTier(g)>=2?28:0));
 if(id==='grappleSlam')return {kind:'circle',...bounded(g,point(p,a,78)),radius:geo.radius};
 if(id==='grappleClash')return capsule(p,point(p,a,specialHeroTier(g)===3?250:240),32);
 if(id==='riftGate')return {kind:'circle',...bounded(g,point(p,a,geo.length),30),radius:30};
 if(id==='riftStep'){const gate=s?.gates?.find(v=>v.remaining>0);return capsule(p,gate||bounded(g,point(p,a,geo.length),p.radius),30);}
 if(id==='riftBarrage'){const at=s?.gates?.find(v=>v.remaining>0)||bounded(g,point(p,a,80));return {kind:'gates',...p,radius:30,gates:[{...at,angle:a,length:geo.length,width:geo.width}]};}
 if(id==='magnetField')return {kind:'circle',...p,radius:geo.radius,angle:a};
 if(id==='magnetLance')return capsule(p,point(p,a,geo.length),geo.width);
 if(id==='magnetCrush')return {kind:'circle',...p,radius:65};return null;
}
function explodeBolt(g,b,api,at=b){if(b.evoTerminal&&b.lastActualHit)at=b.lastActualHit;if(b.exploded)return;b.exploded=true;if(b.burst){if(b.evolved&&g.specialHero.evolution){for(const e of near(g,at,b.burst,Infinity))evolutionDamage(g,e,b.damage*.45,api,g.specialHero.evolution);}else circle(g,at,b.burst,b.damage*.45,api,b.category);fx(g,b.style.startsWith('rift')?'riftImpact':'magnetExplosion',{...at,radius:b.burst});}
 if(b.axialFragments){for(let i=-1;i<=1;i++){const atSide=point(at,b.angle+Math.PI/2,i*16);addBolt(g,{...atSide,angle:b.angle,speed:480,distance:110,damage:b.damage*.25,pierce:2,width:6,style:'magnetShard',category:b.category});}}
 if(b.fragments||b.split){const count=b.fragments?Math.min(8,b.fragments):2;for(let i=0;i<count;i++)addBolt(g,{x:at.x,y:at.y,angle:b.angle+(i-(count-1)/2)*.32,speed:480,distance:135,damage:b.damage*.3,pierce:2,width:6,style:b.style.startsWith('rift')?'riftShard':'magnetShard',category:b.category});}
 if(b.returnBurst){const atCopy={x:at.x,y:at.y};pending(g,.18,()=>{circle(g,atCopy,48,b.damage*.6,api,b.category);fx(g,'riftImpact',{...atCopy,radius:48});});}
 if(b.ground)g.specialHero.trails.push({x:at.x,y:at.y,remaining:.7,tick:0,width:48,kind:'metal',damage:b.damage*.18,category:b.category});
}
function boltsUpdate(g,dt,api){const s=g.specialHero,live=s.bolts;s.bolts=[];for(const b of live){let remaining=dt;for(let part=0;part<2&&remaining>0&&b.life>0;part++){const from={x:b.x,y:b.y},step=Math.min(remaining,b.life);b.x+=b.vx*step;b.y+=b.vy*step;b.life-=step;remaining-=step;
  if(b.phase!=='entry'){const candidates=(g.enemies||[]).filter(alive).filter(e=>segmentDistance(e,from,b)<=b.width+(e.radius||18)).sort((a,c)=>d2(a,from)-d2(c,from));for(const e of candidates){if(b.hitIds.size>=b.pierce||b.hitIds.has(e.id))continue;b.hitIds.add(e.id);b.lastActualHit={x:e.x,y:e.y};if(b.evolved&&s.evolution)evolutionDamage(g,e,b.damage,api,s.evolution);else hit(g,api,e,b.damage,b.category);fx(g,b.style.startsWith('rift')?'riftImpact':'magnetImpact',{...e,radius:24});
   if(b.heat)s.heat=Math.min(8,s.heat+.6);if(b.drillElite&&(e.elite||immovable(e))){b.drillElite=false;circle(g,e,45,b.damage*.45,api,b.category);fx(g,'magnetExplosion',{...e,radius:45});}if(b.heavyNext){s.gunMode='cannon';s.gunTime=.35;pending(g,.12,()=>gunShot(g,b.angle,48,api,{style:'magnetCannon',pierce:8}));b.heavyNext=false;}
   if(b.shell&&heavy(e)){b.shell=false;circle(g,e,50,b.damage*.35,api,b.category);fx(g,'magnetExplosion',{...e,radius:50});}
   if(b.marks||b.drill){const old=s.marks.get(e.id)||{count:0,remaining:3,drill:false};if((b.marks&&old.count>=3)||(b.drill&&old.drill)){hit(g,api,e,b.damage*.75,'basicSecondary');s.marks.delete(e.id);fx(g,'magnetExplosion',{...e,radius:40});}else s.marks.set(e.id,{count:old.count+1,remaining:3,drill:b.drill});}
   if(b.burst&&!b.ground&&b.pierce<=2)explodeBolt(g,b,api,e);
  }if(b.hitIds.size>=b.pierce)b.life=0;}
  if(b.life<=1e-8&&b.phase==='entry'){const gate=s.gates.find(v=>v.id===b.exitId);if(gate){b.x=gate.x;b.y=gate.y;b.vx=Math.cos(b.exitAngle)*b.speed;b.vy=Math.sin(b.exitAngle)*b.speed;b.angle=b.exitAngle;b.life=b.exitDistance/b.speed;b.phase='flight';}else b.life=0;}
 }if(b.life>0)s.bolts.push(b);else if(b.phase!=='entry')explodeBolt(g,b,api);}if(s.bolts.length>48)s.bolts=s.bolts.slice(-48);}
function beamsUpdate(g,dt,api){const s=g.specialHero;for(const b of s.beams){if(b.delay>0){b.delay-=dt;continue;}b.remaining-=dt;if(b.remaining<0)continue;b.age=(b.age||0)+dt;const origin=source(g),at=b.side?point(origin,b.angle+b.side*Math.PI/2,32):origin,preferred=enemy(g,b.targetId),main=preferred&&d2(at,preferred)<=(b.length+(preferred.radius||18))**2?preferred:targetAt(g,at,b.length,b.branch==='b'||b.heavy),neighbors=b.side?near(g,at,b.length,Infinity).filter(e=>e!==main):[];let target=b.side?(neighbors[b.side===-1?0:1]||neighbors[0]||main):main;
  if(b.coverage){if(!enemy(g,b.coverageTarget)||(b.age>=(b.nextLane||0)&&Math.abs(delta(angle(origin,enemy(g,b.coverageTarget)),b.angle))<.2)){const pool=near(g,origin,b.length,Infinity).filter(e=>!e.specialHeld),last=enemy(g,b.coverageTarget),other=pool.find(e=>e!==last&&(!last||Math.abs(delta(angle(origin,e),angle(origin,last)))>.4));b.coverageTarget=(other||pool[0])?.id;b.nextLane=b.age+.26;}target=enemy(g,b.coverageTarget)||target;}
  if(b.track&&target)b.angle+=clamp(delta(angle(at,target),b.angle),-b.track*dt,b.track*dt);let a=b.angle;if(b.branch==='a'&&s.tier===3&&!b.heavy)a+=Math.sin((.7-b.remaining)*7)*.4;
  b.tick-=dt;if(b.tick>0)continue;if(b.side&&Math.floor(b.age/.22)%2!==(b.side===-1?0:1))continue;b.tick=b.pulse&&b.remaining<.3?.08:.13;const end=point(at,a,b.length),struck=sweep(g,at,end,b.width,b.damage,api,new Set(),b.category,b.budget,b.budgetCap);if(struck.size){const e=enemy(g,[...struck].at(-1));if(e)b.lastHit={x:e.x,y:e.y};}fx(g,'riftBeam',{...at,toX:end.x,toY:end.y,width:b.width,radius:b.width,angle:a,beamId:b.id,heavy:b.heavy,side:b.side,life:.16,maxLife:.16});
  if(b.pulse&&b.remaining<.3&&b.branch!=='b'){const neighbor=near(g,end,140,5).find(e=>e!==main);if(neighbor){const tip=point(at,angle(at,neighbor),b.length);sweep(g,at,tip,b.width,b.damage*.45,api,new Set(),b.category,b.budget,b.budgetCap);fx(g,'riftBeam',{...at,toX:tip.x,toY:tip.y,width:b.width*.65,angle:angle(at,neighbor),life:.13,maxLife:.13});}}
  if(b.remaining<=.14&&!b.ended){b.ended=true;if(b.burst&&b.lastHit){circle(g,b.lastHit,b.burst,b.damage*.7,api,b.category,b.budget,b.budgetCap);fx(g,'riftImpact',{...b.lastHit,radius:b.burst});}if(b.refract){const from=point(end,a-Math.PI/2,65),to=point(end,a+Math.PI/2,65);sweep(g,from,to,b.width,b.damage*.7,api,new Set(),b.category,b.budget,b.budgetCap);fx(g,'riftBeam',{...from,toX:to.x,toY:to.y,width:b.width,angle:a+Math.PI/2,life:.2,maxLife:.2});}if(b.branch==='b'&&s.tier===3&&main&&segmentDistance(main,at,end)<=b.width+(main.radius||18))hit(g,api,main,b.damage*2,b.category,b.budget,b.budgetCap);}
 }s.beams=s.beams.filter(b=>b.remaining>0);}
// Final weapons own a small, persistent set of arms, rays, and mortar bodies.
// Ordinary enemies use real geometric hits; only bosses share a finite time-window budget.
function evolutionDamage(g,e,n,api,v){if(e.specialHeld)return;if(immovable(e))hit(g,api,e,n,'basic',v.bossBudget,260*getCombatStats(g).damage);else hit(g,api,e,n,'basic');}
function evolutionSweep(g,from,to,width,n,api,v,ids=null){const targets=(g.enemies||[]).filter(alive).filter(e=>!ids?.has(e.id)&&segmentDistance(e,from,to)<=width+(e.radius||18)).sort((a,b)=>d2(a,from)-d2(b,from));for(const e of targets){ids?.add(e.id);evolutionDamage(g,e,n,api,v);}return targets;}
function evolvedWeapon(g,dt,api){const s=g.specialHero,r=ensureAttackProgress(g);if(s.tier!==3||r.rank!==4){s.evolution=null;return false;}const st=getCombatStats(g),p=g.player,a=facing(g),branch=r.branch||'a';
 if(!s.evolution||s.evolution.branch!==branch)s.evolution={branch,time:0,cycle:-1,bossClock:0,bossBudget:new Map(),arms:[],gunClock:0,heavyClock:0,mortars:[],rayClock:0,refractionClock:0};
 const v=s.evolution;v.time+=dt;v.bossClock-=dt;if(v.bossClock<=0){v.bossClock=.8;v.bossBudget.clear();}
 if(s.heroId==='grappler'){
  const period=(branch==='a'?1.2:.85)/st.attackSpeed,cycle=Math.floor(v.time/period),q=v.time/period-cycle,stage=q<.25?0:q<.7?1:2,target=targetAt(g,p,(branch==='a'?320:410)*st.area);
  if(cycle!==v.cycle){v.cycle=cycle;v.angle=target?angle(p,target):v.angle??a;v.arms=[-1,1].map((side,i)=>({side,ids:new Set(),stage:-1,last:null,inner:branch==='a'&&i===1}));}
  for(const arm of v.arms){if(stage!==arm.stage){arm.stage=stage;arm.ids.clear();}const reach=(arm.inner?160:branch==='a'?290:390)*st.area,extend=stage===0?q/.25:stage===1?1:1-(q-.7)/.3,theta=branch==='a'?v.angle+(arm.side===1?Math.PI:0)+(stage===1?(q-.25)/.45*Math.PI*2:stage===2?Math.PI*2:0):v.angle+arm.side*(.04+(stage===1?.03*Math.sin((q-.25)/.45*Math.PI):0)),at=point(p,theta,55+(reach-55)*extend);at.x-=Math.sin(v.angle)*arm.side*20;at.y+=Math.cos(v.angle)*arm.side*20;
   if(arm.last)evolutionSweep(g,arm.last,at,(arm.inner?32:42)*st.area,(arm.inner?80:100)*st.damage,api,v,arm.ids);arm.shaftWidth=14*st.area;evolutionSweep(g,p,at,arm.shaftWidth,(arm.inner?80:100)*st.damage,api,v,arm.ids);arm.last={...at};arm.x=at.x;arm.y=at.y;arm.angle=theta;arm.reach=reach;arm.width=(arm.inner?32:42)*st.area;
  }
 }else if(s.heroId==='rift'){
  let gate=exit(g);if(!gate){const target=targetAt(g,p,520),out=target?angle(p,target):a;gate=makeGate(g,bounded(g,point(p,out,220),30),out,true);s.gates=[gate];}s.riftEntryAngle=angle(p,gate);v.rayClock-=dt;v.refractionClock-=dt;
  if(v.rayClock<=0){v.rayClock=Math.max(.045,(branch==='a'?.1:.16)/st.attackSpeed);const far=near(g,gate,branch==='a'?500:620,Infinity),first=far[0],second=first?far.find(e=>Math.abs(delta(angle(gate,e),angle(gate,first)))>.55):null,nearby=near(g,p,220*st.area,Infinity),close=nearby[0],other=close?nearby.find(e=>Math.abs(delta(angle(p,e),angle(p,close)))>.65):null;
   const ray=(from,e,length,width,n,id)=>{if(!e)return;const theta=angle(from,e),to=point(from,theta,length),struck=evolutionSweep(g,from,to,width,n*st.damage,api,v);fx(g,'riftBeam',{...from,toX:to.x,toY:to.y,width,radius:width,angle:theta,beamId:id,life:v.rayClock+.03,maxLife:v.rayClock+.03,heavy:branch==='b'});if(branch==='b'&&id==='evolved-rift-far'&&v.refractionClock<=0&&struck.length){const impact=struck.at(-1),left=point(impact,theta-Math.PI/2,105*st.area),right=point(impact,theta+Math.PI/2,105*st.area);evolutionSweep(g,left,right,25*st.area,85*st.damage,api,v);fx(g,'riftBeam',{...left,toX:right.x,toY:right.y,width:25*st.area,angle:theta+Math.PI/2,life:.18,maxLife:.18});v.refractionClock=.55/st.attackSpeed;}};
   const nearAngle=close?angle(p,close):angle(p,gate),entry=point(p,nearAngle,30);s.riftEntryAngle=nearAngle;ray(entry,close,220*st.area,branch==='a'?26*st.area:40*st.area,70,'evolved-rift-entry');if(branch==='a'&&other)ray(entry,other,220*st.area,26*st.area,70,'evolved-rift-entry-side');
   ray(gate,first,branch==='a'?500:620,(branch==='a'?28:38)*st.area,branch==='a'?65:105,'evolved-rift-far');if(branch==='a'&&second)ray(gate,second,500,28*st.area,65,'evolved-rift-far-side');
  }
 }else{
  v.gunClock-=dt;v.heavyClock-=dt;const range=branch==='a'?520:620,target=targetAt(g,p,range),base=target?angle(p,target):a;
  if(target&&v.gunClock<=0){v.gunClock=Math.max(.055,(branch==='a'?.14:.16)/st.attackSpeed);for(const side of [-1,1]){const from=point(p,base+side*Math.PI/2,18),foe=branch==='a'?(sideTarget(g,p,base,side,range)||target):target,out=branch==='b'?base:angle(from,foe);gunShot(g,out,branch==='a'?34:40,api,{...from,basicSide:side,pierce:6,distance:range,width:10*st.area,heat:true,evolved:true});}}
  if(target&&v.heavyClock<=0){v.heavyClock=(branch==='a'?.7:.65)/st.attackSpeed;if(branch==='a'){const outer=near(g,p,520,Infinity).filter(e=>d2(p,e)>120**2),one=outer[0]||target,two=outer.find(e=>Math.abs(delta(angle(p,e),angle(p,one)))>.5),targets=[one,two].filter(Boolean);for(let i=0;i<targets.length&&v.mortars.length<4;i++){const side=i?-1:1;v.mortars.push({from:point(p,base+side*Math.PI/2,30),to:bounded(g,targets[i],20),elapsed:0,duration:.32,radius:100*st.area,damage:145*st.damage,side});}}
   else{gunShot(g,base,135,api,{style:'magnetRail',pierce:20,width:32*st.area,distance:620,burst:85*st.area,evoTerminal:true,evolved:true,category:'basic'});s.gunMode='cannon';s.gunTime=.3;}}
  v.mortars=v.mortars.filter(m=>{m.elapsed+=dt;if(m.elapsed<m.duration)return true;for(const e of near(g,m.to,m.radius,Infinity))evolutionDamage(g,e,m.damage,api,v);fx(g,'magnetExplosion',{...m.to,radius:m.radius});return false;});
 }
 return true;
}
export function updateSpecialHero(g,dt,api){
 if(g.phase==='defeat'||g.phase==='victory'||g.player?.hp<=0){clearSpecialHero(g);return;}if(g.phase!=='playing')return;const s=ensureSpecialHero(g);if(!s)return;dt=clamp(Number(dt)||0,0,.1);const st=getCombatStats(g);
 for(const e of g.enemies||[])if(e.specialHeld&&!alive(e))release(e);
 for(const h of s.heldSlots){const e=enemy(g,h.enemyId);h.remaining-=dt;if(!e||h.remaining<=0||h.hp<=0||h.blocks<=0){release(e);h.remaining=0;}else if(!move(g,e,point(g.player,h.angle+h.side*.5,g.player.radius+e.radius+14),api)){release(e);h.remaining=0;}}
 s.heldSlots=s.heldSlots.filter(h=>h.remaining>0);syncHeld(s);
 const motions=s.motions;s.motions=[];for(const m of motions){const e=m.enemyId===null?g.player:enemy(g,m.enemyId);if(!e)continue;if(m.delay>0){m.delay-=dt;s.motions.push(m);continue;}m.elapsed+=dt;const t=Math.min(1,m.elapsed/m.duration),from={x:e.x,y:e.y},to=m.arc?point(g.player,m.arc.angle+m.arc.span*t,m.arc.r):{x:m.from.x+(m.to.x-m.from.x)*t,y:m.from.y+(m.to.y-m.from.y)*t};if(m.curve){const a=angle(m.from,m.to);to.x-=Math.sin(a)*Math.sin(t*Math.PI)*m.curve;to.y+=Math.cos(a)*Math.sin(t*Math.PI)*m.curve;}
  if(m.enemyId===null&&(unsafe(g,to,api)||api.movementHitsDanger?.(e.x,e.y,to.x,to.y,e.radius)))continue;const ok=move(g,e,to,api);if(m.damage)sweep(g,from,e,20,m.damage,api,m.hitIds,m.category);if(m.kind==='slam')e.specialLift=40*(1-t);if(t>=1||!ok){if(ok)m.done(e);else release(e);}else s.motions.push(m);
 }
 for(const t of s.throws){if(t.delay>0){t.delay-=dt;continue;}const e=enemy(g,t.enemyId);if(!e){t.remaining=0;continue;}const from={x:e.x,y:e.y},step=Math.min(dt,t.remaining),ok=move(g,e,{x:e.x+t.vx*step,y:e.y+t.vy*step},api);t.x=e.x;t.y=e.y;t.remaining-=dt;e.specialLift=Math.max(0,Math.sin((1-t.remaining/.5)*Math.PI)*30);sweep(g,from,e,t.radius,t.damage*.55,api,t.hitIds,t.category);
  if(t.roll&&!t.rolled&&t.hitIds.size>1){t.rolled=true;t.vx=-Math.sin(t.angle)*360;t.vy=Math.cos(t.angle)*360;t.remaining=.18;}
  fx(g,'grappleThrow',{...from,toX:e.x,toY:e.y,width:t.radius,radius:t.radius,angle:t.angle,life:.12,maxLife:.12});
  if(t.remaining<=0||!ok){t.remaining=0;release(e);hit(g,api,e,t.landingDamage??t.damage,t.category);circle(g,e,t.impactRadius??(t.short?55:90)*st.area,(t.landingDamage??t.damage)*.55,api,t.category);fx(g,'grappleSlam',{...e,radius:t.impactRadius??(t.short?55:90)*st.area});if(t.shock){const at={x:e.x,y:e.y};pending(g,.2,()=>{circle(g,at,t.shockRadius??125*st.area,(t.landingDamage??t.damage)*.3,api,t.category);fx(g,'grappleShock',{...at,radius:t.shockRadius??125*st.area});});}}
 }s.throws=s.throws.filter(t=>t.remaining>0);
 const queued=s.pending;s.pending=[];for(const q of queued){q.delay-=dt;if(q.delay<=0)q.fn();else if(s.pending.length<24)s.pending.push(q);}
 for(const gate of s.gates){gate.remaining-=dt;if(gate.followTime>0){gate.followTime-=dt;const target=enemy(g,gate.followId);if(target){const to=bounded(g,{x:target.x+gate.offsetX,y:target.y+gate.offsetY},30);if(!api.movementHitsWall?.(gate.x,gate.y,to.x,to.y,30)){gate.x=to.x;gate.y=to.y;}}}}s.gates=s.gates.filter(v=>v.remaining>0);s.echoGates=[];s.autoGates=[];
 if(s.transport){s.transport.remaining-=dt;const gate=exit(g),entry=point(g.player,s.transport.angle,30);if(gate&&s.transport.remaining>0)for(const e of near(g,entry,28,6)){if(s.transport.ids.has(e.id)||s.transport.count>=3)continue;s.transport.ids.add(e.id);s.transport.count++;if(!heavy(e)){const to=bounded(g,point(gate,gate.angle,50),e.radius);move(g,e,to,api);}hit(g,api,e,36*st.damage,'active');fx(g,'riftImpact',{...e,radius:28});}if(s.transport.remaining<=0)s.transport=null;}
 if(s.riftHeavy){s.riftHeavy.remaining-=dt;if(s.riftHeavy.remaining<=0)s.riftHeavy=null;}
 const evolved=evolvedWeapon(g,dt,api);boltsUpdate(g,dt,api);beamsUpdate(g,dt,api);
 for(const t of s.trails){t.remaining-=dt;t.tick-=dt;if(t.remaining>0&&t.tick<=0){t.tick=.2;if(t.kind==='wall'){for(const e of near(g,t,t.width))if(!heavy(e)&&!e.specialHeld){e.slow=Math.max(e.slow||0,.3);move(g,e,point(e,angle(t,e),10),api);}fx(g,'riftWall',{...t,radius:t.width});}else{circle(g,t,t.width,t.damage||16*st.damage,api,t.category||'active');fx(g,t.kind==='metal'?'magnetExplosion':'riftCollapse',{...t,radius:t.width});}}}s.trails=s.trails.filter(t=>t.remaining>0).slice(-8);
 if(s.fieldTime>0){s.fieldTime-=dt;if(s.fieldTime<=0){s.fieldTime=.001;closeField(g,api);}}if(s.closeFieldRequested){closeField(g,api);s.closeFieldRequested=false;}
 if(s.armorTime>0){s.armorTime=Math.max(0,s.armorTime-dt);if(s.armorTime===0){s.heat=0;s.gunMode='normal';}}s.gunTime=Math.max(0,s.gunTime-dt);if(s.gunTime===0&&s.armorTime===0)s.gunMode='normal';
 for(const [id,m]of s.marks){m.remaining-=dt;if(m.remaining<=0||!enemy(g,id))s.marks.delete(id);}while(s.marks.size>16)s.marks.delete(s.marks.keys().next().value);
 s.clock-=dt;if(s.clock<=0&&(!evolved||(s.heroId==='magnet'&&s.armorTime>0)))basic(g,api);
}
export function specialHeroIdentity(g){const id=g.heroId||g.player?.heroId;if(!SPECIAL_HERO_IDS.includes(id))return null;const s=g.phase==='defeat'||g.phase==='victory'?null:ensureSpecialHero(g);return {name:{grappler:'魔手斗士',rift:'界门术士',magnet:'磁械师'}[id],description:{grappler:'自动拳击，真持敌挡击与投敌破阵；最终进化为巨臂连续伸扫。',rift:'一对界门改变炮口位置，重炮爆发；最终近入口与远出口同时清群。',magnet:'自动枪械与最终重炮，捕弹护身、随身重甲爆发。'}[id],meter:s?.evolution?(id==='grappler'?`巨臂 · ${['伸击','横扫','回收'][s.evolution.arms[0]?.stage]||'就绪'} · 持敌 ${s.heldSlots.length}`:id==='rift'?`双门火线 · ${s.evolution.branch==='a'?'分群双轨':'重炮折射'}`:`常驻炮组 · ${s.evolution.branch==='a'?'穿透枪 / 迫击':'穿透枪 / 长轨'} · 热量 ${Math.floor(s.heat)}`):id==='grappler'?`连拳 ${s?.combo||0}/3 · 持敌 ${s?.heldSlots.length||0}/${s?.tier===3?2:1}`:id==='rift'?`远门 ${s?.gates.length||0}/1${s?.riftHeavy?' · 重火力':''}`:`弹仓 ${s?.scraps.length||0}/${s?ammoCap(g):6}${s?.fieldTime>0?` · 护板 ${Math.ceil(s.shieldHP)}`:''}${s?.armorTime>0?` · 热量 ${Math.floor(s.heat)}/6`:''}`};}
