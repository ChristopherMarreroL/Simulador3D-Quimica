import type { CaseSpec, ErrorCode, Family, Num } from '../lib/types';

/**
 * Prácticas clásicas de las mesas 01–03 (reaction.ts y solutions.ts) y su cruce con la campana.
 * Ejecutar: GOLDEN_FAMILY=80-clasico npm run golden
 * Los límites de estas tres funciones son estrictos (sin la tolerancia de 1e-9 de addReagent): los casos
 * «fuera» usan el número representable contiguo al límite.
 */
type Fail = ErrorCode | undefined;
const NON_FINITE: Num[] = ['NaN', 'Infinity', '-Infinity'];
const slug = (v: Num) => String(v).toLowerCase().replace('-', 'menos-');
const err = (mustError: Fail) => (mustError ? { mustError } : {});

const reaction = (name: string, why: string, vinegarMl: Num, concentration: Num, bicarbonateG: Num, mustError?: Fail): CaseSpec =>
  ({ id: `clasico-reaccion/${name}`, fn: 'calculateReaction', why, input: { vinegarMl, concentration, bicarbonateG }, ...err(mustError) });
const conduct = (name: string, why: string, solution: string, concentration: Num, mustError?: Fail): CaseSpec =>
  ({ id: `clasico-conductividad/${name}`, fn: 'conductivity', why, input: { solution, concentration }, ...err(mustError) });
const crystal = (name: string, why: string, waterG: Num, saltG: Num, evaporationPercent: Num, mustError?: Fail): CaseSpec =>
  ({ id: `clasico-cristalizacion/${name}`, fn: 'crystallization', why, input: { waterG, saltG, evaporationPercent }, ...err(mustError) });

