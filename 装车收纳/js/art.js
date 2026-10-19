/* Authored Canvas pixel art. One source texel is normally two display pixels.
 * Objects are cached in their unrotated silhouette; the game owns all state. */
const C = Object.freeze({ ink:'#293a3a', deep:'#243330', teal:'#438e83', mint:'#80b9a0', pale:'#bed7bb', timber:'#a77c4d', wood:'#c69b65', light:'#edc58b', brass:'#cda658', rust:'#a96d4d', cream:'#eee4c9', blue:'#537f99', water:'#79b8bb' });
export const CARGO_TYPES = Object.freeze(['crate','chest','chair','sofa','table','desk','bike','fridge','washer','cabinet','mirror','lamp','plant','box','books','vase','piano','wardrobe','rug','aquarium']);
const cache = new Map(), urls = new Map(), scenes = new Map();
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
function surface(w,h) { const c=document.createElement('canvas'); c.width=Math.max(1,Math.ceil(w)); c.height=Math.max(1,Math.ceil(h)); return [c,c.getContext('2d')]; }
function rect(g,x,y,w,h,color) { g.fillStyle=color; g.fillRect(Math.round(x),Math.round(y),Math.max(0,Math.round(w)),Math.max(0,Math.round(h))); }
// Scanline polygons and ellipses avoid the antialiased edge of Canvas paths.
function poly(g,points,color) {
  const lo=Math.ceil(Math.min(...points.map(p=>p[1]))), hi=Math.floor(Math.max(...points.map(p=>p[1])));
  for(let y=lo;y<=hi;y++) { const xs=[]; for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length]; if((a[1]<=y+.5&&b[1]>y+.5)||(b[1]<=y+.5&&a[1]>y+.5)) xs.push(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]));} xs.sort((a,b)=>a-b); for(let i=0;i<xs.length;i+=2) rect(g,Math.ceil(xs[i]-.5),y,Math.ceil(xs[i+1]-.5)-Math.ceil(xs[i]-.5),1,color); }
}
function oval(g,x,y,rx,ry,color) { for(let j=Math.ceil(y-ry);j<=Math.floor(y+ry);j++){const dy=(j+.5-y)/ry;if(Math.abs(dy)>1)continue;const dx=rx*Math.sqrt(1-dy*dy);rect(g,Math.ceil(x-dx-.5),j,Math.ceil(x+dx-.5)-Math.ceil(x-dx-.5),1,color);} }
function line(g,x0,y0,x1,y1,color,size=1) { x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;let err=dx+dy;for(;;){rect(g,x0,y0,size,size,color);if(x0===x1&&y0===y1)break;const e=2*err;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}} }
function bevel(g,x,y,w,h,mid,light,dark) { rect(g,x,y,w,h,dark);rect(g,x,y,w-1,h-2,mid);rect(g,x+1,y+1,w-3,1,light);rect(g,x+1,y+2,1,h-4,light); }
function wood(g,x,y,w,h,dark=false) { bevel(g,x,y,w,h,dark?'#936341':C.wood,dark?'#ba8752':C.light,'#684c37');for(let j=5;j<h-3;j+=7){rect(g,x+3,y+j,w-6,1,dark?'#855a3c':'#b88a55');rect(g,x+5+(j*3%Math.max(1,w-12)),y+j-1,3,1,dark?'#ad7b4b':'#d4ae74');} }
function normalCells(input) { const a=(input?.length?input:[[0,0]]).map(p=>Array.isArray(p)?[Number(p[0]),Number(p[1])]:[Number(p.x),Number(p.y)]).filter(p=>p.every(Number.isFinite));if(!a.length)return [[0,0]];const x=Math.min(...a.map(p=>p[0])),y=Math.min(...a.map(p=>p[1]));return a.map(p=>[p[0]-x,p[1]-y]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]); }
function rotateCells(cells,r) { let a=normalCells(cells);for(let i=0;i<r;i++)a=normalCells(a.map(([x,y])=>[-y,x]));return a; }
const DEFAULT_CELLS={box:[[0,0]],books:[[0,0],[1,0]],plant:[[0,0]],vase:[[0,0]],sofa:[[0,0],[1,0],[2,0],[0,1]],fridge:[[0,0],[0,1]],washer:[[0,0]],bike:[[0,0],[1,0],[2,0],[0,1],[2,1]],table:[[0,0],[1,0],[2,0],[1,1]],piano:[[0,0],[1,0],[0,1],[1,1]],wardrobe:[[0,0],[1,0],[0,1],[1,1]],lamp:[[0,0],[0,1]],rug:[[0,0],[1,0],[2,0]],chair:[[0,0],[0,1]],aquarium:[[0,0],[1,0]]};
Object.assign(DEFAULT_CELLS,{crate:[[0,0]],chest:[[0,0],[1,0]],chair:[[0,0],[0,1],[1,1]],sofa:[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],desk:[[0,0],[1,0],[2,0],[0,1],[0,2]],bike:[[1,0],[2,0],[0,1],[1,1]],fridge:[[0,0],[0,1],[0,2]],washer:[[0,0],[1,0],[0,1],[1,1]],cabinet:[[0,0],[1,0],[0,1],[1,1]],mirror:[[0,0],[0,1],[0,2]]});
function silhouette(g,cells,t,color,inset=1) { const set=new Set(cells.map(p=>p.join(',')));for(const [x,y]of cells){rect(g,x*t+inset,y*t+inset,t-inset*2,t-inset*2,color);if(set.has([x+1,y].join(',')))rect(g,(x+1)*t-inset,y*t+inset,inset*2,t-inset*2,color);if(set.has([x,y+1].join(',')))rect(g,x*t+inset,(y+1)*t-inset,t-inset*2,inset*2,color);} }
function label(g,x,y,w=8) { rect(g,x,y,w,6,'#f4e6bd');rect(g,x+1,y+1,Math.max(2,w-3),1,'#c0b38b');rect(g,x+1,y+3,Math.max(1,w-5),1,'#877d62'); }
function carton(g,x,y,w,h) { bevel(g,x,y,w,h,'#c4965d','#e5b97d','#805d3e');rect(g,x+2,y+2,w-5,3,'#d9ad70');rect(g,x+Math.floor(w*.43),y+1,Math.max(3,Math.round(w*.16)),h-3,'#ead094');rect(g,x+Math.floor(w*.43),y+3,1,h-6,'#f7dfaa');rect(g,x+2,y+h-5,4,1,'#ac7b4a');label(g,x+Math.max(2,w-12),y+Math.max(7,h-11),8); }
function leaf(g,x,y,dx,dy,col) { poly(g,[[x,y],[x+dx*.2-dy*.28,y+dy*.2+dx*.28],[x+dx,y+dy],[x+dx*.65+dy*.2,y+dy*.65-dx*.2]],col); }
function drawObject(g,type,cells,W,H) {
  const T=24, pad=2, w=W-pad*2,h=H-pad*2;
  const set=new Set(cells.map(p=>p.join(',')));
  type=({crate:'box',cabinet:'wardrobe',desk:'table'})[type]||type;
  if(type==='box') { for(const [cx,cy]of cells)carton(g,cx*T+2,cy*T+2,20,20);return; }
  if(type==='chest') {bevel(g,2,2,w,h,'#b88b57','#e1b876','#74573c');bevel(g,3,3,w-2,H*.43,'#cea163','#ebc68b','#927049');rect(g,3,H*.46,W-6,2,'#80633f');for(const xx of [7,W-11]){rect(g,xx,3,4,H-6,'#bca56c');rect(g,xx+1,3,1,H-7,'#ebd292');bevel(g,xx-1,H*.43,6,6,'#9d8554','#e0c488','#6d5c3c');}rect(g,W/2-5,H*.58,10,5,'#6c5941');rect(g,W/2-3,H*.58+1,6,2,'#d1b078');rect(g,3,H-5,W-6,1,'#d1a76d');return;}
  if(type==='mirror') {wood(g,3,2,W-6,H-5,true);bevel(g,5,5,W-10,H-13,'#c4b686','#f1d8a0','#8c724a');rect(g,7,7,W-14,H-17,'#7fa7ad');poly(g,[[7,8],[W-7,8],[W-7,H*.24],[7,H*.49]],'#b3d2cc');poly(g,[[7,H*.57],[W-7,H*.32],[W-7,H*.43],[7,H*.68]],'#e0e4ce');rect(g,W-9,9,1,H-21,'#adc9c2');rect(g,4,H-5,4,4,'#6b503a');rect(g,W-8,H-5,4,4,'#6b503a');return;}
  if(type==='books') { for(const [cx,cy]of cells){const x=cx*T+2,y=cy*T+3;rect(g,x,y+17,20,3,'#634e3c');for(let i=0;i<3;i++){const bw=[5,6,5][i],xx=x+i*6;bevel(g,xx,y+(i%2)*2,bw,17-(i%2)*2,['#a95347','#6c8b73','#547b99'][i],['#dd9a69','#9dbb87','#96bcc2'][i],'#394a47');rect(g,xx+1,y+6,Math.max(1,bw-2),2,C.brass);rect(g,xx+1,y+12,Math.max(1,bw-2),1,'#e6d9b5');}}return; }
  if(type==='sofa') {
    bevel(g,2,2,w,h,'#567f71','#a0b69a','#345449');bevel(g,3,3,W-6,H*.29,'#699581','#aac3a1','#416e5d');
    const n=Math.max(1,Math.round(W/24)),cw=(W-14)/n;for(let i=0;i<n;i++){bevel(g,7+i*cw,H*.4,cw-1,H*.43,'#7ca08b','#b2c3a0','#527b69');rect(g,9+i*cw,H*.44,cw-6,1,'#92ae92');rect(g,7+i*cw,H*.29,1,H*.08,'#4f7a66');}
    for(const xx of [2,W-8])bevel(g,xx,7,6,H-13,'#5b8874','#9db99b','#3b6352');rect(g,8,H-7,W-16,3,'#577b64');rect(g,6,H-4,4,3,'#69533a');rect(g,W-10,H-4,4,3,'#69533a');return;
  }
  if(type==='chair') {
    silhouette(g,cells,T,'#79513f',2);silhouette(g,cells,T,'#bd805c',3);
    // One continuous L lounge: raised back at the short end and a broad seat.
    bevel(g,3,3,18,17,'#ba7858','#e6b485','#8e5b46');bevel(g,5,26,W-10,H-31,'#d6a271','#edc38c','#a56f4f');rect(g,8,28,W-16,1,'#e7b880');bevel(g,2,8,4,H-13,'#bd805c','#e2ac7d','#8e5b46');bevel(g,W-6,H/2+3,4,H/2-8,'#bd805c','#e2ac7d','#8e5b46');rect(g,7,H-4,4,3,'#6e4c39');rect(g,W-11,H-4,4,3,'#6e4c39');return;
  }
  if(type==='fridge'||type==='washer') {
    bevel(g,2,2,w,h,'#d3d9c9','#f1efda','#687f79');rect(g,W-5,5,2,H-9,'#99ada2');
    if(type==='fridge'){const split=Math.max(10,Math.round(H*.34));rect(g,4,split,w-4,2,'#748a80');rect(g,5,split+3,w-7,H-split-8,'#c9d3c4');bevel(g,6,split-7,3,5,'#718e87','#b5c8b9','#42675f');bevel(g,6,split+5,3,8,'#718e87','#b5c8b9','#42675f');rect(g,W-10,7,3,2,'#83a29a');for(let i=0;i<4;i++)rect(g,6+i*3,H-6,1,2,'#7d9285');}
    else{const rad=Math.min(W,H)*.31;bevel(g,4,4,w-4,6,'#b9cabc','#eee9d1','#8b9f93');rect(g,6,6,6,2,'#6c827d');oval(g,W-8,7,2,2,'#597d79');oval(g,W*.5,H*.61,rad,rad,'#728f89');oval(g,W*.5,H*.61,rad-2,rad-2,'#dee2ce');oval(g,W*.5,H*.61,rad-4,rad-4,'#365b63');poly(g,[[W*.28,H*.62],[W*.48,H*.52],[W*.69,H*.7],[W*.52,H*.81]],'#71999a');rect(g,W*.38,H*.44,3,2,'#a7cfca');rect(g,W*.73,H*.54,2,6,'#7a958b');}
    return;
  }
  if(type==='vase') {
    // A narrow open neck and full glazed belly stay readable in one cell.
    // The game owns elevation and support shadows; this sprite stays flat.
    const cx=W/2,sx=W/24,sy=H/24;
    const p=points=>points.map(([x,y])=>[cx+x*sx,y*sy]);
    poly(g,p([[-4,3],[4,3],[3,8],[7,11],[8,15],[7,19],[4,22],[-4,22],[-7,19],[-8,15],[-7,11],[-3,8]]),'#365e70');
    poly(g,p([[-3,4],[3,4],[2,9],[6,12],[7,15],[6,18],[3,21],[-3,21],[-6,18],[-7,15],[-6,12],[-2,9]]),'#638f9f');
    poly(g,p([[-3,5],[-1,5],[-1,9],[-4,12],[-5,15],[-4,18],[-2,20],[-4,19],[-6,16],[-5,12],[-2,8]]),'#a2c5c5');
    poly(g,p([[4,11],[6,13],[6,17],[3,20],[1,21],[4,21],[7,18],[7,14]]),'#4b788b');
    rect(g,cx-6*sx,14*sy,12*sx,2*sy,'#d7c79d');
    rect(g,cx-5*sx,14*sy,2*sx,sy,'#eee0b8');
    rect(g,cx-3*sx,20*sy,6*sx,sy,'#b3bba6');
    oval(g,cx,3.5*sy,4*sx,1.5*sy,'#afccca');
    oval(g,cx,3.5*sy,2.5*sx,.6*sy,'#304f59');
    return;
  }
  if(type==='plant') {
    const cx=W/2,cy=H*.68,rx=Math.min(W*.35,H*.24),ry=H*.24;
    oval(g,cx,cy,rx+1,ry,'#725342');oval(g,cx,cy-2,rx,ry-1,'#bf8056');oval(g,cx,cy-5,rx-2,Math.max(3,ry*.4),'#624a35');rect(g,cx-1,Math.max(4,H*.2),2,H*.47,'#576f39');for(const [dx,dy,col]of [[-10,-12,'#5e9060'],[10,-10,'#83a66a'],[-12,-2,'#3f7858'],[12,0,'#699d62'],[-5,-17,'#82ac68'],[5,-19,'#a7bf76']]){leaf(g,cx,cy-5,dx*Math.min(1,W/26),dy*Math.min(1,H/27),col);}rect(g,cx-rx+3,cy,2,ry*.65,'#dcaa75');
    return;
  }
  if(type==='bike') {
    const wheelY=H*.75,rightY=H*.25,rad=Math.min(H*.21,W*.14),left=W*.17,right=W*.83,crank=W*.47,crankY=H*.65,seatY=H*.27,stemX=W*.68;
    for(const [wx,wy] of [[left,wheelY],[right,rightY]]){oval(g,wx,wy,rad,rad,'#354442');oval(g,wx,wy,rad-2,rad-2,'#aaa99a');oval(g,wx,wy,rad-3,rad-3,'#536b67');for(const [dx,dy]of [[1,0],[0,1],[.7,.7],[.7,-.7]])line(g,wx-rad*dx*.8,wy-rad*dy*.8,wx+rad*dx*.8,wy+rad*dy*.8,'#b6c4ae');oval(g,wx,wy,2,2,'#e3d7b7');}
    for(const [a,b]of [[[left,wheelY],[W*.4,seatY]],[[left,wheelY],[crank,crankY]],[[crank,crankY],[W*.4,seatY]],[[W*.4,seatY],[stemX,seatY-5]],[[stemX,seatY-5],[crank,crankY]],[[stemX,seatY-7],[right,rightY]]])line(g,...a,...b,'#6da1ac',3);
    line(g,W*.4,seatY-3,W*.4,seatY+3,'#b5bcaa',2);bevel(g,W*.32,seatY-5,W*.19,4,'#594d43','#968c71','#35423a');line(g,stemX,seatY-7,stemX-2,seatY-10,'#c9cbb4',2);line(g,stemX-2,seatY-10,stemX+6,seatY-10,'#d6d2b6',2);rect(g,stemX+5,seatY-11,5,3,'#3c504b');oval(g,crank,crankY,3,3,'#c3b690');line(g,crank,crankY,crank+5,crankY+4,'#d4c8ab',1);rect(g,crank+4,crankY+4,5,2,'#394d48');return;
  }
  if(type==='table') {
    // A shaped table keeps its authored T/L footprint: the broad run is the
    // tabletop, and any projecting cells are wooden trestles, not colored tiles.
    silhouette(g,cells,T,'#654b36',2);silhouette(g,cells,T,'#c69b65',3);
    for(const [cx,cy]of cells){const x=cx*T,y=cy*T;for(let j=7;j<24;j+=7){rect(g,x+3,y+j,18,1,'#b88b57');rect(g,x+5+(j*3%9),y+j-1,5,1,'#d9b17a');}if(set.has([cx+1,cy].join(','))){rect(g,x+20,y+3,6,18,'#c69b65');for(let j=7;j<24;j+=7)rect(g,x+20,y+j,6,1,'#b88b57');}if(set.has([cx,cy+1].join(',')))rect(g,x+3,y+20,18,6,'#c69b65');if(!set.has([cx,cy-1].join(',')))rect(g,x+3,y+2,18,2,'#e3bc80');if(!set.has([cx,cy+1].join(',')))rect(g,x+3,y+21,18,1,'#8e6744');}
    // A folded paper and ceramic mug also distinguish the broad desktop at
    // thumbnail size without introducing lettering or an extra UI badge.
    rect(g,W*.56,7,12,9,'#eadab4');rect(g,W*.56+2,9,8,1,'#b7aa89');rect(g,W*.56+2,12,6,1,'#b7aa89');oval(g,W*.33,10,4,4,'#715740');oval(g,W*.33,9,3,3,'#d7c597');oval(g,W*.33,9,2,2,'#795e40');rect(g,W*.33+3,9,2,2,'#d7c597');return;
  }
  if(type==='piano') {silhouette(g,cells,T,'#3e3834',2);silhouette(g,cells,T,'#69554a',3);rect(g,4,4,W-8,H*.5,'#806452');rect(g,6,6,W-12,2,'#b28c63');rect(g,6,10,W-12,1,'#947653');const yy=Math.round(H*.61);rect(g,3,yy-3,W-6,13,'#312f2e');const keys=Math.max(4,Math.floor((W-8)/4));for(let i=0;i<keys;i++){rect(g,4+i*4,yy,3,9,'#e5ddc7');if(i%7!==2&&i%7!==6)rect(g,6+i*4,yy,2,5,'#34413c');}rect(g,6,H-8,W-12,2,'#aa8457');rect(g,6,H-6,4,4,'#3f3831');rect(g,W-10,H-6,4,4,'#3f3831');return; }
  if(type==='wardrobe') {wood(g,2,2,w,h,true);const seam=Math.round(W/2);rect(g,seam,4,1,H-8,'#543f32');for(const xx of [5,seam+3]){bevel(g,xx,5,W/2-8,H-11,'#9f7045','#c18b56','#765036');rect(g,xx+3,9,W/2-14,2,'#b38251');rect(g,xx+3,H-11,W/2-14,2,'#795134');}bevel(g,seam-5,H*.46,2,7,'#cea956','#f2ce84','#836735');bevel(g,seam+3,H*.46,2,7,'#cea956','#f2ce84','#836735');rect(g,4,H-4,4,3,'#533f30');rect(g,W-8,H-4,4,3,'#533f30');return; }
  if(type==='lamp') {const cx=W/2;oval(g,cx,H-6,W*.35,4,'#695846');oval(g,cx,H-7,W*.28,2,'#c6a462');rect(g,cx-1,H*.25,3,H*.6,'#bda56c');rect(g,cx,H*.25,1,H*.6,'#f1d69b');poly(g,[[cx-W*.22,3],[cx+W*.22,3],[W-3,H*.4],[3,H*.4]],'#c99a5d');poly(g,[[cx-W*.2,4],[cx-2,4],[cx-4,H*.4-2],[5,H*.4-2]],'#edc789');rect(g,3,H*.4-1,W-6,2,'#8c6d46');line(g,W*.7,H*.4,W*.7,H*.56,'#b39355');oval(g,W*.7,H*.57,1,2,'#e2bf77');return; }
  if(type==='rug') {silhouette(g,cells,T,'#615148',2);silhouette(g,cells,T,'#ac6556',3);for(const [cx,cy]of cells){const x=cx*T,y=cy*T;rect(g,x+4,y+4,16,16,'#c18d6b');rect(g,x+6,y+6,12,12,'#647c71');poly(g,[[x+12,y+6],[x+18,y+12],[x+12,y+18],[x+6,y+12]],'#d7b67c');poly(g,[[x+12,y+9],[x+15,y+12],[x+12,y+15],[x+9,y+12]],'#9d5c4e');for(let i=0;i<5;i++){if(!set.has([cx,cy-1].join(',')))rect(g,x+3+i*4,y+1,1,3,'#e6c68e');if(!set.has([cx,cy+1].join(',')))rect(g,x+3+i*4,y+21,1,3,'#e6c68e');}}return; }
  if(type==='aquarium') {bevel(g,2,2,w,h,'#597d78','#9bb6a3','#344e4c');rect(g,4,5,W-8,H-10,'#639d9d');rect(g,5,6,W-10,2,'#a2d0c3');rect(g,4,H-8,W-8,3,'#b6a778');for(let i=0;i<3;i++){const xx=7+i*(W-14)/3;line(g,xx,H-8,xx-2,H*.53,'#4d8061',2);leaf(g,xx,H-9,-4,-6,'#7eaa76');}for(const [xx,yy,col]of [[W*.37,H*.42,'#e1a367'],[W*.67,H*.62,'#e5c58b']]){oval(g,xx,yy,4,2,col);poly(g,[[xx+3,yy],[xx+6,yy-2],[xx+6,yy+2]],col);rect(g,xx-3,yy-1,1,1,'#3f5d57');}line(g,6,9,6,H*.58,'#b8d7c8');rect(g,W-8,8,2,2,'#acd3c8');rect(g,2,H-4,W-4,2,'#49685f');return; }
  carton(g,2,2,w,h);
}
function cargoSprite(type,cells) {
  const key=type+'|'+cells.map(p=>p.join(',')).join(';');if(cache.has(key))return cache.get(key);
  const W=(Math.max(...cells.map(p=>p[0]))+1)*24,H=(Math.max(...cells.map(p=>p[1]))+1)*24;const [c,g]=surface(W,H);drawObject(g,type,cells,W,H);
  // The mask is also the collision footprint, including unusual authored shapes.
  const [m,mg]=surface(W,H);for(const [x,y]of cells)rect(mg,x*24,y*24,24,24,'#fff');g.globalCompositeOperation='destination-in';g.drawImage(m,0,0);g.globalCompositeOperation='source-over';cache.set(key,c);return c;
}
/** x/y/w/h describe the FINAL rotated bounds. cells are final-oriented cells;
 * baseCells, when supplied, are unrotated. r is a clockwise quarter turn. */
