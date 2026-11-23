# -*- coding: utf-8 -*-
"""Laboratorio completo para la version web, con la luz horneada en Cycles (equivalente web de Lightmass).

    blender.exe -b --factory-startup -P art/blender/web_laboratorio_hornear.py -- [--muestras 256] [--escala 1.0] [--rapido]

Laboratorio de diseno propio de 12,0 x 9,0 x 3,2 m (no es replica de ningun laboratorio real; medidas no tomadas de
fotos): tres ventanas en la pared izquierda; en la pared del fondo la estacion de la campana (art/export) entre dos
bancos con gabinetes, estantes abiertos de material y la estanteria de 4 x 7 reactivos; banco con dos lavabos en la
pared derecha; cuatro mesetas centrales de granito con torretas de gas; ducha de emergencia con lavaojos en la esquina
del fondo; dos aires acondicionados de pared; puerta, extintor, proteccion, tablero de misiones y residuos.
Ampliacion del 20 de noviembre: repisa central y taburetes en las mesetas, muebles altos y escurridores sobre los
lavabos, armarios de almacen, armarios de seguridad (inflamables y corrosivos), nevera, bombonas de gas, carrito,
escritorio con pizarra, botiquin y conducto de extraccion de la campana.

Luz: cielo y sol del HDRI CC0 de Poly Haven (quadrangle_sunny) girado para que el sol entre por las ventanas, un sol
direccional que completa la irradiancia si el disco del HDRI esta recortado, doce paneles LED de 4000 lm y la
luminaria de la campana. Unidades fisicas de Blender (1 W = 683 lm): la exposicion se fija luego en la web.

Salidas en web-campana/public/escena/:
  sala.glb        mallas estaticas con UV0 (escala real, 1 unidad = 1 m) y UV1 (mapa de luz sin solapes)
  lm/<objeto>.hdr irradiancia difusa horneada (directa + indirecta, sin el color propio), Radiance RGBE
  escena.json     direccion del sol, giro del HDRI, paneles LED, mesetas, lavabos y la lista de mapas de luz

Coordenadas: las de los guiones de art/blender (metros, Z arriba, la estacion mira hacia -Y). Las medidas se escriben
en cm con los ejes de Unreal (X derecha, Y hacia la sala, Z arriba), que pasan a Blender como (X, -Y, Z) / 100; el GLB
sale con Y arriba (three.js: (X, Z, Y) / 100).
"""
import json
import math
import os
import sys
import time

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
EXPORT = os.path.join(RAIZ, "art", "export")
TERCEROS = os.path.join(RAIZ, "art", "terceros")
SALIDA = os.path.join(RAIZ, "web-campana", "public", "escena")

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(nombre, defecto):
    return type(defecto)(ARGS[ARGS.index(nombre) + 1]) if nombre in ARGS else defecto


MUESTRAS = arg("--muestras", 256)
ESCALA_LM = arg("--escala", 1.0)      # factor sobre la resolución de cada mapa de luz
RAPIDO = "--rapido" in ARGS           # prueba del proceso: pocas muestras y mapas pequeños
if RAPIDO:
    MUESTRAS, ESCALA_LM = 8, 0.25

LM_W = 683.0                          # lm por W en la convención de Blender

# Sala (cm de Unreal), igual que Tools/campana_crear_nivel.py.
X0, X1 = -600.0, 600.0
Y0, Y1 = -46.0, 854.0
ALTO = 320.0
MURO = 20.0
VENTANAS_Y = [(70.0, 270.0), (340.0, 540.0), (610.0, 810.0)]
VENTANA_Z = (90.0, 250.0)
SOL_LUX = 45000.0                     # sol de media tarde que entra por la ventana (igual que Unreal v2)
CIELO_NITS = 3000.0                   # luminancia media del cielo visto por la ventana (igual que Unreal v2)
LED_LM = 4000.0
CAMPANA_LM = 900.0


def registrar(texto):
    print("[WebCampana] " + texto, flush=True)


# ---------------------------------------------------------------- Escena

def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for coleccion in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.lights):
        for bloque in list(coleccion):
            coleccion.remove(bloque)


ALBEDO = {
    # nombre: (color base lineal, rugosidad, metálico) — los de Unreal (estimados, no medidos).
    "M_Granito_AzulPerla": ((0.055, 0.058, 0.064), 0.12, 0.0),
    "M_Laminado_Blanco": ((0.60, 0.60, 0.58), 0.38, 0.0),
    "M_Acero_Pintado_Blanco": ((0.64, 0.65, 0.64), 0.28, 0.0),
    "M_Resina_Interior": ((0.50, 0.52, 0.51), 0.5, 0.0),
    "M_Acero_Satinado": ((0.57, 0.57, 0.57), 0.28, 1.0),
    "M_Aluminio_Anodizado": ((0.80, 0.80, 0.81), 0.35, 1.0),
    "M_Plastico_Negro": ((0.022, 0.022, 0.024), 0.45, 0.0),
    "M_Zocalo": ((0.03, 0.032, 0.035), 0.55, 0.0),
    "M_Llave_Azul": ((0.02, 0.10, 0.45), 0.35, 0.0),
    "M_Llave_Amarillo": ((0.75, 0.48, 0.02), 0.35, 0.0),
    "M_Llave_Verde": ((0.02, 0.30, 0.06), 0.35, 0.0),
    "M_Panel_Control": ((0.008, 0.009, 0.011), 0.06, 0.0),
    "M_LED_Emisivo": ((0.8, 0.8, 0.8), 0.5, 0.0),
    "M_Suelo": ((0.56, 0.57, 0.60), 0.3, 0.0),
    "M_Pared": ((0.58, 0.58, 0.56), 0.85, 0.0),
    "M_Techo": ((0.66, 0.66, 0.65), 0.85, 0.0),
    "M_Marco_Ventana": ((0.70, 0.70, 0.70), 0.35, 1.0),
    "M_Puerta": ((0.42, 0.30, 0.20), 0.5, 0.0),
    "M_Tablero": ((0.80, 0.80, 0.80), 0.35, 0.0),
    "M_Residuos": ((0.62, 0.55, 0.20), 0.5, 0.0),
    "M_HDPE": ((0.80, 0.80, 0.78), 0.4, 0.0),
    "M_Seguridad_Amarillo": ((0.80, 0.58, 0.02), 0.4, 0.0),
    "M_Seguridad_Verde": ((0.02, 0.38, 0.14), 0.4, 0.0),
    "M_Rojo": ((0.60, 0.03, 0.02), 0.35, 0.0),
    "M_AC": ((0.72, 0.73, 0.72), 0.4, 0.0),
    "M_Azul_Seguridad": ((0.04, 0.14, 0.42), 0.4, 0.0),
}


