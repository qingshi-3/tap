// 入口：状态、面板 UI、一天的流程编排。
import {FACILITIES, LEGENDS, RACES, RANKS, ROLES, SAVE_KEY, SEASON_DAYS, SKILLS, TRAITS, WEEK_DAYS} from './data.js';
import * as S from './sim.js';
import {createBattle, runHeadless} from './battle.js';
import {createKit} from './kit.js';
import {HallView} from './hallView.js';
import {BattleView} from './battleView.js';
import {installSkin} from './skin.js';

installSkin();

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const kit = createKit();
let state = null;
let busy = false;
const ui = {tab: null, quest: null, member: null};
const winCache = new Map();

// ---------- 存档 ----------
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* 存储不可用时忽略 */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ---------- 通用 UI ----------
function toast(text, tone = '') {
  const el = $('#toast');
  el.textContent = text;
  el.className = 'show ' + tone;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.className = ''; }, 1800);
}

function act(err, okText) {
  if (err) { toast(err, 'bad'); return false; }
  if (okText) toast(okText, 'good');
  save();
  refresh();
  return true;
}

function modal(html, {wide = false} = {}) {
  const m = $('#modal');
  m.querySelector('.m-box').innerHTML = html;
  m.querySelector('.m-box').classList.toggle('wide', wide);
  m.classList.remove('hidden');
  hydrate(m);
  return m.querySelector('.m-box');
}

function closeModal() {
  $('#modal').classList.add('hidden');
}

