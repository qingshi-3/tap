import { ARCHETYPE_IDS } from '../core/archetypes';
import { newTutorialRun } from '../core/tutorial';
import { tutorialDone } from './tutorial';
import '../qb/css/title-actions.css';
import '../qb/css/map.css';
import '../qb/css/records.css';
import '../qb/css/mechanics-guide.css';
import { mountTitleAtmosphere } from '../qb/titleAtmosphere';
import { getVolumes, isMuted, setAudioPaused, setTitleMusic, sfx, unlockAudio } from '../qb/audio';
import { audioSettings } from '../qb/audioSettings';
import { h, stageState } from '../qb/dom';
import { ambient, FX } from '../qb/fx';
import { icon } from '../qb/icons';
import { hideTip, initTip } from '../qb/tip';
import { unitSvg } from '../qb/unitArt';
import { tierArt } from '../qb/card';
import { card, HERO, HEROES, SHOP_POOL, type HeroId } from '../core/data';
import { clearAll, DIFFS, load, lvlOf, maxLives, newRun, save, saveStatus, beginNewRunBackup, LAYERS, type Diff, type RunState } from '../core/run';
import { Game } from './prep';
import { codexScreen } from './codex';

// ── 本地战绩 ──
const REC_KEY = 'pdqs3_records';
interface RunRec { at: number; diff?: number; act?: number; layer?: number; won: boolean; wins: number; turn: number; lives: number; team: { def: string; lvl: number }[] }
interface Records { runs: number; clears: number; best: number; recent: RunRec[] }
function loadRecords(): Records {
  try {
    const r = JSON.parse(localStorage.getItem(REC_KEY) ?? 'null') as Records | null;
    if (r && Array.isArray(r.recent)) return r;
  } catch { /* ignore */ }
  return { runs: 0, clears: 0, best: 0, recent: [] };
}
/** 局外偏暖：前 3 局，或最近 3 局都早早出局（≤5 胜） */
function warmStart() {
  const rec = loadRecords();
  if (rec.runs < 3) return true;
  const last = rec.recent.slice(0, 3);
  return last.length === 3 && last.every((x) => !x.won && x.wins <= 5);
}
const DIFF_KEY = 'pdqs3_diff';
const lastDiff = (): Diff => { const d = Number(localStorage.getItem(DIFF_KEY)); return (d === 1 || d === 2 ? d : 0) as Diff; };
const freshRun = (diff: Diff, hero: HeroId, lite: boolean) => {
  try { localStorage.setItem(DIFF_KEY, String(diff)); } catch { /* ignore */ }
  return newRun(undefined, { warm: warmStart(), diff, hero, lite });
};
const ACT_CN = '一二三';
const reached = (r: { act?: number; layer?: number }) => r.act === undefined ? '' : `第${ACT_CN[r.act]}幕 ${Math.min((r.layer ?? 0) + 1, LAYERS + 1)}/${LAYERS + 1}`;
function recordRun(r: RunState) {
  const rec = loadRecords();
  rec.runs++;
  if (r.phase === 'won') rec.clears++;
  rec.best = Math.max(rec.best, r.wins);
  rec.recent.unshift({
    at: Date.now(), diff: r.diff, act: r.act, layer: r.layer, won: r.phase === 'won', wins: r.wins, turn: r.turn, lives: r.lives,
    team: r.queue.filter((o) => !!o).map((o) => ({ def: o!.def, lvl: lvlOf(o!.copies) })),
  });
  rec.recent = rec.recent.slice(0, 20);
  try { localStorage.setItem(REC_KEY, JSON.stringify(rec)); } catch { /* ignore */ }
}

export class App {
  stage: HTMLElement;
  world: HTMLElement;
  screenEl: HTMLElement;
  fx: FX;
  private game: Game | null = null;
  private ambientControl: ReturnType<typeof ambient>;
  private titleAtmosphere: ReturnType<typeof mountTitleAtmosphere> | null = null;

  private syncRendering = () => {
    const paused = document.hidden;
    setAudioPaused(paused);
    document.documentElement.toggleAttribute('data-render-paused', paused);
    this.ambientControl.setPaused(paused);
    this.fx.setPaused(paused);
  };

