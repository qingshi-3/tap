import { ROUTE_PALETTES, INK, rect, sprite, routeMark, routeSymbol, parcelSprite, worker, plant, crate, parcelDataUrl } from './art.js';
import { PIPELINE_LAYOUT, pipelineWorkerPoint, managementView } from './engine.js';
export { parcelDataUrl };

// Only visual anchors move; simulation positions, timing and sprite proportions stay fixed.
const Y_KNOTS=[[120,48],[230,140],[292,238],[348,328],[460,464],[520,520]];
function mapY(value,inverse=false){
  const axis=inverse?1:0,other=1-axis;
  let i=0;
  while(i<Y_KNOTS.length-2&&value>Y_KNOTS[i+1][axis])i++;
  const a=Y_KNOTS[i],b=Y_KNOTS[i+1];
  return a[other]+(value-a[axis])*(b[other]-a[other])/(b[axis]-a[axis]);
}
export const sceneY=value=>mapY(value);
export const worldY=value=>mapY(value,true);

// Fixed 195×260 back buffer: geometry and hit targets share the 390×520 space.
// Static station architecture is cached; live parcels, truck loads and staff never are.
const W=195,H=260,centers=[32.5,97.5,162.5];
let back,backCtx;
const backgrounds=new Map();
const departureAnimations=new WeakMap();
const THEMES=[
  {floor:'#cab58d',seam:'#baa47e',fleck:'#dfc99d',wall:'#d5b788',wallLight:'#f1d6a3',beam:'#8d6251',roof:'#789f8a',road:'#87938a',roadShade:'#71827c'},
  {floor:'#aebbb4',seam:'#9aa9a4',fleck:'#c4cec1',wall:'#abbfba',wallLight:'#d7e0c8',beam:'#547d83',roof:'#698ea5',road:'#7b9299',roadShade:'#647c86'},
  {floor:'#a6a6af',seam:'#92929f',fleck:'#b9bcc3',wall:'#a6a0ba',wallLight:'#d1c2c3',beam:'#62617c',roof:'#727e9c',road:'#666e87',roadShade:'#535e78'},
];
const r=(ctx,x,y,w,h,c)=>rect(ctx,x,y,w,h,c);
function noise(x,y){let n=Math.imul(x+19,374761393)^Math.imul(y+47,668265263);n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0;}
function polygon(ctx,points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}

function backdrop(station){
  if(backgrounds.has(station))return backgrounds.get(station);
  const t=THEMES[station];
  const c=sprite(W,H,ctx=>{
    r(ctx,0,0,W,H,t.floor);
    // Quiet repeating floor material; no animated noise or subpixel coordinates.
    for(let y=75;y<H;y++)for(let x=3;x<W-3;x++){
      const n=noise(x,y);
      if(n%79===0)r(ctx,x,y,1,1,t.fleck);
      else if(n%107===0)r(ctx,x,y,2,1,t.seam);
    }
    for(let y=89;y<H;y+=24){r(ctx,3,y,189,1,t.seam);for(let x=3+(y%48?0:24);x<193;x+=48)r(ctx,x,y,1,24,t.seam);}
    r(ctx,0,0,W,17,station===2?'#9799ad':station===1?'#8dbaae':'#acc59a');
    // The three locations retain their operating layout, but have distinct surroundings.
    if(station===0){
      for(let x=-8;x<195;x+=28){r(ctx,x,0,23,8,'#608b76');r(ctx,x+3,0,17,12,'#729b77');r(ctx,x+6,2,10,2,'#92b487');}
      r(ctx,0,12,W,3,'#e2cc96');
      for(let x=0;x<W;x+=8){r(ctx,x,8,2,6,'#e9d8a9');r(ctx,x,8,2,1,'#faf0c7');}
    }else if(station===1){
      r(ctx,0,0,W,11,'#80b2ba');for(let x=0;x<W;x+=17){r(ctx,x,3+(x%3),10,1,'#b4d3c8');r(ctx,x+4,8,6,1,'#6998ad');}
      r(ctx,0,11,W,5,'#6d8b8d');for(let x=0;x<W;x+=15)r(ctx,x,10,3,6,'#bfcac0');
    }else{
      r(ctx,0,0,W,14,'#646c8e');
      for(let x=0;x<W;x+=13){const h=6+(x%11);r(ctx,x,13-h,10,h,'#777e98');r(ctx,x+2,6,2,3,'#eac887');r(ctx,x+6,3,2,3,'#b4bab6');}
      r(ctx,0,14,W,2,'#b7abb5');
    }
    r(ctx,0,17,W,53,t.road);r(ctx,0,19,W,2,t.roadShade);
    for(let y=21;y<68;y+=9)for(let x=2;x<W;x+=8)if(noise(x,y)%3===0)r(ctx,x,y,2,1,t.roadShade);
    // Loading bays have painted stops and worn wheel tracks, rather than UI outlines.
    for(const cx of centers){r(ctx,cx-24,22,2,44,'#c8c5a1');r(ctx,cx+23,22,2,44,'#c8c5a1');r(ctx,cx-21,61,42,3,'#bdc0a2');for(let y=29;y<61;y+=8){r(ctx,cx-18,y,2,4,t.roadShade);r(ctx,cx+17,y,2,4,t.roadShade);}}
    r(ctx,0,69,W,6,t.beam);r(ctx,0,69,W,2,t.wallLight);r(ctx,0,74,W,2,'#71685c');
    // Cutaway warehouse walls, masonry and warehouse columns.
    r(ctx,0,76,5,184,t.beam);r(ctx,190,76,5,184,t.beam);r(ctx,1,76,2,184,t.wallLight);r(ctx,190,76,2,184,t.wall);
    for(let y=80;y<260;y+=12){r(ctx,0,y,5,1,'#765a50');r(ctx,190,y,5,1,'#765a50');}
    r(ctx,5,76,185,5,t.wall);r(ctx,5,76,185,1,t.wallLight);
    // Dock plate chevrons and steel bollards protect the pedestrian lane.
    for(let d=0;d<3;d++){
      const cx=centers[d];r(ctx,cx-25,77,50,4,'#777664');
      for(let x=cx-24;x<cx+24;x+=8)polygon(ctx,[[x,77],[x+4,77],[x,81],[x-4,81]],'#dbc77d');
      for(const x of [cx-26,cx+24]){r(ctx,x,64,3,10,'#4c5961');r(ctx,x,64,3,5,'#dfbf6c');r(ctx,x,64,3,1,'#ffe5a0');}
    }
    // Shaded overhead trusses keep depth without introducing a full-width panel.
    for(let x=7;x<W;x+=63){r(ctx,x,81,3,43,t.beam);r(ctx,x+1,81,1,43,t.wallLight);r(ctx,x-1,124,5,3,'#6c6b63');}
    // Walking lane and working positions stay clear of the parcel belt.
    for(let x=11;x<187;x+=11)r(ctx,x,151,5,1,station===0?'#ad9975':'#899b97');
    plant(ctx,5,126,station);plant(ctx,177,127,station);
    // Break-time stool, thermos and dispatch ledger; no invented production stock.
    r(ctx,7,114,13,3,'#825e46');r(ctx,8,117,2,8,'#715342');r(ctx,17,117,2,8,'#715342');r(ctx,9,112,8,2,'#c7925c');
    r(ctx,177,111,10,13,'#775a48');r(ctx,176,110,12,2,'#d0ad7b');r(ctx,178,112,1,10,'#ab835c');r(ctx,178,106,5,4,'#e8d5a6');r(ctx,183,106,2,4,'#668a7b');
    // Input conveyor underside and motor housing. Parcels are DOM objects only.
    r(ctx,7,218,181,27,'#3a4b54');r(ctx,9,215,177,28,'#607780');r(ctx,11,219,173,22,'#394d58');
    r(ctx,10,214,175,3,'#d3ccab');r(ctx,10,217,175,2,'#8b9c99');r(ctx,10,241,175,3,'#9aa99d');r(ctx,10,244,175,2,'#526772');
    for(const x of [14,178]){r(ctx,x,246,4,9,'#56666c');r(ctx,x-1,254,7,2,'#3d535d');}
    r(ctx,181,226,9,12,'#9f7657');r(ctx,182,227,7,8,'#cfa66c');r(ctx,183,229,4,4,'#756958');r(ctx,188,230,3,2,'#4e5c5f');
    // A low curb leaves finger room below the machine.
    r(ctx,5,258,185,2,t.beam);
  });
  backgrounds.set(station,c);return c;
}

