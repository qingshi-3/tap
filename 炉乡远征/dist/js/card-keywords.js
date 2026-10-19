import { cardAttackRange } from './attack-range.js';
// Semantic shapes reuse my-team assets; explanations follow this game's turn rules.
const term = (id, label, icon, color, explanation) => ({ id, label, icon, color, explanation });
// Old battle snapshots retain their original rules and numbers. Clean only display copy.
export function cleanCardCopy(value = '') {
  return value.replace(/^\s*\d+\s*\/\s*\d+\s*[。.]?\s*/, '')
    .replace(/^中立。/, '').replace(/敵方/g, '敌方')
    .replace(/当前生命及生命上限/g, '生命')
    .replace(/战术式：额外消耗1法力，施放后/g, '施放后');
}
export function cardKeywords(card) {
  const terms = [], put = (...args) => terms.push(term(...args));
  if (card.race === 'vespyr') put('raceVespyr', '冰灵', 'keyword-freeze', '#9dddf1', '属于冰灵，参与冰灵召唤、强化与抽取效果。');
  if (card.race === 'dervish' && !card.dervish) put('raceDervish', '沙魔', 'role-summoner', '#e5ca90', '属于沙魔，可接受沙魔专属强化。');
  const range = cardAttackRange(card);
  const reach = Number.isFinite(range) ? `${range}格内` : '';
  if (card.type === 'spell') {
    const effects = {
      heal:['治疗','keyword-overheal','#8ce0b1'], earthSphere:['治疗','keyword-overheal','#8ce0b1'],
      roar:['强化','keyword-attack','#ffd189'], bond:['强化','keyword-attack','#ffd189'], firstWish:['强化抽牌','keyword-attack','#ffd189'], greaterFortitude:['强化','keyword-attack','#ffd189'],
      strike:['伤害','keyword-magic-damage','#ffc07b'], tempest:['全场伤害','keyword-magic-damage','#ffc07b'], phoenixFire:['伤害','keyword-magic-damage','#ffc07b'], boneSwarm:['范围伤害','keyword-magic-damage','#ffc07b'], voidPulse:['汲取','keyword-overheal','#8ce0b1'],
      innerFocus:['再行动','keyword-follow-up','#efc68e'], wraithlingSwarm:['召唤','role-summoner','#cbb5ff'], bonechillBarrier:['冰墙召唤','keyword-freeze','#9dddf1']
    };
    const effect = effects[card.effect];
    if (effect) put(card.effect, ...effect, card.description || '');
  }
  if (card.provoke) put('provoke','嘲讽','keyword-taunt','#ffaaa3','相邻敌人只能攻击身边的嘲讽单位；远程和爆破也受此限制。');
  if (card.rush) put('rush','突袭','move-speed','#ffcca3','召唤当回合即可移动与攻击，仍受嘲讽和眩晕限制。');
  if (card.openingHeal) put('openingHeal','登场治疗','keyword-overheal','#8ce0b1',card.description);
  if (card.openingTempAttack) put('openingTempAttack','登场战吼','keyword-attack','#ffd189',card.description);
  if (card.dyingAlliedHealth) put('dyingAlliedHealth','亡愿支援','keyword-deathrattle','#d2b4ff',card.description);
  if (card.airdrop) put('airdrop','空投','move-speed','#91ceff','可召唤到战场上任意可用空格，不必邻近友军。');
  if (card.flying) put('flying','飞行','move-speed','#a9e9ff','可飞往战场任意可用空格，越过其他单位与地形；不能停在墙或被占用的格子，仍受相邻嘲讽限制。');
  if (card.grow) put('grow',`成长 ${card.grow}`,'keyword-attack','#e9cf8e',`己方回合开始时，永久获得 +${card.grow} 攻击、+${card.grow} 生命。`);
  if (card.spellWatchLeech) put('spellWatchLeech','施法汲取','keyword-overheal','#8ed9c5',card.description);
  if (card.dervishAuraAttack || card.dervishAuraHealth) put('dervishAura','沙魔光环','role-summoner','#e5ca90',card.description);
  if (card.creepStats) put('creepStats','腐化壮大','keyword-poison','#b9db7e',card.description);
  if (card.creepDamageMultiplier) put('creepDamageMultiplier','腐化增幅','keyword-poison','#cddd91',card.description);
  if (card.deathWatchSpawn) put('deathWatchSpawn','死亡召唤','keyword-deathrattle','#d2b4ff',card.description);
  if (card.openingAlliedAttack) put('openingAlliedAttack','登场战吼','keyword-attack','#ffc477',card.description);
  if (card.zeal) put('zeal',`护主 +${card.zeal}`,'keyword-attack','#ffc477',`邻近己方主将时，攻击 +${card.zeal}。`);
  if (card.zealHeal) put('zealHeal','护主回复','keyword-overheal','#8ce0b1','邻近己方主将时，己方回合结束恢复全部生命。');
  if (card.healWatch) put('healWatch','治疗成长','keyword-overheal','#9be7b9','任一单位实际恢复生命时，自身永久获得 +1 攻击、+1 生命。');
  if (card.backstab) put('backstab',`背刺 ${card.backstab === true ? 1 : card.backstab}`,'role-assassin','#f3b48d','从目标背后紧邻的同排格攻击，追加背刺伤害，目标不反击。玩家单位的背后在左侧，敌方单位在右侧。');
  if (card.ranged) put('ranged','远程','ranged','#91ceff',`可攻击${reach}敌人；身边有敌方嘲讽时必须先攻击嘲讽。`);
  if (card.blast) put('blast','爆破','keyword-magic-damage','#ffc07b',`攻击${reach}同排或同列敌人，并伤害该方向射程内的其他敌人；相邻嘲讽优先。`);
  if (card.spellWatch || card.spellgrowth) put('spellWatch','施法成长','keyword-magic-damage','#cbb5ff','己方每次施法后，自身永久获得 +1 攻击、+1 生命。');
  if (card.openingBuff) put('openingBuff','登场强化','keyword-attack','#ffd189',card.id === 211 ? '登场时，最早入场的友方沙魔获得 +2 / +2；临时沙魔同时不再于回合结束消散。' : '登场时，最早入场的相邻友方随从获得 +2 / +2。');
  if (card.obelysk) put('obelysk','沙魔召唤','role-summoner','#e5ca90','己方回合开始，在相邻空格召唤一名 2 / 2 沙魔；沙魔在己方回合结束消散。');
  else if (card.openingDervish) put('openingDervish','登场沙魔','role-summoner','#e5ca90','登场时，在相邻空格召唤沙魔。');
  if (card.openingWraith) put('openingWraith','登场暗灵','role-summoner','#cbb5ff','登场时，在相邻可用空格召唤一名 1 / 1 暗灵。');
  if (card.creepTrail) put('creepTrail','腐化','keyword-poison','#badc8e','己方回合结束，在相邻一格留下腐化地形；己方腐化格上的敌人受到 1 点伤害。');
  if (card.deathWatch) put('deathWatch','死亡成长','keyword-deathrattle','#d2b4ff','其他随从死亡时，自身永久增加1攻击和1生命，敌我均可触发。');
  if (card.rebirth) put('rebirth','重生','keyword-follow-up','#efc68e','死亡时留下 0 / 1 重生之卵；下个己方回合开始，卵孵化为原随从。');
  if (card.infiltrate) put('infiltrate',`潜入 +${card.infiltrate}`,'role-assassin','#97d7f2',`进入敌方半场时，攻击 +${card.infiltrate}；中央列不算敌方半场。`);
  if (card.manaWisp) put('manaWisp','亡愿法力','mana','#91bfff','死亡时，己方法力上限增加 1，最多 9。');
  if (card.dyingWolf) put('dyingWolf','亡愿狼魂','keyword-deathrattle','#d2b4ff','死亡时，在原位置召唤一名 3 / 2 幽灵狼。');
  if (card.wall) put('wall','冰墙','keyword-freeze','#9dddf1','攻击冰墙的单位会被眩晕，立即失去移动、攻击机会，并跳过下个己方回合的移动与攻击。');
  if (card.dervish) put('dervish','临时沙魔','role-summoner','#e5ca90','己方回合结束消散；沙丘塑师的登场强化可使其保留。');
  if (card.stun || card.effect === 'stun') put('stun','眩晕','keyword-stun','#d2b4ff','目标立即失去移动与攻击机会，并跳过其下个回合的移动与攻击。');
  // Source mechanics share existing semantic icons; complete rules stay in the long-press view.
  const expansionTerms = {
  movementAura:['移动光环','move-speed'], startBounceSelf:['回手','keyword-follow-up'],
  damageAllEnemies:['受伤反击','keyword-magic-damage'], damageEnemyGeneralOnMinionDamage:['追击主将','keyword-attack'],
  startRandomDamage:['随机伤害','keyword-magic-damage'], dyingSpawn:['亡愿召唤','keyword-deathrattle'],
  openingGrantDyingSpawnToAllies:['登场亡愿','keyword-deathrattle'], openingVespyrBuff:['冰灵强化','keyword-attack'],
  endHealNearby:['邻近治疗','keyword-overheal'], alliedAttackAura:['攻击光环','keyword-attack'],
  mirrorDamageToEnemyGeneral:['伤害反射','keyword-magic-damage'], openingControlMaxAttack:['登场夺取','role-summoner'],
  endDamageNearbyEnemyMinions:['邻近伤害','keyword-magic-damage'], openingNearbySelfDamageEqualAttack:['登场反噬','keyword-magic-damage'],
  damageGeneralMultiplier:['主将双伤','keyword-attack'], nearbySummonBuff:['召唤强化','role-summoner'],
  openingStatAttack:["登场改造","keyword-attack"], openingSelfDamage:["登场代价","keyword-deathrattle"], openingTeleport:["登场传送","move-speed"],
  "celerity": [
    "双行动",
    "keyword-follow-up"
  ],
  "attackDispel": [
    "攻击驱散",
    "keyword-magic-damage"
  ],
  "healWatchDamage": [
    "治疗震击",
    "keyword-overheal"
  ],
  "attackWatchBuff": [
    "攻击成长",
    "keyword-attack"
  ],
  "damageEnemyRandom": [
    "受伤反击",
    "keyword-magic-damage"
  ],
  "damageKill": [
    "致命伤害",
    "keyword-magic-damage"
  ],
  "startSelfDamage": [
    "回合代价",
    "keyword-deathrattle"
  ],
  "openingSpellTax": [
    "法术压制",
    "mana"
  ],
  "damageGenerate": [
    "受伤生牌",
    "keyword-follow-up"
  ],
  "spellImmune": [
    "法术保护",
    "keyword-taunt"
  ],
  "openingClone": [
    "登场复制",
    "role-summoner"
  ],
  "openingCopy": [
    "登场变形",
    "role-summoner"
  ],
  "dyingLeech": [
    "亡愿汲取",
    "keyword-deathrattle"
  ],
  "summonWatchAttack": [
    "召唤成长",
    "keyword-attack"
  ],
  "openingSacrifice": [
    "登场吞噬",
    "keyword-deathrattle"
  ],
  "openingAttackDebuff": [
    "登场虚弱",
    "keyword-attack"
  ],
  "dyingSpawnCount": [
    "亡愿召唤",
    "role-summoner"
  ],
  "deathWatchLeech": [
    "死亡汲取",
    "keyword-overheal"
  ],
  "openingKillMaxAttack": [
    "登场处决",
    "keyword-magic-damage"
  ],
  "summonWraithAttack": [
    "暗灵成长",
    "keyword-attack"
  ],
  "endSpawnEgg": [
    "繁育",
    "role-summoner"
  ],
  "endDamageAllMinions": [
    "回合灼烧",
    "keyword-magic-damage"
  ],
  "enemyDrawBuff": [
    "敌抽成长",
    "keyword-attack"
  ],
  "infiltrateCelerity": [
    "潜入双行动",
    "keyword-follow-up"
  ],
  "infiltrateReturn": [
    "潜入回手",
    "keyword-follow-up"
  ],
  "summonRaceAttack": [
    "冰灵成长",
    "keyword-attack"
  ],
  "handSummonSpawn": [
    "召唤冰灵",
    "role-summoner"
  ],
  "openingSwap": [
    "登场换位",
    "move-speed"
  ],
  "summonRaceDamage": [
    "冰灵震击",
    "keyword-freeze"
  ],
  "damageHeal": [
    "伤害治疗",
    "keyword-overheal"
  ],
  "openingDispelArea": [
    "登场驱散",
    "keyword-magic-damage"
  ],
  "openingHealBoth": [
    "登场治疗",
    "keyword-overheal"
  ],
  "openingDamageTarget": [
    "登场伤害",
    "keyword-magic-damage"
  ],
  "attackImmune": [
    "攻击保护",
    "keyword-taunt"
  ]
};
  for (const [key,[label,icon]] of Object.entries(expansionTerms)) if (card[key]) put(key,label,icon,'#c9dbea',card.description);
  return terms;
}

