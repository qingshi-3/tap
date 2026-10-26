# 素材来源

## 历史主角（2026-10-21，已由旗袍猫店主替换）

- 文件：`cats/player-v2.png`。使用OpenAI image_gen按用户授权生成并迭代，为成年东亚猫系女性当铺店主；最终要求白发、黑旗袍、不透白连裤袜。
- 最终编辑提示词：[character-black-white-edit-prompt.txt](../../../output/miaomiao-pawnshop/richness-20261021/character-black-white-edit-prompt.txt)；前轮角色提示词及被替代的试稿保留在同目录，仅最终player-v2.png进入当前角色显示。
- 旧`cats/player.png`保留，未改源素材库；新图是本地题材适配，不是《深空当铺》角色素材。
- 其他原有猫咪、商品及背景沿用线上328700留存包；本轮未重新确定其原始美术作者或改变历史授权记录。

## v1.6内容扩充（2026-10-21）

- 初次扩充时，新增8名职业猫客的`portrait`、24种新品的`icon`引用现有同类资源。8位客人的立绘现已替换为下述专属图；24种新品图标已于2026-10-23替换为独立图片，见下节。具体映射在`js/data.js`。
- 标题沿用已认可的新构图与已还原按钮；本轮没有重绘女主或NPC。

## 净水设备（2026-10-21）

- `equipment/purifier.png`：净水器整机；`equipment/uv-lamp.png`：双管紫外线灯配件。按用户授权使用内置OpenAI image_gen分别生成，RGBA透明背景；原输出直接复制入项目，未从原作提取或改动旧商品图。
- [完整生成提示词](../../../output/miaomiao-pawnshop/equipment-clarity-20261021/prompts.txt)。要求为暖色像素风实体设备、有底座与机械结构、无字无背景，与商品水瓶分开辨认。
- 作坊、小铺、净水图解统一引用以上文件；深色设备座用于识别设备身份，浅底水瓶代表可加工商品。

## 全设备、设施与招牌（2026-10-21）

- 在净水器、紫外线灯基础上新增25张透明实物图，共27项。覆盖全部作坊设备、小铺设施/工具/耗材/服务和门面招牌；映射集中在js/equipment.js。
- 新图由上一会话使用内置OpenAI image_gen生成，原始PNG直接保留。生成提示词见../../../output/miaomiao-pawnshop/equipment-complete-20261021/prompts.json，原输出对应表见同目录generated-sources.json；未从原作提取，未更改商品与NPC资源。
- 新增文件：furnace、tank、brewery、labeler、smoker、repairbench、gemtable、shelf1、shelf2、hide1、hide2、lens、guide、lucky、filter、dew、fridge、dark、wsign、warm、neon、lawfee、gangfee、appraisal_certificate、premium_window（均为equipment/下同名.png）。

## 职业猫客独立立绘（2026-10-22）

- 按用户要求，使用内置OpenAI image_gen分别生成8张透明背景像素猫立绘，原始PNG直接复制入项目。以毛色、服饰、职业道具区分角色，未修改原素材库。
- 文件与角色：`cats/mechanic.png`螺帽、`cats/fisher.png`海盐、`cats/chef.png`锅巴、`cats/musician.png`蓝调、`cats/courier.png`风铃、`cats/archivist.png`墨卷、`cats/jeweler.png`琥珀、`cats/captain.png`北斗。
- 完整提示词及原始输出路径：[portrait-prompts.json](../../../output/miaomiao-pawnshop/plain-language-20261021/portrait-prompts.json)。全部角色路径与SHA256：[portrait-manifest.json](../../../output/miaomiao-pawnshop/plain-language-20261021/portrait-manifest.json)。24位NPC与主角共25条不同图片路径、25份不同文件内容。
- 机器人客人的显示名改为“小七”，稳定ID仍为`robot`，沿用其已有独立立绘；不改变存档身份。

## 旗袍猫店主与鉴宝图标（2026-10-22）

- 用户提供灰色猫机械师图片作为造型底子，内置OpenAI image_gen生成`cats/player-qipao.png`：保留猫脸、灰色虎斑毛色、琥珀眼与像素风，改穿酒红金边旗袍。真实透明PNG原图直接接入标题、教学、夜晚及结局。旧主角文件保留，不再作为当前主角。
- `app-icon.png`与`../promo/icon.png`：新主角拿放大镜鉴定金币；按用户反馈重画为眯起一只眼，深铜色镜框和独立金币之间留可见间隔。最终图为不透明方形PNG，接入网页favicon/apple-touch-icon，平台图标尚未上传。
- [主角完整提示词](../../../output/miaomiao-pawnshop/compact-trade-20261022/player-qipao-prompt.txt)、[图标初稿提示词](../../../output/miaomiao-pawnshop/compact-trade-20261022/icon-prompt.txt)、[图标最终修改提示词](../../../output/miaomiao-pawnshop/compact-trade-20261022/icon-final-prompt.txt)。均使用内置工具，无CLI/API替代。
- 原始输出位于`C:/Users/qs/.codex/generated_images/01a15f0a-83d9-73c1-9651-3dd613c33df4/`：主角`exec-3614b195-d319-4ca8-ae71-347c6061c786.png`，图标最终`exec-b69457b3-f5df-48a0-bc98-d23129c6061a.png`。旧图标备份在本轮证据目录`icon.before.png`。

## 全货物独立图片（2026-10-23）

- 按用户要求，24种后续货物分别使用内置OpenAI image_gen生成独立透明像素实物图，取代历史同类图片别名。原25种货物图片保持不变，49种货物默认图片路径、文件SHA256与解码像素均各不重复。
- 文件：items/下smokedfish、fishoil、driedshrimp、spice、copperwire、sparegear、toolbox、thermos、brokenconsole、console、speaker、musicbox、record、cocoa、canvas、lenskit、roughgem、pendant、starstamp、chart、sextant、teacup、medal、starcompass（均为同名.png）。
- 每张完整生成提示词与工具原始输出对应：[generated-sources.json](../../../output/miaomiao-pawnshop/unique-items-20261023/generated-sources.json)。原图保留在[originals](../../../output/miaomiao-pawnshop/unique-items-20261023/originals/)；接入仅缩为256×256透明PNG，不改绘制内容，不修改原素材库。
- [item-manifest.json](../../../output/miaomiao-pawnshop/unique-items-20261023/item-manifest.json)记录49种货物路径、文件与解码像素哈希。货物稳定ID、属性、价格与玩法规则不变，水的已有品质显示规则不变。