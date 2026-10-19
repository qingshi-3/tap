# 拖动影像残留修复

用户截图中的白金骑士可由独立浏览器真实双指稳定复现：第一指把银盾侍卫拖到日志栏位置且保持按下，第二指点另一候选，再松开两指。修前释放后.drag-ghost=1，开战第4拍仍为1，节点已无动画；库存未变。见before-report.json、before-multitouch-battle.png。

根因：dragStart可重入并覆盖this.drag，旧ghost引用丢失；记录的pointerId未用于过滤move/up，另一指可结束当前动作。失败回弹又只在onfinish删除，取消路径没有明确所有权。

修复仅在game.ts的拖动清理职责内：一次仅一个主指针动作，移动/结束校验pointerId；回弹动画由Game持有，正常结束/取消都实际移除节点；完整重绘、开战/试打、复盘还原、广告等待、暂停、失焦和退出集中清理动作监听、lifted状态、活动与回弹节点。reduced-motion直接删除回弹预览，不增加动效。没有使用in-battle display:none遮蔽节点。

修后同一真实双指路径：释放后0个ghost，开战第4拍0个ghost，库存不变。见after-report.json、after-multitouch-battle.png。after-report还记录已通过：有效多指放置仅消费一次、正常无效拖放不消费、取消回弹动画删除实际节点、touchCancel、Escape、真实触摸备战往返身份/份数/次数守恒、按住预览时键盘正式开战与迟到松开、复盘还原/试打、广告取消及退出清理。宿主blur/暂停通过显式生命周期注入检查，不能冒充手机宿主实测。页面错误为零。

本轮未证明与此前“CDP拖拽后首次还原tap无click”是同一原因；该触摸路径继续标为未验收。残留复现和清理修复已有独立证据。

实际渲染已对照修前/后第4拍截图检查：战斗日志栏只剩日志和操作，孤儿人物节点为零，未修改台座/卡牌画面。node scripts/check-ui-residue.mjs默认为before记录模式（供历史复现对照）；RESIDUE_MODE=after启用当前回归断言。测试用本地独立上下文，不接触玩家真实进度。未构建/上传。
