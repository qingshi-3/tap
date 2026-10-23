# 阶段与成型：SYNTHETIC-REPORT-FIXTURE-NOT-GAME-EVIDENCE

本批未验收：门禁失败、中止或缺少完成记录；仅保留诊断，不能作正式结论。
每组预定 5 个独立种子；同一组合跨策略配对。所有死亡、异常及结构违规样本均保留。

|策略|记录/预定|通关|死亡|平局截断|异常/未决|非法动作/预算|
|---|---:|---:|---:|---:|---:|---:|
|multi|4/5|0|3|1|0|0/0|

## multi

|节点/变体|到达/全部|首遇胜/负/平|最终过关/到达；/全部|重试|
|---|---:|---:|---:|---:|
|1:1:node1|4/5|2/2/0|3/4；3/5|1|
|1:3:node3|2/5|0/2/0|0/2；0/5|0|
|1:9:node9|1/5|0/0/1|0/1；0/5|2|

|章首领聚合|到达/全部|首遇胜/负/平|过关/到达；/全部|
|---|---:|---:|---:|
|1|1/5|0/0/1|0/1；0/5|
|2|0/5|0/0/0|0/0；0/5|
|3|0/5|0/0/0|0/0；0/5|

|检查点/方向|曾启动/全部|曾基础成型/全部|到达仍启动|到达仍基础成型|已死未成型|到达未成型|
|---|---:|---:|---:|---:|---:|---:|
|1:1:node1 / multi|1/5|1/5|1/4|1/4|0|3|
|1:3:node3 / multi|2/5|2/5|1/2|1/2|1|1|
|1:9:node9 / multi|2/5|2/5|0/1|0/1|1|1|

成型总体、到达仍成型、已死未成型、仍活未成型及首次时间详见 aggregate.json；battle JSONL 保留每场角色判定、图和完整实际事件，不以赢战替代成型。

实际事件审计见 aggregate.json actualAudit；missingBattles 非零表示该批未完成实际事件审计。结构违规、真实同时场违规与实际关系条数分列，不能混称实际触发三人链。

Seed worlds are paired across policies; general assignments are balanced and legal. These heuristic policies are not optimal players.
Formation is deterministic deployed-board classification; actual event logs are retained separately and require mechanism-aware contract audit.
