import { createBattle, startBattle, advance, heroOptions, heroAct, HERO_SKILLS, HEROES, CFG } from './engine.js';
import { CARDS, POOL, FACTION_NAME } from './cards.js';
import { ART } from './units.js';
import { makeTeam, makeEncounter, STAGES, mulberry, ENCOUNTERS, ENC_SCALE } from './teams.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- 状态 ----------------
const PRESETS = {
  '圣盾阵': [{ id: 'squire' }, { id: 'templar' }, { id: 'wall' }, { id: 'sunriser' }, { id: 'lion' }],
  '影刃阵': [{ id: 'stepper' }, { id: 'fanblade' }, { id: 'seeker' }, { id: 'fox' }, { id: 'stormkage' }],
  '深渊阵': [{ id: 'gloomchaser' }, { id: 'crawler' }, { id: 'bloodmoon' }, { id: 'shadowdancer' }, { id: 'daemongate' }],
  '深渊巨兽': [{ id: 'nightsorrow' }, { id: 'bloodmoon' }, { id: 'darkspine' }, { id: 'juggernaut' }],
  '霜境阵': [{ id: 'beetle' }, { id: 'drake' }, { id: 'voice' }, { id: 'snowchaser' }, { id: 'gravity' }],
  '霜境巨兽': [{ id: 'bonechill' }, { id: 'fenrir' }, { id: 'voice' }, { id: 'seismic' }],
  '混编': [{ id: 'sworn' }, { id: 'panda' }, { id: 'seeker' }, { id: 'maiden' }, { id: 'monk' }],
  '巨型': [{ id: 'ironcliffe' }, { id: 'templar' }, { id: 'sunriser' }, { id: 'lion' }],
};
const ui = {
  teams: [structuredClone(PRESETS['影刃阵']), structuredClone(PRESETS['圣盾阵'])],
  sel: null,           // 编队中选中的格子 {side, i}
  s: null,             // 当前战斗
  logIdx: 0,
  playing: false,
  auto: false,
  speed: 1,
  pick: null,          // 英雄选目标 {type, picks: []}
  regroupLeft: 2,      // 整局技：本页面会话内共 2 次
  hero: 'dispatcher',
  regroupOrder: null,
  seed: 1,
};
const rnd = mulberry(Date.now() & 0xffff);

// ---------------- 精灵 ----------------
const imgSize = {};
function loadSize(src) {
  if (imgSize[src]) return Promise.resolve(imgSize[src]);
  return new Promise((res) => { const im = new Image(); im.onload = () => res(imgSize[src] = [im.naturalWidth, im.naturalHeight]); im.src = src; });
}
function spriteEl(art, animate = true) {
  const a = ART[art];
  const el = document.createElement('div');
  el.className = 'sprite';
  el.style.backgroundImage = `url(${a.image})`;
  el.style.backgroundPosition = '0 0';
  if (animate) el._idle = el.animate(
    [{ backgroundPosition: '0 0' }, { backgroundPosition: `-${a.frames * a.w}px 0` }],
    { duration: a.ms, iterations: Infinity, easing: `steps(${a.frames})` });
  return el;
}
async function playAttack(el, art) {
  const a = ART[art];
  if (!a.attack || !el) return;
  const [w] = await loadSize(a.attack.image);
  const fw = Math.round(w / a.attack.frames);
  el._idle?.pause();
  const prev = el.style.cssText;
  el.style.backgroundImage = `url(${a.attack.image})`;
  el.style.width = fw + 'px';
  el.style.marginLeft = el.style.marginRight = `${(100 - fw) / 2}px`;
  const dur = Math.max(300, a.attack.frames * 60) / ui.speed;
  const an = el.animate([{ backgroundPosition: '0 0' }, { backgroundPosition: `-${w}px 0` }], { duration: dur, easing: `steps(${a.attack.frames})` });
  await an.finished.catch(() => {});
  el.style.cssText = prev;
  el._idle?.play();
}

