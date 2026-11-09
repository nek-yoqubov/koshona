import * as THREE from "three";
import { UP_D, UP_Y0, TALL_H } from "./dims.js";
import { doorsRow } from "./base.js";

const T = 0.016;

function vitrine(k, g, w, H) {
  const yc = UP_Y0 + H / 2, d = UP_D - 0.02;
  g.add(k.box(w - 0.004, H, T, "body", 0, yc, T / 2, "body"));
  for (const sx of [-1, 1]) g.add(k.box(T, H, d, "body", sx * (w / 2 - 0.002 - T / 2), yc, d / 2, "body"));
  for (const y of [UP_Y0 + T / 2, UP_Y0 + H - T / 2]) g.add(k.box(w - 0.004 - 2 * T, T, d, "body", 0, y, d / 2, "body"));
  for (const f of [1 / 3, 2 / 3]) g.add(k.box(w - 0.004 - 2 * T, T, d - 0.03, "body", 0, UP_Y0 + f * H, (d - 0.03) / 2, "body"));
  g.add(k.box(w - 0.06, 0.008, 0.012, "shelfLed", 0, UP_Y0 + H - T - 0.006, d - 0.03));
  k.lamp(0.8, 0.7, 0, UP_Y0 + H - 0.08, d * 0.6, g);

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

export function upper(k, w, variant) {
  const g = new THREE.Group();
  const H = TALL_H - UP_Y0;

  if (variant === "glass") {
    vitrine(k, g, w, H);
    return g;
  }

  g.add(k.box(w - 0.004, H, UP_D - 0.02, "body", 0, UP_Y0 + H / 2, UP_D / 2 - 0.01, "body"));
  const z = UP_D + 0.01;
  if (variant === "hood") {
    g.add(k.box(w - 0.006, H - 0.3, 0.02, "upper", 0, UP_Y0 + 0.3 + (H - 0.3) / 2, z, "upper"));
    g.add(k.box(w - 0.006, 0.3, UP_D, "black", 0, UP_Y0 + 0.15, UP_D / 2));
  } else if (variant === "lift") {
    const dh = H - 0.006, dw = w - 0.006;
    const d = k.pivot(g, 0, UP_Y0 + H / 2, z, dw, dh, "top");
    d.add(k.box(dw, dh, 0.02, "upper", 0, 0, 0, "upper"));
  } else {
    doorsRow(k, g, w, H - 0.006, UP_Y0 + H / 2, z, "upper", k.region);
  }
  return g;
}
