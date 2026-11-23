# Experimenta 3D · Especificación para rehacerlo con gráficos ultrarrealistas

Fecha: 11 de noviembre de 2026. Documento de planificación: describe **qué** construir y **cómo verificarlo**. Sustituye la parte visual y de motor del prototipo web, pero **conserva** su modelo químico, sus prácticas y sus decisiones de producto.

---

## 1. Objetivo

Rehacer Experimenta 3D como una **aplicación de escritorio para Windows** con un nivel visual **fotorrealista**, comparable al de los juegos en primera persona más realistas de 2025–2026, manteniendo lo que ya funciona:

- Laboratorio de química en primera persona, en español, sin identidad institucional.
- Procedimiento real: protección, probeta, balanza, gotero, piseta y residuos.
- Modelo químico propio, verificable y probado (estequiometría, Ksp, pH, calor, potenciales).
- Prácticas guiadas con flechas y lista de pasos; mezclas libres; cuaderno; tabla periódica.

**Criterio de éxito visual:** una captura del juego, sin interfaz, debe poder confundirse a primera vista con una fotografía de un laboratorio real (las fotos de `Images/` sirven de comparación).

---

## 2. Referencias de estilo (privadas, en `Images/estilo/`, ignoradas por Git)

| Archivo | Qué tomar | Qué **no** tomar |
| --- | --- | --- |
| `ref-1-fps-fotorrealista-salon.webp`, `ref-2-fps-fotorrealista-oficina.png` | Nivel de fotorrealismo: escaneos fotogramétricos, materiales con desgaste, luz rebotada natural, sombras suaves, desorden creíble, manos enguantadas con detalle y poses naturales, cámara que se siente física. | El efecto de cámara corporal con ojo de pez, su interfaz, sus logotipos, armas, personajes o escenarios. |
| `ref-3-tienda-alquimia-mostrador.webp`, `ref-4-tienda-alquimia-sala.webp` | Líquidos de colores vivos que brillan con la luz, mesa de trabajo cargada de objetos, balanza y gradilla protagonistas, mano que señala lo siguiente, barra de inventario con cantidades. | La fantasía (velas, magos, pociones inventadas), su estética, nombres o personajes. Aquí los colores salen de reacciones reales. |
| `ref-5-laboratorio-virtual-guiado.webp` | Panel de tarea con el paso actual y el progreso, mano con guante de nitrilo azul, equipos que se pueden recoger, laboratorio luminoso. | Su marca, su arquitectura de ciencia ficción o su interfaz exacta. |
| `Images/*.jpg` (22 fotos del laboratorio real) | Granito tipo azul perla pulido, gabinetes blancos, fregaderos cuadrados con grifo de cuello de cisne, ventanas de aluminio, tomacorrientes, balanzas, estufa, probetas, frascos ámbar y blancos, puerta de vidrio. | Rótulos institucionales, textos de prácticas, personas y marcas. La **distribución sigue siendo propia** (no es una réplica del aula). |

> Las referencias marcan **nivel de calidad y técnica**. El producto debe tener identidad propia: no es una recreación de ningún juego existente.

### Qué hace que esas imágenes parezcan reales

1. **Geometría y texturas escaneadas** (fotogrametría), no primitivas: bordes redondeados, imperfecciones, suciedad leve.
2. **Iluminación global**: la luz rebota en paredes y suelo; las esquinas y los objetos apoyados se oscurecen de forma natural.
3. **Materiales físicos** con rugosidad variable: el granito brilla distinto donde se ha limpiado, el acero tiene marcas, el plástico envejece.
4. **Densidad de objetos**: frascos, papeles, rollos, cables, enchufes, etiquetas. Un espacio vacío delata lo sintético.
5. **Cámara física**: exposición estable, profundidad de campo mínima en primer plano, grano fino, ligera aberración en los bordes, desenfoque de movimiento sutil.
6. **Manos creíbles**: dedos que se cierran sobre el objeto, peso al levantarlo, guantes con arrugas.
7. **Sonido** coherente: zumbido de la campana, tintineo de vidrio, líquido que cae, pitido de la balanza.

---

## 3. Decisión de motor

