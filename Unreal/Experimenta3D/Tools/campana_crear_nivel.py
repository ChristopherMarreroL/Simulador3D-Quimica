# -*- coding: utf-8 -*-
"""Nivel /Game/Mapas/Campana: estación de la campana con luz horneada (ruta del 18 de noviembre de 2026).

    UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script=<este archivo> -nullrhi -unattended -nosplash -nosound

Antes: art/blender/campana_estacion.py, art/blender/texturas_procedurales.py y Tools/campana_importar.py.
Después se hornea la luz (necesita render, no admite -nullrhi):

    UnrealEditor-Cmd.exe <uproject> -run=ResavePackages -map=/Game/Mapas/Campana -buildlighting
        -buildreflectioncaptures -quality=Production -allowcommandletrendering -unattended -nopause -nosplash

Lo que monta (es repetible: borra y rehace el contenido del nivel):
  - Sala propia de 5,0 × 4,7 × 3,0 m (medidas de diseño, no del laboratorio real) con ventana de 2,6 × 1,6 m
    en la pared izquierda, suelo de vinilo, paredes pintadas y techo.
  - La estación (campana de sobremesa, guillotina, encimera de granito, gabinete) contra la pared del fondo
    y cristalería ya importada sobre la encimera y dentro de la campana.
  - Luces ESTÁTICAS (todo horneado con Lightmass, coste de sombras nulo en tiempo de ejecución): sol y cielo
    a través de la ventana, cuatro paneles LED de 60 × 60 cm en el techo y la luminaria de la campana.
  - Capturas de reflejos esféricas (sala y campana) para los reflejos base; el SSR se suma por perfil.
  - Post-proceso de cámara física: exposición manual (ISO 400, 1/60 s, f/2,8 → EV100 ≈ 6,9, la de un
    interior de unos 500 lx), balance de blancos, viñeta, grano y aberración cromática leves, bloom.
  - Cámara fija que se activa para el jugador 0 (las capturas y la medición salen de esta vista).
"""
import math
import os

import unreal

MAPA = "/Game/Mapas/Campana"
RAIZ = "/Game/Laboratorio/Campana"
MATERIALES = RAIZ + "/Materiales"
TEXTURAS = RAIZ + "/Texturas"
MALLA_ESTACION = RAIZ + "/%s/%s/StaticMeshes/%s"
MALLA_IMPORTADA = "/Game/Laboratorio/Importado/%s/%s/StaticMeshes/%s"
CUBO = "/Engine/BasicShapes/Cube.Cube"
PROYECTO = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
ORIGEN_TEXTURAS = os.path.normpath(os.path.join(PROYECTO, "..", "..", "art", "export", "texturas"))

eal = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary
P = unreal.MaterialProperty
ESTATICO = unreal.ComponentMobility.STATIC

# Sala (cm, ejes de Unreal: la estación mira hacia +Y; su fondo está en y = -45).
X0, X1 = -250.0, 250.0
Y0, Y1 = -46.0, 424.0
ALTO = 300.0
MURO = 20.0
VENTANA_Y = (40.0, 300.0)
VENTANA_Z = (85.0, 245.0)


def _num(nombre, defecto):
    return float(os.environ.get(nombre, defecto))


# v2 (18 de noviembre de 2026). Se pueden cambiar por variables de entorno para probar sin editar el guion.
SOL_LUX = _num("CAMPANA_SOL_LUX", 45000.0)
SOL_CABECEO = _num("CAMPANA_SOL_CABECEO", -35.0)
SOL_GUINADA = _num("CAMPANA_SOL_GUINADA", -25.0)
LED_LM = _num("CAMPANA_LED_LM", 2400.0)
CIELO_CD = _num("CAMPANA_CIELO_CD", 9000.0)
LM_CALIDAD = _num("CAMPANA_LM_CALIDAD", 3.0)
LM_ESCALA = _num("CAMPANA_LM_ESCALA", 0.7)
EXPOSICION = _num("CAMPANA_EXPOSICION", -3.2)
CAMARA_ORIGEN = (_num("CAMPANA_CAM_X", 235.0), _num("CAMPANA_CAM_Y", 415.0), _num("CAMPANA_CAM_Z", 160.0))
CAMARA_OBJETIVO = (_num("CAMPANA_OBJ_X", -80.0), _num("CAMPANA_OBJ_Y", 30.0), _num("CAMPANA_OBJ_Z", 125.0))
CAMARA_FOV = _num("CAMPANA_FOV", 68.0)


def registrar(texto):
    unreal.log("[CampanaNivel] " + texto)


def rot(cabeceo=0.0, guinada=0.0, alabeo=0.0):
    return unreal.Rotator(roll=alabeo, pitch=cabeceo, yaw=guinada)


# ---------------------------------------------------------------- Texturas

TERCEROS = os.path.normpath(os.path.join(PROYECTO, "..", "..", "art", "terceros"))
# Texturas CC0 descargadas el 18 de noviembre de 2026 (registro en docs/ASSETS.md, apartado c.5): archivo, nombre, tipo.
CC0 = [
    ("ambientcg/Metal009/Metal009_2K-JPG_Color.jpg", "T_CC0_Acero_BC", "color"),
    ("ambientcg/Metal009/Metal009_2K-JPG_Roughness.jpg", "T_CC0_Acero_R", "lineal"),
    ("ambientcg/Metal009/Metal009_2K-JPG_NormalDX.jpg", "T_CC0_Acero_N", "normal"),
    ("ambientcg/Plastic010/Plastic010_2K-JPG_Roughness.jpg", "T_CC0_Plastico_R", "lineal"),
    ("ambientcg/Plastic010/Plastic010_2K-JPG_NormalDX.jpg", "T_CC0_Plastico_N", "normal"),
    ("ambientcg/OfficeCeiling001/OfficeCeiling001_2K-JPG_Color.jpg", "T_CC0_Techo_BC", "color"),
    ("ambientcg/OfficeCeiling001/OfficeCeiling001_2K-JPG_Roughness.jpg", "T_CC0_Techo_R", "lineal"),
    ("ambientcg/OfficeCeiling001/OfficeCeiling001_2K-JPG_NormalDX.jpg", "T_CC0_Techo_N", "normal"),
    ("polyhaven/marble_01/marble_01_diff_2k.jpg", "T_CC0_Suelo_BC", "color"),
    ("polyhaven/marble_01/marble_01_rough_2k.jpg", "T_CC0_Suelo_R", "lineal"),
    ("polyhaven/marble_01/marble_01_nor_dx_2k.jpg", "T_CC0_Suelo_N", "normal"),
    ("polyhaven/plastered_wall_04/plastered_wall_04_diff_2k.jpg", "T_CC0_Pared_BC", "color"),
    ("polyhaven/plastered_wall_04/plastered_wall_04_rough_2k.jpg", "T_CC0_Pared_R", "lineal"),
    ("polyhaven/plastered_wall_04/plastered_wall_04_nor_dx_2k.jpg", "T_CC0_Pared_N", "normal"),
    ("polyhaven/quadrangle_sunny/quadrangle_sunny_2k.hdr", "T_CC0_Cielo_HDR", "hdr"),
]


