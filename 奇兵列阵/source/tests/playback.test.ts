import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BattleEvent, BattleOutput, Snap } from '../src/core/types';
import type { Board } from '../src/ui/board';
import type { FX } from '../src/ui/fx';

const fake = vi.hoisted(() => {
  const animations: { duration: number; playbackRate: number; cancel: () => void; finished: Promise<void>; pause: () => void; play: () => void; playState: string; pending: boolean }[] = [];
  class Element {
    removed = false;
    classList = { remove: vi.fn() };
    children: Element[] = [];
    idle = { animationName: 'idle', playbackRate: 1 };
    own: typeof animations = [];
    appendChild(el: Element) { this.children.push(el); return el; }
    remove() { this.removed = true; }
    getAnimations() { return [this.idle, ...this.own]; }
    animate(_frames: unknown, options: { duration: number }) {
      let resolve!: () => void;
      let reject!: (error: Error) => void;
      const finished = new Promise<void>((a, b) => { resolve = a; reject = b; });
      let remaining = options.duration;
      let started = Date.now();
      let timer: ReturnType<typeof setTimeout>;
      const finish = () => { animation.playState = 'finished'; resolve(); animation.onfinish?.(); };
      const animation = { duration: options.duration, playbackRate: 1, finished, onfinish: null as (() => void) | null,
        playState: 'running', pending: false,
        pause: () => { if (animation.playState !== 'running') return; remaining -= Date.now() - started; clearTimeout(timer); animation.playState = 'paused'; },
        play: () => { animation.playState = 'running'; started = Date.now(); timer = setTimeout(finish, remaining); },
        cancel: () => { clearTimeout(timer); animation.playState = 'idle'; reject(new Error('cancelled')); } };
      timer = setTimeout(finish, remaining);
      this.own.push(animation);
      animations.push(animation);
      return animation;
    }
  }
  class Unit {
    el = new Element();
    body = this.el;
    constructor(..._args: unknown[]) {}
    setStats = vi.fn();
    hit() { this.el.animate([], { duration: 280 }); }
  }
  return { Element, Unit, animations, sfx: { freeze: vi.fn(), start: vi.fn(), whoosh: vi.fn(), beat: vi.fn(), buff: vi.fn(), hit: vi.fn() } };
});
vi.mock('../src/ui/audio', () => ({ sfx: fake.sfx }));
vi.mock('../src/ui/dom', () => ({ h: () => new fake.Element() }));
vi.mock('../src/ui/board', () => ({
  UnitView: fake.Unit,
  statsOf: (unit: unknown) => unit,
  bodyPos: (_side: number, slot: number) => ({ x: slot * 110, y: 200 }),
  headPos: (_side: number, slot: number) => ({ x: slot * 110, y: 130 }),
}));
import { Playback } from '../src/ui/playback';

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function fixture(events: BattleEvent[], initial: Snap = []) {
  const views = new Map<string, InstanceType<typeof fake.Unit>>();
  const board = { el: new fake.Element(), center: new fake.Element(),
    clearUnits: vi.fn(() => views.clear()), add: (key: string, value: InstanceType<typeof fake.Unit>) => views.set(key, value),
    view: (key: string) => views.get(key), clearArrows: vi.fn(), setCenter: vi.fn(), setPips: vi.fn(), setOrder: vi.fn(), views };
  const fx = { layer: new fake.Element(), burst: vi.fn(), float: vi.fn(), ring: vi.fn(), shake: vi.fn(), flash: vi.fn() };
  const out = { initial, afterStart: initial, log: events.map((ev) => ({ ev, snap: initial })), beats: 4, result: 'win' } as BattleOutput;
  const playback = new Playback(board as unknown as Board, fx as unknown as FX, out);
  return { playback, board, fx, out };
}
const units = [{ uid: 1, alive: true, defId: 'l_shield', side: 0, slot: 0, level: 1 },
  { uid: 2, alive: true, defId: 'l_priest', side: 0, slot: 1, level: 1 }] as Snap;
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.clearAllMocks(); fake.animations.length = 0; });

