#!/usr/bin/env python3
"""Фурнитура Blum из официальных моделей (3D Warehouse, Blum USA, Collada) -> public/models/*.glb.
Детали остаются отдельными (для кинематики), вершины свариваются, нормали считает движок (с изломом по углу).
Исходники лежат в raw/hardware (в репозиторий не выкладываются — чужие файлы):
  *.dae — модели Blum USA с 3D Warehouse; antarion/*.fr3d — библиотека Blum для Базиса от Antarion.
Запуск: python3 -I tools/build-hardware.py
"""
import os, sys, numpy as np, trimesh
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bazis

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, "raw/hardware"), os.path.join(ROOT, "public/models")

def load(name):
    s = trimesh.load(os.path.join(SRC, name + ".dae"), force="scene")
    out = {}
    for node in s.graph.nodes_geometry:
        if node.endswith(("_1", "_2")):
            continue
        T, g = s.graph[node]
        m = s.geometry[g].copy()
        m.apply_transform(T)
        m.vertices = m.vertices * 25.4  # дюймы -> мм
        out[node] = m
    return out

def group(parts, ids, conv, decimate=None):
    m = trimesh.util.concatenate([parts[i] for i in ids])
    m.vertices = conv(m.vertices) / 1000.0
    m.merge_vertices(digits_vertex=6)
    m.update_faces(m.nondegenerate_faces())
    if decimate and len(m.faces) > decimate:
        m = m.simplify_quadric_decimation(face_count=decimate)
    m.visual = trimesh.visual.ColorVisuals(m)
    return m

def save(name, groups):
    sc = trimesh.Scene()
    n = 0
    for key, m in groups.items():

        sc.add_geometry(m, node_name=key, geom_name=key)
        n += len(m.faces)
    path = os.path.join(OUT, name + ".glb")
    sc.export(path)
    print(f"{name}: {n} треугольников, {os.path.getsize(path) // 1024} КБ")

os.makedirs(OUT, exist_ok=True)

def fr_left(name):
    out = []
    for m in bazis.meshes(os.path.join(SRC, "antarion", name + ".fr3d")):
        v = m["tris"].reshape(-1, 3)
        if v[:, 0].mean() < 150:
            m["n"], m["cen"] = len(m["tris"]), v.mean(0)
            out.append(m)
    return out

def fr_group(ms):
    v = np.concatenate([m["tris"].reshape(-1, 3) for m in ms]) / 1000.0
    n = np.concatenate([m["nor"].reshape(-1, 3) for m in ms])
    key = np.round(np.c_[v * 1e5, n * 100]).astype(np.int64)
    _, idx, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    mesh = trimesh.Trimesh(vertices=v[idx], faces=inv.reshape(-1, 3), vertex_normals=n[idx], process=False)
    mesh.visual = trimesh.visual.ColorVisuals(mesh)
    return mesh

def fr_parts(name):
    out = []
    for m in bazis.meshes(os.path.join(SRC, "antarion", name + ".fr3d")):
        lab = bazis.components(m["tris"])
        for c in range(lab.max() + 1):
            sel = lab == c
            v = m["tris"][sel].reshape(-1, 3)
            out.append(dict(tris=m["tris"][sel], nor=m["nor"][sel], mat=m["mat"], n=int(sel.sum()), lo=v.min(0), hi=v.max(0)))
    return out

def rebase(ms, px, py):
    out = []
    for m in ms:
        t, n = m["tris"], m["nor"]
        out.append(dict(tris=np.stack([t[..., 2], t[..., 1] - py, -(t[..., 0] - px)], -1), nor=np.stack([n[..., 2], n[..., 1], -n[..., 0]], -1)))
    return out

def hk_cover():
    # заглушка HK top из комплекта Antarion (начало — торец боковины и низ крышки) -> в систему модели Blum
    ms = [m for m in fr_parts("hk_caps") if (m["lo"][0] + m["hi"][0]) / 2 < 150]
    for m in ms:
        m["tris"] = m["tris"] + np.array([0, 36.45, 37.05])
    return fr_group(ms)


# AVENTOS HK top 22K2300. Система механизма: X — от боковины внутрь, Y — вверх, Z — к фасаду (мм модели: x, z, -y)
hk = load("22K2300")
mech = lambda v: np.c_[-v[:, 0], v[:, 2], -v[:, 1]]
save("hk_top", {
    "body": group(hk, ["ID199", "ID207", "ID215", "ID223", "ID239", "ID263", "ID271", "ID231", "ID247", "ID255", "ID279"], mech),
    "leverA": group(hk, ["ID148", "ID132", "ID156", "ID164", "ID172", "ID180", "ID188", "ID140", "ID54", "ID89"], mech),
    "linkB": group(hk, ["ID27", "ID19", "ID7"], mech),
    "linkC": group(hk, ["ID97", "ID105", "ID81", "ID113", "ID121"], mech),
    "linkD": group(hk, ["ID46", "ID70", "ID38"], mech),
    "arm": group(hk, ["ID322", "ID338", "ID402", "ID386", "ID394", "ID346", "ID330", "ID354", "ID362", "ID378", "ID410"], mech),
    "tab": group(hk, ["ID306"], mech),
    "cover": hk_cover(),
})

# Крепление фасада 20S4200: основание на внутренней стороне фасада (y = -38 мм модели), Z — к фасаду
br = load("20S4200")
save("front_fix", {"bracket": group(br, list(br), lambda v: np.c_[-v[:, 0], v[:, 2] - 49.0, -v[:, 1] - 38.0])})

