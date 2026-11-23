/**
 * Species tracked by the fume-hood sandbox. ΔHf° in kJ/mol at 298 K (aqueous ions: standard state,
 * H⁺(ac) = 0), mainly OpenStax Chemistry 2e Appendix G, with CRC/JANAF values where it has none.
 * CH₃COOH and H₂O₂ dissolved use the pure-liquid value as an approximation. `null` means no reference
 * value was found and that heat is not estimated. Sources are listed in docs/CAMPANA_MEZCLAS.md.
 * `formula` is neutral ASCII for molar mass.
 */
export type Phase = 'aq' | 's' | 'l' | 'g';
export interface SpeciesInfo {
  label: string; formula: string; charge: number; phase: Phase; dHf: number | null; name: string;
  /** Visual colour of a solid or of a coloured ion; omitted when colourless. */
  color?: string; colorName?: string;
}
const sp = (label: string, formula: string, charge: number, phase: Phase, dHf: number | null, name: string, color?: string, colorName?: string): SpeciesInfo => ({ label, formula, charge, phase, dHf, name, color, colorName });

export const species = {
  'H+': sp('H⁺', 'H', 1, 'aq', 0, 'ion hidrógeno'),
  'OH-': sp('OH⁻', 'OH', -1, 'aq', -230.0, 'ion hidróxido'),
  H2O: sp('H₂O', 'H2O', 0, 'l', -285.83, 'agua'),
  'Na+': sp('Na⁺', 'Na', 1, 'aq', -240.1, 'ion sodio'),
  'K+': sp('K⁺', 'K', 1, 'aq', -252.4, 'ion potasio'),
  'Cl-': sp('Cl⁻', 'Cl', -1, 'aq', -167.2, 'ion cloruro'),
  'NO3-': sp('NO₃⁻', 'NO3', -1, 'aq', -205.0, 'ion nitrato'),
  'SO4-2': sp('SO₄²⁻', 'SO4', -2, 'aq', -909.3, 'ion sulfato'),
  'HCO3-': sp('HCO₃⁻', 'HCO3', -1, 'aq', -691.11, 'ion bicarbonato'),
  'CO3-2': sp('CO₃²⁻', 'CO3', -2, 'aq', -677.1, 'ion carbonato'),
  CO2: sp('CO₂', 'CO2', 0, 'g', -393.51, 'dióxido de carbono'),
  HAc: sp('CH₃COOH', 'C2H4O2', 0, 'aq', -484.3, 'ácido acético'),
  'Ac-': sp('CH₃COO⁻', 'C2H3O2', -1, 'aq', -486.0, 'ion acetato'),
  'Ag+': sp('Ag⁺', 'Ag', 1, 'aq', 105.6, 'ion plata'),
  AgCl: sp('AgCl', 'AgCl', 0, 's', -127.0, 'cloruro de plata', '#f4f4ef', 'blanco'),
  AgI: sp('AgI', 'AgI', 0, 's', -61.8, 'yoduro de plata', '#eee3a0', 'amarillo pálido'),
  Ag2SO4: sp('Ag₂SO₄', 'Ag2SO4', 0, 's', -715.9, 'sulfato de plata', '#f2f2ea', 'blanco'),
  Ag2CO3: sp('Ag₂CO₃', 'Ag2CO3', 0, 's', -505.8, 'carbonato de plata', '#efe2a8', 'amarillo pálido'),
  Ag2O: sp('Ag₂O', 'Ag2O', 0, 's', -31.05, 'óxido de plata', '#4a3a2c', 'marrón oscuro'),
  Ag: sp('Ag', 'Ag', 0, 's', 0, 'plata metálica', '#c7ccd2', 'gris plateado'),
  'Pb2+': sp('Pb²⁺', 'Pb', 2, 'aq', -1.7, 'ion plomo(II)'),
  PbCl2: sp('PbCl₂', 'PbCl2', 0, 's', -359.4, 'cloruro de plomo(II)', '#f5f5f1', 'blanco'),
  PbI2: sp('PbI₂', 'PbI2', 0, 's', -175.39, 'yoduro de plomo(II)', '#ffd21a', 'amarillo intenso'),
  PbSO4: sp('PbSO₄', 'PbSO4', 0, 's', -920.0, 'sulfato de plomo(II)', '#f6f6f2', 'blanco'),
  PbCO3: sp('PbCO₃', 'PbCO3', 0, 's', -699.1, 'carbonato de plomo(II)', '#f3f3ee', 'blanco'),
  'Pb(OH)2': sp('Pb(OH)₂', 'Pb(OH)2', 0, 's', -515.9, 'hidróxido de plomo(II)', '#f1f1ec', 'blanco'),
  Pb: sp('Pb', 'Pb', 0, 's', 0, 'plomo metálico', '#6d7378', 'gris oscuro'),
  'Ba2+': sp('Ba²⁺', 'Ba', 2, 'aq', -537.6, 'ion bario'),
  BaSO4: sp('BaSO₄', 'BaSO4', 0, 's', -1473.2, 'sulfato de bario', '#fbfbfa', 'blanco'),
  BaCO3: sp('BaCO₃', 'BaCO3', 0, 's', -1213.0, 'carbonato de bario', '#f7f7f3', 'blanco'),
  'Ca2+': sp('Ca²⁺', 'Ca', 2, 'aq', -542.96, 'ion calcio'),
  CaCO3: sp('CaCO₃', 'CaCO3', 0, 's', -1207.6, 'carbonato de calcio', '#f3f1e8', 'blanco'),
  CaSO4: sp('CaSO₄', 'CaSO4', 0, 's', -1434.5, 'sulfato de calcio', '#f4f4ee', 'blanco'),
  'Ca(OH)2': sp('Ca(OH)₂', 'Ca(OH)2', 0, 's', -985.2, 'hidróxido de calcio', '#f7f7f4', 'blanco'),
  'CaCl2(s)': sp('CaCl₂', 'CaCl2', 0, 's', -795.4, 'cloruro de calcio', '#f1f1ec', 'blanco'),
  'Cu2+': sp('Cu²⁺', 'Cu', 2, 'aq', 64.77, 'ion cobre(II)', '#2f8fe0', 'azul'),
  'Cu(OH)2': sp('Cu(OH)₂', 'Cu(OH)2', 0, 's', -450.37, 'hidróxido de cobre(II)', '#5aaee6', 'azul celeste'),
  CuCO3: sp('CuCO₃', 'CuCO3', 0, 's', null, 'carbonato de cobre(II)', '#3faa99', 'verde azulado'),
  CuI: sp('CuI', 'CuI', 0, 's', null, 'yoduro de cobre(I)', '#efe8d6', 'blanco crema'),
  Cu: sp('Cu', 'Cu', 0, 's', 0, 'cobre metálico', '#c4683a', 'cobrizo'),
  'Fe3+': sp('Fe³⁺', 'Fe', 3, 'aq', -48.5, 'ion hierro(III)', '#d98a0b', 'amarillo anaranjado'),
  'Fe2+': sp('Fe²⁺', 'Fe', 2, 'aq', -89.1, 'ion hierro(II)', '#a8d890', 'verde pálido'),
  'Fe(OH)3': sp('Fe(OH)₃', 'Fe(OH)3', 0, 's', -823.0, 'hidróxido de hierro(III)', '#9a4813', 'marrón rojizo'),
  'Fe(OH)2': sp('Fe(OH)₂', 'Fe(OH)2', 0, 's', -569.0, 'hidróxido de hierro(II)', '#6f8f58', 'verde grisáceo'),
  Fe: sp('Fe', 'Fe', 0, 's', 0, 'hierro metálico', '#6a6f74', 'gris'),
  'Mg2+': sp('Mg²⁺', 'Mg', 2, 'aq', -466.9, 'ion magnesio'),
  'Mg(OH)2': sp('Mg(OH)₂', 'Mg(OH)2', 0, 's', -924.5, 'hidróxido de magnesio', '#f7f7f4', 'blanco'),
  MgCO3: sp('MgCO₃', 'MgCO3', 0, 's', -1111.69, 'carbonato de magnesio', '#f6f6f1', 'blanco'),
  Mg: sp('Mg', 'Mg', 0, 's', 0, 'magnesio metálico', '#d5d9dc', 'gris claro'),
  'Zn2+': sp('Zn²⁺', 'Zn', 2, 'aq', -153.9, 'ion cinc'),
  'Zn(OH)2': sp('Zn(OH)₂', 'Zn(OH)2', 0, 's', -642, 'hidróxido de cinc', '#f4f5f2', 'blanco'),
  ZnCO3: sp('ZnCO₃', 'ZnCO3', 0, 's', -812.8, 'carbonato de cinc', '#f4f4ee', 'blanco'),
  Zn: sp('Zn', 'Zn', 0, 's', 0, 'cinc metálico', '#a8afb4', 'gris'),
  'I-': sp('I⁻', 'I', -1, 'aq', -55.19, 'ion yoduro'),
  I2: sp('I₂', 'I2', 0, 'aq', null, 'yodo', '#8a4a10', 'pardo'),
  H2O2: sp('H₂O₂', 'H2O2', 0, 'aq', -187.78, 'peróxido de hidrógeno'),
  'MnO4-': sp('MnO₄⁻', 'MnO4', -1, 'aq', -541.4, 'ion permanganato', '#7a1fa2', 'violeta'),
  'Mn2+': sp('Mn²⁺', 'Mn', 2, 'aq', -220.8, 'ion manganeso(II)', '#f2d5e3', 'rosa muy pálido'),
  MnO2: sp('MnO₂', 'MnO2', 0, 's', -520.03, 'dióxido de manganeso', '#3a2a20', 'marrón oscuro'),
  'NH4+': sp('NH₄⁺', 'NH4', 1, 'aq', -132.5, 'ion amonio'),
  NH3: sp('NH₃', 'NH3', 0, 'aq', -80.88, 'amoníaco'),
  'NH4NO3(s)': sp('NH₄NO₃', 'NH4NO3', 0, 's', -365.56, 'nitrato de amonio', '#f5f5f0', 'blanco'),
  'NaHCO3(s)': sp('NaHCO₃', 'NaHCO3', 0, 's', -950.8, 'bicarbonato de sodio', '#fbfbf8', 'blanco'),
  H2: sp('H₂', 'H2', 0, 'g', 0, 'hidrógeno'),
  O2: sp('O₂', 'O2', 0, 'g', 0, 'oxígeno'),
} satisfies Record<string, SpeciesInfo>;
export type SpeciesId = keyof typeof species;
export const speciesIds = Object.keys(species) as SpeciesId[];
