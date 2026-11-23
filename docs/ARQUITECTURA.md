# Arquitectura y plan por fases

## Inspección inicial

La raíz estaba vacía al iniciar el 31 de octubre de 2026. No existían código, fotografías, videos ni modelos. El contexto adjunto se conserva íntegro en `CONTEXTO_MAESTRO.md`. No se infieren características arquitectónicas del laboratorio real.

## Propuesta de escena provisional

Habitación de 12 × 10 unidades, altura visual de 3,4 unidades; escala de trabajo aproximada de un metro por unidad. Tras recibir las 43 fotos, se incorporaron tres islas de esquinas recortadas con pedestal oscuro, granito procedural, taburetes, gabinetes blancos, encimera bajo ventanas, techo con marco azul y luces cuadradas, frente acristalado de campana y lavaojos decorativo. La mesa principal conserva el experimento. Ver `REFERENCIAS_LABORATORIO.md` para evidencia por fotografías y límites de interpretación. Las dimensiones y posiciones son decisiones de diseño para Experimenta 3D; el usuario pidió inspiración, no una réplica.

Dirección visual: vidrio, superficies de laboratorio verde grisáceo, encimeras oscuras y luz de día; interfaz de papel de laboratorio limpio y tinta azul petróleo. Paleta: #143e49 tinta, #f5f7f2 papel, #568d89 instrumentos, #c59546 orientación, #d8e2dd divisiones. Manrope en títulos y DM Sans para lectura, con fuentes locales de respaldo. Firma visual: el propio laboratorio visible desde la bienvenida, y las fórmulas como contenido del experimento, sin logos universitarios.

## Separación de responsabilidades

| Módulo | Responsabilidad |
| --- | --- |
| `src/chemistry/` | Funciones puras, unidades y validaciones; sin React ni Three.js |
| `src/experiments/` | Catálogo de objetos, tutorial y objetivos de la primera práctica |
| `src/state/` | Eventos de recogida, manos, colocación, transferencia, progreso y persistencia |
| `src/world/Models.tsx` | Modelos procedurales y rótulos con texturas locales |
| `src/world/Player.tsx` | Cámara, entrada, movimiento, raycasting y manos |
| `src/world/collisions.ts` | Restricciones espaciales independientes de renderizado |
| `src/world/Laboratory.tsx` | Escenario, marcadores y visualización de reacción |
| `src/ui/` | Menús, HUD, estación, resultados, tabla y cuaderno |

React + TypeScript + Vite, React Three Fiber/Three.js y Zustand. Colisiones cinemáticas: círculo de jugador contra polígonos de las islas con las mismas esquinas recortadas que su geometría visual, encimeras rectangulares y límites circulares de taburetes. El movimiento se barre en pasos pequeños y consume la distancia disponible por eje sin empujar hacia atrás ni ajustar posiciones por objetivos. No se introduce Rapier para este escenario estático. No hay gravedad ni objetos arrojados libremente: la colocación usa superficies compatibles y posiciones estables.

`src/experiments/surfaces.ts` define las superficies y ubicaciones de cada objeto: estante, reacción y dos mesas de apoyo. Q permite devolver los frascos a Reactivos y material. La limpieza es independiente de la ubicación de los frascos: R, apuntando al vaso o estación, vacía y enjuaga el vaso conservando el cuaderno. El panel ofrece la misma acción explícita. Las etiquetas de las islas se sitúan sobre una placa por delante del radio máximo del pedestal para evitar su intersección.

El Canvas y sus opciones de cámara son estables ante cambios en los paneles. La sala y los efectos se suscriben solo a los campos de estado pertinentes. Las sombras del mobiliario se almacenan y se actualizan al cambiar la distribución de objetos o modo, en lugar de volver a renderizar el mapa en cada fotograma; los objetos en las manos no proyectan sombra. El raycasting excluye manos y efectos antes de recorrer sus mallas. Los incrementos anómalos del mouse se limitan para evitar giros bruscos del pointer lock.

No se necesita Drei en esta primera escena; se retiró la dependencia para mantener solo bibliotecas utilizadas. Puede incorporarse cuando sus utilidades de modelos o animación aporten una ventaja concreta. La compilación inicial contiene aproximadamente 323 kB de JavaScript comprimido e incluye Three.js; Vite advierte del tamaño del módulo sin comprimir. Separar la carga del motor y medir tiempos en equipos reales será parte de la optimización posterior.

Los rayos salen del centro de la cámara, tienen alcance de 2,7 unidades y respetan oclusión por paredes y muebles. Las manos y marcadores se excluyen del raycasting. La cámara no tiene oscilación. El delta de movimiento se limita para evitar atravesar muebles tras una pausa larga.

El tutorial avanza por distancia recorrida, movimiento de mouse, enfoque, recogida, selección de mano, colocación y apertura de estación. Al completarlo persiste `experimenta.tutorial.v1`. Los objetivos guiados se derivan del estado real de instrumentos y contenidos, no de clics en botones de «siguiente».

Una transferencia toma 1,8 segundos; bloquea recogidas mientras vierte. El temporizador se cancela al salir, limpiar o iniciar otra sesión. El cuaderno conserva hasta 30 registros bajo `experimenta.records.v1`. Si el navegador rechaza almacenamiento, la sesión conserva su estado en memoria. Es un prototipo local sin backend.

## Fases y prioridades