function reactionCases(): CaseSpec[] {
  const cases: CaseSpec[] = [
    // reaction.test.ts
    reaction('prueba-acido-limitante', 'Prueba unitaria: 50 mL a 0,83 mol/L con 5 g; limita el ácido y sobra bicarbonato.', 50, 0.83, 5),
    reaction('prueba-bicarbonato-limitante', 'Prueba unitaria: 100 mL a 1 mol/L con 1 g; limita el bicarbonato y sobra ácido.', 100, 1, 1),
    reaction('prueba-proporcion', 'Prueba unitaria «proporción exacta» (84,0066/10 g): los moles difieren en un ulp (1,4e-17) y entra por la tolerancia, no por igualdad.', 100, 1, 8.40066),
    ...([0, -1, 151] as const).map(v => reaction(`prueba-volumen-${slug(v)}`, `Prueba unitaria: volumen ${v} mL fuera de 1–150.`, v, 1, 2, 'RANGE')),

    // Rama |ácido − bicarbonato| < 1e-9 (tolerancia absoluta en moles)
    reaction('igual-exacto-1ml', 'Moles exactamente iguales (0,001 y 0,001): diferencia 0 y ningún sobrante.', 1, 1, 0.0840066),
    reaction('igual-exacto-22ml', 'Moles exactamente iguales (0,022) a mayor escala: diferencia 0.', 22, 1, 1.8481452),
    reaction('dentro-sobra-bicarbonato', 'Bicarbonato 5e-10 mol por encima: se declara proporción estequiométrica aunque queda un sobrante no nulo.', 100, 1, 8.400660042),
    reaction('dentro-sobra-acido', 'Ácido 5e-10 mol por encima: proporción estequiométrica con acidRemaining no nulo.', 100, 1, 8.400659958),
    reaction('umbral-dentro-sobra-bicarbonato', 'Diferencia 0,99999e-9 mol (bicarbonato mayor): último valor dentro de la rama; el margen (7e-15) supera en mucho el redondeo.', 100, 1, 8.400660084006),
    reaction('umbral-fuera-sobra-bicarbonato', 'Diferencia 1,000005e-9 mol (bicarbonato mayor): ya fuera, limita el ácido.', 100, 1, 8.400660084007),
    reaction('umbral-dentro-sobra-acido', 'Diferencia 0,99999e-9 mol (ácido mayor): último valor dentro de la rama.', 100, 1, 8.400659915994),
    reaction('umbral-fuera-sobra-acido', 'Diferencia 1,000005e-9 mol (ácido mayor): ya fuera, limita el bicarbonato.', 100, 1, 8.400659915993),
    reaction('tolerancia-absoluta-minimo', 'Con 0,01 g la tolerancia absoluta de 1e-9 mol equivale a 8e-6 relativo: 2,7e-10 mol de diferencia cuentan como estequiométrico.', 1, 0.119038, 0.01),

    // Bordes de cada rango (los demás argumentos en el interior) y esquinas
    reaction('borde-volumen-min', 'Volumen en el mínimo, 1 mL.', 1, 0.83, 2),
    reaction('borde-volumen-max', 'Volumen en el máximo, 150 mL.', 150, 0.83, 2),
    reaction('borde-concentracion-min', 'Concentración en el mínimo, 0,01 mol/L.', 50, 0.01, 2),
    reaction('borde-concentracion-max', 'Concentración en el máximo, 2 mol/L.', 50, 2, 2),
    reaction('borde-bicarbonato-min', 'Bicarbonato en el mínimo, 0,01 g.', 50, 0.83, 0.01),
    reaction('borde-bicarbonato-max', 'Bicarbonato en el máximo, 10 g.', 50, 0.83, 10),
    reaction('esquina-minimos', 'Los tres argumentos en su mínimo: 1e-5 mol de ácido, el menor CO2 posible.', 1, 0.01, 0.01),
    reaction('esquina-maximos', 'Los tres argumentos en su máximo: el mayor CO2 posible (10 g de bicarbonato).', 150, 2, 10),
    reaction('esquina-acido-max-bicarbonato-min', 'Máximo de ácido (0,3 mol) con el mínimo de bicarbonato: mayor sobrante de ácido.', 150, 2, 0.01),
    reaction('esquina-acido-min-bicarbonato-max', 'Mínimo de ácido con el máximo de bicarbonato: mayor sobrante de bicarbonato.', 1, 0.01, 10),

    // Justo fuera: el número representable contiguo a cada límite
    reaction('fuera-volumen-bajo', 'Volumen un ulp por debajo de 1 mL: rechazado sin tolerancia.', 0.9999999999999999, 0.83, 2, 'RANGE'),
    reaction('fuera-volumen-alto', 'Volumen un ulp por encima de 150 mL.', 150.00000000000003, 0.83, 2, 'RANGE'),
    reaction('fuera-concentracion-baja', 'Concentración un ulp por debajo de 0,01 mol/L.', 50, 0.009999999999999998, 2, 'RANGE'),
    reaction('fuera-concentracion-alta', 'Concentración un ulp por encima de 2 mol/L.', 50, 2.0000000000000004, 2, 'RANGE'),
    reaction('fuera-bicarbonato-bajo', 'Bicarbonato un ulp por debajo de 0,01 g.', 50, 0.83, 0.009999999999999998, 'RANGE'),
    reaction('fuera-bicarbonato-alto', 'Bicarbonato un ulp por encima de 10 g.', 50, 0.83, 10.000000000000002, 'RANGE'),
    // 5e-10 fuera: addReagent lo aceptaría (tolera 1e-9); calculateReaction no
    reaction('fuera-volumen-5e-10', 'Volumen 5e-10 por debajo de 1 mL: dentro de la tolerancia de la campana, pero la mesa lo rechaza.', 0.9999999995, 0.83, 2, 'RANGE'),
    reaction('fuera-concentracion-5e-10', 'Concentración 5e-10 por encima de 2 mol/L: rechazada.', 50, 2.0000000005, 2, 'RANGE'),
    reaction('fuera-bicarbonato-5e-10', 'Bicarbonato 5e-10 por encima de 10 g: rechazado.', 50, 0.83, 10.0000000005, 'RANGE'),
  ];
  // No finitos en cada argumento (NaN e Infinity en el volumen son además casos de la prueba unitaria)
  const base: [Num, Num, Num] = [50, 1, 2];
  (['volumen', 'concentracion', 'bicarbonato'] as const).forEach((arg, i) => NON_FINITE.forEach(v => {
    const input = base.map((b, j) => (j === i ? v : b)) as [Num, Num, Num];
    cases.push(reaction(`no-finito-${arg}-${slug(v)}`, `${v} en ${arg}: error de rango, no un resultado NaN.`, ...input, 'RANGE'));
  }));
  // Rejilla interior con valores no redondos: mezcla de ácido y bicarbonato limitantes
  for (const v of [12.5, 75, 137.3]) for (const c of [0.37, 1.25]) for (const g of [0.73, 6.4])
    cases.push(reaction(`rejilla-${v}ml-${c}m-${g}g`, `Interior: ${v} mL a ${c} mol/L con ${g} g.`, v, c, g));
  return cases;
}

