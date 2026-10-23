import { legacyRun } from './legacyRun';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REWARDED_AD_UNIT_ID, TapTapRewardedAds, type RewardedVideoAd } from '../src/ui/rewarded';
import { applyRewardedReroll, cloneRun } from '../src/core/run';

function fixture(configure?: (ad: ReturnType<typeof fakeAd>) => void) {
  const lifecycle = new EventTarget();
  const ads: ReturnType<typeof fakeAd>[] = [];
  const createRewardedVideoAd = vi.fn(() => { const ad = fakeAd(); configure?.(ad); ads.push(ad); return ad; });
  const service = new TapTapRewardedAds(() => ({ createRewardedVideoAd }), 5000, lifecycle);
  return { service, ads, lifecycle, createRewardedVideoAd };
}
function fakeAd() {
  let close: Parameters<RewardedVideoAd['onClose']>[0] = () => {};
  let error: Parameters<RewardedVideoAd['onError']>[0] = () => {};
  let loaded: Parameters<RewardedVideoAd['onLoad']>[0] = () => {};
  return {
    onLoad: vi.fn((cb: typeof loaded) => { loaded = cb; }),
    onClose: vi.fn((cb: typeof close) => { close = cb; }),
    onError: vi.fn((cb: typeof error) => { error = cb; }),
    offLoad: vi.fn(), offClose: vi.fn(), offError: vi.fn(), destroy: vi.fn(),
    load: vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined),
    show: vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined),
    close: (result?: { isEnded?: boolean }) => close(result),
    error: () => error(new Error('sdk')),
    loaded: () => loaded(),
  };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
afterEach(() => vi.useRealTimers());

