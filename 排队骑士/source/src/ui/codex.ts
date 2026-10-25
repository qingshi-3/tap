// 图鉴：左侧图标砖、右侧详情（大图标 + 一句话 + 实机演示）。单位页沿用卡面网格。
import '../qb/css/unit-browser.css';
import '../qb/css/codex-search.css';
import '../qb/css/kw-doc.css';
import '../qb/css/codex-v2.css';
import { ATOM_INFO, ATOMS, EQUIPS, EVENT_INFO, FOODS, hasTag, KW_INFO, LINE_INFO, LINES, Q_INFO, RELICS, SHOP_POOL, card, type EventId, type Kw, type Line } from '../core/data';
import type { DemoSpec } from '../core/demo';
import { equipDemo, KW_DEMOS, unitDemo } from '../core/kwDemos';
import { sfx } from '../qb/audio';
import { draftCard, tierArt, tierBadge } from '../qb/card';
import { h } from '../qb/dom';
import { icon } from '../qb/icons';
import { kwRich, kwTag, trigCap, TRIG, type TrigId } from '../qb/kwtext';
import { itemIcon } from '../qb/pixelItems';
import { equipIcon, unitTip } from '../qb/tip';
import { battleDemo } from './battleDemo';

type Tab = 'units' | 'foods' | 'equip' | 'relic' | 'kw';
const state = { line: 'all' as Line | 'all', star: 1, sel: null as string | null, tab: 'units' as Tab, pick: {} as Record<string, string> };
const ic = (n: string) => icon(n as Parameters<typeof icon>[0]);
export const relicIcon = (id: string, cls = '') => itemIcon(`rl_${id.slice(2)}`, 'spell', cls);
export const eventIcon = (id: string, cls = '') => itemIcon(`ev_${id}`, 'spell', cls);

export function codexScreen(onBack: () => void): HTMLElement {
  const body = h('div', { class: 'cx-body' });
  const tabs: [Tab, string][] = [['units', '单位'], ['foods', '补给'], ['equip', '装备'], ['relic', '遗物'], ['kw', '规则']];
  const tabBtns = tabs.map(([k, name]) => h('button', { class: 'cx-tab', onclick: () => { sfx.click(); go(k); } }, name));
  const back = h('button', { class: 'btn ghost cx-back' }, icon('x'), h('span', null, '返回'));
  back.addEventListener('click', () => { sfx.click(); onBack(); });
  const go = (k: Tab) => {
    state.tab = k;
    tabBtns.forEach((b, i) => b.classList.toggle('on', tabs[i][0] === k));
    body.replaceChildren(k === 'units' ? unitBrowser() : k === 'foods' ? foodsPage() : k === 'equip' ? equipPage() : k === 'relic' ? relicPage() : kwPage());
    body.scrollTop = 0;
  };
  go(state.tab);
  return h('div', { class: 'screen codex' }, h('div', { class: 'cx-head' }, back, h('div', { class: 'cx-title' }, '图鉴'), h('div', { class: 'cx-tabs' }, tabBtns)), body);
}

// ── 通用：砖块导航 + 详情 ──
interface Item {
  key: string;
  /** 砖块：图标 + 名字（或整块词条胶囊） */
  tile: () => Node;
  name?: string;
  /** 砖块描边颜色（品质 / 阶层 / 标签色） */
  color?: string;
  /** 详情：大图标、名字、角标、一句话、演示、附加内容 */
  big?: () => Node;
  title: () => Node;
  meta?: () => Node | null;
  line: () => (string | Node)[];
  demo?: DemoSpec | null;
  extra?: () => Node | null;
}

