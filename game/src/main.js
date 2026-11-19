// Application entrypoint for Solara Bay: Heatline V2.
// Drives fixed 60 Hz loop, DPR-aware 1280x720 canvas, UI routing, Save/Load, and ?shot= captures.

import { STEP, VIEW } from './core/config.js';
import { createRandom } from './core/random.js';
import { createInput } from './core/input.js';
import { createAudioEngine } from './audio/synth.js';
import { createWorld } from './world/simulation.js';
import { createWorldRenderer } from './ui/render.js';
import { createHudRenderer, SCREEN_GARAGE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_RESULTS, SCREEN_SHOP, SCREEN_TITLE } from './ui/hud.js';
import { stageShot } from './ui/shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 202611;

const canvas = document.getElementById('game'), statusEl = document.getElementById('status'), ctx = canvas.getContext('2d');
const audio = createAudioEngine(), world = createWorld(createRandom(seed), audio), worldRenderer = createWorldRenderer(), hudRenderer = createHudRenderer();
const view = { scale: 1, x: 0, y: 0 };

function resize() {
  const ratio = window.devicePixelRatio || 1, w = Math.round(window.innerWidth * ratio), h = Math.round(window.innerHeight * ratio);
  canvas.width = w; canvas.height = h;
  view.scale = Math.min(w / VIEW.width, h / VIEW.height);
  view.x = (w - VIEW.width * view.scale) * 0.5; view.y = (h - VIEW.height * view.scale) * 0.5;
}

function drawFrame(screen, hasSave) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#070c15'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VIEW.width, VIEW.height); ctx.clip();
  const sx = world.cameraShake > 0 ? Math.sin(world.time * 55) * world.cameraShake : 0;
  const sy = world.cameraShake > 0 ? Math.cos(world.time * 47) * world.cameraShake : 0;
  worldRenderer.renderWorld(ctx, world, world.cameraX + sx, world.cameraY + sy, world.time);
  hudRenderer.renderHud(ctx, world, screen, hasSave, world.time);
  ctx.restore();
}

