import {
  applyAction, createGame, step, getWavePreview, getUnitStats,
  LEGION_DEFS, BUILDING_DEFS, CARD_DEFS, SPELL_DEFS, ENEMY_DEFS, HERO_DEFS,
  getShopTier, getMapDefinition, validatePlacement, validateBuildingPlacement,
} from './core/index';
import type {
  Action, BuildingKind, CardKind, GameState, HeroKind, LegionKind, Point, SpellKind,
} from './core/types';
import type { AssetManifest } from './assets-types';
import type { BattleRenderer, Insets, PlacementPreview } from './render/engine';
import { initPlatform, readSafeInsets, startupReady } from './platform';
import { loadRun, saveRun, startFreshRun, exportReplay, importReplay, loadProfile, observeRun, recordOutcome } from './storage';
import { icon } from './ui/icons';
import { installPortraits } from './ui/artwork';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const dialog = (id: string) => $<HTMLDialogElement>(id);
const button = (id: string) => $<HTMLButtonElement>(id);

type Tool = LegionKind | BuildingKind | HeroKind | 'move' | 'moveBuilding' | 'heal' | 'freeze';

const NAME: Record<string, string> = {
  shield: '盾卫', archer: '弓手', mage: '法师', spear: '枪兵', rider: '游骑',
  wall: '城墙', tower: '箭塔', slow: '减速地',
  engineer: '工程师', captain: '队长', ranger: '游侠',
  grunt: '掠夺者', siege: '攻城弩', flyer: '鸦骑', boss: '碎地者',
  healer: '巫医', armored: '重甲', splitter: '分裂体', raider: '突袭者',
  heal: '治疗', freeze: '定身',
};
for (const defs of [LEGION_DEFS, BUILDING_DEFS, HERO_DEFS, SPELL_DEFS]) {
  for (const [kind, def] of Object.entries(defs)) if (def) NAME[kind] = def.name;
}
const nameOf = (kind: string): string => NAME[kind] ?? kind;

const CARD_COPY: Record<string, string> = {
  giant: '生命 +60%，攻击 +35%。军团覆灭时消失。',
  deathBurst: '阵亡成员倒下时造成范围爆炸。军团覆灭时消失。',
  sharp: '攻击 +15%。团灭后可重新指派。',
  bounty: '每次击杀额外获得 2 金。团灭后可重新指派。',
};

/** 战场可拖动的兵种/建筑/英雄，按展示顺序。 */
const RECRUIT_ORDER: Tool[] = ['shield', 'archer', 'wall', 'tower', 'slow', 'engineer'];

let state: GameState = createGame(20261013);
let renderer: BattleRenderer | null = null;
let portraits: Record<string, string> = {};
let manifest: AssetManifest | null = null;
let ready = false;
let active = false;
let paused = false;
let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let previous = 0;
let accumulator = 0;
let noticeTimer = 0;
let blockedSave = false;
let confirmation: (() => void) | null = null;
let selected: number | null = null;
let tool: Tool | null = null;
let point: Point | null = null;
let validPoint = false;
let replayViewing = false;
let replayState: GameState | null = null;

/* ---------------------------------------------------------------- 安全区 */

function applySafeInsets(): Insets {
  const insets = readSafeInsets();
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    document.documentElement.style.setProperty(`--host-${side}`, `${insets[side]}px`);
  }
  renderer?.setInsets(insets);
  return insets;
}

/* ---------------------------------------------------------------- 基础 UI */

function notify(message: string, error = false): void {
  const node = $('notice');
  node.textContent = message;
  node.classList.toggle('error', error);
  node.classList.add('visible');
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => node.classList.remove('visible'), 2600);
}

function confirmAsk(title: string, copy: string, run: () => void): void {
  $('confirm-title').textContent = title;
  $('confirm-copy').textContent = copy;
  confirmation = run;
  if (!dialog('confirm').open) dialog('confirm').showModal();
}

function closeAll(): void {
  for (const d of document.querySelectorAll<HTMLDialogElement>('dialog')) if (d.open) d.close();
}

function currentWave(): number {
  const settled = state.phase === 'combat' || state.phase === 'won' || state.phase === 'lost';
  return Math.min(7, settled ? state.wave : state.wave + 1);
}

function persist(): void {
  if (replayViewing) return;
  const observed = observeRun(state);
  if (!observed.ok) notify(observed.message ?? '图鉴档案保存失败，原档已保留。', true);
  const saved = saveRun(state);
  if (!saved.ok) notify(saved.message ?? '本机保存失败，旧进度已保留。', true);
}

function act(action: Action): boolean {
  if (replayViewing) { notify('回放只供观看，请从菜单继续营地。'); return false; }
  const result = applyAction(state, action);
  if (!result.ok) { notify(result.message ?? '当前无法操作', true); return false; }
  persist();
  refresh();
  return true;
}

/* ---------------------------------------------------------------- 招募卡 */

function portraitFor(kind: string): HTMLImageElement | null {
  const url = portraits[kind];
  if (!url) return null;
  const image = document.createElement('img');
  image.className = 'portrait';
  image.src = url;
  image.alt = '';
  image.decoding = 'sync';
  return image;
}

function coinTag(amount: string): HTMLSpanElement {
  const wrap = document.createElement('span');
  wrap.className = 'product-price';
  const coin = icon('coin');
  coin.classList.add('ico');
  wrap.append(coin, document.createTextNode(amount));
  return wrap;
}

function buildRecruitCards(): void {
  const root = $('prep-tools');
  root.replaceChildren();
  for (const kind of RECRUIT_ORDER) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'product';
    card.dataset.tool = kind;
    card.setAttribute('aria-pressed', 'false');
    const picture = portraitFor(kind);
    if (picture) card.append(picture);
    const label = document.createElement('span');
    label.className = 'product-name';
    label.textContent = nameOf(kind);
    card.append(label, coinTag('0'));
    card.onclick = () => notify(`按住「${nameOf(kind)}」拖入战场落位`);
    root.append(card);
  }
}

function buildCombatTools(): void {
  const root = $('combat-tools');
  root.replaceChildren();
  for (const kind of ['heal', 'freeze'] as SpellKind[]) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pbtn spell-btn';
    card.dataset.spell = kind;
    card.setAttribute('aria-pressed', 'false');
    const picture = portraitFor(kind);
    if (picture) card.append(picture);
    const label = document.createElement('span');
    label.textContent = nameOf(kind);
    const count = document.createElement('b');
    count.textContent = '0';
    card.append(label, count);
    root.append(card);
  }
}

/* ---------------------------------------------------------------- 刷新 */

