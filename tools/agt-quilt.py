#!/usr/bin/env python3
"""
Лист AGT 2800×1220 из небольшого фрагмента без зеркального «калейдоскопа».

Метод image quilting (Efros & Freeman, 2001): лист собирается из блоков, вырезанных
из фрагмента; каждый следующий блок выбирается так, чтобы перекрытие с уже уложенным
совпадало лучше всего, а шов идёт по пути минимальной ошибки. Свет фрагмента
предварительно выравнивается (убираем запечённый градиент).

    python3 tools/agt-quilt.py            # все декоры kind=pattern
    python3 tools/agt-quilt.py 3076 6018  # только эти

Результат: raw/agt-sheets/<код>.png (4096 × 1785, волокно вдоль длины листа).
Перезапуск пропускает готовые, если параметры не менялись.
"""
import json, os, sys, hashlib
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
RAW = os.path.join(ROOT, "raw")
OUT = os.path.join(RAW, "agt-sheets")
SW, SH = 4096, round(4096 * 1220 / 2800)
PX_PER_MM = SW / 2800
VERSION = "q5"


def load(f, code):
    src = os.path.join(RAW, f.get("src") or os.path.join("agt", f["file"]))
    im = Image.open(src).convert("RGB")
    w0 = im.width
    if f.get("rotate"):
        im = im.rotate(90, expand=True)
    scale = f["fragW"] * PX_PER_MM / w0
    im = im.resize((max(32, round(im.width * scale)), max(32, round(im.height * scale))), Image.LANCZOS)
    a = np.asarray(im, np.float32)
    s = (min(a.shape[:2]) / f["flat"]) if f.get("flat") else max(a.shape[:2]) / 6
    light = np.stack([gaussian_filter(a[..., k], s, mode="reflect") for k in range(3)], -1)
    mean = a.reshape(-1, 3).mean(0)
    if f.get("colorRef"):
        ref = np.asarray(Image.open(os.path.join(RAW, f["colorRef"])).convert("RGB"), np.float32)
        mean = ref.reshape(-1, 3).mean(0)
    a = np.clip(a / np.maximum(light, 1) * mean, 0, 255)
    return a


def min_cut_vertical(err):
    h, w = err.shape
    cost = err.copy()
    for i in range(1, h):
        prev = cost[i - 1]
        left = np.r_[np.inf, prev[:-1]]
        right = np.r_[prev[1:], np.inf]
        cost[i] += np.minimum(np.minimum(left, prev), right)
    path = np.zeros(h, int)
    path[-1] = int(np.argmin(cost[-1]))
    for i in range(h - 2, -1, -1):
        j = path[i + 1]
        lo, hi = max(0, j - 1), min(w, j + 2)
        path[i] = lo + int(np.argmin(cost[i, lo:hi]))
    mask = np.zeros((h, w), bool)
    for i, j in enumerate(path):
        mask[i, j:] = True
    return mask


def quilt(src, rng, bw, bh, cands=400):
    sh, sw = src.shape[:2]
    bw, bh = min(bw, sw - 2), min(bh, sh - 2)
    ox, oy = max(4, bw // 5), max(4, bh // 5)
    stx, sty = bw - ox, bh - oy
    ny = (SH - oy + sty - 1) // sty
    nx = (SW - ox + stx - 1) // stx
    H, W = ny * sty + oy, nx * stx + ox
    out = np.zeros((H, W, 3), np.float32)
    ys = rng.integers(0, sh - bh + 1, cands * ny * nx)
    xs = rng.integers(0, sw - bw + 1, cands * ny * nx)
    k = 0
    for by in range(ny):
        for bx in range(nx):
            y, x = by * sty, bx * stx
            cy, cx = ys[k:k + cands], xs[k:k + cands]
            k += cands
            if by == 0 and bx == 0:
                out[:bh, :bw] = src[cy[0]:cy[0] + bh, cx[0]:cx[0] + bw]
                continue
            best, be = None, np.inf
            tgt = out[y:y + bh, x:x + bw]
            for i in range(cands):
                p = src[cy[i]:cy[i] + bh, cx[i]:cx[i] + bw]
                e = 0.0
                if bx:
                    e += ((p[:, :ox] - tgt[:, :ox]) ** 2).sum()
                if by:
                    e += ((p[:oy] - tgt[:oy]) ** 2).sum()
                if bx and by:
                    e -= ((p[:oy, :ox] - tgt[:oy, :ox]) ** 2).sum()
                if e < be:
                    be, best = e, p
            patch = best.copy()
            mask = np.ones((bh, bw), bool)
            if bx:
                err = ((best[:, :ox] - tgt[:, :ox]) ** 2).sum(-1)
                mask[:, :ox] &= min_cut_vertical(err)
            if by:
                err = ((best[:oy] - tgt[:oy]) ** 2).sum(-1)
                mask[:oy] &= min_cut_vertical(err.T).T
            m = gaussian_filter(mask.astype(np.float32), 1.5)[..., None]
            out[y:y + bh, x:x + bw] = m * patch + (1 - m) * tgt
    return out[:SH, :SW]


def seamless(a, axis, frac):
    n = a.shape[axis]
    ov = max(8, int(n * frac))
    a = np.moveaxis(a, axis, 0)
    out = a[:n - ov].copy()
    t = np.linspace(0, 1, ov)[:, None, None]
    out[:ov] = t * a[:ov] + (1 - t) * a[n - ov:]
    return np.moveaxis(out, 0, axis)


def grain_sheet(src, rng):
    t = seamless(seamless(src, 1, 0.22), 0, 0.15)
    th, tw = t.shape[:2]
    rows = []
    for _ in range((SH + th - 1) // th):
        row = np.tile(t, (1, (SW + tw - 1) // tw + 1, 1))
        rows.append(np.roll(row, -int(rng.integers(0, tw)), axis=1)[:, :SW])
    return np.concatenate(rows, 0)[:SH]


def main():
    fin = json.load(open(os.path.join(RAW, "agt-finishes.json"), encoding="utf-8"))
    only = set(sys.argv[1:])
    os.makedirs(OUT, exist_ok=True)
    for code, f in fin.items():
        if f["kind"] != "pattern" or (only and code not in only):
            continue
        key = hashlib.md5(json.dumps([VERSION, f.get("src"), f["file"], f["fragW"], f.get("rotate"), f.get("colorRef"), f.get("block"), f.get("grain"), f.get("flat")]).encode()).hexdigest()[:10]
        dst = os.path.join(OUT, code + ".png")
        stamp = os.path.join(OUT, code + ".key")
        if os.path.exists(dst) and os.path.exists(stamp) and open(stamp).read() == key:
            continue
        src = load(f, code)
        sh, sw = src.shape[:2]
        if sw >= SW and sh >= SH:
            res = src[:SH, :SW]
        else:
            rng = np.random.default_rng(int(code))
            if f.get("grain"):
                res = grain_sheet(src, rng)
            else:
                bw = bh = max(48, f["block"] if f.get("block") else min(int(min(sh, sw) * 0.45), 360))
                res = quilt(src, rng, bw, bh)
        Image.fromarray(res.clip(0, 255).astype(np.uint8)).save(dst, optimize=False)
        open(stamp, "w").write(key)
        print(code, f"фрагмент {sw}x{sh} -> лист", flush=True)


if __name__ == "__main__":
    main()
