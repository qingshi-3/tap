// 图鉴：左侧图标砖、右侧详情（大图标 + 一句话 + 实机演示）。单位页沿用卡面网格。
import '../qb/css/unit-browser.css';
import '../qb/css/codex-search.css';
import '../qb/css/kw-doc.css';
import '../qb/css/codex-v2.css';
import '../qb/css/codex-v3.css';
import '../qb/css/codex-v4.css';
import { ARCHETYPES, ARCHETYPE_IDS } from '../core/archetypes';
import { archetypeGuide, ARCHETYPE_COLORS, cardIdentity, HUNT_MARK_TEXT, identityColor } from '../qb/archetypes';
import { ATOM_INFO, ATOMS, ACTIVE_EQUIPS, EVENT_INFO, FOODS, foodText, KW_INFO, Q_INFO, ACTIVE_RELICS, SHOP_POOL, card, type CardDef, type EventId, type Kw } from '../core/data';
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
import { nativeTimings } from '../core/run';
import { supportBadges, supportCounterNote } from '../qb/support';
import { closeKeywordHelp, enableKeywordHelp } from '../qb/keywordHelp';

type Tab = 'units' | 'foods' | 'equip' | 'relic' | 'kw';
const state = { f: new Set<string>(), sel: null as string | null, tab: 'units' as Tab, pick: {} as Record<string, string> };
const ic = (n: string) => icon(n as Parameters<typeof icon>[0]);
export const relicIcon = (id: string, cls = '') => itemIcon(`rl_${id.slice(2)}`, 'spell', cls);
export const eventIcon = (id: string, cls = '') => itemIcon(`ev_${id}`, 'spell', cls);