function refresh(): void {
  if (!ready) return;
  $('gold').textContent = String(Math.floor(state.gold));
  $('core-health').textContent = String(Math.max(0, Math.ceil(state.coreHp)));
  $('core-readout').classList.toggle('low', state.coreHp <= 30);
  $('wave').textContent = `${currentWave()} / 7`;
  $('prep-tools').hidden = state.phase !== 'prep';
  $('combat-tools').hidden = state.phase !== 'combat';
  const goButton = button('start-wave');
  goButton.hidden = state.phase !== 'prep';
  goButton.disabled = state.cardChoices.length > 0 || blockedSave || replayViewing;

  const tier = getShopTier(state.mapId, state.wave);
  for (const card of document.querySelectorAll<HTMLButtonElement>('#prep-tools [data-tool]')) {
    const kind = card.dataset.tool as Tool;
    const price = LEGION_DEFS[kind as LegionKind]?.price ?? BUILDING_DEFS[kind as BuildingKind]?.price ?? HERO_DEFS[kind as HeroKind]?.price ?? 0;
    const heroLocked = kind === 'engineer' && (tier < (HERO_DEFS.engineer?.shopTier ?? 2) || state.wave < (getMapDefinition(state.mapId).supply.engineer ?? Infinity));
    card.querySelector('.product-name')!.textContent = kind === 'engineer' ? '英雄' : nameOf(kind);
    card.querySelector('.product-price')!.replaceChildren(
      icon('coin'),
      document.createTextNode(heroLocked ? `${HERO_DEFS.engineer?.shopTier ?? 2}级开` : String(price)),
    );
    card.disabled = state.gold < price || (kind === 'engineer' && !!state.hero) || heroLocked || replayViewing;
    card.setAttribute('aria-pressed', String(tool === kind));
  }
  for (const card of document.querySelectorAll<HTMLButtonElement>('#combat-tools [data-spell]')) {
    const kind = card.dataset.spell as SpellKind;
    card.querySelector('b')!.textContent = String(state.spells[kind]);
    card.disabled = state.spells[kind] <= 0 || replayViewing;
    card.setAttribute('aria-pressed', String(tool === kind));
  }

  $('placement').hidden = !isSpellTool();
  renderContext();
  renderWaveEntry();
  renderCardChoices();
  updateShopLive();
  renderer?.draw(state);
  maybeFinish();
}

function maybeFinish(): void {
  if ((state.phase !== 'won' && state.phase !== 'lost') || !active) return;
  if (dialog('result').open) return;
  cancelTool();
  const outcome = replayViewing ? { ok: true } : recordOutcome(state);
  if (!outcome.ok) notify(outcome.message ?? '结果保存失败，旧档已保留。', true);
  const won = state.phase === 'won';
  $('result-title').textContent = won ? '营地守住了' : '营地失守';
  $('result-stats').textContent =
    `守住 ${state.stats.wavesCleared} 波 · 击败 ${state.stats.kills} 敌人 · 损失 ${state.stats.legionsLost} 军团 · 种子 ${state.seed}`;
  dialog('result').showModal();
}

/* ---------------------------------------------------------------- 选中面板 */

function meter(value: number, max: number, cls = ''): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = `meter ${cls}`.trim();
  if (cls === 'hp' && value / max <= 0.3) wrap.classList.add('low');
  else if (cls === 'hp' && value / max <= 0.6) wrap.classList.add('mid');
  const fill = document.createElement('i');
  fill.style.width = `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%`;
  wrap.append(fill);
  return wrap;
}

