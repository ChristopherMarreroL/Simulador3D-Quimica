/**
 * Especificaciones de casos de referencia («golden»). Una familia solo describe ENTRADAS; las salidas
 * las captura `harness.ts` ejecutando el motor químico real de `src/chemistry`.
 */

/** Los números no finitos se escriben como texto para que sobrevivan a JSON. */
export type Num = number | 'NaN' | 'Infinity' | '-Infinity';

export interface StepSpec { reagent: string; amount: Num }

/** Mezcla escrita a mano (moles por especie) para llamar a solvePH o solutionColor sin pasar por addReagent. */
export interface MixtureSpec {
  n?: Record<string, number>; waterMl: number; temperatureC?: number;
  indicators?: string[]; released?: Record<string, number>; heatUnknown?: boolean;
}
/** Una mezcla se puede dar escrita a mano o como el resultado de una secuencia de adiciones. */
export type MixtureInput = { steps: StepSpec[] } | MixtureSpec;

interface Base {
  /** `familia/nombre`: único en todo el archivo. La parte anterior a la primera barra es la familia. */
  id: string;
  /** Qué comportamiento ejercita el caso, en una frase. */
  why: string;
  /** Código de error esperado (en una secuencia, el del ÚLTIMO paso). El exportador falla si no coincide. */
  mustError?: ErrorCode;
}
export type ErrorCode = 'UNKNOWN_REAGENT' | 'RANGE' | 'OVERFLOW' | 'UNKNOWN_ELEMENT' | 'BAD_FORMULA';

export type CaseSpec =
  | Base & { fn: 'sequence'; steps: StepSpec[]; /** Reglas que deben dar un evento visible en algún paso. */ mustFire?: string[]; /** Reglas que no deben dar ningún evento visible. */ mustNotFire?: string[] }
  | Base & { fn: 'solvePH'; mixture: MixtureInput }
  | Base & { fn: 'solutionColor'; mixture: MixtureInput; /** `'solve'` usa solvePH(mezcla), como hace analyzeMixture. */ pH: number | null | 'solve' }
  | Base & { fn: 'indicatorColor'; indicator: string; pH: Num }
  | Base & { fn: 'molarMass'; formula: string }
  | Base & { fn: 'gasLitres'; mol: Num }
  | Base & { fn: 'calculateReaction'; input: { vinegarMl: Num; concentration: Num; bicarbonateG: Num } }
  | Base & { fn: 'conductivity'; input: { solution: string; concentration: Num } }
  | Base & { fn: 'crystallization'; input: { waterG: Num; saltG: Num; evaporationPercent: Num } };

/** Resumen de una secuencia para que una familia pueda elegir casos según lo que hace el motor. */
export interface Trace {
  /** Moles totales (extensión) de cada regla con evento visible, en orden de primera aparición. */
  fired: Record<string, number>;
  /** Código de error de cada paso, o null si se aplicó. */
  errors: (ErrorCode | 'UNEXPECTED' | null)[];
  pH: number | null; waterMl: number; temperatureC: number; heatUnknown: boolean;
  /** Moles por especie al final. */
  n: Record<string, number>;
  released: Record<string, number>;
}

export interface FamilyContext {
  /** Generador determinista (mulberry32) propio de la familia: siempre la misma secuencia. */
  rng: () => number;
  /** Entero uniforme en [lo, hi]. */
  int: (lo: number, hi: number) => number;
  /** Elemento uniforme de una lista. */
  pick: <T>(items: readonly T[]) => T;
  /** Ejecuta una secuencia con el motor real y resume el resultado. No registra ningún caso. */
  trace: (steps: StepSpec[]) => Trace;
}

/** Cada archivo de `golden/families/` exporta por defecto una función con esta firma. */
export type Family = (ctx: FamilyContext) => CaseSpec[];