| | **Unreal Engine 5** (recomendado) | Unity HDRP | Web (Three.js / WebGPU) |
| --- | --- | --- | --- |
| Fotorrealismo alcanzable | Máximo: iluminación global en tiempo real (Lumen), geometría masiva (Nanite), sombras virtuales, materiales físicos | Alto, con más trabajo manual | Medio-alto con luz horneada; no llega al nivel de las referencias 1–2 |
| Líquidos y efectos | Niagara (partículas, chorros, espuma, vapor) | VFX Graph | Manual |
| Manos y animación | Control Rig, IK, poses de agarre | Animation Rigging | Manual |
| Distribución | Escritorio Windows (instalador) | Escritorio | Navegador y Electron |
| Hardware necesario | GPU dedicada para Lumen; modo reducido para equipos modestos | Similar | Funciona en GPU integrada |
| Reutiliza el código actual | Se porta el motor químico a C++ con vectores de prueba | Se porta a C# | Se reutiliza tal cual |

**Recomendación:** Unreal Engine 5, versión estable más reciente, proyecto C++ + Blueprints. Mantener la versión web actual como edición ligera y como referencia funcional.

**Plan B (si no hay GPU dedicada o se quiere seguir en navegador):** Three.js con renderizador WebGPU, modelos glTF escaneados (comprimidos con KTX2/Meshopt), iluminación horneada en Blender Cycles, mapas HDRI y sondas de luz. Es realista al estilo de una visualización arquitectónica, pero no alcanza las referencias 1–2.

### Hardware (importante)

- El equipo actual tiene **GPU Intel integrada**: sirve para la versión web, pero **no para desarrollar ni jugar** la versión UE5 con Lumen a buen ritmo.
- **Desarrollo recomendado:** GPU dedicada de gama media o superior con ≥ 8–12 GB de VRAM, 32 GB de RAM y SSD con ≥ 100 GB libres.
- **Objetivo de jugador:**
  - Calidad Épica a 60 FPS en GPU de gama media.
  - Calidad Baja a ≥ 30 FPS en GPU integrada moderna, con Lumen desactivado e iluminación horneada.
  - Activar escalado temporal (TSR) y los plugins de escalado de cada fabricante (DLSS, FSR, XeSS).

---

## 4. Qué se conserva del proyecto actual

| Origen (web) | Destino (UE5) | Cómo |
| --- | --- | --- |
| `src/chemistry/` (especies, constantes, reactivos, `sandbox.ts`, `formula.ts`, `solutions.ts`, `reaction.ts`) | Módulo C++ `ExperimentaChem`, sin dependencias de motor gráfico | Traducción línea a línea. Paridad comprobada con **vectores de referencia** (golden) exportados desde las pruebas de TypeScript. |
| `src/experiments/hoodRecipes.ts` (16 prácticas) y `catalog.ts` | Data Assets / DataTables | Mismos identificadores; misma prueba: cada receta debe activar sus reglas. |
| `src/state/hood.ts` (`recipeSteps`, probeta, balanza, residuos, protección) | Subsistema C++ del juego | Misma lógica de pasos y criterios (90 % de la cantidad = paso hecho). |
| `docs/` (modelos, fuentes, límites, decisiones del usuario) | Se mantiene | Las fuentes de datos (OpenStax, CRC, NIST) siguen siendo las mismas. |
| Pruebas Vitest | Automation Tests de Unreal | Mismos casos y nombres. |

**Fase 0, obligatoria:** exportar desde la versión web un archivo `golden/chemistry.json` con ≥ 200 casos (las 16 prácticas, mezclas aleatorias deterministas, pH, calor, Ksp, desbordes y errores). La versión C++ debe reproducirlos con tolerancia relativa ≤ 1e-6.

---

## 5. Dirección de arte

### 5.1 Espacio

- Sala propia de unos 12 × 10 m y 3,4 m de altura, inspirada en las fotos: tres islas de esquinas recortadas con pedestal oscuro, encimeras perimetrales bajo ventanas, campana extractora, estantería de reactivos, estación de protección, lavaojos y ducha de emergencia, puerta de vidrio.
- Techo de placas con luminarias LED empotradas y detalles azules; rejillas de aire.
- Exterior visible por las ventanas: patio y edificios con palmeras (contexto caribeño), luz de día.

### 5.2 Iluminación

- Luz cenital LED de 4000–5000 K, uniforme, con sombras suaves; luz de día por las ventanas con sombras proyectadas.
- Iluminación global y reflejos en tiempo real (Lumen) en calidad Alta y Épica; **luz horneada** y reflexiones capturadas en Baja.
- Exposición **fija** calibrada para interiores: nada de adaptación brusca. Luz propia en la campana (se puede encender y apagar).

