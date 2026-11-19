// 2.5D Oblique Extruded City Renderer for Solara Bay: Heatline V2.
// Sharp directional shadows, wet asphalt, harbor surf, 6 vehicle classes, spiked roadblocks, FX & lighting.

import { COLORS, MONO_FONT, UI_FONT, VIEW, WORLD } from '../core/config.js';
import { clamp } from '../core/random.js';
import { createLightingEngine } from '../world/lighting.js';

export function createWorldRenderer() {
  const lighting = createLightingEngine();
  const R = (c, x, y, w, h, f) => { c.fillStyle = f; c.fillRect(x, y, w, h); };
  const C = (c, x, y, r, f) => { c.fillStyle = f; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); };
  const O = (c, x, y, r, s, lw = 2) => { c.strokeStyle = s; c.lineWidth = lw; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke(); };
  const L = (c, x1, y1, x2, y2, s, lw = 2) => { c.strokeStyle = s; c.lineWidth = lw; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };

  function drawTerrain(ctx, city, camY, time) {
    R(ctx, 0, 0, WORLD.waterWidth - 36, WORLD.height, COLORS.oceanDeep);
    R(ctx, WORLD.waterWidth - 36, 0, 44, WORLD.height, COLORS.oceanMid);
    R(ctx, WORLD.waterWidth + 8, 0, 16, WORLD.height, COLORS.oceanShallow);
    R(ctx, 2240, 2010, WORLD.width - 2240, WORLD.height - 2010, COLORS.oceanDeep);
    R(ctx, 2240, 2010, WORLD.width - 2240, 115, COLORS.oceanMid);

    ctx.strokeStyle = 'rgba(130,224,240,0.16)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let wy = 2045; wy < WORLD.height; wy += 42) { const sh = Math.sin(time * 1.8 + wy * 0.03) * 18; ctx.moveTo(2260 + sh, wy); ctx.lineTo(3560 + sh, wy); }
    ctx.stroke();

    const minY = Math.max(0, Math.floor((camY - VIEW.height) / 40) * 40), maxY = Math.min(WORLD.height, camY + VIEW.height);
    ctx.strokeStyle = COLORS.oceanFoam; ctx.lineWidth = 3.5; ctx.beginPath();
    for (let y = minY; y <= maxY; y += 36) { const x = WORLD.waterWidth + Math.sin(y * 0.016 + time * 2.2) * 8; y === minY ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();

    R(ctx, WORLD.waterWidth, 0, 68, WORLD.height, COLORS.sandLight);
    R(ctx, WORLD.waterWidth + 68, 0, 62, WORLD.height, COLORS.sandWarm);
    R(ctx, 295, 0, 44, WORLD.height, '#72533b');
    ctx.strokeStyle = 'rgba(30,18,10,0.28)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let y = minY; y <= maxY; y += 22) { ctx.moveTo(295, y); ctx.lineTo(339, y); }
    ctx.stroke();

    R(ctx, 339, 0, 921, WORLD.height, '#253b35'); R(ctx, 1260, 0, 1180, 1420, '#18202d');
    R(ctx, 2440, 0, 1160, 1420, COLORS.industrialGround); R(ctx, 1260, 1420, 980, 1180, '#2a313c'); R(ctx, 2240, 1420, 1360, 590, '#2a313c');
    R(ctx, 2350, 2005, 300, 475, COLORS.dockConcrete); R(ctx, 2850, 2005, 330, 475, COLORS.dockConcrete); R(ctx, 3360, 2005, 180, 375, COLORS.dockConcrete);
    R(ctx, 2350, 2480, 300, 10, 'rgba(2,8,14,0.5)'); R(ctx, 2850, 2480, 330, 10, 'rgba(2,8,14,0.5)');
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.setLineDash([12, 10]); ctx.strokeRect(2354, 2008, 292, 468); ctx.strokeRect(2854, 2008, 322, 468); ctx.setLineDash([]);

    for (let c = 0; c < city.vRoads.length - 1; c += 1) for (let r = 0; r < city.hRoads.length - 1; r += 1) {
      if (r === 3 && c >= 3) continue;
      const bx = city.vRoads[c] + 62, by = city.hRoads[r] + 62, bw = city.vRoads[c + 1] - city.vRoads[c] - 124, bh = city.hRoads[r + 1] - city.hRoads[r] - 124;
      R(ctx, bx, by, bw, bh, COLORS.sidewalk); ctx.strokeStyle = COLORS.sidewalkCurb; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
      R(ctx, bx + 26, by + 26, bw - 52, bh - 52, r === 0 && c === 2 ? '#434d5b' : '#1b2330');
    }

    ctx.fillStyle = COLORS.asphalt;
    for (const s of city.segments) s.x1 === s.x2 ? ctx.fillRect(s.x1 - 62, s.y1 - 62, 124, s.y2 - s.y1 + 124) : ctx.fillRect(s.x1 - 62, s.y1 - 62, s.x2 - s.x1 + 124, 124);
    ctx.fillStyle = 'rgba(72,108,152,0.08)';
    for (const s of city.segments) s.x1 === s.x2 ? ctx.fillRect(s.x1 - 36, s.y1 - 62, 72, s.y2 - s.y1 + 124) : ctx.fillRect(s.x1 - 62, s.y1 - 36, s.x2 - s.x1 + 124, 72);
    ctx.strokeStyle = COLORS.laneLine; ctx.lineWidth = 3; ctx.setLineDash([22, 20]); ctx.beginPath();
    for (const s of city.segments) { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
    ctx.stroke(); ctx.setLineDash([]);

    const col = (s) => (s === 'green' ? '#37c978' : s === 'yellow' ? '#ffd166' : '#f04b4c');
    for (const sig of city.signals) {
      ctx.fillStyle = 'rgba(207,216,228,0.65)';
      for (let k = -40; k <= 40; k += 16) {
        ctx.fillRect(sig.x + k - 4, sig.y - 76, 8, 12); ctx.fillRect(sig.x + k - 4, sig.y + 64, 8, 12);
        ctx.fillRect(sig.x - 76, sig.y + k - 4, 12, 8); ctx.fillRect(sig.x + 64, sig.y + k - 4, 12, 8);
      }
      const st = city.getSignalState(sig, time);
      C(ctx, sig.x - 70, sig.y - 70, 5.5, col(st.ns)); C(ctx, sig.x + 70, sig.y + 70, 5.5, col(st.ew));
    }
  }

  function drawDecalsPropsMarkers(ctx, world, time) {
    ctx.strokeStyle = 'rgba(8,10,15,0.62)'; ctx.lineWidth = 4.2; ctx.beginPath();
    for (const s of world.vehicles.skidmarks) { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
    ctx.stroke();
    for (const sc of world.combat.scorches) { C(ctx, sc.x, sc.y, sc.r, 'rgba(6,8,12,0.7)'); C(ctx, sc.x, sc.y, sc.r * 0.52, 'rgba(6,8,12,0.9)'); }
    for (const rb of world.police.roadblocks) {
      L(ctx, rb.spikeX1, rb.spikeY1, rb.spikeX2, rb.spikeY2, '#222a36', 9);
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 6]); ctx.beginPath();
      ctx.moveTo(rb.spikeX1, rb.spikeY1); ctx.lineTo(rb.spikeX2, rb.spikeY2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#e6edf6';
      for (let k = 0; k <= 10; k += 1) ctx.fillRect(rb.spikeX1 + (rb.spikeX2 - rb.spikeX1) * (k / 10) - 2, rb.spikeY1 + (rb.spikeY2 - rb.spikeY1) * (k / 10) - 2, 4, 4);
      for (const fl of rb.flares) { C(ctx, fl.x, fl.y, 4.5, '#ff7b54'); C(ctx, fl.x, fl.y, 2, '#fff5cc'); }
    }
    ctx.fillStyle = '#e8c45e';
    for (const c of world.combat.casings) ctx.fillRect(c.x - 1.5, c.y - 1.5, 3, 2);

    for (const p of world.city.props) {
      if (p.kind === 'fountain') { C(ctx, p.x, p.y, p.r, '#7a889b'); C(ctx, p.x, p.y, p.r - 10, '#1888a6'); O(ctx, p.x, p.y, 18 + Math.sin(time * 4) * 5, 'rgba(210,248,255,0.72)', 2.5); }
      else if (p.kind === 'pool') { R(ctx, p.x - p.w * 0.5 - 6, p.y - p.h * 0.5 - 6, p.w + 12, p.h + 12, '#bfb6a8'); R(ctx, p.x - p.w * 0.5, p.y - p.h * 0.5, p.w, p.h, '#1ca6bc'); }
      else if (p.kind === 'silo') { C(ctx, p.x + 14, p.y + 12, p.r, COLORS.shadow); C(ctx, p.x, p.y, p.r, '#737d8c'); C(ctx, p.x - 4, p.y - 4, p.r * 0.72, '#9ba6b5'); }
      else if (p.kind === 'ship') {
        ctx.save(); ctx.translate(p.x, p.y); R(ctx, 12, 12, p.w, p.h, 'rgba(3,10,18,0.52)');
        ctx.fillStyle = '#243040'; ctx.beginPath(); ctx.moveTo(p.w * 0.5, 0); ctx.lineTo(p.w, 48); ctx.lineTo(p.w, p.h - 24); ctx.lineTo(p.w - 14, p.h); ctx.lineTo(14, p.h); ctx.lineTo(0, p.h - 24); ctx.lineTo(0, 48); ctx.closePath(); ctx.fill();
        R(ctx, 14, 58, p.w - 28, p.h - 150, '#85322d');
        for (let r = 0; r < 4; r += 1) R(ctx, 24, 75 + r * 54, p.w - 48, 38, ['#2493ab', '#d68f2c', '#c94844'][r % 3]);
        R(ctx, 18, p.h - 86, p.w - 36, 54, '#d8e0e8'); R(ctx, 26, p.h - 76, p.w - 52, 16, '#15202e'); ctx.restore();
      } else if (p.kind === 'umbrella') { C(ctx, p.x + 8, p.y + 7, 17, COLORS.shadow); C(ctx, p.x, p.y, 17, p.color); ctx.fillStyle = '#fff5e1'; ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, 1.57); ctx.lineTo(p.x, p.y); ctx.fill(); }
      else if (p.kind === 'lifeguard') { R(ctx, p.x + 9, p.y + 9, p.w, p.h, COLORS.shadow); R(ctx, p.x, p.y, p.w, p.h, '#e6ecf2'); R(ctx, p.x + 3, p.y + 3, p.w - 6, 10, '#e76f51'); }
    }

    const pulse = 0.5 + 0.5 * Math.sin(time * 5);
    for (const lm of world.city.landmarks) {
      ctx.save(); ctx.globalAlpha = 0.62 + pulse * 0.34; O(ctx, lm.x, lm.y, lm.radius + pulse * 5, lm.color, 3);
      ctx.globalAlpha = 0.16; C(ctx, lm.x, lm.y, lm.radius + pulse * 5, lm.color); ctx.globalAlpha = 1;
      ctx.fillStyle = lm.color; ctx.font = `700 11px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillText(lm.name.toUpperCase(), lm.x, lm.y + lm.radius + 14); ctx.restore();
    }
    const wp = world.missions.getWaypoint();
    if (wp) { ctx.save(); ctx.globalAlpha = 0.74 + pulse * 0.26; O(ctx, wp.x, wp.y, 38 + pulse * 10, '#ffd166', 4); C(ctx, wp.x, wp.y, 38 + pulse * 10, 'rgba(255,209,102,0.18)'); ctx.restore(); }
    for (const c of world.missions.crates) { const o = Math.sin(c.bob) * 3; R(ctx, c.x - 11, c.y - 11 + o, 22, 22, '#38d9f5'); ctx.strokeStyle = '#070c15'; ctx.lineWidth = 2; ctx.strokeRect(c.x - 11, c.y - 11 + o, 22, 22); }
    const pkCol = { cash: '#37c978', armor: '#3fa9f5', health: '#ff6b6b', ammo: '#ffd166' }, pkSym = { cash: '$', armor: 'A', health: '+', ammo: '•' };
    for (const pk of world.combat.pickups) { const o = Math.sin(pk.bob) * 3; C(ctx, pk.x, pk.y + o, 9.5, pkCol[pk.kind] ?? '#ffd166'); ctx.fillStyle = '#070c15'; ctx.font = `700 11px ${MONO_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pkSym[pk.kind] ?? '•', pk.x, pk.y + o + 0.5); }
  }

  function drawHeli(ctx, x, y, ang, rot, sh = 28, pol = true) {
    ctx.save(); ctx.translate(x + sh, y + sh); ctx.rotate(ang); ctx.fillStyle = 'rgba(3,6,12,0.42)';
    ctx.beginPath(); ctx.ellipse(0, 0, 44, 16, 0, 0, 6.2832); ctx.fill(); ctx.fillRect(-52, -3, 32, 6); ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    R(ctx, -20, -18, 44, 3, '#58667a'); R(ctx, -20, 15, 44, 3, '#58667a'); R(ctx, -56, -4, 44, 8, '#1b2636'); R(ctx, -58, -12, 7, 24, pol ? '#2c8cff' : '#f7a531');
    ctx.fillStyle = '#151e2c'; ctx.beginPath(); ctx.ellipse(6, 0, 32, 16, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(130,224,255,0.48)'; ctx.beginPath(); ctx.ellipse(22, 0, 14, 11, 0, -1.57, 1.57); ctx.fill();
    R(ctx, -10, -12, 18, 24, pol ? '#e8eef5' : '#f7a531'); C(ctx, -2, 0, 5, '#111824'); C(ctx, 0, 0, 54, 'rgba(210,228,245,0.14)');
    ctx.rotate(rot); R(ctx, -54, -2.5, 108, 5, 'rgba(220,232,246,0.72)'); R(ctx, -2.5, -54, 5, 108, 'rgba(220,232,246,0.72)'); ctx.restore();
  }

  function drawVehicle(ctx, v) {
    if (v.spec.aircraft) return drawHeli(ctx, v.x, v.y, v.angle, v.rotorAngle, v.driver !== 'none' ? 28 : 8, true);
    const { length: len, width: W, stripe, siren } = v.spec, hw = len * 0.5, hh = W * 0.5, wx = hw * 0.62, wy = hh + 1;
    ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.angle);
    ctx.fillStyle = COLORS.shadow; ctx.beginPath(); ctx.roundRect(-hw + 6, -hh + 7, len, W, 7); ctx.fill();
    R(ctx, -wx - 7, -wy - 3, 14, 5, '#0e1218'); R(ctx, -wx - 7, wy - 2, 14, 5, '#0e1218');
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(wx, s * wy); ctx.rotate(v.steerAngle); R(ctx, -7, s < 0 ? -3 : -2, 14, 5, '#0e1218'); ctx.restore(); }
    ctx.fillStyle = v.exploded ? '#23272e' : v.color; ctx.beginPath(); ctx.roundRect(-hw, -hh, len, W, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.stroke();

    if (!v.exploded && v.kind === 'police') { R(ctx, -12, -hh + 1, 28, W - 2, '#edf2f7'); R(ctx, -10, -hh + 5, 24, W - 10, '#141a24'); }
    else if (!v.exploded && v.kind === 'armored') { R(ctx, -hw + 6, -hh + 4, len - 12, W - 8, '#242f3f'); C(ctx, -6, 0, 10, '#151c27'); O(ctx, -6, 0, 10, '#4d5f78', 2); R(ctx, hw - 10, -hh + 3, 6, W - 6, '#394659'); }
    else if (!v.exploded && stripe) { R(ctx, -hw + 4, -4, len - 8, 3, 'rgba(255,255,255,0.78)'); R(ctx, -hw + 4, 1, len - 8, 3, 'rgba(255,255,255,0.78)'); }

    const big = v.kind === 'van' || v.kind === 'armored', cL = big ? -hw + 14 : -hw + 16, cLen = big ? len * 0.62 : len * 0.46;
    ctx.fillStyle = v.exploded ? '#12151a' : '#162333'; ctx.beginPath(); ctx.roundRect(cL, -hh + 5, cLen, W - 10, 4); ctx.fill();
    if (!v.exploded) {
      if (v.kind !== 'armored') R(ctx, cL + 6, -hh + 7, cLen - 16, W - 14, v.kind === 'police' ? '#f4f6fa' : v.color);
      R(ctx, cL + cLen - 9, -hh + 7, 6, W - 14, 'rgba(175,232,255,0.44)');
      R(ctx, hw - 3, -hh + 4, 4, 6, '#fff8d6'); R(ctx, hw - 3, hh - 10, 4, 6, '#fff8d6');
      R(ctx, -hw, -hh + 4, 3, 7, '#ff4747'); R(ctx, -hw, hh - 11, 3, 7, '#ff4747');
    }
    if (siren && !v.exploded) {
      R(ctx, -4, -hh + 7, 8, W - 14, '#0c121b'); const red = Math.sin(v.sirenPhase) > 0;
      R(ctx, -3, -hh + 7, 6, (W - 14) * 0.5, red ? '#ff3847' : '#2c8cff'); R(ctx, -3, 0, 6, (W - 14) * 0.5, red ? '#2c8cff' : '#ff3847');
    }
    ctx.restore();
  }

  function drawChar(ctx, x, y, ang, wp, { shirt, hair = '#1a1f29', hasGun = false, muzzleFlash = 0, isPlayer = false, isSwat = false }) {
    const sw = Math.sin(wp) * 4.5;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = COLORS.shadow; ctx.beginPath(); ctx.ellipse(3, 4, 12, 10, 0, 0, 6.2832); ctx.fill();
    R(ctx, sw - 3, -9, 6, 4, '#131720'); R(ctx, -sw - 3, 5, 6, 4, '#131720');
    ctx.fillStyle = shirt; ctx.beginPath(); ctx.roundRect(-7, -11, 14, 22, 6); ctx.fill();
    if (isSwat) R(ctx, -5, -8, 10, 16, '#283344'); else if (isPlayer) R(ctx, -4, -8, 4, 16, '#ffd166');
    if (hasGun) {
      R(ctx, 4, 3, 9, 4, '#d9b08c'); R(ctx, 8, 1, 13, 4, '#1b2230');
      if (muzzleFlash > 0) { ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.moveTo(21, 3); ctx.lineTo(38, -4); ctx.lineTo(33, 3); ctx.lineTo(38, 10); ctx.closePath(); ctx.fill(); }
    }
    C(ctx, 0, 0, 6.5, '#e5b895'); ctx.fillStyle = isSwat ? '#0e1520' : hair; ctx.beginPath(); ctx.arc(-1.5, 0, 6.3, 1.41, 4.87); ctx.fill(); ctx.restore();
  }

  function drawExtrudedBuildings(ctx, city, camX, camY, time) {
    const vis = [];
    for (const b of city.buildings) if (b.x + b.w >= camX - VIEW.width * 0.65 && b.x <= camX + VIEW.width * 0.65 && b.y + b.h >= camY - VIEW.height * 0.72 && b.y <= camY + VIEW.height * 0.72) vis.push({ b, d: (b.x + b.w * 0.5 - camX) ** 2 + (b.y + b.h * 0.5 - camY) ** 2 });
    vis.sort((a, b) => b.d - a.d);

    ctx.fillStyle = 'rgba(3,6,13,0.48)';
    for (const { b } of vis) { const sx = b.height * 0.28, sy = b.height * 0.22; ctx.beginPath(); ctx.moveTo(b.x + b.w, b.y); ctx.lineTo(b.x + b.w + sx, b.y + sy); ctx.lineTo(b.x + b.w + sx, b.y + b.h + sy); ctx.lineTo(b.x + sx, b.y + b.h + sy); ctx.lineTo(b.x, b.y + b.h); ctx.closePath(); ctx.fill(); }
    const face = (x1, y1, x2, y2, rx1, ry1, rx2, ry2, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(rx2, ry2); ctx.lineTo(rx1, ry1); ctx.closePath(); ctx.fill(); };

    for (const { b } of vis) {
      const bx2 = b.x + b.w, by2 = b.y + b.h, k = b.height * 0.0021;
      const rx1 = b.x + (b.x - camX) * k, ry1 = b.y + (b.y - camY) * k, rx2 = bx2 + (bx2 - camX) * k, ry2 = by2 + (by2 - camY) * k;
      if (rx1 > b.x) face(b.x, b.y, b.x, by2, rx1, ry1, rx1, ry2, b.wallColor);
      if (rx2 < bx2) face(bx2, b.y, bx2, by2, rx2, ry1, rx2, ry2, b.wallColor);
      if (ry1 > b.y) face(b.x, b.y, bx2, b.y, rx1, ry1, rx2, ry1, b.wallColor);
      if (ry2 < by2) face(b.x, by2, bx2, by2, rx1, ry2, rx2, ry2, b.wallColor);

      const rw = rx2 - rx1, rh = ry2 - ry1;
      R(ctx, rx1, ry1, rw, rh, b.roofColor); ctx.strokeStyle = 'rgba(4,8,15,0.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(rx1, ry1, rw, rh);
      ctx.strokeStyle = b.accent; ctx.globalAlpha = 0.56; ctx.lineWidth = 2; ctx.strokeRect(rx1 + 3, ry1 + 3, Math.max(2, rw - 6), Math.max(2, rh - 6)); ctx.globalAlpha = 1;

      if (b.style === 'container') {
        ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.lineWidth = 2; ctx.beginPath();
        for (let sx = rx1 + 8; sx < rx2 - 6; sx += 10) { ctx.moveTo(sx, ry1 + 2); ctx.lineTo(sx, ry2 - 2); }
        ctx.stroke();
      } else if (rw > 48 && rh > 48) {
        R(ctx, rx1 + 12, ry1 + 12, 18, 14, 'rgba(10,16,24,0.65)'); R(ctx, rx1 + 36, ry1 + 12, 12, 10, 'rgba(10,16,24,0.65)');
        if (b.windows && rw > 58 && rh > 58) { ctx.fillStyle = 'rgba(255,214,125,0.34)'; for (let wx = rx1 + 14; wx < rx2 - 14; wx += 20) ctx.fillRect(wx, ry2 - 6, 10, 3); }
        if (b.helipad && rw > 80 && rh > 80) { const hx = rx1 + rw * 0.5, hy = ry1 + rh * 0.5; O(ctx, hx, hy, 22, '#ffd166', 2.5); ctx.fillStyle = '#ffd166'; ctx.font = `700 18px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', hx, hy + 1); }
      }
      if (b.neon) {
        ctx.save(); ctx.globalAlpha = 0.9 + 0.1 * Math.sin(time * 9 + b.x);
        const sw = Math.min(rw - 8, 122); R(ctx, rx1 + (rw - sw) * 0.5, ry2 - 11, sw, 18, '#09101a');
        ctx.strokeStyle = b.neon.color; ctx.lineWidth = 1.8; ctx.strokeRect(rx1 + (rw - sw) * 0.5, ry2 - 11, sw, 18);
        ctx.fillStyle = b.neon.color; ctx.font = `700 10px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.neon.label, rx1 + rw * 0.5, ry2 - 2); ctx.restore();
      }
    }
  }

  function renderWorld(ctx, world, camX, camY, time) {
    ctx.save(); ctx.translate(VIEW.width * 0.5 - camX, VIEW.height * 0.5 - camY);
    drawTerrain(ctx, world.city, camY, time);
    lighting.drawSurfaceReflections(ctx, world, camX, camY, time);
    drawDecalsPropsMarkers(ctx, world, time);
    lighting.drawGroundLighting(ctx, world, camX, camY, time);

    for (const v of world.vehicles.vehicles) if ((!v.spec.aircraft || v.driver === 'none') && Math.abs(v.x - camX) <= VIEW.width * 0.72 && Math.abs(v.y - camY) <= VIEW.height * 0.75) drawVehicle(ctx, v);
    for (const ped of world.traffic.pedestrians) if (Math.abs(ped.x - camX) <= VIEW.width * 0.65 && Math.abs(ped.y - camY) <= VIEW.height * 0.7) drawChar(ctx, ped.x, ped.y, ped.angle, ped.walkPhase, { shirt: ped.shirt, hair: ped.hair });
    for (const e of world.combat.enemies) { drawChar(ctx, e.x, e.y, e.angle, e.walkPhase, { shirt: e.shirt, hasGun: true, isSwat: e.role === 'boss' }); if (e.hp < e.maxHp) { R(ctx, e.x - 16, e.y - 22, 32, 5, '#070c15'); R(ctx, e.x - 15, e.y - 21, 30 * clamp(e.hp / e.maxHp, 0, 1), 3, e.role === 'boss' ? '#ffd166' : '#f04b4c'); } }
    for (const u of world.police.units) drawChar(ctx, u.x, u.y, u.angle, u.walkPhase, { shirt: u.isSwat ? '#1c2532' : '#254a82', hasGun: true, isSwat: u.isSwat });
    if (!world.player.inVehicle) drawChar(ctx, world.player.x, world.player.y, world.player.aimAngle, world.player.walkPhase, { shirt: '#28c7b7', hair: '#1a1b20', hasGun: true, muzzleFlash: world.player.muzzleFlash, isPlayer: true });

    drawExtrudedBuildings(ctx, world.city, camX, camY, time);
    for (const p of world.city.props) {
      if (Math.abs(p.x - camX) > VIEW.width * 0.7 || Math.abs(p.y - camY) > VIEW.height * 0.75) continue;
      if (p.kind === 'palm') {
        const tx = p.x + (p.x - camX) * 0.055 + Math.sin(time * 2.1 + p.y * 0.02) * 4, ty = p.y + (p.y - camY) * 0.055 - 12;
        C(ctx, p.x + 20, p.y + 16, 22 * p.scale, COLORS.shadow); L(ctx, p.x, p.y, tx, ty, '#684a34', 6 * p.scale); ctx.fillStyle = '#247a4b';
        for (let f = 0; f < 6; f += 1) { ctx.save(); ctx.translate(tx, ty); ctx.rotate((f / 6) * 6.2832 + time * 0.15); ctx.beginPath(); ctx.ellipse(15 * p.scale, 0, 16 * p.scale, 5 * p.scale, 0, 0, 6.2832); ctx.fill(); ctx.restore(); }
      } else if (p.kind === 'crane') { R(ctx, p.x + 18, p.y + 18, p.w, p.h, COLORS.shadow); R(ctx, p.x, p.y, p.w, 12, '#cf5f34'); R(ctx, p.x, p.y + p.h - 12, p.w, 12, '#cf5f34'); R(ctx, p.x + 24, p.y - 6, 22, p.h + 12, '#f4a261'); }
    }
    for (const v of world.vehicles.vehicles) if (v.spec.aircraft && v.driver !== 'none') drawVehicle(ctx, v);

    lighting.drawOverheadLighting(ctx, world, camX, camY, time);
    ctx.lineCap = 'round';
    for (const b of world.combat.projectiles) { L(ctx, b.x - b.vx * 0.032, b.y - b.vy * 0.032, b.x, b.y, b.color, 4.5); L(ctx, b.x - b.vx * 0.014, b.y - b.vy * 0.014, b.x, b.y, '#ffffff', 1.8); }
    for (const pt of world.combat.particles) { const a = clamp(pt.ttl / pt.maxTtl, 0, 1); ctx.save(); ctx.globalAlpha = a; if (pt.glow) ctx.globalCompositeOperation = 'lighter'; C(ctx, pt.x, pt.y, pt.size * (pt.glow ? 1.05 : 1.35 - a * 0.35), pt.color); ctx.restore(); }
    if (world.police.spotlight.active) drawHeli(ctx, world.police.spotlight.heliX, world.police.spotlight.heliY, world.police.spotlight.heliAngle, world.police.spotlight.rotorAngle, 34, true);

    ctx.font = `700 14px ${UI_FONT}`; ctx.textAlign = 'center';
    for (const pop of world.combat.popups) { ctx.save(); ctx.globalAlpha = clamp(pop.ttl / pop.maxTtl, 0, 1); ctx.fillStyle = '#070c15'; ctx.fillText(pop.text, pop.x + 1, pop.y + 1); ctx.fillStyle = pop.color; ctx.fillText(pop.text, pop.x, pop.y); ctx.restore(); }
    if (world.player.contextPrompt) {
      const px = world.player.x, py = world.player.y - 36; ctx.font = `700 12px ${UI_FONT}`; const tw = ctx.measureText(world.player.contextPrompt).width + 22;
      R(ctx, px - tw * 0.5, py - 14, tw, 24, 'rgba(8,13,22,0.94)'); ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.6; ctx.strokeRect(px - tw * 0.5, py - 14, tw, 24);
      ctx.fillStyle = '#ffd166'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(world.player.contextPrompt, px, py - 2);
    }
    ctx.restore();
    lighting.drawAtmosphericGrade(ctx, world);
  }
  return { renderWorld };
}
