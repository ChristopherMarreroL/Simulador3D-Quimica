# -*- coding: utf-8 -*-
"""Pone el indicador de uso «luz estática» a los materiales del nivel Campana sin rehacer el nivel (ni el horneado).

    UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script=<este archivo> -nullrhi -unattended -nosplash -nosound
"""
import unreal

eal = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary
rutas = list(eal.list_assets("/Game/Laboratorio/Campana/Materiales", recursive=False)) + [
    "/Game/Laboratorio/Materiales/" + n for n in ("M_Vidrio_Boro", "M_Graduacion", "M_Vidrio_Ambar", "M_Tapa_PP_Azul", "M_Lab_HDPE")]
for ruta in rutas:
    mat = eal.load_asset(ruta)
    if not isinstance(mat, unreal.Material):
        continue
    mat.set_editor_property("used_with_static_lighting", True)
    mel.recompile_material(mat)
    eal.save_loaded_asset(mat, only_if_is_dirty=False)
    unreal.log("[CampanaMarcar] %s used_with_static_lighting=%s" % (ruta, mat.get_editor_property("used_with_static_lighting")))
unreal.log("[CampanaMarcar] FIN")
