"""Importa todos los GLB de art/export a /Game/Laboratorio/Importado/<nombre>, desactiva Nanite
(el vidrio es translúcido y Nanite no lo admite) y escribe las medidas para comprobarlas.

UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script=<este archivo> -nullrhi -unattended -nosplash
"""
import glob
import os

import unreal

EXPORT = os.path.normpath(os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()),
                                       "..", "..", "art", "export"))
tools = unreal.AssetToolsHelpers.get_asset_tools()
# En modo commandlet get_editor_subsystem devuelve None: se usa una instancia directa.
mesh_tools = unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem) or unreal.StaticMeshEditorSubsystem()

for src in sorted(glob.glob(os.path.join(EXPORT, "*.glb"))):
    name = os.path.splitext(os.path.basename(src))[0]
    dest = "/Game/Laboratorio/Importado/" + name
    task = unreal.AssetImportTask()
    task.filename, task.destination_path = src, dest
    task.automated, task.replace_existing, task.save = True, True, True
    tools.import_asset_tasks([task])
    found = False
    for path in unreal.EditorAssetLibrary.list_assets(dest, recursive=True, include_folder=False):
        asset = unreal.EditorAssetLibrary.load_asset(path)
        if not isinstance(asset, unreal.StaticMesh):
            continue
        found = True
        nanite = asset.get_editor_property("nanite_settings")
        if nanite.enabled:
            nanite.enabled = False
            mesh_tools.set_nanite_settings(asset, nanite, apply_changes=True)
            unreal.EditorAssetLibrary.save_loaded_asset(asset)
        # Colisión: se usa la propia malla («compleja como simple»). Sirve para trazados (apuntar,
        # recoger) y para objetos que mueve el juego; NO para física simulada (un objeto que cae).
        # En el commandlet, add_simple_collisions (cajas, cápsulas, k-DOP) no deja ninguna forma:
        # comprobado en 5.8.4, por eso no se usa aquí.
        cuerpo = asset.get_editor_property("body_setup")
        # El líquido no debe interceptar los trazados: se deja sin colisión propia.
        cuerpo.set_editor_property("collision_trace_flag",
                                   unreal.CollisionTraceFlag.CTF_USE_SIMPLE_AS_COMPLEX if name.startswith("SM_Liquid")
                                   else unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
        unreal.EditorAssetLibrary.save_loaded_asset(asset)
        unreal.log("IMPORT_COLISION %s modo=%s materiales=%s" % (
            name, cuerpo.get_editor_property("collision_trace_flag"),
            [str(m.material_slot_name) for m in asset.static_materials]))
        box = asset.get_bounding_box()
        size = box.max - box.min
        unreal.log("IMPORT_MALLA %s tam_cm=(%.2f, %.2f, %.2f) base_z=%.2f tris=%d nanite=%s" % (
            name, size.x, size.y, size.z, box.min.z, asset.get_num_triangles(0),
            asset.get_editor_property("nanite_settings").enabled))
    if not found:
        unreal.log_error("IMPORT_SIN_MALLA %s" % name)

unreal.log("IMPORT_FIN")
