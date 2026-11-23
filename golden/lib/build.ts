import { rules } from '../../src/chemistry/sandbox';
import { runCase, trace, type EventTexts } from './harness';
import { hash32, mulberry32 } from './prng';
import { buildTables } from './tables';
import { families as allFamilies } from '../families/index';
import type { FamilyContext } from './types';

export const SEED = 20261111;
export const SCHEMA_VERSION = 1;


/** Regla de comparación propuesta para el porte: |a − b| ≤ rel · max(|a|, |b|) + abs de la clase del campo. */
const compare = {
  rel: 1e-6,
  classes: {
    mol: { abs: 1e-12 }, conc: { abs: 1e-12 }, grams: { abs: 1e-9 }, ml: { abs: 1e-9 }, temp: { abs: 1e-9 },
    kJ: { abs: 1e-9 }, unit: { abs: 1e-9 }, pH: { rel: 0, abs: 1e-6 }, color: { channelAbs: 1 },
  },
  exact: 'cadenas, enumeraciones, booleanos, null frente a número, presencia de gas/solid, número y orden de eventos, e ids y orden de listas',
};

function assertFinite(value: unknown, path: string): void {
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error(`Salida no finita en ${path}: JSON la perdería.`); return; }
  if (Array.isArray(value)) { value.forEach((v, i) => assertFinite(v, `${path}[${i}]`)); return; }
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) assertFinite(v, `${path}.${k}`);
}

/**
 * Ejecuta las familias de `golden/families/index.ts` en su orden y devuelve el documento completo.
 * `only` limita la ejecución a una familia; las que empiezan por `_` solo se ejecutan si se piden por nombre.
 */
export async function buildGolden(only?: string) {
  const selected = allFamilies.filter(([name]) => only ? name === only : !name.startsWith('_'));
  if (only && !selected.length) throw new Error(`No existe la familia ${only}. Disponibles: ${allFamilies.map(([name]) => name).join(', ')}`);
  const texts: EventTexts = new Map();
  const cases: Record<string, unknown>[] = [];
  const ids = new Set<string>();
  const fired = new Set<string>();
  const families: Record<string, number> = {};
  let steps = 0;
  for (const [name, family] of selected) {
    const rng = mulberry32((SEED ^ hash32(name)) >>> 0);
    const ctx: FamilyContext = {
      rng, trace,
      int: (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)),
      pick: items => items[Math.floor(rng() * items.length)],
    };
    const specs = family(ctx);
    if (!Array.isArray(specs)) throw new Error(`${name}: la exportación por defecto debe devolver una lista de casos.`);
    for (const spec of specs) {
      if (!/^[a-z0-9-]+\/[^\s]+$/.test(spec.id)) throw new Error(`${name}: id no válido «${spec.id}» (usa familia/nombre, sin espacios).`);
      if (ids.has(spec.id)) throw new Error(`${name}: id repetido «${spec.id}».`);
      if (!spec.why?.trim()) throw new Error(`${spec.id}: falta «why».`);
      ids.add(spec.id);
      const result = runCase(spec, texts);
      assertFinite(result.record, spec.id);
      cases.push(result.record);
      result.fired.forEach(rule => fired.add(rule));
      steps += result.steps;
      const family = spec.id.split('/')[0];
      families[family] = (families[family] ?? 0) + 1;
    }
  }
  const order = new Map(rules.map((rule, index) => [rule.id, index]));
  const eventTexts = [...texts.values()].sort((a, b) => order.get(a.rule)! - order.get(b.rule)! || a.kind.localeCompare(b.kind));
  const tables = { ...buildTables(), eventTexts };
  assertFinite(tables, 'tables');
  const stats = { cases: cases.length, steps, families, rulesFired: fired.size, rulesNeverFired: rules.map(rule => rule.id).filter(id => !fired.has(id)) };
  const golden = {
    schemaVersion: SCHEMA_VERSION,
    generator: { script: 'golden/export.golden.ts', node: process.versions.node, v8: process.versions.v8, icu: process.versions.icu },
    seed: SEED, prng: 'mulberry32', compare, stats, tables, cases,
  };
  return { golden, stats };
}
export type Golden = Awaited<ReturnType<typeof buildGolden>>['golden'];

/** Texto estable: una línea por caso y por fila de tabla, con LF, para que los cambios se lean en un diff. */
export function serialize(golden: Golden) {
  const rows = (items: unknown[]) => `[\n${items.map(item => JSON.stringify(item)).join(',\n')}\n]`;
  const tables = Object.entries(golden.tables).map(([key, value]) => `${JSON.stringify(key)}:${Array.isArray(value) ? rows(value) : JSON.stringify(value)}`).join(',\n');
  const { tables: _tables, cases, ...head } = golden;
  const top = Object.entries(head).map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`).join(',\n');
  return `{\n${top},\n"tables":{\n${tables}\n},\n"cases":${rows(cases)}\n}\n`;
}

/** La parte del documento que depende solo del modelo (sin versiones de Node ni estadísticas). */
export const comparable = (doc: { schemaVersion: unknown; seed: unknown; tables: unknown; cases: unknown }) => ({ schemaVersion: doc.schemaVersion, seed: doc.seed, tables: doc.tables, cases: doc.cases });

/** Ruta y valores de la primera diferencia entre dos valores JSON, o null si son iguales. */
export function firstDifference(a: unknown, b: unknown, path = ''): string | null {
  if (a === b) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: ${a.length} elementos frente a ${b.length}`;
    for (let i = 0; i < a.length; i++) { const d = firstDifference(a[i], b[i], `${path}[${i}]`); if (d) return d; }
    return null;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.join('\n') !== kb.join('\n')) return `${path}: claves [${ka.join(', ')}] frente a [${kb.join(', ')}]`;
    for (const key of ka) { const d = firstDifference((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`); if (d) return d; }
    return null;
  }
  return `${path}: ${JSON.stringify(a)} frente a ${JSON.stringify(b)}`;
}
