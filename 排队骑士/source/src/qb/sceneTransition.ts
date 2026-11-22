import { clearFrame, composite, createFrame, createFx } from '../vendor/pixelfx/src/core/index.js';
import * as slash from '../vendor/pixelfx/src/fx/transitions/slash-wipe.js';
import './css/scene-transition.css';

const DURATION = 560, MID = 0.8, END = 1.7;
const inputEvents = ['pointerdown', 'pointerup', 'pointermove', 'click', 'dblclick', 'contextmenu', 'touchstart', 'touchend', 'wheel', 'keydown', 'keyup', 'keypress'] as const;
type Options = { rate?: number; ready?: () => void; animate?: boolean };

export class SceneTransition {
  private active: (() => void) | null = null;
  private keyboardInput = false;
  constructor(private readonly stage: HTMLElement) {
    document.addEventListener('keydown', () => { this.keyboardInput = true; }, true);
    document.addEventListener('pointerdown', () => { this.keyboardInput = false; }, true);
  }
  get busy(): boolean { return this.active !== null; }
  cancel(): void { this.active?.(); }

  run(swap: () => void, options: Options = {}): Promise<boolean> {
    if (this.busy) return Promise.resolve(false);
    const keyboardFocus = this.keyboardInput || (document.activeElement instanceof HTMLElement && this.stage.contains(document.activeElement) && document.activeElement.matches(':focus-visible'));
    const focus = () => {
      if (!keyboardFocus || this.busy) return;
      const targets = Array.from(this.stage.querySelectorAll<HTMLElement>('button:not(:disabled), [role="button"]:not([aria-disabled="true"]), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'));
      const visible = (e: HTMLElement) => {
        if (e.closest('[inert], [hidden], [aria-hidden="true"]') || !e.getClientRects().length) return false;
        for (let node: HTMLElement | null = e; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
        }
        // A round-start choice may cover the board before ready returns. Focus
        // a reachable control in that choice instead of a button behind it.
        const rect = e.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return !!hit && e.contains(hit);
      };
      const target = targets.find(e => e.matches('button.primary') && visible(e)) ?? targets.find(visible);
      target?.focus({ preventScroll: true });
    };
    const immediate = () => {
      const owner = () => {};
      this.active = owner;
      try { swap(); }
      catch (error) { console.error('Scene transition swap failed', error); if (this.active === owner) this.active = null; return Promise.resolve(false); }
      if (this.active === owner) this.active = null;
      try { options.ready?.(); focus(); return Promise.resolve(true); }
      catch (error) { console.error('Scene transition ready failed', error); return Promise.resolve(false); }
    };
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (options.animate === false || document.hidden || media?.matches) return immediate();

    // Allocate everything that can fail before changing the stage or blocking input.
    let canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, frame: ReturnType<typeof createFrame>, pixels: ImageData, fx: ReturnType<typeof createFx>;
    try {
      canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
      const ctx = canvas.getContext('2d');
      if (!ctx) return immediate();
      context = ctx; frame = createFrame(320, 180); pixels = context.createImageData(320, 180);
      fx = createFx(slash, { color: '#0b1020', light: 0.45 });
    } catch (error) { console.error('Scene transition setup failed; using immediate transition', error); return immediate(); }

    const originalPosition = this.stage.style.position;
    const inert = Array.from(this.stage.children).filter((e): e is HTMLElement => e instanceof HTMLElement).map(e => [e, e.inert] as const);
    const rate = Number.isFinite(options.rate) ? Math.max(1, options.rate!) : 1;
    const span = DURATION / rate;
    let elapsedFx = 0, swapped = false, raf = 0, timer = 0, settled = false;
    const started = performance.now();
    const block = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); };
    return new Promise<boolean>(resolve => {
      const cleanup = () => {
        cancelAnimationFrame(raf); clearTimeout(timer);
        document.removeEventListener('visibilitychange', onVisibility);
        media?.removeEventListener('change', onMotion);
        inputEvents.forEach(type => document.removeEventListener(type, block, true));
        canvas.remove(); inert.forEach(([e, value]) => { e.inert = value; });
        this.stage.style.position = originalPosition;
        if (this.active === cancel) this.active = null;
      };
      const finish = (success: boolean) => {
        if (settled) return;
        settled = true; cleanup();
        if (success) {
          try { options.ready?.(); focus(); }
          catch (error) { console.error('Scene transition ready failed', error); success = false; }
        }
        resolve(success);
      };
      const cancel = () => finish(false);
      const completeNow = () => {
        if (settled) return;
        try { if (!swapped) { swapped = true; swap(); } }
        catch (error) { console.error('Scene transition swap failed', error); finish(false); return; }
        finish(true);
      };
      const onVisibility = () => { if (document.hidden) completeNow(); };
      const onMotion = () => { if (media?.matches) completeNow(); };
      const draw = (t: number) => {
        fx.update(Math.max(0, t - elapsedFx)); elapsedFx = t;
        clearFrame(frame); fx.draw(frame); composite(frame, pixels.data, null); context.putImageData(pixels, 0, 0);
      };
      const tick = (now: number) => {
        if (settled) return;
        try {
          const t = Math.min(END, Math.max(0, (now - started) / span * END));
          if (!swapped && t >= MID) {
            draw(MID);
            // Present the opaque frame before changing the DOM, even after a dropped frame.
            raf = requestAnimationFrame(() => {
              if (settled) return;
              try { swapped = true; swap(); if (!settled) raf = requestAnimationFrame(tick); }
              catch (error) { console.error('Scene transition swap failed', error); finish(false); }
            });
            return;
          }
          draw(t);
          if (t >= END) finish(true);
          else raf = requestAnimationFrame(tick);
        } catch (error) { console.error('Scene transition drawing failed; completing immediately', error); completeNow(); }
      };
      this.active = cancel;
      try {
        if (getComputedStyle(this.stage).position === 'static') this.stage.style.position = 'relative';
        inert.forEach(([e]) => { e.inert = true; });
        canvas.className = 'qb-scene-transition'; canvas.setAttribute('aria-hidden', 'true'); this.stage.append(canvas);
        inputEvents.forEach(type => document.addEventListener(type, block, { capture: true, passive: false }));
        document.addEventListener('visibilitychange', onVisibility); media?.addEventListener('change', onMotion);
        timer = window.setTimeout(completeNow, Math.max(1000, span * 3));
        draw(0); raf = requestAnimationFrame(tick);
      } catch (error) { console.error('Scene transition setup failed; completing immediately', error); completeNow(); }
    });
  }
}
