import { addReagent, analyzeMixture, emptyMixture, gasLitres, indicatorColor, rules, solutionColor, solvePH, VESSEL_ML, type Mixture, type SandboxEvent } from '../../src/chemistry/sandbox';
import { species, speciesIds, type SpeciesId } from '../../src/chemistry/species';
import { DROP_ML, reagents, type IndicatorId, type ReagentId } from '../../src/chemistry/reagents';
import { molarMass } from '../../src/chemistry/formula';
import { calculateReaction } from '../../src/chemistry/reaction';
import { conductivity, crystallization, type Solution } from '../../src/chemistry/solutions';
import type { CaseSpec, ErrorCode, MixtureInput, Num, StepSpec, Trace } from './types';

/** Ejecuta las especificaciones con el motor real y devuelve casos serializables. No contiene química propia. */

const GASES = ['CO2', 'H2', 'O2'] as const;
const CATALYSTS = [...new Set(rules.flatMap(rule => rule.type === 'complete' ? rule.catalysts ?? [] : []))];
const NON_FINITE = ['NaN', 'Infinity', '-Infinity'];
const num = (v: Num, where: string): number => {
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error(`${where}: escribe los no finitos como texto ('NaN', 'Infinity', '-Infinity').`); return v; }
  if (!NON_FINITE.includes(v)) throw new Error(`${where}: número no válido «${v}».`);
  return Number(v);
};

export function errorCode(message: string): ErrorCode | 'UNEXPECTED' {
  if (message === 'Reactivo desconocido.') return 'UNKNOWN_REAGENT';
  if (message.startsWith('El matraz se desbordaría')) return 'OVERFLOW';
  if (message.startsWith('Usa ')) return 'RANGE';
  if (message.startsWith('Elemento desconocido')) return 'UNKNOWN_ELEMENT';
  if (message.startsWith('Fórmula no válida')) return 'BAD_FORMULA';
  return 'UNEXPECTED';
}
type Failure = { error: { code: ErrorCode; message: string } };
/** Ejecuta `fn`; un error del modelo se registra, uno inesperado (TypeError…) invalida el caso. */
function attempt<T>(where: string, fn: () => T): { out: T } | Failure {
  try { return { out: fn() }; } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const code = errorCode(message);
    if (code === 'UNEXPECTED') throw new Error(`${where}: error no portable «${message}». El caso depende de JavaScript, no del modelo.`);
    return { error: { code, message } };
  }
}

/** Moles por especie en el orden de `speciesIds`: el orden de inserción de JS no forma parte del modelo. */
export function canonMixture(m: Mixture) {
  return {
    n: speciesIds.filter(id => m.n[id] !== undefined).map(id => [id, m.n[id]!] as [string, number]),
    waterMl: m.waterMl, temperatureC: m.temperatureC, indicators: [...m.indicators],
    released: GASES.filter(g => m.released[g] !== undefined).map(g => [g, m.released[g]!] as [string, number]),
    heatUnknown: m.heatUnknown,
  };
}
export function canonAnalysis(m: Mixture) {
  const a = analyzeMixture(m);
  return {
    pH: a.pH, color: a.color.color, opacity: a.color.opacity, volumeMl: a.volumeMl, temperatureC: a.temperatureC, ammoniaSmell: a.ammoniaSmell,
    solids: a.solids.map(s => ({ id: s.id, mol: s.mol, grams: s.grams })),
    dissolved: a.dissolved.map(d => ({ id: d.id, molarity: d.molarity })),
    gases: a.gases.map(g => ({ id: g.id, mol: g.mol, litres: g.litres })),
  };
}
export const canonEvent = (e: SandboxEvent) => ({ rule: e.rule, kind: e.kind, extent: e.extent, deltaH: e.deltaH, heat: e.heat, ...(e.gas ? { gas: e.gas } : {}), ...(e.solid ? { solid: e.solid } : {}) });

/** Textos de evento observados, por regla y sentido. Se guardan una sola vez en `tables.eventTexts`. */
export type EventTexts = Map<string, { rule: string; kind: string; title: string; note: string; equation: string; vigor: number; deltaH: number | null }>;
export function recordTexts(texts: EventTexts, e: SandboxEvent) {
  const key = `${e.rule}|${e.kind}`;
  const entry = { rule: e.rule, kind: e.kind, title: e.title, note: e.note, equation: e.equation, vigor: e.vigor, deltaH: e.deltaH };
  const seen = texts.get(key);
  if (!seen) texts.set(key, entry);
  else if (JSON.stringify(seen) !== JSON.stringify(entry)) throw new Error(`Los textos del evento ${key} no son constantes: no se pueden tabular.`);
}

