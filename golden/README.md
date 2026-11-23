# Vectores de referencia del motor químico

`chemistry.json` guarda lo que el motor químico de `src/chemistry` devuelve **hoy** para 1 452 casos (3 289 adiciones). Sirve para dos cosas:

- **Candado de regresión:** `npm test` falla si el modelo cambia sin regenerar el archivo (`golden.test.ts`). Con el mismo motor de JavaScript que generó el archivo la coincidencia exigida es exacta; con otro (bun, otra versión de Node) se aplica la regla de tolerancia.
- **Paridad del porte a C++:** el módulo `ExperimentaChem` debe reproducir estos casos con la regla de comparación de abajo.

Los valores no son «la química correcta»: son el comportamiento actual, incluidas sus rarezas (ver «Comportamientos congelados»).

La segunda mitad de este documento («Vectores de la capa de estado de la campana») describe `steps.json`, que congela del mismo modo las reglas de juego de la campana.

## Uso

```sh
npm run golden                              # regenera chemistry.json y steps.json (unos 15 s)
GOLDEN_FAMILY=20-practicas npm run golden   # ejecuta una familia, imprime cada paso y no escribe nada
npm test                                    # incluye el candado
```

El exportador genera todo dos veces y exige un resultado idéntico, al menos 200 casos, un caso `practica/<id>/exacta` por cada práctica guiada y que las 99 reglas den algún evento visible.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `families/*.ts` | Solo **entradas**: cada archivo devuelve una lista de casos. Nunca valores esperados escritos a mano. `index.ts` fija el orden; `_ejemplo.ts` muestra los nueve tipos de caso y no se exporta. |
| `lib/harness.ts` | Ejecuta cada caso con el motor real y captura las salidas. No contiene química propia. |
| `lib/tables.ts` | Tablas del modelo tal como las ve el código: 65 especies, 27 reactivos, 99 reglas, 16 recetas y constantes. |
| `lib/build.ts` | Une familias y tablas, comprueba ids y salidas finitas, y serializa (una línea por caso, LF). |
| `lib/compare.ts` | Comparador de referencia con la regla de tolerancia y las marcas de fragilidad. Es el modelo para el comparador del porte. |
| `export.golden.ts` | El exportador que lanza `npm run golden`. |

La semilla es `20261111` y el generador es mulberry32; cada familia recibe su propia secuencia a partir del nombre de su archivo, así que renombrar un archivo cambia sus casos aleatorios.

## Formato de `chemistry.json`

- `tables`: datos para generar y comprobar las tablas del porte. `rules` va en orden de prioridad. `eventTexts` contiene el título, la nota y la ecuación de cada evento por regla y sentido (121 combinaciones observadas); los eventos de los casos solo llevan `rule` y `kind`.
- `cases[]`: cada caso tiene `id` (`familia/nombre`), `fn`, `why` y:
  - `fn: "sequence"` → `steps[]`, cada uno con `in` (`reagent`, `amount`) y `out` o `error`. `out` contiene `events`, `note`, `deltaT`, `heatKJ`, `mixture` y `analysis`. Tras un paso con error la mezcla no cambia y la secuencia continúa.
  - el resto (`solvePH`, `solutionColor`, `indicatorColor`, `molarMass`, `gasLitres`, `calculateReaction`, `conductivity`, `crystallization`) → `in` y `out` o `error`.
- `mixture.n` va en el orden de `speciesIds` y `released` en el orden CO2, H2, O2: el orden de inserción de JavaScript no forma parte del modelo. El orden de `events`, `solids` y `dissolved` sí.
- Los números no finitos de entrada van como texto (`"NaN"`, `"Infinity"`, `"-Infinity"`). Ninguna salida es no finita.
- `error.code`: `UNKNOWN_REAGENT`, `RANGE`, `OVERFLOW`, `UNKNOWN_ELEMENT` o `BAD_FORMULA`, con el `message` exacto.
- `generator` y `stats` son informativos; el candado solo compara `schemaVersion`, `seed`, `tables` y `cases`.

## Regla de comparación para el porte

Propuesta, pendiente de confirmar por el usuario (la especificación pide «tolerancia relativa ≤ 1e-6» sin más detalle):

- **Números:** `|a − b| ≤ 1e-6 · max(|a|, |b|) + suelo`, con un suelo absoluto por clase para valores cercanos a cero (`compare.classes`): moles y concentraciones 1e-12; gramos, mL, temperatura, kJ y opacidad 1e-9.
- **pH:** solo absoluta, 1e-6.
- **Colores:** ±1 por canal. `toHex` redondea la mitad hacia arriba y hay canales en ,5 exacto.
- **Exacto:** cadenas, enumeraciones, booleanos, `null` frente a número, presencia de `gas` y `solid`, número y orden de eventos, e ids de las listas.
- **Sólidos y disueltos:** van de mayor a menor. Si salen en otro orden que en los vectores, se acepta cuando la lista obtenida está bien ordenada (a igualdad exacta manda el orden de las especies) y cada elemento coincide con el de su mismo id. Dos valores que empatan en Node pueden diferir en el último bit en otra implementación.
- **Tablas:** los números que el porte copia del JSON (Ksp, coeficientes, ΔHf, cargas, concentraciones, rangos, vigor) deben ser el mismo `double`, sin tolerancia.

