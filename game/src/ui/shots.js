// Deterministic screenshot scene choreographer for ?shot=title|chase|mission|results.

import { STEP } from '../core/config.js';
import { SCREEN_PLAY, SCREEN_RESULTS, SCREEN_TITLE } from './hud.js';

const NULL_INPUT = { mouse: { x: 640, y: 360, down: false, rightDown: false }, isDown: () => false, consumePress: () => false, axisMove: () => ({ x: 0, y: 0 }), consumeClick: () => false, consumeWheel: () => 0 };

export function stageShot(name, world) {
  world.reset();
  if (name === 'title' || name === 'start') {
    world.vehicles.spawnVehicle('coupe', 2980, 1968, 0, { driver: 'traffic', color: '#f0a326', underglow: true }).vx = 170;
    world.vehicles.spawnVehicle('muscle', 3180, 1912, Math.PI, { driver: 'traffic', color: '#e04538' }).vx = -165;
    Object.assign(world.vehicles.spawnVehicle('police', 2745, 1912, 0, { driver: 'police', sirenOn: true }), { vx: 160, sirenPhase: 0.8 });
    world.vehicles.spawnVehicle('police', 3250, 1968, Math.PI, { driver: 'police', sirenOn: true }).sirenPhase = 3.9;
    for (let i = 0; i < 24; i += 1) world.stepAttract(STEP);
    world.cameraX = 2785; world.cameraY = 1975;
    return { screen: SCREEN_TITLE, hasSave: true };
  }

  if (name === 'chase' || name === 'play') {
    world.missions.state.storyIndex = 2; world.missions.state.stepIndex = 1; world.missions.setupStep();
    world.missions.setDialogue('ELENA SOLIS', 'Chopper spotlight locked and spiked roadblock ahead on Meridian Ave!', 5);
    Object.assign(world.player.upgrades, { turbo: true, underglow: true });
    world.economy.reputation.downtown = 45; Object.assign(world.player, { cash: 3850, weaponIndex: 1, armor: 78 });
    world.player.arsenal.smg.owned = true;

    const car = world.vehicles.spawnVehicle('muscle', 1520, 985, -Math.PI * 0.44, { color: '#e04f2a', hp: 150, underglow: true });
    world.enterVehicle(car); Object.assign(car, { vx: 95, vy: -420, speed: 430, drifting: true });
    for (let k = 0; k < 15; k += 1) {
      world.vehicles.addSkid(1504 - k * 1.1, 1170 - k * 14, 1502 - k * 1.1, 1156 - k * 14);
      world.vehicles.addSkid(1532 - k * 1.1, 1170 - k * 14, 1530 - k * 1.1, 1156 - k * 14);
    }
    world.police.setMinimumWanted(4, car.x, car.y); world.stats.wantedPeak = 4;
    world.police.placeRoadblockAt(1520, 710, true, true);
    Object.assign(world.vehicles.spawnVehicle('police', 1468, 1142, -Math.PI * 0.47, { driver: 'police', sirenOn: true }), { vx: 35, vy: -325, speed: 327, sirenPhase: 0.7 });
    Object.assign(world.vehicles.spawnVehicle('police', 1574, 1172, -Math.PI * 0.54, { driver: 'police', sirenOn: true }), { vx: -25, vy: -315, speed: 316, sirenPhase: 3.8 });
    world.vehicles.spawnVehicle('coupe', 1310, 888, 0, { driver: 'traffic', color: '#21a0a0' });
    world.vehicles.spawnVehicle('van', 1775, 834, Math.PI, { driver: 'traffic', color: '#ced4da' });

    for (let i = 0; i < 8; i += 1) {
      world.vehicles.applyVehiclePhysics(car, 1, 0.34, true, STEP, world.player.upgrades);
      world.player.x = car.x; world.player.y = car.y; world.stepPlay(STEP, NULL_INPUT);
    }
    const sp = world.police.spotlight;
    Object.assign(sp, { active: true, x: car.x + 8, y: car.y - 8, heliX: car.x + 225, heliY: car.y - 175, rotorAngle: 0.7 });
    sp.heliAngle = Math.atan2(sp.y - sp.heliY, sp.x - sp.heliX);
    world.spawnSparks(car.x - 16, car.y + 30, 10); world.spawnSmoke(car.x - 14, car.y + 34, '#92a2b8', 11);
    world.cameraX = car.x + 22; world.cameraY = car.y - 52;
    return { screen: SCREEN_PLAY, hasSave: true };
  }

  if (name === 'mission') {
    world.missions.state.storyIndex = 3; world.missions.state.stepIndex = 1; world.missions.setupStep();
    world.missions.setDialogue('MARCO VEGA', 'Dockside Arms behind me. Clear Iron Tide and boost that Kestrel GT!', 5);
    Object.assign(world.economy.reputation, { harbor: 55, downtown: 40 });
    Object.assign(world.player, { x: 2475, y: 1990, aimAngle: 0.08, cash: 4250, hp: 88, armor: 72, weaponIndex: 3 });
    world.player.arsenal.carbine = { owned: true, mag: 22, reserve: 112 };
    world.player.arsenal.smg.owned = world.player.arsenal.shotgun.owned = true;

    world.vehicles.spawnVehicle('coupe', 2532, 1936, 0.06, { driver: 'none', color: '#f0a326', underglow: true });
    Object.assign(world.vehicles.spawnVehicle('police', 2285, 1915, 0.06, { driver: 'police', sirenOn: true }), { vx: 175, sirenPhase: 0.9 });
    const van = world.vehicles.spawnVehicle('van', 2755, 1914, Math.PI * 0.92, { driver: 'none', color: '#2c3e50', hp: 36 });
    world.spawnSmoke(van.x - 24, van.y - 4, '#4c5563', 15); world.spawnFire(van.x - 26, van.y - 2, 12); world.spawnFire(van.x - 18, van.y + 4, 9);
    world.combat.spawnEnemy(2708, 2012, 'heavy', 'mission').hp = 66;
    world.combat.spawnEnemy(2792, 1978, 'enforcer', 'mission').hp = 44;
    world.combat.spawnPickup('cash', 2595, 2028, 120); world.combat.spawnPickup('armor', 2628, 1958, 35);
    world.police.setMinimumWanted(2, world.player.x, world.player.y);

    for (let i = 0; i < 4; i += 1) world.stepPlay(STEP, NULL_INPUT);
    for (const ped of world.traffic.pedestrians) if (Math.hypot(ped.x - 2550, ped.y - 1990) < 95) ped.alive = false;
    world.player.fireTimer = 0; world.combat.firePlayerWeapon(world, 0.07);
    for (let i = 0; i < 4; i += 1) world.stepPlay(STEP, NULL_INPUT);
    world.player.fireTimer = 0; world.combat.firePlayerWeapon(world, 0.11); world.stepPlay(STEP, NULL_INPUT);
    world.spawnSparks(2696, 2008, 12); world.player.muzzleFlash = 0.08; world.player.contextPrompt = '[E] HIJACK KESTREL GT';
    world.cameraX = 2625; world.cameraY = 2048;
    return { screen: SCREEN_PLAY, hasSave: true };
  }

  world.missions.state.storyIndex = 4; world.player.cash = 14850;
  Object.assign(world.economy.reputation, { palm: 55, downtown: 70, industrial: 50, harbor: 60 });
  Object.assign(world.stats, { missionsCleared: 4, takedowns: 27, carsStolen: 9, chasesEvaded: 5, wantedPeak: 4 });
  world.missions.state.lastResult = { outcome: 'CLEARED', title: 'Neon Vault Heist', district: 'DOWNTOWN NEON', reward: 4800, repGain: 30, rank: world.economy.getStreetRank(), cashTotal: world.player.cash, ...world.stats };
  world.vehicles.spawnVehicle('police', 2600, 1912, 0, { driver: 'police', sirenOn: true }).sirenPhase = 0.8;
  world.cameraX = 2860; world.cameraY = 2110;
  return { screen: SCREEN_RESULTS, hasSave: true };
}
