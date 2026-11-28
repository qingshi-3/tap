// Optional mechanics awareness layered onto the frozen tactical evaluator.
// Reads only public telegraphs and live sources; no future hand/deck information.
export function encounterScore(s){
 const e=s.encounter;if(!e)return 0;let value=0;
 for(const event of e.events??[]){const cfg=e.config?.sources?.[event.source]??{},kind=cfg.kind==='portal'?'portal':event.kind??cfg.kind;
  for(const cell of event.cells??[]){const unit=s.units.find(u=>u.health>0&&u.x===cell.x&&u.y===cell.y);
   if(['shot','cannon','damage'].includes(kind)&&unit?.owner===0)value-=(cfg.damage??2)*(unit.cardId===s.players[0].generalId?13:7);
   if(['portal','hunt','corpse','revive'].includes(kind)&&unit?.owner===0)value+=kind==='hunt'?13:9;
  }
 }
 for(let i=0;i<(e.sources?.length??0);i++){const source=e.sources[i],cfg=e.config?.sources?.[i]??{};if(source.closed||source.spent||source.remaining===0&&cfg.times?.length&&!e.events.some(ev=>ev.source===i))continue;const u=s.units.find(u=>u.unitId===source.unitId&&u.health>0);if(u&&u.owner!==0&&cfg.card&&cfg.kind!=='ice')value-=u.health*(cfg.kind==='iron'?3:1.6);if(cfg.kind==='portal'&&s.units.some(v=>v.owner===0&&v.x===source.x&&v.y===source.y))value+=9;}
 for(const corpse of e.corpses??[]){if(s.units.some(u=>u.owner===0&&u.x===corpse.x&&u.y===corpse.y))value+=9;}
 return value;
}
