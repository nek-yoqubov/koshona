export const WIDTHS = [300, 400, 450, 500, 600, 800];

export const BASE_TYPES = [
  { id: "doors", name: "Дверцы" },
  { id: "drawers", name: "Ящики" },
  { id: "sink", name: "Мойка" },
  { id: "hob", name: "Варочная" },
];

export const UPPER_TYPES = [
  { id: "doors", name: "Дверцы" },
  { id: "glass", name: "Витрина" },
  { id: "lift", name: "Подъёмник" },
  { id: "hood", name: "Вытяжка" },
  { id: "none", name: "Нет" },
];

export const TALL_TYPES = [
  { id: "oven", name: "Духовка" },
  { id: "fridge", name: "Холодильник" },
  { id: "pantry", name: "Шкаф" },
];

export const SHAPES = [
  { id: "straight", name: "Прямая" },
  { id: "left", name: "Угол слева" },
  { id: "right", name: "Угол справа" },
];

let seq = 0;
export const newId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;
export const section = (w = 600, base = "doors", upper = "doors") => ({ id: newId(), kind: "section", w, base, upper });
export const tallItem = (w = 600, tall = "fridge") => ({ id: newId(), kind: "tall", w, tall });

export const TEMPLATES = [
  {
    id: "corner",
    name: "Угловая",
    make: () => ({
      shape: "left",
      island: false,
      main: [
        tallItem(600, "oven"),
        section(600, "doors", "glass"),
        section(600, "sink", "doors"),
        section(600, "hob", "hood"),
        section(600, "doors", "doors"),
        section(600, "doors", "glass"),
        tallItem(600, "fridge"),
      ],
      side: [section(600, "doors", "doors"), section(600, "drawers", "doors")],
    }),
  },
  {
    id: "straight",
    name: "Прямая",
    make: () => ({
      shape: "straight",
      island: false,
      main: [
        section(600, "doors", "doors"),
        section(600, "sink", "doors"),
        section(600, "hob", "hood"),
        section(600, "doors", "lift"),
        section(600, "drawers", "lift"),
      ],
      side: [],
    }),
  },
  {
    id: "island",
    name: "С островом",
    make: () => ({
      shape: "straight",
      island: true,
      main: [
        tallItem(600, "fridge"),
        section(600, "doors", "lift"),
        section(800, "sink", "lift"),
        section(600, "hob", "hood"),
        section(600, "drawers", "lift"),
        tallItem(600, "oven"),
      ],
      side: [],
    }),
  },
];

export const WALLS = [
  { id: "warm", name: "Тёплый белый", hex: "#ece7de" },
  { id: "sand", name: "Песок", hex: "#d9cfbc" },
  { id: "greige", name: "Грейдж", hex: "#c9c1b4" },
  { id: "sage", name: "Шалфей", hex: "#b8bfae" },
  { id: "grey", name: "Серый", hex: "#a8a7a3" },
  { id: "dark", name: "Графит", hex: "#5b5b5c" },
  { id: "terra", name: "Терракота", hex: "#b48a72" },
  { id: "blue", name: "Пыльный синий", hex: "#8e9aa8" },
];

export const GROUPS = [
  { key: "upper", label: "Верхние фасады" },
  { key: "lower", label: "Нижние фасады" },
  { key: "body", label: "Корпус" },
  { key: "splash", label: "Фартук" },
];
