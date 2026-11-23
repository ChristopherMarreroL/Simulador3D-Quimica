import { hoodGuidedIndex, recipeSteps, useHood, type Hand, type SashPosition, type StreamTarget } from '../../../src/state/hood';
import { useLab } from '../../../src/state/lab';
import { recipeById } from '../../../src/experiments/hoodRecipes';
import { DROP_ML, reagentIds, reagents, type ReagentId } from '../../../src/chemistry/reagents';
import { addReagent, VESSEL_ML } from '../../../src/chemistry/sandbox';
import { canonAnalysis, canonEvent, canonMixture, recordTexts, stepFlags, type EventTexts } from '../../lib/harness';
import type { Debe, OpName, OpSpec, StepCaseSpec } from './types';

/**
 * Ejecuta las secuencias de operaciones contra los almacenes REALES (useHood y useLab) y captura, tras cada
 * operación, el estado observable en forma canónica. No contiene reglas de juego propias: cada operación
 * llama a una acción del almacén, y lo capturado sale de los campos del almacén y de `recipeSteps()`.
 */

// `lab.open()` consulta `document.pointerLockElement`; fuera del navegador basta con que exista.
if (!('document' in globalThis)) Object.defineProperty(globalThis, 'document', { value: { pointerLockElement: null }, configurable: true, writable: true });

/**
 * Reloj controlado: el tiempo es una ENTRADA. Sustituye `Date.now`, `setTimeout` y `clearTimeout` mientras se
 * ejecutan los casos (no depende de los temporizadores falsos de Vitest, así que vale igual con bun).
 * Al avanzar, los temporizadores vencidos se ejecutan en orden de vencimiento (a igualdad, de creación)
 * con el reloj puesto en su instante de vencimiento.
 */
class FakeClock {
  now = 0;
  private seq = 0;
  private timers = new Map<number, { due: number; fn: () => void }>();
  private saved: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout; now: () => number } | null = null;
  install() {
    if (this.saved) throw new Error('El reloj ya está instalado.');
    this.saved = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, now: Date.now };
    globalThis.setTimeout = ((fn: () => void, ms = 0) => { const id = ++this.seq; this.timers.set(id, { due: this.now + ms, fn }); return id; }) as unknown as typeof setTimeout;
    globalThis.clearTimeout = ((id?: unknown) => { this.timers.delete(id as number); }) as unknown as typeof clearTimeout;
    Date.now = () => this.now;
  }
  uninstall() {
    if (!this.saved) return;
    globalThis.setTimeout = this.saved.setTimeout; globalThis.clearTimeout = this.saved.clearTimeout; Date.now = this.saved.now;
    this.saved = null;
  }
  reset() { this.now = 0; this.timers.clear(); }
  advance(ms: number) {
    const end = this.now + ms;
    for (;;) {
      let next: number | null = null;
      for (const [id, timer] of this.timers) if (timer.due <= end && (next === null || timer.due < this.timers.get(next)!.due)) next = id;
      if (next === null) break;
      const timer = this.timers.get(next)!;
      this.timers.delete(next);
      this.now = Math.max(this.now, timer.due);
      timer.fn();
    }
    this.now = end;
  }
}
const clock = new FakeClock();

const hood = () => useHood.getState();
const lab = () => useLab.getState();

/** Textos fijos de los pasos de cada práctica (título y detalle por clave). Se guardan una vez en `tables.stepTexts`. */
export type StepTexts = Map<string, Map<string, { key: string; title: string; detail: string }>>;
export interface Tables { eventTexts: EventTexts; stepTexts: StepTexts }

/**
 * Estado observable completo. Las claves son los nombres de los campos de los almacenes; los valores,
 * su forma canónica (sin orden de inserción de JavaScript, sin ids ni fechas).
 */
