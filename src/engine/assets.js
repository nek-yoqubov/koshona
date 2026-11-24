import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Официальные модели фурнитуры Blum (tools/build-hardware.py). ASSETS[файл][деталь] = геометрия.
// Пока файл не загружен, движок рисует упрощённую замену и перестраивает сцену после загрузки.
export const ASSETS = {};
const FILES = { hkTop: "hk_top", frontFix: "front_fix", clipTop: "clip_top", hsTop: "hs_top", hfTop: "hf_top", hlTop: "hl_top", hksTop: "hks_top" };

// Грузим только те модели, которые нужны текущей кухне. Возвращает true, если загрузилось что-то новое.
const pending = {};
const loader = new GLTFLoader();
export function loadAssets(base, keys) {
  const todo = keys.filter((key) => FILES[key] && !ASSETS[key]);
  return Promise.all(
    todo.map((key) => (pending[key] ||= loader.loadAsync(`${base}models/${FILES[key]}.glb`).then((g) => {
      const parts = {};
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        const src = o.geometry.clone().applyMatrix4(o.matrixWorld);
        const geo = src.attributes.normal ? src : toCreasedNormals(src, 0.6);
        geo.userData.shared = true;
        parts[o.name] = geo;
      });
      ASSETS[key] = parts;
    }).catch(() => {}))),
  ).then(() => todo.length > 0);
}
