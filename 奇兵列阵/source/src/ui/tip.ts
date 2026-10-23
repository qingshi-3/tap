import { abilityText, generalAbilityText } from '../core/abilityText';
import { FACTION_INFO, RARITY_NAMES, unitDef } from '../core/data';
import { generalDefinition, generalPowerSources } from '../core/content';
import { levelStats } from '../core/engine';
import { describe } from '../core/run';
import type { UnitState } from '../core/types';
import { h, STAGE_W } from './dom';
import { kwInline, kwRich, kwUpgrade } from './kwtext';
import { statArt } from './board';

/** 状态数值：与场上同一套像素图标（--pxk-*）+ 右下角数字 */
const pxStat = (k: 'armor' | 'block' | 'chill' | 'freeze' | 'burn', v: number) => h('span', { class: `kwic kw-${k}` }, h('i', null, v));

// 单例悬浮说明框：单位 / 将军 / 关键词

let tipEl: HTMLElement | null = null;
let root: HTMLElement | null = null;
const liveTips = new WeakMap<HTMLElement, () => void>();
let liveTimer: ReturnType<typeof setInterval> | undefined;

function stopLiveTip() {
  if (liveTimer !== undefined) clearInterval(liveTimer);
  liveTimer = undefined;
}

export function initTip(stage: HTMLElement) {
  root = stage;
  tipEl = h('div', { class: 'tip' });
  stage.appendChild(tipEl);
  document.addEventListener('pointerdown', (event) => {
    if (tipEl && !tipEl.contains(event.target as Node)) hideTip();
  }, { capture: true });
  window.addEventListener('resize', hideTip);
}

type TipStats = Pick<UnitState, 'atk' | 'hp' | 'block' | 'chill' | 'burn'> & { actionsLeft?: number; charges?: number; armor?: number; power?: number; kw?: { power: number; armor?: number } };

/** 实例采用状态行的总护甲与剩余次数；图鉴保留静态能力。 */
export function unitAbilityText(defId: string, level: number, st?: TipStats | null) {
  let text = abilityText(defId, level, st?.power ?? st?.kw?.power);
  // 只移除独立的基础护甲句。0也是已知总值，不能退回展示已经失效的基础护甲。
  // 条件、光环和成长（如“在队首时护甲再 +2”）仍是必须解释的能力。
  if ((st?.armor ?? st?.kw?.armor) != null) {
    const clauses = text.split(/(?<=[；;。])/);
    const kept = clauses.filter(clause => !/^\s*护甲\s*\d+\s*[；;。]?\s*$/.test(clause));
    if (kept.length !== clauses.length) text = kept.join('').replace(/[；;]\s*$/, '');
  }
  if (!unitDef(defId).castUses || st?.charges == null) return text;
  const left = st.charges;
  return text.replace(/（本场最多 \d+ 次([^）]*)）/, (_, rest: string) => `（${left > 0 ? `本场剩余 ${left} 次${rest}` : '本场已用完，改普攻'}）`);
}

/** withUp：附带升一星的变化（只改数字时并进同一句写成「2→3」，多了效果才另起一行） */
export function unitTip(defId: string, level: number, st?: TipStats | null, withUp = true, liveStats?: () => TipStats | null) {
  const d = unitDef(defId);
  const f = FACTION_INFO[d.faction];
  const base = levelStats(defId, level);
  const atk = st ? st.atk : base.atk;
  const hp = st ? st.hp : base.hp;
  const armor = st?.armor ?? st?.kw?.armor ?? 0;
  const ability = describe(defId, level);
  let currentAbility = unitAbilityText(defId, level, st);
  const abilityEl = h('div', { class: 'tip-text' }, ...kwRich(currentAbility));
  abilityEl.hidden = !currentAbility;
  const upText = withUp && !d.enemyOnly && !d.token && level < 3 ? describe(defId, level + 1) : '';
  const next = upText ? levelStats(defId, level + 1) : null;
  // 升星只做一行弱提示：属性增量 + 技能里变化的部分，不抢当前状态的视觉
  let upDiff = '';
  if (upText && upText !== ability) {
    const ca = ability.split(/(?<=[；;。])/), cb = upText.split(/(?<=[；;。])/);
    upDiff = ca.length === cb.length
      ? cb.map((c, i) => (c === ca[i] ? '' : kwUpgrade(ca[i], c) ?? c)).join('')
      : upText.startsWith(ability) ? upText.slice(ability.length).replace(/^[；;，,\s]+/, '') : upText;
  }
  const dAtk = next ? next.atk - base.atk : 0;
  const dHp = next ? next.hp - base.hp : 0;
  const nextRow = upText && (dAtk || dHp || upDiff)
    ? h('div', { class: 'tip-next' },
      h('span', { class: 'tn-star' }, '★'.repeat(level + 1)),
      dAtk || dHp ? h('span', { class: 'tn-st' }, `+${dAtk}/+${dHp}`) : null,
      upDiff ? h('span', { class: 'tn-ab' }, ...kwInline(upDiff)) : null)
    : null;
  const content = h(
    'div',
    { class: 'tip-unit', style: `--fc:${f.color}` },
    h(
      'div',
      { class: 'tip-head' },
      h('div', { class: 'tip-name' }, d.name),
      d.token ? h('span', { class: 'tip-fac' }, '召唤物') : h('span', { class: 'tip-fac' }, f.name),
      !d.enemyOnly && !d.token ? h('span', { class: 'tip-lv' }, h('span', { class: `tip-rarity rarity-${d.tier}` }, RARITY_NAMES[d.tier]), ' ', h('span', { class: 'tip-stars' }, '★'.repeat(level))) : null,
    ),
    h(
      'div',
      { class: 'tip-stats' },
      statArt('atk', atk),
      statArt('hp', hp),
      armor ? pxStat('armor', armor) : null,
      st && st.block ? pxStat('block', st.block) : null,
      st && st.chill ? pxStat(st.chill >= st.atk ? 'freeze' : 'chill', st.chill) : null,
      st && st.burn ? pxStat('burn', st.burn) : null,
      st?.actionsLeft != null ? h('span', { class: 'ts-act' }, '行动', h('i', null, st.actionsLeft)) : null,
    ),
    abilityEl,
    nextRow,
  );
  if (liveStats && d.castUses) liveTips.set(content, () => {
    const latest = liveStats();
    if (!latest) return;
    const text = unitAbilityText(defId, level, latest);
    if (text === currentAbility) return;
    currentAbility = text;
    abilityEl.replaceChildren(...kwRich(text));
    abilityEl.hidden = !text;
  });
  return content;
}

