import * as THREE from "three";

const FALLBACK = "#a39c93";
const base = import.meta.env.BASE_URL;

export function createTextures(renderer, onLoad) {
  const loader = new THREE.TextureLoader();
  const cache = new Map();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  return (url, { srgb = false, repeat = null } = {}) => {
    const key = url + (repeat ? `@${repeat}` : "");
    if (cache.has(key)) return cache.get(key);
    const t = loader.load(base + url, onLoad);
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    cache.set(key, t);
    return t;
  };
}

// Поверхности плит (AGT). hg — плёнка ≥80 GU: лаковый слой с отражением на любом уровне качества.
export const FINISHES = {
  hg: { label: "Глянец", roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03 },
  akrilux: { label: "Глянец Akrilux", roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 },
  hgmetal: { label: "Глянец металлик", roughness: 0.5, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 },
  mattmetal: { label: "Мат металлик", roughness: 0.6, metalness: 0.4 },
  hgpearl: { label: "Глянец перламутр", roughness: 0.4, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 },
  mattpearl: { label: "Мат перламутр", roughness: 0.65, metalness: 0.2 },
  textured: { label: "Мат с тиснением", roughness: 0.75 },
  metal: { label: "Металлик", roughness: 0.35, metalness: 0.6, clearcoat: 0.5, clearcoatRoughness: 0.12 },
  supramat: { label: "Супермат", roughness: 0.92 },
  supermatt: { label: "Супермат", roughness: 0.9 },
  softtouch: { label: "Soft Touch", roughness: 0.85 },
  naturaltouch: { label: "Natural Touch", roughness: 0.7 },
  matt: { label: "Мат", roughness: 0.6 },
};

export function createGroupMaterials() {
  const std = (color, roughness = 0.5) => new THREE.MeshPhysicalMaterial({ color, roughness });
  return {
    upper: std(FALLBACK),
    lower: std(FALLBACK),
    body: std("#d8d4cc", 0.6),
    splash: std("#ebe6de", 0.6),
    top: std("#e8e3da", 0.45),
  };
}

export function applyDecor(mat, decor, level, tex, fallbackHex) {
  mat.map = null;
  mat.normalMap = null;
  mat.roughnessMap = null;
  if (!decor) {
    mat.color.set(fallbackHex || FALLBACK);
    mat.roughness = 0.6;
    if ("clearcoat" in mat) { mat.metalness = 0; mat.clearcoat = 0; }
  } else {
    mat.color.set(0xffffff);
    mat.map = tex(decor.color[level.texture], { srgb: true });
    mat.roughness = decor.roughness;
    const f = FINISHES[decor.finish];
    if ("clearcoat" in mat) {
      mat.metalness = f?.metalness ?? 0;
      mat.clearcoat = f?.clearcoat ?? 0;
      mat.clearcoatRoughness = f?.clearcoatRoughness ?? 0;
    }
    if (level.relief && decor.relief) {
      const r = decor.relief;
      mat.normalMap = tex(level.reliefMax ? r.normalMax : r.normal, { repeat: r.repeat });
      mat.roughnessMap = tex(level.reliefMax ? r.roughMax : r.rough, { repeat: r.repeat });
      mat.normalScale.set(0.6, 0.6);
    }
  }
  mat.needsUpdate = true;
}

export function frontUV(mesh, sheet, vertical) {
  const { w, h, ox, oy } = mesh.userData;
  const uv0 = mesh.geometry.userData.uv0 || (mesh.geometry.userData.uv0 = mesh.geometry.attributes.uv.array.slice());
  const [sheetW, sheetH] = sheet;
  const W = w * 1000, H = h * 1000;
  let vert = vertical;
  let su = vert ? H / sheetW : W / sheetW;
  let sv = vert ? W / sheetH : H / sheetH;
  if (su > 1 || sv > 1) {
    const su2 = vert ? W / sheetW : H / sheetW, sv2 = vert ? H / sheetH : W / sheetH;
    if (su2 <= 1 && sv2 <= 1) { vert = !vert; su = su2; sv = sv2; }
    else { const k = Math.max(su, sv); su /= k; sv /= k; }
  }
  const out = new Float32Array(uv0.length);
  for (let i = 0; i < uv0.length; i += 2) {
    const u = uv0[i], v = uv0[i + 1];
    if (vert) { out[i] = ox * (1 - su) + v * su; out[i + 1] = oy * (1 - sv) + u * sv; }
    else { out[i] = ox * (1 - su) + u * su; out[i + 1] = oy * (1 - sv) + v * sv; }
  }
  return new THREE.BufferAttribute(out, 2);
}

// Раскрой: детали группы раскладываются по листу (рядами, пропил 4 мм), как на пиле.
// У каждой детали свой кусок листа; кончился лист — следующий, отражённый, чтобы рисунок не повторялся.
// Ящики одной тумбы (userData.stack) режутся одной полосой подряд — рисунок идёт сквозь них.
export function sheetLayout(meshes, sheet, vertical) {
  const [L, S] = sheet, KERF = 4;
  const pieces = [];
  const stacks = new Map();
  for (const m of meshes) {
    const { w, h, stack, sy } = m.userData;
    const W = w * 1000, H = h * 1000;
    if (stack != null) {
      let p = stacks.get(stack);
      if (!p) { p = { W, H: 0, parts: [] }; stacks.set(stack, p); pieces.push(p); }
      p.parts.push({ m, W, H, sy });
      p.H = Math.max(p.H, sy + H);
    } else pieces.push({ W, H, parts: [{ m, W, H, sy: 0 }] });
  }
  const out = new Map();
  let x = 0, y = 0, row = 0, idx = 0;
  for (const p of pieces) {
    let vert = vertical;
    let a = vert ? p.H : p.W, b = vert ? p.W : p.H;
    if ((a > L || b > S) && b <= L && a <= S) { vert = !vert; [a, b] = [b, a]; }
    const k = Math.max(1, a / L, b / S);
    a /= k; b /= k;
    if (x + a > L) { x = 0; y += row + KERF; row = 0; }
    if (y + b > S) { x = 0; y = 0; row = 0; idx++; }
    const fu = idx % 2 === 1, fv = idx % 4 >= 2;
    for (const q of p.parts) {
      const uv0 = q.m.geometry.userData.uv0 || (q.m.geometry.userData.uv0 = q.m.geometry.attributes.uv.array.slice());
      const qa = (vert ? q.H : q.W) / k, qb = (vert ? q.W : q.H) / k, off = q.sy / k;
      const ox = vert ? x + off : x, oy = vert ? y : y + off;
      const arr = new Float32Array(uv0.length);
      for (let i = 0; i < uv0.length; i += 2) {
        const u = uv0[i], v = uv0[i + 1];
        let su = vert ? (ox + v * qa) / L : (ox + u * qa) / L;
        let sv = vert ? (oy + (1 - u) * qb) / S : (oy + v * qb) / S;
        if (fu) su = 1 - su;
        if (fv) sv = 1 - sv;
        arr[i] = su;
        arr[i + 1] = sv;
      }
      out.set(q.m, new THREE.BufferAttribute(arr, 2));
    }
    x += a + KERF;
    row = Math.max(row, b);
  }
  return out;
}