def importar_cc0():
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    for relativo, nombre, tipo in CC0:
        origen = os.path.join(TERCEROS, *relativo.split("/"))
        if not os.path.isfile(origen):
            raise RuntimeError("Falta el recurso CC0 " + origen)
        task = unreal.AssetImportTask()
        task.filename, task.destination_path, task.destination_name = origen, TEXTURAS, nombre
        task.automated, task.replace_existing, task.save = True, True, True
        tools.import_asset_tasks([task])
        tex = eal.load_asset(TEXTURAS + "/" + nombre)
        if not isinstance(tex, unreal.Texture):
            raise RuntimeError("No se importó " + origen)
        if tipo == "lineal":
            tex.set_editor_property("srgb", False)
            tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_MASKS)
        elif tipo == "normal":
            tex.set_editor_property("srgb", False)
            tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
        eal.save_loaded_asset(tex, only_if_is_dirty=False)
        registrar("CC0 %s -> %s (%s)" % (relativo, nombre, type(tex).__name__))


def importar_texturas():
    importar_cc0()
    lineales = {"T_Granito_AzulPerla_M", "T_Granito_Oscuro_M", "T_Ruido_Fino", "T_Acero_Cepillado", "T_Suelo_Vinilo_R"}
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    for archivo in sorted(os.listdir(ORIGEN_TEXTURAS)):
        if not archivo.endswith(".png"):
            continue
        nombre = archivo[:-4]
        task = unreal.AssetImportTask()
        task.filename, task.destination_path = os.path.join(ORIGEN_TEXTURAS, archivo), TEXTURAS
        task.automated, task.replace_existing, task.save = True, True, True
        tools.import_asset_tasks([task])
        tex = eal.load_asset(TEXTURAS + "/" + nombre)
        if not isinstance(tex, unreal.Texture2D):
            raise RuntimeError("No se importó la textura " + archivo)
        if nombre in lineales:
            tex.set_editor_property("srgb", False)
            tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_MASKS)
        eal.save_loaded_asset(tex, only_if_is_dirty=False)
    registrar("TEXTURAS importadas desde " + ORIGEN_TEXTURAS)


def textura(nombre):
    tex = eal.load_asset(TEXTURAS + "/" + nombre)
    if tex is None:
        raise RuntimeError("Falta la textura " + nombre)
    return tex


# ---------------------------------------------------------------- Materiales

def marcar_uso(mat, guardar=True):
    """Indicador de uso «luz estática»: sin él, en el juego (no en el editor) se ve el material por defecto
    sobre mallas con mapa de luz. El editor lo pone solo al abrir el nivel; un commandlet no."""
    if not mat.get_editor_property("used_with_static_lighting"):
        mat.set_editor_property("used_with_static_lighting", True)
        if guardar:
            mel.recompile_material(mat)
            eal.save_loaded_asset(mat, only_if_is_dirty=False)

