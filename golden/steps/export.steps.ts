import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { hoodRecipes } from '../../src/experiments/hoodRecipes';
import { buildSteps, serialize } from './lib/build';
import { compareSteps, replay } from './lib/compare';
import type { OpName } from './lib/types';

/**
 * Exportador de los vectores de la capa de estado de la campana. Se ejecuta con `npm run golden` (junto al
 * de química) o solo con `npm run golden:steps`.
 * Con STEPS_FAMILY=<archivo sin .ts> ejecuta solo esa familia, imprime cada operación y no escribe nada.
 */
const only = process.env.STEPS_FAMILY;
const target = fileURLToPath(new URL('../steps.json', import.meta.url));
const MAX_BYTES = 4 * 1048576;
const ALL_OPS: OpName[] = ['iniciar', 'menu', 'mano', 'usar', 'dejar', 'cerrarPanel', 'receta', 'ventana', 'conmutar', 'verter', 'chorro', 'tic', 'soltar',
  'verterProbeta', 'verterBalanza', 'enjuagar', 'desechar', 'vaciar', 'guardar', 'devolverBandeja', 'reiniciar', 'cancelar', 'cogerFrasco', 'ponerFrasco', 'esperar'];
/** Marcas de fragilidad admitidas: las de orden, que el comparador resuelve solo. Cualquier otra obliga a cambiar el caso. */
const HARMLESS_FLAGS = ['orden-disueltos', 'orden-solidos'];

const short = (value: unknown) => { const text = JSON.stringify(value); return text.length > 170 ? `${text.slice(0, 170)}…` : text; };
function describeCase(record: { id: string; ops: Record<string, any>[] }) {
  const lines = record.ops.map(op => {
    const head = `${String(op.t).padStart(6)} ms  ${op.op}${op.args ? ` ${JSON.stringify(op.args)}` : ''}${op.avanzaMs ? ` +${op.avanzaMs}` : ''}${op.devuelve !== undefined ? ` → ${op.devuelve}` : ''}${op.flags ? ` ⚑${op.flags.join(',')}` : ''}`;
    const changes = Object.entries(op.cambia).filter(([key]) => !['mixture', 'analysis'].includes(key)).map(([key, value]) => `        ${key}: ${short(value)}`);
    return [head, ...changes].join('\n');
  });
  return `${record.id}\n${lines.join('\n')}`;
}

// Con GOLDEN_FAMILY se está depurando una familia de química: este exportador no hace nada.
it.skipIf(!!process.env.GOLDEN_FAMILY)(only ? `familia ${only}` : 'exporta golden/steps.json', () => {
  const { doc, stats } = buildSteps(only);
  if (only) {
    const wanted = process.env.STEPS_CASE;
    console.log(doc.cases.filter(c => !wanted || c.id.includes(wanted)).map(describeCase).join('\n\n'));
    console.log(`\n${only}: ${stats.cases} casos, ${stats.ops} operaciones, marcas ${JSON.stringify(stats.flags)}.\nErrores de la campana vistos:\n  ${stats.hoodErrors.join('\n  ')}\nMensajes vistos:\n  ${stats.labMessages.join('\n  ')}`);
    return;
  }
  const text = serialize(doc);
  // Reproducible: dos ejecuciones dan exactamente el mismo texto.
  expect(serialize(buildSteps().doc)).toBe(text);
  const parsed = JSON.parse(text);
  expect(parsed.cases).toHaveLength(stats.cases);
  // El comparador de referencia no ve diferencias entre el documento y él mismo tras pasar por JSON.
  expect(compareSteps(parsed, JSON.parse(JSON.stringify(doc)))).toEqual([]);
  expect(stats.cases).toBeGreaterThanOrEqual(120);
  expect(Buffer.byteLength(text)).toBeLessThan(MAX_BYTES);
  // Ninguna operación depende del último bit del motor químico (umbral de un evento, redondeo del pH de una nota, borde del matraz).
  expect(Object.keys(stats.flags).filter(flag => !HARMLESS_FLAGS.includes(flag))).toEqual([]);
  // Todas las operaciones del vocabulario se usan.
  expect(ALL_OPS.filter(op => !stats.opsUsed[op])).toEqual([]);
  // Cada práctica tiene su recorrido completo, que termina con todos los pasos hechos, y sus textos tabulados.
  for (const r of hoodRecipes) {
    const found = parsed.cases.find((c: { id: string }) => c.id === `recorrido/${r.id}/correcto`);
    expect(found, r.id).toBeTruthy();
    const end = replay(parsed.initial, found.ops).at(-1)!;
    expect(end.steps.every((step: [string, boolean]) => step[1]), r.id).toBe(true);
    expect(parsed.tables.stepTexts.some((t: { recipe: string }) => t.recipe === r.id), r.id).toBe(true);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text, 'utf8');
  console.log(`golden/steps.json: ${stats.cases} casos, ${stats.ops} operaciones, ${(Buffer.byteLength(text) / 1048576).toFixed(2)} MB\n${JSON.stringify(stats.families)}\n${JSON.stringify(stats.opsUsed)}\nmarcas ${JSON.stringify(stats.flags)}; ${stats.hoodErrors.length} errores de la campana y ${stats.labMessages.length} mensajes distintos.`);
});
