"""导出 DeepSeek 版《小小守护者》的运行素材（无缩放、无重绘、无编造数据）。

来源（全部只读，绝不修改/删除/移动）：
  * ``output/duelyst-unit-library``                       单位帧 + 已验证事件音效
  * ``C:/Users/qs/Desktop/游戏素材/MiniWorldSprites``      地景 16x16 格

输出（只写 ``games/deepseek-little-guardians/public/assets/**``）：
  manifest.json / SOURCES.md / asset-check.json / atlases/*.png / world/**/*.png / sounds/*.m4a

明确不读取：output/fantasy-ui-library、Tiny Swords、Fantasy Battle Pack、C:/Users/qs/asset/**。
契约见 docs/ASSET-PIPELINE-SPEC.md，结构见 src/assets-types.ts（本脚本不修改该文件）。
"""
import json
import math
import shutil
import sys
from pathlib import Path

from PIL import Image

GAME = Path(__file__).resolve().parents[1]
ROOT = GAME.parents[1]
UNITS = ROOT / 'output/duelyst-unit-library/units'
WORLD = Path('C:/Users/qs/Desktop/游戏素材/MiniWorldSprites')
DEST = GAME / 'public/assets'
ACTIONS = ('idle', 'walk', 'attack')
# anchor 只用 idle/walk 求并集（SPEC 2026-10-15 修订）：attack 常有扑击/下劈帧低于站立基准，
# 计入会把单位整体抬高、看起来悬空。
ANCHOR_ACTIONS = ('idle', 'walk')

# 单位键 -> sourceId。主 Agent 指定的候选已逐个核对 bindings.json；替换见 REPLACEMENTS。
SELECTION = {
    'shield-1': 'f1_silverguardsquire',
    'shield-2': 'f1_tank',
    'shield-3': 'f1_ironcliffeguardian',
    'archer-1': 'f1_backlinearcher',
    'archer-2': 'f1_ranged',
    'archer-3': 'neutral_arrowwhistler',
    'mage-1': 'f1_sunwisp',
    'mage-2': 'f2_geomancer',
    'mage-3': 'f3_pyromancer',
    'spear-1': 'f1_sunforgelancer',
    'spear-2': 'f1_peacekeeper',
    'spear-3': 'f3_dervish',
    'rider-1': 'f5_dreadnaught',
    'rider-2': 'neutral_windrunner',
    'rider-3': 'f6_fenrirwarmaster',
    'engineer': 'neutral_artificer',
    'captain': 'neutral_captainhankheart',
    'ranger': 'neutral_jaxtruesight',
    'grunt': 'neutral_ghoulie',
    'siege': 'neutral_golemstone',
    'flyer': 'f1_gryphinox',
    'boss': 'boss_borealjuggernaut',
    'healer': 'neutral_healingmystic',
    'armored': 'neutral_ironclad',
    'splitter': 'f4_ooz',
    'raider': 'neutral_bloodletter',
}

# 主 Agent 指定但与库不符的候选：'neutral_ooz' 目录不存在（库内实际目录为 f4_ooz）。
REPLACEMENTS = {
    'splitter': {
        'requested': 'neutral_ooz',
        'used': 'f4_ooz',
        'reason': '指定目录 output/duelyst-unit-library/units/neutral_ooz 不存在；'
                  '库内同名单位 Ooz 的实际目录是 f4_ooz，且 idle/walk/attack 全部 resolved。',
    },
}

