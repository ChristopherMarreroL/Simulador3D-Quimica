# -*- coding: utf-8 -*-
"""Texturas derivadas de recursos CC0 (art/terceros) para el nivel Campana v2 (18 de noviembre de 2026).

    blender -b --factory-startup --python art/blender/texturas_cc0.py

Ningún granito CC0 de Poly Haven ni de ambientCG es oscuro (todos claros, beige o rojizos; ver docs/ASSETS.md),
así que el granito pulido oscuro se DERIVA de ambientCG Granite002A (granito gris claro de grano fino,
fotogrametría, CC0): se invierte la luminancia (el fondo blanco pasa a gris casi negro y los granos oscuros
pasan a motas claras de cuarzo), se ajusta la curva y se da un tinte muy leve. La máscara G marca los granos
que en la pieza real dan destellos azulados (labradorescencia): solo una parte de las motas, y débil.

Salidas en art/export/texturas/ (las importa Tools/campana_crear_nivel.py):
  T_Granito_Oscuro_BC.png  color base sRGB
  T_Granito_Oscuro_M.png   lineal: R rugosidad (pulido 0,07–0,16), G máscara de destello, B sin uso
"""
import os

import bpy
import numpy as np

RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
ORIGEN = os.path.join(RAIZ, "art", "terceros", "ambientcg", "Granite002A")
SALIDA = os.path.join(RAIZ, "art", "export", "texturas")


def leer(ruta):
    img = bpy.data.images.load(ruta)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(h, w, 4)


def a_lineal(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def a_srgb(c):
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def escribir(nombre, rgb, srgb):
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(nombre, w, h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
    px = np.ones((h, w, 4), dtype=np.float32)
    px[..., :3] = np.clip(rgb, 0.0, 1.0)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = os.path.join(SALIDA, nombre + ".png")
    img.file_format = "PNG"
    img.save()
    print("[TexturasCC0] escrita", img.filepath_raw)


def main():
    os.makedirs(SALIDA, exist_ok=True)
    # En imágenes de 8 bits, pixels devuelve los valores guardados (codificados en sRGB): se linealizan a mano.
    color = a_lineal(leer(os.path.join(ORIGEN, "Granite002A_2K-JPG_Color.jpg"))[..., :3])
    rugos = leer(os.path.join(ORIGEN, "Granite002A_2K-JPG_Roughness.jpg"))[..., 0]
    lum = color @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    lum = (lum - np.percentile(lum, 1)) / max(1e-4, np.percentile(lum, 99.5) - np.percentile(lum, 1))
    inv = np.clip(1.0 - lum, 0.0, 1.0)
    # Fondo gris carbón (albedo lineal ~0,03) y motas claras hasta ~0,19 (media ~0,05): un granito «gris acero» pulido.
    valor = 0.020 + 0.17 * inv ** 3.2
    tinte = np.array([0.97, 1.0, 1.04], dtype=np.float32)        # apenas frío, no azul
    bc = valor[..., None] * tinte
    # Destello: solo granos medios-claros (no el fondo) y modulado por la saturación original (variación).
    sat = color.max(axis=-1) - color.min(axis=-1)
    mascara = np.clip((inv - 0.45) * 3.0, 0.0, 1.0) * np.clip(sat * 8.0 + 0.3, 0.0, 1.0)
    r = 0.07 + 0.09 * (rugos - rugos.min()) / max(1e-4, rugos.max() - rugos.min())
    escribir("T_Granito_Oscuro_BC", a_srgb(bc), srgb=True)
    escribir("T_Granito_Oscuro_M", np.stack([r, mascara, np.zeros_like(r)], axis=-1), srgb=False)
    print("[TexturasCC0] FIN albedo medio %.4f, mascara media %.3f" % (float(bc.mean()), float(mascara.mean())))


main()
