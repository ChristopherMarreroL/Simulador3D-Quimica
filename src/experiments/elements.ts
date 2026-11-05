import snapshot from '../data/pubchem-periodic-table.json';
import { periodicRows } from './periodic';
const names = 'Hidrógeno|Helio|Litio|Berilio|Boro|Carbono|Nitrógeno|Oxígeno|Flúor|Neón|Sodio|Magnesio|Aluminio|Silicio|Fósforo|Azufre|Cloro|Argón|Potasio|Calcio|Escandio|Titanio|Vanadio|Cromo|Manganeso|Hierro|Cobalto|Níquel|Cobre|Zinc|Galio|Germanio|Arsénico|Selenio|Bromo|Kriptón|Rubidio|Estroncio|Itrio|Zirconio|Niobio|Molibdeno|Tecnecio|Rutenio|Rodio|Paladio|Plata|Cadmio|Indio|Estaño|Antimonio|Telurio|Yodo|Xenón|Cesio|Bario|Lantano|Cerio|Praseodimio|Neodimio|Prometio|Samario|Europio|Gadolinio|Terbio|Disprosio|Holmio|Erbio|Tulio|Iterbio|Lutecio|Hafnio|Tántalo|Wolframio|Renio|Osmio|Iridio|Platino|Oro|Mercurio|Talio|Plomo|Bismuto|Polonio|Ástato|Radón|Francio|Radio|Actinio|Torio|Protactinio|Uranio|Neptunio|Plutonio|Americio|Curio|Berkelio|Californio|Einstenio|Fermio|Mendelevio|Nobelio|Laurencio|Rutherfordio|Dubnio|Seaborgio|Bohrio|Hasio|Meitnerio|Darmstadtio|Roentgenio|Copernicio|Nihonio|Flerovio|Moscovio|Livermorio|Teneso|Oganesón'.split('|');
export const families: Record<string, { name: string; color: string }> = {
  'Alkali metal': { name: 'Metales alcalinos', color: '#e8b69c' },
  'Alkaline earth metal': { name: 'Alcalinotérreos', color: '#e8d496' },
  'Transition metal': { name: 'Metales de transición', color: '#b6d2db' },
  'Post-transition metal': { name: 'Metales del bloque p', color: '#c7d6b7' },
  Metalloid: { name: 'Metaloides', color: '#a1ccc0' },
  Nonmetal: { name: 'Otros no metales', color: '#c9dfac' },
  Halogen: { name: 'Halógenos', color: '#e4c89d' },
  'Noble gas': { name: 'Gases nobles', color: '#c5bfe1' },
  Lanthanide: { name: 'Lantánidos', color: '#dfbfd3' },
  Actinide: { name: 'Actínidos', color: '#c6c5e0' },
};
const states: Record<string, string> = { Solid: 'Sólido', Liquid: 'Líquido', Gas: 'Gas', 'Expected to be a Solid': 'Sólido (predicho)', 'Expected to be a Gas': 'Gas (predicho)' };
export interface ElementData {
  number: number; symbol: string; name: string; englishName: string; mass: number | null;
  electronegativity: number | null; radius: number | null; ionization: number | null;
  melting: number | null; boiling: number | null; density: number | null;
  configuration: string; oxidation: string; state: string; family: string; group: number | null; period: number;
}
const numeric = (v: string): number | null => v.trim() && Number.isFinite(Number(v)) ? Number(v) : null;
export const elements: ElementData[] = snapshot.Table.Row.map(row => {
  const cells = Object.fromEntries(snapshot.Table.Columns.Column.map((c, i) => [c, row.Cell[i]]));
  const number = Number(cells.AtomicNumber);
  const tableRow = periodicRows.findIndex(r => r.includes(number));
  return {
    number, symbol: cells.Symbol, name: names[number - 1], englishName: cells.Name,
    mass: numeric(cells.AtomicMass), electronegativity: numeric(cells.Electronegativity),
    radius: numeric(cells.AtomicRadius), ionization: numeric(cells.IonizationEnergy),
    melting: numeric(cells.MeltingPoint), boiling: numeric(cells.BoilingPoint), density: numeric(cells.Density),
    configuration: cells.ElectronConfiguration.replace('(predicted)', '(predicha)'), oxidation: cells.OxidationStates,
    state: states[cells.StandardState] || 'No disponible', family: cells.GroupBlock,
    group: tableRow < 7 ? periodicRows[tableRow].indexOf(number) + 1 : null,
    period: tableRow < 7 ? tableRow + 1 : tableRow === 7 ? 6 : 7,
  };
});
export const normalizeSearch = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function matchesElement(element: ElementData, query: string, family: string) {
  const q = normalizeSearch(query);
  return (!family || element.family === family) && (!q || String(element.number) === q || normalizeSearch(element.name).includes(q) || element.symbol.toLowerCase() === q);
}
