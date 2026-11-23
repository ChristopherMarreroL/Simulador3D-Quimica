import { expect, it } from 'vitest';
import stored from './steps.json';
import { firstDifference } from './lib/build';
import { buildSteps, comparable } from './steps/lib/build';
import { compareSteps } from './steps/lib/compare';

// Candado de regresión de la capa de estado de la campana (src/state/hood.ts, la protección y las manos de
// src/state/lab.ts y los pasos de src/experiments/hoodRecipes.ts): si una regla de juego cambia, los vectores
// guardados dejan de coincidir. Si el cambio es intencionado, regenera con `npm run golden` y revisa el diff
// de golden/steps.json.
it('golden/steps.json coincide con la capa de estado actual de la campana', () => {
  const current = comparable(JSON.parse(JSON.stringify(buildSteps().doc)));
  // Con el mismo motor de JavaScript que generó el archivo, la coincidencia es exacta.
  const sameEngine = !process.versions.bun && process.versions.v8 === stored.generator.v8;
  if (sameEngine) expect(firstDifference(comparable(stored), current)).toBeNull();
  // Con otro motor cambian los últimos bits de lo que sale del motor químico: vale la regla de tolerancia.
  // Lo que calcula la capa de estado (mL, gramos, cantidades, reloj, textos, pasos) se exige exacto siempre.
  expect(compareSteps(stored as never, current as never)).toEqual([]);
}, 120000);
