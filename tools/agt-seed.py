# Одноразово: черновик raw/agt-finishes.json (дальше правится руками)
import csv, json, os, sys
from PIL import Image
R = os.path.join(os.path.dirname(__file__), "..", "raw")
rows = list(csv.DictReader(open(f"{R}/agt.csv", encoding="utf-8-sig")))
info = json.load(open(f"{R}/agt/info.json"))
HG = "600 601 603 604 605 608 612 615 620 623 627 640 645 647 653 670 678 679 680 681 685 686 699 878 6002 6007 6008 6013 6015 6016 6017 6018 6019 6020 6021 6022 394 395".split()
SUPRA = [str(c) for c in list(range(3010, 3030)) + list(range(3091, 3098)) if c not in (3014, 3024, 3028)]
SOFT = "723 726 728 729 730 732 734 735 736 737 738 739 740".split()
MATT = "378 379 383 384 385 387 390 391 393 399 727 733 3005 3008 3009 3030 3031 3032 3049 3051 3056 3057 3058 3060 3063 3064 3081 3076".split()
METAL = "300 396 687 688 689 3107 3111 3112 3113 6005".split()
SUPER = "398 3001 3006".split()
GUESS = {  # нет точных данных — предположение, проверить по образцу
  **{c: "hg" for c in "602 622 633 654 661 662 663 664 667 674 675 676 677 6003 6004 6023 6024 6025 6026".split()},
  **{c: "matt" for c in "386 388 389 3037 3039 3040 3041 3042 3074 3075 3077 3078 3079 3080 3098 3099 3103 3104 3105 3106 3109".split()},
  "3110": "metal",
}
PATTERN = set("3006 3008 674 608 3005 679 681 3009 675 664 603 663 391 3075 390 3080 661 662 640 3032 3107 3064 3098 6003 397 395 3057 680 653 393 602 6005 3063 389 654 3058 677 3056 3099 3079 633 3077 3041 379 686 3042 604 3039 627 3076 388 3037 378 685 3103 3104 6007 3078 737 3060 3040 6019 6018 3074 3111 3112 3113".split())
PHOTO = {"3001", "3081", "394"}  # на картинке интерьер, не декор
out = {}
for r in rows:
    c = r["Артикул (SKU)"].strip()
    if not c.isdigit() or c in out:
        continue
    i = info.get(c)
    if not i:
        continue
    fin = ("hg" if c in HG else "supramat" if c in SUPRA else "softtouch" if c in SOFT else "matt" if c in MATT
           else "metal" if c in METAL else "supermatt" if c in SUPER else "naturaltouch" if c == "397" else GUESS.get(c, "matt"))
    w, h = Image.open(f"{R}/agt/{i['file']}").size
    if i["src"] == "agtwood.com":
        frag = 1000
    elif max(w, h) > 3000:
        frag = round(w * 1220 / min(w, h))
    else:
        frag = w
    kind = "pattern" if c in PATTERN and c not in PHOTO else "flat"
    out[c] = {
        "name": r["Название"].strip(), "hex": r["Цвет"].strip(), "file": i["file"],
        "finish": fin, "check": c in GUESS or c in PHOTO, "kind": kind,
        "fragW": frag if kind == "pattern" else None,
        "useHex": c in PHOTO,
    }
json.dump(out, open(f"{R}/agt-finishes.json", "w"), ensure_ascii=False, indent=1)
from collections import Counter
print(len(out), Counter(v["finish"] for v in out.values()), Counter(v["kind"] for v in out.values()), sum(v["check"] for v in out.values()))
