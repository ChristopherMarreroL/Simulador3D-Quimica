import type { Family } from '../lib/types';

/**
 * Ejemplo de familia (no se exporta: los archivos que empiezan por `_` solo se ejecutan si se piden por nombre).
 * Ejecutar: GOLDEN_FAMILY=_ejemplo npm run golden
 */
const family: Family = ctx => {
  const t = ctx.trace([{ reagent: 'agno3', amount: 20 }, { reagent: 'nacl', amount: 5 }]);
  return [
    { id: 'ejemplo/cloruros', fn: 'sequence', why: 'AgNO3 + NaCl precipita AgCl.', steps: [{ reagent: 'agno3', amount: 20 }, { reagent: 'nacl', amount: 5 }], mustFire: Object.keys(t.fired) },
    { id: 'ejemplo/desborde', fn: 'sequence', why: 'El tercer vertido no cabe.', steps: [{ reagent: 'water', amount: 200 }, { reagent: 'water', amount: 200 }, { reagent: 'water', amount: 200 }], mustError: 'OVERFLOW' },
    { id: 'ejemplo/no-finito', fn: 'sequence', why: 'Cantidad NaN.', steps: [{ reagent: 'water', amount: 'NaN' }], mustError: 'RANGE' },
    { id: 'ejemplo/ph-manual', fn: 'solvePH', why: 'HCl 0,1 M escrito a mano.', mixture: { n: { 'H+': 0.01, 'Cl-': 0.01 }, waterMl: 100 } },
    { id: 'ejemplo/ph-secuencia', fn: 'solvePH', why: 'pH tras una secuencia.', mixture: { steps: [{ reagent: 'acetic', amount: 50 }] } },
    { id: 'ejemplo/color', fn: 'solutionColor', why: 'Color sin pH: los indicadores no cuentan.', mixture: { steps: [{ reagent: 'cuso4', amount: 20 }, { reagent: 'universal', amount: 2 }] }, pH: null },
    { id: 'ejemplo/indicador', fn: 'indicatorColor', why: 'Quiebre exacto de la rampa.', indicator: 'bromothymol', pH: 6.8 },
    { id: 'ejemplo/formula', fn: 'molarMass', why: 'Paréntesis.', formula: 'Cu(OH)2' },
    { id: 'ejemplo/formula-mala', fn: 'molarMass', why: 'Elemento fuera de la tabla.', formula: 'XeF2', mustError: 'UNKNOWN_ELEMENT' },
    { id: 'ejemplo/gas', fn: 'gasLitres', why: 'Volumen molar.', mol: 0.5 },
    { id: 'ejemplo/vinagre', fn: 'calculateReaction', why: 'Mesa 01.', input: { vinegarMl: 50, concentration: 0.83, bicarbonateG: 5 } },
    { id: 'ejemplo/conductividad', fn: 'conductivity', why: 'Mesa 02.', input: { solution: 'salt', concentration: 0.01 } },
    { id: 'ejemplo/cristales', fn: 'crystallization', why: 'Mesa 03.', input: { waterG: 100, saltG: 40, evaporationPercent: 50 } },
    { id: `ejemplo/azar-${ctx.int(1, 9)}`, fn: 'sequence', why: 'Uso del generador con semilla.', steps: [{ reagent: ctx.pick(['hcl', 'naoh'] as const), amount: ctx.int(1, 50) }] },
  ];
};
export default family;
