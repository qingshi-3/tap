/** Some mobile browser touch sequences omit the compatibility click after a canvas
 * pan. Preserve native click/keyboard activation, and fill only a missing touch tap. */
export function installTouchButtonFallback():()=>void {
 type Tap={button:HTMLButtonElement;x:number;y:number;cancelled:boolean};
 const touches=new Map<number,Tap>();
 const pending=new Map<number,{timer:number;button:HTMLButtonElement}>();
 const late=new Map<number,{button:HTMLButtonElement;until:number}>();
 const rejected=new Map<number,{button:HTMLButtonElement;until:number}>();
 const down=(event:PointerEvent)=>{
  if(event.pointerType!=='touch')return;
  const target=(event.target as Element|null)?.closest('button');
  if(!(target instanceof HTMLButtonElement)||target.disabled)return;
  for(const [id,entry]of late)if(entry.until<performance.now())late.delete(id);
  for(const [id,entry]of rejected)if(entry.until<performance.now())rejected.delete(id);
  touches.set(event.pointerId,{button:target,x:event.clientX,y:event.clientY,cancelled:false});
 };
 const move=(event:PointerEvent)=>{const tap=touches.get(event.pointerId);if(tap&&Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>10)tap.cancelled=true};
 const cancel=(event:PointerEvent)=>{const tap=touches.get(event.pointerId);if(tap)rejected.set(event.pointerId,{button:tap.button,until:performance.now()+700});touches.delete(event.pointerId);const scheduled=pending.get(event.pointerId);if(scheduled){clearTimeout(scheduled.timer);pending.delete(event.pointerId)}};
 const up=(event:PointerEvent)=>{
  const tap=touches.get(event.pointerId);touches.delete(event.pointerId);
  if(!tap)return;
  if(tap.cancelled||tap.button.disabled||!tap.button.isConnected){rejected.set(event.pointerId,{button:tap.button,until:performance.now()+700});return}
  const target=(event.target as Element|null)?.closest('button');
  const rect=tap.button.getBoundingClientRect();if(target!==tap.button||event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom){rejected.set(event.pointerId,{button:tap.button,until:performance.now()+700});return}
  const timer=window.setTimeout(()=>{
   pending.delete(event.pointerId);
   if(tap.button.disabled||!tap.button.isConnected||!tap.button.getClientRects().length)return;
   late.set(event.pointerId,{button:tap.button,until:performance.now()+700});
   tap.button.click();
  },120);
  pending.set(event.pointerId,{timer,button:tap.button});
 };
 const click=(event:MouseEvent)=>{
  if(!event.isTrusted)return;
  const target=(event.target as Element|null)?.closest('button');
  if(!(target instanceof HTMLButtonElement))return;
  // Keyboard / accessibility activation has detail=0 and must never be suppressed.
  if(event.detail===0)return;
  const id='pointerId' in event?(event as PointerEvent).pointerId:null;
  if(id!==null){
   const cancelled=rejected.get(id);
   if(cancelled&&cancelled.button===target&&performance.now()<cancelled.until){event.preventDefault();event.stopImmediatePropagation();rejected.delete(id);return}
   const duplicate=late.get(id);
   if(duplicate&&duplicate.button===target&&performance.now()<duplicate.until){event.preventDefault();event.stopImmediatePropagation();late.delete(id);return}
   const tap=pending.get(id);if(tap&&tap.button===target){clearTimeout(tap.timer);pending.delete(id)}
  }else{
   // Older MouseEvent clicks have no identity. Cancel one outstanding native tap,
   // but do not suppress late unidentified clicks or risk swallowing another input.
   const entry=[...pending].find(([,tap])=>tap.button===target);
   if(entry){clearTimeout(entry[1].timer);pending.delete(entry[0])}
  }
 };
 document.addEventListener('pointerdown',down,true);document.addEventListener('pointermove',move,true);
 document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',cancel,true);document.addEventListener('click',click,true);
 return ()=>{document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('click',click,true);for(const tap of pending.values())clearTimeout(tap.timer);pending.clear();touches.clear();late.clear();rejected.clear()};
}
