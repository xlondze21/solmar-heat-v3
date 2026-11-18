// Rico's story: ten missions across Solmar, chained in order. Each mission is a list of steps
// (go to a place, collect crates, wait out a timer, reach a wanted level, lose the heat, board
// a vehicle); the engine advances the steps, times the timed ones, and reports completion or
// failure. The world hands out the cash and REP on completion.

import { GANGS, ROAD_X, ROAD_Y, SPOTS, TIDE } from './config.js';
import { dist } from './util.js';

export const MISSION_LIST = [
  {
    id: 'first-fare', title: 'First Fare', reward: 300,
    brief: 'Rico needs a driver. Pick up the fare at the corner of 5th and Palm, then drop them at the north marina gate.',
    steps: [
      { kind: 'goto', x: ROAD_X(4), y: ROAD_Y(7), r: 60, label: 'Pick up the fare', needCar: true },
      { kind: 'goto', x: ROAD_X(9), y: ROAD_Y(2), r: 60, label: 'Drop off the fare', needCar: true },
    ],
  },
  {
    id: 'hot-delivery', title: 'Hot Delivery', reward: 400,
    brief: 'A package at the Fish Market, a buyer at the Casino del Sol. Ninety seconds. Don\'t keep him waiting.',
    steps: [
      { kind: 'goto', x: SPOTS.fishmarket.x, y: SPOTS.fishmarket.y, r: 70, label: 'Pick up the package' },
      { kind: 'goto', x: SPOTS.casino.x, y: SPOTS.casino.y, r: 70, label: 'Deliver to the casino', seconds: 90 },
    ],
  },
  {
    id: 'lose-heat', title: 'Lose the Heat', reward: 350,
    brief: 'The cops know your face now. Get two stars on you, then shake them off and come back clean.',
    steps: [
      { kind: 'wanted', min: 2, label: 'Get 2 stars of heat' },
      { kind: 'lose', label: 'Lose the heat', seconds: 120 },
    ],
  },
  {
    id: 'turf-pickup', title: 'Turf Pickup', reward: 450,
    brief: 'Three crates stashed in GULLS turf, east side. Their boys won\'t like you being there — that\'s the point.',
    steps: [
      {
        kind: 'collect', label: 'Collect the 3 crates',
        points: [
          { x: 1700, y: 800 }, { x: 2100, y: 1200 }, { x: 1900, y: 1600 },
        ],
        r: 55,
      },
    ],
  },
  {
    id: 'gull-run', title: 'The Gull Run', reward: 600,
    brief: 'The helicopter at St. Marina Hospital is ours tonight. Fly it over the marina buoy, then set down by the Fish Market.',
    steps: [
      { kind: 'board', vehicle: 'heli', label: 'Board the helicopter at the helipad' },
      { kind: 'flyTo', x: SPOTS.marina.x, y: SPOTS.marina.y + 60, r: 90, label: 'Fly over the marina buoy' },
      { kind: 'flyTo', x: SPOTS.fishmarket.x, y: SPOTS.fishmarket.y, r: 90, label: 'Fly to the Fish Market' },
    ],
  },
  {
    id: 'fish-heist', title: 'Fish Market Heist', reward: 700,
    brief: 'The market keeps its night catch in three crates. Take them, then get to the safehouse before the market wakes up.',
    steps: [
      {
        kind: 'collect', label: 'Take the 3 crates',
        points: [
          { x: SPOTS.fishmarket.x - 40, y: SPOTS.fishmarket.y + 30 },
          { x: SPOTS.fishmarket.x + 60, y: SPOTS.fishmarket.y - 20 },
          { x: SPOTS.fishmarket.x + 10, y: SPOTS.fishmarket.y + 80 },
        ],
        r: 55,
      },
      { kind: 'goto', x: SPOTS.safehouse.x, y: SPOTS.safehouse.y, r: 70, label: 'Reach the safehouse' },
    ],
  },
  {
    id: 'tide-runner', title: 'Tide Runner', reward: 650,
    brief: 'At low tide the beach road opens. Hit all five flags along the sand before the sea comes back.',
    steps: [
      { kind: 'tide', label: 'Wait for low tide' },
      {
        kind: 'collect', label: 'Hit the 5 beach flags', seconds: 100,
        points: [
          { x: 300, y: 2490 }, { x: 800, y: 2490 }, { x: 1300, y: 2490 },
          { x: 1800, y: 2490 }, { x: 2300, y: 2490 },
        ],
        r: 60,
      },
    ],
  },
  {
    id: 'deco-dash', title: 'Deco Dash', reward: 600,
    brief: 'Four checkpoints through the old town, art-deco neon and all. Seventy seconds a leg, at dusk.',
    steps: [
      { kind: 'goto', x: ROAD_X(2), y: ROAD_Y(2), r: 60, label: 'Checkpoint 1: Plaza Vieja', seconds: 70 },
      { kind: 'goto', x: ROAD_X(5), y: ROAD_Y(1), r: 60, label: 'Checkpoint 2: Deco Row', seconds: 70 },
      { kind: 'goto', x: ROAD_X(7), y: ROAD_Y(3), r: 60, label: 'Checkpoint 3: Neon Arch', seconds: 70 },
      { kind: 'goto', x: ROAD_X(4), y: ROAD_Y(4), r: 60, label: 'Checkpoint 4: The Fountain', seconds: 70 },
    ],
  },
  {
    id: 'marina-smuggle', title: 'Marina Smuggle', reward: 750,
    brief: 'A boat is waiting at the marina. Sail out to the buoy, pick up the cargo, and bring it home.',
    steps: [
      { kind: 'board', vehicle: 'boat', label: 'Board the boat at the marina' },
      { kind: 'sailTo', x: 1200, y: 2620, r: 90, label: 'Sail to the buoy' },
      { kind: 'goto', x: SPOTS.marina.x, y: SPOTS.marina.y, r: 90, label: 'Bring the cargo back to the marina' },
    ],
  },
  {
    id: 'big-score', title: 'The Big Score', reward: 1500,
    brief: 'The Casino del Sol vault. Crack it, take the heat, and get to the safehouse. This is the one they\'ll remember.',
    steps: [
      { kind: 'goto', x: SPOTS.casino.x, y: SPOTS.casino.y, r: 70, label: 'Reach the casino vault' },
      { kind: 'wait', x: SPOTS.casino.x, y: SPOTS.casino.y, r: 90, seconds: 8, label: 'Crack the vault' },
      { kind: 'goto', x: SPOTS.safehouse.x, y: SPOTS.safehouse.y, r: 70, label: 'Escape to the safehouse' },
    ],
  },
];

