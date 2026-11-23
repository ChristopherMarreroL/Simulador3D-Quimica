import { species } from '../../src/chemistry/species';
import type { CaseSpec, ErrorCode, Family, Num, StepSpec } from '../lib/types';

/**
 * Familias «formula» (molarMass), «error» (validaciones de addReagent) y «gas» (gasLitres).
 * Ejecutar: GOLDEN_FAMILY=10-formula-errores npm run golden
 */

const CODES = { U: 'UNKNOWN_REAGENT', R: 'RANGE', O: 'OVERFLOW' } as const;
/** Paso de una secuencia: reactivo, cantidad y, si debe fallar, la inicial del código de error esperado. */
type Step = [reagent: string, amount: Num, error?: keyof typeof CODES];

// ── formula ──────────────────────────────────────────────────────────────────────────────────────
/** Fórmulas sueltas: [nombre, fórmula, qué ejercita, código de error si no es válida]. */
const formulas: [string, string, string, ErrorCode?][] = [
  ['un-elemento', 'H', 'Un solo elemento sin subíndice.'],
  ['todos-los-elementos', 'HCNONaMgSClKCaMnFeCuZnAgIBaPb', 'Los 18 elementos de la tabla seguidos: símbolos de una y dos letras con lectura voraz.'],
  ['anidada', 'Ca3(Fe(CN)6)2', 'Paréntesis anidados con subíndice en ambos niveles.'],
  ['grupo-inicial', '(NH4)2SO4', 'La fórmula empieza por un grupo entre paréntesis.'],
  ['subindice-multidigito', 'C12H22O11', 'Subíndices de dos cifras.'],
  ['subindice-cero', 'H0', 'El subíndice 0 es válido y da masa 0.'],
  ['cero-inicial', 'H02O', 'Un cero a la izquierda no cambia el subíndice (02 = 2).'],
  ['subindice-20-cifras', 'H99999999999999999999', 'Subíndice mayor que 2^64: se lee como número de coma flotante, no como entero.'],
  ['grupo-vacio', '()', 'Un grupo vacío se acepta y da masa 0.'],
  ['grupo-vacio-con-subindice', 'Cu()3', 'Un grupo vacío con subíndice no aporta masa.'],
  ['vacia', '', 'La cadena vacía se rechaza de forma explícita.', 'BAD_FORMULA'],
  ['elemento-fuera-de-tabla', 'Hg2Cl2', 'Elemento real que no está en la tabla abreviada.', 'UNKNOWN_ELEMENT'],
  ['mayusculas-mal', 'CaCo3', 'La lectura voraz toma «Co» como un símbolo desconocido, no como C seguido de «o».', 'UNKNOWN_ELEMENT'],
  ['minusculas', 'h2o', 'Las minúsculas sueltas no forman símbolo: no se consume ningún carácter.', 'BAD_FORMULA'],
  ['parentesis-sin-cerrar', 'Cu(OH', 'Paréntesis abierto que no se cierra.', 'BAD_FORMULA'],
  ['cierre-sin-abrir', 'OH)2', 'Cierre de paréntesis sin apertura.', 'BAD_FORMULA'],
  ['cierre-antes-que-desconocido', ')Xe', 'Manda el primer error en orden de lectura: el cierre sin abrir precede al elemento desconocido.', 'BAD_FORMULA'],
  ['desconocido-antes-que-cierre', 'Xe)', 'Manda el primer error en orden de lectura: el elemento desconocido precede al cierre sin abrir.', 'UNKNOWN_ELEMENT'],
  ['desconocido-tras-espacio', 'H2O Xe', 'Un carácter no válido se salta al leer, así que el elemento desconocido posterior gana a la fórmula no válida.', 'UNKNOWN_ELEMENT'],
  ['carga', 'SO4-2', 'Las cargas no forman parte de la fórmula neutra.', 'BAD_FORMULA'],
  ['espacio', 'H2 O', 'Un espacio intermedio invalida la fórmula.', 'BAD_FORMULA'],
  ['subindice-unicode', 'H₂O', 'El subíndice Unicode ₂ no es un dígito ASCII.', 'BAD_FORMULA'],
  ['digito-ancho', 'H２O', 'El dígito de ancho completo ２ no cuenta como dígito.', 'BAD_FORMULA'],
  ['hidrato', 'CuSO4.5H2O', 'El punto de los hidratos (y un coeficiente delante) no se admite.', 'BAD_FORMULA'],
];
const slug = (formula: string) => formula.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
function formulaCases(): CaseSpec[] {
  // Todas las fórmulas de species.ts con paréntesis o con más de un dígito, sin repetir.
  const fromSpecies = [...new Set(Object.values(species).map(s => s.formula))].filter(f => f.includes('(') || f.replace(/\D/g, '').length > 1);
  return [
    ...fromSpecies.map((formula): CaseSpec => ({ id: `formula/especie-${slug(formula)}`, fn: 'molarMass', why: `Fórmula de species.ts ${formula.includes('(') ? 'con paréntesis' : 'con varios subíndices'}: ${formula}.`, formula })),
    ...formulas.map(([name, formula, why, mustError]): CaseSpec => ({ id: `formula/${name}`, fn: 'molarMass', why, formula, ...(mustError ? { mustError } : {}) })),
  ];
}

