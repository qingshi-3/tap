import { EXPEDITION_CHAPTERS, EXPEDITION_LEVELS } from './expedition-data.js';
import { CARDS } from './cards.js';
import { getHero } from './factions.js';
import { getEnemyPlan } from './enemy-plans.js';
import { createGameCard } from './game-card.js';
import { getSpellUpgrade } from './campaign-rules.js';
import { cardRuleSections } from './card-rules.js';
import { EXPANSION_RACES } from './expansion-mechanics.js';

const node = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
const choice = (cls, action) => { const n = node('button', cls); n.type = 'button'; n.dataset.action = action; return n; };
const name = chapter => chapter.title.replace(/^.*?章\s*·\s*/, '');
const SVG = 'http://www.w3.org/2000/svg';
function shape(tag, attrs) { const n = document.createElementNS(SVG, tag); for (const [key,value] of Object.entries(attrs)) n.setAttribute(key,value); return n; }

// Mirror current battle-card construction (engine.js): enemy spells use power
// mode, authored stats replace base stats, and expansion race affects keywords.
// Never read the player's training, inventory or mutable battle state here.
export function atlasEnemyCard(id, army) {
  const base = CARDS[id];
  if (!base) return null;
  const card = base.type === 'spell' ? getSpellUpgrade(id, army.spellRank ?? 0, 'power') : { ...base };
  if (EXPANSION_RACES[id]) card.race = EXPANSION_RACES[id];
  if (army.unitStats?.[id]) Object.assign(card, army.unitStats[id]);
  if (Number(id) === Number(army.generalId)) {
    card.attack = army.generalAttack;
    card.health = army.generalHealth;
  }
  if (card.effect === 'firstWish') {
    card.description = card.description.replace('补给1次', '抽1张牌');
    if (card.campaignSummary) card.campaignSummary = card.campaignSummary.replace('补给1次', '抽1张牌');
  }
  return card;
}

function openEnemyCard(ui, card, trigger, intelBody, host) {
  const scrollTop = intelBody.scrollTop;
  const dialog = node('dialog', 'atlas-enemy-card-dialog');
  dialog.setAttribute('aria-label', card.name);
  const heading = node('header', 'atlas-dialog-heading');
  const close = node('button', 'atlas-dialog-close', '关闭'); close.type = 'button';
  heading.append(node('h3', '', card.name), close);
  const body = node('div', 'atlas-enemy-card-body');
  body.tabIndex = 0; body.setAttribute('aria-label', '卡牌完整规则');
  const art = createGameCard(card, { drawArt: (canvas, id) => ui.paint(canvas, id) });
  const rules = node('div', 'atlas-enemy-card-rules');
  for (const { label, text } of cardRuleSections(card)) {
    const section = node('section', 'codex-detail-rule');
    if (label && !['规则', '法术'].includes(label)) section.append(node('h4', '', label));
    section.append(node('p', '', text)); rules.append(section);
  }
  body.append(art, rules); dialog.append(heading, body); host.append(dialog);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => {
    event.preventDefault(); event.stopPropagation(); dialog.close();
  });
  dialog.addEventListener('close', () => {
    art.closeKeywords?.(); dialog.remove();
    intelBody.scrollTop = scrollTop;
    if (trigger.isConnected) trigger.focus({ preventScroll: true });
  }, { once: true });
  dialog.showModal(); close.focus({ preventScroll: true });
}

