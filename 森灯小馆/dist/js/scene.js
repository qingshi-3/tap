// Positions are normalized to the authored background, keeping calibration independent of UI.
export const SCENE_LAYOUT = {
  tables: [{x:.335,y:.43},{x:.65,y:.43},{x:.335,y:.575},{x:.65,y:.575},{x:.70,y:.325},{x:.77,y:.325}],
  entrance:{x:.50,y:.91}, kitchen:{x:.415,y:.28}, shop:{x:.27,y:.26},
};
const FILES=['n_merc','n_medic','l_priest','v_scout'];
export function createScene(canvas,{onGuest=()=>{},onArea=()=>{}}={}) {
  const ctx=canvas.getContext('2d');
  const motionReduced=()=>Boolean(state?.settings?.reducedMotion||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const load=src=>{const img=new Image();img.src=new URL(src,import.meta.url).href;return img;};
  const background=load('../assets/restaurant.png');
  const sprites=FILES.map(id=>load(`../assets/guests/${id}.png`));
  const actors=new Map(), particles=[];
  let state=null,derived=null,w=1,h=1,last=0,raf=0,dead=false,clock=0,hit=[],vw=1,vh=1,ox=0,oy=0;
  function resize(){const r=canvas.getBoundingClientRect();vw=Math.max(1,r.width);vh=Math.max(1,r.height);w=h=vh>vw?Math.min(vh,vw*1.45):Math.min(vw,vh);ox=(vw-w)/2;oy=(vh-h)/2;const d=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(vw*d);canvas.height=Math.round(vh*d);ctx.setTransform(d,0,0,d,0,0);ctx.imageSmoothingEnabled=false;}
  function burst(kind='coin'){if(motionReduced())return;for(let i=0;i<10;i++)particles.push({x:w*.5,y:h*.52,vx:(Math.random()-.5)*100,vy:-50-Math.random()*90,life:.8,kind});}
  function update(next,info){state=next;derived=info;for(const g of next.guests){let a=actors.get(g.id);if(!a){const type=String(g.type);const n=({ranger:0,traveler:1,fisher:2,sprite:3})[type]??0;a={x:SCENE_LAYOUT.entrance.x,y:SCENE_LAYOUT.entrance.y,index:n%4,status:g.status,guest:g};actors.set(g.id,a);}if(!motionReduced()&&a.status!=='eating'&&g.status==='eating'){for(let i=0;i<4;i++)particles.push({x:a.x*w,y:a.y*h-35,vy:-35-i*8,vx:(i-1.5)*12,life:.8,kind:'coin'});}a.status=g.status;a.guest=g;a.removed=false;}for(const [id,a] of actors){if(!next.guests.some(g=>g.id===id))a.removed=true;}}
  function rect(x,y,rw,rh,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),rw,rh);}
  function label(text,x,y,color='#fff0c1'){ctx.font='bold 12px "Noto Sans SC",system-ui,sans-serif';ctx.textAlign='center';ctx.fillStyle='#17132b';ctx.fillRect(x-ctx.measureText(text).width/2-7,y-13,ctx.measureText(text).width+14,22);ctx.fillStyle=color;ctx.fillText(text,x,y+2);}
  function food(x,y,time){ctx.fillStyle='#e9d9ad';ctx.beginPath();ctx.ellipse(x,y,13,5,0,0,Math.PI*2);ctx.fill();rect(x-8,y-6,16,6,'#c5783f');rect(x-5,y-9,6,4,'#a9c85b');rect(x+3,y-8,5,4,'#df8157');for(let i=0;i<2;i++){const rise=motionReduced()?6:(time*13+i*8)%19;rect(x-4+i*7,y-11-rise,2,5,'#efdfb277');}}
  function draw(dt){clock+=dt;ctx.clearRect(0,0,vw,vh);rect(0,0,vw,vh,'#0b1821');
    // Extend the same forest behind a bounded portrait crop. The main room stays
    // proportional and all six seating points remain inside the visible crop.
    if(background.complete&&background.naturalWidth){for(let tx=0;tx<vw;tx+=96)for(let ty=0;ty<vh;ty+=96)ctx.drawImage(background,0,0,128,128,tx,ty,96,96);ctx.fillStyle='rgba(5,16,25,.62)';ctx.fillRect(0,0,vw,vh);}
    ctx.save();ctx.translate(ox,oy);
    if(background.complete&&background.naturalWidth)ctx.drawImage(background,0,0,w,h);
    hit=[];
    const reduced=motionReduced();
    // Warm lantern shimmer stays quiet; authored environment remains the dominant visual.
    if(!reduced){const p=.035+Math.sin(clock*2.7)*.009;ctx.fillStyle=`rgba(255,191,89,${p})`;ctx.fillRect(0,0,w,h);}
    const upgrades=state?.upgrades||{};
    // Extra capacity uses the two existing bar stools; no overlapping table guests.
    for(let i=0;i<(derived?.activeStaff?.length||0);i++){
      const positions=[{x:.365,y:.31},{x:.48,y:.305},{x:.69,y:.30},{x:.20,y:.35}];
      const pos=positions[i%4],img=sprites[0],size=w*.11;
      const frame=reduced?0:Math.floor(clock*10+i*2)%14;
      if(img.complete&&img.naturalWidth)ctx.drawImage(img,frame*100,0,100,112,pos.x*w-size/2,pos.y*h-size*.9,size,size*1.12);
    }
    if(upgrades.kitchen){const x=.5*w,y=.263*h;for(let i=0;i<upgrades.kitchen+1;i++){const flame=reduced?0:Math.sin(clock*8+i)*2;rect(x-9+i*6,y-7-flame,4,10+flame,'#ffc65e');rect(x-8+i*6,y-3,2,6,'#fff0a1');}}
    if(upgrades.decor){for(let i=0;i<3+upgrades.decor;i++){const x=(.28+i*.075)*w,y=(.171+Math.sin(i)*.006)*h;rect(x-2,y,4,8,'#ffd36b');rect(x-1,y+1,2,4,'#fff5c5');}}
    if(upgrades.garden){for(let i=0;i<upgrades.garden*2;i++)rect((.77+i*.019)*w,(.85-(i%2)*.018)*h,5,6,'#a0c65c');}
    if(upgrades.sign){rect(.46*w,.716*h,.08*w,.035*h,'#714826');for(let i=0;i<upgrades.sign;i++)rect((.475+i*.018)*w,.724*h,4,8,'#ffd36b');}
    const all=[...actors.entries()].sort((a,b)=>a[1].y-b[1].y);
    for(const [id,a] of all){const g=a.guest;const table=SCENE_LAYOUT.tables[((g.table||0)%6+6)%6];const leaving=a.removed||g.status==='leaving';const target=leaving?SCENE_LAYOUT.entrance:{x:table.x-(g.table>=4?0:.058),y:table.y+.035};const speed=reduced?1:Math.min(1,dt*3.5);a.x+=(target.x-a.x)*speed;a.y+=(target.y-a.y)*speed;if(a.removed&&Math.abs(a.y-target.y)<.01){actors.delete(id);continue;}
      const x=a.x*w,y=a.y*h,sz=Math.min(w*.14,72),img=sprites[a.index];
      ctx.fillStyle='#11101f66';ctx.beginPath();ctx.ellipse(x,y,sz*.24,sz*.07,0,0,7);ctx.fill();
      const walking=Math.abs(a.x-target.x)+Math.abs(a.y-target.y)>.025;const bob=reduced?0:Math.sin(clock*(walking?13:3)+a.index)*(walking?2:.7);
      if(img.complete&&img.naturalWidth){const frame=reduced?0:Math.floor(clock*12)%14;ctx.drawImage(img,frame*100,0,100,112,Math.round(x-sz/2),Math.round(y-sz+bob),sz,sz*1.12);}
      if(!leaving){if(g.status==='waiting'){label('上菜',x,y-sz+3,'#ffd36b');const pat=Math.max(0,Math.min(1,g.patience/(g.patienceMax||18)));rect(x-16,y+5,32,4,'#31263c');rect(x-16,y+5,32*pat,4,pat<.25?'#ff857c':'#b5d786');}else if(g.status==='cooking')label('备餐',x,y-sz+3,'#e8d4ae');if(g.status==='eating')food((table.x+.018)*w,(table.y-.012)*h,clock);hit.push({id,x,y:y-sz*.3,r:Math.max(24,sz*.48)});}
    }
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=80*dt;ctx.globalAlpha=Math.max(0,p.life/.8);rect(p.x-3,p.y-4,6,8,'#f5b84e');rect(p.x-1,p.y-3,2,5,'#ffec9b');ctx.globalAlpha=1;if(p.life<=0)particles.splice(i,1);}
    if(state?.phase==='prep'){const k=SCENE_LAYOUT.kitchen,s=SCENE_LAYOUT.shop;label('菜单',k.x*w,k.y*h);label('采购',s.x*w,s.y*h);}
    ctx.restore();
  }
  function frame(t){if(dead)return;const dt=Math.min(.05,(t-last)/1000||0);last=t;draw(dt);raf=requestAnimationFrame(frame);}
  function click(e){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left-ox,y=e.clientY-r.top-oy;const target=[...hit].reverse().find(g=>Math.hypot(g.x-x,g.y-y)<g.r);if(target){onGuest(target.id);return;}const k=SCENE_LAYOUT.kitchen,s=SCENE_LAYOUT.shop;if(Math.hypot(x/w-k.x,y/h-k.y)<.16)onArea('menu');else if(Math.hypot(x/w-s.x,y/h-s.y)<.16)onArea('shop');}
  canvas.addEventListener('click',click);window.addEventListener('resize',resize);const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(canvas);resize();raf=requestAnimationFrame(frame);
  return {update,resize,burst,destroy(){dead=true;cancelAnimationFrame(raf);observer?.disconnect();window.removeEventListener('resize',resize);canvas.removeEventListener('click',click);}};
}