// ── error ────────────────────────────────────────────────────────────────────────────────────────
const E = 1e-9; // tolerancia de los límites en addReagent
const full: Step[] = [['water', 200], ['water', 200], ['water', 100]]; // 500 mL exactos
/** Secuencias: [nombre, qué ejercita, pasos, reglas que deben dar evento]. */
const sequences: [string, string, Step[], string[]?][] = [
  // Reactivo desconocido.
  ['desconocido-vacio', 'El id vacío no es un reactivo.', [['', 25, 'U']]],
  ['desconocido-mayusculas', 'Los ids distinguen mayúsculas de minúsculas.', [['HCl', 25, 'U'], ['Water', 50, 'U'], ['ZN', 1, 'U']]],
  ['desconocido-espacios', 'Los espacios no se recortan del id.', [[' hcl', 25, 'U'], ['hcl ', 25, 'U'], ['h cl', 25, 'U']]],
  ['desconocido-especie', 'Un id de especie no es un id de reactivo.', [['H+', 25, 'U'], ['NaHCO3(s)', 1, 'U'], ['Zn', 1, 'U']]],
  // Precedencia de las validaciones.
  ['desconocido-antes-que-rango', 'Con un id desconocido la cantidad ni se mira.', [['HCl', 'NaN', 'U'], ['', -5, 'U'], ['H+', 'Infinity', 'U']]],
  ['desconocido-antes-que-desborde', 'Con el matraz lleno, un id desconocido da UNKNOWN_REAGENT y no OVERFLOW.', [...full, ['agua', 1, 'U']]],
  ['rango-antes-que-desborde', 'Con el matraz en 500 mL, una cantidad fuera de rango da RANGE aunque tampoco cabría.', [...full, ['water', 1, 'O'], ['universal', 11, 'R'], ['water', 300, 'R']]],
  // Límites exactos, tolerancia de 1e-9 y primer valor rechazado, por tipo de reactivo.
  ['rango-liquido-limites', 'Mínimo y máximo exactos de agua y de disolución (1 y 200 mL).', [['water', 1], ['hcl', 200], ['naoh', 1], ['water', 200]]],
  ['rango-liquido-tolerancia', 'Líquidos a 1e-9 fuera del rango: se aceptan porque igualan el umbral del código.', [['water', 1 - E], ['naoh', 200 + E]]],
  ['rango-liquido-fuera', 'Líquidos a 2e-9 fuera del rango: se rechazan con el mensaje de mL.', [['hcl', 1 - 2 * E, 'R'], ['water', 200 + 2 * E, 'R']]],
  ['rango-gotas-limites', 'Mínimo y máximo exactos de un indicador (1 y 10 gotas).', [['water', 100], ['universal', 1], ['bromothymol', 10]]],
  ['rango-gotas-tolerancia', 'Indicadores a 1e-9 fuera del rango: se aceptan.', [['water', 100], ['phenolphthalein', 1 - E], ['starch', 10 + E]]],
  ['rango-gotas-fuera', 'Indicadores a 2e-9 fuera del rango: se rechazan con el mensaje de gotas.', [['universal', 1 - 2 * E, 'R'], ['starch', 10 + 2 * E, 'R']]],
  ['rango-solido-limites', 'Mínimo y máximo exactos de un sólido (0,05 y 10 g).', [['water', 100], ['nahco3', 0.05], ['nahco3', 10]]],
  ['rango-solido-tolerancia', 'Sólidos a 1e-9 fuera del rango: se aceptan.', [['water', 100], ['cu', 0.05 - E], ['cu', 10 + E]]],
  ['rango-solido-fuera', 'Sólidos a 2e-9 fuera del rango: se rechazan con el mensaje de gramos.', [['fe', 0.05 - 2 * E, 'R'], ['fe', 10 + 2 * E, 'R']]],
  ['rango-mg-limite', 'El magnesio admite 2 g (y 2 g + 1e-9), no los 10 g de los demás sólidos.', [['water', 100], ['mg', 2], ['mg', 2 + E]]],
  ['rango-mg-fuera', 'Por encima de 2 g el magnesio se rechaza, mientras que el cinc admite esa misma cantidad.', [['zn', 2.05], ['zn', 10], ['mg', 2.05, 'R'], ['mg', 10, 'R'], ['mg', 2 + 2 * E, 'R']]],
  // Valores claramente fuera de rango.
  ['rango-cero', 'La cantidad 0 se rechaza en los tres tipos.', [['water', 0, 'R'], ['zn', 0, 'R'], ['universal', 0, 'R']]],
  ['rango-negativos', 'Las cantidades negativas se rechazan.', [['hcl', -25, 'R'], ['caco3', -0.05, 'R'], ['starch', -1, 'R']]],
  ['rango-nan', 'NaN se rechaza con el mensaje de rango de cada tipo.', [['water', 'NaN', 'R'], ['zn', 'NaN', 'R'], ['universal', 'NaN', 'R']]],
  ['rango-infinito', 'Infinity se rechaza con el mensaje de rango de cada tipo.', [['hcl', 'Infinity', 'R'], ['mg', 'Infinity', 'R'], ['starch', 'Infinity', 'R']]],
  ['rango-menos-infinito', '-Infinity se rechaza con el mensaje de rango de cada tipo.', [['water', '-Infinity', 'R'], ['caco3', '-Infinity', 'R'], ['bromothymol', '-Infinity', 'R']]],
  ['rango-un-paso-de-mas', 'Un paso de la interfaz por encima del máximo: 201 mL, 11 gotas y 10,05 g.', [['water', 201, 'R'], ['hcl', 201, 'R'], ['phenolphthalein', 11, 'R'], ['zn', 10.05, 'R']]],
  ['rango-bajo-minimo', 'Valores positivos por debajo del mínimo: 0,5 mL, media gota y 0,04 g.', [['water', 0.5, 'R'], ['universal', 0.5, 'R'], ['nahco3', 0.04, 'R']]],
  ['rango-extremos', 'Magnitudes extremas pero finitas.', [['water', 1e300, 'R'], ['zn', 1e-300, 'R'], ['universal', 1e9, 'R']]],
  ['rango-sin-paso', 'Dentro del rango no se exige el paso de la interfaz: 1,5 mL, 2,5 gotas y 0,0733 g se aceptan.', [['water', 1.5], ['universal', 2.5], ['zn', 0.0733]]],
  // Desborde.
  ['desborde-exacto-500', 'Llenar hasta 500 mL exactos se acepta; una gota más no cabe, pero un sólido sí.', [...full, ['universal', 1, 'O'], ['zn', 1], ['starch', 1, 'O']]],
  ['desborde-501', 'Un vertido que dejaría 501 mL se rechaza y el mensaje indica 400 mL.', [['water', 200], ['water', 200], ['water', 101, 'O']]],
  ['desborde-gotas-exacto', 'Líquidos y gotas que suman 500 mL exactos (499 + 10 gotas + 10 gotas); la gota siguiente no cabe.', [['water', 200], ['hcl', 200], ['water', 99], ['phenolphthalein', 10], ['universal', 10], ['starch', 1, 'O']]],
  ['desborde-gotas-pasan', 'Desde 499,75 mL caben 4 gotas pero no 6, ni otras 2 después.', [['water', 200], ['water', 200], ['water', 99.75], ['universal', 6, 'O'], ['universal', 4], ['bromothymol', 2, 'O']]],
  // A propósito sobre el umbral: dependen de sumar en doble precisión, paso a paso y sin fusionar producto y suma (FMA).
  ['desborde-gotas-redondeo', 'Suma en coma flotante: 499,85 mL + 1 gota + 2 gotas da 500,00000000000006 mL y la última adición se rechaza, aunque aritméticamente son 500 mL exactos.', [['water', 200], ['water', 200], ['water', 99.85], ['universal', 1], ['bromothymol', 2, 'O']]],
  ['desborde-gotas-redondeo-contraste', 'Las mismas 3 gotas de una sola vez sobre 499,85 mL sí caben: la suma redondea a 500 mL exactos.', [['water', 200], ['water', 200], ['water', 99.85], ['universal', 3], ['starch', 1, 'O']]],
  ['desborde-mensaje-437', 'El mensaje redondea 437,25 mL a 437.', [['water', 200], ['water', 200], ['water', 37.25], ['hcl', 100, 'O']]],
  ['desborde-mensaje-301', 'El mensaje redondea 300,7 mL a 301.', [['water', 200], ['water', 100.7], ['naoh', 200, 'O']]],
  ['desborde-mensaje-500-sin-llenar', 'Con 499,96 mL el mensaje dice 500 mL aunque el matraz no está lleno: un sólido aún entra.', [['water', 200], ['water', 200], ['water', 99.96], ['universal', 1, 'O'], ['zn', 1], ['water', 1, 'O']]],
  ['desborde-mensaje-medio', 'Volumen previo de 498,5 mL exactos: Math.round redondea la mitad hacia arriba (499), no al par.', [['water', 200], ['water', 200], ['water', 98.5], ['water', 2, 'O']]],
  // Volumen por encima de 500 mL por agua de reacción: después no entra nada, ni siquiera un sólido.
  ['agua-reaccion-hcl-naoh', 'La neutralización deja ≈ 503,6 mL: sólido, gota y agua se rechazan los tres con OVERFLOW.', [['hcl', 200], ['water', 100], ['naoh', 200], ['zn', 1, 'O'], ['universal', 1, 'O'], ['water', 1, 'O']], ['neutral-strong']],
  ['agua-reaccion-precedencia', 'Por encima de 500 mL siguen mandando el id desconocido y el rango sobre el desborde.', [['h2so4', 200], ['water', 100], ['naoh', 200], ['H2O', 1, 'U'], ['mg', 5, 'R'], ['universal', 11, 'R'], ['mg', 1, 'O']], ['neutral-strong']],
  ['agua-reaccion-acetico', 'Ácido débil con base fuerte: el agua formada supera los 500 mL.', [['acetic', 200], ['water', 100], ['naoh', 200], ['caco3', 0.05, 'O'], ['starch', 1, 'O']], ['neutral-acetic']],
  ['agua-reaccion-carbonato', 'El agua de la efervescencia con carbonato (≈ 1,8 mL) basta para bloquear el matraz.', [['hcl', 200], ['water', 100], ['na2co3', 200], ['fe', 1, 'O'], ['water', 1, 'O']], ['co2-strong']],
  ['agua-reaccion-amonio', 'El amonio de un sólido disuelto y la base fuerte forman agua por encima de 500 mL.', [['water', 200], ['nh4no3', 10], ['water', 100], ['naoh', 200], ['cu', 1, 'O']], ['neutral-ammonium']],
  ['agua-reaccion-oxido-plata', 'El agua de una precipitación (Ag₂O, ≈ 0,18 mL) también deja el matraz por encima de 500 mL.', [['agno3', 200], ['water', 100], ['naoh', 200], ['zn', 1, 'O'], ['phenolphthalein', 1, 'O']], ['ksp-Ag2O']],
  ['agua-reaccion-minima', 'Con 500,09 mL el mensaje dice 500 mL y el sólido se rechaza, al contrario que con 500 mL exactos.', [['hcl', 5], ['water', 200], ['water', 190], ['naoh', 105], ['zn', 1, 'O']], ['neutral-strong']],
  ['agua-reaccion-orden', 'Los mismos reactivos en otro orden no caben: tras neutralizar hay 403,6 mL y 100 mL de agua desbordan.', [['hcl', 200], ['naoh', 200], ['water', 100, 'O'], ['water', 96], ['universal', 8, 'O']], ['neutral-strong']],
  // Tras un error la mezcla no cambia y la secuencia continúa.
  ['continua-tras-errores', 'Errores de rango y de id intercalados no alteran una neutralización parcial.', [['water', 50], ['hcl', 'NaN', 'R'], ['hcl', 25], ['HCl', 25, 'U'], ['naoh', 20], ['water', 300, 'R'], ['universal', 3]], ['neutral-strong']],
  ['continua-error-inicial', 'Errores sobre el matraz vacío y después una reacción normal.', [['', 1, 'U'], ['zn', 0, 'R'], ['hcl', 50], ['zn', 1]], ['metal-Zn-H+']],
  ['continua-tras-desborde', 'Un desborde rechazado no impide llenar después hasta 500 mL y reaccionar con un sólido.', [['water', 200], ['cuso4', 200], ['water', 150, 'O'], ['water', 100], ['fe', 1], ['universal', 1, 'O']], ['metal-Fe-Cu2+']],
  ['continua-sin-anotar', 'Los pasos fallidos no cuentan como adiciones: la nota sigue tratando el HCl como único reactivo.', [['hcl', 25], ['water', 300, 'R'], ['agua', 25, 'U'], ['hcl', 25]]],
];

