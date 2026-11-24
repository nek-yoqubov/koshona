import * as THREE from "three";
import { ASSETS } from "../engine/assets.js";
import { HK, HK_REF, hkPose } from "./hkTop.js";
import { fourBar } from "./linkage.js";

const T = 0.016;

// Полый корпус верхнего шкафа (чтобы при открытии были видны полка и механизм)
export function carcass(k, g, w, y0, H, d, shelves = 1) {
  const yc = y0 + H / 2;
  g.add(k.box(w - 0.004, H, T, "body", 0, yc, T / 2, "body"));
  for (const sx of [-1, 1]) g.add(k.box(T, H, d, "body", sx * (w / 2 - 0.002 - T / 2), yc, d / 2, "body"));
  for (const y of [y0 + T / 2, y0 + H - T / 2]) g.add(k.box(w - 0.004 - 2 * T, T, d, "body", 0, y, d / 2, "body", k.flat()));
  for (let i = 1; i <= shelves; i++) g.add(k.box(w - 0.004 - 2 * T, T, d - 0.04, "body", 0, y0 + (i * H) / (shelves + 1), (d - 0.04) / 2, "body", k.flat()));
}

// Петля CLIP top BLUMOTION 73B3550 на планке 173L6100 — официальная модель Blum.
// Чашка едет с дверью, плечо с планкой остаются на боковине, между ними звено шарнира.
// Геометрия: X — от внутренней стороны боковины внутрь, Y — вверх, Z — от внутренней плоскости двери.
const PANEL_IN = 0.015; // от кромки двери до внутренней стороны боковины
export function hinge(k, door, parent, { sx, w, y, cx, cy, zIn }) {
  const A = ASSETS.clipTop;
  if (!A) return;
  const px = sx * (w / 2 - PANEL_IN);
  const put = (geo, mat, to, x, yy, z) => {
    const m = new THREE.Mesh(geo, k.mat(mat));
    m.position.set(x, yy, z);
    m.scale.x = -sx;
    to.add(k.hw(m));
    return m;
  };
  put(A.cup, "metal", door, px, y, -0.01);
  const bowl = k.cyl(0.0165, 0.0165, 0.0004, "strut", px - sx * 0.00605, y, -0.0103);
  bowl.rotation.x = Math.PI / 2;
  door.add(k.hw(bowl));
  put(A.arm, "metal", parent, cx + px, cy + y, zIn);
  put(A.plate, "mechCap", parent, cx + px, cy + y, zIn);
  const a = anchor(parent, cx + px - sx * 0.0115, cy + y, zIn + 0.003);
  const b = anchor(door, px - sx * 0.006, y, -0.0108);
  k.hw(k.link(parent, a, b, 0, "metal", [0.0022, 0.0075]));
}

const anchor = (parent, x, y, z) => {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
};

// Пара зеркальных деталей механизма на левой и правой боковине (геометрия: X — от боковины внутрь)
function twin(k, px, geo, mat, to, yy = 0, zz = 0) {
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(geo, k.mat(mat));
    m.position.set(sx * px, yy, zz);
    m.scale.x = -sx;
    to.add(k.hw(m));
  }
}
// Ставит деталь в позу [угол, f, u]; ref — её опорная точка в закрытом положении (мм), (oy, oz) — начало механизма
function placePart(o, [a, f, u], [f0, u0], oy, oz) {
  const c = Math.cos(a), s = Math.sin(a);
  o.rotation.x = -a;
  o.position.y = oy + (u - (f0 * s + u0 * c)) / 1000;
  o.position.z = oz + (f - (f0 * c - u0 * s)) / 1000;
}

