// Story campaign (5 missions) + repeatable Street Racing, Cargo Heist, and Syndicate Bounty contracts.

import { clamp } from '../core/random.js';

export const STORY_MISSIONS = [
  { id: 'm1_ignition', title: 'Dockside Ignition', district: 'harbor', repReward: 20, reward: 1200, speaker: 'ELENA SOLIS', intro: 'Grab a Solara V8 or Kestrel GT on Meridian Ave and run it to Pier 1.', steps: [{ label: 'Steal a Solara V8 or Kestrel GT', x: 1465, y: 1140, type: 'get_fast_car' }, { label: 'Deliver the ride to Harbor Pier 1', x: 2520, y: 2040, type: 'reach_in_car' }] },
  { id: 'm2_signal', title: 'Signal Jam', district: 'industrial', repReward: 25, reward: 2000, speaker: 'ELENA SOLIS', intro: 'Iron Tide stashed harbor manifests in Industrial Yard. Clear the guards.', steps: [{ label: 'Hit the Iron Tide cache in Industrial Yard', x: 2930, y: 620, type: 'clear_ambush', count: 4, wanted: 2 }, { label: 'Lose the heat or respray at Costa Customs', x: 2930, y: 1215, type: 'evade_wanted' }] },
  { id: 'm3_convoy', title: 'Armored Convoy', district: 'downtown', repReward: 25, reward: 3200, speaker: 'MARCO VEGA', intro: 'An Iron Tide armored hauler is rolling down Palm Blvd. Hijack the payload.', steps: [{ label: 'Hijack the Armored Convoy on Palm Boulevard', x: 460, y: 1180, type: 'hijack_target', wanted: 3 }, { label: 'Deliver the payload to Downtown Armory', x: 1800, y: 1218, type: 'deliver_target' }] },
  { id: 'm4_vault', title: 'Neon Vault Heist', district: 'downtown', repReward: 30, reward: 4800, speaker: 'ELENA SOLIS', intro: 'Storm Meridian Plaza, grab the ledger crates, and break the SWAT cordon.', steps: [{ label: 'Clear Meridian Plaza vault guards', x: 1800, y: 600, type: 'clear_ambush', count: 5, wanted: 4 }, { label: 'Collect all 3 ledger crates at the plaza', x: 1800, y: 600, type: 'collect_crates', count: 3 }, { label: 'Escape the lockdown to Vega Safehouse', x: 720, y: 635, type: 'reach_point' }] },
  { id: 'm5_endgame', title: 'Pier Endgame', district: 'harbor', repReward: 35, reward: 8000, speaker: 'VICTOR KROLL', intro: 'Victor Kroll is boarding the freighter at Pier 2. End the Iron Tide.', steps: [{ label: 'Take down Victor Kroll at Harbor Pier 2', x: 3015, y: 2240, type: 'kill_boss', count: 5, wanted: 5 }, { label: 'Break out to Palm Boulevard Boardwalk', x: 460, y: 1940, type: 'reach_point' }] },
];

const SIDE_CONTRACTS = [
  { id: 'side_race', title: 'Midnight Heatline Race', district: 'palm', repReward: 15, reward: 1350, speaker: 'ELENA SOLIS', intro: 'Street race across Downtown Neon and Palm Blvd. Hit every checkpoint fast.', steps: [{ label: 'Checkpoint 1/3 · Meridian Plaza Ave', x: 1520, y: 860, type: 'reach_in_car' }, { label: 'Checkpoint 2/3 · Palm Boardwalk Turn', x: 460, y: 860, type: 'reach_in_car' }, { label: 'Finish Line · Harbor Causeway', x: 2080, y: 1940, type: 'reach_in_car' }] },
  { id: 'side_cargo', title: 'Harbor Cargo Heist', district: 'harbor', repReward: 18, reward: 1450, speaker: 'MARCO VEGA', intro: 'Steal the syndicate Atlas Hauler at Pier 1 and stash it at Costa Customs.', steps: [{ label: 'Hijack the Cargo Hauler at Pier 1', x: 2500, y: 2050, type: 'hijack_target', wanted: 2 }, { label: 'Deliver stolen cargo to Costa Customs', x: 2930, y: 1215, type: 'deliver_target' }] },
  { id: 'side_bounty', title: 'Foundry Street Bounty', district: 'industrial', repReward: 15, reward: 1150, speaker: 'MARCO VEGA', intro: 'Iron Tide gunmen set up an ambush in Industrial Yard. Clear the block.', steps: [{ label: 'Eliminate Iron Tide hit squad', x: 2740, y: 860, type: 'clear_ambush', count: 4, wanted: 1 }] },
];

