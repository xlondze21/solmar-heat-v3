// Traffic and pedestrians. Traffic cars drive the road graph node to node, on the right-hand
// lane, stopping for red lights and for the car ahead; pedestrians walk the sidewalks and run
// from danger. Both are pure state updates: no drawing, no browser.

import { CAR, ROADS, ROAD_X, ROAD_Y } from './config.js';
import { clamp, dist, nodeKey, nodeNeighbours, nodePos } from './util.js';

const LIGHT_RED = 0;

function lightAt(state, i, j) {
  for (const light of state.lights) if (light.i === i && light.j === j) return light;
  return null;
}

/** The next node for a car at `node`, moving along the graph (never an immediate U-turn). */
function pickNext(state, random, car) {
  const options = nodeNeighbours(car.node.i, car.node.j).filter(
    (n) => !(car.prev && n.i === car.prev.i && n.j === car.prev.j),
  );
  const pool = options.length ? options : nodeNeighbours(car.node.i, car.node.j);
  return random.pick(pool);
}

function carAhead(state, car, lookAhead) {
  for (const other of state.vehicles) {
    if (other === car || other.driver === 'player') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (forward > 0 && forward < lookAhead && side < 26) return true;
  }
  return false;
}

export function updateTraffic(state, city, dt, random) {
  const p = state.player;
  for (const car of state.vehicles) {
    if (car.driver !== 'traffic' && car.driver !== 'cop') continue;
    if (car.wrecked) continue;
    const spec = CAR[car.kind] || CAR.sedan;
    const isCop = car.driver === 'cop';
    // Cops are driven by police.js; traffic drives the graph here.
    if (isCop) continue;

    if (!car.target) {
      car.target = pickNext(state, random, car);
      car.prev = { i: car.node.i, j: car.node.j };
    }
    const target = nodePos(car.target.i, car.target.j);
    // Right-hand lane: offset perpendicular to the direction of travel.
    const from = nodePos(car.node.i, car.node.j);
    const dirX = target.x - from.x;
    const dirY = target.y - from.y;
    const len = Math.hypot(dirX, dirY) || 1;
    const ux = dirX / len;
    const uy = dirY / len;
    // Lane offset: right side of the road.
    const lx = -uy * car.lane;
    const ly = ux * car.lane;
    const tx = target.x + lx;
    const ty = target.y + ly;
    const toTarget = dist(car.x, car.y, tx, ty);
    const wantAngle = Math.atan2(ty - car.y, tx - car.x);

    // Red light: stop before the intersection when the light is against us.
    let stop = false;
    const light = lightAt(state, car.target.i, car.target.j);
    if (light && light.phase === LIGHT_RED && toTarget < 70) stop = true;
    if (carAhead(state, car, 60)) stop = true;

    const cruise = spec.topSpeed * 0.42;
    if (stop) {
      car.speed = Math.max(0, car.speed - spec.brake * dt);
    } else {
      car.speed = Math.min(cruise, car.speed + spec.accel * 0.6 * dt);
    }
    // Steer toward the target point.
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;

    if (toTarget < 26) {
      car.node = { i: car.target.i, j: car.target.j };
      car.target = null;
    }
    // Keep traffic inside the land, away from the beach.
    car.x = clamp(car.x, 40, 2520);
    car.y = clamp(car.y, 40, 2400);
  }
}

export function updatePeds(state, city, dt, random) {
  const p = state.player;
  const playerCar = p.vehicleId !== null;
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'walk';
        // Get up somewhere safe-ish: back on a sidewalk.
        ped.x = clamp(ped.x, 60, 2500);
        ped.y = clamp(ped.y, 60, 2400);
      }
      continue;
    }
    // Flee: a fast car nearby, or a gunshot.
    let threat = null;
    if (playerCar) {
      const v = state.vehicles.find((c) => c.id === p.vehicleId);
      if (v && Math.abs(v.speed) > 200 && dist(ped.x, ped.y, v.x, v.y) < 130) threat = v;
    }
    if (state._lastShot && state.time - state._lastShot < 1.5 && dist(ped.x, ped.y, state._lastShotX, state._lastShotY) < 220) {
      threat = { x: state._lastShotX, y: state._lastShotY };
    }
    if (threat) {
      ped.state = 'flee';
      ped.angle = Math.atan2(ped.y - threat.y, ped.x - threat.x);
      ped.x += Math.cos(ped.angle) * 150 * dt;
      ped.y += Math.sin(ped.angle) * 150 * dt;
      if (dist(ped.x, ped.y, threat.x, threat.y) > 320) ped.state = 'walk';
    } else {
      ped.state = 'walk';
      // Walk the sidewalk: keep to a road's edge, turn at intersections.
      if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 14) {
        const node = { i: clamp(Math.round((ped.x - ROADS.first) / ROADS.gap), 0, ROADS.count - 1), j: clamp(Math.round((ped.y - ROADS.first) / ROADS.gap), 0, ROADS.count - 1) };
        const options = nodeNeighbours(node.i, node.j);
        const next = random.pick(options);
        const pos = nodePos(next.i, next.j);
        ped.target = { x: pos.x + random.range(-34, 34), y: pos.y + random.range(-34, 34) };
      }
      const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      let diff = want - ped.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.angle += clamp(diff, -3 * dt, 3 * dt);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    ped.x = clamp(ped.x, 40, 2520);
    ped.y = clamp(ped.y, 40, 2520);
    // The sea stops pedestrians too.
    if (ped.y > 2520) ped.y = 2520;
  }
}