// AVENTOS HS top — сетки из библиотеки Blum для Базиса (Antarion), оси рычагов сняты с них же.
// Четырёхзвенник: фасад на каретке уходит вверх и ложится над корпусом под 15° к горизонту.
// Начало: X — внутренняя сторона боковины, Y — внутренняя сторона крышки, Z — внутренняя плоскость фасада.
const HS = fourBar({ A1: [-42.0, -53.2], A2: [-14.35, -46.61], B1: [-112.24, -206.18], B2: [-65.77, -205.92], open: 2.62 });
function hsTop(k, g, { w, y0, H, z, key, dw, dh, yc }) {
  const A = ASSETS.hsTop, oy = y0 + H - T, oz = z - 0.01, px = w / 2 - 0.002 - T;
  const grp = () => { const o = new THREE.Group(); o.position.set(0, oy, oz); g.add(o); return o; };
  const body = grp(), parts = { lever1: grp(), lever2: grp(), carrier: grp() };
  twin(k, px, A.body, "metal", body);
  twin(k, px, A.bodyDark, "metalDark", body);
  twin(k, px, A.cover, "mechCap", body);
  twin(k, px, A.logo, "strut", body);
  twin(k, px, A.lever1, "metal", parts.lever1);
  twin(k, px, A.lever2, "metal", parts.lever2);
  twin(k, px, A.carrier, "metal", parts.carrier);
  twin(k, px, A.tab, "blumOrange", parts.carrier);
  twin(k, px, A.bracket, "metalDark", parts.carrier);
  parts.carrier.add(k.box(dw, dh, 0.02, key, 0, yc - oy, z - oz, key, k.region()));
  k.mover((e) => { for (const n in parts) placePart(parts[n], HS.pose(n, e), HS.ref[n], oy, oz); });
  // наибольшая высота фасада за всё движение
  const [f0, u0] = HS.ref.carrier, ut = (T - 0.003) * 1000;
  let top = 0;
  for (let i = 0; i <= 20; i++) {
    const [a, , u] = HS.pose("carrier", i / 20);
    for (const f of [0, 20]) for (const uu of [ut, ut - dh * 1000]) top = Math.max(top, u + (f - f0) * Math.sin(a) + (uu - u0) * Math.cos(a));
  }
  k.need(oy + top / 1000 + 0.02);
}

// AVENTOS HK top 22K2300 — официальная модель Blum, движение по её же осям (шестизвенник, hkTop.js).
// Фасад жёстко сидит на рычаге: уходит вперёд и вверх, верхняя кромка не поднимается над корпусом.
function hkTop(k, g, { w, y0, H, z, key, dw, dh, yc }) {
  const A = ASSETS.hkTop;
  const oy = y0 + H - T - 0.003 - HK.top / 1000, oz = z - 0.01 - HK.fin / 1000;
  const px = w / 2 - 0.002 - T;
  const grp = () => { const o = new THREE.Group(); o.position.set(0, oy, oz); g.add(o); return o; };
  twin(k, px, A.body, "mechCap", grp());
  const parts = { A: grp(), B: grp(), C: grp(), D: grp(), arm: grp() };
  twin(k, px, A.leverA, "metal", parts.A);
  twin(k, px, A.linkB, "metal", parts.B);
  twin(k, px, A.linkC, "metal", parts.C);
  twin(k, px, A.linkD, "metal", parts.D);
  twin(k, px, A.arm, "metal", parts.arm);
  twin(k, px, A.tab, "blumOrange", parts.arm);
  twin(k, px, ASSETS.frontFix.bracket, "metalDark", parts.arm, -0.072, HK.fin / 1000);
  parts.arm.add(k.box(dw, dh, 0.02, key, 0, yc - oy, z - oz, key, k.region()));

  k.mover((e) => { for (const n in parts) placePart(parts[n], hkPose(n, e), HK_REF[n], oy, oz); });
  // насколько нижняя кромка открытого фасада поднимается над корпусом
  const [a1, , u1] = hkPose("arm", 1);
  const bf = HK.fin + 20 - HK.P1[0], bu = (y0 + 0.003 - oy) * 1000 - HK.P1[1];
  k.need(oy + (u1 + bf * Math.sin(a1) + bu * Math.cos(a1)) / 1000 + 0.02);
}

