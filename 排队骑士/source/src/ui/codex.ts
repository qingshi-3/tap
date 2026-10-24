// 图鉴：单位（按引擎标签筛选 + 星级，桥接卡在两个标签下都出现）/ 补给 / 词条
import '../qb/css/unit-browser.css';
import '../qb/css/codex-search.css';
import { ATOM_INFO, ATOMS, EQUIPS, EVENT_INFO, FOODS, hasTag, KW_INFO, LINE_INFO, LINES, Q_INFO, RELICS, SHOP_POOL, card, type EventId, type Line } from '../core/data';
import { DIFFS } from '../core/run';
import { sfx } from '../qb/audio';
import { draftCard, tierArt, tierBadge } from '../qb/card';
import { h } from '../qb/dom';
import { icon } from '../qb/icons';
import { kwInline, kwRich, kwTag, trigCap, TRIG, type TrigId } from '../qb/kwtext';
import { itemIcon } from '../qb/pixelItems';
import { equipIcon, unitTip } from '../qb/tip';

type Tab = 'units' | 'foods' | 'equip' | 'relic' | 'kw';
const state = { line: 'all' as Line | 'all', star: 1, sel: null as string | null, tab: 'units' as Tab };

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
      detail.replaceChildren(
        h('div', { class: 'cx-d-head' },
          tierArt('cx-d-art', id, d.tier),
          h('div', { class: 'ub-d-title' },
            h('b', { class: 'cx-d-name' }, d.name),
            h('div', { class: 'ub-d-meta' }, [d.line, d.tag2].filter((t): t is Line => !!t).map((t) => h('span', { class: 'ub-d-fac', style: `--fc:${LINE_INFO[t].color}` }, LINE_INFO[t].name)), tierBadge(d.tier)))),
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
    h('p', { class: 'cx-note' }, ...kwRich('补给一般 3 金（苹果 2 金、牛奶免费）。写着「装备」的补给会变成一件装备：每个单位只能带 1 件，新的替换旧的，换下的进背包。')),
    byTier.map((g) => h('div', { class: 'cx-items' }, g.map((f) =>
      h('div', { class: 'cx-item' }, h('span', { class: 'cx-item-icon' }, itemIcon(f.id, 'pack')),
        h('div', null, h('b', null, f.name, ' ', tierBadge(f.tier)), h('p', null, ...kwRich(f.text))))))));
}

function equipPage(): HTMLElement {
  const groups = [0, 1, 2, 3].map((q) => EQUIPS.filter((e) => e.q === q && !e.food));
  return h('div', { class: 'cx-foods' },
    h('p', { class: 'cx-note' }, '装备从精英宝箱获得：赢下精英战翻 3 件选 1，放进背包，拖到单位身上装上。每个单位 1 件；橙装全队最多 1 件；诅咒装备有代价也有大收益。'),
    groups.map((g, q) => h('div', null, h('h3', { class: 'cx-sec', style: `color:${Q_INFO[q].color}` }, Q_INFO[q].name),
      h('div', { class: 'cx-items' }, g.map((e) => h('div', { class: 'cx-item' }, h('span', { class: 'cx-item-icon' }, equipIcon(e.id)),
        h('div', null, h('b', { style: `color:${Q_INFO[q].color}` }, e.name, e.curse ? '（诅咒）' : ''), h('p', null, ...kwRich(e.text)))))))));
}

function relicPage(): HTMLElement {
  return h('div', { class: 'cx-foods' },
    h('p', { class: 'cx-note' }, '遗物整局生效：击败 Boss 或熬过混沌契约后 3 选 1，可看广告多翻一件。'),
    h('div', { class: 'cx-items' }, RELICS.map((x) => h('div', { class: 'cx-item' }, h('span', { class: 'cx-item-icon cx-relic' }, icon(x.icon as Parameters<typeof icon>[0])),
      h('div', null, h('b', null, x.name), h('p', null, ...kwRich(x.text)))))));
}

