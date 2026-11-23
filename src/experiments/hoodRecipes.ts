import type { ReagentId } from '../chemistry/reagents';

/**
 * Guided experiments for the fume hood. Each step uses the real tool for its amount: graduated
 * cylinder for solutions, balance with weighing boat for solids, dropper for indicators. `expect` lists
 * the sandbox rules that must fire, so every recipe is backed by the implemented model (see tests).
 */
export type Tool = 'probeta' | 'balanza' | 'gotero';
export interface RecipeAdd { reagent: ReagentId; amount: number; tool: Tool }
export interface HoodRecipe {
  id: string; title: string; equation: string; level: 'Básico' | 'Intermedio';
  goal: string; observe: string; waste: string; safety: string;
  adds: RecipeAdd[]; expect: string[];
}
const p = (reagent: ReagentId, amount: number): RecipeAdd => ({ reagent, amount, tool: 'probeta' });
const b = (reagent: ReagentId, amount: number): RecipeAdd => ({ reagent, amount, tool: 'balanza' });
const g = (reagent: ReagentId, amount: number): RecipeAdd => ({ reagent, amount, tool: 'gotero' });

export const hoodRecipes: HoodRecipe[] = [
  { id: 'neutralizacion', title: 'Neutralización con indicador', equation: 'HCl + NaOH → NaCl + H₂O', level: 'Básico',
    goal: 'Ver cómo el indicador universal pasa de rojo a verde al neutralizar un ácido fuerte.', observe: 'Rojo con el ácido; verde cerca de pH 7 y la mezcla se calienta.',
    waste: 'Disolución salina neutra: residuos acuosos.', safety: 'HCl y NaOH son corrosivos.', adds: [p('hcl', 20), g('universal', 3), p('naoh', 20)], expect: ['neutral-strong'] },
  { id: 'volcan', title: 'Vinagre y bicarbonato', equation: 'NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂', level: 'Básico',
    goal: 'Producir CO₂ y notar que la mezcla se enfría.', observe: 'Efervescencia intensa y descenso de temperatura.',
    waste: 'Acetato de sodio en agua: residuos acuosos.', safety: 'No tapes el recipiente mientras libera gas.', adds: [p('acetic', 50), b('nahco3', 2)], expect: ['bicarbonate-solid-acetic'] },
  { id: 'lluvia-oro', title: 'Lluvia de oro', equation: 'Pb(NO₃)₂ + 2 KI → PbI₂ ↓ + 2 KNO₃', level: 'Intermedio',
    goal: 'Formar cristales amarillos de yoduro de plomo(II).', observe: 'Precipitado amarillo intenso.',
    waste: 'Contiene plomo: residuos de metales pesados, nunca al fregadero.', safety: 'El nitrato de plomo es tóxico.', adds: [p('pbno3', 20), p('ki', 10)], expect: ['ksp-PbI2'] },
  { id: 'cloruro-plata', title: 'Prueba de cloruros', equation: 'AgNO₃ + NaCl → AgCl ↓ + NaNO₃', level: 'Básico',
    goal: 'Detectar iones cloruro con nitrato de plata.', observe: 'Precipitado blanco lechoso de AgCl.',
    waste: 'Contiene plata: residuos de metales.', safety: 'El nitrato de plata mancha la piel.', adds: [p('agno3', 20), p('nacl', 5)], expect: ['ksp-AgCl'] },
  { id: 'cobre-azul', title: 'Hidróxido de cobre azul', equation: 'CuSO₄ + 2 NaOH → Cu(OH)₂ ↓ + Na₂SO₄', level: 'Básico',
    goal: 'Precipitar Cu(OH)₂ y redisolverlo con ácido.', observe: 'Sólido azul celeste que desaparece al añadir HCl.',
    waste: 'Contiene cobre: residuos de metales.', safety: 'NaOH y HCl son corrosivos.', adds: [p('cuso4', 10), p('naoh', 10), p('hcl', 20)], expect: ['ksp-Cu(OH)2', 'acid-Cu(OH)2-H+'] },
  { id: 'hierro-rojo', title: 'Hidróxido de hierro(III)', equation: 'FeCl₃ + 3 NaOH → Fe(OH)₃ ↓ + 3 NaCl', level: 'Básico',
    goal: 'Formar un precipitado pardo rojizo.', observe: 'Sólido marrón rojizo y gelatinoso.',
    waste: 'Contiene hierro: residuos de metales.', safety: 'El FeCl₃ es corrosivo.', adds: [p('fecl3', 20), p('naoh', 10)], expect: ['ksp-Fe(OH)3'] },
  { id: 'elefante', title: 'Descomposición del peróxido', equation: '2 H₂O₂ → 2 H₂O + O₂  (catalizador: I⁻)', level: 'Intermedio',
    goal: 'Acelerar la descomposición del agua oxigenada con yoduro.', observe: 'Espuma de oxígeno y la mezcla se calienta mucho.',
    waste: 'Agua con yoduro: residuos acuosos.', safety: 'Libera gas y calor: no te acerques a la boca del matraz.', adds: [p('h2o2', 100), p('ki', 10)], expect: ['peroxide-decomposition'] },
  { id: 'magnesio', title: 'Magnesio en ácido', equation: 'Mg + 2 HCl → MgCl₂ + H₂', level: 'Intermedio',
    goal: 'Ver un metal activo desplazar hidrógeno.', observe: 'Burbujas de H₂ y gran aumento de temperatura.',
    waste: 'Disolución ácida: neutraliza antes de desechar.', safety: 'El hidrógeno es inflamable: extractor encendido y sin llamas.', adds: [p('hcl', 50), b('mg', 0.3)], expect: ['metal-Mg-H+'] },
  { id: 'cobre-cinc', title: 'El cinc desplaza al cobre', equation: 'Zn + CuSO₄ → ZnSO₄ + Cu', level: 'Básico',
    goal: 'Depositar cobre metálico sobre el cinc.', observe: 'El azul se aclara y aparece cobre rojizo.',
    waste: 'Contiene cobre y cinc: residuos de metales.', safety: 'Lava tus guantes si tocas el sulfato de cobre.', adds: [p('cuso4', 40), b('zn', 2)], expect: ['metal-Zn-Cu2+'] },
  { id: 'arbol-plata', title: 'Árbol de plata', equation: 'Cu + 2 AgNO₃ → Cu(NO₃)₂ + 2 Ag', level: 'Intermedio',
    goal: 'Formar cristales de plata sobre cobre.', observe: 'Plata gris sobre el alambre y la disolución se vuelve azul.',
    waste: 'Contiene plata y cobre: residuos de metales.', safety: 'El nitrato de plata mancha la piel.', adds: [p('agno3', 30), b('cu', 1)], expect: ['metal-Cu-Ag+'] },
  { id: 'sulfato-bario', title: 'Prueba de sulfatos', equation: 'BaCl₂ + H₂SO₄ → BaSO₄ ↓ + 2 HCl', level: 'Básico',
    goal: 'Detectar sulfatos con cloruro de bario.', observe: 'Precipitado blanco muy fino.',
    waste: 'Contiene bario: residuos de metales.', safety: 'El cloruro de bario es tóxico.', adds: [p('bacl2', 20), p('h2so4', 10)], expect: ['ksp-BaSO4'] },
  { id: 'permanganato', title: 'El permanganato pierde el color', equation: '2 MnO₄⁻ + 5 H₂O₂ + 6 H⁺ → 2 Mn²⁺ + 5 O₂ + 8 H₂O', level: 'Intermedio',
    goal: 'Ver una reacción redox que decolora la disolución.', observe: 'El violeta desaparece y salen burbujas.',
    waste: 'Disolución ácida con manganeso: residuos de metales.', safety: 'Permanganato y ácido sulfúrico son oxidante y corrosivo.', adds: [p('kmno4', 10), p('h2so4', 10), p('h2o2', 10)], expect: ['permanganate-peroxide'] },
  { id: 'yodo-almidon', title: 'Yodo y almidón', equation: '2 Fe³⁺ + 2 I⁻ → 2 Fe²⁺ + I₂', level: 'Intermedio',
    goal: 'Formar yodo y detectarlo con almidón.', observe: 'Color pardo y luego azul muy oscuro con el almidón.',
    waste: 'Contiene hierro y yodo: residuos acuosos.', safety: 'El FeCl₃ es corrosivo.', adds: [p('fecl3', 20), p('ki', 10), g('starch', 3)], expect: ['iron-iodide'] },
  { id: 'frio', title: 'Disolución que enfría', equation: 'NH₄NO₃(s) → NH₄⁺ + NO₃⁻   ΔH > 0', level: 'Básico',
    goal: 'Medir el descenso de temperatura de una disolución endotérmica.', observe: 'La temperatura baja varios grados.',
    waste: 'Disolución de nitrato: residuos acuosos.', safety: 'El nitrato de amonio es comburente.', adds: [p('water', 50), b('nh4no3', 5)], expect: ['ksp-NH4NO3(s)'] },
  { id: 'calor', title: 'Disolución que calienta', equation: 'CaCl₂(s) → Ca²⁺ + 2 Cl⁻   ΔH < 0', level: 'Básico',
    goal: 'Medir el aumento de temperatura de una disolución exotérmica.', observe: 'La temperatura sube varios grados.',
    waste: 'Disolución salina: residuos acuosos.', safety: 'El CaCl₂ irrita los ojos.', adds: [p('water', 50), b('cacl2', 5)], expect: ['ksp-CaCl2(s)'] },
  { id: 'fenolftaleina', title: 'Rosa que desaparece', equation: 'CH₃COOH + NaOH → CH₃COONa + H₂O', level: 'Básico',
    goal: 'Ver la fenolftaleína rosa en base y su pérdida de color al añadir ácido.', observe: 'Rosa intenso que se vuelve incoloro.',
    waste: 'Acetato en agua: residuos acuosos.', safety: 'El NaOH es corrosivo.', adds: [p('naoh', 10), p('water', 40), g('phenolphthalein', 3), p('acetic', 30)], expect: ['neutral-acetic'] },
];
export const recipeById = (id: string | null | undefined) => hoodRecipes.find(r => r.id === id) ?? null;
export const toolText: Record<Tool, string> = { probeta: 'probeta graduada', balanza: 'balanza', gotero: 'gotero' };
