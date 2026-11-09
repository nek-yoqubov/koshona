import * as THREE from "three";
import { LEVELS, pixelRatioFor } from "./quality.js";
import { createOrbit } from "./controls.js";
import { createTextures, createGroupMaterials, applyDecor, frontUV } from "./materials.js";
import { buildKitchen, addLights, LIGHT_MODES } from "./build.js";
import { toRuns } from "./layout.js";
import { findGlass, findFrame } from "../catalog/glass.js";

const GROUP_KEYS = ["upper", "lower", "body", "splash"];

export function createViewer(container, levelId, onStats, onPick) {
  const level = LEVELS[levelId];
  const renderer = new THREE.WebGLRenderer({ antialias: level.antialias, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = level.shadows;
  renderer.shadowMap.type = level.shadowSize >= 2048 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#d9d5cf");
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
  const lights = addLights(scene, level);

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
  const orbit = createOrbit(renderer.domElement, camera, invalidate, pick);

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
      applyDecor(mats[key], d, level, tex, key === "splash" ? f.wallHex : null);
      const sheet = d ? d.sheet : [600, 400];
      for (const it of kitchen.switchable) {
        if (it.front && it.mesh.userData.group === key) uv.set(it.mesh, frontUV(it.mesh, sheet, sel?.rot ?? true));
      }
    }
    invalidate();
  };

  const setLayout = (model) => {
    if (kitchen) {
      scene.remove(kitchen.root);
      kitchen.root.traverse((o) => o.geometry?.dispose());
    }
    const plan = toRuns(model);
    kitchen = buildKitchen(plan, { ...fixed, ...side.A.mats }, level);
    orbit.setFit((plan.room.left + plan.room.right) / 2000, (plan.room.right - plan.room.left) / 1000);
    applyOpen();
    showSelection();
    side.A.uv.clear();
    side.B.uv.clear();
    scene.add(kitchen.root);
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
    lights.spots.forEach((sp) => (sp.visible = m.lamps));
    kitchen?.lamps.forEach((l) => (l.visible = m.lamps));
    fixed.led.emissiveIntensity = m.lamps ? 3 : 0;
    fixed.shelfLed.emissiveIntensity = m.lamps ? 2.5 : 0;
    renderer.toneMappingExposure = m.exposure;
    invalidate();
  }

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setPixelRatio(pixelRatioFor(levelId, w, h));
    renderer.setSize(w, h);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    invalidate();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const render = () => {
    if (!kitchen) return;
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
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
      render();
      frames++;
      if (bench) bench.frames++;
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
    benchmark(ms = 2500) {
      return new Promise((resolve) => { bench = { start: performance.now(), ms, frames: 0, resolve }; });
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
