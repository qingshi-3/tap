import assert from 'node:assert/strict';
import { appendBattleLog, BATTLE_HISTORY_LIMIT } from '../dist/js/battle-history-log.js';
import { attackUnit, castSpell, endTurn, findGeneral, restoreMatch, validateMatch } from '../dist/js/engine.js';
import { campaignMatch, makeUnit, blankMatch } from './battle-fixture.mjs';
import { ICE_SHARD_ID } from '../dist/js/boss-mechanics.js';

// Resolved damage is authoritative: frost armor must not claim the printed hit.
const boss = campaignMatch({ levelId: 'frost-03' });
const queen = findGeneral(boss, 1);
const striker = makeUnit(14, 0, queen.x, queen.y - 1, 900, { attack: 6, health: 20, maxHealth: 20 });
boss.units.push(striker);
assert.ok(attackUnit(boss, striker.unitId, queen.unitId));
assert.ok(boss.log.some(row => row.includes('霜甲') && row.includes('6点伤害减至1点')));
assert.ok(boss.log.some(row => row.includes('敌方') && row.includes('受到1点伤害')));
assert.ok(!boss.log.some(row => row.includes('6 点伤害')));

// Telegraphs, frozen targets, empty-cell spawns and phase announcements survive saving.
const marked = campaignMatch({ levelId: 'frost-03' });
assert.ok(endTurn(marked, 0)); assert.ok(endTurn(marked, 1));
assert.ok(marked.log.some(row => row.includes('冰封：标记') && row.includes('敌方')));
assert.ok(endTurn(marked, 0));
assert.ok(marked.log.some(row => row.includes('冰封伤害')));
assert.ok(marked.log.some(row => row.includes('冻结')));
assert.ok(validateMatch(marked));
assert.deepEqual(restoreMatch(JSON.parse(JSON.stringify(marked))).log, marked.log);

// Actual healing, rather than the spell's maximum, is recorded.
const healing = blankMatch({ heroId: 23, mana: 9 });
const ally = makeUnit(14, 0, 1, 2, 901, { health: 3 });
healing.units.push(ally); healing.players[0].hand = [20043];
assert.ok(castSpell(healing, 0, ally.unitId));
assert.ok(healing.log.some(row => row.includes('恢复1点生命')));
assert.ok(!healing.log.some(row => row.includes('恢复5点生命')));

// Ordinary draws never expose an opponent's hidden card; history is bounded.
const privacy = campaignMatch();
privacy.log = [];
assert.ok(endTurn(privacy, 0));
assert.ok(!privacy.log.some(row => /抽到|手牌：/.test(row)));
const history = { round: 3, currentPlayer: 1, log: ['历史无前缀记录'] };
for (let n = 0; n < BATTLE_HISTORY_LIMIT + 10; n++) appendBattleLog(history, `行动${n}`);
assert.equal(history.log.length, BATTLE_HISTORY_LIMIT);
assert.ok(history.log.at(-1).startsWith('第3回合 · 敌方｜'));
assert.equal(history.log.at(-1), `第3回合 · 敌方｜行动${BATTLE_HISTORY_LIMIT + 9}`);
const rounds = { round: 3, currentPlayer: 0, log: ['第1回合 · 我方｜旧', '第2回合 · 敌方｜前', '历史无前缀记录'] };
appendBattleLog(rounds, '今');
assert.deepEqual(rounds.log, ['第2回合 · 敌方｜前', '第3回合 · 我方｜今']);
assert.equal(queen.health, 21);
assert.ok(marked.units.some(unit => unit.cardId === ICE_SHARD_ID));
console.log('Battle history passed: actual armor damage/healing, boss telegraph/freeze, bounded retention, hidden-draw privacy and saved-history round trip.');