export function drawCargo(ctx,type,x,y,w,h,r=0,opts={}) {
  if(!(w>0&&h>0))return;const turns=((Math.round(Math.abs(r)>3?r/90:r)%4)+4)%4;
  const cells=opts.baseCells?normalCells(opts.baseCells):opts.cells?rotateCells(opts.cells,(4-turns)%4):normalCells(DEFAULT_CELLS[type]||[[0,0]]);
  // A single-cell vase has no directional footprint; logical/save rotation must
  // not tip its artwork onto its side. Other cargo keeps its authored rotation.
  const visualTurns=type==='vase'?0:turns;
  const sprite=cargoSprite(type,cells);ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha*=opts.alpha??1;ctx.translate(Math.round(x+w/2),Math.round(y+h/2));ctx.rotate(visualTurns*Math.PI/2);const sw=visualTurns%2?h:w,sh=visualTurns%2?w:h;
  ctx.drawImage(sprite,Math.round(-sw/2),Math.round(-sh/2),Math.round(sw),Math.round(sh));ctx.restore();
}
/** Data URL without CSS url() wrapper, suitable for img.src. */
export function spriteUrl(type) {if(!urls.has(type)){const c=cargoSprite(type,DEFAULT_CELLS[type]||[[0,0]]);urls.set(type,c.toDataURL('image/png'));}return urls.get(type);}

