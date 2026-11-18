import assert from 'node:assert/strict';
import { buildBattleHistory } from '../dist/js/battle-history-model.js';
import { CARDS } from '../dist/js/cards.js';
import { campaignMatch } from './battle-fixture.mjs';
import { endTurn } from '../dist/js/engine.js';
const name=CARDS[14].name;
const row=(text,round=3)=>`第${round}回合 · 敌方｜${text}`;
const state={round:3,battleCards:{0:{14:{...CARDS[14]}},1:{14:{...CARDS[14],name:'军用方尖碑'}}},log:[
 row('预告：军用方尖碑下次行动造成3点伤害。'),
 row(`我方${name}受到3点伤害。`),
 row('取消：军用方尖碑预定攻击落空。'),
 row('关闭：军用方尖碑已拆除。'),
 row('耗尽：军用方尖碑剩余0次。'),
 row('复生失败：原格已被占据。'),
 row('生成：军用方尖碑。'),
 row(`我方${name}攻击敌方军用方尖碑。`),
 row('预告：过期事件',1),
]};
const events=buildBattleHistory(state).groups.flatMap(group=>group.events);
assert.deepEqual(events.map(e=>e.kind),['forecast','damage','cancel','close','close','cancel','summon','attack']);
assert.equal(events[0].tone,'neutral');assert.equal(events[0].amount,3);
assert.equal(events[1].tone,'damage');assert.equal(events[1].amount,3);
assert.equal(events.at(-1).targetName,'军用方尖碑');assert.equal(events.at(-1).sourceName,undefined);
assert.ok(!JSON.stringify(events).includes('过期事件'));
const botAttack=buildBattleHistory({round:3,log:[row('风刃侍从 攻击 齐兰。'),row('我方齐兰受到3点伤害，剩余22生命。')]}).groups[0].events;
assert.equal(botAttack.length,1);assert.equal(botAttack[0].kind,'attack');
assert.equal(botAttack[0].sourceId,9);assert.equal(botAttack[0].targetId,23);assert.equal(botAttack[0].amount,3);
const real=campaignMatch({options:{encounters:true}});
assert.ok(endTurn(real,0));assert.ok(endTurn(real,1));
const forecast=buildBattleHistory(real).groups.flatMap(group=>group.events).find(event=>event.kind==='forecast');
assert.equal(forecast.sourceId,9101);assert.equal(forecast.amount,1);
const finalForecast=buildBattleHistory({round:3,players:[{id:0,generalId:23,name:'你'},{id:1,generalId:201,name:'终战统帅'},{id:2,generalId:401,name:'争功先锋'}],log:[row('预告：争功先锋，造成3点伤害，（2,3），1次行动后结算。')]}).groups[0].events[0];
assert.equal(finalForecast.sourceId,401);assert.equal(finalForecast.sourceName,'争功先锋');assert.equal(finalForecast.amount,3);
console.log('Encounter UI model passed: forecasts are separate from actual damage, finite-object outcomes, two-round retention, and enemy-only aliases.');

const outcomes=buildBattleHistory({round:3,log:[row('关闭：祭坛失效，取消未执行预告。'),row('治疗：逐光医师消耗1次，恢复2生命。'),row(`我方${name}恢复2点生命。`)]}).groups.flatMap(g=>g.events);
assert.equal(outcomes[0].kind,'close');assert.equal(outcomes[0].label,'关闭');
assert.equal(outcomes[1].kind,'status');assert.equal(outcomes[1].amount,null);
assert.equal(outcomes[2].kind,'heal');assert.equal(outcomes[2].amount,2);
const {encounterMarkerLabel}=await import('../dist/js/renderer.js');
assert.equal(encounterMarkerLabel({kind:'spawn',intent:'attackFlag',amount:0}),'⌛ +1攻');
assert.equal(encounterMarkerLabel({kind:'spawn',intent:'healFlag',amount:0}),'⌛ +2血');
assert.equal(encounterMarkerLabel({kind:'spawn',amount:0}),'⌛ 援');
assert.equal(encounterMarkerLabel({kind:'portal',marked:true,remaining:1}),'⌛ 门');
assert.equal(encounterMarkerLabel({kind:'portal',marked:false,remaining:2}),'门 ×2');
console.log('Actual interface semantics passed: lifecycle prefix priority, healing summaries, flag intent and entrance countdown versus charges.');

assert.equal(encounterMarkerLabel({kind:'portal',marked:true,intent:'retreat',label:'回撤',remaining:1}),'⌛ 回撤');
