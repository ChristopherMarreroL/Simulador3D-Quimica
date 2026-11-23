# -*- coding: utf-8 -*-
"""Cambia la compensación de exposición del post-proceso del nivel Campana sin rehacer el nivel ni el horneado.

    set CAMPANA_EXPOSICION=-1.5
    UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script=<este archivo> -nullrhi -unattended -nosplash -nosound
"""
import os

import unreal

MAPA = "/Game/Mapas/Campana"
valor = float(os.environ.get("CAMPANA_EXPOSICION", "-1.5"))
unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level(MAPA)
for actor in unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors():
    if isinstance(actor, unreal.PostProcessVolume):
        s = actor.get_editor_property("settings")
        s.set_editor_property("auto_exposure_bias", valor)
        s.set_editor_property("override_auto_exposure_bias", True)
        actor.set_editor_property("settings", s)
mundo = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
unreal.EditorLoadingAndSavingUtils.save_map(mundo, MAPA)
unreal.log("[CampanaPost] exposicion=%.2f guardado" % valor)
