import type { Family } from '../lib/types';
import ejemplo from './_ejemplo';
import formulaErrores from './10-formula-errores';
import practicas from './20-practicas';
import unicosPares from './30-unicos-pares';
import aleatorias from './40-aleatorias';
import phColorNota from './50-ph-color-nota';
import kspCalor from './60-ksp-calor';
import redoxMetalesAcidos from './70-redox-metales-acidos';
import clasico from './80-clasico';
import huecos from './90-huecos';

/**
 * Familias en orden de exportación. El nombre es el del archivo: de él sale la semilla de cada familia.
 * Las que empiezan por `_` no se exportan; solo se ejecutan con GOLDEN_FAMILY=<nombre>.
 */
export const families: [name: string, family: Family][] = [
  ['_ejemplo', ejemplo],
  ['10-formula-errores', formulaErrores],
  ['20-practicas', practicas],
  ['30-unicos-pares', unicosPares],
  ['40-aleatorias', aleatorias],
  ['50-ph-color-nota', phColorNota],
  ['60-ksp-calor', kspCalor],
  ['70-redox-metales-acidos', redoxMetalesAcidos],
  ['80-clasico', clasico],
  ['90-huecos', huecos],
];
