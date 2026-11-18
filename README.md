# Solara Bay: Heatline

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/muellbiel-alt/vice-horizon-gt/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/muellbiel-alt/vice-horizon-gt/reward.svg)](https://make.fun/bounty/gta6-01)

Open-world crime sandbox built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). Runs entirely offline from static ES modules under `game/` with zero external network requests or third-party assets.

## Play Locally

Start the local static server (Node 22+):

```bash
node serve.ts
```

Open `http://localhost:8080` in desktop Chrome.

To build the deterministic submission dossier (`out/dossier.json`):

```bash
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Districts & Core Systems

Solara Bay spans a 3600x2600 map divided into four distinct coastal zones: **Palm Boulevard** (oceanfront boardwalk, beach, villas), **Downtown Neon** (skyscrapers, Meridian Plaza, Armory Depot), **Industrial Yard** (warehouses, silos, Costa Customs garage), and **Harbor Docks** (piers, shipping containers, gantry cranes, moored freighter).

- **Vehicles & Drift Physics (`game/src/vehicles.js`)**: Five classes (`Solara V8`, `Kestrel GT`, `Atlas Hauler`, `Meridian Interceptor`, `Bastion Enforcer`) with forward/lateral grip split, handbrake drifts, tire skidmarks, body damage, explosions, and vehicle hijacking (`E`).
- **AI Traffic & Pedestrians (`game/src/traffic.js`)**: Street traffic follows lane directions and timed intersection traffic lights; pedestrians walk sidewalks and flee from gunfire or sirens.
- **5-Star Wanted System (`game/src/police.js`)**: Escalates from patrol officers (1 star) to interceptor pursuit (2 stars), roadblocks (3 stars), SWAT armored vans (4 stars), and city lockdown with an overhead spotlight (5 stars). Line-of-sight evasion or respraying at Costa Customs clears heat.
- **Campaign, Side Contracts & Armory (`game/src/missions.js`)**: Five multi-stage story missions (`Dockside Ignition` through `Pier Endgame`), repeatable side jobs (`N`), and an upgrade shop (`B`) for firearms, Kevlar armor, turbo tuning, and reinforced chassis plates.
- **Combat & Controls (`game/src/combat.js`, `game/src/input.js`)**: Dual-mode on-foot and drive-by shooting (`Left Click`), dodge roll (`Space` on foot), reload (`R`), and four weapon slots (`1`-`4`).
- **Procedural Audio (`game/src/audio.js`)**: Web Audio API synthesizer for engine RPM, dual-tone sirens, gunshots, explosions, pickups, and synthwave background pulse with a mute toggle (`M`).
- **2.5D Extruded Rendering & HUD (`game/src/render.js`, `game/src/hud.js`)**: Radial roof extrusion with cast shadows, dynamic police lightbars, real-time minimap radar, and `localStorage` save/load support.

## Controls

| Action | Key / Input |
|---|---|
| Move / Steer & Drive | `W A S D` or Arrow Keys |
| Aim & Shoot (on foot or drive-by) | Mouse + `Left Click` |
| Hijack / Enter / Exit / Interact | `E` |
| Sprint / Combat Dodge / Handbrake Drift | `Shift` / `Space` |
| Switch Weapons | `1` – `4` or Mouse Wheel |
| Reload | `R` |
| Open Armory & Upgrades | `B` |
| Start Side Contract | `N` |
| Mute / Unmute Audio | `M` |
| Pause / Save Menu | `P` or `Esc` |

## Screenshots

- `screenshots/1-title.png` — Live harbor attract scene and title menu
- `screenshots/2-chase.png` — High-speed Downtown Neon police pursuit with 3 Wanted Stars
- `screenshots/3-mission.png` — Harbor Docks firefight, car hijack prompt, and Dockside Arms shop
- `screenshots/4-results.png` — Mission debrief summary with career stats and Continue / Restart actions

## License

MIT — see [LICENSE](./LICENSE).
