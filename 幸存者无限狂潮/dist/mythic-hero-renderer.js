// Material and atlas layers follow simulation-owned entities; rendering never advances combat.
const TAU=Math.PI*2;
export function createMythicHeroRenderer({ctx,unit,drawVfx}){
 const palette=[null,['#f6fcff','#728baf','#edbf65'],['#effaff','#698ed4','#f1d487'],['#fffbed','#9278c8','#ffd080']];
 let visualTime=0;
 const fx=(key,t,x,y,size,options={})=>drawVfx?.(key,t,x,y,size,options);
 function shape(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
 function sword(x,y,length,a,tier,alpha=1,phase='',breadth=null){
  ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha*=alpha;
  const w=length*.068,guard=length*.145,bladeStart=-length*.25,tip=length*.52;
  // Attack breadth belongs to translucent wind, never to the steel silhouette.
  fx('magicBolt',visualTime,-length*.12,0,length*1.55,{alpha:.32,scaleY:breadth?Math.min(.8,breadth/length):.19,tint:'#d3eaff',loop:true});
  if(breadth){ctx.save();ctx.globalAlpha*=.12;const wind=ctx.createLinearGradient(-length*.6,0,tip,0);wind.addColorStop(0,'rgba(169,213,255,0)');wind.addColorStop(.65,'#b3d9ff');wind.addColorStop(1,'rgba(235,249,255,0)');ctx.fillStyle=wind;ctx.beginPath();ctx.moveTo(-length*.55,-breadth);ctx.quadraticCurveTo(length*.15,-breadth*.8,tip,0);ctx.quadraticCurveTo(length*.15,breadth*.8,-length*.55,breadth);ctx.closePath();ctx.fill();ctx.restore();}
  const metal=ctx.createLinearGradient(0,-w,0,w);metal.addColorStop(0,'#6b829b');metal.addColorStop(.38,'#d8e4ed');metal.addColorStop(.48,'#ffffff');metal.addColorStop(.52,'#bdcedc');metal.addColorStop(1,'#476179');
  ctx.fillStyle=metal;ctx.beginPath();ctx.moveTo(bladeStart,-w*.78);ctx.lineTo(length*.29,-w*.68);ctx.lineTo(tip,0);ctx.lineTo(length*.29,w*.68);ctx.lineTo(bladeStart,w*.78);ctx.closePath();ctx.fill();
  shape([[bladeStart,-w*.08],[length*.29,-w*.08],[tip,0],[length*.29,w*.1],[bladeStart,w*.1]],'#f6ffff');
  const gold=ctx.createLinearGradient(0,-guard,0,guard);gold.addColorStop(0,'#f9e0a4');gold.addColorStop(.45,'#fff1c3');gold.addColorStop(1,'#9c6d32');ctx.fillStyle=gold;
  ctx.beginPath();ctx.moveTo(-length*.31,-guard);ctx.lineTo(-length*.25,-guard*.9);ctx.lineTo(-length*.22,guard*.9);ctx.lineTo(-length*.29,guard);ctx.closePath();ctx.fill();
  shape([[-length*.47,-w*.46],[-length*.3,-w*.46],[-length*.3,w*.46],[-length*.47,w*.46]],'#263749');
  for(let i=0;i<3;i++)shape([[-length*(.44-i*.043),-w*.5],[-length*(.427-i*.043),-w*.5],[-length*(.427-i*.043),w*.5],[-length*(.44-i*.043),w*.5]],'#b59861');
  shape([[-length*.52,0],[-length*.49,-w*.66],[-length*.455,0],[-length*.49,w*.66]],'#d7b776');
  ctx.restore();
 }
 function petal(x,y,size,a,tier,alpha=1,bud=false){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha*=alpha;const c=tier===3?['#fff4ff','#9670cc','#ffffff']:['#ffe4f3',tier===2?'#aa65cd':'#e760a3','#fff7fb'];if(bud){ctx.fillStyle=c[1];ctx.beginPath();ctx.moveTo(size*.55,0);ctx.bezierCurveTo(size*.15,-size*.42,-size*.5,-size*.32,-size*.46,0);ctx.bezierCurveTo(-size*.5,size*.32,size*.15,size*.42,size*.55,0);ctx.fill();ctx.fillStyle=c[0];ctx.beginPath();ctx.moveTo(-size*.32,0);ctx.quadraticCurveTo(-size*.05,-size*.25,size*.5,0);ctx.quadraticCurveTo(-size*.05,size*.25,-size*.32,0);ctx.fill();shape([[-size*.56,-size*.1],[-size*.36,0],[-size*.56,size*.1]],c[1]);ctx.restore();return;}ctx.fillStyle=c[1];ctx.beginPath();ctx.moveTo(-size*.5,0);ctx.bezierCurveTo(-size*.2,-size*.55,size*.35,-size*.45,size*.55,0);ctx.bezierCurveTo(size*.05,size*.04,-size*.1,size*.34,-size*.5,0);ctx.fill();ctx.fillStyle=c[0];ctx.beginPath();ctx.moveTo(-size*.4,0);ctx.quadraticCurveTo(size*.05,-size*.33,size*.46,-size*.025);ctx.quadraticCurveTo(size*.05,-size*.07,-size*.4,0);ctx.fill();if(bud){for(const side of [-1,1]){ctx.save();ctx.rotate(side*.55);ctx.fillStyle=c[2];ctx.beginPath();ctx.ellipse(0,0,size*.32,size*.1,0,0,TAU);ctx.fill();ctx.restore();}}ctx.restore();}
 function orb(x,y,r,time,tier,alpha=1,grind=false){
  // Giant orbs remain translucent so the held enemies retain readable silhouettes.
  const giant=alpha<1,opacity=giant?alpha*.68:alpha;
  ctx.save();ctx.translate(x,y);ctx.globalAlpha*=opacity;
  const base=ctx.createRadialGradient(-r*.22,-r*.28,r*.08,0,0,r);
  base.addColorStop(0,'#82edff');base.addColorStop(.24,'#4ddaff');base.addColorStop(.62,'#149fc8');base.addColorStop(.87,'#1676a5');base.addColorStop(1,'rgba(37,151,195,.2)');
  ctx.fillStyle=base;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(0,0,r*.96,0,TAU);ctx.clip();
  fx('vortex',time*(grind?1.4:1),0,0,r*2.5,{alpha:.88,loop:true,tint:'#62dfff',angle:time*.8});
  fx('flameCore',time,0,0,r*1.6,{alpha:giant?.22:.28,loop:true,tint:'#b7faff',angle:-time*.6});
  // Broad, tapered ribbons turn around the core rather than reading as a glass highlight.
  ctx.rotate(time*(grind?5.2:4));
  for(let i=0;i<3;i++){ctx.save();ctx.rotate(i*TAU/3);ctx.globalAlpha*=i===0?.9:.68;const ribbon=ctx.createLinearGradient(-r,0,r,0);ribbon.addColorStop(0,'rgba(185,247,255,0)');ribbon.addColorStop(.55,'#d5fcff');ribbon.addColorStop(1,'#60dfff');ctx.fillStyle=ribbon;ctx.beginPath();ctx.moveTo(-r*.84,-r*.16);ctx.bezierCurveTo(-r*.6,-r*.78,r*.35,-r*.96,r*.87,-r*.12);ctx.bezierCurveTo(r*.44,-r*.63,-r*.08,-r*.5,-r*.34,-r*.13);ctx.bezierCurveTo(-r*.05,r*.03,r*.18,r*.05,r*.26,r*.3);ctx.bezierCurveTo(-r*.17,r*.01,-r*.57,r*.12,-r*.84,-r*.16);ctx.fill();ctx.restore();}

  ctx.restore();
  // Fragmented outer wind uses the source animation instead of another opaque disk.
  fx('vortex',time*1.5,r*.02,0,r*(giant?2.65:2.35),{alpha:giant?.55:.36,loop:true,tint:'#87deff',angle:-time*.5});
  if(grind)fx('whiteSpark',time,0,0,r*2.3,{alpha:.5,loop:true,tint:'#d1faff'});
  ctx.restore();
 }
 function slash(x,y,r,a,width,alpha,color){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha*=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,0,r,-width/2,width/2);ctx.arc(-r*.12,0,r*.78,width/2,-width/2,true);ctx.closePath();ctx.fill();ctx.restore();}
 function shadow(x,y,r,alpha=.2){ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle='#193140';ctx.beginPath();ctx.ellipse(x,y,r,r*.28,0,0,TAU);ctx.fill();ctx.restore();}
 function effects(g,camera,reduced,layer){for(const f of g.heroEffects||[]){if(f.visualKind!=='mythicHero'||f.shape==='sound'||f.shape==='projectile'||!(f.life>0))continue;const x=f.x-camera.x,y=f.y-camera.y,r=f.radius||25,a=f.angle||0,tier=f.tier||1,p=Math.max(0,Math.min(1,1-f.life/(f.maxLife||.3))),alpha=Math.min(1,f.life/.12);if(layer==='below')continue;
  if(f.style==='swordSlash'){fx('cleave',p*.85,x,y,r*2.3,{angle:a,alpha:alpha*.85,once:true,tint:'#e2efff'});slash(x,y,r,a,f.width||1.5,alpha*.3,palette[tier][0]);}
  else if(f.style==='swordHit'){fx('whiteSpark',p*.4,x,y,Math.max(35,r*1.5),{angle:a,alpha,once:true,tint:'#fff0c9'});ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha*=alpha;shape([[-15,0],[-3,-3],[0,-14],[3,-3],[15,0],[3,3],[0,14],[-3,3]],'#fff6cf');ctx.restore();}
  // Union body is rendered from its live phase; strike flashes never invent extra swords.
  else if(f.style==='swordUnion')slash((f.toX??f.x)-camera.x,(f.toY??f.y)-camera.y,r,a,1.1,alpha*.45,'#eaf5ff');
  else if(f.style==='spiralBurst'||f.style==='spiralConvergence'){fx('magicImpact',p*.35,x,y,r*2.3,{alpha:alpha*.75,once:true,tint:'#7ddfff'});fx('vortex',p*.75,x,y,r*2.6,{alpha:alpha*(1-p)*.6,once:true,tint:'#a5efff'});}
  else if(f.style==='spiralCross'){fx('cleave',p*.65,x,y,r*2.2,{angle:a,alpha:alpha*.7,once:true,tint:'#78dfff'});for(const side of [-1,1])slash(x,y,r,a+side*Math.PI/2,.65,alpha*.65,'#b6f6ff');}
  else if(f.style==='spiralBlade'){const tx=(f.toX??f.x)-camera.x,ty=(f.toY??f.y)-camera.y;fx('cleave',p*.7,(x+tx)/2,(y+ty)/2,r*2.3,{angle:a,alpha:alpha*.8,once:true,tint:'#a0eaff'});}
  else if(f.style==='petalBurst'){// Bud opening is one flower silhouette, not fake outbound projectiles.
   fx('magicImpact',p*.35,x,y,r*2.4,{alpha:alpha*.55,once:true,tint:'#efb7ff'});for(let i=0;i<5;i++)petal(x,y,r*(.6+p*.3),i*TAU/5,tier,alpha*.65);}
  else if(f.style==='petalPlant'){shadow(x,y,12,alpha*.4);}
  // Sweeps, rain, recall and focus are already represented by their actual entities.
 }}
 function render(g,camera,reduced,layer){const s=g.mythicHero;if(!s)return;const tier=s.tier||1,time=reduced?.24:s.time??g.time;visualTime=time;effects(g,camera,reduced,layer);
  if(layer==='below'){if(s.focus?.remaining>0){const f=s.focus,x=f.x-camera.x,y=f.y-camera.y;fx('swordField',time,x,y,f.radius*2.1,{alpha:.28,loop:true,tint:'#a7c6ff',scaleY:.66});}
   for(const b of s.petals||[])if(b.phase==='planted'||b.phase==='pinned'){const x=b.x-camera.x,y=b.y-camera.y;shadow(x,y+4,12,.3);fx('blinkPhase',time,x,y-5,38,{alpha:.26,loop:true,tint:'#e9b0ff'});petal(x,y-7,30,b.angle,tier,.95);}
   for(const o of s.orbs||[])if(o.large&&o.life>0)shadow(o.x-camera.x,o.y-camera.y+o.radius*.45,o.radius,.23);
   if(s.convergence)shadow(s.convergence.x-camera.x,s.convergence.y-camera.y+s.convergence.radius*.4,s.convergence.radius,.25);return;}
  const u=s.union,evolution=tier===3&&g.attackProgress?.rank===4;
  for(const b of s.swords||[]){if(u&&u.phase!=='gather'&&u.phase!=='split'&&u.gathered)continue;let x=b.x-camera.x,y=b.y-camera.y;if(u?.phase==='split'){const visual=u.splitVisual?.find(v=>v.id===b.id);if(visual){x=visual.x-camera.x;y=visual.y-camera.y;}}
   if(!reduced&&b.trail?.length>1&&!u){ctx.save();ctx.strokeStyle=b.phase==='return'?'#e4c879':'#b9d9ff';ctx.globalAlpha=.28;ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();b.trail.forEach((p,i)=>i?ctx.lineTo(p.x-camera.x,p.y-camera.y):ctx.moveTo(p.x-camera.x,p.y-camera.y));ctx.stroke();ctx.restore();}sword(x,y,evolution?82:38+tier*5,b.angle||0,tier,1,b.phase,evolution?(g.attackProgress.branch==='a'?28:22)*(1+Math.min(4,g.growth?.area||0)*.1):null);}
  if(u&&u.phase!=='gather'&&u.gathered===true&&u.phase!=='split'){const p=Math.max(0,Math.min(1,(u.elapsed-.45)/.35)),origin=u.origin||u.center;const x=origin.x+(u.center.x-origin.x)*p-camera.x,y=origin.y+(u.center.y-origin.y)*p-camera.y;sword(x,y,Math.max(100,u.radius*1.9),u.angle??Math.PI/2,tier,1);}
  for(const o of s.orbs||[])if(o.life>0)orb(o.x-camera.x,o.y-camera.y,o.radius,time,tier,o.evolutionLane?.75:o.large?(o.copy?.46:.64):1,o.phase==='grind');
  for(const group of s.windBlades||[])for(const b of group.blades){fx('cleave',time,b.x-camera.x,b.y-camera.y,group.evolution?74:48,{angle:b.angle,alpha:.45,loop:true,tint:'#e6b6ff'});petal(b.x-camera.x,b.y-camera.y,group.evolution?46:30,b.angle,3,.95);}
  if(s.convergence?.remaining>0){const c=s.convergence;orb(c.x-camera.x,c.y-camera.y-c.height,c.radius,time,tier,.72,true);for(const clone of s.clones||[])if(clone.pushOrb&&!clone.dead&&clone.remaining>0){const b=clone.pushOrb;orb(b.x-camera.x,b.y-camera.y-16,b.radius,time,tier,.9,true);}}
  for(const clone of s.clones||[])if(!clone.dead&&clone.remaining>0){ctx.save();ctx.globalAlpha=.65;unit({...clone,anim:clone.anim||'idle',animTime:clone.animTime??time},clone.kind||`hero_spiral_${clone.heroTier||tier}`,camera,.86);ctx.restore();}
  for(const b of s.petals||[])if(b.phase!=='planted'&&b.phase!=='pinned'){const x=b.x-camera.x,y=b.y-camera.y;fx('magicBolt',time,x,y,b.bud?48:42,{angle:b.angle,scaleY:.42,alpha:.38,loop:true,tint:'#f4ccff'});if(!reduced&&(b.phase==='recall'||b.phase==='autoReturn'))slash(x,y,22,b.angle+Math.PI,.6,.25,'#ffd1ec');petal(x,y,b.bud?35:b.phase==='recall'||b.phase==='autoReturn'?34:28,b.angle,tier,1,b.bud);}
  // The character renderer owns actual airborne height; this attached crown identifies bloom.
  if(s.bloom){const p=g.player,height=p.mythicAirborne?.height||0;fx('vortex',time,p.x-camera.x,p.y-camera.y-height-16,66,{alpha:.3,loop:true,tint:'#eec6ff'});for(const side of [-1,1])petal(p.x-camera.x+side*17,p.y-camera.y-height-18,33,side<0?-2.3:-.8,tier,.8);}
 }
 return {render,destroy(){}};
}





