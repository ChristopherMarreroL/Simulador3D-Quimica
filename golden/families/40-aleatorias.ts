import type { CaseSpec, Family, StepSpec } from '../lib/types';

/**
 * Sesiones aleatorias de «mezclas libres»: secuencias de 3 a 8 adiciones con cantidades «de juego».
 * No fijan reglas (mustFire): su valor es la variedad. Se reparten por temas para que no dominen
 * siempre los mismos reactivos. Ejecutar: GOLDEN_FAMILY=40-aleatorias npm run golden
 */
interface Theme {
  key: string; label: string;
  /** Protagonistas del tema: se eligen con más frecuencia que el resto de disoluciones. */
  core: string[]; liquids: string[]; solids: string[]; indicators: string[];
  /** Reparto acumulado disolución / sólido / agua (el resto, indicador). Por defecto 60 / 20 / 8 / 12: el primer paso nunca es un indicador y casi siempre es un líquido. */
  mix?: [number, number, number];
}
const ACID_BASE = ['universal', 'bromothymol', 'phenolphthalein'];
const themes: Theme[] = [
  { key: 'acido-base', label: 'ácido-base', core: ['hcl', 'naoh'], liquids: ['hcl', 'h2so4', 'acetic', 'naoh', 'na2co3', 'nacl'], solids: ['nahco3', 'nh4no3'], indicators: ACID_BASE },
  { key: 'carbonatos', label: 'carbonatos', core: ['na2co3'], liquids: ['na2co3', 'hcl', 'acetic', 'h2so4', 'bacl2', 'naoh'], solids: ['nahco3', 'caco3', 'cacl2'], indicators: ['universal', 'phenolphthalein'] },
  { key: 'plata', label: 'plata y haluros', core: ['agno3'], liquids: ['agno3', 'nacl', 'ki', 'hcl', 'na2co3', 'naoh', 'h2so4'], solids: ['cu', 'zn', 'cacl2'], indicators: ['universal', 'starch'] },
  { key: 'plomo', label: 'plomo', core: ['pbno3'], liquids: ['pbno3', 'ki', 'nacl', 'hcl', 'h2so4', 'na2co3', 'naoh'], solids: ['zn', 'fe', 'mg'], indicators: ['universal', 'bromothymol'] },
  { key: 'cobre', label: 'cobre', core: ['cuso4'], liquids: ['cuso4', 'naoh', 'na2co3', 'ki', 'agno3', 'hcl', 'acetic'], solids: ['zn', 'fe', 'mg', 'cu'], indicators: ['starch', 'universal'] },
  { key: 'hierro', label: 'hierro', core: ['fecl3'], liquids: ['fecl3', 'naoh', 'ki', 'hcl', 'h2so4', 'kmno4', 'na2co3'], solids: ['fe', 'cu', 'zn'], indicators: ['starch', 'universal'] },
  { key: 'redox', label: 'redox con permanganato, peróxido y yoduro', core: ['kmno4', 'h2o2', 'ki'], liquids: ['kmno4', 'h2o2', 'ki', 'h2so4', 'hcl', 'fecl3', 'naoh', 'cuso4'], solids: ['fe', 'nahco3'], indicators: ['starch', 'universal'] },
  { key: 'metales', label: 'metales', core: ['hcl', 'cuso4'], liquids: ['hcl', 'h2so4', 'acetic', 'cuso4', 'agno3', 'pbno3', 'fecl3'], solids: ['zn', 'mg', 'cu', 'fe'], indicators: ['universal', 'phenolphthalein'], mix: [0.47, 0.8, 0.88] },
  { key: 'termicas', label: 'térmicas', core: ['hcl', 'naoh'], liquids: ['hcl', 'naoh', 'h2so4', 'acetic', 'h2o2', 'ki'], solids: ['cacl2', 'nh4no3', 'nahco3', 'mg'], indicators: ['universal', 'bromothymol'], mix: [0.42, 0.74, 0.89] },
  { key: 'todo', label: 'todo el estante', core: [],
    liquids: ['hcl', 'h2so4', 'acetic', 'naoh', 'na2co3', 'h2o2', 'kmno4', 'ki', 'nacl', 'agno3', 'cuso4', 'fecl3', 'pbno3', 'bacl2'],
    solids: ['nahco3', 'cacl2', 'nh4no3', 'caco3', 'zn', 'mg', 'cu', 'fe'], indicators: [...ACID_BASE, 'starch'] },
];
const PER_THEME = 15;

/**
 * Comportamientos sorprendentes del motor que destaparon las sesiones aleatorias, en su secuencia mínima
 * (escritos a mano, no generados). Las gotas de almidón son inertes: muestran si el estado sigue cambiando.
 */