**Comprobada con un segundo motor (12 de noviembre de 2026):** el mismo código ejecutado con bun 1.3.14 (JavaScriptCore, otra implementación de `exp`, `log` y `pow`) difiere de Node 24.20 en 678 de 63 004 números, con un error relativo máximo de 4,3e-12 y ninguna cadena distinta. Con esta regla pasan los 1 452 casos. Es un indicio de que la tolerancia es holgada, no una garantía para MSVC.

### Marcas de fragilidad

Un paso lleva `flags` cuando un resultado discreto depende del último bit; el comparador puede relajar solo esa comprobación.

| Marca | Qué puede cambiar | Pasos |
| --- | --- | --- |
| `orden-disueltos`, `orden-solidos` | El orden de dos elementos casi empatados. Informativa: el comparador ya acepta cualquier lista bien ordenada | 3 y 2 |
| `nota-redondeo-ph` | El decimal del «pH ≈ x,x» de la nota | 2 |
| `error-redondeo-ml` | Los mL redondeados del mensaje de desborde | 1 |
| `desborde-suma` | Aceptar o rechazar a un bit de 500 mL | 1 |
| `umbral-evento`, `umbral-solido`, `umbral-disuelto`, `umbral-amoniaco`, `umbral-almidon`, `umbral-catalizador`, `umbral-gas` | Cruzar un umbral de visibilidad | 0 |

Sin marca quedan el umbral de capa de color (peso 0,005) y los cortes internos de `react()` (1e-13 y 1e-11), que no se ven desde fuera del motor.

## Porte a C++

El módulo `Unreal/Experimenta3D/Source/ExperimentaChem` es la traducción a C++ estándar. `Golden.cpp` es el gemelo de `lib/compare.ts` y ejecuta estos mismos vectores.

```sh
node golden/gen-cpp-tables.mjs                             # regenera las tablas C++ tras npm run golden
powershell -File native/ExperimentaChem/build.ps1 -Clean   # compila fuera de Unreal y ejecuta los vectores
```

Resultado del 12 de noviembre de 2026 con MSVC 14.52 y `/fp:precise`: 1 452 de 1 452 casos y 0 diferencias de tabla. Ejecutando el TypeScript con bun, cuya biblioteca matemática coincide con la de MSVC, el C++ da resultados idénticos en bits.

## Comportamientos congelados

El porte debe **replicarlos**, no mejorarlos. Si alguno se corrige en TypeScript, hay que regenerar los vectores.

1. **`react()` se corta a 120 pasadas sin converger** cuando dos equilibrios comparten un ion (familia `noconv`). El resultado depende de la trayectoria: tres adiciones de 1 mL de agua no dan lo mismo que una de 3 mL, y una gota inerte puede reanudar una reacción.
2. **Las reglas van por orden de lista**, no por termodinámica: un precipitado más soluble puede ganar a otro menos soluble (familia `prioridad`).
3. **Las reglas solo ven H⁺ y OH⁻ explícitos**, no el pH calculado: una disolución de FeCl₃ a pH 2 no ataca al mármol.
4. **El matraz puede pasar de 500 mL** por el agua de una neutralización, y desde ahí rechaza cualquier adición, incluidos los sólidos.
5. **La temperatura tiene tope en 100 °C pero no por abajo:** 1 g de NH₄NO₃ disuelto en tres gotas queda a −135,9 °C.
6. **Dos masas molares para el NaHCO₃:** 84,0066 en `reaction.ts` y 84,006 en `formula.ts` (familia `cruzado`).
7. **El pH de HCl 1,0 mol/L sale −4,4e-15**, no 0: el signo de un pH casi nulo no es estable.
8. **Residuos de coma flotante en `crystallization`** (por ejemplo `newCrystals` 3,55e-15 en vez de 0).
9. **Tolerancia de rango de 1e-9** en `addReagent` como igualdad exacta de dobles, y límites estrictos en las funciones de las mesas 01–03.
10. **Los textos con números usan `toLocaleString('es')`** (coma decimal) y `Math.round`; dependen del ICU de Node.

Fuera de los vectores a propósito, por depender de JavaScript: los ids de reactivo que son claves heredadas de `Object` (`'constructor'`, `'toString'`…), que `addReagent` acepta como si fueran agua.

## Ramas que ningún caso alcanza

Comprobado con búsquedas dirigidas, no son alcanzables con cantidades válidas: la precipitación de NaHCO₃(s) y NH₄NO₃(s), un evento visible de redisolución de AgI o Fe(OH)₃ por su regla Ksp, el recorte del agua a 0, el corte de `logQ` con una cantidad positiva ≤ 1e-300, tres gases en un mismo paso y una nota de indicador con pH negativo.

