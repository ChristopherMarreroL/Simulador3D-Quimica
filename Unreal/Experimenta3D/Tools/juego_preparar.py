# -*- coding: utf-8 -*-
"""Prepara el juego en /Game/Mapas/Campana (corte vertical «Prueba de cloruros», 18 de noviembre de 2026).

    UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script=<este archivo> -nullrhi -unattended -nosplash -nosound

Después de Tools/campana_crear_nivel.py y del horneado. Es repetible: borra los actores del juego que hubiera y
los vuelve a poner. Todo lo que se coloca es MÓVIL (AExpObjeto), así que no invalida la luz horneada; lo único
estático que se quita es la cristalería decorativa que ocupaba los sitios del juego (su sombra horneada en la
encimera desaparece al rehornear).

  - Materiales del jugador en /Game/Juego/Materiales: piel, guante de nitrilo azul, bata y contorno dorado.
  - Objetos (AExpObjeto) con el mismo identificador de objetivo que la web: estantería con 4 frascos del modelo
    (AgNO3 en vidrio ámbar, NaCl, HCl, NaOH), bandeja de 8 huecos, matraz, probeta y piseta dentro de la
    campana, recipiente de residuos, gafas y guantes en la pared derecha y tablero de prácticas en el fondo.
  - Modo de juego AExpGameMode en el nivel, la cámara fija de las capturas deja de activarse sola y el inicio
    del jugador pasa a la entrada de la sala.
Las posiciones son de diseño (no medidas): la encimera está a 90 cm y la campana ocupa x = -90…30.
"""
import json
import os

import unreal

MAPA = "/Game/Mapas/Campana"
MATS = "/Game/Juego/Materiales"
LAB = "/Game/Laboratorio/Materiales/"
IMP = "/Game/Laboratorio/Importado/%s/%s/StaticMeshes/%s"
PROYECTO = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
PERFILES = os.path.normpath(os.path.join(PROYECTO, "..", "..", "art", "export", "perfiles_interiores.json"))
ETIQUETA_JUEGO = "Juego_"

eal = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary
P = unreal.MaterialProperty


def registrar(texto):
    unreal.log("[JuegoPreparar] " + texto)


def cargar(ruta):
    a = eal.load_asset(ruta)
    if a is None:
        raise RuntimeError("Falta " + ruta)
    return a


def malla(nombre):
    return cargar(IMP % (nombre, nombre, nombre))


# ---------------------------------------------------------------- Materiales

def material(nombre, base, rugosidad, metalico=0.0, contorno=False):
    ruta = MATS + "/" + nombre
    if eal.does_asset_exist(ruta):
        eal.delete_asset(ruta)
    m = unreal.AssetToolsHelpers.get_asset_tools().create_asset(nombre, MATS, unreal.Material, unreal.MaterialFactoryNew())
    if contorno:
        # Superposición: borde dorado que crece con el ángulo rasante (Fresnel), sin iluminar.
        m.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        m.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
        fr = mel.create_material_expression(m, unreal.MaterialExpressionFresnel, -500, 0)
        fr.set_editor_property("exponent", 2.5)
        fr.set_editor_property("base_reflect_fraction", 0.05)
        oro = mel.create_material_expression(m, unreal.MaterialExpressionConstant3Vector, -500, 200)
        oro.set_editor_property("constant", unreal.LinearColor(base[0], base[1], base[2], 1.0))
        mul = mel.create_material_expression(m, unreal.MaterialExpressionMultiply, -250, 100)
        mel.connect_material_expressions(fr, "", mul, "A")
        mel.connect_material_expressions(oro, "", mul, "B")
        mel.connect_material_property(mul, "", P.MP_EMISSIVE_COLOR)
        op = mel.create_material_expression(m, unreal.MaterialExpressionMultiply, -250, 300)
        op.set_editor_property("const_b", 0.85)
        mel.connect_material_expressions(fr, "", op, "A")
        mel.connect_material_property(op, "", P.MP_OPACITY)
    else:
        c = mel.create_material_expression(m, unreal.MaterialExpressionConstant3Vector, -500, 0)
        c.set_editor_property("constant", unreal.LinearColor(base[0], base[1], base[2], 1.0))
        mel.connect_material_property(c, "", P.MP_BASE_COLOR)
        for valor, prop, y in ((rugosidad, P.MP_ROUGHNESS, 150), (metalico, P.MP_METALLIC, 300)):
            k = mel.create_material_expression(m, unreal.MaterialExpressionConstant, -500, y)
            k.set_editor_property("r", valor)
            mel.connect_material_property(k, "", prop)
    mel.recompile_material(m)
    eal.save_loaded_asset(m, only_if_is_dirty=False)
    return m


