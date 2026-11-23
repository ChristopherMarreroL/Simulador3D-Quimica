# -*- coding: utf-8 -*-
"""Sonda técnica (Fase 1): crea el nivel de prueba /Game/Mapas/Sonda y sus materiales.

Se ejecuta SIN interfaz con el intérprete de Python del editor de Unreal:

    UnrealEditor-Cmd.exe <Experimenta3D.uproject> -run=pythonscript
        -script="<ruta absoluta>/Tools/sonda_crear_nivel.py"
        -unattended -nopause -nosplash -nullrhi -nosound -stdout -FullStdOutLogOutput

Es repetible: si el nivel o los materiales ya existen, los rehace.

Unidades de Unreal: 1 uu = 1 cm. Los cuerpos de /Engine/BasicShapes miden 100 uu
(cubo de 1 m de lado; cilindro de 1 m de diámetro y 1 m de alto; esfera de 1 m de
diámetro), así que la escala coincide con la medida en metros.

Las medidas de esta sala son las del encargo de la sonda (4 x 4 x 3 m, encimera de
2 x 0,6 x 0,9 m); NO son medidas del laboratorio real.
"""

import unreal

MAPA = "/Game/Mapas/Sonda"
CARPETA_MATERIALES = "/Game/Sonda/Materiales"

CUBO = "/Engine/BasicShapes/Cube.Cube"
CILINDRO = "/Engine/BasicShapes/Cylinder.Cylinder"
ESFERA = "/Engine/BasicShapes/Sphere.Sphere"

# Exposición manual fija (sin cámara física): EV fijo, no se adapta a la escena.
COMPENSACION_EXPOSICION = 0.0

eal = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary


def registrar(texto):
    unreal.log("[Sonda] " + texto)


# --------------------------------------------------------------------------- materiales

def crear_material(nombre, color, rugosidad, metalico=0.0, especular=0.5, vidrio=False, opacidad=1.0):
    ruta = CARPETA_MATERIALES + "/" + nombre
    if eal.does_asset_exist(ruta):
        material = eal.load_asset(ruta)
        mel.delete_all_material_expressions(material)
    else:
        herramientas = unreal.AssetToolsHelpers.get_asset_tools()
        material = herramientas.create_asset(nombre, CARPETA_MATERIALES, unreal.Material, unreal.MaterialFactoryNew())
    if material is None:
        raise RuntimeError("No se pudo crear el material " + ruta)

    def constante(valor, y, propiedad):
        nodo = mel.create_material_expression(material, unreal.MaterialExpressionConstant, -350, y)
        nodo.set_editor_property("r", valor)
        mel.connect_material_property(nodo, "", propiedad)

    nodo_color = mel.create_material_expression(material, unreal.MaterialExpressionConstant3Vector, -350, -200)
    nodo_color.set_editor_property("constant", unreal.LinearColor(color[0], color[1], color[2], 1.0))
    mel.connect_material_property(nodo_color, "", unreal.MaterialProperty.MP_BASE_COLOR)
    constante(metalico, 0, unreal.MaterialProperty.MP_METALLIC)
    constante(especular, 100, unreal.MaterialProperty.MP_SPECULAR)
    constante(rugosidad, 200, unreal.MaterialProperty.MP_ROUGHNESS)

    if vidrio:
        material.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        material.set_editor_property("two_sided", True)
        # Iluminación por píxel con reflejos especulares en la superficie translúcida.
        material.set_editor_property("translucency_lighting_mode",
                                     unreal.TranslucencyLightingMode.TLM_SURFACE)
        constante(opacidad, 300, unreal.MaterialProperty.MP_OPACITY)
    else:
        material.set_editor_property("blend_mode", unreal.BlendMode.BLEND_OPAQUE)

    mel.recompile_material(material)
    if not eal.save_loaded_asset(material, only_if_is_dirty=False):
        raise RuntimeError("No se pudo guardar " + ruta)
    registrar("Material guardado: " + ruta)
    return material


# --------------------------------------------------------------------------- actores

def rot(cabeceo=0.0, guinada=0.0, alabeo=0.0):
    # unreal.Rotator ordena sus argumentos posicionales como (roll, pitch, yaw): usar siempre nombres.
    return unreal.Rotator(roll=alabeo, pitch=cabeceo, yaw=guinada)


VIA_USADA = {"editor": 0, "diferida": 0}


