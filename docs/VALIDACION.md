# Validación local · 31 de octubre de 2026

- `npm test`: 35 pruebas correctas, en seis archivos. Casos: estequiometría, cantidades inválidas, conservación de moles, colisiones y movimiento sin retrocesos ni atravesar muebles, esquinas recortadas, tutorial, manos ocupadas, transferencia, historial, enjuague sin perder resultados, devolución con Q, mesas de apoyo, objetivos tras devolver reactivos e integridad/búsqueda/datos ausentes de los 118 elementos. Las nuevas pruebas comprueban conductividad ideal, balance de agua/sal, saturación, etapas de disolución/evaporación, cancelación, persistencia de observaciones y acceso a las mesas 02/03 sin saltarse el tutorial.
- `npm run build`: TypeScript y compilación de producción correctos. Advertencia de tamaño del módulo de Three.js documentada en arquitectura.
- `tests/browser.smoke.mjs`: pasó en Chromium con renderizado WebGL por software. Comprobó bienvenida, captura del mouse, desplazamiento y orientación reales, paneles con objetos preparados, validación de cantidades, transferencia, resultados, persistencia de observaciones y menú a 390 px sin desbordamiento horizontal. Sin excepciones de JavaScript detectadas.
- Capturas revisadas: bienvenida de escritorio, HUD con manos, resultados y bienvenida móvil, en `test-results/` (archivos de verificación ignorados por Git).
- `tests/browser.regressions.mjs`: recoge y coloca el vaso, recoge y devuelve ambos reactivos al estante mediante raycasting y teclado reales, vacía con R y recoge el vaso. Las posiciones de aproximación son datos preparados. Comprueba que abrir/cerrar el panel no cambia la posición de la cámara y registra 90 fotogramas de movimiento con orientación fija sin retroceso. Verifica búsqueda de Oxígeno sin tilde, selección de Sodio/Helio, dato ausente, filtro de gases nobles, color por electronegatividad, navegación por flechas y cierre del panel a 390 px. Sin excepciones de JavaScript detectadas.
- Capturas adicionales revisadas: `rotulos-corregidos.png`, `tabla-interactiva.png`, `tabla-movil.png`. Las placas ya no atraviesan los pedestales; el panel completo cabe en móvil y solo la tabla tiene desplazamiento horizontal interno.

Límite de esta validación: no se ha automatizado caminar el recorrido completo del tutorial y experimento sin posiciones preparadas. La prueba de movimiento detecta retroceso con orientación fija en el escenario comprobado; no garantiza un FPS determinado en el equipo del usuario. No se han medido FPS en hardware representativo ni añadido controles táctiles.

No se ejecutaron push, merge, deploy ni publicación.

## Revisión de fregaderos, manos y nuevas prácticas

- `tests/browser.practices.mjs`: pasó. Accede a las mesas 02 y 03 mediante raycasting y E; prepara una muestra de NaCl 0,010 mol/L y verifica 1264,055 µS/cm estimados; prepara agua pura y verifica bombilla apagada. Completa disolución de 20 g de sal en 100 g de agua y evaporación de 80 %, con 12,8 g de cristales nuevos.
- Registra tres ensayos, edita notas de dos ensayos diferentes y verifica su persistencia sin sobrescritura. Los cálculos permanecen plegados inicialmente. Comprueba que el cuaderno cabe a 390 px y que el selector de conductividad inicia su objetivo guiado.
- Capturas revisadas en `test-results/`: `fregadero-manos.png`, `conductividad-3d.png`, `cristalizacion-3d.png`, `cuaderno-simple.png` y `cuaderno-movil.png`. Se comprueba la conexión visual entre grifo y encimera, la cubeta hundida y las manos con dedos.
- Las pruebas general y de regresiones anteriores también pasaron después de incorporar los nuevos equipos. No se añadieron dependencias ni se publicó ningún cambio.
- Límite: las aproximaciones del jugador son posiciones preparadas. Los modelos de soluciones son aproximaciones educativas documentadas, no medidas experimentales de cinética o conductividad a concentración finita.

