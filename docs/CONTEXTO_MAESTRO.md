# EXPERIMENTA 3D — CONTEXTO MAESTRO DEL PROYECTO

## 1. Contexto y origen

Estoy desarrollando **Experimenta 3D**, una plataforma web educativa para simular un laboratorio de química tridimensional en primera persona.

El proyecto nació como una asignación de Química General I de mi universidad, UNIBE, República Dominicana. Somos dos estudiantes desarrollándolo.

Aunque utilizaré fotografías y videos del laboratorio universitario como referencia, quiero que Experimenta 3D sea un producto independiente, que pueda publicar en GitHub, ampliar posteriormente y eventualmente comercializar.

No debe incorporar logos, marcas ni una identidad institucional que lo haga parecer una aplicación oficial de la universidad.

## 2. Visión del producto

Quiero una experiencia parecida a un videojuego educativo en primera persona.

El usuario debe poder entrar a un laboratorio virtual, caminar libremente, observar el entorno, recoger instrumentos, manipular sustancias, preparar experimentos y visualizar reacciones químicas.

No quiero un simple recorrido 3D ni una página con información de química.

Quiero un **laboratorio verdaderamente interactivo**.

Debe combinar:

- Exploración en primera persona.
- Manipulación de objetos tridimensionales.
- Experimentos químicos.
- Simulaciones visuales de reacciones.
- Cálculos químicos científicamente fundamentados.
- Aprendizaje guiado.
- Experimentación libre.

## 3. Referencias visuales

He reunido fotografías y videos del laboratorio real de mi universidad y los proporcionaré en el proyecto.

Debes analizarlos para comprender:

- Distribución del laboratorio.
- Dimensiones y proporciones aproximadas.
- Ubicación de las mesas.
- Gabinetes y estanterías.
- Campana extractora.
- Fregaderos.
- Puertas y ventanas.
- Equipos e instrumentos.
- Iluminación y materiales.

No quiero una estética Minecraft completamente cuadrada. Minecraft fue únicamente una referencia para explicar el movimiento en primera persona y la interacción.

El estilo deseado es **3D semi-realista, limpio, moderno y optimizado para navegadores**, con modelos reconocibles, proporciones coherentes y una escena visualmente ordenada.

Puedes usar geometrías sencillas al principio y después reemplazarlas por modelos 3D más elaborados.

No inventes la distribución definitiva del laboratorio si las referencias proporcionadas no permiten identificarla.

## 4. Pantalla de inicio

El nombre mostrado será:

**Experimenta 3D**

Subtítulo: Laboratorio Virtual Interactivo.

La pantalla principal debe tener:

- Práctica guiada.
- Laboratorio libre.
- Tutorial inicial o primeros pasos.
- Configuración, cuando sea necesaria.

La interfaz debe utilizar español como idioma principal.

## 5. Tutorial inicial obligatorio

Cuando una persona entre por primera vez, deberá completar un tutorial interactivo para conocer los controles.

Debe aprender:

1. Caminar con WASD.
2. Mover la cámara utilizando el mouse.
3. Apuntar a objetos con el puntero central.
4. Interactuar con un objeto utilizando E.
5. Recoger y transportar instrumentos.
6. Utilizar las manos o espacios de objetos.
7. Colocar un instrumento en la mesa.
8. Interactuar con estaciones de trabajo.

El tutorial debe funcionar como los primeros minutos de un videojuego.

Debe haber instrucciones claras, indicadores flotantes, objetos resaltados y confirmaciones visuales.

Una vez completado, debe guardarse el progreso localmente para no repetirlo obligatoriamente cada vez. El usuario podrá repetirlo desde el menú.

## 6. Modo práctica guiada

Este modo funcionará mediante objetivos secuenciales, similares a misiones de videojuegos.

El usuario seguirá pudiendo caminar libremente por el laboratorio.

Sin embargo, el sistema mostrará:

- Objetivo actual.
- Flechas hacia el destino.
- Objetos destacados.
- Indicadores flotantes.
- Instrucciones breves.
- Confirmación al completar un paso.
- Barra de progreso de la práctica.

Ejemplo:

**Práctica: reacción entre vinagre y bicarbonato**

1. Dirígete a la estantería.
2. Recoge el vinagre.
3. Busca el bicarbonato de sodio.
4. Consigue un vaso de precipitados.
5. Dirígete a la mesa de trabajo.
6. Coloca el recipiente.
7. Introduce una cantidad de vinagre.
8. Añade bicarbonato.
9. Observa la reacción.
10. Consulta la explicación y los resultados.

