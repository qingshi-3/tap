import { KEYWORDS } from '../core/data';
import { icon, type IconName } from './icons';
import '../kw-text.css';

// 说明文字的三层词条：
//   时机 — 实心胶囊，回答「什么时候」（开战时、施法、每拍结束时……）
//   机制 — 图标 + 彩色加粗；带数字的把数字收进标签（格挡 2、法强 +1、2 层寒意）
//   数值 — 只有攻击/生命：属性图标 + 着色数字，不加粗
// 卡牌、说明框、图鉴、商店、选项都走这里；单位身上的标记用同一套颜色和图标。
// 释义不跟着单位走，统一放在玩法说明的「词条」页（特性/状态/动作的分类也只在那里出现）。
// 数字可写成「2→3」表示升星后的变化。

export type MechKind = 'trait' | 'status' | 'action';
export const MECH_KIND_NAME: Record<MechKind, string> = { trait: '特性', status: '状态', action: '动作' };

interface MechDef { kind: MechKind; icon: IconName; color: string }
export const MECH: Record<string, MechDef> = {
  护卫: { kind: 'trait', icon: 'guard', color: '#ffd36b' },
  护甲: { kind: 'trait', icon: 'plate', color: '#b9c7d8' },
  反击: { kind: 'trait', icon: 'spikes', color: '#ff8a6a' },
  连击: { kind: 'trait', icon: 'combo', color: '#ff7ab0' },
  狙击: { kind: 'trait', icon: 'snipe', color: '#9fe870' },
  溅射: { kind: 'trait', icon: 'burst', color: '#ffb340' },
  法强: { kind: 'trait', icon: 'sparkle', color: '#c99bff' },
  复生: { kind: 'trait', icon: 'replay', color: '#78f0ff' },
  放逐: { kind: 'trait', icon: 'skull', color: '#b8bdd6' },
  格挡: { kind: 'status', icon: 'shield', color: '#ffe08a' },
  寒意: { kind: 'status', icon: 'snow', color: '#8feaff' },
  冻结: { kind: 'status', icon: 'snow', color: '#c4f6ff' },
  灼烧: { kind: 'status', icon: 'fire', color: '#ff9a3d' },
  易伤: { kind: 'status', icon: 'target', color: '#ff7ad9' },
  行动次数: { kind: 'status', icon: 'hourglass', color: '#ffe36b' },
  献祭: { kind: 'action', icon: 'skull', color: '#d6a8ff' },
  立即攻击: { kind: 'action', icon: 'bolt', color: '#ffe36b' },
  召唤: { kind: 'action', icon: 'star', color: '#d6a8ff' },
};

export type TrigId = 'start' | 'cast' | 'attack' | 'hurt' | 'kill' | 'faint' | 'beat' | 'cond';
interface TrigDef { name: string; icon: IconName; color: string; gloss: string; sample: string }
export const TRIG: Record<TrigId, TrigDef> = {
  start: { name: '开战时', icon: 'flag', color: '#ffd36b', sample: '开战时', gloss: '战斗开始时结算一次。单位的开战效果按我1、敌1、我2、敌2……的站位顺序结算，之后才进入常规行动。' },
  cast: { name: '施法', icon: 'wand', color: '#c9a4ff', sample: '施法', gloss: KEYWORDS.施法 },
  attack: { name: '普攻后', icon: 'sword', color: '#ffb46a', sample: '普攻后', gloss: '自己普攻结算后触发；「命中」类时机只在普攻打中目标时触发。' },
  hurt: { name: '受击时', icon: 'hit', color: '#ff9a6a', sample: '受击时', gloss: '自己受到伤害时触发，包括替友军承伤。' },
  kill: { name: '击杀时', icon: 'kill', color: '#ff6b78', sample: '击杀时', gloss: '自己击杀敌人时触发。' },
  faint: { name: '阵亡时', icon: 'tomb', color: '#c590ff', sample: '阵亡时', gloss: '阵亡（或复生复活）时触发；友军阵亡类时机看的是其他单位。' },
  beat: { name: '每拍结束时', icon: 'hourglass', color: '#ff7a9a', sample: '每拍结束时', gloss: '每拍双方至多各一人常规行动；一方等待时，拍末仍照常结算。主将倒计时与灼烧都按拍计算；「每第 3 拍」指第 3、6、9……拍，不是回合。' },
  cond: { name: '条件触发', icon: 'eye', color: '#8cd4ff', sample: '普攻目标有寒意时', gloss: '满足写明的条件时触发，条件写在胶囊里。' },
};

