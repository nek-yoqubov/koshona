import * as THREE from "three";
import { BASE_H, PLINTH, D, TOP_T } from "./dims.js";
import { drawerOf } from "../catalog/mechanisms.js";
import { drawerBox } from "./mech.js";

const T = 0.016;

export function doorsRow(k, parent, w, h, cy, z, key, region) {
  const dw = w - 0.006;
  if (w <= 0.5) {
    const d = k.pivot(parent, 0, cy, z, dw, h, "left");
    d.add(k.box(dw, h, 0.02, key, 0, 0, 0, key, region?.()));
    return;
  }
  const hw = dw / 2 - 0.002;
  for (const [sx, side] of [[-1, "left"], [1, "right"]]) {
    const d = k.pivot(parent, sx * (hw / 2 + 0.002), cy, z, hw, h, side);
    d.add(k.box(hw, h, 0.02, key, 0, 0, 0, key, region?.()));
  }
}

export function base(k, w, variant, opt = {}) {
  const sys = drawerOf(opt.dt, opt.dr);
  const g = new THREE.Group();
  const H = BASE_H - PLINTH, d = D - 0.002;
  if (variant === "drawers" || variant === "hob") {
    g.add(k.box(w - 0.004, H, d, "body", 0, PLINTH + H / 2, d / 2, "body"));
  } else {
    // полый корпус: видно полку и петли при открытой двери
    g.add(k.box(w - 0.004, H, T, "body", 0, PLINTH + H / 2, T / 2, "body"));
    for (const sx of [-1, 1]) g.add(k.box(T, H, d, "body", sx * (w / 2 - 0.002 - T / 2), PLINTH + H / 2, d / 2, "body"));
    g.add(k.box(w - 0.004 - 2 * T, T, d, "body", 0, PLINTH + T / 2, d / 2, "body", k.flat()));
    for (const zz of [d - 0.05, 0.05]) g.add(k.box(w - 0.004 - 2 * T, T, 0.1, "body", 0, BASE_H - T / 2, zz, "body"));
    if (variant !== "sink") g.add(k.box(w - 0.004 - 2 * T, T, d - 0.04, "body", 0, PLINTH + H / 2, (d - 0.04) / 2, "body", k.flat()));
  }
  g.add(k.box(w, PLINTH, D - 0.08, "body", 0, PLINTH / 2, D / 2 - 0.04, "body"));

  if (variant === "drawers" || variant === "hob") {
    const r0 = k.region();
    let y = PLINTH;
    for (const h of [0.32, 0.2, 0.2]) {
      const fh = h - 0.04;
      const s = k.slider(g, 0);
      s.add(k.box(w - 0.006, fh, 0.02, "lower", 0, y + fh / 2, D + 0.01, "lower", { ...r0, stack: r0.ox, sy: (y - PLINTH) * 1000 }));
      k.setSlide(s, drawerBox(k, s, sys, { w, y, fh, D }));
      g.add(k.box(w - 0.006, 0.04, 0.02, "black", 0, y + h - 0.02, D + 0.008));
      y += h;
    }
  } else {
    const fh = BASE_H - PLINTH - 0.04;
    doorsRow(k, g, w, fh, PLINTH + fh / 2, D + 0.01, "lower", k.region);
    g.add(k.box(w - 0.006, 0.04, 0.02, "black", 0, BASE_H - 0.02, D + 0.008));
  }

  if (variant === "sink") {
    g.add(k.box(Math.min(0.5, w - 0.1), 0.01, 0.4, "black", 0, BASE_H + TOP_T + 0.001, 0.32));
    const tap = k.cyl(0.012, 0.012, 0.32, "black", 0, BASE_H + 0.19, 0.1);
    const spout = k.cyl(0.01, 0.01, 0.2, "black", 0, BASE_H + 0.34, 0.2);
    spout.rotation.x = Math.PI / 2;
    g.add(tap, spout);
  }
  if (variant === "hob") {
    g.add(k.box(Math.min(0.56, w - 0.04), 0.006, 0.48, "hob", 0, BASE_H + TOP_T + 0.003, 0.3));
    g.add(k.cyl(0.13, 0.12, 0.14, "black", 0, BASE_H + 0.11, 0.32));
  }
  return g;
}
