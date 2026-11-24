import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Настоящие модели фурнитуры (Blum, 3D Warehouse), упрощённые и приведённые к своей системе координат.
// Пока модели не загружены, движок рисует упрощённую замену.
export const ASSETS = {};
const LIST = { hkBody: "hk_body", hkArm: "hk_arm" };

let promise = null;
export function loadAssets(base) {
  if (promise) return promise;
  const loader = new GLTFLoader();
  promise = Promise.all(
    Object.entries(LIST).map(([key, file]) =>
      loader.loadAsync(`${base}models/${file}.glb`).then((g) => {
        let geo = null;
        g.scene.traverse((o) => { if (o.isMesh && !geo) geo = o.geometry; });
        geo.userData.shared = true;
        geo.computeVertexNormals();
        ASSETS[key] = geo;
      }).catch(() => {}),
    ),
  );
  return promise;
}
