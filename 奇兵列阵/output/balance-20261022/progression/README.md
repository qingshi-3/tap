# 星角进程与存档验收

实现文件：source/src/core/run.ts、save.ts；新增 tests/egg-progression.test.ts。

RunState.pendingEggs?: number 保存已获得但因满位待领的数量；旧档缺字段按0且不追溯历史被动。claimPendingEggs(r) 返回本次兑现数，UI读取 r.pendingEggs ?? 0。仅星角、未结算锁定且未终局时兑现，备战优先，不覆盖；领取双黄和孵化先记录奖励，再尝试兑现。出售、移动/合并、招募完成后与结算/加载时重试。覆盖招募内部出售不兑现，招募完成后才补蛋，避免抢格和覆盖新奖励。

加载拒绝负数、小数和非数字待领计数，保留原档。加载中的结算或待领奖励兑现会立即持久化，防止连续重进重复结算。原有finishBattle清空pending语义保留。

局部验证：npx vitest run tests/egg-progression.test.ts tests/v08-run-passives.test.ts tests/save-migration.test.ts tests/flow-save.test.ts --maxWorkers=2
4文件22项通过，完整输出见vitest.txt。新增9项覆盖双黄获得时机、备战蛋、满位孵化、出售/合并、覆盖招募、加载兑现、旧档无追溯、损坏计数及加载-继续操作/结算-保存-重进-再保存。早孵8/基础12原有回归通过。

未执行全构建、全量测试或浏览器验收，由主责整合串行执行。未改存档版本、content结构或历史样本。
