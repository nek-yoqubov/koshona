import { section, tallItem, newId, BASE_TYPES, UPPER_TYPES, TALL_TYPES } from "../catalog/layouts.js";

export function locate(model, id) {
  for (const wall of ["main", "side"]) {
    const idx = model[wall].findIndex((it) => it.id === id);
    if (idx >= 0) return { wall, idx, item: model[wall][idx] };
  }
  return null;
}

const edit = (model, wall, fn) => ({ ...model, [wall]: fn([...model[wall]]) });

export function updateItem(model, id, patch) {
  const at = locate(model, id);
  if (!at) return model;
  return edit(model, at.wall, (a) => { a[at.idx] = { ...a[at.idx], ...patch }; return a; });
}

export function removeItem(model, id) {
  const at = locate(model, id);
  if (!at || (at.wall === "main" && model.main.length === 1)) return model;
  return edit(model, at.wall, (a) => { a.splice(at.idx, 1); return a; });
}

export function moveItem(model, id, dir) {
  const at = locate(model, id);
  if (!at) return model;
  const j = at.idx + dir;
  if (j < 0 || j >= model[at.wall].length) return model;
  return edit(model, at.wall, (a) => { [a[at.idx], a[j]] = [a[j], a[at.idx]]; return a; });
}

export function duplicateItem(model, id) {
  const at = locate(model, id);
  if (!at) return { model, id };
  const copy = { ...at.item, id: newId() };
  return { model: edit(model, at.wall, (a) => { a.splice(at.idx + 1, 0, copy); return a; }), id: copy.id };
}

export function addItem(model, wall, kind) {
  const it = kind === "tall" ? tallItem(600, "pantry") : section(600, "doors", "doors");
  return { model: edit(model, wall, (a) => [...a, it]), id: it.id };
}

const nameOf = (list, id) => list.find((t) => t.id === id)?.name ?? id;

export function describe(it) {
  if (!it) return "";
  if (it.kind === "tall") return `Пенал ${it.w} · ${nameOf(TALL_TYPES, it.tall)}`;
  const up = it.upper === "none" ? "без верха" : nameOf(UPPER_TYPES, it.upper).toLowerCase();
  return `Тумба ${it.w} · ${nameOf(BASE_TYPES, it.base).toLowerCase()} / ${up}`;
}

export const runLength = (items) => items.reduce((s, it) => s + it.w, 0);
