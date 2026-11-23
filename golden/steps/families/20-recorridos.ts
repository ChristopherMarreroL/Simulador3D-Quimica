import { hoodRecipes, type HoodRecipe } from '../../../src/experiments/hoodRecipes';
import { addWithTool, cerrarPanel, coger, dejar, devolverBandeja, guardar, mano, needed, receta, usar, usarResiduos } from '../lib/ops';
import type { OpSpec, StepCaseSpec, StepFamily } from '../lib/types';

/**
 * Las 16 prácticas de principio a fin por el camino correcto, como las hace el jugador: tablero, protección,
 * frascos a la bandeja, cada cantidad con su herramienta (probeta, balanza o gotero), cuaderno y residuos.
 * Ejecutar: STEPS_FAMILY=20-recorridos npm run golden:steps
 */
function recorrido(r: HoodRecipe, frameMs: number, twoHands: boolean): OpSpec[] {
  const ids = needed(r);
  const ops: OpSpec[] = [
    usar('recipe-board'),
    receta(r.id, { debe: { actual: 'ppe', objetivos: ['ppe-goggles', 'ppe-gloves'] } }),
    cerrarPanel(),
    usar('ppe-goggles', { debe: { actual: 'ppe', objetivos: ['ppe-gloves'] } }),
    usar('ppe-gloves', { debe: { actual: 'collect', objetivos: ids.map(id => `reagent:${id}`) } }),
  ];
  // Reunir: con dos manos, los frascos impares viajan en la izquierda; con una, todos en la derecha.
  ids.forEach((id, i) => {
    if (twoHands && i % 2 === 1) ops.push(mano('left'), coger(id), dejar('hood'), mano('right'));
    else ops.push(coger(id), dejar('hood'));
  });
  ops.push(usar('hood-sash', { debe: { mensaje: 'Ventana subida por completo', actual: 'add-0', hechos: ['ppe', 'collect'] } }), usar('hood-sash', { debe: { mensaje: 'altura de trabajo' } }));
  let dirty: string | null = null;
  r.adds.forEach((add, i) => {
    const step = addWithTool(add, dirty, { frameMs });
    // El clic largo se parte en dos tandas de fotogramas para capturar también el estado «a medio llenar».
    step.ops = step.ops.flatMap(op => {
      const n = op.op === 'tic' ? Number(op.args?.veces ?? 1) : 1;
      if (n < 2) return [op];
      const half = Math.floor(n / 2);
      return [{ ...op, args: { ...op.args, veces: half } }, { ...op, args: { ...op.args, veces: n - half } }];
    });
    dirty = step.dirty;
    const last = i === r.adds.length - 1;
    ops.push(coger(add.reagent), ...step.ops);
    // Con el gotero la gota ya está en el matraz al soltar; con probeta y balanza, al acabar la animación.
    ops[ops.length - 1] = { ...ops[ops.length - 1], debe: { ...ops[ops.length - 1].debe, actual: last ? 'save' : `add-${i + 1}`, hechos: [`add-${i}`] } };
    ops.push(dejar('hood'));
  });
  ops.push(
    guardar({ debe: { actual: 'dispose' } }),
    usarResiduos({ mensaje: 'Viertes la mezcla', actual: 'fin' }),
    devolverBandeja(),
  );
  return ops;
}

const family: StepFamily = () => hoodRecipes.map((r, i): StepCaseSpec => {
  // Se alternan fotogramas de 100 ms (el máximo que el jugador pasa al almacén), 50 ms y 20 ms, y una o dos manos.
  const frameMs = [100, 50, 20][i % 3], twoHands = i % 2 === 1;
  return {
    id: `recorrido/${r.id}/correcto`,
    why: `«${r.title}» completa por el camino correcto (${r.adds.map(a => a.tool).join(', ')}), con fotogramas de ${frameMs} ms y ${twoHands ? 'dos manos' : 'una mano'}.`,
    ops: recorrido(r, frameMs, twoHands),
  };
});
export default family;
