import * as THREE from "three";
import { UP_D, UP_Y0, TALL_H } from "./dims.js";

export function upper(k, w, variant) {
  const g = new THREE.Group();
  const H = TALL_H - UP_Y0;
  const glass = variant === "glass";
  g.add(k.box(w - 0.004, H, UP_D - 0.02, glass ? "black" : "body", 0, UP_Y0 + H / 2, UP_D / 2 - 0.01, glass ? null : "body"));

  if (glass) {
    g.add(k.box(w - 0.06, H - 0.06, UP_D - 0.06, "shelfLight", 0, UP_Y0 + H / 2, UP_D / 2 - 0.02));
    for (const sy of [0.28, 0.55]) g.add(k.box(w - 0.06, 0.015, UP_D - 0.06, "black", 0, UP_Y0 + sy * H, UP_D / 2 - 0.02));
    g.add(k.box(w - 0.03, H - 0.03, 0.006, "glass", 0, UP_Y0 + H / 2, UP_D + 0.003));
    g.add(k.box(w - 0.006, 0.03, 0.02, "black", 0, UP_Y0 + H - 0.015, UP_D + 0.01));
  } else if (variant === "hood") {
    g.add(k.box(w - 0.006, H - 0.3, 0.02, "upper", 0, UP_Y0 + 0.3 + (H - 0.3) / 2, UP_D + 0.01, "upper"));
    g.add(k.box(w - 0.006, 0.3, UP_D, "black", 0, UP_Y0 + 0.15, UP_D / 2));
  } else {
    const topH = 0.32;
    g.add(k.box(w - 0.006, topH - 0.006, 0.02, "upper", 0, UP_Y0 + H - topH / 2, UP_D + 0.01, "upper"));
    g.add(k.box(w - 0.006, H - topH - 0.006, 0.02, "upper", 0, UP_Y0 + (H - topH) / 2, UP_D + 0.01, "upper"));
  }
  return g;
}
