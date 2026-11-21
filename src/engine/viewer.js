import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { LEVELS, pixelRatioFor, refineRatioFor } from "./quality.js";
import { createOrbit } from "./controls.js";
import { createTextures, createGroupMaterials, applyDecor, frontUV, sheetLayout } from "./materials.js";
import { buildKitchen, addLights, LIGHT_MODES } from "./build.js";
import { toRuns } from "./layout.js";
import { findGlass, findFrame } from "../catalog/glass.js";

const GROUP_KEYS = ["upper", "lower", "body", "splash", "top"];

export function createViewer(container, levelId, onStats, onPick) {
  const level = LEVELS[levelId];
  const renderer = new THREE.WebGLRenderer({ antialias: level.antialias, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = level.shadows;
  renderer.shadowMap.type = level.shadowSize >= 2048 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#d9d5cf");
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
  const lights = addLights(scene, level);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  let dirty = true;
  const invalidate = () => { dirty = true; };
  const tex = createTextures(renderer, invalidate);

  const fixed = {
    top: new THREE.MeshStandardMaterial({ color: "#e8e3da", roughness: 0.45 }),
    black: new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.4, metalness: 0.3 }),
    shelfLed: new THREE.MeshStandardMaterial({ color: "#d8d2c6", emissive: "#ffd9a0", emissiveIntensity: 0 }),
    led: new THREE.MeshStandardMaterial({ color: "#d8d2c6", emissive: "#ffd9a0", emissiveIntensity: 0 }),
    floor: new THREE.MeshStandardMaterial({ color: "#cfcac2", roughness: 0.6 }),
    hob: new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.15, metalness: 0.4 }),
  };
  const sideMats = () => ({
    ...createGroupMaterials(),
    wall: new THREE.MeshStandardMaterial({ color: "#e6e2db", roughness: 1 }),
    glass: new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, metalness: 0 }),
    frame: new THREE.MeshStandardMaterial({ color: "#151515" }),
  });
  const side = { A: { mats: sideMats(), uv: new Map() }, B: { mats: sideMats(), uv: new Map() } };

  let kitchen = null;
  let decors = new Map();
  const finish = { A: null, B: null };
  let compare = false, split = 0.5, lightMode = "day";

  const raycaster = new THREE.Raycaster();
  const pick = (x, y) => {
    if (!kitchen) return;
    raycaster.setFromCamera({ x, y }, camera);
    const hit = raycaster.intersectObjects(kitchen.pickables, true)[0];
    let o = hit?.object;
    while (o && !o.userData.itemId) o = o.parent;
    onPick?.(o?.userData.itemId ?? null);
  };
  const frame = { t: 0.384, a: 1.6 };
  const orbit = createOrbit(renderer.domElement, camera, invalidate, pick, frame);

  const selBox = new THREE.Box3Helper(new THREE.Box3(), 0xf07a1a);
  selBox.visible = false;
  selBox.material.depthTest = false;
  selBox.renderOrder = 10;
  scene.add(selBox);
  let selected = null;
  const showSelection = () => {
    const obj = kitchen?.pickables.find((p) => p.userData.itemId === selected);
    selBox.visible = !!obj;
    if (obj) selBox.box.setFromObject(obj).expandByScalar(0.01);
    invalidate();
  };

  let openT = 0, openTarget = 0, openAnim = false;
  const applyOpen = () => {
    const e = openT * openT * (3 - 2 * openT);
    for (const m of kitchen?.movers ?? []) {
      if (m.slide) m.obj.position.z = m.slide * e;
      else m.obj.rotation[m.axis] = m.max * e;
    }
    renderer.shadowMap.needsUpdate = true;
    invalidate();
  };

  const bindSide = (s) => {
    const { mats, uv } = side[s];
    for (const it of kitchen.switchable) {
      it.mesh.material = mats[it.key];
      if (it.front) {
        const a = uv.get(it.mesh);
        if (a && it.mesh.geometry.attributes.uv !== a) it.mesh.geometry.setAttribute("uv", a);
      }
    }
  };

  const applyFinish = (s) => {
    const f = finish[s];
    if (!f || !kitchen) return;
    const { mats, uv } = side[s];
    mats.wall.color.set(f.wallHex);
    const gl = findGlass(f.glass?.tint), fr = findFrame(f.glass?.frame);
    mats.glass.color.set(gl.hex);
    mats.glass.opacity = gl.opacity;
    mats.glass.roughness = gl.roughness;
    mats.frame.color.set(fr.hex);
    mats.frame.metalness = fr.metalness;
    mats.frame.roughness = fr.roughness;
    for (const key of GROUP_KEYS) {
      const sel = f[key];
      const d = sel?.code ? decors.get(sel.code) : null;
      applyDecor(mats[key], d, level, tex, key === "splash" ? f.wallHex : key === "top" ? "#e8e3da" : null);
      const sheet = d ? d.sheet : [600, 400];
      if (key === "top" || key === "splash")
        for (const it of kitchen.switchable) if (it.front && it.mesh.userData.group === key) uv.set(it.mesh, frontUV(it.mesh, sheet, sel?.rot ?? true));
    }
    // группы с одним и тем же декором режутся из одних листов — общий раскрой
    const cut = new Map();
    for (const key of ["upper", "lower", "body"]) {
      const sel = f[key];
      const id = `${sel?.code}|${sel?.rot ?? true}`;
      if (!cut.has(id)) cut.set(id, { sel, keys: [] });
      cut.get(id).keys.push(key);
    }
    for (const { sel, keys } of cut.values()) {
      const d = sel?.code ? decors.get(sel.code) : null;
      const parts = kitchen.switchable.filter((it) => it.front && keys.includes(it.mesh.userData.group)).map((it) => it.mesh);
      for (const [m, a] of sheetLayout(parts, d ? d.sheet : [600, 400], sel?.rot ?? true)) uv.set(m, a);
    }
    invalidate();
  };

  let anchors = [], roomC = 0, anchorCb = null, lastA = "";
  const AX = { upper: -0.55, splash: 0.35, top: -0.1, lower: 0.6, body: 1.2 };
  const AY = { upper: 1.95, splash: 1.2, top: 0.9, lower: 0.45, body: 1.0 };
  const rc = new THREE.Raycaster();
  const computeAnchors = () => {
    anchors = [];
    if (!kitchen) return;
    kitchen.root.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    const keyOf = new Map(kitchen.switchable.map((it) => [it.mesh, it.key]));
    const solids = [];
    kitchen.root.traverse((o) => { if (o.isMesh && o.visible && !(o.material?.transparent)) solids.push(o); });
    const eye = camera.getWorldPosition(new THREE.Vector3());
    for (const key of GROUP_KEYS) {
      const items = kitchen.switchable.filter((it) => it.key === key);
      if (!items.length) continue;
      const tx = roomC + AX[key], ty = AY[key];
      let best = null, bestS = Infinity, fallback = null;
      for (const it of items) {
        const bx = new THREE.Box3().setFromObject(it.mesh);
        if (bx.isEmpty()) continue;
        const dx = bx.max.x - bx.min.x, dy = bx.max.y - bx.min.y, dz = bx.max.z - bx.min.z;
        const cy = Math.min(bx.max.y, Math.max(bx.min.y, ty));
        const pts = [];
        if (key === "top") pts.push(new THREE.Vector3(Math.min(bx.max.x, Math.max(bx.min.x, tx)), bx.max.y, bx.max.z - 0.02));
        else if (dz <= dx) pts.push(new THREE.Vector3(Math.min(bx.max.x - 0.05, Math.max(bx.min.x + 0.05, tx)), cy, bx.max.z + 0.003));
        else pts.push(new THREE.Vector3(bx.max.x + 0.003, cy, (bx.min.z + bx.max.z) / 2), new THREE.Vector3(bx.min.x - 0.003, cy, (bx.min.z + bx.max.z) / 2));
        for (const p of pts) {
          fallback ||= p;
          const dir = p.clone().sub(eye);
          const dist = dir.length();
          rc.set(eye, dir.normalize());
          rc.far = dist + 0.05;
          const hit = rc.intersectObjects(solids, false)[0];
          if (!hit || keyOf.get(hit.object) !== key || hit.distance < dist - 0.06) continue;
          const sc = Math.abs(p.x - tx) + Math.abs(p.y - ty) * 0.7 - Math.min(dy, 0.8) * 0.2;
          if (sc < bestS) { bestS = sc; best = p; }
        }
      }
      if (best || fallback) anchors.push({ key, p: best || fallback });
    }
    lastA = "";
  };
  const v3 = new THREE.Vector3();
  const emitAnchors = () => {
    if (!anchorCb || !kitchen) return;
    const size = renderer.getSize(new THREE.Vector2());
    const list = anchors.map(({ key, p }) => {
      v3.copy(p).project(camera);
      return { key, x: Math.round(((v3.x + 1) / 2) * size.x), y: Math.round(((1 - v3.y) / 2) * size.y), on: v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05 };
    });
    const sig = JSON.stringify(list);
    if (sig !== lastA) { lastA = sig; anchorCb(list); }
  };

  const setLayout = (model) => {
    if (kitchen) {
      scene.remove(kitchen.root);
      kitchen.root.traverse((o) => o.geometry?.dispose());
    }
    const plan = toRuns(model);
    kitchen = buildKitchen(plan, { ...fixed, ...side.A.mats }, level);
    roomC = (plan.room.left + plan.room.right) / 2000;
    orbit.setFit(roomC, (plan.room.right - plan.room.left) / 1000);
    applyOpen();
    showSelection();
    side.A.uv.clear();
    side.B.uv.clear();
    scene.add(kitchen.root);
    computeAnchors();
    applyLight();
    applyFinish("A");
    applyFinish("B");
    renderer.shadowMap.needsUpdate = true;
    invalidate();
  };

  function applyLight() {
    const m = LIGHT_MODES[lightMode];
    lights.hemi.intensity = m.hemi;
    lights.hemi.color.set(m.hemiColor);
    lights.key.intensity = m.key;
    lights.key.color.set(m.keyColor);
    lights.fill.intensity = m.fill;
    scene.environmentIntensity = m.env;
    lights.spots.forEach((sp) => (sp.visible = m.lamps));
    kitchen?.lamps.forEach((l) => (l.visible = m.lamps));
    fixed.led.emissiveIntensity = m.lamps ? 3 : 0;
    fixed.shelfLed.emissiveIntensity = m.lamps ? 2.5 : 0;
    renderer.toneMappingExposure = m.exposure;
    renderer.toneMapping = m.tone === "none" ? THREE.NoToneMapping : THREE.NeutralToneMapping;
    invalidate();
  }

  let baseRatio = 1, refineRatio = 1, refined = true, lastChange = 0, insetR = 0, insetB = 0, insetT = 0;
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    baseRatio = pixelRatioFor(levelId, w, h);
    refineRatio = refineRatioFor(w, h);
    refined = false;
    renderer.setPixelRatio(baseRatio);
    renderer.setSize(w, h);
    const r = insetR > 0 && w > insetR * 1.6 ? insetR : 0;
    let b = insetB > 0 && h > insetB * 1.4 ? insetB : 0;
    const t = b && h - b - insetT > 160 ? insetT : 0;
    const uw = w - r, uh = h - b - t;
    const vh = h + Math.abs(b - t);
    frame.a = uw / Math.max(uh, 1);
    frame.t = Math.min(0.7, Math.max(0.384, 0.36 / frame.a));
    camera.fov = (2 * Math.atan(frame.t * vh / Math.max(uh, 1)) * 180) / Math.PI;
    camera.aspect = (w + r) / Math.max(vh, 1);
    if (r || vh !== h) camera.setViewOffset(w + r, vh, r, Math.max(0, b - t), w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    orbit?.refit();
    invalidate();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const render = () => {
    if (!kitchen) return;
    const size = renderer.getSize(new THREE.Vector2()), w = size.x, h = size.y;
    if (compare) {
      const x = Math.round(w * split);
      renderer.setScissorTest(true);
      bindSide("A");
      renderer.setScissor(0, 0, x, h);
      renderer.render(scene, camera);
      bindSide("B");
      renderer.setScissor(x, 0, w - x, h);
      renderer.render(scene, camera);
      renderer.setScissorTest(false);
    } else {
      bindSide("A");
      renderer.render(scene, camera);
    }
  };

  let raf, frames = 0, t0 = performance.now(), bench = null, lastFps = 0, prev = performance.now();
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    if (openAnim) {
      openT += Math.sign(openTarget - openT) * dt * 1.6;
      if ((openTarget === 1 && openT >= 1) || (openTarget === 0 && openT <= 0)) { openT = openTarget; openAnim = false; }
      applyOpen();
    }
    if (dirty || bench) {
      dirty = false;
      if (renderer.getPixelRatio() !== baseRatio) renderer.setPixelRatio(baseRatio);
      render();
      emitAnchors();
      frames++;
      if (bench) bench.frames++;
      refined = false;
      lastChange = now;
    } else if (!refined && !openAnim && now - lastChange > 450) {
      refined = true;
      if (refineRatio > baseRatio + 0.05) {
        renderer.setPixelRatio(refineRatio);
        render();
      }
    }
    if (now - t0 >= 500) {
      if (frames > 0) lastFps = Math.round((frames * 1000) / (now - t0));
      onStats?.({ fps: lastFps, active: frames > 0 });
      frames = 0;
      t0 = now;
    }
    if (bench && now - bench.start >= bench.ms) {
      const b = bench;
      bench = null;
      b.resolve(Math.round((b.frames * 1000) / (now - b.start)));
    }
  };
  raf = requestAnimationFrame(loop);

  return {
    renderer,
    get parts() { return kitchen?.parts ?? []; },
    setLayout,
    setDecors(list) { decors = new Map(list.map((d) => [d.code, d])); applyFinish("A"); applyFinish("B"); },
    setFinish(s, f) { finish[s] = f; applyFinish(s); },
    setCompare(on) { compare = on; invalidate(); },
    setSplit(v) { split = v; invalidate(); },
    setLight(mode) { lightMode = mode; applyLight(); },
    setOpen(on) { openTarget = on ? 1 : 0; openAnim = openT !== openTarget; },
    setSelected(id) { selected = id; showSelection(); },
    setView: (v) => orbit.setView(v),
    onAnchors(cb) { anchorCb = cb; lastA = ""; invalidate(); },
    setInset(r, b = 0, t = 0) { if (r !== insetR || b !== insetB || t !== insetT) { insetR = r; insetB = b; insetT = t; resize(); } },
    benchmark(ms = 2500) {
      return new Promise((resolve) => { bench = { start: performance.now(), ms, frames: 0, resolve }; });
    },
    snapshot(w = 1600, h = 1000) {
      const saved = { ...frame };
      if (orbit.auto) { frame.t = 0.384; frame.a = w / h; orbit.refit(); }
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.clearViewOffset();
      camera.fov = (2 * Math.atan(frame.t) * 180) / Math.PI;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
      const url = renderer.domElement.toDataURL("image/jpeg", 0.92);
      Object.assign(frame, saved);
      resize();
      return url;
    },
    screenshot() {
      const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
      const pr = renderer.getPixelRatio();
      renderer.setPixelRatio(Math.min(2, (window.devicePixelRatio || 1) * 2));
      renderer.setSize(w, h, false);
      render();
      const url = renderer.domElement.toDataURL("image/png");
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      invalidate();
      return url;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      orbit.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