// ---------------- 编队界面 ----------------
const slotsUsed = (team) => team.reduce((n, x) => n + (CARDS[x.id].size || 1), 0);

function renderSetup() {
  for (const side of [0, 1]) {
    const box = $('slots' + side);
    box.innerHTML = '';
    ui.teams[side].forEach((sp, i) => {
      const c = CARDS[sp.id];
      const el = document.createElement('div');
      el.className = 'slot' + (c.size > 1 ? ' size2' : '') + (ui.sel && ui.sel.side === side && ui.sel.i === i ? ' sel' : '');
      el.innerHTML = `<span class="no">${i + 1}</span><span class="lv l${sp.lvl || 1}">${sp.lvl || 1}级</span>`;
      const mini = document.createElement('div');
      mini.className = 'mini';
      const sp1 = spriteEl(c.art, false);
      sp1.style.transform = `translateX(-50%) scale(${side ? -0.5 : 0.5}, 0.5)`;
      mini.appendChild(sp1);
      el.appendChild(mini);
      el.insertAdjacentHTML('beforeend', `<div class="nm">${c.name}</div><div class="meta" style="font-size:11px;color:var(--dim)">${c.atk}/${c.hp}${c.size > 1 ? ' · 2格' : ''}</div>`);
      el.querySelector('.lv').onclick = (ev) => { ev.stopPropagation(); sp.lvl = ((sp.lvl || 1) % 3) + 1; renderSetup(); };
      el.onclick = () => {
        if (ui.sel && ui.sel.side === side && ui.sel.i !== i) {
          const t = ui.teams[side];
          [t[i], t[ui.sel.i]] = [t[ui.sel.i], t[i]];
          ui.sel = null;
        } else ui.sel = ui.sel && ui.sel.side === side && ui.sel.i === i ? null : { side, i };
        renderSetup();
      };
      el.oncontextmenu = (ev) => { ev.preventDefault(); ui.teams[side].splice(i, 1); ui.sel = null; renderSetup(); };
      box.appendChild(el);
    });
    const free = 5 - slotsUsed(ui.teams[side]);
    for (let k = 0; k < free; k++) box.insertAdjacentHTML('beforeend', '<div class="slot" style="cursor:default"></div>');
  }
}

function renderPresets() {
  for (const side of [0, 1]) {
    const box = $('presets' + side);
    box.innerHTML = '';
    for (const name of Object.keys(PRESETS)) {
      const b = document.createElement('button');
      b.textContent = name;
      b.onclick = () => { ui.teams[side] = structuredClone(PRESETS[name]); ui.sel = null; renderSetup(); };
      box.appendChild(b);
    }
    if (side === 1) for (const name of Object.keys(ENCOUNTERS)) {
      const b = document.createElement('button');
      b.textContent = '机制·' + name;
      b.className = 'enc';
      b.title = `第二幕强度：1～2 级，数值 ×${ENC_SCALE[name].mid}`;
      b.onclick = () => { ui.teams[1] = makeEncounter(name, STAGES[1], rnd); ui.sel = null; renderSetup(); };
      box.appendChild(b);
    }
    STAGES.forEach((st, k) => {
      const b = document.createElement('button');
      b.textContent = `随机·第${'一二三'[k]}幕`;
      b.onclick = () => { ui.teams[side] = makeTeam(st, rnd); ui.sel = null; renderSetup(); };
      box.appendChild(b);
    });
  }
}

