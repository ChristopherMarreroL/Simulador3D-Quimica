"""Texturas procedurales repetibles (sin costuras) para los materiales de la estación de la campana.

  "C:\\Program Files\\Blender Foundation\\Blender 5.3\\blender.exe" -b --factory-startup -P art/blender/texturas_procedurales.py -- art/export/texturas

Todo se calcula con numpy a partir de una semilla fija: ruido filtrado en frecuencia con FFT (periódico por
construcción, así que la textura se repite sin costura) y celdas de Voronoi en un toro para los cristales del
granito. No usa ninguna imagen ni recurso externo. Se precalculan en textura en vez de usar nodos de ruido del
material porque leer una textura es mucho más barato que evaluar ruido por píxel en una GPU integrada.

Salidas (PNG de 8 bits, 1024 × 1024):
  T_Granito_AzulPerla_BC.png   color base en sRGB. Cubre 0,6 m: matriz casi negra, cristales de feldespato
                               gris azulado y algunos con destello azul.
  T_Granito_AzulPerla_M.png    lineal. R = rugosidad (pulido 0,06-0,12; juntas y poros más), G = máscara de
                               destello (labradorescencia, la usa el material con Fresnel), B = juntas.
  T_Ruido_Fino.png             lineal, gris: variación suave para romper la rugosidad uniforme (laminado,
                               pintura, resina, paredes). Cubre 0,5 m.
  T_Acero_Cepillado.png        lineal, gris: vetas finas alargadas en U para el acero satinado. Cubre 0,25 m.
  T_Suelo_Vinilo_BC.png        sRGB: vinilo gris claro con motas. Cubre 1 m.
  T_Suelo_Vinilo_R.png         lineal: rugosidad del vinilo.

Los valores de albedo son estimaciones de aspecto (no medidas): granito pulido oscuro ~3-8 % de reflectancia,
laminado y pintura blancos ~60 %, vinilo claro ~20-25 %.
"""
import sys
from pathlib import Path

import bpy
import numpy as np

N = 1024
RNG = np.random.default_rng(20261118)


def ruido(escala_px, n=N, anisotropia=(1.0, 1.0), pendiente=2.0):
    """Ruido periódico: ruido blanco filtrado con un pasabanda centrado en 1/escala_px. Media 0, desviación 1."""
    blanco = RNG.standard_normal((n, n))
    fy = np.fft.fftfreq(n)[:, None] * anisotropia[1]
    fx = np.fft.fftfreq(n)[None, :] * anisotropia[0]
    f = np.sqrt(fx * fx + fy * fy)
    f0 = 1.0 / escala_px
    filtro = np.exp(-((np.log(np.maximum(f, 1e-6) / f0)) ** 2) / (2 * 0.6 ** 2)) / (1 + (f / f0) ** pendiente)
    filtro[0, 0] = 0
    out = np.real(np.fft.ifft2(np.fft.fft2(blanco) * filtro))
    return (out - out.mean()) / (out.std() + 1e-9)


def fbm(escala_px, octavas=4, ganancia=0.5, **kw):
    total, amp, peso = 0, 1.0, 0
    for i in range(octavas):
        total = total + amp * ruido(escala_px / (2 ** i), **kw)
        peso += amp
        amp *= ganancia
    return total / peso


def voronoi_toro(celdas, deformar):
    """Distancias F1, F2 e índice de celda de puntos con jitter en una rejilla periódica de celdas × celdas."""
    jitter = RNG.random((celdas, celdas, 2))
    py = (np.arange(celdas)[:, None] + jitter[..., 0]) / celdas      # [cy, cx]
    px = (np.arange(celdas)[None, :] + jitter[..., 1]) / celdas
    yy, xx = np.meshgrid(np.arange(N) / N, np.arange(N) / N, indexing="ij")
    yy = (yy + deformar[0]) % 1.0
    xx = (xx + deformar[1]) % 1.0
    cy0 = np.floor(yy * celdas).astype(int)
    cx0 = np.floor(xx * celdas).astype(int)
    f1 = np.full((N, N), 9.0); f2 = np.full((N, N), 9.0); idx = np.zeros((N, N), dtype=np.int64)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cy = (cy0 + dy) % celdas
            cx = (cx0 + dx) % celdas
            # Diferencia mínima en el toro: la textura se repite sin costura.
            ddy = (py[cy, cx] - yy + 0.5) % 1.0 - 0.5
            ddx = (px[cy, cx] - xx + 0.5) % 1.0 - 0.5
            d = np.sqrt(ddy * ddy + ddx * ddx)
            nuevo = d < f1
            f2 = np.where(nuevo, f1, np.minimum(f2, d))
            idx = np.where(nuevo, cy * celdas + cx, idx)
            f1 = np.where(nuevo, d, f1)
    return f1, f2, idx


def a_srgb(lineal):
    lineal = np.clip(lineal, 0, 1)
    return np.where(lineal <= 0.0031308, lineal * 12.92, 1.055 * np.power(lineal, 1 / 2.4) - 0.055)


