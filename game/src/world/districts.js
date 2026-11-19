// District boundaries, lighting accents, and interactive world landmarks for Solara Bay.

export const DISTRICTS = [
  { id: 'palm', name: 'Palm Boulevard', short: 'PALM BLVD', x: 0, y: 0, w: 1260, h: 2600, accent: '#28c7b7', lampColor: '#38d9f5', wetAsphalt: 0.28 },
  { id: 'downtown', name: 'Downtown Neon', short: 'DOWNTOWN', x: 1260, y: 0, w: 1180, h: 1420, accent: '#f7a531', lampColor: '#ffbf69', wetAsphalt: 0.72 },
  { id: 'industrial', name: 'Industrial Yard', short: 'INDUSTRIAL', x: 2440, y: 0, w: 1160, h: 1420, accent: '#e76f51', lampColor: '#ff9f43', wetAsphalt: 0.42 },
  { id: 'harbor', name: 'Harbor Docks', short: 'HARBOR', x: 1260, y: 1420, w: 2340, h: 1180, accent: '#3fa9f5', lampColor: '#38d9f5', wetAsphalt: 0.65 },
];

export const LANDMARKS = [
  { id: 'armory_dt', kind: 'armory', district: 'downtown', name: 'Downtown Armory', x: 1800, y: 1218, radius: 34, color: '#ffd166' },
  { id: 'armory_harbor', kind: 'armory', district: 'harbor', name: 'Dockside Arms', x: 2490, y: 2010, radius: 34, color: '#ffd166' },
  { id: 'garage_ind', kind: 'garage', district: 'industrial', name: 'Costa Customs', x: 2930, y: 1215, radius: 50, color: '#28c7b7' },
  { id: 'garage_palm', kind: 'garage', district: 'palm', name: 'Sunset Bodyshop', x: 720, y: 1200, radius: 48, color: '#28c7b7' },
  { id: 'safehouse', kind: 'safehouse', district: 'palm', name: 'Vega Safehouse', x: 720, y: 635, radius: 36, color: '#37c978' },
];

export function getDistrictAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  return DISTRICTS[1];
}
