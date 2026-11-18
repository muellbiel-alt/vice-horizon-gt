// Unified keyboard, pointer aim, weapon selection, and clickable HUD button input.
// Screen coordinates map to the letterboxed 1280x720 logical playfield.

import { VIEW } from './config.js';

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = {
    x: VIEW.width * 0.5,
    y: VIEW.height * 0.5,
    down: false,
    justPressed: false,
    rightDown: false,
    wheelDelta: 0,
  };

  function toLogicalCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / VIEW.width, rect.height / VIEW.height) || 1;
    const ox = (rect.width - VIEW.width * scale) * 0.5;
    const oy = (rect.height - VIEW.height * scale) * 0.5;
    return {
      x: (clientX - rect.left - ox) / scale,
      y: (clientY - rect.top - oy) / scale,
    };
  }

  window.addEventListener('keydown', (event) => {
    const code = event.code;
    if (!keys.has(code)) pressed.add(code);
    keys.add(code);
    if (
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Tab'
    ) {
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });

  window.addEventListener('blur', () => {
    keys.clear();
    pressed.clear();
    mouse.down = false;
    mouse.rightDown = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const pt = toLogicalCoords(event.clientX, event.clientY);
    mouse.x = pt.x;
    mouse.y = pt.y;
  });

  canvas.addEventListener('pointerdown', (event) => {
    const pt = toLogicalCoords(event.clientX, event.clientY);
    mouse.x = pt.x;
    mouse.y = pt.y;
    if (event.button === 2) {
      mouse.rightDown = true;
    } else {
      mouse.down = true;
      mouse.justPressed = true;
    }
  });

  window.addEventListener('pointerup', (event) => {
    if (event.button === 2) mouse.rightDown = false;
    else mouse.down = false;
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  canvas.addEventListener(
    'wheel',
    (event) => {
      mouse.wheelDelta += Math.sign(event.deltaY);
      event.preventDefault();
    },
    { passive: false },
  );

  function isDown(code) {
    return keys.has(code);
  }

  function consumePress(code) {
    if (pressed.has(code)) {
      pressed.delete(code);
      return true;
    }
    return false;
  }

  function axisMove() {
    const right = keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0;
    const left = keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0;
    const down = keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0;
    const up = keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0;
    return { x: right - left, y: down - up };
  }

  function consumeClick() {
    const clicked = mouse.justPressed;
    mouse.justPressed = false;
    return clicked;
  }

  function consumeWheel() {
    const delta = mouse.wheelDelta;
    mouse.wheelDelta = 0;
    return delta;
  }

  function clearPressed() {
    pressed.clear();
    mouse.justPressed = false;
    mouse.wheelDelta = 0;
  }

  return {
    mouse,
    isDown,
    consumePress,
    axisMove,
    consumeClick,
    consumeWheel,
    clearPressed,
  };
}
