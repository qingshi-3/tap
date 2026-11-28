"""生成像素化的场景底图与像素字体子集。
用法：python3 tools/prepare-art.py [原图目录]
依赖：Pillow、fontTools（pip3 install pillow fonttools brotli）
"""
import glob, os, re, subprocess, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'art-src')
OUT = os.path.join(ROOT, 'assets', 'art')
os.makedirs(OUT, exist_ok=True)

# 子场景底图：缩到逻辑像素尺寸并量化调色板，得到与游戏一致的粗像素质感
for name in ['scene_quests', 'scene_members', 'scene_recruit', 'scene_facilities', 'scene_guild']:
    p = os.path.join(SRC, name + '.png')
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert('RGB').resize((512, 341), Image.BOX)
    im = im.quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    im.save(os.path.join(OUT, name + '.png'), optimize=True)
    print('art', name, os.path.getsize(os.path.join(OUT, name + '.png')))

# 像素字体子集：只保留游戏里出现的字符
FONT = os.environ.get('PIXEL_FONT', '/tmp/fpf/fusion-pixel-12px-proportional-zh_hans.otf')
if os.path.exists(FONT):
    chars = set(chr(c) for c in range(0x20, 0x7f))
    chars |= set('，。、：；！？“”‘’（）《》「」【】…—·～×÷±→←↑↓★☆✦✚♥■□◆◇▲▼▶◀♪％￥')
    for f in glob.glob(os.path.join(ROOT, 'js', '*.js')) + [os.path.join(ROOT, 'index.html')]:
        chars |= set(open(f, encoding='utf8').read())
    chars = {c for c in chars if ord(c) >= 0x20}
    os.makedirs(os.path.join(ROOT, 'assets', 'fonts'), exist_ok=True)
    out = os.path.join(ROOT, 'assets', 'fonts', 'pixel12.woff2')
    txt = os.path.join('/tmp', 'guild-font-chars.txt')
    open(txt, 'w', encoding='utf8').write(''.join(sorted(chars)))
    subprocess.run(['python3', '-m', 'fontTools.subset', FONT, f'--text-file={txt}', '--flavor=woff2', f'--output-file={out}', '--layout-features=*'], check=True)
    print('font', len(chars), 'chars', os.path.getsize(out))
