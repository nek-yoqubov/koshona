// Кинематика AVENTOS HK top (22K2300): шестизвенник, оси сняты с официальной модели Blum.
// Плоскость механизма: f — к фасаду, u — вверх, мм; начало — начало координат модели.
const G1 = [-16.0, 2.0], G2 = [25.0, 8.2];
const Q1 = [-40.85, -57.4], Q2 = [-45.85, -92.1];
const R0 = [-4.9, -42.4], P1 = [26.5, -1.2], P2 = [20.1, -31.1];
export const HK = {
  fin: 38,        // внутренняя плоскость фасада, мм от начала модели
  top: 40.8,      // верх корпуса механизма
  open: 1.5382,   // поворот главного рычага при открывании на 107°
  angle: (107 * Math.PI) / 180,
  P1,
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (a) => Math.hypot(a[0], a[1]);
const ang = (a) => Math.atan2(a[1], a[0]);
const rot = (p, c, a) => {
  const s = Math.sin(a), k = Math.cos(a), d = sub(p, c);
  return [c[0] + d[0] * k - d[1] * s, c[1] + d[0] * s + d[1] * k];
};
function circles(c1, r1, c2, r2, prev) {
  const d = sub(c2, c1), L = len(d), a = (r1 * r1 - r2 * r2 + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const m = [c1[0] + (a * d[0]) / L, c1[1] + (a * d[1]) / L], n = [-d[1] / L, d[0] / L];
  const x = [m[0] + h * n[0], m[1] + h * n[1]], y = [m[0] - h * n[0], m[1] - h * n[1]];
  return len(sub(x, prev)) < len(sub(y, prev)) ? x : y;
}
const wrap = (a, ref) => { while (a - ref > Math.PI) a -= 2 * Math.PI; while (a - ref < -Math.PI) a += 2 * Math.PI; return a; };

// Таблица поз: каждая деталь = [угол, f, u] — поворот и положение своей опорной точки
const N = 96;
const TABLE = [];
{
  let r = R0, p2 = P2, pa = { B: 0, C: 0, D: 0, arm: 0 };
  for (let i = 0; i <= N; i++) {
    const th = (HK.open * i) / N;
    const q1 = rot(Q1, G1, th), q2 = rot(Q2, G1, th);
    r = circles(G2, len(sub(R0, G2)), q1, len(sub(R0, Q1)), r);
    const aC = wrap(ang(sub(r, q1)) - ang(sub(R0, Q1)), pa.C);
    const p1 = rot([Q1[0] + (P1[0] - Q1[0]), Q1[1] + (P1[1] - Q1[1])], Q1, aC).map((v, j) => v + q1[j] - Q1[j]);
    p2 = circles(p1, len(sub(P2, P1)), q2, len(sub(P2, Q2)), p2);
    pa = {
      B: wrap(ang(sub(r, G2)) - ang(sub(R0, G2)), pa.B), C: aC,
      D: wrap(ang(sub(p2, q2)) - ang(sub(P2, Q2)), pa.D), arm: wrap(ang(sub(p2, p1)) - ang(sub(P2, P1)), pa.arm),
    };
    TABLE.push({ A: [th, ...G1], B: [pa.B, ...G2], C: [pa.C, ...q1], D: [pa.D, ...q2], arm: [pa.arm, ...p1] });
  }
}
export const HK_REF = { A: G1, B: G2, C: Q1, D: Q2, arm: P1 };

// e: 0..1 -> поза детали [угол, f, u]
export function hkPose(part, e) {
  const t = Math.min(1, Math.max(0, e)) * N, i = Math.min(N - 1, Math.floor(t)), k = t - i;
  const a = TABLE[i][part], b = TABLE[i + 1][part];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}
