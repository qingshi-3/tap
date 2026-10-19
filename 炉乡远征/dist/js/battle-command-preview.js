// Reading and activating are separate gestures; the caller owns battle mutations.
export function createBattleCommandPreview({ button, read, onOpen, onConfirm, onCancel, onAim, onDrop }) {
  const panel=document.createElement('section');panel.id='command-preview';panel.className='command-preview game-card game-card-spell';panel.hidden=true;
  panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','command-preview-name');
  panel.innerHTML='<div class="game-card-frame" aria-hidden="true"></div><div class="game-card-art"><canvas class="command-preview-icon" width="224" height="176" aria-hidden="true"></canvas></div><b class="command-preview-cost game-card-cost card-stat-badge card-stat-mana"></b><div class="game-card-caption"><h2 id="command-preview-name" class="game-card-name"></h2><p class="command-preview-status game-card-type"></p></div><p class="command-preview-rule game-card-description"></p>';
  document.body.append(panel);
  const name=panel.querySelector('h2'),cost=panel.querySelector('.command-preview-cost'),icon=panel.querySelector('canvas'),rule=panel.querySelector('.command-preview-rule'),status=panel.querySelector('.command-preview-status');rule.tabIndex=0;
  button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-expanded','false');
  panel.tabIndex=0;
  // Keep the rule text scrollable; artwork/caption own touch drags like a hand card.
  for(const selector of ['.game-card-frame','.game-card-art','.game-card-caption','.command-preview-cost'])panel.querySelector(selector).style.touchAction='none';
  let battleKey=null,press=null,suppressUntil=0;
  function position(){if(panel.hidden)return;const a=button.getBoundingClientRect(),w=panel.offsetWidth,h=panel.offsetHeight;panel.style.left=`${Math.max(8,Math.min(innerWidth-w-8,a.left-w-12))}px`;panel.style.top=`${Math.max(54,Math.min(innerHeight-h-8,a.bottom-h))}px`;}
  function close(restore=false){panel.hidden=true;panel.style.opacity='';battleKey=null;button.setAttribute('aria-expanded','false');if(restore)button.focus({preventScroll:true});}
  function render(model){
    const faction=Number.isInteger(model.faction)&&model.faction>=1&&model.faction<=6?model.faction:1;
    panel.dataset.faction=String(faction);panel.dataset.type='spell';
    panel.style.setProperty('--card-frame',`url('./assets/card-backgrounds/f${faction}-spell.png')`);
    name.textContent=model.name;cost.textContent=model.cost;cost.setAttribute('aria-label',`${model.cost}法力`);
    const ctx=icon.getContext('2d'),source=button.querySelector('canvas');ctx.clearRect(0,0,icon.width,icon.height);if(source)ctx.drawImage(source,24,0,176,176);
    rule.textContent=model.description.replace(/每个己方回合限用一次。|每回合1次。/g,'');status.textContent=model.reason||'每回合1次';
  }
  function show(){const before=read();if(!before?.visible)return;onOpen();const model=read();if(!model?.visible)return;battleKey=model.battleKey;render(model);panel.hidden=false;button.setAttribute('aria-expanded','true');position();}
  function clean(cancel=false){const old=press;press=null;clearTimeout(old?.timer);if(old&&old.source.hasPointerCapture(old.id))old.source.releasePointerCapture(old.id);panel.style.opacity='';if(cancel&&old?.dragging){close();onCancel();}}
  function sync(){const model=read();if(press&&(!model?.visible||model.interactionKey!==press.key)){clean(true);close();}if(panel.hidden)return;if(!model?.visible||model.battleKey!==battleKey){close();return;}render(model);position();}
  function start(e,source){if(!e.isPrimary||e.button!==0||button.disabled||e.target===rule)return;clean(true);const model=read();if(!model?.visible)return;const p=press={id:e.pointerId,x:e.clientX,y:e.clientY,key:model.interactionKey,source,held:false,dragging:false};if(source===button)p.timer=setTimeout(()=>{if(press!==p||p.dragging)return;p.held=true;show();},400);source.setPointerCapture(e.pointerId);}
  function move(e){const p=press;if(!p||p.id!==e.pointerId)return;if(Math.hypot(e.clientX-p.x,e.clientY-p.y)<10)return;clearTimeout(p.timer);p.moved=true;const model=read();if(!model?.available||model.interactionKey!==p.key||model.targetType==='self')return;if(!p.dragging){
    // Hiding the captured preview would lose the pointer before the drop.
    if(p.source===panel)panel.style.opacity='0';else close();
    onOpen();onConfirm();p.dragging=true;
  }e.preventDefault();onAim(e);}
  function activate(){const model=read();if(!model?.visible)return;if(model.available&&model.targetType==='self'){close();onOpen();onConfirm();}else show();}
  function release(e){const p=press;if(!p||p.id!==e.pointerId)return;suppressUntil=performance.now()+700;const model=read();clean();if(p.key!==model?.interactionKey){onCancel();return;}if(p.dragging){close();onDrop(e);return;}if(p.held||p.moved)return;activate();}
  for(const source of [button,panel]){
    source.addEventListener('pointerdown',e=>start(e,source));source.addEventListener('pointermove',move);source.addEventListener('pointerup',release);
    source.addEventListener('pointercancel',()=>clean(true));source.addEventListener('lostpointercapture',()=>{if(press)clean(true);});
    source.addEventListener('click',e=>{if(e.detail&&performance.now()<suppressUntil){e.preventDefault();return;}activate();});
    source.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();const model=read();if(!model?.available){show();return;}clean(true);close();onOpen();onConfirm();}});
  }
  button.addEventListener('contextmenu',e=>{e.preventDefault();show();});
  button.addEventListener('keydown',e=>{if(e.key==='F1'||(e.shiftKey&&e.key==='F10')){e.preventDefault();show();}});
  document.addEventListener('pointerdown',e=>{if(!e.isPrimary)clean(true);if(!panel.hidden&&!panel.contains(e.target)&&!button.contains(e.target))close();},{capture:true,passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){clean(true);if(!panel.hidden){e.preventDefault();close(true);}}},true);
  for(const event of ['resize','blur','pagehide'])window.addEventListener(event,()=>{clean(true);close();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clean(true);close();}});
  return {toggle:show,close,sync};
}
