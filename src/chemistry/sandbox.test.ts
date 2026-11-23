import { describe, expect, it } from 'vitest';
import { molarMass } from './formula';
import { species, type SpeciesId } from './species';
import { reagentIds, reagents, type ReagentId } from './reagents';
import { addReagent, analyzeMixture, emptyMixture, precipitation, rules, solvePH, type Mixture, type Terms } from './sandbox';

const run = (steps: [ReagentId, number][]) => steps.reduce<{ mix: Mixture; events: ReturnType<typeof addReagent>['events']; deltaT: number }>((acc, [id, amount]) => {
  const out = addReagent(acc.mix, id, amount);
  return { mix: out.mixture, events: [...acc.events, ...out.events], deltaT: out.deltaT };
}, { mix: emptyMixture(), events: [], deltaT: 0 });
function elements(t: Terms) {
  const count: Record<string, number> = {};
  for (const [id, c] of Object.entries(t) as [SpeciesId, number][]) {
    const f = species[id].formula.replace(/\(([^)]+)\)(\d*)/g, (_, g: string, n: string) => g.repeat(Number(n || 1)));
    for (const [, el, n] of f.matchAll(/([A-Z][a-z]?)(\d*)/g)) count[el] = (count[el] ?? 0) + c * Number(n || 1);
  }
  return count;
}
const charge = (t: Terms) => (Object.entries(t) as [SpeciesId, number][]).reduce((s, [id, c]) => s + c * species[id].charge, 0);

describe('datos y fórmulas', () => {
  it('calcula masas molares con paréntesis', () => {
    expect(molarMass('NaHCO3')).toBeCloseTo(84.006, 2);
    expect(molarMass('Cu(OH)2')).toBeCloseTo(97.56, 1);
    expect(() => molarMass('Xx2')).toThrow();
  });
  it('todas las reglas conservan elementos y carga', () => {
    for (const rule of rules) {
      const { reactants, products } = rule.type === 'complete' ? rule : precipitation(rule);
      expect(elements(products), rule.id).toEqual(elements(reactants));
      expect(charge(products), rule.id).toBeCloseTo(charge(reactants), 10);
    }
  });
  it('cada reactivo del estante es neutro y tiene datos completos', () => {
    expect(reagentIds).toHaveLength(27);
    for (const id of reagentIds) { const r = reagents[id]; if (r.kind === 'solution') expect(charge(r.components), id).toBe(0); }
  });
});

describe('acidez, calor y gases', () => {
  it('calcula el pH de ácidos y bases fuertes y del ácido acético', () => {
    expect(solvePH(run([['water', 100]]).mix)).toBeCloseTo(7, 2);
    expect(solvePH(run([['hcl', 10], ['water', 90]]).mix)).toBeCloseTo(1, 1);
    expect(solvePH(run([['naoh', 10], ['water', 90]]).mix)).toBeCloseTo(13, 1);
    expect(solvePH(run([['acetic', 100]]).mix)).toBeCloseTo(2.41, 1);
    expect(solvePH(emptyMixture())).toBeNull();
    // Hydrated metal ions are weak acids: CuSO₄ 0,1 mol/L and FeCl₃ 0,1 mol/L are acidic.
    const copper = solvePH(run([['cuso4', 20], ['water', 80]]).mix)!;
    expect(copper).toBeGreaterThan(3.6); expect(copper).toBeLessThan(4.5);
    expect(solvePH(run([['fecl3', 100]]).mix)).toBeLessThan(2.2);
  });
  it('neutraliza HCl con NaOH y calienta la mezcla con ΔH ≈ −55,8 kJ/mol', () => {
    const { mix, events, deltaT } = run([['hcl', 100], ['naoh', 100]]);
    expect(events[0].rule).toBe('neutral-strong');
    expect(events[0].deltaH).toBeCloseTo(-55.8, 1);
    expect(solvePH(mix)).toBeCloseTo(7, 1);
    expect(deltaT).toBeCloseTo(6.6, 0);
  });
  it('reproduce el vinagre con bicarbonato: CO₂ 1:1, ácido limitante y enfriamiento', () => {
    const { mix, events, deltaT } = run([['acetic', 50], ['nahco3', 5]]);
    expect(mix.released.CO2).toBeCloseTo(0.0415, 4);
    expect(events.some(e => e.gas?.id === 'CO2')).toBe(true);
    expect(deltaT).toBeLessThan(0);
    expect(analyzeMixture(mix).gases[0].litres).toBeCloseTo(1.015, 2);
  });
  it('libera CO₂ solo después de convertir el carbonato en bicarbonato', () => {
    const first = run([['na2co3', 20], ['hcl', 10]]);
    expect(first.mix.released.CO2 ?? 0).toBe(0);
    const second = addReagent(first.mix, 'hcl', 15);
    // 10 mmol HCO₃⁻ are protonated; the remaining 5 mmol H⁺ stay in excess.
    expect(second.mixture.released.CO2).toBeCloseTo(0.01, 6);
  });
  it('el magnesio libera hidrógeno y el cobre no reacciona con HCl', () => {
    const mg = run([['hcl', 100], ['mg', 0.5]]);
    expect(mg.mix.released.H2).toBeCloseTo(0.5 / molarMass('Mg'), 6);
    expect(mg.deltaT).toBeGreaterThan(15);
    const cu = run([['hcl', 100], ['cu', 1]]);
    expect(cu.events).toHaveLength(0);
  });
  it('descompone H₂O₂ solo con catalizador y conserva el yoduro', () => {
    expect(run([['h2o2', 50]]).mix.released.O2 ?? 0).toBe(0);
    const { mix } = run([['h2o2', 50], ['ki', 5]]);
    expect(mix.released.O2).toBeCloseTo(0.882 * 0.05 / 2, 6);
    expect(mix.n['I-']).toBeCloseTo(0.5 * 0.005, 9);
  });
  it('el cloruro de calcio calienta y el nitrato de amonio enfría', () => {
    expect(run([['water', 100], ['cacl2', 5]]).deltaT).toBeGreaterThan(5);
    expect(run([['water', 100], ['nh4no3', 5]]).deltaT).toBeLessThan(-3);
  });
});

