// 2.5D Oblique Extruded City Renderer for Solara Bay: Heatline.
// Draws ocean surf, beach boardwalk, district asphalt, 2.5D radial-extruded buildings with neon signs,
// detailed multi-part vehicles with headlights and police lightbars, articulated characters, and FX.

import { COLORS, MONO_FONT, UI_FONT, VIEW, WORLD } from './config.js';
import { clamp } from './random.js';

export function createWorldRenderer() {
  const fillRect = (ctx, x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  const fillCircle = (ctx, x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const strokeCircle = (ctx, x, y, r, color, lw = 2) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  };

  const drawLine = (ctx, x1, y1, x2, y2, color, lw = 2) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  function drawWaterAndBeach(ctx, camX, camY, time) {
    fillRect(ctx, 0, 0, WORLD.waterWidth - 36, WORLD.height, COLORS.oceanDeep);
    fillRect(ctx, WORLD.waterWidth - 36, 0, 44, WORLD.height, COLORS.oceanMid);
    fillRect(ctx, WORLD.waterWidth + 8, 0, 16, WORLD.height, '#259ab3');

    fillRect(ctx, 2240, 2010, WORLD.width - 2240, WORLD.height - 2010, COLORS.oceanDeep);
    fillRect(ctx, 2260, 2010, WORLD.width - 2280, 120, COLORS.oceanMid);

    ctx.strokeStyle = COLORS.oceanFoam;
    ctx.lineWidth = 4;
    ctx.beginPath();
    const minY = Math.max(0, Math.floor((camY - VIEW.height) / 40) * 40);
    const maxY = Math.min(WORLD.height, camY + VIEW.height);
    for (let y = minY; y <= maxY; y += 36) {
      const wave = Math.sin(y * 0.016 + time * 2.2) * 8;
      if (y === minY) ctx.moveTo(WORLD.waterWidth + wave, y);
      else ctx.lineTo(WORLD.waterWidth + wave, y);
    }
    ctx.stroke();

    fillRect(ctx, WORLD.waterWidth, 0, 68, WORLD.height, COLORS.sandLight);
    fillRect(ctx, WORLD.waterWidth + 68, 0, 62, WORLD.height, COLORS.sandWarm);
    fillRect(ctx, 295, 0, 44, WORLD.height, '#8b684b');
    ctx.strokeStyle = 'rgba(40, 24, 12, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = minY; y <= maxY; y += 22) {
      ctx.moveTo(295, y);
      ctx.lineTo(339, y);
    }
    ctx.stroke();
  }

  function drawDistrictGrounds(ctx, city) {
    fillRect(ctx, 339, 0, 921, WORLD.height, '#334d44');
    fillRect(ctx, 1260, 0, 1180, 1420, '#242c3a');
    fillRect(ctx, 2440, 0, 1160, 1420, COLORS.industrialGround);
    fillRect(ctx, 1260, 1420, 980, 1180, '#3b424d');
    fillRect(ctx, 2240, 1420, 1360, 590, '#3b424d');

    fillRect(ctx, 2350, 2005, 300, 475, COLORS.dockConcrete);
    fillRect(ctx, 2850, 2005, 330, 475, COLORS.dockConcrete);
    fillRect(ctx, 3360, 2005, 180, 375, COLORS.dockConcrete);

    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ctx.strokeRect(2354, 2008, 292, 468);
    ctx.strokeRect(2854, 2008, 322, 468);
    ctx.setLineDash([]);

    const roadHalf = 62;
    const sw = 26;
    for (let c = 0; c < city.vRoads.length - 1; c += 1) {
      for (let r = 0; r < city.hRoads.length - 1; r += 1) {
        if (r === 3 && c >= 3) continue;
        const bx = city.vRoads[c] + roadHalf;
        const by = city.hRoads[r] + roadHalf;
        const bw = city.vRoads[c + 1] - city.vRoads[c] - roadHalf * 2;
        const bh = city.hRoads[r + 1] - city.hRoads[r] - roadHalf * 2;
        fillRect(ctx, bx, by, bw, bh, COLORS.sidewalk);
        fillRect(ctx, bx + sw, by + sw, bw - sw * 2, bh - sw * 2, r === 0 && c === 2 ? '#5a6370' : '#26303d');
      }
    }
  }

  function drawRoadsAndSignals(ctx, city, time) {
    const rw = 124;
    const half = rw * 0.5;

    ctx.fillStyle = COLORS.asphalt;
    for (let i = 0; i < city.segments.length; i += 1) {
      const s = city.segments[i];
      if (s.x1 === s.x2) ctx.fillRect(s.x1 - half, s.y1 - half, rw, s.y2 - s.y1 + rw);
      else ctx.fillRect(s.x1 - half, s.y1 - half, s.x2 - s.x1 + rw, rw);
    }

    ctx.strokeStyle = COLORS.laneLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 20]);
    ctx.beginPath();
    for (let i = 0; i < city.segments.length; i += 1) {
      const s = city.segments[i];
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < city.signals.length; i += 1) {
      const sig = city.signals[i];
      ctx.fillStyle = 'rgba(216, 222, 232, 0.72)';
      for (let k = -40; k <= 40; k += 16) {
        ctx.fillRect(sig.x + k - 4, sig.y - half - 14, 8, 12);
        ctx.fillRect(sig.x + k - 4, sig.y + half + 2, 8, 12);
        ctx.fillRect(sig.x - half - 14, sig.y + k - 4, 12, 8);
        ctx.fillRect(sig.x + half + 2, sig.y + k - 4, 12, 8);
      }

      const st = city.getSignalState(sig, time);
      const col = (s) => (s === 'green' ? '#37c978' : s === 'yellow' ? '#ffd166' : '#f04b4c');
      fillCircle(ctx, sig.x - half - 8, sig.y - half - 8, 5, col(st.ns));
      fillCircle(ctx, sig.x + half + 8, sig.y + half + 8, 5, col(st.ew));
    }
  }

  function drawDecals(ctx, world) {
    ctx.strokeStyle = 'rgba(12, 15, 22, 0.56)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < world.vehicles.skidmarks.length; i += 1) {
      const s = world.vehicles.skidmarks[i];
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();

    for (let i = 0; i < world.combat.scorches.length; i += 1) {
      const sc = world.combat.scorches[i];
      fillCircle(ctx, sc.x, sc.y, sc.r, 'rgba(10, 12, 16, 0.65)');
      fillCircle(ctx, sc.x, sc.y, sc.r * 0.55, 'rgba(10, 12, 16, 0.85)');
    }

    ctx.fillStyle = '#e8c45e';
    for (let i = 0; i < world.combat.casings.length; i += 1) {
      const c = world.combat.casings[i];
      ctx.fillRect(c.x - 1.5, c.y - 1.5, 3, 2);
    }
  }

  function drawPropsFloor(ctx, city, time) {
    for (let i = 0; i < city.props.length; i += 1) {
      const p = city.props[i];
      if (p.kind === 'fountain') {
        fillCircle(ctx, p.x, p.y, p.r, '#9aa8bd');
        fillCircle(ctx, p.x, p.y, p.r - 10, '#249bb5');
        strokeCircle(ctx, p.x, p.y, 18 + Math.sin(time * 4) * 5, 'rgba(220, 250, 255, 0.65)', 2.5);
      } else if (p.kind === 'pool') {
        fillRect(ctx, p.x - p.w * 0.5 - 6, p.y - p.h * 0.5 - 6, p.w + 12, p.h + 12, '#d8cfc2');
        fillRect(ctx, p.x - p.w * 0.5, p.y - p.h * 0.5, p.w, p.h, '#25b8cc');
      } else if (p.kind === 'silo') {
        fillCircle(ctx, p.x + 12, p.y + 10, p.r, 'rgba(0,0,0,0.34)');
        fillCircle(ctx, p.x, p.y, p.r, '#8b95a3');
        fillCircle(ctx, p.x - 4, p.y - 4, p.r * 0.72, '#b4becb');
      } else if (p.kind === 'ship') {
        ctx.save();
        ctx.translate(p.x, p.y);
        fillRect(ctx, 10, 10, p.w, p.h, 'rgba(5, 14, 22, 0.45)');
        ctx.fillStyle = '#2d3a4a';
        ctx.beginPath();
        ctx.moveTo(p.w * 0.5, 0);
        ctx.lineTo(p.w, 48);
        ctx.lineTo(p.w, p.h - 24);
        ctx.lineTo(p.w - 14, p.h);
        ctx.lineTo(14, p.h);
        ctx.lineTo(0, p.h - 24);
        ctx.lineTo(0, 48);
        ctx.closePath();
        ctx.fill();
        fillRect(ctx, 14, 58, p.w - 28, p.h - 150, '#9c3c36');
        const deckCols = ['#28a0b8', '#e69d38', '#d9534f'];
        for (let r = 0; r < 4; r += 1) {
          fillRect(ctx, 24, 75 + r * 54, p.w - 48, 38, deckCols[r % 3]);
        }
        fillRect(ctx, 18, p.h - 86, p.w - 36, 54, '#e8edf2');
        fillRect(ctx, 26, p.h - 76, p.w - 52, 16, '#1e2736');
        ctx.restore();
      } else if (p.kind === 'umbrella') {
        fillCircle(ctx, p.x + 7, p.y + 6, 17, 'rgba(0,0,0,0.28)');
        fillCircle(ctx, p.x, p.y, 17, p.color);
        ctx.fillStyle = '#fff5e1';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 17, 0, Math.PI * 0.5);
        ctx.lineTo(p.x, p.y);
        ctx.fill();
      } else if (p.kind === 'lifeguard') {
        fillRect(ctx, p.x + 8, p.y + 8, p.w, p.h, 'rgba(0,0,0,0.28)');
        fillRect(ctx, p.x, p.y, p.w, p.h, '#f4f6fa');
        fillRect(ctx, p.x + 3, p.y + 3, p.w - 6, 10, '#e76f51');
      }
    }
  }

  function drawLandmarksAndMissionMarkers(ctx, world, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 5);

    for (let i = 0; i < world.city.landmarks.length; i += 1) {
      const lm = world.city.landmarks[i];
      ctx.save();
      ctx.globalAlpha = 0.55 + pulse * 0.35;
      strokeCircle(ctx, lm.x, lm.y, lm.radius + pulse * 5, lm.color, 3);
      ctx.globalAlpha = 0.14;
      fillCircle(ctx, lm.x, lm.y, lm.radius + pulse * 5, lm.color);
      ctx.globalAlpha = 1;
      ctx.fillStyle = lm.color;
      ctx.font = `700 11px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(lm.name.toUpperCase(), lm.x, lm.y + lm.radius + 14);
      ctx.restore();
    }

    const wp = world.missions.getWaypoint();
    if (wp) {
      ctx.save();
      ctx.globalAlpha = 0.72 + pulse * 0.28;
      strokeCircle(ctx, wp.x, wp.y, 38 + pulse * 10, '#ffd166', 4);
      fillCircle(ctx, wp.x, wp.y, 38 + pulse * 10, 'rgba(255, 209, 102, 0.16)');
      ctx.restore();
    }

    for (let i = 0; i < world.missions.crates.length; i += 1) {
      const c = world.missions.crates[i];
      const off = Math.sin(c.bob) * 3;
      fillRect(ctx, c.x - 11, c.y - 11 + off, 22, 22, '#4de1ff');
      ctx.strokeStyle = '#0b111c';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x - 11, c.y - 11 + off, 22, 22);
    }

    const pkColors = { cash: '#37c978', armor: '#3fa9f5', health: '#ff6b6b', ammo: '#ffd166' };
    const pkSyms = { cash: '$', armor: 'A', health: '+', ammo: '•' };
    for (let i = 0; i < world.combat.pickups.length; i += 1) {
      const pk = world.combat.pickups[i];
      const off = Math.sin(pk.bob) * 3;
      fillCircle(ctx, pk.x, pk.y + off, 9, pkColors[pk.kind] ?? '#ffd166');
      ctx.fillStyle = '#0b111c';
      ctx.font = `700 11px ${MONO_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pkSyms[pk.kind] ?? '•', pk.x, pk.y + off + 0.5);
    }
  }

  function drawVehicle(ctx, v, time) {
    const spec = v.spec;
    const hw = spec.length * 0.5;
    const hh = spec.width * 0.5;

    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);

    fillRect(ctx, -hw + 4, -hh + 5, spec.length, spec.width, 'rgba(5, 8, 14, 0.45)');

    const wx = hw * 0.62;
    const wy = hh + 1;
    fillRect(ctx, -wx - 7, -wy - 3, 14, 5, '#11151d');
    fillRect(ctx, -wx - 7, wy - 2, 14, 5, '#11151d');
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(wx, side * wy);
      ctx.rotate(v.steerAngle);
      fillRect(ctx, -7, side < 0 ? -3 : -2, 14, 5, '#11151d');
      ctx.restore();
    }

    ctx.fillStyle = v.exploded ? '#252930' : v.color;
    ctx.beginPath();
    ctx.roundRect(-hw, -hh, spec.length, spec.width, 7);
    ctx.fill();

    if (!v.exploded && v.kind === 'police') {
      fillRect(ctx, -12, -hh + 1, 28, spec.width - 2, '#edf2f7');
      fillRect(ctx, -10, -hh + 5, 24, spec.width - 10, '#161c26');
    } else if (!v.exploded && spec.stripe) {
      fillRect(ctx, -hw + 4, -4, spec.length - 8, 3, 'rgba(255, 255, 255, 0.78)');
      fillRect(ctx, -hw + 4, 1, spec.length - 8, 3, 'rgba(255, 255, 255, 0.78)');
    }

    ctx.fillStyle = v.exploded ? '#14171c' : '#1b2838';
    const cabLeft = v.kind === 'van' || v.kind === 'swat' ? -hw + 12 : -hw + 16;
    const cabLen = v.kind === 'van' || v.kind === 'swat' ? spec.length * 0.64 : spec.length * 0.46;
    ctx.beginPath();
    ctx.roundRect(cabLeft, -hh + 5, cabLen, spec.width - 10, 4);
    ctx.fill();

    if (!v.exploded) {
      fillRect(ctx, cabLeft + 6, -hh + 7, cabLen - 16, spec.width - 14, v.kind === 'police' ? '#f4f6fa' : v.color);
      fillRect(ctx, cabLeft + cabLen - 9, -hh + 7, 6, spec.width - 14, 'rgba(180, 235, 255, 0.36)');
    }

    if (!v.exploded && (v.driver !== 'none' || v.sirenOn)) {
      ctx.fillStyle = 'rgba(255, 238, 175, 0.16)';
      ctx.beginPath();
      ctx.moveTo(hw, -hh + 5);
      ctx.lineTo(hw + 128, -hh - 24);
      ctx.lineTo(hw + 128, hh + 24);
      ctx.lineTo(hw, hh - 5);
      ctx.closePath();
      ctx.fill();
      fillRect(ctx, hw - 3, -hh + 4, 4, 6, '#fff5cc');
      fillRect(ctx, hw - 3, hh - 10, 4, 6, '#fff5cc');
    }

    fillRect(ctx, -hw, -hh + 4, 3, 7, v.exploded ? '#222' : '#ff4747');
    fillRect(ctx, -hw, hh - 11, 3, 7, v.exploded ? '#222' : '#ff4747');

    if (spec.siren && !v.exploded) {
      fillRect(ctx, -4, -hh + 7, 8, spec.width - 14, '#0d131d');
      const flashRed = Math.sin(v.sirenPhase) > 0;
      fillRect(ctx, -3, -hh + 7, 6, (spec.width - 14) * 0.5, flashRed ? '#ff3847' : '#256eff');
      fillRect(ctx, -3, 0, 6, (spec.width - 14) * 0.5, flashRed ? '#256eff' : '#ff3847');

      if (v.sirenOn) {
        const gr = 82 + Math.sin(time * 12) * 10;
        fillCircle(ctx, 0, 0, gr, flashRed ? 'rgba(255, 48, 70, 0.15)' : 'rgba(40, 130, 255, 0.15)');
        fillCircle(ctx, 0, 0, gr * 0.52, flashRed ? 'rgba(255, 48, 70, 0.22)' : 'rgba(40, 130, 255, 0.22)');
      }
    }

    ctx.restore();
  }

  function drawCharacter(ctx, x, y, angle, walkPhase, options) {
    const { shirt, hair = '#1a1f29', hasGun = false, muzzleFlash = 0, isPlayer = false, isSwat = false } = options;
    const swing = Math.sin(walkPhase) * 4.5;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = 'rgba(4, 8, 16, 0.42)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    fillRect(ctx, swing - 3, -9, 6, 4, '#151922');
    fillRect(ctx, -swing - 3, 5, 6, 4, '#151922');

    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.roundRect(-7, -11, 14, 22, 6);
    ctx.fill();

    if (isSwat) fillRect(ctx, -5, -8, 10, 16, '#2d3748');
    else if (isPlayer) fillRect(ctx, -4, -8, 4, 16, '#ffd166');

    if (hasGun) {
      fillRect(ctx, 4, 3, 9, 4, '#d9b08c');
      fillRect(ctx, 8, 1, 12, 4, '#1c2330');
      if (muzzleFlash > 0) {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.moveTo(20, 3);
        ctx.lineTo(34, -3);
        ctx.lineTo(30, 3);
        ctx.lineTo(34, 9);
        ctx.closePath();
        ctx.fill();
      }
    }

    fillCircle(ctx, 0, 0, 6.5, '#e5b895');
    ctx.fillStyle = isSwat ? '#111824' : hair;
    ctx.beginPath();
    ctx.arc(-1.5, 0, 6.3, Math.PI * 0.45, Math.PI * 1.55);
    ctx.fill();

    ctx.restore();
  }

  function drawExtrudedBuildings(ctx, city, camX, camY, time) {
    const viewLeft = camX - VIEW.width * 0.65;
    const viewRight = camX + VIEW.width * 0.65;
    const viewTop = camY - VIEW.height * 0.72;
    const viewBottom = camY + VIEW.height * 0.72;

    const visible = [];
    for (let i = 0; i < city.buildings.length; i += 1) {
      const b = city.buildings[i];
      if (b.x + b.w < viewLeft || b.x > viewRight || b.y + b.h < viewTop || b.y > viewBottom) continue;
      visible.push({ b, distSq: (b.x + b.w * 0.5 - camX) ** 2 + (b.y + b.h * 0.5 - camY) ** 2 });
    }
    visible.sort((a, b) => b.distSq - a.distSq);

    const drawFace = (xA, yA, xB, yB, rxA, ryA, rxB, ryB, shade) => {
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(xA, yA);
      ctx.lineTo(xB, yB);
      ctx.lineTo(rxB, ryB);
      ctx.lineTo(rxA, ryA);
      ctx.closePath();
      ctx.fill();
    };

    for (let i = 0; i < visible.length; i += 1) {
      const { b } = visible[i];
      const bx1 = b.x;
      const by1 = b.y;
      const bx2 = b.x + b.w;
      const by2 = b.y + b.h;
      const k = b.height * 0.0021;
      const rx1 = bx1 + (bx1 - camX) * k;
      const ry1 = by1 + (by1 - camY) * k;
      const rx2 = bx2 + (bx2 - camX) * k;
      const ry2 = by2 + (by2 - camY) * k;

      fillRect(ctx, bx1 + 14, by1 + 12, b.w, b.h, 'rgba(6, 10, 18, 0.34)');

      if (rx1 > bx1) drawFace(bx1, by1, bx1, by2, rx1, ry1, rx1, ry2, b.wallColor);
      if (rx2 < bx2) drawFace(bx2, by1, bx2, by2, rx2, ry1, rx2, ry2, b.wallColor);
      if (ry1 > by1) drawFace(bx1, by1, bx2, by1, rx1, ry1, rx2, ry1, b.wallColor);
      if (ry2 < by2) drawFace(bx1, by2, bx2, by2, rx1, ry2, rx2, ry2, b.wallColor);

      const rw = rx2 - rx1;
      const rh = ry2 - ry1;
      fillRect(ctx, rx1, ry1, rw, rh, b.roofColor);
      ctx.strokeStyle = 'rgba(8, 12, 20, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx1, ry1, rw, rh);

      ctx.strokeStyle = b.accent;
      ctx.globalAlpha = 0.42;
      ctx.lineWidth = 2;
      ctx.strokeRect(rx1 + 3, ry1 + 3, Math.max(2, rw - 6), Math.max(2, rh - 6));
      ctx.globalAlpha = 1;

      if (b.style === 'container') {
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let sx = rx1 + 8; sx < rx2 - 6; sx += 10) {
          ctx.moveTo(sx, ry1 + 2);
          ctx.lineTo(sx, ry2 - 2);
        }
        ctx.stroke();
      } else if (rw > 48 && rh > 48) {
        fillRect(ctx, rx1 + 12, ry1 + 12, 18, 14, 'rgba(15, 22, 32, 0.55)');
        fillRect(ctx, rx1 + 36, ry1 + 12, 12, 10, 'rgba(15, 22, 32, 0.55)');
        if (b.windows && rw > 62 && rh > 62) {
          ctx.fillStyle = 'rgba(255, 214, 130, 0.14)';
          for (let wx = rx1 + 16; wx < rx2 - 16; wx += 22) ctx.fillRect(wx, ry2 - 6, 10, 3);
        }
        if (b.helipad && rw > 80 && rh > 80) {
          const hx = rx1 + rw * 0.5;
          const hy = ry1 + rh * 0.5;
          strokeCircle(ctx, hx, hy, 22, '#ffd166', 2.5);
          ctx.fillStyle = '#ffd166';
          ctx.font = `700 18px ${UI_FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('H', hx, hy + 1);
        }
      }

      if (b.neon) {
        ctx.save();
        ctx.globalAlpha = 0.88 + 0.12 * Math.sin(time * 9 + b.x);
        const sw = Math.min(rw - 8, 118);
        fillRect(ctx, rx1 + (rw - sw) * 0.5, ry2 - 11, sw, 18, '#0d1420');
        ctx.strokeStyle = b.neon.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx1 + (rw - sw) * 0.5, ry2 - 11, sw, 18);
        ctx.fillStyle = b.neon.color;
        ctx.font = `700 10px ${UI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.neon.label, rx1 + rw * 0.5, ry2 - 2);
        ctx.restore();
      }
    }
  }

  function drawOverheadProps(ctx, city, camX, camY, time) {
    for (let i = 0; i < city.lamps.length; i += 1) {
      const l = city.lamps[i];
      if (Math.abs(l.x - camX) > VIEW.width * 0.65 || Math.abs(l.y - camY) > VIEW.height * 0.7) continue;
      const teal = l.color === '#4de1ff';
      fillCircle(ctx, l.x, l.y, 46, teal ? 'rgba(77, 225, 255, 0.08)' : 'rgba(255, 191, 105, 0.09)');
      fillCircle(ctx, l.x, l.y, 20, teal ? 'rgba(77, 225, 255, 0.16)' : 'rgba(255, 191, 105, 0.18)');
    }

    for (let i = 0; i < city.props.length; i += 1) {
      const p = city.props[i];
      if (Math.abs(p.x - camX) > VIEW.width * 0.7 || Math.abs(p.y - camY) > VIEW.height * 0.75) continue;
      if (p.kind === 'palm') {
        const sway = Math.sin(time * 2.1 + p.y * 0.02) * 4;
        const topX = p.x + (p.x - camX) * 0.055 + sway;
        const topY = p.y + (p.y - camY) * 0.055 - 12;
        fillCircle(ctx, p.x + 18, p.y + 14, 22 * p.scale, 'rgba(4, 10, 16, 0.28)');
        drawLine(ctx, p.x, p.y, topX, topY, '#73533b', 6 * p.scale);
        ctx.fillStyle = '#2c8a56';
        for (let f = 0; f < 6; f += 1) {
          ctx.save();
          ctx.translate(topX, topY);
          ctx.rotate((f / 6) * Math.PI * 2 + time * 0.15);
          ctx.beginPath();
          ctx.ellipse(15 * p.scale, 0, 16 * p.scale, 5 * p.scale, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (p.kind === 'crane') {
        fillRect(ctx, p.x + 16, p.y + 16, p.w, p.h, 'rgba(0,0,0,0.3)');
        fillRect(ctx, p.x, p.y, p.w, 12, '#d9693b');
        fillRect(ctx, p.x, p.y + p.h - 12, p.w, 12, '#d9693b');
        fillRect(ctx, p.x + 24, p.y - 6, 22, p.h + 12, '#f4a261');
      }
    }
  }

  function drawEffectsAndProjectiles(ctx, world) {
    ctx.lineCap = 'round';
    for (let i = 0; i < world.combat.projectiles.length; i += 1) {
      const b = world.combat.projectiles[i];
      drawLine(ctx, b.x - b.vx * 0.028, b.y - b.vy * 0.028, b.x, b.y, b.color, 4);
      drawLine(ctx, b.x - b.vx * 0.012, b.y - b.vy * 0.012, b.x, b.y, '#ffffff', 1.6);
    }

    for (let i = 0; i < world.combat.particles.length; i += 1) {
      const pt = world.combat.particles[i];
      const alpha = clamp(pt.ttl / pt.maxTtl, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      fillCircle(ctx, pt.x, pt.y, pt.size * (pt.glow ? 1 : 1.3 - alpha * 0.3), pt.color);
      ctx.restore();
    }

    if (world.police.spotlight.active) {
      fillCircle(ctx, world.police.spotlight.x, world.police.spotlight.y, 135, 'rgba(225, 245, 255, 0.22)');
      fillCircle(ctx, world.police.spotlight.x, world.police.spotlight.y, 70, 'rgba(225, 245, 255, 0.20)');
    }

    ctx.font = `700 14px ${UI_FONT}`;
    ctx.textAlign = 'center';
    for (let i = 0; i < world.combat.popups.length; i += 1) {
      const pop = world.combat.popups[i];
      ctx.save();
      ctx.globalAlpha = clamp(pop.ttl / pop.maxTtl, 0, 1);
      ctx.fillStyle = '#0b111c';
      ctx.fillText(pop.text, pop.x + 1, pop.y + 1);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }
  }

  function renderWorld(ctx, world, camX, camY, time) {
    ctx.save();
    ctx.translate(VIEW.width * 0.5 - camX, VIEW.height * 0.5 - camY);

    drawWaterAndBeach(ctx, camX, camY, time);
    drawDistrictGrounds(ctx, world.city);
    drawRoadsAndSignals(ctx, world.city, time);
    drawDecals(ctx, world);
    drawPropsFloor(ctx, world.city, time);
    drawLandmarksAndMissionMarkers(ctx, world, time);

    for (let i = 0; i < world.vehicles.vehicles.length; i += 1) {
      const v = world.vehicles.vehicles[i];
      if (Math.abs(v.x - camX) <= VIEW.width * 0.72 && Math.abs(v.y - camY) <= VIEW.height * 0.75) {
        drawVehicle(ctx, v, time);
      }
    }

    for (let i = 0; i < world.traffic.pedestrians.length; i += 1) {
      const ped = world.traffic.pedestrians[i];
      if (Math.abs(ped.x - camX) <= VIEW.width * 0.65 && Math.abs(ped.y - camY) <= VIEW.height * 0.7) {
        drawCharacter(ctx, ped.x, ped.y, ped.angle, ped.walkPhase, { shirt: ped.shirt, hair: ped.hair });
      }
    }

    for (let i = 0; i < world.combat.enemies.length; i += 1) {
      const e = world.combat.enemies[i];
      drawCharacter(ctx, e.x, e.y, e.angle, e.walkPhase, { shirt: e.shirt, hasGun: true, isSwat: e.role === 'boss' });
      if (e.hp < e.maxHp) {
        fillRect(ctx, e.x - 16, e.y - 22, 32, 5, '#0b111c');
        fillRect(ctx, e.x - 15, e.y - 21, 30 * clamp(e.hp / e.maxHp, 0, 1), 3, e.role === 'boss' ? '#ffd166' : '#f04b4c');
      }
    }

    for (let i = 0; i < world.police.units.length; i += 1) {
      const u = world.police.units[i];
      drawCharacter(ctx, u.x, u.y, u.angle, u.walkPhase, {
        shirt: u.isSwat ? '#1c2532' : '#254a82',
        hasGun: true,
        isSwat: u.isSwat,
      });
    }

    if (!world.player.inVehicle) {
      drawCharacter(ctx, world.player.x, world.player.y, world.player.aimAngle, world.player.walkPhase, {
        shirt: '#28c7b7',
        hair: '#1a1b20',
        hasGun: true,
        muzzleFlash: world.player.muzzleFlash,
        isPlayer: true,
      });
    }

    drawExtrudedBuildings(ctx, world.city, camX, camY, time);
    drawOverheadProps(ctx, world.city, camX, camY, time);
    drawEffectsAndProjectiles(ctx, world);

    if (world.player.contextPrompt) {
      const px = world.player.x;
      const py = world.player.y - 36;
      ctx.font = `700 12px ${UI_FONT}`;
      const tw = ctx.measureText(world.player.contextPrompt).width + 20;
      fillRect(ctx, px - tw * 0.5, py - 14, tw, 24, 'rgba(11, 17, 28, 0.92)');
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px - tw * 0.5, py - 14, tw, 24);
      ctx.fillStyle = '#ffd166';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(world.player.contextPrompt, px, py - 2);
    }

    ctx.restore();

    fillRect(ctx, 0, 0, VIEW.width, 96, 'rgba(255, 148, 72, 0.09)');
    fillRect(ctx, 0, 96, VIEW.width, 84, 'rgba(255, 178, 92, 0.05)');
    if (world.player.hitFlash > 0) {
      fillRect(ctx, 0, 0, VIEW.width, VIEW.height, `rgba(240, 75, 76, ${world.player.hitFlash * 1.4})`);
    }
  }

  return { renderWorld };
}
