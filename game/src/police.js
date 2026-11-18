// The wanted response: police cruisers that spawn at the edge of town and hunt the player
// along the road graph, ramming and, when they hold the player still, busting them; and the
// police helicopter that arrives at three stars, circles overhead with a spotlight and calls
// in more ground units. Pure state updates: no drawing, no browser.

import { CAR, DAY, HELI, ROAD_X, ROAD_Y, SPOTS, WANTED, WORLD } from './config.js';
import { angleDiff, clamp, dist, nearestNode, nodeNeighbours, nodePos } from './util.js';

function spawnCruiser(state, random) {
  const p = state.player;
  // Spawn on a road at the edge of the player's view, far enough to drive in.
  const edge = random.pick(['n', 's', 'e', 'w']);
  let x = p.x;
  let y = p.y;
  if (edge === 'n') { x = p.x + random.range(-500, 500); y = p.y - 620; }
  if (edge === 's') { x = p.x + random.range(-500, 500); y = p.y + 620; }
  if (edge === 'e') { x = p.x + 620; y = p.y + random.range(-500, 500); }
  if (edge === 'w') { x = p.x - 620; y = p.y + random.range(-500, 500); }
  x = clamp(x, 60, WORLD.width - 60);
  y = clamp(y, 60, WORLD.landBottom - 60);
  // Snap onto the nearest road.
  const node = nearestNode(x, y);
  const pos = nodePos(node.i, node.j);
  const v = {
    id: 100000 + Math.floor(random.range(0, 89999)),
    kind: 'cruiser', x: pos.x, y: pos.y, angle: 0, speed: 0,
    hp: CAR.cruiser.hp, color: CAR.cruiser.color, driver: 'cop',
    node, target: null, lane: 14, stopped: false, wrecked: false,
  };
  state.vehicles.push(v);
  return v;
}

function copCount(state) {
  let n = 0;
  for (const v of state.vehicles) if (v.driver === 'cop') n += 1;
  return n;
}