// Фасад(ы) подъёмника. y0 — низ корпуса, H — высота корпуса, d — глубина корпуса, z — плоскость фасада
export function liftFront(k, g, mech, { w, y0, H, d, z, key }) {
  const dw = w - 0.006, dh = H - 0.006, top = y0 + H - 0.003, yc = y0 + H / 2;
  const xm = w / 2 - 0.002 - T - 0.011; // механизм у внутренней стороны боковины
  const zf = d - 0.002;
  const caps = !mech.hidden;
  const sides = [-1, 1];

  if (mech.id === "hk" && ASSETS.hkTop && ASSETS.frontFix) return hkTop(k, g, { w, y0, H, z, key, dw, dh, yc });
  if (mech.id === "hs" && ASSETS.hsTop) return hsTop(k, g, { w, y0, H, z, key, dw, dh, yc });

  if (mech.motion === "stay" || mech.motion === "gas") {
    const p = new THREE.Group(), inner = new THREE.Group();
    p.position.set(0, top, z);
    inner.position.set(0, -dh / 2, 0);
    p.add(inner);
    g.add(p);
    inner.add(k.box(dw, dh, 0.02, key, 0, 0, 0, key, k.region()));
    const ang = mech.angle, rise = mech.rise || 0;
    k.need(top + rise + Math.max(0, -Math.cos(ang)) * dh + 0.02);
    k.mover((e) => { p.rotation.x = -ang * e; p.position.y = top + rise * e; });
    for (const sx of sides) {
      if (mech.motion === "stay") {
        const big = mech.size === "big";
        const mh = big ? Math.min(0.17, H * 0.5) : Math.min(0.09, H * 0.3), md = big ? 0.2 : 0.07;
        if (caps) g.add(k.box(big ? 0.026 : 0.018, mh, md, big ? "metalDark" : "metal", sx * xm, top - 0.012 - mh / 2, zf - 0.02 - md / 2));
        const a = anchor(g, sx * xm, top - (big ? 0.05 : 0.03), zf - 0.03);
        const b = anchor(inner, sx * xm, dh / 2 - Math.min(big ? 0.16 : 0.22, dh * 0.5), -0.012);
        k.link(g, a, b, big ? 0.009 : 0.006, mech.hidden ? "frame" : big ? "metalDark" : "metal");
      } else {
        for (const hx of [-1, 1]) inner.add(k.cyl(0.0175, 0.0175, 0.012, "metal", hx * (dw / 2 - 0.09), dh / 2 - 0.03, -0.016).rotateX(Math.PI / 2));
        const a = anchor(g, sx * xm, y0 + H * 0.32, d * 0.45);
        const b = anchor(inner, sx * xm, dh / 2 - 0.07, -0.012);
        k.link(g, a, b, 0.007, "strut");
      }
    }
    return;
  }

  if (mech.motion === "parallel" || mech.motion === "over") {
    const p = new THREE.Group();
    p.position.set(0, yc, z);
    g.add(p);
    p.add(k.box(dw, dh, 0.02, key, 0, 0, 0, key, k.region()));
    const par = mech.motion === "parallel";
    k.mover((e) => {
      if (par) { p.position.y = yc + (dh + 0.02) * e; p.position.z = z + 0.035 * e; }
      else {
        // HS: фасад уходит вверх и ложится почти горизонтально над корпусом, выступая вперёд
        const s = Math.sin(Math.PI * e), a = 1.75;
        const yEnd = top + 0.2, zEnd = 0.1 + (dh / 2) * Math.sin(a);
        p.position.y = yc + (yEnd - yc) * e + 0.05 * s;
        p.position.z = z + (zEnd - z) * e + 0.1 * s;
        p.rotation.x = -a * e;
      }
    });
    k.need(top + (par ? dh + 0.02 : 0.2 + (dh / 2) * Math.abs(Math.cos(1.75)) + 0.03));
    const mh = Math.min(0.2, H * 0.55);
    for (const sx of sides) {
      g.add(k.box(0.022, mh, 0.18, "mechCap", sx * xm, top - 0.012 - mh / 2, zf - 0.1));
      for (const [ay, az, by] of [[top - 0.04, zf - 0.04, dh / 2 - 0.06], [top - mh + 0.04, zf - 0.07, dh / 2 - 0.18]]) {
        const a = anchor(g, sx * xm, ay, az);
        const b = anchor(p, sx * xm, Math.max(-dh / 2 + 0.04, by), -0.012);
        k.link(g, a, b, 0.006, "metal");
      }
    }
    return;
  }

  if (mech.motion === "fold") {
    const h1 = dh / 2 - 0.002, h2 = dh / 2 - 0.002;
    const p1 = new THREE.Group(), p2 = new THREE.Group();
    p1.position.set(0, top, z);
    g.add(p1);
    p1.add(k.box(dw, h1, 0.02, key, 0, -h1 / 2, 0, key, k.region()));
    p2.position.set(0, -h1 - 0.004, 0);
    p1.add(p2);
    p2.add(k.box(dw, h2, 0.02, key, 0, -h2 / 2, 0, key, k.region()));
    for (const hx of [-1, 1]) {
      p1.add(k.cyl(0.0175, 0.0175, 0.012, "metal", hx * (dw / 2 - 0.09), -h1 + 0.04, -0.016).rotateX(Math.PI / 2));
      p2.add(k.cyl(0.0175, 0.0175, 0.012, "metal", hx * (dw / 2 - 0.09), -0.04, -0.016).rotateX(Math.PI / 2));
    }
    k.need(top + 0.1);
    k.mover((e) => { const t = 1.48 * e; p1.rotation.x = -t; p2.rotation.x = 2 * t; });
    const mh = Math.min(0.24, H * 0.3);
    for (const sx of sides) {
      g.add(k.box(0.022, mh, 0.2, "mechCap", sx * xm, top - 0.02 - mh / 2, zf - 0.11));
      const a = anchor(g, sx * xm, top - 0.05, zf - 0.05);
      const b = anchor(p1, sx * xm, -h1 * 0.7, -0.012);
      k.link(g, a, b, 0.007, "metal");
    }
  }
}

