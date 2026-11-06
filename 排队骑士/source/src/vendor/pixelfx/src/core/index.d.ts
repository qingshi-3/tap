export interface Frame { w: number; h: number; color: Uint32Array; light: Uint32Array }
export function createFrame(w: number, h: number): Frame;
export function clearFrame(f: Frame): Frame;
export function createFx(mod: unknown, options?: Record<string, unknown>): { update(dt: number): void; draw(frame: Frame): void };
export function composite(frame: Frame, out: Uint8ClampedArray, bg?: null, lightK?: number): Uint8ClampedArray;