## Añadir casos

Crea o edita un archivo en `families/` siguiendo `_ejemplo.ts` y `lib/types.ts`, y añádelo a `families/index.ts`. Usa `ctx.trace(steps)` para preguntar al motor qué hace una secuencia, y `mustFire`, `mustNotFire` y `mustError` para fijar la intención del caso: el exportador falla si el motor no hace lo que el caso dice ejercitar. La única aleatoriedad permitida es `ctx.rng`, `ctx.int` y `ctx.pick`.

---

# Vectores de la capa de estado de la campana

`steps.json` guarda lo que hacen **hoy** las reglas de juego de la campana para 197 secuencias de acciones del jugador (5 208 operaciones, 2,27 MB): el almacén `src/state/hood.ts`, la protección y las manos de `src/state/lab.ts` y los pasos de `recipeSteps()` para las 16 prácticas de `src/experiments/hoodRecipes.ts`. Tiene el mismo doble uso que `chemistry.json`: candado de regresión (`steps.test.ts`, dentro de `npm test` y de `bun test`) y paridad del futuro porte a C++ de la capa de estado.

Igual que con el motor químico, los valores son el comportamiento actual con sus rarezas (ver «Comportamientos congelados de la capa de estado»), no el comportamiento deseable.

## Uso

```sh
npm run golden                                    # regenera chemistry.json y steps.json (unos 15 s)
npm run golden:steps                              # solo steps.json (unos 5 s)
STEPS_FAMILY=10-cloruros npm run golden:steps     # ejecuta una familia, imprime cada operación y no escribe nada
STEPS_FAMILY=10-cloruros STEPS_CASE=borde npm run golden:steps   # imprime solo los casos cuyo id contiene «borde»
npm test                                          # incluye los dos candados
```

En PowerShell las variables se ponen antes: `$env:STEPS_FAMILY='10-cloruros'; npm run golden:steps; Remove-Item Env:STEPS_FAMILY`.

El exportador genera todo dos veces y exige un resultado idéntico, al menos 120 casos, menos de 4 MB, que se usen las 25 operaciones del vocabulario, un caso `recorrido/<id>/correcto` por práctica que termine con todos los pasos hechos, que el comparador no vea diferencias entre el documento y él mismo, y que ninguna operación lleve una marca de fragilidad distinta de las de orden.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `steps/families/*.ts` | Solo **entradas**: secuencias de operaciones con el tiempo que avanza en cada una. `index.ts` fija el orden. |
| `steps/lib/types.ts` | Tipos de las entradas: `OpSpec`, `StepCaseSpec` y `Debe` (la intención del caso). |
| `steps/lib/ops.ts` | Constructores de operaciones y secuencias habituales del jugador (`llenarProbeta`, `pesar`, `gotas`, `addAll`…). Solo producen entradas. |
| `steps/lib/harness.ts` | Reloj controlado, ejecución de cada operación contra los almacenes reales (`useHood`, `useLab`) y captura del estado en forma canónica. No contiene reglas de juego propias. Reutiliza `canonMixture`, `canonAnalysis`, `canonEvent`, `recordTexts` y `stepFlags` de `lib/harness.ts`. |
| `steps/lib/build.ts` | Une las familias, construye las tablas y serializa (una línea por operación, LF). |
| `steps/lib/compare.ts` | Comparador de referencia: reconstruye el estado completo tras cada operación y lo compara. Modelo para el del porte. |
| `steps/export.steps.ts` | El exportador que lanzan `npm run golden` y `npm run golden:steps`. |
| `steps.test.ts` | El candado. |

Las familias: `10-cloruros` (32 casos: la «Prueba de cloruros» con todo detalle), `20-recorridos` (16: cada práctica de principio a fin por el camino correcto), `30-herramientas` (53: reglas de cada herramienta, casi todas sin práctica elegida), `40-errores` (64: cuatro variantes con errores del jugador por práctica) y `50-bordes` (32: el umbral del 90 % de cada cantidad, justo y una división por debajo). La única aleatoriedad es la de `ctx.int` en `40-errores` (el exceso entre el 110 % y el 150 %), con la misma semilla `20261111` y mulberry32; la secuencia de cada familia sale de `steps/<nombre del archivo>`.

## Formato de `steps.json`

