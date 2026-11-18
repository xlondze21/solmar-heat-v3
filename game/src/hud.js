// The HUD and the panels: wanted stars, cash, health, speed, the mission tracker, the tide
// gauge, street REP, the radio station, toasts and the minimap (with gang territories and the
// mission beacon). Drawn in view space (1280x720), after the world.

import { GANGS, PALETTE, SPOTS, VIEW, WORLD } from './config.js';
import { missionProgress, missionTarget } from './missions.js';
import { clamp } from './util.js';

function stars(context, text, x, y, wanted) {
  for (let i = 0; i < 5; i += 1) {
    text(i < wanted ? '★' : '☆', x + i * 30, y, 26, i < wanted ? '#f2c94c' : 'rgba(238,241,245,0.4)', 'left');
  }
}

/** The HUD over the play screen: top bar, mission tracker, tide gauge, toasts, minimap. */
export function drawHud(context, state, city, screen, best, view, text) {
  if (screen === 'title') return;
  const p = state.player;

  // Top-left: cash, name, REP, health bar.
  context.fillStyle = PALETTE.panel;
  context.fillRect(12, 10, 240, 84);
  text(`$${p.cash}`, 24, 38, 26, '#7be495', 'left');
  text(`RICO · SOLMAR`, 24, 62, 14, PALETTE.text, 'left');
  text(`REP ${p.rep}`, 24, 82, 14, '#f2c94c', 'left');
  context.fillStyle = '#2c2c30';
  context.fillRect(140, 70, 100, 10);
  context.fillStyle = p.hp > 30 ? '#7be495' : '#e5534b';
  context.fillRect(140, 70, Math.max(0, (p.hp / 100) * 100), 10);

  // Top-right: wanted stars.
  context.fillStyle = PALETTE.panel;
  context.fillRect(VIEW.width - 190, 10, 178, 44);
  stars(context, text, VIEW.width - 178, 42, state.wanted);

  // Tide gauge, under the cash panel.
  context.fillStyle = PALETTE.panel;
  context.fillRect(12, 102, 240, 40);
  const low = state.tide < 0.35;
  text(low ? 'TIDE: LOW — beach road open' : 'TIDE: HIGH — beach road closed', 24, 118, 13, low ? '#3ee6d8' : '#9aa1b1', 'left');
  context.fillStyle = '#2c2c30';
  context.fillRect(24, 126, 216, 6);
  context.fillStyle = '#2b6cb0';
  context.fillRect(24, 126, state.tide * 216, 6);

  // Time of day + radio, top centre.
  const dayNames = ['DAWN', 'NOON', 'DUSK', 'NIGHT'];
  const dayIndex = Math.floor(state.dayTime * 4) % 4;
  context.fillStyle = PALETTE.panel;
  context.fillRect(VIEW.width / 2 - 150, 10, 300, 40);
  text(`${dayNames[dayIndex]} · ${state.radio.on ? '♪ ' + state.radio.name : 'RADIO OFF (R)'}`, VIEW.width / 2, 38, 14, PALETTE.text, 'center');

  // Mission tracker, bottom centre.
  const prog = missionProgress(state);
  if (prog) {
    context.fillStyle = PALETTE.panel;
    const w = 520;
    context.fillRect(VIEW.width / 2 - w / 2, VIEW.height - 64, w, 52);
    text(`${prog.title} (${prog.index}/${prog.total})`, VIEW.width / 2, VIEW.height - 44, 15, '#f2c94c', 'center');
    text(prog.label, VIEW.width / 2, VIEW.height - 22, 14, PALETTE.text, 'center');
  }

  // Speed, bottom right.
  const v = p.vehicleId !== null ? state.vehicles.find((c) => c.id === p.vehicleId) : null;
  if (v) {
    context.fillStyle = PALETTE.panel;
    context.fillRect(VIEW.width - 130, VIEW.height - 64, 118, 52);
    const mph = Math.round(Math.abs(v.speed) * 0.12);
    text(`${mph}`, VIEW.width - 40, VIEW.height - 24, 30, PALETTE.text, 'right');
    text('MPH', VIEW.width - 16, VIEW.height - 22, 12, PALETTE.muted, 'right');
    text(v.kind.toUpperCase(), VIEW.width - 120, VIEW.height - 48, 12, PALETTE.muted, 'left');
  }

  // Controls hint, bottom left.
  text('E — enter / steal · Space — handbrake · R — radio', 14, VIEW.height - 14, 13, 'rgba(238,241,245,0.75)', 'left');

  // Toasts, under the tide gauge.
  let ty = 152;
  for (const toast of state.toasts) {
    context.globalAlpha = clamp(1.2 - toast.t / 4, 0, 1);
    context.fillStyle = PALETTE.panel;
    const w = Math.min(420, 20 + toast.text.length * 7.5);
    context.fillRect(12, ty, w, 26);
    text(toast.text, 22, ty + 18, 13, PALETTE.text, 'left');
    ty += 32;
  }
  context.globalAlpha = 1;

  // Bust warning.
  if (p.bustTimer > 0.4) {
    text('THEY\'RE HOLDING YOU — DRIVE!', VIEW.width / 2, 120, 22, '#e5534b', 'center');
  }

  // Minimap, bottom-left above the hint: the whole city, territories, spots, player, target.
  const mapW = 190;
  const mapH = 196;
  const mapX = 12;
  const mapY = VIEW.height - mapH - 30;
  const sx = mapW / WORLD.width;
  const sy = mapH / WORLD.height;
  context.fillStyle = 'rgba(10, 12, 20, 0.85)';
  context.fillRect(mapX, mapY, mapW, mapH);
  for (const gang of GANGS) {
    context.fillStyle = gang.color + '55';
    context.fillRect(mapX + gang.x * sx, mapY + gang.y * sy, gang.w * sx, gang.h * sy);
  }
  context.fillStyle = '#1d5f7a';
  context.fillRect(mapX, mapY + 2540 * sy, mapW, (WORLD.height - 2540) * sy);
  context.fillStyle = '#d9c08a';
  context.fillRect(mapX, mapY + 2440 * sy, mapW, 100 * sy);
  // Landmark dots.
  const dots = [
    [SPOTS.garage, '#ffb347'], [SPOTS.safehouse, '#82e0aa'], [SPOTS.gunshop, '#e5534b'],
    [SPOTS.paintshop, '#c084fc'], [SPOTS.fishmarket, '#3ee6d8'], [SPOTS.casino, '#ff5da2'],
    [SPOTS.helipad, '#f2c94c'], [SPOTS.marina, '#7fb3d5'],
  ];
  for (const [spot, color] of dots) {
    context.fillStyle = color;
    context.fillRect(mapX + spot.x * sx - 2, mapY + spot.y * sy - 2, 4, 4);
  }
  // Mission beacon.
  const target = missionTarget(state);
  if (target) {
    context.fillStyle = '#f2c94c';
    context.beginPath();
    context.arc(mapX + target.x * sx, mapY + target.y * sy, 5, 0, Math.PI * 2);
    context.fill();
  }
  // Cops as blue dots, player as a white dot.
  for (const car of state.vehicles) {
    if (car.driver !== 'cop') continue;
    context.fillStyle = '#3f6fd8';
    context.fillRect(mapX + car.x * sx - 2, mapY + car.y * sy - 2, 4, 4);
  }
  if (state.heli.active) {
    context.fillStyle = '#e8e8ec';
    context.fillRect(mapX + state.heli.x * sx - 2, mapY + state.heli.y * sy - 2, 4, 4);
  }
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(mapX + p.x * sx, mapY + p.y * sy, 4, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(238,241,245,0.5)';
  context.lineWidth = 1;
  context.strokeRect(mapX, mapY, mapW, mapH);
  text('SOLMAR', mapX + 4, mapY + 12, 10, 'rgba(238,241,245,0.7)', 'left');
}

/** A centred panel for the title, pause and end screens. */
export function drawPanel(context, title, lines, prompt, text) {
  const width = 640;
  const lineH = 30;
  const height = 120 + lines.length * lineH + 70;
  const x = (VIEW.width - width) / 2;
  const y = (VIEW.height - height) / 2;
  context.fillStyle = PALETTE.panel;
  context.fillRect(x, y, width, height);
  context.strokeStyle = 'rgba(242,201,76,0.6)';
  context.lineWidth = 2;
  context.strokeRect(x, y, width, height);
  text(title, VIEW.width / 2, y + 62, 44, '#f2c94c', 'center');
  for (let i = 0; i < lines.length; i += 1) {
    text(lines[i], VIEW.width / 2, y + 110 + i * lineH, 17, PALETTE.muted, 'center');
  }
  text(prompt, VIEW.width / 2, y + height - 30, 18, PALETTE.gold, 'center');
}
