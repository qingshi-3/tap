# targeting-v3 行为验收

生产实现冻结后运行：

```powershell
npx vite-node scripts/targeting-v3/behavior.ts
```

结果写入 `output/targeting-v3/verification.json`。脚本覆盖：寿司五种目标位置、空邻位、缺目标、满队精确范围、食用记录与分享餐盘；龙肉队尾和空身后；霜狼／白霜巨龙／寒冬守望者观察到的真实食用广播；食品价格、传承白名单、历史与新版烤全羊重吃；新旧存档往返；30 张高阶卡真实购买、合并、升星；显式 `UnitSpec`、固定 token 与随机 6 阶召唤的基础身材契约。

旧 `scripts/balance-v2/behavior.ts` 仍包含 `eat(r, 'f_sushi', null)`：它验证的是寿司曾经无需目标的旧契约。targeting-v3 将“寿司必须指定目标”作为新权威行为，因此冻结后若旧脚本仅在这里失败，应把旧调用改成明确槽位；不能把生产代码改回无目标全队寿司来迁就旧测试。