function truck(ctx,dest,load,departure,time,reducedMotion,express=false,travelOffset=0){
  const p=ROUTE_PALETTES[dest],cx=centers[dest];
  // Roll out only after the simulation has actually dispatched this route.
  ctx.save();ctx.translate(Math.round(cx-22),travelOffset);
  r(ctx,2,63,45,3,'#46535a44');
  for(const x of [0,40]){r(ctx,x,25,5,9,'#343e49');r(ctx,x,49,5,10,'#343e49');r(ctx,x+1,26,2,6,'#647074');r(ctx,x+1,51,2,5,'#647074');}
  // Cab and open cargo bed are authored separately so load is genuinely visible.
  r(ctx,7,16,31,2,INK);r(ctx,4,19,37,14,INK);r(ctx,6,18,33,14,p.main);r(ctx,9,17,27,2,p.light);
  r(ctx,8,21,29,9,'#425d68');r(ctx,9,21,27,2,'#91bab7');r(ctx,11,23,10,5,'#668d98');r(ctx,26,23,8,5,'#668d98');r(ctx,13,23,5,1,'#bbd7cb');
  r(ctx,21,22,2,8,p.dark);r(ctx,8,30,29,3,p.dark);r(ctx,6,20,2,8,p.light);r(ctx,38,20,2,8,p.dark);
  r(ctx,3,24,3,4,p.dark);r(ctx,41,24,2,4,p.dark);
  r(ctx,6,33,34,28,INK);r(ctx,7,33,32,26,'#eee0ba');r(ctx,8,34,30,24,'#c7c9b5');
  r(ctx,8,35,3,21,'#e8e7cc');r(ctx,36,35,2,21,'#9dada5');
  for(let y=37;y<56;y+=5)r(ctx,11,y,24,1,'#aeb7a9');
  r(ctx,8,34,30,3,p.main);
  r(ctx,12,37,22,10,p.dark);r(ctx,12,37,22,1,p.light);r(ctx,13,38,20,8,p.main);
  routeMark(ctx,dest,15,39,1,'#fff3d7');routeSymbol(ctx,dest,25,39,'#fff3d7');
  // Rear loading aperture, its roller door raised above the actual loaded parcels.
  r(ctx,10,48,26,12,'#454b4d');r(ctx,11,49,24,10,'#686b5c');r(ctx,11,49,24,2,'#383f40');
  for(let i=0;i<Math.min(load.length,6);i++)crate(ctx,12+(i%3)*7,55-Math.floor(i/3)*5,dest,7);
  r(ctx,8,59,30,3,'#c4b795');r(ctx,8,59,30,1,'#fff0c3');r(ctx,6,62,34,2,'#69716d');r(ctx,9,61,4,2,'#d97b65');r(ctx,33,61,4,2,'#d97b65');r(ctx,19,61,9,2,'#e4d5ab');
  // Countdown is a cab signal connected to the engine's real departure state.
  r(ctx,34,18,3,2,load.length?'#f5d781':'#a2be91');
  if(express){r(ctx,9,18,6,2,'#eead58');r(ctx,9,17,6,1,'#ffe8a2');}
  if(load.length&&departure<3&&!reducedMotion&&Math.floor(time*3)%2===0){r(ctx,9,61,4,2,'#ffe1a0');r(ctx,33,61,4,2,'#ffe1a0');}
  ctx.restore();
}

