// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, paused, busted and wasted.
//
// ?seed=N fixes the city and the traffic. ?shot=cover|drive|mission|chase (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot. window.__solmar exposes the world for debugging and for the autopilot sim.

import { ACT, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';
import { STEP } from './config.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(seed, audio);
const renderer = createRenderer(canvas);
const input = createInput(canvas);

function readSave() {
  return world.state.save;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world.city, scene.screen, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal a car with E, run missions for Rico.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACT.CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_BUSTED || screen === SCREEN_WASTED)) {
      audio.resume();
      startGame();
    } else if (actions & ACT.PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACT.PAUSE | ACT.CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_PLAY) {
      const vec = input.vector();
      const pointer = input.pointer();
      // The pointer aims the pistol in world coordinates.
      const aimX = world.state.camera.x + (pointer.x / window.innerWidth) * 1280;
      const aimY = world.state.camera.y + (pointer.y / window.innerHeight) * 720;
      let result = null;
      let firstStep = true;
      while (accumulator >= STEP) {
        // One-shot actions go to the first step only, so a single press never
        // enters and exits a car in the same frame.
        result = world.step(STEP, {
          vx: vec.x, vy: vec.y, handbrake: input.handbrake(), actions: firstStep ? actions : 0, aimX, aimY,
        });
        firstStep = false;
        accumulator -= STEP;
        if (result && result.busted) {
          screen = SCREEN_BUSTED;
          announce('Busted! The police took 15% of your cash.');
          break;
        }
        if (result && result.wasted) {
          screen = SCREEN_WASTED;
          announce('Wasted! The hospital patched you up.');
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, world.city, screen, readSave() ? readSave().cash : 0);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Heat. Press Space or click to start.');
  requestAnimationFrame(frame);
}

// A debug handle for the autopilot sim and for anyone poking at the game in a console.
window.__solmar = {
  world,
  get state() {
    return world.state;
  },
  get city() {
    return world.city;
  },
  step(dt, ctrl) {
    return world.step(dt, ctrl);
  },
  reset() {
    world.reset();
  },
};

if (shot) runShot(shot);
else runGame();
