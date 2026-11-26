(() => {
  const get=id=>document.getElementById(id),ctx=get('stage').getContext('2d'),lib=globalThis.DuelystLibrary,engine=globalThis.CompositeEngine;
  const url=new URL(location.href),params=url.searchParams,labels={UnitAttackedFX:'普攻',UnitPrimaryAttackedFX:'显式普攻附加',SpellCastFX:'施法',SpellAppliedFX:'生效格'};
  const key=row=>[row.type,row.id,row.card,row.event].join('/'),allowed=new Map(globalThis.CompositeCoverage.map(row=>[key(row),row.status]));
  const records=globalThis.CompositeRecipes.events.filter(row=>row.type===params.get('type')&&row.id===params.get('id')&&allowed.has(key(row)));
  const images=new Map(),tints=new Map(),enabled=new Set();
  let current,scene,owner,time=0,run=true,last=null,generation=0,ready=false;
  const option=(text,value)=>Object.assign(document.createElement('option'),{textContent:text,value});
  const ownerSelect=document.createElement('select'),ownerLabel=document.createElement('label');ownerLabel.className='owner-picker';ownerLabel.textContent=' 演示施法者 ';ownerLabel.append(ownerSelect);get('context').before(ownerLabel);
  async function imageFor(clip){
    if(!clip||images.has(clip.path))return;
    const image=new Image();image.src=new URL('合成/'+clip.path,location.href);await image.decode();images.set(clip.path,image);
  }
  function art(clip,age,x,y,options={}){
    if(!clip||age<0)return;const frame=clip.count===1?0:Math.floor(age/clip.ms);
    if(!options.loop&&frame>=clip.count)return;
    let index=frame%clip.count;if(options.reverse)index=clip.count-index-1;
    const sx=(index%clip.cols)*clip.width,sy=Math.floor(index/clip.cols)*clip.height;let image=images.get(clip.path);
    if(!image)return;let sourceX=sx,sourceY=sy;
    if(options.color){
      const c=options.color,k=clip.path+':'+index+':'+[c.r,c.g,c.b].join(',');
      if(!tints.has(k)){
        const layer=document.createElement('canvas');layer.width=clip.width;layer.height=clip.height;const tint=layer.getContext('2d');
        tint.drawImage(image,sx,sy,clip.width,clip.height,0,0,clip.width,clip.height);
        tint.globalCompositeOperation='multiply';tint.fillStyle='rgb('+[c.r,c.g,c.b].join(',')+')';tint.fillRect(0,0,clip.width,clip.height);
        tint.globalCompositeOperation='destination-in';tint.drawImage(image,sx,sy,clip.width,clip.height,0,0,clip.width,clip.height);if(tints.size>180)tints.clear();tints.set(k,layer);
      }image=tints.get(k);sourceX=sourceY=0;
    }
    ctx.save();ctx.translate(x,y);ctx.rotate((options.angle||0)*Math.PI/180);ctx.scale((options.flip?-1:1)*(options.scale??2)*(options.stretch??1),(options.flipY?-1:1)*(options.scale??2));
    ctx.globalAlpha=Math.max(0,Math.min(1,options.alpha??1));if(options.add)ctx.globalCompositeOperation='lighter';
    ctx.drawImage(image,sourceX,sourceY,clip.width,clip.height,-clip.anchorX+(options.shiftX||0),-clip.anchorY,clip.width,clip.height);ctx.restore();
  }
  function particles(draw,age){
    const p=engine.presets[draw.key],dt=p.particleLifespan*1000/p.maxParticles;
    for(let index=Math.max(0,Math.floor((age-1000*(p.particleLifespan+p.particleLifespanVariance))/dt));index*dt<Math.min(age,draw.emission);index++){
      let seed=(index+1)*1777;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1};
      const born=index*dt,elapsed=(age-born)/1000,lifetime=Math.max(.001,p.particleLifespan+rnd()*p.particleLifespanVariance),ratio=elapsed/lifetime;if(ratio>=1)continue;
      const start=draw.place(born),angle=(p.angle+rnd()*p.angleVariance)*Math.PI/180,speed=p.speed+rnd()*p.speedVariance;
      const travel=draw.conf.friction? (1-Math.pow(draw.conf.friction,elapsed*60))/(1-draw.conf.friction)/60:elapsed;
      const x=start.x+rnd()*p.sourcePositionVariancex+Math.cos(angle)*speed*travel+.5*p.gravityx*elapsed*elapsed;
      const y=start.y+rnd()*p.sourcePositionVariancey-Math.sin(angle)*speed*travel-.5*p.gravityy*elapsed*elapsed;
      const size=Math.max(0,(p.startParticleSize+rnd()*p.startParticleSizeVariance)*(1-ratio)+(p.finishParticleSize+rnd()*p.finishParticleSizeVariance)*ratio);
      const c=draw.conf.color||{r:255*p.startColorRed,g:255*p.startColorGreen,b:255*p.startColorBlue};
      art(draw.clip,0,x,y,{scale:size/draw.clip.sourceWidth,alpha:p.startColorAlpha+(p.finishColorAlpha-p.startColorAlpha)*ratio,color:c,add:p.blendFuncDestination===1,angle:p.rotationStart+(p.rotationEnd-p.rotationStart)*ratio});
    }
  }
  function fx(draw){
    if(draw.type==='Light')return;
    const age=time-draw.start;if(age<0||age>=draw.ms||!enabled.has(draw.route))return;
    if(draw.particle){particles(draw,age);return}
    const p=draw.place(age),c=draw.conf,cl=draw.clip,period=engine.life(cl)||draw.ms;
    let alpha=(c.opacity??255)/255;
    if(draw.type==='Projectile'&&age>draw.travel)alpha*=1-(age-draw.travel)/350;
    if(draw.type==='Decal')alpha*=Math.min(1,(draw.ms-age)/14000);
    if(c.fadeInDurationPct)alpha*=Math.min(1,age/(period*c.fadeInDurationPct));
    if(c.fadeOutDurationPct)alpha*=Math.min(1,Math.max(0,period-age)/(period*c.fadeOutDurationPct));
    const opts={alpha,angle:draw.angle,color:c.color,flip:!['Chain','Projectile','EnergyBeam'].includes(draw.type)&&!!c.flippedX,flipY:c.flippedY,loop:draw.looping,reverse:c.reverse,scale:c.scale??2,add:c.blendDst==='ONE'};
    if(draw.segments){for(const point of draw.segments)art(cl,age,point.x,point.y,{...opts,shiftX:-cl.sourceWidth/2,stretch:draw.segments.stretch});}
    else art(cl,age,p.x,p.y,{...opts,shiftX:draw.type==='EnergyBeam'?cl.sourceWidth/2:0});
  }
  function mark(p,text,color){ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1;ctx.strokeRect(p.x-4,p.y-4,8,8);ctx.textAlign='center';ctx.font='15px system-ui';ctx.fillText(text,p.x,p.y+37)}
  const boardPalette=['#19242d','#23343d','#263943','#304339'];
  // The preview palette describes the board at rest. Recover diffuse colors
  // under the original default ambient (89/255) before applying its light map.
  const boardDiffuse=boardPalette.map(hex=>'rgb('+hex.slice(1).match(/../g).map(c=>Math.round(parseInt(c,16)*255/89)).join(',')+')');
  function render(){
    if(!ready)return;
    const lights=scene.draws.filter(layer=>layer.type==='Light');
    const palette=lights.length?boardDiffuse:boardPalette;
    ctx.imageSmoothingEnabled=false;ctx.fillStyle=palette[0];ctx.fillRect(0,0,855,435);
    for(let col=0;col<9;col++)for(let row=0;row<5;row++){const p=engine.grid(col,row);ctx.fillStyle=palette[current.type==='icon'&&current.placement.kind==='board-center'&&col===4&&row===2?3:(col+row)%2?1:2];ctx.fillRect(p.x-47,p.y-47,94,94)}
    if(lights.length)globalThis.CompositeLight.render(ctx,lights.filter(layer=>enabled.has(layer.route)),time);
    const actorOwner=current.type==='unit'?current.id:owner?.id,actor=actorOwner&&engine.unit(actorOwner),attack=scene.attack;
    function body(clip,age,point,flip,loop){if(clip)art(clip,age,point.x,point.y-((actorOwner&&point===scene.source?(actor.breathing||clip):clip).sourceHeight-39),{loop,flip})}
    for(const layer of scene.draws.filter(d=>(d.conf.zOrder??0)<0))fx(layer);
    if(current.ability)body(actor.breathing,time,scene.source,false,true);
    if(actor&&attack){
      if(time<engine.life(attack))body(attack,time,scene.source,false,false);else body(actor.breathing,time-engine.life(attack),scene.source,false,true);
    }
    if(current.type==='unit'){
      const receiver=engine.unit('f1_general'),age=time-scene.impact;
      if(age>=0&&age<engine.life(receiver.damage))body(receiver.damage,age,scene.target,true,false);else body(receiver.breathing,time,scene.target,true,true);
    }
    for(const layer of scene.draws.filter(d=>(d.conf.zOrder??0)>=0))fx(layer);
    if(get('markers').checked){
      if(actor)mark(scene.source,current.ability?'战吼来源':scene.isUnit?'攻击者':'施法者','#b2dfcc');
      mark(scene.target,current.type==='unit'?'受击参照':current.placement.kind==='board-center'?'棋盘中央':'事件落点','#ffd499');
    }
    get('scrub').value=Math.round(time);get('time').textContent=(time/1000).toFixed(3)+' s / '+(scene.end/1000).toFixed(2)+' s';get('pause').textContent=run?'暂停':'播放';
  }
  function seek(value,play=false){time=value;run=play;last=null;render()}
  function tick(now){if(ready&&run){if(last!==null)time=Math.min(scene.end,time+(now-last)*Number(get('speed').value));if(time>=scene.end)run=false;render()}last=now;requestAnimationFrame(tick)}
  function owners(){return globalThis.CompositeCasters?.[current.card]||[]}
  async function activate(reset){
    const version=++generation;current=records[Number(get('variant').value)];ready=false;ctx.clearRect(0,0,855,435);const candidates=current.type==='icon'?owners():[];
    if(reset){
      ownerSelect.replaceChildren(option('只看技能图层',''),...candidates.map((o,i)=>option(lib.get('unit',o.id)?.name+' · '+o.card,String(i))));
      const ownerCard=params.get('ownerCard');
      const requested=candidates.findIndex(o=>o.id===params.get('owner')&&(!ownerCard||o.card===ownerCard));
      ownerSelect.value=requested>=0?String(requested):!ownerCard&&candidates.length===1?'0':'';
    }
    ownerLabel.hidden=!candidates.length;owner=ownerSelect.value===''?null:candidates[Number(ownerSelect.value)];
    scene=engine.plan(current,owner);const item=lib.get(current.type,current.id);
    get('title').textContent=item.name;get('badge').textContent=allowed.get(key(current))==='partial'?'部分合成':'事件合成';
    const placement=globalThis.CompositeRecipes.engine.positions[current.placement.kind];get('context').textContent=current.type==='unit'?'单次普攻 · 攻击者朝右，Argeon 仅作受击参照。':placement+' 此页展示所选事件层；格位按示例提供，不推定具体受害名单。'+(current.placement.scenario||'');
    if(current.ability)get('context').textContent=current.placement.scenario;
    const image=get('icon');image.hidden=current.type!=='icon';if(!image.hidden)image.src=lib.assetURL('icon',item.preview);
    const related=get('skills');related.replaceChildren();
    if(scene.isUnit)for(const row of globalThis.CompositeCoverage.filter(row=>row.type==='icon'&&(globalThis.CompositeCasters[row.card]||[]).some(o=>o.id===current.id&&o.card===current.card))){const link=document.createElement('a');link.href='合成预览.html?'+new URLSearchParams({type:row.type,id:row.id,card:row.card,event:row.event,owner:current.id});link.textContent='招牌技能：'+lib.get('icon',row.id).name+' · '+labels[row.event];related.append(link)}
    get('special').hidden=current.id!=='boss_skyfalltyrant'&&current.card!=='Cards.BossSpell.LaceratingFrost';
    enabled.clear();get('layers').replaceChildren();for(const layer of scene.draws){enabled.add(layer.route);const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=true;check.onchange=()=>{check.checked?enabled.add(layer.route):enabled.delete(layer.route);render()};label.append(check,layer.type==='Light'?' 动态光照 · Light':' '+layer.key);if(layer.type==='Light'){const color=layer.conf.color||{r:255,g:255,b:255};label.title='RGB '+[color.r,color.g,color.b].join(', ')+' · 半径 '+(layer.conf.radius??285)+' · '+layer.route}get('layers').append(label)}
    get('missing').textContent=scene.notes.join('；');
    const lightSources=[];
    function collectLights(nodes){
      for(const node of nodes){
        if(node.nodeType==='Light')lightSources.push(node.source);
        collectLights(node.emitFX);collectLights(node.impactFX);
      }
    }
    collectLights(current.layers);
    if(lightSources.length){
      lightSources.push('app/view/nodes/fx/Light.js','app/view/fx/BatchLights.js','app/shaders/LightingFragment.glsl');
      if(scene.draws.some(d=>d.type==='Light'&&d.timingMode!=='natural'))lightSources.push('app/view/layers/game/GameLayer.js:4082','app/view/layers/game/GameLayer.js:4794');
    }
    get('sources').textContent=[current.fxKey+' / '+current.event,...new Set([...current.sources,...current.placement.sources,...(owner?.sources||[]),...lightSources])].join(' · ');
    const u=new URL(location.href);for(const field of ['type','id','card','event'])u.searchParams.set(field,current[field]);try{history.replaceState(null,'',u)}catch{}
    get('status').textContent='读取原帧…';
    try{
      await Promise.all([scene.attack,...scene.draws.map(d=>d.clip),engine.unit(owner?.id||current.id).breathing,...(current.type==='unit'?Object.values(engine.unit('f1_general')):[])].filter(Boolean).map(imageFor));
      if(version!==generation)return;get('status').textContent='平面 H5 · '+(scene.isUnit?'出手后 '+Math.round(scene.delay)+' ms 起播事件。':owner?'按所选将军的施法动作演示；略去出牌界面等待。':'时间 0 对齐所选技能事件，不代配单位动作。');ready=true;get('scrub').max=scene.end;seek(0,true);
    }catch{if(version===generation)get('status').textContent='原帧未能读取，请保留资料库完整目录。'}
  }
  if(!records.length){get('status').textContent='此项暂无已核实的合成预览。请从资料库的可播放条目进入。';return}
  get('variant').replaceChildren(...records.map((row,i)=>option(row.card+' · '+labels[row.event],i)));
  get('variant').value=String(Math.max(0,records.findIndex(row=>row.card===params.get('card')&&row.event===params.get('event'))));
  get('variant').onchange=()=>activate(true);ownerSelect.onchange=()=>activate(false);get('pause').onclick=()=>ready&&seek(time>=scene.end?0:time,!run);get('restart').onclick=()=>ready&&seek(0,true);get('inspect').onclick=()=>ready&&seek(Math.min(scene.end,scene.impact+90));get('scrub').oninput=e=>ready&&seek(Number(e.target.value));get('markers').onchange=render;
  activate(true);requestAnimationFrame(tick);
  if(params.get('embed')==='unit'&&window.parent!==window){
    new ResizeObserver(()=>window.parent.postMessage({duelystUnitPlayerHeight:Math.ceil(document.body.getBoundingClientRect().height)},'*')).observe(document.body);
  }
})();