const S = (reagent: string, amount: number): StepSpec => ({ reagent, amount });
const surprises: [string, string, StepSpec[]][] = [
  ['frio-sin-limite', 'El nitrato de amonio se disuelve en dos gotas de indicador y la temperatura cae muy por debajo de 0 °C: no hay límite inferior.', [S('nh4no3', 1.7), S('universal', 2)]],
  ['tope-100', 'El cloruro de calcio se disuelve en gotas de almidón y la temperatura queda recortada a 100 °C en dos pasos seguidos.', [S('cacl2', 1.25), S('starch', 5), S('starch', 1)]],
  ['metal-y-sal-poco-soluble', 'Magnesio sobre PbCl2 precipitado: el desplazamiento no termina en las 120 pasadas y cada gota inerte lo hace avanzar.', [S('pbno3', 100), S('nacl', 100), S('mg', 1), S('starch', 1), S('starch', 1)]],
  ['metatesis-lenta', 'PbI2 frente a sulfato: la conversión a PbSO4 queda a medias y continúa con cada gota inerte.', [S('pbno3', 50), S('ki', 20), S('h2so4', 20), S('starch', 1), S('starch', 1)]],
  ['agcl-con-yoduro', 'AgCl con exceso de yoduro: la conversión a AgI, mucho menos soluble, avanza menos de 1 µmol por adición y no da evento.', [S('agno3', 20), S('nacl', 5), S('ki', 10), S('starch', 1)]],
  ['hierro-en-carbonato', 'Fe3+ en carbonato de sodio a pH básico: no precipita Fe(OH)3 porque el Ksp solo cuenta el OH- añadido como tal.', [S('na2co3', 10), S('fecl3', 5)]],
];

const family: Family = ctx => {
  const tenths = (lo: number, hi: number) => ctx.int(lo * 10, hi * 10) / 10;
  /** Probeta: 1–100 mL con un decimal, casi siempre entre 5 y 40; una mano «generosa» vierte 70–100. */
  const ml = (generous: boolean) => {
    if (generous) return tenths(70, 100);
    const u = ctx.rng();
    return u < 0.1 ? tenths(1, 5) : u < 0.85 ? tenths(5, 40) : tenths(40, 100);
  };
  /** Balanza: 0,05–3 g con dos decimales (la cinta de magnesio admite 2 g), casi siempre hasta 1,5 g. */
  const grams = (id: string) => ctx.rng() < 0.75 ? ctx.int(5, 150) / 100 : ctx.int(151, id === 'mg' ? 200 : 300) / 100;
  const solution = (t: Theme) => t.core.length && ctx.rng() < 0.35 ? ctx.pick(t.core) : ctx.pick(t.liquids);

  const cases: CaseSpec[] = [];
  for (let k = 1; k <= PER_THEME; k++) for (const t of themes) {
    const length = ctx.int(3, 8);
    const generous = ctx.rng() < 0.15;
    const dry = ctx.rng() < 0.12;
    const [pSolution, pSolid, pWater] = t.mix ?? [0.6, 0.8, 0.88];
    const steps: StepSpec[] = [];
    for (let i = 0; i < length; i++) {
      const u = i === 0 ? (dry ? pSolution : ctx.rng() < 0.9 ? 0 : pSolid) : ctx.rng();
      if (u < pSolution) steps.push({ reagent: solution(t), amount: ml(generous) });
      else if (u < pSolid) { const id = ctx.pick(t.solids); steps.push({ reagent: id, amount: grams(id) }); }
      else if (u < pWater) steps.push({ reagent: 'water', amount: ml(generous) });
      else steps.push({ reagent: ctx.pick(t.indicators), amount: ctx.int(1, 5) });
    }
    // El arnés exige declarar el error del último paso: se pregunta al motor, no se decide a mano.
    const errors = ctx.trace(steps).errors;
    const overflow = errors[errors.length - 1] === 'OVERFLOW';
    const used = [...new Set(steps.map(s => s.reagent))].join(', ');
    cases.push({
      id: `aleatoria/${t.key}-${String(k).padStart(2, '0')}`, fn: 'sequence', steps,
      why: `Sesión libre de tema «${t.label}» con ${length} adiciones (${used})${dry ? ', empezando por un sólido en el matraz seco' : ''}${generous ? ', con vertidos generosos' : ''}${overflow ? '; el último vertido desborda el matraz' : ''}.`,
      ...(overflow ? { mustError: 'OVERFLOW' as const } : {}),
    });
  }
  for (const [name, why, steps] of surprises) cases.push({ id: `aleatoria/sorpresa-${name}`, fn: 'sequence', why, steps });
  return cases;
};
export default family;
