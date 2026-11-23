import type { SpeciesId } from './species';

/** Educational stock reagents of the shelf next to the fume hood. Concentrations are defined by the model. */
export type ReagentId =
  | 'water' | 'hcl' | 'h2so4' | 'acetic' | 'naoh' | 'na2co3' | 'nahco3'
  | 'phenolphthalein' | 'universal' | 'bromothymol' | 'starch' | 'h2o2' | 'kmno4' | 'ki'
  | 'nacl' | 'agno3' | 'cuso4' | 'fecl3' | 'pbno3' | 'bacl2' | 'cacl2'
  | 'nh4no3' | 'caco3' | 'zn' | 'mg' | 'cu' | 'fe';
export type IndicatorId = 'phenolphthalein' | 'universal' | 'bromothymol' | 'starch';
export type ReagentCategory = 'disolvente' | 'ácido' | 'base' | 'carbonato' | 'sal' | 'oxidante' | 'indicador' | 'metal';
type Terms = Partial<Record<SpeciesId, number>>;
interface Base {
  id: ReagentId; name: string; formula: string; category: ReagentCategory; hazard: string; description: string;
  /** Bottle look: glass tint, visible contents and container shape. */
  look: { glass: 'clear' | 'amber'; contents: string; shape: 'bottle' | 'jar' | 'dropper' };
}
export type Reagent = Base & (
  | { kind: 'water' }
  | { kind: 'solution'; concentration: number; components: Terms }
  | { kind: 'solid'; species: SpeciesId; max: number }
  | { kind: 'indicator'; indicator: IndicatorId }
);
const solution = (b: Base, concentration: number, components: Terms): Reagent => ({ ...b, kind: 'solution', concentration, components });
const solid = (b: Base, speciesId: SpeciesId, max = 10): Reagent => ({ ...b, kind: 'solid', species: speciesId, max });
const indicator = (b: Base): Reagent => ({ ...b, kind: 'indicator', indicator: b.id as IndicatorId });
const look = (contents: string, shape: Base['look']['shape'] = 'bottle', glass: Base['look']['glass'] = 'clear') => ({ contents, shape, glass });

