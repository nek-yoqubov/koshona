import { useEffect, useState } from "react";

export default function HotSpots({ viewer, groups, active, onPick }) {
  const [pts, setPts] = useState([]);
  useEffect(() => {
    if (!viewer) return;
    viewer.onAnchors(setPts);
    return () => viewer.onAnchors(null);
  }, [viewer]);
  return (
    <div className="hs">
      {pts.filter((p) => p.on).map((p) => {
        const i = groups.findIndex((g) => g.key === p.key);
        if (i < 0) return null;
        const on = active === p.key;
        return (
          <button key={p.key} className={on ? "hs-b on" : "hs-b"} style={{ left: p.x, top: p.y }} onClick={() => onPick(p.key)} aria-label={groups[i].label}>
            <i>{i + 1}</i>
            <span>{groups[i].label}</span>
          </button>
        );
      })}
    </div>
  );
}
