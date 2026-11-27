# 强度回归模拟器（sim/）

无头跑《日蚀战团》整局：开局 → 8 波战斗 → 每波后黑市，由启发式 AI 代打，**不需要大模型**。
用来回答「这张新卡/英雄/Boss 改完以后，通关率变成多少」「要通关率 30%，Boss 血量该调成多少」。

需要 Node.js 18 以上，没有任何 npm 依赖。在项目根目录（`午夜酒馆/`）运行：

```bash
node sim/cli.js run --runs 500            # 基线：英雄01、标准难度、免费三流派
node sim/cli.js scan cards --runs 300     # 每张侠客卡做 A/B，列出偏强/偏弱
node sim/cli.js tune --target 0.30        # 二分搜索 Boss 血量倍率，让通关率到 30%
node sim/cli.js check                     # 游戏代码改动后跑一下，看模拟器要不要同步
```

报告（Markdown + JSON）都存在 `sim/reports/`。

## 它怎么和游戏保持一致

| 部分 | 来源 | 会不会漂移 |
|---|---|---|
| 卡牌、秘宝、Boss、波次、英雄、进阶难度、所有常量 | 直接加载 `js/v14Data.js`、`js/v14Meta.js` | 不会，改游戏即生效 |
| 出手结算、换牌技、Boss 行动、回合末毒/冰/盾、商店消费钩子 | 直接调用 `js/v14Engine.js` | 不会 |
| Boss 意图（含第 5 回合起狂暴）、抽牌、商店货架、包价 | 运行时从 `js/v14Main.js` **原样摘出**方法源码执行 | 不会 |
| 开局、战斗初始化、出手后流程、过波奖励/回血、商店买卖、开包 | `sim/lib/flow.js` 镜像（v14Main.js 里这些方法混着 UI，没法直接用） | **可能**，有指纹检查兜底 |

指纹检查：每次运行都会对比 v14Main.js 里上面这些方法的「数值相关语句」（已滤掉 DOM/动画/音效/提示）。
如果有人改了，会打印类似
`⚠ 游戏流程代码有改动：finishBattle 的数值逻辑和模拟器记录的版本不一致`。
这时对照改动同步 `sim/lib/flow.js` 里同名方法，然后 `node sim/cli.js check --accept`。只改了 UI 不会误报。

随机数：沙箱里的 `Math.random` 换成了带种子的生成器，同样的命令和种子结果完全可复现。A/B 两边用同一批种子（公共随机数），差值比两次独立抽样稳得多。

## 命令

通用参数（所有命令都能用）：

| 参数 | 说明 |
|---|---|
| `--runs 500` | 局数。看大方向 200 就够，定稿用 1000+ |
| `--hero hero_02` | 主将，`node sim/cli.js list heroes` 看 id |
| `--asc 3` | 进阶难度 0~5 |
| `--themes discard,shield,frost` / `--themes random` | 本局 3 个流派；默认三个免费流派；random 每局随机 3 个 |
| `--force-card id,id` / `--force-relic id` | 开局强制塞进牌组 / 秘宝栏 |
| `--ban-card id` | 招募包里不出这张 |
| `--ads` | 允许 1 次广告复活 + 1 次保底刷新（默认零广告） |
| `--level novice` | 新手 AI：只挑本手伤害最高、从不换牌。默认 `expert` |
| `--override 改动.json` | 不改游戏代码，临时试改数值或加新卡（格式见下） |
| `--seed 1` `--workers 4` | 种子起点；并行线程数（默认 CPU 核数 −1） |

### run：跑一批，看整体表现

输出通关率（含 95% 置信区间）和逐波表：累计通过率、本波通过率（到了这波能过的比例）、平均回合、开局血、掉血、狂暴率（这一波打进第 5 回合以上的比例）、吃大招比例、触顶（打到第 10 回合判负）比例、峰值单手伤害。
报告里还有每张卡的「被提供次数 / AI 选取率 / 持有局通关率」，这是相关性，强卡弱卡的因果判断请用 scan。

### scan：A/B 扫描

```bash
node sim/cli.js scan cards  --runs 300                 # 全部 38 张侠客卡
node sim/cli.js scan cards  --only t_shd_colossus,c_lone_wolf
node sim/cli.js scan relics --theme shield             # 只扫盾反流秘宝
node sim/cli.js scan heroes                            # 10 个英雄，对比英雄01
node sim/cli.js scan bosses --wave 4                   # 8 个 Boss 轮流放到第 4 波，比通过率
```

卡/秘宝：「开局强制带它」减「不带」的通关率差，流派卡会自动打开它所属流派。
「判断」列和同档位（B/A/S/SSS）的中位提升比，明显高出标「偏强」，明显低于标「偏弱」。

### tune：自动调参到目标

