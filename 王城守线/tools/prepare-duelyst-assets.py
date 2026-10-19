#!/usr/bin/env python3
"""Prepare a small, reproducible Duelyst sprite/audio subset for Castle Ward."""

from __future__ import annotations

import argparse
import json
import plistlib
import re
import shutil
import subprocess
from pathlib import Path

from PIL import Image


DEFAULT_DUELYST = Path(r"C:\Users\qs\Desktop\游戏素材\duelyst-main (1)\duelyst-main\app")
GAME_ROOT = Path(__file__).resolve().parents[1]
DEST = GAME_ROOT / "dist" / "assets" / "duelyst"

UNITS = {
    "militia": ("f1_silverguardsquire", 48),
    "guard": ("neutral_primusshieldmaster", 72),
    "sentinel": ("f1_ironcliffeguardian", 82),
    "berserker": ("f1_windbladecommander", 68),
    "archer": ("f1_ranged", 64),
    "ranger": ("neutral_arrowwhistler", 70),
    "sniper": ("neutral_mechaz0rcannon", 76),
    "mage": ("neutral_mercowlbearmage", 72),
    "flame": ("neutral_mercflamebloodwarlock", 72),
    "frost": ("f6_icedryad", 76),
    "storm": ("f2_stormkage", 76),
    "healer": ("neutral_healingmystic", 68),
    "summoner": ("f4_bloodmoon", 68),
    "swarm": ("critter_2", 44),
    "shaman": ("f3_aymarahealer", 70),
    "wraith": ("boss_wraith", 70),
    "juggernaut": ("f4_juggernaut", 92),
    "raider": ("neutral_mercmelee1", 60),
    "hound": ("neutral_beastphasehound", 54),
    "brute": ("boss_wolfpunch", 90),
    "boss": ("boss_chaosknight", 90),
}

EFFECTS = {
    "fire": "fx_f2_phoenixfire",
    "ice": "f6_flashfreeze",
    "lightning": "fx_chainlightning",
    "summon": "fx_summonlegendary",
}

AUDIO = {
    "build": "deploy_circle1.m4a",
    "upgrade": "sfx_artifact_equip01.m4a",
    "arrow": "sfx_neutral_valehunter_attack_swing.m4a",
    "magic": "sfx_f2_stormkage_attack_swing.m4a",
    "fire": "sfx_spell_phoenixfire.m4a",
    "ice": "sfx_f6_icedryad_attack_impact.m4a",
    "melee": "sfx_f1_ironcliffeguardian_attack_swing.m4a",
    "impact": "sfx_f1_ironcliffeguardian_attack_impact.m4a",
    "siege": "sfx_neutral_rockpulverizer_attack_impact.m4a",
    "wave": "sfx_unit_deploy_2.m4a",
}


