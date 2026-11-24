import { WIDTHS, BASE_TYPES, UPPER_TYPES, TALL_TYPES } from "../catalog/layouts.js";
import { describe } from "./layoutOps.js";
import { UPPER_HEIGHTS, DRAWERS, DRAWER_TYPES, liftsFor, liftOf, TIER_LOW, TIER_TOP } from "../catalog/mechanisms.js";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
const F = { fill: "none", stroke: "currentColor", strokeWidth: 3.2, strokeLinecap: "round", strokeLinejoin: "round" };

// Как открывается фасад — вид шкафа сбоку: корпус тонкой линией, фасад толстой
const Cab = ({ children }) => (
  <svg width="52" height="40" viewBox="0 0 52 40" aria-hidden="true">
    <rect x="6" y="15" width="19" height="21" rx="1" {...S} opacity=".55" />
    {children}
  </svg>
);
const MOVES = {
  stay: <Cab><line x1="27" y1="14" x2="47" y2="8" {...F} /><path d="M27 30 Q40 28 45 15" {...S} strokeDasharray="1.5 3" opacity=".6" /></Cab>,
  strut: <Cab><line x1="27" y1="14" x2="47" y2="11" {...F} /><line x1="22" y1="24" x2="37" y2="13" {...S} /></Cab>,
  parallel: <Cab><line x1="29" y1="2" x2="29" y2="13" {...F} /><path d="M36 13 V5 M33 8 L36 5 L39 8" {...S} opacity=".6" /></Cab>,
  over: <Cab><line x1="12" y1="10" x2="33" y2="5" {...F} /><path d="M29 30 Q44 26 40 9" {...S} strokeDasharray="1.5 3" opacity=".6" /></Cab>,
  fold: <Cab><polyline points="27,14 41,9 30,3" {...F} /></Cab>,
};
const moveOf = (m) => (m.motion === "gas" || m.id === "hkxs" ? "strut" : m.motion);

const D = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" };
const DF = { strokeWidth: 3, stroke: "currentColor", strokeLinecap: "round" };
const DRAWER_ICONS = {
  box: <svg width="30" height="26" viewBox="0 0 30 26"><path d="M6 6v15h18V6" {...D} /><line x1="6" y1="6" x2="6" y2="21" {...DF} strokeWidth="4" /><line x1="24" y1="6" x2="24" y2="21" {...DF} strokeWidth="4" /></svg>,
  hidden: <svg width="30" height="26" viewBox="0 0 30 26"><path d="M7 6v14h16V6" {...D} strokeWidth="3" /><line x1="4" y1="23" x2="26" y2="23" {...DF} /></svg>,
  ball: <svg width="30" height="26" viewBox="0 0 30 26"><path d="M8 6v14h14V6" {...D} strokeWidth="3" /><line x1="4" y1="9" x2="4" y2="17" {...DF} /><line x1="26" y1="9" x2="26" y2="17" {...DF} /></svg>,
};

const A = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
const ACT = {
  left: <svg {...A}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>,
  right: <svg {...A}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  copy: <svg {...A}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>,
  del: <svg {...A}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>,
  undo: <svg {...A}><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>,
  close: <svg {...A}><path d="M6 6l12 12M18 6L6 18" /></svg>,
};
const Act = ({ icon, title, onClick, disabled, danger }) => (
  <button className={danger ? "ed-act danger" : "ed-act"} onClick={onClick} disabled={disabled} title={title} aria-label={title}>{ACT[icon]}</button>
);

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

function IconChoice({ list, icons, value, onPick }) {
  return (
    <div className="row tight">
      {list.map((t) => (
        <button key={t.id} className={value === t.id ? "chip sm ic on" : "chip sm ic"} onClick={() => onPick(t.id)}>
          {icons[t.id]}{t.name}
        </button>
      ))}
    </div>
  );
}

