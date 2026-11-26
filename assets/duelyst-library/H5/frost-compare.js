(() => {
  const clips={...globalThis.skyfallFrames,...globalThis.frostFrames},get=id=>document.getElementById(id);
  const frameTime=key=>clips[key].ms*.8,duration=key=>frameTime(key)*clips[key].count;
  const cast=duration('bossSkyfallTyrantAttack')/4,attackImpact=400,spellImpact=cast+duration('fx_multislash_full')+350*.75,end=4200;
  const units=[
    {id:'Boss',x:1,y:2,team:1,base:'bossSkyfallTyrantBreathing'},
    {id:'将军',x:6,y:2,team:2,base:'f1GeneralBreathing'},
    {id:'A',x:5,y:2,team:2,base:'f1SilverguardSquireBreathing'},
    {id:'B',x:7,y:1,team:2,base:'f1AzuriteLionBreathing'},
    {id:'C',x:8,y:2,team:2,base:'f1MeleeBreathing'},
    {id:'D',x:6,y:3,team:1,base:'f1SilverguardSquireBreathing'}
  ];
  const general=units[1],near=unit=>unit!==general&&unit.team===general.team&&Math.max(Math.abs(unit.x-general.x),Math.abs(unit.y-general.y))===1;
  const xOf=col=>47.5+95*col,yOf=row=>54+95*row;
  let time=0,playing=true,previous=null;
  function sprite(ctx,key,age,x,y,opts={}){
    if(age<0)return;const c=clips[key];let index=Math.floor(age/frameTime(key));if(opts.loop)index%=c.count;if(index>=c.count)return;
    ctx.save();ctx.translate(x,y);ctx.rotate((opts.degrees||0)*Math.PI/180);ctx.scale(opts.flip?-2:2,2);ctx.globalAlpha=opts.alpha??1;
    ctx.drawImage(c.image,index*c.width,0,c.width,c.height,-c.width/2,-c.height/2,c.width,c.height);ctx.restore();
  }
  function text(ctx,str,x,y,color,bg){
    ctx.font='bold 17px system-ui';ctx.textAlign='center';const width=ctx.measureText(str).width;
    ctx.fillStyle=bg||'#18252e';ctx.fillRect(x-width/2-5,y-18,width+10,23);ctx.fillStyle=color;ctx.fillText(str,x,y);
  }
  function draw(kind){
    const ctx=get(kind).getContext('2d'),spell=kind==='spell',impact=spell?spellImpact:attackImpact,age=time-impact;
    const guides=get('guides').checked;ctx.imageSmoothingEnabled=false;ctx.fillStyle='#131f27';ctx.fillRect(0,0,855,485);
    for(let row=0;row<5;row++)for(let col=0;col<9;col++){
      const adjacent=Math.max(Math.abs(col-general.x),Math.abs(row-general.y))===1;
      ctx.fillStyle=guides&&spell&&adjacent?'#253c48':(col+row)%2?'#23313c':'#1f2d37';
      const left=xOf(col)-47,top=yOf(row)-47;ctx.fillRect(left,top,94,94);
      if(guides&&col===general.x&&row===general.y){ctx.strokeStyle='#e6b880';ctx.lineWidth=2;ctx.strokeRect(left+2,top+2,90,90)}
    }
    if(guides){const x=xOf(4),y=yOf(2);ctx.strokeStyle='#9fc6d3';ctx.beginPath();ctx.moveTo(x,y-9);ctx.lineTo(x+9,y);ctx.lineTo(x,y+9);ctx.lineTo(x-9,y);ctx.closePath();ctx.stroke()}
    for(const unit of [...units].sort((a,b)=>a.y-b.y)){
      const x=xOf(unit.x),y=yOf(unit.y);let key=unit.base,local=time,loop=true;
      if(unit.id==='Boss'){
        if(time<2048){key='bossSkyfallTyrantAttack';loop=false}
        else if(time<2560){key='bossSkyfallTyrantIdle';local=time-2048;loop=false}
        else local=time-2560;
      }
      if(unit===general&&age>=0&&age<duration('f1GeneralDamage')){key='f1GeneralDamage';local=age;loop=false}
      ctx.fillStyle='#13212a';ctx.beginPath();ctx.ellipse(x,y,26,7,0,0,7);ctx.fill();
      sprite(ctx,key,local,x,y-(clips[key].height-39),{flip:unit.team===2,loop});
      if(spell&&near(unit)&&age>=0){
        sprite(ctx,'fx_flashfreeze_idle',age,x,y-55,{flip:true,loop:true});
        const life=duration('fx_flashfreeze_appear');
        sprite(ctx,'fx_flashfreeze_appear',age,x,y-55,{flip:true,alpha:Math.max(0,Math.min(1,age/(life*.2),(life-age)/(life*.35)))});
      }
    }
    if(spell){
      const x=xOf(4),y=yOf(2),phase=time-cast;sprite(ctx,'fxFrozenIceBlock',phase,x-47,y-27.5,{degrees:-90});sprite(ctx,'fxFrozenIceBlock',phase,x+47,y-27.5,{degrees:90});sprite(ctx,'fx_multislash_full',phase,x+10,y-47.5,{degrees:90});
    }else{sprite(ctx,'fxCollisionSparksOrange',age,xOf(6),yOf(2)-47.5,{flip:true});sprite(ctx,'fxClawSlash',age,xOf(6)-30,yOf(2)-87.5,{flip:true})}
    if(guides){
      for(const unit of units){let caption=unit.id;if(unit===general&&age>=0)caption+=' −2';else if(spell&&age>=0&&near(unit))caption+=' 眩晕';else if(unit.id==='D')caption+=' Boss 侧';text(ctx,caption,xOf(unit.x),yOf(unit.y)+31,unit.team===1?'#ace3c7':'#ffdfac')}
      text(ctx,'棋盘中央',xOf(4),yOf(2)+31,'#bbd7ea');
    }
    get(kind+'State').textContent=spell?(time<cast?'Boss 播放自己的攻击帧作为施法动作。':time<spellImpact?'棋盘中央：两块冰与一道冰斩起播，斩击持续 1.920 秒。':'敌将 −2；A、B 眩晕且未扣血。C 在范围外，D 与 Boss 同队。'):(time<impact?'Boss 播放攻击动作，锁定敌将。':'敌将 −2；四名随从均未受影响。');
  }
  function render(){draw('attack');draw('spell');get('clock').textContent=(time/1000).toFixed(3)+' s / 4.200 s';get('scrub').value=Math.floor(time);get('toggle').textContent=playing?'暂停':'播放'}
  function seek(value,run=false){previous=null;time=value;playing=run;render()}
  function tick(now){if(playing&&previous!==null)time=Math.min(end,time+(now-previous)*Number(get('speed').value));if(time===end)playing=false;previous=now;if(playing||time===end)render();requestAnimationFrame(tick)}
  Promise.all(Object.values(clips).map(clip=>new Promise((ok,fail)=>{clip.image=new Image();clip.image.onload=ok;clip.image.onerror=fail;clip.image.src=clip.png}))).then(()=>{
    const icon=document.createElement('canvas');icon.width=34;icon.height=34;icon.getContext('2d').drawImage(clips.iconLaceratingFrostIdle.image,0,0,34,34,0,0,34,34);get('icon').src=icon.toDataURL();
    get('toggle').onclick=()=>seek(time>=end?0:time,!playing);get('restart').onclick=()=>seek(0,true);get('scrub').oninput=event=>seek(Number(event.target.value));get('guides').onchange=render;document.querySelectorAll('[data-at]').forEach(button=>button.onclick=()=>seek(Number(button.dataset.at)));
    render();requestAnimationFrame(tick);
  }).catch(()=>get('clock').textContent='读取原帧失败，请保留 H5 目录与页面的相对位置。');
})();