export function startMission(state, def) {
  state.mission = {
    id: def.id, title: def.title, brief: def.brief, reward: def.reward,
    steps: def.steps, index: 0, timer: 0, stepTimer: 0, collected: [],
  };
  state.missionCooldown = 0;
}

export function nextMissionDef(state) {
  for (const def of MISSION_LIST) {
    if (!state.missionsDone.includes(def.id)) return def;
  }
  return null;
}

export function updateMissions(state, dt, fx) {
  if (!state.mission) {
    state.missionCooldown = Math.max(0, (state.missionCooldown || 0) - dt);
    if (state.missionCooldown <= 0) {
      const def = nextMissionDef(state);
      if (def) {
        startMission(state, def);
        fx.toast(`Mission: ${def.title} — ${def.brief}`);
      }
    }
    return null;
  }

  const m = state.mission;
  const step = m.steps[m.index];
  if (!step) return null;
  const p = state.player;

  // A step that needs a car cannot be done on foot: after a grace period the mission
  // fails instead of stalling forever (a wrecked car must not soft-lock the story).
  if (step.needCar && p.mode !== 'car') {
    m.onFootTimer = (m.onFootTimer || 0) + dt;
    if (m.onFootTimer > 20) {
      fx.toast(`Mission failed: ${m.title} — you need a car for this one.`);
      state.mission = null;
      state.missionCooldown = 5;
      return { failed: true, id: m.id };
    }
  } else {
    m.onFootTimer = 0;
  }

  // Timed steps count down; running out fails the mission. A 'wait' step's seconds are its
  // own progress (cracking a vault), not a deadline, so it is exempt here.
  if (step.seconds && step.kind !== 'wait') {
    m.stepTimer += dt;
    if (m.stepTimer > step.seconds) {
      fx.toast(`Mission failed: ${m.title} — out of time.`);
      state.mission = null;
      state.missionCooldown = 5;
      return { failed: true, id: m.id };
    }
  }

  let done = false;
  if (step.kind === 'goto' || step.kind === 'flyTo' || step.kind === 'sailTo') {
    const needMode = step.kind === 'flyTo' ? 'heli' : step.kind === 'sailTo' ? 'boat' : null;
    if (!needMode || p.mode === needMode) {
      if (step.needCar && p.mode !== 'car') {
        // A fare is only picked up in a car.
      } else if (dist(p.x, p.y, step.x, step.y) < step.r) done = true;
    }
  } else if (step.kind === 'collect') {
    for (let i = 0; i < step.points.length; i += 1) {
      if (m.collected.includes(i)) continue;
      const pt = step.points[i];
      if (dist(p.x, p.y, pt.x, pt.y) < step.r) {
        m.collected.push(i);
        fx.sfx('pickup');
        fx.toast(`Collected ${m.collected.length}/${step.points.length}`);
      }
    }
    if (m.collected.length >= step.points.length) done = true;
  } else if (step.kind === 'wait') {
    if (step.x !== undefined && dist(p.x, p.y, step.x, step.y) > step.r) {
      m.stepTimer = 0; // leaving the spot restarts the wait
    } else {
      m.stepTimer += dt;
      if (m.stepTimer >= step.seconds) done = true;
    }
  } else if (step.kind === 'wanted') {
    if (state.wanted >= step.min) done = true;
  } else if (step.kind === 'lose') {
    if (state.wanted === 0) done = true;
  } else if (step.kind === 'board') {
    if (p.mode === step.vehicle) done = true;
  } else if (step.kind === 'tide') {
    if (state.tide < TIDE.lowBelow) done = true;
  }

  if (!done) return null;

  // The Big Score's vault crack raises the heat the moment it opens.
  if (m.id === 'big-score' && step.kind === 'wait') {
    fx.addCrime(4, p.x, p.y);
    fx.toast('The vault is open — every cop in Solmar is coming!');
  }

  m.index += 1;
  m.stepTimer = 0;
  m.collected = [];
  if (m.index >= m.steps.length) {
    const doneMission = { completed: true, id: m.id, title: m.title, reward: m.reward };
    state.mission = null;
    state.missionCooldown = 2;
    return doneMission;
  }
  return null;
}

