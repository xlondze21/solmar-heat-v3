// The game's rules and state, with no drawing and no browser in it: the city, the player, the
// wanted level, the day/night cycle and the tide. step() advances one fixed step and hands the
// subsystems (traffic, police, missions, combat, garage, radio) the state to work on. Nothing
// here allocates after createWorld returns, except particles and toasts, which are pooled by
// reuse in place.

import { BOAT, CAR, DAY, GANGS, HELI, PLAYER, PRICES, ROADS, ROAD_X, ROAD_Y, SAVE_KEY, SPOTS, TIDE, WANTED, WORLD } from './config.js';
import { createRandom } from './random.js';
import { angleDiff, clamp, dist, lerp, nearestNode, nodeNeighbours, nodePos, onRoad, pointInRect } from './util.js';
import { updateTraffic, updatePeds } from './traffic.js';
import { updatePolice, updateHeli } from './police.js';
import { updateMissions } from './missions.js';
import { updateCombat } from './combat.js';
import { updateGarage } from './garage.js';
import { createRadio } from './radio.js';

export const EVENT_NONE = 0;

let nextVehicleId = 1;

/** Push a circle out of every building rect it overlaps; returns the corrected position. */
export function collideBuildings(city, x, y, r) {
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 0.01) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      y = cy + (dy / d) * r;
    } else {
      // Centre inside the rect: push out along the smallest penetration.
      const left = x - b.x;
      const right = b.x + b.w - x;
      const top = y - b.y;
      const bottom = b.y + b.h - y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = b.x - r;
      else if (m === right) x = b.x + b.w + r;
      else if (m === top) y = b.y - r;
      else y = b.y + b.h + r;
    }
  }
  return { x, y };
}

function generateCity(random) {
  const buildings = [];
  const palms = [];
  const neons = [];
  // One or two buildings per city block, inset from the roads, seeded sizes and colours.
  for (let i = 0; i < ROADS.count - 1; i += 1) {
    for (let j = 0; j < ROADS.count - 1; j += 1) {
      const bx = ROAD_X(i) + 52;
      const by = ROAD_Y(j) + 52;
      const bw = ROADS.gap - 104;
      const bh = ROADS.gap - 104;
      if (random.chance(0.82)) {
        const w = random.range(bw * 0.4, bw * 0.62);
        const h = random.range(bh * 0.4, bh * 0.62);
        buildings.push({
          x: bx + random.range(0, bw - w),
          y: by + random.range(0, bh - h),
          w, h,
          color: random.pick(['#6b5a48', '#5d6b7a', '#7a6a55', '#4f5d6e', '#8a6f4d']),
          neon: random.chance(0.3) ? random.pick(['#ff5da2', '#3ee6d8', '#ffb347', '#c084fc']) : null,
        });
      } else {
        // An empty lot: a palm or two instead of a building.
        palms.push({ x: bx + random.range(20, bw - 20), y: by + random.range(20, bh - 20) });
      }
      if (random.chance(0.5)) {
        palms.push({ x: bx + random.range(0, bw), y: by + random.range(0, bh) });
      }
    }
  }
  // The beach palms, in a loose line above the sand.
  for (let x = 160; x < WORLD.width - 100; x += 90) {
    palms.push({ x: x + random.range(-20, 20), y: WORLD.landBottom + 8 + random.range(0, 26) });
  }
  // Neon signs on a few beachfront buildings.
  for (const b of buildings) {
    if (b.y > 2000 && b.neon) neons.push({ x: b.x + b.w / 2, y: b.y, color: b.neon, text: random.pick(['SOLMAR', 'BEACH', 'TACOS', 'SURF', 'HOTEL', 'BAR']) });
  }
  return { buildings, palms, neons };
}

