// Open-world city generator for Solara Bay: road graph, timed intersections, 2.5D buildings,
// harbor piers, containers, cranes, freighter, streetlamps, collision & line-of-sight.

import { WORLD } from '../core/config.js';
import { clamp, hash2D } from '../core/random.js';
import { getDistrictAt, LANDMARKS } from './districts.js';

export const V_ROADS = [460, 980, 1520, 2080, 2640, 3220];
export const H_ROADS = [320, 860, 1420, 1940, 2400];
const EDGE = WORLD.roadWidth * 0.5 + WORLD.sidewalkWidth;

export function isInsideHarborWater(x, y) {
  if (x < 2240 || y < 2010) return false;
  return !((x >= 2350 && x <= 2650 && y <= 2480) || (x >= 2850 && x <= 3180 && y <= 2480) || (x >= 3360 && x <= 3540 && y <= 2380));
}

function buildBuildings(rand) {
  const buildings = [], props = [], lamps = [];
  const pushB = (x, y, w, h, height, wallColor, roofColor, accent, style, windows = false, helipad = false, neon = null) => buildings.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), height, wallColor, roofColor, accent, style, windows, helipad, neon });

  const xCols = V_ROADS.slice(0, -1).map((x, i) => ({ x0: x + EDGE, x1: V_ROADS[i + 1] - EDGE }));
  const yRows = H_ROADS.slice(0, -1).map((y, i) => ({ y0: y + EDGE, y1: H_ROADS[i + 1] - EDGE }));
  const signs = [['SOLARA CLUB', '#ff7b54'], ['OASIS MOTEL', '#28c7b7'], ['APEX GEAR', '#ffd166'], ['HOTEL MIRAGE', '#ff9f43'], ['BAY MOTORS', '#38d9f5'], ['NIGHT MARKET', '#f25f5c']].map(([label, color]) => ({ label, color }));
  const STYLES = {
    downtown: { colors: ['#243144', '#2c3c52', '#35465e', '#1f2b3c', '#3c4d64'], roof: '#1a2330', minH: 92, maxH: 175, style: 'tower', win: 1 },
    palm: { colors: ['#d6b496', '#e2c7aa', '#c9a488', '#b7d0cc', '#dfc1a3'], roof: '#b56343', minH: 48, maxH: 88, style: 'villa', win: 1 },
    industrial: { colors: ['#58463e', '#434c57', '#615149', '#3b424c'], roof: '#2a2f38', minH: 54, maxH: 94, style: 'warehouse', win: 0.35 },
    harbor: { colors: ['#3e4e60', '#4b5966', '#324354'], roof: '#26323f', minH: 50, maxH: 90, style: 'warehouse', win: 0.5 },
  };

  for (let r = 0; r < yRows.length; r += 1) for (let c = 0; c < xCols.length; c += 1) {
    if (r === 3 && c >= 3) continue;
    const box = { x: xCols[c].x0, y: yRows[r].y0, w: xCols[c].x1 - xCols[c].x0, h: yRows[r].y1 - yRows[r].y0 };
    const dist = getDistrictAt(box.x + box.w * 0.5, box.y + box.h * 0.5);

    if (r === 0 && c === 2) {
      props.push({ kind: 'fountain', x: box.x + box.w * 0.5, y: box.y + box.h * 0.5, r: 58 });
      for (const [dx, dy] of [[16, 16], [box.w - 120, 16], [16, box.h - 120], [box.w - 120, box.h - 120]]) pushB(box.x + dx, box.y + dy, 104, 104, rand.range(120, 170), rand.pick(STYLES.downtown.colors), '#192230', '#ffd166', 'tower', true, rand.chance(0.5), rand.pick(signs));
      continue;
    }
    if (r === 1 && c === 2) {
      pushB(box.x + 18, box.y + 18, box.w - 36, 132, 86, '#2b394a', '#1d2634', '#f7a531', 'commercial', true, false, { label: 'ARMORY DEPOT', color: '#ffd166' });
      pushB(box.x + 18, box.y + box.h - 134, 165, 116, 118, '#263447', '#18212f', '#38d9f5', 'tower', true, false, { label: 'HEATLINE CLUB', color: '#38d9f5' });
      continue;
    }
    if (r === 1 && c === 4) {
      pushB(box.x + 22, box.y + 22, box.w - 44, 120, 64, '#4d443f', '#2d3138', '#28c7b7', 'warehouse', true, false, { label: 'COSTA CUSTOMS', color: '#28c7b7' });
      props.push({ kind: 'silo', x: box.x + 80, y: box.y + box.h - 80, r: 34 }, { kind: 'silo', x: box.x + 165, y: box.y + box.h - 80, r: 34 });
      continue;
    }
    if (r === 0 && c === 0) {
      pushB(box.x + 24, box.y + 24, 190, 140, 58, '#e0c5aa', '#b86242', '#28c7b7', 'villa', true, false, { label: 'VEGA SAFEHOUSE', color: '#28c7b7' });
      props.push({ kind: 'pool', x: box.x + 275, y: box.y + 92, w: 96, h: 64 });
      pushB(box.x + 24, box.y + box.h - 140, box.w - 48, 116, 68, '#d4b292', '#a85d41', '#ffd166', 'villa', true);
      continue;
    }

    const hw = (box.w - 62) * 0.5, hh = (box.h - 62) * 0.5;
    const rects = rand.chance(0.5) ? [[box.x + 14, box.y + 14, hw, box.h - 28], [box.x + 48 + hw, box.y + 14, hw, box.h - 28]] : [[box.x + 14, box.y + 14, box.w - 28, hh], [box.x + 14, box.y + 48 + hh, box.w - 28, hh]];
    const st = STYLES[dist.id] ?? STYLES.downtown;
    for (const [rx, ry, rw, rh] of rects) {
      const hasN = (st.style === 'tower' && rand.chance(0.58)) || (dist.id === 'harbor' && rand.chance(0.35));
      pushB(rx, ry, rw, rh, rand.range(st.minH, st.maxH), rand.pick(st.colors), st.roof, dist.accent, st.style, rand.chance(st.win), st.style === 'tower' && rand.chance(0.24), hasN ? rand.pick(signs) : null);
    }
  }

  const cCols = ['#d9534f', '#28a0b8', '#e69d38', '#3c8c64', '#c9623b'];
  [[2410, 2120], [2495, 2120], [2410, 2168], [2410, 2260], [2495, 2260], [2540, 2350], [2900, 2110], [2990, 2110], [2900, 2220], [2990, 2220], [2900, 2330], [3395, 2090], [3395, 2170], [3395, 2250]].forEach(([x, y], i) => pushB(x, y, 74, 30, 32 + (i % 2) * 14, cCols[i % 5], cCols[i % 5], '#f4f6fa', 'container'));

  props.push({ kind: 'crane', x: 2610, y: 2180, w: 120, h: 42 }, { kind: 'crane', x: 3130, y: 2260, w: 130, h: 42 }, { kind: 'ship', x: 3205, y: 2080, w: 125, h: 410 }, { kind: 'lifeguard', x: 256, y: 680, w: 34, h: 34 }, { kind: 'lifeguard', x: 256, y: 1580, w: 34, h: 34 });
  for (let py = 240; py <= 2380; py += 125) {
    props.push({ kind: 'palm', x: 348 + Math.sin(py * 0.01) * 10, y: py, scale: 1 + (py % 3) * 0.08 });
    if (py % 250 === 0) props.push({ kind: 'palm', x: 545, y: py + 40, scale: 0.92 }, { kind: 'umbrella', x: 245, y: py + 20, color: py % 500 === 0 ? '#f06449' : '#28c7b7' });
  }
  for (let py = 440; py < 2300; py += 210) props.push({ kind: 'palm', x: 896, y: py, scale: 0.9 }, { kind: 'palm', x: 1435, y: py + 80, scale: 0.88 });
  for (const vx of V_ROADS) for (const hy of H_ROADS) { if (vx >= 2640 && hy >= 2400) continue; const color = getDistrictAt(vx, hy).lampColor; lamps.push({ x: vx - 74, y: hy - 74, color }, { x: vx + 74, y: hy + 74, color }); }
  for (const [x, y, color] of [[2370, 2030, '#38d9f5'], [2630, 2030, '#ffbf69'], [2870, 2030, '#38d9f5'], [3160, 2030, '#ffbf69'], [2630, 2320, '#ff7b54'], [2870, 2320, '#38d9f5']]) lamps.push({ x, y, color });
  return { buildings, props, lamps };
}

