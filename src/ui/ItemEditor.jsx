import { WIDTHS, BASE_TYPES, UPPER_TYPES, TALL_TYPES } from "../catalog/layouts.js";
import { describe } from "./layoutOps.js";
import { UPPER_HEIGHTS, DRAWERS, liftsFor, liftOf, TIER_LOW, TIER_TOP } from "../catalog/mechanisms.js";

const lifts = (h) => liftsFor(h).map((m) => ({ id: m.id, name: m.name }));

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
          {(it.base === "drawers" || it.base === "hob") && (
            <>
              <div className="lbl">Система ящиков</div>
              <Choice list={DRAWERS} value={it.dr || DRAWERS[0].id} onPick={(dr) => onChange({ dr })} />
            </>
          )}
          <div className="lbl">Верх</div>
          <Choice list={UPPER_TYPES} value={it.upper} onPick={(upper) => onChange({ upper })} />
          {["doors", "glass", "lift"].includes(it.upper) && (
            <>
              <div className="lbl">Высота верха, мм</div>
              <Choice list={UPPER_HEIGHTS} value={it.uh ?? 950} onPick={(uh) => onChange({ uh })} />
            </>
          )}
          {it.upper === "lift" && (() => {
            const h = it.uh === "a" ? TIER_LOW : it.uh === 720 ? 720 : 950;
            return (
              <>
                <div className="lbl">Подъёмник · корпус {h} мм</div>
                <Choice list={lifts(h)} value={liftOf(it.um, h)?.id} onPick={(um) => onChange({ um })} />
              </>
            );
          })()}
          {["doors", "glass", "lift"].includes(it.upper) && it.uh === "a" && (
            <>
              <div className="lbl">Подъёмник антресоли · {TIER_TOP} мм</div>
              <Choice list={lifts(TIER_TOP)} value={liftOf(it.um2, TIER_TOP)?.id} onPick={(um2) => onChange({ um2 })} />
            </>
          )}
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
