// 图鉴：标题页进入。单位 / 将军 / 装备 / 法术与招募令，外加按阵营整理的推荐阵容。
// 全部点按操作；推荐只给思路，不影响局内抽卡。
import { KW_DEMOS } from '../core/kwDemos';
import { battleDemo } from './battleDemo';
import '../codex-search.css';
import '../mechanics-guide.css';
import '../kw-doc.css';
import { BATTLE_RULES } from '../core/battleRules';
import { matchesCodex } from '../core/codexSearch';
import { EQUIPS, GENERALS, ORDERS, SPELLS } from '../core/content';
import { DRAFT_POOL, FACTION_INFO, FACTION_ORDER, RARITY_NAMES, ROLE_TAGS, tagFamily, unitDef } from '../core/data';
import { COMBOS } from '../core/combos';
import type { UnitDef } from '../core/types';
import { sfx } from './audio';
import { h } from './dom';
import { icon } from './icons';
import { kwInline, kwRich, kwTag, MECH, pxIcon, MECH_KIND_NAME, mechGloss, TRIG, trigCap, type MechKind, type TrigId } from './kwtext';
import { describe } from '../core/run';
import { itemIcon } from './pixelItems';
import { generalTip, unitTip } from './tip';
import { unitSvg } from './unitArt';
import { unitBrowser, type BrowserState } from './unitBrowser';
import { PREVIEW_TRIG } from './card';
import { CARD_SUMMARY } from './cardSummary';

const TIPS = [
  '前排放血厚、带嘲讽或护甲的单位；施法单位放后排。',
  '两张同名同星卡合并升星，星级越高能力数值越大。',
  '「给X」与「吃X」是一对：比如给格挡的单位，配吃格挡的单位。',
  '中立卡每局都会出现，缺前排或缺输出时用它补位。',
];

/** 单位的机制族：给X → 提供 X，吃X / 读X → 需要 X，裸 X → 自带 */
function mechs(d: UnitDef) {
  return (d.tags ?? []).filter((t) => !ROLE_TAGS.includes(t)).map((t) => ({
    fam: tagFamily(t), dir: t.startsWith('给') ? 'give' : t.startsWith('吃') ? 'eat' : 'self',
  }));
}

/** 搭配推荐：同阵营或中立里与它机制互补（给↔吃）或同机制的卡，按契合度取前几张 */
function partners(d: UnitDef, n = 4) {
  const mine = mechs(d);
  if (!mine.length) return [];
  return DRAFT_POOL
    .filter((o) => o.id !== d.id && (o.faction === d.faction || o.faction === 'neutral' || d.faction === 'neutral'))
    .map((o) => {
      let s = 0;
      for (const b of mechs(o)) for (const a of mine) {
        if (a.fam !== b.fam) continue;
        s += (a.dir === 'give' && b.dir !== 'give') || (b.dir === 'give' && a.dir !== 'give') ? 3 : 1;
      }
      if (o.faction !== d.faction) s -= 0.5;
      return { o, s };
    })
    .filter((x) => x.s >= 1)
    .sort((a, b) => b.s - a.s || b.o.tier - a.o.tier)
    .slice(0, n)
    .map((x) => x.o);
}

const ITEM_NAME: Record<string, string> = Object.fromEntries([...EQUIPS, ...SPELLS].map((x) => [x.id, x.name]));

const noResults = () => h('p', { class: 'cx-no-results', role: 'status' }, '没有匹配结果');
const unitSearchTexts = (d: UnitDef) => [d.name, FACTION_INFO[d.faction].name, RARITY_NAMES[d.tier], ...(d.tags ?? []), ...[1, 2, 3].map(lv => describe(d.id, lv))];

type Tab = 'rec' | 'unit' | 'gen' | 'kw' | 'eq' | 'sp';

