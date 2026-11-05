# Prácticas de soluciones: conductividad y cristalización

Ampliación solicitada por el usuario después del primer prototipo. Se mantienen las funciones científicas independientes de React en `src/chemistry/solutions.ts` y las definiciones en `src/experiments/catalog.ts`. Las sesiones y sus resultados se gestionan en `src/state/practices.ts`.

## Conductividad eléctrica · Mesa 02

Muestras: agua pura, NaCl y sacarosa. Concentración de las soluciones: 0,001–0,020 mol/L. La muestra se prepara antes de introducir los electrodos. La medición mueve los electrodos dentro del vaso y enciende la bombilla con un brillo relativo ligado al cálculo.

Modelo de dilución ideal a 25 °C:

`κ(S/cm) ≈ Λ° × c(mol/L) / 1000`, con `Λ°(NaCl) = 126,4 S·cm²/mol`.

Se añade un fondo de agua pura de 0,055 µS/cm. La sacarosa no aporta iones en este modelo; no se calcula su efecto sobre viscosidad ni movilidad de los iones del agua. NaCl aporta dos especies iónicas: concentración total de iones = 2c. El brillo se normaliza contra el extremo superior del rango permitido y no representa la potencia de una bombilla real.

La aproximación con conductividad molar límite no sustituye la conductividad experimental a concentración finita. No se incluyen impurezas, CO₂ atmosférico ni dependencia térmica. No se permite usar cantidades fuera del intervalo diluido.

Fuentes:

- [IIT Kanpur / NCERT, Electrochemistry](https://sathee.iitk.ac.in/sathee-cuet/cuet-ug/chemistry/english/study-materials/ncert/nb-che-12/chem-12-unit-3-electrochemistry/): conductividad molar límite y valor de NaCl.
- [NIST, Low Electrolytic Conductivity Standards](https://pmc.ncbi.nlm.nih.gov/articles/PMC4887229/): conductividad teórica del agua pura a 25 °C.
- [EPA, Conductivity](https://archive.epa.gov/water/archive/web/html/vms59.html): conductividad relacionada con iones disueltos y baja contribución de azúcar.

## Disolución y cristalización · Mesa 03

Entrada: 50–150 g de agua, 1–50 g de NaCl y evaporación de 0–90 % del agua. Primero se prepara agua y sal, luego se disuelve y finalmente se evapora con la placa virtual. Las acciones deben completarse en ese orden. Las cantidades finales se registran después de evaporar.

Modelo de equilibrio a 20 °C, con solubilidad aproximada redondeada de 36 g de NaCl / 100 g de agua:

- Disuelto inicialmente = mínimo(sal añadida, 0,36 × agua inicial).
- Sólido inicial = sal añadida − disuelto inicialmente.
- Agua restante = agua inicial × (1 − fracción evaporada).
- Disuelto al final = mínimo(sal añadida, 0,36 × agua restante).
- Sólido final = sal añadida − disuelto al final.
- Cristales nuevos = sólido final − sólido inicial.

El sólido que nunca llegó a disolverse no se cuenta como cristal nuevo. La masa de sal total se conserva. Si no se alcanza saturación, el resultado puede ser cero cristales nuevos.

La animación acelera el proceso. No representa una ley cinética, un balance energético ni la temperatura instantánea de una placa real. El resultado se interpreta tras enfriar a 20 °C. La forma y el tamaño de los cubos son una representación visual, no una medición cristalográfica.

Fuente de solubilidad: [South Puget Sound Community College, Solubility and Saturation](https://chem.libretexts.org/Courses/South_Puget_Sound_Community_College/Chem_121%3A_Introduction_to_Chemistry/08%3A_Chapter_7_-_Solutions/8.02%3A_Solubility_and_Saturation).

## Integración y persistencia

- E sobre mesa/equipo 02 o 03 abre su práctica; Q continúa disponible para colocar un objeto transportado. Las muestras y equipos de estas mesas están preparados en su estación; no son nuevos objetos del inventario de manos.
- El selector «Experimentos» inicia una guía para cada práctica. El primer tutorial sigue siendo obligatorio. La flecha orienta, sin mover la cámara ni al jugador.
- Preparación y acciones son verificadas por estado. Los temporizadores se cancelan al limpiar, iniciar otra sesión o volver al menú, para no guardar resultados tardíos de ensayos cancelados.
- Los resultados de estas prácticas se guardan bajo `experimenta.practices.v1`; los registros anteriores de vinagre y bicarbonato conservan `experimenta.records.v1`. El cuaderno une ambos formatos y muestra los 30 ensayos más recientes. Cada almacenamiento conserva hasta 30 registros.
- N muestra un ensayo seleccionado, un resultado destacado y la anotación editable. Los cálculos completos se consultan en un desplegable cerrado inicialmente. Se puede editar una observación anterior sin sobrescribir las demás.
- El registro común cubre las dos prácticas nuevas y el selector incluye la reacción original. La orquestación de vinagre sigue en `lab.ts`; no se afirma que todo el motor ya sea genérico.

Calor específico, instrumentos adicionales y mezclas arbitrarias quedan pendientes. Las prácticas reales requieren protección y supervisión.
