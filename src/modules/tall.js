import * as THREE from "three";
import { D, TALL_H } from "./dims.js";

export function tall(k, w, variant, h = TALL_H) {
  const g = new THREE.Group();
  g.add(k.box(w, h, D, "body", 0, h / 2, D / 2, "body"));
  const z = D + 0.01, dw = w - 0.006;

  if (variant === "oven") {
    const lowH = 0.86;
    const s = k.slider(g, D * 0.7);
    s.add(k.box(dw, lowH, 0.02, "lower", 0, lowH / 2, z, "lower"));
    g.add(k.box(w - 0.02, 0.6, 0.03, "black", 0, 1.25, D + 0.015));
    g.add(k.box(w - 0.1, 0.32, 0.005, "hob", 0, 1.2, D + 0.033));
    const topH = h - 1.6;
    const d = k.pivot(g, 0, 1.6 + topH / 2, z, dw, topH - 0.006, "right");
    d.add(k.box(dw, topH - 0.006, 0.02, "lower", 0, 0, 0, "lower"));
    return g;
  }

  const split = variant === "fridge" ? h * 0.6 : h * 0.5;
  const side = variant === "fridge" ? "right" : "left";
  for (const [y0, y1] of [[0, split], [split, h]]) {
    const dh = y1 - y0 - 0.006;
    const d = k.pivot(g, 0, (y0 + y1) / 2, z, dw, dh, side);
    d.add(k.box(dw, dh, 0.02, "lower", 0, 0, 0, "lower"));
  }
  return g;
}