function renderContext(): void {
  const root = $('context');
  const legion = state.legions.find((l) => l.id === selected);
  const building = state.buildings.find((b) => b.id === selected);
  const item = legion ?? building;
  const wanted = tool || selected === null || state.phase !== 'prep' || !active || !item ? null : `${legion ? 'legion' : 'building'}:${item.id}`;
  // 同一对象的面板只原地更新；重建会销毁正在被拖动的滑块和其它焦点元素。
  if (wanted !== null && item && !root.hidden && root.dataset.for === wanted) {
    if (legion) {
      const xp = root.querySelector<HTMLElement>('[data-meter="xp"] > i');
      const xpReadout = root.querySelector<HTMLElement>('[data-readout="xp"]');
      const need = legion.tier * 10;
      if (xp) xp.style.width = `${Math.max(0, Math.min(100, (legion.xp / need) * 100))}%`;
      if (xpReadout) xpReadout.textContent = `${legion.xp}/${need}`;
      const price = legion.tier === 1 ? 70 : 150;
      const upgrade = root.querySelector<HTMLButtonElement>('[data-action="upgrade"]');
      if (upgrade) {
        upgrade.disabled = legion.tier === 3 || state.gold < price || getShopTier(state.mapId, state.wave) <= legion.tier || legion.xp < need;
      }
    } else if (building) {
      const hp = root.querySelector<HTMLElement>('[data-meter="hp"] > i');
      if (hp) hp.style.width = `${Math.max(0, Math.min(100, (building.hp / building.maxHp) * 100))}%`;
      const repair = root.querySelector<HTMLButtonElement>('[data-action="repair"]');
      if (repair) {
        const cost = Math.ceil((building.maxHp - building.hp) * BUILDING_DEFS[building.kind].repairRate);
        repair.textContent = cost > 0 ? `修满 · ${cost} 金` : '结构完好';
        repair.disabled = building.hp >= building.maxHp || state.gold < cost;
      }
    }
    positionContext(item.x, item.y);
    return;
  }
  root.replaceChildren();
  root.dataset.for = wanted ?? '';
  if (wanted === null) { root.hidden = true; if (!item && selected !== null) selected = null; return; }
  root.hidden = false;

  const head = document.createElement('div');
  head.className = 'context-head';
  const title = document.createElement('strong');
  title.textContent = legion ? nameOf(legion.kind) : nameOf(building!.kind);
  head.append(title);
  if (legion) {
    const tierChip = document.createElement('span');
    tierChip.className = 'context-chip tier';
    tierChip.textContent = `${legion.tier} 级`;
    head.append(tierChip);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pbtn icon-only';
  close.setAttribute('aria-label', '取消选中');
  close.append(icon('close'));
  close.onclick = () => select(null);
  head.append(close);
  root.append(head);

  if (legion) {
    const stats = getUnitStats(legion.kind, legion.tier);
    const info = document.createElement('div');
    info.className = 'bar-row';
    info.append(document.createTextNode(`${stats.count} 人 · 攻 ${stats.damage} · 甲 ${stats.armor} · 程 ${stats.range}`));
    root.append(info);

    const xpRow = document.createElement('div');
    xpRow.className = 'bar-row';
    const xpNeed = legion.tier * 10;
    const xpMeter = meter(legion.xp, xpNeed);
    xpMeter.dataset.meter = 'xp';
    const xpReadout = document.createElement('span');
    xpReadout.className = 'num';
    xpReadout.dataset.readout = 'xp';
    xpReadout.textContent = `${legion.xp}/${xpNeed}`;
    xpRow.append(document.createTextNode('经验'), xpMeter, xpReadout);
    root.append(xpRow);

    const price = legion.tier === 1 ? 70 : 150;
    const upgrade = document.createElement('button');
    upgrade.type = 'button';
    upgrade.className = 'pbtn';
    upgrade.dataset.action = 'upgrade';
    upgrade.textContent = legion.tier === 3 ? '已满级' : `晋升 · ${price} 金`;
    upgrade.disabled = legion.tier === 3 || state.gold < price || getShopTier(state.mapId, state.wave) <= legion.tier || legion.xp < xpNeed;
    upgrade.onclick = () => act({ type: 'upgradeLegion', id: legion.id });
    root.append(upgrade);

    const label = document.createElement('label');
    label.append(document.createTextNode('警戒'));
    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(Math.max(2, getUnitStats(legion.kind, legion.tier).range));
    range.max = '10';
    range.step = '.25';
    range.value = String(legion.alertRadius);
    range.setAttribute('aria-label', '警戒半径');
    const readout = document.createElement('span');
    readout.className = 'num';
    readout.textContent = legion.alertRadius.toFixed(1);
    range.oninput = () => {
      readout.textContent = Number(range.value).toFixed(1);
      renderer?.place({ point: { x: legion.x, y: legion.y }, valid: true, radius: Number(range.value), kind: legion.kind, tier: legion.tier, shape: 'legion' });
    };
    range.onchange = () => { act({ type: 'setRadius', id: legion.id, value: Number(range.value) }); renderer?.place(null); };
    label.append(range, readout);
    root.append(label);

    const assigned = legion.cardIds.map((id) => state.cards.find((c) => c.id === id)).filter((c) => !!c);
    if (assigned.length) {
      const text = document.createElement('small');
      text.textContent = `已挂：${assigned.map((c) => CARD_DEFS[c!.kind].name).join(' / ')}`;
      root.append(text);
    }
    const available = state.cards.filter((c) => c.carrier === null && CARD_DEFS[c.kind].scope !== 'global');
    if (available.length) {
      const row = document.createElement('div');
      row.className = 'card-assign';
      for (const card of available) {
        const assign = document.createElement('button');
        assign.type = 'button';
        assign.className = 'pbtn';
        assign.textContent = `挂 ${CARD_DEFS[card.kind].name}`;
        assign.onclick = () => act({ type: 'assignCard', cardId: card.id, legionId: legion.id });
        row.append(assign);
      }
      root.append(row);
    }
  } else {
    const target = building!;
    const hpRow = document.createElement('div');
    hpRow.className = 'bar-row';
    const hpMeter = meter(target.hp, target.maxHp, 'hp');
    hpMeter.dataset.meter = 'hp';
    hpRow.append(document.createTextNode('耐久'), hpMeter, document.createTextNode(`${Math.ceil(target.hp)}/${target.maxHp}`));
    root.append(hpRow);

    const cost = Math.ceil((target.maxHp - target.hp) * BUILDING_DEFS[target.kind].repairRate);
    const repair = document.createElement('button');
    repair.type = 'button';
    repair.className = 'pbtn';
    repair.dataset.action = 'repair';
    repair.textContent = cost > 0 ? `修满 · ${cost} 金` : '结构完好';
    repair.disabled = target.hp >= target.maxHp || state.gold < cost;
    repair.onclick = () => act({ type: 'repair', id: target.id });
    root.append(repair);

    const move = document.createElement('button');
    move.type = 'button';
    move.className = 'pbtn';
    move.textContent = '拖动可移位';
    move.disabled = true;
    root.append(move);
  }

  const anchor = item;
  if (!anchor) return;
  positionContext(anchor.x, anchor.y);
}

function positionContext(worldX: number, worldY: number): void {
  const root = $('context');
  if (root.hidden || !renderer) return;
  const insets = readSafeInsets();
  const screen = renderer.toScreen({ x: worldX, y: worldY });
  const gap = 28;
  const left = insets.left + 4;
  const right = innerWidth - insets.right - 4;
  const top = insets.top + 46;
  const bottom = Math.min(innerHeight - insets.bottom - 4, $('commands').getBoundingClientRect().top - 4);
  // 可用高度必须写回面板：否则短屏下面板会自己长高、伸进底部指令栏，
  // 里面的滑块会被压住点不到。面板自身 overflow-y:auto，超高时内部可滚动。
  const available = Math.max(96, bottom - top);
  root.style.width = `${Math.min(196, Math.max(150, (innerWidth - insets.left - insets.right) * 0.32))}px`;
  root.style.maxHeight = `${available}px`;
  const width = root.offsetWidth;
  const height = Math.min(root.offsetHeight, available);
  const candidates = [
    { x: screen.x - width - gap, y: screen.y - height / 2 },
    { x: screen.x + gap, y: screen.y - height / 2 },
    { x: screen.x - width / 2, y: screen.y - height - gap },
    { x: screen.x - width / 2, y: screen.y + gap },
  ].map((p) => ({
    x: Math.max(left, Math.min(right - width, p.x)),
    y: Math.max(top, Math.min(Math.max(top, bottom - height), p.y)),
  }));
  // 优先选遮挡选中对象最少的位置。
  const overlap = (p: Point) =>
    Math.max(0, Math.min(p.x + width, screen.x + 26) - Math.max(p.x, screen.x - 26)) *
    Math.max(0, Math.min(p.y + height, screen.y + 26) - Math.max(p.y, screen.y - 26));
  candidates.sort((a, b) => overlap(a) - overlap(b));
  root.style.left = `${candidates[0].x}px`;
  root.style.top = `${candidates[0].y}px`;
}

/* ---------------------------------------------------------------- 波次路线 */

function renderWaveEntry(): void {
  const root = $('wave-preview');
  root.replaceChildren();
  const waves = getWavePreview(state);
  const current = waves.find((w) => w.wave === currentWave()) ?? waves[0];
  if (!current) return;
  const entry = document.createElement('button');
  entry.type = 'button';
  entry.className = 'pbtn';
  entry.textContent = `路线 ${current.gates.map((i) => String.fromCharCode(65 + i)).join('')} · ${current.enemies.reduce((sum, e) => sum + e.count, 0)} 敌`;
  entry.onclick = () => {
    $('collection-title').textContent = '路线预告';
    const list = $('collection-content');
    list.replaceChildren();
    for (const wave of waves) {
      entryRow(list, `第 ${wave.wave} 波${wave.boss ? ' · 最终围攻' : ''}`,
        `${wave.gates.map((i) => `${String.fromCharCode(65 + i)} ${state.map.gates[i].label}`).join(' / ')}：` +
        `${wave.enemies.map((e) => `${nameOf(e.kind)} ×${e.count}`).join('，')} · 商店 ${wave.shopTier} 级`);
    }
    dialog('collection').showModal();
  };
  root.append(entry);
}

function entryRow(root: HTMLElement, title: string, description: string): void {
  const row = document.createElement('article');
  row.className = 'collection-entry';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = description;
  row.append(heading, copy);
  root.append(row);
}

/* ---------------------------------------------------------------- 奖励选择 */

function renderCardChoices(): void {
  if (replayViewing) return;
  const root = $('card-choices');
  if (!state.cardChoices.length) {
    if (dialog('cards').open) dialog('cards').close();
    return;
  }
  root.replaceChildren();
  for (const kind of state.cardChoices) {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'effect-choice';
    const picture = portraitFor('engineer');
    if (picture) {
      picture.className = 'portrait';
      choice.append(picture);
    }
    const heading = document.createElement('strong');
    heading.textContent = CARD_DEFS[kind].name;
    const copy = document.createElement('span');
    copy.textContent = CARD_COPY[kind] ?? '';
    choice.append(heading, copy);
    choice.onclick = () => {
      if (act({ type: 'chooseCard', kind: kind as CardKind })) {
        dialog('cards').close();
        notify(CARD_DEFS[kind].scope === 'global' ? `${CARD_DEFS[kind].name} 已全局生效。` : `选中军团即可挂上 ${CARD_DEFS[kind].name}`);
      }
    };
    root.append(choice);
  }
  if (active && !dialog('cards').open) dialog('cards').showModal();
}

/* ---------------------------------------------------------------- 商店 */

function showShop(): void {
  if (state.phase !== 'prep') return;
  cancelTool();
  const tier = getShopTier(state.mapId, state.wave);
  $('shop-title').textContent = `商店 · ${tier} 级 · ${Math.floor(state.gold)} 金`;
  const root = $('shop-items');
  const keepScroll = root.scrollTop;
  root.replaceChildren();

  interface Entry { kind: string; name: string; price: number; copy: string; tool?: Tool; buy?: () => void; disabled?: boolean }
  const entries: Entry[] = [];
  for (const [kind, def] of Object.entries(LEGION_DEFS)) {
    if (!def) continue;
    entries.push({
      kind, name: def.name, price: def.price, tool: kind as Tool,
      copy: kind === 'shield' ? '近战纵深，替后排挡弹道' : '远程圆形警戒，怕被贴身',
    });
  }
  for (const [kind, def] of Object.entries(BUILDING_DEFS)) {
    entries.push({
      kind, name: def.name, price: def.price, tool: kind as BuildingKind,
      copy: kind === 'wall' ? '可破坏墙体，拉长敌人行军' : kind === 'tower' ? '固定远程火力' : '踩过减速，不阻挡',
    });
  }
  for (const [kind, def] of Object.entries(HERO_DEFS)) {
    if (!def) continue;
    const locked = tier < def.shopTier || state.wave < (getMapDefinition(state.mapId).supply[kind] ?? Infinity);
    entries.push({
      kind, name: def.name, price: def.price, tool: kind as Tool, disabled: !!state.hero || locked,
      copy: locked ? `${def.shopTier} 级商店开放` : def.aura.target === 'building' ? '建筑攻速光环，波间自动修复' : '守军攻速光环',
    });
  }

  for (const item of entries) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'shop-card';
    card.dataset.dragTool = item.tool!;
    card.disabled = !!item.disabled || state.gold < item.price;
    card.setAttribute('aria-pressed', 'false');
    const picture = portraitFor(item.kind);
    if (picture) {
      picture.className = 'portrait';
      card.append(picture);
    }
    const head = document.createElement('span');
    head.className = 'shop-name';
    head.append(document.createTextNode(item.name));
    const price = document.createElement('span');
    price.className = 'shop-price num';
    price.append(icon('coin'), document.createTextNode(String(item.price)));
    head.append(price);
    const copy = document.createElement('span');
    copy.className = 'shop-desc';
    copy.textContent = item.copy;
    card.append(head, copy);
    card.onclick = () => notify(`按住「${item.name}」拖入战场`);
    root.append(card);
  }

  for (const [kind, def] of Object.entries(SPELL_DEFS)) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'shop-card';
    card.dataset.spell = kind;
    card.disabled = state.gold < def.price;
    const picture = portraitFor(kind);
    if (picture) {
      picture.className = 'portrait';
      card.append(picture);
    }
    const head = document.createElement('span');
    head.className = 'shop-name';
    head.append(document.createTextNode(def.name));
    const price = document.createElement('span');
    price.className = 'shop-price num';
    price.append(icon('coin'), document.createTextNode(String(def.price)));
    head.append(price);
    const copy = document.createElement('span');
    copy.className = 'shop-desc';
    copy.textContent = `${kind === 'heal' ? '恢复范围内守军' : '暂时定住全场敌军'} · 库存 ${state.spells[kind as SpellKind]}`;
    card.append(head, copy);
    card.onclick = () => {
      if (act({ type: 'buySpell', kind: kind as SpellKind })) notify(`已购买一次${def.name}`);
    };
    root.append(card);
  }

  $('shop-detail').textContent = tier === 1
    ? '基础补给每波可买；晋升要在更高商店兑现经验。按住商品拖到战场落位。'
    : `当前可晋升至 ${tier} 级：先点选场上的军团。`;

  updateShopLive();
  root.scrollTop = keepScroll;
  if (!dialog('shop').open) dialog('shop').showModal();
}

