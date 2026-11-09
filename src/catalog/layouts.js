const S = (base, upper, w = 600) => ({ base, upper, w });

export const LAYOUTS = [
  {
    id: "corner",
    name: "Угловая",
    note: "3,6 м + 1,2 м · пеналы",
    room: { left: -2100, height: 2700 },
    runs: [
      {
        wall: "back",
        from: -2100,
        items: [
          { tall: "oven", w: 600 },
          S("doors", "glass"),
          S("sink", "split"),
          S("hob", "hood"),
          S("doors", "split"),
          S("doors", "glass"),
          { tall: "fridge", w: 600, h: 2700 },
        ],
      },
      {
        wall: "left",
        from: 600,
        items: [S("doors", "split"), S("drawers", "split")],
      },
    ],
  },
  {
    id: "straight",
    name: "Прямая",
    note: "3 м · без пеналов",
    room: { left: -2100, height: 2700 },
    runs: [
      {
        wall: "back",
        from: -1500,
        items: [
          S("doors", "split"),
          S("sink", "split"),
          S("hob", "hood"),
          S("doors", "split"),
          S("drawers", "split"),
        ],
      },
    ],
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
  { key: "upper", label: "Верхние фасады", rot: true },
  { key: "lower", label: "Нижние фасады", rot: true },
  { key: "body", label: "Корпус", rot: true },
  { key: "splash", label: "Фартук", rot: false },
];
