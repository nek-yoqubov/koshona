export const VIEWS = {
  overall: { theta: 0.25, phi: 1.32, r: 5.4, cx: -0.1, cy: 1.15 },
  fronts: { theta: 0.0, phi: 1.47, r: 3.8, cx: 0, cy: 1.25 },
  closeup: { theta: 0.35, phi: 1.5, r: 1.5, cx: 0.4, cy: 1.0 },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createOrbit(dom, camera, onChange) {
  const o = { ...VIEWS.overall };
  const pts = new Map();
  let pinch = null;

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
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) pinch = pinchState();
  };

  const move = (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) {
      o.theta = clamp(o.theta - dx * 0.005, -0.9, 0.9);
      o.phi = clamp(o.phi + dy * 0.005, 0.9, 1.55);
    } else if (pts.size === 2 && pinch) {
      const n = pinchState();
      o.r = clamp(o.r * (pinch.d / Math.max(n.d, 1)), 1.2, 8);
      const k = o.r / 900;
      o.cx = clamp(o.cx - (n.x - pinch.x) * k, -2, 2);
      o.cy = clamp(o.cy + (n.y - pinch.y) * k, 0.4, 2.2);
      pinch = n;
    }
    apply();
  };

  const up = (e) => {
    pts.delete(e.pointerId);
    pinch = pts.size === 2 ? pinchState() : null;
  };

  const wheel = (e) => {
    e.preventDefault();
    o.r = clamp(o.r * Math.exp(e.deltaY * 0.001), 1.2, 8);
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
    setView(v) { Object.assign(o, VIEWS[v]); apply(); },
    dispose() {
      dom.removeEventListener("pointerdown", down);
      dom.removeEventListener("pointermove", move);
      dom.removeEventListener("pointerup", up);
      dom.removeEventListener("pointercancel", up);
      dom.removeEventListener("wheel", wheel);
    },
  };
}