function capture(tables: Tables) {
  const h = hood(), l = lab();
  const def = recipeById(h.recipe?.id);
  for (const entry of h.log) for (const e of entry.events) recordTexts(tables.eventTexts, e);
  let steps: [string, boolean, [string, string][]][] | null = null;
  if (def && h.recipe) {
    let texts = tables.stepTexts.get(def.id);
    if (!texts) tables.stepTexts.set(def.id, texts = new Map());
    steps = recipeSteps(def, h.recipe, h, l.ppe).map(step => {
      const seen = texts.get(step.key);
      if (!seen) texts.set(step.key, { key: step.key, title: step.title, detail: step.detail });
      else if (seen.title !== step.title || seen.detail !== step.detail) throw new Error(`Los textos del paso ${def.id}/${step.key} no son constantes: no se pueden tabular.`);
      return [step.key, step.done, step.targets.map(t => [t.id, t.label] as [string, string])];
    });
  }
  const last = h.records.at(-1);
  return {
    // useLab: sesión, mano activa, protección y mensaje (el HUD lo muestra tal cual).
    mode: l.mode, hand: l.hand, ppe: { goggles: l.ppe.goggles, gloves: l.ppe.gloves }, message: l.message, panel: l.panel, activePractice: l.activePractice,
    locations: { beaker: l.locations.beaker, vinegar: l.locations.vinegar, bicarbonate: l.locations.bicarbonate },
    // useHood. `places` solo lista los frascos que NO están en la estantería, en el orden del estante.
    places: reagentIds.filter(id => h.places[id] !== 'shelf').map(id => [id, h.places[id]] as [string, string]),
    held: { left: h.heldIn('left'), right: h.heldIn('right') },
    cylinder: { reagent: h.cylinder.reagent, ml: h.cylinder.ml, dirty: h.cylinder.dirty },
    balance: { reagent: h.balance.reagent, grams: h.balance.grams },
    pouring: h.pouring ? { reagent: h.pouring.reagent, amount: h.pouring.amount, startedAt: h.pouring.startedAt, stream: !!h.pouring.stream, target: h.pouring.target ?? null } : null,
    transfer: h.transfer ? { kind: h.transfer.kind, reagent: h.transfer.reagent, startedAt: h.transfer.startedAt } : null,
    sash: h.sash, light: h.light, fan: h.fan, stirring: h.stirring, error: h.error, disposals: h.disposals,
    mixture: { ...canonMixture(h.mixture), additions: h.mixture.additions.map(a => ({ reagent: a.reagent, amount: a.amount })) },
    analysis: canonAnalysis(h.mixture),
    log: h.log.map(entry => ({ reagent: entry.reagent, amount: entry.amount, events: entry.events.map(canonEvent), deltaT: entry.deltaT, note: entry.note })),
    // La ráfaga sin su instante: lo que el motor decide (gas, sólido, ΔT, cambio de color) más su decaimiento visual.
    burst: h.burst ? { gasMol: h.burst.gasMol, vigor: h.burst.vigor, solidColor: h.burst.solidColor, deltaT: h.burst.deltaT, colorChange: h.burst.colorChange } : null,
    recipe: h.recipe ? {
      id: h.recipe.id, cleanNeeded: h.recipe.cleanNeeded,
      added: reagentIds.filter(id => h.recipe!.added[id] !== undefined).map(id => [id, h.recipe!.added[id]!] as [string, number]),
      observed: h.recipe.observed, saved: h.recipe.saved, disposed: h.recipe.disposed,
    } : null,
    saved: h.savedAt !== null,
    records: {
      count: h.records.length,
      last: last ? {
        additions: last.additions.map(a => ({ reagent: a.reagent, amount: a.amount })), pH: last.pH, temperatureC: last.temperatureC, volumeMl: last.volumeMl,
        solids: [...last.solids], gases: last.gases.map(g => ({ label: g.label, mol: g.mol })),
        log: last.log.map(l => ({ reagent: l.reagent, amount: l.amount, titles: [...l.titles], equations: [...l.equations] })),
      } : null,
    },
    guidedIndex: hoodGuidedIndex(h),
    steps,
  };
}
export type State = ReturnType<typeof capture>;
export type LogDelta = { caen: number; quedan: number; nuevas: State['log'] };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Cambio del registro: `caen` entradas del principio, `quedan` las siguientes tal cual y se añaden las `nuevas`.
 * Así una entrada nueva, una gota que se funde con la anterior y el tope de 40 entradas ocupan lo mismo.
 */
function logDelta(prev: State['log'], next: State['log']): LogDelta {
  let best: LogDelta | null = null;
  for (let caen = 0; caen <= prev.length; caen++) {
    let quedan = 0;
    while (caen + quedan < prev.length && quedan < next.length && same(prev[caen + quedan], next[quedan])) quedan++;
    if (!best || next.length - quedan < best.nuevas.length) best = { caen, quedan, nuevas: next.slice(quedan) };
  }
  return best!;
}

