"""Copy only selected, restored library frames. Run from any directory with Python/Pillow.
Sources are read-only; no recomposition, recoloring or guessed playback timing.
"""
import json
import math
import shutil
from pathlib import Path
from PIL import Image

GAME = Path(__file__).resolve().parents[1]
ROOT = GAME.parents[1]
UNITS = ROOT / 'output/duelyst-unit-library/units'
UI = ROOT / 'output/fantasy-ui-library'
WORLD = Path('C:/Users/qs/Desktop/游戏素材/MiniWorldSprites')
DEST = GAME / 'public/assets'
SELECTION = {
    'shield-1': 'f1_silverguardsquire', 'shield-2': 'f1_tank',
    'shield-3': 'f1_ironcliffeguardian', 'archer-1': 'f1_backlinearcher',
    'archer-2': 'f1_ranged', 'archer-3': 'neutral_arrowwhistler',
    'engineer': 'neutral_artificer', 'grunt': 'neutral_ghoulie',
    'siege': 'neutral_golemstone', 'flyer': 'f1_gryphinox',
    'boss': 'boss_borealjuggernaut', 'hero': 'f1_general',
}
WORLD_SELECTION = {
    'grass': ('Ground/Grass.png', [16, 0, 16, 16]),
    'grassDetail': ('Ground/TexturedGrass.png', [0, 0, 16, 16]),
    'grassFlowers': ('Ground/TexturedGrass.png', [32, 16, 16, 16]),
    'path': ('Ground/Grass.png', [48, 0, 16, 16]),
    'water': ('Ground/Grass.png', [0, 0, 16, 16]),
    'tree': ('Nature/Trees.png', [16, 0, 16, 16]),
    'rock': ('Nature/Rocks.png', [0, 0, 16, 16]),
    'keep': ('Buildings/Wood/Keep.png', [0, 0, 32, 32]),
    'tower': ('Buildings/Wood/Tower.png', [0, 16, 16, 16]),
    'wall': ('Buildings/Enemy/SpearWall.png', [0, 0, 16, 16]),
    'slow': ('Nature/Wheatfield.png', [16, 0, 16, 16]),
}
UI_SELECTION = {
    'wideNormal': 'buttons.wide-normal', 'widePressed': 'buttons.wide-pressed-edited',
    'squareNormal': 'buttons.square-normal', 'squarePressed': 'buttons.square-pressed-edited',
    'roundNormal': 'buttons.round-normal', 'roundPressed': 'buttons.round-pressed-edited',
    'coin': 'icons.coin', 'pause': 'icons.pause', 'play': 'icons.play',
    'close': 'icons.close', 'spellHeal': 'icons.spell-leaf', 'spellFreeze': 'icons.crystal',
    'star': 'stars.small', 'barFrame': 'bars.red-frame', 'barRed': 'bars.red-fill',
    'barGreen': 'bars.green-fill', 'barBlue': 'bars.blue-fill', 'panel': 'panels.compact',
}

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def copy(source, relative):
    target = DEST / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    return 'assets/' + relative.replace('\\', '/')

