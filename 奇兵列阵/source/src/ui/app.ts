import { unitLevel } from '../core/types';
import { FACTION_INFO, GENERAL_MAP, unitDef } from '../core/data';
import { chapter, TOTAL_BATTLES } from '../core/route';
import { battleNo, currentNode, generalChoices, newRun, randomSeed, type RunState } from '../core/run';
import { clearRun, hasPlayed, loadRun, saveRun } from '../core/save';
import { isMuted, setMuted, sfx, unlockAudio } from './audio';
import { h, stageState } from './dom';
import { ambient, FX } from './fx';
import { Game } from './game';
import { newTutorialRun } from './tutorial';
import { codexScreen, keywordDoc } from './codex';
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
  private adDepth = 0;

  private syncRendering = () => {
    const paused = document.hidden || this.adDepth > 0;
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

  private leaveGame() {
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
    const old = [...this.screenEl.children] as HTMLElement[];
    this.screenEl.appendChild(el);
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
    for (const o of old) {
      o.style.pointerEvents = 'none';
      o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-in' }).onfinish = () => o.remove();
    }
  }

  // ───────────── 标题 ─────────────

  toTitle() {
    this.leaveGame();
    const showcase = ['l_shield', 's_wind', 'a_seed', 'm_rex', 'v_mage', 'n_echo'];
    const foes = ['e_brute', 'e_void', 'e_assassin'];
    const saved = loadRun();
    // 没正式开过远征的设备：教程是主按钮，开始远征退为次按钮；否则教程降为底部文字入口
    const fresh = !hasPlayed();
    const start = h('button', { class: `btn ${saved.kind === 'ok' || fresh ? 'ghost' : 'primary'} big` }, h('span', null, saved.kind === 'ok' ? '新的远征' : '开始远征'), icon('play'));
    start.addEventListener('click', () => {
      sfx.start();
      if (saved.kind === 'ok') this.confirm('开始新的远征？', '当前远征进度将被覆盖。', '开始', () => this.toSelect());
      else this.toSelect();
    });
    let cont: HTMLElement | null = null;
    if (saved.kind === 'ok') {
      const r = saved.run;
      const btn = h('button', { class: 'btn primary big' }, h('span', null, '继续游戏'), icon('play'));
      btn.addEventListener('click', () => { sfx.start(); this.continueRun(r); });
      // 存档节点放按钮下方一行小字，按钮本身只留动作
      cont = h('div', { class: 'cont-wrap' }, btn, h('div', { class: 'cont-note' }, `${chapter(r.chapter).name} · 第 ${battleNo(r) + 1} 战`));
    } else if (saved.kind === 'incompatible') {
      cont = h('button', { class: 'btn ghost big' }, h('span', null, '旧版存档无法继续'), icon('x'));
      cont.addEventListener('click', () => this.confirm('丢弃旧版存档？', '游戏版本已更新，旧存档无法继续。', '丢弃', () => { clearRun(); this.toTitle(); }));
    }
    // 辅助入口：弱化为一排文字按钮，不和开局按钮抢视觉
    const how = h('button', { class: 'title-link' }, icon('book'), h('span', null, '玩法说明'));
    how.addEventListener('click', () => {
      sfx.click();
      this.showHowTo();
    });
    const codex = h('button', { class: 'title-link' }, icon('diamond'), h('span', null, '图鉴'));
    codex.addEventListener('click', () => { sfx.click(); this.toCodex(); });
    const tut = fresh
      ? h('button', { class: 'btn primary big' }, icon('star'), h('span', null, '新手教程'))
      : h('button', { class: 'title-link' }, icon('star'), h('span', null, '新手教程'));
    tut.addEventListener('click', () => { sfx.start(); this.startTutorial(); });
    const mute = h('button', { class: 'icon-btn corner' }, icon(isMuted() ? 'mute' : 'sound'));
    mute.addEventListener('click', () => {
      setMuted(!isMuted());
      mute.replaceChildren(icon(isMuted() ? 'mute' : 'sound'));
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
        foes.map((id, i) => h('div', { class: `ta-unit${id === 'e_void' ? ' boss' : ''}`, style: `--i:${i}`, html: unitSvg(id, { enemy: true }) })),
      ),
      h(
        'div',
        { class: 'title-center' },
        h('div', { class: 'logo', style: 'font-size:100px' }, h('span', null, '奇兵列阵')),
        h('div', { class: 'title-btns' }, fresh ? tut : null, cont, start),
        h('div', { class: 'title-links' }, fresh ? null : tut, how, codex),
      ),
      mute,
    );
    this.show(el);
  }

  // ───────────── 图鉴 ─────────────

  toCodex() {
    this.leaveGame();
    this.show(codexScreen(() => this.toTitle()));
  }

  // ───────────── 选将 ─────────────

  toSelect() {
    this.leaveGame();
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

  modal(content: HTMLElement, cls = '') {
    const origin = document.activeElement as HTMLElement | null;
    let closing = false;
    const close = () => {
      if (closing) return;
      closing = true;
      if (origin?.isConnected) origin.focus({ preventScroll: true });
      sfx.click();
      m.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 }).onfinish = () => m.remove();
    };
    const x = h('button', { class: 'icon-btn modal-x' }, icon('x'));
    x.addEventListener('click', close);
    const m = h('div', { class: `modal-ov ${cls}`, role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'modal' }, x, content));
    m.addEventListener('pointerdown', (e) => {
      if (e.target === m) close();
    });
    m.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      const buttons = [...m.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')];
      const index = buttons.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && index <= 0) { e.preventDefault(); buttons.at(-1)?.focus({ preventScroll: true }); }
      else if (!e.shiftKey && index === buttons.length - 1) { e.preventDefault(); buttons[0]?.focus({ preventScroll: true }); }
    });
    this.stage.appendChild(m);
    x.focus({ preventScroll: true });
    m.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    m.querySelector('.modal')!.animate([{ transform: 'scale(.92) translateY(10px)' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
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
    const dots = h('div', { class: 'ht-dots' }, pages.map((_, i) => h('span', { class: i === 0 ? 'on' : '' })));
    const view = h('div', { class: 'ht-view' }, pages[0]);
    const prev = h('button', { class: 'btn ghost' }, h('span', null, '上一页'));
    const next = h('button', { class: 'btn primary' }, h('span', null, '下一页'));
    const go = (d: number) => {
      idx = Math.max(0, Math.min(pages.length - 1, idx + d));
      view.replaceChildren(pages[idx]);
      pages[idx].animate([{ opacity: 0, transform: `translateX(${d * 30}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
      [...dots.children].forEach((c, i) => c.classList.toggle('on', i === idx));
      prev.classList.toggle('disabled', idx === 0);
      next.querySelector('span')!.textContent = idx === pages.length - 1 ? '开始吧' : '下一页';
      sfx.click();
    };
    prev.classList.add('disabled');
    prev.addEventListener('click', () => go(-1));
    let close = () => {};
    next.addEventListener('click', () => (idx === pages.length - 1 ? close() : go(1)));
    const nav = h('div', { class: 'ht-nav' }, prev, dots, next);
    let doc: HTMLElement | null = null;
    const tabs = (['basic', 'kw'] as const).map((k) => h('button', { class: 'ht-tab', onclick: () => { sfx.click(); setTab(k); } }, k === 'basic' ? '基础玩法' : '词条'));
    const body = h('div', { class: 'ht-body-wrap' });
    const setTab = (k: 'basic' | 'kw') => {
      tabs.forEach((b, i) => b.classList.toggle('on', (i === 0) === (k === 'basic')));
      if (k === 'basic') body.replaceChildren(view, nav);
      else body.replaceChildren(doc ??= h('div', { class: 'ht-doc' }, keywordDoc()));
    };
    setTab(tab);
    close = this.modal(h('div', { class: 'howto' }, h('div', { class: 'ht-head' }, h('span', null, '玩法说明'), h('div', { class: 'ht-tabs' }, tabs)), body), 'wide');
  }
}

// 说明页使用原素材静帧；敌方仅在这个独立 SVG 中翻转一次。
const mini = (id: string, x: number, o: { enemy?: boolean; dim?: boolean; label?: string } = {}) => {
  const u = unitPxUrl(id);
  const art = `<image href="${u}" x="-50" y="-62" width="100" height="112" style="image-rendering:pixelated" transform="scale(${o.enemy ? -1 : 1} 1)"/>`;
  return `<g transform="translate(${x} 70) scale(.5)" opacity="${o.dim ? 0.3 : 1}">${art}</g>${o.label ? `<text x="${x}" y="122" class="ht-lbl">${o.label}</text>` : ''}`;
};
const pedUrl = [0, 1].map((e) => pedestalUrl(e === 1));
const ped = (x: number, enemy = false) => `<image href="${pedUrl[enemy ? 1 : 0]}" x="${x - 23}" y="86" width="46" height="18" style="image-rendering:pixelated"/>`;

// 惰性组装说明页插图。
const howto = (): { title: string; lines: string[]; fig: string }[] => [
  {
    title: '轮转出手',
    lines: [
      '你和敌人各有 <b>5 个格位</b>，靠近中线的 <b>1 号位是队首</b>。',
      '每一拍，双方<b>各出手一名单位</b>，从队首往后<b>轮流</b>：第 1 拍 1 号、第 2 拍 2 号……轮完一圈再回到队首。',
      '阵亡留下空格，后面的单位<b>不会前移</b>；轮到空格时跳到下一个存活单位。战斗中头顶的<b>光标</b>和顶部的<b>出手顺序条</b>告诉你下一个出手的是谁。',
    ],
    fig: `<svg viewBox="70 -6 380 140">${[0, 1, 2].map((i) => ped(220 - i * 60)).join('')}${[0, 1, 2].map((i) => ped(300 + i * 60, true)).join('')}
      ${mini('m_rex', 220, { label: '①' })}${mini('l_priest', 160, { label: '②' })}${mini('n_merc', 100, { label: '③' })}
      ${mini('e_brute', 300, { enemy: true, label: '①' })}${mini('e_skel', 360, { enemy: true, label: '②' })}${mini('e_raider', 420, { enemy: true, label: '③' })}
      <path d="M232 46 Q260 18 288 46" class="ht-arc red"/><path d="M288 52 Q260 80 232 52" class="ht-arc red"/></svg>`,
  },
  {
    title: '普攻与施法',
    lines: [
      '卡面写着<b>「施法：」</b>的单位，轮到它时执行施法，<b>不普攻</b>；施法没有可用目标时改为普攻。',
      '其他单位轮到时<b>普攻</b>：默认打敌方队首，带<b>狙击</b>的打队尾。',
      '同一拍<b>先结算双方施法，再同时普攻</b>——施法可以抢先冻住或击杀对面的出手者，让它这次出手作废。',
      '战斗拖到第 20 拍后双方开始受<b>疲劳</b>伤害，逐拍递增。',
    ],
    fig: `<svg viewBox="70 -6 380 140">${[0, 1].map((i) => ped(220 - i * 90)).join('')}${ped(320, true)}
      ${mini('m_shaman', 130, { label: '施法' })}${mini('m_rex', 220, { label: '普攻' })}${mini('e_brute', 320, { enemy: true })}
      <path d="M132 36 Q226 -10 318 36" class="ht-arc purple"/><text x="226" y="12" class="ht-num">① 先</text>
      <path d="M232 50 Q276 30 310 50" class="ht-arc red"/><text x="276" y="62" class="ht-num">② 后</text></svg>`,
  },
  {
    title: '10 个关键词',
    lines: [
      '<b>格挡 / 护甲</b>：格挡抵消下一次伤害；护甲让每次伤害 −N（最少 1）。灼烧无视两者。',
      '<b>寒意 / 灼烧</b>：寒意削减下次出手的攻击，<b>寒意 ≥ 攻击时冻结</b>跳过出手；灼烧每拍结束掉血后 −1 层。',
      '<b>连击 / 溅射</b>：连击打两下各半伤，能连剥格挡；溅射顺带打目标身后一名。',
      '<b>狙击 / 反击</b>：狙击普攻打队尾；反击在被普攻直接命中时扎回去，连击每段都会被扎。',
      '<b>复生 / 法强</b>：复生第一次阵亡原位 1 血复活；法强让自己施法的数值 +N（群体效果减半）。点卡面上的关键词随时查看。',
    ],
    fig: `<svg viewBox="70 -6 380 140">${[0, 1, 2, 3].map((i) => ped(130 + i * 80)).join('')}
      ${mini('l_shield', 130, { label: '格挡' })}${mini('v_wall', 210, { label: '护甲' })}${mini('s_wind', 290, { label: '连击' })}${mini('m_rex', 370, { label: '溅射' })}</svg>`,
  },
  {
    title: '敌人会出题',
    lines: [
      '敌阵会针对某个关键词出题：格挡、护甲、寒意、狙击、溅射、反击、放逐……',
      '点击顶部的<b>路线节点</b>可以提前查看敌阵和题型，<b>提前为它调整阵型</b>。',
      '打输了也没关系：结算后点<b>「复盘」</b>，用同样的阵容换站位重打，找出正解。',
    ],
    fig: `<svg viewBox="70 -6 380 140">${[0, 1, 2].map((i) => ped(230 - i * 70)).join('')}${ped(320, true)}
      ${mini('e_silencer', 320, { enemy: true, label: '霜咒者' })}${mini('m_shaman', 230, { label: '1 被冻结', dim: true })}${mini('l_shield', 160, { label: '2' })}${mini('n_merc', 90, { label: '3' })}
      <path d="M318 36 Q274 0 234 36" class="ht-arc purple"/></svg>`,
  },
  {
    title: '远征',
    lines: [
      '远征共 <b>3 章 21 战</b>，每章有<b>两次商店</b>、一处<b>精英岔路</b>和一名<b>首领</b>。生命 3 条，击败首领恢复 1 条。',
      '胜利获得<b>金币</b>和<b>培养点</b>：点选下方的培养点再点单位，永久提升攻击、生命、格挡；「法」点给主将，提升将军技能。',
      '商店可买单位、<b>装备</b>、一次性<b>法术</b>和<b>招募令</b>；单位可出售换金。精英战胜利掉落装备三选一。',
      '首章首领、第二章岔路后、第二章首领后，主将各<b>升阶</b>一次，三选一获得被动。进度自动保存。',
    ],
    fig: `<svg viewBox="70 -6 380 140">${[0, 1, 2].map((i) => ped(160 + i * 100)).join('')}
      ${mini('n_merc', 160, { label: '培养' })}${mini('l_shield', 260, { label: '装备' })}${mini('m_rex', 360, { label: '升阶' })}</svg>`,
  },
];