function split(page: string, sections: { title: string; items: Item[]; cols?: number }[], note?: string): HTMLElement {
  const nav = h('div', { class: 'kd-nav cx-nav' });
  const detail = h('div', { class: 'kd-detail cx-dt' });
  const tiles: HTMLElement[] = [];
  const show = (it: Item) => {
    state.pick[page] = it.key;
    tiles.forEach((t) => t.classList.toggle('on', t.dataset.key === it.key));
    detail.replaceChildren(
      h('div', { class: 'cx-dt-head' },
        ...(it.big ? [h('div', { class: 'cx-dt-big', style: it.color ? `--qc:${it.color}` : '' }, it.big())] : []),
        h('div', { class: 'cx-dt-title' }, h('div', { class: 'cx-dt-name' }, it.title()), ...(it.meta?.() ? [it.meta()!] : []))),
      h('p', { class: 'cx-dt-line' }, ...it.line()),
      ...(it.demo ? [battleDemo(it.demo, it.name ?? it.key)] : []),
      ...(it.extra?.() ? [it.extra()!] : []),
    );
    detail.scrollTop = 0;
  };
  const all = sections.flatMap((s) => s.items);
  nav.replaceChildren(
    ...(note ? [h('p', { class: 'cx-nav-note' }, ...kwRich(note))] : []),
    ...sections.filter((s) => s.items.length).map((s) => h('section', { class: 'kd-sec' },
      s.title ? h('h3', { class: 'kd-sec-h' }, s.title) : null,
      h('div', { class: 'cx-tiles', style: s.cols ? `grid-template-columns:repeat(${s.cols},1fr)` : '' }, s.items.map((it) => {
        const t = h('button', { class: `cx-tile${it.demo ? ' has-demo' : ''}`, 'data-key': it.key, style: it.color ? `--qc:${it.color}` : '', onclick: () => { sfx.click(); show(it); } },
          it.tile(), it.demo ? h('i', { class: 'cx-tile-play', 'aria-label': '有演示' }) : null);
        tiles.push(t);
        return t;
      })))));
  show(all.find((x) => x.key === state.pick[page]) ?? all[0]);
  return h('div', { class: 'kd cx-split' }, nav, detail);
}
const tile = (art: Node, name: string) => h('span', { class: 'cx-tile-in' }, h('span', { class: 'cx-tile-art' }, art), h('span', { class: 'cx-tile-name' }, name));
const meta = (...xs: (Node | string | null)[]) => h('div', { class: 'cx-dt-meta' }, ...xs);
const pill = (text: string, color: string) => h('span', { class: 'cx-pill', style: `--qc:${color}` }, text);
const TIER_C = ['', '#bf9a70', '#46d890', '#4a9cff', '#b46cff', '#ffac2e', '#ff4a4a'];

// ── 单位 ──
function unitBrowser(): HTMLElement {
  const s = state;
  const root = h('div', { class: 'ub' });
  const render = () => {
    const color = s.line === 'all' ? '#ffd36b' : LINE_INFO[s.line].color;
    root.style.setProperty('--fc', color);
    const tab = (k: Line | 'all', name: string, c: string) => h('button', {
      class: `ub-fac${k === s.line ? ' on' : ''}`, style: `--fc:${c}`,
      onclick: () => { if (k === s.line) return; sfx.click(); s.line = k; s.sel = null; render(); },
    }, name);
    const lines = h('div', { class: 'ub-facs' }, tab('all', '全部', '#ffd36b'), LINES.map((k) => tab(k, LINE_INFO[k].name, LINE_INFO[k].color)));
    const stars = h('div', { class: 'ub-stars', 'aria-label': '查看星级' }, [1, 2, 3].map((lv) => h('button', {
      class: `ub-star${lv === s.star ? ' on' : ''}`, 'aria-label': `${lv} 星`,
      onclick: () => { if (lv === s.star) return; sfx.click(); s.star = lv; render(); },
    }, '★'.repeat(lv))));
    const defs = SHOP_POOL.filter((d) => s.line === 'all' || hasTag(d, s.line as Line)).sort((a, b) => a.tier - b.tier);
    if (!s.sel || !defs.some((d) => d.id === s.sel)) s.sel = defs[0]?.id ?? null;
    const grid = h('div', { class: 'ub-grid' });
    const detail = h('div', { class: 'ub-detail cx-detail' });
    const show = (id: string) => {
      s.sel = id;
      grid.querySelectorAll<HTMLElement>('.ub-cell').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
      const d = card(id);
      const demo = unitDemo(id, s.star as 1 | 2 | 3);
      detail.replaceChildren(
        h('div', { class: 'cx-d-head' },
          tierArt('cx-d-art', id, d.tier),
          h('div', { class: 'ub-d-title' },
            h('b', { class: 'cx-d-name' }, d.name),
            h('div', { class: 'ub-d-meta' }, [d.line, d.tag2].filter((t): t is Line => !!t).map((t) => h('span', { class: 'ub-d-fac', style: `--fc:${LINE_INFO[t].color}` }, LINE_INFO[t].name)), tierBadge(d.tier)))),
        ...(demo ? [battleDemo(demo, d.name)] : []),
        h('section', { class: 'cx-lv' }, unitTip(id, s.star, null, false)),
      );
      detail.scrollTop = 0;
    };
    grid.replaceChildren(...defs.map((d) => h('button', { class: 'ub-cell', 'data-id': d.id, 'aria-label': d.name, onclick: () => { sfx.click(); show(d.id); } },
      draftCard(d.id, { level: s.star }))));
    if (s.sel) show(s.sel);
    root.replaceChildren(h('div', { class: 'ub-head' }, lines, stars), h('div', { class: 'ub-split' }, grid, detail));
  };
  render();
  return root;
}

