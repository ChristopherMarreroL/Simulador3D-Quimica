import { expect, it } from 'vitest';
import { canStand, movePlayer } from './collisions';
it('bloquea paredes, muebles y el margen del jugador', () => {
  expect(canStand(0, 3.5)).toBe(true);
  expect(canStand(6, 0)).toBe(false);
  expect(canStand(1.25, -0.5)).toBe(false);
  expect(canStand(-3.15, -3.5)).toBe(false);
  expect(canStand(-3.15, -3.2)).toBe(true);
});
it('permite pasar por las esquinas recortadas que antes bloqueaba la caja invisible', () => {
  expect(canStand(-0.7, 0.45)).toBe(true);
});
it('no retrocede ni atraviesa muebles al deslizarse junto a una mesa', () => {
  let p = { x: -1.2, z: 1.3 };
  for (let i = 0; i < 180; i++) {
    const next = movePlayer(p.x, p.z, 0.025, -0.025);
    expect(next.x).toBeGreaterThanOrEqual(p.x - 1e-10);
    expect(next.z).toBeLessThanOrEqual(p.z + 1e-10);
    expect(canStand(next.x, next.z)).toBe(true);
    p = next;
  }
});
it('detiene un desplazamiento largo sin cruzar la mesa ni la pared', () => {
  const p = movePlayer(0, 3.5, 0, -10);
  expect(canStand(p.x, p.z)).toBe(true);
  expect(p.z).toBeGreaterThan(0.6);
});
it('mantiene acceso a los reactivos y la mesa entre las nuevas islas', () => {
  expect(canStand(0, 3.5)).toBe(true);
  expect(canStand(-1.2, 1.8)).toBe(true);
  expect(canStand(-1.2, -2.4)).toBe(true);
  expect(canStand(-2.1, -3.2)).toBe(true);
  expect(canStand(0.2, 0.8)).toBe(true);
  expect(canStand(-2.8, 0.8)).toBe(false);
  expect(canStand(2.7, 2.7)).toBe(false);
  expect(canStand(-2.8, 2.1)).toBe(false);
  expect(canStand(5.25, 0.8)).toBe(false);
});
