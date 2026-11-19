// Studio menu overlays: Title Cover, Costa Customs Garage & Armory tabs, Pause & Save Slots, Results Debrief.

import { ARMORY_UPGRADES, COLORS, GARAGE_MODS, GARAGE_PAINTS, MONO_FONT, UI_FONT, VIEW, WEAPONS } from '../core/config.js';
import { SAVE_SLOTS } from '../core/storage.js';

export function createMenuRenderer({ drawPanel: P, drawLabel: T, drawButton: B }) {
  const F = (sz, w = 700) => `${w} ${sz}px ${UI_FONT}`;
  const M = (sz, w = 700) => `${w} ${sz}px ${MONO_FONT}`;

  function drawTitleScreen(ctx, hasSave, isMuted) {
    const g = ctx.createLinearGradient(0, 0, 740, 0);
    g.addColorStop(0, 'rgba(7,12,21,0.92)'); g.addColorStop(0.55, 'rgba(7,12,21,0.72)'); g.addColorStop(1, 'rgba(7,12,21,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 740, VIEW.height);

    const lx = 58, by = 368;
    P(ctx, lx, 140, 242, 26, 5, 'rgba(247,165,49,0.16)', 'rgba(247,165,49,0.45)', 1);
    T(ctx, 'SOLARA BAY · HEATLINE V2', lx + 12, 157, M(11), COLORS.hudAmber);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 18;
    T(ctx, 'SOLARA BAY', lx, 232, F(66, 800), '#ffffff');
    T(ctx, 'HEATLINE', lx, 282, F(44, 800), COLORS.hudAccent);
    ctx.restore();
    T(ctx, 'Four coastal districts. Five heat levels. Own the night.', lx, 322, F(16, 500), '#d4deec');

    if (hasSave) {
      B(ctx, 'new_game', lx, by, 134, 50, 8, 'PLAY', COLORS.hudAccent, '#070c15', F(17, 800));
      B(ctx, 'continue_game', lx + 148, by, 156, 50, 8, 'CONTINUE', 'rgba(40,199,183,0.2)', '#e8fffc', F(17, 800), COLORS.hudTeal);
      B(ctx, 'open_garage_from_title', lx + 318, by, 136, 50, 8, 'GARAGE', 'rgba(255,255,255,0.1)', '#ffffff', F(17, 800), COLORS.hudBorder);
    } else {
      B(ctx, 'new_game', lx, by, 190, 52, 8, 'PLAY', COLORS.hudAccent, '#070c15', F(18, 800));
      B(ctx, 'open_garage_from_title', lx + 206, by, 154, 52, 8, 'GARAGE', 'rgba(255,255,255,0.1)', '#ffffff', F(18, 800), COLORS.hudBorder);
    }
    B(ctx, 'toggle_mute', lx, by + 68, 154, 36, 6, isMuted ? '[M] AUDIO: OFF' : '[M] AUDIO: ON', 'rgba(8,13,22,0.85)', COLORS.hudText, M(12), 'rgba(255,255,255,0.2)');

    ctx.fillStyle = 'rgba(7,12,21,0.88)'; ctx.fillRect(0, VIEW.height - 48, VIEW.width, 48);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(0, VIEW.height - 48); ctx.lineTo(VIEW.width, VIEW.height - 48); ctx.stroke();
    T(ctx, 'WASD Move / Drive   ·   LMB Aim & Fire   ·   E Hijack / Interact   ·   SPACE Drift / Dodge   ·   1-4 Weapons   ·   B Armory   ·   G Garage   ·   P Pause', VIEW.width * 0.5, VIEW.height - 19, M(12, 600), '#d9e3f0', 'center');
  }

  function drawShopOrGarageOverlay(ctx, world, activeTab) {
    ctx.fillStyle = 'rgba(6,10,18,0.82)'; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const pw = 860, ph = 540, px = (VIEW.width - pw) * 0.5, py = (VIEW.height - ph) * 0.5;
    const dist = world.city.getDistrictAt(world.player.x, world.player.y), isG = activeTab === 'garage';

    P(ctx, px, py, pw, ph, 14, COLORS.hudPanelSolid, isG ? COLORS.hudTeal : COLORS.hudAccent, 2);
    B(ctx, 'switch_tab_armory', px + 28, py + 22, 210, 38, 8, '[B] ARMORY DEPOT', !isG ? COLORS.hudAccent : 'rgba(255,255,255,0.08)', !isG ? '#070c15' : COLORS.hudText, F(14, 800));
    B(ctx, 'switch_tab_garage', px + 250, py + 22, 235, 38, 8, '[G] COSTA CUSTOMS GARAGE', isG ? COLORS.hudTeal : 'rgba(255,255,255,0.08)', isG ? '#070c15' : COLORS.hudText, F(14, 800));
    T(ctx, `CASH $${world.player.cash.toLocaleString()}`, px + pw - 28, py + 42, M(22), '#37c978', 'right');
    T(ctx, `${dist.name.toUpperCase()} REP ${world.economy.reputation[dist.id] ?? 0}%`, px + pw - 28, py + 62, M(11, 600), COLORS.hudMuted, 'right');

    if (!isG) {
      T(ctx, 'FIREARMS & AMMO', px + 28, py + 94, M(12), COLORS.hudMuted);
      WEAPONS.forEach((w, i) => {
        const s = world.player.arsenal[w.id], iy = py + 110 + i * 78, p = world.economy.priceFor(s.owned ? w.ammoCost : w.cost, dist.id), ok = world.player.cash >= p;
        P(ctx, px + 28, iy, 390, 66, 8, 'rgba(255,255,255,0.05)');
        T(ctx, `[${w.slot}] ${w.name}`, px + 44, iy + 28, F(17), w.color);
        T(ctx, `DMG ${w.damage} · MAG ${w.magSize} · AMMO ${s.mag + s.reserve}`, px + 44, iy + 50, M(12, 600), COLORS.hudMuted);
        B(ctx, 'buy_weapon', px + 306, iy + 15, 98, 36, 6, s.owned ? `AMMO $${p}` : `BUY $${p}`, ok ? COLORS.hudAccent : '#2d3748', ok ? '#070c15' : '#8090a6', M(12), null, w.id);
      });
      T(ctx, 'TACTICAL GEAR', px + 446, py + 94, M(12), COLORS.hudMuted);
      ARMORY_UPGRADES.forEach((u, i) => {
        const iy = py + 110 + i * 74, own = u.kind === 'damage' && world.player.upgrades.damage, p = world.economy.priceFor(u.cost, dist.id), ok = !own && world.player.cash >= p;
        P(ctx, px + 446, iy, 386, 60, 8, 'rgba(255,255,255,0.05)');
        T(ctx, u.name, px + 462, iy + 36, F(15), COLORS.hudText);
        B(ctx, 'buy_armory', px + 722, iy + 13, 96, 34, 6, own ? 'OWNED' : `$${p}`, own ? COLORS.hudTeal : ok ? COLORS.hudAccent : '#2d3748', own || ok ? '#070c15' : '#8090a6', M(12), null, u.id);
      });
    } else {
      T(ctx, 'PERFORMANCE TUNING', px + 28, py + 94, M(12), COLORS.hudMuted);
      GARAGE_MODS.forEach((m, i) => {
        const iy = py + 110 + i * 78, own = Boolean(world.player.upgrades[m.kind]), p = world.economy.priceFor(m.cost, dist.id), ok = !own && world.player.cash >= p;
        P(ctx, px + 28, iy, 400, 64, 8, 'rgba(255,255,255,0.05)');
        T(ctx, m.name, px + 44, iy + 38, F(16), COLORS.hudText);
        B(ctx, 'buy_garage_mod', px + 312, iy + 14, 102, 36, 6, own ? 'INSTALLED' : `$${p}`, own ? COLORS.hudTeal : ok ? COLORS.hudAmber : '#2d3748', own || ok ? '#070c15' : '#8090a6', M(12), null, m.id);
      });
      T(ctx, 'RESPRAY & HEAT CLEAR', px + 454, py + 94, M(12), COLORS.hudMuted);
      P(ctx, px + 454, py + 110, 378, 128, 8, 'rgba(255,255,255,0.05)');
      const h = world.police.state.wantedLevel;
      T(ctx, h > 0 ? `ACTIVE HEAT: ${h} STARS` : 'CHASSIS SERVICE READY', px + 470, py + 140, M(14), h > 0 ? COLORS.hudDanger : COLORS.hudTeal);
      T(ctx, 'Respray drops police heat and restores vehicle chassis.', px + 470, py + 166, F(13, 500), COLORS.hudMuted);
      B(ctx, 'garage_respray', px + 470, py + 184, 346, 38, 6, h > 0 ? 'REPAIR & CLEAR HEAT ($250)' : 'REPAIR CURRENT RIDE (FREE)', COLORS.hudTeal, '#070c15', M(13, 800));
      T(ctx, 'CUSTOM PAINT SWATCHES ($150)', px + 454, py + 266, M(12), COLORS.hudMuted);
      GARAGE_PAINTS.forEach((pt, i) => B(ctx, 'garage_paint', px + 454 + (i % 2) * 194, py + 282 + Math.floor(i / 2) * 52, 184, 42, 6, pt.label.toUpperCase(), 'rgba(255,255,255,0.07)', '#ffffff', M(12), pt.color, pt.id));
    }
    B(ctx, 'close_shop', px + pw - 168, py + ph - 56, 140, 38, 8, '[ESC] CLOSE', 'rgba(255,255,255,0.12)', '#ffffff', M(13));
  }

  function drawPauseOverlay(ctx, world) {
    ctx.fillStyle = 'rgba(6,10,18,0.78)'; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const pw = 460, ph = 420, px = (VIEW.width - pw) * 0.5, py = (VIEW.height - ph) * 0.5;
    P(ctx, px, py, pw, ph, 14, COLORS.hudPanelSolid, COLORS.hudBorder, 2);
    T(ctx, 'PAUSED', px + pw * 0.5, py + 52, F(32, 800), '#ffffff', 'center');
    B(ctx, 'resume_game', px + 44, py + 76, pw - 88, 42, 8, 'RESUME GAME', COLORS.hudAccent, '#070c15', F(15, 800));
    T(ctx, 'SAFEHOUSE SAVE SLOTS', px + 44, py + 144, M(11), COLORS.hudMuted);
    SAVE_SLOTS.forEach((slot, i) => {
      const meta = world.storage.readSlotMeta(slot), sy = py + 156 + i * 48;
      P(ctx, px + 44, sy, pw - 88, 40, 6, 'rgba(255,255,255,0.06)');
      T(ctx, `${slot.toUpperCase()}  ${meta ? `$${meta.cash.toLocaleString()} · ${meta.missionsCleared}/5` : 'EMPTY'}`, px + 56, sy + 24, M(12, 600), COLORS.hudText);
      B(ctx, 'save_slot', px + pw - 190, sy + 6, 66, 28, 5, 'SAVE', COLORS.hudTeal, '#070c15', M(11), null, slot);
      B(ctx, 'load_slot', px + pw - 118, sy + 6, 66, 28, 5, 'LOAD', meta ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)', meta ? '#ffffff' : '#64748b', M(11), null, slot);
    });
    B(ctx, 'toggle_mute', px + 44, py + 310, 178, 38, 8, world.audio?.isMuted() ? 'AUDIO: OFF' : 'AUDIO: ON', 'rgba(255,255,255,0.1)', '#ffffff', M(13));
    B(ctx, 'restart_game', px + 236, py + 310, 180, 38, 8, 'RESTART', 'rgba(240,75,76,0.2)', '#ffd4d4', M(13), COLORS.hudDanger);
  }

  function drawResultsScreen(ctx, world, res) {
    ctx.fillStyle = 'rgba(6,10,18,0.78)'; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const pw = 680, ph = 496, px = (VIEW.width - pw) * 0.5, py = (VIEW.height - ph) * 0.5, ok = res?.outcome !== 'DOWNED';
    P(ctx, px, py, pw, ph, 14, COLORS.hudPanelSolid, ok ? COLORS.hudAmber : COLORS.hudDanger, 2.5);
    T(ctx, ok ? `CONTRACT CLEARED · ${res?.district ?? 'DOWNTOWN NEON'}` : 'MEDICAL EVAC · DOWNED', VIEW.width * 0.5, py + 42, M(12), ok ? '#37c978' : COLORS.hudDanger, 'center');
    T(ctx, res?.title?.toUpperCase() ?? 'NEON VAULT HEIST', VIEW.width * 0.5, py + 84, F(38, 800), '#ffffff', 'center');
    T(ctx, ok ? `+$${(res?.reward ?? 4800).toLocaleString()} CASH   ·   +${res?.repGain ?? 30} DISTRICT REP` : 'HOSPITAL FEE -$250', VIEW.width * 0.5, py + 122, M(22, 800), ok ? COLORS.hudAmber : COLORS.hudMuted, 'center');
    T(ctx, `STREET RANK: ${res?.rank ?? world.economy.getStreetRank()} (${world.economy.getTotalReputation()}% BAY CONTROL)`, VIEW.width * 0.5, py + 148, M(12), COLORS.hudTeal, 'center');

    [['TOTAL CASH', `$${world.player.cash.toLocaleString()}`], ['CONTRACTS CLEARED', `${world.stats.missionsCleared} / 5`], ['SYNDICATE TAKEDOWNS', `${world.stats.takedowns}`], ['VEHICLES HIJACKED', `${world.stats.carsStolen}`], ['PURSUITS EVADED', `${world.stats.chasesEvaded}`], ['PEAK WANTED LEVEL', '★'.repeat(Math.max(1, world.stats.wantedPeak))]].forEach(([k, v], i) => {
      const sx = px + 44 + (i % 2) * 304, sy = py + 174 + Math.floor(i / 2) * 66;
      P(ctx, sx, sy, 286, 54, 8, 'rgba(255,255,255,0.06)'); T(ctx, k, sx + 14, sy + 20, M(10), COLORS.hudMuted); T(ctx, v, sx + 14, sy + 43, M(20), COLORS.hudText);
    });
    B(ctx, 'continue_after_results', px + 114, py + ph - 74, 212, 48, 8, 'CONTINUE', COLORS.hudAccent, '#070c15', F(17, 800));
    B(ctx, 'restart_game', px + 354, py + ph - 74, 212, 48, 8, 'RESTART', 'rgba(255,255,255,0.1)', '#ffffff', F(17, 800), COLORS.hudBorder);
  }

  return { drawTitleScreen, drawShopOrGarageOverlay, drawPauseOverlay, drawResultsScreen };
}
