import { CYLINDER_RATE, POUR_MS, spatulaRate, STREAM } from '../../../src/state/hood';
import type { HoodRecipe, RecipeAdd } from '../../../src/experiments/hoodRecipes';
import type { Debe, OpName, OpSpec } from './types';

/**
 * Constructores de operaciones y secuencias habituales del jugador. Solo producen ENTRADAS: cuánto
 * tiempo se mantiene el clic, en fotogramas de cuánto, y qué se espera. Los planes de llenado usan las
 * constantes reales del almacén (caudal, espátula) para decidir cuántos fotogramas pedir; lo que
 * de verdad ocurre lo decide y lo captura el almacén.
 */
export interface Extra { avanzaMs?: number; debe?: Debe }
const o = (op: OpName, args?: OpSpec['args'], extra: Extra = {}): OpSpec => ({ op, ...(args ? { args } : {}), ...(extra.avanzaMs ? { avanzaMs: extra.avanzaMs } : {}), ...(extra.debe ? { debe: extra.debe } : {}) });

/** Duración de la animación de enjuague: literal de `transferThen` en hood.ts (no se exporta). */
export const RINSE_MS = 900;
/** Antes de que caiga nada, la botella se inclina (o la espátula se carga) durante este tiempo: literal de `streamTick`. */
export const TILT_MS = 300;
export { POUR_MS };

// --- useLab ---
export const iniciar = (modo: 'free' | 'guided' | 'tutorial', extra?: Extra) => o('iniciar', { modo }, extra);
export const menu = (extra?: Extra) => o('menu', undefined, extra);
export const mano = (m: 'left' | 'right', extra?: Extra) => o('mano', { mano: m }, extra);
/** Tecla E (o clic) apuntando a `objetivo`. */
export const usar = (objetivo: string | null, extra?: Extra) => o('usar', { objetivo }, extra);
/** Tecla Q apuntando a `objetivo`. */
export const dejar = (objetivo: string | null, extra?: Extra) => o('dejar', { objetivo }, extra);
export const cerrarPanel = (extra?: Extra) => o('cerrarPanel', undefined, extra);
// --- useHood ---
export const receta = (id: string | null, extra?: Extra) => o('receta', { id }, extra);
export const ventana = (posicion: 'closed' | 'work' | 'open', extra?: Extra) => o('ventana', { posicion }, extra);
export const conmutar = (clave: 'light' | 'fan' | 'stirring', extra?: Extra) => o('conmutar', { clave }, extra);
/** Vertido directo de una cantidad conocida; termina a los POUR_MS. */
export const verter = (reactivo: string, cantidad: number, extra: Extra = { avanzaMs: POUR_MS }) => o('verter', { reactivo, cantidad }, extra);
export const chorro = (reactivo: string, destino?: 'flask' | 'cylinder' | 'balance', extra?: Extra) => o('chorro', destino ? { reactivo, destino } : { reactivo }, extra);
/** `veces` fotogramas de `segundos`; por defecto el reloj avanza lo mismo que dura el fotograma. */
export const tic = (segundos: number, veces = 1, avanzaMs = Math.round(segundos * 1000), debe?: Debe) => o('tic', veces === 1 ? { segundos } : { segundos, veces }, { avanzaMs, debe });
export const soltar = (extra?: Extra) => o('soltar', undefined, extra);
export const verterProbeta = (extra: Extra = { avanzaMs: POUR_MS }) => o('verterProbeta', undefined, extra);
export const verterBalanza = (extra: Extra = { avanzaMs: POUR_MS }) => o('verterBalanza', undefined, extra);
export const enjuagar = (extra: Extra = { avanzaMs: RINSE_MS }) => o('enjuagar', undefined, extra);
export const desechar = (extra: Extra = { avanzaMs: POUR_MS }) => o('desechar', undefined, extra);
export const vaciar = (extra?: Extra) => o('vaciar', undefined, extra);
export const guardar = (extra?: Extra) => o('guardar', undefined, extra);
export const devolverBandeja = (extra?: Extra) => o('devolverBandeja', undefined, extra);
export const reiniciar = (extra?: Extra) => o('reiniciar', undefined, extra);
export const cancelar = (extra?: Extra) => o('cancelar', undefined, extra);
/** `pick` y `put` del almacén, sin pasar por las teclas E y Q: no comprueban protección ni mano ocupada. */
export const cogerFrasco = (reactivo: string, m: 'left' | 'right', extra?: Extra) => o('cogerFrasco', { reactivo, mano: m }, extra);
export const ponerFrasco = (m: 'left' | 'right', donde: 'shelf' | 'hood', extra?: Extra) => o('ponerFrasco', { mano: m, donde }, extra);
export const esperar = (ms: number, debe?: Debe) => o('esperar', undefined, { avanzaMs: ms, debe });

