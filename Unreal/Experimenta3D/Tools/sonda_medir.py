# -*- coding: utf-8 -*-
"""Sonda técnica (Fase 1): mide FPS y hace capturas por nivel de calidad, sin intervención.

Se ejecuta DENTRO del juego en ventana (no en el editor), como comando de consola:

    UnrealEditor.exe <Experimenta3D.uproject> /Game/Mapas/Sonda -game -windowed
        -ResX=1280 -ResY=720 -CustomConfig=Sonda -csvGpuStats -NoScreenMessages
        -ExecCmds="py <ruta absoluta>/Tools/sonda_medir.py"

Parámetros por variables de entorno (las pone el lanzador):
    SONDA_SALIDA    carpeta donde se escriben capturas y resultados (obligatoria)
    SONDA_PRESETS   lista separada por comas (por defecto, todos)
    SONDA_CALENTAR  segundos de espera tras aplicar cada nivel (por defecto 20)
    SONDA_MEDIR     segundos de medición (por defecto 22)
    SONDA_ETIQUETA  prefijo de los archivos (por defecto «sonda»)
    SONDA_ESPERA_CAPTURA  segundos de espera tras pedir la captura (por defecto 4)
    SONDA_RESOLUCION  resolución de la captura, por ejemplo 1920x1080 (por defecto 1280x720)
    SONDA_CAPTURAR  «0» para medir sin capturas (por defecto 1)

Por cada nivel: aplica los comandos, espera, mide el tiempo entre fotogramas con el reloj
del sistema (y arranca el CSV profiler del motor), hace una captura con HighResShot y pasa
al siguiente. Al terminar escribe <etiqueta>_resultados.json y cierra el juego.
"""

import json
import os
import time

import unreal

GRUPOS_SG = ["ViewDistanceQuality", "AntiAliasingQuality", "ShadowQuality", "GlobalIlluminationQuality",
             "ReflectionQuality", "PostProcessQuality", "TextureQuality", "EffectsQuality", "FoliageQuality",
             "ShadingQuality", "LandscapeQuality"]


def sg(nivel):
    return ["sg.%s %d" % (grupo, nivel) for grupo in GRUPOS_SG]


SIN_LUMEN = ["r.DynamicGlobalIlluminationMethod 0", "r.ReflectionMethod 2", "r.Shadow.Virtual.Enable 0"]
# OJO: en este equipo (DX12 con nivel SM5) estos tres comandos NO activan nada: Lumen y las sombras
# virtuales exigen SM6. El resultado guarda «lumen_permitido_por_el_motor» para no confundirse.
CON_LUMEN = ["r.DynamicGlobalIlluminationMethod 1", "r.ReflectionMethod 1", "r.Shadow.Virtual.Enable 1"]

# Antialiasing (r.AntiAliasingMethod): 1 = FXAA, 2 = TAA, 4 = TSR (valor por defecto del motor).
TSR = ["r.AntiAliasingMethod 4", "r.ScreenPercentage 100"]
TAA = ["r.AntiAliasingMethod 2", "r.ScreenPercentage 100"]
FXAA = ["r.AntiAliasingMethod 1", "r.ScreenPercentage 100"]

PRESETS = {
    # Los cuatro niveles «de fábrica»: sg.* a 0/1/2/3 y el antialiasing por defecto del motor (TSR).
    "baja": sg(0) + SIN_LUMEN + TSR,
    "media": sg(1) + SIN_LUMEN + TSR,
    "alta": sg(2) + CON_LUMEN + TSR,
    "epica": sg(3) + CON_LUMEN + TSR,
    # Variantes para saber qué cuesta cada cosa.
    "baja_taa": sg(0) + SIN_LUMEN + TAA,
    "baja_fxaa": sg(0) + SIN_LUMEN + FXAA,
    "media_taa": sg(1) + SIN_LUMEN + TAA,
    "alta_sin_lumen": sg(2) + SIN_LUMEN + TSR,
    "alta_sin_lumen_taa": sg(2) + SIN_LUMEN + TAA,
    "alta_taa": sg(2) + CON_LUMEN + TAA,
    "epica_taa": sg(3) + CON_LUMEN + TAA,
    "epica_50": sg(3) + CON_LUMEN + ["r.AntiAliasingMethod 4", "r.ScreenPercentage 50"],
}