// ── 补给 ──
function foodsPage(): HTMLElement {
  const price = (p: number) => h('span', { class: 'cx-price' }, itemIcon('coin', 'coin', 'sm'), p ? String(p) : '免费');
  const items = (t: number): Item[] => FOODS.filter((f) => f.tier === t).map((f) => ({
    key: f.id, name: f.name, color: TIER_C[f.tier],
    tile: () => tile(itemIcon(f.id, 'pack'), f.name),
    big: () => itemIcon(f.id, 'pack'),
    title: () => h('span', null, f.name),
    meta: () => meta(tierBadge(f.tier), price(f.price ?? 3), f.ench ? pill('装备', '#6fe6ff') : null),
    line: () => kwRich(f.text.replace('+{a}/+{h}', '攻血')),
    demo: f.ench ? equipDemo(f.ench) : null,
  }));
  return split('foods', [1, 2, 3, 4, 5, 6].map((t) => ({ title: `${t} 阶`, items: items(t) })));
}

// ── 装备 ──
function equipPage(): HTMLElement {
  const items = (q: number): Item[] => EQUIPS.filter((e) => e.q === q && !e.food).map((e) => ({
    key: e.id, name: e.name, color: Q_INFO[q].color,
    tile: () => tile(equipIcon(e.id), e.name),
    big: () => equipIcon(e.id),
    title: () => h('span', { style: `color:${Q_INFO[q].color}` }, e.name),
    meta: () => meta(pill(Q_INFO[q].name, Q_INFO[q].color), e.curse ? pill('诅咒', '#ff5a6a') : null),
    line: () => kwRich(e.text),
    demo: equipDemo(e.id),
  }));
  return split('equip', [0, 1, 2, 3].map((q) => ({ title: Q_INFO[q].name, items: items(q) })), '赢下精英战开箱，3 选 1；每人 1 件，橙装全队 1 件');
}

// ── 遗物 ──
function relicPage(): HTMLElement {
  const items: Item[] = RELICS.map((x) => ({
    key: x.id, name: x.name, color: '#ffd36b',
    tile: () => tile(relicIcon(x.id), x.name),
    big: () => relicIcon(x.id),
    title: () => h('span', null, x.name),
    line: () => kwRich(x.text),
    demo: KW_DEMOS[x.id] ?? null,
  }));
  return split('relic', [{ title: '', items }], '击败 Boss 或熬过混沌契约后 3 选 1，整局生效');
}