// Ящик: металлические борта (сами борта — механизм), скрытые направляющие (борта ЛДСП, механизм под дном),
// шариковые (борта ЛДСП, направляющая на боку). s — выдвигаемая группа
export function drawerBox(k, s, sys, { w, y, fh, D }) {
  const bw = w - 0.06, bh = Math.max(0.06, fh - 0.06), bd = D - 0.08, zc = D - bd / 2, yb = y + 0.02;
  const ldsp = sys.type !== "box";
  for (const sx of [-1, 1]) {
    const x = sx * (bw / 2);
    if (!ldsp) {
      s.add(k.box(0.014, bh, bd, "metalDark", x, yb + bh / 2, zc));
      s.add(k.box(0.016, 0.004, bd, "metal", x, yb + bh, zc));
    } else {
      s.add(k.box(0.016, bh, bd, "body", x - sx * 0.008, yb + bh / 2, zc, "body"));
      if (sys.type === "ball") s.add(k.box(0.012, 0.035, bd, "metal", x + sx * 0.006, yb + bh / 2, zc));
      else s.add(k.box(0.02, 0.012, bd, "metalDark", x - sx * 0.02, yb - 0.012, zc));
    }
  }
  const iw = ldsp ? bw - 0.032 : bw;
  s.add(k.box(iw, 0.012, bd, "body", 0, yb, zc, "body", k.flat()));
  s.add(k.box(iw, bh, 0.016, ldsp ? "body" : "metalDark", 0, yb + bh / 2, D - bd + 0.008, ldsp ? "body" : null));
  return (sys.full ? 0.92 : 0.68) * bd;
}