const near = (value: number, threshold: number, rel = 1e-6) => Math.abs(value - threshold) <= rel * threshold;
/**
 * Marcas de fragilidad: resultados discretos que una diferencia de último bit entre implementaciones
 * podría cambiar aunque los números pasen la tolerancia. El comparador puede relajar esas comprobaciones.
 */
export function stepFlags(m: Mixture, events: SandboxEvent[], reagentId: string) {
  const flags: string[] = [];
  const V = m.waterMl / 1000;
  if (events.some(e => near(e.extent, 1e-6))) flags.push('umbral-evento');
  if (speciesIds.some(id => species[id].phase === 's' && near(m.n[id] ?? 0, 1e-7))) flags.push('umbral-solido');
  if (V > 0 && speciesIds.some(id => species[id].phase === 'aq' && near((m.n[id] ?? 0) / V, 1e-5))) flags.push('umbral-disuelto');
  if (V > 0 && near((m.n.NH3 ?? 0) / V, 0.01)) flags.push('umbral-amoniaco');
  if (V > 0 && near((m.n.I2 ?? 0) / V, 2e-6)) flags.push('umbral-almidon');
  if (CATALYSTS.some(id => near(m.n[id] ?? 0, 1e-9))) flags.push('umbral-catalizador');
  if (GASES.some(g => near(m.released[g] ?? 0, 1e-7))) flags.push('umbral-gas');
  const a = analyzeMixture(m);
  const almostTied = (values: number[]) => values.some((v, i) => i > 0 && v !== values[i - 1] && Math.abs(v - values[i - 1]) <= 1e-9 * Math.abs(v));
  if (almostTied(a.solids.map(s => s.grams))) flags.push('orden-solidos');
  if (almostTied(a.dissolved.map(d => d.molarity))) flags.push('orden-disueltos');
  const r = reagents[reagentId as ReagentId];
  if (r?.kind === 'indicator' && reagentId !== 'starch' && !events.length && V > 0) {
    const tenths = (a.pH ?? 7) * 10;
    if (Math.abs(tenths - Math.floor(tenths) - 0.5) < 1e-6) flags.push('nota-redondeo-ph');
  }
  return flags;
}

function checkReagentId(id: string, where: string) {
  if (!Object.hasOwn(reagents, id) && id in reagents) throw new Error(`${where}: «${id}» es una clave heredada de Object; el resultado depende de JavaScript y no es portable.`);
}

function runSteps(steps: StepSpec[], where: string, texts?: EventTexts) {
  let mix = emptyMixture();
  const fired: Record<string, number> = {};
  const records = steps.map((step, i) => {
    checkReagentId(step.reagent, `${where} paso ${i + 1}`);
    const amount = num(step.amount, `${where} paso ${i + 1}`);
    const before = mix;
    const result = attempt(`${where} paso ${i + 1}`, () => addReagent(before, step.reagent as ReagentId, amount));
    // El control de desborde suma en coma flotante: a un último bit de 500 mL, otro orden de operaciones decide distinto.
    const reagent = Object.hasOwn(reagents, step.reagent) ? reagents[step.reagent as ReagentId] : null;
    const total = before.waterMl + (!reagent || reagent.kind === 'solid' ? 0 : reagent.kind === 'indicator' ? amount * DROP_ML : amount);
    const brim = total !== VESSEL_ML && Math.abs(total - VESSEL_ML) < 1e-9 ? ['desborde-suma'] : [];
    if ('error' in result) {
      const flags = [...brim, ...(result.error.code === 'OVERFLOW' && Math.abs(before.waterMl - Math.floor(before.waterMl) - 0.5) < 1e-6 ? ['error-redondeo-ml'] : [])];
      return { in: step, error: result.error, ...(flags.length ? { flags } : {}) };
    }
    const o = result.out;
    mix = o.mixture;
    for (const e of o.events) { fired[e.rule] = (fired[e.rule] ?? 0) + e.extent; if (texts) recordTexts(texts, e); }
    const flags = [...brim, ...stepFlags(mix, o.events, step.reagent)];
    return { in: step, out: { events: o.events.map(canonEvent), note: o.note, deltaT: o.deltaT, heatKJ: o.heatKJ, mixture: canonMixture(mix), analysis: canonAnalysis(mix) }, ...(flags.length ? { flags } : {}) };
  });
  return { records, mix, fired };
}

