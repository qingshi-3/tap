const el = (tag, className, text = '') => {
  const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
};

export class PlatformProgressUI {
  constructor({ service, onChallengeStart, onChallengeResume, readChallenge = () => ({}) }) {
    this.service = service; this.epoch = 0;
    this.onChallengeStart = onChallengeStart; this.onChallengeResume = onChallengeResume; this.readChallenge = readChallenge;
    this.dialog = el('dialog', 'platform-progress-dialog'); this.dialog.id = 'platform-progress-dialog';
    this.dialog.setAttribute('aria-labelledby', 'platform-progress-title');
    const header = el('header', 'platform-progress-header');
    this.title = el('h2', '', '成就'); this.title.id = 'platform-progress-title';
    this.closeButton = el('button', '', '关闭'); this.closeButton.type = 'button';
    header.append(this.title, this.closeButton);
    this.body = el('div', 'platform-progress-body'); this.body.tabIndex = 0;
    this.status = el('p', 'platform-progress-status'); this.status.setAttribute('role', 'status');
    const footer = el('footer', 'platform-progress-actions');
    this.action = el('button', '', '打开排行榜'); this.action.type = 'button';
    this.retry = el('button', '', '重新同步'); this.retry.type = 'button';
    this.start = el('button', 'challenge-start is-primary', '开始挑战'); this.start.type = 'button';
    this.start.dataset.challengeAction = 'start';
    this.resume = el('button', 'challenge-resume', '继续挑战'); this.resume.type = 'button';
    this.resume.dataset.challengeAction = 'resume';
    footer.append(this.start, this.resume, this.retry, this.action); this.dialog.append(header, this.body, this.status, footer);
    document.body.append(this.dialog);
    this.closeButton.onclick = () => this.close();
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.action.onclick = () => void this.run('open');
    this.retry.onclick = () => void this.run('sync');
    this.start.onclick = () => { this.close(); this.onChallengeStart?.(); };
    this.resume.onclick = () => { this.close(); this.onChallengeResume?.(); };
    window.addEventListener('pagehide', () => this.close());
  }
  open(mode, opener) {
    this.epoch++; this.mode = mode; this.opener = opener; this.busy = false;
    this.title.textContent = mode === 'leaderboard' ? '远征挑战' : '成就';
    this.action.textContent = mode === 'leaderboard' ? '查看排行' : 'TapTap成就';
    this.retry.textContent = mode === 'leaderboard' ? '同步成绩' : '重新同步';
    this.status.textContent = mode === 'leaderboard'
      ? '借用卡池与0阶培养，不消耗你的资源。'
      : this.service.getAchievements().some(item => item.configured)
        ? '本机进度可查看；TapTap成就待发布。'
        : '本机达成进度可查看；TapTap成就尚未开放。';
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
    this.closeButton.focus({ preventScroll:true });
  }
  render() {
    this.body.replaceChildren();
    const isBoard = this.mode === 'leaderboard';
    if (isBoard) {
      const header = el('div', 'challenge-opponent');
      const portrait = el('img', ''); portrait.src = './assets/generals/general_portrait_image_f1.png'; portrait.alt = '阿杰农';
      header.append(portrait, el('strong', '', '阿杰农 · 铁崖封锁')); this.body.append(header);
      const best = this.readChallenge().bestResult;
      this.body.append(el('p', 'platform-progress-score', best ? `最高 ${best.score} 分` : '暂无挑战成绩'));
      if (best) this.body.append(el('p', 'challenge-best-details', `${best.round} 回合 · 阵亡 ${best.deaths} · 主将 ${best.health} 生命`));
      this.body.append(el('p', 'challenge-score-rule', '胜利计分：100000－回合×1000－随从阵亡×25＋主将生命×5。'));
    } else {
      const list = el('ul', 'achievement-list');
      for (const item of this.service.getAchievements()) {
        const row = el('li', item.achieved ? 'is-achieved' : '');
        row.append(el('span', '', item.name), el('strong', '', item.achieved ? '✓ 已达成' : `${item.progress} / ${item.target}`));
        list.append(row);
      }
      this.body.append(list);
    }
    const configured = this.service.getAchievements().some(item => item.configured);
    this.start.hidden = !isBoard; this.start.disabled = this.busy || !this.onChallengeStart;
    this.resume.hidden = !isBoard || !this.readChallenge().hasResume; this.resume.disabled = this.busy;
    this.action.classList.toggle('is-primary', !isBoard);
    this.action.disabled = this.busy || (!isBoard && !configured);
    this.retry.hidden = isBoard ? !this.readChallenge().bestResult : !configured;
    this.retry.disabled = this.busy;
  }
  async run(action) {
    if (this.busy) return;
    const epoch = this.epoch; this.busy = true; this.render();
    this.status.textContent = action === 'sync' ? '正在同步…' : '正在打开…';
    let result;
    try {
      result = this.mode === 'leaderboard'
        ? await (action === 'sync' ? this.service.syncLeaderboard({force:true}) : this.service.openLeaderboard())
        : await (action === 'sync' ? this.service.syncAchievements() : this.service.showAchievements());
    } catch { result = {ok:false,error:'暂时无法连接TapTap，请稍后重试。'}; }
    if (epoch !== this.epoch || !this.dialog.open) return;
    this.busy = false;
    this.status.textContent = result?.ok
      ? action === 'sync' ? result.skipped ? '当前没有需要同步的新成绩。' : '成绩已同步。' : '已交由TapTap打开。'
      : result?.error || '暂时无法连接TapTap，请稍后重试。';
    this.render();
  }
  close() {
    this.epoch++; this.busy = false;
    if (!this.dialog.open) return;
    this.dialog.close();
    const opener = this.opener?.isConnected ? this.opener : document.querySelector(`[data-action="${this.mode === 'leaderboard' ? 'leaderboard' : 'achievements'}"]`);
    opener?.focus({preventScroll:true});
  }
}