def generar(actores, clase, posicion, rotacion):
    """Crea un actor en el nivel abierto.

    Comprobado en 5.8.4 con el commandlet -run=pythonscript y -nullrhi:
    EditorActorSubsystem.spawn_actor_from_class funciona (los 22 actores se crean así).
    La trampa es spawn_actor_from_object(malla, ...): en el commandlet devuelve None y deja
    en el registro «SpawnActorFromObject. No actor was spawned». Por eso las mallas se crean
    como StaticMeshActor por clase y se les asigna la malla después.
    La creación diferida de GameplayStatics queda solo como red de seguridad (no se ha usado).
    """
    actor = actores.spawn_actor_from_class(clase, posicion, rotacion)
    if actor is not None:
        VIA_USADA["editor"] += 1
        return actor
    mundo = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    transformacion = unreal.Transform(posicion, rotacion, unreal.Vector(1.0, 1.0, 1.0))
    actor = unreal.GameplayStatics.begin_deferred_actor_spawn_from_class(mundo, clase, transformacion)
    if actor is not None:
        unreal.GameplayStatics.finish_spawning_actor(actor, transformacion)
        VIA_USADA["diferida"] += 1
    return actor


def crear_actor(actores, clase, nombre, posicion, rotacion=None):
    actor = generar(actores, clase, unreal.Vector(*posicion), rotacion or rot())
    if actor is None:
        raise RuntimeError("No se pudo crear el actor " + nombre)
    actor.set_actor_label(nombre)
    return actor


def crear_malla(actores, nombre, malla, posicion, escala, material, rotacion=None):
    recurso = unreal.load_asset(malla)
    if recurso is None:
        raise RuntimeError("No existe la malla " + malla)
    actor = crear_actor(actores, unreal.StaticMeshActor, nombre, posicion, rotacion)
    actor.set_actor_scale3d(unreal.Vector(*escala))
    componente = actor.static_mesh_component
    componente.set_static_mesh(recurso)
    componente.set_material(0, material)
    return actor