/**
 * 商店列表只在打开时构建一次，之后这里只原地更新价格、库存与可用状态。
 * 之前每帧重建整个列表会销毁正在被点击的按钮，并把滚动位置重置回顶部。
 */
function updateShopLive(): void {
  const tier = getShopTier(state.mapId, state.wave);
  for (const card of document.querySelectorAll<HTMLButtonElement>('#shop-items .shop-card')) {
    const kind = card.dataset.dragTool ?? card.dataset.spell;
    if (!kind) continue;
    if (card.dataset.dragTool) {
      const def = LEGION_DEFS[kind as LegionKind] ?? BUILDING_DEFS[kind as BuildingKind] ?? HERO_DEFS[kind as HeroKind];
      if (!def) continue;
      const locked = !!HERO_DEFS[kind as HeroKind]
        && (tier < HERO_DEFS[kind as HeroKind]!.shopTier || state.wave < (getMapDefinition(state.mapId).supply[kind] ?? Infinity));
      card.disabled = state.gold < def.price || (kind === 'engineer' && !!state.hero) || locked || replayViewing;
      const price = card.querySelector('.shop-price');
      if (price) price.lastChild!.textContent = String(def.price);
    } else if (card.dataset.spell) {
      const def = SPELL_DEFS[kind as SpellKind];
      if (!def) continue;
      card.disabled = state.gold < def.price || replayViewing;
      const copy = card.querySelector('.shop-desc');
      if (copy) {
        copy.textContent = `${kind === 'heal' ? '恢复范围内守军' : '暂时定住全场敌军'} · 库存 ${state.spells[kind as SpellKind]}`;
      }
    }
    card.setAttribute('aria-pressed', String(tool === kind));
  }
  const title = document.getElementById('shop-title');
  if (title) title.textContent = `商店 · ${tier} 级 · ${Math.floor(state.gold)} 金`;
}

// 商店滚动：商品自身是拖动源，所以留一条独立 44px 触控滚动带。
let shopScroll: { id: number; y: number; top: number } | null = null;
function bindShopScroll(): void {
  const rail = $('shop-scroll');
  const items = $('shop-items');
  rail.addEventListener('pointerdown', (event) => {
    shopScroll = { id: event.pointerId, y: event.clientY, top: items.scrollTop };
    rail.setPointerCapture(event.pointerId);
  });
  rail.addEventListener('pointermove', (event) => {
    if (shopScroll?.id === event.pointerId) items.scrollTop = shopScroll.top + shopScroll.y - event.clientY;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    rail.addEventListener(type, () => { shopScroll = null; });
  }
  rail.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') items.scrollTop += 40;
    if (event.key === 'ArrowUp') items.scrollTop -= 40;
  });
}

/* ---------------------------------------------------------------- 工具与放置 */

const isSpellTool = (): boolean => tool === 'heal' || tool === 'freeze';

function cancelTool(): void {
  tool = null;
  point = null;
  validPoint = false;
  renderer?.place(null);
  $('placement').hidden = true;
  refresh();
}

function select(id: number | null): void {
  selected = id;
  tool = null;
  point = null;
  renderer?.select(id);
  renderer?.place(null);
  refresh();
}