function renderPool() {
  const box = $('pool');
  box.innerHTML = '';
  for (const c of POOL) {
    const el = document.createElement('div');
    el.className = 'pcard ' + c.faction;
    el.innerHTML = `<div class="row"><b>${c.name}</b><span class="meta">${FACTION_NAME[c.faction]} · ${c.tier}阶 · ${c.role}${c.size > 1 ? ' · 巨型2格' : ''}</span></div>
      <div class="row"><span><span style="color:var(--atk)">${c.atk}</span> / <span style="color:var(--hp)">${c.hp}</span>${c.armor ? ` · 护甲${c.armor}` : ''}</span><span class="meta">${{ front: '前排', mid: '中排', back: '后排' }[c.pos]}</span></div>
      <div class="txt">${c.text}</div><div class="l3">3级：${c.lv3}</div>${c.artNote ? `<div class="meta">${c.artNote}</div>` : ''}`;
    el.onclick = () => {
      const side = Number(document.querySelector('input[name=target]:checked').value);
      if (slotsUsed(ui.teams[side]) + (c.size || 1) > 5) return flashStatus('队伍已满（5 格）');
      if (c.size > 1 && ui.teams[side].some((x) => CARDS[x.id].size > 1)) return flashStatus('每队最多 1 个巨型');
      ui.teams[side].push({ id: c.id, lvl: 1 });
      renderSetup();
    };
    box.appendChild(el);
  }
}

function flashStatus(t) { $('status').textContent = t; }

// ---------------- 战斗界面 ----------------
const nameOf = (uid) => { const u = ui.s.units[uid]; return u ? CARDS[u.id].name + (u.lvl > 1 ? `(${u.lvl})` : '') : '?'; };
const sideOf = (uid) => ui.s.units[uid]?.side ?? 0;
const elOf = (uid) => document.querySelector(`.unit[data-uid="${uid}"]`);

function unitEl(u) {
  const c = CARDS[u.id];
  const el = document.createElement('div');
  el.className = 'unit' + (c.size > 1 ? ' size2' : '') + (c.boss ? ' boss' : '');
  el.dataset.uid = u.uid;
  el.innerHTML = `<div class="slotno"></div><div class="badges"></div>`;
  el.appendChild(spriteEl(c.art));
  el.insertAdjacentHTML('beforeend', `<div class="plate"><div class="uname">${c.name}</div><div class="stats"><span class="atk"></span><span class="hpv"></span></div><div class="hpbar"><i></i></div></div>`);
  el.onclick = () => onUnitClick(u.uid);
  return el;
}

function renderSnap(snap) {
  for (const side of [0, 1]) {
    const lane = $('lane' + side);
    const want = snap.lines[side];
    const keep = new Set(want.map((x) => String(x.uid)));
    for (const el of [...lane.children]) if (!keep.has(el.dataset.uid)) el.remove();
    let slot = 1;
    want.forEach((x, i) => {
      let el = lane.querySelector(`.unit[data-uid="${x.uid}"]`);
      if (!el) el = unitEl(x);
      if (lane.children[i] !== el) lane.insertBefore(el, lane.children[i] || null);
      const c = CARDS[x.id];
      el.querySelector('.slotno').textContent = x.size > 1 ? `${slot}-${slot + 1}号位` : `${slot}号位`;
      slot += x.size;
      el.classList.toggle('front', i === 0);
      el.querySelector('.atk').textContent = '⚔' + x.atk;
      el.querySelector('.hpv').textContent = '♥' + x.hp;
      el.querySelector('.hpbar i').style.width = Math.max(0, (100 * x.hp) / x.maxHp) + '%';
      const b = [];
      if (x.lvl > 1) b.push(`<span class="badge lv">${x.lvl}级</span>`);
      if (x.block) b.push(`<span class="badge">格挡${x.block}</span>`);
      if (x.shield) b.push(`<span class="badge sh">盾${x.shield}</span>`);
      if (x.armor) b.push(`<span class="badge ar">甲${x.armor}</span>`);
      if (c.intent) b.push(`<span class="badge it">${c.intent(x)}</span>`);
      else if (c.charge) b.push(`<span class="badge ch">充能${x.charge}/${c.charge({ lvl: x.lvl })}</span>`);
      if (x.combo) b.push(`<span class="badge cb">连击</span>`);
      if (x.stun) b.push(`<span class="badge">冰冻</span>`);
      else if (x.thaw) b.push(`<span class="badge">解冻</span>`);
      if (x.mark) b.push(`<span class="badge">猎物+3</span>`);
      if (x.obstacle) b.push(`<span class="badge ar">障碍</span>`);
      if (x.extra?.length) b.push(`<span class="badge it">吞:${x.extra.map((id) => CARDS[id].name).join('、')}</span>`);
      el.querySelector('.badges').innerHTML = b.join('');
    });
  }
}

