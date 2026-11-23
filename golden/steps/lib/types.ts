/**
 * Especificaciones de los vectores de la CAPA DE ESTADO de la campana (src/state/hood.ts y la parte de
 * protección y manos de src/state/lab.ts). Una familia solo describe ENTRADAS: secuencias de operaciones
 * con el tiempo que avanza en cada una. Las salidas las captura `harness.ts` con los almacenes reales.
 */

/** Operaciones del vocabulario. Cada una llama a UNA acción real del almacén (ver `harness.ts`). */
export type OpName =
  // Capa del laboratorio (useLab): teclas E y Q sobre un objetivo, cambio de mano, sesión.
  | 'iniciar' | 'menu' | 'mano' | 'usar' | 'dejar' | 'cerrarPanel'
  // Almacén de la campana (useHood).
  | 'receta' | 'ventana' | 'conmutar' | 'verter' | 'chorro' | 'tic' | 'soltar'
  | 'verterProbeta' | 'verterBalanza' | 'enjuagar' | 'desechar' | 'vaciar' | 'guardar'
  | 'devolverBandeja' | 'reiniciar' | 'cancelar' | 'cogerFrasco' | 'ponerFrasco'
  // Solo deja pasar el tiempo.
  | 'esperar';

/**
 * Intención del caso tras una operación. No se exporta: el exportador falla si el almacén real no hace
 * lo que el caso dice ejercitar (misma idea que `mustFire` en los vectores químicos).
 */
export interface Debe {
  /** Valor devuelto por la acción: exacto si es booleano; si es texto, fragmento que debe contener el texto devuelto. */
  devuelve?: boolean | string;
  /** Fragmento que debe aparecer en `error` de la campana; `''` exige que esté vacío. */
  error?: string;
  /** Fragmento que debe aparecer en `message` del laboratorio; `''` exige que esté vacío. */
  mensaje?: string;
  /** Clave del primer paso sin hacer de la práctica en curso, o `'fin'` si están todos hechos. */
  actual?: string;
  /** Ids de los objetivos (flechas) del paso actual, en orden. */
  objetivos?: string[];
  /** Fragmento que debe aparecer en la etiqueta del primer objetivo del paso actual. */
  etiqueta?: string;
  /** Claves de pasos que deben estar hechos. */
  hechos?: string[];
  /** Claves de pasos que deben estar sin hacer. */
  pendientes?: string[];
  /** Comprobación de un paso concreto (no necesariamente el actual): si está hecho y la etiqueta de su primer objetivo. */
  paso?: { clave: string; hecho?: boolean; etiqueta?: string };
}

export interface OpSpec {
  op: OpName;
  args?: Record<string, string | number | null>;
  /** Milisegundos que avanza el reloj DESPUÉS de la operación (en `tic`, después de cada repetición). Entero ≥ 0. */
  avanzaMs?: number;
  debe?: Debe;
}

export interface StepCaseSpec {
  /** `familia/nombre`: único en todo el archivo. */
  id: string;
  /** Qué regla de juego ejercita el caso, en una frase. */
  why: string;
  ops: OpSpec[];
}

export interface StepFamilyContext {
  /** Generador determinista (mulberry32) propio de la familia. */
  rng: () => number;
  /** Entero uniforme en [lo, hi]. */
  int: (lo: number, hi: number) => number;
  /** Elemento uniforme de una lista. */
  pick: <T>(items: readonly T[]) => T;
}

/** Cada archivo de `golden/steps/families/` exporta por defecto una función con esta firma. */
export type StepFamily = (ctx: StepFamilyContext) => StepCaseSpec[];