function shelf(ctx,dest,queue,capacity){
  const cx=centers[dest],p=ROUTE_PALETTES[dest],x=Math.round(cx-23);
  // Recessed rack: parcels occupy real queue slots, upgrades extend its top tier.
  r(ctx,x+1,119,47,5,'#5e625145');r(ctx,x,84,46,35,'#59696a');r(ctx,x+3,87,40,29,'#8d8b70');
  for(let y=87;y<116;y+=4){
    r(ctx,x+3,y,40,1,'#b2aa84');r(ctx,x+3,y+2,40,1,'#83846b');
    for(let gx=x+6;gx<x+40;gx+=11)r(ctx,gx+(y%3),y+1,4,1,'#9e9b77');
  }
  // Three-dimensional timber braces and the shelf's stamped location holders.
  polygon(ctx,[[x+4,88],[x+7,88],[x+18,99],[x+15,99]],'#b9ad84');
  polygon(ctx,[[x+28,104],[x+31,104],[x+42,115],[x+39,115]],'#b9ad84');
  r(ctx,x+4,87,38,2,'#777b65');r(ctx,x+4,104,38,2,'#777b65');
  r(ctx,x,83,46,3,'#bca17a');r(ctx,x,83,46,1,'#e5d0a0');
  for(const px of [x,x+43]){r(ctx,px,84,3,39,p.dark);r(ctx,px,84,1,37,p.light);for(const y of [89,103,115])r(ctx,px+1,y,1,1,'#e5d8af');}
  for(const y of [100,116]){
    r(ctx,x+2,y,42,3,'#7f624b');r(ctx,x+2,y,42,1,'#dbb27b');
    r(ctx,x+5,y+1,8,1,'#a87b52');r(ctx,x+27,y+1,5,1,'#a87b52');
    r(ctx,x+34,y,6,2,'#ded0a7');r(ctx,x+35,y+1,1,1,'#8e8974');r(ctx,x+38,y+1,1,1,'#8e8974');
  }
  if(capacity){r(ctx,x+2,80,42,3,'#708b87');r(ctx,x+2,80,42,1,'#bdd1af');}
  // Back-to-front order keeps each physical carton legible on its shelf.
  for(let i=0;i<Math.min(queue.length,8);i++){
    const parcel=queue[i],row=Math.floor(i/4),sx=x+4+(i%4)*9,sy=row===0?89:105;
    ctx.drawImage(parcelSprite(parcel.kind,parcel.dest,parcel.prepared),sx,sy,10,11);
  }
  if(queue.length>8)for(let i=8;i<Math.min(queue.length,12);i++){const parcel=queue[i];ctx.drawImage(parcelSprite(parcel.kind,parcel.dest,parcel.prepared),x+5+(i-8)*9,120,10,11);}
  r(ctx,x+17,117,12,7,p.dark);r(ctx,x+17,117,12,1,p.main);routeMark(ctx,dest,x+21,118,1,p.light);
}

function intake(ctx,dest,wide,active,queued,feedbackAge=-1,reducedMotion=false){
  const p=ROUTE_PALETTES[dest],cx=Math.round(centers[dest]),w=wide?53:47,x=cx-Math.floor(w/2);
  const received=feedbackAge>=0&&feedbackAge<.3;
  ctx.save();
  if(received&&!reducedMotion)ctx.translate(0,feedbackAge<.15?1:0);
  if(active){r(ctx,x-2,162,w+4,28,'#dce9bc');r(ctx,x-4,166,w+8,20,'#dce9bc');}
  // The raised mouth remains visible behind the solid DOM sorting control.
  r(ctx,x+2,155,3,12,p.dark);r(ctx,x+w-5,155,3,12,p.dark);r(ctx,x+3,154,w-6,4,p.main);r(ctx,x+4,154,w-8,1,p.light);
  for(let px=x+7;px<x+w-7;px+=9)r(ctx,px,156,4,1,p.light);
  r(ctx,x+1,187,w,4,'#6f705544');
  // Solid steel receiving mouth, angled sides and tactile wooden lip.
  polygon(ctx,[[x,165],[x+4,160],[x+w-4,160],[x+w,165],[x+w,182],[x,182]],p.dark);
  polygon(ctx,[[x+3,165],[x+7,162],[x+w-7,162],[x+w-3,165],[x+w-3,179],[x+3,179]],'#354c52');
  r(ctx,x+5,165,w-10,14,'#4b6263');r(ctx,x+6,166,w-12,1,'#2d444a');
  for(let px=x+8;px<x+w-8;px+=5){r(ctx,px,168,2,10,'#71817a');r(ctx,px,168,1,10,'#9ba58c');}
  r(ctx,x,179,w,8,received?p.light:p.main);r(ctx,x+1,179,w-2,2,received?'#fff1c9':p.light);r(ctx,x,187,w,2,p.dark);
  if(received){r(ctx,x+5,165,w-10,5,'#b9d7b0');r(ctx,x+7,171,w-14,5,'#86b79d');}
  r(ctx,x+3,182,3,3,p.dark);r(ctx,x+w-6,182,3,3,p.dark);
  // The physical label matches the touch targets rather than adding a UI heading.
  r(ctx,cx-10,179,21,8,p.deep);routeMark(ctx,dest,cx-7,180,1,p.light);routeSymbol(ctx,dest,cx+2,180,p.light);
  r(ctx,x+3,188,4,3,'#77624c');r(ctx,x+w-7,188,4,3,'#77624c');
  if(wide){r(ctx,x,163,5,2,'#edcf88');r(ctx,x+w-5,163,5,2,'#edcf88');}
  if(queued){r(ctx,x+w-5,158,3,3,queued>6?'#ecba78':'#9dca91');r(ctx,x+w-5,161,3,1,p.dark);}
  ctx.restore();
}

