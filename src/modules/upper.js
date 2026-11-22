import * as THREE from "three";
import { UP_D, UP_Y0, TALL_H } from "./dims.js";
import { doorsRow } from "./base.js";
import { carcass, liftFront } from "./mech.js";
import { liftOf, TIER_LOW, TIER_TOP } from "../catalog/mechanisms.js";

const T = 0.016;

function vitrine(k, g, w, y0, H) {
  const yc = y0 + H / 2, d = UP_D - 0.02;
  carcass(k, g, w, y0, H, d, H > 0.8 ? 2 : 1);
  g.add(k.box(w - 0.06, 0.008, 0.012, "shelfLed", 0, y0 + H - T - 0.006, d - 0.03));
  k.lamp(0.8, 0.7, 0, y0 + H - 0.08, d * 0.6, g);

  const fw = 0.022, dw = w - 0.006, dh = H - 0.006;
  const door = k.pivot(g, 0, yc, UP_D + 0.01, dw, dh, "left");
  door.add(k.box(dw, fw, 0.02, "frame", 0, dh / 2 - fw / 2, 0));
  door.add(k.box(dw, fw, 0.02, "frame", 0, -dh / 2 + fw / 2, 0));
  for (const sx of [-1, 1]) door.add(k.box(fw, dh - 2 * fw, 0.02, "frame", sx * (dw / 2 - fw / 2), 0, 0));
  const glass = k.box(dw - 2 * fw + 0.004, dh - 2 * fw + 0.004, 0.004, "glass", 0, 0, 0);
  glass.castShadow = false;
  glass.renderOrder = 1;
  door.add(glass);
}

// Один ярус верхнего шкафа: y0 — низ, H — высота (м)
function tier(k, g, w, variant, y0, H, mechId) {
  const z = UP_D + 0.01;
  if (variant === "glass") return vitrine(k, g, w, y0, H);
  if (variant === "lift") {
    carcass(k, g, w, y0, H, UP_D - 0.02, H > 0.7 ? 2 : 1);
    liftFront(k, g, liftOf(mechId, Math.round(H * 1000)), { w, y0, H, d: UP_D - 0.02, z, key: "upper" });
    return;
  }
  g.add(k.box(w - 0.004, H, UP_D - 0.02, "body", 0, y0 + H / 2, UP_D / 2 - 0.01, "body"));
  doorsRow(k, g, w, H - 0.006, y0 + H / 2, z, "upper", k.region);
}

export function upper(k, w, variant, opt = {}) {
  const g = new THREE.Group();
  const full = TALL_H - UP_Y0;

  if (variant === "hood") {
    const z = UP_D + 0.01, H = full;
    g.add(k.box(w - 0.004, H, UP_D - 0.02, "body", 0, UP_Y0 + H / 2, UP_D / 2 - 0.01, "body"));
    g.add(k.box(w - 0.006, H - 0.3, 0.02, "upper", 0, UP_Y0 + 0.3 + (H - 0.3) / 2, z, "upper"));
    g.add(k.box(w - 0.006, 0.3, UP_D, "black", 0, UP_Y0 + 0.15, UP_D / 2));
    return g;
  }

  const uh = opt.uh ?? 950;
  if (uh === "a") {
    const lo = TIER_LOW / 1000, hi = TIER_TOP / 1000;
    tier(k, g, w, variant, UP_Y0, lo, opt.um);
    tier(k, g, w, "lift", UP_Y0 + lo, hi, opt.um2);
  } else {
    tier(k, g, w, variant, UP_Y0, uh === 720 ? 0.72 : full, opt.um);
  }
  return g;
}
