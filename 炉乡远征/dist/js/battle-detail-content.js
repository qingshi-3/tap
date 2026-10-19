import { openHeroEffectDialog, closeHeroEffectDialog } from './hero-effect-dialog.js';
import { cardRuleSections, unitSections } from './card-rules.js';
import { cardKeywords } from './card-keywords.js';
import { cardAttackRange } from './attack-range.js';

const clean = text => text.replace(/^\s*\d+\s*\/\s*\d+\s*[。.]?\s*/, '');
const make = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text) node.textContent = text; return node; };
// Only structured sections are eligible; raw expansion descriptions stay intact.
const commonUnitTerms = new Set(['raceVespyr','raceDervish','provoke','rush','airdrop','flying','grow','zeal','backstab','ranged','blast','infiltrate','rebirth','wall']);
const passiveIcons = {1:'health',23:'keyword-attack',101:'role-assassin',123:'ranged',201:'health',223:'keyword-overheal',301:'keyword-deathrattle',323:'keyword-overheal',401:'keyword-attack',418:'role-summoner',501:'health',527:'keyword-taunt'};
// Rule wording comes from the shared engine-facing source; presentation never changes mechanics.
export function renderBattleDetailRules(container, {card,hero,silenced,specialty,supply,supplyCommand,drawArt,unit}) {
  const sections = cardRuleSections(card);
  const gained = !silenced && unit ? {dying:unit.grantedDyingSpawns?.includes(516),flying:unit.flyingBuff&&!card.flying} : null;
  const key = JSON.stringify([card.id,sections,hero?.id,hero?.cost,unit?.unitId,silenced,specialty,supply,supplyCommand,gained]);
  if (container.dataset.rulesKey === key) return;
  closeHeroEffectDialog({restoreFocus:false});
  container.dataset.rulesKey = key;
  const compactUnit = !hero && card.type === 'unit';
  container.classList.toggle('has-unit-rule-controls',compactUnit);
  const list = make('div',`inspect-rule-list${hero ? ' is-hero-abilities' : compactUnit ? ' is-unit-rule-controls' : ''}`);
  if (silenced) list.append(make('div','inspect-rule-meta','已驱散'));
  function add(name,copy,{active=false,icon=false,passive=false,meta=''}={}) {
    const rule = make('div','inspect-rule');
    if (icon && hero?.bbsCardId) {
      const canvas = make('canvas','inspect-rule-icon'); canvas.width=canvas.height=44;
      canvas.setAttribute('aria-hidden','true'); rule.append(canvas); drawArt(canvas,hero.bbsCardId);
    }
    if (passive) {
      const image = make('img','inspect-rule-icon is-passive');
      image.src = `./assets/ui/keywords/${passiveIcons[hero.id] || 'health'}.svg`;
      image.alt = ''; rule.append(image);
    }
    const content = make('div','inspect-rule-content');
    if (name) {
      const heading = make('div','inspect-rule-name',name);
      if(active) { const badge=make('span','inspect-rule-cost mana',String(hero.cost)); badge.setAttribute('aria-label',`${hero.cost}法力`);heading.append(badge); }
      if(meta) heading.append(make('span','inspect-rule-meta',meta));
      content.append(heading);
    }
    if(copy) content.append(make('div','inspect-rule-copy',clean(copy)));
    rule.append(content); list.append(rule);
  }
  if(hero) {
    function ability(name, effect, {active=false}={}) {
      const button = make('button','inspect-ability'); button.type = 'button';
      button.setAttribute('aria-label', `${name}，查看效果${active ? `，${hero.cost}法力` : ''}`);
      if(active && hero.bbsCardId) {
        const canvas = make('canvas','inspect-rule-icon'); canvas.width=canvas.height=44;
        canvas.setAttribute('aria-hidden','true'); button.append(canvas); drawArt(canvas,hero.bbsCardId);
      } else {
        const image = make('img','inspect-rule-icon is-passive');
        image.src=`./assets/ui/keywords/${passiveIcons[hero.id] || 'health'}.svg`; image.alt=''; button.append(image);
      }
      button.append(make('span','inspect-ability-name',name));
      if(active) {
        const cost=make('span','inspect-rule-cost mana',String(hero.cost));
        cost.setAttribute('aria-label',`${hero.cost}法力`); button.append(cost);
      }
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        openHeroEffectDialog({name,effect:clean(effect),trigger:button,owner:container.closest('#unit-inspect')});
      });
      list.append(button);
    }
    ability(hero.activeName,supplyCommand ? '恢复第一张尚未补满的牌1次使用次数。' : sections[0].text,{active:true});
    ability(hero.passiveName,sections[1].text);
  } else if(compactUnit) {
    const keywords = cardKeywords(card);
    const unique = [], common = [];
    const addUnique = (label,text) => {
      if (!text || /^无特殊效果[。.]?$/.test(text.trim())) return;
      // Deduplicate only identical complete rule text. Never trim unknown mechanics.
      if (!unique.some(entry => entry.text === text)) unique.push({label,text});
    };
    function control(name,effect,icon) {
      const button=make('button','inspect-unit-rule'); button.type='button';
      button.setAttribute('aria-label',`${name}，查看效果`);
      const image=make('img','inspect-rule-icon'); image.src=`./assets/ui/keywords/${icon}.svg`; image.alt='';
      button.append(image,make('span','inspect-unit-rule-name',name));
      button.addEventListener('click',event=>{
        event.preventDefault(); event.stopPropagation();
        openHeroEffectDialog({name,effect,trigger:button,owner:container.closest('#unit-inspect')});
      });
      list.append(button);
    }
    for (const {label,text} of sections) {
      const entry=keywords.find(term=>commonUnitTerms.has(term.id) && term.label===label);
      if (!entry) { addUnique(label,text); continue; }
      let name=entry.label;
      if (entry.id==='ranged' || entry.id==='blast') {
        const range=cardAttackRange(card);
        name+=Number.isFinite(range)?` ${range}格`:' ∞';
      }
      common.push({name,text,icon:entry.icon});
    }
    if(specialty) addUnique(specialty.name,specialty.description);
    if(gained?.dying) addUnique('获得亡愿','在原格召唤1/1嘲讽树人。');
    if(gained?.flying) addUnique('获得飞行','可飞至任意非墙空格，仍受眩晕与嘲讽限制。');
    // The lower card has room for one 44px row. Multiple mechanics share a
    // reader rather than turning the original card into a scrolling rule list.
    const all=[...common.map(({name,text})=>({label:name,text})),...unique];
    if(all.length) {
      // Raw expansion text names common terms but does not define them. Attach
      // the same field-driven rules used by base units, without editing raw copy.
      const definitions=sections.some(({label})=>label==='规则')
        ? unitSections(card).filter(({label})=>keywords.some(term=>commonUnitTerms.has(term.id) && term.label===label))
        : [];
      const effect=(silenced ? '原有能力与专精已停用。\n\n' : '') + [...all,...definitions].map(({label,text})=>`${label==='规则' ? '' : `${label}：`}${text}`).join('\n\n');
      const shortUnique=unique.length===1 && unique[0].text.length<=24 ? unique[0].text : '';
      const specificNames=unique.map(({label})=>label).filter(label=>label!=='规则');
      // Raw expansion sections expose their existing effect names, without
      // splitting or rewriting their authoritative complete description.
      if(unique.length && !specificNames.length) {
        specificNames.push(...keywords.map(term=>{
          if(term.id==='ranged' || term.id==='blast') {
            const range=cardAttackRange(card);
            return `${term.label} ${Number.isFinite(range) ? `${range}格` : '∞'}`;
          }
          if(term.id==='movementAura') return `${term.label} +${card.movementAura}`;
          return term.label;
        }));
      }
      const names=[...common.map(({name})=>name),...specificNames];
      const named=names.join(' · ');
      const name=shortUnique && !common.length ? shortUnique
        : named && named.length<=24 ? named
        : common.length===1 && !unique.length ? common[0].name : '效果详情';
      control(name,effect,common[0]?.icon || keywords[0]?.icon || 'keyword-follow-up');
    }
  } else {
    for(const {label,text} of sections) {
      if (/^无特殊效果[。.]?$/.test(text.trim())) continue;
      add(label === '规则' ? '' : label,text);
    }
    if(specialty) add(specialty.name,specialty.description,{meta:'专精'});
    if(gained?.dying) add('亡愿','在原格召唤1/1嘲讽树人。');
    if(gained?.flying) add('飞行','可飞至任意非墙空格，仍受眩晕与嘲讽限制。');
  }
  if(supply !== null && supply !== false) list.append(make('div','inspect-rule-meta',`本场剩余${supply}次`));
  container.replaceChildren(list);
}

