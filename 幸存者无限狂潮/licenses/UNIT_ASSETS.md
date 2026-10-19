# Unit asset provenance

Verified on 2026-10-10 against the local source trees. Machine-readable paths, hashes, dimensions and comparison results are in `unit-assets-provenance.json`.

## License basis

The local OpenDuelyst distribution states in its README that OpenDuelyst is licensed under Creative Commons Zero v1.0 Universal, and its root `LICENSE` and `COPYING` files contain the CC0 1.0 legal code. Their SHA-256 is `A2010F343487D3F7618AFFE54F789F5487602331C0A8D03F49E9A7C547CF0499`. The preserved `CC0-1.0.txt` contains the same legal text with CRLF line endings normalized to LF and non-semantic trailing blank lines; its SHA-256 is `7179683E8000E6BDC9BBC60D85EDF0A4AC8E76F951857F54FCB775D5886F1309`.

CC0 section 2 expressly covers use “for any purpose whatsoever, including without limitation commercial, advertising or promotional purposes.” Section 3 supplies a public-license fallback where the waiver is ineffective. Section 4 excludes trademark and patent rights and gives the work as-is without warranties. This is the actual local license basis for commercial reuse; it is not an attribution requirement or a warranty of title.

## Verification result

All four shipped files are byte-identical to their named files under `D:/godot/rpg`:

- `hero.png` → `f1_windbladecommander`, SHA-256 `95978E...5263`
- `grunt.png` → `f4_crawler`, SHA-256 `C99E5F...7535`
- `runner.png` → `f4_shadowdancer`, SHA-256 `4A64BA...95FF`
- `brute.png` → `f4_underworldbrute`, SHA-256 `FC3325...4CCE`

The windblade commander, crawler and shadow dancer files have different byte hashes from the OpenDuelyst `app/original_resources/units` PNGs. Both sides have the same 512×1024 dimensions, and ImageMagick `compare -metric AE` reported `0` for each pair: every decoded pixel is identical. The smaller RPG file sizes and changed hashes therefore represent PNG encoding differences, without pixel changes.

## Exception

The local OpenDuelyst tree has no `f4_underworldbrute.png`. It does contain `app/resources/units/f4_underworldbrute.plist`, whose metadata declares texture `f4_underworldbrute.png`, size 1024×1024, and 100×100 frames matching the identity and dimensions of the RPG sheet. This establishes a matching asset reference inside the CC0 distribution, but it does not prove pixel identity. The evidence records this as an unresolved local-file gap rather than inferring the missing PNG contents.
