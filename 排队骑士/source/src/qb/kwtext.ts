import { KEYWORDS } from './shim';
import type { IconName } from './icons';
import './css/kw-text.css';

// 说明文字的词条只有两种写法，不做「图标 + 短词」叠用：
//   图标 — 图标能单独读懂的数值类（护甲/格挡/法强/反击/寒意/冻结/灼烧，及攻击/生命）：像素图标 + 数字
//   短词 — 其余机制和全部时机：「」包裹 + 各自颜色（「开战时」「嘲讽」「蓄力 3」）
// 图标类的名字只在玩法说明「词条」页出现一次（图例）。
// 卡牌、说明框、图鉴、商店、选项都走这里；单位身上的标记用同一套颜色和图标。
// 释义不跟着单位走，统一放在玩法说明的「词条」页（特性/状态/动作的分类也只在那里出现）。
// 数字可写成「2→3」表示升星后的变化。

export type MechKind = 'trait' | 'status' | 'action';
export const MECH_KIND_NAME: Record<MechKind, string> = { trait: '特性', status: '状态', action: '动作' };

interface MechDef { kind: MechKind; icon: IconName; color: string; /** 像素图标（pixel.ts --pxk-*）；有它就只显示图标 */ px?: PxIcon }
export type PxIcon = 'armor' | 'block' | 'power' | 'thorns' | 'chill' | 'freeze' | 'burn' | 'charge';
export const MECH: Record<string, MechDef> = {
  溅射: { kind: 'trait', icon: 'burst', color: '#ffb340' },
  复生: { kind: 'trait', icon: 'replay', color: '#78f0ff' },
  格挡: { kind: 'status', icon: 'shield', color: '#ffe08a', px: 'block' },
  召唤: { kind: 'action', icon: 'star', color: '#d6a8ff' },
};

export type TrigId = 'start' | 'before' | 'beat' | 'hurt' | 'faint' | 'kill' | 'summon' | 'buy' | 'shop' | 'cond';
/** KEYWORDS 释义 */
const gloss = (k: string) => KEYWORDS[k] ?? '';
interface TrigDef { name: string; icon: IconName; color: string; gloss: string; sample: string }
export const TRIG: Record<TrigId, TrigDef> = {
  start: { name: '开战时', icon: 'flag', color: '#ffd36b', sample: '开战时', gloss: '战斗开始时结算一次，按我方队首、敌方队首、我方第 2 位……的顺序。' },
  before: { name: '交锋前', icon: 'arrowUp', color: '#9fe8ff', sample: '交锋前', gloss: '队首每次交锋前触发；只有站在队首的单位会触发。' },
  beat: { name: '攻击后', icon: 'hourglass', color: '#ff7a9a', sample: '身前友军攻击后', gloss: '双方队首互相攻击一次叫一次交锋；「攻击后」在交锋伤害结算完后触发。' },
  hurt: { name: '受伤时', icon: 'hit', color: '#ff9a6a', sample: '受伤时', gloss: '受到伤害后触发（被格挡挡住不算）。' },
  faint: { name: '阵亡时', icon: 'skull', color: '#b48ce6', sample: '阵亡时', gloss: '写明的单位阵亡时触发。阵亡召唤出现在它原来的位置。' },
  kill: { name: '击杀时', icon: 'kill', color: '#ff6b78', sample: '击杀敌人时', gloss: '自己打死敌人时触发。' },
  summon: { name: '友军被召唤时', icon: 'star', color: '#d6a8ff', sample: '友军被召唤时', gloss: '我方召唤出新单位时触发，复生也算。' },
  buy: { name: '购买时', icon: 'diamond', color: '#7be3a0', sample: '吃补给时', gloss: '在备战阶段结算：购买单位、被购买、合并、购买或吃补给时。' },
  shop: { name: '回合结束时', icon: 'crown', color: '#ffcf4a', sample: '回合结束时', gloss: '点开战时结算，也包括出售、升星。成长写「永久」的会一直保留，写「本场」的只在下一场战斗有效。' },
  cond: { name: '条件触发', icon: 'eye', color: '#8cd4ff', sample: '有格挡时', gloss: '满足写明的条件时触发。' },
};

/** 冒号前的子句属于哪种时机；不像时机的返回 null */
function trigOf(clause: string): TrigId | null {
  return /[时后]$/.test(clause) || /^每/.test(clause) ? trigMatch(clause) : null;
}
/** 时机文本 → 时机类别（卡面与说明共用） */
export function trigMatch(label: string): TrigId {
  if (/开战/.test(label)) return 'start';
  if (/交锋前/.test(label)) return 'before';
  if (/攻击后/.test(label)) return 'beat';
  if (/购买|吃补给|合并|每买/.test(label)) return 'buy';
  if (/回合|出售|升星|刷新/.test(label)) return 'shop';
  if (/召唤/.test(label)) return 'summon';
  if (/击杀/.test(label)) return 'kill';
  if (/阵亡/.test(label)) return 'faint';
  if (/受伤/.test(label)) return 'hurt';
  return 'cond';
}

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
const tint = (c: string) => `--kc:${c};--ka:${hexA(c, 0.16)};--kb:${hexA(c, 0.5)};--kg:${hexA(c, 0.55)}`;
const el = (tag: string, cls: string, style?: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (style) e.setAttribute('style', style);
  return e;
};

