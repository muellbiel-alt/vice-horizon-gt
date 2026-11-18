// Story campaign (5 multi-stage missions), repeatable side contracts, Armory & Upgrade shop,
// and Safehouse/Garage world interactions for Solara Bay: Heatline.

import { PLAYER_SPEC, SHOP_UPGRADES, WEAPONS } from './config.js';
import { clamp } from './random.js';

export const STORY_MISSIONS = [
  {
    id: 'm1_ignition',
    title: 'Dockside Ignition',
    speaker: 'ELENA SOLIS',
    intro: 'Grab a fast V8 or coupe on Meridian Ave and deliver it to Pier 1.',
    reward: 1200,
    steps: [
      { label: 'Steal a Solara V8 or Kestrel GT', x: 1465, y: 1140, type: 'get_fast_car' },
      { label: 'Deliver the car to Harbor Pier 1', x: 2520, y: 2040, type: 'reach_in_car' },
    ],
  },
  {
    id: 'm2_signal',
    title: 'Signal Jam',
    speaker: 'ELENA SOLIS',
    intro: 'Iron Tide stashed harbor manifests in Industrial Yard. Clear the guards.',
    reward: 2000,
    steps: [
      { label: 'Hit the Iron Tide cache in Industrial Yard', x: 2930, y: 620, type: 'clear_ambush', count: 4, wanted: 2 },
      { label: 'Lose the police or hit Costa Customs', x: 2930, y: 1215, type: 'evade_wanted' },
    ],
  },
  {
    id: 'm3_convoy',
    title: 'Armored Convoy',
    speaker: 'MARCO VEGA',
    intro: 'An Iron Tide Atlas Hauler is rolling down Palm Blvd. Hijack the payload.',
    reward: 3200,
    steps: [
      { label: 'Hijack the Atlas Hauler on Palm Boulevard', x: 460, y: 1180, type: 'hijack_target', wanted: 3 },
      { label: 'Deliver the payload to Downtown Armory', x: 1800, y: 1218, type: 'deliver_target' },
    ],
  },
  {
    id: 'm4_vault',
    title: 'Neon Vault Heist',
    speaker: 'ELENA SOLIS',
    intro: 'Storm Meridian Plaza, take the ledger crates, and break the SWAT cordon.',
    reward: 4800,
    steps: [
      { label: 'Clear Meridian Plaza vault guards', x: 1800, y: 600, type: 'clear_ambush', count: 5, wanted: 4 },
      { label: 'Collect all 3 ledger crates at the plaza', x: 1800, y: 600, type: 'collect_crates', count: 3 },
      { label: 'Escape the lockdown to Vega Safehouse', x: 720, y: 635, type: 'reach_point' },
    ],
  },
  {
    id: 'm5_endgame',
    title: 'Pier Endgame',
    speaker: 'VICTOR KROLL',
    intro: 'Victor Kroll is boarding the freighter at Pier 2. End the Iron Tide.',
    reward: 8000,
    steps: [
      { label: 'Take down Victor Kroll at Harbor Pier 2', x: 3015, y: 2240, type: 'kill_boss', count: 5, wanted: 5 },
      { label: 'Break out to Palm Boulevard Boardwalk', x: 460, y: 1940, type: 'reach_point' },
    ],
  },
];