/** 冒号前的子句属于哪种时机；不像时机的（如「选一个标签：」）返回 null */
function trigOf(clause: string): TrigId | null {
  if (/开战/.test(clause)) return 'start';
  if (/施法/.test(clause)) return 'cast';
  if (/阵亡|复活/.test(clause)) return 'faint';
  if (/击杀/.test(clause)) return 'kill';
  if (/受击|承伤|受伤|打掉|低于/.test(clause)) return 'hurt';
  if (/普攻|命中/.test(clause)) return 'attack';
  if (/拍/.test(clause)) return 'beat';
  if (/[时后]$/.test(clause)) return 'cond';
  return null;
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
  p.append('+', icon('sparkle', 'kw-ic'), '法强');
  return p;
}

/** 机制标签；before/after 是收进标签里的数字 */
export function kwTag(k: string, before = '', after = ''): HTMLElement {
  const d = MECH[k];
  if (!d) {
    const t = TRIG_BY_NAME[k];
    return t ? trigCap(t, k) : Object.assign(el('b', 'kwt'), { textContent: k });
  }
  const b = el('b', `kwt k-${d.kind}`, tint(d.color));
  b.appendChild(icon(d.icon, 'kw-ic'));
  if (before) b.append(numExpr(before), ' ');
  b.append(k);
  if (after) b.append(' ', numExpr(after.replace(/^\s+/, '')));
  return b;
}
const TRIG_BY_NAME: Record<string, TrigId> = Object.fromEntries(Object.entries(TRIG).map(([id, t]) => [t.name, id as TrigId]));

/** 时机胶囊；内文仍识别机制和数值 */
export function trigCap(id: TrigId, text: string, mini = false): HTMLElement {
  const t = TRIG[id];
  const c = el('span', `kwtrig${mini ? ' mini' : ''}`, tint(t.color));
  c.appendChild(icon(t.icon, 'kw-ic'));
  c.append(...inline(text, false));
  return c;
}

function numeric(stat: 'atk' | 'hp', label: string, value: string, labelFirst = true): HTMLElement {
  const n = el('span', `kwn kwn-${stat}`);
  n.appendChild(icon(stat === 'atk' ? 'sword' : 'heart', 'kw-ic'));
  if (labelFirst) n.append(label, label ? ' ' : '', numExpr(value.replace(/\s+/g, '')));
  else n.append(numExpr(value), ' ', label);
  return n;
}

const MECH_RE = Object.keys(MECH).sort((a, b) => b.length - a.length).join('|');
const STACKABLE = '格挡|寒意|灼烧|易伤';
const NUMBERED = '格挡|护甲|法强|寒意|灼烧|溅射|反击|易伤';
const D = String.raw`\d+(?:→\d+)?`;
const NUM = String.raw`${D}(?:\s*\+\s*法强)?`;
type Rule = [RegExp, (m: RegExpExecArray, trig: boolean) => Node | null];
const RULES: Rule[] = [
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
  [new RegExp(`(?:${MECH_RE})`, 'y'), (m) => kwTag(m[0])],
  [/施法|开战/y, (m, trig) => (trig ? trigCap(m[0] === '施法' ? 'cast' : 'start', m[0], true) : null)],
];

function inline(text: string, trig: boolean): (string | Node)[] {
  const out: (string | Node)[] = [];
  let buf = '';
  for (let i = 0; i < text.length;) {
    let hit: Node | null = null, len = 0;
    for (const [re, mk] of RULES) {
      re.lastIndex = i;
      const m = re.exec(text);
      if (m && (hit = mk(m, trig))) { len = m[0].length; break; }
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
export const mechGloss = (k: string) => (KEYWORDS[k] ?? '').replace(/^(特性|状态)。/, '');

/** 升星只改数字时，合成一句「2→3」；结构变了（多了效果）返回 null */
export function kwUpgrade(a: string, b: string): string | null {
  const x = a.split(/(\d+)/), y = b.split(/(\d+)/);
  if (x.length !== y.length || x.some((t, i) => i % 2 === 0 && t !== y[i])) return null;
  return x.map((t, i) => (i % 2 && t !== y[i] ? `${t}→${y[i]}` : t)).join('');
}