export function compactCardDescription(card) {
  if (card.campaignSummary) return cleanCardCopy(card.campaignSummary);
  const text = cleanCardCopy(card.description || '');
  if (card.type === 'general') return text;
  if (card.type === 'spell') {
    const summaries = {
      20174:'主将附近友方随从：攻击 +2', 20043:'一个目标：恢复 5 生命', 20066:'一个随从：2 伤害', 20044:'所有单位：2 伤害', 20068:'一个随从：攻击增加其生命值',
      20081:'一个敌人：3 伤害', 20086:'攻击 ≤3 的友方随从：重置移动与攻击', 20095:'友方随从 +1 / +1；抽 1 张', 20151:'敌方主将及附近敌军：2 伤害', 20052:'敌方主将：2 伤害；己方主将恢复 3',
      20072:'所选空格及相邻空格：召唤最多3名暗灵', 20116:'友方随从永久增加2攻击和2生命', 20117:'己方主将：恢复8生命', 20139:'任一随从：1伤害并眩晕', 20149:'所选空格及相邻空格：召唤最多3面冰墙'
    };
    return summaries[card.id] || text;
  }
  if (cardKeywords(card).length) return '';
  return text === '无额外规则。' ? '' : text;
}

export function createKeywordStrip(card, { interactive = false, host = null } = {}) {
  const terms = cardKeywords(card);
  const strip = document.createElement('div'); strip.className = `card-keywords${interactive ? ' is-interactive' : ''}`;
  for (const entry of terms) {
    const chip = document.createElement(interactive ? 'button' : 'span');
    chip.className = 'keyword-chip'; chip.style.setProperty('--keyword-color', entry.color);
    if (interactive) { chip.type = 'button'; chip.dataset.keyword = entry.id; chip.setAttribute('aria-expanded','false'); }
    const icon = document.createElement('span'); icon.className = 'keyword-icon'; icon.setAttribute('aria-hidden', 'true'); icon.style.setProperty('--keyword-icon', `url('./assets/ui/keywords/${entry.icon}.svg')`);
    const label = document.createElement('span'); label.className = 'keyword-label'; label.textContent = entry.label;
    chip.append(icon,label); strip.append(chip);
  }
  if (!interactive || !terms.length) return strip;
  const detail = document.createElement('div'); detail.className = 'keyword-explanation'; detail.hidden = true; detail.setAttribute('role','region'); detail.setAttribute('aria-live','polite');
  const title = document.createElement('strong'), body = document.createElement('p'), close = document.createElement('button');
  close.type = 'button'; close.className = 'keyword-close'; close.textContent = '收起'; close.dataset.keywordClose = '';
  detail.append(title,body,close); (host || strip).append(detail);
  let active = null;
  const collapse = () => { if (!active) return; const prior = active; active.setAttribute('aria-expanded','false'); active = null; detail.hidden = true; prior.focus(); };
  (host || strip).addEventListener('click', (event) => {
    const chip = event.target.closest('[data-keyword]');
    if (event.target.closest('[data-keyword-close]')) { event.stopPropagation(); collapse(); return; }
    if (!chip || !strip.contains(chip)) return;
    event.stopPropagation();
    if (active === chip) { collapse(); return; }
    active?.setAttribute('aria-expanded','false'); active = chip;
    const entry = terms.find((item) => item.id === chip.dataset.keyword);
    title.textContent = entry.label; body.textContent = entry.explanation; detail.style.setProperty('--keyword-color',entry.color); detail.hidden = false; chip.setAttribute('aria-expanded','true');
  });
  (host || strip).addEventListener('keydown', (event) => { if (event.key === 'Escape' && active) { event.preventDefault(); event.stopPropagation(); collapse(); } }, true);
  strip.closeKeywords = collapse;
  return strip;
}