## Campana extractora, estantería y manos · 6 de noviembre de 2026

- `npm test` y `bun test`: 58 pruebas correctas en ocho archivos. `hood.test.ts` cubre manos compartidas con el vaso, bandeja de 8 frascos, ventana cerrada, vertido temporizado, guardado y cancelación al salir. Las de `sandbox.test.ts` comprueban masas molares, balance de elementos y carga de todas las reglas, pH de ácidos/bases fuertes, ácido acético e iones metálicos hidrolizados, ΔH de neutralización (−55,8 kJ/mol), CO₂ 1:1 del vinagre con bicarbonato, CO₂ del carbonato solo tras formar bicarbonato, H₂ con Mg y ninguna reacción del Cu con HCl, H₂O₂ solo con catalizador, calor de disolución de CaCl₂ y NH₄NO₃, AgCl, PbCl₂ parcial que se redisuelve al diluir, PbI₂, Cu(OH)₂ que se disuelve en ácido, límite de solubilidad del NaHCO₃, desplazamiento de Cu por Zn, colores de indicadores y yodo–almidón, decoloración del permanganato, rangos y desbordes.
- `npm run build`: correcto; ≈ 367 kB de JavaScript comprimido.
- Pruebas de navegador con Microsoft Edge como `CHROME_PATH`: `browser.smoke`, `browser.regressions`, `browser.practices` y la nueva `browser.hood` pasaron. La última recoge CuSO₄ y NaOH de la estantería con raycasting y teclado reales, devuelve y vuelve a recoger un frasco, lo deja en la bandeja con Q, abre la campana con E, vierte desde el panel, verifica el precipitado de Cu(OH)₂, la ventana cerrada, el guardado en el cuaderno y el panel a 390 px sin desbordamiento.
- Revisión visual en el panel del navegador: estantería, póster y gradilla de pH, campana con ventana, matraz con indicador universal rojo (HCl) que pasa a violeta con exceso de NaOH (+6,1 °C), espuma y vapor de la descomposición del H₂O₂ con KI (+19 °C), vertido animado y manos con frasco.
- Rendimiento: en el panel del navegador de la app de escritorio (GPU Intel integrada) la versión original y la nueva renderizaron igual, ≈ 2,7 FPS, por lo que esa medida refleja el entorno y no un FPS real. Sigue pendiente medir en hardware representativo.
- Límite: las posiciones de aproximación siguen preparadas. No se ejecutaron commit, push, merge, deploy ni publicación.

## Realismo e intuición · 6 de noviembre de 2026 (segunda revisión)

- `npm test`: 60 pruebas correctas (nuevas: vertido continuo con inclinación previa, unión del chorro en una sola adición y un solo registro, y parada al llenarse el matraz).
- `npm run build` y `tsc -b`: correctos.
- Pruebas de navegador con Edge: `browser.smoke`, `browser.regressions`, `browser.practices` y `browser.hood` pasaron. `browser.hood` ahora también verifica con el mouse real que el aviso indica «Mantén pulsado para verter…», que aparece el indicador de vertido y que al soltar queda una única adición de ≥ 5 mL de CuSO₄.
- Revisión visual con capturas sin interfaz (Edge sin ventana, renderizado por software) desde la entrada, la encimera bajo las ventanas, el fregadero, las balanzas, la mesa de reactivos, la estantería, la campana con aviso y durante un vertido. El panel del navegador de la app dejó de dibujar con la ventana minimizada, por lo que esta revisión se hizo fuera de él.
- Límite: no se midieron FPS en hardware representativo; existe la calidad «Media» para equipos lentos. El atrezo nuevo es decorativo.

## Aplicación de escritorio y Ultra · 6 de noviembre de 2026

