import type { CaseSpec, Family, StepSpec, Trace } from '../lib/types';

/**
 * Familias «ksp» (26 reglas de solubilidad en los dos sentidos y sólidos que compiten por un ion),
 * «noconv» (react() cortado a 120 pasadas sin converger) y «calor» (ΔT, tope de 100 °C, heatUnknown).
 * Ejecutar: GOLDEN_FAMILY=60-ksp-calor npm run golden
 */

/** «agno3 50, ki 10» → pasos. */
const seq = (text: string): StepSpec[] => text.split(',').map(part => { const [reagent, amount] = part.trim().split(/\s+/); return { reagent, amount: Number(amount) }; });
const slug = (solid: string) => solid.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
const WATER1: StepSpec = { reagent: 'water', amount: 1 };
/** Umbral de evento visible del motor (mol). */
const VISIBLE = 1e-6;

/** Comprobación sobre los estados tras cada paso (s[k]; k negativo cuenta desde el final). Fija la intención del caso. */
interface Check { d: string; ok: (s: Trace[]) => boolean }
const mol = (t: Trace | undefined, id: string) => t?.n[id] ?? 0;
const at = (s: Trace[], k: number) => k < 0 ? s.length + k : k;
const delta = (s: Trace[], k: number, get: (t: Trace | undefined) => number) => get(s[at(s, k)]) - get(s[at(s, k) - 1]);
const up = (id: string, k = -1): Check => ({ d: `${id} crece en el paso ${k}`, ok: s => delta(s, k, t => mol(t, id)) >= VISIBLE });
const down = (id: string, k = -1): Check => ({ d: `${id} mengua en el paso ${k}`, ok: s => -delta(s, k, t => mol(t, id)) >= VISIBLE });
const ev = (rule: string, k = -1): Check => ({ d: `${rule} da evento en el paso ${k}`, ok: s => delta(s, k, t => t?.fired[rule] ?? 0) >= VISIBLE });
const noev = (rule: string, k = -1): Check => ({ d: `${rule} no da evento en el paso ${k}`, ok: s => delta(s, k, t => t?.fired[rule] ?? 0) === 0 });
const gone = (id: string, k = -1): Check => ({ d: `no queda ${id} tras el paso ${k}`, ok: s => !(id in s[at(s, k)].n) });
const left = (id: string, k = -1): Check => ({ d: `queda ${id} tras el paso ${k}`, ok: s => mol(s[at(s, k)], id) > VISIBLE });
const state = (d: string, ok: (t: Trace) => boolean, k = -1): Check => ({ d: `${d} tras el paso ${k}`, ok: s => ok(s[at(s, k)]) });
const temp = (T: number, k = -1) => state(`T = ${T} °C`, t => t.temperatureC === T, k);
const unknown = (value: boolean, k = -1) => state(`heatUnknown = ${value}`, t => t.heatUnknown === value, k);
/** Redisolución por la propia regla de Ksp: evento visible y menos sólido. */
const dil = (solid: string, ...ks: number[]) => ks.flatMap(k => [ev(`ksp-${solid}`, k), down(solid, k)]);

