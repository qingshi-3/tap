// 图鉴：单位（按流派线筛选 + 星级）/ 补给 / 词条
import '../qb/css/unit-browser.css';
import '../qb/css/codex-search.css';
import { FOODS, KW_INFO, LINE_INFO, SHOP_POOL, card, type Line } from '../core/data';
import { sfx } from '../qb/audio';
import { draftCard, tierArt, tierBadge } from '../qb/card';
import { h } from '../qb/dom';
import { icon } from '../qb/icons';
import { kwInline, kwRich, kwTag, trigCap, TRIG, type TrigId } from '../qb/kwtext';
import { itemIcon } from '../qb/pixelItems';
import { unitTip } from '../qb/tip';

const LINES: Line[] = ['rotate', 'blade', 'soul', 'beast', 'frost', 'sand'];
type Tab = 'units' | 'foods' | 'kw';
const state = { line: 'all' as Line | 'all', star: 1, sel: null as string | null, tab: 'units' as Tab };

export function codexScreen(onBack: () => void): HTMLElement {
  const body = h('div', { class: 'cx-body' });
  const tabs: [Tab, string][] = [['units', '单位'], ['foods', '补给'], ['kw', '词条']];
  const tabBtns = tabs.map(([k, name]) => h('button', { class: 'cx-tab', onclick: () => { sfx.click(); go(k); } }, name));
  const back = h('button', { class: 'btn ghost cx-back' }, icon('x'), h('span', null, '返回'));
  back.addEventListener('click', () => { sfx.click(); onBack(); });
  const go = (k: Tab) => {
    state.tab = k;
    tabBtns.forEach((b, i) => b.classList.toggle('on', tabs[i][0] === k));
    body.replaceChildren(k === 'units' ? unitBrowser() : k === 'foods' ? foodsPage() : kwPage());
    body.scrollTop = 0;
  };
  go(state.tab);
  return h('div', { class: 'screen codex' }, h('div', { class: 'cx-head' }, back, h('div', { class: 'cx-title' }, '图鉴'), h('div', { class: 'cx-tabs' }, tabBtns)), body);
}

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
    const defs = SHOP_POOL.filter((d) => s.line === 'all' || d.line === s.line).sort((a, b) => a.tier - b.tier);
    if (!s.sel || !defs.some((d) => d.id === s.sel)) s.sel = defs[0]?.id ?? null;
    const grid = h('div', { class: 'ub-grid' });
    const detail = h('div', { class: 'ub-detail cx-detail' });
    const show = (id: string) => {
      s.sel = id;
      grid.querySelectorAll<HTMLElement>('.ub-cell').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
      const d = card(id);
      detail.replaceChildren(
        h('div', { class: 'cx-d-head' },
          tierArt('cx-d-art', id, d.tier),
          h('div', { class: 'ub-d-title' },
            h('b', { class: 'cx-d-name' }, d.name),
            h('div', { class: 'ub-d-meta' }, h('span', { class: 'ub-d-fac', style: `--fc:${LINE_INFO[d.line].color}` }, LINE_INFO[d.line].name), tierBadge(d.tier)))),
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

function foodsPage(): HTMLElement {
  const byTier = [1, 2, 3, 4, 5, 6].map((t) => FOODS.filter((f) => f.tier === t)).filter((g) => g.length);
  return h('div', { class: 'cx-foods' },
    h('p', { class: 'cx-note' }, ...kwRich('补给每个 3 金。带「附魔」的补给给单位挂一个附魔，每个单位只能带 1 个，新的替换旧的。')),
    byTier.map((g) => h('div', { class: 'cx-items' }, g.map((f) =>
      h('div', { class: 'cx-item' }, h('span', { class: 'cx-item-icon' }, itemIcon(f.id, 'pack')),
        h('div', null, h('b', null, f.name, ' ', tierBadge(f.tier)), h('p', null, ...kwRich(f.text))))))));
}

function kwPage(): HTMLElement {
  const kws = (Object.keys(KW_INFO) as (keyof typeof KW_INFO)[]).map((k) =>
    h('div', { class: 'cx-item' }, h('span', { class: 'cx-item-kw' }, kwTag(KW_INFO[k].name, '', '', true)), h('div', null, h('p', null, ...kwRich(KW_INFO[k].desc)))));
  const trigs = (Object.keys(TRIG) as TrigId[]).map((id) =>
    h('div', { class: 'cx-item' }, h('span', { class: 'cx-item-kw' }, trigCap(id, TRIG[id].sample)), h('div', null, h('p', null, ...kwRich(TRIG[id].gloss)))));
  const rules = [
    '双方队首同时互相攻击一次，叫一次「交锋」；后排只靠技能参与。',
    '每回合 10 金：招募 3 金、补给 3 金、刷新 1 金；出售按星级返还 1~3 金。',
    '同名叠 3 份升 2 星、6 份升 3 星；每次升星，货架送一张高一阶的奖励卡。',
    '货架阶级随回合开放：第 1/3/5/7/9/11 回合开放 1~6 阶。',
    '赢 10 场通关；输了扣心（前 2 回合 1 心、3~4 回合 2 心、之后 3 心），10 心扣完失败。',
    '第 4/8/12 回合是 Boss，赢到第 9 场后迎战暗影领主。',
  ];
  return h('div', { class: 'cx-kw' },
    h('h3', { class: 'cx-sec' }, '规则'), h('div', { class: 'cx-rules' }, rules.map((t) => h('p', null, ...kwInline(t)))),
    h('h3', { class: 'cx-sec' }, '词条'), h('div', { class: 'cx-items' }, kws),
    h('h3', { class: 'cx-sec' }, '时机'), h('div', { class: 'cx-items' }, trigs));
}
