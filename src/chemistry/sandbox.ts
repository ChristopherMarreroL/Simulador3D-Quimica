import { molarMass } from './formula';
import { species, speciesIds, type SpeciesId } from './species';
import { amountRange, DROP_ML, reagents, type IndicatorId, type ReagentId } from './reagents';
import { constants } from './constants';

/**
 * Fume-hood sandbox: a pure, deterministic model for mixing the shelf reagents in an open 500 mL flask.
 * - Fast reactions (acid–base, gas release, redox, metal displacement) go to completion in priority order.
 * - Sparingly soluble solids follow ideal Ksp equilibria in both directions (precipitate or redissolve).
 * - Heat comes from ΔHf° tables; the mixture is treated as water (4,184 J g⁻¹ K⁻¹) with no heat loss.
 * - pH solves the charge balance with weak acid/base systems and the first hydrolysis of Fe³⁺, Cu²⁺ and Zn²⁺;
 *   activities are ignored.
 * Kinetics, temperature-dependent constants and complex ions are out of scope (see docs/CAMPANA_MEZCLAS.md).
 */
export const VESSEL_ML = 500;
export const ROOM_C = 25;
const KW = 1e-14;
const WATER_HEAT_CAPACITY = 4.184; // J g⁻¹ K⁻¹
const WATER_MOLAR_ML = 18.015 / 0.997; // mL of liquid water per mol at 25 °C
const GAS_L_PER_MOL = 0.082057 * 298.15; // ideal gas at 25 °C, 1 atm
export type Terms = Partial<Record<SpeciesId, number>>;
export type RuleKind = 'neutralización' | 'gas' | 'precipitado' | 'disolución' | 'redox' | 'descomposición';
interface RuleBase { id: string; title: string; note: string; vigor: number }
export interface CompleteRule extends RuleBase { type: 'complete'; kind: RuleKind; reactants: Terms; products: Terms; catalysts?: SpeciesId[] }
export interface SolubilityRule extends RuleBase { type: 'solubility'; solid: SpeciesId; ions: Terms; ksp: number; water?: number }
/** Reactants/products of a solubility rule in the precipitation direction (ions → solid). */
export const precipitation = (rule: SolubilityRule) => ({ reactants: rule.ions, products: { [rule.solid]: 1, ...(rule.water ? { H2O: rule.water } : {}) } as Terms });
export type Rule = CompleteRule | SolubilityRule;

const label = (id: SpeciesId) => species[id].label;
const terms = (t: Terms) => Object.entries(t) as [SpeciesId, number][];
const phaseText = { aq: 'ac', s: 's', l: 'l', g: 'g' } as const;
export function equationText(reactants: Terms, products: Terms) {
  const side = (t: Terms) => terms(t).map(([id, c]) => `${c === 1 ? '' : `${c} `}${label(id)}(${phaseText[species[id].phase]})`).join(' + ');
  return `${side(reactants)} → ${side(products)}`;
}
/** ΔH° (kJ per mol of reaction as written) from formation enthalpies, or null if a value is missing. */
export function reactionEnthalpy(reactants: Terms, products: Terms): number | null {
  let total = 0;
  for (const [t, sign] of [[products, 1], [reactants, -1]] as const) for (const [id, c] of terms(t)) {
    const h = species[id].dHf; if (h === null) return null; total += sign * c * h;
  }
  return total;
}
const complete = (id: string, kind: RuleKind, reactants: Terms, products: Terms, title: string, note: string, vigor = 0.5, catalysts?: SpeciesId[]): CompleteRule => ({ type: 'complete', id, kind, reactants, products, title, note, vigor, catalysts });
const ksp = (solid: SpeciesId, ions: Terms, value: number, note = ''): SolubilityRule => ({ type: 'solubility', id: `ksp-${solid}`, solid, ions, ksp: value, title: '', note, vigor: 0.4 });
/** Highly soluble salts expressed as an ideal solubility product from g per 100 g of water (20 °C). */
const soluble = (solid: SpeciesId, ions: Terms, gramsPer100g: number) => {
  const s = gramsPer100g * 10 / molarMass(species[solid].formula); // mol/L, with 1 kg water ≈ 1 L
  return { ...ksp(solid, ions, terms(ions).reduce((k, [, nu]) => k * (nu * s) ** nu, 1)), vigor: 0.2 };
};

