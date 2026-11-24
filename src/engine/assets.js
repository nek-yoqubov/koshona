import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Официальные модели фурнитуры Blum (tools/build-hardware.py). ASSETS[файл][деталь] = геометрия.
// Пока файл не загружен, движок рисует упрощённую замену и перестраивает сцену после загрузки.
export const ASSETS = {};
const FILES = { hkTop: "hk_top", frontFix: "front_fix", clipTop: "clip_top", hsTop: "hs_top", hfTop: "hf_top", hlTop: "hl_top" };

let promise = null;
export function loadAssets(base) {
  if (promise) return promise;
  const loader = new GLTFLoader();
  promise = Promise.all(
    Object.entries(FILES).map(([key, file]) =>
      loader.loadAsync(`${base}models/${file}.glb`).then((g) => {
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
      }).catch(() => {}),
    ),
  );
  return promise;
}
