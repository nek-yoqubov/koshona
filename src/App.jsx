import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// three@0.160.0. Ждёт в public/: decors.json и /decors/<код>/{card.webp,detail.jpg,sheet.jpg,normal.png,roughness.jpg}
// Каждый фасад получает свой участок плиты 2800x2070 в реальных миллиметрах.

const GROUPS = [
  { key: "upper", label: "Верхние фасады" },
  { key: "lower", label: "Нижние фасады" },
  { key: "body", label: "Корпус" },
  { key: "splash", label: "Фартук" },
];

const BASE_H = 0.85, PLINTH = 0.12, D = 0.6, UP_D = 0.35, UP_Y0 = 1.45, TALL_H = 2.4, M = 0.6;
const FALLBACK_HEX = "#a39c93";
const NORMAL_TILE_MM = 300;
// цена за м², сомони. 0 — цена не показывается. Заполни своими цифрами.
const PRICE_M2 = { upper: 0, lower: 0, body: 0, splash: 0 };
const VIEWS = {
  overall: { theta: 0.25, phi: 1.32, r: 5.4, cx: -0.1, cy: 1.15 },
  fronts: { theta: 0.0, phi: 1.47, r: 3.8, cx: 0, cy: 1.25 },
  closeup: { theta: 0.35, phi: 1.5, r: 1.5, cx: 0.4, cy: 1.0 },
}; // размер одного повтора рельефа, мм (подстрой на глаз)

