import { hoodRecipes, recipeById, type HoodRecipe, type RecipeAdd, type Tool } from '../../src/experiments/hoodRecipes';
import type { CaseSpec, Family, StepSpec } from '../lib/types';

/**
 * Las 16 prácticas guiadas de la campana con las cantidades que produce el juego (src/state/hood.ts):
 * la probeta entrega décimas de mL, la balanza centésimas de gramo y el gotero gotas enteras.
 * Ejecutar: GOLDEN_FAMILY=20-practicas npm run golden
 */
const CYLINDER_ML = 100; // capacidad de la probeta (CYLINDER_ML en hood.ts)
const ticks: Record<Tool, number> = { probeta: 10, balanza: 100, gotero: 1 };
/** Redondeo de cada herramienta; el gotero redondea hacia arriba porque no hay fracciones de gota. */
const measure = (tool: Tool, x: number) => tool === 'gotero' ? Math.ceil(x - 1e-9) : Math.round(x * ticks[tool]) / ticks[tool];
const asStep = (a: RecipeAdd): StepSpec => ({ reagent: a.reagent, amount: a.amount });
const exact = (r: HoodRecipe) => r.adds.map(asStep);

/** Cada cantidad por su porcentaje y leída en su herramienta; lo que no cabe en la probeta va en un segundo vertido. */
const scaled = (adds: RecipeAdd[], percent: number[]): StepSpec[] => adds.flatMap((a, i) => {
  const amount = measure(a.tool, a.amount * percent[i] / 100);
  return a.tool === 'probeta' && amount > CYLINDER_ML
    ? [{ reagent: a.reagent, amount: CYLINDER_ML }, { reagent: a.reagent, amount: measure('probeta', amount - CYLINDER_ML) }]
    : [{ reagent: a.reagent, amount }];
});
/**
 * Excesos fijados a mano. En cobre-azul la sosa no debe pasarse más que el cobre: con OH⁻ de sobra el Cu²⁺
 * residual queda por debajo de 1e-15 mol, el motor lo borra y al redisolver el sólido Cu²⁺ y SO₄²⁻ difieren
 * en el último bit (marca «orden-disueltos»).
 */
const excessOverride: Record<string, number[]> = { 'cobre-azul': [120, 115, 122] };

/** Como en el juego: dos vertidos o dos pesadas con decimales que suman la cantidad, y los indicadores gota a gota. */
const asPlayed = (adds: RecipeAdd[], rng: () => number): StepSpec[] => adds.flatMap(a => {
  if (a.tool === 'gotero') return Array.from({ length: a.amount }, () => ({ reagent: a.reagent, amount: 1 }));
  let k = Math.round(a.amount * (0.35 + 0.3 * rng()) * ticks[a.tool]);
  if (k % 10 === 0) k += 3; // que la primera parte nunca sea una cifra redonda
  const first = k / ticks[a.tool];
  return [{ reagent: a.reagent, amount: first }, { reagent: a.reagent, amount: measure(a.tool, a.amount - first) }];
});

/**
 * Orden inverso. Si empezara con un sólido en el matraz seco (recetas de líquido + sólido), el sólido va
 * entre dos mitades del primer líquido: es la otra ordenación que el jugador puede hacer con líquido delante.
 */
const inverse = (adds: RecipeAdd[]): { steps: StepSpec[]; split: boolean } => {
  const reversed = [...adds].reverse();
  if (reversed[0].tool !== 'balanza') return { steps: reversed.map(asStep), split: false };
  const [liquid, ...rest] = adds;
  const half = measure(liquid.tool, liquid.amount / 2);
  return { steps: [{ reagent: liquid.reagent, amount: half }, ...rest.reverse().map(asStep), { reagent: liquid.reagent, amount: measure(liquid.tool, liquid.amount - half) }], split: true };
};

/** Una práctica tras otra sin vaciar el matraz: [nombre, primera, segunda, reglas ajenas a ambas recetas que aparecen, motivo]. */
const chains: [string, string, string, string[], string][] = [
  ['oro-cloruros', 'lluvia-oro', 'cloruro-plata', ['ksp-AgI', 'ksp-PbCl2'], 'el yoduro de la lluvia de oro se queda con la plata (AgI) y el cloruro precipita con el plomo.'],
  ['volcan-permanganato', 'volcan', 'permanganato', ['acetate-strong', 'permanganate-peroxide-neutral', 'peroxide-decomposition'], 'el acetato capta el H⁺ del sulfúrico y el permanganato reacciona por la vía sin ácido, con MnO₂ como catalizador.'],
  ['hierro-magnesio', 'hierro-rojo', 'magnesio', ['neutral-strong', 'acid-Fe(OH)3-H+', 'metal-Mg-Fe3+'], 'el HCl neutraliza la sosa sobrante y redisuelve el Fe(OH)₃, y el magnesio reduce el hierro(III) antes que el H⁺.'],
];

const family: Family = ctx => {
  const cases: CaseSpec[] = [];
  /** Registra una secuencia y fija, según lo que hace el motor, cuáles de las reglas esperadas disparan y cuáles no. */
  const add = (name: string, why: string, steps: StepSpec[], expect: string[], extra: string[] = []) => {
    const { fired } = ctx.trace(steps);
    const miss = expect.filter(rule => !(rule in fired));
    cases.push({
      id: `practica/${name}`, fn: 'sequence', steps, mustFire: [...expect.filter(rule => rule in fired), ...extra],
      why: miss.length ? `${why} Aquí el motor no da ${miss.join(' ni ')}.` : why,
      ...(miss.length ? { mustNotFire: miss } : {}),
    });
  };

  for (const r of hoodRecipes) {
    const t = `«${r.title}»`;
    cases.push({ id: `practica/${r.id}/exacta`, fn: 'sequence', why: `${t} con las cantidades exactas de la guía.`, steps: exact(r), mustFire: r.expect });
    add(`${r.id}/minimo`, `${t} al 90 % de cada cantidad, el mínimo con el que la guía da el paso por hecho.`, scaled(r.adds, r.adds.map(() => 90)), r.expect);
    add(`${r.id}/exceso`, `${t} con cada cantidad entre el 110 % y el 125 %, como cuando el jugador se pasa.`, scaled(r.adds, excessOverride[r.id] ?? r.adds.map(() => ctx.int(110, 125))), r.expect);
    add(`${r.id}/juego`, `${t} como llega en el juego: dos vertidos de probeta, dos pesadas y gotas de una en una.`, asPlayed(r.adds, ctx.rng), r.expect);
    const inv = inverse(r.adds);
    add(`${r.id}/inverso`, inv.split ? `${t} con el sólido entre dos mitades del líquido (el orden inverso empezaría en seco).` : `${t} con las mismas adiciones en orden inverso.`, inv.steps, r.expect);
  }
  for (const [name, first, second, extra, reason] of chains) {
    const a = recipeById(first)!, b = recipeById(second)!;
    add(`encadenadas-${name}`, `«${b.title}» sobre los restos de «${a.title}» sin vaciar el matraz: ${reason}`, [...exact(a), ...exact(b)], [...a.expect, ...b.expect], extra);
  }
  return cases;
};
export default family;
