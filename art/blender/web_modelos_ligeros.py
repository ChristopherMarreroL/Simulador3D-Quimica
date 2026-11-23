# -*- coding: utf-8 -*-
"""Versiones ligeras de los modelos de art/export para el laboratorio web (PC modestos).

    "C:\\Program Files\\Blender Foundation\\Blender 5.3\\blender.exe" -b --factory-startup -P art/blender/web_modelos_ligeros.py

Los modelos de art/export están hechos para verse de cerca en Unreal (un frasco con tapa y líquido son unos 7 700
triángulos). En el laboratorio web hay más de doscientas piezas a la vista y sumaban 1,6 millones de triángulos, que
una GPU integrada no mueve a 60 FPS. Aquí se reduce cada modelo con el modificador Decimate (colapso de aristas) y se
guarda en web-campana/public/ligeros/. No se toca art/export: el material de la campana que se usa de cerca (matraz,
probeta, piseta, navecilla) y las manos siguen cargándose completos.
"""
import os

import bpy

RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
ORIGEN = os.path.join(RAIZ, "art", "export")
SALIDA = os.path.join(RAIZ, "web-campana", "public", "ligeros")
# Proporción de triángulos que se conserva. Los frascos de reactivos se cogen con la mano: algo más de detalle.
PROPORCION = {"SM_ReagentBottle_500": 0.22, "SM_Cap_GL45": 0.2, "SM_Liquid_Bottle500_400mL": 0.25, "SM_ReagentJar_250": 0.35, "SM_DropperBottle_30": 0.35,
              "SM_TestTube": 0.2, "SM_TestTubeRack": 1.0, "SM_Pipette_10": 0.6, "SM_StirRod": 1.0, "SM_Thermometer": 1.0, "SM_Pestle": 0.5, "SM_Funnel": 0.4}
MODELOS = ["SM_ReagentBottle_500", "SM_Cap_GL45", "SM_Liquid_Bottle500_400mL", "SM_ReagentJar_250", "SM_DropperBottle_30", "SM_Beaker_50", "SM_Beaker_100",
           "SM_Beaker_250", "SM_Beaker_500", "SM_Erlenmeyer_250", "SM_VolFlask_100", "SM_VolFlask_250", "SM_GradCylinder_10", "SM_GradCylinder_50", "SM_Funnel",
           "SM_Mortar", "SM_Pestle", "SM_WatchGlass", "SM_TestTubeRack", "SM_TestTube", "SM_Thermometer", "SM_StirRod", "SM_Pipette_10", "SM_WashBottle_500"]


def main():
    os.makedirs(SALIDA, exist_ok=True)
    total_antes = total_despues = 0
    for nombre in MODELOS:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=os.path.join(ORIGEN, nombre + ".glb"))
        for o in list(bpy.data.objects):
            if o.type != "MESH" or o.name.startswith("UCX_"):
                bpy.data.objects.remove(o, do_unlink=True)
        antes = despues = 0
        for o in bpy.data.objects:
            o.data.calc_loop_triangles()
            antes += len(o.data.loop_triangles)
            m = o.modifiers.new("Ligero", "DECIMATE")
            m.ratio = PROPORCION.get(nombre, 0.18)
            bpy.context.view_layer.objects.active = o
            o.select_set(True)
            bpy.ops.object.modifier_apply(modifier=m.name)
            for p in o.data.polygons:
                p.use_smooth = True
            o.data.calc_loop_triangles()
            despues += len(o.data.loop_triangles)
        bpy.ops.export_scene.gltf(filepath=os.path.join(SALIDA, nombre + ".glb"), export_format="GLB", export_apply=True, export_yup=True)
        total_antes += antes
        total_despues += despues
        print("[WebLigeros] %-28s %6d -> %5d triangulos" % (nombre, antes, despues), flush=True)
    print("[WebLigeros] TOTAL %d -> %d" % (total_antes, total_despues), flush=True)


main()