export function createMissionSystem(city, vehicleMgr, combat, police) {
  const crates = [];
  let sideRotation = 0;
  const state = { storyIndex: 0, stepIndex: 0, activeSide: null, sideStep: 0, missionActive: true, storyComplete: false, targetVehicle: null, spawnedForStep: false, dialogueSpeaker: 'ELENA SOLIS', dialogueText: STORY_MISSIONS[0].intro, dialogueTimer: 6.5, lastResult: null };

  const setDialogue = (sp, txt, dur = 5.5) => { state.dialogueSpeaker = sp; state.dialogueText = txt; state.dialogueTimer = dur; };
  const currentMission = () => state.activeSide ?? (state.storyIndex < STORY_MISSIONS.length ? STORY_MISSIONS[state.storyIndex] : null);
  const currentStep = () => { const m = currentMission(); return m ? (m.steps[state.activeSide ? state.sideStep : state.stepIndex] ?? null) : null; };

  function getWaypoint() {
    if (state.targetVehicle && !state.targetVehicle.exploded && state.targetVehicle.driver !== 'player') return { x: state.targetVehicle.x, y: state.targetVehicle.y, label: currentStep()?.label ?? 'Target' };
    if (crates.length) return { x: crates[0].x, y: crates[0].y, label: currentStep()?.label ?? 'Crate' };
    if (combat.enemies.length) return { x: combat.enemies[0].x, y: combat.enemies[0].y, label: currentStep()?.label ?? 'Hostile' };
    const st = currentStep(); return st ? { x: st.x, y: st.y, label: st.label } : null;
  }

  function cleanup() { crates.length = 0; state.targetVehicle = null; state.spawnedForStep = false; }

  function setupStep() {
    cleanup(); const st = currentStep(); if (!st) return;
    if (st.type === 'clear_ambush' || st.type === 'kill_boss') {
      if (st.type === 'kill_boss') combat.spawnEnemy(st.x, st.y, 'boss', 'mission');
      const n = st.count ?? 4;
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * 6.2832, ex = clamp(st.x + Math.cos(a) * 88, 420, 3420), ey = clamp(st.y + Math.sin(a) * 88, 220, 2420);
        if (!city.isPointBlocked(ex, ey, 14)) combat.spawnEnemy(ex, ey, i % 2 === 0 ? 'heavy' : 'enforcer', 'mission');
      }
      state.spawnedForStep = true;
    } else if (st.type === 'collect_crates') {
      const n = st.count ?? 3;
      for (let i = 0; i < n; i += 1) { const a = (i / n) * 6.2832 + 0.4; crates.push({ x: st.x + Math.cos(a) * 68, y: st.y + Math.sin(a) * 68, bob: i * 1.3 }); }
      state.spawnedForStep = true;
    } else if (st.type === 'hijack_target') {
      state.targetVehicle = vehicleMgr.spawnVehicle('van', st.x, st.y, 1.5708, { driver: 'convoy', color: '#2c3e50', missionTag: 'convoy', hp: 320 });
      combat.spawnEnemy(st.x - 46, st.y + 30, 'heavy', 'mission'); combat.spawnEnemy(st.x + 46, st.y - 30, 'enforcer', 'mission');
      state.spawnedForStep = true;
    }
  }

  function completeMission(world, m) {
    cleanup(); world.player.cash += m.reward; world.stats.cashEarned += m.reward; world.stats.missionsCleared += 1;
    const repGain = world.economy.addReputation(m.district ?? 'downtown', m.repReward ?? 15);
    world.audio?.playMissionClear();
    state.lastResult = { outcome: 'CLEARED', title: m.title, district: (m.district ?? 'downtown').toUpperCase(), reward: m.reward, repGain, rank: world.economy.getStreetRank(), cashTotal: world.player.cash, ...world.stats };
    if (state.activeSide) { state.activeSide = null; state.sideStep = 0; setDialogue('ELENA SOLIS', `Job paid +$${m.reward} and +${repGain} REP. Ready for the next run.`, 5); }
    else {
      state.storyIndex += 1; state.stepIndex = 0;
      if (state.storyIndex >= STORY_MISSIONS.length) { state.storyComplete = true; police.clearWanted(); setDialogue('ELENA SOLIS', 'Solara Bay is yours, Marco. Run street races or cargo heists anytime.', 7); }
      else { const nextM = STORY_MISSIONS[state.storyIndex]; setDialogue(nextM.speaker, nextM.intro, 6.5); setupStep(); }
    }
    if (m.id === 'm5_endgame' || m.id === 'm4_vault') world.onMissionResults?.(state.lastResult);
    else combat.spawnPopup(world.player.x, world.player.y - 34, `${m.title.toUpperCase()} +$${m.reward}`, '#ffd166');
  }

  function advanceStep(world) {
    const m = currentMission(); if (!m) return;
    if (currentStep()?.wanted) police.setMinimumWanted(currentStep().wanted, world.player.x, world.player.y);
    if (state.activeSide) { if (++state.sideStep >= m.steps.length) completeMission(world, m); else setupStep(); return; }
    if (++state.stepIndex >= m.steps.length) completeMission(world, m); else setupStep();
  }

  function startSideContract() {
    if (state.activeSide) return false;
    const pick = SIDE_CONTRACTS[sideRotation++ % SIDE_CONTRACTS.length];
    state.activeSide = pick; state.sideStep = 0; setDialogue(pick.speaker, pick.intro, 5.5); setupStep(); return true;
  }

  function update(world, dt) {
    if (state.dialogueTimer > 0) state.dialogueTimer = Math.max(0, state.dialogueTimer - dt);
    const p = world.player, st = currentStep(); if (!st) return;
    for (let i = crates.length - 1; i >= 0; i -= 1) {
      crates[i].bob += dt * 4;
      if (Math.hypot(p.x - crates[i].x, p.y - crates[i].y) < 34) { crates.splice(i, 1); world.audio?.playCash(); combat.spawnPopup(p.x, p.y - 20, 'CRATE SECURED', '#38d9f5'); }
    }
    if (st.type === 'get_fast_car' && p.inVehicle && (p.vehicle.kind === 'muscle' || p.vehicle.kind === 'coupe')) advanceStep(world);
    else if (st.type === 'reach_in_car' && p.inVehicle && Math.hypot(p.x - st.x, p.y - st.y) < 82) advanceStep(world);
    else if (st.type === 'reach_point' && Math.hypot(p.x - st.x, p.y - st.y) < 72) advanceStep(world);
    else if ((st.type === 'clear_ambush' || st.type === 'kill_boss') && state.spawnedForStep && Math.hypot(p.x - st.x, p.y - st.y) < 620 && !combat.enemies.length) advanceStep(world);
    else if (st.type === 'collect_crates' && state.spawnedForStep && !crates.length) advanceStep(world);
    else if (st.type === 'evade_wanted' && police.state.wantedLevel === 0) advanceStep(world);
    else if (st.type === 'hijack_target' && state.targetVehicle && p.vehicle === state.targetVehicle) advanceStep(world);
    else if (st.type === 'deliver_target' && p.inVehicle && Math.hypot(p.x - st.x, p.y - st.y) < 84) advanceStep(world);
  }

  function reset() {
    Object.assign(state, { storyIndex: 0, stepIndex: 0, activeSide: null, sideStep: 0, storyComplete: false, lastResult: null });
    sideRotation = 0; cleanup(); setDialogue('ELENA SOLIS', STORY_MISSIONS[0].intro, 6.5); setupStep();
  }

  return { state, crates, currentMission, currentStep, getWaypoint, setDialogue, setupStep, startSideContract, update, reset };
}
