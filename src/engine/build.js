import * as THREE from "three";
import { hinge, PANEL_IN } from "../modules/mech.js";
import { MODULES, BASE_H, D, UP_D, UP_Y0, PLINTH, TOP_T, TOP_R } from "../modules/index.js";

// Столешница-постформинг: передний край скруглён сверху и снизу, пластик обходит кромку — рисунок идёт через неё
function worktopGeometry(len, depth, t, r) {
  const prof = [[0, t]];
  const arc = (cz, cy, a0, a1) => { for (let i = 1; i <= 8; i++) { const a = a0 + ((a1 - a0) * i) / 8; prof.push([cz + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  prof.push([depth - r, t]);
  arc(depth - r, t - r, Math.PI / 2, 0);
  prof.push([depth, r]);
  arc(depth - r, r, 0, -Math.PI / 2);
  const front = prof.length;
  prof.push([0, 0]);
  const s = [0];
  for (let i = 1; i < prof.length; i++) s.push(s[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
  const S = s[front - 1];
  const pos = [], uv = [], idx = [];
  const x0 = -len / 2, x1 = len / 2;
  for (let i = 0; i < prof.length; i++) {
    const [z, y] = prof[i], v = 1 - Math.min(1, s[i] / S);
    pos.push(x0, y, z, x1, y, z);
    uv.push(0, v, 1, v);
  }
  for (let i = 0; i < prof.length - 1; i++) {
    const a = i * 2, b = a + 2;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g0 = new THREE.BufferGeometry();
  g0.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g0.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g0.setIndex(idx);
  const side = new THREE.BufferGeometry();
  const sp = [], su = [], si = [];
  for (const [x, flip] of [[x0, true], [x1, false]]) {
    const base = sp.length / 3;
    sp.push(x, t / 2, depth / 2);
    su.push(0.5, 0.5);
    for (const [z, y] of prof) { sp.push(x, y, z); su.push(z / depth, y / depth); }
    for (let i = 0; i < prof.length; i++) {
      const a = base + 1 + i, b = base + 1 + ((i + 1) % prof.length);
      if (flip) si.push(base, b, a); else si.push(base, a, b);
    }
  }
  side.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  side.setAttribute("uv", new THREE.Float32BufferAttribute(su, 2));
  side.setIndex(si);
  const g = mergeTwo(g0, side);
  g.computeVertexNormals();
  return g;
}

function mergeTwo(a, b) {
  const g = new THREE.BufferGeometry();
  const n = a.attributes.position.count;
  const cat = (k) => { const x = a.attributes[k].array, y = b.attributes[k].array, o = new Float32Array(x.length + y.length); o.set(x); o.set(y, x.length); return o; };
  g.setAttribute("position", new THREE.BufferAttribute(cat("position"), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(cat("uv"), 2));
  g.setIndex([...a.index.array, ...[...b.index.array].map((i) => i + n)]);
  return g;
}

const SWITCH_KEYS = new Set(["upper", "lower", "body", "splash", "top", "wall", "glass", "frame"]);
const mm = (v) => v / 1000;

export function buildKitchen(plan, mats, level) {
  const root = new THREE.Group();
  const switchable = [];
  const lamps = [];
  const movers = [];
  const pickables = [];
  const hardware = [];
  let regionIdx = 0, needTop = 0;
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
      track(m, key, group, w, reg?.top ? d : h, reg);
      return m;
    },
    worktop(len, depth, x, z) {
      const m = new THREE.Mesh(worktopGeometry(len, depth, TOP_T, TOP_R), mats.top);
      m.position.set(x, BASE_H, z);
      m.castShadow = level.shadows;
      m.receiveShadow = level.shadows;
      track(m, "top", "top", len, depth, { ox: 0, oy: 0, top: true });
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
    pivot(parent, cx, cy, z, w, h, side, hinges = true) {
      const pivot = new THREE.Group(), inner = new THREE.Group();
      if (side === "top") {
        pivot.position.set(cx, cy + h / 2, z);
        inner.position.set(0, -h / 2, 0);
        movers.push({ obj: pivot, axis: "x", max: -1.75 });
      } else {
        // ось в 9 мм от кромки и 8 мм перед внутренней плоскостью двери: при 90° дверь не выходит
        // за габарит своего шкафа и не задевает торец боковины
        const sx = side === "left" ? -1 : 1, zIn = z - 0.01;
        pivot.position.set(cx + sx * (w / 2 - 0.009), cy, zIn + 0.008);
        inner.position.set(-sx * (w / 2 - 0.009), 0, 0.002);
        movers.push({ obj: pivot, axis: "y", max: side === "left" ? -Math.PI / 2 : Math.PI / 2 });
        const n = h > 1.6 ? 4 : h > 0.9 ? 3 : 2;
        for (let i = 0; hinges && i < n; i++) {
          const y = -h / 2 + 0.1 + ((h - 0.2) * i) / (n - 1), px = sx * (w / 2 - PANEL_IN);
          hinge(k, inner, parent, { dp: [px, y, -0.01], bp: [cx + px, cy + y, zIn], mx: -sx });
        }
      }
      pivot.add(inner);
      parent.add(pivot);
      return inner;
    },
    slider(parent, dist) {
      const s = new THREE.Group();
      parent.add(s);
      const mv = { obj: s, slide: dist };
      s.userData.mv = mv;
      movers.push(mv);
      return s;
    },
    setSlide(s, dist) { s.userData.mv.slide = dist; },
    mat(key) { return mats[key]; },
    flat() { return { ...region(), top: true }; },
    need(y) { needTop = Math.max(needTop, y); },
    mover(apply) { movers.push({ apply }); },
    hw(o) { hardware.push(o); return o; },
    link(parent, a, b, r, key, flat = null, fixed = 0) {
      const geo = flat ? new THREE.BoxGeometry(flat[0], 1, flat[1]) : new THREE.CylinderGeometry(r, r, 1, 8);
      const rod = new THREE.Mesh(geo, mats[key]);
      rod.castShadow = !flat && level.shadows;
      parent.add(rod);
      const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      const ax = new THREE.Vector3(), az = new THREE.Vector3(), basis = new THREE.Matrix4();
      movers.push({
        apply() {
          b.updateWorldMatrix(true, false);
          a.updateWorldMatrix(true, false);
          a.getWorldPosition(v1);
          b.getWorldPosition(v2);
          parent.worldToLocal(v1);
          parent.worldToLocal(v2);
          v2.sub(v1);
          const L = v2.length();
          if (L < 1e-5) return;
          v2.multiplyScalar(1 / L);
          // fixed — деталь постоянной длины от первой точки (труба упора), иначе тянется между точками
          const len = fixed || L;
          rod.scale.set(1, len, 1);
          rod.position.copy(v1).addScaledVector(v2, len / 2);
          if (flat) {
            // широкая сторона пластины — по вертикали
            ax.crossVectors(flat[2] || up, v2).normalize();
            az.crossVectors(ax, v2);
            rod.quaternion.setFromRotationMatrix(basis.makeBasis(ax, v2, az));
          } else rod.quaternion.setFromUnitVectors(up, v2);
        },
      });
      return rod;
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
    const g = new THREE.PlaneGeometry(w, h);
    if (key === "wall") { const a = g.attributes.uv.array; for (let i = 0; i < a.length; i += 2) { a[i] *= w; a[i + 1] *= h; } }
    const m = new THREE.Mesh(g, mats[key]);
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.receiveShadow = level.shadows;
    track(m, key);
    root.add(m);
  };

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
        const g = MODULES.base(k, w, it.base, { dr: it.dr, dt: it.dt });
        if (it.upper && it.upper !== "none") g.add(MODULES.upper(k, w, it.upper, { uh: it.uh, um: it.um, um2: it.um2 }));
        place(g, run.wall, c, it.id);
        if (!seg) segments.push((seg = { from: s, to: s }));
        seg.to = s + w;
      }
      s += w;
    }

    for (const sg of segments) {
      const len = sg.to - sg.from, c = (sg.from + sg.to) / 2;
      const g = new THREE.Group();
      g.add(k.worktop(len + 0.02, D + 0.03, 0, 0));
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
    isl.add(k.worktop(w + 0.04, D + 0.33, 0, -0.15));
    isl.position.set(mm(plan.island.from) + w / 2, 0, mm(plan.island.z));
    isl.userData.itemId = "island";
    pickables.push(isl);
    root.add(isl);
  }

  // если открытому подъёмнику не хватает места — поднимаем потолок
  if (needTop + 0.03 > R.height) R.height = Math.ceil((needTop + 0.03) * 20) / 20;
  const W = R.right - R.left, cx = (R.left + R.right) / 2;
  plane(16, 16, "floor", [cx, 0, 4], [-Math.PI / 2, 0, 0]);
  plane(W, R.height, "wall", [cx, R.height / 2, 0], [0, 0, 0]);
  plane(8, R.height, "wall", [R.left, R.height / 2, 4], [0, Math.PI / 2, 0]);
  plane(8, R.height, "wall", [R.right, R.height / 2, 4], [0, -Math.PI / 2, 0]);
  plane(16, 16, "ceil", [cx, R.height, 4], [Math.PI / 2, 0, 0]);

  const parts = switchable
    .filter((s) => s.front)
    .map((s) => ({ group: s.mesh.userData.group, w: Math.round(s.mesh.userData.w * 1000), h: Math.round(s.mesh.userData.h * 1000) }));

  return { root, switchable, lamps, movers, pickables, hardware, parts, height: R.height };
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
