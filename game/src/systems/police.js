// Escalating 1-5 Star Police Pursuit System:
// 1★ patrol, 2★ interceptors, 3★ spiked roadblocks with flares, 4★ SWAT & chopper searchlight, 5★ lockdown.

import { H_ROADS, V_ROADS } from '../world/city.js';
import { clamp, normalizeAngle } from '../core/random.js';

export function createPoliceSystem(city, vehicleMgr, rand) {
  const units = [], roadblocks = [];
  const spotlight = { active: false, x: 0, y: 0, heliX: 0, heliY: 0, heliAngle: 0, rotorAngle: 0, angle: 0 };
  const state = { wantedLevel: 0, heat: 0, evadeTimer: 0, evadeDuration: 12, lastSeenX: 1600, lastSeenY: 1100, searchRadius: 420, spawnCooldown: 0, roadblockCooldown: 0, spotted: false };

  const levelFromHeat = (h) => (h >= 420 ? 5 : h >= 275 ? 4 : h >= 160 ? 3 : h >= 75 ? 2 : h >= 15 ? 1 : 0);
  function syncHeat(x, y) { state.lastSeenX = x; state.lastSeenY = y; state.evadeTimer = 0; state.spotted = true; state.searchRadius = 380 + state.wantedLevel * 95; state.evadeDuration = 8 + state.wantedLevel * 3.5; }

  function reportCrime(amount, x, y) {
    const prev = state.wantedLevel; state.heat = Math.min(540, state.heat + amount);
    state.wantedLevel = levelFromHeat(state.heat); syncHeat(x, y); return state.wantedLevel > prev;
  }
  function setMinimumWanted(stars, x, y) {
    const th = [0, 22, 85, 175, 290, 440][clamp(stars, 0, 5)];
    if (state.heat < th) state.heat = th;
    state.wantedLevel = Math.max(state.wantedLevel, stars); syncHeat(x, y);
  }
  function clearWanted() {
    state.wantedLevel = state.heat = state.evadeTimer = 0; state.spotted = spotlight.active = false;
    for (const v of vehicleMgr.vehicles) if (v.driver === 'police' || v.driver === 'swat') { v.sirenOn = false; v.driver = 'none'; }
    units.length = roadblocks.length = 0;
  }

  function spawnOfficer(x, y, isSwat = false) {
    if (units.length >= 16 || city.isPointBlocked(x, y, 13)) return null;
    const hp = isSwat ? 120 : 65;
    const u = { x, y, angle: rand.range(-Math.PI, Math.PI), isSwat, hp, maxHp: hp, fireCooldown: rand.range(0.4, 1), speed: isSwat ? 148 : 138, walkPhase: 0, alive: true };
    units.push(u); return u;
  }

  function spawnPursuitVehicle(world) {
    let n = 0; for (const v of vehicleMgr.vehicles) if (!v.exploded && (v.driver === 'police' || v.driver === 'swat')) n += 1;
    if (n >= Math.min(8, 1 + state.wantedLevel * 1.4)) return null;
    const { x: px, y: py } = world.player;
    const pt = city.findNearestRoadPoint(clamp(px + rand.pick([-1, 1]) * rand.range(460, 740), 460, 3200), clamp(py + rand.pick([-1, 1]) * rand.range(360, 580), 320, 2360));
    if (city.isPointBlocked(pt.x, pt.y, 28) || Math.hypot(pt.x - px, pt.y - py) < 340) return null;
    const swat = state.wantedLevel >= 4 && rand.chance(state.wantedLevel === 5 ? 0.55 : 0.42);
    return vehicleMgr.spawnVehicle(swat ? 'armored' : 'police', pt.x, pt.y, Math.atan2(py - pt.y, px - pt.x), { driver: swat ? 'swat' : 'police', sirenOn: true, aiState: { stuckTimer: 0, deployCount: swat ? 2 : 1 } });
  }

  function placeRoadblockAt(rx, ry, vertical, heavy = false) {
    const ang = vertical ? 0 : Math.PI * 0.5, ox = vertical ? 40 : 0, oy = vertical ? 0 : 40;
    const c1 = vehicleMgr.spawnVehicle(heavy ? 'armored' : 'police', rx - ox, ry - oy, ang, { driver: heavy ? 'swat' : 'police', sirenOn: true });
    const c2 = vehicleMgr.spawnVehicle('police', rx + ox, ry + oy, ang, { driver: 'police', sirenOn: true });
    if (c1) c1.aiState = { roadblock: true, stuckTimer: 0, deployCount: 1 };
    if (c2) c2.aiState = { roadblock: true, stuckTimer: 0, deployCount: 1 };
    spawnOfficer(rx - ox * 0.7, ry - oy * 0.7 + 34, heavy); spawnOfficer(rx + ox * 0.7, ry + oy * 0.7 - 34, heavy);
    const so = 46;
    const rb = {
      x: rx, y: ry, vertical, ttl: 26,
      spikeX1: vertical ? rx - 52 : rx + so, spikeY1: vertical ? ry + so : ry - 52,
      spikeX2: vertical ? rx + 52 : rx + so, spikeY2: vertical ? ry + so : ry + 52,
      flares: vertical ? [{ x: rx - 54, y: ry + so + 12 }, { x: rx + 54, y: ry + so + 12 }] : [{ x: rx + so + 12, y: ry - 54 }, { x: rx + so + 12, y: ry + 54 }],
    };
    roadblocks.push(rb); return rb;
  }

  function spawnRoadblock(world) {
    if (state.wantedLevel < 3 || roadblocks.length >= 3) return null;
    const { x: px, y: py, inVehicle, vehicle } = world.player, vx = inVehicle ? vehicle.vx : 0, vy = inVehicle ? vehicle.vy : 0;
    const ax = clamp(px + (Math.abs(vx) > 40 ? Math.sign(vx) * 560 : 520), 500, 3150);
    const ay = clamp(py + (Math.abs(vy) > 40 ? Math.sign(vy) * 440 : 420), 360, 2340);
    const vert = Math.abs(vy) >= Math.abs(vx);
    const rx = vert ? V_ROADS.reduce((a, b) => (Math.abs(b - ax) < Math.abs(a - ax) ? b : a)) : ax;
    const ry = vert ? ay : H_ROADS.reduce((a, b) => (Math.abs(b - ay) < Math.abs(a - ay) ? b : a));
    return Math.hypot(rx - px, ry - py) < 360 || city.isPointBlocked(rx, ry, 40) ? null : placeRoadblockAt(rx, ry, vert, state.wantedLevel >= 4);
  }

  function checkSpikeStrips(world) {
    const p = world.player; if (!p.inVehicle || !p.vehicle || p.vehicle.spec.aircraft || p.vehicle.punctureTimer > 0) return;
    const v = p.vehicle;
    for (const rb of roadblocks) {
      const dx = Math.abs(v.x - (rb.spikeX1 + rb.spikeX2) * 0.5), dy = Math.abs(v.y - (rb.spikeY1 + rb.spikeY2) * 0.5);
      if (rb.vertical ? dx < 54 && dy < 16 : dx < 16 && dy < 54) {
        v.punctureTimer = 6.5; v.hp = Math.max(12, v.hp - 18); world.cameraShake = Math.max(world.cameraShake, 9);
        world.spawnSparks(v.x, v.y, 12); world.combat.spawnPopup(v.x, v.y - 24, 'SPIKE STRIP HIT · TIRES SHREDDED', '#ff6b4a'); break;
      }
    }
  }

  function updatePoliceVehicles(world, dt) {
    const { x: px, y: py, inVehicle, vehicle } = world.player;
    for (const v of vehicleMgr.vehicles) {
      if (v.exploded || (v.driver !== 'police' && v.driver !== 'swat')) continue;
      if (state.wantedLevel === 0) { v.sirenOn = false; vehicleMgr.applyVehiclePhysics(v, 0.25, 0, false, dt, null); continue; }
      v.sirenOn = true;
      const dist = Math.hypot(px - v.x, py - v.y), ai = v.aiState || (v.aiState = { stuckTimer: 0, deployCount: 1 });
      if (dist < 210 && ai.deployCount > 0 && !inVehicle) { ai.deployCount -= 1; spawnOfficer(v.x + Math.cos(v.angle + 1.57) * 34, v.y + Math.sin(v.angle + 1.57) * 34, v.driver === 'swat'); }
      if (ai.roadblock && dist > 290) { vehicleMgr.applyVehiclePhysics(v, 0, 0, true, dt, null); continue; }
      ai.roadblock = false;
      const lead = clamp(dist / 520, 0.1, 0.7), err = normalizeAngle(Math.atan2(py + (inVehicle ? vehicle.vy : 0) * lead - v.y, px + (inVehicle ? vehicle.vx : 0) * lead - v.x) - v.angle);
      ai.stuckTimer = v.speed < 35 ? ai.stuckTimer + dt : Math.max(0, ai.stuckTimer - dt);
      let thr = ai.stuckTimer > 1.2 ? -0.85 : dist < 95 && !inVehicle ? 0.25 : 0.94;
      if (ai.stuckTimer > 2.0) ai.stuckTimer = 0;
      vehicleMgr.applyVehiclePhysics(v, thr, clamp(err * 2.4, -1, 1), Math.abs(err) > 1.25 && v.speed > 260, dt, null);
    }
  }

  function updateOfficers(world, dt) {
    const { x: px, y: py } = world.player;
    for (let i = units.length - 1; i >= 0; i -= 1) {
      const u = units[i];
      if (!u.alive || u.hp <= 0) {
        world.spawnPickup('cash', u.x, u.y, u.isSwat ? 95 : 45);
        if (u.isSwat && rand.chance(0.45)) world.spawnPickup('armor', u.x + 12, u.y, 35);
        else if (rand.chance(0.35)) world.spawnPickup('ammo', u.x - 10, u.y, 12);
        world.stats.policeDown += 1; units.splice(i, 1); continue;
      }
      const d = Math.hypot(px - u.x, py - u.y); if (d > 1100 || state.wantedLevel === 0) { units.splice(i, 1); continue; }
      u.angle = Math.atan2(py - u.y, px - u.x);
      const see = d < 540 && city.hasLineOfSight(u.x, u.y, px, py); if (see) state.spotted = true;
      if (d > (u.isSwat ? 180 : 155) || !see) { u.x += Math.cos(u.angle) * u.speed * dt; u.y += Math.sin(u.angle) * u.speed * dt; u.walkPhase += dt * 11; city.resolveCircleCollisions(u, 12); }
      u.fireCooldown -= dt;
      if (see && u.fireCooldown <= 0) { u.fireCooldown = u.isSwat ? 0.32 : 0.72; world.fireEnemyBullet(u.x, u.y, u.angle + rand.range(-0.08, 0.08), u.isSwat ? 14 : 9, '#ff6b4a'); }
      for (const v of vehicleMgr.vehicles) {
        if (!v.exploded && !v.spec.aircraft && v.speed >= 110 && v.driver !== 'police' && v.driver !== 'swat' && Math.hypot(v.x - u.x, v.y - u.y) < v.spec.width * 0.62 + 10) {
          u.hp = 0; world.spawnHitEffect(u.x, u.y, '#e63946', 9); if (v.driver === 'player') reportCrime(45, px, py); break;
        }
      }
    }
  }

  function getNearestSirenDoppler(px, py, pvx, pvy) {
    let best = 850, app = 0;
    for (const v of vehicleMgr.vehicles) {
      if (!v.sirenOn || v.exploded || v.driver === 'player') continue;
      const dx = px - v.x, dy = py - v.y, d = Math.hypot(dx, dy);
      if (d < best && d > 1) { best = d; app = ((v.vx - pvx) * (dx / d) + (v.vy - pvy) * (dy / d)) / 500; }
    }
    return { proximity: clamp(1 - best / 850, 0, 1), doppler: clamp(app, -0.35, 0.35) };
  }

  function update(world, dt, time) {
    for (let i = roadblocks.length - 1; i >= 0; i -= 1) if ((roadblocks[i].ttl -= dt) <= 0) roadblocks.splice(i, 1);
    if (state.wantedLevel === 0) { spotlight.active = false; updatePoliceVehicles(world, dt); return; }

    const { x: px, y: py } = world.player;
    let seen = vehicleMgr.vehicles.some((v) => !v.exploded && (v.driver === 'police' || v.driver === 'swat') && Math.hypot(v.x - px, v.y - py) < 460 && city.hasLineOfSight(v.x, v.y, px, py))
      || units.some((u) => Math.hypot(u.x - px, u.y - py) < 440 && city.hasLineOfSight(u.x, u.y, px, py));

    state.spotted = seen;
    if (seen) { state.lastSeenX = px; state.lastSeenY = py; state.evadeTimer = 0; }
    else if ((state.evadeTimer += dt * (Math.hypot(px - state.lastSeenX, py - state.lastSeenY) > state.searchRadius ? 1.55 : 0.75)) >= state.evadeDuration) {
      world.stats.chasesEvaded += 1; clearWanted(); return;
    }

    if ((state.spawnCooldown -= dt) <= 0) { state.spawnCooldown = Math.max(2.1, 6.2 - state.wantedLevel * 0.9); spawnPursuitVehicle(world); }
    if ((state.roadblockCooldown -= dt) <= 0 && state.wantedLevel >= 3) { state.roadblockCooldown = 11.5; spawnRoadblock(world); }

    if (state.wantedLevel >= 4) {
      spotlight.active = true; spotlight.angle = time * 1.15; spotlight.rotorAngle += dt * 26;
      spotlight.x = px + Math.cos(spotlight.angle * 1.3) * 44; spotlight.y = py + Math.sin(spotlight.angle * 0.9) * 34;
      spotlight.heliX = px + Math.cos(spotlight.angle * 0.45 + 0.7) * 210; spotlight.heliY = py + Math.sin(spotlight.angle * 0.45 + 0.7) * 145 - 55;
      spotlight.heliAngle = Math.atan2(spotlight.y - spotlight.heliY, spotlight.x - spotlight.heliX);
    } else spotlight.active = false;

    checkSpikeStrips(world); updatePoliceVehicles(world, dt); updateOfficers(world, dt);
  }

  return { state, units, roadblocks, spotlight, reportCrime, setMinimumWanted, clearWanted, spawnOfficer, spawnPursuitVehicle, spawnRoadblock, placeRoadblockAt, getNearestSirenDoppler, update, clear: clearWanted };
}
