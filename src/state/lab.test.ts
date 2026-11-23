import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLab, guidedIndex } from './lab';
const saved = new Map<string, string>();
// Asignación directa en lugar de vi.stubGlobal para que también funcione con `bun test`.
const stubGlobal = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
stubGlobal('localStorage', { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => saved.set(k, v) });
stubGlobal('document', { pointerLockElement: null });
const s = () => useLab.getState();
function useTarget(id: string) { s().setTarget(id); s().interact(); }
beforeEach(() => { vi.useFakeTimers(); s().reset(); useLab.setState({ tutorialDone: true, records: [] }); s().start('guided'); });
describe('flujo de laboratorio', () => {
  it('exige acciones del tutorial y conserva su finalización', () => {
    useLab.setState({ tutorialDone: false }); s().start('free');
    expect(s().mode).toBe('tutorial'); useTarget('beaker'); expect(s().locations.beaker).toBe('shelf');
    s().progress('move', 1.1); s().progress('look', 151); s().setTarget('beaker'); expect(s().tutorial).toBe(3);
    s().interact(); s().selectHand('left'); useTarget('bench'); expect(s().tutorial).toBe(6);
    s().interact(); expect(s().tutorialDone).toBe(true); expect(s().mode).toBe('free');
    expect(saved.get('experimenta.tutorial.v1')).toBe('true');
  });
  it('no permite recoger un tercer objeto y solo vierte reactivos transportados', () => {
    useTarget('beaker'); useTarget('vinegar'); expect(s().locations.vinegar).toBe('shelf');
    s().add('vinegar', 50); vi.runAllTimers(); expect(s().vinegarMl).toBe(0);
  });
  it('completa una práctica y registra cantidades calculadas', () => {
    useTarget('beaker'); useTarget('bench'); expect(guidedIndex(s())).toBe(2);
    useTarget('vinegar'); s().add('vinegar', 50); expect(s().vinegarMl).toBe(0); vi.advanceTimersByTime(1800);
    expect(s().vinegarMl).toBe(50); s().selectHand('left'); useTarget('bicarbonate'); s().add('bicarbonate', 5); vi.advanceTimersByTime(1800);
    expect(guidedIndex(s())).toBe(6); expect(s().records).toHaveLength(1); expect(s().records[0].result.co2Moles).toBeCloseTo(0.0415);
    s().saveObservation('Se liberan burbujas.'); expect(s().records[0].observation).toBe('Se liberan burbujas.');
  });
  it('cancela transferencias al limpiar o salir', () => {
    useTarget('beaker'); useTarget('bench'); useTarget('vinegar'); s().add('vinegar', 50); s().reset(); vi.runAllTimers(); expect(s().vinegarMl).toBe(0);
    s().add('vinegar', 50); s().menu(); vi.runAllTimers(); expect(s().vinegarMl).toBe(0);
  });
  it('rechaza valores no finitos y bicarbonato antes del vinagre', () => {
    useTarget('beaker'); useTarget('bench'); useTarget('vinegar'); s().add('vinegar', NaN); expect(s().pouring).toBeNull();
    s().selectHand('left'); useTarget('bicarbonate'); s().add('bicarbonate', 2); expect(s().pouring).toBeNull();
  });
  it('devuelve frascos a Reactivos y material con Q sin alterar la mezcla', () => {
    useTarget('beaker'); useTarget('bench'); useTarget('vinegar');
    s().add('vinegar', 50); vi.advanceTimersByTime(1800);
    s().setTarget('shelf'); s().drop();
    expect(s().locations.vinegar).toBe('shelf'); expect(s().vinegarMl).toBe(50);
    expect(Object.values(s().locations)).not.toContain('right');
    useTarget('bicarbonate'); s().setTarget('vinegar'); s().drop();
    expect(s().locations.bicarbonate).toBe('shelf');
  });
  it('vacía el vaso y permite recogerlo sin borrar el registro del experimento', () => {
    useTarget('beaker'); useTarget('bench'); useTarget('vinegar'); s().add('vinegar', 50); vi.advanceTimersByTime(1800);
    s().setTarget('shelf'); s().drop(); useTarget('bicarbonate'); s().add('bicarbonate', 5); vi.advanceTimersByTime(1800);
    s().setTarget('shelf'); s().drop(); useTarget('beaker');
    expect(s().panel).toBe('results'); expect(s().locations.beaker).toBe('bench');
    s().reset(); s().open(null); useTarget('beaker');
    expect(s().locations.beaker).toBe('right'); expect(s().records).toHaveLength(1); expect(s().vinegarMl).toBe(0);
  });
  it('coloca instrumentos en ambas mesas de apoyo y permite volver a recogerlos', () => {
    useTarget('beaker'); s().setTarget('support-1'); s().drop(); expect(s().locations.beaker).toBe('support-1');
    useTarget('beaker'); s().setTarget('support-2'); s().drop(); expect(s().locations.beaker).toBe('support-2');
    useTarget('beaker'); expect(s().locations.beaker).toBe('right');
  });
  it('actualiza el objetivo al devolver un reactivo sin usarlo', () => {
    useTarget('beaker'); useTarget('bench'); useTarget('vinegar'); expect(guidedIndex(s())).toBe(3);
    s().setTarget('shelf'); s().drop(); expect(guidedIndex(s())).toBe(2);
  });
  it('abre las prácticas nuevas desde las mesas y mantiene el tutorial obligatorio', () => {
    useTarget('support-1'); expect(s().panel).toBe('conductivity'); expect(s().activePractice).toBe('conductivity');
    useTarget('support-2'); expect(s().panel).toBe('dissolution');
    s().start('tutorial'); useTarget('support-1'); expect(s().panel).toBeNull(); expect(s().mode).toBe('tutorial');
  });
});