### 5.3 Materiales (PBR, todos con mapas de rugosidad y normales)

| Superficie | Notas |
| --- | --- |
| Granito azul perla | Grano de 0,5–3 cm con destellos azulados; pulido con barniz; zócalo de 10 cm. |
| Porcelanato del suelo | Placas claras de 60 × 60 cm, brillo con reflejos difusos, juntas con relieve, marcas de uso leves. |
| Laminado blanco | Gabinetes con bisagras metálicas y desgaste en los cantos. |
| Acero inoxidable | Cepillado en fregaderos y campana; cromo en grifería. |
| Vidrio de borosilicato | Refracción, cáusticas sutiles, marcas de graduación en blanco o ámbar. |
| Plásticos | Polietileno blanco translúcido en frascos, polipropileno en tapas y navecillas. |
| Guante de nitrilo azul | Arrugas en los nudillos y brillo satinado. |
| Bata de algodón | Tejido visible y pliegues. |

### 5.4 Objetos (fuentes: escaneos propios con RealityScan, bibliotecas CC0 como Poly Haven, Fab/Megascans con licencia, modelado propio)

- Vidrio: vasos de 50, 100, 250 y 500 mL; Erlenmeyer de 250 y 500 mL; probetas de 10, 50 y 100 mL con base hexagonal; matraces aforados; tubos de ensayo; embudos; vidrio de reloj; pipetas.
- Equipos:
  - Balanza analítica con cortavientos y balanza de triple brazo.
  - Placa agitadora con imán.
  - Estufa de secado.
  - Campana extractora con ventana deslizante y monitor de flujo.
  - Conductímetro, lavaojos y ducha de emergencia.
- Consumibles:
  - Frascos de reactivo ámbar y blancos con etiquetas propias y pictogramas SGA.
  - Pisetas, navecillas, espátulas, papel absorbente y guantes.
  - Recipiente de residuos.
- Ambiente: taburetes, enchufes, dispensadores, carteles propios de seguridad, extintor, papelera, cables.

**Medidas:** usar las dimensiones estándar de catálogo, **verificándolas** con un catálogo de material de laboratorio antes de modelar. Por ejemplo, un vaso de 250 mL tiene unos 7 cm de diámetro y 9,5 cm de altura. La escala real es parte del realismo; la versión web usaba recipientes ampliados.

**Escaneos propios:** el usuario puede fotografiar equipos genéricos de su laboratorio con RealityScan u otra app de fotogrametría para obtener modelos «tal cual». Hay que **eliminar logotipos y marcas** de las texturas.

### 5.5 Cámara y posprocesado

- Campo de visión de 75–85° horizontal (ajustable).
- Lente rectilínea: **sin** efecto de cámara corporal.
- Grano de película fino, viñeta leve, aberración cromática mínima en los bordes y desenfoque de movimiento suave (todo desactivable).
- Profundidad de campo solo en primer plano al inspeccionar un objeto.
- La cámara **no oscila** al caminar (decisión previa de comodidad); el movimiento natural lo ponen las manos.

### 5.6 Sonido

- Ambiente: zumbido del extractor y de las luminarias, aire acondicionado.
- Pasos sobre porcelanato.
- Vidrio que toca granito, tapa que se enrosca, líquido que cae (varía con el caudal), burbujeo y efervescencia.
- Pitido y tara de la balanza, chasquido del interruptor, ventana deslizante.
- Grabaciones propias o bibliotecas con licencia.

---

## 6. Jugador y manos

- **Brazos en primera persona** con bata y guantes (piel visible hasta ponérselos), rig completo de mano con 3 falanges por dedo.
- **Agarre con IK:** cada objeto define su punto y su pose de agarre; los dedos se cierran hasta tocar (con trazado o poses predefinidas por familia: frasco, probeta, matraz, espátula, piseta).
- **Animaciones:**
  - Reposo con respiración.
  - Balanceo al caminar e inercia al girar.
  - Alcanzar y recoger.
  - Inclinar para verter (el ángulo controla el caudal).
  - Desenroscar y enroscar tapas.
  - Presionar la piseta.
  - Teclear en la balanza.
- **Dos manos independientes** (1 / 2), como ahora; objetos con peso: un frasco lleno se mueve más despacio que uno vacío.
- **Protección visible:** gafas (borde en la vista), guantes y bata. Sin protección no se pueden tomar reactivos.

---

## 7. Interacción realista (procedimiento)

