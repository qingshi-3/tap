(() => {
  const get=id=>document.getElementById(id), canvas=get('stage'),ctx=canvas.getContext('2d'),clips=globalThis.skyfallFrames;
  const source=237,target=522,ground=221,unitCenter=ground-61,hit=400,end=2048,loop=end+650;
  const timings={bossSkyfallTyrantAttack:0,f1GeneralDamage:hit,fxCollisionSparksOrange:hit,fxClawSlash:hit};
  const frameMs=key=>clips[key].ms*.8,duration=key=>clips[key].count*frameMs(key);
  const stops=[...new Set(Object.entries(timings).flatMap(([key,start])=>Array.from({length:clips[key].count+1},(_,index)=>Math.round(start+index*frameMs(key)))))].sort((a,b)=>a-b);
  let position=0,playing=true,last=null;
  function sprite(key,age,x,y,flip,cycle=false){
    const clip=clips[key];if(age<0||(!cycle&&age>=duration(key)))return;
    const frame=Math.floor(age/frameMs(key))%clip.count;
    ctx.save();ctx.translate(x,y);ctx.scale(flip?-2:2,2);ctx.drawImage(clip.image,frame*clip.width,0,clip.width,clip.height,-clip.width/2,-clip.height/2,clip.width,clip.height);ctx.restore();
  }
  function mark(x,y,color,label,offset){ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.moveTo(x+4,y);ctx.lineTo(x+offset,y);ctx.stroke();ctx.font='13px system-ui';ctx.textAlign='left';ctx.fillText(label,x+offset+4,y+4)}
  function draw(){
    ctx.imageSmoothingEnabled=false;ctx.fillStyle='#18232d';ctx.fillRect(0,0,760,320);
    for(let index=-2;index<=5;index++){const x=source+index*95;ctx.fillStyle=index===0?'#28403e':index===3?'#413931':index%2?'#263540':'#22303b';ctx.fillRect(x-47,ground-47,94,94)}
    for(const x of [source,target]){ctx.fillStyle='#111a20';ctx.beginPath();ctx.ellipse(x,ground,28,7,0,0,Math.PI*2);ctx.fill()}
    if(position<end)sprite('bossSkyfallTyrantAttack',position,source,unitCenter,false);else sprite('bossSkyfallTyrantBreathing',position-end,source,unitCenter,false,true);
    const age=position-hit;
    if(age>=0&&age<duration('f1GeneralDamage'))sprite('f1GeneralDamage',age,target,unitCenter,true);
    else sprite('f1GeneralBreathing',age<0?position:age-duration('f1GeneralDamage'),target,unitCenter,true,true);
    if(get('spark').checked)sprite('fxCollisionSparksOrange',age,target,ground-47.5,true);
    if(get('claw').checked)sprite('fxClawSlash',age,target-30,ground-87.5,true);
    if(get('marks').checked){mark(target-30,ground-87.5,'#ffb377','爪痕中心',87);mark(target,ground-47.5,'#ffe299','火花中心',57);mark(target,ground,'#9bbfbb','目标格中心',57)}
    ctx.textAlign='center';ctx.font='15px system-ui';ctx.fillStyle='#cbeade';ctx.fillText('Skyfall Tyrant',source,296);ctx.fillStyle='#edd7bb';ctx.fillText('Argeon · 受击目标',target,296);
    const current=Math.min(end,Math.floor(position));get('time').value=current;get('readout').textContent=current+' ms　·　'+(position<hit?'Boss 起手':age<duration('fxClawSlash')?'命中：爪痕第 '+(1+Math.floor(age/frameMs('fxClawSlash')))+' / 5 帧':age<duration('fxCollisionSparksOrange')?'爪痕结束，火花消散':position<end?'Boss 收招':'本次攻击结束');get('play').textContent=playing?'暂停':'播放';
  }
  function seek(ms,run=false){position=ms;playing=run;last=null;draw()}
  function tick(now){if(playing&&last!==null)position=(position+(now-last)*Number(get('speed').value))%loop;last=now;draw();requestAnimationFrame(tick)}
  Promise.all(Object.values(clips).map(clip=>new Promise((resolve,reject)=>{clip.image=new Image();clip.image.onload=resolve;clip.image.onerror=reject;clip.image.src=clip.png}))).then(()=>{
    get('play').onclick=()=>seek(position>=end?0:position,!playing);get('restart').onclick=()=>seek(0,true);get('impact').onclick=()=>{get('marks').checked=true;seek(456)};get('time').oninput=event=>seek(Number(event.target.value));get('prev').onclick=()=>seek(stops.filter(ms=>ms<Math.min(end,position)).at(-1)??0);get('next').onclick=()=>seek(stops.find(ms=>ms>position)??end);
    requestAnimationFrame(tick);
  }).catch(()=>get('readout').textContent='素材读取失败，请保持页面与 H5 目录的相对位置。');
})();