La aplicación debe verificar que realmente se ejecutaron las interacciones necesarias antes de avanzar.

## 7. Modo laboratorio libre

El usuario podrá recorrer el laboratorio sin misiones obligatorias.

Debe poder:

- Investigar sustancias disponibles.
- Recoger instrumentos.
- Transportar reactivos.
- Preparar equipos.
- Elegir cantidades.
- Realizar experimentos compatibles con el motor de simulación.
- Consultar información química.
- Limpiar o reiniciar las estaciones.

Las combinaciones sin simulación implementada deberán indicarse como no disponibles, sin inventar reacciones.

## 8. Cámara y movimiento

Implementar una cámara en primera persona.

Controles iniciales:

- WASD: movimiento.
- Mouse: orientación de cámara.
- E: interactuar.
- Escape: liberar cursor o abrir menú.
- Shift: caminar más rápido, si resulta adecuado.

Agregar colisiones para que el jugador no atraviese paredes, mesas ni muebles.

El movimiento debe sentirse fluido, sin mareos ni movimientos excesivos de cámara.

## 9. Sistema de interacción

Colocar un puntero discreto en el centro de la pantalla.

Utilizar raycasting para detectar objetos interactivos.

Cuando el jugador apunte a un instrumento o sustancia:

- Resaltar ligeramente el objeto.
- Mostrar su nombre.
- Mostrar una descripción breve.
- Mostrar la tecla de interacción.

Para sustancias químicas, presentar información como:

- Nombre.
- Fórmula química.
- Concentración cuando corresponda.
- Estado físico.
- Propiedades básicas.
- Riesgos y precauciones relevantes.
- Reacciones compatibles con las prácticas implementadas.

Evitar paneles grandes que cubran demasiado la escena.

## 10. Sistema de manos e inventario

Quiero que el jugador tenga la sensación de manipular físicamente los objetos.

Debe existir un sistema de mano derecha y mano izquierda.

Cuando recoja un frasco, este deberá aparecer sujeto a una mano o en una posición visual que represente correctamente su transporte.

Los antebrazos del personaje deben mostrar mangas de bata blanca de laboratorio.

Inicialmente podemos implementar una representación sencilla de manos y antebrazos. Posteriormente se pueden agregar mejores modelos y animaciones.

Los objetos deben poder:

- Recogerse.
- Transportarse.
- Soltarse.
- Colocarse en superficies compatibles.
- Inclinarse para verter líquidos cuando corresponda.

## 11. Instrumentos del laboratorio

Planificar e implementar progresivamente:

- Vasos de precipitados.
- Tubos de ensayo.
- Probetas.
- Pipetas.
- Pinzas.
- Termómetros.
- Matraces.
- Recipientes para sustancias.
- Balanza.
- Mechero o fuente de calentamiento.
- Equipo de conductividad.
- Campana extractora.
- Agua destilada.
- Equipos de seguridad.

No es necesario implementar todos los instrumentos en la primera versión.

## 12. Primer experimento: vinagre y bicarbonato

Este será el primer experimento completamente funcional.

Reactivos:

- Vinagre, solución acuosa de ácido acético de concentración definida.
- Bicarbonato de sodio (NaHCO₃).

El estudiante deberá recogerlos, conseguir un recipiente, introducir cantidades y realizar la mezcla.

Al verter una sustancia debe existir una animación de inclinación del recipiente y transferencia del material.

La reacción es:

NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂

Debe visualizarse efervescencia mediante burbujas y un efecto de espuma razonable.

La intensidad visual debe depender de un modelo simplificado y coherente con las cantidades y concentraciones.

Implementar cálculos basados en:

- Cantidad de sustancia.
- Concentración.
- Moles.
- Estequiometría.
- Reactivo limitante.
- Producción teórica de CO₂.

No usar animaciones aleatorias como sustituto de los cálculos químicos.

La espuma debe presentarse como una aproximación visual y no como una medición exacta del volumen de gas.

Después del experimento, mostrar resultados, ecuación química y explicación.

## 13. Experimentos adicionales

El proyecto debe estar preparado para incorporar las prácticas reales que he realizado en Química General I.

**Conductividad eléctrica**

Introducir electrodos en soluciones, observar la iluminación de una bombilla y explicar la conductividad según la presencia y movilidad de iones.

**Disolución y cristalización**

Agregar sal al agua, observar su disolución, aplicar calentamiento, simular evaporación y observar la cristalización.

**Calor específico**

Calentar una muestra metálica, introducirla en agua dentro de un calorímetro, registrar temperaturas y calcular el calor específico mediante transferencia de calor.

