import { GROUPS } from "../catalog/layouts.js";

export function buildSpec(parts, finish, decors) {
  return GROUPS.map((g) => {
    const rows = {};
    for (const p of parts.filter((x) => x.group === g.key)) {
      const k = `${p.w}×${p.h}`;
      rows[k] = rows[k] || { size: k, n: 0, area: 0 };
      rows[k].n += 1;
      rows[k].area += (p.w * p.h) / 1e6;
    }
    const list = Object.values(rows).sort((a, b) => b.area - a.area);
    const d = decors.find((x) => x.code === finish[g.key].code);
    return {
      key: g.key,
      label: g.label,
      decor: d ? d.name : g.key === "splash" ? "как стена" : "—",
      list,
      area: list.reduce((s, r) => s + r.area, 0),
    };
  }).filter((g) => g.area > 0);
}

export function downloadCsv(spec) {
  const rows = [["Группа", "Декор", "Размер, мм", "Кол-во", "Площадь, м²"]];
  spec.forEach((g) => g.list.forEach((r) => rows.push([g.label, g.decor, r.size, r.n, r.area.toFixed(3)])));
  spec.forEach((g) => rows.push([g.label, g.decor, "итого", "", g.area.toFixed(3)]));
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
  a.download = "specification.csv";
  a.click();
}
