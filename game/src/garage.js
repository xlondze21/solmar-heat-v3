// Rico's Garage, the paint shop and the save. Near the garage, keys 1–3 buy a car that is
// parked there from then on; near the paint shop, C repaints the car you are in. Owned cars
// persist in the save. Pure state updates.

import { CAR, PRICES, SPOTS } from './config.js';
import { dist } from './util.js';

const PAINTS = ['#e5539e', '#3ee6d8', '#ffb347', '#c084fc', '#f2c94c', '#7fb3d5', '#e5534b', '#82e0aa'];

const BUY_LIST = [
  { key: 128, kind: 'taxi', label: 'Taxi' },
  { key: 256, kind: 'truck', label: 'Truck' },
  { key: 512, kind: 'sports', label: 'Sports car' },
];

export function updateGarage(state, dt, ctrl, fx) {
  const p = state.player;
  const actions = ctrl.actions || 0;

  // Buying: 1/2/3 near the garage.
  if (dist(p.x, p.y, SPOTS.garage.x, SPOTS.garage.y) < 130) {
    for (const buy of BUY_LIST) {
      if (!(actions & buy.key)) continue;
      const spec = CAR[buy.kind];
      if (state.owned.includes(buy.kind)) {
        fx.toast(`You already own a ${buy.label}.`);
        continue;
      }
      if (buy.kind === 'sports' && p.rep < (spec.rep || 0)) {
        fx.toast(`The Sports car needs REP ${spec.rep}. Run missions.`);
        if (fx.sfx) fx.sfx('denied');
        continue;
      }
      if (p.cash < spec.price) {
        fx.toast(`A ${buy.label} costs $${spec.price}. You have $${p.cash}.`);
        if (fx.sfx) fx.sfx('denied');
        continue;
      }
      p.cash -= spec.price;
      state.owned.push(buy.kind);
      const slot = state.garageCars.length;
      const gx = SPOTS.garage.x + 60 + (slot % 2) * 60;
      const gy = SPOTS.garage.y + 110 + Math.floor(slot / 2) * 50;
      fx.addVehicle(buy.kind, gx, gy, Math.PI / 2, 'owned', spec.color);
      state.garageCars.push({ kind: buy.kind, color: spec.color, x: gx, y: gy });
      fx.toast(`Bought a ${buy.label} — parked at the garage.`);
      if (fx.sfx) fx.sfx('cash');
      fx.saveGame();
    }
  }

  // Paint: C near the paint shop, while driving an owned car.
  if ((actions & 64) && p.mode === 'car' && p.vehicleId !== null) {
    if (dist(p.x, p.y, SPOTS.paintshop.x, SPOTS.paintshop.y) < 120) {
      const v = state.vehicles.find((c) => c.id === p.vehicleId);
      if (v && (v.driver === 'player')) {
        if (p.cash < PRICES.paintJob) {
          fx.toast(`A paint job costs $${PRICES.paintJob}.`);
        } else {
          p.cash -= PRICES.paintJob;
          const next = PAINTS[(PAINTS.indexOf(v.color) + 1) % PAINTS.length];
          v.color = next;
          fx.toast(`Repainted ${v.color}.`);
          if (fx.sfx) fx.sfx('cash');
          fx.saveGame();
        }
      }
    }
  }
}
