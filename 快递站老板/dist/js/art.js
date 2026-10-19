// Original depot sprites. One authored pixel is two scene units; no smoothing.
export const ROUTE_PALETTES = Object.freeze([
  { main:'#e67d55', light:'#ffd69a', dark:'#934d43', deep:'#583d3e', symbol:'A' },
  { main:'#58ad90', light:'#c8e5a5', dark:'#35766e', deep:'#304d50', symbol:'B' },
  { main:'#679cce', light:'#d3e6ec', dark:'#45668e', deep:'#343f60', symbol:'C' },
]);
export const INK = '#343c49';
export function rect(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
export function grid(ctx,rows,palette,x,y,scale=1){
  rows.forEach((row,j)=>[...row].forEach((key,i)=>{if(palette[key])rect(ctx,x+i*scale,y+j*scale,scale,scale,palette[key]);}));
}
export function sprite(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'));return c;}
const LETTERS={
  A:['.###.','##.##','##.##','#####','##.##','##.##'],
  B:['####.','##.##','####.','##.##','##.##','####.'],
  C:['.####','##...','##...','##...','##...','.####'],
};
export function routeMark(ctx,dest,x,y,scale=1,color='#fff3d7'){
  grid(ctx,LETTERS[['A','B','C'][dest]||'A'],{'#':color},x,y,scale);
}
export function routeSymbol(ctx,dest,x,y,color='#fff3d7'){
  const shapes=[['..#..','.###.','#####','#####','.###.'],['..#..','.###.','#####','.###.','..#..'],['#.#.#','.###.','#####','.###.','#.#.#']];
  grid(ctx,shapes[dest]||shapes[0],{'#':color},x,y);
}
const parcelCache=new Map();
const parcelUrls=new Map();
export function parcelSprite(kind='normal',dest=0,prepared=false){
  const key=`${kind}:${dest}:${prepared}`;
  if(parcelCache.has(key))return parcelCache.get(key);
  const p=ROUTE_PALETTES[dest]||ROUTE_PALETTES[0];
  const large=kind==='large',w=large?29:23,h=25;
  const c=sprite(w,h,(ctx)=>{
    const l=2,r=w-3,b=20;
    // Folded corrugated carton: lit lid, taped seam, shaded right face.
    rect(ctx,3,21,w-5,2,'#252f3f55');
    grid(ctx,['...ooooooooooo...','..ohhhhhhhhhhoo..','.ohhhhhhhhhhhmmo.'],{o:'#694b39',h:'#f1ca80',m:'#c99c60'},large?4:3,1);
    rect(ctx,l,5,r-l+1,b-4,'#79553d');rect(ctx,l+1,5,r-l-1,b-5,'#cca06a');
    rect(ctx,l+1,6,r-l-4,12,'#e2b87b');rect(ctx,r-4,5,4,b-6,'#ab7d51');
    rect(ctx,l+2,6,r-l-6,1,'#ffe0a0');rect(ctx,l+2,18,r-l-4,1,'#b78654');
    for(let i=4;i<r-3;i+=5){rect(ctx,i,16,1,1,'#c79b60');rect(ctx,i+1,7,1,1,'#ecc68a');}
    rect(ctx,Math.floor(w/2)-1,3,3,15,'#f7dfa8');rect(ctx,Math.floor(w/2)+1,4,1,14,'#d6b47b');
    rect(ctx,l+1,9,8,9,p.deep);rect(ctx,l+1,8,8,9,p.main);routeMark(ctx,dest,l+2,9,1);
    rect(ctx,r-3,13,3,4,'#f2e5c6');rect(ctx,r-2,14,1,2,'#877556');
    // Shape as well as color identifies handling requirements.
    if(kind==='fragile'){
      rect(ctx,w-9,2,8,8,prepared?'#4a927b':'#ad585c');
      grid(ctx,['#.#','#.#','###','.#.','###'],{'#':'#fff1cc'},w-7,3);
      if(prepared){rect(ctx,0,5,2,13,'#e3eac1');rect(ctx,w-2,5,2,13,'#c0d6ad');rect(ctx,0,4,w,2,'#f0edca');}
    }else if(kind==='urgent'){
      grid(ctx,['...yy.','..yy..','.yyyy.','...y..','..y...'],{y:'#ffed93'},w-8,2);
      rect(ctx,1,19,w-2,2,'#c55b56');
    }else if(kind==='exception'){
      rect(ctx,w-9,2,8,9,prepared?'#4a927b':'#86679c');
      grid(ctx,prepared?['....#','...#.','#.#..','.##..']:['.###.','...#.','..#..','.....','..#..'],{'#':'#fff0d4'},w-8,4);
    }else if(large){rect(ctx,4,20,w-8,2,'#806142');rect(ctx,3,22,5,2,'#5d4c3d');rect(ctx,w-8,22,5,2,'#5d4c3d');}
  });
  parcelCache.set(key,c);return c;
}
export function parcelDataUrl(kind,dest,prepared=false){
  const key=`${kind}:${dest}:${prepared}`;
  if(!parcelUrls.has(key))parcelUrls.set(key,parcelSprite(kind,dest,prepared).toDataURL('image/png'));
  return parcelUrls.get(key);
}

// Deliberately hand-authored silhouettes: cap, face, work vest, gloves and boots.
const WORKER=[
 '.....kkkkk......',
 '....kccccck.....',
 '...kchhhhcck....',
 '...kcccccccck...',
 '....ksssssk.....',
 '....kststsk.....',
 '.....smmms......',
 '....kksskk......',
 '...kcvvvvck.....',
 '..kccvyyvcck....',
 '..kscvyyvcsk....',
 '..kssvyyvssk....',
 '...kkvyyvkk.....',
 '....kvvvvk......',
 '....kpkkpk......',
 '....kpk kpk.....',
 '....kk...kk.....',
];
export function worker(ctx,x,y,{dest=0,step=0,carrying=null,variant=0}={}){
  const p=ROUTE_PALETTES[dest]||ROUTE_PALETTES[0];
  const skin=variant%2?'#bc8969':'#f0c390';
  rect(ctx,x+2,y+16,13,3,'#38475344');
  grid(ctx,WORKER,{k:INK,c:p.dark,h:p.light,s:skin,t:'#403c42',m:'#c98b72',v:p.main,y:'#f7d78c',p:'#3c5267'},x,y);
  rect(ctx,x+4,y+15,3,3,'#384355');rect(ctx,x+10,y+15,3,3,'#384355');
  if(step){rect(ctx,x+3,y+17,4,1,'#303745');rect(ctx,x+10,y+16,4,1,'#303745');}
  else {rect(ctx,x+4,y+16,4,2,'#303745');rect(ctx,x+9,y+17,4,1,'#303745');}
  if(carrying){ctx.drawImage(parcelSprite(carrying.kind,carrying.dest,carrying.prepared),x+3,y+5,14,15);rect(ctx,x+2,y+12,2,3,skin);rect(ctx,x+15,y+12,2,3,skin);}
}
export function plant(ctx,x,y,variant=0){
  rect(ctx,x+3,y+11,10,2,'#573e3f');rect(ctx,x+4,y+13,8,6,'#b16e4e');rect(ctx,x+5,y+13,2,5,'#dc9364');rect(ctx,x+5,y+19,6,1,'#744e42');
  const g=variant?['#49765f','#6c9e70','#a6bb7b']:['#3e786a','#60a77e','#a4ce8a'];
  grid(ctx,['.....gg......','..ggglgg.....','.gllggglg....','gglggggllgg..','.gggglggggg..','..ggggggglgg.','...gggggggg..','.....ggg.....','......g......'],{g:g[0],l:g[1]},x,y+2);
  rect(ctx,x+5,y+3,2,2,g[2]);rect(ctx,x+10,y+7,2,1,g[2]);
}
export function crate(ctx,x,y,dest=0,size=12){
  const p=ROUTE_PALETTES[dest];rect(ctx,x,y,size,size-1,'#77543d');rect(ctx,x+1,y+1,size-2,size-3,'#ce9d65');rect(ctx,x+1,y+1,size-2,2,'#edc583');rect(ctx,x+size-4,y+3,3,size-5,'#b78353');rect(ctx,x+Math.floor(size/2),y+1,2,size-3,'#f1d49b');rect(ctx,x+2,y+4,4,4,p.main);
}
