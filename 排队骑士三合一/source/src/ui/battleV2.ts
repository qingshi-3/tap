// v2 战斗试玩（逻辑替换第 2 步）：分步战斗 + 英雄窗口。
// 规则走 core/v2 引擎；表现复用实战的 Board / BattlePlayer / FX / 场景，v2 日志经 core/v2bridge 转成旧事件流播放。
// 入口：地址栏 ?engine=v2（见 main.ts）。一局流程（商店、地图、升级）在第 4 步接入，这里先用预设阵容。
import { sfx } from '../qb/audio';
import { Board } from '../qb/board';
import { mountScene, type SceneHandle, type SceneId } from '../qb/battleScenes';
import { h } from '../qb/dom';
import type { FX } from '../qb/fx';
import { hideTip } from '../qb/tip';
import { BattlePlayer } from './battle';
import { initialOf, LogConverter, registerV2Cards, v2Card } from '../core/v2bridge';
import {
  BRANCHES, CFG, CARDS, ENCOUNTERS, ENC_SCALE, HERO_SKILLS, HEROES, STAGES,
  advance, createBattle, heroAct, heroOptions, makeEncounter, makeTeam, mulberry, startBattle,
  type BattleState, type HeroAction, type HeroId, type UnitSpec,
} from '../core/v2';
import './battleV2.css';

const PRESETS: Record<string, UnitSpec[]> = {
  圣盾阵: [{ id: 'squire' }, { id: 'templar' }, { id: 'wall' }, { id: 'sunriser' }, { id: 'lion' }],
  影刃阵: [{ id: 'stepper' }, { id: 'fanblade' }, { id: 'seeker' }, { id: 'fox' }, { id: 'stormkage' }],
  深渊阵: [{ id: 'gloomchaser' }, { id: 'crawler' }, { id: 'bloodmoon' }, { id: 'shadowdancer' }, { id: 'daemongate' }],
  霜境阵: [{ id: 'beetle' }, { id: 'drake' }, { id: 'voice' }, { id: 'snowchaser' }, { id: 'gravity' }],
  巨型: [{ id: 'ironcliffe' }, { id: 'templar' }, { id: 'sunriser' }, { id: 'lion' }],
};
const SCENE: Record<string, SceneId> = { early: 'moor', mid: 'crypt', late: 'abyss' };

interface Pick { type: string; picks: number[] }