class Grafo(object):
    """Ayudante para montar un material con MaterialEditingLibrary."""

    def __init__(self, nombre, borrar=False):
        ruta = MATERIALES + "/" + nombre
        if borrar and eal.does_asset_exist(ruta):
            eal.delete_asset(ruta)
        if eal.does_asset_exist(ruta):
            self.mat = eal.load_asset(ruta)
            mel.delete_all_material_expressions(self.mat)
        else:
            self.mat = unreal.AssetToolsHelpers.get_asset_tools().create_asset(nombre, MATERIALES, unreal.Material, unreal.MaterialFactoryNew())
        self.y = 0

    def nodo(self, clase, **props):
        n = mel.create_material_expression(self.mat, clase, -600, self.y)
        self.y += 140
        for clave, valor in props.items():
            n.set_editor_property(clave, valor)
        return n

    def const(self, valor):
        return self.nodo(unreal.MaterialExpressionConstant, r=valor)

    def color(self, rgb):
        return self.nodo(unreal.MaterialExpressionConstant3Vector, constant=unreal.LinearColor(rgb[0], rgb[1], rgb[2], 1.0))

    def uv(self, metros):
        return self.nodo(unreal.MaterialExpressionTextureCoordinate, coordinate_index=0, u_tiling=1.0 / metros, v_tiling=1.0 / metros)

    def uv_mundo(self, metros, desplazamiento=(0.0, 0.0), paredes=False):
        """Coordenadas en el plano XY del mundo (o XZ/YZ según la normal, para paredes): las cajas del motor
        escaladas tienen UV 0–1 por cara y estirarían la textura."""
        pos = self.nodo(unreal.MaterialExpressionWorldPosition)
        if paredes:
            xz = self.nodo(unreal.MaterialExpressionComponentMask, r=True, g=False, b=True, a=False)
            yz = self.nodo(unreal.MaterialExpressionComponentMask, r=False, g=True, b=True, a=False)
            mel.connect_material_expressions(pos, "", xz, "")
            mel.connect_material_expressions(pos, "", yz, "")
            nx = self.nodo(unreal.MaterialExpressionComponentMask, r=True, g=False, b=False, a=False)
            mel.connect_material_expressions(self.nodo(unreal.MaterialExpressionVertexNormalWS), "", nx, "")
            ab = self.nodo(unreal.MaterialExpressionAbs)
            mel.connect_material_expressions(nx, "", ab, "")
            rd = self.nodo(unreal.MaterialExpressionRound)
            mel.connect_material_expressions(ab, "", rd, "")
            plano = self.nodo(unreal.MaterialExpressionLinearInterpolate)
            mel.connect_material_expressions(xz, "", plano, "A")
            mel.connect_material_expressions(yz, "", plano, "B")
            mel.connect_material_expressions(rd, "", plano, "Alpha")
        else:
            plano = self.nodo(unreal.MaterialExpressionComponentMask, r=True, g=True, b=False, a=False)
            mel.connect_material_expressions(pos, "", plano, "")
        suma = self.nodo(unreal.MaterialExpressionAdd)
        mel.connect_material_expressions(plano, "", suma, "A")
        mel.connect_material_expressions(self.nodo(unreal.MaterialExpressionConstant2Vector, r=desplazamiento[0] * 100.0, g=desplazamiento[1] * 100.0), "", suma, "B")
        esc = self.nodo(unreal.MaterialExpressionMultiply, const_b=1.0 / (metros * 100.0))
        mel.connect_material_expressions(suma, "", esc, "A")
        return esc

    def tex(self, nombre, uv, lineal=False, normal=False):
        tipo = unreal.MaterialSamplerType
        n = self.nodo(unreal.MaterialExpressionTextureSample, texture=textura(nombre),
                      sampler_type=tipo.SAMPLERTYPE_NORMAL if normal else (tipo.SAMPLERTYPE_MASKS if lineal else tipo.SAMPLERTYPE_COLOR))
        mel.connect_material_expressions(uv, "", n, "UVs")
        return n

    def normal(self, nombre, uv, fuerza):
        """Mapa normal atenuado hacia (0, 0, 1): fuerza 1 = el mapa tal cual."""
        l = self.nodo(unreal.MaterialExpressionLinearInterpolate, const_alpha=1.0 - fuerza)
        mel.connect_material_expressions(self.tex(nombre, uv, normal=True), "RGB", l, "A")
        mel.connect_material_expressions(self.color((0.0, 0.0, 1.0)), "", l, "B")
        self.a(l, P.MP_NORMAL)
        return l

    def mult(self, a, b, salida_a="", salida_b=""):
        n = self.nodo(unreal.MaterialExpressionMultiply)
        mel.connect_material_expressions(a, salida_a, n, "A")
        mel.connect_material_expressions(b, salida_b, n, "B")
        return n

    def lerp(self, a, b, alfa, salida="R"):
        n = self.nodo(unreal.MaterialExpressionLinearInterpolate, const_a=a, const_b=b)
        mel.connect_material_expressions(alfa, salida, n, "Alpha")
        return n

    def a(self, nodo, propiedad, salida=""):
        mel.connect_material_property(nodo, salida, propiedad)

    def fin(self):
        marcar_uso(self.mat, guardar=False)
        mel.recompile_material(self.mat)
        eal.save_loaded_asset(self.mat, only_if_is_dirty=False)
        return self.mat


def pbr(nombre, base, rugosidad, metalico=0.0, especular=0.5, ruido=None, ruido_textura="T_Ruido_Fino", ruido_m=0.5):
    """Material opaco: color constante y rugosidad constante o variada entre (min, max) con una textura de ruido."""
    g = Grafo(nombre)
    g.a(g.color(base), P.MP_BASE_COLOR)
    g.a(g.const(metalico), P.MP_METALLIC)
    g.a(g.const(especular), P.MP_SPECULAR)
    if ruido:
        g.a(g.lerp(ruido[0], ruido[1], g.tex(ruido_textura, g.uv(ruido_m), lineal=True)), P.MP_ROUGHNESS)
    else:
        g.a(g.const(rugosidad), P.MP_ROUGHNESS)
    return g.fin()


def granito():
    # v2: granito pulido gris oscuro de grano fino derivado de ambientCG Granite002A (art/blender/texturas_cc0.py).
    # Destello azulado SUTIL: solo en los granos marcados y con el ángulo rasante (Fresnel).
    g = Grafo("M_Granito_Oscuro")
    uv = g.uv(0.5)
    color = g.tex("T_Granito_Oscuro_BC", uv)
    mascaras = g.tex("T_Granito_Oscuro_M", uv, lineal=True)
    fresnel = g.nodo(unreal.MaterialExpressionFresnel, exponent=3.0, base_reflect_fraction=0.15)
    destello = g.nodo(unreal.MaterialExpressionMultiply)
    mel.connect_material_expressions(mascaras, "G", destello, "A")
    mel.connect_material_expressions(fresnel, "", destello, "B")
    azul = g.nodo(unreal.MaterialExpressionMultiply)
    mel.connect_material_expressions(destello, "", azul, "A")
    mel.connect_material_expressions(g.color((0.006, 0.010, 0.022)), "", azul, "B")
    suma = g.nodo(unreal.MaterialExpressionAdd)
    mel.connect_material_expressions(color, "RGB", suma, "A")
    mel.connect_material_expressions(azul, "", suma, "B")
    g.a(suma, P.MP_BASE_COLOR)
    g.a(mascaras, P.MP_ROUGHNESS, "R")
    g.a(g.const(0.0), P.MP_METALLIC)
    g.a(g.const(0.5), P.MP_SPECULAR)
    return g.fin()


def vinilo():
    g = Grafo("M_Suelo_Vinilo")
    uv = g.uv(1.0)
    g.a(g.tex("T_Suelo_Vinilo_BC", uv), P.MP_BASE_COLOR, "RGB")
    g.a(g.tex("T_Suelo_Vinilo_R", uv, lineal=True), P.MP_ROUGHNESS, "R")
    g.a(g.const(0.5), P.MP_SPECULAR)
    return g.fin()