function resolveMixture(input: MixtureInput, where: string): Mixture {
  if ('steps' in input) return runSteps(input.steps, where).mix;
  const n: Mixture['n'] = {};
  for (const [id, mol] of Object.entries(input.n ?? {})) {
    if (!Object.hasOwn(species, id)) throw new Error(`${where}: especie desconocida «${id}».`);
    if (!(mol > 0) || !Number.isFinite(mol)) throw new Error(`${where}: los moles de ${id} deben ser positivos y finitos.`);
    n[id as SpeciesId] = mol;
  }
  for (const g of Object.keys(input.released ?? {})) if (!GASES.includes(g as typeof GASES[number])) throw new Error(`${where}: gas desconocido «${g}».`);
  return { n, waterMl: input.waterMl, temperatureC: input.temperatureC ?? 25, indicators: (input.indicators ?? []) as IndicatorId[], additions: [], released: { ...(input.released ?? {}) }, heatUnknown: input.heatUnknown ?? false };
}

export function trace(steps: StepSpec[]): Trace {
  let mix = emptyMixture();
  const fired: Record<string, number> = {};
  const errors = steps.map(step => {
    try {
      const o = addReagent(mix, step.reagent as ReagentId, typeof step.amount === 'string' ? Number(step.amount) : step.amount);
      mix = o.mixture;
      for (const e of o.events) fired[e.rule] = (fired[e.rule] ?? 0) + e.extent;
      return null;
    } catch (e) { return errorCode(e instanceof Error ? e.message : String(e)); }
  });
  return { fired, errors, pH: solvePH(mix), waterMl: mix.waterMl, temperatureC: mix.temperatureC, heatUnknown: mix.heatUnknown, n: { ...mix.n }, released: { ...mix.released } };
}

export interface RunResult { record: Record<string, unknown>; fired: string[]; steps: number }

export function runCase(spec: CaseSpec, texts: EventTexts): RunResult {
  const where = spec.id;
  const family = spec.id.split('/')[0];
  const head = { id: spec.id, family, fn: spec.fn, why: spec.why };
  const expectError = (got: ErrorCode | null) => {
    if ((spec.mustError ?? null) !== got) throw new Error(`${where}: se esperaba ${spec.mustError ?? 'sin error'} y el motor dio ${got ?? 'un resultado'}.`);
  };
  const call = <T>(input: Record<string, unknown>, fn: () => T): RunResult => {
    const result = attempt(where, fn);
    expectError('error' in result ? result.error.code : null);
    return { record: { ...head, in: input, ...result }, fired: [], steps: 0 };
  };

  switch (spec.fn) {
    case 'sequence': {
      if (!spec.steps.length) throw new Error(`${where}: la secuencia no tiene pasos.`);
      const { records, fired } = runSteps(spec.steps, where, texts);
      const last = records[records.length - 1];
      expectError('error' in last ? last.error!.code : null);
      for (const rule of spec.mustFire ?? []) if (!(rule in fired)) throw new Error(`${where}: la regla ${rule} debía dar un evento visible y no lo dio. Dispararon: ${Object.keys(fired).join(', ') || 'ninguna'}.`);
      for (const rule of spec.mustNotFire ?? []) if (rule in fired) throw new Error(`${where}: la regla ${rule} no debía dispararse.`);
      return { record: { ...head, steps: records }, fired: Object.keys(fired), steps: records.length };
    }
    case 'solvePH': {
      const mix = resolveMixture(spec.mixture, where);
      return call({ mixture: canonMixture(mix) }, () => solvePH(mix));
    }
    case 'solutionColor': {
      const mix = resolveMixture(spec.mixture, where);
      const pH = spec.pH === 'solve' ? solvePH(mix) : spec.pH;
      return call({ mixture: canonMixture(mix), pH }, () => solutionColor(mix, pH));
    }
    case 'indicatorColor': {
      const pH = num(spec.pH, where);
      return call({ indicator: spec.indicator, pH: spec.pH }, () => indicatorColor(spec.indicator as IndicatorId, pH));
    }
    case 'molarMass': return call({ formula: spec.formula }, () => molarMass(spec.formula));
    case 'gasLitres': { const mol = num(spec.mol, where); return call({ mol: spec.mol }, () => gasLitres(mol)); }
    case 'calculateReaction': {
      const i = spec.input;
      const input = { vinegarMl: num(i.vinegarMl, where), concentration: num(i.concentration, where), bicarbonateG: num(i.bicarbonateG, where) };
      return call({ ...i }, () => calculateReaction(input));
    }
    case 'conductivity': {
      const concentration = num(spec.input.concentration, where);
      return call({ ...spec.input }, () => conductivity({ solution: spec.input.solution as Solution, concentration }));
    }
    case 'crystallization': {
      const i = spec.input;
      const input = { waterG: num(i.waterG, where), saltG: num(i.saltG, where), evaporationPercent: num(i.evaporationPercent, where) };
      return call({ ...i }, () => crystallization(input));
    }
    default: throw new Error(`${where}: función desconocida «${(spec as { fn: string }).fn}».`);
  }
}
