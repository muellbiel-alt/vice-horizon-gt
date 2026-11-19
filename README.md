# Solara Bay: Heatline (V2)

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/muellbiel-alt/vice-horizon-gt/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/muellbiel-alt/vice-horizon-gt/reward.svg)](https://make.fun/bounty/gta6-01)

Open-world crime sandbox built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). Runs offline from static ES modules under `game/` with zero external network requests or third-party assets.

## Play Locally

Start the static server (Node 22+):

```bash
node serve.ts
```

Open `http://localhost:8080` in desktop Chrome.

Build the deterministic submission dossier (`out/dossier.json`):

```bash
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Studio Architecture (`game/src/`)

- **`core/`** — `config.js` (constants, 6 vehicle classes, 4 weapons, garage mods), `random.js` (Mulberry32 seeded PRNG), `input.js` (keyboard, pointer, wheel), `storage.js` (multi-slot Save/Load for `autosave`, `slot1`, `slot2`).
- **`world/`** — `districts.js` (4 coastal zones and interactive landmarks), `city.js` (3600x2600 road grid, 2.5D buildings, harbor piers, freighter, cranes, timed signals), `lighting.js` (dynamic dusk/night lighting, headlight cones, blue-red police siren washes on asphalt and facades, wet-asphalt and harbor-water neon reflections, chopper volumetric spotlight), `simulation.js` (60 Hz world orchestrator).
- **`entities/`** — `vehicles.js` (Solara V8, Kestrel GT, Atlas Hauler, Meridian Interceptor, Bastion Armored Truck, Skyhawk-7 Helicopter, Costa Customs tuning, drift skidmarks, fire/smoke damage trails), `pedestrians.js` (sidewalk strolling, gunfire panic, cash drops).
- **`systems/`** — `traffic.js` (lane-following street traffic & signal compliance), `police.js` (1–5 Star Wanted pursuit, spiked roadblocks with flares, SWAT armored trucks, overhead chopper spotlight), `combat.js` (on-foot and drive-by shooting, dodge roll, tracers, ricochet sparks, explosions), `missions.js` (5 story missions plus Midnight Heatline Street Race, Harbor Cargo Heist, and Foundry Street Bounty), `economy.js` (Vega Safehouse, Costa Customs Garage, Armory Depot, 4-district reputation).
- **`ui/`** — `render.js` (2.5D extruded renderer with sharp twilight shadows), `minimap.js` (tactical radar with search ring, roadblocks, helicopter blip), `menus.js` (Title cover, tabbed Armory/Garage, Save Slots, Results debrief), `hud.js` (Wanted stars, cash, district rep, speedometer), `shots.js` (deterministic showcase staging).
- **`audio/`** — `synth.js` (procedural Web Audio engine with RPM hum, Doppler-shifted sirens, chopper rotor pulse, gunshots, explosions, synthwave beat).

## Controls

| Action | Key / Input |
|---|---|
| Move / Steer & Drive / Fly | `W A S D` or Arrow Keys |
| Aim & Fire (on foot or drive-by) | Mouse + `Left Click` |
| Hijack / Enter / Exit / Interact | `E` |
| Sprint / Combat Dodge / Handbrake Drift | `Shift` / `Space` |
| Switch Weapons | `1` – `4` or Mouse Wheel |
| Reload | `R` |
| Open Armory Depot | `B` |
| Open Costa Customs Garage | `G` |
| Start Side Contract (Race / Heist / Bounty) | `N` |
| Mute / Unmute Audio | `M` |
| Pause & Save Slots | `P` or `Esc` |

## Screenshots

- `screenshots/1-title.jpg` — Dusk/night Solara Bay waterfront attract cover with active headlights, police sirens, and Play / Continue / Garage menu
- `screenshots/2-chase.jpg` — 4-Star Downtown Neon pursuit with Skyhawk helicopter spotlight, spiked SWAT roadblock, and radar minimap
- `screenshots/3-mission.jpg` — Harbor Docks firefight by Dockside Arms with vehicle hijack prompt, tracers, and burning syndicate van
- `screenshots/4-results.jpg` — Mission debrief summary with cash reward, district reputation gain, career stats, and Continue / Restart actions

## License

MIT — see [LICENSE](./LICENSE).
