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

const P = {
  cube: <><path d="M12 2l9 5v10l-9 5-9-5V7z" /><path d="M12 22V12M21 7l-9 5-9-5" /></>,
  front: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M12 5v14" /></>,
  zoom: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5M11 8v6M8 11h6" /></>,
  door: <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M15 12h.01" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  ab: <><path d="M12 3v18" /><path d="M4 7h5M4 12h5M15 7h5M15 12h5" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h3v3" /></>,
  chevL: <path d="M15 6l-6 6 6 6" />, chevR: <path d="M9 6l6 6-6 6" />, chevU: <path d="M6 15l6-6 6 6" />, chevD: <path d="M6 9l6 6 6-6" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  sliders: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></>,
  swap: <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />,
};

export function Ico({ name, size = 20 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {P[name]}
    </svg>
  );
}
