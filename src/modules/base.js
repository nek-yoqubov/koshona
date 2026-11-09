import * as THREE from "three";
import { BASE_H, PLINTH, D } from "./dims.js";

export function base(k, w, variant) {
  const g = new THREE.Group();
  g.add(k.box(w - 0.004, BASE_H - PLINTH, D - 0.02, "body", 0, PLINTH + (BASE_H - PLINTH) / 2, D / 2 - 0.01, "body"));
  g.add(k.box(w, PLINTH, D - 0.08, "body", 0, PLINTH / 2, D / 2 - 0.04, "body"));

  if (variant === "drawers" || variant === "hob") {
    const r0 = k.region();
    let y = PLINTH, acc = 0;
    for (const h of [0.32, 0.2, 0.2]) {
      const fh = h - 0.04;
      g.add(k.box(w - 0.006, fh, 0.02, "lower", 0, y + fh / 2, D + 0.01, "lower", { ox: r0.ox, oy: r0.oy + acc }));
      g.add(k.box(w - 0.006, 0.04, 0.02, "black", 0, y + h - 0.02, D + 0.008));
      y += h;
      acc += (h * 1000) / 2070 * 0.5;
    }
  } else {
    const fh = BASE_H - PLINTH - 0.04;
    g.add(k.box(w - 0.006, fh, 0.02, "lower", 0, PLINTH + fh / 2, D + 0.01, "lower"));
    g.add(k.box(w - 0.006, 0.04, 0.02, "black", 0, BASE_H - 0.02, D + 0.008));
  }

  if (variant === "sink") {
    g.add(k.box(0.5, 0.01, 0.4, "black", 0, BASE_H + 0.031, 0.32));
    const tap = k.cyl(0.012, 0.012, 0.32, "black", 0, BASE_H + 0.19, 0.1);
    const spout = k.cyl(0.01, 0.01, 0.2, "black", 0, BASE_H + 0.34, 0.2);
    spout.rotation.x = Math.PI / 2;
    g.add(tap, spout);
  }
  if (variant === "hob") {
    g.add(k.box(0.56, 0.006, 0.48, "hob", 0, BASE_H + 0.033, 0.3));
    g.add(k.cyl(0.13, 0.12, 0.14, "black", 0, BASE_H + 0.11, 0.32));
  }
  return g;
}