// ── 规则 ──
const RULES: [string, string, string][] = [
  ['交锋', 'sword', '双方队首同时互打一次，后排只靠技能出手'],
  ['金币', 'diamond', '每回合 10 金：招募 3、补给 3、刷新 1；出售返 1~3'],
  ['升星', 'star', '同名 3 份升 2 星、6 份升 3 星，升星送一张高一阶的卡'],
  ['阶级', 'arrowUp', '第 1/3/5/7/9/11 回合依次开放 1~6 阶'],
  ['胜负', 'heart', '赢 15 场通关；输了扣心（前 4 回合扣 1，之后扣 2），平局不扣'],
  ['Boss', 'skull', '第 4/8/12/16 回合是 Boss，赢到第 14 场迎战暗影领主'],
  ['岔路', 'swap', '每 3 回合两个对手选一个：精英更难，赢了开装备箱'],
  ['难度', 'flag', '困难：敌人更强、不再放水；噩梦：再强一截，只有 8 颗心'],
];
const EV_EFFECT: Record<EventId, string> = {
  camp: '一个单位 +3/+3，或拿一件精良装备',
  smith: '献上一个单位，让另一个直接升星',
  morph: '一个单位变成同阶、同标签的另一张卡，星级加成保留',
  merc: '免费带一个高一阶的佣兵打 3 场',
  chaos: '接下来 3 场敌人更强，熬过去换一件遗物',
};

function kwPage(): HTMLElement {
  const rules: Item[] = RULES.map(([k, i, t]) => ({
    key: k, tile: () => tile(ic(i), k), big: () => ic(i), title: () => h('span', null, k), line: () => kwRich(t), demo: KW_DEMOS[k] ?? null,
  }));
  const kws: Item[] = (Object.keys(KW_INFO) as Kw[]).map((k) => ({
    key: KW_INFO[k].name, color: KW_INFO[k].color,
    tile: () => kwTag(KW_INFO[k].name, '', '', true), title: () => kwTag(KW_INFO[k].name, '', '', true),
    line: () => kwRich(KW_INFO[k].desc), demo: KW_DEMOS[KW_INFO[k].name] ?? null,
  }));
  const trigs: Item[] = (Object.keys(TRIG) as TrigId[]).map((id) => ({
    key: TRIG[id].name, color: TRIG[id].color,
    tile: () => trigCap(id, TRIG[id].name, true), title: () => trigCap(id, TRIG[id].sample),
    line: () => kwRich(TRIG[id].gloss), demo: KW_DEMOS[TRIG[id].name] ?? null,
  }));
  const atoms: Item[] = ATOMS.map((a) => ({
    key: ATOM_INFO[a].name, color: '#c27bff',
    tile: () => tile(itemIcon(ATOM_INFO[a].icon, 'spell'), ATOM_INFO[a].name), big: () => itemIcon(ATOM_INFO[a].icon, 'spell'),
    title: () => h('span', null, ATOM_INFO[a].name), meta: () => meta(pill('装备 · 精英词缀', '#c27bff')),
    line: () => kwRich(ATOM_INFO[a].desc), demo: KW_DEMOS[ATOM_INFO[a].name] ?? null,
  }));
  const events: Item[] = (Object.keys(EVENT_INFO) as EventId[]).map((k) => ({
    key: `ev_${k}`, color: '#8cd4ff',
    tile: () => tile(eventIcon(k), EVENT_INFO[k].name), big: () => eventIcon(k),
    title: () => h('span', null, EVENT_INFO[k].name), meta: () => meta(pill('偶尔替代岔路', '#8cd4ff')),
    line: () => kwRich(EV_EFFECT[k]),
  }));
  const engines: Item[] = LINES.map((t) => ({
    key: `ln_${t}`, color: LINE_INFO[t].color,
    tile: () => h('span', { class: 'cx-tile-word', style: `color:${LINE_INFO[t].color}` }, LINE_INFO[t].name),
    title: () => h('span', { style: `color:${LINE_INFO[t].color}` }, LINE_INFO[t].name),
    line: () => kwRich(LINE_INFO[t].desc),
    extra: () => h('div', { class: 'kd-units cx-eng-units' }, SHOP_POOL.filter((d) => hasTag(d, t)).sort((a, b) => a.tier - b.tier).map((d) =>
      h('div', { class: `kd-unit tier-${d.tier}`, style: `--fc:${LINE_INFO[t].color}` }, tierArt('kd-unit-art', d.id, d.tier, 'span'), h('span', { class: 'kd-unit-name' }, d.name)))),
  }));
  return split('kw', [
    { title: '基础', items: rules }, { title: '词条', items: kws, cols: 3 }, { title: '时机', items: trigs, cols: 3 },
    { title: '装备词条', items: atoms }, { title: '事件', items: events }, { title: '引擎', items: engines },
  ]);
}
