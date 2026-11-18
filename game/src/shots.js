// The screenshot scenes behind ?shot=cover|drive|mission|chase. Each one stages a real game
// situation from a fresh world (a car, a wanted level, a mission, a time of day) and then plays
// the rules forward for a few seconds with a simple autopilot, so the frame is what a short
// game really looks like and the same seed always gives the same frame.

import { ROAD_X, ROAD_Y, SPOTS, STEP } from './config.js';
import { MISSION_LIST, missionTarget, startMission } from './missions.js';
import { SCREEN_PLAY } from './render.js';
import { angleDiff, dist } from './util.js';

function giveCar(world, kind, x, y, angle) {
  const v = world.addVehicle(kind, x, y, angle, 'parked');
  world.enterVehicle(v);
  return v;
}

/** Steer the player (car or on foot) toward a point: {vx, vy, handbrake, actions}. */
function driveToward(state, tx, ty) {
  const p = state.player;
  const want = Math.atan2(ty - p.y, tx - p.x);
  const diff = angleDiff(p.angle, want);
  const d = dist(p.x, p.y, tx, ty);
  return {
    vx: Math.max(-1, Math.min(1, diff * 2.2)),
    vy: d > 40 ? -1 : 0,
    handbrake: false,
    actions: 0,
  };
}

function stageCover(world) {
  const { state } = world;
  state.time = 120; // dusk, and the tide is low
  giveCar(world, 'sports', ROAD_X(6), 2470, 0);
  state.wanted = 3;
  const def = MISSION_LIST.find((m) => m.id === 'gull-run');
  startMission(state, def);
  state.mission.index = 1; // "Fly over the marina buoy"
  for (let i = 0; i < 300; i += 1) {
    const target = { x: ROAD_X(9), y: 2470 };
    world.step(STEP, driveToward(state, target.x, target.y));
  }
  return { screen: SCREEN_PLAY, best: 0 };
}

function stageDrive(world) {
  const { state } = world;
  state.time = 60; // late morning
  giveCar(world, 'taxi', ROAD_X(9), ROAD_Y(6), Math.PI / 2);
  state.radio.on = true;
  state.radio.name = 'NEON 101';
  for (let i = 0; i < 360; i += 1) {
    const target = missionTarget(state) || { x: ROAD_X(10), y: ROAD_Y(9) };
    world.step(STEP, driveToward(state, target.x, target.y));
  }
  return { screen: SCREEN_PLAY, best: 0 };
}

function stageMission(world) {
  const { state } = world;
  state.time = 0; // dawn, low tide
  giveCar(world, 'sedan', 300, 2470, 0);
  const def = MISSION_LIST.find((m) => m.id === 'tide-runner');
  startMission(state, def);
  state.mission.index = 1; // the beach flags
  for (let i = 0; i < 260; i += 1) {
    const target = missionTarget(state) || { x: 1300, y: 2470 };
    world.step(STEP, driveToward(state, target.x, target.y));
  }
  return { screen: SCREEN_PLAY, best: 0 };
}

function stageChase(world) {
  const { state } = world;
  state.time = 120; // dusk
  giveCar(world, 'sports', ROAD_X(3), ROAD_Y(2), Math.PI / 2);
  state.wanted = 4;
  const def = MISSION_LIST.find((m) => m.id === 'deco-dash');
  startMission(state, def);
  for (let i = 0; i < 300; i += 1) {
    const target = missionTarget(state) || { x: ROAD_X(5), y: ROAD_Y(1) };
    world.step(STEP, driveToward(state, target.x, target.y));
  }
  return { screen: SCREEN_PLAY, best: 0 };
}

/**
 * Set `world` to the named scene (cover, drive, mission or chase; any other name is cover)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'drive') return stageDrive(world);
  if (name === 'mission') return stageMission(world);
  if (name === 'chase') return stageChase(world);
  return stageCover(world);
}