/** 编队 → 战斗 → 结算，返回整个屏幕；onBack 回标题 */
export function v2BattleScreen(fx: FX, onBack: () => void): { el: HTMLElement; dispose: () => void } {
  registerV2Cards();
  const root = h('div', { class: 'screen v2-root' });
  let current: { dispose: () => void } | null = null;
  const rnd = mulberry(Date.now() & 0xffff);
  const setup = {
    stage: 1, // 第二幕
    mine: PRESETS['圣盾阵'] as UnitSpec[], mineName: '圣盾阵',
    foe: makeEncounter('炮台阵', STAGES[1], rnd), foeName: '机制·炮台阵',
    hero: 'pusher' as HeroId, branches: [] as string[],
  };

  const showSetup = () => {
    current?.dispose();
    current = null;
    const teamRow = (title: string, list: UnitSpec[]) => h('div', { class: 'v2-team' }, h('b', null, title),
      ...list.map((u) => { const d = CARDS[u.id]; return h('span', { class: `v2-chip f-${d.faction}` }, d.name, (u.lvl ?? 1) > 1 ? h('i', null, `${u.lvl}级`) : null); }));
    const btns = (items: Array<[string, () => void, boolean]>) => h('div', { class: 'v2-btns' },
      ...items.map(([label, fn, on]) => { const b = h('button', { class: `btn ${on ? 'primary' : 'ghost'}`, type: 'button' }, label); b.addEventListener('click', () => { sfx.click(); fn(); showSetup(); }); return b; }));
    const st = STAGES[setup.stage];
    const heroBtns = btns((Object.keys(HEROES) as HeroId[]).map((k) => [HEROES[k].name, () => { setup.hero = k; setup.branches = []; }, setup.hero === k]));
    const branchBtns = btns(Object.entries(BRANCHES).filter(([, b]) => b.hero === setup.hero).map(([k, b]) => [
      `${b.name}（${HERO_SKILLS[b.skill].name}）`,
      () => { const i = setup.branches.indexOf(k); if (i >= 0) setup.branches.splice(i, 1); else if (setup.branches.length < 2) setup.branches.push(k); },
      setup.branches.includes(k),
    ]));
    const start = h('button', { class: 'btn primary v2-start', type: 'button' }, '开战');
    start.addEventListener('click', () => { sfx.click(); showBattle(); });
    const back = h('button', { class: 'btn ghost', type: 'button' }, '返回标题');
    back.addEventListener('click', () => { sfx.click(); onBack(); });
    const panel = h('div', { class: 'v2-setup' },
      h('h1', null, 'v2 战斗试玩'),
      h('p', { class: 'v2-hint' }, '新规则引擎 + 英雄窗口。阵容先用预设；商店、地图、升级在后续步骤接入。'),
      h('div', { class: 'v2-sec' }, h('h2', null, '阶段'), btns(STAGES.map((s, i) => [s.name.slice(0, 3), () => { setup.stage = i; }, setup.stage === i]))),
      h('div', { class: 'v2-sec' }, h('h2', null, '我方'), btns([
        ...Object.keys(PRESETS).map((k): [string, () => void, boolean] => [k, () => { setup.mine = PRESETS[k]; setup.mineName = k; }, setup.mineName === k]),
        [`随机·${st.name.slice(0, 3)}`, () => { setup.mine = makeTeam(st, rnd); setup.mineName = '随机'; }, setup.mineName === '随机'],
      ]), teamRow('', setup.mine)),
      h('div', { class: 'v2-sec' }, h('h2', null, '敌方'), btns([
        ...Object.keys(ENCOUNTERS).map((k): [string, () => void, boolean] => [`机制·${k}`, () => { setup.foe = makeEncounter(k, st, rnd); setup.foeName = `机制·${k}`; }, setup.foeName === `机制·${k}`]),
        [`随机·${st.name.slice(0, 3)}`, () => { setup.foe = makeTeam(st, rnd); setup.foeName = '随机'; }, setup.foeName === '随机'],
      ]), teamRow('', setup.foe),
      setup.foeName.startsWith('机制·') ? h('p', { class: 'v2-hint' }, `遭遇数值：${JSON.stringify(ENC_SCALE[setup.foeName.slice(3)]?.[st.key] ?? 1)}（随"阶段"切换后重新点一次遭遇生效）`) : null),
      h('div', { class: 'v2-sec' }, h('h2', null, '英雄'), heroBtns, h('p', { class: 'v2-hint' }, HEROES[setup.hero].passive)),
      h('div', { class: 'v2-sec' }, h('h2', null, '分支（最多 2 个）'), branchBtns),
      h('div', { class: 'v2-btns v2-foot' }, back, start));
    root.replaceChildren(panel);
  };

  const showBattle = () => {
    const b = battle(fx, setup, () => showSetup(), onBack);
    current = b;
    root.replaceChildren(b.el);
  };

  showSetup();
  return { el: root, dispose: () => current?.dispose() };
}

