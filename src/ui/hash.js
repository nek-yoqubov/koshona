const KEYS = ["upper", "lower", "body", "splash"];
const SHORT = { upper: "u", lower: "l", body: "b", splash: "s" };

export function emptyFinish() {
  return {
    upper: { code: null, rot: true },
    lower: { code: null, rot: true },
    body: { code: null, rot: true },
    splash: { code: null, rot: false },
    wall: "warm",
    glass: { tint: "clear", frame: "black" },
  };
}

function readFinish(h, p) {
  if (!h.get(p + "l")) return null;
  const f = emptyFinish();
  const r = h.get(p + "r") || "1110";
  KEYS.forEach((k, i) => {
    f[k] = { code: h.get(p + SHORT[k]) || null, rot: r[i] === "1" };
  });
  if (h.get(p + "w")) f.wall = h.get(p + "w");
  const [tint, frame] = (h.get(p + "g") || "").split(".");
  if (tint) f.glass = { tint, frame: frame || "black" };
  return f;
}

function writeFinish(p, f, out) {
  KEYS.forEach((k) => f[k].code && out.set(p + SHORT[k], f[k].code));
  out.set(p + "r", KEYS.map((k) => (f[k].rot ? "1" : "0")).join(""));
  out.set(p + "w", f.wall);
  out.set(p + "g", `${f.glass.tint}.${f.glass.frame}`);
}

export function readHash() {
  const h = new URLSearchParams(window.location.hash.slice(1));
  return { layout: h.get("k"), light: h.get("m"), A: readFinish(h, ""), B: readFinish(h, "b_") };
}

export function writeHash({ layout, light, A, B, compare }) {
  const out = new URLSearchParams();
  out.set("k", layout);
  out.set("m", light);
  writeFinish("", A, out);
  if (compare && B) writeFinish("b_", B, out);
  window.history.replaceState(null, "", "#" + out.toString());
}
