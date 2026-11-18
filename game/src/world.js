// Central simulation orchestrator tying together city, vehicles, traffic, police, combat, and missions.
// Handles player on-foot/vehicle state, hijacking, landmark interactions, save/load, and camera tracking.

import { PLAYER_SPEC, SAVE_KEY, VIEW, WEAPONS } from './config.js';
import { createCity } from './city.js';
import { createVehicleManager } from './vehicles.js';
import { createTrafficSystem } from './traffic.js';
import { createPoliceSystem } from './police.js';
import { createCombatSystem } from './combat.js';
import { createMissionSystem } from './missions.js';
import { clamp, lerp } from './random.js';

function createDefaultArsenal() {
  return {
    pistol: { owned: true, mag: WEAPONS[0].magSize, reserve: 90 },
    smg: { owned: false, mag: WEAPONS[1].magSize, reserve: 128 },
    shotgun: { owned: false, mag: WEAPONS[2].magSize, reserve: 32 },
    carbine: { owned: false, mag: WEAPONS[3].magSize, reserve: 112 },
  };
}

export function createWorld(rand, audio = null) {
  const city = createCity(rand);
  const vehicles = createVehicleManager(city, rand);
  const traffic = createTrafficSystem(city, vehicles, rand);
  const police = createPoliceSystem(city, vehicles, rand);
  const combat = createCombatSystem(city, vehicles, traffic, police, rand);
  const missions = createMissionSystem(city, vehicles, combat, police, rand);

  const player = {
    x: 680,
    y: 860,
    aimAngle: 0,
    walkPhase: 0,
    hp: PLAYER_SPEC.maxHp,
    armor: 50,
    cash: PLAYER_SPEC.startCash,
    inVehicle: false,
    vehicle: null,
    weaponIndex: 0,
    arsenal: createDefaultArsenal(),
    upgrades: { turbo: false, chassis: false, damage: false },
    fireTimer: 0,
    reloadTimer: 0,
    muzzleFlash: 0,
    muzzleAngle: 0,
    dodgeTimer: 0,
    dodgeCooldown: 0,
    dodgeDx: 0,
    dodgeDy: 0,
    invulnTimer: 0,
    hitFlash: 0,
    contextPrompt: '',
    contextAction: null,
  };

  const stats = {
    cashEarned: 0,
    missionsCleared: 0,
    takedowns: 0,
    carsStolen: 0,
    chasesEvaded: 0,
    pedsHit: 0,
    shotsFired: 0,
    shotsHit: 0,
    wantedPeak: 0,
  };

  const world = {
    city,
    vehicles,
    traffic,
    police,
    combat,
    missions,
    player,
    stats,
    audio,
    time: 0,
    cameraX: 1160,
    cameraY: 860,
    cameraShake: 0,
    onOpenShop: null,
    onMissionResults: null,
    onSaveNotify: null,
    ejectPlayerFromVehicle,
    spawnHitEffect: combat.spawnHitEffect,
    spawnSparks: combat.spawnSparks,
    spawnSmoke: combat.spawnSmoke,
    spawnPickup: combat.spawnPickup,
    fireEnemyBullet: combat.fireEnemyBullet,
    triggerExplosion: (x, y, r, d) => combat.triggerExplosion(world, x, y, r, d),
  };

  function reset() {
    vehicles.clear();
    traffic.clear();
    police.clear();
    combat.clear();

    player.x = 680;
    player.y = 860;
    player.aimAngle = 0;
    player.walkPhase = 0;
    player.hp = PLAYER_SPEC.maxHp;
    player.armor = 50;
    player.cash = PLAYER_SPEC.startCash;
    player.inVehicle = false;
    player.vehicle = null;
    player.weaponIndex = 0;
    player.arsenal = createDefaultArsenal();
    player.upgrades = { turbo: false, chassis: false, damage: false };
    player.fireTimer = 0;
    player.reloadTimer = 0;
    player.muzzleFlash = 0;
    player.dodgeTimer = 0;
    player.dodgeCooldown = 0;
    player.invulnTimer = 0;
    player.hitFlash = 0;
    player.contextPrompt = '';
    player.contextAction = null;

    stats.cashEarned = 0;
    stats.missionsCleared = 0;
    stats.takedowns = 0;
    stats.carsStolen = 0;
    stats.chasesEvaded = 0;
    stats.pedsHit = 0;
    stats.shotsFired = 0;
    stats.shotsHit = 0;
    stats.wantedPeak = 0;

    world.time = 0;
    world.cameraX = player.x;
    world.cameraY = player.y;
    world.cameraShake = 0;

    vehicles.seedParkedVehicles();
    traffic.seedInitial(player.x, player.y);
    missions.reset(world);
  }

  function enterVehicle(v) {
    if (!v || v.exploded) return false;
    const wasOccupied = v.driver === 'traffic' || v.driver === 'police' || v.driver === 'swat' || v.driver === 'convoy';
    if (wasOccupied) {
      // Eject existing driver as fleeing pedestrian
      const ejX = v.x + Math.cos(v.angle - 1.57) * 34;
      const ejY = v.y + Math.sin(v.angle - 1.57) * 34;
      const ped = traffic.spawnPedestrian(ejX, ejY);
      if (ped) {
        ped.x = ejX;
        ped.y = ejY;
        ped.panicTimer = 5;
        ped.panicDx = Math.cos(v.angle - 1.57);
        ped.panicDy = Math.sin(v.angle - 1.57);
      }
      stats.carsStolen += 1;
      police.reportCrime(v.driver === 'police' || v.driver === 'swat' ? 45 : 18, v.x, v.y);
      combat.spawnPopup(v.x, v.y - 24, `HIJACKED ${v.spec.name.toUpperCase()}`, '#ffd166');
    }
    if (player.upgrades.chassis) {
      v.maxHp = Math.round(v.spec.maxHp * 1.35);
      v.hp = Math.min(v.maxHp, Math.round(v.hp * 1.35));
    }
    v.driver = 'player';
    if (v.spec.siren) v.sirenOn = true;
    player.inVehicle = true;
    player.vehicle = v;
    player.x = v.x;
    player.y = v.y;
    return true;
  }

  function ejectPlayerFromVehicle(v, fromExplosion = false) {
    if (!v) return;
    const exitX = v.x + Math.cos(v.angle - Math.PI * 0.5) * 40;
    const exitY = v.y + Math.sin(v.angle - Math.PI * 0.5) * 40;
    if (!fromExplosion) v.driver = 'none';
    v.sirenOn = false;
    player.inVehicle = false;
    player.vehicle = null;
    player.x = exitX;
    player.y = exitY;
    city.resolveCircleCollisions(player, PLAYER_SPEC.radius);
  }

  function updateContextPrompt() {
    player.contextPrompt = '';
    player.contextAction = null;

    if (!player.inVehicle) {
      const car = vehicles.findNearestEnterable(player.x, player.y, 76);
      if (car) {
        player.contextPrompt = `[E] HIJACK ${car.spec.name.toUpperCase()}`;
        player.contextAction = { type: 'enter', vehicle: car };
        return;
      }
    }

    for (let i = 0; i < city.landmarks.length; i += 1) {
      const lm = city.landmarks[i];
      if (Math.hypot(player.x - lm.x, player.y - lm.y) < lm.radius + 26) {
        if (lm.kind === 'armory') {
          player.contextPrompt = '[E / B] OPEN ARMORY SHOP';
          player.contextAction = { type: 'shop' };
        } else if (lm.kind === 'garage') {
          if (player.inVehicle) {
            const fee = police.state.wantedLevel > 0 ? 250 : 0;
            player.contextPrompt = fee > 0 ? `[E] RESPRAY & CLEAR HEAT ($${fee})` : '[E] REPAIR VEHICLE (FREE)';
            player.contextAction = { type: 'garage', fee };
          } else {
            player.contextPrompt = 'DRIVE IN TO REPAIR & CLEAR HEAT';
          }
        } else if (lm.kind === 'safehouse' && !player.inVehicle) {
          player.contextPrompt = '[E] SAVE PROGRESS & REST';
          player.contextAction = { type: 'save' };
        }
        return;
      }
    }
  }

  function handleInteract() {
    if (player.inVehicle && (!player.contextAction || player.contextAction.type !== 'garage')) {
      ejectPlayerFromVehicle(player.vehicle, false);
      return;
    }
    const act = player.contextAction;
    if (!act) {
      const car = vehicles.findNearestEnterable(player.x, player.y, 82);
      if (car) enterVehicle(car);
      return;
    }
    if (act.type === 'enter') {
      enterVehicle(act.vehicle);
    } else if (act.type === 'shop') {
      world.onOpenShop?.();
    } else if (act.type === 'garage' && player.inVehicle) {
      if (player.cash >= act.fee) {
        player.cash -= act.fee;
        vehicles.repairAndRespray(player.vehicle);
        police.clearWanted();
        audio?.playCash();
        combat.spawnPopup(player.x, player.y - 26, 'RESPRAY COMPLETE · HEAT CLEARED', '#28c7b7');
      } else {
        combat.spawnPopup(player.x, player.y - 26, `NEED $${act.fee}`, '#f04b4c');
      }
    } else if (act.type === 'save') {
      player.hp = PLAYER_SPEC.maxHp;
      saveToStorage();
      audio?.playCash();
      combat.spawnPopup(player.x, player.y - 26, 'GAME SAVED', '#37c978');
      world.onSaveNotify?.();
    }
  }

  function stepAttract(dt) {
    world.time += dt;
    traffic.update(world, dt, world.time);
    vehicles.update(world, dt);
    combat.updateParticlesAndEffects(dt);
    // Smooth coastal-to-downtown pan for lively title backdrop
    world.cameraX = 1140 + Math.sin(world.time * 0.22) * 280;
    world.cameraY = 860 + Math.cos(world.time * 0.18) * 140;
  }

  function stepPlay(dt, input) {
    world.time += dt;
    if (player.fireTimer > 0) player.fireTimer = Math.max(0, player.fireTimer - dt);
    if (player.muzzleFlash > 0) player.muzzleFlash = Math.max(0, player.muzzleFlash - dt);
    if (player.dodgeCooldown > 0) player.dodgeCooldown = Math.max(0, player.dodgeCooldown - dt);
    if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);
    if (player.hitFlash > 0) player.hitFlash = Math.max(0, player.hitFlash - dt);

    if (player.reloadTimer > 0) {
      player.reloadTimer = Math.max(0, player.reloadTimer - dt);
      if (player.reloadTimer === 0) combat.finishReload(world);
    }

    // Weapon slots & mouse wheel switch
    for (let s = 1; s <= 4; s += 1) {
      if (input.consumePress(`Digit${s}`)) combat.switchWeapon(world, s - 1);
    }
    const wheel = input.consumeWheel();
    if (wheel !== 0) {
      const owned = WEAPONS.filter((w) => player.arsenal[w.id].owned).map((w) => w.slot - 1);
      if (owned.length > 1) {
        const curPos = Math.max(0, owned.indexOf(player.weaponIndex));
        const nextPos = (curPos + (wheel > 0 ? 1 : -1) + owned.length) % owned.length;
        combat.switchWeapon(world, owned[nextPos]);
      }
    }
    if (input.consumePress('KeyR')) combat.startReload(world);

    // Update mouse aim angle in world space
    const mouseWorldX = world.cameraX - VIEW.width * 0.5 + input.mouse.x;
    const mouseWorldY = world.cameraY - VIEW.height * 0.5 + input.mouse.y;
    player.aimAngle = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);

    const move = input.axisMove();
    if (player.inVehicle && player.vehicle) {
      const v = player.vehicle;
      const throttle = -move.y;
      const steer = move.x;
      const handbrake = input.isDown('Space');
      vehicles.applyVehiclePhysics(v, throttle, steer, handbrake, dt, player.upgrades);
      player.x = v.x;
      player.y = v.y;

      // Drive-by shooting with left click
      const activeWeapon = WEAPONS[player.weaponIndex];
      if (activeWeapon.auto ? input.mouse.down : input.consumeClick()) {
        combat.firePlayerWeapon(world, player.aimAngle);
      }
    } else {
      // On-foot movement + dodge roll
      if (input.consumePress('Space') && player.dodgeCooldown <= 0 && (move.x !== 0 || move.y !== 0)) {
        const mag = Math.hypot(move.x, move.y) || 1;
        player.dodgeDx = move.x / mag;
        player.dodgeDy = move.y / mag;
        player.dodgeTimer = PLAYER_SPEC.dodgeDuration;
        player.dodgeCooldown = PLAYER_SPEC.dodgeCooldown;
        player.invulnTimer = PLAYER_SPEC.dodgeDuration;
      }

      if (player.dodgeTimer > 0) {
        player.dodgeTimer = Math.max(0, player.dodgeTimer - dt);
        player.x += player.dodgeDx * PLAYER_SPEC.dodgeSpeed * dt;
        player.y += player.dodgeDy * PLAYER_SPEC.dodgeSpeed * dt;
        player.walkPhase += dt * 18;
      } else if (move.x !== 0 || move.y !== 0) {
        const mag = Math.hypot(move.x, move.y) || 1;
        const speed = input.isDown('ShiftLeft') || input.isDown('ShiftRight')
          ? PLAYER_SPEC.sprintSpeed
          : PLAYER_SPEC.walkSpeed;
        player.x += (move.x / mag) * speed * dt;
        player.y += (move.y / mag) * speed * dt;
        player.walkPhase += dt * (speed > 240 ? 14 : 9);
      }
      city.resolveCircleCollisions(player, PLAYER_SPEC.radius);

      const activeWeapon = WEAPONS[player.weaponIndex];
      if (activeWeapon.auto ? input.mouse.down : input.consumeClick()) {
        combat.firePlayerWeapon(world, player.aimAngle);
      }
    }

    updateContextPrompt();
    if (input.consumePress('KeyE')) {
      handleInteract();
    }

    vehicles.update(world, dt);
    traffic.update(world, dt, world.time);
    police.update(world, dt, world.time);
    combat.updateEnemies(world, dt);
    combat.updateProjectiles(world, dt);
    combat.updatePickups(world, dt);
    combat.updateParticlesAndEffects(dt);
    missions.update(world, dt);

    stats.wantedPeak = Math.max(stats.wantedPeak, police.state.wantedLevel);

    // Handle player downed -> medical evac summary
    if (player.hp <= 0) {
      if (player.inVehicle) ejectPlayerFromVehicle(player.vehicle, false);
      police.clearWanted();
      player.hp = PLAYER_SPEC.maxHp;
      player.armor = 25;
      player.cash = Math.max(0, player.cash - 250);
      player.x = 720;
      player.y = 635;
      missions.state.lastResult = {
        outcome: 'DOWNED',
        title: missions.currentMission()?.title ?? 'Street Run',
        reward: 0,
        cashTotal: player.cash,
        missionsCleared: stats.missionsCleared,
        takedowns: stats.takedowns,
        chasesEvaded: stats.chasesEvaded,
        carsStolen: stats.carsStolen,
        wantedPeak: stats.wantedPeak,
      };
      world.onMissionResults?.(missions.state.lastResult);
    }

    // Smooth camera with forward lookahead when driving
    const leadX = player.inVehicle && player.vehicle ? player.vehicle.vx * 0.24 : 0;
    const leadY = player.inVehicle && player.vehicle ? player.vehicle.vy * 0.24 : 0;
    const targetCamX = clamp(player.x + leadX, VIEW.width * 0.5, city.width - VIEW.width * 0.5);
    const targetCamY = clamp(player.y + leadY, VIEW.height * 0.5, city.height - VIEW.height * 0.5);
    world.cameraX = lerp(world.cameraX, targetCamX, 1 - Math.exp(-7.5 * dt));
    world.cameraY = lerp(world.cameraY, targetCamY, 1 - Math.exp(-7.5 * dt));

    if (world.cameraShake > 0) {
      world.cameraShake = Math.max(0, world.cameraShake - dt * 28);
    }

    const speedNow = player.inVehicle && player.vehicle ? player.vehicle.speed : 0;
    audio?.update(dt, speedNow, player.inVehicle, police.state.wantedLevel, world.time, true);
  }

  function saveToStorage() {
    try {
      const payload = {
        cash: player.cash,
        hp: player.hp,
        armor: player.armor,
        weaponIndex: player.weaponIndex,
        arsenal: player.arsenal,
        upgrades: player.upgrades,
        storyIndex: missions.state.storyIndex,
        stats: { ...stats },
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  function hasSavedGame() {
    try {
      return Boolean(window.localStorage.getItem(SAVE_KEY));
    } catch {
      return false;
    }
  }

  function loadFromStorage() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      reset();
      if (typeof data.cash === 'number') player.cash = data.cash;
      if (typeof data.hp === 'number') player.hp = clamp(data.hp, 25, PLAYER_SPEC.maxHp);
      if (typeof data.armor === 'number') player.armor = clamp(data.armor, 0, PLAYER_SPEC.maxArmor);
      if (data.arsenal) player.arsenal = data.arsenal;
      if (data.upgrades) player.upgrades = data.upgrades;
      if (typeof data.weaponIndex === 'number') player.weaponIndex = data.weaponIndex;
      if (typeof data.storyIndex === 'number') {
        missions.state.storyIndex = clamp(data.storyIndex, 0, 5);
        missions.state.stepIndex = 0;
        missions.setupStep(world);
      }
      if (data.stats) Object.assign(stats, data.stats);
      return true;
    } catch {
      return false;
    }
  }

  reset();

  return {
    ...world,
    reset,
    enterVehicle,
    ejectPlayerFromVehicle,
    handleInteract,
    stepAttract,
    stepPlay,
    saveToStorage,
    hasSavedGame,
    loadFromStorage,
  };
}
