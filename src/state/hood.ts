import { create } from 'zustand';
import { addReagent, analyzeMixture, emptyMixture, VESSEL_ML, type Addition, type Mixture, type SandboxEvent } from '../chemistry/sandbox';
import { reagentIds, reagents, type ReagentId } from '../chemistry/reagents';
import { species } from '../chemistry/species';
import { recipeById, type HoodRecipe } from '../experiments/hoodRecipes';

export type Hand = 'left' | 'right';
export type ReagentPlace = 'shelf' | 'hood' | Hand;
export type SashPosition = 'closed' | 'work' | 'open';
/** Where a continuous pour goes: indicators drop straight into the flask; liquids are measured in the cylinder; solids weighed. */
export type StreamTarget = 'flask' | 'cylinder' | 'balance' | 'pipette';
/** Timed transfers animated in the hood. */
export type Transfer = 'bottle' | 'cylinder' | 'balance' | 'waste' | 'rinse' | 'pipette';
export const HOOD_TRAY_SLOTS = 8;
export const POUR_MS = 1500;
export const CYLINDER_ML = 100;
/** 10 mL graduated pipette: stored in its wall cabinet until the player brings it to the hood. */
export const PIPETTE_ML = 10;
export const PIPETTE_RATE = 2;
export type PipettePlace = 'cabinet' | 'hood' | Hand;
export interface HoodLogEntry { id: string; at: number; reagent: ReagentId; amount: number; events: SandboxEvent[]; deltaT: number; note: string }
/** Last visible change, used by the 3D scene to animate gas, precipitates and heat. */
export interface HoodBurst { at: number; gasMol: number; vigor: number; solidColor: string | null; deltaT: number; colorChange: boolean }
export interface HoodRecord {
  id: string; at: string; observation: string; additions: Addition[];
  pH: number | null; temperatureC: number; volumeMl: number; solids: string[]; gases: { label: string; mol: number }[];
  log: { reagent: ReagentId; amount: number; titles: string[]; equations: string[] }[];
}
/** Progress of the selected guided experiment; sticky so disposing the mixture does not undo finished steps. */
export interface RecipeRun { id: string; cleanNeeded: boolean; added: Partial<Record<ReagentId, number>>; observed: boolean; saved: boolean; disposed: boolean; completedAt: number | null }
interface HoodState {
  places: Record<ReagentId, ReagentPlace>;
  mixture: Mixture; log: HoodLogEntry[]; burst: HoodBurst | null;
  pouring: { reagent: ReagentId; amount: number; startedAt: number; stream?: boolean; target?: StreamTarget } | null;
  transfer: { kind: Transfer; reagent: ReagentId | null; startedAt: number } | null;
  /** 100 mL graduated cylinder: what it holds and the residue of the last reagent until rinsed. */
  cylinder: { reagent: ReagentId | null; ml: number; dirty: ReagentId | null };
  /** Balance with weighing boat (automatically tared). */
  balance: { reagent: ReagentId | null; grams: number };
  /** Where the pipette is, what it holds and the residue of the last reagent until rinsed. */
  pipette: { place: PipettePlace; reagent: ReagentId | null; ml: number; dirty: ReagentId | null };
  disposals: number; recipe: RecipeRun | null;
  sash: SashPosition; light: boolean; fan: boolean; stirring: boolean;
  records: HoodRecord[]; savedAt: string | null; error: string;
  heldIn: (hand: Hand) => ReagentId | null;
  pick: (id: ReagentId, hand: Hand) => string;
  put: (hand: Hand, where: 'shelf' | 'hood') => string;
  pour: (id: ReagentId, amount: number) => boolean;
  startStream: (id: ReagentId, target?: StreamTarget) => boolean; streamTick: (seconds: number) => void; stopStream: () => void;
  takePipette: (hand: Hand) => string; putPipette: (hand: Hand, where: 'cabinet' | 'hood') => string; pourPipette: () => boolean;
  pourCylinder: () => boolean; pourBalance: () => boolean; rinseCylinder: () => boolean; dispose: () => boolean;
  selectRecipe: (id: string | null) => void;
  empty: () => void; setSash: (sash: SashPosition) => void; toggleSash: () => string;
  toggle: (key: 'light' | 'fan' | 'stirring') => void;
  save: () => void; annotate: (id: string, observation: string) => void;
  returnAll: () => void; resetSession: () => void; cancelPour: () => void;
}
const STORAGE = 'experimenta.hood.v1';
function loadRecords(): HoodRecord[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    return Array.isArray(data) ? data.filter(r => r && typeof r.id === 'string' && typeof r.at === 'string' && typeof r.observation === 'string' && Array.isArray(r.additions) && Array.isArray(r.log)).slice(-30) : [];
  } catch { return []; }
}
function saveRecords(records: HoodRecord[]) { try { localStorage.setItem(STORAGE, JSON.stringify(records)); } catch { /* Continue in memory. */ } }
const shelfPlaces = () => Object.fromEntries(reagentIds.map(id => [id, 'shelf'])) as Record<ReagentId, ReagentPlace>;
let pourTimer: ReturnType<typeof setTimeout> | undefined;
let entryCount = 0;
/** Continuous pouring rates (per second) and the size of each chemistry step that reaches the flask. */
export const STREAM = { solution: { rate: 15, step: 2.5 }, water: { rate: 15, step: 2.5 }, solid: { rate: 1, step: 0.1 }, indicator: { rate: 2, step: 1 } } as const;
/** Filling the cylinder is slower (careful pouring); the spatula speeds up the longer it is held. */
export const CYLINDER_RATE = 8;
export const spatulaRate = (heldSeconds: number) => Math.min(1, 0.25 + heldSeconds * 0.3);
let stream = { pending: 0, entryId: '', additionIndex: -1 };
function mergeEvents(a: SandboxEvent[], b: SandboxEvent[]) {
  const out = a.map(e => ({ ...e }));
  for (const e of b) {
    const same = out.find(x => x.rule === e.rule && x.kind === e.kind);
    if (!same) { out.push({ ...e }); continue; }
    same.extent += e.extent; same.heat = same.heat === null || e.heat === null ? null : same.heat + e.heat;
    if (same.gas && e.gas) same.gas = { ...same.gas, mol: same.gas.mol + e.gas.mol };
    if (same.solid && e.solid) same.solid = { ...same.solid, mol: same.solid.mol + e.solid.mol };
  }
  return out;
}
const amountText = (id: ReagentId, amount: number) => {
  const r = reagents[id]; const n = amount.toLocaleString('es', { maximumFractionDigits: 2 });
  return r.kind === 'solid' ? `${n} g` : r.kind === 'indicator' ? `${n} gotas` : `${n} mL`;
};
const emptyTools = () => ({ cylinder: { reagent: null, ml: 0, dirty: null }, balance: { reagent: null, grams: 0 }, pipette: { place: 'cabinet' as PipettePlace, reagent: null, ml: 0, dirty: null } });

