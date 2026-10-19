# 素材与算法来源

`js/pixel.js`直接复制自本工作区`games/forest-lantern/js/pixel.js`；它直接移植`games/zhenlie-demo/source/src/ui/pixel.ts`的逐像素Canvas、16×16九宫格（切片6）、六套调色板、徽章，及`pixelItems.ts`的字母网格、调色板与自动描边。主操作采用原金色九宫格实体按钮，金币图标使用原网格。未使用餐馆的规则、场景图和角色。

字体复制自`games/forest-lantern/assets/fonts/`，源自奇兵列阵：Russo One Latin数值字体和Noto Sans SC中文子集，SIL OFL原许可证保留于fonts目录。新汉字由Microsoft YaHei/PingFang SC/system-ui回退。不称其为像素点阵字体。

货物、车厢、月台与配送建筑：本项目`js/art.js`原创代码原生像素绘制；使用与参考工程一致的低分辨率绘制、最近邻放大、调色板和材质明暗策略。包含实际13种货物与不规则占格形态，详见`ART-SOURCES.md`。未复制第三方商业游戏图像，不修改任何源资源库。

宣传图与图标由本游戏实际绘制模块组合；商店截图为浏览器真实运行画面，实机视频来自真实触摸输入录制（非TapTap宿主真机录像）。来源及核验结果记录于output/qa及platform。