function conductivityCases(): CaseSpec[] {
  const names = { water: 'agua', salt: 'sal', sugar: 'azucar' } as const;
  const cases: CaseSpec[] = [];
  for (const s of ['water', 'salt', 'sugar'] as const) {
    cases.push(conduct(`${names[s]}-min`, `${s} en el borde inferior, 0,001 mol/L.`, s, 0.001));
    cases.push(conduct(`${names[s]}-max`, s === 'salt' ? 'Sal en 0,02 mol/L: única concentración a la que brightness llega a 1 (2528,055/2528,055).' : `${s} en el borde superior, 0,02 mol/L: sin iones, brillo 0.`, s, 0.02));
    cases.push(conduct(`${names[s]}-prueba-0.01`, `Prueba unitaria: ${s} a 0,01 mol/L.`, s, 0.01));
  }
  cases.push(
    conduct('sal-casi-max', 'Sal un ulp por debajo de 0,02 mol/L: brightness 0,9999999999999998, todavía no llega a 1.', 'salt', 0.019999999999999997),
    conduct('sal-interior-0.005', 'Sal en el interior: brillo proporcional a la concentración más el fondo del agua.', 'salt', 0.005),
    conduct('sal-interior-0.0137', 'Sal en el interior con un valor no redondo.', 'salt', 0.0137),
    conduct('azucar-interior-0.0137', 'Azúcar: la concentración se valida, pero no cambia el resultado (fondo 0,055 µS/cm).', 'sugar', 0.0137),

    conduct('sal-fuera-bajo', 'Sal un ulp por debajo de 0,001 mol/L: rechazada sin tolerancia.', 'salt', 0.0009999999999999998, 'RANGE'),
    conduct('sal-fuera-alto', 'Sal un ulp por encima de 0,02 mol/L.', 'salt', 0.020000000000000004, 'RANGE'),
    conduct('agua-fuera-alto', 'Agua con concentración un ulp fuera: se rechaza aunque el agua no usa la concentración.', 'water', 0.020000000000000004, 'RANGE'),
    conduct('azucar-fuera-bajo', 'Azúcar un ulp por debajo del mínimo.', 'sugar', 0.0009999999999999998, 'RANGE'),
    ...([0, -1, 0.021] as const).map(c => conduct(`sal-prueba-${slug(c)}`, `Prueba unitaria: sal a ${c} mol/L, fuera del rango diluido.`, 'salt', c, 'RANGE')),

    ...NON_FINITE.map(v => conduct(`sal-no-finito-${slug(v)}`, `Concentración ${v} con sal.`, 'salt', v, 'RANGE')),
    conduct('agua-no-finito-nan', 'Concentración NaN con agua: error aunque el agua no la usa.', 'water', 'NaN', 'RANGE'),
    conduct('azucar-no-finito-infinity', 'Concentración Infinity con azúcar.', 'sugar', 'Infinity', 'RANGE'),

    // Disolución desconocida: el mismo error de rango (su texto habla de la concentración)
    conduct('desconocida-acid', 'Disolución desconocida con concentración válida: error de rango.', 'acid', 0.01, 'RANGE'),
    conduct('desconocida-mayusculas', 'El nombre distingue mayúsculas: «Salt» no es «salt».', 'Salt', 0.01, 'RANGE'),
    conduct('desconocida-vacia', 'Nombre de disolución vacío.', '', 0.01, 'RANGE'),
    conduct('desconocida-nacl', 'El id de reactivo de la campana «nacl» no es una disolución de la mesa 02.', 'nacl', 0.01, 'RANGE'),
    conduct('desconocida-y-fuera', 'Disolución desconocida y concentración fuera de rango a la vez.', 'vinegar', 0.5, 'RANGE'),
  );
  return cases;
}

