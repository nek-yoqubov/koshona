import * as THREE from "three";
import { D, TALL_H } from "./dims.js";

export function tall(k, w, variant, h = TALL_H) {
  const g = new THREE.Group();
  g.add(k.box(w, h, D, "body", 0, h / 2, D / 2, "body"));
  if (variant === "oven") {
    g.add(k.box(w - 0.006, h - 0.9 - 0.06, 0.02, "lower", 0, 0.9 + (h - 0.9) / 2 + 0.03, D + 0.01, "lower"));
    g.add(k.box(w - 0.006, 0.9 - 0.04, 0.02, "lower", 0, (0.9 - 0.04) / 2, D + 0.01, "lower"));
    g.add(k.box(w - 0.02, 0.6, 0.03, "black", 0, 1.25, D + 0.015));
    g.add(k.box(w - 0.1, 0.32, 0.005, "hob", 0, 1.2, D + 0.033));
  } else {
    const split = TALL_H * 0.6;
    g.add(k.box(w - 0.006, split - 0.006, 0.02, "lower", 0, split / 2, D + 0.01, "lower"));
    g.add(k.box(w - 0.006, h - split - 0.006, 0.02, "lower", 0, split + (h - split) / 2, D + 0.01, "lower"));
  }
  return g;
}
