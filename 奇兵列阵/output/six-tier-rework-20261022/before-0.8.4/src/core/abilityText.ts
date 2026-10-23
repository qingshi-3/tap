import { unitDef } from './data';
import { EQUIP_MAP, GENERAL_MAP, PASSIVE_MAP } from './content';
import { tri } from './engine';
import { describe } from './run';
import { effectAmount, halfPower } from './power';
import type { Slotted } from './types';

/** 无场上实例时只计算该单位自身的法强，不借用同名单位或场上光环。 */
export function ownedPower(defId: string, level: number, owned?: Slotted) {
  return tri(unitDef(defId).traits?.power, level) + (owned?.train?.power ?? 0)
    + (owned?.equips ?? []).reduce((n, id) => n + Number(EQUIP_MAP[id]?.grants?.power ?? 0), 0);
}

/** 只替换施法分句中与真实effect按顺序及基础值一致的语义数字。未知文案原样保留。 */
export function abilityText(defId: string, level: number, power = ownedPower(defId, level)) {
  const text = describe(defId, level), d = unitDef(defId);
  const spell = d.cast ?? d.chargeSkill;
  if (!spell || !power) return text;
  const start = text.search(/(?:施法|蓄力技)(?:（[^）]*）)?：/);
  if (start < 0) return text;
  const end = text.indexOf('；', start), stop = end < 0 ? text.length : end;
  const clause = text.slice(start, stop);
  const labels: Record<string, string> = { dmg: '伤害', heal: '生命', burn: '灼烧', chill: '寒意' };
  const effects = spell.filter(e => labels[e.op] && tri(e.v, level) > 0);
  let idx = 0, valid = true;
  const replaced = clause.replace(/(\d+)(\s*(?:伤害|生命|层(?:灼烧|寒意)))/g, (whole, n, label) => {
    const e = effects[idx++];
    if (!e || !label.endsWith(labels[e.op]) || Number(n) !== tri(e.v, level)) { valid = false; return whole; }
    const value = effectAmount(e, Number(n), power, true);
    const contribution = halfPower(e) ? `⌊${power}法强/2⌋` : `${power}法强`;
    return `${value}${label}（${n}+${contribution}）`;
  });
  return valid && idx === effects.length ? text.slice(0, start) + replaced + text.slice(stop) : text;
}

/** 主将核心技能 + 已得专属被动；「N+法强」按当前主将法强算出。 */
export function generalAbilityText(id: string, power = 0, passives: readonly string[] = []) {
  const g = GENERAL_MAP[id];
  const extra = passives.filter(s => PASSIVE_MAP[s]?.general === id).map(s => `${PASSIVE_MAP[s].name}：${PASSIVE_MAP[s].text}`);
  const text = [g.text, ...extra].join('；').replace(/1\+⌊法强\/2⌋/g, `${1 + Math.floor(power / 2)}`);
  if (!power) return text.replace(/(\d+)\+(?:主将)?法强/g, '$1').replace(/[ ]?\+法强(\/\+法强×2)?/g, '');
  return text
    .replace(/(\d+)\+(?:主将)?法强/g, (_, n) => `${Number(n) + power}（${n}+${power}法强）`)
    .replace(/\+法强\/\+法强×2/g, `+${power}/+${power * 2}`)
    .replace(/\+法强/g, `+${power}`);
}