def materiales():
    # Albedos estimados: piel media, nitrilo azul de laboratorio, algodón blanco de bata.
    return {
        "piel": material("M_Exp_Piel", (0.48, 0.30, 0.22), 0.55),
        "guante": material("M_Exp_Guante_Nitrilo", (0.035, 0.13, 0.55), 0.42),
        "bata": material("M_Exp_Bata", (0.72, 0.73, 0.74), 0.92),
        "contorno": material("M_Exp_Contorno", (6.0, 3.6, 0.6), 0.0, contorno=True),
        "carton": material("M_Exp_Caja", (0.70, 0.70, 0.72), 0.7),
        "residuos": material("M_Exp_Residuos", (0.62, 0.55, 0.20), 0.5),
        "tablero": material("M_Exp_Tablero", (0.80, 0.80, 0.80), 0.35),
    }


# ---------------------------------------------------------------- Nivel

def main():
    with open(PERFILES, encoding="utf-8") as f:
        perfiles = json.load(f)
    m = materiales()
    vidrio = cargar(LAB + "M_Vidrio_Boro")
    ambar = cargar(LAB + "M_Vidrio_Ambar")
    graduacion = cargar(LAB + "M_Graduacion")
    tapa_pp = cargar(LAB + "M_Tapa_PP_Azul")
    hdpe = cargar(LAB + "M_Lab_HDPE")
    negro = cargar(LAB + "M_Lab_Negro")
    acero = cargar("/Game/Laboratorio/Campana/Materiales/M_Acero_Satinado")
    agua = cargar(LAB + "M_Liquido_Incoloro")
    precipitado = cargar(LAB + "M_Liquido_Precipitado")
    suspension = cargar(LAB + "M_Liquido_Suspension")
    cubo = cargar("/Engine/BasicShapes/Cube.Cube")
    cilindro = cargar("/Engine/BasicShapes/Cylinder.Cylinder")
    clase_objeto = unreal.load_class(None, "/Script/Experimenta3D.ExpObjeto")
    clase_modo = unreal.load_class(None, "/Script/Experimenta3D.ExpGameMode")
    if clase_objeto is None or clase_modo is None:
        raise RuntimeError("Faltan las clases del juego: compila el módulo Experimenta3D")
    T = unreal.ExpTipo

    niveles = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actores = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    niveles.load_level(MAPA)
    mundo = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    quitar = {"Matraz_500", "Vaso_250", "Vaso_500", "Probeta_100", "Frasco_Ambar", "Frasco_Claro", "Tapa_Ambar", "Tapa_Claro", "Piseta"}
    for a in actores.get_all_level_actors():
        etiqueta = a.get_actor_label()
        if etiqueta.startswith(ETIQUETA_JUEGO) or etiqueta in quitar or isinstance(a, unreal.PlayerStart):
            actores.destroy_actor(a)
        elif etiqueta == "Cielo_HDRI":
            # La esfera del cielo no debe chocar ni tapar la puntería (el jugador empieza dentro de ella).
            c = a.static_mesh_component
            c.set_collision_profile_name("NoCollision")
            c.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
        elif etiqueta in ("Campana_Guillotina", "Encimera_Granito"):
            # El vidrio de la guillotina se ve a través y la colisión simple de la encimera (con el salpicadero) envuelve
            # el pie de los frascos: ninguno de los dos debe cortar la puntería (siguen bloqueando al jugador).
            # (la respuesta de colisión de estas instancias no se guarda: el personaje ignora la etiqueta).
            a.set_editor_property("tags", ["ExpTransparente"])
        elif isinstance(a, unreal.CameraActor):
            a.set_editor_property("auto_activate_for_player", unreal.AutoReceiveInput.DISABLED)

    def materiales_vidrio(comp, recurso, cristal):
        for i, ranura in enumerate(recurso.static_materials):
            n = str(ranura.material_slot_name)
            comp.set_material(i, {"M_Graduacion": graduacion, "M_Cap_PP_Blue": tapa_pp, "M_HDPE": hdpe}.get(n, cristal))

    def objeto(nombre, tipo, objetivo, pos, guinada=0.0, zona=(6, 6, 10), centro=(0, 0, 10), boca=20.0, texto=None):
        a = actores.spawn_actor_from_class(clase_objeto, unreal.Vector(*pos), unreal.Rotator(0.0, 0.0, guinada))
        a.set_actor_label(ETIQUETA_JUEGO + nombre)
        a.set_editor_property("tipo", tipo)
        a.set_editor_property("target_id", objetivo)
        if texto:
            a.set_editor_property("nombre", texto)
        a.set_editor_property("zona_extension", unreal.Vector(*zona))
        a.set_editor_property("zona_centro", unreal.Vector(*centro))
        a.set_editor_property("boca_cm", boca)
        a.set_editor_property("material_contorno", m["contorno"])
        return a

    def comp(a, nombre):
        return a.get_editor_property(nombre)

    def caja(c, mat, escala, rel=(0, 0, 0)):
        c.set_static_mesh(cubo)
        c.set_material(0, mat)
        c.set_relative_scale3d(unreal.Vector(*escala))
        c.set_relative_location(unreal.Vector(*rel), False, False)

    def liquido(c, perfil, mat):
        c.set_editor_property("perfil_interior_mm", [unreal.Vector2D(r, h) for r, h in perfiles[perfil]])
        c.set_editor_property("material_liquido", mat)

    def rotulo(a, texto, rel, tam=1.0, color=(20, 20, 24)):
        r = comp(a, "rotulo")
        r.set_editor_property("text", texto)
        r.set_world_size(tam)
        r.set_text_render_color(unreal.Color(r=color[0], g=color[1], b=color[2], a=255))
        r.set_relative_location(unreal.Vector(*rel), False, False)

    # --- Estantería de reactivos sobre la encimera derecha (frente hacia +Y).
    z = 90.0
    est = objeto("Estanteria", T.ESTANTERIA, "reagent-shelf", (58.0, -36.0, z), 90.0, zona=(3, 26, 15), centro=(0, 0, 15), texto="Estantería de reactivos")
    caja(comp(est, "cuerpo"), acero, (0.02, 0.52, 0.30), (0, 0, 15))
    caja(comp(est, "extra"), acero, (0.16, 0.52, 0.012), (7, 0, 0.6))
    botella = malla("SM_ReagentBottle_500")
    for i, (rid, formula, en_ambar) in enumerate((("agno3", "AgNO3 0,1 M", True), ("nacl", "NaCl 1 M", False),
                                                 ("hcl", "HCl 1 M", False), ("naoh", "NaOH 1 M", False))):
        f = objeto("Frasco_" + rid, T.FRASCO, "reagent:" + rid, (40.0 + i * 12.0, -28.0, z + 1.2), 90.0, zona=(4.8, 4.8, 9), centro=(0, 0, 9), boca=18.0)
        f.set_editor_property("reactivo_id", rid)
        cu = comp(f, "cuerpo")
        cu.set_static_mesh(botella)
        materiales_vidrio(cu, botella, ambar if en_ambar else vidrio)
        ex = comp(f, "extra")
        ex.set_static_mesh(malla("SM_Liquid_Bottle500_400mL"))
        ex.set_material(0, agua)
        tp = comp(f, "tapa")
        tp.set_static_mesh(malla("SM_Cap_GL45"))
        tp.set_material(0, tapa_pp)
        tp.set_relative_location(unreal.Vector(0, 0, 15.5), False, False)
        rotulo(f, formula, (4.9, 0, 7.0), 1.1, (235, 235, 235) if en_ambar else (20, 20, 24))

    # --- Dentro de la campana: bandeja de 8, matraz de 500 mL, probeta de 100 mL y piseta.
    band = objeto("Bandeja", T.BANDEJA, "hood-tray", (20.0, -27.0, z), 0.0, zona=(21, 11, 7), centro=(-14, 5, 7), texto="Bandeja de la campana")
    caja(comp(band, "cuerpo"), acero, (0.42, 0.22, 0.01), (-14.25, 5.0, 0.5))
    mat = objeto("Matraz", T.MATRAZ, "hood", (-35.0, 6.0, z), 0.0, zona=(8, 8, 9), centro=(0, 0, 9), boca=17.6, texto="Matraz Erlenmeyer de 500 mL")
    erl = malla("SM_Erlenmeyer_500")
    comp(mat, "cuerpo").set_static_mesh(erl)
    materiales_vidrio(comp(mat, "cuerpo"), erl, vidrio)
    liquido(comp(mat, "liquido"), "SM_Erlenmeyer_500", agua)
    liquido(comp(mat, "sedimento"), "SM_Erlenmeyer_500", precipitado)
    mz = comp(mat, "mezcla")
    mz.set_editor_property("material_incoloro", agua)
    mz.set_editor_property("material_precipitado", precipitado)
    mz.set_editor_property("material_suspension", suspension)
    pro = objeto("Probeta", T.PROBETA, "hood-cylinder", (-62.0, 14.0, z), 0.0, zona=(4.5, 4.5, 13), centro=(0, 0, 13), boca=25.3, texto="Probeta de 100 mL")
    gc = malla("SM_GradCylinder_100")
    comp(pro, "cuerpo").set_static_mesh(gc)
    materiales_vidrio(comp(pro, "cuerpo"), gc, vidrio)
    liquido(comp(pro, "liquido"), "SM_GradCylinder_100", agua)
    pis = objeto("Piseta", T.PISETA, "hood-washbottle", (-80.0, -12.0, z), 0.0, zona=(5, 5, 11), centro=(0, 0, 11), boca=22.0, texto="Piseta de agua destilada")
    wb = malla("SM_WashBottle_500")
    comp(pis, "cuerpo").set_static_mesh(wb)
    materiales_vidrio(comp(pis, "cuerpo"), wb, hdpe)

    # --- Residuos en el suelo, a la derecha del gabinete.
    res = objeto("Residuos", T.RESIDUOS, "hood-waste", (120.0, 20.0, 0.0), 90.0, zona=(16, 16, 26), centro=(0, 0, 26), boca=46.0, texto="Recipiente de residuos (metales)")
    rc = comp(res, "cuerpo")
    rc.set_static_mesh(cilindro)
    rc.set_material(0, m["residuos"])
    rc.set_relative_scale3d(unreal.Vector(0.28, 0.28, 0.42))
    rc.set_relative_location(unreal.Vector(0, 0, 21), False, False)
    re = comp(res, "extra")
    re.set_static_mesh(malla("SM_Funnel"))
    re.set_material(0, hdpe)
    re.set_relative_location(unreal.Vector(0, 0, 42), False, False)
    rotulo(res, "RESIDUOS<br>METALES (Ag)", (14.3, 0, 26), 2.2, (20, 20, 24))

    # --- Protección en la pared derecha (x = 250), mirando a la sala (-X).
    estante = objeto("EstanteProteccion", T.ESTANTERIA, "ppe-shelf", (244.0, 160.0, 128.0), 180.0, zona=(1, 1, 1), centro=(0, 0, 0), texto="Estación de protección")
    caja(comp(estante, "cuerpo"), acero, (0.14, 0.70, 0.015), (0, 0, 0))
    rotulo(estante, "PROTECCIÓN OBLIGATORIA", (7.5, 0, 34), 3.0, (30, 30, 34))
    gaf = objeto("Gafas", T.PROTECCION, "ppe-goggles", (242.0, 140.0, 129.0), 180.0, zona=(7, 10, 6), centro=(0, 0, 4), texto="Gafas de seguridad")
    caja(comp(gaf, "cuerpo"), negro, (0.05, 0.17, 0.05), (0, 0, 3))
    caja(comp(gaf, "extra"), vidrio, (0.02, 0.16, 0.045), (2.6, 0, 3))
    gua = objeto("Guantes", T.PROTECCION, "ppe-gloves", (242.0, 180.0, 129.0), 180.0, zona=(8, 13, 7), centro=(0, 0, 5), texto="Guantes de nitrilo")
    caja(comp(gua, "cuerpo"), m["carton"], (0.12, 0.24, 0.09), (0, 0, 4.5))
    caja(comp(gua, "extra"), m["guante"], (0.121, 0.10, 0.03), (0, 0, 7.5))
    rotulo(gua, "NITRILO · M", (6.2, 0, 3.0), 1.6, (20, 40, 110))

    # --- Tablero de prácticas en la pared del fondo, a la derecha de la estación.
    tab = objeto("Tablero", T.TABLERO, "recipe-board", (165.0, -43.0, 160.0), 90.0, zona=(3, 38, 28), centro=(0, 0, 0), texto="Tablero de prácticas")
    caja(comp(tab, "cuerpo"), m["tablero"], (0.02, 0.76, 0.56), (0, 0, 0))
    rotulo(tab, "PRACTICAS", (1.4, 0, 0), 3.4, (10, 12, 16))
    comp(tab, "rotulo").set_editor_property("horizontal_alignment", unreal.HorizTextAligment.EHTA_CENTER)

    # --- Inicio del jugador y modo de juego.
    actores.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(150.0, 300.0, 100.0), unreal.Rotator(0.0, 0.0, -118.0)).set_actor_label(ETIQUETA_JUEGO + "Inicio")
    ws = mundo.get_world_settings()
    ws.set_editor_property("default_game_mode", clase_modo)
    if not unreal.EditorLoadingAndSavingUtils.save_map(mundo, MAPA):
        raise RuntimeError("No se pudo guardar " + MAPA)
    registrar("JUEGO_OK %s: %d actores del juego" % (MAPA, len([a for a in actores.get_all_level_actors() if a.get_actor_label().startswith(ETIQUETA_JUEGO)])))


main()
