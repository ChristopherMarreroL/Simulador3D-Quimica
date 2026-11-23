import { trace } from '../../lib/harness';
import {
  aBandeja, cancelar, cerrarPanel, chorro, coger, cogerFrasco, conmutar, dejar, desechar, devolverBandeja, enjuagar, esperar, gotas, guardar, iniciar, llenarProbeta,
  llenarProbetaExacto, mano, menu, pesar, pesarExacto, ponerFrasco, protegerse, receta, reiniciar, soltar, tic, usar, usarBalanza, usarPiseta, usarProbeta, usarResiduos,
  vaciar, ventana, verter, verterBalanza, verterProbeta,
} from '../lib/ops';
import type { OpSpec, StepCaseSpec, StepFamily } from '../lib/types';

/**
 * Reglas de las herramientas de la campana sin práctica elegida (salvo donde se indica): manos y bandeja,
 * ventana, probeta, balanza, gotero, vertido directo, residuos, cuaderno, sesión y registro.
 * Ejecutar: STEPS_FAMILY=30-herramientas npm run golden:steps   (STEPS_CASE=<texto> filtra lo que imprime)
 */
const falla = (error: string) => ({ avanzaMs: 0, debe: { devuelve: false, error } });

const family: StepFamily = () => {
  const cases: StepCaseSpec[] = [];
  const add = (name: string, why: string, ops: OpSpec[]) => cases.push({ id: `herramientas/${name}`, why, ops });
  const P = protegerse;

  // ---------------------------------------------------------------- manos, estante y bandeja
  add('manos/sin-proteccion', 'Sin gafas ni guantes no se coge ningún frasco, pero la probeta, la balanza, la piseta, los residuos y el tirador sí responden; la comprobación de protección va antes que la de mano ocupada.', [
    coger('hcl', { debe: { mensaje: 'ponte las gafas y los guantes' } }),
    usar('hood-cylinder', { debe: { mensaje: 'La probeta está vacía.' } }), usar('hood-balance', { debe: { mensaje: 'No hay sólido pesado.' } }),
    usar('hood-washbottle', { debe: { mensaje: 'La probeta ya está limpia.' } }), usar('hood-waste', { debe: { mensaje: 'El matraz está vacío.' } }),
    usar('hood-sash', { debe: { mensaje: 'Ventana subida por completo' } }),
    usar('beaker', { debe: { mensaje: 'Vaso de precipitados en la mano derecha' } }),
    coger('hcl', { debe: { mensaje: 'ponte las gafas y los guantes' } }),
    usar('ppe-gloves'), coger('hcl', { debe: { mensaje: 'ponte las gafas:' } }),
    usar('ppe-goggles'), coger('hcl', { debe: { mensaje: 'Esta mano está ocupada' } }),
  ]);
  add('manos/dos-manos-y-vaso', 'Las manos se comparten con el material de la práctica 01: con el vaso en una mano solo queda la otra para frascos.', [
    ...P(), usar('beaker'),
    coger('hcl', { debe: { mensaje: 'Esta mano está ocupada. Cambia con 1 / 2 o deja el objeto con Q.' } }),
    mano('left'), coger('hcl', { debe: { mensaje: 'Ácido clorhídrico en la mano izquierda' } }),
    coger('naoh', { debe: { mensaje: 'Esta mano está ocupada' } }),
    mano('right'), dejar('shelf', { debe: { mensaje: 'Vaso de precipitados colocado en' } }),
    coger('naoh', { debe: { mensaje: 'Hidróxido de sodio en la mano derecha' } }),
  ]);
  add('manos/frasco-en-la-otra-mano', 'Coger con la mano libre un frasco que ya está en la otra no lo cambia de mano.', [
    ...P(), coger('hcl'), mano('left'),
    coger('hcl', { debe: { mensaje: 'Ácido clorhídrico ya está en tu mano.' } }),
  ]);
  add('manos/dejar-segun-objetivo', 'Q deja el frasco en el estante o en la bandeja según a qué se apunte (estantería, un frasco del estante, cualquier cosa de la campana o un frasco de la bandeja); coger de la bandeja repite «Llévalo a la campana».', [
    ...P(), coger('hcl'),
    dejar('hood-waste', { debe: { mensaje: 'Ácido clorhídrico colocado en la bandeja de la campana.' } }),
    coger('hcl', { debe: { mensaje: 'Ácido clorhídrico en la mano derecha. Llévalo a la campana.' } }),
    dejar('reagent-shelf', { debe: { mensaje: 'Ácido clorhídrico devuelto a la estantería, tapado.' } }),
    coger('naoh'), dejar('reagent:hcl', { debe: { mensaje: 'Hidróxido de sodio devuelto a la estantería' } }),
    coger('hcl'), dejar('hood'), coger('naoh'),
    dejar('reagent:hcl', { debe: { mensaje: 'Hidróxido de sodio colocado en la bandeja' } }),
    dejar('hood', { debe: { mensaje: 'Apunta a Reactivos y material o a una mesa' } }),
    dejar('shelf', { debe: { mensaje: 'La mano seleccionada está libre' } }),
    coger('hcl'), dejar('reagent:hcl', { debe: { mensaje: 'Apunta a la estantería de reactivos o a la campana' } }),
  ]);
  add('manos/tutorial', 'Durante el tutorial ningún objetivo de la campana, del estante ni de protección responde.', [
    iniciar('tutorial'),
    usar('ppe-goggles', { debe: { mensaje: 'Termina el tutorial para usar la estantería y la campana.' } }),
    usar('reagent:hcl', { debe: { mensaje: 'Termina el tutorial' } }),
    usar('hood', { debe: { mensaje: 'Termina el tutorial' } }),
    usar('hood-sash', { debe: { mensaje: 'Termina el tutorial' } }),
  ]);
  add('manos/modo-guiado', 'En modo guiado coger un frasco no cambia la práctica activa (en modo libre pasa a «hood»); abrir la campana sí.', [
    iniciar('guided'), ...P(), coger('hcl'),
    usar('hood', { debe: { mensaje: '' } }), cerrarPanel(),
  ]);
  add('manos/objetivos-sin-accion', 'E sobre la campana y el tablero abre su panel; sobre la estantería o un objetivo de la campana sin acción propia solo da la pista.', [
    usar('hood'), cerrarPanel(), usar('recipe-board'), cerrarPanel(),
    usar('reagent-shelf', { debe: { mensaje: 'Apunta a un frasco y pulsa E para recogerlo' } }),
    usar('hood-flask', { debe: { mensaje: 'Apunta a un frasco y pulsa E para recogerlo' } }),
  ]);
  add('bandeja/llena', 'La bandeja admite 8 frascos: el noveno se queda en la mano. «Devolver frascos de la bandeja» los lleva todos al estante y no toca las manos.', [
    ...P(), ...aBandeja('hcl', 'naoh', 'agno3', 'nacl', 'ki', 'cuso4', 'fecl3', 'zn'),
    coger('mg'), dejar('hood', { debe: { mensaje: 'La bandeja de la campana admite 8 frascos. Devuelve alguno a la estantería.' } }),
    mano('left'), coger('cu'), dejar('hood-cylinder', { debe: { mensaje: 'admite 8 frascos' } }),
    devolverBandeja(),
    dejar('hood', { debe: { mensaje: 'Alambre de cobre colocado en la bandeja' } }),
  ]);

  // ---------------------------------------------------------------- ventana y mandos
  add('ventana/posiciones', 'E en el tirador alterna entre trabajo y abierta; desde cerrada (solo se llega por el panel) sube del todo, nunca a trabajo.', [
    usar('hood-sash', { debe: { mensaje: 'Ventana subida por completo' } }),
    usar('hood-sash', { debe: { mensaje: 'Ventana a la altura de trabajo' } }),
    ventana('closed'), usar('hood-sash', { debe: { mensaje: 'Ventana subida por completo' } }),
    ventana('closed'), ventana('work'), ventana('open'),
  ]);
  add('ventana/cerrada-bloquea', 'Con la ventana cerrada fallan el vertido directo y el chorro a cualquier destino; la comprobación de ventana va antes que la de herramienta.', [
    ...P(), ...aBandeja('mg', 'universal'), coger('hcl'), ventana('closed'),
    verter('hcl', 10, falla('La ventana está cerrada. Súbela a la altura de trabajo para trabajar dentro.')),
    chorro('hcl', 'cylinder', falla('La ventana está cerrada')),
    chorro('hcl', undefined, falla('La ventana está cerrada')),
    dejar('hood'), coger('mg'), chorro('mg', 'balance', falla('La ventana está cerrada')),
    dejar('hood'), coger('universal'), chorro('universal', 'flask', falla('La ventana está cerrada')),
  ]);
  add('ventana/cerrada-no-bloquea-todo', 'Con la ventana cerrada sí se puede pasar al matraz lo pesado, enjuagar la probeta (se pierde lo medido) y desechar.', [
    ...P(), coger('hcl'), ...llenarProbetaExacto('hcl', 20), mano('left'), coger('mg'), ...pesarExacto('mg', 0.3),
    ventana('closed'),
    verterProbeta(falla('La ventana está cerrada. Súbela para trabajar dentro.')),
    verterBalanza({ avanzaMs: 1500, debe: { devuelve: true } }),
    enjuagar({ avanzaMs: 900, debe: { devuelve: true } }),
    desechar({ avanzaMs: 1500, debe: { devuelve: true } }),
  ]);
  add('ventana/abierta-del-todo', 'La ventana subida del todo no bloquea nada, aunque su mensaje pide bajarla antes de mezclar.', [
    ...P(), coger('hcl'), usar('hood-sash'),
    ...llenarProbeta('hcl', 10), usarProbeta({ mensaje: 'Viertes 10 mL' }),
    verter('hcl', 5, { avanzaMs: 1500, debe: { devuelve: true } }),
  ]);
  add('mandos/luz-extractor-agitador', 'Luz, extractor y agitador son conmutadores independientes; no cambian nada más.', [
    conmutar('light'), conmutar('fan'), conmutar('stirring'), conmutar('light'), conmutar('stirring'), conmutar('fan'), conmutar('stirring'),
  ]);

  // ---------------------------------------------------------------- probeta
  add('probeta/rechazos-por-tipo', 'Cada tipo de reactivo tiene su herramienta: sólidos a la balanza, indicadores al matraz, líquidos a la probeta. Un frasco del estante no vierte (sin mensaje nuevo); uno de la bandeja sí.', [
    ...P(), ...aBandeja('naoh', 'universal', 'water', 'hcl'), coger('mg'),
    chorro('mg', 'cylinder', falla('Los sólidos se pesan en la balanza.')),
    chorro('mg', 'flask', falla('Pesa primero Cinta de magnesio en la balanza y luego añádelo al matraz.')),
    dejar('hood'), coger('universal'),
    chorro('universal', 'cylinder', falla('Los indicadores se añaden gota a gota directamente al matraz.')),
    chorro('universal', 'balance', falla('En la balanza solo se pesan sólidos.')),
    dejar('hood'), coger('hcl'),
    chorro('hcl', undefined, falla('Mide primero Ácido clorhídrico en la probeta graduada y luego viértela en el matraz.')),
    chorro('hcl', 'balance', falla('En la balanza solo se pesan sólidos.')),
    dejar('hood'), coger('water'),
    chorro('water', 'flask', falla('Mide primero Agua destilada en la probeta graduada')),
    chorro('ki', 'cylinder', { debe: { devuelve: false, error: 'Mide primero Agua destilada' } }),
    chorro('naoh', 'cylinder', { avanzaMs: 300, debe: { devuelve: true, error: '' } }),
    tic(0.1, 5, 100), soltar(),
  ]);
  add('probeta/llena', 'Al llegar a 100 mL el chorro se corta solo con su mensaje; no se puede seguir llenando y los 100 mL se vierten de una vez.', [
    ...P(), coger('water'), chorro('water', 'cylinder', { avanzaMs: 300 }),
    tic(0.1, 120, 100), tic(0.1, 6, 100, { error: 'La probeta está llena (100 mL).' }), tic(0.1, 5, 100), soltar(),
    chorro('water', 'cylinder', falla('La probeta está llena (100 mL).')),
    usarProbeta({ mensaje: 'Viertes 100 mL' }),
  ]);
  add('probeta/menos-de-1-ml', 'Hasta 0,05 mL la probeta cuenta como vacía con restos; entre 0,05 y 1 mL «contiene» el reactivo pero no se puede verter («está vacía»).', [
    ...P(), coger('hcl'), mano('left'), coger('naoh'),
    ...llenarProbetaExacto('hcl', 0.04),
    verterProbeta(falla('La probeta está vacía. Llénala vertiendo un frasco sobre ella (mantén el clic).')),
    chorro('naoh', 'cylinder', falla('La probeta tiene restos de Ácido clorhídrico.')),
    ...llenarProbetaExacto('hcl', 0.95),
    verterProbeta(falla('La probeta está vacía.')),
    chorro('naoh', 'cylinder', falla('La probeta contiene Ácido clorhídrico: viértela en el matraz o enjuágala antes.')),
    ...llenarProbetaExacto('hcl', 0.02),
    verterProbeta({ avanzaMs: 1500, debe: { devuelve: true } }),
  ]);
  add('probeta/redondeo-a-decimas', 'Al matraz llega la lectura redondeada a 0,1 mL (Math.round) y la probeta queda vacía: 20,04 → 20,0; 20,05 → 20,1; 20,049 → 20,0; 1,04 → 1,0; 99,96 → 100,0. El mensaje redondea a mL enteros.', [
    ...P(), coger('water'),
    ...llenarProbetaExacto('water', 20.04), usarProbeta({ mensaje: 'Viertes 20 mL' }),
    ...llenarProbetaExacto('water', 20.05), usarProbeta({ mensaje: 'Viertes 20 mL' }),
    ...llenarProbetaExacto('water', 20.049), usarProbeta({ mensaje: 'Viertes 20 mL' }),
    ...llenarProbetaExacto('water', 1.04), usarProbeta({ mensaje: 'Viertes 1 mL' }),
    ...llenarProbetaExacto('water', 1.5), usarProbeta({ mensaje: 'Viertes 2 mL' }),
    ...llenarProbetaExacto('water', 99.96), usarProbeta({ mensaje: 'Viertes 100 mL' }),
  ]);
  add('probeta/desborde-del-matraz', 'El matraz admite llegar a 500 mL exactos; a partir de ahí la probeta se niega con su mensaje, el vertido directo con el del motor, el gotero se corta y un sólido sí entra.', [
    ...P(), ...aBandeja('universal', 'zn'), coger('water'), verter('water', 200), verter('water', 200),
    ...llenarProbeta('water', 100), usarProbeta({ mensaje: 'Viertes 100 mL' }),
    ...llenarProbetaExacto('water', 1),
    verterProbeta(falla('El matraz se desbordaría: caben 500 mL.')),
    verter('water', 1, falla('El matraz se desbordaría: caben 500 mL y ya contiene 500 mL.')),
    dejar('hood'), coger('universal'), chorro('universal', 'flask', { avanzaMs: 300, debe: { devuelve: true } }),
    tic(0.1, 5, 100, { error: 'El matraz se desbordaría: caben 500 mL y ya contiene 500 mL.' }), soltar(),
    dejar('hood'), coger('zn'), ...pesarExacto('zn', 1), usarBalanza({ mensaje: 'Añades el sólido' }),
  ]);
  {
    // Volumen tras neutralizar 30 mL de HCl con 30 mL de NaOH y añadir 360 mL de agua: no es múltiplo de 0,1 mL.
    const volume = trace([{ reagent: 'hcl', amount: 30 }, { reagent: 'naoh', amount: 30 }, { reagent: 'water', amount: 200 }, { reagent: 'water', amount: 160 }]).waterMl;
    const ml = Math.floor((500 - volume) * 1000) / 1000;
    add('probeta/desborde-tras-redondeo', `La probeta comprueba el desborde con la lectura sin redondear (${ml} mL caben en ${volume.toFixed(3)} mL) pero vierte la redondeada, que ya no cabe: el motor la rechaza al acabar la animación y la probeta conserva su contenido.`, [
      ...P(), ...aBandeja('hcl', 'naoh'), verter('hcl', 30), verter('naoh', 30), coger('water'), verter('water', 200), verter('water', 160),
      ...llenarProbetaExacto('water', ml),
      verterProbeta({ avanzaMs: 1499, debe: { devuelve: true, error: '' } }),
      esperar(1, { error: 'El matraz se desbordaría: caben 500 mL y ya contiene' }),
    ]);
  }
  add('probeta/enjuague', 'Enjuagar tarda 900 ms exactos, tira lo que hubiera en la probeta y borra los restos; con la probeta limpia se niega.', [
    ...P(), enjuagar(falla('La probeta ya está limpia.')),
    usar('hood-washbottle', { debe: { mensaje: 'La probeta ya está limpia.' } }),
    coger('hcl'), ...llenarProbetaExacto('hcl', 30),
    enjuagar({ avanzaMs: 899, debe: { devuelve: true, error: '' } }),
    enjuagar({ avanzaMs: 0, debe: { devuelve: false } }),
    esperar(1), enjuagar(falla('La probeta ya está limpia.')),
  ]);
  add('probeta/inclinacion-300-ms', 'Los primeros 300 ms de reloj desde que empieza el chorro no cae nada (a los 299 ms no, a los 300 sí); el caudal depende de los segundos de cada fotograma, no del reloj.', [
    ...P(), coger('water'), chorro('water', 'cylinder'),
    tic(0.1, 1, 299), tic(0.1, 1, 1), tic(0.1, 1, 0),
    esperar(1000), tic(0.1, 1, 0), tic(0.05, 1, 0), soltar(),
    chorro('water', 'cylinder', { avanzaMs: 200 }), tic(0.1, 1, 0), soltar(),
  ]);
  add('probeta/mismo-reactivo-sin-enjuagar', 'Los restos del mismo reactivo no obligan a enjuagar.', [
    ...P(), coger('hcl'), ...llenarProbeta('hcl', 10), usarProbeta(), ...llenarProbeta('hcl', 15), usarProbeta({ mensaje: 'Viertes 15 mL' }),
  ]);
  add('probeta/soltar-el-frasco-a-medio-chorro', 'Dejar el frasco con Q no corta el chorro: sigue llenando desde la bandeja y desde el estante, y mientras tanto ese frasco no se puede volver a coger.', [
    ...P(), coger('hcl'), chorro('hcl', 'cylinder', { avanzaMs: 300 }), tic(0.1, 5, 100),
    dejar('hood'), tic(0.1, 5, 100),
    coger('hcl', { debe: { mensaje: 'Espera a que termine el vertido.' } }),
    soltar(), coger('hcl'), chorro('hcl', 'cylinder', { avanzaMs: 300 }),
    dejar('reagent-shelf'), tic(0.1, 5, 100), soltar(),
  ]);
  add('probeta/chorro-desde-el-estante', 'Sin frasco fuera del estante el chorro no empieza y no cambia el mensaje de error anterior.', [
    enjuagar(falla('La probeta ya está limpia.')),
    chorro('hcl', 'cylinder', { debe: { devuelve: false, error: 'La probeta ya está limpia.' } }),
    verter('hcl', 10, falla('Ese frasco está en la estantería: tráelo a la campana.')),
  ]);

  // ---------------------------------------------------------------- balanza
  add('balanza/espatula-acelera', 'La espátula acelera con el tiempo de clic: de 0,34 g/s a los 300 ms a 1 g/s a los 2,5 s. Fotograma a fotograma.', [
    ...P(), coger('nahco3'), chorro('nahco3', 'balance'),
    ...Array.from({ length: 30 }, () => tic(0.1, 1, 100)), soltar(),
  ]);
  add('balanza/maximo', 'La balanza se corta en el máximo del sólido (2 g para el magnesio) con su mensaje; se puede volver a intentar y vuelve a cortarse.', [
    ...P(), coger('mg'), chorro('mg', 'balance', { avanzaMs: 3000 }),
    tic(0.5, 3, 500), tic(0.5, 1, 500, { error: 'Máximo para este experimento: 2 g.' }), tic(0.5, 1, 500), soltar(),
    chorro('mg', 'balance', { avanzaMs: 300, debe: { devuelve: true, error: '' } }),
    tic(0.1, 1, 100, { error: 'Máximo para este experimento: 2 g.' }),
    usarBalanza({ mensaje: 'Añades el sólido' }),
  ]);
  add('balanza/maximo-10-g', 'Los demás sólidos se cortan a los 10 g.', [
    ...P(), coger('zn'), chorro('zn', 'balance', { avanzaMs: 3000 }),
    tic(0.1, 99, 100), tic(0.1, 3, 100, { error: 'Máximo para este experimento: 10 g.' }), soltar(),
  ]);
  add('balanza/rechazos', 'Con un sólido en la navecilla no se pesa otro; sin sólido (o con menos de 0,05 g) no hay nada que añadir.', [
    ...P(), verterBalanza(falla('No hay sólido pesado. Con el frasco en la mano, mantén el clic sobre la balanza para añadirlo con la espátula.')),
    usar('hood-balance', { debe: { mensaje: 'No hay sólido pesado.' } }),
    coger('zn'), ...pesarExacto('zn', 0.04),
    verterBalanza(falla('No hay sólido pesado.')),
    mano('left'), coger('mg'),
    chorro('mg', 'balance', falla('La balanza tiene Cinc granulado: añádelo al matraz antes de pesar otro sólido.')),
    ...pesarExacto('zn', 0.02),
    verterBalanza({ avanzaMs: 1500, debe: { devuelve: true } }),
    chorro('mg', 'balance', { debe: { devuelve: true } }), soltar(),
  ]);
  add('balanza/redondeo-a-centesimas', 'Al matraz llega la pesada redondeada a 0,01 g con Math.round sobre gramos·100 en coma flotante: 1,004 → 1,00; 1,005 → 1,00 (100,49999…); 2,675 → 2,68 (267,5 exacto); 0,125 → 0,13.', [
    ...P(), ...aBandeja('acetic'), verter('acetic', 50), coger('nahco3'),
    ...pesarExacto('nahco3', 1.004), usarBalanza(),
    ...pesarExacto('nahco3', 1.005), usarBalanza(),
    ...pesarExacto('nahco3', 2.675), usarBalanza(),
    ...pesarExacto('nahco3', 0.125), usarBalanza(),
  ]);
  add('balanza/en-seco-y-dos-pesadas', 'Un sólido en el matraz seco no reacciona («Sin agua…») hasta que llega un líquido; la navecilla acumula dos pesadas del mismo sólido.', [
    ...P(), ...aBandeja('hcl'), coger('caco3'),
    ...pesar('caco3', 1), ...pesar('caco3', 1), usarBalanza({ mensaje: 'Añades el sólido' }),
    dejar('hood'), coger('hcl'), ...llenarProbeta('hcl', 50), usarProbeta(),
  ]);

  // ---------------------------------------------------------------- gotero
  add('gotero/gotas-y-fusion', 'Cada 0,5 s de clic cae una gota; las gotas de un mismo clic se funden en una sola entrada del registro y una sola adición. Otro clic abre entrada y adición nuevas.', [
    ...P(), ...aBandeja('hcl'), verter('hcl', 20), coger('universal'),
    chorro('universal', 'flask', { avanzaMs: 300, debe: { devuelve: true } }),
    ...Array.from({ length: 16 }, () => tic(0.1, 1, 100)), soltar(),
    chorro('universal'), tic(0.1, 9, 100), soltar(),
  ]);
  add('gotero/fotogramas-grandes', 'El gotero acumula caudal entre fotogramas: 0,26 s no llega a una gota, 0,24 s más sí; un fotograma de 1 s deja dos gotas y uno de 3 s, seis.', [
    ...P(), ...aBandeja('naoh'), verter('naoh', 10), coger('phenolphthalein'),
    chorro('phenolphthalein', 'flask', { avanzaMs: 300 }),
    tic(0.26, 1, 260), tic(0.24, 1, 240), tic(1, 1, 1000), tic(3, 1, 3000), soltar(),
  ]);
  add('gotero/fotogramas-de-50-ms', 'Con fotogramas de 50 ms, diez sumas de 0,1 dan 0,9999999999999999: la primera gota cae en el fotograma 11 (0,55 s), no en el 10.', [
    ...P(), ...aBandeja('water'), verter('water', 50), coger('universal'),
    chorro('universal', 'flask', { avanzaMs: 300 }),
    ...Array.from({ length: 22 }, () => tic(0.05, 1, 50)), soltar(),
  ]);
  add('gotero/mas-de-diez-gotas', 'Un solo clic largo puede dejar más gotas que el máximo de una adición del motor (10): la adición fundida queda en 12.', [
    ...P(), ...aBandeja('water'), verter('water', 50), coger('bromothymol'), ...gotas('bromothymol', 12),
  ]);
  add('gotero/matraz-seco', 'Los cuatro indicadores sobre el matraz vacío: cada gota son 0,05 mL y la nota depende del indicador.', [
    ...P(), ...aBandeja('universal', 'bromothymol', 'starch'), coger('phenolphthalein'), ...gotas('phenolphthalein', 1), dejar('hood'),
    coger('universal'), ...gotas('universal', 2), dejar('hood'),
    coger('bromothymol'), ...gotas('bromothymol', 1), dejar('hood'),
    coger('starch'), ...gotas('starch', 1),
  ]);
  add('gotero/soltar-antes-de-300-ms', 'Soltar antes de los 300 ms no deja caer nada; lo acumulado no se guarda para el clic siguiente.', [
    ...P(), coger('universal'), chorro('universal', 'flask', { avanzaMs: 100 }), tic(0.1, 1, 100), soltar(),
    chorro('universal', 'flask', { avanzaMs: 300 }), tic(0.1, 4, 100), soltar(),
    chorro('universal', 'flask', { avanzaMs: 300 }), tic(0.1, 4, 100), soltar(),
  ]);

  // ---------------------------------------------------------------- vertido directo
  add('directo/reglas', 'Vertido directo: desde la bandeja o la mano, no desde el estante; uno cada vez; fuera de rango y desborde devuelven el mensaje del motor.', [
    ...P(), verter('water', 50, falla('Ese frasco está en la estantería: tráelo a la campana.')),
    ...aBandeja('water', 'universal'), coger('mg'),
    verter('water', 50, { avanzaMs: 700, debe: { devuelve: true, error: '' } }),
    verter('mg', 1, { avanzaMs: 800, debe: { devuelve: false } }),
    verter('mg', 1, { avanzaMs: 1500, debe: { devuelve: true } }),
    verter('water', 0.5, falla('Usa entre 1 y 200 mL.')),
    verter('water', 201, falla('Usa entre 1 y 200 mL.')),
    verter('mg', 3, falla('Usa entre 0,05 y 2 g.')),
    verter('universal', 11, falla('Usa entre 1 y 10 gotas.')),
    verter('universal', 9, { avanzaMs: 1500, debe: { devuelve: true } }),
    verter('water', 200), verter('water', 200),
    verter('water', 51, falla('El matraz se desbordaría: caben 500 mL y ya contiene')),
  ]);
  add('directo/cancelar', 'Cancelar (salir al menú lo usa) corta el vertido directo, la transferencia de la probeta (que conserva su contenido) y el chorro, sin efecto posterior.', [
    ...P(), coger('water'),
    verter('water', 50, { avanzaMs: 700 }), cancelar(), esperar(2000),
    ...llenarProbetaExacto('water', 25), verterProbeta({ avanzaMs: 700, debe: { devuelve: true } }), cancelar(), esperar(2000),
    chorro('water', 'cylinder', { avanzaMs: 300 }), tic(0.1, 3, 100), cancelar(), tic(0.1, 3, 100),
  ]);
  add('directo/ocupado', 'Durante una transferencia (probeta al matraz) no empieza ninguna otra: vertido directo, chorro, balanza, enjuague y residuos devuelven false sin mensaje. La ventana y la práctica sí se pueden cambiar y no la cortan.', [
    ...P(), ...aBandeja('zn'), coger('zn'), ...pesarExacto('zn', 1), dejar('hood'), coger('water'), ...llenarProbetaExacto('water', 25),
    verterProbeta({ avanzaMs: 100, debe: { devuelve: true } }),
    verter('water', 10, { avanzaMs: 0, debe: { devuelve: false, error: '' } }),
    chorro('water', 'cylinder', { debe: { devuelve: false, error: '' } }),
    verterBalanza({ avanzaMs: 0, debe: { devuelve: false, error: '' } }),
    enjuagar({ avanzaMs: 0, debe: { devuelve: false, error: '' } }),
    desechar({ avanzaMs: 0, debe: { devuelve: false, error: '' } }),
    verterProbeta({ avanzaMs: 0, debe: { devuelve: false, error: '' } }),
    ventana('closed'), receta('frio'), esperar(1400),
  ]);

  // ---------------------------------------------------------------- residuos, vaciar, cuaderno
  add('residuos/reglas', 'Desechar con el matraz vacío se niega; con mezcla tarda 1 500 ms, borra mezcla y registro y cuenta un desecho.', [
    ...P(), desechar(falla('El matraz está vacío.')), usar('hood-waste', { debe: { mensaje: 'El matraz está vacío.' } }),
    ...aBandeja('cuso4', 'naoh'), verter('cuso4', 10), verter('naoh', 10),
    desechar({ avanzaMs: 1499, debe: { devuelve: true } }), esperar(1),
    desechar(falla('El matraz está vacío.')),
    verter('naoh', 10), usarResiduos({ mensaje: 'Viertes la mezcla en el recipiente de residuos' }),
  ]);
  add('vaciar/reglas', 'empty() (sin uso en la interfaz actual) vacía al instante, cuenta un desecho aunque el matraz esté vacío, corta un vertido en curso y no toca la práctica: con «clean» pendiente la deja atascada, porque desechar un matraz vacío se niega.', [
    ...P(), vaciar(), ...aBandeja('water'),
    verter('water', 50, { avanzaMs: 700 }), vaciar(), esperar(2000),
    verter('water', 50), receta('frio', { debe: { actual: 'clean' } }),
    vaciar({ debe: { actual: 'clean' } }),
    usar('hood-waste', { debe: { mensaje: 'El matraz está vacío.', actual: 'clean' } }),
  ]);
  add('guardar/reglas', 'Guardar con el matraz vacío no hace nada; con mezcla copia adiciones, pH, temperatura, volumen, sólidos, gases y los títulos y ecuaciones del registro. Otra adición quita la marca de guardado.', [
    ...P(), guardar(), ...aBandeja('acetic', 'nahco3', 'cuso4', 'naoh'),
    verter('acetic', 50), verter('nahco3', 2), guardar(),
    verter('cuso4', 10), verter('naoh', 10), guardar(),
  ]);

  // ---------------------------------------------------------------- sesión
  add('sesion/menu-e-iniciar', 'Salir al menú corta el vertido en curso sin efecto; iniciar otra sesión devuelve frascos, herramientas y protección al estado inicial.', [
    ...P(), ...aBandeja('water'), coger('hcl'), ...llenarProbetaExacto('hcl', 20),
    verter('water', 50, { avanzaMs: 700 }), menu(), esperar(2000),
    iniciar('free'),
  ]);
  add('sesion/reiniciar', 'resetSession() devuelve la campana al estado inicial (frascos, mezcla, herramientas, práctica, ventana y mandos) pero conserva el cuaderno; la protección es del laboratorio y no cambia.', [
    ...P(), ...aBandeja('agno3', 'nacl'), receta('cloruro-plata'), verter('agno3', 20), verter('nacl', 5), guardar(),
    coger('nacl'), ...llenarProbetaExacto('nacl', 7), mano('left'), coger('zn'), ...pesarExacto('zn', 1),
    ventana('open'), conmutar('light'), conmutar('fan'), conmutar('stirring'),
    enjuagar({ avanzaMs: 300 }), reiniciar(), esperar(2000),
  ]);

  // ---------------------------------------------------------------- registro
  add('registro/tope-de-40', 'El registro guarda las últimas 40 adiciones: la 41.ª expulsa la primera (cantidades de 1, 2 y 3 mL para distinguir las entradas).', [
    ...P(), ...aBandeja('water'), ...Array.from({ length: 42 }, (_, i) => verter('water', 1 + i % 3)),
  ]);
  add('guardar/tope-de-30', 'El cuaderno de la campana conserva los últimos 30 registros: al guardar el 31.º sigue habiendo 30.', [
    ...P(), ...aBandeja('water'), verter('water', 10), ...Array.from({ length: 31 }, () => guardar()),
    verter('water', 1), guardar(),
  ]);

  // ---------------------------------------------------------------- reglas que solo se ven a medio chorro o sin las teclas
  add('chorro/ventana-y-herramientas-a-medias', 'Con un chorro en curso, cerrar la ventana no lo corta; E sobre la probeta, la piseta o los residuos no hace nada (mensaje vacío); elegir una práctica tampoco lo corta, y un segundo chorro no empieza. Al soltar, la ventana cerrada ya impide volver a empezar.', [
    ...P(), ...aBandeja('water'), verter('water', 20), coger('hcl'),
    chorro('hcl', 'cylinder', { avanzaMs: 300 }), tic(0.1, 5, 100),
    ventana('closed'), tic(0.1, 5, 100),
    usar('hood-cylinder', { debe: { mensaje: '' } }),
    verterProbeta({ avanzaMs: 0, debe: { devuelve: false, error: '' } }),
    usar('hood-washbottle', { debe: { mensaje: '' } }), usar('hood-waste', { debe: { mensaje: '' } }),
    receta('neutralizacion', { debe: { actual: 'clean' } }), tic(0.1, 5, 100),
    chorro('hcl', 'cylinder', { debe: { devuelve: false, error: '' } }), tic(0.1, 5, 100),
    soltar(),
    chorro('hcl', 'cylinder', falla('La ventana está cerrada')),
  ]);
  add('gotero/fusion-de-eventos', 'Una gota inerte reanuda una reacción que el motor dejó sin converger (BaCO₃ con CuSO₄): las gotas de un mismo clic funden sus eventos por regla y sentido sumando avance, calor y moles de sólido; el calor desconocido del CuCO₃ sigue desconocido, ΔT se suma y la nota queda vacía.', [
    ...P(), ...aBandeja('bacl2', 'na2co3', 'cuso4'), verter('bacl2', 50), verter('na2co3', 10), verter('cuso4', 10),
    coger('universal'), chorro('universal', 'flask', { avanzaMs: 300 }),
    ...Array.from({ length: 16 }, () => tic(0.1, 1, 100)), soltar(),
  ]);
  add('gotero/fusion-de-eventos-con-calor', 'Lo mismo con PbCl₂ que pasa a PbI₂: precipitado y redisolución del mismo clic se funden cada uno con los suyos y sus calores (conocidos) se suman.', [
    ...P(), ...aBandeja('pbno3', 'nacl', 'ki'), verter('pbno3', 50), verter('nacl', 100), verter('ki', 20),
    coger('phenolphthalein'), chorro('phenolphthalein', 'flask', { avanzaMs: 300 }),
    tic(0.1, 5, 100), tic(0.1, 5, 100), tic(0.1, 10, 100), soltar(),
  ]);
  add('gotero/rafaga-heredada', 'La ráfaga visual tras una efervescencia: las gotas que llegan antes de 1 500 ms sin gas ni sólido conservan la ráfaga anterior; la siguiente (a 1 800 ms) crea una nueva que hereda el 80 % del gas y el 90 % del vigor; a los 2 000 ms ya no hereda gas, pero sí vigor.', [
    ...P(), ...aBandeja('acetic', 'nahco3'), coger('universal'), verter('acetic', 50), verter('nahco3', 2),
    chorro('universal', 'flask', { avanzaMs: 300, debe: { devuelve: true } }),
    ...Array.from({ length: 16 }, () => tic(0.1, 1, 100)), esperar(1500), ...Array.from({ length: 5 }, () => tic(0.1, 1, 100)), soltar(),
  ]);
  add('balanza/matraz-pasado-de-500', 'El agua de una neutralización deja el matraz por encima de 500 mL y desde ahí el motor rechaza hasta un sólido: la balanza acepta la orden (el mensaje dice que lo añades), falla al acabar la animación y conserva lo pesado; el vertido directo se niega al momento.', [
    ...P(), ...aBandeja('hcl', 'water', 'naoh'), verter('hcl', 200), verter('water', 200), verter('water', 50), verter('naoh', 50),
    coger('zn'), ...pesarExacto('zn', 1),
    verterBalanza({ avanzaMs: 1499, debe: { devuelve: true, error: '' } }),
    esperar(1, { error: 'El matraz se desbordaría: caben 500 mL y ya contiene 501 mL.' }),
    verter('zn', 1, falla('El matraz se desbordaría: caben 500 mL y ya contiene 501 mL.')),
    usar('hood-balance', { avanzaMs: 1500, debe: { mensaje: 'Añades el sólido pesado al matraz' } }),
  ]);
  add('almacen/coger-y-poner-directos', 'pick() y put() del almacén sin pasar por las teclas E y Q: no miran la protección ni si la mano ya lleva un frasco. Con dos frascos en la misma mano, «el que sostiene» es el primero en el orden del estante y put() mueve ese. put() con la mano vacía solo devuelve su mensaje.', [
    ponerFrasco('right', 'hood', { debe: { devuelve: 'La mano seleccionada no sostiene un frasco.' } }),
    cogerFrasco('naoh', 'right', { debe: { devuelve: 'Hidróxido de sodio en la mano derecha. Llévalo a la campana.' } }),
    cogerFrasco('hcl', 'right', { debe: { devuelve: 'Ácido clorhídrico en la mano derecha. Llévalo a la campana.' } }),
    cogerFrasco('naoh', 'left', { debe: { devuelve: 'Hidróxido de sodio ya está en tu mano.' } }),
    ponerFrasco('right', 'hood', { debe: { devuelve: 'Ácido clorhídrico colocado en la bandeja de la campana.' } }),
    ponerFrasco('right', 'shelf', { debe: { devuelve: 'Hidróxido de sodio devuelto a la estantería, tapado.' } }),
    cogerFrasco('hcl', 'left', { debe: { devuelve: 'Ácido clorhídrico en la mano izquierda. Llévalo a la campana.' } }),
    chorro('hcl', 'cylinder', { avanzaMs: 300 }), tic(0.1, 2, 100),
    cogerFrasco('hcl', 'right', { debe: { devuelve: 'Espera a que termine el vertido.' } }),
    soltar(),
  ]);
  add('practica/desconocida', 'Elegir un id de práctica que no existe equivale a abandonar: no queda práctica en curso. Elegir otra práctica sustituye a la anterior sin conservar nada.', [
    ...P(), ...aBandeja('agno3'), receta('cloruro-plata', { debe: { actual: 'collect' } }), verter('agno3', 20, { avanzaMs: 1500, debe: { actual: 'collect', hechos: ['add-0'] } }),
    receta('no-existe'), receta('arbol-plata', { debe: { actual: 'clean', pendientes: ['add-0'] } }), receta(null),
  ]);
  return cases;
};
export default family;
