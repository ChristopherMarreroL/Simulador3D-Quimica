import { equationText, gasLitres, precipitation, reactionEnthalpy, ROOM_C, rules, VESSEL_ML, type Terms } from '../../src/chemistry/sandbox';
import { species, speciesIds } from '../../src/chemistry/species';
import { constants } from '../../src/chemistry/constants';
import { amountRange, categoryColors, DROP_ML, reagents, shelfRows } from '../../src/chemistry/reagents';
import { molarMass } from '../../src/chemistry/formula';
import { MOLAR_MASS_BICARBONATE } from '../../src/chemistry/reaction';
import { hoodRecipes } from '../../src/experiments/hoodRecipes';

/** Datos del modelo tal como los ve el código: sirven para generar las tablas del porte y para comprobarlas. */

const pairs = (t: Terms) => Object.entries(t) as [string, number][];

export function buildTables() {
  return {
    constants: {
      VESSEL_ML, ROOM_C, DROP_ML, GAS_L_PER_MOL: gasLitres(1), MOLAR_MASS_BICARBONATE,
      ksp: constants.ksp, ka: constants.ka, E: constants.E, solubility: constants.solubility, categoryColors,
    },
    /** En el orden de `speciesIds`, que el motor usa al calcular el pH y al listar sólidos y disueltos. */
    species: speciesIds.map(id => ({ id, ...species[id], molarMass: molarMass(species[id].formula) })),
    /** En el orden de declaración de `reagents`. */
    reagents: Object.values(reagents).map(r => ({
      ...r, ...(r.kind === 'solution' ? { components: pairs(r.components) } : {}), range: amountRange(r),
    })),
    shelfRows,
    /** El índice es la prioridad: `react()` recorre las reglas en este orden en cada pasada. */
    rules: rules.map((rule, index) => {
      if (rule.type === 'complete') return {
        index, id: rule.id, type: rule.type, kind: rule.kind, reactants: pairs(rule.reactants), products: pairs(rule.products),
        catalysts: rule.catalysts ?? [], vigor: rule.vigor, title: rule.title, note: rule.note,
        equation: equationText(rule.reactants, rule.products), deltaH: reactionEnthalpy(rule.reactants, rule.products),
      };
      const { reactants, products } = precipitation(rule);
      return {
        index, id: rule.id, type: rule.type, solid: rule.solid, ions: pairs(rule.ions), ksp: rule.ksp, water: rule.water ?? 0,
        vigor: rule.vigor, note: rule.note, reactants: pairs(reactants), products: pairs(products),
        // La entalpía se suma en el sentido real del evento: el sentido inverso no siempre es el opuesto exacto.
        deltaHPrecipitation: reactionEnthalpy(reactants, products), deltaHDissolution: reactionEnthalpy(products, reactants),
      };
    }),
    recipes: hoodRecipes,
  };
}
