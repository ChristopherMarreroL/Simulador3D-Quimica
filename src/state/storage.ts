import { create } from 'zustand';

/** Kinds of glassware drawn inside the wall cabinets. They are stored material, not usable tools yet. */
export type StoredKind = 'beaker-s' | 'beaker-l' | 'erlenmeyer' | 'cylinder' | 'volumetric' | 'tubes' | 'funnel' | 'pipette' | 'thermometer' | 'mortar' | 'washbottle';
export interface CabinetInfo { id: string; title: string; contents: string; kind: StoredKind; wall: 'back' | 'left' }
/** Upper cabinets of the U: one family of instruments each (designed layout, not measured). */
export const cabinets: CabinetInfo[] = [
  { id: 'vasos-s', title: 'VASOS 50 · 100 mL', contents: 'Vasos de precipitados de 50 y 100 mL', kind: 'beaker-s', wall: 'back' },
  { id: 'vasos-l', title: 'VASOS 250 · 500 mL', contents: 'Vasos de precipitados de 250 y 500 mL', kind: 'beaker-l', wall: 'back' },
  { id: 'erlenmeyer', title: 'MATRACES ERLENMEYER', contents: 'Matraces Erlenmeyer de 250 y 500 mL', kind: 'erlenmeyer', wall: 'back' },
  { id: 'probetas', title: 'PROBETAS', contents: 'Probetas graduadas de 10, 50 y 100 mL', kind: 'cylinder', wall: 'back' },
  { id: 'aforados', title: 'MATRACES AFORADOS', contents: 'Matraces aforados de 100 y 250 mL', kind: 'volumetric', wall: 'back' },
  { id: 'tubos', title: 'TUBOS DE ENSAYO', contents: 'Tubos de ensayo y gradillas', kind: 'tubes', wall: 'back' },
  { id: 'embudos', title: 'EMBUDOS · VIDRIOS', contents: 'Embudos y vidrios de reloj', kind: 'funnel', wall: 'back' },
  { id: 'pipetas', title: 'PIPETAS · VARILLAS', contents: 'Pipetas de 10 mL y varillas de agitación', kind: 'pipette', wall: 'left' },
  { id: 'termometros', title: 'TERMÓMETROS · GOTEROS', contents: 'Termómetros y frascos gotero', kind: 'thermometer', wall: 'left' },
  { id: 'morteros', title: 'MORTEROS · MECHEROS', contents: 'Morteros con mano y mecheros Bunsen', kind: 'mortar', wall: 'left' },
  { id: 'pisetas', title: 'PISETAS · TARROS', contents: 'Pisetas y tarros para sólidos', kind: 'washbottle', wall: 'left' },
];
export const VITRINE = 'vitrina';

export type ExhibitKind = 'liquido' | 'solido' | 'indicador';
export interface Exhibit { name: string; formula: string; kind: ExhibitKind; group: 'ácido' | 'base' | 'disolvente' | 'sal' | 'oxidante' | 'otro' | 'indicador'; contents: string; amber?: boolean }
/**
 * Common laboratory compounds shown in the display cabinet. They have NO chemical model in the simulator:
 * they can be read, not mixed. The 27 reagents with a model live on the reagent shelving.
 */
