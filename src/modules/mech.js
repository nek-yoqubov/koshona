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
// Чашка едет с дверью, плечо с планкой остаются на корпусе, между ними звено шарнира.
// Геометрия: X — от внутренней стороны опорной панели внутрь, Y — вдоль оси петли, Z — от внутренней плоскости двери.
// dp, bp — одна и та же точка (опорная панель × плоскость двери) в координатах двери и корпуса;
// rz поворачивает петлю (для фасада на верхней панели), mx зеркалит её для правой стороны.
export const PANEL_IN = 0.015; // от кромки двери до внутренней стороны боковины
export function hinge(k, door, parent, { dp, bp, rz = 0, mx = 1 }) {
  const A = ASSETS.clipTop;
  if (!A) return;
  const holder = (to, p) => {
    const o = new THREE.Group();
    o.position.set(...p);
    o.rotation.z = rz;
    o.scale.x = mx;
    to.add(o);
    return o;
  };
  const hd = holder(door, dp), hb = holder(parent, bp);
  const put = (geo, mat, to) => to.add(k.hw(new THREE.Mesh(geo, k.mat(mat))));
  put(A.cup, "metal", hd);
  const bowl = k.cyl(0.0165, 0.0165, 0.0004, "strut", 0.00605, 0, -0.0003);
  bowl.rotation.x = Math.PI / 2;
  hd.add(k.hw(bowl));
  put(A.arm, "metal", hb);
  put(A.plate, "mechCap", hb);
  const axis = rz ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  k.hw(k.link(parent, anchor(hb, 0.0115, 0, 0.003), anchor(hd, 0.006, 0, -0.0008), 0, "metal", [0.0022, 0.0075, axis]));
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

// Подъёмник-четырёхзвенник: корпус на боковине, два рычага на его осях, каретка с креплением фасада.
// Сетки и оси — из библиотеки Blum для Базиса (Antarion).
// Начало: X — внутренняя сторона боковины, Y — внутренняя сторона крышки, Z — внутренняя плоскость фасада.
function barLift(k, g, A, bar, { w, y0, H, z, key, dw, dh, yc }) {
  const oy = y0 + H - T, oz = z - 0.01, px = w / 2 - 0.002 - T;
  const grp = () => { const o = new THREE.Group(); o.position.set(0, oy, oz); g.add(o); return o; };
  const body = grp(), parts = { lever1: grp(), lever2: grp(), carrier: grp() };
  const add = (name, mat, to) => A[name] && twin(k, px, A[name], mat, to);
  add("body", "metal", body);
  add("bodyDark", "metalDark", body);
  add("cover", "mechCap", body);
  add("logo", "strut", body);
  add("lever1", "metal", parts.lever1);
  add("lever2", "metal", parts.lever2);
  add("carrier", "metal", parts.carrier);
  add("tab", "blumOrange", parts.carrier);
  add("bracket", "metalDark", parts.carrier);
  parts.carrier.add(k.box(dw, dh, 0.02, key, 0, yc - oy, z - oz, key, k.region()));
  k.mover((e) => { for (const n in parts) placePart(parts[n], bar.pose(n, e), bar.ref[n], oy, oz); });
  // наибольшая высота фасада за всё движение
  const [f0, u0] = bar.ref.carrier, ut = (T - 0.003) * 1000;
  let top = 0;
  for (let i = 0; i <= 20; i++) {
    const [a, , u] = bar.pose("carrier", i / 20);
    for (const f of [0, 20]) for (const uu of [ut, ut - dh * 1000]) top = Math.max(top, u + (f - f0) * Math.sin(a) + (uu - u0) * Math.cos(a));
  }
  k.need(oy + top / 1000 + 0.02);
}

// AVENTOS HS top: фасад уходит вверх и ложится над корпусом под 15° к горизонту
const HS = fourBar({ A1: [-42.0, -53.2], A2: [-14.35, -46.61], B1: [-112.24, -206.18], B2: [-65.77, -205.92], open: 2.62 });

// AVENTOS HL top (рычаги 35): почти параллелограмм — фасад поднимается на свою высоту, оставаясь вертикальным
const HL = { A1: [-42.0, -79.5], A2: [-28.0, -44.5], B1: [-39.21, -280.62], B2: [-28.39, -244.4] };
const hlBars = new Map();
function hlTop(k, g, d) {
  const rise = Math.round(d.dh * 1000), L = Math.hypot(HL.B1[0] - HL.A1[0], HL.B1[1] - HL.A1[1]);
  if (!hlBars.has(rise)) hlBars.set(rise, fourBar({ ...HL, open: Math.acos(Math.max(-0.985, 1 - rise / L)) }));
  barLift(k, g, { ...ASSETS.hlTop, cover: ASSETS.hsTop?.cover, logo: ASSETS.hsTop?.logo }, hlBars.get(rise), d);
  // поперечный стабилизатор между механизмами
  const rod = k.cyl(0.008, 0.008, d.w - 0.004 - 2 * T - 0.05, "metalDark", 0, d.y0 + d.H - T - 0.022, d.z - 0.01 - 0.055);
  rod.rotation.z = Math.PI / 2;
  g.add(k.hw(rod));
}

// Откидной фасад на петлях под крышкой с упором на боковине: AVENTOS HK-XS и газлифты GTV.
// Фасад поворачивается на петлях, упор (труба и шток) растягивается между боковиной и фасадом.
function flap(k, g, mech, { w, y0, H, z, key, dw, dh }) {
  const oy = y0 + H - T, zIn = z - 0.01, ftop = y0 + H - 0.003, px = w / 2 - 0.002 - T - 0.012;
  const up = new THREE.Group();
  up.position.set(0, ftop - 0.004, zIn + 0.01);
  g.add(up);
  up.add(k.box(dw, dh, 0.02, key, 0, -dh / 2 + 0.004, 0, key, k.region()));
  const n = w > 0.9 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const hx = (w / 2 - 0.1) * ((2 * i) / (n - 1) - 1);
    hinge(k, up, g, { dp: [hx, -0.009, -0.01], bp: [hx, oy, zIn], rz: -Math.PI / 2 });
  }
  const sy = Math.min(0.16, H * 0.5), pd = Math.min(0.07, dh * 0.3), dark = mech.brand === "GTV";
  for (const sx of [-1, 1]) {
    const S = anchor(g, sx * px, oy - sy, zIn - 0.19), P = anchor(up, sx * px, 0.004 - pd, -0.022);
    g.add(k.hw(k.box(0.012, 0.03, 0.03, "metalDark", sx * (px + 0.006), oy - sy, zIn - 0.19)));
    up.add(k.hw(k.box(0.018, 0.045, 0.012, "metalDark", sx * px, 0.004 - pd, -0.016)));
    k.hw(k.link(g, S, P, 0.0035, "metal"));
    k.hw(k.link(g, S, P, 0.008, dark ? "strut" : "mechCap", null, 0.185));
  }
  const ang = mech.angle;
  k.mover((e) => { up.rotation.x = -ang * e; });
  k.need(ftop + Math.max(0, -Math.cos(ang)) * dh + 0.03);
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

// AVENTOS HF top — складной фасад. Детали из библиотеки Blum для Базиса (Antarion).
// Верхний фасад висит на петлях под крышкой и открывается на 116° (по каталогу Blum: вылет 0,9 и подъём 0,44 его высоты),
// нижний складывается под него. Телескопический рычаг: штанга механизма ходит в трубе, труба шарнирно сидит на нижнем фасаде.
const HF = { open: (116 * Math.PI) / 180, fold: (-35 * Math.PI) / 180 };
function hfTop(k, g, { w, y0, H, z, key, dw, dh }) {
  const A = ASSETS.hfTop, oy = y0 + H - T, zIn = z - 0.01, px = w / 2 - 0.002 - T, KH = H * 1000;
  const ftop = y0 + H - 0.003, h1 = dh / 2 - 0.002;
  // ось механизма: чем выше корпус, тем ниже стоит механизм (0,3 высоты корпуса, как в схеме Blum)
  const M = [zIn - 0.01107, oy - (0.3 * KH - (KH < 550 ? 28 : 57) + 36) / 1000];
  const at = (f, u) => { const o = new THREE.Group(); o.position.set(0, u, f); g.add(o); return o; };
  const body = at(...M), lever = at(...M), tube = at(0, 0);
  twin(k, px, A.body, "metalDark", body);
  twin(k, px, A.cover, "mechCap", body);
  twin(k, px, A.logo, "strut", body);
  twin(k, px, A.lever, "metal", lever);
  twin(k, px, A.tube, "metal", tube);

  // фасады: ось верхнего — 4 мм ниже кромки и 10 мм перед внутренней плоскостью, средняя ось — за внутренней плоскостью
  const Tp = [zIn + 0.01, ftop - 0.004], Crel = [-0.013, -h1 + 0.002], Frel = [-0.00318, -0.16841];
  const up = at(...Tp), low = new THREE.Group();
  low.position.set(0, Crel[1], Crel[0]);
  up.add(low);
  up.add(k.box(dw, h1, 0.02, key, 0, -h1 / 2 + 0.004, 0, key, k.region()));
  low.add(k.box(dw, h1, 0.02, key, 0, -0.002 - h1 / 2, 0.013, key, k.region()));
  twin(k, px, A.head, "metalDark", low, Frel[1], Frel[0]);
  const n = w > 0.9 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const hx = (w / 2 - 0.1) * (n === 1 ? 0 : (2 * i) / (n - 1) - 1);
    hinge(k, up, g, { dp: [hx, -0.009, -0.01], bp: [hx, oy, zIn], rz: -Math.PI / 2 });
  }

  const r2 = ([f, u], a) => [f * Math.cos(a) - u * Math.sin(a), f * Math.sin(a) + u * Math.cos(a)];
  k.mover((e) => {
    const al = HF.open * e, be = HF.fold * e * e;
    up.rotation.x = -al;
    low.rotation.x = al - be;
    const c = r2(Crel, al), f = r2(Frel, be), F = [Tp[0] + c[0] + f[0], Tp[1] + c[1] + f[1]];
    const a = Math.atan2(F[0] - M[0], -(F[1] - M[1]));
    lever.rotation.x = -a;
    tube.rotation.x = -a;
    tube.position.set(0, F[1], F[0]);
  });
  k.need(Tp[1] + Math.hypot(h1, 0.012) * Math.sin(HF.open - Math.PI / 2) + 0.03);
}