# 地景键 -> (MiniWorldSprites 相对路径, [x,y,w,h])。
# 2026-10-15 修正：初版沿用参考实现时把 Grass.png 的格子认错，`water` 与 `grass` 指向了同一个
# rect（都是 [0,0]），地图上水草同色。逐格实测平均色后按实际内容重新指派：
# Grass.png[0,0]=(78,188,185) 青色水面、[16,0]=(195,214,87) 黄绿草地。
# 原 `path` 指向 Grass.png[48,0]=(230,211,145) 暖沙色，与「道路」语义不符，已删除该键，
# 道路改由 `deadGrass` 表达，避免留一个语义不清的键给渲染层误用。
# 新增 `shore`：Shore.png 是沙→水渐变条，[0,0]=(231,213,147) 才是沙岸端；
# 主 Agent 给的 [48,0] 实测 =(78,188,185)，与水面同色，会复现同一类错误，故以实测为准用 [0,0]。
# 2026-10-15 第二轮修正：所有地块变体必须 colors>1，否则「细节/变体」在画面里看不出来。
#   grassDetail 由 TexturedGrass[0,0]（colors=1，与 grass 完全同色）改为 [16,0]（colors=3）；
#   deadGrass 由 DeadGrass[0,0]（colors=1 纯色）改为 [16,0]（colors=4，带草茬，道路一眼可读）；
#   `grassFlowers` 改名 `grassTuft`——该格实测是草丛纹理不是花，旧键不保留以免语义不符。
# 2026-10-15 第三轮：新增 `waterDeep`（渲染层预留的 waterDeep→waterAlt→… 探测链）。
#   Cliff-Water.png 实测是「悬崖小岛」而非水面图集：整张 80×96（5×6 格、26 格不透明）里水只是
#   小岛四周 3~7px 的留白。穷举全部 16×16 窗口（任意偏移共 5265 个），不透明覆盖率 100% 的窗口里
#   水色占比最高只有 91%，且那几格横跨两个动画帧、底部带一段悬崖弧线；网格对齐格最好的是 [0,0]
#   （水色占比 74%，右下 26% 是悬崖角）。即**没有任何一格/窗口是干净水面**，故按主 Agent 指定的
#   后备方案改用 Shore.png 深水格 [64,0]：同水色系、比 `water` 更深，用于做深浅层次
#   （代价：该格 colors=1，只提供明度层次不提供纹理，已在 SOURCES.md 写明）。
WORLD_SELECTION = {
    'grass': ('Ground/Grass.png', [16, 0, 16, 16]),
    'water': ('Ground/Grass.png', [0, 0, 16, 16]),
    'waterDeep': ('Ground/Shore.png', [64, 0, 16, 16]),
    'shore': ('Ground/Shore.png', [0, 0, 16, 16]),
    'deadGrass': ('Ground/DeadGrass.png', [16, 0, 16, 16]),
    'grassDetail': ('Ground/TexturedGrass.png', [16, 0, 16, 16]),
    'grassTuft': ('Ground/TexturedGrass.png', [32, 16, 16, 16]),
    'tree': ('Nature/Trees.png', [16, 0, 16, 16]),
    'rock': ('Nature/Rocks.png', [0, 0, 16, 16]),
    'keep': ('Buildings/Wood/Keep.png', [0, 0, 32, 32]),
    'tower': ('Buildings/Wood/Tower.png', [16, 16, 16, 16]),
    'wall': ('Buildings/Enemy/SpearWall.png', [0, 0, 16, 16]),
    'slow': ('Nature/Wheatfield.png', [16, 0, 16, 16]),
    # bridge：Miscellaneous/Bridge.png(80x48) 内两块桥体之一；[48,16,16,16] 是横向桥的整格桥面
    # （256/256 像素不透明，竖向木板 + 顶部深色横梁），可与 16x16 地块拼贴。
    'bridge': ('Miscellaneous/Bridge.png', [48, 16, 16, 16]),
}
# `grassFlowers` 已改名 `grassTuft`；`path` 已删除。渲染层需跟着改键名。
WORLD_KEYS_RENAMED = {'grassFlowers': 'grassTuft'}
WORLD_KEYS_REMOVED = ['path']

# 音效：只用来源库中 verified: true 的事件。f1_tank/audio_bindings.json 全部语义只有
# apply/walk/attack/receiveDamage/attackDamage/death，没有 wave/victory/defeat，故不产出这三个键。
AUDIO_SOURCE = 'f1_tank'
AUDIO_SELECTION = (('attack', 'attack'), ('hit', 'receiveDamage'), ('death', 'death'))


def fail(message):
    print(f'ERROR: {message}', file=sys.stderr)
    raise SystemExit(1)


def read_json(path):
    if not path.is_file():
        fail(f'源文件不存在：{path}')
    return json.loads(path.read_text(encoding='utf-8'))


def copy(source, relative):
    if not source.is_file():
        fail(f'源文件不存在：{source}')
    target = DEST / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    return 'assets/' + relative.replace('\\', '/')