export function createCity(rand) {
  const segments = [
    ...V_ROADS.map((vx) => ({ x1: vx, y1: 320, x2: vx, y2: vx >= 2640 ? 1940 : 2400, lanes: vx === 1520 ? 4 : 2 })),
    ...H_ROADS.map((hy) => ({ x1: 460, y1: hy, x2: hy === 2400 ? 2080 : 3220, y2: hy, lanes: hy === 860 || hy === 1420 ? 4 : 2 })),
  ];
  const { buildings, props, lamps } = buildBuildings(rand);
  const signals = [];
  V_ROADS.forEach((vx, i) => H_ROADS.forEach((hy, j) => { if (!(vx >= 2640 && hy >= 2400)) signals.push({ x: vx, y: hy, phaseOffset: (i + j) * 2.5 }); }));
  const landmarks = LANDMARKS.map((lm) => ({ ...lm }));

  const getSignalState = (sig, time) => { const t = (time + sig.phaseOffset) % 12; return t < 5 ? { ns: 'green', ew: 'red' } : t < 6 ? { ns: 'yellow', ew: 'red' } : t < 11 ? { ns: 'red', ew: 'green' } : { ns: 'red', ew: 'yellow' }; };
  function isPointBlocked(x, y, r) {
    if (x < WORLD.waterWidth + 32 + r || x > WORLD.width - 36 - r || y < 36 + r || y > WORLD.height - 36 - r || isInsideHarborWater(x, y)) return true;
    for (const b of buildings) if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    return false;
  }
  function resolveCircleCollisions(ent, r, ignore = false) {
    ent.x = clamp(ent.x, WORLD.waterWidth + 32 + r, WORLD.width - 36 - r); ent.y = clamp(ent.y, 36 + r, WORLD.height - 36 - r);
    if (ignore) return;
    if (isInsideHarborWater(ent.x, ent.y)) ent.y = Math.min(ent.y, 2008 - r);
    for (const b of buildings) {
      const dx = ent.x - clamp(ent.x, b.x, b.x + b.w), dy = ent.y - clamp(ent.y, b.y, b.y + b.h), d2 = dx * dx + dy * dy;
      if (d2 < r * r) { if (d2 > 0.0001) { const d = Math.sqrt(d2); ent.x += (dx / d) * (r - d); ent.y += (dy / d) * (r - d); } else ent.y = b.y - r; }
    }
  }
  function hasLineOfSight(x1, y1, x2, y2) {
    const steps = Math.max(4, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 36));
    for (let s = 1; s < steps; s += 1) { const t = s / steps, px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t; for (const b of buildings) if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return false; }
    return true;
  }
  function findNearestRoadPoint(x, y) {
    const bx = V_ROADS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
    const by = H_ROADS.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
    return Math.abs(x - bx) < Math.abs(y - by) ? { x: bx, y: clamp(y, 320, 2400) } : { x: clamp(x, 460, by === 2400 ? 2080 : 3220), y: by };
  }

  return { width: WORLD.width, height: WORLD.height, vRoads: V_ROADS, hRoads: H_ROADS, segments, buildings, props, lamps, signals, landmarks, getDistrictAt, getSignalState, isInsideHarborWater, isPointBlocked, resolveCircleCollisions, hasLineOfSight, findNearestRoadPoint, hash2D };
}
