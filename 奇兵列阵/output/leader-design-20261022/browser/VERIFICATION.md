# 主将机制修订：隔离fixture真实UI窄验收

2026-10-22。测试当前源码预览http://127.0.0.1:8788/?debug；不是新包烟测。使用现有Edge Playwright，844×390与568×320，独立BrowserContext，touch/mobile、reduced-motion。仅写本目录；未改源码、未构建、未重跑大教程。

## 场景来源与覆盖

ui.mjs显式构造隔离测试fixture，标记为旧contentVersion0.8.3，经正常loadRun恢复到0.8.4。没有使用用户真实存档。fixture提供资源、队伍和待结算状态，仅作为UI输入前置；之后分配、退回、商店拖动、招募覆盖、选择晋升、重新加载均真实点击/拖动，断言页面表现和存档结果。不把fixture中的培养、血脉或Boss胜利当成正常通关所得。

两视口各9场景，总18场景，全部检查完成、pageerror=0。原始记录report.json；smoke脚本ui.mjs。最初两次脚本定位错误已修正：点击主将容器中心会命中里面的退款按钮，应点真实头像.pu-art；商店实际没有.sh-sell按钮，应使用拖入出售框。failure.png为废弃定位失败证据，不代表最终产品检查失败。

## 第1步：无用途法强与旧投入退款

每视口分别卡拉、赫克：旧档genPower=2、stash.power=2、allocLog含本轮两次主将投入。真实整备选法强后，HUD没有arm-target、主将卡没有target；点整备主将头像显示“当前技能不使用主将法强”，stash与genPower不变。关闭整备后真实HUD头像也显示该说明。

真实退回一点→保存→重进→再退一点→再保存：genPower从2到1到0，stash从2到3到4，仍同一远征。这里只证明旧档中当前备战allocLog保留的可撤销投入能退，不承诺历史跨战投资可无条件退款；后者不是现有契约。

截图：844/568-kara-no-use.png、hank-no-use.png、kara-refund-reloaded.png、hank-refund-reloaded.png。

## 第2步：有效主将培养

每视口瓦尔坎fixture：真实选法强后主将卡target高亮，点头像投入→保存重进→再次点选投入并保存，genPower从0到1到2、点数消耗对应。没有直接修改游戏运行状态完成这些动作。

截图：844/568-vulkan-valid.png。

## 第3步：唯一血脉保护与允许售卖

每视口4种唯一血脉fixture：x_egg战场0、x_egg备战5、x_fire战场0、x_fire备战5，全8持有位填满。商店真实点对象，详情显示“星角最后的龙蛋或龙不能出售”；真实拖对象到出售框不卖，gold/owned不变。离店进入备战后，真实拖新招募卡覆盖该位置，招募次数和全部ownedId/内容不变，未出现“遣散并招募”确认。

当前商店使用“拖入出售”的div入口和禁售原因提示，没有出售button，因此不能字面宣称“出售按钮disabled”；行为保护已通过，禁用视觉/语义入口是否需要改动交主责判断。

双血脉fixture：场上蛋、备战炎龙。真实拖卖蛋成功，保存重进后炎龙仍在；选中剩余炎龙出现禁售原因。售卖/恢复未覆盖队伍或静默新增血脉。

截图：844/568-protected-{x_egg|x_fire}-{0|5}-shop.png、-cover.png、two-bloodlines-sold-reload.png。

## 第4步：真实晋升选择

fixture为第一章Boss已胜且pending尚未结算，不直接赋promo候选。通过正常loadRun/finishBattle触发makePromo，页面真实出现2个专属、1个通用；分别为龙血、双黄、破阵。真实点击专属后候选清空，选择保存；重进被动仍持有。此证据证明恢复结算→生成→UI选择→保存链路，不是新打一轮远征获取晋升的证据。

截图：844/568-promo-options.png、promo-chosen-reloaded.png。双黄说明在568上完整4行，没有截断或压到其他候选；三个选择均可真实点击。

## design-slop与实际渲染

