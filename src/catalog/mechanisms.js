// Справочник механизмов. Модель кухни ссылается на механизм только по id —
// движок сам знает, как фасад двигается. Состав и артикулы позже привяжутся к тем же id.
// h — допустимая высота корпуса, мм (по данным производителя); null — не ограничено (подбор по весу фасада).

export const LIFTS = [
  { id: "hk", code: "k", brand: "Blum", name: "AVENTOS HK top", motion: "stay", angle: 1.75, rise: 0.05, h: [180, 600] },
  { id: "hks", code: "s", brand: "Blum", name: "AVENTOS HK-S", motion: "stay", angle: 1.75, rise: 0.04, h: [180, 600] },
  { id: "hkxs", code: "x", brand: "Blum", name: "AVENTOS HK-XS", motion: "stay", angle: 1.5, rise: 0.03, h: [240, 600] },
  { id: "hki", code: "i", brand: "Blum", name: "AVENTOS HKi", motion: "stay", angle: 1.75, rise: 0.05, h: [180, 600], hidden: true },
  { id: "hl", code: "p", brand: "Blum", name: "AVENTOS HL", motion: "parallel", h: [300, 580] },
  { id: "hs", code: "o", brand: "Blum", name: "AVENTOS HS", motion: "over", h: [350, 800] },
  { id: "hf", code: "f", brand: "Blum", name: "AVENTOS HF", motion: "fold", h: [480, 1040] },
  { id: "gtv-gas", code: "g", brand: "GTV", name: "GTV газлифт", motion: "gas", angle: 1.57, h: null },
  { id: "gtv-neo", code: "n", brand: "GTV", name: "GTV NEO", motion: "gas", angle: 1.57, h: null },
  { id: "gtv-mini", code: "m", brand: "GTV", name: "GTV Minilift", motion: "gas", angle: 1.4, h: null },
];

export const DRAWERS = [
  { id: "legrabox", code: "a", brand: "Blum", name: "LEGRABOX", side: "legra", full: true },
  { id: "merivobox", code: "m", brand: "Blum", name: "MERIVOBOX", side: "merivo", full: true },
  { id: "tandembox", code: "t", brand: "Blum", name: "TANDEMBOX", side: "tandem", full: true },
  { id: "metabox", code: "b", brand: "Blum", name: "METABOX", side: "meta", full: false },
];

export const HINGE = { id: "clip-top", name: "Петля CLIP top" };

// Высоты верхних шкафов: 720 — стандарт, 950 — до линии пеналов, 590 + антресоль 360
export const UPPER_HEIGHTS = [
  { id: 720, name: "720" },
  { id: 950, name: "950" },
  { id: "a", name: "590 + антресоль 360" },
];
export const TIER_LOW = 590, TIER_TOP = 360;

export const liftsFor = (hmm) => LIFTS.filter((m) => !m.h || (hmm >= m.h[0] && hmm <= m.h[1]));
export const liftOf = (id, hmm) => {
  const ok = liftsFor(hmm);
  return ok.find((m) => m.id === id) || ok[0];
};
export const drawerOf = (id) => DRAWERS.find((d) => d.id === id) || DRAWERS[0];

export const byCode = (list, c) => list.find((m) => m.code === c);
