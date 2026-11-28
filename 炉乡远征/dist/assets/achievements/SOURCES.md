# 成就图标

2026-11-05 为游戏内当前59项成就补充图标。128×128透明PNG用于44px列表展示，总计约1.27MB。53项既有TapTap成就的512×512深色底PNG及稳定ID对应表保存在 `../../../platform/achievements/icons-20261105/`，状态为本地待上传。

## 素材来源

- 首场胜利复用pixelfx的 `src/fx/ui/achievement.js` 中实体奖牌绘制函数，使用原金色与蓝色绶带。实际检索、渲染原效果并查看后，导出静态奖牌。代码与预览来自 `C:/Users/qs/Documents/ChatGPT/虎扑/lol-manager/pixelfx`，MIT许可见本目录 `pixelfx-LICENSE.txt`。
- 阵营图标来自包内 `assets/crests/crest_f1.png` 至 `crest_f6.png`。原资源库为用户已授权商用的 `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main`。
- 任一阵营、累计通关和铁崖挑战奖章来自原库 `app/resources/season_rewards/season_rank_{bronze,silver,gold,diamond,elite}@2x.png`。截取中央方形主体以适应手机小尺寸。
- 六阵营全通使用原库 `app/resources/ribbons/tournament_winner@2x.png` 的中央主体。
- 章节图标取包内 `assets/spells/*.plist` 声明的 `_000.png` 帧，按真实图集坐标裁帧并最近邻缩放，具体章节映射见生成脚本。六个本地冒险章节也有对应图标。
- 收藏使用包内 `assets/metagame/original/shop-tab-card-backs.png`、`spirit-orb.png` 和 `assets/generals/general_portrait_image_f1.png`。阶级标记复用 `assets/ui/rarity/*.png`。

## 导出与验收

可恢复入口为 `../../../output/achievement-icons/build-icons.mjs`。该脚本使用原素材、pixelfx绘制函数及Sharp做裁帧、尺寸规范和图标组合，保留源素材库。逐项来源在同目录 `sources.json`，原库许可沿用 `../licenses/CC0-1.0.txt`。

实际界面验收入口为 `../../../output/achievement-icons/check-ui.mjs`，截图与报告保存在同目录。当前只接入本地游戏，TapTap后台替换待具备可用的成就编辑接口或后台浏览器连接后继续。