def suelo_porcelanato():
    # Poly Haven marble_01 (CC0): baldosa clara lisa, cubre 1,5 m; desaturada hacia gris claro y algo pulida.
    g = Grafo("M_Suelo_Porcelanato")
    uv = g.uv_mundo(1.5)
    des = g.nodo(unreal.MaterialExpressionDesaturation)
    mel.connect_material_expressions(g.tex("T_CC0_Suelo_BC", uv), "RGB", des, "")
    mel.connect_material_expressions(g.const(0.8), "", des, "Fraction")
    g.a(g.mult(des, g.color((0.80, 0.82, 0.86))), P.MP_BASE_COLOR)
    g.a(g.lerp(0.16, 0.42, g.tex("T_CC0_Suelo_R", uv, lineal=True)), P.MP_ROUGHNESS)
    g.normal("T_CC0_Suelo_N", uv, 0.6)
    g.a(g.const(0.5), P.MP_SPECULAR)
    return g.fin()


def pared():
    # Poly Haven plastered_wall_04 (CC0): solo modula un blanco roto (la textura es gris) y aporta relieve suave.
    g = Grafo("M_Pared_Pintura")
    uv = g.uv_mundo(2.0, paredes=True)
    var = g.lerp(0.90, 1.06, g.tex("T_CC0_Pared_BC", uv), salida="G")
    g.a(g.mult(var, g.color((0.60, 0.60, 0.58))), P.MP_BASE_COLOR)
    g.a(g.lerp(0.72, 0.95, g.tex("T_CC0_Pared_R", uv, lineal=True)), P.MP_ROUGHNESS)
    g.normal("T_CC0_Pared_N", uv, 0.35)
    return g.fin()


def techo():
    # ambientCG OfficeCeiling001 (CC0): placas de 60 cm (6 × 6 en la textura = 3,6 m), desplazadas para que las
    # juntas encuadren los paneles LED (centros en x = ±120, y = 70 / 270).
    g = Grafo("M_Techo")
    uv = g.uv_mundo(3.6, desplazamiento=(0.30, 0.40))
    g.a(g.mult(g.tex("T_CC0_Techo_BC", uv), g.const(0.82), "RGB"), P.MP_BASE_COLOR)
    g.a(g.lerp(0.75, 0.95, g.tex("T_CC0_Techo_R", uv, lineal=True)), P.MP_ROUGHNESS)
    g.normal("T_CC0_Techo_N", uv, 0.8)
    return g.fin()


def acero_cc0():
    # ambientCG Metal009 (CC0): acero cepillado; el color de la textura como F0 metálico.
    g = Grafo("M_Acero_Satinado")
    uv = g.uv(0.3)
    g.a(g.mult(g.tex("T_CC0_Acero_BC", uv), g.const(0.95), "RGB"), P.MP_BASE_COLOR)
    g.a(g.const(1.0), P.MP_METALLIC)
    g.a(g.lerp(0.18, 0.38, g.tex("T_CC0_Acero_R", uv, lineal=True)), P.MP_ROUGHNESS)
    g.normal("T_CC0_Acero_N", uv, 0.5)
    return g.fin()


def blanco_cc0(nombre, base, rugosidad, metros=0.5):
    # ambientCG Plastic010 (CC0): solo rugosidad y una piel de naranja muy leve sobre un blanco constante.
    g = Grafo(nombre)
    uv = g.uv(metros)
    g.a(g.color(base), P.MP_BASE_COLOR)
    g.a(g.lerp(rugosidad[0], rugosidad[1], g.tex("T_CC0_Plastico_R", uv, lineal=True)), P.MP_ROUGHNESS)
    g.normal("T_CC0_Plastico_N", uv, 0.25)
    g.a(g.const(0.5), P.MP_SPECULAR)
    return g.fin()


# Giro (grados, eje Z) del HDRI visto por la ventana y luminancia de su cielo (nits por unidad del HDRI).
CIELO_GIRO = 140.0
CIELO_ESCALA = 3500.0
CIELO_TOPE = 20000.0


def cielo():
    """Fondo exterior visto por la ventana: Poly Haven quadrangle_sunny (CC0), sin iluminar y recortado (el
    disco solar del HDRI no ilumina nada: la luz del sol la pone la luz direccional horneada)."""
    g = Grafo("M_Cielo_HDRI", borrar=True)
    g.mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
    g.mat.set_editor_property("two_sided", True)
    hdr = textura("T_CC0_Cielo_HDR")
    giro = math.radians(CIELO_GIRO)
    cam = g.nodo(unreal.MaterialExpressionCameraVectorWS)
    cubo = isinstance(hdr, unreal.TextureCube)
    codigo = ("float3 d = -D; float c = %.6f, s = %.6f; d = float3(c * d.x - s * d.y, s * d.x + c * d.y, d.z);" % (math.cos(giro), math.sin(giro)))
    if cubo:
        codigo += " return d;"
    else:
        codigo += " d = normalize(d); return float3(atan2(d.y, d.x) / 6.2831853 + 0.5, acos(clamp(d.z, -1.0, 1.0)) / 3.1415927, 0.0);"
    entrada = unreal.CustomInput()
    entrada.set_editor_property("input_name", "D")
    dir_ = g.nodo(unreal.MaterialExpressionCustom, code=codigo,
                  output_type=unreal.CustomMaterialOutputType.CMOT_FLOAT3 if cubo else unreal.CustomMaterialOutputType.CMOT_FLOAT2,
                  inputs=[entrada])
    mel.connect_material_expressions(cam, "", dir_, "D")
    muestra = g.nodo(unreal.MaterialExpressionTextureSample, texture=hdr,
                     sampler_type=unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR)
    mel.connect_material_expressions(dir_, "", muestra, "UVs")
    esc = g.mult(muestra, g.const(CIELO_ESCALA), "RGB")
    tope = g.nodo(unreal.MaterialExpressionMin, const_b=CIELO_TOPE)
    mel.connect_material_expressions(esc, "", tope, "A")
    g.a(tope, P.MP_EMISSIVE_COLOR)
    registrar("CIELO %s" % ("TextureCube" if cubo else "Texture2D latitud-longitud"))
    return g.fin()


