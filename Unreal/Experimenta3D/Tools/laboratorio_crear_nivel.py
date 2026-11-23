# -*- coding: utf-8 -*-
"""Laboratorio en U: nivel /Game/Mapas/Laboratorio.

    UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script=<este archivo> -nullrhi -unattended -nosplash

Sala de 10 x 8 m con encimera, gabinetes bajos y altos en tres paredes (forma de U), dos lavamanos,
dos mesas centrales, una vitrina de reactivos etiquetados y una campana extractora. La distribución
y TODAS las medidas son propias (módulos de 80 cm, encimera a 90 cm): no están tomadas del
laboratorio real ni de un catálogo de mobiliario. El mobiliario son cajas; no hay texturas.

Reactivos de la vitrina: los 27 del modelo químico (golden/chemistry.json) funcionan; el resto son
de exposición (tienen frasco y etiqueta, pero el modelo no los conoce y no se pueden verter).
Es repetible: si el nivel existe, lo vacía y lo rehace.
"""
import json
import math
import os
import sys

import unreal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vitrina_crear_nivel as v  # noqa: E402  (materiales compartidos; su main() no se ejecuta al importarlo)

MAPA = "/Game/Mapas/Laboratorio"
CUBO = v.CUBO
RAIZ = os.path.normpath(os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()), "..", ".."))
eal = unreal.EditorAssetLibrary
rot = v.rot
MOD = 80.0            # ancho de un módulo de gabinete
ENC = 90.0            # altura de la encimera

SUB = str.maketrans("₀₁₂₃₄₅₆₇₈₉⁺⁻", "0123456789+-")

# Reactivos de exposición: (nombre, fórmula, tipo). No tienen modelo químico.
EXTRA = [
    ("Ácido clorhídrico concentrado", "HCl 37 %", "liquido"), ("Ácido sulfúrico concentrado", "H2SO4 98 %", "liquido"),
    ("Ácido nítrico", "HNO3 65 %", "liquido"), ("Ácido fosfórico", "H3PO4 85 %", "liquido"),
    ("Ácido acético glacial", "CH3COOH 99 %", "liquido"), ("Amoníaco", "NH3 (ac) 25 %", "liquido"),
    ("Hidróxido de potasio", "KOH (ac) 1,0 mol/L", "liquido"), ("Hipoclorito de sodio", "NaClO (ac)", "liquido"),
    ("Etanol", "C2H5OH 96 %", "liquido"), ("Metanol", "CH3OH", "liquido"), ("Acetona", "CH3COCH3", "liquido"),
    ("Glicerina", "C3H8O3", "liquido"),
    ("Hidróxido de sodio (lentejas)", "NaOH (s)", "solido"), ("Hidróxido de calcio", "Ca(OH)2", "solido"),
    ("Óxido de calcio", "CaO", "solido"), ("Nitrato de potasio", "KNO3", "solido"),
    ("Dicromato de potasio", "K2Cr2O7", "solido"), ("Tiosulfato de sodio", "Na2S2O3", "solido"),
    ("Sulfato de magnesio", "MgSO4", "solido"), ("Sulfato de cinc", "ZnSO4", "solido"),
    ("Sulfato de hierro(II)", "FeSO4", "solido"), ("Cloruro de amonio", "NH4Cl", "solido"),
    ("Bromuro de potasio", "KBr", "solido"), ("Glucosa", "C6H12O6", "solido"), ("Azufre", "S", "solido"), ("Yodo", "I2", "solido"),
    ("Naranja de metilo", "Indicador", "indicador"), ("Rojo de metilo", "Indicador", "indicador"), ("Tornasol", "Indicador", "indicador"),
]


def partir(texto, ancho=15):
    """Reparte un nombre en líneas de unos `ancho` caracteres para que quepa en la etiqueta."""
    lineas, actual = [], ""
    for palabra in texto.split(" "):
        if actual and len(actual) + 1 + len(palabra) > ancho:
            lineas.append(actual)
            actual = palabra
        else:
            actual = (actual + " " + palabra).strip()
    return "\n".join(lineas + [actual])


class Tramo:
    """Tramo recto de muebles contra una pared. u = a lo largo de la pared, d = hacia la sala."""

    def __init__(self, nombre, origen, guinada, modulos):
        self.nombre, self.origen, self.yaw, self.modulos = nombre, origen, guinada, modulos
        a = math.radians(guinada)
        self.n = (round(math.cos(a)), round(math.sin(a)))
        self.t = (-self.n[1], self.n[0])

    def p(self, u, d, z):
        return (self.origen[0] + self.t[0] * u + self.n[0] * d, self.origen[1] + self.t[1] * u + self.n[1] * d, z)


