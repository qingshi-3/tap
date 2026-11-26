(() => {
    const frames=globalThis.CompositeFrames, presets=globalThis.CompositeParticles||{};
  const unit=key=>frames.units[key]||{}, life=clip=>clip?clip.count*clip.ms:0;
  const grid=(x,y)=>({x:47.5+95*x,y:40+95*y}), shift=(p,d)=>({x:p.x+(d?.x||0),y:p.y-(d?.y||0)});
  const fixed=point=>()=>point, pointAt=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  function anchor(record){
    const p=record.placement,ref=grid(5,2);
    switch(p.kind){
      case 'applied-positions':case 'selected-cell':return ref;
      case 'board-center':case 'row-center':return grid(4,2);
      case 'pattern-center':{
        const offsets=p.offsets||p.patternOffsets;
        if(offsets?.length)return grid(5+offsets.reduce((sum,v)=>sum+v.x,0)/offsets.length,2+offsets.reduce((sum,v)=>sum+v.y,0)/offsets.length);
        if(p.pattern==='PATTERN_2X2')return grid(5.5,2.5);
        if(p.pattern==='PATTERN_3x3_INCLUDING_CENTER')return ref;
        return null;
      }
      case 'unit':return ref;
      default:return null;
    }
  }
  // GameLayer._removeActionAutoFX calls destroy(0.5). A Light eases that
  // external fade exponentially; its FXSprite parent uses the default linear fade.
  const cleanupFadeMs=500;
  function fadeOutExpo(t){
    if(t<=0)return 1;
    if(t>=1)return 0;
    return t<.5?1-.5*2**(20*t-10):.5*2**(10-20*t);
  }
  function lightDraw(node,start,position,parent,baseMs,autoFX,cleanupAt){
    const recipeConf=node.config;
    const cleanupAge=cleanupAt-start;
    const autoRoot=autoFX&&!parent;
    // GameLayer.addNode takes ownership of the top-level auto light's fade.
    const conf=autoRoot?{...recipeConf,duration:0,fadeOutDuration:0,fadeOutDurationPct:0}:recipeConf;
    const durationMs=(conf.duration||0)*1000||baseMs;
    const inPct=conf.fadeInDurationPct??.35,outPct=conf.fadeOutDurationPct??1.5;
    const fadeInMs=(conf.fadeInDuration||0)*1000+durationMs*inPct;
    const holdMs=Math.max(0,durationMs*(1-inPct-outPct));
    const fadeOutMs=(conf.fadeOutDuration||0)*1000+durationMs*outPct;
    const naturalMs=durationMs>0||fadeOutMs>0?fadeInMs+holdMs+fadeOutMs:Infinity;
    // FXSprite.getLifeDuration keeps the node (including its children) alive
    // after its own animation stops. A projectile instead destroys itself after travel + fade.
    let parentMs=null;
    if(parent){
      parentMs=parent.type==='Projectile'?parent.ms:Math.max(parent.ms,Number.isFinite(naturalMs)?naturalMs:0);
      parentMs=Math.min(parentMs,cleanupAge+cleanupFadeMs);
    }
    const ms=Math.max(0,Math.min(naturalMs,parentMs??Infinity,cleanupAge+cleanupFadeMs));
    // startEmit positions children in untrimmed content space at half size + offset.
    // The centered sprite anchor cancels half size. Cocos flip flags only change UVs.
    // Dividing the child's scale by the parent's does not divide its translation.
    let place=fixed(position);
    if(parent){
      const scale=parent.conf.scale??2,angle=parent.angle*Math.PI/180;
      const endOffset=conf.atSource||conf.sourceToTarget?conf.sourceOffset:conf.targetOffset;
      const dx=((conf.offset?.x||0)+(endOffset?.x||0))*scale;
      const dy=-((conf.offset?.y||0)+(endOffset?.y||0))*scale;
      const x=dx*Math.cos(angle)-dy*Math.sin(angle),y=dx*Math.sin(angle)+dy*Math.cos(angle);
      place=age=>{const p=parent.place(start-parent.start+age);return {x:p.x+x,y:p.y+y};};
    }
    // The renderer reads this node's own RGB/auto-fade from conf and
    // multiplies by parentOpacity (byte units) once. Parent tint does not cascade.
    const inherited=parent?.conf.opacity??255;
    let parentOpacity=inherited;
    if(Number.isFinite(cleanupAge)){
      parentOpacity=age=>{
        const progress=Math.max(0,Math.min(1,(age-cleanupAge)/cleanupFadeMs));
        return inherited*(autoRoot?fadeOutExpo(progress):1-progress);
      };
    }
    return {type:'Light',key:'Light',clip:null,conf,route:node.route,start,ms,place,
      parent:parent||null,parentRoute:parent?.route??null,parentEnd:parent?start+parentMs:null,
      parentBaseMs:baseMs,parentOpacity,recipeConf,naturalMs,
      timingMode:autoRoot?'auto-root':autoFX?'auto-parent':'natural'};
  }
  // Replay callers may supply GameLayer's absolute auto-FX cleanup time in ms.
  // SpellCastFX previews assume a played spell. A replay can also identify an
  // application outside the auto-FX sequence (e.g. a triggered effect).
  function plan(record,owner,{autoFXActive=true,autoFXCleanupAt}={}){
  const notes=new Set(),draws=[],subject=unit(record.id),isUnit=record.type==='unit'&&!record.ability,target=anchor(record);
    const caster=owner?.clip,attack=isUnit?subject.attack:caster;
    const source=isUnit?grid(4,2):grid(1,2);
    const delay=isUnit?record.attack?.attackDelay*1000:caster?life(caster)*.25:0;
    const invalid=!target||isUnit&&(!attack||attack.resourceKey!==record.attack?.key||!Number.isFinite(record.attack.attackDelay));
    if(invalid)return null;
    let impact=delay;
    const castAutoFX=autoFXActive&&record.event==='SpellCastFX';
    const cleanupAt=castAutoFX&&Number.isFinite(autoFXCleanupAt)?autoFXCleanupAt:Infinity;
    function visit(node,start,startPoint,endPoint,baseOffset,parent,parentEnds,baseMs=0,autoFX=false){
      const conf=node.config,type=node.nodeType,key=node.resources[0]?.key,clip=frames.fx[key];
      const particle=type==='Particles',options=conf.absolutePosition;
      const offset=options?{}:{x:(conf.offset?.x||0)+(baseOffset?.x||0),y:(conf.offset?.y||0)+(baseOffset?.y||0)};
      const absolute=options?grid(options.x,options.y):null;
      const from=shift(absolute||startPoint,offset),to=shift(absolute||endPoint,offset),forward=to.x>=from.x;
      const at=shift(from,{x:(conf.sourceOffset?.x||0)*(forward?1:-1),y:conf.sourceOffset?.y}),dest=shift(to,{x:(conf.targetOffset?.x||0)*(forward?-1:1),y:conf.targetOffset?.y});
      if(type==='Light'){
        const light=lightDraw(node,start,conf.atSource?at:dest,parent,baseMs,autoFX,autoFX?cleanupAt:Infinity);
        draws.push(light);
        if(autoFX&&!Number.isFinite(cleanupAt)){
          notes.add(parent
            ?'施法挂灯按自身淡出播放。若对局先切换根动作，父节点会在 500 ms 内淡出，挂灯随父节点移除。'
            :'出牌时顶层 Light 清除配方时长，保持常亮。切换根动作时开始 500 ms 淡出，单事件预览显示至片段结束。');
        }
        return;
      }
      let travel=0,ms=Math.max(life(clip),(conf.duration??(type==='Decal'?1:0))*1000),place=fixed(conf.atSource?at:dest),angle=conf.rotation||0,segments=null;
      let visible=['FXSprite','Decal','Projectile','EnergyBeam','Chain','Particles'].includes(type)&&!!clip;
      if(particle){
        if(!presets[key])visible=false;
        else{const data=presets[key],emission=data.duration<0?(parentEnds??1000):data.duration*1000;ms=emission+1000*(data.particleLifespan+data.particleLifespanVariance);notes.add('粒子按原配置与纹理作二维采样，随机轨迹为示例');}
      }
      if(type==='Projectile'){
        travel=(conf.moveDuration??.25)*1000;ms=travel+350;
        place=t=>pointAt(at,dest,1-Math.cos(Math.min(1,Math.max(0,t/travel))*Math.PI/2));
        angle=Math.atan2(dest.y-at.y,dest.x-at.x)*180/Math.PI;
      }else if(type==='Chain'||type==='EnergyBeam'){
        angle=Math.atan2(dest.y-at.y,dest.x-at.x)*180/Math.PI;
        if(type==='Chain'&&clip){
          const length=Math.hypot(dest.x-at.x,dest.y-at.y),width=clip.sourceWidth*(conf.scale??2);
          const count=conf.autoSegment===false?(conf.numSegments||1):Math.ceil(length/(width*(conf.autoSegmentThreshold||1.25)));
          segments=Array.from({length:count},(_,index)=>pointAt(at,dest,(index+1)/count));
          if(count)segments.stretch=(length/width)*(count>1?1/count:length/width);
        }else place=fixed(at);
        if(type==='EnergyBeam')travel=life(clip);
      }
      if(parent){place=t=>shift(parent.place(t),conf.offset);if(type!=='Particles')notes.add('随附层按父节点位置合成，局部变换未逐项复现');}
      if(node.resources.length>1)notes.add('随机候选固定展示原作候选列表第一项');
      if(!visible)notes.add(type+' · '+(key||node.route)+' 未渲染');
      if(conf.xyzRotation||conf.xyzRotationPerSecond||conf.shaderKey||conf.pulseScaleMax||conf.blendSrc&&conf.blendDst!=='ONE')notes.add(node.route+' 含引擎专用渲染参数，仅展示平面图层');
      const looping=conf.looping||type==='Projectile'||type==='Decal';
      if(type==='Decal')ms=Math.max(ms,life(clip))+14000;
      if(looping&&type!=='Decal'&&type!=='Projectile'&&!conf.duration)ms=Math.max(ms,life(clip)*2);
      const draw={key,clip,conf,type,start,ms,travel,place,angle,segments,looping,route:node.route,particle,emission:particle&&presets[key]?(presets[key].duration<0?(parentEnds??1000):presets[key].duration*1000):0};
      if(visible)draws.push(draw);
      if(isUnit&&!parent&&type!=='Chain')impact=Math.max(impact,start+(travel||(conf.impactAtEnd?ms:0)));
      const baseDuration=Math.max(life(clip),(conf.duration||0)*1000);
      node.emitFX.forEach(child=>visit(child,start,at,dest,null,draw,type==='Projectile'?travel:ms,baseDuration,autoFX));
      if(node.impactFX.length){
        const impactPoint=dest;
        const when=type==='Projectile'||type==='EnergyBeam'?travel:conf.impactAtStart!==false?0:conf.impactAtEnd?ms:null;
        if(when!==null)node.impactFX.forEach(child=>visit(child,start+when,impactPoint,impactPoint,null,null,undefined,baseDuration));
      }
    }
    record.layers.forEach(layer=>visit(layer,delay,isUnit?source:target,target,{x:0,y:47.5},null,undefined,0,castAutoFX));
    if(!draws.length)return null;
    const end=Math.max(1000,life(attack),...draws.map(d=>d.start+(Number.isFinite(d.ms)?d.ms:0)),isUnit?impact+life(unit('f1_general').damage):0);
    const sceneEnd=Math.ceil(end+300);
    for(const draw of draws){
      // The scrubber includes sceneEnd and pauses there. ms is an exclusive
      // removal boundary, so include that last millisecond for a held light.
      if(draw.type==='Light'&&draw.ms===Infinity)draw.ms=sceneEnd-draw.start+1;
    }
    return {record,isUnit,subject,source,target,attack,caster,delay,impact,draws,notes:[...notes],end:sceneEnd};
  }
  globalThis.CompositeEngine={plan,life,unit,grid,presets};
})();