export function createMissionSystem(city, vehicleMgr, combat, police, rand) {
  const crates = [];
  const state = {
    storyIndex: 0,
    stepIndex: 0,
    activeSide: null,
    sideStep: 0,
    sideTimer: 0,
    missionActive: true,
    storyComplete: false,
    targetVehicle: null,
    spawnedForStep: false,
    dialogueSpeaker: 'ELENA SOLIS',
    dialogueText: STORY_MISSIONS[0].intro,
    dialogueTimer: 6.5,
    lastResult: null,
  };

  function setDialogue(speaker, text, duration = 5.5) {
    state.dialogueSpeaker = speaker;
    state.dialogueText = text;
    state.dialogueTimer = duration;
  }

  function currentMission() {
    if (state.activeSide) return state.activeSide;
    if (state.storyIndex >= STORY_MISSIONS.length) return null;
    return STORY_MISSIONS[state.storyIndex];
  }

  function currentStep() {
    const m = currentMission();
    if (!m) return null;
    const idx = state.activeSide ? state.sideStep : state.stepIndex;
    return m.steps[idx] ?? null;
  }

  function getWaypoint() {
    if (state.targetVehicle && !state.targetVehicle.exploded && state.targetVehicle.driver !== 'player') {
      return { x: state.targetVehicle.x, y: state.targetVehicle.y, label: currentStep()?.label ?? 'Target' };
    }
    if (crates.length > 0) {
      return { x: crates[0].x, y: crates[0].y, label: currentStep()?.label ?? 'Crate' };
    }
    if (combat.enemies.length > 0) {
      const e = combat.enemies[0];
      return { x: e.x, y: e.y, label: currentStep()?.label ?? 'Eliminate' };
    }
    const step = currentStep();
    if (!step) return null;
    return { x: step.x, y: step.y, label: step.label };
  }

  function cleanupStepEntities() {
    crates.length = 0;
    state.targetVehicle = null;
    state.spawnedForStep = false;
  }

  function setupStep(world) {
    cleanupStepEntities();
    const step = currentStep();
    if (!step) return;

    if (step.type === 'clear_ambush') {
      const count = step.count ?? 4;
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2;
        const ex = clamp(step.x + Math.cos(a) * 85, 420, 3420);
        const ey = clamp(step.y + Math.sin(a) * 85, 220, 2420);
        if (!city.isPointBlocked(ex, ey, 14)) {
          combat.spawnEnemy(ex, ey, i === 0 ? 'heavy' : 'enforcer', 'mission');
        }
      }
      state.spawnedForStep = true;
    } else if (step.type === 'kill_boss') {
      combat.spawnEnemy(step.x, step.y, 'boss', 'mission');
      const count = step.count ?? 4;
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2;
        const ex = clamp(step.x + Math.cos(a) * 90, 420, 3420);
        const ey = clamp(step.y + Math.sin(a) * 90, 220, 2420);
        if (!city.isPointBlocked(ex, ey, 14)) {
          combat.spawnEnemy(ex, ey, i % 2 === 0 ? 'heavy' : 'enforcer', 'mission');
        }
      }
      state.spawnedForStep = true;
    } else if (step.type === 'collect_crates') {
      const count = step.count ?? 3;
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2 + 0.4;
        crates.push({
          x: step.x + Math.cos(a) * 68,
          y: step.y + Math.sin(a) * 68,
          bob: i * 1.3,
        });
      }
      state.spawnedForStep = true;
    } else if (step.type === 'hijack_target') {
      const van = vehicleMgr.spawnVehicle('van', step.x, step.y, Math.PI * 0.5, {
        driver: 'convoy',
        color: '#2c3e50',
        missionTag: 'convoy',
        hp: 310,
      });
      state.targetVehicle = van;
      combat.spawnEnemy(step.x - 46, step.y + 30, 'heavy', 'mission');
      combat.spawnEnemy(step.x + 46, step.y - 30, 'enforcer', 'mission');
      state.spawnedForStep = true;
    }
  }

  function advanceStep(world) {
    const m = currentMission();
    if (!m) return;

    const prevStep = currentStep();
    if (prevStep?.wanted) {
      police.setMinimumWanted(prevStep.wanted, world.player.x, world.player.y);
    }

    if (state.activeSide) {
      state.sideStep += 1;
      if (state.sideStep >= m.steps.length) {
        completeMission(world, m);
      } else {
        setupStep(world);
      }
      return;
    }

    state.stepIndex += 1;
    if (state.stepIndex >= m.steps.length) {
      completeMission(world, m);
    } else {
      setupStep(world);
    }
  }

  function completeMission(world, m) {
    cleanupStepEntities();
    world.player.cash += m.reward;
    world.stats.cashEarned += m.reward;
    world.stats.missionsCleared += 1;
    world.audio?.playMissionClear();

    state.lastResult = {
      outcome: 'CLEARED',
      title: m.title,
      reward: m.reward,
      cashTotal: world.player.cash,
      missionsCleared: world.stats.missionsCleared,
      takedowns: world.stats.takedowns,
      chasesEvaded: world.stats.chasesEvaded,
      carsStolen: world.stats.carsStolen,
      wantedPeak: world.stats.wantedPeak,
    };

    if (state.activeSide) {
      state.activeSide = null;
      state.sideStep = 0;
      setDialogue('ELENA SOLIS', `Contract paid: +$${m.reward}. Ready for the next move.`, 5);
    } else {
      state.storyIndex += 1;
      state.stepIndex = 0;
      if (state.storyIndex >= STORY_MISSIONS.length) {
        state.storyComplete = true;
        police.clearWanted();
        setDialogue('ELENA SOLIS', 'Solara Bay belongs to you now, Marco. Take side contracts anytime.', 7);
      } else {
        const nextM = STORY_MISSIONS[state.storyIndex];
        setDialogue(nextM.speaker, nextM.intro, 6.5);
        setupStep(world);
      }
    }

    // Trigger summary overlay on final mission or story milestone
    if (m.id === 'm5_endgame' || m.showSummary) {
      world.onMissionResults?.(state.lastResult);
    } else {
      combat.spawnPopup(world.player.x, world.player.y - 34, `${m.title.toUpperCase()} +$${m.reward}`, '#ffd166');
    }
  }

  function startSideContract(world) {
    if (state.activeSide) return false;
    const templates = [
      {
        id: 'side_courier',
        title: 'Port Courier Run',
        speaker: 'ELENA SOLIS',
        intro: 'Hot package needs wheels to Harbor Pier 2 fast. Clock is ticking.',
        reward: 950,
        steps: [{ label: 'Race to Harbor Pier 2 Dropoff', x: 3000, y: 2150, type: 'reach_point' }],
      },
      {
        id: 'side_bounty',
        title: 'Foundry Street Bounty',
        speaker: 'MARCO VEGA',
        intro: 'Iron Tide gunmen set up an ambush in Industrial Yard. Wipe them out.',
        reward: 1150,
        steps: [{ label: 'Eliminate Iron Tide hit squad', x: 2740, y: 860, type: 'clear_ambush', count: 4, wanted: 1 }],
      },
      {
        id: 'side_boost',
        title: 'Midnight Boost',
        speaker: 'ELENA SOLIS',
        intro: 'Boost a Kestrel GT and bring it clean to Costa Customs.',
        reward: 1050,
        steps: [
          { label: 'Steal any Kestrel GT or Solara V8', x: 1520, y: 860, type: 'get_fast_car' },
          { label: 'Deliver ride to Costa Customs', x: 2930, y: 1215, type: 'reach_in_car' },
        ],
      },
    ];

    const pick = rand.pick(templates);
    state.activeSide = pick;
    state.sideStep = 0;
    setDialogue(pick.speaker, pick.intro, 5.5);
    setupStep(world);
    return true;
  }

  function buyItem(world, itemType, id) {
    const p = world.player;
    if (itemType === 'weapon') {
      const w = WEAPONS.find((item) => item.id === id);
      if (!w) return { ok: false, msg: 'Unknown weapon' };
      const slot = p.arsenal[w.id];
      if (!slot.owned) {
        if (p.cash < w.cost) return { ok: false, msg: `Need $${w.cost}` };
        p.cash -= w.cost;
        slot.owned = true;
        slot.mag = w.magSize;
        slot.reserve = w.magSize * 4;
        p.weaponIndex = w.slot - 1;
        world.audio?.playCash();
        return { ok: true, msg: `Bought ${w.name}` };
      }
      if (p.cash < w.ammoCost) return { ok: false, msg: `Need $${w.ammoCost}` };
      p.cash -= w.ammoCost;
      slot.reserve += w.magSize * 3;
      world.audio?.playCash();
      return { ok: true, msg: `+Ammo for ${w.name}` };
    }

    const upg = SHOP_UPGRADES.find((u) => u.id === id);
    if (!upg) return { ok: false, msg: 'Unknown upgrade' };
    if (upg.kind === 'turbo' && p.upgrades.turbo) return { ok: false, msg: 'Already installed' };
    if (upg.kind === 'chassis' && p.upgrades.chassis) return { ok: false, msg: 'Already installed' };
    if (upg.kind === 'damage' && p.upgrades.damage) return { ok: false, msg: 'Already installed' };
    if (p.cash < upg.cost) return { ok: false, msg: `Need $${upg.cost}` };

    p.cash -= upg.cost;
    if (upg.kind === 'armor') p.armor = PLAYER_SPEC.maxArmor;
    else if (upg.kind === 'heal') p.hp = PLAYER_SPEC.maxHp;
    else if (upg.kind === 'turbo') p.upgrades.turbo = true;
    else if (upg.kind === 'chassis') p.upgrades.chassis = true;
    else if (upg.kind === 'damage') p.upgrades.damage = true;
    world.audio?.playCash();
    return { ok: true, msg: upg.name };
  }

  function update(world, dt) {
    if (state.dialogueTimer > 0) state.dialogueTimer = Math.max(0, state.dialogueTimer - dt);

    const p = world.player;
    const step = currentStep();
    if (!step) return;

    // Check crate pickup
    for (let i = crates.length - 1; i >= 0; i -= 1) {
      crates[i].bob += dt * 4;
      if (Math.hypot(p.x - crates[i].x, p.y - crates[i].y) < 34) {
        crates.splice(i, 1);
        world.audio?.playCash();
        combat.spawnPopup(p.x, p.y - 20, 'CRATE SECURED', '#4de1ff');
      }
    }

    if (step.type === 'get_fast_car') {
      if (p.inVehicle && (p.vehicle.kind === 'muscle' || p.vehicle.kind === 'coupe')) {
        advanceStep(world);
      }
    } else if (step.type === 'reach_in_car') {
      if (p.inVehicle && Math.hypot(p.x - step.x, p.y - step.y) < 76) {
        advanceStep(world);
      }
    } else if (step.type === 'reach_point') {
      if (Math.hypot(p.x - step.x, p.y - step.y) < 70) {
        advanceStep(world);
      }
    } else if (step.type === 'clear_ambush' || step.type === 'kill_boss') {
      const playerNear = Math.hypot(p.x - step.x, p.y - step.y) < 620;
      if (state.spawnedForStep && playerNear && combat.enemies.length === 0) {
        advanceStep(world);
      }
    } else if (step.type === 'collect_crates') {
      if (state.spawnedForStep && crates.length === 0) {
        advanceStep(world);
      }
    } else if (step.type === 'evade_wanted') {
      if (police.state.wantedLevel === 0) {
        advanceStep(world);
      }
    } else if (step.type === 'hijack_target') {
      if (state.targetVehicle && p.vehicle === state.targetVehicle) {
        advanceStep(world);
      }
    } else if (step.type === 'deliver_target') {
      if (p.inVehicle && Math.hypot(p.x - step.x, p.y - step.y) < 82) {
        advanceStep(world);
      }
    }
  }

  function reset(world) {
    state.storyIndex = 0;
    state.stepIndex = 0;
    state.activeSide = null;
    state.sideStep = 0;
    state.storyComplete = false;
    state.lastResult = null;
    cleanupStepEntities();
    setDialogue('ELENA SOLIS', STORY_MISSIONS[0].intro, 6.5);
    setupStep(world);
  }

  return {
    state,
    crates,
    currentMission,
    currentStep,
    getWaypoint,
    setDialogue,
    setupStep,
    startSideContract,
    buyItem,
    update,
    reset,
  };
}
