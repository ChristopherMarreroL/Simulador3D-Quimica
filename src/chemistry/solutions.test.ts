import { expect, it } from 'vitest';
import { conductivity, crystallization } from './solutions';
it('distingue agua, no electrolito y NaCl diluido con unidades coherentes', () => {
  expect(conductivity({ solution: 'water', concentration: 0.01 }).microSiemens).toBe(0.055);
  expect(conductivity({ solution: 'sugar', concentration: 0.01 }).brightness).toBe(0);
  expect(conductivity({ solution: 'salt', concentration: 0.01 }).microSiemens).toBeCloseTo(1264.055);
  expect(conductivity({ solution: 'salt', concentration: 0.02 }).ionMolarity).toBe(0.04);
});
it('rechaza concentraciones fuera del rango de la aproximación diluida', () => {
  for (const concentration of [NaN, Infinity, 0, -1, 0.021]) expect(() => conductivity({ solution: 'salt', concentration })).toThrow();
});
it('conserva agua y sal al evaporar y separa cristales nuevos del sólido inicial', () => {
  const r = crystallization({ waterG: 100, saltG: 20, evaporationPercent: 80 });
  expect(r.initialDissolved).toBe(20); expect(r.initialSolid).toBe(0);
  expect(r.newCrystals).toBeCloseTo(12.8); expect(r.dissolved + r.solid).toBeCloseTo(20);
  expect(r.remainingWater + r.evaporatedWater).toBeCloseTo(100);
});
it('no inventa cristales sin saturación y conserva el exceso sin disolver', () => {
  expect(crystallization({ waterG: 100, saltG: 5, evaporationPercent: 20 }).newCrystals).toBe(0);
  const r = crystallization({ waterG: 100, saltG: 50, evaporationPercent: 0 });
  expect(r.initialDissolved).toBe(36); expect(r.initialSolid).toBe(14); expect(r.newCrystals).toBe(0);
});
it('rechaza masas y fracciones inválidas', () => {
  expect(() => crystallization({ waterG: NaN, saltG: 20, evaporationPercent: 80 })).toThrow();
  expect(() => crystallization({ waterG: 100, saltG: 0, evaporationPercent: 80 })).toThrow();
  expect(() => crystallization({ waterG: 100, saltG: 20, evaporationPercent: 100 })).toThrow();
});
