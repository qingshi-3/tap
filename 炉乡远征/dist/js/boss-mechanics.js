// Campaign boss rules. A boss is bespoke code keyed by id (Hearthstone-adventure style):
// telegraphed intents, rule passives and HP phases. All boss state lives in state.boss
// so saves stay one JSON value; randomness only through the match's seeded stream.
import { appendBattleLog } from './battle-history-log.js';

export const ICE_SHARD_ID = 9001;
export const BOSS_CARDS = Object.freeze({
  [ICE_SHARD_ID]: { id: ICE_SHARD_ID, name: '冰棱', type: 'unit', faction: 6, cost: 0, attack: 0, health: 3, speed: 0, wall: true, token: true, spriteFrom: 525,
    description: '冰墙：不能移动。被摧毁时碎裂，对相邻所有单位造成2点伤害。' },
});

const living = state => state.units.filter(unit => unit.health > 0);
const near = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
const key = cell => `${cell.x},${cell.y}`;

function announce(state, text) {
  state.boss.announce = { serial: (state.boss.announce?.serial ?? 0) + 1, text };
  appendBattleLog(state, text, state.boss.owner);
}

// ---- 霜墙女王 ----
// 霜甲：女王身边有≥3面冰棱时，每次受到的伤害至多为1。
// 冰封：女王回合结束时标记你的主将（及阶段二起一名攻击最高的随从）所在格；
//       她的下回合开始时，标记格上的单位受到3点伤害并被冻结，空格则长出冰棱。
// 碎冰：冰棱被摧毁时对相邻所有单位造成2点伤害，无视霜甲。
// 凛冬（生命≤一半，一次）：冻结所有贴着冰棱的敌方单位，并在女王身边补满冰棱。
const FROST_QUEEN = {
  name: '霜墙女王',
  intentDamage: 3,
  rooted: true,
  rules: [
    { id: 'throne', title: '王座', text: '女王坐镇王座，不会移动。' },
    { id: 'armor', title: '霜甲', text: '身边有3面冰棱时，每次受到的伤害至多为1。' },
    { id: 'mark', title: '冰封', text: '回合结束时标记你的主将所在格；下回合开始，留在格上的单位受到3点伤害并冻结，空格长出冰棱。' },
    { id: 'shatter', title: '碎冰', text: '冰棱被摧毁时对相邻所有单位造成2点伤害，无视霜甲。' },
    { id: 'winter', title: '凛冬', text: '生命降到一半时，冻结所有贴着冰棱的敌人，并在身边补满冰棱。' },
  ],
  phases: [{ hpBelow: 0.5, enter: 'winter' }],
  shards(state) { return living(state).filter(unit => unit.cardId === ICE_SHARD_ID); },
  armored(state, api) {
    const queen = api.general(state.boss.owner);
    return !!queen && this.shards(state).filter(shard => near(shard, queen)).length >= 3;
  },
  damage(state, unit, amount, context, api) {
    if (unit !== api.general(state.boss.owner) || context.shatter || context.destroy || amount <= 1) return amount;
    if (!this.armored(state, api)) return amount;
    appendBattleLog(state, `霜甲将女王受到的${amount}点伤害减至1点。`, state.boss.owner);
    return 1;
  },
  turnEnd(state, api) {
    const foes = living(state).filter(unit => unit.owner !== state.boss.owner);
    const general = foes.find(unit => api.rule(unit)?.type === 'general');
    const marks = general ? [{ x: general.x, y: general.y }] : [];
    if (state.boss.phase >= 1) {
      const minion = foes.filter(unit => api.rule(unit)?.type === 'unit' && unit.cardId !== ICE_SHARD_ID)
        .sort((a, b) => api.attack(b) - api.attack(a) || a.unitId - b.unitId)[0];
      if (minion) marks.push({ x: minion.x, y: minion.y });
    }
    state.boss.marks = marks;
    if (marks.length) announce(state, `冰封：标记${marks.map(cell => `（${cell.x + 1},${cell.y + 1}）`).join('、')}，下次女王回合开始结算。`);
  },
  turnStart(state, api) {
    const marks = state.boss.marks;
    state.boss.marks = [];
    for (const cell of marks) {
      if (state.phase === 'over') return;
      const unit = living(state).find(entry => entry.x === cell.x && entry.y === cell.y);
      if (!unit) { api.summon(ICE_SHARD_ID, state.boss.owner, cell.x, cell.y, { token: true }); appendBattleLog(state, `冰封位置（${cell.x + 1},${cell.y + 1}）无人，生成冰棱。`, state.boss.owner); continue; }
      if (unit.owner === state.boss.owner) continue;
      api.damage(unit, 3, { sourceOwner: state.boss.owner, boss: true });
      if (state.units.includes(unit)) freeze(unit);
    }
  },
  death(state, unit, api) {
    if (unit.cardId !== ICE_SHARD_ID) return;
    appendBattleLog(state, `冰棱在（${unit.x + 1},${unit.y + 1}）碎裂，对相邻单位造成2点伤害。`, state.boss.owner);
    for (const victim of living(state).filter(other => other !== unit && near(other, unit))) {
      if (state.phase === 'over') return;
      api.damage(victim, 2, { sourceOwner: state.boss.owner, shatter: true });
    }
  },
  winter(state, api) {
    const queen = api.general(state.boss.owner);
    if (queen) for (const cell of api.free(queen).slice(0, 3)) api.summon(ICE_SHARD_ID, state.boss.owner, cell.x, cell.y, { token: true });
    const shards = this.shards(state);
    for (const foe of living(state).filter(unit => unit.owner !== state.boss.owner && shards.some(shard => near(shard, unit)))) freeze(foe);
    announce(state, '凛冬降临：女王进入第二阶段，召唤冰棱并冻结贴近冰棱的敌人。');
  },
};

