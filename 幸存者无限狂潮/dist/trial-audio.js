// Ephemeral facts stay outside saves; queues remain bounded while sound is off.
const queues=new WeakMap();
const watchedNodes=new WeakMap();
const ownerEpochs=new WeakMap();
const clock=()=>globalThis.performance?.now?.()??Date.now();
export function emitTrialAudio(game,boss,name,hazard=null){
  if(!boss||boss.dead||game.phase!=='playing'||globalThis.document?.hidden)return;
  let q=queues.get(game);if(!q){q=[];queues.set(game,q);}
  const now=clock();while(q.length&&(now-q[0].at>250||q.length>=32))q.shift();
  q.push({name,boss,hazard,at:now,time:game.time,epoch:ownerEpochs.get(boss)||0,cancelled:false});
}
export function trialAudioValid(game,event,pending=true){
  return !event.cancelled&&event.epoch===(ownerEpochs.get(event.boss)||0)&&!event.boss.dead&&(!game.enemies||game.enemies.includes(event.boss))&&
    (!pending||clock()-event.at<=250&&(event.time==null||game.time-event.time<=.25))&&
    (!event.hazard||game.enemyHazards?.includes(event.hazard)&&event.hazard.life>0);
}
export function drainTrialAudio(game){const q=queues.get(game)||[];queues.delete(game);return q;}
export function discardTrialAudio(game){for(const e of drainTrialAudio(game))e.cancelled=true;}
export function cancelTrialOwner(boss){ownerEpochs.set(boss,(ownerEpochs.get(boss)||0)+1);}
export function watchTrialNodes(boss,nodes){watchedNodes.set(boss,{nodes,broken:new WeakSet()});}
export function consumeTrialNodeDeaths(game,boss){
  const watched=watchedNodes.get(boss);if(!watched)return;
  // Timeout/owner cleanup sets hp/dead but does not set the damage death animation.
  for(const n of watched.nodes)if(n.dead&&n.hp<=0&&n.anim==='death'&&!watched.broken.has(n)){
    watched.broken.add(n);emitTrialAudio(game,boss,'trialSoulBreak');
  }
}
