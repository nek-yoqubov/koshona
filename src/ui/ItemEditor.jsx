import { WIDTHS, BASE_TYPES, UPPER_TYPES, TALL_TYPES } from "../catalog/layouts.js";
import { describe } from "./layoutOps.js";
import { UPPER_HEIGHTS, DRAWERS, DRAWER_TYPES, LIFT_TYPES, liftsFor, liftOf, typeOf, TIER_LOW, TIER_TOP } from "../catalog/mechanisms.js";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" };
const F = { strokeWidth: 3, stroke: "currentColor", strokeLinecap: "round" };
const ICONS = {
  stay: <svg width="30" height="26" viewBox="0 0 30 26"><rect x="4" y="11" width="12" height="13" {...S} /><line x1="16" y1="11" x2="27" y2="3" {...F} /></svg>,
  parallel: <svg width="30" height="26" viewBox="0 0 30 26"><rect x="4" y="11" width="12" height="13" {...S} /><line x1="19" y1="1" x2="19" y2="10" {...F} /></svg>,
  over: <svg width="30" height="26" viewBox="0 0 30 26"><rect x="4" y="11" width="12" height="13" {...S} /><line x1="10" y1="7" x2="27" y2="5" {...F} /></svg>,
  fold: <svg width="30" height="26" viewBox="0 0 30 26"><rect x="4" y="9" width="12" height="15" {...S} /><polyline points="16,9 27,6 17,4" {...S} strokeWidth="3" /></svg>,
  box: <svg width="30" height="26" viewBox="0 0 30 26"><path d="M6 6v15h18V6" {...S} /><line x1="6" y1="6" x2="6" y2="21" {...F} strokeWidth="4" /><line x1="24" y1="6" x2="24" y2="21" {...F} strokeWidth="4" /></svg>,
  hidden: <svg width="30" height="26" viewBox="0 0 30 26"><path d="M7 6v14h16V6" {...S} strokeWidth="3" /><line x1="4" y1="23" x2="26" y2="23" {...F} /></svg>,
  ball: <svg width="30" height="26" viewBox="0 0 30 26"><path d="M8 6v14h14V6" {...S} strokeWidth="3" /><line x1="4" y1="9" x2="4" y2="17" {...F} /><line x1="26" y1="9" x2="26" y2="17" {...F} /></svg>,
};

function IconChoice({ list, value, onPick, disabled = () => false }) {
  return (
    <div className="row tight">
      {list.map((t) => (
        <button key={t.id} disabled={disabled(t.id)} className={value === t.id ? "chip sm ic on" : "chip sm ic"} onClick={() => onPick(t.id)}>
          {ICONS[t.id]}{t.name}
        </button>
      ))}
    </div>
  );
}

function Models({ list, value, onPick }) {
  if (list.length < 2) return list.length ? <div className="lbl sub">{list[0].name}</div> : null;
  return (
    <div className="row tight">
      {list.map((m) => (
        <button key={m.id} className={value === m.id ? "chip xs on" : "chip xs"} onClick={() => onPick(m.id)}>{m.name}</button>
      ))}
    </div>
  );
}

function LiftPick({ label, h, value, onPick }) {
  const ok = liftsFor(h), cur = liftOf(value, h), type = typeOf(cur);
  return (
    <>
      <div className="lbl">{label} · корпус {h} мм</div>
      <IconChoice list={LIFT_TYPES} value={type} disabled={(id) => !ok.some((m) => typeOf(m) === id)} onPick={(id) => onPick(ok.find((m) => typeOf(m) === id).id)} />
      <div className="lbl sub">Модель</div>
      <Models list={ok.filter((m) => typeOf(m) === type)} value={cur.id} onPick={onPick} />
    </>
  );
}

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
              <div className="lbl">Ящики</div>
              <IconChoice list={DRAWER_TYPES} value={it.dt || "box"} onPick={(dt) => onChange({ dt })} />
              {(it.dt || "box") === "box" && (
                <>
                  <div className="lbl sub">Модель</div>
                  <Models list={DRAWERS} value={it.dr || DRAWERS[0].id} onPick={(dr) => onChange({ dr })} />
                </>
              )}
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
          {it.upper === "lift" && (
            <LiftPick label="Подъёмник" h={it.uh === "a" ? TIER_LOW : it.uh === 720 ? 720 : 950} value={it.um} onPick={(um) => onChange({ um })} />
          )}
          {["doors", "glass", "lift"].includes(it.upper) && it.uh === "a" && (
            <LiftPick label="Антресоль" h={TIER_TOP} value={it.um2} onPick={(um2) => onChange({ um2 })} />
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