ORDEN = ["baja", "baja_taa", "baja_fxaa", "media", "media_taa", "alta_sin_lumen", "alta_sin_lumen_taa",
         "alta", "alta_taa", "epica", "epica_taa", "epica_50"]

# Perfiles de la ruta horneada (decisión del 18 de noviembre de 2026): luz estática de Lightmass, sin Lumen,
# sin Nanite y sin sombras virtuales; reflejos con capturas + SSR. Lo que cambia entre perfiles es lo que
# cuesta en tiempo de ejecución con la luz ya horneada: resolución interna, antialiasing, SSR, SSAO y bloom.
HORNEADO = SIN_LUMEN + ["r.VSync 0", "t.MaxFPS 0"]
PRESETS.update({
    # Baja: TAA con reescalado temporal desde el 75 %, sin SSR ni SSAO.
    "horneado_baja": sg(0) + HORNEADO + ["r.AntiAliasingMethod 2", "r.TemporalAA.Upsampling 1", "r.ScreenPercentage 75",
                                         "r.SSR.Quality 0", "r.AmbientOcclusionLevels 0", "r.BloomQuality 1"],
    # Media (objetivo: >= 60 FPS a 1080p en el portátil de referencia): TAA a resolución nativa, SSR bajo.
    "horneado_media": sg(1) + HORNEADO + ["r.AntiAliasingMethod 2", "r.ScreenPercentage 100", "r.SSR.Quality 1",
                                          "r.AmbientOcclusionLevels 1"],
    # Alta: TAA a resolución nativa, SSR alto, SSAO completo. (Con TSR nativo la GPU integrada de referencia cae
    # a ~16 FPS a 1080p: TSR cuesta ~45 ms por fotograma; medido el 18 de noviembre, ver horneado_alta_tsr.)
    "horneado_alta": sg(2) + HORNEADO + ["r.AntiAliasingMethod 2", "r.ScreenPercentage 100", "r.SSR.Quality 3",
                                         "r.AmbientOcclusionLevels -1"],
    # Variantes informativas.
    "horneado_media_tsr": sg(1) + HORNEADO + ["r.AntiAliasingMethod 4", "r.ScreenPercentage 100", "r.SSR.Quality 1",
                                              "r.AmbientOcclusionLevels 1"],
    "horneado_media_tsr75": sg(1) + HORNEADO + ["r.AntiAliasingMethod 4", "r.ScreenPercentage 75", "r.SSR.Quality 1",
                                                "r.AmbientOcclusionLevels 1"],
    # Para aislar el coste del perfil Alta.
    "horneado_alta_tsr": sg(2) + HORNEADO + ["r.AntiAliasingMethod 4", "r.ScreenPercentage 100", "r.SSR.Quality 3",
                                             "r.AmbientOcclusionLevels -1"],
    "horneado_alta_ssr2": sg(2) + HORNEADO + ["r.AntiAliasingMethod 4", "r.ScreenPercentage 100", "r.SSR.Quality 2",
                                              "r.AmbientOcclusionLevels -1"],
    "horneado_alta_ao1": sg(2) + HORNEADO + ["r.AntiAliasingMethod 4", "r.ScreenPercentage 100", "r.SSR.Quality 3",
                                             "r.AmbientOcclusionLevels 1"],
    "horneado_media_sg2": sg(2) + HORNEADO + ["r.AntiAliasingMethod 2", "r.ScreenPercentage 100", "r.SSR.Quality 1",
                                              "r.AmbientOcclusionLevels 1"],
})
ORDEN += ["horneado_alta_tsr", "horneado_alta_ssr2", "horneado_alta_ao1", "horneado_media_sg2"]
ORDEN += ["horneado_baja", "horneado_media", "horneado_alta", "horneado_media_tsr", "horneado_media_tsr75"]