function floatAt(uid, text, cls) {
  const el = elOf(uid);
  if (!el) return;
  const f = document.createElement('div');
  f.className = 'float ' + cls;
  f.textContent = text;
  el.appendChild(f);
  setTimeout(() => f.remove(), 900);
}
function pulse(uid, cls, ms = 260) {
  const el = elOf(uid);
  if (!el) return;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms / ui.speed);
}

const WHY = { swap: '换位', knockback: '击退', pull: '拉拽', rescue: '急援', insert: '插队', hunt: '围猎', regroup: '重整', scout: '侦察换位', rotate: '轮换' };
function fmt(e) {
  const n = nameOf, t = e.t;
  switch (t) {
    case 'start': return '— 开战 —';
    case 'round': return `— 第 ${e.round} 轮 —`;
    case 'attack': return e.label === 'clash' ? `${n(e.src)} 攻击 ${e.uids.map(n).join('、')}` : `${n(e.src)} ${{ combo: '连击', assist: '协同攻击', snipe: '狙击', ult: '双锋攻击' }[e.label] || '攻击'} ${n(e.uid)}`;
    case 'hit': return e.blockUsed ? `  ${n(e.uid)} 的格挡挡下了这一击` : null;
    case 'damage': return `  ${n(e.uid)} 受到 ${e.n} 点${e.kind === 'cast' ? '施法' : e.kind === 'fatigue' ? '疲劳' : ''}伤害${e.absorbed ? `（护盾吸收 ${e.absorbed}）` : ''}`;
    case 'absorb': return `  ${n(e.uid)} 的护盾吸收了 ${e.n} 点伤害`;
    case 'cast': return `${n(e.src)} 施法（${e.label}）→ ${n(e.uid)}`;
    case 'block': return `  ${n(e.uid)} 获得 ${e.n} 层格挡`;
    case 'shield': return `  ${n(e.uid)} 获得 ${e.n} 点护盾`;
    case 'heal': return `  ${n(e.uid)} 恢复 ${e.n} 点血量`;
    case 'buff': return `  ${n(e.uid)} ${e.atk ? `+${e.atk} 伤害` : ''}${e.hp ? ` +${e.hp} 血量` : ''}`;
    case 'move': return `${e.uids.map(n).join(' ↔ ')} ${WHY[e.why] || e.why}`;
    case 'enterFront': return `  ${n(e.uid)} 补位到 1 号位`;
    case 'death': return `  ${n(e.uid)} 阵亡`;
    case 'deathrattle': return `  ${n(e.uid)} 的亡语触发`;
    case 'order': return `  ${n(e.uid)} 受号令，触发【${{ start: '开战时', enterFront: '补位时', afterClash: '交锋后', death: '亡语', prep: '战备结束时' }[e.kind]}】`;
    case 'redeploy': return `  再部署：本场己方战备结束时、开战时效果各再触发一次`;
    case 'summon': return `  ${e.src ? n(e.src) + ' ' : ''}召唤 ${n(e.uid)}`;
    case 'summonFail': return `  召唤失败：队伍满格`;
    case 'anchored': return `  重力井：位移效果失效`;
    case 'devour': return `${n(e.src)} 吞噬 ${n(e.uid)}`;
    case 'revive': return `  ${n(e.uid)} 从坟场复活（1 血，队尾）`;
    case 'redirect': return `  ${n(e.uid)} 援护，替 ${n(e.from)} 承受`;
    case 'insert': return `${n(e.uid)} 插队，替 ${n(e.saved)} 挡下致命一击`;
    case 'shatter': return `  ${n(e.uid)} 的格挡被击碎`;
    case 'stagger': return `  ${n(e.uid)} 免疫位移，改为破甲 1`;
    case 'fatigue': return `疲劳：全体受到 ${e.n} 点伤害`;
    case 'energy': return e.why === 'passive' ? `${HEROES[ui.s.hero].name}被动：能量 +1` : null;
    case 'hero': return `【${HEROES[ui.s.hero].name}】${HERO_SKILLS[e.skill].name}${e.a ? '：' + n(e.a) : ''}${e.b ? ' ↔ ' + n(e.b) : ''}`;
    case 'stun': return `  ${n(e.uid)} 被冰冻，下一轮不能攻击`;
    case 'mark': return `  ${n(e.uid)} 被围猎：2 轮内受到的攻击伤害 +3`;
    case 'halt': return `  时停：下一轮敌方全体不攻击，蓄力不增长`;
    case 'stunned': return `  ${n(e.uid)} 冰冻中，本轮没有攻击`;
    case 'delay': return `  ${n(e.uid)} 的蓄力被推迟`;
    case 'void': return '攻击前已击杀队首，本轮常规攻击作废';
    case 'chaincap': return `连锁达到深度上限，${e.label} 被丢弃`;
    case 'end': return `— 战斗结束：${{ win: '胜利', lose: '失败', draw: '平局' }[e.result]} —`;
    default: return null;
  }
}
function pushLog(e) {
  const text = fmt(e);
  if (!text) return;
  const d = document.createElement('div');
  d.textContent = text;
  d.className = ['round', 'start', 'end'].includes(e.t) ? 'r' : e.t === 'hero' || (e.t === 'energy') ? 'h' : 's' + sideOf(e.src ?? e.uid ?? (e.uids && e.uids[0]));
  const box = $('log');
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}