function rivet(g,x,y) {rect(g,x,y,2,2,'#2f665f');rect(g,x,y,1,1,'#d0d6b8');}
function wheelWell(g,x,y,w,h) {bevel(g,x,y,w,h,'#718d7f','#b9c2a7','#425f57');rect(g,x+2,y+3,w-4,h-5,'#819b89');for(let j=5;j<h-2;j+=4)rect(g,x+3,y+j,w-6,1,'#546f63');rivet(g,x+2,y+2);rivet(g,x+w-4,y+h-4);}
function truckBase(cell,w,h,obstacles) {
  const W=Math.round(w*cell/2),H=Math.round(h*cell/2),cab=Math.round(cell*.69),rim=7;
  const signature=JSON.stringify([cell,w,h,obstacles]);if(scenes.has(signature))return scenes.get(signature);
  const [c,g]=surface(W+rim*2+16,H+cab+rim+20),ox=rim+8,oy=cab+3;
  rect(g,ox-10,oy-cab+9,W+23,H+cab+15,'#3a4940');rect(g,ox-7,oy-cab+2,W+14,H+cab+8,'#264e48');
  // Rubber tyres protrude outside the body, with short steel hubs.
  for(const yy of [oy+6,oy+H-25])for(const xx of [ox-12,ox+W+6]){bevel(g,xx,yy,7,22,'#33403b','#526050','#202e2c');rect(g,xx+2,yy+4,2,14,'#5d6c5c');}
  rect(g,ox-7,oy-cab+7,W+14,cab+H-1,C.teal);rect(g,ox-4,oy-cab+3,W+8,7,C.mint);rect(g,ox-2,oy-cab+1,W+4,3,'#9dc9aa');
  // Teal bonnet, recessed dark windshield, roof highlight and wing mirrors.
  bevel(g,ox+1,oy-cab+6,W-2,Math.max(8,cab*.28),'#6aab96','#9dc7a9','#3b7f74');
  poly(g,[[ox+5,oy-cab*.57],[ox+W-5,oy-cab*.57],[ox+W-2,oy-8],[ox+2,oy-8]],'#294e50');
  poly(g,[[ox+7,oy-cab*.53],[ox+W-7,oy-cab*.53],[ox+W-4,oy-11],[ox+4,oy-11]],'#6e9e9c');
  poly(g,[[ox+8,oy-cab*.51],[ox+W*.44,oy-cab*.51],[ox+W*.28,oy-11],[ox+5,oy-11]],'#a1c8b7');
  rect(g,ox+W/2-1,oy-cab*.54,2,cab*.54-9,'#417a71');line(g,ox+W*.12,oy-10,ox+W*.42,oy-11,'#355653',1);line(g,ox+W*.58,oy-10,ox+W*.88,oy-11,'#355653',1);
  for(const xx of [ox-11,ox+W+5]){bevel(g,xx,oy-cab*.52,6,11,'#588f7e','#95b69c','#34574e');rect(g,xx+1,oy-cab*.52+2,3,5,'#a7bfab');}
  // An actual recessed cargo floor; low contrast alternating boards show cells
  // without drawing a graph-paper overlay over the goods.
  rect(g,ox-1,oy-1,W+2,H+2,'#375f51');rect(g,ox,oy,W,H,'#a28155');const u=cell/2;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const px=ox+xx*u,py=oy+yy*u;rect(g,px,py,u,u,(xx+yy)%2?'#b18f5d':'#b69764');rect(g,px+1,py+1,u-2,1,'#c0a574');rect(g,px,py+u-1,u,1,'#9d7d51');for(let n=0;n<2;n++){const sx=px+3+(xx*7+yy*3+n*8)%Math.max(1,Math.floor(u)-7);rect(g,sx,py+4+n*7,4,1,'#ab8959');}rect(g,px+u-1,py,1,u,'#ab8a59');}
  for(const side of [-1,1]){const xx=side<0?ox-7:ox+W;rect(g,xx,oy-2,7,H+4,'#438d7d');rect(g,xx+(side<0?1:0),oy-2,3,H,'#88baa0');rect(g,xx+(side<0?6:0),oy,1,H,'#2e655a');for(let yy=oy+5;yy<oy+H;yy+=22)rivet(g,xx+2,yy);}
  bevel(g,ox-6,oy-5,W+12,6,'#568f7b','#a0c3a2','#2d6255');
  for(const p of obstacles||[]){const xx=Array.isArray(p)?p[0]:p.x,yy=Array.isArray(p)?p[1]:p.y;if(Number.isFinite(xx)&&Number.isFinite(yy))wheelWell(g,ox+xx*u+1,oy+yy*u+1,(p.w||1)*u-2,(p.h||1)*u-2);}
  // Steel threshold and red tail lamps make the bottom entrance unambiguous.
  bevel(g,ox-5,oy+H,W+10,5,'#9aa38b','#d1c6a1','#586a5c');for(const xx of [ox-6,ox+W+1]){bevel(g,xx,oy+H-6,5,8,'#9d5546','#e5a16a','#603f38');rect(g,xx+1,oy+H-5,3,2,'#e6ba79');}
  const result={canvas:c,ox,oy,W,H};scenes.set(signature,result);return result;
}
/** x/y = cargo interior top-left; w/h = column/row counts. Cab and body
 * extend outside that rectangle. progress is door closure 0..1. */
