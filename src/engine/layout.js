import { section, tallItem, TEMPLATES } from "../catalog/layouts.js";

const D = 600, GAP = 600, ISLAND_AISLE = 1100;

export function toRuns(model) {
  const len = (items) => items.reduce((s, it) => s + it.w, 0);
  const main = len(model.main), side = model.shape === "straight" ? 0 : len(model.side);
  let from;
  if (model.shape === "left") from = -main / 2 + 300;
  else if (model.shape === "right") from = -main / 2 - 300;
  else from = -main / 2;
  const to = from + main;
  const left = model.shape === "left" ? from : Math.min(from - GAP, -2100);
  const right = model.shape === "right" ? to : Math.max(to + GAP, 2100);

  const runs = [{ wall: "back", from, items: model.main }];
  if (model.shape === "left" && model.side.length) runs.push({ wall: "left", from: D, items: model.side });
  if (model.shape === "right" && model.side.length) runs.push({ wall: "right", from: D, items: model.side });

  let island = null;
  if (model.island) {
    const w = Math.max(1200, Math.min(2400, Math.round(main * 0.5 / 300) * 300));
    island = { from: (from + to) / 2 - w / 2, z: D + ISLAND_AISLE, w, sideLen: side };
  }
  return { room: { left, right, height: 2700 }, runs, island };
}

const B = { doors: "d", drawers: "r", sink: "s", hob: "h" };
const U = { doors: "d", glass: "g", lift: "l", hood: "h", none: "n" };
const T = { oven: "o", fridge: "f", pantry: "p" };
const inv = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
const Bi = inv(B), Ui = inv(U), Ti = inv(T);
const SH = { straight: "S", left: "L", right: "R" }, SHi = inv(SH);

const encItems = (items) =>
  items.map((it) => (it.kind === "tall" ? `T${it.w / 10}${T[it.tall]}` : `${it.w / 10}${B[it.base]}${U[it.upper]}`)).join(".");

const decItems = (s) =>
  (s ? s.split(".") : []).map((t) => {
    if (t[0] === "T") {
      const m = t.match(/^T(\d+)([a-z])$/);
      return tallItem(+m[1] * 10, Ti[m[2]] || "pantry");
    }
    const m = t.match(/^(\d+)([a-z])([a-z])$/);
    return section(+m[1] * 10, Bi[m[2]] || "doors", Ui[m[3]] || "doors");
  });

export function encodeModel(m) {
  return [SH[m.shape] + (m.island ? "i" : ""), encItems(m.main), encItems(m.side)].join("~");
}

export function decodeModel(s) {
  if (!s) return null;
  const tpl = TEMPLATES.find((t) => t.id === s);
  if (tpl) return tpl.make();
  try {
    const [head, main, side] = s.split("~");
    const model = { shape: SHi[head[0]] || "straight", island: head.includes("i"), main: decItems(main), side: decItems(side) };
    return model.main.length ? model : null;
  } catch {
    return null;
  }
}
