const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
if (args.length !== 1 || !['--check', '--write'].includes(args[0])) {
  console.error('Usage: node tools/duelyst-library-sync.cjs --check | --write');
  process.exit(2);
}

const root = path.resolve(__dirname, '../assets/duelyst-library');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const readJSON = relative => JSON.parse(read(relative));
const sections = {unit:'单位', fx:'特效', icon:'图标'};
const assets = {};
const ids = {};

function requireFile(folder, relative) {
  const base = path.join(root, folder);
  const filename = path.resolve(base, relative);
  assert(filename.startsWith(base + path.sep), 'Unexpected asset path: ' + relative);
  assert(fs.statSync(filename).isFile(), 'Missing asset: ' + relative);
}

for (const [type, folder] of Object.entries(sections)) {
  const records = readJSON(folder + '/index.json');
  assets[type] = records;
  ids[type] = new Set(records.map(record => record.id));
  assert.equal(ids[type].size, records.length, 'Duplicate ID in ' + folder);
  for (const record of records) {
    if (record.preview) requireFile(folder, record.preview);
    for (const motion of Object.values(record.actions || {})) requireFile(folder, motion.path);
  }
}

function verifyRef({type, id}) {
  assert(ids[type]?.has(id), 'Unknown asset: ' + type + '/' + id);
}

const original = readJSON('原作关系.json');
for (const record of original) {
  for (const ref of record.assets) verifyRef(ref);
}

const identity = ({type, id, card, event}) => JSON.stringify([type, id, card, event]);
const originalEvents = readJSON('原作事件索引.json');
const eventKeys = new Set(originalEvents.map(identity));
assert.equal(eventKeys.size, originalEvents.length, 'Duplicate original event');
for (const record of originalEvents) {
  verifyRef(record);
  for (const layer of record.layers) verifyRef({type:'fx', id:layer.id});
}

for (const name of ['frames', 'recipes', 'followup', 'particles', 'engine', 'casters']) {
  require(path.join(root, '合成', name + '.js'));
}

const coverage = [];
const groups = [[], [], []];
const reasonCounts = new Map();
const recipeKeys = new Set();
for (const record of CompositeRecipes.events) {
  const key = identity(record);
  assert(!recipeKeys.has(key), 'Duplicate recipe: ' + key);
  recipeKeys.add(key);
  verifyRef(record);

  const scene = CompositeEngine.plan(record);
  if (!scene) continue;
  for (const draw of scene.draws) {
    if (draw.type === 'Light') assert(draw.conf.type === 'Light' && draw.clip == null && draw.ms > 0);
    else requireFile('合成', draw.clip.path);
    const position = draw.place(0);
    assert(Number.isFinite(draw.start) && Number.isFinite(position.x) && Number.isFinite(position.y));
  }
  assert(Number.isFinite(scene.end) && Number.isFinite(scene.impact));
  const {type, id, card, event, fxKey} = record;
  coverage.push({type, id, card, event, fxKey, status:scene.notes.length ? 'partial' : 'full'});
  if (!scene.notes.length) continue;

  const missing = scene.notes.filter(note => note.endsWith('未渲染'));
  const other = scene.notes.filter(note => !missing.includes(note));
  const reasons = new Set(scene.notes.map(note => note.endsWith('未渲染')
    ? note.split(' · ')[0] + ' 图层待绘制'
    : note.replace(/^\S+ 含引擎专用渲染参数/, '含引擎专用渲染参数')));
  for (const reason of reasons) reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  const onlyCleanup = other.every(note => note.startsWith('施法挂灯') || note.startsWith('出牌时顶层 Light'));
  const query = new URLSearchParams({type, id, card, event});
  const link = '[播放](合成预览.html?' + query + ')';
  const tableRow = [card + ' · ' + id, event, missing.join('；') || '—', other.join('；') || '—',
    [...new Set(scene.draws.map(draw => draw.key))].join('、'), link];
  groups[missing.length ? 0 : onlyCleanup ? 2 : 1].push('| ' + tableRow.join(' | ') + ' |');
}
for (const key of eventKeys) assert(recipeKeys.has(key), 'Missing recipe: ' + key);

const partial = groups.reduce((count, group) => count + group.length, 0);
const report = ['# 部分合成逐项核对',
  '共 ' + coverage.length + ' 条可播放事件，其中 ' + (coverage.length - partial) + ' 条已按事件配方合成，' + partial + ' 条为部分合成。每条以来源卡牌、素材和事件计数。',
  '## 还缺什么',
  ['| 原因（同一条可涉及多项） | 事件数 |', '|---|---:|',
    ...[...reasonCounts].sort((a, b) => b[1] - a[1]).map(([reason, count]) => '| ' + reason + ' | ' + count + ' |')].join('\n'),
  '下表按事件分为三个互斥组，点击「播放」可查看对应事件。[查看已补光照的事件](动态光照.html)'];
const titles = ['至少一层未绘制', '图层已绘制，播放方式仍有简化', '只缺对局中下一步动作的时间'];
groups.forEach((group, index) => report.push('## ' + titles[index] + '（' + group.length + ' 条）',
  ['| 卡牌 · 素材 ID | 事件 | 未渲染节点 | 播放提示 | 已绘制资源键 | 预览 |',
    '|---|---|---|---|---|---|', ...group].join('\n')));

const outputs = [
  ['H5/data.js', 'DUELYST_DATA', {assets, original}],
  ['H5/original-events.js', 'DuelystOriginalEvents', originalEvents],
  ['合成/coverage.js', 'CompositeCoverage', coverage],
  ['部分合成逐项明细.md', null, report.join('\n\n') + '\n']
];

for (const [relative, globalName, contents] of outputs) {
  const filename = path.join(root, relative);
  if (fs.existsSync(filename)) {
    if (globalName) {
      try {
        require(filename);
        assert.deepEqual(globalThis[globalName], contents);
        continue;
      } catch (error) {
        if (args[0] === '--check') throw new Error(relative + ' is out of sync', {cause:error});
      }
    } else if (read(relative) === contents) {
      continue;
    }
  }
  assert.equal(args[0], '--write', relative + ' is out of sync. Run with --write.');
  const text = globalName ? 'globalThis.' + globalName + '=' + JSON.stringify(contents) + ';\n' : contents;
  fs.writeFileSync(filename + '.tmp', text);
  fs.renameSync(filename + '.tmp', filename);
  console.log('Updated ' + relative);
}
console.log('Checked ' + coverage.length + ' event previews, ' + partial + ' partial.');