export const useHood = create<HoodState>((set, get) => {
/** Adds an amount to the flask and records what happened; `merge` joins it with the running stream. */
const apply = (id: ReagentId, amount: number, merge: boolean) => {
  const current = get();
  try {
    const before = analyzeMixture(current.mixture).color.color;
    const out = addReagent(current.mixture, id, amount);
    const after = analyzeMixture(out.mixture);
    const mixture = out.mixture;
    if (merge && stream.additionIndex >= 0 && stream.additionIndex === mixture.additions.length - 2) {
      const prev = mixture.additions[stream.additionIndex];
      mixture.additions = [...mixture.additions.slice(0, -2), { reagent: id, amount: Math.round((prev.amount + amount) * 1000) / 1000 }];
    }
    if (merge) stream.additionIndex = mixture.additions.length - 1;
    const gasMol = out.events.reduce((sum, e) => sum + (e.gas?.mol ?? 0), 0);
    const formed = out.events.find(e => e.kind === 'precipitado' || (e.solid && e.kind !== 'disolución'));
    const vigor = out.events.reduce((max, e) => Math.max(max, e.gas ? e.vigor : 0), 0);
    let log = current.log;
    const last = log.at(-1);
    if (merge && last && last.id === stream.entryId) {
      log = [...log.slice(0, -1), { ...last, amount: last.amount + amount, events: mergeEvents(last.events, out.events), deltaT: last.deltaT + out.deltaT, note: out.events.length ? '' : last.events.length ? '' : out.note }];
    } else {
      const entry: HoodLogEntry = { id: `pour-${Date.now()}-${entryCount++}`, at: Date.now(), reagent: id, amount, events: out.events, deltaT: out.deltaT, note: out.note };
      if (merge) stream.entryId = entry.id;
      log = [...log, entry].slice(-40);
    }
    let recipe = current.recipe;
    if (recipe) {
      const def = recipeById(recipe.id);
      const observed = recipe.observed || (!!def && def.expect.every(rule => log.some(l => l.events.some(e => e.rule === rule))));
      recipe = { ...recipe, added: { ...recipe.added, [id]: (recipe.added[id] ?? 0) + amount }, observed };
    }
    const keep = current.burst && Date.now() - current.burst.at < 1500 && !gasMol && !formed;
    set({ mixture, log, recipe, savedAt: null, ...(current.pouring?.stream ? { pouring: { ...current.pouring, amount: current.pouring.amount + amount } } : {}),
      burst: keep ? current.burst : { at: Date.now(), gasMol: Math.max(gasMol, current.burst && merge && Date.now() - current.burst.at < 2000 ? current.burst.gasMol * 0.8 : 0), vigor: Math.max(vigor, merge && current.burst ? current.burst.vigor * 0.9 : 0), solidColor: formed?.solid ? species[formed.solid.id].color ?? '#f2f2ee' : null, deltaT: out.deltaT, colorChange: before !== after.color.color } });
    return true;
  } catch (e) { set({ error: (e as Error).message, pouring: null }); return false; }
};
/** Runs a timed transfer animation, then its effect. */
const transferThen = (kind: Transfer, reagent: ReagentId | null, effect: () => void) => {
  clearTimeout(pourTimer);
  set({ transfer: { kind, reagent, startedAt: Date.now() }, error: '' });
  pourTimer = setTimeout(() => { if (get().transfer?.kind === kind) { effect(); set({ transfer: null }); } }, kind === 'rinse' ? 900 : POUR_MS);
};
const busy = () => !!get().pouring || !!get().transfer;
return {
  places: shelfPlaces(), mixture: emptyMixture(), log: [], burst: null, pouring: null, transfer: null, ...emptyTools(), disposals: 0, recipe: null,
  sash: 'work', light: true, fan: true, stirring: false, records: loadRecords(), savedAt: null, error: '',
  heldIn: hand => reagentIds.find(id => get().places[id] === hand) ?? null,
  pick: (id, hand) => {
    const s = get();
    if (s.pouring?.reagent === id) return 'Espera a que termine el vertido.';
    if (s.places[id] === 'left' || s.places[id] === 'right') return `${reagents[id].name} ya está en tu mano.`;
    set({ places: { ...s.places, [id]: hand } });
    return `${reagents[id].name} en la mano ${hand === 'left' ? 'izquierda' : 'derecha'}. Llévalo a la campana.`;
  },
  put: (hand, where) => {
    const s = get(); const id = s.heldIn(hand);
    if (!id) return 'La mano seleccionada no sostiene un frasco.';
    if (where === 'hood' && reagentIds.filter(r => s.places[r] === 'hood').length >= HOOD_TRAY_SLOTS) return `La bandeja de la campana admite ${HOOD_TRAY_SLOTS} frascos. Devuelve alguno a la estantería.`;
    set({ places: { ...s.places, [id]: where } });
    return where === 'shelf' ? `${reagents[id].name} devuelto a la estantería, tapado.` : `${reagents[id].name} colocado en la bandeja de la campana.`;
  },
  /** Exact transfer of a known amount straight to the flask (kept for scripted flows and tests). */
  pour: (id, amount) => {
    const s = get();
    if (busy()) return false;
    if (s.places[id] === 'shelf') { set({ error: 'Ese frasco está en la estantería: tráelo a la campana.' }); return false; }
    if (s.sash === 'closed') { set({ error: 'La ventana está cerrada. Súbela a la altura de trabajo para trabajar dentro.' }); return false; }
    try { addReagent(s.mixture, id, amount); } catch (e) { set({ error: (e as Error).message }); return false; }
    set({ pouring: { reagent: id, amount, startedAt: Date.now() }, error: '' });
    clearTimeout(pourTimer);
    pourTimer = setTimeout(() => { if (get().pouring?.reagent === id && !get().pouring?.stream) { apply(id, amount, false); set({ pouring: null }); } }, POUR_MS);
    return true;
  },
  startStream: (id, target = 'flask') => {
    const s = get(); const r = reagents[id];
    if (busy() || s.places[id] === 'shelf') return false;
    if (s.sash === 'closed') { set({ error: 'La ventana está cerrada. Súbela a la altura de trabajo para trabajar dentro.' }); return false; }
    // As in a real lab: liquids are measured in the cylinder, solids weighed, indicators added drop by drop.
    if (target === 'flask' && r.kind !== 'indicator') { set({ error: r.kind === 'solid' ? `Pesa primero ${r.name} en la balanza y luego añádelo al matraz.` : `Mide primero ${r.name} en la probeta graduada y luego viértela en el matraz.` }); return false; }
    if (target === 'cylinder') {
      if (r.kind === 'solid' || r.kind === 'indicator') { set({ error: r.kind === 'solid' ? 'Los sólidos se pesan en la balanza.' : 'Los indicadores se añaden gota a gota directamente al matraz.' }); return false; }
      if (s.cylinder.ml > 0.05 && s.cylinder.reagent !== id) { set({ error: `La probeta contiene ${reagents[s.cylinder.reagent!].name}: viértela en el matraz o enjuágala antes.` }); return false; }
      if (s.cylinder.ml <= 0.05 && s.cylinder.dirty && s.cylinder.dirty !== id) { set({ error: `La probeta tiene restos de ${reagents[s.cylinder.dirty].name}. Enjuágala con la piseta antes de medir otro reactivo.` }); return false; }
      if (s.cylinder.ml >= CYLINDER_ML - 0.05) { set({ error: 'La probeta está llena (100 mL).' }); return false; }
    }
    if (target === 'pipette') {
      const p = s.pipette;
      if (p.place !== 'hood') { set({ error: 'La pipeta no está en su soporte. Tráela del gabinete de pipetas.' }); return false; }
      if (r.kind === 'solid' || r.kind === 'indicator') { set({ error: r.kind === 'solid' ? 'Los sólidos se pesan en la balanza.' : 'Los indicadores se añaden gota a gota directamente al matraz.' }); return false; }
      if (p.ml > 0.05 && p.reagent !== id) { set({ error: `La pipeta contiene ${reagents[p.reagent!].name}: descárgala en el matraz o enjuágala antes.` }); return false; }
      if (p.ml <= 0.05 && p.dirty && p.dirty !== id) { set({ error: `La pipeta tiene restos de ${reagents[p.dirty].name}. Enjuágala con la piseta antes de usar otro reactivo.` }); return false; }
      if (p.ml >= PIPETTE_ML - 0.005) { set({ error: 'La pipeta está llena (10 mL).' }); return false; }
    }
    if (target === 'balance') {
      if (r.kind !== 'solid') { set({ error: 'En la balanza solo se pesan sólidos.' }); return false; }
      if (s.balance.grams > 0.001 && s.balance.reagent !== id) { set({ error: `La balanza tiene ${reagents[s.balance.reagent!].name}: añádelo al matraz antes de pesar otro sólido.` }); return false; }
    }
    stream = { pending: 0, entryId: '', additionIndex: -1 };
    set({ pouring: { reagent: id, amount: 0, startedAt: Date.now(), stream: true, target }, error: '' });
    return true;
  },
  streamTick: seconds => {
    const p = get().pouring; if (!p?.stream) return;
    const r = reagents[p.reagent];
    // The first 0,3 s tilt the bottle (or load the spatula) before anything flows.
    const held = (Date.now() - p.startedAt) / 1000; if (held < 0.3) return;
    if (p.target === 'cylinder') {
      const c = get().cylinder; const ml = Math.min(CYLINDER_ML, c.ml + CYLINDER_RATE * seconds);
      set({ cylinder: { reagent: p.reagent, ml, dirty: p.reagent }, pouring: { ...p, amount: ml } });
      if (ml >= CYLINDER_ML) set({ pouring: null, error: 'La probeta está llena (100 mL).' });
      return;
    }
    if (p.target === 'pipette') {
      const t = get().pipette; const ml = Math.min(PIPETTE_ML, t.ml + PIPETTE_RATE * seconds);
      set({ pipette: { ...t, reagent: p.reagent, ml, dirty: p.reagent }, pouring: { ...p, amount: ml } });
      if (ml >= PIPETTE_ML) set({ pouring: null, error: 'La pipeta está llena (10 mL).' });
      return;
    }
    if (p.target === 'balance') {
      const max = r.kind === 'solid' ? r.max : 10; const b = get().balance; const grams = Math.min(max, b.grams + spatulaRate(held) * seconds);
      set({ balance: { reagent: p.reagent, grams }, pouring: { ...p, amount: grams } });
      if (grams >= max) set({ pouring: null, error: `Máximo para este experimento: ${max} g.` });
      return;
    }
    const { rate, step } = STREAM[r.kind];
    stream.pending += rate * seconds;
    while (stream.pending >= step && get().pouring?.stream) {
      stream.pending -= step;
      if (!apply(p.reagent, step, true)) { set({ pouring: null }); return; }
    }
  },
  stopStream: () => { if (get().pouring?.stream) set({ pouring: null }); stream = { pending: 0, entryId: '', additionIndex: -1 }; },
  pourCylinder: () => {
    const s = get(); const { reagent, ml } = s.cylinder;
    if (busy()) return false;
    if (!reagent || ml < 1) { set({ error: 'La probeta está vacía. Llénala vertiendo un frasco sobre ella (mantén el clic).' }); return false; }
    if (s.sash === 'closed') { set({ error: 'La ventana está cerrada. Súbela para trabajar dentro.' }); return false; }
    if (s.mixture.waterMl + ml > VESSEL_ML) { set({ error: `El matraz se desbordaría: caben ${VESSEL_ML} mL.` }); return false; }
    const amount = Math.round(ml * 10) / 10;
    transferThen('cylinder', reagent, () => { if (apply(reagent, amount, false)) set({ cylinder: { reagent: null, ml: 0, dirty: reagent } }); });
    return true;
  },
  takePipette: hand => {
    const s = get();
    if (busy()) return 'Espera a que termine el vertido.';
    if (s.pipette.place === 'left' || s.pipette.place === 'right') return 'La pipeta ya está en tu mano.';
    set({ pipette: { ...s.pipette, place: hand } });
    return `Pipeta de 10 mL en la mano ${hand === 'left' ? 'izquierda' : 'derecha'}. Llévala a su soporte en la campana.`;
  },
  putPipette: (hand, where) => {
    const s = get();
    if (s.pipette.place !== hand) return 'La mano seleccionada no sostiene la pipeta.';
    if (where === 'cabinet' && s.pipette.ml > 0.05) return 'La pipeta contiene líquido: descárgala en el matraz antes de guardarla.';
    set({ pipette: { ...s.pipette, place: where } });
    return where === 'hood' ? 'Pipeta colocada en su soporte de la campana.' : 'Pipeta guardada en su gabinete.';
  },
  pourPipette: () => {
    const s = get(); const { reagent, ml, place } = s.pipette;
    if (busy()) return false;
    if (place !== 'hood') { set({ error: 'El soporte está vacío. Trae la pipeta del gabinete de pipetas.' }); return false; }
    if (!reagent || ml < 0.1) { set({ error: 'La pipeta está vacía. Con un frasco en la mano, mantén el clic sobre ella para aspirar.' }); return false; }
    if (s.sash === 'closed') { set({ error: 'La ventana está cerrada. Súbela para trabajar dentro.' }); return false; }
    if (s.mixture.waterMl + ml > VESSEL_ML) { set({ error: `El matraz se desbordaría: caben ${VESSEL_ML} mL.` }); return false; }
    const amount = Math.round(ml * 10) / 10;
    transferThen('pipette', reagent, () => { if (apply(reagent, amount, false)) set({ pipette: { ...get().pipette, reagent: null, ml: 0, dirty: reagent } }); });
    return true;
  },
  pourBalance: () => {
    const s = get(); const { reagent, grams } = s.balance;
    if (busy()) return false;
    if (!reagent || grams < 0.05) { set({ error: 'No hay sólido pesado. Con el frasco en la mano, mantén el clic sobre la balanza para añadirlo con la espátula.' }); return false; }
    const amount = Math.round(grams * 100) / 100;
    transferThen('balance', reagent, () => { if (apply(reagent, amount, false)) set({ balance: { reagent: null, grams: 0 } }); });
    return true;
  },
  rinseCylinder: () => {
    const s = get(); if (busy()) return false;
    const pipetteDirty = s.pipette.place === 'hood' && (!!s.pipette.dirty || s.pipette.ml > 0.05);
    if (!s.cylinder.dirty && s.cylinder.ml <= 0.05 && !pipetteDirty) { set({ error: 'La probeta ya está limpia.' }); return false; }
    // The wash bottle rinses the cylinder and, if it is on its stand, the pipette too.
    transferThen('rinse', null, () => set({ cylinder: { reagent: null, ml: 0, dirty: null }, ...(pipetteDirty ? { pipette: { ...get().pipette, reagent: null, ml: 0, dirty: null } } : {}) }));
    return true;
  },
  dispose: () => {
    const s = get(); if (busy()) return false;
    if (!s.mixture.additions.length) { set({ error: 'El matraz está vacío.' }); return false; }
    transferThen('waste', null, () => {
      const r = get().recipe;
      const recipe = r ? r.cleanNeeded ? { ...r, cleanNeeded: false, added: {}, observed: false } : { ...r, disposed: r.observed || r.disposed } : null;
      set({ mixture: emptyMixture(), log: [], burst: null, savedAt: null, disposals: get().disposals + 1, recipe });
    });
    return true;
  },
  selectRecipe: id => {
    const def = recipeById(id);
    set({ recipe: def ? { id: def.id, cleanNeeded: get().mixture.additions.length > 0, added: {}, observed: false, saved: false, disposed: false, completedAt: null } : null, error: '' });
  },
  empty: () => { clearTimeout(pourTimer); set({ mixture: emptyMixture(), log: [], burst: null, pouring: null, transfer: null, savedAt: null, error: '', disposals: get().disposals + 1 }); },
  setSash: sash => set({ sash }),
  toggleSash: () => {
    const sash = get().sash === 'open' ? 'work' : 'open'; set({ sash });
    return sash === 'open' ? 'Ventana subida por completo: úsala para colocar material y bájala antes de mezclar.' : 'Ventana a la altura de trabajo: protege tu cara mientras mezclas.';
  },
  toggle: key => set({ [key]: !get()[key] } as Partial<HoodState>),
  save: () => {
    const s = get(); if (!s.mixture.additions.length) return;
    const a = analyzeMixture(s.mixture); const at = new Date().toISOString();
    const record: HoodRecord = {
      id: `hood-${Date.now()}-${s.records.length}`, at, observation: '', additions: s.mixture.additions,
      pH: a.pH, temperatureC: a.temperatureC, volumeMl: a.volumeMl, solids: a.solids.map(x => x.label), gases: a.gases.map(g => ({ label: g.label, mol: g.mol })),
      log: s.log.map(l => ({ reagent: l.reagent, amount: l.amount, titles: l.events.map(e => e.title), equations: l.events.map(e => e.equation) })),
    };
    const records = [...s.records, record].slice(-30); saveRecords(records);
    set({ records, savedAt: at, recipe: s.recipe ? { ...s.recipe, saved: true } : null });
  },
  annotate: (id, observation) => { const records = get().records.map(r => r.id === id ? { ...r, observation } : r); saveRecords(records); set({ records }); },
  returnAll: () => { const s = get(); set({ places: Object.fromEntries(reagentIds.map(id => [id, s.places[id] === 'hood' ? 'shelf' : s.places[id]])) as Record<ReagentId, ReagentPlace> }); },
  resetSession: () => { clearTimeout(pourTimer); set({ places: shelfPlaces(), mixture: emptyMixture(), log: [], burst: null, pouring: null, transfer: null, ...emptyTools(), disposals: 0, recipe: null, sash: 'work', light: true, fan: true, stirring: false, savedAt: null, error: '' }); },
  cancelPour: () => { clearTimeout(pourTimer); stream = { pending: 0, entryId: '', additionIndex: -1 }; set({ pouring: null, transfer: null }); },
};
});
export { amountText };
/** Free-mixing guided track (no recipe): 0 pick a bottle, 1 bring it to the hood, 2 mix and observe, 3 record. */
export function hoodGuidedIndex(s: Pick<HoodState, 'places' | 'mixture' | 'log'>) {
  const reacted = s.log.some(l => l.events.length > 0);
  if (s.mixture.additions.length >= 2 && reacted) return 3;
  if (s.mixture.additions.length) return 2;
  return reagentIds.some(id => s.places[id] !== 'shelf') ? 1 : 0;
}

