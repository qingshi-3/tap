/**
 * FROZEN CONTRACT between tools/import-assets.py (asset pipeline) and src/render/engine.ts.
 * Change only with the main agent's approval; both sides are written against this file.
 */
export interface SpriteFrame {
  file: string;
  rect: [number, number, number, number];
  offset: [number, number];
  duration: number;
}
export interface UnitAsset {
  width: number;
  height: number;
  animations: { idle: SpriteFrame[]; walk: SpriteFrame[]; attack: SpriteFrame[] };
  sourceId: string;
  /** Where the unit's feet sit inside the frame, in source pixels; used for ground anchoring. */
  anchor: [number, number];
}
export interface WorldAsset {
  file: string;
  rect: [number, number, number, number];
}
export interface AssetManifest {
  units: Record<string, UnitAsset>;
  world: Record<string, WorldAsset>;
  ui: Record<string, string>;
  sounds?: Record<string, string[]>;
}