// ── gas ──────────────────────────────────────────────────────────────────────────────────────────
const gases: [string, number, string][] = [
  ['cero', 0, 'Sin gas: 0 L.'],
  ['un-mol', 1, 'Volumen molar a 25 °C y 1 atm.'],
  ['tipico-practica', 0.0415, 'Cantidad típica de CO₂ en la práctica de vinagre y bicarbonato.'],
  ['tipico-fraccion', 0.1, 'Décima de mol: el producto no es exacto en binario.'],
  ['muy-pequeno', 1e-12, 'Cantidad muy pequeña.'],
  ['grande', 1e9, 'Cantidad muy grande.'],
];

const family: Family = ctx => {
  const state = (steps: StepSpec[]) => { const t = ctx.trace(steps); return JSON.stringify([t.n, t.waterMl, t.temperatureC, t.pH, t.released, t.heatUnknown]); };
  const errorCases = sequences.map(([name, why, rows, mustFire]): CaseSpec => {
    const id = `error/${name}`;
    const steps = rows.map(([reagent, amount]) => ({ reagent, amount }));
    const want = rows.map(([, , e]) => (e ? CODES[e] : null));
    // El arnés solo comprueba el código del último paso: aquí se fija la intención de todos.
    const got = ctx.trace(steps).errors;
    if (got.join() !== want.join()) throw new Error(`${id}: se esperaban los errores [${want.join()}] y el motor dio [${got.join()}].`);
    // Un paso con error no debe dejar rastro: el estado final es el de la secuencia sin esos pasos.
    if (state(steps) !== state(steps.filter((_, i) => !want[i]))) throw new Error(`${id}: los pasos con error han cambiado la mezcla.`);
    const last = want[want.length - 1];
    return { id, fn: 'sequence', why, steps, ...(last ? { mustError: last } : {}), ...(mustFire ? { mustFire } : {}) };
  });
  return [
    ...formulaCases(),
    ...errorCases,
    ...gases.map(([name, mol, why]): CaseSpec => ({ id: `gas/${name}`, fn: 'gasLitres', why, mol })),
  ];
};
export default family;
