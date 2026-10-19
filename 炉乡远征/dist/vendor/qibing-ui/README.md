# 奇兵列阵 UI 底层迁移

来源：games/zhenlie-demo/source/src/ui/pixel.ts；FACTION_INFO 取 core/data.ts，mix/parse 取 ui/unitArt.ts。SOURCES.json 记录源 SHA-256 和字体逐文件来源。sourcecode/pixel.original.ts 是逐字副本，pixel.adapter.ts 是实际转译输入。

浏览器 ESM 接口：import { installPixelSprites } from './vendor/qibing-ui/pixel.js'，启动时调用一次。原名写入 document.documentElement.style 的 --pxf-*、--pxd-*、--pxv-*、--pxg-* 及其他原变量。保留 BACKDROP_URL、pedestalUrl(enemy)，另公开 paletteFACTION_INFO 和原 mix(a,b,t)。

与源差异：移除三条 import；将精确原值 FACTION_INFO 内联为 paletteFACTION_INFO 并保留本地别名；原 mix/parse 原样内联。其余算法保持不变，包括未使用的 stat/backdrop 生成。以已有 TypeScript 转译到 ES2020 ESM，无游戏数据、状态或运行时依赖。

字体入口 fonts/fonts.css；Noto Sans SC 400/700/900 复制源 src/fonts 实际子集，Cinzel 700 和 Russo One 400 复制源 web-dist/assets 实际字体。字体 family 保持源名；宿主 CSS 可追加旧炉乡 UI 字体处理子集缺字。本目录不覆盖宿主 CSS、旧卡牌图片或素材源。

音效入口 audio.js：保留原 unlockAudio()、isMuted()、setMuted(boolean)、sfx 导出与 tone/noise 合成算法。适配为 muted 初始 true、删除 zl_muted 存储读写，以及新增 setVolume(number)：限制为 0..1，并将原 master 增益 0.55 乘以宿主音量；tone/noise/sfx 的合成参数保持不变。宿主从 getMenuMusicStatus().preferences 读取已有静音/音量，调用 setMuted 和 setVolume，再由真实手势调用 unlockAudio 及 sfx。模块不监听 document 事件，不读写存档。原件与适配源码见 sourcecode/audio.source.ts、audio.adapter.ts。

音效校验：sourcecode/audio.adapter.ts 转译后的代码与 audio.js 除空白格式外一致；SOURCES.json 中 sha256 仍指原始来源文件，adapterSha256/outputSha256 分别记录当前适配源码与产物。