def construir_nivel(mate, pulido, vidrio):
    niveles = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actores = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

    if eal.does_asset_exist(MAPA):
        # Trampa: sin interfaz, delete_asset sobre un .umap devuelve True pero el archivo sigue en
        # disco y new_level falla con «An asset already exists at this location». Se carga y se vacía.
        registrar("El nivel ya existía: se carga y se vacía.")
        if not niveles.load_level(MAPA):
            raise RuntimeError("No se pudo cargar el nivel " + MAPA)
        for actor in actores.get_all_level_actors():
            actores.destroy_actor(actor)
    elif not niveles.new_level(MAPA):
        raise RuntimeError("new_level devolvió False para " + MAPA)

    # --- Sala de 4 x 4 x 3 m. Interior: x e y entre -200 y 200, z entre 0 y 300. Losas de 10 cm por fuera.
    crear_malla(actores, "Suelo", CUBO, (0, 0, -5), (4.2, 4.2, 0.1), mate)
    crear_malla(actores, "Techo", CUBO, (0, 0, 305), (4.2, 4.2, 0.1), mate)
    crear_malla(actores, "Pared_Fondo", CUBO, (-205, 0, 150), (0.1, 4.2, 3.0), mate)       # x = -200
    crear_malla(actores, "Pared_Lateral", CUBO, (0, -205, 150), (4.2, 0.1, 3.0), mate)     # y = -200
    crear_malla(actores, "Pared_Trasera", CUBO, (205, 0, 150), (0.1, 4.2, 3.0), mate)      # x = +200 (tras la cámara)
    # Pared de la ventana (y = +200) con un hueco de 1,5 m de ancho y 1,2 m de alto: x de -150 a 0, z de 100 a 220.
    crear_malla(actores, "Ventana_Izquierda", CUBO, (-175, 205, 150), (0.5, 0.1, 3.0), mate)   # x -200..-150
    crear_malla(actores, "Ventana_Derecha", CUBO, (100, 205, 150), (2.0, 0.1, 3.0), mate)      # x 0..200
    crear_malla(actores, "Ventana_Antepecho", CUBO, (-75, 205, 50), (1.5, 0.1, 1.0), mate)     # z 0..100
    crear_malla(actores, "Ventana_Dintel", CUBO, (-75, 205, 260), (1.5, 0.1, 0.8), mate)       # z 220..300

    # --- Encimera de 2 x 0,6 x 0,9 m contra la pared del fondo.
    crear_malla(actores, "Encimera", CUBO, (-170, 30, 45), (0.6, 2.0, 0.9), pulido)

    # --- Objetos pequeños a escala real sobre la encimera (z = 90).
    crear_malla(actores, "Cilindro_Vidrio_6x10cm", CILINDRO, (-170, 60, 95), (0.06, 0.06, 0.10), vidrio)
    crear_malla(actores, "Cilindro_Pulido_8x8cm", CILINDRO, (-160, 35, 94), (0.08, 0.08, 0.08), pulido)
    crear_malla(actores, "Esfera_Mate_8cm", ESFERA, (-175, 10, 94), (0.08, 0.08, 0.08), mate)
    crear_malla(actores, "Esfera_Pulida_5cm", ESFERA, (-158, -10, 92.5), (0.05, 0.05, 0.05), pulido)
    crear_malla(actores, "Esfera_Vidrio_10cm", ESFERA, (-172, -35, 95), (0.10, 0.10, 0.10), vidrio)

    # --- Luz direccional: entra por la ventana hacia -y, hacia abajo y un poco hacia -x.
    sol = crear_actor(actores, unreal.DirectionalLight, "Sol_Ventana", (0, 400, 400), rot(cabeceo=-37.0, guinada=-108.0))
    luz_sol = sol.get_component_by_class(unreal.DirectionalLightComponent)
    luz_sol.set_mobility(unreal.ComponentMobility.MOVABLE)
    luz_sol.set_editor_property("intensity", 10.0)             # lux (valor de trabajo, no físico)
    luz_sol.set_editor_property("atmosphere_sun_light", True)

    # --- Cielo: atmósfera + luz de cielo que captura la escena.
    crear_actor(actores, unreal.SkyAtmosphere, "Atmosfera", (0, 0, 0))
    cielo = crear_actor(actores, unreal.SkyLight, "Luz_Cielo", (0, 0, 350))
    luz_cielo = cielo.get_component_by_class(unreal.SkyLightComponent)
    luz_cielo.set_mobility(unreal.ComponentMobility.MOVABLE)
    luz_cielo.set_editor_property("source_type", unreal.SkyLightSourceType.SLS_CAPTURED_SCENE)
    luz_cielo.set_editor_property("real_time_capture", False)
    luz_cielo.set_editor_property("intensity", 1.0)

    # --- Luz rectangular en el techo (luminaria de 120 x 30 cm) apuntando hacia abajo.
    lampara = crear_actor(actores, unreal.RectLight, "Luminaria_Techo", (-60, 0, 295), rot(cabeceo=-90.0))
    luz_rect = lampara.get_component_by_class(unreal.RectLightComponent)
    luz_rect.set_mobility(unreal.ComponentMobility.MOVABLE)
    luz_rect.set_editor_property("intensity_units", unreal.LightUnits.CANDELAS)
    luz_rect.set_editor_property("intensity", 6.0)
    luz_rect.set_editor_property("source_width", 120.0)
    luz_rect.set_editor_property("source_height", 30.0)
    luz_rect.set_editor_property("attenuation_radius", 600.0)

    # --- Volumen de posprocesado sin límites con exposición manual fija.
    volumen = crear_actor(actores, unreal.PostProcessVolume, "Posprocesado_Exposicion", (0, 0, 150))
    volumen.set_editor_property("unbound", True)
    ajustes = volumen.get_editor_property("settings")
    ajustes.set_editor_property("override_auto_exposure_method", True)
    ajustes.set_editor_property("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL)
    ajustes.set_editor_property("override_auto_exposure_apply_physical_camera_exposure", True)
    ajustes.set_editor_property("auto_exposure_apply_physical_camera_exposure", False)
    ajustes.set_editor_property("override_auto_exposure_bias", True)
    ajustes.set_editor_property("auto_exposure_bias", COMPENSACION_EXPOSICION)
    volumen.set_editor_property("settings", ajustes)

    # --- Cámara fija (se activa sola para el jugador 0) y punto de inicio fuera de plano.
    camara = crear_actor(actores, unreal.CameraActor, "Camara_Sonda", (60, -110, 150), rot(cabeceo=-11.5, guinada=148.7))
    camara.set_editor_property("auto_activate_for_player", unreal.AutoReceiveInput.PLAYER0)
    componente_camara = camara.camera_component
    componente_camara.set_editor_property("field_of_view", 90.0)
    componente_camara.set_editor_property("constrain_aspect_ratio", False)
    crear_actor(actores, unreal.PlayerStart, "Inicio_Jugador", (150, -150, 110), rot(guinada=148.7))

    if not niveles.save_current_level():
        raise RuntimeError("save_current_level devolvió False")
    registrar("Nivel guardado: %s (%d actores; creados por el subsistema del editor: %d; por creación diferida: %d)"
              % (MAPA, len(actores.get_all_level_actors()), VIA_USADA["editor"], VIA_USADA["diferida"]))


def main():
    registrar("Motor: " + unreal.SystemLibrary.get_engine_version())
    mate = crear_material("M_Sonda_MateClaro", (0.78, 0.76, 0.72), rugosidad=0.9)
    pulido = crear_material("M_Sonda_PulidoOscuro", (0.02, 0.02, 0.025), rugosidad=0.08)
    vidrio = crear_material("M_Sonda_Vidrio", (0.85, 0.95, 0.92), rugosidad=0.03, vidrio=True, opacidad=0.2)
    construir_nivel(mate, pulido, vidrio)
    for ruta in (MAPA, CARPETA_MATERIALES + "/M_Sonda_MateClaro", CARPETA_MATERIALES + "/M_Sonda_PulidoOscuro",
                 CARPETA_MATERIALES + "/M_Sonda_Vidrio"):
        registrar("Existe %s: %s" % (ruta, eal.does_asset_exist(ruta)))
    registrar("SONDA_OK")


main()
