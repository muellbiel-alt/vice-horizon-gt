// Open-world map generator for Solara Bay across four distinct districts:
// Palm Boulevard, Downtown Neon, Industrial Yard, and Harbor Docks.
// Provides road graph, timed traffic lights, 2.5D extruded buildings, piers, props, and landmarks.

import { DISTRICTS, WORLD } from './config.js';
import { clamp, hash2D } from './random.js';

export const V_ROADS = [460, 980, 1520, 2080, 2640, 3220];
export const H_ROADS = [320, 860, 1420, 1940, 2400];

const ROAD_HALF = WORLD.roadWidth * 0.5;
const SIDEWALK = WORLD.sidewalkWidth;

export function getDistrictAt(x, y) {
  for (let i = 0; i < DISTRICTS.length; i += 1) {
    const d = DISTRICTS[i];
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[1];
}

function addRoadSegment(segments, x1, y1, x2, y2, lanes = 2) {
  segments.push({ x1, y1, x2, y2, lanes });
}

function buildRoadSegments() {
  const segments = [];
  for (const vx of V_ROADS) {
    const maxY = vx >= 2640 ? 1940 : 2400;
    addRoadSegment(segments, vx, 320, vx, maxY, vx === 1520 ? 4 : 2);
  }
  for (const hy of H_ROADS) {
    const maxX = hy === 2400 ? 2080 : 3220;
    addRoadSegment(segments, 460, hy, maxX, hy, hy === 860 || hy === 1420 ? 4 : 2);
  }
  return segments;
}

function isInsideHarborWater(x, y) {
  if (x < 2240 || y < 2010) return false;
  // Pier 1 and Pier 2 jut southward into the harbor basin
  const onPier1 = x >= 2350 && x <= 2650 && y >= 2010 && y <= 2480;
  const onPier2 = x >= 2850 && x <= 3180 && y >= 2010 && y <= 2480;
  const onEastQuay = x >= 3360 && x <= 3540 && y >= 2010 && y <= 2380;
  return !(onPier1 || onPier2 || onEastQuay);
}

function buildBuildings(rand) {
  const buildings = [];
  const props = [];
  const lamps = [];

  const pushBld = (x, y, w, h, height, wallColor, roofColor, accent, style, windows = false, helipad = false, neon = null) => {
    buildings.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), height, wallColor, roofColor, accent, style, windows, helipad, neon });
  };

  const edge = ROAD_HALF + SIDEWALK;
  const xCols = V_ROADS.slice(0, -1).map((x, i) => ({ x0: x + edge, x1: V_ROADS[i + 1] - edge }));
  const yRows = H_ROADS.slice(0, -1).map((y, i) => ({ y0: y + edge, y1: H_ROADS[i + 1] - edge }));

  const neonSigns = [
    { label: 'SOLARA CLUB', color: '#ff7b54' },
    { label: 'OASIS MOTEL', color: '#28c7b7' },
    { label: 'APEX GEAR', color: '#ffd166' },
    { label: 'HOTEL MIRAGE', color: '#ff9f43' },
    { label: 'BAY MOTORS', color: '#4de1ff' },
    { label: 'NIGHT MARKET', color: '#f25f5c' },
  ];

  const STYLES = {
    downtown: { colors: ['#2e3b4e', '#36465d', '#43536b', '#2b394a', '#4d5d73'], roof: '#232c3b', minH: 85, maxH: 168, style: 'tower', winProb: 1 },
    palm: { colors: ['#e8c6a8', '#f0d8bd', '#d9b59c', '#cfe3df', '#eed3b8'], roof: '#c77452', minH: 46, maxH: 86, style: 'villa', winProb: 1 },
    industrial: { colors: ['#69544b', '#525b66', '#726158', '#48505a'], roof: '#353a42', minH: 52, maxH: 92, style: 'warehouse', winProb: 0.3 },
    harbor: { colors: ['#4c5d70', '#5a6875', '#3d5163'], roof: '#33404e', minH: 48, maxH: 88, style: 'warehouse', winProb: 0.45 },
  };

  for (let r = 0; r < yRows.length; r += 1) {
    for (let c = 0; c < xCols.length; c += 1) {
      if (r === 3 && c >= 3) continue;
      const box = { x: xCols[c].x0, y: yRows[r].y0, w: xCols[c].x1 - xCols[c].x0, h: yRows[r].y1 - yRows[r].y0 };
      const cx = box.x + box.w * 0.5;
      const cy = box.y + box.h * 0.5;
      const dist = getDistrictAt(cx, cy);

      if (r === 0 && c === 2) {
        props.push({ kind: 'fountain', x: cx, y: cy, r: 58 });
        for (const [dx, dy] of [[16, 16], [box.w - 120, 16], [16, box.h - 120], [box.w - 120, box.h - 120]]) {
          pushBld(box.x + dx, box.y + dy, 104, 104, rand.range(115, 165), rand.pick(STYLES.downtown.colors), '#212b3a', '#ffd166', 'tower', true, rand.chance(0.45), rand.chance(0.5) ? rand.pick(neonSigns) : null);
        }
        continue;
      }
      if (r === 1 && c === 2) {
        pushBld(box.x + 18, box.y + 18, box.w - 36, 132, 82, '#364354', '#25303f', '#f7a531', 'commercial', true, false, { label: 'ARMORY DEPOT', color: '#ffd166' });
        pushBld(box.x + 18, box.y + box.h - 134, 165, 116, 112, '#313f52', '#1f2836', '#4de1ff', 'tower', true);
        continue;
      }
      if (r === 1 && c === 4) {
        pushBld(box.x + 22, box.y + 22, box.w - 44, 120, 62, '#5c524c', '#393b40', '#28c7b7', 'warehouse', false, false, { label: 'COSTA CUSTOMS', color: '#28c7b7' });
        props.push({ kind: 'silo', x: box.x + 80, y: box.y + box.h - 80, r: 34 }, { kind: 'silo', x: box.x + 165, y: box.y + box.h - 80, r: 34 });
        continue;
      }
      if (r === 0 && c === 0) {
        pushBld(box.x + 24, box.y + 24, 190, 140, 56, '#f2dac1', '#c96f4b', '#28c7b7', 'villa', true, false, { label: 'VEGA SAFEHOUSE', color: '#28c7b7' });
        props.push({ kind: 'pool', x: box.x + 275, y: box.y + 92, w: 96, h: 64 });
        pushBld(box.x + 24, box.y + box.h - 140, box.w - 48, 116, 68, '#e6c5a3', '#b9694b', '#ffd166', 'villa', true);
        continue;
      }

      const splitVert = rand.chance(0.5);
      const pad = 14;
      const halfW = (box.w - pad * 2 - 34) * 0.5;
      const halfH = (box.h - pad * 2 - 34) * 0.5;
      const rects = splitVert
        ? [{ x: box.x + pad, y: box.y + pad, w: halfW, h: box.h - pad * 2 }, { x: box.x + pad + halfW + 34, y: box.y + pad, w: halfW, h: box.h - pad * 2 }]
        : [{ x: box.x + pad, y: box.y + pad, w: box.w - pad * 2, h: halfH }, { x: box.x + pad, y: box.y + pad + halfH + 34, w: box.w - pad * 2, h: halfH }];
      const st = STYLES[dist.id] ?? STYLES.downtown;
      for (const rect of rects) {
        pushBld(rect.x, rect.y, rect.w, rect.h, rand.range(st.minH, st.maxH), rand.pick(st.colors), st.roof, dist.accent, st.style, rand.chance(st.winProb), st.style === 'tower' && rand.chance(0.22), st.style === 'tower' && rand.chance(0.42) ? rand.pick(neonSigns) : null);
      }
    }
  }

  const containerColors = ['#d9534f', '#28a0b8', '#e69d38', '#3c8c64', '#c9623b'];
  const containerSpots = [
    [2410, 2120], [2495, 2120], [2410, 2168], [2410, 2260], [2495, 2260], [2540, 2350],
    [2900, 2110], [2990, 2110], [2900, 2220], [2990, 2220], [2900, 2330],
    [3395, 2090], [3395, 2170], [3395, 2250],
  ];
  for (let i = 0; i < containerSpots.length; i += 1) {
    const col = containerColors[i % containerColors.length];
    pushBld(containerSpots[i][0], containerSpots[i][1], 74, 30, 30 + (i % 2) * 14, col, col, '#f4f6fa', 'container');
  }

  props.push({ kind: 'crane', x: 2610, y: 2180, w: 120, h: 42 }, { kind: 'crane', x: 3130, y: 2260, w: 130, h: 42 }, { kind: 'ship', x: 3205, y: 2080, w: 125, h: 410 });
  for (let py = 240; py <= 2380; py += 125) {
    props.push({ kind: 'palm', x: 348 + Math.sin(py * 0.01) * 10, y: py, scale: 1.0 + (py % 3) * 0.08 });
    if (py % 250 === 0) {
      props.push({ kind: 'palm', x: 545, y: py + 40, scale: 0.92 }, { kind: 'umbrella', x: 245, y: py + 20, color: py % 500 === 0 ? '#f06449' : '#28c7b7' });
    }
  }
  props.push({ kind: 'lifeguard', x: 256, y: 680, w: 34, h: 34 }, { kind: 'lifeguard', x: 256, y: 1580, w: 34, h: 34 });
  for (let py = 440; py < 2300; py += 210) {
    props.push({ kind: 'palm', x: 896, y: py, scale: 0.9 }, { kind: 'palm', x: 1435, y: py + 80, scale: 0.88 });
  }
  for (const vx of V_ROADS) {
    for (const hy of H_ROADS) {
      if (vx >= 2640 && hy >= 2400) continue;
      lamps.push({ x: vx - ROAD_HALF - 12, y: hy - ROAD_HALF - 12, color: vx <= 980 ? '#4de1ff' : '#ffbf69' });
      lamps.push({ x: vx + ROAD_HALF + 12, y: hy + ROAD_HALF + 12, color: vx <= 980 ? '#4de1ff' : '#ffbf69' });
    }
  }
  return { buildings, props, lamps };
}

