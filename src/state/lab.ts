import { create } from 'zustand';
import { calculateReaction, type ReactionInput } from '../chemistry/reaction';
import { items, type ItemId } from '../experiments/definitions';
import { placementSurface, surfaceNames, type Place } from '../experiments/surfaces';
import { usePractices } from './practices';
import { useHood } from './hood';
import { cabinets, exhibits, useStorage, VITRINE } from './storage';
import type { ReagentId } from '../chemistry/reagents';
import type { PracticeId } from '../experiments/catalog';
type Mode = 'guided' | 'free' | 'tutorial';
export type ActivePractice = 'reaction' | PracticeId | 'hood';
/** Hood targets: shelf bottles (`reagent:<id>`), the shelving, the hood work area and its sash handle. */
export const isHoodTarget = (id: string | null) => !!id && (id.startsWith('reagent:') || id.startsWith('hood') || id.startsWith('ppe-') || id === 'reagent-shelf' || id === 'recipe-board');
/** Personal protective equipment: required before handling the shelf reagents, as in a real lab. */
export interface Ppe { goggles: boolean; gloves: boolean }
export interface RecordEntry { at: string; input: ReactionInput; result: ReturnType<typeof calculateReaction>; observation: string }
function readSaved<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
interface LabState {
  mode: Mode | null; requestedMode: Mode; locked: boolean; panel: 'station' | 'results' | 'notebook' | 'periodic' | 'conductivity' | 'dissolution' | 'experiments' | 'hood' | 'recipes' | null;
  activePractice: ActivePractice; selectPractice: (id: ActivePractice) => void;
  tutorialDone: boolean; tutorial: number; moved: number; looked: number; hand: 'left' | 'right'; ppe: Ppe;
  locations: Record<ItemId, Place>; seen: ItemId[]; target: string | null; message: string;
  vinegarMl: number; bicarbonateG: number; reactingAt: number; pouring: ItemId | null; records: RecordEntry[];
  start: (mode: Mode) => void; setLocked: (value: boolean) => void; setTarget: (id: string | null) => void;
  progress: (kind: 'move' | 'look', amount: number) => void; selectHand: (hand: 'left' | 'right') => void;
  interact: () => void; drop: () => void; add: (id: ItemId, amount: number) => void;
  open: (panel: LabState['panel']) => void; reset: () => void; menu: () => void; saveObservation: (text: string, at?: string) => void;
}
const initialLocations = (): Record<ItemId, Place> => ({ beaker: 'shelf', vinegar: 'shelf', bicarbonate: 'shelf' });
let pourTimer: ReturnType<typeof setTimeout> | undefined;
export const useLab = create<LabState>((set, get) => ({
  mode: null, requestedMode: 'guided', locked: false, panel: null,
  activePractice: 'reaction', selectPractice: activePractice => set({ activePractice }),
  tutorialDone: readSaved<boolean>('experimenta.tutorial.v1', false) === true, tutorial: 0, moved: 0, looked: 0,
  hand: 'right', ppe: { goggles: false, gloves: false }, locations: initialLocations(), seen: [], target: null, message: '',
  vinegarMl: 0, bicarbonateG: 0, reactingAt: 0, pouring: null,
  records: (() => { const saved = readSaved<unknown>('experimenta.records.v1', []); return Array.isArray(saved) ? saved.filter((r): r is RecordEntry => !!r && typeof r === 'object' && 'input' in r && 'result' in r && 'at' in r && 'observation' in r).slice(-30) : []; })(),
  start: mode => { clearTimeout(pourTimer); useStorage.getState().closeAll(); usePractices.getState().cancelPending(); useHood.getState().resetSession(); const s = get(); set({ requestedMode: mode, activePractice: 'reaction', mode: !s.tutorialDone || mode === 'tutorial' ? 'tutorial' : mode, tutorial: 0, moved: 0, looked: 0, hand: 'right', ppe: { goggles: false, gloves: false }, locations: initialLocations(), seen: [], vinegarMl: 0, bicarbonateG: 0, reactingAt: 0, pouring: null, panel: null, target: null, message: '' }); },
  setLocked: locked => set({ locked }),
  setTarget: target => { const s = get(); if (s.target !== target) set({ target }); if (s.mode === 'tutorial' && s.tutorial === 2 && target === 'beaker') set({ tutorial: 3 }); },
  progress: (kind, amount) => { const s = get(); if (s.mode !== 'tutorial') return; if (kind === 'move' && s.tutorial === 0) { const moved = s.moved + amount; set({ moved, tutorial: moved > 1 ? 1 : 0 }); } if (kind === 'look' && s.tutorial === 1) { const looked = s.looked + amount; set({ looked, tutorial: looked > 150 ? 2 : 1 }); } },
  selectHand: hand => { const s = get(); set({ hand, ...(s.mode === 'tutorial' && s.tutorial === 4 ? { tutorial: 5 } : {}) }); },
  interact: () => {
    const s = get(); const target = s.target;
    if (s.pouring) return;
    const handBusy = Object.values(s.locations).includes(s.hand) || !!useHood.getState().heldIn(s.hand) || useHood.getState().pipette.place === s.hand;
    if (target === 'tool:pipette') {
      if (s.mode === 'tutorial') { set({ message: 'Termina el tutorial para usar el material de los gabinetes.' }); return; }
      if (handBusy) { set({ message: 'Esta mano está ocupada. Cambia con 1 / 2 o deja el objeto con Q.' }); return; }
      set({ message: useHood.getState().takePipette(s.hand), ...(s.mode === 'free' ? { activePractice: 'hood' as const } : {}) }); return;
    }
    if (target?.startsWith('cabinet:')) {
      if (s.mode === 'tutorial') { set({ message: 'Termina el tutorial para abrir los gabinetes.' }); return; }
      const id = target.slice(8); const open = useStorage.getState().toggle(id);
      const name = id === VITRINE ? 'Vitrina de compuestos' : cabinets.find(c => c.id === id)?.contents ?? 'Gabinete';
      set({ message: `${name}: ${open ? 'abierto' : 'cerrado'}.` }); return;
    }
    if (target?.startsWith('exhibit:')) { const e = exhibits[Number(target.slice(8))]; set({ message: `${e.name} (${e.formula}) es de exposición: todavía no tiene modelo químico en el simulador.` }); return; }
    if (isHoodTarget(target)) {
      if (s.mode === 'tutorial') { set({ message: 'Termina el tutorial para usar la estantería y la campana.' }); return; }
      const hood = useHood.getState();
      const report = (ok: boolean, done: string) => set({ message: ok ? done : useHood.getState().error });
      if (target === 'ppe-goggles') { set({ ppe: { ...s.ppe, goggles: true }, message: s.ppe.goggles ? 'Ya llevas las gafas de seguridad.' : 'Gafas de seguridad puestas. Protegen tus ojos de salpicaduras.' }); return; }
      if (target === 'ppe-gloves') { set({ ppe: { ...s.ppe, gloves: true }, message: s.ppe.gloves ? 'Ya llevas guantes.' : 'Guantes de nitrilo puestos. Ya puedes manipular reactivos.' }); return; }
      if (hood.pipette.place === s.hand && target!.startsWith('hood')) { set({ message: hood.putPipette(s.hand, 'hood') }); return; }
      if (target === 'hood-pipette') { report(hood.pourPipette(), `Descargas ${hood.pipette.ml.toLocaleString('es', { maximumFractionDigits: 1 })} mL de la pipeta en el matraz…`); return; }
      if (target === 'recipe-board') { set({ activePractice: 'hood' }); get().open('recipes'); return; }
      if (target!.startsWith('reagent:')) {
        const id = target!.slice(8) as ReagentId;
        if (!s.ppe.goggles || !s.ppe.gloves) { set({ message: `Antes de tocar reactivos ponte ${!s.ppe.goggles && !s.ppe.gloves ? 'las gafas y los guantes' : !s.ppe.goggles ? 'las gafas' : 'los guantes'}: estación de protección junto a la puerta.` }); return; }
        if (handBusy) { set({ message: 'Esta mano está ocupada. Cambia con 1 / 2 o deja el objeto con Q.' }); return; }
        set({ message: hood.pick(id, s.hand), ...(s.activePractice !== 'hood' && s.mode === 'free' ? { activePractice: 'hood' } : {}) });
      } else if (target === 'hood') { set({ activePractice: 'hood' }); get().open('hood'); }
      else if (target === 'hood-sash') set({ message: hood.toggleSash() });
      else if (target === 'hood-cylinder') report(hood.pourCylinder(), `Viertes ${Math.round(hood.cylinder.ml)} mL de la probeta en el matraz…`);
      else if (target === 'hood-balance') report(hood.pourBalance(), `Añades el sólido pesado al matraz…`);
      else if (target === 'hood-washbottle') report(hood.rinseCylinder(), 'Enjuagas la probeta con agua destilada de la piseta…');
      else if (target === 'hood-waste') report(hood.dispose(), 'Viertes la mezcla en el recipiente de residuos…');
      else set({ message: 'Apunta a un frasco y pulsa E para recogerlo. Q devuelve a la estantería el frasco de tu mano.' });
      return;
    }
    if (s.mode !== 'tutorial' && (target === 'support-1' || target === 'support-2')) { const id = target === 'support-1' ? 'conductivity' : 'dissolution'; set({ activePractice: id }); get().open(id); return; }
    if (target && target in items) {
      const id = target as ItemId;
      if (id === 'beaker' && s.vinegarMl) { get().open(s.bicarbonateG ? 'results' : 'station'); set({ message: 'El vaso contiene la mezcla. Usa «Vaciar y enjuagar vaso» para recogerlo; devolver los frascos no elimina su contenido.' }); return; }
      if (s.mode === 'tutorial' && (id !== 'beaker' || s.tutorial !== 3)) { set({ message: 'Sigue los pasos del tutorial.' }); return; }
      if (handBusy) { set({ message: 'Esta mano está ocupada. Cambia con 1 / 2 o coloca el objeto con Q.' }); return; }
      set({ locations: { ...s.locations, [id]: s.hand }, seen: [...new Set([...s.seen, id])], message: `${items[id].name} en la mano ${s.hand === 'left' ? 'izquierda' : 'derecha'}.`, ...(s.mode === 'tutorial' ? { tutorial: 4 } : {}) });
    }
    if (target === 'bench') {
      if (s.mode !== 'tutorial') set({ activePractice: 'reaction' });
      const beakerHeld = ['left', 'right'].includes(s.locations.beaker);
      if (beakerHeld) { if (s.mode === 'tutorial' && s.tutorial !== 5) return; set({ locations: { ...s.locations, beaker: 'bench' }, message: 'Vaso colocado en la mesa.', ...(s.mode === 'tutorial' ? { tutorial: 6 } : {}) }); }
      else {
        if (s.mode === 'tutorial') {
          if (s.tutorial !== 6) return;
          try { localStorage.setItem('experimenta.tutorial.v1', 'true'); } catch { /* Session works without storage. */ }
          set({ tutorialDone: true, mode: s.requestedMode === 'tutorial' ? 'guided' : s.requestedMode, message: '¡Tutorial completado! Prepara tu primer experimento.' });
        }
        if (s.mode === 'tutorial' && s.activePractice !== 'reaction') get().open(null);
        else get().open(s.bicarbonateG ? 'results' : 'station');
      }
    }
    if (target === 'periodic' && s.mode !== 'tutorial') get().open('periodic');
    if (target && target !== 'bench' && placementSurface(target, s.locations) === target) get().drop();
  },
  drop: () => {
    const s = get(); if (s.pouring) return;
    const hood = useHood.getState(); const held = hood.heldIn(s.hand);
    if (hood.pipette.place === s.hand) {
      const target = s.target;
      set({ message: target?.startsWith('hood') ? hood.putPipette(s.hand, 'hood') : target === 'cabinet:pipetas' ? hood.putPipette(s.hand, 'cabinet') : 'Apunta a la campana o al gabinete de pipetas y pulsa Q para dejar la pipeta.' });
      return;
    }
    if (held) {
      const target = s.target;
      const onShelf = target === 'reagent-shelf' || (target?.startsWith('reagent:') && hood.places[target.slice(8) as ReagentId] === 'shelf');
      const inHood = !!target?.startsWith('hood') || (target?.startsWith('reagent:') && hood.places[target.slice(8) as ReagentId] === 'hood');
      set({ message: onShelf ? hood.put(s.hand, 'shelf') : inHood ? hood.put(s.hand, 'hood') : 'Apunta a la estantería de reactivos o a la campana y pulsa Q para dejar el frasco.' });
      return;
    }
    const surface = placementSurface(s.target, s.locations);
    if (!surface) { set({ message: 'Apunta a Reactivos y material o a una mesa y pulsa Q para colocar el objeto.' }); return; }
    if (s.mode === 'tutorial') { if (surface === 'bench') s.interact(); else set({ message: 'En este paso coloca el vaso en la mesa de reacción.' }); return; }
    const id = (Object.keys(items) as ItemId[]).find(id => s.locations[id] === s.hand);
    if (!id) { set({ message: 'La mano seleccionada está libre. Cambia de mano con 1 / 2.' }); return; }
    set({ locations: { ...s.locations, [id]: surface }, target: surface, message: `${items[id].name} colocado en ${surfaceNames[surface]}.` });
  },
  add: (id, amount) => {
    const s = get(); if (s.pouring || !s.mode || s.mode === 'tutorial') return;
    if (s.locations.beaker !== 'bench') { set({ message: 'Primero coloca el vaso en la mesa.' }); return; }
    if (!['left', 'right'].includes(s.locations[id])) { set({ message: 'Debes transportar ese reactivo en una de tus manos.' }); return; }
    if (!Number.isFinite(amount) || amount < (id === 'vinegar' ? 1 : 0.01) || (id === 'vinegar' ? amount > 150 : amount > 10) || id === 'beaker') { set({ message: 'Cantidad fuera de rango.' }); return; }
    if (id === 'vinegar' && s.vinegarMl > 0 || id === 'bicarbonate' && (s.bicarbonateG > 0 || !s.vinegarMl)) { set({ message: 'Añade primero vinagre y después bicarbonato. Limpia la estación para repetir.' }); return; }
    set({ pouring: id, panel: null, message: 'Vertiendo…' });
    pourTimer = setTimeout(() => {
      if (get().pouring !== id) return;
      if (id === 'vinegar') set({ vinegarMl: amount, pouring: null, message: 'Vinagre transferido. Ahora busca el bicarbonato.' });
      else {
        const input = { vinegarMl: get().vinegarMl, concentration: 0.83, bicarbonateG: amount };
        const result = calculateReaction(input);
        const records = [...get().records, { at: new Date().toISOString(), input, result, observation: '' }].slice(-30);
        try { localStorage.setItem('experimenta.records.v1', JSON.stringify(records)); } catch { /* Keep in memory. */ }
        set({ bicarbonateG: amount, pouring: null, reactingAt: Date.now(), records, message: 'La mezcla libera CO₂. Observa las burbujas y consulta los resultados.' });
      }
    }, 1800);
  },
  open: panel => { if (document.pointerLockElement) document.exitPointerLock(); set({ panel, locked: false, message: '' }); },
  reset: () => { clearTimeout(pourTimer); set({ vinegarMl: 0, bicarbonateG: 0, reactingAt: 0, pouring: null, message: 'Vaso vacío y enjuagado. Ya puedes recogerlo con una mano libre. Tus resultados siguen en el cuaderno.' }); },
  menu: () => { clearTimeout(pourTimer); usePractices.getState().cancelPending(); useHood.getState().cancelPour(); if (document.pointerLockElement) document.exitPointerLock(); set({ mode: null, locked: false, panel: null, pouring: null }); },
  saveObservation: (observation, at) => { const records = get().records.map((r, i, all) => (at ? r.at === at : i === all.length - 1) ? { ...r, observation } : r); try { localStorage.setItem('experimenta.records.v1', JSON.stringify(records)); } catch { /* Keep in memory. */ } set({ records }); },
}));
export function guidedIndex(s: LabState) {
  const carried = (id: ItemId) => s.locations[id] === 'left' || s.locations[id] === 'right';
  return s.bicarbonateG ? 6 : s.vinegarMl ? carried('bicarbonate') ? 5 : 4 : s.locations.beaker === 'bench' ? carried('vinegar') ? 3 : 2 : carried('beaker') ? 1 : 0;
}