export function codexScreen(onBack: () => void, showUnitModal: (content: HTMLElement) => void) {
  const TABS: [Tab, string][] = [['rec', '推荐阵容'], ['unit', '单位'], ['gen', '将军'], ['kw', '词条'], ['eq', '装备'], ['sp', '法术与招募令']];
  let activeTab: Tab = 'rec';
  const queries: Record<Tab, string> = { rec: '', unit: '', gen: '', kw: '', eq: '', sp: '' };
  let composing = false;
  const searchInput = h('input', { class: 'cx-search-input', type: 'search', placeholder: '搜索：中文 / 拼音 / 首字母', 'aria-label': '搜索图鉴', enterkeyhint: 'search', autocomplete: 'off', spellcheck: 'false' });
  const clearSearch = h('button', { class: 'cx-search-clear', type: 'button', 'aria-label': '清除搜索', hidden: true }, '清除');
  const applySearch = () => {
    queries[activeTab] = searchInput.value;
    clearSearch.hidden = searchInput.value.length === 0;
    go(activeTab);
  };
  searchInput.addEventListener('compositionstart', () => { composing = true; });
  searchInput.addEventListener('compositionend', () => { composing = false; applySearch(); });
  searchInput.addEventListener('input', () => { if (!composing) applySearch(); });
  searchInput.addEventListener('keydown', (event) => {
    if (event.isComposing || composing) return;
    if (event.key === 'Enter') { event.preventDefault(); searchInput.blur(); }
    if (event.key === 'Escape') { event.preventDefault(); searchInput.value = ''; applySearch(); searchInput.blur(); }
  });
  clearSearch.addEventListener('click', () => { searchInput.value = ''; applySearch(); searchInput.focus({ preventScroll: true }); });
  const body = h('div', { class: 'cx-body' });
  const tabBtns = TABS.map(([k, name]) => h('button', { class: 'cx-tab', onclick: () => { sfx.click(); go(k); } }, name));
  let comboSel = 0;

  const go = (tab: Tab) => {
    activeTab = tab;
    searchInput.value = queries[tab];
    clearSearch.hidden = searchInput.value.length === 0;
    tabBtns.forEach((b, i) => b.classList.toggle('on', TABS[i][0] === tab));
    body.replaceChildren(tab === 'rec' ? recView() : tab === 'unit' ? unitView() : tab === 'gen' ? genView() : tab === 'kw' ? keywordDoc(queries.kw, openUnit) : itemView(tab));
    body.scrollTop = 0;
  };
  const openUnit = (id: string) => {
    sfx.click();
    const d = unitDef(id);
    let level = unitState.star;
    const detail = h('div', { class: 'cx-popup-detail' });
    const levels = [1, 2, 3].map(lv => h('button', {
      class: 'cx-starbtn', 'aria-label': `${lv} 星`,
      onclick: () => { sfx.click(); level = lv; refresh(); },
    }, '★'.repeat(lv)));
    const refresh = () => {
      levels.forEach((button, i) => {
        button.classList.toggle('on', i + 1 === level);
        button.setAttribute('aria-pressed', String(i + 1 === level));
      });
      detail.replaceChildren(unitTip(id, level, null, false));
    };
    refresh();
    showUnitModal(h('div', { class: 'cx-unit-popup', 'aria-label': `${d.name}详情` },
      h('div', { class: 'cx-popup-head' }, h('div', { class: 'cx-d-art', html: unitSvg(id) }),
        h('div', null, h('b', { class: 'cx-popup-name' }, d.name),
          h('div', { class: 'cx-popup-meta' }, FACTION_INFO[d.faction].name,
            h('span', { class: `cx-rar rarity-${d.tier}` }, RARITY_NAMES[d.tier])))),
      h('div', { class: 'cx-popup-stars', 'aria-label': '查看星级' }, levels), detail));
  };

  const unitChip = (id: string, sub?: string) => {
    const d = unitDef(id);
    return h('button', { class: `cx-chip tier-${d.tier}`, style: `--fc:${FACTION_INFO[d.faction].color}`, onclick: (event: Event) => { (event.currentTarget as HTMLElement).focus({ preventScroll: true }); openUnit(id); } },
      h('span', { class: 'cx-chip-art', html: unitSvg(id) }), h('b', null, d.name),
      h('span', { class: `cx-rar rarity-${d.tier}` }, RARITY_NAMES[d.tier]), sub ? h('span', null, sub) : null);
  };
  const itemChip = (id: string) =>
    h('span', { class: 'cx-item-chip' }, itemIcon(id, 'spell', 'sm'), ITEM_NAME[id] ?? id);

  // ── 推荐阵容 ──
  const recView = () => {
    const visible = COMBOS.map((c, i) => ({ c, i })).filter(({ c }) => {
      const g = GENERALS.find(g => g.id === c.general)!;
      return matchesCodex(queries.rec, c.name, c.idea, FACTION_INFO[c.faction].name, g.name, g.title, g.text, ...c.roles, ...c.units.flatMap(id => unitSearchTexts(unitDef(id))), ...c.extras.map(id => ITEM_NAME[id] ?? id));
    });
    if (!visible.length) return noResults();
    const list = h('div', { class: 'cx-combos' });
    const detail = h('div', { class: 'cx-combo' });
    const show = (i: number) => {
      comboSel = i;
      list.querySelectorAll<HTMLElement>('.cx-combo-btn').forEach(b => b.classList.toggle('on', Number(b.dataset.index) === i));
      const c = COMBOS[i], f = FACTION_INFO[c.faction], g = GENERALS.find((x) => x.id === c.general)!;
      detail.style.setProperty('--fc', f.color);
      detail.replaceChildren(
        h('div', { class: 'cx-combo-head' }, h('b', null, c.name), h('span', { class: 'cx-fac' }, f.name), h('span', { class: 'cx-gen' }, `推荐将军：${g.name} · ${g.title}`)),
        h('p', { class: 'cx-idea' }, c.idea),
        h('div', { class: 'cx-line' }, c.units.map((id, k) => h('div', { class: 'cx-slot' }, h('span', { class: 'cx-no' }, `${k + 1}号位`), unitChip(id), h('p', null, ...kwInline(c.roles[k]))))),
        h('div', { class: 'cx-extras' }, h('span', null, '可搭配：'), c.extras.map(itemChip)),
        h('p', { class: 'cx-note' }, '点头像查看单位详情。阵营每局随机开放，抽不到时用同机制的卡替换即可。'),
      );
    };
    list.replaceChildren(...visible.map(({ c, i }) => h('button', { class: 'cx-combo-btn', 'data-index': i, style: `--fc:${FACTION_INFO[c.faction].color}`, onclick: () => { sfx.click(); show(i); } },
      h('span', { class: 'cx-fac' }, FACTION_INFO[c.faction].name), h('b', null, c.name))));
    show(visible.some(({ i }) => i === comboSel) ? comboSel : visible[0].i);
    return h('div', { class: 'cx-split' },
      h('div', { class: 'cx-side' }, list),
      h('div', { class: 'cx-main' }, detail, h('div', { class: 'cx-tips' }, h('b', null, '组队要点'), h('ul', null, TIPS.map((t) => h('li', null, t))))));
  };

  // ── 单位 ──（与局内「本局卡池」共用 unitBrowser）
  const unitState: BrowserState = { fac: 'light', star: 1, sel: null };
  const unitView = () => unitBrowser({
    factions: FACTION_ORDER, state: unitState,
    filter: queries.unit.trim() ? (d) => matchesCodex(queries.unit, ...unitSearchTexts(d)) : undefined,
    extra: (d) => {
      const mates = partners(d);
      return mates.length ? h('div', { class: 'cx-mates' }, h('b', null, '搭配推荐'), h('div', null, mates.map((m) => unitChip(m.id)))) : null;
    },
    empty: noResults,
  });

  // ── 将军 ──
  const genView = () => {
    if (!GENERALS.some(g => matchesCodex(queries.gen, g.name, g.title, g.text, FACTION_INFO[g.faction].name))) return noResults();
    return h('div', { class: 'cx-gens' }, GENERALS.filter(g => matchesCodex(queries.gen, g.name, g.title, g.text, FACTION_INFO[g.faction].name)).map((g) => {
    const f = FACTION_INFO[g.faction];
    const combos = COMBOS.filter((c) => c.general === g.id);
    return h('div', { class: 'cx-gen-card', style: `--fc:${f.color}` },
      h('div', { class: 'cx-gen-art', html: unitSvg(null, { general: g.id }) }),
      h('div', { class: 'cx-gen-info' }, generalTip(g.id),
        combos.length ? h('div', { class: 'cx-gen-rec' }, h('span', null, '推荐阵容：'), combos.map((c) =>
          h('button', { class: 'cx-link', onclick: () => { sfx.click(); comboSel = COMBOS.indexOf(c); go('rec'); } }, c.name))) : null));
  }));
  };

  // ── 装备 / 法术与招募令 ──
  const itemView = (tab: 'eq' | 'sp') => {
    const tile = (id: string, name: string, text: string, price: string, fb: 'spell' | 'order', note?: string) =>
      h('div', { class: 'cx-item' }, h('span', { class: 'cx-item-icon' }, itemIcon(id, fb)),
        h('div', null, h('b', null, name, h('i', { class: 'cx-price' }, itemIcon('coin', 'coin', 'sm'), price)), h('p', null, ...kwRich(text)), note ? h('p', { class: 'cx-item-note' }, note) : null));
    const equips = EQUIPS.filter(e => matchesCodex(queries[tab], e.name, e.text, ...e.tags));
    const spells = SPELLS.filter(s => matchesCodex(queries[tab], s.name, s.text, '法术'));
    const orders = ORDERS.filter(o => matchesCodex(queries[tab], o.name, o.text, '招募令'));
    if (tab === 'eq' ? !equips.length : !spells.length && !orders.length) return noResults();
    if (tab === 'eq') return h('div', null,
      h('p', { class: 'cx-intro' }, '商店里购买，拖到单位身上装备；每个单位一般只能带一件，出售单位时装备退回背包。'),
      h('div', { class: 'cx-items' }, equips.map((e) => tile(e.id, e.name, e.text, `${e.price}`, 'spell'))));
    return h('div', null,
      spells.length ? h('p', { class: 'cx-intro' }, '法术在布阵时使用，只对下一场战斗生效。') : null,
      h('div', { class: 'cx-items' }, spells.map((s) => tile(s.id, s.name, s.text, `${s.price}`, 'spell'))),
      orders.length ? h('p', { class: 'cx-intro' }, '招募令在招募时使用，重新生成本轮候选卡。') : null,
      h('div', { class: 'cx-items' }, orders.map((o) => tile(o.id, o.name, o.text, o.price[0] === o.price[1] ? `${o.price[0]}` : `${o.price[0]}~${o.price[1]}`, 'order'))));
  };

  const back = h('button', { class: 'btn ghost cx-back', onclick: () => { sfx.click(); onBack(); } }, icon('x'), h('span', null, '返回'));
  const el = h('div', { class: 'screen codex' },
    h('div', { class: 'cx-head' }, back, h('div', { class: 'cx-title' }, '图鉴'), h('div', { class: 'cx-tabs' }, tabBtns)),
    h('div', { class: 'cx-search' }, searchInput, clearSearch), body);
  go('rec');
  return el;
}

