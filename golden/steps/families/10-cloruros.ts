import { recipeById } from '../../../src/experiments/hoodRecipes';
import {
  aBandeja, addAll, cerrarPanel, chorro, coger, con, dejar, desechar, devolverBandeja, esperar, gotas, guardar, llenarProbeta, llenarProbetaExacto, mano,
  protegerse, receta, soltar, tic, usar, usarPiseta, usarProbeta, usarResiduos, ventana, verter, verterProbeta,
} from '../lib/ops';
import type { OpSpec, StepCaseSpec, StepFamily } from '../lib/types';

/**
 * «Prueba de cloruros» (cloruro-plata) con todo detalle: es la práctica del corte vertical de la Fase 1.
 * AgNO₃ 20 mL y NaCl 5 mL, los dos con probeta; el paso se da por hecho con el 90 % (18,0 y 4,5 mL).
 * Ejecutar: STEPS_FAMILY=10-cloruros npm run golden:steps   (STEPS_CASE=<texto> filtra lo que imprime)
 */
const ID = 'cloruro-plata', AG = 'agno3', CL = 'nacl';
/** Protegido y con la práctica elegida. */
const listo = (): OpSpec[] => [...protegerse(), receta(ID)];
/** Además, los dos frascos en la bandeja. */
const enBandeja = (): OpSpec[] => [...listo(), ...aBandeja(AG, CL)];
/** Mide `ml` exactos con la probeta, los pasa al matraz y deja el frasco en la bandeja. */
const medir = (id: string, ml: number, rinse = false): OpSpec[] => [coger(id), ...(rinse ? [usarPiseta()] : []), ...llenarProbetaExacto(id, ml), usarProbeta({ mensaje: 'Viertes' }), dejar('hood')];
const terminar = (): OpSpec[] => [guardar({ debe: { actual: 'dispose' } }), usarResiduos({ actual: 'fin' })];

