"""Import Duelyst unit sprites into src/assets/units, without modifying the source artwork.

Usage:
  python scripts/import-unit-art.py --plists DIR source=key [source=key ...]

- Atlases come from the repository's sprite library (assets/duelyst-unit-sheets/<source>.png) unless --atlases is given.
- Frame data (<source>.plist) comes from OpenDuelyst (app/resources/units/<source>.plist, CC0); pass the folder with --plists.
- For each pair, writes <key>.png (idle strip), <key>-still.png, <key>-selected.png, <key>-attack.png, <key>-hit.png
  and adds or replaces manifest.json["units"][key].
"""
import argparse
import json
import plistlib
import re
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--plists', type=Path, required=True)
parser.add_argument('--atlases', type=Path, default=ROOT.parents[1] / 'assets/duelyst-unit-sheets')
parser.add_argument('pairs', nargs='+', help='source=key, e.g. f1_sunriser=l_sunriser')
args = parser.parse_args()
out = ROOT / 'src/assets/units'
nums = lambda s: list(map(int, re.findall(r'-?\d+', s)))


def load_frames(meta, atlas, action):
    result = []
    for key in sorted(k for k in meta['frames'] if f'_{action}_' in k):
        f = meta['frames'][key]
        x, y, w, h = nums(f['frame'])
        if f.get('rotated'):
            w, h = h, w
        piece = atlas.crop((x, y, x + w, y + h))
        if f.get('rotated'):
            piece = piece.transpose(Image.Transpose.ROTATE_90)
        image = Image.new('RGBA', tuple(nums(f['sourceSize'])))
        sx, sy, _, _ = nums(f['sourceColorRect'])
        image.alpha_composite(piece, (sx, sy))
        result.append(image)
    return result


def import_unit(source, key, manifest):
    meta = plistlib.loads((args.plists / f'{source}.plist').read_bytes())
    atlas = Image.open(args.atlases / f'{source}.png').convert('RGBA')
    expected = meta.get('metadata', {}).get('size')
    if expected:
        assert tuple(nums(expected)) == atlas.size, f'{source}: atlas size {atlas.size} != plist {expected}'
    frames = lambda action: load_frames(meta, atlas, action)
    idle = frames('breathing') or frames('idle')
    assert idle, f'{source}: no idle frames'
    boxes = [f.getbbox() for f in idle]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    scale = min(92 / (box[2] - box[0]), 82 / (box[3] - box[1]))
    # Fixed anchors within each sequence: attack effects must not shrink the idle portrait.
    cx, foot = (box[0] + box[2]) / 2, box[3]

    def strip(sequence, width, selected=False):
        seq_boxes = [f.getbbox() for f in sequence if f.getbbox()]
        seq_top = min(b[1] for b in seq_boxes)
        seq_bottom = max(b[3] for b in seq_boxes)
        seq_radius = max(max(abs(b[0] - cx), abs(b[2] - cx)) for b in seq_boxes)
        use_scale = min(scale, 96 / (seq_bottom - seq_top), (width - 8) / (2 * seq_radius))
        use_foot = seq_bottom if width == 160 else foot
        result = Image.new('RGBA', (width * len(sequence), 112))
        for i, f in enumerate(sequence):
            size = (max(1, round(f.width * use_scale)), max(1, round(f.height * use_scale)))
            cell = Image.new('RGBA', (width, 112))
            cell.alpha_composite(f.resize(size, Image.Resampling.NEAREST), (round(width / 2 - cx * use_scale), round(104 - use_foot * use_scale)))
            alpha = cell.getchannel('A')
            solid = alpha.point(lambda a: 255 if a >= 32 else 0)
            occupied = alpha.point(lambda a: 255 if a else 0)
            ring = ImageChops.subtract(solid.filter(ImageFilter.MaxFilter(5 if selected else 3)), occupied)
            edge = Image.new('RGBA', cell.size, (255, 225, 102, 0) if selected else (255, 248, 226, 0))
            edge.putalpha(ring.point(lambda a: (255 if selected else 235) if a else 0))
            cell = Image.alpha_composite(edge, cell)
            bb = cell.getbbox()
            if bb:
                assert bb[0] >= 0 and bb[2] <= width and bb[1] >= 0 and bb[3] <= 112, f'{source}: clipping'
            result.alpha_composite(cell, (width * i, 0))
        return result

    normal = strip(idle, 100)
    normal.save(out / f'{key}.png', optimize=True)
    normal.crop((0, 0, 100, 112)).save(out / f'{key}-still.png', optimize=True)
    strip(idle, 100, True).save(out / f'{key}-selected.png', optimize=True)
    unit = dict(image=f'{key}.png', still=f'{key}-still.png', selectedImage=f'{key}-selected.png',
                frames=len(idle), durationMs=max(800, round(len(idle) * 1000 / 12)), width=100, height=112, source=source)
    for action in ['attack', 'hit']:
        seq = frames(action)
        if not seq:
            continue
        name = f'{key}-{action}.png'
        strip(seq, 160).save(out / name, optimize=True)
        unit[action] = dict(image=name, frames=len(seq))
    manifest['units'][key] = unit
    return unit


manifest_path = out / 'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
for pair in args.pairs:
    source, key = pair.split('=')
    unit = import_unit(source, key, manifest)
    print(key, source, unit['frames'], 'attack' in unit, 'hit' in unit)
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False), encoding='utf-8')
