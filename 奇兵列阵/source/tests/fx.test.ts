import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/ui/dom', () => ({ STAGE_W: 1280, STAGE_H: 720, h: (tag: string) => makeNode(tag) }));
import { ambient, FX } from '../src/ui/fx';
const contexts: any[] = [], nodes: any[] = [], animations: any[] = [];
function makeNode(tag = 'div'): any {
 const ctx = { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn() };
 const node: any = { tag, width: 0, height: 0, children: [], append(...xs: any[]) { this.children.push(...xs); }, appendChild(x: any) { this.children.push(x); }, replaceChildren() { this.children = []; }, remove: vi.fn(), getContext: () => ctx, animate: () => { const a = { pause: vi.fn(), play: vi.fn(), cancel: vi.fn(), onfinish: null }; animations.push(a); return a; } };
 nodes.push(node); contexts.push(ctx); return node;
}
let now = 0, id = 0, queue: Map<number, FrameRequestCallback>, doc: EventTarget & { hidden: boolean };
function advance(ms: number) { now += ms; const current = [...queue.values()]; queue.clear(); current.forEach(cb => cb(now)); }
beforeEach(() => {
 now = 0; id = 0; queue = new Map(); contexts.length = nodes.length = animations.length = 0;
 doc = Object.assign(new EventTarget(), { hidden: false });
 vi.stubGlobal('document', doc); vi.stubGlobal('window', { devicePixelRatio: 3 });
 vi.stubGlobal('performance', { now: () => now });
 vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queue.set(++id, cb); return id; });
 vi.stubGlobal('cancelAnimationFrame', (n: number) => queue.delete(n));
 vi.spyOn(Math, 'random').mockReturnValue(0.5);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('ambient draws half-resolution at 20fps and resets time after hidden/manual pause', () => {
 const canvas = makeNode('canvas'), ctx = contexts.at(-1), control = ambient(canvas);
 expect([canvas.width, canvas.height]).toEqual([640, 360]);
 for (let i = 0; i < 60; i++) advance(1000 / 60);
 expect(ctx.clearRect.mock.calls.length).toBe(20);
 doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); expect(queue.size).toBe(0);
 advance(100000); doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
 const before = ctx.fillRect.mock.calls.length; advance(16); expect(ctx.fillRect.mock.calls.length).toBe(before);
 control.setPaused(true); expect(queue.size).toBe(0); control.setPaused(false); advance(50);
 expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(before);
 control.dispose(); expect(queue.size).toBe(0);
 doc.dispatchEvent(new Event('visibilitychange')); expect(queue.size).toBe(0);
});
it('FX budgets drawing at 30fps while particle lifespan remains measured in real time', () => {
 const root = makeNode(), target = makeNode(), fx = new FX(root, target), ctx = fx.canvas.getContext('2d')!;
 expect(fx.canvas.width).toBe(1600);
 fx.ring(100, 100, '#fff', 20, 60);
 advance(1000 / 60); expect(ctx.fillRect).not.toHaveBeenCalled();
 for (let i = 1; i < 60; i++) advance(1000 / 60);
 expect(queue.size).toBe(0);
 expect(vi.mocked(ctx.clearRect).mock.calls.length).toBeLessThanOrEqual(32);
 fx.dispose();
});
it('clear cancels only owned layer effects and shake; pause freezes owned animations', () => {
 const root = makeNode(), target = makeNode(), unrelated = target.animate(), fx = new FX(root, target);
 fx.float(0, 0, '3', 'damage'); fx.flash(); fx.shake(); fx.ring(0, 0, '#fff');
 const owned = animations.slice(1); fx.setPaused(true);
 owned.forEach(a => expect(a.pause).toHaveBeenCalled()); expect(queue.size).toBe(0);
 advance(100000); fx.setPaused(false); advance(16); expect(queue.size).toBe(1);
 fx.clear(); expect(queue.size).toBe(0); expect(fx.layer.children.length).toBe(0);
 owned.forEach(a => expect(a.cancel).toHaveBeenCalledOnce()); expect(unrelated.cancel).not.toHaveBeenCalled();
 fx.dispose();
});
