# -*- coding: utf-8 -*-
"""Sonda técnica (Fase 1): deriva de /Game/Mapas/Sonda el nivel /Game/Mapas/SondaHorneada,
preparado para hornear la luz con Lightmass por CPU.

    UnrealEditor-Cmd.exe <Experimenta3D.uproject> -run=pythonscript
        -script="<ruta absoluta>/Tools/sonda_preparar_horneado.py"
        -unattended -nopause -nosplash -nullrhi -nosound -stdout -FullStdOutLogOutput

Después se hornea (necesita render, NO admite -nullrhi):

    UnrealEditor-Cmd.exe <Experimenta3D.uproject> -run=ResavePackages
        -map=/Game/Mapas/SondaHorneada -buildlighting -buildreflectioncaptures -quality=Medium
        -allowcommandletrendering -unattended -nopause -nosplash -stdout -FullStdOutLogOutput

Cambios respecto a la sonda dinámica: luces estacionarias (luz directa dinámica, sombras y luz
indirecta horneadas), objetos pequeños móviles (se iluminan con el mapa de luz volumétrico, como
los objetos que el jugador podrá coger), resolución de mapas de luz explícita y una captura de
reflejos esférica en el centro de la sala.
"""

import unreal

ORIGEN = "/Game/Mapas/Sonda"
DESTINO = "/Game/Mapas/SondaHorneada"

RESOLUCION = {"Suelo": 256, "Techo": 128, "Pared_Fondo": 256, "Pared_Lateral": 256, "Pared_Trasera": 128,
              "Ventana_Izquierda": 64, "Ventana_Derecha": 128, "Ventana_Antepecho": 64, "Ventana_Dintel": 64,
              "Encimera": 128}


def registrar(texto):
    unreal.log("[SondaHorneado] " + texto)


def main():
    niveles = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actores = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if not niveles.load_level(ORIGEN):
        raise RuntimeError("No se pudo cargar " + ORIGEN)

    estaticos = moviles = luces = 0
    for actor in actores.get_all_level_actors():
        nombre = actor.get_actor_label()
        if isinstance(actor, unreal.StaticMeshActor):
            componente = actor.static_mesh_component
            if nombre in RESOLUCION:
                componente.set_mobility(unreal.ComponentMobility.STATIC)
                componente.set_editor_property("override_light_map_res", True)
                componente.set_editor_property("overridden_light_map_res", RESOLUCION[nombre])
                estaticos += 1
            else:
                componente.set_mobility(unreal.ComponentMobility.MOVABLE)
                moviles += 1
        elif isinstance(actor, (unreal.DirectionalLight, unreal.RectLight, unreal.SkyLight)):
            componente = actor.get_component_by_class(unreal.LightComponentBase)
            componente.set_mobility(unreal.ComponentMobility.STATIONARY)
            luces += 1

    mundo = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    captura = actores.spawn_actor_from_class(unreal.SphereReflectionCapture, unreal.Vector(0, 0, 150),
                                             unreal.Rotator(roll=0, pitch=0, yaw=0))
    if captura is None:
        raise RuntimeError("No se pudo crear la captura de reflejos")
    captura.set_actor_label("Captura_Reflejos")
    componente_captura = captura.get_component_by_class(unreal.SphereReflectionCaptureComponent)
    componente_captura.set_editor_property("influence_radius", 450.0)

    if not unreal.EditorLoadingAndSavingUtils.save_map(mundo, DESTINO):
        raise RuntimeError("No se pudo guardar " + DESTINO)
    registrar("Guardado %s: %d mallas estáticas, %d móviles, %d luces estacionarias"
              % (DESTINO, estaticos, moviles, luces))
    registrar("SONDA_HORNEADO_PREPARADO")


main()
