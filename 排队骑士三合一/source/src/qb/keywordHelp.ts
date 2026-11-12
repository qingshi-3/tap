import { KW_INFO } from '../core/data';
import './css/keyword-help.css';

/** Short contextual help. Tokens stay passive until their detail scope opts in. */
export const KEYWORD_HELP: Record<string, string> = {
  猎标: '每次交锋结束，每层造成 1 点伤害；目标阵亡后传给最近身后敌人，再增加 1 层，最多 99 层。',
  传承: '阵亡后把卡面比例的攻击、生命上限交给最近身后友军，并传递一个可继承的阵亡技能；同来源技能每人保留一份，最多接收 3 个来源。',
  补给传承: '记录最早直接吃到的 5 件指定补给。出售后交给最近身后友军，身后无人则交给最近身前；接收者重吃记录中的补给；从手牌出售时交给上阵队尾。',
  蓄能: '蓄能由各单位分别积攒，最多 999 点。释放时消耗自己的全部蓄能，按卡面倍率造成伤害。',
  成为队首: '开战站在队首时触发；推进或轮转后再次成为队首，也会触发。次数按卡面计算。',
  轮转: '队首退到队尾，下一名友军接战；至少有两名存活友军时执行。每次成功轮转计入全队轮转次数。',
  退到队尾: '队首退到队尾，下一名友军接战；至少有两名存活友军时执行。',
  圈数: '全队成功轮转次数除以开战时我方人数，向下取整。',
  首击: '下一场首次普通攻击后，对同一个敌人追加伤害。多次获得的数值累加，首次攻击时消耗。',
  格挡: KW_INFO.block.desc,
  复生: KW_INFO.reborn.desc,
  溅射: KW_INFO.splash.desc,
  喂食: '本回合按直接吃到补给的人数计次，入场喂面包也计入。分享、传承重吃和重复效果各自沿用原次数。',
  分担: '交锋伤害的一部分由护卫承受，再从原目标伤害中扣除；目标与每次上限按卡面执行。目标有格挡时优先消耗目标的格挡。',
  相邻: '紧挨着自己的身前、身后友军；空位和队伍两端按实际位置判断。',
  同名相邻: '相邻且同名的两名存活友军形成搭档；普通与金色视为同名。每条相邻连接各计一对。',
  搭档: '自己相邻的同名友军；两侧都有搭档时，优先选择身前的那一名。',
  相邻队形: '开战时相邻的两名友军，存活且仍按原前后顺序紧邻时，保留这一组相邻关系。',
  献血: '在已上阵单位详情中主动献出 1 点永久生命，获得卡面收益；每卡每回合限次，最低保留 1 生命。',
  召唤: '在卡面指定位置放入召唤物；我方最多容纳 5 名单位。',
  发现: '从给出的候选中选择一张，领取到手牌或卡面指定位置。',
  合巢: '队伍满员时，把这次召唤物的攻击、生命并给已有的首个友方小兵。',
  猎物: '备战时指定的敌方初始位置；该位置缺席时改为敌方队首。',
};

export const KEYWORD_ALIASES: Record<string, string> = {
  全队每转完一圈: '圈数', 已继承: '传承', 继承: '传承', 献出: '献血', 传承已记录补给: '补给传承', 传承补给: '补给传承', 出售补给单位时传承: '补给传承', 薪火传承: '传承', 补给传承: '补给传承', 传承重吃: '补给传承', 成为队首时: '成为队首', 退到队尾: '退到队尾',
  原本前后紧邻: '相邻队形', 相邻同名友军: '同名相邻', 同名相邻的友军: '同名相邻', 同名搭档: '搭档', 同名友军: '同名相邻', 同名相邻: '同名相邻', 原始相邻: '相邻队形', 相邻队形: '相邻队形',
  喂食: '喂食', 吃补给: '喂食', 主动献血: '献血', 备战献血: '献血', 下次攻击后追加: '首击',
};

export function markKeyword(el: HTMLElement, term: string, explanation?: string) {
  const key = KEYWORD_ALIASES[term] ?? term;
  const help = explanation ?? KEYWORD_HELP[key];
  if (help) { el.dataset.keyword = key; el.dataset.keywordExplanation = help; }
  return el;
}