def material(nombre):
    m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    salida = nt.nodes.new("ShaderNodeOutputMaterial")
    if nombre == "M_Vidrio_Guillotina":
        bsdf = nt.nodes.new("ShaderNodeBsdfTransparent")
        nt.links.new(bsdf.outputs[0], salida.inputs["Surface"])
        return m
    color, rug, met = ALBEDO.get(nombre, ((0.5, 0.5, 0.5), 0.5, 0.0))
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rug
    bsdf.inputs["Metallic"].default_value = 0.0   # horneado: irradiancia también en los metales (la web atenúa su metalicidad)
    nt.links.new(bsdf.outputs[0], salida.inputs["Surface"])
    return m


def ue(x, y, z):
    """Posición de Unreal (cm) → Blender (m)."""
    return (x / 100.0, -y / 100.0, z / 100.0)


def uv_cubico(bm, capa):
    for cara in bm.faces:
        n = cara.normal
        eje = max(range(3), key=lambda i: abs(n[i]))
        for bucle in cara.loops:
            p = bucle.vert.co
            bucle[capa].uv = (p.x, p.y) if eje == 2 else ((p.y, p.z) if eje == 0 else (p.x, p.z))


def objeto_caja(nombre, a, b, mat, quitar=()):
    """Caja alineada entre las esquinas a y b (Blender, m). `quitar`: caras a borrar por su normal ('-x', '+z'…)."""
    me = bpy.data.meshes.new(nombre)
    bm = bmesh.new()
    lo = Vector([min(a[i], b[i]) for i in range(3)])
    hi = Vector([max(a[i], b[i]) for i in range(3)])
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector([lo[i] + (v.co[i] + 0.5) * (hi[i] - lo[i]) for i in range(3)])
    bm.normal_update()
    borrar = []
    for cara in bm.faces:
        for q in quitar:
            i = "xyz".index(q[1])
            if (cara.normal[i] > 0.9 and q[0] == "+") or (cara.normal[i] < -0.9 and q[0] == "-"):
                borrar.append(cara)
    bmesh.ops.delete(bm, geom=list(set(borrar)), context="FACES")
    uv_cubico(bm, bm.loops.layers.uv.new("UVMap"))
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material(mat))
    o = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def ue_caja(nombre, xa, xb, ya, yb, za, zb, mat, quitar=()):
    return objeto_caja(nombre, ue(xa, ya, za), ue(xb, yb, zb), mat, quitar)


def objeto_cilindro(nombre, centro, radio, alto, mat, lados=40):
    me = bpy.data.meshes.new(nombre)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=lados, radius1=radio, radius2=radio, depth=alto)
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((centro[0], centro[1], centro[2] + alto / 2)))
    bm.normal_update()
    capa = bm.loops.layers.uv.new("UVMap")
    for cara in bm.faces:
        for bucle in cara.loops:
            p = bucle.vert.co
            ang = math.atan2(p.y - centro[1], p.x - centro[0])
            bucle[capa].uv = (ang * radio, p.z) if abs(cara.normal.z) < 0.5 else (p.x, p.y)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material(mat))
    o = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def importar_estacion():
    piezas = []
    for nombre in ("SM_Gabinete_Blanco", "SM_Encimera_Granito", "SM_Campana_Sobremesa", "SM_Campana_Guillotina"):
        antes = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(EXPORT, nombre + ".glb"))
        for o in set(bpy.data.objects) - antes:
            if o.name.startswith("UCX_") or o.type != "MESH":
                bpy.data.objects.remove(o, do_unlink=True)
                continue
            o.name = nombre.replace("SM_", "")
            capas = o.data.uv_layers
            if len(capas) > 1:
                capas[0].name, capas[1].name = "UVMap", "UVLightmap"
            for ranura in o.material_slots:
                base = ranura.material.name.split(".")[0]
                ranura.material = material(base)
            piezas.append(o)
    return piezas


def ue_cajas(nombre, cajas, mat, quitar=(), invertir=False):
    """Varias cajas (xa, xb, ya, yb, za, zb en cm de Unreal) en una sola malla."""
    me = bpy.data.meshes.new(nombre)
    bm = bmesh.new()
    for (xa, xb, ya, yb, za, zb) in cajas:
        a, b = ue(xa, ya, za), ue(xb, yb, zb)
        lo = Vector([min(a[i], b[i]) for i in range(3)])
        hi = Vector([max(a[i], b[i]) for i in range(3)])
        nuevos = bmesh.ops.create_cube(bm, size=1.0)["verts"]
        for v in nuevos:
            v.co = Vector([lo[i] + (v.co[i] + 0.5) * (hi[i] - lo[i]) for i in range(3)])
    bm.normal_update()
    borrar = []
    for cara in bm.faces:
        for q in quitar:
            i = "xyz".index(q[1])
            if (cara.normal[i] > 0.9 and q[0] == "+") or (cara.normal[i] < -0.9 and q[0] == "-"):
                borrar.append(cara)
    bmesh.ops.delete(bm, geom=list(set(borrar)), context="FACES")
    if invertir:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.normal_update()
    uv_cubico(bm, bm.loops.layers.uv.new("UVMap"))
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material(mat))
    o = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def ue_cilindros(nombre, cilindros, mat, lados=24):
    """Varios cilindros verticales (x, y, z0, radio, alto en cm de Unreal) en una malla."""
    me = bpy.data.meshes.new(nombre)
    bm = bmesh.new()
    for (x, y, z0, radio, alto) in cilindros:
        c = ue(x, y, z0)
        r = bmesh.ops.create_cone(bm, cap_ends=True, segments=lados, radius1=radio / 100.0, radius2=radio / 100.0, depth=alto / 100.0)
        bmesh.ops.translate(bm, verts=r["verts"], vec=Vector((c[0], c[1], c[2] + alto / 200.0)))
    bm.normal_update()
    uv_cubico(bm, bm.loops.layers.uv.new("UVMap"))
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = abs(p.normal.z) < 0.5
    me.materials.append(material(mat))
    o = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def copia(o, nombre, x_cm=0.0, y_cm=0.0, giro_z=0.0):
    """Copia independiente de una pieza importada (malla propia: mapa de luz propio)."""
    c = o.copy()
    c.data = o.data.copy()
    c.name = nombre
    c.location = (x_cm / 100.0, -y_cm / 100.0, 0.0)
    c.rotation_mode = "XYZ"
    c.rotation_euler = (0.0, 0.0, giro_z)
    bpy.context.scene.collection.objects.link(c)
    return c


