# Experimenta 3D · laboratorio web

Laboratorio de química completo para el navegador, hecho con Three.js y luz horneada en Blender para que se vea
realista y vaya fluido en PC modestos. Nació como rehacer web del juego de Unreal «Prueba de cloruros» y el 19 de
noviembre de 2026 se amplió, a petición del usuario, a un laboratorio grande con misiones y mezcla libre. El proyecto
de Unreal (`../Unreal/`) no se toca. La carpeta conserva el nombre `web-campana/`.

## Cómo se ejecuta

Desde la raíz del repositorio (Node.js 22.12+ o 24, `npm install` ya hecho):

```sh
npm run campana:dev       # http://127.0.0.1:5180/
npm run campana:build     # compila en web-campana/dist/ (rutas relativas: se puede servir desde cualquier carpeta)
npm run campana:preview   # sirve dist/ en http://127.0.0.1:5181/
```

Controles: WASD caminar, Mayús correr, ratón mirar, **E** o **clic** usar, **mantener el clic** con un frasco en la
mano para verter (probeta, balanza o matraz), **Q** dejar, **1 / 2** mano, **M** misiones, **N** anotar, **clic
derecho** mirar de cerca, **Esc** pausa (calidad Baja / Media / Alta). Parámetros de URL: `?calidad=baja|media|alta`,
`?exposicion=…`, `?recorrido=<misión>[,<misión>]` o `?recorrido=todas` (juega solo y mide los FPS).

## Qué hay en el laboratorio

Diseño propio de 12 × 9 × 3,2 m (no es réplica de ningún laboratorio real):

- **Campana de extracción** con matraz de 500 mL, probeta de 100 mL, balanza con navecilla, piseta y bandeja de 8 frascos.
- **Estantería de reactivos** con los 27 del modelo: frascos de 500 mL (ámbar los fotosensibles), tarros de sólidos y
  goteros de indicadores, todos rotulados.
- **Cuatro mesetas centrales** de granito con torretas de gas (llaves amarillas) y **ocho mecheros Bunsen** que se
  encienden y apagan.
- **Banco con dos lavabos** cuyos grifos se abren, **ducha de emergencia con lavaojos** señalizada en verde sobre su
  zona marcada en el suelo, **dos aires acondicionados** de pared, extintor, salida y estación de gafas y guantes.
- **Estantes de material** y mesetas con vasos, matraces, probetas, aforados, embudos, morteros, vidrios de reloj y
  gradillas con tubos de ensayo.

**Funcional** (con modelo químico): campana, reactivos, probeta, balanza, piseta, residuos, protección y tablero.
**Ambiental** (se ve o se acciona, sin química): mecheros (la llama todavía no calienta mezclas), grifos, ducha,
extintor, aire acondicionado y el material expuesto. El juego lo dice al apuntar o al usarlos.

## Misiones y mezcla libre

El tablero del fondo (o la tecla M) abre las **16 misiones**, que son las prácticas guiadas de
`../src/experiments/hoodRecipes.ts`: cada una pide la herramienta real de cada paso (probeta para disoluciones,
balanza para sólidos, gotero para indicadores), se da por observada solo cuando el motor dispara sus reglas, y
termina anotando y desechando en residuos. La **mezcla libre** es la misma capa sin misión: cualquier combinación de
los 27 reactivos, con el aviso de «sin cambios según el modelo» cuando no hay regla. En ambos modos una tarjeta
muestra lo que acaba de ocurrir (título, ecuación, nota, cambio de temperatura) y la pantalla del matraz el volumen,
la temperatura, el pH, los sólidos y los gases. El matraz enseña el color de la disolución, el precipitado (nube que
sedimenta, con el color del sólido) y burbujas cuando se libera gas.

## Qué se reutiliza

| Del proyecto | Cómo |
| --- | --- |
| Lógica de la campana y motor químico (`../src/state/hood.ts`, `lab.ts`, `../src/chemistry/`, `hoodRecipes.ts`) | Se importan tal cual: son los 197/197 casos validados de `golden/steps.json`. `src/partida.ts` solo traduce acciones, igual que `FExpPartida` en Unreal. Aquí no hay química. |
| Modelos (`../art/export/*.glb`, de los guiones de `art/blender/`) | Campana, guillotina, encimera, gabinete (repetido en los bancos), frascos, tarros, goteros, matraces, probetas, vasos, mechero, grifo, manos… |
| Perfiles interiores (`../art/export/perfiles_interiores.json`) | Nivel exacto del líquido por volumen (`src/liquido.ts`), como `ULiquidoComponent`. |
| Texturas CC0 (`../art/terceros/`, Poly Haven y ambientCG) y HDRI `quadrangle_sunny` | `art/blender/web_texturas.py` las prepara a 1024 px. Sin descargas nuevas. |
| Precipitado (`UMezclaComponent`) | Misma regla: nube que sedimenta con τ = 10 s, densidad aparente 0,1 g/mL, turbidez 1 − e^(−250·g/mL). |

## Luz horneada (equivalente a Lightmass)

`art/blender/web_laboratorio_hornear.py` monta el laboratorio en Blender y hornea con Cycles la irradiancia difusa
(directa + indirecta) de cada malla estática en su UV de mapa de luz: cielo y sol del HDRI CC0 girado para que el sol
entre por las tres ventanas, un sol direccional que completa los 45 klx, doce paneles LED de 4000 lm y la luminaria
de la campana. Unidades físicas de Blender (1 W ≈ 683 lm).

```sh
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup -P art/blender/web_laboratorio_hornear.py -- --muestras 256
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup -P art/blender/web_texturas.py
```

Con `--rapido` sale en menos de un minuto (ruidoso, para revisar la distribución). Salidas en `public/escena/`
(`sala.glb`, `lm/*.hdr`, `escena.json`) y `public/texturas/`. En la web cada material estático multiplica su textura
por el mapa de luz; los reflejos salen de una captura del propio laboratorio al cargar, atenuados donde el mapa de
luz es oscuro, y no hay ninguna luz en tiempo real. Los objetos móviles los ilumina esa captura y llevan una sombra
de contacto suave. Tono AgX con exposición fija; viñeta y grano en CSS.

## Pruebas

Con el servidor en marcha (Edge sin ventana usa la GPU real con ANGLE D3D11):

```sh
MISIONES=todas node web-campana/tests/recorrido.mjs    # o MISIONES=volcan,lluvia-oro; CALIDAD=baja|media|alta
node web-campana/tests/teclado.mjs                      # entrada real: captura del puntero, W, E, M, ratón, pausa
node web-campana/tests/captura.mjs "calidad=alta" nombre "x,z,tx,ty,tz"   # vistas fijas
```

Los resultados de la última comprobación están en `docs/PROJECT_CONTEXT.md` (sección del 19 de noviembre de 2026).

## Límites conocidos

- Las mezclas se hacen solo en la campana (un matraz); las mesetas, los mecheros y los lavabos son ambientales.
- La guillotina no se mueve; las tapas son visuales; no hay sonido, dedos articulados ni cuaderno visible (N guarda la
  observación en el almacenamiento de la web, `experimenta.hood.v1`).
- Los objetos móviles no proyectan sombra real y el vidrio es una aproximación barata (Fresnel sin refracción),
  elegida por rendimiento.
- Los mapas de luz van en HDR sin comprimir; `dist/` se puede reducir si se publica.