CVARS_ENTEROS = ["r.DynamicGlobalIlluminationMethod", "r.ReflectionMethod", "r.Shadow.Virtual.Enable",
                 "r.AntiAliasingMethod", "r.Lumen.DiffuseIndirect.Allow", "r.Lumen.Reflections.Allow",
                 "r.GenerateMeshDistanceFields", "r.Nanite", "r.RayTracing", "r.AllowStaticLighting",
                 "r.VSync", "sg.GlobalIlluminationQuality", "sg.ShadowQuality", "sg.ReflectionQuality"]
CVARS_REALES = ["r.ScreenPercentage", "sg.ResolutionQuality", "t.MaxFPS"]

SALIDA = os.environ.get("SONDA_SALIDA", "")
ETIQUETA = os.environ.get("SONDA_ETIQUETA", "sonda")
CALENTAR = float(os.environ.get("SONDA_CALENTAR", "20"))
MEDIR = float(os.environ.get("SONDA_MEDIR", "22"))
LISTA = [p.strip() for p in os.environ.get("SONDA_PRESETS", ",".join(ORDEN)).split(",") if p.strip()]
ESPERA_CAPTURA = float(os.environ.get("SONDA_ESPERA_CAPTURA", "4"))
# Resolución de HighResShot, «ANCHOxALTO». Para medir a 1080p arranca además con -ResX=1920 -ResY=1080.
RESOLUCION = os.environ.get("SONDA_RESOLUCION", "1280x720")
# «0» mide sin hacer captura (para no contar el coste de HighResShot ni esperar por él).
CAPTURAR = os.environ.get("SONDA_CAPTURAR", "1") != "0"


def registrar(texto):
    unreal.log("[SondaMedir] " + texto)


