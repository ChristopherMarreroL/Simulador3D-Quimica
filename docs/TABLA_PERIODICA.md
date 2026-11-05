# Tabla periódica interactiva

Interacción propia inspirada en [Ptable en español](https://ptable.com/?lang=es#Propiedades): selección de elementos, búsqueda, familias y visualización de propiedades mediante colores. No se utiliza código ni se incrusta la aplicación de Ptable.

## Datos y procedencia

Se guardó una instantánea pública de 118 elementos del servicio oficial de [PubChem](https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON), consultado el 31 de octubre de 2026, en `src/data/pubchem-periodic-table.json`. Los datos se incluyen localmente para consultar propiedades sin solicitudes de red durante el juego. Las fuentes originales y sus condiciones se pueden consultar en [PubChem Periodic Table](https://pubchem.ncbi.nlm.nih.gov/periodic-table/). Cada ficha enlaza con su elemento en PubChem.

`src/experiments/elements.ts` adapta los campos, conserva los valores numéricos y traduce nombres, familias y estados al español. Los grupos y períodos se derivan de la distribución de la tabla. Los lantánidos y actínidos se muestran como series f separadas, con período 6 y 7 respectivamente, sin asignar un grupo individual en esta vista.

Propiedades disponibles: número, símbolo, nombre, masa de referencia en u, electronegatividad de Pauling, estado de referencia, radio atómico en pm, primera energía de ionización en eV, fusión/ebullición en K, densidad de referencia en g/cm³, configuración electrónica y estados de oxidación. Un campo vacío se conserva como dato ausente y se presenta como «No disponible», nunca como cero. Los estados predichos se identifican explícitamente.

La masa atómica de referencia proviene del campo AtomicMass de PubChem. No se presenta como una tabla de pesos atómicos estándar con intervalos e incertidumbres. Para esos valores, consultar [CIAAW](https://www.ciaaw.org/atomic-weights.htm). Las propiedades térmicas y densidades son valores de referencia de la fuente, no un modelo dinámico de fases dependiente de presión y temperatura.

## Funciones y límites

- Selección con mouse o teclado; flechas para desplazarse por la posición física de las celdas, saltando huecos. Enter/Espacio activan un botón.
- Búsqueda por nombre en español, símbolo o número; no requiere introducir tildes.
- Filtrado por familia; los elementos no coincidentes se atenúan y mantienen su ubicación.
- Colores por familia, masa, electronegatividad o estado. Las escalas numéricas son lineales; gris identifica datos ausentes o estados predichos.
- Consulta del elemento seleccionado y enlaces a fuentes. La tabla admite desplazamiento horizontal en pantallas pequeñas dentro del panel.
- No incluye todavía orbitales 3D, isótopos ni un simulador de estados según temperatura/presión.

Antes de actualizar la instantánea, revisar sus columnas y ejecutar las pruebas de integridad y datos ausentes. No mezclar silenciosamente predicciones y valores experimentales ni cambiar las constantes del motor de reacción al actualizar los datos de consulta.

Por petición del usuario, se retiró del panel el bloque «Datos de PubChem, guardados localmente…». La procedencia y los supuestos se conservan en este documento y los enlaces de consulta por elemento permanecen disponibles.
