import { beforeEach, expect, it, vi } from 'vitest';
const saved = new Map<string, string>();
// Direct assignment instead of vi.stubGlobal so this file also runs with `bun test`.
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => saved.set(k, v) }, configurable: true, writable: true });
Object.defineProperty(globalThis, 'document', { value: { pointerLockElement: null }, configurable: true, writable: true });
const { useHood, HOOD_TRAY_SLOTS, POUR_MS, hoodGuidedIndex, recipeSteps } = await import('./hood');
const { recipeById } = await import('../experiments/hoodRecipes');
const { useLab } = await import('./lab');
const h = () => useHood.getState(), lab = () => useLab.getState();
const aimAndPress = (target: string, key: 'E' | 'Q' = 'E') => { lab().setTarget(target); if (key === 'E') lab().interact(); else lab().drop(); };
beforeEach(() => { vi.useFakeTimers(); useLab.setState({ tutorialDone: true, records: [] }); lab().start('free'); useLab.setState({ ppe: { goggles: true, gloves: true } }); useHood.setState({ records: [] }); });

it('exige gafas y guantes antes de tocar los reactivos', () => {
  useLab.setState({ ppe: { goggles: false, gloves: false } });
  aimAndPress('reagent:hcl');
  expect(h().places.hcl).toBe('shelf'); expect(lab().message).toMatch(/gafas y los guantes/);
  aimAndPress('ppe-goggles'); aimAndPress('ppe-gloves');
  expect(lab().ppe).toEqual({ goggles: true, gloves: true });
  aimAndPress('reagent:hcl'); expect(h().places.hcl).toBe('right');
});