function equipment(ctx,upgrades,station,time,reducedMotion,shift,feedback){
  const pack=Number(upgrades.packer||0),scanner=Number(upgrades.scanner||0);
  // Packing bench is the physical source of PREPARE; upgrades install powered tools.
  r(ctx,9,197,31,9,'#805f4b');r(ctx,10,196,29,3,'#e0be87');r(ctx,11,199,2,11,'#775c48');r(ctx,36,199,2,11,'#775c48');
  r(ctx,13,192,9,4,'#c8975b');r(ctx,15,191,5,2,'#f4d6a0');r(ctx,25,192,7,4,'#6d8e87');r(ctx,27,190,3,3,'#d9d8b2');r(ctx,32,194,4,2,'#d5ab64');
  if(pack){r(ctx,12,187,5,8,'#507a7b');r(ctx,12,187,15,3,'#86b5a8');r(ctx,24,189,3,7,'#587f7c');r(ctx,15,188,8,1,'#d2e4bb');r(ctx,16,193,7,3,'#d7c39b');}
  r(ctx,155,196,30,4,'#839a95');r(ctx,156,200,3,10,'#5a7478');r(ctx,180,200,3,10,'#5a7478');r(ctx,161,189,15,6,'#d8ceaa');r(ctx,162,190,10,4,'#f2e4bf');for(let x=163;x<171;x+=3)r(ctx,x,191,1,2,'#a79981');
  if(scanner){r(ctx,175,183,7,11,'#47626d');r(ctx,176,184,5,5,'#9fc8a4');r(ctx,177,185,3,2,'#d5e9b5');r(ctx,176,192,4,2,'#d0b87d');r(ctx,173,194,11,2,'#536c74');}
  // One shared work position reflects only the engine's actual in-progress item.
  // The small carton is its work preview, never a second stock/queue entry.
  const job=shift?.processing,parcel=job&&shift.parcels?.find(p=>String(p.id)===String(job.id));
  const finished=feedback?.type==='prepared'&&time-feedback.startedAt>=0&&time-feedback.startedAt<.3;
  // Keep the work preview above the DOM receiving mouths, in the staff aisle.
  ctx.save();ctx.translate(0,-51);
  r(ctx,76,197,43,5,'#80664e');r(ctx,77,195,41,3,finished?'#e8e6b3':'#d5bc8b');
  for(const x of [79,113]){r(ctx,x,202,3,2,'#6e6354');r(ctx,x,201,3,1,'#a08b6c');}
  r(ctx,80,198,35,3,'#726c57');
  if(parcel){
    const duration=Number(job.duration),remaining=Number(job.remaining);
    const progress=duration>0&&Number.isFinite(remaining)?Math.max(0,Math.min(1,1-remaining/duration)):0;
    const press=!reducedMotion&&Math.floor(time*4)%2===0?1:0;
    ctx.drawImage(parcelSprite(parcel.kind,parcel.dest,false),87,181+press,20,18);
    // A padded press, size gauge or scanner follows the real handling requirement.
    if(parcel.kind==='fragile'){r(ctx,83,184,4,11,'#d7dfb5');r(ctx,107,184,4,11,'#b7ceac');r(ctx,84,182+press,26,3,'#e5e8bd');}
    else if(parcel.kind==='large'){r(ctx,81,183,4,12,'#6b8e86');r(ctx,110,183,4,12,'#6b8e86');r(ctx,82,181,31,3,'#b4c9a4');}
    else if(parcel.kind==='exception'){r(ctx,107,181,7,10,'#55787b');r(ctx,108,182,5,5,'#bad8ac');r(ctx,108,190,4,4,'#38535e');r(ctx,88,187+press,18,2,'#d4ebba');}
    r(ctx,80,198,Math.max(1,Math.round(35*progress)),3,'#a7d29b');
    r(ctx,77,192,4,3,'#f3d88b');
  }else{r(ctx,108,191,5,4,finished?'#b9df9c':'#7f9482');r(ctx,82,191,8,3,'#b99b70');}
  ctx.restore();
  if(upgrades.sorter){
    // Installed sorter: the optical bridge feeds the three existing receiving mouths.
    r(ctx,76,205,43,4,'#4a6872');r(ctx,77,204,41,2,'#acc4b1');
    for(const x of [76,115]){r(ctx,x,208,4,21,'#607f83');r(ctx,x+1,208,1,18,'#b4c5ad');r(ctx,x-1,228,6,2,'#405c68');}
    r(ctx,91,207,13,5,'#425b68');r(ctx,93,208,3,2,'#b2d798');r(ctx,98,208,4,2,'#83b9be');
    for(let i=0;i<3;i++)r(ctx,82+i*11,206,5,2,ROUTE_PALETTES[i].main);
    r(ctx,85,201,24,3,'#d4c398');r(ctx,87,200,3,2,'#e5daa9');r(ctx,104,200,3,2,'#e5daa9');
  }
}

