import { expect, it } from 'vitest';
import { elements, families, matchesElement } from './elements';
import { periodicRows, symbols } from './periodic';
it('incluye exactamente 118 elementos coherentes con los símbolos y la distribución', () => {
  expect(elements).toHaveLength(118);
  expect([...periodicRows.flat().filter(Boolean)].sort((a, b) => a - b)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1));
  elements.forEach((e, i) => {
    expect(e.number).toBe(i + 1); expect(e.symbol).toBe(symbols[i]); expect(e.name).toBeTruthy();
    expect(families[e.family]).toBeDefined(); expect(e.period).toBeGreaterThan(0); expect(e.period).toBeLessThan(8);
  });
});
it('busca en español sin tildes, por símbolo y por número, y filtra familias', () => {
  expect(matchesElement(elements[0], 'hidrogeno', '')).toBe(true);
  expect(matchesElement(elements[10], 'Na', '')).toBe(true);
  expect(matchesElement(elements[25], '26', '')).toBe(true);
  expect(matchesElement(elements[10], '', 'Noble gas')).toBe(false);
});
it('conserva valores ausentes y propiedades predichas sin inventar cifras', () => {
  expect(elements[1].electronegativity).toBeNull();
  expect(elements[117].state).toContain('predicho');
  expect(elements[10].electronegativity).toBe(0.93);
  expect(elements[57].group).toBeNull(); expect(elements[57].period).toBe(6);
});
