import '../title-actions.css';
import { mountTitleAtmosphere } from './titleAtmosphere';
import { unitLevel } from '../core/types';
import { fatigueStartForChapter } from '../core/engine';
import { FACTION_INFO, unitDef } from '../core/data';
import { generalDefinition } from '../core/content';
import { chapter, TOTAL_BATTLES } from '../core/route';
import { battleNo, currentNode, generalChoices, newRun, randomSeed, screen, type RunState } from '../core/run';
import { clearAllData, clearRun, loadRun, saveRun } from '../core/save';

/** 玩家反馈 QQ 群号 */
const QQ_GROUP = 'QQ_GROUP_TBD';
import { resetHints } from './hints';
import { recordRunOutcome, stageRunReplacement } from '../core/career';
import { recordsScreen } from './records';
import { openCareerLeaderboard, syncCareerLeaderboards } from './leaderboard';
import { getVolumes, isMuted, setAudioPaused, setTitleMusic, sfx, unlockAudio } from './audio';
import { audioSettings } from './audioSettings';
import { h, stageState } from './dom';
import { ambient, FX } from './fx';
import { Game } from './game';
import { newTutorialRun, tutorialDone } from './tutorial';
import { codexScreen, keywordDoc } from './codex';
import { kwTag, MECH } from './kwtext';
import { BATTLE_RULES } from '../core/battleRules';
import '../mechanics-guide.css';
import { icon } from './icons';
import { hideTip, initTip } from './tip';
import { pedestalUrl } from './pixel';
import { TapTapRewardedAds, type RewardedAds, type RewardedPlacement, type RewardedResult } from './rewarded';
import { unitPxUrl, unitSvg } from './unitArt';
import { tierArt } from './card';

/** 说明正文里加粗的词条名换成统一写法：图标类出图标 + 名字，其余出「」短词 */
function htLine(l: string): HTMLElement {
  const p = h('p', { html: l });
  for (const b of Array.from(p.querySelectorAll('b'))) {
    const k = b.textContent ?? '';
    if (MECH[k]) b.replaceWith(kwTag(k, '', '', !!MECH[k].px));
  }
  return p;
}

export class App {
  stage: HTMLElement;
  world: HTMLElement;
  screenEl: HTMLElement;
  fx: FX;
  private game: Game | null = null;
  private ambientControl: ReturnType<typeof ambient>;
  private titleAtmosphere: ReturnType<typeof mountTitleAtmosphere> | null = null;
  private adDepth = 0;

  private syncRendering = () => {
    const paused = document.hidden || this.adDepth > 0;
    setAudioPaused(paused);
    document.documentElement.toggleAttribute('data-render-paused', paused);
    this.ambientControl.setPaused(paused);
    this.fx.setPaused(paused);
    this.game?.setPaused(paused);
  };
  private rewardedAds: RewardedAds;
  private rewardNoticeEl: HTMLElement | null = null;
  private rewardNoticeTimer = 0;