function battle(fx: FX, setup: { stage: number; mine: UnitSpec[]; foe: UnitSpec[]; hero: HeroId; branches: string[] }, onSetup: () => void, onBack: () => void) {
  const board = new Board();
  const bar = h('div', { class: 'battle-bar on' });
  const panel = h('div', { class: 'v2-hero' });
  const toast = h('div', { class: 'v2-toast' });
  const el = h('div', { class: 'screen game in-battle v2-battle' }, board.el, bar, panel, toast);
  let scene: SceneHandle | null = mountScene(el, SCENE[STAGES[setup.stage].key]);
  const player = new BattlePlayer(board, fx, bar);
  const s: BattleState = createBattle(setup.mine, setup.foe, (Date.now() & 0x7fffffff) || 1, { hero: setup.hero, branches: setup.branches.join('+'), regroup: 2 });
  const conv = new LogConverter(s.log[0].snap);
  if (location.search.includes('debug')) (globalThis as unknown as { __v2: unknown }).__v2 = { s, conv, player };
  let logIdx = 1;
  let busy = true, auto = false, disposed = false;
  let pick: Pick | null = null;

  const showToast = (text: string) => {
    toast.textContent = text;
    toast.classList.remove('on');
    void toast.offsetWidth;
    toast.classList.add('on');
  };

  const flush = async () => {
    const entries = s.log.slice(logIdx);
    logIdx = s.log.length;
    for (const e of entries) if (e.t === 'hero') showToast(`【${HEROES[s.hero].name}】${HERO_SKILLS[e.skill as string].name}`);
    const evs = conv.convert(entries);
    if (evs.length) await player.playEvents(evs);
    const { init, initOrder } = initialOf(s.log[s.log.length - 1].snap);
    await player.reconcile(init, initOrder);
    paintIntents();
  };

  // 机制敌人头顶的意图（如"2/3 → 1号位 8"）
  const paintIntents = () => {
    for (const ln of s.log[s.log.length - 1].snap.lines) for (const u of ln) {
      const view = player.unitEl(u.uid);
      if (!view) continue;
      const d = v2Card(u.id);
      let tag = view.querySelector<HTMLElement>('.v2-intent');
      const text = d?.intent?.(u) ?? '';
      if (!text) { tag?.remove(); continue; }
      if (!tag) { tag = h('div', { class: 'v2-intent' }); view.append(tag); }
      tag.textContent = text;
    }
  };

  const clearTargets = () => {
    el.classList.remove('targeting-mode');
    el.querySelectorAll('.unit.target-valid, .unit.target-invalid').forEach((x) => x.classList.remove('target-valid', 'target-invalid'));
  };

  const pickable = (p: Pick): Set<number> => {
    const ok = new Set<number>();
    for (const o of heroOptions(s).filter((x) => x.type === p.type)) {
      if (o.b === undefined) { if (o.a !== undefined) ok.add(o.a); }
      else if (!p.picks.length) { ok.add(o.a!); ok.add(o.b); }
      else if (o.a === p.picks[0]) ok.add(o.b);
      else if (o.b === p.picks[0]) ok.add(o.a!);
    }
    return ok;
  };

  const markTargets = () => {
    clearTargets();
    if (!pick) return;
    el.classList.add('targeting-mode');
    const ok = pickable(pick);
    for (const ln of s.lines) for (const uid of ln) player.unitEl(uid)?.classList.add(ok.has(uid) ? 'target-valid' : 'target-invalid');
  };

  const act = async (a: HeroAction) => {
    pick = null;
    clearTargets();
    if (!heroAct(s, a)) return;
    sfx.click();
    busy = true;
    render();
    await flush();
    busy = false;
    render();
    if (s.result) finish();
  };

  player.unitClick = (uid) => {
    if (!pick || busy) return false;
    if (!pickable(pick).has(uid)) { pick = null; markTargets(); render(); return true; }
    const opts = heroOptions(s).filter((o) => o.type === pick!.type);
    const single = opts.find((o) => o.b === undefined && o.a === uid);
    if (single) { void act(single); return true; }
    if (!pick.picks.length) { pick.picks.push(uid); markTargets(); return true; }
    const a = pick.picks[0];
    const pair = opts.find((o) => (o.a === a && o.b === uid) || (o.b === a && o.a === uid));
    if (pair) void act(pair);
    return true;
  };

  const onSkill = (type: string) => {
    if (busy) return;
    if (pick?.type === type) { pick = null; markTargets(); render(); return; }
    const sk = HERO_SKILLS[type];
    const opts = heroOptions(s).filter((o) => o.type === type);
    if (!opts.length) return;
    if (sk.pick === 'none') { void act(opts[0]); return; }
    sfx.click();
    pick = { type, picks: [] };
    markTargets();
    render();
  };

  const next = async () => {
    if (busy || s.result) return;
    pick = null;
    clearTargets();
    busy = true;
    render();
    if (s.phase === 'setup') {
      startBattle(s);
      await flush();
      if (!s.result) advance(s);
    } else advance(s);
    await flush();
    busy = false;
    render();
    if (s.result) return finish();
    if (auto) void next();
  };

  const render = () => {
    const H = HEROES[s.hero];
    const pre = s.phase === 'setup';
    const inWindow = !busy && !s.result && (s.phase === 'window' || pre);
    const opts = inWindow ? heroOptions(s) : [];
    const pips = h('span', { class: 'v2-pips' }, ...Array.from({ length: CFG.energyCap }, (_, i) => h('i', { class: i < s.energy ? 'on' : '' })));
    const ult = s.ultUsed ? '已用' : `${Math.min(s.ultMeter, CFG.ultCharge)}/${CFG.ultCharge}`;
    const skills = Object.entries(HERO_SKILLS).filter(([, sk]) => sk.hero === s.hero && !!sk.pre === pre).map(([type, sk]) => {
      const br = s.branches.map((k) => BRANCHES[k]).find((x) => x.skill === type);
      const cost = sk.pre ? `整局技 · 剩 ${s.regroup}` : sk.cost === 'ult' ? `奥义 · ${ult}` : `${sk.cost} 能量`;
      const b = h('button', { class: `v2-skill${pick?.type === type ? ' on' : ''}${br ? ' branched' : ''}`, type: 'button', title: sk.text + (br ? `\n分支【${br.name}】：${br.text}` : ''), disabled: !opts.some((o) => o.type === type) },
        h('b', null, sk.name, br ? ' ◆' : ''), h('small', null, cost));
      b.addEventListener('click', () => onSkill(type));
      return b;
    });
    const nextBtn = h('button', { class: 'btn primary v2-next', type: 'button', disabled: busy || !!s.result }, pre ? '开战' : '下一轮');
    nextBtn.addEventListener('click', () => { sfx.click(); void next(); });
    const autoBtn = h('button', { class: `btn ghost${auto ? ' on' : ''}`, type: 'button', disabled: !!s.result }, auto ? '自动中' : '自动');
    autoBtn.addEventListener('click', () => { sfx.click(); auto = !auto; render(); if (auto && !busy) void next(); });
    const tip = pick ? `选择目标：${HERO_SKILLS[pick.type].name}（再点一次技能取消）`
      : busy ? '结算中…' : s.result ? '' : pre ? '开战前：可以用整局技，或直接开战' : `第 ${s.round} 轮交锋后：可以用技能，或进入下一轮`;
    panel.replaceChildren(
      h('div', { class: 'v2-hero-head' }, h('b', { title: H.passive }, H.name), pips, h('span', { class: 'v2-ult' }, `奥义 ${ult}`)),
      h('div', { class: 'v2-skills' }, ...skills),
      h('div', { class: 'v2-hero-foot' }, h('span', { class: 'v2-tip' }, tip), autoBtn, nextBtn));
    player.setPhase(s.result ? (s.result === 'win' ? '胜利' : s.result === 'lose' ? '失败' : '平局') : pre ? '布阵' : `第 ${s.round} 轮`);
  };

  const finish = () => {
    auto = false;
    player.finish(s.result!);
    render();
    const again = h('button', { class: 'btn primary', type: 'button' }, '再打一次');
    again.addEventListener('click', () => { sfx.click(); onSetup(); });
    const back = h('button', { class: 'btn ghost', type: 'button' }, '返回标题');
    back.addEventListener('click', () => { sfx.click(); onBack(); });
    el.append(h('div', { class: `v2-result ${s.result}` },
      h('h2', null, s.result === 'win' ? '胜利' : s.result === 'lose' ? '失败' : '平局'),
      h('p', null, `${s.round} 轮 · 英雄操作 ${s.stats.heroActions} 次`),
      h('div', { class: 'v2-btns' }, back, again)));
  };

  void (async () => {
    const { init, initOrder } = initialOf(s.log[0].snap);
    await player.begin(init, initOrder);
    if (disposed) return;
    busy = false;
    render();
    paintIntents();
  })();
  render();

  return {
    el,
    dispose: () => {
      disposed = true;
      auto = false;
      player.stop();
      hideTip();
      scene?.dispose();
      scene = null;
    },
  };
}
