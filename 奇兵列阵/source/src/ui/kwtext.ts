import { KEYWORDS } from '../core/data';
import type { IconName } from './icons';
import '../kw-text.css';

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
  嘲讽: { kind: 'trait', icon: 'guard', color: '#ffd36b' },
  轮换: { kind: 'trait', icon: 'swap', color: '#8fd8ff' },
  决斗: { kind: 'trait', icon: 'sword', color: '#ff8f5a' },
  蓄力: { kind: 'trait', icon: 'bolt', color: '#ffcf4a' },
  不行动: { kind: 'trait', icon: 'hourglass', color: '#a9b3c9' },
  护甲: { kind: 'trait', icon: 'plate', color: '#b9c7d8', px: 'armor' },
  反击: { kind: 'trait', icon: 'spikes', color: '#ff8a6a', px: 'thorns' },
  连击: { kind: 'trait', icon: 'combo', color: '#ff7ab0' },
  狙击: { kind: 'trait', icon: 'snipe', color: '#9fe870' },
  溅射: { kind: 'trait', icon: 'burst', color: '#ffb340' },
  法强: { kind: 'trait', icon: 'sparkle', color: '#c99bff', px: 'power' },
  复生: { kind: 'trait', icon: 'replay', color: '#78f0ff' },
  放逐: { kind: 'trait', icon: 'skull', color: '#b8bdd6' },
  格挡: { kind: 'status', icon: 'shield', color: '#ffe08a', px: 'block' },
  寒意: { kind: 'status', icon: 'snow', color: '#8feaff', px: 'chill' },
  冻结: { kind: 'status', icon: 'snow', color: '#c4f6ff', px: 'freeze' },
  灼烧: { kind: 'status', icon: 'fire', color: '#ff9a3d', px: 'burn' },
  行动次数: { kind: 'status', icon: 'play', color: '#ffe36b' },
  献祭: { kind: 'action', icon: 'skull', color: '#d6a8ff' },
  追击: { kind: 'action', icon: 'ff', color: '#ffe36b' },
  召唤: { kind: 'action', icon: 'star', color: '#d6a8ff' },
};

export type TrigId = 'start' | 'cast' | 'attack' | 'hurt' | 'kill' | 'rattle' | 'faint' | 'front' | 'rear' | 'defeat' | 'charge' | 'pulse' | 'beat' | 'cond';
/** KEYWORDS 释义去掉类别前缀（类别改用小标表示） */
const gloss = (k: string) => (KEYWORDS[k] ?? '').replace(/^(特性|状态|时机)。/, '');
interface TrigDef { name: string; icon: IconName; color: string; gloss: string; sample: string }
export const TRIG: Record<TrigId, TrigDef> = {
  start: { name: '开战时', icon: 'flag', color: '#ffd36b', sample: '开战时', gloss: '战斗开始时结算一次。单位的开战效果按我1、敌1、我2、敌2……的站位顺序结算，之后才进入常规行动。' },
  cast: { name: '施法', icon: 'wand', color: '#c9a4ff', sample: '施法', gloss: KEYWORDS.施法 },
  attack: { name: '普攻后', icon: 'sword', color: '#ffb46a', sample: '普攻后', gloss: '自己普攻结算后触发；「命中」类时机只在普攻打中目标时触发。' },
  hurt: { name: '受击时', icon: 'hit', color: '#ff9a6a', sample: '受击时', gloss: '受击时：每次受到伤害后都触发（含技能、灼烧、反击；被格挡抵消不算）。被普攻后：被普攻选为目标后触发，连击只算一次，被格挡也算。' },
  kill: { name: '击杀时', icon: 'kill', color: '#ff6b78', sample: '击杀时', gloss: '自己击杀敌人时触发。' },
  rattle: { name: '亡语', icon: 'tomb', color: '#c590ff', sample: '亡语', gloss: gloss('亡语') },
  faint: { name: '阵亡时', icon: 'skull', color: '#b48ce6', sample: '任一友军阵亡时', gloss: '写明的单位阵亡时触发；「任一友军阵亡时」看的是其他友军。「复活时」在复生复活后触发。' },
  front: { name: '成为队首时', icon: 'arrowUp', color: '#9fe8ff', sample: '成为队首时', gloss: gloss('成为队首时') },
  rear: { name: '在队尾时', icon: 'target', color: '#b0a8ff', sample: '在队尾时', gloss: gloss('在队尾时') },
  defeat: { name: '击败对手', icon: 'crown', color: '#ff8f5a', sample: '击败对手时', gloss: gloss('击败对手') },
  charge: { name: '蓄力技', icon: 'bolt', color: '#ffcf4a', sample: '蓄力技', gloss: '蓄力满后，下一次常规行动改为释放卡面写的蓄力技，然后清零。按施法结算，吃法强。' },
  pulse: { name: '节拍', icon: 'refresh', color: '#ff9ad0', sample: '节拍 N', gloss: gloss('节拍') },
  beat: { name: '每次交锋结束时', icon: 'hourglass', color: '#ff7a9a', sample: '每次交锋结束时', gloss: '每次交锋双方至多各一人常规行动；一方等待时，交锋结束仍照常结算。灼烧和节拍都按交锋计算；「每 3 次交锋」指第 3、6、9……次交锋，与回合无关。' },
  cond: { name: '条件触发', icon: 'eye', color: '#8cd4ff', sample: '普攻目标有寒意时', gloss: '满足写明的条件时触发，条件写在胶囊里。' },
};

/** 冒号前的子句属于哪种时机；不像时机的（如「选一个标签：」）返回 null */
function trigOf(clause: string): TrigId | null {
  if (/开战/.test(clause)) return 'start';
  if (/施法/.test(clause)) return 'cast';
  if (/蓄力技/.test(clause)) return 'charge';
  if (/节拍/.test(clause)) return 'pulse';
  if (/亡语/.test(clause)) return 'rattle';
  if (/击败对手/.test(clause)) return 'defeat';
  if (/队首时/.test(clause)) return 'front';
  if (/队尾时/.test(clause)) return 'rear';
  if (/阵亡|复活/.test(clause)) return 'faint';
  if (/击杀/.test(clause)) return 'kill';
  if (/被普攻|受击|承伤|受伤|打掉|低于/.test(clause)) return 'hurt';
  if (/普攻|命中/.test(clause)) return 'attack';
  if (/交锋/.test(clause)) return 'beat';
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
const STACKABLE = '格挡|寒意|灼烧';
const NUMBERED = '格挡|护甲|法强|寒意|灼烧|反击|蓄力';
const D = String.raw`\d+(?:→\d+)?`;
const NUM = String.raw`${D}(?:\s*\+\s*法强)?`;
const INLINE_TRIG: Record<string, TrigId> = { 施法: 'cast', 开战: 'start', 亡语: 'rattle' };
type Rule = [RegExp, (m: RegExpExecArray, trig: boolean, inCap: boolean) => Node | null];
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
  [new RegExp(`(?:${MECH_RE})`, 'y'), (m, _t, inCap) => (inCap && !MECH[m[0]].px ? document.createTextNode(m[0]) : kwTag(m[0]))],
  [/施法|开战|亡语/y, (m, trig) => (trig ? trigCap(INLINE_TRIG[m[0]], m[0], true) : null)],
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