  constructor(stage: HTMLElement, rewardedAds?: RewardedAds) {
    this.stage = stage;
    this.rewardedAds = rewardedAds ?? new TapTapRewardedAds();
    const bg = h(
      'div',
      { class: 'bg' },
      h('div', { class: 'bg-px' }),
      h('div', { class: 'bg-fog' }),
    );
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

  async showRewarded(placement: RewardedPlacement): Promise<RewardedResult> {
    this.adDepth++;
    this.syncRendering();
    try { return await this.rewardedAds.showRewarded(placement); }
    finally { this.adDepth--; this.syncRendering(); }
  }

  isCurrentGame(game: Game) {
    return this.game === game;
  }

  showRewardNotice(title: string, detail: string, kind: 'ok' | 'error' = 'ok') {
    clearTimeout(this.rewardNoticeTimer);
    this.rewardNoticeEl?.remove();
    const notice = h(
      'div',
      { class: `reward-notice${kind === 'error' ? ' error' : ''}`, role: 'status', 'aria-live': 'polite' },
      h('div', { class: 'reward-notice-icon' }, icon(kind === 'error' ? 'x' : 'check')),
      h('div', { class: 'reward-notice-copy' }, h('b', null, title), h('span', null, detail)),
    );
    // Keep feedback in viewport pixels; the battlefield scales and may extend beyond short screens.
    document.body.appendChild(notice);
    this.rewardNoticeEl = notice;
    notice.animate(
      [
        { opacity: 0, transform: 'translate(-50%, -18px) scale(.9)' },
        { opacity: 1, transform: 'translate(-50%, 0) scale(1)' },
      ],
      { duration: 320, easing: 'cubic-bezier(.2,1.4,.4,1)' },
    );
    this.rewardNoticeTimer = window.setTimeout(() => {
      notice.animate(
        [{ opacity: 1, transform: 'translate(-50%, 0)' }, { opacity: 0, transform: 'translate(-50%, -14px)' }],
        { duration: 220, easing: 'ease-in' },
      ).onfinish = () => notice.remove();
      if (this.rewardNoticeEl === notice) this.rewardNoticeEl = null;
    }, 2100);
  }

  private leaveGame(keepTitleMusic = false) {
    if (!keepTitleMusic) setTitleMusic(false);
    this.game?.dispose();
    this.game = null;
    this.fx.clear();
    this.rewardedAds.cancelActive();
    clearTimeout(this.rewardNoticeTimer);
    this.rewardNoticeEl?.remove();
    this.rewardNoticeEl = null;
  }

  private show(el: HTMLElement) {
    hideTip();
    this.titleAtmosphere?.dispose();
    this.titleAtmosphere = null;
    const old = [...this.screenEl.children] as HTMLElement[];
    this.screenEl.appendChild(el);
    if (el.classList.contains('title')) this.titleAtmosphere = mountTitleAtmosphere(el);
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
    for (const o of old) {
      o.style.pointerEvents = 'none';
      o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-in' }).onfinish = () => o.remove();
    }
  }

  // ───────────── 标题 ─────────────

  toTitle() {
    this.leaveGame(true);
    setTitleMusic(true);
    const showcase = ['l_cliff', 's_hunter', 'a_jugg', 'm_vindicator', 'v_keeper', 'd_sandblade'];
    const foes = ['e_void', 'e_frostq', 'e_nightk'];
    const saved = loadRun();
    // 有可继续的远征时「继续游戏」是主按钮，新局退为次要并在覆盖前确认。
    const start = h('button', { class: `btn ${saved.kind === 'ok' ? 'ghost' : 'primary'} big title-new` }, h('span', null, '新的游戏'), icon('play'));
    start.addEventListener('click', () => {
      sfx.start();
      if (saved.kind === 'ok') this.confirm('开始新的远征？', saved.run.over ? '本次远征已结束，将开始新的远征。' : '开始新局会放弃当前远征，计为一次失败。', '开始', () => this.toSelect());
      else if (saved.kind === 'incompatible') this.confirm('开始新的远征？', '旧版存档无法继续，开始新局会丢弃它。', '开始', () => {
        if (this.discardIncompatible()) this.toSelect();
      });
      else this.toSelect();
    });
    let cont: HTMLElement | null = null;
    if (saved.kind === 'ok') {
      const r = saved.run;
      const btn = h('button', { class: 'btn primary big title-continue' }, h('span', null, '继续游戏'), icon('play'));
      btn.addEventListener('click', () => { sfx.start(); this.continueRun(r); });
      const currentChapter = chapter(r.chapter);
      const battleInChapter = currentChapter.stages.slice(0, r.node + 1).filter(stage => stage.type !== 'shop').length;
      const phase = screen(r);
      const location = phase === 'shop' ? '商店' : phase === 'fork' ? '路线选择'
        : phase === 'promo' ? (r.tacticsVersion === 1 ? '选择战术' : '主将升阶') : phase === 'reward' ? '奖励选择'
          : phase === 'over' ? '远征结算' : `第${battleInChapter}战`;
      cont = h('div', { class: 'cont-wrap' }, btn, h('div', { class: 'cont-note' }, `第${r.chapter + 1}章 · ${location}`));
    } else if (saved.kind === 'incompatible') {
      cont = h('button', { class: 'btn ghost big' }, h('span', null, '旧版存档无法继续'), icon('x'));
      cont.addEventListener('click', () => this.confirm('丢弃旧版存档？', '游戏版本已更新，旧存档无法继续。', '丢弃', () => {
        if (this.discardIncompatible()) this.toTitle();
      }));
    }
    // 辅助入口与音量键共用右上角工具栏及像素按钮材质。
    const how = h('button', { class: 'icon-btn title-tool' }, icon('book'), h('span', null, '玩法说明'));
    how.addEventListener('click', () => {
      sfx.click();
      this.showHowTo();
    });
    const codex = h('button', { class: 'icon-btn title-tool' }, icon('diamond'), h('span', null, '图鉴'));
    codex.addEventListener('click', () => { sfx.click(); this.toCodex(); });
    const records = h('button', { class: 'icon-btn title-tool' }, icon('flag'), h('span', null, '战绩'));
    const feedback = h('button', { class: 'icon-btn title-tool title-feedback' }, h('span', null, '反馈'));
    feedback.addEventListener('click', () => { sfx.click(); this.showFeedback(); });
    records.addEventListener('click', () => { sfx.click(); this.toRecords(); });
    // 教程完成前保留绿色高亮；完成后与其他工具键同款。
    const tut = tutorialDone()
      ? h('button', { class: 'icon-btn title-tool title-tut-done' }, h('span', null, '新手教程'))
      : h('button', { class: 'btn primary title-tool title-tutorial' }, h('span', null, '新手教程'));
    tut.addEventListener('click', () => { sfx.start(); this.startTutorial(); });
    const quiet = () => isMuted() || getVolumes().master === 0;
    const volume = h('button', { class: 'icon-btn title-volume', 'aria-label': '设置' }, icon(quiet() ? 'mute' : 'sound'));
    volume.addEventListener('click', () => {
      sfx.click();
      const resetTips = h('button', { class: 'btn ghost' }, h('span', null, '重新显示新手提示'));
      const wipe = h('button', { class: 'btn danger' }, h('span', null, '清除全部数据'));
      resetTips.addEventListener('click', () => {
        sfx.click(); resetHints();
        resetTips.replaceChildren(h('span', null, '提示将重新显示'));
        resetTips.disabled = true;
      });
      wipe.addEventListener('click', () => {
        sfx.click();
        this.confirm('清除全部数据？', '远征存档、战绩、成就和教学进度都会删除，无法恢复。声音设置保留。', '清除', () => {
          clearAllData();
          location.reload();
        });
      });
      this.modal(h('div', { class: 'confirm', 'aria-label': '设置' }, h('h3', null, '设置'),
        audioSettings(() => volume.replaceChildren(icon(quiet() ? 'mute' : 'sound'))),
        h('div', { class: 'data-tools' }, resetTips),
        h('div', { class: 'data-tools danger-zone' }, wipe)), 'audio-dialog', document.body);
    });
    const el = h(
      'div',
      { class: 'screen title' },
      h(
        'div',
        { class: 'title-army left' },
        showcase.map((id, i) => h('div', { class: 'ta-unit', style: `--i:${i}`, html: unitSvg(id) })),
      ),
      h(
        'div',
        { class: 'title-army right' },
        foes.map((id, i) => h('div', { class: 'ta-unit boss', style: `--i:${i}`, html: unitSvg(id, { enemy: true }) })),
      ),
      h(
        'div',
        { class: 'title-center' },
        h('div', { class: 'logo', style: 'font-size:100px' }, h('span', null, '奇兵列阵')),
        h('div', { class: 'title-btns' }, cont, start),
      ),
      h('div', { class: 'title-tools' }, tut, how, codex, records, feedback, volume),
    );
    this.show(el);
  }

  // ───────────── 图鉴 ─────────────

  toCodex() {
    this.leaveGame(true);
    setTitleMusic(true);
    this.show(codexScreen(() => this.toTitle(), content => this.modal(content, 'cx-unit-modal', document.body)));
  }

  toRecords() {
    this.leaveGame(true);
    setTitleMusic(true);
    this.show(recordsScreen(() => this.toTitle(), async key => {
      const error = await openCareerLeaderboard(key);
      if (error) this.showRewardNotice('排行榜暂不可用', error, 'error');
    }));
  }

  // ───────────── 选将 ─────────────

  toSelect() {
    this.leaveGame(true);
    setTitleMusic(true);
    const seed = randomSeed();
    const cards = generalChoices(seed).map((id, i) => {
      const g = generalDefinition(id, 1);
      const f = FACTION_INFO[g.faction];
      const c = h(
        'button',
        { class: `gen-card fac-${g.faction}`, style: `--fc:${f.color};--fd:${f.dark};--i:${i};--pxf:var(--pxf-${g.faction});--pxm:var(--pxm-${g.faction})` },
        h('div', { class: 'gc-bg' }),
        h('div', { class: 'gc-art', html: unitSvg(null, { general: g.id }) }),
        h('div', { class: 'gc-fac' }, f.name),
        h('div', { class: 'gc-name' }, g.name),
        h('div', { class: 'gc-title' }, g.title),
        h('div', { class: 'gc-text' }, g.text),
        h('div', { class: 'gc-go' }, '选择', icon('play')),
      );
      c.addEventListener('pointerenter', () => sfx.hover());
      c.addEventListener('click', () => {
        sfx.pick();
        this.startRun(g.id, seed);
      });
      return c;
    });
    const back = h('button', { class: 'btn ghost' }, icon('x'), h('span', null, '返回'));
    back.addEventListener('click', () => {
      sfx.click();
      this.toTitle();
    });
    this.show(
      h(
        'div',
        { class: 'screen select' },
        h('div', { class: 'sel-head' }, h('div', { class: 'sel-title' }, '选择你的将军'), h('div', { class: 'sel-sub' }, '将军能力会在每场战斗中生效')),
        h('div', { class: 'gen-row' }, cards),
        h('div', { class: 'sel-foot' }, back),
      ),
    );
  }

  startRun(general: string, seed?: number) {
    const previous = loadRun();
    if (previous.kind === 'incompatible') {
      // 旧版存档无法续玩：直接丢弃，绝不让玩家卡在开局
      if (!this.discardIncompatible()) return;
    }
    const run = newRun(general, seed);
    stageRunReplacement(previous.kind === 'ok' ? previous.run : null, run);
    if (!saveRun(run)) {
      this.showRewardNotice('远征未能保存', '可在首页「反馈」里清除本地数据后重开。', 'error');
      return;
    }
    this.continueRun(run);
  }

  /** 教学局：固定种子，不落存档 */
  startTutorial() {
    this.leaveGame();
    this.game = new Game(this, newTutorialRun(), true);
    const game = this.game;
    this.syncRendering();
    this.show(game.el);
  }

  continueRun(run: RunState) {
    this.leaveGame();
    if (run.over) { this.toEnd(run); return; }
    this.game = new Game(this, run);
    const game = this.game;
    this.syncRendering();
    this.show(game.el);
    setTimeout(() => { if (this.game === game) game.introBanner(); }, 350);
  }

  // ───────────── 结算 ─────────────

  toEnd(run: RunState) {
    this.leaveGame();
    const win = run.over === 'victory';
    const profile = recordRunOutcome(run, win ? 'victory' : 'defeat');
    void syncCareerLeaderboards();
    if (profile.storageStatus !== 'ok' || !clearRun()) {
      this.showRewardNotice('战绩尚未保存', '本局存档已保留，请检查本地存储后重试。', 'error');
    }
    const reached = Math.min(battleNo(run) + 1, TOTAL_BATTLES);
    const again = h('button', { class: 'btn primary big' }, h('span', null, '再来一局'), icon('replay'));
    again.addEventListener('click', () => {
      sfx.click();
      this.toSelect();
    });
    const home = h('button', { class: 'btn ghost big' }, h('span', null, '返回标题'));
    home.addEventListener('click', () => {
      sfx.click();
      this.toTitle();
    });
    const team = run.slots.map((s) =>
      s
        ? h(
            'div',
            { class: 'end-unit' },
            tierArt('eu-art', s.defId, unitDef(s.defId).tier),
            h('div', { class: 'eu-name' }, unitDef(s.defId).name),
            h('div', { class: 'eu-lv' }, `${unitLevel(s)}星`),
          )
        : h('div', { class: 'end-unit empty' }),
    );
    const el = h(
      'div',
      { class: `screen end ${win ? 'victory' : 'defeat'}` },
      h('div', { class: 'end-rays' }),
      h('div', { class: 'end-title' }, win ? '远征胜利' : '远征终止'),
      h('div', { class: 'end-sub' }, win ? '三章远征全部通关！' : `止步${chapter(run.chapter).name} · 第 ${reached} 战 · ${currentNode(run).name}`),
      h(
        'div',
        { class: 'end-stats' },
        h('div', null, h('b', null, run.wins), h('span', null, '胜场')),
        h('div', null, h('b', null, `${reached}/${TOTAL_BATTLES}`), h('span', null, '到达战斗')),
        h('div', null, h('b', null, run.lives), h('span', null, '剩余生命')),
      ),
      h('div', { class: 'end-team-lbl' }, '最终阵列'),
      h('div', { class: 'end-team' }, [...team].reverse()),
      h('div', { class: 'end-btns' }, home, again),
    );
    if (win) {
      sfx.win();
      for (let i = 0; i < 6; i++)
        setTimeout(() => this.fx.burst(200 + Math.random() * 880, 150 + Math.random() * 250, ['#ffd36b', '#7dffb0', '#6fe6ff', '#ff9a3d', '#b77bff', '#fff'][i], { n: 50, speed: 9, size: 3 }), i * 220);
    }
    this.show(el);
    setTimeout(() => { if (el.isConnected) this.askFeedback('firstRun', win); }, win ? 1800 : 900);
  }

  // ───────────── 弹窗 ─────────────

  modal(content: HTMLElement, cls = '', mount: HTMLElement = this.stage) {
    const origin = document.activeElement as HTMLElement | null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let closing = false;
    const close = () => {
      if (closing) return;
      closing = true;
      if (origin?.isConnected) origin.focus({ preventScroll: true });
      sfx.click();
      m.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduceMotion ? 0 : 160 }).onfinish = () => m.remove();
    };
    const x = h('button', { class: 'icon-btn modal-x', 'aria-label': '关闭' }, icon('x'));
    x.addEventListener('click', close);
    const m = h('div', { class: `modal-ov ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': content.getAttribute('aria-label') }, h('div', { class: 'modal' }, x, content));
    m.addEventListener('pointerdown', (e) => {
      if (e.target === m) close();
    });
    m.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      const buttons = [...m.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
      const index = buttons.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && index <= 0) { e.preventDefault(); buttons.at(-1)?.focus({ preventScroll: true }); }
      else if (!e.shiftKey && index === buttons.length - 1) { e.preventDefault(); buttons[0]?.focus({ preventScroll: true }); }
    });
    mount.appendChild(m);
    x.focus({ preventScroll: true });
    m.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduceMotion ? 0 : 200 });
    m.querySelector('.modal')!.animate([{ transform: 'scale(.92) translateY(10px)' }, { transform: 'none' }], { duration: reduceMotion ? 0 : 260, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
    return close;
  }

  /** H5 接不了官方评价组件：关键节点只弹一次，恳请玩家去 TapTap 评论区留言。 */
  askFeedback(kind: 'tutorial' | 'firstRun', win = false) {
    const key = `zl_fb_${kind}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch { return; }
    const title = kind === 'tutorial' ? '教程完成，感谢试玩！' : win ? '恭喜完成第一次远征！' : '第一次远征辛苦了！';
    const text = kind === 'tutorial'
      ? '游戏还在打磨中。上手体验如何？哪里没看懂、哪里希望我们改进，恳请到 TapTap 评论区告诉我们。'
      : '我们是小团队，正靠玩家的声音打磨这款游戏。能否花一分钟，在 TapTap 评论区留下评价？好玩的、困惑的、卡住的地方，我们都会认真看。';
    const ok = h('button', { class: 'btn primary' }, h('span', null, '好的'));
    const close = this.modal(h('div', { class: 'confirm', 'aria-label': title }, h('h3', null, title), h('p', null, text), h('div', { class: 'confirm-btns' }, ok)), 'small');
    ok.addEventListener('click', close);
  }

  /** 丢弃无法续玩的旧存档；连这也失败时引导清除本地数据 */
  private discardIncompatible(): boolean {
    if (clearRun({ discardIncompatible: true }) || clearAllData()) return true;
    this.showRewardNotice('存档无法丢弃', '请在「反馈」里清除本地数据后重开。', 'error');
    return false;
  }

  /** 反馈：QQ 群 + 兜底的清除本地数据重开（本作没有局外养成，清掉只丢战绩与教学进度） */
  showFeedback() {
    const copy = h('button', { class: 'btn primary' }, h('span', null, '复制群号'));
    copy.addEventListener('click', () => {
      sfx.click();
      const done = () => copy.replaceChildren(h('span', null, '已复制'));
      navigator.clipboard?.writeText(QQ_GROUP).then(done, () => copy.replaceChildren(h('span', null, QQ_GROUP)));
    });
    const wipe = h('button', { class: 'btn danger' }, h('span', null, '清除本地数据重开'));
    wipe.addEventListener('click', () => {
      sfx.click();
      this.confirm('清除本地数据重开？', '删除远征存档、战绩和教学进度，保留声音设置。存档出错进不去时用这个。', '清除并重开', () => {
        clearAllData();
        location.reload();
      });
    });
    this.modal(h('div', { class: 'confirm feedback-dialog', 'aria-label': '反馈' }, h('h3', null, '反馈'),
      h('p', null, '有问题或建议？欢迎加 QQ 群：'),
      h('div', { class: 'fb-group' }, h('span', null, 'QQ 群'), h('b', null, QQ_GROUP)),
      h('div', { class: 'confirm-btns' }, copy),
      h('div', { class: 'data-tools danger-zone' }, h('p', null, '存档出问题、卡住玩不了？'), wipe)), 'audio-dialog', document.body);
  }

  confirm(title: string, text: string, okText: string, ok: () => void) {
    const yes = h('button', { class: 'btn danger' }, h('span', null, okText));
    const no = h('button', { class: 'btn ghost' }, h('span', null, '取消'));
    const close = this.modal(h('div', { class: 'confirm' }, h('h3', null, title), h('p', null, text), h('div', { class: 'confirm-btns' }, no, yes)), 'small');
    no.addEventListener('click', close);
    yes.addEventListener('click', () => {
      close();
      ok();
    });
  }

  /** 玩法说明：「基础玩法」分页 + 「词条」总表（词条释义统一放在这里，不跟着单位走） */
  showHowTo(tab: 'basic' | 'kw' = 'basic') {
    const pages = howto().map((p) =>
      h(
        'div',
        { class: 'ht-page' },
        h('div', { class: 'ht-fig', html: p.fig }),
        h('div', { class: 'ht-body' }, h('h3', null, p.title), p.lines.map(htLine)),
      ),
    );
    let idx = 0;
    const pageNumber = h('span', { class: 'ht-page-number', role: 'status', 'aria-live': 'polite' }, `1 / ${pages.length}`);
    const view = h('div', { class: 'ht-view' }, pages[0]);
    const prev = h('button', { class: 'btn ghost' }, h('span', null, '上一页'));
    const next = h('button', { class: 'btn primary' }, h('span', null, '下一页'));
    const go = (d: number) => {
      idx = Math.max(0, Math.min(pages.length - 1, idx + d));
      view.replaceChildren(pages[idx]);
      view.scrollTop = 0;
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        pages[idx].animate([{ opacity: .5 }, { opacity: 1 }], { duration: 140 });
      }
      pageNumber.textContent = `${idx + 1} / ${pages.length}`;
      prev.disabled = idx === 0;
      next.querySelector('span')!.textContent = idx === pages.length - 1 ? '关闭' : '下一页';
      sfx.click();
    };
    prev.disabled = true;
    prev.addEventListener('click', () => go(-1));
    let close = () => {};
    next.addEventListener('click', () => (idx === pages.length - 1 ? close() : go(1)));
    const nav = h('div', { class: 'ht-nav' }, prev, pageNumber, next);
    const tabs = (['basic', 'kw'] as const).map((k) => h('button', { class: 'ht-tab', onclick: () => { sfx.click(); setTab(k); } }, k === 'basic' ? '基础玩法' : '词条'));
    const body = h('div', { class: 'ht-body-wrap' });
    const setTab = (k: 'basic' | 'kw') => {
      tabs.forEach((b, i) => b.classList.toggle('on', (i === 0) === (k === 'basic')));
      if (k === 'basic') body.replaceChildren(view, nav);
      // 每次重建：演示动画离开页面即停止
      else body.replaceChildren(h('div', { class: 'ht-doc' }, keywordDoc()));
    };
    setTab(tab);
    close = this.modal(h('div', { class: 'howto', 'aria-label': '玩法说明' }, h('div', { class: 'ht-head' }, h('div', { class: 'ht-tabs' }, tabs)), body), 'wide');
  }
}