export function drawTruck(ctx,{x,y,cell,w,h,door,obstacles=[],phase='loading',progress=0}) {
  if(!(cell>0&&w>0&&h>0))return;const base=truckBase(cell,w,h,obstacles);ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(base.canvas,Math.round(x-base.ox*2),Math.round(y-base.oy*2),base.canvas.width*2,base.canvas.height*2);
  // Door leaves are filled painted steel, pivoting physically at the rear corners.
  const p=clamp(Number(progress)||(['driving','delivery','arrived'].includes(phase)?1:0),0,1),W=w*cell,H=h*cell;
  ctx.translate(Math.round(x),Math.round(y+H));ctx.scale(2,2);const total=W/2,start=(Array.isArray(door)?door[0]:door?.x??0)*cell/2,opening=(Array.isArray(door)?door[1]-door[0]+1:door?.w??w)*cell/2,leaf=opening/2,theta=(1-p)*Math.PI*.46;
  if(start>0)bevel(ctx,0,-2,start,9,'#52937d','#abd0ab','#2e6657');if(start+opening<total)bevel(ctx,start+opening,-2,total-start-opening,9,'#52937d','#abd0ab','#2e6657');
  for(const side of [-1,1]){const hx=side<0?start:start+opening;const ex=hx-side*leaf*Math.cos(theta),ey=leaf*Math.sin(theta);const nx=-Math.sin(theta)*(side<0?1:-1),ny=Math.cos(theta);const points=[[hx,0],[ex,ey],[ex+nx*4,ey+ny*4],[hx+nx*4,ny*4]];poly(ctx,points,'#326d60');poly(ctx,[[hx,0],[ex,ey],[ex+nx*2,ey+ny*2],[hx+nx*2,ny*2]],'#81b499');line(ctx,hx+nx,ny,ex+nx,ey+ny,'#b4ccaa',1);const mx=(hx+ex)/2,my=ey/2;line(ctx,mx+nx,my+ny,mx+nx+ny*3,my+ny-nx*3,'#c6b77f',2);}
  if(door)rect(ctx,start+2,1,Math.max(0,opening-4),2,'#ddc287');ctx.restore();
}