1. **Base del prototipo (implementada):** menú, escena provisional, navegación y colisiones, raycasting, manos, tutorial y guardado de progreso.
2. **Primera práctica (implementada):** cantidades validadas, vinagre y bicarbonato, transferencia animada, modelo estequiométrico puro, burbujas, resultados y registro local. Pruebas de química, estado y colisiones.
3. **Referencias del entorno (primera adaptación implementada):** 43 fotografías examinadas y evidencia registrada. Escena procedural adaptada con una distribución propia. Video no recibido; modelos glTF/GLB y refinamiento posterior pendientes. No copiar marcas institucionales ni asumir que los equipos decorativos ya tienen simulación.
4. **Profundización del MVP:** animaciones mejores de manos y agarre, render más realista, pruebas de extremo a extremo del raycasting, ajustes de rendimiento en equipos representativos, configuración de sensibilidad y gráficos, accesibilidad de controles.
5. **Ampliación modular:** extraer un registro común de experimentos con entradas, validadores, etapas y resultados tipados antes de añadir la segunda práctica. El motor químico actual ya es puro, pero la orquestación del estado todavía se centra en la primera práctica. Añadir conductividad, disolución/cristalización y calor específico individualmente con modelos verificados. Después: fichas completas de elementos, comparar ensayos y exportar cuaderno.

No se incorporan ahora todas las prácticas ni un sistema de plugins genérico. Los modelos GLB futuros deben mantener los identificadores de interacción y usar límites de colisión independientes de su malla visual.

La consulta de elementos es ahora interactiva: ver `TABLA_PERIODICA.md`. Usa una instantánea de datos de PubChem, nombres españoles, buscador, filtros, fichas y color por propiedades, sin acoplar esos datos al motor de reacciones.

## Ampliación a tres prácticas

El usuario autorizó añadir experimentos después del MVP. Se añadieron conductividad y disolución/cristalización en las mesas 02 y 03. `src/experiments/catalog.ts` recoge sus definiciones, `src/chemistry/solutions.ts` contiene cálculos puros y `src/state/practices.ts` gestiona sesiones discriminadas, etapas y registros. La reacción original conserva su implementación y sus datos guardados. No se añadió ninguna dependencia. Ver `PRACTICAS_SOLUCIONES.md` para modelos, fuentes y límites.

`src/ui/Notebook.tsx` adapta ambos formatos de registro a una vista de anotaciones. Cada ensayo muestra su resultado principal y materiales; la explicación completa se carga dentro de un desplegable. Las anotaciones se editan por identificador de ensayo, incluyendo ensayos anteriores.

## Campana de mezclas libres

`src/chemistry/sandbox.ts` es un motor puro de mezcla sobre especies (`species.ts`), constantes (`constants.ts`) y el catálogo de 27 reactivos (`reagents.ts`). Las reglas se aplican en pasadas sucesivas hasta que no hay cambios: reacciones completas por prioridad, desplazamientos generados a partir de E° y equilibrios de solubilidad bidireccionales. `src/state/hood.ts` guarda dónde está cada frasco (estantería, mano o bandeja), el vertido temporizado, los controles de la campana y las mezclas guardadas. `lab.ts` delega en él los objetivos `reagent:<id>`, `reagent-shelf`, `hood` y `hood-sash`, y comparte la ocupación de las manos. La escena (`FumeHood.tsx`, `ReagentShelf.tsx`, `ReagentBottle.tsx`) lee el estado y anima los efectos sin cálculos químicos propios. Detalles y fuentes en `CAMPANA_MEZCLAS.md`.

El aspecto realista se apoya en `materials.ts` (texturas procedurales deterministas compartidas), `RoomShell.tsx` (paredes con aberturas de ventana, exterior, oclusión ambiental y sombras de contacto) y `LabProps.tsx` (atrezo decorativo inspirado en las fotos). Las encimeras usan UV en metros para mantener la escala del granito. Las luminarias del techo no proyectan sombras. `src/state/settings.ts` guarda calidad y sensibilidad; la calidad Media reduce la resolución y desactiva la sombra del sol.

La app de escritorio (`electron/main.cjs`) carga la misma compilación de Vite con rutas relativas; no hay código exclusivo de escritorio en la página salvo la detección del agente de usuario para elegir Ultra por defecto. `PostEffects.tsx` toma el fotograma con prioridad 1 de `useFrame` solo en Ultra. `StaticBatch.tsx` fusiona geometría estática al montarse; sus hijos no deben cambiar ni ser interactivos (las encimeras interactivas, la estantería y la campana quedan fuera).

El procedimiento real también vive en `hood.ts`: `cylinder`, `balance`, `transfer` (animaciones de 1,5 s) y `recipe` (progreso pegajoso: cantidades añadidas, observado, guardado, desechado). `recipeSteps()` deriva los pasos y sus objetivos de escena a partir del estado; `GuideProps.tsx` los dibuja como flechas y en el tablero, y `App.tsx` como lista. `lab.ts` exige la protección (`ppe`) para los objetivos `reagent:*` y delega `hood-cylinder`, `hood-balance`, `hood-washbottle`, `hood-waste`, `ppe-*` y `recipe-board`.

El vertido continuo vive en `hood.ts` (`startStream`, `streamTick`, `stopStream`): `Player.tsx` lo inicia con el clic sostenido sobre el matraz y lo detiene al soltar, al mirar a otro lado o al pausar; cada paso de 2,5 mL (0,1 g o 1 gota) pasa por el motor químico y se une al mismo registro.

Las manos se animan en `Player.tsx` (solo las manos; la cámara no oscila) y `Hands.tsx` cierra los dedos según una pose compartida. La iluminación usa un mapa de entorno generado por `RoomEnvironment` con `PMREMGenerator`, sin archivos externos.

Los fregaderos ahora usan una abertura real en la geometría de la encimera, paredes de cubeta y fondo con desagüe. El grifo se modela con un tubo continuo que parte de su base. Las manos procedurales se separaron en `Hands.tsx`, con palma, dedos y pulgar, puño y manga alineados; cambian de postura al sostener un objeto.
