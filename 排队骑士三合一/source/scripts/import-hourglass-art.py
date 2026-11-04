"""Import existing Duelyst atlas frames, without modifying the source artwork/library."""
import argparse
import json
import plistlib
import re
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

parser = argparse.ArgumentParser()
parser.add_argument('library', type=Path)
args = parser.parse_args()
out = Path(__file__).resolve().parents[1] / 'src/assets/units'
source = 'neutral_sunsteeldefender'
meta = plistlib.loads((args.library / f'app/resources/units/{source}.plist').read_bytes())
atlas = Image.open(args.library / f'app/original_resources/units/{source}.png').convert('RGBA')
nums = lambda s: list(map(int, re.findall(r'-?\d+', s)))

def frames(action):
    result = []
    for key in sorted(k for k in meta['frames'] if f'_{action}_' in k):
        f = meta['frames'][key]
        x, y, w, h = nums(f['frame'])
        piece = atlas.crop((x, y, x+w, y+h))
        if f.get('rotated'):
            piece = piece.transpose(Image.Transpose.ROTATE_90)
        image = Image.new('RGBA', tuple(nums(f['sourceSize'])))
        sx, sy, _, _ = nums(f['sourceColorRect'])
        image.alpha_composite(piece, (sx, sy))
        result.append(image)
    return result

idle = frames('breathing') or frames('idle')
assert idle
boxes = [f.getbbox() for f in idle]
box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
action_boxes = [f.getbbox() for action in ['attack', 'hit'] for f in frames(action)]
top = min(b[1] for b in boxes + action_boxes)
bottom = max(b[3] for b in boxes + action_boxes)
scale = min(92/(box[2]-box[0]), 82/(box[3]-box[1]))
# Fixed anchors within each sequence: attack effects must not shrink the idle portrait.
cx, foot = (box[0]+box[2])/2, box[3]

def strip(sequence, width, selected=False):
    seq_boxes = [f.getbbox() for f in sequence]
    seq_top = min(b[1] for b in seq_boxes)
    seq_bottom = max(b[3] for b in seq_boxes)
    seq_radius = max(max(abs(b[0]-cx), abs(b[2]-cx)) for b in seq_boxes)
    use_scale = min(scale, 96/(seq_bottom-seq_top), (width-8)/(2*seq_radius))
    use_foot = seq_bottom if width == 160 else foot
    result = Image.new('RGBA', (width*len(sequence), 112))
    for i, f in enumerate(sequence):
        size = (round(f.width*use_scale), round(f.height*use_scale))
        cell = Image.new('RGBA', (width, 112))
        cell.alpha_composite(f.resize(size, Image.Resampling.NEAREST), (round(width/2-cx*use_scale), round(104-use_foot*use_scale)))
        alpha = cell.getchannel('A')
        solid = alpha.point(lambda a: 255 if a >= 32 else 0)
        occupied = alpha.point(lambda a: 255 if a else 0)
        ring = ImageChops.subtract(solid.filter(ImageFilter.MaxFilter(5 if selected else 3)), occupied)
        edge = Image.new('RGBA', cell.size, (255,225,102,0) if selected else (255,248,226,0))
        edge.putalpha(ring.point(lambda a: (255 if selected else 235) if a else 0))
        cell = Image.alpha_composite(edge, cell)
        assert cell.getbbox() and cell.getbbox()[0] > 0 and cell.getbbox()[2] < width, 'horizontal clipping'
        assert cell.getbbox()[1] > 0 and cell.getbbox()[3] < 112, 'vertical clipping'
        result.alpha_composite(cell, (width*i, 0))
    return result

normal = strip(idle, 100)
normal.save(out/'d_hourglass.png', optimize=True)
normal.crop((0,0,100,112)).save(out/'d_hourglass-still.png', optimize=True)
strip(idle,100,True).save(out/'d_hourglass-selected.png', optimize=True)
manifest_path = out/'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
unit = dict(image='d_hourglass.png', still='d_hourglass-still.png', selectedImage='d_hourglass-selected.png',
            frames=len(idle), durationMs=max(800,round(len(idle)*1000/12)), width=100, height=112, source=source)
for action in ['attack', 'hit']:
    seq = frames(action)
    assert seq, action
    name = f'd_hourglass-{action}.png'
    strip(seq,160).save(out/name,optimize=True)
    unit[action] = dict(image=name,frames=len(seq))
manifest['units']['d_hourglass'] = unit
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False),encoding='utf-8')
print(json.dumps(unit))