/** 数字表达式：「2+法强」里的法强用迷你徽记 */
function numExpr(s: string, cls = 'kv'): HTMLElement {
  const v = el('i', cls);
  const up = /^([+−-]?)(\d+)→(\d+)(.*)$/.exec(s);
  if (up) {
    v.append(up[1] + up[2], Object.assign(el('s', 'kwup'), { textContent: '→' }), Object.assign(el('em', 'kwup-v'), { textContent: up[3] }));
    if (up[4]) v.append(...numTail(up[4]));
    return v;
  }
  const m = /^(.*?)\s*\+\s*法强$/.exec(s);
  if (!m) { v.textContent = s; return v; }
  if (m[1]) v.append(m[1]);
  v.append(powerMini());
  return v;
}
const numTail = (t: string): (string | Node)[] => (/^\s*\+\s*法强$/.test(t) ? [powerMini()] : [t]);
function powerMini() {
  const p = el('span', 'kwp', tint(MECH.法强.color));
  p.append('+', pxIcon('power'));
  return p;
}

// 「」的字形各占半个空白，收紧一点免得短词显得松
const qL = () => Object.assign(el('i', 'kq l'), { textContent: '「' });
const qR = () => Object.assign(el('i', 'kq r'), { textContent: '」' });

/** 像素图标（属性宝石或词条图标） */
export const pxIcon = (id: PxIcon | 'atk' | 'hp', cls = '') => el('span', `kpx px-${id}${cls ? ` ${cls}` : ''}`);

/** 机制标签；before/after 是数字。图标类只出图标 + 数字，named 用于词条页图例 */
export function kwTag(k: string, before = '', after = '', named = false): HTMLElement {
  const d = MECH[k];
  if (!d) {
    const t = TRIG_BY_NAME[k];
    return t ? trigCap(t, k, true) : Object.assign(el('span', 'kwplain'), { textContent: k });
  }
  const num = (before.replace(/\s*层$/, '') || after.replace(/^\s+/, '')).trim();
  if (d.px) {
    const b = el('b', `kwi k-${d.kind}`, tint(d.color));
    b.setAttribute('aria-label', num ? `${k} ${num}` : k);
    b.title = k;
    b.append(pxIcon(d.px));
    if (num) b.append(numExpr(num));
    if (named) b.append(Object.assign(el('span', 'kwi-name'), { textContent: k }));
    return b;
  }
  const b = el('b', `kwt k-${d.kind}`, tint(d.color));
  b.append(qL(), k);
  if (num) b.append(' ', numExpr(num));
  b.append(qR());
  return b;
}
const TRIG_BY_NAME: Record<string, TrigId> = Object.fromEntries(Object.entries(TRIG).map(([id, t]) => [t.name, id as TrigId]));

/** 时机胶囊；内文仍识别机制和数值 */
export function trigCap(id: TrigId, text: string, mini = false): HTMLElement {
  const t = TRIG[id];
  const c = el('span', `kwtrig${mini ? ' mini' : ''}`, tint(t.color));
  // 胶囊自带「」，里面的短词机制（如「蓄力技」的蓄力）不再二次包裹
  c.append(qL(), ...inline(text, false, true), qR());
  return c;
}

function numeric(stat: 'atk' | 'hp', label: string, value: string, labelFirst = true): HTMLElement {
  // 属性宝石代替「攻击」「生命」二字；labelFirst 只决定原文语序，显示统一为 宝石 + 数字
  void label; void labelFirst;
  const n = el('span', `kwn kwn-${stat}`);
  n.setAttribute('aria-label', `${stat === 'atk' ? '攻击' : '生命'} ${value}`);
  n.append(pxIcon(stat), numExpr(value.replace(/\s+/g, '').replace(/攻$/, '')));
  return n;
}