  constructor(stage: HTMLElement) {
    this.stage = stage;
    const bg = h('div', { class: 'bg' }, h('div', { class: 'bg-px' }), h('div', { class: 'bg-fog' }));
    const motes = h('canvas', { class: 'bg-motes' });
    this.screenEl = h('div', { class: 'screens' });
    this.world = h('div', { class: 'world' }, bg, motes, this.screenEl);
    stage.append(this.world, h('div', { class: 'vignette' }));
    this.fx = new FX(stage, this.world);
    initTip(stage);
    this.ambientControl = ambient(motes);
    document.addEventListener('visibilitychange', this.syncRendering);
    this.syncRendering();
    window.addEventListener('pointerdown', () => unlockAudio(), { capture: true });
    window.addEventListener('keydown', () => unlockAudio(), { capture: true });
  }

  resize() {
    this.fx.resize(stageState.scale);
  }

  private leaveGame(keepTitleMusic = false) {
    if (!keepTitleMusic) setTitleMusic(false);
    this.game?.dispose();
    this.game = null;
    this.fx.clear();
  }

  show(el: HTMLElement) {
    hideTip();
    this.titleAtmosphere?.dispose();
    this.titleAtmosphere = null;
    this.screenEl.replaceChildren(el);
    if (el.classList.contains('title')) this.titleAtmosphere = mountTitleAtmosphere(el);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
  }

  toTitle() {
    this.leaveGame(true);
    setTitleMusic(true);
    // 每个新流派挑一张最高阶的卡做门面
    const fallback = ARCHETYPE_IDS.map((archetype) => SHOP_POOL.filter((c) => c.archetype === archetype).sort((a, b) => b.tier - a.tier)[0]?.id).filter(Boolean) as string[];
    const foes = ['e_nightk', 'e_lich', 'e_void'].filter((id) => card(id));
    const saved = load();
    const status = saveStatus();
    const start = h('button', { class: `btn ${saved ? 'ghost' : 'primary'} big title-new` }, h('span', null, '新的游戏'), icon('play'));
    start.addEventListener('click', () => {
      sfx.start();
      if (saved) this.confirm('开始新的一局？', '当前进度会被放弃，计为一次失败。', '开始', () => { recordRun({ ...saved, phase: 'lost' }); this.pickDiff(); });
      else if (beginNewRunBackup()) this.pickDiff();
      else this.modal(h('div', { class: 'confirm' }, h('h3', null, '存档备份失败'), h('p', null, '本地存储空间不足，请释放空间后重试。')));
    });
    let cont: HTMLElement | null = null;
    if (saved) {
      const btn = h('button', { class: 'btn primary big title-continue' }, h('span', null, '继续游戏'), icon('play'));
      btn.addEventListener('click', () => { sfx.start(); this.startRun(saved); });
      cont = h('div', { class: 'cont-wrap' }, btn, h('div', { class: 'cont-note' }, `${reached(saved)} · `, h('span', { class: 'cont-health', 'aria-label': `${saved.lives} 点生命` }, String(saved.lives), h('span', { class: 'life on', 'aria-hidden': 'true' }))));
    }
    const codex = h('button', { class: 'icon-btn title-tool' }, icon('diamond'), h('span', null, '图鉴'));
    codex.addEventListener('click', () => { sfx.click(); this.toCodex(); });
    const records = h('button', { class: 'icon-btn title-tool' }, icon('flag'), h('span', null, '战绩'));
    records.addEventListener('click', () => { sfx.click(); this.toRecords(); });
    const tutorial = h('button', { class: tutorialDone() ? 'icon-btn title-tool title-tut-done' : 'btn primary title-tool title-tutorial' }, h('span', null, '新手教程'));
    tutorial.addEventListener('click', () => {
      this.leaveGame();
      this.game = new Game(this, newTutorialRun(), true);
      this.show(this.game.el);
      this.game.start();
    });
    const volume = h('button', { class: 'icon-btn title-volume', 'aria-label': '设置' }, icon(quiet() ? 'mute' : 'sound'));
    volume.addEventListener('click', () => { sfx.click(); this.settings(() => volume.replaceChildren(icon(quiet() ? 'mute' : 'sound'))); });
    const el = h(
      'div',
      { class: 'screen title' },
      h('div', { class: 'title-army left' }, fallback.map((id, i) => h('div', { class: 'ta-unit', style: `--i:${i}`, html: unitSvg(id) }))),
      h('div', { class: 'title-army right' }, foes.map((id, i) => h('div', { class: 'ta-unit boss', style: `--i:${i}`, html: unitSvg(id, { enemy: true }) }))),
      h('div', { class: 'title-center' }, h('div', { class: 'logo', style: 'font-size:100px' }, h('span', null, '排队骑士')), h('div', { class: 'logo-sub', style: 'font-size:24px;letter-spacing:0.4em;text-align:center' }, '三合一 · 酒馆试玩'),
        status === 'unsupported' || status === 'invalid' ? h('p', { class: 'save-status', role: 'status' }, status === 'unsupported' ? '旧版进度已保留。新版规则请开始新局。' : '该存档无法恢复。开始新局前会保留原件。') : null,
        h('div', { class: 'title-btns' }, cont, start)),
      h('div', { class: 'title-tools' }, tutorial, codex, records, volume),
    );
    this.show(el);
  }

