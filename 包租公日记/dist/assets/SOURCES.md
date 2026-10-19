# 美术来源与使用映射

2026-10-14 使用 Codex 内置 imagegen 生成原创游戏美术。用户提供的经营游戏截图只作为市井手绘风格参考，不复制其界面、人物、名称或玩法内容；新增资源用于《包租公日记》。未修改任何用户源素材库。WebP由生成原图保持尺寸转码优化，原图留在本机 Codex generated_images。

| 文件 | 游戏用途 | 生成要求 |
| --- | --- | --- |
| neighborhood.webp | 可点选房间所在的老街出租楼背景 | 竖幅1024×1536，原创中国市井老街，暖日光、手绘墨线与水粉质感、老墙与阳台植物、六个窗位、早餐店与便利店，无UI、文字或商标。窗位作为房间交互定位；商铺仅为环境。 |
| tenants.webp | 招租、住户详情和对应租客事件头像 | 2列3行等分半身角色图集：张伟（程序员/眼镜/电脑）、小林（大学生）、阿杰（摄影师/相机）、王姐（家庭租客）、李娜（设计师）、老房东（钥匙）；原创面孔、暖色手绘、无文字UI。 |
| rooms.webp | 根据房况和装修状态展示房间 | 2列2行等分相同公寓的3/4俯视图集：破旧、简单翻新、现代、精品；真实床、书桌、厨房与卫浴细节，材质与光线一致，无人物文字UI。 |

生成方式：built-in imagegen。提示词核心：production mobile-game illustration assets; original Chinese urban landlord simulation; richly painted warm hand-inked gouache and lived-in material detail; style reference only, do not copy screenshot composition/interface/characters; no geometric placeholders, logos or baked-in UI; preserve atlas cell layout for gameplay integration.

素材只是表现层。门牌、产权、房况、施工剩余月份、租客、事件、租金和贷款由实时游戏状态驱动；不在图片中写死数字或操作。

用户后续要求先完成功能与画面结构、暂不做美术。当前 `src/presentation.ts` 的 `USE_ILLUSTRATED_ART=false`，上述素材完整保留但不启用；楼栋、家具和NPC用实体几何形状表现，人物由固定衣色、发型与配件区分。后续经授权可恢复插画表现，不影响规则或存档。