# Mesetas centrales (centro X, centro Y en cm): 300 x 120 cm, dos filas de dos.
ISLAS = [(-300.0, 330.0), (150.0, 330.0), (-300.0, 620.0), (150.0, 620.0)]
LEDS = [(x, y) for y in (100.0, 400.0, 700.0) for x in (-450.0, -150.0, 150.0, 450.0)]
LAVABOS_Y = (200.0, 560.0)


def montar_sala():
    s = {}

    def pon(o):
        s[o.name] = o
        return o

    pon(ue_caja("Suelo", X0, X1, Y0, Y1, -MURO, 0.0, "M_Suelo", quitar=("-x", "+x", "-y", "+y", "-z")))
    pon(ue_caja("Techo", X0, X1, Y0, Y1, ALTO, ALTO + MURO, "M_Techo", quitar=("-x", "+x", "-y", "+y", "+z")))
    pon(ue_caja("Pared_Fondo", X0, X1, Y0 - MURO, Y0, 0.0, ALTO, "M_Pared", quitar=("-x", "+x", "+y", "-z", "+z")))
    pon(ue_caja("Pared_Trasera", X0, X1, Y1, Y1 + MURO, 0.0, ALTO, "M_Pared", quitar=("-x", "+x", "-y", "-z", "+z")))
    pon(ue_caja("Pared_Derecha", X1, X1 + MURO, Y0, Y1, 0.0, ALTO, "M_Pared", quitar=("+x", "-y", "+y", "-z", "+z")))
    xa, xb = X0 - MURO, X0
    pon(ue_caja("Pared_Izq_Bajo", xa, xb, Y0, Y1, 0.0, VENTANA_Z[0], "M_Pared", quitar=("-x", "-z")))
    pon(ue_caja("Pared_Izq_Alto", xa, xb, Y0, Y1, VENTANA_Z[1], ALTO, "M_Pared", quitar=("-x", "+z")))
    cortes = [Y0] + [v for par in VENTANAS_Y for v in par] + [Y1]
    for i in range(0, len(cortes), 2):
        pon(ue_caja("Pared_Izq_Pilar_%d" % (i // 2), xa, xb, cortes[i], cortes[i + 1], VENTANA_Z[0], VENTANA_Z[1], "M_Pared", quitar=("-x", "-z", "+z")))
    for i, (ya, yb) in enumerate(VENTANAS_Y):
        ym = (ya + yb) / 2
        pon(ue_cajas("Ventana_Marco_%d" % i, [
            (xa + 6, xb - 6, ya, yb, VENTANA_Z[0], VENTANA_Z[0] + 6), (xa + 6, xb - 6, ya, yb, VENTANA_Z[1] - 6, VENTANA_Z[1]),
            (xa + 6, xb - 6, ya, ya + 6, VENTANA_Z[0], VENTANA_Z[1]), (xa + 6, xb - 6, yb - 6, yb, VENTANA_Z[0], VENTANA_Z[1]),
            (xa + 6, xb - 6, ym - 3, ym + 3, VENTANA_Z[0], VENTANA_Z[1])], "M_Marco_Ventana"))
        pon(ue_caja("Alfeizar_%d" % i, xb - 2, xb + 14, ya - 8, yb + 8, VENTANA_Z[0] - 3, VENTANA_Z[0], "M_Granito_AzulPerla"))
    pon(ue_cajas("Zocalos", [(X0, X1, Y0, Y0 + 1.2, 0, 8), (X0, X1, Y1 - 1.2, Y1, 0, 8), (X1 - 1.2, X1, Y0, Y1, 0, 8), (X0, X0 + 1.2, Y0, Y1, 0, 8)], "M_Zocalo", quitar=("-z",)))
    # Puerta de entrada en la pared trasera (90 x 210 cm) y extintor a su lado.
    pon(ue_caja("Puerta_Marco", 295.0, 405.0, Y1 - 3.0, Y1, 0.0, 216.0, "M_Marco_Ventana", quitar=("-z",)))
    pon(ue_caja("Puerta_Hoja", 300.0, 400.0, Y1 - 4.0, Y1 - 3.0, 0.5, 211.0, "M_Puerta"))
    pon(ue_caja("Puerta_Tirador", 386.0, 396.0, Y1 - 8.0, Y1 - 4.0, 100.0, 103.0, "M_Acero_Satinado"))
    pon(ue_cilindros("Extintor", [(450.0, Y1 - 10.0, 60.0, 8.0, 45.0), (450.0, Y1 - 10.0, 105.0, 3.0, 8.0)], "M_Rojo"))
    # Aire acondicionado: dos unidades de pared tipo split (100 x 30 x 22 cm) con su rejilla.
    pon(ue_caja("Aire_0", -320.0, -220.0, Y0, Y0 + 22.0, 268.0, 298.0, "M_AC"))
    pon(ue_caja("Aire_Rejilla_0", -316.0, -224.0, Y0 + 22.0, Y0 + 22.6, 270.0, 276.0, "M_Plastico_Negro"))
    pon(ue_caja("Aire_1", -200.0, -100.0, Y1 - 22.0, Y1, 268.0, 298.0, "M_AC"))
    pon(ue_caja("Aire_Rejilla_1", -196.0, -104.0, Y1 - 22.6, Y1 - 22.0, 270.0, 276.0, "M_Plastico_Negro"))
    return s


def montar_mobiliario(estacion):
    """Mobiliario fijo del laboratorio (medidas y distribucion de diseno, no del laboratorio real)."""
    s = {}

    def pon(o):
        s[o.name] = o
        return o

    gabinete = next(o for o in estacion if o.name == "Gabinete_Blanco")
    # Bancos de pared a los lados de la estacion (modulos de 180 cm) y banco de lavabos en la pared derecha.
    for i, x in enumerate((-360.0, -180.0, 180.0, 360.0)):
        pon(copia(gabinete, "Gabinete_Fondo_%d" % i, x_cm=x))
    for i, y in enumerate((200.0, 380.0, 560.0)):
        pon(copia(gabinete, "Gabinete_Lavabos_%d" % i, x_cm=554.0, y_cm=y, giro_z=-math.pi / 2))
    for nombre, xa, xb in (("Encimera_Izquierda", -450.0, -90.0), ("Encimera_Derecha", 90.0, 450.0)):
        pon(ue_cajas(nombre, [(xa, xb, -45.0, 47.0, 87.0, 90.0), (xa, xb, -45.0, -43.0, 90.0, 100.0)], "M_Granito_AzulPerla", quitar=("-z",)))
    # Encimera de lavabos con los dos huecos, cubetas de acero y salpicadero.
    piezas = [(580.0, 599.0, 110.0, 650.0, 87.0, 90.0), (507.0, 530.0, 110.0, 650.0, 87.0, 90.0), (597.0, 599.0, 110.0, 650.0, 90.0, 100.0)]
    cortes = [110.0] + [v for y in LAVABOS_Y for v in (y - 25.0, y + 25.0)] + [650.0]
    for i in range(0, len(cortes), 2):
        piezas.append((530.0, 580.0, cortes[i], cortes[i + 1], 87.0, 90.0))
    pon(ue_cajas("Encimera_Lavabos", piezas, "M_Granito_AzulPerla"))
    pon(ue_cajas("Lavabos_Cubetas", [(530.0, 580.0, y - 25.0, y + 25.0, 68.0, 89.6) for y in LAVABOS_Y], "M_Acero_Satinado", quitar=("+z",), invertir=True))
    # Mesetas centrales: cuerpo laminado, zocalo retranqueado, granito y torretas de gas (dos por meseta).
    for i, (cx, cy) in enumerate(ISLAS):
        pon(ue_caja("Meseta_Cuerpo_%d" % i, cx - 146, cx + 146, cy - 56, cy + 56, 10.0, 87.0, "M_Laminado_Blanco", quitar=("-z", "+z")))
        pon(ue_caja("Meseta_Zocalo_%d" % i, cx - 141, cx + 141, cy - 51, cy + 51, 0.0, 10.0, "M_Zocalo", quitar=("-z", "+z")))
        pon(ue_caja("Meseta_Granito_%d" % i, cx - 150, cx + 150, cy - 60, cy + 60, 87.0, 90.0, "M_Granito_AzulPerla"))
        torres, llaves = [], []
        for tx in (cx - 70, cx + 70):
            torres += [(tx - 3, tx + 3, cy - 3, cy + 3, 90.0, 112.0), (tx - 1.2, tx + 1.2, cy - 9, cy + 9, 104.0, 106.4)]
            llaves += [(tx - 2.2, tx + 2.2, cy - 12, cy - 9, 102.5, 108.0), (tx - 2.2, tx + 2.2, cy + 9, cy + 12, 102.5, 108.0)]
        pon(ue_cajas("Meseta_Gas_%d" % i, torres, "M_Acero_Satinado", quitar=("-z",)))
        pon(ue_cajas("Meseta_Llaves_%d" % i, llaves, "M_Llave_Amarillo"))
    # Estantes abiertos de material sobre el banco izquierdo.
    pon(ue_cajas("Estantes_Material", [(-448.0, -92.0, -46.0, -18.0, 148.0, 150.0), (-448.0, -92.0, -46.0, -18.0, 188.0, 190.0),
                                       (-450.0, -448.0, -46.0, -18.0, 140.0, 196.0), (-92.0, -90.0, -46.0, -18.0, 140.0, 196.0), (-271.0, -269.0, -46.0, -18.0, 140.0, 196.0)], "M_Laminado_Blanco"))
    # Estanteria de reactivos sobre el banco derecho: cuatro baldas para 4 filas de 7 frascos.
    baldas = [(105.0, 407.0, -46.0, -22.0, z - 2.0, z) for z in (100.0, 130.0, 160.0, 190.0)]
    baldas += [(105.0, 107.0, -46.0, -22.0, 90.0, 216.0), (405.0, 407.0, -46.0, -22.0, 90.0, 216.0), (105.0, 407.0, -46.0, -22.0, 214.0, 216.0), (105.0, 407.0, -46.0, -45.2, 90.0, 216.0)]
    pon(ue_cajas("Estanteria_Reactivos", baldas, "M_Laminado_Blanco"))
    pon(ue_caja("Bandeja", -15.25, 26.75, -33.0, -11.0, 90.0, 91.0, "M_Acero_Satinado"))
    # Proteccion junto a la puerta (pared derecha), tablero de misiones y residuos al fondo a la derecha.
    pon(ue_caja("Estante_Proteccion", 587.0, 600.0, 695.0, 795.0, 127.2, 128.7, "M_Acero_Satinado"))
    pon(ue_caja("Tablero", 462.0, 558.0, -46.0, -44.0, 125.0, 195.0, "M_Tablero", quitar=("+y",)))
    pon(ue_cilindros("Residuos", [(480.0, 30.0, 0.0, 14.0, 42.0)], "M_Residuos", lados=40))
    pon(ue_cilindros("Residuos_Embudo", [(480.0, 30.0, 42.0, 5.0, 3.0)], "M_HDPE"))
    # Ducha de emergencia con lavaojos en la esquina del fondo, sobre su zona marcada en el suelo.
    dx = -525.0
    pon(ue_cilindros("Ducha_Tubos", [(dx, -36.0, 0.0, 2.2, 232.0), (dx, 12.0, 96.0, 1.6, 6.0)], "M_Seguridad_Amarillo"))
    pon(ue_cajas("Ducha_Brazos", [(dx - 2, dx + 2, -36.0, 14.0, 228.0, 232.0), (dx - 1.5, dx + 1.5, -36.0, 12.0, 93.0, 96.0), (dx + 14, dx + 15, -12.0, -11.0, 165.0, 230.0),
                                  (dx - 2, dx + 15, -12.5, -10.5, 228.0, 230.0)], "M_Seguridad_Amarillo"))
    pon(ue_cilindros("Ducha_Cabezal", [(dx, 12.0, 220.0, 12.0, 4.0)], "M_Acero_Satinado", lados=32))
    pon(ue_cilindros("Ducha_Lavaojos", [(dx, 12.0, 100.0, 15.0, 5.0)], "M_Seguridad_Verde", lados=32))
    pon(ue_cajas("Ducha_Tirador", [(dx + 8, dx + 21, -13.0, -10.0, 160.0, 166.0)], "M_Rojo"))
    pon(ue_caja("Ducha_Zona", dx - 45, dx + 45, -44.0, 56.0, 0.0, 0.3, "M_Seguridad_Amarillo", quitar=("-z",)))

    # ---- Ampliacion del 20 de noviembre de 2026: laboratorio mas equipado (todo de diseno propio).
    # Repisa central de dos baldas sobre cada meseta y cuatro taburetes por meseta.
    repisas, asientos, pies = [], [], []
    for (cx, cy) in ISLAS:
        repisas += [(cx - 122, cx + 122, cy - 15, cy + 15, 118.0, 120.0), (cx - 122, cx + 122, cy - 15, cy + 15, 148.0, 150.0),
                    (cx - 124, cx - 120, cy - 15, cy + 15, 90.0, 150.0), (cx + 120, cx + 124, cy - 15, cy + 15, 90.0, 150.0), (cx - 2, cx + 2, cy - 15, cy + 15, 90.0, 150.0)]
        for sx in (-75.0, 75.0):
            for sy in (-84.0, 84.0):
                asientos.append((cx + sx, cy + sy, 62.0, 17.0, 4.0))
                pies += [(cx + sx, cy + sy, 3.0, 2.5, 59.0), (cx + sx, cy + sy, 0.0, 19.0, 3.0)]
    pon(ue_cajas("Mesetas_Repisas", repisas, "M_Laminado_Blanco", quitar=("-z",)))
    pon(ue_cilindros("Taburetes_Asientos", asientos, "M_Plastico_Negro", lados=20))
    pon(ue_cilindros("Taburetes_Pies", pies, "M_Acero_Satinado", lados=16))
    # Muebles altos sobre el banco de lavabos, escurridores de pared y dispensadores de papel.
    tiradores = []
    pon(ue_caja("Altos_Lavabos", 565.0, 599.0, 262.0, 498.0, 150.0, 220.0, "M_Laminado_Blanco"))
    juntas = [(564.6, 565.0, 262.0 + i * 59.0 - 0.3, 262.0 + i * 59.0 + 0.3, 151.0, 219.0) for i in range(1, 4)]
    tiradores += [(563.2, 565.0, 262.0 + i * 59.0 + (50.0 if i % 2 == 0 else 7.0), 262.0 + i * 59.0 + (52.0 if i % 2 == 0 else 9.0), 154.0, 170.0) for i in range(4)]
    pon(ue_cajas("Escurridores", [(597.0, 599.0, 150.0, 250.0, 125.0, 195.0), (597.0, 599.0, 510.0, 610.0, 125.0, 195.0)], "M_Tablero"))
    pivotes = [(588.0, 597.0, y0 + 12.0 + c * 19.0, y0 + 13.4 + c * 19.0, 135.0 + f * 18.0, 136.4 + f * 18.0) for y0 in (150.0, 510.0) for c in range(5) for f in range(3)]
    pon(ue_cajas("Escurridores_Pivotes", pivotes, "M_Acero_Satinado"))
    pon(ue_cajas("Dispensadores_Papel", [(589.0, 599.0, 118.0, 144.0, 128.0, 160.0), (589.0, 599.0, 616.0, 642.0, 128.0, 160.0)], "M_AC"))
    # Armarios altos de almacen en la pared de la entrada y armarios de seguridad junto a la puerta.
    cuerpos, zocalos = [], []
    for i in range(4):
        x0 = -560.0 + i * 80.0
        cuerpos.append((x0 + 0.5, x0 + 79.5, 809.0, 854.0, 8.0, 208.0))
        zocalos += [(x0 + 2.0, x0 + 78.0, 812.0, 854.0, 0.0, 8.0), (x0 + 39.7, x0 + 40.3, 808.7, 809.0, 10.0, 206.0)]
        tiradores += [(x0 + 35.5, x0 + 37.0, 807.2, 809.0, 95.0, 117.0), (x0 + 43.0, x0 + 44.5, 807.2, 809.0, 95.0, 117.0)]
    pon(ue_cajas("Armarios", cuerpos, "M_Laminado_Blanco", quitar=("-z",)))
    pon(ue_caja("Armario_Inflamables", 475.0, 535.0, 809.0, 854.0, 0.0, 165.0, "M_Seguridad_Amarillo", quitar=("-z",)))
    pon(ue_caja("Armario_Corrosivos", 537.0, 597.0, 809.0, 854.0, 0.0, 165.0, "M_Azul_Seguridad", quitar=("-z",)))
    for x0 in (475.0, 537.0):
        zocalos.append((x0 + 29.7, x0 + 30.3, 808.7, 809.0, 4.0, 161.0))
        tiradores += [(x0 + 25.5, x0 + 27.0, 807.2, 809.0, 80.0, 100.0), (x0 + 33.0, x0 + 34.5, 807.2, 809.0, 80.0, 100.0)]
    # Nevera de reactivos junto al banco de lavabos, bombonas de gas sujetas a la pared, carrito y papeleras.
    pon(ue_caja("Nevera", 538.0, 600.0, 30.0, 95.0, 0.0, 180.0, "M_AC", quitar=("-z",)))
    zocalos.append((537.7, 538.0, 30.0, 95.0, 119.7, 120.3))
    tiradores += [(536.2, 538.0, 84.0, 86.0, 126.0, 160.0), (536.2, 538.0, 84.0, 86.0, 80.0, 114.0)]
    pon(ue_cilindros("Bombonas", [(-583.0, 290.0, 0.0, 11.0, 130.0), (-583.0, 318.0, 0.0, 11.0, 130.0), (-583.0, 290.0, 130.0, 4.5, 14.0), (-583.0, 318.0, 130.0, 4.5, 14.0)], "M_AC", lados=28))
    pon(ue_cajas("Bombonas_Soporte", [(-599.0, -571.0, 276.0, 332.0, 96.0, 99.5), (-599.0, -571.0, 276.0, 332.0, 40.0, 43.5)], "M_Acero_Satinado"))
    pon(ue_cajas("Carrito", [(-590.0, -522.0, 432.0, 498.0, 28.0, 30.0), (-590.0, -522.0, 432.0, 498.0, 80.0, 82.0)]
                 + [(x, x + 2.0, y, y + 2.0, 6.0, 88.0) for x in (-590.0, -524.0) for y in (432.0, 496.0)], "M_Acero_Satinado"))
    pon(ue_cilindros("Papeleras", [(490.0, 672.0, 0.0, 14.0, 46.0), (268.0, 836.0, 0.0, 14.0, 46.0)], "M_Zocalo", lados=24))
    # Escritorio del profesor con monitor y silla, pizarra blanca y botiquin.
    pon(ue_cajas("Escritorio_Tablero", [(-80.0, 60.0, 782.0, 850.0, 72.0, 75.0), (-78.0, -75.0, 786.0, 850.0, 0.0, 72.0), (55.0, 58.0, 786.0, 850.0, 0.0, 72.0), (-75.0, 55.0, 846.0, 849.0, 30.0, 72.0)], "M_Puerta"))
    pon(ue_cajas("Escritorio_Negro", [(-32.0, 26.0, 838.0, 841.0, 92.0, 126.0), (-6.0, 0.0, 837.0, 843.0, 75.0, 93.0), (-14.0, 8.0, 832.0, 846.0, 75.0, 76.2), (-24.0, 18.0, 804.0, 818.0, 75.0, 76.6),
                                      (-26.0, 20.0, 728.0, 770.0, 44.0, 49.0), (-26.0, 20.0, 724.0, 729.0, 49.0, 92.0)], "M_Plastico_Negro"))
    pon(ue_cilindros("Escritorio_Silla_Pie", [(-3.0, 749.0, 4.0, 2.5, 40.0), (-3.0, 749.0, 0.0, 22.0, 4.0)], "M_Acero_Satinado", lados=16))
    pon(ue_caja("Pizarra", -93.0, 123.0, 852.6, 854.0, 107.0, 213.0, "M_Tablero", quitar=("-y",)))   # quitar va en ejes de Blender: -y es la cara contra la pared de la entrada
    pon(ue_cajas("Pizarra_Marco", [(-95.0, 125.0, 852.0, 854.0, 105.0, 107.0), (-95.0, 125.0, 852.0, 854.0, 213.0, 215.0), (-95.0, -93.0, 852.0, 854.0, 105.0, 215.0),
                                   (123.0, 125.0, 852.0, 854.0, 105.0, 215.0), (-60.0, 90.0, 848.0, 854.0, 103.0, 105.0)], "M_Marco_Ventana"))
    pon(ue_caja("Botiquin", 591.0, 600.0, 655.0, 685.0, 140.0, 172.0, "M_Tablero", quitar=("+x",)))
    # Conducto de extraccion de la campana hasta el techo.
    pon(ue_cilindros("Conducto_Campana", [(-30.0, 0.0, 244.0, 15.0, 76.0)], "M_Acero_Satinado", lados=32))
    pon(ue_cajas("Muebles_Juntas", zocalos + juntas, "M_Zocalo"))
    pon(ue_cajas("Muebles_Tiradores", tiradores, "M_Acero_Satinado"))
    return s


# ---------------------------------------------------------------- Luz

def leer_hdr(ruta):
    img = bpy.data.images.load(ruta)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return img, px.reshape(h, w, 4)[..., :3]


def luz():
    escena = bpy.context.scene
    ruta = os.path.join(TERCEROS, "polyhaven", "quadrangle_sunny", "quadrangle_sunny_2k.hdr")
    img, px = leer_hdr(ruta)
    h, w = px.shape[:2]
    lum = px @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    # Fila 0 de pixels es la de abajo (v = 0, nadir). Dirección en Blender: u = -atan2(y, x)/2π + 0.5, v = atan2(z, r)/π + 0.5.
    v = (np.arange(h) + 0.5) / h
    u = (np.arange(w) + 0.5) / w
    elev = (v - 0.5) * math.pi
    azim = -(u - 0.5) * 2 * math.pi
    omega = (math.pi / h) * (2 * math.pi / w) * np.cos(elev)[:, None] * np.ones((1, w), dtype=np.float32)   # ángulo sólido
    j, i = np.unravel_index(np.argmax(lum), lum.shape)
    sol_elev, sol_azim = float(elev[j]), float(azim[i])
    cielo = lum[(elev > math.radians(10))[:, None].repeat(w, 1) & (lum < lum.max() * 0.05)]
    cielo_med = float(np.median(cielo))
    # Irradiancia del disco (píxeles muy brillantes) sobre un plano normal al sol.
    d_sol = np.array([math.cos(sol_elev) * math.cos(sol_azim), math.cos(sol_elev) * math.sin(sol_azim), math.sin(sol_elev)])
    brillo = lum > max(cielo_med * 50.0, lum.max() * 0.02)
    dirs_x = np.cos(elev)[:, None] * np.cos(azim)[None, :]
    dirs_y = np.cos(elev)[:, None] * np.sin(azim)[None, :]
    dirs_z = np.sin(elev)[:, None] * np.ones((1, w))
    coseno = np.clip(dirs_x * d_sol[0] + dirs_y * d_sol[1] + dirs_z * d_sol[2], 0, 1)
    fuerza = (CIELO_NITS / LM_W) / cielo_med                                    # unidades del HDRI → radiancia de Blender
    e_disco = float(np.sum(lum[brillo] * omega[brillo] * coseno[brillo])) * fuerza    # W/m²
    e_sol = SOL_LUX / LM_W
    registrar("HDRI %dx%d: sol en elev %.1f° azim %.1f°, cielo mediano %.3f, fuerza %.2f, disco %.1f W/m² de %.1f"
              % (w, h, math.degrees(sol_elev), math.degrees(sol_azim), cielo_med, fuerza, e_disco, e_sol))

    # Dirección deseada (hacia el sol): por la ventana (x < 0) y desde el frente de la sala (-y en Blender), para que la
    # mancha caiga en diagonal hacia el fondo, delante de la estación. Se conserva la elevación del HDRI.
    objetivo_azim = math.atan2(-0.62, -0.78)
    giro = objetivo_azim - sol_azim
    mundo = bpy.data.worlds.new("Cielo")
    escena.world = mundo
    mundo.use_nodes = True
    nt = mundo.node_tree
    nt.nodes.clear()
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapa = nt.nodes.new("ShaderNodeMapping")
    mapa.vector_type = "VECTOR"
    mapa.inputs["Rotation"].default_value = (0.0, 0.0, -giro)    # buscar en R(-giro)·d: el sol aparece en R(giro)·s
    tex = nt.nodes.new("ShaderNodeTexEnvironment")
    tex.image = img
    fondo = nt.nodes.new("ShaderNodeBackground")
    fondo.inputs["Strength"].default_value = fuerza
    salida = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(coord.outputs["Generated"], mapa.inputs["Vector"])
    nt.links.new(mapa.outputs[0], tex.inputs["Vector"])
    nt.links.new(tex.outputs[0], fondo.inputs[0])
    nt.links.new(fondo.outputs[0], salida.inputs[0])

    sol_dir = Vector((math.cos(sol_elev) * math.cos(objetivo_azim), math.cos(sol_elev) * math.sin(objetivo_azim), math.sin(sol_elev)))
    falta = max(0.0, e_sol - e_disco)
    if falta > 0.5:
        datos = bpy.data.lights.new("Sol", type="SUN")
        datos.energy = falta
        datos.angle = math.radians(0.53)
        datos.color = (1.0, 0.96, 0.90)
        sol = bpy.data.objects.new("Sol", datos)
        sol.rotation_euler = (-sol_dir).to_track_quat("-Z", "Y").to_euler()
        escena.collection.objects.link(sol)
        registrar("SOL direccional de %.1f W/m² para completar el disco del HDRI" % falta)

    def area(nombre, pos, ancho, alto, lm, kelvin_rgb):
        d = bpy.data.lights.new(nombre, type="AREA")
        d.shape = "RECTANGLE"
        d.size, d.size_y = ancho, alto
        d.energy = lm / LM_W
        d.color = kelvin_rgb
        o = bpy.data.objects.new(nombre, d)
        o.location = pos
        escena.collection.objects.link(o)

    for i, (x, y) in enumerate(LEDS):
        area("LED_%d" % i, ue(x, y, ALTO - 1.0), 0.58, 0.58, LED_LM, (1.0, 0.93, 0.84))
    area("LED_Campana", ue(-30.0, 10.0, 236.0), 0.9, 0.2, CAMPANA_LM, (1.0, 0.95, 0.88))
    # Dirección del sol y giro del HDRI en coordenadas de three.js (x, y, z) = (x, z, -y) de Blender.
    return {
        "solDireccion": [sol_dir.x, sol_dir.z, -sol_dir.y],
        "solElevacionGrados": math.degrees(sol_elev),
        "hdriFuerza": fuerza,
        "hdriGiroBlenderRad": giro,
        "solLux": SOL_LUX, "cieloNits": CIELO_NITS, "ledLm": LED_LM,
        "leds": [[x, y, ALTO] for x, y in LEDS], "sala": [X0, X1, Y0, Y1, ALTO], "islas": ISLAS, "lavabos": list(LAVABOS_Y),
    }


# ---------------------------------------------------------------- Horneado

RESOLUCION = {
    "Suelo": 1536, "Techo": 768, "Pared_Fondo": 768, "Pared_Trasera": 768, "Pared_Derecha": 768,
    "Pared_Izq_Bajo": 512, "Pared_Izq_Alto": 256, "Campana_Sobremesa": 1024, "Encimera_Granito": 512, "Gabinete_Blanco": 512,
    "Encimera_Izquierda": 512, "Encimera_Derecha": 512, "Encimera_Lavabos": 512, "Lavabos_Cubetas": 256,
    "Estanteria_Reactivos": 512, "Estantes_Material": 256, "Tablero": 128, "Residuos": 128, "Puerta_Hoja": 128, "Puerta_Marco": 128,
    "Ducha_Zona": 64, "Zocalos": 256, "Mesetas_Repisas": 512, "Armarios": 512, "Altos_Lavabos": 256, "Taburetes_Asientos": 128, "Taburetes_Pies": 128,
    "Nevera": 128, "Armario_Inflamables": 128, "Armario_Corrosivos": 128, "Pizarra": 128, "Escritorio_Tablero": 256, "Escritorio_Negro": 128, "Escurridores": 128,
    "Carrito": 128, "Bombonas": 128, "Conducto_Campana": 128,
}
PREFIJOS = {"Gabinete_": 256, "Meseta_Cuerpo": 256, "Meseta_Granito": 512, "Pared_Izq_Pilar": 128, "Aire_": 64, "Ducha_": 64, "Ventana_": 64, "Alfeizar": 64, "Meseta_": 64}


def resolucion(nombre):
    if nombre in RESOLUCION:
        return RESOLUCION[nombre]
    for prefijo, valor in PREFIJOS.items():
        if nombre.startswith(prefijo):
            return valor
    return 64


def preparar_uv_luz(o):
    capas = o.data.uv_layers
    if "UVLightmap" in capas:
        capas.active = capas["UVLightmap"]
        return
    capas.new(name="UVLightmap")
    capas.active = capas["UVLightmap"]
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.04, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def suavizar(px, mascara, radio):
    """Quita ruido de Cycles sin mezclar islas: desenfoque gaussiano normalizado por la máscara de la isla."""
    if radio <= 0:
        return px
    n = int(math.ceil(radio * 2.5))
    k = np.exp(-0.5 * (np.arange(-n, n + 1) / radio) ** 2).astype(np.float32)
    k /= k.sum()

    def conv(a):
        a = np.apply_along_axis(lambda f: np.convolve(f, k, mode="same"), 0, a)
        return np.apply_along_axis(lambda f: np.convolve(f, k, mode="same"), 1, a)

    m = mascara.astype(np.float32)
    peso = conv(m)
    salida = np.empty_like(px)
    for c in range(3):
        salida[..., c] = np.where(peso > 1e-4, conv(px[..., c] * m) / np.maximum(peso, 1e-4), px[..., c])
    return salida


def hornear(objetos):
    escena = bpy.context.scene
    escena.render.engine = "CYCLES"
    escena.cycles.device = "CPU"
    escena.cycles.samples = MUESTRAS
    escena.cycles.use_denoising = False
    escena.cycles.max_bounces = 6
    escena.cycles.diffuse_bounces = 5
    escena.cycles.glossy_bounces = 2
    escena.cycles.transparent_max_bounces = 8
    escena.cycles.sample_clamp_indirect = 20.0
    escena.render.bake.use_pass_direct = True
    escena.render.bake.use_pass_indirect = True
    escena.render.bake.use_pass_color = False
    escena.render.bake.margin = 6
    escena.render.bake.use_clear = True
    os.makedirs(os.path.join(SALIDA, "lm"), exist_ok=True)
    hechos = {}
    for o in objetos:
        res = max(32, int(resolucion(o.name) * ESCALA_LM))
        preparar_uv_luz(o)
        img = bpy.data.images.new("LM_" + o.name, res, res, alpha=True, float_buffer=True)
        img.colorspace_settings.name = "Linear Rec.709"
        for ranura in o.material_slots:
            nt = ranura.material.node_tree
            nodo = nt.nodes.get("LM_BAKE") or nt.nodes.new("ShaderNodeTexImage")
            nodo.name = "LM_BAKE"
            nodo.image = img
            nt.nodes.active = nodo
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        t = time.time()
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, use_clear=True, margin=6)
        px = np.empty(res * res * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        px = px.reshape(res, res, 4)
        rgb = suavizar(px[..., :3], px[..., 3] > 0.5, radio=0.0 if RAPIDO else max(0.8, res / 900.0))
        px[..., :3] = rgb
        px[..., 3] = 1.0
        img.pixels.foreach_set(px.ravel())
        ruta = os.path.join(SALIDA, "lm", o.name + ".hdr")
        img.filepath_raw = ruta
        img.file_format = "HDR"
        img.save()
        hechos[o.name] = {"archivo": "lm/%s.hdr" % o.name, "resolucion": res, "max": float(rgb.max()), "media": float(rgb[px[..., 3] > 0].mean())}
        registrar("MAPA %s %dpx en %.0f s (media %.3f, máx %.2f)" % (o.name, res, time.time() - t, hechos[o.name]["media"], hechos[o.name]["max"]))
        for ranura in o.material_slots:
            nodo = ranura.material.node_tree.nodes.get("LM_BAKE")
            if nodo:
                ranura.material.node_tree.nodes.remove(nodo)
    return hechos


def exportar(datos):
    # El GLB lleva los dos juegos de UV: la UV activa de render primero (UVMap) y el mapa de luz como TEXCOORD_1.
    for o in bpy.data.objects:
        if o.type == "MESH":
            capas = o.data.uv_layers
            if "UVMap" in capas:
                capas["UVMap"].active_render = True
                capas.active = capas["UVMap"]
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=os.path.join(SALIDA, "sala.glb"), export_format="GLB", use_selection=False,
                              export_texcoords=True, export_normals=True, export_lights=False, export_cameras=False,
                              export_apply=True, export_yup=True, export_materials="EXPORT", export_image_format="NONE")
    with open(os.path.join(SALIDA, "escena.json"), "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=1)
    registrar("EXPORTADO %s" % SALIDA)


def main():
    t0 = time.time()
    limpiar()
    estacion = importar_estacion()
    sala = montar_sala()
    mobiliario = montar_mobiliario(estacion)
    luces = luz()
    horneables = [o for o in list(sala.values()) + list(mobiliario.values()) + estacion if o.name != "Campana_Guillotina"]
    mapas = hornear(horneables)
    exportar({"version": 2, "fecha": "2026-11-19", "muestras": MUESTRAS, "luz": luces, "mapas": mapas})
    registrar("TOTAL %.1f min" % ((time.time() - t0) / 60.0))


main()