/** Añade una intención a la ÚLTIMA operación de una secuencia. */
export const con = (ops: OpSpec[], debe: Debe): OpSpec[] => [...ops.slice(0, -1), { ...ops[ops.length - 1], debe: { ...ops[ops.length - 1].debe, ...debe } }];

// --- Secuencias del jugador ---
export const protegerse = (): OpSpec[] => [usar('ppe-goggles'), usar('ppe-gloves')];
/** Coge el frasco (del estante o de la bandeja) con la mano activa. */
export const coger = (id: string, extra?: Extra) => usar(`reagent:${id}`, extra);
/** Lleva cada frasco del estante a la bandeja de la campana con la mano activa. */
export const aBandeja = (...ids: string[]): OpSpec[] => ids.flatMap(id => [coger(id), dejar('hood')]);
/** E en la probeta / balanza / piseta / residuos y espera a que acabe la animación. */
export const usarProbeta = (debe?: Debe) => usar('hood-cylinder', { avanzaMs: POUR_MS, debe });
export const usarBalanza = (debe?: Debe) => usar('hood-balance', { avanzaMs: POUR_MS, debe });
export const usarPiseta = (debe?: Debe) => usar('hood-washbottle', { avanzaMs: RINSE_MS, debe });
export const usarResiduos = (debe?: Debe) => usar('hood-waste', { avanzaMs: POUR_MS, debe });

const ms = (seconds: number) => Math.round(seconds * 1000);
/**
 * Mantiene el clic sobre la probeta hasta `ml`: 300 ms de inclinación y después fotogramas de `frameMs`
 * a CYLINDER_RATE mL/s; el resto que no llena un fotograma va en un último fotograma más corto.
 */
export function llenarProbeta(id: string, ml: number, frameMs = 100): OpSpec[] {
  const frame = frameMs / 1000, total = ml / CYLINDER_RATE;
  const n = Math.floor(total / frame + 1e-9), rest = Math.round((total - n * frame) * 1e6) / 1e6;
  return [chorro(id, 'cylinder', { avanzaMs: TILT_MS }), ...(n ? [tic(frame, n, frameMs)] : []), ...(rest > 0 ? [tic(rest, 1, ms(rest))] : []), soltar()];
}
/** Un solo fotograma largo: con la probeta vacía deja exactamente `ml` (8 · ml/8 es exacto en coma flotante). */
export const llenarProbetaExacto = (id: string, ml: number): OpSpec[] => [chorro(id, 'cylinder', { avanzaMs: TILT_MS }), tic(ml / CYLINDER_RATE, 1, ms(ml / CYLINDER_RATE)), soltar()];
/** Número de fotogramas de `frameMs` con la espátula (que acelera con el tiempo) hasta llegar a `grams`. */
export function framesToWeigh(grams: number, frameMs = 100) {
  let g = 0, t = TILT_MS, n = 0;
  while (g < grams) { g += spatulaRate(t / 1000) * frameMs / 1000; t += frameMs; n++; }
  return n;
}
/** Mantiene el clic sobre la balanza hasta pasar de `grams` (el jugador suelta al llegar; siempre se pasa un poco). */
export const pesar = (id: string, grams: number, frameMs = 100): OpSpec[] => [chorro(id, 'balance', { avanzaMs: TILT_MS }), tic(frameMs / 1000, framesToWeigh(grams, frameMs), frameMs), soltar()];
/** Espera a que la espátula vaya a 1 g/s (3 s de clic) y da un único fotograma: la balanza gana exactamente `grams`. */
export const pesarExacto = (id: string, grams: number): OpSpec[] => [chorro(id, 'balance', { avanzaMs: 3000 }), tic(grams, 1, ms(grams)), soltar()];
/**
 * Mantiene el clic sobre el matraz con un gotero hasta ver caer `n` gotas (STREAM.indicator: 2 gotas/s).
 * Los fotogramas se cuentan acumulando como el almacén: con fotogramas de 50 ms diez sumas de 0,1 dan
 * 0,9999999999999999 y la gota cae un fotograma más tarde.
 */