def check_image(file, rect=None):
    path = GAME / 'public' / file
    with Image.open(path) as image:
        image.load()
        assert image.format == 'PNG', path
        assert image.getbbox(), f'Empty image: {path}'
        if rect:
            x,y,w,h = rect
            assert x >= 0 and y >= 0 and w > 0 and h > 0
            assert x+w <= image.width and y+h <= image.height, (path, rect, image.size)
        return image.size

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    manifest = {'units': {}, 'world': {}, 'ui': {}, 'sounds': {}}
    lines = ['# 小小守护者实际使用素材', '',
        '导入脚本 `tools/import-assets.py` 只读取源库、复制下列实际使用PNG及少量M4A。',
        '动画帧为单位库已还原旋转和裁切的原像素PNG，按sourceId无损排入一张atlas；未使用总览或preview代替游戏素材。',
        'atlas rect保留每帧完整原画布，不缩放、不裁透明区、不改变RGBA像素。535帧仅引用12张单位图，减少手机宿主请求。',
        'width/height为导出帧画布；offset=[0,0]，没有再次裁切。时长取bindings的frame_delay（秒）。', '',
        '## 单位映射与动作', '', '| 游戏ID | 源ID / 原单位 | 来源绑定 | idle/walk/attack帧数与秒/帧 |',
        '|---|---|---|---|']
    legacy_generated = set()
    for key, source_id in SELECTION.items():
        source = UNITS / source_id
        binding = read(source / 'bindings.json')['cards'][0]
        unit = {'width': 0, 'height': 0, 'animations': {}, 'sourceId': source_id}
        summary = []
        source_frames = []
        for action in ('idle', 'walk', 'attack'):
            animation = binding['animations'][action]
            assert animation['resolved'] and animation['frames'] and animation['frame_delay'] > 0
            frames = []
            for index, frame in enumerate(animation['frames']):
                with Image.open(source / frame) as original:
                    original.load()
                    assert original.format == 'PNG' and original.getbbox(), source / frame
                    pixels = original.convert('RGBA')
                width,height = pixels.size
                unit['width'] = max(unit['width'], width)
                unit['height'] = max(unit['height'], height)
                output = {'file': f'assets/atlases/{source_id}.png', 'offset': [0,0], 'duration': animation['frame_delay']}
                frames.append(output)
                source_frames.append((pixels, output))
                legacy_generated.add(f'{source_id}/{action}/{index:04d}.png')
            unit['animations'][action] = frames
            summary.append(f'{len(frames)} × {animation["frame_delay"]}')
        columns = max(1, min(len(source_frames), 1024 // unit['width']))
        atlas = Image.new('RGBA', (columns * unit['width'], math.ceil(len(source_frames) / columns) * unit['height']))
        for index, (pixels, output) in enumerate(source_frames):
            x,y = index % columns * unit['width'], index // columns * unit['height']
            # No alpha mask: even RGB bytes under transparent pixels are preserved.
            atlas.paste(pixels, (x,y))
            output['rect'] = [x,y,*pixels.size]
        atlas_path = DEST / 'atlases' / f'{source_id}.png'
        atlas_path.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(atlas_path, optimize=True)
        with Image.open(atlas_path) as decoded:
            decoded.load()
            assert decoded.format == 'PNG'
            for pixels, output in source_frames:
                x,y,w,h = output['rect']
                assert 0 <= x < x+w <= decoded.width and 0 <= y < y+h <= decoded.height
                assert decoded.crop((x,y,x+w,y+h)).tobytes() == pixels.tobytes(), (source_id, output['rect'])
        manifest['units'][key] = unit
        lines.append(f'| {key} | {source_id} / {binding["name"]} | {binding["source_file"]}:{binding["source_line"]} | {" / ".join(summary)} |')
    lines += ['', '## 地景裁切', '', '| 游戏ID | MiniWorldSprites源文件 | rect x,y,w,h |', '|---|---|---|']
    for key, (filename, rect) in WORLD_SELECTION.items():
        url = copy(WORLD / filename, 'world/' + filename)
        check_image(url, rect)
        manifest['world'][key] = {'file': url, 'rect': rect}
        lines.append(f'| {key} | {filename} | {rect} |')
    generated_world = DEST / 'world-generated/skin.json'
    if generated_world.exists():
        for key, asset in read(generated_world).items():
            check_image(asset['file'], asset['rect'])
            manifest['world'][key] = asset
        lines.append('2026-10-14运行草地、营地、箭塔、木墙、减速工事、树石由image_gen生成资源覆盖；映射见world-generated/skin.json，原图及裁片记录见output/art-concepts/generated-ui/world-slicing.json，重建入口tools/import-generated-world.py。上表保留旧素材来源，地图格子、碰撞和数值不变。')
    assets = {a['id']: a for a in read(UI / 'manifest.json')['assets']}
    lines += ['', 'wall使用一段原SpearWall，slow使用一格Wheatfield地形标识；原文件内其他变体不被渲染。', '', '## UI', '']
    generated_skin = DEST / 'ui-generated/skin.json'
    if generated_skin.exists():
        manifest['ui'] = read(generated_skin)
        for url in manifest['ui'].values():
            check_image(url)
        lines.append('2026-10-14用户要求UI改用image_gen原创素材。当前皮肤为ui-generated/skin.json中的按钮正常/按下/禁用状态、深木面板与16种图标；不再引用CraftPix皮肤。原图与切片SHA256记录在output/art-concepts/generated-ui/，重建入口tools/import-generated-ui.py。单位卡面复用原始索引，不重绘单位。')
    else:
        for key, asset_id in UI_SELECTION.items():
            item = assets[asset_id]
            url = copy(UI / item['file'], 'ui/' + Path(item['file']).name)
            check_image(url)
            manifest['ui'][key] = url
            lines.append(f'- {key}: {asset_id}；原PSD图层/派生状态 {item.get("sourceLayerPaths", item.get("state"))}。')
    lines += ['', '## 音效', '']
    audio = read(UNITS / 'f1_tank/audio_bindings.json')['events']
    for game_event, source_event in [('attack','attack'), ('hit','receiveDamage'), ('death','death')]:
        event = next(e for e in audio if e['semantic_event'] == source_event and e['verified'])
        url = copy(UNITS / 'f1_tank' / event['copied_path'], 'sounds/' + Path(event['copied_path']).name)
        manifest['sounds'][game_event] = [url]
        lines.append(f'- {game_event}: {event["resource"]}；{event["source_file"]}:{event["source_line"]}。游戏共用该已验证事件音效，未复制全部单位声音。')
    lines += ['', '## 原始来源与许可记录', '',
        '- 单位：`output/duelyst-unit-library`，追溯到用户的 `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main`。用户2026-10-10明确确认这套素材可商用；本记录不另行推断其他库授权。',
        '- UI：`output/fantasy-ui-library`，源 `C:/Users/qs/asset/UI/craftpix-net-260778-mobile-fantasy-game-interface/mobile_fantasy_game_interface.psd`。原包license.txt记录 https://craftpix.net/file-licenses/；按下态采用该用户库已编辑导出的版本，未改原PSD。',
        '- 地景：用户本次指定 `C:/Users/qs/Desktop/游戏素材/MiniWorldSprites`。该本地目录未检出独立LICENSE/README，保留用户指定来源事实，不编造额外许可核验。',
        '- source库全只读；本脚本不修改、删除或覆盖源素材。']
    (DEST / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    (DEST / 'SOURCES.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')
    # Delete only this importer’s obsolete generated frame tree, after all new
    # manifest images passed pixel comparison. Never remove unknown user assets.
    legacy = (DEST / 'units').resolve()
    intended = (GAME / 'public/assets/units').absolute()
    assert legacy == intended and legacy.is_relative_to(ROOT.resolve()), legacy
    if legacy.exists():
        for path in legacy.rglob('*'):
            assert not path.is_symlink() and path.resolve().is_relative_to(legacy), path
            if path.is_file():
                assert path.relative_to(legacy).as_posix() in legacy_generated, f'Unknown asset, kept: {path}'
        assert all(not frame['file'].startswith('assets/units/') for u in manifest['units'].values() for a in u['animations'].values() for frame in a)
        shutil.rmtree(legacy)
    files = [p for p in DEST.rglob('*') if p.is_file() and p.name not in ('inspect.png','inspect2.png','asset-check.json')]
    report = {'units': len(manifest['units']), 'animations': len(manifest['units'])*3,
        'frames': sum(len(a) for u in manifest['units'].values() for a in u['animations'].values()),
        'unitImageRequests': len({f['file'] for u in manifest['units'].values() for a in u['animations'].values() for f in a}),
        'worldRects': len(manifest['world']), 'uiImages': len(manifest['ui']),
        'files': len(files), 'bytes': sum(p.stat().st_size for p in files),
        'checks': ['All 535 atlas regions equal original decoded RGBA pixels', 'All idle/walk/attack frames decoded as nonempty PNG', 'Positive source-bound animation delays', 'All atlas/world rects within actual PNG bounds', 'All manifest browser paths exist', 'Obsolete frame tree contains only verified generated files and has no manifest references']}
    (DEST / 'asset-check.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))

if __name__ == '__main__':
    main()