class Sonda(object):
    def __init__(self):
        self.mundo = None
        self.indice = -1
        self.fase = "inicio"
        self.t_fase = time.perf_counter()
        self.t_anterior = None
        self.fotogramas_fase = 0
        self.muestras = []
        self.resultados = []
        self.asa = unreal.register_slate_post_tick_callback(self.tic)

    # -- utilidades
    def buscar_mundo(self):
        for mundo in unreal.ObjectIterator(unreal.World):
            try:
                if unreal.GameplayStatics.get_player_controller(mundo, 0) is not None:
                    return mundo
            except Exception:
                pass
        return None

    def consola(self, comando):
        unreal.SystemLibrary.execute_console_command(self.mundo, comando)

    def cambiar(self, fase):
        self.fase = fase
        self.t_fase = time.perf_counter()
        self.fotogramas_fase = 0

    def leer_cvars(self):
        valores = {}
        for nombre in CVARS_ENTEROS:
            valores[nombre] = unreal.SystemLibrary.get_console_variable_int_value(nombre)
        for nombre in CVARS_REALES:
            valores[nombre] = unreal.SystemLibrary.get_console_variable_float_value(nombre)
        # Los cvars solo dicen lo que se PIDE. Lo que el motor permite de verdad lo decide
        # DoesPlatformSupportLumenGI (en D3D exige nivel SM6): se consulta aparte.
        try:
            ajustes = unreal.GameUserSettings.get_game_user_settings()
            valores["lumen_permitido_por_el_motor"] = bool(ajustes.is_global_illumination_allowed(self.mundo))
        except Exception as error:
            valores["lumen_permitido_por_el_motor"] = "sin dato: %r" % (error,)
        return valores

    def viewport(self):
        try:
            tam = unreal.WidgetLayoutLibrary.get_viewport_size(self.mundo)
            return [int(tam.x), int(tam.y)]
        except Exception as error:
            return "sin dato: %r" % (error,)

    # -- máquina de estados, un paso por fotograma
    def tic(self, _delta):
        try:
            self.paso()
        except Exception as error:  # nunca dejar la ventana abierta por un fallo del guion
            registrar("ERROR: %r" % (error,))
            self.terminar()

    def paso(self):
        ahora = time.perf_counter()
        transcurrido = ahora - self.t_fase
        self.fotogramas_fase += 1

        if self.fase == "inicio":
            if self.mundo is None:
                self.mundo = self.buscar_mundo()
            if self.mundo is not None and transcurrido > 2.0:
                self.siguiente()
            elif transcurrido > 120.0:
                raise RuntimeError("no se encontró el mundo del juego")

        elif self.fase == "calentar":
            if transcurrido >= CALENTAR and self.fotogramas_fase >= 10:
                nombre = LISTA[self.indice]
                self.consola("CsvProfile STARTFILE=%s_%s.csv" % (ETIQUETA, nombre))
                self.consola("CsvProfile START")
                self.muestras = []
                self.t_anterior = None
                self.cambiar("medir")

        elif self.fase == "medir":
            if self.t_anterior is not None:
                self.muestras.append(ahora - self.t_anterior)
            self.t_anterior = ahora
            if transcurrido >= MEDIR and len(self.muestras) >= 5:
                self.consola("CsvProfile STOP")
                self.guardar_medida()
                nombre = LISTA[self.indice]
                if CAPTURAR:
                    ruta = os.path.join(SALIDA, "%s_%s.png" % (ETIQUETA, nombre)).replace("\\", "/")
                    self.consola('HighResShot %s filename="%s"' % (RESOLUCION, ruta))
                    self.cambiar("capturar")
                else:
                    self.siguiente()

        elif self.fase == "capturar":
            if transcurrido >= ESPERA_CAPTURA and self.fotogramas_fase >= 8:
                self.siguiente()

        elif self.fase == "fin":
            pass

    def siguiente(self):
        self.indice += 1
        if self.indice >= len(LISTA):
            self.terminar()
            return
        nombre = LISTA[self.indice]
        for comando in PRESETS[nombre]:
            self.consola(comando)
        registrar("Nivel aplicado: " + nombre)
        self.cambiar("calentar")

    def guardar_medida(self):
        nombre = LISTA[self.indice]
        tiempos = sorted(self.muestras)
        total = sum(tiempos)
        n = len(tiempos)

        def percentil(p):
            return tiempos[min(n - 1, int(p * n))] * 1000.0

        medida = {
            "nivel": nombre,
            "comandos": PRESETS[nombre],
            "fotogramas": n,
            "segundos": round(total, 3),
            "fps_medio": round(n / total, 2),
            "ms_medio": round(total / n * 1000.0, 2),
            "ms_mediana": round(percentil(0.50), 2),
            "ms_p95": round(percentil(0.95), 2),
            "ms_p99": round(percentil(0.99), 2),
            "ms_max": round(tiempos[-1] * 1000.0, 2),
            "ms_min": round(tiempos[0] * 1000.0, 2),
            "cvars": self.leer_cvars(),
            "viewport": self.viewport(),
        }
        self.resultados.append(medida)
        registrar("MEDIDA %s: %.2f FPS medios, %.2f ms (p95 %.2f ms), %d fotogramas en %.1f s; Lumen permitido: %s"
                  % (nombre, medida["fps_medio"], medida["ms_medio"], medida["ms_p95"], n, total,
                     medida["cvars"]["lumen_permitido_por_el_motor"]))
        self.escribir()

    def escribir(self):
        if not SALIDA:
            return
        ruta = os.path.join(SALIDA, ETIQUETA + "_resultados.json")
        with open(ruta, "w", encoding="utf-8") as archivo:
            json.dump({"motor": unreal.SystemLibrary.get_engine_version(), "calentar_s": CALENTAR,
                       "medir_s": MEDIR, "resultados": self.resultados}, archivo, indent=1, ensure_ascii=False)

    def terminar(self):
        if self.fase == "fin":
            return
        self.fase = "fin"
        self.escribir()
        registrar("SONDA_MEDIR_FIN")
        unreal.unregister_slate_post_tick_callback(self.asa)
        if self.mundo is not None:
            self.consola("quit")
        else:
            unreal.SystemLibrary.quit_editor()


if not SALIDA or not os.path.isdir(SALIDA):
    registrar("ERROR: falta SONDA_SALIDA o no es una carpeta: %r" % (SALIDA,))
else:
    desconocidos = [p for p in LISTA if p not in PRESETS]
    if desconocidos:
        registrar("ERROR: niveles desconocidos: %r" % (desconocidos,))
    else:
        _sonda = Sonda()
        registrar("Sonda en marcha: %s (calentar %.0f s, medir %.0f s) -> %s" % (LISTA, CALENTAR, MEDIR, SALIDA))
