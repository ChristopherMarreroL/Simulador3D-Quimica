# -*- coding: utf-8 -*-
"""Vitrina de cristalería: nivel de prueba /Game/Mapas/Vitrina para VER las mallas importadas.

    UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script=<este archivo> -nullrhi -unattended -nosplash

No es el laboratorio: es una encimera oscura con pared blanca, las cuatro mallas de
/Game/Laboratorio/Importado y materiales de vidrio provisionales (translúcidos con Fresnel,
sin refracción). Las medidas del decorado no son del laboratorio real. Es repetible.
"""
import unreal

MAPA = "/Game/Mapas/Vitrina"
MATERIALES = "/Game/Laboratorio/Materiales"
IMPORTADO = "/Game/Laboratorio/Importado/%s/%s/StaticMeshes/%s"   # Interchange añade una carpeta con el nombre del GLB
CUBO = "/Engine/BasicShapes/Cube.Cube"

eal = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary
P = unreal.MaterialProperty


def rot(cabeceo=0.0, guinada=0.0, alabeo=0.0):
    return unreal.Rotator(roll=alabeo, pitch=cabeceo, yaw=guinada)


def material(nombre, color, rugosidad, vidrio=False, opacidad_centro=0.08, especular=0.5,
             transmitancia=(1.0, 1.0, 1.0), parametro_color=False):
    ruta = MATERIALES + "/" + nombre
    # Trampa: delete_all_material_expressions NO borra el nodo de salida «Thin Translucent»; al
    # repetir el guion se acumulaban y el material dejaba de compilar («can contain only one Thin
    # Translucent Material node»). Los materiales de vidrio se borran y se crean de nuevo.
    if vidrio and eal.does_asset_exist(ruta):
        if not eal.delete_asset(ruta):
            raise RuntimeError("No se pudo borrar " + ruta)
    if eal.does_asset_exist(ruta):
        mat = eal.load_asset(ruta)
        mel.delete_all_material_expressions(mat)
    else:
        mat = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
            nombre, MATERIALES, unreal.Material, unreal.MaterialFactoryNew())

    def constante(valor, y, propiedad):
        nodo = mel.create_material_expression(mat, unreal.MaterialExpressionConstant, -350, y)
        nodo.set_editor_property("r", valor)
        mel.connect_material_property(nodo, "", propiedad)

    if parametro_color:
        # Parámetro «Color»: UMezclaComponent le pasa el color de la especie sólida del modelo.
        nodo = mel.create_material_expression(mat, unreal.MaterialExpressionVectorParameter, -350, -200)
        nodo.set_editor_property("parameter_name", "Color")
        nodo.set_editor_property("default_value", unreal.LinearColor(color[0], color[1], color[2], 1.0))
    else:
        nodo = mel.create_material_expression(mat, unreal.MaterialExpressionConstant3Vector, -350, -200)
        nodo.set_editor_property("constant", unreal.LinearColor(color[0], color[1], color[2], 1.0))
    mel.connect_material_property(nodo, "", P.MP_BASE_COLOR)
    constante(0.0, 0, P.MP_METALLIC)
    constante(especular, 100, P.MP_SPECULAR)
    constante(rugosidad, 200, P.MP_ROUGHNESS)
    if vidrio:
        # Vidrio fino: modelo «Thin Translucent». El fondo se multiplica por el color de transmitancia
        # (tinte físico, sin velo lechoso) y los brillos especulares se calculan por píxel.
        mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
        mat.set_editor_property("two_sided", True)
        mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_THIN_TRANSLUCENT)
        mat.set_editor_property("translucency_lighting_mode",
                                unreal.TranslucencyLightingMode.TLM_SURFACE_PER_PIXEL_LIGHTING)
        mat.set_editor_property("screen_space_reflections", True)
        salida = mel.create_material_expression(mat, unreal.MaterialExpressionThinTranslucentMaterialOutput, 0, 400)
        tinte = mel.create_material_expression(mat, unreal.MaterialExpressionConstant3Vector, -350, 400)
        tinte.set_editor_property("constant", unreal.LinearColor(transmitancia[0], transmitancia[1], transmitancia[2], 1.0))
        mel.connect_material_expressions(tinte, "", salida, "TransmittanceColor")
        # Cobertura: casi nula de frente, mayor en los bordes rasantes (contorno del vidrio).
        fresnel = mel.create_material_expression(mat, unreal.MaterialExpressionFresnel, -350, 300)
        fresnel.set_editor_property("exponent", 6.0)
        fresnel.set_editor_property("base_reflect_fraction", opacidad_centro)
        mel.connect_material_property(fresnel, "", P.MP_OPACITY)
        # Refracción leve solo en los bordes: la pared es fina, no un bloque macizo.
        try:
            mat.set_editor_property("refraction_method", unreal.RefractionMode.RM_INDEX_OF_REFRACTION)
            borde = mel.create_material_expression(mat, unreal.MaterialExpressionFresnel, -700, 520)
            borde.set_editor_property("exponent", 2.0)
            borde.set_editor_property("base_reflect_fraction", 0.0)
            ior = mel.create_material_expression(mat, unreal.MaterialExpressionLinearInterpolate, -350, 520)
            ior.set_editor_property("const_a", 1.0)
            ior.set_editor_property("const_b", 1.04)   # con 1.12 el borde arrastraba el azul de la tapa
            mel.connect_material_expressions(borde, "", ior, "Alpha")
            mel.connect_material_property(ior, "", P.MP_REFRACTION)
        except Exception as error:  # noqa: BLE001
            unreal.log_warning("VITRINA_SIN_REFRACCION %r" % (error,))
    else:
        mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_OPAQUE)
    mel.recompile_material(mat)
    eal.save_loaded_asset(mat, only_if_is_dirty=False)
    return mat


