// Vehicle physics, drift handling, body damage, explosions, skidmarks, and hijack mechanics.
// Supports Muscle Car, Sport Coupe, Cargo Van, Police Interceptor, and SWAT Armored classes.

import { VEHICLE_CLASSES } from './config.js';
import { clamp, normalizeAngle } from './random.js';

export function createVehicleManager(city, rand) {
  const vehicles = [];
  const skidmarks = [];
  let nextId = 1;

  function addSkid(x1, y1, x2, y2, alpha = 0.42) {
    skidmarks.push({ x1, y1, x2, y2, alpha });
    if (skidmarks.length > 360) skidmarks.shift();
  }

  function spawnVehicle(classKey, x, y, angle, options = {}) {
    const spec = VEHICLE_CLASSES[classKey] ?? VEHICLE_CLASSES.muscle;
    const color = options.color ?? rand.pick(spec.colors);
    const vehicle = {
      id: nextId++,
      kind: classKey,
      spec,
      color,
      x,
      y,
      angle,
      vx: 0,
      vy: 0,
      speed: 0,
      steerAngle: 0,
      hp: options.hp ?? spec.maxHp,
      maxHp: spec.maxHp,
      exploded: false,
      sirenOn: Boolean(options.sirenOn),
      sirenPhase: rand.range(0, Math.PI * 2),
      driver: options.driver ?? 'none', // 'none' | 'player' | 'traffic' | 'police' | 'swat' | 'convoy'
      aiState: options.aiState ?? null,
      missionTag: options.missionTag ?? null,
      smokeTimer: 0,
      lastRearX: x,
      lastRearY: y,
      drifting: false,
      headlights: true,
    };
    vehicles.push(vehicle);
    return vehicle;
  }

  function seedParkedVehicles() {
    const parkedSpots = [
      ['muscle', 525, 490, Math.PI * 0.5],
      ['coupe', 750, 690, 0],
      ['coupe', 1582, 740, Math.PI * 0.5],
      ['muscle', 1460, 1140, -Math.PI * 0.5],
      ['van', 2985, 2045, 0],
      ['muscle', 2460, 1882, 0],
      ['coupe', 2020, 1360, Math.PI],
      ['van', 2840, 1285, 0],
      ['police', 1582, 1358, Math.PI],
      ['coupe', 515, 1620, Math.PI * 0.5],
      ['muscle', 1040, 1875, 0],
      ['van', 3160, 920, Math.PI * 0.5],
    ];
    for (const [kind, x, y, angle] of parkedSpots) {
      spawnVehicle(kind, x, y, angle, { driver: 'none' });
    }
  }

  function applyVehiclePhysics(v, throttle, steer, handbrake, dt, playerUpgrades) {
    const spec = v.spec;
    const isPlayer = v.driver === 'player';
    const turboMul = isPlayer && playerUpgrades?.turbo ? 1.15 : 1.0;
    const maxSpeed = spec.maxSpeed * turboMul;

    const cos = Math.cos(v.angle);
    const sin = Math.sin(v.angle);

    let forwardVel = v.vx * cos + v.vy * sin;
    let lateralVel = -v.vx * sin + v.vy * cos;

    // Acceleration and braking
    if (throttle > 0) {
      forwardVel += spec.accel * turboMul * throttle * dt;
    } else if (throttle < 0) {
      if (forwardVel > 24) {
        forwardVel -= spec.brake * (-throttle) * dt;
      } else {
        forwardVel += spec.accel * 0.55 * throttle * dt;
      }
    } else {
      forwardVel *= Math.exp(-1.55 * dt);
    }

    if (handbrake) {
      forwardVel *= Math.exp(-1.9 * dt);
    }

    forwardVel = clamp(forwardVel, -spec.reverseSpeed, maxSpeed);

    // Steering responds smoothly to forward velocity
    const speedFactor = clamp(Math.abs(forwardVel) / 140, 0, 1);
    const revDir = forwardVel >= -5 ? 1 : -1;
    const steerGain = handbrake ? spec.turnRate * 1.28 : spec.turnRate;
    v.angle = normalizeAngle(v.angle + steer * steerGain * speedFactor * revDir * dt);
    v.steerAngle = steer * 0.45;

    // Lateral grip (lower grip during handbrake creates satisfying drifts)
    const gripRate = handbrake ? spec.driftGrip : spec.grip;
    const oldLat = lateralVel;
    lateralVel *= Math.exp(-gripRate * dt);
    v.drifting = Math.abs(oldLat) > 62 && Math.abs(forwardVel) > 155;

    const nCos = Math.cos(v.angle);
    const nSin = Math.sin(v.angle);
    v.vx = nCos * forwardVel - nSin * lateralVel;
    v.vy = nSin * forwardVel + nCos * lateralVel;
    v.speed = Math.hypot(v.vx, v.vy);

    const prevRearX = v.x - nCos * (spec.length * 0.34);
    const prevRearY = v.y - nSin * (spec.length * 0.34);

    v.x += v.vx * dt;
    v.y += v.vy * dt;

    // City obstacle collision
    const radius = spec.width * 0.54;
    const beforeX = v.x;
    const beforeY = v.y;
    city.resolveCircleCollisions(v, radius);
    if (Math.hypot(v.x - beforeX, v.y - beforeY) > 1.2) {
      const impact = v.speed;
      v.vx *= 0.45;
      v.vy *= 0.45;
      if (impact > 240 && !v.exploded) {
        v.hp = Math.max(0, v.hp - (impact - 220) * 0.06);
      }
    }

    // Skidmarks when drifting or hard braking
    const rearX = v.x - nCos * (spec.length * 0.34);
    const rearY = v.y - nSin * (spec.length * 0.34);
    if ((v.drifting || (handbrake && v.speed > 180)) && Math.hypot(rearX - prevRearX, rearY - prevRearY) < 40) {
      const perpX = -nSin * (spec.width * 0.34);
      const perpY = nCos * (spec.width * 0.34);
      addSkid(prevRearX + perpX, prevRearY + perpY, rearX + perpX, rearY + perpY, 0.36);
      addSkid(prevRearX - perpX, prevRearY - perpY, rearX - perpX, rearY - perpY, 0.36);
    }
  }

  function resolveVehicleCollisions(world) {
    for (let i = 0; i < vehicles.length; i += 1) {
      const a = vehicles[i];
      if (a.exploded) continue;
      const aOff = a.spec.length * 0.24;
      const aRad = a.spec.width * 0.49;
      const aCos = Math.cos(a.angle);
      const aSin = Math.sin(a.angle);

      for (let j = i + 1; j < vehicles.length; j += 1) {
        const b = vehicles[j];
        if (b.exploded) continue;
        if (Math.abs(a.x - b.x) > 110 || Math.abs(a.y - b.y) > 110) continue;

        const bOff = b.spec.length * 0.24;
        const bRad = b.spec.width * 0.49;
        const bCos = Math.cos(b.angle);
        const bSin = Math.sin(b.angle);
        const minDist = aRad + bRad;

        // 2-circle capsule check (front & rear bumpers) prevents nose/tail overlap
        let bestOverlap = 0;
        let bestNx = 0;
        let bestNy = 0;
        for (const sa of [-1, 1]) {
          const ax = a.x + aCos * aOff * sa;
          const ay = a.y + aSin * aOff * sa;
          for (const sb of [-1, 1]) {
            const bx = b.x + bCos * bOff * sb;
            const by = b.y + bSin * bOff * sb;
            const dx = bx - ax;
            const dy = by - ay;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDist * minDist && distSq > 0.0001) {
              const dist = Math.sqrt(distSq);
              const ov = minDist - dist;
              if (ov > bestOverlap) {
                bestOverlap = ov;
                bestNx = dx / dist;
                bestNy = dy / dist;
              }
            }
          }
        }
        if (bestOverlap <= 0) continue;

        const totalMass = a.spec.mass + b.spec.mass;
        const aShare = b.spec.mass / totalMass;
        const bShare = a.spec.mass / totalMass;

        a.x -= bestNx * bestOverlap * aShare;
        a.y -= bestNy * bestOverlap * aShare;
        b.x += bestNx * bestOverlap * bShare;
        b.y += bestNy * bestOverlap * bShare;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const sepVel = rvx * bestNx + rvy * bestNy;
        if (sepVel < 0) {
          const impulse = -1.35 * sepVel;
          a.vx -= bestNx * impulse * aShare;
          a.vy -= bestNy * impulse * aShare;
          b.vx += bestNx * impulse * bShare;
          b.vy += bestNy * impulse * bShare;

          const impactSpeed = Math.abs(sepVel);
          if (impactSpeed > 180) {
            const dmg = (impactSpeed - 170) * 0.085;
            a.hp = Math.max(0, a.hp - dmg * aShare);
            b.hp = Math.max(0, b.hp - dmg * bShare);
            world.spawnSparks((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, 6);
            if (a.driver === 'player' && (b.driver === 'police' || b.driver === 'swat')) {
              world.police.reportCrime(28, a.x, a.y);
            }
          }
        }
      }
    }
  }

  function update(world, dt) {
    for (let i = 0; i < vehicles.length; i += 1) {
      const v = vehicles[i];
      if (v.sirenOn) v.sirenPhase += dt * 11;

      if (v.exploded) {
        v.vx *= Math.exp(-4 * dt);
        v.vy *= Math.exp(-4 * dt);
        v.x += v.vx * dt;
        v.y += v.vy * dt;
        v.smokeTimer -= dt;
        if (v.smokeTimer <= 0) {
          v.smokeTimer = 0.14;
          world.spawnSmoke(v.x, v.y, '#202630', 14);
        }
        continue;
      }

      if (v.hp <= 0) {
        v.exploded = true;
        v.sirenOn = false;
        world.triggerExplosion(v.x, v.y, 140, 80);
        if (v.driver === 'player') {
          world.ejectPlayerFromVehicle(v, true);
        }
        v.driver = 'none';
        continue;
      }

      // Passive friction for empty vehicles
      if (v.driver === 'none') {
        v.vx *= Math.exp(-3.4 * dt);
        v.vy *= Math.exp(-3.4 * dt);
        v.speed = Math.hypot(v.vx, v.vy);
        if (v.speed > 2) {
          v.x += v.vx * dt;
          v.y += v.vy * dt;
          city.resolveCircleCollisions(v, v.spec.width * 0.54);
        }
      }

      // Damaged engine smoke
      if (v.hp < v.maxHp * 0.42) {
        v.smokeTimer -= dt;
        if (v.smokeTimer <= 0) {
          v.smokeTimer = v.hp < v.maxHp * 0.2 ? 0.06 : 0.14;
          const noseX = v.x + Math.cos(v.angle) * (v.spec.length * 0.34);
          const noseY = v.y + Math.sin(v.angle) * (v.spec.length * 0.34);
          world.spawnSmoke(noseX, noseY, v.hp < v.maxHp * 0.2 ? '#f06449' : '#636d7d', 9);
        }
      }
    }

    resolveVehicleCollisions(world);
  }

  function findNearestEnterable(x, y, maxDist = 74) {
    let best = null;
    let bestDist = maxDist;
    for (let i = 0; i < vehicles.length; i += 1) {
      const v = vehicles[i];
      if (v.exploded || v.driver === 'player') continue;
      const d = Math.hypot(v.x - x, v.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  }

  function repairAndRespray(v, newColor = null) {
    v.hp = v.maxHp;
    v.exploded = false;
    if (newColor) v.color = newColor;
    else if (!v.spec.siren) v.color = rand.pick(v.spec.colors);
  }

  function clear() {
    vehicles.length = 0;
    skidmarks.length = 0;
    nextId = 1;
  }

  return {
    vehicles,
    skidmarks,
    spawnVehicle,
    seedParkedVehicles,
    applyVehiclePhysics,
    update,
    findNearestEnterable,
    repairAndRespray,
    addSkid,
    clear,
  };
}
