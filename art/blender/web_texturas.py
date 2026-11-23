# -*- coding: utf-8 -*-
"""Texturas para la versión web de la campana, derivadas de los recursos CC0 de art/terceros (docs/ASSETS.md, c.5).

    "C:\\Program Files\\Blender Foundation\\Blender 5.3\\blender.exe" -b --factory-startup -P art/blender/web_texturas.py

Hace en la textura lo que en Unreal hacía el grafo del material (Tools/campana_crear_nivel.py), para que la web no
pague ese cálculo por píxel: desaturar y teñir el suelo, modular el blanco de la pared, oscurecer el techo, y
remapear la rugosidad al intervalo de cada material. Reduce a 1024 px (PC modestos) y guarda JPEG en
web-campana/public/texturas/. Los mapas normales siguen en convención DirectX (la web invierte el verde).
three.js lee la rugosidad del canal G: los mapas de rugosidad se guardan en gris.
"""
import os

import bpy
import numpy as np

RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
T = os.path.join(RAIZ, "art", "terceros")
PROPIAS = os.path.join(RAIZ, "art", "export", "texturas")
SALIDA = os.path.join(RAIZ, "web-campana", "public", "texturas")
LADO = 1024


def leer(ruta):
    img = bpy.data.images.load(ruta)
    img.colorspace_settings.name = "Non-Color"     # valores tal cual están guardados
    if img.size[0] != LADO:
        img.scale(LADO, LADO)
    a = np.empty(LADO * LADO * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(LADO, LADO, 4)[..., :3]


def lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb(c):
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def guardar(nombre, rgb):
    img = bpy.data.images.new(nombre, LADO, LADO, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    px = np.ones((LADO, LADO, 4), dtype=np.float32)
    px[..., :3] = np.clip(rgb, 0.0, 1.0)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = os.path.join(SALIDA, nombre + ".jpg")
    img.file_format = "JPEG"
    img.save(quality=88)
    bpy.data.images.remove(img)
    print("[WebTexturas]", nombre)


def gris(r):
    return np.repeat(r[..., :1], 3, axis=2)


def remap(r, a, b):
    return gris(a + (b - a) * r)


def main():
    os.makedirs(SALIDA, exist_ok=True)
    # Suelo: Poly Haven marble_01, desaturado al 80 % y teñido (0,80, 0,82, 0,86) como M_Suelo_Porcelanato.
    c = lin(leer(os.path.join(T, "polyhaven/marble_01/marble_01_diff_2k.jpg")))
    l = (c @ np.array([0.2126, 0.7152, 0.0722]))[..., None]
    guardar("suelo_c", srgb((c * 0.2 + l * 0.8) * np.array([0.80, 0.82, 0.86])))
    guardar("suelo_r", remap(leer(os.path.join(T, "polyhaven/marble_01/marble_01_rough_2k.jpg")), 0.16, 0.42))
    guardar("suelo_n", leer(os.path.join(T, "polyhaven/marble_01/marble_01_nor_dx_2k.jpg")))
    # Pared: Poly Haven plastered_wall_04 solo modula un blanco roto (0,60, 0,60, 0,58).
    g = lin(leer(os.path.join(T, "polyhaven/plastered_wall_04/plastered_wall_04_diff_2k.jpg")))[..., 1:2]
    guardar("pared_c", srgb((0.90 + 0.16 * g / max(1e-4, float(g.mean())) * 0.5) * np.array([0.60, 0.60, 0.58])))
    guardar("pared_r", remap(leer(os.path.join(T, "polyhaven/plastered_wall_04/plastered_wall_04_rough_2k.jpg")), 0.72, 0.95))
    guardar("pared_n", leer(os.path.join(T, "polyhaven/plastered_wall_04/plastered_wall_04_nor_dx_2k.jpg")))
    # Techo: ambientCG OfficeCeiling001 al 82 %.
    guardar("techo_c", srgb(lin(leer(os.path.join(T, "ambientcg/OfficeCeiling001/OfficeCeiling001_2K-JPG_Color.jpg"))) * 0.82))
    guardar("techo_r", remap(leer(os.path.join(T, "ambientcg/OfficeCeiling001/OfficeCeiling001_2K-JPG_Roughness.jpg")), 0.75, 0.95))
    guardar("techo_n", leer(os.path.join(T, "ambientcg/OfficeCeiling001/OfficeCeiling001_2K-JPG_NormalDX.jpg")))
    # Acero cepillado: ambientCG Metal009.
    guardar("acero_c", srgb(lin(leer(os.path.join(T, "ambientcg/Metal009/Metal009_2K-JPG_Color.jpg"))) * 0.95))
    guardar("acero_r", remap(leer(os.path.join(T, "ambientcg/Metal009/Metal009_2K-JPG_Roughness.jpg")), 0.18, 0.38))
    guardar("acero_n", leer(os.path.join(T, "ambientcg/Metal009/Metal009_2K-JPG_NormalDX.jpg")))
    # Blancos (laminado y chapa pintada): ambientCG Plastic010, solo rugosidad y relieve.
    r = leer(os.path.join(T, "ambientcg/Plastic010/Plastic010_2K-JPG_Roughness.jpg"))
    guardar("laminado_r", remap(r, 0.30, 0.46))
    guardar("pintado_r", remap(r, 0.22, 0.34))
    guardar("plastico_n", leer(os.path.join(T, "ambientcg/Plastic010/Plastic010_2K-JPG_NormalDX.jpg")))
    # Granito oscuro derivado de ambientCG Granite002A (art/blender/texturas_cc0.py): R rugosidad, G destello.
    guardar("granito_c", leer(os.path.join(PROPIAS, "T_Granito_Oscuro_BC.png")))
    m = leer(os.path.join(PROPIAS, "T_Granito_Oscuro_M.png"))
    guardar("granito_r", gris(m))


main()
