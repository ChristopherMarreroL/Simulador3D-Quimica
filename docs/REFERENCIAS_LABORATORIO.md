# Referencias visuales recibidas · 31 de octubre de 2026

Se revisaron las 43 fotografías adjuntas, numeradas Photo 1–43. Hay vistas repetidas o muy próximas; no representan 43 zonas distintas. No se recibió ni examinó el video de 1 minuto y 23 segundos mencionado por el usuario.

**Criterio del usuario:** tomar este laboratorio como referencia; no reconstruirlo exactamente. Experimenta 3D mantiene una identidad independiente y una distribución propia.

## Observación y aplicación

| Fotos | Evidencia visible | Aplicación en Experimenta 3D |
| --- | --- | --- |
| 1–5, 11, 22, 26, 28–29 | Sala alargada, varias islas con esquinas recortadas y base central oscura, pasillos, taburetes, encimeras laterales; pantalla de proyección al fondo. | Tres islas diseñadas para la navegación; una mesa funcional y dos de apoyo. Número y ubicación propios. La pantalla de proyección no se incorpora en esta iteración. |
| Mismas vistas generales | Techo blanco con franjas/retranqueos azules, luminarias cuadradas y rejillas; ventanales en un lateral. | Marco azul superior, techo y luminarias visibles durante el juego, ventanales claros sobre una encimera lateral. Geometría simplificada; no se simula climatización. |
| 12–17, 32, 36, 38 | Superficies de granito gris oscuro moteado, fregaderos de acero y grifería curva; muebles blancos con tiradores. | Material de granito procedural, gabinetes superiores y bajos, fregaderos y grifería simplificados. No se usan las fotos como texturas. |
| 6–8, 10, 27, 30 | Campana de sobremesa con marco claro, parte superior azul y frente acristalado; recipientes y gafas junto al equipo. | Campana de aspecto blanco/azul con panel transparente; sin reproducir fabricante ni etiquetas. Equipo ambiental sin simulación de extracción. |
| 9, 35, 39, 41 | Puertas de vidrio con marco blanco, tirador vertical y señalización. | Referencia para una futura entrada; no se deduce una segunda sala navegable ni se reproduce la señalización institucional. |
| 18–20, 37 | Equipo con cámara y bandejas, balanzas de distintos tipos y equipo de pesaje almacenado. | Inventario de referencias para instrumentación posterior. No se deduce la calibración, rango ni estado operativo. No se añaden funciones de pesaje o calentamiento en esta iteración. |
| 21, 23–25, 33 | Matraces, gradillas, embudos de separación, recipientes, frascos y almacenamiento bajo encimeras. | Referencia de proporciones y futuras familias de modelos; los únicos objetos transportables siguen siendo los de la primera práctica. |
| 31, 34, 40, 42–43 | Ducha de emergencia en un nicho y lavaojos de pared con piezas amarillas. | Lavaojos simplificado y señal genérica; la ducha queda como referencia para una ampliación. El lavaojos es decorativo en esta versión. |

Los soportes y aros metálicos sobre las mesas se observan en las vistas generales. Se incorporaron versiones simplificadas como material de apoyo, sin controles de montaje todavía.

## Decisiones propias y límites

- Las fotos permiten reconocer el carácter del laboratorio, pero no obtener dimensiones exactas ni un plano métrico. La perspectiva y la superposición de muebles impiden garantizar todos los tamaños y separaciones.
- Se conservan las dimensiones de trabajo del prototipo (12 × 10 unidades) como decisión de diseño. Las tres islas no pretenden reproducir el número de mesas del aula real.
- Se mantiene accesible el estante de los tres objetos interactivos y la mesa de la reacción; posiciones y colisiones de las islas se definen juntas en `src/world/layout.ts`.
- El granito se genera con una textura determinista de 128 × 128 píxeles. La escena usa geometrías procedurales y no incorpora dependencias nuevas.
- No se copian personas, marcas comerciales, carteles identificativos ni deterioro/desorden observado. Los rótulos son propios.
- Las sustancias no se identifican ni se agregan al motor por etiquetas parcialmente legibles. Ninguna foto se usa para inferir una reacción o un procedimiento seguro.
- Las fotos originales permanecen como adjuntos de referencia; no se copian a `public/` ni se incluyen en la aplicación.

## Video opcional

Estas fotos son suficientes para esta adaptación. Si se incorpora el video más adelante, puede facilitarse como archivo local accesible o dividirse en fragmentos que muestren entrada, zona central y equipos. Su utilidad sería aclarar la continuidad entre zonas; no hace falta para avanzar con el diseño inspirado en las fotos.

## Segunda serie: 22 fotografías locales · 6 de noviembre de 2026

El usuario dejó 22 fotos en `Images/` (carpeta local, ignorada por Git: no se publican). Se revisaron todas en hojas de contacto. Muestran sobre todo encimeras perimetrales, armarios por dentro, balanzas, una estufa y la puerta.

| Fotos | Evidencia visible | Aplicación |
| --- | --- | --- |
| 1–5, 15–17, 19 | Encimeras de granito oscuro tipo «azul perla» (grano gris y negro con destellos azulados, pulido y brillante), zócalo de granito, paredes blancas, ventanas corredizas de aluminio blanco sobre la encimera, tomacorrientes dobles con tapa ciega, dispensadores negros de pared, fregaderos cuadrados de acero empotrados con grifo de cuello de cisne y dos llaves en cruz, escurridores blancos con cristalería, gradillas, frascos lavadores, tarros pequeños, rollo de papel y soporte universal. | Material de granito procedural pulido con destellos azulados y zócalo; ventanas con aberturas reales y vista exterior; tomacorrientes, dispensador, fregaderos y grifería nuevos; escurridor, gradilla, frascos lavadores, tarros, papel, probetas y soporte como atrezo. |
| 6–7 | Balanza digital blanca con pantalla, balanza de triple brazo azul y balanza de dos platillos sobre la encimera. | Balanza digital y de triple brazo decorativas en la encimera izquierda. No pesan nada. |
| 8 | Estufa de laboratorio blanca con ventana, base y panel verde azulado, pantallas digitales y etiquetas de advertencia. | Estufa decorativa en la mesa de reactivos, con etiquetas genéricas. |
| 9–14, 18, 20 | Interior de armarios blancos con bisagras metálicas: matraces aforados, Erlenmeyer, probetas de vidrio con base hexagonal, vasos, frascos ámbar y de plástico, embudos de decantación, gradillas y sifón bajo el fregadero. | Proporciones de cristalería y frascos de almacenamiento ámbar/blancos en el estante alto. Los armarios siguen cerrados. |
| 21–22 | Puerta de aluminio y vidrio con franja esmerilada, tirador vertical largo, carteles de empuje y de bata obligatoria, lector de tarjetas; suelo de porcelanato claro y brillante en placas grandes. | Puerta de entrada en la pared frontal con carteles propios genéricos (bata obligatoria, empuje), lector y extintor; suelo de porcelanato claro, brillante, con juntas en relieve. |

No se copiaron rótulos institucionales ni textos de prácticas («Orgánica II…», «CHEMICAL LAB», aviso a profesores), ni personas, marcas de equipos, suciedad o desorden. Las sustancias no se identificaron a partir de etiquetas. La distribución sigue siendo propia: las fotos guían materiales, mobiliario y atrezo, no un plano.