def vidrio(nombre, transmitancia, opacidad_centro=0.03, rugosidad=0.02):
    """Vidrio con grosor real en la malla (las dos caras y los cantos): «Thin Translucent» por superficie."""
    g = Grafo(nombre, borrar=True)   # delete_all_material_expressions no borra la salida Thin Translucent
    m = g.mat
    m.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
    m.set_editor_property("two_sided", True)
    m.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_THIN_TRANSLUCENT)
    m.set_editor_property("translucency_lighting_mode", unreal.TranslucencyLightingMode.TLM_SURFACE_PER_PIXEL_LIGHTING)
    m.set_editor_property("screen_space_reflections", True)
    g.a(g.color((0.02, 0.02, 0.02)), P.MP_BASE_COLOR)
    g.a(g.const(0.0), P.MP_METALLIC)
    g.a(g.const(0.5), P.MP_SPECULAR)
    g.a(g.const(rugosidad), P.MP_ROUGHNESS)
    salida = g.nodo(unreal.MaterialExpressionThinTranslucentMaterialOutput)
    mel.connect_material_expressions(g.color(transmitancia), "", salida, "TransmittanceColor")
    g.a(g.nodo(unreal.MaterialExpressionFresnel, exponent=5.0, base_reflect_fraction=opacidad_centro), P.MP_OPACITY)
    return g.fin()


def emisivo(nombre, rgb, nits):
    """Superficie que emite (LED, exterior por la ventana). Sin iluminar: su brillo es el de la emisión."""
    g = Grafo(nombre)
    g.mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
    g.a(g.color((rgb[0] * nits, rgb[1] * nits, rgb[2] * nits)), P.MP_EMISSIVE_COLOR)
    return g.fin()


def crear_materiales():
    # Albedos lineales estimados (no medidos): blanco laminado ~0,60, pintura en polvo ~0,64, resina ~0,50,
    # acero inoxidable F0 ~0,57, aluminio ~0,80. Rugosidades de aspecto.
    m = {
        "M_Granito_AzulPerla": granito(),
        "M_Laminado_Blanco": blanco_cc0("M_Laminado_Blanco", (0.60, 0.60, 0.58), (0.30, 0.46)),
        "M_Acero_Pintado_Blanco": blanco_cc0("M_Acero_Pintado_Blanco", (0.64, 0.65, 0.64), (0.22, 0.34)),
        "M_Resina_Interior": pbr("M_Resina_Interior", (0.50, 0.52, 0.51), 0.5, ruido=(0.44, 0.58)),
        "M_Acero_Satinado": acero_cc0(),
        "M_Aluminio_Anodizado": pbr("M_Aluminio_Anodizado", (0.80, 0.80, 0.81), 0.35, metalico=1.0, ruido=(0.30, 0.40)),
        "M_Plastico_Negro": pbr("M_Plastico_Negro", (0.022, 0.022, 0.024), 0.45),
        "M_Zocalo": pbr("M_Zocalo", (0.03, 0.032, 0.035), 0.55),
        "M_Llave_Azul": pbr("M_Llave_Azul", (0.02, 0.10, 0.45), 0.35),
        "M_Llave_Amarillo": pbr("M_Llave_Amarillo", (0.75, 0.48, 0.02), 0.35),
        "M_Llave_Verde": pbr("M_Llave_Verde", (0.02, 0.30, 0.06), 0.35),
        "M_Panel_Control": pbr("M_Panel_Control", (0.008, 0.009, 0.011), 0.06),
        # Vidrio de sosa y cal de 6 mm: leve tinte verde en transmisión.
        "M_Vidrio_Guillotina": vidrio("M_Vidrio_Guillotina", (0.90, 0.95, 0.93)),
        "M_LED_Emisivo": emisivo("M_LED_Emisivo", (1.0, 0.96, 0.90), 400.0),
        "M_Suelo_Vinilo": suelo_porcelanato(),   # clave antigua; el material es M_Suelo_Porcelanato (CC0)
        "M_Pared_Pintura": pared(),
        "M_Techo": techo(),
        "M_Marco_Ventana": pbr("M_Marco_Ventana", (0.70, 0.70, 0.70), 0.35, ruido=(0.3, 0.4)),
        "M_Cielo_HDRI": cielo(),
    }
    registrar("MATERIALES %d creados en %s" % (len(m), MATERIALES))
    return m


# ---------------------------------------------------------------- Nivel

