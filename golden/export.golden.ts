import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { hoodRecipes } from '../src/experiments/hoodRecipes';
import { buildGolden, serialize } from './lib/build';

/**
 * Exportador de vectores de referencia. Se ejecuta con `npm run golden`.
 * Con GOLDEN_FAMILY=<archivo sin .ts> ejecuta solo esa familia, imprime un resumen por caso y no escribe nada.
 */
const only = process.env.GOLDEN_FAMILY;
const target = fileURLToPath(new URL('./chemistry.json', import.meta.url));
const short = (x: number) => Number(x.toPrecision(4));

function describeCase(record: Record<string, any>) {
  if (record.fn !== 'sequence') return `${record.id} :: ${JSON.stringify(record.in)} → ${JSON.stringify(record.out ?? record.error)}`;
  const steps = (record.steps as any[]).map(step => {
    const head = `${step.in.reagent} ${step.in.amount}`;
    if (step.error) return `${head} ✗ ${step.error.code}${step.flags ? ` ⚑${step.flags.join(',')}` : ''}`;
    const events = step.out.events.map((e: any) => `${e.rule}(${short(e.extent)})`).join(' ') || '—';
    const a = step.out.analysis;
    return `${head} → ${events} | pH ${a.pH === null ? 'null' : short(a.pH)} T ${short(a.temperatureC)} V ${short(a.volumeMl)} ${a.color}${step.flags ? ` ⚑${step.flags.join(',')}` : ''}`;
  });
  return `${record.id}\n    ${steps.join('\n    ')}`;
}

it(only ? `familia ${only}` : 'exporta golden/chemistry.json', async () => {
  const { golden, stats } = await buildGolden(only);
  if (only) {
    console.log(golden.cases.map(describeCase).join('\n'));
    console.log(`\n${only}: ${stats.cases} casos, ${stats.steps} pasos, familias ${JSON.stringify(stats.families)}, ${stats.rulesFired} reglas con evento.`);
    return;
  }
  const text = serialize(golden);
  // Reproducible: dos ejecuciones dan exactamente el mismo texto.
  expect(serialize((await buildGolden()).golden)).toBe(text);
  expect(JSON.parse(text).cases).toHaveLength(stats.cases);
  expect(stats.cases).toBeGreaterThanOrEqual(200);
  // Cada práctica guiada tiene su caso con las cantidades exactas de la receta.
  const ids = new Set(golden.cases.map(c => c.id));
  expect(hoodRecipes.map(r => `practica/${r.id}/exacta`).filter(id => !ids.has(id))).toEqual([]);
  // Las 99 reglas dan al menos un evento visible en algún caso.
  expect(stats.rulesNeverFired).toEqual([]);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text, 'utf8');
  console.log(`golden/chemistry.json: ${stats.cases} casos, ${stats.steps} pasos, ${stats.rulesFired} reglas, ${(Buffer.byteLength(text) / 1048576).toFixed(2)} MB\n${JSON.stringify(stats.families)}`);
});