| Acción | Control | Detalle |
| --- | --- | --- |
| Usar / recoger | Clic izquierdo o E | Contorno sutil (stencil) en lo que se apunta; aviso con el nombre y las acciones. |
| Dejar | Q | Sobre superficies válidas; el objeto se apoya con física y no atraviesa nada. |
| Destapar o tapar | F | Los frascos se destapan antes de verter; se avisa si se devuelve uno destapado. |
| Verter | Mantener clic sobre el recipiente | El caudal depende de la inclinación (rueda del ratón o tiempo). La probeta se lee a la altura de los ojos: **inspección** con clic derecho acerca la vista a la marca y al menisco. |
| Pesar | Balanza | Colocar navecilla → tarar → añadir con espátula (clic mantenido) → leer la pantalla → verter al matraz. |
| Gotear | Gotero / frasco cuentagotas | Una gota por pulsación o un goteo continuo. |
| Enjuagar | Piseta | Antes de medir otro reactivo con la misma probeta. |
| Desechar | Recipiente de residuos por tipo | Acuosos, metales pesados y orgánicos; elegir mal genera un aviso educativo. |
| Ventana de la campana | Arrastrar el asa | A la altura de trabajo para mezclar; extractor obligatorio con gases. |

Errores realistas con consecuencias **educativas**, nunca gore:

- Salpicadura sin gafas: aviso y lavaojos.
- Verter muy rápido: salpica.
- Desbordar el matraz: derrame que hay que limpiar con papel.

---

## 8. Simulación visual de reacciones (ligada al modelo químico)

El motor químico decide **qué** pasa (moles, pH, sólidos, gases, temperatura); el motor gráfico solo lo **muestra**.

| Fenómeno | Representación |
| --- | --- |
| Líquido en un recipiente | Malla de nivel con superficie que oscila (material con ondas), menisco, color y opacidad del modelo (`solutionColor`). |
| Chorro | Malla de cinta con caudal variable, gotas Niagara al final y pequeñas salpicaduras. |
| Burbujas, efervescencia y espuma | Niagara: el número y tamaño dependen de los moles de gas y del factor de vigor de la regla. |
| Precipitado | Nube que se forma en el punto de mezcla y sedimenta; capa en el fondo proporcional a los gramos y del color de la especie. |
| Cambio de color | Mezcla en ~1–2 s desde el punto de vertido (difusión aparente) y homogénea si el agitador está encendido. |
| Calor | Vapor y condensación si T > 45 °C; termómetro y sonda con lectura del modelo. |
| Metales | Depósito de cobre o plata que crece sobre la pieza (máscara animada). |

Los colores siguen saliendo de `solutionColor` / `indicatorColor` (escalas visuales aproximadas, documentadas). Como en la referencia 3, los líquidos de color deben **brillar con la luz** (translucidez, dispersión), pero **sin emisión inventada**.

---

## 9. Guía e interfaz (UX)

- **HUD mínimo:**
  - Punto de mira.
  - Aviso contextual junto al punto de mira (objeto y acciones).
  - Las dos manos.
  - Panel de tarea arriba a la izquierda, solo en prácticas: paso actual, siguiente y progreso, como la referencia 5.
- **Tablero físico** junto a la campana con las 16 prácticas (pantalla táctil o pizarra) y **flechas doradas / contorno** sobre lo que pide el paso.
- **Mano guía opcional** (como la referencia 3) en la primera práctica: señala el siguiente objeto.
- **Cuaderno** de laboratorio en 3D (libreta física que se abre) con anotaciones y resultados; **tabla periódica** de pared interactiva.
- Interfaz en español; tipografías Manrope y DM Sans (incluidas en el paquete, sin internet); subtítulos; reasignación de teclas; ajustes de calidad, sensibilidad, campo de visión, accesibilidad (alto contraste, reducir efectos).

---

## 10. Contenido

1. Tutorial obligatorio por acciones (movimiento, mirar, recoger, manos, colocar, protección).
2. Prácticas de mesa: vinagre/bicarbonato, conductividad, disolución/cristalización.
3. Campana: 16 prácticas guiadas (`hoodRecipes`) y mezclas libres con los 27 reactivos.
4. Cuaderno (30 registros), tabla periódica (118 elementos, datos PubChem locales).
5. Pendiente aprobado por el usuario para más adelante: calor específico y nuevas prácticas, siempre con modelo verificable.

---

## 11. Arquitectura técnica (UE5)

