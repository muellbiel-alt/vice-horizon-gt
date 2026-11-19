// Unified keyboard, pointer aim, mouse wheel, and logical 1280x720 coordinate mapper.

import { VIEW } from './config.js';

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: VIEW.width * 0.5, y: VIEW.height * 0.5, down: false, justPressed: false, rightDown: false, wheelDelta: 0 };

  function toLogical(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const s = Math.min(r.width / VIEW.width, r.height / VIEW.height) || 1;
    return { x: (cx - r.left - (r.width - VIEW.width * s) * 0.5) / s, y: (cy - r.top - (r.height - VIEW.height * s) * 0.5) / s };
  }

  window.addEventListener('keydown', (e) => {
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); pressed.clear(); mouse.down = false; mouse.rightDown = false; });

  canvas.addEventListener('pointermove', (e) => { const p = toLogical(e.clientX, e.clientY); mouse.x = p.x; mouse.y = p.y; });
  canvas.addEventListener('pointerdown', (e) => {
    const p = toLogical(e.clientX, e.clientY); mouse.x = p.x; mouse.y = p.y;
    if (e.button === 2) mouse.rightDown = true;
    else { mouse.down = true; mouse.justPressed = true; }
  });
  window.addEventListener('pointerup', (e) => { if (e.button === 2) mouse.rightDown = false; else mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { mouse.wheelDelta += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

  return {
    mouse,
    isDown: (code) => keys.has(code),
    consumePress: (code) => (pressed.has(code) ? (pressed.delete(code), true) : false),
    axisMove: () => ({
      x: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
      y: (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0),
    }),
    consumeClick: () => { const c = mouse.justPressed; mouse.justPressed = false; return c; },
    consumeWheel: () => { const d = mouse.wheelDelta; mouse.wheelDelta = 0; return d; },
    clearPressed: () => { pressed.clear(); mouse.justPressed = false; mouse.wheelDelta = 0; },
  };
}