/** Las 23 reglas tabuladas: precipitación estequiométrica, con exceso de un ion y redisolución (lo que el motor hace de verdad). */
interface Row {
  s: string; cat: string;
  /** Estequiométrico (y de dónde sale el catión si no hay frasco). */ pp: string; pre?: string;
  /** Gran exceso del anión `ion`. */ ex: string; ion: string;
  /** Redisolución: pasos, descripción, reglas ácidas que deben dar evento y comprobaciones. */ re: string; how: string; fire?: string[]; not?: string[]; chk: Check[];
}
const FE2 = 'el Fe²⁺ sale de Fe + H2SO4, con hierro sobrante', BA = 'el BaCl2 previo es espectador: sin él Na⁺ y Cl⁻ quedarían empatados al último bit', MG = 'el Mg²⁺ sale de Mg + HCl', ZN = 'el Zn²⁺ sale de Zn + HCl', CA = 'el Ca²⁺ sale de disolver CaCl2 sólido';
const table: Row[] = [
  { s: 'AgI', cat: 'Ag+', pp: 'agno3 50, ki 10', ex: 'agno3 20, ki 100', ion: 'I⁻', re: 'agno3 10, ki 2, water 200, water 200',
    how: 'no llega a redisolverse de forma visible: al diluir hasta 412 mL solo pasan ~5e-9 mol a la disolución y no hay evento', chk: [noev('ksp-AgI', -2), noev('ksp-AgI'), left('AgI')] },
  { s: 'AgCl', cat: 'Ag+', pp: 'agno3 50, nacl 5', ex: 'agno3 10, nacl 100', ion: 'Cl⁻', re: 'agno3 20, nacl 2, water 200, water 200',
    how: 'se redisuelve solo en parte al diluir: ~2,5 µmol por cada 200 mL, con evento visible', chk: [...dil('AgCl', -2, -1), left('AgCl')] },
  { s: 'Ag2CO3', cat: 'Ag+', pp: 'agno3 100, na2co3 10', ex: 'agno3 20, na2co3 100', ion: 'CO₃²⁻', re: 'agno3 40, na2co3 4, water 200, acetic 20',
    how: 'se redisuelve en parte al diluir (Ksp) y del todo con ácido acético, pero por la regla acid-Ag2CO3-HAc', fire: ['acid-Ag2CO3-HAc'], chk: [...dil('Ag2CO3', -2), gone('Ag2CO3')] },
  { s: 'Ag2SO4', cat: 'Ag+', pp: 'agno3 100, h2so4 10', ex: 'agno3 20, h2so4 100', ion: 'SO₄²⁻', re: 'agno3 60, h2so4 6, water 100, water 100',
    how: 'se redisuelve por dilución: en parte con los primeros 100 mL y del todo con los siguientes', chk: [...dil('Ag2SO4', -2, -1), left('Ag2SO4', -2), gone('Ag2SO4')] },
  { s: 'Ag2O', cat: 'Ag+', pp: 'agno3 50, naoh 5', ex: 'agno3 10, naoh 100', ion: 'OH⁻', re: 'agno3 20, naoh 2, water 200, acetic 10',
    how: 'se redisuelve en parte al diluir (la ecuación consume agua) y del todo con ácido acético (acid-Ag2O-HAc)', fire: ['acid-Ag2O-HAc'], chk: [...dil('Ag2O', -2), gone('Ag2O')] },
  { s: 'PbI2', cat: 'Pb2+', pp: 'pbno3 50, ki 20', ex: 'pbno3 10, ki 100', ion: 'I⁻', re: 'pbno3 5, ki 2, water 200, water 200',
    how: 'se redisuelve por dilución: parte con 200 mL y el resto con otros 200 mL', chk: [...dil('PbI2', -2, -1), left('PbI2', -2), gone('PbI2')] },
  { s: 'PbCl2', cat: 'Pb2+', pp: 'pbno3 50, nacl 10', ex: 'pbno3 50, nacl 100', ion: 'Cl⁻', re: 'pbno3 60, nacl 12, water 200, water 200',
    how: 'se redisuelve por dilución: parte con 200 mL y el resto con otros 200 mL', chk: [...dil('PbCl2', -2, -1), left('PbCl2', -2), gone('PbCl2')] },
  { s: 'PbSO4', cat: 'Pb2+', pp: 'pbno3 50, h2so4 10', ex: 'pbno3 10, h2so4 100', ion: 'SO₄²⁻', re: 'pbno3 20, h2so4 4, water 200, water 200',
    how: 'solo se redisuelve en parte al diluir (decenas de µmol por cada 200 mL)', chk: [...dil('PbSO4', -2, -1), left('PbSO4')] },
  { s: 'PbCO3', cat: 'Pb2+', pp: 'pbno3 50, na2co3 10', ex: 'pbno3 10, na2co3 100', ion: 'CO₃²⁻', re: 'pbno3 20, na2co3 4, water 200, acetic 10',
    how: 'no da evento al diluir (< 1 µmol); se redisuelve con ácido acético por la regla acid-PbCO3-HAc', fire: ['acid-PbCO3-HAc'], chk: [noev('ksp-PbCO3', -2), gone('PbCO3')] },
  { s: 'Pb(OH)2', cat: 'Pb2+', pp: 'pbno3 50, naoh 10', ex: 'pbno3 10, naoh 100', ion: 'OH⁻', re: 'pbno3 20, naoh 4, water 200, hcl 4',
    how: 'no da evento al diluir; el HCl justo lo redisuelve (acid-Pb(OH)2-H+) sin que llegue a precipitar PbCl2', fire: ['acid-Pb(OH)2-H+'], not: ['ksp-PbCl2'], chk: [noev('ksp-Pb(OH)2', -2), gone('Pb(OH)2')] },
  { s: 'BaSO4', cat: 'Ba2+', pp: 'bacl2 50, h2so4 10', ex: 'bacl2 10, h2so4 100', ion: 'SO₄²⁻', re: 'bacl2 20, h2so4 4, water 200, water 200',
    how: 'solo se redisuelve en parte al diluir (~2 µmol por cada 200 mL, evento visible por poco)', chk: [...dil('BaSO4', -2, -1), left('BaSO4')] },
  { s: 'BaCO3', cat: 'Ba2+', pp: 'bacl2 50, na2co3 10', ex: 'bacl2 10, na2co3 100', ion: 'CO₃²⁻', re: 'bacl2 20, na2co3 4, water 200, hcl 4',
    how: 'se redisuelve en parte al diluir y del todo con HCl estequiométrico (acid-BaCO3-H+), que deja pH 7', fire: ['acid-BaCO3-H+'], chk: [...dil('BaCO3', -2), gone('BaCO3')] },
  { s: 'CaCO3', cat: 'Ca2+', pp: 'water 50, cacl2 1, na2co3 18', pre: CA, ex: 'water 20, cacl2 0.5, na2co3 100', ion: 'CO₃²⁻', re: 'water 200, caco3 1, water 200, hcl 10',
    how: 'añadido como mármol se disuelve hasta su Ksp, algo más al diluir, y el HCl insuficiente ataca solo la mitad (acid-CaCO3-H+)', fire: ['acid-CaCO3-H+'], chk: [ev('ksp-CaCO3', 1), ...dil('CaCO3', 2), down('CaCO3'), left('CaCO3')] },
  { s: 'CaSO4', cat: 'Ca2+', pp: 'water 50, cacl2 2.75, h2so4 50', pre: CA, ex: 'water 20, cacl2 0.5, h2so4 100', ion: 'SO₄²⁻', re: 'water 20, cacl2 0.3, h2so4 5, water 200, water 200',
    how: 'se redisuelve por dilución: parte con 200 mL y el resto con otros 200 mL', chk: [...dil('CaSO4', -2, -1), left('CaSO4', -2), gone('CaSO4')] },
  { s: 'Ca(OH)2', cat: 'Ca2+', pp: 'water 20, cacl2 5, naoh 90', pre: CA, ex: 'water 20, cacl2 1, naoh 100', ion: 'OH⁻', re: 'water 20, cacl2 2, naoh 36, water 200, hcl 5, hcl 40',
    how: 'se redisuelve en parte al diluir; con poco HCl actúan a la vez neutral-strong, acid-Ca(OH)2-H+ y la redisolución por Ksp, y con más HCl desaparece', fire: ['acid-Ca(OH)2-H+', 'neutral-strong'],
    chk: [...dil('Ca(OH)2', 3), ev('ksp-Ca(OH)2', 4), ev('acid-Ca(OH)2-H+', 4), gone('Ca(OH)2')] },
  { s: 'Cu(OH)2', cat: 'Cu2+', pp: 'cuso4 10, naoh 10', ex: 'cuso4 2, naoh 100', ion: 'OH⁻', re: 'cuso4 4, naoh 4, water 200, hcl 4',
    how: 'no da evento al diluir; se redisuelve con HCl estequiométrico por la regla acid-Cu(OH)2-H+', fire: ['acid-Cu(OH)2-H+'], chk: [noev('ksp-Cu(OH)2', -2), gone('Cu(OH)2')] },
  { s: 'CuCO3', cat: 'Cu2+', pp: 'cuso4 10, na2co3 10', ex: 'cuso4 2, na2co3 100', ion: 'CO₃²⁻', re: 'cuso4 4, na2co3 4, water 200, water 200',
    how: 'solo se redisuelve en parte al diluir (~3 µmol por cada 200 mL); su ΔH no está tabulado y la temperatura no se mueve de 25 °C', chk: [...dil('CuCO3', -2, -1), left('CuCO3'), temp(25), unknown(true)] },
  { s: 'Fe(OH)3', cat: 'Fe3+', pp: 'bacl2 10, fecl3 50, naoh 15', pre: BA, ex: 'fecl3 10, naoh 100', ion: 'OH⁻', re: 'bacl2 5, fecl3 20, naoh 6, water 200, hcl 6',
    how: `no da evento al diluir; se redisuelve con HCl estequiométrico por la regla acid-Fe(OH)3-H+ (${BA})`, fire: ['acid-Fe(OH)3-H+'], chk: [noev('ksp-Fe(OH)3', -2), gone('Fe(OH)3')] },
  { s: 'Fe(OH)2', cat: 'Fe2+', pp: 'h2so4 20, fe 1, naoh 20', pre: FE2, ex: 'hcl 20, fe 0.5, naoh 100', ion: 'OH⁻', re: 'hcl 20, fe 1, naoh 20, water 200, acetic 30',
    how: 'se redisuelve apenas al diluir (~1,5 µmol, evento visible) y del todo con ácido acético (acid-Fe(OH)2-HAc); el hierro sobrante no reacciona con el acético', fire: ['acid-Fe(OH)2-HAc'], chk: [...dil('Fe(OH)2', -2), gone('Fe(OH)2'), left('Fe')] },
  { s: 'Mg(OH)2', cat: 'Mg2+', pp: 'hcl 20, mg 0.25, naoh 20', pre: MG, ex: 'hcl 10, mg 0.1, naoh 100', ion: 'OH⁻', re: 'hcl 10, mg 0.15, naoh 10, water 200, water 200, hcl 10',
    how: 'se redisuelve en parte en cada dilución y del todo con HCl (acid-Mg(OH)2-H+, que va antes que el ataque al magnesio sobrante)', fire: ['acid-Mg(OH)2-H+'], chk: [...dil('Mg(OH)2', 3, 4), gone('Mg(OH)2')] },
  { s: 'MgCO3', cat: 'Mg2+', pp: 'hcl 20, mg 0.25, na2co3 20', pre: MG, ex: 'hcl 5, mg 0.05, na2co3 100', ion: 'CO₃²⁻', re: 'hcl 5, mg 0.05, na2co3 3, water 200, water 200, water 90',
    how: 'se redisuelve por dilución en tres pasos hasta desaparecer a 498 mL; el HCl sobrante había convertido parte del carbonato en bicarbonato', chk: [...dil('MgCO3', 3, 4, 5), left('MgCO3', 4), gone('MgCO3')] },
  { s: 'Zn(OH)2', cat: 'Zn2+', pp: 'hcl 20, zn 0.7, naoh 20', pre: ZN, ex: 'hcl 10, zn 0.3, naoh 100', ion: 'OH⁻', re: 'hcl 10, zn 0.35, naoh 10, water 200, hcl 10',
    how: 'no da evento al diluir (< 1 µmol); se redisuelve con HCl por la regla acid-Zn(OH)2-H+', fire: ['acid-Zn(OH)2-H+'], chk: [noev('ksp-Zn(OH)2', -2), gone('Zn(OH)2')] },
  { s: 'ZnCO3', cat: 'Zn2+', pp: 'hcl 20, zn 0.7, na2co3 20', pre: ZN, ex: 'hcl 10, zn 0.3, na2co3 100', ion: 'CO₃²⁻', re: 'hcl 10, zn 0.35, na2co3 10, water 200, water 200, hcl 10',
    how: 'se redisuelve unos µmol en cada dilución (evento visible) y del todo con HCl (acid-ZnCO3-H+)', fire: ['acid-ZnCO3-H+'], chk: [...dil('ZnCO3', 3, 4), gone('ZnCO3')] },
];

