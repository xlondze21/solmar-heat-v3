// Every tuning number, colour and city fact in one place. The world is a fixed 2560x2680
// logical area; the camera shows a 1280x720 window of it and the renderer scales that to the
// screen, so no rule below depends on the display size.

export const WORLD = { width: 2560, height: 2680, landBottom: 2430, beachTop: 2440, waterTop: 2540 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

// A 12x12 road grid: vertical roads at 120 + i*210, horizontal at 120 + j*210.
export const ROADS = { count: 12, first: 120, gap: 210, width: 64 };
export const ROAD_X = (i) => ROADS.first + i * ROADS.gap;
export const ROAD_Y = (j) => ROADS.first + j * ROADS.gap;

export const PLAYER = {
  radius: 11,
  walkSpeed: 195,
  runSpeed: 265,
  hp: 100,
  punchRange: 34,
  punchDamage: 18,
  punchCooldown: 0.42,
};

export const CAR = {
  sedan: { length: 46, width: 22, accel: 340, brake: 520, topSpeed: 430, reverse: 150, grip: 2.6, hp: 120, price: 0, color: '#c94f5e' },
  taxi: { length: 46, width: 22, accel: 320, brake: 500, topSpeed: 400, reverse: 140, grip: 2.5, hp: 120, price: 800, color: '#f2c94c' },
  truck: { length: 58, width: 26, accel: 230, brake: 420, topSpeed: 320, reverse: 110, grip: 2.0, hp: 220, price: 1500, color: '#7d8aa0' },
  sports: { length: 48, width: 22, accel: 460, brake: 620, topSpeed: 560, reverse: 170, grip: 3.4, hp: 100, price: 4000, color: '#e5539e', rep: 20 },
  cruiser: { length: 48, width: 22, accel: 400, brake: 600, topSpeed: 500, reverse: 160, grip: 3.0, hp: 160, price: 0, color: '#3f6fd8' },
};

export const HELI = {
  radius: 20,
  hp: 120,
  speed: 600,
  climb: 130,
  maxAlt: 210,
  respawnDelay: 45,
};

export const BOAT = { length: 54, width: 24, accel: 260, topSpeed: 380, grip: 1.6, hp: 140 };

export const WANTED = {
  max: 5,
  decayQuiet: 20, // seconds with no crime and no cop near before one star drops
  decayStep: 15,
  bustHold: 2.5, // seconds a cruiser must hold the player still to bust them
  bustRange: 52,
};

// A cruiser's ram: hp per second it takes off the player's car, and px per second it shoves it.
export const POLICE = { ram: 26 };

export const MISSIONS = { repPerMission: 10 };

export const PRICES = { ammoBox: 50, ammoCount: 12, paintJob: 100, boatFare: 0 };

export const TIDE = { period: 150, lowBelow: 0.35 }; // tide 0..1; beach road opens under lowBelow
export const DAY = { period: 240 }; // full day/night cycle, seconds; 0 dawn, .25 noon, .5 dusk, .75 night

export const GANGS = [
  { name: 'VIPERS', color: '#a55eea', x: 0, y: 0, w: 1100, h: 1100 },
  { name: 'GULLS', color: '#2bcbba', x: 1500, y: 500, w: 1060, h: 1300 },
  { name: 'PALMEROS', color: '#fd9644', x: 0, y: 1500, w: 1100, h: 930 },
];

export const SPOTS = {
  hospital: { x: ROAD_X(2) + 60, y: ROAD_Y(2) + 60, label: 'St. Marina Hospital' },
  helipad: { x: ROAD_X(2) + 105, y: ROAD_Y(2) + 105, label: 'Helipad' },
  safehouse: { x: ROAD_X(10) + 70, y: ROAD_Y(1) + 60, label: 'Safehouse' },
  garage: { x: ROAD_X(1) + 70, y: ROAD_Y(10) + 60, label: 'Rico\'s Garage' },
  gunshop: { x: ROAD_X(5) + 70, y: ROAD_Y(5) + 60, label: 'Ammo-Nation' },
  paintshop: { x: ROAD_X(9) + 70, y: ROAD_Y(8) + 60, label: 'Spray & Shine' },
  fishmarket: { x: ROAD_X(3) + 70, y: ROAD_Y(10) + 60, label: 'Fish Market' },
  marina: { x: 420, y: 2490, label: 'Solmar Marina' },
  casino: { x: ROAD_X(6) + 70, y: ROAD_Y(3) + 60, label: 'Casino del Sol' },
  beachStart: { x: 300, y: 2490, label: 'South Beach' },
};

export const PALETTE = {
  backdrop: '#0d0f16',
  grass: '#3d4a2f',
  block: '#4a4640',
  blockAlt: '#54483a',
  roof: '#6b5a48',
  roofAlt: '#5d6b7a',
  road: '#26262e',
  roadLine: '#d8c25a',
  sidewalk: '#55504a',
  sand: '#d9c08a',
  water: '#1d5f7a',
  waterDeep: '#144a61',
  player: '#ffd166',
  ped: '#e8e3d8',
  cop: '#3f6fd8',
  heli: '#c8ccd4',
  boat: '#f2f2f2',
  panel: 'rgba(16, 18, 28, 0.88)',
  text: '#eef1f5',
  muted: '#9aa1b1',
  gold: '#f2c94c',
  danger: '#e5534b',
  neonPink: '#ff5da2',
  neonCyan: '#3ee6d8',
  neonAmber: '#ffb347',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar-heat.save.v3';