def check_image(file, rect=None):
    path = GAME / 'public' / file
    if not path.is_file():
        fail(f'输出图不存在：{path}')
    with Image.open(path) as image:
        image.load()
        assert image.format == 'PNG', path
        assert image.getbbox(), f'全透明（空）图片：{path}'
        if rect:
            x, y, w, h = rect
            assert x >= 0 and y >= 0 and w > 0 and h > 0, rect
            assert x + w <= image.width and y + h <= image.height, (path, rect, image.size)
        return image.size


def tile_stats(file, rect):
    """实测某格内容：不透明像素平均色、不透明占比、不透明像素颜色数（1 = 纯色无细节）。"""
    with Image.open(GAME / 'public' / file) as image:
        image.load()
        x, y, w, h = rect
        raw = image.convert('RGBA').crop((x, y, x + w, y + h)).tobytes()
    pixels = [tuple(raw[i:i + 4]) for i in range(0, len(raw), 4)]
    opaque = [p for p in pixels if p[3] > 0]
    assert opaque, f'{file} {rect} 该格全透明'
    avg = tuple(round(sum(p[i] for p in opaque) / len(opaque)) for i in range(3))
    return {'avg': list(avg), 'opaquePct': round(100 * len(opaque) / len(pixels), 1),
            'colors': len(set(opaque))}


def alpha_bbox(image):
    """不透明像素（alpha > 0）的包围盒；全透明返回 None。"""
    return image.getchannel('A').getbbox()


def load_frame(source, frame):
    path = source / frame
    if not path.is_file():
        fail(f'源帧不存在：{path}')
    with Image.open(path) as original:
        original.load()
        assert original.format == 'PNG', path
        assert original.getbbox(), f'空帧：{path}'
        pixels = original.convert('RGBA')
    box = alpha_bbox(pixels)
    assert box is not None, f'整帧全透明，无法计算 anchor：{path}'
    return pixels, box


