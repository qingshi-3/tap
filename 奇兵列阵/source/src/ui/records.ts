import '../records.css';
import { loadCareer } from '../core/career';
import { getAchievementProgress } from '../core/achievements';
import { BOARD_DEFS, getBoardScores } from '../core/leaderboards';
import { h } from './dom';
import { icon } from './icons';
import { sfx } from './audio';

type Board = (typeof BOARD_DEFS)[number];
type BoardGroup = '全部' | '总榜' | '主将' | '挑战' | '成就';

/** 打开时读取同一份本地记录；屏幕不驱动战局记录、奖励或后台轮询。 */
export function recordsScreen(onBack: () => void, onOpenBoard: (key: string) => Promise<void>): HTMLElement {
  const profile = loadCareer();
  const achievements = getAchievementProgress(profile);
  const scores = new Map(getBoardScores(profile).map(score => [score.key, score]));
  let active: 'boards' | 'achievements' = 'boards';
  let boardGroup: BoardGroup = '全部';
  let category = '全部类别';
  let completion = '全部';
  const body = h('div', { class: 'records-list', tabindex: 0, 'aria-label': '排行榜列表' });
  const controls = h('div', { class: 'records-controls' });
  const message = h('p', { class: 'records-message', role: 'status', hidden: true });
  const setMessage = (text: string) => {
    message.textContent = text;
    message.hidden = !text;
  };
  const click = (action: () => void) => () => { sfx.click(); action(); };
  const boardTab = h('button', { class: 'records-button records-tab', type: 'button', onclick: click(() => show('boards')) }, '排行榜');
  const achievementTab = h('button', { class: 'records-button records-tab', type: 'button', onclick: click(() => show('achievements')) }, '成就');

  const select = (label: string, options: string[], value: string, changed: (value: string) => void) => {
    const input = h('select', { class: 'records-select', 'aria-label': label }, options.map(option =>
      h('option', { value: option, selected: option === value }, option)));
    input.addEventListener('change', () => { sfx.click(); changed(input.value); renderRows(); });
    return input;
  };
  function renderRows() {
    if (active === 'boards') {
      body.replaceChildren(...BOARD_DEFS.filter(board => boardGroup === '全部' || groupOf(board) === boardGroup).map(board => {
        const score = scores.get(board.key);
        const open = h('button', {
          class: 'records-button records-open', type: 'button', 'aria-label': `在 TapTap 打开${board.title}`,
          disabled: !board.platformId,
          onclick: async () => {
            sfx.click();
            open.disabled = true;
            open.textContent = '打开中';
            setMessage('');
            try { await onOpenBoard(board.key); }
            catch (error) { setMessage(error instanceof Error ? error.message : '排行榜暂时无法打开，请稍后再试'); }
            finally { open.disabled = false; open.textContent = 'TapTap 榜单'; }
          },
        }, board.platformId ? 'TapTap 榜单' : '待开通');
        return h('article', { class: 'records-board-row' },
          h('div', { class: 'records-entry' },
            h('h2', { class: 'records-name' }, board.title),
            h('p', { class: 'records-condition' }, board.description)),
          h('div', { class: 'records-board-result' },
            h('span', { class: `records-score${score ? '' : ' records-no-score'}` }, score ? `本地 ${formatScore(score.value, score.unit)}` : '暂无达标成绩'),
            open));
      }));
    } else {
      const filtered = achievements.filter(item => (category === '全部类别' || item.category === category)
        && (completion === '全部' || (completion === '已完成' ? item.completed : !item.completed)));
      body.replaceChildren(...filtered.map(item => {
        const current = Math.min(item.target, Math.max(0, item.current));
        return h('article', { class: `records-achievement-row${item.completed ? ' is-complete' : ''}` },
          h('div', { class: 'records-entry' },
            h('h2', { class: 'records-name' }, item.completed ? icon('check') : null, item.name),
            h('p', { class: 'records-condition' }, item.description),
            h('progress', { class: 'records-progress', max: item.target, value: current, 'aria-label': `${item.name}进度 ${number(current)} / ${number(item.target)}` })),
          h('div', { class: 'records-achievement-result' },
            h('b', { class: 'records-points' }, `${item.points} 积分`),
            h('span', { class: 'records-progress-text' }, item.completed ? '已完成' : `${number(current)} / ${number(item.target)}`)));
      }));
      if (!filtered.length) body.append(h('p', { class: 'records-empty', role: 'status' }, '没有符合筛选的成就'));
    }
    body.scrollTop = 0;
  }
  function show(tab: typeof active) {
    active = tab;
    setMessage('');
    boardTab.classList.toggle('is-active', tab === 'boards');
    achievementTab.classList.toggle('is-active', tab === 'achievements');
    boardTab.setAttribute('aria-pressed', String(tab === 'boards'));
    achievementTab.setAttribute('aria-pressed', String(tab === 'achievements'));
    body.setAttribute('aria-label', tab === 'boards' ? '排行榜列表' : '成就列表');
    if (tab === 'boards') {
      controls.replaceChildren(select('排行榜类别', ['全部', '总榜', '主将', '挑战', '成就'], boardGroup, value => { boardGroup = value as BoardGroup; }),
        h('p', { class: 'records-summary' }, `通关 ${number(profile.totals.wins)} / ${number(profile.totals.played)} 局　最高连胜 ${number(profile.totals.bestStreak)}`));
    } else {
      controls.replaceChildren(
        select('成就类别', ['全部类别', ...new Set(achievements.map(item => item.category))], category, value => { category = value; }),
        select('完成状态', ['全部', '已完成', '未完成'], completion, value => { completion = value; }),
        h('p', { class: 'records-summary' }, `${achievements.filter(item => item.completed).length} / ${achievements.length} 已完成　${number(profile.achievementPoints)} 积分`));
    }
    renderRows();
  }
  const screen = h('section', { class: 'screen records', 'aria-label': '战绩与成就' },
    h('header', { class: 'records-head' },
      h('button', { class: 'records-button records-back', type: 'button', onclick: click(onBack) }, icon('x'), '返回'),
      h('nav', { class: 'records-tabs', 'aria-label': '战绩浏览' }, boardTab, achievementTab)),
    controls,
    profile.storageStatus !== 'ok' ? h('p', { class: 'records-storage-warning', role: 'status' }, profile.storageStatus === 'corrupt'
      ? '本地战绩无法读取，原记录已保留。当前页面不代表历史成绩。'
      : '当前无法保存本地战绩，离开后成绩可能丢失。') : null,
    message, body);
  show('boards');
  return screen;
}

function groupOf(board: Board): Exclude<BoardGroup, '全部'> {
  if (board.key.startsWith('general_')) return '主将';
  if (['totalWins', 'winRate', 'bestStreak'].includes(board.key)) return '总榜';
  if (board.key === 'achievementPoints') return '成就';
  return '挑战';
}
const number = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
function formatScore(value: number, unit: string): string {
  return `${number(value)}${unit === '%' ? '' : ' '}${unit}`;
}