function kwPage(): HTMLElement {
  const kws = (Object.keys(KW_INFO) as (keyof typeof KW_INFO)[]).map((k) =>
    h('div', { class: 'cx-item' }, h('span', { class: 'cx-item-kw' }, kwTag(KW_INFO[k].name, '', '', true)), h('div', null, h('p', null, ...kwRich(KW_INFO[k].desc)))));
  const trigs = (Object.keys(TRIG) as TrigId[]).map((id) =>
    h('div', { class: 'cx-item' }, h('span', { class: 'cx-item-kw' }, trigCap(id, TRIG[id].sample)), h('div', null, h('p', null, ...kwRich(TRIG[id].gloss)))));
  const rules = [
    '双方队首同时互相攻击一次，叫一次「交锋」；后排只靠技能参与。',
    '每回合 10 金：招募 3 金、补给 3 金（苹果 2 金、牛奶免费）、刷新 1 金；出售按星级返还 1~3 金。',
    '同名叠 3 份升 2 星、6 份升 3 星；每次升星，货架送一张高一阶的奖励卡。',
    '货架阶级随回合开放：第 1/3/5/7/9/11 回合开放 1~6 阶。',
    '赢 15 场通关；输了扣心（第 1~4 回合扣 1 心、之后扣 2 心），10 心扣完失败；平局不扣心。',
    '第 4/8/12/16 回合是 Boss（铁壁、亡潮、熔炉、兽潮），赢到第 14 场后迎战暗影领主。',
    '每 3 回合遇到岔路：两个对手选一个，精英更难，赢了开装备箱。岔路偶尔换成事件。',
    `难度：${DIFFS.map((d) => `${d.name}（${d.desc}）`).join('、')}。`,
  ];
  const events = (Object.keys(EVENT_INFO) as EventId[]).map((k) => h('div', { class: 'cx-item' }, h('span', { class: 'cx-item-icon cx-relic' }, icon(EVENT_INFO[k].icon as Parameters<typeof icon>[0])),
    h('div', null, h('b', null, EVENT_INFO[k].name), h('p', null, EVENT_INFO[k].text))));
  const atoms = ATOMS.map((a) => h('div', { class: 'cx-item' }, h('span', { class: 'cx-item-icon' }, itemIcon(ATOM_INFO[a].icon, 'spell')),
    h('div', null, h('b', null, ATOM_INFO[a].name), h('p', null, ATOM_INFO[a].desc))));
  // 引擎：一句话 + 桥接卡（副标签连到别的引擎）
  const engines = LINES.map((t) => {
    const bridges = SHOP_POOL.filter((d) => d.tag2 && hasTag(d, t)).map((d) => `${d.name}（${LINE_INFO[d.line === t ? d.tag2! : d.line].name}）`);
    return h('div', { class: 'cx-item' }, h('span', { class: 'ub-d-fac', style: `--fc:${LINE_INFO[t].color}` }, LINE_INFO[t].name),
      h('div', null, h('p', null, ...kwRich(LINE_INFO[t].desc)), bridges.length ? h('p', { class: 'cx-note' }, `搭配：${bridges.join('、')}`) : null));
  });
  return h('div', { class: 'cx-kw' },
    h('h3', { class: 'cx-sec' }, '规则'), h('div', { class: 'cx-rules' }, rules.map((t) => h('p', null, ...kwInline(t)))),
    h('h3', { class: 'cx-sec' }, '引擎与搭配'), h('div', { class: 'cx-items' }, engines),
    h('h3', { class: 'cx-sec' }, '词条'), h('div', { class: 'cx-items' }, kws),
    h('h3', { class: 'cx-sec' }, '装备词条 / 精英词缀'), h('div', { class: 'cx-items' }, atoms),
    h('h3', { class: 'cx-sec' }, '事件'), h('div', { class: 'cx-items' }, events),
    h('h3', { class: 'cx-sec' }, '时机'), h('div', { class: 'cx-items' }, trigs));
}
