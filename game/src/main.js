// Application entrypoint: fixed 60 Hz simulation loop, Canvas 2D scaling, screen states,
// keyboard/mouse menu routing, Save/Load persistence, and screenshot staging (?shot=...).

import { STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createAudioEngine } from './audio.js';
import { createWorld } from './world.js';
import { createWorldRenderer } from './render.js';
import {
  createHudRenderer,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_RESULTS,
  SCREEN_SHOP,
  SCREEN_TITLE,
} from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 202611;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

const audio = createAudioEngine();
const world = createWorld(createRandom(seed), audio);
const worldRenderer = createWorldRenderer();
const hudRenderer = createHudRenderer();

const view = { scale: 1, x: 0, y: 0 };

function resize() {
  const ratio = window.devicePixelRatio || 1;
  const w = Math.round(window.innerWidth * ratio);
  const h = Math.round(window.innerHeight * ratio);
  canvas.width = w;
  canvas.height = h;
  view.scale = Math.min(w / VIEW.width, h / VIEW.height);
  view.x = (w - VIEW.width * view.scale) * 0.5;
  view.y = (h - VIEW.height * view.scale) * 0.5;
}

function drawFrame(screen, hasSave) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b111c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW.width, VIEW.height);
  ctx.clip();

  const shakeX = world.cameraShake > 0 ? Math.sin(world.time * 55) * world.cameraShake : 0;
  const shakeY = world.cameraShake > 0 ? Math.cos(world.time * 47) * world.cameraShake : 0;
  worldRenderer.renderWorld(ctx, world, world.cameraX + shakeX, world.cameraY + shakeY, world.time);
  hudRenderer.renderHud(ctx, world, screen, hasSave, world.time);

  ctx.restore();
}

function runShot(name) {
  const staged = stageShot(name, world);
  let frames = 0;
  function paint() {
    drawFrame(staged.screen, staged.hasSave);
    frames += 1;
    if (frames < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let hasSave = world.hasSavedGame();
  let accumulator = 0;
  let last = performance.now();

  function announce(msg) {
    statusEl.textContent = msg;
  }

  function startNewGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Solara Bay: Heatline started. Explore Palm Boulevard and Downtown Neon.');
  }

  function continueSavedGame() {
    audio.unlock();
    if (!world.loadFromStorage()) world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Loaded saved game.');
  }

  world.onOpenShop = () => {
    screen = SCREEN_SHOP;
    announce('Armory & Upgrade Shop opened.');
  };
  world.onMissionResults = () => {
    screen = SCREEN_RESULTS;
    world.saveToStorage();
    hasSave = true;
    announce('Contract summary ready.');
  };
  world.onSaveNotify = () => {
    hasSave = true;
    announce('Game progress saved.');
  };

  function handleUiAction(actionId, data = null) {
    audio.unlock();
    if (actionId === 'new_game' || actionId === 'restart_game') {
      startNewGame();
    } else if (actionId === 'continue_game') {
      continueSavedGame();
    } else if (actionId === 'resume_game' || actionId === 'close_shop' || actionId === 'continue_after_results') {
      screen = SCREEN_PLAY;
    } else if (actionId === 'open_shop') {
      screen = screen === SCREEN_SHOP ? SCREEN_PLAY : SCREEN_SHOP;
    } else if (actionId === 'side_contract') {
      if (world.missions.startSideContract(world)) {
        announce('New side contract started.');
      }
    } else if (actionId === 'pause_game') {
      screen = screen === SCREEN_PAUSED ? SCREEN_PLAY : SCREEN_PAUSED;
    } else if (actionId === 'save_game') {
      if (world.saveToStorage()) {
        hasSave = true;
        announce('Progress saved.');
      }
    } else if (actionId === 'toggle_mute') {
      const m = audio.toggleMute();
      announce(m ? 'Audio muted.' : 'Audio unmuted.');
    } else if (actionId === 'buy_weapon') {
      const res = world.missions.buyItem(world, 'weapon', data);
      announce(res.msg);
    } else if (actionId === 'buy_upgrade') {
      const res = world.missions.buyItem(world, 'upgrade', data);
      announce(res.msg);
    }
  }

  function processMenuAndHotkeys() {
    if (input.consumePress('KeyM')) {
      handleUiAction('toggle_mute');
    }

    if (screen === SCREEN_TITLE) {
      if (input.consumePress('Enter') || input.consumePress('Space')) {
        handleUiAction(hasSave ? 'continue_game' : 'new_game');
        return;
      }
    } else if (screen === SCREEN_PLAY) {
      if (input.consumePress('Escape') || input.consumePress('KeyP')) {
        screen = SCREEN_PAUSED;
        audio.update(STEP, 0, false, 0, world.time, false);
        return;
      }
      if (input.consumePress('KeyB')) {
        screen = SCREEN_SHOP;
        return;
      }
      if (input.consumePress('KeyN')) {
        handleUiAction('side_contract');
      }
    } else if (screen === SCREEN_SHOP) {
      if (input.consumePress('Escape') || input.consumePress('KeyB')) {
        screen = SCREEN_PLAY;
        return;
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.consumePress('Escape') || input.consumePress('KeyP')) {
        screen = SCREEN_PLAY;
        return;
      }
    } else if (screen === SCREEN_RESULTS) {
      if (input.consumePress('Enter') || input.consumePress('Space')) {
        screen = SCREEN_PLAY;
        return;
      }
    }

    // Check clickable HUD buttons before letting world input consume the click
    if (input.mouse.justPressed) {
      const hit = hudRenderer.hitTestButton(input.mouse.x, input.mouse.y);
      if (hit) {
        input.consumeClick();
        handleUiAction(hit.id, hit.data);
      } else if (screen !== SCREEN_PLAY) {
        input.consumeClick();
      } else {
        audio.unlock();
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    processMenuAndHotkeys();

    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.stepAttract(STEP);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        world.stepPlay(STEP, input);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }

    drawFrame(screen, hasSave);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.update(STEP, 0, false, 0, world.time, false);
      announce('Game paused.');
    }
  });

  announce('Solara Bay: Heatline ready. Click Play Now or press Space to start.');
  requestAnimationFrame(frame);
}

resize();
window.addEventListener('resize', resize);

if (shotName) runShot(shotName);
else runGame();