const family: StepFamily = () => {
  const cases: StepCaseSpec[] = [];
  const add = (name: string, why: string, ops: OpSpec[]) => cases.push({ id: `cloruros/${name}`, why, ops });

  add('proteccion-gafas-primero', 'Sin protección no se puede coger ningún frasco; el paso «ppe» señala lo que falta y cada mensaje nombra lo que falta.', [
    receta(ID, { debe: { actual: 'ppe', objetivos: ['ppe-goggles', 'ppe-gloves'] } }),
    coger(AG, { debe: { mensaje: 'ponte las gafas y los guantes' } }),
    usar('ppe-goggles', { debe: { mensaje: 'Gafas de seguridad puestas', actual: 'ppe', objetivos: ['ppe-gloves'] } }),
    coger(AG, { debe: { mensaje: 'ponte los guantes' } }),
    usar('ppe-goggles', { debe: { mensaje: 'Ya llevas las gafas' } }),
    usar('ppe-gloves', { debe: { mensaje: 'Guantes de nitrilo puestos', actual: 'collect', objetivos: [`reagent:${AG}`, `reagent:${CL}`] } }),
    usar('ppe-gloves', { debe: { mensaje: 'Ya llevas guantes' } }),
    coger(AG, { debe: { mensaje: 'Nitrato de plata en la mano derecha' } }),
  ]);
  add('proteccion-guantes-primero', 'Con guantes y sin gafas el paso «ppe» solo señala las gafas y el mensaje solo las pide a ellas.', [
    usar('ppe-gloves'),
    receta(ID, { debe: { actual: 'ppe', objetivos: ['ppe-goggles'] } }),
    coger(CL, { debe: { mensaje: 'ponte las gafas:' } }),
    usar('ppe-goggles', { debe: { actual: 'collect' } }),
    coger(CL, { debe: { mensaje: 'Cloruro de sodio en la mano derecha' } }),
  ]);
  add('frascos-estante-mano-bandeja', 'El paso «collect» y los objetivos de cada «add» cambian según el frasco esté en el estante, en una mano o en la bandeja; devolverlo al estante deshace «collect».', [
    ...listo(),
    coger(AG, { debe: { actual: 'collect', objetivos: [`reagent:${CL}`] } }),
    mano('left'),
    coger(CL, { debe: { actual: 'add-0', objetivos: ['hood-cylinder'], etiqueta: 'Llena hasta 20 mL', hechos: ['collect'] } }),
    dejar('hood', { debe: { mensaje: 'Cloruro de sodio colocado en la bandeja' } }),
    mano('right'),
    dejar('hood', { debe: { actual: 'add-0', objetivos: [`reagent:${AG}`], etiqueta: 'Nitrato de plata' } }),
    coger(AG, { debe: { objetivos: ['hood-cylinder'] } }),
    dejar('reagent-shelf', { debe: { mensaje: 'devuelto a la estantería, tapado', actual: 'collect', objetivos: [`reagent:${AG}`] } }),
    devolverBandeja({ debe: { actual: 'collect', objetivos: [`reagent:${AG}`, `reagent:${CL}`] } }),
  ]);
  add('frascos-devueltos-antes-y-despues', 'Un frasco devuelto al estante vuelve a pedirse solo si su cantidad no está añadida todavía.', [
    ...enBandeja(),
    coger(AG), ...llenarProbetaExacto(AG, 20), usarProbeta({ actual: 'add-1' }),
    dejar('reagent-shelf', { debe: { actual: 'add-1', hechos: ['collect', 'add-0'] } }),
    coger(CL),
    dejar(`reagent:${AG}`, { debe: { mensaje: 'Cloruro de sodio devuelto a la estantería', actual: 'collect', objetivos: [`reagent:${CL}`] } }),
  ]);
  add('probeta-fotograma-a-fotograma', 'Llenado de la probeta fotograma a fotograma: 300 ms de inclinación sin caudal, 0,8 mL por fotograma de 100 ms y el objetivo pasa de «Llena hasta 20 mL» a «E · Verter en el matraz» al llegar a 18 mL.', [
    ...enBandeja(), coger(AG),
    chorro(AG, 'cylinder', { debe: { devuelve: true } }),
    ...Array.from({ length: 3 }, () => tic(0.1, 1, 100, { etiqueta: 'Llena hasta 20 mL' })),
    ...Array.from({ length: 22 }, () => tic(0.1, 1, 100, { etiqueta: 'Llena hasta 20 mL' })),
    tic(0.1, 1, 100, { etiqueta: 'E · Verter en el matraz' }),
    tic(0.1, 1, 100), tic(0.1, 1, 100),
    soltar(),
    usar('hood-cylinder', { debe: { mensaje: 'Viertes 20 mL' } }),
    esperar(1499, { pendientes: ['add-0'] }),
    esperar(1, { actual: 'add-1', objetivos: ['hood-washbottle'] }),
    dejar('hood'), coger(CL, { debe: { objetivos: ['hood-washbottle'] } }),
    usar('hood-washbottle', { debe: { mensaje: 'Enjuagas la probeta' } }),
    esperar(899, { objetivos: ['hood-washbottle'] }),
    esperar(1, { objetivos: ['hood-cylinder'], etiqueta: 'Llena hasta 5 mL' }),
    chorro(CL, 'cylinder', { avanzaMs: 300 }),
    ...Array.from({ length: 5 }, () => tic(0.1, 1, 100, { etiqueta: 'Llena hasta 5 mL' })),
    tic(0.1, 1, 100, { etiqueta: 'E · Verter en el matraz' }),
    soltar(),
    usarProbeta({ mensaje: 'Viertes 5 mL', actual: 'save', hechos: ['observe'] }),
    dejar('hood'), ...terminar(),
  ]);
  add('borde-agno3-17,9', 'Con 17,9 mL en la probeta (justo por debajo del 90 %) la guía sigue pidiendo llenar; vertidos, el paso no se da por hecho. Menos de 1 mL no se puede verter.', [
    ...enBandeja(), coger(AG),
    ...con(llenarProbetaExacto(AG, 17.9), { actual: 'add-0', objetivos: ['hood-cylinder'], etiqueta: 'Llena hasta 20 mL' }),
    usarProbeta({ mensaje: 'Viertes 18 mL', actual: 'add-0', etiqueta: 'Llena hasta 20 mL' }),
    ...llenarProbetaExacto(AG, 0.9),
    usar('hood-cylinder', { debe: { mensaje: 'La probeta está vacía' } }),
    ...llenarProbetaExacto(AG, 0.2),
    usarProbeta({ mensaje: 'Viertes 1 mL', actual: 'add-1' }),
  ]);
  add('borde-agno3-18,0', 'Con 18,0 mL exactos (el 90 % de 20) la guía ya manda verter, y vertidos el paso queda hecho.', [
    ...enBandeja(), coger(AG),
    ...con(llenarProbetaExacto(AG, 18), { actual: 'add-0', objetivos: ['hood-cylinder'], etiqueta: 'E · Verter en el matraz' }),
    usarProbeta({ mensaje: 'Viertes 18 mL', actual: 'add-1', objetivos: ['hood-washbottle'] }),
  ]);
  add('borde-nacl-4,4', 'Con 4,4 mL de NaCl el paso no se da por hecho aunque el AgCl ya precipita: «observe» queda hecho antes que «add-1».', [
    ...enBandeja(), ...medir(AG, 20), coger(CL), usarPiseta(),
    ...con(llenarProbetaExacto(CL, 4.4), { actual: 'add-1', objetivos: ['hood-cylinder'], etiqueta: 'Llena hasta 5 mL' }),
    usarProbeta({ mensaje: 'Viertes 4 mL', actual: 'add-1', hechos: ['observe'], pendientes: ['add-1', 'save'] }),
    ...llenarProbetaExacto(CL, 1),
    usarProbeta({ mensaje: 'Viertes 1 mL', actual: 'save' }),
  ]);
  add('borde-nacl-4,5', 'Con 4,5 mL exactos (el 90 % de 5) la guía manda verter y el paso queda hecho. El mensaje redondea a mL enteros.', [
    ...enBandeja(), ...medir(AG, 20), coger(CL), usarPiseta(),
    ...con(llenarProbetaExacto(CL, 4.5), { actual: 'add-1', objetivos: ['hood-cylinder'], etiqueta: 'E · Verter en el matraz' }),
    usarProbeta({ mensaje: 'Viertes 5 mL', actual: 'save' }),
  ]);
  add('probeta-con-restos', 'Tras verter el AgNO₃ la probeta tiene sus restos: la guía manda a la piseta y no deja medir NaCl hasta enjuagar.', [
    ...enBandeja(), ...medir(AG, 20),
    coger(CL, { debe: { actual: 'add-1', objetivos: ['hood-washbottle'], etiqueta: 'Enjuaga la probeta' } }),
    chorro(CL, 'cylinder', { debe: { devuelve: false, error: 'La probeta tiene restos de Nitrato de plata. Enjuágala con la piseta' } }),
    usar('hood-cylinder', { debe: { mensaje: 'La probeta está vacía' } }),
    usarPiseta({ mensaje: 'Enjuagas la probeta', objetivos: ['hood-cylinder'], etiqueta: 'Llena hasta 5 mL' }),
    usar('hood-washbottle', { debe: { mensaje: 'La probeta ya está limpia.' } }),
    ...llenarProbeta(CL, 5), usarProbeta({ actual: 'save' }),
  ]);
  add('probeta-ocupada-por-otro-reactivo', 'Si se mide antes el NaCl, la guía sigue señalando la probeta para el AgNO₃ aunque esté ocupada; el almacén se niega hasta verterla o enjuagarla.', [
    ...enBandeja(), mano('left'), coger(CL),
    ...con(llenarProbetaExacto(CL, 5), { actual: 'add-0', objetivos: [`reagent:${AG}`] }),
    mano('right'),
    coger(AG, { debe: { actual: 'add-0', objetivos: ['hood-cylinder'], etiqueta: 'Llena hasta 20 mL' } }),
    chorro(AG, 'cylinder', { debe: { devuelve: false, error: 'La probeta contiene Cloruro de sodio: viértela en el matraz o enjuágala antes.' } }),
    usarProbeta({ mensaje: 'Viertes 5 mL', actual: 'add-0', hechos: ['add-1'], objetivos: ['hood-washbottle'] }),
    usarPiseta(), ...llenarProbetaExacto(AG, 20),
    usarProbeta({ mensaje: 'Viertes 20 mL', actual: 'save' }),
  ]);
  add('pasarse-de-cantidad', 'No hay tope superior: con el doble de cada reactivo los pasos quedan hechos igual.', [
    ...enBandeja(), ...medir(AG, 40), ...con(medir(CL, 10, true), { actual: 'save', hechos: ['add-0', 'add-1', 'observe'] }), ...terminar(),
  ]);
  add('matraz-sucio-al-elegir', 'Elegir la práctica con el matraz usado añade el paso «clean»; lo añadido mientras tanto cuenta, pero desechar lo borra y hay que repetirlo.', [
    ...protegerse(), ...aBandeja('water', AG, CL),
    coger('water'), ...llenarProbeta('water', 50), usarProbeta(), dejar('hood'),
    receta(ID, { debe: { actual: 'clean', objetivos: ['hood-waste'], hechos: ['ppe', 'collect'] } }),
    coger(AG), usarPiseta(), ...llenarProbetaExacto(AG, 20),
    usarProbeta({ actual: 'clean', hechos: ['add-0'] }),
    usarResiduos({ mensaje: 'Viertes la mezcla', actual: 'add-0', pendientes: ['add-0', 'dispose'] }),
    ...llenarProbetaExacto(AG, 20), usarProbeta({ actual: 'add-1' }), dejar('hood'),
    ...con(medir(CL, 5, true), { actual: 'save' }), ...terminar(),
  ]);
  add('guardar-antes-de-limpiar', 'Guardar la mezcla vieja con la práctica ya elegida marca «save»; desechar para limpiar no lo desmarca.', [
    ...protegerse(), ...aBandeja('water'), verter('water', 50),
    receta(ID, { debe: { actual: 'clean' } }),
    guardar({ debe: { actual: 'clean', hechos: ['save'] } }),
    usarResiduos({ actual: 'collect', hechos: ['save'], pendientes: ['observe', 'dispose'] }),
  ]);
  add('observado-por-registro-anterior', '«observe» mira el registro entero: si la reacción ya estaba registrada antes de elegir la práctica, cualquier adición (una gota de indicador) lo marca; desechar para limpiar lo desmarca.', [
    ...protegerse(), ...aBandeja(AG, CL, 'universal'), verter(AG, 20), verter(CL, 5),
    receta(ID, { debe: { actual: 'clean', pendientes: ['observe'] } }),
    coger('universal'),
    ...con(gotas('universal', 1), { actual: 'clean', hechos: ['observe'] }),
    usarResiduos({ actual: 'add-0', pendientes: ['observe', 'add-0', 'add-1'] }),
  ]);
  add('guardar-dos-veces-y-desechar', 'Final normal: guardar marca «save» y crea un registro del cuaderno; guardar otra vez crea otro; desechar marca «dispose»; guardar con el matraz vacío no hace nada.', [
    ...enBandeja(), ...medir(AG, 20), ...con(medir(CL, 5, true), { actual: 'save' }),
    guardar({ debe: { actual: 'dispose' } }), guardar(),
    usarResiduos({ actual: 'fin' }), guardar(),
  ]);
  add('desechar-sin-guardar', 'Desechar tras observar da por hecho también «save»: el cuaderno se puede saltar.', [
    ...enBandeja(), ...medir(AG, 20), ...con(medir(CL, 5, true), { actual: 'save' }),
    usarResiduos({ actual: 'fin', hechos: ['save', 'dispose'] }),
  ]);
  add('guardar-antes-de-observar', 'Guardar con solo el primer reactivo ya marca «save» para toda la práctica.', [
    ...enBandeja(), ...medir(AG, 20),
    guardar({ debe: { actual: 'add-1', hechos: ['save'] } }),
    ...con(medir(CL, 5, true), { actual: 'dispose', hechos: ['observe', 'save'] }),
    usarResiduos({ actual: 'fin' }),
  ]);
  add('desechar-a-medias', 'Desechar antes de observar no marca «dispose» pero conserva lo añadido: «add-0» sigue hecho con el matraz vacío y la práctica se atasca en «observe» hasta volver a elegirla.', [
    ...enBandeja(), ...medir(AG, 20),
    usarResiduos({ mensaje: 'Viertes la mezcla', actual: 'add-1', hechos: ['add-0'], pendientes: ['dispose'] }),
    ...con(medir(CL, 5, true), { actual: 'observe', hechos: ['add-0', 'add-1'], pendientes: ['observe'] }),
    usarResiduos({ actual: 'observe', pendientes: ['dispose'] }),
    receta(ID, { debe: { actual: 'add-0' } }),
    ...medir(AG, 20, true), ...con(medir(CL, 5, true), { actual: 'save' }), ...terminar(),
  ]);
  add('cambiar-de-practica-con-matraz-sucio', 'Con el AgCl aún en el matraz se elige «Lluvia de oro»: aparece «clean», desechar no cuenta como «dispose» de la nueva y luego se completa.', [
    ...enBandeja(), ...medir(AG, 20), ...con(medir(CL, 5, true), { actual: 'save' }),
    receta('lluvia-oro', { debe: { actual: 'clean', objetivos: ['hood-waste'] } }),
    usarResiduos({ actual: 'collect', objetivos: ['reagent:pbno3', 'reagent:ki'], pendientes: ['dispose', 'save'] }),
    devolverBandeja(), ...aBandeja('pbno3', 'ki'),
    ...con(addAll(recipeById('lluvia-oro')!, { exact: true, dirty: CL }), { actual: 'save' }),
    ...terminar(),
  ]);
  add('abandonar', 'Abandonar la práctica (selectRecipe(null)) quita los pasos; la mezcla y las herramientas siguen como estaban.', [
    ...enBandeja(), ...medir(AG, 20),
    receta(null),
    ...medir(CL, 5, true), guardar(), desechar({ avanzaMs: 1500, debe: { devuelve: true } }),
  ]);
  add('vertido-directo', 'Con el vertido directo (pour) la práctica avanza igual que con las herramientas; el efecto llega a los 1 500 ms exactos, no antes.', [
    ...enBandeja(),
    verter(AG, 20, { avanzaMs: 1499, debe: { devuelve: true, pendientes: ['add-0'] } }),
    esperar(1, { actual: 'add-1' }),
    verter(CL, 5, { avanzaMs: 1500, debe: { actual: 'save' } }),
    guardar(), desechar({ avanzaMs: 1500, debe: { devuelve: true, actual: 'fin' } }),
  ]);
  add('completada-y-repetida', 'Tras completarla, seguir añadiendo no cambia los pasos; volver a elegirla empieza de cero y, con el matraz usado, pide limpiar.', [
    ...enBandeja(), verter(AG, 20), verter(CL, 5),
    desechar({ avanzaMs: 1500, debe: { actual: 'fin' } }),
    verter(AG, 20, { avanzaMs: 1500, debe: { actual: 'fin' } }),
    receta(ID, { debe: { actual: 'clean' } }),
  ]);
  add('ventana-cerrada', 'Con la ventana cerrada no se puede llenar la probeta ni verterla (mensajes distintos); sí enjuagar, guardar y desechar. E en el tirador la sube del todo desde cerrada.', [
    ...enBandeja(), coger(AG), ventana('closed'),
    chorro(AG, 'cylinder', { debe: { devuelve: false, error: 'La ventana está cerrada. Súbela a la altura de trabajo para trabajar dentro.' } }),
    usar('hood-sash', { debe: { mensaje: 'Ventana subida por completo' } }),
    ...llenarProbetaExacto(AG, 20), ventana('closed'),
    usar('hood-cylinder', { debe: { mensaje: 'La ventana está cerrada. Súbela para trabajar dentro.', pendientes: ['add-0'] } }),
    verterProbeta({ debe: { devuelve: false } }),
    ventana('work'), usarProbeta({ mensaje: 'Viertes 20 mL', actual: 'add-1' }),
    ventana('closed'), usarPiseta({ mensaje: 'Enjuagas la probeta' }),
    usar('hood-sash'), usar('hood-sash', { debe: { mensaje: 'altura de trabajo' } }),
    dejar('hood'), coger(CL), ...llenarProbeta(CL, 5), usarProbeta({ actual: 'save' }),
    ventana('closed'), guardar({ debe: { actual: 'dispose' } }), usarResiduos({ mensaje: 'Viertes la mezcla', actual: 'fin' }),
  ]);
  add('manos-llenas', 'Con un frasco en cada mano no se puede coger un tercero; Q sin apuntar al estante o a la campana no suelta nada.', [
    ...listo(), coger(AG),
    coger(CL, { debe: { mensaje: 'Esta mano está ocupada' } }),
    mano('left'), coger(CL, { debe: { mensaje: 'en la mano izquierda', actual: 'add-0' } }),
    coger('hcl', { debe: { mensaje: 'Esta mano está ocupada' } }),
    mano('right'), coger('hcl', { debe: { mensaje: 'Esta mano está ocupada' } }),
    dejar(null, { debe: { mensaje: 'Apunta a la estantería de reactivos o a la campana' } }),
    dejar('bench', { debe: { mensaje: 'Apunta a la estantería de reactivos o a la campana' } }),
    ...llenarProbeta(AG, 20), usarProbeta({ actual: 'add-1', objetivos: ['hood-washbottle'] }),
    usarPiseta({ objetivos: ['hood-cylinder'] }),
    ...llenarProbeta(CL, 5), usarProbeta({ actual: 'save' }),
  ]);
  add('fotogramas-de-16-ms', 'La práctica a 60 fotogramas por segundo: la probeta acumula 0,128 mL por fotograma con su error de coma flotante y el vertido redondea a 0,1 mL.', [
    ...enBandeja(), coger(AG), ...llenarProbeta(AG, 20, 16), usarProbeta({ mensaje: 'Viertes 20 mL', actual: 'add-1' }), dejar('hood'),
    coger(CL), usarPiseta(), ...llenarProbeta(CL, 5, 16), usarProbeta({ mensaje: 'Viertes 5 mL', actual: 'save' }), dejar('hood'), ...terminar(),
  ]);
  add('dos-llenados', 'La probeta se puede llenar en dos veces con el mismo reactivo: 12 mL, soltar, y 8 mL más.', [
    ...enBandeja(), coger(AG),
    ...con(llenarProbeta(AG, 12), { etiqueta: 'Llena hasta 20 mL' }),
    ...con(llenarProbeta(AG, 8), { etiqueta: 'E · Verter en el matraz' }),
    usarProbeta({ mensaje: 'Viertes 20 mL', actual: 'add-1' }),
  ]);
  add('gotas-ajenas', 'Un reactivo que la práctica no pide (indicador universal) se anota en «added» pero no cambia ningún paso.', [
    ...enBandeja(), ...aBandeja('universal'), ...medir(AG, 20),
    coger('universal'), ...con(gotas('universal', 3), { actual: 'add-1' }), dejar('hood'),
    ...con(medir(CL, 5, true), { actual: 'save' }),
  ]);
  add('orden-inverso', 'El orden no se exige: con el NaCl primero queda hecho «add-1» y el paso actual sigue siendo «add-0».', [
    ...enBandeja(), coger(CL), ...llenarProbetaExacto(CL, 5),
    usarProbeta({ actual: 'add-0', hechos: ['add-1'] }), dejar('hood'),
    ...con(medir(AG, 20, true), { actual: 'save' }), ...terminar(),
  ]);
  add('sin-practica-pista-libre', 'Sin práctica elegida no hay pasos; la pista de mezcla libre (hoodGuidedIndex) va de 0 a 3 con la misma reacción.', [
    ...protegerse(), coger(AG), dejar('hood'), coger(CL), dejar('hood'),
    verter(AG, 20), verter(CL, 5), guardar(), desechar(), devolverBandeja(),
  ]);
  add('residuos-durante-el-vertido', 'Mientras la probeta se vacía (1 500 ms) no se puede desechar ni enjuagar; E sobre otra herramienta deja el mensaje vacío.', [
    ...enBandeja(), coger(AG), ...llenarProbetaExacto(AG, 20),
    usar('hood-cylinder', { debe: { mensaje: 'Viertes 20 mL' } }),
    usar('hood-waste', { debe: { mensaje: '' } }),
    desechar({ debe: { devuelve: false } }),
    usar('hood-washbottle', { debe: { mensaje: '' } }),
    esperar(1500, { actual: 'add-1' }),
    usarResiduos({ mensaje: 'Viertes la mezcla', actual: 'add-1', hechos: ['add-0'] }),
  ]);
  add('elegir-durante-el-vertido', 'Elegir la práctica con un vertido en curso: el matraz aún está vacío, así que no pide limpiar, y lo que llega después cuenta para la nueva.', [
    ...enBandeja(), coger(AG), ...llenarProbetaExacto(AG, 20),
    usar('hood-cylinder', { avanzaMs: 700 }),
    usar('recipe-board'), receta(ID, { debe: { actual: 'add-0' } }), cerrarPanel(),
    esperar(800, { actual: 'add-1', hechos: ['add-0'] }),
  ]);
  return cases;
};
export default family;
