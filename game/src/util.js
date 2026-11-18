// Pure helpers: numbers, angles and the road graph. Nothing here touches the DOM, so the
// simulation harness can import the same code the game runs.

import { ROADS, ROAD_X, ROAD_Y } from './config.js';

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Smallest signed turn from `from` to `to`, in (-PI, PI]. */
export function angleDiff(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** The road-graph node nearest a point: {i, j} grid indices. */
export function nearestNode(x, y) {
  const i = clamp(Math.round((x - ROADS.first) / ROADS.gap), 0, ROADS.count - 1);
  const j = clamp(Math.round((y - ROADS.first) / ROADS.gap), 0, ROADS.count - 1);
  return { i, j };
}

export function nodePos(i, j) {
  return { x: ROAD_X(i), y: ROAD_Y(j) };
}

export function nodeKey(i, j) {
  return i + ',' + j;
}

/** The four road neighbours of a node, inside the grid. */
export function nodeNeighbours(i, j) {
  const out = [];
  if (i > 0) out.push({ i: i - 1, j });
  if (i < ROADS.count - 1) out.push({ i: i + 1, j });
  if (j > 0) out.push({ i, j: j - 1 });
  if (j < ROADS.count - 1) out.push({ i, j: j + 1 });
  return out;
}

/** True when the point is on a road (within the road half-width of a road centreline). */
export function onRoad(x, y) {
  const hw = ROADS.width / 2;
  for (let k = 0; k < ROADS.count; k += 1) {
    if (Math.abs(x - ROAD_X(k)) <= hw) return true;
    if (Math.abs(y - ROAD_Y(k)) <= hw) return true;
  }
  return false;
}