const DUR = { order: 320, redeploy: 300, summon: 320, summonFail: 200, devour: 420, revive: 380, deathrattle: 220, stun: 220, mark: 260, halt: 400, stunned: 260, delay: 220, attack: 420, damage: 220, cast: 320, block: 140, shield: 140, heal: 180, buff: 140, move: 340, enterFront: 200, death: 300, redirect: 260, insert: 380, shatter: 200, stagger: 200, fatigue: 400, hero: 260, round: 260, start: 200, absorb: 140 };

async function play() {
  ui.playing = true;
  renderHero();
  const entries = ui.s.log.slice(ui.logIdx);
  ui.logIdx = ui.s.log.length;
  for (const e of entries) {
    const d = (DUR[e.t] || 0) / ui.speed;
    if (e.t === 'death') { const el = elOf(e.uid); if (el) { el.classList.add('dying'); await sleep(d); } }
    renderSnap(e.snap);
    pushLog(e);
    $('status').textContent = `第 ${e.round} 轮 · 能量 ${e.snap.energy}`;
    switch (e.t) {
      case 'attack': {
        const src = elOf(e.src);
        pulse(e.src, 'lunge', 300);
        playAttack(src?.querySelector('.sprite'), CARDS[ui.s.units[e.src].id].art);
        break;
      }
      case 'damage': pulse(e.uid, 'hit'); floatAt(e.uid, '-' + e.n, 'dmg'); break;
      case 'hit': if (e.blockUsed) floatAt(e.uid, '格挡', 'blk'); break;
      case 'absorb': floatAt(e.uid, '护盾 -' + e.n, 'sh'); break;
      case 'cast': pulse(e.src, 'hl-src', 300); break;
      case 'block': floatAt(e.uid, '+格挡', 'blk'); break;
      case 'shield': floatAt(e.uid, '+盾' + e.n, 'sh'); break;
      case 'heal': floatAt(e.uid, '+' + e.n, 'heal'); break;
      case 'buff': floatAt(e.uid, (e.atk ? `+${e.atk}⚔` : '') + (e.hp ? `+${e.hp}♥` : ''), 'buff'); break;
      case 'enterFront': floatAt(e.uid, '补位', 'tag'); break;
      case 'redirect': floatAt(e.uid, '援护', 'tag'); break;
      case 'insert': floatAt(e.uid, '插队', 'tag'); break;
      case 'stagger': floatAt(e.uid, '破甲', 'tag'); break;
      case 'stun': floatAt(e.uid, '冰冻', 'blk'); break;
      case 'mark': floatAt(e.uid, '围猎', 'blk'); break;
      case 'order': floatAt(e.uid, '号令', 'sh'); break;
      case 'summon': floatAt(e.uid, '召唤', 'sh'); break;
      case 'revive': floatAt(e.uid, '复活', 'sh'); break;
      case 'devour': floatAt(e.src, '吞噬', 'blk'); break;
      case 'stunned': floatAt(e.uid, '冻住了', 'blk'); break;
      case 'delay': floatAt(e.uid, '蓄力 −2', 'tag'); break;
      case 'end': showBanner(e.result); break;
    }
    if (d) await sleep(d);
  }
  ui.playing = false;
  renderHero();
  if (ui.auto && !ui.s.result) { await sleep(250 / ui.speed); if (ui.auto && !ui.playing) nextRound(); }
}

