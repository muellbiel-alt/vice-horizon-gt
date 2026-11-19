// Economy controller: Vega Safehouse, Costa Customs garage tuning & respray, Armory Depot, and 4-district reputation.

import { ARMORY_UPGRADES, GARAGE_MODS, GARAGE_PAINTS, PLAYER_SPEC, WEAPONS } from '../core/config.js';
import { clamp } from '../core/random.js';

export function createEconomySystem() {
  const reputation = { palm: 15, downtown: 10, industrial: 10, harbor: 15 };

  function addReputation(distId, amount) {
    if (!(distId in reputation)) return 0;
    const prev = reputation[distId];
    reputation[distId] = clamp(prev + amount, 0, 100);
    return reputation[distId] - prev;
  }

  const getTotalReputation = () => Math.round((reputation.palm + reputation.downtown + reputation.industrial + reputation.harbor) / 4);
  const getStreetRank = () => {
    const a = getTotalReputation();
    return a >= 85 ? 'BAY KINGPIN' : a >= 65 ? 'SYNDICATE BOSS' : a >= 45 ? 'HEATLINE PRO' : a >= 25 ? 'STREET RUNNER' : 'ROOKIE';
  };
  const priceFor = (base, distId) => Math.max(25, Math.round((base * (1 - Math.min(0.15, ((reputation[distId] ?? 0) / 100) * 0.15))) / 5) * 5);

  function buyWeaponOrAmmo(world, weaponId) {
    const p = world.player; const dist = world.city.getDistrictAt(p.x, p.y).id;
    const w = WEAPONS.find((i) => i.id === weaponId); if (!w) return { ok: false, msg: 'Unknown weapon' };
    const slot = p.arsenal[w.id];
    const cost = priceFor(slot.owned ? w.ammoCost : w.cost, dist);
    if (p.cash < cost) return { ok: false, msg: `Need $${cost}` };
    p.cash -= cost;
    if (!slot.owned) { slot.owned = true; slot.mag = w.magSize; slot.reserve = w.magSize * 4; p.weaponIndex = w.slot - 1; }
    else slot.reserve += w.magSize * 3;
    world.audio?.playCash();
    return { ok: true, msg: slot.owned ? `Bought ${w.name}` : `+Ammo ${w.name}` };
  }

  function buyArmoryGear(world, id) {
    const p = world.player; const dist = world.city.getDistrictAt(p.x, p.y).id;
    const u = ARMORY_UPGRADES.find((i) => i.id === id); if (!u) return { ok: false, msg: 'Unknown gear' };
    if (u.kind === 'damage' && p.upgrades.damage) return { ok: false, msg: 'Already owned' };
    const cost = priceFor(u.cost, dist); if (p.cash < cost) return { ok: false, msg: `Need $${cost}` };
    p.cash -= cost;
    if (u.kind === 'armor') p.armor = PLAYER_SPEC.maxArmor;
    else if (u.kind === 'heal') p.hp = PLAYER_SPEC.maxHp;
    else if (u.kind === 'damage') p.upgrades.damage = true;
    world.audio?.playCash();
    return { ok: true, msg: u.name };
  }

  function buyGarageMod(world, id) {
    const p = world.player; const dist = world.city.getDistrictAt(p.x, p.y).id;
    const m = GARAGE_MODS.find((i) => i.id === id); if (!m) return { ok: false, msg: 'Unknown mod' };
    if (p.upgrades[m.kind]) return { ok: false, msg: 'Already installed' };
    const cost = priceFor(m.cost, dist); if (p.cash < cost) return { ok: false, msg: `Need $${cost}` };
    p.cash -= cost; p.upgrades[m.kind] = true;
    if (p.inVehicle && p.vehicle) world.vehicles.applyGarageTuning(p.vehicle, p.upgrades, p.preferredPaint);
    world.audio?.playCash();
    return { ok: true, msg: `Installed ${m.name}` };
  }

  function resprayAndRepair(world, paintId = null) {
    const p = world.player;
    const paint = paintId ? GARAGE_PAINTS.find((pt) => pt.id === paintId) : null;
    const wanted = world.police.state.wantedLevel;
    const fee = wanted > 0 ? 250 : paint ? 150 : 0;
    if (p.cash < fee) return { ok: false, msg: `Need $${fee}` };
    p.cash -= fee;
    if (paint) p.preferredPaint = paint.color;
    if (p.inVehicle && p.vehicle) {
      world.vehicles.repairAndRespray(p.vehicle, paint ? paint.color : null);
      world.vehicles.applyGarageTuning(p.vehicle, p.upgrades, p.preferredPaint);
    }
    if (wanted > 0) { world.police.clearWanted(); addReputation('industrial', 5); }
    world.audio?.playCash();
    return { ok: true, msg: wanted > 0 ? 'Resprayed · Heat Cleared' : paint ? `Painted ${paint.label}` : 'Vehicle Repaired' };
  }

  function restAtSafehouse(world, slotId = 'autosave') {
    world.player.hp = PLAYER_SPEC.maxHp;
    world.storage.saveSlot(world, slotId);
    world.audio?.playCash();
    return { ok: true, msg: `Rested & saved (${slotId})` };
  }

  return {
    reputation, addReputation, getTotalReputation, getStreetRank, priceFor,
    buyWeaponOrAmmo, buyArmoryGear, buyGarageMod, resprayAndRepair, restAtSafehouse,
    reset: () => Object.assign(reputation, { palm: 15, downtown: 10, industrial: 10, harbor: 15 }),
  };
}
