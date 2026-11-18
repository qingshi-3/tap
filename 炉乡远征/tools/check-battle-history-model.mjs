import assert from 'node:assert/strict';
import { buildBattleHistory } from '../dist/js/battle-history-model.js';
import { appendBattleLog } from '../dist/js/battle-history-log.js';
import { CARDS } from '../dist/js/cards.js';
const name = CARDS[14].name;
const row=(round,text,side='我方')=>`第${round}回合 · ${side}｜${text}`;
const state={round:3,log:[row(1,'古老事件'),row(2,`我方${name}出现在（1,2）。`),row(2,`玩家 召唤 ${name}。`),row(3,`我方${name}攻击敌方霜墙女王。`),row(3,'敌方霜墙女王受到1点伤害，剩余21生命。'),row(3,'我方齐兰使用日耀圣露。'),row(3,`我方${name}恢复1点生命，现为4。`),row(3,'未知的长篇战斗说明不应该默认展示。'),row(3,'轮到你了。')]};
const groups=buildBattleHistory(state).groups;
assert.deepEqual(groups.map(group=>group.round),[2,3]);
assert.equal(groups[0].events.length,1);
const attack=groups[1].events[0];
assert.equal(attack.sourceId,14);assert.equal(attack.targetId,527);assert.equal(attack.amount,1);
const skill=groups[1].events[1];assert.equal(skill.sourceId,20175);assert.equal(skill.amount,1);assert.equal(skill.tone,'heal');
assert.equal(skill.keyword,'治疗');
assert.equal(groups[1].events[2].label,'战况');
assert.ok(!JSON.stringify(groups).includes('轮到你了'));
const legacy={round:3,currentPlayer:0,log:[row(1,'旧'),row(2,'前'),row(3,'今'),'无前缀旧档']};
appendBattleLog(legacy,'新');assert.equal(legacy.log.length,3);assert.ok(legacy.log.every(text=>!text.includes('旧')));
assert.equal(buildBattleHistory({...state,log:[row(2,'我方齐兰受到2点伤害。'),row(3,'玩家施放日耀圣露。')]}).groups[0].events[0].kind,'damage');
console.log('Battle history model passed: two-round window, summon deduplication, actual damage/healing, skill art, unknown fallback and turn isolation.');

const lateSpell=buildBattleHistory({round:3,log:[row(3,`我方${name}恢复1点生命，现为4。`),row(3,'玩家施放日耀圣露。')]}).groups[0].events;
assert.equal(lateSpell.length,1);assert.equal(lateSpell[0].sourceId,20043);assert.equal(lateSpell[0].amount,1);
assert.equal(lateSpell[0].keyword,'治疗');
const utility=Object.values(CARDS).find(card=>card.type==='spell'&&!/恢复|治疗|伤害/.test(card.description));
const unrelated=buildBattleHistory({round:3,log:[row(3,`我方${name}受到2点伤害。`),row(3,`玩家施放${utility.name}。`)]}).groups[0].events;
assert.equal(unrelated.length,2);assert.equal(unrelated[0].kind,'damage');
const frozen=buildBattleHistory({round:3,log:[row(3,`敌方${name}：攻击2→3，获得冻结，获得嘲讽。`)]}).groups[0].events[0];
assert.equal(frozen.tone,'freeze');assert.equal(frozen.amount,'攻2→3');

const currentPhrases=buildBattleHistory({round:3,log:[row(3,'霜墙女王 召唤 冰棱。'),row(3,`我方${name}：嘲讽结束，飞行结束，攻击1→2，生命上限3→4。`),row(3,`你手牌已满，${name}被烧毁。`),row(3,'初始远征已开始。'),row(3,'你的第一回合开始。')]}).groups[0].events;
assert.equal(currentPhrases.length,3);
assert.equal(currentPhrases[0].targetId,9001);
assert.equal(currentPhrases[1].keyword,'嘲讽结束·飞行结束');
assert.equal(currentPhrases[1].amount,'攻1→2 血3→4');
assert.equal(currentPhrases[2].kind,'burn');assert.equal(currentPhrases[2].targetId,14);
const lost=buildBattleHistory({round:3,log:[row(3,`我方${name}：失去嘲讽。`)]}).groups[0].events[0];
assert.equal(lost.keyword,'失去嘲讽');

