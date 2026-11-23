/**
 * Comparador de referencia entre los vectores guardados y los de otra implementación (otro motor de
 * JavaScript hoy, el porte a C++ después). Aplica la regla descrita en golden/README.md.
 */
const REL = 1e-6;
const MOL_KEYS = new Set(['extent', 'mol', 'molarity']);
const HEX = /^#[0-9a-f]{6}$/;
/** Lo que una marca de fragilidad permite no comparar en su paso. */
const THRESHOLD_SKIPS = ['events', 'note', 'solids', 'dissolved', 'gases', 'ammoniaSmell', 'color', 'opacity'];

type Json = unknown;
type Row = Record<string, any>;
/** Claves de tabla cuyos números se copian tal cual al porte: deben ser el mismo double, sin tolerancia. */
const TABLE_DATA = new Set(['index', 'charge', 'dHf', 'concentration', 'components', 'min', 'max', 'reactants', 'products', 'ions', 'ksp', 'water', 'vigor', 'VESSEL_ML', 'ROOM_C', 'DROP_ML']);
export interface Scope { path: string; key: string; molar: boolean; pH: boolean; skip: Set<string>; exact: Set<string>; rank: Map<string, number> }

function sameNumber(a: number, b: number, scope: Scope) {
  if (a === b) return true;
  if (scope.exact.has(scope.key)) return false;
  if (scope.pH || scope.key === 'pH') return Math.abs(a - b) <= 1e-6;
  const floor = scope.molar || MOL_KEYS.has(scope.key) ? 1e-12 : 1e-9;
  return Math.abs(a - b) <= REL * Math.max(Math.abs(a), Math.abs(b)) + floor;
}
const sameColor = (a: string, b: string) => [1, 3, 5].every(i => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 1);
const byId = (items: Json[]) => [...items].sort((x, y) => String((x as { id?: unknown })?.id).localeCompare(String((y as { id?: unknown })?.id)));

export function walk(e: Json, a: Json, scope: Scope, out: string[]) {
  if (out.length >= 20) return;
  if (typeof e === 'number' && typeof a === 'number') { if (!sameNumber(e, a, scope)) out.push(`${scope.path}: ${e} frente a ${a}`); return; }
  if (typeof e === 'string' && typeof a === 'string') {
    if (e !== a && !(HEX.test(e) && HEX.test(a) && sameColor(e, a))) out.push(`${scope.path}: ${JSON.stringify(e)} frente a ${JSON.stringify(a)}`);
    return;
  }
  if (Array.isArray(e) && Array.isArray(a)) {
    if (e.length !== a.length) { out.push(`${scope.path}: ${e.length} elementos frente a ${a.length}`); return; }
    // Sólidos y disueltos van de mayor a menor. Dos valores que empatan dentro de la tolerancia pueden salir en otro orden
    // (cambia el último bit de log, exp o pow): vale si la lista obtenida está bien ordenada (a igualdad exacta manda el
    // orden de las especies, que es lo que da el orden estable) y cada elemento coincide con el de su mismo id.
    const rankKey = scope.key === 'solids' ? 'grams' : scope.key === 'dissolved' ? 'molarity' : null;
    let [x, y] = [e, a];
    if (rankKey && e.some((item, i) => (item as Row)?.id !== (a[i] as Row)?.id)) {
      const rows = a as Row[];
      const order = (id: unknown) => scope.rank.get(String(id)) ?? -1;
      const bad = rows.findIndex((row, i) => i > 0 && !(rows[i - 1][rankKey] > row[rankKey] || (rows[i - 1][rankKey] === row[rankKey] && order(rows[i - 1].id) < order(row.id))));
      if (bad >= 0) { out.push(`${scope.path}[${bad}]: fuera de orden`); return; }
      [x, y] = [byId(e), byId(a)];
    }
    x.forEach((item, i) => walk(item, y[i], { ...scope, path: `${scope.path}[${i}]` }, out));
    return;
  }
  if (e && a && typeof e === 'object' && typeof a === 'object' && !Array.isArray(e) && !Array.isArray(a)) {
    const ke = Object.keys(e), ka = Object.keys(a);
    if (ke.join('\n') !== ka.join('\n')) { out.push(`${scope.path}: claves [${ke.join(', ')}] frente a [${ka.join(', ')}]`); return; }
    for (const key of ke) {
      if (scope.skip.has(key)) continue;
      walk((e as Record<string, Json>)[key], (a as Record<string, Json>)[key], { ...scope, key, path: `${scope.path}.${key}`, molar: scope.molar || key === 'n' || key === 'released' }, out);
    }
    return;
  }
  if (e !== a) out.push(`${scope.path}: ${JSON.stringify(e)} frente a ${JSON.stringify(a)}`);
}

export const base = (path: string, rank: Map<string, number>, extra: Partial<Scope> = {}): Scope => ({ path, key: '', molar: false, pH: false, skip: new Set(), exact: new Set(), rank, ...extra });

function compareSteps(id: string, expected: any[], actual: any[], rank: Map<string, number>, out: string[]) {
  if (expected.length !== actual.length) { out.push(`${id}: ${expected.length} pasos frente a ${actual.length}`); return; }
  for (let i = 0; i < expected.length; i++) {
    const flags: string[] = expected[i].flags ?? [];
    // A un bit del borde del matraz el paso puede aceptarse o rechazarse: desde ahí el caso deja de ser comparable.
    if (flags.includes('desborde-suma')) return;
    const skip = new Set<string>(['flags']);
    if (flags.includes('nota-redondeo-ph')) skip.add('note');
    if (flags.includes('error-redondeo-ml')) skip.add('message');
    if (flags.some(f => f.startsWith('umbral-'))) THRESHOLD_SKIPS.forEach(key => skip.add(key));
    walk(expected[i], actual[i], base(`${id} paso ${i + 1}`, rank, { skip }), out);
  }
}

/** Devuelve las diferencias fuera de tolerancia (como mucho 20). Lista vacía = implementaciones equivalentes. */
export function compareGolden(expected: { tables: Json; cases: any[] }, actual: { tables: Json; cases: any[] }): string[] {
  const out: string[] = [];
  const rank = new Map(((expected.tables as { species: { id: string }[] }).species).map((s, i) => [s.id, i]));
  walk(expected.tables, actual.tables, base('tables', rank, { exact: TABLE_DATA }), out);
  if (expected.cases.length !== actual.cases.length) return [...out, `cases: ${expected.cases.length} frente a ${actual.cases.length}`];
  expected.cases.forEach((e, i) => {
    const a = actual.cases[i];
    if (e.id !== a.id || e.fn !== a.fn) { out.push(`cases[${i}]: ${e.id} (${e.fn}) frente a ${a.id} (${a.fn})`); return; }
    if (e.fn === 'sequence') { compareSteps(e.id, e.steps, a.steps, rank, out); return; }
    walk({ in: e.in, error: e.error }, { in: a.in, error: a.error }, base(e.id, rank), out);
    // La salida de solvePH es un pH: se compara solo en absoluto.
    walk(e.out, a.out, base(`${e.id}.out`, rank, { pH: e.fn === 'solvePH' }), out);
  });
  return out.slice(0, 20);
}
