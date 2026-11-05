# Experimenta 3D

Laboratorio virtual interactivo en primera persona, en español. Prototipo independiente, sin identidad institucional.

## Ejecutar localmente

Requiere Node.js 22.12+ o 24 y un navegador de escritorio con WebGL 2 y aceleración gráfica.

```sh
npm install
npm run dev
```

Abrir http://127.0.0.1:5173. `npm run build` genera `dist/`; `npm run preview` permite revisar esa compilación localmente. No se configura publicación automática.

## Probar el laboratorio

1. Elegir práctica guiada o laboratorio libre. La primera visita inicia el tutorial obligatorio.
2. Pulsar **Entrar al laboratorio** para capturar el mouse. WASD camina; mouse orienta; Shift acelera; Escape pausa.
3. Seguir el marcador dorado hasta el vaso en el estante del fondo. Apuntar y usar E para recogerlo.
4. Cambiar de mano con 1 / 2 y colocar el vaso en la mesa central con E.
5. Abrir la estación con E para terminar el tutorial.
6. Recoger el vinagre y llevarlo a la mesa. Abrir la estación y verter una cantidad entre 1 y 150 mL.
7. Recoger el bicarbonato con la otra mano. En la mesa, añadir entre 0,01 y 10 g.
8. Observar el vertido y la efervescencia. Abrir la mesa otra vez para consultar resultados y escribir una observación.

Q coloca el objeto de la mano seleccionada sobre Reactivos y material, la mesa de reacción o las mesas de apoyo al apuntar a esa superficie. Los objetos colocados se pueden recoger de nuevo. Para retirar el vaso con mezcla, apunta al vaso o a la mesa de reacción y pulsa **R para vaciar y enjuagar el vaso**; también puedes usar ese botón en el panel de la estación. Devolver los frascos al estante no vacía la mezcla. El cuaderno conserva los resultados al enjuagar. N abre el cuaderno; registra hasta 30 ensayos en este navegador. La tabla periódica del fondo se abre con E.

## Alcance y límites

- Escena procedural inspirada en 43 fotos de referencia: islas de esquinas recortadas, granito oscuro, gabinetes blancos, taburetes, ventanas, detalles azules del techo, campana acristalada y lavaojos decorativo. **No es una reconstrucción del laboratorio universitario**: conserva una distribución propia. Ver `docs/REFERENCIAS_LABORATORIO.md`. Los soportes, taburetes, campana y lavaojos son ambientales; no implementan prácticas adicionales.
- Primera persona, colisiones con paredes y muebles, raycasting con oclusión, dos manos con mangas de bata y representación sencilla de guantes.
- Tutorial por acciones, guardado local, objetivos guiados y exploración libre.
- Tres prácticas: vinagre + bicarbonato (mesa 01), conductividad comparando NaCl/sacarosa/agua pura (mesa 02), disolución y cristalización de NaCl por evaporación (mesa 03). El selector «Experimentos» ofrece guías y se puede abrir cada equipo con E en laboratorio libre. No se simulan mezclas arbitrarias.
- Cantidades, cálculo estequiométrico y volumen ideal de CO₂, transferencia visual y burbujas ligadas a los moles calculados.
- Cuaderno con un ensayo seleccionado, un resultado destacado y una anotación editable. Los cálculos completos están plegados inicialmente. Se muestran hasta 30 ensayos recientes de las tres prácticas; no hay cuentas, sincronización ni exportación. Al borrar los datos del navegador se pierde el progreso.
- Tabla periódica interactiva con 118 elementos, nombres en español, selección por mouse/teclado, búsqueda, filtros por familia, colores por propiedades y fichas con datos locales de PubChem. Ver `docs/TABLA_PERIODICA.md` para procedencia y límites.
- Controles de laboratorio para escritorio. Los menús se adaptan a pantallas pequeñas; no hay controles táctiles de movimiento.
- Tipografías de Google Fonts con fuentes de respaldo; el mundo no descarga modelos ni texturas externas.

## Verificación

```sh
npm test
npm run build
```

La prueba de interfaz se ejecuta con el servidor local encendido:

```powershell
$env:CHROME_PATH = 'C:\ruta\a\chrome.exe'
node tests/browser.smoke.mjs
node tests/browser.regressions.mjs
node tests/browser.practices.mjs
```

Generan capturas en `test-results/`. La prueba general cubre movimiento/cámara y paneles con una escena preparada. La prueba de regresiones usa raycasting y teclado reales para recoger, colocar, devolver y enjuagar, comprueba conservación de la cámara y movimiento sin retrocesos, y verifica la tabla en escritorio/móvil. Prepara las posiciones de aproximación del jugador: todavía no equivale a caminar manualmente todo el tutorial y experimento de principio a fin.

La prueba de prácticas abre mesas 02/03 mediante raycasting, completa mediciones y cristalización con sus controles, edita notas de distintos ensayos y revisa las vistas de fregaderos, manos y cuaderno. Los modelos y sus límites se documentan en [prácticas de soluciones](docs/PRACTICAS_SOLUCIONES.md).

Para continuar el proyecto, empezar por [contexto actualizado](docs/PROJECT_CONTEXT.md) e [instrucciones para futuras sesiones](AGENTS.md). Ver también [arquitectura y fases](docs/ARQUITECTURA.md), [modelo químico y fuentes](docs/MODELO_QUIMICO.md) y [contexto original íntegro](docs/CONTEXTO_MAESTRO.md).
