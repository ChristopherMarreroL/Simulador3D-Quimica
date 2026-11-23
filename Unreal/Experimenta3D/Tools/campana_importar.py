# -*- coding: utf-8 -*-
"""Importa las mallas de la estación de la campana (art/blender/campana_estacion.py) para hornear la luz.

    UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script=<este archivo> -nullrhi -unattended -nosplash -nosound

Para cada GLB: lo importa a /Game/Laboratorio/Campana/<nombre>, desactiva Nanite (la ruta de render no lo
usa), usa el UV1 del GLB («UVLightmap») como canal del mapa de luz SIN generar otro, fija la resolución de
mapa de luz por defecto de la malla y comprueba que la colisión UCX_ del GLB llegó como formas convexas.
Si no llegó, lo dice (CAMPANA_SIN_UCX) y deja la malla con colisión compleja como simple para los trazados.
"""
import os

import unreal

EXPORT = os.path.normpath(os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()),
                                       "..", "..", "art", "export"))
DESTINO = "/Game/Laboratorio/Campana"
# Resolución del mapa de luz de cada malla (texeles por lado). La malla grande y los planos que más se ven,
# más; los detalles pequeños los resuelve la resolución de su isla dentro del mismo mapa.
MALLAS = {"SM_Campana_Sobremesa": 512, "SM_Campana_Guillotina": 64, "SM_Encimera_Granito": 512, "SM_Gabinete_Blanco": 512}

eal = unreal.EditorAssetLibrary
tools = unreal.AssetToolsHelpers.get_asset_tools()
mesh_tools = unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem) or unreal.StaticMeshEditorSubsystem()


def registrar(texto):
    unreal.log("[CampanaImportar] " + texto)


for nombre, resolucion in MALLAS.items():
    origen = os.path.join(EXPORT, nombre + ".glb")
    if not os.path.isfile(origen):
        raise RuntimeError("Falta " + origen + ": ejecuta antes art/blender/campana_estacion.py")
    carpeta = DESTINO + "/" + nombre
    if eal.does_directory_exist(carpeta):
        eal.delete_directory(carpeta)
    task = unreal.AssetImportTask()
    task.filename, task.destination_path = origen, carpeta
    task.automated, task.replace_existing, task.save = True, True, True
    tools.import_asset_tasks([task])

    mallas = [eal.load_asset(p) for p in eal.list_assets(carpeta, recursive=True, include_folder=False)]
    mallas = [m for m in mallas if isinstance(m, unreal.StaticMesh)]
    registrar("IMPORTADAS %s: %s" % (nombre, [m.get_name() for m in mallas]))
    malla = next((m for m in mallas if m.get_name() == nombre), None)
    if malla is None:
        raise RuntimeError("La importación de %s no creó la malla %s" % (origen, nombre))
    for sobrante in mallas:
        if sobrante is not malla and sobrante.get_name().startswith("UCX_"):
            registrar("CAMPANA_UCX_COMO_MALLA %s (el importador no la tomó como colisión)" % sobrante.get_name())

    nanite = malla.get_editor_property("nanite_settings")
    if nanite.enabled:
        nanite.enabled = False
        mesh_tools.set_nanite_settings(malla, nanite, apply_changes=True)

    # Mapa de luz: el UV1 del GLB, sin que el motor genere otro canal.
    canales = mesh_tools.get_num_uv_channels(malla, 0)
    opciones = mesh_tools.get_lod_build_settings(malla, 0)
    opciones.set_editor_property("generate_lightmap_u_vs", False)
    mesh_tools.set_lod_build_settings(malla, 0, opciones)
    malla.set_editor_property("light_map_coordinate_index", 1)
    malla.set_editor_property("light_map_resolution", resolucion)

    cuerpo = malla.get_editor_property("body_setup")
    geometria = cuerpo.get_editor_property("agg_geom")
    convexas = len(geometria.get_editor_property("convex_elems"))
    cajas = len(geometria.get_editor_property("box_elems"))
    if convexas + cajas == 0:
        registrar("CAMPANA_SIN_UCX %s: sin formas simples; colisión compleja como simple" % nombre)
        cuerpo.set_editor_property("collision_trace_flag", unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
    else:
        cuerpo.set_editor_property("collision_trace_flag", unreal.CollisionTraceFlag.CTF_USE_DEFAULT)
    eal.save_loaded_asset(malla, only_if_is_dirty=False)

    caja = malla.get_bounding_box()
    tam = caja.max - caja.min
    registrar("CAMPANA_MALLA %s tam_cm=(%.1f, %.1f, %.1f) min=(%.1f, %.1f, %.1f) tris=%d uv=%d lightmap_uv=%d res=%d "
              "convexas=%d cajas=%d materiales=%s" % (
                  nombre, tam.x, tam.y, tam.z, caja.min.x, caja.min.y, caja.min.z, malla.get_num_triangles(0), canales,
                  malla.get_editor_property("light_map_coordinate_index"), malla.get_editor_property("light_map_resolution"),
                  convexas, cajas, [str(m.material_slot_name) for m in malla.static_materials]))

registrar("CAMPANA_IMPORTAR_FIN")