/** 词条说明：图鉴「词条」页和玩法说明共用；释义只在这里出现，不跟着单位走。
 * 左侧按类别排词条（图标或彩色短词），右侧是选中词条的大图标、释义和代表单位。 */
export function keywordDoc(query = '', onUnit?: (id: string) => void) {
  interface Entry { key: string; group: string; tag: () => HTMLElement; big: () => HTMLElement; gloss: () => (string | Node)[]; units?: string[] }
  const trigIds = Object.keys(TRIG) as TrigId[];
  const kinds: MechKind[] = ['trait', 'status', 'action'];
  const summary = (id: string) => CARD_SUMMARY[id]?.split('/') ?? [];
  const examples = (hit: (labels: string[], id: string) => boolean) =>
    DRAFT_POOL.filter(d => hit(summary(d.id), d.id)).sort((a, b) => a.tier - b.tier || a.faction.localeCompare(b.faction)).slice(0, 6).map(d => d.id);
  const num = (stat: 'atk' | 'hp', name: string) => () => h('span', { class: `kwn kwn-${stat}` }, pxIcon(stat), h('span', { class: 'kwi-name' }, name));
  const entries: Entry[] = [
    ...Object.values(BATTLE_RULES).map((rule): Entry => ({ key: rule.name, group: '基础规则', tag: () => h('b', { class: 'kd-rule' }, rule.name), big: () => h('b', { class: 'kd-rule' }, rule.name), gloss: () => kwInline(rule.text) })),
    ...trigIds.map((id): Entry => ({
      key: TRIG[id].name, group: '触发时机', tag: () => trigCap(id, TRIG[id].name, true), big: () => trigCap(id, TRIG[id].sample), gloss: () => kwInline(TRIG[id].gloss),
      units: examples(labels => labels.some(l => l === TRIG[id].name || PREVIEW_TRIG[l] === id || TRIG[id].name.startsWith(l))),
    })),
    ...kinds.flatMap(kd => Object.keys(MECH).filter(k => MECH[k].kind === kd).map((k): Entry => ({
      key: k, group: MECH_KIND_NAME[kd], tag: () => kwTag(k, '', '', true), big: () => kwTag(k, '', '', true), gloss: () => kwInline(mechGloss(k)),
      units: examples((labels, id) => labels.includes(k) || (unitDef(id).keywords ?? []).includes(k)),
    }))),
    { key: '攻击', group: '数值', tag: num('atk', '攻击'), big: num('atk', '攻击'), gloss: () => ['普攻的基础伤害。', ...kwRich('寒意'), '会压低接下来一次普攻的攻击力。'] },
    { key: '生命', group: '数值', tag: num('hp', '生命'), big: num('hp', '生命'), gloss: () => ['降到 0 阵亡。恢复生命不超过上限。'] },
    { key: '+2/+2', group: '数值', tag: () => h('span', null, ...kwRich('+2/+2')), big: () => h('span', null, ...kwRich('+2/+2')), gloss: () => ['同时加攻击和生命，前一个是攻击、后一个是生命。'] },
    { key: '3+法强', group: '数值', tag: () => h('span', null, ...kwRich('3+法强')), big: () => h('span', null, ...kwRich('3+法强')), gloss: () => ['施法数值写成「N+法强」，会加上自己的', ...kwRich('法强'), '。'] },
    { key: '格挡 2→3', group: '数值', tag: () => h('span', null, ...kwRich('格挡 2→3')), big: () => h('span', null, ...kwRich('格挡 2→3')), gloss: () => ['说明框里的「→」和绿色数字：升一星后的数值。'] },
  ];
  const text = (e: Entry) => [e.key, e.group, ...e.gloss().map(x => (typeof x === 'string' ? x : x.textContent ?? ''))];
  const visible = query.trim() ? entries.filter(e => matchesCodex(query, ...text(e))) : entries;
  if (!visible.length) return h('div', { class: 'kd' }, noResults());

  const nav = h('div', { class: 'kd-nav' });
  const detail = h('div', { class: 'kd-detail' });
  const chips: HTMLElement[] = [];
  const show = (e: Entry) => {
    chips.forEach(c => c.classList.toggle('on', c.dataset.key === e.key));
    const demo = KW_DEMOS[e.key];
    detail.replaceChildren(
      ...(demo ? [h('div', { class: 'kd-head' }, h('div', { class: 'kd-group' }, e.group), h('div', { class: 'kd-name' }, e.big())),
        battleDemo(demo)]
        : [h('div', { class: 'kd-group' }, e.group), h('div', { class: 'kd-big' }, e.big())]),
      h('p', { class: 'kd-gloss' }, ...e.gloss()),
      ...(e.units?.length ? [h('div', { class: 'kd-eg' }, h('b', null, '代表单位'), h('div', { class: 'kd-units' }, e.units.map(id => {
        const d = unitDef(id);
        return h(onUnit ? 'button' : 'div', { class: `kd-unit tier-${d.tier}`, style: `--fc:${FACTION_INFO[d.faction].color}`, onclick: onUnit ? () => onUnit(id) : null },
          h('span', { class: 'kd-unit-art', html: unitSvg(id) }), h('span', { class: 'kd-unit-name' }, d.name));
      })))] : []),
    );
    detail.scrollTop = 0;
  };
  const groups = [...new Set(visible.map(e => e.group))];
  nav.replaceChildren(...groups.map(g => h('section', { class: 'kd-sec' },
    h('h3', { class: 'kd-sec-h' }, g),
    h('div', { class: 'kd-chips' }, visible.filter(e => e.group === g).map(e => {
      const c = h('button', { class: 'kd-chip', 'data-key': e.key, onclick: () => { sfx.click(); show(e); } }, e.tag());
      chips.push(c);
      return c;
    })))));
  show(visible[0]);
  return h('div', { class: 'kd' }, nav, detail);
}
