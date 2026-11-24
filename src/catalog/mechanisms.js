// Справочник механизмов. Модель кухни ссылается на механизм только по id —
// движок сам знает, как фасад двигается. Состав и артикулы позже привяжутся к тем же id.
// h — допустимая высота корпуса, мм (по данным производителя); null — не ограничено (подбор по весу фасада).

export const LIFTS = [
  { id: "hk", assets: ["hkTop", "frontFix"], code: "k", brand: "Blum", name: "AVENTOS HK top", motion: "stay", angle: 1.87, rise: 0.05, size: "big", h: [180, 600] },
  { id: "hks", assets: ["hksTop"], code: "s", brand: "Blum", name: "AVENTOS HK-S", motion: "stay", angle: 1.8, rise: 0.03, size: "small", h: [180, 600] },
  { id: "hkxs", code: "x", brand: "Blum", name: "AVENTOS HK-XS", motion: "stay", angle: 1.75, rise: 0.02, size: "small", h: [240, 600] },
  { id: "hl", assets: ["hlTop", "hsTop"], code: "p", brand: "Blum", name: "AVENTOS HL", motion: "parallel", h: [300, 580] },
  { id: "hs", assets: ["hsTop"], code: "o", brand: "Blum", name: "AVENTOS HS", motion: "over", h: [350, 800] },
  { id: "hf", assets: ["hfTop"], code: "f", brand: "Blum", name: "AVENTOS HF", motion: "fold", h: [480, 1040] },
  { id: "gtv-gas", code: "g", brand: "GTV", name: "Газлифт GTV", motion: "gas", angle: 1.57, h: null },
];

// Открывание — то, что видно глазами. Модель — конкретный механизм этого типа.
export const LIFT_TYPES = [
  { id: "stay", name: "Откидной" },
  { id: "parallel", name: "Вверх параллельно" },
  { id: "over", name: "Вверх над корпусом" },
  { id: "fold", name: "Складной" },
];
export const typeOf = (m) => (m.motion === "gas" ? "stay" : m.motion);

// Ящики визуально бывают трёх видов
export const DRAWER_TYPES = [
  { id: "box", code: "b", name: "Металлические борта" },
  { id: "hidden", code: "h", name: "Скрытые направляющие" },
  { id: "ball", code: "s", name: "Шариковые направляющие" },
];
export const DRAWERS = [
  { id: "legrabox", code: "a", brand: "Blum", name: "LEGRABOX", full: true },
  { id: "merivobox", code: "m", brand: "Blum", name: "MERIVOBOX", full: true },
  { id: "tandembox", code: "t", brand: "Blum", name: "TANDEMBOX", full: true },
  { id: "metabox", code: "b", brand: "Blum", name: "METABOX", full: false },
];

export const HINGE = { id: "clip-top", name: "Петля CLIP top" };

// Высоты верхних шкафов: 720 — стандарт, 950 — до линии пеналов, 590 + антресоль 360
export const UPPER_HEIGHTS = [
  { id: 720, name: "720" },
  { id: 950, name: "950" },
  { id: "a", name: "590 + антресоль 360" },
];
export const TIER_LOW = 590, TIER_TOP = 360;

export const liftsFor = (hmm, under = false) => LIFTS.filter((m) => (!m.h || (hmm >= m.h[0] && hmm <= m.h[1])) && !(under && m.motion === "over"));
export const liftOf = (id, hmm, under = false) => {
  const ok = liftsFor(hmm, under);
  return ok.find((m) => m.id === id) || ok[0];
};
export const drawerOf = (dt, id) => {
  const type = DRAWER_TYPES.find((t) => t.id === dt) || DRAWER_TYPES[0];
  const model = type.id === "box" ? DRAWERS.find((d) => d.id === id) || DRAWERS[0] : null;
  return { type: type.id, model, full: model ? model.full : true };
};

export const byCode = (list, c) => list.find((m) => m.code === c);

// какие 3D-модели фурнитуры нужны этой кухне (грузим только их)
export function assetsFor(model) {
  const need = new Set(["clipTop"]);
  const add = (m) => m?.assets?.forEach((a) => need.add(a));
  for (const it of [...(model.main || []), ...(model.side || [])]) {
    if (it.kind !== "section" || !["doors", "glass", "lift"].includes(it.upper)) continue;
    if (it.uh === "a") {
      add(liftOf(it.um2, TIER_TOP));
      if (it.upper === "lift") add(liftOf(it.um, TIER_LOW, true));
    } else if (it.upper === "lift") add(liftOf(it.um, it.uh === 720 ? 720 : 950));
  }
  return [...need];
}
