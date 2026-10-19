"""Build the bundled UI subset from the upstream Noto Sans SC variable TTF.

Usage: python tools/build-ui-font.py path/to/NotoSansSC.ttf
Requires fonttools[woff] (fontTools and brotli). Run after adding game copy.
"""
from pathlib import Path
import hashlib
import json
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
chars = set(chr(i) for i in range(32, 127))
for path in (root / "dist").rglob("*"):
    if path.suffix in {".html", ".js", ".css"}:
        chars.update(path.read_text(encoding="utf-8"))

font = TTFont(source)
cmap = font.getBestCmap()
# SDK messages outside authored copy retain the system CJK fallback.
covered = sorted(ord(c) for c in chars if ord(c) in cmap)
options = subset.Options()
options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
options.name_languages = [0x409]
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=covered)
subsetter.subset(font)
# Name the modified subset separately while retaining copyright and OFL records.
for name_id, value in {1: "Luxiang UI", 2: "Regular", 3: "LuxiangUI-Subset-1",
                       4: "Luxiang UI", 6: "LuxiangUI-Regular"}.items():
    font["name"].setName(value, name_id, 3, 1, 0x409)
font.flavor = "woff2"
target = root / "dist/assets/fonts/luxiang-ui.woff2"
font.save(target)
assert set(covered) <= set(TTFont(target).getBestCmap())
print(json.dumps({"glyph_characters": len(covered), "bytes": target.stat().st_size,
                  "upstream_sha256": hashlib.sha256(source.read_bytes()).hexdigest()}, indent=2))