function showBanner(result) {
  const b = $('banner');
  b.className = 'banner ' + result;
  b.textContent = { win: '胜利', lose: '失败', draw: '平局' }[result];
}

// ---------------- 英雄 ----------------
function heroSkillsOf(hero) { return Object.entries(HERO_SKILLS).filter(([, v]) => v.hero === hero); }

function renderHero() {
  const s = ui.s;
  const box = $('hero');
  const inWindow = s && (s.phase === 'window' || s.phase === 'setup') && !ui.playing && !s.result;
  const opts = inWindow ? heroOptions(s) : [];
  const has = (t) => opts.some((o) => o.type === t);
  const H = HEROES[s?.hero || ui.hero];
  const pips = Array.from({ length: CFG.energyCap }, (_, i) => `<span class="pip ${i < (s?.energy || 0) ? 'on' : ''}"></span>`).join('');
  box.innerHTML = `<span class="hname" title="${H.passive}">${H.name}</span><span class="pips">${pips}</span>`;
  const pre = s && (s.phase === 'setup' || (s.phase === 'window' && s.round === 0));
  for (const [type, sk] of heroSkillsOf(s?.hero || ui.hero)) {
    if (!!sk.pre !== !!pre) continue;
    const b = document.createElement('button');
    b.className = 'skill' + (ui.pick?.type === type ? ' on' : '');
    const cost = sk.pre ? `剩余 ${ui.regroupLeft} 次` : sk.cost === 'ult' ? (s?.ultUsed ? '已用' : `奥义 · 充能 ${Math.min(s?.ultMeter || 0, CFG.ultCharge)}/${CFG.ultCharge}`) : `${sk.cost}能量`;
    b.innerHTML = `<span>${sk.name} · ${cost}</span><small>${sk.text.replace(/^(奥义|整局技)（[^）]*）：/, '')}</small>`;
    b.title = sk.text;
    b.disabled = type === 'regroup' ? !(inWindow && s.phase === 'window' && ui.regroupLeft > 0) : !has(type) || (sk.pre && ui.regroupLeft <= 0);
    b.onclick = () => onSkill(type);
    box.appendChild(b);
  }
  if (ui.pick?.type === 'regroup') {
    const ok = document.createElement('button');
    ok.className = 'primary';
    ok.textContent = '确认重整';
    ok.onclick = confirmRegroup;
    box.appendChild(ok);
  }
  const tip = document.createElement('span');
  tip.className = 'tip';
  tip.textContent = ui.pick ? pickTip() : inWindow ? (pre ? '开战前：可以用整局技，或直接点「下一轮」' : '交锋后窗口：可以使用技能，或点「下一轮」') : '';
  box.appendChild(tip);
  box.parentElement.classList.toggle('window-glow', inWindow && opts.length > 0);
  $('btnNext').disabled = !s || ui.playing || !!s.result;
  document.querySelectorAll('.unit').forEach((el) => el.classList.remove('pick', 'picked'));
  if (ui.pick) markPickable();
}