function chooseTool(kind: Tool): void {
  const isSpell = kind === 'heal' || kind === 'freeze';
  if (isSpell ? state.phase !== 'combat' : state.phase !== 'prep') return;
  tool = kind;
  point = isSpell && kind === 'freeze' ? { ...state.map.core } : null;
  validPoint = kind === 'freeze';
  renderer?.place(null);
  if (dialog('shop').open) dialog('shop').close();
  $('context').hidden = true;
  $('placement').hidden = !isSpell;
  $('placement-label').textContent = kind === 'freeze' ? '全场定身' : '治疗：点选范围';
  button('confirm-placement').disabled = kind !== 'freeze';
  refresh();
}

interface PlacementInfo { kind: string; tier: number; radius: number; legion: boolean }

function placementInfo(): PlacementInfo {
  const legion = tool === 'move' ? state.legions.find((l) => l.id === selected) : null;
  const building = tool === 'moveBuilding' ? state.buildings.find((b) => b.id === selected) : null;
  const kind = legion?.kind ?? building?.kind ?? (typeof tool === 'string' ? tool : '');
  const tier = legion?.tier ?? 1;
  const radius = legion?.alertRadius
    ?? ((Object.hasOwn(LEGION_DEFS, kind) ? Math.max(6, getUnitStats(kind as LegionKind, tier).range) : 0)
      || (Object.hasOwn(BUILDING_DEFS, kind) ? BUILDING_DEFS[kind as BuildingKind].range : 0)
      || (Object.hasOwn(HERO_DEFS, kind) ? HERO_DEFS[kind as HeroKind]!.aura.radius : 0)
      || (tool === 'heal' ? SPELL_DEFS.heal.radius : 0));
  return { kind, tier, radius, legion: !!legion };
}

function isLegal(p: Point): boolean {
  if (isSpellTool()) return p.x >= 0 && p.y >= 0 && p.x < state.map.width && p.y < state.map.height;
  const info = placementInfo();
  if (Object.hasOwn(BUILDING_DEFS, info.kind)) return validateBuildingPlacement(state, p, tool === 'moveBuilding' ? selected ?? undefined : undefined);
  const legionKind = Object.hasOwn(LEGION_DEFS, info.kind) ? info.kind as LegionKind : undefined;
  return validatePlacement(state, p, legionKind, info.tier);
}

function updatePoint(p: Point, usable = true): void {
  point = { x: Math.floor(p.x), y: Math.floor(p.y) };
  validPoint = usable && isLegal(point);
  const info = placementInfo();
  const anchored = Object.hasOwn(BUILDING_DEFS, info.kind) ? { x: point.x + 0.5, y: point.y + 0.5 } : point;
  const shape: PlacementPreview['shape'] = isSpellTool() ? 'spell' : Object.hasOwn(BUILDING_DEFS, info.kind) ? 'building' : 'legion';
  renderer?.place(tool === 'freeze' ? null : {
    point: anchored, valid: validPoint, radius: info.radius, kind: info.kind, tier: info.tier, shape,
    center: tool === 'heal' ? point : undefined,
  });
  button('confirm-placement').disabled = !validPoint;
  if (isSpellTool()) {
    $('placement-label').textContent = tool === 'freeze' ? '全场定身' : validPoint ? '治疗范围' : '不能施放于此处';
  }
}

function commitPoint(): void {
  if (!point || !tool || !validPoint) return;
  const p = point;
  const kind = tool;
  let action: Action | null = null;
  if (kind === 'move' || kind === 'moveBuilding') {
    if (selected === null) return;
    action = kind === 'move' ? { type: 'moveLegion', id: selected, ...p } : { type: 'moveBuilding', id: selected, ...p };
  } else if (kind === 'heal' || kind === 'freeze') {
    action = { type: 'castSpell', kind, ...p };
  } else if (Object.hasOwn(HERO_DEFS, kind)) {
    action = { type: 'buyHero', kind: kind as HeroKind, ...p };
  } else if (Object.hasOwn(LEGION_DEFS, kind)) {
    action = { type: 'buyLegion', kind: kind as LegionKind, ...p };
  } else if (Object.hasOwn(BUILDING_DEFS, kind)) {
    action = { type: 'buyBuilding', kind: kind as BuildingKind, ...p };
  }
  if (!action) return;
  if (act(action)) {
    cancelTool();
    if (action.type === 'buyLegion') select(state.legions.at(-1)?.id ?? null);
    else if (action.type === 'buyBuilding') select(state.buildings.at(-1)?.id ?? null);
  } else if (state.phase === 'prep') cancelTool();
}

/* ---------------------------------------------------------------- 输入 */

interface Drag {
  id: number;
  start: Point;
  last: Point;
  moved: boolean;
  mode: 'pan' | 'place' | 'spell';
  hit: number | null;
  /** true 表示这次拖动是从招募卡/商店卡按住的，不是从战场上的实体拖起的。 */
  fromCard: boolean;
  offset: Point;
  inside: boolean;
}
let drag: Drag | null = null;
const fingers = new Set<number>();
let gestureCancelled = false;

function cancelGesture(keepPointers = false): void {
  if (!keepPointers) { fingers.clear(); gestureCancelled = false; }
  drag = null;
  renderer?.place(null);
  if (tool && point) { point = null; validPoint = false; button('confirm-placement').disabled = true; }
  if (state.phase === 'prep' && tool !== 'move' && tool !== 'moveBuilding') tool = null;
}

function usableBattle(x: number, y: number): boolean {
  const insets = readSafeInsets();
  if (x < insets.left || x > innerWidth - insets.right || y < insets.top || y > innerHeight - insets.bottom) return false;
  if (document.querySelector('dialog[open]')) return false;
  for (const id of ['hud', 'commands', 'wave-preview', 'context', 'placement', 'notice']) {
    const node = $(id);
    if (node.hidden) continue;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return false;
  }
  return true;
}

function hitEntity(world: Point): { id: number; type: 'move' | 'moveBuilding'; anchor: Point; d: number } | null {
  if (!renderer) return null;
  const screen = renderer.toScreen(world);
  const distance = (p: Point) => {
    const q = renderer!.toScreen(p);
    return Math.hypot(q.x - screen.x, q.y - screen.y);
  };
  const candidates: { id: number; type: 'move' | 'moveBuilding'; anchor: Point; d: number }[] = [];
  for (const legion of state.legions) {
    const anchor = { x: legion.x + 0.5, y: legion.y + 0.5 };
    let best = distance(anchor);
    for (const unit of state.units) if (unit.legionId === legion.id) best = Math.min(best, distance({ x: unit.x + 0.5, y: unit.y + 0.5 }));
    if (best <= 24) candidates.push({ id: legion.id, type: 'move', anchor, d: best });
  }
  for (const building of state.buildings) {
    const d = distance(building);
    if (d <= 24) candidates.push({ id: building.id, type: 'moveBuilding', anchor: { x: building.x, y: building.y }, d });
  }
  return candidates.sort((a, b) => a.d - b.d)[0] ?? null;
}

function dragWorld(d: Drag, x: number, y: number): Point {
  const world = renderer!.toWorld(x, y);
  return d.hit === null || d.mode === 'spell' ? world : { x: world.x - d.offset.x, y: world.y - d.offset.y };
}

