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
import { ItemIcon, ShapeIcon, Ico } from "./icons.jsx";
import Showroom from "./Showroom.jsx";
import ItemEditor from "./ItemEditor.jsx";
import CompareHandle from "./CompareHandle.jsx";
import SampleView from "./SampleView.jsx";
import ShareModal from "./ShareModal.jsx";
import HotSpots from "./HotSpots.jsx";
import { cleanName, splitName } from "./names.js";
import { TOUR, TOUR_IDLE, TOUR_STEP, TOUR_RESET } from "../catalog/tour.js";

const base = import.meta.env.BASE_URL;
const GLOSSY = ["hg", "akrilux", "hgmetal", "hgpearl", "metal"];
const CATS = [["wood", "Дерево"], ["stone", "Камень"], ["plain", "Однотон"], ["other", "Другое"]];
const SHINES = [["matt", "Мат"], ["gloss", "Глянец"]];
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
  const [supplier, setSupplier] = useState(null);
  const [cat, setCat] = useState(null);
  const [shine, setShine] = useState(null);
  const [light, setLight] = useState(fromUrl.light === "night" ? "night" : "day");
  const [specOpen, setSpecOpen] = useState(false);
  const [sample, setSample] = useState(null);
  const [parts, setParts] = useState([]);
  const [mode, setMode] = useState(() => (localStorage.getItem("koshona.mode") === "showroom" ? "showroom" : "editor"));
  const [panelOpen, setPanelOpen] = useState(true);
  const [barOpen, setBarOpen] = useState(true);
  const [gearOpen, setGearOpen] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [touring, setTouring] = useState(false);
  const [tourIdx, setTourIdx] = useState(0);
  const lastAct = useRef(Date.now());
  const tourRef = useRef(null);
  const initRef = useRef(null);
  useEffect(() => { try { localStorage.setItem("koshona.mode", mode); } catch {} }, [mode]);

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
    Promise.all([fetch(base + "catalog/decors.json").then((r) => r.json()), fetch(base + "catalog/cats.json").then((r) => r.json()).catch(() => ({}))])
      .then(([list, cats]) => {
        for (const d of list) d.cat = cats[d.code] || "plain";
        setDecors(list);
        const fill = (f) => {
          const g = { ...emptyFinish(), ...structuredClone(f) };
          const fronts = list.filter((d) => d.kind !== "top");
          for (const k of ["upper", "lower", "body"]) if (!fronts.some((d) => d.code === g[k].code)) g[k].code = fronts[0]?.code ?? null;
          if (g.splash.code && !list.some((d) => d.code === g.splash.code)) g.splash.code = null;
          if (g.top.code && !list.some((d) => d.code === g.top.code && d.kind === "top")) g.top.code = null;
          return g;
        };
        setFin((f) => {
          const next = { A: fill(f.A), B: fill(f.B) };
          initRef.current ||= { fin: structuredClone(next), model: decodeModel(fromUrl.layout) || TEMPLATES[0].make() };
          return next;
        });
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
  useEffect(() => {
    if (!v) return;
    const calc = () => {
      if (touring) { v.setInset(0, 140, 0); return; }
      const W = window.innerWidth, H = window.innerHeight;
      let r = 0, b = 0;
      const item = W <= 800 && document.querySelector(".float");
      const side = !item && document.querySelector(".side");
      if (item) b = Math.round(H - item.getBoundingClientRect().top);
      if (side) {
        const rc = side.getBoundingClientRect();
        if (W > 800) r = Math.round(W - rc.left + 12); else b = Math.round(H - rc.top);
      }
      const head = document.querySelector(".sr-head");
      if (head) b = Math.round(H - head.getBoundingClientRect().top + 8);
      let t = 0;
      document.querySelectorAll(".topright, .viewbar, .sr-actions").forEach((e) => { t = Math.max(t, Math.round(e.getBoundingClientRect().bottom)); });
      v.setInset(r, b, t);
    };
    calc();
    const ro = new ResizeObserver(calc);
    document.querySelectorAll(".side, .sr-bottom, .float").forEach((e) => ro.observe(e));
    window.addEventListener("resize", calc);
    return () => { ro.disconnect(); window.removeEventListener("resize", calc); };
  }, [viewerId, mode, panelOpen, selected, sample, touring]);
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

  const tours = useMemo(() => {
    const has = new Set(decors.map((d) => d.code));
    return TOUR.filter((t) => ["upper", "lower", "body", "top"].every((k) => has.has(t[k]))).map((t) => {
      const f = emptyFinish();
      for (const k of ["upper", "lower", "body", "top"]) f[k] = { ...f[k], code: t[k] };
      f.wall = t.wall;
      return f;
    });
  }, [decors]);
  const startTour = () => {
    if (!v || !tours.length || tourRef.current) return;
    tourRef.current = { fin, model, compare, open, start: Date.now() };
    setCompare(false);
    setOpen(false);
    setSelected(null);
    setGearOpen(false);
    setTourIdx(0);
    setFin({ A: tours[0], B: tours[0] });
    setTouring(true);
    v.setTour(true);
  };
  const stopTour = () => {
    const t = tourRef.current;
    if (!t) return;
    tourRef.current = null;
    lastAct.current = Date.now();
    v?.setTour(false);
    setTouring(false);
    const back = Date.now() - t.start > TOUR_RESET && initRef.current ? { ...initRef.current, compare: false } : t;
    setModelRaw(back.model);
    setFin(structuredClone(back.fin));
    setCompare(back.compare);
  };
  useEffect(() => {
    const act = () => { lastAct.current = Date.now(); };
    const evs = ["pointerdown", "keydown", "wheel"];
    evs.forEach((e) => window.addEventListener(e, act, true));
    return () => evs.forEach((e) => window.removeEventListener(e, act, true));
  }, []);
  const idleCheck = useRef(null);
  idleCheck.current = () => {
    if (!touring && mode === "showroom" && !shareData && !sample && Date.now() - lastAct.current > TOUR_IDLE) startTour();
  };
  useEffect(() => {
    const id = setInterval(() => idleCheck.current(), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!touring) return;
    const id = setInterval(() => setTourIdx((i) => {
      const n = (i + 1) % tours.length;
      setFin({ A: tours[n], B: tours[n] });
      return n;
    }), TOUR_STEP);
    return () => clearInterval(id);
  }, [touring, tours]);

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

  const pool = useMemo(() => decors.filter((d) => (active === "top") === (d.kind === "top")
    && (!cat || d.cat === cat)
    && (!shine || (shine === "gloss") === GLOSSY.includes(d.finish))), [decors, active, cat, shine]);
  const brands = useMemo(() => {
    const m = new Map();
    for (const d of pool) {
      if (!m.has(d.supplier)) m.set(d.supplier, []);
      m.get(d.supplier).push(d);
    }
    return [...m].map(([name, list]) => ({ name, n: list.length, prev: list.slice(0, 4) })).sort((a, b) => b.n - a.n);
  }, [pool]);
  const suppliers = brands.map((b) => b.name);
  const finishOf = (d) => FINISHES[d?.finish]?.label ?? "";
  const sup = suppliers.includes(supplier) ? supplier : supplier === "Все" ? "Все" : null;
  const filtered = pool.filter((d) => (!sup || sup === "Все" || d.supplier === sup) && `${d.name} ${finishOf(d)}`.toLowerCase().includes(search.toLowerCase()));
  const curBrand = decors.find((d) => d.code === cur[active]?.code)?.supplier;
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

  const views = [["overall", "Общий", "cube"], ["fronts", "Фасады", "front"], ["closeup", "Крупно", "zoom"]];
  const decorOf = (code) => decors.find((d) => d.code === code);
  const share = () => {
    if (!v) return;
    const rows = GROUPS.map((g) => {
      const d = decorOf(fin.A[g.key]?.code);
      if (!d) return g.key === "splash" ? { label: g.label, name: "В цвет стены", sub: (WALLS.find((w) => w.id === fin.A.wall) || WALLS[0]).name } : null;
      return { label: g.label, name: cleanName(d.name), sub: [d.supplier, finishOf(d)].filter(Boolean).join(" · ") };
    }).filter(Boolean);
    setShareData({ shot: v.snapshot(), url: location.href, rows });
  };

  return (
    <div className={"app mode-" + mode + (mode === "editor" && sel && !sample ? " has-item" : "") + (touring ? " touring" : "")}>
      <div className="stage">
        <div ref={mountRef} className="canvas" />
        {(mode === "showroom" || tab === "finish") && !open && (
          <HotSpots viewer={v} groups={GROUPS} active={active} onPick={(k) => { setActive(k); if (mode === "editor") { setTab("finish"); setPanelOpen(true); } }} />
        )}
        {compare && <CompareHandle split={split} onChange={setSplit} labelA={shortName(fin.A)} labelB={shortName(fin.B)} editing={editing} onEdit={setEditing} />}

        <div className="brand glass">
          <img src={base + "brand/logo.png"} alt="PRO MEBEL — лучшее для вдохновения" />
        </div>

        <div className="topright">
          {mode === "editor" && (
            <button className="sharebtn" onClick={share} title="Карточка с QR-кодом"><Ico name="qr" size={20} />Поделиться</button>
          )}
          <div className="modes glass">
            <button className={mode === "showroom" ? "on" : ""} onClick={() => setMode("showroom")}>Шоурум</button>
            <button className={mode === "editor" ? "on" : ""} onClick={() => setMode("editor")}>Конструктор</button>
          </div>
        </div>

        {mode === "editor" && (barOpen ? (
          <div className="viewbar glass">
            {views.map(([id, l, ic]) => (
              <button key={id} className="vb" onClick={() => v?.setView(id)}><Ico name={ic} size={18} />{l}</button>
            ))}
            <span className="vsep" />
            <button className={open ? "vb on" : "vb"} onClick={() => setOpen((o) => !o)}><Ico name="door" size={18} />{open ? "Закрыть" : "Открыть"}</button>
            <button className="vb" onClick={() => setLight((l) => (l === "day" ? "night" : "day"))}><Ico name={light === "day" ? "moon" : "sun"} size={18} />{light === "day" ? "Вечер" : "День"}</button>
            <button className={compare ? "vb on" : "vb"} onClick={toggleCompare}><Ico name="ab" size={18} />A / B</button>
            <button className="vb icon" aria-label="Скрыть панель вида" onClick={() => setBarOpen(false)}><Ico name="chevU" size={18} /></button>
          </div>
        ) : (
          <button className="tabtop glass" onClick={() => setBarOpen(true)}><Ico name="chevD" size={16} />Вид</button>
        ))}

        <div className="gear">
          <button className="gear-b glass" aria-label="Качество картинки" onClick={() => setGearOpen((o) => !o)}><Ico name="gear" size={18} /></button>
          {gearOpen && (
            <div className="gear-p glass">
              <span className="fps">{stats.active ? `${stats.fps} fps` : "пауза"}</span>
              <button className="q" onClick={startTour}>Тур ▶</button>
              {["auto", "low", "mid", "high"].map((id) => {
                const on = id === "auto" ? quality.auto : !quality.auto && quality.level === id;
                return (
                  <button key={id} className={on ? "q on" : "q"} onClick={() => pickLevel(id)}>
                    {id === "auto" ? `Авто · ${LEVELS[quality.level].label.toLowerCase()}` : LEVELS[id].label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {mode === "showroom" && (
          <Showroom
            groups={GROUPS}
            active={active}
            setActive={setActive}
            list={filtered}
            brands={brands}
            brand={sup && sup !== "Все" ? sup : null}
            onBrand={(b) => setSupplier(b)}
            cats={CATS}
            cat={cat}
            onCat={(k) => setCat(cat === k ? null : k)}
            shines={SHINES}
            shine={shine}
            onShine={(k) => setShine(shine === k ? null : k)}
            current={decorOf(cur[active]?.code)}
            finishOf={finishOf}
            base={base}
            onPick={(code) => setCur((f) => ({ ...f, [active]: { ...f[active], code } }))}
            views={views}
            onView={(id) => v?.setView(id)}
            open={open}
            onOpen={() => setOpen((o) => !o)}
            light={light}
            onLight={() => setLight((l) => (l === "day" ? "night" : "day"))}
            compare={compare}
            onCompare={toggleCompare}
            onShare={share}
            onEdit={() => setMode("editor")}
          />
        )}

        {touring && (
          <div className="tour-ov" onPointerDown={(e) => { e.preventDefault(); stopTour(); }}>
            <div className="tour-cap" key={tourIdx}>
              {["upper", "lower", "top"].map((k) => {
                const d = decorOf(tours[tourIdx]?.[k]?.code);
                const n = d && splitName(d.name);
                return d ? <div key={k}><small>{GROUPS.find((g) => g.key === k).label}</small><b>{n.name} <span>{n.code}</span></b></div> : null;
              })}
            </div>
            <div className="tour-hint">Коснитесь экрана, чтобы подобрать свою кухню</div>
          </div>
        )}
        {shareData && <ShareModal {...shareData} base={base} onClose={() => setShareData(null)} />}

        {sample && (
          <SampleView
            list={filtered.length ? filtered : decors}
            code={sample}
            onNav={(c) => { setSample(c); setCur((f) => ({ ...f, [active]: { ...f[active], code: c } })); }}
            onClose={() => setSample(null)}
          />
        )}

        {mode === "editor" && sel && !sample && (
          <div className="float">
            <ItemEditor {...editorProps} />
          </div>
        )}

        {mode === "editor" && (panelOpen ? (
          <aside className="side glass">
            <button className="side-tab" aria-label="Скрыть панель" onClick={() => setPanelOpen(false)}><Ico name="chevR" size={16} /></button>
            <div className="side-in">
          <div className="steps">
            <button className={tab === "layout" ? "step on" : "step"} onClick={() => setTab("layout")}><i>1</i>Компоновка</button>
            <button className={tab === "finish" ? "step on" : "step"} onClick={() => setTab("finish")}><i>2</i>Отделка</button>
          </div>

          {tab === "layout" ? (
            <div className="fade" key="layout">
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
            </div>
          ) : (
            <div className="fade" key="finish">
              <section>
                {compare && (
                  <div className="editing">
                    <span>Правите</span>
                    {["A", "B"].map((s) => (
                      <button key={s} className={editing === s ? "on" : ""} onClick={() => setEditing(s)}>Вариант {s}</button>
                    ))}
                  </div>
                )}
                <div className="gtabs">
                  {[...GROUPS, { key: "glass", label: "Витрины" }].map((g) => (
                    <button key={g.key} className={active === g.key ? "on" : ""} onClick={() => setActive(g.key)}>{g.label.replace(" фасады", "")}</button>
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
                    <input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Найти — дуб, серый, H305…" />
                    <div className="fchips">
                      {CATS.map(([k, l]) => <button key={k} className={cat === k ? "on" : ""} onClick={() => setCat(cat === k ? null : k)}>{l}</button>)}
                      {SHINES.map(([k, l]) => <button key={k} className={shine === k ? "on" : ""} onClick={() => setShine(shine === k ? null : k)}>{l}</button>)}
                    </div>
                    {!sup && !search ? (
                      <div className="brands fade" key={"b" + active + cat + shine}>
                        {brands.map((b) => (
                          <button key={b.name} className={b.name === curBrand ? "brand-c on" : "brand-c"} onClick={() => setSupplier(b.name)}>
                            <span className="brand-sw">{b.prev.map((d) => <i key={d.code} style={{ backgroundImage: `url(${base + d.card})` }} />)}</span>
                            <b>{b.name}</b>
                            <small>{b.n} декоров{b.name === curBrand ? " · выбран" : ""}</small>
                          </button>
                        ))}
                        <button className="brand-c all" onClick={() => setSupplier("Все")}><b>Все декоры</b><small>{pool.length} шт.</small></button>
                      </div>
                    ) : (
                      <>
                        <div className="filters">
                          <button className="back" onClick={() => { setSupplier(null); setSearch(""); }}><Ico name="chevL" size={16} />Все бренды</button>
                          <span className="muted small">{sup && sup !== "Все" ? sup + " · " : ""}{filtered.length} декоров</span>
                        </div>
                        <div className="grid fade" key={"g" + active + sup + cat + shine}>
                          {filtered.map((d) => (
                            <button key={d.code} title={finishOf(d) ? `${d.name} · ${finishOf(d)}` : d.name} className={(cur[active].code === d.code ? "sw on" : "sw") + (["hg", "akrilux", "hgmetal", "hgpearl", "metal"].includes(d.finish) ? " gloss" : "")} style={{ backgroundImage: `url(${base + d.card})` }}
                              onClick={() => setCur((f) => ({ ...f, [active]: { ...f[active], code: d.code } }))} />
                          ))}
                        </div>
                      </>
                    )}
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
            </div>
          )}
              <section className="muted small foot">Повернуть — тянуть · масштаб — щипок или колёсико · сдвиг — двумя пальцами</section>
            </div>
          </aside>
        ) : (
          <button className="tabside glass" onClick={() => setPanelOpen(true)}><Ico name="chevL" size={16} /><span>Отделка</span></button>
        ))}
      </div>
    </div>
  );
}