function freeze(unit) { unit.stunTurns = Math.max(1, unit.stunTurns ?? 0); unit.moved = true; unit.attacked = true; }

// Compact encounter rules share the same saved telegraph/phase contract as the queen.
// Counter targets must belong to this boss; another army or the player's copy never counts.
function encounter({name, marks = 0, damage = 0, target = 'general', guards = [], reduction = 0, backlash = 0, reinforcements = [], rooted = false}) {
  const rules = [];
  if (marks) rules.push({id:'mark',title:'蓄势',text:`回合结束标记${marks === 1 ? target === 'general' ? '你的主将' : '攻击最高的敌方随从' : '你的主将和攻击最高的随从'}所在格，下次敌方回合开始造成${damage}点伤害；离开标记格即可避开。`});
  if (reduction) rules.push({id:'guard',title:'护卫',text:`有相邻且未被驱散的护卫时，受到的伤害减少${reduction}点，最低1点；先击散护卫。`});
  if (backlash) rules.push({id:'backlash',title:'反噬',text:`其${guards.includes(214) ? '方尖碑' : guards.includes(308) ? '腐化爬行者与暗影观察者' : '护卫'}被击败时，对统帅造成${backlash}点伤害。`});
  if (reinforcements.length) rules.push({id:'phase',title:'增援',text:'生命降到一半时，只召唤一批增援；清理后不会重复召唤。'});
  return {
    name,rooted,armorReduction:reduction,intentDamage:marks?damage:undefined,rules,phases:reinforcements.length?[{hpBelow:0.5,enter:'rally'}]:[],
    armored(state,api) {const g=api.general(state.boss.owner);return !!reduction&&!!g&&living(state).some(u=>u.owner===state.boss.owner&&guards.includes(u.cardId)&&!u.silenced&&near(u,g));},
    damage(state,unit,amount,context,api) {return unit===api.general(state.boss.owner)&&!context.destroy&&!context.backlash&&amount>0&&this.armored(state,api)?Math.max(1,amount-reduction):amount;},
    death(state,unit,api) {const g=api.general(state.boss.owner);if(g&&backlash&&unit.owner===state.boss.owner&&guards.includes(unit.cardId)){appendBattleLog(state,`${name}的部下倒下，反噬${backlash}点伤害。`,state.boss.owner);api.damage(g,backlash,{sourceOwner:state.boss.owner,boss:true,backlash:true});}},
    turnEnd(state,api) {
      if(!marks)return;
      const foes=living(state).filter(u=>u.owner===0),general=foes.find(u=>api.rule(u)?.type==='general');
      const strongest=foes.filter(u=>api.rule(u)?.type==='unit').sort((a,b)=>api.attack(b)-api.attack(a)||a.unitId-b.unitId)[0];
      const selected=marks>1?[general,strongest]:[target==='general'?general:strongest??general];
      state.boss.marks=selected.filter(Boolean).map(u=>({x:u.x,y:u.y}));
      if(state.boss.marks.length)announce(state,`${name}蓄势：${state.boss.marks.map(c=>`（${c.x+1},${c.y+1}）`).join('、')}，下次敌方回合造成${damage}点伤害。`);
    },
    turnStart(state,api) {const cells=state.boss.marks;state.boss.marks=[];for(const cell of cells){if(state.phase==='over')break;const u=living(state).find(u=>u.x===cell.x&&u.y===cell.y);if(u&&u.owner!==state.boss.owner)api.damage(u,damage,{sourceOwner:state.boss.owner,boss:true});}},
    rally(state,api) {const g=api.general(state.boss.owner);if(!g)return;for(const id of reinforcements){const cell=api.free(g)[0];if(cell)api.summon(id,state.boss.owner,cell.x,cell.y,{token:true});}announce(state,`${name}进入第二阶段，最后一批增援抵达。`);}
  };
}
export const BOSSES = Object.freeze({
  'night-captain':encounter({name:'夜袭队长',marks:1,damage:2}),
  'ironcliff-warden':encounter({name:'铁崖统帅',guards:[11,17,19027],reduction:2,backlash:2,rooted:true}),
  'banner-marshal':encounter({name:'战旗统领',guards:[11,17,19027],backlash:3}),
  'sand-overseer':encounter({name:'沙海督军',guards:[214,215],backlash:3,reinforcements:[213,211],rooted:true}),
  'shadow-hunter':encounter({name:'暗影猎首',marks:1,damage:3,target:'minion'}),
  'frost-queen':FROST_QUEEN,
  'crossroads-ambusher':encounter({name:'岔路伏兵',marks:2,damage:2}),
  'citadel-warden':encounter({name:'孤堡统帅',guards:[11,17,19027],reduction:2,reinforcements:[11],rooted:true}),
  'ruins-priest':encounter({name:'遗城祭司',guards:[308,311],backlash:3,reinforcements:[315,315],rooted:true}),
  'confluence-warlord':encounter({name:'终战统帅',marks:2,damage:3,reinforcements:[19027],rooted:true}),
});
export const bossDefinition = id => (Object.hasOwn(BOSSES, id) ? BOSSES[id] : null);
export const bossRules = state => (state?.boss ? bossDefinition(state.boss.id)?.rules ?? [] : []);
// Rooted bosses hold their ground; the fight is about reaching them, not chasing them.
export const bossRooted = (state, unit) => (!state?.encounter || state.boss?.id==='frost-queen') && !!state?.boss && !!bossDefinition(state.boss.id)?.rooted && unit.owner === state.boss.owner && unit.cardId === state.players[state.boss.owner].generalId;
export const bossMarks = state => state?.boss?.marks ?? [];
export const bossArmored = (state, api) => (!state?.encounter || state.boss?.id==='frost-queen') && !!state?.boss && !!bossDefinition(state.boss.id)?.armored?.(state, api);