export function createWorld(seed, audio) {
  const random = createRandom(seed);
  const city = generateCity(random);
  const radio = createRadio(audio);

  const state = {
    time: 0,
    dayTime: 0.08, // morning
    tidePhase: 0.2,
    tide: 0.5,
    player: {
      x: ROAD_X(6), y: ROAD_Y(6), angle: -Math.PI / 2, hp: PLAYER.hp, cash: 120, rep: 0,
      onFoot: true, vehicleId: null, mode: 'foot', weapon: 'fists', ammo: 0,
      punchCd: 0, invuln: 0, safeTimer: 0, bustTimer: 0, dead: false, busted: false,
    },
    vehicles: [],
    peds: [],
    heli: { active: false, x: 0, y: 0, alt: 0, hp: HELI.hp, respawnIn: 0, angle: 0 },
    flyHeli: { x: SPOTS.helipad.x, y: SPOTS.helipad.y, angle: 0, alt: 0, state: 'parked', hp: 140 },
    boat: { x: SPOTS.marina.x, y: SPOTS.marina.y + 40, angle: 0, speed: 0, state: 'docked', hp: BOAT.hp },
    bullets: [],
    particles: [],
    wanted: 0,
    quietTimer: 99,
    decayTimer: 0,
    mission: null,
    missionsDone: [],
    owned: ['sedan'],
    garageCars: [],
    toasts: [],
    stats: { busted: 0, wasted: 0, missions: 0, crimes: 0 },
    camera: { x: ROAD_X(6), y: ROAD_Y(6) },
    lights: [
      { i: 3, j: 3, phase: 0, timer: 0 },
      { i: 8, j: 3, phase: 1, timer: 2 },
      { i: 3, j: 8, phase: 1, timer: 4 },
      { i: 8, j: 8, phase: 0, timer: 6 },
    ],
    radio: { station: 0, name: 'NEON 101', on: false },
    save: null,
  };

  function toast(text) {
    state.toasts.push({ text, t: 0 });
    if (state.toasts.length > 4) state.toasts.shift();
  }

  function gangAt(x, y) {
    for (const g of GANGS) if (pointInRect(x, y, g)) return g;
    return null;
  }

  function addCrime(n, x, y) {
    if (n <= 0) return;
    let extra = 0;
    const gang = gangAt(x, y);
    if (gang) extra = 1;
    state.wanted = Math.min(WANTED.max, state.wanted + n + extra);
    state.quietTimer = 0;
    state.stats.crimes += 1;
    if (gang) toast(`${gang.name} turf: +1 star`);
  }

  function giveCash(n) {
    state.player.cash += n;
    toast(`+$${n}`);
  }

  function saveGame() {
    try {
      const p = state.player;
      const save = {
        cash: p.cash, rep: p.rep, missionsDone: state.missionsDone.slice(),
        owned: state.owned.slice(), weapon: p.weapon, ammo: p.ammo,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      state.save = save;
    } catch {
      // Storage can be off: the save then lasts this visit only.
    }
  }

  function loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const save = JSON.parse(raw);
      if (!save || typeof save.cash !== 'number') return;
      state.player.cash = save.cash;
      state.player.rep = save.rep || 0;
      state.missionsDone = Array.isArray(save.missionsDone) ? save.missionsDone : [];
      state.owned = Array.isArray(save.owned) && save.owned.length ? save.owned : ['sedan'];
      state.player.weapon = save.weapon === 'pistol' ? 'pistol' : 'fists';
      state.player.ammo = save.ammo || 0;
      state.save = save;
    } catch {
      // A corrupt save is ignored, not fatal.
    }
  }

  function spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, Math.PI * 2);
      const v = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0, maxLife: random.range(0.4, 0.9), color, size: random.range(2, 5),
      });
    }
    if (state.particles.length > 220) state.particles.splice(0, state.particles.length - 220);
  }

  function playerVehicle() {
    if (state.player.vehicleId === null) return null;
    for (const v of state.vehicles) if (v.id === state.player.vehicleId) return v;
    return null;
  }

  function addVehicle(kind, x, y, angle, driver, color) {
    const spec = CAR[kind] || CAR.sedan;
    const v = {
      id: nextVehicleId, kind, x, y, angle, speed: 0, hp: spec.hp,
      color: color || spec.color, driver, node: nearestNode(x, y), target: null,
      lane: 14, stopped: false, wrecked: false,
    };
    nextVehicleId += 1;
    state.vehicles.push(v);
    return v;
  }

  function seedWorld() {
    loadGame();
    // Parked cars around the city, one of each stealable kind near the start.
    const kinds = ['sedan', 'taxi', 'truck', 'sports'];
    for (let k = 0; k < 10; k += 1) {
      const i = random.int(1, 10);
      const j = random.int(1, 10);
      const kind = kinds[k % kinds.length];
      addVehicle(kind, ROAD_X(i) + random.range(-20, 20), ROAD_Y(j) + random.range(-20, 20), random.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), 'parked');
    }
    // The player's owned cars, parked at the garage (the save restores them).
    state.owned.forEach((kind, slot) => {
      const spec = CAR[kind] || CAR.sedan;
      const gx = SPOTS.garage.x + 60 + (slot % 2) * 60;
      const gy = SPOTS.garage.y + 110 + Math.floor(slot / 2) * 50;
      addVehicle(kind, gx, gy, Math.PI / 2, 'owned', kind === 'sedan' ? '#ffd166' : spec.color);
      state.garageCars.push({ kind, color: kind === 'sedan' ? '#ffd166' : spec.color, x: gx, y: gy });
    });
    // Traffic.
    for (let k = 0; k < 14; k += 1) {
      const i = random.int(0, 11);
      const j = random.int(0, 11);
      addVehicle(random.pick(['sedan', 'taxi', 'truck']), ROAD_X(i), ROAD_Y(j), random.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), 'traffic');
    }
    // Pedestrians on the sidewalks.
    for (let k = 0; k < 26; k += 1) {
      const i = random.int(0, 11);
      const j = random.int(0, 11);
      state.peds.push({
        x: ROAD_X(i) + random.range(-30, 30), y: ROAD_Y(j) + random.range(-30, 30),
        angle: random.range(0, Math.PI * 2), speed: random.range(28, 55),
        color: random.pick(['#e8e3d8', '#f2a65a', '#7fb3d5', '#c39bd3', '#82e0aa']),
        state: 'walk', downTimer: 0, target: null,
      });
    }
  }

  function enterVehicle(v) {
    state.player.onFoot = false;
    state.player.mode = 'car';
    state.player.vehicleId = v.id;
    v.driver = 'player';
    v.speed = 0;
    toast(v.kind === 'sports' ? 'Sports car — nice taste.' : `In the ${v.kind}.`);
  }

  function exitVehicle() {
    const v = playerVehicle();
    if (!v) return;
    state.player.onFoot = true;
    state.player.mode = 'foot';
    state.player.vehicleId = null;
    v.driver = 'parked';
    v.speed = 0;
    // Step out beside the car.
    state.player.x = v.x + Math.cos(v.angle + Math.PI / 2) * 30;
    state.player.y = v.y + Math.sin(v.angle + Math.PI / 2) * 30;
    state.player.angle = v.angle;
  }

  function stealVehicle(v) {
    if (v.kind === 'sports' && state.player.rep < (CAR.sports.rep || 0)) {
      toast(`Need REP ${CAR.sports.rep} to steal a sports car.`);
      return false;
    }
    addCrime(1, v.x, v.y);
    enterVehicle(v);
    return true;
  }

  function respawn(kind) {
    const p = state.player;
    p.hp = PLAYER.hp;
    p.x = SPOTS.hospital.x;
    p.y = SPOTS.hospital.y + 40;
    p.angle = Math.PI / 2;
    p.onFoot = true;
    p.mode = 'foot';
    p.vehicleId = null;
    p.bustTimer = 0;
    p.invuln = 2;
    if (kind === 'busted') {
      const lost = Math.floor(p.cash * 0.15);
      p.cash = Math.max(0, p.cash - lost);
      state.wanted = 0;
      state.stats.busted += 1;
      toast(`Busted! Lost $${lost}.`);
    } else {
      const lost = Math.floor(p.cash * 0.1);
      p.cash = Math.max(0, p.cash - lost);
      state.wanted = 0;
      state.stats.wasted += 1;
      toast(`Wasted! The hospital patched you up. Lost $${lost}.`);
    }
    // Cops and the heli stand down.
    for (const v of state.vehicles) if (v.driver === 'cop') v.driver = 'traffic';
    state.heli.active = false;
    state.heli.respawnIn = 20;
  }

  function moveFoot(dt, vx, vy) {
    const p = state.player;
    const speed = PLAYER.walkSpeed;
    let nx = p.x + vx * speed * dt;
    let ny = p.y + vy * speed * dt;
    if (vx !== 0 || vy !== 0) p.angle = Math.atan2(vy, vx);
    // The sea is not for walking: the beach stops at the water.
    if (ny > WORLD.waterTop - 8) ny = WORLD.waterTop - 8;
    nx = clamp(nx, 20, WORLD.width - 20);
    ny = clamp(ny, 20, WORLD.height - 20);
    const fixed = collideBuildings(city, nx, ny, PLAYER.radius);
    p.x = fixed.x;
    p.y = fixed.y;
  }

  function moveCar(dt, vx, vy, handbrake) {
    const p = state.player;
    const v = playerVehicle();
    if (!v) {
      p.onFoot = true;
      p.mode = 'foot';
      return;
    }
    const spec = CAR[v.kind];
    // Steering follows the lateral input; throttle follows the forward input.
    const steer = vx;
    const throttle = -vy; // up (W) is forward
    if (handbrake) v.speed = lerp(v.speed, 0, Math.min(1, 6 * dt));
    else if (throttle > 0) v.speed = Math.min(spec.topSpeed, v.speed + spec.accel * dt);
    else if (throttle < 0) v.speed = Math.max(-spec.reverse, v.speed - spec.brake * 0.6 * dt);
    else v.speed = lerp(v.speed, 0, Math.min(1, 0.9 * dt));
    if (Math.abs(v.speed) > 4) {
      v.angle += steer * spec.grip * (v.speed / spec.topSpeed) * dt * (v.speed < 0 ? -1 : 1);
    }
    let nx = v.x + Math.cos(v.angle) * v.speed * dt;
    let ny = v.y + Math.sin(v.angle) * v.speed * dt;
    // The beach road opens at low tide; the sea stops cars.
    if (ny > WORLD.waterTop - 10) {
      ny = WORLD.waterTop - 10;
      v.speed *= 0.5;
    }
    if (ny > WORLD.beachTop && state.tide >= TIDE.lowBelow) {
      ny = WORLD.beachTop;
      v.speed *= 0.5;
    }
    nx = clamp(nx, 20, WORLD.width - 20);
    ny = clamp(ny, 20, WORLD.height - 20);
    const fixed = collideBuildings(city, nx, ny, 16);
    if ((fixed.x !== nx || fixed.y !== ny) && Math.abs(v.speed) > 200) {
      v.hp -= Math.floor(Math.abs(v.speed) * 0.02);
      spawnParticles(v.x, v.y, '#ffb347', 6, 120);
      v.speed *= 0.4;
    }
    v.x = fixed.x;
    v.y = fixed.y;
    p.x = v.x;
    p.y = v.y;
    p.angle = v.angle;
    if (Math.abs(v.speed) > 240) {
      // Skid marks at speed, on hard turns.
      if (Math.abs(steer) > 0.5 && random.chance(0.4)) {
        state.particles.push({
          x: v.x - Math.cos(v.angle) * 20, y: v.y - Math.sin(v.angle) * 20,
          vx: 0, vy: 0, life: 0, maxLife: 2.2, color: 'rgba(20,20,24,0.7)', size: 4,
        });
      }
    }
    if (v.hp <= 0 && !v.wrecked) {
      v.wrecked = true;
      v.speed = 0;
      spawnParticles(v.x, v.y, '#e5534b', 26, 260);
      spawnParticles(v.x, v.y, '#3a3a40', 18, 160);
      toast('Your car is wrecked!');
      exitVehicle();
    }
  }

  function moveHeli(dt, vx, vy, climb) {
    const p = state.player;
    const h = state.flyHeli;
    h.angle += vx * 1.8 * dt;
    if (climb) h.alt = Math.min(HELI.maxAlt, h.alt + HELI.climb * dt);
    else h.alt = Math.max(0, h.alt - 16 * dt); // settles without input
    const thrust = -vy * 210; // W flies forward, S pulls back
    h.x += Math.cos(h.angle) * thrust * dt;
    h.y += Math.sin(h.angle) * thrust * dt;
    h.x = clamp(h.x, 20, WORLD.width - 20);
    h.y = clamp(h.y, 20, WORLD.height - 20);
    p.x = h.x;
    p.y = h.y;
    p.angle = h.angle;
    if (h.alt <= 0 && onRoad(h.x, h.y)) {
      h.state = 'parked';
      p.mode = 'foot';
      p.onFoot = true;
      toast('Landed. The helicopter is yours to take again.');
    }
  }

  function moveBoat(dt, vx, vy) {
    const p = state.player;
    const b = state.boat;
    const throttle = -vy;
    if (throttle > 0) b.speed = Math.min(BOAT.topSpeed, b.speed + BOAT.accel * dt);
    else if (throttle < 0) b.speed = Math.max(-60, b.speed - BOAT.accel * 0.7 * dt);
    else b.speed = lerp(b.speed, 0, Math.min(1, 0.6 * dt));
    if (Math.abs(b.speed) > 8) b.angle += vx * BOAT.grip * (b.speed / BOAT.topSpeed) * dt;
    let nx = b.x + Math.cos(b.angle) * b.speed * dt;
    let ny = b.y + Math.sin(b.angle) * b.speed * dt;
    // Boats stay in the water.
    if (ny < WORLD.waterTop - 6) {
      ny = WORLD.waterTop - 6;
      b.speed *= 0.6;
    }
    nx = clamp(nx, 60, WORLD.width - 60);
    ny = clamp(ny, WORLD.waterTop - 6, WORLD.height - 30);
    b.x = nx;
    b.y = ny;
    p.x = b.x;
    p.y = b.y;
    p.angle = b.angle;
    if (random.chance(0.3)) {
      state.particles.push({
        x: b.x - Math.cos(b.angle) * 26, y: b.y - Math.sin(b.angle) * 26,
        vx: 0, vy: 0, life: 0, maxLife: 0.9, color: 'rgba(220,240,255,0.8)', size: 3,
      });
    }
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const v of state.vehicles) {
      if (v.driver === 'player' || v.wrecked) continue;
      const d = dist(state.player.x, state.player.y, v.x, v.y);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  function handleInteract() {
    const p = state.player;
    if (p.mode === 'car') {
      exitVehicle();
      return;
    }
    if (p.mode === 'heli') return; // land first (Space climbs, landing parks it)
    if (p.mode === 'boat') {
      if (dist(p.x, p.y, SPOTS.marina.x, SPOTS.marina.y) < 160) {
        state.boat.state = 'docked';
        state.boat.speed = 0;
        p.mode = 'foot';
        p.onFoot = true;
        p.x = SPOTS.marina.x;
        p.y = SPOTS.marina.y - 20;
        toast('Back on the dock.');
      }
      return;
    }
    // On foot: helicopter, boat, or a car.
    if (dist(p.x, p.y, state.flyHeli.x, state.flyHeli.y) < 60 && state.flyHeli.state === 'parked') {
      state.flyHeli.state = 'flying';
      state.flyHeli.alt = 4;
      p.mode = 'heli';
      p.onFoot = false;
      toast('Helicopter: W/S fly, A/D turn, hold Space to climb. Land on a road to park.');
      return;
    }
    if (dist(p.x, p.y, state.boat.x, state.boat.y) < 60 && state.boat.state === 'docked') {
      state.boat.state = 'sailing';
      p.mode = 'boat';
      p.onFoot = false;
      toast('Boat: W/S throttle, A/D steer. E by the dock to get off.');
      return;
    }
    const v = nearestCar(58);
    if (v) {
      if (v.driver === 'parked' || v.driver === 'owned') enterVehicle(v);
      else if (v.driver === 'traffic') stealVehicle(v);
      return;
    }
    // Gun shop: buy ammo.
    if (dist(p.x, p.y, SPOTS.gunshop.x, SPOTS.gunshop.y) < 90) {
      if (p.cash >= PRICES.ammoBox) {
        p.cash -= PRICES.ammoBox;
        p.ammo += PRICES.ammoCount;
        p.weapon = 'pistol';
        toast(`Bought ${PRICES.ammoCount} bullets. Press G or click to shoot.`);
      } else {
        toast(`Ammo costs $${PRICES.ammoBox}.`);
      }
    }
  }

  const fx = {
    addCrime,
    toast,
    giveCash,
    saveGame,
    addVehicle,
    boom(x, y) {
      spawnParticles(x, y, '#e5534b', 30, 300);
      spawnParticles(x, y, '#ffb347', 20, 220);
      spawnParticles(x, y, '#3a3a40', 16, 160);
      if (audio) audio.explosion();
    },
    sfx(name) {
      if (!audio) return;
      if (name === 'punch') audio.punch();
      else if (name === 'shot') audio.shot();
      else if (name === 'pickup') audio.pickup();
      else if (name === 'cash') audio.cash();
      else if (name === 'denied') audio.denied();
      else if (name === 'busted') audio.busted();
    },
  };

  function step(dt, ctrl) {
    state.time += dt;
    state.dayTime = (state.time / DAY.period) % 1;
    state.tidePhase = (state.time / TIDE.period) % 1;
    state.tide = 0.5 - 0.5 * Math.cos(state.tidePhase * Math.PI * 2);

    const p = state.player;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.punchCd > 0) p.punchCd = Math.max(0, p.punchCd - dt);

    // Traffic lights cycle.
    for (const light of state.lights) {
      light.timer += dt;
      if (light.timer > 7) {
        light.timer = 0;
        light.phase = 1 - light.phase;
      }
    }

    const actions = ctrl.actions || 0;
    if (actions & 4) handleInteract(); // ACT.INTERACT

    // Player movement by mode.
    if (p.mode === 'foot') moveFoot(dt, ctrl.vx, ctrl.vy);
    else if (p.mode === 'car') moveCar(dt, ctrl.vx, ctrl.vy, ctrl.handbrake);
    else if (p.mode === 'heli') moveHeli(dt, ctrl.vx, ctrl.vy, ctrl.handbrake);
    else if (p.mode === 'boat') moveBoat(dt, ctrl.vx, ctrl.vy);

    // Safehouse: standing inside a while clears the heat and saves.
    if (pointInRect(p.x, p.y, { x: SPOTS.safehouse.x - 50, y: SPOTS.safehouse.y - 50, w: 130, h: 110 })) {
      p.safeTimer += dt;
      if (p.safeTimer > 3 && state.wanted > 0) {
        state.wanted = 0;
        saveGame();
        toast('Safehouse: wanted cleared, game saved.');
        p.safeTimer = -999; // don't spam
      }
    } else {
      p.safeTimer = Math.max(0, p.safeTimer - dt * 2);
    }

    updateTraffic(state, city, dt, random);
    updatePeds(state, city, dt, random);
    const police = updatePolice(state, city, dt, random, fx);
    updateHeli(state, dt, random, fx);
    updateCombat(state, dt, ctrl, fx, audio);
    updateGarage(state, dt, ctrl, fx);
    const mission = updateMissions(state, dt, fx);
    if (mission && mission.completed) {
      giveCash(mission.reward);
      p.rep += 10;
      state.stats.missions += 1;
      state.missionsDone.push(mission.id);
      toast(`Mission complete: ${mission.title}!`);
      if (audio) audio.cash();
      saveGame();
    }

    // Wanted decay: quiet and unseen for a while, one star drops.
    if (state.wanted > 0) {
      state.quietTimer += dt;
      let nearestCop = Infinity;
      for (const v of state.vehicles) {
        if (v.driver !== 'cop') continue;
        nearestCop = Math.min(nearestCop, dist(p.x, p.y, v.x, v.y));
      }
      if (state.quietTimer > WANTED.decayQuiet && nearestCop > 350) {
        state.decayTimer += dt;
        if (state.decayTimer > WANTED.decayStep) {
          state.wanted -= 1;
          state.decayTimer = 0;
          state.quietTimer = 0;
          toast('The heat is cooling off.');
        }
      } else {
        state.decayTimer = 0;
      }
    }

    if (police.busted) respawn('busted');
    let wasWasted = false;
    if (p.hp <= 0) {
      wasWasted = true;
      respawn('wasted');
    }

    // Particles and toasts age out.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 2 * dt;
      pt.vy *= 1 - 2 * dt;
      if (pt.life >= pt.maxLife) state.particles.splice(i, 1);
    }
    for (let i = state.toasts.length - 1; i >= 0; i -= 1) {
      state.toasts[i].t += dt;
      if (state.toasts[i].t > 4) state.toasts.splice(i, 1);
    }

    // Radio follows the vehicle; the engine hum follows speed.
    const inVehicle = p.mode === 'car' || p.mode === 'heli' || p.mode === 'boat';
    radio.update(dt, inVehicle, state.radio, actions);
    if (audio) {
      const v = playerVehicle();
      audio.engine(inVehicle && v ? Math.abs(v.speed) / (CAR[v.kind].topSpeed || 400) : 0);
    }

    // Camera follows the player.
    state.camera.x = clamp(p.x - 640, 0, WORLD.width - 1280);
    state.camera.y = clamp(p.y - 360, 0, WORLD.height - 720);

    return { busted: police.busted, wasted: wasWasted, missionDone: mission && mission.completed ? mission.id : null };
  }

  function reset() {
    const keepSave = state.save;
    const fresh = createWorld(seed, audio);
    // Swap the fresh state in place so every reference the caller holds stays valid.
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, fresh.state);
    state.save = keepSave;
    if (keepSave) {
      state.player.cash = keepSave.cash;
      state.player.rep = keepSave.rep || 0;
      state.missionsDone = keepSave.missionsDone.slice();
      state.owned = keepSave.owned.slice();
      state.player.weapon = keepSave.weapon || 'fists';
      state.player.ammo = keepSave.ammo || 0;
    }
    // The fresh state already ran seedWorld; do not seed again.
  }

  seedWorld();

  return {
    state, city, radio, step, reset, saveGame, loadGame,
    addCrime, toast, giveCash, addVehicle, playerVehicle, enterVehicle, exitVehicle,
  };
}