export const STATION_SIGNS=Object.freeze({
  sort:Object.freeze({x:8,y:230,width:106}),
  pack:Object.freeze({x:128,y:140,width:106}),
  load:Object.freeze({x:276,y:50,width:106}),
});
const ROLE_INDEX={sort:0,pack:1,load:2};
function stationSupports(ctx,role,stationSigns){
  const measured=Array.isArray(stationSigns)?stationSigns.find(b=>(b.role||b.id)===role):stationSigns?.[role];
  const box={...STATION_SIGNS[role],height:44,...measured};
  const bottom=(box.y+box.height)/2,point=PIPELINE_LAYOUT.roles[role].work;
  const benchY=sceneY(point.y)/2-5,benchX=point.x/2;
  // These are the bench's sign uprights, not an extra frame around the button.
  for(const fraction of [.17,.83]){
    const sx=Math.round((box.x+box.width*fraction)/2);
    r(ctx,sx-1,bottom-1,3,Math.max(2,benchY-bottom+2),'#657e78');
    r(ctx,sx-1,bottom-1,1,Math.max(2,benchY-bottom),'#c5d0ae');
    polygon(ctx,[[sx,benchY-2],[sx+2,benchY+1],[benchX+(fraction<.5?-17:17),benchY+1],[benchX+(fraction<.5?-17:17),benchY-2]],'#758f85');
    r(ctx,sx-2,benchY,5,3,'#455d60');
  }
}
function incomingParcels(ctx,arrivals){
  if(!arrivals?.enabled||!arrivals.waiting)return;
  const kinds=arrivals.waitingKinds||[];
  let slot=0;
  // Move the hopper as one solid assembly, without stretching its cartons.
  ctx.save();ctx.translate(0,sceneY(410)/2-205);
  // The inbound hopper is part of the forecourt, outside the moving belt.
  r(ctx,7,205,81,5,'#5a7278');r(ctx,8,205,79,2,'#c5c9a9');
  r(ctx,10,210,5,2,'#3c535d');r(ctx,79,210,5,2,'#3c535d');
  r(ctx,7,198,3,9,'#718e8b');r(ctx,85,198,3,9,'#718e8b');
  // Only parcels genuinely waiting outside the belt are pictured. Limit the
  // physical frontage; the nearby DOM count preserves the complete backlog.
  for(const batch of kinds){
    for(let i=0;i<batch.count&&slot<9;i++,slot++){
      const size=batch.kind==='large'?18:14;
      pipelineParcel(ctx,{kind:batch.kind,dest:-1,prepared:false},13+(slot%5)*15,206-Math.floor(slot/5)*9,size);
    }
  }
  ctx.restore();
}