- `npm test` (60 correctas), `tsc -b` y `npm run build` correctos.
- App Electron lanzada con el controlador de Playwright: agente Electron, WebGL por hardware (Intel, Direct3D 11), sin errores de consola. FPS medidos en la ventana real (1536 × 890) por calidad: Ultra 30–32, Alta 59, Media 60, tras fusionar geometría estática (antes Ultra 12–15, Alta 28–44).
- `npm run dist:win`: instalador NSIS (≈ 122 MB) y portátil (≈ 111 MB); el `app.asar` contiene solo `dist/`, `electron/`, el icono y `package.json`. El `.exe` empaquetado se abrió, entró al laboratorio y capturó el ratón sin errores. Sin firma de código.
- Se borraron los datos de prueba que estas verificaciones dejaron en el almacenamiento de la app (`%APPDATA%/experimenta-3d`).
- Pruebas de navegador (Edge): smoke, practices y hood correctas; regressions falló una vez justo al arrancar la batería y pasó en las cuatro ejecuciones siguientes. Se considera intermitente y no reproducido.
- Límite: solo se probó en este equipo. Ultra se calibró para mantener ~30 FPS en una GPU integrada; en GPU dedicadas debería ir más fluido, sin verificar.

## Procedimiento real y experimentos guiados · 6 de noviembre de 2026

- `npm test` y `bun test`: 64 pruebas correctas. Nuevas: las 16 prácticas producen sus reacciones con el motor y usan la herramienta adecuada; protección obligatoria; indicadores gota a gota y bloqueo de vertido directo de líquidos/sólidos; probeta (llenado, vertido, enjuague obligatorio); balanza y residuos; recorrido completo de «Prueba de cloruros» con `recipeSteps`.
- `browser.hood` reescrita: elige el experimento en el selector, comprueba que sin protección no se toma el frasco, se pone gafas y guantes en la estación, recoge AgNO₃ y NaCl, llena la probeta hasta la marca de 20 mL con el mouse real, la vierte, enjuaga con la piseta, mide 5 mL de NaCl, verifica AgCl, guarda en el cuaderno, desecha en residuos y ve «¡Completado!», además del selector a 390 px. Las otras tres pruebas de navegador siguen correctas.
- Capturas revisadas: tablero con pasos, lista del HUD, probeta con marcas, balanza, residuos, piseta, flechas y brillo de frascos, estación de protección y manos sin guantes.

## Vectores de referencia del motor químico · 12 de noviembre de 2026

- `npm run golden`: correcto. Genera `golden/chemistry.json` con 1 452 casos y 3 289 adiciones (2,72 MB). El exportador ejecuta todo dos veces y exige un texto idéntico, las 99 reglas con algún evento visible y un caso exacto por cada una de las 16 prácticas. Regenerarlo tras reorganizar la carga de familias dio un archivo idéntico byte a byte.
- `npm test`: 65 pruebas correctas en 10 archivos (las 64 anteriores más el candado `golden/golden.test.ts`), unos 7 s. `bun test`: 65 correctas.
- Candado comprobado en ambos sentidos: al alterar un valor guardado (`waterMl` 25 → 25,000001) la prueba falla indicando la ruta exacta; al restaurarlo vuelve a pasar.
- Comparador con tolerancia (`golden/lib/compare.ts`) comprobado con mutaciones: detecta un cambio relativo de 1e-5 en un volumen, de 1e-5 en un pH, un evento eliminado y un texto cambiado; acepta un cambio relativo de 1e-8.
- Segundo motor: con bun 1.3.14 (JavaScriptCore) 678 de 63 004 números difieren en bits de los de Node 24.20, con error relativo máximo 4,3e-12 y ninguna cadena distinta; los 1 452 casos pasan con la tolerancia.
- `npx tsc -b` y `npm run build`: correctos. `golden/` queda fuera de `tsconfig.json`, así que la compilación de la aplicación no cambia.
- Instalación verificada: Visual Studio Community 2026 18.12 completo con las cargas de C++ (`vswhere`) y Epic Games Launcher 1.3.210.
- Límites: los vectores describen el comportamiento actual del motor, no su corrección química. No se ejecutaron las pruebas de navegador, porque no se tocó `src/`. Unreal Engine 5.8 no está instalado todavía, así que no existe proyecto UE ni módulo C++, y nada se ha comprobado con MSVC. No se ejecutaron commit, push, merge, deploy ni publicación.

