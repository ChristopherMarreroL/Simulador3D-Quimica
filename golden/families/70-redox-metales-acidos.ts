import { rules } from '../../src/chemistry/sandbox';
import type { CaseSpec, Family, StepSpec, Trace } from '../lib/types';

/**
 * Familias «redox», «metal», «acido» y «prioridad»: reglas completas del motor (índices 13–72 de `rules`) y
 * reparto de un reactivo escaso según el orden de la lista. Solo se describen entradas; cada caso se comprueba
 * con `ctx.trace` al generarlo, de modo que el archivo falla si el motor deja de hacer lo que el caso pretende.
 */

/** «agno3 50, ki 10» → pasos. */
const seq = (text: string): StepSpec[] => text.split(',').map(part => { const [reagent, amount] = part.trim().split(/\s+/); return { reagent, amount: Number(amount) }; });
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const order = new Map(rules.map((rule, index) => [rule.id, index]));
const ALL = rules.map(rule => rule.id);
/** Comprueba que los ids existen: un `mustNotFire` con una errata sería una comprobación vacía. */
const R = (...ids: string[]) => { for (const id of ids) if (!order.has(id)) throw new Error(`70: la regla «${id}» no existe.`); return ids; };
/** «regla (n.º)» para explicar prioridades. */
const p = (id: string) => `${R(id)[0]} (n.º ${order.get(id)})`;
const need = (ok: boolean, message: string) => { if (!ok) throw new Error(`70: ${message}`); };
const es = (x: number) => String(x).replace('.', ',');

type Row = [name: string, why: string, steps: string, fire?: string[], notFire?: string[]];