/** Metal activity: reduction potentials (V) decide which displacement reactions are favourable. */
const couples = [
  { metal: 'Mg', ion: 'Mg2+', e: 2, E: constants.E.Mg },
  { metal: 'Zn', ion: 'Zn2+', e: 2, E: constants.E.Zn },
  { metal: 'Fe', ion: 'Fe2+', e: 2, E: constants.E.Fe },
  { metal: 'Pb', ion: 'Pb2+', e: 2, E: constants.E.Pb },
  { metal: 'Cu', ion: 'Cu2+', e: 2, E: constants.E.Cu },
  { metal: 'Ag', ion: 'Ag+', e: 1, E: constants.E.Ag },
] as const;
const oxidants: { ox: SpeciesId; red: Terms; e: number; E: number; name: string }[] = [
  ...couples.map(c => ({ ox: c.ion as SpeciesId, red: { [c.metal]: 1 } as Terms, e: c.e, E: c.E, name: species[c.metal as SpeciesId].name })),
  { ox: 'H+', red: { H2: 0.5 }, e: 1, E: 0, name: 'hidrógeno' },
  { ox: 'Fe3+', red: { 'Fe2+': 1 }, e: 1, E: constants.E.Fe3, name: 'hierro(II)' },
];
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
function displacementRules(): CompleteRule[] {
  const rules: CompleteRule[] = [];
  // Lead forms passivating layers with HCl/H2SO4: it is not used as a reducing metal.
  const reducers = couples.filter(c => c.metal !== 'Pb' && c.metal !== 'Ag');
  const pairs = reducers.flatMap(m => oxidants.filter(o => o.E > m.E && o.ox !== m.ion).map(o => ({ m, o })));
  pairs.sort((a, b) => b.o.E - a.o.E || a.m.E - b.m.E);
  for (const { m, o } of pairs) {
    const g = gcd(m.e, o.e), a = o.e / g, b = m.e / g;
    const reactants: Terms = { [m.metal]: a, [o.ox]: b } as Terms;
    const products: Terms = { [m.ion]: a } as Terms;
    for (const [id, c] of terms(o.red)) products[id] = (products[id] ?? 0) + c * b;
    const hydrogen = o.ox === 'H+';
    rules.push(complete(`metal-${m.metal}-${o.ox}`, hydrogen ? 'gas' : 'redox', reactants, products,
      hydrogen ? `El ${species[m.metal as SpeciesId].name} se disuelve en el ácido y libera hidrógeno` : `El ${species[m.metal as SpeciesId].name} desplaza al ${o.name}`,
      hydrogen ? 'Un metal más activo que el hidrógeno se oxida y reduce los iones H⁺ a H₂ gaseoso.' : `El metal más activo cede electrones: E° (${label(o.ox)}) > E° (${label(m.ion as SpeciesId)}).`,
      Math.min(1, Math.max(0.2, (o.E - m.E) / 1.6)) * (hydrogen ? 1 : 0.6)));
    if (hydrogen && (m.metal === 'Mg' || m.metal === 'Zn')) rules.push(complete(`metal-${m.metal}-HAc`, 'gas', { [m.metal]: 1, HAc: 2 } as Terms, { [m.ion]: 1, 'Ac-': 2, H2: 1 } as Terms,
      `El ${species[m.metal as SpeciesId].name} reacciona con el ácido acético`, 'El ácido débil también oxida al metal, pero en la realidad es más lento que con un ácido fuerte; el modelo no calcula velocidades.', m.metal === 'Mg' ? 0.5 : 0.15));
  }
  return rules;
}
/** Insoluble hydroxides, oxides and carbonates redissolve in acids. */
function acidDissolutionRules(): CompleteRule[] {
  const solids: { id: SpeciesId; ion: SpeciesId; count: number; base: 'OH' | 'CO3' | 'O' }[] = [
    { id: 'Cu(OH)2', ion: 'Cu2+', count: 1, base: 'OH' }, { id: 'Fe(OH)3', ion: 'Fe3+', count: 1, base: 'OH' }, { id: 'Fe(OH)2', ion: 'Fe2+', count: 1, base: 'OH' },
    { id: 'Mg(OH)2', ion: 'Mg2+', count: 1, base: 'OH' }, { id: 'Zn(OH)2', ion: 'Zn2+', count: 1, base: 'OH' }, { id: 'Pb(OH)2', ion: 'Pb2+', count: 1, base: 'OH' },
    { id: 'Ca(OH)2', ion: 'Ca2+', count: 1, base: 'OH' }, { id: 'Ag2O', ion: 'Ag+', count: 2, base: 'O' },
    { id: 'CaCO3', ion: 'Ca2+', count: 1, base: 'CO3' }, { id: 'BaCO3', ion: 'Ba2+', count: 1, base: 'CO3' }, { id: 'MgCO3', ion: 'Mg2+', count: 1, base: 'CO3' },
    { id: 'ZnCO3', ion: 'Zn2+', count: 1, base: 'CO3' }, { id: 'PbCO3', ion: 'Pb2+', count: 1, base: 'CO3' }, { id: 'CuCO3', ion: 'Cu2+', count: 1, base: 'CO3' }, { id: 'Ag2CO3', ion: 'Ag+', count: 2, base: 'CO3' },
  ];
  return solids.flatMap(s => {
    const charge = species[s.ion].charge * s.count;
    return (['H+', 'HAc'] as const).map(acid => {
      const reactants: Terms = { [s.id]: 1, [acid]: charge } as Terms;
      const products: Terms = { [s.ion]: s.count } as Terms;
      if (acid === 'HAc') products['Ac-'] = charge;
      if (s.base === 'CO3') { products.H2O = 1; products.CO2 = 1; } else products.H2O = s.base === 'OH' ? charge : 1;
      return complete(`acid-${s.id}-${acid}`, s.base === 'CO3' ? 'gas' : 'disolución', reactants, products,
        s.base === 'CO3' ? `El ácido ataca al ${species[s.id].name} y libera CO₂` : `El ácido disuelve el ${species[s.id].name}`,
        s.base === 'CO3' ? 'Los carbonatos reaccionan con ácidos: forman agua y dióxido de carbono.' : 'Los iones H⁺ neutralizan la base sólida y el metal vuelve a la disolución.',
        s.base === 'CO3' ? (acid === 'H+' ? 0.75 : 0.45) : 0.25);
    });
  });
}
const k = constants.ksp;
export const rules: Rule[] = [
  complete('neutral-strong', 'neutralización', { 'H+': 1, 'OH-': 1 }, { H2O: 1 }, 'Neutralización ácido–base', 'Los iones H⁺ y OH⁻ forman agua y liberan calor.', 0.1),
  complete('neutral-acetic', 'neutralización', { HAc: 1, 'OH-': 1 }, { 'Ac-': 1, H2O: 1 }, 'El hidróxido neutraliza el ácido acético', 'La base fuerte arranca el protón del ácido débil.', 0.1),
  complete('neutral-ammonium', 'neutralización', { 'NH4+': 1, 'OH-': 1 }, { NH3: 1, H2O: 1 }, 'Se forma amoníaco', 'El ion amonio cede un protón al hidróxido. Huele a amoníaco: mantén el extractor encendido.', 0.15),
  complete('neutral-bicarbonate', 'neutralización', { 'HCO3-': 1, 'OH-': 1 }, { 'CO3-2': 1, H2O: 1 }, 'El hidróxido convierte bicarbonato en carbonato', 'El bicarbonato actúa como ácido frente a una base fuerte.', 0.1),
  complete('carbonate-strong', 'neutralización', { 'H+': 1, 'CO3-2': 1 }, { 'HCO3-': 1 }, 'El carbonato capta un protón', 'Primero se forma bicarbonato; las burbujas aparecen cuando sigue habiendo ácido.', 0.1),
  complete('carbonate-acetic', 'neutralización', { HAc: 1, 'CO3-2': 1 }, { 'Ac-': 1, 'HCO3-': 1 }, 'El carbonato capta un protón del ácido acético', 'Primero se forma bicarbonato.', 0.1),
  complete('ammonia-strong', 'neutralización', { 'H+': 1, NH3: 1 }, { 'NH4+': 1 }, 'El amoníaco se neutraliza', 'El amoníaco capta un protón y forma amonio.', 0.1),
  complete('ammonia-acetic', 'neutralización', { HAc: 1, NH3: 1 }, { 'NH4+': 1, 'Ac-': 1 }, 'El amoníaco reacciona con el ácido acético', 'Se forma acetato de amonio.', 0.1),
  complete('co2-strong', 'gas', { 'H+': 1, 'HCO3-': 1 }, { H2O: 1, CO2: 1 }, 'Efervescencia: se libera CO₂', 'El ácido carbónico formado se descompone en agua y dióxido de carbono gaseoso.', 1),
  complete('co2-acetic', 'gas', { HAc: 1, 'HCO3-': 1 }, { 'Ac-': 1, H2O: 1, CO2: 1 }, 'Efervescencia: se libera CO₂', 'El ácido acético reacciona con el bicarbonato (relación 1:1).', 0.85),
  complete('acetate-strong', 'neutralización', { 'H+': 1, 'Ac-': 1 }, { HAc: 1 }, 'El ácido fuerte protona el acetato', 'Se regenera ácido acético, un ácido más débil.', 0.05),
  complete('bicarbonate-solid-strong', 'gas', { 'NaHCO3(s)': 1, 'H+': 1 }, { 'Na+': 1, H2O: 1, CO2: 1 }, 'El bicarbonato sólido burbujea en el ácido', 'El sólido reacciona directamente con los iones H⁺.', 1),
  complete('bicarbonate-solid-acetic', 'gas', { 'NaHCO3(s)': 1, HAc: 1 }, { 'Na+': 1, 'Ac-': 1, H2O: 1, CO2: 1 }, 'El bicarbonato sólido burbujea en el vinagre', 'La reacción clásica de vinagre y bicarbonato.', 0.9),
  ...acidDissolutionRules(),
  complete('permanganate-peroxide', 'redox', { 'MnO4-': 2, H2O2: 5, 'H+': 6 }, { 'Mn2+': 2, O2: 5, H2O: 8 }, 'El permanganato oxida al peróxido', 'En medio ácido el violeta desaparece y se libera oxígeno.', 0.8),
  complete('permanganate-iodide', 'redox', { 'MnO4-': 2, 'I-': 10, 'H+': 16 }, { 'Mn2+': 2, I2: 5, H2O: 8 }, 'El permanganato oxida al yoduro', 'Se forma yodo pardo y el violeta desaparece.', 0.3),
  complete('permanganate-iron', 'redox', { 'MnO4-': 1, 'Fe2+': 5, 'H+': 8 }, { 'Mn2+': 1, 'Fe3+': 5, H2O: 4 }, 'El permanganato oxida al hierro(II)', 'Base de las valoraciones redox: el violeta se decolora.', 0.2),
  complete('peroxide-iodide', 'redox', { H2O2: 1, 'I-': 2, 'H+': 2 }, { I2: 1, H2O: 2 }, 'El peróxido oxida al yoduro', 'En medio ácido el H₂O₂ convierte I⁻ en yodo.', 0.2),
  complete('iron-iodide', 'redox', { 'Fe3+': 2, 'I-': 2 }, { 'Fe2+': 2, I2: 1 }, 'El hierro(III) oxida al yoduro', 'Aparece el color pardo del yodo.', 0.2),
  complete('copper-iodide', 'redox', { 'Cu2+': 2, 'I-': 4 }, { CuI: 2, I2: 1 }, 'El cobre(II) oxida al yoduro', 'Se forma CuI sólido y yodo pardo.', 0.3),
  complete('permanganate-peroxide-neutral', 'redox', { 'MnO4-': 2, H2O2: 3 }, { MnO2: 2, O2: 3, 'OH-': 2, H2O: 2 }, 'El permanganato oxida al peróxido sin ácido', 'Sin ácido se forma dióxido de manganeso pardo y se libera oxígeno.', 0.7),
  complete('peroxide-decomposition', 'descomposición', { H2O2: 2 }, { H2O: 2, O2: 1 }, 'Descomposición catalítica del peróxido', 'El yoduro o el MnO₂ aceleran la descomposición: espuma de oxígeno y calor. El catalizador no se consume.', 1, ['I-', 'MnO2']),
  ...displacementRules(),
  ksp('AgI', { 'Ag+': 1, 'I-': 1 }, k.AgI), ksp('AgCl', { 'Ag+': 1, 'Cl-': 1 }, k.AgCl), ksp('Ag2CO3', { 'Ag+': 2, 'CO3-2': 1 }, k.Ag2CO3),
  ksp('Ag2SO4', { 'Ag+': 2, 'SO4-2': 1 }, k.Ag2SO4), { ...ksp('Ag2O', { 'Ag+': 2, 'OH-': 2 }, k.AgOH ** 2, 'Se aproxima con el Ksp de AgOH al cuadrado.'), water: 1 },
  ksp('PbI2', { 'Pb2+': 1, 'I-': 2 }, k.PbI2), ksp('PbCl2', { 'Pb2+': 1, 'Cl-': 2 }, k.PbCl2), ksp('PbSO4', { 'Pb2+': 1, 'SO4-2': 1 }, k.PbSO4),
  ksp('PbCO3', { 'Pb2+': 1, 'CO3-2': 1 }, k.PbCO3), ksp('Pb(OH)2', { 'Pb2+': 1, 'OH-': 2 }, k['Pb(OH)2']),
  ksp('BaSO4', { 'Ba2+': 1, 'SO4-2': 1 }, k.BaSO4), ksp('BaCO3', { 'Ba2+': 1, 'CO3-2': 1 }, k.BaCO3),
  ksp('CaCO3', { 'Ca2+': 1, 'CO3-2': 1 }, k.CaCO3), ksp('CaSO4', { 'Ca2+': 1, 'SO4-2': 1 }, k.CaSO4), ksp('Ca(OH)2', { 'Ca2+': 1, 'OH-': 2 }, k['Ca(OH)2']),
  ksp('Cu(OH)2', { 'Cu2+': 1, 'OH-': 2 }, k['Cu(OH)2']), ksp('CuCO3', { 'Cu2+': 1, 'CO3-2': 1 }, k.CuCO3),
  ksp('Fe(OH)3', { 'Fe3+': 1, 'OH-': 3 }, k['Fe(OH)3']), ksp('Fe(OH)2', { 'Fe2+': 1, 'OH-': 2 }, k['Fe(OH)2']),
  ksp('Mg(OH)2', { 'Mg2+': 1, 'OH-': 2 }, k['Mg(OH)2']), ksp('MgCO3', { 'Mg2+': 1, 'CO3-2': 1 }, k.MgCO3),
  ksp('Zn(OH)2', { 'Zn2+': 1, 'OH-': 2 }, k['Zn(OH)2']), ksp('ZnCO3', { 'Zn2+': 1, 'CO3-2': 1 }, k.ZnCO3),
  soluble('NaHCO3(s)', { 'Na+': 1, 'HCO3-': 1 }, constants.solubility.NaHCO3),
  soluble('CaCl2(s)', { 'Ca2+': 1, 'Cl-': 2 }, constants.solubility.CaCl2),
  soluble('NH4NO3(s)', { 'NH4+': 1, 'NO3-': 1 }, constants.solubility.NH4NO3),
].filter(rule => rule.type === 'complete' || rule.ksp > 0);

