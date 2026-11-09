export const GLASS = [
  { id: "clear", name: "Прозрачное", hex: "#d7e0de", opacity: 0.16, roughness: 0.04 },
  { id: "bronze", name: "Бронза", hex: "#7a5a3a", opacity: 0.5, roughness: 0.05 },
  { id: "graphite", name: "Графит", hex: "#2c2f31", opacity: 0.62, roughness: 0.05 },
  { id: "satin", name: "Сатин", hex: "#eceae4", opacity: 0.78, roughness: 0.55 },
];

export const FRAMES = [
  { id: "black", name: "Чёрный", hex: "#151515", metalness: 0.3, roughness: 0.45 },
  { id: "bronze", name: "Бронза", hex: "#6b4f32", metalness: 0.6, roughness: 0.4 },
  { id: "alu", name: "Алюминий", hex: "#b9bcbf", metalness: 0.8, roughness: 0.35 },
];

export const findGlass = (id) => GLASS.find((g) => g.id === id) || GLASS[0];
export const findFrame = (id) => FRAMES.find((f) => f.id === id) || FRAMES[0];