const family: Family = ctx => {
  const cases: CaseSpec[] = [];
  const add = (id: string, why: string, text: string, fire: string[] = [], notFire: string[] = []) => {
    const steps = seq(text);
    cases.push({ id, fn: 'sequence', why, steps, ...(fire.length ? { mustFire: R(...fire) } : {}), ...(notFire.length ? { mustNotFire: R(...notFire) } : {}) });
    return ctx.trace(steps);
  };
  const table = (prefix: string, rows: Row[]) => rows.forEach(([name, why, text, fire, notFire]) => add(`${prefix}/${name}`, why, text, fire, notFire));
  /** Fija con el motor una afirmación de un «why» que mustFire/mustNotFire no pueden expresar (estado final o un prefijo de la secuencia). */
  const claim = (text: string, ok: (t: Trace) => boolean, message: string) => need(ok(ctx.trace(seq(text))), `«${text}»: ${message}`);

  // ───────────── redox: las 8 reglas redox y de descomposición con cada reactivo limitante ─────────────
  const PP = 'permanganate-peroxide', PI = 'permanganate-iodide', PF = 'permanganate-iron', HI = 'peroxide-iodide', FI = 'iron-iodide', CI = 'copper-iodide', PN = 'permanganate-peroxide-neutral', DEC = 'peroxide-decomposition';
  table('redox', [
    ['mno4-h2o2-limita-oxidante', 'KMnO4 limitante en medio ácido: se decolora y el H2O2 sobrante no se descompone porque el Mn2+ no cataliza.', 'hcl 20, h2o2 10, kmno4 50', [PP], [PN, DEC]],
    ['mno4-h2o2-limita-reductor', 'H2O2 limitante en medio ácido: sobra permanganato violeta.', 'hcl 20, kmno4 200, h2o2 1', [PP], [PN, DEC]],
    ['mno4-h2o2-limita-acido', 'Ácido limitante: agotado el H+, el resto sigue por la vía neutra (MnO2 + OH-) y el MnO2 descompone el H2O2 sobrante en la misma adición.', 'hcl 1, kmno4 100, h2o2 10', [PP, PN, DEC]],
    ['mno4-i-limita-oxidante', 'KMnO4 limitante frente a yoduro en HCl: queda I- y aparece I2.', 'hcl 20, ki 20, kmno4 50', [PI]],
    ['mno4-i-limita-reductor', 'Yoduro limitante: sobra permanganato y todo el I- pasa a I2.', 'hcl 30, kmno4 200, ki 2', [PI]],
    ['mno4-i-limita-acido', 'Ácido limitante (16 H+ por 2 MnO4-): la reacción se detiene con MnO4- e I- juntos a pH 7.', 'hcl 2, ki 20, kmno4 100', [PI]],
    ['mno4-i-sin-acido-luego-acido', 'Sin ácido el modelo no oxida el yoduro con permanganato (ni forma MnO2); al añadir HCl aparece yodo, azul con el almidón ya presente.', 'ki 20, kmno4 50, starch 3, hcl 20', [PI], [PN]],
    ['mno4-fe2-limita-hierro', 'Fe2+ generado con Fe + HCl; Fe2+ limitante frente al permanganato.', 'hcl 50, fe 0.5, kmno4 100', ['metal-Fe-H+', PF]],
    ['mno4-fe2-limita-oxidante', 'Fe2+ generado con Fe3+ + I- (yoduro agotado); KMnO4 limitante.', 'fecl3 50, ki 5, hcl 20, kmno4 10', [FI, PF], [PI]],
    ['mno4-fe2-limita-acido', 'Ácido limitante (8 H+ por MnO4-) con Fe2+ y permanganato de sobra.', 'fecl3 50, ki 5, hcl 1, kmno4 100', [PF]],
    ['mno4-fe2-con-hierro-sobrante', 'Fe2+, Fe metálico y MnO4- sin ácido no reaccionan; al añadir HCl el permanganato va antes que el metal, el Fe3+ formado lo reduce el hierro y el H+ restante ataca al hierro.', 'hcl 10, fe 1, kmno4 50, hcl 12', [PF, 'metal-Fe-Fe3+', 'metal-Fe-H+']],
    ['mno4-escaso-yoduro-antes-que-fe2', `KMnO4 escaso con I- y Fe2+ en ácido: solo se oxida el yoduro, ${p(PI)} antes que ${p(PF)}.`, 'fecl3 50, ki 18, hcl 30, kmno4 20', [PI], [PF]],
    ['mno4-de-sobra-yoduro-y-fe2', 'KMnO4 de sobra: oxida primero todo el yoduro y después todo el Fe2+ en la misma adición.', 'fecl3 50, ki 18, hcl 30, kmno4 200', [PI, PF]],
    ['h2o2-i-limita-yoduro', 'H2O2 100 + HCl 20 + KI 10: el peróxido oxida todo el yoduro a I2 y, sin I- que catalice, no hay descomposición.', 'h2o2 100, hcl 20, ki 10', [HI], [DEC]],
    ['h2o2-i-limita-acido', 'Ácido limitante (H2SO4): parte del yoduro pasa a I2 y el I- restante cataliza la descomposición del H2O2 sobrante.', 'h2o2 20, h2so4 2, ki 20', [HI, DEC]],
    ['h2o2-i-limita-peroxido', 'H2O2 limitante en HCl con yoduro de sobra: no queda peróxido que descomponer.', 'hcl 20, ki 20, h2o2 2', [HI], [DEC]],
    ['h2o2-i-acetico-no-cuenta', 'El ácido acético no aporta H+ a las reglas redox: con vinagre el yoduro no se oxida y solo cataliza la descomposición.', 'h2o2 50, acetic 20, ki 5', [DEC], [HI]],
    ['h2o2-i-almidon', 'Yodo formado con almidón presente: color azul oscuro; H2O2 limitante.', 'starch 3, hcl 10, ki 4, h2o2 1', [HI], [DEC]],
    ['fe3-i-limita-yoduro', 'Yoduro limitante frente a Fe3+: mezcla de Fe3+, Fe2+ e I2.', 'fecl3 50, ki 5', [FI]],
    ['fe3-i-limita-hierro-almidon', 'Fe3+ limitante frente a yoduro; almidón añadido después.', 'fecl3 20, ki 20, starch 3', [FI]],
    ['fe3-i-luego-h2o2', 'Tras Fe3+ + I- queda yoduro que cataliza la descomposición; el modelo no oxida Fe2+ con H2O2.', 'fecl3 20, ki 20, h2o2 10', [FI, DEC], [HI]],
    ['cu2-i-limita-yoduro', 'Cu2+ con yoduro limitante, sin almidón: CuI crema e I2 pardo; calor desconocido.', 'cuso4 20, ki 10', [CI]],
    ['cu2-i-limita-cobre-almidon', 'Cu2+ limitante con almidón presente: CuI e I2 azul oscuro.', 'starch 3, ki 20, cuso4 2', [CI]],
    ['cu2-i-sin-yoduro-no-cataliza', 'Consumido todo el yoduro por el Cu2+, el H2O2 no se descompone (el CuI no cataliza).', 'cuso4 20, ki 10, h2o2 5', [CI], [DEC]],
    ['cu2-i-yoduro-sobrante-cataliza', 'Con yoduro sobrante tras formar CuI, el H2O2 se descompone.', 'ki 20, cuso4 2, h2o2 5', [CI, DEC]],
    ['mno4-h2o2-neutro', 'KMnO4 50 + H2O2 50 sin ácido: se forma MnO2 (gas y sólido) y ese MnO2 cataliza la descomposición del resto en la misma adición.', 'kmno4 50, h2o2 50', [PN, DEC], [PP]],
    ['mno4-h2o2-neutro-limita-peroxido', 'Vía neutra con H2O2 limitante: se forma MnO2 pero no queda peróxido que descomponer.', 'kmno4 200, h2o2 1', [PN], [DEC]],
    ['mno4-h2o2-basico', 'Vía neutra en NaOH: la reacción añade más OH- al medio.', 'naoh 10, kmno4 100, h2o2 5', [PN, DEC], [PP]],
    ['mno4-h2o2-neutro-luego-acido', 'MnO2 formado sin ácido; después HCl neutraliza el OH- y un segundo H2O2 reacciona por la vía ácida y se descompone con el MnO2 anterior.', 'kmno4 100, h2o2 2, hcl 10, h2o2 5', [PN, 'neutral-strong', PP, DEC]],
    ['mno4-h2o2-en-acetico', 'En vinagre no hay H+ en el modelo: va por la vía neutra y el OH- producido lo neutraliza el acético.', 'acetic 20, kmno4 100, h2o2 5', [PN, DEC, 'neutral-acetic'], [PP]],
    ['h2o2-ki-catalitica', 'H2O2 + KI sin ácido: descomposición catalítica; el I- no se consume.', 'h2o2 50, ki 5', [DEC], [HI]],
    ['h2o2-ki-maxima', 'La mayor descomposición posible en una adición: 200 mL de H2O2 con 1 mL de KI.', 'h2o2 200, ki 1', [DEC]],
    ['h2o2-mno2-persistente', 'El MnO2 de una adición anterior sigue catalizando cuando se añade más H2O2.', 'kmno4 20, h2o2 1, h2o2 100', [PN, DEC]],
    ['h2o2-sin-catalizador', 'Sin I- ni MnO2 el H2O2 es estable en el modelo aunque haya Cl-, Cu2+ y Fe3+.', 'h2o2 50, nacl 10, cuso4 5, fecl3 5', [], ALL],
    ['h2o2-yoduro-en-agi-no-cataliza', 'Yoduro secuestrado como AgI con Ag+ en exceso: el I- libre queda por debajo de 1e-9 mol y no cataliza.', 'agno3 100, ki 8, h2o2 10', ['ksp-AgI'], [DEC]],
    ['h2o2-yoduro-de-pbi2-cataliza', 'El PbI2 deja suficiente I- disuelto para catalizar la descomposición.', 'pbno3 100, ki 10, h2o2 10', ['ksp-PbI2', DEC]],
  ]);
  claim('h2o2 50, ki 5', t => Math.abs((t.n['I-'] ?? 0) - 0.0025) < 1e-9 && !('H2O2' in t.n), 'el yoduro debía quedar intacto y el peróxido agotado.');
  claim('h2o2 100, hcl 20, ki 10', t => !('I-' in t.n) && (t.n.I2 ?? 0) > 0.002 && (t.n.H2O2 ?? 0) > 0.08, 'debía agotarse el yoduro y sobrar peróxido sin descomponer.');
  claim('kmno4 50, h2o2 50', t => (t.n.MnO2 ?? 0) > 9e-4 && !('H2O2' in t.n) && !('MnO4-' in t.n) && (t.released.O2 ?? 0) > 0.02, 'debía quedar MnO2 y agotarse permanganato y peróxido.');

  // ───────────── metal: las 22 reglas de desplazamiento, con metal limitante y con oxidante limitante ─────────────
  const metalReagent: Record<string, string> = { Mg: 'mg', Zn: 'zn', Fe: 'fe', Cu: 'cu' };
  const little: Record<string, number> = { Mg: 0.05, Zn: 0.1, Fe: 0.1, Cu: 0.1 };
  /** Fuente del oxidante: abundante (para metal limitante) y escasa (para oxidante limitante). */
  const source = (ox: string, metal: string): { big: string; small: string; prepared?: boolean } => ({
    'Ag+': { big: 'agno3 100', small: 'agno3 20' },
    'Fe3+': { big: 'fecl3 100', small: 'fecl3 20' },
    'Cu2+': { big: 'cuso4 20', small: 'cuso4 4' },
    'H+': metal === 'Zn' ? { big: 'h2so4 30', small: 'h2so4 5' } : { big: 'hcl 30', small: 'hcl 5' },
    HAc: { big: 'acetic 40', small: 'acetic 5' },
    'Pb2+': { big: 'pbno3 100', small: 'pbno3 20' },
    // Fe2+ y Zn2+ hay que prepararlos: con metal sobrante no queda Fe3+ ni H+ que compitan.
    'Fe2+': { big: 'fecl3 100, fe 1', small: 'fecl3 20, fe 0.2', prepared: true },
    'Zn2+': { big: 'hcl 20, zn 1', small: 'hcl 4, zn 0.2', prepared: true },
  })[ox]!;
  const displacement = rules.filter(rule => rule.id.startsWith('metal-'));
  need(displacement.length === 22, `se esperaban 22 reglas de desplazamiento y hay ${displacement.length}.`);
  displacement.forEach((rule, i) => {
    const [, metal, ox] = /^metal-([A-Z][a-z])-(.+)$/.exec(rule.id)!;
    const src = source(ox, metal), reagent = metalReagent[metal], name = slug(rule.id.slice(6));
    // Metal limitante: oxidante primero y poco metal.
    const a = `${src.big}, ${reagent} ${little[metal]}`;
    const ta = add(`metal/${name}-limita-metal`, `${rule.id} con metal limitante: ${es(little[metal])} g de ${metal} se consumen por completo y sobra ${ox}.`, a, [rule.id]);
    need(rule.id in ta.fired && !(metal in ta.n) && (ta.n[ox] ?? 0) > 1e-6, `${rule.id}: «${a}» no deja el metal como limitante.`);
    // Oxidante limitante: metal de sobra. Se alterna el orden: metal en el matraz seco y después la disolución, o al revés
    // (los oxidantes que hay que preparar van siempre antes que el metal).
    const dry = !src.prepared && i % 2 === 0;
    const b = dry ? `${reagent} 0.5, ${src.small}` : `${src.small}, ${reagent} 0.5`;
    const tb = ctx.trace(seq(b));
    const chain = src.prepared ? [] : Object.keys(tb.fired).filter(id => id !== rule.id && id.startsWith('metal-'));
    add(`metal/${name}-limita-oxidante`, `${rule.id} con oxidante limitante: se agota el ${ox} y sobra ${metal}${dry ? ' (metal añadido al matraz seco; reacciona al llegar la disolución)' : ''}${chain.length ? `; el metal sobrante sigue con ${chain.join(', ')}` : ''}.`, b, [rule.id, ...chain]);
    need(rule.id in tb.fired && (tb.n[metal] ?? 0) > 1e-6 && !(ox in tb.n), `${rule.id}: «${b}» no deja el oxidante como limitante.`);
  });
  const noMetalAcid = ['metal-Mg-H+', 'metal-Zn-H+', 'metal-Fe-H+'];
  table('metal', [
    ['cadena-zn-cu-ag', 'El Zn deposita Cu y ese Cu depositado reduce después al Ag+ añadido.', 'cuso4 10, zn 0.2, agno3 50', ['metal-Zn-Cu2+', 'metal-Cu-Ag+']],
    ['cadena-zn-sobrante-gana-al-cu', `Con Zn sobrante junto al Cu depositado, el Ag+ lo reduce solo el Zn: ${p('metal-Zn-Ag+')} antes que ${p('metal-Cu-Ag+')}.`, 'cuso4 4, zn 0.5, agno3 100', ['metal-Zn-Cu2+', 'metal-Zn-Ag+'], ['metal-Cu-Ag+']],
    ['cadena-cu-fe3-y-fe-redeposita-cu', 'El Cu se disuelve en Fe3+; el hierro añadido después reduce primero el Fe3+ sobrante y luego redeposita el Cu.', 'fecl3 100, cu 0.2, fe 0.5', ['metal-Cu-Fe3+', 'metal-Fe-Fe3+', 'metal-Fe-Cu2+']],
    ['fe3-fe2-fe-parcial-con-zn', 'Fe3+ → Fe2+ → Fe en una sola adición de Zn; el Zn se agota a mitad de la segunda etapa y el Fe depositado, a diferencia de Pb y Ag, sí reacciona con el HCl añadido después.', 'fecl3 100, zn 0.5, hcl 10', ['metal-Zn-Fe3+', 'metal-Zn-Fe2+', 'metal-Fe-H+'], ['metal-Zn-H+']],
    ['fe3-fe2-fe-parcial-con-mg', 'Fe3+ → Fe2+ → Fe en una sola adición de Mg; el Mg se agota a mitad de la segunda etapa.', 'fecl3 100, mg 0.2', ['metal-Mg-Fe3+', 'metal-Mg-Fe2+']],
    ['pb-depositado-inerte-en-hcl', 'El Pb depositado por el Zn no es reductor en el modelo: el HCl solo precipita PbCl2 con el Pb2+ sobrante.', 'pbno3 100, zn 0.2, hcl 20', ['metal-Zn-Pb2+', 'ksp-PbCl2'], noMetalAcid],
    ['pb-depositado-inerte-con-cu2', 'El Pb depositado no reduce al Cu2+: el CuSO4 solo precipita PbSO4.', 'pbno3 100, zn 0.2, cuso4 10', ['metal-Zn-Pb2+', 'ksp-PbSO4'], ['metal-Mg-Cu2+', 'metal-Zn-Cu2+', 'metal-Fe-Cu2+']],
    ['ag-depositada-inerte', 'La Ag depositada por el Cu no reacciona con HCl ni reduce al Fe3+ añadido después.', 'agno3 100, cu 0.2, hcl 10, fecl3 20', ['metal-Cu-Ag+', 'ksp-AgCl'], ['metal-Cu-Fe3+', ...noMetalAcid]],
    ['cu-en-hcl-no-reacciona', 'El cobre no desplaza hidrógeno: ningún evento.', 'cu 1, hcl 50', [], ALL],
    ['fe-en-acetico-no-reacciona', 'El hierro no reacciona con el ácido acético en el modelo (solo Mg y Zn): ningún evento.', 'fe 1, acetic 50', [], ALL],
    ['cu-con-pb2-y-acetico-no-reacciona', 'El cobre no desplaza al plomo ni reacciona con vinagre: ningún evento.', 'cu 0.5, pbno3 50, acetic 20', [], ALL],
    ['zn-fe-cu-no-desplazan-mg', 'Zn, Fe y Cu añadidos a una disolución de Mg2+ (con Mg sobrante) no reaccionan.', 'hcl 10, mg 0.5, zn 0.4, fe 0.6, cu 0.8', ['metal-Mg-H+'], ALL.filter(id => /^metal-(Zn|Fe|Cu)-/.test(id))],
    ['mg-h-antes-que-hac', `Mg de sobra en HCl + vinagre: primero el H+ fuerte, ${p('metal-Mg-H+')}, y después el acético, ${p('metal-Mg-HAc')}.`, 'hcl 5, acetic 20, mg 0.5', ['metal-Mg-H+', 'metal-Mg-HAc']],
    ['zn-pbcl2-no-converge', 'Zn sobre PbCl2 sólido con cloruro en exceso: cada pasada reduce solo el Pb2+ disuelto y las 120 pasadas no bastan; añadir 1 mL de agua reanuda el depósito de Pb, que tampoco termina.', 'pbno3 50, cacl2 1, zn 1, water 1', ['ksp-PbCl2', 'metal-Zn-Pb2+']],
    ['zn-pbso4-no-converge', 'Zn sobre PbSO4 sólido tras agotar el ácido: el depósito de Pb avanza un poco con cada adición, también con agua.', 'pbno3 100, h2so4 20, zn 1, water 1, water 1', ['ksp-PbSO4', 'metal-Zn-H+', 'metal-Zn-Pb2+']],
    ['cu-agcl-deriva', 'Cu sobre AgCl sólido: reduce unos nanomoles de Ag+ por adición, sin evento visible; el estado depende del número de adiciones.', 'agno3 50, nacl 10, cu 1, water 1', ['ksp-AgCl'], ['metal-Cu-Ag+']],
  ]);

  // ───────────── acido: las 30 reglas acid-<sólido>-<H+|HAc> ─────────────
  /** Cómo formar cada sólido sin base ni carbonato libres, y el ácido fuerte / acético que se añade después. */
  const solids: Record<string, { make: string; strong: string; weak: string; makeWeak?: string }> = {
    'Cu(OH)2': { make: 'cuso4 10, naoh 5', strong: 'hcl 20', weak: 'acetic 20' },
    'Fe(OH)3': { make: 'fecl3 50, naoh 10', strong: 'h2so4 20', weak: 'acetic 10' },
    'Fe(OH)2': { make: 'fecl3 50, fe 0.5, naoh 10', strong: 'hcl 5', weak: 'acetic 20' },
    'Mg(OH)2': { make: 'hcl 20, mg 0.2, naoh 10', strong: 'hcl 10', weak: 'acetic 60', makeWeak: 'hcl 20, mg 0.2, naoh 30' },
    'Zn(OH)2': { make: 'hcl 20, zn 0.5, naoh 10', strong: 'h2so4 10', weak: 'acetic 10' },
    'Pb(OH)2': { make: 'pbno3 100, naoh 10', strong: 'hcl 20', weak: 'acetic 20' },
    'Ca(OH)2': { make: 'water 50, cacl2 10, naoh 50', strong: 'hcl 60', weak: 'acetic 80' },
    Ag2O: { make: 'agno3 100, naoh 5', strong: 'h2so4 10', weak: 'acetic 10' },
    CaCO3: { make: 'water 50, caco3 1', strong: 'hcl 30', weak: 'acetic 10' },
    BaCO3: { make: 'bacl2 100, na2co3 10', strong: 'h2so4 12', weak: 'acetic 20' },
    MgCO3: { make: 'hcl 30, mg 0.5, na2co3 20', strong: 'hcl 10', weak: 'acetic 10' },
    ZnCO3: { make: 'hcl 20, zn 1, na2co3 10', strong: 'h2so4 6', weak: 'acetic 6' },
    PbCO3: { make: 'pbno3 100, na2co3 10', strong: 'hcl 20', weak: 'acetic 20' },
    CuCO3: { make: 'cuso4 20, na2co3 10', strong: 'hcl 20', weak: 'acetic 20' },
    Ag2CO3: { make: 'agno3 100, na2co3 5', strong: 'hcl 2', weak: 'acetic 10' },
  };
  const dissolution = rules.filter(rule => rule.id.startsWith('acid-'));
  need(dissolution.length === 30, `se esperaban 30 reglas de disolución en ácido y hay ${dissolution.length}.`);
  for (const rule of dissolution) {
    const weak = rule.id.endsWith('-HAc');
    const solid = rule.id.slice(5, rule.id.length - (weak ? 4 : 3));
    const recipe = solids[solid];
    need(!!recipe, `no hay receta para formar ${solid}.`);
    const make = weak ? recipe.makeWeak ?? recipe.make : recipe.make, acid = weak ? recipe.weak : recipe.strong;
    const before = ctx.trace(seq(make));
    need((before.n[solid] ?? 0) > 1e-4, `«${make}» no forma ${solid}.`);
    const t = ctx.trace(seq(`${make}, ${acid}`));
    const also = Object.keys(t.fired).filter(id => id !== rule.id && !(id in before.fired));
    add(`acido/${slug(rule.id.slice(5))}`, `${solid} formado con «${make}» y atacado con ${weak ? 'ácido acético' : acid.startsWith('h2so4') ? 'H2SO4' : 'HCl'}: ${(t.n[solid] ?? 0) > 1e-7 ? 'el ácido es limitante y queda sólido' : 'se disuelve todo'}${also.length ? `; además: ${also.join(', ')}` : ''}.`, `${make}, ${acid}`, [rule.id]);
  }
  table('acido', [
    ['base-libre-antes-que-cu-oh-2', `Con NaOH en exceso los primeros 5 mL de HCl solo neutralizan OH- libre, ${p('neutral-strong')}, y no llegan al Cu(OH)2, ${p('acid-Cu(OH)2-H+')}; 10 mL más terminan con el OH- libre y disuelven parte del sólido.`, 'cuso4 10, naoh 20, hcl 5, hcl 10', ['neutral-strong', 'acid-Cu(OH)2-H+']],
    ['carbonato-libre-antes-que-baco3', `Con Na2CO3 en exceso el HCl escaso solo protona el carbonato disuelto, ${p('carbonate-strong')}; ni burbujea ni ataca al BaCO3.`, 'bacl2 50, na2co3 30, hcl 8', ['carbonate-strong'], ['co2-strong', 'acid-BaCO3-H+']],
    ['carbonato-libre-y-despues-baco3', 'HCl suficiente: carbonato → bicarbonato → CO2 y, con el resto, parte del BaCO3.', 'bacl2 50, na2co3 30, hcl 25', ['carbonate-strong', 'co2-strong', 'acid-BaCO3-H+']],
    ['fe-oh-3-acido-insuficiente', 'HCl insuficiente para todo el Fe(OH)3: disolución parcial y pH controlado por el Fe3+.', 'fecl3 50, naoh 10, hcl 4', ['acid-Fe(OH)3-H+']],
    ['marmol-en-vinagre-de-sobra', 'Mármol con vinagre en exceso: se disuelve por completo.', 'water 50, caco3 0.5, acetic 50', ['acid-CaCO3-HAc']],
    ['marmol-con-fecl3-no-reacciona', 'FeCl3 sobre mármol: la hidrólisis del Fe3+ da pH ≈ 2, pero las reglas solo ven H+ explícito y el carbonato no se ataca; solo se disuelve un poco más de CaCO3 por la dilución.', 'water 50, caco3 1, fecl3 50', ['ksp-CaCO3'], ALL.filter(id => id.startsWith('acid-') || id.startsWith('co2-') || id.startsWith('carbonate-'))],
    ['marmol-en-seco-y-hcl', 'Mármol en el matraz seco y HCl de sobra después: toda la reacción ocurre en la adición del ácido.', 'caco3 2, hcl 100', ['acid-CaCO3-H+']],
  ]);

  claim('cuso4 10, naoh 20, hcl 5', t => !('acid-Cu(OH)2-H+' in t.fired) && Math.abs(t.fired['neutral-strong'] - 0.005) < 1e-9, 'el primer HCl debía gastarse entero en OH- libre.');

  // ───────────── prioridad: un reactivo escaso repartido por orden de regla ─────────────
  /**
   * Escalera: tras `setup`, cada peldaño añade más reactivo escaso. `rungs` = [cantidad, reglas que deben avanzar
   * con evento visible en ese peldaño]; las reglas reservadas a peldaños posteriores no pueden avanzar antes.
   */
  const ladder = (name: string, why: string, setup: string, reagent: string, rungs: [number, string[]][]) => {
    const steps = seq(setup);
    let before = ctx.trace(steps).fired;
    rungs.forEach(([amount, expected], i) => {
      steps.push({ reagent, amount });
      const now = ctx.trace(steps).fired;
      const moved = Object.keys(now).filter(rule => now[rule] !== before[rule]);
      const seen = new Set(rungs.slice(0, i + 1).flatMap(r => r[1]));
      const later = rungs.slice(i + 1).flatMap(r => r[1]).filter(rule => !seen.has(rule));
      need(R(...expected).every(rule => moved.includes(rule)), `${name}, peldaño ${i + 1} (${reagent} ${amount}): se esperaba ${expected.join(', ')} y avanzaron ${moved.join(', ') || 'ninguna'}.`);
      need(!later.some(rule => moved.includes(rule)), `${name}, peldaño ${i + 1}: se adelantó ${later.filter(rule => moved.includes(rule)).join(', ')}.`);
      before = now;
    });
    cases.push({ id: `prioridad/${name}`, fn: 'sequence', why, steps, mustFire: [...new Set(rungs.flatMap(r => r[1]))] });
  };
  const A = (solid: string, acid: 'H+' | 'HAc') => `acid-${solid}-${acid}`;
  const metals4 = 'water 50, mg 1, zn 1, fe 1, caco3 1';
  add('prioridad/h-caco3-antes-que-metales', `HCl escaso frente a CaCO3, Mg, Zn y Fe: los primeros 10 mL van enteros al carbonato, ${p(A('CaCO3', 'H+'))}, antes que a ${p('metal-Mg-H+')}, ${p('metal-Zn-H+')} y ${p('metal-Fe-H+')}; con 20 mL más se termina el CaCO3 y el resto va solo al Mg, el metal de regla más temprana.`, `${metals4}, hcl 10, hcl 20`, [A('CaCO3', 'H+'), 'metal-Mg-H+'], ['metal-Zn-H+', 'metal-Fe-H+']);
  claim(`${metals4}, hcl 10`, t => A('CaCO3', 'H+') in t.fired && !noMetalAcid.some(rule => rule in t.fired), 'los primeros 10 mL de HCl no debían tocar ningún metal.');
  ladder('h-escalera-caco3-mg-zn-fe', `HCl en porciones: CaCO3 (n.º ${order.get(A('CaCO3', 'H+'))}) → Mg (${order.get('metal-Mg-H+')}) → Zn (${order.get('metal-Zn-H+')}) → Fe (${order.get('metal-Fe-H+')}); cada consumidor empieza cuando se agota el anterior.`,
    'water 50, mg 0.2, zn 0.2, fe 0.2, caco3 0.5', 'hcl', [[5, [A('CaCO3', 'H+')]], [10, [A('CaCO3', 'H+'), 'metal-Mg-H+']], [15, ['metal-Mg-H+', 'metal-Zn-H+']], [8, ['metal-Zn-H+', 'metal-Fe-H+']]]);
  ladder('h-escalera-oh-co3-nh3-hco3-caco3-zn', `HCl en porciones frente a seis consumidores: OH- libre (n.º 0) → CO3-2 (4) → NH3 (6) → HCO3- (8) → CaCO3 sólido (${order.get(A('CaCO3', 'H+'))}) → Zn (${order.get('metal-Zn-H+')}).`,
    'naoh 20, nh4no3 0.8, na2co3 10, caco3 1, zn 0.5', 'hcl', [[5, ['neutral-strong']], [8, ['neutral-strong', 'carbonate-strong']], [8, ['carbonate-strong', 'ammonia-strong']], [8, ['ammonia-strong', 'co2-strong']], [10, ['co2-strong', A('CaCO3', 'H+')]], [30, [A('CaCO3', 'H+'), 'metal-Zn-H+']]]);
  ladder('h-escalera-co3-hco3-fe-oh-3-fe', `HCl en porciones frente a carbonato disuelto (n.º 4), bicarbonato (8), Fe(OH)3 sólido (${order.get(A('Fe(OH)3', 'H+'))}) y Fe metálico (${order.get('metal-Fe-H+')}): el hidróxido sólido espera a que no quede bicarbonato; el Fe3+ que libera lo reduce al momento el hierro (${p('metal-Fe-Fe3+')}), y el metal solo desprende H2 cuando no queda Fe(OH)3.`,
    'fecl3 20, naoh 8, nahco3 0.5, fe 0.5', 'hcl', [[1, ['carbonate-strong']], [4, ['carbonate-strong', 'co2-strong']], [6, ['co2-strong', A('Fe(OH)3', 'H+'), 'metal-Fe-Fe3+']], [10, [A('Fe(OH)3', 'H+'), 'metal-Fe-Fe3+', 'metal-Fe-H+']]]);
  ladder('hac-escalera-oh-co3-nh3-hco3-caco3-mg', `Vinagre en porciones: OH- (n.º 1) → CO3-2 (5) → NH3 (7) → HCO3- (9) → CaCO3 sólido (${order.get(A('CaCO3', 'HAc'))}) → Mg (${order.get('metal-Mg-HAc')}).`,
    'naoh 20, nh4no3 0.8, na2co3 10, caco3 1, mg 0.5', 'acetic', [[6, ['neutral-acetic']], [12, ['neutral-acetic', 'carbonate-acetic']], [12, ['carbonate-acetic', 'ammonia-acetic']], [12, ['ammonia-acetic', 'co2-acetic', A('CaCO3', 'HAc')]], [30, [A('CaCO3', 'HAc'), 'metal-Mg-HAc']]]);
  ladder('h-escalera-oh-nh3-acetato-redox', `HCl en porciones: OH- (n.º 0) → NH3 (6) → acetato (10) → MnO4- + I- (${order.get(PI)}). Mientras quede acetato, el tampón se queda con el H+ y el permanganato no oxida al yoduro aunque el pH sea ácido.`,
    'naoh 20, nh4no3 0.8, acetic 6, ki 10, kmno4 50', 'hcl', [[5, ['neutral-strong']], [6, ['neutral-strong', 'ammonia-strong']], [6, ['ammonia-strong', 'acetate-strong']], [10, ['acetate-strong', PI]]]);
  ladder('h-escalera-caco3-mno4-yoduro-mno4-hierro', `HCl en porciones con CaCO3, MnO4-, I- y Fe2+: carbonato sólido (n.º ${order.get(A('CaCO3', 'H+'))}) → MnO4- + I- (${order.get(PI)}) → MnO4- + Fe2+ (${order.get(PF)}).`,
    'fecl3 50, ki 20, kmno4 100, caco3 0.5', 'hcl', [[4, [A('CaCO3', 'H+')]], [10, [A('CaCO3', 'H+'), PI]], [20, [PI, PF]]]);
  ladder('oh-escalera-h-hac-nh4-hidroxidos', `NaOH en porciones: H+ (n.º 0) → acético (1) → NH4+ (2) → Cu(OH)2 (${order.get('ksp-Cu(OH)2')}) → Fe(OH)3 (${order.get('ksp-Fe(OH)3')}) → Zn(OH)2 (${order.get('ksp-Zn(OH)2')}). El Cu(OH)2 precipita antes que el Fe(OH)3 por orden de regla, aunque el Fe(OH)3 es mucho menos soluble.`,
    'hcl 30, zn 0.5, acetic 10, nh4no3 0.5, fecl3 30, cuso4 4', 'naoh', [[10, ['neutral-strong']], [8, ['neutral-strong', 'neutral-acetic']], [8, ['neutral-acetic', 'neutral-ammonium']], [6, ['neutral-ammonium', 'ksp-Cu(OH)2']], [10, ['ksp-Cu(OH)2', 'ksp-Fe(OH)3']], [10, ['ksp-Zn(OH)2']]]);
  ladder('oh-escalera-nh4-hco3-con-cu2', `NaOH en porciones con NH4+, HCO3- y Cu2+: amonio (n.º 2) → bicarbonato (3); el Cu2+ no precipita como hidróxido (${order.get('ksp-Cu(OH)2')}) sino como CuCO3 cuando aparece carbonato.`,
    'water 50, nh4no3 1, nahco3 1, cuso4 4', 'naoh', [[5, ['neutral-ammonium']], [10, ['neutral-ammonium', 'neutral-bicarbonate', 'ksp-CuCO3']]]);
  ladder('ag-escalera-zn-yoduro-cloruro', `AgNO3 en porciones frente a Zn metálico, I- y Cl-: el desplazamiento ${p('metal-Zn-Ag+')} va antes que ${p('ksp-AgI')} y ${p('ksp-AgCl')}; no precipita nada hasta que se agota el Zn.`,
    'nacl 5, ki 4, zn 0.2', 'agno3', [[20, ['metal-Zn-Ag+']], [60, ['metal-Zn-Ag+', 'ksp-AgI']], [50, ['ksp-AgI', 'ksp-AgCl']]]);
  add('prioridad/ag-cu-gana-y-el-cu2-oxida-al-yoduro', `Ag+ escaso frente a Cl-, I- y Cu metálico: gana el cobre, ${p('metal-Cu-Ag+')}, no precipita AgI ni AgCl, y el Cu2+ formado oxida al yoduro (${p(CI)}) en la misma adición.`, 'nacl 5, ki 4, cu 0.2, agno3 20', ['metal-Cu-Ag+', CI], ['ksp-AgI', 'ksp-AgCl']);
  ladder('fe3-escalera-yoduro-fe-cu', `FeCl3 en porciones frente a I-, Fe y Cu: yoduro (n.º ${order.get(FI)}) → hierro (${order.get('metal-Fe-Fe3+')}) → cobre (${order.get('metal-Cu-Fe3+')}).`,
    'ki 4, fe 0.1, cu 0.2', 'fecl3', [[10, [FI]], [30, [FI, 'metal-Fe-Fe3+']], [50, ['metal-Fe-Fe3+', 'metal-Cu-Fe3+']]]);
  add('prioridad/fe3-yoduro-gana-a-cuatro-metales', `Fe3+ escaso frente a I-, Mg, Zn, Fe y Cu: lo gana entero el yoduro, ${p(FI)}, antes que los metales (n.º 55–58); el Fe2+ formado lo reduce después el Mg (${p('metal-Mg-Fe2+')}).`, 'ki 4, mg 0.2, zn 0.2, fe 0.2, cu 0.2, fecl3 10', [FI, 'metal-Mg-Fe2+'], ['metal-Mg-Fe3+', 'metal-Zn-Fe3+', 'metal-Fe-Fe3+', 'metal-Cu-Fe3+']);
  ladder('zn-escalera-ag-cu-h', `Zn en porciones frente a tres oxidantes: Ag+ (n.º ${order.get('metal-Zn-Ag+')}) → Cu2+ (${order.get('metal-Zn-Cu2+')}) → H+ (${order.get('metal-Zn-H+')}).`,
    'water 150, agno3 30, cuso4 2, h2so4 2', 'zn', [[0.05, ['metal-Zn-Ag+']], [0.1, ['metal-Zn-Ag+', 'metal-Zn-Cu2+']], [0.05, ['metal-Zn-Cu2+', 'metal-Zn-H+']]]);
  ladder('mg-escalera-fe3-h-fe2', `Mg en porciones frente a Fe3+, H+ y el Fe2+ que él mismo forma: Fe3+ (n.º ${order.get('metal-Mg-Fe3+')}) → H+ (${order.get('metal-Mg-H+')}) → Fe2+ (${order.get('metal-Mg-Fe2+')}).`,
    'fecl3 50, hcl 10', 'mg', [[0.05, ['metal-Mg-Fe3+']], [0.1, ['metal-Mg-Fe3+', 'metal-Mg-H+']], [0.1, ['metal-Mg-H+', 'metal-Mg-Fe2+']]]);
  table('prioridad', [
    ['oh-cu-oh-2-gana-a-fe-oh-3', `OH- escaso frente a Fe3+ y Cu2+: precipita Cu(OH)2 (${p('ksp-Cu(OH)2')}, antes en la lista) y casi nada de Fe(OH)3 (${p('ksp-Fe(OH)3')}), al revés de lo que dicta el Ksp; añadir agua desplaza unos nanomoles más.`, 'fecl3 50, cuso4 10, naoh 5, water 1', ['ksp-Cu(OH)2'], ['ksp-Fe(OH)3']],
    ['oh-amonio-gana-a-fe3', `OH- escaso frente a NH4+ y Fe3+: todo el hidróxido forma NH3, ${p('neutral-ammonium')}, y no precipita Fe(OH)3; el NH3 formado no actúa como base frente al Fe3+.`, 'fecl3 50, nh4no3 1, naoh 5', ['neutral-ammonium'], ['ksp-Fe(OH)3']],
    ['mg-oh-2-con-bicarbonato-no-converge', 'Mg(OH)2 sólido con bicarbonato de sobra: cada pasada disuelve un poco de hidróxido y neutraliza HCO3-; las 120 pasadas no bastan, quedan OH- y HCO3- juntos y añadir agua reanuda la reacción.', 'hcl 20, mg 0.2, naoh 30, nahco3 2, water 1', ['neutral-bicarbonate', 'ksp-Mg(OH)2', 'ksp-MgCO3']],
  ]);

  return cases;
};
export default family;
