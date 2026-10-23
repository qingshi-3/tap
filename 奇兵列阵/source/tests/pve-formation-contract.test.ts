import {describe,it,expect} from 'vitest';
import {formationBoard,cooperationGraph,evaluateFormation,attackInvestment,healthInvestment,powerInvestment,prepTargets,currentRelations,auditBattleCooperation} from '../scripts/pve-formation-contract';
import {simulate} from '../src/core/engine';
import type {Slotted} from '../src/core/types';
const u=(defId:string,ownedId:number,train:Slotted['train']={}):Slotted=>({defId,ownedId,copies:1,train});
const board=(...units:Slotted[])=>formationBoard({player:units,enemy:[{defId:'n_merc',atk:10,hp:50}]});
describe('formation contract real investment and roles',()=>{
 it('excludes stars and equipment from all investment thresholds',()=>{const x={...u('s_wind',1),copies:4 as const,equips:['eq_combo']};expect([attackInvestment(x),healthInvestment(x),powerInvestment(x)]).toEqual([0,0,0]);expect(healthInvestment(u('n_thorn',1,{hp:1}))).toBe(2);});
 it('requires invested core for startup, then distinct actual support',()=>{expect(evaluateFormation('multi',board(u('s_wind',1),u('s_dancer',2))).started).toBe(false);const b=board(u('s_dancer',2),u('n_envoy',3),u('s_wind',1,{atk:2}));expect(evaluateFormation('multi',b).basicReady).toBe(true);expect(new Set(evaluateFormation('multi',b).witnesses.map(x=>x.ownedId)).size).toBe(3);});
 it('does not count mentor on equipment-only combo',()=>{const b=board({...u('n_merc',1,{atk:2}),equips:['eq_combo']},u('s_choreo',2),u('s_dancer',3));expect(prepTargets(b.field,b.field[1],{event:'endPrep',scope:'self',target:'adjacent',atk:[2,3,4],targetTag:'连击'})).toEqual([]);expect(evaluateFormation('multi',b).basicReady).toBe(false);});
 it('recognizes automatic heart as HP-invested burn source, not power investment',()=>{expect(evaluateFormation('burn',board(u('m_heart',1,{hp:1}),u('m_bloodcaller',2),u('m_shaman',3))).basicReady).toBe(true);expect(evaluateFormation('burn',board(u('m_heart',1,{power:4}),u('m_bloodcaller',2))).started).toBe(false);});
 it('requires actual qualifying buy growth receipt for spell support',()=>{const b=board(u('a_devour',1,{power:1}),u('s_dart',2),u('d_pyro',3));expect(evaluateFormation('spell',b).basicReady).toBe(false);b.receipts.push({sourceOwnedId:3,targetOwnedId:1,sourceDefId:'d_pyro',event:'buy',stat:'power',amount:1,battle:1});expect(evaluateFormation('spell',b).basicReady).toBe(true);});
 it('does not let ritual skip an ineligible nearest body',()=>{expect(cooperationGraph(board(u('a_imp',1),u('n_merc',2),u('n_ritualist',3))).edges.filter(e=>e.kind==='sacrifice')).toEqual([]);});
});
describe('anti3 connected real mechanism control',()=>{
 it('allows five ordinary no-synergy bodies and same faction alone',()=>{expect(cooperationGraph(board(...[1,2,3,4,5].map(id=>u('m_hide',id)))).violates).toBe(false);});
 it('allows core and dancer, forbids effective dancer plus envoy',()=>{expect(cooperationGraph(board(u('s_wind',1,{atk:2}),u('s_dancer',2))).violates).toBe(false);expect(cooperationGraph(board(u('s_dancer',2),u('n_envoy',3),u('s_wind',1,{atk:2}))).violates).toBe(true);});
 it('allows two disconnected pairs',()=>{expect(cooperationGraph(board(u('v_mage',1),u('v_drake',2),u('a_void',3),u('a_imp',4))).violates).toBe(false);});
 it('forbids ritual fodder and a third actual receiver',()=>{expect(cooperationGraph(board(u('a_imp',1),u('n_ritualist',2),u('n_merc',3,{atk:3}))).violates).toBe(true);});
 it('allows void fodder pair and forbids actual death payoff',()=>{expect(cooperationGraph(board(u('a_void',1),u('a_imp',2))).violates).toBe(false);expect(cooperationGraph(board(u('a_void',1),u('a_reaper',3),u('a_imp',2))).violates).toBe(true);});
 it('allows chill drake pair and forbids two chill sources plus drake',()=>{expect(cooperationGraph(board(u('v_mage',1),u('v_drake',2))).violates).toBe(false);expect(cooperationGraph(board(u('v_mage',1),u('v_drake',2),u('v_scout',3))).violates).toBe(true);});
 it('generic master carry is allowed but amplified combo and action chain is forbidden',()=>{expect(cooperationGraph(board(u('s_master',1),...['n_merc','n_bulwark','n_archer','m_hide'].map((id,i)=>u(id,i+2)))).violates).toBe(false);expect(cooperationGraph(board(u('s_master',1),u('s_wind',2,{atk:10}),u('s_dancer',3))).violates).toBe(true);});
 it('global grants stay generic for ordinary bodies, count dedicated reborn/death resources',()=>{expect(cooperationGraph(board(u('l_archon',1),u('n_merc',2),u('n_archer',3))).violates).toBe(false);expect(cooperationGraph(board(u('l_archon',1),u('a_imp',2),u('a_reaper',3))).violates).toBe(true);});
 it('does not union mutually exclusive reserve fields',()=>{const b=formationBoard({player:[u('s_dancer',1),u('n_merc',2,{atk:10})],enemy:[],reserve:[u('s_dancer',3)],general:{id:'sajj',level:1,passives:[]}});expect(cooperationGraph(b).violates).toBe(false);});
 it('audits a real reachable rotation chain',()=>{expect(cooperationGraph(board(u('s_dancer',1),u('s_step',2,{atk:8}),u('n_envoy',3))).violates).toBe(true);});
});


