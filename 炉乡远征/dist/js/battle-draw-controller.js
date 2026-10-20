import { drainBattlePresentation, clearBattlePresentation } from './battle-presentation-events.js';
import { createCardDrawPlayback } from './card-draw-playback.js';
import { createGameCard } from './game-card.js';
import { getCardRarity } from './card-rarity.js';

// Receipts describe already committed rules. The host retains saves and turn ordering.
export function createBattleDrawController(host, hand, hooks) {
  let state = null, queued = [], hidden = new Set(), generation = 0, playing = null;
  const current = context => context.state === hooks.state() && context.epoch === hooks.epoch() && !host.hidden;
  const point = element => { const r = element?.getBoundingClientRect(); return r && r.width ? { x:r.x+r.width/2, y:r.y+r.height/2 } : null; };
  const playback = createCardDrawPlayback(host, {
    isCurrent: current,
    makeCard(event, { faceUp }) {
      if (!faceUp) { const back = document.createElement('div'); back.className = 'battle-draw-back'; return back; }
      const card = hooks.card(event.cardId, event.owner);
      if(!card)return null;
      const face=createGameCard(card, { drawArt:hooks.drawArt });
      face.classList.add('battle-draw-face');
      const rarity=getCardRarity(card.id);
      if(rarity) {
        const gem=document.createElement('span');gem.className='battle-card-rarity';
        gem.style.setProperty('background-image',`url('./assets/ui/rarity/${rarity.key==='basic'?'common':rarity.key}.png')`);
        gem.title=rarity.label;face.append(gem);
      }
      if(Number.isInteger(card.trainingLevel)) {
        const level=document.createElement('span');level.className='battle-card-level';
        level.textContent=`Lv.${card.trainingLevel}`;face.append(level);
      }
      return face;
    },
    deckAnchor(owner) {
      const r=host.getBoundingClientRect();
      return { x:r.right-Math.max(34,parseFloat(getComputedStyle(host).getPropertyValue('--ui-right'))||0), y:owner===0?r.bottom-70:r.top+65 };
    },
    handAnchor(owner,index) {
      const r=host.getBoundingClientRect();
      return owner===0 ? point(hand.children[index]) ?? {x:r.left+r.width*.4,y:r.bottom-45} : {x:r.left+r.width*.5,y:r.top+20};
    },
    onBusyChange: busy => hooks.onBusyChange?.(busy),
    onDeparture(event) { if(event.owner===0) { hidden.add(event.handIndex); applyHand(); } },
    onReveal(event) { if(event.owner===0) { hidden.delete(event.handIndex); applyHand(); } },
    onError: error => hooks.onError?.(error)
  });
  function applyHand() {
    [...hand.children].forEach((node,index)=>{
      node.classList.toggle('draw-pending', hidden.has(index));
    });
  }
  function capture(target=hooks.state()) {
    if(state!==target) { generation++; queued=[]; hidden.clear(); state=target; playing=null; playback.cancel(); }
    if(target) queued.push(...drainBattlePresentation(target).filter(event=>event.reason!=='opening'));
    queued.filter(event=>event.owner===0&&!['burn','fatigue'].includes(event.kind)).forEach(event=>hidden.add(event.handIndex));
    applyHand();
    return queued.length;
  }
  return {
    get busy() { return Boolean(playing || playback.busy || queued.length); },
    capture, applyHand,
    async playPending({stage}={}) {
      if(playing) return playing;
      capture();
      const events=queued.filter(event=>!stage||event.stage===stage);
      queued=queued.filter(event=>stage&&event.stage!==stage);
      if(!events.length)return true;
      const context={state,epoch:hooks.epoch()};
      const runGeneration=generation;
      // Mark busy before playback calls the host's synchronous refresh callback.
      playing=Promise.resolve();
      const result=playback.play(events,context); playing=result;
      try { return await result; }
      finally {
        if(runGeneration===generation) {
          playing=null;
          if(current(context)) hidden=new Set(queued.filter(event=>event.owner===0&&!['burn','fatigue'].includes(event.kind)).map(event=>event.handIndex));
          applyHand(); hooks.onSettled?.();
        }
      }
    },
    cancel() { generation++; if(state)clearBattlePresentation(state); state=null;queued=[];playing=null;hidden.clear();playback.cancel();applyHand(); },
    destroy() { this.cancel(); playback.destroy(); }
  };
}
