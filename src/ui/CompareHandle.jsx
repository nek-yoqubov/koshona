import { useEffect, useRef, useState } from "react";
import { Ico } from "./icons.jsx";

// Ползунок A/B: буквы прямо на ручке, нажатие на букву — какой вариант правим.
// Подписи прячутся через 2 с без касаний и возвращаются при любом движении.
export default function CompareHandle({ split, onChange, labelA, labelB, editing, onEdit }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(true);
  const timer = useRef(0);

  useEffect(() => {
    const wake = () => {
      setShown(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setShown(false), 2000);
    };
    wake();
    const box = ref.current?.parentElement;
    box?.addEventListener("pointermove", wake);
    box?.addEventListener("pointerdown", wake);
    return () => {
      clearTimeout(timer.current);
      box?.removeEventListener("pointermove", wake);
      box?.removeEventListener("pointerdown", wake);
    };
  }, []);

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
        <div className={shown ? "cmp-knob shown" : "cmp-knob"}>
          <button className={editing === "A" ? "cmp-l on" : "cmp-l"} onPointerDown={(e) => e.stopPropagation()} onClick={() => onEdit("A")}>{editing === "A" && <small>Правим</small>}A</button>
          <span className="cmp-grip"><Ico name="swap" size={18} /></span>
          <button className={editing === "B" ? "cmp-r on" : "cmp-r"} onPointerDown={(e) => e.stopPropagation()} onClick={() => onEdit("B")}>B{editing === "B" && <small>Правим</small>}</button>
        </div>
      </div>
      <div className={shown ? "cmp-tag cmp-a shown" : "cmp-tag cmp-a"}>A · {labelA}</div>
      <div className={shown ? "cmp-tag cmp-b shown" : "cmp-tag cmp-b"}>B · {labelB}</div>
    </>
  );
}
