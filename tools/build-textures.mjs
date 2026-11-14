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

// ---------- AGT: лист 2800×1220, рельефа нет, поверхность из raw/agt-finishes.json ----------
const AGT_SHEET = [2800, 1220];
const PX_PER_MM = 4096 / AGT_SHEET[0];
const FIN_ROUGH = { hg: 0.12, metal: 0.35, supramat: 0.92, supermatt: 0.9, softtouch: 0.85, matt: 0.6, naturaltouch: 0.7 };

async function median(file) {
  const { data, info } = await sharp(file).removeAlpha().resize(200, 200, { fit: "fill" })
    .extract({ left: 30, top: 30, width: 140, height: 140 }).raw().toBuffer({ resolveWithObject: true });
  const ch = [[], [], []];
  for (let i = 0; i < data.length; i += info.channels) for (let k = 0; k < 3; k++) ch[k].push(data[i + k]);
  return ch.map((a) => a.sort((x, y) => x - y)[a.length >> 1]);
}

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// фрагмент → без запечённого градиента → масштаб в мм → зеркальная раскладка на весь лист
async function patternSheet(file, fragW) {
  const tw = Math.max(64, Math.round(fragW * PX_PER_MM));
  const { data, info } = await sharp(file).removeAlpha().toColourspace("srgb").resize({ width: tw })
    .raw().toBuffer({ resolveWithObject: true });
  // освещение = сильно размытая копия; размываем уменьшенную, так в десятки раз быстрее
  const sw = Math.max(16, Math.round(info.width / 16)), sh = Math.max(8, Math.round(info.height / 16));
  const small = await sharp(data, { raw: info }).resize(sw, sh, { fit: "fill" }).blur(Math.max(1, sw / 6)).png().toBuffer();
  const blur = await sharp(small).resize(info.width, info.height, { fit: "fill", kernel: "cubic" }).raw().toBuffer();
  const mean = [0, 0, 0];
  for (let i = 0; i < data.length; i += 3) for (let k = 0; k < 3; k++) mean[k] += data[i + k];
  const n = data.length / 3;
  for (let k = 0; k < 3; k++) mean[k] /= n;
  for (let i = 0; i < data.length; i += 3)
    for (let k = 0; k < 3; k++) data[i + k] = Math.min(255, Math.round(data[i + k] * mean[k] / Math.max(1, blur[i + k])));
  const tile = () => sharp(data, { raw: info }).png();
  const [a, b, c, d] = await Promise.all([
    tile().toBuffer(), sharp(data, { raw: info }).flop().png().toBuffer(),
    sharp(data, { raw: info }).flip().png().toBuffer(), sharp(data, { raw: info }).flip().flop().png().toBuffer(),
  ]);
  const W = info.width, H = info.height;
  const quad = await sharp({ create: { width: W * 2, height: H * 2, channels: 3, background: "#000" } })
    .composite([{ input: a, left: 0, top: 0 }, { input: b, left: W, top: 0 }, { input: c, left: 0, top: H }, { input: d, left: W, top: H }])
    .png().toBuffer();
  const SW = 4096, SH = Math.round(4096 * AGT_SHEET[1] / AGT_SHEET[0]);
  const qw = Math.min(W * 2, SW), qh = Math.min(H * 2, SH);
  const piece = qw < W * 2 || qh < H * 2 ? await sharp(quad).extract({ left: 0, top: 0, width: qw, height: qh }).png().toBuffer() : quad;
  return sharp({ create: { width: SW, height: SH, channels: 3, background: "#000" } })
    .composite([{ input: piece, tile: true, left: 0, top: 0 }]).png().toBuffer();
}

{
  const fin = JSON.parse(fs.readFileSync(path.join(RAW, "agt-finishes.json"), "utf8"));
  for (const [code, f] of Object.entries(fin)) {
    if (only && code !== only) continue;
    const id = `agt-${code}`;
    const src = path.join(RAW, "agt", f.file);
    const dir = path.join(OUT, id);
    fs.mkdirSync(dir, { recursive: true });
    const rel = (x) => `tex/${id}/${x}`;
    const stamp = path.join(dir, "c1.webp");
    const cfg = JSON.stringify([f.kind, f.fragW, f.useHex, f.hex]);
    const cfgFile = path.join(RAW, ".agt-cache", `${id}.cfg`);
    fs.mkdirSync(path.dirname(cfgFile), { recursive: true });
    const stale = force || !fs.existsSync(stamp) || fs.statSync(stamp).mtimeMs < fs.statSync(src).mtimeMs
      || !fs.existsSync(cfgFile) || fs.readFileSync(cfgFile, "utf8") !== cfg;
    let rgb = null;
    if (f.kind === "flat") {
      rgb = f.useHex && f.hex ? hexRgb(f.hex) : await median(src);
      if (stale) {
        const solid = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } });
        for (const x of ["c4", "c2", "c1"]) await solid(64, 28).webp({ quality: 95 }).toFile(path.join(dir, `${x}.webp`));
        await solid(256, 256).webp({ quality: 90 }).toFile(path.join(dir, "card.webp"));
      }
    } else if (stale) {
      const sheet = await patternSheet(src, f.fragW);
      await sharp(sheet).webp({ quality: 88 }).toFile(path.join(dir, "c4.webp"));
      await sharp(sheet).resize({ width: 2048 }).webp({ quality: 82 }).toFile(path.join(dir, "c2.webp"));
      await sharp(sheet).resize({ width: 1024 }).webp({ quality: 78 }).toFile(path.join(dir, "c1.webp"));
      await sharp(sheet).extract({ left: 0, top: 0, width: 1200, height: 1200 }).resize(256, 256).webp({ quality: 78 }).toFile(path.join(dir, "card.webp"));
    }
    fs.writeFileSync(cfgFile, cfg);
    decors.push({
      code: id,
      name: `${code} ${f.name}`,
      supplier: "AGT",
      sheet: AGT_SHEET,
      card: rel("card.webp"),
      color: { max: rel("c4.webp"), hi: rel("c2.webp"), lo: rel("c1.webp") },
      relief: null,
      finish: f.finish,
      roughness: FIN_ROUGH[f.finish] ?? 0.6,
      ...(f.check ? { check: true } : {}),
    });
    process.stdout.write("·");
  }
}

if (!only) {
  fs.mkdirSync(path.dirname(CATALOG), { recursive: true });
  fs.writeFileSync(CATALOG, JSON.stringify(decors));
}
console.log(`\n${decors.length} декоров`);
