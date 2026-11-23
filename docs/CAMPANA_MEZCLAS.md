# Campana extractora: mezclas libres

Añadido el 6 de noviembre de 2026 a petición del usuario: «dale realismo, agrega un estante con todas las sustancias posibles, en la campana de extracción quiero poder jugar con ella (experimentar, mezclar, ver reacciones…)», además de manos con movimiento, más color e interactividad.

«Todas las sustancias posibles» no es abarcable con modelos verificables. Se eligió un catálogo de **27 reactivos** de laboratorio escolar que cubre ácidos, bases, carbonatos, sales, oxidantes, metales e indicadores. Las combinaciones sin regla en el modelo se muestran como «sin cambios según el modelo», con un aviso de que en la realidad podrían reaccionar.

## Procedimiento real (desde el 6 de noviembre de 2026)

El usuario pidió que fuera «más realista» en el sentido de **hacerse como en la vida real**, y un instructivo junto a la campana con flechas sobre lo que se necesita.

- **Protección:** sin gafas y guantes no se pueden tomar reactivos de la estantería. Están en la estación de protección junto a la puerta. Las manos se ven sin guantes hasta ponérselos, y con las gafas aparece su borde en la vista.
- **Líquidos:** se miden en la **probeta graduada de 100 mL** (mantener el clic sobre ella con el frasco en la mano, 8 mL/s, leyendo la marca) y luego se vierten al matraz con E. Para medir otro reactivo hay que **enjuagar la probeta con la piseta**.
- **Sólidos:** se pesan en la **balanza con navecilla** (la espátula añade más rápido cuanto más se mantiene el clic) y se pasan al matraz con E.
- **Indicadores:** solo ellos van directo al matraz, **gota a gota** (2 gotas/s).
- **Residuos:** E sobre el recipiente de residuos vacía el matraz (animación de vertido); nunca por el fregadero.
- **Tablero de experimentos** en la pared, junto a la campana: 16 prácticas (`src/experiments/hoodRecipes.ts`) con ecuación, objetivo, materiales con su herramienta, seguridad y tipo de residuo. Al elegir una, una lista de pasos (protección → reactivos → medir y añadir → observar → cuaderno → residuos) sustituye al objetivo, el tablero marca cada paso y aparecen **flechas doradas** sobre lo que pide el paso actual; los frascos necesarios brillan en dorado. El indicador de vertido muestra el objetivo y avisa al alcanzarlo. Un paso de adición se da por hecho al llegar al 90 % de la cantidad.
- Una prueba (`hoodRecipes.test.ts`) ejecuta cada práctica con el motor químico y exige que se produzcan las reacciones prometidas, que cada cantidad quepa en su herramienta y que cada reactivo use la correcta.

## Cómo se juega

1. La estantería de reactivos está en la pared del fondo, entre la tabla periódica y la campana. Apunta a un frasco y pulsa **E** para llevarlo en la mano seleccionada (1 / 2). **Q** apuntando a la estantería lo devuelve.
2. En la campana, **Q** deja el frasco en la bandeja (hasta 8) y **E** abre la mesa de mezclas. **E** sobre la barra de la ventana la sube o la baja.
3. En el panel se elige la cantidad y se vierte. El panel se cierra para ver el vertido, las burbujas, la espuma, el precipitado, el color del indicador, el vapor y la pantalla de temperatura/pH.
4. El panel muestra cada ecuación, su ΔH° y una explicación. Permite controlar ventana (cerrada/trabajo/abierta), extractor, luz y agitador; guardar la mezcla en el cuaderno, desecharla o devolver los frascos de la bandeja.
5. El selector «Experimentos» incluye «Campana · mezclas libres» con 4 objetivos guiados.

Con la ventana cerrada no se puede verter. Si el extractor está apagado y la mezcla desprende gases o vapores, el panel avisa y el vapor sale hacia la sala en lugar de subir al conducto.

## Reactivos (disoluciones educativas definidas por el modelo)

