import { molarMass } from '../../src/chemistry/formula';
import { rules } from '../../src/chemistry/sandbox';
import { species, speciesIds } from '../../src/chemistry/species';
import type { CaseSpec, Family, StepSpec, Trace } from '../lib/types';

/**
 * Familia «hueco»: comportamientos del motor que las familias 10–80 dejan sin caso (revisión de cobertura
 * hecha reproduciendo golden/chemistry.json con una copia instrumentada del motor). Solo se describen
 * entradas; cada caso se comprueba con `ctx.trace` al generarlo, de modo que el archivo falla si el motor
 * deja de hacer lo que el «why» afirma.
 */

/** «agno3 50, ki 10» → pasos; «universal 1 x12» repite el paso. */
const seq = (text: string): StepSpec[] => text.split(',').flatMap(part => {
  const [reagent, amount, times] = part.trim().split(/\s+/);
  return Array.from({ length: times ? Number(times.slice(1)) : 1 }, () => ({ reagent, amount: Number(amount) }));
});
const order = new Map(rules.map((rule, index) => [rule.id, index]));
const R = (...ids: string[]) => { for (const id of ids) if (!order.has(id)) throw new Error(`90: la regla «${id}» no existe.`); return ids; };
/** «regla (n.º)» para explicar prioridades. */
const p = (id: string) => `${R(id)[0]} (n.º ${order.get(id)})`;
const need = (ok: boolean, message: string) => { if (!ok) throw new Error(`90: ${message}`); };

/** Listas de analyzeMixture reconstruidas a partir de una traza (mismos umbrales y operaciones que el motor). */
const solidGrams = (t: Trace) => speciesIds.filter(id => species[id].phase === 's' && (t.n[id] ?? 0) > 1e-7).map(id => t.n[id] * molarMass(species[id].formula));
const molarities = (t: Trace) => speciesIds.filter(id => species[id].phase === 'aq' && id !== 'H+' && id !== 'OH-' && (t.n[id] ?? 0) / (t.waterMl / 1000) > 1e-5).map(id => t.n[id] / (t.waterMl / 1000));
/** Número de empates exactos entre vecinos una vez ordenada la lista. */
const ties = (values: number[]) => [...values].sort((a, b) => b - a).filter((v, i, all) => i > 0 && v === all[i - 1]).length;

const DEC = 'peroxide-decomposition';

