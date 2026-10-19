// 图鉴：标题页进入。单位 / 将军 / 装备 / 法术与招募令，外加按阵营整理的推荐阵容。
// 全部点按操作；推荐只给思路，不影响局内抽卡。
import { EQUIPS, GENERALS, ORDERS, SPELLS } from '../core/content';
import { DRAFT_POOL, FACTION_INFO, FACTION_ORDER, RARITY_NAMES, ROLE_TAGS, tagFamily, unitDef } from '../core/data';
import { COMBOS } from '../core/combos';
import type { Faction, UnitDef } from '../core/types';
import { sfx } from './audio';
import { h } from './dom';
import { icon } from './icons';
import { kwInline, kwRich, kwTag, MECH, MECH_KIND_NAME, mechGloss, TRIG, trigCap, type MechKind, type TrigId } from './kwtext';
import { describe } from '../core/run';
import { levelStats } from '../core/engine';
import { itemIcon } from './pixelItems';
import { generalTip, unitTip } from './tip';
import { unitSvg } from './unitArt';

const TIPS = [
  '前排放血厚、带护卫或护甲的单位；施法单位放后排。',
  '三张同名卡合并升星，星级越高能力数值越大。',
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

type Tab = 'rec' | 'unit' | 'gen' | 'kw' | 'eq' | 'sp';

export function codexScreen(onBack: () => void) {
  const TABS: [Tab, string][] = [['rec', '推荐阵容'], ['unit', '单位'], ['gen', '将军'], ['kw', '词条'], ['eq', '装备'], ['sp', '法术与招募令']];
  const body = h('div', { class: 'cx-body' });
  const tabBtns = TABS.map(([k, name]) => h('button', { class: 'cx-tab', onclick: () => { sfx.click(); go(k); } }, name));
  let fac: Faction = 'light';
  let unitSel: string | null = null;
  /** 单位页的星级维度：网格和详情都按这个星级显示 */
  let star = 1;
  let comboSel = 0;

  const go = (tab: Tab) => {
    tabBtns.forEach((b, i) => b.classList.toggle('on', TABS[i][0] === tab));
    body.replaceChildren(tab === 'rec' ? recView() : tab === 'unit' ? unitView() : tab === 'gen' ? genView() : tab === 'kw' ? keywordDoc() : itemView(tab));
    body.scrollTop = 0;
  };
  const openUnit = (id: string) => { sfx.click(); fac = unitDef(id).faction; unitSel = id; go('unit'); };

  const unitChip = (id: string, sub?: string) => {
    const d = unitDef(id);
    return h('button', { class: `cx-chip tier-${d.tier}`, style: `--fc:${FACTION_INFO[d.faction].color}`, onclick: () => openUnit(id) },
      h('span', { class: 'cx-chip-art', html: unitSvg(id) }), h('b', null, d.name), sub ? h('span', null, sub) : null);
  };
  const itemChip = (id: string) =>
    h('span', { class: 'cx-item-chip' }, itemIcon(id, 'spell', 'sm'), ITEM_NAME[id] ?? id);

  // ── 推荐阵容 ──
  const recView = () => {
    const list = h('div', { class: 'cx-combos' });
    const detail = h('div', { class: 'cx-combo' });
    const show = (i: number) => {
      comboSel = i;
      list.querySelectorAll('.cx-combo-btn').forEach((b, k) => b.classList.toggle('on', k === i));
      const c = COMBOS[i], f = FACTION_INFO[c.faction], g = GENERALS.find((x) => x.id === c.general)!;
      detail.style.setProperty('--fc', f.color);
      detail.replaceChildren(
        h('div', { class: 'cx-combo-head' }, h('b', null, c.name), h('span', { class: 'cx-fac' }, f.name), h('span', { class: 'cx-gen' }, `推荐将军：${g.name} · ${g.title}`)),
        h('p', { class: 'cx-idea' }, c.idea),
        h('div', { class: 'cx-line' }, c.units.map((id, k) => h('div', { class: 'cx-slot' }, h('span', { class: 'cx-no' }, `${k + 1}号位`), unitChip(id), h('p', null, c.roles[k])))),
        h('div', { class: 'cx-extras' }, h('span', null, '可搭配：'), c.extras.map(itemChip)),
        h('p', { class: 'cx-note' }, '点头像查看单位详情。阵营每局随机开放，抽不到时用同机制的卡替换即可。'),
      );
    };
    list.replaceChildren(...COMBOS.map((c, i) => h('button', { class: 'cx-combo-btn', style: `--fc:${FACTION_INFO[c.faction].color}`, onclick: () => { sfx.click(); show(i); } },
      h('span', { class: 'cx-fac' }, FACTION_INFO[c.faction].name), h('b', null, c.name))));
    show(comboSel);
    return h('div', { class: 'cx-split' },
      h('div', { class: 'cx-side' }, list),
      h('div', { class: 'cx-main' }, detail, h('div', { class: 'cx-tips' }, h('b', null, '组队要点'), h('ul', null, TIPS.map((t) => h('li', null, t))))));
  };

  // ── 单位 ──
  const unitView = () => {
    const grid = h('div', { class: 'cx-grid' });
    const detail = h('div', { class: 'cx-detail' });
    const facs = h('div', { class: 'cx-facs' }, FACTION_ORDER.map((k) => h('button', {
      class: `cx-facbtn${k === fac ? ' on' : ''}`, style: `--fc:${FACTION_INFO[k].color}`,
      onclick: () => { sfx.click(); fac = k; unitSel = null; go('unit'); },
    }, FACTION_INFO[k].name)),
    h('div', { class: 'cx-stars' }, [1, 2, 3].map((lv) => h('button', {
      class: `cx-starbtn${lv === star ? ' on' : ''}`, 'aria-label': `${lv} 星`,
      onclick: () => { if (lv === star) return; sfx.click(); star = lv; go('unit'); },
    }, '★'.repeat(lv)))));
    const defs = DRAFT_POOL.filter((d) => d.faction === fac).sort((a, b) => a.tier - b.tier);
    const show = (id: string) => {
      unitSel = id;
      grid.querySelectorAll<HTMLElement>('.cx-unit').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
      const d = unitDef(id);
      const mates = partners(d);
      detail.replaceChildren(
        h('div', { class: 'cx-d-head' }, h('div', { class: 'cx-d-art', html: unitSvg(id) }),
          h('div', null, h('b', { class: 'cx-d-name' }, d.name), h('span', { class: `cx-rar rarity-${d.tier}` }, RARITY_NAMES[d.tier]),
            h('div', { class: 'cx-tags' }, (d.tags ?? []).map((t) => h('span', null, t))))),
        h('section', { class: 'cx-lv' }, unitTip(id, star, null, false)),
        ...(mates.length ? [h('div', { class: 'cx-mates' }, h('b', null, '搭配推荐'), h('div', null, mates.map((m) => unitChip(m.id))))] : []),
      );
      detail.scrollTop = 0;
    };
    grid.replaceChildren(...defs.map((d) => h('button', { class: `cx-unit tier-${d.tier}`, 'data-id': d.id, onclick: () => { sfx.click(); show(d.id); } },
      h('span', { class: 'cx-unit-art', html: unitSvg(d.id) }), h('b', null, d.name),
      h('span', null, RARITY_NAMES[d.tier], h('span', { class: 'cx-unit-st' }, icon('sword'), h('i', null, levelStats(d.id, star).atk), icon('heart'), h('i', null, levelStats(d.id, star).hp))))));
    show(unitSel && defs.some((d) => d.id === unitSel) ? unitSel : defs[0].id);
    return h('div', { class: 'cx-units', style: `--fc:${FACTION_INFO[fac].color}` }, facs, h('div', { class: 'cx-split' }, grid, detail));
  };

  // ── 将军 ──
  const genView = () => h('div', { class: 'cx-gens' }, GENERALS.map((g) => {
    const f = FACTION_INFO[g.faction];
    const combos = COMBOS.filter((c) => c.general === g.id);
    return h('div', { class: 'cx-gen-card', style: `--fc:${f.color}` },
      h('div', { class: 'cx-gen-art', html: unitSvg(null, { general: g.id }) }),
      h('div', { class: 'cx-gen-info' }, generalTip(g.id),
        combos.length ? h('div', { class: 'cx-gen-rec' }, h('span', null, '推荐阵容：'), combos.map((c) =>
          h('button', { class: 'cx-link', onclick: () => { sfx.click(); comboSel = COMBOS.indexOf(c); go('rec'); } }, c.name))) : null));
  }));

  // ── 装备 / 法术与招募令 ──
  const itemView = (tab: 'eq' | 'sp') => {
    const tile = (id: string, name: string, text: string, price: string, fb: 'spell' | 'order', note?: string) =>
      h('div', { class: 'cx-item' }, h('span', { class: 'cx-item-icon' }, itemIcon(id, fb)),
        h('div', null, h('b', null, name, h('i', { class: 'cx-price' }, itemIcon('coin', 'coin', 'sm'), price)), h('p', null, ...kwRich(text)), note ? h('p', { class: 'cx-item-note' }, note) : null));
    if (tab === 'eq') return h('div', null,
      h('p', { class: 'cx-intro' }, '商店里购买，拖到单位身上装备；每个单位一般只能带一件，出售单位时装备退回背包。'),
      h('div', { class: 'cx-items' }, EQUIPS.map((e) => tile(e.id, e.name, e.text, `${e.price}`, 'spell'))));
    return h('div', null,
      h('p', { class: 'cx-intro' }, '法术在布阵时使用，只对下一场战斗生效。'),
      h('div', { class: 'cx-items' }, SPELLS.map((s) => tile(s.id, s.name, s.text, `${s.price}`, 'spell'))),
      h('p', { class: 'cx-intro' }, '招募令在招募时使用，重新生成本轮候选卡。'),
      h('div', { class: 'cx-items' }, ORDERS.map((o) => tile(o.id, o.name, o.text, o.price[0] === o.price[1] ? `${o.price[0]}` : `${o.price[0]}~${o.price[1]}`, 'order'))));
  };

  const back = h('button', { class: 'btn ghost cx-back', onclick: () => { sfx.click(); onBack(); } }, icon('x'), h('span', null, '返回'));
  const el = h('div', { class: 'screen codex' },
    h('div', { class: 'cx-head' }, back, h('div', { class: 'cx-title' }, '图鉴'), h('div', { class: 'cx-tabs' }, tabBtns)),
    body);
  go('rec');
  return el;
}

/** 词条说明：图鉴「词条」页和玩法说明共用；释义只在这里出现，不跟着单位走 */
export function keywordDoc() {
  const pool = DRAFT_POOL.map((d) => [1, 2, 3].map((lv) => describe(d.id, lv)).join('；'));
  const count = (k: string) => pool.filter((t) => t.includes(k)).length;
  const legend = h('div', { class: 'cx-kw-legend' },
    h('div', { class: 'lg-col' }, h('b', null, '时机'), h('span', { class: 'lg-q' }, '什么时候生效'),
      h('div', { class: 'lg-eg' }, trigCap('start', '开战时'), trigCap('cast', '施法'), trigCap('beat', '每拍结束时')),
      h('p', null, '浅色胶囊，写在效果前面。')),
    h('div', { class: 'lg-col' }, h('b', null, '机制'), h('span', { class: 'lg-q' }, '按什么规则生效'),
      h('div', { class: 'lg-eg' }, kwTag('狙击'), kwTag('格挡', '2 层'), kwTag('立即出手')),
      h('p', null, '图标 + 彩色加粗；数字收进标签里。')),
    h('div', { class: 'lg-col' }, h('b', null, '数值'), h('span', { class: 'lg-q' }, '加减多少'),
      h('div', { class: 'lg-eg' }, ...kwRich('攻击 +2'), ...kwRich('生命 +3'), ...kwRich('本场 +2/+2')),
      h('p', null, '只有攻击、生命：图标 + 着色数字，不加粗。')));
  const MARK: Record<string, string> = {
    护卫: '单位前方金色盾形', 复生: '脚下青色光环', 护甲: '脚下标签', 反击: '脚下标签', 连击: '脚下标签', 狙击: '脚下标签', 溅射: '脚下标签', 法强: '脚下标签',
    格挡: '属性栏盾牌数', 寒意: '头顶冰晶角标', 灼烧: '头顶火焰角标', 易伤: '头顶靶心角标', 冻结: '单位冰封',
  };
  const card = (tag: HTMLElement, body: (string | Node)[], foot?: string) =>
    h('div', { class: 'cx-kw-card' }, h('div', { class: 'kc-tag' }, tag), h('p', null, ...body), foot ? h('div', { class: 'kc-foot' }, foot) : null);
  const trigIds = Object.keys(TRIG) as TrigId[];
  const kinds: MechKind[] = ['trait', 'status', 'action'];
  const KIND_HINT: Record<MechKind, string> = { trait: '常驻能力', status: '可叠层、会被消耗', action: '一次性效果' };
  return h('div', { class: 'cx-kw' },
    legend,
    h('h3', { class: 'cx-kw-h' }, h('span', null, '时机'), h('i', null, '效果什么时候发动')),
    h('div', { class: 'cx-kw-grid' }, trigIds.map((id) => card(trigCap(id, TRIG[id].sample), kwInline(TRIG[id].gloss)))),
    ...kinds.flatMap((kd) => [
      h('h3', { class: 'cx-kw-h' }, h('span', null, `机制 · ${MECH_KIND_NAME[kd]}`), h('i', null, KIND_HINT[kd])),
      h('div', { class: 'cx-kw-grid' }, Object.keys(MECH).filter((k) => MECH[k].kind === kd).map((k) => {
        const n = count(k);
        return card(kwTag(k), kwInline(mechGloss(k)), [MARK[k] ? `单位标记：${MARK[k]}` : '', n ? `${n} 张卡涉及` : ''].filter(Boolean).join('　·　'));
      })),
    ]),
    h('h3', { class: 'cx-kw-h' }, h('span', null, '数值'), h('i', null, '只有攻击和生命')),
    h('div', { class: 'cx-kw-grid' },
      card(h('span', null, ...kwRich('攻击 +2')), ['普攻伤害。', ...kwRich('寒意'), '会在下次出手时临时压低它。']),
      card(h('span', null, ...kwRich('生命 +3')), ['降到 0 阵亡。恢复生命不超过上限。']),
      card(h('span', null, ...kwRich('+2/+2')), ['同时加攻击和生命，前一个是攻击、后一个是生命。']),
      card(h('span', null, ...kwRich('3+法强')), ['施法数值写成「N+法强」，会加上自己的', ...kwRich('法强'), '。']),
      card(h('span', null, ...kwRich('格挡 2→3')), ['说明框里的「→」和绿色数字：升一星后的数值。'])));
}