  settings(onChange?: () => void, inRun = false) {
    const wipe = h('button', { class: 'btn danger' }, h('span', null, '清除全部数据'));
    wipe.addEventListener('click', () => {
      sfx.click();
      this.confirm('清除全部数据？', '存档和战绩都会删除，无法恢复。声音设置保留。', '清除', () => { clearAll(); location.reload(); });
    });
    this.modal(h('div', { class: 'confirm', 'aria-label': '设置' }, h('h3', null, '设置'), audioSettings(onChange),
      inRun ? null : h('div', { class: 'data-tools danger-zone' }, wipe)), 'audio-dialog', document.body);
  }

  toCodex() {
    this.leaveGame(true);
    setTitleMusic(true);
    this.show(codexScreen(() => this.toTitle()));
  }

  toRecords() {
    this.leaveGame(true);
    setTitleMusic(true);
    const rec = loadRecords();
    const back = h('button', { class: 'records-button records-back', type: 'button' }, icon('x'), '返回');
    back.addEventListener('click', () => { sfx.click(); this.toTitle(); });
    const rows = rec.recent.map((r) => h('article', { class: `records-achievement-row${r.won ? ' is-complete' : ''}` },
      h('div', { class: 'records-entry' },
        h('h2', { class: 'records-name' }, r.won ? icon('check') : null, r.won ? '通关' : '失败', r.diff ? ` · ${DIFFS[r.diff].name}` : '', ` · ${reached(r) || `${r.wins} 胜`} · 第 ${r.turn} 回合`),
        h('div', { class: 'rec-team' }, r.team.map((u) => h('span', { class: 'rec-u' }, tierArt('rec-art', u.def, card(u.def)?.tier ?? 1, 'span'), h('i', null, '★'.repeat(u.lvl)))))),
      h('div', { class: 'records-achievement-result' },
        h('b', { class: 'records-points' }, r.won ? `剩 ${r.lives} 心` : `${r.wins} 胜`),
        h('span', { class: 'records-progress-text' }, new Date(r.at).toLocaleDateString('zh-CN')))));
    this.show(h('section', { class: 'screen records', 'aria-label': '战绩' },
      h('header', { class: 'records-head' }, back),
      h('div', { class: 'records-controls' }, h('p', { class: 'records-summary' }, `通关 ${rec.clears} / ${rec.runs} 局　最多胜场 ${rec.best}`)),
      h('div', { class: 'records-list' }, rows.length ? rows : h('p', { class: 'records-empty' }, '还没有完成的对局'))));
  }

  /** 选难度后开新局；默认高亮上次的选择 */
  pickDiff() {
    const cur = lastDiff();
    const btns = DIFFS.map((d, i) => {
      const b = h('button', { class: `diff-opt d${i}${i === cur ? ' on' : ''}` },
        h('b', null, d.name), h('span', null, d.desc), h('i', null, Array.from({ length: d.lives }, () => icon('heart'))));
      b.addEventListener('click', () => { close(); sfx.click(); this.pickHero(i as Diff); });
      return b;
    });
    const close = this.modal(h('div', { class: 'confirm diff-pick' }, h('h3', null, '选择难度'), h('div', { class: 'diff-opts' }, btns)), 'diff-dialog');
  }

  /** 选英雄：6 抽 2；首局固定老兵队长，且不出商人 / 委托 */
  pickHero(diff: Diff) {
    const first = loadRecords().runs === 0;
    const pool = [...HEROES].sort(() => Math.random() - 0.5);
    const opts = first ? [HERO.vet] : pool.slice(0, 2);
    const btns = opts.map((hd) => {
      const b = h('button', { class: 'hero-opt' }, h('span', { class: 'ho-art', html: unitSvg(hd.art) }), h('b', null, hd.name),
        h('span', { class: 'ho-text' }, hd.text), hd.cost ? h('i', { class: 'ho-cost' }, `${hd.cost} 金 / 回合`) : h('i', { class: 'ho-cost' }, '被动'));
      b.addEventListener('click', () => { close(); sfx.start(); this.startRun(freshRun(diff, hd.id, first)); });
      return b;
    });
    const close = this.modal(h('div', { class: 'confirm hero-pick' }, h('h3', null, '选择英雄'), h('div', { class: 'hero-opts' }, btns)), 'diff-dialog');
  }