- `initial`: el estado observable completo del que parten **todos** los casos: sesión libre recién iniciada (`lab.start('free')` con el tutorial ya visto), sin protección, todo en el estante, cuadernos vacíos y reloj a 0.
- `tables.constants`: las constantes que `hood.ts` exporta (`HOOD_TRAY_SLOTS`, `POUR_MS`, `CYLINDER_ML`, `CYLINDER_RATE`, `STREAM`) más `VESSEL_ML` y seis valores de `spatulaRate(segundos)`.
- `tables.reagentIds`: el orden del estante. Es el orden de `places` y de `recipe.added`, y decide qué frasco «sostiene» una mano si llegara a tener dos.
- `tables.stepTexts`: por práctica, `key`, `title` y `detail` de cada paso. Son fijos para cada práctica (el arnés falla si no lo fueran), así que los casos no los repiten.
- `tables.eventTexts`: título, nota y ecuación de los 24 eventos que aparecen en algún registro, como en `chemistry.json`.
- `cases[]`: `id` (`familia/nombre`), `family`, `why` y `ops[]`. Cada operación:
  - `op`, `args`: la operación del vocabulario y sus argumentos (entrada).
  - `avanzaMs`: milisegundos que avanza el reloj **después** de ejecutarla (entrada; se omite si es 0). En `tic`, después de cada repetición.
  - `t`: el reloj al terminar la operación, en ms desde el inicio del caso.
  - `devuelve`: lo que devolvió la acción, si devuelve algo (`true`/`false` o un texto).
  - `flags`: marcas de fragilidad, si las hay (solo aparece `orden-disueltos`, en una operación).
  - `cambia`: las claves del estado observable cuyo valor cambia respecto a la operación anterior, con su valor **nuevo completo**. Una clave ausente no ha cambiado. La única excepción es `log`, que va como `{ caen, quedan, nuevas }`: del registro anterior se quitan `caen` entradas del principio, se conservan las `quedan` siguientes y se añaden las `nuevas` (así una entrada nueva, una gota que se funde con la anterior y el tope de 40 ocupan lo mismo). `applyChanges` y `replay` de `steps/lib/compare.ts` reconstruyen el estado completo.
- `generator` y `stats` son informativos (`stats.hoodErrors` y `stats.labMessages` listan los errores y mensajes distintos que aparecen); el candado compara `schemaVersion`, `seed`, `tables`, `initial` y `cases`.

### Estado observable

| Clave | Contenido |
| --- | --- |
| `mode`, `hand`, `ppe`, `message`, `panel`, `activePractice`, `locations` | De `useLab`: modo de sesión, mano activa, gafas y guantes, el mensaje que muestra el HUD, panel abierto, práctica activa y dónde están el vaso y los dos frascos de la práctica 01 (comparten las manos con los frascos de la campana). |
| `places` | Pares `[reactivo, lugar]` de los frascos que **no** están en el estante (`left`, `right` o `hood`), en el orden del estante. |
| `held` | Lo que devuelve `heldIn('left')` y `heldIn('right')`. |
| `cylinder`, `balance` | Probeta (`reagent`, `ml`, `dirty`) y balanza (`reagent`, `grams`), sin redondear. |
| `pouring` | Vertido en curso: `reagent`, `amount`, `startedAt`, `stream` y `target` (`null` en el vertido directo). |
| `transfer` | Transferencia animada en curso: `kind` (`cylinder`, `balance`, `waste`, `rinse`), `reagent` y `startedAt`. |
| `sash`, `light`, `fan`, `stirring` | Ventana y mandos. |
| `error` | El último mensaje de error de la campana. Es pegajoso: solo lo borran las acciones que empiezan bien. |
| `disposals` | Contador de desechos. |
| `mixture`, `analysis` | La mezcla y su análisis en la forma canónica de `chemistry.json`; `mixture` lleva además `additions` (reactivo y cantidad, en orden). |
| `log` | Registro de adiciones: `reagent`, `amount`, `events` (forma canónica), `deltaT` y `note`. Sin `id` ni `at`. |
| `burst` | Lo que decide el almacén sobre la última ráfaga visual (`gasMol`, `vigor`, `solidColor`, `deltaT`, `colorChange`), sin su instante. |
| `recipe` | Práctica en curso: `id`, `cleanNeeded`, `added` (pares `[reactivo, cantidad]` en el orden del estante), `observed`, `saved`, `disposed`. |
| `saved` | Si la mezcla actual está guardada (`savedAt !== null`). |
| `records` | Cuaderno de la campana: `count` y `last` (adiciones, pH, temperatura, volumen, sólidos, gases y títulos y ecuaciones del registro), sin `id`, fecha ni anotación. |
| `guidedIndex` | `hoodGuidedIndex()`: la pista de mezcla libre, de 0 a 3. |
| `steps` | `recipeSteps()` con la protección de ese momento: lista de `[key, done, [[idObjetivo, etiqueta], …]]`, o `null` si no hay práctica. Título y detalle están en `tables.stepTexts`. |

## Vocabulario de operaciones

Cada operación llama a **una** acción real. Las seis primeras son de `useLab` (lo que hace el jugador con las teclas); el resto, de `useHood`.