function pipelineParcel(ctx,parcel,x,y,size=12){
  const width=parcel.kind==='large'?Math.round(size*1.4):size;
  ctx.drawImage(parcelSprite(parcel.kind,parcel.dest,parcel.prepared),Math.round(x-width/2),Math.round(y-size),width,size);
}
function pipelineBench(ctx,role,highlight,up,stationSigns,pressure){
  const index=ROLE_INDEX[role],p=ROUTE_PALETTES[index],point=PIPELINE_LAYOUT.roles[role].work;
  const x=Math.round(point.x/2),y=Math.round(sceneY(point.y)/2)-5;
  if(highlight){
    // Filled light identifies available destinations; the hovered drop is stronger.
    for(const [radius,alpha] of [[31,.09],[27,.13],[23,.19]]){
      ctx.fillStyle=`rgba(108,192,235,${alpha*(highlight===2?1.75:.8)})`;ctx.beginPath();ctx.ellipse(x,y+2,radius,16,0,0,Math.PI*2);ctx.fill();
    }
  }
  if(!highlight&&(pressure==='busy'||pressure==='blocked')){
    const blocked=pressure==='blocked';
    for(const [radius,alpha] of [[29,.08],[25,.12],[21,.17]]){
      ctx.fillStyle=blocked?`rgba(193,78,62,${alpha})`:`rgba(219,151,53,${alpha})`;
      ctx.beginPath();ctx.ellipse(x,y+7,radius,14,0,0,Math.PI*2);ctx.fill();
    }
  }
  // Solid inset floor mats tie each machine to its standing position.
  r(ctx,x-23,y+4,46,12,role==='sort'?'#ad9272':role==='pack'?'#8eaa8e':'#889ca6');
  r(ctx,x-21,y+5,42,2,role==='sort'?'#c2a781':role==='pack'?'#aac09b':'#a9bac0');
  if(!highlight&&(pressure==='busy'||pressure==='blocked')){
    r(ctx,x-20,y+7,40,7,pressure==='blocked'?'#b57a63':'#bf9b60');
  }
  stationSupports(ctx,role,stationSigns);
  r(ctx,x-23,y+7,46,5,'#4d5a5444');
  for(const leg of [-19,16]){r(ctx,x+leg,y,3,12,'#536a6b');r(ctx,x+leg,y,1,10,'#aac1aa');}
  r(ctx,x-22,y-9,44,11,p.dark);r(ctx,x-22,y-10,44,3,p.light);r(ctx,x-20,y-7,40,6,p.main);
  if(role==='sort'){
    // Open address bins, paper labels and a hand scanner make sorting literal.
    for(let i=0;i<3;i++){
      const sx=x-20+i*14,p=ROUTE_PALETTES[i];
      polygon(ctx,[[sx,y-13],[sx+11,y-13],[sx+13,y-3],[sx-1,y-3]],p.dark);
      r(ctx,sx+1,y-11,9,6,'#3b535a');r(ctx,sx,y-5,12,4,p.main);
      r(ctx,sx+3,y-4,6,3,'#f4e5b9');routeSymbol(ctx,i,sx+4,y-10,p.light);
    }
    r(ctx,x+15,y-1,5,4,'#344e5b');r(ctx,x+16,y-1,4,2,'#cce2ba');
    r(ctx,x-17,y-1,11,3,'#eee2bd');r(ctx,x-16,y-1,6,1,'#786d5a');
    if(up.scanner){r(ctx,x+14,y-14,8,13,'#47626d');r(ctx,x+15,y-13,6,6,'#c4e2ad');r(ctx,x+16,y-12,4,3,'#6b9e91');r(ctx,x+13,y-2,11,2,'#344e5b');}
    if(up.sorter){r(ctx,x-22,y-24,44,4,'#a8c9b5');for(const sx of [x-22,x+19])r(ctx,sx,y-22,3,12,'#587f83');r(ctx,x-3,y-20,6,3,'#deefac');}
  }else if(role==='pack'){
    // Cardboard roll, loose bubble-wrap and tape gun, never invented stock.
    r(ctx,x-21,y-12,10,8,'#b48953');r(ctx,x-20,y-13,8,2,'#f0d294');
    r(ctx,x-18,y-11,4,5,'#e9cc96');r(ctx,x-17,y-10,2,3,'#82684c');
    r(ctx,x-11,y-9,14,5,'#ddd4b1');
    for(let dx=-10;dx<3;dx+=3)r(ctx,x+dx,y-8,2,2,'#faf0cf');
    r(ctx,x+5,y-11,11,7,'#c0ccb0');r(ctx,x+7,y-12,7,2,'#f0e5bf');
    r(ctx,x+8,y-10,4,3,'#788c80');r(ctx,x+12,y-6,5,3,'#dfae64');
    r(ctx,x-7,y-1,13,3,'#e9cc8e');r(ctx,x-5,y-1,9,1,'#9b805d');
    if(up.packer){r(ctx,x-4,y-28,20,4,'#9ac5b5');r(ctx,x+13,y-26,3,16,'#5c8885');r(ctx,x-2,y-24,3,9,'#6c9891');r(ctx,x-5,y-16,12,3,'#c3d8b1');}
  }else{
    // Roll-out pallet, solid loading ramp and wheeled sack trolley.
    r(ctx,x-20,y-18,34,7,'#879f9d');for(let dx=-17;dx<12;dx+=6)r(ctx,x+dx,y-17,3,6,'#c0c7aa');
    polygon(ctx,[[x-17,y-10],[x+10,y-10],[x+16,y-2],[x-21,y-2]],'#a1b3a7');
    for(let dy=-8;dy<-2;dy+=3)r(ctx,x-17,y+dy,27,1,'#d1d5b4');
    r(ctx,x+16,y-14,3,9,'#4c6a73');r(ctx,x+10,y-14,8,3,'#8fb6ae');
    r(ctx,x+12,y-9,12,3,'#587980');r(ctx,x+13,y-6,4,4,'#354750');r(ctx,x+21,y-6,4,4,'#354750');
    r(ctx,x-22,y-14,7,8,'#486673');r(ctx,x-21,y-13,5,4,'#b9dbb4');

  }
  if(!highlight&&(pressure==='busy'||pressure==='blocked')){
    // Steady machine beacon follows real queued work, including reduced motion.
    r(ctx,x+18,y-5,4,5,'#405a60');
    r(ctx,x+18,y-7,4,3,pressure==='blocked'?'#f19a79':'#f4cf7a');
  }
}
function pipelineQueue(ctx,parcels,x,y,columns=4){
  // Every rendered carton is an actual unclaimed parcel, not decorative stock.
  // Tall backlogs extend upward in tiers rather than hiding behind the controls.
  parcels.slice(0,24).forEach((parcel,i)=>{
    const tier=Math.floor(i/(columns*2)),slot=i%(columns*2),row=Math.floor(slot/columns);
    pipelineParcel(ctx,parcel,x+(slot%columns)*10,y+row*7-tier*8,12);
  });
}
function drawPipeline(ctx,state,station,time,reducedMotion,selectedRole,selectedWorkerId,dragWorker,dropRole,stationSigns,arrivals){
  const t=THEMES[station],shift=state.shift,flow=shift?.flow,up=state.upgrades||{};
  // A full-height cutaway depot dedicates the yard to hands-on work.
  r(ctx,0,0,W,H,t.floor);
  for(let y=5;y<H;y++)for(let x=4;x<W-4;x++){
    const n=noise(x,y);if(n%137===0)r(ctx,x,y,2,1,t.fleck);
  }
  for(let y=20;y<H;y+=26){
    r(ctx,4,y,187,1,t.seam);
    for(let x=4+(y%52?24:0);x<190;x+=48)r(ctx,x,y,1,26,t.seam);
  }
  r(ctx,0,0,4,H,t.beam);r(ctx,191,0,4,H,t.beam);
  r(ctx,1,0,1,H,t.wallLight);r(ctx,191,0,1,H,t.wallLight);
  r(ctx,4,0,187,4,t.wall);r(ctx,4,0,187,1,t.wallLight);
  r(ctx,4,258,187,2,t.beam);
  // A compact dispatch threshold replaces the former parking forecourt.
  for(const cx of centers){
    r(ctx,cx-17,5,34,5,'#788e87');r(ctx,cx-17,5,34,1,'#c7d1b1');
    for(let x=cx-15;x<cx+15;x+=8)r(ctx,x,7,4,2,'#d4bf79');
  }
  // The belt retains its real horizontal parcel coordinates and mapped center.
  const beltY=sceneY(PIPELINE_LAYOUT.belt.y)/2;
  r(ctx,7,beltY-13,181,28,'#3a4b54');r(ctx,9,beltY-15,177,28,'#607780');
  r(ctx,11,beltY-11,173,22,'#394d58');
  r(ctx,10,beltY-16,175,3,'#d3ccab');r(ctx,10,beltY+12,175,3,'#9aa99d');
  for(const x of [8,181]){r(ctx,x,beltY-11,5,23,'#455c65');r(ctx,x+1,beltY-9,3,18,'#9ca998');}
  r(ctx,181,beltY-4,9,12,'#9f7657');r(ctx,182,beltY-3,7,8,'#cfa66c');
  // Physical roller transfer trays sit at the engine's hand-off points.
  for(const role of ['sort','pack']){
    const point=PIPELINE_LAYOUT.roles[role].drop,x=point.x/2,y=sceneY(point.y)/2;
    r(ctx,x-23,y-5,46,10,'#6c807d');r(ctx,x-23,y-5,46,2,'#c7cdb0');
    for(let dx=-20;dx<22;dx+=5){r(ctx,x+dx,y-2,3,5,'#a3b2a1');r(ctx,x+dx,y-2,1,5,'#d3d6ba');}
  }
  const management=managementView(state);
  const staff=state.phase==='planning'?management.workers:(flow?.workers||[]);
  const selectedWorker=staff.find(w=>selectedWorkerId!==null&&String(w.id)===String(selectedWorkerId));
  for(const role of ['sort','pack','load']){
    const available=selectedWorker&&role!==(selectedWorker.targetRole||selectedWorker.role);
    pipelineBench(ctx,role,available?(dropRole===role?2:1):(!selectedWorker&&selectedRole===role?1:0),up,stationSigns,management.roles[role]?.pressure);
  }
  pipelineQueue(ctx,flow?.pack||[],62,sceneY(302)/2);
  pipelineQueue(ctx,flow?.load||[],119,sceneY(242)/2);
  // Transitional legacy jobs remain visible during their real remaining time.
  const oldJob=shift?.processing,oldParcel=oldJob&&shift.parcels.find(p=>String(p.id)===String(oldJob.id));
  if(oldParcel){
    pipelineParcel(ctx,oldParcel,98,sceneY(262)/2,15);
    const progress=Math.max(0,Math.min(1,1-oldJob.remaining/oldJob.duration));
    r(ctx,88,sceneY(262)/2+2,20,3,'#476164');r(ctx,88,sceneY(262)/2+2,20*progress,3,'#cae7a9');
  }
  const running=state.phase==='running',offset=!reducedMotion&&running?Math.floor(time*13)%10:0;
  for(let x=12+offset;x<181;x+=10){r(ctx,x,beltY-10,3,20,'#617d80');r(ctx,x,beltY-10,1,20,'#8da39b');}
  for(const parcel of shift?.parcels||[]){
    if(oldJob&&String(parcel.id)===String(oldJob.id))continue;
    pipelineParcel(ctx,parcel,(PIPELINE_LAYOUT.belt.left+parcel.x*(PIPELINE_LAYOUT.belt.right-PIPELINE_LAYOUT.belt.left))/2,sceneY(PIPELINE_LAYOUT.belt.y)/2+6,16);
  }
  // Pickup reserves ownership before the worker arrives. The carton stays at
  // the pickup point until the engine changes phase, rather than teleporting.
  for(const w of staff){
    if(w.phase!=='pickup'||!w.parcel)continue;
    const point=PIPELINE_LAYOUT.roles[w.role].pickup;
    const x=w.role==='sort'?(PIPELINE_LAYOUT.belt.left+w.parcel.x*(PIPELINE_LAYOUT.belt.right-PIPELINE_LAYOUT.belt.left))/2:point.x/2;
    const y=w.role==='sort'?sceneY(PIPELINE_LAYOUT.belt.y)/2+6:sceneY(point.y)/2;
    pipelineParcel(ctx,w.parcel,x,y,w.role==='sort'?16:12);
  }
  incomingParcels(ctx,arrivals);
  // Draw the dragged employee last and replace their original, preserving identity.
  const dragging=staff.find(w=>dragWorker&&String(w.id)===String(dragWorker.id));
  const ordered=[...staff].filter(w=>w!==dragging).sort((a,b)=>a.y-b.y);
  if(dragging)ordered.push(dragging);
  for(const w of ordered){
    if(!Number.isFinite(w.x)||!Number.isFinite(w.y))continue;
    const isDragging=w===dragging;
    const selected=selectedWorkerId!==null&&String(w.id)===String(selectedWorkerId);
    const x=Math.round((isDragging?dragWorker.x:w.x)/2),y=Math.round(sceneY(isDragging?dragWorker.y:w.y)/2),index=ROLE_INDEX[w.role]??0;
    const scale=isDragging?1.35:selected?1.2:1;
    if(selected||isDragging){
      const glow=ctx.createRadialGradient(x,y,1,x,y,17*scale);
      glow.addColorStop(0,'rgba(74,144,184,.4)');glow.addColorStop(1,'rgba(74,144,184,0)');
      ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(x,y,17*scale,8*scale,0,0,Math.PI*2);ctx.fill();
    }
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.translate(-x,-y);
    const workPoint=pipelineWorkerPoint(w.role,w.id);
    const atBench=Math.hypot(w.x-workPoint.x,w.y-workPoint.y)<2;
    const walking=['pickup','deliver','return','transfer'].includes(w.phase)||(w.phase==='work'&&!atBench);
    const step=!reducedMotion&&walking?Math.floor(time*6)%2:0;
    // x/y are feet in the simulation; animation changes pose only, never location.
    worker(ctx,x-8,y-18,{dest:index,carrying:w.phase==='pickup'?null:w.parcel,step,variant:Number(w.id)||0});
    if(!isDragging&&w.phase==='work'&&atBench){
      const press=!reducedMotion?Math.floor(time*5)%2:0;
      r(ctx,x-8,y-7+press,4,3,'#f0c390');r(ctx,x+5,y-7+press,4,3,'#f0c390');
      // Visible tools follow the real stage; no invented processing animation.
      if(w.role==='sort'){
        r(ctx,x+7,y-10+press,5,3,'#405d67');r(ctx,x+8,y-10+press,3,1,'#cfdfb4');
      }else if(w.role==='pack'){
        r(ctx,x-6,y-6+press,12,2,'#f0db9e');r(ctx,x+3,y-10+press,5,4,'#a5c2ad');
      }else{
        r(ctx,x+7,y-10+press,5,7,'#e4d2a1');r(ctx,x+8,y-8+press,3,1,'#788778');
      }
      const progress=w.job?.duration>0?1-w.job.remaining/w.job.duration:w.progress||0;
      r(ctx,x-9,y-24,18,3,'#405b63');r(ctx,x-9,y-24,Math.round(18*Math.max(0,Math.min(1,progress))),3,'#d0e8a5');
    }
    if(w.targetRole&&w.targetRole!==w.role){
      // A carried destination swatch shows pending reassignment even while busy.
      const target=ROLE_INDEX[w.targetRole]??0,p=ROUTE_PALETTES[target];
      r(ctx,x+9,y-22,8,8,p.dark);r(ctx,x+10,y-21,6,6,p.main);
      // One/two/three solid pips identify the target without relying on color.
      for(let i=0;i<=target;i++)r(ctx,x+10+i*2,y-18,1,2,p.light);
    }
    // A small solid numbered badge ties pointer selection to the keyboard IDs.
    const numeral=String(w.id);
    r(ctx,x-16,y-23,9,9,selected||isDragging?'#d8efbc':'#334f5a');
    ctx.fillStyle=selected||isDragging?'#294650':'#fff0cb';ctx.font='bold 8px sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(numeral,x-11.5,y-18.5);
    ctx.restore();
  }
}

