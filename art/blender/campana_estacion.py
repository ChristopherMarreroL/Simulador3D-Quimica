"""Estación de la campana: campana de sobremesa, encimera de granito con salpicadero y gabinete blanco.

  "C:\\Program Files\\Blender Foundation\\Blender 5.3\\blender.exe" -b --factory-startup -P art/blender/campana_estacion.py -- art/export [--render]

Exporta a la carpeta indicada (por defecto art/export):
  SM_Campana_Sobremesa.glb   cuerpo de la campana: laterales, techo, fondo, frontal superior, deflector
                             ranurado, perfil aerodinámico, llaves de servicio, collarín de extracción.
  SM_Campana_Guillotina.glb  ventana de guillotina (marco, vidrio de 6 mm y tirador), aparte porque es
                             translúcida y el juego la mueve en vertical.
  SM_Encimera_Granito.glb    encimera de 30 mm con vuelo frontal y salpicadero en el tramo libre.
  SM_Gabinete_Blanco.glb     mueble bajo laminado: cuerpo, zócalo retranqueado, puertas, cajones y tiradores.
  campana_estacion_preview.png (con --render): vista previa en Cycles.

Convenciones (las mismas de los demás guiones de art/blender):
  - Metros, Z arriba, frente hacia -Y. Las cuatro piezas comparten el origen: suelo, centro del módulo de
    1800 mm, así que en Unreal se colocan con la misma transformación.
  - UV0 («UVMap»): proyección cúbica a escala real (1 unidad UV = 1 m) para los materiales procedurales.
  - UV1 («UVLightmap»): desplegado sin solapes con margen, para el mapa de luz horneado de Lightmass.
  - Colisión: cajas convexas UCX_<malla>_NN dentro del mismo GLB (prefijo que reconoce el importador).
  - Bordes biselados de 1,5 a 3 mm para que los bordes capten brillos (sin ellos la luz horneada se ve plana).

MEDIDAS. Se toman de las fichas de catálogo de docs/ASSETS.md (b.1), que es lo único contrastado:
  - Campana: ancho exterior 1200 mm, ancho libre interior 1150 mm, fondo 900 mm y abertura de la ventana
    en la posición de ensayo de 500 mm (ficha [1], que declara EN 14175); abertura máxima 860 mm (ficha [2]).
  - Encimera: altura de trabajo 900 mm, fondo 600 a 900 mm y largo en múltiplos de 300 mm (EN 13150, [5]).
  NO están contrastadas y son decisión de diseño: la versión «de sobremesa» (ASSETS.md la marca como sin
  verificar), el alto libre de 1500 mm sobre la encimera, los espesores de chapa, el deflector (ranuras de
  30 mm), la posición y los colores de las llaves de servicio (no se contrastaron con EN 13792), los 30 mm
  del granito, los 100 mm del salpicadero y del zócalo y los frentes del gabinete.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

MM = 0.001

# ---------------------------------------------------------------- Medidas (m)

MODULO_ANCHO = 1.800          # encimera y gabinete: múltiplo de 300 mm (EN 13150)
FONDO = 0.900                 # fondo de la encimera y de la campana
ALTURA_TRABAJO = 0.900        # EN 13150, de pie
GRANITO = 0.030
VUELO = 0.020                 # vuelo frontal del granito sobre el gabinete
SALPICADERO_ALTO = 0.100
SALPICADERO_GRUESO = 0.020
ZOCALO = 0.100
ZOCALO_RETRANQUEO = 0.050

CAMPANA_ANCHO = 1.200         # ficha [1]
CAMPANA_INTERIOR = 1.150      # ficha [1]
CAMPANA_ALTO = 1.550          # sobre la encimera (decisión de diseño)
CAMPANA_X = -MODULO_ANCHO / 2 + CAMPANA_ANCHO / 2   # alineada a la izquierda del módulo
APERTURA_ENSAYO = 0.500       # ficha [1]
GUILLOTINA_ALTO = 0.900

LATERAL = (CAMPANA_ANCHO - CAMPANA_INTERIOR) / 2    # 25 mm por lado
Y_FRENTE = -FONDO / 2
Y_FONDO = FONDO / 2
Z0 = ALTURA_TRABAJO
Z_TECHO = Z0 + CAMPANA_ALTO


# ---------------------------------------------------------------- Materiales (solo para la vista previa; Unreal usa los suyos por nombre)

MATERIALES = {
    # nombre: (color base lineal, metálico, rugosidad, transmisión, emisión)
    "M_Granito_AzulPerla": ((0.020, 0.024, 0.032, 1), 0.0, 0.12, 0.0, 0.0),
    "M_Laminado_Blanco": ((0.78, 0.78, 0.76, 1), 0.0, 0.42, 0.0, 0.0),
    "M_Acero_Pintado_Blanco": ((0.80, 0.81, 0.80, 1), 0.0, 0.32, 0.0, 0.0),
    "M_Resina_Interior": ((0.70, 0.72, 0.71, 1), 0.0, 0.55, 0.0, 0.0),
    "M_Acero_Satinado": ((0.62, 0.62, 0.62, 1), 1.0, 0.30, 0.0, 0.0),
    "M_Aluminio_Anodizado": ((0.55, 0.56, 0.58, 1), 1.0, 0.40, 0.0, 0.0),
    "M_Vidrio_Guillotina": ((0.96, 0.98, 0.98, 1), 0.0, 0.02, 1.0, 0.0),
    "M_Plastico_Negro": ((0.02, 0.02, 0.022, 1), 0.0, 0.45, 0.0, 0.0),
    "M_Zocalo": ((0.035, 0.037, 0.04, 1), 0.0, 0.6, 0.0, 0.0),
    "M_Llave_Azul": ((0.02, 0.12, 0.55, 1), 0.0, 0.35, 0.0, 0.0),
    "M_Llave_Amarillo": ((0.80, 0.55, 0.02, 1), 0.0, 0.35, 0.0, 0.0),
    "M_Llave_Verde": ((0.03, 0.35, 0.08, 1), 0.0, 0.35, 0.0, 0.0),
    "M_Panel_Control": ((0.01, 0.012, 0.015, 1), 0.0, 0.08, 0.0, 0.0),
    "M_LED_Emisivo": ((1.0, 0.98, 0.94, 1), 0.0, 0.5, 0.0, 6.0),
}


def material(nombre):
    mat = bpy.data.materials.get(nombre)
    if mat:
        return mat
    color, metal, rugosidad, transmision, emision = MATERIALES[nombre]
    mat = bpy.data.materials.new(nombre)
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rugosidad
    if transmision:
        b.inputs["Transmission Weight"].default_value = transmision
        b.inputs["IOR"].default_value = 1.52   # vidrio de sosa y cal (valor habitual, sin fuente citada)
    if emision:
        b.inputs["Emission Color"].default_value = color
        b.inputs["Emission Strength"].default_value = emision
    return mat


# ---------------------------------------------------------------- Primitivas

def caja(bm, x0, x1, y0, y1, z0, z1, bisel=2.0 * MM):
    """Caja alineada con los ejes entre dos esquinas, con todos los bordes biselados."""
    geom = bmesh.ops.create_cube(bm, size=1.0)
    verts = geom["verts"]
    escala = Matrix.Diagonal(Vector((x1 - x0, y1 - y0, z1 - z0, 1.0)))
    bmesh.ops.transform(bm, matrix=Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)) @ escala, verts=verts)
    if bisel > 0:
        lado = min(x1 - x0, y1 - y0, z1 - z0)
        aristas = list({e for v in verts for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=aristas, offset=min(bisel, lado * 0.3), segments=2, profile=0.5, affect="EDGES", clamp_overlap=True)


def cilindro(bm, centro, radio, largo, eje="Z", lados=24):
    """Cilindro cerrado centrado en `centro` y orientado según `eje`."""
    giro = {"Z": Matrix.Identity(4), "X": Matrix.Rotation(math.radians(90), 4, "Y"), "Y": Matrix.Rotation(math.radians(90), 4, "X")}[eje]
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=lados, radius1=radio, radius2=radio, depth=largo,
                          matrix=Matrix.Translation(centro) @ giro)


def pieza(nombre, mat, construir):
    """Objeto de una sola malla y un material, construido con bmesh."""
    bm = bmesh.new()
    construir(bm)
    malla = bpy.data.meshes.new(nombre)
    bm.to_mesh(malla)
    bm.free()
    obj = bpy.data.objects.new(nombre, malla)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material(mat))
    return obj


def unir(nombre, partes):
    bpy.ops.object.select_all(action="DESELECT")
    for p in partes:
        p.select_set(True)
    bpy.context.view_layer.objects.active = partes[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = obj.data.name = nombre
    return obj


def colision(nombre, cajas):
    """Cajas UCX_<malla>_NN sin material: el importador las convierte en colisión simple de la malla."""
    objs = []
    for i, (x0, x1, y0, y1, z0, z1) in enumerate(cajas):
        o = pieza(f"UCX_{nombre}_{i:02d}", "M_Plastico_Negro", lambda bm, c=(x0, x1, y0, y1, z0, z1): caja(bm, *c, bisel=0))
        o.data.materials.clear()
        objs.append(o)
    return objs


def acabar(obj):
    """Normales con aristas vivas por ángulo, UV0 a escala real y UV1 para el mapa de luz."""
    malla = obj.data
    for p in malla.polygons:
        p.use_smooth = True
    malla.set_sharp_from_angle(angle=math.radians(35))
    while malla.uv_layers:
        malla.uv_layers.remove(malla.uv_layers[0])
    malla.uv_layers.new(name="UVMap")
    malla.uv_layers.new(name="UVLightmap")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    malla.uv_layers.active = malla.uv_layers["UVMap"]
    bpy.ops.uv.cube_project(cube_size=1.0, correct_aspect=True, clip_to_bounds=False, scale_to_bounds=False)
    malla.uv_layers.active = malla.uv_layers["UVLightmap"]
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.01, area_weight=0.0, correct_aspect=True, scale_to_bounds=True)
    bpy.ops.uv.pack_islands(rotate=True, margin=0.008)
    bpy.ops.object.mode_set(mode="OBJECT")
    malla.uv_layers.active = malla.uv_layers["UVMap"]
    malla.uv_layers["UVMap"].active_render = True


# ---------------------------------------------------------------- Piezas

def campana():
    xc, xi0, xi1 = CAMPANA_X, CAMPANA_X - CAMPANA_INTERIOR / 2, CAMPANA_X + CAMPANA_INTERIOR / 2
    xe0, xe1 = CAMPANA_X - CAMPANA_ANCHO / 2, CAMPANA_X + CAMPANA_ANCHO / 2
    blanco, resina, acero, negro = "M_Acero_Pintado_Blanco", "M_Resina_Interior", "M_Acero_Satinado", "M_Plastico_Negro"
    partes = []
    # Envolvente de chapa: laterales, techo, fondo y frontal superior (detrás de él sube la guillotina).
    partes.append(pieza("lat_izq", blanco, lambda bm: caja(bm, xe0, xi0, Y_FRENTE, Y_FONDO, Z0, Z_TECHO)))
    partes.append(pieza("lat_der", blanco, lambda bm: caja(bm, xi1, xe1, Y_FRENTE, Y_FONDO, Z0, Z_TECHO)))
    partes.append(pieza("techo", blanco, lambda bm: caja(bm, xi0, xi1, Y_FRENTE, Y_FONDO, Z_TECHO - 0.05, Z_TECHO)))
    partes.append(pieza("fondo", blanco, lambda bm: caja(bm, xi0, xi1, Y_FONDO - 0.03, Y_FONDO, Z0, Z_TECHO - 0.05)))
    frontal_z0 = Z0 + 1.05
    partes.append(pieza("frontal", blanco, lambda bm: caja(bm, xi0, xi1, Y_FRENTE, Y_FRENTE + 0.03, frontal_z0, Z_TECHO - 0.05)))
    # Revestimiento interior de resina (5 mm), separado de la chapa para que no haya caras coincidentes.
    yi0, yi1 = Y_FRENTE + 0.07, Y_FONDO - 0.032
    partes.append(pieza("forro_izq", resina, lambda bm: caja(bm, xi0, xi0 + 0.005, yi0, yi1, Z0 + 0.002, Z_TECHO - 0.052, 1.0 * MM)))
    partes.append(pieza("forro_der", resina, lambda bm: caja(bm, xi1 - 0.005, xi1, yi0, yi1, Z0 + 0.002, Z_TECHO - 0.052, 1.0 * MM)))
    # Deflector ranurado: panel a 60 mm del fondo con hueco inferior y dos ranuras horizontales de 30 mm.
    yd0, yd1 = Y_FONDO - 0.032 - 0.060 - 0.006, Y_FONDO - 0.032 - 0.060
    tramos = [(Z0 + 0.060, Z0 + 0.600), (Z0 + 0.630, Z0 + 1.150), (Z0 + 1.180, Z_TECHO - 0.08)]
    for i, (z0, z1) in enumerate(tramos):
        partes.append(pieza(f"deflector_{i}", resina, lambda bm, z0=z0, z1=z1: caja(bm, xi0 + 0.006, xi1 - 0.006, yd0, yd1, z0, z1, 1.5 * MM)))
    for x in (xi0 + 0.15, xc, xi1 - 0.15):   # soportes del deflector
        partes.append(pieza("soporte", acero, lambda bm, x=x: caja(bm, x - 0.012, x + 0.012, yd1, Y_FONDO - 0.032, Z0 + 0.3, Z0 + 0.33, 1.0 * MM)))
    # Perfil aerodinámico frontal (acero satinado): barra redondeada sobre una pletina.
    def perfil(bm):
        caja(bm, xi0, xi1, Y_FRENTE - 0.012, Y_FRENTE + 0.045, Z0, Z0 + 0.006, 1.0 * MM)
        cilindro(bm, (xc, Y_FRENTE - 0.002, Z0 + 0.018), 0.014, CAMPANA_INTERIOR, eje="X", lados=28)
    partes.append(pieza("perfil", acero, perfil))
    # Llaves de servicio en el lateral derecho interior, 15 cm por detrás de la guillotina.
    for i, color in enumerate(("M_Llave_Azul", "M_Llave_Amarillo", "M_Llave_Verde")):
        z = Z0 + 0.10 + i * 0.085
        y = Y_FRENTE + 0.20
        x = xi1 - 0.005
        partes.append(pieza("brida", acero, lambda bm, y=y, z=z, x=x: cilindro(bm, (x - 0.004, y, z), 0.026, 0.008, eje="X", lados=24)))
        partes.append(pieza("cuerpo", acero, lambda bm, y=y, z=z, x=x: cilindro(bm, (x - 0.035, y, z), 0.011, 0.055, eje="X", lados=18)))
        partes.append(pieza("boquilla", acero, lambda bm, y=y, z=z, x=x: cilindro(bm, (x - 0.058, y, z - 0.018), 0.006, 0.036, eje="Z", lados=14)))
        partes.append(pieza("maneta", color, lambda bm, y=y, z=z, x=x: caja(bm, x - 0.046, x - 0.030, y - 0.040, y + 0.010, z + 0.010, z + 0.022, 2.0 * MM)))
    # Panel de control en el frontal (pantalla oscura) con un piloto LED.
    partes.append(pieza("panel", "M_Panel_Control", lambda bm: caja(bm, xi1 - 0.20, xi1 - 0.06, Y_FRENTE - 0.004, Y_FRENTE + 0.001, Z_TECHO - 0.22, Z_TECHO - 0.15, 1.0 * MM)))
    partes.append(pieza("piloto", "M_LED_Emisivo", lambda bm: cilindro(bm, (xi1 - 0.23, Y_FRENTE - 0.004, Z_TECHO - 0.185), 0.005, 0.006, eje="Y", lados=12)))
    # Luminaria LED del techo interior (la luz real la ponen las luces del nivel).
    partes.append(pieza("luminaria", "M_LED_Emisivo", lambda bm: caja(bm, xc - 0.45, xc + 0.45, Y_FRENTE + 0.25, Y_FRENTE + 0.45, Z_TECHO - 0.056, Z_TECHO - 0.050, 1.0 * MM)))
    # Collarín de extracción en el techo y junta negra.
    partes.append(pieza("collarin", acero, lambda bm: cilindro(bm, (xc, 0.10, Z_TECHO + 0.075), 0.125, 0.15, lados=40)))
    partes.append(pieza("junta", negro, lambda bm: cilindro(bm, (xc, 0.10, Z_TECHO + 0.005), 0.135, 0.01, lados=40)))
    # Guías de la guillotina (perfiles negros a cada lado).
    for x0, x1 in ((xi0, xi0 + 0.012), (xi1 - 0.012, xi1)):
        partes.append(pieza("guia", negro, lambda bm, x0=x0, x1=x1: caja(bm, x0, x1, Y_FRENTE + 0.031, Y_FRENTE + 0.062, Z0 + 0.01, frontal_z0 + 0.3, 1.0 * MM)))
    obj = unir("SM_Campana_Sobremesa", partes)
    cajas = [(xe0, xi0, Y_FRENTE, Y_FONDO, Z0, Z_TECHO), (xi1, xe1, Y_FRENTE, Y_FONDO, Z0, Z_TECHO),
             (xi0, xi1, Y_FRENTE, Y_FONDO, Z_TECHO - 0.05, Z_TECHO + 0.15), (xi0, xi1, Y_FONDO - 0.10, Y_FONDO, Z0, Z_TECHO),
             (xi0, xi1, Y_FRENTE, Y_FRENTE + 0.03, frontal_z0, Z_TECHO)]
    return obj, colision("SM_Campana_Sobremesa", cajas)


def guillotina():
    """Ventana en la posición de ensayo: 500 mm libres sobre la encimera."""
    xi0, xi1 = CAMPANA_X - CAMPANA_INTERIOR / 2 + 0.013, CAMPANA_X + CAMPANA_INTERIOR / 2 - 0.013
    z0 = Z0 + APERTURA_ENSAYO
    z1 = z0 + GUILLOTINA_ALTO
    y0, y1 = Y_FRENTE + 0.036, Y_FRENTE + 0.058
    alu = "M_Aluminio_Anodizado"
    partes = [
        pieza("travesano_inf", alu, lambda bm: caja(bm, xi0, xi1, y0, y1, z0, z0 + 0.060, 2.0 * MM)),
        pieza("travesano_sup", alu, lambda bm: caja(bm, xi0, xi1, y0, y1, z1 - 0.035, z1, 2.0 * MM)),
        pieza("montante_izq", alu, lambda bm: caja(bm, xi0, xi0 + 0.030, y0, y1, z0 + 0.060, z1 - 0.035, 2.0 * MM)),
        pieza("montante_der", alu, lambda bm: caja(bm, xi1 - 0.030, xi1, y0, y1, z0 + 0.060, z1 - 0.035, 2.0 * MM)),
        # Vidrio laminado de 6 mm, encajado 8 mm en el marco.
        pieza("vidrio", "M_Vidrio_Guillotina", lambda bm: caja(bm, xi0 + 0.022, xi1 - 0.022, (y0 + y1) / 2 - 0.003, (y0 + y1) / 2 + 0.003, z0 + 0.052, z1 - 0.027, 1.0 * MM)),
    ]
    # Tirador corrido de acero satinado con dos soportes.
    xm = (xi0 + xi1) / 2
    partes.append(pieza("tirador", "M_Acero_Satinado", lambda bm: cilindro(bm, (xm, y0 - 0.032, z0 + 0.030), 0.010, 0.70, eje="X", lados=24)))
    for dx in (-0.32, 0.32):
        partes.append(pieza("soporte_tirador", "M_Acero_Satinado", lambda bm, dx=dx: cilindro(bm, (xm + dx, y0 - 0.016, z0 + 0.030), 0.007, 0.034, eje="Y", lados=16)))
    obj = unir("SM_Campana_Guillotina", partes)
    return obj, colision("SM_Campana_Guillotina", [(xi0, xi1, y0 - 0.045, y1, z0, z1)])


def encimera():
    x0, x1 = -MODULO_ANCHO / 2, MODULO_ANCHO / 2
    partes = [pieza("tablero", "M_Granito_AzulPerla", lambda bm: caja(bm, x0, x1, Y_FRENTE - VUELO, Y_FONDO, Z0 - GRANITO, Z0, 3.0 * MM))]
    # Salpicadero solo en el tramo que no ocupa la campana.
    xs = CAMPANA_X + CAMPANA_ANCHO / 2 + 0.002
    partes.append(pieza("salpicadero", "M_Granito_AzulPerla", lambda bm: caja(bm, xs, x1, Y_FONDO - SALPICADERO_GRUESO, Y_FONDO, Z0, Z0 + SALPICADERO_ALTO, 2.0 * MM)))
    obj = unir("SM_Encimera_Granito", partes)
    return obj, colision("SM_Encimera_Granito", [(x0, x1, Y_FRENTE - VUELO, Y_FONDO, Z0 - GRANITO, Z0), (xs, x1, Y_FONDO - SALPICADERO_GRUESO, Y_FONDO, Z0, Z0 + SALPICADERO_ALTO)])


def gabinete():
    x0, x1 = -MODULO_ANCHO / 2, MODULO_ANCHO / 2
    z_top = Z0 - GRANITO
    yf = Y_FRENTE + 0.020                       # cara del cuerpo, detrás de los frentes de 18 mm
    blanco = "M_Laminado_Blanco"
    partes = [
        pieza("cuerpo", blanco, lambda bm: caja(bm, x0, x1, yf, Y_FONDO - 0.02, ZOCALO, z_top, 1.5 * MM)),
        pieza("zocalo", "M_Zocalo", lambda bm: caja(bm, x0 + 0.01, x1 - 0.01, yf + ZOCALO_RETRANQUEO, Y_FONDO - 0.03, 0.0, ZOCALO, 1.0 * MM)),
    ]
    rendija = 0.003
    yfr0, yfr1 = yf - 0.018, yf
    zf0, zf1 = ZOCALO + rendija, z_top - rendija
    frentes = []
    # Dos puertas bajo la campana.
    xh0, xh1 = x0, CAMPANA_X + CAMPANA_ANCHO / 2
    xm = (xh0 + xh1) / 2
    frentes += [("puerta", xh0 + rendija, xm - rendija / 2, zf0, zf1, "v_der"), ("puerta", xm + rendija / 2, xh1 - rendija / 2, zf0, zf1, "v_izq")]
    # Tres cajones en el tramo libre.
    alto = (zf1 - zf0) / 3
    for i in range(3):
        frentes.append(("cajon", xh1 + rendija / 2, x1 - rendija, zf0 + i * alto + rendija / 2, zf0 + (i + 1) * alto - rendija / 2, "h"))
    for tipo, a, b, c0, c1, tirador in frentes:
        partes.append(pieza(tipo, blanco, lambda bm, a=a, b=b, c0=c0, c1=c1: caja(bm, a, b, yfr0, yfr1, c0, c1, 1.5 * MM)))
        # Tiradores de barra de acero satinado (160 mm, separados 25 mm del frente).
        if tirador == "h":
            centro = ((a + b) / 2, yfr0 - 0.025, c1 - 0.045)
            partes.append(pieza("tirador", "M_Acero_Satinado", lambda bm, ce=centro: cilindro(bm, ce, 0.006, 0.16, eje="X", lados=16)))
            for dx in (-0.064, 0.064):
                partes.append(pieza("pata", "M_Acero_Satinado", lambda bm, ce=centro, dx=dx: cilindro(bm, (ce[0] + dx, ce[1] + 0.0125, ce[2]), 0.004, 0.025, eje="Y", lados=12)))
        else:
            xt = b - 0.05 if tirador == "v_der" else a + 0.05
            centro = (xt, yfr0 - 0.025, c1 - 0.16)
            partes.append(pieza("tirador", "M_Acero_Satinado", lambda bm, ce=centro: cilindro(bm, ce, 0.006, 0.16, eje="Z", lados=16)))
            for dz in (-0.064, 0.064):
                partes.append(pieza("pata", "M_Acero_Satinado", lambda bm, ce=centro, dz=dz: cilindro(bm, (ce[0], ce[1] + 0.0125, ce[2] + dz), 0.004, 0.025, eje="Y", lados=12)))
    obj = unir("SM_Gabinete_Blanco", partes)
    return obj, colision("SM_Gabinete_Blanco", [(x0, x1, yfr0, Y_FONDO, 0.0, z_top)])


# ---------------------------------------------------------------- Exportación y vista previa

def exportar(obj, colisiones, out):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    for c in colisiones:
        c.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=str(out / (obj.name + ".glb")), use_selection=True, export_apply=True,
                              export_texcoords=True, export_normals=True, export_materials="EXPORT")


def vista_previa(objs, colisiones, ruta):
    scene = bpy.context.scene
    for c in colisiones:
        c.hide_render = True
    # Suelo, pared del fondo y una ventana (luz de área fría) a la izquierda; luz cálida de techo.
    suelo = pieza("Suelo", "M_Zocalo", lambda bm: caja(bm, -3, 3, -3, 1.2, -0.01, 0.0, 0))
    suelo.data.materials[0] = bpy.data.materials.new("Suelo_Vista")
    suelo.data.materials[0].use_nodes = True
    suelo.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.18, 0.18, 0.17, 1)
    suelo.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.35
    pared = pieza("Pared", "M_Laminado_Blanco", lambda bm: caja(bm, -3, 3, 0.46, 0.5, 0.0, 3.0, 0))
    pared.data.materials[0] = bpy.data.materials.new("Pared_Vista")
    pared.data.materials[0].use_nodes = True
    pared.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.62, 0.63, 0.62, 1)
    world = bpy.data.worlds.new("Mundo")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.35, 0.38, 0.42, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    scene.world = world
    ventana = bpy.data.objects.new("Ventana", bpy.data.lights.new("Ventana", "AREA"))
    ventana.data.energy, ventana.data.size, ventana.data.color = 900, 2.0, (0.85, 0.92, 1.0)
    ventana.location, ventana.rotation_euler = (-2.6, -1.2, 1.8), (math.radians(90), 0, math.radians(-60))
    scene.collection.objects.link(ventana)
    techo = bpy.data.objects.new("Techo", bpy.data.lights.new("Techo", "AREA"))
    techo.data.energy, techo.data.size, techo.data.color = 250, 0.6, (1.0, 0.95, 0.88)
    techo.location = (0.6, -1.2, 2.9)
    scene.collection.objects.link(techo)
    interior = bpy.data.objects.new("Interior", bpy.data.lights.new("Interior", "AREA"))
    interior.data.energy, interior.data.size = 40, 0.8
    interior.location = (CAMPANA_X, -0.1, Z_TECHO - 0.08)
    scene.collection.objects.link(interior)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.lens = 26
    cam.location = (1.75, -3.05, 1.60)
    direccion = Vector((-0.30, 0.0, 1.22)) - cam.location
    cam.rotation_euler = direccion.to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "CYCLES"
    scene.cycles.samples, scene.cycles.device, scene.cycles.use_denoising = 64, "CPU", True
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = -1.2
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.render.filepath = str(ruta)
    bpy.ops.render.render(write_still=True)


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = (Path(args[0]) if args and not args[0].startswith("--") else Path("art/export")).resolve()
    out.mkdir(parents=True, exist_ok=True)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    piezas = [campana(), guillotina(), encimera(), gabinete()]
    todas_colisiones = []
    for obj, colisiones in piezas:
        acabar(obj)
        d = obj.dimensions
        tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        print(f"PIEZA {obj.name} mm=({d.x*1000:.0f}, {d.y*1000:.0f}, {d.z*1000:.0f}) tris={tris} colisiones={len(colisiones)} "
              f"uv={[u.name for u in obj.data.uv_layers]} materiales={[m.name for m in obj.data.materials]}")
        exportar(obj, colisiones, out)
        todas_colisiones += colisiones
    if "--render" in args:
        vista_previa([p[0] for p in piezas], todas_colisiones, out / "campana_estacion_preview.png")
    print("EXPORT_OK")


if __name__ == "__main__":
    main()