| Operación | Argumentos | Acción real | Devuelve |
| --- | --- | --- | --- |
| `iniciar` | `modo`: `free`, `guided`, `tutorial` | `lab.start(modo)` (que llama a `hood.resetSession()`) | — |
| `menu` | — | `lab.menu()` (que llama a `hood.cancelPour()`) | — |
| `mano` | `mano`: `left`, `right` | `lab.selectHand(mano)` (teclas 1 y 2) | — |
| `usar` | `objetivo`: id del objeto apuntado o `null` | `lab.setTarget(objetivo)` y `lab.interact()` (tecla E) | — |
| `dejar` | `objetivo` | `lab.setTarget(objetivo)` y `lab.drop()` (tecla Q) | — |
| `cerrarPanel` | — | `lab.open(null)` | — |
| `receta` | `id`: práctica, `null` o `no-existe` | `hood.selectRecipe(id)` | — |
| `ventana` | `posicion`: `closed`, `work`, `open` | `hood.setSash(posicion)` (botones del panel) | — |
| `conmutar` | `clave`: `light`, `fan`, `stirring` | `hood.toggle(clave)` | — |
| `verter` | `reactivo`, `cantidad` | `hood.pour(reactivo, cantidad)`: vertido directo | booleano |
| `chorro` | `reactivo`, `destino` opcional: `flask`, `cylinder`, `balance` | `hood.startStream(reactivo, destino)`: empieza a mantener el clic | booleano |
| `tic` | `segundos`, `veces` opcional (1) | `hood.streamTick(segundos)`, `veces` veces: un fotograma con el clic mantenido | — |
| `soltar` | — | `hood.stopStream()` | — |
| `verterProbeta` | — | `hood.pourCylinder()` | booleano |
| `verterBalanza` | — | `hood.pourBalance()` | booleano |
| `enjuagar` | — | `hood.rinseCylinder()` | booleano |
| `desechar` | — | `hood.dispose()` | booleano |
| `vaciar` | — | `hood.empty()` | — |
| `guardar` | — | `hood.save()` | — |
| `devolverBandeja` | — | `hood.returnAll()` | — |
| `reiniciar` | — | `hood.resetSession()` | — |
| `cancelar` | — | `hood.cancelPour()` | — |
| `cogerFrasco` | `reactivo`, `mano` | `hood.pick(reactivo, mano)`, sin pasar por la tecla E | texto |
| `ponerFrasco` | `mano`, `donde`: `shelf`, `hood` | `hood.put(mano, donde)`, sin pasar por la tecla Q | texto |
| `esperar` | — | Ninguna: solo avanza el reloj | — |

Objetivos que usan los casos con `usar` y `dejar`: `ppe-goggles`, `ppe-gloves`, `reagent:<id>`, `reagent-shelf`, `recipe-board`, `hood`, `hood-sash`, `hood-cylinder`, `hood-balance`, `hood-washbottle`, `hood-waste`, `hood-flask` (sin acción propia), `beaker`, `shelf`, `bench` y `null`. E sobre la probeta, la balanza, la piseta y los residuos llama a `pourCylinder`, `pourBalance`, `rinseCylinder` y `dispose` y pone en `message` su texto o el `error` de la campana.

### El tiempo es una entrada

`hood.ts` lee `Date.now()` y usa `setTimeout`. El arnés los sustituye por un reloj propio (no depende de los temporizadores falsos de Vitest, así que vale igual con bun) que empieza en 0 en cada caso:

1. La operación se ejecuta con el reloj parado en el `t` de la operación anterior.
2. Después el reloj avanza `avanzaMs`. Los temporizadores que vencen en ese tramo se ejecutan por orden de vencimiento, cada uno con el reloj puesto en su instante exacto.
3. Se captura el estado y se anota `t`.

En `tic` con `veces`, los pasos 1 y 2 se repiten por cada fotograma y el estado se captura al final. `tic` recibe **dos** tiempos distintos, igual que el almacén: `segundos` (lo que dura el fotograma, que decide el caudal) y el reloj (que decide la inclinación de 300 ms y la aceleración de la espátula). Los casos usan fotogramas de 100, 50, 20 y 16 ms y también fotogramas largos únicos para dejar cantidades exactas.

Duraciones que los casos fijan: los 1 500 ms de `POUR_MS` para el vertido directo y las transferencias de probeta, balanza y residuos, y dos literales que `hood.ts` no exporta: 900 ms del enjuague y 300 ms de inclinación antes de que caiga nada.

## Comparación para el porte

