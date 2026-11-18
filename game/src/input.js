// Keyboard and pointer input. Held keys give a steering vector; one-shot presses (interact,
// radio, punch, shoot, pause, confirm, garage slots, paint) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost and never counted twice. The
// pointer is tracked for aiming the pistol.

export const ACT = {
  CONFIRM: 1,
  PAUSE: 2,
  INTERACT: 4,
  RADIO: 8,
  PUNCH: 16,
  SHOOT: 32,
  PAINT: 64,
  BUY1: 128,
  BUY2: 256,
  BUY3: 512,
};

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

function flagFor(code) {
  if (CONFIRM.has(code)) return ACT.CONFIRM;
  if (PAUSE.has(code)) return ACT.PAUSE;
  if (code === 'KeyE') return ACT.INTERACT;
  if (code === 'KeyR') return ACT.RADIO;
  if (code === 'KeyF') return ACT.PUNCH;
  if (code === 'KeyG') return ACT.SHOOT;
  if (code === 'KeyC') return ACT.PAINT;
  if (code === 'Digit1') return ACT.BUY1;
  if (code === 'Digit2') return ACT.BUY2;
  if (code === 'Digit3') return ACT.BUY3;
  return 0;
}

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    const flag = flagFor(event.code);
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (flag !== 0) {
      if (!event.repeat) actions |= flag;
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointerdown', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.down = true;
    actions |= ACT.CONFIRM | ACT.SHOOT;
  });
  target.addEventListener('pointerup', () => {
    mouse.down = false;
  });
  target.addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });

  function has(codeSet) {
    for (const code of codeSet) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Steering vector {x, y} in [-1, 1], normalised. */
    vector() {
      const x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const y = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** True while Space (handbrake / confirm) is held. */
    handbrake() {
      return held.has('Space');
    },
    /** The one-shot presses since the last call, as ACT_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The pointer, in client pixels; the renderer turns it into world aim. */
    pointer() {
      return mouse;
    },
  };
}