```bash
# 整体 Boss 血量倍率，让通关率到 30%，给出每波该填的 hp
node sim/cli.js tune --target 0.30
# Boss 伤害倍率，让「打过第 4 波」的比例到 60%
node sim/cli.js tune --knob wave.dmg --metric reach4 --target 0.6
# 把某张卡的攻击调到「带上它通关率 +3%」
node sim/cli.js tune --knob card.c_lone_wolf.atk --force-card c_lone_wolf --target-delta 0.03
# 任何常量：狂暴倍率调到通关率 25%
node sim/cli.js tune --knob data.BERSERK_MULT --range 1.2,2.5 --target 0.25
```

旋钮写法：`wave.hp`、`wave.dmg`、`data.常量名`、`card.卡id.字段`、`relic.秘宝id.字段`、`hero.英雄id.字段`、`starter.初始卡id.字段`、`boss.Bossid.字段`。
指标：`clear`（通关率，默认）、`reach1`~`reach8`（打过第 N 波的比例）、`waves`（平均打过几波）。

### tune-curve：按每波目标曲线调血量

```bash
node sim/cli.js tune-curve --target 0.98,0.95,0.9,0.8,0.7,0.6,0.5,0.35
```

8 个数 = 打过第 1~8 波的累计比例。从第 1 波开始逐波二分血量，最后换一批种子复测，
新血量存成 `sim/reports/tuned-wave-hp.json`，可以 `--override` 带上它再跑别的测试，确认后再改 v14Data.js。

## overrides：不改游戏代码先试

```json
{
  "data":   { "BERSERK_MULT": 1.6, "WAVE_CONFIG": { "4": { "hp": 3400, "heavyDmg": 40 } } },
  "cards":  {
    "c_lone_wolf": { "atk": 60 },
    "x_new_tank": { "unitId": "f1_3rdgeneral", "theme": "shield", "tier": "A", "name": "盾反 A · 新坦克",
                    "shortName": "新坦克", "atk": 30, "shieldVal": 55, "cost": 4, "desc": "测试用" }
  },
  "starters": { "st_guard": { "shieldVal": 45 } },
  "relics":   { "r_shd_keep": { "cost": 6 } },
  "heroes":   { "hero_02": { "startShield": 20 } },
  "bosses":   { "b_vampire": { "pattern": ["heavy", "charge", "lock3", "heavy"] } },
  "ascensions": { "3": { "dmgMult": 1.1 } },
  "bossHpMult": 1.0
}
```

- 已有 id 是改字段，新 id 是新增（新卡会进招募池）；值写 `null` 是删除。
- 新卡只能用引擎**已经认识**的字段组合（`atk`、`shieldVal`、`applyPoison`、`knifeCount`、`emptySlotMult`、`followPrev`……看 v14Data.js 现有卡）。
  全新机制要先在 `js/v14Engine.js` 里实现，模拟器会自动用上，不用改 sim。

## 推荐工作流（做一张新卡）

1. 先写进 overrides 试：`node sim/cli.js scan cards --override new.json --only x_new_tank`
2. 太强/太弱就 `tune --knob card.x_new_tank.atk --force-card x_new_tank --target-delta 0.04`
3. 满意了写进 v14Data.js（新机制写进 v14Engine.js）
4. `node sim/cli.js check`，再跑一遍 `run` 和 `scan` 看整体有没有被带歪

## AI 的边界（解读数字时要记得）

- **老手 AI**：每回合枚举所有上阵排列，用游戏自己的预测函数粗筛，前 6 名在状态副本上完整跑「出手 + Boss 行动 + 回合末」，选「本波结束预计剩血最多」的；换牌对几种弃法抽样模拟（重洗牌堆，不偷看顺序）。商店按「档位 × 流派契合 ÷ 价格」贪心，第 3 波起留 10G 吃利息。
- **新手 AI**：只挑本手伤害最高，不换牌。两档之间大致就是真人玩家的区间。
- 商店 AI 看档位打分：新卡档位标错，它的「自然选取率」会跟着错，所以判断强度看 scan 的 A/B，别看 run 里的持有率。
- 没模拟的：广告纯调度、广告重抽卡包、手动调整秘宝顺序（影响「复制右侧」类秘宝）、成就和元进度。
- 结论是相对的：同一个 AI 下比较改前改后、卡和卡之间，比「绝对通关率等于真人」可靠。

## 文件

```
sim/cli.js            命令行入口
sim/lib/loadGame.js   加载游戏 JS 到沙箱、摘方法、指纹、overrides
sim/lib/flow.js       一局流程（镜像 v14Main.js 的 UI 方法）
sim/lib/ai.js         启发式 AI（参数在 DEFAULT_PARAMS，可用 --ai 参数.json 覆盖）
sim/lib/pool.js       多线程
sim/lib/stats.js      统计与报表
sim/flow.lock.json    流程指纹
sim/reports/          报告输出
```
