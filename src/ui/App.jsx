import { useEffect, useMemo, useRef, useState } from "react";
import { createViewer } from "../engine/viewer.js";
import { LEVELS, savedLevel, saveLevel, guessLevel, pickByFps } from "../engine/quality.js";
import { TEMPLATES, SHAPES, WALLS, GROUPS } from "../catalog/layouts.js";
import { GLASS, FRAMES } from "../catalog/glass.js";
import { encodeModel, decodeModel } from "../engine/layout.js";
import { FINISHES } from "../engine/materials.js";
import { emptyFinish, readHash, writeHash } from "./hash.js";
import { buildSpec, downloadCsv } from "./spec.js";
import { locate, updateItem, removeItem, moveItem, duplicateItem, addItem, describe, runLength } from "./layoutOps.js";
import { ItemIcon, ShapeIcon } from "./icons.jsx";
import ItemEditor from "./ItemEditor.jsx";
import CompareHandle from "./CompareHandle.jsx";
import SampleView from "./SampleView.jsx";

const base = import.meta.env.BASE_URL;
const wallHex = (id) => (WALLS.find((w) => w.id === id) || WALLS[0]).hex;
const toViewer = (f) => ({ ...f, wallHex: wallHex(f.wall) });
const fromUrl = readHash();
const metres = (mm) => `${(mm / 1000).toLocaleString("ru", { maximumFractionDigits: 2 })} м`;