/** cap：局内打开时传当前商店最高阶，高于它的单位标所需酒馆阶数 */
export function codexScreen(onBack: () => void, cap?: number): HTMLElement {
  const body = h('div', { class: 'cx-body' });
  const tabs: [Tab, string][] = [['units', '单位'], ['foods', '补给'], ['equip', '装备'], ['relic', '遗物'], ['kw', '规则']];
  const tabBtns = tabs.map(([k, name]) => h('button', { class: 'cx-tab', onclick: () => { sfx.click(); go(k); } }, name));
  // 顶栏右侧的页面工具（单位页：星级 + 筛选），切页时清空
  const tools = h('div', { class: 'cx-tools' });
  const back = h('button', { class: 'btn ghost cx-back' }, icon('x'), h('span', null, '返回'));
  back.addEventListener('click', () => { closeKeywordHelp(); sfx.click(); onBack(); });
  const go = (k: Tab) => {
    closeKeywordHelp();
    state.tab = k;
    tabBtns.forEach((b, i) => b.classList.toggle('on', tabs[i][0] === k));
    tools.replaceChildren();
    body.replaceChildren(k === 'units' ? unitBrowser(tools, cap) : k === 'foods' ? foodsPage() : k === 'equip' ? equipPage() : k === 'relic' ? relicPage() : kwPage());
    body.scrollTop = 0;
  };
  go(state.tab);
  return h('div', { class: 'screen codex' }, h('div', { class: 'cx-head' }, back, h('div', { class: 'cx-tabs' }, tabBtns), tools), body);
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
    closeKeywordHelp();
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
    enableKeywordHelp(detail);
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

// ── 单位：词条 / 时机 / 阶层多选筛选（同组任一、跨组同时满足）──
/** Filters follow ability definitions, including passive observers without a colon. */
export const trigsOf = (id: string): Set<TrigId> => {
  const d = card(id);
  const mapping = { play: 'play', start: 'start', hurt: 'hurt', faint: 'faint', ally_faint: 'faint', summon: 'summon', before_attack: 'before', after_attack: 'beat', kill: 'kill', end: 'shop', buy: 'buy', sell: 'sell', food: 'food', ally_food: 'food', spell: 'spell', round_start: 'round_start', battle_count: 'cond', unit_obtained: 'cond', permanent_health: 'cond', enter:'enter', clashEnd:'clashEnd', bloodPay:'bloodPay' } as const;
  const out = new Set<TrigId>(nativeTimings(d).map(t => mapping[t]));
  if (d.key) out.add(({ play: 'play', start: 'start', hurt: 'hurt', faint: 'faint', end: 'shop' } as const)[d.key]);
  if (d.ab === 'cat') out.add('food');
  return out;
};
function unitBrowser(tools: HTMLElement, cap?: number): HTMLElement {
  const s = state;
  const root = h('div', { class: 'ub' });
  // 筛选收进弹层：顶栏只留「筛选」按钮（带已选数），点开盖在卡牌网格上
  const head = h('div', { class: 'ub-filters' });
  const pop = h('div', { class: 'ub-pop', hidden: true }, head);
  const setOpen = (open: boolean) => { pop.hidden = !open; fbtn.classList.toggle('open', open); };
  const fbtn = h('button', { class: 'cx-filter-btn', onclick: () => { sfx.click(); setOpen(pop.hidden); } });
  pop.addEventListener('click', (e) => { if (e.target === pop) setOpen(false); });
  const grid = h('div', { class: 'ub-grid' });
  const detail = h('div', { class: 'ub-detail cx-detail' });
  const groups: { key: string; test: (d: CardDef) => boolean; node: () => Node; color: string }[][] = [
    [...ARCHETYPE_IDS.map((t) => ({ key: `l:${t}`, test: (d: CardDef) => d.archetype === t || d.bridge === t, color: ARCHETYPE_COLORS[t], node: () => h('span', { class: 'ub-fw' }, ARCHETYPES[t].name) })), { key:'l:common',test:(d:CardDef)=>!d.archetype && !d.legacy,color:'#cfd6e6',node:()=>h('span',{class:'ub-fw'},'通用') },
      ...(Object.keys(KW_INFO) as Kw[]).map((k) => ({ key: `k:${k}`, test: (d: CardDef) => d.kws.includes(k), color: KW_INFO[k].color, node: () => h('span', { class: 'ub-fw' }, KW_INFO[k].name) }))],
    (Object.keys(TRIG) as TrigId[]).filter((id) => id !== 'cond').map((id) => ({ key: `t:${id}`, test: (d: CardDef) => trigsOf(d.id).has(id), color: TRIG[id].color, node: () => h('span', { class: 'ub-fw' }, TRIG[id].name) })),
    [1, 2, 3, 4, 5, 6].map((t) => ({ key: `r:${t}`, test: (d: CardDef) => d.tier === t, color: TIER_C[t], node: () => tierBadge(t as 1) })),
  ];
  // 引擎和词条在同一行，但仍是两组
  const facet = (key: string) => key[0];
  const pass = (d: CardDef) => ['l', 'k', 't', 'r'].every((f) => {
    const on = groups.flat().filter((g) => facet(g.key) === f && s.f.has(g.key));
    return !on.length || on.some((g) => g.test(d));
  });
  const show = (id: string) => {
    closeKeywordHelp();
    s.sel = id;
    grid.querySelectorAll<HTMLElement>('.ub-cell').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    const d = card(id);
    const description = unitTip(id, 1, null, false);
    const demoBox = h('div', {class:'unit-demo'});
    const paintDemo = (level: 1 | 2) => {
      const spec = unitDemo(id,level);
      demoBox.hidden = !spec;
      demoBox.replaceChildren(...(spec ? [h('span',{class:'unit-demo-label'},level === 2 ? '金色演示' : '普通演示'),battleDemo(spec,d.name)] : []));
    };
    paintDemo(1);
    description.addEventListener('tipvariantchange', event => paintDemo((event as CustomEvent<{level:1|2}>).detail.level));
    description.querySelector(':scope > .tip-head')?.remove();
    detail.replaceChildren(
      h('div', { class: 'cx-d-head' },
        tierArt('cx-d-art', id, d.tier),
        h('div', { class: 'ub-d-title' },
          h('b', { class: 'cx-d-name' }, d.name),
          h('div', { class: 'ub-d-meta' }, h('span', { class:'ub-d-fac', style:`--fc:${identityColor(d)}` }, cardIdentity(id)), tierBadge(d.tier),
            cap && d.tier > cap ? h('span', { class: 'ub-d-lock' }, `酒馆升到 ${d.tier} 阶后解锁`) : null))),
      demoBox,
      h('section', { class: 'cx-lv' }, description),
    );
    detail.scrollTop = 0;
  };
  const render = () => {
    const chip = (g: (typeof groups)[0][0]) => h('button', {
      class: `ub-chip${s.f.has(g.key) ? ' on' : ''}${cap && g.key[0] === 'r' && +g.key.slice(2) > cap ? ' shut' : ''}`, style: `--fc:${g.color}`,
      onclick: () => { sfx.click(); s.f.has(g.key) ? s.f.delete(g.key) : s.f.add(g.key); render(); },
    }, g.node());
    const defs = SHOP_POOL.filter(pass).sort((a, b) => a.tier - b.tier);
    const clear = h('button', { class: 'ub-clear', disabled: !s.f.size, onclick: () => { sfx.click(); s.f.clear(); render(); } }, icon('x'), '清除');
    const grp = (label: string, ...xs: Node[]) => h('div', { class: 'ub-grp' }, h('span', { class: 'ub-lab' }, label), h('div', { class: 'ub-set' }, ...xs));
    head.replaceChildren(
      grp('流派', ...groups[0].filter((g) => g.key[0] === 'l').map(chip)),
      grp('词条', ...groups[0].filter((g) => g.key[0] === 'k').map(chip)),
      grp('时机', ...groups[1].map(chip)),
      grp('阶层', h('div', { class: 'ub-tiers' }, ...groups[2].map(chip))),
      h('div', { class: 'ub-pop-foot' }, clear, h('button', { class: 'ub-done', onclick: () => { sfx.click(); setOpen(false); } }, `查看 ${defs.length} 个`)),
    );
    fbtn.replaceChildren(icon('filter'), h('span', null, '筛选'), ...(s.f.size ? [h('b', { class: 'cx-fn' }, String(s.f.size))] : []));
    fbtn.classList.toggle('active', s.f.size > 0);
    tools.replaceChildren(fbtn);
    if (!s.sel || !defs.some((d) => d.id === s.sel)) s.sel = defs[0]?.id ?? null;
    grid.replaceChildren(...defs.map((d) => {
      const shut = !!cap && d.tier > cap;
      return h('button', { class: `ub-cell${shut ? ' locked' : ''}`, 'data-id': d.id, 'aria-label': d.name, onclick: () => { sfx.click(); show(d.id); } },
        draftCard(d.id, { level: 1 }), shut ? h('span', { class: 'ub-lock' }, `酒馆 ${d.tier} 阶`) : null);
    }));
    if (!defs.length) grid.append(h('p', { class: 'ub-empty' }, '没有同时满足的单位'));
    if (s.sel) show(s.sel); else detail.replaceChildren();
  };
  render();
  root.replaceChildren(h('div', { class: 'ub-split' }, h('div', { class: 'ub-left' }, grid, pop), detail));
  return root;
}

// ── 补给 ──
function foodsPage(): HTMLElement {
  const price = (p: number) => h('span', { class: 'cx-price' }, itemIcon('coin', 'coin', 'sm'), p ? String(p) : '免费');
  const items = (t: number): Item[] => FOODS.filter((f) => f.tier === t && !f.legacy && f.spell !== 'echo').map((f) => ({
    key: f.id, name: f.name, color: TIER_C[f.tier],
    tile: () => tile(itemIcon(f.id, 'pack'), f.name),
    big: () => itemIcon(f.id, 'pack'),
    title: () => h('span', null, f.name),
    meta: () => meta(tierBadge(f.tier), price(f.price ?? 3), supportBadges(f)),
    line: () => kwRich(foodText(f.id)),
    demo: null,
  }));
  return split('foods', [1, 2, 3, 4, 5, 6].map((t) => ({ title: `${t} 阶`, items: items(t) })));
}

// ── 装备 ──
function equipPage(): HTMLElement {
  const items = (q: number): Item[] => ACTIVE_EQUIPS.filter((e) => e.q === q).map((e) => ({
    key: e.id, name: e.name, color: Q_INFO[q].color,
    tile: () => tile(equipIcon(e.id), e.name),
    big: () => equipIcon(e.id),
    title: () => h('span', { style: `color:${Q_INFO[q].color}` }, e.name),
    meta: () => meta(pill(Q_INFO[q].name, Q_INFO[q].color), e.curse ? pill('诅咒', '#ff5a6a') : null, supportBadges(e)),
    line: () => kwRich(e.text),
    demo: equipDemo(e.id),
  }));
  return split('equip', [0, 1, 2, 3].map((q) => ({ title: Q_INFO[q].name, items: items(q) })), '从精英宝箱、商人和锻造取得；换装后原装备退回背包。');
}

// ── 遗物 ──
function relicPage(): HTMLElement {
  const items: Item[] = ACTIVE_RELICS.map((x) => ({
    key: x.id, name: x.name, color: '#ffd36b',
    tile: () => tile(relicIcon(x.id), x.name),
    big: () => relicIcon(x.id),
    title: () => h('span', null, x.name),
    meta: () => meta(supportBadges(x)),
    line: () => [...kwRich(x.text), ...(supportCounterNote(x) ? [h('p',null,supportCounterNote(x))] : [])],
    demo: KW_DEMOS[x.id] ?? null,
  }));
  return split('relic', [{ title: '', items }], '首战、Boss 与契约等奖励提供选择；整局生效。');
}

// ── 规则 ──
const RULES: [string, string, string][] = [
  ['交锋', 'sword', '双方队首同时互打一次，后排只靠技能出手'],
  ['猎标', 'target', HUNT_MARK_TEXT],
  ['首击追伤', 'sword', '下场战斗首次普通攻击后，对同一个敌人追加伤害。多次获得的数值相加，只结算一次。'],
  ['金币', 'diamond', '每回合基础金币从 3 递增至 10；招募通常 3 金、刷新 1 金，补给按卡面标价。'],
  ['三连', 'star', '同名 3 份合成金色：基础攻击和生命翻倍，技能数值见金色卡面，再从已开放卡池获得发现奖励。'],
  ['流派', 'bolt', '补给每局开放，另随机开放五个流派。双流派单位按主流派出现；补给、装备和遗物任一标签开放即可出现。'],
  ['补给传承', 'replay', '带补给传承的单位记录最早吃下的 5 份可传承永久补给。出售时，最近的身后友军获得这些补给的基础攻击和生命；身后无人则传给最近的身前友军。喂食按最初吃到补给的人数计次，分享、转交和重复效果跳过。合并时优先保留接收方记录。'],
  ['阶级', 'arrowUp', '酒馆花金币升级后开放更高阶候选。部分单位到第三幕开放；补给、装备和遗物根据本局开放流派投放。'],
  ['路线', 'flag', '3 幕，每幕 6 层 + Boss；每个节点一回合：先逛酒馆，再走节点'],
  ['胜负', 'heart', '打赢第 3 幕 Boss 通关；输了扣心（普通 1，精英 / Boss 2），平局不扣；Boss 不赢过不去'],
  ['节点', 'skull', '战斗赢了下回合 +2 金；精英赢了开装备箱；篝火三选一；商人卖装备 / 遗物碎片 / 高阶法术；宝藏下回合 +4 金'],
  ['难度', 'flag', '普通 5 颗心；困难 3 颗心；噩梦 2 颗心。'],
];
const EV_EFFECT: Record<EventId, string> = {
  camp: '一个单位 +3/+3，或拿一件精良装备',
  smith: '献上一个单位，让另一个直接变金色',
  morph: '一个单位变成同阶、同标签的另一张卡，份数和加成保留',
  merc: '免费带一个高一阶的佣兵打 3 场',
  chaos: '接下来 3 场敌人更强，熬过去换一件遗物',
  fire: '一个单位 +2 份，或永久 +4/+4，或回 1 心',
  quest: '三选一接委托：受伤 30 次 / 召唤 15 次 / 出售 8 次，完成领赏',
  treasure: '下回合 +4 金',
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
  const engines: Item[] = ARCHETYPE_IDS.map((t) => ({
    key:`ar_${t}`, color:ARCHETYPE_COLORS[t],
    tile:()=>h('span',{class:'cx-tile-word',style:`color:${ARCHETYPE_COLORS[t]}`},ARCHETYPES[t].name),
    title:()=>h('span',{style:`color:${ARCHETYPE_COLORS[t]}`},ARCHETYPES[t].name),
    line:()=>kwRich(ARCHETYPES[t].action),
    extra:()=>h('div',null,archetypeGuide(t, false),h('div',{class:'kd-units cx-eng-units'},...SHOP_POOL.filter(d=>d.archetype===t).sort((a,b)=>a.tier-b.tier).map(d=>h('div',{class:`kd-unit tier-${d.tier}`,style:`--fc:${ARCHETYPE_COLORS[t]}`},tierArt('kd-unit-art',d.id,d.tier,'span'),h('span',{class:'kd-unit-name'},d.name))))),
  }));
  return split('kw', [
    { title: '基础', items: rules }, { title: '词条', items: kws, cols: 3 }, { title: '时机', items: trigs, cols: 3 },
    { title: '装备词条', items: atoms }, { title: '事件', items: events }, { title: '十一流派', items: engines },
  ]);
}
