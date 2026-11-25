import { reagents, shelfRows, type ReagentId } from '../../src/chemistry/reagents';
import { amountText, useHood } from '../../src/state/hood';
import { useLab } from '../../src/state/lab';
import type { Partida } from './partida';

/**
 * Guía para quien no ha pisado un laboratorio: a partir del paso actual de la misión (recipeSteps, de la capa de
 * estado) dice a dónde ir, cómo reconocer el objeto, qué tecla usar y cuánto falta. No decide nada: solo explica
 * el objetivo que ya marca la capa, y lo que hay que hacer con la mano ocupada o la probeta sucia.
 */
export interface Guia {
  /** Objetivo al que apunta la flecha grande (identificador de la escena), o null. */
  objetivo: string | null;
  /** Texto corto sobre la flecha. */
  etiqueta: string;
  titulo: string;
  /** Instrucciones en orden, en lenguaje llano. */
  lineas: string[];
  /** Cantidad en curso frente a la que pide la misión. */
  medidor?: { valor: number; meta: number; unidad: string; decimales: number };
}

const FILAS = ['la de arriba', 'la segunda desde arriba', 'la tercera desde arriba', 'la de abajo'];
const ORDINAL = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto', 'séptimo'];

/** Dónde está y cómo se reconoce un reactivo en la estantería. */
export function describirReactivo(id: ReagentId) {
  const r = reagents[id];
  const fila = shelfRows.findIndex(f => f.includes(id)), col = shelfRows[fila].indexOf(id);
  const envase = r.look.shape === 'bottle' ? (r.look.glass === 'amber' ? 'un frasco de vidrio ámbar (marrón) con tapa azul' : 'un frasco de vidrio transparente con tapa azul')
    : r.look.shape === 'jar' ? 'un tarro blanco pequeño (es un sólido)' : 'un gotero pequeño (es un indicador)';
  return { envase, lugar: `balda ${FILAS[fila]}, ${ORDINAL[col]} envase empezando por la izquierda` };
}

const ESTANTERIA = 'la estantería blanca de REACTIVOS, en la pared del fondo a la derecha de la campana';
const CAMPANA = 'la campana de extracción (la cabina blanca con ventana de vidrio en la pared del fondo)';