export const exhibits: Exhibit[] = [
  { name: 'Ácido clorhídrico concentrado', formula: 'HCl 37 %', kind: 'liquido', group: 'ácido', contents: '#eef3e6' },
  { name: 'Ácido sulfúrico concentrado', formula: 'H₂SO₄ 98 %', kind: 'liquido', group: 'ácido', contents: '#efeee2' },
  { name: 'Ácido nítrico', formula: 'HNO₃ 65 %', kind: 'liquido', group: 'ácido', contents: '#f1ecc9', amber: true },
  { name: 'Ácido fosfórico', formula: 'H₃PO₄ 85 %', kind: 'liquido', group: 'ácido', contents: '#eef1ee' },
  { name: 'Ácido acético glacial', formula: 'CH₃COOH 99 %', kind: 'liquido', group: 'ácido', contents: '#f1f3ef' },
  { name: 'Amoníaco', formula: 'NH₃ (ac) 25 %', kind: 'liquido', group: 'base', contents: '#eef2f4' },
  { name: 'Hidróxido de potasio', formula: 'KOH (ac) 1,0 mol/L', kind: 'liquido', group: 'base', contents: '#eef2f4' },
  { name: 'Hipoclorito de sodio', formula: 'NaClO (ac)', kind: 'liquido', group: 'oxidante', contents: '#eef0c8', amber: true },
  { name: 'Etanol', formula: 'C₂H₅OH 96 %', kind: 'liquido', group: 'disolvente', contents: '#f1f5f6' },
  { name: 'Metanol', formula: 'CH₃OH', kind: 'liquido', group: 'disolvente', contents: '#f1f5f6' },
  { name: 'Acetona', formula: 'CH₃COCH₃', kind: 'liquido', group: 'disolvente', contents: '#f1f5f6' },
  { name: 'Glicerina', formula: 'C₃H₈O₃', kind: 'liquido', group: 'disolvente', contents: '#f3f1e6' },
  { name: 'Hidróxido de sodio (lentejas)', formula: 'NaOH (s)', kind: 'solido', group: 'base', contents: '#f6f6f2' },
  { name: 'Hidróxido de calcio', formula: 'Ca(OH)₂', kind: 'solido', group: 'base', contents: '#f6f6f2' },
  { name: 'Óxido de calcio', formula: 'CaO', kind: 'solido', group: 'base', contents: '#f1f0ea' },
  { name: 'Nitrato de potasio', formula: 'KNO₃', kind: 'solido', group: 'oxidante', contents: '#f6f6f2' },
  { name: 'Dicromato de potasio', formula: 'K₂Cr₂O₇', kind: 'solido', group: 'oxidante', contents: '#e2641c' },
  { name: 'Tiosulfato de sodio', formula: 'Na₂S₂O₃', kind: 'solido', group: 'sal', contents: '#f6f6f2' },
  { name: 'Sulfato de magnesio', formula: 'MgSO₄', kind: 'solido', group: 'sal', contents: '#f6f6f2' },
  { name: 'Sulfato de cinc', formula: 'ZnSO₄', kind: 'solido', group: 'sal', contents: '#f6f6f2' },
  { name: 'Sulfato de hierro(II)', formula: 'FeSO₄', kind: 'solido', group: 'sal', contents: '#a9d3b4' },
  { name: 'Cloruro de amonio', formula: 'NH₄Cl', kind: 'solido', group: 'sal', contents: '#f6f6f2' },
  { name: 'Bromuro de potasio', formula: 'KBr', kind: 'solido', group: 'sal', contents: '#f6f6f2' },
  { name: 'Glucosa', formula: 'C₆H₁₂O₆', kind: 'solido', group: 'otro', contents: '#f6f6f2' },
  { name: 'Azufre', formula: 'S', kind: 'solido', group: 'otro', contents: '#e6d23a' },
  { name: 'Yodo', formula: 'I₂', kind: 'solido', group: 'otro', contents: '#2d2438', amber: true },
  { name: 'Naranja de metilo', formula: 'Indicador', kind: 'indicador', group: 'indicador', contents: '#e9841f' },
  { name: 'Rojo de metilo', formula: 'Indicador', kind: 'indicador', group: 'indicador', contents: '#c92f2f' },
  { name: 'Tornasol', formula: 'Indicador', kind: 'indicador', group: 'indicador', contents: '#6a4aa8' },
];
export const exhibitGroupColors: Record<Exhibit['group'], string> = { 'ácido': '#e0483a', base: '#2f6fe0', disolvente: '#6f7d86', sal: '#2fa36b', oxidante: '#f0b429', otro: '#8a6fb0', indicador: '#e0559d' };

interface StorageState { open: Record<string, boolean>; toggle: (id: string) => boolean; closeAll: () => void }
export const useStorage = create<StorageState>((set, get) => ({
  open: {},
  toggle: id => { const next = !get().open[id]; set({ open: { ...get().open, [id]: next } }); return next; },
  closeAll: () => set({ open: {} }),
}));
