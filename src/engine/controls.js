export const VIEWS = {
  overall: { theta: 0.25, phi: 1.32, r: 5.4, cx: -0.1, cy: 1.15 },
  fronts: { theta: 0.0, phi: 1.47, r: 3.8, cx: 0, cy: 1.25 },
  closeup: { theta: 0.35, phi: 1.5, r: 1.5, cx: 0.4, cy: 1.0 },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createOrbit(dom, camera, onChange, onTap, frame = { t: 0.384, a: 1.6 }) {
  const o = { ...VIEWS.overall };
  const fit = { cx: 0, w: 4, r: 5.4 };
  let auto = true;
  const fitR = () => Math.max(4, (fit.w * 0.75) / (frame.t * frame.a) + 0.8, 1.7 / frame.t + 0.8);
  const rMax = () => Math.max(8, fit.r * 1.4);
  const pts = new Map();
  let pinch = null, tap = null;

  const apply = () => {
    camera.position.set(
      o.cx + o.r * Math.sin(o.phi) * Math.sin(o.theta),
      o.cy + o.r * Math.cos(o.phi),
      o.r * Math.sin(o.phi) * Math.cos(o.theta)
    );
    camera.lookAt(o.cx, o.cy, 0.3);
    onChange();
  };

  const pinchState = () => {
    const [a, b] = [...pts.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  const down = (e) => {
    dom.setPointerCapture(e.pointerId);
    auto = false;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tap = pts.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    if (pts.size === 2) pinch = pinchState();
  };

  const move = (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) tap = null;
    if (pts.size === 1) {
      o.theta = clamp(o.theta - dx * 0.005, -0.9, 0.9);
      o.phi = clamp(o.phi + dy * 0.005, 0.9, 1.55);
    } else if (pts.size === 2 && pinch) {
      const n = pinchState();
      o.r = clamp(o.r * (pinch.d / Math.max(n.d, 1)), 1.2, rMax());
      const k = o.r / 900;
      o.cx = clamp(o.cx - (n.x - pinch.x) * k, -5, 5);
      o.cy = clamp(o.cy + (n.y - pinch.y) * k, 0.4, 2.2);
      pinch = n;
    }
    apply();
  };

  const up = (e) => {
    if (tap && e.type === "pointerup" && pts.size === 1 && performance.now() - tap.t < 600) {
      const r = dom.getBoundingClientRect();
      onTap?.(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    }
    tap = null;
    pts.delete(e.pointerId);
    pinch = pts.size === 2 ? pinchState() : null;
  };

  const wheel = (e) => {
    e.preventDefault();
    auto = false;
    o.r = clamp(o.r * Math.exp(e.deltaY * 0.001), 1.2, rMax());
    apply();
  };

  dom.style.touchAction = "none";
  dom.addEventListener("pointerdown", down);
  dom.addEventListener("pointermove", move);
  dom.addEventListener("pointerup", up);
  dom.addEventListener("pointercancel", up);
  dom.addEventListener("wheel", wheel, { passive: false });
  apply();

  return {
    setView(v) {
      fit.r = fitR();
      Object.assign(o, VIEWS[v]);
      if (v === "overall") { o.cx = fit.cx; o.r = fit.r; auto = true; }
      else { o.cx += fit.cx; o.r *= Math.max(1, fit.r / 6.2); auto = false; }
      apply();
    },
    setFit(cx, width) { fit.cx = cx; fit.w = width; if (auto) this.setView("overall"); },
    refit() { if (auto) this.setView("overall"); },
    get auto() { return auto; },
    tourStep(t) {
      fit.r = fitR();
      o.theta = 0.42 * Math.sin(t * 0.13);
      o.phi = 1.33 + 0.07 * Math.sin(t * 0.07);
      o.r = fit.r * (1.1 + 0.06 * Math.sin(t * 0.05));
      o.cx = fit.cx;
      o.cy = VIEWS.overall.cy;
      apply();
    },
    dispose() {
      dom.removeEventListener("pointerdown", down);
      dom.removeEventListener("pointermove", move);
      dom.removeEventListener("pointerup", up);
      dom.removeEventListener("pointercancel", up);
      dom.removeEventListener("wheel", wheel);
    },
  };
}
