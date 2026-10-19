# 素材管线契约（Asset pipeline spec）

冻结接口：`src/assets-types.ts`。Python 侧产出必须严格符合 `AssetManifest`，TS 侧只读该结构。
本文件由主 Agent 维护；执行者不得改 `src/assets-types.ts`。

## 目标

为 DeepSeek 版《小小守护者》导出一套**像素统一**的运行素材：

1. **单位**：复用 `output/duelyst-unit-library` 的原画帧（已还原旋转/裁切的 PNG），按 sourceId 无损打成 atlas。**2026-10-15 用户决定**：单位仍用 duelyst，不换成像素库。
2. **地景**：复用 `C:/Users/qs/Desktop/游戏素材/MiniWorldSprites` 的 16×16 格，做**真实地块拼贴**。2026-10-15 用户决定：地图用真实地块，不用几何棋盘。
3. **UI**：**不导出任何位图**。DeepSeek 版界面全部由主 Agent 用 Canvas + SVG + CSS 代码绘制（像素风描边），不使用 CraftPix 那套皮革金边拆件，**也不使用 Tiny Swords 或 Fantasy Battle Pack 的 UI 套件**。`manifest.ui` 必须固定输出空对象 `{}`。

用户 2026-10-15 确认素材库清单（供追溯，不代表全部使用）：`C:\Users\qs\Desktop\游戏素材\`（Fantasy Battle Pack / Tiny Swords / MiniWorldSprites / duelyst-main 等）、`C:\Users\qs\asset\`（塔防 / UI / rpg / platformer / PNG / game kits）。**本次只读取 duelyst 与 MiniWorldSprites**。其余库未核验许可，不得擅自引入；需要时先问主 Agent。

授权依据：用户在 2026-10-10 确认 duelyst 素材可商用；MiniWorldSprites 为用户本次指定来源。源库**只读**，不修改、不删除、不覆盖。

## 输出

- `games/deepseek-little-guardians/public/assets/manifest.json`（符合 `AssetManifest`）
- `games/deepseek-little-guardians/public/assets/SOURCES.md`（记录每个资源的源文件与来源，不落凭据）
- `games/deepseek-little-guardians/public/assets/asset-check.json`（自检报告）
- `public/assets/atlases/*.png`、`public/assets/world/**`、`public/assets/sounds/*`

## 必须遵守

- atlas rect 保留每帧完整原画布：不缩放、不裁透明区、不改 RGBA 像素。写入后必须逐帧 crop 比对解码像素与原 PNG 相等，不等则报错退出。
- `duration` 取 bindings.json 的 `frame_delay`（秒），不猜测。
- `anchor` 计算：**只用 `idle` 与 `walk` 两个动作**的全部帧，取不透明像素（alpha > 0）并集包围盒的底部中心，整数。**不得把 `attack` 计入**——攻击动作常有扑击/下劈等低于站立基准的帧，计入会把单位整体抬高，看起来悬空。
  - 公式：对 idle+walk 全部帧求并集 bbox，`anchor = [round((minX + maxX + 1) / 2), maxY + 1]`（帧画布左上为原点、y 向下）。
  - 必须逐单位实算，不许硬编码，不许按单位手调。
  - 2026-10-15 修订实测结论：**26 个键里有 25 个 anchor 变化，只有 `archer-2` 不变**（dy ∈ [-16, 0]，dx ∈ [-14, +8]，最大 `healer` dy-16）。原因是 attack 帧经常同时比 idle/walk 更高更宽（有 6 个键 dy=0 但 dx 变了），所以旧口径下几乎所有单位都偏高。
  - 修订方向正确：anchor.y 变小即渲染时精灵下移，让站立帧的脚落在地面线上。若画面整体接地位置需要回调，改这一条口径并重跑脚本即可，不要在渲染层按单位手调偏移。
  - 修订前后 26 张 atlas、9 个地景、3 个音效**字节级完全相同**，只有 manifest/SOURCES/asset-check 三个文本文件变化；两次运行输出逐字节一致。
- `manifest.ui` 必须为 `{}`。
- 每个写入的 PNG 必须是有效非空 PNG，且 `rect` 在当前 PNG 边界内（脚本内断言）。
- 源路径不存在时**明确报错退出**，不静默跳过、不生成空图、不用占位图冒充。

## 单位键名（游戏 ID）

与规则层 `Unit['kind']` 对应，渲染器按这些键取图：

| 键 | 用途 | 建议来源 sourceId（库内已有） |
|---|---|---|
| `shield-1` `shield-2` `shield-3` | 盾卫 1/2/3 级 | `f1_silverguardsquire` / `f1_tank` / `f1_ironcliffeguardian` |
| `archer-1` `archer-2` `archer-3` | 弓手 1/2/3 级 | `f1_backlinearcher` / `f1_ranged` / `neutral_arrowwhistler` |
| `mage-1` `mage-2` `mage-3` | 法师 1/2/3 级（本次新增内容） | `f1_sunwisp` / `f2_geomancer` / `f3_pyromancer` |
| `spear-1` `spear-2` `spear-3` | 枪兵 1/2/3 级（本次新增内容） | `f1_sunforgelancer` / `f1_peacekeeper` / `f3_dervish` |
| `rider-1` `rider-2` `rider-3` | 游骑 1/2/3 级（本次新增内容） | `f5_dreadnaught` / `neutral_windrunner` / `f6_fenrirwarmaster` |
| `engineer` | 英雄工程师 | `neutral_artificer` |
| `captain` | 英雄队长（本次新增内容） | `neutral_captainhankheart` |
| `ranger` | 英雄游侠（本次新增内容） | `neutral_jaxtruesight` |
| `grunt` | 杂兵 | `neutral_ghoulie` |
| `siege` | 攻城 | `neutral_golemstone` |
| `flyer` | 飞行 | `f1_gryphinox` |
| `boss` | 最终 Boss | `boss_borealjuggernaut` |
| `healer` | 治疗兵（本次新增内容） | `neutral_healingmystic` |
| `armored` | 重甲兵（本次新增内容） | `neutral_ironclad` |
| `splitter` | 分裂兵（本次新增内容） | `neutral_ooz` |
| `raider` | 突袭兵（本次新增内容） | `neutral_bloodletter` |

**候选源需要核实**：上表「本次新增内容」的 sourceId 由主 Agent 指定，执行者必须实际检查该单位目录的 `bindings.json` 里 `idle`/`walk`/`attack` 三个动作都有 `resolved: true`、`frames` 非空、`frame_delay > 0`。**不满足就换一个同兵种职能的源，并在报告里写明换了什么、为什么**。不允许用同一个 sourceId 填多个键来凑数（除非两者本就是同一兵种的不同等级，且你说明理由）。

新增键若在库内确实找不到合适单位，**如实报告缺少哪些**，不要用同一个单位换色充数（除非明确说明该键未产出）。每个产出键必须有 idle/walk/attack 三套已验证动作。

## 地景键名

`grass` `grassDetail` `grassFlowers` `path` `water` `tree` `rock` `keep` `tower` `wall` `slow` `bridge`

`bridge` 为新增：在 MiniWorldSprites 中找合适的过水/桥面 16×16 格。找不到就如实报告缺失。

## 音效

`attack` `hit` `death` 三个事件沿用 duelyst `f1_tank` 已验证事件音效（`audio_bindings.json` 中 `verified: true` 的对应语义事件）。可额外增加 `wave` `victory` `defeat`，但必须是源库中**已验证**的事件，且报告其来源；没有就只产出三个。

## 交付证据

执行者返回：manifest 摘要（单位键、帧数合计、atlas 文件数、字节数）、`asset-check.json` 内容、逐帧像素比对是否通过、缺失或降级的键及原因。不要贴完整工具日志。