/** Solo las claves cuyo valor canónico cambia respecto al estado anterior. */
function changes(prev: State, next: State) {
  const cambia: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof State)[]) {
    if (same(prev[key], next[key])) continue;
    cambia[key] = key === 'log' ? logDelta(prev.log, next.log) : next[key];
  }
  return cambia;
}

/**
 * Marcas de fragilidad (las de golden/README.md): resultados discretos del motor químico que un último bit
 * podría cambiar. Se calculan para CADA adición que llega al matraz, también las que ocurren dentro de un
 * `tic` de varios fotogramas, repitiendo la adición con el motor (función pura) para ver sus eventos propios.
 */
let flagged = new Set<string>();
function watchFlags() {
  return useHood.subscribe((state, prev) => {
    if (state.mixture === prev.mixture || !state.mixture.additions.length) return;
    const entry = state.log.at(-1), before = prev.log.at(-1);
    if (!entry) return;
    const amount = before && before.id === entry.id ? entry.amount - before.amount : entry.amount;
    const r = reagents[entry.reagent];
    const total = prev.mixture.waterMl + (r.kind === 'solid' ? 0 : r.kind === 'indicator' ? amount * DROP_ML : amount);
    if (total !== VESSEL_ML && Math.abs(total - VESSEL_ML) < 1e-9) flagged.add('desborde-suma');
    for (const flag of stepFlags(state.mixture, addReagent(prev.mixture, entry.reagent, amount).events, entry.reagent)) flagged.add(flag);
  });
}
/** Un rechazo por desborde: ¿estaba la suma a un bit de 500 mL, o los mL del mensaje a un bit de redondear distinto? */
function overflowFlags(op: OpSpec, prev: State, next: State) {
  if (!next.error.startsWith('El matraz se desbordaría')) return;
  const water = next.mixture.waterMl, amount = typeof op.args?.cantidad === 'number' ? op.args.cantidad : 0;
  const tried = [prev.cylinder.ml, Math.round(prev.cylinder.ml * 10) / 10, amount, amount * DROP_ML, DROP_ML];
  if (tried.some(v => water + v !== VESSEL_ML && Math.abs(water + v - VESSEL_ML) < 1e-9)) flagged.add('desborde-suma');
  if (next.error.includes('ya contiene') && Math.abs(water - Math.floor(water) - 0.5) < 1e-6) flagged.add('error-redondeo-ml');
}

