# Стены и фартук: текстуры ambientCG (CC0, 1024 px) → public/tex/s-<id>/ и public/catalog/surfaces.json
# size — сколько миллиметров стены покрывает одна картинка; tint — красится в цвет стены
import json, os
import numpy as np
from PIL import Image

RAW, OUT = "raw/surfaces", "public/tex"
S = [
    ("Plaster001", "wall", "Штукатурка гладкая", 2000, True, "plain"),
    ("Plaster003", "wall", "Штукатурка фактурная", 1500, True, "plain"),
    ("PaintedPlaster017", "wall", "Декоративная штукатурка", 2000, True, "plain"),
    ("Wallpaper001A", "wall", "Обои фактурные", 800, True, "plain"),
    ("Wallpaper002A", "wall", "Обои фактурные крупные", 800, True, "plain"),
    ("Concrete034", "wall", "Микроцемент светлый", 1100, False, "stone"),
    ("Concrete016", "wall", "Микроцемент серый", 2000, False, "stone"),
    ("Concrete046", "wall", "Бетон тёплый", 2400, False, "stone"),
    ("Concrete032", "wall", "Бетон тёмный", 2000, False, "stone"),
    ("Bricks060", "wall", "Кирпич белый крашеный", 1050, False, "stone"),
    ("Bricks020", "wall", "Кирпич коричневый", 1100, False, "stone"),
    ("Bricks085", "wall", "Кирпич красный старый", 2400, False, "stone"),
    ("Tiles136A", "splash", "Кабанчик белый 75×150", 1050, False, "plain"),
    ("Tiles008", "splash", "Кабанчик бежевый 100×200", 800, False, "plain"),
    ("Tiles029", "splash", "Кабанчик бирюзовый 75×150", 900, False, "plain"),
    ("Tiles032", "splash", "Кабанчик зелёный 75×150", 900, False, "plain"),
    ("Tiles133A", "splash", "Плитка белая 100×100", 1000, False, "plain"),
    ("Tiles009", "splash", "Плитка белая под мрамор", 1200, False, "stone"),
    ("Tiles106", "splash", "Плитка чёрная глянцевая", 1000, False, "plain"),
    ("Tiles071", "splash", "Шестигранник белый", 450, False, "plain"),
    ("Tiles072", "splash", "Шестигранник тёмный", 450, False, "plain"),
    ("Tiles054", "splash", "Керамогранит под белый мрамор", 1800, False, "stone"),
    ("Tiles052", "splash", "Керамогранит под тёмный мрамор", 1500, False, "stone"),
    ("Tiles043", "splash", "Терраццо", 1200, False, "stone"),
    ("Tiles101", "splash", "Пэчворк сине-белый", 1000, False, "other"),
]
GLASS = [("glass-white", "Стекло белое", "#f2f1ec"), ("glass-black", "Стекло чёрное", "#121314"), ("glass-sage", "Стекло шалфей", "#a7b2a0")]

out = []
for aid, kind, name, size, tint, cat in S:
    code = "s-" + aid
    d = os.path.join(OUT, code)
    os.makedirs(d, exist_ok=True)
    c = Image.open(f"{RAW}/{aid}_c.jpg").convert("RGB")
    n = Image.open(f"{RAW}/{aid}_n.jpg").convert("RGB")
    r = Image.open(f"{RAW}/{aid}_r.jpg").convert("L")
    c.save(f"{d}/c.webp", quality=86)
    c.resize((512, 512), Image.LANCZOS).save(f"{d}/c1.webp", quality=82)
    n.save(f"{d}/n.webp", quality=90)
    r.save(f"{d}/r.webp", quality=88)
    side = int(1024 * min(1, 600 / size))
    c.crop((0, 0, side, side)).resize((256, 256), Image.LANCZOS).save(f"{d}/card.webp", quality=84)
    rough = float(np.asarray(r).mean() / 255)
    rel = f"tex/{code}/"
    out.append({"code": code, "name": name, "supplier": "Плитка" if kind == "splash" else "Стены", "kind": kind, "cat": cat,
                "tile": size, "tint": tint, "card": rel + "card.webp",
                "color": {"max": rel + "c.webp", "hi": rel + "c.webp", "lo": rel + "c1.webp"},
                "relief": {"normal": rel + "n.webp", "rough": rel + "r.webp", "normalMax": rel + "n.webp", "roughMax": rel + "r.webp", "repeat": [1, 1]},
                "roughness": round(rough, 3), "source": "ambientCG " + aid + " (CC0)"})
for code, name, hexc in GLASS:
    d = os.path.join(OUT, "s-" + code)
    os.makedirs(d, exist_ok=True)
    rgb = tuple(int(hexc[i:i + 2], 16) for i in (1, 3, 5))
    card = Image.new("RGB", (256, 256), rgb)
    g = np.asarray(card).astype(float)
    yy, xx = np.mgrid[0:256, 0:256]
    g += (np.clip(1 - (xx + yy) / 300, 0, 1) ** 2 * 70)[..., None]
    Image.fromarray(np.clip(g, 0, 255).astype(np.uint8)).save(f"{d}/card.webp", quality=88)
    out.append({"code": "s-" + code, "name": name, "supplier": "Стекло", "kind": "splash", "cat": "plain", "hex": hexc,
                "finish": "hg", "card": f"tex/s-{code}/card.webp", "roughness": 0.05})
json.dump(out, open("public/catalog/surfaces.json", "w"), ensure_ascii=False, indent=1)
print(len(out), "поверхностей")
