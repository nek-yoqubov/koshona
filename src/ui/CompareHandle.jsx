import { useRef } from "react";

export default function CompareHandle({ split, onChange, labelA, labelB }) {
  const ref = useRef(null);

  const move = (e) => {
    if (!ref.current?.hasPointerCapture(e.pointerId)) return;
    const box = ref.current.parentElement.getBoundingClientRect();
    onChange(Math.min(0.95, Math.max(0.05, (e.clientX - box.left) / box.width)));
  };

  return (
    <>
      <div
        ref={ref}
        className="cmp-line"
        style={{ left: `${split * 100}%` }}
        onPointerDown={(e) => { e.stopPropagation(); ref.current.setPointerCapture(e.pointerId); move(e); }}
        onPointerMove={move}
        onPointerUp={(e) => ref.current.releasePointerCapture(e.pointerId)}
      >
        <div className="cmp-knob">‹ ›</div>
      </div>
      <div className="cmp-tag cmp-a">A · {labelA}</div>
      <div className="cmp-tag cmp-b">B · {labelB}</div>
    </>
  );
}