// Every miniature is derived from encounter coordinates; no decorative map layout.
function miniature(level, plan) {
  const cols = level.columns || 9, rows = level.rows || 5, sx = 12, sy = 6;
  const svg = shape('svg', { viewBox: `0 0 ${(cols + rows) * sx + 24} ${(cols + rows) * sy + 40}`, 'aria-hidden': 'true', focusable: 'false' });
  svg.classList.add('atlas-map');
  const tiles = new Map((level.tiles || []).map(t => [`${t.x},${t.y}`,t.type]));
  const occupants = new Map();
  if (level.playerStart) occupants.set(`${level.playerStart.x},${level.playerStart.y}`,'friendly');
  for (const [owner,army] of Object.entries(plan.players || {})) for (const unit of army.garrison || []) occupants.set(`${unit.x},${unit.y}`,Number(owner) === 2 ? 'third' : 'enemy');
  if (!Object.values(plan.players || {}).some(army => army.garrison?.length)) for (const unit of level.enemies || []) occupants.set(`${unit.x},${unit.y}`,unit.owner === 2 ? 'third' : 'enemy');
  const palettes = ['#648474','#547681','#646b82','#aa8b60','#756580','#7f9ba5','#6c8581','#8b8070','#776f8e','#8a7970'];
  const chapterIndex = EXPEDITION_CHAPTERS.findIndex(c => c.id === level.chapterId);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const px = (x-y+rows)*sx+12, py = (x+y)*sy+22;
    const terrain = tiles.get(`${x},${y}`), occupant = occupants.get(`${x},${y}`);
    svg.append(shape('polygon',{ points:`${px-sx},${py} ${px},${py+sy} ${px+sx},${py} ${px+sx},${py+5} ${px},${py+sy+5} ${px-sx},${py+5}`,fill:'#263c43' }));
    svg.append(shape('polygon',{ points:`${px},${py-sy} ${px+sx-1},${py} ${px},${py+sy-1} ${px-sx+1},${py}`,fill:terrain === 'outpost' ? '#d8b16e' : palettes[Math.max(0,chapterIndex)], opacity: (x+y)%2 ? '.85' : '1' }));
    if (terrain === 'wall' || terrain === 'rough') svg.append(shape('image',{ href:`./assets/tiles/${terrain === 'wall' ? 'wall-barricade-v2' : 'rough-debris-v2'}.png`, x:px-12,y:py-21,width:24,height:26,preserveAspectRatio:'xMidYMax meet' }));
    if (occupant) {
      const fill = occupant === 'friendly' ? '#7fdbff' : occupant === 'third' ? '#e4b973' : '#e99892';
      svg.append(shape('ellipse',{cx:px,cy:py-1,rx:7,ry:3,fill,opacity:'.5'}));
      svg.append(shape('path',{d:`M${px-4} ${py-3} L${px-3} ${py-12} Q${px} ${py-16} ${px+3} ${py-12} L${px+4} ${py-3}Z`,fill}));
    }
  }
  return svg;
}

