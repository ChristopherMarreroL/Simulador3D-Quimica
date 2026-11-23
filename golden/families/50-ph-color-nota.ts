import type { CaseSpec, Family, MixtureSpec, StepSpec } from '../lib/types';

/** Familias «ph», «color» y «nota»: solvePH, indicatorColor/solutionColor y el texto `note` de addReagent. */

type Seq = [reagent: string, amount: number][];
const steps = (seq: Seq): StepSpec[] => seq.map(([reagent, amount]) => ({ reagent, amount }));
/** Mezcla a mano en 1 L: los moles coinciden con mol/L. */
const litre = (n: Record<string, number>, extra: Partial<MixtureSpec> = {}): MixtureSpec => ({ n, waterMl: 1000, ...extra });
const es = (x: number | string) => String(x).replace('.', ',');

const family: Family = ctx => {
  const cases: CaseSpec[] = [];
  const fired = (seq: Seq) => JSON.stringify(ctx.trace(steps(seq)).fired);
  /** El último paso no da ningún evento visible (los anteriores sí pueden). */
  const lastIsSilent = (seq: Seq) => fired(seq) === fired(seq.slice(0, -1));

  // ───────────────────────────── ph: valoraciones ─────────────────────────────
  // Dosis pequeñas (1 mL) alrededor del punto de equivalencia; varias llevan indicador para seguir el viraje.
  const titrations: { name: string; why: string; start: Seq; titrant: string; doses: number[]; mustFire: string[] }[] = [
    { name: 'hcl-naoh', why: 'Valoración de 100 mL de HCl con NaOH y fenolftaleína: salto en 100 mL exactos y viraje a rosa.', start: [['hcl', 100], ['phenolphthalein', 3]], titrant: 'naoh', doses: [90, 5, 2, 1, 1, 1, 1, 1, 5], mustFire: ['neutral-strong'] },
    { name: 'acetico-naoh', why: 'Valoración de ácido acético con NaOH: zona tampón, equivalencia básica en 83 mL y exceso de base.', start: [['acetic', 100], ['phenolphthalein', 3]], titrant: 'naoh', doses: [40, 30, 10, 2, 1, 1, 1, 5], mustFire: ['neutral-acetic'] },
    { name: 'naoh-hcl', why: 'Valoración inversa de NaOH con HCl y azul de bromotimol: de azul a amarillo al pasar por 50 mL.', start: [['naoh', 50], ['bromothymol', 3]], titrant: 'hcl', doses: [40, 5, 3, 1, 1, 1, 1, 5], mustFire: ['neutral-strong'] },
    { name: 'na2co3-hcl', why: 'Valoración de carbonato con HCl e indicador universal: primer salto a bicarbonato (25 mL) y segundo con CO2 (50 mL).', start: [['na2co3', 50], ['universal', 3]], titrant: 'hcl', doses: [20, 4, 1, 1, 14, 8, 1, 1, 1, 5], mustFire: ['carbonate-strong', 'co2-strong'] },
    { name: 'h2so4-naoh', why: 'Valoración de ácido sulfúrico con NaOH: el sistema HSO4-/SO4-2 fija el pH antes de la equivalencia (50 mL).', start: [['h2so4', 50]], titrant: 'naoh', doses: [40, 5, 3, 1, 1, 1, 1, 5], mustFire: ['neutral-strong'] },
    { name: 'nh4no3-naoh', why: 'Nitrato de amonio disuelto valorado con NaOH: tampón amonio/amoníaco y olor a amoníaco a partir del segundo vertido.', start: [['water', 100], ['nh4no3', 4]], titrant: 'naoh', doses: [1, 19, 20, 5, 3, 1, 1, 1, 5], mustFire: ['ksp-NH4NO3(s)', 'neutral-ammonium'] },
    { name: 'fecl3-naoh', why: 'FeCl3 con NaOH: precipita Fe(OH)3 y el pH lo da la hidrólisis del Fe3+ restante hasta los 30 mL.', start: [['fecl3', 100]], titrant: 'naoh', doses: [10, 10, 5, 3, 1, 1, 1, 1, 5], mustFire: ['ksp-Fe(OH)3'] },
    { name: 'cuso4-naoh', why: 'CuSO4 con NaOH: precipita Cu(OH)2 y el pH salta al agotarse el Cu2+ en 50 mL.', start: [['cuso4', 50]], titrant: 'naoh', doses: [20, 20, 5, 3, 1, 1, 1, 1, 5], mustFire: ['ksp-Cu(OH)2'] },
  ];
  for (const t of titrations) cases.push({ id: `ph/valoracion-${t.name}`, fn: 'sequence', why: t.why, steps: steps([...t.start, ...t.doses.map(d => [t.titrant, d] as [string, number])]), mustFire: t.mustFire });

  // ───────────────────────────── ph: solvePH directo ─────────────────────────────
  const direct: [name: string, why: string, mixture: MixtureSpec][] = [];
  // Ácido y base fuertes de 1e-8 a 5 mol/L (a 1e-8 manda la autoionización del agua).
  for (const [c, tag] of [[1e-8, '1e-8'], [1e-6, '1e-6'], [1e-3, '1e-3'], [1, '1'], [5, '5']] as [number, string][]) {
    direct.push([`hcl-${tag}`, `HCl ${tag} mol/L escrito a mano.`, litre({ 'H+': c, 'Cl-': c })]);
    direct.push([`naoh-${tag}`, `NaOH ${tag} mol/L escrito a mano.`, litre({ 'Na+': c, 'OH-': c })]);
  }
  direct.push(
    ['agua-pura', 'Agua sin solutos: pH 7.', { waterMl: 100 }],
    ['agua-neutros', 'Solo especies sin carga y un sólido: no entran en el balance, pH 7.', litre({ H2O2: 0.1, I2: 0.001, AgCl: 0.01 })],
    // Los siete sistemas, cada uno aislado.
    ['acetico', 'Sistema acético solo: ácido débil 0,1 mol/L.', litre({ HAc: 0.1 })],
    ['acetato-sodio', 'Sistema acético solo: base conjugada con Na+ (hidrólisis básica).', litre({ 'Na+': 0.1, 'Ac-': 0.1 })],
    ['tampon-acetico', 'Tampón acético/acetato equimolar: pH ≈ pKa.', litre({ HAc: 0.05, 'Ac-': 0.05, 'Na+': 0.05 })],
    ['bicarbonato-sodio', 'Sistema carbónico solo: anfolito NaHCO3 0,1 mol/L.', litre({ 'Na+': 0.1, 'HCO3-': 0.1 })],
    ['carbonato-sodio', 'Sistema carbónico solo: Na2CO3 0,1 mol/L, las dos constantes en juego.', litre({ 'Na+': 0.2, 'CO3-2': 0.1 })],
    ['tampon-carbonato', 'Tampón bicarbonato/carbonato equimolar: pH ≈ pKa2.', litre({ 'Na+': 0.15, 'HCO3-': 0.05, 'CO3-2': 0.05 })],
    ['amonio-nitrato', 'Sistema amonio solo: NH4NO3 0,1 mol/L, ácido muy débil.', litre({ 'NH4+': 0.1, 'NO3-': 0.1 })],
    ['amoniaco', 'Sistema amonio solo: NH3 0,1 mol/L, base débil.', litre({ NH3: 0.1 })],
    ['tampon-amonio', 'Tampón amonio/amoníaco equimolar: pH ≈ pKa del amonio.', litre({ 'NH4+': 0.05, NH3: 0.05, 'NO3-': 0.05 })],
    ['sulfato-sodio', 'Sistema sulfato solo: Na2SO4, levemente básico por HSO4-.', litre({ 'Na+': 0.2, 'SO4-2': 0.1 })],
    ['acido-sulfurico', 'Sistema sulfato en ácido: H2SO4 0,5 mol/L, segunda disociación parcial.', litre({ 'H+': 1, 'SO4-2': 0.5 })],
    ['hierro3-cloruro', 'Hidrólisis del Fe3+ sola: FeCl3 0,1 mol/L.', litre({ 'Fe3+': 0.1, 'Cl-': 0.3 })],
    ['cobre-nitrato', 'Hidrólisis del Cu2+ sola: Cu(NO3)2 0,1 mol/L.', litre({ 'Cu2+': 0.1, 'NO3-': 0.2 })],
    ['cinc-cloruro', 'Hidrólisis del Zn2+ sola: ZnCl2 0,1 mol/L.', litre({ 'Zn2+': 0.1, 'Cl-': 0.2 })],
    // Sistemas combinados.
    ['sulfato-cobre', 'Cu2+ y sulfato a la vez: CuSO4 0,5 mol/L como el frasco.', litre({ 'Cu2+': 0.5, 'SO4-2': 0.5 })],
    ['acetato-amonio', 'Acético y amonio a la vez: acetato de amonio, neutro porque Ka y Kb coinciden.', litre({ 'NH4+': 0.1, 'Ac-': 0.1 })],
    ['tres-metales', 'Fe3+, Cu2+ y Zn2+ juntos con cloruro: domina el más ácido.', litre({ 'Fe3+': 0.01, 'Cu2+': 0.05, 'Zn2+': 0.05, 'Cl-': 0.23 })],
    ['hierro3-con-hcl', 'Fe3+ con ácido fuerte: la hidrólisis queda reprimida.', litre({ 'Fe3+': 0.05, 'H+': 0.5, 'Cl-': 0.65 })],
    ['siete-sistemas', 'Los siete sistemas a la vez, en 250 mL y con espectadores que no cuadran en carga.', { n: { HAc: 0.005, 'Ac-': 0.0075, 'HCO3-': 0.0025, 'CO3-2': 0.0025, 'NH4+': 0.005, NH3: 0.0025, 'SO4-2': 0.005, 'Fe3+': 0.00025, 'Cu2+': 0.0005, 'Zn2+': 0.00075, 'Na+': 0.02, 'Cl-': 0.004 }, waterMl: 250, temperatureC: 31 }],
    ['temperatura-no-influye', 'El mismo acético 0,1 mol/L a 80 °C: las constantes no dependen de la temperatura.', litre({ HAc: 0.1 }, { temperatureC: 80 })],
    // Espectadores que no cuadran en carga: el balance pone el H+ u OH- que falta.
    ['solo-sodio', 'Na+ sin anión: el balance lo compensa con OH- (pH 12).', litre({ 'Na+': 0.01 })],
    ['solo-cloruro', 'Cl- sin catión: el balance lo compensa con H+ (pH 2).', litre({ 'Cl-': 0.01 })],
    ['bario-permanganato', 'Espectadores de carga 2+ y 1− descompensados hacia el lado ácido.', litre({ 'Ba2+': 0.01, 'MnO4-': 0.03 })],
    ['solo-sulfato', 'Sulfato sin catión: parte queda como HSO4- y el resto lo compensa H+.', litre({ 'SO4-2': 0.1 })],
    ['solo-bicarbonato', 'Bicarbonato sin catión: equivale a ácido carbónico 0,1 mol/L.', litre({ 'HCO3-': 0.1 })],
    ['solo-amonio', 'Amonio sin anión: da el mismo pH que el amoníaco 0,1 mol/L (solo cuenta el total del sistema).', litre({ 'NH4+': 0.1 })],
    ['h-sin-contraion', 'H+ sin anión: solvePH no lee los moles de H+ y devuelve 7.', litre({ 'H+': 0.1 })],
    ['h-con-sodio', 'H+ y Na+ a partes iguales: los H+ se ignoran y el Na+ da pH 13.', litre({ 'H+': 0.1, 'Na+': 0.1 })],
    // Topes del intervalo de bisección [−2, 16].
    ['tope-inferior', 'Cl- 500 mol/L: el pH querría ser −2,7 y la bisección se queda en −2.', { n: { 'Cl-': 50 }, waterMl: 100 }],
    ['tope-superior', 'Na+ 500 mol/L: el pH querría ser 16,7 y la bisección se queda en 16.', { n: { 'Na+': 50 }, waterMl: 100 }],
    ['casi-tope-inferior', 'Cl- 99 mol/L: la raíz (−1,996) cae justo dentro del intervalo.', { n: { 'Cl-': 9.9 }, waterMl: 100 }],
    ['casi-tope-superior', 'Na+ 99 mol/L: la raíz (15,996) cae justo dentro del intervalo.', { n: { 'Na+': 9.9 }, waterMl: 100 }],
    // Sin líquido.
    ['sin-agua', 'waterMl 0 con iones: devuelve null.', { n: { 'H+': 0.01, 'Cl-': 0.01 }, waterMl: 0 }],
  );
  for (const [name, why, mixture] of direct) cases.push({ id: `ph/${name}`, fn: 'solvePH', why, mixture });
  cases.push({ id: 'ph/sin-agua-secuencia', fn: 'solvePH', why: 'Solo un sólido en el matraz: sin líquido el pH es null.', mixture: { steps: steps([['zn', 1]]) } });

  // ───────────────────────────── color: indicatorColor ─────────────────────────────
  const grid = Array.from({ length: 37 }, (_, i) => -2 + i * 0.5); // −2 … 16; múltiplos exactos de 0,5
  const universalNodes = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14];
  /** Quiebres de las rampas y sus vecinos a ±0,01 y ±1e-9, todos como literales. */
  const breaks: Record<string, number[]> = {
    '6': [5.99, 5.999999999, 6, 6.000000001, 6.01],
    '6.8': [6.79, 6.799999999, 6.8, 6.800000001, 6.81],
    '7.6': [7.59, 7.599999999, 7.6, 7.600000001, 7.61],
    '8.2': [8.19, 8.199999999, 8.2, 8.200000001, 8.21],
    '10': [9.99, 9.999999999, 10, 10.000000001, 10.01],
  };
  // Cada indicador recibe la rejilla y los quiebres de su propia rampa (6 y 10 son además nodos de la universal).
  const indicators: [id: string, name: string, own: string[]][] = [
    ['universal', 'Indicador universal', ['6', '10']],
    ['bromothymol', 'Azul de bromotimol', ['6', '6.8', '7.6']],
    ['phenolphthalein', 'Fenolftaleína', ['8.2', '10']],
  ];
  const phTag = (pH: number) => String(pH).replace('-', 'm');
  for (const [id, name, own] of indicators) {
    const exact = new Set([...(id === 'universal' ? universalNodes : []), ...own.map(Number)]);
    const neighbours = new Set(own.flatMap(b => breaks[b]).filter(v => !exact.has(v)));
    for (const pH of [...new Set([...grid, ...exact, ...neighbours])].sort((a, b) => a - b)) {
      const why = exact.has(pH) ? `${name} en el quiebre exacto pH ${es(pH)}.` : neighbours.has(pH) ? `${name} a pH ${es(pH)}, pegado a un quiebre de su rampa.` : `${name} a pH ${es(pH)} (rejilla de 0,5).`;
      cases.push({ id: `color/ind-${id}-ph-${phTag(pH)}`, fn: 'indicatorColor', why, indicator: id, pH });
    }
  }
  // El almidón devuelve null sin mirar el pH: bastan los extremos y los quiebres de los demás.
  for (const pH of [-2, 7, 8.2, 10, 16]) cases.push({ id: `color/ind-starch-ph-${phTag(pH)}`, fn: 'indicatorColor', why: `El almidón no tiene color propio: null a pH ${es(pH)}.`, indicator: 'starch', pH });
  cases.push({ id: 'color/ind-desconocido', fn: 'indicatorColor', why: 'Un indicador que no existe devuelve null.', indicator: 'tornasol', pH: 7 });

  // ───────────────────────────── color: solutionColor ─────────────────────────────
  const color = (name: string, why: string, mixture: MixtureSpec | { steps: StepSpec[] }, pH: number | null | 'solve' = null) => cases.push({ id: `color/${name}`, fn: 'solutionColor', why, mixture, pH });
  // Cada ion recorre su curva 1 − exp(−k·c): se elige x = k·c y la concentración es x / k.
  const ions: [id: string, k: number, tag: string][] = [['Cu2+', 3.5, 'cu2'], ['Fe3+', 14, 'fe3'], ['Fe2+', 2.5, 'fe2'], ['MnO4-', 2200, 'mno4'], ['Mn2+', 0.4, 'mn2'], ['I2', 500, 'i2']];
  const curve: [x: number, tag: string, what: string][] = [
    [0.005, 'bajo-umbral', 'peso ≈ 0,00499, justo por debajo del umbral de capa: no colorea'],
    [0.00503, 'sobre-umbral', 'peso ≈ 0,00502, justo por encima del umbral de capa'],
    [0.1, 'tenue', 'peso ≈ 0,10'],
    [0.7, 'medio', 'peso ≈ 0,50'],
    [2.5, 'intenso', 'peso ≈ 0,92'],
    [5, 'saturado', 'peso > 0,96: se recorta a 0,96'],
  ];
  for (const [id, k, tag] of ions) for (const [x, level, what] of curve) color(`ion-${tag}-${level}`, `${id} a ${es(Number((x / k).toPrecision(3)))} mol/L (${what}).`, litre({ [id]: x / k }));
  // Yodo y almidón: el almidón solo actúa por encima de 2e-6 mol/L de I2.
  for (const [c, tag, starch, what] of [
    [1.9e-6, '1.9e-6', true, 'por debajo de 2e-6 mol/L el almidón no actúa y el yodo solo no llega al umbral de capa'],
    [2.1e-6, '2.1e-6', true, 'justo por encima de 2e-6 mol/L aparece el azul oscuro'],
    [2.1e-6, '2.1e-6', false, 'sin almidón esa concentración no colorea'],
    [1e-4, '1e-4', true, 'azul oscuro a media intensidad'],
    [1e-4, '1e-4', false, 'pardo tenue a la misma concentración'],
    [1e-3, '1e-3', true, 'azul oscuro saturado'],
  ] as [number, string, boolean, string][]) color(`yodo-${tag}-${starch ? 'con' : 'sin'}-almidon`, `I2 ${tag} mol/L ${starch ? 'con' : 'sin'} almidón: ${what}.`, litre({ I2: c }, starch ? { indicators: ['starch'] } : {}));
  color('yodo-almidon-universal', 'Yodo con almidón e indicador universal a pH 7: el almidón no añade capa propia.', litre({ I2: 1e-4 }, { indicators: ['starch', 'universal'] }), 7);
  // Mezclas de dos y tres iones coloreados.
  color('mezcla-cu-fe3', 'Cu2+ y Fe3+: media ponderada de azul y naranja.', litre({ 'Cu2+': 0.1, 'Fe3+': 0.02 }));
  color('mezcla-mno4-fe3', 'Permanganato diluido con Fe3+: violeta y naranja.', litre({ 'MnO4-': 2e-4, 'Fe3+': 0.05 }));
  color('mezcla-fe3-yodo', 'Fe3+ y yodo sin almidón: dos pardos distintos.', litre({ 'Fe3+': 0.03, I2: 0.002 }));
  color('mezcla-cu-fe2-mn2', 'Tres iones pálidos: Cu2+, Fe2+ y Mn2+.', litre({ 'Cu2+': 0.2, 'Fe2+': 0.2, 'Mn2+': 0.5 }));
  color('mezcla-cu-yodo-almidon', 'Cu2+ con yodo y almidón: azul claro y azul oscuro.', litre({ 'Cu2+': 0.1, I2: 5e-4 }, { indicators: ['starch'] }));
  color('mezcla-capa-ausente', 'Fe3+ visible y Cu2+ bajo el umbral: solo una capa entra en la mezcla.', litre({ 'Fe3+': 0.05, 'Cu2+': 0.001 }));
  // Indicadores: varios a la vez y en distinto orden.
  const orders: [tag: string, list: string[], pH: number][] = [
    ['uni-bro', ['universal', 'bromothymol'], 7], ['bro-uni', ['bromothymol', 'universal'], 7],
    ['fen-uni-bro', ['phenolphthalein', 'universal', 'bromothymol'], 9.5], ['bro-uni-fen', ['bromothymol', 'universal', 'phenolphthalein'], 9.5],
  ];
  for (const [tag, list, pH] of orders) color(`indicadores-${tag}`, `Indicadores en el orden ${list.join(', ')} a pH ${es(pH)}.`, { waterMl: 100, indicators: list }, pH);
  color('indicadores-con-cobre', 'Cu2+ con bromotimol y fenolftaleína a pH 9: ion e indicadores en la misma mezcla.', litre({ 'Cu2+': 0.1 }, { indicators: ['bromothymol', 'phenolphthalein'] }), 9);
  color('indicadores-con-cobre-inverso', 'Cu2+ a pH 9 con fenolftaleína antes que bromotimol: orden inverso de capas.', litre({ 'Cu2+': 0.1 }, { indicators: ['phenolphthalein', 'bromothymol'] }), 9);
  color('fenolftaleina-bajo-umbral', 'Fenolftaleína a pH 8,21: tiene color pero su fuerza (0,0046) no llega al umbral de capa.', { waterMl: 100, indicators: ['phenolphthalein'] }, 8.21);
  color('fenolftaleina-sobre-umbral', 'Fenolftaleína a pH 8,212: fuerza 0,0055, primera capa rosa.', { waterMl: 100, indicators: ['phenolphthalein'] }, 8.212);
  color('indicador-resuelto-fe3', 'FeCl3 con indicador universal y pH resuelto: naranja del ion y rojo del indicador.', litre({ 'Fe3+': 0.1, 'Cl-': 0.3 }, { indicators: ['universal'] }), 'solve');
  color('indicador-resuelto-naoh', 'NaOH 0,01 mol/L con fenolftaleína y pH resuelto: rosa pleno.', litre({ 'Na+': 0.01, 'OH-': 0.01 }, { indicators: ['phenolphthalein'] }), 'solve');
  // pH null, sin líquido y casos sin capas.
  color('agua-pura', 'Agua sin iones ni indicadores: color por defecto.', { waterMl: 100 }, 7);
  color('ph-null-indicadores', 'Líquido con indicadores y pH null: los indicadores no cuentan y queda el color por defecto.', { waterMl: 100, indicators: ['universal', 'phenolphthalein'] }, null);
  color('ph-null-cobre-indicador', 'Cu2+ con indicador universal y pH null: solo cuenta el ion.', litre({ 'Cu2+': 0.1 }, { indicators: ['universal'] }), null);
  color('sin-liquido', 'V = 0 con iones e indicador: color del matraz vacío y opacidad 0.', { n: { 'Cu2+': 0.1 }, waterMl: 0, indicators: ['universal'] }, 7);
  color('sin-liquido-secuencia', 'Solo cobre metálico en el matraz: sin líquido no hay color.', { steps: steps([['cu', 1]]) }, 'solve');
  // Saturación de la opacidad.
  color('saturacion-tres-capas', 'Tres capas recortadas a 0,96: la opacidad se acerca a su máximo (0,92).', litre({ 'Cu2+': 2, 'Fe3+': 1, 'MnO4-': 0.01 }));
  color('saturacion-todo', 'Los seis iones saturados, almidón y tres indicadores a pH 12: nueve capas.', litre({ 'Cu2+': 2, 'Fe3+': 1, 'Fe2+': 3, 'MnO4-': 0.01, 'Mn2+': 12.5, I2: 0.01 }, { indicators: ['starch', 'universal', 'bromothymol', 'phenolphthalein'] }), 12);
  // El camino del juego: mezclas que salen de secuencias reales.
  const paths: [name: string, why: string, seq: Seq][] = [
    ['juego-cuso4-naoh', 'CuSO4 con poca NaOH: el Cu2+ que queda en disolución sigue azul.', [['cuso4', 50], ['naoh', 10]]],
    ['juego-permanganato-decolorado', 'Permanganato reducido por peróxido en medio ácido: queda el rosa muy pálido del Mn2+.', [['kmno4', 50], ['h2so4', 20], ['h2o2', 5]]],
    ['juego-yodo-almidon', 'Yodo formado por Fe3+ y yoduro, con almidón: azul oscuro sobre el verde del Fe2+.', [['ki', 20], ['fecl3', 50], ['starch', 3]]],
    ['juego-hierro-desplaza-cobre', 'Hierro en CuSO4: el azul pasa al verde pálido del Fe2+.', [['cuso4', 20], ['fe', 1]]],
    ['juego-fecl3-universal', 'FeCl3 del frasco con indicador universal.', [['fecl3', 20], ['universal', 3]]],
    ['juego-naoh-universal-fenolftaleina', 'NaOH con universal y después fenolftaleína.', [['naoh', 20], ['universal', 3], ['phenolphthalein', 3]]],
    ['juego-naoh-fenolftaleina-universal', 'NaOH con fenolftaleína y después universal: mismo contenido, otro orden de indicadores.', [['naoh', 20], ['phenolphthalein', 3], ['universal', 3]]],
  ];
  for (const [name, why, seq] of paths) color(name, why, { steps: steps(seq) }, 'solve');

  // ───────────────────────────── nota ─────────────────────────────
  // `last` fija la intención sobre el último paso: 'eventos' (nota vacía) o 'silencio' (alguna de las notas de texto).
  const notes: { name: string; why: string; seq: Seq; last: 'eventos' | 'silencio'; mustFire?: string[] }[] = [
    // Sin agua.
    { name: 'sin-agua-solido', why: 'Un sólido en el matraz seco: nota «Sin agua…».', seq: [['zn', 1]], last: 'silencio' },
    { name: 'sin-agua-dos-solidos', why: 'Dos sólidos distintos y sigue sin haber líquido: la nota «Sin agua…» gana a todas las demás.', seq: [['nahco3', 2], ['caco3', 1]], last: 'silencio' },
    // Con eventos: nota vacía.
    { name: 'eventos-neutralizacion', why: 'Un vertido con reacción visible deja la nota vacía.', seq: [['hcl', 25], ['naoh', 25]], last: 'eventos', mustFire: ['neutral-strong'] },
    { name: 'eventos-tras-solido-seco', why: 'Ácido sobre bicarbonato seco: pasa de «Sin agua…» a nota vacía.', seq: [['nahco3', 1], ['hcl', 25]], last: 'eventos', mustFire: ['bicarbonate-solid-strong'] },
    { name: 'eventos-indicador', why: 'Las gotas de indicador disuelven más bicarbonato sólido: hay evento y la nota del indicador no aparece.', seq: [['water', 50], ['nahco3', 10], ['universal', 10]], last: 'eventos', mustFire: ['ksp-NaHCO3(s)'] },
    { name: 'eventos-almidon', why: 'Gotas de almidón sobre bicarbonato sin disolver: el evento de disolución vacía la nota del almidón.', seq: [['water', 50], ['nahco3', 10], ['starch', 10]], last: 'eventos', mustFire: ['ksp-NaHCO3(s)'] },
    { name: 'eventos-agua', why: 'Agua sobre bicarbonato sin disolver: hay evento y no sale la nota de dilución.', seq: [['water', 50], ['nahco3', 10], ['water', 20]], last: 'eventos', mustFire: ['ksp-NaHCO3(s)'] },
    // Almidón.
    { name: 'almidon-sin-yodo', why: 'Almidón en agua: nota del almidón.', seq: [['water', 50], ['starch', 3]], last: 'silencio' },
    { name: 'almidon-primero', why: 'Almidón como primer vertido: su nota gana a la de «primer reactivo».', seq: [['starch', 3]], last: 'silencio' },
    { name: 'almidon-con-yoduro', why: 'Almidón con yoduro pero sin yodo: misma nota.', seq: [['ki', 20], ['starch', 3]], last: 'silencio' },
    { name: 'almidon-con-yodo', why: 'Almidón con yodo ya formado: el color cambia a azul oscuro pero la nota sigue diciendo «solo… si hay yodo».', seq: [['ki', 20], ['fecl3', 50], ['starch', 3]], last: 'silencio', mustFire: ['iron-iodide'] },
    // Indicador: «pH ≈ x,x».
    { name: 'indicador-ph-7', why: 'Bromotimol en agua: pH entero «7».', seq: [['water', 50], ['bromothymol', 3]], last: 'silencio' },
    { name: 'indicador-primero', why: 'Indicador como primer vertido: su nota gana a la de «primer reactivo».', seq: [['universal', 5]], last: 'silencio' },
    { name: 'indicador-sobre-solido', why: 'Gotas de indicador sobre cinc seco: son el primer líquido y el pH es 7.', seq: [['zn', 1], ['universal', 3]], last: 'silencio' },
    { name: 'indicador-ph-0', why: 'HCl 1 mol/L con una gota: el pH más bajo alcanzable (0,0001), se escribe «0».', seq: [['hcl', 200], ['universal', 1]], last: 'silencio' },
    { name: 'indicador-un-decimal', why: 'Vinagre con indicador universal: pH con un decimal y coma («2,4»).', seq: [['acetic', 50], ['universal', 3]], last: 'silencio' },
    { name: 'indicador-redondea-a-entero', why: 'Acético diluido con pH 3,001: el decimal cero no se escribe («3»).', seq: [['acetic', 10], ['water', 137], ['bromothymol', 3]], last: 'silencio' },
    { name: 'indicador-ph-14', why: 'NaOH 1 mol/L con fenolftaleína: pH 13,997, mayor que 10 y redondeado a «14».', seq: [['naoh', 25], ['phenolphthalein', 3]], last: 'silencio' },
    { name: 'indicador-ph-11-decimal', why: 'Carbonato de sodio diluido con fenolftaleína: pH mayor que 10 con un decimal («11,5»).', seq: [['na2co3', 10], ['water', 100], ['phenolphthalein', 2]], last: 'silencio' },
    { name: 'indicador-repetido', why: 'El mismo indicador dos veces: no se duplica en la lista y la segunda nota recalcula el pH con más volumen.', seq: [['naoh', 5], ['water', 100], ['phenolphthalein', 3], ['phenolphthalein', 10]], last: 'silencio' },
    // A propósito: pH a menos de 1e-7 de x,x5; quedan marcados «nota-redondeo-ph». El agua se ajustó a la micra de mL.
    { name: 'indicador-redondeo-bajo', why: 'HCl diluido con pH 1,24999997: un pelo por debajo de 1,25, la nota dice «1,2».', seq: [['hcl', 10], ['water', 167.67793], ['universal', 3]], last: 'silencio' },
    { name: 'indicador-redondeo-alto', why: 'Acético diluido con pH 2,75000003: un pelo por encima de 2,75, la nota dice «2,8».', seq: [['acetic', 20], ['water', 73.392024], ['bromothymol', 3]], last: 'silencio' },
    // Primer reactivo.
    { name: 'primero-liquido', why: 'Primer vertido de una disolución: «… en el matraz. Añade otro reactivo…».', seq: [['hcl', 25]], last: 'silencio' },
    { name: 'primero-repetido', why: 'El mismo reactivo dos veces sigue contando como primero.', seq: [['naoh', 10], ['naoh', 10]], last: 'silencio' },
    { name: 'primero-agua-dos-veces', why: 'Agua sobre agua: sale la nota de primer reactivo, no la de dilución.', seq: [['water', 50], ['water', 50]], last: 'silencio' },
    // Dilución con agua.
    { name: 'dilucion', why: 'Agua sobre HCl: nota de dilución.', seq: [['hcl', 25], ['water', 50]], last: 'silencio' },
    { name: 'dilucion-sobre-metal', why: 'Agua sobre cobre seco: no hay nada disuelto y aun así sale la nota de dilución.', seq: [['cu', 1], ['water', 50]], last: 'silencio' },
    { name: 'dilucion-agcl', why: 'Agua sobre una mezcla con AgCl precipitado: se disuelve menos de 1 µmol (0 eventos), hay calor y sale la nota de dilución.', seq: [['agno3', 50], ['nacl', 10], ['water', 100]], last: 'silencio', mustFire: ['ksp-AgCl'] },
    // «No se observan cambios».
    { name: 'sin-cambios-disoluciones', why: 'Dos disoluciones que no reaccionan: «No se observan cambios…».', seq: [['hcl', 25], ['nacl', 25]], last: 'silencio' },
    { name: 'sin-cambios-metal', why: 'Cobre en HCl: el metal no reacciona y sale «No se observan cambios…».', seq: [['hcl', 25], ['cu', 1]], last: 'silencio' },
    { name: 'sin-cambios-reactivo-repetido', why: 'Repetir HCl después de otro reactivo ya no cuenta como primero.', seq: [['hcl', 25], ['nacl', 25], ['hcl', 25]], last: 'silencio' },
    { name: 'sin-cambios-disolucion-invisible', why: 'Mármol en 10 mL de agua: se disuelve menos de 1 µmol, sin evento; el pH sube a 9,8 y la nota dice que no hay cambios.', seq: [['water', 10], ['caco3', 1]], last: 'silencio' },
  ];
  for (const n of notes) {
    if (lastIsSilent(n.seq) !== (n.last === 'silencio')) throw new Error(`nota/${n.name}: el último paso debía quedar en «${n.last}».`);
    cases.push({ id: `nota/${n.name}`, fn: 'sequence', why: n.why, steps: steps(n.seq), ...(n.mustFire ? { mustFire: n.mustFire } : {}) });
  }
  return cases;
};
export default family;
