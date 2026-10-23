// 单位浏览器：图鉴「单位」页和局内「本局卡池」共用。
// 左侧网格直接用招募卡面，右侧是选中单位的详情；两处入口看到的是同一套样子。
import '../unit-browser.css';
import { DRAFT_POOL, FACTION_INFO, unitDef } from '../core/data';
import type { Faction, UnitDef } from '../core/types';
import { sfx } from './audio';
import { draftCard } from './card';
import { tierArt, tierBadge } from './card';
import { h } from './dom';
import { unitTip } from './tip';

export interface BrowserState { fac: Faction; star: number; sel: string | null }

export interface BrowserOpts {
  /** 顶部阵营页签 */
  factions: readonly Faction[];
  state: BrowserState;
  /** 有值时忽略阵营页签，直接用它筛选（图鉴搜索） */
  filter?: (d: UnitDef) => boolean;
  /** 未开放说明，例如「第 3 战开放」 */
  lockNote?: (d: UnitDef) => string | null;
  /** 详情底部的附加内容（图鉴的搭配推荐） */
  extra?: (d: UnitDef) => HTMLElement | null;
  empty?: () => HTMLElement;
}

export function unitBrowser(o: BrowserOpts): HTMLElement {
  const s = o.state;
  const root = h('div', { class: 'ub' });
  const render = () => {
    const f = FACTION_INFO[s.fac];
    root.style.setProperty('--fc', f.color);
    const tabs = h('div', { class: 'ub-facs' }, o.factions.map(k => h('button', {
      class: `ub-fac${!o.filter && k === s.fac ? ' on' : ''}`, style: `--fc:${FACTION_INFO[k].color}`,
      onclick: () => { if (k === s.fac && !o.filter) return; sfx.click(); s.fac = k; s.sel = null; render(); },
    }, FACTION_INFO[k].name)));
    const stars = h('div', { class: 'ub-stars', 'aria-label': '查看星级' }, [1, 2, 3].map(lv => h('button', {
      class: `ub-star${lv === s.star ? ' on' : ''}`, 'aria-label': `${lv} 星`, 'aria-pressed': String(lv === s.star),
      onclick: () => { if (lv === s.star) return; sfx.click(); s.star = lv; render(); },
    }, '★'.repeat(lv))));
    const defs = DRAFT_POOL.filter(d => (o.filter ? o.filter(d) : d.faction === s.fac)).sort((a, b) => a.tier - b.tier);
    if (!defs.length) {
      s.sel = null;
      root.replaceChildren(h('div', { class: 'ub-head' }, tabs, stars), o.empty?.() ?? h('p', null, '没有单位'));
      return;
    }
    if (!s.sel || !defs.some(d => d.id === s.sel)) s.sel = defs[0].id;
    const grid = h('div', { class: 'ub-grid' });
    const detail = h('div', { class: 'ub-detail cx-detail' });
    const show = (id: string) => {
      s.sel = id;
      grid.querySelectorAll<HTMLElement>('.ub-cell').forEach(b => b.classList.toggle('on', b.dataset.id === id));
      const d = unitDef(id);
      const lock = o.lockNote?.(d);
      detail.replaceChildren(
        h('div', { class: 'cx-d-head' },
          tierArt('cx-d-art', id, d.tier),
          h('div', { class: 'ub-d-title' },
            h('b', { class: 'cx-d-name' }, d.name),
            h('div', { class: 'ub-d-meta' }, h('span', { class: 'ub-d-fac', style: `--fc:${FACTION_INFO[d.faction].color}` }, FACTION_INFO[d.faction].name),
              tierBadge(d.tier),
              lock ? h('span', { class: 'ub-d-lock' }, lock) : null))),
        h('section', { class: 'cx-lv' }, unitTip(id, s.star, null, false)),
      );
      const more = o.extra?.(d);
      if (more) detail.appendChild(more);
      detail.scrollTop = 0;
    };
    grid.replaceChildren(...defs.map(d => {
      const lock = o.lockNote?.(d);
      return h('button', { class: `ub-cell${lock ? ' locked' : ''}`, 'data-id': d.id, 'aria-label': d.name, onclick: () => { sfx.click(); show(d.id); } },
        draftCard(d.id, { level: s.star }), lock ? h('span', { class: 'ub-lock' }, lock) : null);
    }));
    show(s.sel);
    root.replaceChildren(h('div', { class: 'ub-head' }, tabs, stars), h('div', { class: 'ub-split' }, grid, detail));
  };
  render();
  return root;
}