def numbers(value: object) -> list[float]:
    return [float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", str(value or ""))]


def number(value: float) -> int | float:
    return int(value) if value.is_integer() else value


def parse_frame(data: dict) -> dict:
    atlas = numbers(data.get("frame") or data.get("textureRect"))
    source_rect = numbers(data.get("sourceColorRect") or data.get("spriteSourceSize"))
    source_size = numbers(data.get("sourceSize") or data.get("spriteSize"))
    rotated = bool(data.get("rotated", data.get("textureRotated", False)))
    width = atlas[2] if len(atlas) > 2 else 0.0
    height = atlas[3] if len(atlas) > 3 else 0.0
    source_width = source_rect[2] if len(source_rect) > 2 else (height if rotated else width)
    source_height = source_rect[3] if len(source_rect) > 3 else (width if rotated else height)
    return {
        "x": number(atlas[0] if atlas else 0.0),
        "y": number(atlas[1] if len(atlas) > 1 else 0.0),
        "width": number(width),
        "height": number(height),
        "rotated": rotated,
        # Keep explicit zeroes: runtime consumers must not replace them via truthiness.
        "sourceX": number(source_rect[0] if source_rect else 0.0),
        "sourceY": number(source_rect[1] if len(source_rect) > 1 else 0.0),
        "canvasWidth": number(source_size[0] if source_size else source_width),
        "canvasHeight": number(source_size[1] if len(source_size) > 1 else source_height),
    }


def load_frames(path: Path) -> list[tuple[str, dict]]:
    with path.open("rb") as stream:
        raw = plistlib.load(stream)["frames"]
    return sorted(((name, parse_frame(data)) for name, data in raw.items()), key=frame_order)


def frame_order(item: tuple[str, dict]) -> tuple[int, str]:
    name = item[0]
    match = re.search(r"(\d+)(?=\.[^.]+$)", name)
    return (int(match.group(1)) if match else 0, name)


def select_state(frames: list[tuple[str, dict]], unit_id: str, state: str) -> list[dict]:
    prefix = f"{unit_id}_{state}_"
    selected = [frame for name, frame in frames if name.startswith(prefix)]
    if not selected:
        raise ValueError(f"No {state!r} frames found for {unit_id}")
    return selected


def idle_metrics(atlas_path: Path, idle: list[dict]) -> tuple[int | float, int | float, int | float]:
    """Measure the union of visible idle pixels in original logical coordinates."""
    atlas = Image.open(atlas_path).convert("RGBA")
    bounds: list[tuple[int, int, int, int]] = []
    for frame in idle:
        crop = atlas.crop((
            frame["x"], frame["y"], frame["x"] + frame["width"], frame["y"] + frame["height"]
        ))
        if frame["rotated"]:
            crop = crop.transpose(Image.Transpose.ROTATE_90)
        alpha_bounds = crop.getchannel("A").getbbox()
        if alpha_bounds:
            left, top, right, bottom = alpha_bounds
            bounds.append((
                int(frame["sourceX"] + left), int(frame["sourceY"] + top),
                int(frame["sourceX"] + right), int(frame["sourceY"] + bottom),
            ))
    if not bounds:
        raise ValueError(f"Idle frames in {atlas_path.name} contain no visible pixels")
    top = min(bound[1] for bound in bounds)
    bottom = max(bound[3] for bound in bounds)
    canvas_width = max(frame["canvasWidth"] for frame in idle)
    return number(float(bottom - top)), number(float(canvas_width) / 2), number(float(bottom))


def find_ffmpeg() -> str:
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except (ImportError, RuntimeError) as exc:
        raise RuntimeError("ffmpeg or Python imageio_ffmpeg is required for M4A to MP3 conversion") from exc


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--duelyst-app", type=Path, default=DEFAULT_DUELYST)
    args = parser.parse_args()
    source = args.duelyst_app.resolve()
    resources = source / "resources"
    originals = source / "original_resources"
    DEST.mkdir(parents=True, exist_ok=True)

    manifest: dict[str, dict] = {"units": {}, "effects": {}, "audio": {}}
    for public_id, (source_id, visible_height) in UNITS.items():
        plist = resources / "units" / f"{source_id}.plist"
        png = originals / "units" / f"{source_id}.png"
        target = DEST / f"{public_id}.png"
        shutil.copy2(png, target)
        frames = load_frames(plist)
        states = {state: select_state(frames, source_id, state) for state in ("idle", "attack", "run")}
        reference_height, foot_x, foot_y = idle_metrics(png, states["idle"])
        manifest["units"][public_id] = {
            "path": f"assets/duelyst/{target.name}",
            "visibleHeight": visible_height,
            "states": states,
            "frameMs": 100,
            "referenceHeight": reference_height,
            "footX": foot_x,
            "footY": foot_y,
            "facesLeft": False,
        }

    for public_id, source_id in EFFECTS.items():
        plist = resources / "fx" / f"{source_id}.plist"
        png = originals / "fx" / f"{source_id}.png"
        target = DEST / f"effect-{public_id}.png"
        shutil.copy2(png, target)
        manifest["effects"][public_id] = {
            "path": f"assets/duelyst/{target.name}",
            "frames": [frame for _, frame in load_frames(plist)],
            "frameMs": 60,
        }

    ffmpeg = find_ffmpeg()
    for public_id, filename in AUDIO.items():
        target = DEST / f"{public_id}.mp3"
        subprocess.run(
            [ffmpeg, "-loglevel", "error", "-y", "-i", str(resources / "sfx" / filename),
             "-map_metadata", "-1", "-ac", "1", "-ar", "44100", "-b:a", "96k", str(target)],
            check=True,
        )
        manifest["audio"][public_id] = f"assets/duelyst/{target.name}"

    (DEST / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    total = sum(path.stat().st_size for path in DEST.iterdir() if path.is_file())
    print(f"Prepared {len(UNITS)} units, {len(EFFECTS)} effects, and {len(AUDIO)} sounds ({total / 1024:.0f} KiB).")


if __name__ == "__main__":
    main()
