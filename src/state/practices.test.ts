import { beforeEach, expect, it, vi } from 'vitest';
import { usePractices } from './practices';
const saved = new Map<string, string>();
// Asignación directa en lugar de vi.stubGlobal para que también funcione con `bun test`.
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) }, configurable: true, writable: true });
const p = () => usePractices.getState();
beforeEach(() => { vi.useFakeTimers(); p().cancelPending(); usePractices.setState({ records: [] }); });
it('exige preparar una solución y registra una medición completada una sola vez', () => {
  p().run('conductivity'); expect(p().sessions.conductivity).toBeUndefined();
  p().prepareConductivity({ solution: 'salt', concentration: 0.01 }); p().run('conductivity'); p().run('conductivity');
  expect(p().records).toHaveLength(0); vi.advanceTimersByTime(1800);
  expect(p().sessions.conductivity?.phase).toBe('done'); expect(p().records).toHaveLength(1);
});
it('exige disolver antes de evaporar y conserva un resultado verificable', () => {
  p().prepareDissolution({ waterG: 100, saltG: 20, evaporationPercent: 80 }); p().run('dissolution'); vi.advanceTimersByTime(1800);
  expect(p().sessions.dissolution?.phase).toBe('mixed'); expect(p().records).toHaveLength(0);
  p().run('dissolution'); vi.advanceTimersByTime(3000); expect(p().records).toHaveLength(1);
  const r = p().records[0]; if (r.kind === 'dissolution') expect(r.result.newCrystals).toBeCloseTo(12.8);
});
it('cancela acciones al limpiar o salir y preserva los ensayos ya guardados', () => {
  p().prepareConductivity({ solution: 'salt', concentration: 0.01 }); p().run('conductivity'); p().reset('conductivity'); vi.runAllTimers(); expect(p().records).toHaveLength(0);
  p().prepareConductivity({ solution: 'water', concentration: 0.01 }); p().run('conductivity'); vi.runAllTimers();
  p().annotate(p().records[0].id, 'La bombilla no se enciende.'); p().cancelPending();
  expect(p().records[0].observation).toBe('La bombilla no se enciende.');
  expect(saved.get('experimenta.practices.v1')).toContain('La bombilla no se enciende.');
});
it('no crea una sesión con cantidades inválidas', () => {
  expect(p().prepareDissolution({ waterG: 0, saltG: 20, evaporationPercent: 80 })).toBe(false);
  expect(p().sessions.dissolution).toBeUndefined(); expect(p().error).not.toBe('');
});