const bossMark=buildBattleHistory({round:3,log:[row(3,'冰封：标记（2,3），下次女王回合开始结算。','敌方')]}).groups[0].events[0];
assert.equal(bossMark.kind,'mark');assert.equal(bossMark.sourceId,527);assert.equal(bossMark.amount,'（2,3）');
const duplicateFreeze=buildBattleHistory({round:3,log:[row(3,`我方${name}被冰封冻结。`),row(3,`我方${name}：获得冻结。`)]}).groups[0].events;
assert.equal(duplicateFreeze.length,1);assert.equal(duplicateFreeze[0].keyword,'冻结');assert.equal(duplicateFreeze[0].targetId,14);
assert.ok(duplicateFreeze[0].detail.includes('被冰封冻结')&&duplicateFreeze[0].detail.includes('获得冻结'));

for (const [keyword,sourceId,amount] of [['冰封',527,3],['碎冰',9001,2],['疲劳',null,1]]) {
  const effect=buildBattleHistory({round:3,log:[row(3,`我方${name}受到${amount}点${keyword}伤害，剩余2生命。`)]}).groups[0].events[0];
  assert.equal(effect.kind,'damage');assert.equal(effect.keyword,keyword);assert.equal(effect.label,keyword);assert.equal(effect.sourceId,sourceId);assert.equal(effect.targetId,14);assert.equal(effect.amount,amount);assert.equal(effect.tone,'damage');
}
const mechanismAfterAttack=buildBattleHistory({round:3,log:[row(3,`敌方霜墙女王攻击我方${name}。`),row(3,`我方${name}受到3点冰封伤害，剩余2生命。`)]}).groups[0].events;
assert.equal(mechanismAfterAttack.length,2);assert.equal(mechanismAfterAttack[1].sourceId,527);

// New encounters keep their own portrait and phase semantics in the same compact log.
{
  const state={round:3,boss:{id:'confluence-warlord',owner:1},players:[{generalId:1},{generalId:201}],log:[
    '第3回合 · 敌方｜终战统帅蓄势：（2,3），下次敌方回合造成3点伤害。',
    '第3回合 · 敌方｜终战统帅进入第二阶段，最后一批增援抵达。',
    '第3回合 · 我方｜齐兰 移动。'
  ]};
  const events=buildBattleHistory(state).groups.flatMap(g=>g.events);
  assert.equal(events[0].kind,'mark');assert.equal(events[0].sourceId,201);
  assert.equal(events[1].label,'增援');assert.equal(events[1].sourceId,201);assert.notEqual(events[1].tone,'freeze');
  assert.equal(events[2].kind,'move');
}
{
  const events=buildBattleHistory({round:2,boss:{id:'night-captain',owner:1},players:[{generalId:23},{generalId:23}],log:[
    row(2,'夜袭队长蓄势：（2,3）。','敌方'),
    row(2,'我方齐兰受到2点蓄势伤害。','敌方'),
    row(2,'我方齐兰攻击敌方夜袭队长。'),
    row(2,'敌方夜袭队长受到3点伤害。'),
    row(2,'齐兰 移动。')
  ]}).groups.flatMap(group=>group.events);
  assert.equal(events[0].sourceName,'夜袭队长');
  assert.equal(events[1].sourceName,'夜袭队长');assert.equal(events[1].targetName,undefined);
  assert.equal(events[2].sourceName,undefined);assert.equal(events[2].targetName,'夜袭队长');
  assert.equal(events[3].sourceName,undefined);
}
