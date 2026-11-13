import { useRef } from "react";

const base = import.meta.env.BASE_URL;

export default function SampleView({ list, code, onNav, onClose }) {
  const i = Math.max(0, list.findIndex((d) => d.code === code));
  const d = list[i];
  const start = useRef(null);
  if (!d) return null;
  const go = (k) => onNav(list[(i + k + list.length) % list.length].code);

  return (
    <div
      className="sample"
      onPointerDown={(e) => (start.current = e.clientX)}
      onPointerUp={(e) => {
        const dx = e.clientX - (start.current ?? e.clientX);
        start.current = null;
        if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
      }}
    >
      <img src={base + (d.color.max || d.color.hi)} alt={d.name} draggable={false} />
      <button className="sample-x" onClick={onClose}>×</button>
      <button className="sample-nav l" onClick={() => go(-1)}>‹</button>
      <button className="sample-nav r" onClick={() => go(1)}>›</button>
      <div className="sample-info">
        <b>{d.name}</b>
        <span>{d.supplier} · {d.code.replace("_", " ")} · плита {d.sheet[0]}×{d.sheet[1]} мм · {i + 1} из {list.length}</span>
      </div>
    </div>
  );
}
