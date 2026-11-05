# Experimenta 3D — Contexto actualizado del proyecto

Última actualización: 31 de octubre de 2026.

Este archivo es el punto de entrada para continuar el proyecto en futuras sesiones. Resume las decisiones del usuario, el estado implementado y los pendientes. Las instrucciones operativas principales están en el `AGENTS.md` de la raíz. El encargo original íntegro se conserva en [CONTEXTO_MAESTRO.md](CONTEXTO_MAESTRO.md).

## Proyecto y repositorio

- **Producto:** Experimenta 3D.
- **Subtítulo:** Laboratorio Virtual Interactivo.
- **Raíz local:** `C:\Users\chris\OneDrive - Universidad Iberoamericana\Tareas\6to Cuatrimestre\Quimica 1\Simulador3D`.
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

El primer MVP se centró en vinagre y bicarbonato. El usuario autorizó después añadir prácticas: actualmente hay **vinagre/bicarbonato, conductividad y disolución/cristalización**. Calor específico y otras prácticas siguen pendientes; no ampliar todas a la vez. Las combinaciones sin modelo deben indicarse como no disponibles, sin inventar reacciones.

## Referencias visuales y criterio de diseño

El usuario aportó **43 fotografías**, con algunas vistas repetidas. Después aclaró: **el laboratorio es una referencia, no quiere que sea exactamente igual**. Esa aclaración orienta la adaptación actual.

Rasgos observados e incorporados: mesas de esquinas recortadas sobre pedestal oscuro, encimeras de granito gris oscuro, gabinetes blancos, taburetes, soportes metálicos, ventanas amplias, luces cuadradas y detalles azules del techo. También se adaptaron una campana con frente acristalado y un lavaojos decorativo.

La distribución es propia: habitación de trabajo de 12 × 10 unidades, tres islas y pasillos diseñados para navegar. Estas dimensiones no se midieron en el laboratorio real. Los modelos son procedurales y simplificados; la dirección deseada sigue siendo 3D semirrealista, limpio, moderno y optimizado para navegador. La referencia a Minecraft describe el movimiento y la interacción, no una estética cúbica.

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

Soportes, taburetes, campana y lavaojos son elementos ambientales en esta versión. No tienen simulaciones de montaje, extracción o emergencia. No presentar equipos decorativos como prácticas funcionales.

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

Persistencia: `experimenta.tutorial.v1` y `experimenta.records.v1` en `localStorage`. No hay backend, cuentas ni sincronización. El borrado de datos del navegador elimina el progreso. Si falla el almacenamiento, se conserva el estado en memoria durante la sesión.

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

Con el servidor encendido, la prueba de navegador admite `CHROME_PATH` para el ejecutable de Chromium/Chrome y `BASE_URL` para la dirección del servidor. Ejecutar `node tests/browser.smoke.mjs`. Su ruta de navegador por defecto corresponde al equipo original y puede necesitar ajuste en otro entorno.

Última validación registrada: **35 pruebas de lógica correctas**, compilación correcta y pruebas de interfaz/regresiones correctas. Las capturas se guardan en `test-results/`, ignorado por Git. Vite mantiene una advertencia por tamaño del módulo que incluye Three.js y datos de elementos: aproximadamente 342 kB de JavaScript comprimido.

La prueba general verifica movimiento/cámara y paneles con objetos preparados. La de regresiones usa raycasting y teclas reales para recoger, colocar y devolver frascos al estante, vaciar el vaso y recogerlo; también registra movimiento sin retrocesos y comprueba la conservación de posición al abrir/cerrar la estación. **Las aproximaciones a cada objeto se preparan: todavía no cubre caminar todo el tutorial y la mezcla de principio a fin.** No se han medido FPS en hardware representativo. Ver [VALIDACION.md](VALIDACION.md). Estos resultados son históricos; no sustituyen comprobar cambios posteriores.

## Próximas prioridades

1. Verificar un recorrido completo del tutorial y la práctica utilizando raycasting, recogida, transporte y colocación reales en el navegador.
2. Refinar agarre, manos, modelos, iluminación y rendimiento, manteniendo pasillos y colisiones coherentes con el mobiliario.
3. Incorporar configuración de sensibilidad/calidad y mejorar accesibilidad de los controles.
4. Profundizar la manipulación de equipos y reactivos de las nuevas estaciones. El catálogo/sesiones comunes para conductividad y cristalización ya existen; calor específico sigue pendiente y requerirá su modelo verificable.
5. Ampliar el cuaderno con comparación y exportación de ensayos. Las fichas básicas de elementos ya están implementadas; orbitales/isótopos y simulación térmica de estados quedan fuera del alcance actual.

## Correcciones solicitadas tras probar el prototipo

El usuario reportó que Q no devolvía frascos a Reactivos y material, que no se entendía cómo retirar el vaso después de la reacción, que los rótulos de las tres islas estaban cortados por el pedestal y que el movimiento daba tirones. Se registraron superficies para Q, se separó devolución de frascos y enjuague del vaso, se adelantaron las placas de los rótulos y se revisaron las colisiones, incrementos de mouse y coste del renderizado. Canvas/cámara son estables y las sombras estáticas se actualizan al cambiar objetos, no en cada fotograma. Mantener estas regresiones comprobadas al cambiar la escena.

También pidió convertir la tabla en una herramienta interactiva tomando [Ptable](https://ptable.com/?lang=es#Propiedades) como referencia. Se implementó una interfaz propia con datos de PubChem y fuentes visibles; no se incrusta Ptable ni se usa su código.

## Segunda revisión solicitada por el usuario

Se retiró el texto «Datos de PubChem, guardados localmente…» del panel de tabla; la documentación mantiene fuentes y límites. Se corrigieron ambos fregaderos con cubeta hueca, desagüe y grifo unido a la encimera. Las manos ahora tienen palma, dedos, pulgar y una conexión alineada con la manga.

El usuario pidió continuar con más experimentos y simplificar N. Se añadieron las mesas 02 (conductividad) y 03 (disolución/cristalización), accesibles con E o mediante «Experimentos». El cuaderno da prioridad a las anotaciones y permite editar ensayos anteriores sin mostrar todos los cálculos de entrada.

Ver `docs/PRACTICAS_SOLUCIONES.md` para modelos y fuentes. Datos adicionales: `experimenta.practices.v1`, con hasta 30 ensayos nuevos, sin migrar ni borrar `experimenta.records.v1`. `tests/browser.practices.mjs` verifica las estaciones, resultados, notas y capturas nuevas. Estas prácticas preparan sus muestras en el equipo de la estación; todavía no añaden reactivos transportables al inventario de manos. La simulación de evaporación comprime el tiempo y evalúa el equilibrio tras enfriar a 20 °C.

## Continuidad entre sesiones

Leer primero este archivo y `AGENTS.md`; consultar [ARQUITECTURA.md](ARQUITECTURA.md) antes de ampliar módulos y el contexto maestro para requisitos detallados. Verificar archivos y estado local de Git antes de hacer suposiciones sobre ramas, remotos o trabajo publicado. Actualizar este contexto cuando cambien decisiones, alcance, validaciones o próximos pasos; conservar el documento original como referencia histórica.

Hasta esta solicitud no se han realizado push, deploy, merge ni publicación desde este chat. La comunicación de la URL del repositorio no modifica las restricciones del usuario.
