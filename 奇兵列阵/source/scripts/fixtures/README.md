# 冻结模拟基线

这些 TypeScript 文件仅供 `scripts/balance-playthrough.ts`、`scripts/balance-playthrough-final.ts` 和 `scripts/boss-bench.ts` 读取，不属于生产游戏实现，不应随当前 `src/core` 更新。

来源为原工作区以下只读快照（相对于 TapTap 工作区根目录），本目录保留相同子路径：

- `output/qibing-v014-balance/before/core`：初始平衡对照基线，14 个必要模块。
- `output/qibing-v014-balance/before-current/core`：最终对照的调整前基线，14 个必要模块。
- `output/qibing-v014-balance/after-current/core`：最终对照的调整后基线，14 个必要模块。
- `output/qibing-boss-encounters/before/core`：Boss 合成库存基线，9 个必要模块。

只复制驱动入口、平衡驱动哈希清单所需模块及其递归本地依赖，共 51 个文件；没有复制原快照中与驱动无关的 UI 辅助模块、存档模块或测试。文件按原字节复制，`SHA256.json` 记录逐文件 SHA-256；迁入时已与原件逐一核对一致。

运行时工作目录应为 `source`，沿用各脚本文件头的执行方式。默认结果分别写入 `source/output/qibing-v014-balance/validation`、`source/output/qibing-v014-balance/validation-final` 和 `source/output/qibing-boss-encounters/benchmark`；平衡驱动仍支持 `OUT_DIR` 覆盖。`source/output` 已忽略，不作为冻结基线。

本次只迁入基线并更正驱动导入、哈希读取与默认输出路径，没有重新运行模拟。既有归档 driver、测量结果和历史哈希保持原样，不因本次路径调整重算。未来运行时生成的 `sourceHashes.driver` 将反映调整后驱动本身，不能覆盖或冒充历史测量证据；基线模块内容与历史原件一致。
