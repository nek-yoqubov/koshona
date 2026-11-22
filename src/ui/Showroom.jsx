import { useRef } from "react";
import { Ico } from "./icons.jsx";
import { splitName } from "./names.js";

const GLOSS = ["hg", "akrilux", "hgmetal", "hgpearl", "metal"];

// Режим «Шоурум»: кухня на весь экран, снизу крупно название декора и полоса образцов.
export default function Showroom({ groups, active, setActive, list, brands = [], brand, onBrand, logos = {}, cats = [], cat, onCat, shines = [], shine, onShine, current, finishOf, base, onPick, views, onView, open, onOpen, light, onLight, compare, onCompare, onShare, onEdit }) {
  const strip = useRef(null);
  const scroll = (dir) => strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.8, behavior: "smooth" });
  const label = groups.find((g) => g.key === active)?.label ?? "";
  const { name: nm, code } = splitName(current?.name);
  const name = nm || code || "—";
  const fin = finishOf(current);

  return (
    <>
      <div className="sr-actions">
        {views.map(([id, l, ic]) => (
          <button key={id} className="sr-round" aria-label={l} title={l} onClick={() => onView(id)}><Ico name={ic} size={19} /></button>
        ))}
        <button className={open ? "sr-round on" : "sr-round"} aria-label="Открыть фасады" title="Открыть фасады" onClick={onOpen}><Ico name="door" size={19} /></button>
        <button className="sr-round" aria-label={light === "day" ? "Вечер" : "День"} title={light === "day" ? "Вечер" : "День"} onClick={onLight}><Ico name={light === "day" ? "moon" : "sun"} size={19} /></button>
        <button className={compare ? "sr-round on" : "sr-round"} aria-label="Сравнить A / B" title="Сравнить A / B" onClick={onCompare}><Ico name="ab" size={19} /></button>
        <button className="sr-round accent" aria-label="Поделиться" title="Поделиться" onClick={onShare}><Ico name="qr" size={19} /></button>
      </div>

      <div className="sr-bottom">
        <div className="sr-head">
          <div className="sr-title fade" key={current?.code}>
            <div className="sr-kicker">{label}{current && (logos[current.supplier] ? <span className="sr-klogo"><img src={base + "brand/sup/" + logos[current.supplier]} alt={current.supplier} /></span> : ` · ${current.supplier}`)}{fin ? ` · ${fin}` : ""}</div>
            <div className="sr-name">{name} {nm && <span>{code}</span>}</div>
          </div>
          <div className="sr-groups">
            {groups.map((g) => (
              <button key={g.key} className={active === g.key ? "on" : ""} onClick={() => setActive(g.key)}>{g.label}</button>
            ))}
            <button className="sr-edit" onClick={onEdit}><Ico name="sliders" size={16} />Настроить</button>
          </div>
        </div>
        <div className="sr-brands">
          {cats.map(([k, l]) => <button key={k} className={cat === k ? "on f" : "f"} onClick={() => onCat(k)}>{l}</button>)}
          <span className="sr-sep" />
          {shines.map(([k, l]) => <button key={k} className={shine === k ? "on f" : "f"} onClick={() => onShine(k)}>{l}</button>)}
          <span className="sr-sep" />
          <button className={!brand ? "on" : ""} onClick={() => onBrand(null)}>Все</button>
          {brands.map((b) => (
            <button key={b.name} className={(brand === b.name ? "on " : "") + (logos[b.name] ? "logo" : "")} onClick={() => onBrand(b.name)} aria-label={b.name}>
              {logos[b.name] ? <img src={base + "brand/sup/" + logos[b.name]} alt="" /> : b.name} <small>{b.n}</small>
            </button>
          ))}
        </div>
        <div className="sr-strip-wrap">
          <button className="sr-nav" aria-label="Назад" onClick={() => scroll(-1)}><Ico name="chevL" size={22} /></button>
          <div className="sr-strip fade-x" ref={strip} key={active + (brand || "") + (cat || "") + (shine || "")}>
            {!list.length && <span className="sr-empty">Нет декоров с такими фильтрами</span>}
            {list.map((d) => (
              <button key={d.code} title={d.name} aria-label={d.name} className={(current?.code === d.code ? "sr-sw on" : "sr-sw") + (GLOSS.includes(d.finish) ? " gloss" : "")} onClick={() => onPick(d.code)}>
                <img src={base + d.card} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          <button className="sr-nav" aria-label="Вперёд" onClick={() => scroll(1)}><Ico name="chevR" size={22} /></button>
        </div>
      </div>
    </>
  );
}
