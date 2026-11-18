// Deterministic screenshot scene choreographer for ?shot=title|chase|mission|results.
// Runs real world physics, vehicles, police pursuit, combat, and missions to frame showcase states.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_RESULTS, SCREEN_TITLE } from './hud.js';

function createNullInput() {
  return {
    mouse: { x: 640, y: 360, down: false, rightDown: false },
    isDown: () => false,
    consumePress: () => false,
    axisMove: () => ({ x: 0, y: 0 }),
    consumeClick: () => false,
    consumeWheel: () => 0,
  };
}

export function stageShot(name, world) {
  world.reset();
  const nullInput = createNullInput();

  if (name === 'title' || name === 'start') {
    // Frame the vibrant Harbor Docks waterfront, moored freighter, containers, avenue traffic, and police patrol on the right
    world.vehicles.spawnVehicle('coupe', 2740, 1968, 0, { driver: 'traffic', color: '#f0a326' });
    world.vehicles.spawnVehicle('muscle', 2980, 1912, Math.PI, { driver: 'traffic', color: '#d94136' });
    world.vehicles.spawnVehicle('police', 2605, 1912, 0, { driver: 'police', sirenOn: true });
    for (let i = 0; i < 45; i += 1) {
      world.stepAttract(STEP);
    }
    world.cameraX = 2595;
    world.cameraY = 1990;
    return { screen: SCREEN_TITLE, hasSave: true };
  }

  if (name === 'chase' || name === 'play') {
    // High-speed police chase on Downtown Neon Meridian Ave
    world.missions.state.storyIndex = 2; // Armored Convoy
    world.missions.state.stepIndex = 1;
    world.missions.setupStep(world);
    world.missions.setDialogue('ELENA SOLIS', 'SWAT units locked Meridian Ave. Cut west toward Downtown Armory!', 5);

    const playerCar = world.vehicles.spawnVehicle('muscle', 1520, 935, -Math.PI * 0.42, {
      color: '#e04f2a',
      hp: 145,
    });
    world.enterVehicle(playerCar);
    playerCar.vx = 105;
    playerCar.vy = -425;
    playerCar.speed = 438;
    playerCar.drifting = true;

    for (let k = 0; k < 14; k += 1) {
      const y0 = 1120 - k * 14;
      const y1 = 1106 - k * 14;
      world.vehicles.addSkid(1505 - k * 1.2, y0, 1503 - k * 1.2, y1);
      world.vehicles.addSkid(1532 - k * 1.2, y0, 1530 - k * 1.2, y1);
    }

    world.police.setMinimumWanted(3, playerCar.x, playerCar.y);
    world.stats.wantedPeak = 3;
    world.player.cash = 3850;
    world.player.weaponIndex = 1;
    world.player.arsenal.smg.owned = true;
    world.player.armor = 78;

    const cop1 = world.vehicles.spawnVehicle('police', 1472, 1118, -Math.PI * 0.48, {
      driver: 'police',
      sirenOn: true,
    });
    cop1.vx = 35;
    cop1.vy = -315;
    cop1.speed = 317;

    const cop2 = world.vehicles.spawnVehicle('police', 1574, 1152, -Math.PI * 0.54, {
      driver: 'police',
      sirenOn: true,
    });
    cop2.vx = -25;
    cop2.vy = -305;
    cop2.speed = 306;

    const swatVan = world.vehicles.spawnVehicle('swat', 1520, 725, Math.PI * 0.5, {
      driver: 'swat',
      sirenOn: true,
    });
    swatVan.vy = 165;

    world.vehicles.spawnVehicle('coupe', 1310, 888, 0, { driver: 'traffic', color: '#21a0a0' });
    world.vehicles.spawnVehicle('van', 1760, 832, Math.PI, { driver: 'traffic', color: '#ced4da' });

    for (let i = 0; i < 10; i += 1) {
      world.vehicles.applyVehiclePhysics(playerCar, 1, 0.42, true, STEP, world.player.upgrades);
      world.player.x = playerCar.x;
      world.player.y = playerCar.y;
      world.stepPlay(STEP, nullInput);
    }
    world.spawnSparks(playerCar.x - 16, playerCar.y + 32, 7);
    world.cameraX = playerCar.x + 15;
    world.cameraY = playerCar.y - 10;
    return { screen: SCREEN_PLAY, hasSave: true };
  }

  if (name === 'mission') {
    // On-foot firefight & hijack/shop interaction at Harbor Docks Pier 1
    world.missions.state.storyIndex = 3;
    world.missions.state.stepIndex = 1;
    world.missions.setupStep(world);
    world.missions.setDialogue('MARCO VEGA', 'Dockside Arms behind me. Clear the Iron Tide crew and take that coupe!', 5);

    world.player.x = 2475;
    world.player.y = 1990;
    world.player.aimAngle = 0.08;
    world.player.cash = 4250;
    world.player.hp = 88;
    world.player.armor = 72;
    world.player.weaponIndex = 3;
    world.player.arsenal.carbine.owned = true;
    world.player.arsenal.carbine.mag = 22;
    world.player.arsenal.carbine.reserve = 112;
    world.player.arsenal.smg.owned = true;
    world.player.arsenal.shotgun.owned = true;

    world.vehicles.spawnVehicle('coupe', 2530, 1938, 0.06, { driver: 'none', color: '#f0a326' });
    const cop = world.vehicles.spawnVehicle('police', 2285, 1915, 0.06, { driver: 'police', sirenOn: true });
    cop.vx = 180;

    const e1 = world.combat.spawnEnemy(2705, 2012, 'heavy', 'mission');
    e1.hp = 68;
    const e2 = world.combat.spawnEnemy(2785, 1975, 'enforcer', 'mission');
    e2.hp = 45;
    world.combat.spawnPickup('cash', 2595, 2025, 120);
    world.combat.spawnPickup('armor', 2625, 1955, 35);
    world.police.setMinimumWanted(2, world.player.x, world.player.y);

    // Run 4 simulation steps then fire two clear rounds across open asphalt toward guards
    for (let i = 0; i < 4; i += 1) {
      world.stepPlay(STEP, nullInput);
    }
    // Clear any stray pedestrian in the direct line of fire
    for (const ped of world.traffic.pedestrians) {
      if (Math.hypot(ped.x - 2550, ped.y - 1990) < 90) ped.alive = false;
    }
    world.player.fireTimer = 0;
    world.combat.firePlayerWeapon(world, 0.07);
    for (let i = 0; i < 4; i += 1) {
      world.stepPlay(STEP, nullInput);
    }
    world.player.fireTimer = 0;
    world.combat.firePlayerWeapon(world, 0.11);
    world.stepPlay(STEP, nullInput);
    world.player.muzzleFlash = 0.08;
    world.player.contextPrompt = '[E] HIJACK KESTREL GT';
    world.cameraX = 2625;
    world.cameraY = 2050;
    return { screen: SCREEN_PLAY, hasSave: true };
  }

  // 'results' or 'end': Mission Complete / Crime Stats debrief screen
  world.missions.state.storyIndex = 4;
  world.player.cash = 14850;
  world.stats.missionsCleared = 4;
  world.stats.takedowns = 27;
  world.stats.carsStolen = 9;
  world.stats.chasesEvaded = 5;
  world.stats.wantedPeak = 4;
  world.missions.state.lastResult = {
    outcome: 'CLEARED',
    title: 'Neon Vault Heist',
    reward: 4800,
    cashTotal: world.player.cash,
    missionsCleared: world.stats.missionsCleared,
    takedowns: world.stats.takedowns,
    chasesEvaded: world.stats.chasesEvaded,
    carsStolen: world.stats.carsStolen,
    wantedPeak: world.stats.wantedPeak,
  };
  world.cameraX = 2880;
  world.cameraY = 2120;
  return { screen: SCREEN_RESULTS, hasSave: true };
}
