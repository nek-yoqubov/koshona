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

export function createGroupMaterials() {
  const std = (color, roughness = 0.5) => new THREE.MeshStandardMaterial({ color, roughness });
  return {
    upper: std(FALLBACK),
    lower: std(FALLBACK),
    body: std("#d8d4cc", 0.6),
    splash: std("#ebe6de", 0.6),
  };
}

export function applyDecor(mat, decor, level, tex, fallbackHex) {
  mat.map = null;
  mat.normalMap = null;
  mat.roughnessMap = null;
  if (!decor) {
    mat.color.set(fallbackHex || FALLBACK);
    mat.roughness = 0.6;
  } else {
    mat.color.set(0xffffff);
    mat.map = tex(decor.color[level.texture], { srgb: true });
    mat.roughness = decor.roughness;
    if (level.relief && decor.relief) {
      mat.normalMap = tex(decor.relief.normal, { repeat: decor.relief.repeat });
      mat.roughnessMap = tex(decor.relief.rough, { repeat: decor.relief.repeat });
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