export function calcularGuia(partida: Partida): Guia {
  const h = useHood.getState(), lab = useLab.getState();
  const def = partida.practica;
  const mano = lab.hand, enMano = h.heldIn(mano), otra = h.heldIn(mano === 'left' ? 'right' : 'left');
  const nombreMano = mano === 'left' ? 'izquierda' : 'derecha';
  if (!def) {
    if (partida.modo === 'libre') return { objetivo: null, etiqueta: '', titulo: 'Mezcla libre', lineas: ['Coge cualquier envase de la estantería de reactivos (E).', 'En la campana: líquidos a la probeta, sólidos a la balanza, goteros directos al matraz (mantén el clic).', 'Pulsa E sobre la probeta o la balanza para pasar lo medido al matraz y mira qué ocurre.'] };
    if (!lab.ppe.goggles || !lab.ppe.gloves) {
      const gafas = !lab.ppe.goggles;
      return { objetivo: gafas ? 'ppe-goggles' : 'ppe-gloves', etiqueta: gafas ? 'Gafas · E' : 'Guantes · E', titulo: 'Empieza aquí: protégete', lineas: ['Camina con W A S D y mira moviendo el ratón.', 'Ve a la estación de PROTECCIÓN: un estante en la pared derecha, junto a la puerta, bajo el cartel azul. Sigue la flecha.', `Apunta a ${gafas ? 'las gafas de seguridad' : 'la caja de guantes'} con el punto del centro de la pantalla y pulsa E.`] };
    }
    return { objetivo: 'recipe-board', etiqueta: 'Elige una misión', titulo: 'Elige una misión', lineas: ['Camina con W A S D y mira con el ratón.', 'Ve al tablero de MISIONES: está en la pared del fondo, a la derecha del todo.', 'Apunta al tablero con el punto del centro de la pantalla y pulsa E. También puedes pulsar M desde cualquier sitio.'] };
  }
  const pasos = partida.pasos();
  const paso = pasos.find(p => !p.done);
  if (!paso) return { objetivo: 'recipe-board', etiqueta: 'Siguiente misión', titulo: 'Misión completada', lineas: ['Lávate las manos en un lavabo (pared derecha) si quieres terminar como en un laboratorio real.', 'Pulsa M para elegir otra misión o la mezcla libre.'] };
  const objetivo = paso.targets[0]?.id ?? null;
  const base = { objetivo, etiqueta: paso.targets[0]?.label ?? '', titulo: paso.title };

  if (paso.key === 'ppe') {
    const falta = !lab.ppe.goggles ? 'las gafas de seguridad (montura negra)' : 'la caja de guantes de nitrilo (caja con la tira azul)';
    return { ...base, etiqueta: !lab.ppe.goggles ? 'Gafas · E' : 'Guantes · E', lineas: ['Ve a la estación de PROTECCIÓN: un estante en la pared derecha, junto a la puerta, bajo el cartel azul.', `Apunta a ${falta} y pulsa E.`, 'Sin gafas y guantes no se puede tocar ningún reactivo.'] };
  }
  if (paso.key === 'clean') return { ...base, etiqueta: 'Residuos · E', lineas: ['El matraz tiene restos de otra mezcla.', 'Apunta al recipiente amarillo de RESIDUOS (en el suelo, al fondo a la derecha, bajo el tablero de misiones) y pulsa E.'] };
  if (objetivo?.startsWith('reagent:')) {
    const id = objetivo.slice(8) as ReagentId, r = reagents[id], d = describirReactivo(id);
    const lugar = h.places[id];
    const teclaOtra = mano === 'left' ? '2' : '1';
    if (lugar === 'left' || lugar === 'right') return { ...base, objetivo: null, etiqueta: '', lineas: [`«${r.name}» lo llevas en la otra mano.`, `Pulsa la tecla ${teclaOtra} para usar esa mano.`] };
    const donde = lugar === 'hood' ? [`«${r.name}» está en la bandeja metálica, dentro de la campana. Tiene una flecha encima.`] : [`Ve a ${ESTANTERIA}.`, `Busca «${r.name}» (${r.formula.split(' · ')[0]}): es ${d.envase}, en la ${d.lugar}. Tiene una flecha encima.`];
    if (enMano && otra) return { ...base, objetivo: 'hood-tray', etiqueta: `Deja ${reagents[enMano].name} · Q`, lineas: ['Tienes las dos manos ocupadas.', `Ve a ${CAMPANA}, apunta a la bandeja metálica de dentro y pulsa Q para dejar ${reagents[enMano].name}.`, `Después coge «${r.name}».`] };
    if (enMano) return { ...base, etiqueta: `Tecla ${teclaOtra}, luego E`, lineas: [`Tu mano ${nombreMano} ya lleva ${reagents[enMano].name}.`, `Pulsa la tecla ${teclaOtra} para cambiar a la mano libre.`, ...donde, 'Apúntalo y pulsa E para cogerlo con esa mano.'] };
    return { ...base, etiqueta: `${r.name} · E`, lineas: [...donde, 'Apúntalo con el punto del centro de la pantalla y pulsa E para cogerlo.', `Precaución: ${r.hazard}`] };
  }
  const indice = Number(paso.key.split('-')[1]);
  const add = paso.key.startsWith('add-') ? def.adds[indice] : null;
  if (add && objetivo === 'hood-washbottle') return { ...base, etiqueta: 'Piseta · E', lineas: [`La probeta tiene restos de ${reagents[h.cylinder.dirty!].name}: hay que enjuagarla antes de medir otro líquido.`, `En ${CAMPANA}, apunta a la piseta (botella blanca de plástico con pico, a la izquierda) y pulsa E.`] };
  // Si el envase que toca está en la otra mano, primero hay que cambiar de mano (1 / 2).
  const cambiar = add && enMano !== add.reagent && otra === add.reagent ? [`Primero pulsa la tecla ${mano === 'left' ? '2' : '1'}: el envase está en tu otra mano.`] : [];
  if (add && objetivo === 'hood-cylinder') {
    const medido = h.cylinder.reagent === add.reagent && h.cylinder.ml >= add.amount * 0.9;
    const medidor = { valor: h.cylinder.reagent === add.reagent ? h.cylinder.ml : 0, meta: add.amount, unidad: 'mL', decimales: 1 };
    if (medido) return { ...base, etiqueta: 'Verter al matraz · E', medidor, lineas: [`Ya tienes ${amountText(add.reagent, Math.round(h.cylinder.ml * 10) / 10)} en la probeta.`, 'Apunta a la probeta y pulsa la tecla E (no el clic) para verterla en el matraz.'] };
    return { ...base, etiqueta: `Llena hasta ${add.amount} mL`, medidor, lineas: [...cambiar, `Lleva el frasco de ${reagents[add.reagent].name} a ${CAMPANA}.`, 'Apunta a la probeta: el tubo alto y estrecho de vidrio, a la izquierda del matraz.', `Mantén pulsado el clic izquierdo y suelta cuando el medidor marque ${add.amount} mL. Si te pasas un poco no importa.`] };
  }
  if (add && objetivo === 'hood-balance') {
    const pesado = h.balance.reagent === add.reagent && h.balance.grams >= add.amount * 0.9;
    const medidor = { valor: h.balance.reagent === add.reagent ? h.balance.grams : 0, meta: add.amount, unidad: 'g', decimales: 2 };
    if (pesado) return { ...base, etiqueta: 'Añadir al matraz · E', medidor, lineas: [`Ya has pesado ${amountText(add.reagent, Math.round(h.balance.grams * 100) / 100)}.`, 'Apunta a la balanza y pulsa la tecla E para echar el sólido al matraz.'] };
    return { ...base, etiqueta: `Pesa ${String(add.amount).replace('.', ',')} g`, medidor, lineas: [...cambiar, `Lleva el tarro de ${reagents[add.reagent].name} a ${CAMPANA}.`, 'Apunta a la balanza: la caja blanca con plato metálico y pantalla verde, a la derecha del matraz.', `Mantén pulsado el clic izquierdo: la espátula va añadiendo sólido. Suelta al llegar a ${String(add.amount).replace('.', ',')} g.`] };
  }
  if (add && objetivo === 'hood') {
    const gotas = h.recipe?.added[add.reagent] ?? 0;
    return { ...base, etiqueta: `${add.amount} gotas`, medidor: { valor: gotas, meta: add.amount, unidad: 'gotas', decimales: 0 }, lineas: [...cambiar, `Lleva el gotero de ${reagents[add.reagent].name} a ${CAMPANA}.`, 'Apunta al matraz: el recipiente cónico de vidrio del centro.', `Mantén pulsado el clic izquierdo: cae una gota cada medio segundo. Suelta al llegar a ${add.amount}.`] };
  }
  if (paso.key === 'observe') return { ...base, etiqueta: 'Observa', lineas: [`Mira el matraz. Deberías ver: ${def.observe}`, 'La tarjeta de arriba explica la reacción y la pantalla verde da el pH y la temperatura.'] };
  if (paso.key === 'save') return { ...base, etiqueta: 'Anotar · E', lineas: [`Has visto la reacción: ${def.observe}`, 'Apunta al matraz y pulsa E (o pulsa N para abrir el cuaderno) y quedará anotado.'] };
  if (paso.key === 'dispose') return { ...base, etiqueta: 'Residuos · E', lineas: [def.waste, 'Apunta al recipiente amarillo de RESIDUOS (en el suelo, al fondo a la derecha, bajo el tablero de misiones) y pulsa E.', enMano ? 'Antes o después, devuelve el envase de tu mano a la estantería con Q.' : 'Nunca se tira una mezcla por el fregadero.'] };
  return { ...base, lineas: [paso.detail] };
}
