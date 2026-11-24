import { sub, len, ang, rot, circles, wrap, poser } from "./linkage.js";

// Кинематика AVENTOS HK top (22K2300): шестизвенник, оси сняты с официальной модели Blum.
// Плоскость механизма: f — к фасаду, u — вверх, мм; начало — начало координат модели.
const G1 = [-16.0, 2.0], G2 = [25.0, 8.2];
const Q1 = [-40.85, -57.4], Q2 = [-45.85, -92.1];
const R0 = [-4.9, -42.4], P1 = [26.5, -1.2], P2 = [20.1, -31.1];
export const HK = {
  // Привязка модели к шкафу — по чертежу Blum (каталог, AVENTOS HK top, крепление шурупами):
  // шурупы 28/39/130/141 мм от переднего торца боковины и 33/42 мм под крышкой.
  edge: 37.05,    // передний торец боковины, мм от начала модели
  top: 36.45,     // внутренняя сторона крышки шкафа (корпус механизма стоит вплотную под ней)
  open: 1.5382,   // поворот главного рычага при открывании на 107°
  angle: (107 * Math.PI) / 180,
  P1,
};

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

export const hkPose = poser(TABLE);
