import { expect, it } from 'vitest';
import stored from './chemistry.json';
import { buildGolden, comparable, firstDifference } from './lib/build';
import { compareGolden } from './lib/compare';

// Candado de regresión: si el modelo químico cambia, los vectores guardados dejan de coincidir.
// Si el cambio es intencionado, regenera con `npm run golden` y revisa el diff de golden/chemistry.json.
it('golden/chemistry.json coincide con el motor químico actual', async () => {
  const { golden } = await buildGolden();
  const current = comparable(JSON.parse(JSON.stringify(golden)));
  // Con el mismo motor de JavaScript que generó el archivo, la coincidencia es exacta.
  const sameEngine = !process.versions.bun && process.versions.v8 === stored.generator.v8;
  if (sameEngine) expect(firstDifference(comparable(stored), current)).toBeNull();
  // Con otro motor (bun, otra versión de Node) cambian los últimos bits de exp, log y pow: vale la regla de tolerancia.
  expect(compareGolden(stored, current)).toEqual([]);
}, 120000);
