// Central open-world simulation orchestrator for Solara Bay: Heatline V2.
// Connects city, vehicles, pedestrians, traffic, police, combat, missions, economy, and storage.

import { PLAYER_SPEC, VIEW, WEAPONS } from '../core/config.js';
import { clamp, lerp } from '../core/random.js';
import { createStorageManager } from '../core/storage.js';
import { createCity } from './city.js';
import { createVehicleManager } from '../entities/vehicles.js';
import { createPedestrianManager } from '../entities/pedestrians.js';
import { createTrafficSystem } from '../systems/traffic.js';
import { createPoliceSystem } from '../systems/police.js';
import { createCombatSystem } from '../systems/combat.js';
import { createMissionSystem } from '../systems/missions.js';
import { createEconomySystem } from '../systems/economy.js';

const defaultArsenal = () => ({
  pistol: { owned: true, mag: WEAPONS[0].magSize, reserve: 90 },
  smg: { owned: false, mag: WEAPONS[1].magSize, reserve: 128 },
  shotgun: { owned: false, mag: WEAPONS[2].magSize, reserve: 32 },
  carbine: { owned: false, mag: WEAPONS[3].magSize, reserve: 112 },
});

export function createWorld(rand, audio = null) {
  const storage = createStorageManager(), city = createCity(rand), vehicles = createVehicleManager(city, rand);
  const pedestrians = createPedestrianManager(city, vehicles, rand), traffic = createTrafficSystem(city, vehicles, pedestrians, rand);
  const police = createPoliceSystem(city, vehicles, rand), combat = createCombatSystem(city, vehicles, traffic, police, rand);
  const missions = createMissionSystem(city, vehicles, combat, police, rand), economy = createEconomySystem();

  const player = {
    x: 680, y: 860, aimAngle: 0, walkPhase: 0, hp: PLAYER_SPEC.maxHp, armor: 50, cash: PLAYER_SPEC.startCash,
    inVehicle: false, vehicle: null, weaponIndex: 0, arsenal: defaultArsenal(),
    upgrades: { turbo: false, chassis: false, handling: false, underglow: false, damage: false },
    preferredPaint: null, fireTimer: 0, reloadTimer: 0, muzzleFlash: 0, muzzleAngle: 0,
    dodgeTimer: 0, dodgeCooldown: 0, dodgeDx: 0, dodgeDy: 0, invulnTimer: 0, hitFlash: 0, contextPrompt: '', contextAction: null,
  };
  const stats = { cashEarned: 0, missionsCleared: 0, takedowns: 0, policeDown: 0, carsStolen: 0, chasesEvaded: 0, pedsHit: 0, shotsFired: 0, shotsHit: 0, wantedPeak: 0 };

  const world = {
    storage, city, vehicles, pedestrians, traffic, police, combat, missions, economy, player, stats, audio,
    time: 0, cameraX: 1160, cameraY: 860, cameraShake: 0,
    onOpenShop: null, onOpenGarage: null, onMissionResults: null, onSaveNotify: null, ejectPlayerFromVehicle,
    spawnHitEffect: combat.spawnHitEffect, spawnSparks: combat.spawnSparks, spawnSmoke: combat.spawnSmoke,
    spawnFire: combat.spawnFire, spawnPickup: combat.spawnPickup, fireEnemyBullet: combat.fireEnemyBullet,
    triggerExplosion: (x, y, r, d) => combat.triggerExplosion(world, x, y, r, d),
  };

  function reset() {
    vehicles.clear(); traffic.clear(); police.clear(); combat.clear(); economy.reset();
    Object.assign(player, {
      x: 680, y: 860, aimAngle: 0, walkPhase: 0, hp: PLAYER_SPEC.maxHp, armor: 50, cash: PLAYER_SPEC.startCash,
      inVehicle: false, vehicle: null, weaponIndex: 0, arsenal: defaultArsenal(),
      upgrades: { turbo: false, chassis: false, handling: false, underglow: false, damage: false },
      preferredPaint: null, fireTimer: 0, reloadTimer: 0, muzzleFlash: 0, dodgeTimer: 0, dodgeCooldown: 0, invulnTimer: 0, hitFlash: 0, contextPrompt: '', contextAction: null,
    });
    for (const k of Object.keys(stats)) stats[k] = 0;
    world.time = 0; world.cameraX = player.x; world.cameraY = player.y; world.cameraShake = 0;
    vehicles.seedParkedVehicles(); traffic.seedInitial(player.x, player.y); missions.reset();
  }

  function enterVehicle(v) {
    if (!v || v.exploded) return false;
    if (['traffic', 'police', 'swat', 'convoy'].includes(v.driver)) {
      const ejX = v.x + Math.cos(v.angle - 1.57) * 34, ejY = v.y + Math.sin(v.angle - 1.57) * 34;
      const ped = traffic.spawnPedestrian(ejX, ejY);
      if (ped) Object.assign(ped, { x: ejX, y: ejY, panicTimer: 5, panicDx: Math.cos(v.angle - 1.57), panicDy: Math.sin(v.angle - 1.57) });
      stats.carsStolen += 1;
      police.reportCrime(v.driver === 'police' || v.driver === 'swat' ? 45 : 18, v.x, v.y);
      combat.spawnPopup(v.x, v.y - 24, `HIJACKED ${v.spec.name.toUpperCase()}`, '#ffd166');
    }
    vehicles.applyGarageTuning(v, player.upgrades, null);
    v.driver = 'player'; if (v.spec.siren) v.sirenOn = true;
    player.inVehicle = true; player.vehicle = v; player.x = v.x; player.y = v.y;
    return true;
  }

  function ejectPlayerFromVehicle(v, fromExplosion = false) {
    if (!v) return;
    if (!fromExplosion) v.driver = 'none';
    v.sirenOn = false; player.inVehicle = false; player.vehicle = null;
    player.x = v.x + Math.cos(v.angle - 1.5708) * 40; player.y = v.y + Math.sin(v.angle - 1.5708) * 40;
    city.resolveCircleCollisions(player, PLAYER_SPEC.radius);
  }

  function updateContextPrompt() {
    player.contextPrompt = ''; player.contextAction = null;
    if (!player.inVehicle) {
      const car = vehicles.findNearestEnterable(player.x, player.y, 78);
      if (car) { player.contextPrompt = `[E] HIJACK ${car.spec.name.toUpperCase()}`; player.contextAction = { type: 'enter', vehicle: car }; return; }
    }
    for (const lm of city.landmarks) {
      if (Math.hypot(player.x - lm.x, player.y - lm.y) >= lm.radius + 28) continue;
      if (lm.kind === 'armory') { player.contextPrompt = '[E / B] OPEN ARMORY DEPOT'; player.contextAction = { type: 'shop' }; }
      else if (lm.kind === 'garage') {
        if (player.inVehicle) { const fee = police.state.wantedLevel > 0 ? 250 : 0; player.contextPrompt = fee ? `[E] COSTA CUSTOMS · CLEAR HEAT ($${fee})` : '[E / G] COSTA CUSTOMS GARAGE'; player.contextAction = { type: 'garage', fee }; }
        else { player.contextPrompt = '[E / G] OPEN COSTA CUSTOMS GARAGE'; player.contextAction = { type: 'open_garage' }; }
      } else if (lm.kind === 'safehouse' && !player.inVehicle) { player.contextPrompt = '[E] VEGA SAFEHOUSE · SAVE & REST'; player.contextAction = { type: 'save' }; }
      return;
    }
  }

  function handleInteract() {
    if (player.inVehicle && player.contextAction?.type !== 'garage') return ejectPlayerFromVehicle(player.vehicle, false);
    const act = player.contextAction;
    if (!act) { const car = vehicles.findNearestEnterable(player.x, player.y, 82); if (car) enterVehicle(car); return; }
    if (act.type === 'enter') enterVehicle(act.vehicle);
    else if (act.type === 'shop') world.onOpenShop?.();
    else if (act.type === 'open_garage') world.onOpenGarage?.();
    else if (act.type === 'garage' && player.inVehicle) { const r = economy.resprayAndRepair(world); combat.spawnPopup(player.x, player.y - 26, r.msg.toUpperCase(), r.ok ? '#28c7b7' : '#f04b4c'); }
    else if (act.type === 'save') { economy.restAtSafehouse(world, 'autosave'); combat.spawnPopup(player.x, player.y - 26, 'SAFEHOUSE · GAME SAVED', '#37c978'); world.onSaveNotify?.(); }
  }

  function stepAttract(dt) {
    world.time += dt; traffic.update(world, dt, world.time); vehicles.update(world, dt); combat.updateParticlesAndEffects(dt);
    world.cameraX = 1820 + Math.sin(world.time * 0.2) * 320; world.cameraY = 1220 + Math.cos(world.time * 0.16) * 260;
  }

  function stepPlay(dt, input) {
    world.time += dt;
    player.fireTimer = Math.max(0, player.fireTimer - dt); player.muzzleFlash = Math.max(0, player.muzzleFlash - dt);
    player.dodgeCooldown = Math.max(0, player.dodgeCooldown - dt); player.invulnTimer = Math.max(0, player.invulnTimer - dt);
    player.hitFlash = Math.max(0, player.hitFlash - dt);
    if (player.reloadTimer > 0 && (player.reloadTimer = Math.max(0, player.reloadTimer - dt)) === 0) combat.finishReload(world);

    for (let s = 1; s <= 4; s += 1) if (input.consumePress(`Digit${s}`)) combat.switchWeapon(world, s - 1);
    const wheel = input.consumeWheel();
    if (wheel) {
      const owned = WEAPONS.filter((w) => player.arsenal[w.id].owned).map((w) => w.slot - 1);
      if (owned.length > 1) combat.switchWeapon(world, owned[(Math.max(0, owned.indexOf(player.weaponIndex)) + (wheel > 0 ? 1 : -1) + owned.length) % owned.length]);
    }
    if (input.consumePress('KeyR')) combat.startReload(world);
    player.aimAngle = Math.atan2(world.cameraY - VIEW.height * 0.5 + input.mouse.y - player.y, world.cameraX - VIEW.width * 0.5 + input.mouse.x - player.x);

    const move = input.axisMove(), activeW = WEAPONS[player.weaponIndex];
    if (player.inVehicle && player.vehicle) {
      vehicles.applyVehiclePhysics(player.vehicle, -move.y, move.x, input.isDown('Space'), dt, player.upgrades);
      player.x = player.vehicle.x; player.y = player.vehicle.y;
    } else {
      if (input.consumePress('Space') && player.dodgeCooldown <= 0 && (move.x || move.y)) {
        const mag = Math.hypot(move.x, move.y) || 1;
        Object.assign(player, { dodgeDx: move.x / mag, dodgeDy: move.y / mag, dodgeTimer: PLAYER_SPEC.dodgeDuration, dodgeCooldown: PLAYER_SPEC.dodgeCooldown, invulnTimer: PLAYER_SPEC.dodgeDuration });
      }
      if (player.dodgeTimer > 0) {
        player.dodgeTimer = Math.max(0, player.dodgeTimer - dt);
        player.x += player.dodgeDx * PLAYER_SPEC.dodgeSpeed * dt; player.y += player.dodgeDy * PLAYER_SPEC.dodgeSpeed * dt; player.walkPhase += dt * 18;
      } else if (move.x || move.y) {
        const mag = Math.hypot(move.x, move.y) || 1, spd = input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? PLAYER_SPEC.sprintSpeed : PLAYER_SPEC.walkSpeed;
        player.x += (move.x / mag) * spd * dt; player.y += (move.y / mag) * spd * dt; player.walkPhase += dt * (spd > 240 ? 14 : 9);
      }
      city.resolveCircleCollisions(player, PLAYER_SPEC.radius);
    }
    if (activeW.auto ? input.mouse.down : input.consumeClick()) combat.firePlayerWeapon(world, player.aimAngle);

    updateContextPrompt(); if (input.consumePress('KeyE')) handleInteract();
    vehicles.update(world, dt); traffic.update(world, dt, world.time); police.update(world, dt, world.time);
    combat.updateEnemies(world, dt); combat.updateProjectiles(world, dt); combat.updatePickups(world, dt);
    combat.updateParticlesAndEffects(dt); missions.update(world, dt);
    stats.wantedPeak = Math.max(stats.wantedPeak, police.state.wantedLevel);

    if (player.hp <= 0) {
      if (player.inVehicle) ejectPlayerFromVehicle(player.vehicle, false);
      police.clearWanted(); Object.assign(player, { hp: PLAYER_SPEC.maxHp, armor: 25, cash: Math.max(0, player.cash - 250), x: 720, y: 635 });
      missions.state.lastResult = { outcome: 'DOWNED', title: missions.currentMission()?.title ?? 'Street Run', district: 'SOLARA BAY', reward: 0, repGain: 0, rank: economy.getStreetRank(), cashTotal: player.cash, ...stats };
      world.onMissionResults?.(missions.state.lastResult);
    }

    const v = player.inVehicle ? player.vehicle : null;
    world.cameraX = lerp(world.cameraX, clamp(player.x + (v ? v.vx * 0.24 : 0), VIEW.width * 0.5, city.width - VIEW.width * 0.5), 1 - Math.exp(-7.5 * dt));
    world.cameraY = lerp(world.cameraY, clamp(player.y + (v ? v.vy * 0.24 : 0), VIEW.height * 0.5, city.height - VIEW.height * 0.5), 1 - Math.exp(-7.5 * dt));
    world.cameraShake = Math.max(0, world.cameraShake - dt * 28);
    audio?.update(dt, v ? v.speed : 0, player.inVehicle, police.state.wantedLevel, world.time, true, police.getNearestSirenDoppler(player.x, player.y, v ? v.vx : 0, v ? v.vy : 0), police.spotlight.active || Boolean(v?.spec.aircraft));
  }

  reset();
  return {
    ...world, reset, enterVehicle, ejectPlayerFromVehicle, handleInteract, stepAttract, stepPlay,
    saveToStorage: (s = 'autosave') => storage.saveSlot(world, s),
    hasSavedGame: () => storage.hasAnySave(),
    loadFromStorage: (s = 'autosave') => storage.loadSlot(world, s),
  };
}
