import * as THREE from "three";

const T = 0.016;

// Полый корпус верхнего шкафа (чтобы при открытии были видны полка и механизм)
export function carcass(k, g, w, y0, H, d, shelves = 1) {
  const yc = y0 + H / 2;
  g.add(k.box(w - 0.004, H, T, "body", 0, yc, T / 2, "body"));
  for (const sx of [-1, 1]) g.add(k.box(T, H, d, "body", sx * (w / 2 - 0.002 - T / 2), yc, d / 2, "body"));
  for (const y of [y0 + T / 2, y0 + H - T / 2]) g.add(k.box(w - 0.004 - 2 * T, T, d, "body", 0, y, d / 2, "body"));
  for (let i = 1; i <= shelves; i++) g.add(k.box(w - 0.004 - 2 * T, T, d - 0.04, "body", 0, y0 + (i * H) / (shelves + 1), (d - 0.04) / 2, "body"));
}

const anchor = (parent, x, y, z) => {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
};

// Фасад(ы) подъёмника. y0 — низ корпуса, H — высота корпуса, d — глубина корпуса, z — плоскость фасада
export function liftFront(k, g, mech, { w, y0, H, d, z, key }) {
  const dw = w - 0.006, dh = H - 0.006, top = y0 + H - 0.003, yc = y0 + H / 2;
  const xm = w / 2 - 0.002 - T - 0.011; // механизм у внутренней стороны боковины
  const zf = d - 0.002;
  const caps = !mech.hidden;
  const sides = [-1, 1];

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
        const mh = Math.min(0.15, H * 0.45);
        if (caps) g.add(k.box(0.022, mh, 0.13, "mechCap", sx * xm, top - 0.012 - mh / 2, zf - 0.075));
        const a = anchor(g, sx * xm, top - 0.03, zf - 0.03);
        const b = anchor(inner, sx * xm, dh / 2 - Math.min(0.13, dh * 0.4), -0.012);
        k.link(g, a, b, 0.006, mech.hidden ? "frame" : "metal");
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
        // HS: фасад уходит вверх и наклоняется над корпусом; сверху нужно ≈0.88 высоты корпуса (каталог Blum)
        const s = Math.sin(Math.PI * e), a = 0.45;
        const yEnd = top + 0.88 * H - (dh / 2) * Math.cos(a), zEnd = z + 0.03 - (dh / 2) * Math.sin(a);
        p.position.y = yc + (yEnd - yc) * e;
        p.position.z = z + (zEnd - z) * e + 0.12 * s;
        p.rotation.x = -a * e - 0.25 * s;
      }
    });
    k.need(top + (par ? dh + 0.02 : 0.88 * H));
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
      const b = anchor(p2, sx * xm, -0.12, -0.012);
      k.link(g, a, b, 0.007, "metal");
    }
  }
}

// Ящик выбранной системы. s — выдвигаемая группа
export function drawerBox(k, s, sys, { w, y, fh, D }) {
  const bw = w - 0.06, bh = Math.max(0.06, fh - 0.06), bd = D - 0.08, zc = D - bd / 2, yb = y + 0.02;
  const sideMat = sys.side === "legra" ? "metalDark" : sys.side === "tandem" ? "metal" : "metalWhite";
  for (const sx of [-1, 1]) {
    const x = sx * (bw / 2);
    if (sys.side === "meta") {
      const mh = Math.max(0.05, bh * 0.6);
      s.add(k.box(0.008, mh, bd, sideMat, x, yb + mh / 2, zc));
      s.add(k.box(0.024, 0.005, bd, sideMat, x - sx * 0.008, yb + mh, zc));
    } else if (sys.side === "tandem") {
      s.add(k.box(0.016, bh - 0.008, bd, sideMat, x, yb + (bh - 0.008) / 2, zc));
      s.add(k.cyl(0.008, 0.008, bd, sideMat, x, yb + bh - 0.008, zc).rotateX(Math.PI / 2));
    } else {
      s.add(k.box(sys.side === "legra" ? 0.0128 : 0.013, bh, bd, sideMat, x, yb + bh / 2, zc));
      if (sys.side === "merivo") s.add(k.box(0.015, 0.006, bd, "metalDark", x, yb + bh - 0.003, zc));
    }
  }
  s.add(k.box(bw, 0.012, bd, "body", 0, yb, zc, "body"));
  const backH = sys.side === "meta" ? Math.max(0.05, bh * 0.6) : bh;
  s.add(k.box(bw, backH, 0.012, sys.side === "meta" ? "body" : sideMat, 0, yb + backH / 2, D - bd + 0.006, sys.side === "meta" ? "body" : null));
  return (sys.full ? 0.92 : 0.68) * bd;
}
