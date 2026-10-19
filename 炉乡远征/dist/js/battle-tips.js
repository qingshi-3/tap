// Keep this library tied to gestures the battle actually supports.
export const BATTLE_TIPS = Object.freeze([
  '拖动卡牌进行使用',
  '拖动随从卡牌指定位置部署',
  '无目标法术拖入战场释放',
  '短按单位查看移动范围',
  '长按单位查看详细说明',
  '拖动单位到空格进行移动',
  '选中己方单位，点击范围内敌人攻击',
  '拖入下方红区取消操作',
  '点击空白处收起单位范围',
]);

export function createBattleTips({ root }) {
  const element = document.createElement('div');
  element.className = 'battle-tips';
  element.hidden = true;
  // Ambient instructions should not repeatedly interrupt screen-reader output.
  element.setAttribute('aria-live', 'off');
  const text = document.createElement('span');
  text.className = 'battle-tips-text';
  element.append(text);
  root.append(element);
  let index = 0, timer = null, visible = false, animation = null, contextText = null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  text.textContent = BATTLE_TIPS[index];
  const stop = () => { clearInterval(timer); timer = null; animation?.cancel(); animation = null; };
  const rotate = () => {
    index = (index + 1) % BATTLE_TIPS.length;
    text.textContent = BATTLE_TIPS[index];
    animation?.cancel();
    if (!reducedMotion.matches && text.animate) {
      animation = text.animate([
        { transform: 'translateY(7px)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ], { duration: 180, easing: 'ease-out' });
    }
  };
  const resume = () => {
    stop();
    if (visible && !document.hidden && !contextText) timer = setInterval(rotate, 3000);
  };
  document.addEventListener('visibilitychange', resume);
  const motionChanged = () => { if (reducedMotion.matches) animation?.cancel(); };
  reducedMotion.addEventListener('change', motionChanged);
  return {
    element,
    setContext(value) {
      value = value || null;
      if (value === contextText) return;
      contextText = value;
      text.textContent = contextText || BATTLE_TIPS[index];
      resume();
    },
    setVisible(value) {
      value = Boolean(value);
      if (value === visible) return;
      visible = value;
      element.hidden = !value;
      resume();
    },
    destroy() {
      visible = false;
      stop();
      document.removeEventListener('visibilitychange', resume);
      reducedMotion.removeEventListener('change', motionChanged);
      element.remove();
    },
  };
}
