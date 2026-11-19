// Dynamic Dusk & Neon-Night Lighting Engine for Solara Bay: Heatline V2.
// Wet-asphalt & harbor-water neon reflections, headlight cones, blue-red police siren washes,
// streetlamps, roadblock flares, helicopter volumetric searchlight, and dusk grading.

import { VIEW } from '../core/config.js';
import { clamp } from '../core/random.js';

export function createLightingEngine() {
  const rgbCache = new Map();
  const rgb = (hex) => {
    let v = rgbCache.get(hex);
    if (!v) { const n = parseInt(hex.slice(1), 16); v = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; rgbCache.set(hex, v); }
    return v;
  };

  function bloom(ctx, x, y, r, col, a0, a1 = 0) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${a0})`);
    if (a1 > 0) g.addColorStop(0.45, `rgba(${col},${a1})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  function drawSurfaceReflections(ctx, world, camX, camY, time) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const L = camX - VIEW.width * 0.65; const R = camX + VIEW.width * 0.65;
    const T = camY - VIEW.height * 0.68; const B = camY + VIEW.height * 0.68;

    if (R > 2240 && B > 2010) {
      for (const l of world.city.lamps) {
        if (l.x < 2200 || l.y < 1880 || l.x < L - 120 || l.x > R + 120) continue;
        const c = rgb(l.color);
        for (let k = 0; k < 5; k += 1) {
          const ry = Math.max(2024, l.y + 18 + k * 24); if (ry > B + 40) break;
          const rw = 36 - k * 4.5;
          ctx.fillStyle = `rgba(${c},${0.26 - k * 0.04})`;
          ctx.fillRect(l.x - rw * 0.5 + Math.sin(time * 3.2 + k * 1.4 + l.x * 0.03) * 12, ry, rw, 5);
        }
      }
      const dockLights = [[3268, 2110, '#ffd166'], [3268, 2240, '#ff7b54'], [3268, 2380, '#38d9f5'], [2670, 2200, '#ff9f43'], [3190, 2280, '#ff9f43']];
      for (let i = 0; i < dockLights.length; i += 1) {
        const [sx, sy, hex] = dockLights[i];
        if (sx < L - 120 || sx > R + 120 || sy < T - 120 || sy > B + 120) continue;
        const c = rgb(hex);
        for (let k = 0; k < 4; k += 1) {
          ctx.fillStyle = `rgba(${c},${0.22 - k * 0.04})`;
          ctx.fillRect(sx - 28 + Math.cos(time * 2.8 + k * 1.7 + i) * 14, sy + k * 18, 56 - k * 7, 4);
        }
      }
    }

    for (const b of world.city.buildings) {
      if (!b.neon) continue;
      const cx = b.x + b.w * 0.5; const sy = b.y + b.h + 44;
      if (cx < L - 120 || cx > R + 120 || sy < T - 120 || sy > B + 120) continue;
      const p = 0.85 + 0.15 * Math.sin(time * 6 + b.x * 0.02); const c = rgb(b.neon.color);
      bloom(ctx, cx, sy, 88, c, 0.24 * p, 0.1 * p);
      ctx.fillStyle = `rgba(${c},${0.18 * p})`; ctx.fillRect(cx - 46, sy - 6, 92, 4); ctx.fillRect(cx - 30, sy + 6, 60, 3);
    }
    ctx.restore();
  }

  function drawGroundLighting(ctx, world, camX, camY, time) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const L = camX - VIEW.width * 0.72; const R = camX + VIEW.width * 0.72;
    const T = camY - VIEW.height * 0.75; const B = camY + VIEW.height * 0.75;

    for (const l of world.city.lamps) if (l.x >= L && l.x <= R && l.y >= T && l.y <= B) bloom(ctx, l.x, l.y, 88, rgb(l.color), 0.3, 0.12);
    const toC = (s) => (s === 'green' ? '55,201,120' : s === 'yellow' ? '255,209,102' : '240,75,76');
    for (const sig of world.city.signals) {
      if (sig.x < L || sig.x > R || sig.y < T || sig.y > B) continue;
      const st = world.city.getSignalState(sig, time);
      bloom(ctx, sig.x - 70, sig.y - 70, 36, toC(st.ns), 0.36, 0.12);
      bloom(ctx, sig.x + 70, sig.y + 70, 36, toC(st.ew), 0.36, 0.12);
    }
    for (let i = 0; i < world.police.roadblocks.length; i += 1) {
      const rb = world.police.roadblocks[i]; if (rb.x < L || rb.x > R || rb.y < T || rb.y > B) continue;
      const fl = 0.78 + 0.22 * Math.sin(time * 24 + i * 3);
      for (const f of rb.flares) bloom(ctx, f.x, f.y, 68, '255,118,48', 0.56 * fl, 0.24 * fl);
    }

    for (const v of world.vehicles.vehicles) {
      if (v.exploded || v.spec.aircraft || v.x < L - 190 || v.x > R + 190 || v.y < T - 190 || v.y > B + 190) continue;
      const hw = v.spec.length * 0.5; const hh = v.spec.width * 0.5;
      ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.angle);
      if (v.underglow) bloom(ctx, 0, 0, hw + 28, '56,217,245', 0.44, 0.2);

      if (v.headlights && (v.driver !== 'none' || v.sirenOn || v.underglow)) {
        const len = v.driver === 'player' || v.sirenOn ? 195 : 155;
        const spr = v.driver === 'player' ? 42 : 34;
        const g = ctx.createLinearGradient(hw - 2, 0, hw + len, 0);
        g.addColorStop(0, 'rgba(255,244,200,0.34)'); g.addColorStop(0.5, 'rgba(255,232,168,0.13)'); g.addColorStop(1, 'rgba(255,224,150,0)');
        ctx.fillStyle = g;
        for (const s of [-1, 1]) {
          const ly = s * (hh - 6);
          ctx.beginPath(); ctx.moveTo(hw - 2, ly - 3); ctx.lineTo(hw + len, ly - spr); ctx.lineTo(hw + len, ly + spr); ctx.lineTo(hw - 2, ly + 3); ctx.closePath(); ctx.fill();
          bloom(ctx, hw + 4, ly, 16, '255,248,220', 0.42);
        }
      }
      const brk = v.speed < 40 && v.driver !== 'none' ? 1.4 : 1.0;
      bloom(ctx, -hw - 6, -hh + 6, 24 * brk, '255,56,68', 0.36, 0.12);
      bloom(ctx, -hw - 6, hh - 6, 24 * brk, '255,56,68', 0.36, 0.12);

      if (v.spec.siren && v.sirenOn) {
        const red = Math.sin(v.sirenPhase) > 0;
        const p = 0.82 + 0.18 * Math.abs(Math.sin(v.sirenPhase * 2));
        bloom(ctx, -2, -18, red ? 165 : 85, '255,42,68', (red ? 0.56 : 0.18) * p, (red ? 0.24 : 0.06) * p);
        bloom(ctx, -2, 18, red ? 85 : 165, '40,144,255', (red ? 0.18 : 0.58) * p, (red ? 0.06 : 0.26) * p);
      }
      ctx.restore();

      if (v.spec.siren && v.sirenOn) {
        const wash = Math.sin(v.sirenPhase) > 0 ? '255,46,74' : '44,148,255';
        for (const b of world.city.buildings) {
          const nx = clamp(v.x, b.x, b.x + b.w); const ny = clamp(v.y, b.y, b.y + b.h);
          const d = Math.hypot(v.x - nx, v.y - ny);
          if (d < 175) { const s = (1 - d / 175) * 0.48; bloom(ctx, nx, ny, 78, wash, s, s * 0.4); }
        }
      }
    }

    if (world.player.muzzleFlash > 0) bloom(ctx, world.player.x + Math.cos(world.player.muzzleAngle) * 26, world.player.y + Math.sin(world.player.muzzleAngle) * 26, 98, '255,209,102', 0.52, 0.2);
    for (const pt of world.combat.particles) if (pt.glow && pt.size >= 5) { const a = clamp(pt.ttl / pt.maxTtl, 0, 1); bloom(ctx, pt.x, pt.y, pt.size * 5, '255,130,52', 0.36 * a, 0.12 * a); }
    ctx.restore();
  }

  function drawOverheadLighting(ctx, world, camX, camY, time) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const L = camX - VIEW.width * 0.68; const R = camX + VIEW.width * 0.68;
    const T = camY - VIEW.height * 0.72; const B = camY + VIEW.height * 0.72;
    for (const b of world.city.buildings) {
      if (!b.neon || b.x + b.w < L || b.x > R || b.y + b.h < T || b.y > B) continue;
      const k = b.height * 0.0021;
      const rx1 = b.x + (b.x - camX) * k; const rx2 = b.x + b.w + (b.x + b.w - camX) * k; const ry2 = b.y + b.h + (b.y + b.h - camY) * k;
      const p = 0.88 + 0.12 * Math.sin(time * 8 + b.x);
      bloom(ctx, (rx1 + rx2) * 0.5, ry2 - 2, 76, rgb(b.neon.color), 0.34 * p, 0.13 * p);
    }

    const spot = world.police.spotlight;
    if (spot.active) {
      const { heliX: hx, heliY: hy, x: sx, y: sy } = spot;
      const ang = Math.atan2(sy - hy, sx - hx); const px = -Math.sin(ang); const py = Math.cos(ang);
      const shaft = ctx.createLinearGradient(hx, hy, sx, sy);
      shaft.addColorStop(0, 'rgba(205,240,255,0.24)'); shaft.addColorStop(0.65, 'rgba(185,232,255,0.1)'); shaft.addColorStop(1, 'rgba(220,246,255,0.18)');
      ctx.fillStyle = shaft; ctx.beginPath();
      ctx.moveTo(hx + px * 9, hy + py * 9); ctx.lineTo(sx + px * 98, sy + py * 98); ctx.lineTo(sx - px * 98, sy - py * 98); ctx.lineTo(hx - px * 9, hy - py * 9);
      ctx.closePath(); ctx.fill();
      bloom(ctx, sx, sy, 132, '200,238,255', 0.28, 0.14);
      ctx.strokeStyle = 'rgba(210,242,255,0.34)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(sx, sy, 98, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawAtmosphericGrade(ctx, world) {
    const dusk = ctx.createLinearGradient(0, 0, VIEW.width * 0.25, VIEW.height * 0.55);
    dusk.addColorStop(0, 'rgba(255,134,58,0.12)'); dusk.addColorStop(0.45, 'rgba(255,174,86,0.04)'); dusk.addColorStop(1, 'rgba(12,24,44,0)');
    ctx.fillStyle = dusk; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const vig = ctx.createRadialGradient(VIEW.width * 0.5, VIEW.height * 0.5, VIEW.height * 0.38, VIEW.width * 0.5, VIEW.height * 0.5, VIEW.width * 0.68);
    vig.addColorStop(0, 'rgba(6,10,18,0)'); vig.addColorStop(1, 'rgba(4,8,16,0.42)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    if (world.player.hitFlash > 0) { ctx.fillStyle = `rgba(240,75,76,${world.player.hitFlash * 1.4})`; ctx.fillRect(0, 0, VIEW.width, VIEW.height); }
  }

  return { drawSurfaceReflections, drawGroundLighting, drawOverheadLighting, drawAtmosphericGrade };
}