describe('battle playback ownership and cancellation', () => {
  it('preserves a partially elapsed event wait while paused and resumes the same battle', async () => {
    vi.useFakeTimers();
    const f = fixture([{ t: 'beat', n: 1, next: { player: [], enemy: [] } }, { t: 'beat', n: 2, next: { player: [], enemy: [] } }]);
    const done = vi.fn();
    const playing = f.playback.play().then(done);
    await flush();
    await vi.advanceTimersByTimeAsync(60);
    f.playback.setPaused(true);
    expect(fake.animations[0].playState).toBe('paused');
    await vi.advanceTimersByTimeAsync(5000);
    expect(fake.sfx.beat).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
    f.playback.setPaused(false);
    expect(fake.animations[0].playState).toBe('running');
    await vi.advanceTimersByTimeAsync(99);
    expect(fake.sfx.beat).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fake.sfx.beat).toHaveBeenCalledTimes(2);
    await vi.runAllTimersAsync();
    await playing;
    expect(f.playback.cancelled).toBe(false);
  });

  it('blocks a projectile impact until resume, then keeps its remaining flight time', async () => {
    vi.useFakeTimers();
    const f = fixture([{ t: 'buff', src: 1, tgt: 2, atk: 1, hp: 1 }], units);
    const playing = f.playback.play();
    await vi.advanceTimersByTimeAsync(100);
    f.playback.setPaused(true);
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.fx.burst).not.toHaveBeenCalled();
    expect(fake.sfx.buff).not.toHaveBeenCalled();
    f.playback.setPaused(false);
    await vi.advanceTimersByTimeAsync(239);
    expect(f.fx.burst).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fake.sfx.buff).toHaveBeenCalledOnce();
    await vi.runAllTimersAsync();
    await playing;
  });

  it('cancellation releases a paused battle and public lifecycle gates immediately', async () => {
    vi.useFakeTimers();
    const f = fixture([{ t: 'beat', n: 1, next: { player: [], enemy: [] } }]);
    f.playback.setPaused(true);
    const playing = f.playback.play();
    const gate = f.playback.waitUntilResumed();
    f.playback.cancel();
    await Promise.all([playing, gate]);
    expect(f.playback.finished).toBe(true);
    expect(fake.sfx.beat).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancel before play is idempotent and cannot become a skipped battle', async () => {
    const f = fixture([{ t: 'beat', n: 1, next: { player: [], enemy: [] } }]);
    f.playback.skip();
    f.playback.cancel();
    f.playback.cancel();
    await f.playback.play();
    expect(f.board.clearUnits).not.toHaveBeenCalled();
    expect(f.board.setCenter).not.toHaveBeenCalled();
    expect(fake.sfx.beat).not.toHaveBeenCalled();
    expect(f.playback.finished).toBe(true);
  });

  it('cancels an in-flight wait immediately without executing later events or skipping to final state', async () => {
    vi.useFakeTimers();
    const f = fixture([{ t: 'phase', name: 'start' }, { t: 'beat', n: 1, next: { player: [], enemy: [] } }]);
    const playing = f.playback.play();
    f.playback.cancel();
    await playing;
    expect(f.playback.cancelled).toBe(true);
    expect(f.playback.finished).toBe(true);
    expect(fake.sfx.beat).not.toHaveBeenCalled();
    expect(f.board.clearUnits).toHaveBeenCalledTimes(1);
    expect(f.fx.layer.children.every((el) => el.removed)).toBe(true);
    await vi.runAllTimersAsync();
    expect(fake.sfx.beat).not.toHaveBeenCalled();
  });

  it('cancels a projectile without its delayed impact, sound, stats, or log', async () => {
    vi.useFakeTimers();
    const f = fixture([{ t: 'buff', src: 1, tgt: 2, atk: 2, hp: 2 }], units);
    f.playback.onLog = vi.fn();
    const playing = f.playback.play();
    expect(f.fx.layer.children).toHaveLength(1);
    f.playback.cancel();
    await playing;
    await vi.runAllTimersAsync();
    expect(f.fx.burst).not.toHaveBeenCalled();
    expect(f.fx.float).not.toHaveBeenCalled();
    expect(fake.sfx.buff).not.toHaveBeenCalled();
    expect(f.playback.onLog).not.toHaveBeenCalled();
    expect(f.fx.layer.children[0].removed).toBe(true);
  });

  it('skip still rebuilds the final snapshot and does not mean cancellation', async () => {
    vi.useFakeTimers();
    const f = fixture([{ t: 'beat', n: 1, next: { player: [], enemy: [] } }], units);
    f.out.log[0].snap = [units[0]];
    f.playback.skip();
    await f.playback.play();
    expect(f.playback.cancelled).toBe(false);
    expect(f.board.views.size).toBe(1);
    expect(f.board.clearArrows).toHaveBeenCalledOnce();
    expect(f.board.setCenter).toHaveBeenCalledWith('1', '回合', 'beat');
  });

  it('1→2→3→1 changes only the next battle animation, leaving CSS and document animations untouched', async () => {
    vi.useFakeTimers();
    const globalAnimations = vi.fn(() => { throw new Error('must not inspect the document'); });
    const f = fixture([1, 2, 3, 4].map((n) => ({ t: 'beat' as const, n, next: { player: [], enemy: [] } })));
    Object.assign(f.board.el, { ownerDocument: { getAnimations: globalAnimations } });
    const speeds = [1, 2, 3, 1];
    f.playback.onBeat = (n) => { f.playback.speed = speeds[n - 1]; };
    await Promise.all([f.playback.play(), vi.runAllTimersAsync()]);
    expect(fake.animations.map((a) => a.duration)).toEqual([260, 130, 260 / 3, 260]);
    expect(f.board.center.idle.playbackRate).toBe(1);
    expect(globalAnimations).not.toHaveBeenCalled();
  });

  it('tracks UnitView script animations and cancels them without touching its CSS idle', async () => {
    vi.useFakeTimers();
    const f = fixture([{ t: 'dmg', tgt: 1, n: 1, kind: 'attack' }], units);
    f.playback.speed = 3;
    const playing = f.playback.play();
    const unit = f.board.views.get('u1')!;
    expect(unit.el.idle.playbackRate).toBe(1);
    expect(fake.animations[0].playbackRate).toBe(3);
    f.playback.cancel();
    await playing;
    await flush();
    expect(f.playback.finished).toBe(true);
  });
});