export function validBossConfig(config) {
  return config === undefined || !!config && typeof config === 'object' && Object.keys(config).join() === 'id' && !!bossDefinition(config.id);
}
export function initBoss(config, owner = 1) {
  return config ? { id: config.id, owner, phase: 0, marks: [], announce: null } : undefined;
}
export function validateBossState(state) {
  const boss = state.boss;
  if (boss === undefined) return true;
  const board = state.board, int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  if (!boss || typeof boss !== 'object' || Object.keys(boss).sort().join() !== 'announce,id,marks,owner,phase') return false;
  const def = bossDefinition(boss.id);
  if (!def || boss.owner !== 1 || !int(boss.phase, 0, def.phases.length)) return false;
  if (!Array.isArray(boss.marks) || boss.marks.length > 8 || boss.marks.some(c => !int(c?.x, 0, board.columns - 1) || !int(c?.y, 0, board.rows - 1) || Object.keys(c).length !== 2)) return false;
  if (new Set(boss.marks.map(key)).size !== boss.marks.length) return false;
  return boss.announce === null || !!boss.announce && int(boss.announce.serial, 1, Number.MAX_SAFE_INTEGER) && typeof boss.announce.text === 'string';
}

// Engine hooks. Each is a no-op without state.boss.
export function bossTurnStart(state, playerId, api) {
  const def = (!state.encounter || state.boss?.id==='frost-queen') && state.boss && bossDefinition(state.boss.id);
  if (def && playerId === state.boss.owner) def.turnStart?.(state, api);
}
export function bossTurnEnd(state, playerId, api) {
  const def = (!state.encounter || state.boss?.id==='frost-queen') && state.boss && bossDefinition(state.boss.id);
  if (def && playerId === state.boss.owner && state.phase !== 'over') def.turnEnd?.(state, api);
}
export function bossDamage(state, unit, amount, context, api) {
  const def = (!state.encounter || state.boss?.id==='frost-queen') && state.boss && bossDefinition(state.boss.id);
  return def?.damage ? def.damage(state, unit, amount, context, api) : amount;
}
// After damage settles: enter each HP phase once, in order.
export function bossAfterDamage(state, unit, api) {
  const def = (!state.encounter || state.boss?.id==='frost-queen') && state.boss && bossDefinition(state.boss.id), boss = state.boss;
  if (!def || state.phase === 'over' || unit !== api.general(boss.owner) || unit.health <= 0) return;
  while (boss.phase < def.phases.length && unit.health <= Math.floor((unit.maxHealth + unit.healthBuff) * def.phases[boss.phase].hpBelow)) {
    const phase = def.phases[boss.phase++];
    def[phase.enter]?.(state, api);
  }
}
export function bossDeath(state, unit, api) {
  const def = (!state.encounter || state.boss?.id==='frost-queen') && state.boss && bossDefinition(state.boss.id);
  if (def && state.phase !== 'over') def.death?.(state, unit, api);
}