export function gotas(id: string, n: number, frameMs = 100): OpSpec[] {
  const { rate, step } = STREAM.indicator;
  let pending = 0, drops = 0, frames = 0;
  while (drops < n) { pending += rate * frameMs / 1000; frames++; while (pending >= step) { pending -= step; drops++; } }
  return [chorro(id, 'flask', { avanzaMs: TILT_MS }), tic(frameMs / 1000, frames, frameMs), soltar()];
}

const TICK: Record<RecipeAdd['tool'], number> = { probeta: 10, balanza: 100, gotero: 1 };
/** Redondeo a la resolución de cada herramienta (0,1 mL; 0,01 g; gotas enteras hacia arriba). */
export const toolRound = (tool: RecipeAdd['tool'], x: number) => tool === 'gotero' ? Math.ceil(x - 1e-9) : Math.round(x * TICK[tool]) / TICK[tool];

export interface AddOptions {
  /** Factor sobre la cantidad de la receta (1 = exacta). */
  factor?: number;
  frameMs?: number;
  /** Medidas exactas (un fotograma largo) en vez de fotogramas de juego. */
  exact?: boolean;
}
/**
 * Un paso «añadir» completo con el frasco YA en la mano activa: enjuaga la probeta si hace falta, mide con la
 * herramienta de la receta y lo pasa al matraz. `dirty` es el reactivo cuyos restos tiene la probeta.
 */
export function addWithTool(add: RecipeAdd, dirty: string | null, opt: AddOptions = {}): { ops: OpSpec[]; dirty: string | null } {
  const amount = toolRound(add.tool, add.amount * (opt.factor ?? 1));
  if (add.tool === 'gotero') return { ops: gotas(add.reagent, amount, opt.frameMs), dirty };
  if (add.tool === 'balanza') return { ops: [...(opt.exact ? pesarExacto(add.reagent, amount) : pesar(add.reagent, amount, opt.frameMs)), usarBalanza({ mensaje: 'Añades el sólido' })], dirty };
  const ops: OpSpec[] = [];
  if (dirty && dirty !== add.reagent) ops.push(usarPiseta({ mensaje: 'Enjuagas la probeta' }));
  // La probeta es de 100 mL: lo que no cabe va en un segundo llenado.
  for (let left = amount; left > 1e-9; left -= 100) {
    const part = Math.min(100, left);
    ops.push(...(opt.exact ? llenarProbetaExacto(add.reagent, part) : llenarProbeta(add.reagent, part, opt.frameMs)), usarProbeta({ mensaje: 'Viertes' }));
  }
  return { ops, dirty: add.reagent };
}
/** Todos los pasos «añadir» de una receta con los frascos en la bandeja: coger, medir, pasar al matraz y dejar el frasco. */
export function addAll(r: HoodRecipe, opt: AddOptions & { factors?: number[]; dirty?: string | null } = {}): OpSpec[] {
  let dirty = opt.dirty ?? null;
  return r.adds.flatMap((add, i) => {
    const step = addWithTool(add, dirty, { ...opt, factor: opt.factors?.[i] ?? opt.factor });
    dirty = step.dirty;
    return [coger(add.reagent), ...step.ops, dejar('hood')];
  });
}
export const needed = (r: HoodRecipe) => [...new Set(r.adds.map(a => a.reagent))];
