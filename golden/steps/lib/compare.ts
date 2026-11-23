import { speciesIds } from '../../../src/chemistry/species';
import { base, walk } from '../../lib/compare';

/**
 * Comparador de referencia de los vectores de la capa de estado. Es el modelo para el del porte a C++:
 * reconstruye el estado completo tras cada operación aplicando `cambia` y compara estados completos, así
 * una clave que cambia en el último bit en una implementación y no en la otra no descuadra la comparación.
 *
 * Regla: exactos los textos, booleanos, enumeraciones, listas y TODO lo que la capa de estado calcula con
 * aritmética simple (mL de la probeta, gramos de la balanza, cantidades, reloj). Con la tolerancia de
 * golden/README.md solo lo que sale del motor químico (mezcla, análisis, eventos, ΔT y ráfaga).
 * Las marcas `flags` de una operación son informativas y no se comparan: el exportador solo admite las de
 * orden (`orden-solidos`, `orden-disueltos`), que `walk` ya resuelve aceptando cualquier lista bien ordenada.
 */
const EXACT = new Set(['ml', 'grams', 'amount', 'added', 'startedAt', 't', 'disposals', 'count', 'guidedIndex', 'avanzaMs', 'segundos', 'veces', 'cantidad', 'caen', 'quedan',
  // Constantes de `tables.constants`: el porte las copia tal cual.
  'HOOD_TRAY_SLOTS', 'POUR_MS', 'CYLINDER_ML', 'CYLINDER_RATE', 'VESSEL_ML', 'rate', 'step', 'spatulaRate']);
const rank = new Map(speciesIds.map((id, i) => [id as string, i]));
const scope = (path: string) => base(path, rank, { exact: EXACT });

type Row = Record<string, any>;
interface Doc { tables: unknown; initial: Row; cases: { id: string; ops: Row[] }[] }

/** Compara dos estados completos. `analysis` sale entero del motor químico: sus gramos de sólido llevan tolerancia, no como los de la balanza. */
function walkState(e: Row, a: Row, where: string, out: string[], omit: string[]) {
  const { analysis: ea, ...restE } = e, { analysis: aa, ...restA } = a;
  for (const key of omit) { delete restE[key]; delete restA[key]; }
  walk(restE, restA, scope(where), out);
  walk(ea, aa, base(`${where}.analysis`, rank), out);
}

/** Aplica el `cambia` de una operación al estado anterior. El registro llega como { caen, quedan, nuevas }. */
export function applyChanges(state: Row, cambia: Row): Row {
  const next = { ...state };
  for (const [key, value] of Object.entries(cambia)) {
    if (!(key in state)) throw new Error(`Clave de estado desconocida «${key}».`);
    next[key] = key === 'log' ? [...state.log.slice(value.caen, value.caen + value.quedan), ...value.nuevas] : value;
  }
  return next;
}
/** Estado completo tras cada operación de un caso. */
export function replay(initial: Row, ops: Row[]): Row[] {
  let state = initial;
  return ops.map(op => state = applyChanges(state, op.cambia));
}

/**
 * Devuelve las diferencias fuera de tolerancia (como mucho 20). Lista vacía = implementaciones equivalentes.
 * `omit` deja fuera claves del estado que la otra implementación decide no reproducir (por ejemplo `burst`,
 * que solo alimenta efectos visuales, o `locations`, `panel` y `activePractice`, que son del laboratorio web).
 */
export function compareSteps(expected: Doc, actual: Doc, omit: string[] = []): string[] {
  const out: string[] = [];
  walk(expected.tables, actual.tables, scope('tables'), out);
  walkState(expected.initial, actual.initial, 'initial', out, omit);
  if (expected.cases.length !== actual.cases.length) return [...out, `cases: ${expected.cases.length} frente a ${actual.cases.length}`];
  expected.cases.forEach((e, i) => {
    const a = actual.cases[i];
    if (out.length >= 20) return;
    if (e.id !== a.id) { out.push(`cases[${i}]: ${e.id} frente a ${a.id}`); return; }
    if (e.ops.length !== a.ops.length) { out.push(`${e.id}: ${e.ops.length} operaciones frente a ${a.ops.length}`); return; }
    const es = replay(expected.initial, e.ops), as = replay(actual.initial, a.ops);
    const before = out.length;
    for (let k = 0; k < e.ops.length; k++) {
      const where = `${e.id} op ${k + 1} (${e.ops[k].op})`;
      const input = (op: Row) => ({ op: op.op, args: op.args ?? null, avanzaMs: op.avanzaMs ?? 0, t: op.t, devuelve: op.devuelve ?? null });
      walk(input(e.ops[k]), input(a.ops[k]), scope(where), out);
      walkState(es[k], as[k], where, out, omit);
      // Tras la primera diferencia el resto del caso arrastra el mismo error.
      if (out.length > before) break;
    }
  });
  return out.slice(0, 20);
}
