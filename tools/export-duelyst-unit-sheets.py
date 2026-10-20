"""Copy existing complete Duelyst unit PNG atlases without changing pixels.

The user confirmed commercial use of this local source library on 2026-10-10.
Select app/original_resources/units/*.png with matching resources/units plist;
exclude prop_cranewisp.png (a prop), retain animated critters and generals.
Portraits, GIF previews, loose frames, effects and project files are excluded.
Missing PNGs are reported, never reconstructed from incomplete previews.
"""

import argparse
import hashlib
import json
from pathlib import Path
import plistlib
import re
import shutil
import struct


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path("C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_png(path, plist_path):
    raw = path.read_bytes()
    if raw[:8] != b"\x89PNG\r\n\x1a\n" or raw[12:16] != b"IHDR":
        raise ValueError(f"Invalid PNG: {path}")
    width, height = struct.unpack(">II", raw[16:24])
    data = plistlib.loads(plist_path.read_bytes())
    expected = tuple(map(int, re.findall(r"\d+", data["metadata"]["size"])))
    if expected != (width, height):
        raise ValueError(f"Atlas dimensions disagree with plist: {path}")
    actions = {}
    for name, frame in data["frames"].items():
        # TexturePacker format 2 stores the packed rectangle in 'frame'; when
        # rotated, those packed dimensions already describe the atlas bounds.
        x, y, w, h = map(int, re.findall(r"-?\d+", frame["frame"]))
        if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > width or y + h > height:
            raise ValueError(f"Frame outside atlas: {path.name}: {name}")
        action = re.sub(r"_\d+\.png$", "", name)
        prefix = path.stem + "_"
        if action.startswith(prefix):
            action = action[len(prefix):]
        actions[action] = actions.get(action, 0) + 1
    return width, height, len(data["frames"]), actions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    source = args.source.resolve()
    images = source / "app/original_resources/units"
    definitions = source / "app/resources/units"
    target = ROOT / "assets/duelyst-unit-sheets"
    report = ROOT / "output/duelyst-unit-sheets-export/manifest.json"
    if not images.is_dir() or not definitions.is_dir():
        raise FileNotFoundError("Expected Duelyst original_resources/units and resources/units")
    files = sorted(p for p in images.glob("*.png") if p.name != "prop_cranewisp.png")
    if not files:
        raise ValueError("No source unit sheets found")
    # Validate every source and destination before writing any image. Existing
    # mismatches abort the export; unrelated destination files are never deleted.
    entries = []
    for path in files:
        width, height, count, actions = validate_png(path, definitions / (path.stem + ".plist"))
        sha = digest(path)
        destination = target / path.name
        if destination.exists() and (not destination.is_file() or digest(destination) != sha):
            raise FileExistsError(f"Refusing to overwrite different destination: {destination}")
        entries.append({"name": path.name, "bytes": path.stat().st_size,
                        "sha256": sha, "width": width, "height": height,
                        "frames": count, "actions": actions})
    target.mkdir(parents=True, exist_ok=True)
    copied = 0
    for path, entry in zip(files, entries):
        destination = target / path.name
        if not destination.exists():
            shutil.copyfile(path, destination)
            copied += 1
        if digest(destination) != entry["sha256"]:
            raise ValueError(f"Copied file hash mismatch: {destination}")
    missing = sorted(p.stem + ".png" for p in definitions.glob("*.plist")
                     if not (images / (p.stem + ".png")).is_file())
    result = {"source": str(source), "target": str(target), "count": len(entries),
              "bytes": sum(x["bytes"] for x in entries),
              "frames": sum(x["frames"] for x in entries),
              "excluded": ["prop_cranewisp.png"], "missing_png_count": len(missing),
              "missing_png": missing, "files": entries}
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"count": len(entries), "copied": copied,
                      "unchanged": len(entries) - copied, "bytes": result["bytes"],
                      "frames": result["frames"], "missing_png_count": len(missing),
                      "manifest": str(report)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