export const reagents: Record<ReagentId, Reagent> = {
  water: { id: 'water', name: 'Agua destilada', formula: 'H₂O (l)', category: 'disolvente', kind: 'water', hazard: 'Sin peligro relevante.', description: 'Diluye las mezclas y disuelve sólidos.', look: look('#cfe9f4') },
  hcl: solution({ id: 'hcl', name: 'Ácido clorhídrico', formula: 'HCl (ac) · 1,0 mol/L', category: 'ácido', hazard: 'Corrosivo. Usa gafas y guantes.', description: 'Ácido fuerte: se disocia por completo en H⁺ y Cl⁻.', look: look('#eef6f6') }, 1.0, { 'H+': 1, 'Cl-': 1 }),
  h2so4: solution({ id: 'h2so4', name: 'Ácido sulfúrico', formula: 'H₂SO₄ (ac) · 0,5 mol/L', category: 'ácido', hazard: 'Corrosivo. Añade siempre el ácido al agua, nunca al revés.', description: 'Ácido diprótico. Aporta iones sulfato.', look: look('#f1f5ee') }, 0.5, { 'H+': 2, 'SO4-2': 1 }),
  acetic: solution({ id: 'acetic', name: 'Ácido acético (vinagre)', formula: 'CH₃COOH (ac) · 0,83 mol/L', category: 'ácido', hazard: 'Irritante para los ojos.', description: 'Ácido débil: la mayor parte permanece sin disociar.', look: look('#f3e7c2') }, 0.83, { HAc: 1 }),
  naoh: solution({ id: 'naoh', name: 'Hidróxido de sodio', formula: 'NaOH (ac) · 1,0 mol/L', category: 'base', hazard: 'Corrosivo para la piel y los ojos.', description: 'Base fuerte: aporta iones hidróxido.', look: look('#eef3f8') }, 1.0, { 'Na+': 1, 'OH-': 1 }),
  na2co3: solution({ id: 'na2co3', name: 'Carbonato de sodio', formula: 'Na₂CO₃ (ac) · 0,5 mol/L', category: 'carbonato', hazard: 'Irritante ocular.', description: 'Base que libera CO₂ con los ácidos y precipita carbonatos.', look: look('#eef4f4') }, 0.5, { 'Na+': 2, 'CO3-2': 1 }),
  nahco3: solid({ id: 'nahco3', name: 'Bicarbonato de sodio', formula: 'NaHCO₃ (s)', category: 'carbonato', hazard: 'Evita inhalar el polvo.', description: 'Sólido blanco; burbujea con los ácidos y enfría el agua al disolverse.', look: look('#fbfbf8', 'jar') }, 'NaHCO3(s)'),
  phenolphthalein: indicator({ id: 'phenolphthalein', name: 'Fenolftaleína', formula: 'Indicador · gotas', category: 'indicador', hazard: 'Disolución alcohólica: inflamable.', description: 'Incolora en medio ácido o neutro; rosa por encima de pH ≈ 8,2.', look: look('#f6f6f6', 'dropper') }),
  universal: indicator({ id: 'universal', name: 'Indicador universal', formula: 'Indicador · gotas', category: 'indicador', hazard: 'Disolución alcohólica: inflamable.', description: 'Cambia de rojo (ácido) a verde (neutro) y violeta (básico).', look: look('#3f9d4a', 'dropper') }),
  bromothymol: indicator({ id: 'bromothymol', name: 'Azul de bromotimol', formula: 'Indicador · gotas', category: 'indicador', hazard: 'Disolución alcohólica: inflamable.', description: 'Amarillo por debajo de pH 6,0; azul por encima de 7,6.', look: look('#2f63b8', 'dropper') }),
  starch: indicator({ id: 'starch', name: 'Engrudo de almidón', formula: 'Indicador de yodo · gotas', category: 'indicador', hazard: 'Sin peligro relevante.', description: 'Se vuelve azul oscuro en presencia de yodo (I₂).', look: look('#ebe7da', 'dropper') }),
  h2o2: solution({ id: 'h2o2', name: 'Peróxido de hidrógeno 3 %', formula: 'H₂O₂ (ac) · 0,88 mol/L', category: 'oxidante', hazard: 'Irritante ocular. Se descompone con la luz.', description: 'Se descompone en agua y oxígeno si hay un catalizador (I⁻ o MnO₂).', look: look('#f2f6f6', 'bottle', 'amber') }, 0.882, { H2O2: 1 }),
  kmno4: solution({ id: 'kmno4', name: 'Permanganato de potasio', formula: 'KMnO₄ (ac) · 0,02 mol/L', category: 'oxidante', hazard: 'Comburente; nocivo; mancha la piel.', description: 'Oxidante violeta intenso; pierde el color al reducirse.', look: look('#6a138f') }, 0.02, { 'K+': 1, 'MnO4-': 1 }),
  ki: solution({ id: 'ki', name: 'Yoduro de potasio', formula: 'KI (ac) · 0,5 mol/L', category: 'sal', hazard: 'Evita ingerirlo.', description: 'Aporta iones yoduro: forma precipitados y yodo.', look: look('#f3f4ee') }, 0.5, { 'K+': 1, 'I-': 1 }),
  nacl: solution({ id: 'nacl', name: 'Cloruro de sodio', formula: 'NaCl (ac) · 1,0 mol/L', category: 'sal', hazard: 'Sin peligro relevante.', description: 'Solución salina: aporta iones cloruro.', look: look('#eef5f5') }, 1.0, { 'Na+': 1, 'Cl-': 1 }),
  agno3: solution({ id: 'agno3', name: 'Nitrato de plata', formula: 'AgNO₃ (ac) · 0,1 mol/L', category: 'sal', hazard: 'Corrosivo; mancha la piel. Tóxico para la vida acuática.', description: 'Detecta haluros: forma precipitados claros.', look: look('#f1f3f0', 'bottle', 'amber') }, 0.1, { 'Ag+': 1, 'NO3-': 1 }),
  cuso4: solution({ id: 'cuso4', name: 'Sulfato de cobre(II)', formula: 'CuSO₄ (ac) · 0,5 mol/L', category: 'sal', hazard: 'Nocivo si se ingiere. Tóxico para la vida acuática.', description: 'Solución azul de iones Cu²⁺.', look: look('#2f86d8') }, 0.5, { 'Cu2+': 1, 'SO4-2': 1 }),
  fecl3: solution({ id: 'fecl3', name: 'Cloruro de hierro(III)', formula: 'FeCl₃ (ac) · 0,1 mol/L', category: 'sal', hazard: 'Corrosivo; irritante.', description: 'Solución ácida de color amarillo anaranjado.', look: look('#d07f12') }, 0.1, { 'Fe3+': 1, 'Cl-': 3 }),
  pbno3: solution({ id: 'pbno3', name: 'Nitrato de plomo(II)', formula: 'Pb(NO₃)₂ (ac) · 0,1 mol/L', category: 'sal', hazard: 'Tóxico. Puede dañar la fertilidad y al feto. Solo en simulación.', description: 'Forma precipitados con yoduros, cloruros y sulfatos.', look: look('#f1f3ef') }, 0.1, { 'Pb2+': 1, 'NO3-': 2 }),
  bacl2: solution({ id: 'bacl2', name: 'Cloruro de bario', formula: 'BaCl₂ (ac) · 0,1 mol/L', category: 'sal', hazard: 'Tóxico si se ingiere.', description: 'Detecta sulfatos: forma BaSO₄ blanco.', look: look('#f0f4f1') }, 0.1, { 'Ba2+': 1, 'Cl-': 2 }),
  cacl2: solid({ id: 'cacl2', name: 'Cloruro de calcio', formula: 'CaCl₂ (s, anhidro)', category: 'sal', hazard: 'Irritante ocular. Se calienta al disolverse.', description: 'Su disolución libera calor.', look: look('#f1f1ec', 'jar') }, 'CaCl2(s)'),
  nh4no3: solid({ id: 'nh4no3', name: 'Nitrato de amonio', formula: 'NH₄NO₃ (s)', category: 'sal', hazard: 'Comburente. Se enfría al disolverse.', description: 'Su disolución absorbe calor (bolsas de frío).', look: look('#f6f6f1', 'jar') }, 'NH4NO3(s)'),
  caco3: solid({ id: 'caco3', name: 'Carbonato de calcio', formula: 'CaCO₃ (s) · mármol', category: 'carbonato', hazard: 'Sin peligro relevante.', description: 'Trozos de mármol: burbujean en ácido.', look: look('#efece3', 'jar') }, 'CaCO3'),
  zn: solid({ id: 'zn', name: 'Cinc granulado', formula: 'Zn (s)', category: 'metal', hazard: 'Evita el polvo fino: es inflamable.', description: 'Metal activo: desplaza hidrógeno, cobre, plomo y plata.', look: look('#a6adb3', 'jar') }, 'Zn'),
  mg: solid({ id: 'mg', name: 'Cinta de magnesio', formula: 'Mg (s)', category: 'metal', hazard: 'Sólido inflamable. No lo acerques a llamas.', description: 'Muy activo: reacciona con fuerza con los ácidos.', look: look('#d3d7da', 'jar') }, 'Mg', 2),
  cu: solid({ id: 'cu', name: 'Alambre de cobre', formula: 'Cu (s)', category: 'metal', hazard: 'Sin peligro relevante.', description: 'Poco activo: no reacciona con HCl, sí con Ag⁺ y Fe³⁺.', look: look('#c4683a', 'jar') }, 'Cu'),
  fe: solid({ id: 'fe', name: 'Clavos de hierro', formula: 'Fe (s)', category: 'metal', hazard: 'Sin peligro relevante.', description: 'Desplaza al cobre de sus sales y reacciona con ácidos fuertes.', look: look('#6c7176', 'jar') }, 'Fe'),
};
/** Shelf order: four rows of seven (the last slot of the bottom row stays empty). */
export const shelfRows: ReagentId[][] = [
  ['phenolphthalein', 'universal', 'bromothymol', 'starch', 'h2o2', 'kmno4', 'ki'],
  ['water', 'hcl', 'h2so4', 'acetic', 'naoh', 'na2co3', 'nahco3'],
  ['nacl', 'agno3', 'cuso4', 'fecl3', 'pbno3', 'bacl2', 'cacl2'],
  ['nh4no3', 'caco3', 'zn', 'mg', 'cu', 'fe'],
];
export const reagentIds = shelfRows.flat();
export const categoryColors: Record<ReagentCategory, string> = {
  disolvente: '#4bb3dd', ácido: '#e0483a', base: '#3c6ee0', carbonato: '#9a62d8', sal: '#2fa36b', oxidante: '#f0b429', indicador: '#e0559d', metal: '#7f8c99',
};
export const DROP_ML = 0.05;
export function amountRange(r: Reagent) {
  if (r.kind === 'solid') return { min: 0.05, max: r.max, step: 0.05, unit: 'g', initial: Math.min(1, r.max) };
  if (r.kind === 'indicator') return { min: 1, max: 10, step: 1, unit: 'gotas', initial: 3 };
  return { min: 1, max: 200, step: 1, unit: 'mL', initial: r.kind === 'water' ? 50 : 25 };
}
