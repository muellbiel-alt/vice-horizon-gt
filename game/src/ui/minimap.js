// Tactical real-time Minimap Radar showing districts, roads, piers, police search ring,
// roadblocks, helicopter blip, landmarks, mission waypoint, and player heading.

import { COLORS, MONO_FONT, UI_FONT, WORLD } from '../core/config.js';
import { DISTRICTS } from '../world/districts.js';

export function drawMinimap(ctx, world, time) {
  const size = 192; const mx = 22; const my = 20;
  const sx = size / WORLD.width; const sy = size / WORLD.height;

  ctx.save();
  ctx.fillStyle = COLORS.hudPanel;
  ctx.beginPath(); ctx.roundRect(mx - 5, my - 5, size + 10, size + 38, 10); ctx.fill();
  ctx.strokeStyle = COLORS.hudBorder; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.beginPath(); ctx.roundRect(mx, my, size, size, 6); ctx.clip();
  ctx.fillStyle = '#111a28'; ctx.fillRect(mx, my, size, size);

  const tints = { palm: 'rgba(40,199,183,0.08)', downtown: 'rgba(247,165,49,0.08)', industrial: 'rgba(231,111,81,0.07)', harbor: 'rgba(63,169,245,0.07)' };
  for (const d of DISTRICTS) { ctx.fillStyle = tints[d.id]; ctx.fillRect(mx + d.x * sx, my + d.y * sy, d.w * sx, d.h * sy); }

  ctx.fillStyle = '#0d4760';
  ctx.fillRect(mx, my, WORLD.waterWidth * sx + 6, size);
  ctx.fillRect(mx + 2240 * sx, my + 2010 * sy, (WORLD.width - 2240) * sx, (WORLD.height - 2010) * sy);
  ctx.fillStyle = '#3b4859';
  ctx.fillRect(mx + 2350 * sx, my + 2010 * sy, 300 * sx, 470 * sy);
  ctx.fillRect(mx + 2850 * sx, my + 2010 * sy, 330 * sx, 470 * sy);

  ctx.strokeStyle = '#53657d'; ctx.lineWidth = 2.8; ctx.beginPath();
  for (const s of world.city.segments) { ctx.moveTo(mx + s.x1 * sx, my + s.y1 * sy); ctx.lineTo(mx + s.x2 * sx, my + s.y2 * sy); }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(56, 217, 245, 0.14)'; ctx.lineWidth = 1.2; ctx.beginPath();
  ctx.arc(mx + world.player.x * sx, my + world.player.y * sy, ((time * 42) % 95) + 12, 0, Math.PI * 2); ctx.stroke();

  if (world.police.state.wantedLevel > 0) {
    const fl = Math.sin(time * 9) > 0;
    ctx.fillStyle = fl ? 'rgba(44,140,255,0.14)' : 'rgba(240,75,76,0.14)';
    ctx.strokeStyle = fl ? 'rgba(44,140,255,0.85)' : 'rgba(240,75,76,0.85)';
    ctx.lineWidth = 1.6; ctx.beginPath();
    ctx.arc(mx + world.police.state.lastSeenX * sx, my + world.police.state.lastSeenY * sy, world.police.state.searchRadius * sx, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }

  for (const lm of world.city.landmarks) { ctx.fillStyle = lm.color; ctx.fillRect(mx + lm.x * sx - 3, my + lm.y * sy - 3, 6, 6); }
  ctx.fillStyle = '#ff7b54';
  for (const rb of world.police.roadblocks) ctx.fillRect(mx + rb.x * sx - 4, my + rb.y * sy - 2, 8, 4);

  for (let i = 0; i < world.vehicles.vehicles.length; i += 1) {
    const v = world.vehicles.vehicles[i];
    if (v.exploded || (v.driver !== 'police' && v.driver !== 'swat')) continue;
    ctx.fillStyle = Math.sin(time * 12 + i) > 0 ? COLORS.hudDanger : COLORS.hudPoliceBlue;
    ctx.beginPath(); ctx.arc(mx + v.x * sx, my + v.y * sy, 3.4, 0, Math.PI * 2); ctx.fill();
  }

  if (world.police.spotlight.active) {
    const hx = mx + world.police.spotlight.heliX * sx; const hy = my + world.police.spotlight.heliY * sy;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.beginPath();
    ctx.moveTo(hx - 4.5, hy - 4.5); ctx.lineTo(hx + 4.5, hy + 4.5);
    ctx.moveTo(hx + 4.5, hy - 4.5); ctx.lineTo(hx - 4.5, hy + 4.5); ctx.stroke();
  }

  ctx.fillStyle = '#ff6b4a';
  for (const e of world.combat.enemies) { ctx.beginPath(); ctx.arc(mx + e.x * sx, my + e.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }

  const wp = world.missions.getWaypoint();
  if (wp) {
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(mx + wp.x * sx, my + wp.y * sy, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#070c15'; ctx.lineWidth = 1.3; ctx.stroke();
  }

  ctx.translate(mx + world.player.x * sx, my + world.player.y * sy);
  ctx.rotate(world.player.inVehicle ? world.player.vehicle.angle : world.player.aimAngle);
  ctx.fillStyle = '#ffffff'; ctx.beginPath();
  ctx.moveTo(6.5, 0); ctx.lineTo(-4.8, -4.2); ctx.lineTo(-2.6, 0); ctx.lineTo(-4.8, 4.2); ctx.closePath(); ctx.fill();
  ctx.restore();

  const d = world.city.getDistrictAt(world.player.x, world.player.y);
  ctx.font = `700 12px ${UI_FONT}`; ctx.fillStyle = d.accent; ctx.textAlign = 'left';
  ctx.fillText(d.name.toUpperCase(), mx + 4, my + size + 20);
  ctx.font = `600 10px ${MONO_FONT}`; ctx.fillStyle = COLORS.hudMuted; ctx.textAlign = 'right';
  ctx.fillText(`REP ${world.economy.reputation[d.id] ?? 0}%`, mx + size - 2, my + size + 20);
}
