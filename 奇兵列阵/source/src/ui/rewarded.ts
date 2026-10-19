export type RewardedPlacement = 'extra-reroll' | 'failed-battle-retry';
export type RewardedResult = 'rewarded' | 'cancelled' | 'failed';

export interface RewardedAds {
  showRewarded(placement: RewardedPlacement): Promise<RewardedResult>;
  cancelActive(): void;
}

type CloseResult = { isEnded?: boolean } | undefined;
export interface RewardedVideoAd {
  onLoad(callback: () => void): void;
  onError(callback: (error: unknown) => void): void;
  onClose(callback: (result: CloseResult) => void): void;
  offLoad?(callback: () => void): void;
  offError?(callback: (error: unknown) => void): void;
  offClose?(callback: (result: CloseResult) => void): void;
  load(): Promise<unknown>;
  show(): Promise<unknown>;
  destroy(): void;
}
export interface TapRewardedSdk {
  createRewardedVideoAd(options: { adUnitId: string }): RewardedVideoAd;
}

/** This public placement belongs to app 977726, developer 488823. */
export const REWARDED_AD_UNIT_ID = '1054323';

export class TapTapRewardedAds implements RewardedAds {
  private cancel: (() => void) | null = null;

  constructor(
    private getSdk: () => TapRewardedSdk | undefined = () =>
      (globalThis as typeof globalThis & { tap?: TapRewardedSdk }).tap,
    private timeoutMs = 180_000,
    private lifecycle: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | undefined =
      typeof window === 'undefined' ? undefined : window,
  ) {}

  showRewarded(_placement: RewardedPlacement): Promise<RewardedResult> {
    if (this.cancel) return Promise.resolve('failed');
    return new Promise((resolve) => {
      let ad: RewardedVideoAd | undefined;
      let settled = false;
      let showing = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const safely = (action: () => void) => { try { action(); } catch { /* Cleanup must not prevent settlement. */ } };
      const settle = (result: RewardedResult) => {
        if (settled) return;
        settled = true;
        showing = false;
        clearTimeout(timer);
        safely(() => this.lifecycle?.removeEventListener('pagehide', cancel));
        if (ad) {
          const current = ad;
          safely(() => current.offLoad?.(onLoad));
          safely(() => current.offError?.(onError));
          safely(() => current.offClose?.(onClose));
          safely(() => current.destroy());
        }
        if (this.cancel === cancel) this.cancel = null;
        resolve(result);
      };
      const cancel = () => settle('cancelled');
      // SDK errors are terminal. A rejected show without an error event may reload once.
      const onError = (_error: unknown) => settle('failed');
      const onLoad = () => { /* Readiness is awaited through load(); never grants a reward. */ };
      const onClose = (result: CloseResult) => {
        if (!settled && showing) settle(result?.isEnded === true ? 'rewarded' : 'cancelled');
      };
      this.cancel = cancel;
      timer = setTimeout(() => settle('failed'), this.timeoutMs);
      const play = async () => {
        try {
          const sdk = this.getSdk();
          if (!sdk || typeof sdk.createRewardedVideoAd !== 'function') { settle('failed'); return; }
          ad = sdk.createRewardedVideoAd({ adUnitId: REWARDED_AD_UNIT_ID });
          ad.onLoad(onLoad);
          ad.onError(onError);
          ad.onClose(onClose);
          this.lifecycle?.addEventListener('pagehide', cancel);
          await ad.load();
          for (let attempt = 0; attempt < 2 && !settled; attempt++) {
            showing = true;
            try {
              await ad.show();
              // show() only confirms presentation; the close event owns reward settlement.
              return;
            } catch {
              showing = false;
              if (settled) return;
              if (attempt === 1) { settle('failed'); return; }
              await ad.load();
            }
          }
        } catch { settle('failed'); }
      };
      void play();
    });
  }

  cancelActive(): void { this.cancel?.(); }
}