/** The current mission target for the HUD arrow and minimap, or null. */
export function missionTarget(state) {
  const m = state.mission;
  if (!m) return null;
  const step = m.steps[m.index];
  if (!step) return null;
  if (step.kind === 'collect') {
    for (let i = 0; i < step.points.length; i += 1) {
      if (!m.collected.includes(i)) return { x: step.points[i].x, y: step.points[i].y, label: step.label };
    }
    return null;
  }
  if (step.x !== undefined) return { x: step.x, y: step.y, label: step.label };
  if (step.kind === 'board' && step.vehicle === 'heli') return { x: SPOTS.helipad.x, y: SPOTS.helipad.y, label: step.label };
  if (step.kind === 'board' && step.vehicle === 'boat') return { x: SPOTS.marina.x, y: SPOTS.marina.y, label: step.label };
  return null;
}

export function missionProgress(state) {
  const m = state.mission;
  if (!m) return null;
  const step = m.steps[m.index];
  if (!step) return null;
  let extra = '';
  if (step.kind === 'collect') extra = ` ${m.collected.length}/${step.points.length}`;
  if (step.seconds) extra += ` ${Math.max(0, Math.ceil(step.seconds - m.stepTimer))}s`;
  return { title: m.title, label: step.label + extra, index: m.index + 1, total: m.steps.length };
}