function attachInput(): void {
  // 只使用契约内的公开入口，不触碰渲染器内部字段。
  const surface = $('battlefield');

  document.addEventListener('pointerdown', (event) => {
    if (!active || paused || replayViewing) return;
    // 隐式指针捕获会把 pointerup 重定向到被捕获元素，document 级监听收不到，
    // 于是手指表会残留已松开的 pointerId，之后任何一次单指触摸都被误判为多指而全部失效。
    // 新手势开始时若上一次拖动已结束，就先清掉残留；真正并发的多指仍会被下面判为多指。
    if (fingers.has(event.pointerId)) return;
    if (!drag && fingers.size) fingers.clear();
    fingers.add(event.pointerId);
    if (fingers.size > 1) { gestureCancelled = true; cancelGesture(true); return; }
    if (gestureCancelled) return;
    const element = event.target as Element;
    const source = element.closest<HTMLButtonElement>('[data-tool],[data-drag-tool]');
    if (source && !source.disabled && state.phase === 'prep') {
      // 不要对界面元素自己 setPointerCapture：指针被夺到战场容器上后，浏览器
      // 不再为该按钮合成 click，购买与选择类操作会整体失效。卡片拖动走 document 级 move。
      const kind = (source.dataset.tool ?? source.dataset.dragTool) as Tool;
      chooseTool(kind);
      drag = {
        id: event.pointerId, start: { x: event.clientX, y: event.clientY }, last: { x: event.clientX, y: event.clientY },
        moved: false, mode: 'place', hit: null, fromCard: true, offset: { x: 0, y: 0 }, inside: false,
      };
      return;
    }
    if (document.querySelector('dialog[open]')) return;
    if (event.target !== surface && !surface.contains(event.target as Node)) return;
    // 这里刻意不做 setPointerCapture：把指针夺到战场容器上会让浏览器不再为
    // 被按下方的按钮合成 click，HUD 与商店按钮会整体点不动。拖图只靠 document 级
    // 监听，指针移出窗口的情况由下面的 window pointerup / blur 兜底结束手势。
    const world = renderer!.toWorld(event.clientX, event.clientY);
    const hit = hitEntity(world);
    const mode: Drag['mode'] = isSpellTool() ? 'spell' : state.phase === 'prep' && (tool || hit) ? 'place' : 'pan';
    if (mode === 'place' && hit) {
      selected = hit.id;
      renderer!.select(selected);
      tool = hit.type;
      $('context').hidden = true;
    }
    drag = {
      id: event.pointerId, start: { x: event.clientX, y: event.clientY }, last: { x: event.clientX, y: event.clientY },
      moved: false, mode, hit: hit?.id ?? null, fromCard: false,
      offset: hit ? { x: world.x - hit.anchor.x, y: world.y - hit.anchor.y } : { x: 0, y: 0 },
      inside: usableBattle(event.clientX, event.clientY),
    };
    if (hit) {
      // 军团按格落位，抓住格而不是像素，避免拖动时整体偏移。
      if (hit.type === 'move') {
        drag.offset = { x: Math.floor(world.x - hit.anchor.x), y: Math.floor(world.y - hit.anchor.y) };
      }
      // 建筑按格中心落位，抓到哪就落在哪，保留原有半格位置。
      else {
        drag.offset = { x: world.x - hit.anchor.x, y: world.y - hit.anchor.y };
      }
    }
    if (mode !== 'pan') updatePoint(dragWorld(drag, event.clientX, event.clientY), drag.inside);
  }, true);

  document.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId || gestureCancelled) return;
    const dx = event.clientX - drag.last.x;
    const dy = event.clientY - drag.last.y;
    if (Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) > 7) drag.moved = true;
    drag.inside = usableBattle(event.clientX, event.clientY);
    if (drag.mode === 'place' || drag.mode === 'spell') updatePoint(dragWorld(drag, event.clientX, event.clientY), drag.inside);
    else if (drag.moved) renderer!.pan(dx, dy);
    drag.last = { x: event.clientX, y: event.clientY };
    renderer!.draw(state);
  }, true);

  document.addEventListener('pointerup', (event) => {
    fingers.delete(event.pointerId);
    if (gestureCancelled) { if (!fingers.size) gestureCancelled = false; cancelGesture(true); return; }
    if (!drag || drag.id !== event.pointerId) return;
    const d = drag;
    drag = null;
    const inside = usableBattle(event.clientX, event.clientY);
    if (d.mode === 'spell') {
      if (inside) {
        updatePoint(renderer!.toWorld(event.clientX, event.clientY));
        // 定身是全场法术：落点合法即直接结算，不需要二次确认。
        if (validPoint && tool === 'freeze' && d.moved) commitPoint();
      }
      return;
    }
    if (d.mode === 'place') {
      // 从卡片按住拖出：松手落位即结算。从战场实体拖起：拖动才结算，未拖动只算选中。
      if (d.moved) {
        updatePoint(dragWorld(d, event.clientX, event.clientY), inside);
        if (inside && validPoint && fingers.size === 0) { commitPoint(); return; }
        renderer!.place(null);
        point = null;
        validPoint = false;
        if (d.fromCard) { tool = null; refresh(); } else select(d.hit);
        return;
      }
      // 未拖动：从卡片按住只是准备，从实体点按是选中。
      if (d.fromCard) return;
      point = null;
      validPoint = false;
      renderer!.place(null);
      select(d.hit);
      return;
    }
    if (!d.moved) {
      const hit = hitEntity(renderer!.toWorld(event.clientX, event.clientY));
      // 已选中的实体上再点一次即进入移位；否则点选对象。
      if (hit && tool === null && selected !== null && hit.id === selected) {
        tool = hit.type;
        point = null;
        refresh();
        notify(`按住即可把${nameOf(hit.type === 'move' ? state.legions.find((l) => l.id === hit.id)!.kind : state.buildings.find((b) => b.id === hit.id)!.kind)}移到别处`);
        return;
      }
      select(hit?.id ?? null);
    } else {
      renderContext();
    }
  }, true);

  document.addEventListener('pointercancel', (event) => {
    fingers.delete(event.pointerId);
    gestureCancelled = fingers.size > 0;
    cancelGesture(true);
    refresh();
  }, true);

  // 没有指针捕获，指针在窗口外松开时收不到 pointerup；用这些兜底结束手势，
  // 避免手指表残留导致之后所有单指操作被误判为多指。
  const abort = () => {
    if (!drag && !fingers.size) return;
    fingers.clear();
    gestureCancelled = false;
    cancelGesture(true);
    refresh();
  };
  window.addEventListener('blur', abort);
  document.addEventListener('visibilitychange', () => { if (document.hidden) abort(); });

  surface.addEventListener('lostpointercapture', (event) => {
    if (drag?.id === event.pointerId) { fingers.delete(event.pointerId); cancelGesture(); refresh(); }
  });
  surface.addEventListener('dblclick', (event) => {
    if (active && !tool) renderer!.toggleZoom(renderer!.toWorld(event.clientX, event.clientY));
  });
}

/* ---------------------------------------------------------------- 主循环 */

