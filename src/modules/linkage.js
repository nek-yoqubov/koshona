// Плоские рычажные механизмы. Плоскость: f — к фасаду, u — вверх, мм.
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const len = (a) => Math.hypot(a[0], a[1]);
export const ang = (a) => Math.atan2(a[1], a[0]);
export const rot = (p, c, a) => {
  const s = Math.sin(a), k = Math.cos(a), d = sub(p, c);
  return [c[0] + d[0] * k - d[1] * s, c[1] + d[0] * s + d[1] * k];
};
// точка пересечения двух окружностей, ближайшая к prev
export function circles(c1, r1, c2, r2, prev) {
  const d = sub(c2, c1), L = len(d), a = (r1 * r1 - r2 * r2 + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const m = [c1[0] + (a * d[0]) / L, c1[1] + (a * d[1]) / L], n = [-d[1] / L, d[0] / L];
  const x = [m[0] + h * n[0], m[1] + h * n[1]], y = [m[0] - h * n[0], m[1] - h * n[1]];
  return len(sub(x, prev)) < len(sub(y, prev)) ? x : y;
}
export const wrap = (a, ref) => { while (a - ref > Math.PI) a -= 2 * Math.PI; while (a - ref < -Math.PI) a += 2 * Math.PI; return a; };

// таблица поз -> поза детали [угол, f, u] при e = 0..1
export function poser(table) {
  const N = table.length - 1;
  return (part, e) => {
    const t = Math.min(1, Math.max(0, e)) * N, i = Math.min(N - 1, Math.floor(t)), k = t - i;
    const a = table[i][part], b = table[i + 1][part];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  };
}

// Четырёхзвенник: рычаги на осях корпуса A1, A2, каретка на пальцах B1, B2; open — поворот первого рычага
export function fourBar({ A1, A2, B1, B2, open }, N = 96) {
  const table = [], L2 = len(sub(B2, A2)), Lc = len(sub(B2, B1));
  let b2 = B2, pa = 0, p2 = 0;
  for (let i = 0; i <= N; i++) {
    const th = (open * i) / N, b1 = rot(B1, A1, th);
    b2 = circles(A2, L2, b1, Lc, b2);
    pa = wrap(ang(sub(b2, b1)) - ang(sub(B2, B1)), pa);
    p2 = wrap(ang(sub(b2, A2)) - ang(sub(B2, A2)), p2);
    table.push({ lever1: [th, ...A1], lever2: [p2, ...A2], carrier: [pa, ...b1] });
  }
  return { pose: poser(table), ref: { lever1: A1, lever2: A2, carrier: B1 } };
}