export interface Addition { reagent: ReagentId; amount: number }
export interface Mixture {
  /** Amounts in the flask, mol. Water is tracked as liquid volume, and gases leave the open flask. */
  n: Terms; waterMl: number; temperatureC: number; indicators: IndicatorId[]; additions: Addition[];
  released: Partial<Record<'CO2' | 'H2' | 'O2', number>>; heatUnknown: boolean;
}
export const emptyMixture = (): Mixture => ({ n: {}, waterMl: 0, temperatureC: ROOM_C, indicators: [], additions: [], released: {}, heatUnknown: false });
export interface SandboxEvent {
  rule: string; kind: RuleKind; title: string; note: string; equation: string; extent: number; vigor: number;
  /** kJ per mol of reaction as written, and kJ released into the mixture. */
  deltaH: number | null; heat: number | null;
  gas?: { id: SpeciesId; mol: number }; solid?: { id: SpeciesId; mol: number };
}
export interface MixOutcome { mixture: Mixture; events: SandboxEvent[]; deltaT: number; heatKJ: number; note: string }

function solubilityShift(n: Terms, rule: SolubilityRule, litres: number) {
  const ions = terms(rule.ions);
  const solid = n[rule.solid] ?? 0;
  const logK = Math.log(rule.ksp);
  const logQ = (xi: number) => {
    let sum = 0;
    for (const [id, nu] of ions) { const amount = (n[id] ?? 0) - nu * xi; if (amount <= 1e-300) return -Infinity; sum += nu * Math.log(amount / litres); }
    return sum;
  };
  const q0 = logQ(0);
  if (q0 > logK + 1e-7) {
    let lo = 0, hi = Math.min(...ions.map(([id, nu]) => (n[id] ?? 0) / nu));
    for (let i = 0; i < 90; i++) { const mid = (lo + hi) / 2; if (logQ(mid) > logK) lo = mid; else hi = mid; }
    return lo;
  }
  if (q0 < logK - 1e-7 && solid > 0) {
    if (logQ(-solid) <= logK) return -solid;
    let lo = -solid, hi = 0;
    for (let i = 0; i < 90; i++) { const mid = (lo + hi) / 2; if (logQ(mid) > logK) lo = mid; else hi = mid; }
    return hi;
  }
  return 0;
}
function shift(mix: Mixture, reactants: Terms, products: Terms, xi: number) {
  for (const [t, sign] of [[reactants, -1], [products, 1]] as const) for (const [id, c] of terms(t)) {
    if (id === 'H2O') { mix.waterMl = Math.max(0, mix.waterMl + sign * c * xi * WATER_MOLAR_ML); continue; }
    if (species[id].phase === 'g') { const gas = id as 'CO2' | 'H2' | 'O2'; mix.released[gas] = (mix.released[gas] ?? 0) + sign * c * xi; continue; }
    const next = (mix.n[id] ?? 0) + sign * c * xi;
    if (next > 1e-15) mix.n[id] = next; else delete mix.n[id];
  }
}
/** Apply every rule until nothing changes. Returns the net extent of each rule. */
function react(mix: Mixture) {
  const extents = new Map<Rule, number>();
  if (mix.waterMl <= 0) return extents;
  for (let pass = 0; pass < 120; pass++) {
    let changed = false;
    for (const rule of rules) {
      let xi = 0, reactants: Terms, products: Terms;
      if (rule.type === 'complete') {
        if (rule.catalysts && !rule.catalysts.some(c => (mix.n[c] ?? 0) > 1e-9)) continue;
        xi = Math.min(...terms(rule.reactants).map(([id, c]) => (mix.n[id] ?? 0) / c));
        reactants = rule.reactants; products = rule.products;
      } else {
        xi = solubilityShift(mix.n, rule, mix.waterMl / 1000);
        ({ reactants, products } = precipitation(rule));
      }
      if (!(Math.abs(xi) > 1e-13)) continue;
      shift(mix, reactants, products, xi);
      extents.set(rule, (extents.get(rule) ?? 0) + xi);
      if (Math.abs(xi) > 1e-11) changed = true;
    }
    if (!changed) break;
  }
  return extents;
}
function toEvent(rule: Rule, xi: number): SandboxEvent {
  const forward = rule.type === 'complete' ? { reactants: rule.reactants, products: rule.products } : precipitation(rule);
  const reactants = xi > 0 ? forward.reactants : forward.products;
  const products = xi > 0 ? forward.products : forward.reactants;
  const extent = Math.abs(xi);
  const deltaH = reactionEnthalpy(reactants, products);
  const gasId = terms(products).find(([id]) => species[id].phase === 'g');
  const solidId = terms(products).find(([id]) => species[id].phase === 's' && !(id in reactants));
  if (rule.type === 'solubility') {
    const s = species[rule.solid];
    const formed = xi > 0;
    return { rule: rule.id, kind: formed ? 'precipitado' : 'disolución', equation: equationText(reactants, products), extent, vigor: rule.vigor, deltaH, heat: deltaH === null ? null : -deltaH * extent,
      title: formed ? `Se forma un sólido ${s.colorName}: ${s.label}` : `Se disuelve ${s.name}`,
      note: formed ? `Cuando el producto de las concentraciones supera el Ksp, el exceso precipita. ${rule.note}`.trim() : 'El sólido pasa a la disolución hasta alcanzar su límite de solubilidad.',
      ...(formed ? { solid: { id: rule.solid, mol: extent } } : {}) };
  }
  return { rule: rule.id, kind: rule.kind, title: rule.title, note: rule.note, equation: equationText(reactants, products), extent, vigor: rule.vigor, deltaH, heat: deltaH === null ? null : -deltaH * extent,
    ...(gasId ? { gas: { id: gasId[0], mol: gasId[1] * extent } } : {}), ...(solidId ? { solid: { id: solidId[0], mol: solidId[1] * extent } } : {}) };
}