describe('independent review counterexamples',()=>{
 it('matriarch only multiplies real deathrattles, not ordinary revive',()=>{expect(cooperationGraph(board(u('a_matriarch',1),u('l_knight',2),u('l_archon',3))).violates).toBe(false);});
 it('does not add future self-sale source as a simultaneous third vertex',()=>{expect(cooperationGraph(board(u('n_archer',1),u('s_dancer',2),u('s_wind',3,{atk:10}))).violates).toBe(false);});
 it('freezes preparation edges rather than running mentor again after rotation',()=>{const b=board(u('s_choreo',1),u('n_merc',2),u('s_wind',3));const shifted={...b,field:[b.field[0],b.field[2],b.field[1]].map((u,i)=>({...u,slot:i}))};expect(currentRelations(shifted).some(e=>e.rule==='prep:endPrep')).toBe(false);});
 it('counts summon token rotation under original lineage',()=>{const g=cooperationGraph(board(u('d_dune',1),u('l_storm',2),u('l_caliber',3)));expect(g.violates).toBe(true);expect(g.components[0]).toEqual([1,2,3]);});
 it('accepts a genuine native duel-win payoff as the key',()=>{const b=board(u('n_gladiator',1,{atk:2}),u('s_backstab',2));expect(evaluateFormation('duel',b).started).toBe(true);});
 it('audits authoritative summon descendants without adding purchased vertices',()=>{const setup={player:[u('d_dune',1),u('l_storm',2),u('l_caliber',3)],enemy:[{defId:'n_merc',atk:10,hp:80}],record:true};const out=simulate(setup);const a=auditBattleCooperation(setup,out);expect(a.snapshotsChecked).toBeGreaterThan(0);expect(a.violates).toBe(true);expect(a.unknownPlayerLineages).toBe(0);expect(a.violations.every(v=>v.components.flat().every(id=>[1,2,3].includes(id)))).toBe(true);});
});

describe('actual enemy-state audit',()=>{
 it('checks an enemy-only death even with an unchanged player field',()=>{const setup={player:[u('n_gladiator',1),u('s_fox',2),u('s_viper',3)],enemy:[{defId:'n_merc',atk:1,hp:20},null,{defId:'n_merc',atk:1,hp:20}],record:true};const out=simulate(setup),initial=out.initial,changed=initial.map(v=>v.side===1&&v.slot===2?{...v,alive:false,hp:0}:v);const audit=auditBattleCooperation(setup,{...out,log:[{ev:{t:'phase',name:'battle'},snap:changed}]});expect(audit.snapshotsChecked).toBe(2);});
});

describe('multi-token layout before summon log ancestry',()=>{
 it('resolves every howler newborn even when horde buffs are logged before summon',()=>{const setup={player:[u('n_merc',1),{...u('d_howler',2),copies:2 as const},u('n_merc',3)],reserve:[u('l_shield',4)],general:{id:'sajj',power:0,passives:['g_horde'],tacticsVersion:1 as const},enemy:[{defId:'n_merc',atk:10,hp:80}],record:true};const out=simulate(setup);expect(out.log.filter(x=>x.ev.t==='summon').length).toBeGreaterThan(1);expect(auditBattleCooperation(setup,out).unknownPlayerLineages).toBe(0);});
});

describe('real rotate shield supplier',()=>{it('counts silver guard block to lion after a real rotation',()=>{expect(evaluateFormation('shield',board(u('l_lion',1,{atk:2}),u('l_shield',2),u('l_banner',3))).basicReady).toBe(true);});});

describe('shield supplier roles are real supplies',()=>{it('banner is a payoff and cannot pretend to supply a shield',()=>{expect(evaluateFormation('shield',board(u('l_lion',1,{atk:2}),u('l_banner',2))).started).toBe(false);});it('a front silver guard gives its new front a shield, not a lion farther behind',()=>{expect(evaluateFormation('shield',board(u('l_shield',1),u('n_merc',2),u('l_lion',3,{atk:2}),u('l_banner',4))).basicReady).toBe(false);});});

describe('actual ally-sale receipt retains a deployed source relationship',()=>{const receipt={sourceOwnedId:1,targetOwnedId:3,sourceDefId:'n_obelisk',event:'sell' as const,stat:'power' as const,amount:1,battle:1};it('counts a current obelisk receipt plus envoy as a real three-person chain',()=>{const b=board(u('n_obelisk',1),u('n_envoy',2),u('a_devour',3,{power:1}));b.receipts=[receipt];expect(cooperationGraph(b).violates).toBe(true);});it('does not count a sold source or an absent receipt',()=>{expect(cooperationGraph(board(u('n_obelisk',1),u('n_envoy',2),u('a_devour',3,{power:1}))).violates).toBe(false);const b=board(u('n_envoy',2),u('a_devour',3,{power:1}));b.receipts=[receipt];expect(cooperationGraph(b).violates).toBe(false);});});