// Фасад(ы) подъёмника. y0 — низ корпуса, H — высота корпуса, d — глубина корпуса, z — плоскость фасада
export function liftFront(k, g, mech, { w, y0, H, d, z, key }) {
  const dw = w - 0.006, dh = H - 0.006, top = y0 + H - 0.003, yc = y0 + H / 2;
  const xm = w / 2 - 0.002 - T - 0.011; // механизм у внутренней стороны боковины
  const zf = d - 0.002;
  const caps = !mech.hidden;
  const sides = [-1, 1];

  if (mech.id === "hk" && ASSETS.hkTop && ASSETS.frontFix) return hkTop(k, g, { w, y0, H, z, key, dw, dh, yc });
  if (mech.id === "hs" && ASSETS.hsTop) return barLift(k, g, ASSETS.hsTop, HS, { w, y0, H, z, key, dw, dh, yc });
  if (mech.id === "hl" && ASSETS.hlTop) return hlTop(k, g, { w, y0, H, z, key, dw, dh, yc });
  if (mech.id === "hkxs" || mech.motion === "gas") return flap(k, g, mech, { w, y0, H, z, key, dw, dh });
  if (mech.id === "hf" && ASSETS.hfTop) return hfTop(k, g, { w, y0, H, z, key, dw, dh });

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