export default function App() {
  const mountRef = useRef(null);
  const viewerRef = useRef(null);
  const [viewerId, setViewerId] = useState(0);

  const [quality, setQuality] = useState(() => {
    const s = savedLevel();
    return { level: s || guessLevel(), auto: !s, tested: !!s };
  });
  const [stats, setStats] = useState({ fps: 0, active: false });

  const [tab, setTab] = useState("layout");
  const [model, setModelRaw] = useState(() => decodeModel(fromUrl.layout) || TEMPLATES[0].make());
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);

  const [decors, setDecors] = useState([]);
  const [fin, setFin] = useState({ A: fromUrl.A || emptyFinish(), B: fromUrl.B || fromUrl.A || emptyFinish() });
  const [compare, setCompare] = useState(!!fromUrl.B);
  const [split, setSplit] = useState(0.5);
  const [editing, setEditing] = useState("A");
  const [active, setActive] = useState("lower");
  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState("Все");
  const [light, setLight] = useState(fromUrl.light === "night" ? "night" : "day");
  const [specOpen, setSpecOpen] = useState(false);
  const [sample, setSample] = useState(null);
  const [parts, setParts] = useState([]);

  const setModel = (next) => {
    setHistory((h) => [...h.slice(-49), model]);
    setModelRaw(next);
  };
  const undo = () => {
    if (!history.length) return;
    setModelRaw(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };

  useEffect(() => {
    fetch(base + "catalog/decors.json")
      .then((r) => r.json())
      .then((list) => {
        setDecors(list);
        const fill = (f) => {
          const g = { ...emptyFinish(), ...structuredClone(f) };
          for (const k of ["upper", "lower", "body"]) if (!list.some((d) => d.code === g[k].code)) g[k].code = list[0]?.code ?? null;
          if (g.splash.code && !list.some((d) => d.code === g.splash.code)) g.splash.code = null;
          return g;
        };
        setFin((f) => ({ A: fill(f.A), B: fill(f.B) }));
      });
  }, []);

  useEffect(() => {
    const v = createViewer(mountRef.current, quality.level, setStats, (id) => {
      setSelected(id);
      if (id) setTab("layout");
    });
    viewerRef.current = v;
    setViewerId((n) => n + 1);
    return () => v.dispose();
  }, [quality.level]);

  const v = viewerRef.current;

  useEffect(() => {
    if (!v) return;
    v.setLayout(model);
    setParts(v.parts);
  }, [viewerId, model]);
  useEffect(() => { v?.setDecors(decors); }, [viewerId, decors]);
  useEffect(() => { v?.setFinish("A", toViewer(fin.A)); }, [viewerId, fin.A, decors]);
  useEffect(() => { v?.setFinish("B", toViewer(fin.B)); }, [viewerId, fin.B, decors]);
  useEffect(() => { v?.setCompare(compare); }, [viewerId, compare]);
  useEffect(() => { v?.setSplit(split); }, [viewerId, split]);
  useEffect(() => { v?.setLight(light); }, [viewerId, light]);
  useEffect(() => { v?.setOpen(open); }, [viewerId, open]);
  useEffect(() => { v?.setSelected(selected); }, [viewerId, selected, model]);

  useEffect(() => {
    if (!v || quality.tested || !decors.length) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const fps = await v.benchmark(2500);
      if (!cancelled) setQuality((q) => ({ ...q, level: pickByFps(q.level, fps), tested: true }));
    }, 1500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [viewerId, quality.tested, decors.length]);

  useEffect(() => {
    if (fin.A.lower.code) writeHash({ layout: encodeModel(model), light, A: fin.A, B: fin.B, compare });
  }, [model, light, fin, compare]);

  const pickLevel = (id) => {
    if (id === "auto") {
      saveLevel(null);
      setQuality({ level: guessLevel(), auto: true, tested: false });
    } else {
      saveLevel(id);
      setQuality({ level: id, auto: false, tested: true });
    }
  };

  const applyTemplate = (t) => {
    setModel(t.make());
    setSelected(null);
    setTimeout(() => viewerRef.current?.setView("overall"), 0);
  };
  const setShape = (shape) => {
    let next = { ...model, shape };
    if (shape !== "straight" && !next.side.length) next = addItem(addItem(next, "side", "section").model, "side", "section").model;
    setModel(next);
    setTimeout(() => viewerRef.current?.setView("overall"), 0);
  };

  const sel = selected === "island" ? "island" : selected ? locate(model, selected)?.item : null;
  const editorProps = {
    it: sel,
    canUndo: history.length > 0,
    onUndo: undo,
    onClose: () => setSelected(null),
    onChange: (patch) => setModel(updateItem(model, selected, patch)),
    onMove: (dir) => setModel(moveItem(model, selected, dir)),
    onDuplicate: () => { const r = duplicateItem(model, selected); setModel(r.model); setSelected(r.id); },
    onRemove: () => {
      if (selected === "island") setModel({ ...model, island: false });
      else setModel(removeItem(model, selected));
      setSelected(null);
    },
  };
  const add = (wall, kind) => { const r = addItem(model, wall, kind); setModel(r.model); setSelected(r.id); };

  const side = compare ? editing : "A";
  const cur = fin[side];
  const setCur = (fn) => setFin((f) => ({ ...f, [side]: fn(f[side]) }));
  const toggleCompare = () => {
    if (!compare) setFin((f) => ({ ...f, B: structuredClone(f.A) }));
    setEditing(compare ? "A" : "B");
    setCompare(!compare);
    setTab("finish");
  };

  const suppliers = useMemo(() => ["Все", ...new Set(decors.map((d) => d.supplier))], [decors]);
  const finishOf = (d) => FINISHES[d?.finish]?.label ?? "";
  const filtered = decors.filter((d) => (supplier === "Все" || d.supplier === supplier) && `${d.name} ${finishOf(d)}`.toLowerCase().includes(search.toLowerCase()));
  const nameOf = (code) => decors.find((d) => d.code === code)?.name ?? "—";
  const shortName = (f) => nameOf(f.lower.code).replace(/\s+\S+\s+\S+$/, "");
  const spec = useMemo(() => buildSpec(parts, fin.A, decors), [parts, fin.A, decors]);

  const screenshot = () => {
    const a = document.createElement("a");
    a.href = v.screenshot();
    a.download = "kitchen.png";
    a.click();
  };

  const wallList = (wall, title) => (
    <div className="wall">
      <div className="between top0">
        <span className="label0">{title}</span>
        <span className="muted small">{metres(runLength(model[wall]))}</span>
      </div>
      <div className="items">
        {model[wall].map((it) => (
          <button key={it.id} className={selected === it.id ? "item on" : "item"} onClick={() => setSelected(it.id)} title={describe(it)}>
            <ItemIcon it={it} />
            <span>{it.w}</span>
          </button>
        ))}
        <button className="item add" onClick={() => add(wall, "section")} title="Добавить тумбу">＋<span>тумба</span></button>
        <button className="item add" onClick={() => add(wall, "tall")} title="Добавить пенал">＋<span>пенал</span></button>
      </div>
    </div>
  );

  return (
    <div className="app">
      <div className="stage">
        <div ref={mountRef} className="canvas" />
        {compare && <CompareHandle split={split} onChange={setSplit} labelA={shortName(fin.A)} labelB={shortName(fin.B)} />}

        <div className="quality">
          <span className="fps">{stats.active ? `${stats.fps} fps` : "пауза"}</span>
          {["auto", "low", "mid", "high"].map((id) => {
            const on = id === "auto" ? quality.auto : !quality.auto && quality.level === id;
            return (
              <button key={id} className={on ? "q on" : "q"} onClick={() => pickLevel(id)}>
                {id === "auto" ? `Авто · ${LEVELS[quality.level].label.toLowerCase()}` : LEVELS[id].label}
              </button>
            );
          })}
        </div>

        <div className="toolbar">
          {[["overall", "Общий"], ["fronts", "Фасады"], ["closeup", "Крупно"]].map(([id, l]) => (
            <button key={id} className="tb" onClick={() => v?.setView(id)}>{l}</button>
          ))}
          <span className="sep" />
          <button className={open ? "tb on" : "tb"} onClick={() => setOpen((o) => !o)}>{open ? "Закрыть фасады" : "Открыть фасады"}</button>
          <button className="tb" onClick={() => setLight((l) => (l === "day" ? "night" : "day"))}>{light === "day" ? "☀ День" : "☾ Вечер"}</button>
          <button className={compare ? "tb on" : "tb"} onClick={toggleCompare}>A / B</button>
        </div>

        {sample && (
          <SampleView
            list={filtered.length ? filtered : decors}
            code={sample}
            onNav={(c) => { setSample(c); setCur((f) => ({ ...f, [active]: { ...f[active], code: c } })); }}
            onClose={() => setSample(null)}
          />
        )}

        {sel && !sample && (
          <div className="float">
            <ItemEditor {...editorProps} />
          </div>
        )}
      </div>

      <aside className="side">
        <div className="steps">
          <button className={tab === "layout" ? "step on" : "step"} onClick={() => setTab("layout")}><i>1</i>Компоновка</button>
          <button className={tab === "finish" ? "step on" : "step"} onClick={() => setTab("finish")}><i>2</i>Отделка</button>
        </div>

        {tab === "layout" ? (
          <>
            <section>
              <div className="label">Начать с шаблона</div>
              <div className="row">
                {TEMPLATES.map((t) => (
                  <button key={t.id} className="chip" onClick={() => applyTemplate(t)}>{t.name}</button>
                ))}
              </div>
            </section>
            <section>
              <div className="label">Форма</div>
              <div className="shapes">
                {SHAPES.map((s) => (
                  <button key={s.id} className={model.shape === s.id ? "shape on" : "shape"} onClick={() => setShape(s.id)}>
                    <ShapeIcon shape={s.id} />
                    <span>{s.name}</span>
                  </button>
                ))}
                <button className={model.island ? "shape on" : "shape"} onClick={() => setModel({ ...model, island: !model.island })}>
                  <ShapeIcon shape={model.shape} island />
                  <span>{model.island ? "Остров ✓" : "Остров"}</span>
                </button>
              </div>
            </section>
            <section>
              {wallList("main", "Основная стена")}
              {model.shape !== "straight" && wallList("side", model.shape === "left" ? "Левая стена" : "Правая стена")}
              <div className="between">
                <span className="muted small">Нажмите на шкаф в списке или прямо на 3D-модели</span>
                <button className="btn sm" onClick={undo} disabled={!history.length}>↶ Отменить</button>
              </div>
            </section>
            <section>
              <button className="btn wide dark" onClick={() => setTab("finish")}>Далее · отделка →</button>
            </section>
          </>
        ) : (
          <>
            <section>
              {compare && (
                <div className="tabs">
                  {["A", "B"].map((s) => (
                    <button key={s} className={editing === s ? "tab on" : "tab"} onClick={() => setEditing(s)}>Вариант {s}</button>
                  ))}
                </div>
              )}
              <div className="row">
                {[...GROUPS, { key: "glass", label: "Витрины" }].map((g) => (
                  <button key={g.key} className={active === g.key ? "chip on" : "chip"} onClick={() => setActive(g.key)}>{g.label}</button>
                ))}
              </div>
              {active === "glass" ? (
                <>
                  <div className="label mt">Стекло</div>
                  <div className="row">
                    {GLASS.map((g) => (
                      <button key={g.id} className={cur.glass.tint === g.id ? "chip on" : "chip"} onClick={() => setCur((f) => ({ ...f, glass: { ...f.glass, tint: g.id } }))}>
                        <span className="mini" style={{ background: g.hex, opacity: 0.35 + g.opacity * 0.65 }} />{g.name}
                      </button>
                    ))}
                  </div>
                  <div className="label mt">Рамка</div>
                  <div className="row">
                    {FRAMES.map((f) => (
                      <button key={f.id} className={cur.glass.frame === f.id ? "chip on" : "chip"} onClick={() => setCur((x) => ({ ...x, glass: { ...x.glass, frame: f.id } }))}>
                        <span className="mini" style={{ background: f.hex }} />{f.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="row">
                    {suppliers.map((s) => (
                      <button key={s} className={supplier === s ? "chip sm on" : "chip sm"} onClick={() => setSupplier(s)}>{s}</button>
                    ))}
                  </div>
                  <input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Найти — дуб, серый, H305…" />
                  <div className="grid">
                    {filtered.map((d) => (
                      <button key={d.code} title={finishOf(d) ? `${d.name} · ${finishOf(d)}` : d.name} className={(cur[active].code === d.code ? "sw on" : "sw") + (d.finish === "hg" || d.finish === "metal" ? " gloss" : "")} style={{ backgroundImage: `url(${base + d.card})` }}
                        onClick={() => setCur((f) => ({ ...f, [active]: { ...f[active], code: d.code } }))} />
                    ))}
                  </div>
                  <div className="between">
                    <span className="muted pr">{nameOf(cur[active].code)}{finishOf(decors.find((d) => d.code === cur[active].code)) && ` · ${finishOf(decors.find((d) => d.code === cur[active].code))}`}</span>
                    <button className="btn" onClick={() => setSample(cur[active].code)} title="Декор во весь экран — сравнить с живым образцом">Образец ⤢</button>
                  </div>
                  <div className="between">
                    <span />
                    <button className={cur[active].rot ? "btn on" : "btn"} onClick={() => setCur((f) => ({ ...f, [active]: { ...f[active], rot: !f[active].rot } }))}>
                      {cur[active].rot ? "волокно вертикально" : "волокно горизонтально"}
                    </button>
                  </div>
                </>
              )}
            </section>
            <section>
              <div className="label">Стены</div>
              <div className="row">
                {WALLS.map((w) => (
                  <button key={w.id} title={w.name} className={cur.wall === w.id ? "dot on" : "dot"} style={{ background: w.hex }} onClick={() => setCur((f) => ({ ...f, wall: w.id }))} />
                ))}
              </div>
              {cur.splash.code && <button className="link" onClick={() => setCur((f) => ({ ...f, splash: { ...f.splash, code: null } }))}>Фартук — как стена</button>}
            </section>
            <section>
              <div className="row top0">
                <button className="btn" onClick={screenshot}>Скриншот</button>
                <button className="btn" onClick={() => navigator.clipboard?.writeText(location.href)}>Ссылка</button>
                <button className={specOpen ? "btn on" : "btn"} onClick={() => setSpecOpen((o) => !o)}>Спецификация</button>
              </div>
              {specOpen && (
                <div className="spec">
                  {spec.map((g) => (
                    <div key={g.key} className="spec-g">
                      <div className="between"><span>{g.label}</span><span className="muted">{g.area.toFixed(2)} м²</span></div>
                      <div className="muted small">{g.decor}</div>
                      {g.list.map((r) => (
                        <div key={r.size} className="between small top0"><span>{r.size} мм × {r.n}</span><span>{r.area.toFixed(2)} м²</span></div>
                      ))}
                    </div>
                  ))}
                  <button className="btn wide dark" onClick={() => downloadCsv(spec)}>Скачать CSV</button>
                </div>
              )}
            </section>
          </>
        )}
        <section className="muted small foot">Повернуть — тянуть · масштаб — щипок или колёсико · сдвиг — двумя пальцами</section>
      </aside>
    </div>
  );
}
