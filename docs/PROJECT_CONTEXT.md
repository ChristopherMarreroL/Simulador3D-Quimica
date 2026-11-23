# Experimenta 3D — Contexto actualizado del proyecto

Última actualización: 23 de noviembre de 2026.

Este archivo es el punto de entrada para continuar el proyecto en futuras sesiones. Resume las decisiones del usuario, el estado implementado y los pendientes. Las instrucciones operativas principales están en el `AGENTS.md` de la raíz. El encargo original íntegro se conserva en [CONTEXTO_MAESTRO.md](CONTEXTO_MAESTRO.md).

## Proyecto y repositorio

- **Producto:** Experimenta 3D.
- **Subtítulo:** Laboratorio Virtual Interactivo.
- **Raíz local original:** `C:\Users\chris\OneDrive - Universidad Iberoamericana\Tareas\6to Cuatrimestre\Quimica 1\Simulador3D`.
- **Copia de trabajo actual:** `C:\Users\enmasdiaz\Desktop\LabQuimica3D`, clonada del repositorio el 5 de noviembre de 2026 (rama `main`).
- **Repositorio indicado por el usuario:** [ChristopherMarreroL/Simulador3D-Quimica](https://github.com/ChristopherMarreroL/Simulador3D-Quimica).
- **URL Git:** `https://github.com/ChristopherMarreroL/Simulador3D-Quimica.git`.
- El usuario informó que creó el repositorio y está vacío. Ese estado remoto no se ha verificado en esta tarea de documentación.
- Registrar la URL no significa configurar un remoto, sincronizar archivos ni autorizar un push. Esta solicitud solo guarda contexto e instrucciones localmente.

El proyecto nació como una asignación de Química General I de UNIBE, República Dominicana, realizada por dos estudiantes. La intención es desarrollar un producto independiente, ampliable, publicable en GitHub y potencialmente comercializable. No debe parecer una aplicación oficial de la universidad.

## Instrucciones permanentes del usuario

- No subir cambios automáticamente.
- No hacer push, deploy, merge ni publicar sin petición explícita del usuario. Antes de subir cualquier cambio, mostrar un resumen y esperar su confirmación.
- Se pueden modificar archivos, crear archivos y ejecutar pruebas locales cuando sea necesario.
- No usar `/codex` en los nombres de ramas.
- Conservar el trabajo existente y revisar el estado del proyecto antes de modificarlo.
- Mantener la interfaz y las explicaciones principalmente en español.

## Visión y alcance

La experiencia debe sentirse como un videojuego educativo en primera persona: caminar libremente, apuntar, recoger y transportar instrumentos, preparar mezclas, observar reacciones y comprender sus resultados. La navegación debe ser fluida, sin atravesar muebles ni producir movimientos de cámara excesivos.

Los modos principales son práctica guiada, laboratorio libre y tutorial repetible. La primera visita requiere completar un tutorial basado en acciones reales; su finalización se guarda localmente. Los objetivos guiados deben verificar las interacciones, sin avanzar únicamente por pulsar «siguiente».

El primer MVP se centró en vinagre y bicarbonato. El usuario autorizó después añadir prácticas: actualmente hay **vinagre/bicarbonato, conductividad y disolución/cristalización**. El 6 de noviembre de 2026 pidió además una **campana extractora para mezclar libremente** con una estantería de reactivos (ver más abajo). Calor específico como práctica guiada sigue pendiente; no ampliar todas a la vez. Las combinaciones sin modelo deben indicarse como no disponibles, sin inventar reacciones.

## Referencias visuales y criterio de diseño

El usuario aportó **43 fotografías**, con algunas vistas repetidas. Después aclaró: **el laboratorio es una referencia, no quiere que sea exactamente igual**. Esa aclaración orienta la adaptación actual.

Rasgos observados e incorporados: mesas de esquinas recortadas sobre pedestal oscuro, encimeras de granito gris oscuro, gabinetes blancos, taburetes, soportes metálicos, ventanas amplias, luces cuadradas y detalles azules del techo. También se adaptaron una campana con frente acristalado y un lavaojos decorativo.

La distribución es propia: habitación de trabajo de 12 × 10 unidades, tres islas y pasillos diseñados para navegar. Estas dimensiones no se midieron en el laboratorio real. Los modelos son procedurales y simplificados; la dirección deseada era 3D semirrealista, limpio, moderno y optimizado para navegador (sustituida el 18 de noviembre de 2026 por escritorio Unreal fotorrealista con luz horneada; ver la sección de esa fecha). La referencia a Minecraft describe el movimiento y la interacción, no una estética cúbica.

No copiar personas, marcas, logos ni identidad institucional de las fotografías. Los originales permanecen como adjuntos y no se incluyen en los archivos públicos de la aplicación. No asumir que esos adjuntos estarán disponibles en otra computadora; el análisis persistente está en [REFERENCIAS_LABORATORIO.md](REFERENCIAS_LABORATORIO.md).

El usuario mencionó un video de **1 minuto y 23 segundos**, pero no se recibió ni examinó. Las fotos fueron suficientes para la primera adaptación. No atribuir observaciones al video.

## Estado implementado: prototipo 0.1.0

- Bienvenida con el mundo 3D de fondo y selección de modo.
- Cámara en primera persona, WASD, orientación con mouse, Shift para acelerar y Escape para liberar cursor.
- Puntero central y raycasting con alcance limitado y oclusión por muebles/paredes.
- Recogida de vaso, vinagre y bicarbonato; dos espacios de mano, mangas de bata y guantes simplificados.
- Selección de manos con 1 / 2; E para interactuar y colocar el vaso; Q para colocar o devolver el objeto de la mano seleccionada al estante, mesa de reacción o mesas de apoyo.
- Para retirar el vaso con contenido: R apuntando al vaso/mesa de reacción, o botón «Vaciar y enjuagar vaso» del panel. Devolver frascos no vacía la mezcla; enjuagar conserva el cuaderno.
- Colisiones cinemáticas con polígonos que siguen las esquinas recortadas de las islas, barrido en pasos pequeños y deslizamiento sin empuje hacia atrás. La guía nunca controla la cámara ni mueve al jugador.
- Tutorial obligatorio por acciones y objetivos guiados derivados del estado real.
- Laboratorio libre con tres estaciones funcionales y selector «Experimentos». Las prácticas nuevas también tienen guía por etapas, conservando el tutorial obligatorio.
- Estación con cantidades validadas, transferencia animada de 1,8 segundos y cancelación al limpiar, salir o reiniciar sesión.
- Efervescencia visual ligada al CO₂ calculado, resultados y explicación educativa.
- N abre un cuaderno simplificado: un ensayo seleccionado, resultado principal, materiales y anotación editable. Cálculos completos en un desplegable cerrado inicialmente. Une formatos anteriores y nuevos y muestra los 30 ensayos más recientes.
- Tabla periódica de pared con vista interactiva de 118 elementos: selección por mouse/teclado, nombres españoles, búsqueda sin tildes, filtros por familia, colores por familia/masa/electronegatividad/estado y fichas de propiedades. Datos públicos de PubChem guardados localmente; ausencias y predicciones explícitas. Ver `TABLA_PERIODICA.md`.
- Menús adaptables a pantallas pequeñas; el movimiento requiere controles de escritorio, sin controles táctiles.

Soportes, taburetes y lavaojos siguen siendo ambientales: no tienen simulaciones de montaje o emergencia. La **campana extractora ya es funcional** (mezclas libres); su flujo de aire es solo visual (el vapor sube al conducto o sale a la sala). No presentar equipos decorativos como prácticas funcionales.

## Modelo químico vigente

`NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂`.

- Vinagre educativo definido a **0,83 mol/L** de ácido acético; no inferir molaridad a partir de una etiqueta comercial.
- Cantidades admitidas por la estación: 1–150 mL de vinagre y 0,01–10 g de bicarbonato.
- Masa molar usada para NaHCO₃: 84,0066 g/mol; relación estequiométrica 1:1.
- Cálculo de moles, reactivo limitante, excesos y CO₂ teórico.
- Volumen de gas ideal a 25 °C y 1 atm. No incluye CO₂ disuelto, vapor de agua ni cinética experimental.
- La espuma es una aproximación visual, no una medición del volumen de gas. Los ensayos se reinician entre mezclas.
- Las funciones químicas son puras e independientes de React/Three.js. No reemplazar los cálculos con animaciones aleatorias.

Supuestos, unidades y fuentes en [MODELO_QUIMICO.md](MODELO_QUIMICO.md). Las explicaciones deben distinguir simulación y práctica real, con precauciones pertinentes.

## Tecnología y organización

Stack utilizado: **React, TypeScript, Vite, Three.js, React Three Fiber y Zustand**. Vitest comprueba la lógica y Playwright permite la prueba de navegador. No se utilizan Drei ni Rapier actualmente; incorporarlos solo si existe una utilidad concreta. Para modelos futuros: Blender y glTF/GLB.

| Ubicación | Responsabilidad |
| --- | --- |
| `src/chemistry/` | Cálculo químico puro, validaciones y pruebas |
| `golden/` | Vectores de referencia del motor químico, exportador (`npm run golden`) y candado de regresión |
| `Unreal/Experimenta3D/` | Proyecto de Unreal Engine 5.8 con el módulo químico en C++ (`Source/ExperimentaChem`) |
| `native/ExperimentaChem/` | Compilación del módulo fuera de Unreal y ejecutor de vectores |
| `src/experiments/` | Objetos, objetivos, tutorial y datos de tabla periódica |
| `src/experiments/surfaces.ts` | Superficies compatibles y posiciones de objetos colocados |
| `src/data/pubchem-periodic-table.json` | Instantánea pública local de propiedades de 118 elementos |
| `src/state/lab.ts` | Estado, interacciones, manos, transferencias y persistencia |
| `src/world/Player.tsx` | Entrada, cámara, movimiento, raycasting y manos |
| `src/world/layout.ts` | Posiciones/dimensiones compartidas de islas y taburetes |
| `src/world/collisions.ts` | Restricciones de movimiento |
| `src/world/Laboratory.tsx` | Composición del laboratorio y efectos de reacción |
| `src/world/Models.tsx` | Instrumentos, rótulos y tabla de pared |
| `src/world/ReferenceFurnishings.tsx` | Mobiliario inspirado en fotos y granito procedural |
| `src/ui/` | Menús, HUD, paneles y estilos |
| `tests/browser.smoke.mjs` | Prueba de interfaz con capturas locales |
| `tests/browser.regressions.mjs` | Regresiones de raycasting, devolución, enjuague, cámara, movimiento y tabla |

Persistencia: `experimenta.tutorial.v1`, `experimenta.records.v1`, `experimenta.practices.v1`, `experimenta.hood.v1` (mezclas de la campana, 30 como máximo) y `experimenta.settings.v1` (calidad y sensibilidad) en `localStorage`. No hay backend, cuentas ni sincronización. El borrado de datos del navegador elimina el progreso. Si falla el almacenamiento, se conserva el estado en memoria durante la sesión.

La arquitectura química es independiente. Las prácticas nuevas tienen un catálogo común y sesiones discriminadas en `src/state/practices.ts`; la reacción original mantiene su implementación en `lab.ts`. El cuaderno adapta ambos formatos de historial. No afirmar que todo el motor ya es un sistema genérico de experimentos.

## Ejecución y comprobaciones

Desde la raíz, con Node.js 22.12+ o 24:

```sh
npm install
npm run dev
npm test
npm run build
```

Vite usa por defecto `http://127.0.0.1:5173/`. La última sesión utilizó el puerto **5174** para la revisión local; comprobar el puerto y si el servidor está activo antes de compartir un enlace. `npm run preview` sirve la compilación de `dist/` localmente.

Con el servidor encendido, la prueba de navegador admite `CHROME_PATH` para el ejecutable de Chromium/Chrome y `BASE_URL` para la dirección del servidor. Ejecutar `node tests/browser.smoke.mjs` (y `regressions`, `practices`, `hood`). Su ruta de navegador por defecto corresponde al equipo original. En la copia actual funcionan con Microsoft Edge (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`). `bun test` también ejecuta las pruebas de lógica, además de `npm test`.

Última validación registrada (6 de noviembre de 2026): **64 pruebas de lógica correctas**, compilación correcta, las cuatro pruebas de navegador correctas y la app de escritorio (Electron y el .exe empaquetado) abriendo sin errores. Las capturas se guardan en `test-results/`, ignorado por Git. Vite mantiene una advertencia por tamaño del módulo que incluye Three.js y datos de elementos: aproximadamente 367 kB de JavaScript comprimido.

La prueba general verifica movimiento/cámara y paneles con objetos preparados. La de regresiones usa raycasting y teclas reales para recoger, colocar y devolver frascos al estante, vaciar el vaso y recogerlo; también registra movimiento sin retrocesos y comprueba la conservación de posición al abrir/cerrar la estación. **Las aproximaciones a cada objeto se preparan: todavía no cubre caminar todo el tutorial y la mezcla de principio a fin.** No se han medido FPS en hardware representativo. Ver [VALIDACION.md](VALIDACION.md). Estos resultados son históricos; no sustituyen comprobar cambios posteriores.

## Próximas prioridades

1. Verificar un recorrido completo del tutorial y la práctica utilizando raycasting, recogida, transporte y colocación reales en el navegador.
2. Medir FPS en hardware representativo: el panel del navegador de la app de escritorio usado en la última sesión (GPU Intel integrada) renderizaba ~3 FPS tanto la versión original como la nueva, así que no sirvió para medir. Valorar una opción de calidad (sombras, entorno, dpr).
3. Ampliar la campana con modelos verificables: iones complejos ([Cu(NH₃)₄]²⁺, I₃⁻), cinética cualitativa más fiel, ΔH°f faltantes (CuCO₃, CuI, I₂(ac)) y pruebas de recorrido completo.
4. Refinar agarre (posición del frasco en la mano), modelos e iluminación, manteniendo pasillos y colisiones coherentes con el mobiliario.
5. Incorporar configuración de sensibilidad/calidad y mejorar accesibilidad de los controles.
6. Profundizar la manipulación de equipos y reactivos de las nuevas estaciones. El catálogo/sesiones comunes para conductividad y cristalización ya existen; calor específico sigue pendiente y requerirá su modelo verificable.
7. Ampliar el cuaderno con comparación y exportación de ensayos. Las fichas básicas de elementos ya están implementadas; orbitales/isótopos y simulación térmica de estados quedan fuera del alcance actual.

## Correcciones solicitadas tras probar el prototipo

El usuario reportó que Q no devolvía frascos a Reactivos y material, que no se entendía cómo retirar el vaso después de la reacción, que los rótulos de las tres islas estaban cortados por el pedestal y que el movimiento daba tirones. Se registraron superficies para Q, se separó devolución de frascos y enjuague del vaso, se adelantaron las placas de los rótulos y se revisaron las colisiones, incrementos de mouse y coste del renderizado. Canvas/cámara son estables y las sombras estáticas se actualizan al cambiar objetos, no en cada fotograma. Mantener estas regresiones comprobadas al cambiar la escena.

También pidió convertir la tabla en una herramienta interactiva tomando [Ptable](https://ptable.com/?lang=es#Propiedades) como referencia. Se implementó una interfaz propia con datos de PubChem y fuentes visibles; no se incrusta Ptable ni se usa su código.

## Segunda revisión solicitada por el usuario

Se retiró el texto «Datos de PubChem, guardados localmente…» del panel de tabla; la documentación mantiene fuentes y límites. Se corrigieron ambos fregaderos con cubeta hueca, desagüe y grifo unido a la encimera. Las manos ahora tienen palma, dedos, pulgar y una conexión alineada con la manga.

El usuario pidió continuar con más experimentos y simplificar N. Se añadieron las mesas 02 (conductividad) y 03 (disolución/cristalización), accesibles con E o mediante «Experimentos». El cuaderno da prioridad a las anotaciones y permite editar ensayos anteriores sin mostrar todos los cálculos de entrada.

Ver `docs/PRACTICAS_SOLUCIONES.md` para modelos y fuentes. Datos adicionales: `experimenta.practices.v1`, con hasta 30 ensayos nuevos, sin migrar ni borrar `experimenta.records.v1`. `tests/browser.practices.mjs` verifica las estaciones, resultados, notas y capturas nuevas. Estas prácticas preparan sus muestras en el equipo de la estación; todavía no añaden reactivos transportables al inventario de manos. La simulación de evaporación comprime el tiempo y evalúa el equilibrio tras enfriar a 20 °C.

## Campana extractora, estantería, manos y color (6 de noviembre de 2026)

El usuario pidió más realismo, «un estante con todas las sustancias posibles», poder experimentar y mezclar en la campana extractora y ver reacciones, manos con movimiento, más vividez y color, y más interactividad. Decisiones:

- «Todas las sustancias» se acotó a **27 reactivos** con modelo verificable (ácidos, bases, carbonatos, sales, oxidantes, metales, indicadores). Las combinaciones sin regla se muestran como «sin cambios según el modelo», con aviso de que en la realidad podrían reaccionar.
- Motor puro `src/chemistry/sandbox.ts`: reacciones completas por prioridad, desplazamiento de metales derivado de E°, Ksp en ambos sentidos, pH por balance de cargas, calor por ΔH°f. Constantes de OpenStax con huecos cubiertos por CRC/JANAF; las fuentes, aproximaciones y huecos están en [CAMPANA_MEZCLAS.md](CAMPANA_MEZCLAS.md).
- Estantería física junto a la campana (E recoger, Q devolver), bandeja de 8 frascos en la campana (Q), ventana deslizante (E en la barra), luz, extractor y agitador, matraz Erlenmeyer de 500 mL con pantalla de temperatura/pH y efectos (vertido, burbujas, espuma, precipitado, vapor, color). Ventana cerrada impide verter; extractor apagado con gases genera aviso.
- Objetivo guiado «Campana · mezclas libres» (4 pasos) en «Experimentos» y registro de mezclas en el cuaderno.
- Manos animadas (solo las manos: la cámara sigue sin oscilación): balanceo al caminar, inercia al girar, respiración, alcance al pulsar E/Q o recoger, giro de muñeca al verter y dedos que se cierran al sujetar. Guantes de nitrilo y puño de bata en color.
- Color y realismo: reflejos de entorno procedural (`RoomEnvironment`, sin descargas), suelo de baldosas, franjas de color en las paredes, póster de seguridad y de escala de pH, gradilla de tubos coloreados con la misma escala del modelo, frascos con tapas por categoría y etiquetas en un atlas de textura. La tarjeta de objetivo se movió junto al puntero para no tapar el objeto apuntado.
- `tests/browser.hood.mjs` verifica el recorrido estantería → manos → bandeja → panel → precipitado → cuaderno, con posiciones de aproximación preparadas.

## Realismo e intuición (6 de noviembre de 2026, segunda petición)

El usuario pidió más realismo («si tienes que rehacerlo, hazlo») y que sea intuitivo, y aportó 22 fotos reales en `Images/` (ignorada por Git). Ver [REFERENCIAS_LABORATORIO.md](REFERENCIAS_LABORATORIO.md). Cambios:

- **Materiales procedurales** (`src/world/materials.ts`): granito pulido tipo azul perla con barniz brillante y escala real (UV en metros), porcelanato claro brillante con juntas en relieve, pintura, techo de placas, acero cepillado, cromo, laminado blanco y vidrio de laboratorio.
- **Sala** (`RoomShell.tsx`): ventanas con aberturas reales en la pared derecha, marcos corredizos de aluminio y vista exterior procedural (patio, edificio, árboles y palmeras); luz solar que entra por ellas y luz cenital; franjas de oclusión ambiental y sombras de contacto. Se retiraron las franjas de color decorativas.
- **Mobiliario y atrezo** (`LabProps.tsx`, `Sink.tsx`): gabinetes con puertas, tiradores y zócalo; encimeras de 4 cm con salpicadero; fregaderos cuadrados con grifo de cuello de cisne y llaves en cruz; balanzas digital y de triple brazo, estufa, escurridor con cristalería, gradilla, frascos lavadores, tarros, papel, probetas, soporte universal, tomacorrientes, dispensador, extintor, frascos de almacenamiento y puerta de vidrio con carteles genéricos. Todo es decorativo: no añade prácticas.
- **Manos** articuladas con guantes de nitrilo azul: tres falanges por dedo, pulgar oponible, muñeca que se inclina y palma que gira hacia el objeto al sujetarlo.
- **Recipientes de la práctica 01** remodelados (garrafa ámbar de vinagre, tarro de bicarbonato, vaso de vidrio) con el mismo tamaño y posición para no alterar la práctica.
- **Intuitivo:** clic izquierdo es la acción principal (igual que E); con un frasco en la mano y el matraz bajo el puntero, **mantener el clic vierte de forma continua** (15 mL/s, 1 g/s o 2 gotas/s), con indicador de cantidad y reacciones que ocurren mientras cae el chorro; un anillo dorado bajo el matraz indica que se puede verter. El aviso junto al puntero muestra el objeto y cada acción con su tecla; la barra inferior solo muestra los controles útiles en ese momento.
- **Ajustes** en la tarjeta de pausa: calidad gráfica Alta/Media (resolución y sombra del sol) y sensibilidad del mouse, guardadas en `experimenta.settings.v1`.

## Aplicación de escritorio y gráficos Ultra (6 de noviembre de 2026)

El usuario preguntó si se podía convertir en aplicación de escritorio y aumentar los gráficos. Decisiones:

- **Electron** (no Tauri: no hay Rust instalado y Electron fija un Chromium con WebGL 2). `electron/main.cjs` abre la compilación de Vite (`vite build --base ./`) en una ventana segura (aislamiento de contexto, sin Node en la página), maximizada, sin menú, F11 para pantalla completa, enlaces externos en el navegador del sistema y preferencia por la GPU de alto rendimiento. `npm run dist:win` genera con electron-builder un instalador NSIS y una versión portátil en `release/` (ignorada por Git), sin firma de código. El paquete solo contiene `dist/`, `electron/` y el icono (`build/icon.png`, propio).
- `AGENTS.md` sigue diciendo «optimizado para navegador»: la web se mantiene y la app de escritorio es un envoltorio del mismo código.
- **Calidad Ultra** (por defecto en la app): `PostEffects.tsx` con `EffectComposer` de three.js (sin dependencias nuevas): GTAO a media resolución, bloom solo en lámparas (valor HDR 3), renderizado HDR con 4× MSAA y exposición 0,93; vidrio principal con transmisión a media resolución; sombras de 4096/2048 px; resolución hasta 1,5×. Alta y Media no usan posprocesado.
- **Rendimiento:** `StaticBatch.tsx` fusiona el atrezo y las partes estáticas no interactivas en una malla por aspecto, ocultando las originales en una capa que no se dibuja ni recibe rayos. En este equipo (GPU Intel integrada, ventana de 1536 × 890) dentro de la app: Media 60 FPS, Alta 59–60 FPS (antes 28–44), Ultra 30–32 FPS (antes 12–15). Con calidad automática, la app pasa de Ultra a Alta (y de Alta a Media) si mide menos de 28 FPS durante ~4 s.
- Ajustes en `experimenta.settings.v1`: calidad, automático, sensibilidad y «Mostrar FPS».

## Procedimiento real y experimentos guiados (6 de noviembre de 2026)

El usuario aclaró que «más realista» significaba **que se haga como en la vida real**, no más efectos gráficos, y pidió un instructivo junto a la campana con muchas ecuaciones donde, al elegir una, aparezcan flechas sobre cada cosa necesaria. Implementado (detalle en [CAMPANA_MEZCLAS.md](CAMPANA_MEZCLAS.md)):

- Estación de protección junto a la puerta; gafas y guantes obligatorios para la estantería de reactivos (`lab.ppe`). Manos sin guantes hasta ponérselos.
- Probeta de 100 mL, balanza con navecilla, piseta para enjuagar, gotero para indicadores y recipiente de residuos dentro de la campana (`HoodTools.tsx`). Ya no se vierten líquidos ni sólidos directamente en el matraz, ni desde el panel; el panel explica el procedimiento y muestra el estado de las herramientas.
- 16 experimentos guiados validados por el motor químico (`hoodRecipes.ts`), tablero en la pared junto a la campana, lista de pasos en el HUD, flechas doradas y brillo en los frascos (`GuideProps.tsx`). Progreso persistente aunque se deseche la mezcla.
- Las prácticas 01–03 no exigen protección todavía (sus pruebas y el tutorial siguen igual); queda como mejora.

## Plan para rehacerlo con gráficos ultrarrealistas (11 de noviembre de 2026)

El usuario pidió un markdown y un prompt para **rehacer todo** con un nivel visual fotorrealista, tomando como referencia cinco imágenes (dos juegos en primera persona fotorrealistas, una tienda de alquimia y un laboratorio virtual guiado). Están guardadas, sin subir, en `Images/estilo/` (ignorada por Git). Documentos:

- [REHACER_ULTRA_REALISTA.md](REHACER_ULTRA_REALISTA.md): especificación. Recomienda Unreal Engine 5 para escritorio y propone un Plan B web (Three.js/WebGPU con iluminación horneada). Conserva el motor químico, portándolo a C++ con vectores de referencia exportados desde la web. Incluye dirección de arte, manos, interacción, efectos ligados al modelo, guía, fases con criterios de aceptación y riesgos.
- [PROMPT_REHACER_ULTRA.md](PROMPT_REHACER_ULTRA.md): prompt maestro y versión corta.

Las referencias se usan solo como nivel de calidad: no se copia ningún juego ni la identidad de la universidad. Riesgo principal: el equipo actual tiene una GPU Intel integrada, insuficiente para desarrollar con Lumen.

## Decisión de motor y arranque de la Fase 0 (11 de noviembre de 2026)

**Decisión del usuario:** tras el aviso de hardware, pidió instalar Visual Studio y Unreal Engine en este equipo. Se sigue, por tanto, la **ruta Unreal Engine 5** aquí, sin GPU dedicada. El Plan B web queda como alternativa no elegida.

**Equipo comprobado:** Lenovo 83DU, Intel Core 7 150U (10 núcleos, 12 hilos), GPU integrada «Intel(R) Graphics», 15,7 GB de RAM, 515 GB libres en C:. Consecuencia asumida: el editor irá lento, Lumen y Nanite no son utilizables para trabajar y no se pueden medir los 60 FPS en Épica. Sí se puede compilar el módulo químico en C++, ejecutar pruebas Automation y trabajar en calidad Baja con luz horneada.

**Estado de la instalación:**

- Versión objetivo: Unreal Engine 5.8 (último hotfix encontrado: 5.8.4) con Visual Studio Community 2026 y las cargas «Desarrollo para el escritorio con C++», «Desarrollo de juegos con C++» y «Desarrollo de escritorio de .NET». Los requisitos exactos de MSVC y del SDK de Windows no se pudieron leer en la documentación oficial (ver el punto siguiente); confirmarlos al instalar el motor.
- **Bloqueo de red:** la red usada el 11 de noviembre intercepta con un cortafuegos FortiGate las conexiones a `epicgames-download1.akamaized.net`, `dev.epicgames.com` y `unrealengine.com` (certificado sustituido, error `0x80072f0d` en winget y `ERR_CERT_AUTHORITY_INVALID` en el navegador). Los servidores de Microsoft no están afectados. No se debe desactivar la comprobación de certificados ni instalar la autoridad del cortafuegos: Epic Games Launcher y Unreal Engine hay que descargarlos desde otra red.
- El inicio de sesión en Epic y la aceptación de sus licencias los hace el usuario.
- **Instalado y verificado (11 de noviembre):** Visual Studio Community 2026 18.12 en `C:\Program Files\Microsoft Visual Studio\18\Community`, completo, con las tres cargas y el compilador MSVC x64 (comprobado con `vswhere`). Epic Games Launcher 1.3.210 en `C:\Program Files\Epic Games\Launcher`, instalado con winget tras cambiar a una red que no intercepta a Epic.
- **Pendiente:** Unreal Engine 5.8 desde la Biblioteca del launcher (lo instala el usuario con su cuenta). Al terminar, comprobar `C:\ProgramData\Epic\UnrealEngineLauncher\LauncherInstalled.dat` y la carpeta `C:\Program Files\Epic Games\UE_5.8`.
- **Bloqueo de Epic (12 de noviembre):** con el launcher 20.3.8 y la cuenta nueva, «Instalar motor» y el «+» no hacen nada y la lista de versiones queda vacía. El log (`%LOCALAPPDATA%\EpicGamesLauncher\Saved\Logs\EpicGamesLauncher.log`) muestra `EoshState = WaitingForBuildsAndItemFiles`, `Loaded 0 item files` y `found 0 entitled apps`. Es un fallo abierto de Epic (UE-413749, «Needs Triage»), no del equipo ni de la red. Reiniciar el launcher y alternar «Ocultar biblioteca de juegos» no lo resolvió. Soluciones que otros usuarios dan por buenas y que dependen de la cuenta del usuario: añadir un juego gratuito de la Tienda, o instalar un recurso gratuito de Fab y aceptar su licencia, y reiniciar el launcher. El porte del motor químico a C++ estándar no depende de esto.

**Hallazgos del análisis previo (9 agentes, solo lectura; `npm test` 64 de 64):**

- El motor de mezclas tiene 65 especies, 27 reactivos y 99 reglas (73 completas y 26 de solubilidad); el orden de las reglas es su prioridad.
- El bucle de reacción se corta a 120 pasadas **sin converger** en torno al 7 % de las adiciones con líquido (dos equilibrios que comparten un ion). El resultado depende de la trayectoria. El porte a C++ debe replicar el bucle tal cual; un solucionador «mejor» rompe la paridad.
- El matraz puede superar los 500 mL por el agua que produce una neutralización (503,6 mL con HCl 200 + agua 100 + NaOH 200) y a partir de ahí rechaza cualquier adición.
- Hay dos masas molares para el NaHCO₃: 84,0066 en `reaction.ts` y 84,006 en `formula.ts` (diferencia relativa 7e-6, mayor que la tolerancia de paridad 1e-6).
- Los textos con números usan `toLocaleString('es')`; dependen del ICU de Node y hay que reproducir su formato en C++.
- Las 22 fotos de `Images/` no muestran la campana, la estación de protección, la estantería abierta ni los residuos, y ninguna tiene referencia de escala. Hacen falta fotos nuevas antes del corte vertical.
- La especificación pide funciones que la web no tiene (son requisitos nuevos, no portes): residuos por tipo, tapas, caudal según inclinación, inspección del menisco, balanza por pasos, gota a gota, bata, probetas de 10 y 50 mL, derrames y pruebas de pasos para las 16 prácticas.
- `AGENTS.md` sigue pidiendo «estilo 3D semirrealista optimizado para navegador», lo que contradice el rehacer fotorrealista de escritorio. Solo el usuario puede cambiar esa línea.

## Vectores de referencia del motor químico (12 de noviembre de 2026)

El usuario autorizó empezar el exportador. Primer entregable de la Fase 0, hecho y verificado:

- `npm run golden` genera `golden/chemistry.json`: **1 452 casos, 3 289 adiciones, 2,72 MB**, sin dependencias nuevas. Las 99 reglas dan algún evento visible y las 16 prácticas tienen su caso exacto. Detalle, formato y regla de comparación en [golden/README.md](../golden/README.md).
- Las familias (`golden/families/`) solo describen entradas; las salidas las captura el arnés ejecutando el motor real. Se congeló el comportamiento actual tal cual, porque la especificación pide conservar los resultados.
- `golden/golden.test.ts` es un candado dentro de `npm test` (ahora **65 pruebas en 10 archivos**, unos 7 s): exige coincidencia exacta con el mismo motor de JavaScript y la regla de tolerancia con otro. Se comprobó que falla al alterar un valor guardado.
- **Indicio de portabilidad:** con bun (JavaScriptCore) cambian los últimos bits de 678 de 63 004 números, con un error relativo máximo de 4,3e-12, y los 1 452 casos pasan con la tolerancia 1e-6. No garantiza nada para MSVC.

Rarezas del motor encontradas al escribir los casos (están en los vectores; el porte debe replicarlas mientras no se corrijan en TypeScript):

- La falta de convergencia de `react()` tiene efectos visibles: AgCl con exceso de yoduro no pasa a AgI; añadir solo agua puede descomponer todo el peróxido; una gota inerte reanuda una reacción.
- Las reglas van por orden de lista y solo ven H⁺ y OH⁻ explícitos, no el pH: FeCl₃ a pH 2 no ataca al mármol, y Cu(OH)₂ precipita antes que Fe(OH)₃.
- La temperatura no tiene límite inferior: 1 g de NH₄NO₃ en tres gotas de indicador da −135,9 °C.
- `addReagent` acepta como reactivo las claves heredadas de `Object` (`'constructor'`, `'toString'`) y las trata como agua. La interfaz nunca las envía; quedan fuera de los vectores.
- La pantalla de la campana formatea el pH con `toFixed(2)` y el HCl 1,0 mol/L da −4,4e-15: podría mostrarse «−0,00». No verificado en la aplicación.

**Pendiente de decisión del usuario:** si se corrige alguna de estas rarezas en la versión web (habría que regenerar los vectores) o se portan tal cual; si se acepta la regla de comparación propuesta (relativa 1e-6 con suelo absoluto, pH absoluto, color ±1); y si se autoriza un commit local de línea base (el motor químico de la campana y `golden/` siguen sin commit).

## Porte a C++ y proyecto de Unreal (12 de noviembre de 2026)

Unreal Engine 5.8.4 quedó instalado en `C:\Program Files\Epic Games\UE_5.8` (el bloqueo del launcher se resolvió del lado del usuario). Hecho y verificado:

- **Módulo `ExperimentaChem`** en `Unreal/Experimenta3D/Source/ExperimentaChem`: C++ estándar sin tipos de Unreal, sin excepciones ni RTTI. `Public/ExperimentaChem/Chem.h` es la interfaz; las tablas (65 especies, 27 reactivos, 99 reglas) se generan con `node golden/gen-cpp-tables.mjs` y no se editan a mano.
- **Paridad:** compilado fuera de Unreal (`native/ExperimentaChem/build.ps1 -Clean`, MSVC 14.52, `/W4 /WX /fp:precise`) pasa **1 452 de 1 452 casos y 0 diferencias de tabla**. La Fase 0 pedía al menos el 95 %.
- **Revisión adversarial fuera de los vectores:** frente al TypeScript ejecutado con bun (misma biblioteca matemática que MSVC), 0 diferencias en 456 276 resultados; frente a Node, el 1,9 % de los números difiere en el último bit y ninguno sale de la tolerancia (peor caso: un pH a 3,5e-8).
- **Proyecto `Unreal/Experimenta3D`** (a partir de la plantilla TP_Blank, sin contenido binario): módulo de juego `Experimenta3D` y `ExperimentaChem`. Compila con UnrealBuildTool: `Build.bat Experimenta3DEditor Win64 Development -project=...`. UBT acepta MSVC 14.52 con un aviso de «versión no preferida» (prefiere 14.50 y 14.44).
- **Coma flotante:** Unreal compila los destinos Game con `/fp:fast`. `ExperimentaChem.Build.cs` fija `FPSemantics = FPSemanticsMode.Precise` y los cuatro archivos numéricos llevan además `#pragma float_control(precise)`. No quitar ninguna de las dos cosas.
- El comparador se endureció en TypeScript y en C++: tablas exactas y listas ordenadas que admiten empates dentro de la tolerancia (ver `golden/README.md`).

**Prueba dentro del motor: hecha.** El usuario desactivó el Control inteligente de aplicaciones de Windows (Smart App Control), que bloqueaba las DLL sin firma compiladas aquí (error 4551). Desde entonces el editor carga los módulos del proyecto y la prueba Automation `Experimenta.Chem.Golden` pasa: **1 452 de 1 452 casos, 0 diferencias de tabla**, «Result={Success}», código de salida 0. Se lanza sin interfaz:

```powershell
& "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "<ruta>\Unreal\Experimenta3D\Experimenta3D.uproject" '-ExecCmds="Automation RunTests Experimenta.Chem; Quit"' -unattended -nopause -nosplash -nullrhi -nosound -stdout -FullStdOutLogOutput -log
```

En esta compilación de Windows (25H2, 26200.9974) Smart App Control se puede volver a activar desde Seguridad de Windows sin reinstalar; si se reactiva, las DLL del proyecto dejarán de cargar otra vez. Ningún agente cambió ajustes de seguridad.

Pendiente menor: `JsNumber` de `Sandbox.cpp` no iguala `String(número)` de JavaScript para enteros de 1e15 o más (inalcanzable con el matraz de 500 mL); `RunGolden` y el lector JSON viajan dentro del módulo también en un futuro Shipping.

**Criterios de la Fase 0 cumplidos:** `golden/chemistry.json` generado y módulo C++ compilado y al 100 % de los casos (se pedía el 95 %), también como prueba Automation. **Siguiente paso:** guía de estilo, `docs/ASSETS.md` con la lista de objetos y licencias, fotos de la campana que faltan y el corte vertical de la Fase 1. Las capturas y los FPS con Lumen siguen sin poder medirse en este equipo.

## Vectores de la capa de estado de la campana (12 de noviembre de 2026, Fase 1)

Primer entregable de la Fase 1, para portar la capa de estado de la campana a C++ con la misma garantía que el motor químico:

- `npm run golden` genera ahora también `golden/steps.json` (`npm run golden:steps` lo genera solo): **197 casos, 5 208 operaciones, 2,27 MB**. `golden/chemistry.json` sigue idéntico byte a byte (comprobado con `cmp` antes y después).
- Cada caso es una secuencia de operaciones (`{ op, args, avanzaMs }`, 25 operaciones) ejecutada contra los almacenes reales `useHood` y `useLab` con un reloj controlado; tras cada una se captura el estado observable y el resultado de `recipeSteps()`. Las 16 prácticas tienen su recorrido completo, cuatro variantes con errores y los bordes del 90 %; la «Prueba de cloruros» tiene 32 casos propios. Vocabulario, formato, alcance y regla de comparación en la segunda mitad de [golden/README.md](../golden/README.md).
- `golden/steps.test.ts` es el candado dentro de `npm test` (ahora **66 pruebas en 11 archivos**) y pasa también con `bun test`. Se comprobó que falla al alterar un valor guardado. No se modificó `src/`.
- Rarezas de las reglas de juego que quedan congeladas (lista completa en el README): la guía da un paso por hecho con el 90 % y sin tope superior; desechar antes de observar atasca la práctica hasta volver a elegirla; la ventana cerrada no impide añadir lo pesado, enjuagar ni desechar; dejar el frasco no corta su chorro; el mensaje «Viertes N mL» redondea a enteros una lectura que al matraz llega redondeada a 0,1 mL.

**Pendiente de decisión del usuario:** si alguna de esas rarezas se corrige en la web antes del porte (habría que regenerar) y qué claves del estado puede omitir la versión Unreal al comparar (`burst`, `locations`, `panel`, `activePractice`). El porte a C++ de esta capa no está hecho.

## Producción visual con Higgsfield (12 de noviembre de 2026, propuesta)

El usuario pidió producir los recursos visuales con Higgsfield, usando primero cualquier acceso gratuito. Comprobado en su cuenta: plan Standby, 8,6 créditos, prueba gratuita vencida y sin generaciones ilimitadas; no hay «día gratis» verificado. Higgsfield sí exporta mallas GLB reales (19–38 créditos por modelo texturizado), pero el saldo solo alcanza para imágenes de concepto. No se generó, compró ni subió nada. La ruta propuesta (imagen → 3D para objetos opacos, modelado paramétrico para vidrio y mobiliario, materiales aparte), los costes, las licencias y las seis imágenes de concepto por aprobar están en [PIPELINE_VISUAL_HIGGSFIELD.md](PIPELINE_VISUAL_HIGGSFIELD.md). Después el usuario autorizó 6 créditos: se generaron tres imágenes de concepto (vertido, reacción de AgCl e interfaz, en `Images/conceptos/`) y **aprobó la dirección visual**; otras tres se cobraron en una petición que caducó y no se han localizado. Quedan 2,6 créditos. Pendiente del usuario: presupuesto de créditos para los modelos 3D, subir o no las fotos como referencia, instalar Blender y decidir dónde validar Lumen (este equipo cae a SM5).

## Proyecto en pausa (12 de noviembre de 2026, 16:50)

El usuario pidió pausar el proyecto durante el primer incremento de la Fase 1. Se detuvo el workflow en curso y no quedó ningún proceso de Unreal ni de compilación en marcha. Estado verificado al pausar: `npm test` 66 de 66 en 11 archivos, `npx tsc -b` correcto, `golden/chemistry.json` con sus 1 452 casos y el módulo C++ sin cambios desde la prueba Automation.

Qué quedó de ese incremento:

| Pieza | Estado | Dónde |
| --- | --- | --- |
| Arquitectura del corte vertical | Terminada (diseño, sin implementar) | [ARQUITECTURA_FASE1.md](ARQUITECTURA_FASE1.md) |
| Medidas de catálogo y recursos CC0 candidatos | Terminado; 17 de 18 objetos con fuente abierta; nada descargado | [ASSETS.md](ASSETS.md) |
| Vectores de la capa de estado de la campana | Terminados: 197 casos y 5 208 acciones en `golden/steps.json`, con candado en `npm test` | `golden/steps/`, sección nueva de `golden/README.md` |
| Sonda de render | **Interrumpida, sin informe.** Dejó un nivel de prueba creado por guion, una variante con luz horneada, tres materiales y dos guiones de Python. Faltan las capturas y los FPS medidos | `Unreal/Experimenta3D/Content/Mapas/`, `Content/Sonda/`, `Unreal/Experimenta3D/Tools/` |
| Porte a C++ de la lógica de la campana (`Hood.h`) | **No empezado** | — |
| Revisión adversarial de ese porte | No empezada | — |

Para reanudar: repetir la sonda de render (o terminarla a partir de los guiones de `Tools/`), portar la capa de estado a C++ contra `golden/steps.json` siguiendo el patrón de `ExperimentaChem`, y revisarlo con un probador diferencial. Después vienen la escena en bloques jugable, el arte y las capturas para aprobación del usuario.

Durante la pausa aparecieron en el repositorio archivos que no salieron de este trabajo: `docs/PIPELINE_VISUAL_HIGGSFIELD.md`, la sección «Producción visual con Higgsfield» de este documento e imágenes en `Images/conceptos/`. Proceden de otra sesión del usuario y no se han tocado.

Sigue sin commit todo lo hecho desde el 6 de noviembre. Decisiones abiertas: rarezas del motor y de la capa de estado, regla de comparación, permiso para descargar recursos, fotos de la campana y commit de línea base.

## Versión jugable en Unreal (14–15 de noviembre de 2026, otra sesión)

Después de la pausa anterior, el usuario siguió dirigiendo el trabajo en la sesión de producción visual y fue pidiendo, paso a paso, una versión jugable en Unreal. El detalle de cada paso, con lo comprobado, los intentos fallidos y los límites, está en [PIPELINE_VISUAL_HIGGSFIELD.md](PIPELINE_VISUAL_HIGGSFIELD.md). Resumen del estado:

- **Ejecutable:** `release\unreal\Windows\Abrir_Laboratorio.bat` (carpeta ignorada por Git; compilación Development, sin firmar). Abre el nivel `/Game/Mapas/Laboratorio`.
- **Laboratorio en U** generado por `Unreal/Experimenta3D/Tools/laboratorio_crear_nivel.py`: muebles bajos y altos en tres paredes, dos lavamanos, dos mesas centrales, 21 gabinetes rotulados con instrumentos, vitrina con 56 reactivos etiquetados (27 del modelo y 29 de exposición sin modelo) y campana. Mobiliario de cajas sin texturas; distribución y medidas propias.
- **Jugador:** primera persona con WASD y ratón, dos manos con gestos procedurales (estirarse para recoger o dejar, volcar para verter), puertas que se abren, punto de mira con avisos, panel de pasos y marcador del objetivo, todo en español.
- **Química en el juego:** `UMezclaComponent` envuelve `ExperimentaChem`; el líquido de nivel variable, el precipitado (nube y sedimento) y el color de disolución e indicadores salen del modelo. «Prueba de cloruros» se puede hacer entera (destapar, medir con la probeta, verter) con tres pasos guiados portados de `recipeSteps()`.
- **Pruebas Automation** (`Automation RunTests Experimenta.`, con el punto): `Chem.Golden`, `Liquido.Geometria`, `Mezcla.Cloruros` y `Practica.Cloruros`, las cuatro aprobadas.
- **Herramientas instaladas con permiso del usuario:** Blender 5.3.0. Los modelos se generan con guiones en `art/blender/` (carpeta **no** ignorada por Git) y se importan con `Tools/importar_cristaleria.py`.
- **No comprobado:** teclado y ratón reales; todo se verificó con un jugador automático (`-ExperimentaPaseo`). El aspecto fotorrealista no se puede validar en este equipo (SM5, sin Lumen); a 1280 × 720 en calidad media el laboratorio va a unos 36 FPS.
- **Divergencia a resolver:** esta versión jugable no sigue `ARQUITECTURA_FASE1.md` ni se ha contrastado con `golden/steps.json` (197 casos de la capa de estado de la campana). Los pasos guiados de Unreal son un porte directo y parcial (3 de los 7 pasos de la web) con su propia prueba. Antes de ampliar las prácticas conviene decidir si la lógica de `UPracticaGuiadaComponent` se sustituye por el porte validado contra esos vectores.
- **Añadido el 15 de noviembre (tarde):** balanza con navecilla para pesar sólidos, pipeta de 10 mL que aspira de un frasco y descarga en un vaso o matraz, piseta como fuente de agua (sin probar) y un chorro simple al verter; material en la mesa 2 (bicarbonato y vinagre). Detalle y resultados de la prueba en el documento enlazado.
- **Sigue pendiente:** protección, residuos, cuaderno, manos articuladas, texturas, sonido, y las medidas de norma de los instrumentos (son aproximadas).
- No se ha hecho ningún commit ni push. Créditos de Higgsfield: 2,6; no se compró nada.

## Vuelta a la versión web como versión jugable (15 de noviembre de 2026)

El usuario probó el ejecutable de Unreal, lo encontró lento y pesado en su equipo (GPU Intel integrada, unos 36 FPS a 1280 × 720 en calidad media) y pidió que fuese jugable desde el navegador. Unreal 5 no exporta a navegador, así que se le plantearon las opciones y **eligió volver a la versión web (React/Three.js) y llevarle lo nuevo**. Esto cambia la plataforma final fijada en el encargo de Unreal; el proyecto de `Unreal/` queda aparcado tal como está, sin borrar nada.

Lo que pidió para Unreal y la web ya tenía: bancos con encimera y fregaderos en tres paredes (la U), tres islas centrales, campana extractora, estantería con los 27 reactivos con modelo y etiqueta, balanza con navecilla, piseta, gotero y manos articuladas con alcance y giro de muñeca al verter.

Añadido en esta sesión:

- **Gabinetes altos con puertas de vidrio que se abren** (`src/world/Storage.tsx`, datos en `src/state/storage.ts`): siete sobre el banco del fondo y cuatro sobre el banco izquierdo, cada uno rotulado con una familia de instrumentos (vasos, Erlenmeyer, probetas, aforados, tubos, embudos, pipetas, termómetros, morteros y mecheros, pisetas y tarros). Sustituyen a la repisa abierta del fondo y al mueble alto decorativo de la izquierda. El material de dentro **es de exposición**: se ve, pero todavía no se puede sacar ni usar.
- **Vitrina de compuestos** en la pared del fondo, entre el banco y la tabla periódica: 29 compuestos habituales de laboratorio (ácidos concentrados, bases, disolventes, sales, oxidantes e indicadores) con etiqueta de nombre y fórmula. **No tienen modelo químico**: al apuntarlos se indica que son solo de exposición y no se pueden mezclar. Los 27 con modelo siguen en la estantería junto a la campana.
- Colisión de la vitrina en `collisions.ts`; objetivos `cabinet:<id>` y `exhibit:<n>` en `lab.ts` y en la tarjeta del puntero de `App.tsx`. En desarrollo, `window.labTest` y `window.sceneTest` permiten colocar la cámara en las comprobaciones.

Comprobado: `tsc -b` sin errores, 66 pruebas unitarias, `tests/browser.hood.mjs` con Edge (recorrido guiado de la campana completo) y, en el navegador, abrir un gabinete, abrir la vitrina y leer la tarjeta de un compuesto, sin errores en consola. La escena dibuja 563 llamadas y unos 58 500 triángulos mirando al fondo. **No se midieron los FPS** tras el cambio (el panel del navegador de esta herramienta no da una cifra fiable) ni se ejecutaron las otras tres pruebas de navegador.

**Pipeta de 10 mL (misma fecha, después).** Estado en `hood.ts` (`pipette`, `takePipette`, `putPipette`, `pourPipette`, destino de vertido `pipette`), soporte en la campana (`HoodTools.tsx`) y modelo en `Storage.tsx`. Se saca del gabinete «Pipetas · varillas» (hay que abrirlo), se lleva en una mano y se deja en su soporte de la campana; con un frasco de líquido en la mano, mantener el clic sobre ella aspira 2 mL/s hasta 10 mL, y E la descarga en el matraz redondeando a 0,1 mL. Con restos de otro reactivo exige enjuagarla (la piseta enjuaga probeta y pipeta), no admite sólidos ni indicadores y no se puede guardar con líquido. Es el único instrumento que se saca de un gabinete; el resto sigue de exposición. Las recetas guiadas no la usan (siguen pidiendo probeta, balanza o gotero).

Comprobado: 68 pruebas unitarias (dos nuevas de la pipeta), vectores de referencia (`npm run golden`) sin cambios, y en el navegador abrir el gabinete, recoger la pipeta y dejarla en el soporte. Aspirar y descargar se comprobó en las pruebas unitarias, no manteniendo el clic en el navegador.

Pendiente: poder sacar y usar el resto de instrumentos de los gabinetes, no hay pera ni propipeta, y revisar la fluidez real en el navegador del usuario.

## Decisión de plataforma: escritorio Unreal con luz horneada (18 de noviembre de 2026)

**Decisión del usuario:** la plataforma objetivo vuelve a ser una **aplicación de escritorio Windows en Unreal Engine 5.8**, con aspecto **fotorrealista** conseguido con **iluminación estática horneada** (Lightmass por CPU) en lugar de Lumen, para que funcione en **PC modestos**. El equipo de referencia es este portátil (GPU Intel integrada, SM5). **No se usa Higgsfield para nada** (ni imágenes, ni mallas, ni créditos); los recursos se modelan con guiones de Blender o materiales procedurales del motor.

Esta decisión sustituye la dirección «semirrealista optimizada para navegador» del `AGENTS.md` y deja la versión web (React/Three.js) como prototipo jugable y fuente de los vectores de referencia (`golden/`); `src/` no se modifica en este trabajo. Se conserva el resto de instrucciones.

Ruta de render fijada:

- Lightmass CPU con lightmaps de buena resolución; sin Lumen, sin Nanite, sin sombras virtuales (Virtual Shadow Maps).
- Reflection captures (esferas y cajas) + reflejos en espacio de pantalla (SSR).
- Antialiasing temporal (TSR o TAA según el perfil).
- Perfiles de escalabilidad Baja/Media/Alta.
- Objetivo: **≥ 60 FPS a 1080p en Media** en este portátil.
- Aspecto fotográfico mediante lightmaps, materiales PBR procedurales calibrados (granito pulido oscuro azul perla, laminado blanco, acero satinado, vidrio con grosor) y post-proceso de cámara física (exposición manual, balance de blancos, viñeta y grano suaves).

Primer encargo con esta ruta: porte a C++ de la capa de estado de la campana (`Hood.h/.cpp` en `ExperimentaChem`) con prueba Automation contra `golden/steps.json`; guion de Blender `art/blender/campana_estacion.py` (campana de sobremesa tipo EN 14175, módulo de encimera de granito y gabinete); nivel `/Game/Mapas/Campana` horneado, con capturas en `art/capturas/` y FPS medidos en Baja/Media/Alta. Resultados en la sección siguiente.

## Primer corte con luz horneada: campana (18 de noviembre de 2026)

Hecho y comprobado en este portátil (Intel integrada, D3D12 con nivel SM5). Nada subido ni con commit.

**Capa de estado de la campana en C++.** `ExperimentaChem/Public/ExperimentaChem/Hood.h` + `Private/Hood.cpp` portan `hood.ts`, las ramas de campana de `lab.ts` y `hoodRecipes.ts` (pipeta incluida; fuera: gabinetes, vitrina y la mezcla de la práctica 01). Mismo patrón que `Chem.h`: C++17 estándar, sin excepciones ni RTTI, `float_control(precise)` + `fp_contract(off)`, el tiempo como entrada (`Advance`). `HoodGolden.cpp` reconstruye cada estado de `golden/steps.json` y compara con la regla de `steps/lib/compare.ts` (sin omitir ninguna clave). Resultado: **197 de 197 casos, 5 208 operaciones, 0 diferencias de tablas**, en la prueba Automation `Experimenta.Hood.Golden` (UE 5.8.4, Editor Development) y en `native/ExperimentaChem/build.ps1` (MSVC `/W4 /WX /fp:precise`, ejecutable `steps_golden`). Se comprobó que el comparador falla al alterar una copia del JSON (+1e-12 en mL de la probeta, un mensaje). `Golden.cpp` solo cambió para compartir su comparador (`Private/GoldenCommon.h`). Las otras cinco pruebas `Experimenta.*` siguen pasando.

**Arte.** `art/blender/campana_estacion.py` (campana de sobremesa 1200 mm con guillotina, deflector ranurado, llaves de servicio y perfil aerodinámico; encimera de granito con salpicadero; gabinete blanco; UV1 de lightmap; colisión UCX, que el importador sí reconoce) y `art/blender/texturas_procedurales.py` (texturas tileables calculadas con numpy: granito, ruido fino, acero cepillado, vinilo). Medidas: lo contrastado sale de `ASSETS.md`; formato de sobremesa, alto, espesores, ranuras y colores de llaves son decisión de diseño (está escrito en el guion).

**Nivel.** `Tools/campana_importar.py` → `Tools/campana_crear_nivel.py` → horneado (`ResavePackages -buildlighting -quality=Production`, 14 min 36 s de Lightmass, 9,7 MB de BuiltData) → `Tools/campana_capturar.ps1`. Sala propia de 5 × 4,7 × 3 m con ventana, sol y cielo por la ventana, 4 paneles LED y luminaria de campana, todas las luces estáticas; capturas de reflejos + SSR; post-proceso de cámara física (ISO 400, 1/60, f/2,8, compensación −1,5). `DefaultEngine.ini` ahora fija sin Lumen, sin VSM, sin campos de distancia y TAA por defecto. Trampas encontradas: los materiales creados por commandlet necesitan `used_with_static_lighting` (si no, en `-game` sale el material por defecto; lo arregla `Tools/campana_marcar_materiales.py`), y el lanzamiento con `ResavePackages` devuelve código 1 por un aviso de arranque de Swarm aunque el horneado termina bien.

**FPS medidos** (1920 × 1080 en ventana, sin VSync, 22 s tras 20 s de calentamiento, vista fija de la estación; `art/capturas/campana_resultados.json`):

| Perfil | Ajustes | FPS medios | p95 |
| --- | --- | --- | --- |
| Baja | sg 0, TAA con reescalado desde el 75 %, sin SSR ni SSAO | 132,6 | 10,3 ms |
| Media | sg 1, TAA al 100 %, SSR 1, SSAO 1 | 79,1 | 18,0 ms |
| Alta | sg 2, TAA al 100 %, SSR 3, SSAO completo | 67,4 | 20,9 ms |

El objetivo de ≥ 60 FPS en Media se cumple en esta vista. **TSR no es viable aquí**: a resolución nativa cuesta unos 45 ms por fotograma (Alta con TSR: 16 FPS; Media con TSR: 20 FPS; `art/capturas/campana_aislar_resultados.json`), así que los tres perfiles usan TAA. Es una escena pequeña (una estación, 46 actores); el laboratorio completo costará más.

**Capturas:** `art/capturas/campana_horneado_media.png` y `campana_horneado_alta.png` (también `_baja`), y la vista previa de Blender `art/export/campana_estacion_preview.png`. **Valoración honesta:** materiales, reflejos del vidrio y luz indirecta resultan creíbles, pero **todavía no parece una foto**: la luz es plana y el sol no se ve desde la cámara; hay manchas de lightmap en el suelo; el granito se lee demasiado azul y de manchas grandes; la cámara corta la parte alta de la campana. Siguientes pasos propuestos: volumen de importancia de Lightmass y más resolución en el suelo, reencuadre con el sol visible, granito más fino y oscuro, AO/contacto en las juntas, y probar TSR a menor porcentaje solo si mejora la nitidez sin bajar de 60 FPS.

## Campana v2: texturas CC0 y luz (18 de noviembre de 2026, tarde)

El usuario autorizó descargar texturas y modelos gratuitos **CC0 solo de Poly Haven y ambientCG**. Se bajaron siete recursos a 2K (licencia comprobada en cada página; registro completo en [ASSETS.md](ASSETS.md), apartado c.5; originales en `art/terceros/<fuente>/<nombre>/`): ambientCG Granite002A, Metal009, Plastic010 y OfficeCeiling001; Poly Haven marble_01, plastered_wall_04 y el HDRI quadrangle_sunny. **Ningún granito CC0 es oscuro**, así que el granito pulido oscuro se deriva de Granite002A invirtiendo la luminancia (`art/blender/texturas_cc0.py`, albedo medio 0,06, grano fino, destello azulado muy leve). No se bajó ningún modelo: Poly Haven no tiene piseta, gafas, balanza ni bote de residuos de laboratorio.

Cambios en `Tools/campana_crear_nivel.py`: materiales con las texturas CC0 (coordenadas de mundo en las cajas de la sala, placas del techo encuadradas con los LED), suelo como plano con mapa de luz propio, volumen de importancia de Lightmass, calidad indirecta 3 y escala 0,7, sol de 45 klx que entra en diagonal por la ventana, LED a 2400 lm, cielo exterior = esfera con el HDRI (sin iluminar, no ilumina la escena), exposición −3,2 y cámara más abierta (campana entera, ventana y mancha de sol). Horneado Production: 25 min 29 s, 21 MB de mapas de luz.

FPS (1920 × 1080, vista fija, 22 s; `art/capturas/campana_v2_resultados.json`): **Baja 127,5 · Media 78,9 · Alta 67,1**. Capturas: `art/capturas/campana_v2_baja.png`, `_media.png`, `_alta.png`. Valoración: desaparecieron las manchas del suelo y la luz tiene contraste y mancha de sol; el granito se lee como granito gris oscuro. Sigue sin parecer una foto: paredes y techo muy limpios y uniformes, sin desgaste ni objetos de uso, el exterior se ve algo oscuro y plano, y faltan sombras de contacto finas en las juntas.

## Juego jugable: «Prueba de cloruros» en /Game/Mapas/Campana (18 de noviembre de 2026, noche)

Cambio de prioridad del usuario: **un juego jugable antes que pulir la escena**. Implementado en C++ (sin Blueprints) sobre la capa validada:

- **Lógica:** `FExpPartida` (`Public/ExpPartida.h`) traduce las acciones del jugador (apuntar a un identificador de objetivo, pulsar y soltar usar, Q, 1/2, N, tiempo) a `ExperimentaChem::FLabSession` (la de los 197/197 casos), igual que `src/world/Player.tsx`. Ninguna química en el render. `UExpSubsistema` (subsistema de mundo) posee la partida y la avanza cada fotograma.
- **Objetos:** `AExpObjeto` (`Public/ExpJuego.h`) con los mismos identificadores que la web (`reagent:agno3`, `hood`, `hood-cylinder`, `hood-washbottle`, `hood-waste`, `ppe-goggles`, `ppe-gloves`, `recipe-board`, `reagent-shelf`, `hood-tray`). Cada fotograma leen el estado: frascos en estantería, bandeja de 8 o mano; nivel de la probeta; mezcla del matraz pasada a `UMezclaComponent::FijarMezcla` (nube y sedimento de AgCl según los gramos del modelo); coreografía de verter la probeta, enjuagar y desechar según el progreso de la transferencia; marca de guía «V» sobre los objetivos del paso actual; contorno dorado al apuntar (material de superposición).
- **Jugador:** `AExpPersonaje` con ojos a 1,65 m, Enhanced Input creado en código (WASD, ratón, Mayús, E o clic izquierdo, mantener para verter, Q, 1/2, N, clic derecho para mirar de cerca, Esc o P para la pausa), manos de `art/blender/manos.py` con puño de bata que pasan a guante de nitrilo azul al ponérselos, inclinación de muñeca y chorro al verter. `AExpGameMode` en el nivel y como modo global.
- **Interfaz UMG en C++** (`ExpHud`): panel de tarea arriba a la izquierda con pasos y barra de progreso, aviso contextual, casillas de las dos manos, mensaje de la capa de estado, resultado final con lo que calcula el modelo y menú de pausa con calidad Baja/Media/Alta (mismos ajustes que los perfiles `horneado_*` medidos).
- **Nivel:** `Tools/juego_preparar.py` crea los materiales del jugador (`/Game/Juego/Materiales`) y coloca los 15 actores del juego (todos móviles: no invalidan la luz horneada); quita la cristalería decorativa que ocupaba sus sitios; etiqueta el vidrio de la guillotina y la encimera con `ExpTransparente` para que no corten la puntería (su respuesta de colisión no se guardaba). `DefaultEngine.ini`: mapa de inicio Campana y modo de juego; `DefaultGame.ini`: mapa a cocinar.
- **Pruebas:** nueva `Experimenta.Juego.Cloruros` (recorre la práctica con las mismas acciones del jugador, comprueba orden de pasos, mezcla igual a la del motor, regla `ksp-AgCl` y casos negativos sin protección y con probeta sucia): pasa, junto con las otras cinco `Experimenta.*`. Recorrido automático dentro del juego con trazado real (`-ExpRecorrido`): completa la práctica en 34 s; resultado 20,1 mL de AgNO3 + 5,1 mL de NaCl → **0,2881 g de AgCl**; **61,8 FPS de media a 1080p en Media** con interfaz (p95 18 ms), en `-game` del editor. Capturas en `Saved/Recorrido/`.
- **Ejecutable:** `build/Experimenta3D_Windows/Windows/Experimenta3D.exe` (Win64 Development, 959 MB, 7,5 min con `RunUAT BuildCookRun`; carpeta **no ignorada por Git**: no conviene subirla). Arranca en la campana. Recorrido automático en el ejecutable a pantalla completa 1920 × 1080, calidad Media: práctica completa en 34 s, 0,2881 g de AgCl, **63,4 FPS de media (p95 18,4 ms)**. En ventana la resolución queda limitada por la pantalla del portátil (1536 × 960 con escalado: 80 FPS). Para repetirlo: `Experimenta3D.exe -fullscreen -ExpRecorrido -ExecCmds="r.SetRes 1920x1080f"`; deja el registro y capturas en `Windows/Experimenta3D/Saved/`. Capturas copiadas a `art/capturas/juego_*.png`.
- **No modelado o pendiente:** tapas solo visuales (fuera en la mano), la guillotina no se mueve (queda en posición de trabajo; la capa de estado sí la modela), sin balanza, sin Niagara, sin dedos articulados ni poses de agarre por objeto, sin sonido. Nadie lo ha jugado todavía con teclado y ratón reales. El horneado actual no incluye la sombra de los objetos del juego (son móviles) y conserva la de la cristalería decorativa quitada hasta rehornear.

## Versión web de la campana (19 de noviembre de 2026)

El usuario preguntó si el juego de Unreal se podía abrir en el navegador. No se puede (Unreal 5 genera un ejecutable de Windows); entre hacer *streaming* desde un servidor o rehacerlo con tecnología web, **eligió rehacerlo para el navegador**, aceptando perder algo de realismo. Siguen en pie el máximo realismo posible, que funcione en PC modestos, no usar Higgsfield y solo recursos CC0 de Poly Haven y ambientCG. No pidió publicarlo en ningún sitio: todo está en local.

- **Dónde:** `web-campana/` (Vite + TypeScript + Three.js 0.187, sin React en la escena). Detalle completo en [web-campana/README.md](../web-campana/README.md). Se ejecuta con `npm run campana:dev` (puerto 5180) y se compila con `npm run campana:build` (rutas relativas). `Unreal/` y `src/` no se modificaron; en `package.json` solo se añadieron los tres guiones `campana:*`.
- **Reutiliza sin copiar:** la capa de estado validada (`src/state/hood.ts`, `lab.ts`, motor químico y recetas) importada tal cual, con `web-campana/src/partida.ts` como traductor de acciones equivalente a `FExpPartida`; los GLB de `art/export/`; los perfiles interiores para el nivel del líquido; las medidas y posiciones de `Tools/campana_crear_nivel.py` y `Tools/juego_preparar.py`; las texturas CC0 ya descargadas.
- **Luz horneada:** `art/blender/web_campana_hornear.py` monta la sala en Blender y hornea con Cycles la irradiancia de cada malla estática (cielo y sol del HDRI, sol direccional que completa 45 klx, 4 LED de 2400 lm, luminaria de la campana; 512 muestras, 28 min). `art/blender/web_texturas.py` prepara las texturas a 1024 px. En la web no hay luces en tiempo real: textura × mapa de luz + reflejos de una captura del cuarto.
- **Controles:** como Unreal, salvo que **E siempre es interactuar** y el **clic mantenido** vierte del frasco (igual que `src/world/Player.tsx`): así se puede verter la probeta llena sin soltar el frasco.
- **Comprobado** en este portátil con Edge sin ventana (ANGLE D3D11 sobre la GPU Intel real, no SwiftShader), `web-campana/tests/recorrido.mjs`: práctica completa con la puntería real, regla `ksp-AgCl`, 0,2881 g de AgCl (igual que el motor y que Unreal); 1920 × 1080 en vista fija: **Baja 167, Media 212, Alta 156 FPS**; sin errores en consola; la compilación de `dist/` también funciona. Capturas en `art/capturas/web_*.png`.
- `web-campana/tests/teclado.mjs` comprueba la entrada real (captura del puntero, W, E en el tablero, P para la pausa).
- **No comprobado:** una persona jugando con ratón y teclado; FPS en ventana visible o en otros equipos.
- **Pendiente si se sigue:** guillotina móvil, sombras de los objetos móviles, más prácticas y estaciones, comprimir los mapas de luz (dist ≈ 22 MB) y decidir dónde publicarlo si el usuario lo pide.

## Laboratorio grande en la web y publicación en Vercel (19–20 de noviembre de 2026)

Tras probar la primera versión web, el usuario dijo que era «un cuarto pequeño» y pidió un **laboratorio grande**: campana, estantes con todo el material, lavabos, ducha de emergencia señalizada, aire acondicionado, mesetas centrales con gas y mecheros, y que fuese intuitivo, con **misiones** de combinaciones químicas y **mezcla libre**. Hecho en `web-campana/` (el nombre de la carpeta se conserva); detalle en su README.

- **Escena:** `art/blender/web_laboratorio_hornear.py` (sustituye a `web_campana_hornear.py`) monta un laboratorio de diseño propio de 12 × 9 × 3,2 m y hornea la luz (256 muestras, 20,6 min): estación de la campana entre dos bancos, estantería de 4 × 7 reactivos, estantes de material, banco con dos lavabos, cuatro mesetas con torretas de gas, ducha de emergencia con lavaojos, dos aires acondicionados, puerta, extintor, protección, tablero y residuos.
- **Juego:** los 27 reactivos del modelo en la estantería (frascos, tarros y goteros), balanza con navecilla en la campana, las 16 prácticas de `hoodRecipes.ts` como misiones elegibles en el tablero o con M, y mezcla libre. Tarjeta con la reacción que predice el modelo, pantalla del matraz, color, precipitado y burbujas. `src/` no se modificó.
- **Ambiental (sin química, y el juego lo dice):** ocho mecheros que se encienden, grifos, ducha, extintor, aire acondicionado y material expuesto.
- **Comprobado** con `web-campana/tests/recorrido.mjs` (Edge sin ventana, GPU Intel real): misiones «Prueba de cloruros», «Vinagre y bicarbonato» y «Neutralización con indicador» completas con sus reglas (probeta, balanza y gotero), mezcla libre CuSO₄ + NaOH → Cu(OH)₂, mechero, grifo y ducha, sin errores de consola. FPS a 1080p en Media con todo el laboratorio a la vista: 75 en la compilación local y 46 en una pasada contra la URL publicada (la medida varía; **no se ha fijado una cifra fiable ni se han medido Baja y Alta** en el laboratorio grande). `tests/teclado.mjs` pasa (captura del puntero, E en el tablero, elegir misión con el ratón, M, P).
- **No comprobado:** las 16 misiones seguidas (la pasada se cortó al cerrarse la sesión; pasaron 3 de 16), una persona jugando con ratón y teclado, y otros equipos.
- **Publicado a petición explícita del usuario (20 de noviembre):** https://labquimica3d.vercel.app (proyecto `labquimica3d` de la cuenta de Vercel del usuario, despliegue estático de `web-campana/dist/` copiado a `web-campana/labquimica3d/`, carpeta ignorada por Git). Para volver a publicar: `npm run campana:build`, copiar `dist/` a esa carpeta y `vercel deploy --prod --yes` dentro de ella. Sigue sin haber commit ni push en Git.

## Ventana corregida y laboratorio más equipado (20–21 de noviembre de 2026)

El usuario avisó de que lo que se ve por la ventana estaba al revés y pidió un laboratorio «más cargado, más robusto», dejando a criterio qué añadir.

- **Ventana:** el sombreador del cielo invertía la coordenada vertical del HDRI (`web-campana/src/escena.ts`); corregido.
- **Mobiliario horneado nuevo** (`art/blender/web_laboratorio_hornear.py`, 256 muestras, 27,6 min): repisa central de dos baldas y cuatro taburetes por meseta, muebles altos y escurridores sobre los lavabos, cuatro armarios de almacén, armarios de inflamables y de corrosivos, nevera, bombonas de gas sujetas, carrito, escritorio con monitor y silla, pizarra, botiquín, papeleras y conducto de extracción de la campana. El recipiente de residuos pasó a (480, 30).
- **Material ambiental** (`objetos.ts`, todo instanciado): frascos en las repisas, soportes con bureta, placas calefactoras, gradillas, cristalería en bancos, lavabos y carrito, cajas sobre los armarios, tabla periódica esquemática, normas, pictogramas, pizarra escrita, reloj y rótulos. Todo ello es de exposición y el juego lo dice.
- **Rendimiento:** con el material nuevo la escena subió a 1,6 millones de triángulos y 47 FPS. `art/blender/web_modelos_ligeros.py` genera versiones reducidas en `web-campana/public/ligeros/` (0,41 millones de triángulos, 395 llamadas de dibujo); además se quitó el desenfoque de los paneles y la animación del grano. En este portátil la misma vista (1080p, Media) mide entre unos 47 y 120 FPS según el estado térmico del equipo, así que **no hay una cifra fiable**; `web-campana/tests/perfil.mjs` la mide.
- **Comprobado** con el recorrido automático: misiones «Vinagre y bicarbonato», «Prueba de cloruros», «Lluvia de oro» y «Magnesio en ácido», mezcla libre, mechero, grifo y ducha, sin errores; `tests/teclado.mjs` pasa. En total van 5 de 16 misiones recorridas.
- **Publicación:** estos cambios están solo en local; https://labquimica3d.vercel.app sigue con la versión anterior hasta que el usuario pida publicar de nuevo.

## Más viveza y subida a GitHub (23 de noviembre de 2026)

El usuario pidió «un toque más de vividez» y subir todos los cambios a `ChristopherMarreroL/Simulador3D-Quimica`, autorizando forzar el push si hacía falta.

- **Viveza** (solo en la web, sin rehornear): tono neutro de Khronos en lugar de AgX (`?tono=agx|aces|neutro`, exposición 1,75), mesetas y muebles altos azules, taburetes azules, pared de la entrada y antepecho de las ventanas en verde agua, madera más cálida, bombonas verdes, plantas en los alféizares y el escritorio, líquidos de exposición más saturados y etiquetas de los reactivos con el color de su familia. Los acentos se definen en `ACENTOS` (`web-campana/src/escena.ts`) y conservan la luz horneada.
- **Comprobado:** misión «Hidróxido de cobre azul» completa con el recorrido automático (6 de 16 recorridas en total), `tests/teclado.mjs` y compilación, sin errores.
- **Git:** primer commit con todo el trabajo acumulado desde el 5 de noviembre (prototipo web ampliado, vectores de referencia, proyecto de Unreal, arte y laboratorio web) y push a `origin/main`. El remoto estaba en el mismo commit que la copia local, así que fue un avance normal: **no se forzó ni se sobrescribió nada**. Siguen fuera de Git las fotos de referencia (`Images/`), los ejecutables (`build/`, `release/`), `dist/` y las carpetas generadas de Unreal.
- **Vercel:** https://labquimica3d.vercel.app sigue con la versión del 20 de noviembre hasta que el usuario pida publicar de nuevo.

## Misiones guiadas para principiantes (23 de noviembre de 2026)

El usuario pidió que las misiones guíen a un estudiante que no sabe nada de laboratorio: flechas sobre lo que hay que usar, a dónde ir, qué hacer y qué cantidad, y un sitio para pistas.

- `web-campana/src/guia.ts` deriva del paso actual de `recipeSteps` (no decide nada propio) una pista en lenguaje llano: dónde está el objeto y cómo reconocerlo (balda y posición del envase, tipo de frasco), qué tecla usar, la cantidad, y qué hacer con la mano ocupada o la probeta sucia. Sin misión, lleva primero a la protección y luego al tablero.
- Panel «Qué hacer ahora» arriba a la derecha (tecla **H** lo oculta), flecha de tamaño constante sobre el objeto con su etiqueta, indicador en el borde de la pantalla con la distancia cuando el objeto queda fuera de la vista, y medidor en vivo (mL, g o gotas frente a lo que pide la misión).
- Comprobado con el recorrido automático de «Vinagre y bicarbonato» y `tests/teclado.mjs`, sin errores. No lo ha probado todavía una persona.
- Límite: el orden de los pasos es el de la capa validada (primero reunir todos los reactivos, lo que obliga a usar las dos manos o la bandeja); la guía lo explica pero no lo cambia.

## Continuidad entre sesiones

Leer primero este archivo y `AGENTS.md`; consultar [ARQUITECTURA.md](ARQUITECTURA.md) antes de ampliar módulos y el contexto maestro para requisitos detallados. Verificar archivos y estado local de Git antes de hacer suposiciones sobre ramas, remotos o trabajo publicado. Actualizar este contexto cuando cambien decisiones, alcance, validaciones o próximos pasos; conservar el documento original como referencia histórica.

El 20 de noviembre de 2026 se publicó la versión web en Vercel y el 23 de noviembre se hizo commit y push a `origin/main`, ambas cosas a petición explícita del usuario. Fuera de esas peticiones, no subir ni publicar nada sin que lo pida. La comunicación de la URL del repositorio no modifica las restricciones del usuario.
