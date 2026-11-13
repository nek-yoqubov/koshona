import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW = path.join(ROOT, "raw");
const OUT = path.join(ROOT, "public", "tex");
const CATALOG = path.join(ROOT, "public", "catalog", "decors.json");

const SUPPLIERS = [
  { id: "egger", name: "EGGER", list: "egger.json", dir: "egger", reliefRotated: true },
];

const force = process.argv.includes("--force");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

const fresh = (src, dst) =>
  !force && fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs;

async function color(src, dst, width, quality) {
  if (fresh(src, dst)) return;
  await sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality }).toFile(dst);
}

async function card(src, dst) {
  if (fresh(src, dst)) return;
  await sharp(src).resize(256, 256, { fit: "cover" }).webp({ quality: 78 }).toFile(dst);
}

async function roughness(src, dst, rotate, max) {
  if (fresh(src, dst)) return;
  let img = sharp(src).greyscale();
  if (rotate) img = img.rotate(-90);
  await img.resize({ width: max, height: max, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toFile(dst);
}

async function normal(src, dst, rotate, max) {
  if (fresh(src, dst)) return;
  let img = sharp(src).removeAlpha().toColourspace("srgb");
  if (rotate) img = img.rotate(-90);
  const { data, info } = await img
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (rotate) {
    const c = info.channels;
    for (let i = 0; i < data.length; i += c) {
      const r = data[i], g = data[i + 1];
      data[i] = 255 - g;
      data[i + 1] = r;
    }
  }
  await sharp(data, { raw: info }).webp({ quality: 92 }).toFile(dst);
}

const decors = [];
for (const sup of SUPPLIERS) {
  const list = JSON.parse(fs.readFileSync(path.join(RAW, sup.list), "utf8"));
  for (const d of list) {
    if (only && d.code !== only) continue;
    const t = d.textures;
    if (!t?.sheet) continue;
    const src = (p) => path.join(RAW, sup.dir, p.replace(/^\/decors\//, ""));
    const dir = path.join(OUT, d.code);
    fs.mkdirSync(dir, { recursive: true });
    const rel = (f) => `tex/${d.code}/${f}`;

    await color(src(t.sheet), path.join(dir, "c4.webp"), 4096, 88);
    await color(src(t.sheet), path.join(dir, "c2.webp"), 2048, 82);
    await color(src(t.sheet), path.join(dir, "c1.webp"), 1024, 78);
    await card(d.photo?.card ? src(d.photo.card) : src(t.sheet), path.join(dir, "card.webp"));

    let relief = null;
    if (t.normal && t.roughness) {
      await normal(src(t.normal), path.join(dir, "n.webp"), sup.reliefRotated, 1024);
      await roughness(src(t.roughness), path.join(dir, "r.webp"), sup.reliefRotated, 1024);
      await normal(src(t.normal), path.join(dir, "n4.webp"), sup.reliefRotated, 4096);
      await roughness(src(t.roughness), path.join(dir, "r4.webp"), sup.reliefRotated, 4096);
      const [tu, tv] = t.tiling || [1, 1];
      const meta = await sharp(src(t.normal)).metadata();
      const [sw, sh] = [t.sheetW || 2800, t.sheetH || 1300];
      const squareTile = meta.width === meta.height && tu === tv;
      relief = {
        normal: rel("n.webp"),
        rough: rel("r.webp"),
        normalMax: rel("n4.webp"),
        roughMax: rel("r4.webp"),
        repeat: squareTile ? [+(tu * sw / sh).toFixed(3), tu] : sup.reliefRotated ? [tv, tu] : [tu, tv],
      };
    }

    decors.push({
      code: d.code,
      name: d.name,
      supplier: sup.name,
      sheet: [t.sheetW || 2800, t.sheetH || 1300],
      card: rel("card.webp"),
      color: { max: rel("c4.webp"), hi: rel("c2.webp"), lo: rel("c1.webp") },
      relief,
      roughness: t.roughnessValue ?? 0.6,
    });
    process.stdout.write(".");
  }
}

if (!only) {
  fs.mkdirSync(path.dirname(CATALOG), { recursive: true });
  fs.writeFileSync(CATALOG, JSON.stringify(decors));
}
console.log(`\n${decors.length} декоров`);