  startRun(r: RunState) {
    this.leaveGame();
    save(r);
    this.game = new Game(this, r);
    this.show(this.game.el);
    this.game.start();
  }

  /** 一局结束：记战绩、清存档、结算页 */
  endRun(r: RunState) {
    recordRun(r);
    save(null);
    this.leaveGame();
    const won = r.phase === 'won';
    if (won) sfx.win(); else sfx.lose();
    const again = h('button', { class: 'btn primary big' }, h('span', null, '再来一局'), icon('play'));
    again.addEventListener('click', () => { sfx.start(); this.pickDiff(); });
    const home = h('button', { class: 'btn ghost big' }, h('span', null, '返回标题'));
    home.addEventListener('click', () => { sfx.click(); this.toTitle(); });
    const team = r.queue.filter((o) => !!o);
    const el = h('div', { class: `screen end ${won ? 'victory' : 'defeat'}` },
      h('div', { class: 'end-rays' }),
      h('div', { class: 'end-title' }, won ? '通关' : '远征失败'),
      h('div', { class: 'end-sub' }, won ? '三幕全破，排队骑士凯旋' : `止步于${reached(r)}`),
      h('div', { class: 'end-stats' },
        h('div', null, h('b', null, r.wins), h('span', null, '胜场')),
        h('div', null, h('b', null, r.turn), h('span', null, '回合')),
        h('div', null, h('b', null, `${r.lives}/${maxLives(r)}`), h('span', null, '剩余生命'))),
      team.length ? h('div', { class: 'end-team-lbl' }, '最终阵容') : null,
      h('div', { class: 'end-team' }, team.map((o) => h('div', { class: 'end-unit' },
        tierArt('eu-art', o!.def, card(o!.def).tier), h('div', { class: 'eu-name' }, card(o!.def).name), h('div', { class: 'eu-lv' }, lvlOf(o!.copies) >= 2 ? '金色' : '')))),
      h('div', { class: 'end-btns' }, home, again));
    this.show(el);
    if (won) for (let i = 0; i < 4; i++) setTimeout(() => this.fx.burst(320 + i * 220, 200 + (i % 2) * 60, ['#ffd36b', '#7dffb0', '#8fd8ff', '#ff9ad6'][i], { n: 40, speed: 9 }), i * 220);
  }

  modal(content: HTMLElement, cls = '', mount: HTMLElement = this.stage) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let closing = false;
    const previousFocus = document.activeElement as HTMLElement | null;
    const close = () => {
      if (closing) return;
      closing = true;
      sfx.click();
      const remove = () => {
        m.remove();
        if (previousFocus?.isConnected) previousFocus.focus();
      };
      if (reduceMotion) remove();
      else m.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 }).onfinish = remove;
    };
    const x = h('button', { class: 'icon-btn modal-x', 'aria-label': '关闭' }, icon('x'));
    x.addEventListener('click', close);
    const hasCancel = cls === 'spell-picker' || cls === 'small';
    const m = h('div', { class: `modal-ov ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': content.querySelector('h3')?.textContent ?? '选择' }, h('div', { class: 'modal' }, hasCancel ? null : x, content));
    m.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const focusable = [...m.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    m.addEventListener('pointerdown', (e) => { if (e.target === m) close(); });
    mount.appendChild(m);
    (content.querySelector<HTMLElement>('button:not(:disabled)') ?? x).focus();
    if (!reduceMotion) m.querySelector('.modal')!.animate([{ transform: 'scale(.92)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,1.3,.4,1)' });
    return close;
  }

  confirm(title: string, text: string, okText: string, ok: () => void) {
    const yes = h('button', { class: 'btn danger' }, h('span', null, okText));
    const no = h('button', { class: 'btn ghost' }, h('span', null, '取消'));
    const close = this.modal(h('div', { class: 'confirm' }, h('h3', null, title), h('p', null, text), h('div', { class: 'confirm-btns' }, no, yes)), 'small');
    no.addEventListener('click', close);
    yes.addEventListener('click', () => { close(); ok(); });
  }
}

const quiet = () => isMuted() || getVolumes().master === 0;