| Grupo | Reactivos |
| --- | --- |
| Disolvente | Agua destilada |
| Ácidos | HCl 1,0 mol/L · H₂SO₄ 0,5 mol/L · CH₃COOH 0,83 mol/L (el mismo vinagre de la mesa 01) |
| Bases y carbonatos | NaOH 1,0 mol/L · Na₂CO₃ 0,5 mol/L · NaHCO₃ (s) · CaCO₃ (s, mármol) |
| Sales | NaCl 1,0 · AgNO₃ 0,1 · CuSO₄ 0,5 · FeCl₃ 0,1 · KI 0,5 · Pb(NO₃)₂ 0,1 · BaCl₂ 0,1 mol/L · CaCl₂ (s) · NH₄NO₃ (s) |
| Oxidantes | H₂O₂ 3 % (0,882 mol/L) · KMnO₄ 0,02 mol/L |
| Metales | Zn (granallas) · Mg (cinta, máx. 2 g) · Cu (alambre) · Fe (clavos) |
| Indicadores | Fenolftaleína · indicador universal · azul de bromotimol · engrudo de almidón |

Rangos: disoluciones y agua 1–200 mL; sólidos 0,05–10 g (Mg 0,05–2 g); indicadores 1–10 gotas de 0,05 mL. Matraz Erlenmeyer de 500 mL, abierto.

## Modelo (`src/chemistry/sandbox.ts`, puro y probado)

- **Reacciones completas por prioridad:** neutralización (H⁺/OH⁻, ácido acético, amonio, bicarbonato), formación de bicarbonato antes del CO₂, efervescencia, disolución ácida de hidróxidos, óxidos y carbonatos, redox en disolución (MnO₄⁻ con H₂O₂, I⁻ o Fe²⁺; H₂O₂ con I⁻ en ácido; Fe³⁺ y Cu²⁺ con I⁻; MnO₄⁻ con H₂O₂ sin ácido → MnO₂), descomposición catalítica del H₂O₂ (I⁻ o MnO₂ como catalizadores no consumidos).
- **Desplazamiento de metales** generado a partir de los potenciales estándar: un metal reduce a cualquier oxidante de mayor E° (Ag⁺, Fe³⁺, Cu²⁺, H⁺, Pb²⁺, Fe²⁺, Zn²⁺). El plomo no se usa como reductor (se pasiva) y Zn/Mg también reaccionan con ácido acético (lento en la realidad).
- **Precipitación y redisolución con Ksp ideal** en ambos sentidos (por ejemplo, PbCl₂ precipita parcialmente y se redisuelve al diluir). Las sales muy solubles (NaHCO₃, CaCl₂, NH₄NO₃) usan un producto ideal calculado de su solubilidad a 20 °C, para dejar sólido sin disolver cuando falta agua.
- **pH** por balance de cargas, con los sistemas acetato, carbonato, amonio, sulfato (HSO₄⁻) y la primera hidrólisis de Fe³⁺, Cu²⁺ y Zn²⁺. Sin coeficientes de actividad.
- **Calor:** ΔH° de cada paso a partir de ΔH°f; la mezcla se trata como agua (4,184 J g⁻¹ K⁻¹), sin pérdidas; los líquidos añadidos entran a 25 °C. Temperatura limitada a 100 °C (no se simula ebullición). Si falta un ΔH°f, el calor de ese paso no se suma y el panel lo indica.
- **Gases** CO₂, H₂ y O₂ escapan del matraz abierto; volumen de gas ideal a 25 °C y 1 atm. El NH₃ permanece disuelto y genera un aviso de olor.
- **Colores:** escala visual aproximada de iones coloreados (Cu²⁺, Fe³⁺, Fe²⁺, MnO₄⁻, Mn²⁺), yodo, complejo yodo–almidón e indicadores (fenolftaleína 8,2–10,0; bromotimol 6,0–7,6; universal 0–14). No son datos espectrofotométricos. La misma escala del indicador universal colorea el póster de pH y la gradilla de tubos de la estantería.
- **Fuera de alcance:** cinética (las animaciones duran según los moles y un factor visual cualitativo), iones complejos (p. ej. [Cu(NH₃)₄]²⁺, I₃⁻), dependencia de constantes con la temperatura, actividades, hidróxidos que precipitan solo por el pH de un tampón y reacciones de los indicadores.

## Fuentes de datos