function frame(time: number): void {
  requestAnimationFrame(frame);
  if (!ready || !active || paused || document.hidden || document.querySelector('dialog[open]')) {
    previous = 0;
    accumulator = 0;
    return;
  }
  if (!previous) previous = time;
  accumulator += Math.min(200, time - previous);
  previous = time;
  const oldPhase = state.phase;
  const oldWave = state.wave;
  if (state.phase === 'combat') {
    while (accumulator >= 1000 / 30) {
      step(state);
      accumulator -= 1000 / 30;
      if (state.phase !== 'combat') break;
    }
  } else {
    accumulator = 0;
  }
  if (oldPhase !== state.phase || oldWave !== state.wave) {
    persist();
    refresh();
    return;
  }
  renderer?.draw(state);
  $('gold').textContent = String(Math.floor(state.gold));
  $('core-health').textContent = String(Math.max(0, Math.ceil(state.coreHp)));
}

/* ---------------------------------------------------------------- 局管理 */

function applyState(next: GameState): void {
  state = next;
  selected = null;
  tool = null;
  point = null;
  active = true;
  paused = false;
  accumulator = 0;
  previous = 0;
  closeAll();
  renderer?.select(null);
  renderer?.place(null);
  renderer?.focusCamp(state);
}

function reset(seed: number): void {
  try {
    applyState(startFreshRun(seed));
    blockedSave = false;
    replayViewing = false;
    replayState = null;
    persist();
    refresh();
    notify(`新营地已建立 · 种子 ${seed}`);
  } catch (error) {
    notify(error instanceof Error ? error.message : '新局未能建立，旧进度已保留。', true);
  }
}

function goHome(): void {
  paused = true;
  active = false;
  cancelTool();
  closeAll();
  const saved = loadRun();
  button('continue-game').disabled = !ready || !saved.state;
  dialog('home').showModal();
}

function startWave(): void {
  cancelTool();
  select(null);
  persist();
  if (act({ type: 'startWave' })) { previous = 0; accumulator = 0; }
}

/* ---------------------------------------------------------------- 面板绑定 */

function bindShell(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((node) => {
    node.onclick = () => dialog(node.dataset.close!).close();
  });

  button('settings').onclick = () => {
    if (active) { paused = true; accumulator = 0; previous = 0; cancelGesture(); }
    if (!dialog('pause').open) dialog('pause').showModal();
  };
  button('resume').onclick = () => {
    paused = false;
    previous = 0;
    accumulator = 0;
    dialog('pause').close();
    refresh();
  };
  dialog('pause').addEventListener('cancel', (event) => { event.preventDefault(); button('resume').click(); });
  dialog('cards').addEventListener('cancel', (event) => event.preventDefault());

  button('mute').onclick = () => {
    // 音效本次未接入；按钮如实反映"未接入"，不假装有声音开关。
    notify('本版本尚未接入音效，开关暂不生效。');
  };
  button('motion').onclick = () => {
    reducedMotion = !reducedMotion;
    if (renderer) renderer.reduced = reducedMotion;
    document.body.classList.toggle('reduce-motion', reducedMotion);
    button('motion').textContent = `动效：${reducedMotion ? '减弱' : '开'}`;
    button('motion').setAttribute('aria-pressed', String(reducedMotion));
  };
  button('fit-map').onclick = () => { renderer?.fit(); dialog('pause').close(); paused = false; previous = 0; refresh(); };
  button('restart-seed').onclick = () => confirmAsk('重开本种子', '当前营地将重新开始；已保存进度会先备份。', () => reset(state.seed));
  button('back-home').onclick = goHome;
  button('result-home').onclick = goHome;

  button('zoom-map').onclick = () => {
    renderer?.toggleZoom({ x: state.map.width / 2, y: state.map.height / 2 });
    const node = button('zoom-map');
    const zoomed = node.getAttribute('aria-pressed') !== 'true';
    node.setAttribute('aria-pressed', String(zoomed));
    node.setAttribute('aria-label', zoomed ? '查看全景' : '放大地图');
    renderContext();
  };
  button('overview-map').onclick = () => {
    const node = button('overview-map');
    if (node.getAttribute('aria-pressed') !== 'true') { renderer?.fit(); node.setAttribute('aria-pressed', 'true'); }
    else { renderer?.focusCamp(state); node.setAttribute('aria-pressed', 'false'); }
    renderContext();
  };
  button('start-wave').onclick = () => {
    if (state.phase !== 'prep') return;
    if (!state.legions.length && !state.buildings.length) {
      confirmAsk('空营地开战？', '当前没有守军，敌人会直接威胁营地。', startWave);
      return;
    }
    startWave();
  };
  button('open-shop').onclick = showShop;
  button('confirm-placement').onclick = commitPoint;
  button('cancel-placement').onclick = cancelTool;
  button('open-replay').onclick = showReplay;

  document.querySelectorAll<HTMLButtonElement>('[data-spell]').forEach((node) => {
    node.onclick = () => chooseTool(node.dataset.spell as SpellKind);
  });

  button('new-game').onclick = () => {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    confirmAsk('新建营地', blockedSave ? '现有档案无法继续。先完整备份旧档，备份成功后才建立新营地。' : '将使用新种子开始，旧进度会先备份。', () => reset(seed));
  };
  button('seed-game').onclick = () => {
    const seed = Number($<HTMLInputElement>('seed').value);
    if (!Number.isSafeInteger(seed) || seed < 1 || seed > 4294967295) {
      $('home-error').textContent = '请输入 1 到 4294967295 之间的整数。';
      return;
    }
    confirmAsk('按种子开局', '同种子与同样操作可重现相同战局。', () => reset(seed));
  };
  button('continue-game').onclick = () => {
    const saved = loadRun();
    if (!saved.state) { $('home-error').textContent = saved.error ?? '没有可继续的营地。'; return; }
    applyState(saved.state);
    replayViewing = false;
    refresh();
  };
  button('again').onclick = () => reset(crypto.getRandomValues(new Uint32Array(1))[0] || 1);
  button('confirm-no').onclick = () => { confirmation = null; dialog('confirm').close(); };
  button('confirm-yes').onclick = () => {
    const run = confirmation;
    confirmation = null;
    dialog('confirm').close();
    run?.();
  };

  // 图鉴与记录在暂停面板里按需生成，不在 HTML 里占位。
  const pauseActions = document.querySelector('#pause .sheet-actions');
  if (pauseActions) {
    const codex = document.createElement('button');
    codex.type = 'button';
    codex.className = 'pbtn block';
    codex.textContent = '图鉴';
    codex.onclick = showCodex;
    const records = document.createElement('button');
    records.type = 'button';
    records.className = 'pbtn block';
    records.textContent = '记录';
    records.onclick = showAchievements;
    pauseActions.append(codex, records);
  }
}

function showCodex(): void {
  $('collection-title').textContent = '图鉴';
  const root = $('collection-content');
  root.replaceChildren();
  for (const [kind, def] of Object.entries(LEGION_DEFS)) {
    if (!def) continue;
    const tier = def.tiers[0];
    entryRow(root, def.name, `${tier.count} 人 · 攻击 ${tier.damage} · 护甲 ${tier.armor} · 射程 ${tier.range}；${kind === 'shield' ? '前排承压，纵深站位' : '远程覆盖，分散避开溅射'}`);
  }
  for (const [kind, def] of Object.entries(ENEMY_DEFS)) {
    if (!def) continue;
    entryRow(root, nameOf(kind), `生命 ${def.hp} · 护甲 ${def.armor} · ${def.fly ? '无视地面阻挡' : '地面寻路'} · 漏怪伤害 ${def.leakDamage}`);
  }
  for (const [kind, def] of Object.entries(CARD_DEFS)) entryRow(root, def.name, CARD_COPY[kind] ?? '');
  dialog('collection').showModal();
}

