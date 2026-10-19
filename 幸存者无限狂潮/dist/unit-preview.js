import { unitAssets } from './assets.js';

const envelopes = new Map();
function duration(animation){return animation.frames.reduce((sum,f)=>sum+(f.duration||1)/(animation.fps||8),0);}
function frameAt(animation,time){let cursor=animation.loop?time%duration(animation):Math.min(time,duration(animation)-.001);for(const frame of animation.frames){cursor-=(frame.duration||1)/(animation.fps||8);if(cursor<0)return frame;}return animation.frames.at(-1);}

// Measure the authored frames once. A shared anchor and envelope keep attacks
// from changing size or clipping long weapons when the pose changes.
function envelope(kind,asset,image){
 if(envelopes.has(kind))return envelopes.get(kind);
 const surface=document.createElement('canvas'),ctx=surface.getContext('2d',{willReadFrequently:true}),anchor=asset.anchor||{x:.5,y:.8};
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 const frames=[...(asset.animations.idle?.frames||[]),...(asset.animations.attack?.frames||[])];
 for(const f of frames){surface.width=f.w;surface.height=f.h;ctx.drawImage(image,f.x,f.y,f.w,f.h,0,0,f.w,f.h);const pixels=ctx.getImageData(0,0,f.w,f.h).data;for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++)if(pixels[(y*f.w+x)*4+3]>20){left=Math.min(left,x-f.w*anchor.x);right=Math.max(right,x+1-f.w*anchor.x);top=Math.min(top,y-f.h*anchor.y);bottom=Math.max(bottom,y+1-f.h*anchor.y);}}
 const bounds=Number.isFinite(left)?{left,right,top,bottom}:{left:-40,right:40,top:-64,bottom:16};envelopes.set(kind,bounds);return bounds;
}

export function createUnitPreview(canvas,images={}){
 const kind=canvas.dataset.unitKind,asset=unitAssets[kind],image=images[kind],ctx=canvas.getContext('2d');
 if(!asset||!image||!image.naturalWidth||!ctx)return {attack(){},dispose(){}};
 const bounds=envelope(kind,asset,image),anchor=asset.anchor||{x:.5,y:.8},motion=matchMedia('(prefers-reduced-motion: reduce)');
 let frameId=0,disposed=false,action='idle',time=0,last=0;
 const draw=()=>{
  if(disposed)return;const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight),dpr=Math.min(2,devicePixelRatio||1);
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  const animation=asset.animations[action]||asset.animations.idle,f=frameAt(animation,time),scale=Math.min(width*.9/(bounds.right-bounds.left),height*.78/(bounds.bottom-bounds.top));
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=false;
  const x=width/2-(bounds.left+bounds.right)*scale/2,y=height*.46-(bounds.top+bounds.bottom)*scale/2;
  ctx.drawImage(image,f.x,f.y,f.w,f.h,x-f.w*anchor.x*scale,y-f.h*anchor.y*scale,f.w*scale,f.h*scale);
  canvas.dataset.animation=action;
 };
 function tick(now){frameId=0;if(disposed)return;time+=Math.min(.06,Math.max(0,(now-last)/1000));last=now;if(action==='attack'&&time>=duration(asset.animations.attack)){action='idle';time=0;}draw();if(!motion.matches||action==='attack')frameId=requestAnimationFrame(tick);}
 function start(){if(!frameId){last=performance.now();frameId=requestAnimationFrame(tick);}}
 function motionChanged(){if(motion.matches&&action!=='attack'){cancelAnimationFrame(frameId);frameId=0;time=0;draw();}else start();}
 const observer=new ResizeObserver(draw);observer.observe(canvas);motion.addEventListener('change',motionChanged);draw();if(!motion.matches)start();
 return {attack(){if(disposed||!asset.animations.attack)return;action='attack';time=0;draw();start();},dispose(){disposed=true;cancelAnimationFrame(frameId);observer.disconnect();motion.removeEventListener('change',motionChanged);}};
}
