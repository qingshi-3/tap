import type {GameState,Unit} from './types';
import {CARD_DEFS} from './content.ts';
export type RuleEvent={type:'death'|'kill';unit:Unit;source?:Unit;depth:number};
export type Damage=(target:Unit,amount:number,source?:Unit,depth?:number)=>void;
/** Hooks dispatch in instance-id order; recursively caused deaths stop at eight. */
export function dispatch(s:GameState,event:RuleEvent,damage:Damage):void{if(event.depth>8)return;const carrier=event.type==='kill'?event.source?.legionId:event.unit.legionId;const cards=s.cards.filter(c=>c.carrier===null||c.carrier===carrier).sort((a,b)=>Number(a.carrier!==null)-Number(b.carrier!==null)||a.id-b.id);for(const c of cards){const def=CARD_DEFS[c.kind];if(c.carrier===null&&(def.scope!=='global'||event.type==='death'&&event.unit.team!=='player'||event.type==='kill'&&event.source?.team==='enemy'))continue;if(event.type==='kill'&&def.killGold)s.gold+=def.killGold;if(event.type==='death'&&def.deathDamage)for(const u of [...s.units].sort((a,b)=>a.id-b.id))if(u.team!==event.unit.team&&u.hp>0&&Math.hypot(u.x-event.unit.x,u.y-event.unit.y)<=2.2)damage(u,def.deathDamage,event.unit,event.depth+1);}}

