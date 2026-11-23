import { amountRange, reagents, type ReagentId } from '../../src/chemistry/reagents';
import { rules } from '../../src/chemistry/sandbox';
import type { CaseSpec, Family, StepSpec } from '../lib/types';

/**
 * «unico»: cada reactivo solo en el matraz (mínimo, inicial y máximo), sólidos con agua antes y después,
 * e indicadores sobre agua. «par»: los 253 pares de reactivos que no son indicadores, con orden y cantidades
 * sorteados, más unos pocos pares con indicador.
 * Ejecutar: GOLDEN_FAMILY=30-unicos-pares npm run golden
 */
const ids = Object.keys(reagents) as ReagentId[];
const kind = (id: ReagentId) => reagents[id].kind;
const range = (id: ReagentId) => amountRange(reagents[id]);
const name = (id: ReagentId) => reagents[id].name;
/** Nombre con minúscula inicial, para mitad de frase. */
const lower = (id: ReagentId) => name(id)[0].toLowerCase() + name(id).slice(1);
const capital = (text: string) => text[0].toUpperCase() + text.slice(1);
const step = (reagent: ReagentId, amount: number): StepSpec => ({ reagent, amount });
const es = (x: number) => String(x).replace('.', ',');
const units = (id: ReagentId, amount: number) => `${es(amount)} ${amount === 1 && kind(id) === 'indicator' ? 'gota' : range(id).unit}`;
const ALL_RULES = rules.map(rule => rule.id);

/** Sólidos que el modelo disuelve en agua (regla de solubilidad propia); los metales no reaccionan con agua. */
const DISSOLVES: Partial<Record<ReagentId, string>> = { nahco3: 'ksp-NaHCO3(s)', cacl2: 'ksp-CaCl2(s)', nh4no3: 'ksp-NH4NO3(s)', caco3: 'ksp-CaCO3' };
const LIQUID_ML = [5, 10, 20, 25, 40, 50, 100];
const SOLID_G = [0.2, 0.5, 1, 2];
const WATER_ML = 50;
/**
 * Cantidades fijadas a mano donde el sorteo dejaba el caso sobre una marca de fragilidad ajena a su propósito.
 * ki-agno3: con 50 mL de AgNO3 y 5 mL de KI quedaban Ag+ y K+ casi empatados (orden-disueltos).
 */
const ADJUST: Record<string, Partial<Record<ReagentId, number>>> = { 'par/ki-agno3': { agno3: 40 } };