function yardBase(width,height) {
  const W=Math.ceil(width/2),H=Math.ceil(height/2),key='yard'+W+':'+H;if(scenes.has(key))return scenes.get(key);const[c,g]=surface(W,H);
  rect(g,0,0,W,H,'#6c8072');
  // Quiet pavers, weathered only at their joints. The light center remains free
  // of invented UI decoration so the loaded truck is the visual anchor.
  for(let y=0;y<H;y+=28)for(let x=-((y/28)%2)*25;x<W;x+=50){rect(g,x,y,49,27,((x+y)%3)?'#748779':'#718474');rect(g,x+2,y+1,46,1,'#7b8e7d');if((x+y)%4===0)rect(g,x+10,y+20,8,1,'#6c806f');}
  const dock=Math.min(32,Math.round(W*.14));rect(g,0,0,dock,H,'#826c4f');for(let x=1;x<dock;x+=8){rect(g,x,0,7,H,x%3?'#a08057':'#987752');rect(g,x+1,0,1,H,'#af8e61');for(let y=8;y<H;y+=47){rect(g,x+2,y,2,1,'#655b45');rect(g,x+2,y+2,1,1,'#c0a477');}}rect(g,dock-3,0,3,H,'#4d5d50');rect(g,dock,0,3,H,'#99a28a');
  // Dock bumpers and occasional brass plates communicate the loading-yard setting.
  for(let y=28;y<H;y+=100){bevel(g,dock-3,y,7,23,'#3f5045','#6a7661','#2f4139');rect(g,dock-1,y+4,1,13,'#8c9272');}
  rect(g,W-8,0,8,H,'#607967');rect(g,W-7,0,1,H,'#94a88b');for(let y=0;y<H;y+=48){rect(g,W-5,y+2,3,17,'#506e5a');rect(g,W-4,y+4,1,8,'#9cb28e');}
  scenes.set(key,c);return c;
}
export function drawYard(ctx,width,height,time=0) {if(!(width>0&&height>0))return;const c=yardBase(width,height);ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(c,0,0,c.width*2,c.height*2);ctx.restore();}