function ask(html, buttons) {
  return new Promise(resolve => {
    const box = modal(`${html}<div class="m-actions">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${b.label}</button>`).join('')}</div>`);
    box.querySelectorAll('.m-actions .btn').forEach(btn => { btn.onclick = () => resolve(buttons[btn.dataset.i].value); });
  });
}

// 立绘占位：<canvas data-portrait="unitId" data-size="48">
function hydrate(root) {
  root.querySelectorAll('[data-portrait]').forEach(el => {
    const c = kit.portrait(el.dataset.portrait, Number(el.dataset.size || 48));
    c.className = el.className + ' portrait';
    el.replaceWith(c);
  });
}

const P = (unit, size = 48, cls = '') => `<canvas class="${cls}" data-portrait="${unit}" data-size="${size}"></canvas>`;
const raceTag = r => `<span class="tag" style="--c:${RACES[r].color}">${RACES[r].name}</span>`;
const roleTag = r => `<span class="tag role">${ROLES[r].name}</span>`;
const bar = (v, max, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%"></i></div>`;
const goldTxt = n => `<span class="gold">${n}</span>`;
const icon = id => `<img class="sk-icon" src="${kit.iconURL(id)}" alt="">`;

// ---------- 顶栏 ----------
function renderTop() {
  const r = S.rankIndex(state);
  const next = RANKS[r + 1];
  const dayInSeason = ((state.day - 1) % SEASON_DAYS) + 1;
  const week = Math.ceil(dayInSeason / WEEK_DAYS);
  const dow = (state.day - 1) % WEEK_DAYS;
  const pips = Array.from({length: WEEK_DAYS}, (_, i) => `<i class="${i < dow ? 'done' : i === dow ? 'now' : ''} ${i === WEEK_DAYS - 1 ? 'pay' : ''}"></i>`).join('');
  const res = `<span class="res gold" title="金币">${state.gold}</span>
      <span class="res fame" title="声望">${state.fame}${next ? `<small>/${next.fame}</small>` : ''}</span>
      <span class="res mats" title="魔物素材">${state.mats}</span>`;
  $('#top').innerHTML = `
    <div class="hud-guild"><span class="rank r${r}">${state.rank}</span><div><b>${esc(state.guildName)}</b><small>${RANKS[r].name}公会 · ${state.members.length}/${S.dormCap(state)} 人</small></div></div>
    <div class="hud-res">${res}</div>
    <div class="hud-day"><i class="ic ic-moon"></i><div><b>第 ${state.day} 天</b><small>第 ${state.season} 季 · 第 ${week} 周</small></div><div class="pips" title="周末结算周薪">${pips}</div></div>`;
  $('#panel .p-res').innerHTML = res;
  const assigned = state.quests.filter(q => q.team.length).length;
  $('#endDay').innerHTML = assigned ? `<i class="ic ic-sword"></i><b>出发</b><small>${assigned} 支队伍待命</small>` : `<i class="ic ic-moon"></i><b>结束今天</b><small>全员休整</small>`;
  $('#endDay').classList.toggle('go', !!assigned);
  for (const b of document.querySelectorAll('#nav [data-tab]')) b.classList.toggle('on', b.dataset.tab === ui.tab);
  const urgent = state.quests.some(q => q.special && !q.team.length);
  $('#nav [data-tab="quests"]').classList.toggle('alert', urgent);
  $('#nav [data-tab="recruit"]').dataset.badge = state.visitors.length || '';
}

function refresh() {
  renderTop();
  if (ui.tab) renderPanel();
}

// ---------- 面板 ----------
const TITLES = {quests: '委托板', members: '公会成员', recruit: '招募 · 英灵祭坛', facilities: '公会设施', guild: '公会事务'};

function openPanel(tab, arg) {
  ui.tab = tab;
  if (tab === 'quests' && arg) ui.quest = arg;
  if (tab === 'members' && arg) ui.member = arg;
  if (tab === 'facilities' && arg) ui.facility = arg;
  $('#panel').dataset.tab = tab;
  $('#panel').classList.remove('hidden');
  document.body.classList.add('in-panel');
  hall.running = false;
  renderPanel();
  renderTop();
}

function closePanel() {
  ui.tab = null;
  $('#panel').classList.add('hidden');
  document.body.classList.remove('in-panel');
  hall.running = true;
  renderTop();
}

function renderPanel() {
  $('#panel .p-head h2').textContent = TITLES[ui.tab];
  const body = $('#panel .p-body');
  const scroll = body.querySelector('.col-r')?.scrollTop || 0;
  const scrollL = body.querySelector('.col-l')?.scrollTop || 0;
  body.innerHTML = ({quests: questsPanel, members: membersPanel, recruit: recruitPanel, facilities: facilitiesPanel, guild: guildPanel})[ui.tab]();
  hydrate(body);
  if (body.querySelector('.col-r')) body.querySelector('.col-r').scrollTop = scroll;
  if (body.querySelector('.col-l')) body.querySelector('.col-l').scrollTop = scrollL;
}

function winRate(q) {
  const key = state.day + q.id + q.team.join() + state.members.map(m => m.level + m.gear).join();
  if (!winCache.has(key)) winCache.set(key, S.estimateWinRate(state, q, q.team, 16));
  return winCache.get(key);
}

function rateLabel(r) {
  if (r >= 0.85) return ['十拿九稳', 'good'];
  if (r >= 0.6) return ['胜算较大', 'good'];
  if (r >= 0.35) return ['五五开 · 督战可扭转', 'warn'];
  if (r > 0) return ['凶多吉少', 'bad'];
  return ['几乎必败', 'bad'];
}

function questsPanel() {
  const qs = state.quests;
  if (!qs.find(q => q.id === ui.quest)) ui.quest = qs[0]?.id;
  const q = qs.find(x => x.id === ui.quest);
  const list = qs.map(x => `
    <button class="card q-card ${x.id === ui.quest ? 'sel' : ''} ${x.special ? 'special ' + x.special : ''}" data-act="selQuest" data-id="${x.id}">
      <span class="tier r${Math.min(6, x.tier)}">${RANKS[Math.min(6, x.tier)].id}</span>
      <div class="q-main"><b>${esc(x.title)}</b>
      <small>${goldTxt(x.reward.gold)} · 声望 ${x.reward.fame} · ${x.days ? `离开 ${x.days} 天` : '当晚'} · ${x.expires >= 99 ? '常驻' : `剩 ${x.expires - state.day} 天`}</small></div>
      ${x.team.length ? `<span class="q-team">${x.team.length}人</span>` : ''}
    </button>`).join('');
  if (!q) return `<div class="cols"><div class="col-l">${list || '<p class="muted">今天没有委托。</p>'}</div></div>`;
  const enemies = S.questEnemies(q);
  const rate = q.team.length ? winRate(q) : 0;
  const [rl, rc] = rateLabel(rate);
  const pairs = S.partnerPairs(state, q.team);
  const fric = S.frictionPairs(state, q.team);
  const nm = id => state.members.find(m => m.id === id)?.name;
  const share = q.team.length ? Math.round(q.reward.gold * (1 - state.taxRate) / q.team.length) : 0;
  const limit = S.teamLimit(q);
  const slots = Array.from({length: limit}, (_, i) => {
    const m = state.members.find(x => x.id === q.team[i]);
    return m ? `<button class="slot full" data-act="assign" data-id="${m.id}">${P(m.unit, 40)}<small>${esc(m.name)}</small></button>` : '<div class="slot">空位</div>';
  }).join('');
  const roster = state.members.slice().sort((a, b) => S.memberPower(b) - S.memberPower(a)).map(m => {
    const st = S.memberStatus(state, m);
    const here = q.team.includes(m.id);
    const elsewhere = m.questId && !here;
    const off = st === 'away' || st === 'injured' || st === 'tired';
    return `<button class="chip ${here ? 'on' : ''} ${off ? 'off' : ''}" data-act="assign" data-id="${m.id}">
      ${P(m.unit, 36)}<div><b>${esc(m.name)}</b><small>${ROLES[m.role].name} Lv${m.level} · ${elsewhere ? '已派往他处' : S.STATUS_TEXT[st]}</small>${bar(m.energy, 100, 'energy')}</div></button>`;
  }).join('');
  return `<div class="cols">
    <div class="col-l">${list}</div>
    <div class="col-r">
      <h3>${esc(q.title)}</h3>
      <p class="desc">${esc(q.desc)}</p>
      <div class="enemies">${enemies.map(e => `<div class="enemy ${e.boss ? 'boss' : ''}">${P(e.unit, 44)}<small>${esc(e.name)}</small></div>`).join('')}</div>
      <div class="reward">报酬 ${goldTxt(q.reward.gold)}（公会抽成 ${Math.round(state.taxRate * 100)}% → 入库 ${Math.round(q.reward.gold * state.taxRate)}${q.team.length ? `，每人分 ${share}` : ''}）· 声望 +${q.reward.fame} · 素材 +${q.reward.mats}</div>
      <div class="team-row"><div class="slots">${slots}</div>
        <div class="rate ${rc}"><b>${q.team.length ? Math.round(rate * 100) + '%' : '--'}</b><small>${q.team.length ? rl : '请派遣成员'}</small></div></div>
      ${pairs.map(p => `<div class="hint good">★ 搭档 ${esc(nm(p[0]))} × ${esc(nm(p[1]))}：督战时可释放合体技</div>`).join('')}
      ${fric.map(p => `<div class="hint bad">⚡ ${esc(nm(p[0]))} 与 ${esc(nm(p[1]))} 不和：二人攻击 -12%</div>`).join('')}
      <label class="watch"><input type="checkbox" data-act="watch" ${q.watch ? 'checked' : ''}> 亲自督战（观看战斗并下达打断 / 鼓舞 / 合体技指令）</label>
      <div class="roster">${roster}</div>
    </div></div>`;
}

function memberDetail(m) {
  const s = S.memberStats(m);
  const sk = SKILLS[m.skill];
  const st = S.memberStatus(state, m);
  const others = state.members.filter(o => o.id !== m.id).map(o => ({o, v: m.affinity[o.id] || 0})).sort((a, b) => b.v - a.v);
  const rel = others.length ? others.map(({o, v}) => `<span class="rel ${v >= S.BOND_LEVEL ? 'bond' : v <= -30 ? 'feud' : v < 0 ? 'cold' : ''}">${esc(o.name)} ${v >= S.BOND_LEVEL ? '★' : ''}${v}</span>`).join('') : '<span class="muted">还没有同伴</span>';
  const fc = S.forgeCost(m);
  const forgeCap = state.facilities.forge * 2;
  const leg = m.legend ? LEGENDS.find(l => l.id === m.legend) : null;
  return `<div class="m-detail">
    <div class="m-hero">${P(m.unit, 84, 'big')}
      <div><h3>${esc(m.name)} <small>${esc(m.title)}</small>${m.awakened ? '<span class="tag awake">觉醒</span>' : ''}${m.legend ? '<span class="tag legend">英灵</span>' : ''}</h3>
      <div>${raceTag(m.race)}${roleTag(m.role)}<span class="tag">${TRAITS[m.trait].name}</span><span class="tag st-${st}">${S.STATUS_TEXT[st]}</span></div>
      <div class="lv">Lv ${m.level} ${bar(m.xp, S.xpNeed(m.level), 'xp')}</div>
      <div class="stats"><span>生命 ${s.maxHp}</span><span>攻击 ${s.atk}</span><span>防御 ${s.def}</span><span>战力 ${S.memberPower(m)}</span><span>装备 +${m.gear}</span></div></div></div>
    ${leg ? `<p class="bio">${esc(leg.bio)}</p>` : ''}
    <div class="skill">${icon(sk.icon)}<div><b>${sk.name}</b><small>${sk.desc}</small></div></div>
    <div class="meters">
      <div>忠诚 ${m.loyalty}${bar(m.loyalty, 100, m.loyalty < 25 ? 'low' : 'loyal')}</div>
      <div>体力 ${m.energy}${bar(m.energy, 100, 'energy')}</div>
      <div>个人积蓄 ${goldTxt(m.savings)}</div>
    </div>
    <div class="wish ${m.awakened ? 'done' : ''}">心愿：${m.wish.text} ${m.awakened ? '（已达成 · 全属性 +20%）' : `<b>${Math.min(m.wish.progress, m.wish.n)}/${m.wish.n}</b>`}</div>
    <div class="trait-desc">${TRAITS[m.trait].name}：${TRAITS[m.trait].desc}</div>
    <div class="rels"><small>好感（≥${S.BOND_LEVEL} 成为搭档，≤-30 会起冲突）</small>${rel}</div>
    <div class="record">委托 ${m.record.quests} · 胜利 ${m.record.wins} · 讨伐首领 ${m.record.bossKills} · 入会第 ${m.joinedDay} 天</div>
    <div class="m-actions">
      <button class="btn" data-act="forge" data-id="${m.id}" ${!state.facilities.forge || m.gear >= forgeCap ? 'disabled' : ''}>${state.facilities.forge ? (m.gear >= forgeCap ? '锻造已达上限' : `锻造 +${m.gear + 1}（${fc.gold} 金 · ${fc.mats} 素材）`) : '需要锻造坊'}</button>
      <button class="btn danger" data-act="dismiss" data-id="${m.id}">除名</button>
    </div></div>`;
}

function membersPanel() {
  const ms = state.members;
  if (!ms.find(m => m.id === ui.member)) ui.member = ms[0]?.id;
  const m = ms.find(x => x.id === ui.member);
  const list = ms.map(x => {
    const st = S.memberStatus(state, x);
    return `<button class="chip ${x.id === ui.member ? 'on' : ''}" data-act="selMember" data-id="${x.id}">${P(x.unit, 36)}
      <div><b>${esc(x.name)}${x.legend ? ' ✦' : ''}</b><small>${RACES[x.race].name} · ${ROLES[x.role].name} Lv${x.level} · ${S.STATUS_TEXT[st]}</small>${bar(x.loyalty, 100, x.loyalty < 25 ? 'low' : 'loyal')}</div></button>`;
  }).join('');
  return `<div class="cols"><div class="col-l">${list}</div><div class="col-r">${m ? memberDetail(m) : ''}</div></div>`;
}

function recruitPanel() {
  const full = state.members.length >= S.dormCap(state);
  const vis = state.visitors.map(v => {
    const host = S.hostileWith(state, v);
    const fee = S.recruitFee(state, v);
    const sk = SKILLS[v.skill];
    return `<div class="card visitor">${P(v.unit, 56)}
      <div class="v-info"><b>${esc(v.name)} <small>${esc(v.title)}</small></b>
      <div>${raceTag(v.race)}${roleTag(v.role)}<span class="tag">${TRAITS[v.trait].name}</span></div>
      <small>Lv${v.level} · 战力 ${S.memberPower(v)} · 技能「${sk.name}」· ${v.leaveDay - state.day <= 1 ? '今晚就走' : '还会停留 1 天'}</small>
      <small>心愿：${v.wish.text}</small>
      ${host ? `<small class="bad">与公会里的${RACES[host.race].name}有宿怨，要价 +50%</small>` : ''}</div>
      <button class="btn primary" data-act="recruit" data-id="${v.id}" ${full ? 'disabled' : ''}>${full ? '宿舍已满' : `招募 ${fee} 金`}</button></div>`;
  }).join('') || '<p class="muted">今晚酒馆里没有求职者。扩建大厅能吸引更多来访者。</p>';
  const altar = state.facilities.altar;
  const legends = LEGENDS.slice().sort((a, b) => a.altar - b.altar).map(l => {
    const have = state.summoned.includes(l.id);
    const c = S.summonCost(l);
    const lock = altar < l.altar;
    return `<div class="card legend ${have ? 'have' : ''} ${lock ? 'lock' : ''}">${P(l.unit, 48)}
      <div class="v-info"><b>${l.name} <small>${l.title}</small></b><div>${raceTag(l.race)}${roleTag(l.role)}<span class="tag legend">${'✦'.repeat(l.altar)}</span></div>
      <small>${esc(l.bio)}</small><small>宝具「${SKILLS[l.skill].name}」：${SKILLS[l.skill].desc}</small></div>
      <button class="btn ${lock || have ? '' : 'primary'}" data-act="summon" data-id="${l.id}" ${have || lock || full ? 'disabled' : ''}>${have ? '已在公会' : lock ? `需祭坛 Lv${l.altar}` : `召唤 ${c.gold} 金 · ${c.mats} 素材`}</button></div>`;
  }).join('');
  return `<div class="scroll">
    <h4>今晚的来访者 <small>来自各地的冒险者在酒馆里打听入会条件</small></h4><div class="grid">${vis}</div>
    <h4>英灵祭坛 <small>${altar ? `祭坛 Lv${altar}：可召唤 ${'✦'.repeat(altar)} 阶英灵` : '建造英灵祭坛后，可召唤历史与传说中的英雄'}</small></h4><div class="grid">${legends}</div></div>`;
}

function facilitiesPanel() {
  const cards = Object.entries(FACILITIES).map(([id, f]) => {
    const lvl = state.facilities[id];
    const c = S.buildCost(state, id);
    const needRank = c && S.rankIndex(state) < c.rank;
    return `<div class="card fac ${ui.facility === id ? 'sel' : ''}">
      <div class="f-head"><b>${f.name}</b><span class="lvl">${'■'.repeat(lvl)}${'□'.repeat(f.max - lvl)}</span></div>
      <small>${f.desc}</small>
      <div class="f-eff">${lvl ? `当前：${f.effect(lvl)}` : '尚未修建'}</div>
      ${c ? `<div class="f-eff next">下一级：${f.effect(lvl + 1)}</div>` : '<div class="f-eff next">已达最高等级</div>'}
      ${c ? `<button class="btn ${needRank ? '' : 'primary'}" data-act="build" data-id="${id}" ${needRank ? 'disabled' : ''}>${needRank ? `需要 ${RANKS[c.rank].id} 级公会` : `${lvl ? '升级' : '修建'} ${c.gold} 金${c.mats ? ` · ${c.mats} 素材` : ''}`}</button>` : ''}
    </div>`;
  }).join('');
  return `<div class="scroll"><div class="grid fac-grid">${cards}</div></div>`;
}

function guildPanel() {
  const rate = state.taxRate;
  const delta = Math.round((0.42 - rate) * 22);
  const ranking = S.guildRanking(state).map((g, i) => `<div class="rk ${g.me ? 'me' : ''}"><span>${i + 1}</span><b>${esc(g.name)}</b><small>${g.me ? '我们' : RACES[g.race].name}</small><span>${g.fame}</span></div>`).join('');
  const logs = state.log.slice(0, 40).map(l => `<div class="log ${l.tone}"><small>D${l.day}</small>${esc(l.text)}</div>`).join('');
  const races = [...new Set(state.members.map(m => m.race))];
  const hist = state.history.map(h => `<div class="log"><small>S${h.season}</small>声望 ${h.fame} · ${h.rank} 级${h.won ? ' · 大赛冠军' : ''}</div>`).join('');
  return `<div class="cols">
    <div class="col-l">
      <h4>公会抽成</h4>
      <div class="tax"><input type="range" min="10" max="70" step="5" value="${Math.round(rate * 100)}" data-act="tax"><b>${Math.round(rate * 100)}%</b></div>
      <p class="desc">每场委托报酬，公会拿走 ${Math.round(rate * 100)}%，其余由出征成员均分进个人积蓄。<br>每次出征后忠诚 <b class="${delta >= 0 ? 'good' : 'bad'}">${delta >= 0 ? '+' : ''}${delta}</b>（贪财者加倍，忠义者减半）。忠诚过低会被对手挖角。</p>
      <h4>多元度 ${races.length}/8</h4>
      <p class="desc">${races.map(raceTag).join('') || '—'}<br>种族越多，酒馆生意越好、来访者越多样，每天额外获得声望。但宿怨种族同处一室会起冲突。</p>
      <h4>累计</h4>
      <p class="desc">委托 ${state.stats.quests} · 胜利 ${state.stats.wins} · 讨伐首领 ${state.stats.bossKills} · 最多成员 ${state.stats.peakMembers}</p>
      ${hist ? `<h4>往季</h4>${hist}` : ''}
      <button class="btn danger small" data-act="reset">放弃存档，重新开始</button>
    </div>
    <div class="col-r">
      <h4>本季声望榜 <small>第 4 周举办公会大赛</small></h4><div class="ranking">${ranking}</div>
      <h4>公会日志</h4>${logs}
    </div></div>`;
}

// ---------- 面板交互 ----------
async function onPanelAction(e) {
  const el = e.target.closest('[data-act]');
  if (!el || busy) return;
  const id = el.dataset.id;
  switch (el.dataset.act) {
    case 'selQuest': ui.quest = id; renderPanel(); break;
    case 'selMember': ui.member = id; renderPanel(); break;
    case 'assign': act(S.toggleAssign(state, ui.quest, id)); break;
    case 'recruit': act(S.recruit(state, id), '新成员加入！') && hallFx('spawn', id); break;
    case 'summon': {
      const err = S.summon(state, id);
      if (act(err)) {
        const m = state.members[state.members.length - 1];
        modal(`<div class="summon-box">${P(m.unit, 120, 'big')}<h2>${esc(m.title)} · ${esc(m.name)}</h2><p>${esc(LEGENDS.find(l => l.id === id).bio)}</p><button class="btn primary" data-close>欢迎加入</button></div>`);
        hallFx('summon', m.id);
      }
      break;
    }
    case 'build': {
      const lvl = state.facilities[id];
      if (act(S.build(state, id), `${FACILITIES[id].name}${lvl ? '升级' : '落成'}！`)) hallRoomFx(id);
      break;
    }
    case 'forge': act(S.forge(state, id), '装备强化成功'); break;
    case 'dismiss': {
      const m = state.members.find(x => x.id === id);
      const ok = await ask(`<h3>将 ${esc(m.name)} 除名？</h3><p>与 TA 关系好的同伴会感到失落。</p>`, [{label: '取消', value: false}, {label: '确认除名', value: true, cls: 'danger'}]);
      closeModal();
      if (ok) act(S.dismiss(state, id));
      break;
    }
    case 'reset': {
      const ok = await ask('<h3>放弃当前存档？</h3><p>公会的一切将从头开始。</p>', [{label: '取消', value: false}, {label: '重新开始', value: true, cls: 'danger'}]);
      closeModal();
      if (ok) { localStorage.removeItem(SAVE_KEY); closePanel(); newGameFlow(); }
      break;
    }
  }
}

function onPanelInput(e) {
  const el = e.target;
  if (el.dataset.act === 'tax') {
    S.setTax(state, Number(el.value) / 100);
    save();
    el.nextElementSibling.textContent = el.value + '%';
    if (e.type === 'change') refresh();
  }
  if (el.dataset.act === 'watch' && e.type === 'change') {
    const q = state.quests.find(x => x.id === ui.quest);
    if (q) { q.watch = el.checked; save(); }
  }
}

// ---------- 大厅特效 ----------
function walkerPos(id) {
  const w = hall.walkers.get(id);
  return w ? {x: w.x, y: w.groundY} : null;
}

function hallFx(key, memberId) {
  setTimeout(() => {
    const p = walkerPos(memberId);
    if (p) hall.fx.play(key, p.x, key === 'heartBurst' ? p.y - 40 : p.y - 20);
  }, 60);
}

function hallRoomFx(id) {
  const r = hall.rooms(hall.LW)[id];
  hall.fx.play('levelUp', r.x + r.w / 2, r.y + r.h - 6);
  hall.fx.play('coinBurst', r.x + r.w / 2, r.y + r.h / 2);
}

// ---------- 一天的流程 ----------
async function endDay() {
  if (busy) return;
  const teams = state.quests.filter(q => q.team.length);
  const raid = state.quests.find(q => q.special === 'raid' && !q.team.length);
  if (raid) {
    const ok = await ask('<h3>黑暗公会今晚来袭！</h3><p>没有派人迎战，金库将被洗劫四分之一。仍要结束今天吗？</p>', [{label: '去布防', value: false, cls: 'primary'}, {label: '就这样吧', value: true}]);
    closeModal();
    if (!ok) return openPanel('quests', raid.id);
  }
  busy = true;
  closePanel();
  const list = S.prepareNight(state);
  const results = [];
  if (teams.length) await curtain(`夜幕降临 · ${teams.length} 支队伍出发`);
  for (const item of list) {
    const q = state.quests.find(x => x.id === item.questId);
    const b = createBattle(S.battleSetup(state, q, item.seed, !item.watch));
    const summary = item.watch ? await battle.play({b, title: q.title, region: q.region}) : runHeadless(b);
    results.push({questId: q.id, summary});
  }
  const before = {gold: state.gold, fame: state.fame, mats: state.mats};
  const report = S.resolveNight(state, results);
  winCache.clear();
  save();
  refresh();
  await nightReport(report, before);
  for (const id of report.levelUps) hallFx('levelUp', id);
  for (const [a, b] of report.bonds) { hallFx('heartBurst', a); hallFx('heartBurst', b); }
  for (const id of report.awakened) hallFx('summon', id);
  await runEvents();
  busy = false;
  refresh();
  if (state.quests.some(q => q.special === 'promote') && state.promoteHinted !== state.rank) {
    state.promoteHinted = state.rank;
    toast('评议会发来了晋级试炼！', 'good');
  }
}

function curtain(text) {
  return new Promise(resolve => {
    const c = $('#curtain');
    c.innerHTML = `<div>${text}</div>`;
    c.classList.add('show');
    setTimeout(() => { c.classList.remove('show'); setTimeout(resolve, 350); }, 1100);
  });
}

function nightReport(r, before) {
  const name = id => esc(state.members.find(m => m.id === id)?.name || '?');
  const lines = r.battles.map(b => `<div class="rp ${b.won ? 'good' : 'bad'}"><b>${b.won ? '凯旋' : '败退'}</b> ${esc(b.title)}
    ${b.undefended ? '<small>无人迎战，金库被洗劫</small>' : `<small>${b.team.map(esc).join('、')}${b.reward ? ` · 入库 ${b.reward.gold} 金 · 每人分得 ${b.reward.share}` : ''}</small>`}</div>`).join('');
  const dg = state.gold - before.gold, df = state.fame - before.fame, dm = state.mats - before.mats;
  const sign = n => (n >= 0 ? '+' : '') + n;
  const extra = [
    r.promoted ? `<div class="rp legend">公会晋升为 <b>${r.promoted} 级</b>！新的设施等级与更强的委托已解锁。</div>` : '',
    r.tournament ? `<div class="rp ${r.tournament === 'win' ? 'legend' : 'bad'}">${r.tournament === 'win' ? '公会大赛夺冠！全大陆都在传颂我们的名字。' : '公会大赛落败，下一季再来。'}</div>` : '',
    r.levelUps.length ? `<div class="rp">升级：${[...new Set(r.levelUps)].map(name).join('、')}</div>` : '',
    r.bonds.map(([a, b]) => `<div class="rp legend">${name(a)} 与 ${name(b)} 结为搭档 ★</div>`).join(''),
    r.awakened.map(id => `<div class="rp legend">${name(id)} 心愿达成，觉醒了！</div>`).join(''),
    `<div class="rp">酒馆营业收入 ${goldTxt(r.income)}${r.upkeep ? ` · 本周伙食与维护 -${r.upkeep}` : ''}</div>`,
  ].join('');
  return ask(`<h3 class="night">第 ${r.day} 夜 · 夜报</h3>
    <div class="delta"><span class="res gold">${sign(dg)}</span><span class="res fame">${sign(df)}</span><span class="res mats">${sign(dm)}</span></div>
    ${lines || '<div class="rp muted">今晚没有出征，大家在酒馆里休整。</div>'}${extra}`, [{label: `迎接第 ${state.day} 天`, value: true, cls: 'primary'}]).then(() => {
    closeModal();
    if (dg > 0) { const c = hall.center(); hall.fx.play('coinBurst', c.x, c.y); }
  });
}

async function runEvents() {
  while (state.events.length) {
    const ev = state.events[0];
    const a = state.members.find(m => m.id === ev.a);
    const b = state.members.find(m => m.id === ev.b);
    const faces = [a, b].filter(Boolean).map(m => P(m.unit, 64)).join('');
    const opt = await ask(`<h3>${esc(ev.title)}</h3><div class="ev-faces">${faces}</div><p>${esc(ev.text)}</p>`,
      ev.options.map(o => ({label: esc(o.label), value: o.id})));
    const res = S.resolveEvent(state, ev.id, opt);
    if (typeof res === 'string') { toast(res, 'bad'); continue; }
    closeModal();
    if (res?.text) toast(res.text);
    save();
    refresh();
  }
}

// ---------- 新局 ----------
function newGameFlow() {
  const box = modal(`<div class="intro">
    <h2>群英公会</h2>
    <p>王都边缘，一间破旧酒馆。你用最后的积蓄挂出了公会旗帜。<br>骑士、武士、亡灵、暗精灵、食人魔……甚至历史上的英雄，都可能推门而入。</p>
    <ul>
      <li><b>白天</b>：在委托板派遣成员、招募来访者、修建设施。</li>
      <li><b>夜晚</b>：队伍出征。勾选「亲自督战」可观看战斗，在首领蓄力时<b>打断</b>它。</li>
      <li><b>抽成</b>决定公会与成员之间的分账；种族宿怨、搭档羁绊和心愿会塑造每个人的故事。</li>
    </ul>
    <label>公会名称 <input id="guildName" maxlength="8" value="黎明之焰"></label>
    <button class="btn primary" id="startGame">挂出旗帜</button></div>`, {wide: true});
  box.querySelector('#startGame').onclick = () => {
    const name = box.querySelector('#guildName').value.trim() || '黎明之焰';
    state = S.newGame(Math.floor(Math.random() * 1e9), name);
    save();
    closeModal();
    refresh();
    setTimeout(() => openPanel('quests'), 300);
  };
}

// ---------- 启动 ----------
const hall = new HallView(kit, $('#hall'), {
  getState: () => state,
  onMember: id => !busy && openPanel('members', id),
  onRoom: id => !busy && (id === 'hall' ? openPanel('quests') : id === 'altar' && state.facilities.altar ? openPanel('recruit') : openPanel('facilities', id)),
});
const battle = new BattleView(kit, $('#battle'));

$('#nav').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]');
  if (b && !busy) (ui.tab === b.dataset.tab ? closePanel() : openPanel(b.dataset.tab));
});
$('#endDay').onclick = endDay;
$('#panel .x').onclick = closePanel;
$('#panel .p-body').addEventListener('click', onPanelAction);
$('#panel .p-body').addEventListener('input', onPanelInput);
$('#panel .p-body').addEventListener('change', onPanelInput);
$('#modal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });

document.fonts?.load('12px GuildPixel').then(() => { hall.bkey = null; }).catch(() => {});

state = load();
if (state && state.version === 1) refresh();
else newGameFlow();
