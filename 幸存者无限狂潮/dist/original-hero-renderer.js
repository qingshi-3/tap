import {originalTier,ORIGINAL_ARMY_KINDS} from './original-heroes.js';
const TAU=Math.PI*2;
export function createOriginalHeroRenderer({ctx,unit,unitAssets,drawVfx,drawAtlasLine}){
 let clock=0,game=null,lastMark=null,markBurst=null;
 const poly=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
 function chip(x,y,size,color){poly([[x,y-size],[x+size*.5,y],[x,y+size],[x-size*.5,y]],color);}
 // Authored textures carry the motion; event progress only times their envelope.
 const durations={cleave:23/18,bossCleave:13/22,dash:8/16,blinkPhase:19/24,vortex:27/14,magicImpact:7/18,fireImpact:7/20,fireGround:1,flameCore:41/18,frost:25/18,whiteSpark:10/24,hitImpact:6/24,summon:26/16};
 function tex(key,x,y,size,p,options={}){return drawVfx(key,Math.min(.98,Math.max(0,p))*(durations[key]||.5),x,y,size,{once:true,...options});}
 function blade(x,y,r,a,alpha=1,knife=false){
 ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha*=alpha;
 const length=knife?Math.min(r,95):r,w=knife?7:Math.min(19,r*.12),metal=ctx.createLinearGradient(0,-w,0,w);
 metal.addColorStop(0,knife?'#55436f':'#274e48');metal.addColorStop(.38,knife?'#c8abde':'#a4dac8');metal.addColorStop(.47,'#f8fffa');metal.addColorStop(.56,knife?'#9d7db7':'#628f80');metal.addColorStop(1,knife?'#372944':'#213f38');
 ctx.fillStyle=metal;ctx.beginPath();ctx.moveTo(3,-w*.5);ctx.lineTo(length*.67,-w);ctx.lineTo(length,0);ctx.lineTo(length*.67,w);ctx.lineTo(3,w*.5);ctx.closePath();ctx.fill();
 ctx.strokeStyle=knife?'#ead6ff':'#dcfff0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(8,-w*.47);ctx.lineTo(length*.67,-w);ctx.lineTo(length,0);ctx.stroke();
 ctx.fillStyle=knife?'#705577':'#866c45';ctx.fillRect(-3,-w-4,6,w*2+8);ctx.fillStyle='#302d32';ctx.fillRect(-20,-3,18,6);
 // Fine etched facets preserve a material body while the white atlas adds motion.
 ctx.strokeStyle=knife?'#715984':'#527d70';ctx.beginPath();ctx.moveTo(20,0);ctx.lineTo(length*.68,0);ctx.stroke();ctx.restore();
 }
 function crescent(x,y,r,a,width,p,color){tex('cleave',x+Math.cos(a)*r*.32,y+Math.sin(a)*r*.32,r*1.75,p,{angle:a,alpha:.65,tint:color});}
 function soulSpear(x,y,tx,ty,p,reduced){
 const a=Math.atan2(ty-y,tx-x),d=Math.hypot(tx-x,ty-y),tip=d*Math.min(1,.25+p*2),length=Math.min(75,d*.7);
 drawAtlasLine('tesla',reduced?.15:clock*.4,x,y,x+Math.cos(a)*tip,y+Math.sin(a)*tip,3,.2,'#8ae4ba');
 ctx.save();ctx.translate(x+Math.cos(a)*tip,y+Math.sin(a)*tip);ctx.rotate(a);
 const g=ctx.createLinearGradient(0,-9,0,9);g.addColorStop(0,'#2f705b');g.addColorStop(.42,'#b9edd4');g.addColorStop(.5,'#f1fff2');g.addColorStop(.6,'#6ab490');g.addColorStop(1,'#285245');ctx.fillStyle=g;
 ctx.beginPath();ctx.moveTo(-length,-3);ctx.lineTo(-22,-4);ctx.lineTo(-28,-10);ctx.lineTo(12,0);ctx.lineTo(-28,10);ctx.lineTo(-22,4);ctx.lineTo(-length,3);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#d7ffe6';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-length,0);ctx.lineTo(12,0);ctx.stroke();ctx.restore();
 drawVfx('magicBolt',reduced?.08:clock*.6,x+Math.cos(a)*(tip-length*.45),y+Math.sin(a)*(tip-length*.45),length*.9,{loop:true,angle:a+Math.PI,alpha:.25,tint:'#a5f0c6'});
 }
 function swordWave(x,y,r,a,p,knife=false){
 // Pointed asymmetric wave: bevelled leading edge and narrow trailing filaments.
 ctx.save();ctx.translate(x,y);ctx.rotate(a);const h=knife?Math.max(16,r*.75):Math.max(25,r),g=ctx.createLinearGradient(-18,0,25,0);
 g.addColorStop(0,'rgba(64,109,99,0)');g.addColorStop(.45,knife?'#68547f':'#558b78');g.addColorStop(.79,knife?'#d3b9f0':'#b4f2d8');g.addColorStop(1,'#f2fff9');ctx.fillStyle=g;
 ctx.beginPath();ctx.moveTo(-20,-h*.83);ctx.bezierCurveTo(10,-h*.46,26,-h*.16,30,0);ctx.bezierCurveTo(26,h*.16,10,h*.46,-20,h*.83);ctx.bezierCurveTo(3,h*.32,12,h*.1,13,0);ctx.bezierCurveTo(12,-h*.1,3,-h*.32,-20,-h*.83);ctx.fill();ctx.restore();
 tex('cleave',x,y,h*1.55,.12+p*.6,{angle:a,alpha:.34,tint:knife?'#dfc6ff':'#c5ffe8'});
 }
 function bolt(x,y,tx,ty,width,color){drawAtlasLine('tesla',clock*.75,x,y,tx,ty,width,.9,color);}
 function fire(x,y,a,length,cone,reduced,opacity=1){const count=Math.min(7,Math.max(2,Math.ceil(length/85)));for(let i=0;i<count;i++){const t=(i+.45)/count,spread=cone?(i%2?1:-1)*.18*t:0,dir=a+spread;drawVfx('flameCore',reduced?.7:clock*.8+i*.19,x+Math.cos(dir)*length*t,y+Math.sin(dir)*length*t,cone?48+length*t*.24:62,{loop:true,angle:dir-Math.PI/2,alpha:opacity*(.8-.27*t)});}}
 function crystals(x,y,r,p,color){tex('frost',x,y,Math.min(320,r*1.9),p,{alpha:.65,tint:color,scaleY:.76});}
 function debris(x,y,r,p,color,count=7){for(let i=0;i<Math.min(count,4);i++){const a=i*2.4,d=r*(.3+.5*p);tex('whiteSpark',x+Math.cos(a)*d,y+Math.sin(a)*d,14+(i%2)*8,p,{alpha:.6,tint:color});}}
 function resource(x,y,soul=false){drawVfx(soul?'flameCore':'blinkPhase',clock*(soul?.55:.2),x,y-9,soul?40:32,{loop:true,alpha:soul?.62:.32,tint:soul?'#a2f6bd':'#80a692',scaleY:.8});}
 function effect(f,c,reduced){const target=f.targetId&&game.enemies?.find(e=>e.id===f.targetId&&!e.dead);const x=(target?.x??f.x)-c.x,y=(target?.y??f.y)-c.y,r=f.radius||35,a=f.angle||0,k=f.visualKind,p=Math.max(0,Math.min(1,1-f.life/f.maxLife)),elapsed=f.maxLife-f.life;ctx.save();ctx.globalAlpha=Math.min(1,f.life/.12)*.85;
 if(k==='commanderSlash'||k==='originalGiantBlade'||k==='originalKnife'){
 const knife=k==='originalKnife',tint=knife?'#e8cfff':'#aaffd9',size=knife?r*1.55:r*1.75;
 // A narrow bright leading cut, then a softer textured wake, never a filled collision sector.
 tex('cleave',x+Math.cos(a)*r*.3,y+Math.sin(a)*r*.3,size,p,{angle:a,scaleY:knife?.32:1,alpha:knife?Math.max(0,1-p/.58)*.8:.8,tint});
 if(p<.66)blade(x,y,knife?r*.72:r*.94,a+(p-.3)*.6,Math.min(1,(.66-p)*4),knife);
 }
 else if(['originalArc','originalLightning','originalElectricFire','originalSoulDrain'].includes(k)){
 const sky=k==='originalLightning',soul=k==='originalSoulDrain',tx=soul||k==='originalElectricFire'?(f.toX??f.x)-c.x:x,ty=soul||k==='originalElectricFire'?(f.toY??f.y)-c.y:y;
 let sx=sky?x:(f.fromX??f.x)-c.x,sy=sky?y-150:(f.fromY??f.y)-c.y;
 if(k==='originalElectricFire'){sx=x;sy=y;if(Math.hypot(tx-x,ty-y)<2){tex('magicImpact',x,y,48,p,{tint:'#b3e9ff',alpha:.7});ctx.restore();return;}}
 if(soul)soulSpear(sx,sy,tx,ty,p,reduced);else bolt(sx,sy,tx,ty,sky?9:5,'#c4edff');
 tex(soul?'magicImpact':'hitImpact',tx,ty,sky?72:43,p,{tint:soul?'#b4f5ce':'#e1f5ff',alpha:.72});
 }
 else if(k==='originalMeteor'){
 const delay=f.impactDelay||.45,key=f.element==='frost'?'frost':f.element==='lightning'?'magicImpact':'fireImpact';
 if(elapsed<delay){const q=elapsed/delay,h=reduced?50:270*(1-q);tex('flameCore',x,y-h,58,.2+q*.35,{tint:f.element==='frost'?'#a1eaff':f.element==='lightning'?'#c3caff':null,angle:Math.PI,alpha:.85});}
 else{const q=Math.min(1,(elapsed-delay)/.42);tex(key,x,y,Math.min(290,r*1.8),q,{alpha:.85});if(f.element==='lightning'&&q<.5)bolt(x,y-180,x,y,9,'#e1e6ff');}
 }
 else if(k==='originalAttackShadow'||k==='originalReturnShadow'){
 ctx.globalAlpha*=k==='originalReturnShadow'?.3:.52;
 unit({x:f.x,y:f.y,kind:f.kind||'hero',radius:21,hp:1,anim:k==='originalAttackShadow'?'attack':'idle',animTime:reduced?.15:elapsed,facing:Math.cos(a)<0?-1:1,visualGhost:true,spiritTint:'#68507e'},f.kind||'hero',c,.85);
 if(k==='originalAttackShadow')tex('cleave',x+Math.cos(a)*r*.3,y+Math.sin(a)*r*.3,Math.min(140,r*1.5),p,{angle:a,scaleY:.32,tint:'#edcfff',alpha:Math.max(0,1-p/.6)*.75});
 else drawVfx('blinkPhase',reduced?.48:clock*.35,x,y-8,58,{loop:true,tint:'#9774bd',alpha:.22});
 }
 else if(k==='originalSpin'||k==='originalTornado'){
 tex('vortex',x,y,Math.min(360,r*1.9),p,{angle:a,alpha:.66,tint:'#b2f7d4',scaleY:.82});
 if(p<.6)tex('cleave',x,y,Math.min(290,r*1.6),p/.6,{angle:a+p*2,alpha:.65,tint:'#e1fff0'});
 }
 else if(k==='originalFireBeam')fire(x,y,a,Math.hypot((f.toX??f.x+Math.cos(a)*r)-f.x,(f.toY??f.y+Math.sin(a)*r)-f.y),false,reduced);
 else if(k==='originalFireCone')fire(x,y,a,r,true,reduced);
 else if(k==='originalFrost')crystals(x,y,r,p,'#c5f3ff');
 else if(k==='originalDeathMark'||k==='originalWound'){
 tex('summon',x,y-28,k==='originalDeathMark'?36:23,.25+p*.38,{tint:'#df9dff',alpha:.75});
 if(k==='originalWound')tex('hitImpact',x,y,38,p,{tint:'#e8caff',alpha:.7});
 }
 else if(k==='originalThundercloud'){drawVfx('vortex',reduced?.5:clock*.25,x,y-108,82,{loop:true,tint:'#68708e',alpha:.28,scaleY:.36});}
 else if(['originalCorpseBlast','originalSoulFire','pactBurst','originalDischarge'].includes(k)){
 tex(k==='originalDischarge'?'magicImpact':'vortex',x,y,Math.min(230,r*1.65),p,{tint:k==='originalDischarge'?'#b7e4ff':'#a4eab8',alpha:.65});
 if(p<.5)tex('hitImpact',x,y,Math.min(78,r),p*2,{tint:'#e5ffee',alpha:.7});
 }
 else if(k==='originalShieldBash'||k==='originalWindWall'){swordWave(x+Math.cos(a)*28,y+Math.sin(a)*28,r*.7,a,p);}
 else if(k==='originalHeal'){tex('magicImpact',x,y-18,48,p,{tint:'#a9ffc4',alpha:.55});}
 else if(k==='originalSmoke'){tex('blinkPhase',x,y-10,Math.min(100,r*1.6),p,{tint:'#75618f',alpha:.45,scaleY:.7});}
 else if(k==='originalDash'||k==='jobBladeLine'||k==='windWave'){
 const tx=(f.toX??f.x)-c.x,ty=(f.toY??f.y)-c.y,d=Math.hypot(tx-x,ty-y);
 if(game.heroId==='summoner'&&d>1)soulSpear(x,y,tx,ty,p,reduced);
 else {const dir=d>1?Math.atan2(ty-y,tx-x):a,t=d>1?Math.min(1,.35+p*2):0,px=x+(tx-x)*t,py=y+(ty-y)*t;
 if(f.shape==='projectile')swordWave(px,py,r,dir,p,game.heroId==='blink');else blade(px,py,game.heroId==='blink'?65:100,dir,Math.min(1,f.life/.16),game.heroId==='blink');
 if(game.heroId==='blink'&&p>.4)tex('blinkPhase',px,py,54,(p-.4)/.6,{tint:'#806193',alpha:.35});}
 }
 else if(k==='originalPin')tex('summon',x,y-10,36,.3+p*.2,{tint:'#bbf2cb',alpha:.7});
 // Fusion bodies are rendered once by state, never by attack events.
 ctx.restore();}
 function render(g,c,reduced,layer){if(game&&game!==g){lastMark=null;markBurst=null;}clock=g.time||0;game=g;const s=g.originalHero;if(!s)return;if(layer==='below'){for(const node of s.stormNodes||[]){drawVfx('magicImpact',reduced?.18:clock*.45,node.x-c.x,node.y-c.y-8,43,{loop:true,tint:node.branch==='a'?'#bdeaff':'#d8c5ff',alpha:.68});drawVfx('vortex',reduced?.5:clock*.23,node.x-c.x,node.y-c.y,80,{loop:true,alpha:.22,tint:'#adbcdf',scaleY:.65});}for(const field of s.iceFields||[]){ctx.save();ctx.globalAlpha=.23;drawVfx('frost',reduced?.7:clock*.3,field.x-c.x,field.y-c.y,270,{loop:true,alpha:.65,scaleY:.65,tint:'#a4dceb'});ctx.restore();}for(const body of s.corpses)resource(body.x-c.x,body.y-c.y,body.soulFire);for(const f of s.flames){if(f.kind==='pit'){ctx.save();ctx.globalAlpha=.45;drawVfx('fireGround',reduced?.45:clock*.7,f.x-c.x,f.y-c.y,145,{loop:true,alpha:.75,scaleY:.6});ctx.restore();}else if(f.kind==='soulFire')resource(f.x-c.x,f.y-c.y,true);else resource(f.x-c.x,f.y-c.y,true);}if(s.returnShadow)effect({...s.returnShadow,visualKind:'originalReturnShadow',radius:35,kind:g.player.kind,life:1,maxLife:1},c,reduced);return;}
 // The mark is a persistent target-bound state, not the lifetime of its initial flash.
 if(g.heroId==='blink'){
 const mark=s.deathMark,target=mark&&g.enemies?.find(e=>e.id===mark.targetId&&!e.dead);
 if(lastMark&&(!mark||mark.targetId!==lastMark.id))markBurst={...lastMark,start:clock};
 if(target){lastMark={id:target.id,x:target.x,y:target.y};const mx=target.x-c.x,my=target.y-c.y-target.radius-18;
 ctx.save();ctx.translate(mx,my);
 // The crossed blades identify a live death mark after the initial flash has faded.
 for(const turn of [-.68,.68]){ctx.save();ctx.rotate(turn);poly([[-4,-14],[0,-20],[4,-14],[3,8],[0,13],[-3,8]],'#351e4d');poly([[-1,-14],[0,-18],[2,-13],[1,7],[-1,10]],'#f0bdff');ctx.fillStyle='#ac66c1';ctx.fillRect(-5,6,10,2);ctx.restore();}
 ctx.restore();
 }else lastMark=null;
 if(markBurst){const age=clock-markBurst.start;if(age>=0&&age<.38){const q=age/.38,bx=markBurst.x-c.x,by=markBurst.y-c.y;
 tex('cleave',bx,by,100,q,{scaleY:.45,tint:'#f2d9ff',alpha:Math.max(0,1-q)*.9});
 tex('blinkPhase',bx,by,68,q,{tint:'#8c63a8',alpha:(1-q)*.45});
 }else markBurst=null;}
 }else{lastMark=null;markBurst=null;}
 if(s.fusion){const f=s.fusion,animation=unitAssets[ORIGINAL_ARMY_KINDS.giant]?.animations.attack,duration=animation?animation.frames.reduce((n,frame)=>n+(frame.duration||1),0)/animation.fps:1,phase=reduced?.4:Math.max(0,Math.min(1,1-f.clock/.85)),foe=g.enemies?.filter(e=>!e.dead&&e.hp>0).sort((a,b)=>Math.hypot(a.x-f.x,a.y-f.y)-Math.hypot(b.x-f.x,b.y-f.y))[0];unit({x:f.x,y:f.y,hp:1,radius:f.radius,anim:'attack',animTime:phase*duration,facing:foe&&foe.x<f.x?-1:1},ORIGINAL_ARMY_KINDS.giant,c,1);}
 if(g.heroId==='summoner'&&g.attackProgress?.rank===4){for(const soldier of g.companions||[]){if(!soldier.originalArmy||soldier.hp<=0)continue;ctx.save();ctx.globalAlpha=.65;chip(soldier.x-c.x,soldier.y-c.y-45,8,g.attackProgress.branch==='a'?'#99d5b2':'#99bfdb');ctx.restore();}}if(s.decoy)effect({...s.decoy,visualKind:'originalAttackShadow',life:1,maxLife:1,kind:g.player.kind},c,reduced);
 if(g.heroId==='commander'&&originalTier(g)===3&&s.momentum>=12&&!(g.heroEffects||[]).some(f=>f.original&&['commanderSlash','originalGiantBlade','originalSpin'].includes(f.visualKind)&&f.life>0)){const foe=g.enemies?.filter(e=>!e.dead&&e.hp>0).sort((a,b)=>Math.hypot(a.x-g.player.x,a.y-g.player.y)-Math.hypot(b.x-g.player.x,b.y-g.player.y))[0],a=foe?Math.atan2(foe.y-g.player.y,foe.x-g.player.x):g.player.facing<0?Math.PI:0;blade(g.player.x-c.x,g.player.y-c.y,130,a,.6);}
 if(s.counter)effect({x:g.player.x,y:g.player.y,visualKind:'originalShieldBash',angle:s.counter.angle,radius:65,life:1,maxLife:1},c,reduced);if(s.iceArmor){ctx.save();ctx.globalAlpha=.55;for(const sign of [-1,1])tex('frost',g.player.x-c.x+sign*21,g.player.y-c.y-5,38,.24,{tint:'#c2efff',alpha:.55,scaleX:.5});ctx.restore();}for(const [id,w]of s.wounds||[]){const e=g.enemies?.find(e=>e.id===id&&!e.dead);if(e){for(let i=0;i<Math.min(3,w.count);i++)chip(e.x-c.x+(i-1)*9,e.y-c.y-33,4,'#d693b4');}}if(s.fire)fire(g.player.x-c.x,g.player.y-c.y,s.fire.angle,originalTier(g)===1?210:520,originalTier(g)===1,reduced,.8);
 for(const w of s.waves||[]){effect({x:w.x,y:w.y,visualKind:w.element==='lightning'?'originalElectricFire':'windWave',angle:w.a,radius:w.width,toX:w.x,toY:w.y,shape:'projectile',life:1-((reduced?.22:clock*.72)%1)*.7,maxLife:1},c,reduced);}const newest=new Map();for(const f of g.heroEffects||[])if(f.original){if(f.visualTrace||f.visualSupplement)continue;if(f.visualKind==='originalFrost'&&f.source&&(g.heroEffects||[]).some(o=>o.original&&o.visualKind==='originalFrost'&&!o.source&&Math.hypot(o.x-f.x,o.y-f.y)<2))continue;if(f.visualKind==='originalDeathMark')continue;if(f.visualKind==='commanderSlash'&&f.element==='fire'||f.visualKind==='pactBurst'&&(['meteor','meteorPit','corpse'].includes(f.source)||f.source==='active'&&s.spin))continue;if(f.visualKind==='commanderSlash'&&f.source==='active'&&(g.heroEffects||[]).some(o=>o.original&&['originalSpin','originalGiantBlade'].includes(o.visualKind)&&Math.hypot(o.x-f.x,o.y-f.y)<2))continue;if(f.visualKind==='originalFireCone'||f.visualKind==='originalFireBeam'&&s.fire&&Math.hypot((f.toX??f.x)-f.x,(f.toY??f.y)-f.y)>400)continue;const sustained=['originalShieldBash','originalWindWall'].includes(f.visualKind);if(!sustained){effect(f,c,reduced);continue;}const key=`${f.visualKind}:${f.targetId||''}:${Math.round(f.x/16)}:${Math.round(f.y/16)}:${Math.round((f.angle||0)*5)}`;const previous=newest.get(key);if(!previous||f.life/f.maxLife>previous.life/previous.maxLife)newest.set(key,f);}for(const f of newest.values())effect(f,c,reduced);
 }
 return {render,destroy(){game=null;lastMark=null;markBurst=null;}};
}