it('comparte las manos con el vaso y devuelve frascos con Q', () => {
  aimAndPress('reagent:hcl');
  expect(h().places.hcl).toBe('right');
  aimAndPress('reagent:naoh');
  expect(h().places.naoh).toBe('shelf');
  expect(lab().message).toMatch(/ocupada/);
  lab().selectHand('left'); aimAndPress('beaker');
  expect(lab().locations.beaker).toBe('left');
  lab().selectHand('right'); aimAndPress('reagent-shelf', 'Q');
  expect(h().places.hcl).toBe('shelf');
});
it('limita la bandeja de la campana y no permite verter con la ventana cerrada', () => {
  const ids = ['hcl', 'naoh', 'agno3', 'nacl', 'ki', 'cuso4', 'fecl3', 'zn', 'mg'] as const;
  for (const id of ids) { aimAndPress(`reagent:${id}`); aimAndPress('hood', 'Q'); }
  expect(Object.values(h().places).filter(p => p === 'hood')).toHaveLength(HOOD_TRAY_SLOTS);
  expect(h().places.mg).toBe('right');
  h().setSash('closed');
  expect(h().pour('hcl', 10)).toBe(false);
  expect(h().error).toMatch(/cerrada/);
});
it('vierte tras la animación, registra la reacción y guarda la mezcla', () => {
  useHood.setState({ places: { ...h().places, agno3: 'hood', nacl: 'left' } });
  expect(hoodGuidedIndex(h())).toBe(1);
  expect(h().pour('agno3', 20)).toBe(true);
  expect(h().mixture.additions).toHaveLength(0);
  vi.advanceTimersByTime(POUR_MS);
  expect(h().mixture.additions).toHaveLength(1);
  h().pour('nacl', 5); vi.advanceTimersByTime(POUR_MS);
  expect(h().log.at(-1)!.events.some(e => e.rule === 'ksp-AgCl')).toBe(true);
  expect(h().burst?.solidColor).toBeTruthy();
  expect(hoodGuidedIndex(h())).toBe(3);
  h().save();
  expect(JSON.parse(saved.get('experimenta.hood.v1')!)).toHaveLength(1);
  h().empty();
  expect(h().mixture.additions).toHaveLength(0);
  expect(h().records).toHaveLength(1);
});
it('cancela el vertido al iniciar otra sesión o salir al menú', () => {
  useHood.setState({ places: { ...h().places, water: 'hood' } });
  h().pour('water', 50); lab().menu(); vi.runAllTimers();
  expect(h().mixture.additions).toHaveLength(0);
  lab().start('free');
  expect(h().places.water).toBe('shelf');
});
it('añade indicadores gota a gota pero obliga a medir líquidos y pesar sólidos', () => {
  useHood.setState({ places: { ...h().places, universal: 'right', hcl: 'left', mg: 'hood' } });
  expect(h().startStream('hcl')).toBe(false); expect(h().error).toMatch(/probeta/);
  expect(h().startStream('mg')).toBe(false); expect(h().error).toMatch(/balanza/);
  expect(h().startStream('universal')).toBe(true);
  vi.advanceTimersByTime(400); for (let i = 0; i < 15; i++) h().streamTick(0.1); h().stopStream(); // ≈ 2 drops/s
  const drops = h().mixture.additions.find(a => a.reagent === 'universal');
  expect(drops?.amount).toBe(3); expect(h().log.filter(l => l.reagent === 'universal')).toHaveLength(1);
});
it('mide en la probeta, la vierte en el matraz y exige enjuagarla antes de otro reactivo', () => {
  useHood.setState({ places: { ...h().places, hcl: 'right', naoh: 'left' } });
  expect(h().startStream('hcl', 'cylinder')).toBe(true);
  vi.advanceTimersByTime(400); for (let i = 0; i < 25; i++) h().streamTick(0.1); h().stopStream(); // 2,5 s at 8 mL/s
  expect(h().cylinder.reagent).toBe('hcl'); expect(h().cylinder.ml).toBeCloseTo(20, 5);
  expect(h().mixture.additions).toHaveLength(0);
  expect(h().pourCylinder()).toBe(true); vi.advanceTimersByTime(POUR_MS);
  expect(h().mixture.additions).toEqual([{ reagent: 'hcl', amount: 20 }]);
  expect(h().cylinder).toEqual({ reagent: null, ml: 0, dirty: 'hcl' });
  expect(h().startStream('naoh', 'cylinder')).toBe(false); expect(h().error).toMatch(/Enjuágala/);
  expect(h().rinseCylinder()).toBe(true); vi.advanceTimersByTime(1000);
  expect(h().cylinder.dirty).toBeNull();
  expect(h().startStream('naoh', 'cylinder')).toBe(true); h().stopStream();
});
it('pesa sólidos con la espátula, los añade y desecha la mezcla en residuos', () => {
  useHood.setState({ places: { ...h().places, nahco3: 'right', acetic: 'hood' } });
  h().pour('acetic', 50); vi.advanceTimersByTime(POUR_MS);
  expect(h().startStream('nahco3', 'balance')).toBe(true);
  vi.advanceTimersByTime(4000); h().streamTick(1); h().streamTick(1); h().stopStream();
  expect(h().balance.grams).toBeGreaterThan(1.5);
  const grams = h().balance.grams;
  expect(h().pourBalance()).toBe(true); vi.advanceTimersByTime(POUR_MS);
  expect(h().mixture.additions.at(-1)?.amount).toBeCloseTo(Math.round(grams * 100) / 100, 6);
  expect(h().mixture.released.CO2).toBeGreaterThan(0);
  expect(h().dispose()).toBe(true); vi.advanceTimersByTime(POUR_MS);
  expect(h().mixture.additions).toHaveLength(0); expect(h().disposals).toBe(1);
});
it('sigue los pasos de un experimento guiado con el procedimiento real', () => {
  const def = recipeById('cloruro-plata')!;
  useLab.setState({ ppe: { goggles: false, gloves: false } });
  h().selectRecipe(def.id);
  const steps = () => recipeSteps(def, h().recipe!, h(), lab().ppe);
  const current = () => steps().find(st => !st.done)!;
  expect(current().key).toBe('ppe'); expect(current().targets.map(t => t.id)).toEqual(['ppe-goggles', 'ppe-gloves']);
  useLab.setState({ ppe: { goggles: true, gloves: true } });
  expect(current().key).toBe('collect'); expect(current().targets.map(t => t.id)).toEqual(['reagent:agno3', 'reagent:nacl']);
  useHood.setState({ places: { ...h().places, agno3: 'right', nacl: 'hood' } });
  expect(current().key).toBe('add-0'); expect(current().targets[0].id).toBe('hood-cylinder');
  h().startStream('agno3', 'cylinder'); vi.advanceTimersByTime(400); for (let i = 0; i < 25; i++) h().streamTick(0.1); h().stopStream();
  expect(current().targets[0].label).toMatch(/Verter/);
  h().pourCylinder(); vi.advanceTimersByTime(POUR_MS);
  expect(current().key).toBe('add-1'); expect(current().targets[0].id).toBe('hood-washbottle');
  h().rinseCylinder(); vi.advanceTimersByTime(1000);
  h().startStream('nacl', 'cylinder'); vi.advanceTimersByTime(400); for (let i = 0; i < 6; i++) h().streamTick(0.1); h().stopStream();
  h().pourCylinder(); vi.advanceTimersByTime(POUR_MS);
  expect(h().recipe!.observed).toBe(true);
  expect(current().key).toBe('save');
  h().save(); expect(current().key).toBe('dispose');
  h().dispose(); vi.advanceTimersByTime(POUR_MS);
  expect(steps().every(st => st.done)).toBe(true);
});

