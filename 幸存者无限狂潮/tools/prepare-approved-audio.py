"""Encode only user-approved auditions into reusable action/material samples.

Run with Python; ffmpeg performs format conversion, without normalization or cuts.
"""
import json
import subprocess
import wave
from array import array
from pathlib import Path

GAME = Path(__file__).resolve().parent.parent
MEDIA = GAME / "media"
OUTPUT = GAME / "dist" / "assets" / "audio"
FFMPEG = r"C:\Users\qs\AppData\Roaming\bilibili\ffmpeg\ffmpeg.exe"

# output, approved audition, additional gain. Already attenuated shield stays at 1.
SELECTIONS = [
    ("whirlwind", "audio-redesign-v6/07-garen-judgment-first2s.wav", 1),
    ("quick-cut", "audio-redesign-v6/instant/08-instant-slash-single.wav", 1),
    ("slash-basic", "audio-redesign-v4/swords/01-basic-melee.wav", 1),
    ("magic-cast", "audio-redesign-v4/ranged/09A-magic-bolt-cast.wav", 1),
    ("sword-field", "audio-redesign-v5/swords/05-sword-field-blades.wav", 1),
    ("slash-wide", "audio-redesign-v4/mobility/23-boss-heavy-fan-slash.wav", 1),
    ("move-armored", "audio-redesign-v4/swords/02A-dash-charge.wav", 1),
    ("move-light", "audio-redesign-v4/swords/02B-dash-magical.wav", 1),
    ("blade-cut", "audio-redesign-v4/ranged/10B-orbit-blade-cut-melee.wav", 1),
    ("thunder", "audio-redesign-v4/ranged/12A-lightning-stormatha.wav", .7),
    ("summon", "audio-redesign-v4/mobility/14-summon-guard-deploy.wav", 1),
    ("summon-elite", "audio-redesign-v2/15-summon-large.wav", 1),
    ("heal", "audio-redesign-v4/mobility/16-recall-heal.wav", 1),
    ("teleport", "audio-redesign-v4/mobility/18-teleport-strike.wav", 1),
    ("teleport-combo", "audio-redesign-v4/mobility/26-teleport-triple-strike.wav", 1),
    ("shield", "audio-redesign-v2/04-guard-shield-gain80.wav", 1),
    ("blade-wave", "audio-redesign-v3/swords/06-blade-wave-travel.wav", 1),
    ("mark-blade", "audio-redesign-v3/swords/17-mark-blade-throw.wav", 1),
    ("poison", "audio-redesign-v3/ranged/13-poison-ring.wav", 1),
    ("flame-breath", "audio-redesign-v2/20-flame-3s-timeline.wav", 1),
    ("rock-rise", "audio-redesign-v2/21-rock-wall-rise.wav", 1),
    ("ground-slam", "audio-redesign-v2/25-boss-ground-slam.wav", 1),
]


def quiet_thunder_preview():
    src = MEDIA / "audio-redesign-v4/ranged/12A-lightning-stormatha.wav"
    target = MEDIA / "audio-redesign-v4/ranged/12A-lightning-stormatha-gain70.wav"
    with wave.open(str(src), "rb") as w:
        params = w.getparams()
        pcm = array("h", w.readframes(w.getnframes()))
    with wave.open(str(target), "wb") as w:
        w.setparams(params)
        w.writeframes(array("h", (round(v*.7) for v in pcm)).tobytes())


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = []
    for name, relative, gain in SELECTIONS:
        source, target = MEDIA / relative, OUTPUT / f"{name}.m4a"
        command = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(source)]
        if gain != 1:
            command.extend(["-af", f"volume={gain}"])
        command.extend(["-ac", "1", "-c:a", "aac", "-b:a", "96k", str(target)])
        subprocess.run(command, check=True)
        records.append({"sample": name, "file": f"assets/audio/{name}.m4a",
                        "source": f"media/{relative}", "additional_gain": gain,
                        "bytes": target.stat().st_size})
    quiet_thunder_preview()
    # Development provenance is not part of the package allowlist.
    (MEDIA / "approved-audio-runtime.json").write_text(json.dumps({
        "policy": "Shared samples by action/material, no resynthesis, no normalization, full approved duration",
        "items": records,
        "pending": [],
        "stored_only": ["standalone flame start", "throwing-knife audition; runtime weapon is now boomerang", "crossbow triple shot (former v5 whirlwind, explicitly reassigned by user)"],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"files": len(records), "bytes": sum(r["bytes"] for r in records)}))


if __name__ == "__main__":
    main()
