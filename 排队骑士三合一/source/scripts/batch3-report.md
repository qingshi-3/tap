# 批次 III 后端交付

已实现本轮法术与遗物规格；仅修改 `src/core` 与 `scripts`，未修改 UI/qb、CSS、美术或冻结基线，未提交 Git。`scripts/bot.ts` 无需改动。

## 文件与实现索引

| 设计点 | 实现位置 |
| --- | --- |
| 删除秘药、四张新法术、战备降至 4 阶、自然进入法术池 | `src/core/data.ts:187`、`:191`、`:218`、`:231`、`:239` |
| 新附加能力 id、可选 tempered，战斗副本及复生保留 | `src/core/engine.ts:13`、`:154`、`:512` |
| 荆棘正伤反击、敌源存活检查、技能伤害、共用反击递归保护 | `src/core/engine.ts:273`、`:344`、`:361` |
| 萌芽每次真正提交结束时永久加生命、属性上限 | `src/core/run.ts:1121`、`:1151`（复用 growFx） |
| 淬炼资格、一次翻倍、加冕补满 3 份、金色入场及发现 | `src/core/run.ts:874`、`:927`、`:928`（复用 addCopies） |
| 替换确认、扣费、法老重复效果及一次施法观察 | `src/core/run.ts:887`、`:920`、`:950` |
| 转授保留淬炼标记、合并保留高 value 对应完整能力 | `src/core/run.ts:930`、`:1055` |
| 秘药旧档迁移、保留 val 等字段；新能力与 tempered 校验 | `src/core/run.ts:2017`、`:2023` |
| 新遗物定义、rarity 可选（本批全为 common）、先锋新文案 | `src/core/data.ts:356`、`:359`、`:371` |
| 零钱袋统一出售收益、遣散补差、放弃不计 | `src/core/run.ts:1104`、`:942` |
| 繁衍号友军召唤加攻、每场最多 5 次 | `src/core/engine.ts:395` |
| 符文匣正式胜利奖励、共用战术池、满手 enqueueCard | `src/core/run.ts:651`、`:1850` |
| 余温石实际命中、去重、无效果排除、不广播食用 | `src/core/run.ts:745`、`:845`、`:920`、`:949` |
| 散兵章纯函数 motleyCount、开战满足三类加成 | `src/core/engine.ts:125`、`:567` |
| 先锋每 oid 首次实际扣血记永久生命、原 perm 通道回写 | `src/core/engine.ts:268`、`:782`；`src/core/run.ts:1854` |
| 新局首次遗物、旧档不补发、首战结算一次及存活检查 | `src/core/run.ts:211`、`:372`、`:1915`、`:2073` |
| 首战保底、预留 RARE_FIRST、后续 4:1 加权无放回、存档随机流 | `src/core/run.ts:2139`、`:2142` |
| 广告多选保持原语义 | `src/core/run.ts:2167` |
| 新行为回归 | `scripts/v09-batch3-test.ts:1` |
| 原测试秘药夹具同步替换为复刻，保留分享次数断言 | `scripts/prep-feedback-test.ts:23` |

辅助产物：`scripts/batch3-task.md` 记录开工前基线与分工；`scripts/batch3-validation/` 保存最终各命令输出及退出码。

## 边界与兼容

- 无未实现设计点。存档 key 和版本均保持原值；新增状态字段可选。
- 增加可选 `firstRelicPending`，保证首战遗物与已经打开的其他遗物选择同时存在时，保存恢复后仍使用首战池。
- 首战死亡或终局不发遗物，也不会在之后第二场补发。旧档缺失 `firstRelicGiven` 视为已发。
- 繁衍号沿现有召唤监听包含复生；军团规格的既有 `summons` 统计仍不计复生。先锋按 oid 去重，所以同一单位复生不会再领一次永久生命。
- 余温石也覆盖转授临战能力、回响实际执行的临战能力授予；只记录实际生效目标。永久法术的施法观察者和食用派生效果不冒充临战命中。
- `trialFight` 增加只读结果标记 `preview:true`，误传给 `settleBattle` 也不结算。幽灵模拟仍走纯 `simulate`，不写经营状态；既有无 settlementId 的正式结算调用继续兼容。
- 本轮只接入既有 growFx/战斗事件通道，没有新增或修改视觉资源。UI 渲染与交互未验收。

## UI 接手清单（未修改）

```ts
// src/qb/card.ts:97：删除 f_elixir 的专用标签判断。
// src/qb/pixelItems.ts:657：f_elixir 像素资源仍存在。
// src/qb/pixelItems.ts:1569：x_copy 仍复用 ICONS.f_elixir；清理时保留复刻的图。
// src/ui/prep.ts:359：附加能力图标仅识别 bone/spark，其余落到 ignite；需补 thorn/sprout。
// src/ui/prep.ts:533：替换确认法术列表需补 thorn/sprout；temper/crown 不应当作替换。
// src/qb/tip.ts:12：grantedText 需补 thorn/sprout，并显示 tempered 状态。
// src/qb/pixelItems.ts:1570：补四张新法术及 rl_pouch/rl_brood/rl_runebox/rl_ember/rl_motley 图标映射。
// src/ui/prep.ts:193：遗物按 rl_<id> 取图；仅 data.icon 借用不会自动生成这些像素映射。
// 散兵章进度可直接调用 src/core/engine.ts 导出的 motleyCount(defs)。
```

| 新内容 | data.icon 临时借用 |
| --- | --- |
| x_thorn / x_sprout / x_temper / x_crown | plate / milk / whet / banner |
| r_pouch / r_brood / r_runebox / r_ember / r_motley | coin / tomb / tome / burst / star |

## 验证结果

开工前 7 项中 6 项通过；`v09-journey-test.ts` 原本退出码 1：50 个种子、18 次通关、5 个组合、完整链路 0。

完工后按指定顺序执行：

- `npx tsc --noEmit`：通过。
- `trigger-contract-test`、`v09-combat-test`、`v09-run-test`、`stat-cap-test`、`battle-stats-test`、`prep-feedback-test`：全部通过。
- `v09-journey-test`：仍退出码 1，50 个种子、18 次通关、3 个组合、完整链路 0；同一基线失败，未修改该测试或降低门槛。
- `v09-batch3-test`：通过。覆盖迁移、真实施法事务、反击/格挡/复生、回合幂等、属性上限、出售、召唤上限、命中去重、开战加成、奖励溢出、预览隔离及首战选择保存恢复。
- `npx vite-node scripts/sim.ts 300 0.65`：退出码 0，无崩溃；通关 **37.7%**，通关剩心 **2.8**，平均回合 **15.3**。

Boss：tide **59%（181 场）**；wall **75%（138 场）**；horde **93%（108 场）**；final **59%（191 场）**；forge **100%（68 场）**。

模拟最后一行原样：

```text
黑沙巨虫78 岚影宗主41 圣铸机兵38 风暴剑圣36 沙灵塑师33 苦修导师26 黑曜豹神25 冰角战兽24 寒冬守望者24 白霜巨龙21 冰原巨犀19 夜魇18 晨曦骑士18 火山之心17 霜冠执政官13 暗隙猎手13 赤蛇刺客11 熔岩巨像10 孵化看守9 献祭术士9 风刃剑士9 深渊主母8 千刃宗师8 晨光盾卫7 银盾侍卫6
```