const family: Family = ctx => {
  const cases: CaseSpec[] = [];
  /** Registra el caso; `at(i)` es el estado tras los i primeros pasos y `only(i)` las reglas con evento solo desde el paso i. */
  const add = (name: string, why: string, text: string, fire: string[] = [], notFire: string[] = []) => {
    const steps = seq(text);
    cases.push({ id: `hueco/${name}`, fn: 'sequence', why, steps, ...(fire.length ? { mustFire: R(...fire) } : {}), ...(notFire.length ? { mustNotFire: R(...notFire) } : {}) });
    const at = (i: number) => ctx.trace(steps.slice(0, i));
    const end = at(steps.length);
    need(end.errors.every(e => e === null), `${name}: ningún paso debía dar error.`);
    return { at, end, last: steps.length };
  };

  // ───────────── gases ─────────────
  {
    const c = add('tres-gases', 'Los tres gases a la vez en `released` y en la lista de gases: CO2 (vinagre + bicarbonato), H2 (Mg + acético) y O2 (H2O2 + KI); un segundo trozo de Mg acumula más H2 sin tocar los otros dos.',
      'acetic 50, nahco3 1, mg 0.2, h2o2 10, ki 2, mg 0.2', ['bicarbonate-solid-acetic', 'metal-Mg-HAc', DEC], ['peroxide-iodide']);
    const five = c.at(5).released;
    need(five.CO2 > 1e-7 && five.H2 > 1e-7 && five.O2 > 1e-7, 'tres-gases: deben estar los tres gases tras el quinto paso.');
    need(c.end.released.H2 > five.H2 && c.end.released.CO2 === five.CO2 && c.end.released.O2 === five.O2, 'tres-gases: el último paso solo debe acumular H2.');
  }
  {
    const c = add('gas-bajo-umbral', 'Gas liberado por debajo de 1e-7 mol: quedan 5e-8 mol de H+ tras neutralizar, el Zn libera 2,5e-8 mol de H2 sin evento visible; el H2 está en `released` pero no en la lista de gases, y el pH sube de 4,9 a 7,0 en un paso «sin cambios».',
      'hcl 2, naoh 1.99995, zn 0.05', ['neutral-strong'], ['metal-Zn-H+']);
    need(c.end.released.H2 > 1e-8 && c.end.released.H2 < 1e-7 && c.end.n['H+'] === undefined && c.end.n['Zn2+'] > 0, 'gas-bajo-umbral: el H2 debe quedar entre 1e-8 y 1e-7 mol.');
  }

  // ───────────── goteo ─────────────
  {
    const c = add('goteo-12-gotas', 'Doce gotas de indicador de una en una sobre 0,05 g de bicarbonato seco (más de las 10 que admite una sola adición): cada gota disuelve sólido hasta saturar, la undécima disuelve el resto y la duodécima solo diluye y da la nota del indicador; el indicador no se duplica.',
      'nahco3 0.05, universal 1 x12', ['ksp-NaHCO3(s)']);
    need(c.at(11).n['NaHCO3(s)'] > 1e-6 && c.at(12).n['NaHCO3(s)'] === undefined, 'goteo: el sólido debe agotarse justo en la undécima gota.');
    need(c.end.fired['ksp-NaHCO3(s)'] === c.at(12).fired['ksp-NaHCO3(s)'] && Math.abs(c.end.waterMl - 0.6) < 1e-9, 'goteo: la duodécima gota no debe disolver nada.');
  }

  // ───────────── catalizador en traza ─────────────
  {
    const c = add('catalizador-traza-y-dilucion', 'Umbral del catalizador en moles absolutos (1e-9): con AgI estequiométrico quedan 4e-10 mol de I- libre y el H2O2 no se descompone; añadir 100 mL de agua redisuelve AgI hasta 1,6e-9 mol de I- y, sin más reactivo que agua, todo el peróxido se descompone.',
      'agno3 20, ki 4, h2o2 10, water 100', ['ksp-AgI', DEC]);
    const before = c.at(3);
    need(before.n['I-'] > 1e-15 && before.n['I-'] < 0.6e-9 && before.n.H2O2 > 8e-3 && !(DEC in before.fired), 'catalizador: antes del agua debe quedar I- en traza y el H2O2 intacto.');
    need(c.end.n['I-'] > 1.4e-9 && c.end.n.H2O2 === undefined && c.end.released.O2 > 4e-3, 'catalizador: el agua debe activar la descomposición.');
  }

  // ───────────── orden de listas largas (ordenación estable) ─────────────
  {
    const c = add('orden-17-disueltos', 'Lista de disueltos con 17 especies y empates exactos (NO3- = NH4+ y SO4-2 = Cu2+ = Fe3+): una ordenación no estable (std::sort por encima de 16 elementos, Sort de Unreal) puede cambiar el orden que fija speciesIds.',
      'water 60, hcl 30, mg 0.05, zn 0.05, fe 0.5, kmno4 10, ki 1, caco3 0.05, nh4no3 0.05, cuso4 1, acetic 1, naoh 4.4, h2o2 1',
      ['metal-Mg-H+', 'metal-Zn-H+', 'metal-Fe-H+', 'permanganate-iron', 'iron-iodide', 'acid-CaCO3-H+', 'neutral-strong', 'neutral-acetic'], ['ksp-CaSO4', DEC]);
    const list = molarities(c.end);
    need(list.length === 17 && ties(list) === 3 && solidGrams(c.end).length === 0, `orden-17-disueltos: ${list.length} disueltos y ${ties(list)} empates.`);
    need(c.end.n['SO4-2'] === c.end.n['Cu2+'] && c.end.n['Cu2+'] === c.end.n['Fe3+'] && c.end.n['NO3-'] === c.end.n['NH4+'], 'orden-17-disueltos: los empates deben ser exactos.');
  }
  {
    const c = add('orden-8-solidos-en-seco', 'Ocho sólidos de 1,5 g sobre el matraz seco, añadidos en orden inverso al de speciesIds: los ocho empatan en gramos exactos y la lista sale en el orden de speciesIds; al añadir agua se disuelven las tres sales y quedan Cu, Fe, Mg y Zn empatados por delante del CaCO3, que ha perdido 2e-9 mol.',
      'nahco3 1.5, nh4no3 1.5, zn 1.5, mg 1.5, fe 1.5, cu 1.5, cacl2 1.5, caco3 1.5, water 50', ['ksp-NaHCO3(s)', 'ksp-NH4NO3(s)', 'ksp-CaCl2(s)']);
    const dry = solidGrams(c.at(8)), wet = solidGrams(c.end);
    need(dry.length === 8 && ties(dry) === 7 && c.at(8).pH === null, `orden-8-solidos: ${dry.length} sólidos y ${ties(dry)} empates en seco.`);
    need(wet.length === 5 && ties(wet) === 3, `orden-8-solidos: ${wet.length} sólidos y ${ties(wet)} empates con agua.`);
  }
  {
    const c = add('orden-10-solidos', 'Diez sólidos a la vez (Cu y Fe empatados en 1,5 g exactos, Zn redepositado, CaCO3, Mg, BaSO4, Pb, Mg(OH)2, Ag y MnO2): Ag y Pb depositados por el Zn, el Mg redeposita el Zn y gasta el H+ del sulfúrico, y el MnO2 se forma al final en medio básico.',
      'agno3 10, zn 1, pbno3 10, cu 1.5, fe 1.5, mg 1, bacl2 10, h2so4 2, naoh 6, caco3 1, kmno4 5, h2o2 1',
      ['metal-Zn-Ag+', 'metal-Zn-Pb2+', 'metal-Mg-Zn2+', 'metal-Mg-H+', 'ksp-BaSO4', 'ksp-Mg(OH)2', 'permanganate-peroxide-neutral', DEC]);
    const list = solidGrams(c.end);
    need(list.length === 10 && ties(list) === 1 && c.end.n.Cu * molarMass('Cu') === c.end.n.Fe * molarMass('Fe'), `orden-10-solidos: ${list.length} sólidos y ${ties(list)} empates.`);
  }

  {
    // Fragilidad buscada (⚑ orden-solidos): (1 / 63,546) · 63,546 no devuelve 1 en doble precisión.
    const c = add('un-gramo-de-cobre-no-empata', 'Un gramo de Zn, de Cu y de Fe en seco: el Cu pesa 0,9999999999999999 g porque (1 / 63,546) · 63,546 pierde un bit, así que la lista es Fe, Zn (empate exacto, orden de speciesIds) y Cu al final, aunque el Cu va antes en speciesIds.',
      'zn 1, cu 1, fe 1');
    const g = (id: 'Zn' | 'Cu' | 'Fe') => c.end.n[id] * molarMass(id);
    need(g('Zn') === 1 && g('Fe') === 1 && g('Cu') < 1 && g('Cu') > 1 - 1e-15, 'un-gramo-de-cobre: el Cu debe quedar un bit por debajo de 1 g.');
  }

  // ───────────── almidón con yodo en traza ─────────────
  {
    const c = add('almidon-yodo-en-traza', 'Almidón con yodo en traza: el Fe3+ oxida sin evento visible el I- que suelta el AgI, unos 3e-8 mol de I2 por adición (no converge); con 3 gotas de almidón el yodo está en 1,4e-6 mol/L y no hay azul, una gota más lo sube por encima de 2e-6 mol/L y aparece la capa azul aunque la nota diga que no hay cambios; 1 mL de KI forma yodo visible y activa heatUnknown.',
      'agno3 20, ki 4, fecl3 20, starch 3, starch 1, ki 1', ['ksp-AgI', 'iron-iodide']);
    const iodine = (t: Trace) => t.n.I2 / (t.waterMl / 1000);
    const below = c.at(4), above = c.at(5);
    need(iodine(below) > 1.2e-6 && iodine(below) < 1.6e-6 && iodine(above) > 2.05e-6 && iodine(above) < 2.5e-6, `almidon: yodo ${iodine(below)} y ${iodine(above)} mol/L.`);
    need(!above.heatUnknown && !('iron-iodide' in above.fired), 'almidon: hasta la gota suelta no debe haber evento ni heatUnknown.');
    need(iodine(c.end) > 1e-3 && c.end.heatUnknown, 'almidon: el último paso debe formar yodo visible.');
  }

  // ───────────── cascadas y reparto ─────────────
  {
    const chain = ['neutral-strong', 'carbonate-strong', 'ammonia-strong', 'co2-strong', 'acetate-strong', 'acid-Fe(OH)3-H+', 'acid-CaCO3-H+', 'metal-Zn-Fe3+', 'metal-Zn-H+', 'metal-Fe-H+'];
    const c = add('cascada-diez-eventos', `Una sola adición de HCl recorre diez consumidores en una pasada y da diez eventos en el orden de la lista: OH- (n.º ${order.get(chain[0])}), CO3-2, NH3, HCO3-, acetato, Fe(OH)3, CaCO3, el Fe3+ liberado con Zn, Zn y Fe (n.º ${order.get(chain[9])}), que se queda con el último H+.`,
      'naoh 30, nh4no3 0.8, acetic 6, na2co3 10, fecl3 10, caco3 1, zn 0.5, fe 0.5, hcl 85', chain);
    const before = c.at(c.last - 1);
    need(chain.every(rule => !(rule in before.fired)), 'cascada: ninguna de las diez reglas debía dispararse antes del HCl.');
    need(c.end.n['H+'] === undefined && c.end.n.Zn === undefined && c.end.n.Fe > 1e-3, 'cascada: debe agotarse el H+ y el Zn y sobrar Fe.');
  }
  {
    const c = add('carbonato-escaso-cinco-cationes', `Na2CO3 en porciones frente a H+, Pb2+, Ba2+, Ca2+, Zn2+ y Mg2+: H+ (${p('carbonate-strong')}) → ${p('ksp-PbCO3')} → ${p('ksp-BaCO3')} → ${p('ksp-CaCO3')}; el ZnCO3 (${p('ksp-ZnCO3')}), menos soluble que BaCO3 y CaCO3, solo crece por metátesis lenta tras ellos y el MgCO3 no llega a precipitar.`,
      'hcl 6, mg 0.05, zn 0.05, water 200, bacl2 20, pbno3 10, cacl2 0.1, na2co3 2 x5', ['carbonate-strong', 'ksp-PbCO3', 'ksp-BaCO3', 'ksp-CaCO3', 'ksp-ZnCO3'], ['ksp-MgCO3', 'ksp-PbCl2', 'co2-strong']);
    const first = c.at(8), second = c.at(9);
    need(first.n.PbCO3 > 6e-4 && first.n.BaCO3 === undefined && second.n.BaCO3 > 6e-4 && !('ksp-CaCO3' in c.at(10).fired), 'carbonato-escaso: el orden debe ser PbCO3, BaCO3 y después CaCO3.');
    need(solidGrams(c.end).length === 4, 'carbonato-escaso: deben quedar cuatro carbonatos sólidos.');
  }
  return cases;
};
export default family;
