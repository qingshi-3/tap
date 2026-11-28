import { CARDS } from './cards.js';
import { HEROES } from './factions.js';
import { bossDefinition } from './boss-mechanics.js';
import { SPELL_HISTORY_PREFIX } from './battle-history-log.js';

const validSpellRecord = record => record && typeof record === 'object' && Number.isInteger(record.cardId)
  && Array.isArray(record.rows) && record.rows.every(row=>typeof row==='string'&&!row.includes(SPELL_HISTORY_PREFIX))
  && Array.isArray(record.changes) && record.changes.every(change=>change&&typeof change==='object')
  && (record.targets == null || Array.isArray(record.targets) && record.targets.every(target=>target&&typeof target==='object'))
  && (record.cell == null || Number.isInteger(record.cell.x) && Number.isInteger(record.cell.y));

// A read-only view over public, historical strings; never inspect hands or draw piles.
export function buildBattleHistory(state) {
  const cards = new Map(Object.values(CARDS).map(card => [card.name, Number(card.id)]));
  for (const table of Object.values(state.battleCards ?? {})) for (const card of Object.values(table ?? {})) if (card?.name) cards.set(card.name, Number(card.id));
  for (const hero of Object.values(HEROES)) cards.set(hero.name, hero.id);
  const enemyAliases=(state.players??[]).filter(player=>player.id>0&&player.name&&player.generalId!=null);
  for(const player of enemyAliases) cards.set(player.name,player.generalId);
  cards.set('霜墙女王', 527); cards.set('女王', 527); cards.set('冰棱', 9001);
  const bossCard = state.boss ? state.players?.[state.boss.owner]?.generalId ?? null : null;
  const bossName = state.boss ? bossDefinition(state.boss.id)?.name : null;
  if (bossName && bossCard != null) cards.set(bossName, bossCard);
  const names = [...cards.keys()].sort((a,b) => b.length-a.length);
  const idOf = text => { const name = names.find(name => text.includes(name)); return name ? cards.get(name) : null; };
  const event = (kind, label, detail, extras = {}) => ({ kind, sourceId:null, targetId:null, label, amount:null, keyword:null, tone:'neutral', detail, ...extras });
  function parse(text) {
    if (text.startsWith(SPELL_HISTORY_PREFIX)) {
      let record;
      try { record = JSON.parse(text.slice(SPELL_HISTORY_PREFIX.length)); } catch { return event('other','战况',text); }
      if (!validSpellRecord(record)) return event('other','战况',text);
      const effects = record.rows.map(row => parse(row.replace(/^第\d+回合\s*·\s*(?:我方|敌方)｜/, ''))).filter(effect => effect && effect.kind !== 'spell' && !(effect.kind === 'damage' && CARDS[effect.targetId]?.type === 'spell') && !(effect.kind === 'other' && effect.targetId == null));
      const matchedEffects = new Set();
      for (const change of record.changes) {
        const keyword = change.kind === 'status' ? change.label : null;
        const matched = effects.findIndex((effect,index) => !matchedEffects.has(`${index}:${change.label}`) && effect.targetId === change.targetId && (effect.targetUnitId == null || effect.targetUnitId === change.targetUnitId) && effect.kind === change.kind && (change.kind !== 'status' || effect.keyword?.includes(change.label)));
        if (matched >= 0) { matchedEffects.add(`${matched}:${change.label}`); continue; }
        effects.push(event(change.kind, change.label, change.label, { ...change, keyword, tone:change.kind === 'summon' ? 'summon' : change.kind === 'death' ? 'damage' : /冻结/.test(change.label) ? 'freeze' : 'buff' }));
        matchedEffects.add(`${effects.length-1}:${change.label}`);
      }
      if (!effects.length) for (const target of record.targets ?? []) effects.push(event('status','无变化','无变化',target));
      return event('spell','施法', `${CARDS[record.cardId]?.name ?? '法术'}。${record.rows.map(row=>row.replace(/^.*?｜/,'')).join(' ')}`, {
        sourceId:record.cardId, casterId:record.casterId, casterName:record.casterName, targetId:null, cell:record.cell, effects, tone:'buff',
      });
    }
    if (/^(?:你的第一回合开始|第\s*\d+\s*回合开始|[^，：。]*开始回合|轮到你了|初始远征[^。]*|[^。]*替换了一张手牌)[。！]?$/.test(text) || /抽到|手牌：/.test(text)) return null;
    let m;
    // Intent and lifecycle entries precede hit parsing: a promised hit is never damage.
    const lifecycle = text.match(/^(取消|关闭|耗尽|复生失败|残骸|军令|移形|回撤|亲自迎战|治疗)：/);
    if (lifecycle) {
      const label=lifecycle[1];
      const kind=['取消','复生失败'].includes(label)?'cancel':['关闭','耗尽'].includes(label)?'close':['移形','回撤'].includes(label)?'move':'status';
      return event(kind,label,text,{sourceId:idOf(text),keyword:label,tone:'neutral'});
    }
    if (/预告|最后号令.*准备/.test(text)) {
      const actor=text.replace(/^预告[：:]/,'').split(/[，,]/)[0];
      const alias=enemyAliases.find(player=>actor===player.name);
      const keyword=/召唤/.test(text)?'援军预告':/攻击\+1/.test(text)?'强化预告':/恢复2点生命/.test(text)?'治疗预告':/复生祭兵/.test(text)?'复生预告':/移形/.test(text)?'移形预告':/回撤/.test(text)?'回撤预告':'预告';
      return event('forecast',keyword,text,{sourceId:idOf(actor),...(alias?{sourceName:alias.name}:{}),amount:Number(text.match(/(?:造成|伤害)\s*(\d+)/)?.[1])||null,keyword,tone:'neutral'});
    }
    if (/复生失败/.test(text)) return event('cancel','复生失败',text,{targetId:idOf(text),keyword:'复生失败'});
    if (/取消|落空|被踩除|被净除|被封闭/.test(text)) return event('cancel',/踩除|净除/.test(text)?'净除':/封闭/.test(text)?'封口':'取消',text,{targetId:idOf(text)});
    if (/关闭|耗尽|失去供能|护阵解除/.test(text)) return event('close',text.includes('耗尽')?'耗尽':'关闭',text,{targetId:idOf(text)});
    if ((m=text.match(/^(.+?)\s*攻击\s*(.+?)[。！]?$/)) && idOf(m[1]) != null && idOf(m[2]) != null) return event('attack','攻击',text,{sourceId:idOf(m[1]),targetId:idOf(m[2]),tone:'damage'});
    if ((m=text.match(/^(.+?)受到\s*(\d+)\s*点(碎冰|冰封|疲劳|蓄势|反噬)?伤害/))) return event('damage',m[3]??'伤害',text,{sourceId:m[3]==='冰封'?527:m[3]==='碎冰'?9001:['蓄势','反噬'].includes(m[3])?bossCard:null,targetId:idOf(m[1]),amount:Number(m[2]),keyword:m[3]??null,tone:'damage'});
    if ((m=text.match(/^(.+?)恢复\s*(\d+)\s*点生命/))) return event('heal','治疗',text,{targetId:idOf(m[1]),amount:Number(m[2]),tone:'heal'});
    if (/霜甲/.test(text)) return event('armor','霜甲',text,{targetId:527,amount:1,keyword:'减伤',tone:'freeze'});
    if (/第二阶段|进入.*阶段|凛冬降临/.test(text)) return event('phase',text.includes('凛冬')?'凛冬':'增援',text,{sourceId:bossCard??527,keyword:'第二阶段',tone:text.includes('凛冬')?'freeze':'summon'});
    if (/蓄势：/.test(text)) return event('mark','蓄势',text,{sourceId:bossCard,amount:(text.match(/（[^）]+）/g)??[]).join(' '),keyword:'标记',tone:'damage'});
    if (/反噬/.test(text)) return event('damage','反噬',text,{targetId:bossCard,keyword:'反噬',tone:'damage'});
    if (/冰封：标记/.test(text)) return event('mark','冰封',text,{sourceId:527,amount:(text.match(/（[^）]+）/g)??[]).join(' '),keyword:'标记',tone:'freeze'});
    if ((m=text.match(/^(.+?)使用(.+?)[。！]?$/))) { const hero=Object.values(HEROES).find(hero => m[2].includes(hero.activeName)); return event('skill',hero?.activeName??'技能',text,{sourceId:hero?.bbsCardId??idOf(m[1]),tone:'buff'}); }
    if ((m=text.match(/施放\s*(.+?)[。！]?$/))) return event('spell','施法',text,{sourceId:idOf(m[1]),tone:'buff'});
    if (/^生成：/.test(text)) return event('summon','生成',text,{targetId:idOf(text),tone:'summon'});
    if (/出现在|召唤\s|生成冰棱/.test(text)) return event('summon','召唤',text,{targetId:idOf(text.includes('召唤') ? text.split('召唤').slice(1).join('召唤') : text.includes('生成冰棱') ? '冰棱' : text.split('出现在')[0]),tone:'summon'});
    if (/被烧毁/.test(text)) return event('burn','烧毁',text,{targetId:idOf(text.split('手牌已满，').at(-1)),tone:'damage'});
    if (/被击败|倒下/.test(text)) return event('death','击败',text,{targetId:idOf(text),tone:'damage'});
    if ((m=text.match(/^(.+?)\s+移动[。！]?$/))) return event('move','移动',text,{sourceId:idOf(m[1])});
    if ((m=text.match(/移动到（([^）]+)）/))) return event('move','移动',text,{sourceId:idOf(text),amount:m[1]});
    if (/冻结|嘲讽|攻击\d+→|生命上限|驱散|飞行|狂暴|\+\s*\d|控制权|变形/.test(text)) {
      const keyword = ['冻结','嘲讽','驱散','飞行','狂暴','控制权改变','变形'].filter(word=>text.includes(word)).map(word=>text.includes(`${word}结束`) ? `${word}结束` : text.includes(`失去${word}`) ? `失去${word}` : word).join('·')||'强化';
      return event('status',keyword,text,{targetId:idOf(text.split('：')[0]),keyword,tone:keyword.includes('冻结')?'freeze':'buff',amount:(text.match(/(?:攻击|生命上限)\d+→\d+/g)??[]).map(change=>change.replace('攻击','攻').replace('生命上限','血')).join(' ')||null});
    }
    if (/碎裂/.test(text)) return event('damage','碎冰',text,{sourceId:9001,tone:'damage'});
    if (/远征目标完成/.test(text)) return event('other','胜利',text,{tone:'buff'});
    if (/远征失败/.test(text)) return event('other','失败',text,{tone:'damage'});
    // Unknown legacy prose stays available to assistive technology, never as a paragraph.
    return event('other','战况',text,{targetId:idOf(text)});
  }
  // Merge only effects supported by the public spell description; adjacency alone
  // must not attribute an unrelated hit to a utility spell.
  const compatible = (action, effect) => {
    if (effect.keyword || effect.sourceId !== null) return false;
    const card = CARDS[action.sourceId];
    const hero = Object.values(HEROES).find(hero => hero.bbsCardId === action.sourceId);
    const description = card?.description ?? hero?.activeDescription ?? '';
    return effect.kind === 'heal' ? /恢复|治疗/.test(description) : /伤害/.test(description);
  };
  const groups=[];
  // Structured casts own their exact transaction rows, so the same cast never
  // appears once as a spell and again as a set of unrelated effect rows.
  const rows = state.log ?? [], covered = new Set();
  for (let index = rows.length - 1; index >= 0; index--) {
    const text = typeof rows[index] === 'string' ? rows[index].replace(/^.*?｜/, '') : '';
    if (!text.startsWith(SPELL_HISTORY_PREFIX)) continue;
    try {
      const record = JSON.parse(text.slice(SPELL_HISTORY_PREFIX.length));
      if (!validSpellRecord(record)) continue;
      let previous = index - 1;
      for (let offset = record.rows.length - 1; offset >= 0 && previous >= 0; offset--, previous--) {
        if (rows[previous] !== record.rows[offset]) break;
        covered.add(previous);
      }
    } catch { /* Malformed historical text remains on the legacy path. */ }
  }
  for (const [rowIndex, row] of rows.entries()) {
    if (covered.has(rowIndex)) continue;
    if(typeof row!=='string') continue;
    const match=row.match(/^第(\d+)回合\s*·\s*(我方|敌方)｜(.*)$/);
    if(!match) continue;
    const round=Number(match[1]), side=match[2]==='我方'?0:1;
    if(round<Math.max(1,state.round-1)||round>state.round) continue;
    const next=parse(match[3]); if(!next) continue;
    // Bosses can share a card portrait with the player; alias the recorded actor,
    // never every occurrence of that card ID.
    if (bossName && next.sourceId === bossCard && (['mark','phase'].includes(next.kind) || ['蓄势','反噬','冰封'].includes(next.keyword) || match[3].startsWith(`敌方${bossName}`) || match[3].startsWith(bossName))) next.sourceName = bossName;
    if (bossName && next.targetId === bossCard && (match[3].startsWith(`敌方${bossName}`) && next.kind !== 'attack' || next.kind === 'attack' && match[3].includes(`攻击敌方${bossName}`))) next.targetName = bossName;
    for (const field of ['source','target']) {
      const id = next[`${field}Id`];
      if (id == null || next[`${field}Name`]) continue;
      const actorText = next.kind === 'attack' ? match[3].split('攻击')[field === 'source' ? 0 : 1] ?? '' : match[3];
      const aliases = Object.values(state.battleCards ?? {}).flatMap(table => Object.values(table ?? {})).filter(card => Number(card?.id) === Number(id) && card.name && actorText.includes(card.name)).sort((a,b)=>b.name.length-a.name.length);
      const alias = aliases[0];
      if (alias && alias.name !== CARDS[id]?.name) next[`${field}Name`] = alias.name;
    }
    let group=groups.at(-1);
    if(!group||group.round!==round||group.side!==side) {group={round,side,events:[]};groups.push(group);}
    const previous=group.events.at(-1);
    if(previous?.kind==='status'&&next.kind==='status'&&previous.targetId!==null&&previous.targetId===next.targetId&&previous.keyword===next.keyword&&previous.amount===next.amount) {previous.detail+=' '+next.detail;continue;}
    if(previous?.kind==='summon'&&next.kind==='summon'&&previous.targetId!==null&&previous.targetId===next.targetId&&/出现在|生成冰棱/.test(previous.detail)!==/出现在|生成冰棱/.test(next.detail)) {previous.detail+=' '+next.detail;continue;}
    if(previous?.kind==='attack'&&previous.amount===null&&next.kind==='damage'&&previous.targetId!==null&&previous.targetId===next.targetId&&next.keyword===null) {previous.amount=next.amount;previous.detail+=' '+next.detail;continue;}
    if(previous&&['spell','skill'].includes(previous.kind)&&['damage','heal'].includes(next.kind)&&compatible(previous,next)) {next.keyword ??= next.kind==='heal'?'治疗':'伤害';next.sourceId=previous.sourceId;next.label=previous.label;next.kind=previous.kind;next.detail=previous.detail+' '+next.detail;group.events.pop();}
    else if(previous&&['damage','heal'].includes(previous.kind)&&next.kind==='spell'&&compatible(next,previous)) {previous.keyword ??= previous.kind==='heal'?'治疗':'伤害';previous.sourceId=next.sourceId;previous.kind='spell';previous.label='施法';previous.detail+=' '+next.detail;continue;}
    group.events.push(next);
  }
  return {groups};
}
