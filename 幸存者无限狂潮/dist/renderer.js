import {getOriginalHeroAim} from './original-heroes.js';
import {createOriginalHeroRenderer} from './original-hero-renderer.js';
import { getSkillGeometry } from "./combat-stats.js";
import { getBlinkRoute } from "./skill-targeting.js";
import { getBattleCamera } from "./battle-camera.js";
import { createMotionTrails } from "./motion-trails.js";
import { createSpecialHeroRenderer } from './special-hero-renderer.js';
import { getSpecialHeroAim } from './special-heroes.js';
import { createMythicHeroRenderer } from './mythic-hero-renderer.js';
import { getMythicHeroAim } from './mythic-heroes.js';

const TAU = Math.PI * 2;

function pickAnimation(asset, requested) {
  const animations = asset?.animations || {};
  const aliases = { move: ["move", "walk", "run", "idle"], idle: ["idle", "move", "walk"], attack: ["attack", "atk", "idle"], cast: ["cast", "spell", "attack", "atk", "idle"], hit: ["hit", "hurt", "idle"], death: ["death", "defeated", "die", "idle"] };
  for (const name of [requested,...(asset?.animationAliases?.[requested]||[]),...(aliases[requested]||[])]) if (animations[name]?.frames?.length) return animations[name];
  return Object.values(animations).find(a => a?.frames?.length);
}

function frameAt(animation, time, actionDuration = 0) {
  const frames = animation?.frames || [];
  if (!frames.length) return null;
  const fps = animation.fps || 8;
  const total = frames.reduce((sum, f) => sum + (f.duration || 1) / fps, 0) || 1;
  const mappedTime = animation.loop === false && actionDuration > 0 ? time * total / actionDuration : time;
  let cursor = animation.loop === false ? Math.min(mappedTime, total - 0.001) : mappedTime % total;
  for (const frame of frames) { cursor -= (frame.duration || 1) / fps; if (cursor < 0) return frame; }
  return frames.at(-1);
}

