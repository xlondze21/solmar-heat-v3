// Combat: fists and the pistol. A punch hits whatever is in front of the player at arm's
// length; the pistol fires a bullet toward the aim point (the mouse, or the facing direction).
// Hitting people is a crime; hitting the police helicopter damages it. Pure state updates.

import { CAR, HELI, PLAYER } from './config.js';
import { angleDiff, dist } from './util.js';

const BULLET_SPEED = 900;
const BULLET_RANGE = 620;

function knockDownPed(state, ped) {
  ped.state = 'down';
  ped.downTimer = 4;
}

export function updateCombat(state, dt, ctrl, fx, audio) {
  const p = state.player;
  const actions = ctrl.actions || 0;

  // Punch: F, or clicking while unarmed.
  if ((actions & 16) && p.punchCd <= 0 && p.mode === 'foot') {
    p.punchCd = PLAYER.punchCooldown;
    if (audio) audio.punch();
    const reach = PLAYER.punchRange;
    const px = p.x + Math.cos(p.angle) * reach;
    const py = p.y + Math.sin(p.angle) * reach;
    let hit = false;
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      if (dist(px, py, ped.x, ped.y) < 26) {
        knockDownPed(state, ped);
        ped.x += Math.cos(p.angle) * 26;
        ped.y += Math.sin(p.angle) * 26;
        fx.addCrime(1, ped.x, ped.y);
        fx.toast('Assault! +1 star.');
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (const v of state.vehicles) {
        if (v.driver !== 'cop' || v.wrecked) continue;
        if (dist(px, py, v.x, v.y) < 34) {
          v.hp -= PLAYER.punchDamage;
          fx.addCrime(2, v.x, v.y);
          fx.toast('You hit a cop car! +2 stars.');
          hit = true;
          break;
        }
      }
    }
    if (!hit && audio) {
      // A swing at the air still makes a sound.
    }
  }

  // Pistol: G, or a mouse click while armed.
  const wantShoot = (actions & 32) && p.weapon === 'pistol' && p.ammo > 0;
  if (wantShoot && p.mode !== 'heli') {
    p.ammo -= 1;
    const aimX = ctrl.aimX !== undefined ? ctrl.aimX : p.x + Math.cos(p.angle) * 200;
    const aimY = ctrl.aimY !== undefined ? ctrl.aimY : p.y + Math.sin(p.angle) * 200;
    const angle = Math.atan2(aimY - p.y, aimX - p.x);
    state.bullets.push({
      x: p.x + Math.cos(angle) * 16, y: p.y + Math.sin(angle) * 16,
      vx: Math.cos(angle) * BULLET_SPEED, vy: Math.sin(angle) * BULLET_SPEED,
      life: 0, maxLife: BULLET_RANGE / BULLET_SPEED,
    });
    state._lastShot = state.time;
    state._lastShotX = p.x;
    state._lastShotY = p.y;
    if (audio) audio.shot();
    // Firing in public is a crime by itself.
    fx.addCrime(1, p.x, p.y);
  } else if ((actions & 32) && p.weapon === 'pistol' && p.ammo <= 0) {
    fx.toast('Out of ammo — buy more at Ammo-Nation.');
  }

  // Bullets fly, then hit the first thing in their path.
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.life += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life >= b.maxLife;
    if (!dead) {
      // The police helicopter.
      const heli = state.heli;
      if (heli.active && dist(b.x, b.y, heli.x, heli.y) < HELI.radius + 6) {
        heli.hp -= 24;
        dead = true;
        fx.toast('Hit the helicopter!');
      }
    }
    if (!dead) {
      for (const ped of state.peds) {
        if (ped.state === 'down') continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 12) {
          knockDownPed(state, ped);
          fx.addCrime(2, ped.x, ped.y);
          fx.toast('You shot a pedestrian! +2 stars.');
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const v of state.vehicles) {
        if (v.wrecked) continue;
        const spec = CAR[v.kind] || CAR.sedan;
        const half = spec.length / 2;
        // Cheap circle test against the car's centre.
        if (dist(b.x, b.y, v.x, v.y) < half) {
          v.hp -= 24;
          if (v.driver === 'cop') {
            fx.addCrime(1, v.x, v.y);
            fx.toast('You shot a cop car!');
          }
          dead = true;
          break;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}