function crystallizationCases(): CaseSpec[] {
  const cases: CaseSpec[] = [
    // solutions.test.ts
    crystal('prueba-evapora-80', 'Prueba unitaria: 20 g en 100 g de agua, evaporación del 80 %; aparecen 12,8 g de cristales.', 100, 20, 80),
    crystal('prueba-sin-saturacion', 'Prueba unitaria: 5 g y 20 % de evaporación no llegan a saturar.', 100, 5, 20),
    crystal('prueba-exceso-inicial', 'Prueba unitaria: 50 g en 100 g sin evaporar; 14 g nunca se disuelven y no cuentan como cristales nuevos.', 100, 50, 0),
    crystal('prueba-agua-nan', 'Prueba unitaria: agua NaN.', 'NaN', 20, 80, 'RANGE'),
    crystal('prueba-sal-0', 'Prueba unitaria: 0 g de sal, por debajo del mínimo.', 100, 0, 80, 'RANGE'),
    crystal('prueba-evaporacion-100', 'Prueba unitaria: evaporación total (100 %) no permitida.', 100, 20, 100, 'RANGE'),

    // Bordes de agua y sal (los de evaporación van en la rejilla de saturación) y esquinas
    crystal('borde-agua-min', 'Agua en el mínimo, 50 g: 0,36 × 50 = 18 g disueltos de 20.', 50, 20, 50),
    crystal('borde-agua-max', 'Agua en el máximo, 150 g.', 150, 20, 50),
    crystal('borde-sal-min', 'Sal en el mínimo, 1 g.', 100, 1, 50),
    crystal('borde-sal-max', 'Sal en el máximo, 50 g.', 100, 50, 50),
    crystal('esquina-minimos', 'Los tres argumentos en su mínimo.', 50, 1, 0),
    crystal('esquina-maximos', 'Los tres argumentos en su máximo: 150 g disuelven los 50 g y casi todo cristaliza.', 150, 50, 90),
    crystal('esquina-max-solido', 'Menos agua, más sal y 90 %: la mayor fracción sólida posible (48,2 de 50 g); nunca queda toda la sal sólida porque siempre restan al menos 5 g de agua.', 50, 50, 90),
    crystal('esquina-nada-cristaliza', '1 g en 150 g: ni con el 90 % de evaporación se satura.', 150, 1, 90),
    crystal('esquina-agua-min-sal-max', 'Sin evaporar, el mayor sólido inicial (32 g) y ningún cristal nuevo.', 50, 50, 0),
    crystal('esquina-agua-max-sal-max', 'Sin evaporar, 150 g de agua disuelven el máximo de sal (0,36 × 150 = 54 > 50).', 150, 50, 0),

    // Justo fuera: el número representable contiguo a cada límite
    crystal('fuera-agua-baja', 'Agua un ulp por debajo de 50 g: rechazada sin tolerancia.', 49.99999999999999, 20, 50, 'RANGE'),
    crystal('fuera-agua-alta', 'Agua un ulp por encima de 150 g.', 150.00000000000003, 20, 50, 'RANGE'),
    crystal('fuera-sal-baja', 'Sal un ulp por debajo de 1 g.', 100, 0.9999999999999999, 50, 'RANGE'),
    crystal('fuera-sal-alta', 'Sal un ulp por encima de 50 g.', 100, 50.00000000000001, 50, 'RANGE'),
    crystal('fuera-evaporacion-baja', 'Evaporación negativa mínima (−1e-12 %).', 100, 20, -1e-12, 'RANGE'),
    crystal('fuera-evaporacion-alta', 'Evaporación un ulp por encima de 90 %.', 100, 20, 90.00000000000001, 'RANGE'),

    // Frontera de saturación final alcanzada de forma limpia (resultado exactamente 0)
    crystal('frontera-final-limpia', '18 g = 0,36 × 50 g de agua restante: frontera exacta sin residuo, 0 cristales.', 100, 18, 50),
    // Residuo de coma flotante en la frontera final: sal = 0,36 × agua restante en decimal, pero no en binario
    crystal('residuo-125-9-80', 'Residuo conocido: 125 × (1 − 80/100) da 24,999999999999993 y newCrystals vale 3,55e-15 en vez de 0.', 125, 9, 80),
    crystal('residuo-100-7.2-80', 'Mismo residuo con otro tamaño: 7,2 g = 0,36 × 20 g, newCrystals 1,78e-15.', 100, 7.2, 80),
    crystal('residuo-100-34.2-5', 'Residuo sin error en el agua restante (95 exacto): 0,36 × 95 se queda bajo 34,2 y da 7,1e-15.', 100, 34.2, 5),
    crystal('residuo-50-1.8-90', 'Residuo en la esquina de agua mínima y evaporación máxima: 4,4e-16 en vez de 0.', 50, 1.8, 90),
    // Residuo en la frontera inicial: 0,36 × agua queda un ulp por debajo de la sal
    crystal('residuo-inicial-60-21.6', 'Sal exactamente en la saturación inicial (0,36 × 60): initialSolid 3,55e-15 en vez de 0, sin cristales nuevos.', 60, 21.6, 0),
    crystal('residuo-inicial-80-28.8-50', 'Residuo de sólido inicial (3,55e-15) que además se resta de los cristales nuevos tras evaporar.', 80, 28.8, 50),
  ];
  // Sal por debajo, en y por encima de la saturación inicial (36 g en 100 g) × evaporación 0, intermedia y 90
  const salts = [[20, 'bajo'], [36, 'en'], [45, 'sobre']] as const;
  for (const [salt, where] of salts) for (const evap of [0, 40, 90])
    cases.push(crystal(`saturacion-${where}-evap-${evap}`, `${salt} g en 100 g de agua (${where} la saturación inicial de 36 g) con ${evap} % de evaporación.`, 100, salt, evap));
  // No finitos en cada argumento (agua NaN ya es caso de la prueba unitaria)
  const base: [Num, Num, Num] = [100, 20, 50];
  (['agua', 'sal', 'evaporacion'] as const).forEach((arg, i) => NON_FINITE.forEach(v => {
    if (arg === 'agua' && v === 'NaN') return;
    const input = base.map((b, j) => (j === i ? v : b)) as [Num, Num, Num];
    cases.push(crystal(`no-finito-${arg}-${slug(v)}`, `${v} en ${arg}: error de rango.`, ...input, 'RANGE'));
  }));
  return cases;
}

