import * as THREE from "three";
import { MODULES, BASE_H, D, UP_D, UP_Y0, PLINTH, TOP_T } from "../modules/index.js";

const SWITCH_KEYS = new Set(["upper", "lower", "body", "splash", "wall", "glass", "frame"]);
const mm = (v) => v / 1000;

export function buildKitchen(plan, mats, level) {
  const root = new THREE.Group();
  const switchable = [];
  const lamps = [];
  const movers = [];
  const pickables = [];
  let regionIdx = 0;
  const frac = (x) => x - Math.floor(x);
  const region = () => ({ ox: frac(0.618034 * ++regionIdx), oy: frac(0.381966 * regionIdx + 0.25) });

  const track = (mesh, key, group, w, h, reg) => {
    if (!SWITCH_KEYS.has(key)) return;
    const item = { mesh, key };
    if (group) {
      mesh.userData = { w, h, group, ...(reg || region()) };
      item.front = true;
    }
    switchable.push(item);
  };

  const k = {
    region,
    box(w, h, d, key, x, y, z, group = null, reg = null) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[key]);
      m.position.set(x, y, z);
      m.castShadow = level.shadows;
      m.receiveShadow = level.shadows;
      track(m, key, group, w, h, reg);
      return m;
    },
    cyl(r1, r2, h, key, x, y, z) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 16), mats[key]);
      m.position.set(x, y, z);
      m.castShadow = level.shadows;
      return m;
    },
    lamp(intensity, distance, x, y, z, parent) {
      if (!level.ledLights) return;
      const p = new THREE.PointLight("#ffd9a0", intensity, distance, 2);
      p.position.set(x, y, z);
      parent.add(p);
      lamps.push(p);
    },
    pivot(parent, cx, cy, z, w, h, side) {
      const pivot = new THREE.Group(), inner = new THREE.Group();
      if (side === "top") {
        pivot.position.set(cx, cy + h / 2, z);
        inner.position.set(0, -h / 2, 0);
        movers.push({ obj: pivot, axis: "x", max: -1.75 });
      } else {
        const sx = side === "left" ? -1 : 1;
        pivot.position.set(cx + (sx * w) / 2, cy, z);
        inner.position.set((-sx * w) / 2, 0, 0);
        movers.push({ obj: pivot, axis: "y", max: side === "left" ? -1.6 : 1.6 });
      }
      pivot.add(inner);
      parent.add(pivot);
      return inner;
    },
    slider(parent, dist) {
      const s = new THREE.Group();
      parent.add(s);
      movers.push({ obj: s, slide: dist });
      return s;
    },
  };

  const { room } = plan;
  const R = { left: mm(room.left), right: mm(room.right), height: mm(room.height) };

  const place = (obj, wall, s, id) => {
    if (wall === "back") obj.position.set(s, 0, 0);
    else if (wall === "left") { obj.position.set(R.left, 0, s); obj.rotation.y = Math.PI / 2; }
    else { obj.position.set(R.right, 0, s); obj.rotation.y = -Math.PI / 2; }
    if (id) { obj.userData.itemId = id; pickables.push(obj); }
    root.add(obj);
  };

  const plane = (w, h, key, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats[key]);
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.receiveShadow = level.shadows;
    track(m, key);
    root.add(m);
  };
  const W = R.right - R.left, cx = (R.left + R.right) / 2;
  plane(16, 16, "floor", [cx, 0, 4], [-Math.PI / 2, 0, 0]);
  plane(W, R.height, "wall", [cx, R.height / 2, 0], [0, 0, 0]);
  plane(8, R.height, "wall", [R.left, R.height / 2, 4], [0, Math.PI / 2, 0]);
  plane(8, R.height, "wall", [R.right, R.height / 2, 4], [0, -Math.PI / 2, 0]);
  plane(16, 16, "wall", [cx, R.height, 4], [Math.PI / 2, 0, 0]);

  const lampAt = (wall, t) => {
    if (!level.ledLights) return;
    const p = new THREE.PointLight("#ffd9a0", 3, 1.8, 2);
    if (wall === "back") p.position.set(t, UP_Y0 - 0.05, 0.3);
    else if (wall === "left") p.position.set(R.left + 0.3, UP_Y0 - 0.05, t);
    else p.position.set(R.right - 0.3, UP_Y0 - 0.05, t);
    root.add(p);
    lamps.push(p);
  };

  for (const run of plan.runs) {
    let s = mm(run.from);
    const segments = [];
    let seg = null;
    for (const it of run.items) {
      const w = mm(it.w), c = s + w / 2;
      if (it.kind === "tall") {
        place(MODULES.tall(k, w, it.tall), run.wall, c, it.id);
        seg = null;
      } else {
        const g = MODULES.base(k, w, it.base);
        if (it.upper && it.upper !== "none") g.add(MODULES.upper(k, w, it.upper));
        place(g, run.wall, c, it.id);
        if (!seg) segments.push((seg = { from: s, to: s }));
        seg.to = s + w;
      }
      s += w;
    }

    for (const sg of segments) {
      const len = sg.to - sg.from, c = (sg.from + sg.to) / 2;
      const g = new THREE.Group();
      g.add(k.box(len + 0.02, TOP_T, D + 0.03, "top", 0, BASE_H + TOP_T / 2, (D + 0.03) / 2));
      const sh = UP_Y0 - BASE_H - TOP_T;
      g.add(k.box(len, sh, 0.01, "splash", 0, BASE_H + TOP_T + sh / 2, 0.005, "splash", { ox: frac(0.3 + c), oy: 0.5 }));
      for (const [y, z] of [[UP_Y0 - 0.005, UP_D - 0.03], [PLINTH - 0.005, D - 0.07]]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(len, 0.01, 0.02), mats.led);
        l.position.set(0, y, z);
        g.add(l);
      }
      place(g, run.wall, c);
      const n = level.ledLights === 0 ? 0 : Math.max(1, Math.round(len / (level.ledLights === 2 ? 1 : 1.8)));
      for (let i = 0; i < n; i++) lampAt(run.wall, sg.from + (len * (i + 0.5)) / n);
    }
  }

  if (plan.island) {
    const isl = new THREE.Group();
    const w = mm(plan.island.w), n = Math.max(2, Math.round(w / 0.6)), sw = w / n;
    for (let i = 0; i < n; i++) {
      const m = MODULES.base(k, sw, "drawers");
      m.position.x = -w / 2 + sw * (i + 0.5);
      isl.add(m);
    }
    isl.add(k.box(w + 0.04, TOP_T, D + 0.33, "top", 0, BASE_H + TOP_T / 2, (D + 0.03) / 2 - 0.15));
    isl.position.set(mm(plan.island.from) + w / 2, 0, mm(plan.island.z));
    isl.userData.itemId = "island";
    pickables.push(isl);
    root.add(isl);
  }

  const parts = switchable
    .filter((s) => s.front)
    .map((s) => ({ group: s.mesh.userData.group, w: Math.round(s.mesh.userData.w * 1000), h: Math.round(s.mesh.userData.h * 1000) }));

  return { root, switchable, lamps, movers, pickables, parts };
}