# Петля CLIP top BLUMOTION 110° 73B3550 + планка 173L6100. X — от боковины внутрь, Y — вверх,
# Z — от внутренней плоскости двери (y = -38,5 мм модели): + в дверь, - вглубь корпуса
hg, pl = load("73B3550"), load("173L6100")
hinge = lambda v: np.c_[-v[:, 0], v[:, 2], -(v[:, 1] + 38.5)]
dec = int(sys.argv[1]) if len(sys.argv) > 1 else None
save("clip_top", {
    "cup": group(hg, ["ID128", "ID136", "ID144", "ID152", "ID162", "ID31", "ID170"], hinge, dec),
    "arm": group(hg, ["ID53", "ID20", "ID8", "ID61", "ID69", "ID77"], hinge, dec),
    "plate": group(pl, ["ID19", "ID27", "ID35", "ID5"], hinge),
})


# ---- Библиотека Blum для Базиса (Antarion, .fr3d): сетки с нормалями, координаты шкафа:
# X — от внутренней стороны левой боковины, Y — вверх от внутренней стороны крышки, Z — к фасаду (0 = внутренняя плоскость фасада)
# AVENTOS HS top: корпус, заглушка, два рычага и каретка с креплением фасада
mech, arms, caps = fr_left("hs_mech"), fr_left("hs_arms"), fr_left("hs_caps")
pick = lambda ms, f: [m for m in ms if f(m)]
save("hs_top", {
    "body": fr_group(pick(mech, lambda m: m["mat"] == "grau_220")),
    "bodyDark": fr_group(pick(mech, lambda m: m["mat"] != "grau_220")),
    "cover": fr_group(pick(caps, lambda m: m["mat"] == "grau_220")),
    "logo": fr_group(pick(caps, lambda m: m["mat"] != "grau_220")),
    "lever1": fr_group(pick(arms, lambda m: m["n"] in (1020, 128))),
    "lever2": fr_group(pick(arms, lambda m: m["n"] == 528)),
    "carrier": fr_group(pick(arms, lambda m: m["mat"] in ("grau_220", "__3_dunkelgrau") and m["n"] not in (1020, 128, 528))),
    "tab": fr_group(pick(arms, lambda m: "orange" in m["mat"])),
    "bracket": fr_group(pick(arms, lambda m: m["mat"] == "Noname")),
})


# AVENTOS HF top: одиночные детали (не комплект), у каждой свои координаты: X — вглубь корпуса, Y — вверх, Z — от боковины.
# Корпус, заглушка и внутренняя штанга — относительно оси механизма; труба и головка — относительно оси на нижнем фасаде.
M_AXIS, F_AXIS = (11.07, -159.17), (6.18, -166.41)
mech, arm, cap = fr_parts("hf_mech"), fr_parts("hf_arm"), fr_parts("top_cap")
is_tube = lambda m: m["mat"] != "Noname" and (m["n"] == 652 or m["hi"][1] > -100)
save("hf_top", {
    "body": fr_group(rebase(pick(mech, lambda m: m["mat"] != "grau_220" and m["lo"][1] > -300), *M_AXIS)),
    "cover": fr_group(rebase(pick(cap, lambda m: m["mat"] == "grau_220"), *M_AXIS)),
    "logo": fr_group(rebase(pick(cap, lambda m: m["mat"] != "grau_220"), *M_AXIS)),
    "lever": fr_group(rebase(pick(mech, lambda m: m["mat"] == "grau_220" or m["lo"][1] <= -300), *M_AXIS)),
    "tube": fr_group(rebase(pick(arm, is_tube), *F_AXIS)),
    "head": fr_group(rebase(pick(arm, lambda m: m["mat"] != "Noname" and not is_tube(m)), *F_AXIS)),
})


# AVENTOS HL top (рычаги 35, ВК 340–390): комплекты в координатах шкафа, как у HS top
left = lambda ms: [m for m in ms if (m["lo"][0] + m["hi"][0]) / 2 < 150]
mech, arms = left(fr_parts("hl_mech")), left(fr_parts("hl_arms"))
cy = lambda m: (m["lo"][1] + m["hi"][1]) / 2
save("hl_top", {
    "body": fr_group(pick(mech, lambda m: m["mat"] == "grau_220")),
    "bodyDark": fr_group(pick(mech, lambda m: m["mat"] != "grau_220") + pick(arms, lambda m: m["mat"] == "far-ob_dg")),
    "lever1": fr_group(pick(arms, lambda m: (m["mat"] == "grau_220" and m["n"] > 1200 and m["n"] < 1300) or (m["mat"] == "__3_dunkelgrau" and cy(m) > -150))),
    "lever2": fr_group(pick(arms, lambda m: m["mat"] == "grau_220" and m["n"] > 1400 and m["n"] < 1500)),
    "carrier": fr_group(pick(arms, lambda m: (m["mat"] == "grau_220" and m["n"] not in range(1200, 1500)) or (m["mat"] == "__3_dunkelgrau" and cy(m) <= -150))),
    "bracket": fr_group(pick(arms, lambda m: m["mat"] == "Noname")),
})


# AVENTOS HK-S 20K2E00 — официальная модель Blum (детали отдельно) в координатах шкафа, заглушка — из комплекта Antarion
hks = {k: v for k, v in load("20K2E00").items() if v.vertices[:, 0].mean() < -100}
cab = lambda v: np.c_[v[:, 0] + 166.0, v[:, 2] - 205.0, -v[:, 1] - 41.0]
save("hks_top", {
    "body": group(hks, ["ID131"], cab),
    "crank": group(hks, ["ID667"], cab),
    "coupler": group(hks, ["ID699"], cab),
    "rocker": group(hks, ["ID955"], cab),
    "link": group(hks, ["ID931"], cab),
    "arm": group(hks, ["ID811", "ID113"], cab),
    "cover": fr_group(left(fr_parts("hks_caps"))),
})
