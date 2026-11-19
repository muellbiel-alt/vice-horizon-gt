// Autonomous street traffic controller with intersection signal compliance, lane steering,
// obstacle avoidance, and shared city-wide panic event propagation.

import { H_ROADS, V_ROADS } from '../world/city.js';
import { clamp, normalizeAngle } from '../core/random.js';

const MAX_TRAFFIC_CARS = 18;

export function createTrafficSystem(city, vehicleMgr, pedMgr, rand) {
  const panicEvents = [];
  let carSpawnTimer = 0;

  function triggerPanic(x, y, radius = 340, duration = 4.5) {
    panicEvents.push({ x, y, radius, ttl: duration });
    if (panicEvents.length > 10) panicEvents.shift();
  }

  function spawnTrafficCar(nearX, nearY, forceVisible = false) {
    let active = 0;
    for (const v of vehicleMgr.vehicles) if (v.driver === 'traffic' && !v.exploded) active += 1;
    if (active >= MAX_TRAFFIC_CARS) return null;

    const horiz = rand.chance(0.5);
    const kind = rand.pick(['muscle', 'coupe', 'van', 'muscle', 'coupe']);
    let x = 0; let y = 0; let angle = 0; let roadCoord = 0; let dir = rand.chance(0.5) ? 1 : -1;

    if (horiz) {
      roadCoord = rand.pick(H_ROADS);
      const maxX = roadCoord === 2400 ? 2040 : 3180;
      x = forceVisible ? clamp(nearX + rand.range(-480, 480), 480, maxX) : rand.range(480, maxX);
      y = roadCoord + (dir > 0 ? 28 : -28);
      angle = dir > 0 ? 0 : Math.PI;
    } else {
      roadCoord = rand.pick(V_ROADS);
      const maxY = roadCoord >= 2640 ? 1900 : 2360;
      x = roadCoord + (dir > 0 ? -28 : 28);
      y = forceVisible ? clamp(nearY + rand.range(-360, 360), 340, maxY) : rand.range(340, maxY);
      angle = dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    }

    for (const other of vehicleMgr.vehicles) if (!other.spec.aircraft && Math.hypot(other.x - x, other.y - y) < 115) return null;
    return vehicleMgr.spawnVehicle(kind, x, y, angle, {
      driver: 'traffic',
      aiState: { axis: horiz ? 'h' : 'v', dir, roadCoord, targetSpeed: rand.range(168, 240), panicTimer: 0, turnCooldown: rand.range(1.2, 3.0) },
    });
  }

  function isRedLightAhead(v, axis, time) {
    const lx = v.x + Math.cos(v.angle) * 92; const ly = v.y + Math.sin(v.angle) * 92;
    for (const sig of city.signals) {
      if (Math.hypot(sig.x - lx, sig.y - ly) < 62) {
        const st = city.getSignalState(sig, time);
        if ((axis === 'h' && st.ew === 'red') || (axis === 'v' && st.ns === 'red')) return true;
      }
    }
    return false;
  }

  function hasObstacleAhead(v, world) {
    const fx = Math.cos(v.angle); const fy = Math.sin(v.angle);
    for (const o of vehicleMgr.vehicles) {
      if (o === v || o.spec.aircraft) continue;
      const dx = o.x - v.x; const dy = o.y - v.y;
      const fwd = dx * fx + dy * fy;
      if (fwd > 12 && fwd < 126 && Math.abs(-dx * fy + dy * fx) < 38) return true;
    }
    if (!world.player.inVehicle) {
      const dx = world.player.x - v.x; const dy = world.player.y - v.y;
      const fwd = dx * fx + dy * fy;
      if (fwd > 10 && fwd < 105 && Math.abs(-dx * fy + dy * fx) < 32) return true;
    }
    return false;
  }

  function updateTrafficCar(v, world, dt, time) {
    const ai = v.aiState; if (!ai) return;
    for (const ev of panicEvents) if (Math.hypot(v.x - ev.x, v.y - ev.y) < ev.radius) ai.panicTimer = 3.5;
    if (ai.panicTimer > 0) ai.panicTimer -= dt;
    if (ai.turnCooldown > 0) ai.turnCooldown -= dt;

    const maxX = ai.roadCoord === 2400 ? 2060 : 3200;
    const maxY = ai.roadCoord >= 2640 ? 1940 : 2380;
    let des = v.angle;
    if (ai.axis === 'h') {
      if (v.x > maxX - 30 && ai.dir > 0) { ai.dir = -1; ai.roadCoord = v.y; }
      else if (v.x < 490 && ai.dir < 0) ai.dir = 1;
      des = ai.dir > 0 ? 0 : Math.PI;
    } else {
      if (v.y > maxY - 30 && ai.dir > 0) ai.dir = -1;
      else if (v.y < 350 && ai.dir < 0) ai.dir = 1;
      des = ai.dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    }

    if (ai.turnCooldown <= 0) {
      for (const vx of V_ROADS) for (const hy of H_ROADS) {
        if ((vx >= 2640 && hy >= 2400) || Math.hypot(v.x - vx, v.y - hy) >= 42) continue;
        ai.turnCooldown = 2.6;
        if (rand.chance(0.32)) {
          if (ai.axis === 'h') { ai.axis = 'v'; ai.roadCoord = vx; ai.dir = hy >= 1940 ? -1 : hy <= 320 ? 1 : rand.chance(0.5) ? 1 : -1; des = ai.dir > 0 ? 1.5708 : -1.5708; }
          else { ai.axis = 'h'; ai.roadCoord = hy; ai.dir = vx >= 3200 ? -1 : vx <= 460 ? 1 : rand.chance(0.5) ? 1 : -1; des = ai.dir > 0 ? 0 : Math.PI; }
        }
      }
    }

    const steer = clamp(normalizeAngle(des - v.angle) * 2.2, -1, 1);
    const thr = ai.panicTimer > 0 ? 1.0 : isRedLightAhead(v, ai.axis, time) || hasObstacleAhead(v, world) ? (v.speed > 20 ? -0.9 : 0) : v.speed > ai.targetSpeed ? 0 : 0.58;
    vehicleMgr.applyVehiclePhysics(v, thr, steer, false, dt, null);
  }

  function update(world, dt, time) {
    for (let i = panicEvents.length - 1; i >= 0; i -= 1) { panicEvents[i].ttl -= dt; if (panicEvents[i].ttl <= 0) panicEvents.splice(i, 1); }
    for (const v of vehicleMgr.vehicles) if (!v.exploded && v.driver === 'traffic') updateTrafficCar(v, world, dt, time);
    pedMgr.update(world, dt, panicEvents);
    carSpawnTimer -= dt;
    if (carSpawnTimer <= 0) { carSpawnTimer = 2.2; spawnTrafficCar(world.player.x, world.player.y, false); }
  }

  return {
    get pedestrians() { return pedMgr.pedestrians; },
    seedInitial: (fx, fy) => { for (let i = 0; i < 12; i += 1) spawnTrafficCar(fx, fy, i < 6); pedMgr.seedInitial(fx, fy); },
    spawnTrafficCar, spawnPedestrian: pedMgr.spawnPedestrian, triggerPanic, update,
    clear: () => { panicEvents.length = 0; pedMgr.clear(); },
  };
}
