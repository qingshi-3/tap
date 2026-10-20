import { unitDef } from './data';
import { EQUIP_MAP, GENERAL_MAP, PASSIVE_MAP, generalInterval } from './content';
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
  if (!d.cast || !power) return text;
  const start = text.search(/施法(?:（[^）]*）)?：/);
  if (start < 0) return text;
  const end = text.indexOf('；', start), stop = end < 0 ? text.length : end;
  const clause = text.slice(start, stop);
  const labels: Record<string, string> = { dmg: '伤害', heal: '生命', burn: '灼烧', chill: '寒意', vuln: '易伤' };
  const effects = d.cast.filter(e => labels[e.op] && tri(e.v, level) > 0);
  let idx = 0, valid = true;
  const replaced = clause.replace(/(\d+)(\s*(?:伤害|生命|层(?:灼烧|寒意|易伤)))/g, (whole, n, label) => {
    const e = effects[idx++];
    if (!e || !label.endsWith(labels[e.op]) || Number(n) !== tri(e.v, level)) { valid = false; return whole; }
    const value = effectAmount(e, Number(n), power, true);
    const contribution = halfPower(e) ? `⌊${power}法强/2⌋` : `${power}法强`;
    return `${value}${label}（${n}+${contribution}）`;
  });
  return valid && idx === effects.length ? text.slice(0, start) + replaced + text.slice(stop) : text;
}

/** 主将采用genCast的各自公式；被动追加说明继续复用原有文案。 */
export function generalAbilityText(id: string, power = 0, passives: readonly string[] = []) {
  const g = GENERAL_MAP[id], has = (s: string) => passives.includes(s), base = g.base + power;
  const expr = (value: number, formula: string) => power ? `${value}（${formula}）` : String(value);
  const normal = expr(base, `${g.base}+${power}法强`);
  let body: string;
  const represented = new Set<string>();
  switch (id) {
    case 'argeon':
      represented.add('argeon_1'); represented.add('argeon_2');
      body = `${has('argeon_1') ? '全体友军' : '生命最低的友军'}获得 ${has('argeon_2') ? 2 : 1} 层格挡，并恢复 ${has('argeon_1') ? expr(Math.ceil(base / 2), `⌈(${g.base}+${power}法强)/2⌉`) : normal} 生命`; break;
    case 'kaleos': body = `敌方生命最低的单位受 ${normal} 伤害`; break;
    case 'lilithe': {
      represented.add('lilithe_2'); represented.add('lilithe_3');
      const n = has('lilithe_2') ? expr(Math.max(1, base - 1), `max(1,${g.base}+${power}法强−1)`) : normal;
      body = `${has('lilithe_2') ? '全体敌人' : '敌方队首'}受 ${n} 伤害，${has('lilithe_3') ? '全体友军' : '我方队首'}恢复等量生命`; break;
    }
    case 'vulkan':
      represented.add('vulkan_1'); represented.add('vulkan_4');
      body = `${has('vulkan_1') ? '敌方前两位' : '敌方队首'}获得 ${has('vulkan_4') ? expr(base + power, `${g.base}+${power}法强×2`) : normal} 层灼烧`; break;
    case 'faie':
      represented.add('faie_1'); body = `${has('faie_1') ? '敌方前两个出手者' : '敌方下一个出手者'}获得 ${normal} 层寒意`; break;
    case 'zirix':
      represented.add('zirix_1'); body = `${has('zirix_1') ? '全体敌人' : '敌方队首'}获得 ${has('zirix_1') ? expr(1 + Math.floor(power / 2), `1+⌊${power}法强/2⌋`) : normal} 层易伤`; break;
    case 'hank':
      represented.add('hank_1'); body = `攻击最高的友军立即攻击一次，本次攻击 +${expr(power + (has('hank_1') ? 2 : 0), `${has('hank_1') ? '2+' : ''}${power}法强`)}`; break;
    default: return g.text;
  }
  ['argeon_4', 'faie_4', 'hank_3'].forEach(s => represented.add(s));
  const extra = passives.filter(s => PASSIVE_MAP[s]?.general === id && !represented.has(s)).map(s => PASSIVE_MAP[s].text);
  const text = `每第 ${generalInterval(passives)} 拍结束：${body}${extra.length ? '；' + extra.join('；') : ''}`;
  return text.replace(/(\d+)（([^（）]*)）(\s*(?:伤害|生命|层(?:灼烧|寒意|易伤)))/g, '$1$3（$2）');
}