/** Add one reagent at room temperature to the flask and let the mixture react. */
export function addReagent(current: Mixture, reagentId: ReagentId, amount: number): MixOutcome {
  const reagent = reagents[reagentId];
  if (!reagent) throw new Error('Reactivo desconocido.');
  const range = amountRange(reagent);
  if (!Number.isFinite(amount) || amount < range.min - 1e-9 || amount > range.max + 1e-9) throw new Error(`Usa entre ${range.min.toLocaleString('es')} y ${range.max.toLocaleString('es')} ${range.unit}.`);
  const liquidMl = reagent.kind === 'solid' ? 0 : reagent.kind === 'indicator' ? amount * DROP_ML : amount;
  if (current.waterMl + liquidMl > VESSEL_ML) throw new Error(`El matraz se desbordaría: caben ${VESSEL_ML} mL y ya contiene ${Math.round(current.waterMl)} mL.`);
  const mix: Mixture = { ...current, n: { ...current.n }, released: { ...current.released }, indicators: [...current.indicators], additions: [...current.additions, { reagent: reagentId, amount }] };
  if (liquidMl > 0) mix.temperatureC = mix.waterMl + liquidMl > 0 ? (mix.temperatureC * mix.waterMl + ROOM_C * liquidMl) / (mix.waterMl + liquidMl) : ROOM_C;
  mix.waterMl += liquidMl;
  if (reagent.kind === 'solution') for (const [id, c] of terms(reagent.components)) mix.n[id] = (mix.n[id] ?? 0) + c * reagent.concentration * amount / 1000;
  if (reagent.kind === 'solid') mix.n[reagent.species] = (mix.n[reagent.species] ?? 0) + amount / molarMass(species[reagent.species].formula);
  if (reagent.kind === 'indicator' && !mix.indicators.includes(reagent.indicator)) mix.indicators.push(reagent.indicator);
  if (current.waterMl <= 0 && reagent.kind === 'solid') mix.temperatureC = ROOM_C;
  const all = [...react(mix)].map(([rule, xi]) => toEvent(rule, xi));
  let heatKJ = 0;
  for (const e of all) { if (e.heat !== null) heatKJ += e.heat; else if (e.extent >= 1e-6) mix.heatUnknown = true; }
  // Reports only visible changes (≥ 1 µmol); every extent still contributes to heat and amounts.
  const events = all.filter(e => e.extent >= 1e-6);
  const deltaT = mix.waterMl > 0 ? heatKJ * 1000 / (mix.waterMl * WATER_HEAT_CAPACITY) : 0;
  mix.temperatureC = Math.min(100, mix.temperatureC + deltaT);
  const first = new Set(mix.additions.map(a => a.reagent)).size === 1;
  const note = mix.waterMl <= 0 ? 'Sin agua no ocurren reacciones en disolución. Añade un líquido.'
    : events.length ? ''
    : reagentId === 'starch' ? 'El almidón solo se vuelve azul oscuro si hay yodo (I₂) en la mezcla.'
    : reagent.kind === 'indicator' ? `${reagent.name}: su color corresponde a pH ≈ ${(solvePH(mix) ?? 7).toLocaleString('es', { maximumFractionDigits: 1 })}. Un indicador no cambia la cantidad de las sustancias.`
    : first ? `${reagent.name} en el matraz. Añade otro reactivo para ver si reaccionan.`
    : reagent.kind === 'water' ? 'Dilución: las concentraciones disminuyen, pero no hay reacción nueva.'
    : 'No se observan cambios según el modelo. Algunas combinaciones reales pueden reaccionar de formas no incluidas aquí.';
  return { mixture: mix, events, deltaT, heatKJ, note };
}

