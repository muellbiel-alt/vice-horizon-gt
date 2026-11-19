// Dual-mode player combat (on-foot & drive-by), 4 weapons, syndicate AI,
// bullet tracers, metallic sparks, fire/smoke plumes, explosions, scorches, and pickups.

import { PLAYER_SPEC, WEAPONS } from '../core/config.js';

export function createCombatSystem(city, vehicleMgr, traffic, police, rand) {
  const projectiles = [], particles = [], casings = [], scorches = [], pickups = [], enemies = [], popups = [];
  const spawnPopup = (x, y, text, color = '#ffd166') => { popups.push({ x, y, text, color, ttl: 1.4, maxTtl: 1.4 }); if (popups.length > 24) popups.shift(); };
  const spawnPickup = (kind, x, y, value) => { pickups.push({ kind, x, y, value, bob: rand.range(0, 6.28), ttl: 45 }); if (pickups.length > 48) pickups.shift(); };

  function burst(x, y, count, minS, maxS, minR, maxR, minT, maxT, colFn, glow) {
    for (let i = 0; i < count; i += 1) {
      const a = rand.range(0, Math.PI * 2), s = rand.range(minS, maxS);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: rand.range(minR, maxR), color: colFn(i), ttl: rand.range(minT, maxT), maxTtl: maxT, glow: typeof glow === 'function' ? glow(i) : glow });
    }
  }
  const spawnHitEffect = (x, y, color, count = 8) => burst(x, y, count, 60, 220, 2.2, 4.8, 0.18, 0.42, () => color, false);
  const spawnSparks = (x, y, count = 8) => burst(x, y, count, 130, 340, 2.2, 4.2, 0.14, 0.3, () => rand.pick(['#ffd166', '#ff9f43', '#ffffff']), true);
  const spawnSmoke = (x, y, color = '#4c5563', size = 10) => particles.push({ x: x + rand.range(-4, 4), y: y + rand.range(-4, 4), vx: rand.range(-20, 20), vy: rand.range(-30, -8), size, color, ttl: 0.68, maxTtl: 0.68, glow: false });
  const spawnFire = (x, y, size = 8) => particles.push({ x: x + rand.range(-5, 5), y: y + rand.range(-5, 5), vx: rand.range(-24, 24), vy: rand.range(-38, -12), size, color: rand.pick(['#ff5938', '#ff9f43', '#ffd166']), ttl: rand.range(0.22, 0.42), maxTtl: 0.42, glow: true });

  function damagePlayer(world, amount) {
    const p = world.player; if (p.invulnTimer > 0 || p.hp <= 0) return;
    let rem = amount;
    if (p.armor > 0) { const abs = Math.min(p.armor, rem * 0.75); p.armor = Math.max(0, p.armor - abs); rem -= abs; }
    p.hp = Math.max(0, p.hp - rem); p.hitFlash = 0.22; world.cameraShake = Math.max(world.cameraShake, 6);
  }

  function triggerExplosion(world, x, y, radius = 145, maxDmg = 78) {
    scorches.push({ x, y, r: radius * 0.46 }); if (scorches.length > 26) scorches.shift();
    world.cameraShake = Math.max(world.cameraShake, 16);
    traffic.triggerPanic(x, y, 480, 5.5); police.reportCrime(75, x, y); world.audio?.playExplosion();
    burst(x, y, 32, 60, 350, 6, 19, 0.32, 0.74, () => rand.pick(['#ff5938', '#ff9f43', '#ffd166', '#2a303c']), (i) => i % 2 === 0);
    const pd = Math.hypot(world.player.x - x, world.player.y - y);
    if (pd < radius) damagePlayer(world, maxDmg * (1 - pd / radius));
    for (const u of police.units) { const d = Math.hypot(u.x - x, u.y - y); if (d < radius) u.hp -= maxDmg * (1 - d / radius) * 1.4; }
    for (const e of enemies) { const d = Math.hypot(e.x - x, e.y - y); if (d < radius) e.hp -= maxDmg * (1 - d / radius) * 1.4; }
    for (const v of vehicleMgr.vehicles) { const d = Math.hypot(v.x - x, v.y - y); if (!v.exploded && d > 4 && d < radius) v.hp -= maxDmg * (1 - d / radius) * 1.1; }
  }

  function spawnEnemy(x, y, role = 'enforcer', missionTag = null) {
    const boss = role === 'boss', hp = boss ? 220 : role === 'heavy' ? 110 : 65;
    const e = { x, y, angle: rand.range(-Math.PI, Math.PI), role, missionTag, hp, maxHp: hp, speed: boss ? 142 : 128, fireCooldown: rand.range(0.35, 0.9), walkPhase: 0, alive: true, shirt: boss ? '#e63946' : role === 'heavy' ? '#495867' : '#d67836' };
    enemies.push(e); return e;
  }

  const fireEnemyBullet = (x, y, a, damage, color = '#ff6b4a') => projectiles.push({ x: x + Math.cos(a) * 16, y: y + Math.sin(a) * 16, prevX: x, prevY: y, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, damage, rangeLeft: 560, fromPlayer: false, color });

  function startReload(world) {
    const p = world.player, w = WEAPONS[p.weaponIndex], s = p.arsenal[w.id];
    if (s.owned && p.reloadTimer <= 0 && s.mag < w.magSize && s.reserve > 0) p.reloadTimer = w.reloadTime;
  }
  function finishReload(world) {
    const p = world.player, w = WEAPONS[p.weaponIndex], s = p.arsenal[w.id], take = Math.min(w.magSize - s.mag, s.reserve);
    s.mag += take; s.reserve -= take;
  }
  function switchWeapon(world, i) {
    if (i >= 0 && i < WEAPONS.length && world.player.arsenal[WEAPONS[i].id].owned) { world.player.weaponIndex = i; world.player.reloadTimer = 0; }
  }

  function firePlayerWeapon(world, aim) {
    const p = world.player, w = WEAPONS[p.weaponIndex], s = p.arsenal[w.id];
    if (!s.owned || p.reloadTimer > 0 || p.fireTimer > 0) return false;
    if (s.mag <= 0) { if (s.reserve > 0) startReload(world); return false; }
    s.mag -= 1; p.fireTimer = w.fireRate; p.muzzleFlash = 0.08; p.muzzleAngle = aim;
    world.cameraShake = Math.max(world.cameraShake, w.id === 'shotgun' ? 5.5 : 2.2);
    world.audio?.playShot(w.id);

    const dmg = w.damage * (p.upgrades.damage ? 1.2 : 1), ox = p.x + Math.cos(aim) * 18, oy = p.y + Math.sin(aim) * 18;
    for (let i = 0; i < w.pellets; i += 1) {
      const a = aim + rand.range(-w.spread, w.spread);
      projectiles.push({ x: ox, y: oy, prevX: ox, prevY: oy, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, damage: dmg, rangeLeft: w.range, fromPlayer: true, color: w.color });
    }
    const ej = aim + 1.57 + rand.range(-0.3, 0.3);
    casings.push({ x: p.x + Math.cos(aim) * 10, y: p.y + Math.sin(aim) * 10, vx: Math.cos(ej) * rand.range(50, 105), vy: Math.sin(ej) * rand.range(50, 105), angle: rand.range(0, 6.28), ttl: 3.5 });
    if (casings.length > 60) casings.shift();
    traffic.triggerPanic(p.x, p.y, 350, 4.0);
    if (rand.chance(0.45)) police.reportCrime(12, p.x, p.y);
    world.stats.shotsFired += 1;
    if (s.mag === 0 && s.reserve > 0) startReload(world);
    return true;
  }

  function updateProjectiles(world, dt) {
    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      const b = projectiles[i]; b.prevX = b.x; b.prevY = b.y;
      const sx = b.vx * dt, sy = b.vy * dt; b.x += sx; b.y += sy; b.rangeLeft -= Math.hypot(sx, sy);
      if (b.rangeLeft <= 0 || city.isPointBlocked(b.x, b.y, 2)) { spawnSparks(b.x, b.y, 5); projectiles.splice(i, 1); continue; }

      let hit = false;
      if (b.fromPlayer) {
        for (const e of enemies) {
          if (!e.alive || Math.hypot(e.x - b.x, e.y - b.y) >= 15) continue;
          e.hp -= b.damage; spawnHitEffect(b.x, b.y, '#e63946', 7); world.stats.shotsHit += 1;
          if (e.hp <= 0) { e.alive = false; world.stats.takedowns += 1; spawnPickup('cash', e.x, e.y, e.role === 'boss' ? 350 : 85); spawnPopup(e.x, e.y - 14, e.role === 'boss' ? 'TARGET DOWN' : '+TAKEDOWN', '#ff7b54'); }
          hit = true; break;
        }
        if (!hit) for (const u of police.units) { if (u.alive && Math.hypot(u.x - b.x, u.y - b.y) < 15) { u.hp -= b.damage; spawnHitEffect(b.x, b.y, '#e63946', 7); police.reportCrime(28, world.player.x, world.player.y); world.stats.shotsHit += 1; hit = true; break; } }
        if (!hit) for (const ped of traffic.pedestrians) { if (ped.alive && Math.hypot(ped.x - b.x, ped.y - b.y) < 13) { ped.hp -= b.damage; spawnHitEffect(b.x, b.y, '#e63946', 6); if (ped.hp <= 0) { ped.alive = false; spawnPickup('cash', ped.x, ped.y, ped.cash); } police.reportCrime(25, world.player.x, world.player.y); hit = true; break; } }
        if (!hit) for (const v of vehicleMgr.vehicles) { if (!v.exploded && v !== world.player.vehicle && Math.hypot(v.x - b.x, v.y - b.y) < v.spec.width * 0.62) { v.hp -= b.damage * 0.72; spawnSparks(b.x, b.y, 6); if (v.driver === 'police' || v.driver === 'swat') police.reportCrime(22, world.player.x, world.player.y); hit = true; break; } }
      } else {
        const p = world.player;
        if (Math.hypot(p.x - b.x, p.y - b.y) < (p.inVehicle ? p.vehicle.spec.width * 0.6 : 14)) {
          if (p.inVehicle) { p.vehicle.hp -= b.damage * 0.6; damagePlayer(world, b.damage * 0.35); spawnSparks(b.x, b.y, 5); }
          else { damagePlayer(world, b.damage); spawnHitEffect(b.x, b.y, '#e63946', 5); }
          hit = true;
        }
      }
      if (hit) projectiles.splice(i, 1);
    }
  }

  function updateEnemies(world, dt) {
    const { x: px, y: py } = world.player;
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      const e = enemies[i]; if (!e.alive) { enemies.splice(i, 1); continue; }
      const d = Math.hypot(px - e.x, py - e.y); if (d > 780) continue;
      const see = d < 520 && city.hasLineOfSight(e.x, e.y, px, py);
      e.angle = Math.atan2(py - e.y, px - e.x);
      if (d > 190 && (see || d < 440)) { e.x += Math.cos(e.angle) * e.speed * dt; e.y += Math.sin(e.angle) * e.speed * dt; e.walkPhase += dt * 10; city.resolveCircleCollisions(e, 12); }
      e.fireCooldown -= dt;
      if (see && e.fireCooldown <= 0) { e.fireCooldown = e.role === 'boss' ? 0.36 : 0.78; fireEnemyBullet(e.x, e.y, e.angle + rand.range(-0.1, 0.1), e.role === 'boss' ? 14 : 9, '#ff9f43'); }
    }
  }

  function updatePickups(world, dt) {
    const p = world.player;
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const pk = pickups[i]; pk.bob += dt * 4.5; pk.ttl -= dt;
      if (pk.ttl <= 0) { pickups.splice(i, 1); continue; }
      if (Math.hypot(p.x - pk.x, p.y - pk.y) >= (p.inVehicle ? 44 : 28)) continue;
      if (pk.kind === 'cash') { p.cash += pk.value; world.stats.cashEarned += pk.value; spawnPopup(pk.x, pk.y - 12, `+$${pk.value}`, '#37c978'); }
      else if (pk.kind === 'armor') { p.armor = Math.min(PLAYER_SPEC.maxArmor, p.armor + pk.value); spawnPopup(pk.x, pk.y - 12, `+${pk.value} ARMOR`, '#3fa9f5'); }
      else if (pk.kind === 'health') { p.hp = Math.min(PLAYER_SPEC.maxHp, p.hp + pk.value); spawnPopup(pk.x, pk.y - 12, `+${pk.value} HP`, '#37c978'); }
      else if (pk.kind === 'ammo') { p.arsenal[WEAPONS[p.weaponIndex].id].reserve += pk.value; spawnPopup(pk.x, pk.y - 12, `+${pk.value} AMMO`, '#ffd166'); }
      world.audio?.playCash(); pickups.splice(i, 1);
    }
  }

  function updateParticlesAndEffects(dt) {
    const decay = (arr, drag) => {
      for (let i = arr.length - 1; i >= 0; i -= 1) {
        const o = arr[i]; o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= Math.exp(-drag * dt); o.vy *= Math.exp(-drag * dt); o.ttl -= dt;
        if (o.ttl <= 0) arr.splice(i, 1);
      }
    };
    decay(particles, 3.5); decay(casings, 6);
    for (let i = popups.length - 1; i >= 0; i -= 1) { popups[i].y -= 28 * dt; popups[i].ttl -= dt; if (popups[i].ttl <= 0) popups.splice(i, 1); }
  }

  return {
    projectiles, particles, casings, scorches, pickups, enemies, popups,
    spawnPopup, spawnPickup, spawnHitEffect, spawnSparks, spawnSmoke, spawnFire, spawnEnemy,
    fireEnemyBullet, firePlayerWeapon, startReload, finishReload, switchWeapon, triggerExplosion,
    damagePlayer, updateProjectiles, updateEnemies, updatePickups, updateParticlesAndEffects,
    clear: () => { projectiles.length = particles.length = casings.length = scorches.length = pickups.length = enemies.length = popups.length = 0; },
  };
}