export function updatePolice(state, city, dt, random, fx) {
  const p = state.player;
  const noonHeat = state.dayTime > 0.2 && state.dayTime < 0.35 ? 1.3 : 1; // noon heat: faster cops
  let busted = false;

  // Keep the cruiser count at the wanted level (none when clean).
  const want = state.wanted;
  let cops = copCount(state);
  if (want > 0 && cops < want) {
    spawnCruiser(state, random);
    cops += 1;
  }
  if (want === 0) {
    // Stand down: cruisers already far away become traffic again.
    for (const v of state.vehicles) {
      if (v.driver === 'cop' && dist(p.x, p.y, v.x, v.y) > 700) v.driver = 'traffic';
    }
  }

  const playerSpeed = p.mode === 'car' && p.vehicleId !== null
    ? Math.abs((state.vehicles.find((v) => v.id === p.vehicleId) || { speed: 0 }).speed)
    : 0;

  // The bust is judged once per step, across all cruisers: a single far cruiser must not
  // cancel the one holding the player. Track the nearest cruiser here, judge below.
  let nearestCopDist = Infinity;
  for (const cop of state.vehicles) {
    if (cop.driver !== 'cop' || cop.wrecked) continue;
    const spec = CAR.cruiser;
    const d = dist(cop.x, cop.y, p.x, p.y);
    nearestCopDist = Math.min(nearestCopDist, d);
    const targetNode = nearestNode(p.x, p.y);

    if (d < 260) {
      // Close in: steer straight at the player and ram.
      const wantAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.angle += clamp(angleDiff(cop.angle, wantAngle), -3.2 * dt, 3.2 * dt);
      cop.speed = Math.min(spec.topSpeed * noonHeat, cop.speed + spec.accel * dt);
      cop.node = nearestNode(cop.x, cop.y);
      cop.target = null;
    } else {
      // Hunt along the graph toward the player's node.
      if (!cop.target || (cop.node.i === targetNode.i && cop.node.j === targetNode.j)) {
        const options = nodeNeighbours(cop.node.i, cop.node.j);
        // Greedy: the neighbour closest to the player.
        let best = options[0];
        let bestD = Infinity;
        for (const n of options) {
          const pos = nodePos(n.i, n.j);
          const dd = dist(pos.x, pos.y, p.x, p.y);
          if (dd < bestD) {
            bestD = dd;
            best = n;
          }
        }
        cop.prev = { i: cop.node.i, j: cop.node.j };
        cop.target = best;
      }
      const from = nodePos(cop.node.i, cop.node.j);
      const to = nodePos(cop.target.i, cop.target.j);
      const wantAngle = Math.atan2(to.y - from.y, to.x - from.x);
      cop.angle += clamp(angleDiff(cop.angle, wantAngle), -2.6 * dt, 2.6 * dt);
      cop.speed = Math.min(spec.topSpeed * 0.85 * noonHeat, cop.speed + spec.accel * 0.8 * dt);
      if (dist(cop.x, cop.y, to.x, to.y) < 30) {
        cop.node = { i: cop.target.i, j: cop.target.j };
        cop.target = null;
      }
    }
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = clamp(cop.x, 40, 2520);
    cop.y = clamp(cop.y, 40, 2400);

    // Ram: contact with the player's car damages it; contact on foot hurts the player.
    if (d < 44) {
      if (p.mode === 'car') {
        const pv = state.vehicles.find((v) => v.id === p.vehicleId);
        if (pv && pv.hp > 0) {
          pv.hp -= 26 * dt;
          // Shove the player's car sideways.
          pv.x += Math.cos(cop.angle) * 26 * dt;
          pv.y += Math.sin(cop.angle) * 26 * dt;
        }
      } else if (p.mode === 'foot' && p.invuln <= 0) {
        p.hp -= 12;
        p.invuln = 0.8;
        fx.toast('The police are on you!');
      }
    }

    if (cop.hp <= 0 && !cop.wrecked) {
      cop.wrecked = true;
      cop.speed = 0;
      fx.boom(cop.x, cop.y);
      fx.addCrime(2, cop.x, cop.y);
      fx.toast('Cop car down! +2 stars.');
    }
  }

  // Bust, judged once per step: a cruiser holding the player still, close, for long enough.
  if (nearestCopDist < WANTED.bustRange && playerSpeed < 30 && p.mode !== 'heli' && p.mode !== 'boat') {
    p.bustTimer += dt;
    if (p.bustTimer >= WANTED.bustHold) {
      busted = true;
      p.bustTimer = 0;
      if (fx.sfx) fx.sfx('busted');
    }
  } else {
    p.bustTimer = Math.max(0, p.bustTimer - dt * 2);
  }

  return { busted };
}

export function updateHeli(state, dt, random, fx) {
  const p = state.player;
  const heli = state.heli;

  if (heli.respawnIn > 0) heli.respawnIn -= dt;

  if (state.wanted >= 3 && !heli.active && heli.respawnIn <= 0 && p.mode !== 'heli') {
    heli.active = true;
    heli.hp = HELI.hp;
    heli.x = p.x + 420;
    heli.y = p.y - 320;
    heli.alt = 180;
    heli.angle = 0;
    fx.toast('Police helicopter overhead!');
  }
  if (state.wanted < 2 && heli.active) {
    heli.active = false;
  }
  if (!heli.active) return;

  // Circle the player, keeping overhead.
  const wantAngle = Math.atan2(p.y - heli.y, p.x - heli.x);
  heli.angle += clamp(angleDiff(heli.angle, wantAngle), -2.5 * dt, 2.5 * dt);
  const d = dist(heli.x, heli.y, p.x, p.y);
  const speed = d > 120 ? HELI.speed : HELI.speed * 0.4;
  heli.x += Math.cos(heli.angle) * speed * dt;
  heli.y += Math.sin(heli.angle) * speed * dt;
  heli.alt = 150 + Math.sin(state.time * 0.7) * 18;

  if (heli.hp <= 0) {
    heli.active = false;
    heli.respawnIn = HELI.respawnDelay;
    fx.boom(heli.x, heli.y);
    fx.toast('Police helicopter shot down!');
    fx.addCrime(1, heli.x, heli.y);
  }
}
