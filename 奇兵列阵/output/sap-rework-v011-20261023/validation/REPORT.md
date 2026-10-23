# SAP重做0.11强度验证

所有固定阵容均为合成实验：一星、5位、15招募金、无训练，不代表合法取得与成长。旧/新双差包含共享引擎及敌方共享卡变化；同体去能力保留身材和既有永久成长，仅删除战斗能力，不能单独证明备战能力价值。

## 合成定向对照

|卡|旧版能力净胜分|新版能力净胜分|双差|
|---|---:|---:|---:|
|银盾侍卫 l_shield|4|4|0|
|风刃剑士 l_windblade|4|4|0|
|圣铸机兵 l_caliber|4|4|0|
|刃影导师 s_choreo|0|0|0|
|永夜吟诵者 a_solus|0|0|0|
|噬焰兽 m_harvester|0|0|0|
|沙嚎者 d_howler|0|6|6|
|传令使 n_envoy|12|0|-12|
|落日灵驹 n_paragon|0|0|0|

净胜分=胜1/平0.5/负0之和，full减sameBodyMuted；每个指名卡108格。全112卡详见controlled-paired-profile.json；详细事件与setup在各版本controlled/cells.jsonl。

## 合法玩家轨迹

|组|阶段|局数|首3全胜|二首领首遇胜/遇|二首领含重试胜/战|
|---|---|---:|---:|---:|---:|
|before/player|calibration|36|36|6/33|8/81|
|before/player|holdout|84|84|18/76|20/181|
|current/player|calibration|36|36|25/31|27/41|
|current/player|holdout|84|84|45/67|48/100|
|current/targeted|calibration|40|40|33/35|33/41|
|current/targeted|holdout|40|40|18/25|18/32|

## 定向合法取得与成长

|目标|样本|普通货架遇到|普通招募买入|首次一星入场|备战实际触发|
|---|---:|---:|---:|---:|---:|
|l_caliber|16|7|7|7|0|
|n_envoy|16|12|12|12|0|
|a_solus|16|6|6|7|30|
|s_choreo|16|12|12|16|81|
|n_paragon|16|5|5|5|38|

计数按effect索引分别记；落日灵驹队首/队尾两项各计一次。导师、永夜与灵驹本轮为endPrep，不能沿用旧购买/升级触发名。普通招募曝光/购买不含特殊店；特殊店也可能合法取得目标，故首次一星入场数可更高。未遇与未买入逐局保留，样本不足不能解释为能力通过。

二首领疲劳首遇：校准27/31，保留49/67。首遇胜率改善仍伴随疲劳依赖；旧保留到达二首领76局、新版67局，不能忽略到达样本变化。保留中1:7孵化巢穴从46胜2负变41胜7负；2:5圣光壁垒从30胜1负变16胜8负（样本构成不同），是仍存在的前中程风险；详见profiles节点分层。

首3战所有非胜、第二首领重试、平局截断、高阶首次上场无行动等明细在profiles.json。不要以总通关率替代这些分层。前3合法seed用于校准、后7保留；策略冻结为既有growth/upgrade/mechanism，无未来货架、无战前模拟选胜。定向采购组独立，不混入120轨迹；目标可见时优先、不卖目标、不买重复目标以保留一星，相关辅助仅按当前标签加权，按可见能力对相邻/身后匹配者进行真实moveSlot互换上场。

## 限制

合法动作通过真实run接口，预算/失败动作和prep预览提交一致性有门禁；公开启发式不是最优玩家。曝光和买入覆盖分别记录，未遇卡不算强度通过。高阶诊断在唯一正式战斗之后复放：同体去战斗能力、去该卡自身已有永久成长、同3金射手替换，均不影响策略；替换不是同阶同体，既有购买历史不分叉；该卡历史赠予队友的永久成长仍保留，不能当作完整成长发动机消融。prepSources来自事后克隆已发生备战并提交的计数，保留来源与具体效果索引。

battle fault、非有限血攻、超过50000事件/2000交锋在合成门禁检查；这不是数学证明无递归，具体机制递归边界由行为回归覆盖。脚本、核心SHA以及完整setup/动作/失败trace保留。

## 复现

在games/zhenlie-demo/source执行PowerShell；before入口只读冻结核心，current入口读取唯一产品树。校准/保留分别写独立文件。

```powershell
$env:REWORK_VERSION="before"
$env:V010_PHASE="calibration"; npx vite-node scripts/rework-v011-player.ts
$env:V010_PHASE="holdout"; npx vite-node scripts/rework-v011-player.ts
npx vite-node scripts/rework-v011-controlled.ts
$env:REWORK_VERSION="current"
$env:V010_PHASE="calibration"; npx vite-node scripts/rework-v011-player-current.ts
npx vite-node scripts/rework-v011-targeted.ts
$env:V010_PHASE="holdout"; npx vite-node scripts/rework-v011-player-current.ts
npx vite-node scripts/rework-v011-targeted.ts
npx vite-node scripts/rework-v011-controlled-current.ts
npx vite-node scripts/rework-v011-enemies-current.ts
npx vite-node scripts/rework-v011-shared.ts
npx vite-node scripts/rework-v011-report.ts
```
## 传令可用站位补组（冻结后只补验证）

旧112卡grid将指名协同组放在队尾。新传令需要身后友军，因此该组后排结果（旧能力净胜分12、新0、双差−12）只作为失败摆位/无目标边界，不能据此断言可玩强度变差。原冻结grid不覆写。

补组固定同一五位：坚盾前排、传令slot1（从0计）、四风术士slot2、冰霜法师slot3、弓手slot4；一星15金，3原场景×4原seed×原卡/同体去能力/同阶祭仪师，共旧新72场。

|版本|原卡胜/平/负|去能力胜/平/负|同阶替代胜/平/负|能力净胜分|
|---|---:|---:|---:|---:|
|before|4/8/0|8/4/0|4/0/8|-2|
|current|12/0/0|12/0/0|12/0/0|0|

新版原卡/去能力额外行动合计40/0，术士完整行动72/52，平均交锋12.666666666666666/16.666666666666668。新版三臂全部获胜，胜负已饱和，不能由净胜分0判定能力无价值。

该组包含共享引擎、辅助和敌卡规则变化；结果不作纯单卡因果。导师/永夜/灵驹原grid无备战历史的0分继续视为不能衡量成长强度，成长证据沿用合法定向取得及实际endPrep触发。

复现：在source执行 `npx vite-node scripts/rework-v011-position-aware.ts`。完整setup/事件/SHA在position-aware-envoy。