- **Exacto:** textos, booleanos, enumeraciones, listas, `t`, `startedAt`, contadores y todo lo que la capa de estado calcula con aritmética de `double`: `cylinder.ml`, `balance.grams`, `pouring.amount`, las cantidades de `mixture.additions`, `log`, `recipe.added` y `records`, y las constantes de `tables.constants`. Son sumas, productos y `Math.round` sin funciones trascendentes: una implementación IEEE 754 que haga las mismas operaciones en el mismo orden da los mismos bits. No se debe fundir `ml + caudal · segundos` en una operación FMA.
- **Con la tolerancia de `chemistry.json`** (relativa 1e-6 con suelo, pH absoluto, color ±1, listas de sólidos y disueltos bien ordenadas): lo que sale del motor químico, es decir `mixture` (salvo `additions`), `analysis`, los `events` y `deltaT` del registro, `burst` y los números de `records.last`.
- Se comparan **estados completos** reconstruidos, no los `cambia`: así una clave que cambia en el último bit en una implementación y no en la otra no descuadra nada.
- `compareSteps(esperado, obtenido, omit)` admite una lista de claves del estado que la otra implementación decide no reproducir. Candidatas razonables para el porte: `burst` (solo alimenta efectos visuales) y `locations`, `panel` y `activePractice` (del laboratorio web). Qué claves se omiten es una decisión pendiente del usuario.
- **Marcas de fragilidad:** el arnés calcula las marcas del motor químico para cada adición que llega al matraz (también dentro de un `tic` de varios fotogramas) y las de desborde para cada rechazo. El exportador falla si aparece alguna que no sea de orden, así que ningún resultado discreto de `steps.json` (que haya o no un evento, el decimal del «pH ≈» de una nota, aceptar o rechazar al borde de 500 mL) depende del último bit. La única marca presente es `orden-disueltos` en `errores/cobre-azul/herramienta-equivocada-sin-enjuagar-exceso`, que el comparador ya resuelve.

Con bun 1.3.14 el candado pasa con esta regla (12 de noviembre de 2026). Se comprobó que falla, con Node y con bun, al alterar en el archivo guardado unos mL de la probeta o un mensaje. No hay todavía porte a C++ de esta capa: la regla solo está probada entre Node y bun.

## Alcance

**Dentro**, a través de las acciones reales:

- De `hood.ts`: `heldIn`, `pick`, `put`, `pour`, `startStream`, `streamTick`, `stopStream`, `pourCylinder`, `pourBalance`, `rinseCylinder`, `dispose`, `selectRecipe`, `empty`, `setSash`, `toggleSash` (con E en el tirador), `toggle`, `save`, `returnAll`, `resetSession`, `cancelPour`, la fusión de gotas y de sus eventos, el registro con su tope, `hoodGuidedIndex` y `recipeSteps` (con `amountText` en títulos y etiquetas).
- De `lab.ts`: `start`, `menu`, `selectHand`, `open(null)` y las ramas de `interact` y `drop` que tocan la campana: protección, frascos, tablero, campana, tirador, probeta, balanza, piseta, residuos, el bloqueo durante el tutorial, la mano ocupada compartida con el vaso de la práctica 01 y dónde deja Q un frasco.

**Fuera a propósito:**

| Qué | Por qué |
| --- | --- |
| `localStorage` (`loadRecords`, `saveRecords`, el aviso de tutorial visto) | Almacenamiento, no regla de juego. `loadRecords` solo se ejecuta al importar el módulo. |
| `id` y `at` de las entradas del registro y de los registros del cuaderno, `savedAt` como fecha y `burst.at` | Aleatorios o basados en la hora real. De `savedAt` solo se guarda si es nulo. |
| `annotate` y el campo `observation` | Texto libre del usuario. |
| `recipe.completedAt` | `hood.ts` nunca lo escribe: lo pone un efecto de React en `src/ui/App.tsx` junto con el mensaje «experimento completado». |
| El paso del clic al chorro | Está en `src/world/Player.tsx`: con un frasco en la mano activa, el clic sobre `hood` vierte al matraz, sobre `hood-cylinder` a la probeta y sobre `hood-balance` a la balanza; si `startStream` falla, copia `error` a `message`; pasa a `streamTick` como mucho 0,1 s por fotograma y corta el chorro al dejar de apuntar, abrir un panel o perder el bloqueo del puntero. Los vectores llaman a `startStream` y `streamTick` directamente, también en situaciones que el jugador no puede provocar (chorro desde un frasco de la bandeja, fotogramas de más de 0,1 s). |
| Práctica 01 y mesas 02 y 03 de `lab.ts` (`add`, `reset`, `saveObservation`, `progress`, `guidedIndex`, los pasos del tutorial), y el bloqueo de E y Q mientras se vierte el vinagre | No son de la campana. El vaso solo aparece para ocupar una mano. |
| Paneles de React (`HoodPanel.tsx`): el mensaje «Experimento elegido…» y qué botones están activos | Interfaz. |

**Ramas de `hood.ts` que ningún caso alcanza** (no se pueden ejercitar sin tocar `src/`): los caudales `solution`, `water` y `solid` de `STREAM` (el chorro al matraz solo admite indicadores; quedan en `tables.constants`); la suma de moles de **gas** al fundir eventos (no se encontró ninguna gota de indicador que dé un evento con gas); el máximo de 10 g por defecto de la balanza para un reactivo que no sea sólido; y las guardas de los temporizadores frente a un vertido sustituido por otro.

## Comportamientos congelados de la capa de estado

