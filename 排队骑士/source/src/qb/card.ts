import { ALL, card, FOOD, KW_INFO } from '../core/data';
import { FACTION_INFO, RARITY_NAMES, unitDef, type Rarity } from './shim';
import { h } from './dom';
import { icon } from './icons';
import { kwRich, kwTag, trigCap, trigMatch, type TrigId } from './kwtext';
import { unitSvg } from './unitArt';
import { itemIcon } from './pixelItems';

export interface CardOpts {
  /** 若与已上阵单位同名：合并后的等级 */
  mergeTo?: number;
  maxed?: boolean;
  /** 叠加进度（未到升星时）：如「2/3」 */
  stack?: string;
  /** 升星奖励卡 */
  bonus?: boolean;
  /** 图鉴按星级浏览时显示对应星级的数值 */
  level?: number;
  /** 罐头等额外攻血 */
  plus?: number;
  /** 只覆盖卡面展示数值；用于已拥有单位和规则计算后的预览 */
  displayStats?: Readonly<{ atk: number; hp: number }>;
}

/** 卡面文案：{v} {u} 换成该星级数值 */
export function cardText(id: string, lvl = 1) {
  const d = card(id);
  return d.text.replace(/\{v\}/g, String(d.v?.[lvl - 1] ?? '')).replace(/\{u\}/g, String(d.u?.[lvl - 1] ?? ''));
}
/** 卡牌摘要标签：技能时机 + 天生词条 */
export function cardLabels(id: string): string[] {
  const d = card(id);
  const out: string[] = [];
  const m = /^([^：]{1,10})：/.exec(d.text);
  if (m) out.push(m[1].replace(/（.*$/, ''));
  if (d.inherit) out.push('传承');
  for (const k of d.kws) out.push(KW_INFO[k].name);
  return out.slice(0, 2);
}

export function draftCard(defId: string, o: CardOpts = {}) {
  const d = unitDef(defId);
  const c = card(defId);
  const f = FACTION_INFO[d.faction];
  const lvl = o.level ?? 1;
  const plus = o.plus ?? 0;
  const add = lvl === 1 ? 0 : lvl === 2 ? 2 : 5;
  return h(
    'div',
    { class: `card tier-${d.tier} fac-${d.faction}`, style: `--fc:${f.color};--fd:${f.dark};--pxf:var(--pxf-${d.faction});--pxm:var(--pxm-${d.faction});--pxs:var(--pxs-${d.faction})`, 'data-id': defId },
    h(
      'div',
      { class: 'card-in' },
      h('div', { class: 'card-shine' }),
      h('i', { class: 'card-sigil' }),
      h('div', { class: 'card-top' }, h('span', { class: 'card-fac' }, c.perm ? '永久成长' : ''), h('span', { class: 'card-tier' }, tierBadge(d.tier))),
      tierArt('card-art', defId, d.tier),
      h('i', { class: 'card-gems', style: `--n:${d.tier}` }),
      h('div', { class: 'card-name' }, d.name),
      h('div', { class: 'card-brief card-keywords' }, ...cardLabels(defId).map(previewTag)),
      h('div', { class: 'card-text' }, ...kwRich(cardText(defId, lvl))),
      h(
        'div',
        { class: 'card-stats' },
        h('span', { class: 'cs atk' }, icon('sword'), h('i', null, o.displayStats?.atk ?? c.atk + add + plus)),
        h('span', { class: 'cs hp' }, icon('heart'), h('i', null, o.displayStats?.hp ?? c.hp + add + plus)),
      ),
    ),
    o.mergeTo
      ? h('div', { class: 'card-badge' }, icon('arrowUp'), `升 ${o.mergeTo}星`)
      : o.stack
        ? h('div', { class: 'card-badge stack' }, o.stack)
        : o.maxed
          ? h('div', { class: 'card-badge maxed' }, '已满6份')
          : null,
  );
}

