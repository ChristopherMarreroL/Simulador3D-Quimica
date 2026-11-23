"""Prueba de importación: lleva art/export/SM_Erlenmeyer_500.{glb,fbx} a /Game/Laboratorio/Prueba_*
y escribe las medidas resultantes, para comprobar escala (m -> cm) y ejes.

UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script=<este archivo> -nullrhi -unattended -nosplash
"""
import os

import unreal

EXPORT = os.path.normpath(os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()),
                                       "..", "..", "art", "export"))
tools = unreal.AssetToolsHelpers.get_asset_tools()

for fmt in ("glb", "fbx"):
    src = os.path.join(EXPORT, "SM_Erlenmeyer_500." + fmt)
    dest = "/Game/Laboratorio/Prueba_" + fmt
    task = unreal.AssetImportTask()
    task.filename = src
    task.destination_path = dest
    task.automated = True
    task.replace_existing = True
    task.save = True
    try:
        tools.import_asset_tasks([task])
    except Exception as exc:  # noqa: BLE001
        unreal.log_error("IMPORT_FALLO %s %s" % (fmt, exc))
        continue
    assets = unreal.EditorAssetLibrary.list_assets(dest, recursive=True, include_folder=False)
    unreal.log("IMPORT_LISTA %s %d %s" % (fmt, len(assets), assets))
    for path in assets:
        asset = unreal.EditorAssetLibrary.load_asset(path)
        if isinstance(asset, unreal.StaticMesh):
            box = asset.get_bounding_box()
            size = box.max - box.min
            mats = [str(m.material_interface.get_path_name()) if m.material_interface else "None"
                    for m in asset.static_materials]
            unreal.log("IMPORT_NANITE %s activado=%s lods=%d vertices_lod0=%d" % (
                fmt, asset.get_editor_property("nanite_settings").enabled,
                asset.get_num_lods(), asset.get_num_vertices(0)))
            # El vidrio es translúcido: Nanite no lo admite y su malla de reserva pierde detalle.
            ajustes = asset.get_editor_property("nanite_settings")
            if ajustes.enabled:
                ajustes.enabled = False
                # En modo commandlet no hay subsistemas del editor: se crea una instancia directa.
                sub = unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem) or unreal.StaticMeshEditorSubsystem()
                sub.set_nanite_settings(asset, ajustes, apply_changes=True)
                unreal.EditorAssetLibrary.save_loaded_asset(asset)
                unreal.log("IMPORT_SIN_NANITE %s tris=%d vertices=%d" % (
                    fmt, asset.get_num_triangles(0), asset.get_num_vertices(0)))
            unreal.log("IMPORT_MALLA %s %s tam_cm=(%.2f, %.2f, %.2f) min=(%.2f, %.2f, %.2f) tris=%d mats=%s" % (
                fmt, path, size.x, size.y, size.z, box.min.x, box.min.y, box.min.z,
                asset.get_num_triangles(0), mats))
        elif isinstance(asset, unreal.MaterialInterface):
            unreal.log("IMPORT_MATERIAL %s %s clase=%s padre=%s" % (
                fmt, path, asset.get_class().get_name(),
                asset.get_base_material().get_path_name() if asset.get_base_material() else "None"))

unreal.log("IMPORT_FIN")
