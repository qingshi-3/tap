import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARCHETYPES, BOSSES, ENEMIES, FX, ICONS, LEGENDS, PARTICLE_TEX, SKILLS} from '../js/data.js';
import * as S from '../js/sim.js';
import {command, createBattle, runHeadless, step} from '../js/battle.js';

const manifest = JSON.parse(readFileSync(new URL('../assets/duelyst/assets/manifest.json', import.meta.url)));

test('引用的单位、特效、图标都在裁剪后的素材清单里', () => {
  const units = [...ARCHETYPES, ...LEGENDS, ...Object.values(ENEMIES), ...BOSSES].map(x => x.unit);
  for (const u of units) assert.ok(manifest.units[u]?.actions?.idle, `缺少单位 ${u}`);
  for (const [k, f] of Object.entries(FX)) if (f.sprite) assert.ok(manifest.effects[f.sprite], `缺少特效 ${k}`);
  for (const t of Object.values(PARTICLE_TEX)) assert.ok(manifest.effects[t]);
  for (const s of Object.values(SKILLS)) {
    assert.ok(manifest.icons[s.icon], `缺少图标 ${s.name}`);
    assert.ok(FX[s.fx], `技能 ${s.name} 的特效键 ${s.fx} 未登记`);
  }
  for (const i of Object.values(ICONS)) assert.ok(manifest.icons[i]);
});

test('战斗可确定性重放且必然结束', () => {
  const st = S.newGame(7);
  const q = st.quests[0];
  for (const m of st.members) S.toggleAssign(st, q.id, m.id);
  const a = runHeadless(createBattle(S.battleSetup(st, q, 99, true)));
  const b = runHeadless(createBattle(S.battleSetup(st, q, 99, true)));
  assert.deepEqual(a, b);
  assert.ok(a.duration <= 60000);
});

test('督战打断能阻止首领大招', () => {
  const st = S.newGame(3);
  const q = {enemies: [{boss: 'kron', level: 6}]};
  const b = createBattle({allies: S.allySpecs(st, st.members.map(m => m.id)), enemies: S.questEnemies(q), seed: 5});
  let interrupted = false;
  while (!b.over) {
    step(b, 50);
    if (command(b, 'interrupt')) interrupted = true;
  }
  assert.ok(interrupted);
  assert.ok(!b.log.some(e => e.type === 'ultimate') || b.points === 0);
});

test('派遣、结算、抽成分账与升级', () => {
  const st = S.newGame(11);
  const q = st.quests.find(x => x.tier === 0) || st.quests[0];
  const ids = st.members.map(m => m.id);
  for (const id of ids) assert.equal(S.toggleAssign(st, q.id, id), null);
  const gold0 = st.gold;
  const results = S.prepareNight(st).map(({questId, seed}) => ({questId, summary: {winner: 'A', duration: 9000, allies: ids.map(memberId => ({memberId, alive: true})), bossKilled: false}}));
  const report = S.resolveNight(st, results);
  assert.equal(st.day, 2);
  assert.ok(report.battles[0].won);
  assert.ok(st.gold > gold0);
  assert.ok(st.members.every(m => m.savings > 0 && m.awayUntil === 1 + q.days));
  assert.ok(!st.quests.includes(q));
});

test('招募、扩建与宿舍上限', () => {
  const st = S.newGame(21);
  st.gold = 5000;
  while (st.members.length < S.dormCap(st)) {
    if (!st.visitors.length) S.refreshVisitors(st);
    assert.equal(S.recruit(st, st.visitors[0].id), null);
  }
  if (!st.visitors.length) { st.visitors = []; S.refreshVisitors(st); }
  assert.match(S.recruit(st, st.visitors[0].id), /宿舍/);
  assert.match(S.build(st, 'dorm'), /需要公会达到 E/);
  st.rank = 'E';
  st.mats = 50;
  assert.equal(S.build(st, 'dorm'), null);
  assert.equal(S.dormCap(st), 8);
  assert.match(S.build(st, 'dorm'), /需要公会达到 D/);
});
