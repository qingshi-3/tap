/**
 * TapTap 宿主 / 浏览器边界。不因为桥上有别的方法就推断具备某能力。
 * 未确认的官方载入进度接口不伪造调用。
 */
export interface SafeInsets { top: number; right: number; bottom: number; left: number }
type TapWindow = { windowWidth?: number; windowHeight?: number; safeArea?: { left: number; right: number; top: number; bottom: number } };
type TapBridge = {
  getWindowInfo?: () => TapWindow;
  onHide?: (fn: () => void) => void;
  offHide?: (fn: () => void) => void;
  onShow?: (fn: () => void) => void;
  offShow?: (fn: () => void) => void;
};
const bridge = (): TapBridge | undefined => (globalThis as typeof globalThis & { tap?: TapBridge }).tap;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

export function readSafeInsets(): SafeInsets {
  const coarse = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
  const iphone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const defaults: SafeInsets = coarse
    ? { left: iphone ? 72 : 20, right: iphone ? 72 : 20, top: 44, bottom: iphone ? 28 : 16 }
    : { left: 18, right: 18, top: 18, bottom: 18 };
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;pointer-events:none;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.append(probe);
  const css = getComputedStyle(probe);
  const result: SafeInsets = {
    top: Math.max(defaults.top, parseFloat(css.paddingTop) || 0),
    right: Math.max(defaults.right, parseFloat(css.paddingRight) || 0),
    bottom: Math.max(defaults.bottom, parseFloat(css.paddingBottom) || 0),
    left: Math.max(defaults.left, parseFloat(css.paddingLeft) || 0),
  };
  probe.remove();
  try {
    const info = bridge()?.getWindowInfo?.();
    const safe = info?.safeArea;
    // 横屏下拒绝竖屏坐标或与实际视口不一致的系统信息。
    if (
      info && safe &&
      finite(info.windowWidth) && finite(info.windowHeight) &&
      Math.abs(info.windowWidth - innerWidth) < 4 && Math.abs(info.windowHeight - innerHeight) < 4 &&
      [safe.left, safe.right, safe.top, safe.bottom].every(finite) &&
      safe.right >= safe.left && safe.bottom >= safe.top &&
      safe.right <= innerWidth && safe.bottom <= innerHeight
    ) {
      result.left = Math.max(result.left, safe.left);
      result.right = Math.max(result.right, innerWidth - safe.right);
      result.top = Math.max(result.top, safe.top);
      result.bottom = Math.max(result.bottom, innerHeight - safe.bottom);
    }
  } catch {
    // 桥不可用时保留 env + 保守默认值，仍可游玩。
  }
  return result;
}

export function initPlatform(onPause: () => void): () => void {
  const pause = () => onPause();
  const hidden = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', hidden);
  window.addEventListener('blur', pause);
  let registered: TapBridge | undefined;
  let stopped = false;
  const register = () => {
    const tap = bridge();
    if (tap && tap !== registered) {
      registered?.offHide?.(pause);
      tap.onHide?.(pause);
      registered = tap;
    }
  };
  register();
  // 桥可能在 JS 模块之后注入；有界探测不阻塞游戏启动。
  let attempts = 0;
  const timer = window.setInterval(() => {
    if (stopped) return;
    register();
    if (registered || ++attempts >= 20) clearInterval(timer);
  }, 250);
  return () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', hidden);
    window.removeEventListener('blur', pause);
    registered?.offHide?.(pause);
  };
}

/** 未核实到官方 H5 原生载入进度接口，因此不伪造、不自绘启动页。 */
export function startupReady(): void { /* 载入过程由 TapTap 宿主自己负责。 */ }
export const platformCapabilities = { nativeStartupProgress: 'unconfirmed' as const };