/** 补给 icon 行：目标 · 攻血 · 时长（不写长文） */
export function foodRow(id: string, val?: [number, number]) {
  const fd = FOOD[id];
  const [a, hp] = val ?? [fd.atk ?? 0, fd.hp ?? 0];
  if (id === 'f_can') return null;
  const tgt = fd.n === ALL ? '全队' : fd.around ? '目标与前后' : fd.behind ? '目标与身后' : fd.n ? `随机${fd.n}` : '单体';
  const chip = (cls: string, ...k: (string | Node)[]) => h('span', { class: `fr-chip ${cls}` }, ...k);
  return h('div', { class: 'food-row' },
    chip(fd.n === ALL ? 'fr-all' : 'fr-tgt', icon(fd.n === ALL ? 'flag' : 'target'), tgt),
    a ? chip('fr-atk', icon('sword'), `+${a}`) : null,
    hp ? chip('fr-hp', icon('heart'), `+${hp}`) : null,
    id === 'f_elixir' ? null : fd.tmp ? chip('fr-tmp', icon('hourglass'), '本场') : chip('fr-perm', icon('star'), '永久'));
}
/** 补给卡：同一套卡框（中立色），立绘换成像素道具 */
export function foodCard(id: string, val?: [number, number]) {
  const fd = FOOD[id];
  const f = FACTION_INFO.neutral;
  return h(
    'div',
    { class: `card food-card tier-${fd.tier} fac-neutral`, style: `--fc:${f.color};--fd:${f.dark};--pxf:var(--pxf-neutral);--pxm:var(--pxm-neutral);--pxs:var(--pxs-neutral)`, 'data-id': id },
    h(
      'div',
      { class: 'card-in' },
      h('div', { class: 'card-shine' }),
      h('div', { class: 'card-top' }, h('span', { class: 'card-fac' }, '补给'), h('span', { class: 'card-tier' }, tierBadge(fd.tier))),
      h('div', { class: 'card-art food-art' }, itemIcon(id, 'pack', 'food-icon')),
      h('i', { class: 'card-gems', style: `--n:${fd.tier}` }),
      h('div', { class: 'card-name' }, fd.name),
      h('div', { class: 'card-text' }, foodRow(id, val), fd.short ? h('div', { class: 'fr-short' }, ...kwRich(fd.short)) : null),
    ),
  );
}

/** 阶级徽记（像素符号）：同一颗宝石逐阶加冕——一阶原石 → 二阶金托 → 三阶小翼 → 四阶展翼+绶带 → 五阶加冠 → 六阶大冠。
 *  x 主体（自动上亮下暗）、g 金、o 高光填色、k 深色刻线、w 白、r 主色；空格旁自动描黑边。 */