// 说明页使用原素材静帧；敌方仅在这个独立 SVG 中翻转一次。
const mini = (id: string, x: number, o: { enemy?: boolean; dim?: boolean } = {}) => {
  const u = unitPxUrl(id);
  const art = `<image href="${u}" x="-50" y="-62" width="100" height="112" style="image-rendering:pixelated" transform="scale(${o.enemy ? -1 : 1} 1)"/>`;
  return `<g transform="translate(${x} 82) scale(.85)" opacity="${o.dim ? 0.3 : 1}">${art}</g>`;
};
const pedUrl = [0, 1].map((e) => pedestalUrl(e === 1));
const ped = (x: number, enemy = false) => `<image href="${pedUrl[enemy ? 1 : 0]}" x="${x - 23}" y="86" width="46" height="18" style="image-rendering:pixelated"/>`;

// 插图只复用实际单位；规则正文与图鉴来自同一份说明数据。
const howto = (): { title: string; lines: string[]; fig: string }[] => {
  const row = (...units: { id: string; enemy?: boolean; dim?: boolean }[]) =>
    `<svg viewBox="0 0 ${units.length * 100} 140" aria-hidden="true">${units.map((u, i) => `${ped(50 + i * 100, u.enemy)}${mini(u.id, 50 + i * 100, u)}`).join('')}</svg>`;
  const duel = row({ id: 'm_rex' }, { id: 'l_priest' }, { id: 'e_brute', enemy: true }, { id: 'e_skel', enemy: true });
  const rules = BATTLE_RULES;
  return [
    {
      title: '队首与站位',
      lines: [
        '每方 <b>5 格</b>，挨着中线的 <b>1 号位是队首</b>。行动从队首排到队尾。',
        '有人阵亡就空出一格，后面的人<b>不前移</b>。',
        '普攻打敌方队首。<b>狙击</b>打队尾，<b>决斗</b>打本次交锋的对手。<b>嘲讽</b>替紧挨前后的友军挡普攻。',
      ],
      fig: duel,
    },
    {
      title: '一次交锋',
      lines: [rules.beat.text,
        '施法先击杀或冻住对手，对手这次就打不出普攻。',
        '双方同时施法时，我方先结算。',
        '单位脚下的 <b>1–5</b> 是本回合出手顺序，<b>同号同时出手</b>。',
      ],
      fig: row({ id: 'm_shaman' }, { id: 'm_rex' }, { id: 'e_brute', enemy: true }),
    },
    {
      title: '回合与行动轮',
      lines: [rules.round.text, rules.wave.text,
        '例：<b>5 人打 3 人</b>，前 3 次交锋双方各出一人；第 4、5 次只有 5 人方行动，3 人方等待。之后进入下一回合。',
      ],
      fig: row({ id: 'm_rex' }, { id: 'l_priest' }, { id: 'e_brute', enemy: true, dim: true }),
    },
    {
      title: '额外行动',
      lines: [rules.extra.text,
        '额外轮同样从队首排到队尾，没有次数的一方等待。<b>双方次数都用完</b>才进入下一回合。',
      ],
      fig: row({ id: 'n_marshal' }, { id: 'm_rex' }),
    },
    {
      title: '施法还是普攻',
      lines: [rules.action.text,
        '<b>「施法：」</b>没有可选目标时，改为普攻。',
        '施法不限次数，多一次行动就多施一次。<b>卡面写了次数的例外</b>：如唤亡祭师、构装学徒，本场用完后只普攻。',
      ],
      fig: row({ id: 'm_shaman' }, { id: 'm_rex' }, { id: 'a_ritualist' }),
    },
    {
      title: '追击与连击',
      lines: [
        '<b>追击</b>：立刻普攻一次。不施法，不用行动次数，不改顺序。寒意照样生效。',
        '<b>追击引发的效果不再引发追击</b>。例：追击击杀敌人，「击杀时：追击」不触发。主将被动<b>「连锁」</b>可再引发一次；主将直接下令的追击总会发动。',
        '<b>连击</b>：一次攻击打两下。<b>行动 +1</b>：本回合稍后多行动一次，可以施法。',
      ],
      fig: row({ id: 's_dancer' }, { id: 's_wind' }),
    },
    {
      title: '寒意与冻结',
      lines: [
        '寒意<b>马上生效</b>：下次普攻的攻击减去寒意层数（最少 1），出手后清空。',
        '出手前<b>寒意 ≥ 攻击</b>就冻结：跳过这次出手，清空寒意，仍算用掉一次行动。施法和追击同样会被冻结。',
        '没轮到出手前，寒意<b>一直保留</b>，回合结束也不消失。',
      ],
      fig: row({ id: 'v_mage' }, { id: 'e_brute', enemy: true, dim: true }),
    },
    {
      title: '交锋后：灼烧与疲劳',
      lines: [rules.beatEnd.text,
        '<b>灼烧 N 层</b>：每次交锋后受 N 伤害，再减 1 层。无视格挡和护甲。',
        `<b>疲劳</b>：第一至三章分别从第 <b>${[1, 2, 3].map(fatigueStartForChapter).join('／')}</b> 次交锋后开始，双方全体每次交锋受伤，从 1 点起逐次加 1。`,
      ],
      fig: row({ id: 'm_shaman' }, { id: 'e_brute', enemy: true }),
    },
    {
      title: '防御与攻击词条',
      lines: [
        '<b>格挡</b>：挡掉下一次伤害，用掉 1 层。<b>护甲 N</b>：每次受伤 −N，最少 1。灼烧无视两者。',
        '<b>溅射</b>：顺带打目标身后一人，伤害减半。<b>反击</b>：被普攻打中时反伤，连击每段都反。',
        '<b>复生</b>：第一次阵亡时原地 1 血复活。<b>法强</b>：提高自己的施法数值，群体效果只加一半。其余见「词条」页。',
      ],
      fig: row({ id: 'l_shield' }, { id: 'v_wall' }, { id: 'm_rex' }),
    },
    {
      title: '看敌阵调站位',
      lines: [
        '点顶部<b>路线节点</b>可提前看敌阵，按对面的护甲、寒意、狙击调站位。',
        '输了在结算页点<b>「复盘」</b>，用同一阵容换站位再打。',
      ],
      fig: row({ id: 'l_shield' }, { id: 'm_shaman' }, { id: 'e_silencer', enemy: true }),
    },
    {
      title: '远征与培养',
      lines: [
        '远征 <b>3 章 21 战</b>，每章 2 次商店、1 处精英岔路、1 名首领。生命 3 条，打赢首领回 1 条。',
        '打赢得<b>金币和培养点</b>。在「整备」里选培养点再点单位，永久加攻击、生命或格挡；「法」点给吃法强的单位。',
        '商店卖单位、装备、法术和招募令；单位可拖去出售。精英战胜利后装备三选一。',
      ],
      fig: row({ id: 'n_merc' }, { id: 'l_shield' }, { id: 'm_rex' }),
    },
    {
      title: '主将、战术与保存',
      lines: [
        '第一、二章<b>第 4 场后</b>各选一次战术（三选一）。旧存档仍是主将升阶。',
        '齐兰、卡雷奥斯在备战时<b>指定一名友军</b>，指定会保留，随时可改；战斗中自动生效。',
        '进度自动保存。回标题点<b>「继续游戏」</b>即可接着打。',
      ],
      fig: row({ id: 'm_rex' }, { id: 'l_priest' }),
    },
  ];
};