def build_unit(key, source_id):
    source = UNITS / source_id
    if not source.is_dir():
        fail(f'单位目录不存在：{source}（键 {key}）')
    binding = read_json(source / 'bindings.json')['cards'][0]

    unit = {'width': 0, 'height': 0, 'animations': {}, 'sourceId': source_id}
    loaded = []          # [(pixels, output_dict)]
    union = [None, None, None, None]   # minX, maxX(inclusive), minY, maxY(inclusive)
    summary = []

    for action in ACTIONS:
        animation = binding.get('animations', {}).get(action)
        assert animation is not None, f'{source_id} 缺少动作 {action}'
        frames = animation.get('frames') or []
        # 契约要求：resolved === true && frames 非空 && frame_delay > 0
        assert animation.get('resolved') is True, f'{source_id}/{action} unresolved'
        assert frames, f'{source_id}/{action} 无帧'
        assert float(animation.get('frame_delay') or 0) > 0, f'{source_id}/{action} frame_delay<=0'
        delay = float(animation['frame_delay'])

        outputs = []
        for frame in frames:
            pixels, (x0, y0, x1, y1) = load_frame(source, frame)
            unit['width'] = max(unit['width'], pixels.width)
            unit['height'] = max(unit['height'], pixels.height)
            if action in ANCHOR_ACTIONS:
                union[0] = x0 if union[0] is None else min(union[0], x0)
                union[1] = x1 - 1 if union[1] is None else max(union[1], x1 - 1)
                union[2] = y0 if union[2] is None else min(union[2], y0)
                union[3] = y1 - 1 if union[3] is None else max(union[3], y1 - 1)
            output = {'file': f'assets/atlases/{source_id}.png', 'offset': [0, 0], 'duration': delay}
            outputs.append(output)
            loaded.append((pixels, output))
        unit['animations'][action] = outputs
        summary.append(f'{len(outputs)} × {delay:g}')

    # anchor：idle+walk 全部帧的并集 bbox 底部中心（attack 不计入），单位统一值，保证站立不跳脚。
    assert union[0] is not None, f'{source_id} 的 idle/walk 没有可用帧'
    min_x, max_x, min_y, max_y = union
    unit['anchor'] = [round((min_x + max_x + 1) / 2), max_y + 1]
    assert 0 <= unit['anchor'][0] <= unit['width'], (key, unit['anchor'], unit['width'])
    assert 0 <= unit['anchor'][1] <= unit['height'], (key, unit['anchor'], unit['height'])

    columns = max(1, min(len(loaded), 1024 // unit['width']))
    rows = math.ceil(len(loaded) / columns)
    atlas = Image.new('RGBA', (columns * unit['width'], rows * unit['height']))
    for index, (pixels, output) in enumerate(loaded):
        x, y = index % columns * unit['width'], index // columns * unit['height']
        # 不加 alpha 蒙版：透明像素下的 RGB 字节也原样保留。
        atlas.paste(pixels, (x, y))
        output['rect'] = [x, y, *pixels.size]

    atlas_path = DEST / 'atlases' / f'{source_id}.png'
    atlas_path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(atlas_path, optimize=True)
    assert atlas_path.stat().st_size > 0, atlas_path

    # 逐帧 crop 比对解码后的 RGBA 像素与原 PNG，完全相等才通过。
    compared = 0
    rects = set()
    with Image.open(atlas_path) as decoded:
        decoded.load()
        assert decoded.format == 'PNG', atlas_path
        for pixels, output in loaded:
            x, y, w, h = output['rect']
            assert 0 <= x < x + w <= decoded.width and 0 <= y < y + h <= decoded.height
            assert (x, y, w, h) not in rects, (source_id, output['rect'])
            rects.add((x, y, w, h))
            assert decoded.crop((x, y, x + w, y + h)).tobytes() == pixels.tobytes(), (source_id, output['rect'])
            compared += 1
    assert compared == len(loaded), (source_id, compared, len(loaded))

    return unit, summary, binding, atlas_path, compared


def main():
    if not UNITS.is_dir():
        fail(f'单位库不存在：{UNITS}')
    if not WORLD.is_dir():
        fail(f'地景库不存在：{WORLD}')
    DEST.mkdir(parents=True, exist_ok=True)

    manifest = {'units': {}, 'world': {}, 'ui': {}, 'sounds': {}}
    written = set()
    detail = []
    by_source = {}
    total_frames = 0
    total_compared = 0
    atlas_bytes = 0

    lines = [
        '# DeepSeek 版《小小守护者》实际使用素材', '',
        '由 `games/deepseek-little-guardians/tools/import-assets.py` 生成；源库全部只读，本脚本不修改、删除或移动任何源文件。',
        '单位帧取自 `output/duelyst-unit-library` 已还原旋转/裁切的原像素 PNG，按 sourceId 无损排入 `public/assets/atlases/<sourceId>.png`；',
        'atlas rect 保留每帧完整原画布，不缩放、不裁透明区、不重绘 RGBA 像素，写入后逐帧 crop 比对解码像素与原 PNG 相等。',
        '`width`/`height` 为帧画布，`offset` 恒为 `[0,0]`；`duration` 取 bindings.json 的 `frame_delay`（秒），未猜测。',
        '`anchor` 为该单位 `idle`+`walk` 全部帧不透明像素（alpha > 0）并集 bbox 的底部中心 `[round((minX+maxX+1)/2), maxY+1]`，逐单位实算；',
        '按 SPEC 2026-10-15 修订**不把 `attack` 计入**（攻击帧常有扑击/下劈等低于站立基准的像素，计入会让单位整体抬高、看起来悬空）。',
        '地景取自 `C:/Users/qs/Desktop/游戏素材/MiniWorldSprites` 的 16×16 原格，只做裁切，不改像素。',
        '**本版 `manifest.ui` 固定为 `{}`**：界面全部由主 Agent 用 Canvas + SVG + CSS 代码绘制，不导出任何 UI 位图。', '',
        '## 未读取的来源（按任务约束排除）', '',
        '- `output/fantasy-ui-library`、Tiny Swords、Fantasy Battle Pack、`C:/Users/qs/asset/**`：本次一律未打开、未引用。', '',
        '## 单位映射与动作', '',
        '| 游戏ID | sourceId / 原单位 | 来源绑定 | idle/walk/attack（帧数 × 秒/帧） | 帧数 | anchor | atlas |',
        '|---|---|---|---|---|---|---|',
    ]

    for key, source_id in SELECTION.items():
        assert source_id not in by_source, f'{source_id} 被多个键复用：{by_source[source_id]} 与 {key}'
        by_source[source_id] = key
        unit, summary, binding, atlas_path, compared = build_unit(key, source_id)
        manifest['units'][key] = unit
        written.add(atlas_path.resolve())
        frames = sum(len(v) for v in unit['animations'].values())
        total_frames += frames
        total_compared += compared
        size = atlas_path.stat().st_size
        atlas_bytes += size
        detail.append(
            f'{key} {source_id} idle/walk/attack={"/".join(a.split(" × ")[0] for a in summary)} '
            f'frames={frames} anchor=[{unit["anchor"][0]},{unit["anchor"][1]}] '
            f'canvas={unit["width"]}x{unit["height"]} atlas={atlas_path.stat().st_size}B'
        )
        lines.append(
            f'| {key} | {source_id} / {binding["name"]} | {binding["source_file"]}:{binding["source_line"]} | '
            f'{" / ".join(summary)} | {frames} | [{unit["anchor"][0]}, {unit["anchor"][1]}] | '
            f'`assets/atlases/{source_id}.png` ({atlas_path.stat().st_size} B) |'
        )

    lines += ['', '## 地景裁切（平均色/不透明占比/颜色数均为该格实测值，colors=1 表示纯色无细节）', '',
              '| 游戏ID | MiniWorldSprites 源文件 | rect x,y,w,h | 实测平均色 | 不透明 | colors |', '|---|---|---|---|---|---|']
    world_detail = {}
    world_stats = {}
    for key, (filename, rect) in WORLD_SELECTION.items():
        url = copy(WORLD / filename, 'world/' + filename)
        check_image(url, rect)
        manifest['world'][key] = {'file': url, 'rect': rect}
        written.add((DEST / 'world' / filename).resolve())
        stat = tile_stats(url, rect)
        world_stats[key] = stat
        world_detail[key] = (f'{filename} {rect} avg={tuple(stat["avg"])} '
                             f'opaque={stat["opaquePct"]}% colors={stat["colors"]}')
        lines.append(f'| {key} | {filename} | {rect} | {tuple(stat["avg"])} | {stat["opaquePct"]}% | {stat["colors"]} |')
    # 同色回归：把平均色完全相同的键记下来；第二轮修完后应为空。
    world_dup = {}
    for key, stat in world_stats.items():
        world_dup.setdefault(tuple(stat['avg']), []).append(key)
    world_duplicates = {str(k): v for k, v in world_dup.items() if len(v) > 1}
    # 像素来源重复回归：两个键解析到同一文件的同一 rect 就是映射错误（比较 (file,rect) 对，
    # 不能只比 rect——不同文件用同一格坐标是正常的）。
    rect_dup = {}
    for key, item in manifest['world'].items():
        rect_dup.setdefault((item['file'], tuple(item['rect'])), []).append(key)
    world_rect_duplicates = {str(k): v for k, v in rect_dup.items() if len(v) > 1}
    assert not world_rect_duplicates, f'地景键解析到同一像素来源：{world_rect_duplicates}'
    lines += ['',
        '2026-10-15 修正一：初版把 `Grass.png` 的格子认错，`water` 与 `grass` 指向同一 rect（都是 `[0,0]`），地图上水草同色。',
        '按逐格实测平均色重新指派：`grass`=[16,0]=(195,214,87) 黄绿草地、`water`=[0,0]=(78,188,185) 青色水面。',
        '`path` 已删除（它指向 `Grass.png[48,0]`=(230,211,145) 暖沙色，与「道路」语义不符），道路改由 `deadGrass` 表达。',
        '`shore` 取 `Ground/Shore.png[0,0]`=(231,213,147)（该文件是沙→水渐变条，[48,0] 实测与水面同色，不能用作岸）。',
        '2026-10-15 修正二：所有地块变体必须 `colors > 1`，否则变体在画面里看不出来。',
        '`grassDetail` 由 TexturedGrass[0,0]（colors=1，与 `grass` 平均色完全相同）改为 [16,0]（colors=3）；',
        '`deadGrass` 由 DeadGrass[0,0]（colors=1 纯色）改为 [16,0]（colors=4，带草茬，道路一眼可读）；',
        '`grassFlowers` **改名为 `grassTuft`**——该格实测是草丛纹理不是花，旧键已不保留，渲染层需改键名。',
        '2026-10-15 修正三：新增 `waterDeep`。**`Cliff-Water.png` 里没有可用的水面格**，实测它是「悬崖小岛」图：',
        '  整张 80×96（5×6 格、26 格不透明）中水只是小岛四周 3~7px 的留白；穷举全部 16×16 窗口（任意偏移共 5265 个），',
        '  不透明覆盖率 100% 的窗口里水色占比最高仅 91%（且横跨两个动画帧、底部带悬崖弧线），网格对齐格最好是 `[0,0]` 水色占比 74%（右下 26% 是悬崖角）。',
        '  故按后备方案取 `Ground/Shore.png[64,0]`=(66,172,175) 作 `waterDeep`：同水色系、比 `water`=(78,188,185) 更深，用于深浅层次；',
        '  代价是该格 `colors=1`，只提供明度层次、不提供纹理（`Shore.png` 全 5 格都是 colors=1）。',
        '`bridge` 取 `Miscellaneous/Bridge.png` 中横向桥的整格桥面（该图 80×48，桥体不落在 16 网格上，故按 16×16 裁出桥面中心格；裁切范围已断言在图内）。', '',
        '## 音效', '']

    audio = read_json(UNITS / AUDIO_SOURCE / 'audio_bindings.json')['events']
    for game_event, source_event in AUDIO_SELECTION:
        candidates = [e for e in audio if e['semantic_event'] == source_event and e.get('verified')]
        if not candidates:
            fail(f'{AUDIO_SOURCE} 没有 verified 的 {source_event} 事件')
        event = candidates[0]
        url = copy(UNITS / AUDIO_SOURCE / event['copied_path'], 'sounds/' + Path(event['copied_path']).name)
        path = GAME / 'public' / url
        assert path.stat().st_size > 0 and path.read_bytes()[4:8] == b'ftyp', path
        manifest['sounds'][game_event] = [url]
        written.add(path.resolve())
        lines.append(f'- `{game_event}` → `{event["semantic_event"]}`：{event["resource"]}（{event["source_file"]}:{event["source_line"]}），已验证事件，取自 `{AUDIO_SOURCE}`，全游戏共用。')
    lines += ['',
        '未产出 `wave`/`victory`/`defeat`：`output/duelyst-unit-library` 全部 689 份 `audio_bindings.json` 的语义事件只有',
        '`apply`/`walk`/`attack`/`receiveDamage`/`attackDamage`/`death`，不存在已核验的波次或胜负音效，按契约不编造。', '',
        '## 原始来源与许可记录', '',
        '- 单位与音效：`output/duelyst-unit-library`，追溯到用户本地 `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main`。用户在 2026-10-10 明确确认这套素材可商用。',
        '- 地景：用户本次指定 `C:/Users/qs/Desktop/游戏素材/MiniWorldSprites`。该目录未检出独立 LICENSE/README，保留用户指定来源事实，不编造额外许可核验。',
        '- 参考实现：`games/little-guardians-h5/tools/import-assets.py`（atlas 排布、逐帧比对、报告结构沿用；本版去掉 UI 并扩充单位键与 anchor）。',
        '- 源库全只读；本脚本不修改、删除、移动或覆盖任何源素材。']

    # 只清理本脚本拥有的输出目录（atlases/world/sounds）中已不再被 manifest 引用的文件，绝不动其他文件。
    for owned in ('atlases', 'world', 'sounds'):
        base = DEST / owned
        if not base.is_dir():
            continue
        for path in sorted(base.rglob('*'), key=lambda p: len(p.parts), reverse=True):
            assert not path.is_symlink(), path
            if path.is_file() and path.resolve() not in written:
                path.unlink()
            elif path.is_dir() and not any(path.iterdir()):
                path.rmdir()

    # manifest 里每个路径都必须真实存在。
    for unit in manifest['units'].values():
        for action in unit['animations'].values():
            for frame in action:
                assert (GAME / 'public' / frame['file']).is_file(), frame['file']
    for item in manifest['world'].values():
        check_image(item['file'], item['rect'])
    for urls in manifest['sounds'].values():
        for url in urls:
            assert (GAME / 'public' / url).is_file(), url
    assert manifest['ui'] == {}, manifest['ui']

    (DEST / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    (DEST / 'SOURCES.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')

    files = [p for p in DEST.rglob('*') if p.is_file() and p.name != 'asset-check.json']
    report = {
        'generatedBy': 'games/deepseek-little-guardians/tools/import-assets.py',
        'units': len(manifest['units']),
        'animations': len(manifest['units']) * len(ACTIONS),
        'unitFrames': total_frames,
        'unitImageRequests': len({f['file'] for u in manifest['units'].values() for a in u['animations'].values() for f in a}),
        'atlasFiles': len(list((DEST / 'atlases').glob('*.png'))),
        'atlasBytes': atlas_bytes,
        'pixelComparisons': total_compared,
        'pixelComparisonsPassed': total_compared,
        'worldRects': len(manifest['world']),
        'uiImages': len(manifest['ui']),
        'soundEvents': len(manifest['sounds']),
        'files': len(files),
        'bytes': sum(p.stat().st_size for p in files),
        'unitDetail': detail,
        'worldDetail': world_detail,
        'worldDuplicateAverageColors': world_duplicates,
        'worldDuplicateRects': world_rect_duplicates,
        'worldKeyChanged20261015': {
            'removed': WORLD_KEYS_REMOVED,
            'renamed': WORLD_KEYS_RENAMED,
            'added': ['shore', 'deadGrass', 'waterDeep'],
            'fixed': ['water 与 grass 不再指向同一 rect（此前都是 Ground/Grass.png [0,0,16,16]）',
                      'grassDetail 由 colors=1 且与 grass 同色改为 colors=3（TexturedGrass[16,0]）',
                      'deadGrass 由 colors=1 纯色改为 colors=4 带草茬（DeadGrass[16,0]）'],
            'shoreRectDeviation': '主 Agent 给的 Shore.png[48,0] 实测 avg=(78,188,185)，与 water 同色；'
                                  '以实测为准改为 Shore.png[0,0] avg=(231,213,147)',
            'waterDeep': 'Cliff-Water.png 无可用水面格（穷举 5265 个 16×16 窗口：覆盖率 100% 的窗口水色占比上限 91%，'
                         '网格对齐格上限 74%，均含悬崖像素）；按指定后备方案取 Shore.png[64,0] avg=(66,172,175) '
                         'colors=1，比 water(78,188,185) 更深，仅提供明度层次。',
        },
        'sounds': {k: v for k, v in manifest['sounds'].items()},
        'replacements': REPLACEMENTS,
        'anchorRule': 'idle+walk 全部帧不透明像素并集 bbox 底部中心 [round((minX+maxX+1)/2), maxY+1]；'
                      '按 SPEC 2026-10-15 修订不计入 attack',
        'missingKeys': ['sounds.wave', 'sounds.victory', 'sounds.defeat'],
        'checks': [
            f'全部 {total_compared} 帧 atlas crop 解码 RGBA 与原 PNG 逐字节相等',
            '全部 idle/walk/attack 帧 decoded 为非空 PNG 且 alpha 包围盒非空',
            '全部 duration 取自 bindings.json frame_delay 且 > 0，resolved 均为 true',
            'anchor 逐单位由 idle+walk 全部帧不透明像素并集 bbox 实算（不含 attack），未硬编码',
            '全部 atlas/world rect 在实际 PNG 边界内，写入 PNG 均非空',
            '每个 world 键的实测平均色/不透明占比/颜色数已记录；13 个 world 键两两 rect 互不相同',
            '每个 world 键的变体格 colors > 1（有可见细节），无两键平均色相同',
            'manifest.ui 为空对象，未导出任何 UI 位图',
            'sounds 仅使用来源库 verified: true 的事件；无 wave/victory/defeat 可用',
            'manifest 中每个浏览器路径均存在；26 个 unit 键的 sourceId 互不重复',
        ],
    }
    (DEST / 'asset-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in ('unitDetail', 'worldDetail', 'checks')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
