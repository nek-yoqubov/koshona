const CODE = /(^|\s)((?:[A-ZА-Я]{1,3}\.?)?\d[0-9A-Za-z.]*(?:\s*\([^)]*\))?(?:\s+(?:S?T|PE|SM|BS|SU|PR|PW|SN|RW|PN|CA|UR)\s*\d*)*)(?=\s|$)/i;

export function splitName(raw = "") {
  const s = raw.replace(/\s*ЛДСП.*$/i, "").replace(/(\d)ЛДСП.*$/i, "$1").trim();
  const m = s.match(CODE);
  if (!m) return { name: s, code: "" };
  const code = m[2].replace(/(\d)S\s+T(\d+)/, "$1 ST$2").replace(/\bS\s*T\s*(\d+)/gi, "ST$1").replace(/^Н/, "H").trim();
  let name = (s.slice(0, m.index) + " " + s.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim();
  if (!name || name === code) name = code === s ? "" : name;
  name = name.charAt(0).toUpperCase() + name.slice(1);
  return { name, code };
}

export const cleanName = (raw) => {
  const { name, code } = splitName(raw);
  return [name, code].filter(Boolean).join(" ");
};