describe('precipitados y solubilidad', () => {
  it('forma AgCl casi completo y lo deja en el fondo', () => {
    const { mix, events } = run([['agno3', 20], ['nacl', 10]]);
    const solid = analyzeMixture(mix).solids.find(s => s.id === 'AgCl');
    expect(events.some(e => e.kind === 'precipitado' && e.solid?.id === 'AgCl')).toBe(true);
    expect(solid?.mol).toBeCloseTo(0.002, 6);
  });
  it('PbCl₂ es poco soluble: precipita solo parcialmente y se redisuelve al diluir', () => {
    const { mix } = run([['pbno3', 50], ['nacl', 20]]);
    const before = mix.n.PbCl2 ?? 0;
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(0.005);
    const diluted = addReagent(mix, 'water', 200).mixture;
    expect(diluted.n.PbCl2 ?? 0).toBeLessThan(before);
  });
  it('forma la lluvia de oro de PbI₂ y Cu(OH)₂ azul que se disuelve en ácido', () => {
    expect(run([['pbno3', 20], ['ki', 10]]).mix.n.PbI2).toBeGreaterThan(0.0019);
    const blue = run([['cuso4', 10], ['naoh', 10]]);
    expect(blue.mix.n['Cu(OH)2']).toBeCloseTo(0.005, 6);
    const dissolved = addReagent(blue.mix, 'hcl', 20).mixture;
    expect(dissolved.n['Cu(OH)2'] ?? 0).toBeLessThan(1e-9);
  });
  it('respeta el límite de solubilidad del bicarbonato en poca agua', () => {
    const { mix } = run([['water', 10], ['nahco3', 5]]);
    expect(mix.n['NaHCO3(s)']).toBeGreaterThan(0.04);
  });
  it('desplaza cobre con cinc y conserva la carga de la disolución', () => {
    const { mix } = run([['cuso4', 20], ['zn', 1]]);
    expect(mix.n.Cu).toBeCloseTo(0.01, 6);
    const total = (Object.entries(mix.n) as [SpeciesId, number][]).reduce((s, [id, n]) => s + species[id].charge * n, 0);
    expect(Math.abs(total)).toBeLessThan(1e-9);
  });
});

describe('colores y validación', () => {
  it('la fenolftaleína se vuelve rosa en base y el almidón azul con yodo', () => {
    expect(analyzeMixture(run([['water', 50], ['phenolphthalein', 3]]).mix).color.opacity).toBeLessThan(0.35);
    expect(analyzeMixture(run([['naoh', 20], ['phenolphthalein', 3]]).mix).color.color).toBe('#e0218a');
    const iodine = analyzeMixture(run([['fecl3', 20], ['ki', 10], ['starch', 3]]).mix).color.color;
    const [r, g, b] = [1, 3, 5].map(i => parseInt(iodine.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r); expect(r + g + b).toBeLessThan(260);
  });
  it('el permanganato pierde el violeta con peróxido en medio ácido', () => {
    const { mix } = run([['kmno4', 10], ['h2so4', 10], ['h2o2', 10]]);
    expect(mix.n['MnO4-'] ?? 0).toBeLessThan(1e-9);
    expect(mix.released.O2).toBeGreaterThan(0);
  });
  it('rechaza cantidades fuera de rango y desbordes', () => {
    expect(() => addReagent(emptyMixture(), 'hcl', 0)).toThrow();
    expect(() => addReagent(emptyMixture(), 'mg', 3)).toThrow();
    const full = run([['water', 200], ['water', 200]]).mix;
    expect(() => addReagent(full, 'water', 150)).toThrow(/desbordaría/);
  });
  it('sin agua los sólidos no reaccionan', () => {
    const out = run([['nahco3', 2], ['caco3', 2]]);
    expect(out.events).toHaveLength(0);
  });
});