def material_suspension(nombre):
    """Líquido con precipitado en suspensión. Parámetros que fija UMezclaComponent:
    ColorDisolucion e Intensidad (color que da el modelo y cuánto, 0–1), Color (especie sólida),
    Turbidez (0–1) y Heterogeneidad (1 = nube recién formada, 0 = repartida).
    t = Turbidez * mezcla(1, ruido animado, Heterogeneidad); cobertura = saturar(0,03 + t) con el
    color del sólido; transmitancia = mezcla(blanco, ColorDisolucion, Intensidad)."""
    ruta = MATERIALES + "/" + nombre
    if eal.does_asset_exist(ruta) and not eal.delete_asset(ruta):
        raise RuntimeError("No se pudo borrar " + ruta)
    mat = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        nombre, MATERIALES, unreal.Material, unreal.MaterialFactoryNew())
    mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
    mat.set_editor_property("two_sided", True)
    # Modelo «Thin Translucent». Probado y descartado: translúcido iluminado normal, con el color en
    # el color base; el líquido salía gris oscuro y el color solo se veía en el borde.
    mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_THIN_TRANSLUCENT)
    mat.set_editor_property("translucency_lighting_mode", unreal.TranslucencyLightingMode.TLM_SURFACE_PER_PIXEL_LIGHTING)

    def nodo(clase, x, y, **props):
        n = mel.create_material_expression(mat, clase, x, y)
        for clave, valor in props.items():
            n.set_editor_property(clave, valor)
        return n

    def unir(origen, destino, entrada):
        if not mel.connect_material_expressions(origen, "", destino, entrada):
            raise RuntimeError("No se pudo conectar la entrada %r de %s" % (entrada, destino.get_class().get_name()))

    color = nodo(unreal.MaterialExpressionVectorParameter, -400, -300, parameter_name="Color",
                 default_value=unreal.LinearColor(0.82, 0.82, 0.80, 1.0))
    color_disolucion = nodo(unreal.MaterialExpressionVectorParameter, -400, -500, parameter_name="ColorDisolucion",
                            default_value=unreal.LinearColor(0.62, 0.79, 0.85, 1.0))
    intensidad = nodo(unreal.MaterialExpressionScalarParameter, -900, -50, parameter_name="Intensidad", default_value=0.0)
    mel.connect_material_property(nodo(unreal.MaterialExpressionConstant, -400, -150, r=0.45), "", P.MP_ROUGHNESS)

    turbidez = nodo(unreal.MaterialExpressionScalarParameter, -900, 100, parameter_name="Turbidez", default_value=0.8)
    heterogeneidad = nodo(unreal.MaterialExpressionScalarParameter, -900, 250, parameter_name="Heterogeneidad",
                          default_value=0.0)
    # Ruido 3D en espacio de mundo que sube despacio: volutas que cambian con el tiempo.
    posicion = nodo(unreal.MaterialExpressionWorldPosition, -1700, 400)
    tiempo = nodo(unreal.MaterialExpressionTime, -1700, 550)
    deriva = nodo(unreal.MaterialExpressionConstant3Vector, -1700, 650, constant=unreal.LinearColor(0.3, 0.2, -1.2, 0.0))
    avance = nodo(unreal.MaterialExpressionMultiply, -1500, 580)
    unir(tiempo, avance, "A")
    unir(deriva, avance, "B")
    movido = nodo(unreal.MaterialExpressionAdd, -1350, 450)
    unir(posicion, movido, "A")
    unir(avance, movido, "B")
    ruido = nodo(unreal.MaterialExpressionNoise, -1150, 450, scale=0.9, levels=3, output_min=0.0, output_max=1.0)
    nombres = [str(n) for n in mel.get_material_expression_input_names(ruido)]
    unreal.log("VITRINA_RUIDO entradas=%s" % nombres)
    unir(movido, ruido, nombres[0])   # la primera entrada del nodo de ruido es la posición
    reparto = nodo(unreal.MaterialExpressionLinearInterpolate, -900, 420, const_a=1.0)
    unir(ruido, reparto, "B")
    unir(heterogeneidad, reparto, "Alpha")
    producto = nodo(unreal.MaterialExpressionMultiply, -700, 250)
    unir(turbidez, producto, "A")
    unir(reparto, producto, "B")
    # El color de la disolución tiñe la luz que la ATRAVIESA (transmitancia), como en el vidrio
    # ámbar; el sólido en suspensión es cobertura difusa del color de la especie.
    # Además de teñir la luz transmitida, la disolución coloreada devuelve algo de luz difusa de
    # su propio color (cobertura 0,6 * Intensidad): sin eso, sobre fondo oscuro no se ve.
    difuso = nodo(unreal.MaterialExpressionLinearInterpolate, -150, -300)
    unir(color_disolucion, difuso, "A")
    unir(color, difuso, "B")
    unir(producto, difuso, "Alpha")
    mel.connect_material_property(difuso, "", P.MP_BASE_COLOR)
    # APROXIMACIÓN DE RENDERIZADO, no química: en este equipo (SM5, sin Lumen) las luces locales
    # apenas iluminan las superficies translúcidas y el líquido salía gris oscuro. Se añade el
    # mismo color como emisión fija (0,45), que hace de luz ambiente de la sala. No reacciona a
    # las luces: con la sala a oscuras seguiría viéndose. Revisar cuando haya iluminación global.
    ambiente = nodo(unreal.MaterialExpressionMultiply, 50, -300, const_b=0.45)
    unir(difuso, ambiente, "A")
    mel.connect_material_property(ambiente, "", P.MP_EMISSIVE_COLOR)
    blanco = nodo(unreal.MaterialExpressionConstant3Vector, -400, -650, constant=unreal.LinearColor(1.0, 1.0, 1.0, 1.0))
    tinte = nodo(unreal.MaterialExpressionLinearInterpolate, -150, -550)
    unir(blanco, tinte, "A")
    unir(color_disolucion, tinte, "B")
    unir(intensidad, tinte, "Alpha")
    salida = nodo(unreal.MaterialExpressionThinTranslucentMaterialOutput, 100, -550)
    unir(tinte, salida, "TransmittanceColor")
    cobertura_color = nodo(unreal.MaterialExpressionMultiply, -750, 120, const_b=0.6)
    unir(intensidad, cobertura_color, "A")
    con_color = nodo(unreal.MaterialExpressionAdd, -650, 250)
    unir(producto, con_color, "A")
    unir(cobertura_color, con_color, "B")
    suma = nodo(unreal.MaterialExpressionAdd, -550, 250, const_b=0.03)
    unir(con_color, suma, "A")
    saturado = nodo(unreal.MaterialExpressionSaturate, -400, 250)
    unir(suma, saturado, "")
    mel.connect_material_property(saturado, "", P.MP_OPACITY)
    mel.recompile_material(mat)
    eal.save_loaded_asset(mat, only_if_is_dirty=False)
    return mat


