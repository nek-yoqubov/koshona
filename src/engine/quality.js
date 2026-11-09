export const LEVELS = {
  low: {
    label: "Низкая",
    maxPixels: 1280 * 720,
    antialias: false,
    shadows: false,
    shadowSize: 0,
    relief: false,
    texture: "lo",
    spots: false,
    ledLights: 0,
  },
  mid: {
    label: "Средняя",
    maxPixels: 1920 * 1080,
    antialias: true,
    shadows: true,
    shadowSize: 1024,
    relief: true,
    texture: "hi",
    spots: true,
    ledLights: 1,
  },
  high: {
    label: "Высокая",
    maxPixels: 3840 * 2160,
    antialias: true,
    shadows: true,
    shadowSize: 2048,
    relief: true,
    texture: "hi",
    spots: true,
    ledLights: 2,
  },
};

const KEY = "koshona.quality";

export function savedLevel() {
  try {
    const v = localStorage.getItem(KEY);
    return LEVELS[v] ? v : null;
  } catch {
    return null;
  }
}

export function saveLevel(v) {
  try {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {
    return;
  }
}

export function guessLevel() {
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;
  return mem <= 4 || cores <= 4 ? "low" : "mid";
}

export function pickByFps(level, fps) {
  if (fps < 22) return level === "high" ? "mid" : "low";
  if (fps > 50 && level === "low") return "mid";
  if (fps > 55 && level === "mid" && !matchMedia("(pointer: coarse)").matches) return "high";
  return level;
}

export function pixelRatioFor(level, w, h) {
  const dpr = window.devicePixelRatio || 1;
  const cap = Math.sqrt(LEVELS[level].maxPixels / Math.max(1, w * h));
  return Math.max(0.5, Math.min(dpr, 2, cap));
}