El porte debe replicarlos mientras no se corrijan en TypeScript (y entonces hay que regenerar). Entre paréntesis, un caso que lo fija.

**Probeta**

1. Se llena a 8 mL/s sumando `ml + 8 · segundos` en coma flotante, hasta 100 mL; al llegar corta el chorro con «La probeta está llena (100 mL).» (`herramientas/probeta/llena`).
2. Al matraz llega la lectura redondeada a 0,1 mL con `Math.round(ml · 10) / 10`: 20,05 → 20,1 y 20,049 → 20,0. El mensaje «Viertes N mL» redondea a entero la lectura anterior al vertido: 17,9 mL dice «Viertes 18 mL» y 4,4 dice «Viertes 4 mL» (`herramientas/probeta/redondeo-a-decimas`).
3. Tres umbrales distintos: hasta 0,05 mL cuenta como vacía (solo quedan restos); entre 0,05 y 1 mL «contiene» el reactivo y bloquea a otro, pero no se puede verter («La probeta está vacía…»); desde 99,95 mL está llena (`herramientas/probeta/menos-de-1-ml`).
4. El desborde del matraz se comprueba con la lectura sin redondear y se vierte la redondeada: puede aceptarse la orden y fallar el motor 1 500 ms después, y entonces la probeta conserva su contenido (`herramientas/probeta/desborde-tras-redondeo`).
5. Los restos solo obligan a enjuagar para medir **otro** reactivo. Enjuagar tira lo que hubiera dentro (`herramientas/probeta/enjuague`).

**Balanza y gotero**

6. La espátula va a `min(1, 0,25 + 0,3 · segundos de clic)` g/s, con los segundos del reloj, y se corta en el máximo del sólido (2 g el magnesio, 10 g los demás). Al matraz llega `Math.round(g · 100) / 100`: 1,005 → 1,00 (porque 1,005 · 100 es 100,49999…) y 2,675 → 2,68 (`herramientas/balanza/redondeo-a-centesimas`).
7. Hacen falta 0,05 g para añadir; con más de 0,001 g de un sólido no se pesa otro; la navecilla acumula pesadas (`herramientas/balanza/rechazos`).
8. El gotero acumula `2 · segundos` y suelta una gota por cada unidad entera. Con fotogramas de 50 ms diez sumas de 0,1 dan 0,9999999999999999 y la primera gota cae en el fotograma 11 (`herramientas/gotero/fotogramas-de-50-ms`).
9. Las gotas de un mismo clic se funden en una entrada del registro y una adición (redondeada a 0,001), que puede pasar de las 10 gotas que el motor admite de una vez. Sus eventos se funden por regla y sentido sumando avance, calor y moles de sólido; un calor desconocido sigue desconocido; ΔT se suma y la nota queda vacía en cuanto hay un evento (`herramientas/gotero/fusion-de-eventos`).

**Ventana, tiempos y bloqueos**

10. La ventana cerrada impide el vertido directo, empezar un chorro y verter la probeta (con dos mensajes distintos), pero no añadir lo pesado, enjuagar, desechar ni guardar. Cerrarla a medio chorro o a media transferencia no corta nada (`herramientas/ventana/cerrada-no-bloquea-todo`, `herramientas/chorro/ventana-y-herramientas-a-medias`).
11. E en el tirador alterna entre trabajo y abierta; desde cerrada sube del todo. La ventana abierta del todo no bloquea nada (`herramientas/ventana/posiciones`).
12. Solo hay una acción con tiempo a la vez (vertido, chorro o transferencia). Las demás devuelven `false` **sin tocar `error`**, así que E sobre una herramienta muestra el error anterior o un mensaje vacío (`herramientas/directo/ocupado`).
13. El efecto de un vertido o una transferencia llega justo a los 1 500 ms (a los 1 499 no); el del enjuague, a los 900. `cancelPour`, `empty` y `resetSession` los anulan sin efecto; tras `cancelPour` la probeta conserva lo medido (`herramientas/directo/cancelar`).
14. Dejar el frasco con Q no corta su chorro, que sigue aunque el frasco vuelva al estante; mientras tanto ese frasco no se puede coger (`herramientas/probeta/soltar-el-frasco-a-medio-chorro`).
15. Con el matraz por encima de 500 mL por el agua de una neutralización, la balanza acepta la orden, el mensaje dice «Añades el sólido…» y el motor lo rechaza al acabar la animación (`herramientas/balanza/matraz-pasado-de-500`).

**Manos, estante y protección**

16. La protección solo se exige para coger frascos (y se comprueba antes que la mano ocupada); la ventana, la piseta, los residuos y los paneles funcionan sin ella (`herramientas/manos/sin-proteccion`).
17. Q deja el frasco en el estante si se apunta a `reagent-shelf` o a un frasco que está en el estante, y en la bandeja si se apunta a cualquier objetivo `hood…` o a un frasco de la bandeja. La bandeja admite 8 (`herramientas/manos/dejar-segun-objetivo`, `herramientas/bandeja/llena`).
18. `pick()` no comprueba si la mano ya lleva un frasco (lo impide `lab.interact`): con dos en la misma mano, `heldIn` devuelve el primero en el orden del estante. Coger siempre dice «Llévalo a la campana», también desde la bandeja (`herramientas/almacen/coger-y-poner-directos`).
19. En modo libre coger un frasco cambia la práctica activa a `hood`; en modo guiado no (`herramientas/manos/modo-guiado`).