const TIER_PX: string[][] = [
  [
    '.................',
    '.................',
    '.................',
    '........o........',
    '.......oox.......',
    '......oowxx......',
    '.....ooxxxxk.....',
    '......oxxxk......',
    '.......xxk.......',
    '........k........',
    '.................',
    '.................',
    '.................',
  ],
  [
    '.................',
    '.................',
    '........g........',
    '........g........',
    '.......gog.......',
    '......gowxg......',
    '....ggoxxxkgg....',
    '......gxxkg......',
    '.......gkg.......',
    '........g........',
    '........g........',
    '.................',
    '.................',
  ],
  [
    '.................',
    '.................',
    '........g........',
    '..x.....g.....x..',
    '.xwx...gog...xwx.',
    '.xwxx.gowxg.xxwx.',
    '..xxxgoxxxkgxxx..',
    '....x.gxxkg.x....',
    '.......gkg.......',
    '........g........',
    '........g........',
    '.................',
    '.................',
  ],
  [
    '.................',
    'x...............x',
    'xwx.....g.....xwx',
    'xwxx....g....xxwx',
    '.xwxx..gog..xxwx.',
    '.xxwxxgowxgxxwxx.',
    '..xxxgoxxxkgxxx..',
    '...xxxgxxkgxxx...',
    '....x..gkg..x....',
    '........g........',
    '......xxgxx......',
    '.....xx...xx.....',
    '.....x.....x.....',
  ],
  [
    '......g.g.g......',
    'x.....ggggg.....x',
    'xwx...grgrg...xwx',
    'xwxx...ggg...xxwx',
    '.xwxx..gog..xxwx.',
    '.xxwxxgowxgxxwxx.',
    '..xxxgoxxxkgxxx..',
    '...xxxgxxkgxxx...',
    '....x..gkg..x....',
    '........g........',
    '......xxgxx......',
    '.....xx...xx.....',
    '.....x.....x.....',
  ],
  [
    'x...g.g.g.g.g...x',
    'xx..ggggggggg..xx',
    'xwx..grgrgrg..xwx',
    'xwxx..ggggg..xxwx',
    '.xwxx..gog..xxwx.',
    '.xxwxxgowxgxxwxx.',
    '..xxxgoxxxkgxxx..',
    '...xxxgxxkgxxx...',
    '....x..gkg..x....',
    '........g........',
    '......xxgxx......',
    '.....xwx.xwx.....',
    '....xx.....xx....',
  ]
];
const TIER_SVG: string[] = [];
function tierSvg(tier: number) {
  if (TIER_SVG[tier]) return TIER_SVG[tier];
  const rows = TIER_PX[tier - 1];
  const W = Math.max(...rows.map((r) => r.length)) + 2, H = rows.length + 2;
  const at = (x: number, y: number) => rows[y - 1]?.[x - 1] ?? '.';
  const paths: Record<string, string> = {};
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = at(x, y);
      let cls: string;
      if (ch === '.') {
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && at(x + dx, y + dy) !== '.') { near = true; break; }
        if (!near) continue;
        cls = 'ol';
      } else if (ch === 'x' || ch === 'g') {
        const edge = at(x, y - 1) === '.' || at(x - 1, y) === '.' ? 'l' : at(x, y + 1) === '.' || at(x + 1, y) === '.' ? 's' : 'c';
        cls = (ch === 'g' ? 'g' : 't') + edge;
      } else cls = ({ o: 'tl', k: 'td', w: 'w', r: 'tc' } as Record<string, string>)[ch] ?? 'tc';
      paths[cls] = (paths[cls] ?? '') + `M${x} ${y}h1v1h-1z`;
    }
  const body = Object.entries(paths).map(([c, d]) => `<path class="p-${c}" d="${d}"/>`).join('');
  return (TIER_SVG[tier] = `<svg class="tb-px" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`);
}
/** 阶级徽记：像素符号 + 逐阶加强的光（三阶起呼吸光晕、五阶起背后转动光芒、六阶星屑；样式见 card-tiers.css） */
export function tierBadge(tier: Rarity) {
  const el = h('span', { class: `tier-badge rarity-${tier}`, role: 'img', 'aria-label': RARITY_NAMES[tier], title: RARITY_NAMES[tier] },
    tier >= 2 ? h('i', { class: 'tb-glow' }) : '',
    tier >= 5 ? h('i', { class: 'tb-rays' }) : '',
  );
  el.insertAdjacentHTML('beforeend', tierSvg(tier));
  if (tier >= 6) el.append(h('i', { class: 'tb-spark s1' }), h('i', { class: 'tb-spark s2' }));
  return el;
}

/** 单位身后的阶层光效（一阶不渲染）：二阶脚光 → 三阶光点 → 四阶背光柱 → 五阶星芒 → 六阶赤金余烬。
 *  招募卡、图鉴、阵容头像、整备等所有单位立绘共用；上场战斗的单位不挂。 */
export function tierAura(tier: number) {
  if (tier <= 1) return null;
  return h('i', { class: `card-aura tier-${tier}`, 'aria-hidden': 'true' },
    h('b', { class: 'a-pillar' }), h('b', { class: 'a-glow' }),
    h('b', { class: 'a-motes m1' }), h('b', { class: 'a-motes m2' }), h('b', { class: 'a-motes m3' }),
    h('b', { class: 'a-spark s1' }), h('b', { class: 'a-spark s2' }));
}

/** 立绘 + 阶层光效 */
export function tierArt(cls: string, defId: string, tier: number, tag: 'div' | 'span' = 'div') {
  const art = h(tag, { class: `${cls} has-aura`, html: unitSvg(defId) });
  const aura = tierAura(tier);
  if (aura) art.prepend(aura);
  return art;
}

export const PREVIEW_TRIG: Record<string, TrigId> = {};

function previewTag(label: string) {
  return /[时后]$|^每次交锋|^每回合/.test(label) ? trigCap(triggerOf(label), label, true) : kwTag(label);
}
const triggerOf = (label: string): TrigId => trigMatch(label);
