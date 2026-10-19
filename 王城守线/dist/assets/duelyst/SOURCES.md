# Duelyst asset subset

Source library: `C:/Users/qs/Desktop/游戏素材/duelyst-main (1)/duelyst-main/app`

The preparation script copies original atlas PNG files from `original_resources`, parses their matching TexturePacker plist files from `resources`, and converts selected short M4A effects to mono MP3. The source library is read only.

## Units

All units export `idle`, `attack`, and `run` states from the same named frame prefixes. `referenceHeight` and `footY` are measured from the union of nontransparent pixels across all idle frames after restoring each packed frame to its logical source coordinates. `footX` remains the original logical canvas center. The selected atlases face right by default (`facesLeft: false`).

| Manifest id | Source atlas and plist | Role |
| --- | --- | --- |
| `militia` | `f1_silverguardsquire` | barracks soldier |
| `guard` | `neutral_primusshieldmaster` | shield-bearing player guard |
| `sentinel` | `f1_ironcliffeguardian` | large player sentinel |
| `berserker` | `f1_windbladecommander` | dual-blade player melee unit |
| `archer` | `f1_ranged` | player bow unit |
| `ranger` | `neutral_arrowwhistler` | player fire-bow unit |
| `sniper` | `neutral_mechaz0rcannon` | player shoulder-cannon unit |
| `mage` | `neutral_mercowlbearmage` | player staff-bearing mage |
| `flame` | `neutral_mercflamebloodwarlock` | player flame caster |
| `frost` | `f6_icedryad` | player frost archer |
| `storm` | `f2_stormkage` | player storm caster |
| `healer` | `neutral_healingmystic` | player healing mystic |
| `summoner` | `f4_bloodmoon` | player summoner |
| `swarm` | `critter_2` | small fast enemy |
| `shaman` | `f3_aymarahealer` | healer enemy |
| `wraith` | `boss_wraith` | magic resistant ghost enemy |
| `juggernaut` | `f4_juggernaut` | armored elite enemy |
| `raider` | `neutral_mercmelee1` | light humanoid enemy fallback |
| `hound` | `neutral_beastphasehound` | quadruped enemy fallback |
| `brute` | `boss_wolfpunch` | large brawler enemy fallback |
| `boss` | `boss_chaosknight` | large armored boss fallback |

Unit plist path: `resources/units/<source-id>.plist`  
Unit PNG path: `original_resources/units/<source-id>.png`

## Effects

| Manifest id | Source atlas and plist |
| --- | --- |
| `fire` | `fx_f2_phoenixfire` |
| `ice` | `f6_flashfreeze` |
| `lightning` | `fx_chainlightning` |
| `summon` | `fx_summonlegendary` |

Effect plist path: `resources/fx/<source-id>.plist`  
Effect PNG path: `original_resources/fx/<source-id>.png`

## Ability icon

| Runtime file | Source file |
| --- | --- |
| `../ui/action/meteor-sheet.png` | `original_resources/icons/icon_f2_phoenixfire.png` |

## Audio

All source files are under `resources/sfx/`.

| Manifest id | Source file |
| --- | --- |
| `build` | `deploy_circle1.m4a` |
| `upgrade` | `sfx_artifact_equip01.m4a` |
| `arrow` | `sfx_neutral_valehunter_attack_swing.m4a` |
| `magic` | `sfx_f2_stormkage_attack_swing.m4a` |
| `fire` | `sfx_spell_phoenixfire.m4a` |
| `ice` | `sfx_f6_icedryad_attack_impact.m4a` |
| `melee` | `sfx_f1_ironcliffeguardian_attack_swing.m4a` |
| `impact` | `sfx_f1_ironcliffeguardian_attack_impact.m4a` |
| `siege` | `sfx_neutral_rockpulverizer_attack_impact.m4a` |
| `wave` | `sfx_unit_deploy_2.m4a` |

Run `python tools/prepare-duelyst-assets.py` from the game directory to reproduce the generated subset.