/** A step of the selected experiment, with the scene targets that should carry a guide arrow. */
export interface RecipeStep { key: string; title: string; detail: string; done: boolean; targets: { id: string; label: string }[] }
const toolTarget = { probeta: 'hood-cylinder', balanza: 'hood-balance', gotero: 'hood' } as const;
/** Derives the procedure for a recipe from the real state: protection, reagents, measuring, observing, recording and waste. */
export function recipeSteps(def: HoodRecipe, run: RecipeRun, s: Pick<HoodState, 'places' | 'cylinder' | 'balance' | 'mixture'>, ppe: { goggles: boolean; gloves: boolean }): RecipeStep[] {
  const steps: RecipeStep[] = [];
  const inHand = (id: ReagentId) => s.places[id] === 'left' || s.places[id] === 'right';
  steps.push({ key: 'ppe', title: 'Ponte gafas y guantes', detail: 'Estación de protección junto a la puerta.', done: ppe.goggles && ppe.gloves,
    targets: [...(!ppe.goggles ? [{ id: 'ppe-goggles', label: 'Gafas' }] : []), ...(!ppe.gloves ? [{ id: 'ppe-gloves', label: 'Guantes' }] : [])] });
  if (run.cleanNeeded) steps.push({ key: 'clean', title: 'Vacía el matraz en residuos', detail: 'Empieza siempre con el material limpio.', done: false, targets: [{ id: 'hood-waste', label: 'Residuos' }] });
  const reagentsNeeded = [...new Set(def.adds.map(a => a.reagent))];
  const pending = reagentsNeeded.filter(id => s.places[id] === 'shelf' && (run.added[id] ?? 0) < (def.adds.find(a => a.reagent === id)!.amount * 0.9));
  steps.push({ key: 'collect', title: 'Reúne los reactivos', detail: reagentsNeeded.map(id => reagents[id].name).join(' · '), done: pending.length === 0,
    targets: pending.map(id => ({ id: `reagent:${id}`, label: reagents[id].name })) });
  def.adds.forEach((add, i) => {
    const r = reagents[add.reagent]; const amount = amountText(add.reagent, add.amount);
    const done = (run.added[add.reagent] ?? 0) >= add.amount * 0.9;
    let targets: { id: string; label: string }[] = [];
    if (!done) {
      if (add.tool === 'probeta') {
        const measured = s.cylinder.reagent === add.reagent && s.cylinder.ml >= add.amount * 0.9;
        if (measured) targets = [{ id: 'hood-cylinder', label: 'E · Verter en el matraz' }];
        else if (s.cylinder.ml <= 0.05 && s.cylinder.dirty && s.cylinder.dirty !== add.reagent) targets = [{ id: 'hood-washbottle', label: 'Enjuaga la probeta' }];
        else if (inHand(add.reagent)) targets = [{ id: 'hood-cylinder', label: `Llena hasta ${amount}` }];
        else targets = [{ id: `reagent:${add.reagent}`, label: r.name }];
      } else if (add.tool === 'balanza') {
        const weighed = s.balance.reagent === add.reagent && s.balance.grams >= add.amount * 0.9;
        targets = weighed ? [{ id: 'hood-balance', label: 'E · Añadir al matraz' }] : inHand(add.reagent) ? [{ id: 'hood-balance', label: `Pesa ${amount}` }] : [{ id: `reagent:${add.reagent}`, label: r.name }];
      } else targets = inHand(add.reagent) ? [{ id: toolTarget.gotero, label: `${amount} al matraz` }] : [{ id: `reagent:${add.reagent}`, label: r.name }];
    }
    const verb = add.tool === 'probeta' ? `Mide ${amount} de ${r.name} en la probeta y viértelos en el matraz` : add.tool === 'balanza' ? `Pesa ${amount} de ${r.name} en la balanza y añádelos al matraz` : `Añade ${amount} de ${r.name} con el gotero`;
    steps.push({ key: `add-${i}`, title: verb, detail: add.tool === 'probeta' ? 'Mantén el clic sobre la probeta y lee la marca.' : add.tool === 'balanza' ? 'Mantén el clic sobre la balanza para usar la espátula.' : 'Mantén el clic sobre el matraz: cae una gota cada medio segundo.', done, targets });
  });
  steps.push({ key: 'observe', title: 'Observa el resultado', detail: def.observe, done: run.observed, targets: [{ id: 'hood', label: 'Observa' }] });
  steps.push({ key: 'save', title: 'Anótalo en el cuaderno', detail: 'E en la campana → «Guardar en el cuaderno».', done: run.saved || run.disposed, targets: [{ id: 'hood', label: 'E · Guardar' }] });
  steps.push({ key: 'dispose', title: 'Desecha la mezcla en residuos', detail: def.waste, done: run.disposed, targets: [{ id: 'hood-waste', label: 'E · Residuos' }] });
  return steps;
}
