// Core constants, dusk-to-night color palette, 6 vehicle classes, 4 weapons, garage mods, and player specs.

export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3600, height: 2600, beachWidth: 270, waterWidth: 165, blockSize: 380, roadWidth: 124, sidewalkWidth: 26 };
export const STEP = 1 / 60;
export const SAVE_PREFIX = 'solara_bay_heatline_v2_';
export const UI_FONT = '"Bahnschrift", "DIN Alternate", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
export const MONO_FONT = '"JetBrains Mono", "SF Mono", "Consolas", monospace';

export const COLORS = {
  backdrop: '#070c15', oceanDeep: '#083247', oceanMid: '#0f5e7a', oceanShallow: '#1b829c', oceanFoam: '#9be7f0',
  sandLight: '#d9bc8c', sandWarm: '#bf9b63', asphalt: '#141b26', asphaltWet: '#1a2332', laneLine: '#e8b954',
  crosswalk: '#cfd8e4', sidewalk: '#8e8679', sidewalkCurb: '#635d54', industrialGround: '#242932', dockConcrete: '#4c5460',
  shadow: 'rgba(3,6,12,0.54)', hudPanel: 'rgba(8,13,22,0.86)', hudPanelSolid: '#0e1624', hudBorder: 'rgba(244,198,120,0.34)',
  hudAccent: '#f7a531', hudAmber: '#ffd166', hudTeal: '#28c7b7', hudCyan: '#38d9f5', hudDanger: '#f04b4c',
  hudPoliceBlue: '#2c8cff', hudText: '#f4f6fa', hudMuted: '#92a2b8', hudArmor: '#3fa9f5', hudHp: '#37c978',
};

const mkVeh = (id, name, category, length, width, maxSpeed, reverseSpeed, accel, brake, turnRate, grip, driftGrip, maxHp, mass, colors, stripe = false, siren = false, aircraft = false) =>
  ({ id, name, category, length, width, maxSpeed, reverseSpeed, accel, brake, turnRate, grip, driftGrip, maxHp, mass, colors, stripe, siren, aircraft });

export const VEHICLE_CLASSES = {
  muscle: mkVeh('muscle', 'Solara V8', 'Muscle Car', 76, 36, 545, 195, 465, 670, 3.18, 7.4, 2.3, 175, 1.25, ['#d94136', '#e07a22', '#268a80', '#d6a438', '#e6ebf2'], true),
  coupe: mkVeh('coupe', 'Kestrel GT', 'Sport Coupe', 72, 34, 635, 215, 550, 730, 3.6, 8.7, 2.7, 140, 1.0, ['#f0a326', '#21a0a0', '#f2f4f7', '#d94d3b', '#3874cb'], true),
  van: mkVeh('van', 'Atlas Hauler', 'Cargo Van', 88, 42, 395, 155, 325, 525, 2.45, 6.5, 3.1, 260, 1.9, ['#ced4da', '#4a6278', '#c88d42', '#52685b']),
  police: mkVeh('police', 'Meridian Interceptor', 'Police Cruiser', 76, 36, 595, 220, 520, 740, 3.4, 8.5, 2.6, 190, 1.38, ['#151b26'], false, true),
  armored: mkVeh('armored', 'Bastion Armored', 'SWAT Armored Truck', 96, 48, 460, 175, 370, 600, 2.38, 7.4, 3.5, 420, 2.8, ['#1a222e'], false, true),
  heli: mkVeh('heli', 'Skyhawk-7', 'Pursuit Helicopter', 94, 40, 520, 260, 420, 480, 2.8, 4.5, 4.5, 340, 2.2, ['#192434'], false, true, true),
};

export const WEAPONS = [
  { id: 'pistol', slot: 1, name: 'Kora 9mm', short: '9MM', damage: 28, fireRate: 0.22, magSize: 15, reloadTime: 1.0, pellets: 1, spread: 0.032, speed: 1240, range: 560, auto: false, cost: 0, ammoCost: 40, color: '#ffd166' },
  { id: 'smg', slot: 2, name: 'Viper-S SMG', short: 'SMG', damage: 18, fireRate: 0.082, magSize: 32, reloadTime: 1.25, pellets: 1, spread: 0.09, speed: 1200, range: 500, auto: true, cost: 650, ammoCost: 90, color: '#ff9f43' },
  { id: 'shotgun', slot: 3, name: 'Breacher 12G', short: '12G', damage: 20, fireRate: 0.6, magSize: 8, reloadTime: 1.5, pellets: 6, spread: 0.21, speed: 1100, range: 340, auto: false, cost: 1100, ammoCost: 110, color: '#ff6b4a' },
  { id: 'carbine', slot: 4, name: 'Apex Carbine', short: 'AR-4', damage: 35, fireRate: 0.12, magSize: 28, reloadTime: 1.4, pellets: 1, spread: 0.038, speed: 1460, range: 690, auto: true, cost: 1900, ammoCost: 140, color: '#38d9f5' },
];

export const PLAYER_SPEC = { radius: 13, walkSpeed: 195, sprintSpeed: 295, dodgeSpeed: 475, dodgeDuration: 0.22, dodgeCooldown: 0.88, maxHp: 100, maxArmor: 100, startCash: 500 };

export const ARMORY_UPGRADES = [
  { id: 'armor_vest', name: 'Kevlar Vest (+100 Armor)', cost: 350, kind: 'armor' },
  { id: 'medkit', name: 'Trauma Kit (Full HP)', cost: 200, kind: 'heal' },
  { id: 'hollow_point', name: 'Match Ammo (+20% Damage)', cost: 1400, kind: 'damage' },
];

export const GARAGE_MODS = [
  { id: 'turbo_tune', name: 'Twin-Turbo Tune (+16% Speed)', cost: 850, kind: 'turbo' },
  { id: 'chassis_plate', name: 'Armored Chassis (+40% Car HP)', cost: 1150, kind: 'chassis' },
  { id: 'drift_kit', name: 'Street Drift Kit (+20% Handling)', cost: 750, kind: 'handling' },
  { id: 'underglow', name: 'Cyan Neon Underglow', cost: 500, kind: 'underglow' },
];

export const GARAGE_PAINTS = [
  { id: 'crimson', label: 'Sunset Red', color: '#e04538' },
  { id: 'amber', label: 'Solar Gold', color: '#f0a326' },
  { id: 'teal', label: 'Bay Teal', color: '#21a0a0' },
  { id: 'pearl', label: 'Pearl White', color: '#eef2f7' },
  { id: 'cobalt', label: 'Night Blue', color: '#2b6cb0' },
];
