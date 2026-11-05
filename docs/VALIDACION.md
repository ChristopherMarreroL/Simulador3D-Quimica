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
