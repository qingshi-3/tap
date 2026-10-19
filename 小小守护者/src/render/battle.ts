import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { CARD_DEFS, LEGION_DEFS, BUILDING_DEFS, HERO_DEFS } from '../core/content';
import type { GameState, Point, Unit, LegionKind, BuildingKind, HeroKind } from '../core/types';
import type { AssetManifest, SpriteFrame } from '../assets-types';
import { UnitAnimations } from './unit-animation';

const assetURL=(path:string)=>path.startsWith('/')||path.startsWith('data:')?path:path.startsWith('assets/')?'./'+path:'./assets/'+path;
// First idle alpha bounds measured in the untouched canvas. Fixed across all frames,
// so weapon trails retain their transparent space and feet never jump when attacking.
const BODY:Record<string,[number,number]>={'shield-1':[.425,.8],'shield-2':[.463,.8],'shield-3':[.575,.8],'archer-1':[.333,.867],'archer-2':[.537,.8],'archer-3':[.61,.84],engineer:[.48,.84],grunt:[.618,.855],siege:[.525,.8],flyer:[.48,.85],boss:[.4,.875],hero:[.44,.84]};
export class BattleRenderer {
 readonly app=new Application();
 private world=new Container(); private terrain=new Container(); private actors=new Container(); private marks=new Graphics();
 private glows=new Container(); private ghosts=new Container(); private glowTextures=new Map<string,Texture>();
 private textures=new Map<string,Texture>(); private frames=new Map<string,Texture>(); private visuals=new Map<string,Sprite|Graphics>();
 private labels:Text[]=[]; private terrainId=''; private boardWidth=30; private boardHeight=20;
 private zoom=1; private offset={x:0,y:0}; private base=24; private overview=false; private selected:number|null=null;private insets={left:20,right:20,top:44,bottom:16};
 private preview:Point|null=null; private previewValid=true; private previewRadius=1; private lastState:GameState|null=null; reduced=false;
 private previewKind:string|undefined; private previewTier=1;
 private unitAnimations=new UnitAnimations();
 constructor(private root:HTMLElement,readonly manifest:AssetManifest){}
 async init(progress:(done:number,total:number)=>void){
  await this.app.init({resizeTo:this.root,background:0x233c2a,antialias:false,resolution:Math.min(devicePixelRatio||1,2),autoDensity:true});
  // Native canvas pointer handlers own gestures. Pixi must not register a second
  // document/window input pipeline or retain interaction state after a drag.
  this.app.stage.eventMode='none';
  this.app.renderer.events.autoPreventDefault=false;
  this.app.renderer.events.destroy();
  this.root.append(this.app.canvas);this.app.stage.addChild(this.world);this.world.addChild(this.terrain,this.glows,this.marks,this.actors,this.ghosts);
  const files=new Set<string>(); Object.values(this.manifest.world).forEach(a=>files.add(a.file));
  Object.values(this.manifest.units).forEach(a=>Object.values(a.animations).forEach(frames=>frames.forEach(f=>files.add(f.file))));
  let done=0; const list=[...files]; let next=0;
  await Promise.all(Array.from({length:Math.min(4,list.length)},async()=>{while(next<list.length){const file=list[next++];try{this.textures.set(file,await Assets.load<Texture>(assetURL(file)));}catch{throw new Error('素材未能准备完成，请重试。')}progress(++done,list.length)}}));
  this.app.ticker.stop();this.resize();
 }
 resize(){this.app.resize();this.measure();if(this.lastState)this.draw(this.lastState)}
 setInsets(insets:{left:number;right:number;top:number;bottom:number}){this.insets=insets;this.measure()}
 private measure(){const w=this.root.clientWidth-this.insets.left-this.insets.right,h=this.root.clientHeight-this.insets.top-this.insets.bottom;this.base=this.overview?Math.max(1,Math.floor(Math.min(w/this.boardWidth,h/this.boardHeight))):Math.ceil(Math.max(24,w/this.boardWidth,h/this.boardHeight));this.layout()}
 /** Overview is explicit; default camera retains legible cells and follows no autonomous actor. */
 fit(reset=true){this.overview=true;if(reset){this.zoom=1;this.offset={x:0,y:0}}this.measure()}
 focusCamp(s:GameState){this.overview=false;this.zoom=1;this.measure();const target={x:s.map.core.x-5,y:s.map.core.y};this.offset={x:(this.boardWidth/2-target.x)*this.base,y:(this.boardHeight/2-target.y)*this.base};this.layout()}
 private layout(){const w=this.root.clientWidth-this.insets.left-this.insets.right,h=this.root.clientHeight-this.insets.top-this.insets.bottom,s=Math.round(this.base*this.zoom);if(!this.overview){const maxX=Math.max(0,(this.boardWidth*s-w)/2),maxY=Math.max(0,(this.boardHeight*s-h)/2);this.offset.x=Math.max(-maxX,Math.min(maxX,this.offset.x));this.offset.y=Math.max(-maxY,Math.min(maxY,this.offset.y))}this.world.scale.set(s);this.world.position.set(Math.round(this.insets.left+(w-this.boardWidth*s)/2+this.offset.x),Math.round(this.insets.top+(h-this.boardHeight*s)/2+this.offset.y))}
 pan(dx:number,dy:number){this.offset.x=Math.max(-this.boardWidth*this.base*this.zoom/2,Math.min(this.boardWidth*this.base*this.zoom/2,this.offset.x+dx));this.offset.y=Math.max(-this.boardHeight*this.base*this.zoom/2,Math.min(this.boardHeight*this.base*this.zoom/2,this.offset.y+dy));this.layout()}
 toggleZoom(at:Point){const before=this.toScreen(at);this.zoom=this.zoom===1?1.8:1;this.layout();const after=this.toScreen(at);this.offset.x+=before.x-after.x;this.offset.y+=before.y-after.y;this.layout()}
 toWorld(x:number,y:number):Point {const r=this.app.canvas.getBoundingClientRect();return {x:(x-r.left-this.world.x)/this.world.scale.x,y:(y-r.top-this.world.y)/this.world.scale.y}}
 toScreen(p:Point):Point{return{x:this.world.x+p.x*this.world.scale.x,y:this.world.y+p.y*this.world.scale.y}}
 select(id:number|null){this.selected=id}
 /** Building previews use actual cell centres; other previews use integer anchors. */
 place(p:Point|null,valid=true,radius=1,kind?:string,tier=1){this.preview=p;this.previewValid=valid;this.previewRadius=radius;this.previewKind=kind;this.previewTier=tier;if(!p){this.glows.removeChildren().forEach(c=>c.destroy());this.ghosts.removeChildren().forEach(c=>c.destroy())}}
 private glowTexture(color:string,foot=false):Texture {
  const key=color+':'+foot;let texture=this.glowTextures.get(key);if(texture)return texture;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const context=canvas.getContext('2d')!;
  const gradient=context.createRadialGradient(128,128,0,128,128,128);
  // The brightest part at .9 marks the rule radius, with a wide soft edge and
  // translucent interior. This texture is a gameplay light, not a UI outline.
  for(const [stop,alpha] of (foot?[[0,.8],[.25,.6],[.65,.23],[1,0]]:[[0,.11],[.65,.14],[.79,.25],[.9,.54],[.97,.21],[1,0]]) as [number,number][])gradient.addColorStop(stop,`rgba(${color},${alpha})`);
  context.fillStyle=gradient;context.fillRect(0,0,256,256);texture=Texture.from(canvas);texture.source.scaleMode='linear';this.glowTextures.set(key,texture);return texture;
 }
 private glow(p:Point,radius:number,valid=true,alpha=1,foot=false,color?:string){if(!Number.isFinite(radius)||radius<=0)return;const sprite=new Sprite(this.glowTexture(color??(valid?'78,169,255':'255,72,71'),foot));sprite.anchor.set(.5);sprite.position.set(p.x,p.y);sprite.width=radius*2/(foot?1:.9);sprite.height=foot?sprite.width*.5:sprite.width;sprite.alpha=alpha;this.glows.addChild(sprite)}
 private ghostUnit(kind:string,tier:number,p:Point){const key=Object.hasOwn(LEGION_DEFS,kind)?kind+'-'+tier:kind;const asset=this.manifest.units[key]||this.manifest.units[kind];if(!asset)return;const texture=this.frame(asset.animations.idle[0]);if(!texture)return;const sprite=new Sprite(texture);const [fraction,feet]=BODY[key]||[.5,.84];sprite.anchor.set(.5,feet);sprite.width=1.12/fraction;sprite.height=sprite.width*texture.height/texture.width;sprite.position.set(p.x+.5,p.y+.5);sprite.scale.x=-Math.abs(sprite.scale.x);sprite.alpha=this.previewValid?.48:.28;sprite.tint=this.previewValid?0xc6e7ff:0xff7777;this.ghosts.addChild(sprite)}
 private drawPreview(){const p=this.preview;if(!p)return;const kind=this.previewKind;const isBuilding=!!kind&&Object.hasOwn(BUILDING_DEFS,kind);const centre=isBuilding?p:{x:p.x+.5,y:p.y+.5};let radius=this.previewRadius;
  if(isBuilding){const def=BUILDING_DEFS[kind as BuildingKind];radius=def.range||.65;const asset=this.manifest.world[kind!];const texture=asset?this.texture(asset.file,asset.rect):null;if(texture){const sprite=new Sprite(texture);sprite.anchor.set(.5,asset?.file.includes('world-generated')&&kind!=='slow'?.9:.5);sprite.position.set(p.x,p.y);sprite.width=kind==='slow'?1:.98;sprite.height=sprite.width*texture.height/texture.width;sprite.alpha=this.previewValid?.5:.28;sprite.tint=this.previewValid?0xc6e7ff:0xff7777;this.ghosts.addChild(sprite)}}
  else if(kind&&Object.hasOwn(LEGION_DEFS,kind)){const def=LEGION_DEFS[kind as LegionKind]!,stats=def.tiers[this.previewTier-1];if(stats)for(let i=0;i<stats.count;i++){const offset=def.formation?.[i]??{x:(i%2-.5)*.55,y:(Math.floor(i/2)-.5)*.55};this.ghostUnit(kind,this.previewTier,{x:p.x+offset.x,y:p.y+offset.y})}radius=this.previewRadius>1?this.previewRadius:6}
  else if(kind&&Object.hasOwn(HERO_DEFS,kind)){radius=HERO_DEFS[kind as HeroKind]!.aura.radius;this.ghostUnit(kind,1,p)}
  this.glow(centre,radius,this.previewValid,this.previewValid?.85:1);this.glow(centre,.55,this.previewValid,.9,true);
 }
 private texture(file:string,rect?:[number,number,number,number]):Texture|null {
  const source=this.textures.get(file);if(!source)return null;source.source.scaleMode='nearest';if(!rect)return source;
  const key=file+':'+rect.join(',');let t=this.frames.get(key);if(!t){t=new Texture({source:source.source,frame:new Rectangle(...rect)});this.frames.set(key,t)}return t;
 }
 private frame(a:SpriteFrame){return this.texture(a.file,a.rect)}
 private ground(){this.terrain.removeChildren().forEach(c=>c.destroy());this.labels.forEach(t=>t.destroy());this.labels=[];const s=this.lastState!;const m=s.map;
  const meadow=this.manifest.world.grassBackdrop;
  if(meadow){const span=Math.max(m.width,m.height),tile=this.texture(meadow.file,[0,0,Math.round(meadow.rect[2]*m.width/span),Math.round(meadow.rect[3]*m.height/span)]);if(tile){const grass=new Sprite(tile);grass.width=m.width;grass.height=m.height;this.terrain.addChild(grass)}}
  for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){
   if(meadow&&m.cells[y*m.width+x]===0)continue;
   const cell=m.cells[y*m.width+x];const key=cell===1?((x+y)%3?'rock':'tree'):cell===2?'water':(x*7+y*11)%17===0?'grassFlowers':(x*13+y*3)%7===0?'grassDetail':'grass';const a=this.manifest.world[key]||this.manifest.world[cell===1?'cliff':'grass'];const t=a?this.texture(a.file,a.rect):null;
   if(t){t.source.scaleMode='nearest';const sp=new Sprite(t);if(meadow&&cell===1){sp.anchor.set(.5,.9);sp.position.set(x+.5,y+.85);sp.width=.98;sp.height=sp.width*t.height/t.width}else{sp.position.set(x,y);sp.width=sp.height=1}this.terrain.addChild(sp)}else{const g=new Graphics().rect(x,y,1,1).fill(cell===1?0x667654:cell===2?0x376f79:(x+y)%2?0x587f42:0x5c8445);this.terrain.addChild(g)}
  }
  m.gates.forEach((gate,i)=>{const label=new Text({text:String.fromCharCode(65+i)+' '+gate.label,style:{fontFamily:'system-ui',fontSize:12,fill:0xffefc0,fontWeight:'bold'}});label.scale.set(1/this.base);label.position.set(gate.x+.1,gate.y-.2);this.terrain.addChild(label);this.labels.push(label)});
 }
 private entity(key:string,tex:Texture|null,p:Point,size:number,tint:number,anchorY=.88){
  let visual=this.visuals.get(key);if(tex&&!(visual instanceof Sprite)){visual?.destroy();visual=new Sprite(tex);this.visuals.set(key,visual);this.actors.addChild(visual)}
  if(!tex&&!visual){visual=new Graphics().circle(0,0,.32).fill(tint);this.visuals.set(key,visual);this.actors.addChild(visual)}
  if(!visual)return;if(visual instanceof Sprite){if(tex)visual.texture=tex;visual.anchor.set(.5,anchorY);visual.width=size;visual.height=size*(tex?.height||1)/(tex?.width||1)}visual.position.set(p.x+.5,p.y+.5);visual.zIndex=p.y;return visual;
 }
 private unitTexture(unit:Unit){const legion=this.lastState?.legions.find(l=>l.id===unit.legionId);const key=legion?unit.kind+'-'+legion.tier:unit.kind;const asset=this.manifest.units[key]||this.manifest.units[unit.kind];if(!asset)return null;const frame=this.unitAnimations.frame(unit,asset,this.reduced);return frame?this.frame(frame):null}
 draw(s:GameState){this.unitAnimations.begin(s);this.lastState=s;this.boardWidth=s.map.width;this.boardHeight=s.map.height;const id=s.map.id+':'+s.seed;if(this.terrainId!==id){this.terrainId=id;this.focusCamp(s);this.ground()}
  this.marks.clear();this.glows.removeChildren().forEach(c=>c.destroy());this.ghosts.removeChildren().forEach(c=>c.destroy());this.actors.sortableChildren=true;const alive=new Set<string>();
  const coreAsset=this.manifest.world.core||this.manifest.world.keep;this.entity('core',coreAsset?this.texture(coreAsset.file,coreAsset.rect):null,s.map.core,2.1,0xffcf73);alive.add('core');
  // Buildings store cell centres already; entity adds the unit half-cell shift.
  // Centre-anchored single-cell sprites must not cover neighbouring obstacles.
  for(const b of s.buildings){const a=this.manifest.world[b.kind];this.entity('b'+b.id,a?this.texture(a.file,a.rect):null,{x:b.x-.5,y:b.y-.5},b.kind==='slow'?1:.98,0x94774a,a?.file.includes('world-generated')&&b.kind!=='slow'?.9:.5);alive.add('b'+b.id);if(b.hp<b.maxHp)this.health({x:b.x-.5,y:b.y-.5},b.hp/b.maxHp,0xffb966)}
  for(const u of s.units){if(u.hp<=0)continue;const tex=this.unitTexture(u);const legion=s.legions.find(l=>l.id===u.legionId);const key=legion?u.kind+'-'+legion.tier:u.kind;const [fraction,feet]=BODY[key]||[.5,.84];const bodyScale=u.team==='player'?s.cards.filter(c=>CARD_DEFS[c.kind].scope==='global'||(legion&&c.carrier===legion.id)).reduce((scale,c)=>scale*(CARD_DEFS[c.kind].bodyScale??1),1):1;const body=(u.kind==='boss'?2:1.12)*bodyScale;const visual=this.entity('u'+u.id,tex,u,body/fraction,u.team==='enemy'?0xe38968:0xd3e4af,feet);if(visual instanceof Sprite){const target=s.units.find(t=>t.id===u.targetId);const facing=target?Math.sign(target.x-u.x):u.team==='enemy'?1:-1;visual.scale.x=Math.abs(visual.scale.x)*(facing||1)}alive.add('u'+u.id);if(u.hp<u.maxHp)this.health(u,u.hp/u.maxHp,u.team==='player'?0x98d777:0xff8369)}
  for(const [key,v]of this.visuals)if(!alive.has(key)){v.destroy();this.visuals.delete(key)}
  const legion=s.legions.find(l=>l.id===this.selected),building=s.buildings.find(b=>b.id===this.selected),hero=s.hero?.id===this.selected?s.hero:null,selected=legion||building||hero;
  if(selected&&!this.preview){const centre=building?{x:building.x,y:building.y}:{x:selected.x+.5,y:selected.y+.5};this.glow(centre,.6,true,.9,true);const radius=legion?.alertRadius??(building?BUILDING_DEFS[building.kind].range:hero?HERO_DEFS[hero.kind]?.aura.radius:0);if(radius)this.glow(centre,radius,true,.75);if(legion)for(const u of s.units.filter(u=>u.legionId===legion.id))this.glow({x:u.x+.5,y:u.y+.5},.4,true,.65,true)}
  this.drawPreview();
  if(!this.reduced)for(const e of s.effects){const age=(s.tick-e.born)/Math.max(1,e.ttl);if(e.kind==='shot'&&e.toX!==undefined){this.marks.circle(e.x+(e.toX-e.x)*age+.5,e.y+((e.toY??e.y)-e.y)*age+.5,.1).fill(0xffeb98)}else this.glow({x:e.x+.5,y:e.y+.5},.25+age*.8,true,1-age,true,e.kind==='heal'?'139,230,149':e.kind==='freeze'?'109,188,255':'255,190,105')}
  this.app.renderer.render(this.app.stage);
 }
 private health(p:Point,f:number,c:number){this.marks.rect(p.x+.1,p.y-.32,.8,.09).fill(0x253724).rect(p.x+.1,p.y-.32,.8*Math.max(0,f),.09).fill(c)}
}


