import type { StepFamily } from '../lib/types';
import cloruros from './10-cloruros';
import recorridos from './20-recorridos';
import herramientas from './30-herramientas';
import errores from './40-errores';
import bordes from './50-bordes';

/**
 * Familias en orden de exportación. El nombre es el del archivo: de él sale la semilla de cada familia.
 * Ejecutar una sola e imprimirla: STEPS_FAMILY=<nombre> npm run golden:steps
 */
export const families: [name: string, family: StepFamily][] = [
  ['10-cloruros', cloruros],
  ['20-recorridos', recorridos],
  ['30-herramientas', herramientas],
  ['40-errores', errores],
  ['50-bordes', bordes],
];