describe('round action feedback', () => {
  it('identifies encounter feedback separately from unit skills, including rules without a source', async () => {
    vi.useFakeTimers();
    const f = fixture([{ t: 'rule', id: 'rally', label: '虚空战意', side: 1 }]);
    const log = vi.fn();
    f.playback.onLog = log;
    await Promise.all([f.playback.play(), vi.runAllTimersAsync()]);
    expect(log).toHaveBeenCalledWith({ text: '关卡 · 虚空战意', cls: 'k-boss' });
  });
  it('previews only the current wave and preserves an empty waiting side', async () => {
    vi.useFakeTimers();
    const f = fixture([{ t: 'beat', n: 4, round: 2, wave: 3, next: { player: [2], enemy: [] } }], units);
    await Promise.all([f.playback.play(), vi.runAllTimersAsync()]);
    expect(f.board.setOrder).toHaveBeenCalledWith({ player: ['u2'], enemy: [] }, 2, 3);
    expect(f.board.setCenter).toHaveBeenCalledWith('2', '回合', 'beat');
    expect(f.board.setPips).toHaveBeenCalledWith(1);
  });
  it('shows gained action counts without presenting them as an immediate attack', async () => {
    vi.useFakeTimers();
    const f = fixture([{ t: 'actionGain', src: 1, uid: 2, n: 1, total: 2 }], units);
    const log = vi.fn();
    f.playback.onLog = log;
    await Promise.all([f.playback.play(), vi.runAllTimersAsync()]);
    expect(f.fx.float).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('本回合行动 +1（剩余 2 次）') }));
  });
});


describe('frozen action consumption', () => {
  it('retires the actor preview when freezing consumes a regular action', async () => {
    vi.useFakeTimers();
    const f = fixture([{ t: 'frozenSkip', uid: 1 }], units);
    const playing = f.playback.play();
    const view = f.board.views.get('u1')!;
    await Promise.all([playing, vi.runAllTimersAsync()]);
    expect(view.el.classList.remove).toHaveBeenCalledWith('next-actor');
  });
});