已查看两视口培养详情、保护详情及晋升截图：主将详情未盖住底部培养托盘/完成按钮；商店禁售原因可见；长文换行未遮主要操作。主操作“完成/离开商店”为明确金色实体底色，拒绝分配不依靠仅颜色。

需主责处理或明确保留的视觉项：两视口晋升专属候选有明显青绿描边、深暗内底，视觉仍接近霓虹线框卡片按钮，和用户“不线框、实体填充”偏好不一致。具体证据844/568-promo-options.png。本执行者只有证据写入权限，没有修改源码；不以输入通过掩盖该项未整改。用户已有整套HUD的微小字体及装饰框不在此次窄验收内，不能据这组检查宣称全游戏视觉完全合规。

未验收：新交付包（等待主责构建后独立smoke）、实体手机、平台宿主/真实广告、全教程4战、更多晋升长文/所有13主将、无现存allocLog的历史主将法强退款。测试上下文已关闭，预览服务保留。

## 晋升CSS修复后复查

保留旧-promo-options.png与旧问题描述作为修改前证据。新增promo-recheck.mjs/json，以及844/568-promo-filled.png、-focus.png、-chosen.png，未覆盖原截图。

两视口实际查看：专属为实填灰绿rgb(60,89,83)，通用为实填灰紫rgb(68,65,95)，border-image均none，额外外框/藤蔓已移除；双黄长文完整。真实Tab最终到达候选后呈金色实线3px焦点，reduced-motion下transition=0s；真实点击双黄后保存，promo清空且持有xingjiao_2。0 pageerror。原先霓虹线框视觉问题已修复并复查通过。

边界：晋升层没有把初始焦点移入/限制在该层；从进入场景当前焦点起需23次真实Tab经过背景控件才到首个晋升选项。本轮CSS修正保证可见焦点，未改应用级焦点管理，不把它说成完整模态键盘体验通过。


## 晋升焦点管理修复后复查

新证据promo-keyboard.mjs/json、844/568-promo-keyboard-trapped-focus.png与-enter-chosen.png。真实恢复晋升后首个选项立即获焦，无需经过背景控件。实际Tab三次焦点序号1→2→0，Shift+Tab三次2→1→0，两视口一致；焦点金色可见，长文完整。真实Enter选择首项龙血，存档promo=null、passives含xingjiao_3、version0.8.4，pageerror=0。先前23次Tab的焦点管理问题已修复，此段为最终复查结论，旧截图/记录保留。

## 最终0.8.4交付包真实流程smoke

最终单文件SHA256：b0713333397d49ef1dfc9d05e4498403759c1a98cab88c438739cefd59750dae。证据package084-smoke.mjs、package084-report.json及package084-single/split-{title,prep,battle,result,reload-recruit-saved}.png。

单文件file://在844×390、HTTP拆分dist在568×320均通过：隔离上下文，仅预设教程完成/提示已读/播放速度，不注入RunState、卡牌或金币；实际点击新的游戏、实际选首个随机主将、拖入两次招募、开战、跳过播放，真实获得首战胜利。敌人DOM均为单个骷髅兵1攻2血；存档contentVersion=0.8.4、history=[win]、node=1、pending=null。随后真正reload→继续游戏→第二关再拖入招募并保存，runId不变、picks=1、history保留胜利。两产物pageerror均为0。

已查看胜利与重进招募截图：主要操作可见，无本次新增遮挡；单文件第二关出现合法蓄力教学提示，不属于失败。此窄烟测更新此前“新交付包未验收”的状态；不扩大为全教程、所有关卡或实体手机验收。

请求日志：单文件0失败；HTTP重进后1条主菜单音乐net::ERR_ABORTED。核对该资源HTTP HEAD为200、audio/mp4、1983332字节，非缺失资源；src/ui/audio.ts changeTrack会主动AbortController.abort取消旧曲加载，与重进标题后立即继续切换音乐一致。故记录为切曲取消，未将其隐藏或声称所有请求为0；未验证扬声器实际音质。无需因正常取消重跑玩法。预览服务保持运行。
