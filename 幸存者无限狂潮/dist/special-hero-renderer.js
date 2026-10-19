// Render combat-owned weapons with sculpted materials and source-animated contact effects.
export function createSpecialHeroRenderer({ctx,unitAssets,images,drawVfx,drawAtlasLine}){
 const parts=new Map(),replacedPunches=new WeakSet(),TAU=Math.PI*2;
 // Solid weapon bodies use local +X for the actual firing direction.
 function metal(x0,y0,x1,y1,stops){const g=ctx.createLinearGradient(x0,y0,x1,y1);for(const [p,c]of stops)g.addColorStop(p,c);return g;}
 function poly(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
 // Weapon silhouettes remain tied to the real muzzle; bevels and chambers give the assembly weight.
 function sprite(name,x,y,size,a=0,alpha=1){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.scale(size/48,size/48);ctx.globalAlpha=alpha;
  if(name==='plate'){
   poly([[-14,-16],[5,-19],[17,-9],[17,10],[3,19],[-14,12]],'#152b3b');
   poly([[-12,-14],[4,-17],[15,-8],[15,8],[3,16],[-12,10]],metal(0,-16,0,17,[[0,'#d3e6ea'],[.2,'#718e9d'],[.53,'#354c61'],[1,'#101f32']]));
   poly([[-9,-9],[2,-12],[9,-5],[9,6],[1,10],[-9,6]],'#243d50');
   poly([[-8,-9],[2,-12],[9,-5],[3,-3],[-8,1]],'#90a9b4');
   ctx.fillStyle='#e9a851';ctx.fillRect(10,-7,3,14);ctx.fillStyle='#ffedbc';ctx.fillRect(10,-5,1,9);
   ctx.fillStyle='#142d40';for(const yy of [-10,9]){ctx.beginPath();ctx.arc(-9,yy,1.8,0,TAU);ctx.fill();}
  }else{
   poly([[-24,-12],[-5,-15],[5,-10],[18,-9],[24,-6],[24,7],[17,10],[4,10],[-3,14],[-24,11]],'#132633');
   poly([[-23,-10],[-6,-13],[4,-8],[20,-7],[20,7],[4,8],[-4,12],[-23,9]],metal(0,-13,0,12,[[0,'#b9d0d7'],[.16,'#e4edf0'],[.33,'#7899aa'],[.55,'#375268'],[.82,'#182b40'],[1,'#667c87']]));
   poly([[-17,-9],[-5,-11],[2,-7],[2,7],[-5,10],[-17,7]],metal(-17,0,2,0,[[0,'#98653e'],[.45,'#d2a360'],[1,'#624b3c']]));
   ctx.fillStyle='#203746';for(let i=0;i<3;i++)ctx.fillRect(-14+i*5,-6,2,12);
   ctx.fillStyle='#c5d8db';ctx.fillRect(5,-7,13,2);ctx.fillStyle='#b99258';ctx.fillRect(5,-8,3,16);ctx.fillRect(15,-8,3,16);
   ctx.fillStyle='#0c1924';ctx.beginPath();ctx.ellipse(22,0,3.5,7,0,0,TAU);ctx.fill();ctx.fillStyle='#755b42';ctx.beginPath();ctx.ellipse(22,0,1.8,4.5,0,0,TAU);ctx.fill();
   ctx.fillStyle='#dbedf0';ctx.fillRect(-21,-9,3,2);ctx.fillRect(-21,6,3,2);
  }ctx.restore();
 }
 // Layered leather cuff and sculpted knuckles; the open grip retains its gameplay pose.
 function hand(x,y,size,a,alpha=1,open=0,side=1){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.scale(size/48,size/48);ctx.globalAlpha=alpha;
  poly([[-42,-8],[-14,-11],[-9,-6],[-9,8],[-14,12],[-42,8]],metal(0,-12,0,12,[[0,'#a995b0'],[.3,'#75607d'],[.78,'#3b304c'],[1,'#29233b']]));
  ctx.fillStyle='#46354c';for(let i=0;i<3;i++)ctx.fillRect(-38+i*7,-7,2,14);
  poly([[-19,-13],[-9,-14],[-8,13],[-18,12]],metal(0,-14,0,13,[[0,'#fff0b6'],[.23,'#d4ac61'],[.6,'#986232'],[1,'#5d3b29']]));
  poly([[-12,-13],[6,-16],[17,-10],[19,8],[10,15],[-10,12]],'#77492c');
  ctx.beginPath();ctx.moveTo(-11,-10);ctx.quadraticCurveTo(1,-16,10,-11);ctx.quadraticCurveTo(17,-6,15,7);ctx.quadraticCurveTo(9,14,-10,9);ctx.closePath();ctx.fillStyle=metal(-5,-12,10,13,[[0,'#ffe7b7'],[.3,'#e9bb7d'],[.68,'#c68b50'],[1,'#8d542e']]);ctx.fill();
  for(let i=0;i<4;i++){const yy=-12+i*6,ext=8+open*(16-Math.abs(i-1.5)*3);ctx.beginPath();ctx.roundRect(4,yy,ext,5.6,2);ctx.fillStyle=metal(0,yy,0,yy+6,[[0,'#ffe8b6'],[.3,'#f3cf94'],[1,'#a86738']]);ctx.fill();ctx.fillStyle='#ffeec8';ctx.fillRect(7,yy+.7,Math.max(3,ext-6),1);}
  ctx.save();ctx.scale(1,side);ctx.beginPath();ctx.moveTo(-6,7);ctx.quadraticCurveTo(-2,12+open*10,4,12+open*10);ctx.quadraticCurveTo(13,10+open*10,12,6+open*10);ctx.lineTo(6,1);ctx.quadraticCurveTo(1,1,-6,7);ctx.fillStyle=metal(0,2,9,14,[[0,'#ffe1a1'],[.5,'#d49a58'],[1,'#95582d']]);ctx.fill();ctx.restore();
  ctx.fillStyle='#fff1cf';ctx.fillRect(-6,-10,8,1.3);ctx.restore();
 }
 function forearm(x,y,tx,ty,tier,thickness=5+tier){const dx=tx-x,dy=ty-y,length=Math.hypot(dx,dy);if(length<40)return;ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(dy,dx));ctx.globalAlpha=.84;
  const end=Math.max(18,length-23),w=Math.min(19,Math.max(5,thickness)),root=w*.75,wrist=w*.53;
  // A continuous, stretched sleeve narrows into the wrist. Only two bindings articulate it.
  ctx.beginPath();ctx.moveTo(-3,-root);ctx.bezierCurveTo(end*.22,-w,end*.63,-w*.74,end,-wrist);ctx.lineTo(end,wrist);ctx.bezierCurveTo(end*.63,w*.74,end*.22,w,-3,root);ctx.closePath();
  ctx.fillStyle=metal(0,-w,0,w,[[0,'#c2b0c5'],[.15,'#8e7b99'],[.42,'#685477'],[.73,'#44334f'],[1,'#261e37']]);ctx.fill();
  ctx.save();ctx.clip();
  ctx.strokeStyle='#c3aebd';ctx.lineWidth=Math.max(1,w*.1);ctx.globalAlpha=.43;ctx.beginPath();ctx.moveTo(2,-root*.58);ctx.bezierCurveTo(end*.3,-w*.7,end*.65,-w*.53,end,-wrist*.55);ctx.stroke();
  ctx.globalAlpha=.84;
  for(const q of [.14,.79]){const xx=end*q,half=w*(.87-q*.33),band=Math.max(3,Math.min(7,w*.36));ctx.fillStyle=metal(0,-half,0,half,[[0,'#e4cfa4'],[.24,'#b08a53'],[.58,'#795b3b'],[1,'#433626']]);ctx.fillRect(xx,-half,band,half*2);ctx.fillStyle='#f2d5a6';ctx.fillRect(xx,-half,1,half*1.4);}
  ctx.restore();ctx.restore();
 }
 function debris(x,y,r,p,alpha,shock=false){
  // Source animation supplies irregular dust and floor fractures, with a compact contact spark.
  drawVfx('bossSlam',.3+p*.95,x,y+4,Math.min(200,Math.max(72,r*1.25)),{once:true,alpha:alpha*(shock?.65:.82),anchorY:.76,scaleX:1.4,scaleY:.6,tint:'#d7b58d'});
  if(!shock&&p<.65)drawVfx('hitImpact',p*.25,x,y-10,Math.min(92,38+r*.3),{once:true,alpha:alpha*.88,tint:'#ffe0a2'});
 }
 function slipstream(x,y,a,length,alpha,color='#ead2ae'){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha=alpha;ctx.fillStyle=metal(-length,0,0,0,[[0,'#ffffff00'],[.7,color],[1,'#ffffff00']]);for(const side of [-1,0,1]){const yy=side*4;ctx.beginPath();ctx.moveTo(-length,yy);ctx.quadraticCurveTo(-length*.35,yy-2,0,yy);ctx.quadraticCurveTo(-length*.35,yy+2,-length,yy);ctx.fill();}ctx.restore();}
 function gate(x,y,a,size,time,entry=false){ctx.save();ctx.translate(x,y-10);ctx.rotate(a);ctx.scale(size/32,size/32);
  // The recessed aperture is a narrow plane; its thick outer shell survives low-motion mode.
  ctx.fillStyle='#10182b';ctx.beginPath();ctx.ellipse(-3,3,16,32,0,0,TAU);ctx.fill();
  ctx.fillStyle=metal(-16,-24,15,27,[[0,'#c0b9df'],[.25,'#5f659a'],[.53,'#343f70'],[.75,'#151f3c'],[1,'#8c98c3']]);ctx.beginPath();ctx.ellipse(0,0,15,30,0,0,TAU);ctx.fill();
  ctx.fillStyle='#070f24';ctx.beginPath();ctx.ellipse(0,0,10.8,25,0,0,TAU);ctx.fill();
  ctx.save();ctx.beginPath();ctx.ellipse(0,0,10,24,0,0,TAU);ctx.clip();drawVfx('vortex',time,0,0,49,{loop:true,scaleX:.53,alpha:.86,tint:entry?'#b1a5df':'#97d7ed'});ctx.restore();
  ctx.strokeStyle=entry?'#bdb1e7':'#a1e8ff';ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(0,0,11.2,25,0,-Math.PI*.53,Math.PI*.52);ctx.stroke();
  for(const side of [-1,1]){poly([[-4,side*24],[0,side*29],[5,side*24],[1,side*20]],'#d3d5ef');ctx.fillStyle='#86cbeb';ctx.fillRect(-1,side*24-1,2,2);}
  ctx.restore();
 }
 function core(x,y,a,size,time){drawVfx('magicImpact',time%(.39),x,y-17,Math.min(84,Math.max(24,size)),{loop:true,alpha:.65,tint:'#b1e7ff'});}
 function texturedBeam(x,y,tx,ty,w,time,alpha=1,p=.4,reduced=false){
  const dx=tx-x,dy=ty-y,len=Math.hypot(dx,dy);if(len<1)return;const angle=Math.atan2(dy,dx),flash=reduced?0:Math.exp(-p*18),half=Math.max(6,w*.5),tip=Math.min(20,len*.12);
  ctx.save();ctx.translate(x,y-15);ctx.rotate(angle);
  // Stable blue-violet volume follows the actual hit segment; the birth flash broadens briefly.
  ctx.globalAlpha=alpha*(.55+flash*.18);ctx.fillStyle=metal(0,-half*(1+flash*.18),0,half*(1+flash*.18),[[0,'#5b61ad00'],[.16,'#7077cf38'],[.38,'#9299e380'],[.5,'#b2cbebbd'],[.62,'#9299e380'],[.84,'#7077cf38'],[1,'#5b61ad00']]);
  ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(tip,-half*(1+flash*.18),tip*1.5,-half*(1+flash*.18));ctx.lineTo(len-tip,-half*.78);ctx.quadraticCurveTo(len,0,len-tip,half*.78);ctx.lineTo(tip*1.5,half*(1+flash*.18));ctx.quadraticCurveTo(tip,half*(1+flash*.18),0,0);ctx.fill();
  const coreH=Math.max(2.5,half*.33);ctx.globalAlpha=alpha*.74;ctx.fillStyle=metal(0,-coreH,0,coreH,[[0,'#6973c066'],[.27,'#a4b9e7dd'],[.5,'#cceaf2'],[.73,'#a4b9e7dd'],[1,'#6973c066']]);
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(tip,-coreH);ctx.lineTo(len-tip,-coreH*.7);ctx.lineTo(len,0);ctx.lineTo(len-tip,coreH*.7);ctx.lineTo(tip,coreH);ctx.closePath();ctx.fill();ctx.restore();
  drawAtlasLine('beam',time,x,y-15,tx,ty-15,Math.max(8,w),alpha*.5,'#a1baff');
  drawVfx('magicImpact',time,x,y-15,Math.min(72,w*2.1),{loop:true,alpha:alpha*(.54+flash*.2),tint:'#b1d5ff'});
  drawVfx('whiteSpark',time,tx,ty-15,Math.min(56,w*1.6),{loop:true,alpha:alpha*.52,tint:'#b1d5ff'});
 }
 function shards(x,y,r,p,alpha,color,collapse=false){drawVfx(collapse?'vortex':'magicImpact',p*(collapse?1.9:.39),x,y-10,Math.min(180,Math.max(42,r*1.3)),{once:true,alpha:alpha*.8,tint:color});}
 function effect(f,camera,reduced){if(f.shape==='sound')return;const x=f.x-camera.x,y=f.y-camera.y,tx=(f.toX??f.x)-camera.x,ty=(f.toY??f.y)-camera.y,r=f.radius||26,a=f.angle||0,tier=f.tier||1,p=Math.max(0,Math.min(1,1-f.life/(f.maxLife||.28))),time=reduced?.14:p*(f.maxLife||.28),alpha=Math.min(1,f.life/.1);
  if(f.style.startsWith('grapple')){
   if(f.style==='grappleHook'){if(!f.capturedIds?.length){const q=p<.45?p/.45:1-(p-.45)/.55;hand(x+(tx-x)*q,y+(ty-y)*q-14,44+tier*5,a,alpha,p<.5?1:Math.max(0,1-(p-.5)*3));}}
   else if(f.style==='grappleFan'){const span=f.span||Math.PI,theta=a-span/2+span*p;if(!reduced){for(let i=1;i<=2;i++){const prev=theta-i*.2;hand(x+Math.cos(prev)*r*.75,y+Math.sin(prev)*r*.75-12,43,prev,alpha*(.2-i*.05));}}hand(x+Math.cos(theta)*r*.75,y+Math.sin(theta)*r*.75-12,43,theta,alpha);}
   else if(f.style==='grapplePunch'){const heavy=f.combo===3||f.category==='active',side=f.handSide||1,q=p<.4?p/.4:1-(p-.4)/.6,offset=heavy?0:side*13,size=heavy?44+tier*6:31+tier*5;
    if(!reduced&&p<.55){for(let i=1;i<=2;i++){const trailQ=Math.max(0,q-i*.16);hand(x+Math.cos(a)*r*(.22+.53*trailQ)-Math.sin(a)*offset,y+Math.sin(a)*r*(.22+.53*trailQ)+Math.cos(a)*offset-14,size,a,alpha*(.19-i*.055),0,side);}}
    hand(x+Math.cos(a)*r*(.22+.53*q)-Math.sin(a)*offset,y+Math.sin(a)*r*(.22+.53*q)+Math.cos(a)*offset-14,size,a,alpha,0,side);
   }
   else if(f.style==='grappleClash'){if(!f.impactOnly)for(const side of [-1,1])hand(x+Math.sin(a)*30*side*(1-p),y-Math.cos(a)*30*side*(1-p)-14,42+tier*3,a+side*Math.PI/2,alpha);debris(x,y,Math.min(r,55),p,alpha);}
   else if(f.style==='grappleThrow'){if(!reduced)slipstream(x,y-12,a,Math.min(75,Math.hypot(tx-x,ty-y)+35),alpha*.5);}
   else if(f.style==='grappleCollision')drawVfx('hitImpact',p*.25,x,y-14,48+tier*7,{once:true,alpha,tint:'#ffdf9f'});
   else if(f.style==='grappleBlock'){hand(x,y-14,46,a,alpha,0);drawVfx('whiteSpark',p*.417,x+Math.cos(a)*16,y+Math.sin(a)*16-14,52,{once:true,alpha,tint:'#ffe3ac'});}
   else if(f.style==='grappleLift'){hand(x,y-18-22*p,38+tier*3,-Math.PI/2,alpha,.3);}
   else if(f.style==='grappleDown')hand(x,y-14-55*(1-p),44+tier*5,Math.PI/2,alpha);
   else if(f.style==='grappleSlam')debris(x,y,r,p,alpha);
   else if(f.style==='grappleShock')debris(x,y,r,p,alpha,true);
  }else if(f.style.startsWith('rift')){
   if(f.style==='riftBeam'||f.style==='riftSweep')texturedBeam(x,y,tx,ty,f.width||22,time,alpha*(.55+.45*(1-p)),p,reduced);
   else if(f.style==='riftStep'){gate(x,y,a,30,time,true);gate(tx,ty,a,30,time);drawVfx('whiteSpark',p*.417,tx,ty-12,54,{once:true,alpha:alpha*.55,tint:'#9dccff'});}
   else if(f.style==='riftCharge'){drawVfx('vortex',p*1.9,x,y-17,Math.min(135,r*(.55+.35*p)),{once:true,alpha:alpha*.8,tint:'#acdfff'});}
   else if(f.style==='riftWall'){drawVfx('shockNoise',p*.59,x,y-10,Math.min(165,r*1.7),{once:true,alpha:alpha*.72,scaleY:.45,angle:a,tint:'#a3b8e7'});}
   else if(f.style==='riftGate')gate(x,y,a,r,time);
   else shards(x,y,r,p,alpha,f.style==='riftCollapse'?'#a897d6':'#b0e2ff',f.style==='riftCollapse');
  }else if(f.style.startsWith('magnet')){
   if(f.style==='magnetCapture'){sprite('plate',x+(tx-x)*p,y+(ty-y)*p-12,13,a,alpha);}
   else if(f.style==='magnetMuzzle'){const large=['magnetCannon','magnetDrill','magnetRail'].includes(f.boltStyle);drawVfx('fireExplosion',p*.25,x+Math.cos(a)*33,y+Math.sin(a)*33-14,large?52:32,{once:true,angle:a,alpha:alpha*.9,tint:'#ffcd83',scaleY:large?.75:.6});if(f.shoulder)sprite('barrel',x,y-14,34,a,alpha);}
   else if(f.style==='magnetCharge'){sprite('barrel',x+Math.cos(a)*30,y+Math.sin(a)*30-12,50,a,alpha);drawVfx('whiteSpark',p*.417,x+Math.cos(a)*47,y+Math.sin(a)*47-12,28+23*p,{once:true,alpha:alpha*.83,tint:'#ffdb98'});}
   else if(f.style==='magnetAssemble'){for(let i=0;i<4;i++){const theta=i/4*TAU+.4;sprite('plate',x+Math.cos(theta)*(25+r*(1-p)),y+Math.sin(theta)*(18+r*.4*(1-p))-14,27,theta,alpha);}}
   else if(f.style==='magnetField'){/* Actual persistent capture plates are rendered from field state. */}
   else if(f.style==='magnetRepel'){drawVfx('shockNoise',p*.59,x+Math.cos(a)*r*.35,y+Math.sin(a)*r*.35-12,Math.min(170,r*1.2),{once:true,angle:a,scaleY:.55,alpha:alpha*.65,tint:'#f4cc87'});}
   else if(f.style==='magnetBlock'){sprite('plate',x,y-14,44,a,alpha);drawVfx('whiteSpark',p*.417,x,y-14,44,{once:true,alpha,tint:'#ffdc9d'});}
   else if(f.style==='magnetExplosion')drawVfx('fireExplosion',p*.25,x,y-10,Math.min(200,Math.max(65,r*1.5)),{once:true,alpha:alpha*.85,tint:'#ffc987'});
   else drawVfx('hitImpact',p*.25,x,y-12,Math.min(78,32+r*.45),{once:true,alpha:alpha*.9,tint:'#ffdda3'});
  }

 }
 function render(game,camera,reduced,layer){const s=game.specialHero;if(!s)return;const px=game.player.x-camera.x,py=game.player.y-camera.y,time=reduced?.14:game.time,tier=s.tier||1,a=game.player.animFacing<0?Math.PI:0;
  if(layer==='below'){
   if(s.heroId==='rift'){const state=s.gates?.[0];if(state){gate(state.x-camera.x,state.y-camera.y,state.angle,33+tier*3,time);gate(px+Math.cos(s.riftEntryAngle??a)*30,py+Math.sin(s.riftEntryAngle??a)*30,s.riftEntryAngle??a,24,time,true);if(tier>=2||s.riftHeavy)core(state.x-camera.x,state.y-camera.y,state.angle,s.riftHeavy?85:45,time);}}
   return;
  }
  const followup=s.heroId==='grappler'&&(s.motions.some(m=>m.kind!=='push')||s.throws.length||(game.heroEffects||[]).some(e=>e.style==='grappleLift'&&e.life>0));
  const latestBeams=new Map();for(const f of game.heroEffects||[])if(f.beamId&&f.life>0)latestBeams.set(f.beamId,f);
  for(const f of game.heroEffects||[])if(f.visualKind==='newHero'&&f.life>0){
   if(f.beamId&&latestBeams.get(f.beamId)!==f)continue;
   // A third-hit grab replaces its punch pose; drawing both invents a third arm.
   if(f.style==='grapplePunch'&&f.combo===3&&followup)replacedPunches.add(f);
   if(replacedPunches.has(f))continue;
   effect(f,camera,reduced);
  }
  for(const b of s.bolts||[]){const x=b.x-camera.x,y=b.y-camera.y,theta=Math.atan2(b.vy,b.vx);
   if(b.style.startsWith('rift')){const drill=b.style==='riftDrill',shard=b.style==='riftShard',len=drill?42:shard?18:28;
    ctx.save();ctx.translate(x,y);ctx.rotate(theta);poly([[-len*.5,0],[-len*.22,-(drill?7:4)],[len*.5,0],[-len*.22,drill?7:4]],metal(0,-7,0,7,[[0,'#edfaff'],[.35,'#b5d6f4'],[.55,'#8d9ecf'],[1,'#3b477e']]));poly([[-len*.2,-2],[len*.5,0],[-len*.2,1]],'#e4faff');ctx.restore();
    if(!reduced&&b.phase!=='entry')drawAtlasLine('tesla',time,x-Math.cos(theta)*len*.8,y-Math.sin(theta)*len*.8,x,y,drill?6:3,.5,'#a2e2ff');
   }else if(b.style==='magnetGrenade'){ctx.save();ctx.translate(x,y);ctx.rotate(theta);poly([[-8,-6],[5,-7],[10,-2],[10,4],[4,8],[-8,6]],'#513d31');poly([[-6,-5],[4,-6],[8,-1],[7,4],[3,6],[-6,4]],metal(0,-6,0,6,[[0,'#ebc893'],[.4,'#bc8b4c'],[1,'#655035']]));ctx.fillStyle='#c5d7d4';ctx.fillRect(-3,-5,3,10);ctx.fillStyle='#ffe5a7';ctx.fillRect(-2,-3,1,5);ctx.restore();
   }else{const large=['magnetCannon','magnetDrill','magnetRail'].includes(b.style),len=b.style==='magnetRail'?40:large?29:b.style==='magnetShard'?12:17,width=b.evolved?b.width*2:b.style==='magnetCannon'?17:large?10:5;
    ctx.save();ctx.translate(x,y);ctx.rotate(theta);poly([[-len*.5,-width*.45],[len*.22,-width*.45],[len*.5,0],[len*.22,width*.45],[-len*.5,width*.45]],metal(0,-width*.5,0,width*.5,[[0,'#fff6d4'],[.3,b.hot?'#ffc379':'#d6e3e3'],[.7,b.hot?'#e68842':'#9c9b8d'],[1,'#67543b']]));ctx.restore();
    if(!reduced&&large)slipstream(x,y,theta,38,.35,'#ffc789');
   }
  }
  if(s.heroId==='grappler'){
   for(const arm of s.evolution?.arms||[]){forearm(px,py-14,arm.x-camera.x,arm.y-camera.y-14,tier,arm.shaftWidth*2);hand(arm.x-camera.x,arm.y-camera.y-14,arm.inner?58:74,arm.angle,.9);if(!reduced&&arm.stage===1)hand(arm.x-camera.x-Math.cos(arm.angle)*20,arm.y-camera.y-14-Math.sin(arm.angle)*20,arm.inner?58:74,arm.angle,.16);}
   const drawn=new Set(),drawGrip=(e,theta,open=0,size=38)=>{if(!e||drawn.has(e.id))return;drawn.add(e.id);const ex=e.x-camera.x,ey=e.y-camera.y-12-(e.specialLift||0);hand(ex-Math.cos(theta)*20,ey-Math.sin(theta)*20,size,theta,.86,open);};
   for(const m of s.motions||[]){const e=game.enemies.find(e=>e.id===m.enemyId&&e.specialHeld);if(!e||m.kind==='push')continue;const progress=Math.min(1,m.elapsed/m.duration),theta=m.kind==='slam'?Math.PI/2:m.arc?m.arc.angle+m.arc.span*progress:Math.atan2(e.y-game.player.y,e.x-game.player.x);
    if(m.kind.startsWith('grab'))forearm(px,py-14,e.x-camera.x-Math.cos(theta)*20,e.y-camera.y-12-(e.specialLift||0)-Math.sin(theta)*20,tier);
    drawGrip(e,theta,m.kind.startsWith('grab')?Math.max(0,1-progress*2):0,37+tier*3);
    if(!reduced&&m.arc){const prev=theta-Math.sign(m.arc.span)*.2;hand(px+Math.cos(prev)*m.arc.r,py+Math.sin(prev)*m.arc.r-12,37+tier*3,prev,.15);}
    if(m.kind==='slam'&&!reduced)slipstream(e.x-camera.x,e.y-camera.y-15-(e.specialLift||0),Math.PI/2,45,.4);
   }
   for(const h of s.heldSlots||[]){const e=game.enemies.find(e=>e.id===h.enemyId&&e.specialHeld);drawGrip(e,h.angle,0,37+tier*3);}
   for(const t of s.throws||[]){const e=game.enemies.find(e=>e.id===t.enemyId&&e.specialHeld);if(!e)continue;const ex=e.x-camera.x,ey=e.y-camera.y-12-(e.specialLift||0);if(t.delay>0)drawGrip(e,t.angle,0,37+tier*3);else if(!reduced)slipstream(ex,ey,t.angle,53,.4);}
  }
  if(s.heroId==='magnet'){
   for(const m of s.evolution?.mortars||[]){const q=Math.min(1,m.elapsed/m.duration),x=m.from.x+(m.to.x-m.from.x)*q-camera.x,y=m.from.y+(m.to.y-m.from.y)*q-camera.y-(reduced?8:Math.sin(q*Math.PI)*65);sprite('barrel',m.from.x-camera.x,m.from.y-camera.y-14,30,-Math.PI/2,.85);ctx.save();ctx.translate(m.to.x-camera.x,m.to.y-camera.y);ctx.globalAlpha=.45;poly([[-12,0],[0,-6],[12,0],[0,6]],'#dba468');ctx.restore();sprite('plate',x,y,17,Math.atan2(m.to.y-m.from.y,m.to.x-m.from.x),1);}
   const target=(game.enemies||[]).find(e=>!e.dead&&e.hp>0),theta=s.visualAim??(target?Math.atan2(target.y-game.player.y,target.x-game.player.x):a),armor=s.armorTime>0;
   if(tier===3||armor)for(let i=0;i<(armor?6:3);i++){const q=(reduced?0:time*.75)+i/(armor?6:3)*TAU;sprite('plate',px+Math.cos(q)*(armor?39:29),py+Math.sin(q)*20-14,armor?26:23,q);}
   const guns=armor&&tier>=2?3:tier===3&&game.attackProgress?.branch!=='b'?2:1;for(let i=0;i<guns;i++){const side=armor?(i===0?0:i===1?-1:1):guns===2?(i===0?-1:1):0,gunTheta=!armor&&guns===2?(s.basicGunAngles?.[side]??theta):theta,gunOffset=!armor&&guns===2?s.basicGunOffsets?.[side]:null;sprite('barrel',px+Math.cos(gunTheta)*(armor?(side?28:43):27)+(gunOffset?.x??-Math.sin(gunTheta)*side*(armor?27:14)),py+Math.sin(gunTheta)*(armor?(side?28:43):27)+(gunOffset?.y??Math.cos(gunTheta)*side*(armor?27:14))-14,s.gunMode==='cannon'?54:armor?(side?27:36):tier===2?42:32,gunTheta);}
   if(s.heat>0){ctx.save();ctx.translate(px,py-44);for(let i=0;i<6;i++){ctx.fillStyle=i<s.heat?'#ffae58':'#405461';ctx.fillRect(-22+i*8,0,6,7);}ctx.restore();}
   for(let i=0;i<s.scraps.length;i++)sprite('plate',px-21+i*8,py-49,12,Math.PI/2);
   if(s.fieldTime>0){const count=tier>=2?8:3,q=s.fieldAngle,fieldR=s.fieldRadius||65;for(let i=0;i<count;i++){const theta=tier>=2?i/count*TAU:q+(i-1)*.32;sprite('plate',px+Math.cos(theta)*fieldR,py+Math.sin(theta)*fieldR-12,tier===3?26:22,theta);}if(tier===3)for(const offset of [-.25,0,.25])sprite('plate',px+Math.cos(q+offset)*fieldR,py+Math.sin(q+offset)*fieldR-12,34,q+offset);}
   for(const [id,m]of s.marks||[]){const e=game.enemies.find(e=>e.id===id);if(e)sprite('barrel',e.x-camera.x,e.y-camera.y-20,15+m.count*3,Math.PI/2,.75);}
  }
 }
 return {render,destroy(){parts.clear();}};
}