/** Small destination vignette. The game supplies the delivery timing and label. */
export function drawDelivery(ctx,{x=0,y=0,w=160,h=96,kind='home',progress=0}={}) {
  const[c,g]=surface(w/2,h/2),W=c.width,H=c.height;rect(g,0,H*.65,W,H*.35,'#849171');rect(g,5,H*.16,W-10,H*.52,'#d0b17c');rect(g,7,H*.2,W-14,H*.46,'#dcc394');rect(g,3,H*.12,W-6,5,'#7e6751');rect(g,5,H*.12,W-10,2,'#b99b6c');
  const dx=W*.58,dw=W*.21;bevel(g,dx,H*.32,dw,H*.37,'#678b78','#a4b49a','#435f52');rect(g,dx+3,H*.36,dw-6,H*.16,'#a7c0b0');rect(g,dx+dw-4,H*.56,2,2,C.brass);bevel(g,12,H*.3,W*.23,H*.21,'#698a86','#d1d2b2','#4c675e');rect(g,14,H*.32,W*.19,H*.15,'#a1b9a6');rect(g,14+W*.09,H*.32,1,H*.15,'#d7cda9');
  if(kind==='shop'){rect(g,6,H*.2,W-12,H*.1,'#bc7256');for(let i=8;i<W-8;i+=8)rect(g,i,H*.2,4,H*.1,'#e5c69c');}else{rect(g,8,H*.6,8,H*.08,'#9b7250');leaf(g,12,H*.61,-4,-10,'#577f53');leaf(g,12,H*.61,5,-8,'#8aa365');}
  if(progress>0)carton(g,W*.4,H*.64,Math.max(9,W*.15),Math.max(9,H*.22));ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(c,Math.round(x),Math.round(y),Math.round(w),Math.round(h));ctx.restore();
}
