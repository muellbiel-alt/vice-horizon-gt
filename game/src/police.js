// 5-Star Wanted Level system with escalating police response:
// 1-Star patrol, 2-Star interceptor pursuit, 3-Star roadblocks, 4-Star SWAT vans, 5-Star lockdown & chopper spotlight.

import { H_ROADS, V_ROADS } from './city.js';
import { clamp, normalizeAngle } from './random.js';

export function createPoliceSystem(city, vehicleMgr, rand) {
  const units = []; // On-foot police and SWAT officers
  const roadblocks = []; // Active roadblock props/vehicles
  const spotlight = { active: false, x: 0, y: 0, angle: 0 };

  const state = {
    wantedLevel: 0,
    heat: 0,
    evadeTimer: 0,
    evadeDuration: 12,
    lastSeenX: 1600,
    lastSeenY: 1100,
    searchRadius: 420,
    spawnCooldown: 0,
    roadblockCooldown: 0,
    spotted: false,
  };

  function levelFromHeat(heat) {
    if (heat >= 420) return 5;
    if (heat >= 280) return 4;
    if (heat >= 165) return 3;
    if (heat >= 75) return 2;
    if (heat >= 15) return 1;
    return 0;
  }

  function reportCrime(amount, x, y) {
    const prev = state.wantedLevel;
    state.heat = Math.min(540, state.heat + amount);
    state.wantedLevel = levelFromHeat(state.heat);
    state.lastSeenX = x;
    state.lastSeenY = y;
    state.evadeTimer = 0;
    state.spotted = true;
    state.searchRadius = 380 + state.wantedLevel * 95;
    state.evadeDuration = 8 + state.wantedLevel * 3.5;
    return state.wantedLevel > prev;
  }

  function setMinimumWanted(stars, x, y) {
    const heatThresholds = [0, 22, 85, 180, 295, 440];
    const targetHeat = heatThresholds[clamp(stars, 0, 5)];
    if (state.heat < targetHeat) state.heat = targetHeat;
    state.wantedLevel = Math.max(state.wantedLevel, stars);
    state.lastSeenX = x;
    state.lastSeenY = y;
    state.evadeTimer = 0;
    state.spotted = true;
    state.searchRadius = 380 + state.wantedLevel * 95;
    state.evadeDuration = 8 + state.wantedLevel * 3.5;
  }

  function clearWanted() {
    state.wantedLevel = 0;
    state.heat = 0;
    state.evadeTimer = 0;
    state.spotted = false;
    spotlight.active = false;
    for (let i = 0; i < vehicleMgr.vehicles.length; i += 1) {
      const v = vehicleMgr.vehicles[i];
      if (v.driver === 'police' || v.driver === 'swat') {
        v.sirenOn = false;
        v.driver = 'none';
      }
    }
    units.length = 0;
    roadblocks.length = 0;
  }

  function spawnOfficer(x, y, isSwat = false) {
    if (units.length >= 16 || city.isPointBlocked(x, y, 13)) return null;
    const unit = {
      x,
      y,
      angle: rand.range(-Math.PI, Math.PI),
      isSwat,
      hp: isSwat ? 115 : 65,
      maxHp: isSwat ? 115 : 65,
      fireCooldown: rand.range(0.4, 1.0),
      speed: isSwat ? 148 : 138,
      walkPhase: 0,
      alive: true,
    };
    units.push(unit);
    return unit;
  }

  function countPoliceVehicles() {
    let count = 0;
    for (let i = 0; i < vehicleMgr.vehicles.length; i += 1) {
      const v = vehicleMgr.vehicles[i];
      if (!v.exploded && (v.driver === 'police' || v.driver === 'swat')) count += 1;
    }
    return count;
  }

  function spawnPursuitVehicle(world) {
    const maxCars = Math.min(8, 1 + state.wantedLevel * 1.4);
    if (countPoliceVehicles() >= maxCars) return null;

    const px = world.player.x;
    const py = world.player.y;
    const roadPt = city.findNearestRoadPoint(
      clamp(px + rand.pick([-1, 1]) * rand.range(460, 740), 460, 3200),
      clamp(py + rand.pick([-1, 1]) * rand.range(360, 580), 320, 2360),
    );
    if (city.isPointBlocked(roadPt.x, roadPt.y, 28)) return null;
    if (Math.hypot(roadPt.x - px, roadPt.y - py) < 340) return null;

    const useSwat = state.wantedLevel >= 4 && rand.chance(state.wantedLevel === 5 ? 0.55 : 0.4);
    const kind = useSwat ? 'swat' : 'police';
    const angle = Math.atan2(py - roadPt.y, px - roadPt.x);
    return vehicleMgr.spawnVehicle(kind, roadPt.x, roadPt.y, angle, {
      driver: useSwat ? 'swat' : 'police',
      sirenOn: true,
      aiState: { stuckTimer: 0, deployCount: useSwat ? 2 : 1 },
    });
  }

  function spawnRoadblock(world) {
    if (state.wantedLevel < 3 || roadblocks.length >= 3) return;
    const px = world.player.x;
    const py = world.player.y;
    const vx = world.player.inVehicle ? world.player.vehicle.vx : 0;
    const vy = world.player.inVehicle ? world.player.vehicle.vy : 0;
    const aheadX = clamp(px + (Math.abs(vx) > 40 ? Math.sign(vx) * 560 : 520), 500, 3150);
    const aheadY = clamp(py + (Math.abs(vy) > 40 ? Math.sign(vy) * 440 : 420), 360, 2340);

    const onVertical = Math.abs(vy) >= Math.abs(vx);
    const rx = onVertical ? V_ROADS.reduce((a, b) => (Math.abs(b - aheadX) < Math.abs(a - aheadX) ? b : a)) : aheadX;
    const ry = onVertical ? aheadY : H_ROADS.reduce((a, b) => (Math.abs(b - aheadY) < Math.abs(a - aheadY) ? b : a));
    if (Math.hypot(rx - px, ry - py) < 380 || city.isPointBlocked(rx, ry, 40)) return;

    const blockAngle = onVertical ? 0 : Math.PI * 0.5;
    const offX = onVertical ? 36 : 0;
    const offY = onVertical ? 0 : 36;
    const kind = state.wantedLevel >= 4 ? 'swat' : 'police';

    const c1 = vehicleMgr.spawnVehicle(kind, rx - offX, ry - offY, blockAngle, { driver: 'police', sirenOn: true });
    const c2 = vehicleMgr.spawnVehicle('police', rx + offX, ry + offY, blockAngle, { driver: 'police', sirenOn: true });
    if (c1) c1.aiState = { roadblock: true, stuckTimer: 0, deployCount: 1 };
    if (c2) c2.aiState = { roadblock: true, stuckTimer: 0, deployCount: 1 };
    spawnOfficer(rx - offX * 0.7, ry - offY * 0.7 + 34, state.wantedLevel >= 4);
    spawnOfficer(rx + offX * 0.7, ry + offY * 0.7 - 34, state.wantedLevel >= 4);
    roadblocks.push({ x: rx, y: ry, ttl: 24 });
  }

  function updatePoliceVehicles(world, dt) {
    const px = world.player.x;
    const py = world.player.y;

    for (let i = 0; i < vehicleMgr.vehicles.length; i += 1) {
      const v = vehicleMgr.vehicles[i];
      if (v.exploded || (v.driver !== 'police' && v.driver !== 'swat')) continue;

      if (state.wantedLevel === 0) {
        v.sirenOn = false;
        vehicleMgr.applyVehiclePhysics(v, 0.25, 0, false, dt, null);
        continue;
      }

      v.sirenOn = true;
      const dist = Math.hypot(px - v.x, py - v.y);
      const ai = v.aiState || (v.aiState = { stuckTimer: 0, deployCount: 1 });

      // Deploy armed officers if close or roadblock engaged
      if (dist < 210 && ai.deployCount > 0 && !world.player.inVehicle) {
        ai.deployCount -= 1;
        const sideX = v.x + Math.cos(v.angle + 1.57) * 34;
        const sideY = v.y + Math.sin(v.angle + 1.57) * 34;
        spawnOfficer(sideX, sideY, v.driver === 'swat');
      }

      if (ai.roadblock && dist > 300) {
        // Hold roadblock until player gets close
        vehicleMgr.applyVehiclePhysics(v, 0, 0, true, dt, null);
        continue;
      }
      ai.roadblock = false;

      // Pursuit steering toward player's predicted lead position
      const leadTime = clamp(dist / 520, 0.1, 0.7);
      const pvx = world.player.inVehicle ? world.player.vehicle.vx : 0;
      const pvy = world.player.inVehicle ? world.player.vehicle.vy : 0;
      const tx = px + pvx * leadTime;
      const ty = py + pvy * leadTime;

      const desiredAngle = Math.atan2(ty - v.y, tx - v.x);
      const angleErr = normalizeAngle(desiredAngle - v.angle);
      const steer = clamp(angleErr * 2.4, -1, 1);

      let throttle = 0.94;
      if (v.speed < 35) ai.stuckTimer += dt;
      else ai.stuckTimer = Math.max(0, ai.stuckTimer - dt);

      if (ai.stuckTimer > 1.2) {
        throttle = -0.85;
        if (ai.stuckTimer > 2.0) ai.stuckTimer = 0;
      } else if (dist < 95 && !world.player.inVehicle) {
        throttle = 0.25;
      }

      vehicleMgr.applyVehiclePhysics(v, throttle, steer, Math.abs(angleErr) > 1.25 && v.speed > 260, dt, null);
    }
  }

  function updateOfficers(world, dt) {
    const px = world.player.x;
    const py = world.player.y;

    for (let i = units.length - 1; i >= 0; i -= 1) {
      const u = units[i];
      if (!u.alive || u.hp <= 0) {
        world.spawnPickup('cash', u.x, u.y, u.isSwat ? 95 : 45);
        if (u.isSwat && rand.chance(0.45)) world.spawnPickup('armor', u.x + 12, u.y, 35);
        else if (rand.chance(0.35)) world.spawnPickup('ammo', u.x - 10, u.y, 12);
        world.stats.policeDown += 1;
        units.splice(i, 1);
        continue;
      }

      const dx = px - u.x;
      const dy = py - u.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1100 || state.wantedLevel === 0) {
        units.splice(i, 1);
        continue;
      }

      u.angle = Math.atan2(dy, dx);
      const canSee = dist < 540 && city.hasLineOfSight(u.x, u.y, px, py);
      if (canSee) state.spotted = true;

      const idealDist = u.isSwat ? 180 : 155;
      if (dist > idealDist || !canSee) {
        u.x += Math.cos(u.angle) * u.speed * dt;
        u.y += Math.sin(u.angle) * u.speed * dt;
        u.walkPhase += dt * 11;
        city.resolveCircleCollisions(u, 12);
      }

      u.fireCooldown -= dt;
      if (canSee && u.fireCooldown <= 0) {
        u.fireCooldown = u.isSwat ? 0.32 : 0.72;
        world.fireEnemyBullet(u.x, u.y, u.angle + rand.range(-0.08, 0.08), u.isSwat ? 14 : 9, '#ff6b4a');
      }

      // Check fast vehicle ramming officer
      for (let vIdx = 0; vIdx < vehicleMgr.vehicles.length; vIdx += 1) {
        const v = vehicleMgr.vehicles[vIdx];
        if (v.exploded || v.speed < 110) continue;
        if (v.driver === 'police' || v.driver === 'swat') continue;
        if (Math.hypot(v.x - u.x, v.y - u.y) < v.spec.width * 0.62 + 10) {
          u.hp = 0;
          world.spawnHitEffect(u.x, u.y, '#e63946', 9);
          if (v.driver === 'player') reportCrime(45, px, py);
          break;
        }
      }
    }
  }

  function update(world, dt, time) {
    for (let i = roadblocks.length - 1; i >= 0; i -= 1) {
      roadblocks[i].ttl -= dt;
      if (roadblocks[i].ttl <= 0) roadblocks.splice(i, 1);
    }

    if (state.wantedLevel === 0) {
      spotlight.active = false;
      updatePoliceVehicles(world, dt);
      return;
    }

    const px = world.player.x;
    const py = world.player.y;

    // Check line of sight from police cars or officers
    let seen = false;
    for (let i = 0; i < vehicleMgr.vehicles.length; i += 1) {
      const v = vehicleMgr.vehicles[i];
      if (!v.exploded && (v.driver === 'police' || v.driver === 'swat')) {
        const d = Math.hypot(v.x - px, v.y - py);
        if (d < 460 && city.hasLineOfSight(v.x, v.y, px, py)) {
          seen = true;
          break;
        }
      }
    }
    if (!seen) {
      for (let i = 0; i < units.length; i += 1) {
        const u = units[i];
        const d = Math.hypot(u.x - px, u.y - py);
        if (d < 440 && city.hasLineOfSight(u.x, u.y, px, py)) {
          seen = true;
          break;
        }
      }
    }

    state.spotted = seen;
    if (seen) {
      state.lastSeenX = px;
      state.lastSeenY = py;
      state.evadeTimer = 0;
    } else {
      const distFromZone = Math.hypot(px - state.lastSeenX, py - state.lastSeenY);
      const decayMult = distFromZone > state.searchRadius ? 1.55 : 0.75;
      state.evadeTimer += dt * decayMult;
      if (state.evadeTimer >= state.evadeDuration) {
        world.stats.chasesEvaded += 1;
        clearWanted();
        return;
      }
    }

    // Escalation spawns
    state.spawnCooldown -= dt;
    if (state.spawnCooldown <= 0) {
      state.spawnCooldown = Math.max(2.1, 6.2 - state.wantedLevel * 0.9);
      spawnPursuitVehicle(world);
    }

    state.roadblockCooldown -= dt;
    if (state.roadblockCooldown <= 0 && state.wantedLevel >= 3) {
      state.roadblockCooldown = 11.5;
      spawnRoadblock(world);
    }

    // 5-Star overhead helicopter spotlight sweep
    if (state.wantedLevel >= 5) {
      spotlight.active = true;
      spotlight.angle = time * 1.4;
      spotlight.x = px + Math.cos(spotlight.angle) * 58;
      spotlight.y = py + Math.sin(spotlight.angle * 0.8) * 44;
    } else {
      spotlight.active = false;
    }

    updatePoliceVehicles(world, dt);
    updateOfficers(world, dt);
  }

  function clear() {
    clearWanted();
  }

  return {
    state,
    units,
    roadblocks,
    spotlight,
    reportCrime,
    setMinimumWanted,
    clearWanted,
    spawnOfficer,
    spawnPursuitVehicle,
    spawnRoadblock,
    update,
    clear,
  };
}
