# 渲染引擎契约（FROZEN — 主 Agent 维护）

`src/render/engine.ts` 导出的 `BattleRenderer` 是 `src/app.ts`（主 Agent 编写）唯一允许调用的渲染入口。
执行者实现本契约；调用方不得依赖契约之外的内部字段。

## 依赖

- 只用 `@` 本地素材：`AssetManifest`（`src/assets-types.ts`）、`GameState` 及规则层类型（`src/core/index.ts`）。
- **禁止**引入 pixi.js 或任何渲染库。只用 DOM Canvas 2D、`Image`、`requestAnimationFrame`。
- 不得修改 `src/core/**`、`src/app.ts`、`src/index.html`、`src/style.css`、`src/assets-types.ts`。

## 接口

```ts
export interface Insets { top: number; right: number; bottom: number; left: number }

export interface PlacementPreview {
  /** 已吸附到格的落点（建筑用格中心，军团用格） */
  point: Point;
  valid: boolean;
  /** 警戒/作用半径，格为单位；0 表示不画 */
  radius: number;
  kind: string;
  tier: number;
  /** 画什么形状的 ghost */
  shape: 'legion' | 'building' | 'spell' | 'none';
  /** 法术预览圆心（可不同于 point） */
  center?: Point;
}

export class BattleRenderer {
  constructor(container: HTMLElement, manifest: AssetManifest);
  /** 加载全部图集并建好首帧；失败必须抛错，不得静默用占位图 */
  init(onProgress?: (loaded: number, total: number) => void): Promise<void>;
  /** 安全区像素，渲染器自行避让（HUD 由 DOM 负责，这里只影响镜头和边缘提示） */
  setInsets(insets: Insets): void;
  /** true 时关闭镜头震动、粒子和动画插值 */
  reduced: boolean;
  /** 每帧调用；只读取 state，禁止修改 */
  draw(state: GameState): void;
  /** 选中高亮；null 清除 */
  select(id: number | null): void;
  /** 落点预览；null 清除 */
  place(preview: PlacementPreview | null): void;
  /** 世界坐标 -> 屏幕像素（用于 DOM 跟随定位） */
  toScreen(p: Point): Point;
  /** 屏幕像素 -> 世界坐标 */
  toWorld(x: number, y: number): Point;
  /** 单指拖图，dx/dy 为屏幕像素位移 */
  pan(dx: number, dy: number): void;
  /** 平滑聚焦营地 */
  focusCamp(state: GameState): void;
  /** 全图适应屏幕；768×320 短屏也必须让整图可见 */
  fit(): void;
  /** 在 1 倍与 2 倍缩放间切换，center 为世界坐标锚点 */
  toggleZoom(center: Point): void;
  resize(): void;
  /** 用于命中测试：格坐标是否在当前可见区域内 */
  isVisible(p: Point): boolean;
  destroy(): void;
}
```

## 必须做到

1. **镜头**：任意时刻不得把整张 30×20 地图强缩进一屏（除非调用 `fit()`）。默认保持可读的地块尺寸，允许画面超出屏幕由玩家拖动。视口变化、屏幕旋转、安全区变化后镜头与缩放必须仍然有效，不得出现黑边外露或地图飞出屏幕。
2. **像素清晰**：地形与单位使用整数倍缩放或 `imageSmoothingEnabled = false` 中至少一种，不允许半像素模糊导致的接缝与抖字。网格线与描边按 CSS 像素对齐。
3. **地块拼贴**：`manifest.world` 提供 16×16 原格（`grass/grassDetail/grassFlowers/path/water/tree/rock/keep/tower/wall/slow`）。地图 `state.map.cells` 为 1 表示障碍格。障碍格与相邻接缝不得出现空洞、错位或闪烁；水面/树/岩石按格确定性选取变体（用格坐标哈希，不用 `Math.random`，否则每帧抖动）。
4. **单位动画**：按 `unit.anim`（idle/walk/attack）与 `unit.kind` + 军团 `tier` 组合选择素材键（`shield-1..3`、`archer-1..3` 等，见 `tools/import-assets.py` 的键名表；键缺失时降级到该兵种 1 级并只报告一次，不崩溃）。帧计时基于 `state.tick` 或累计传入的 tick 差，不得因为掉帧而跳变。`hurt` 状态用受击闪白表现，不额外要求素材帧。按 `unit.team` 做敌我区分（我方脚下蓝色阵营环，敌方红色），不得整体染色破坏原画。
5. **战斗表现（本次重点）**：受击飘伤害数字（暴击/高伤害更大）、击杀时短促爆散粒子与尸体淡出、远程攻击有箭矢/弹道飞行（`state.effects` 的 `shot` 携带 `toX/toY`）、法术有真实范围光圈扩散、核心受击时**镜头微震**（`reduced` 时关闭）、最后一波 Boss 出现需有可辨认的警示表现。粒子上限要封顶（例如 220 个），超限丢最旧，长时间战斗不得内存增长。
6. **性能**：568×320 设备上 7 波满编战斗应保持流畅；不允许每帧重建离屏画布或重新解码图片。地图静态层可缓存到离屏 canvas，但建筑增删/受损后必须刷新缓存。
7. **不崩**：`state` 处于 `won`/`lost`/`prep` 任一阶段都能安全绘制；空状态（无单位无建筑）不报错。

## 交付证据

执行者返回：实现文件清单与行数、`npx tsc --noEmit` 通过、在 844×390 与 568×320 两种视口下渲染真实 `createGame()` 状态的截图（含至少一次战斗中的帧）、以及明确列出的未做项与降级项。不要贴完整日志。
