"""Import only the two action-system units, preserving existing art and source library."""
import importlib.util
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('v014_art', ROOT / 'scripts/import-v014-unit-art.py')
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)
OUT = ROOT / 'src/assets/units'
MAPPING = {
    'n_envoy': ('neutral_merccaster1', '传令使', '持杖白袍信使，低攻辅助轮廓'),
    'n_ritualist': ('neutral_shadowcaster', '祭仪师', '暗色举杖祭仪施术者，区别现有祭司'),
}

def main():
    manifest_path = OUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
    before = {p.name: art.digest(p) for p in OUT.glob('*.png')}
    staged = []
    records = []
    source_hashes = {}
    for uid, (source, name, reason) in MAPPING.items():
        assert not any(k != uid and v['source'] == source for k, v in manifest['units'].items()), source
        for folder, ext in [('original_resources', 'png'), ('resources', 'plist')]:
            p = art.SOURCE / 'app' / folder / 'units' / f'{source}.{ext}'
            source_hashes[p] = art.digest(p)
        frames, box, keys = art.extract(source)
        w, h = box[2] - box[0], box[3] - box[1]
        scale = min(92 / w, 82 / h)
        size = (round(w * scale), round(h * scale))
        strip = Image.new('RGBA', (100 * len(frames), 112))
        selected_strip = Image.new('RGBA', strip.size)
        first = None
        for i, frame in enumerate(frames):
            cell = Image.new('RGBA', (100, 112))
            sprite = frame.crop(box).resize(size, Image.Resampling.NEAREST)
            cell.alpha_composite(sprite, ((100 - size[0]) // 2, 104 - size[1]))
            selected = art.add_outline(cell, True)
            cell = art.add_outline(cell)
            assert cell.getbbox() and selected.getbbox()
            strip.alpha_composite(cell, (100 * i, 0))
            selected_strip.alpha_composite(selected, (100 * i, 0))
            if first is None:
                first = cell
        for suffix, img in [('', strip), ('-still', first), ('-selected', selected_strip)]:
            staged.append((OUT / f'{uid}{suffix}.png', img))
        manifest['units'][uid] = dict(image=f'{uid}.png', still=f'{uid}-still.png', selectedImage=f'{uid}-selected.png',
            frames=len(frames), durationMs=max(800, round(len(frames) * 1000 / 12)), width=100, height=112, source=source)
        records.append((uid, name, source, len(frames), reason))
    for path, img in staged:
        img.save(path, optimize=True)
    touched = {p.name for p, _ in staged}
    assert all(art.digest(OUT / name) == digest for name, digest in before.items() if name not in touched)
    assert all(art.digest(path) == digest for path, digest in source_hashes.items())
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    sources = ROOT / 'public/assets/SOURCES.md'
    text = sources.read_text(encoding='utf-8-sig')
    marker = '\n## 行动系统新增单位（2026-10-20）\n'
    if marker in text:
        text = text.split(marker)[0]
    text += marker + '\n复用用户已授权商用的 Duelyst 本地素材；不修改源素材库。使用原 idle/breathing 帧，像素最近邻缩放，100×112 单帧，脚底基准 y=104；普通与选中轮廓沿用现有导入规范。\n\n| 单位 ID | 名称 | 原素材 | 帧数 | 选择依据 |\n|---|---|---|---|---|\n'
    for row in records:
        text += '| ' + ' | '.join(map(str, row)) + ' |\n'
    for path, digest in source_hashes.items():
        text += f'\n- `{path.relative_to(art.SOURCE).as_posix()}` SHA-256 `{digest}`'
    sources.write_text(text + '\n', encoding='utf-8')
    print(json.dumps({'units': records, 'existingArtUnchanged': True, 'sourceLibraryUnchanged': True}, ensure_ascii=False))

if __name__ == '__main__':
    main()