function buildTrafficSignals() {
  const signals = [];
  for (let i = 0; i < V_ROADS.length; i += 1) {
    for (let j = 0; j < H_ROADS.length; j += 1) {
      const vx = V_ROADS[i];
      const hy = H_ROADS[j];
      if (vx >= 2640 && hy >= 2400) continue;
      signals.push({
        x: vx,
        y: hy,
        phaseOffset: (i + j) * 2.5,
      });
    }
  }
  return signals;
}

export function createCity(rand) {
  const segments = buildRoadSegments();
  const { buildings, props, lamps } = buildBuildings(rand);
  const signals = buildTrafficSignals();

  const landmarks = [
    { id: 'armory_dt', kind: 'armory', name: 'Downtown Armory', x: 1800, y: 1218, radius: 34, color: '#ffd166' },
    { id: 'armory_harbor', kind: 'armory', name: 'Dockside Arms', x: 2490, y: 2010, radius: 34, color: '#ffd166' },
    { id: 'garage_ind', kind: 'garage', name: 'Costa Customs', x: 2930, y: 1215, radius: 48, color: '#28c7b7' },
    { id: 'garage_palm', kind: 'garage', name: 'Sunset Bodyshop', x: 720, y: 1200, radius: 48, color: '#28c7b7' },
    { id: 'safehouse', kind: 'safehouse', name: 'Vega Safehouse', x: 720, y: 635, radius: 36, color: '#37c978' },
  ];

  // Traffic light cycle: 12s period (0..5s NS green, 5..6s NS yellow, 6..11s EW green, 11..12s EW yellow)
  function getSignalState(signal, time) {
    const t = (time + signal.phaseOffset) % 12;
    if (t < 5) return { ns: 'green', ew: 'red' };
    if (t < 6) return { ns: 'yellow', ew: 'red' };
    if (t < 11) return { ns: 'red', ew: 'green' };
    return { ns: 'red', ew: 'yellow' };
  }

  function isPointBlocked(x, y, radius) {
    if (x < WORLD.waterWidth + 32 + radius || x > WORLD.width - 36 - radius) return true;
    if (y < 36 + radius || y > WORLD.height - 36 - radius) return true;
    if (isInsideHarborWater(x, y)) return true;
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (
        x + radius > b.x &&
        x - radius < b.x + b.w &&
        y + radius > b.y &&
        y - radius < b.y + b.h
      ) {
        return true;
      }
    }
    return false;
  }

  function resolveCircleCollisions(entity, radius) {
    entity.x = clamp(entity.x, WORLD.waterWidth + 32 + radius, WORLD.width - 36 - radius);
    entity.y = clamp(entity.y, 36 + radius, WORLD.height - 36 - radius);
    if (isInsideHarborWater(entity.x, entity.y)) {
      entity.y = Math.min(entity.y, 2008 - radius);
    }

    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      const closestX = clamp(entity.x, b.x, b.x + b.w);
      const closestY = clamp(entity.y, b.y, b.y + b.h);
      const dx = entity.x - closestX;
      const dy = entity.y - closestY;
      const distSq = dx * dx + dy * dy;
      if (distSq < radius * radius) {
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          entity.x += (dx / dist) * overlap;
          entity.y += (dy / dist) * overlap;
        } else {
          entity.y = b.y - radius;
        }
      }
    }
  }

  function hasLineOfSight(x1, y1, x2, y2) {
    const steps = Math.max(4, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 36));
    for (let s = 1; s < steps; s += 1) {
      const t = s / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      for (let i = 0; i < buildings.length; i += 1) {
        const b = buildings[i];
        if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return false;
      }
    }
    return true;
  }

  function findNearestRoadPoint(x, y) {
    let bestX = V_ROADS[0];
    let bestDx = Math.abs(x - bestX);
    for (const vx of V_ROADS) {
      const d = Math.abs(x - vx);
      if (d < bestDx) {
        bestDx = d;
        bestX = vx;
      }
    }
    let bestY = H_ROADS[0];
    let bestDy = Math.abs(y - bestY);
    for (const hy of H_ROADS) {
      const d = Math.abs(y - hy);
      if (d < bestDy) {
        bestDy = d;
        bestY = hy;
      }
    }
    if (bestDx < bestDy) return { x: bestX, y: clamp(y, 320, 2400) };
    return { x: clamp(x, 460, bestY === 2400 ? 2080 : 3220), y: bestY };
  }

  return {
    width: WORLD.width,
    height: WORLD.height,
    vRoads: V_ROADS,
    hRoads: H_ROADS,
    segments,
    buildings,
    props,
    lamps,
    signals,
    landmarks,
    getDistrictAt,
    getSignalState,
    isInsideHarborWater,
    isPointBlocked,
    resolveCircleCollisions,
    hasLineOfSight,
    findNearestRoadPoint,
    hash2D,
  };
}
