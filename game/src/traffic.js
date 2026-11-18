// Autonomous street traffic and city pedestrians with traffic-signal compliance and panic reactions.
// Traffic vehicles follow Solara Bay avenues and streets; pedestrians patrol sidewalks and crosswalks.

import { H_ROADS, V_ROADS } from './city.js';
import { clamp, normalizeAngle } from './random.js';

const MAX_TRAFFIC_CARS = 18;
const MAX_PEDS = 38;

export function createTrafficSystem(city, vehicleMgr, rand) {
  const pedestrians = [];
  const panicEvents = [];
  let pedSpawnTimer = 0;
  let carSpawnTimer = 0;

  function triggerPanic(x, y, radius = 340, duration = 4.5) {
    panicEvents.push({ x, y, radius, ttl: duration });
    if (panicEvents.length > 10) panicEvents.shift();
  }

  function spawnTrafficCar(nearX, nearY, forceVisible = false) {
    let activeTraffic = 0;
    for (let i = 0; i < vehicleMgr.vehicles.length; i += 1) {
      if (vehicleMgr.vehicles[i].driver === 'traffic' && !vehicleMgr.vehicles[i].exploded) {
        activeTraffic += 1;
      }
    }
    if (activeTraffic >= MAX_TRAFFIC_CARS) return null;

    const horizontal = rand.chance(0.5);
    const kind = rand.pick(['muscle', 'coupe', 'van', 'muscle', 'coupe']);
    let x = 0;
    let y = 0;
    let angle = 0;
    let roadCoord = 0;
    let dir = 1;

    if (horizontal) {
      const roadY = rand.pick(H_ROADS);
      const maxX = roadY === 2400 ? 2040 : 3180;
      dir = rand.chance(0.5) ? 1 : -1;
      const laneOffset = dir > 0 ? 28 : -28;
      x = forceVisible
        ? clamp(nearX + rand.range(-480, 480), 480, maxX)
        : rand.range(480, maxX);
      y = roadY + laneOffset;
      angle = dir > 0 ? 0 : Math.PI;
      roadCoord = roadY;
    } else {
      const roadX = rand.pick(V_ROADS);
      const maxY = roadX >= 2640 ? 1900 : 2360;
      dir = rand.chance(0.5) ? 1 : -1;
      const laneOffset = dir > 0 ? -28 : 28;
      x = roadX + laneOffset;
      y = forceVisible
        ? clamp(nearY + rand.range(-360, 360), 340, maxY)
        : rand.range(340, maxY);
      angle = dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      roadCoord = roadX;
    }

    // Keep clear of existing cars
    for (let i = 0; i < vehicleMgr.vehicles.length; i += 1) {
      const other = vehicleMgr.vehicles[i];
      if (Math.hypot(other.x - x, other.y - y) < 115) return null;
    }

    return vehicleMgr.spawnVehicle(kind, x, y, angle, {
      driver: 'traffic',
      aiState: {
        axis: horizontal ? 'h' : 'v',
        dir,
        roadCoord,
        targetSpeed: rand.range(165, 235),
        panicTimer: 0,
        turnCooldown: rand.range(1.2, 3.0),
      },
    });
  }

  function spawnPedestrian(nearX = null, nearY = null) {
    if (pedestrians.length >= MAX_PEDS) return null;
    const vx = rand.pick(V_ROADS);
    const hy = rand.pick(H_ROADS);
    if (vx >= 2640 && hy >= 2400) return null;

    const sideX = rand.chance(0.5) ? -74 : 74;
    const sideY = rand.chance(0.5) ? -74 : 74;
    let x = vx + sideX + rand.range(-12, 12);
    let y = hy + sideY + rand.range(-12, 12);

    if (nearX !== null && nearY !== null) {
      x = clamp(nearX + rand.range(-520, 520), 280, 3440);
      y = clamp(nearY + rand.range(-360, 360), 220, 2460);
    }
    if (city.isPointBlocked(x, y, 14)) return null;

    const shirtPalette = ['#f4a261', '#2a9d8f', '#e9c46a', '#e76f51', '#f1faee', '#5aa9e6'];
    const ped = {
      x,
      y,
      angle: rand.range(-Math.PI, Math.PI),
      speed: rand.range(38, 62),
      hp: 40,
      alive: true,
      panicTimer: 0,
      panicDx: 0,
      panicDy: 0,
      walkPhase: rand.range(0, 6.28),
      turnTimer: rand.range(1.5, 4.5),
      shirt: rand.pick(shirtPalette),
      hair: rand.pick(['#1d222b', '#4d3524', '#c9934b', '#8c4430']),
      cash: rand.int(12, 55),
    };
    pedestrians.push(ped);
    return ped;
  }

  function seedInitial(focusX, focusY) {
    for (let i = 0; i < 12; i += 1) spawnTrafficCar(focusX, focusY, i < 6);
    for (let i = 0; i < 24; i += 1) spawnPedestrian(i < 10 ? focusX : null, i < 10 ? focusY : null);
  }

  function isRedLightAhead(v, axis, dir, time) {
    const checkDist = 92;
    const lookX = v.x + Math.cos(v.angle) * checkDist;
    const lookY = v.y + Math.sin(v.angle) * checkDist;
    for (let i = 0; i < city.signals.length; i += 1) {
      const sig = city.signals[i];
      if (Math.hypot(sig.x - lookX, sig.y - lookY) < 62) {
        const state = city.getSignalState(sig, time);
        if (axis === 'h' && state.ew === 'red') return true;
        if (axis === 'v' && state.ns === 'red') return true;
      }
    }
    return false;
  }

  function hasObstacleAhead(v, world) {
    const fx = Math.cos(v.angle);
    const fy = Math.sin(v.angle);
    for (let i = 0; i < vehicleMgr.vehicles.length; i += 1) {
      const other = vehicleMgr.vehicles[i];
      if (other === v) continue;
      const dx = other.x - v.x;
      const dy = other.y - v.y;
      const forward = dx * fx + dy * fy;
      const side = Math.abs(-dx * fy + dy * fx);
      if (forward > 12 && forward < 126 && side < 38) return true;
    }
    if (!world.player.inVehicle) {
      const dx = world.player.x - v.x;
      const dy = world.player.y - v.y;
      const forward = dx * fx + dy * fy;
      const side = Math.abs(-dx * fy + dy * fx);
      if (forward > 10 && forward < 105 && side < 32) return true;
    }
    return false;
  }

  function updateTrafficCar(v, world, dt, time) {
    const ai = v.aiState;
    if (!ai) return;

    // Check panic events
    for (let i = 0; i < panicEvents.length; i += 1) {
      const ev = panicEvents[i];
      if (Math.hypot(v.x - ev.x, v.y - ev.y) < ev.radius) {
        ai.panicTimer = 3.5;
      }
    }
    if (ai.panicTimer > 0) ai.panicTimer -= dt;
    if (ai.turnCooldown > 0) ai.turnCooldown -= dt;

    // Turn at road boundaries or intersections occasionally
    const maxX = ai.roadCoord === 2400 ? 2060 : 3200;
    const minX = 460;
    const minY = 320;
    const maxY = ai.roadCoord >= 2640 ? 1940 : 2380;

    let desiredAngle = v.angle;
    if (ai.axis === 'h') {
      if (v.x > maxX - 30 && ai.dir > 0) {
        ai.dir = -1;
        ai.roadCoord = v.y;
      } else if (v.x < minX + 30 && ai.dir < 0) {
        ai.dir = 1;
      }
      desiredAngle = ai.dir > 0 ? 0 : Math.PI;
    } else {
      if (v.y > maxY - 30 && ai.dir > 0) {
        ai.dir = -1;
      } else if (v.y < minY + 30 && ai.dir < 0) {
        ai.dir = 1;
      }
      desiredAngle = ai.dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    }

    // Intersection turning decision
    if (ai.turnCooldown <= 0) {
      for (let i = 0; i < V_ROADS.length; i += 1) {
        for (let j = 0; j < H_ROADS.length; j += 1) {
          const vx = V_ROADS[i];
          const hy = H_ROADS[j];
          if (vx >= 2640 && hy >= 2400) continue;
          if (Math.hypot(v.x - vx, v.y - hy) < 42) {
            ai.turnCooldown = 2.6;
            if (rand.chance(0.32)) {
              if (ai.axis === 'h') {
                ai.axis = 'v';
                ai.roadCoord = vx;
                ai.dir = hy >= 1940 ? -1 : hy <= 320 ? 1 : rand.chance(0.5) ? 1 : -1;
                desiredAngle = ai.dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
              } else {
                ai.axis = 'h';
                ai.roadCoord = hy;
                ai.dir = vx >= 3200 ? -1 : vx <= 460 ? 1 : rand.chance(0.5) ? 1 : -1;
                desiredAngle = ai.dir > 0 ? 0 : Math.PI;
              }
            }
          }
        }
      }
    }

    const angleErr = normalizeAngle(desiredAngle - v.angle);
    const steer = clamp(angleErr * 2.2, -1, 1);

    let throttle = 0.58;
    if (ai.panicTimer > 0) {
      throttle = 1.0;
    } else if (isRedLightAhead(v, ai.axis, ai.dir, time) || hasObstacleAhead(v, world)) {
      throttle = v.speed > 20 ? -0.9 : 0;
    } else if (v.speed > ai.targetSpeed) {
      throttle = 0;
    }

    vehicleMgr.applyVehiclePhysics(v, throttle, steer, false, dt, null);
  }

  function updatePedestrians(world, dt) {
    for (let i = pedestrians.length - 1; i >= 0; i -= 1) {
      const p = pedestrians[i];
      if (!p.alive) {
        pedestrians.splice(i, 1);
        continue;
      }

      // Check panic from gunfire / explosions / close speeding cars
      for (let e = 0; e < panicEvents.length; e += 1) {
        const ev = panicEvents[e];
        const dx = p.x - ev.x;
        const dy = p.y - ev.y;
        const d = Math.hypot(dx, dy);
        if (d < ev.radius && d > 1) {
          p.panicTimer = 4.2;
          p.panicDx = dx / d;
          p.panicDy = dy / d;
        }
      }

      if (p.panicTimer > 0) {
        p.panicTimer -= dt;
        p.angle = Math.atan2(p.panicDy, p.panicDx);
        const runSpeed = 165;
        p.x += Math.cos(p.angle) * runSpeed * dt;
        p.y += Math.sin(p.angle) * runSpeed * dt;
        p.walkPhase += dt * 15;
      } else {
        p.turnTimer -= dt;
        if (p.turnTimer <= 0) {
          p.turnTimer = rand.range(2.0, 5.0);
          p.angle += rand.range(-1.4, 1.4);
        }
        p.x += Math.cos(p.angle) * p.speed * dt;
        p.y += Math.sin(p.angle) * p.speed * dt;
        p.walkPhase += dt * 7;
      }

      const prevX = p.x;
      const prevY = p.y;
      city.resolveCircleCollisions(p, 11);
      if (Math.hypot(p.x - prevX, p.y - prevY) > 0.5) {
        p.angle += Math.PI * 0.75;
      }

      // Vehicle hit check
      for (let vIdx = 0; vIdx < vehicleMgr.vehicles.length; vIdx += 1) {
        const v = vehicleMgr.vehicles[vIdx];
        if (v.exploded || v.speed < 85) continue;
        if (Math.hypot(v.x - p.x, v.y - p.y) < v.spec.width * 0.6 + 9) {
          p.alive = false;
          world.spawnHitEffect(p.x, p.y, '#e63946', 8);
          world.spawnPickup('cash', p.x, p.y, p.cash);
          if (v.driver === 'player') {
            world.stats.pedsHit += 1;
            world.police.reportCrime(22, p.x, p.y);
            triggerPanic(p.x, p.y, 260, 3.0);
          }
          break;
        }
      }
    }
  }

  function update(world, dt, time) {
    for (let i = panicEvents.length - 1; i >= 0; i -= 1) {
      panicEvents[i].ttl -= dt;
      if (panicEvents[i].ttl <= 0) panicEvents.splice(i, 1);
    }

    for (let i = 0; i < vehicleMgr.vehicles.length; i += 1) {
      const v = vehicleMgr.vehicles[i];
      if (!v.exploded && v.driver === 'traffic') {
        updateTrafficCar(v, world, dt, time);
      }
    }

    updatePedestrians(world, dt);

    carSpawnTimer -= dt;
    if (carSpawnTimer <= 0) {
      carSpawnTimer = 2.2;
      spawnTrafficCar(world.player.x, world.player.y, false);
    }

    pedSpawnTimer -= dt;
    if (pedSpawnTimer <= 0) {
      pedSpawnTimer = 1.6;
      spawnPedestrian(world.player.x, world.player.y);
    }
  }

  function clear() {
    pedestrians.length = 0;
    panicEvents.length = 0;
  }

  return {
    pedestrians,
    seedInitial,
    spawnTrafficCar,
    spawnPedestrian,
    triggerPanic,
    update,
    clear,
  };
}
