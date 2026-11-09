const KEYS = ["upper", "lower", "body", "splash"];
const SHORT = { upper: "u", lower: "l", body: "b", splash: "s" };

export function emptyFinish() {
  return {
    upper: { code: null, rot: true },
    lower: { code: null, rot: true },
    body: { code: null, rot: true },
    splash: { code: null, rot: false },
    wall: "warm",
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
  return f;
}

function writeFinish(p, f, out) {
  KEYS.forEach((k) => f[k].code && out.set(p + SHORT[k], f[k].code));
  out.set(p + "r", KEYS.map((k) => (f[k].rot ? "1" : "0")).join(""));
  out.set(p + "w", f.wall);
}

export function readHash() {
  const h = new URLSearchParams(window.location.hash.slice(1));
  return { layout: h.get("k"), A: readFinish(h, ""), B: readFinish(h, "b_") };
}

export function writeHash({ layout, A, B, compare }) {
  const out = new URLSearchParams();
  out.set("k", layout);
  writeFinish("", A, out);
  if (compare && B) writeFinish("b_", B, out);
  window.history.replaceState(null, "", "#" + out.toString());
}
