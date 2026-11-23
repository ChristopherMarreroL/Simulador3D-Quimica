import { CYLINDER_ML, CYLINDER_RATE, HOOD_TRAY_SLOTS, POUR_MS, spatulaRate, STREAM } from '../../../src/state/hood';
import { rules, VESSEL_ML } from '../../../src/chemistry/sandbox';
import { reagentIds } from '../../../src/chemistry/reagents';
import { hoodRecipes } from '../../../src/experiments/hoodRecipes';
import { SEED } from '../../lib/build';
import { hash32, mulberry32 } from '../../lib/prng';
import { runCases, type Tables } from './harness';
import { families as allFamilies } from '../families/index';
import type { OpName, StepCaseSpec, StepFamilyContext } from './types';

export const SCHEMA_VERSION = 1;
const STEP_ORDER = (key: string) => key === 'ppe' ? 0 : key === 'clean' ? 1 : key === 'collect' ? 2 : key.startsWith('add-') ? 3 + Number(key.slice(4)) : key === 'observe' ? 100 : key === 'save' ? 101 : 102;

function assertFinite(value: unknown, path: string): void {
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error(`Salida no finita en ${path}: JSON la perdería.`); return; }
  if (Array.isArray(value)) { value.forEach((v, i) => assertFinite(v, `${path}[${i}]`)); return; }
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) assertFinite(v, `${path}.${k}`);
}

/**
 * Ejecuta las familias de `golden/steps/families/index.ts` en su orden contra los almacenes reales y devuelve
 * el documento completo. `only` limita la ejecución a una familia.
 */
export function buildSteps(only?: string) {
  const selected = allFamilies.filter(([name]) => only ? name === only : !name.startsWith('_'));
  if (only && !selected.length) throw new Error(`No existe la familia ${only}. Disponibles: ${allFamilies.map(([name]) => name).join(', ')}`);
  const specs: StepCaseSpec[] = [];
  const ids = new Set<string>();
  for (const [name, family] of selected) {
    const rng = mulberry32((SEED ^ hash32(`steps/${name}`)) >>> 0);
    const ctx: StepFamilyContext = { rng, int: (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)), pick: items => items[Math.floor(rng() * items.length)] };
    const list = family(ctx);
    if (!Array.isArray(list)) throw new Error(`${name}: la exportación por defecto debe devolver una lista de casos.`);
    for (const spec of list) {
      if (!/^[a-z0-9-]+\/[^\s]+$/.test(spec.id)) throw new Error(`${name}: id no válido «${spec.id}» (usa familia/nombre, sin espacios).`);
      if (ids.has(spec.id)) throw new Error(`${name}: id repetido «${spec.id}».`);
      if (!spec.why?.trim()) throw new Error(`${spec.id}: falta «why».`);
      ids.add(spec.id);
      specs.push(spec);
    }
  }
  const collected: Tables = { eventTexts: new Map(), stepTexts: new Map() };
  const { initial, results } = runCases(specs, collected);
  const cases = results.map(r => r.record);
  const families: Record<string, number> = {};
  const opsUsed: Partial<Record<OpName, number>> = {};
  const errors = new Set<string>(), messages = new Set<string>();
  const flags: Record<string, number> = {};
  let ops = 0;
  for (const r of results) {
    families[r.record.family] = (families[r.record.family] ?? 0) + 1;
    ops += r.ops;
    for (const op of r.record.ops) {
      opsUsed[op.op] = (opsUsed[op.op] ?? 0) + 1;
      for (const flag of op.flags ?? []) flags[flag] = (flags[flag] ?? 0) + 1;
    }
    r.errors.forEach(e => errors.add(e)); r.messages.forEach(m => messages.add(m));
  }
  const order = new Map(rules.map((rule, index) => [rule.id, index]));
  const tables = {
    /** Constantes que hood.ts exporta. Los literales que no exporta (900 ms de enjuague, 300 ms de inclinación, 40 entradas…) están en golden/README.md. */
    constants: {
      HOOD_TRAY_SLOTS, POUR_MS, CYLINDER_ML, CYLINDER_RATE, VESSEL_ML, STREAM,
      spatulaRate: [0, 0.3, 1, 2, 2.5, 3].map(s => [s, spatulaRate(s)] as [number, number]),
    },
    /** Orden del estante: es el de `places`, el de `recipe.added` y la prioridad de `heldIn`. */
    reagentIds,
    /** Título y detalle de cada paso por práctica; los casos solo llevan la clave, si está hecho y los objetivos. */
    stepTexts: hoodRecipes.filter(r => collected.stepTexts.has(r.id)).map(r => ({ recipe: r.id, steps: [...collected.stepTexts.get(r.id)!.values()].sort((a, b) => STEP_ORDER(a.key) - STEP_ORDER(b.key)) })),
    /** Textos de los eventos que aparecen en algún registro, por regla y sentido (igual que en chemistry.json). */
    eventTexts: [...collected.eventTexts.values()].sort((a, b) => order.get(a.rule)! - order.get(b.rule)! || a.kind.localeCompare(b.kind)),
  };
  assertFinite({ initial, tables, cases }, 'steps');
  const stats = { cases: cases.length, ops, families, opsUsed, flags, hoodErrors: [...errors].sort(), labMessages: [...messages].sort() };
  const doc = {
    schemaVersion: SCHEMA_VERSION,
    generator: { script: 'golden/steps/export.steps.ts', node: process.versions.node, v8: process.versions.v8, icu: process.versions.icu },
    seed: SEED, prng: 'mulberry32', stats, tables, initial, cases,
  };
  return { doc, stats };
}
export type StepsDoc = ReturnType<typeof buildSteps>['doc'];

/** Texto estable con LF: una línea por operación y por fila de tabla, para que los cambios se lean en un diff. */
export function serialize(doc: StepsDoc) {
  const rows = (items: unknown[]) => `[\n${items.map(item => JSON.stringify(item)).join(',\n')}\n]`;
  const { tables, cases, ...head } = doc;
  const top = Object.entries(head).map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`).join(',\n');
  const tableText = Object.entries(tables).map(([key, value]) => `${JSON.stringify(key)}:${Array.isArray(value) && key !== 'reagentIds' ? rows(value) : JSON.stringify(value)}`).join(',\n');
  const caseText = cases.map(({ ops, ...rest }) => `${JSON.stringify(rest).slice(0, -1)},"ops":${rows(ops)}}`).join(',\n');
  return `{\n${top},\n"tables":{\n${tableText}\n},\n"cases":[\n${caseText}\n]\n}\n`;
}

/** La parte del documento que depende solo de las reglas de juego (sin versiones de Node ni estadísticas). */
export const comparable = (doc: { schemaVersion: unknown; seed: unknown; tables: unknown; initial: unknown; cases: unknown }) => ({ schemaVersion: doc.schemaVersion, seed: doc.seed, tables: doc.tables, initial: doc.initial, cases: doc.cases });