/** pH from the charge balance (ideal solution, 25 °C). Returns null without liquid. */
export function solvePH(mix: Mixture): number | null {
  if (mix.waterMl <= 0) return null;
  const V = mix.waterMl / 1000;
  const systems = [
    { members: ['HAc', 'Ac-'], z0: 0, ka: [constants.ka.HAc] },
    { members: ['HCO3-', 'CO3-2'], z0: 0, ka: [constants.ka.H2CO3, constants.ka.HCO3] },
    { members: ['NH4+', 'NH3'], z0: 1, ka: [constants.ka.NH4] },
    { members: ['SO4-2'], z0: -1, ka: [constants.ka.HSO4] },
    { members: ['Fe3+'], z0: 3, ka: [constants.ka.Fe3] },
    { members: ['Cu2+'], z0: 2, ka: [constants.ka.Cu2] },
    { members: ['Zn2+'], z0: 2, ka: [constants.ka.Zn2] },
  ].map(s => ({ ...s, total: s.members.reduce((sum, id) => sum + (mix.n[id as SpeciesId] ?? 0), 0) / V }));
  const excluded = new Set(['H+', 'OH-', ...systems.flatMap(s => s.members)]);
  let strong = 0;
  for (const id of speciesIds) if (!excluded.has(id) && species[id].phase === 'aq' && species[id].charge) strong += species[id].charge * (mix.n[id] ?? 0) / V;
  const balance = (pH: number) => {
    const h = 10 ** -pH;
    let total = h - KW / h + strong;
    for (const s of systems) {
      if (!s.total) continue;
      let beta = 1, sum = 1, charge = s.z0;
      s.ka.forEach((ka, j) => { beta *= ka / h; sum += beta; charge += beta * (s.z0 - j - 1); });
      total += s.total * charge / sum;
    }
    return total;
  };
  let lo = -2, hi = 16;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (balance(mid) > 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c: RGB) => `#${c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const mix2 = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function ramp(stops: [number, string][], x: number) {
  if (x <= stops[0][0]) return hex(stops[0][1]);
  for (let i = 1; i < stops.length; i++) if (x <= stops[i][0]) return mix2(hex(stops[i - 1][1]), hex(stops[i][1]), (x - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  return hex(stops[stops.length - 1][1]);
}
/** Approximate visual colour scales; they are not spectrophotometric data. */
const universalStops: [number, string][] = [[0, '#c4161c'], [2, '#e8402a'], [3, '#f2702a'], [4, '#f7a21b'], [5, '#f9cf1a'], [6, '#c6d424'], [7, '#4cb349'], [8, '#1d9f8c'], [9, '#1f84bd'], [10, '#2a55a8'], [11, '#3e3c98'], [12, '#58308e'], [14, '#6a1f78']];
export function indicatorColor(indicator: IndicatorId, pH: number): { color: string; strength: number } | null {
  if (indicator === 'universal') return { color: toHex(ramp(universalStops, pH)), strength: 0.75 };
  if (indicator === 'bromothymol') return { color: toHex(ramp([[6, '#e2c21c'], [6.8, '#8fb23a'], [7.6, '#2453b0']], pH)), strength: 0.7 };
  if (indicator === 'phenolphthalein') { const t = Math.max(0, Math.min(1, (pH - 8.2) / 1.8)); return t > 0 ? { color: '#e0218a', strength: 0.82 * t } : null; }
  return null;
}
/** Visual colour of the liquid: weighted blend of coloured ions, iodine–starch and indicators. */
export function solutionColor(mix: Mixture, pH: number | null): { color: string; opacity: number } {
  const V = mix.waterMl / 1000;
  if (V <= 0) return { color: '#dbeef4', opacity: 0 };
  const layers: { rgb: RGB; w: number }[] = [];
  const add = (color: string, w: number) => { if (w > 0.005) layers.push({ rgb: hex(color), w: Math.min(0.96, w) }); };
  const c = (id: SpeciesId) => (mix.n[id] ?? 0) / V;
  const starch = mix.indicators.includes('starch') && c('I2') > 2e-6;
  add('#2f8fe0', 1 - Math.exp(-3.5 * c('Cu2+')));
  add('#d98a0b', 1 - Math.exp(-14 * c('Fe3+')));
  add('#a8d890', 1 - Math.exp(-2.5 * c('Fe2+')));
  add('#7a1fa2', 1 - Math.exp(-2200 * c('MnO4-')));
  add('#f2d5e3', 1 - Math.exp(-0.4 * c('Mn2+')));
  add(starch ? '#141653' : '#8a4a10', 1 - Math.exp(-(starch ? 9000 : 500) * c('I2')));
  if (pH !== null) for (const id of mix.indicators) { const ind = indicatorColor(id, pH); if (ind) add(ind.color, ind.strength); }
  if (!layers.length) return { color: '#cfe6ee', opacity: 0.3 };
  const total = layers.reduce((s, l) => s + l.w, 0);
  const rgb = layers.reduce<RGB>((acc, l) => [acc[0] + l.rgb[0] * l.w / total, acc[1] + l.rgb[1] * l.w / total, acc[2] + l.rgb[2] * l.w / total], [0, 0, 0]);
  const opacity = 1 - layers.reduce((p, l) => p * (1 - l.w), 1);
  return { color: toHex(rgb), opacity: 0.2 + 0.72 * opacity };
}

export function analyzeMixture(mix: Mixture) {
  const pH = solvePH(mix);
  const V = mix.waterMl / 1000;
  const solids = speciesIds.filter(id => species[id].phase === 's' && (mix.n[id] ?? 0) > 1e-7)
    .map(id => ({ id, label: species[id].label, name: species[id].name, color: species[id].color ?? '#f2f2ee', colorName: species[id].colorName ?? '', mol: mix.n[id]!, grams: mix.n[id]! * molarMass(species[id].formula) }))
    .sort((a, b) => b.grams - a.grams);
  const dissolved = V > 0 ? speciesIds.filter(id => species[id].phase === 'aq' && !['H+', 'OH-'].includes(id) && (mix.n[id] ?? 0) / V > 1e-5)
    .map(id => ({ id, label: species[id].label, name: species[id].name, molarity: mix.n[id]! / V })).sort((a, b) => b.molarity - a.molarity) : [];
  const gases = (['CO2', 'H2', 'O2'] as const).filter(g => (mix.released[g] ?? 0) > 1e-7).map(g => ({ id: g, label: species[g].label, mol: mix.released[g]!, litres: mix.released[g]! * GAS_L_PER_MOL }));
  return { pH, color: solutionColor(mix, pH), solids, dissolved, gases, volumeMl: mix.waterMl, temperatureC: mix.temperatureC, ammoniaSmell: V > 0 && (mix.n.NH3 ?? 0) / V > 0.01 };
}
export const gasLitres = (mol: number) => mol * GAS_L_PER_MOL;
