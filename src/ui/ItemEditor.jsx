import { WIDTHS, BASE_TYPES, UPPER_TYPES, TALL_TYPES } from "../catalog/layouts.js";
import { describe } from "./layoutOps.js";

function Choice({ list, value, onPick }) {
  return (
    <div className="row tight">
      {list.map((t) => (
        <button key={t.id ?? t} className={value === (t.id ?? t) ? "chip sm on" : "chip sm"} onClick={() => onPick(t.id ?? t)}>
          {t.name ?? t}
        </button>
      ))}
    </div>
  );
}

export default function ItemEditor({ it, onChange, onMove, onDuplicate, onRemove, onClose, onUndo, canUndo }) {
  if (it === "island") {
    return (
      <div className="editor">
        <div className="between top0"><b>Остров</b><button className="x" onClick={onClose}>×</button></div>
        <div className="row tight">
          <button className="btn sm" onClick={onRemove}>Убрать остров</button>
        </div>
      </div>
    );
  }
  return (
    <div className="editor">
      <div className="between top0">
        <b>{describe(it)}</b>
        <button className="x" onClick={onClose} title="Закрыть">×</button>
      </div>
      <div className="lbl">Ширина, мм</div>
      <Choice list={WIDTHS} value={it.w} onPick={(w) => onChange({ w })} />
      {it.kind === "tall" ? (
        <>
          <div className="lbl">Тип</div>
          <Choice list={TALL_TYPES} value={it.tall} onPick={(tall) => onChange({ tall })} />
        </>
      ) : (
        <>
          <div className="lbl">Низ</div>
          <Choice list={BASE_TYPES} value={it.base} onPick={(base) => onChange({ base })} />
          <div className="lbl">Верх</div>
          <Choice list={UPPER_TYPES} value={it.upper} onPick={(upper) => onChange({ upper })} />
        </>
      )}
      <div className="row tight act">
        <button className="btn sm" onClick={() => onMove(-1)} title="Сдвинуть влево">←</button>
        <button className="btn sm" onClick={() => onMove(1)} title="Сдвинуть вправо">→</button>
        <button className="btn sm" onClick={onDuplicate}>Копия рядом</button>
        <button className="btn sm danger" onClick={onRemove}>Удалить</button>
        <button className="btn sm" onClick={onUndo} disabled={!canUndo}>↶ Отменить</button>
      </div>
    </div>
  );
}
