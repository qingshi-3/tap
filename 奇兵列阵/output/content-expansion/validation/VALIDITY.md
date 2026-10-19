# 验证结果有效范围

2026-10-16 用户纠正升星规则：合法持有状态仅1／2／4，两名同名同星合成；候选一星不能直接投入二星或三星。

本目录既有 `acquisition*.json`、`difficulty*.json`、`stage-scans.json`、`replacements.json`、`neutral-directed.json`、`weak-pool.json` 与对应 `summary.json`／`report.md` 都属于旧累计喂卡规则的历史证据，包含三份半成品。保留原始输入与统计，不把旧通关率、成型率、替换对照当作现规则结论，也不迁移或猜测修复历史阵容。

当前模拟策略版本为 `legal-public-api-heuristics-v3-same-star-only`。默认新批次输出 `acquisition-same-star.json` 等文件，不能覆盖旧批次。此次只适配策略并做规则回归，没有重跑1800局，因此现规则的中后期成型与难度分布尚待重新验证。

> 2026-10-16 瘦身：causal / neutral-directed / summary / targets / weak-pool / arrangement-diagnostics 等原始 JSON（约 4.7MB，旧规则历史证据）已移出交付包，结论保留在 report.md；原文件在包外备份 `奇兵列阵-cleanup-backup-20261016.tar.gz`，需要时用 scripts/expansion-*.ts 重新生成。
