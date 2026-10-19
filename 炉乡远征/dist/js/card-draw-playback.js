// The host owns rules, persistence, input locks and hand snapshots. This layer only plays receipts.
export function createCardDrawPlayback(host, hooks) {
  let current=null, serial=0;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const anchor=(point,fallback)=>point && Number.isFinite(point.x)&&Number.isFinite(point.y)?point:fallback;
  function end(run,ok) {
    for(const animation of run.animations)animation.cancel();
    run.nodes.forEach(node=>node.remove());run.nodes.clear();
    if(current===run){current=null;try{hooks.onBusyChange?.(false);}catch{ok=false;}}
    run.resolve?.(ok);
  }
  function cancel() { if(current){const run=current;run.cancelled=true;end(run,false);} }
  async function animate(run,node,frames,duration) {
    if(run.cancelled||current!==run||hooks.isCurrent?.(run.context)===false)return false;
    const animation=node.animate(frames,{duration,easing:'cubic-bezier(.22,.75,.2,1)',fill:'forwards'});
    run.animations.add(animation);
    try{await animation.finished;}catch{return false;}finally{run.animations.delete(animation);}
    return !run.cancelled&&current===run&&hooks.isCurrent?.(run.context)!==false;
  }
  async function show(run,event) {
    const rect=host.getBoundingClientRect(),w=innerWidth,h=innerHeight;
    const width=Math.min(168,Math.max(112,w*.24),h*.66*224/296),height=width*296/224;
    const fallback={x:rect.right-34,y:rect.bottom-40};
    const from=anchor(hooks.deckAnchor?.(event.owner),fallback);
    const destination=anchor(hooks.handAnchor?.(event.owner,event.handIndex),{x:rect.left+rect.width*.5,y:rect.bottom-35});
    const reading={x:Math.max(width/2+10,Math.min(w-width/2-10,rect.left+rect.width*.64)),y:Math.max(height/2+10,Math.min(h-height/2-10,rect.top+rect.height*.48))};
    const node=event.kind==='fatigue'?document.createElement('div'):hooks.makeCard(event,{faceUp:event.owner===0});
    if(!node)return;
    node.classList.add('card-draw-flight');node.setAttribute('aria-hidden','true');node.inert=true;
    Object.assign(node.style,{position:'fixed',left:'0',top:'0',margin:'0',width:`${width}px`,height:`${height}px`,zIndex:'1200',pointerEvents:'none',transformOrigin:'center',willChange:'transform,opacity',filter:'none'});
    if(event.kind==='fatigue'){
      node.textContent=`疲劳 −${event.amount}`;
      Object.assign(node.style,{width:'auto',height:'auto',padding:'12px 18px',background:'#732e29',color:'#fff3dd',fontSize:'22px',fontWeight:'700',borderRadius:'4px'});
    }
    const pos=(p,scale=1,rotate=0)=>`translate(${p.x-width/2}px,${p.y-height/2}px) scale(${scale}) rotate(${rotate}deg)`;
    const reduced=motion.matches;
    if(['replace','mulligan'].includes(event.kind)&&event.previousCardId!=null){
      const outgoing=hooks.makeCard({...event,cardId:event.previousCardId},{faceUp:event.owner===0});
      if(outgoing){
        outgoing.style.cssText=node.style.cssText;outgoing.classList.add('card-draw-flight');outgoing.setAttribute('aria-hidden','true');outgoing.inert=true;
        document.body.append(outgoing);run.nodes.add(outgoing);await hooks.onDeparture?.(event);
        if(!await animate(run,outgoing,[{transform:pos(destination,.43),opacity:1},{transform:reduced?pos(destination,.43):pos(from,.32,9),opacity:0}],reduced?80:180))return;
        outgoing.remove();run.nodes.delete(outgoing);
      }
    }
    document.body.append(node);run.nodes.add(node);
    hooks.onStage?.(event,'depart');
    if(!await animate(run,node,[{transform:reduced?pos(reading):pos(from,.32,-9),opacity:0},{transform:pos(reading),opacity:1}],reduced?80:240))return;
    hooks.onStage?.(event,'read');
    if(!await animate(run,node,[{transform:pos(reading),opacity:1},{transform:pos(reading),opacity:1}],reduced?100:event.owner===0?420:130))return;
    if(event.kind==='burn'||event.kind==='fatigue'){
      hooks.onStage?.(event,event.kind);
      await animate(run,node,[{transform:pos(reading),opacity:1},{transform:pos(reading,reduced?1:.88),opacity:0}],reduced?80:210);
    } else {
      hooks.onStage?.(event,'land');
      await hooks.onApproach?.(event);
      const landing=anchor(hooks.handAnchor?.(event.owner,event.handIndex),destination);
      if(!await animate(run,node,[{transform:pos(reading),opacity:1},{transform:reduced?pos(reading):pos(landing,.43,0),opacity:reduced?0:1}],reduced?80:260))return;
      if(!run.cancelled&&current===run&&hooks.isCurrent?.(run.context)!==false)await hooks.onReveal?.(event);
    }
    node.remove();run.nodes.delete(node);
  }
  async function perform(run,events) {
    try{
      for(const event of events){
        if(run.cancelled||current!==run||hooks.isCurrent?.(run.context)===false){end(run,false);return;}
        if(document.hidden){if(!['burn','fatigue'].includes(event.kind))await hooks.onReveal?.(event);continue;}
        await show(run,event);
        if(run.cancelled||current!==run||hooks.isCurrent?.(run.context)===false){end(run,false);return;}
      }
      end(run,true);
    }catch(error){end(run,false);hooks.onError?.(error);}
  }
  function hidden(){if(document.hidden)cancel();}
  document.addEventListener('visibilitychange',hidden);
  window.addEventListener('pagehide',cancel);
  window.addEventListener('resize',cancel);
  motion.addEventListener('change',cancel);
  return {
    get busy(){return current!==null;},
    play(events,context={}) {
      cancel();
      if(hooks.isCurrent?.(context)===false)return Promise.resolve(false);
      if(!events?.length)return Promise.resolve(true);
      const run=current={id:++serial,context,nodes:new Set(),animations:new Set(),cancelled:false};
      const result=new Promise(resolve=>{run.resolve=resolve;});
      try{hooks.onBusyChange?.(true);}catch(error){end(run,false);hooks.onError?.(error);return result;}
      void perform(run,events);return result;
    },
    cancel,
    destroy(){cancel();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',cancel);window.removeEventListener('resize',cancel);motion.removeEventListener('change',cancel);}
  };
}
