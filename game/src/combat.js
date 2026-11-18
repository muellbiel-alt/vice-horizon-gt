// Dual-mode player combat & movement (on-foot WASD + mouse aim + dodge roll + drive-by fire),
// 4 switchable weapons, hostile syndicate AI, projectiles, explosions, particles, and pickups.

import { PLAYER_SPEC, WEAPONS } from './config.js';
import { clamp } from './random.js';

export function createCombatSystem(city, vehicleMgr, traffic, police, rand) {
  const projectiles = [];
  const particles = [];
  const casings = [];
  const scorches = [];
  const pickups = [];
  const enemies = [];
  const popups = [];

  function spawnPopup(x, y, text, color = '#ffd166') {
    popups.push({ x, y, text, color, ttl: 1.35, maxTtl: 1.35 });
    if (popups.length > 24) popups.shift();
  }

  function spawnPickup(kind, x, y, value) {
    pickups.push({ kind, x, y, value, bob: rand.range(0, 6.28), ttl: 45 });
    if (pickups.length > 48) pickups.shift();
  }

  function spawnHitEffect(x, y, color, count = 8) {
    for (let i = 0; i < count; i += 1) {
      const a = rand.range(0, Math.PI * 2);
      const spd = rand.range(60, 220);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: rand.range(2.2, 4.8),
        color,
        ttl: rand.range(0.18, 0.42),
        maxTtl: 0.42,
        glow: false,
      });
    }
  }

  function spawnSparks(x, y, count = 7) {
    for (let i = 0; i < count; i += 1) {
      const a = rand.range(0, Math.PI * 2);
      const spd = rand.range(120, 310);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: rand.range(2, 3.6),
        color: rand.pick(['#ffd166', '#ff9f43', '#ffffff']),
        ttl: rand.range(0.12, 0.28),
        maxTtl: 0.28,
        glow: true,
      });
    }
  }

  function spawnSmoke(x, y, color = '#4c5563', size = 10) {
    particles.push({
      x: x + rand.range(-4, 4),
      y: y + rand.range(-4, 4),
      vx: rand.range(-18, 18),
      vy: rand.range(-28, -8),
      size,
      color,
      ttl: 0.65,
      maxTtl: 0.65,
      glow: false,
    });
  }

  function triggerExplosion(world, x, y, radius = 140, maxDmg = 75) {
    scorches.push({ x, y, r: radius * 0.45 });
    if (scorches.length > 26) scorches.shift();

    world.cameraShake = Math.max(world.cameraShake, 16);
    traffic.triggerPanic(x, y, 480, 5.5);
    police.reportCrime(75, x, y);
    world.audio?.playExplosion();

    for (let i = 0; i < 28; i += 1) {
      const a = rand.range(0, Math.PI * 2);
      const spd = rand.range(60, 340);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: rand.range(6, 18),
        color: rand.pick(['#ff5938', '#ff9f43', '#ffd166', '#333b48']),
        ttl: rand.range(0.3, 0.72),
        maxTtl: 0.72,
        glow: i % 2 === 0,
      });
    }

    // Damage nearby entities
    const pd = Math.hypot(world.player.x - x, world.player.y - y);
    if (pd < radius) {
      const falloff = 1 - pd / radius;
      damagePlayer(world, maxDmg * falloff);
    }

    for (let i = 0; i < police.units.length; i += 1) {
      const u = police.units[i];
      const d = Math.hypot(u.x - x, u.y - y);
      if (d < radius) u.hp -= maxDmg * (1 - d / radius) * 1.4;
    }
    for (let i = 0; i < enemies.length; i += 1) {
      const e = enemies[i];
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius) e.hp -= maxDmg * (1 - d / radius) * 1.4;
    }
    for (let i = 0; i < vehicleMgr.vehicles.length; i += 1) {
      const v = vehicleMgr.vehicles[i];
      if (v.exploded) continue;
      const d = Math.hypot(v.x - x, v.y - y);
      if (d > 4 && d < radius) v.hp -= maxDmg * (1 - d / radius) * 1.1;
    }
  }

  function damagePlayer(world, amount) {
    const p = world.player;
    if (p.invulnTimer > 0 || p.hp <= 0) return;
    let remaining = amount;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, remaining * 0.75);
      p.armor = Math.max(0, p.armor - absorbed);
      remaining -= absorbed;
    }
    p.hp = Math.max(0, p.hp - remaining);
    p.hitFlash = 0.22;
    world.cameraShake = Math.max(world.cameraShake, 6);
  }

  function spawnEnemy(x, y, role = 'enforcer', missionTag = null) {
    const isBoss = role === 'boss';
    const enemy = {
      x,
      y,
      angle: rand.range(-Math.PI, Math.PI),
      role,
      missionTag,
      hp: isBoss ? 220 : role === 'heavy' ? 110 : 65,
      maxHp: isBoss ? 220 : role === 'heavy' ? 110 : 65,
      speed: isBoss ? 142 : 128,
      fireCooldown: rand.range(0.35, 0.9),
      walkPhase: 0,
      alive: true,
      shirt: isBoss ? '#e63946' : role === 'heavy' ? '#495867' : '#d67836',
    };
    enemies.push(enemy);
    return enemy;
  }

  function fireEnemyBullet(x, y, angle, damage, color = '#ff6b4a') {
    const speed = 780;
    projectiles.push({
      x: x + Math.cos(angle) * 16,
      y: y + Math.sin(angle) * 16,
      prevX: x,
      prevY: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      rangeLeft: 560,
      fromPlayer: false,
      color,
    });
  }

  function firePlayerWeapon(world, aimAngle) {
    const p = world.player;
    const w = WEAPONS[p.weaponIndex];
    const slotState = p.arsenal[w.id];
    if (!slotState.owned) return false;
    if (p.reloadTimer > 0 || p.fireTimer > 0) return false;

    if (slotState.mag <= 0) {
      if (slotState.reserve > 0) startReload(world);
      return false;
    }

    slotState.mag -= 1;
    p.fireTimer = w.fireRate;
    p.muzzleFlash = 0.08;
    p.muzzleAngle = aimAngle;
    world.cameraShake = Math.max(world.cameraShake, w.id === 'shotgun' ? 5.5 : 2.2);
    world.audio?.playShot(w.id);

    const dmgMul = p.upgrades.damage ? 1.2 : 1.0;
    const originX = p.x + Math.cos(aimAngle) * 18;
    const originY = p.y + Math.sin(aimAngle) * 18;

    for (let i = 0; i < w.pellets; i += 1) {
      const a = aimAngle + rand.range(-w.spread, w.spread);
      projectiles.push({
        x: originX,
        y: originY,
        prevX: originX,
        prevY: originY,
        vx: Math.cos(a) * w.speed,
        vy: Math.sin(a) * w.speed,
        damage: w.damage * dmgMul,
        rangeLeft: w.range,
        fromPlayer: true,
        color: w.color,
      });
    }

    // Eject brass shell casing
    const ejectAngle = aimAngle + Math.PI * 0.5 + rand.range(-0.3, 0.3);
    casings.push({
      x: p.x + Math.cos(aimAngle) * 10,
      y: p.y + Math.sin(aimAngle) * 10,
      vx: Math.cos(ejectAngle) * rand.range(50, 105),
      vy: Math.sin(ejectAngle) * rand.range(50, 105),
      angle: rand.range(0, 6.28),
      ttl: 3.5,
    });
    if (casings.length > 60) casings.shift();

    traffic.triggerPanic(p.x, p.y, 350, 4.0);
    if (rand.chance(0.45)) police.reportCrime(12, p.x, p.y);
    world.stats.shotsFired += 1;

    if (slotState.mag === 0 && slotState.reserve > 0) startReload(world);
    return true;
  }

  function startReload(world) {
    const p = world.player;
    const w = WEAPONS[p.weaponIndex];
    const slotState = p.arsenal[w.id];
    if (!slotState.owned || p.reloadTimer > 0) return;
    if (slotState.mag >= w.magSize || slotState.reserve <= 0) return;
    p.reloadTimer = w.reloadTime;
  }

  function finishReload(world) {
    const p = world.player;
    const w = WEAPONS[p.weaponIndex];
    const slotState = p.arsenal[w.id];
    const need = w.magSize - slotState.mag;
    const take = Math.min(need, slotState.reserve);
    slotState.mag += take;
    slotState.reserve -= take;
  }

  function switchWeapon(world, index) {
    const p = world.player;
    if (index < 0 || index >= WEAPONS.length) return;
    const w = WEAPONS[index];
    if (!p.arsenal[w.id].owned) return;
    p.weaponIndex = index;
    p.reloadTimer = 0;
  }

  function updateProjectiles(world, dt) {
    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      const b = projectiles[i];
      b.prevX = b.x;
      b.prevY = b.y;
      const stepX = b.vx * dt;
      const stepY = b.vy * dt;
      b.x += stepX;
      b.y += stepY;
      b.rangeLeft -= Math.hypot(stepX, stepY);

      if (b.rangeLeft <= 0 || city.isPointBlocked(b.x, b.y, 2)) {
        spawnSparks(b.x, b.y, 4);
        projectiles.splice(i, 1);
        continue;
      }

      let hit = false;
      if (b.fromPlayer) {
        // Check syndicate enemies
        for (let eIdx = 0; eIdx < enemies.length; eIdx += 1) {
          const e = enemies[eIdx];
          if (!e.alive) continue;
          if (Math.hypot(e.x - b.x, e.y - b.y) < 15) {
            e.hp -= b.damage;
            spawnHitEffect(b.x, b.y, '#e63946', 7);
            world.stats.shotsHit += 1;
            if (e.hp <= 0) {
              e.alive = false;
              world.stats.takedowns += 1;
              spawnPickup('cash', e.x, e.y, e.role === 'boss' ? 350 : 85);
              spawnPopup(e.x, e.y - 14, e.role === 'boss' ? 'TARGET DOWN' : '+TAKEDOWN', '#ff7b54');
            }
            hit = true;
            break;
          }
        }

        // Check police officers
        if (!hit) {
          for (let pIdx = 0; pIdx < police.units.length; pIdx += 1) {
            const u = police.units[pIdx];
            if (!u.alive) continue;
            if (Math.hypot(u.x - b.x, u.y - b.y) < 15) {
              u.hp -= b.damage;
              spawnHitEffect(b.x, b.y, '#e63946', 7);
              police.reportCrime(28, world.player.x, world.player.y);
              world.stats.shotsHit += 1;
              hit = true;
              break;
            }
          }
        }

        // Check pedestrians
        if (!hit) {
          for (let pedIdx = 0; pedIdx < traffic.pedestrians.length; pedIdx += 1) {
            const ped = traffic.pedestrians[pedIdx];
            if (!ped.alive) continue;
            if (Math.hypot(ped.x - b.x, ped.y - b.y) < 13) {
              ped.hp -= b.damage;
              spawnHitEffect(b.x, b.y, '#e63946', 6);
              if (ped.hp <= 0) {
                ped.alive = false;
                spawnPickup('cash', ped.x, ped.y, ped.cash);
              }
              police.reportCrime(25, world.player.x, world.player.y);
              hit = true;
              break;
            }
          }
        }

        // Check vehicles
        if (!hit) {
          for (let vIdx = 0; vIdx < vehicleMgr.vehicles.length; vIdx += 1) {
            const v = vehicleMgr.vehicles[vIdx];
            if (v.exploded || v === world.player.vehicle) continue;
            if (Math.hypot(v.x - b.x, v.y - b.y) < v.spec.width * 0.62) {
              v.hp -= b.damage * 0.72;
              spawnSparks(b.x, b.y, 4);
              if (v.driver === 'police' || v.driver === 'swat') {
                police.reportCrime(22, world.player.x, world.player.y);
              }
              hit = true;
              break;
            }
          }
        }
      } else {
        // Enemy bullet hitting player or player's vehicle
        const p = world.player;
        const targetRadius = p.inVehicle ? p.vehicle.spec.width * 0.6 : 14;
        if (Math.hypot(p.x - b.x, p.y - b.y) < targetRadius) {
          if (p.inVehicle) {
            p.vehicle.hp -= b.damage * 0.6;
            damagePlayer(world, b.damage * 0.35);
            spawnSparks(b.x, b.y, 4);
          } else {
            damagePlayer(world, b.damage);
            spawnHitEffect(b.x, b.y, '#e63946', 5);
          }
          hit = true;
        }
      }

      if (hit) projectiles.splice(i, 1);
    }
  }

  function updateEnemies(world, dt) {
    const px = world.player.x;
    const py = world.player.y;
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      const e = enemies[i];
      if (!e.alive) {
        enemies.splice(i, 1);
        continue;
      }
      const dx = px - e.x;
      const dy = py - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 780) continue;

      const canSee = dist < 520 && city.hasLineOfSight(e.x, e.y, px, py);
      e.angle = Math.atan2(dy, dx);
      if (dist > 190 && (canSee || dist < 440)) {
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
        e.walkPhase += dt * 10;
        city.resolveCircleCollisions(e, 12);
      }

      e.fireCooldown -= dt;
      if (canSee && e.fireCooldown <= 0) {
        e.fireCooldown = e.role === 'boss' ? 0.36 : 0.78;
        fireEnemyBullet(e.x, e.y, e.angle + rand.range(-0.1, 0.1), e.role === 'boss' ? 14 : 9, '#ff9f43');
      }
    }
  }

  function updatePickups(world, dt) {
    const p = world.player;
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const pk = pickups[i];
      pk.bob += dt * 4.5;
      pk.ttl -= dt;
      if (pk.ttl <= 0) {
        pickups.splice(i, 1);
        continue;
      }
      const grabDist = p.inVehicle ? 44 : 28;
      if (Math.hypot(p.x - pk.x, p.y - pk.y) < grabDist) {
        if (pk.kind === 'cash') {
          p.cash += pk.value;
          world.stats.cashEarned += pk.value;
          spawnPopup(pk.x, pk.y - 12, `+$${pk.value}`, '#37c978');
        } else if (pk.kind === 'armor') {
          p.armor = Math.min(PLAYER_SPEC.maxArmor, p.armor + pk.value);
          spawnPopup(pk.x, pk.y - 12, `+${pk.value} ARMOR`, '#3fa9f5');
        } else if (pk.kind === 'health') {
          p.hp = Math.min(PLAYER_SPEC.maxHp, p.hp + pk.value);
          spawnPopup(pk.x, pk.y - 12, `+${pk.value} HP`, '#37c978');
        } else if (pk.kind === 'ammo') {
          const active = WEAPONS[p.weaponIndex];
          p.arsenal[active.id].reserve += pk.value;
          spawnPopup(pk.x, pk.y - 12, `+${pk.value} AMMO`, '#ffd166');
        }
        world.audio?.playCash();
        pickups.splice(i, 1);
      }
    }
  }

  function updateParticlesAndEffects(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const pt = particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.exp(-3.5 * dt);
      pt.vy *= Math.exp(-3.5 * dt);
      pt.ttl -= dt;
      if (pt.ttl <= 0) particles.splice(i, 1);
    }
    for (let i = casings.length - 1; i >= 0; i -= 1) {
      const c = casings[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= Math.exp(-6 * dt);
      c.vy *= Math.exp(-6 * dt);
      c.ttl -= dt;
      if (c.ttl <= 0) casings.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      const pop = popups[i];
      pop.y -= 28 * dt;
      pop.ttl -= dt;
      if (pop.ttl <= 0) popups.splice(i, 1);
    }
  }

  function clear() {
    projectiles.length = 0;
    particles.length = 0;
    casings.length = 0;
    scorches.length = 0;
    pickups.length = 0;
    enemies.length = 0;
    popups.length = 0;
  }

  return {
    projectiles,
    particles,
    casings,
    scorches,
    pickups,
    enemies,
    popups,
    spawnPopup,
    spawnPickup,
    spawnHitEffect,
    spawnSparks,
    spawnSmoke,
    spawnEnemy,
    fireEnemyBullet,
    firePlayerWeapon,
    startReload,
    finishReload,
    switchWeapon,
    triggerExplosion,
    damagePlayer,
    updateProjectiles,
    updateEnemies,
    updatePickups,
    updateParticlesAndEffects,
    clear,
  };
}
