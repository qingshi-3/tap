// 随机组队：按局内阶段限制阶层和等级，再按卡面的站位偏好粗排（前排 → 中 → 后排）
import { POOL } from './cards.js';

export const STAGES = [
  { key: 'early', name: '第一幕（1～2 阶，1 级）', tiers: [1, 2], lvls: [1], giant: false },
  { key: 'mid', name: '第二幕（1～3 阶，1～2 级）', tiers: [1, 2, 3], lvls: [1, 1, 2], giant: false },
  { key: 'late', name: '第三幕（2～5 阶，1～3 级，含巨型）', tiers: [2, 3, 4, 5], lvls: [1, 2, 2, 3], giant: true },
];

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POS = { front: 0, mid: 1, back: 2 };

// 机制遭遇：一个机制敌人 + 护卫。lvl 按幕替换（第一幕 1 级，第二幕 1～2 级，第三幕 2～3 级）
export const ENCOUNTERS = {
  '炮台阵': [{ id: 'golem' }, { id: 'sworn' }, { id: 'cannon' }, { id: 'lion' }],
  '连拳': [{ id: 'puncher' }, { id: 'maiden' }, { id: 'recruit' }, { id: 'fox' }],
  '处刑': [{ id: 'panda' }, { id: 'templar' }, { id: 'reaper' }, { id: 'sunriser' }],
  '噬魂': [{ id: 'soul' }, { id: 'squire' }, { id: 'fanblade' }, { id: 'fox' }],
  '双机制': [{ id: 'puncher' }, { id: 'sworn' }, { id: 'cannon' }],
  '三机制': [{ id: 'soul' }, { id: 'cannon' }, { id: 'reaper' }],
};
// 遭遇的数值强度：按幕给整支遭遇队伍乘一个系数（血量、伤害、施法伤害）。
// 机制决定"怎么打"，系数决定"有多难"。目标：玩家看着敌阵排好站位、不用英雄时胜率约 30%。
// 第三幕血量、伤害分开乘（伤害只吃血量增幅的 25%），否则伤害一起翻倍，战斗只打 4～5 轮。
export const ENC_SCALE = {
  '炮台阵': { early: 1.5, mid: 1.35, late: { hp: 2.5, atk: 1.38 } },
  '连拳': { early: 1, mid: 1.3, late: { hp: 2.35, atk: 1.34 } },
  '处刑': { early: 1.45, mid: 1.4, late: { hp: 2.35, atk: 1.34 } },
  '噬魂': { early: 1.1, mid: 1.35, late: { hp: 2.45, atk: 1.36 } },
  '双机制': { early: 1, mid: 1.35, late: { hp: 2.35, atk: 1.34 } },
  '三机制': { early: 0.85, mid: 1, late: { hp: 2.25, atk: 1.31 } },
};
// 系数可以是数字（血量、伤害同乘）或 { hp, atk }（分开乘）
export function makeEncounter(name, stage, rnd, scale = ENC_SCALE[name]?.[stage.key] ?? 1) {
  const hp = typeof scale === 'number' ? scale : scale.hp, atk = typeof scale === 'number' ? scale : scale.atk;
  const lv = { early: [1], mid: [1, 2], late: [2, 3] }[stage.key];
  // 第一幕只带 2 名护卫
  const list = stage.key === 'early' ? ENCOUNTERS[name].slice(0, 3) : ENCOUNTERS[name];
  return list.map((x) => ({ id: x.id, lvl: lv[Math.floor(rnd() * lv.length)], scale: hp, atkScale: atk }));
}

export function makeTeam(stage, rnd, faction = null) {
  const pool = POOL.filter((c) => stage.tiers.includes(c.tier) && (stage.giant || !c.size) && (!faction || c.faction === faction || c.faction === 'neutral'));
  const team = [];
  let slots = 0, giants = 0;
  for (let tries = 0; tries < 50 && slots < 5; tries++) {
    const c = pool[Math.floor(rnd() * pool.length)];
    const size = c.size || 1;
    if (slots + size > 5 || (size > 1 && giants)) continue;
    if (size > 1) giants++;
    slots += size;
    team.push({ id: c.id, lvl: stage.lvls[Math.floor(rnd() * stage.lvls.length)], pos: POS[c.pos] + rnd() * 0.9 });
  }
  return team.sort((a, b) => a.pos - b.pos).map(({ id, lvl }) => ({ id, lvl }));
}