// Механизмы одним рядом: картинка движения и название. Показываются только те, что подходят корпусу по высоте.
function LiftPick({ label, h, value, onPick, under = false }) {
  const ok = liftsFor(h, under), cur = liftOf(value, h, under);
  return (
    <>
      <div className="lbl">{label} <span className="dim">· корпус {h} мм</span></div>
      <div className="mcards">
        {ok.map((m) => (
          <button key={m.id} className={cur.id === m.id ? "mcard on" : "mcard"} onClick={() => onPick(m.id)} title={m.name}>
            {MOVES[moveOf(m)]}
            <b>{m.name.replace("AVENTOS ", "").replace(" GTV", "")}</b>
            <i>{m.brand}</i>
          </button>
        ))}
      </div>
    </>
  );
}

export default function ItemEditor({ it, zone = "lower", onZone, onChange, onMove, onDuplicate, onRemove, onClose, onUndo, canUndo }) {
  if (it === "island") {
    return (
      <div className="editor">
        <div className="ed-head">
          <b>Остров</b>
          <div className="ed-acts">
            <Act icon="del" title="Убрать остров" onClick={onRemove} danger />
            <Act icon="close" title="Закрыть" onClick={onClose} />
          </div>
        </div>
      </div>
    );
  }
  const tall = it.kind === "tall";
  const tiered = ["doors", "glass", "lift"].includes(it.upper);
  const up = zone === "upper";
  return (
    <div className="editor">
      <div className="ed-head">
        <b title={describe(it)}>{tall ? "Пенал" : "Тумба"} {it.w}</b>
        <div className="ed-acts">
          <Act icon="left" title="Сдвинуть влево" onClick={() => onMove(-1)} />
          <Act icon="right" title="Сдвинуть вправо" onClick={() => onMove(1)} />
          <Act icon="copy" title="Копия рядом" onClick={onDuplicate} />
          <Act icon="del" title="Удалить" onClick={onRemove} danger />
          <Act icon="undo" title="Отменить" onClick={onUndo} disabled={!canUndo} />
          <span className="ed-sep" />
          <Act icon="close" title="Закрыть" onClick={onClose} />
        </div>
      </div>

      <div className="lbl">Ширина, мм</div>
      <Choice list={WIDTHS} value={it.w} onPick={(w) => onChange({ w })} />

      {tall ? (
        <>
          <div className="lbl">Тип</div>
          <Choice list={TALL_TYPES} value={it.tall} onPick={(t) => onChange({ tall: t })} />
        </>
      ) : (
        <>
          <div className="ed-tabs" role="tablist">
            <button role="tab" aria-selected={up} className={up ? "on" : ""} onClick={() => onZone("upper")}>Верх</button>
            <button role="tab" aria-selected={!up} className={up ? "" : "on"} onClick={() => onZone("lower")}>Низ</button>
          </div>
          {up ? (
            <>
              <Choice list={UPPER_TYPES} value={it.upper} onPick={(upper) => onChange({ upper })} />
              {tiered && (
                <>
                  <div className="lbl">Высота, мм</div>
                  <Choice list={UPPER_HEIGHTS} value={it.uh ?? 950} onPick={(uh) => onChange({ uh })} />
                </>
              )}
              {it.upper === "lift" && (
                <LiftPick label="Подъёмник" h={it.uh === "a" ? TIER_LOW : it.uh === 720 ? 720 : 950} value={it.um} under={it.uh === "a"} onPick={(um) => onChange({ um })} />
              )}
              {tiered && it.uh === "a" && <LiftPick label="Антресоль" h={TIER_TOP} value={it.um2} onPick={(um2) => onChange({ um2 })} />}
            </>
          ) : (
            <>
              <Choice list={BASE_TYPES} value={it.base} onPick={(base) => onChange({ base })} />
              {(it.base === "drawers" || it.base === "hob") && (
                <>
                  <div className="lbl">Ящики</div>
                  <IconChoice list={DRAWER_TYPES} icons={DRAWER_ICONS} value={it.dt || "box"} onPick={(dt) => onChange({ dt })} />
                  {(it.dt || "box") === "box" && (
                    <>
                      <div className="lbl">Модель</div>
                      <Choice list={DRAWERS} value={it.dr || DRAWERS[0].id} onPick={(dr) => onChange({ dr })} />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