const family: Family = ctx => {
  const cases: CaseSpec[] = [];
  const states = (steps: StepSpec[]) => steps.map((_, i) => ctx.trace(steps.slice(0, i + 1)));
  const verify = (id: string, s: Trace[], checks: Check[]) => {
    const error = s[s.length - 1].errors.findIndex(Boolean);
    if (error >= 0) throw new Error(`${id}: el paso ${error + 1} da error.`);
    for (const c of checks) if (!c.ok(s)) throw new Error(`${id}: el motor no hace lo que el caso describe (${c.d}).`);
  };
  const add = (id: string, text: string, why: string, fire: string[] = [], checks: Check[] = [], notFire: string[] = []) => {
    const steps = seq(text);
    verify(id, states(steps), checks);
    cases.push({ id, fn: 'sequence', steps, why, ...(fire.length ? { mustFire: fire } : {}), ...(notFire.length ? { mustNotFire: notFire } : {}) });
  };

  // ── ksp: las 23 reglas tabuladas ──
  for (const r of table) {
    const rule = `ksp-${r.s}`, id = `ksp/${slug(r.s)}`;
    add(`${id}/estequiometrico`, r.pp, `${r.s} precipita con cantidades estequiométricas (${r.pp})${r.pre ? `; ${r.pre}` : ''}.`, [rule], [up(r.s)]);
    const extinct = !(r.cat in ctx.trace(seq(r.ex)).n);
    add(`${id}/exceso`, r.ex, `${r.s} precipita con gran exceso de ${r.ion} (ion común): ${extinct ? `el ${r.cat} libre cae por debajo de 1e-15 mol y el motor lo borra de la mezcla` : `queda una traza de ${r.cat} fijada por el Ksp`}.`, [rule], [up(r.s)]);
    add(`${id}/redisolucion`, r.re, `${r.s} ${r.how}.`, [rule, ...(r.fire ?? [])], r.chk, r.not);
  }
  add('ksp/ca-oh-2/acido-insuficiente', 'water 20, cacl2 1, naoh 100, hcl 50', 'El HCl no alcanza al OH⁻ libre: solo hay neutral-strong y el Ca(OH)2 se redisuelve unos µmol por su propio Ksp, sin acid-Ca(OH)2-H+.',
    ['ksp-Ca(OH)2', 'neutral-strong'], dil('Ca(OH)2', -1), ['acid-Ca(OH)2-H+']);

  // ── ksp: las 3 sales solubles (se disuelven; solo el CaCl2 llega a precipitar, y NaHCO3 y NH4NO3 nunca) ──
  add('ksp/nahco3/disolucion', 'water 100, nahco3 5', 'NaHCO3 se disuelve por completo (5 g en 100 mL, por debajo de 9,6 g/100 mL) y enfría el agua.', ['ksp-NaHCO3(s)'], [gone('NaHCO3(s)')]);
  add('ksp/nahco3/saturacion', 'nahco3 10, water 5, water 50, water 100', 'NaHCO3 sobre matraz seco: 5 mL solo disuelven 0,48 g, 55 mL siguen saturados y con 155 mL se disuelve el resto.',
    ['ksp-NaHCO3(s)'], [left('NaHCO3(s)', 1), left('NaHCO3(s)', 2), ...dil('NaHCO3(s)', 1, 2, 3), gone('NaHCO3(s)')]);
  add('ksp/nahco3/ion-comun', 'water 1, nahco3 10, nacl 20, naoh 20', 'NaHCO3 saturado: el Na⁺ del NaCl (ion común) limita lo que se disuelve y el NaOH, al gastar bicarbonato, disuelve más sólido.',
    ['ksp-NaHCO3(s)', 'neutral-bicarbonate'], [ev('ksp-NaHCO3(s)', 1), ...dil('NaHCO3(s)', 2, 3), left('NaHCO3(s)')]);
  add('ksp/nahco3/no-precipita', 'nahco3 10, nahco3 10, nahco3 10, naoh 200, hcl 50', 'Intento de precipitar NaHCO3: disolución saturada con Na⁺ ≈ 2,5 M y carbonato, al que el HCl convierte en bicarbonato; la dilución gana y el sólido sigue disolviéndose.',
    ['ksp-NaHCO3(s)', 'carbonate-strong'], [left('NaHCO3(s)', 3), ...dil('NaHCO3(s)', -1), left('NaHCO3(s)')]);
  add('ksp/cacl2/disolucion', 'cacl2 2, water 50', 'CaCl2 sobre matraz seco no reacciona; al añadir 50 mL de agua se disuelve entero y calienta la mezcla.', ['ksp-CaCl2(s)'], [left('CaCl2(s)', 0), gone('CaCl2(s)')]);
  add('ksp/cacl2/saturacion', 'cacl2 10, water 1, water 5, water 20', 'CaCl2: 1 mL solo disuelve 0,745 g y 6 mL siguen saturados, con la temperatura en el tope de 100 °C; con 26 mL se disuelve el resto.',
    ['ksp-CaCl2(s)'], [left('CaCl2(s)', 2), ...dil('CaCl2(s)', 1, 2, 3), temp(100, 1), temp(100, 2), gone('CaCl2(s)')]);
  add('ksp/cacl2/precipita', 'hcl 20, cacl2 10, cacl2 10, caco3 1, water 50', 'Única vía para que una sal soluble precipite: el mármol, al reaccionar con el HCl de una disolución saturada de CaCl2, aporta Ca²⁺ sin volumen y precipitan ~2 mmol de CaCl2 (endotérmico: baja de 100 °C); el agua lo redisuelve todo.',
    ['ksp-CaCl2(s)', 'acid-CaCO3-H+'], [left('CaCl2(s)', 2), temp(100, 2), ev('ksp-CaCl2(s)', 3), up('CaCl2(s)', 3), state('T < 100', t => t.temperatureC < 100, 3), gone('CaCl2(s)')]);
  add('ksp/nh4no3/disolucion', 'water 50, nh4no3 5', 'NH4NO3 se disuelve por completo en 50 mL y enfría la mezcla.', ['ksp-NH4NO3(s)'], [gone('NH4NO3(s)')]);
  add('ksp/nh4no3/saturacion', 'nh4no3 10, water 1, water 2, water 10', 'NH4NO3: 1 mL solo disuelve 1,92 g y 3 mL siguen saturados (el modelo da −136 °C); con 13 mL se disuelve el resto.',
    ['ksp-NH4NO3(s)'], [left('NH4NO3(s)', 2), ...dil('NH4NO3(s)', 1, 2, 3), state('T < −100 °C', t => t.temperatureC < -100, 2), gone('NH4NO3(s)')]);

  // ── ksp: sólidos que compiten por un ion (el orden de las reglas y de las adiciones decide el reparto) ──
  add('ksp/compite/agcl-luego-ki', 'agno3 20, nacl 2, ki 4, ki 20', 'KI sobre AgCl ya formado: debería convertirse todo en AgI, pero en cada paso solo pasan ~5 µmol porque el intercambio AgCl → AgI se corta a 120 pasadas.',
    ['ksp-AgCl', 'ksp-AgI'], [down('AgCl', 2), up('AgI', 2), down('AgCl', 3), up('AgI', 3), state('AgCl ≫ AgI', t => mol(t, 'AgCl') > 100 * mol(t, 'AgI'))]);
  add('ksp/compite/agi-agcl-plata-al-final', 'ki 4, nacl 2, agno3 20', 'Los mismos reactivos con la plata al final: la regla de AgI va antes que la de AgCl y se queda con todo el Ag⁺; el AgCl no llega a 1 µmol.',
    ['ksp-AgI'], [up('AgI'), state('AgCl < 1 µmol', t => mol(t, 'AgCl') < VISIBLE)], ['ksp-AgCl']);
  add('ksp/compite/baso4-baco3', 'h2so4 10, naoh 10, na2co3 10, bacl2 50, bacl2 50', 'Ba²⁺ sobre sulfato y carbonato a la vez: con el primer BaCl2 casi todo es BaSO4 (va antes y es menos soluble) y el BaCO3 precipita con el segundo.',
    ['ksp-BaSO4', 'ksp-BaCO3'], [up('BaSO4', 3), state('BaSO4 ≫ BaCO3', t => mol(t, 'BaSO4') > 100 * mol(t, 'BaCO3'), 3), up('BaCO3')]);
  add('ksp/compite/pb-tres-aniones', 'nacl 20, ki 4, h2so4 2, naoh 2, pbno3 50, pbno3 100', 'Pb²⁺ sobre yoduro, cloruro y sulfato a la vez: precipitan PbI2, PbCl2 y PbSO4 juntos y se reparten el plomo; más plomo hace crecer sobre todo el PbCl2.',
    ['ksp-PbI2', 'ksp-PbCl2', 'ksp-PbSO4'], [up('PbI2', 4), up('PbCl2', 4), up('PbSO4', 4), up('PbCl2')]);
  add('ksp/compite/agcl-ag2o-plata-al-final', 'naoh 5, nacl 5, agno3 50, agno3 50', 'Ag⁺ sobre cloruro e hidróxido a la vez: primero casi todo es AgCl (su regla va antes) y el Ag2O precipita con el segundo AgNO3, formando agua.',
    ['ksp-AgCl', 'ksp-Ag2O'], [up('AgCl', 2), state('AgCl ≫ Ag2O', t => mol(t, 'AgCl') > 100 * mol(t, 'Ag2O'), 2), up('Ag2O')]);

  // ── noconv: dos equilibrios comparten un ion y react() se corta a 120 pasadas ──
  /**
   * Registra la secuencia y tres «water 1». Solo se queda con ella si `solid` deriva de verdad: tres veces 1 mL
   * no da lo mismo que 3 mL de una vez, o el primer mL mueve cien veces más sólido que el tercero.
   */
  const drift = (name: string, text: string, solid: string, why: string, checks: Check[] = []) => {
    const id = `noconv/${name}`, base = seq(text), steps = [...base, WATER1, WATER1, WATER1];
    const s = states(steps), b = base.length - 1;
    verify(id, s, []);
    verify(id, s.slice(0, base.length), checks);
    const d = [1, 2, 3].map(k => mol(s[b + k], solid) - mol(s[b + k - 1], solid));
    const path = mol(s[b + 3], solid) - mol(ctx.trace([...base, { reagent: 'water', amount: 3 }]), solid);
    if (!(Math.abs(path) > 1e-9 || (Math.abs(d[0]) > 1e-9 && Math.abs(d[0]) > 100 * Math.abs(d[2])))) throw new Error(`${id}: ${solid} no deriva (Δ por paso ${d.map(x => x.toExponential(2)).join(', ')}; 3×1 mL − 3 mL = ${path.toExponential(2)}).`);
    cases.push({ id, fn: 'sequence', steps, why });
  };
  drift('caco3-baco3', 'bacl2 50, caco3 1', 'BaCO3', 'El mármol cede CO₃²⁻ al Ba²⁺: el CaCO3 mengua y el BaCO3 crece decenas de µmol en cada «water 1», porque 120 pasadas no agotan el intercambio.');
  drift('caco3-ag2co3', 'agno3 50, caco3 1', 'Ag2CO3', 'Igual con plata: el CaCO3 se disuelve y el Ag2CO3 crece decenas de µmol en cada «water 1».');
  drift('caco3-pbco3', 'pbno3 50, caco3 1', 'PbCO3', 'Igual con plomo: el CaCO3 se disuelve y el PbCO3 crece decenas de µmol en cada «water 1».');
  drift('caco3-baco3-se-agota', 'bacl2 200, caco3 0.05', 'CaCO3', 'Con poco mármol y mucho bario la deriva termina: el CaCO3 se agota en el segundo «water 1» y el tercero ya no cambia el BaCO3.');
  drift('caco3-cuso4', 'water 50, caco3 1, cuso4 10', 'CuCO3', 'Tres sólidos: el CaCO3 mengua mientras CuCO3 y CaSO4 crecen ~80 µmol en cada «water 1» (y heatUnknown queda activado por el CuCO3).');
  drift('caco3-cuso4-concentrado', 'caco3 1, cuso4 50', 'CaSO4', 'Sin agua previa la deriva es casi lineal: ~0,3 mmol de CaCO3 pasan a CuCO3 y CaSO4 en cada «water 1».');
  drift('caco3-ca-oh-2', 'water 50, caco3 1, naoh 50', 'Ca(OH)2', 'NaOH sobre mármol: el CaCO3 pasa poco a poco a Ca(OH)2, con una deriva que se va frenando (25, 12 y 7 µmol).');
  drift('agcl-cobre', 'agno3 50, nacl 10, cu 1', 'Ag', 'Cobre sobre AgCl con exceso de Cl⁻: el AgCl debería reducirse a plata, pero solo deriva ~1,4e-8 mol por paso (sin evento visible).');
  drift('agcl-agi-exceso-cl', 'agno3 50, nacl 10, ki 5', 'AgI', 'KI sobre AgCl con exceso de Cl⁻: el AgI crece solo ~1,7e-8 mol por paso; el intercambio completo necesitaría millones de pasadas.');
  drift('agcl-agi', 'agno3 50, nacl 5, ki 10', 'AgI', 'KI sobre AgCl estequiométrico: el AgCl mengua y el AgI crece unos µmol en cada «water 1».');
  drift('ag2o-agcl', 'agno3 50, naoh 5, nacl 5', 'AgCl', 'NaCl sobre Ag2O: el óxido mengua y el AgCl crece decenas de µmol en cada «water 1», liberando OH⁻.');
  drift('ag2co3-agi', 'agno3 100, na2co3 10, ki 20', 'AgI', 'KI sobre Ag2CO3: el carbonato mengua ~0,3 mmol y el AgI crece ~0,6 mmol en cada «water 1».');
  drift('baco3-cuso4', 'bacl2 50, na2co3 10, cuso4 10', 'BaSO4', 'Doble intercambio: el BaCO3 mengua mientras BaSO4 y CuCO3 crecen ~0,34 mmol en cada «water 1».');
  drift('pbcl2-pbi2', 'pbno3 50, nacl 100, ki 20', 'PbI2', 'KI sobre PbCl2: ni siendo el PbCl2 bastante soluble basta un paso; entre 0,5 y 0,9 mmol pasan a PbI2 en cada «water 1».');
  drift('pbcl2-pbso4', 'pbno3 50, nacl 100, cuso4 10', 'PbSO4', 'Sulfato sobre PbCl2: ~0,9 mmol de PbCl2 pasan a PbSO4 en cada «water 1».');
  drift('pbso4-pbi2', 'pbno3 50, h2so4 5, ki 20', 'PbI2', 'KI sobre PbSO4 con Pb²⁺ sobrante: tras precipitar el PbI2 directo, el PbSO4 sigue cediendo plomo decenas de µmol por paso.');
  drift('pbi2-cinc', 'pbno3 50, ki 20, zn 1', 'Pb', 'Cinc sobre PbI2: el PbI2 se disuelve y el plomo metálico crece ~0,1–0,2 mmol en cada «water 1».');
  drift('pbso4-cinc', 'pbno3 50, h2so4 10, naoh 10, zn 1', 'Pb', 'Cinc sobre PbSO4 en medio neutro: el PbSO4 se disuelve y el plomo metálico crece decenas de µmol por paso.');
  drift('caso4-caco3-un-paso', 'h2so4 50, naoh 50, cacl2 3, na2co3 50', 'CaCO3', 'Carbonato sobre CaSO4: el paso se corta cuando aún faltan 4,9 mmol de CaSO4 por pasar a CaCO3; el primer «water 1» los convierte de golpe (agota el carbonato) y los otros dos ya están convergidos.');
  drift('mg-oh-2-fe-oh-3', 'hcl 20, mg 0.25, naoh 20, fecl3 50', 'Fe(OH)3', 'Fe³⁺ sobre Mg(OH)2: el hidróxido de magnesio cede OH⁻ y el Fe(OH)3 crece ~0,1 mmol en cada «water 1».');
  drift('cuco3-hierro', 'cuso4 10, na2co3 10, fe 1', 'Cu', 'Hierro sobre CuCO3: el carbonato se disuelve y el cobre metálico crece ~2 µmol en cada «water 1».');
  drift('agi-hierro-iii', 'agno3 20, ki 4, fecl3 20', 'AgCl', 'Fe³⁺ oxida el yoduro que suelta el AgI (iron-iodide por debajo de 1 µmol, sin evento ni heatUnknown) y la plata reaparece como AgCl: ~6e-8 mol por paso.',
    [unknown(false), state('I2 > 0', t => mol(t, 'I2') > 0)]);
  // Aquí la deriva hace visible la redisolución por Ksp de sólidos que al diluir no dan evento.
  drift('pbco3-cinc', 'pbno3 50, na2co3 10, water 200, water 190, zn 1', 'Pb', 'Cinc sobre PbCO3 en 450 mL: única vía por la que ksp-PbCO3 da evento de redisolución (~1,8 µmol); el plomo metálico sigue creciendo en cada «water 1».', dil('PbCO3', -1));
  drift('pb-oh-2-hierro-iii', 'pbno3 50, naoh 10, water 200, water 185, fecl3 50', 'Fe(OH)3', 'Fe³⁺ sobre Pb(OH)2 en 495 mL: ksp-Pb(OH)2 da evento de redisolución (~2 µmol) y el Fe(OH)3 sigue creciendo en cada paso.', dil('Pb(OH)2', -1));
  drift('cu-oh-2-hierro-iii', 'cuso4 10, naoh 10, water 200, water 180, fecl3 50', 'Fe(OH)3', 'Fe³⁺ sobre Cu(OH)2 en 450 mL: ksp-Cu(OH)2 da evento de redisolución (~2 µmol) y el Fe(OH)3 sigue creciendo en cada paso.', dil('Cu(OH)2', -1));
  drift('zn-oh-2-hierro-iii', 'hcl 20, zn 0.6, naoh 20, water 200, water 200, fecl3 50', 'Fe(OH)3', 'Fe³⁺ sobre Zn(OH)2 en 490 mL: ksp-Zn(OH)2 da evento de redisolución (~30 µmol) y el Fe(OH)3 sigue creciendo en cada paso.', dil('Zn(OH)2', -1));

  // ── calor ──
  const calor = (name: string, text: string, why: string, fire: string[] = [], checks: Check[] = [], notFire: string[] = []) => add(`calor/${name}`, text, why, fire, checks, notFire);
  const warmer = (k = -1): Check => ({ d: `la temperatura sube en el paso ${k}`, ok: s => delta(s, k, t => t?.temperatureC ?? 25) > 0 });
  const cooler = (k = -1): Check => ({ d: `la temperatura baja en el paso ${k}`, ok: s => delta(s, k, t => t?.temperatureC ?? 25) < 0 });
  // Neutralizaciones fuertes y débiles.
  calor('neutral-fuerte', 'hcl 50, naoh 50', 'Neutralización fuerte 1:1 con 50 mL de cada uno: ΔT ≈ 6,6 °C contando el agua formada.', ['neutral-strong'], [warmer()]);
  calor('neutral-fuerte-minima', 'hcl 1, naoh 1', 'La misma neutralización con 1 mL de cada uno: igual ΔT (no depende de la escala).', ['neutral-strong'], [warmer()]);
  calor('neutral-fuerte-maxima', 'hcl 200, naoh 200', 'La misma neutralización con 200 mL de cada uno, cerca del límite del matraz.', ['neutral-strong'], [warmer()]);
  calor('neutral-fuerte-desigual', 'hcl 10, naoh 190, hcl 100', 'Ácido limitante sobre mucha base (ΔT pequeña) y después más ácido sobre la mezcla ya templada.', ['neutral-strong'], [warmer(1), warmer(2)]);
  calor('neutral-sulfurico', 'h2so4 100, naoh 150', 'Ácido diprótico con base en exceso: reaccionan 0,1 mol de H⁺ y el sulfato es espectador.', ['neutral-strong'], [warmer()]);
  calor('neutral-acetico', 'acetic 50, naoh 50', 'Ácido débil con base fuerte en exceso (neutral-acetic, ΔH ≈ −57,5 kJ/mol).', ['neutral-acetic'], [warmer()], ['neutral-strong']);
  calor('neutral-acetico-base-limitante', 'acetic 150, naoh 20', 'Mucho ácido acético y poca base: tampón acético con ΔT pequeña.', ['neutral-acetic'], [warmer()]);
  calor('amonio-amoniaco', 'water 50, nh4no3 5, naoh 50, hcl 100', 'Disolución endotérmica, neutral-ammonium casi atérmica (−4,2 kJ/mol) y después ammonia-strong y neutral-strong exotérmicas.',
    ['ksp-NH4NO3(s)', 'neutral-ammonium', 'ammonia-strong'], [cooler(1), warmer(3)]);
  calor('carbonato-acido', 'na2co3 50, hcl 25, hcl 50', 'Carbonato + ácido en dos etapas: carbonate-strong es exotérmica y co2-strong endotérmica, así que el segundo vertido enfría.', ['carbonate-strong', 'co2-strong'], [warmer(1), cooler(2)]);
  calor('bicarbonato-solido-acetico', 'acetic 100, nahco3 5', 'Vinagre y bicarbonato sólido: reacción endotérmica (+29,7 kJ/mol) que enfría la mezcla.', ['bicarbonate-solid-acetic'], [cooler()]);
  calor('neutral-bicarbonato', 'water 100, nahco3 5, naoh 50', 'El bicarbonato disuelto (enfría) reacciona con NaOH (neutral-bicarbonate, exotérmica).', ['ksp-NaHCO3(s)', 'neutral-bicarbonate'], [cooler(1)]);
  // CaCl2 (exotérmica) y NH4NO3 (endotérmica) en poca y mucha agua.
  calor('cacl2-poca-agua', 'water 30, cacl2 10', 'CaCl2 10 g en 30 mL: ΔT ≈ +59 °C sin llegar al tope.', ['ksp-CaCl2(s)'], [state('80 < T < 100', t => t.temperatureC > 80 && t.temperatureC < 100)]);
  calor('cacl2-mucha-agua', 'water 200, water 200, cacl2 10', 'CaCl2 10 g en 400 mL: ΔT ≈ +4,4 °C.', ['ksp-CaCl2(s)'], [warmer()]);
  calor('cacl2-minimo', 'water 200, cacl2 0.05', 'CaCl2 mínimo (0,05 g) en 200 mL: ΔT de centésimas de grado.', ['ksp-CaCl2(s)'], [warmer()]);
  calor('nh4no3-poca-agua', 'water 30, nh4no3 10', 'NH4NO3 10 g en 30 mL se disuelve entero y el modelo deja la mezcla líquida bajo cero (≈ −3 °C).', ['ksp-NH4NO3(s)'], [gone('NH4NO3(s)'), state('T < 0', t => t.temperatureC < 0)]);
  calor('nh4no3-mucha-agua', 'water 200, water 200, nh4no3 10', 'NH4NO3 10 g en 400 mL: ΔT ≈ −2,1 °C.', ['ksp-NH4NO3(s)'], [cooler()]);
  calor('nh4no3-minimo', 'water 200, nh4no3 0.05', 'NH4NO3 mínimo (0,05 g) en 200 mL: ΔT de centésimas de grado.', ['ksp-NH4NO3(s)'], [cooler()]);
  calor('bajo-cero-saturado', 'nh4no3 10, water 1, water 1, water 20, water 200', 'NH4NO3 saturado: sin suelo de temperatura, cada mL que se satura queda a −135,9 °C; al disolverse todo y diluir vuelve hacia 25 °C.',
    ['ksp-NH4NO3(s)'], [state('T < −130 °C', t => t.temperatureC < -130, 1), state('T < −130 °C', t => t.temperatureC < -130, 2), gone('NH4NO3(s)', 3), state('T < 0', t => t.temperatureC < 0, 3), state('T > 0', t => t.temperatureC > 0)]);
  // Mezcla térmica: lo que se añade entra a 25 °C; un sólido no aporta masa térmica.
  calor('mezcla-caliente-agua', 'water 50, cacl2 10, water 50, water 200', 'Agua a 25 °C sobre una mezcla a 60 °C: media ponderada por volumen de agua, sin calor de reacción.', ['ksp-CaCl2(s)'], [cooler(2), cooler(3)]);
  calor('mezcla-caliente-gotas', 'water 50, cacl2 10, universal 10, starch 1', 'Gotas de indicador (0,05 mL cada una) a 25 °C sobre la mezcla caliente: también entran en la media.', ['ksp-CaCl2(s)'], [cooler(2), cooler(3)]);
  calor('mezcla-fria-disolucion', 'water 50, nh4no3 10, nacl 50, water 100', 'Disolución y agua a 25 °C sobre una mezcla a 8 °C: la temperatura sube hacia 25 °C.', ['ksp-NH4NO3(s)'], [warmer(2), warmer(3)]);
  calor('caliente-luego-frio', 'water 50, cacl2 10, cu 1, nh4no3 10', 'Sobre la mezcla caliente, un sólido inerte no cambia la temperatura (ΔT = 0) y el NH4NO3 la enfría al disolverse.',
    ['ksp-CaCl2(s)', 'ksp-NH4NO3(s)'], [{ d: 'el cobre no cambia la temperatura', ok: s => s[2].temperatureC === s[1].temperatureC }, cooler()]);
  calor('reaccion-sobre-caliente', 'mg 0.5, hcl 50, naoh 50', 'Metal sobre matraz seco (sin reacción, 25 °C), HCl que lo disuelve (≈ 71 °C) y NaOH a 25 °C: mezcla térmica más neutralización y precipitación de Mg(OH)2.',
    ['metal-Mg-H+', 'neutral-strong', 'ksp-Mg(OH)2'], [temp(25, 0), state('T > 70', t => t.temperatureC > 70, 1), cooler()]);
  calor('seco-dos-solidos', 'cacl2 5, nh4no3 5, water 100', 'Dos sólidos sobre matraz seco: sin agua no hay reacción y la temperatura sigue en 25 °C; el agua disuelve los dos y sus calores se suman.',
    ['ksp-CaCl2(s)', 'ksp-NH4NO3(s)'], [temp(25, 0), temp(25, 1), state('sin eventos', t => !Object.keys(t.fired).length, 1), warmer()]);
  // Tope de 100 °C: deltaT se devuelve sin recortar y la temperatura se queda en 100.
  calor('tope-100-gota', 'universal 1, cacl2 10, water 1, water 1, water 10, water 100', 'Una gota y 10 g de CaCl2: deltaT ≈ +131 °C sin recortar con la temperatura en 100; sigue en 100 mientras queda sólido y solo baja con 100 mL.',
    ['ksp-CaCl2(s)'], [temp(100, 1), temp(100, 2), temp(100, 3), temp(100, 4), left('CaCl2(s)', 4), state('T < 100', t => t.temperatureC < 100)]);
  calor('tope-100-reaccion', 'hcl 50, mg 2, cacl2 10, nh4no3 10, water 50', 'Mg + HCl deja la mezcla a 81 °C y el CaCl2 la lleva al tope (deltaT ≈ +35 °C); el enfriamiento posterior parte de 100, no de 116: el recorte pierde energía.',
    ['metal-Mg-H+', 'ksp-CaCl2(s)', 'ksp-NH4NO3(s)'], [state('80 < T < 81', t => t.temperatureC > 80 && t.temperatureC < 81, 1), temp(100, 2), cooler(3), cooler(4)]);
  calor('tope-100-dos-veces', 'water 20, cacl2 10, cacl2 10, water 20', 'El tope se alcanza dos veces seguidas (la segunda con sólido sin disolver) y el agua posterior mezcla desde 100 °C y disuelve el resto.',
    ['ksp-CaCl2(s)'], [temp(100, 1), temp(100, 2), left('CaCl2(s)', 2), gone('CaCl2(s)'), state('T < 100', t => t.temperatureC < 100)]);
  // Las 7 reglas sin ΔH tabulado: activan heatUnknown (si el evento es visible) y se queda activado.
  calor('sin-dh/cuco3-acido-fuerte', 'cuso4 10, na2co3 10, water 50, hcl 20, naoh 5', 'ksp-CuCO3 activa heatUnknown sin mover la temperatura; sigue activado al diluir, al disolver el CuCO3 con HCl (acid-CuCO3-H+) y en la neutralización posterior, que sí calienta.',
    ['ksp-CuCO3', 'acid-CuCO3-H+', 'neutral-strong'], [unknown(false, 0), unknown(true, 1), temp(25, 1), temp(25, 2), unknown(true), warmer()]);
  calor('sin-dh/cuco3-acetico', 'cuso4 4, na2co3 4, acetic 20, naoh 5', 'El CuCO3 se disuelve con ácido acético (acid-CuCO3-HAc, sin ΔH) y heatUnknown sigue activado en la neutralización posterior.',
    ['ksp-CuCO3', 'acid-CuCO3-HAc', 'neutral-acetic'], [unknown(true, 1), gone('CuCO3', 2), unknown(true), warmer()]);
  calor('sin-dh/acid-cuco3-h-primera', 'pbno3 20, na2co3 4, cuso4 2, water 1, water 1, water 1, hcl 10, naoh 5', 'El CuCO3 se acumula sin evento (< 1 µmol por paso, a costa del PbCO3) hasta ~1,9 µmol; al disolverlo, acid-CuCO3-H+ es la primera regla que activa heatUnknown.',
    ['acid-CuCO3-H+'], [unknown(false, 5), state('CuCO3 > 1 µmol', t => mol(t, 'CuCO3') > VISIBLE, 5), ev('acid-CuCO3-H+', 6), unknown(true, 6), unknown(true)], ['ksp-CuCO3']);
  calor('sin-dh/acid-cuco3-hac-primera', 'pbno3 20, na2co3 4, hcl 1, cuso4 3, water 2, water 2, acetic 10, naoh 2', 'Igual con ácido acético: el CuCO3 acumulado sin evento (~1,5 µmol) hace que acid-CuCO3-HAc sea la primera regla que activa heatUnknown (el HCl previo gasta parte del carbonato para que el acetato no empate con Na⁺ y NO₃⁻).',
    ['acid-CuCO3-HAc'], [unknown(false, 5), state('CuCO3 > 1 µmol', t => mol(t, 'CuCO3') > VISIBLE, 5), ev('acid-CuCO3-HAc', 6), unknown(true, 6), unknown(true)], ['ksp-CuCO3']);
  calor('sin-dh/permanganato-yoduro', 'kmno4 50, h2so4 20, ki 20, naoh 10', 'permanganate-iodide (yodo sin ΔHf) activa heatUnknown; la neutralización posterior calienta con el aviso aún activado.',
    ['permanganate-iodide', 'neutral-strong'], [unknown(false, 1), unknown(true, 2), unknown(true), warmer()]);
  calor('sin-dh/peroxido-yoduro', 'h2o2 10, hcl 20, ki 20, naoh 5', 'peroxide-iodide gasta todo el yoduro (no queda catalizador para descomponer el peróxido) y activa heatUnknown.',
    ['peroxide-iodide', 'neutral-strong'], [unknown(false, 1), unknown(true, 2), unknown(true)], ['peroxide-decomposition']);
  calor('sin-dh/hierro-yoduro', 'fecl3 50, ki 20, water 50, nh4no3 1', 'iron-iodide activa heatUnknown; sigue activado al diluir y al disolver NH4NO3, cuyo calor sí se conoce.',
    ['iron-iodide', 'ksp-NH4NO3(s)'], [unknown(true, 1), temp(25, 1), unknown(true), cooler()]);
  calor('sin-dh/cobre-yoduro', 'cuso4 10, ki 40, water 50, nh4no3 1', 'copper-iodide (CuI y yodo sin ΔHf) activa heatUnknown; sigue activado al diluir y al disolver NH4NO3.',
    ['copper-iodide', 'ksp-NH4NO3(s)'], [unknown(true, 1), temp(25, 1), unknown(true), cooler()]);
  calor('sin-dh/invisible', 'agno3 20, ki 4, cuso4 10, water 50', 'copper-iodide por debajo de 1 µmol (solo dispone del yoduro que suelta el AgI): deja CuI e I2 en la mezcla, pero ni da evento ni activa heatUnknown.',
    ['ksp-AgI'], [state('hay CuI', t => mol(t, 'CuI') > 0 && mol(t, 'CuI') < VISIBLE), state('hay I2', t => mol(t, 'I2') > 0), unknown(false)], ['copper-iodide']);
  return cases;
};
export default family;