function runShot(name) {
  const staged = stageShot(name, world); let frames = 0;
  const paint = () => { drawFrame(staged.screen, staged.hasSave); ++frames < 2 ? requestAnimationFrame(paint) : (window.__shotReady = true); };
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE, hasSave = world.hasSavedGame(), acc = 0, last = performance.now();
  const say = (m) => { statusEl.textContent = m; };

  world.onOpenShop = () => { screen = SCREEN_SHOP; say('Armory Depot opened.'); };
  world.onOpenGarage = () => { screen = SCREEN_GARAGE; say('Costa Customs Garage opened.'); };
  world.onMissionResults = () => { screen = SCREEN_RESULTS; world.saveToStorage('autosave'); hasSave = true; say('Contract summary ready.'); };
  world.onSaveNotify = () => { hasSave = true; say('Progress saved.'); };

  function handleAction(id, data = null) {
    audio.unlock();
    if (id === 'new_game' || id === 'restart_game') { world.reset(); acc = 0; screen = SCREEN_PLAY; say('Solara Bay: Heatline started. Explore all four districts.'); }
    else if (id === 'continue_game') { if (!world.loadFromStorage('autosave')) world.reset(); acc = 0; screen = SCREEN_PLAY; say('Loaded autosave.'); }
    else if (id === 'open_garage_from_title') { if (!world.loadFromStorage('autosave')) world.reset(); acc = 0; screen = SCREEN_GARAGE; say('Costa Customs Garage opened.'); }
    else if (id === 'resume_game' || id === 'close_shop' || id === 'continue_after_results') screen = SCREEN_PLAY;
    else if (id === 'open_shop' || id === 'switch_tab_armory') screen = SCREEN_SHOP;
    else if (id === 'open_garage' || id === 'switch_tab_garage') screen = SCREEN_GARAGE;
    else if (id === 'side_contract' && world.missions.startSideContract()) say('Side contract active.');
    else if (id === 'pause_game') screen = screen === SCREEN_PAUSED ? SCREEN_PLAY : SCREEN_PAUSED;
    else if (id === 'save_slot' && world.saveToStorage(data ?? 'slot1')) { hasSave = true; say(`Saved to ${data}.`); }
    else if (id === 'load_slot' && world.loadFromStorage(data ?? 'slot1')) { screen = SCREEN_PLAY; say(`Loaded ${data}.`); }
    else if (id === 'toggle_mute') say(audio.toggleMute() ? 'Audio muted.' : 'Audio unmuted.');
    else if (id === 'buy_weapon') say(world.economy.buyWeaponOrAmmo(world, data).msg);
    else if (id === 'buy_armory') say(world.economy.buyArmoryGear(world, data).msg);
    else if (id === 'buy_garage_mod') say(world.economy.buyGarageMod(world, data).msg);
    else if (id === 'garage_respray') say(world.economy.resprayAndRepair(world, null).msg);
    else if (id === 'garage_paint') say(world.economy.resprayAndRepair(world, data).msg);
  }

  function processUi() {
    if (input.consumePress('KeyM')) handleAction('toggle_mute');
    if (screen === SCREEN_TITLE) {
      if (input.consumePress('Enter') || input.consumePress('Space')) return handleAction(hasSave ? 'continue_game' : 'new_game');
      if (input.consumePress('KeyG')) return handleAction('open_garage_from_title');
    } else if (screen === SCREEN_PLAY) {
      if (input.consumePress('Escape') || input.consumePress('KeyP')) { screen = SCREEN_PAUSED; audio.update(STEP, 0, false, 0, world.time, false); return; }
      if (input.consumePress('KeyB')) { screen = SCREEN_SHOP; return; }
      if (input.consumePress('KeyG')) { screen = SCREEN_GARAGE; return; }
      if (input.consumePress('KeyN')) handleAction('side_contract');
    } else if (screen === SCREEN_SHOP || screen === SCREEN_GARAGE) {
      if (input.consumePress('Escape') || (screen === SCREEN_SHOP && input.consumePress('KeyB')) || (screen === SCREEN_GARAGE && input.consumePress('KeyG'))) { screen = SCREEN_PLAY; return; }
      if (input.consumePress('KeyB')) screen = SCREEN_SHOP;
      if (input.consumePress('KeyG')) screen = SCREEN_GARAGE;
    } else if (screen === SCREEN_PAUSED && (input.consumePress('Escape') || input.consumePress('KeyP'))) { screen = SCREEN_PLAY; return; }
    else if (screen === SCREEN_RESULTS && (input.consumePress('Enter') || input.consumePress('Space'))) { screen = SCREEN_PLAY; return; }

    if (input.mouse.justPressed) {
      const hit = hudRenderer.hitTestButton(input.mouse.x, input.mouse.y);
      if (hit) { input.consumeClick(); handleAction(hit.id, hit.data); }
      else if (screen !== SCREEN_PLAY) input.consumeClick();
      else audio.unlock();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame); acc += Math.min((now - last) / 1000, 0.25); last = now;
    processUi();
    if (screen === SCREEN_TITLE) while (acc >= STEP) { world.stepAttract(STEP); acc -= STEP; }
    else if (screen === SCREEN_PLAY) while (acc >= STEP && screen === SCREEN_PLAY) { world.stepPlay(STEP, input); acc -= STEP; }
    else acc = 0;
    drawFrame(screen, hasSave);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; audio.update(STEP, 0, false, 0, world.time, false); say('Game paused.'); }
  });
  say('Solara Bay: Heatline V2 ready. Click Play or press Space to start.');
  requestAnimationFrame(frame);
}

resize();
window.addEventListener('resize', resize);
if (shotName) runShot(shotName); else runGame();