const loader = new THREE.TextureLoader();
const texCache = new Map();
let maxAniso = 1;
function loadTex(url, srgb, repeat) {
  url = import.meta.env.BASE_URL + url.replace(/^\//, "");
  if (!url) return null;
  const key = url;
  if (texCache.has(key)) return texCache.get(key);
  const t = loader.load(url);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

// раскладка фасадов по плите: каждый получает свой участок, ящики — подряд.
// vertical=true: рисунок по высоте детали (стандарт для дверей), иначе по ширине.
// Если деталь не влезает в плиту в выбранной ориентации — берём другую, если и так нет — масштаб.
function fitUV(mesh, sheetW, sheetH, vertical) {
  const { w, h, ox, oy } = mesh.userData;
  const geo = mesh.geometry;
  if (!geo.userData.uv0) geo.userData.uv0 = geo.attributes.uv.array.slice();
  const uv0 = geo.userData.uv0;
  const uv = geo.attributes.uv;
  const W = w * 1000, H = h * 1000;
  let vert = vertical;
  let su = vert ? H / sheetW : W / sheetW;   // доля плиты по длине
  let sv = vert ? W / sheetH : H / sheetH;   // доля плиты по ширине
  if (su > 1 || sv > 1) {
    const su2 = !vert ? H / sheetW : W / sheetW, sv2 = !vert ? W / sheetH : H / sheetH;
    if (su2 <= 1 && sv2 <= 1) { vert = !vert; su = su2; sv = sv2; }
    else { const k = Math.max(su, sv); su /= k; sv /= k; }
  }
  for (let i = 0; i < uv.count; i++) {
    const u = uv0[i * 2], v = uv0[i * 2 + 1];
    if (vert) uv.setXY(i, ox * (1 - su) + v * su, oy * (1 - sv) + u * sv);
    else uv.setXY(i, ox * (1 - su) + u * su, oy * (1 - sv) + v * sv);
  }
  uv.needsUpdate = true;
}

const WALLS = [
  { id: "warm", name: "Тёплый белый", hex: "#ece7de" },
  { id: "sand", name: "Песок", hex: "#d9cfbc" },
  { id: "greige", name: "Грейдж", hex: "#c9c1b4" },
  { id: "sage", name: "Шалфей", hex: "#b8bfae" },
  { id: "grey", name: "Серый", hex: "#a8a7a3" },
  { id: "dark", name: "Графит", hex: "#5b5b5c" },
  { id: "terra", name: "Терракота", hex: "#b48a72" },
  { id: "blue", name: "Пыльный синий", hex: "#8e9aa8" },
];

export default function KitchenLive() {
  const mountRef = useRef(null);
  const S = useRef({});
  const [decors, setDecors] = useState([]);
  const [choice, setChoice] = useState({ upper: null, lower: null, body: null, splash: null });
  const [wall, setWall] = useState("warm");
  const [rot, setRot] = useState({ upper: true, lower: true, body: true, splash: false });
  const [active, setActive] = useState("lower");
  const [search, setSearch] = useState("");
  const [led, setLed] = useState(true);
  const [parts, setParts] = useState([]);
  const [specOpen, setSpecOpen] = useState(false);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "decors.json")
      .then((r) => r.json())
      .then((list) => {
        setDecors(list);
        const ok = list.filter((d) => d.textures?.sheet);
        const pick = (i) => ok[i % ok.length]?.code ?? null;
        const h = new URLSearchParams(window.location.hash.slice(1));
        const has = (c) => list.some((d) => d.code === c);
        if (h.get("l")) {
          setChoice({
            upper: has(h.get("u")) ? h.get("u") : pick(0),
            lower: has(h.get("l")) ? h.get("l") : pick(0),
            body: has(h.get("b")) ? h.get("b") : pick(0),
            splash: has(h.get("s")) ? h.get("s") : null,
          });
          const r = h.get("r") || "1110";
          setRot({ upper: r[0] === "1", lower: r[1] === "1", body: r[2] === "1", splash: r[3] === "1" });
          if (h.get("w")) setWall(h.get("w"));
        } else {
          setChoice({ upper: pick(0), lower: pick(0), body: pick(0), splash: null });
        }
      })
      .catch(() => console.warn("decors.json не найден"));
  }, []);

  useEffect(() => {
    const el = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    maxAniso = renderer.capabilities.getMaxAnisotropy();
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#d9d5cf");
    const camera = new THREE.PerspectiveCamera(42, el.clientWidth / el.clientHeight, 0.1, 50);

    const mats = {
      upper: new THREE.MeshStandardMaterial({ color: FALLBACK_HEX, roughness: 0.5 }),
      lower: new THREE.MeshStandardMaterial({ color: FALLBACK_HEX, roughness: 0.5 }),
      body: new THREE.MeshStandardMaterial({ color: "#d8d4cc", roughness: 0.6 }),
      top: new THREE.MeshStandardMaterial({ color: "#e8e3da", roughness: 0.45 }),
      black: new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.4, metalness: 0.3 }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#6a6058", roughness: 0.05, metalness: 0, transmission: 0.85, thickness: 0.01, transparent: true }),
      shelfLight: new THREE.MeshStandardMaterial({ color: "#3a3028", emissive: "#ffb865", emissiveIntensity: 1.2 }),
      ledMat: new THREE.MeshStandardMaterial({ color: "#fff2d6", emissive: "#ffd9a0", emissiveIntensity: 3 }),
      splash: new THREE.MeshStandardMaterial({ color: "#ebe6de", roughness: 0.6 }),
      wall: new THREE.MeshStandardMaterial({ color: "#e6e2db", roughness: 1 }),
      floor: new THREE.MeshStandardMaterial({ color: "#cfcac2", roughness: 0.6 }),
      hob: new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.15, metalness: 0.4 }),
    };

    scene.add(new THREE.HemisphereLight("#fff8ee", "#8f877c", 1.1));
    const key = new THREE.DirectionalLight("#fff3e2", 1.6);
    key.position.set(1.5, 4, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -5; key.shadow.camera.right = 5;
    key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
    key.shadow.bias = -0.0005;
    key.shadow.radius = 4;
    scene.add(key);
    const fill = new THREE.DirectionalLight("#dfe8ff", 0.8);
    fill.position.set(-4, 3, 3);
    scene.add(fill);
    [-1.2, 0, 1.2].forEach((x) => {
      const sp = new THREE.SpotLight("#fff1dc", 10, 6, 0.6, 0.8, 1.5);
      sp.position.set(x, 2.68, 0.7);
      sp.target.position.set(x, 0, 0.5);
      scene.add(sp, sp.target);
    });

    const ledLights = new THREE.Group();
    scene.add(ledLights);

    const fronts = [];
    let frontIdx = 0;
    const frac = (x) => x - Math.floor(x);
    const region = () => ({ ox: frac(0.618034 * ++frontIdx), oy: frac(0.381966 * frontIdx + 0.25) });

    const mesh = (w, h, d, m, x, y, z, group = null, reg = null) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const me = new THREE.Mesh(g, m);
      me.position.set(x, y, z);
      me.castShadow = true; me.receiveShadow = true;
      if (group) {
        me.userData = { w, h, group, ...(reg || region()) };
        fronts.push(me);
      }
      return me;
    };

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mats.floor);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.7), mats.wall);
    back.position.set(0, 1.35, 0); back.receiveShadow = true; scene.add(back);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.7), mats.wall);
    left.rotation.y = Math.PI / 2; left.position.set(-2.1, 1.35, 4); left.receiveShadow = true; scene.add(left);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mats.wall);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 2.7; scene.add(ceil);

    const baseUnit = (x, z, w, rot, drawers = false) => {
      const g = new THREE.Group();
      g.add(mesh(w - 0.004, BASE_H - PLINTH, D - 0.02, mats.body, 0, PLINTH + (BASE_H - PLINTH) / 2, D / 2 - 0.01, "body"));
      g.add(mesh(w, PLINTH, D - 0.08, mats.body, 0, PLINTH / 2, D / 2 - 0.04, "body"));
      if (drawers) {
        const r0 = region();
        let y = PLINTH, acc = 0;
        [0.32, 0.2, 0.2].forEach((h) => {
          const fh = h - 0.04;
          const reg = { ox: r0.ox, oy: r0.oy + acc };
          g.add(mesh(w - 0.006, fh, 0.02, mats.lower, 0, y + fh / 2, D + 0.01, "lower", reg));
          g.add(mesh(w - 0.006, 0.04, 0.02, mats.black, 0, y + h - 0.02, D + 0.008));
          y += h; acc += h * 1000 / 2070 * 0.5;
        });
      } else {
        const fh = BASE_H - PLINTH - 0.04;
        g.add(mesh(w - 0.006, fh, 0.02, mats.lower, 0, PLINTH + fh / 2, D + 0.01, "lower"));
        g.add(mesh(w - 0.006, 0.04, 0.02, mats.black, 0, BASE_H - 0.02, D + 0.008));
      }
      g.position.set(x, 0, z); g.rotation.y = rot;
      scene.add(g);
    };

    const upperUnit = (x, z, w, rot, kind = "split") => {
      const g = new THREE.Group();
      const H = TALL_H - UP_Y0;
      g.add(mesh(w - 0.004, H, UP_D - 0.02, kind === "glass" ? mats.black : mats.body, 0, UP_Y0 + H / 2, UP_D / 2 - 0.01, kind === "glass" ? null : "body"));
      if (kind === "glass") {
        g.add(mesh(w - 0.06, H - 0.06, UP_D - 0.06, mats.shelfLight, 0, UP_Y0 + H / 2, UP_D / 2 - 0.02));
        [0.28, 0.55].forEach((sy) => g.add(mesh(w - 0.06, 0.015, UP_D - 0.06, mats.black, 0, UP_Y0 + sy * H, UP_D / 2 - 0.02)));
        g.add(mesh(w - 0.03, H - 0.03, 0.006, mats.glass, 0, UP_Y0 + H / 2, UP_D + 0.003));
        g.add(mesh(w - 0.006, 0.03, 0.02, mats.black, 0, UP_Y0 + H - 0.015, UP_D + 0.01));
      } else if (kind === "hood") {
        g.add(mesh(w - 0.006, H - 0.3, 0.02, mats.upper, 0, UP_Y0 + 0.3 + (H - 0.3) / 2, UP_D + 0.01, "upper"));
        g.add(mesh(w - 0.006, 0.3, UP_D, mats.black, 0, UP_Y0 + 0.15, UP_D / 2));
      } else {
        const topH = 0.32;
        g.add(mesh(w - 0.006, topH - 0.006, 0.02, mats.upper, 0, UP_Y0 + H - topH / 2, UP_D + 0.01, "upper"));
        g.add(mesh(w - 0.006, H - topH - 0.006, 0.02, mats.upper, 0, UP_Y0 + (H - topH) / 2, UP_D + 0.01, "upper"));
      }
      g.position.set(x, 0, z); g.rotation.y = rot;
      scene.add(g);
    };

    const kinds = ["glass", "split", "hood", "split", "glass"];
    for (let i = 0; i < 5; i++) {
      const x = -1.5 + M * (i + 0.5);
      baseUnit(x, 0, M, 0, i === 2);
      upperUnit(x, 0, M, 0, kinds[i]);
    }
    for (let i = 0; i < 2; i++) {
      const z = 0.6 + M * (i + 0.5);
      baseUnit(-2.1, z, M, Math.PI / 2);
      upperUnit(-2.1, z, M, Math.PI / 2, "split");
    }

    // пенал с духовкой в углу
    scene.add(mesh(M, TALL_H, D, mats.body, -1.8, TALL_H / 2, D / 2, "body"));
    scene.add(mesh(M - 0.006, TALL_H - 0.9 - 0.06, 0.02, mats.lower, -1.8, 0.9 + (TALL_H - 0.9) / 2 + 0.03, D + 0.01, "lower"));
    scene.add(mesh(M - 0.006, 0.9 - 0.04, 0.02, mats.lower, -1.8, (0.9 - 0.04) / 2, D + 0.01, "lower"));
    scene.add(mesh(M - 0.02, 0.6, 0.03, mats.black, -1.8, 1.25, D + 0.015));
    scene.add(mesh(M - 0.1, 0.32, 0.005, mats.hob, -1.8, 1.2, D + 0.033));

    // пенал справа
    scene.add(mesh(M, TALL_H + 0.3, D, mats.body, 1.8, (TALL_H + 0.3) / 2, D / 2, "body"));
    scene.add(mesh(M - 0.006, TALL_H * 0.6 - 0.006, 0.02, mats.lower, 1.8, TALL_H * 0.3, D + 0.01, "lower"));
    scene.add(mesh(M - 0.006, TALL_H * 0.4 + 0.3 - 0.006, 0.02, mats.lower, 1.8, TALL_H * 0.8 + 0.15, D + 0.01, "lower"));

    // столешницы
    scene.add(mesh(3.02, 0.03, D + 0.03, mats.top, 0, BASE_H + 0.015, (D + 0.03) / 2));
    scene.add(mesh(D + 0.03, 0.03, 1.2, mats.top, -2.1 + (D + 0.03) / 2, BASE_H + 0.015, 1.2));
    scene.add(mesh(3.0, UP_Y0 - BASE_H - 0.03, 0.01, mats.splash, 0, BASE_H + 0.03 + (UP_Y0 - BASE_H - 0.03) / 2, 0.005, "splash", { ox: 0.3, oy: 0.5 }));
    const sp2 = mesh(1.2, UP_Y0 - BASE_H - 0.03, 0.01, mats.splash, -2.1 + 0.005, BASE_H + 0.03 + (UP_Y0 - BASE_H - 0.03) / 2, 1.2, "splash", { ox: 0.8, oy: 0.5 });
    sp2.rotation.y = Math.PI / 2; scene.add(sp2);

    scene.add(mesh(0.5, 0.01, 0.4, mats.black, -1.2, BASE_H + 0.031, 0.32));
    const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 16), mats.black);
    tap.position.set(-1.2, BASE_H + 0.19, 0.1); scene.add(tap);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 12), mats.black);
    spout.rotation.x = Math.PI / 2; spout.position.set(-1.2, BASE_H + 0.34, 0.2); scene.add(spout);
    scene.add(mesh(0.56, 0.006, 0.48, mats.hob, 0, BASE_H + 0.033, 0.3));
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.14, 24), mats.black);
    pot.position.set(0, BASE_H + 0.11, 0.32); pot.castShadow = true; scene.add(pot);

    const leds = [
      mesh(3.0, 0.01, 0.02, mats.ledMat, 0, UP_Y0 - 0.005, UP_D - 0.03),
      mesh(1.2, 0.01, 0.02, mats.ledMat, -2.1 + UP_D - 0.03, UP_Y0 - 0.005, 1.2),
      mesh(3.0, 0.01, 0.02, mats.ledMat, 0, PLINTH - 0.005, D - 0.07),
      mesh(1.2, 0.01, 0.02, mats.ledMat, -2.1 + D - 0.07, PLINTH - 0.005, 1.2),
    ];
    leds[1].rotation.y = Math.PI / 2; leds[3].rotation.y = Math.PI / 2;
    leds.forEach((l) => { l.castShadow = false; scene.add(l); });
    [-1.0, 0, 1.0].forEach((x) => {
      const l = new THREE.PointLight("#ffd9a0", 3, 1.8, 2);
      l.position.set(x, UP_Y0 - 0.05, 0.3); ledLights.add(l);
      const l2 = new THREE.PointLight("#ffd9a0", 1.5, 1.4, 2);
      l2.position.set(x, PLINTH, 0.7); ledLights.add(l2);
    });
    const l3 = new THREE.PointLight("#ffd9a0", 5, 1.6, 2);
    l3.position.set(-1.8, UP_Y0 - 0.05, 1.2); ledLights.add(l3);

    let drag = false, px = 0, py = 0;
    const orbit = { theta: 0.25, phi: 1.32, r: 5.4, cx: -0.1, cy: 1.15 };
    const setCam = () => {
      camera.position.set(
        orbit.cx + orbit.r * Math.sin(orbit.phi) * Math.sin(orbit.theta),
        orbit.cy + orbit.r * Math.cos(orbit.phi),
        orbit.r * Math.sin(orbit.phi) * Math.cos(orbit.theta)
      );
      camera.lookAt(orbit.cx, orbit.cy, 0.3);
    };
    const down = (e) => { drag = true; px = e.clientX; py = e.clientY; };
    const move = (e) => {
      if (!drag) return;
      orbit.theta = Math.max(-0.9, Math.min(0.9, orbit.theta - (e.clientX - px) * 0.005));
      orbit.phi = Math.max(0.9, Math.min(1.55, orbit.phi + (e.clientY - py) * 0.005));
      px = e.clientX; py = e.clientY; setCam();
    };
    const up = () => (drag = false);
    const wheel = (e) => { e.preventDefault(); orbit.r = Math.min(8, Math.max(1.2, orbit.r + e.deltaY * 0.004)); setCam(); };
    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    dom.addEventListener("wheel", wheel, { passive: false });
    setCam();

    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize);
    let raf;
    const loop = () => { raf = requestAnimationFrame(loop); renderer.render(scene, camera); };
    loop();

    S.current = { mats, ledLights, leds, fronts, orbit, setCam, renderer, scene, camera };
    setParts(fronts.map((f) => ({ group: f.userData.group, w: Math.round(f.userData.w * 1000), h: Math.round(f.userData.h * 1000) })));
    return () => {
      cancelAnimationFrame(raf);
      dom.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      dom.removeEventListener("wheel", wheel);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      el.removeChild(dom);
    };
  }, []);

  // декор + развёртка
  useEffect(() => {
    const { mats, fronts } = S.current;
    if (!mats || !decors.length) return;
    GROUPS.forEach((g) => {
      const d = decors.find((x) => x.code === choice[g.key]);
      const m = mats[g.key];
      if (!d) {
        if (g.key === "splash") { m.map = null; m.normalMap = null; m.roughnessMap = null; m.color.set(WALLS.find((w) => w.id === wall).hex); m.needsUpdate = true; }
        return;
      }
      const t = d.textures;
      m.color.set(0xffffff);
      if (t?.sheet) {
        m.map = loadTex(t.sheet, true, false);
        const sheetW = t.sheetW || 2800, sheetH = t.sheetH || 2070;
        if (t.normal) {
          m.normalMap = loadTex(t.normal, false, true);
          m.normalMap.repeat.set(sheetW / NORMAL_TILE_MM, sheetH / NORMAL_TILE_MM);
          m.normalScale.set(0.6, 0.6);
        } else m.normalMap = null;
        if (t.roughness) {
          m.roughnessMap = loadTex(t.roughness, false, true);
          m.roughnessMap.repeat.set(sheetW / NORMAL_TILE_MM, sheetH / NORMAL_TILE_MM);
        } else m.roughnessMap = null;
        m.roughness = t.roughnessValue ?? 0.6;
        fronts.filter((f) => f.userData.group === g.key).forEach((f) => fitUV(f, sheetW, sheetH, rot[g.key]));
      } else if (d.photo?.detail) {
        m.map = loadTex(d.photo.detail, true, true);
        m.normalMap = null; m.roughnessMap = null; m.roughness = 0.55;
        fronts.filter((f) => f.userData.group === g.key).forEach((f) => fitUV(f, 600, 400, rot[g.key]));
      } else {
        m.map = null; m.normalMap = null; m.roughnessMap = null; m.color.set(FALLBACK_HEX);
      }
      m.needsUpdate = true;
    });
  }, [choice, rot, decors, wall]);

  useEffect(() => {
    const { mats } = S.current;
    if (!mats) return;
    mats.wall.color.set(WALLS.find((w) => w.id === wall).hex);
  }, [wall]);

  useEffect(() => {
    if (!choice.lower) return;
    const p = new URLSearchParams();
    if (choice.upper) p.set("u", choice.upper);
    p.set("l", choice.lower);
    if (choice.body) p.set("b", choice.body);
    if (choice.splash) p.set("s", choice.splash);
    p.set("r", ["upper", "lower", "body", "splash"].map((k) => (rot[k] ? "1" : "0")).join(""));
    p.set("w", wall);
    window.history.replaceState(null, "", "#" + p.toString());
  }, [choice, rot, wall]);

  useEffect(() => {
    const { ledLights, leds } = S.current;
    if (!ledLights) return;
    ledLights.visible = led;
    leds.forEach((l) => (l.visible = led));
  }, [led]);

  const setView = (v) => {
    const { orbit, setCam } = S.current;
    if (!orbit) return;
    Object.assign(orbit, VIEWS[v]);
    setCam();
  };

  const screenshot = () => {
    const { renderer, scene, camera } = S.current;
    if (!renderer) return;
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    renderer.setSize(w * 2, h * 2, false);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL("image/png");
    renderer.setSize(w, h, false);
    const a = document.createElement("a");
    a.href = url; a.download = `kitchen_${choice.lower || "decor"}.png`; a.click();
  };

  const copyLink = () => navigator.clipboard?.writeText(window.location.href);

  const spec = GROUPS.map((g) => {
    const rows = {};
    parts.filter((p) => p.group === g.key).forEach((p) => {
      const k = `${p.w}×${p.h}`;
      rows[k] = rows[k] || { size: k, n: 0, area: 0 };
      rows[k].n += 1; rows[k].area += (p.w * p.h) / 1e6;
    });
    const list = Object.values(rows).sort((a, b) => b.area - a.area);
    const area = list.reduce((s, r) => s + r.area, 0);
    const d = decors.find((x) => x.code === choice[g.key]);
    return { key: g.key, label: g.label, decor: d ? d.name : (g.key === "splash" ? "как стена" : "—"), list, area, price: PRICE_M2[g.key] ? area * PRICE_M2[g.key] : 0 };
  }).filter((g) => g.area > 0);
  const total = spec.reduce((s, g) => s + g.price, 0);

  const exportCsv = () => {
    const rows = [["Группа", "Декор", "Размер, мм", "Кол-во", "Площадь, м²"]];
    spec.forEach((g) => g.list.forEach((r) => rows.push([g.label, g.decor, r.size, r.n, r.area.toFixed(3)])));
    spec.forEach((g) => rows.push([g.label, g.decor, "итого", "", g.area.toFixed(3)]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = "specification.csv"; a.click();
  };

  const filtered = decors.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));
  const nameOf = (code) => decors.find((d) => d.code === code)?.name ?? "—";

  return (
    <div className="w-full h-screen flex flex-col md:flex-row bg-[#d9d5cf] text-[#26241f]" style={{ fontFamily: "Georgia, serif" }}>
      <div ref={mountRef} className="flex-1 min-h-[50vh] cursor-grab active:cursor-grabbing" />
      <aside className="w-full md:w-80 bg-[#f4f1ec] border-l border-[#cfc9c0] overflow-y-auto flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-[#cfc9c0]">
          <div className="text-2xl leading-tight">Кухня</div>
          <div className="text-sm text-[#6d6963] mt-1">{decors.length ? `${decors.length} декоров Эггер` : "загрузка…"}</div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {[["overall", "Общий вид"], ["fronts", "Фасады"], ["closeup", "Крупный план"]].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} className="text-sm px-3 py-1 rounded-full border border-[#bdb6ab] hover:border-[#4a4540]">{l}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <button onClick={screenshot} className="text-sm px-3 py-1 rounded border border-[#bdb6ab] hover:border-[#4a4540]">Скриншот</button>
            <button onClick={copyLink} className="text-sm px-3 py-1 rounded border border-[#bdb6ab] hover:border-[#4a4540]">Копировать ссылку</button>
            <button onClick={() => setSpecOpen((o) => !o)} className={`text-sm px-3 py-1 rounded border ${specOpen ? "bg-[#4a4540] text-white border-[#4a4540]" : "border-[#bdb6ab] hover:border-[#4a4540]"}`}>Спецификация</button>
          </div>
        </div>
        {specOpen && (
          <div className="px-5 py-4 border-b border-[#cfc9c0] text-sm">
            {spec.map((g) => (
              <div key={g.key} className="mb-3">
                <div className="flex justify-between"><span>{g.label}</span><span className="text-[#6d6963]">{g.area.toFixed(2)} м²{g.price ? ` · ${Math.round(g.price).toLocaleString("ru")}` : ""}</span></div>
                <div className="text-xs text-[#6d6963] mb-1">{g.decor}</div>
                {g.list.map((r) => (
                  <div key={r.size} className="flex justify-between text-xs"><span>{r.size} мм × {r.n}</span><span>{r.area.toFixed(2)} м²</span></div>
                ))}
              </div>
            ))}
            {total > 0 && <div className="flex justify-between border-t border-[#e0dbd2] pt-2"><span>Итого</span><span>{Math.round(total).toLocaleString("ru")}</span></div>}
            <button onClick={exportCsv} className="mt-3 w-full py-2 text-sm bg-[#4a4540] text-white rounded hover:bg-[#3a3632]">Скачать CSV</button>
          </div>
        )}
        <div className="px-5 py-4 border-b border-[#cfc9c0]">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {GROUPS.map((g) => (
              <button key={g.key} onClick={() => setActive(g.key)}
                className={`text-sm px-3 py-1 rounded-full border ${active === g.key ? "bg-[#4a4540] text-white border-[#4a4540]" : "border-[#bdb6ab] hover:border-[#4a4540]"}`}>
                {g.label}
              </button>
            ))}
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Найти — дуб, серый, H305…"
            className="w-full mb-3 px-3 py-2 text-sm rounded border border-[#cfc9c0] bg-white outline-none focus:border-[#4a4540]" />
          <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
            {filtered.map((d) => (
              <button key={d.code} title={d.name} onClick={() => setChoice((c) => ({ ...c, [active]: d.code }))}
                className={`aspect-square rounded-md border-2 bg-cover bg-center ${choice[active] === d.code ? "border-[#4a4540] scale-95" : "border-transparent"}`}
                style={{ backgroundImage: d.photo?.card ? `url(${import.meta.env.BASE_URL + d.photo.card.slice(1)})` : "none", backgroundColor: d.photo?.card ? undefined : "#ccc" }} />
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-[#6d6963] pr-2">{nameOf(choice[active])}</div>
            <button onClick={() => setRot((r) => ({ ...r, [active]: !r[active] }))} title="Повернуть рисунок на 90°"
              className={`shrink-0 text-sm px-3 py-1 rounded border ${rot[active] ? "bg-[#4a4540] text-white border-[#4a4540]" : "border-[#bdb6ab] hover:border-[#4a4540]"}`}>
              {rot[active] ? "вертикально" : "горизонтально"}
            </button>
          </div>
        </div>
        <div className="px-5 py-4 border-b border-[#cfc9c0]">
          <div className="text-sm mb-2">Стены</div>
          <div className="flex flex-wrap gap-2">
            {WALLS.map((w) => (
              <button key={w.id} title={w.name} onClick={() => setWall(w.id)}
                className={`w-8 h-8 rounded-full border-2 ${wall === w.id ? "border-[#4a4540] scale-95" : "border-transparent"}`}
                style={{ background: w.hex }} />
            ))}
          </div>
          {choice.splash && (
            <button onClick={() => setChoice((c) => ({ ...c, splash: null }))} className="mt-3 text-sm underline text-[#6d6963]">
              Фартук — как стена
            </button>
          )}
        </div>
        <div className="px-5 py-4 border-b border-[#cfc9c0]">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={led} onChange={(e) => setLed(e.target.checked)} className="accent-[#4a4540]" />
            Подсветка
          </label>
        </div>
        <div className="px-5 py-4 text-sm mt-auto">
          <div className="text-xs text-[#6d6963]">Вращение — перетащить, масштаб — колёсико</div>
        </div>
      </aside>
    </div>
  );
}
