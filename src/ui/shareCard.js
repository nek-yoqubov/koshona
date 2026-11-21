import qrcode from "qrcode-generator";

export const CONTACT = "Худжанд, ул. К. Худжанди, 6";
export const PHONE = "+992 92 000 0005";
const ORANGE = "#e8621a";
const INK = "#17181a";
const GREY = "#6b6e73";

const loadImg = (src) => new Promise((ok, bad) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = bad;
  i.src = src;
});

export function shortUrl(href) {
  const [head, hash = ""] = href.split("#");
  const h = new URLSearchParams(hash);
  const drop = { m: "day", r: "11100", w: "warm", g: "clear.black", b_r: "11100", b_w: "warm", b_g: "clear.black" };
  for (const [k, v] of Object.entries(drop)) if (h.get(k) === v) h.delete(k);
  return head + "#" + h.toString().replace(/%7E/gi, "~");
}

export function drawQr(ctx, text, x, y, size, mark) {
  const qr = qrcode(0, "Q");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount(), q = 2, cell = size / (n + q * 2);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = INK;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) ctx.fillRect(Math.floor(x + (c + q) * cell), Math.floor(y + (r + q) * cell), Math.ceil(cell), Math.ceil(cell));
  if (mark) {
    const m = size * 0.22, p = m * 0.14;
    const mx = x + (size - m) / 2, my = y + (size - m) / 2;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(mx - p, my - p, m + 2 * p, m + 2 * p, p * 1.5);
    ctx.fill();
    ctx.drawImage(mark, mx, my, m, m);
  }
}

const fit = (ctx, s, w) => {
  if (ctx.measureText(s).width <= w) return s;
  while (s.length > 1 && ctx.measureText(s + "…").width > w) s = s.slice(0, -1);
  return s.trimEnd() + "…";
};

const cover = (ctx, img, x, y, w, h, r) => {
  const k = Math.max(w / img.width, h / img.height);
  const sw = w / k, sh = h / k;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  ctx.restore();
};

export async function makeCard({ shot, url, rows, base }) {
  const sample = "Ваша кухня ВЕРХНИЕ ФАСАДЫ Наведите камеру 0123456789 +";
  await Promise.all(["400 40px Manrope", "500 24px Manrope", "700 24px Manrope"].map((f) => document.fonts?.load(f, sample).catch(() => {})));
  const [kitchen, logo, mark] = await Promise.all([loadImg(shot), loadImg(base + "brand/logo.png"), loadImg(base + "brand/mark.png")]);

  const W = 2000, H = 1414, M = 64;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  const LW = 1300, IH = Math.round(LW / 1.6);
  cover(ctx, kitchen, M, M, LW, IH, 18);

  ctx.textBaseline = "alphabetic";
  let y = M + IH + 76;
  ctx.fillStyle = INK;
  ctx.font = "400 46px Manrope, sans-serif";
  ctx.fillText("Ваша кухня", M, y);
  y += 30;
  const colW = (LW - 40) / 2;
  rows.forEach((r, i) => {
    const cx = M + (i % 2) * (colW + 40), cy = y + Math.floor(i / 2) * 118;
    ctx.fillStyle = ORANGE;
    ctx.font = "700 19px Manrope, sans-serif";
    ctx.fillText(r.label.toUpperCase(), cx, cy + 34);
    ctx.fillStyle = INK;
    ctx.font = "500 30px Manrope, sans-serif";
    ctx.fillText(fit(ctx, r.name, colW), cx, cy + 74);
    ctx.fillStyle = GREY;
    ctx.font = "500 22px Manrope, sans-serif";
    ctx.fillText(fit(ctx, r.sub, colW), cx, cy + 104);
  });

  const RX = M + LW + 72, RW = W - RX - M;
  ctx.fillStyle = "#f6f4f1";
  ctx.beginPath();
  ctx.roundRect(RX - 36, M, RW + 36, H - 2 * M, 18);
  ctx.fill();
  const lw = RW - 40, lh = (lw * logo.height) / logo.width;
  ctx.drawImage(logo, RX + (RW - 36 - lw) / 2, M + 50, lw, lh);

  const qs = RW - 60, qx = RX + (RW - 36 - qs) / 2, qy = M + 50 + lh + 60;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.08)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(qx - 14, qy - 14, qs + 28, qs + 28, 16);
  ctx.fill();
  ctx.restore();
  drawQr(ctx, shortUrl(url), qx, qy, qs, mark);

  const tc = RX + (RW - 36) / 2;
  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = "700 26px Manrope, sans-serif";
  ctx.fillText("Наведите камеру телефона", tc, qy + qs + 72);
  ctx.fillStyle = GREY;
  ctx.font = "500 22px Manrope, sans-serif";
  ctx.fillText("кухня откроется в 3D — её можно", tc, qy + qs + 108);
  ctx.fillText("крутить и менять декоры", tc, qy + qs + 138);

  ctx.fillStyle = INK;
  ctx.font = "700 30px Manrope, sans-serif";
  ctx.fillText(PHONE, tc, H - M - 88);
  ctx.fillStyle = GREY;
  ctx.font = "500 24px Manrope, sans-serif";
  ctx.fillText(CONTACT, tc, H - M - 48);
  ctx.textAlign = "left";

  return cv;
}