export function addLights(scene, level) {
  const hemi = new THREE.HemisphereLight("#fff8ee", "#8f877c", 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight("#fff3e2", 1.6);
  key.position.set(1.5, 4, 4);
  if (level.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(level.shadowSize, level.shadowSize);
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
    key.shadow.bias = -0.0005;
    key.shadow.radius = 4;
  }
  scene.add(key);
  const fill = new THREE.DirectionalLight("#dfe8ff", 0.8);
  fill.position.set(-4, 3, 3);
  scene.add(fill);
  const spots = [];
  if (level.spots) {
    for (const x of [-1.2, 0, 1.2]) {
      const sp = new THREE.SpotLight("#fff1dc", 10, 6, 0.6, 0.8, 1.5);
      sp.position.set(x, 2.68, 0.7);
      sp.target.position.set(x, 0, 0.5);
      scene.add(sp, sp.target);
      spots.push(sp);
    }
  }
  return { hemi, key, fill, spots };
}

export const LIGHT_MODES = {
  day: { env: 0.52, hemi: 0, hemiColor: "#ffffff", key: 0.52, keyColor: "#ffffff", fill: 0, exposure: 1.0, lamps: false, tone: "none" },
  night: { env: 0.12, hemi: 0.2, hemiColor: "#ffe9cf", key: 0.15, keyColor: "#ffe2bd", fill: 0.1, exposure: 1.0, lamps: true, tone: "neutral" },
};