const SASH: SashPosition[] = ['closed', 'work', 'open'];
const STREAM_TARGETS: StreamTarget[] = ['flask', 'cylinder', 'balance'];
function reagent(value: unknown, where: string): ReagentId {
  if (typeof value !== 'string' || !Object.hasOwn(reagents, value)) throw new Error(`${where}: reactivo desconocido «${String(value)}»; el resultado dependería de JavaScript.`);
  return value as ReagentId;
}
function oneOf<T extends string>(value: unknown, allowed: readonly T[], where: string): T {
  if (!allowed.includes(value as T)) throw new Error(`${where}: valor no válido «${String(value)}» (${allowed.join(', ')}).`);
  return value as T;
}
function finite(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${where}: se esperaba un número finito.`);
  return value;
}
const only = (args: Record<string, unknown>, allowed: string[], where: string) => {
  for (const key of Object.keys(args)) if (!allowed.includes(key)) throw new Error(`${where}: argumento desconocido «${key}».`);
};

/** Ejecuta UNA acción real. `advance` solo lo usa `tic`, que avanza el reloj tras cada repetición. */
function execute(op: OpSpec, where: string, advance: () => void): unknown {
  const a = op.args ?? {};
  const allow = (...keys: string[]) => only(a, keys, where);
  switch (op.op) {
    // --- useLab ---
    case 'iniciar': allow('modo'); return void lab().start(oneOf(a.modo, ['free', 'guided', 'tutorial'] as const, where));
    case 'menu': allow(); return void lab().menu();
    case 'mano': allow('mano'); return void lab().selectHand(oneOf(a.mano, ['left', 'right'] as const, where) as Hand);
    case 'usar': allow('objetivo'); if (a.objetivo !== null && typeof a.objetivo !== 'string') throw new Error(`${where}: objetivo no válido.`); lab().setTarget(a.objetivo); return void lab().interact();
    case 'dejar': allow('objetivo'); if (a.objetivo !== null && typeof a.objetivo !== 'string') throw new Error(`${where}: objetivo no válido.`); lab().setTarget(a.objetivo); return void lab().drop();
    case 'cerrarPanel': allow(); return void lab().open(null);
    // --- useHood ---
    // `no-existe` es el único id desconocido admitido: fija que una práctica desconocida equivale a abandonar.
    case 'receta': allow('id'); if (a.id !== null && a.id !== 'no-existe' && !recipeById(a.id as string)) throw new Error(`${where}: práctica desconocida «${String(a.id)}».`); return void hood().selectRecipe(a.id as string | null);
    // Acciones del almacén sin pasar por las teclas E y Q (sin comprobar protección ni mano ocupada).
    case 'cogerFrasco': allow('reactivo', 'mano'); return hood().pick(reagent(a.reactivo, where), oneOf(a.mano, ['left', 'right'] as const, where));
    case 'ponerFrasco': allow('mano', 'donde'); return hood().put(oneOf(a.mano, ['left', 'right'] as const, where), oneOf(a.donde, ['shelf', 'hood'] as const, where));
    case 'ventana': allow('posicion'); return void hood().setSash(oneOf(a.posicion, SASH, where));
    case 'conmutar': allow('clave'); return void hood().toggle(oneOf(a.clave, ['light', 'fan', 'stirring'] as const, where));
    case 'verter': allow('reactivo', 'cantidad'); return hood().pour(reagent(a.reactivo, where), finite(a.cantidad, where));
    case 'chorro': allow('reactivo', 'destino'); return a.destino === undefined ? hood().startStream(reagent(a.reactivo, where)) : hood().startStream(reagent(a.reactivo, where), oneOf(a.destino, STREAM_TARGETS, where));
    case 'tic': {
      allow('segundos', 'veces');
      const seconds = finite(a.segundos, where), times = a.veces === undefined ? 1 : finite(a.veces, where);
      if (!(seconds > 0) || !Number.isInteger(times) || times < 1) throw new Error(`${where}: «tic» necesita segundos > 0 y veces entero ≥ 1.`);
      for (let i = 0; i < times; i++) { hood().streamTick(seconds); advance(); }
      return undefined;
    }
    case 'soltar': allow(); return void hood().stopStream();
    case 'verterProbeta': allow(); return hood().pourCylinder();
    case 'verterBalanza': allow(); return hood().pourBalance();
    case 'enjuagar': allow(); return hood().rinseCylinder();
    case 'desechar': allow(); return hood().dispose();
    case 'vaciar': allow(); return void hood().empty();
    case 'guardar': allow(); return void hood().save();
    case 'devolverBandeja': allow(); return void hood().returnAll();
    case 'reiniciar': allow(); return void hood().resetSession();
    case 'cancelar': allow(); return void hood().cancelPour();
    case 'esperar': allow(); return undefined;
    default: throw new Error(`${where}: operación desconocida «${String((op as { op: string }).op)}».`);
  }
}

function check(debe: Debe, ret: unknown, state: State, where: string) {
  const fail = (text: string) => { throw new Error(`${where}: ${text}`); };
  if (typeof debe.devuelve === 'boolean' && ret !== debe.devuelve) fail(`debía devolver ${debe.devuelve} y devolvió ${String(ret)} (error: «${state.error}»).`);
  if (typeof debe.devuelve === 'string' && !(typeof ret === 'string' && ret.includes(debe.devuelve))) fail(`debía devolver un texto con «${debe.devuelve}» y devolvió «${String(ret)}».`);
  const text = (name: string, got: string, want: string | undefined) => {
    if (want === undefined) return;
    if (want === '' ? got !== '' : !got.includes(want)) fail(`${name} debía ${want === '' ? 'estar vacío' : `contener «${want}»`} y es «${got}».`);
  };
  text('el error de la campana', state.error, debe.error);
  text('el mensaje', state.message, debe.mensaje);
  const needsSteps = debe.actual !== undefined || debe.objetivos || debe.etiqueta !== undefined || debe.hechos || debe.pendientes || debe.paso;
  if (!needsSteps) return;
  if (!state.steps) fail('se esperaban pasos de práctica y no hay ninguna elegida.');
  const steps = state.steps!;
  const current = steps.find(step => !step[1]);
  const summary = steps.map(step => `${step[0]}${step[1] ? '✓' : ''}`).join(' ');
  if (debe.actual !== undefined && (current?.[0] ?? 'fin') !== debe.actual) fail(`el paso actual debía ser ${debe.actual} y es ${current?.[0] ?? 'fin'} (${summary}).`);
  if (debe.objetivos && !same(current?.[2].map(t => t[0]) ?? [], debe.objetivos)) fail(`los objetivos debían ser [${debe.objetivos.join(', ')}] y son [${(current?.[2] ?? []).map(t => t[0]).join(', ')}].`);
  if (debe.etiqueta !== undefined && !(current?.[2][0]?.[1] ?? '').includes(debe.etiqueta)) fail(`la etiqueta debía contener «${debe.etiqueta}» y es «${current?.[2][0]?.[1] ?? ''}».`);
  for (const key of debe.hechos ?? []) if (!steps.find(step => step[0] === key)?.[1]) fail(`el paso ${key} debía estar hecho (${summary}).`);
  for (const key of debe.pendientes ?? []) if (steps.find(step => step[0] === key)?.[1] !== false) fail(`el paso ${key} debía estar sin hacer (${summary}).`);
  if (debe.paso) {
    const step = steps.find(item => item[0] === debe.paso!.clave);
    if (!step) fail(`no existe el paso ${debe.paso.clave} (${summary}).`);
    if (debe.paso.hecho !== undefined && step![1] !== debe.paso.hecho) fail(`el paso ${debe.paso.clave} debía estar ${debe.paso.hecho ? 'hecho' : 'sin hacer'} (${summary}).`);
    if (debe.paso.etiqueta !== undefined && !(step![2][0]?.[1] ?? '').includes(debe.paso.etiqueta)) fail(`la etiqueta de ${debe.paso.clave} debía contener «${debe.paso.etiqueta}» y es «${step![2][0]?.[1] ?? ''}».`);
  }
}

/** Deja los almacenes en el estado de partida de TODOS los casos: sesión libre recién iniciada, sin protección. */
function begin(tables: Tables): State {
  clock.reset();
  // Preparación del arnés, no regla de juego: tutorial ya visto y cuadernos vacíos (lo demás lo hace `start`).
  useLab.setState({ tutorialDone: true, records: [] });
  lab().start('free');
  useHood.setState({ records: [] });
  return capture(tables);
}

export interface OpRecord { op: OpName; args?: OpSpec['args']; avanzaMs?: number; t: number; devuelve?: unknown; flags?: string[]; cambia: Record<string, unknown> }
export interface CaseResult { record: { id: string; family: string; why: string; ops: OpRecord[] }; ops: number; used: Set<OpName>; errors: Set<string>; messages: Set<string> }

function runCase(spec: StepCaseSpec, tables: Tables): CaseResult {
  if (!spec.ops.length) throw new Error(`${spec.id}: el caso no tiene operaciones.`);
  let state = begin(tables);
  const used = new Set<OpName>(), errors = new Set<string>(), messages = new Set<string>();
  const ops = spec.ops.map((op, i) => {
    const where = `${spec.id} op ${i + 1} (${op.op})`;
    const ms = op.avanzaMs ?? 0;
    if (!Number.isInteger(ms) || ms < 0) throw new Error(`${where}: avanzaMs debe ser un entero ≥ 0.`);
    let ticked = false;
    flagged = new Set();
    const ret = execute(op, where, () => { ticked = true; clock.advance(ms); });
    if (!ticked) clock.advance(ms);
    const next = capture(tables);
    if (op.debe) check(op.debe, ret, next, where);
    overflowFlags(op, state, next);
    const flags = [...flagged].sort();
    const record: OpRecord = { op: op.op, ...(op.args ? { args: op.args } : {}), ...(ms ? { avanzaMs: ms } : {}), t: clock.now, ...(ret !== undefined ? { devuelve: ret } : {}), ...(flags.length ? { flags } : {}), cambia: changes(state, next) };
    state = next;
    used.add(op.op);
    if (state.error) errors.add(state.error);
    if (state.message) messages.add(state.message);
    return record;
  });
  return { record: { id: spec.id, family: spec.id.split('/')[0], why: spec.why, ops }, ops: ops.length, used, errors, messages };
}

/** Ejecuta todos los casos con el reloj controlado y devuelve además el estado de partida común. */
export function runCases(specs: StepCaseSpec[], tables: Tables) {
  clock.install();
  const unwatch = watchFlags();
  try {
    const initial = begin(tables);
    const results = specs.map(spec => runCase(spec, tables));
    // No dejar nada pendiente ni a medias para otras pruebas del mismo proceso (bun comparte módulos).
    begin(tables);
    return { initial, results };
  } finally { unwatch(); clock.uninstall(); }
}
