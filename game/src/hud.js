// Crisp HUD, real-time Minimap Radar, Wanted Stars, Armory & Upgrade Shop, Title, Pause, and Results overlays.
// Exposes clickable button bounds so mouse clicks and keyboard shortcuts behave identically.

import { COLORS, MONO_FONT, PLAYER_SPEC, SHOP_UPGRADES, UI_FONT, VIEW, WEAPONS, WORLD } from './config.js';
import { clamp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_SHOP = 'shop';
export const SCREEN_RESULTS = 'results';

export function createHudRenderer() {
  const buttons = [];

  function registerButton(id, x, y, w, h, data = null) {
    buttons.push({ id, x, y, w, h, data });
  }

  function hitTestButton(x, y) {
    for (let i = buttons.length - 1; i >= 0; i -= 1) {
      const b = buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  function drawPanel(ctx, x, y, w, h, r, fill, border = null, lw = 1.5) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  function drawLabel(ctx, text, x, y, font, color, align = 'left') {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  function drawButton(ctx, id, x, y, w, h, r, label, bg, fg, font, border = null, data = null) {
    drawPanel(ctx, x, y, w, h, r, bg, border, 1.5);
    drawLabel(ctx, label, x + w * 0.5, y + h * 0.5 + 5, font, fg, 'center');
    registerButton(id, x, y, w, h, data);
  }

  function drawStar(ctx, cx, cy, r, filled, color) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const rad = i % 2 === 0 ? r : r * 0.44;
      const a = -Math.PI * 0.5 + (i * Math.PI) / 5;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = filled ? color : 'rgba(255, 255, 255, 0.14)';
    ctx.fill();
    ctx.strokeStyle = filled ? '#0b111c' : 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawMinimap(ctx, world, time) {
    const size = 166;
    const mx = 22;
    const my = 20;
    const scaleX = size / WORLD.width;
    const scaleY = size / WORLD.height;

    ctx.save();
    drawPanel(ctx, mx - 4, my - 4, size + 8, size + 36, 10, COLORS.hudPanel, COLORS.hudBorder);
    ctx.beginPath();
    ctx.roundRect(mx, my, size, size, 6);
    ctx.clip();

    ctx.fillStyle = '#182436';
    ctx.fillRect(mx, my, size, size);
    ctx.fillStyle = '#135770';
    ctx.fillRect(mx, my, WORLD.waterWidth * scaleX + 6, size);
    ctx.fillRect(mx + 2240 * scaleX, my + 2010 * scaleY, (WORLD.width - 2240) * scaleX, (WORLD.height - 2010) * scaleY);

    ctx.strokeStyle = '#4e5d73';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < world.city.segments.length; i += 1) {
      const s = world.city.segments[i];
      ctx.moveTo(mx + s.x1 * scaleX, my + s.y1 * scaleY);
      ctx.lineTo(mx + s.x2 * scaleX, my + s.y2 * scaleY);
    }
    ctx.stroke();

    if (world.police.state.wantedLevel > 0) {
      ctx.strokeStyle = Math.sin(time * 9) > 0 ? 'rgba(44, 140, 255, 0.72)' : 'rgba(240, 75, 76, 0.72)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(
        mx + world.police.state.lastSeenX * scaleX,
        my + world.police.state.lastSeenY * scaleY,
        world.police.state.searchRadius * scaleX,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }

    for (let i = 0; i < world.city.landmarks.length; i += 1) {
      const lm = world.city.landmarks[i];
      ctx.fillStyle = lm.color;
      ctx.fillRect(mx + lm.x * scaleX - 3, my + lm.y * scaleY - 3, 6, 6);
    }

    for (let i = 0; i < world.vehicles.vehicles.length; i += 1) {
      const v = world.vehicles.vehicles[i];
      if (v.exploded || (v.driver !== 'police' && v.driver !== 'swat')) continue;
      ctx.fillStyle = Math.sin(time * 12 + i) > 0 ? COLORS.hudDanger : COLORS.hudPoliceBlue;
      ctx.beginPath();
      ctx.arc(mx + v.x * scaleX, my + v.y * scaleY, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ff6b4a';
    for (let i = 0; i < world.combat.enemies.length; i += 1) {
      const e = world.combat.enemies[i];
      ctx.beginPath();
      ctx.arc(mx + e.x * scaleX, my + e.y * scaleY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    const wp = world.missions.getWaypoint();
    if (wp) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(mx + wp.x * scaleX, my + wp.y * scaleY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0b111c';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    const px = mx + world.player.x * scaleX;
    const py = my + world.player.y * scaleY;
    const ang = world.player.inVehicle ? world.player.vehicle.angle : world.player.aimAngle;
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4.5, -4);
    ctx.lineTo(-2.5, 0);
    ctx.lineTo(-4.5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const district = world.city.getDistrictAt(world.player.x, world.player.y);
    drawLabel(ctx, district.name.toUpperCase(), mx + 4, my + size + 19, `700 12px ${UI_FONT}`, district.accent);
    drawLabel(ctx, 'RADAR', mx + size - 2, my + size + 19, `600 10px ${MONO_FONT}`, COLORS.hudMuted, 'right');
  }

  function drawTopRightStats(ctx, world, time) {
    const rx = VIEW.width - 22;
    const topY = 20;
    drawPanel(ctx, rx - 268, topY - 4, 272, 134, 10, COLORS.hudPanel, COLORS.hudBorder);

    const wanted = world.police.state.wantedLevel;
    const starColor = Math.sin(time * 10) > 0 ? COLORS.hudDanger : COLORS.hudPoliceBlue;
    for (let s = 0; s < 5; s += 1) {
      drawStar(ctx, rx - 246 + s * 28, topY + 20, 10.5, s < wanted, wanted > 0 ? starColor : COLORS.hudAmber);
    }

    if (wanted > 0 && !world.police.state.spotted) {
      const pct = clamp(world.police.state.evadeTimer / world.police.state.evadeDuration, 0, 1);
      drawLabel(ctx, 'EVADING', rx - 14, topY + 14, `700 10px ${MONO_FONT}`, COLORS.hudPoliceBlue, 'right');
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(rx - 94, topY + 22, 80, 4);
      ctx.fillStyle = COLORS.hudTeal;
      ctx.fillRect(rx - 94, topY + 22, 80 * pct, 4);
    } else {
      drawLabel(
        ctx,
        wanted > 0 ? `HEAT LVL ${wanted}` : 'CLEAR',
        rx - 14,
        topY + 24,
        `700 10px ${MONO_FONT}`,
        wanted > 0 ? COLORS.hudDanger : COLORS.hudMuted,
        'right',
      );
    }

    drawLabel(ctx, `$${world.player.cash.toLocaleString()}`, rx - 254, topY + 58, `700 22px ${MONO_FONT}`, '#37c978');

    const w = WEAPONS[world.player.weaponIndex];
    const slot = world.player.arsenal[w.id];
    drawLabel(ctx, `[${w.slot}] ${w.short}`, rx - 14, topY + 49, `700 13px ${UI_FONT}`, w.color, 'right');
    drawLabel(
      ctx,
      world.player.reloadTimer > 0 ? 'RELOAD...' : `${slot.mag}/${slot.reserve}`,
      rx - 14,
      topY + 64,
      `600 12px ${MONO_FONT}`,
      world.player.reloadTimer > 0 ? COLORS.hudAmber : COLORS.hudText,
      'right',
    );

    const barX = rx - 254;
    const barW = 240;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(barX, topY + 76, barW, 10);
    ctx.fillStyle = COLORS.hudHp;
    ctx.fillRect(barX, topY + 76, barW * clamp(world.player.hp / PLAYER_SPEC.maxHp, 0, 1), 10);

    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(barX, topY + 92, barW, 8);
    ctx.fillStyle = COLORS.hudArmor;
    ctx.fillRect(barX, topY + 92, barW * clamp(world.player.armor / PLAYER_SPEC.maxArmor, 0, 1), 8);

    drawLabel(ctx, `HP ${Math.ceil(world.player.hp)}`, barX + 5, topY + 84, `700 9px ${MONO_FONT}`, '#0b111c');
    drawLabel(ctx, `ARM ${Math.ceil(world.player.armor)}`, barX + 5, topY + 99, `700 9px ${MONO_FONT}`, COLORS.hudText);

    const quick = [
      { id: 'open_shop', label: '[B] ARMORY' },
      { id: 'side_contract', label: '[N] JOB' },
      { id: 'toggle_mute', label: world.audio?.isMuted() ? '[M] MUTED' : '[M] SOUND' },
      { id: 'pause_game', label: '[P] MENU' },
    ];
    let qx = rx - 254;
    for (let i = 0; i < quick.length; i += 1) {
      drawButton(ctx, quick[i].id, qx, topY + 107, 58, 19, 3, quick[i].label, 'rgba(255,255,255,0.08)', COLORS.hudText, `700 9px ${MONO_FONT}`);
      qx += 61;
    }
  }

  function drawBottomTrackers(ctx, world) {
    const mission = world.missions.currentMission();
    const step = world.missions.currentStep();
    const bx = 22;
    const by = VIEW.height - 96;

    if (mission && step) {
      const dist = Math.round(Math.hypot(step.x - world.player.x, step.y - world.player.y) / 8);
      drawPanel(ctx, bx, by, 390, 74, 10, COLORS.hudPanel, COLORS.hudBorder);
      drawLabel(ctx, `MISSION · ${mission.title.toUpperCase()} (+$${mission.reward})`, bx + 14, by + 22, `700 11px ${MONO_FONT}`, COLORS.hudAmber);
      drawLabel(ctx, step.label, bx + 14, by + 46, `600 16px ${UI_FONT}`, COLORS.hudText);
      drawLabel(ctx, `${dist}m AWAY`, bx + 14, by + 64, `700 12px ${MONO_FONT}`, COLORS.hudTeal);
    }

    if (world.missions.state.dialogueTimer > 0 && world.missions.state.dialogueText) {
      const stripW = 584;
      const dx = VIEW.width * 0.5 - stripW * 0.5;
      drawPanel(ctx, dx, 20, stripW, 56, 8, 'rgba(11, 17, 28, 0.9)', 'rgba(40, 199, 183, 0.48)');
      drawLabel(ctx, `RADIO · ${world.missions.state.dialogueSpeaker}`, dx + 16, 40, `700 11px ${MONO_FONT}`, COLORS.hudTeal);
      drawLabel(ctx, world.missions.state.dialogueText, dx + 16, 62, `500 14px ${UI_FONT}`, COLORS.hudText);
    }

    if (world.player.inVehicle && world.player.vehicle) {
      const v = world.player.vehicle;
      const mph = Math.round(v.speed * 0.24);
      const sx = VIEW.width - 242;
      const sy = VIEW.height - 88;
      drawPanel(ctx, sx, sy, 220, 66, 10, COLORS.hudPanel, COLORS.hudBorder);
      drawLabel(ctx, v.spec.name.toUpperCase(), sx + 14, sy + 22, `700 12px ${UI_FONT}`, COLORS.hudAmber);
      drawLabel(ctx, `${mph} MPH`, sx + 206, sy + 42, `700 24px ${MONO_FONT}`, COLORS.hudText, 'right');

      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(sx + 14, sy + 50, 192, 6);
      const hpRatio = clamp(v.hp / v.maxHp, 0, 1);
      ctx.fillStyle = hpRatio > 0.35 ? COLORS.hudTeal : COLORS.hudDanger;
      ctx.fillRect(sx + 14, sy + 50, 192 * hpRatio, 6);
    }
  }

  function drawTitleScreen(ctx, hasSave, isMuted) {
    ctx.fillStyle = 'rgba(9, 14, 24, 0.90)';
    ctx.fillRect(0, 0, 548, VIEW.height);
    ctx.fillStyle = 'rgba(9, 14, 24, 0.42)';
    ctx.fillRect(548, 0, 76, VIEW.height);
    ctx.fillStyle = COLORS.hudAccent;
    ctx.fillRect(548, 0, 3, VIEW.height);

    const lx = 52;
    drawPanel(ctx, lx, 128, 286, 28, 6, 'rgba(247, 165, 49, 0.18)');
    drawLabel(ctx, 'SOLARA BAY · OPEN-WORLD SANDBOX', lx + 14, 146, `700 12px ${MONO_FONT}`, COLORS.hudAmber);
    drawLabel(ctx, 'SOLARA BAY', lx, 222, `800 60px ${UI_FONT}`, '#ffffff');
    drawLabel(ctx, 'HEATLINE', lx, 268, `800 40px ${UI_FONT}`, COLORS.hudAccent);
    drawLabel(ctx, 'Four coastal districts. Five heat levels. Rule the harbor.', lx, 310, `500 16px ${UI_FONT}`, '#cdd6e3');

    const by = 362;
    if (hasSave) {
      drawButton(ctx, 'continue_game', lx, by, 194, 52, 8, 'CONTINUE', COLORS.hudAccent, '#0b111c', `800 18px ${UI_FONT}`);
      drawButton(ctx, 'new_game', lx + 210, by, 174, 52, 8, 'NEW GAME', 'rgba(255,255,255,0.12)', '#ffffff', `800 18px ${UI_FONT}`, COLORS.hudBorder);
    } else {
      drawButton(ctx, 'new_game', lx, by, 224, 54, 8, 'PLAY NOW', COLORS.hudAccent, '#0b111c', `800 19px ${UI_FONT}`);
    }

    drawButton(
      ctx,
      'toggle_mute',
      lx,
      by + 68,
      168,
      38,
      6,
      isMuted ? '[M] AUDIO: OFF' : '[M] AUDIO: ON',
      'rgba(11, 17, 28, 0.85)',
      COLORS.hudText,
      `700 13px ${MONO_FONT}`,
      'rgba(255,255,255,0.22)',
    );

    ctx.fillStyle = 'rgba(11, 17, 28, 0.9)';
    ctx.fillRect(0, VIEW.height - 52, VIEW.width, 52);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.moveTo(0, VIEW.height - 52);
    ctx.lineTo(VIEW.width, VIEW.height - 52);
    ctx.stroke();

    drawLabel(
      ctx,
      'WASD Move / Drive   ·   LEFT CLICK Aim & Fire   ·   E Hijack / Interact   ·   SPACE Drift / Dodge   ·   1-4 Weapons   ·   B Armory   ·   P Pause',
      VIEW.width * 0.5,
      VIEW.height - 21,
      `600 13px ${MONO_FONT}`,
      COLORS.hudText,
      'center',
    );
  }

  function drawShopOverlay(ctx, world) {
    ctx.fillStyle = 'rgba(8, 13, 22, 0.8)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const pw = 820;
    const ph = 520;
    const px = (VIEW.width - pw) * 0.5;
    const py = (VIEW.height - ph) * 0.5;

    drawPanel(ctx, px, py, pw, ph, 14, '#111927', COLORS.hudAccent, 2);
    drawLabel(ctx, 'BLACK MARKET ARMORY & UPGRADES', px + 32, py + 48, `800 26px ${UI_FONT}`, COLORS.hudAmber);
    drawLabel(ctx, `CASH: $${world.player.cash.toLocaleString()}`, px + pw - 32, py + 48, `700 22px ${MONO_FONT}`, '#37c978', 'right');
    drawLabel(ctx, 'FIREARMS & AMMO', px + 32, py + 86, `700 12px ${MONO_FONT}`, COLORS.hudMuted);

    for (let i = 0; i < WEAPONS.length; i += 1) {
      const w = WEAPONS[i];
      const slot = world.player.arsenal[w.id];
      const iy = py + 102 + i * 74;
      drawPanel(ctx, px + 32, iy, 365, 62, 8, 'rgba(255,255,255,0.06)');
      drawLabel(ctx, `[${w.slot}] ${w.name}`, px + 46, iy + 27, `700 17px ${UI_FONT}`, w.color);
      drawLabel(ctx, `DMG ${w.damage} · MAG ${w.magSize} · HAVE ${slot.mag + slot.reserve}`, px + 46, iy + 48, `600 12px ${MONO_FONT}`, COLORS.hudMuted);

      const price = slot.owned ? w.ammoCost : w.cost;
      const canAfford = world.player.cash >= price;
      drawButton(
        ctx,
        'buy_weapon',
        px + 286,
        iy + 13,
        98,
        36,
        6,
        slot.owned ? `AMMO $${price}` : `BUY $${price}`,
        canAfford ? COLORS.hudAccent : '#394252',
        canAfford ? '#0b111c' : '#8b95a3',
        `700 12px ${MONO_FONT}`,
        null,
        w.id,
      );
    }

    drawLabel(ctx, 'GEAR & VEHICLE MODS', px + 424, py + 86, `700 12px ${MONO_FONT}`, COLORS.hudMuted);
    for (let i = 0; i < SHOP_UPGRADES.length; i += 1) {
      const up = SHOP_UPGRADES[i];
      const iy = py + 102 + i * 62;
      const owned =
        (up.kind === 'turbo' && world.player.upgrades.turbo) ||
        (up.kind === 'chassis' && world.player.upgrades.chassis) ||
        (up.kind === 'damage' && world.player.upgrades.damage);
      drawPanel(ctx, px + 424, iy, 364, 52, 8, 'rgba(255,255,255,0.06)');
      drawLabel(ctx, up.name, px + 438, iy + 31, `700 15px ${UI_FONT}`, COLORS.hudText);

      const canAfford = !owned && world.player.cash >= up.cost;
      drawButton(
        ctx,
        'buy_upgrade',
        px + 686,
        iy + 10,
        90,
        32,
        6,
        owned ? 'INSTALLED' : `$${up.cost}`,
        owned ? '#28c7b7' : canAfford ? COLORS.hudAccent : '#394252',
        owned || canAfford ? '#0b111c' : '#8b95a3',
        `700 12px ${MONO_FONT}`,
        null,
        up.id,
      );
    }

    drawButton(ctx, 'close_shop', px + pw - 168, py + ph - 58, 136, 38, 8, '[B / ESC] CLOSE', 'rgba(255,255,255,0.12)', '#ffffff', `700 14px ${MONO_FONT}`);
  }

  function drawPauseOverlay(ctx, world) {
    ctx.fillStyle = 'rgba(8, 13, 22, 0.76)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const pw = 420;
    const ph = 330;
    const px = (VIEW.width - pw) * 0.5;
    const py = (VIEW.height - ph) * 0.5;

    drawPanel(ctx, px, py, pw, ph, 14, '#111927', COLORS.hudBorder, 2);
    drawLabel(ctx, 'PAUSED', px + pw * 0.5, py + 56, `800 32px ${UI_FONT}`, '#ffffff', 'center');

    const items = [
      { id: 'resume_game', label: 'RESUME GAME', accent: true },
      { id: 'save_game', label: 'SAVE PROGRESS', accent: false },
      { id: 'toggle_mute', label: world.audio?.isMuted() ? 'AUDIO: MUTED' : 'AUDIO: ON', accent: false },
      { id: 'restart_game', label: 'RESTART CAMPAIGN', accent: false },
    ];
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      drawButton(
        ctx,
        it.id,
        px + 48,
        py + 86 + i * 54,
        pw - 96,
        42,
        8,
        it.label,
        it.accent ? COLORS.hudAccent : 'rgba(255,255,255,0.1)',
        it.accent ? '#0b111c' : '#ffffff',
        `700 15px ${UI_FONT}`,
      );
    }
  }

  function drawResultsScreen(ctx, world, result) {
    ctx.fillStyle = 'rgba(8, 13, 22, 0.8)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const pw = 660;
    const ph = 460;
    const px = (VIEW.width - pw) * 0.5;
    const py = (VIEW.height - ph) * 0.5;
    const isCleared = result?.outcome !== 'DOWNED';

    drawPanel(ctx, px, py, pw, ph, 14, '#111927', isCleared ? COLORS.hudAmber : COLORS.hudDanger, 2.5);
    drawLabel(
      ctx,
      isCleared ? 'CONTRACT CLEARED · SOLARA BAY' : 'MEDICAL EVAC · DOWNED',
      VIEW.width * 0.5,
      py + 44,
      `700 13px ${MONO_FONT}`,
      isCleared ? '#37c978' : COLORS.hudDanger,
      'center',
    );
    drawLabel(ctx, result?.title?.toUpperCase() ?? 'PIER ENDGAME', VIEW.width * 0.5, py + 86, `800 38px ${UI_FONT}`, '#ffffff', 'center');
    drawLabel(
      ctx,
      isCleared ? `REWARD +$${(result?.reward ?? 4800).toLocaleString()}` : 'HOSPITAL BILL -$250',
      VIEW.width * 0.5,
      py + 128,
      `800 28px ${MONO_FONT}`,
      isCleared ? COLORS.hudAmber : COLORS.hudMuted,
      'center',
    );

    const statsRows = [
      ['TOTAL CASH', `$${world.player.cash.toLocaleString()}`],
      ['CONTRACTS CLEARED', `${world.stats.missionsCleared} / 5`],
      ['SYNDICATE TAKEDOWNS', `${world.stats.takedowns}`],
      ['VEHICLES HIJACKED', `${world.stats.carsStolen}`],
      ['PURSUITS EVADED', `${world.stats.chasesEvaded}`],
      ['PEAK WANTED LEVEL', `${'★'.repeat(Math.max(1, world.stats.wantedPeak))}`],
    ];

    for (let i = 0; i < statsRows.length; i += 1) {
      const sx = px + 44 + (i % 2) * 296;
      const sy = py + 158 + Math.floor(i / 2) * 64;
      drawPanel(ctx, sx, sy, 276, 52, 8, 'rgba(255,255,255,0.06)');
      drawLabel(ctx, statsRows[i][0], sx + 14, sy + 20, `700 11px ${MONO_FONT}`, COLORS.hudMuted);
      drawLabel(ctx, statsRows[i][1], sx + 14, sy + 42, `700 19px ${MONO_FONT}`, COLORS.hudText);
    }

    const btnY = py + ph - 76;
    drawButton(ctx, 'continue_after_results', px + 104, btnY, 210, 48, 8, 'CONTINUE', COLORS.hudAccent, '#0b111c', `800 17px ${UI_FONT}`);
    drawButton(ctx, 'restart_game', px + 346, btnY, 210, 48, 8, 'RESTART', 'rgba(255,255,255,0.12)', '#ffffff', `800 17px ${UI_FONT}`, COLORS.hudBorder);
  }

  function renderHud(ctx, world, screen, hasSave, time) {
    buttons.length = 0;

    if (screen === SCREEN_TITLE) {
      drawTitleScreen(ctx, hasSave, world.audio?.isMuted());
      return;
    }
    if (screen === SCREEN_SHOP) {
      drawShopOverlay(ctx, world);
      return;
    }
    if (screen === SCREEN_PAUSED) {
      drawPauseOverlay(ctx, world);
      return;
    }
    if (screen === SCREEN_RESULTS) {
      drawResultsScreen(ctx, world, world.missions.state.lastResult);
      return;
    }

    drawMinimap(ctx, world, time);
    drawTopRightStats(ctx, world, time);
    drawBottomTrackers(ctx, world);
  }

  return {
    renderHud,
    hitTestButton,
  };
}