export function generalTip(id: string, power = 0, passives: readonly string[] = [], tacticsVersion?: 1) {
  const g = generalDefinition(id, tacticsVersion);
  const f = FACTION_INFO[g.faction];
  const sources = tacticsVersion === 1 ? [] : generalPowerSources(id, passives);
  return h(
    'div',
    { class: 'tip-unit', style: `--fc:${f.color}` },
    h('div', { class: 'tip-head' }, h('div', { class: 'tip-name' }, g.name), h('span', { class: 'tip-fac' }, g.title)),
    h('div', { class: 'tip-text' }, ...kwRich(tacticsVersion === 1 ? g.text : generalAbilityText(id, power, passives)), sources.length ? h('br') : null, sources.length ? `主将法强 ${power}：${sources.join('、')}` : null),
  );
}

/** 在舞台坐标 (x, y) 附近显示说明：先量内容高度，上下放得下的一侧优先；都放不下就放到目标左右 */
/** top：目标上沿（默认同 y），放上方时以它为准，免得盖住目标本身 */
export function showTip(content: HTMLElement, x: number, y: number, prefer: 'above' | 'below' = 'above', top0 = y) {
  if (!tipEl || !root) return;
  stopLiveTip();
  const update = liveTips.get(content);
  update?.();
  tipEl.replaceChildren(content);
  tipEl.classList.add('on');
  root.appendChild(tipEl);
  const w = 440, pad = 12, gap = 8;
  tipEl.style.width = `${w}px`;
  tipEl.style.left = `${Math.max(pad, Math.min(STAGE_W - w - pad, x - w / 2))}px`;
  tipEl.style.bottom = '';
  tipEl.style.maxHeight = 'none';
  const need = tipEl.offsetHeight;
  const room = { above: top0 - gap - pad, below: 720 - y - gap - pad };
  const other = prefer === 'above' ? 'below' : 'above';
  const side = need <= room[prefer] ? prefer : need <= room[other] ? other : null;
  let top: number, max: number;
  if (side) {
    max = need;
    top = side === 'above' ? top0 - gap - need : y + gap;
  } else {
    // 上下都放不下：挪到目标左右两侧，按整屏高度放，不盖住目标
    const off = 64;
    tipEl.style.left = `${Math.max(pad, Math.min(STAGE_W - w - pad, x < STAGE_W / 2 ? x + off : x - off - w))}px`;
    max = Math.min(need, 720 - pad * 2);
    top = (top0 + y) / 2 - max / 2;
  }
  tipEl.style.maxHeight = `${max}px`;
  // 实在太长时可以滑动查看，所以要能接收触摸
  tipEl.classList.toggle('interactive', need > max || content.classList.contains('selected-tip') || !!content.querySelector('button'));
  tipEl.style.top = `${Math.max(pad, Math.min(720 - max - pad, top))}px`;
  // 播放不因查看单位暂停；只在有限施法者的详情可见期间跟随播放快照。
  if (update) liveTimer = setInterval(() => {
    if (!tipEl?.isConnected || !tipEl.classList.contains('on') || !tipEl.contains(content)) { stopLiveTip(); return; }
    update();
  }, 100);
}

export function hideTip() {
  stopLiveTip();
  // Closing a scrollable/actionable detail must also retire its input surface.
  tipEl?.classList.remove('on', 'interactive');
  root?.querySelectorAll('.unit.inspected').forEach((unit) => unit.classList.remove('inspected'));
}

/** A selected tooltip may live in document.body on touch screens. */
export function isTipTarget(target: EventTarget | null) {
  return target instanceof Node && !!tipEl?.classList.contains('on') && tipEl.contains(target);
}
