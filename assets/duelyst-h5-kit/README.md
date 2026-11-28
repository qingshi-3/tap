# Duelyst H5 接入包

这是给 HTML5 游戏工程的素材和播放接口。单位动作、独立特效和技能图标通过各自的 ID 查找。项目的战斗系统决定何时播放、播在哪里，以及如何组合。

要浏览单位分档、核对原作关系或查看合成演出，请打开同仓库的 [Duelyst 完整资料库](../duelyst-library/README.md)。

收录 696 个单位的 1,390 张动作图集、414 个独立特效条目（含单帧纹理）和 388 张技能及状态图标。

## 先跑示例

在浏览器打开 [demo.html](demo.html)。无需安装依赖或构建，也可从本地文件打开。示例演示了两种触发方式。

- 点棋盘选落点，直接播放 `fxClawSlash`。
- 选择任一个演示单位发起攻击。两个单位的命中事件都调用同一个 `fxClawSlash`。

用静态服务器预览时，在本目录运行 `python3 -m http.server 8765 --bind 127.0.0.1`，再浏览 `http://127.0.0.1:8765/demo.html`。

## 接到现有游戏

将接入包放入项目的静态资源目录。以下示例假设浏览器可以通过 `/duelyst/` 访问接入包根目录。依次加载帧表和小型 Canvas 播放接口。

```html
<script src="/duelyst/assets/manifest.js"></script>
<script src="/duelyst/duelyst-h5.js"></script>
```

在加载阶段缓存帧图。命中时记录当前时刻、落点和特效键。每次游戏重绘时，传入已经过的毫秒数。

```js
const kit = DuelystH5.create();
const clip = kit.effect('fxClawSlash');
const image = await kit.image(clip);

// 在战斗命中事件中创建一条播放实例。
const hit = {start: performance.now(), x: target.screenX, y: target.screenY};

// 在现有 Canvas 渲染循环内调用。now 与 hit.start 使用同一时钟。
const active = kit.draw(ctx, clip, image, now - hit.start, hit.x, hit.y);
// active 为 false 时可从播放列表移除。
```

同一份 `clip` 和 `image` 可以服务任意数量的播放实例。示例使用屏幕坐标。如果游戏的 Canvas 已经应用镜头变换，传入同一坐标系下的世界坐标即可。

单位动作和图标同样走素材表。

```js
const idle = kit.unit('boss_skyfalltyrant', 'idle');
const attack = kit.unit('boss_skyfalltyrant', 'attack');
const icon = kit.icon('icon-7e778462987e456f3e70c7b6'); // 撕裂寒霜
const idleImage = await kit.image(idle);
kit.draw(ctx, idle, idleImage, elapsedMs, actor.x, actor.y, {loop: true});
skillImage.src = kit.assetURL(icon);
```

稀有动作或技能若没有帧图，对应查询返回 `undefined`。加载前从帧表检查可用动作，按项目规则回退。

## 数据与接口

| 文件 | 用途 |
|---|---|
| `assets/manifest.json` | 数据源。游戏的打包工具、Phaser 或 Pixi 可以直接读取。 |
| `assets/manifest.js` | 同一份数据的浏览器脚本形式，供无构建和本地文件使用。 |
| `duelyst-h5.js` | 资源查找、延迟加载、切帧和 Canvas 2D 绘制。 |
| `demo.html`、`demo.js` | 可运行示例，可参考其中的时间轴和触发方式。 |

每个帧描述包含 PNG 的 `path`、单帧 `width` / `height`、总帧数 `count`、每行格数 `cols`、帧间隔 `ms` 和锚点 `anchorX` / `anchorY`。路径相对包根。帧按从左到右、从上到下排列，锚点是从帧左上角量出的像素偏移。项目使用自己的 Sprite API 时，可用 `kit.frame(clip, elapsedMs)` 取源矩形，或直接从 JSON 生成图集登记表。单帧纹理若 `ms` 为 0，会持续显示，由调用者控制移除。

有原作帧表的单位动作和特效保留原作播放间隔与图集中心基准。使用资料库预览帧补齐的条目可通过 `timingSource: "catalog-preview"` 标识。特效表包含 364 个原作注册键，以及 50 个按资料库 ID 导出的补充条目。

`kit.draw()` 默认单次播放。可指定 `{loop: true, scale: 2, flipX: true}`。`kit.duration(clip)` 返回帧数乘以帧间隔。`kit.image()` 按 URL 缓存已加载的图像，建议在战斗开始前预载所用素材。只有项目改变包文件布局时，才需要在 `DuelystH5.create({baseURL, manifest})` 中显式指定包根或帧表。

导入时先挑项目实际会用的单位和特效，再按部署方式裁剪清单和图片。保留整包也可以，运行时只在请求指定素材时读取 PNG。当前运行接口覆盖帧动画和单张纹理。项目前端负责命中判定、镜头、音效，以及冲击波、旋涡等依赖场景的渲染。

## 来源

上游为 [OpenDuelyst](https://github.com/open-duelyst/duelyst)。随包附有[上游 CC0 许可文本](UPSTREAM-CC0.txt)。350 个单位及 6 个同源弹道使用资料库补入的贴图，在清单中标为 `provenance.sourceKind: "external-texture"`，并附图集路径和源文件 SHA‑256 供核对。

原作合成配方、程序特效、音效和用户分档仍在原资料或阅览工作流中。接入示例的命中时机取攻击动画中点，接正式项目时使用游戏自己的命中事件。
