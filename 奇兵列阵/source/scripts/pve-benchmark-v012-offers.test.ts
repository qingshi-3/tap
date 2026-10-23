import {describe,it,expect} from 'vitest';
import {playRun,type SimAction} from './simlib';
import {benchmarkPrepare,benchmarkShop} from './pve-benchmark-v012-policy';
import {familyPrepare,familyShop,type Family} from './pve-benchmark-v012-families';
describe('shared legal upgrade-offer policy',()=>{
 for(const variant of ['normal','no-master','casual','summon','frost'])it(variant+' consumes visible rewards with real 3-gold transactions',()=>{
  const actions:SimAction[]=[];const family=['summon','frost'].includes(variant)?variant as Family:undefined;
  const out=playRun({general:'reva',seed:731590301,requireLegalGeneral:true,playerPolicy:variant==='casual'?'casual':'growth',...(variant==='casual'?{}:{prepare:(r,report)=>family?familyPrepare(r,family,report):benchmarkPrepare(r,report,variant==='no-master'),visitShop:(r,report)=>family?familyShop(r,family,report):benchmarkShop(r,report,variant==='no-master')}),onAction:a=>actions.push(a)});
  expect(out.faults).toBe(0);expect(actions.filter(a=>!a.ok)).toEqual([]);const purchases=actions.filter(a=>a.type==='upgradeBuy');expect(purchases.length).toBeGreaterThan(0);
  for(const a of purchases){expect(a.goldBefore-a.goldAfter).toBe(3);expect(a.detail.choices).toContain(a.detail.id);if(variant==='no-master')expect(a.detail.id).not.toBe('s_master');}
  expect(actions.some(a=>a.type==='upgradeInspect'&&Array.isArray(a.detail.offers)&&(a.detail.offers as unknown[]).length>0)).toBe(true);
 });
 for(const route of ['normal','elite'] as const)it('forces only the requested '+route+' fork while default remains optional',()=>{let forks=0;const out=playRun({general:'reva',seed:731590301,requireLegalGeneral:true,playerPolicy:'growth',routePolicy:route,prepare:benchmarkPrepare,visitShop:benchmarkShop,onBattle:r=>{if(r.forkPick){forks++;expect(r.forkPick).toBe(route);}}});expect(out.faults).toBe(0);expect(forks).toBeGreaterThan(0);});

});
