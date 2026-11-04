# 最终 Boss 完整局对照

从 `source` 目录运行：

```powershell
npx vite-node scripts/final-boss-mechanics/run.ts
npx vite-node scripts/final-hurt-boss/run.ts baseline 200
npx vite-node scripts/final-hurt-boss/run.ts candidate 200
npx vite-node scripts/final-hurt-boss/compare.ts
npx vite-node scripts/final-hurt-boss/verify-audit.ts
```

`baseline/` 是本轮调整前的源码快照，文件哈希见 `manifest.json`；candidate 使用当前生产源码。两臂使用同一 bot、相同种子和策略，不调用广告。每臂七组、每组200局，总计2800局，不能将补录重跑计作新增独立样本。

结果写入 `output/final-hurt-boss/`。`baseline.json`、`candidate.json` 及 `*-battles.jsonl` 为大型本地生成文件，不随本次代码提交。逐战 JSONL 包含完整战斗输入、实际种子、遗物、伤害来源分项，最终 Boss 战另含事件链；重放检查读取这些文件。已有结果时，runner 会检查逐局结果是否复现，使用不同样本量或新规则时应另行保存旧结果，避免混淆版本。

配对检查要求首次最终 Boss 之前轨迹与首次入场玩家队伍一致。单组按200个配对样本计算区间；跨策略汇总按共享种子聚类重采样。六种困难策略等权汇总不是玩家总体通关率。

本轮结果摘要见 `output/final-hurt-boss/summary.md`；角色机制见 `output/final-boss-mechanics/report.md`。历史 balance-v2/v3/v4 脚本用于对应阶段的对照，不应假定其旧数值断言适用于后续版本。
