# Duelyst 完整资料库

这是完整阅览台和整理数据的维护目录。在本地检出后，打开 [资源阅览台](index.html) 浏览单位、特效和技能图标。要按卡牌或资源 ID 查看原作对应关系，打开 [原作关系](原作关系.html)。[动态光照](动态光照.html) 可以逐条播放 146 个灯光事件，[部分合成明细](部分合成逐项明细.md) 记录尚存的图层和时序差异。

给 H5 工程导入素材时使用同仓库的 [H5 接入包](../duelyst-h5-kit/README.md)。该目录保留原来的接入路径，提供独立单位、特效和图标接口。这里的原作关系供核对和参考。

## 维护分档

当前版本有 696 个单位，345 个已有分档，351 个待设置。浏览器修改会先保存在当前浏览器。要把一版分档更新到 Git，请在阅览台点「导出全部分档」，然后用以下命令同步和核对。

```sh
python3 tools/duelyst-library-grades.py --apply /path/to/Duelyst-单位全量分档.json
python3 tools/duelyst-library-grades.py --check
```

脚本同步全量分档清单、单位索引和阅览台离线数据。提交前查看这三个文件的 diff。个人选配记录由浏览器保留，需要迁移时用页面上的 JSON 导出和导入。

## 维护原作关系及预览

| 路径 | 内容 |
|---|---|
| `单位/`、`特效/`、`图标/` | 索引和原素材预览 |
| `原作关系.json` | 人工核实的代表案例 |
| `原作事件索引.json` | 按卡牌和触发事件记录的已核实关系 |
| `合成/recipes.js`、`合成/followup.js` | 播放配方及已核实的追加事件 |
| `合成/frames.js`、`合成/strips/` | 合成播放用的帧表和贴图 |
| `合成/engine.js`、`合成/light.js`、`合成/player.js` | 演出规划、灯光和播放器 |

更改索引或演出后，在仓库根目录用 Node.js 18 或更高版本同步阅览台副本、预览覆盖表和部分合成报告。

```sh
node tools/duelyst-library-sync.cjs --write
node tools/duelyst-library-sync.cjs --check
```

当前记录 873 条可播放事件，其中 648 条已按事件配方合成，225 条为部分合成。新增关系时在索引或配方里保留原作路径和行号，尚未确认的关系留空。

原作来源为 [OpenDuelyst](https://github.com/open-duelyst/duelyst)，其 [CC0 文本](UPSTREAM-CC0.txt) 随目录保存。补入的贴图来源可查 [包外补图索引](单位/包外补图来源索引.json)。原游戏 ZIP 由仓库根目录的 Git LFS 条目单独保存。
