// City pedestrian entity manager: sidewalk spawning, strolling, panic fleeing, and impact drops.

import { H_ROADS, V_ROADS } from '../world/city.js';
import { clamp } from '../core/random.js';

const MAX_PEDS = 36;

export function createPedestrianManager(city, vehicleMgr, rand) {
  const pedestrians = [];
  let spawnTimer = 0;

  function spawnPedestrian(nearX = null, nearY = null) {
    if (pedestrians.length >= MAX_PEDS) return null;
    const vx = rand.pick(V_ROADS); const hy = rand.pick(H_ROADS);
    if (vx >= 2640 && hy >= 2400) return null;
    let x = vx + (rand.chance(0.5) ? -74 : 74) + rand.range(-12, 12);
    let y = hy + (rand.chance(0.5) ? -74 : 74) + rand.range(-12, 12);
    if (nearX !== null && nearY !== null) {
      x = clamp(nearX + rand.range(-520, 520), 280, 3440);
      y = clamp(nearY + rand.range(-360, 360), 220, 2460);
    }
    if (city.isPointBlocked(x, y, 14)) return null;

    const ped = {
      x, y, angle: rand.range(-Math.PI, Math.PI), speed: rand.range(38, 62), hp: 40, alive: true,
      panicTimer: 0, panicDx: 0, panicDy: 0, walkPhase: rand.range(0, 6.28), turnTimer: rand.range(1.5, 4.5),
      shirt: rand.pick(['#f4a261', '#2a9d8f', '#e9c46a', '#e76f51', '#f1faee', '#5aa9e6']),
      hair: rand.pick(['#1d222b', '#4d3524', '#c9934b', '#8c4430']), cash: rand.int(15, 60),
    };
    pedestrians.push(ped);
    return ped;
  }

  function update(world, dt, panicEvents) {
    for (let i = pedestrians.length - 1; i >= 0; i -= 1) {
      const p = pedestrians[i];
      if (!p.alive) { pedestrians.splice(i, 1); continue; }
      for (const ev of panicEvents) {
        const dx = p.x - ev.x; const dy = p.y - ev.y; const d = Math.hypot(dx, dy);
        if (d < ev.radius && d > 1) { p.panicTimer = 4.2; p.panicDx = dx / d; p.panicDy = dy / d; }
      }
      if (p.panicTimer > 0) {
        p.panicTimer -= dt; p.angle = Math.atan2(p.panicDy, p.panicDx);
        p.x += Math.cos(p.angle) * 165 * dt; p.y += Math.sin(p.angle) * 165 * dt; p.walkPhase += dt * 15;
      } else {
        p.turnTimer -= dt;
        if (p.turnTimer <= 0) { p.turnTimer = rand.range(2.0, 5.0); p.angle += rand.range(-1.4, 1.4); }
        p.x += Math.cos(p.angle) * p.speed * dt; p.y += Math.sin(p.angle) * p.speed * dt; p.walkPhase += dt * 7;
      }
      const px = p.x; const py = p.y;
      city.resolveCircleCollisions(p, 11);
      if (Math.hypot(p.x - px, p.y - py) > 0.5) p.angle += Math.PI * 0.75;

      for (const v of vehicleMgr.vehicles) {
        if (v.exploded || v.spec.aircraft || v.speed < 85) continue;
        if (Math.hypot(v.x - p.x, v.y - p.y) < v.spec.width * 0.6 + 9) {
          p.alive = false; world.spawnHitEffect(p.x, p.y, '#e63946', 8); world.spawnPickup('cash', p.x, p.y, p.cash);
          if (v.driver === 'player') { world.stats.pedsHit += 1; world.police.reportCrime(22, p.x, p.y); world.traffic.triggerPanic(p.x, p.y, 260, 3.0); }
          break;
        }
      }
    }
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnTimer = 1.7; spawnPedestrian(world.player.x, world.player.y); }
  }

  return {
    pedestrians, spawnPedestrian,
    seedInitial: (fx, fy) => { for (let i = 0; i < 24; i += 1) spawnPedestrian(i < 10 ? fx : null, i < 10 ? fy : null); },
    update, clear: () => { pedestrians.length = 0; },
  };
}