**Pasos de las prácticas**

20. Un paso «añadir» queda hecho cuando lo añadido de ese reactivo llega a `cantidad · 0.9` (comparación `>=` entre dobles). No hay tope superior, el orden no se exige y cuenta cualquier vía, también el vertido directo (`bordes/*`, `cloruros/pasarse-de-cantidad`, `cloruros/orden-inverso`).
21. Los objetivos de un paso con probeta se deciden en este orden: medido el 90 % → «E · Verter en el matraz»; probeta vacía con restos de otro reactivo → piseta, aunque el frasco no esté en la mano; frasco en la mano → «Llena hasta…», aunque la probeta esté ocupada por otro reactivo y el almacén se vaya a negar; si no → el frasco (`cloruros/probeta-ocupada-por-otro-reactivo`).
22. «Reúne los reactivos» está hecho cuando ningún frasco necesario está en el estante con menos del 90 % añadido; devolver un frasco antes de usarlo lo deshace (`cloruros/frascos-estante-mano-bandeja`).
23. `observed` es pegajoso y solo se evalúa al llegar una adición, mirando el registro entero: una reacción registrada antes de elegir la práctica lo marca con la siguiente gota de cualquier cosa (`cloruros/observado-por-registro-anterior`).
24. Elegir una práctica con el matraz usado añade el paso `clean`. Lo añadido mientras tanto cuenta hasta que se desecha: ese desecho borra `added` y `observed`, conserva `saved` y no cuenta como `disposed` (`cloruros/matraz-sucio-al-elegir`, `cloruros/guardar-antes-de-limpiar`).
25. Desechar antes de observar no marca `disposed` pero conserva `added`: los pasos «añadir» siguen hechos con el matraz vacío y, como el registro se ha borrado, la práctica se atasca en `observe` hasta volver a elegirla (`cloruros/desechar-a-medias`).
26. `save` queda hecho con cualquier guardado desde que se eligió la práctica, y también al desechar tras observar: el cuaderno se puede saltar (`cloruros/desechar-sin-guardar`, `cloruros/guardar-antes-de-observar`).
27. `empty()` no toca la práctica: con `clean` pendiente la deja atascada, porque desechar un matraz vacío se niega. Ningún componente de `src/` llama hoy a `empty()` (`herramientas/vaciar/reglas`).
28. Elegir la práctica durante un vertido no pide limpiar, porque el matraz todavía está vacío. Un id desconocido equivale a abandonar (`cloruros/elegir-durante-el-vertido`, `herramientas/practica/desconocida`).

**Registro y cuaderno**

29. El registro guarda 40 entradas y el cuaderno de la campana 30 registros. `disposals` cuenta también los `empty()` con el matraz vacío (`herramientas/registro/tope-de-40`, `herramientas/guardar/tope-de-30`).
30. La ráfaga conserva la anterior si la nueva adición llega a menos de 1 500 ms y no da gas ni sólido; en un chorro hereda el 80 % del gas (si la anterior tiene menos de 2 000 ms) y el 90 % del vigor (`herramientas/gotero/rafaga-heredada`).

### Lo que depende de JavaScript

- `Math.round` redondea la mitad hacia +∞; para los valores positivos de la capa de estado coincide con `std::round`, pero no con `floor(x + 0.5)` en todos los dobles.
- `amountText` usa `toLocaleString('es', { maximumFractionDigits: 2 })`: coma decimal y hasta dos decimales sin ceros de relleno («0,3 g», «20 mL»).
- El orden de las claves de `places` y `added` es el de inserción en JavaScript; los vectores los dan en el orden del estante. El orden de los objetivos de `collect` es el de los pasos de la receta sin repetir.
- El contador de ids del registro y el estado del chorro (`pending`, entrada y adición que se están fundiendo) son variables del módulo, no del almacén: `resetSession` no los reinicia, aunque `startStream` sí reinicia el chorro.

## Añadir casos de la capa de estado

Crea o edita un archivo en `steps/families/` y añádelo a `steps/families/index.ts`. Compón las secuencias con `steps/lib/ops.ts` y usa `debe` en las operaciones clave para fijar la intención (valor devuelto, fragmento del error o del mensaje, paso actual, objetivos, pasos hechos y pendientes): el exportador falla si el almacén no hace lo que el caso dice ejercitar. `debe` no se exporta. Imprime el caso con `STEPS_FAMILY` y `STEPS_CASE` antes de regenerar y comprueba que el `why` describe lo que de verdad ocurre.
