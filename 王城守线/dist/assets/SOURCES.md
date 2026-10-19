# Castle Ward H5 asset sources

The files in this directory are selected runtime assets for the H5 client. They were copied and renamed from the user's purchased CraftPix packs under `C:/Users/qs/asset`; the source library was not modified.

The user confirmed on 2026-10-10 that these source packs were purchased and are cleared for commercial use. No access tokens, account data, PSD files, coupon images, URL shortcuts, macOS metadata, or unused source atlases are included here.

## Terrain

| Manifest alias | Runtime files | Source pack and source files |
| --- | --- | --- |
| `terrain.field` | `terrain/field/` | `塔防/craftpix-net-665131-free-fields-tileset-pixel-art-for-tower-defense`: `1 Tiles/FieldsTile_38.png`, `1 Tiles/FieldsTile_01.png`, `2 Objects/PlaceForTower1.png`, `2 Objects/7 Decor/Tree1.png`, `2 Objects/4 Stone/7.png` |
| `terrain.river` | `terrain/river/` | `塔防/craftpix-net-680310-river-tileset-pixel-art-for-tower-defense`: `1 Tiles/1/TileFrame1_53.png`, `TileFrame1_06.png`, `TileFrame1_02.png`, `3 Animated Objects/Bridge1.png` |
| `terrain.swamp` | `terrain/swamp/` | `塔防/craftpix-net-526848-swamp-tileset-pixel-art-for-tower-defense`: `1 Tiles/SwampTile_38.png`, `SwampTile_01.png`, `2 Objects/PlaceForTower1.png`, `2 Objects/2 Tree/1.png`, `2 Objects/7 Water/1.png` |

All base and path tiles are 32 x 32 PNGs. `base.png` and `base-water.png` can repeat across the map. Field and swamp `path.png` can repeat as dirt or stone road texture; the river path tile is a stone crossing texture. Decorations have transparent backgrounds. The river bridge is an eight-frame 64 x 96 strip.

## Towers

| Manifest alias | Source pack | Selection |
| --- | --- | --- |
| `towers.archer` | `塔防/craftpix-net-658475-free-archer-towers-pixel-art-for-tower-defense` | Completed building: `2 Idle/7.png` |
| `towers.mage` | `塔防/craftpix-net-715119-mage-towers-pixel-art-for-tower-defense` | Completed building: `2 Idle/7.png` |
| `towers.guardian` | `塔防/craftpix-net-717036-guardian-towers-pixel-art-for-tower-defense` | Completed building: `2 Idle/7.png` |
| `towers.catapult` | `塔防/craftpix-net-731206-catapult-towers-pixel-art-for-tower-defense` | Completed building: `2 Idle/7.png` |

The numbered tower source files are sequential construction stages from foundation to completed building; they are not combat levels. All three gameplay levels therefore use source stage 7, with level communicated by rendered stars and particles. The legacy runtime filenames remain `idle-level-7.png`, while the manifest exposes the same strip as `completed` and keeps `idle[0]` pointed to it for older readers. Every frame is 70 x 130; the completed archer and catapult strips have six frames, and the completed mage and guardian strips have four.

## Enemies

| Manifest alias | Source pack and character | Runtime animation |
| --- | --- | --- |
| `enemies.grunt` | `塔防/craftpix-net-907280-medieval-enemy-for-td-pixel-asset-pack/1` | `D/S/U_Walk.png`, 48 x 48 frames |
| `enemies.runner` | `塔防/craftpix-net-221601-free-enemy-pixel-pack-for-top-down-defense/1` | `D/S/U_Run.png`, 96 x 96 frames |
| `enemies.armored` | `塔防/craftpix-net-907280-medieval-enemy-for-td-pixel-asset-pack/4` | `D/S/U_Walk.png`, 48 x 48 frames |
| `enemies.flyer` | `塔防/craftpix-net-221601-free-enemy-pixel-pack-for-top-down-defense/3` | `D/S/U_Fly.png`, 96 x 96 frames |
| `enemies.boss` | `塔防/craftpix-net-128438-pixel-medieval-big-enemy-for-td-sprites-pack/1` | `D/S/U_Walk.png`, 96 x 96 frames |

Every movement strip has six horizontal frames. `down`, `side`, and `up` correspond to the source prefixes `D`, `S`, and `U`. The client may mirror `side` for the opposite horizontal direction.

Enemy sheets include substantial transparent padding. Each manifest `contentBounds` entry is the union of nontransparent pixels across all six frames of one direction; `footX` uses the authored frame center and `footY` the union bottom. The renderer keeps one pixel scale per enemy type across directions, crops only the unused padding, and anchors the feet to the route. Bounds include every visible source pixel; source PNGs are unchanged.

## UI

The bundled UI PNGs and font come from `UI/craftpix-net-775352-game-user-interface-pixel-art`:

- Frames: `1 Frames/Back1.png`, `Back3.png`, and `Frame2.png`.
- Buttons and bars: all four `2 Bars/Button*.png` files and both `Loading_bar*.png` files.
- HUD icons: numbered backed icons 1, 2, 26, 38, 56, 58, 94, and 105, renamed by their intended gameplay meaning.
- Font: `6 Font/CraftPixNet Survival Kit.otf`, renamed to `survival-kit.otf`.

The included pixel font is intended for Latin glyphs. Chinese labels should use a bundled Chinese font if one is later selected, or the platform's Chinese system font fallback. Render PNGs with nearest-neighbor filtering and integer scaling to preserve crisp pixel edges.

Version 0.1.5 battle controls use original CSS wood/metal bevels and inline SVG coin, upgrade chevrons, crown, and demolition hammer authored for this game. Tower previews reuse the completed tower sprites above. Kingdom Rush was used as a reference for compact contextual controls and price hierarchy; no Ironhide artwork or interface assets are included.

Version 0.3.0 uses unchanged purchased PNGs from `UI/craftpix-net-240581-warforge-mobile-ui/Textures/Buttons/Icons/`. Runtime `ui/action/` mapping: `upgrade.png` ← `Arrow_Up.png`, `demolish.png` ← `Hammer.png`, `back.png` ← `Arrow_Left.png`, `close.png` ← `Decline.png`, `pause.png` ← `Pause_Small.png`, `play.png` ← `Play.png`, `max-level.png` ← `Star.png`, `reinforce.png` ← `Shield.png`, and `rally.png` ← `Flag.png`. Fast-forward combines two instances of `play.png`; the current speed remains a text value. Native icon aspect ratios are preserved with `object-fit: contain`. Source files are copied byte-for-byte; no generated art is added.

## Duelyst units, effects, sounds and ability art (0.4.0)

The user explicitly authorized commercial use of their Duelyst library at `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main`. The selected subset includes 21 unique unit atlases, 4 effect atlases, 10 short sound effects, and `original_resources/icons/icon_f2_phoenixfire.png` as runtime `ui/action/meteor-sheet.png`. Twelve player-facing aliases cover guard, sentinel, berserker, three ranged troops, four casters, healer, and summoner silhouettes; the earlier `sentinel`, `frost`, `flame`, and `storm` source mappings remain intact. Five earlier enemy aliases and four open-field enemy fallbacks are retained alongside `militia`. Exact source paths and the visually inspected role mapping are recorded in [duelyst/SOURCES.md](duelyst/SOURCES.md). PNG atlases remain unchanged; plist animation metadata is parsed into the runtime manifest, and M4A sounds are converted to mono 96 kbps MP3. The original library is unchanged. Preparation entry point: `tools/prepare-duelyst-assets.py`.
