/**
 * Reference constants at 25 °C used by the sandbox (sources in docs/CAMPANA_MEZCLAS.md).
 * Ksp are ideal solubility products; Ka are acid ionization constants; E are standard reduction potentials (V).
 */
export const constants = {
  /** OpenStax Chemistry 2e Appendix J, except: BaSO4, PbCO3, Pb(OH)2, Zn(OH)2 and anhydrous MgCO3 from CRC (LibreTexts E3). */
  ksp: {
    AgCl: 1.6e-10, AgI: 1.5e-16, Ag2SO4: 1.2e-5, Ag2CO3: 8.1e-12, AgOH: 2e-8,
    PbCl2: 1.6e-5, PbI2: 1.4e-8, PbSO4: 1.3e-8, PbCO3: 7.4e-14, 'Pb(OH)2': 1.43e-20,
    BaSO4: 1.08e-10, BaCO3: 1.6e-9, CaCO3: 8.7e-9, CaSO4: 6.1e-5, 'Ca(OH)2': 1.3e-6,
    'Cu(OH)2': 2.2e-20, CuCO3: 2.5e-10, 'Fe(OH)3': 4e-38, 'Fe(OH)2': 1.8e-15,
    'Mg(OH)2': 8.9e-12, MgCO3: 6.82e-6, 'Zn(OH)2': 3e-17, ZnCO3: 2e-10,
  },
  /** OpenStax Appendices H and I; hydrated Fe³⁺ (pKa 2,74), Cu²⁺ (≈ 6,3) and Zn²⁺ (9,6) from section 14.4; NH₄⁺ = Kw / Kb(NH₃). */
  ka: { HAc: 1.8e-5, H2CO3: 4.3e-7, HCO3: 4.7e-11, NH4: 1e-14 / 1.8e-5, HSO4: 1.2e-2, Fe3: 10 ** -2.74, Cu2: 10 ** -6.3, Zn2: 10 ** -9.6 },
  /** OpenStax Appendix L. */
  E: { Mg: -2.372, Zn: -0.7618, Fe: -0.447, Pb: -0.1262, Cu: 0.337, Fe3: 0.771, Ag: 0.7996 },
  /** Solubility at 20 °C, g per 100 g (≈ 100 mL) of water: NaHCO3 PubChem/HSDB; CaCl2 PubChem/ICSC; NH4NO3 solubility table. */
  solubility: { NaHCO3: 9.6, CaCl2: 74.5, NH4NO3: 192 },
};
