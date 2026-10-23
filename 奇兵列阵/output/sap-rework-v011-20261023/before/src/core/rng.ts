// 局内随机数：只走 rngState，存档后重进结果不变。
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export interface RngHolder { rngState: number }
export function rand(r: RngHolder) {
  const x = mulberry32(r.rngState)();
  r.rngState = (r.rngState + 0x9e3779b9) | 0;
  return x;
}
export const randInt = (r: RngHolder, n: number) => Math.floor(rand(r) * n);
export function shuffle<T>(r: RngHolder, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = randInt(r, i + 1);
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
/** 按权重抽下标；全为 0 时返回 -1 */
export function weighted(r: RngHolder, ws: readonly number[]): number {
  const total = ws.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return -1;
  let x = rand(r) * total;
  for (let i = 0; i < ws.length; i++) { x -= Math.max(0, ws[i]); if (x < 0) return i; }
  return ws.length - 1;
}