let active: { token: HTMLElement; panel: HTMLElement; scope: HTMLElement } | null = null;
let nextId = 0;
const change = (scope: HTMLElement) => scope.dispatchEvent(new CustomEvent('tipcontentchange', { bubbles: true }));

export function closeKeywordHelp(scope?: HTMLElement) {
  if (!active || (scope && !scope.contains(active.token) && scope !== active.scope)) return;
  const last = active;
  active = null;
  last.token.setAttribute('aria-expanded', 'false');
  last.token.removeAttribute('aria-controls');
  last.panel.remove();
  change(last.scope);
}

/** Enable only a detail/encyclopedia scope, never a draggable shop-card surface. */
export function enableKeywordHelp(scope: HTMLElement) {
  scope.dataset.keywordHelp = 'true';
  for (const token of scope.querySelectorAll<HTMLElement>('[data-keyword]')) {
    // A timing capsule may contain a mechanism. Keep a single accessible target.
    if (token.parentElement?.closest('[data-keyword]')) continue;
    token.setAttribute('role', 'button');
    token.tabIndex = 0;
    token.setAttribute('aria-expanded', String(active?.token === token));
    token.dataset.keywordLabel ??= token.getAttribute('aria-label') ?? token.textContent ?? token.dataset.keyword;
    token.setAttribute('aria-label', `${token.dataset.keywordLabel}，查看释义`);
  }
  installListeners();
  return scope;
}

function targetOf(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const token = target.closest<HTMLElement>('[data-keyword][role="button"]');
  const scope = token?.closest<HTMLElement>('[data-keyword-help="true"]');
  return token && scope ? { token, scope } : null;
}

function showExplanation(token: HTMLElement, scope: HTMLElement) {
  if (!token.isConnected) return;
  const same = active?.token === token;
  closeKeywordHelp();
  if (same) return;
  const panel = document.createElement('div');
  panel.className = 'keyword-explanation';
  panel.id = `keyword-explanation-${++nextId}`;
  panel.setAttribute('role', 'status');
  const copy = document.createElement('span');
  const name = document.createElement('strong');
  name.textContent = `${token.dataset.keyword} · `;
  copy.append(name, token.dataset.keywordExplanation ?? '');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'keyword-explanation-close';
  close.textContent = '关闭';
  close.setAttribute('aria-label', '关闭关键词释义');
  close.addEventListener('click', (event) => { event.stopPropagation(); closeKeywordHelp(); token.focus({ preventScroll: true }); });
  panel.append(copy, close);
  const paragraph = token.closest<HTMLElement>('.tip-text, .tip-traits, .tfm-head, [data-keyword-paragraph]');
  if (paragraph && scope.contains(paragraph)) paragraph.after(panel);
  else token.parentElement?.after(panel);
  token.setAttribute('aria-expanded', 'true');
  token.setAttribute('aria-controls', panel.id);
  active = { token, panel, scope };
  change(scope);
}

let installed = false;
function installListeners() {
  if (installed) return;
  installed = true;
  // Capture before stage drag handlers and tooltip dismissal. Pointerdown never
  // reaches a shop/board action; click and keyboard share one activation path.
  document.addEventListener('pointerdown', (event) => {
    const found = targetOf(event.target);
    if (found) { event.stopImmediatePropagation(); event.preventDefault(); found.token.focus({ preventScroll: true }); return; }
    if (active && !active.panel.contains(event.target as Node)) closeKeywordHelp();
  }, true);
  document.addEventListener('click', (event) => {
    const found = targetOf(event.target);
    if (!found) return;
    event.preventDefault(); event.stopImmediatePropagation();
    showExplanation(found.token, found.scope);
  }, true);
  document.addEventListener('keydown', (event) => {
    if (active && !active.token.isConnected) closeKeywordHelp();
    if (event.key === 'Escape' && active) { const token = active.token; closeKeywordHelp(); token.focus({ preventScroll: true }); event.stopImmediatePropagation(); return; }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const found = targetOf(event.target);
    if (!found) return;
    event.preventDefault(); event.stopImmediatePropagation();
    showExplanation(found.token, found.scope);
  }, true);
}
