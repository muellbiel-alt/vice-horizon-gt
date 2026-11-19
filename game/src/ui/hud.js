// In-game HUD coordinator: Minimap Radar, Wanted Stars, Weapon & Economy telemetry, Mission Tracker, Speedometer, and Menus.

import { COLORS, MONO_FONT, PLAYER_SPEC, UI_FONT, VIEW, WEAPONS } from '../core/config.js';
import { clamp } from '../core/random.js';
import { drawMinimap } from './minimap.js';
import { createMenuRenderer } from './menus.js';

export const SCREEN_TITLE = 'title', SCREEN_PLAY = 'play', SCREEN_PAUSED = 'paused', SCREEN_SHOP = 'shop', SCREEN_GARAGE = 'garage', SCREEN_RESULTS = 'results';

export function createHudRenderer() {
  const buttons = [];
  const drawPanel = (ctx, x, y, w, h, r, fill, border = null, lw = 1.5) => {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = lw; ctx.stroke(); }
  };
  const drawLabel = (ctx, text, x, y, font, color, align = 'left') => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text, x, y); };
  const drawButton = (ctx, id, x, y, w, h, r, label, bg, fg, font, border = null, data = null) => {
    drawPanel(ctx, x, y, w, h, r, bg, border, 1.5);
    drawLabel(ctx, label, x + w * 0.5, y + h * 0.5 + 5, font, fg, 'center');
    buttons.push({ id, x, y, w, h, data });
  };

  const menus = createMenuRenderer({ drawPanel, drawLabel, drawButton });

  function drawStar(ctx, cx, cy, r, filled, color) {
    ctx.save(); ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const rad = i % 2 === 0 ? r : r * 0.44, a = -1.5708 + (i * Math.PI) / 5;
      i === 0 ? ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad) : ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fillStyle = filled ? color : 'rgba(255,255,255,0.14)'; ctx.fill();
    ctx.strokeStyle = filled ? '#070c15' : 'rgba(255,255,255,0.24)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  }

  function drawTopRightStats(ctx, world, time) {
    const rx = VIEW.width - 22, topY = 20, wanted = world.police.state.wantedLevel, bx = rx - 280, bw = 266;
    drawPanel(ctx, rx - 294, topY - 4, 298, 138, 10, COLORS.hudPanel, COLORS.hudBorder);
    const starCol = Math.sin(time * 10) > 0 ? COLORS.hudDanger : COLORS.hudPoliceBlue;
    for (let s = 0; s < 5; s += 1) drawStar(ctx, rx - 270 + s * 28, topY + 20, 10.5, s < wanted, wanted > 0 ? starCol : COLORS.hudAmber);

    if (wanted > 0 && !world.police.state.spotted) {
      drawLabel(ctx, 'EVADING', rx - 14, topY + 14, `700 10px ${MONO_FONT}`, COLORS.hudPoliceBlue, 'right');
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(rx - 94, topY + 22, 80, 4);
      ctx.fillStyle = COLORS.hudTeal; ctx.fillRect(rx - 94, topY + 22, 80 * clamp(world.police.state.evadeTimer / world.police.state.evadeDuration, 0, 1), 4);
    } else drawLabel(ctx, wanted >= 4 ? `LOCKDOWN · ${wanted}★` : wanted > 0 ? `HEAT LVL ${wanted}` : world.economy.getStreetRank(), rx - 14, topY + 24, `700 10px ${MONO_FONT}`, wanted > 0 ? COLORS.hudDanger : COLORS.hudTeal, 'right');

    drawLabel(ctx, `$${world.player.cash.toLocaleString()}`, bx, topY + 58, `700 22px ${MONO_FONT}`, '#37c978');
    const w = WEAPONS[world.player.weaponIndex], slot = world.player.arsenal[w.id];
    drawLabel(ctx, `[${w.slot}] ${w.short}`, rx - 14, topY + 49, `700 13px ${UI_FONT}`, w.color, 'right');
    drawLabel(ctx, world.player.reloadTimer > 0 ? 'RELOAD...' : `${slot.mag}/${slot.reserve}`, rx - 14, topY + 64, `600 12px ${MONO_FONT}`, world.player.reloadTimer > 0 ? COLORS.hudAmber : COLORS.hudText, 'right');

    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(bx, topY + 76, bw, 10); ctx.fillRect(bx, topY + 92, bw, 8);
    ctx.fillStyle = COLORS.hudHp; ctx.fillRect(bx, topY + 76, bw * clamp(world.player.hp / PLAYER_SPEC.maxHp, 0, 1), 10);
    ctx.fillStyle = COLORS.hudArmor; ctx.fillRect(bx, topY + 92, bw * clamp(world.player.armor / PLAYER_SPEC.maxArmor, 0, 1), 8);
    drawLabel(ctx, `HP ${Math.ceil(world.player.hp)}`, bx + 5, topY + 84, `700 9px ${MONO_FONT}`, '#070c15');
    drawLabel(ctx, `ARM ${Math.ceil(world.player.armor)}`, bx + 5, topY + 99, `700 9px ${MONO_FONT}`, COLORS.hudText);

    [['open_shop', '[B] ARMS'], ['open_garage', '[G] TUNE'], ['side_contract', '[N] JOB'], ['toggle_mute', world.audio?.isMuted() ? '[M] OFF' : '[M] SFX'], ['pause_game', '[P] MENU']].forEach(([id, lbl], i) => {
      drawButton(ctx, id, bx + i * 54, topY + 109, 50, 19, 3, lbl, 'rgba(255,255,255,0.08)', COLORS.hudText, `700 8.5px ${MONO_FONT}`);
    });
  }

  function drawBottomTrackers(ctx, world) {
    const m = world.missions.currentMission(), st = world.missions.currentStep();
    if (m && st) {
      drawPanel(ctx, 22, VIEW.height - 96, 405, 74, 10, COLORS.hudPanel, COLORS.hudBorder);
      drawLabel(ctx, `MISSION · ${m.title.toUpperCase()} (+$${m.reward})`, 36, VIEW.height - 74, `700 11px ${MONO_FONT}`, COLORS.hudAmber);
      drawLabel(ctx, st.label, 36, VIEW.height - 50, `600 15.5px ${UI_FONT}`, COLORS.hudText);
      drawLabel(ctx, `${Math.round(Math.hypot(st.x - world.player.x, st.y - world.player.y) / 8)}m AWAY · +${m.repReward ?? 15} REP`, 36, VIEW.height - 32, `700 11px ${MONO_FONT}`, COLORS.hudTeal);
    }
    if (world.missions.state.dialogueTimer > 0 && world.missions.state.dialogueText) {
      const dx = VIEW.width * 0.5 - 282;
      drawPanel(ctx, dx, 20, 540, 56, 8, 'rgba(8,13,22,0.9)', 'rgba(40,199,183,0.48)');
      drawLabel(ctx, `RADIO · ${world.missions.state.dialogueSpeaker}`, dx + 16, 40, `700 11px ${MONO_FONT}`, COLORS.hudTeal);
      drawLabel(ctx, world.missions.state.dialogueText, dx + 16, 62, `500 14px ${UI_FONT}`, COLORS.hudText);
    }
    if (world.player.inVehicle && world.player.vehicle) {
      const v = world.player.vehicle, sx = VIEW.width - 252, sy = VIEW.height - 94, r = clamp(v.hp / v.maxHp, 0, 1);
      drawPanel(ctx, sx, sy, 230, 72, 10, COLORS.hudPanel, COLORS.hudBorder);
      drawLabel(ctx, v.spec.name.toUpperCase(), sx + 14, sy + 22, `700 12px ${UI_FONT}`, COLORS.hudAmber);
      drawLabel(ctx, v.punctureTimer > 0 ? 'TIRES HIT' : world.player.upgrades.turbo ? 'TURBO' : v.spec.category.toUpperCase(), sx + 14, sy + 39, `700 10px ${MONO_FONT}`, v.punctureTimer > 0 ? COLORS.hudDanger : COLORS.hudCyan);
      drawLabel(ctx, `${Math.round(v.speed * 0.24)} MPH`, sx + 216, sy + 42, `700 24px ${MONO_FONT}`, COLORS.hudText, 'right');
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(sx + 14, sy + 54, 202, 6);
      ctx.fillStyle = r > 0.35 ? COLORS.hudTeal : COLORS.hudDanger; ctx.fillRect(sx + 14, sy + 54, 202 * r, 6);
    }
  }

  return {
    hitTestButton: (x, y) => { for (let i = buttons.length - 1; i >= 0; i -= 1) { const b = buttons[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b; } return null; },
    renderHud: (ctx, world, screen, hasSave, time) => {
      buttons.length = 0;
      if (screen === SCREEN_TITLE) return menus.drawTitleScreen(ctx, hasSave, world.audio?.isMuted());
      if (screen === SCREEN_SHOP) return menus.drawShopOrGarageOverlay(ctx, world, 'armory');
      if (screen === SCREEN_GARAGE) return menus.drawShopOrGarageOverlay(ctx, world, 'garage');
      if (screen === SCREEN_PAUSED) return menus.drawPauseOverlay(ctx, world);
      if (screen === SCREEN_RESULTS) return menus.drawResultsScreen(ctx, world, world.missions.state.lastResult);
      drawMinimap(ctx, world, time); drawTopRightStats(ctx, world, time); drawBottomTrackers(ctx, world);
    },
  };
}