it('la pipeta se saca de su gabinete, aspira hasta 10 mL y descarga en el matraz', () => {
  // Sin la pipeta en su soporte no se puede aspirar.
  lab().selectHand('left'); aimAndPress('reagent:hcl');
  expect(h().startStream('hcl', 'pipette')).toBe(false); expect(h().error).toMatch(/gabinete de pipetas/);
  lab().selectHand('right'); aimAndPress('cabinet:pipetas'); aimAndPress('tool:pipette');
  expect(h().pipette.place).toBe('right');
  // La mano que lleva la pipeta está ocupada para otros objetos.
  aimAndPress('reagent:naoh'); expect(h().places.naoh).toBe('shelf'); expect(lab().message).toMatch(/ocupada/);
  aimAndPress('hood-pipette'); expect(h().pipette.place).toBe('hood');
  // Los sólidos no se aspiran; un líquido se detiene al llegar a 10 mL.
  expect(h().startStream('hcl', 'pipette')).toBe(true);
  vi.advanceTimersByTime(400); h().streamTick(2.5); h().stopStream();
  expect(h().pipette.ml).toBeCloseTo(5, 5); expect(h().pipette.reagent).toBe('hcl');
  expect(h().startStream('hcl', 'pipette')).toBe(true);
  vi.advanceTimersByTime(400); h().streamTick(60);
  expect(h().pipette.ml).toBe(10); expect(h().pouring).toBeNull(); expect(h().error).toMatch(/llena/);
  aimAndPress('hood-pipette');
  expect(h().transfer?.kind).toBe('pipette');
  vi.advanceTimersByTime(POUR_MS + 10);
  expect(h().mixture.additions).toEqual([{ reagent: 'hcl', amount: 10 }]);
  expect(h().pipette).toMatchObject({ place: 'hood', ml: 0, reagent: null, dirty: 'hcl' });
  // Con restos de otro reactivo hay que enjuagarla con la piseta.
  lab().selectHand('left'); aimAndPress('hood', 'Q'); aimAndPress('reagent:naoh');
  expect(h().startStream('naoh', 'pipette')).toBe(false); expect(h().error).toMatch(/Enjuágala/);
  aimAndPress('hood-washbottle'); vi.advanceTimersByTime(1000);
  expect(h().pipette.dirty).toBeNull();
  expect(h().startStream('naoh', 'pipette')).toBe(true); h().stopStream();
});
it('la pipeta no se guarda con líquido y vuelve a su gabinete con Q', () => {
  aimAndPress('tool:pipette'); expect(h().pipette.place).toBe('right');
  aimAndPress('bench', 'Q'); expect(h().pipette.place).toBe('right'); expect(lab().message).toMatch(/campana o al gabinete/);
  useHood.setState({ pipette: { ...h().pipette, reagent: 'hcl', ml: 3, dirty: 'hcl' } });
  aimAndPress('cabinet:pipetas', 'Q'); expect(h().pipette.place).toBe('right'); expect(lab().message).toMatch(/contiene líquido/);
  useHood.setState({ pipette: { ...h().pipette, reagent: null, ml: 0 } });
  aimAndPress('cabinet:pipetas', 'Q'); expect(h().pipette.place).toBe('cabinet');
});