function showAchievements(): void {
  $('collection-title').textContent = '记录';
  const root = $('collection-content');
  root.replaceChildren();
  const latest = loadProfile().profile;
  entryRow(root, '营地记录', `守护 ${latest.stats.runs} 次 · 胜利 ${latest.stats.wins} 次 · 最远守住 ${latest.stats.maxWave} 波 · 击败 ${latest.stats.kills} 敌人`);
  entryRow(root, '已遭遇敌人', latest.discovered.length ? latest.discovered.map(nameOf).join('、') : '尚未遭遇');
  for (const run of latest.history) entryRow(root, run.result === 'won' ? '守护成功' : '营地失守', `种子 ${run.seed} · 第 ${run.wave} 波 · 击败 ${run.kills} 敌人`);
  dialog('collection').showModal();
}

function showReplay(): void {
  $('collection-title').textContent = '回放';
  const root = $('collection-content');
  root.replaceChildren();
  entryRow(root, '本次动作', `种子 ${state.seed} · ${state.actions.length} 次操作 · ${state.rulesVersion}`);
  const text = document.createElement('textarea');
  text.setAttribute('aria-label', '回放数据');
  text.value = exportReplay(state);
  root.append(text);
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'pbtn';
  copy.textContent = '复制回放';
  copy.onclick = () => {
    void navigator.clipboard?.writeText(text.value).then(() => notify('回放已复制')).catch(() => { text.select(); notify('请手动选择并复制'); });
  };
  const load = document.createElement('button');
  load.type = 'button';
  load.className = 'pbtn accent';
  load.textContent = '载入并观看';
  load.onclick = () => confirmAsk('观看回放', '当前进度保持原样；结束观看可从菜单继续营地。', () => {
    try {
      replayState = importReplay(text.value);
      applyState(replayState);
      replayViewing = true;
      refresh();
      notify('回放已重现');
    } catch (error) {
      notify(error instanceof Error ? error.message : '回放不能读取', true);
    }
  });
  root.append(copy, load);
  dialog('collection').showModal();
}

/* ---------------------------------------------------------------- 启动 */

async function boot(): Promise<void> {
  dialog('home').showModal();
  try {
    const response = await fetch('./assets/manifest.json');
    if (!response.ok) throw new Error('素材清单无法读取。');
    manifest = (await response.json()) as AssetManifest;
    if (!manifest.units || Object.keys(manifest.units).length === 0) throw new Error('素材清单里没有可用单位。');
    portraits = await installPortraits(manifest, { width: 44, trim: true });
    buildRecruitCards();
    buildCombatTools();
    bindShell();
    bindShopScroll();
    applySafeInsets();

    const { BattleRenderer: Engine } = await import('./render/engine');
    renderer = new Engine($('battlefield'), manifest);
    const progress = $('boot-progress');
    await renderer.init((loaded: number, total: number) => {
      progress.textContent = total > 0 ? `正在载入素材… ${loaded}/${total}` : '正在载入素材…';
    });
    progress.textContent = '';
    progress.hidden = true;
    renderer.setInsets(readSafeInsets());
    renderer.reduced = reducedMotion;
    attachInput();
    ready = true;

    const saved = loadRun();
    blockedSave = !!saved.error && !saved.state;
    button('continue-game').disabled = !saved.state;
    if (blockedSave) button('new-game').textContent = '备份旧档后新建';
    $('home-error').textContent = saved.error ?? '';
    startupReady();
    document.body.classList.toggle('reduce-motion', reducedMotion);
    button('motion').textContent = `动效：${reducedMotion ? '减弱' : '开'}`;
    button('motion').setAttribute('aria-pressed', String(reducedMotion));
    renderer.draw(state);
    requestAnimationFrame(frame);
  } catch (error) {
    const message = $('home-error');
    message.textContent = error instanceof Error ? error.message : '必要素材未准备完成。';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'pbtn';
    retry.textContent = '重试';
    retry.onclick = () => void boot();
    message.append(retry);
  }
}

document.addEventListener('pointerdown', () => { /* 预留：本次未接入音频。 */ }, { once: true });
window.addEventListener('resize', () => { applySafeInsets(); renderer?.resize(); renderContext(); });
window.addEventListener('orientationchange', () => { applySafeInsets(); cancelGesture(); renderer?.resize(); });
initPlatform(() => {
  if (!active) return;
  paused = true;
  accumulator = 0;
  previous = 0;
  cancelGesture();
  if (!dialog('pause').open && !dialog('result').open) dialog('pause').showModal();
});

// 成就入口挂在首页按钮之外，由暂停面板的"记录"按钮触发。
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && active && !dialog('confirm').open) button('settings').click();
});

Object.defineProperty(window, '__deepseekGuardians', {
  value: {
    snapshot: () => ({
      phase: state.phase, wave: state.wave, gold: state.gold, coreHp: state.coreHp,
      legions: state.legions.map((l) => ({ id: l.id, kind: l.kind, tier: l.tier, x: l.x, y: l.y })),
      buildings: state.buildings.map((b) => ({ id: b.id, kind: b.kind, x: b.x, y: b.y })),
      members: state.units.filter((u) => u.legionId !== null).map((u) => ({ id: u.id, legionId: u.legionId, x: u.x, y: u.y })),
      enemies: state.units.filter((u) => u.team === 'enemy').map((u) => ({ id: u.id, kind: u.kind, x: u.x, y: u.y, hp: u.hp })),
      /** 当前存活的特效（弹道/命中/法术），用于核对战斗表现是否真的在跑。 */
      effects: state.effects.map((e) => ({ kind: e.kind, x: e.x, y: e.y, toX: e.toX ?? null, toY: e.toY ?? null, age: state.tick - e.born })),
      /** 战斗中受伤的敌人数量，用来判断受击表现是否有触发机会。 */
      hurtEnemies: state.units.filter((u) => u.team === 'enemy' && u.lastHurtTick > state.tick - 10).length,
      stats: { kills: state.stats.kills, leaked: state.stats.leaked, wavesCleared: state.stats.wavesCleared },
      tool, selected, paused, ready, portraits: Object.keys(portraits).length,
      input: {
        fingers: fingers.size, gestureCancelled, dialogOpen: !!document.querySelector('dialog[open]'),
        dragging: drag ? { mode: drag.mode, moved: drag.moved, inside: drag.inside } : null,
        usableAt: (x: number, y: number) => usableBattle(x, y),
      },
    }),
    screenPoint: (p: Point) => renderer?.toScreen(p) ?? null,
    /** 渲染层诊断：素材告警与地形缓存采样，用于定位"地图是黑的"这类问题。 */
    renderDebug: () => {
      const engine = renderer as unknown as {
        warnings?: readonly string[];
        groundDebug?: (x: number, y: number) => Record<string, unknown>;
      } | null;
      return {
        warnings: engine?.warnings ? [...engine.warnings] : null,
        ground: engine?.groundDebug ? engine.groundDebug(13, 10) : null,
      };
    },
    select,
    showAchievements,
  },
});

void boot();
