import { useEffect, useMemo, useRef, useState } from "react";
import { createViewer } from "../engine/viewer.js";
import { LEVELS, savedLevel, saveLevel, guessLevel, pickByFps } from "../engine/quality.js";
import { LAYOUTS, WALLS, GROUPS } from "../catalog/layouts.js";
import { emptyFinish, readHash, writeHash } from "./hash.js";
import { buildSpec, downloadCsv } from "./spec.js";
import CompareHandle from "./CompareHandle.jsx";
import { GLASS, FRAMES } from "../catalog/glass.js";

const base = import.meta.env.BASE_URL;
const wallHex = (id) => (WALLS.find((w) => w.id === id) || WALLS[0]).hex;
const toViewer = (f) => ({ ...f, wallHex: wallHex(f.wall) });
const fromUrl = readHash();

export default function App() {
  const mountRef = useRef(null);
  const viewerRef = useRef(null);
  const [viewerId, setViewerId] = useState(0);

  const [quality, setQuality] = useState(() => {
    const s = savedLevel();
    return { level: s || guessLevel(), auto: !s, tested: !!s };
  });
  const [stats, setStats] = useState({ fps: 0, active: false });

  const [decors, setDecors] = useState([]);
  const [layoutId, setLayoutId] = useState(LAYOUTS.some((l) => l.id === fromUrl.layout) ? fromUrl.layout : LAYOUTS[0].id);
  const [fin, setFin] = useState({ A: fromUrl.A || emptyFinish(), B: fromUrl.B || fromUrl.A || emptyFinish() });
  const [compare, setCompare] = useState(!!fromUrl.B);
  const [split, setSplit] = useState(0.5);
  const [editing, setEditing] = useState("A");
  const [active, setActive] = useState("lower");
  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState("Все");
  const [light, setLight] = useState(fromUrl.light === "night" ? "night" : "day");
  const [specOpen, setSpecOpen] = useState(false);
  const [parts, setParts] = useState([]);

  useEffect(() => {
    fetch(base + "catalog/decors.json")
      .then((r) => r.json())
      .then((list) => {
        setDecors(list);
        const first = (i) => list[i % list.length]?.code ?? null;
        const fill = (f) => {
          const g = { ...emptyFinish(), ...structuredClone(f) };
          for (const k of ["upper", "lower", "body"]) if (!list.some((d) => d.code === g[k].code)) g[k].code = first(0);
          if (g.splash.code && !list.some((d) => d.code === g.splash.code)) g.splash.code = null;
          return g;
        };
        setFin((f) => ({ A: fill(f.A), B: fill(f.B) }));
      });
  }, []);

  useEffect(() => {
    const v = createViewer(mountRef.current, quality.level, setStats);
    viewerRef.current = v;
    setViewerId((n) => n + 1);
    return () => v.dispose();
  }, [quality.level]);

  const v = viewerRef.current;
  const layout = LAYOUTS.find((l) => l.id === layoutId);

  useEffect(() => {
    if (!v) return;
    v.setLayout(layout);
    setParts(v.parts);
  }, [viewerId, layout]);
  useEffect(() => { v?.setDecors(decors); }, [viewerId, decors]);
  useEffect(() => { v?.setFinish("A", toViewer(fin.A)); }, [viewerId, fin.A, decors]);
  useEffect(() => { v?.setFinish("B", toViewer(fin.B)); }, [viewerId, fin.B, decors]);
  useEffect(() => { v?.setCompare(compare); }, [viewerId, compare]);
  useEffect(() => { v?.setSplit(split); }, [viewerId, split]);
  useEffect(() => { v?.setLight(light); }, [viewerId, light]);

  useEffect(() => {
    if (!v || quality.tested || !decors.length) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const fps = await v.benchmark(2500);
      if (cancelled) return;
      setQuality((q) => ({ ...q, level: pickByFps(q.level, fps), tested: true }));
    }, 1500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [viewerId, quality.tested, decors.length]);

  useEffect(() => {
    if (fin.A.lower.code) writeHash({ layout: layoutId, light, A: fin.A, B: fin.B, compare });
  }, [layoutId, light, fin, compare]);

  const pickLevel = (id) => {
    if (id === "auto") {
      saveLevel(null);
      setQuality({ level: guessLevel(), auto: true, tested: false });
    } else {
      saveLevel(id);
      setQuality({ level: id, auto: false, tested: true });
    }
  };

  const side = compare ? editing : "A";
  const cur = fin[side];
  const setCur = (fn) => setFin((f) => ({ ...f, [side]: fn(f[side]) }));

  const toggleCompare = () => {
    if (!compare) setFin((f) => ({ ...f, B: structuredClone(f.A) }));
    setEditing(compare ? "A" : "B");
    setCompare(!compare);
  };

  const suppliers = useMemo(() => ["Все", ...new Set(decors.map((d) => d.supplier))], [decors]);
  const filtered = decors.filter(
    (d) => (supplier === "Все" || d.supplier === supplier) && d.name.toLowerCase().includes(search.toLowerCase())
  );
  const nameOf = (code) => decors.find((d) => d.code === code)?.name ?? "—";
  const shortName = (f) => nameOf(f.lower.code).replace(/\s+\S+\s+\S+$/, "");
  const spec = useMemo(() => buildSpec(parts, fin.A, decors), [parts, fin.A, decors]);

  const screenshot = () => {
    const a = document.createElement("a");
    a.href = v.screenshot();
    a.download = `kitchen_${fin.A.lower.code || "decor"}.png`;
    a.click();
  };

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
      </div>

      <aside className="side">
        <section>
          <div className="title">Кухня</div>
          <div className="muted">{decors.length ? `${decors.length} декоров` : "загрузка…"}</div>
          <div className="row">
            {LAYOUTS.map((l) => (
              <button key={l.id} className={l.id === layoutId ? "chip on" : "chip"} onClick={() => setLayoutId(l.id)} title={l.note}>
                {l.name}
              </button>
            ))}
          </div>
          <div className="row">
            {[["overall", "Общий вид"], ["fronts", "Фасады"], ["closeup", "Крупный план"]].map(([id, l]) => (
              <button key={id} className="chip" onClick={() => v?.setView(id)}>{l}</button>
            ))}
          </div>
          <div className="row">
            <button className={compare ? "btn on" : "btn"} onClick={toggleCompare}>{compare ? "Закрыть сравнение" : "Сравнить A / B"}</button>
            <button className="btn" onClick={screenshot}>Скриншот</button>
            <button className="btn" onClick={() => navigator.clipboard?.writeText(location.href)}>Ссылка</button>
            <button className={specOpen ? "btn on" : "btn"} onClick={() => setSpecOpen((o) => !o)}>Спецификация</button>
          </div>
        </section>

        {specOpen && (
          <section className="spec">
            {spec.map((g) => (
              <div key={g.key} className="spec-g">
                <div className="between"><span>{g.label}</span><span className="muted">{g.area.toFixed(2)} м²</span></div>
                <div className="muted small">{g.decor}</div>
                {g.list.map((r) => (
                  <div key={r.size} className="between small"><span>{r.size} мм × {r.n}</span><span>{r.area.toFixed(2)} м²</span></div>
                ))}
              </div>
            ))}
            <button className="btn wide dark" onClick={() => downloadCsv(spec)}>Скачать CSV</button>
          </section>
        )}

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
              <div className="muted small mt">Внутри витрины — цвет корпуса. Подсветка внутри включается в режиме «Вечер».</div>
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
              <button
                key={d.code}
                title={d.name}
                className={cur[active].code === d.code ? "sw on" : "sw"}
                style={{ backgroundImage: `url(${base + d.card})` }}
                onClick={() => setCur((f) => ({ ...f, [active]: { ...f[active], code: d.code } }))}
              />
            ))}
          </div>
          <div className="between">
            <span className="muted pr">{nameOf(cur[active].code)}</span>
            <button
              className={cur[active].rot ? "btn on" : "btn"}
              onClick={() => setCur((f) => ({ ...f, [active]: { ...f[active], rot: !f[active].rot } }))}
            >
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
          {cur.splash.code && (
            <button className="link" onClick={() => setCur((f) => ({ ...f, splash: { ...f.splash, code: null } }))}>Фартук — как стена</button>
          )}
        </section>

        <section>
          <div className="label">Освещение</div>
          <div className="tabs">
            <button className={light === "day" ? "tab on" : "tab"} onClick={() => setLight("day")}>День</button>
            <button className={light === "night" ? "tab on" : "tab"} onClick={() => setLight("night")}>Вечер · лампы</button>
          </div>
        </section>

        <section className="muted small foot">Повернуть — тянуть пальцем или мышью · масштаб — щипок или колёсико · сдвиг — двумя пальцами</section>
      </aside>
    </div>
  );
}