/**
 * El mismo experimento por las dos vías. La mesa usa 84,0066 g/mol para el NaHCO3 y la campana 84,006
 * (formula.ts): con ácido limitante el CO2 coincide; con bicarbonato limitante difiere en 7e-6 relativo.
 */
const crossed: Family = ctx => {
  const pairs: { ml: number; g: number; hood: 'ácido' | 'bicarbonato'; why: string }[] = [
    { ml: 50, g: 5, hood: 'ácido', why: 'ácido limitante en las dos vías: los moles de CO2 coinciden (0,0415)' },
    { ml: 10, g: 2, hood: 'ácido', why: 'ácido limitante con poco líquido: el CO2 coincide (salvo un ulp) y en la campana el bicarbonato sobrante no se disuelve del todo' },
    { ml: 100, g: 1, hood: 'bicarbonato', why: 'bicarbonato limitante: discrepancia conocida, 0,011903826604 mol (mesa, 84,0066 g/mol) frente a 0,011903911625 (campana, 84,006)' },
    { ml: 150, g: 10, hood: 'bicarbonato', why: 'bicarbonato limitante en los máximos comunes (150 mL, 10 g): el CO2 difiere en 7e-6 relativo' },
    { ml: 100, g: 6.97252, hood: 'ácido', why: 'entre las dos masas molares: la mesa dice que limita el bicarbonato (sobran 3,3e-7 mol de ácido) y la campana que limita el ácido (sobran 2,6e-7 mol de bicarbonato)' },
    { ml: 100, g: 6.9725478, hood: 'ácido', why: 'la mesa declara proporción estequiométrica (0,083 mol de cada uno) y la campana deja 5,9e-7 mol de bicarbonato sin reaccionar' },
  ];
  return pairs.flatMap(({ ml, g, hood, why }, i): CaseSpec[] => {
    const steps = [{ reagent: 'acetic', amount: ml }, { reagent: 'nahco3', amount: g }];
    // Intención del caso: en la campana sobra ácido acético solo si limita el bicarbonato.
    const t = ctx.trace(steps);
    const limiting = (t.n.HAc ?? 0) + (t.n['Ac-'] ?? 0) - (t.released.CO2 ?? 0) > 1e-9 ? 'bicarbonato' : 'ácido';
    if (limiting !== hood) throw new Error(`cruzado/${i + 1}: en la campana limita el ${limiting} y el caso esperaba ${hood}.`);
    return [
      { id: `cruzado/${i + 1}-mesa`, fn: 'calculateReaction', why: `Mesa, ${ml} mL a 0,83 mol/L con ${g} g; ${why}.`, input: { vinegarMl: ml, concentration: 0.83, bicarbonateG: g } },
      { id: `cruzado/${i + 1}-campana`, fn: 'sequence', why: `Campana, acetic ${ml} mL + nahco3 ${g} g; ${why}.`, steps, mustFire: ['bicarbonate-solid-acetic'], mustNotFire: ['co2-acetic'] },
    ];
  });
};

const family: Family = ctx => [...reactionCases(), ...conductivityCases(), ...crystallizationCases(), ...crossed(ctx)];
export default family;