describe('TapTap rewarded video', () => {
  it('only completed distinct ads spend the two run-wide rerolls; duplicate or stale close events do not',async()=>{
    const f=fixture(),run=legacyRun('argeon',712);run.rerolls=0;
    const watch=async()=>{const result=await f.service.showRewarded('extra-reroll');if(result==='rewarded')applyRewardedReroll(run);};
    const first=watch();await flush();f.ads[0].close({isEnded:true});f.ads[0].close({isEnded:true});await first;
    expect(run.rewardedRerollCount).toBe(1);
    const second=watch();await flush();f.ads[0].close({isEnded:true});expect(run.rewardedRerollCount).toBe(1);
    f.ads[1].close({isEnded:true});f.ads[1].close({isEnded:true});await second;
    expect(run.rewardedRerollCount).toBe(2);
    const before=cloneRun(run);f.ads[0].close({isEnded:true});f.ads[1].close({isEnded:true});await flush();expect(run).toEqual(before);
  });
  it.each(['cancelled','failed'] as const)('%s ads preserve run-wide reroll count and RNG',async outcome=>{
    const f=fixture(),run=legacyRun('argeon',713);run.rerolls=0;const before=cloneRun(run);
    const result=f.service.showRewarded('extra-reroll');await flush();
    if(outcome==='cancelled')f.ads[0].close({isEnded:false});else f.ads[0].error();
    const settled=await result;if(settled==='rewarded')applyRewardedReroll(run);
    expect(settled).toBe(outcome);expect(run).toEqual(before);
  });
  it('requires a completed close event; load and show alone never reward', async () => {
    const f = fixture(); const result = f.service.showRewarded('extra-reroll');
    const done = vi.fn(); void result.then(done);
    await flush(); f.ads[0].loaded(); await flush(); expect(done).not.toHaveBeenCalled();
    expect(f.createRewardedVideoAd).toHaveBeenCalledWith({ adUnitId: REWARDED_AD_UNIT_ID });
    f.ads[0].close({ isEnded: true }); expect(await result).toBe('rewarded');
    f.ads[0].close({ isEnded: true }); f.ads[0].error(); await flush();
    expect(done).toHaveBeenCalledTimes(1);
    expect(f.ads[0].destroy).toHaveBeenCalledTimes(1);
    expect(f.ads[0].offLoad).toHaveBeenCalledOnce();
    expect(f.ads[0].offClose).toHaveBeenCalledOnce();
    expect(f.ads[0].offError).toHaveBeenCalledOnce();
  });
  it.each([undefined, {}, { isEnded: false }])('does not reward early or ambiguous close %j', async (value) => {
    const f = fixture(); const result = f.service.showRewarded('extra-reroll');
    await flush(); f.ads[0].close(value); expect(await result).toBe('cancelled');
  });
  it('rejects concurrency and isolates later requests from stale callbacks', async () => {
    const f = fixture(); const first = f.service.showRewarded('extra-reroll');
    expect(await f.service.showRewarded('failed-battle-retry')).toBe('failed');
    f.service.cancelActive(); expect(await first).toBe('cancelled');
    const second = f.service.showRewarded('failed-battle-retry'); await flush();
    f.ads[0].close({ isEnded: true }); f.ads[1].close({ isEnded: false });
    expect(await second).toBe('cancelled'); expect(f.ads).toHaveLength(2);
  });
  it('reloads and retries a rejected show only once', async () => {
    const f = fixture(); const result = f.service.showRewarded('extra-reroll');
    f.ads[0].show.mockRejectedValueOnce(new Error('not ready'));
    await flush(); expect(f.ads[0].load).toHaveBeenCalledTimes(2);
    expect(f.ads[0].show).toHaveBeenCalledTimes(2);
    f.ads[0].close({ isEnded: true }); expect(await result).toBe('rewarded');
  });
  it.each(['load', 'show', 'reload', 'sdk-error'] as const)('settles %s failure and ignores late completion', async (failure) => {
    const f = fixture((ad) => {
      if (failure === 'load') ad.load.mockRejectedValueOnce(new Error('load'));
      if (failure === 'show') ad.show.mockRejectedValue(new Error('show'));
      if (failure === 'reload') {
        ad.show.mockRejectedValueOnce(new Error('show'));
        ad.load.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('reload'));
      }
      if (failure === 'sdk-error') ad.show.mockImplementation(() => { ad.error(); return Promise.reject(new Error('show')); });
    });
    const result = f.service.showRewarded('extra-reroll'); const ad = f.ads[0];
    await flush(); expect(await result).toBe('failed');
    ad.close({ isEnded: true }); expect(ad.destroy).toHaveBeenCalledOnce();
    if (failure === 'sdk-error') { expect(ad.show).toHaveBeenCalledTimes(1); expect(ad.load).toHaveBeenCalledTimes(1); }
  });
  it('cancels on pagehide, destroys, and ignores late events', async () => {
    const f = fixture(); const result = f.service.showRewarded('extra-reroll'); await flush();
    f.lifecycle.dispatchEvent(new Event('pagehide')); f.ads[0].close({ isEnded: true });
    expect(await result).toBe('cancelled'); expect(f.ads[0].destroy).toHaveBeenCalledOnce();
  });
  it('times out even if load never resolves', async () => {
    vi.useFakeTimers(); const ad = fakeAd(); ad.load.mockImplementation(() => new Promise(() => {}));
    const service = new TapTapRewardedAds(() => ({ createRewardedVideoAd: () => ad }), 20);
    const result = service.showRewarded('extra-reroll'); await vi.advanceTimersByTimeAsync(20);
    expect(await result).toBe('failed'); ad.close({ isEnded: true }); expect(ad.destroy).toHaveBeenCalledOnce();
  });
  it('does not start playback after cancellation during load', async () => {
    let finishLoad!: () => void;
    const f = fixture((ad) => ad.load.mockImplementation(() => new Promise<void>((resolve) => { finishLoad = resolve; })));
    const result = f.service.showRewarded('extra-reroll');
    f.service.cancelActive(); finishLoad(); await flush();
    expect(await result).toBe('cancelled'); expect(f.ads[0].show).not.toHaveBeenCalled();
  });
  it('settles creation and callback binding failures without hanging', async () => {
    const sdk = { createRewardedVideoAd: () => { throw new Error('creation'); } };
    expect(await new TapTapRewardedAds(() => sdk).showRewarded('extra-reroll')).toBe('failed');
    const f = fixture((ad) => ad.onClose.mockImplementation(() => { throw new Error('binding'); }));
    expect(await f.service.showRewarded('extra-reroll')).toBe('failed');
    expect(f.ads[0].destroy).toHaveBeenCalledOnce();
  });
  it('fails without SDK or when initialization throws', async () => {
    expect(await new TapTapRewardedAds(() => undefined).showRewarded('extra-reroll')).toBe('failed');
    expect(await new TapTapRewardedAds(() => { throw new Error('init'); }).showRewarded('extra-reroll')).toBe('failed');
  });
});