def guardar(nombre, rgb, carpeta):
    """rgb: (N, N, 3) en [0, 1], ya codificado (sRGB o lineal según la textura). Fila 0 = arriba."""
    img = bpy.data.images.new(nombre, N, N, alpha=True)
    rgba = np.ones((N, N, 4), dtype=np.float32)
    rgba[..., :3] = np.clip(rgb, 0, 1)
    img.pixels.foreach_set(rgba[::-1].ravel())   # Blender guarda la fila 0 abajo
    img.filepath_raw = str(carpeta / (nombre + ".png"))
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    print(f"TEXTURA {nombre} media={rgb.mean(axis=(0, 1)).round(4).tolist()}")


def granito(carpeta):
    # 0,6 m en 1024 px: 0,59 mm por píxel. Cristales de feldespato de 1 a 3 cm: rejilla de 34 celdas (~1,8 cm).
    deform = (0.012 * fbm(90, 3), 0.012 * fbm(90, 3))
    f1, f2, idx = voronoi_toro(34, deform)
    celdas = 34 * 34
    tono = RNG.random(celdas)[idx]
    destello = (RNG.random(celdas) < 0.22)[idx] * np.clip(0.4 + 0.6 * RNG.random(celdas)[idx], 0, 1)
    borde = f2 - f1                                # 0 en las juntas entre cristales
    # Juntas finas e interrumpidas: solo se marcan donde un ruido lo decide (no un contorno en cada cristal).
    junta = np.clip(1.0 - borde / 0.0022, 0, 1) ** 2 * np.clip(fbm(40, 2) + 0.2, 0, 1)
    # Minerales oscuros (piroxeno, biotita): cristales enteros casi negros y manchas irregulares.
    celda_oscura = (RNG.random(celdas) < 0.30)[idx].astype(float)
    oscuro = np.clip((fbm(24, 3) - 0.9) * 1.4, 0, 1)
    fino = fbm(4, 2)
    interno = fbm(14, 3)
    # Planos de exfoliación del feldespato: vetas paralelas con una orientación por cristal.
    angulo = (RNG.random(celdas) * np.pi)[idx]
    yy, xx = np.meshgrid(np.arange(N), np.arange(N), indexing="ij")
    vetas = 0.5 + 0.5 * np.sin((xx * np.cos(angulo) + yy * np.sin(angulo)) * (2 * np.pi / 6.0) + 3.0 * interno)
    # Albedo lineal: matriz casi negra; cristales gris azulado; destellos más azules.
    matriz = np.array([0.008, 0.009, 0.011])
    cristal = np.array([0.050, 0.057, 0.072])[None, None, :] * (0.55 + 0.8 * tono[..., None]) * (1 + 0.10 * interno[..., None] + 0.08 * vetas[..., None])
    azul = np.array([0.040, 0.075, 0.150])
    color = cristal + destello[..., None] * azul * (0.35 + 0.35 * vetas[..., None])
    mezcla_matriz = np.clip(junta * 0.7 + oscuro + celda_oscura * 0.85, 0, 1)[..., None]
    color = color * (1 - mezcla_matriz) + matriz * mezcla_matriz
    color = color * (1 + 0.06 * fino[..., None])
    guardar("T_Granito_AzulPerla_BC", a_srgb(color), carpeta)
    # Rugosidad: pulido espejo con leve variación; juntas y poros algo más rugosos.
    poros = (fbm(2.5, 1) > 2.6).astype(float)
    rug = 0.075 + 0.025 * (0.5 + 0.5 * np.tanh(interno)) + 0.12 * junta + 0.25 * poros
    guardar("T_Granito_AzulPerla_M", np.stack([np.clip(rug, 0, 1), np.clip(destello * (0.7 + 0.3 * interno), 0, 1), junta], -1), carpeta)


def generales(carpeta):
    r = 0.5 + 0.16 * fbm(60, 5)
    guardar("T_Ruido_Fino", np.repeat(np.clip(r, 0, 1)[..., None], 3, -1), carpeta)
    # Vetas del cepillado: frecuencia alta en V (filas), muy baja en U (columnas): se alargan en U.
    vetas = 0.5 + 0.18 * fbm(3, 3, anisotropia=(0.02, 1.0)) + 0.06 * fbm(40, 2)
    guardar("T_Acero_Cepillado", np.repeat(np.clip(vetas, 0, 1)[..., None], 3, -1), carpeta)
    # Vinilo: base gris claro con motas pequeñas claras y oscuras.
    base = np.array([0.20, 0.205, 0.205])[None, None, :] * (1 + 0.05 * fbm(120, 3)[..., None])
    motas = fbm(1.8, 1)
    claras = (motas > 2.2)[..., None] * 0.18
    oscuras = (motas < -2.3)[..., None] * -0.12
    color = base + claras + oscuras * base / 0.2
    guardar("T_Suelo_Vinilo_BC", a_srgb(color), carpeta)
    rug = 0.38 + 0.08 * fbm(30, 4) + 0.05 * (motas > 2.2)
    guardar("T_Suelo_Vinilo_R", np.repeat(np.clip(rug, 0, 1)[..., None], 3, -1), carpeta)


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    carpeta = (Path(args[0]) if args else Path("art/export/texturas")).resolve()
    carpeta.mkdir(parents=True, exist_ok=True)
    granito(carpeta)
    generales(carpeta)
    print("TEXTURAS_OK")


if __name__ == "__main__":
    main()