def main():
    importar_texturas()
    mats = crear_materiales()
    vidrio_boro = eal.load_asset("/Game/Laboratorio/Materiales/M_Vidrio_Boro")
    graduacion = eal.load_asset("/Game/Laboratorio/Materiales/M_Graduacion")
    ambar = eal.load_asset("/Game/Laboratorio/Materiales/M_Vidrio_Ambar")
    tapa = eal.load_asset("/Game/Laboratorio/Materiales/M_Tapa_PP_Azul")
    for compartido in (vidrio_boro, graduacion, ambar, tapa, eal.load_asset("/Game/Laboratorio/Materiales/M_Lab_HDPE")):
        marcar_uso(compartido)

    niveles = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actores = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if eal.does_asset_exist(MAPA):
        niveles.load_level(MAPA)
        for actor in actores.get_all_level_actors():
            if not isinstance(actor, unreal.WorldSettings):
                actores.destroy_actor(actor)
    elif not niveles.new_level(MAPA):
        raise RuntimeError("new_level devolvió False para " + MAPA)
    mundo = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()

    def actor(clase, nombre, posicion, rotacion=None):
        a = actores.spawn_actor_from_class(clase, unreal.Vector(*posicion), rotacion or rot())
        if a is None:
            raise RuntimeError("No se pudo crear " + nombre)
        a.set_actor_label(nombre)
        return a

    cubo = eal.load_asset(CUBO)

    def bloque(nombre, x0, x1, y0, y1, z0, z1, mat, resolucion=128, sombra=True):
        a = actor(unreal.StaticMeshActor, nombre, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
        a.set_actor_scale3d(unreal.Vector((x1 - x0) / 100.0, (y1 - y0) / 100.0, (z1 - z0) / 100.0))
        c = a.static_mesh_component
        c.set_static_mesh(cubo)
        c.set_mobility(ESTATICO)
        c.set_material(0, mat)
        c.set_editor_property("override_light_map_res", True)
        c.set_editor_property("overridden_light_map_res", resolucion)
        c.set_editor_property("cast_shadow", sombra)
        return a

    def malla(nombre, ruta, posicion, materiales, rotacion=None, resolucion=None):
        recurso = eal.load_asset(ruta)
        if recurso is None:
            raise RuntimeError("No existe la malla " + ruta)
        a = actor(unreal.StaticMeshActor, nombre, posicion, rotacion)
        c = a.static_mesh_component
        c.set_static_mesh(recurso)
        c.set_mobility(ESTATICO)
        for i, ranura in enumerate(recurso.static_materials):
            clave = str(ranura.material_slot_name)
            mat = materiales.get(clave) if isinstance(materiales, dict) else materiales
            if mat is None:
                raise RuntimeError("Sin material para la ranura %s de %s" % (clave, nombre))
            c.set_material(i, mat)
        if resolucion:
            c.set_editor_property("override_light_map_res", True)
            c.set_editor_property("overridden_light_map_res", resolucion)
        return a

    # --- Sala: muros de 20 cm que se solapan en las esquinas (sin rendijas por las que se cuele la luz).
    # v2: la losa es una caja con poca resolución y la cara visible un plano con su mapa de luz entero (en la caja
    # del motor la cara superior solo ocupa una parte del mapa, y salían manchas).
    bloque("Suelo_Losa", X0 - MURO, X1 + MURO, Y0 - MURO, Y1 + MURO, -MURO, -0.2, mats["M_Suelo_Vinilo"], 32)
    suelo = actor(unreal.StaticMeshActor, "Suelo", ((X0 + X1) / 2, (Y0 + Y1) / 2, 0.0))
    suelo.set_actor_scale3d(unreal.Vector((X1 - X0) / 100.0, (Y1 - Y0) / 100.0, 1.0))
    cs_suelo = suelo.static_mesh_component
    cs_suelo.set_static_mesh(eal.load_asset("/Engine/BasicShapes/Plane.Plane"))
    cs_suelo.set_mobility(ESTATICO)
    cs_suelo.set_material(0, mats["M_Suelo_Vinilo"])
    cs_suelo.set_editor_property("override_light_map_res", True)
    cs_suelo.set_editor_property("overridden_light_map_res", 1024)
    bloque("Techo", X0 - MURO, X1 + MURO, Y0 - MURO, Y1 + MURO, ALTO, ALTO + MURO, mats["M_Techo"], 512)
    bloque("Pared_Fondo", X0 - MURO, X1 + MURO, Y0 - MURO, Y0, -MURO, ALTO + MURO, mats["M_Pared_Pintura"], 512)
    bloque("Pared_Trasera", X0 - MURO, X1 + MURO, Y1, Y1 + MURO, -MURO, ALTO + MURO, mats["M_Pared_Pintura"], 256)
    bloque("Pared_Derecha", X1, X1 + MURO, Y0 - MURO, Y1 + MURO, -MURO, ALTO + MURO, mats["M_Pared_Pintura"], 512)
    # Pared izquierda con el hueco de la ventana.
    xa, xb = X0 - MURO, X0
    bloque("Pared_Izq_Bajo", xa, xb, Y0 - MURO, Y1 + MURO, -MURO, VENTANA_Z[0], mats["M_Pared_Pintura"], 256)
    bloque("Pared_Izq_Alto", xa, xb, Y0 - MURO, Y1 + MURO, VENTANA_Z[1], ALTO + MURO, mats["M_Pared_Pintura"], 256)
    bloque("Pared_Izq_Fondo", xa, xb, Y0 - MURO, VENTANA_Y[0], VENTANA_Z[0], VENTANA_Z[1], mats["M_Pared_Pintura"], 128)
    bloque("Pared_Izq_Frente", xa, xb, VENTANA_Y[1], Y1 + MURO, VENTANA_Z[0], VENTANA_Z[1], mats["M_Pared_Pintura"], 128)
    # Carpintería de la ventana: marco perimetral, parteluz central y alféizar.
    marco = mats["M_Marco_Ventana"]
    ym = (VENTANA_Y[0] + VENTANA_Y[1]) / 2
    bloque("Marco_Inf", xa + 6, xb - 6, VENTANA_Y[0], VENTANA_Y[1], VENTANA_Z[0], VENTANA_Z[0] + 6, marco, 64)
    bloque("Marco_Sup", xa + 6, xb - 6, VENTANA_Y[0], VENTANA_Y[1], VENTANA_Z[1] - 6, VENTANA_Z[1], marco, 64)
    bloque("Marco_Fondo", xa + 6, xb - 6, VENTANA_Y[0], VENTANA_Y[0] + 6, VENTANA_Z[0], VENTANA_Z[1], marco, 64)
    bloque("Marco_Frente", xa + 6, xb - 6, VENTANA_Y[1] - 6, VENTANA_Y[1], VENTANA_Z[0], VENTANA_Z[1], marco, 64)
    bloque("Parteluz", xa + 6, xb - 6, ym - 3, ym + 3, VENTANA_Z[0], VENTANA_Z[1], marco, 64)
    bloque("Alfeizar", xb - 2, xb + 14, VENTANA_Y[0] - 8, VENTANA_Y[1] + 8, VENTANA_Z[0] - 3, VENTANA_Z[0], mats["M_Granito_AzulPerla"], 128)
    # Exterior (v2): esfera de 60 m con el HDRI CC0, móvil (sin mapa de luz ni coste de horneado) y sin sombra.
    esfera = actor(unreal.StaticMeshActor, "Cielo_HDRI", (0.0, 190.0, 150.0))
    esfera.set_actor_scale3d(unreal.Vector(60.0, 60.0, 60.0))
    ce = esfera.static_mesh_component
    ce.set_static_mesh(eal.load_asset("/Engine/BasicShapes/Sphere.Sphere"))
    ce.set_mobility(unreal.ComponentMobility.MOVABLE)
    ce.set_material(0, mats["M_Cielo_HDRI"])
    ce.set_editor_property("cast_shadow", False)
    ce.set_collision_profile_name("NoCollision")
    ce.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)

    # --- Estación y cristalería.
    estacion = {n: mats[n] for n in mats}
    for nombre, res in (("SM_Gabinete_Blanco", 512), ("SM_Encimera_Granito", 1024), ("SM_Campana_Sobremesa", 1024), ("SM_Campana_Guillotina", None)):
        malla(nombre.replace("SM_", ""), MALLA_ESTACION % (nombre, nombre, nombre), (0, 0, 0), estacion, resolucion=res)
    hdpe = eal.load_asset("/Game/Laboratorio/Materiales/M_Lab_HDPE")
    cristal = {"M_Glass_Boro": vidrio_boro, "M_Glass_Bottle": vidrio_boro, "M_Graduacion": graduacion, "M_Glass_Amber": ambar,
               "M_Cap_PP_Blue": tapa, "M_HDPE": hdpe}
    z = 90.0
    for nombre, recurso, pos, giro in (
            ("Matraz_500", "SM_Erlenmeyer_500", (-48.0, 2.0, z), 20.0),
            ("Vaso_250", "SM_Beaker_250", (-18.0, 14.0, z), -35.0),
            ("Probeta_100", "SM_GradCylinder_100", (-70.0, -14.0, z), 10.0),
            ("Frasco_Ambar", "SM_ReagentBottle_500", (50.0, -22.0, z), 0.0),
            ("Frasco_Claro", "SM_ReagentBottle_500", (68.0, -18.0, z), 0.0),
            ("Vaso_500", "SM_Beaker_500", (42.0, 8.0, z), 60.0),
            ("Piseta", "SM_WashBottle_500", (72.0, 14.0, z), 0.0)):
        mats_pieza = dict(cristal)
        if nombre == "Frasco_Ambar":
            mats_pieza["M_Glass_Boro"] = mats_pieza["M_Glass_Bottle"] = ambar
        try:
            malla(nombre, MALLA_IMPORTADA % (recurso, recurso, recurso), pos, mats_pieza, rotacion=rot(guinada=giro))
        except RuntimeError as error:
            # La piseta y otros objetos tienen ranuras propias (HDPE…): se usa el blanco laminado si falta alguna.
            registrar("CRISTALERIA_AVISO %s: %s" % (nombre, error))
            recurso_malla = eal.load_asset(MALLA_IMPORTADA % (recurso, recurso, recurso))
            if recurso_malla is None:
                continue
            otros = {str(r.material_slot_name): mats_pieza.get(str(r.material_slot_name), mats["M_Laminado_Blanco"]) for r in recurso_malla.static_materials}
            malla(nombre, MALLA_IMPORTADA % (recurso, recurso, recurso), pos, otros, rotacion=rot(guinada=giro))
    for nombre, x, y in (("Tapa_Ambar", 50.0, -22.0), ("Tapa_Claro", 68.0, -18.0)):
        malla(nombre, MALLA_IMPORTADA % ("SM_Cap_GL45", "SM_Cap_GL45", "SM_Cap_GL45"), (x, y, z + 15.5), cristal)

    # --- Luces estáticas.
    def luz_rect(nombre, pos, rotacion, ancho, alto, intensidad, unidades, kelvin):
        a = actor(unreal.RectLight, nombre, pos, rotacion)
        c = a.rect_light_component
        c.set_mobility(ESTATICO)
        c.set_editor_property("intensity_units", unidades)
        c.set_editor_property("intensity", intensidad)
        c.set_editor_property("source_width", ancho)
        c.set_editor_property("source_height", alto)
        c.set_editor_property("use_temperature", True)
        c.set_editor_property("temperature", kelvin)
        c.set_editor_property("attenuation_radius", 1200.0)
        return a

    # Paneles LED de techo: 60 × 60 cm, unos 3000 lm a 4000 K (valores típicos de catálogo, sin ficha concreta).
    for i, (x, y) in enumerate(((-120.0, 70.0), (120.0, 70.0), (-120.0, 270.0), (120.0, 270.0))):
        luz_rect("LED_Techo_%d" % i, (x, y, ALTO - 2.0), rot(cabeceo=-90.0), 58.0, 58.0, LED_LM, unreal.LightUnits.LUMENS, 4000.0)
        bloque("Panel_LED_%d" % i, x - 30, x + 30, y - 30, y + 30, ALTO - 1.5, ALTO, mats["M_LED_Emisivo"], 16, sombra=False)
    # Luminaria de la campana (detrás de su difusor, en el techo interior).
    luz_rect("LED_Campana", (-30.0, 10.0, 238.0), rot(cabeceo=-90.0), 90.0, 20.0, 900.0, unreal.LightUnits.LUMENS, 4500.0)
    # Cielo por la ventana: luminancia de unos 3000 cd/m² en un hueco de 2,6 × 1,6 m → ~12 000 cd.
    luz_rect("Cielo_Ventana", (X0 + 1.0, ym, (VENTANA_Z[0] + VENTANA_Z[1]) / 2), rot(), VENTANA_Y[1] - VENTANA_Y[0], VENTANA_Z[1] - VENTANA_Z[0],
             CIELO_CD, unreal.LightUnits.CANDELAS, 6800.0)
    # Sol (v2): de media tarde, entra en diagonal hacia el fondo y deja la mancha en el suelo delante de la
    # estación y sobre el costado y la encimera de la campana, a la vista de la cámara. Mucho más fuerte que
    # en v1 (un sol real da 60–100 klx): es lo que da el contraste de una foto de interior soleado.
    sol = actor(unreal.DirectionalLight, "Sol", (0.0, 0.0, 400.0), rot(cabeceo=SOL_CABECEO, guinada=SOL_GUINADA))
    cs = sol.get_component_by_class(unreal.DirectionalLightComponent)
    cs.set_mobility(ESTATICO)
    cs.set_editor_property("intensity", SOL_LUX)
    cs.set_editor_property("use_temperature", True)
    cs.set_editor_property("temperature", 5300.0)
    cs.set_editor_property("light_source_angle", 0.53)

    # --- Volumen de importancia de Lightmass: concentra los fotones en la sala (sin él se reparten por toda la
    # escena, esfera del cielo incluida, y el suelo salía con manchas).
    vol = actor(unreal.LightmassImportanceVolume, "Lightmass_Importancia", ((X0 + X1) / 2, (Y0 + Y1) / 2, ALTO / 2))
    vol.set_actor_scale3d(unreal.Vector((X1 - X0 + 80) / 200.0, (Y1 - Y0 + 80) / 200.0, (ALTO + 80) / 200.0))
    origen_vol, extension_vol = vol.get_actor_bounds(False)
    registrar("IMPORTANCIA centro=%s semiejes=%s" % (origen_vol, extension_vol))
    if extension_vol.x < 100.0:
        raise RuntimeError("El volumen de importancia salió sin geometría de pincel")

    # --- Capturas de reflejos (la de la campana manda dentro de su radio).
    for nombre, pos, radio in (("Reflejos_Sala", (0.0, 190.0, 150.0), 420.0), ("Reflejos_Campana", (-30.0, 5.0, 140.0), 110.0),
                               ("Reflejos_Encimera", (60.0, 0.0, 110.0), 90.0)):
        cap = actor(unreal.SphereReflectionCapture, nombre, pos)
        cap.get_component_by_class(unreal.SphereReflectionCaptureComponent).set_editor_property("influence_radius", radio)

    # --- Post-proceso de cámara física (volumen sin límites).
    ppv = actor(unreal.PostProcessVolume, "PostProceso_Camara", (0.0, 0.0, 150.0))
    ppv.set_editor_property("unbound", True)
    s = ppv.get_editor_property("settings")
    ajustes = {
        "auto_exposure_method": unreal.AutoExposureMethod.AEM_MANUAL,
        "auto_exposure_apply_physical_camera_exposure": True,
        "camera_iso": 400.0, "camera_shutter_speed": 60.0, "depth_of_field_fstop": 2.8,
        "auto_exposure_bias": EXPOSICION,   # v1: -1,5 (los blancos se quemaban); v2 se ajusta con el sol nuevo
        "white_temp": 5200.0,
        "bloom_intensity": 0.35,
        "vignette_intensity": 0.28,
        "film_grain_intensity": 0.06,
        "scene_fringe_intensity": 0.12,
        "ambient_occlusion_intensity": 0.35, "ambient_occlusion_radius": 40.0, "ambient_occlusion_static_fraction": 0.6,
        "motion_blur_amount": 0.0,
        "lens_flare_intensity": 0.0,
        "screen_space_reflection_intensity": 100.0, "screen_space_reflection_max_roughness": 0.5,
    }
    for clave, valor in ajustes.items():
        try:
            s.set_editor_property(clave, valor)
            s.set_editor_property("override_" + clave, True)
        except Exception as error:  # noqa: BLE001
            registrar("POSTPROCESO_AVISO %s: %r" % (clave, error))
    ppv.set_editor_property("settings", s)

    # --- Lightmass: rebotes y calidad del horneado.
    ws = mundo.get_world_settings()
    lm = ws.get_editor_property("lightmass_settings")
    # v2: más calidad indirecta y menos suavizado (las manchas del suelo eran ruido de la caché irradiante).
    for clave, valor in (("num_indirect_lighting_bounces", 5), ("num_sky_lighting_bounces", 1), ("indirect_lighting_quality", LM_CALIDAD),
                         ("indirect_lighting_smoothness", 0.75), ("static_lighting_level_scale", LM_ESCALA), ("use_ambient_occlusion", True),
                         ("direct_illumination_occlusion_fraction", 0.5), ("indirect_illumination_occlusion_fraction", 1.0),
                         ("occlusion_exponent", 1.2), ("max_occlusion_distance", 50.0), ("environment_color", unreal.Color(0, 0, 0, 255))):
        try:
            lm.set_editor_property(clave, valor)
        except Exception as error:  # noqa: BLE001
            registrar("LIGHTMASS_AVISO %s: %r" % (clave, error))
    ws.set_editor_property("lightmass_settings", lm)

    # --- Cámara fija para el jugador 0 (vista de las capturas y de la medición).
    # v2: más atrás y más abierta: campana entera (hasta 2,45 m), ventana y mancha de sol en el encuadre.
    origen = unreal.Vector(*CAMARA_ORIGEN)
    objetivo = unreal.Vector(*CAMARA_OBJETIVO)
    d = objetivo - origen
    camara = actor(unreal.CameraActor, "Camara_Foto", (origen.x, origen.y, origen.z),
                   rot(cabeceo=math.degrees(math.atan2(d.z, math.hypot(d.x, d.y))), guinada=math.degrees(math.atan2(d.y, d.x))))
    camara.camera_component.set_editor_property("field_of_view", CAMARA_FOV)
    camara.camera_component.set_editor_property("constrain_aspect_ratio", False)
    camara.set_editor_property("auto_activate_for_player", unreal.AutoReceiveInput.PLAYER0)
    actor(unreal.PlayerStart, "Inicio", (origen.x, origen.y, 100.0), rot(guinada=math.degrees(math.atan2(d.y, d.x))))

    if not unreal.EditorLoadingAndSavingUtils.save_map(mundo, MAPA):
        raise RuntimeError("No se pudo guardar " + MAPA)
    registrar("CAMPANA_NIVEL_OK %s: %d actores" % (MAPA, len(actores.get_all_level_actors())))


main()