def main():
    niveles = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actores = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    ROL = unreal.RolRecipiente

    blanco = v.material("M_Lab_Pared", (0.80, 0.80, 0.78), 0.85)
    techo = v.material("M_Lab_Techo", (0.86, 0.86, 0.84), 0.9)
    suelo = v.material("M_Lab_Suelo", (0.62, 0.61, 0.57), 0.35)
    laminado = v.material("M_Lab_Laminado", (0.84, 0.84, 0.82), 0.45)
    zocalo = v.material("M_Lab_Zocalo", (0.05, 0.05, 0.055), 0.6)
    granito = v.material("M_Lab_Granito", (0.03, 0.033, 0.04), 0.14)
    acero = v.material("M_Lab_Acero", (0.55, 0.56, 0.58), 0.32)
    hdpe = v.material("M_Lab_HDPE", (0.82, 0.82, 0.78), 0.5)
    porcelana = v.material("M_Lab_Porcelana", (0.86, 0.85, 0.80), 0.25)
    negro = v.material("M_Lab_Negro", (0.02, 0.02, 0.02), 0.5)
    tapa = v.material("M_Tapa_PP_Azul", (0.02, 0.10, 0.45), 0.45)
    marcas = v.material("M_Graduacion", (0.85, 0.85, 0.83), 0.7)
    marcas.set_editor_property("two_sided", True)
    eal.save_loaded_asset(marcas, only_if_is_dirty=False)
    vidrio = v.material("M_Vidrio_Boro", (0.02, 0.02, 0.02), 0.02, vidrio=True, opacidad_centro=0.01, especular=0.5,
                        transmitancia=(0.975, 0.99, 0.985))
    ambar = v.material("M_Vidrio_Ambar", (0.03, 0.012, 0.002), 0.03, vidrio=True, opacidad_centro=0.02, especular=0.5,
                       transmitancia=(0.88, 0.64, 0.30))
    cristal = v.material("M_Lab_Cristal_Puerta", (0.02, 0.02, 0.02), 0.03, vidrio=True, opacidad_centro=0.02, especular=0.5,
                         transmitancia=(0.95, 0.97, 0.96))
    agua = v.material("M_Liquido_Incoloro", (0.02, 0.02, 0.02), 0.0, vidrio=True, opacidad_centro=0.03, especular=0.3,
                      transmitancia=(0.93, 0.96, 0.97))
    lechoso = v.material("M_Liquido_Precipitado", (0.82, 0.82, 0.80), 0.35, parametro_color=True)
    lechoso.set_editor_property("two_sided", True)
    eal.save_loaded_asset(lechoso, only_if_is_dirty=False)
    suspension = v.material_suspension("M_Liquido_Suspension")
    liquidos_color = {}

    def liquido_de_color(hexadecimal):
        """Material de líquido teñido con el color que da el modelo para ese reactivo."""
        r, g, b = (int(hexadecimal[i:i + 2], 16) / 255.0 for i in (1, 3, 5))
        if min(r, g, b) > 0.8:
            return agua                                   # prácticamente incoloro
        if hexadecimal not in liquidos_color:
            lin = tuple(c ** 2.2 for c in (r, g, b))
            liquidos_color[hexadecimal] = v.material("M_Liquido_" + hexadecimal[1:], (0.02, 0.02, 0.02), 0.0, vidrio=True,
                                                     opacidad_centro=0.05, especular=0.3,
                                                     transmitancia=tuple(0.25 + 0.75 * c for c in lin))
        return liquidos_color[hexadecimal]

    with open(os.path.join(RAIZ, "art", "export", "perfiles_interiores.json"), encoding="utf-8") as archivo:
        perfiles = json.load(archivo)
    with open(os.path.join(RAIZ, "golden", "chemistry.json"), encoding="utf-8") as archivo:
        tabla = json.load(archivo)["tables"]["reagents"]
    reactivos = tabla if isinstance(tabla, list) else list(tabla.values())

    if eal.does_asset_exist(MAPA):
        niveles.load_level(MAPA)
        for a in actores.get_all_level_actors():
            actores.destroy_actor(a)
    elif not niveles.new_level(MAPA):
        raise RuntimeError("new_level devolvió False para " + MAPA)

    cuenta = {"cajas": 0, "puertas": 0, "recipientes": 0, "liquidos": 0}

    def actor(clase, nombre, posicion, rotacion=None):
        a = actores.spawn_actor_from_class(clase, unreal.Vector(*posicion), rotacion or rot())
        if a is None:
            raise RuntimeError("No se pudo crear " + nombre)
        a.set_actor_label(nombre)
        return a

    cubo = unreal.load_asset(CUBO)

    def caja(nombre, centro, medidas, mat, guinada=0.0):
        """Caja de `medidas` cm (x, y, z antes de girar) centrada en `centro`."""
        a = actor(unreal.StaticMeshActor, nombre, centro, rot(guinada=guinada))
        a.set_actor_scale3d(unreal.Vector(medidas[0] / 100.0, medidas[1] / 100.0, medidas[2] / 100.0))
        a.static_mesh_component.set_static_mesh(cubo)
        a.static_mesh_component.set_material(0, mat)
        cuenta["cajas"] += 1
        return a

    def caja_l(tramo, nombre, u0, u1, d0, d1, z0, z1, mat):
        """Caja en coordenadas del tramo."""
        return caja(nombre, tramo.p((u0 + u1) / 2, (d0 + d1) / 2, (z0 + z1) / 2), (d1 - d0, u1 - u0, z1 - z0), mat, tramo.yaw)

    def rotulo(nombre, posicion, guinada, texto, alto=5.0, color=(20, 20, 20)):
        a = actor(unreal.TextRenderActor, nombre, posicion, rot(guinada=guinada))
        t = a.text_render
        t.set_editor_property("text", texto.replace("\n", "<br>"))
        t.set_editor_property("world_size", alto)
        t.set_editor_property("horizontal_alignment", unreal.HorizTextAligment.EHTA_CENTER)
        t.set_editor_property("vertical_alignment", unreal.VerticalTextAligment.EVRTA_TEXT_CENTER)
        t.set_editor_property("text_render_color", unreal.Color(r=color[0], g=color[1], b=color[2], a=255))
        return a

    def puerta(tramo, nombre, u, d, z0, alto, ancho, mat, visible, texto="", z_texto=None, deslizante=False, recorrido=45.0):
        a = actor(unreal.PuertaActor, nombre, tramo.p(u, d, z0 + alto / 2), rot(guinada=tramo.yaw))
        hoja = a.get_editor_property("hoja")
        hoja.set_static_mesh(cubo)
        hoja.set_material(0, mat)
        hoja.set_editor_property("relative_location", unreal.Vector(0.0, ancho / 2, 0.0))
        hoja.set_editor_property("relative_scale3d", unreal.Vector(0.018, (ancho - 1.0) / 100.0, (alto - 1.0) / 100.0))
        a.set_editor_property("nombre_visible", visible)
        a.set_editor_property("texto_rotulo", texto)
        a.set_editor_property("posicion_rotulo", unreal.Vector(1.4, ancho / 2, alto / 2 - 7.0 if z_texto is None else z_texto))
        a.set_editor_property("deslizante", deslizante)
        a.set_editor_property("desplazamiento", unreal.Vector(0.0, 0.0, recorrido))
        a.set_editor_property("angulo_abierta", -105.0)      # la bisagra está en el borde izquierdo: abre hacia la sala
        cuenta["puertas"] += 1
        return a

    def gabinete(tramo, prefijo, u0, n_mod, z0, alto, fondo, baldas, mat_puerta, visibles, textos, cuerpo=laminado):
        """Cuerpo hueco de n módulos (paneles compartidos) con una puerta por módulo."""
        u1 = u0 + n_mod * MOD
        caja_l(tramo, prefijo + "_Fondo", u0, u1, 0.0, 2.0, z0, z0 + alto, cuerpo)
        caja_l(tramo, prefijo + "_Base", u0, u1, 2.0, fondo, z0, z0 + 2.0, cuerpo)
        caja_l(tramo, prefijo + "_Techo", u0, u1, 2.0, fondo, z0 + alto - 2.0, z0 + alto, cuerpo)
        for i, z in enumerate(baldas):
            caja_l(tramo, "%s_Balda%d" % (prefijo, i), u0, u1, 2.0, fondo - 2.0, z, z + 2.0, cuerpo)
        for k in range(n_mod + 1):
            u = u0 + k * MOD
            caja_l(tramo, "%s_Lateral%d" % (prefijo, k), max(u0, u - 1.0), min(u1, u + 1.0), 2.0, fondo, z0 + 2.0, z0 + alto - 2.0, cuerpo)
        for k in range(n_mod):
            puerta(tramo, "%s_Puerta%d" % (prefijo, k), u0 + k * MOD + 0.5, fondo + 1.2, z0, alto, MOD - 1.0, mat_puerta,
                   visibles[k], textos[k])

    def material_de(ranura, mat_vidrio):
        n = str(ranura)
        if "Graduacion" in n:
            return marcas
        if "Glass" in n:
            return mat_vidrio or (ambar if "Amber" in n else vidrio)
        for clave, mat in (("HDPE", hdpe), ("Porcelain", porcelana), ("Metal", acero), ("Cap", tapa), ("Black", negro)):
            if clave in n:
                return mat
        return laminado

    recipientes = {}

    def pieza(nombre, malla, posicion, guinada=0.0, visible=None, agarre=8.0, sobre=None, rol=None, reactivo="", ml=0.0,
              capacidad=0.0, mat_vidrio=None, etiqueta="", sin_modelo=False, de_practica=False, radio_etiqueta=4.4,
              altura_etiqueta=6.5, letra=1.0, placa=(8.6, 5.4), alabeo=0.0):
        recurso = unreal.load_asset(v.IMPORTADO % (malla, malla, malla))
        if recurso is None:
            raise RuntimeError("No existe la malla " + malla)
        a = actor(unreal.RecipienteActor, nombre, posicion, rot(guinada=guinada, alabeo=alabeo))
        a.static_mesh_component.set_static_mesh(recurso)
        for i, ranura in enumerate(recurso.static_materials):
            a.static_mesh_component.set_material(i, material_de(ranura.material_slot_name, mat_vidrio))
        a.set_editor_property("nombre_visible", visible or nombre)
        a.set_editor_property("altura_agarre_cm", agarre)
        a.set_editor_property("sin_modelo", sin_modelo)
        a.set_editor_property("de_practica", de_practica)
        if rol:
            a.set_editor_property("rol", rol)
            a.set_editor_property("reactivo_id", reactivo)
            a.set_editor_property("volumen_ml", ml)
            a.set_editor_property("capacidad_ml", capacidad)
        if etiqueta:
            a.get_editor_property("placa").set_material(0, blanco)      # sin esto la placa sale gris oscuro y no se lee
            a.set_editor_property("etiqueta_texto", etiqueta)
            a.set_editor_property("etiqueta_radio_cm", radio_etiqueta)
            a.set_editor_property("etiqueta_altura_cm", altura_etiqueta)
            a.set_editor_property("etiqueta_letra_cm", letra)
            a.set_editor_property("etiqueta_tamano_cm", unreal.Vector2D(placa[0], placa[1]))
        if sobre:
            unir(a, sobre)
        recipientes[nombre] = a
        cuenta["recipientes"] += 1
        return a

    def unir(hijo, padre):
        regla = unreal.AttachmentRule.KEEP_WORLD
        hijo.attach_to_actor(padre, "", regla, regla, regla, False)

    def liquido(recipiente, malla, ml, mat, menisco=0.5):
        a = actor(unreal.LiquidoActor, recipiente.get_actor_label() + "_Liquido", tuple(recipiente.get_actor_location().to_tuple()),
                  recipiente.get_actor_rotation())
        comp = a.get_editor_property("liquido")
        comp.set_editor_property("perfil_interior_mm", [unreal.Vector2D(r, z) for r, z in perfiles[malla]])
        comp.set_editor_property("menisco_mm", menisco)
        comp.set_editor_property("material_liquido", mat)
        comp.set_editor_property("volumen_ml", ml)
        comp.reconstruir()
        unir(a, recipiente)
        cuenta["liquidos"] += 1
        return a

    def mezcla(recipiente, malla, guion=(), ciclo=46.0):
        """Hace de un matraz o vaso un recipiente de mezclas gobernado por el modelo químico."""
        a = actor(unreal.MezclaActor, recipiente.get_actor_label() + "_Mezcla", tuple(recipiente.get_actor_location().to_tuple()),
                  recipiente.get_actor_rotation())
        perfil = [unreal.Vector2D(r, z) for r, z in perfiles[malla]]
        comp = a.get_editor_property("liquido")
        comp.set_editor_property("perfil_interior_mm", perfil)
        comp.set_editor_property("menisco_mm", 0.4)
        comp.set_editor_property("material_liquido", agua)
        sedimento = a.get_editor_property("sedimento")
        sedimento.set_editor_property("perfil_interior_mm", perfil)
        sedimento.set_editor_property("menisco_mm", 0.0)
        sedimento.set_editor_property("material_liquido", lechoso)
        m = a.get_editor_property("mezcla")
        m.set_editor_property("liquido", comp)
        m.set_editor_property("sedimento", sedimento)
        m.set_editor_property("material_incoloro", agua)
        m.set_editor_property("material_precipitado", lechoso)
        m.set_editor_property("material_suspension", suspension)
        pasos = []
        for segundo, reactivo, cantidad in guion:
            paso = unreal.PasoDemoMezcla()
            paso.set_editor_property("segundo", segundo)
            paso.set_editor_property("reactivo", reactivo)
            paso.set_editor_property("cantidad", cantidad)
            pasos.append(paso)
        m.set_editor_property("demo_pasos", pasos)
        m.set_editor_property("demo_ciclo_segundos", ciclo)
        unir(a, recipiente)
        cuenta["liquidos"] += 2
        return a

    def frasco(nombre, posicion, guinada, visible, etiqueta, reactivo="", sin_modelo=False, mat=None, color="#eef5f5", ml=350.0,
               de_practica=False):
        f = pieza(nombre, "SM_ReagentBottle_500", posicion, guinada, visible=visible, agarre=10.0, rol=ROL.FRASCO, reactivo=reactivo,
                  ml=ml, capacidad=500.0, mat_vidrio=mat or vidrio, etiqueta=etiqueta, sin_modelo=sin_modelo, de_practica=de_practica)
        pieza(nombre + "_Tapa", "SM_Cap_GL45", (posicion[0], posicion[1], posicion[2] + 15.5), guinada, visible="Tapa", agarre=1.0, sobre=f)
        liquido(f, "SM_ReagentBottle_500", ml, liquido_de_color(color))
        return f

    # ------------------------------------------------------------------ Sala
    caja("Suelo", (0, 0, -5), (1020, 820, 10), suelo)
    caja("Techo", (0, 0, 305), (1020, 820, 10), techo)
    caja("Pared_Fondo", (-505, 0, 150), (10, 820, 300), blanco)
    caja("Pared_Entrada", (505, 0, 150), (10, 820, 300), blanco)
    caja("Pared_Izquierda", (0, 405, 150), (1000, 10, 300), blanco)
    caja("Pared_Derecha", (0, -405, 150), (1000, 10, 300), blanco)

    fondo = Tramo("Fondo", (-500.0, -400.0), 0.0, 10)        # pared del fondo, de y = -400 a +400
    izquierda = Tramo("Izquierda", (-440.0, 400.0), -90.0, 8)  # pared y = +400, de x = -440 a +200
    derecha = Tramo("Derecha", (200.0, -400.0), 90.0, 8)       # pared y = -400, de x = +200 a -440
    tramos = (fondo, izquierda, derecha)
    lavamanos = {"Fondo": (200.0, 600.0)}                       # centros (u) de los dos lavamanos

    # ------------------------------------------------------------------ Muebles bajos y encimera en U
    for tr in tramos:
        largo = tr.modulos * MOD
        caja_l(tr, tr.nombre + "_Zocalo", 0.0, largo, 0.0, 52.0, 0.0, 8.0, zocalo)
        gabinete(tr, tr.nombre + "_Bajo", 0.0, tr.modulos, 8.0, 78.0, 56.0, [46.0], laminado,
                 ["Gabinete bajo %d" % (k + 1) for k in range(tr.modulos)], [""] * tr.modulos)
        huecos = lavamanos.get(tr.nombre, ())
        cortes = [0.0] + [c for u in huecos for c in (u - 25.0, u + 25.0)] + [largo]
        for i in range(0, len(cortes), 2):                       # tramos de encimera enteros entre lavamanos
            caja_l(tr, "%s_Encimera%d" % (tr.nombre, i // 2), cortes[i], cortes[i + 1], 0.0, 62.0, 86.0, ENC, granito)
        caja_l(tr, tr.nombre + "_Salpicadero", 0.0, largo, 0.0, 2.0, ENC, ENC + 10.0, granito)
        for i, u in enumerate(huecos):                           # lavamanos: marco de encimera, cubeta de acero y grifo
            caja_l(tr, "%s_Lavamanos%d_Frente" % (tr.nombre, i), u - 25.0, u + 25.0, 50.0, 62.0, 86.0, ENC, granito)
            caja_l(tr, "%s_Lavamanos%d_Trasera" % (tr.nombre, i), u - 25.0, u + 25.0, 0.0, 12.0, 86.0, ENC, granito)
            caja_l(tr, "%s_Lavamanos%d_Fondo" % (tr.nombre, i), u - 25.0, u + 25.0, 12.0, 50.0, 68.0, 69.5, acero)
            for j, (a0, a1, b0, b1) in enumerate(((u - 25.0, u - 23.5, 12.0, 50.0), (u + 23.5, u + 25.0, 12.0, 50.0),
                                                   (u - 25.0, u + 25.0, 12.0, 13.5), (u - 25.0, u + 25.0, 48.5, 50.0))):
                caja_l(tr, "%s_Lavamanos%d_Pared%d" % (tr.nombre, i, j), a0, a1, b0, b1, 69.5, 89.5, acero)
            pieza("%s_Grifo%d" % (tr.nombre, i), "SM_Faucet", tr.p(u, 6.0, ENC), tr.yaw, visible="Grifo (decorativo)")

    # ------------------------------------------------------------------ Gabinetes altos con puerta de cristal y su contenido
    ALTO0, ALTO_H, ALTO_F = 150.0, 70.0, 34.0
    Z_BAJA, Z_ALTA = ALTO0 + 2.0, ALTO0 + 36.0                  # suelo del gabinete y balda

    def altos(tr, primer, rotulos):
        gabinete(tr, "%s_Alto%d" % (tr.nombre, primer), primer * MOD, len(rotulos), ALTO0, ALTO_H, ALTO_F, [ALTO0 + 34.0], cristal,
                 ["Gabinete: " + r.replace("\n", " ").lower() for r in rotulos], rotulos)

    def fila(tr, modulo, z, malla, n, visible, agarre=8.0, tumbado=False, radio=0.0, **kw):
        hechos = []
        for i in range(n):
            u = modulo * MOD + (MOD * (i + 1) / (n + 1) if not tumbado else MOD / 2)
            d = 17.0 if not tumbado else 8.0 + i * 5.5
            kw.setdefault("alabeo", 90.0 if tumbado else 0.0)
            a = pieza("%s_%d_%s_%d_%d" % (tr.nombre, modulo, malla[3:], int(z), i), malla, tr.p(u, d, z + radio), tr.yaw,
                      visible=visible, agarre=agarre, **kw)
            hechos.append(a)
        return hechos

    def vasos(tr, modulo, z, malla, n, visible, capacidad):
        for a in fila(tr, modulo, z, malla, n, visible, agarre=min(10.0, capacidad / 40.0 + 3.0), rol=ROL.MATRAZ, capacidad=capacidad):
            mezcla(a, malla)

    def probetas(tr, modulo, z, malla, n, visible, capacidad):
        for a in fila(tr, modulo, z, malla, n, visible, agarre=9.0, rol=ROL.PROBETA, capacidad=capacidad):
            liquido(a, malla, 0.0, agua, 0.6)

    altos(fondo, 0, ["Vasos de precipitados\n50 y 100 mL", "Vasos de precipitados\n250 y 500 mL", "Matraces\nErlenmeyer", "Probetas",
                     "Matraces\naforados", "Tubos de ensayo\ny gradillas", "Embudos y\nvidrios de reloj", "Pipetas y\nvarillas",
                     "Termómetros\ny mecheros", "Morteros"])
    vasos(fondo, 0, Z_BAJA, "SM_Beaker_50", 4, "Vaso de precipitados de 50 mL", 50.0)
    vasos(fondo, 0, Z_ALTA, "SM_Beaker_100", 3, "Vaso de precipitados de 100 mL", 100.0)
    vasos(fondo, 1, Z_BAJA, "SM_Beaker_250", 3, "Vaso de precipitados de 250 mL", 250.0)
    vasos(fondo, 1, Z_ALTA, "SM_Beaker_500", 2, "Vaso de precipitados de 500 mL", 500.0)
    vasos(fondo, 2, Z_BAJA, "SM_Erlenmeyer_250", 3, "Matraz Erlenmeyer de 250 mL", 250.0)
    vasos(fondo, 2, Z_ALTA, "SM_Erlenmeyer_500", 2, "Matraz Erlenmeyer de 500 mL", 500.0)
    probetas(fondo, 3, Z_BAJA, "SM_GradCylinder_100", 2, "Probeta de 100 mL", 100.0)
    probetas(fondo, 3, Z_ALTA, "SM_GradCylinder_50", 2, "Probeta de 50 mL", 50.0)
    probetas(fondo, 3, Z_ALTA, "SM_GradCylinder_10", 0, "Probeta de 10 mL", 10.0)
    fila(fondo, 4, Z_BAJA, "SM_VolFlask_250", 2, "Matraz aforado de 250 mL", agarre=15.0)
    fila(fondo, 4, Z_ALTA, "SM_VolFlask_100", 3, "Matraz aforado de 100 mL", agarre=12.0)
    for z in (Z_BAJA, Z_ALTA):
        fila(fondo, 5, z, "SM_TestTubeRack", 1, "Gradilla", agarre=5.0)
        for i in range(6):
            pieza("Fondo_5_Tubo_%d_%d" % (int(z), i), "SM_TestTube", fondo.p(5 * MOD + 40.0 + (i - 2.5) * 27.0, 17.0, z + 1.0), fondo.yaw,
                  visible="Tubo de ensayo", agarre=11.0)
    fila(fondo, 6, Z_BAJA, "SM_Funnel", 3, "Embudo", agarre=6.0, alabeo=180.0, radio=12.7)
    fila(fondo, 6, Z_ALTA, "SM_WatchGlass", 4, "Vidrio de reloj", agarre=1.0)
    fila(fondo, 7, Z_BAJA, "SM_Pipette_10", 4, "Pipeta graduada de 10 mL (sin función todavía)", agarre=18.0, tumbado=True, radio=0.5)
    fila(fondo, 7, Z_ALTA, "SM_StirRod", 4, "Varilla de vidrio", agarre=10.0, tumbado=True, radio=0.4)
    fila(fondo, 8, Z_BAJA, "SM_Bunsen", 2, "Mechero Bunsen (decorativo)", agarre=9.0)
    fila(fondo, 8, Z_ALTA, "SM_Thermometer", 4, "Termómetro (sin función todavía)", agarre=15.0, tumbado=True, radio=0.5)
    fila(fondo, 9, Z_BAJA, "SM_Mortar", 2, "Mortero", agarre=5.0)
    fila(fondo, 9, Z_ALTA, "SM_Pestle", 3, "Mano de mortero", agarre=6.0, tumbado=True, radio=1.3)

    altos(izquierda, 0, ["Pisetas", "Frascos\ncuentagotas"])
    fila(izquierda, 0, Z_BAJA, "SM_WashBottle_500", 3, "Piseta (sin función todavía)", agarre=10.0)
    fila(izquierda, 0, Z_ALTA, "SM_WashBottle_500", 3, "Piseta (sin función todavía)", agarre=10.0)
    fila(izquierda, 1, Z_BAJA, "SM_DropperBottle_30", 5, "Frasco cuentagotas vacío", agarre=5.0)
    fila(izquierda, 1, Z_ALTA, "SM_DropperBottle_30", 5, "Frasco cuentagotas vacío", agarre=5.0)
    altos(izquierda, 5, ["Tarros", "Vasos de\nrepuesto", "Matraces de\nrepuesto"])
    fila(izquierda, 5, Z_BAJA, "SM_ReagentJar_250", 4, "Tarro vacío", agarre=6.0)
    fila(izquierda, 5, Z_ALTA, "SM_ReagentJar_250", 4, "Tarro vacío", agarre=6.0)
    vasos(izquierda, 6, Z_BAJA, "SM_Beaker_250", 3, "Vaso de precipitados de 250 mL", 250.0)
    vasos(izquierda, 6, Z_ALTA, "SM_Beaker_100", 3, "Vaso de precipitados de 100 mL", 100.0)
    vasos(izquierda, 7, Z_BAJA, "SM_Erlenmeyer_250", 3, "Matraz Erlenmeyer de 250 mL", 250.0)
    altos(derecha, 0, ["Probetas de\nrepuesto", "Gradillas", "Embudos"])
    probetas(derecha, 0, Z_BAJA, "SM_GradCylinder_100", 2, "Probeta de 100 mL", 100.0)
    probetas(derecha, 0, Z_ALTA, "SM_GradCylinder_10", 4, "Probeta de 10 mL", 10.0)
    fila(derecha, 1, Z_BAJA, "SM_TestTubeRack", 1, "Gradilla", agarre=5.0)
    fila(derecha, 1, Z_ALTA, "SM_TestTubeRack", 1, "Gradilla", agarre=5.0)
    fila(derecha, 2, Z_BAJA, "SM_Funnel", 3, "Embudo", agarre=6.0, alabeo=180.0, radio=12.7)
    altos(derecha, 5, ["Vidrios de\nreloj", "Varillas y\ntermómetros", "Morteros de\nrepuesto"])
    fila(derecha, 5, Z_BAJA, "SM_WatchGlass", 4, "Vidrio de reloj", agarre=1.0)
    fila(derecha, 6, Z_BAJA, "SM_StirRod", 4, "Varilla de vidrio", agarre=10.0, tumbado=True, radio=0.4)
    fila(derecha, 7, Z_BAJA, "SM_Mortar", 2, "Mortero", agarre=5.0)

    # ------------------------------------------------------------------ Vitrina de reactivos (pared izquierda, módulos 2 a 4)
    V0 = 2 * MOD
    Z_VIT = ENC + 2.0
    gabinete(izquierda, "Vitrina", V0, 3, Z_VIT, 142.0, ALTO_F, [Z_VIT + 34.0, Z_VIT + 68.0, Z_VIT + 102.0], cristal,
             ["Vitrina de reactivos"] * 3, [""] * 3)
    rotulo("Vitrina_Rotulo", izquierda.p(V0 + 120.0, ALTO_F + 2.6, Z_VIT + 148.0), izquierda.yaw, "REACTIVOS", 7.0)
    estantes = [Z_VIT + 2.0, Z_VIT + 36.0, Z_VIT + 70.0, Z_VIT + 104.0]     # de abajo arriba

    def nombre_corto(texto, ancho=15):
        return partir(texto.translate(SUB), ancho)

    # Arriba: ácidos y bases en disolución. Debajo: sales y oxidantes en disolución. Luego sólidos. Abajo: indicadores.
    disoluciones = [r for r in reactivos if r["kind"] in ("solution", "water")]
    solidos = [r for r in reactivos if r["kind"] == "solid"]
    indicadores = [r for r in reactivos if r["kind"] == "indicator"]
    extra = {tipo: [e for e in EXTRA if e[2] == tipo] for tipo in ("liquido", "solido", "indicador")}
    acidos_bases = [r for r in disoluciones if r.get("category") in ("ácido", "base")] or disoluciones[:6]
    resto = [r for r in disoluciones if r not in acidos_bases]

    def colocar(estante, elementos, paso):
        """Reparte los elementos en una fila del estante; devuelve (u, elemento)."""
        ancho = 3 * MOD - 12.0
        if len(elementos) * paso > ancho:
            paso = ancho / len(elementos)
        inicio = V0 + 6.0 + (ancho - (len(elementos) - 1) * paso) / 2
        return [(inicio + i * paso, e) for i, e in enumerate(elementos)]

    def vit_frasco(u, z, clave, nombre, formula, reactivo, sin_modelo, r=None):
        look = (r or {}).get("look", {})
        frasco("Vit_" + clave, izquierda.p(u, 17.0, z), izquierda.yaw, nombre, nombre_corto(nombre) + "\n" + formula.translate(SUB).split(" · ")[-1][:16],
               reactivo=reactivo, sin_modelo=sin_modelo, mat=ambar if look.get("glass") == "amber" else vidrio,
               color=look.get("contents", "#eef5f5"))

    fila_a = [("m", r) for r in acidos_bases] + [("x", e) for e in extra["liquido"][:8]]
    fila_b = [("m", r) for r in resto] + [("x", e) for e in extra["liquido"][8:]]
    for z, elementos in ((estantes[3], fila_a), (estantes[2], fila_b)):
        for u, (tipo, e) in colocar(z, elementos, 13.5):
            if tipo == "m":
                vit_frasco(u, z, e["id"], e["name"], e["formula"], e["id"], False, e)
            else:
                vit_frasco(u, z, "x_" + e[0].replace(" ", "_")[:18], e[0], e[1], "", True)
    for u, (tipo, e) in colocar(estantes[1], [("m", r) for r in solidos] + [("x", e) for e in extra["solido"]], 11.8):
        nombre, formula = (e["name"], e["formula"]) if tipo == "m" else (e[0], e[1])
        pieza("Vit_" + (e["id"] if tipo == "m" else "x_" + e[0].replace(" ", "_")[:18]), "SM_ReagentJar_250", izquierda.p(u, 17.0, estantes[1]),
              izquierda.yaw, visible=nombre, agarre=6.0, rol=ROL.TARRO, reactivo=e["id"] if tipo == "m" else "", sin_modelo=tipo != "m",
              etiqueta=nombre_corto(nombre) + "\n" + formula.translate(SUB).split(" · ")[0][:14], radio_etiqueta=3.5, altura_etiqueta=4.6,
              letra=0.78, placa=(7.6, 4.6))
    for u, (tipo, e) in colocar(estantes[0], [("m", r) for r in indicadores] + [("x", e) for e in extra["indicador"]], 14.0):
        nombre = e["name"] if tipo == "m" else e[0]
        pieza("Vit_" + (e["id"] if tipo == "m" else "x_" + e[0].replace(" ", "_")[:18]), "SM_DropperBottle_30", izquierda.p(u, 17.0, estantes[0]),
              izquierda.yaw, visible=nombre, agarre=5.0, rol=ROL.GOTERO, reactivo=e["id"] if tipo == "m" else "", sin_modelo=tipo != "m",
              etiqueta=nombre_corto(nombre, 12), radio_etiqueta=1.75, altura_etiqueta=3.0, letra=0.7, placa=(6.4, 3.2))

    # ------------------------------------------------------------------ Campana extractora (pared derecha, módulos 3 y 4)
    C0, C1 = 3 * MOD, 5 * MOD
    caja_l(derecha, "Campana_Lateral0", C0, C0 + 3.0, 0.0, 60.0, ENC, 240.0, laminado)
    caja_l(derecha, "Campana_Lateral1", C1 - 3.0, C1, 0.0, 60.0, ENC, 240.0, laminado)
    caja_l(derecha, "Campana_Fondo", C0 + 3.0, C1 - 3.0, 0.0, 2.0, ENC, 240.0, laminado)
    caja_l(derecha, "Campana_Deflector", C0 + 3.0, C1 - 3.0, 8.0, 9.0, ENC + 6.0, 205.0, acero)
    for i, z in enumerate((ENC + 22.0, ENC + 62.0, ENC + 100.0)):
        caja_l(derecha, "Campana_Ranura%d" % i, C0 + 14.0, C1 - 14.0, 9.0, 9.4, z, z + 3.0, negro)
    caja_l(derecha, "Campana_Cabezal", C0, C1, 0.0, 62.0, 215.0, 245.0, laminado)
    caja_l(derecha, "Campana_Vidrio_Fijo", C0 + 3.0, C1 - 3.0, 57.0, 58.0, 172.0, 215.0, cristal)
    caja_l(derecha, "Campana_Conducto", (C0 + C1) / 2 - 17.0, (C0 + C1) / 2 + 17.0, 12.0, 46.0, 245.0, 300.0, acero)
    puerta(derecha, "Campana_Ventana", C0 + 3.5, 59.5, ENC + 1.0, 82.0, C1 - C0 - 7.0, cristal, "Ventana de la campana", deslizante=True,
           recorrido=42.0)
    rotulo("Campana_Rotulo", derecha.p((C0 + C1) / 2, 62.6, 230.0), derecha.yaw, "CAMPANA EXTRACTORA", 6.0)
    luz_campana = actor(unreal.PointLight, "Campana_Luz", derecha.p((C0 + C1) / 2, 30.0, 205.0)).get_component_by_class(unreal.PointLightComponent)
    luz_campana.set_mobility(unreal.ComponentMobility.MOVABLE)
    luz_campana.set_editor_property("intensity", 2.5)
    luz_campana.set_editor_property("intensity_units", unreal.LightUnits.CANDELAS)
    luz_campana.set_editor_property("attenuation_radius", 220.0)
    luz_campana.set_editor_property("cast_shadows", False)

    # ------------------------------------------------------------------ Mesas centrales
    mesas = (("Mesa1", -110.0), ("Mesa2", 110.0))
    for nombre, y in mesas:
        caja(nombre + "_Pedestal", (-100.0, y, 43.0), (240.0, 90.0, 86.0), zocalo)
        caja(nombre + "_Encimera", (-100.0, y, 88.0), (260.0, 110.0, 4.0), granito)

    # Material de «Prueba de cloruros» en el extremo de la mesa 1 que mira a la entrada.
    X_P, Y1 = 2.0, -110.0
    m500 = pieza("Matraz_500", "SM_Erlenmeyer_500", (X_P, Y1 - 24.0, ENC), 0.0, visible="Matraz Erlenmeyer de 500 mL", agarre=14.0,
                 rol=ROL.MATRAZ, capacidad=500.0, de_practica=True)
    mezcla(m500, "SM_Erlenmeyer_500")
    probeta = pieza("Probeta_100", "SM_GradCylinder_100", (X_P, Y1 - 6.0, ENC), 0.0, visible="Probeta de 100 mL", agarre=14.0,
                    rol=ROL.PROBETA, capacidad=100.0, de_practica=True)
    liquido(probeta, "SM_GradCylinder_100", 0.0, agua, 0.8)
    frasco("Frasco_Ambar", (X_P, Y1 + 11.0, ENC), 0.0, "Nitrato de plata 0,1 mol/L", "Nitrato de\nplata\n0,1 mol/L", reactivo="agno3",
           mat=ambar, ml=400.0, de_practica=True)
    frasco("Frasco_Sal", (X_P, Y1 + 30.0, ENC), 0.0, "Cloruro de sodio 1,0 mol/L", "Cloruro de\nsodio\n1,0 mol/L", reactivo="nacl", ml=400.0,
           de_practica=True)

    # Mesa 2: demostración del indicador universal sobre un azulejo blanco y un vaso libre.
    Y2 = 110.0
    caja("Azulejo_Blanco", (X_P, Y2 - 25.0, ENC + 0.25), (15.0, 15.0, 0.5), blanco)
    demo = pieza("Matraz_Indicador", "SM_Erlenmeyer_500", (X_P, Y2 - 25.0, ENC + 0.5), 0.0, visible="Matraz Erlenmeyer de 500 mL (demostración)",
                 agarre=14.0, rol=ROL.MATRAZ, capacidad=500.0)
    mezcla(demo, "SM_Erlenmeyer_500", ((2.0, "hcl", 20.0), (4.0, "universal", 3.0), (8.0, "naoh", 5.0), (11.0, "naoh", 5.0), (14.0, "naoh", 5.0),
                                       (20.0, "naoh", 5.0), (28.0, "naoh", 3.0)))
    vaso = pieza("Vaso_Mesa2", "SM_Beaker_250", (X_P, Y2 + 5.0, ENC), 0.0, visible="Vaso de precipitados de 250 mL", agarre=8.0, rol=ROL.MATRAZ,
                 capacidad=250.0)
    mezcla(vaso, "SM_Beaker_250")

    # Mesa 2, segunda fila: balanza con su navecilla, tarro de bicarbonato, vinagre, probeta, pipeta y piseta.
    # La balanza no pesa por física: marca los gramos anotados en la navecilla que tiene encima.
    XB, YB = -26.0, 120.0
    caja("Balanza_Cuerpo", (XB, YB, ENC + 1.4), (18.0, 18.0, 2.8), blanco)
    caja("Balanza_Platillo", (XB, YB, ENC + 2.9), (15.0, 15.0, 0.2), acero)
    caja("Balanza_Visor", (XB + 13.0, YB, ENC + 1.0), (8.0, 18.0, 2.0), negro)
    balanza = actor(unreal.BalanzaActor, "Balanza", (XB, YB, ENC + 3.0))
    balanza.set_editor_property("posicion_pantalla", unreal.Vector(13.0, 0.0, -0.2))
    pieza("Navecilla", "SM_WeighBoat", (XB, YB, ENC + 3.0), 0.0, visible="Navecilla de pesar", agarre=1.5, rol=ROL.NAVECILLA, capacidad=10.0)
    pieza("Tarro_Bicarbonato", "SM_ReagentJar_250", (XB, YB + 40.0, ENC), 0.0, visible="Bicarbonato de sodio", agarre=6.0, rol=ROL.TARRO,
          reactivo="nahco3", etiqueta="Bicarbonato\nde sodio\nNaHCO3", radio_etiqueta=3.5, altura_etiqueta=4.6, letra=0.78, placa=(7.6, 4.6))
    frasco("Frasco_Vinagre", (X_P, Y2 + 44.0, ENC), 0.0, "Ácido acético (vinagre) 0,83 mol/L", "Ácido acético\n(vinagre)\n0,83 mol/L",
           reactivo="acetic", color="#f3e7c2", ml=400.0)
    probeta2 = pieza("Probeta_Mesa2", "SM_GradCylinder_100", (XB, YB + 20.0, ENC), 0.0, visible="Probeta de 100 mL", agarre=14.0,
                     rol=ROL.PROBETA, capacidad=100.0)
    liquido(probeta2, "SM_GradCylinder_100", 0.0, agua, 0.8)
    pieza("Pipeta_Mesa2", "SM_Pipette_10", (XB - 4.0, Y2 - 12.0, ENC + 0.5), 90.0, visible="Pipeta de 10 mL", agarre=18.0, rol=ROL.PIPETA,
          capacidad=10.0, alabeo=90.0)
    pieza("Piseta_Mesa2", "SM_WashBottle_500", (XB, Y2 - 40.0, ENC), 0.0, visible="Piseta con agua destilada", agarre=8.0, rol=ROL.FRASCO,
          reactivo="water", ml=400.0, capacidad=500.0)

    # ------------------------------------------------------------------ Luz
    actor(unreal.SkyAtmosphere, "Atmosfera", (0, 0, 0))
    cielo = actor(unreal.SkyLight, "Luz_Cielo", (0, 0, 280)).get_component_by_class(unreal.SkyLightComponent)
    cielo.set_mobility(unreal.ComponentMobility.MOVABLE)
    cielo.set_editor_property("source_type", unreal.SkyLightSourceType.SLS_CAPTURED_SCENE)
    cielo.set_editor_property("intensity", 1.0)
    for i, (x, y) in enumerate(((-300, -200), (-300, 200), (0, -200), (0, 200), (300, -200), (300, 200))):
        caja("Luminaria%d_Panel" % i, (x, y, 299.0), (120.0, 60.0, 2.0), blanco)
        rect = actor(unreal.RectLight, "Luminaria%d" % i, (x, y, 296.0), rot(cabeceo=-90.0)).get_component_by_class(unreal.RectLightComponent)
        rect.set_mobility(unreal.ComponentMobility.MOVABLE)
        rect.set_editor_property("intensity_units", unreal.LightUnits.CANDELAS)
        rect.set_editor_property("intensity", 22.0)
        rect.set_editor_property("source_width", 120.0)
        rect.set_editor_property("source_height", 60.0)
        rect.set_editor_property("attenuation_radius", 700.0)
        rect.set_editor_property("cast_shadows", i in (2, 3))     # solo las dos centrales dan sombra (rendimiento)
    # Relleno: sin iluminación global el techo y lo alto de las paredes quedaban negros.
    for i, x in enumerate((-300.0, 0.0, 300.0)):
        relleno = actor(unreal.PointLight, "Relleno%d" % i, (x, 0.0, 215.0)).get_component_by_class(unreal.PointLightComponent)
        relleno.set_mobility(unreal.ComponentMobility.MOVABLE)
        relleno.set_editor_property("intensity_units", unreal.LightUnits.CANDELAS)
        relleno.set_editor_property("intensity", 9.0)
        relleno.set_editor_property("attenuation_radius", 900.0)
        relleno.set_editor_property("cast_shadows", False)
    volumen = actor(unreal.PostProcessVolume, "Exposicion", (0, 0, 150))
    volumen.set_editor_property("unbound", True)
    ajustes = volumen.get_editor_property("settings")
    ajustes.set_editor_property("override_auto_exposure_method", True)
    ajustes.set_editor_property("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL)
    ajustes.set_editor_property("override_auto_exposure_apply_physical_camera_exposure", True)
    ajustes.set_editor_property("auto_exposure_apply_physical_camera_exposure", False)
    ajustes.set_editor_property("override_auto_exposure_bias", True)
    ajustes.set_editor_property("auto_exposure_bias", -0.3)
    volumen.set_editor_property("settings", ajustes)

    # ------------------------------------------------------------------ Jugador
    mundo = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    mundo.get_world_settings().set_editor_property("default_game_mode", unreal.ExperimentaGameMode)
    actor(unreal.PlayerStart, "Inicio", (190.0, Y1, 110.0), rot(guinada=180.0))

    if not niveles.save_current_level():
        raise RuntimeError("save_current_level devolvió False")
    unreal.log("LABORATORIO_OK actores=%d cajas=%d puertas=%d recipientes=%d cuerpos_de_liquido=%d reactivos_modelo=%d reactivos_exposicion=%d" % (
        len(actores.get_all_level_actors()), cuenta["cajas"], cuenta["puertas"], cuenta["recipientes"], cuenta["liquidos"],
        len(reactivos), len(EXTRA)))


if __name__ == "__main__":
    main()
