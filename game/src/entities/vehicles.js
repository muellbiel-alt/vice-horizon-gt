// 6-class vehicle manager: Solara V8, Kestrel GT, Atlas Hauler, Meridian Interceptor,
// Bastion Armored Truck, and Skyhawk-7 Helicopter with Costa Customs tuning & drift physics.

import { VEHICLE_CLASSES } from '../core/config.js';
import { clamp, normalizeAngle } from '../core/random.js';

export function createVehicleManager(city, rand) {
  const vehicles = [], skidmarks = [];
  let nextId = 1;

  const addSkid = (x1, y1, x2, y2, alpha = 0.44) => { skidmarks.push({ x1, y1, x2, y2, alpha }); if (skidmarks.length > 380) skidmarks.shift(); };

  function spawnVehicle(classKey, x, y, angle, opt = {}) {
    const spec = VEHICLE_CLASSES[classKey] ?? VEHICLE_CLASSES.muscle;
    const v = {
      id: nextId++, kind: classKey, spec, color: opt.color ?? rand.pick(spec.colors), x, y, angle,
      vx: 0, vy: 0, speed: 0, steerAngle: 0, hp: opt.hp ?? spec.maxHp, maxHp: spec.maxHp, exploded: false,
      sirenOn: Boolean(opt.sirenOn), sirenPhase: rand.range(0, 6.28), rotorAngle: rand.range(0, 6.28),
      driver: opt.driver ?? 'none', aiState: opt.aiState ?? null, missionTag: opt.missionTag ?? null,
      smokeTimer: 0, punctureTimer: 0, drifting: false, headlights: opt.headlights !== false, underglow: Boolean(opt.underglow),
    };
    vehicles.push(v); return v;
  }

  function seedParkedVehicles() {
    [['muscle', 525, 490, 1.57], ['coupe', 750, 690, 0], ['coupe', 1582, 740, 1.57], ['muscle', 1460, 1140, -1.57],
      ['van', 2985, 2045, 0], ['muscle', 2460, 1882, 0], ['coupe', 2020, 1360, 3.14], ['van', 2840, 1285, 0],
      ['police', 1582, 1358, 3.14], ['armored', 2020, 1912, 3.14], ['heli', 2500, 2380, -1.57],
      ['coupe', 515, 1620, 1.57], ['muscle', 1040, 1875, 0]].forEach(([k, x, y, a]) => spawnVehicle(k, x, y, a, { driver: 'none' }));
  }

  function applyGarageTuning(v, upg, paint = null) {
    if (!v) return;
    if (upg?.chassis) { const r = v.hp / v.maxHp; v.maxHp = Math.round(v.spec.maxHp * 1.4); v.hp = Math.round(v.maxHp * r); }
    if (upg?.underglow && !v.spec.aircraft) v.underglow = true;
    if (paint && !v.spec.siren) v.color = paint;
  }

  function applyVehiclePhysics(v, thr, steer, hb, dt, upg) {
    const spec = v.spec, isP = v.driver === 'player', turbo = isP && upg?.turbo ? 1.16 : 1;
    const hand = isP && upg?.handling ? 1.2 : 1, punc = v.punctureTimer > 0 ? 0.58 : 1, maxS = spec.maxSpeed * turbo * punc;

    if (spec.aircraft) {
      v.angle = normalizeAngle(v.angle + steer * spec.turnRate * hand * dt);
      v.vx += Math.cos(v.angle) * thr * spec.accel * turbo * dt; v.vy += Math.sin(v.angle) * thr * spec.accel * turbo * dt;
      const d = Math.exp(-(hb ? 3.8 : 1.8) * dt); v.vx *= d; v.vy *= d;
      const s = Math.hypot(v.vx, v.vy); if (s > maxS) { v.vx = (v.vx / s) * maxS; v.vy = (v.vy / s) * maxS; }
      v.speed = Math.hypot(v.vx, v.vy); v.x += v.vx * dt; v.y += v.vy * dt;
      city.resolveCircleCollisions(v, spec.width * 0.5, true); return;
    }

    const c = Math.cos(v.angle), s = Math.sin(v.angle);
    let fwd = v.vx * c + v.vy * s, lat = -v.vx * s + v.vy * c;
    if (thr > 0) fwd += spec.accel * turbo * punc * thr * dt;
    else if (thr < 0) fwd += (fwd > 24 ? spec.brake : spec.accel * 0.55) * thr * dt;
    else fwd *= Math.exp(-1.55 * dt);
    if (hb) fwd *= Math.exp(-1.9 * dt);
    fwd = clamp(fwd, -spec.reverseSpeed, maxS);

    v.angle = normalizeAngle(v.angle + steer * (hb ? spec.turnRate * 1.28 : spec.turnRate) * hand * clamp(Math.abs(fwd) / 140, 0, 1) * (fwd >= -5 ? 1 : -1) * dt);
    v.steerAngle = steer * 0.45;
    const oldL = lat; lat *= Math.exp(-(hb ? spec.driftGrip : spec.grip) * (v.punctureTimer > 0 ? 0.55 : hand) * dt);
    v.drifting = Math.abs(oldL) > 60 && Math.abs(fwd) > 150;

    const nc = Math.cos(v.angle), ns = Math.sin(v.angle);
    v.vx = nc * fwd - ns * lat; v.vy = ns * fwd + nc * lat; v.speed = Math.hypot(v.vx, v.vy);
    const prx = v.x - nc * spec.length * 0.34, pry = v.y - ns * spec.length * 0.34, bx = v.x, by = v.y;
    v.x += v.vx * dt; v.y += v.vy * dt;
    city.resolveCircleCollisions(v, spec.width * 0.54, false);
    if (Math.hypot(v.x - bx, v.y - by) > 1.2) { const imp = v.speed; v.vx *= 0.45; v.vy *= 0.45; if (imp > 240 && !v.exploded) v.hp = Math.max(0, v.hp - (imp - 220) * 0.055); }

    const rx = v.x - nc * spec.length * 0.34, ry = v.y - ns * spec.length * 0.34;
    if ((v.drifting || (hb && v.speed > 175) || v.punctureTimer > 0) && Math.hypot(rx - prx, ry - pry) < 42) {
      const px = -ns * spec.width * 0.34, py = nc * spec.width * 0.34;
      addSkid(prx + px, pry + py, rx + px, ry + py, 0.38); addSkid(prx - px, pry - py, rx - px, ry - py, 0.38);
    }
  }

  function resolveCollisions(world) {
    for (let i = 0; i < vehicles.length; i += 1) {
      const a = vehicles[i]; if (a.exploded || a.spec.aircraft) continue;
      const aO = a.spec.length * 0.24, aR = a.spec.width * 0.49, ac = Math.cos(a.angle), as = Math.sin(a.angle);
      for (let j = i + 1; j < vehicles.length; j += 1) {
        const b = vehicles[j]; if (b.exploded || b.spec.aircraft || Math.abs(a.x - b.x) > 115 || Math.abs(a.y - b.y) > 115) continue;
        const bO = b.spec.length * 0.24, minD = aR + b.spec.width * 0.49, bc = Math.cos(b.angle), bs = Math.sin(b.angle);
        let best = 0, nx = 0, ny = 0;
        for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
          const dx = b.x + bc * bO * sb - (a.x + ac * aO * sa), dy = b.y + bs * bO * sb - (a.y + as * aO * sa), d2 = dx * dx + dy * dy;
          if (d2 < minD * minD && d2 > 0.0001) { const d = Math.sqrt(d2); if (minD - d > best) { best = minD - d; nx = dx / d; ny = dy / d; } }
        }
        if (best <= 0) continue;
        const tm = a.spec.mass + b.spec.mass, aS = b.spec.mass / tm, bS = a.spec.mass / tm;
        a.x -= nx * best * aS; a.y -= ny * best * aS; b.x += nx * best * bS; b.y += ny * best * bS;
        const sep = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (sep < 0) {
          const imp = -1.35 * sep; a.vx -= nx * imp * aS; a.vy -= ny * imp * aS; b.vx += nx * imp * bS; b.vy += ny * imp * bS;
          if (-sep > 175) {
            const dmg = (-sep - 165) * 0.085; a.hp = Math.max(0, a.hp - dmg * aS); b.hp = Math.max(0, b.hp - dmg * bS);
            world.spawnSparks((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, 8);
            if (a.driver === 'player' && (b.driver === 'police' || b.driver === 'swat')) world.police.reportCrime(28, a.x, a.y);
          }
        }
      }
    }
  }

  function update(world, dt) {
    for (const v of vehicles) {
      if (v.sirenOn) v.sirenPhase += dt * 11.5;
      if (v.punctureTimer > 0) v.punctureTimer = Math.max(0, v.punctureTimer - dt);
      if (v.spec.aircraft && (v.driver !== 'none' || v.speed > 5)) v.rotorAngle += dt * 22;
      if (v.exploded) {
        v.vx *= Math.exp(-4 * dt); v.vy *= Math.exp(-4 * dt); v.x += v.vx * dt; v.y += v.vy * dt;
        if ((v.smokeTimer -= dt) <= 0) { v.smokeTimer = 0.1; world.spawnSmoke(v.x, v.y, '#1c222b', 15); if (rand.chance(0.45)) world.spawnFire(v.x, v.y, 9); }
        continue;
      }
      if (v.hp <= 0) { v.exploded = true; v.sirenOn = false; world.triggerExplosion(v.x, v.y, 145, 80); if (v.driver === 'player') world.ejectPlayerFromVehicle(v, true); v.driver = 'none'; continue; }
      if (v.driver === 'none') {
        v.vx *= Math.exp(-3.4 * dt); v.vy *= Math.exp(-3.4 * dt); v.speed = Math.hypot(v.vx, v.vy);
        if (v.speed > 2) { v.x += v.vx * dt; v.y += v.vy * dt; city.resolveCircleCollisions(v, v.spec.width * 0.54, v.spec.aircraft); }
      }
      if (v.drifting && !v.spec.aircraft && rand.chance(0.42)) world.spawnSmoke(v.x - Math.cos(v.angle) * v.spec.length * 0.36, v.y - Math.sin(v.angle) * v.spec.length * 0.36, '#8894a6', 7.5);
      if (v.punctureTimer > 0 && v.speed > 90 && rand.chance(0.35)) world.spawnSparks(v.x - Math.cos(v.angle) * v.spec.length * 0.3, v.y - Math.sin(v.angle) * v.spec.length * 0.3, 2);
      if (v.hp < v.maxHp * 0.48 && (v.smokeTimer -= dt) <= 0) {
        const crit = v.hp < v.maxHp * 0.24; v.smokeTimer = crit ? 0.05 : 0.12;
        const nx = v.x + Math.cos(v.angle) * v.spec.length * 0.34, ny = v.y + Math.sin(v.angle) * v.spec.length * 0.34;
        world.spawnSmoke(nx, ny, crit ? '#3a404a' : '#636d7d', crit ? 11 : 8.5); if (crit) world.spawnFire(nx, ny, 8);
      }
    }
    resolveCollisions(world);
  }

  function findNearestEnterable(x, y, maxD = 78) {
    let best = null, bd = maxD;
    for (const v of vehicles) { if (!v.exploded && v.driver !== 'player') { const d = Math.hypot(v.x - x, v.y - y); if (d < bd) { bd = d; best = v; } } }
    return best;
  }
  function repairAndRespray(v, col = null) { v.hp = v.maxHp; v.exploded = false; v.punctureTimer = 0; if (col) v.color = col; else if (!v.spec.siren) v.color = rand.pick(v.spec.colors); }

  return { vehicles, skidmarks, spawnVehicle, seedParkedVehicles, applyGarageTuning, applyVehiclePhysics, update, findNearestEnterable, repairAndRespray, addSkid, clear: () => { vehicles.length = skidmarks.length = 0; nextId = 1; } };
}