## Porte a C++ y proyecto de Unreal · 12 de noviembre de 2026

- `native/ExperimentaChem/build.ps1 -Clean`: compila el módulo con MSVC 14.52 (`/std:c++17 /W4 /WX /permissive- /fp:precise`, sin excepciones ni RTTI) sin avisos y ejecuta los vectores: **1 452 de 1 452 casos, 0 diferencias de tabla**, código de salida 0.
- El ejecutor no aprueba en falso: con copias alteradas de los vectores detecta un Ksp pequeño cambiado (`tables.rules[90].ksp`) y un valor de disuelto cambiado un 0,01 %, y acepta un empate permutado dentro de la tolerancia. Según el informe de integración, 16 mutaciones del motor (tope de pasadas, Ka, bisecciones, umbrales, calor específico) dan entre 2 y 956 casos fallidos cada una.
- Comparador TypeScript (`golden/lib/compare.ts`) con las mismas reglas: rechaza una lista con dos valores distintos permutados y un empate exacto en orden inverso de especies; acepta un empate roto en el último bit. `npm test` y `bun test`: 65 de 65. `npx tsc -b`: correcto.
- Revisión adversarial con entradas fuera de los vectores (29 760 secuencias aleatorias y 30 000 estados límite): el C++ coincide en bits con el TypeScript ejecutado con bun; frente a Node, 67 137 de 3 588 891 números difieren en el último bit y ninguno sale de la tolerancia.
- `Build.bat Experimenta3DEditor Win64 Development`: «Result: Succeeded» con UnrealBuildTool 5.8.4 y MSVC 14.52 (aviso de versión no preferida). Los archivos `.rsp` del módulo llevan `/fp:precise` en Editor y en Game.
- **No verificado:** la prueba Automation `Experimenta.Chem.Golden` no se ha ejecutado dentro del motor, porque Smart App Control bloquea las DLL del proyecto (error 4551, eventos 3077 de CodeIntegrity). Tampoco se ha abierto el editor con interfaz, ni compilado el destino Game completo, Shipping, clang u otras plataformas. Sin capturas ni FPS. No se cambió ningún ajuste de seguridad. No se ejecutaron commit, push, merge, deploy ni publicación.

## Prueba Automation dentro de Unreal · 12 de noviembre de 2026

- Tras desactivar el usuario Smart App Control (`VerifiedAndReputablePolicyState` = 0), `native/ExperimentaChem/build.ps1` se ejecuta también en compilación incremental, que antes Windows bloqueaba: 1 452 de 1 452, código 0.
- `UnrealEditor-Cmd.exe ... -ExecCmds="Automation RunTests Experimenta.Chem; Quit" -nullrhi` (editor de UE 5.8.4 sin interfaz, 86 s): las DLL `UnrealEditor-ExperimentaChem.dll` y `UnrealEditor-Experimenta3D.dll` cargan sin errores y el registro dice «Experimenta.Chem.Golden: 1452 de 1452 casos aprobados; comprobaciones de tablas que no coinciden: 0», «Test Completed. Result={Success}» y «TEST COMPLETE. EXIT CODE: 0». Las 22 familias aparecen completas.
- Sigue sin verificar: abrir el editor con interfaz gráfica, el destino Game completo, Shipping, clang y otras plataformas. Sin capturas ni FPS. No se ejecutaron commit, push, merge, deploy ni publicación.