const family: Family = ctx => {
  const solids = ids.filter(id => kind(id) === 'solid');
  const indicators = ids.filter(id => kind(id) === 'indicator');
  const mixable = ids.filter(id => kind(id) !== 'indicator');
  // Los recuentos de casos dependen del estante: si cambia, hay que revisar esta familia.
  if (ids.length !== 27 || solids.length !== 8 || indicators.length !== 4) throw new Error('30-unicos-pares: el estante ya no tiene 27 reactivos (8 sólidos, 4 indicadores).');
  const cases: CaseSpec[] = [];

  // ── unico ──
  const alone = { solid: 'sin líquido el sólido espera sin reaccionar', indicator: 'las gotas son el único líquido y no hay nada que reaccione', solution: 'una disolución sola no reacciona', water: 'solo agua' };
  for (const id of ids) {
    const r = range(id);
    for (const [tag, text, amount] of [['min', 'mínima', r.min], ['inicial', 'inicial', r.initial], ['max', 'máxima', r.max]] as const)
      cases.push({ id: `unico/${id}-${tag}`, fn: 'sequence', why: `${name(id)} en el matraz vacío con la cantidad ${text} (${units(id, amount)}): ${alone[kind(id)]}.`, steps: [step(id, amount)], mustNotFire: ALL_RULES });
  }
  for (const id of solids) {
    const rule = DISSOLVES[id], r = range(id), solid = (reagents[id] as { species: string }).species;
    const expect = rule ? { mustFire: [rule] } : { mustNotFire: ALL_RULES };
    // Con el máximo, el bicarbonato satura y el mármol apenas se disuelve: queda sólido; los demás caben enteros.
    const variants = [['seco-agua', [step(id, r.initial), step('water', WATER_ML)]], ['agua-solido', [step('water', WATER_ML), step(id, r.max)]]] as const;
    for (const [tag, steps] of variants) {
      const result = !rule ? 'el metal no reacciona con el agua' : solid in ctx.trace([...steps]).n ? 'se disuelve solo hasta su límite de solubilidad y queda sólido' : 'se disuelve por completo';
      const why = tag === 'seco-agua' ? `${name(id)} (${es(r.initial)} g) sobre matraz seco: espera sin reaccionar y la nota pide un líquido; al añadir ${WATER_ML} mL de agua ${result}.`
        : `${WATER_ML} mL de agua y después ${lower(id)} (${es(r.max)} g, el máximo): ${result}.`;
      cases.push({ id: `unico/${id}-${tag}`, fn: 'sequence', why, steps: [...steps], ...expect });
    }
  }
  for (const id of indicators)
    cases.push({ id: `unico/${id}-agua`, fn: 'sequence', why: `${name(id)} (${range(id).initial} gotas) sobre ${WATER_ML} mL de agua: nota del indicador a pH 7 sin eventos.`, steps: [step('water', WATER_ML), step(id, range(id).initial)], mustNotFire: ALL_RULES });

  // ── par ──
  const fromTrace = (steps: StepSpec[]) => { const fired = Object.keys(ctx.trace(steps).fired); return { fired, expect: fired.length ? { mustFire: fired } : { mustNotFire: ALL_RULES } }; };
  const draw = (id: ReagentId) => kind(id) === 'solid' ? ctx.pick(SOLID_G.filter(g => g <= range(id).max)) : ctx.pick(LIQUID_ML);
  for (let i = 0; i < mixable.length; i++) for (let j = i + 1; j < mixable.length; j++) {
    const a = mixable[i], b = mixable[j];
    const order = ctx.rng() < 0.5 ? [a, b] : [b, a];
    // Dos sólidos necesitan un líquido para poder reaccionar.
    const wet = kind(a) === 'solid' && kind(b) === 'solid';
    // Si las cantidades sorteadas no dan ningún evento se sortean otras, hasta 4 intentos; si ninguno reacciona vale el primero.
    let chosen: { steps: StepSpec[] } & ReturnType<typeof fromTrace> | undefined;
    for (let attempt = 0; attempt < 4 && !chosen?.fired.length; attempt++) {
      const steps = [...(wet ? [step('water', WATER_ML)] : []), ...order.map(id => step(id, draw(id)))];
      const traced = fromTrace(steps);
      if (!chosen || traced.fired.length) chosen = { steps, ...traced };
    }
    const id = `par/${a}-${b}`, fix = ADJUST[id];
    if (fix) { const steps = chosen!.steps.map(s => step(s.reagent as ReagentId, fix[s.reagent as ReagentId] ?? s.amount as number)); chosen = { steps, ...fromTrace(steps) }; }
    const { steps, fired, expect } = chosen!;
    const mixed = steps.slice(wet ? 1 : 0).map(s => `${lower(s.reagent as ReagentId)} (${units(s.reagent as ReagentId, s.amount as number)})`).join(' y después ');
    cases.push({ id, fn: 'sequence', why: `${capital(`${wet ? `sobre ${WATER_ML} mL de agua, ` : ''}${mixed}`)}: ${fired.length ? `eventos de ${fired.join(', ')}` : 'el modelo no prevé ningún cambio visible'}.`, steps, ...expect });
  }

  // Pares con indicador: color y nota según el pH, indicador antes o después, y gotas como único líquido de un sólido.
  const withIndicator: [string, StepSpec[], string][] = [
    ['hcl-universal', [step('hcl', 25), step('universal', 3)], 'Indicador universal en HCl 1 mol/L: rojo, y las gotas diluyen lo justo para que el pH deje de ser cero'],
    ['acetic-bromothymol', [step('acetic', 25), step('bromothymol', 3)], 'Azul de bromotimol en un ácido débil: amarillo, y la nota lleva un pH con decimales'],
    ['naoh-phenolphthalein', [step('naoh', 25), step('phenolphthalein', 3)], 'Fenolftaleína en base fuerte: rosa con la intensidad máxima'],
    ['phenolphthalein-hcl', [step('phenolphthalein', 2), step('hcl', 20)], 'Indicador primero y ácido después: la fenolftaleína queda incolora'],
    ['bromothymol-naoh', [step('bromothymol', 3), step('naoh', 10)], 'Indicador primero y base después: el azul de bromotimol pasa de verde a azul'],
    ['ki-starch', [step('ki', 25), step('starch', 3)], 'Almidón con yoduro pero sin yodo: no hay azul y la nota lo explica'],
    ['nh4no3-universal', [step('nh4no3', 1), step('universal', 3)], 'Tres gotas de indicador sobre nitrato de amonio seco: los 0,15 mL se saturan y, como el calor solo se reparte entre el líquido y no hay tope inferior, la temperatura baja a −136 °C'],
    ['cacl2-bromothymol', [step('cacl2', 1), step('bromothymol', 3)], 'Tres gotas de indicador sobre cloruro de calcio seco: los 0,15 mL se saturan y el calor de disolución lleva la temperatura al tope de 100 °C'],
  ];
  for (const [tag, steps, why] of withIndicator) cases.push({ id: `par/${tag}`, fn: 'sequence', why: `${why}.`, steps, ...fromTrace(steps).expect });

  // Sorpresa del motor: el intercambio CaCO3 → BaCO3 no llega al equilibrio en las 120 pasadas de un paso,
  // así que un tercer reactivo inerte (cobre) lo reanuda y aparece como si reaccionara.
  const resumed = [step('bacl2', 20), step('caco3', 0.5), step('cu', 0.05)];
  cases.push({ id: 'par/bacl2-caco3-reanuda', fn: 'sequence', why: 'Tras BaCl2 y mármol, añadir cobre (inerte) vuelve a dar eventos de ksp-CaCO3 y ksp-BaCO3: el paso anterior agotó sus 120 pasadas sin llegar al equilibrio.', steps: resumed, mustFire: ['ksp-CaCO3', 'ksp-BaCO3'], mustNotFire: ALL_RULES.filter(rule => rule.startsWith('metal-Cu-')) });

  return cases;
};
export default family;