const PICK_TIP = {
  ally2adj: (p) => (p.picks.length ? '再点一名相邻友军' : '点第一名友军'),
  allyBack: () => '点一名后排友军',
  ally1: () => '点一名有蓄力技能的友军',
  enemy1: () => '点一名敌人',
  enemy2: (p) => (p.picks.length ? '再点一名敌人' : '点第一名敌人'),
  order: () => '点两名友军交换位置，满意后点「确认重整」',
};
function pickTip() { return PICK_TIP[HERO_SKILLS[ui.pick.type].pick]?.(ui.pick) || ''; }

// 当前技能、当前已选目标下，哪些单位可以点
function pickable() {
  const p = ui.pick, mode = HERO_SKILLS[p.type].pick;
  const ok = new Set();
  if (mode === 'order') { for (const id of ui.regroupOrder) ok.add(id); return ok; }
  for (const o of heroOptions(ui.s).filter((o) => o.type === p.type)) {
    if (o.b === undefined) ok.add(o.a);
    else if (!p.picks.length) { ok.add(o.a); ok.add(o.b); }
    else if (o.a === p.picks[0]) ok.add(o.b);
    else if (o.b === p.picks[0]) ok.add(o.a);
  }
  return ok;
}
function markPickable() {
  for (const id of pickable()) elOf(id)?.classList.add('pick');
  for (const id of ui.pick.picks) elOf(id)?.classList.add('picked');
}

function doAct(act) {
  if (!heroAct(ui.s, act)) return false;
  if (HERO_SKILLS[act.type].pre) ui.regroupLeft--;
  ui.pick = null;
  play();
  return true;
}

function onSkill(type) {
  if (ui.pick?.type === type) { ui.pick = null; if (type === 'regroup') renderSnapFromState(); renderHero(); return; }
  const mode = HERO_SKILLS[type].pick;
  if (mode === 'none') { const o = heroOptions(ui.s).find((o) => o.type === type); if (o) doAct(o); return; }
  ui.pick = { type, picks: [] };
  if (mode === 'order') ui.regroupOrder = [...ui.s.lines[0]];
  renderHero();
}

function renderSnapFromState() { renderSnap(ui.s.log[ui.s.log.length - 1].snap); }

function onUnitClick(uid) {
  inspect(uid);
  const p = ui.pick;
  if (!p || ui.playing) return;
  const mode = HERO_SKILLS[p.type].pick;
  if (mode === 'order') {
    if (!ui.regroupOrder.includes(uid)) return;
    p.picks.push(uid);
    if (p.picks.length === 2) {
      const o = ui.regroupOrder;
      const i = o.indexOf(p.picks[0]), j = o.indexOf(p.picks[1]);
      [o[i], o[j]] = [o[j], o[i]];
      p.picks = [];
      const snap = structuredClone(ui.s.log[ui.s.log.length - 1].snap);
      const byId = Object.fromEntries(snap.lines[0].map((x) => [x.uid, x]));
      snap.lines[0] = o.map((id) => byId[id]);
      renderSnap(snap);
    }
    renderHero();
    return;
  }
  if (!pickable().has(uid)) { if (p.picks.length) { p.picks = []; renderHero(); } return; }
  const opts = heroOptions(ui.s).filter((o) => o.type === p.type);
  const single = opts.find((o) => o.b === undefined && o.a === uid);
  if (single) { doAct(single); return; }
  if (!p.picks.length) { p.picks.push(uid); renderHero(); return; }
  const a = p.picks[0];
  const pair = opts.find((o) => (o.a === a && o.b === uid) || (o.b === a && o.a === uid));
  if (pair) doAct(pair);
}

function confirmRegroup() {
  const changed = ui.regroupOrder.some((id, i) => id !== ui.s.lines[0][i]);
  if (changed) doAct({ type: 'regroup', order: ui.regroupOrder });
  else { ui.pick = null; play(); }
}

