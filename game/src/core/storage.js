// Multi-slot Save/Load persistence and career telemetry storage (autosave, slot1, slot2).

import { PLAYER_SPEC, SAVE_PREFIX } from './config.js';
import { clamp } from './random.js';

export const SAVE_SLOTS = ['autosave', 'slot1', 'slot2'];

export function createStorageManager() {
  const key = (id) => `${SAVE_PREFIX}${id}`;

  function saveSlot(world, slotId = 'autosave') {
    try {
      const payload = {
        version: 2, cash: world.player.cash, hp: world.player.hp, armor: world.player.armor,
        weaponIndex: world.player.weaponIndex, arsenal: world.player.arsenal,
        upgrades: { ...world.player.upgrades }, preferredPaint: world.player.preferredPaint,
        storyIndex: world.missions.state.storyIndex, reputation: { ...world.economy.reputation }, stats: { ...world.stats },
      };
      window.localStorage.setItem(key(slotId), JSON.stringify(payload));
      return true;
    } catch { return false; }
  }

  function readSlotMeta(slotId = 'autosave') {
    try {
      const raw = window.localStorage.getItem(key(slotId));
      if (!raw) return null;
      const d = JSON.parse(raw);
      return { slotId, cash: d.cash ?? 0, storyIndex: d.storyIndex ?? 0, missionsCleared: d.stats?.missionsCleared ?? 0 };
    } catch { return null; }
  }

  function loadSlot(world, slotId = 'autosave') {
    try {
      const raw = window.localStorage.getItem(key(slotId));
      if (!raw) return false;
      const d = JSON.parse(raw);
      world.reset();
      if (typeof d.cash === 'number') world.player.cash = d.cash;
      if (typeof d.hp === 'number') world.player.hp = clamp(d.hp, 25, PLAYER_SPEC.maxHp);
      if (typeof d.armor === 'number') world.player.armor = clamp(d.armor, 0, PLAYER_SPEC.maxArmor);
      if (d.arsenal) world.player.arsenal = d.arsenal;
      if (d.upgrades) Object.assign(world.player.upgrades, d.upgrades);
      if (d.preferredPaint) world.player.preferredPaint = d.preferredPaint;
      if (d.reputation) Object.assign(world.economy.reputation, d.reputation);
      if (typeof d.weaponIndex === 'number') world.player.weaponIndex = d.weaponIndex;
      if (typeof d.storyIndex === 'number') {
        world.missions.state.storyIndex = clamp(d.storyIndex, 0, 5);
        world.missions.state.stepIndex = 0;
        world.missions.setupStep();
      }
      if (d.stats) Object.assign(world.stats, d.stats);
      return true;
    } catch { return false; }
  }

  return { saveSlot, loadSlot, readSlotMeta, hasAnySave: () => SAVE_SLOTS.some((s) => Boolean(readSlotMeta(s))) };
}
