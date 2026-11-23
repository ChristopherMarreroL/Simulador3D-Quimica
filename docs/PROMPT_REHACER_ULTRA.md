# Prompt maestro · Rehacer Experimenta 3D con gráficos ultrarrealistas

Copia el bloque siguiente completo en el agente de IA o pásaselo al equipo que hará el trabajo, abriendo la sesión en la carpeta del proyecto. Funciona mejor junto con `docs/REHACER_ULTRA_REALISTA.md`, que tiene todos los detalles.

---

```text
Eres el director técnico y artístico de «Experimenta 3D», un laboratorio de química virtual en primera persona, en español. Tu misión es REHACERLO desde cero como una aplicación de escritorio para Windows con gráficos FOTORREALISTAS, conservando su modelo químico y su forma de jugar.

## Antes de empezar, lee (en este orden)
1. AGENTS.md (instrucciones permanentes del usuario: no hacer push, deploy ni publicar sin permiso; interfaz en español; sin identidad institucional; no inventar reacciones sin modelo).
2. docs/REHACER_ULTRA_REALISTA.md (especificación completa: motor, arte, interacción, fases y criterios de aceptación).
3. docs/PROJECT_CONTEXT.md, docs/CAMPANA_MEZCLAS.md, docs/MODELO_QUIMICO.md y docs/PRACTICAS_SOLUCIONES.md (decisiones, modelos y fuentes).
4. El código de referencia de la versión web: src/chemistry/, src/experiments/hoodRecipes.ts, src/state/hood.ts y sus pruebas (*.test.ts).
5. Las imágenes de Images/ (22 fotos del laboratorio real) e Images/estilo/ (5 referencias de calidad visual). Míralas antes de diseñar.

## Meta visual
Una captura sin interfaz debe poder confundirse con una fotografía de un laboratorio real. Nivel de referencia: los juegos en primera persona más fotorrealistas de 2025–2026 (Images/estilo/ref-1 y ref-2). Toma de ellos SOLO la técnica:
- Objetos escaneados por fotogrametría y materiales físicos con desgaste.
- Iluminación global, sombras suaves y densidad de objetos creíble.
- Manos enguantadas detalladas.
- Cámara física con grano fino.
NO copies sus personajes, escenarios, interfaz, logotipos ni el efecto de cámara corporal con ojo de pez.
De ref-3 y ref-4 toma los líquidos de color que brillan con la luz, la mesa de trabajo protagonista y la mano que señala el siguiente paso; NO la fantasía.
De ref-5 toma el panel de tarea con el paso y el progreso y el guante de nitrilo azul.
El laboratorio se inspira en las fotos reales (granito azul perla pulido, gabinetes blancos, fregaderos cuadrados con grifo de cuello de cisne, ventanas de aluminio, balanzas, estufa, frascos ámbar y blancos, puerta de vidrio), pero la DISTRIBUCIÓN es propia: no es una réplica del aula ni lleva rótulos o logos de la universidad.

## Tecnología
- Unreal Engine 5 (versión estable más reciente), proyecto C++ + Blueprints.
- Lumen, Nanite, sombras virtuales, TSR, Niagara, Control Rig/IK, CommonUI, Enhanced Input, localización es.
- Escalabilidad Baja/Media/Alta/Épica. La calidad Baja usa luz horneada y debe ir a ≥ 30 FPS en GPU integrada moderna; Épica a 60 FPS en GPU de gama media.
- Repositorio Git con Git LFS. Las fotos de Images/ nunca se suben.
- Si el equipo no tiene GPU dedicada, DETENTE y avísame antes de seguir: propón el Plan B de la especificación (Three.js/WebGPU con objetos glTF escaneados e iluminación horneada).

## Lo que debes conservar (sin cambiar resultados)
- Motor químico de src/chemistry/sandbox.ts y sus datos (species.ts, constants.ts, reagents.ts, formula.ts, solutions.ts, reaction.ts): pórtalo a un módulo C++ puro «ExperimentaChem».
- Antes de portarlo, exporta desde la versión web un archivo golden/chemistry.json con al menos 200 casos (16 prácticas, mezclas aleatorias con semilla, pH, calor, Ksp, desbordes y errores). El C++ debe reproducirlos con un error relativo ≤ 1e-6. Mismos casos de prueba que Vitest, como pruebas Automation.
- Las 16 prácticas de hoodRecipes.ts, la lógica de pasos de recipeSteps(), las prácticas de mesa (vinagre/bicarbonato, conductividad, cristalización), el cuaderno y la tabla periódica (datos PubChem locales).
- El procedimiento real:
  - Gafas y guantes obligatorios; las manos sin guantes se ven con piel.
  - Los líquidos se miden en probeta y se enjuagan con la piseta.
  - Los sólidos se pesan en una balanza con navecilla y espátula.
  - Los indicadores se añaden gota a gota.
  - Los residuos van a su recipiente.
  - La ventana de la campana va a la altura de trabajo y el extractor encendido.

## Experiencia que debes construir
- Primera persona sin oscilación de cámara. Dos manos independientes (1/2) con agarre por IK, poses por familia de objeto, peso, y animaciones de verter, desenroscar, presionar la piseta y teclear la balanza.
- Interacción: clic/E para usar, Q para dejar, F para tapar/destapar, mantener clic para verter (el ángulo controla el caudal). Clic derecho para inspeccionar y leer el menisco. Contorno sutil en lo apuntado y aviso con el nombre y las acciones.
- Reacciones mostradas con lo que diga el modelo químico, nunca inventadas:
  - Líquido con superficie que oscila y menisco.
  - Chorro con salpicaduras.
  - Burbujas y espuma según los moles de gas.
  - Precipitado que se forma y sedimenta.
  - Cambio de color difundiéndose.
  - Vapor si hace calor.
  - Depósito metálico.
- Guía: tablero físico junto a la campana con las 16 prácticas; flechas doradas y contorno sobre lo que pide el paso; panel de tarea con el paso y el progreso; mano guía opcional en la primera práctica.
- Sonido realista (extractor, vidrio, líquido, balanza, pasos) y escala real de los objetos (verifica las medidas con un catálogo de material de laboratorio; no las inventes).

## Cómo debes trabajar
1. Empieza por la Fase 0 y la Fase 1 (corte vertical: zona de la campana + «Prueba de cloruros» completa) antes de construir el resto. Enséñame capturas sin interfaz junto a las fotos de referencia y espera mi aprobación del aspecto.
2. Registra el origen y la licencia de cada objeto, textura y sonido en docs/ASSETS.md. Usa escaneos propios (RealityScan), bibliotecas CC0 (Poly Haven) o bibliotecas con licencia. Elimina marcas y logotipos de las texturas.
3. No añadas reacciones sin modelo implementado y probado. Las combinaciones sin regla se muestran como «sin cambios según el modelo».
4. Mantén actualizados docs/PROJECT_CONTEXT.md y docs/VALIDACION.md con lo hecho, lo comprobado y lo pendiente. Di claramente qué no pudiste verificar (por ejemplo, FPS en el hardware objetivo).
5. Cada fase termina con:
   - Pruebas químicas y funcionales en verde.
   - Capturas por calidad.
   - Medición de FPS en el hardware disponible.
   - Un resumen en español.
6. No hagas commit, push, merge ni publiques nada sin mi permiso explícito.

Empieza ahora: resume en 10 líneas lo que entendiste, enumera los riesgos que veas (hardware incluido) y propón el plan detallado de la Fase 0 con sus entregables.
```

---

## Versión corta (para una primera conversación)

```text
Rehaz «Experimenta 3D» (laboratorio de química en primera persona, en español) como aplicación de escritorio en Unreal Engine 5 con gráficos fotorrealistas. Una captura debe parecer una foto real.
Lee AGENTS.md, docs/REHACER_ULTRA_REALISTA.md y las imágenes de Images/ e Images/estilo/.
Conserva el motor químico de src/chemistry (pórtalo a C++ con vectores de referencia exportados desde la versión web), las 16 prácticas de hoodRecipes.ts y el procedimiento real (protección, probeta, balanza, gotero, piseta, residuos).
Usa las referencias solo como nivel de calidad: no copies juegos existentes ni la identidad de la universidad.
Empieza por un corte vertical de la zona de la campana con «Prueba de cloruros» completa y enséñame capturas antes de seguir.
No publiques nada sin permiso.
```
