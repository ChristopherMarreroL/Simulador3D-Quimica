export type Solution = 'water' | 'salt' | 'sugar';
export interface ConductivityInput { solution: Solution; concentration: number }
export function conductivity(input: ConductivityInput) {
  if (!['water', 'salt', 'sugar'].includes(input.solution) || !Number.isFinite(input.concentration) || input.concentration < 0.001 || input.concentration > 0.02) throw new Error('Usa una concentración de 0,001 a 0,020 mol/L.');
  // Limiting dilution at 25 °C: κ(S/cm) = Λ°(S cm²/mol) × c(mol/L) / 1000.
  // Pure water background 0.055 µS/cm. Sugar contributes no ions in this ideal model.
  const microSiemens = 0.055 + (input.solution === 'salt' ? 126.4 * input.concentration * 1000 : 0);
  return { microSiemens, brightness: input.solution === 'salt' ? Math.min(1, microSiemens / 2528.055) : 0, ionMolarity: input.solution === 'salt' ? 2 * input.concentration : 0 };
}
export interface CrystallizationInput { waterG: number; saltG: number; evaporationPercent: number }
export function crystallization(input: CrystallizationInput) {
  const { waterG, saltG, evaporationPercent } = input;
  if (![waterG, saltG, evaporationPercent].every(Number.isFinite) || waterG < 50 || waterG > 150 || saltG < 1 || saltG > 50 || evaporationPercent < 0 || evaporationPercent > 90) throw new Error('Usa 50–150 g de agua, 1–50 g de sal y 0–90 % de evaporación.');
  // Equilibrium at 20 °C, rounded NaCl solubility: 36 g / 100 g water.
  const initialDissolved = Math.min(saltG, 0.36 * waterG);
  const initialSolid = saltG - initialDissolved;
  const remainingWater = waterG * (1 - evaporationPercent / 100);
  const dissolved = Math.min(saltG, 0.36 * remainingWater);
  const solid = saltG - dissolved;
  return { initialDissolved, initialSolid, remainingWater, evaporatedWater: waterG - remainingWater, dissolved, solid, newCrystals: Math.max(0, solid - initialSolid) };
}