- ΔH°f: [OpenStax Chemistry 2e, Apéndice G](https://openstax.org/books/chemistry-2e/pages/g-standard-thermodynamic-properties-for-selected-substances). Cuando no figuran: [LibreTexts T1 (CRC 84.ª ed.)](https://chem.libretexts.org/Ancillary_Materials/Reference/Reference_Tables/Thermodynamics_Tables/T1:_Standard_Thermodynamic_Quantities) para CH₃COO⁻, PbSO₄, PbCO₃, BaCO₃, CaCl₂, Mg(OH)₂ y CaCO₃ (calcita, −1207,6; OpenStax da −1220,0, inconsistente con su propia entropía); [NIST WebBook](https://webbook.nist.gov/) (JANAF) para PbI₂, Cu(OH)₂ y MgCO₃; tablas derivadas de Lange para AgI; Wikipedia citando el CRC para Ag₂SO₄, Ag₂CO₃, NaHCO₃ y Zn(OH)₂; Wikipedia citando ATcT para NH₃(ac).
- Aproximación documentada: CH₃COOH y H₂O₂ disueltos usan el ΔH°f del líquido puro (OpenStax G); se omite su pequeña entalpía de disolución.
- Sin valor de referencia (calor no estimado): CuCO₃, CuI, I₂(ac).
- Ksp: [OpenStax Apéndice J](https://openstax.org/books/chemistry-2e/pages/j-solubility-products), salvo BaSO₄, PbCO₃, Pb(OH)₂, Zn(OH)₂ y MgCO₃ anhidro, tomados de [LibreTexts E3 (CRC)](https://chem.libretexts.org/Ancillary_Materials/Reference/Reference_Tables/Equilibrium_Constants/E3._Solubility_Constants_for_Compounds_at_25C) porque OpenStax difiere en órdenes de magnitud o lista otro hidrato. CaSO₄ usa el valor del dihidrato. Ag₂O se modela con el Ksp de ½Ag₂O (AgOH) al cuadrado.
- Ka: [OpenStax Apéndice H](https://openstax.org/books/chemistry-2e/pages/h-ionization-constants-of-weak-acids) e [I](https://openstax.org/books/chemistry-2e/pages/i-ionization-constants-of-weak-bases) (NH₄⁺ = Kw/Kb); hidrólisis de iones metálicos de [OpenStax 14.4](https://openstax.org/books/chemistry-2e/pages/14-4-hydrolysis-of-salts).
- E°: [OpenStax Apéndice L](https://openstax.org/books/chemistry-2e/pages/l-standard-electrode-half-cell-potentials).
- Solubilidad a 20 °C: NaHCO₃ 9,6 g/100 g ([PubChem CID 516892](https://pubchem.ncbi.nlm.nih.gov/compound/516892)); CaCl₂ 74,5 g/100 mL ([PubChem CID 5284359](https://pubchem.ncbi.nlm.nih.gov/compound/5284359)); NH₄NO₃ 192 g/100 mL ([tabla de solubilidad](https://en.wikipedia.org/wiki/Solubility_table)). Se aproximan 100 mL de agua a 100 g.
- Masas molares: pesos atómicos estándar IUPAC abreviados (`src/chemistry/formula.ts`).

## Escena y código

| Archivo | Contenido |
| --- | --- |
| `src/chemistry/species.ts`, `constants.ts`, `reagents.ts`, `formula.ts` | Datos de especies, constantes, catálogo y masas molares |
| `src/chemistry/sandbox.ts` | Motor de mezcla, pH, colores y análisis; pruebas en `sandbox.test.ts` |
| `src/state/hood.ts` | Frascos (estantería/manos/bandeja), vertido de 1,5 s, controles, registro y cuaderno (`experimenta.hood.v1`, 30 mezclas) |
| `src/world/ReagentShelf.tsx`, `ReagentBottle.tsx` | Estantería, frascos con etiquetas en un único atlas de textura, póster y gradilla de pH |
| `src/world/FumeHood.tsx` | Campana con ventana deslizante, luz, conducto, monitor de extracción, agitador con imán, matraz, sonda de temperatura/pH y efectos |
| `src/ui/HoodPanel.tsx`, `hood.css` | Panel de mezcla, registro de reacciones y ficha del cuaderno |

Las posiciones de la estantería (x 3,3; z −4,72) y la campana son decisiones de diseño, no medidas del laboratorio de referencia. La estantería tiene su propia caja de colisión.