export function renderScene(canvas,state,{time=0,reducedMotion=false,selectedId=null,selectedRole=null,selectedWorkerId=null,dragWorker=null,dropRole=null,feedback=null,stationSigns=null,arrivals=null}={}){
  if(!canvas||!state)return;
  if(!back){back=document.createElement('canvas');back.width=W;back.height=H;backCtx=back.getContext('2d');backCtx.imageSmoothingEnabled=false;}
  const ctx=backCtx,station=Math.min(2,Math.max(0,Math.floor(((state.day||1)-1)/6))),up=state.upgrades||{},shift=state.shift;
  ctx.clearRect(0,0,W,H);
  if(state.management){
    drawPipeline(ctx,state,station,time,reducedMotion,selectedRole,selectedWorkerId,dragWorker,dropRole,stationSigns,arrivals);
    const target=canvas.getContext('2d');target.imageSmoothingEnabled=false;target.clearRect(0,0,canvas.width,canvas.height);target.drawImage(back,0,0,canvas.width,canvas.height);
    return;
  }
  ctx.drawImage(backdrop(station),0,0);
  const queues=shift?.queues||[[],[],[]],loads=shift?.loading||[[],[],[]];
  let trips=departureAnimations.get(canvas);
  if(!trips||trips.shift!==shift){trips={shift,previous:shift?.departures?.slice()||[],started:[-100,-100,-100]};departureAnimations.set(canvas,trips);}
  for(let d=0;d<3;d++){
    const countdown=shift?.departures?.[d]??12;
    if(countdown>(trips.previous[d]??countdown)+.5)trips.started[d]=time;
    trips.previous[d]=countdown;
    const age=time-trips.started[d];
    const travelOffset=reducedMotion||age<0||age>2?0:age<.6?-Math.round(age/.6*78):age<1.2?-78:-Math.round((2-age)/.8*78);
    // Dock wall masks the vehicle as it moves out through the top of the yard.
    ctx.save();ctx.beginPath();ctx.rect(d*65,0,65,69);ctx.clip();
    truck(ctx,d,loads[d]||[],countdown,time,reducedMotion,Boolean(up.dispatch),travelOffset);ctx.restore();
  }
  for(let d=0;d<3;d++)shelf(ctx,d,queues[d]||[],0);
  const employees=shift?.workers?.length?shift.workers:Array.from({length:1+(up.worker||0)},(_,i)=>({id:i,dest:i%3,parcel:null,progress:0}));
  // Draw staff in floor-depth order. Carried items belong to actual worker records.
  const staff=employees.map((w,i)=>{
    const dest=w.dest??i%3,cx=centers[dest];
    if(!w.parcel)return{w,x:dest===1?61:cx-9+(i%2)*10,y:133+(i%2)*5};
    const progress=Math.max(0,Math.min(1,w.progress||0));
    // Follow the gaps between racks, not a straight line through their cartons.
    const lane=dest===0?57:122,start=cx-7,floorStart=dest===1?127:start;
    if(progress<.2)return{w,x:floorStart+(lane-floorStart)*progress/.2,y:146-progress/.2*18};
    if(progress<.75)return{w,x:lane,y:128-(progress-.2)/.55*58};
    return{w,x:lane+(start-lane)*(progress-.75)/.25,y:70-(progress-.75)/.25*6};
  }).sort((a,b)=>a.y-b.y);
  for(let i=0;i<staff.length;i++){const {w,x,y}=staff[i];worker(ctx,Math.round(x),Math.round(y),{dest:w.dest??i%3,carrying:w.parcel,step:!reducedMotion&&w.parcel?Math.floor(time*5)%2:0,variant:w.id||i});}
  const selected=shift?.parcels?.find(p=>String(p.id)===String(selectedId));
  for(let d=0;d<3;d++)intake(ctx,d,Boolean(up.widegate),selected?.dest===d,(queues[d]||[]).length,feedback?.dest===d&&feedback?.type!=='prepared'?time-feedback.startedAt:-1,reducedMotion);
  equipment(ctx,up,station,time,reducedMotion,shift,feedback);
  // Conveyor rollers travel underneath the DOM parcels; never create duplicates.
  const running=state.phase==='running',offset=!reducedMotion&&running?Math.floor(time*13)%10:0;
  ctx.save();ctx.beginPath();ctx.rect(11,219,173,22);ctx.clip();
  for(let x=5+offset;x<190;x+=10){r(ctx,x,220,3,20,'#617d80');r(ctx,x,220,1,20,'#8da39b');r(ctx,x+3,221,1,18,'#2e4654');r(ctx,x,220,3,1,'#a5b3a3');}
  ctx.restore();
  // Belt end wheels and guards remain in front of the moving rollers.
  for(const x of [8,181]){r(ctx,x,219,5,23,'#455c65');r(ctx,x+1,221,3,18,'#9ca998');r(ctx,x+2,224,1,12,'#d1d2ac');}
  r(ctx,13,216,168,1,'#e1d8b4');r(ctx,13,242,168,1,'#bdc6ad');
  const target=canvas.getContext('2d');target.imageSmoothingEnabled=false;target.clearRect(0,0,canvas.width,canvas.height);target.drawImage(back,0,0,canvas.width,canvas.height);
}
