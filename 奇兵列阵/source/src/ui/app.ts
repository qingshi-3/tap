import '../title-actions.css';
import { mountTitleAtmosphere } from './titleAtmosphere';
import { unitLevel } from '../core/types';
import { FACTION_INFO, GENERAL_MAP, unitDef } from '../core/data';
import { chapter, TOTAL_BATTLES } from '../core/route';
import { battleNo, currentNode, generalChoices, newRun, randomSeed, screen, type RunState } from '../core/run';
import { clearRun, loadRun, saveRun } from '../core/save';
import { getVolumes, isMuted, setAudioPaused, setTitleMusic, sfx, unlockAudio } from './audio';
import { audioSettings } from './audioSettings';
import { h, stageState } from './dom';
import { ambient, FX } from './fx';
import { Game } from './game';
import { newTutorialRun } from './tutorial';
import { codexScreen, keywordDoc } from './codex';
import { BATTLE_RULES } from '../core/battleRules';
import '../mechanics-guide.css';
import { icon } from './icons';
import { hideTip, initTip } from './tip';
import { pedestalUrl } from './pixel';
import { TapTapRewardedAds, type RewardedAds, type RewardedPlacement, type RewardedResult } from './rewarded';
import { unitPxUrl, unitSvg } from './unitArt';

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
    const start = h('button', { class: 'btn primary big title-new' }, h('span', null, '新的游戏'), icon('play'));
    start.addEventListener('click', () => {
      sfx.start();
      if (saved.kind === 'ok') this.confirm('开始新的远征？', '当前远征进度将被覆盖。', '开始', () => this.toSelect());
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
        : phase === 'promo' ? '主将升阶' : phase === 'reward' ? '奖励选择'
          : phase === 'over' ? '远征结算' : `第${battleInChapter}战`;
      cont = h('div', { class: 'cont-wrap' }, btn, h('div', { class: 'cont-note' }, `第${r.chapter + 1}章 · ${location}`));
    } else if (saved.kind === 'incompatible') {
      cont = h('button', { class: 'btn ghost big' }, h('span', null, '旧版存档无法继续'), icon('x'));
      cont.addEventListener('click', () => this.confirm('丢弃旧版存档？', '游戏版本已更新，旧存档无法继续。', '丢弃', () => { clearRun(); this.toTitle(); }));
    }
    // 辅助入口与音量键共用右上角工具栏及像素按钮材质。
    const how = h('button', { class: 'icon-btn title-tool' }, icon('book'), h('span', null, '玩法说明'));
    how.addEventListener('click', () => {
      sfx.click();
      this.showHowTo();
    });
    const codex = h('button', { class: 'icon-btn title-tool' }, icon('diamond'), h('span', null, '图鉴'));
    codex.addEventListener('click', () => { sfx.click(); this.toCodex(); });
    const tut = h('button', { class: 'btn primary title-tool title-tutorial' }, h('span', null, '新手教程'));
    tut.addEventListener('click', () => { sfx.start(); this.startTutorial(); });
    const quiet = () => isMuted() || getVolumes().master === 0;
    const volume = h('button', { class: 'icon-btn title-volume', 'aria-label': '声音设置' }, icon(quiet() ? 'mute' : 'sound'));
    volume.addEventListener('click', () => {
      sfx.click();
      this.modal(h('div', { class: 'confirm', 'aria-label': '声音设置' }, h('h3', null, '声音设置'),
        audioSettings(() => volume.replaceChildren(icon(quiet() ? 'mute' : 'sound')))), 'audio-dialog', document.body);
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
      h('div', { class: 'title-tools' }, tut, how, codex, volume),
    );
    this.show(el);
  }

  // ───────────── 图鉴 ─────────────

  toCodex() {
    this.leaveGame(true);
    setTitleMusic(true);
    this.show(codexScreen(() => this.toTitle(), content => this.modal(content, 'cx-unit-modal', document.body)));
  }

  // ───────────── 选将 ─────────────

  toSelect() {
    this.leaveGame(true);
    setTitleMusic(true);
    const seed = randomSeed();
    const cards = generalChoices(seed).map((id, i) => {
      const g = GENERAL_MAP[id];
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
        h('div', { class: 'sel-head' }, h('div', { class: 'sel-title' }, '选择你的将军'), h('div', { class: 'sel-sub' }, '本局随机三位将军可选 · 将军能力每场开战自动生效，决定这一局的打法倾向')),
        h('div', { class: 'gen-row' }, cards),
        h('div', { class: 'sel-foot' }, back),
      ),
    );
  }

  startRun(general: string, seed?: number) {
    const run = newRun(general, seed);
    saveRun(run);
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
    clearRun();
    const reached = Math.min(battleNo(run) + 1, TOTAL_BATTLES);
    const again = h('button', { class: 'btn primary big' }, h('span', null, '再来一局'), icon('replay'));
    again.addEventListener('click', () => {
      sfx.click();
      this.toSelect();
    });
    const home = h('button', { class: 'btn ghost big', style: 'background:#34304d;border:none' }, h('span', null, '返回标题'));
    home.addEventListener('click', () => {
      sfx.click();
      this.toTitle();
    });
    const team = run.slots.map((s) =>
      s
        ? h(
            'div',
            { class: 'end-unit' },
            h('div', { class: 'eu-art', html: unitSvg(s.defId) }),
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
      h('div', { class: 'end-sub' }, win ? '三章远征全部完成。你的阵型经受住了所有考验。' : `止步${chapter(run.chapter).name} · 第 ${reached} 战 · ${currentNode(run).name}`),
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
        h('div', { class: 'ht-body' }, h('h3', null, p.title), p.lines.map((l) => h('p', { html: l }))),
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
    let doc: HTMLElement | null = null;
    const tabs = (['basic', 'kw'] as const).map((k) => h('button', { class: 'ht-tab', onclick: () => { sfx.click(); setTab(k); } }, k === 'basic' ? '基础玩法' : '词条'));
    const body = h('div', { class: 'ht-body-wrap' });
    const setTab = (k: 'basic' | 'kw') => {
      tabs.forEach((b, i) => b.classList.toggle('on', (i === 0) === (k === 'basic')));
      if (k === 'basic') body.replaceChildren(view, nav);
      else body.replaceChildren(doc ??= h('div', { class: 'ht-doc' }, keywordDoc()));
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
        '双方各有 <b>5 个格位</b>；靠近中线的 <b>1 号位是队首</b>，常规行动从队首排向队尾。',
        '阵亡后留下空格，后面的单位<b>不会前移</b>。出手顺序跳过空格，只看存活单位。',
        '普通攻击默认打敌方队首；带<b>狙击</b>时改打队尾。',
      ],
      fig: duel,
    },
    {
      title: '一拍怎样结算',
      lines: [rules.beat.text,
        '施法若先击杀或冻住对面的出手者，就能阻止它本拍原定的普攻。',
        '同一拍并不是我方先打完、敌方再还手；已同时开始的双方普攻可互相击倒。',
      ],
      fig: row({ id: 'm_shaman' }, { id: 'm_rex' }, { id: 'e_brute', enemy: true }),
    },
    {
      title: '回合与行动轮',
      lines: [rules.round.text, rules.wave.text,
        '双方都没有额外次数时，<b>5 人对 3 人</b>：前 3 拍双方各一人；第 4、5 拍只有 5 人方行动，3 人方等待。然后才进入新回合。',
      ],
      fig: row({ id: 'm_rex' }, { id: 'l_priest' }, { id: 'e_brute', enemy: true, dim: true }),
    },
    {
      title: '额外行动排在哪里',
      lines: [rules.extra.text,
        '额外轮仍按队首到队尾排队；某方没有剩余次数就等待。等<b>双方常规行动次数全耗尽</b>，才补发下回合的基础次数。',
      ],
      fig: row({ id: 'n_marshal' }, { id: 'm_rex' }),
    },
    {
      title: '行动时施法还是普攻',
      lines: [rules.action.text,
        '有<b>「施法：」</b>的单位，按卡面效果施法；没有有效目标时改为普攻。其他单位通常普攻。',
        '施法通常<b>没有额外次数上限</b>，多一次行动就可再按自身规则施法。<b>唤亡祭师例外：本场最多施法 3 次</b>，用完后改为普攻，不会每回合重置。',
      ],
      fig: row({ id: 'm_shaman' }, { id: 'm_rex' }, { id: 'a_ritualist' }),
    },
    {
      title: '立即攻击与连击',
      lines: [
        '<b>立即攻击</b>：当前拍内追加一次普攻，<b>不施法、不消耗常规行动次数</b>，也不改变后续行动顺序。仍受寒意影响。',
        '普通立即攻击每方每拍默认最多 <b>1 次</b>；主将被动<b>「连锁」</b>把我方上限改为 2 次，主将直接命令的立即攻击不占此上限。',
        '<b>连击</b>：一次普攻内打两段，各为本次攻击力的一半（向上取整）。立即攻击也能连击，但这仍不是两次行动。',
      ],
      fig: row({ id: 's_dancer' }, { id: 's_wind' }),
    },
    {
      title: '寒意立即生效，也会保留',
      lines: [
        '获得寒意后，<b>接下来的出手就受影响</b>，不用等到下回合。普攻攻击减去寒意层数（最少 1），出手后清空。',
        '出手前若<b>寒意 ≥ 本次攻击力</b>，则冻结：跳过这次出手、清空寒意。被冻结仍消耗本次常规行动机会；施法和立即攻击也检查冻结。',
        '如果还没轮到它，寒意就继续留着，<b>不会在回合结束时自动消失</b>。',
      ],
      fig: row({ id: 'v_mage' }, { id: 'e_brute', enemy: true, dim: true }),
    },
    {
      title: '拍末：主将、灼烧与疲劳',
      lines: [rules.beatEnd.text,
        '<b>灼烧 N 层</b>：每拍结束受 N 伤害，然后减少 1 层；无视格挡、护甲和易伤。',
        '从<b>第 20 拍结束</b>开始，双方全体受到疲劳伤害：先 1 点，之后每拍递增。不会等到回合结束才结算。',
      ],
      fig: row({ id: 'm_shaman' }, { id: 'e_brute', enemy: true }),
    },
    {
      title: '防御与攻击词条',
      lines: [
        '<b>格挡</b>抵消下一次伤害并消耗 1 层；<b>护甲</b>让每次伤害 −N，最少 1。灼烧无视两者。',
        '<b>溅射</b>额外打目标身后一名；<b>反击</b>在被普攻直接命中时反伤，连击每段都可触发。',
        '<b>复生</b>让第一次阵亡原位 1 血复活；<b>法强</b>强化自己的施法数值，群体效果加成减半。其他词条可切到「词条」查阅。',
      ],
      fig: row({ id: 'l_shield' }, { id: 'v_wall' }, { id: 'm_rex' }),
    },
    {
      title: '看敌阵，再调站位',
      lines: [
        '点击顶部<b>路线节点</b>提前看敌阵，再为护甲、寒意、狙击等能力调整站位。',
        '打输了可在结算后点<b>「复盘」</b>，使用同一阵容调整站位试打。',
      ],
      fig: row({ id: 'l_shield' }, { id: 'm_shaman' }, { id: 'e_silencer', enemy: true }),
    },
    {
      title: '远征与培养',
      lines: [
        '远征共 <b>3 章 21 战</b>。每章有两次商店、一处精英岔路和一名首领。生命 3 条，击败首领恢复 1 条。',
        '胜利获得<b>金币和培养点</b>。点培养点再点单位，永久提升攻击、生命、格挡；「法」点可给<b>施法单位或主将</b>，强化各自的施法。',
        '商店出售单位、装备、一次性法术和招募令；可卖单位换金。精英胜利掉落装备三选一。',
      ],
      fig: row({ id: 'n_merc' }, { id: 'l_shield' }, { id: 'm_rex' }),
    },
    {
      title: '主将升阶与保存',
      lines: [
        '首章首领后、第二章岔路后、第二章首领后，主将各<b>升阶一次</b>，从三个被动中选一个。',
        '主将技能按拍自动发动；升阶被动按各自说明生效，不必消耗单位行动。',
        '进度自动保存。返回标题后，可点<b>「继续游戏」</b>回到当前远征。',
      ],
      fig: row({ id: 'm_rex' }, { id: 'l_priest' }),
    },
  ];
};
