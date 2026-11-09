import * as THREE from "three";
import { MODULES, BASE_H, D, UP_D, UP_Y0, PLINTH, TOP_T } from "../modules/index.js";

const SWITCH_KEYS = new Set(["upper", "lower", "body", "splash", "wall", "glass", "frame"]);

export function buildKitchen(layout, mats, level) {
  const root = new THREE.Group();
  const switchable = [];
  const lamps = [];
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
    lamp(intensity, distance, x, y, z, parent) {
      if (!level.ledLights) return;
      const p = new THREE.PointLight("#ffd9a0", intensity, distance, 2);
      p.position.set(x, y, z);
      parent.add(p);
      lamps.push(p);
    },
    cyl(r1, r2, h, key, x, y, z) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 16), mats[key]);
      m.position.set(x, y, z);
      m.castShadow = level.shadows;
      return m;
    },
  };

  const mm = (v) => v / 1000;
  const room = { left: mm(layout.room.left), height: mm(layout.room.height) };
  const place = (obj, wall, s) => {
    if (wall === "back") obj.position.set(s, 0, 0);
    else { obj.position.set(room.left, 0, s); obj.rotation.y = Math.PI / 2; }
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
  plane(14, 14, "floor", [0, 0, 0], [-Math.PI / 2, 0, 0]);
  plane(14, room.height, "wall", [0, room.height / 2, 0], [0, 0, 0]);
  plane(8, room.height, "wall", [room.left, room.height / 2, 4], [0, Math.PI / 2, 0]);
  plane(14, 14, "wall", [0, room.height, 0], [Math.PI / 2, 0, 0]);

  for (const run of layout.runs) {
    let s = mm(run.from);
    const segments = [];
    let seg = null;
    for (const it of run.items) {
      const w = mm(it.w);
      const c = s + w / 2;
      if (it.tall) {
        place(MODULES.tall(k, w, it.tall, it.h ? mm(it.h) : undefined), run.wall, c);
        seg = null;
      } else {
        place(MODULES.base(k, w, it.base), run.wall, c);
        if (it.upper) place(MODULES.upper(k, w, it.upper), run.wall, c);
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
      for (let i = 0; i < n; i++) {
        const t = sg.from + (len * (i + 0.5)) / n;
        const p = new THREE.PointLight("#ffd9a0", 3, 1.8, 2);
        if (run.wall === "back") p.position.set(t, UP_Y0 - 0.05, 0.3);
        else p.position.set(room.left + 0.3, UP_Y0 - 0.05, t);
        root.add(p);
        lamps.push(p);
      }
    }
  }

  const parts = switchable
    .filter((s) => s.front)
    .map((s) => ({ group: s.mesh.userData.group, w: Math.round(s.mesh.userData.w * 1000), h: Math.round(s.mesh.userData.h * 1000) }));

  return { root, switchable, lamps, parts };
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
  day: { hemi: 1.5, hemiColor: "#f4f7fb", key: 2.4, keyColor: "#fffaf2", fill: 1.0, exposure: 1.0, lamps: false },
  night: { hemi: 0.35, hemiColor: "#fff1dc", key: 0.35, keyColor: "#ffe2bd", fill: 0.25, exposure: 1.05, lamps: true },
};
