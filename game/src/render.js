// Drawing only: the world state and the current screen in, pixels out. The camera shows a
// 1280x720 window of the city, scaled to fit the browser window. Flat shapes, canvas text,
// a day/night lighting overlay and the police helicopter's spotlight. The HUD lives in hud.js.

import { GANGS, PALETTE, ROADS, ROAD_X, ROAD_Y, SPOTS, VIEW, WORLD } from './config.js';
import { drawHud, drawPanel } from './hud.js';
import { missionTarget } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_OVER = 'over';

function daylight(dayTime) {
  // 0 dawn, 0.25 noon, 0.5 dusk, 0.75 night: returns {dark, warm}.
  if (dayTime < 0.25) return { dark: 0.16 - (dayTime / 0.25) * 0.16, warm: 0.10 };
  if (dayTime < 0.5) return { dark: ((dayTime - 0.25) / 0.25) * 0.30, warm: 0.16 };
  if (dayTime < 0.75) return { dark: 0.30 + ((dayTime - 0.5) / 0.25) * 0.20, warm: 0.05 };
  return { dark: 0.50 - ((dayTime - 0.75) / 0.25) * 0.34, warm: 0.08 };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, font) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${font || 'system-ui, -apple-system, "Segoe UI", sans-serif'}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  function drawGround(state, city) {
    // Land, then the beach and the sea.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.landBottom);
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, WORLD.beachTop, WORLD.width, WORLD.waterTop - WORLD.beachTop);
    context.fillStyle = PALETTE.waterDeep;
    context.fillRect(0, WORLD.waterTop, WORLD.width, WORLD.height - WORLD.waterTop);
    // The tide line: water creeps up the sand at high tide.
    const waterLine = WORLD.waterTop - state.tide * 46;
    context.fillStyle = PALETTE.water;
    context.fillRect(0, waterLine, WORLD.width, WORLD.height - waterLine);
    // Wave strokes.
    context.strokeStyle = 'rgba(220,240,255,0.5)';
    context.lineWidth = 2;
    for (let x = 0; x < WORLD.width; x += 90) {
      const wy = waterLine + 8 + Math.sin(state.time * 1.6 + x * 0.01) * 4;
      context.beginPath();
      context.moveTo(x, wy);
      context.lineTo(x + 46, wy);
      context.stroke();
    }
    // Gang territories: a faint tint on the ground.
    for (const gang of GANGS) {
      context.fillStyle = gang.color + '22';
      context.fillRect(gang.x, gang.y, gang.w, gang.h);
    }
    // Roads.
    for (let k = 0; k < ROADS.count; k += 1) {
      context.fillStyle = PALETTE.road;
      context.fillRect(ROAD_X(k) - ROADS.width / 2, 0, ROADS.width, WORLD.landBottom);
      context.fillRect(0, ROAD_Y(k) - ROADS.width / 2, WORLD.width, ROADS.width);
    }
    // Centre dashes.
    context.fillStyle = PALETTE.roadLine;
    for (let k = 0; k < ROADS.count; k += 1) {
      for (let d = 40; d < WORLD.landBottom; d += 64) {
        context.fillRect(ROAD_X(k) - 2, d, 4, 30);
        context.fillRect(d, ROAD_Y(k) - 2, 30, 4);
      }
    }
    // The beach road, only when the tide is low.
    if (state.tide < 0.35) {
      context.fillStyle = '#8a7a5a';
      context.fillRect(120, WORLD.beachTop + 8, WORLD.width - 240, 34);
      context.fillStyle = PALETTE.roadLine;
      for (let d = 160; d < WORLD.width - 160; d += 64) context.fillRect(d, WORLD.beachTop + 23, 30, 4);
    }
    // Marina docks.
    context.fillStyle = '#5d4a33';
    context.fillRect(SPOTS.marina.x - 140, WORLD.beachTop - 10, 280, 16);
    context.fillRect(SPOTS.marina.x - 140, WORLD.beachTop - 10, 16, 120);
    context.fillRect(SPOTS.marina.x + 124, WORLD.beachTop - 10, 16, 120);
  }

  function drawBuildings(state, city) {
    const light = daylight(state.dayTime);
    for (const b of city.buildings) {
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x, b.y, b.w, 8);
      // Windows: lit at night.
      context.fillStyle = light.dark > 0.25 ? '#ffd97a' : 'rgba(20,26,40,0.7)';
      for (let wx = b.x + 10; wx < b.x + b.w - 12; wx += 22) {
        for (let wy = b.y + 14; wy < b.y + b.h - 12; wy += 24) {
          context.fillRect(wx, wy, 10, 12);
        }
      }
      if (b.neon && light.dark > 0.15) {
        context.fillStyle = b.neon;
        context.fillRect(b.x + 6, b.y - 4, b.w - 12, 5);
      }
    }
    // Neon signs on the beachfront.
    for (const neon of city.neons) {
      if (light.dark <= 0.15) continue;
      text(neon.text, neon.x, neon.y - 8, 16, neon.color, 'center');
    }
    // Palms.
    for (const palm of city.palms) {
      context.strokeStyle = '#2f5d33';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(palm.x, palm.y);
      context.lineTo(palm.x, palm.y - 14);
      context.stroke();
      context.fillStyle = '#3f7a44';
      context.beginPath();
      context.arc(palm.x, palm.y - 16, 9, 0, Math.PI * 2);
      context.fill();
    }
    // Helipad.
    context.fillStyle = '#3a3f4a';
    context.beginPath();
    context.arc(SPOTS.helipad.x, SPOTS.helipad.y, 34, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#f2c94c';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(SPOTS.helipad.x, SPOTS.helipad.y, 26, 0, Math.PI * 2);
    context.stroke();
    text('H', SPOTS.helipad.x, SPOTS.helipad.y + 8, 24, '#f2c94c', 'center');
  }

  function drawSpotMarkers(state) {
    const spots = [
      { s: SPOTS.garage, label: 'GARAGE', color: '#ffb347' },
      { s: SPOTS.safehouse, label: 'SAFEHOUSE', color: '#82e0aa' },
      { s: SPOTS.gunshop, label: 'AMMO', color: '#e5534b' },
      { s: SPOTS.paintshop, label: 'PAINT', color: '#c084fc' },
      { s: SPOTS.fishmarket, label: 'FISH MARKET', color: '#3ee6d8' },
      { s: SPOTS.casino, label: 'CASINO', color: '#ff5da2' },
      { s: SPOTS.hospital, label: 'HOSPITAL', color: '#eef1f5' },
    ];
    for (const { s, label, color } of spots) {
      context.fillStyle = color;
      context.beginPath();
      context.arc(s.x, s.y, 5, 0, Math.PI * 2);
      context.fill();
      text(label, s.x, s.y - 12, 11, color, 'center');
    }
    // Mission target beacon.
    const target = missionTarget(state);
    if (target) {
      const pulse = 6 + Math.sin(state.time * 5) * 2;
      context.strokeStyle = '#f2c94c';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(target.x, target.y, 18 + pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = '#f2c94c';
      context.beginPath();
      context.moveTo(target.x, target.y - 30);
      context.lineTo(target.x - 8, target.y - 44);
      context.lineTo(target.x + 8, target.y - 44);
      context.closePath();
      context.fill();
    }
  }

  function drawCar(v) {
    context.save();
    context.translate(v.x, v.y);
    context.rotate(v.angle);
    const len = v.kind === 'truck' ? 58 : 46;
    const wid = v.kind === 'truck' ? 26 : 22;
    context.fillStyle = v.wrecked ? '#2c2c30' : v.color;
    context.fillRect(-len / 2, -wid / 2, len, wid);
    context.fillStyle = 'rgba(20,26,40,0.85)';
    context.fillRect(-len / 2 + 10, -wid / 2 + 4, 14, wid - 8);
    context.fillStyle = '#ffe9a8';
    context.fillRect(len / 2 - 4, -wid / 2 + 3, 3, 5);
    context.fillRect(len / 2 - 4, wid / 2 - 8, 3, 5);
    if (v.driver === 'cop') {
      const blink = Math.floor(Date.now() / 300) % 2 === 0;
      context.fillStyle = blink ? '#ff3b30' : '#3b82f6';
      context.fillRect(-4, -wid / 2 - 3, 8, 4);
    }
    context.restore();
  }

  function drawWorld(state, city) {
    drawGround(state, city);
    drawBuildings(state, city);
    drawSpotMarkers(state);

    // Boat (in the water).
    const boat = state.boat;
    context.save();
    context.translate(boat.x, boat.y);
    context.rotate(boat.angle);
    context.fillStyle = boat.state === 'docked' ? '#d8d8d8' : '#f2f2f2';
    context.fillRect(-27, -12, 54, 24);
    context.fillStyle = '#2b6cb0';
    context.fillRect(-6, -8, 16, 16);
    context.restore();

    for (const v of state.vehicles) drawCar(v);

    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.state === 'down') {
        context.fillStyle = '#8a8578';
        context.beginPath();
        context.ellipse(ped.x, ped.y, 10, 5, ped.angle, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      context.fillStyle = ped.color;
      context.beginPath();
      context.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 3, 0, Math.PI * 2);
      context.fill();
    }

    // Player.
    const p = state.player;
    if (p.mode === 'foot') {
      context.fillStyle = p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0 ? 'rgba(255,209,102,0.4)' : '#ffd166';
      context.beginPath();
      context.arc(p.x, p.y, 11, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#1d1d22';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
      context.stroke();
    }

    // Flyable helicopter: shadow grows with altitude, body above it.
    const fh = state.flyHeli;
    if (fh.state !== 'parked' || true) {
      const shadowR = 16 + fh.alt * 0.06;
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.ellipse(fh.x + fh.alt * 0.4, fh.y + fh.alt * 0.4, shadowR, shadowR * 0.6, 0, 0, Math.PI * 2);
      context.fill();
      context.save();
      context.translate(fh.x, fh.y - fh.alt * 0.35);
      context.rotate(fh.angle);
      context.fillStyle = '#e8b64c';
      context.fillRect(-18, -9, 36, 18);
      context.fillStyle = 'rgba(20,26,40,0.85)';
      context.fillRect(4, -7, 10, 14);
      context.strokeStyle = '#c8ccd4';
      context.lineWidth = 2;
      const rotor = state.time * 22;
      context.beginPath();
      context.moveTo(Math.cos(rotor) * -26, Math.sin(rotor) * -26);
      context.lineTo(Math.cos(rotor) * 26, Math.sin(rotor) * 26);
      context.stroke();
      context.restore();
    }

    // Police helicopter: body, rotors and the spotlight cone on the player.
    const heli = state.heli;
    if (heli.active) {
      const dx = p.x - heli.x;
      const dy = p.y - heli.y;
      const len = Math.hypot(dx, dy) || 1;
      context.fillStyle = 'rgba(255,244,180,0.10)';
      context.beginPath();
      context.moveTo(heli.x, heli.y);
      context.lineTo(heli.x + (dx / len) * 320 - (dy / len) * 60, heli.y + (dy / len) * 320 + (dx / len) * 60);
      context.lineTo(heli.x + (dx / len) * 320 + (dy / len) * 60, heli.y + (dy / len) * 320 - (dx / len) * 60);
      context.closePath();
      context.fill();
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.ellipse(heli.x + 60, heli.y + 60, 18, 11, 0, 0, Math.PI * 2);
      context.fill();
      context.save();
      context.translate(heli.x, heli.y);
      context.rotate(heli.angle);
      context.fillStyle = '#c8ccd4';
      context.fillRect(-20, -10, 40, 20);
      context.fillStyle = '#1d5f7a';
      context.fillRect(6, -8, 10, 16);
      context.strokeStyle = '#e8e8ec';
      context.lineWidth = 2;
      const rotor = state.time * 26;
      context.beginPath();
      context.moveTo(Math.cos(rotor) * -28, Math.sin(rotor) * -28);
      context.lineTo(Math.cos(rotor) * 28, Math.sin(rotor) * 28);
      context.stroke();
      context.restore();
    }

    // Bullets.
    context.strokeStyle = '#ffe9a8';
    context.lineWidth = 2;
    for (const b of state.bullets) {
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }

    // Particles.
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, 1 - pt.life / pt.maxLife);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    // Day/night overlay.
    const light = daylight(state.dayTime);
    if (light.dark > 0.01) {
      context.fillStyle = `rgba(8, 10, 34, ${light.dark.toFixed(3)})`;
      context.fillRect(state.camera.x - 10, state.camera.y - 10, VIEW.width + 20, VIEW.height + 20);
    }
    if (light.warm > 0.01) {
      context.fillStyle = `rgba(255, 122, 40, ${(light.warm * 0.5).toFixed(3)})`;
      context.fillRect(state.camera.x - 10, state.camera.y - 10, VIEW.width + 20, VIEW.height + 20);
    }
  }

  function draw(state, city, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // World space: translate by the camera.
    context.save();
    context.translate(-state.camera.x, -state.camera.y);
    drawWorld(state, city);
    context.restore();
    // HUD in view space.
    drawHud(context, state, city, screen, best, view, text);
    if (screen === SCREEN_TITLE) {
      drawPanel(context, 'SOLMAR HEAT', [
        'A sun-soaked open-world crime game.',
        'Steal cars, dodge the cops, fly the helicopter,',
        'sail the boat — and run ten missions for Rico.',
        `Best haul: $${best}`,
        '',
        'WASD drive / walk · E enter & steal · Space handbrake',
        'F punch · G shoot · R radio · C paint · P pause',
      ], 'Press Space or click to start', text);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel(context, 'Paused', ['The city waits for you.'], 'Press P to resume', text);
    } else if (screen === SCREEN_BUSTED) {
      drawPanel(context, 'Busted!', ['The Solmar PD caught you.', 'They took 15% of your cash.'], 'Press Space to walk free', text);
    } else if (screen === SCREEN_WASTED) {
      drawPanel(context, 'Wasted!', ['The hospital patched you up.', 'They took 10% of your cash.'], 'Press Space to get back out there', text);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
