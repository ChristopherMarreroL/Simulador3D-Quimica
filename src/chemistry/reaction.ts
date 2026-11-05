/** Pure stoichiometry. Concentration is mol/L, not a commercial % label. */
export const MOLAR_MASS_BICARBONATE = 84.0066;
export interface ReactionInput { vinegarMl: number; concentration: number; bicarbonateG: number }
export function calculateReaction({ vinegarMl, concentration, bicarbonateG }: ReactionInput) {
  if (![vinegarMl, concentration, bicarbonateG].every(Number.isFinite) || vinegarMl < 1 || vinegarMl > 150 || concentration < 0.01 || concentration > 2 || bicarbonateG < 0.01 || bicarbonateG > 10) {
    throw new Error('Usa 1–150 mL de vinagre, 0,01–2 mol/L y 0,01–10 g de bicarbonato.');
  }
  const acidMoles = vinegarMl / 1000 * concentration;
  const bicarbonateMoles = bicarbonateG / MOLAR_MASS_BICARBONATE;
  const co2Moles = Math.min(acidMoles, bicarbonateMoles);
  return { acidMoles, bicarbonateMoles, co2Moles,
    limiting: Math.abs(acidMoles - bicarbonateMoles) < 1e-9 ? 'Proporción estequiométrica' : acidMoles < bicarbonateMoles ? 'Ácido acético' : 'Bicarbonato de sodio',
    acidRemaining: Math.max(0, acidMoles - co2Moles), bicarbonateRemaining: Math.max(0, bicarbonateMoles - co2Moles),
    // Ideal dry gas at 25 °C and 1 atm; excludes dissolution and water vapour.
    co2Litres: co2Moles * 0.082057 * 298.15,
  };
}