const MECH_RE = Object.keys(MECH).sort((a, b) => b.length - a.length).join('|');
const STACKABLE = '格挡';
const NUMBERED = '格挡';
const D = String.raw`\d+(?:→\d+)?`;
const NUM = String.raw`${D}(?:\s*\+\s*法强)?`;
const INLINE_TRIG: Record<string, TrigId> = { 开战: 'start' };
type Rule = [RegExp, (m: RegExpExecArray, trig: boolean, inCap: boolean) => Node | null];
const RULES: Rule[] = [
  // +2 格挡
  [new RegExp(`([+−-]?${D})\\s*格挡`, 'y'), (m) => kwTag('格挡', '', m[1])],
  // 2 层寒意 / 2+法强 层灼烧
  [new RegExp(`(${NUM})\\s*层(${STACKABLE})`, 'y'), (m) => kwTag(m[2], `${m[1]} 层`.replace(/\s+层/, ' 层'))],
  // 格挡 2 / 法强 +1 / 护甲 −1
  [new RegExp(`(${NUMBERED})\\s*([+−-]?\\s*${D})(?![\\d层→])`, 'y'), (m) => kwTag(m[1], '', m[2].replace(/\s+/g, ''))],
  // +2/+2 = 攻击/生命
  [new RegExp(`([+−-]${D})/([+−-]${D})`, 'y'), (m) => {
    const p = el('span', 'kwn-pair');
    p.append(numExpr(m[1], 'kv a'), Object.assign(el('s', 'kwn-sep'), { textContent: '/' }), numExpr(m[2], 'kv h'));
    return p;
  }],
  [new RegExp(`攻击\\s*([+−-]\\s*(?:${NUM}|法强))`, 'y'), (m) => numeric('atk', '攻击', m[1])],
  [new RegExp(`([+−-]\\s*${D})\\s*攻(?!击)`, 'y'), (m) => numeric('atk', '', `${m[1].replace(/\s+/g, '')} 攻`)],
  [new RegExp(`生命\\s*([+−-]\\s*${NUM})`, 'y'), (m) => numeric('hp', '生命', m[1])],
  [new RegExp(`(${NUM})\\s*生命(?!最)`, 'y'), (m) => numeric('hp', '生命', m[1], false)],
  // 伤害、治疗里的「3+法强」
  [new RegExp(`(${D})\\s*\\+\\s*法强`, 'y'), (m) => numExpr(`${m[1]}+法强`, 'kv x')],
  // 其余裸数字里的升星变化
  [/(\d+)→(\d+)/y, (m) => numExpr(m[0], 'kv x')],
  [new RegExp(`(?:${MECH_RE})`, 'y'), (m, _t, inCap) => (inCap && !MECH[m[0]].px ? document.createTextNode(m[0]) : kwTag(m[0]))],
  [/开战/y, (m, trig) => (trig ? trigCap(INLINE_TRIG[m[0]], m[0], true) : null)],
];

function inline(text: string, trig: boolean, inCap = false): (string | Node)[] {
  const out: (string | Node)[] = [];
  let buf = '';
  for (let i = 0; i < text.length;) {
    let hit: Node | null = null, len = 0;
    for (const [re, mk] of RULES) {
      re.lastIndex = i;
      const m = re.exec(text);
      if (m && (hit = mk(m, trig, inCap))) { len = m[0].length; break; }
    }
    if (hit) { if (buf) out.push(buf); buf = ''; out.push(hit); i += len; }
    else buf += text[i++];
  }
  if (buf) out.push(buf);
  return out;
}

/** 释义正文用：只着色机制和数值，不生成时机胶囊 */
export const kwInline = (text: string) => inline(text, false);

/** 把描述文本转成富文本子节点：每个分句开头的「……：」若是时机，变成胶囊 */
export function kwRich(text: string): (string | Node)[] {
  const out: (string | Node)[] = [];
  for (const seg of text.match(/[^；。]+[；。]?|[；。]/g) ?? []) {
    const m = /^(\s*)([^：；。]{1,22})：\s*/.exec(seg);
    const id = m ? trigOf(m[2].replace(/（[^）]*）$/, '')) : null;
    if (m && id) {
      const pm = /^(.*?)(（[^）]*）)$/.exec(m[2]);
      if (m[1]) out.push(m[1]);
      out.push(trigCap(id, pm ? pm[1] : m[2]));
      if (pm) out.push(Object.assign(el('span', 'kwtrig-note'), { textContent: pm[2] }));
      out.push(...inline(seg.slice(m[0].length), true));
    } else out.push(...inline(seg, true));
  }
  return out;
}

/** 机制释义正文（去掉「特性。」「状态。」前缀，类别改用小标表示） */
export const mechGloss = gloss;

/** 升星只改数字时，合成一句「2→3」；结构变了（多了效果）返回 null */
export function kwUpgrade(a: string, b: string): string | null {
  const x = a.split(/(\d+)/), y = b.split(/(\d+)/);
  if (x.length !== y.length || x.some((t, i) => i % 2 === 0 && t !== y[i])) return null;
  return x.map((t, i) => (i % 2 && t !== y[i] ? `${t}→${y[i]}` : t)).join('');
}