function inspect(uid) {
  const u = ui.s.units[uid];
  const c = CARDS[u.id];
  $('inspect').innerHTML = `<b>${c.name}</b> ${u.lvl}级 · ${FACTION_NAME[c.faction]} · ${c.tier}阶 · ${c.role}${c.size > 1 ? ' · 巨型 2 格' : ''}${u.scale && u.scale !== 1 ? (u.atkScale !== u.scale ? ` · 遭遇数值 血量 ×${u.scale} 伤害 ×${u.atkScale}` : ` · 遭遇数值 ×${u.scale}`) : ''}<br>
    ⚔ ${u.atk}　♥ ${u.hp}/${u.maxHp}${u.armor ? `　护甲 ${u.armor}` : ''}${u.block ? `　格挡 ${u.block}` : ''}${u.shield ? `　护盾 ${u.shield}` : ''}<br>
    ${c.text}<br>${c.answer ? `<span style="color:var(--good)">解法：${c.answer}</span>` : `<span style="color:var(--accent)">3级：${c.lv3}</span>`}${c.artNote ? `<br><span style="color:var(--dim)">${c.artNote}</span>` : ''}`;
}

// ---------------- 流程 ----------------
function startFight() {
  if (!ui.teams[0].length || !ui.teams[1].length) return flashStatus('双方都至少需要 1 个单位');
  ui.hero = document.querySelector('input[name=hero]:checked').value;
  const mode = { std: [1, 2], old: [0, 1], rich: [2, 3] }[$('energyMode').value];
  [CFG.energyStart, CFG.energyPerRound] = mode;
  ui.s = createBattle(ui.teams[0], ui.teams[1], ui.seed++, { regroup: ui.regroupLeft, hero: ui.hero });
  ui.logIdx = 0;
  ui.pick = null;
  ui.auto = false;
  $('btnAuto').classList.remove('on');
  $('lane0').innerHTML = $('lane1').innerHTML = $('log').innerHTML = '';
  $('banner').className = 'banner hidden';
  $('inspect').textContent = '点单位查看技能';
  $('setup').classList.add('hidden');
  $('battle').classList.remove('hidden');
  play(); // 停在布阵阶段：可以先用整局技，点「下一轮」开战
}

// 开战：战备结束时 → 开战时 → 第一轮连在一起播放
function beginBattle() {
  startBattle(ui.s);
  // 有第 0 轮可用的整局技（重整）时停在窗口，否则直接打第一轮
  if (!ui.s.result && !(heroOptions(ui.s).length && ui.regroupLeft > 0)) advance(ui.s);
}

function nextRound() {
  if (!ui.s || ui.playing || ui.s.result) return;
  if (ui.pick?.type === 'regroup') renderSnapFromState();
  ui.pick = null;
  if (ui.s.phase === 'setup') beginBattle();
  else advance(ui.s);
  play();
}

$('btnStart').onclick = startFight;
$('btnNext').onclick = nextRound;
$('btnAuto').onclick = () => { ui.auto = !ui.auto; $('btnAuto').classList.toggle('on', ui.auto); if (ui.auto) nextRound(); };
$('btnSpeed').onclick = () => { ui.speed = ui.speed === 1 ? 2 : ui.speed === 2 ? 4 : 1; $('btnSpeed').textContent = ui.speed + '×'; };
$('btnBack').onclick = () => { ui.auto = false; $('battle').classList.add('hidden'); $('setup').classList.remove('hidden'); renderSetup(); flashStatus(''); };
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !$('battle').classList.contains('hidden')) { e.preventDefault(); nextRound(); } });

function fit() {
  const a = $('arena');
  if (a.clientWidth) a.style.setProperty('--fit', Math.min(1, (a.clientWidth - 16) / 1160).toFixed(3));
}
window.addEventListener('resize', fit);
new ResizeObserver(fit).observe($('arena'));

renderPresets();
renderPool();
renderSetup();
window.__ui = ui;
