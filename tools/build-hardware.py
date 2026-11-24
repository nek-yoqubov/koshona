#!/usr/bin/env python3
"""Фурнитура Blum из официальных моделей (3D Warehouse, Blum USA, Collada) -> public/models/*.glb.
Детали остаются отдельными (для кинематики), вершины свариваются, нормали считает движок (с изломом по углу).
Запуск: python3 -I tools/build-hardware.py
"""
import os, sys, numpy as np, trimesh

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