export function buildCampaignAtlas(ui) {
  if (!ui.chapterId) {
    const preferred = EXPEDITION_LEVELS.find(l => l.id === ui.levelId) || EXPEDITION_LEVELS.find(l => ui.progress.isUnlocked(l.id) && !ui.completed(l.id)) || EXPEDITION_LEVELS[0];
    ui.chapterId = preferred.chapterId; ui.levelId = preferred.id;
  }
  const chapter = EXPEDITION_CHAPTERS.find(c => c.id === ui.chapterId) || EXPEDITION_CHAPTERS[0];
  if (!chapter.levelIds.includes(ui.levelId)) ui.levelId = chapter.levelIds.find(id => ui.progress.isUnlocked(id) && !ui.completed(id)) || chapter.levelIds[0];
  const view = node('section','campaign-atlas'); view.setAttribute('aria-label','远征选关');
  const heading = node('header','atlas-heading');
  const completed = EXPEDITION_LEVELS.filter(level => ui.completed(level.id)).length;
  const progress = node('span','atlas-progress',`${completed} / ${EXPEDITION_LEVELS.length}`);
  progress.setAttribute('aria-label',`${ui.faction.name}已完成${completed}关，共${EXPEDITION_LEVELS.length}关`);
  heading.append(ui.buildMenuReturn(),progress);
  const chapters = node('nav','atlas-chapters'); chapters.setAttribute('aria-label','远征章节');
  for (const [index,c] of EXPEDITION_CHAPTERS.entries()) {
    const unlocked = ui.progress.isUnlocked(c.levelIds[0]), count = c.levelIds.filter(id => ui.completed(id)).length;
    const b = choice(`atlas-chapter${unlocked ? '' : ' is-locked'}`,'chapter'); b.dataset.chapterId = c.id;
    b.setAttribute('aria-pressed',String(c.id === chapter.id));
    b.setAttribute('aria-label',`第${index+1}章 ${name(c)}，${count}/${c.levelIds.length}关完成${unlocked ? '' : '，未解锁，可预览'}`);
    const chapterCopy = node('span','atlas-chapter-copy');
    const progress = node('span','atlas-chapter-progress'); progress.setAttribute('aria-hidden','true');
    for (const levelId of c.levelIds) progress.append(node('i',ui.completed(levelId) ? 'is-complete' : ''));
    chapterCopy.append(node('strong','',name(c)),progress);
    b.append(node('span','atlas-chapter-number',String(index+1)),chapterCopy);
    if (!unlocked) {
      const lock = shape('svg',{viewBox:'0 0 16 20','aria-hidden':'true',focusable:'false'}); lock.classList.add('atlas-lock');
      lock.append(shape('path',{d:'M4 8V5a4 4 0 0 1 8 0v3h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm2 0h4V5a2 2 0 0 0-4 0z',fill:'currentColor','fill-rule':'evenodd'}));
      b.append(lock);
    }
    chapters.append(b);
  }
  chapters.scrollLeft = ui.atlasScrollLeft || 0;
  chapters.addEventListener('scroll',() => { ui.atlasScrollLeft = chapters.scrollLeft; },{passive:true});
  const levels = node('div','atlas-levels'); levels.setAttribute('role','group'); levels.setAttribute('aria-label','关卡');
  for (const id of chapter.levelIds) {
    const level = EXPEDITION_LEVELS.find(l => l.id === id), unlocked = ui.progress.isUnlocked(id), selected = id === ui.levelId;
    const plan = getEnemyPlan(id,3,ui.faction.id), status = ui.completed(id) ? '已完成' : unlocked ? '可出征' : '未解锁';
    const b = choice(`atlas-level${selected ? ' is-selected' : ''}${unlocked ? '' : ' is-locked'}${ui.completed(id) ? ' is-complete' : ''}`,'level'); b.dataset.levelId = id;
    b.setAttribute('aria-pressed',String(selected)); b.setAttribute('aria-label',`${level.title}，${status}${selected ? '，当前选择' : ''}`);
    const caption = node('div','atlas-level-caption'), title = node('strong','atlas-level-name');
    title.append(node('span','atlas-level-number',String(EXPEDITION_LEVELS.indexOf(level)+1).padStart(2,'0')),document.createTextNode(level.title));
    const meta = node('span','atlas-level-meta'); meta.append(node('span','atlas-level-state',status));
    const portraits = node('span','atlas-enemy-portraits');
    for (const army of Object.values(plan.players || {})) {
      const general = CARDS[army.generalId]; if (!general) continue;
      const portrait = node('img','atlas-enemy'); portrait.src = getHero(general.id)?.portrait || `./assets/generals/general_portrait_image_f${general.faction}.png`; portrait.alt = general.name; portrait.title = general.name; portraits.append(portrait);
    }
    caption.append(title,meta,portraits); b.append(miniature(level,plan),caption); levels.append(b);
  }
  const level = EXPEDITION_LEVELS.find(l => l.id === ui.levelId), payout = ui.progress.rewardPreview(level.id,ui.faction.id);
  const summary = node('footer','atlas-summary'), copy = node('div','atlas-summary-copy');
  copy.append(node('p','atlas-goal',level.goal));
  const rewards = node('div','atlas-rewards');
  rewards.append(node('span','atlas-reward-kind',payout.accountFirst || payout.factionFirst ? '首通' : '重打'));
  for (const [amount,file,label] of [[payout.coins,'resource-gold.png','金币'],[payout.tickets,'spirit-orb.png','宝珠']]) if (amount) {
    const reward = node('span','atlas-reward'), icon = node('img',''); icon.src = `./assets/metagame/original/${file}`; icon.alt = label; reward.append(icon,document.createTextNode(String(amount))); rewards.append(reward);
  }
  const unlocks = [...(payout.cards?.units || []),...(payout.cards?.spells || [])].filter(id => CARDS[id]?.faction === ui.faction.id || CARDS[id]?.faction === 0).map(id => CARDS[id]?.name).filter(Boolean);
  if (unlocks.length) rewards.append(node('span','atlas-unlocks',`解锁：${unlocks.join('、')}`));
  copy.append(rewards);
  const intel = node('button','atlas-intel','敌情'); intel.type = 'button'; intel.setAttribute('aria-haspopup','dialog');
  const dialog = node('dialog','atlas-dialog atlas-intel-dialog'); dialog.setAttribute('aria-label',`${level.title}敌情`);
  const dialogHead = node('div','atlas-dialog-heading'), close = node('button','atlas-dialog-close','关闭'); close.type = 'button';
  dialogHead.append(node('h3','',level.title),close);
  const body = node('div','atlas-dialog-body'), plan = getEnemyPlan(level.id,3,ui.faction.id);
  body.tabIndex = 0;
  body.setAttribute('aria-label','敌军与奖励详情');
  for (const [owner,army] of Object.entries(plan.players || {})) {
    body.append(node('h4','',`${Number(owner) === 2 ? '第三方' : '敌方'} · ${CARDS[army.generalId]?.name || '主将'}`));
    body.append(node('p','',`${army.generalAttack} 攻 / ${army.generalHealth} 血；起手 ${army.openingHandSize} 张，法力 ${army.mana} 起步，每轮 +${army.manaGrowth}，上限 ${army.manaCap}`));
    const counts = new Map(); for (const id of army.deck || []) counts.set(id,(counts.get(id)||0)+1);
    const grid = node('div','atlas-enemy-grid');
    for (const [id,count] of counts) {
      const card = atlasEnemyCard(id, army);
      if (!card) continue;
      const item = node('article','atlas-enemy-card');
      const open = node('button','atlas-enemy-card-open'); open.type = 'button';
      open.setAttribute('aria-label', `${card.name}，${count}张，查看详情`);
      open.setAttribute('aria-haspopup','dialog');
      open.append(createGameCard(card, { drawArt: (canvas, cardId) => ui.paint(canvas, cardId) }));
      open.addEventListener('click', () => openEnemyCard(ui, card, open, body, view));
      item.append(open,node('strong','atlas-enemy-count',`×${count}`)); grid.append(item);
    }
    body.append(grid);
  }
  if (unlocks.length) body.append(node('p','',`解锁：${unlocks.join('、')}`));
  if (payout.chapterCoins) body.append(node('p','',`奖励含本阵营章末 ${payout.chapterCoins} 金币`));
  if (payout.compensationCoins) body.append(node('p','',`奖励含宝珠转金币 ${payout.compensationCoins}`));
  dialog.append(dialogHead,body);
  intel.addEventListener('click',() => { dialog.showModal(); close.focus(); });
  close.addEventListener('click',() => dialog.close());
  dialog.addEventListener('close',() => intel.focus({preventScroll:true}));
  const start = choice('atlas-start','adjust-loadout'); start.dataset.levelId = level.id; start.disabled = !ui.progress.isUnlocked(level.id); start.textContent = start.disabled ? '未解锁' : '战前准备';
  const actions = node('div','atlas-actions'); actions.append(intel,start);
  summary.append(copy,actions); view.append(heading,chapters,levels,summary,dialog); return view;
}
