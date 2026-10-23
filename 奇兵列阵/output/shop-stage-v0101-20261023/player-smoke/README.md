# 商店限制合法性冒烟

入口：source/scripts/shop-stage-v0101-smoke.ts，在source运行`npx vite-node scripts/shop-stage-v0101-smoke.ts`。

4将各3个合法新seed，分别使用成长/升星/配队策略，共12条真实轨迹198次计算战。失败动作、非法预算、引擎故障及批内源变化均0。逐笔账本actions.jsonl与源SHA/report.json保留。

只验证新特殊店每次最多2名单位、不尝试特殊店刷新及正常扣费结算；不调整商品排名、采购偏好、其他动作，也不重跑旧0.10报告。普通金币刷新继续使用现有策略。

连续第三次首领平局沿原simlib保护在提交前截断，具体battles/settled/truncated逐局标注，不把零故障称全部远征完成。此为合法性冒烟，不是强度收敛或通关率验收。
