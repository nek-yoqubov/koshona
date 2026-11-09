const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round" };

export function ItemIcon({ it }) {
  if (it.kind === "tall") {
    const split = it.tall === "oven" ? 26 : it.tall === "fridge" ? 20 : 23;
    return (
      <svg width="30" height="46" viewBox="0 0 30 46">
        <rect x="5" y="2" width="20" height="42" {...S} />
        <line x1="5" y1={split} x2="25" y2={split} {...S} />
        {it.tall === "oven" && <rect x="8" y="14" width="14" height="9" {...S} />}
      </svg>
    );
  }
  const base = { doors: [], drawers: [33, 38], sink: [], hob: [33, 38] }[it.base];
  return (
    <svg width="30" height="46" viewBox="0 0 30 46">
      {it.upper !== "none" && (
        <>
          <rect x="3" y="2" width="24" height="15" {...S} />
          {it.upper === "glass" && <rect x="6" y="5" width="18" height="9" {...S} strokeDasharray="2 2" />}
          {it.upper === "hood" && <path d="M10 17 L12 10 L18 10 L20 17" {...S} />}
          {it.upper === "doors" && <line x1="15" y1="2" x2="15" y2="17" {...S} />}
        </>
      )}
      <rect x="3" y="27" width="24" height="17" {...S} />
      {base.map((y) => <line key={y} x1="3" y1={y} x2="27" y2={y} {...S} />)}
      {it.base !== "drawers" && it.base !== "hob" && <line x1="15" y1="27" x2="15" y2="44" {...S} />}
      {it.base === "sink" && <path d="M10 24 L10 21 L14 21" {...S} />}
      {it.base === "hob" && <line x1="8" y1="25" x2="22" y2="25" {...S} strokeWidth="2.5" />}
    </svg>
  );
}

export function ShapeIcon({ shape, island }) {
  return (
    <svg width="44" height="34" viewBox="0 0 44 34">
      <rect x={shape === "left" ? 4 : shape === "right" ? 10 : 7} y="4" width="30" height="7" fill="currentColor" />
      {shape === "left" && <rect x="4" y="4" width="7" height="24" fill="currentColor" />}
      {shape === "right" && <rect x="33" y="4" width="7" height="24" fill="currentColor" />}
      {island && <rect x="15" y="21" width="14" height="7" fill="currentColor" opacity="0.6" />}
    </svg>
  );
}
