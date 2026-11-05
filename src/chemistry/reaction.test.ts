import { describe, expect, it } from 'vitest';
import { calculateReaction, MOLAR_MASS_BICARBONATE } from './reaction';
describe('vinagre y bicarbonato: relación molar 1:1', () => {
  it('identifica ácido limitante y conserva los moles', () => {
    const r = calculateReaction({ vinegarMl: 50, concentration: 0.83, bicarbonateG: 5 });
    expect(r.co2Moles).toBeCloseTo(0.0415, 8);
    expect(r.limiting).toBe('Ácido acético');
    expect(r.bicarbonateRemaining + r.co2Moles).toBeCloseTo(5 / MOLAR_MASS_BICARBONATE, 10);
    expect(r.co2Litres).toBeCloseTo(1.0153, 3);
  });
  it('identifica bicarbonato limitante', () => {
    const r = calculateReaction({ vinegarMl: 100, concentration: 1, bicarbonateG: 1 });
    expect(r.co2Moles).toBeCloseTo(1 / MOLAR_MASS_BICARBONATE, 10);
    expect(r.limiting).toBe('Bicarbonato de sodio');
    expect(r.acidRemaining + r.co2Moles).toBeCloseTo(0.1, 10);
  });
  it('detecta proporción exacta', () => expect(calculateReaction({ vinegarMl: 100, concentration: 1, bicarbonateG: MOLAR_MASS_BICARBONATE / 10 }).limiting).toBe('Proporción estequiométrica'));
  it.each([0, -1, NaN, Infinity, 151])('rechaza volumen inválido %s', vinegarMl => expect(() => calculateReaction({ vinegarMl, concentration: 1, bicarbonateG: 2 })).toThrow());
});