export function createRenderer(canvas, unitAssets = {}, images = {}, vfxAssets = {}) {
  const ctx = canvas.getContext("2d");
  let dead = false;
  const terrain = images.terrain;
  const outlinedFrames = new Map();
  const imageBounds = new WeakMap();
  const tintedVfx = new WeakMap();
  const restoredVfxFrames = new Map();
  const coloredFrames = new WeakMap();
  const opticalLineBounds = new WeakMap();
  const groundSmokeBounds = new WeakMap();
  let renderTime = 0, motionReduced = false, viewWidth = 1, viewHeight = 1;
  const glowTiles = new Map(), whiteFrames = new Map();
  const motionTrails = createMotionTrails();
  const specialHeroes = createSpecialHeroRenderer({ctx,unitAssets,images,drawVfx,drawAtlasLine});
  const mythicHeroes = createMythicHeroRenderer({ctx,unitAssets,images,drawVfx,drawAtlasLine,unit});
  const originalHeroes=createOriginalHeroRenderer({ctx,drawVfx,drawAtlasLine,unit,unitAssets,images});

  // Fixed palette and fixed 96px tiles: no frame-sized gradient allocations.
  function glow(x,y,size,tone='ice',alpha=.5) {
    const palette={ice:'#a5ecff',mint:'#8fffd1',gold:'#ffe5a2',violet:'#c5a6ff',fire:'#ffad68',white:'#ffffff'};
    tone=palette[tone]?tone:'ice';
    let tile=glowTiles.get(tone);
    if(!tile){tile=makeCanvas(96,96);const c=tile.getContext('2d'),g=c.createRadialGradient(48,48,2,48,48,48);g.addColorStop(0,palette[tone]);g.addColorStop(.18,palette[tone]+'c0');g.addColorStop(.52,palette[tone]+'38');g.addColorStop(1,palette[tone]+'00');c.fillStyle=g;c.fillRect(0,0,96,96);glowTiles.set(tone,tile);}
    ctx.save();ctx.globalAlpha*=Math.max(0,Math.min(.65,alpha));ctx.globalCompositeOperation='screen';ctx.drawImage(tile,x-size/2,y-size/2,size,size);ctx.restore();
  }

  function drawMotionTrails(game,camera,reducedMotion) {
    const tracked=[];
    const add=(key,shot,style=null)=>tracked.push({key,x:shot.x,y:shot.y,size:Math.min(80,(shot.radius||8)*3),angle:shot.spin??shot.angle??Math.atan2(shot.vy||0,shot.vx||1),style:style||(shot.weapon==='orbit'||shot.weapon==='dagger'||shot.weapon==='markBlade'?'blade':'mote')});
    for(const shot of game.projectiles||[])if(shot.id!=null)add(`shot:${shot.id}`,shot);
    for(const item of game.commonEntities||[])if(item.id!=null&&['orbit','boomerang','bolt','homing'].includes(item.kind))add(`common:${item.id}`,item);
    for(const shot of game.heroKit?.projectiles||[])if(shot.visualShotId!=null)add(`hero:${shot.visualShotId}`,shot,shot.kind==='blade'?'blade':shot.kind==='wind'?'wind':'mote');
    for(let i=0;i<(game.orbitals||[]).length;i++)add(`orbital:${i}`,{...game.orbitals[i],radius:13,angle:renderTime*18+i*2.17},'blade');
    const samples=motionTrails.update(game,renderTime,tracked,{camera,width:viewWidth,height:viewHeight,reducedMotion});
    const blade=images.vfxBlade,bounds=opaqueBounds(blade);
    for(const p of samples){
      const x=p.x-camera.x,y=p.y-camera.y,scale=.55+.35*p.fade;
      if(p.style==='blade'&&blade&&bounds){
        const size=p.size*scale,aspect=bounds.w/bounds.h,w=aspect>=1?size:size*aspect,h=aspect>=1?size/aspect:size;
        ctx.save();ctx.translate(x,y);ctx.rotate(p.angle);ctx.globalAlpha=.24*p.fade*p.fade;ctx.drawImage(blade,bounds.x,bounds.y,bounds.w,bounds.h,-w/2,-h/2,w,h);ctx.restore();
      }else if(p.style==='wind')drawVfx('swordField',vfxDuration(vfxAssets.swordField)*.35,x,y,p.size*1.3*scale,{once:true,angle:p.angle,alpha:.17*p.fade*p.fade});
      else drawVfx('whiteSpark',vfxDuration(vfxAssets.whiteSpark)*(.35+.25*(1-p.fade)),x,y,Math.min(20,p.size*.6)*scale,{once:true,alpha:.28*p.fade*p.fade});
    }
  }

  function impactFragments(x,y,p,r,angle=0,tone='gold',reducedMotion=false,count=9) {
    ctx.save();ctx.globalAlpha*=Math.pow(Math.max(0,1-p),1.35);
    glow(x,y,Math.min(100,r*1.5),tone,.5*(1-p));
    ctx.fillStyle=tone==='fire'?'#ffd096':tone==='violet'?'#ded0ff':'#e6ffff';
    for(let i=0;i<(reducedMotion?Math.min(3,count):count);i++){
      const a=angle+(i*2.39996),travel=r*(.13+(reducedMotion?.34:1-Math.pow(1-p,2)))*(.5+(i%3)*.22);
      drawVfx('whiteSpark',vfxDuration(vfxAssets.whiteSpark)*(.3+p*.45),x+Math.cos(a)*travel,y+Math.sin(a)*travel,(9+i%3*3)*(1-p*.45),{once:true,angle:a,alpha:.6});
    }ctx.restore();
  }

  function drawFeedback(game,camera,reducedMotion) {
    // Prioritize large beats; small hits are sampled at a fixed render budget.
    const events=game.combatFeedback?.events||[];
    const priority=events.filter(e=>['kill','hurt','evolution','supply'].includes(e.type)).slice(-24);
    const small=events.filter(e=>!['kill','hurt','evolution','supply'].includes(e.type)).slice(-24);
    for(const event of [...small,...priority]){
      const p=Math.max(0,Math.min(1,1-event.life/Math.max(.001,event.maxLife))),x=event.x-camera.x,y=event.y-camera.y;
      if(x < -120 || y < -120 || x > viewWidth+120 || y > viewHeight+120)continue;
      if(event.type==='pickup') {glow(x,y-8*(1-p),18*(1-p)+5,'mint',.5*(1-p));continue;}
      const evolution=event.type==='evolution',kill=event.type==='kill',r=evolution?80:kill?(event.boss?68:30):event.type==='supply'?36:18;
      impactFragments(x,y-8,p,r,event.angle||0,evolution?'violet':event.type==='hurt'?'fire':'gold',reducedMotion,evolution?16:kill?8:5);
      if(evolution||event.type==='supply')drawVfx('magicImpact',p*vfxDuration(vfxAssets.magicImpact),x,y-8,r*1.5,{once:true,alpha:(1-p)*.75});
    }
  }

  function makeCanvas(width, height) {
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
    const surface = document.createElement("canvas"); surface.width = width; surface.height = height; return surface;
  }

  function vfxDuration(asset) {
    return (asset?.frames?.length || 1) / (asset?.fps || 12);
  }

  function vfxFrameAt(asset, time, once = false, forceLoop = false) {
    const frames = asset?.frames || [];
    if (!frames.length) return null;
    const frameTime = 1 / (asset.fps || 12), index = Math.floor(Math.max(0, time) / frameTime);
    return frames[!forceLoop && (once || asset.loop === false) ? Math.min(frames.length - 1, index) : index % frames.length];
  }

  // Atlas frames are restored to their authored canvas once, including trimmed and
  // rotated sprites. Drawing then uses a stable anchor instead of stretching the
  // packed rectangle to the gameplay radius.
  function restoredVfxFrame(key, frame) {
    const image = images[`vfx_${key}`];
    if (!image || (!image.complete && !image.naturalWidth) || !frame) return null;
    const cacheKey = `${key}:${frame.x},${frame.y},${frame.w},${frame.h},${frame.rotated ? 1 : 0},${frame.sourceW},${frame.sourceH},${frame.offsetX},${frame.offsetY}`;
    if (restoredVfxFrames.has(cacheKey)) return restoredVfxFrames.get(cacheKey);
    const sourceW = Math.max(1, frame.sourceW || (frame.rotated ? frame.h : frame.w));
    const sourceH = Math.max(1, frame.sourceH || (frame.rotated ? frame.w : frame.h));
    const surface = makeCanvas(sourceW, sourceH), paint = surface.getContext("2d");
    paint.imageSmoothingEnabled = false;
    const offsetX = frame.offsetX || 0, offsetY = frame.offsetY || 0;
    if (frame.rotated) {
      const trim = makeCanvas(frame.h, frame.w), trimCtx = trim.getContext("2d");
      trimCtx.imageSmoothingEnabled = false;
      trimCtx.translate(0, frame.w); trimCtx.rotate(-Math.PI / 2);
      trimCtx.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
      paint.drawImage(trim, offsetX, offsetY);
    } else paint.drawImage(image, frame.x, frame.y, frame.w, frame.h, offsetX, offsetY, frame.w, frame.h);
    // This additive atlas encodes coverage on opaque black; normalize it once.
    if(key==='shockNoise'){const pixels=paint.getImageData(0,0,sourceW,sourceH);for(let i=0;i<pixels.data.length;i+=4){const light=Math.max(pixels.data[i],pixels.data[i+1],pixels.data[i+2]);pixels.data[i+3]=Math.round(pixels.data[i+3]*light/255);pixels.data[i]=234;pixels.data[i+1]=226;pixels.data[i+2]=255;}paint.putImageData(pixels,0,0);}
    restoredVfxFrames.set(cacheKey, surface);
    return surface;
  }

  function colorFrame(surface,color){
    if(!surface||!color)return surface;let colors=coloredFrames.get(surface);if(!colors){colors=new Map();coloredFrames.set(surface,colors);}if(colors.has(color))return colors.get(color);
    const out=makeCanvas(surface.width,surface.height),paint=out.getContext('2d');paint.drawImage(surface,0,0);
    // Keep authored luminance, but give midtones the requested material hue.
    // The old mostly-gray mix turned ice, spirit fire and violet blades into white dust.
    const data=paint.getImageData(0,0,out.width,out.height),rgb=/^#([\da-f]{6})$/i.exec(color);
    if(rgb){const value=parseInt(rgb[1],16),target=[value>>16,(value>>8)&255,value&255];for(let i=0;i<data.data.length;i+=4){if(!data.data[i+3])continue;const light=(.2126*data.data[i]+.7152*data.data[i+1]+.0722*data.data[i+2])/255,body=Math.min(1,light/.72),core=Math.max(0,(light-.72)/.28);for(let c=0;c<3;c++)data.data[i+c]=target[c]*body*(1-core)+255*core;}paint.putImageData(data,0,0);}
    colors.set(color,out);return out;
  }

  function drawVfx(key, time, x, y, size, { angle = 0, alpha = 1, once = false, loop = false, scaleX = 1, scaleY = 1, anchorX = .5, anchorY = .5, filter = "none", tint = null } = {}) {
    const asset = vfxAssets[key], frame = vfxFrameAt(asset, time, once, loop), surface = restoredVfxFrame(key, frame);
    if (!surface) return false;
    const aspect = surface.width / surface.height;
    const width = (aspect >= 1 ? size : size * aspect) * scaleX;
    const height = (aspect >= 1 ? size / aspect : size) * scaleY;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha *= alpha; ctx.filter = filter;
    ctx.drawImage(colorFrame(surface,tint), -width * anchorX, -height * anchorY, width, height); ctx.restore();
    return true;
  }

  function drawAtlasLine(key,time,x,y,tx,ty,width,alpha=1,tint=null) {
    const surface=restoredVfxFrame(key,vfxFrameAt(vfxAssets[key],time,false,true));if(!surface)return false;
    const length=Math.hypot(tx-x,ty-y);if(length<.1)return false;
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(ty-y,tx-x));ctx.globalAlpha*=alpha;
    // Preserve source endpoints, tile the middle without stretching one frame to a screen-wide bar.
    ctx.rotate(-Math.PI/2);const image=colorFrame(surface,tint|| (key==='tesla'?'#a6e9ff':'#ff82dc'));
    let bounds=opticalLineBounds.get(surface);
    if(!bounds){const data=surface.getContext('2d').getImageData(0,0,surface.width,surface.height).data;let left=surface.width,right=0;for(let py=Math.floor(surface.height*.2);py<surface.height*.8;py++)for(let px=0;px<surface.width;px++)if(data[(py*surface.width+px)*4+3]>20){left=Math.min(left,px);right=Math.max(right,px);}bounds={x:Math.max(0,left-3),w:Math.max(1,Math.min(surface.width,right-left+7))};opticalLineBounds.set(surface,bounds);}
    const visibleWidth=key==='beam'?Math.max(5,Math.min(24,width*.34)):Math.min(20,width),cap=Math.min(length*.22,visibleWidth*1.25),sourceCap=surface.height*.18;
    const cropX=key==='beam'?bounds.x:0,cropW=key==='beam'?bounds.w:surface.width;
    const section=(sy,sh,dy,dh)=>{
      if(key==='beam'){ctx.save();ctx.globalAlpha*=.2;ctx.filter='blur(2px)';ctx.drawImage(image,cropX,sy,cropW,sh,-visibleWidth*.72,dy,visibleWidth*1.44,dh);ctx.restore();}
      ctx.drawImage(image,cropX,sy,cropW,sh,-visibleWidth/2,dy,visibleWidth,dh);
    };
    section(0,sourceCap,0,cap);
    const middle=Math.max(0,length-cap*2),tile=Math.max(24,visibleWidth*(surface.height-sourceCap*2)/cropW),count=Math.ceil(middle/tile);
    for(let i=0;i<count;i++){const offset=i*tile,size=Math.min(tile,middle-offset);section(sourceCap,(surface.height-sourceCap*2)*size/tile,cap+offset,size);}
    section(surface.height-sourceCap,sourceCap,length-cap,cap);
    if(key==='beam'){ctx.globalAlpha*=.7;ctx.strokeStyle='#fff5ff';ctx.lineWidth=Math.max(1,Math.min(2.2,width*.035));ctx.beginPath();ctx.moveTo(0,cap*.35);ctx.lineTo(0,length-cap*.35);ctx.stroke();}
    ctx.restore();return true;
  }

  function outlinedFrame(kind, image, frame) {
    if (!image?.complete && !image?.naturalWidth) return null;
    const key = `${kind}:${frame.x},${frame.y},${frame.w},${frame.h}`;
    if (outlinedFrames.has(key)) return outlinedFrames.get(key);
    const pad = 2, surface = makeCanvas(frame.w + pad * 2, frame.h + pad * 2);
    const out = surface.getContext("2d"); out.imageSmoothingEnabled = false;
    const mask = makeCanvas(frame.w, frame.h), maskCtx = mask.getContext("2d");
    maskCtx.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
    maskCtx.globalCompositeOperation = "source-in";
    maskCtx.fillStyle = "rgba(9,14,21,.78)";
    maskCtx.fillRect(0, 0, frame.w, frame.h);
    const offsets = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
    for (const [x, y] of offsets) out.drawImage(mask, pad + x, pad + y);
    if (kind === "hero") {
      maskCtx.globalCompositeOperation = "source-over"; maskCtx.clearRect(0, 0, frame.w, frame.h);
      maskCtx.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
      maskCtx.globalCompositeOperation = "source-in"; maskCtx.fillStyle = "rgba(190,226,231,.32)"; maskCtx.fillRect(0, 0, frame.w, frame.h);
      out.globalAlpha = 0.42; out.drawImage(mask, pad - 1, pad - 1); out.globalAlpha = 1;
    }
    out.drawImage(image, frame.x, frame.y, frame.w, frame.h, pad, pad, frame.w, frame.h);
    outlinedFrames.set(key, surface);
    return surface;
  }

  function opaqueBounds(image) {
    if (!image?.naturalWidth || !image?.naturalHeight) return null;
    if (imageBounds.has(image)) return imageBounds.get(image);
    const surface = makeCanvas(image.naturalWidth, image.naturalHeight), sample = surface.getContext("2d", { willReadFrequently: true });
    sample.drawImage(image, 0, 0);
    const pixels = sample.getImageData(0, 0, image.naturalWidth, image.naturalHeight).data;
    let left = image.naturalWidth, top = image.naturalHeight, right = -1, bottom = -1;
    for (let y = 0; y < image.naturalHeight; y++) for (let x = 0; x < image.naturalWidth; x++) if (pixels[(y * image.naturalWidth + x) * 4 + 3] > 8) {
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const bounds = right >= left ? { x: left, y: top, w: right - left + 1, h: bottom - top + 1 } : null;
    imageBounds.set(image, bounds); return bounds;
  }

  function strokeTexture(image) {
    if (!image?.naturalWidth || !image?.naturalHeight) return null;
    if (tintedVfx.has(image)) return tintedVfx.get(image);
    const surface = makeCanvas(image.naturalWidth, image.naturalHeight), paint = surface.getContext("2d");
    paint.drawImage(image, 0, 0);
    const colored=colorFrame(surface,'#91b7c4');tintedVfx.set(image, colored); return colored;
  }

  function drawTexturedTriangle(image, source, target, alpha = 1) {
    const [s0, s1, s2] = source, [d0, d1, d2] = target;
    const determinant = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
    if (Math.abs(determinant) < 0.001) return;
    const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / determinant;
    const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / determinant;
    const e = (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / determinant;
    const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / determinant;
    const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / determinant;
    const f = (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / determinant;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.beginPath(); ctx.moveTo(d0.x, d0.y); ctx.lineTo(d1.x, d1.y); ctx.lineTo(d2.x, d2.y); ctx.closePath(); ctx.clip(); ctx.transform(a, b, c, d, e, f); ctx.drawImage(image, 0, 0); ctx.restore();
  }

  function drawOrbitals(game, camera, foreground, reducedMotion) {
    const image = images.vfxBlade, bounds = opaqueBounds(image);
    if (!image || !bounds) return;
    for (let index = 0; index < game.orbitals.length; index++) {
      const blade = game.orbitals[index];
      if ((blade.y >= game.player.y) !== foreground) continue;
      const size = 42, aspect = bounds.w / bounds.h;
      const w = aspect >= 1 ? size : size * aspect, h = aspect >= 1 ? size / aspect : size;
      glow(blade.x-camera.x,blade.y-camera.y,44,'mint',.3);
      ctx.save(); ctx.translate(blade.x - camera.x, blade.y - camera.y); ctx.rotate(game.time * 18 + index * 2.17);
      ctx.drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h, -w / 2, -h / 2, w, h); ctx.restore();
    }
  }

  function drawWindblade(effect, camera, reducedMotion) {
    const source = images.vfxStroke, image = strokeTexture(source);
    if (!image) return;
    const textureWidth = image.width, textureHeight = image.height;
    const elapsed = (effect.maxLife || 0.28) - effect.life, sweepDuration = 0.19, tailDuration = 0.09;
    const radius = effect.radius || 118, innerRadius = radius * 0.65, segments = reducedMotion ? 18 : 26;
    const x = effect.x - camera.x, y = effect.y - camera.y;
    for (let i = 0; i < segments; i++) {
      const u0 = i / segments, u1 = (i + 1) / segments, middle = (u0 + u1) * 0.5;
      const arrival = (1 - Math.sqrt(1 - middle)) * sweepDuration, age = reducedMotion ? .035 : elapsed - arrival;
      if (age < 0 || age > tailDuration) continue;
      const fade = Math.sin(Math.min(1, age / 0.018) * Math.PI / 2) * (1 - age / tailDuration);
      const sweep = effect.width || TAU, start = effect.angle - sweep / 2;
      const a0 = start + u0 * sweep, a1 = start + u1 * sweep;
      const p0 = { x: x + Math.cos(a0) * innerRadius, y: y + Math.sin(a0) * innerRadius };
      const p1 = { x: x + Math.cos(a1) * innerRadius, y: y + Math.sin(a1) * innerRadius };
      const p2 = { x: x + Math.cos(a1) * radius, y: y + Math.sin(a1) * radius };
      const p3 = { x: x + Math.cos(a0) * radius, y: y + Math.sin(a0) * radius };
      const sx0 = u0 * textureWidth, sx1 = u1 * textureWidth, sh = textureHeight;
      drawTexturedTriangle(image, [{ x: sx0, y: sh }, { x: sx1, y: sh }, { x: sx1, y: 0 }], [p0, p1, p2], fade * 0.82);
      drawTexturedTriangle(image, [{ x: sx0, y: sh }, { x: sx1, y: 0 }, { x: sx0, y: 0 }], [p0, p2, p3], fade * 0.82);
      ctx.save();ctx.globalAlpha=fade*.25;ctx.fillStyle='#90e5dc';ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(p3.x,p3.y);ctx.closePath();ctx.fill();ctx.restore();
      ctx.save(); ctx.globalAlpha = fade * (reducedMotion ? 0.32 : 0.58); ctx.strokeStyle = "#d9f4f2"; ctx.lineWidth = reducedMotion ? 1 : 1.6; ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); ctx.restore();
    }
  }

  function lifeProgress(effect) {
    const maxLife = Math.max(0.001, effect.maxLife || effect.life || 1);
    return Math.max(0, Math.min(1, 1 - effect.life / maxLife));
  }

  function traceSector(x, y, radius, angle, width) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, radius, angle - width / 2, angle + width / 2); ctx.closePath();
  }

  function strokeCapsule(x, y, toX, toY, halfWidth) {
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(toX,toY);ctx.lineWidth=Math.max(2,halfWidth*2);ctx.lineCap='round';
  }

  function drawTelegraph(effect, camera, reducedMotion) {
    const x = effect.x - camera.x, y = effect.y - camera.y, progress = lifeProgress(effect);
    const pulse = reducedMotion ? 1 : 0.84 + Math.sin(progress * Math.PI * 8) * 0.08;
    ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.fillStyle = `rgba(151,28,35,${0.10 + progress * 0.11})`;
    ctx.strokeStyle = `rgba(255,64,88,${0.72 + progress * 0.25})`;
    ctx.lineWidth = 2.5;
    if (effect.shape === "cone") {
      traceSector(x, y, effect.radius || effect.length || 0, effect.angle || 0, effect.width || 1.35); ctx.fill(); ctx.stroke();
      const r = (effect.radius || effect.length || 0) * Math.max(0.08, 1 - progress);
      ctx.strokeStyle = `rgba(255,100,124,${0.35 + progress * 0.45})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, (effect.angle || 0) - (effect.width || 1.35) / 2, (effect.angle || 0) + (effect.width || 1.35) / 2); ctx.stroke();
    } else if (effect.shape === "line") {
      const angle = effect.angle || 0, length = effect.length || 0, width = effect.width || 0;
      ctx.translate(x, y); ctx.rotate(angle); ctx.beginPath(); ctx.roundRect(-width / 2, -width / 2, length + width, width, width / 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = `rgba(255,100,124,${0.32 + progress * 0.5})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(length * progress, -width / 2); ctx.lineTo(length * progress, width / 2); ctx.stroke();
    } else {
      const radius = effect.radius || 0;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = `rgba(255,100,124,${0.35 + progress * 0.5})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, radius * Math.max(0.06, 1 - progress) * pulse, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  function drawField(effect, camera, reducedMotion) {
    const x = effect.x - camera.x, y = effect.y - camera.y, radius = effect.radius || 0;
    if (!radius) return;
    const frost = effect.type === "frostField", age = Math.max(0, (effect.maxLife || 1) - effect.life);
    const fade = Math.min(1, age / .12, effect.life / .35);
    ctx.save(); ctx.globalAlpha = fade;
    // Soft inward edge marks the true footprint without a dashed targeting grid.
    if (effect.guard) {
      ctx.save();ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.clip();
      drawVfx('shield',reducedMotion?vfxDuration(vfxAssets.shield)*.42:age,x,y-16,Math.min(104,radius*1.4),{loop:true,alpha:.7,tint:'#a1edca'});ctx.restore();
      ctx.strokeStyle='rgba(194,245,222,.24)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.stroke();
      ctx.restore(); return;
    }
    const rim = ctx.createRadialGradient(x,y,radius*.62,x,y,radius);
    rim.addColorStop(0,"rgba(108,210,202,0)");
    rim.addColorStop(.82,frost?"rgba(135,208,236,.08)":"rgba(143,216,199,.07)");
    rim.addColorStop(.96,frost?"rgba(164,225,247,.3)":"rgba(172,227,205,.24)");
    rim.addColorStop(1,"rgba(124,214,206,0)");
    ctx.fillStyle=rim;ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();
    ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.clip();
    const count = frost ? 9 : reducedMotion ? 13 : 25;
    for(let i=0;i<count;i++) {
      const angle=i*2.39996323;
      const distance=i===0?0:radius*.9*Math.sqrt(i/(count-1));
      const px=x+Math.cos(angle)*distance,py=y+Math.sin(angle)*distance;
      if(frost) {
        const time=reducedMotion?vfxDuration(vfxAssets.frost)*.46:age+i*.17;
        drawVfx("frost",time,px,py,90,{alpha:.65,once:reducedMotion,loop:!reducedMotion,scaleY:.75});
      } else {
        // Stagger full cross-slash sequences across the entire disk, including its center.
        const period=.64,cycle=(age+i*.137)%period/period;
        const time=(reducedMotion?.36:cycle)*Math.max(0,vfxDuration(vfxAssets.cleave)-.001);
        drawVfx("cleave",time,px,py,radius*.78,{
          angle:angle+(i%2?Math.PI/4:0),alpha:reducedMotion?.34:.7,once:true
        });
      }
    }
    ctx.restore();
  }

  function drawSweep(effect,camera,reducedMotion) {
    const x=effect.x-camera.x,y=effect.y-camera.y,radius=effect.radius||225;
    const width=effect.width||1.4,start=(effect.angle||0)-width/2;
    const progress=lifeProgress(effect),travel=reducedMotion?1:1-Math.pow(1-Math.min(1,progress/.6),3);
    const end=start+width*travel,fade=Math.min(1,(1-progress)/.35);
    const hostile=effect.hostile;
    ctx.save();ctx.globalAlpha=fade;
    // The fading swept fan shows the whole reach; the moving edge carries the slash.
    const wash=ctx.createRadialGradient(x,y,radius*.06,x,y,radius);
    wash.addColorStop(0,"rgba(150,225,220,0)");
    wash.addColorStop(.72,hostile?"rgba(245,105,78,.1)":"rgba(150,225,220,.012)");
    wash.addColorStop(1,hostile?"rgba(255,141,83,.32)":"rgba(203,246,230,.035)");
    traceSector(x,y,radius,effect.angle||0,width);ctx.fillStyle=wash;ctx.fill();
    const texture=strokeTexture(images.vfxStroke),segments=22;
    if(texture)for(let i=0;i<segments;i++) {
      const u0=i/segments,u1=(i+1)/segments,a0=start+width*u0,a1=start+width*u1;
      if(u0>travel)continue;
      const lag=travel-(u0+u1)/2;
      const opacity=reducedMotion?.5:Math.max(.08,1-lag/ .5);
      const inner=radius*.58;
      const p0={x:x+Math.cos(a0)*inner,y:y+Math.sin(a0)*inner},p1={x:x+Math.cos(a1)*inner,y:y+Math.sin(a1)*inner};
      const p2={x:x+Math.cos(a1)*radius,y:y+Math.sin(a1)*radius},p3={x:x+Math.cos(a0)*radius,y:y+Math.sin(a0)*radius};
      const sx0=u0*texture.width,sx1=u1*texture.width,h=texture.height;
      drawTexturedTriangle(texture,[{x:sx0,y:h},{x:sx1,y:h},{x:sx1,y:0}],[p0,p1,p2],opacity);
      drawTexturedTriangle(texture,[{x:sx0,y:h},{x:sx1,y:0},{x:sx0,y:0}],[p0,p2,p3],opacity);
    }
    ctx.strokeStyle=hostile?"rgba(255,169,106,.85)":"rgba(220,252,236,.85)";
    ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,radius,start,end);ctx.stroke();
    ctx.restore();
  }

  function drawProjectile(shot, camera, reducedMotion) {
    const x = shot.x - camera.x, y = shot.y - camera.y;
    if (shot.weapon === "bladeWave") {
      const angle = Math.atan2(shot.vy || 0, shot.vx || 1);
      if (vfxAssets.cleave && images.vfx_cleave) {
        drawVfx("cleave", reducedMotion ? vfxDuration(vfxAssets.cleave) * .45 : (shot.age || 0), x, y, 105*(shot.radius||24)/24, { angle, alpha: .92, once: true });
        return;
      }
      const image = images.vfxBlade, bounds = opaqueBounds(image);
      if (image && bounds) {
        ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.globalAlpha=.95; ctx.drawImage(image,bounds.x,bounds.y,bounds.w,bounds.h,-45,-18,90,36); ctx.restore(); return;
      }
    }
    if (shot.weapon === "dagger" || shot.weapon === "orbit" || shot.weapon === "markBlade") {
      const image = images.vfxBlade, bounds = opaqueBounds(image), angle = reducedMotion ? Math.atan2(shot.vy||0,shot.vx||1) : shot.weapon === "markBlade" ? renderTime*22 : shot.spin ?? shot.angle ?? 0;
      if (image && bounds) {
        const size = (shot.weapon === "markBlade" ? 34 : 40)*(shot.radius || (shot.weapon==="orbit"?13:10))/(shot.weapon==="orbit"?13:10), aspect = bounds.w / bounds.h, w = aspect >= 1 ? size : size * aspect, h = aspect >= 1 ? size / aspect : size;
        const velocity=Math.hypot(shot.vx||0,shot.vy||0)||1, dx=(shot.vx||0)/velocity, dy=(shot.vy||0)/velocity, side=shot.phase==="returning"?-1:1;
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = .97; ctx.drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h, -w / 2, -h / 2, w, h); ctx.restore(); return;
      }
    }
    if (shot.weapon === "orb" && vfxAssets.magicBolt && images.vfx_magicBolt) {
      // Authored bolt points left: anchor its bright head at the collision center.
      const angle = Math.atan2(shot.vy || 0, shot.vx || 1) + Math.PI;
      const shotTime = Number.isFinite(shot.age) ? shot.age : renderTime;
      const filter = shot.friendly === false ? "hue-rotate(325deg) saturate(1.25)" : "hue-rotate(125deg) saturate(.8)";
      drawVfx("magicBolt", reducedMotion ? 0 : shotTime, x, y, 68*(shot.radius||7)/7, { angle, anchorX:.11, filter });
      return;
    }
    ctx.save(); ctx.fillStyle = shot.friendly ? "#9dffd4" : "#91ecff"; ctx.beginPath(); ctx.arc(x, y, shot.radius, 0, TAU); ctx.fill(); ctx.restore();
  }

  function drawEnemyProjectile(shot, camera, reducedMotion) {
    if (shot.kind === 'laneShell') {
      const asset = unitAssets[shot.resourceKey], image = images[shot.resourceKey];
      const frame = frameAt(asset?.animations?.projectile, Math.max(0, (shot.maxLife || 0) - (shot.life || 0)));
      if (frame && image) {
        // The authored projectile points right and includes its own smoke trail.
        // Its luminous nose, rather than the transparent atlas centre, follows collision geometry.
        const surface = outlinedFrame(shot.resourceKey, image, frame);
        ctx.save(); ctx.translate(shot.x-camera.x,shot.y-camera.y); ctx.rotate(Math.atan2(shot.vy||0,shot.vx||1));
        ctx.imageSmoothingEnabled=false;
        const size=82, aspect=frame.w/frame.h;
        ctx.drawImage(surface,-size*aspect*.86,-size*.69,size*aspect,size);
        ctx.strokeStyle='rgba(255,193,126,.65)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,shot.radius||9,0,TAU);ctx.stroke();
        ctx.restore(); return;
      }
    }
    const x = shot.x - camera.x, y = shot.y - camera.y, radius = Math.max(1, shot.radius || 5);
    ctx.save();
    // The opaque round core matches collision radius; a small halo carries no geometry.
    if (!reducedMotion) {const glow=ctx.createRadialGradient(x,y,radius*.5,x,y,radius*1.55);glow.addColorStop(0,'rgba(255,58,74,.5)');glow.addColorStop(1,'rgba(255,58,74,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,radius*1.55,0,TAU);ctx.fill();}
    ctx.fillStyle='#ef344b';ctx.strokeStyle='#561524';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();ctx.stroke();
    ctx.fillStyle='#ffb4be';ctx.beginPath();ctx.arc(x-radius*.24,y-radius*.25,radius*.3,0,TAU);ctx.fill();ctx.restore();
  }

  function drawEnemyWarning(enemy, camera) {
    const warning = enemy.attackWarning;
    if (!warning) return;
    if(warning.type==='shot'){
      const x=enemy.x-camera.x,y=enemy.y-camera.y,r=(enemy.radius||16)+7,p=1-(warning.remaining||0)/Math.max(.001,warning.total||1),a=warning.angle||0;
      ctx.save();ctx.strokeStyle='#28121c';ctx.lineWidth=5;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();ctx.strokeStyle='#ff5268';ctx.lineWidth=2;ctx.stroke();
      ctx.beginPath();ctx.arc(x,y,r+4,-Math.PI/2,-Math.PI/2+TAU*p);ctx.stroke();ctx.beginPath();ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);ctx.lineTo(x+Math.cos(a)*(r+28),y+Math.sin(a)*(r+28));ctx.stroke();ctx.restore();return;
    }
    if(warning.type!=='charge')return;
    const x = enemy.x - camera.x, y = enemy.y - camera.y, angle = warning.angle || 0;
    const total = Math.max(.001, warning.total || warning.remaining || 1);
    const progress = Math.max(0, Math.min(1, 1 - (warning.remaining || 0) / total));
    const origin = Math.max(8, enemy.radius || 16), length = warning.type === "charge" ? 230 : 470;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (warning.type === "charge") {
      const near = Math.max(12, origin * .75), far = 38;
      ctx.fillStyle = `rgba(181,45,32,${.12 + progress * .13})`;
      ctx.strokeStyle = `rgba(255,52,76,${.62 + progress * .3})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(origin, -near); ctx.lineTo(length, -far); ctx.lineTo(length, far); ctx.lineTo(origin, near); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = `rgba(255,80,104,${.16 + progress * .18})`;
      ctx.beginPath(); ctx.moveTo(origin, -near * .72); ctx.lineTo(origin + (length - origin) * progress, -far * progress); ctx.lineTo(origin + (length - origin) * progress, far * progress); ctx.lineTo(origin, near * .72); ctx.closePath(); ctx.fill();
    } else {
      ctx.strokeStyle = `rgba(113,35,30,${.34 + progress * .22})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(origin, 0); ctx.lineTo(length, 0); ctx.stroke();
      ctx.strokeStyle = `rgba(255,52,76,${.58 + progress * .38})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(origin, 0); ctx.lineTo(length, 0); ctx.stroke();
      ctx.strokeStyle = "rgba(255,100,124,.9)"; ctx.lineWidth = 2;
      const marker = origin + (length - origin) * progress;
      ctx.beginPath(); ctx.moveTo(marker, -7); ctx.lineTo(marker, 7); ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpecialSkillAim(target,camera) {
    const x=target.x-camera.x,y=target.y-camera.y;
    const circle=(cx,cy,r)=>{ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(cx-7,cy);ctx.lineTo(cx+7,cy);ctx.moveTo(cx,cy-7);ctx.lineTo(cx,cy+7);ctx.stroke();};
    const arrow=(ax,ay,bx,by)=>{const angle=Math.atan2(by-ay,bx-ax);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.moveTo(bx-Math.cos(angle-.5)*12,by-Math.sin(angle-.5)*12);ctx.lineTo(bx,by);ctx.lineTo(bx-Math.cos(angle+.5)*12,by-Math.sin(angle+.5)*12);ctx.stroke();};
    if(target.kind==='unavailable'){
      ctx.fillStyle='#e5d7ba';ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillText(target.label||'先放置远门',x,y-45);return;
    }
    if(target.kind==='circle'){
      if(target.ring&&target.innerRadius>0){ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,target.radius,0,TAU);ctx.arc(x,y,target.innerRadius,TAU,0,true);ctx.closePath();ctx.fill();ctx.stroke();}
      else circle(x,y,target.radius);
      if(target.fromX!=null){ctx.save();ctx.globalAlpha*=.5;ctx.setLineDash([6,7]);arrow(target.fromX-camera.x,target.fromY-camera.y,x,y);ctx.restore();}
      return;
    }
    if(target.kind==='self'){circle(x,y,target.radius);return;}
    if(target.kind==='sector'){ctx.lineWidth=2;traceSector(x,y,target.radius,target.angle||0,target.arc||target.spread||1.6);ctx.fill();ctx.stroke();return;}
    if(target.kind==='capsule'){
      const tx=target.toX-camera.x,ty=target.toY-camera.y,r=target.width,a=Math.atan2(ty-y,tx-x);
      // A closed footprint separates the translucent area from its thin outline.
      // The legacy strokeCapsule helper draws a thick line and must not set aim width.
      ctx.lineWidth=2;ctx.beginPath();
      if(Math.hypot(tx-x,ty-y)<.001)ctx.arc(x,y,r,0,TAU);
      else {
        ctx.moveTo(x-Math.sin(a)*r,y+Math.cos(a)*r);
        ctx.lineTo(tx-Math.sin(a)*r,ty+Math.cos(a)*r);
        ctx.arc(tx,ty,r,a+Math.PI/2,a-Math.PI/2,true);
        ctx.lineTo(x+Math.sin(a)*r,y-Math.cos(a)*r);
        ctx.arc(x,y,r,a-Math.PI/2,a+Math.PI/2,true);
      }
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.save();ctx.globalAlpha*=.8;arrow(x,y,tx,ty);ctx.restore();
      if(target.radius>0)circle(tx,ty,target.radius);
      return;
    }
    if(target.kind==='gates'){
      // Exit arrows indicate launch direction only; homing selects its target at release.
      for(const gate of target.gates||[]){const gx=gate.x-camera.x,gy=gate.y-camera.y,a=gate.angle||0;circle(gx,gy,30);ctx.save();ctx.setLineDash([5,6]);arrow(gx,gy,gx+Math.cos(a)*62,gy+Math.sin(a)*62);ctx.restore();}
    }
  }

  function drawSkillAim(game,camera) {
    const aim=game.skillAim;
    if(!aim || game.phase!=="playing")return;
    const p=game.player,geometry=getSkillGeometry(game,aim.id)||{},angle=Math.atan2(aim.y,aim.x),x=p.x-camera.x,y=p.y-camera.y;
    ctx.save();ctx.strokeStyle=aim.cancelled?'#f49d93':'#a4f2e3';ctx.fillStyle=aim.cancelled?'rgba(210,76,66,.12)':'rgba(86,203,192,.14)';ctx.lineWidth=2;
    const specialAim=getOriginalHeroAim(game,aim.id,aim)||getSpecialHeroAim(game,aim.id,aim)||getMythicHeroAim(game,aim.id,aim);
    if(specialAim)drawSpecialSkillAim(specialAim,camera);
    else if(aim.id==='cleave') {traceSector(x,y,geometry.radius,angle,geometry.angle);ctx.fill();ctx.stroke();}
    else if(aim.id==='quickCut') {
      const tx=Math.max(p.radius,Math.min(game.world.width-p.radius,p.x+aim.x*geometry.length))-camera.x,ty=Math.max(p.radius,Math.min(game.world.height-p.radius,p.y+aim.y*geometry.length))-camera.y;
      ctx.save();ctx.globalAlpha*=.5;strokeCapsule(x,y,tx,ty,geometry.width);ctx.stroke();ctx.restore();
      ctx.lineWidth=2;strokeCapsule(x,y,tx,ty,geometry.width);ctx.stroke();
    }
    else if(aim.id==='whirlwind') {ctx.beginPath();ctx.arc(x,y,geometry.radius,0,TAU);ctx.fill();ctx.stroke();}
    else if(aim.id==='guard') {ctx.beginPath();ctx.arc(x,y,72,0,TAU);ctx.fill();ctx.stroke();}
    else if(aim.id==='bladeWave') {
      const tx=x+Math.cos(angle)*geometry.length,ty=y+Math.sin(angle)*geometry.length;
      ctx.save();ctx.globalAlpha*=.5;strokeCapsule(x,y,tx,ty,geometry.width);ctx.stroke();ctx.restore();ctx.lineWidth=2;strokeCapsule(x,y,tx,ty,geometry.width);ctx.stroke();
    }
    else if(aim.id==='swordField') {
      const tx=Math.max(40,Math.min(game.world.width-40,p.x+aim.x*geometry.length))-camera.x;
      const ty=Math.max(40,Math.min(game.world.height-40,p.y+aim.y*geometry.length))-camera.y;
      ctx.beginPath();ctx.arc(tx,ty,geometry.radius,0,TAU);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.stroke();
      ctx.beginPath();ctx.moveTo(tx-9,ty);ctx.lineTo(tx+9,ty);ctx.moveTo(tx,ty-9);ctx.lineTo(tx,ty+9);ctx.stroke();
    } else if(aim.id==='summonGuard' || aim.id==='summonElite') {
      // Spawn angle is random: show the truthful 54px spawn orbit instead of a fake point.
      ctx.beginPath();ctx.arc(x,y,54,0,TAU);ctx.fill();ctx.stroke();
    } else if(aim.id==='recallSummons') {
      ctx.beginPath();ctx.arc(x,y,92,0,TAU);ctx.fill();ctx.stroke();
      for(const ally of game.companions||[]){ctx.beginPath();ctx.moveTo(ally.x-camera.x,ally.y-camera.y);ctx.lineTo(x,y);ctx.stroke();}
    } else if(aim.id==='markBlade') {
      const range=geometry.length||240;
      const tx=Math.max(20,Math.min(game.world.width-20,p.x+aim.x*range))-camera.x,ty=Math.max(20,Math.min(game.world.height-20,p.y+aim.y*range))-camera.y;
      ctx.save();ctx.globalAlpha*=.42;strokeCapsule(x,y,tx,ty,geometry.width);ctx.stroke();ctx.restore();ctx.lineWidth=2;ctx.setLineDash([8,7]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(tx,ty,24,0,TAU);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(tx-16,ty);ctx.lineTo(tx+16,ty);ctx.moveTo(tx,ty-16);ctx.lineTo(tx,ty+16);ctx.stroke();
    } else if(aim.id==='blinkStrike' || aim.id==='blinkStorm') {
      const route=getBlinkRoute(game,{skillId:aim.id,anchorId:aim.anchorId});
      drawBlinkRoute(game,camera,route,{x:p.x,y:p.y},geometry.radius||96);
    } else if(aim.id==='flameBreath') {
      traceSector(x,y,geometry.radius,angle,geometry.angle);ctx.fill();ctx.stroke();
    } else if(aim.id==='rockWall') {
      const halfArc=geometry.angle/2;
      ctx.beginPath();ctx.arc(x,y,geometry.radius+geometry.width/2,angle-halfArc,angle+halfArc);ctx.arc(x,y,geometry.radius-geometry.width/2,angle+halfArc,angle-halfArc,true);ctx.closePath();ctx.fill();ctx.stroke();
    } else if(aim.id==='frostAura') {
      const tx=(aim.targetX??p.x)-camera.x,ty=(aim.targetY??p.y)-camera.y;
      ctx.beginPath();ctx.arc(tx,ty,geometry.radius,0,TAU);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(tx-8,ty);ctx.lineTo(tx+8,ty);ctx.moveTo(tx,ty-8);ctx.lineTo(tx,ty+8);ctx.stroke();
    } else {
      const fixedDashLength=aim.id==='dash'?135:(geometry.length||135),halfWidth=geometry.width||34;
      const tx=Math.max(p.radius,Math.min(game.world.width-p.radius,p.x+aim.x*fixedDashLength))-camera.x;
      const ty=Math.max(p.radius,Math.min(game.world.height-p.radius,p.y+aim.y*fixedDashLength))-camera.y;
      const length=Math.hypot(tx-x,ty-y);
      ctx.save();ctx.globalAlpha*=.5;strokeCapsule(x,y,tx,ty,halfWidth);ctx.stroke();ctx.restore();
      ctx.lineWidth=2;strokeCapsule(x,y,tx,ty,halfWidth);ctx.stroke();
      const ux=(tx-x)/(length||1),uy=(ty-y)/(length||1),arrowX=tx-ux*Math.min(22,length*.3),arrowY=ty-uy*Math.min(22,length*.3);
      ctx.beginPath();ctx.moveTo(arrowX-uy*9,arrowY+ux*9);ctx.lineTo(tx,ty);ctx.lineTo(arrowX+uy*9,arrowY-ux*9);ctx.stroke();
    }
    ctx.restore();
  }

  function drawWorldObjects(game,camera) {
    for(const item of game.mapObjects || []) {
      const x=item.x-camera.x,y=item.y-camera.y;
      if(x < -180 || y < -180 || x>canvas.clientWidth+180 || y>canvas.clientHeight+180)continue;
      const finished=['completed','destroyed','expired'].includes(item.state);
      ctx.save();ctx.translate(x,y);ctx.globalAlpha=finished?.4:1;
      ctx.fillStyle='#08151370';ctx.beginPath();ctx.ellipse(0,12,26,10,0,0,TAU);ctx.fill();
      if(item.type==='tree') {
        ctx.fillStyle='#584638';ctx.fillRect(-5,-14,10,30);
        for(let i=0;i<3;i++){ctx.fillStyle=['#203f37','#315647','#416d53'][i];ctx.beginPath();ctx.moveTo(0,-75+i*17);ctx.lineTo(30-i*4,-18+i*14);ctx.lineTo(-30+i*4,-18+i*14);ctx.closePath();ctx.fill();}
      } else if(item.type==='ruins') {
        ctx.fillStyle='#596965';ctx.fillRect(-23,-23,46,28);ctx.fillStyle='#839084';ctx.fillRect(-26,-30,52,8);ctx.fillStyle='#354b41';ctx.fillRect(-20,-28,12,6);ctx.fillRect(8,-12,16,7);
      } else if(item.type==='crate') {
        ctx.fillStyle='#624225';ctx.fillRect(-18,-20,36,34);ctx.strokeStyle='#c8a267';ctx.lineWidth=3;ctx.strokeRect(-18,-20,36,34);ctx.beginPath();ctx.moveTo(-16,-18);ctx.lineTo(16,12);ctx.moveTo(16,-18);ctx.lineTo(-16,12);ctx.stroke();
      } else if(item.type==='fountain') {
        ctx.fillStyle='#536e70';ctx.beginPath();ctx.ellipse(0,0,28,15,0,0,TAU);ctx.fill();ctx.fillStyle='#6ec9c3';ctx.beginPath();ctx.ellipse(0,-3,21,10,0,0,TAU);ctx.fill();ctx.fillStyle='#b8e8d8';ctx.fillRect(-3,-29,6,16);ctx.fillRect(-8,-24,16,5);
      } else if(item.type==='beacon') {
        ctx.strokeStyle=item.state==='active'?'#f4cc77':'#78857b';ctx.fillStyle=item.state==='active'?'#e4ba6520':'#7c96800c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,item.radius||140,0,TAU);ctx.fill();ctx.stroke();
        ctx.fillStyle='#536367';ctx.fillRect(-12,-36,24,45);ctx.fillStyle=item.state==='active'?'#ffd987':'#8ba8a1';ctx.beginPath();ctx.moveTo(0,-58);ctx.lineTo(12,-42);ctx.lineTo(0,-27);ctx.lineTo(-12,-42);ctx.closePath();ctx.fill();
      }
      if(item.progress>0&&!finished){ctx.strokeStyle='#a3f1ce';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,34,-Math.PI/2,-Math.PI/2+TAU*item.progress);ctx.stroke();}
      const near=Math.hypot(item.x-game.player.x,item.y-game.player.y)<210;
      if(near && !['tree','ruins'].includes(item.type)) {
        const label=finished?'已使用':item.type==='crate'?'补给箱 · 靠近击破':item.type==='fountain'?'恢复泉 · 停留恢复':item.state==='active'?'据点 · 圈内驻守':item.state==='locked'?'据点尚未激活':'据点已结束';
        ctx.font='11px system-ui';ctx.textAlign='center';const w=ctx.measureText(label).width+12;ctx.fillStyle='#0a171ce8';ctx.fillRect(-w/2,25,w,20);ctx.fillStyle='#ead8af';ctx.fillText(label,0,39);
      }
      ctx.restore();
    }
  }

  function drawMinimap(game,width,height,camera) {
    const w=height<=500?76:104,h=w*.75,x=14,y=height<=500?108:112;
    const sx=w/game.world.width,sy=h/game.world.height;
    ctx.save();ctx.fillStyle='#07191ce6';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#74928a';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);
    ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    for(const obj of game.mapObjects||[]) {
      if(['destroyed','completed','expired'].includes(obj.state))continue;
      ctx.fillStyle=obj.type==='beacon'?(obj.state==='active'?'#ffd376':'#857e69'):obj.type==='fountain'?'#7cdcd1':obj.type==='crate'?'#c89557':'#42594c';
      const r=obj.type==='beacon'?3:2;ctx.fillRect(x+obj.x*sx-r,y+obj.y*sy-r,r*2,r*2);
    }
    for(const enemy of game.enemies)if(!enemy.dead){ctx.fillStyle=enemy.boss?'#ff8169':'#a65a54';const r=enemy.boss?3:1;ctx.fillRect(x+enemy.x*sx-r,y+enemy.y*sy-r,2*r,2*r);}
    ctx.strokeStyle='#c4e1d044';ctx.strokeRect(x+camera.x*sx,y+camera.y*sy,width*sx,height*sy);
    ctx.fillStyle='#f0fff1';ctx.beginPath();ctx.arc(x+game.player.x*sx,y+game.player.y*sy,3,0,TAU);ctx.fill();ctx.restore();
    ctx.save();ctx.font='9px system-ui';ctx.textAlign='right';ctx.fillStyle='#d0ddc7';ctx.fillText('金：据点  青：恢复',x+w,y+h+12);ctx.restore();
  }

  function drawSupply(supply, camera) {
    const x = supply.x - camera.x, y = supply.y - camera.y;
    ctx.save();
    ctx.fillStyle = "rgba(3,10,10,.46)"; ctx.beginPath(); ctx.ellipse(x, y + 8, 15, 5, 0, 0, TAU); ctx.fill();
    ctx.translate(x, y); ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.fillStyle = supply.type === "magnet" ? "#284e58" : "#265344";
    ctx.strokeStyle = supply.type === "magnet" ? "#8edbea" : "#9ce4b1"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-13, -13, 26, 25, 5); ctx.fill(); ctx.stroke();
    if (supply.type === "magnet") {
      ctx.strokeStyle = "#f0d18b"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, -1, 7, 0, Math.PI); ctx.lineTo(-7, -8); ctx.moveTo(7, -1); ctx.lineTo(7, -8); ctx.stroke();
      ctx.strokeStyle = "#e46e5b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-7, -8); ctx.lineTo(-7, -5); ctx.moveTo(7, -8); ctx.lineTo(7, -5); ctx.stroke();
    } else {
      ctx.fillStyle = "#e9f4d6"; ctx.fillRect(-3, -9, 6, 18); ctx.fillRect(-9, -3, 18, 6);
    }
    ctx.restore();
  }

  function drawAnnouncement(game, width, height) {
    // The compact boss label already announces the encounter on short screens;
    // suppress the temporary ordinary-wave card while that encounter owns the HUD.
    if(height<=500 && game.boss && !game.boss.dead)return;
    const announcement = game.announcement;
    if (!announcement?.text || announcement.remaining <= 0) return;
    const alpha = Math.min(1, announcement.remaining / .45, (3.2 - announcement.remaining) / .24);
    if (alpha <= 0) return;
    const encounter = game.encounter;
    const title = announcement.text;
    const detail = [encounter?.name, encounter?.hint].filter(text => text && text !== title).join(" · ");
    ctx.save(); ctx.font = "700 15px system-ui";
    const titleWidth = ctx.measureText(title).width;
    ctx.font = "11px system-ui";
    const detailWidth = detail ? ctx.measureText(detail).width : 0;
    const y = height <= 500 ? 94 : 112, boxWidth = Math.min(width - 48, Math.max(210, titleWidth + 64, detailWidth + 48));
    ctx.globalAlpha = alpha; ctx.textAlign = "center";
    ctx.fillStyle = "rgba(8,22,23,.78)"; ctx.strokeStyle = "rgba(215,174,93,.72)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect((width - boxWidth) / 2, y, boxWidth, detail ? 48 : 34, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f5d998"; ctx.font = "700 15px system-ui"; ctx.fillText(title, width / 2, y + 22);
    if (detail) { ctx.fillStyle = "#bdd8cb"; ctx.font = "11px system-ui"; ctx.fillText(detail, width / 2, y + 39); }
    ctx.restore();
  }

  function drawBossEffect(effect,camera,reducedMotion) {
    const x=effect.x-camera.x,y=effect.y-camera.y,p=lifeProgress(effect);
    const key=effect.type,asset=vfxAssets[key];
    if(!asset)return;
    const time=(reducedMotion?.48:p)*Math.max(0,vfxDuration(asset)-.001);
    const fade=Math.min(1,(1-p)/.22);
    ctx.save();ctx.globalAlpha=fade;
    if(key==="bossCleave") {
      const r=effect.radius,angle=effect.angle||0;
      // The dedicated flame slash is contained by its authored attack footprint.
      traceSector(x,y,r,angle,effect.width||1.35);ctx.clip();
      drawVfx(key,time,x+Math.cos(angle)*r*.48,y+Math.sin(angle)*r*.48,r*1.6,{angle,once:true});
    } else if(key==="bossCharge") {
      const tx=effect.toX-camera.x,ty=effect.toY-camera.y,angle=Math.atan2(ty-y,tx-x);
      const count=reducedMotion?2:5;
      for(let i=0;i<count;i++) {
        const t=i/(count-1),phase=Math.max(0,p-i*.035);
        drawVfx(key,(reducedMotion?.48:phase)*Math.max(0,vfxDuration(asset)-.001),x+(tx-x)*t,y+(ty-y)*t,130,{
          angle,once:true,alpha:.55+t*.4
        });
      }
    } else {
      const r=effect.radius;
      // Ground-fault columns rise vertically; distribute them across the impact disk.
      drawVfx(key,time,x,y,230,{once:true,anchorY:.83});
      const count=reducedMotion?3:6;
      for(let i=0;i<count;i++) {
        const a=i*TAU/count,d=r*.68;
        drawVfx(key,time,x+Math.cos(a)*d,y+Math.sin(a)*d,125,{
          once:true,anchorY:.83,alpha:.8
        });
      }
    }
    ctx.restore();
  }

  function drawHeroFrost(effect, camera, reducedMotion) {
    const x=effect.x-camera.x,y=effect.y-camera.y,r=effect.radius||150;
    const age=Math.max(0,(effect.maxLife||6)-effect.life),endFade=Math.min(1,effect.life/.4);
    ctx.save();ctx.globalAlpha=endFade;
    const floor=ctx.createRadialGradient(x,y,0,x,y,r);
    floor.addColorStop(0,'rgba(104,176,207,.06)');floor.addColorStop(.8,'rgba(134,213,235,.12)');floor.addColorStop(1,'rgba(163,222,240,0)');
    ctx.fillStyle=floor;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
    ctx.strokeStyle='rgba(158,220,243,.4)';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(x,y,r-1,0,TAU);ctx.stroke();
    // Low, translucent banks of mist stay inside the actual damage circle.
    ctx.save();ctx.beginPath();ctx.arc(x,y,r-2,0,TAU);ctx.clip();
    for(let i=0;i<6;i++){
      const t=reducedMotion?0:age*.19,a=i*2.39996+t*.3;
      const mx=x+Math.cos(a)*r*(.25+(i%3)*.17),my=y+Math.sin(a*.9)*r*.55;
      ctx.save();ctx.translate(mx,my);ctx.scale(1,.5);
      const mist=ctx.createRadialGradient(0,0,0,0,0,r*.68);
      mist.addColorStop(0,'rgba(187,229,238,.09)');mist.addColorStop(.55,'rgba(168,218,229,.045)');mist.addColorStop(1,'rgba(168,218,229,0)');
      ctx.fillStyle=mist;ctx.beginPath();ctx.arc(0,0,r*.68,0,TAU);ctx.fill();ctx.restore();
    }
    ctx.restore();
    const lanes=reducedMotion?18:30,period=1.15,fallTime=reducedMotion?.48:.34;
    const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
    for(let i=0;i<lanes;i++){
      const local=age-i*period/lanes;if(local<0)continue;
      const cycle=Math.floor(local/period),phase=local%period,seed=i+cycle*lanes;
      const a=hash(seed+1)*TAU,d=Math.sqrt(hash(seed+79))*r*.91;
      const px=x+Math.cos(a)*d,py=y+Math.sin(a)*d;
      const size=30+hash(seed+181)*16;
      if(phase<fallTime){
        const t=phase/fallTime,drop=reducedMotion?42:110,tipY=py-drop*(1-t*t);
        drawVfx('iceRain',0,px,tipY,size,{angle:Math.PI,once:true,alpha:Math.min(1,t*6)*.82,anchorY:.01});
      } else if(phase<fallTime+.22){
        const t=(phase-fallTime)/.22;
        ctx.save();ctx.globalAlpha*=1-t;ctx.strokeStyle='rgba(173,230,247,.5)';ctx.lineWidth=1;
        ctx.beginPath();ctx.ellipse(px,py,3+t*9,1.5+t*3,0,0,TAU);ctx.stroke();
        // Small pieces use the same approved crystal, without a bright impact flash.
        for(let k=0;k<3;k++){
          const dir=k*TAU/3+hash(seed)*TAU;
          drawVfx('iceRain',0,px+Math.cos(dir)*t*12,py-5-Math.sin(t*Math.PI)*8+Math.sin(dir)*t*4,7+(k%2)*3,{angle:dir,once:true,alpha:.55});
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawPoisonField(effect,camera,reducedMotion) {
    const x=effect.x-camera.x,y=effect.y-camera.y,r=Math.max(0,effect.radius||0),age=Math.max(0,(effect.maxLife||effect.life||1)-effect.life);
    if(!r)return;ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.clip();
    ctx.globalAlpha=Math.min(1,effect.life/.4);
    const pool=ctx.createRadialGradient(x,y,r*.08,x,y,r);pool.addColorStop(0,'rgba(32,80,42,.12)');pool.addColorStop(.72,'rgba(66,151,72,.05)');pool.addColorStop(.94,'rgba(111,190,76,.08)');pool.addColorStop(1,'rgba(111,190,76,0)');ctx.fillStyle=pool;ctx.fillRect(x-r,y-r,r*2,r*2);
    // Low smoke clumps leave open ground and retain the true poison footprint.
    for(let i=0;i<8;i++){
      const a=i*2.39996,d=r*.78*Math.sqrt((i+.5)/8),px=x+Math.cos(a)*d,py=y+Math.sin(a)*d;
      const time=reducedMotion?vfxDuration(vfxAssets.poisonCloud)*.45:age+i*.19;
      const surface=restoredVfxFrame('poisonCloud',vfxFrameAt(vfxAssets.poisonCloud,time,false,true));if(!surface)continue;
      let bounds=groundSmokeBounds.get(surface);
      if(!bounds){const pixels=surface.getContext('2d').getImageData(0,0,surface.width,surface.height).data;let left=surface.width,top=surface.height,right=0,bottom=0;for(let sy=0;sy<surface.height;sy++)for(let sx=0;sx<surface.width;sx++)if(pixels[(sy*surface.width+sx)*4+3]>8){left=Math.min(left,sx);right=Math.max(right,sx);top=Math.min(top,sy);bottom=Math.max(bottom,sy);}bounds={x:left,y:top,w:Math.max(1,right-left+1),h:Math.max(1,bottom-top+1)};groundSmokeBounds.set(surface,bounds);}
      // Crop empty authored margins; visible smoke is a low bank, never a flat disk.
      const width=Math.min(100,52+r*.22),height=22+(i%3)*4;
      ctx.save();ctx.globalAlpha*=.57;ctx.filter='brightness(2.15)';
      ctx.drawImage(colorFrame(surface,'#8de85d'),bounds.x,bounds.y,bounds.w,bounds.h,px-width/2,py-height*.7,width,height);ctx.restore();
    }
    const count=reducedMotion?5:10;
    for(let i=0;i<count;i++){const a=i*2.39996323+.4,d=r*Math.sqrt((i+.7)/(count+.4))*.82,phase=reducedMotion?.45:(age*1.15+i*.21)%1,px=x+Math.cos(a)*d,py=y+Math.sin(a)*d-phase*12;ctx.globalAlpha=(.16+(1-phase)*.3)*Math.min(1,effect.life/.4);ctx.fillStyle=i%2?'#a8dc68':'#69b85d';ctx.beginPath();ctx.arc(px,py,2+(i%3),0,TAU);ctx.fill();if(!reducedMotion){ctx.strokeStyle='rgba(151,211,104,.28)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,py,5+phase*7,0,TAU);ctx.stroke();}}
    ctx.restore();ctx.save();ctx.strokeStyle='rgba(121,193,84,.3)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,r-1,0,TAU);ctx.stroke();ctx.restore();
  }

  function drawRockWall(effect,camera,reducedMotion) {
    const x=effect.x-camera.x,y=effect.y-camera.y,angle=effect.angle||0;
    const radius=effect.arcRadius||90,arc=effect.arcAngle||Math.PI*5/6;
    const age=Math.max(0,(effect.maxLife||6)-effect.life),fade=Math.min(1,effect.life/.45);
    const count=Math.ceil(radius*arc/24)+1,stones=[];
    ctx.save();ctx.globalAlpha=fade;ctx.strokeStyle='rgba(20,19,16,.45)';ctx.lineWidth=(effect.depth||22)+7;
    ctx.lineCap='round';ctx.beginPath();ctx.arc(x,y+3,radius,angle-arc/2,angle+arc/2);ctx.stroke();ctx.restore();
    for(let i=0;i<count;i++){
      const a=angle-arc/2+arc*i/(count-1),px=x+Math.cos(a)*radius,py=y+Math.sin(a)*radius;
      const elapsed=Math.max(0,age-Math.abs(i-(count-1)/2)*.025),rise=reducedMotion?1:1-Math.pow(1-Math.min(1,elapsed/.22),3);
      const size=48+[0,8,3,11,5,9,2,7,0][i%9];
      stones.push({px,py,size,rise,i});
    }
    // Each rock stays upright; only the ground positions follow the arc.
    for(const {px,py,size,rise,i} of stones.sort((a,b)=>a.py-b.py)){
      ctx.save();ctx.beginPath();ctx.rect(px-size,py-size*1.2,size*2,size*1.2+3);ctx.clip();
      drawVfx('rockWall',0,px,py+(1-rise)*size,size,{alpha:fade,once:true,scaleX:i%2?-1:1,anchorY:vfxAssets.rockWall?.groundAnchorY??.98});
      ctx.restore();
    }
  }

  function drawFlameBreath(effect,camera,reducedMotion) {
    const x=effect.x-camera.x,y=effect.y-camera.y,angle=effect.angle||0,length=effect.radius||effect.length||235,width=effect.width||1.16,age=Math.max(0,(effect.maxLife||1)-effect.life);
    ctx.save();ctx.globalAlpha=Math.min(1,effect.life/.25);traceSector(x,y,length,angle,width);ctx.clip();
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    // Interlocking tongues fill the cone with a dark red body and yellow hot interior.
    const tongues=reducedMotion?3:5;
    for(let i=0;i<tongues;i++){
      const lane=(i/(tongues-1)-.5)*width*.92,phase=reducedMotion?.45:(age*3+i*.31)%1;
      ctx.save();ctx.rotate(lane);const reach=length*(.48+.5*Math.sin(i*4.8+phase*2)**2),half=length*width/(tongues*1.3);
      for(const [tone,scale,opacity] of [['#ad3f22',1,.3],['#ec762d',.76,.4],['#ffd373',.4,.48]]){ctx.fillStyle=tone;ctx.globalAlpha=opacity;ctx.beginPath();ctx.moveTo(4,0);
        const h=half*scale,wiggle=Math.sin(i*3+phase*4)*h*.45;
        ctx.bezierCurveTo(reach*.18,-h*.3,reach*.27,-h*1.3,reach*.45,-h*.62);
        ctx.bezierCurveTo(reach*.56,-h*.16,reach*.67,-h*.85,reach*.73,-h*.42);
        ctx.quadraticCurveTo(reach*.84,-h*.06,reach,wiggle);
        ctx.quadraticCurveTo(reach*.76,h*.36,reach*.73,h*.72);
        ctx.bezierCurveTo(reach*.65,h*1.12,reach*.54,h*.16,reach*.44,h*.66);
        ctx.bezierCurveTo(reach*.29,h*1.25,reach*.17,h*.25,4,0);ctx.closePath();ctx.fill();}ctx.restore();
    }ctx.restore();
    const cores=reducedMotion?4:7;
    for(let i=0;i<cores;i++){const t=.22+i*.095,a=angle+(i%2?1:-1)*width*(.08+.17*t);drawVfx('flameCore',reducedMotion?vfxDuration(vfxAssets.flameCore)*.36:age+i*.09,x+Math.cos(a)*length*t,y+Math.sin(a)*length*t,length*(.2+.12*t),{loop:true,angle:a,alpha:.9});}
    const count=reducedMotion?4:9;
    for(let i=0;i<count;i++){const t=(i+.35)/count,a=angle+(i%2?1:-1)*width*(.08+.25*t),px=x+Math.cos(a)*length*t,py=y+Math.sin(a)*length*t;drawVfx('fireImpact',reducedMotion?vfxDuration(vfxAssets.fireImpact)*.45:age+i*.08,px,py,44+66*t,{angle,loop:true,alpha:.45+.3*t});}
    const glow=ctx.createRadialGradient(x,y,4,x,y,length);glow.addColorStop(0,'rgba(255,236,134,.18)');glow.addColorStop(.62,'rgba(242,91,34,.025)');glow.addColorStop(1,'rgba(172,35,20,0)');ctx.fillStyle=glow;traceSector(x,y,length,angle,width);ctx.fill();ctx.restore();
  }

  function drawBladeMark(effect,camera,reducedMotion) {
    const x=effect.x-camera.x,y=effect.y-camera.y,remaining=effect.life||0;
    const persistent=(effect.maxLife||0)>1,expired=persistent&&remaining<3;
    if(!persistent){const age=(effect.maxLife||.5)-remaining;drawVfx('swordField',reducedMotion?.12:age,x,y-4,86,{once:true,alpha:Math.min(.85,remaining/.15)});return;}
    const alpha=persistent?Math.min(1,remaining/.6):Math.min(1,remaining/.14);
    // The embedded metal blade is the same entity as Q, with authored ground shards below it.
    ctx.save();ctx.globalAlpha=alpha*(expired?.48+.52*Math.min(1,remaining/3):1);ctx.fillStyle='rgba(13,20,24,.48)';
    ctx.beginPath();ctx.ellipse(x,y+5,21,9,0,0,TAU);ctx.fill();
    drawVfx('blinkSeal',0,x,y+2,82,{once:true,alpha:persistent?.065:.18,filter:'grayscale(1) brightness(1.4)'});
    glow(x,y-7,58,'white',.48*alpha);
    ctx.save();ctx.fillStyle='#ffffff';ctx.globalAlpha=alpha*.9;ctx.fillRect(x-1.5,y-15,3,15);ctx.restore();
    ctx.save();ctx.fillStyle='#ffffff';
    for(let i=0;i<(reducedMotion?3:6);i++){const phase=reducedMotion?.4:(renderTime*.8+i/6)%1,a=i*2.39996,d=7+phase*11,px=x+Math.cos(a)*d,py=y-7+Math.sin(a)*d*.45-phase*10;ctx.globalAlpha=alpha*(.4+.5*(1-phase));ctx.beginPath();ctx.moveTo(px,py-2.8);ctx.lineTo(px+1.6,py);ctx.lineTo(px,py+2.8);ctx.lineTo(px-1.6,py);ctx.closePath();ctx.fill();}ctx.restore();
    const image=images.vfxBlade,bounds=opaqueBounds(image);
    if(image&&bounds){ctx.save();ctx.translate(x,y-5);ctx.rotate(-.35);ctx.scale(1,.78);ctx.drawImage(image,bounds.x,bounds.y,bounds.w,bounds.h,-23,-23,46,46);ctx.restore();}
    if(expired){ctx.fillStyle='rgba(255,202,132,.55)';ctx.fillRect(x-1,y+10,2,2);}
    ctx.restore();
  }

  function drawBladeLocator(anchor,camera,reducedMotion) {
    const x=anchor.x-camera.x,y=anchor.y-camera.y,fade=Math.min(1,anchor.remaining/.6);
    ctx.save();ctx.globalAlpha=fade;ctx.shadowColor='#ffffff';ctx.shadowBlur=8;ctx.fillStyle='#ffffff';
    // Small white core and five bounded motes remain over crowded silhouettes.
    ctx.beginPath();ctx.arc(x,y-5,2.3,0,TAU);ctx.fill();ctx.shadowBlur=4;
    for(let i=0;i<5;i++){const phase=reducedMotion?.45:(renderTime*.58+i*.2)%1,a=i*2.39996,d=9+phase*8,px=x+Math.cos(a)*d,py=y-4+Math.sin(a)*d*.52-phase*5;ctx.globalAlpha=fade*(reducedMotion?.78:.35+.55*(1-phase));ctx.fillRect(px-1,py-1,2,2);}
    ctx.shadowBlur=0;ctx.globalAlpha=fade*.68;drawVfx('whiteSpark',vfxDuration(vfxAssets.whiteSpark)*.38,x,y-5,25,{once:true,alpha:.48});ctx.restore();
  }

  function drawBlinkRoute(game,camera,route,origin,radius) {
    if(!route.length)return;
    ctx.save();ctx.strokeStyle='#a4f2e3';ctx.lineWidth=3;ctx.setLineDash([10,7]);
    ctx.beginPath();ctx.moveTo(origin.x-camera.x,origin.y-camera.y);
    for(const point of route)ctx.lineTo(point.x-camera.x,point.y-camera.y);
    ctx.stroke();ctx.setLineDash([]);
    const last=route.at(-1),x=last.x-camera.x,y=last.y-camera.y;
    ctx.fillStyle='rgba(240,216,132,.12)';ctx.strokeStyle='#ffe1a0';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.arc(x,y,34,0,TAU);ctx.stroke();
    const w=game.viewport?.width||720,h=game.viewport?.height||400;
    if(x<28||y<28||x>w-28||y>h-28){
      const cx=origin.x-camera.x,cy=origin.y-camera.y,dx=x-cx,dy=y-cy;
      // Project the arrow from inside the HUD-safe frame. An origin outside
      // this frame must not yield a negative ray distance and reverse the marker.
      const left=144,right=Math.max(left,w-240),top=98,bottom=Math.max(top,h-60);
      const sx=Math.max(left,Math.min(right,cx)),sy=Math.max(top,Math.min(bottom,cy));
      const t=Math.max(0,Math.min(dx>0?(right-sx)/dx:dx<0?(left-sx)/dx:Infinity,dy>0?(bottom-sy)/dy:dy<0?(top-sy)/dy:Infinity));
      const ex=sx+dx*t,ey=sy+dy*t,angle=Math.atan2(dy,dx);
      ctx.translate(ex,ey);ctx.rotate(angle);ctx.fillStyle='#ffe1a0';
      ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-8,-9);ctx.lineTo(-8,9);ctx.closePath();ctx.fill();ctx.rotate(-angle);
      ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('落点',0,-16);
    }
    ctx.restore();
  }

  function drawHeroState(game,camera,reducedMotion) {
    const state=game.heroState||{};
    for(const anchor of state.blinkAnchors||[])if(anchor.remaining>0) {
      drawBladeMark({x:anchor.x,y:anchor.y,life:anchor.remaining,maxLife:anchor.maxLife||14},camera,reducedMotion);
    }
    const travel=state.blinkTravel;
    if(travel){
      // Cast trails belong to the moving unit; the dotted route is only a targeting preview.
      const angle=Math.atan2(game.player.y-travel.fromY,game.player.x-travel.fromX);
      drawVfx('swordField',reducedMotion?.13:renderTime%vfxDuration(vfxAssets.swordField),game.player.x-camera.x-Math.cos(angle)*18,game.player.y-camera.y-Math.sin(angle)*18,72,{angle,once:true,alpha:reducedMotion?.3:.68});
    }
  }

  function drawHeroPassives(game,camera,reducedMotion) {
    const kit=game.heroKit;if(!kit)return;
    const x=game.player.x-camera.x,y=game.player.y-camera.y;
    if(kit.empowered>0&&kit.empoweredTime>0){
      drawVfx('whiteSpark',vfxDuration(vfxAssets.whiteSpark)*.38,x+game.player.facing*20,y-24,26,{once:true,alpha:.65,tint:'#b8ffde'});
    }
    if(kit.afterimage>0&&kit.afterimageTime>0){drawVfx('cleave',vfxDuration(vfxAssets.cleave)*.36,x-18*game.player.facing,y-12,28,{once:true,alpha:.4});}
    if(kit.heroId==='summoner'){
      const foe=(game.enemies||[]).find(e=>e.id===kit.focusId&&!e.dead&&e.hp>0);
      if(foe&&kit.focusTime>0){const fx=foe.x-camera.x,fy=foe.y-camera.y-foe.radius-8;ctx.save();ctx.strokeStyle='#c2ffe2';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(fx-5,fy-3);ctx.lineTo(fx,fy+2);ctx.lineTo(fx+5,fy-3);ctx.stroke();ctx.restore();}
      const near=(game.enemies||[]).some(e=>!e.dead&&e.hp>0&&(e.spawnDelay||0)<=0&&Math.hypot(e.x-game.player.x,e.y-game.player.y)<260);
      if(!near)for(const ally of game.companions||[])if(ally.hp>0&&ally.hp<ally.maxHp)drawVfx('heal',vfxDuration(vfxAssets.heal)*.4,ally.x-camera.x,ally.y-camera.y-14,34,{once:true,alpha:.35});
    }
    for(const status of kit.statuses||[])if(status.kind==='burn'&&status.remaining>0){const foe=(game.enemies||[]).find(e=>e.id===status.targetId&&!e.dead);if(foe)drawVfx('fireImpact',reducedMotion?vfxDuration(vfxAssets.fireImpact)*.4:renderTime,foe.x-camera.x,foe.y-camera.y-9,24,{loop:true,alpha:.48});}
  }

  function drawCombatEffect(effect, camera, reducedMotion) {
    const x = effect.x - camera.x, y = effect.y - camera.y, progress = lifeProgress(effect);
    const fade = Math.min(1, effect.life / Math.max(0.06, (effect.maxLife || 1) * 0.35));
    ctx.save(); ctx.globalAlpha = fade; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (effect.type === "heroFrost" || effect.type === "frostAura") { ctx.restore(); drawHeroFrost(effect,camera,reducedMotion); return;
    } else if (effect.type === "poisonField") { ctx.restore(); drawPoisonField(effect,camera,reducedMotion); return;
    } else if (effect.type === "rockWall") { ctx.restore(); drawRockWall(effect,camera,reducedMotion); return;
    } else if (effect.type === "flameBreath") { ctx.restore(); drawFlameBreath(effect,camera,reducedMotion); return;
    } else if (effect.type === "bladeMark") { ctx.restore(); drawBladeMark(effect,camera,reducedMotion); return;
    } else if (effect.type === "bossCleave" || effect.type === "bossCharge" || effect.type === "bossSlam") {
      ctx.restore(); drawBossEffect(effect,camera,reducedMotion); return;
    } else if (effect.type === "summon" || effect.type === "recall") {
      drawVfx('summon',(reducedMotion?.45:progress)*vfxDuration(vfxAssets.summon),x,y,140,{once:true,alpha:.85,filter:effect.type==='recall'?'hue-rotate(75deg)':'none'});
    } else if (effect.type === "blinkImpact") {
      const radius=Math.max(0,effect.radius||0);ctx.save();ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.clip();
      // Silver radial blade cuts show the landing strike, unlike a generic magic explosion.
      const count=reducedMotion?3:5;
      for(let i=0;i<count;i++){const a=i*TAU/count+.3,d=radius*.37;drawVfx('cleave',(reducedMotion?.34:progress)*vfxDuration(vfxAssets.cleave),x+Math.cos(a)*d,y+Math.sin(a)*d,radius*1.05,{angle:a,once:true,alpha:.68});}
      ctx.restore();
    } else if (effect.type === "blinkStart") {
      drawVfx('blinkPhase',(reducedMotion?.48:progress)*vfxDuration(vfxAssets.blinkPhase),x,y-12,48,{once:true,alpha:.42,filter:'hue-rotate(325deg) saturate(.55)'});
    } else if (effect.type === "blink" || effect.type === "blinkStorm") {
      const tx=(effect.toX??effect.x)-camera.x,ty=(effect.toY??effect.y)-camera.y;
      drawVfx('dash',(reducedMotion?.4:progress)*vfxDuration(vfxAssets.dash),tx,ty-12,76,{once:true,alpha:reducedMotion?.16:.24,filter:'hue-rotate(145deg) brightness(1.3)'});
    } else if (effect.type === "dash") {
      const tx = effect.toX - camera.x, ty = effect.toY - camera.y;
      const angle = Math.atan2(ty - y, tx - x), length = Math.hypot(tx - x, ty - y);
      const elapsed=(effect.maxLife||.44)-effect.life,travelDuration=effect.travelDuration||.28;
      const travel=Math.min(1,elapsed/travelDuration),nx=Math.cos(angle),ny=Math.sin(angle);
      const headX=x+(tx-x)*travel,headY=y+(ty-y)*travel;
      // Stagger the authored Duelyst frames behind the moving hero, never ahead of the dash.
      if (vfxAssets.dash && images.vfx_dash) {
        const count=reducedMotion?2:6;
        for(let i=0;i<count;i++) {
          const t=i/(count-1),age=elapsed-t*travelDuration;
          if(age<0||age>.23)continue;
          const opacity=(1-age/.23)*(reducedMotion?.48:.82);
          drawVfx('dash',Math.min(.999,age/.23)*vfxDuration(vfxAssets.dash),x+(tx-x)*t,y+(ty-y)*t,104*(effect.radius||34)/34,{angle:angle+Math.PI/2,alpha:opacity,once:true,filter:'hue-rotate(145deg) saturate(1.3) brightness(1.45)'});
        }
      }
      ctx.save();ctx.strokeStyle='rgba(125,236,221,.13)';strokeCapsule(x,y,headX,headY,effect.radius||34);ctx.stroke();ctx.restore();
      // A short solid core makes the direction readable on bright grass without flashing the unit.
      ctx.globalAlpha=fade;ctx.strokeStyle='rgba(110,228,221,.55)';ctx.lineWidth=reducedMotion?4:9;
      const tail=Math.max(0,travel-.45);
      ctx.beginPath();ctx.moveTo(x+(tx-x)*tail,y+(ty-y)*tail);ctx.lineTo(headX,headY);ctx.stroke();
      ctx.strokeStyle='rgba(224,255,234,.9)';ctx.lineWidth=2;ctx.stroke();
      if(!reducedMotion) {
        ctx.strokeStyle='rgba(158,249,228,.75)';ctx.lineWidth=2;
        for(const side of [-1,1]) {ctx.beginPath();ctx.moveTo(headX-nx*38-ny*side*15,headY-ny*38+nx*side*15);ctx.quadraticCurveTo(headX-nx*8-ny*side*25,headY-ny*8+nx*side*25,headX+nx*12,headY+ny*12);ctx.stroke();}
      }
    } else if (effect.type === "cleave") {
      ctx.restore(); drawSweep(effect,camera,reducedMotion); return;
    } else if (effect.type === "burst" && vfxAssets.magicImpact && images.vfx_magicImpact) {
      drawVfx("magicImpact", progress * Math.max(0, vfxDuration(vfxAssets.magicImpact) - .001), x, y, 76, { alpha: fade, once: true });
    } else if (effect.type === "lightning") {
      const tx=effect.toX-camera.x,ty=effect.toY-camera.y;
      drawAtlasLine('tesla',reducedMotion?.2:renderTime,x,y,tx,ty,18,.9);
    } else if (effect.type === "windblade") { ctx.restore(); drawWindblade(effect, camera, reducedMotion); return; }
    else if (effect.type === "danger") { ctx.fillStyle = "rgba(255,63,73,.14)"; ctx.strokeStyle = "rgba(255,105,88,.9)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, effect.radius, 0, TAU); ctx.fill(); ctx.stroke(); }
    else if (effect.type === "radial") { ctx.strokeStyle = "rgba(255,192,108,.9)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, effect.radius * progress, 0, TAU); ctx.stroke(); }
    else if (effect.type === "heal") {
      drawVfx('heal',(reducedMotion?.4:progress)*vfxDuration(vfxAssets.heal),x,y-8,84,{once:true,alpha:.8});
    }
    else if (effect.type === "slash") {
      drawVfx('cleave',(reducedMotion?.3:progress)*vfxDuration(vfxAssets.cleave),x,y,58,{angle:effect.angle||0,once:true,alpha:.76});
    }
    else if (effect.type === "hit") {
      drawVfx('hitImpact',(reducedMotion?.4:progress)*vfxDuration(vfxAssets.hitImpact),x,y-8,38,{once:true,alpha:reducedMotion?.5:.76});
    }
    else { ctx.strokeStyle = effect.type === "hit" ? "rgba(255,150,139,.88)" : "rgba(166,235,239,.85)"; ctx.lineWidth = 2; const count = reducedMotion ? 2 : 4; for (let i = 0; i < count; i++) { const angle = -.9 + i * .52, length = 8 + i * 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(angle) * 4, y + Math.sin(angle) * 4); ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length); ctx.stroke(); } }
    ctx.restore();
  }

  function abilityAlpha(item) {
    const life=Number(item.life),maxLife=Number(item.maxLife);
    if(!Number.isFinite(life)||!Number.isFinite(maxLife)||maxLife<=0)return .82;
    const remaining=Math.max(0,Math.min(1,life/maxLife));
    return Math.max(0,Math.min(.9,remaining<.22?remaining/.22*.9:.9));
  }

  function abilityLayer(item,fallback) {
    if(item.kind==='zone'||item.kind==='burn')return 'below';
    if(item.layer==='below'||item.layer==='ground')return 'below';
    if(item.layer==='above'||item.layer==='actors')return 'above';
    if(fallback)return fallback;
    if(item.telegraph||item.hostile||item.shape==='circle'||item.shape==='construct')return 'below';
    return 'above';
  }

  function drawHeroVisual(item,camera,reducedMotion) {
    if(item.original)return;
    const x=item.x-camera.x,y=item.y-camera.y,p=lifeProgress(item),kind=item.visualKind,r=item.radius||7;
    const angle=item.angle||0,t=(key,fraction=.4)=>(reducedMotion?fraction:p)*vfxDuration(vfxAssets[key]);
    ctx.save();ctx.globalAlpha=abilityAlpha(item);
    if(kind==='ascensionRushHit'){
      drawVfx('magicImpact',t('magicImpact',.32),x,y-10,r*2.7,{once:true,alpha:.85,tint:'#adffe5'});
      drawVfx('whiteSpark',t('whiteSpark',.28),x,y-14,r*1.8,{once:true,alpha:.92,tint:'#f1ffe1'});
      impactFragments(x,y-8,p,r*1.35,angle,'mint',reducedMotion,7);
      ctx.restore();return;
    }
    if(item.ascension&&kind==='spiritChain'){ctx.restore();return;}
    if(item.ascension&&kind==='pactBurst'){
      // The pulse was actually emitted by this guard. Its ghost and authored arcs
      // expand inside the real damage disk; no outline substitutes for the spell.
      ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.clip();
      const wave=reducedMotion?.65:Math.min(1,p/.72),fade=Math.max(0,1-p);
      if(item.ownerKind){ctx.save();ctx.globalAlpha*=.26*fade;unit({x:item.x,y:item.y,radius:18,hp:1,anim:'attack',animTime:p*.5,facing:item.ownerFacing||1,visualGhost:true,spiritTint:'#c2ffe8'},item.ownerKind,camera,.95);ctx.restore();}
      drawVfx('magicImpact',t('magicImpact',.32),x,y-5,Math.min(82,r*1.5),{once:true,alpha:.65*fade,tint:'#acffd7'});
      for(let i=0;i<6;i++){const a=i*TAU/6,d=r*(.18+.62*wave);drawVfx('swordField',t('swordField',.38),x+Math.cos(a)*d,y+Math.sin(a)*d,Math.max(24,r*.72),{once:true,angle:a,alpha:.65*fade,tint:'#c6ffe5'});}
      if(p>.35)drawVfx('heal',t('heal',.42),x,y-8,r*1.3,{once:true,alpha:.65*fade,tint:'#e3ffbc'});
      ctx.restore();ctx.restore();return;
    }
    if(kind==='ascensionEcho'){
      // A fixed afterimage marks the real delayed-cross origin; it does not move.
      ctx.globalAlpha*=.4;
      unit({x:item.x,y:item.y,radius:22,kind:item.kind,facing:Math.cos(angle)<0?-1:1,anim:'idle',animTime:0,hp:1,visualGhost:true,spiritTint:'#cedaff'},item.kind,camera,.9);
      drawVfx('blinkSeal',t('blinkSeal'),x,y,52,{once:true,alpha:.55,tint:'#bfacff'});
      ctx.restore();return;
    }
    if(kind==='ascensionDomain'){
      ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.clip();
      if(item.element==='fire')drawVfx('fireGround',t('fireGround'),x,y,r*1.7,{once:true,scaleY:.65,alpha:.48});
      else if(item.element==='frost'){
        drawVfx('frost',t('frost'),x,y,r*1.9,{once:true,alpha:.35});
        for(let i=0;i<6;i++){const a=i*2.39996;drawVfx('iceRain',0,x+Math.cos(a)*r*.6,y+Math.sin(a)*r*.6,r*.35,{once:true,angle:a,alpha:.7});}
      }else{drawVfx('bossSlam',t('bossSlam'),x,y,r*1.8,{once:true,alpha:.4});for(let i=0;i<6;i++){const a=i*2.39996;drawVfx('rockWall',0,x+Math.cos(a)*r*.62,y+Math.sin(a)*r*.62,r*.32,{once:true,alpha:.7});}}
      ctx.restore();ctx.restore();return;
    }
    if(kind==='windWave'){
      const px=(item.toX??item.x)-camera.x,py=(item.toY??item.y)-camera.y,half=Math.max(1,item.width||r);
      // One travelling authored wave occupies the actual swept collision width.
      ctx.translate(px,py);ctx.rotate(angle);ctx.beginPath();ctx.rect(-half,-half,half*2,half*2);ctx.clip();
      drawVfx('swordField',vfxDuration(vfxAssets.swordField)*(.28+(reducedMotion?0:Math.sin(renderTime*12)*.08)),0,0,half*3.1,{once:true,angle:Math.PI/2,scaleX:.62,alpha:.94});
      ctx.restore();impactFragments(px,py,p,half*.8,angle,'ice',reducedMotion,5);return;
    }
    if(kind==='spiritChain'){
      const tx=(item.toX??item.x)-camera.x,ty=(item.toY??item.y)-camera.y;
      drawAtlasLine('tesla',t('tesla'),x,y,tx,ty,Math.max(4,item.width||4),.86);
      ctx.restore();return;
    }
    if(kind==='windBurst'){
      ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.clip();
      drawVfx('swordField',t('swordField'),x,y,r*2,{once:true,alpha:.75});
      ctx.restore();return;
    }
    if(kind==='jobBladeLine'){
      const tx=(item.toX??item.x)-camera.x,ty=(item.toY??item.y)-camera.y,len=Math.hypot(tx-x,ty-y),half=item.width||18;
      ctx.translate(x,y);ctx.rotate(Math.atan2(ty-y,tx-x));ctx.beginPath();ctx.rect(0,-half,len,half*2);ctx.clip();
      const count=Math.max(1,Math.ceil(len/54));
      for(let i=0;i<count;i++)drawVfx('cleave',t('cleave',.34)+i*.018,(i+.5)*len/count,0,Math.max(48,half*4),{once:true,angle:0,alpha:.75});
      ctx.restore();
      if(item.ascension){drawVfx('whiteSpark',t('whiteSpark',.28),(x+tx)/2,(y+ty)/2,32,{once:true,alpha:.85,tint:'#e0d5ff'});drawVfx('magicImpact',t('magicImpact',.35),(x+tx)/2,(y+ty)/2,47,{once:true,alpha:.45,tint:'#d6b7ff'});}
      return;
    }
    if(kind==='commanderSlash'){
      ctx.restore();drawSweep({...item,radius:r,width:item.width,life:item.life,maxLife:item.maxLife},camera,reducedMotion);
      if(item.strength>1||item.empowered){ctx.save();traceSector(x,y,r,angle,item.width||1.4);ctx.clip();drawVfx('cleave',t('cleave'),x+Math.cos(angle)*r*.72,y+Math.sin(angle)*r*.72,r*.68,{once:true,angle,alpha:item.empowered?.95:.7});ctx.restore();}return;
    }
    if(kind==='pactBolt'||kind==='precisionBlade'||kind==='elementBolt'){
      const px=(item.toX??item.x)-camera.x,py=(item.toY??item.y)-camera.y;
      const final=item.basicRank===4,focus=final&&item.basicBranch==='b',last=focus&&item.volleyIndex===item.volleyCount-1;
      if(kind==='precisionBlade'){
        const image=images.vfxBlade,bounds=opaqueBounds(image),size=r*2.8;
        if(image&&bounds){const aspect=bounds.w/bounds.h,w=size,h=size/aspect;ctx.save();ctx.translate(px,py);ctx.rotate(reducedMotion?angle:renderTime*(item.phase==='return'?-22:22));ctx.drawImage(image,bounds.x,bounds.y,bounds.w,bounds.h,-w/2,-h/2,w,h);ctx.restore();}
        if(item.phase==='return')drawVfx('cleave',vfxDuration(vfxAssets.cleave)*.35,px,py,r*3,{once:true,angle,alpha:.3});
      }
      else if(kind==='pactBolt'){drawVfx('magicBolt',reducedMotion?0:renderTime,px,py,(item.echo?36:49)*(final?1.2:1)*(last?1.25:1),{angle:angle+Math.PI,anchorX:.11,alpha:.95});}
      else if(item.element==='fire'){drawVfx('flameCore',vfxDuration(vfxAssets.flameCore)*.36,px,py,r*3.3,{once:true,angle});}
      else if(item.element==='frost'){drawVfx('iceRain',0,px,py,r*3.3,{once:true,angle:angle+Math.PI/2});}
      else {drawVfx('rockWall',0,px,py,r*3.1,{once:true,angle});}
    }else if(kind==='pactBurst'){
      drawVfx('magicImpact',t('magicImpact'),x,y,Math.min(130,r*1.2),{once:true,tint:'#b8ffde',alpha:.65});
      for(let i=0;i<5;i++){const a=i*TAU/5;drawVfx('whiteSpark',t('whiteSpark'),x+Math.cos(a)*r*.65,y+Math.sin(a)*r*.65,22,{once:true,alpha:.7});}
    }else if(kind==='triphaseBurst'){
      drawVfx('fireImpact',t('fireImpact'),x,y,40,{once:true,alpha:.7});
      for(let i=0;i<3;i++){const a=i*TAU/3,d=reducedMotion?18:9+p*20;drawVfx('iceRain',0,x+Math.cos(a)*d,y+Math.sin(a)*d,16,{once:true,angle:a,alpha:.85});drawVfx('rockWall',0,x+Math.cos(a+1)*d,y+Math.sin(a+1)*d,11,{once:true,alpha:.75});}
    }else if(item.basicRank&&['stoneSplash','elementImpact'].includes(kind)){
      // Splash pixels share the simulation disk; ice/fire cannot suggest extra reach.
      ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.clip();
      if(item.element==='fire')drawVfx('fireExplosion',t('fireExplosion'),x,y,r*2.2,{once:true,alpha:.9});
      else if(item.element==='frost'){
        drawVfx('magicImpact',t('magicImpact'),x,y,r*2.1,{once:true,alpha:.58});
        for(let i=0;i<7;i++){const a=i*2.39996,d=r*.68*Math.sqrt((i+.5)/7);drawVfx('iceRain',0,x+Math.cos(a)*d,y+Math.sin(a)*d,r*.65,{once:true,angle:a,alpha:1-p*.65});}
      }else{
        drawVfx('bossSlam',t('bossSlam'),x,y,r*2.1,{once:true,alpha:.6,anchorY:.65});
        for(let i=0;i<7;i++){const a=i*2.39996,d=r*(reducedMotion?.52:.25+p*.5);drawVfx('rockWall',0,x+Math.cos(a)*d,y+Math.sin(a)*d,r*.48,{once:true,angle:a,alpha:1-p*.6});}
      }
    }else if(kind==='stoneSplash'||(kind==='elementImpact'&&item.element==='stone')){
      const radius=kind==='stoneSplash'?r:24;drawVfx('bossSlam',t('bossSlam'),x,y,Math.min(90,radius*1.3),{once:true,alpha:.36,anchorY:.82});
      for(let i=0;i<5;i++){const a=i*2.39996,d=radius*(reducedMotion?.45:p*.72);drawVfx('rockWall',0,x+Math.cos(a)*d,y+Math.sin(a)*d-4,9+i%2*3,{once:true,angle:a,alpha:(1-p)*.8});}
    }else if(kind==='elementImpact'&&item.element==='fire'){drawVfx('fireImpact',t('fireImpact'),x,y-4,46,{once:true,alpha:.88});}
    else if(kind==='elementImpact'&&item.element==='frost'){
      for(let i=0;i<4;i++){const a=i*TAU/4,d=(reducedMotion?.45:p)*18;drawVfx('iceRain',0,x+Math.cos(a)*d,y+Math.sin(a)*d,12,{once:true,angle:a,alpha:.8});}
    }else if(kind==='bladeImpact'){drawVfx('cleave',t('cleave'),x,y,45,{once:true,angle:item.angle||0,alpha:.8});}
    else if(kind==='pactImpact'){drawVfx('magicImpact',t('magicImpact'),x,y,48,{once:true,tint:'#b8ffde',alpha:.86});}
    ctx.restore();
  }

  function drawBurnResidue(item,camera,reducedMotion) {
    const x=item.x-camera.x,y=item.y-camera.y,r=item.radius||28,age=Math.max(0,item.maxLife-item.life);
    ctx.save();ctx.globalAlpha=Math.min(.72,item.life/.45);ctx.beginPath();
    const line=item.shape==='line',tx=(item.toX??item.x)-camera.x,ty=(item.toY??item.y)-camera.y;
    if(line){const a=Math.atan2(ty-y,tx-x),dx=Math.sin(a)*r,dy=-Math.cos(a)*r;ctx.moveTo(x+dx,y+dy);ctx.lineTo(tx+dx,ty+dy);ctx.lineTo(tx-dx,ty-dy);ctx.lineTo(x-dx,y-dy);ctx.closePath();ctx.arc(x,y,r,0,TAU);ctx.arc(tx,ty,r,0,TAU);}else ctx.arc(x,y,r,0,TAU);
    ctx.clip();const count=line?Math.max(3,Math.ceil(Math.hypot(tx-x,ty-y)/28)):9;
    for(let i=0;i<count;i++){
      const u=(i+.5)/count,a=i*2.39996,d=r*.8*Math.sqrt(u),px=line?x+(tx-x)*u:x+Math.cos(a)*d,py=line?y+(ty-y)*u:y+Math.sin(a)*d;
      drawVfx('fireGround',reducedMotion?vfxDuration(vfxAssets.fireGround)*.4:age+i*.11,px,py,line?r*1.7:Math.min(70,r*.65),{loop:true,scaleY:.5,alpha:.42});
      drawVfx('fireImpact',reducedMotion?vfxDuration(vfxAssets.fireImpact)*.4:age+i*.13,px,py-4,line?Math.min(48,r*1.5):Math.min(42,r*.6),{loop:true,alpha:.65});
    }
    ctx.restore();ctx.save();ctx.strokeStyle='rgba(230,139,72,.27)';ctx.lineWidth=1;
    if(line){strokeCapsule(x,y,tx,ty,r);ctx.lineWidth=2*r;ctx.strokeStyle='rgba(195,86,45,.06)';ctx.stroke();}else{ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();}ctx.restore();
  }

  function drawAbilityShape(item,camera,reducedMotion,layer,fallbackLayer) {
    if(!item||abilityLayer(item,fallbackLayer)!==layer||!Number.isFinite(item.x)||!Number.isFinite(item.y))return;
    const x=item.x-camera.x,y=item.y-camera.y,shape=item.shape||'circle';
    const radius=Math.max(0,Number(item.radius)||0),halfWidth=Math.max(1,Number(item.width)||radius||2);
    const hasTarget=Number.isFinite(item.toX)&&Number.isFinite(item.toY);
    const tx=(hasTarget?item.toX:item.x+(Number(item.vx)||0))-camera.x,ty=(hasTarget?item.toY:item.y+(Number(item.vy)||0))-camera.y;
    const angle=Number.isFinite(item.angle)?item.angle:Math.atan2(ty-y,tx-x),color=item.hostile?'#ff5268':item.color||'#79e6d4';
    const progress=lifeProgress(item),pulse=reducedMotion?1:.94+.06*Math.sin(progress*Math.PI*4);
    ctx.save();ctx.globalAlpha=abilityAlpha(item);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.fillStyle=color;
    if(item.hostile){ctx.fillStyle='rgba(190,45,36,.16)';ctx.strokeStyle='#ff5268';}
    const age=Math.max(0,(item.maxLife||1)-(item.life||0)),animationTime=reducedMotion?.2:age;
    if(item.visualKind){ctx.restore();drawHeroVisual(item,camera,reducedMotion);return;}
    if(item.kind==='burn'){ctx.restore();drawBurnResidue(item,camera,reducedMotion);return;}
    if(item.weapon==='familiar'&&item.phase==='splash'&&shape==='circle'){
      ctx.save();ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.clip();
      drawVfx('magicImpact',(reducedMotion?.42:progress)*vfxDuration(vfxAssets.magicImpact),x,y,radius*2,{once:true,alpha:.82,tint:'#c8f6ff'});
      ctx.restore();ctx.restore();return;
    }
    if(!item.telegraph && shape==='circle' && ['orb','familiar'].includes(item.weapon)){
      drawVfx('magicImpact',(reducedMotion?.42:progress)*vfxDuration(vfxAssets.magicImpact),x,y,Math.min(68,Math.max(32,radius*3)),{once:true,alpha:.85});ctx.restore();return;
    }
    if(item.weapon==='mine'&&item.phase==='chain'){
      drawAtlasLine('tesla',vfxDuration(vfxAssets.tesla)*.42,x,y,tx,ty,7,.45,'#ffd79b');ctx.restore();return;
    }
    if(!item.telegraph && shape==='circle' && ['dagger','orbit'].includes(item.weapon)){
      drawVfx('swordField',(reducedMotion?.3:progress)*vfxDuration(vfxAssets.swordField),x,y,Math.max(38,radius*2),{once:true,alpha:.72});ctx.restore();return;
    }
    if(!item.telegraph && shape==='line' && (item.weapon==='lightning'||item.weapon==='beam')){
      const endX=hasTarget?tx:x+Math.cos(angle)*(item.length||0),endY=hasTarget?ty:y+Math.sin(angle)*(item.length||0);
      const lightning=item.weapon==='lightning';
      const a=Math.atan2(endY-y,endX-x),length=Math.hypot(endX-x,endY-y),half=lightning?3:Math.min(18,(item.width||30)*.27);
      ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha*=Math.min(.68,1-progress*.7);
      if(lightning){
        const segments=Math.min(12,Math.max(3,Math.ceil(length/22)));
        ctx.beginPath();ctx.moveTo(0,0);for(let i=1;i<segments;i++){const t=i/segments;ctx.lineTo(length*t,Math.sin(i*8.71+x*.13+y*.07)*(4+Math.sin(t*Math.PI)*5));}ctx.lineTo(length,0);
        ctx.strokeStyle='#8ba8ef';ctx.lineWidth=7;ctx.stroke();ctx.strokeStyle='#edfbff';ctx.lineWidth=2.4;ctx.stroke();
      }else{
        // Filled shaft, bright core, atlas detail and local bloom read as a volume.
        ctx.fillStyle='#cba1e7';ctx.beginPath();ctx.moveTo(0,-half*.55);ctx.lineTo(length,-half);ctx.lineTo(length,half);ctx.lineTo(0,half*.55);ctx.closePath();ctx.fill();ctx.fillStyle='#fff5ff';ctx.fillRect(0,-Math.max(1,half*.22),length,Math.max(2,half*.44));
        // Low contrast atlas texture moves locally through the shaft; no attached geometry.
        const count=reducedMotion?2:4;
        for(let i=0;i<count;i++){const t=(i/count+(reducedMotion?.12:progress*.28))%1;drawVfx('whiteSpark',vfxDuration(vfxAssets.whiteSpark)*(.25+(reducedMotion?.1:progress*.5)),length*t,Math.sin(i*3.7+progress*5)*half*.35,half*2.6,{once:true,alpha:.16});}
        ctx.globalAlpha*=.28;ctx.scale(1,half*2/96);glow(length*.5,0,Math.min(length,240),'violet',.55);
      }ctx.restore();
      const sparks=reducedMotion?2:5;for(let i=0;i<sparks;i++){const t=(i+.4)/sparks;glow(x+(endX-x)*t,y+(endY-y)*t,lightning?22:half*4,'violet',.28);}
      impactFragments(endX,endY,progress,lightning?22:32,a,'violet',reducedMotion,lightning?5:8);
      const lineTime=lightning?(reducedMotion?.45:progress)*vfxDuration(vfxAssets.tesla):(6+(reducedMotion?2:Math.min(4,progress*4)))/(vfxAssets.beam?.fps||24);
      drawAtlasLine(lightning?'tesla':'beam',lineTime,x,y,endX,endY,lightning?(item.phase==='echo'?10:18):Math.max(4,item.width||30),(lightning?.86:.7)*(item.strength||1));
      if(lightning)drawVfx('whiteSpark',(reducedMotion?.38:progress)*vfxDuration(vfxAssets.whiteSpark),endX,endY,Math.min(38,item.phase==='echo'?20:32),{once:true,alpha:.75});
      else{
        const flashTime=(reducedMotion?.38:Math.min(.62,.2+progress*.4))*vfxDuration(vfxAssets.magicImpact);
        glow(x,y,58,'violet',.48*(1-progress));
        drawVfx('whiteSpark',(reducedMotion?.38:Math.min(.8,.28+progress))*vfxDuration(vfxAssets.whiteSpark),x,y,42,{once:true,alpha:.85});
        drawVfx('magicImpact',flashTime,x,y,46,{once:true,alpha:.7,tint:'#ffc4e9'});
        glow(endX,endY,44,'violet',.4*(1-progress));
        for(const point of (item.impactPoints||[]).slice(0,6))drawVfx('magicImpact',flashTime,point.x-camera.x,point.y-camera.y,32,{once:true,alpha:.54,tint:'#ffc4e9'});
      }
      ctx.restore();return;
    }
    if(!item.telegraph && shape==='ring' && item.weapon==='nova'){
      const wavePhase=Math.min(1,progress/.58),ringRadius=radius*(reducedMotion?.8:.3+.7*(1-Math.pow(1-wavePhase,2)));
      // A torn pressure front has a filled band, bright leading facets and a dark wake.
      const edgeCount=reducedMotion?24:36,band=Math.max(7,radius*.12)*(1-progress*.5);
      ctx.save();ctx.globalAlpha*=Math.min(.8,(1-progress)*1.1);
      const traceWave=(outer)=>{for(let i=0;i<=edgeCount;i++){const j=outer?i:edgeCount-i,a=j*TAU/edgeCount,noise=1+Math.sin(j*5.71)*.035,rr=outer?ringRadius*noise:Math.max(0,ringRadius-band)*noise;const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;if(i===0&&outer)ctx.moveTo(px,py);else ctx.lineTo(px,py);}};
      ctx.globalAlpha*=.42;ctx.fillStyle='#9c83bb';ctx.beginPath();traceWave(true);traceWave(false);ctx.closePath();ctx.fill();
      ctx.restore();
      glow(x,y,Math.min(160,radius*1.4),'violet',.6*Math.pow(1-progress,2));
      impactFragments(x,y,progress,radius,0,'violet',reducedMotion,18);
      ctx.save();ctx.globalAlpha*=.3*(1-progress);ctx.fillStyle='#e5ddff';
      for(let i=0;i<10;i++){const a=i*TAU/10;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*ringRadius*.82,y+Math.sin(a)*ringRadius*.82);ctx.lineTo(x+Math.cos(a-.055)*ringRadius,y+Math.sin(a-.055)*ringRadius);ctx.lineTo(x+Math.cos(a+.055)*ringRadius,y+Math.sin(a+.055)*ringRadius);ctx.closePath();ctx.fill();}ctx.restore();
      // Damage already happened over the whole disk; this is a sparse residual pressure wave.
      if(progress<.18){ctx.save();ctx.globalAlpha*=.07*(1-progress/.18);ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();ctx.restore();}
      // One authored radial wave keeps its continuous irregular contour, without pearl-shaped copies.
      drawVfx('shockNoise',(7+(reducedMotion?1:Math.min(2,progress*2)))/(vfxAssets.shockNoise?.fps||22),x,y,ringRadius*2.15,{once:true,alpha:reducedMotion?.2:.34});
      ctx.fillStyle='rgba(232,225,255,.6)';for(let i=0;i<9;i++){const a=i*2.39996,d=ringRadius*(.82+.14*Math.sin(i*4));ctx.fillRect(x+Math.cos(a)*d,y+Math.sin(a)*d,2,2);}
      ctx.restore();return;
    }
    if(!item.telegraph && shape==='circle' && ['meteor','mine'].includes(item.weapon)){
      ctx.save();ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.clip();drawVfx('fireExplosion',(reducedMotion?.38:progress)*vfxDuration(vfxAssets.fireExplosion),x,y-6,radius*1.8,{once:true,alpha:.78});ctx.restore();ctx.restore();return;
    }
    if(item.weapon==='aegis'&&(shape==='circle'||shape==='ring')){
      const shieldScale=radius/38||1;
      if(item.phase==='break'){
        drawVfx('shield',vfxDuration(vfxAssets.shield)*(.68+pulse*.01+progress*.28),x,y-18,86,{once:true,alpha:1-progress,tint:'#fff0a3'});
        for(let i=0;i<6;i++){const a=i*TAU/6,d=30+progress*18;drawVfx('whiteSpark',vfxDuration(vfxAssets.whiteSpark)*.4,x+Math.cos(a)*d,y-17+Math.sin(a)*d,16,{once:true,alpha:(1-progress)*.5});}
      }else if(item.phase==='retaliation'){
        for(let i=0;i<12;i++){const a=i*TAU/12,d=radius*(reducedMotion?.65:progress);drawVfx('whiteSpark',(reducedMotion?.38:progress)*vfxDuration(vfxAssets.whiteSpark),x+Math.cos(a)*d,y+Math.sin(a)*d,30,{once:true,alpha:.7,tint:'#fff0a3'});}
      }else{
        drawVfx('shield',reducedMotion?vfxDuration(vfxAssets.shield)*.42:renderTime,x,y-18,86*shieldScale,{loop:true,alpha:.72,tint:item.shieldStyle==='bastion'?'#f8efb5':'#fff0a3'});
        if(item.shieldStyle==='thorns')for(let i=0;i<6;i++){
          const a=i*TAU/6,d=radius*.92;
          drawVfx('whiteSpark',vfxDuration(vfxAssets.whiteSpark)*.38,x+Math.cos(a)*d,y-18+Math.sin(a)*d,15,{once:true,alpha:.65,tint:'#fff0a3'});
        }
        const capacity=Math.max(.08,Math.min(1,item.shieldRatio??1));ctx.strokeStyle='rgba(245,241,196,.85)';ctx.lineWidth=capacity>.7?2.5:1.2;
        for(let i=0;i<6;i++){const a=i*TAU/6;ctx.beginPath();ctx.arc(x,y-17,31*shieldScale,a+.08,a+.08+capacity*.67);ctx.stroke();}
      }ctx.restore();return;
    }
    if(shape==='construct'&&item.kind==='familiar'){
      const key=item.heavy?'familiarHeavy':'familiarLight',fireAge=renderTime-(item.fireTime??-100),acting=fireAge<.22;
      ctx.restore();unit({...item,anim:acting?'attack':'idle',animTime:reducedMotion?.2:acting?fireAge:renderTime,facing:Math.cos(item.fireAngle??item.angle)>=0?1:-1},key,camera);
      if(acting)drawVfx('whiteSpark',(reducedMotion?.38:fireAge/.22)*vfxDuration(vfxAssets.whiteSpark),x+Math.cos(item.fireAngle)*15,y-18,18,{once:true,alpha:.68});return;
    }
    if(shape==='construct'&&item.kind==='mine'){
      if(item.arming<=0)glow(x,y-6,34,'gold',.3);
      drawVfx('rockWall',0,x,y,Math.max(30,radius*2.2),{once:true,alpha:.95});
      ctx.fillStyle=item.arming>0?'#998765':'#fff2b0';ctx.shadowColor='#ffe7a3';ctx.shadowBlur=item.arming>0?0:6;ctx.fillRect(x-2,y-8,4,4);ctx.shadowBlur=0;ctx.restore();return;
    }
    if(shape==='sector'){
      traceSector(x,y,radius,angle,Number(item.width)||1.2);ctx.globalAlpha*=.2;ctx.fill();ctx.globalAlpha*=4.2;ctx.lineWidth=2;ctx.stroke();
    }else if(shape==='line'){
      const length=Number.isFinite(item.length)?item.length:Math.hypot(tx-x,ty-y),endX=Number.isFinite(item.toX)?tx:x+Math.cos(angle)*length,endY=Number.isFinite(item.toY)?ty:y+Math.sin(angle)*length;
      const fullWidth=Number.isFinite(item.width)?Math.max(1,item.width):Math.max(2,radius*2);
      ctx.globalAlpha*=.18;ctx.lineWidth=fullWidth;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(endX,endY);ctx.stroke();ctx.globalAlpha*=4.8;ctx.lineWidth=2;ctx.stroke();
    }else if(shape==='projectile'){
      if(item.kind==='homing'||item.kind==='bolt'||item.kind==='boomerang'||item.kind==='orbit'){
        ctx.restore();drawProjectile({...item,weapon:item.weapon==='familiar'?'orb':item.weapon,friendly:true},camera,reducedMotion);return;
      }
      if(item.kind==='meteor'){
        const delay=Math.max(0,Number(item.delay)||0),total=Math.max(.001,Number(item.maxLife)||delay||1),fall=1-Math.min(1,delay/total);
        const py=y-110+fall*98,size=Math.max(24,radius*.6);
        if(!reducedMotion)drawVfx('fireImpact',renderTime,x-8,py-22,size*.7,{loop:true,angle:Math.PI,alpha:.45});
        drawVfx('flameCore',reducedMotion?vfxDuration(vfxAssets.flameCore)*.36:renderTime,x,py,size,{loop:true,tint:'#ffa063',alpha:.9});ctx.restore();return;
      }
      const projectileAngle=Math.atan2(ty-y,tx-x),length=Math.max(radius*2.6,10);
      if(!reducedMotion&&Number.isFinite(item.toX)){ctx.globalAlpha*=.25;ctx.lineWidth=Math.max(2,halfWidth);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.stroke();ctx.globalAlpha*=3.2;}
      ctx.translate(x,y);ctx.rotate(projectileAngle);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(length,0);ctx.lineTo(-length*.65,-Math.max(radius,4));ctx.lineTo(-length*.25,0);ctx.lineTo(-length*.65,Math.max(radius,4));ctx.closePath();ctx.fill();
    }else if(shape==='ring'){
      if(item.expands){ctx.save();ctx.globalAlpha*=.28;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.stroke();ctx.restore();}
      ctx.lineWidth=Math.max(2,halfWidth);ctx.beginPath();ctx.arc(x,y,radius*(item.expands?Math.max(.08,progress):1),0,TAU);ctx.stroke();
    }else if(shape==='construct'){
      if(layer==='below'){ctx.globalAlpha*=.24;ctx.beginPath();ctx.ellipse(x,y+radius*.25,radius*1.15,Math.max(5,radius*.48),0,0,TAU);ctx.fill();ctx.globalAlpha*=3.2;ctx.lineWidth=2;ctx.stroke();}
      else {ctx.translate(x,y);ctx.rotate(angle);ctx.lineWidth=3;if(item.kind==='mine'){ctx.beginPath();ctx.moveTo(0,-radius);ctx.lineTo(radius,0);ctx.lineTo(0,radius);ctx.lineTo(-radius,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#182622';ctx.beginPath();ctx.arc(0,0,Math.max(2,radius*.2),0,TAU);ctx.fill();}else{ctx.strokeRect(-radius*.7,-radius*.7,radius*1.4,radius*1.4);ctx.beginPath();ctx.moveTo(-radius*.45,0);ctx.lineTo(radius*.45,0);ctx.moveTo(0,-radius*.45);ctx.lineTo(0,radius*.45);ctx.stroke();}}
    }else{
      ctx.save();ctx.globalAlpha*=.18;ctx.beginPath();ctx.arc(x,y,radius*pulse,0,TAU);ctx.fill();ctx.restore();ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.stroke();
      if(item.telegraph){ctx.globalAlpha*=.72;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,radius*Math.max(.06,1-progress),0,TAU);ctx.stroke();}
    }
    ctx.restore();
  }

  function drawAbilityCollections(game,camera,reducedMotion,layer) {
    for(const item of game.commonEffects||[]){
      if(item.weapon==='frost'&&item.layer==='ground'){
        if(layer==='below')drawPoisonField(item,camera,reducedMotion);
        continue;
      }
      if(item.weapon==='vortex'&&item.layer==='ground'){
        if(layer==='below'){
          const x=item.x-camera.x,y=item.y-camera.y,r=item.radius;
          ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.clip();
          const age=Math.max(0,item.maxLife-item.life),fade=Math.min(1,item.life/.45);
          drawVfx('vortex',reducedMotion?vfxDuration(vfxAssets.vortex)*.42:age,x,y,r*1.45,{loop:true,scaleY:.7,alpha:.38*fade,tint:'#bc86ff'});
          ctx.fillStyle='rgba(11,8,24,.22)';ctx.beginPath();ctx.ellipse(x,y,r*.16,r*.12,0,0,TAU);ctx.fill();
          for(let i=0;i<12;i++){const phase=reducedMotion?.5:(age*.42+i/12)%1,a=i*2.39996+(reducedMotion?0:phase*.8),d=r*(.88-.68*phase);ctx.fillStyle='rgba(204,191,255,.45)';ctx.fillRect(x+Math.cos(a)*d,y+Math.sin(a)*d,2,2);}ctx.restore();
          ctx.save();ctx.strokeStyle='rgba(170,145,239,.36)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();ctx.restore();
        }
        continue;
      }
      if(item.weapon==='aegis'&&item.maxLife>1){
        if(!(Number(game.player?.commonShield)>0))continue;
        drawAbilityShape({...item,x:game.player.x,y:game.player.y,shieldRatio:game.player.commonShield/Math.max(1,item.capacity||game.player.commonShield)},camera,reducedMotion,layer);
      }else drawAbilityShape(item,camera,reducedMotion,layer);
    }
    const latestShots=new Map(),activeShots=new Set((game.heroKit?.projectiles||[]).map(shot=>shot.visualShotId));
    for(const item of game.heroEffects||[])if(item.shape==='projectile'&&item.visualShotId!=null)latestShots.set(item.visualShotId,item);
    for(const item of game.heroEffects||[]){
      if(item.original||item.visualKind==='newHero'||item.visualKind==='mythicHero')continue;
      // Per-update positions are traces of one live weapon, not separate solid weapons.
      if(item.shape==='projectile'&&item.visualShotId!=null&&(!activeShots.has(item.visualShotId)||latestShots.get(item.visualShotId)!==item))continue;
      drawAbilityShape(item,camera,reducedMotion,layer,'above');
    }
    for(const item of game.commonEntities||[]){
      // Zones already have a ground effect; drawing the entity again covered units twice.
      if(item.kind==='zone')continue;
      drawAbilityShape(item.kind==='burn'?{...item,layer:'ground'}:item,camera,reducedMotion,layer,'above');
    }
  }

  const trialKinds=new Set(['trial_commander','trial_swift','trial_summoner','trial_blink','trial_mage']);
  const trialKits=new Set(['trialBulwark','trialPursuer','trialBinder','trialRift','trialPrism']);

  // Texture is clipped to the authored hit shape, including the safe ring centre.
  // Static samples in reduced motion keep the same boundaries and timing labels.
  function drawTrialHazardTexture(h,r,warning,progress,age,reducedMotion) {
    if(!trialKits.has(h.trialKit))return;
    const moveKeys={landing:'bossSlam',spiritFan:'summon',soulPulse:'magicImpact',orderedMarks:'blinkSeal',innerPulse:'fireExplosion',outerRing:'magicImpact',channel:'summon'};
    const key=vfxAssets[h.vfxKey]?h.vfxKey:moveKeys[h.trialMove]||({trialBulwark:'bossCleave',trialPursuer:'dash',trialBinder:'summon',trialRift:'blinkSeal',trialPrism:'magicImpact'}[h.trialKit]);
    const time=reducedMotion?vfxDuration(vfxAssets[key])*.4:warning?age*.65:progress*vfxDuration(vfxAssets[key]);
    const alpha=warning?.12+.09*progress:.86*(1-progress*.75);
    ctx.save();ctx.beginPath();
    if(h.shape==='ring'){
      const inner=Math.max(0,h.innerRadius??r-(h.width||22)),outer=h.outerRadius??r;
      ctx.arc(0,0,outer,0,TAU);ctx.arc(0,0,inner,0,TAU,true);ctx.clip('evenodd');
      const count=reducedMotion?8:12,middle=(inner+outer)/2;
      for(let i=0;i<count;i++){const a=i*TAU/count;drawVfx(key,time,Math.cos(a)*middle,Math.sin(a)*middle,(outer-inner)*2.1,{loop:warning,once:!warning,alpha,tint:'#ff5268',angle:a});}
    }else if(h.shape==='line'){
      const dx=(h.toX??h.x)-h.x,dy=(h.toY??h.y)-h.y,len=Math.hypot(dx,dy),width=h.width||32;
      ctx.rotate(Math.atan2(dy,dx));ctx.rect(0,-width/2,len,width);ctx.clip();
      drawAtlasLine(h.trialKit==='trialRift'?'tesla':'beam',time,0,0,len,0,width,alpha,'#ff5268');
      const count=reducedMotion?3:5;
      for(let i=0;i<count;i++)drawVfx(key,time,len*(i+.5)/count,0,width*2.2,{loop:warning,once:!warning,angle:Math.PI/2,alpha:alpha*.75,tint:'#ff5268'});
    }else{
      if(h.shape==='sector'){ctx.moveTo(0,0);ctx.arc(0,0,r,(h.angle||0)-(h.width||1.92)/2,(h.angle||0)+(h.width||1.92)/2);ctx.closePath();}
      else ctx.arc(0,0,r,0,TAU);
      ctx.clip();
      drawVfx(key,time,0,0,r*2,{loop:warning,once:!warning,alpha,tint:'#ff5268',angle:h.angle||0});
      const count=reducedMotion?3:6;
      for(let i=0;i<count;i++){
        const a=h.shape==='sector'?(h.angle||0)+(i/count-.5)*(h.width||1.92):i*TAU/count;
        const d=r*(warning?.72:(reducedMotion?.6:.35+progress*.45));
        drawVfx('whiteSpark',vfxDuration(vfxAssets.whiteSpark)*.4,Math.cos(a)*d,Math.sin(a)*d,warning?12:20,{once:true,alpha:warning?.26:.62,tint:'#ff5268'});
      }
    }
    ctx.restore();
  }

  function drawTrialLinks(game,camera,reducedMotion) {
    for(const node of game.enemies||[]){
      if(!node.trialConstruct||node.dead||node.spawnDelay>0)continue;
      const owner=(game.enemies||[]).find(e=>e.id===node.trialOwnerId&&!e.dead&&trialKinds.has(e.kind));
      if(!owner)continue;
      // A slender tether describes protection, not a new damaging barrier.
      drawAtlasLine('tesla',reducedMotion?.2:renderTime*.5,owner.x-camera.x,owner.y-camera.y-18,node.x-camera.x,node.y-camera.y-12,3,.32,'#d5bcff');
      drawVfx('blinkSeal',0,node.x-camera.x,node.y-camera.y,38,{once:true,alpha:.32,tint:'#d5bcff'});
    }
  }

  function drawTrialCue(e,camera,reducedMotion) {
    if(e.dead||e.spawnDelay>0)return;
    const isBoss=trialKinds.has(e.kind),node=!!e.trialConstruct;
    if(!isBoss&&!node)return;
    const x=e.x-camera.x,y=e.y-camera.y,cue=e.trialCue;
    if(node){
      const px=Math.max(25,Math.min(viewWidth-25,x)),py=Math.max(78,Math.min(viewHeight-16,y-36));
      ctx.save();ctx.fillStyle='#100e1a';ctx.fillRect(px-22,py,44,5);ctx.fillStyle='#d8b7ff';ctx.fillRect(px-21,py+1,42*Math.max(0,Math.min(1,e.hp/Math.max(1,e.maxHp))),3);
      ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillStyle='#f0dfff';ctx.fillText('击破节点',px,py-3);ctx.restore();return;
    }
    if(!cue)return;
    const mode=cue.mode,progress=Math.max(0,Math.min(1,cue.progress||0));
    ctx.save();
    if(mode==='guard')drawVfx('shield',reducedMotion?vfxDuration(vfxAssets.shield)*.42:renderTime,x,y-25,88,{loop:true,alpha:.48,tint:'#bde1ff'});
    if(mode==='exposed'){
      drawVfx('whiteSpark',vfxDuration(vfxAssets.whiteSpark)*.4,x-25,y-24,20,{once:true,alpha:.78,tint:'#fff0a3'});
      drawVfx('whiteSpark',vfxDuration(vfxAssets.whiteSpark)*.4,x+25,y-24,20,{once:true,alpha:.78,tint:'#fff0a3'});
    }
    // Reserve the row beneath the boss bar: edge-positioned bosses must not put
    // channel instructions behind pause/skill controls or over their own body.
    const px=viewWidth/2,py=viewHeight<=500?85:128;
    const label=cue.label||({guard:'盾势 · 减伤',exposed:'破绽 · 全力攻击',channel:'攻击打断聚能',linked:'击破节点 · 解除保护'}[mode]||'');
    ctx.font='bold 11px system-ui';ctx.textAlign='center';
    const width=Math.min(156,ctx.measureText(label).width+14);
    ctx.fillStyle='rgba(9,14,19,.88)';ctx.fillRect(px-width/2,py-12,width,mode==='channel'?24:17);
    ctx.fillStyle=mode==='exposed'?'#fff0a3':mode==='channel'?'#bceeff':'#efdfeb';ctx.fillText(label,px,py,width-8);
    if(mode==='channel'){
      ctx.fillStyle='#32404c';ctx.fillRect(px-width/2+6,py+4,width-12,4);
      ctx.fillStyle='#bceeff';ctx.fillRect(px-width/2+6,py+4,(width-12)*progress,4);
    }
    ctx.restore();
  }

  // Enemy geometry is simulation-authored. Render never advances a radius or
  // rotates a gap: the same visible boundaries are consumed by damage checks.
  function drawEnemyHazard(h, camera, reducedMotion) {
    if (!h || !Number.isFinite(h.x) || !Number.isFinite(h.y)) return;
    const x=h.x-camera.x,y=h.y-camera.y,r=Math.max(0,h.radius||0);
    const warning=!!h.telegraph || h.type==='warning';
    const total=Math.max(.001,h.total||h.maxLife||1), remaining=Math.max(0,h.remaining??h.life??0);
    const progress=Math.max(0,Math.min(1,1-remaining/total));
    const beetle=String(h.move).toLowerCase().includes('blast')||String(h.move).toLowerCase().includes('beetle')||h.move==='detonate';
    const color=h.type==='aura'?'#d9cf9b':'#ff5268';
    ctx.save();ctx.translate(x,y);ctx.lineJoin='round';ctx.lineCap='round';
    drawTrialHazardTexture(h,r,warning,progress,total-remaining,reducedMotion);
    // Active animation stays inside collision geometry, including the open ring gap.
    if(!warning&&!trialKits.has(h.trialKit)&&!['aura','scar','seed'].includes(h.type)){
      ctx.save();ctx.beginPath();
      if(h.shape==='ring'){
        const inner=Math.max(0,h.innerRadius??r-(h.width||22)),outer=h.outerRadius??r,start=(h.gapAngle||0)+(h.gapWidth||0)/2,end=start+TAU-(h.gapWidth||0);
        ctx.arc(0,0,outer,start,end);ctx.lineTo(Math.cos(end)*inner,Math.sin(end)*inner);ctx.arc(0,0,Math.max(.1,inner),end,start,true);ctx.closePath();
      }else if(h.shape==='sector'){ctx.moveTo(0,0);ctx.arc(0,0,r,(h.angle||0)-(h.width||1.92)/2,(h.angle||0)+(h.width||1.92)/2);ctx.closePath();}
      else if(h.shape==='line'){const dx=(h.toX??h.x)-h.x,dy=(h.toY??h.y)-h.y;ctx.rotate(Math.atan2(dy,dx));ctx.rect(0,-(h.width||42)/2,Math.hypot(dx,dy),h.width||42);}
      else ctx.arc(0,0,r,0,TAU);
      ctx.clip();const time=reducedMotion?.25:total-remaining;
      if(h.shape==='line')drawAtlasLine('beam',time,0,0,Math.hypot((h.toX??h.x)-h.x,(h.toY??h.y)-h.y),0,h.width||42,.8,'#ff5268');
      else if(h.shape==='ring'){
        const inner=Math.max(0,h.innerRadius??r-(h.width||22)),outer=h.outerRadius??r,middle=(inner+outer)/2,gap=h.gapWidth||0,start=(h.gapAngle||0)+gap/2,span=TAU-gap,count=reducedMotion?8:12;
        for(let i=0;i<count;i++){const a=start+span*(i+.5)/count;drawVfx('bossCleave',time+i*.035,Math.cos(a)*middle,Math.sin(a)*middle,(outer-inner)*3,{loop:true,alpha:.65,tint:'#ff5268',angle:a});}
      }else {const key=h.shape==='sector'?'bossCleave':'bossSlam';drawVfx(key,(reducedMotion?.45:progress)*vfxDuration(vfxAssets[key]),0,0,r*2.4,{once:true,alpha:.7,tint:'#ff5268'});}
      ctx.restore();
    }
    const outline=(trace)=>{ctx.beginPath();trace();ctx.strokeStyle='rgba(22,16,22,.9)';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();};
    const arc=(rad,start=0,end=TAU)=>ctx.arc(0,0,Math.max(.1,rad),start,end);
    if(h.type==='aura'){
      outline(()=>arc(r));ctx.strokeStyle='rgba(217,207,155,.45)';ctx.lineWidth=1.4;
      // Small separated hexagons keep the shield field open rather than painting a disc.
      for(let i=0;i<12;i++){const a=i*TAU/12,cx=Math.cos(a)*r*.74,cy=Math.sin(a)*r*.74;ctx.beginPath();for(let j=0;j<6;j++){const b=j*TAU/6,px=cx+Math.cos(b)*9,py=cy+Math.sin(b)*9;j?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.stroke();}
      ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();arc(r+4,-Math.PI/2,-Math.PI/2+TAU*(1-progress));ctx.stroke();
    }else if(h.shape==='ring'){
      const inner=Math.max(0,h.innerRadius??r-(h.width||22)),outer=Math.max(inner,h.outerRadius??r);
      const gap=Math.max(0,h.gapWidth||0),start=(h.gapAngle||0)+gap/2,end=start+TAU-gap;
      const fullTrialRing=trialKits.has(h.trialKit)&&gap===0;
      const band=()=>{if(fullTrialRing){arc(outer);ctx.closePath();ctx.moveTo(inner,0);ctx.arc(0,0,Math.max(.1,inner),TAU,0,true);ctx.closePath();}else{arc(outer,start,end);ctx.lineTo(Math.cos(end)*inner,Math.sin(end)*inner);ctx.arc(0,0,Math.max(.1,inner),end,start,true);ctx.closePath();}};
      ctx.beginPath();band();ctx.fillStyle=warning?'rgba(255,52,76,.055)':'rgba(255,52,76,.14)';ctx.fill();outline(band);
      if(warning){const timer=inner+(outer-inner)*progress;outline(()=>arc(timer,start,end));}
      // End caps mark the safe gap; never bridge it with a full-circle outline.
      ctx.strokeStyle='#c9f1dc';ctx.lineWidth=3;for(const a of fullTrialRing?[]:[start,end]){ctx.beginPath();ctx.moveTo(Math.cos(a)*(inner-5),Math.sin(a)*(inner-5));ctx.lineTo(Math.cos(a)*(outer+5),Math.sin(a)*(outer+5));ctx.stroke();}
    }else if(h.shape==='line'){
      const dx=(h.toX??h.x)-h.x,dy=(h.toY??h.y)-h.y,len=Math.hypot(dx,dy),half=(h.width||42)/2;
      ctx.rotate(Math.atan2(dy,dx));const box=()=>ctx.rect(0,-half,len,half*2);
      ctx.beginPath();box();ctx.fillStyle='rgba(255,52,76,.08)';ctx.fill();outline(box);
      if(warning){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(len*progress,-half);ctx.lineTo(len*progress,half);ctx.stroke();}

    }else if(h.shape==='sector'){
      const start=(h.angle||0)-(h.width||1.92)/2,end=start+(h.width||1.92);
      const sector=()=>{ctx.moveTo(0,0);arc(r,start,end);ctx.closePath();};
      ctx.beginPath();sector();ctx.fillStyle='rgba(255,52,76,.075)';ctx.fill();outline(sector);
      if(warning){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();arc(r*(1-progress),start,end);ctx.stroke();}
    }else{
      if(h.type==='scar'){
        ctx.strokeStyle='rgba(204,174,140,.65)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-r*.5,0);ctx.lineTo(-r*.15,-5);ctx.lineTo(r*.1,4);ctx.lineTo(r*.5,-1);ctx.stroke();
        ctx.setLineDash([4,6]);outline(()=>arc(r*.55));
      }else{
        ctx.beginPath();arc(r);ctx.fillStyle=beetle?'rgba(255,52,76,.08)':'rgba(255,52,76,.075)';ctx.fill();outline(()=>arc(r));
        if(warning){if(beetle)ctx.setLineDash([5,5]);outline(()=>arc(Math.max(2,r*(1-progress))));ctx.setLineDash([]);ctx.strokeStyle='#ff9cad';ctx.lineWidth=3;ctx.beginPath();arc(r+4,-Math.PI/2,-Math.PI/2+TAU*progress);ctx.stroke();}
        if(h.type==='seed'){
          ctx.strokeStyle='#ff9cad';ctx.lineWidth=2;for(let i=0;i<3;i++){const a=i*TAU/3;ctx.beginPath();ctx.moveTo(Math.cos(a)*7,Math.sin(a)*7);ctx.lineTo(Math.cos(a)*16,Math.sin(a)*16);ctx.stroke();}
          ctx.beginPath();arc(6);ctx.stroke();
        }
      }
    }
    ctx.restore();
    // Compact clock remains readable with reduced motion; no flashing or particles needed.
    if(warning){
      let clockX=x,clockY=beetle?y-r*.65:y;
      if(h.shape==='ring'){const d=((h.innerRadius||0)+(h.outerRadius||r))/2;clockX+=Math.cos(h.gapAngle||0)*d;clockY+=Math.sin(h.gapAngle||0)*d;}
      if(h.shape==='line'){clockX+=((h.toX??h.x)-h.x)*.5;clockY+=((h.toY??h.y)-h.y)*.5;}
      const numbered=trialKits.has(h.trialKit)&&Number.isInteger(h.ordinal);
      const label=numbered?`${h.ordinal} · ${remaining.toFixed(1)}`:remaining.toFixed(1),clockWidth=numbered?48:30;
      ctx.save();ctx.font=`bold ${numbered?12:10}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#182328';ctx.fillRect(clockX-clockWidth/2,clockY-9,clockWidth,18);ctx.fillStyle='#ffe8c5';ctx.fillText(label,clockX,clockY+4);ctx.restore();
    }
  }

  function unit(entity, kind, camera, scale = 1) {
    const asset = unitAssets[kind]; const image = images[kind];
    if (!asset || !image) return;
    // Skills and attacks retain their authored pose while the hero keeps moving.
    const acting = (entity.anim === "attack" || entity.anim === "cast") && entity.animDuration > 0 && entity.animTime < entity.animDuration;
    const walking = entity._hero && entity.moving && entity.hp > 0 && !acting;
    const animation = pickAnimation(asset, walking ? "move" : entity.anim || "idle");
    const heldFrame = Number.isInteger(entity.animHoldFrame) && entity.animHoldFrame >= 0 ? animation?.frames?.[Math.min(entity.animHoldFrame, animation.frames.length-1)] : null;
    const frame = heldFrame || frameAt(animation, walking ? entity.moveTime || 0 : entity.animTime || 0, walking || asset.authoredSize ? 0 : entity.animDuration || 0);
    if (!frame) return;
    const anchor = asset.anchor || { x: 0.5, y: 0.82 };
    // General atlases have different transparent margins; keep visible bodies comparable.
    const baseSizes = { general_commander: 150, general_summoner: 120, general_blink: 110, general_mage: 104, hero: 120, hero_duelist: 120, hero_mage: 120, healer_basic: 120, scout_basic: 116, guard_basic: 116, guard_elite: 136, grunt: 108, runner: 112, brute: 140 };
    const size = (asset.renderSize || baseSizes[kind] || 108) * .85 * (asset.authoredSize ? 1 : entity.boss ? 1.48 : entity.elite ? 1.16 : 1) * scale;
    const aspect = frame.w / frame.h; const w = size * aspect, h = size;
    const x = entity.x - camera.x, y = entity.y - camera.y;
    if(!entity.visualGhost){ctx.save(); ctx.globalAlpha = kind === "hero" ? 0.38 : 0.3; ctx.fillStyle = "#05090b"; ctx.beginPath(); ctx.ellipse(x, y + 2, Math.max(18, entity.radius * 1.05), Math.max(6, entity.radius * 0.34), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();}
    ctx.save(); ctx.translate(x, y); ctx.scale((acting ? entity.animFacing : null) || entity.facing || 1, 1);
    ctx.imageSmoothingEnabled = false;
    const flash=Math.max(0,Math.min(1,(entity.hitFlash||0)/.12));
    // A render-only recoil preserves simulation position and collision geometry.
    if(flash>0&&!motionReduced)ctx.translate(-((entity.facing||1)*3.2*flash),-1.4*flash);
    if(entity.dead)ctx.globalAlpha=Math.min(1,Math.max(0,entity.deathLife ?? .35)/.35);
    const outlined = outlinedFrame(kind, image, frame);
    if (outlined) {
      const padX = w * 2 / frame.w, padY = h * 2 / frame.h;
      ctx.drawImage(entity.spiritTint?colorFrame(outlined,entity.spiritTint):outlined, -w * anchor.x - padX, -h * anchor.y - padY, w + padX * 2, h + padY * 2);
    } else ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, -w * anchor.x, -h * anchor.y, w, h);
    if(flash>0){
      const key=`${kind}:${frame.x},${frame.y},${frame.w},${frame.h}`;
      let mask=whiteFrames.get(key);
      if(!mask){mask=makeCanvas(frame.w,frame.h);const c=mask.getContext('2d');c.drawImage(image,frame.x,frame.y,frame.w,frame.h,0,0,frame.w,frame.h);c.globalCompositeOperation='source-in';c.fillStyle='#ffffff';c.fillRect(0,0,mask.width,mask.height);if(whiteFrames.size>=96)whiteFrames.delete(whiteFrames.keys().next().value);whiteFrames.set(key,mask);}
      // Rapid multi-target hits must retain each enemy's material and silhouette.
      const flashOpacity=(entity._hero||entity._ally) ? .86 : motionReduced ? .18 : .36;
      ctx.globalAlpha*=flash*flashOpacity;ctx.drawImage(mask,-w*anchor.x,-h*anchor.y,w,h);
    }
    ctx.restore();
  }

  function drawAscensionRushes(game,camera,reducedMotion) {
    for(const rush of game.ascensionHero?.rushes||[]){
      const ally=(game.companions||[]).find(c=>c.id===rush.id&&c.hp>0&&!c.incapacitated);if(!ally||rush.life<=0)continue;
      const a=Math.atan2(ally.y-rush.from.y,ally.x-rush.from.x),travel=Math.hypot(ally.x-rush.from.x,ally.y-rush.from.y),phase=Math.min(1,rush.elapsed/.45);
      if(travel<5)continue;
      const count=reducedMotion?1:3;
      for(let i=count;i>0;i--){const back=Math.min(travel,12+i*13),x=ally.x-Math.cos(a)*back,y=ally.y-Math.sin(a)*back;
        ctx.save();ctx.globalAlpha=(reducedMotion?.16:.1+.035*(count-i));unit({...ally,x,y,anim:'attack',animTime:rush.elapsed,hitFlash:0,visualGhost:true,spiritTint:'#b7ffe2'},ally.kind,camera,.96);ctx.restore();
        drawVfx('dash',vfxDuration(vfxAssets.dash)*(.15+phase*.3),x-camera.x,y-camera.y-15,48,{once:true,angle:a-Math.PI/2,alpha:.23,tint:'#a5fbd6'});
      }
      drawVfx('swordField',vfxDuration(vfxAssets.swordField)*(.25+phase*.35),ally.x-camera.x-Math.cos(a)*8,ally.y-camera.y-18,58,{once:true,angle:a,alpha:.45,tint:'#dcffec'});
    }
  }

  function render(game, { width = canvas.clientWidth, height = canvas.clientHeight, dpr = devicePixelRatio || 1, reducedMotion = false } = {}) {
    if (dead || !game) return;
    renderTime = game.time || 0; motionReduced = reducedMotion;
    width = Math.max(1, width); height = Math.max(1, height); viewWidth=width;viewHeight=height; dpr = Math.min(2, Math.max(1, dpr));
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#10191d"; ctx.fillRect(0, 0, width, height);
    const world = game.world || { width: 2400, height: 1800 };
    const camera = getBattleCamera({...game,world},width,height);
    // Overscan exposes non-walkable space. Only the authored world receives terrain.
    ctx.save(); ctx.beginPath();ctx.rect(-camera.x,-camera.y,world.width,world.height);ctx.clip();
    ctx.fillStyle='#162b26';ctx.fillRect(0,0,width,height);
    if (terrain) {
      const tw = terrain.naturalWidth || 512, th = terrain.naturalHeight || 512;
      for (let x = -camera.x % tw - tw; x < width + tw; x += tw) for (let y = -camera.y % th - th; y < height + th; y += th) ctx.drawImage(terrain, Math.round(x), Math.round(y), tw, th);
      ctx.fillStyle = "rgba(8,20,18,.22)"; ctx.fillRect(0, 0, width, height);
      if (game.dungeon?.region) {
        const region = String(game.dungeon.region), tones = ["rgba(37,79,91,.10)", "rgba(92,54,42,.09)", "rgba(70,48,94,.09)", "rgba(92,83,39,.08)"];
        let hash = 0; for (let i = 0; i < region.length; i++) hash = (hash * 31 + region.charCodeAt(i)) | 0;
        ctx.fillStyle = tones[Math.abs(hash) % tones.length]; ctx.fillRect(0, 0, width, height);
      }
    }
    ctx.restore();
    drawWorldObjects(game,camera);
    ctx.strokeStyle = "rgba(130,232,184,.35)"; ctx.lineWidth = 5; ctx.strokeRect(-camera.x, -camera.y, world.width, world.height);
    for (const field of game.fields||[]) if(field.type==='heroFrost') drawHeroFrost({...field,maxLife:field.maxLife||field.life},camera,reducedMotion); else if(field.type==='poisonField') drawPoisonField({...field,maxLife:field.maxLife||field.life},camera,reducedMotion); else if(field.type==='rockWall') drawRockWall({...field,maxLife:field.maxLife||field.life},camera,reducedMotion);
    for (const effect of game.effects) if (effect.type === "telegraph") continue; else if (effect.type === "swordField" || effect.type === "frostField") drawField(effect.guard?{...effect,x:game.player.x,y:game.player.y}:effect, camera, reducedMotion); else if(effect.type==='poisonField') drawPoisonField(effect,camera,reducedMotion); else if(effect.type==='blinkImpact') drawCombatEffect(effect,camera,reducedMotion);
    for (const hazard of game.enemyHazards || []) if(!hazard.telegraph&&hazard.type!=='warning')drawEnemyHazard(hazard, camera, reducedMotion);
    drawAbilityCollections(game,camera,reducedMotion,'below');
    specialHeroes.render(game,camera,reducedMotion,'below');
    mythicHeroes.render(game,camera,reducedMotion,'below');originalHeroes.render(game,camera,reducedMotion,'below');
    drawAscensionRushes(game,camera,reducedMotion);
    drawHeroState(game,camera,reducedMotion);
    drawTrialLinks(game,camera,reducedMotion);
    for (const enemy of game.enemies || []) if (!enemy.dead && enemy.spawnDelay <= 0) drawEnemyWarning(enemy, camera);
    for (const supply of game.supplies || []) drawSupply(supply, camera);
    for (const gem of game.gems) { const x = gem.x - camera.x, y = gem.y - camera.y; ctx.fillStyle = "#65f2c4"; ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 7, y); ctx.fill(); }
    drawMotionTrails(game,camera,reducedMotion);
    for (const shot of game.projectiles) drawProjectile(shot, camera, reducedMotion);
    for (const shot of game.enemyProjectiles || []) drawEnemyProjectile(shot, camera, reducedMotion);
    drawOrbitals(game, camera, false, reducedMotion);
    const allies = (game.companions || []).map(ally => ({ ...ally, _ally: true }));
    const sorted = [...game.enemies, ...allies, { ...game.player, kind: game.player.kind || "hero", _hero: true }].sort((a, b) => a.y - b.y);
    for (const e of sorted) {
      if (!e._hero && e.spawnDelay > 0) { if(!e.elite && !e.boss)continue; const pulse = 1 + Math.sin(e.spawnDelay * 30) * 0.15; ctx.strokeStyle = "rgba(255,190,92,.8)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x - camera.x, e.y - camera.y, (e.radius + 10) * pulse, 0, Math.PI * 2); ctx.stroke(); continue; }
      const x = e.x - camera.x, y = e.y - camera.y;
      if (!e._ally && !e._hero && (e.elite || e.boss)) { ctx.strokeStyle = e.boss ? "#ff775f" : "rgba(255,111,91,.68)"; ctx.lineWidth = e.boss ? 4 : 2; ctx.beginPath(); ctx.ellipse(x, y + 3, e.radius + (e.boss ? 15 : 7), Math.max(8, e.radius * 0.42), 0, 0, TAU); ctx.stroke(); }
      if (e.boss && !unitAssets[e.kind]?.authoredSize) { ctx.save(); ctx.globalAlpha = 0.2 + Math.sin(game.time * 4) * 0.06; ctx.fillStyle = "#ff4f75"; ctx.beginPath(); ctx.arc(x, y - 12, e.radius + 28, 0, TAU); ctx.fill(); ctx.restore(); }
      unit(e._hero&&game.player.mythicAirborne?.height?{...e,y:e.y-game.player.mythicAirborne.height}:e.specialLift?{...e,y:e.y-e.specialLift}:e, e.kind, camera, e.trialConstruct ? .52 : e._ally ? (e.incapacitated ? .78 : .86) : 1);
      if (e.kilnProtected && !e.dead) {
        ctx.save();ctx.translate(x+e.radius*.7,y-e.radius-24);ctx.fillStyle='#263b38';ctx.strokeStyle='#e4d293';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(5,-5);ctx.lineTo(5,1);ctx.lineTo(0,6);ctx.lineTo(-5,1);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
      }
      if (!e._ally && !e._hero && e.elite && !e.boss) { ctx.strokeStyle = "#ffcf62"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 5, e.radius + 9, 0, TAU); ctx.stroke(); }
      if (e._ally) {
        const ratio = Math.max(0, e.hp / e.maxHp);
        if(ratio<.99||e.incapacitated){const w=30;ctx.fillStyle='rgba(4,14,13,.78)';ctx.fillRect(x-w/2,y-e.radius-36,w,3);ctx.fillStyle=e.incapacitated?'#6d8e86':'#a3eac8';ctx.fillRect(x-w/2,y-e.radius-36,w*ratio,3);}
        if(e.summon&&!e.incapacitated)drawVfx('summon',vfxDuration(vfxAssets.summon)*.27,x,y-e.radius-31,e.elite?15:11,{once:true,alpha:.75,tint:e.elite?'#ffe9b7':'#b8f7d5'});
        if (e.incapacitated) { ctx.fillStyle = "#c3ddd4"; ctx.font = "12px system-ui"; ctx.textAlign = "center"; ctx.fillText(`${Math.ceil(e.reviveTimer)}秒后重整`, x, y - e.radius - 48); }
      }
    }
    drawOrbitals(game, camera, true, reducedMotion);
    drawAbilityCollections(game,camera,reducedMotion,'above');
    specialHeroes.render(game,camera,reducedMotion,'above');
    mythicHeroes.render(game,camera,reducedMotion,'above');originalHeroes.render(game,camera,reducedMotion,'above');
    drawHeroPassives(game,camera,reducedMotion);
    for(const anchor of game.heroState?.blinkAnchors||[])if(anchor.remaining>0){
      drawBladeLocator(anchor,camera,reducedMotion);
      for(let i=0;i<Math.min(2,anchor.charge||0);i++)drawVfx('whiteSpark',vfxDuration(vfxAssets.whiteSpark)*.38,anchor.x-camera.x-8+i*16,anchor.y-camera.y-24,15,{once:true,alpha:.95});
    }
    const bladeMark=game.jobMechanics?.bladeMark;
    if(bladeMark){const x=bladeMark.x-camera.x,y=bladeMark.y-camera.y;drawVfx('cleave',vfxDuration(vfxAssets.cleave)*.32,x,y,38,{once:true,angle:-Math.PI/2,alpha:.55});drawVfx('whiteSpark',vfxDuration(vfxAssets.whiteSpark)*.38,x,y-14,20,{once:true,alpha:.65});}
    drawFeedback(game,camera,reducedMotion);
    drawSkillAim(game,camera);
    for (const effect of game.effects) if (!["telegraph","swordField","frostField","frostAura","rockWall","poisonField","blinkImpact"].includes(effect.type)) drawCombatEffect(effect, camera, reducedMotion);
    // Warning outlines and their clocks get the final world layer over friendly bloom.
    for(const hazard of game.enemyHazards||[])if(hazard.telegraph||hazard.type==='warning')drawEnemyHazard(hazard,camera,reducedMotion);
    for(const enemy of game.enemies||[])drawTrialCue(enemy,camera,reducedMotion);
    for(const effect of game.effects)if(effect.type==='telegraph')drawTelegraph(effect,camera,reducedMotion);
    if (game.boss && !game.boss.dead) {
      const short=height<=500,w=Math.min(short?360:420,width*.55),x=(width-w)/2,ratio=Math.max(0,game.boss.hp/game.boss.maxHp);
      if(short){
        ctx.fillStyle='rgba(5,9,12,.82)';ctx.fillRect(x-4,50,w+8,20);
        ctx.fillStyle='#4b1725';ctx.fillRect(x,65,w,3);ctx.fillStyle='#e85265';ctx.fillRect(x,65,w*ratio,3);
        ctx.fillStyle='#ffe3d0';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(game.boss.name||'首领',width/2,61,w-8);
      }else{
        const y=82;ctx.fillStyle='rgba(5,9,12,.82)';ctx.fillRect(x-4,y-4,w+8,34);
        ctx.fillStyle='#4b1725';ctx.fillRect(x,y+15,w,10);ctx.fillStyle='#e85265';ctx.fillRect(x,y+15,w*ratio,10);
        ctx.fillStyle='#ffe3d0';ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillText(game.boss.name||'首领',width/2,y+11);
      }
    }
    drawAnnouncement(game, width, height);
    if (!game.previewMode) drawMinimap(game,width,height,camera);
    if (!reducedMotion) {
      // Display a readable sample of hit numbers; damage accounting remains unchanged.
      const placed=[],heroX=game.player.x-camera.x,heroY=game.player.y-camera.y;
      ctx.font="bold 13px system-ui";ctx.textAlign="center";
      for(const n of [...game.damageNumbers].reverse()){
        const x=n.x-camera.x,y=n.y-camera.y,w=ctx.measureText(String(n.value)).width+10;
        if(placed.length>=12||Math.abs(x-heroX)<30&&y>heroY-70&&y<heroY+12||placed.some(p=>Math.abs(x-p.x)<(w+p.w)/2&&Math.abs(y-p.y)<20))continue;
        placed.push({x,y,w});ctx.globalAlpha=Math.min(.9,n.life*3);ctx.fillStyle=n.color;ctx.fillText(n.value,x,y);
      }
    } ctx.globalAlpha=1;
  }
  return { render, destroy() { dead = true; motionTrails.destroy(); specialHeroes.destroy(); mythicHeroes.destroy(); originalHeroes.destroy(); outlinedFrames.clear(); restoredVfxFrames.clear(); glowTiles.clear(); whiteFrames.clear(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); } };
}