def main():
    niveles = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actores = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

    blanco = material("M_Vitrina_Pared", (0.80, 0.80, 0.78), 0.85)
    encimera = material("M_Vitrina_Encimera", (0.025, 0.027, 0.032), 0.12)
    # El color base casi negro evita el velo difuso; el tinte va en la transmitancia (por cada pared atravesada).
    # La vista atraviesa cuatro superficies (dos paredes con cara exterior e interior): el tinte se eleva a la cuarta.
    vidrio = material("M_Vidrio_Boro", (0.02, 0.02, 0.02), 0.02, vidrio=True, opacidad_centro=0.01,
                      especular=0.5, transmitancia=(0.975, 0.99, 0.985))
    ambar = material("M_Vidrio_Ambar", (0.03, 0.012, 0.002), 0.03, vidrio=True, opacidad_centro=0.02,
                     especular=0.5, transmitancia=(0.88, 0.64, 0.30))
    tapa = material("M_Tapa_PP_Azul", (0.02, 0.10, 0.45), 0.45)
    # Disoluciones incoloras: casi sin tinte, superficie lisa. Mezcla con AgCl: blanco lechoso opaco
    # (es lo que da el modelo químico; no se añade brillo ni color inventado).
    agua = material("M_Liquido_Incoloro", (0.02, 0.02, 0.02), 0.0, vidrio=True, opacidad_centro=0.03,
                    especular=0.3, transmitancia=(0.93, 0.96, 0.97))
    lechoso = material("M_Liquido_Precipitado", (0.82, 0.82, 0.80), 0.35, parametro_color=True)
    marcas = material("M_Graduacion", (0.85, 0.85, 0.83), 0.7)
    marcas.set_editor_property("two_sided", True)
    eal.save_loaded_asset(marcas, only_if_is_dirty=False)

    if eal.does_asset_exist(MAPA):
        niveles.load_level(MAPA)
        for actor in actores.get_all_level_actors():
            actores.destroy_actor(actor)
    elif not niveles.new_level(MAPA):
        raise RuntimeError("new_level devolvió False para " + MAPA)

    def actor(clase, nombre, posicion, rotacion=None):
        a = actores.spawn_actor_from_class(clase, unreal.Vector(*posicion), rotacion or rot())
        if a is None:
            raise RuntimeError("No se pudo crear " + nombre)
        a.set_actor_label(nombre)
        return a

    def malla(nombre, ruta, posicion, mat, escala=(1, 1, 1)):
        recurso = unreal.load_asset(ruta)
        if recurso is None:
            raise RuntimeError("No existe la malla " + ruta)
        a = actor(unreal.StaticMeshActor, nombre, posicion)
        a.set_actor_scale3d(unreal.Vector(*escala))
        a.static_mesh_component.set_static_mesh(recurso)
        for i, ranura in enumerate(recurso.static_materials):
            es_marca = "Graduacion" in str(ranura.material_slot_name)
            a.static_mesh_component.set_material(i, marcas if es_marca else mat)
        return a

    recipientes = {}

    def pieza(nombre, malla_nombre, y, mat, x=-168.0, z=90.0, visible=None, agarre=8.0, sobre=None,
              rol=None, reactivo="", ml=0.0, capacidad=0.0):
        """Recipiente que el jugador puede recoger (ARecipienteActor). `sobre` = recipiente al que va unido."""
        recurso = unreal.load_asset(IMPORTADO % (malla_nombre, malla_nombre, malla_nombre))
        if recurso is None:
            raise RuntimeError("No existe la malla " + malla_nombre)
        a = actor(unreal.RecipienteActor, nombre, (x, y, z))
        a.static_mesh_component.set_static_mesh(recurso)
        for i, ranura in enumerate(recurso.static_materials):
            es_marca = "Graduacion" in str(ranura.material_slot_name)
            a.static_mesh_component.set_material(i, marcas if es_marca else mat)
        a.set_editor_property("nombre_visible", visible or nombre)
        a.set_editor_property("altura_agarre_cm", agarre)
        if rol:
            a.set_editor_property("rol", rol)
            a.set_editor_property("reactivo_id", reactivo)
            a.set_editor_property("volumen_ml", ml)
            a.set_editor_property("capacidad_ml", capacidad)
        if sobre:
            unir_actor(a, recipientes[sobre])
        recipientes[nombre] = a
        return a

    def unir_actor(hijo, padre):
        regla = unreal.AttachmentRule.KEEP_WORLD
        hijo.attach_to_actor(padre, "", regla, regla, regla, False)

    # Decorado: suelo, pared del fondo (x = -200), techo y encimera de 2 x 0,6 x 0,9 m.
    malla("Suelo", CUBO, (0, 0, -5), blanco, (6, 6, 0.1))
    malla("Pared_Fondo", CUBO, (-205, 0, 150), blanco, (0.1, 6, 3))
    # Tres paredes más para cerrar la sala: sin ellas el personaje se saldría del suelo.
    malla("Pared_Entrada", CUBO, (305, 0, 150), blanco, (0.1, 6.2, 3))
    malla("Pared_Derecha", CUBO, (50, -305, 150), blanco, (5.2, 0.1, 3))
    malla("Pared_Izquierda", CUBO, (50, 305, 150), blanco, (5.2, 0.1, 3))
    malla("Techo", CUBO, (0, 0, 305), blanco, (6, 6, 0.1))
    malla("Encimera", CUBO, (-170, 0, 45), encimera, (0.6, 2.0, 0.9))

    ROL = unreal.RolRecipiente
    # Material de la práctica «Prueba de cloruros»: matraz vacío, probeta y los dos reactivos, tapados.
    pieza("Matraz_500", "SM_Erlenmeyer_500", -24.0, vidrio, visible="Matraz Erlenmeyer de 500 mL", agarre=14.0, rol=ROL.MATRAZ)
    pieza("Probeta_100", "SM_GradCylinder_100", -6.0, vidrio, visible="Probeta de 100 mL", agarre=14.0,
          rol=ROL.PROBETA, capacidad=100.0)
    pieza("Frasco_Ambar", "SM_ReagentBottle_500", 11.0, ambar, visible="Nitrato de plata 0,1 mol/L", agarre=10.0,
          rol=ROL.FRASCO, reactivo="agno3", ml=400.0, capacidad=500.0)
    pieza("Tapa_Ambar", "SM_Cap_GL45", 11.0, tapa, z=90.0 + 15.5, visible="Tapa", agarre=1.0, sobre="Frasco_Ambar")
    pieza("Frasco_Sal", "SM_ReagentBottle_500", 30.0, vidrio, visible="Cloruro de sodio 1,0 mol/L", agarre=10.0,
          rol=ROL.FRASCO, reactivo="nacl", ml=400.0, capacidad=500.0)
    pieza("Tapa_Sal", "SM_Cap_GL45", 30.0, tapa, z=90.0 + 15.5, visible="Tapa", agarre=1.0, sobre="Frasco_Sal")
    # Azulejo blanco bajo el matraz del indicador, como en una valoración real.
    malla("Azulejo_Blanco", CUBO, (-168.0, -60.0, 90.25), blanco, (0.15, 0.15, 0.005))
    pieza("Matraz_Indicador", "SM_Erlenmeyer_500", -60.0, vidrio, z=90.5, visible="Matraz Erlenmeyer de 500 mL", agarre=14.0,
          rol=ROL.MATRAZ)

    # Líquidos de nivel variable: ALiquidoActor (C++) genera la malla a partir del perfil interior
    # del recipiente y de un volumen en mL. La probeta lleva una DEMOSTRACIÓN que sube y baja el
    # nivel entre 5 y 100 mL; en el juego el volumen lo fijará el modelo químico.
    import json
    import os
    ruta_perfiles = os.path.normpath(os.path.join(
        unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()), "..", "..", "art", "export",
        "perfiles_interiores.json"))
    with open(ruta_perfiles, encoding="utf-8") as archivo:
        perfiles = json.load(archivo)
    lechoso.set_editor_property("two_sided", True)
    eal.save_loaded_asset(lechoso, only_if_is_dirty=False)

    def liquido(nombre, recipiente, y, ml, mat, menisco, demo=None):
        a = actor(unreal.LiquidoActor, nombre, (-168.0, y, 90.0))
        comp = a.get_editor_property("liquido")
        comp.set_editor_property("perfil_interior_mm", [unreal.Vector2D(r, z) for r, z in perfiles[recipiente]])
        comp.set_editor_property("menisco_mm", menisco)
        comp.set_editor_property("material_liquido", mat)
        comp.set_editor_property("volumen_ml", ml)
        if demo:
            comp.set_editor_property("demo_min_ml", demo[0])
            comp.set_editor_property("demo_max_ml", demo[1])
            comp.set_editor_property("demo_ml_por_segundo", demo[2])
        comp.reconstruir()
        unreal.log("VITRINA_LIQUIDO %s: %.1f mL -> nivel %.2f mm; capacidad %.1f mL" % (
            nombre, ml, comp.altura_nivel_mm(), comp.capacidad_ml()))
        return a

    # Matraces gobernados por el modelo químico (AMezclaActor). Cada uno repite un guion de
    # DEMOSTRACIÓN; no es lógica de juego.
    suspension = material_suspension("M_Liquido_Suspension")

    def pasos(*lista):
        salida = []
        for segundo, reactivo, cantidad in lista:
            paso = unreal.PasoDemoMezcla()
            paso.set_editor_property("segundo", segundo)
            paso.set_editor_property("reactivo", reactivo)
            paso.set_editor_property("cantidad", cantidad)
            salida.append(paso)
        return salida

    def matraz_mezcla(nombre, y, guion, z=90.0):
        a = actor(unreal.MezclaActor, nombre, (-168.0, y, z))
        perfil = [unreal.Vector2D(r, z) for r, z in perfiles["SM_Erlenmeyer_500"]]
        comp = a.get_editor_property("liquido")
        comp.set_editor_property("perfil_interior_mm", perfil)
        comp.set_editor_property("menisco_mm", 0.4)
        comp.set_editor_property("material_liquido", agua)
        sedimento = a.get_editor_property("sedimento")
        sedimento.set_editor_property("perfil_interior_mm", perfil)
        sedimento.set_editor_property("menisco_mm", 0.0)
        sedimento.set_editor_property("material_liquido", lechoso)
        mezcla = a.get_editor_property("mezcla")
        mezcla.set_editor_property("liquido", comp)
        mezcla.set_editor_property("sedimento", sedimento)
        mezcla.set_editor_property("material_incoloro", agua)
        mezcla.set_editor_property("material_precipitado", lechoso)
        mezcla.set_editor_property("material_suspension", suspension)
        mezcla.set_editor_property("demo_pasos", pasos(*guion))
        # Ensayo en seco del guion para dejar constancia de lo que dice el modelo en cada paso.
        # En Python, una función que devuelve bool con un parámetro de salida da el texto, o None si falló.
        for segundo, reactivo, cantidad in guion:
            hecho = mezcla.anadir_reactivo(reactivo, cantidad) is not None
            unreal.log("VITRINA_MEZCLA %s t=%.0f +%g %s aceptado=%s: %.2f mL pH=%.2f T=%.1f C color=%s intensidad=%.2f solido=%s %.4f g" % (
                nombre, segundo, cantidad, reactivo, hecho, mezcla.volumen_ml(), mezcla.ph(), mezcla.temperatura_c(),
                mezcla.color_modelo_hex(), mezcla.intensidad_color(), mezcla.solido_principal(), mezcla.solidos_gramos()))
        mezcla.vaciar()   # el nivel se guarda vacío: la demostración empieza de cero al jugar
        return a

    # «Prueba de cloruros»: 20 mL de AgNO3 y 5 mL de NaCl.
    # El matraz del jugador empieza vacío y sin guion: lo que contenga saldrá de lo que se vierta.
    unir_actor(matraz_mezcla("Mezcla_Jugador", -24.0, ()), recipientes["Matraz_500"])
    # Neutralización con indicador universal: 20 mL de HCl 1,0 mol/L, 3 gotas de indicador y NaOH
    # 1,0 mol/L hasta el punto de equivalencia (20 mL) y un exceso.
    unir_actor(matraz_mezcla("Mezcla_Indicador", -60.0, (
        (2.0, "hcl", 20.0), (4.0, "universal", 3.0), (8.0, "naoh", 5.0), (11.0, "naoh", 5.0), (14.0, "naoh", 5.0),
        (20.0, "naoh", 5.0), (28.0, "naoh", 3.0)), z=90.5), recipientes["Matraz_Indicador"])
    # Cada líquido va unido a su recipiente para moverse con él cuando el jugador lo recoge.
    unir_actor(liquido("Liquido_Probeta", "SM_GradCylinder_100", -6.0, 0.0, agua, 0.8), recipientes["Probeta_100"])
    unir_actor(liquido("Liquido_Frasco_Sal", "SM_ReagentBottle_500", 30.0, 400.0, agua, 0.5), recipientes["Frasco_Sal"])
    unir_actor(liquido("Liquido_Frasco_Ambar", "SM_ReagentBottle_500", 11.0, 400.0, agua, 0.5), recipientes["Frasco_Ambar"])

    sol = actor(unreal.DirectionalLight, "Sol", (0, 400, 400), rot(cabeceo=-40.0, guinada=-120.0))
    luz = sol.get_component_by_class(unreal.DirectionalLightComponent)
    luz.set_mobility(unreal.ComponentMobility.MOVABLE)
    luz.set_editor_property("intensity", 6.0)
    luz.set_editor_property("atmosphere_sun_light", True)
    actor(unreal.SkyAtmosphere, "Atmosfera", (0, 0, 0))
    cielo = actor(unreal.SkyLight, "Luz_Cielo", (0, 0, 350)).get_component_by_class(unreal.SkyLightComponent)
    cielo.set_mobility(unreal.ComponentMobility.MOVABLE)
    cielo.set_editor_property("source_type", unreal.SkyLightSourceType.SLS_CAPTURED_SCENE)
    cielo.set_editor_property("intensity", 1.0)
    lampara = actor(unreal.RectLight, "Luminaria", (-140, 0, 200), rot(cabeceo=-90.0))
    rect = lampara.get_component_by_class(unreal.RectLightComponent)
    rect.set_mobility(unreal.ComponentMobility.MOVABLE)
    rect.set_editor_property("intensity_units", unreal.LightUnits.CANDELAS)
    rect.set_editor_property("intensity", 12.0)
    rect.set_editor_property("source_width", 120.0)
    rect.set_editor_property("source_height", 40.0)
    rect.set_editor_property("attenuation_radius", 500.0)

    volumen = actor(unreal.PostProcessVolume, "Exposicion", (0, 0, 150))
    volumen.set_editor_property("unbound", True)
    ajustes = volumen.get_editor_property("settings")
    ajustes.set_editor_property("override_auto_exposure_method", True)
    ajustes.set_editor_property("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL)
    ajustes.set_editor_property("override_auto_exposure_apply_physical_camera_exposure", True)
    ajustes.set_editor_property("auto_exposure_apply_physical_camera_exposure", False)
    ajustes.set_editor_property("override_auto_exposure_bias", True)
    ajustes.set_editor_property("auto_exposure_bias", -0.8)   # la pared blanca se quemaba con 0
    volumen.set_editor_property("settings", ajustes)

    # Sin cámara fija: el jugador es AExperimentaPersonaje (primera persona), que aparece en «Inicio».
    mundo_nivel = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    mundo_nivel.get_world_settings().set_editor_property("default_game_mode", unreal.ExperimentaGameMode)
    unreal.log("VITRINA_MODO %s" % mundo_nivel.get_world_settings().get_editor_property("default_game_mode").get_name())
    actor(unreal.PlayerStart, "Inicio", (100, 0, 110), rot(guinada=180.0))

    # Comprobación de colisión: un rayo desde la cámara hacia cada pieza debe dar en ella.
    mundo = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    for etiqueta, y, z in (("Matraz_500", -24.0, 95.0), ("Probeta_100", -6.0, 100.0), ("Frasco_Ambar", 11.0, 96.0),
                           ("Matraz_Indicador", -60.0, 95.0), ("Frasco_Sal", 30.0, 96.0), ("(vacío)", -15.0, 110.0)):
        x_fin = -155.0 if etiqueta == "Tapa_Suelta" else -168.0
        dado = unreal.SystemLibrary.line_trace_single(
            mundo, unreal.Vector(-88, y, z), unreal.Vector(x_fin - 10.0, y, z),
            unreal.TraceTypeQuery.TRACE_TYPE_QUERY1, False, [], unreal.DrawDebugTrace.NONE, True)
        tocado = dado.to_tuple()[9].get_actor_label() if dado and dado.to_tuple()[9] else "nada"
        unreal.log("VITRINA_RAYO %s -> %s" % (etiqueta, tocado))

    if not niveles.save_current_level():
        raise RuntimeError("save_current_level devolvió False")
    unreal.log("VITRINA_OK %d actores" % len(actores.get_all_level_actors()))


if __name__ == "__main__":
    main()