| Módulo | Tipo | Responsabilidad |
| --- | --- | --- |
| `ExperimentaChem` | C++ puro (sin dependencias de motor gráfico) | Especies, constantes, reactivos, reglas, `AddReagent`, `SolvePH`, `SolutionColor`, `AnalyzeMixture`; pruebas Automation y paridad con los vectores de referencia. |
| `ExperimentaGame` | C++ | Subsistemas de práctica y campana, guardado (`USaveGame`), datos de recetas, interfaz `IInteractable`, componente de agarre. |
| Contenido | Blueprints y Data Assets | Objetos interactivos, poses de agarre, efectos Niagara, materiales, niveles. |
| UI | CommonUI / UMG | HUD, paneles, cuaderno, tabla, ajustes; localización `es`. |
| Herramientas | Python del editor | Importación por lotes, validación de nombres, tamaños y colisiones. |

Repositorio:

- Git con **Git LFS** para binarios (o Perforce si crece el equipo).
- `.uasset` fuera de revisiones de texto.
- Las fotos de referencia **nunca** se suben (siguen en `Images/`, ignorada).

Rendimiento:

- Escalabilidad Baja / Media / Alta / Épica: Lumen activado o desactivado, sombras virtuales o mapas de sombra, porcentaje de resolución, calidad de Niagara.
- Instancias para objetos repetidos.
- Distancias de LOD.
- Presupuesto de 16,6 ms/fotograma en Épica en la GPU objetivo.

---

## 12. Fases y criterios de aceptación (estimación orientativa)

| Fase | Entregable | Aceptación |
| --- | --- | --- |
| **0 · Preparación** | Proyecto UE5, repositorio con LFS, vectores de referencia exportados desde la web, guía de estilo, lista de objetos con licencias. | `golden/chemistry.json` generado; el módulo C++ compila y pasa ≥ 95 % de los casos. |
| **1 · Corte vertical** | Zona de campana fotorrealista con estación de protección, estantería, probeta, balanza, piseta y residuos; manos con agarre; práctica «Prueba de cloruros» completa. | Captura sin interfaz aprobada por el usuario frente a las fotos; 60 FPS en Épica en la GPU objetivo; 100 % de paridad química. |
| **2 · Laboratorio completo** | Sala, islas, encimeras, ventanas, exterior, puerta, sonido ambiente, tutorial y prácticas de mesa. | Recorrido completo sin atravesar muebles; prueba funcional del tutorial. |
| **3 · Contenido** | 16 prácticas guiadas, mezclas libres, cuaderno, tabla periódica, residuos por tipo, tapas. | Cada práctica supera su prueba automatizada (pasos y reglas químicas). |
| **4 · Pulido y entrega** | Escalabilidad, accesibilidad, localización, instalador de Windows, perfil de rendimiento. | ≥ 30 FPS en Baja en GPU integrada moderna; instalador probado en un equipo limpio. |

---

## 13. Pruebas

- **Química:** pruebas unitarias (todos los casos de `sandbox.test.ts`, `hoodRecipes.test.ts` y el resto) y paridad con los vectores de referencia.
- **Juego:** pruebas funcionales de Unreal que recorren el tutorial y cada práctica con acciones simuladas (recoger, verter hasta la marca, pesar, enjuagar, desechar).
- **Visual:** capturas automáticas desde puntos de cámara fijos en cada calidad; comparación manual con las fotos de referencia en cada fase.
- **Rendimiento:** capturas de perfil por calidad; presupuesto por sistema (GPU, Niagara, Lumen).

---

## 14. Restricciones y riesgos

- **No** copiar personajes, niveles, interfaz, logotipos ni estética distintiva de los juegos de referencia; **no** reproducir la identidad de la universidad (rótulos, logos, nombres de prácticas).
- **Licencias:** registrar el origen y la licencia de cada objeto, textura y sonido en `docs/ASSETS.md`. Revisar los términos de Unreal Engine y de cada biblioteca antes de comercializar.
- **Química:** no añadir reacciones sin modelo implementado y probado; las combinaciones sin regla se indican como «sin cambios según el modelo».
- **Hardware:** sin GPU dedicada, el desarrollo en UE5 será muy lento → decidir entre conseguir equipo o seguir el Plan B web.
- **Alcance:** el fotorrealismo es caro en objetos; priorizar la zona de la campana (corte vertical) antes de ampliar.
- **Publicación:** no hacer push, despliegues ni publicaciones sin petición explícita del usuario (`AGENTS.md`).