Incluir instrumentación, variables y explicaciones pertinentes para cada práctica.

Estos experimentos son posteriores al MVP inicial.

## 14. Tabla periódica interactiva

Deseo colocar una tabla periódica visible en una pared del laboratorio.

Al acercarse y presionar E, el estudiante podrá abrir una vista ampliada.

En una versión posterior deberá poder seleccionar elementos químicos y consultar:

- Símbolo.
- Número atómico.
- Masa atómica.
- Grupo y período.
- Electronegatividad.
- Clasificación.
- Información educativa adicional.

## 15. Cuaderno digital

Preparar la arquitectura para un cuaderno de laboratorio donde se registren:

- Nombre del experimento.
- Materiales utilizados.
- Cantidades.
- Variables.
- Resultados.
- Observaciones.
- Explicación de la reacción.
- Conclusiones.

En el futuro deberá permitir repetir experimentos y comparar resultados.

## 16. Tecnologías

Preferencia tecnológica:

- React.
- TypeScript.
- Vite.
- Three.js.
- React Three Fiber.
- @react-three/drei.
- Zustand para estados compartidos.
- Rapier si se necesitan físicas y colisiones.
- Blender para modelado 3D.
- glTF/GLB para almacenar modelos.

No agregues dependencias complejas que no tengan una utilidad clara.

Priorizar rendimiento, mantenibilidad, separación de responsabilidades y una buena experiencia en computadoras.

## 17. Arquitectura propuesta

Separar claramente:

1. Renderizado del mundo 3D.
2. Controles del jugador.
3. Sistema de interacciones.
4. Equipamiento de manos.
5. Gestión de instrumentos y reactivos.
6. Motor de experimentos.
7. Cálculos químicos.
8. Prácticas guiadas.
9. Tutorial.
10. Interfaz de usuario.
11. Persistencia de progreso.
12. Recursos 3D y multimedia.

Los experimentos deben estar definidos de manera modular para permitir que se incorporen nuevas prácticas sin reconstruir la aplicación.

El motor químico no debe depender directamente de los componentes visuales de React.

## 18. Requisitos de calidad

- Diseño responsive para menús e información, priorizando controles de escritorio en la primera versión.
- Movimiento fluido.
- Optimización de geometrías y materiales.
- Interacciones consistentes.
- Arquitectura modular.
- Código TypeScript legible.
- Reutilización de componentes.
- Validaciones de cantidades.
- Mensajes de error claros.
- Cálculos científicos verificables.
- Manejo cuidadoso de acciones peligrosas: las simulaciones no deben sugerir que todos los procedimientos son seguros para reproducirse físicamente.

## 19. Alcance del primer prototipo

La primera versión funcional debe incluir:

1. Una pantalla de bienvenida.
2. Selección de modo.
3. Un laboratorio 3D navegable.
4. Cámara en primera persona.
5. Puntero central.
6. Interacción con objetos.
7. Recoger y colocar instrumentos.
8. Tutorial de controles.
9. Sistema básico de objetivos guiados.
10. Un experimento de vinagre y bicarbonato funcional.
11. Explicación educativa de sus resultados.

No intentar implementar todas las prácticas desde el principio.

## 20. Carpeta del proyecto

La carpeta local en Windows es:

`C:\Users\chris\OneDrive - Universidad Iberoamericana\Tareas\6to Cuatrimestre\Quimica 1\Simulador3D`

Esta carpeta debe ser la raíz del proyecto.

Antes de crear archivos, revisa su contenido y conserva cualquier trabajo existente.

## 21. Instrucciones para Codex

Quiero que actúes como arquitecto de software, desarrollador frontend especializado en Three.js y diseñador de experiencias interactivas educativas.

Primero:

1. Inspecciona los archivos existentes.
2. Analiza las fotografías y los videos disponibles.
3. Identifica las características arquitectónicas del laboratorio real.
4. Diseña una propuesta de escena tridimensional inspirada en esas referencias.
5. Define la estructura técnica del proyecto.
6. Presenta una planificación por fases con prioridades.

Después, comienza la implementación del prototipo inicial de Experimenta 3D.

No implementes indiscriminadamente todas las funcionalidades futuras. Construye una base de alta calidad y escalable.

No inventes información sobre imágenes o videos que no hayas podido examinar.

Documenta las decisiones arquitectónicas importantes y conserva este contexto como referencia del proyecto para futuras sesiones.

**Objetivo final:** desarrollar una aplicación web 3D de química que combine la libertad de un videojuego con experimentos educativos científicamente fundamentados, utilizando un entorno inspirado en un laboratorio universitario real y una identidad comercial independiente.