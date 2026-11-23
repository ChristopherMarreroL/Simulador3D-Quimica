import { hoodRecipes, type HoodRecipe, type RecipeAdd } from '../../../src/experiments/hoodRecipes';
import {
  aBandeja, addAll, addWithTool, chorro, coger, con, dejar, devolverBandeja, guardar, needed, protegerse, receta, usar, usarResiduos, ventana, verter,
} from '../lib/ops';
import type { OpSpec, StepCaseSpec, StepFamily } from '../lib/types';

/**
 * Las 16 prácticas con los errores habituales del jugador: cuatro variantes por práctica.
 * Ejecutar: STEPS_FAMILY=40-errores npm run golden:steps   (STEPS_CASE=<texto> filtra lo que imprime)
 */
const target = { probeta: 'cylinder', balanza: 'balance', gotero: 'flask' } as const;
const falla = (error: string) => ({ debe: { devuelve: false, error } });
const allAdds = (r: HoodRecipe) => r.adds.map((_, i) => `add-${i}`);

/** Lo que el almacén contesta si se usa la herramienta equivocada para este reactivo. */
function wrongTools(add: RecipeAdd, dirty: string | null): OpSpec[] {
  if (add.tool === 'probeta') return [
    chorro(add.reagent, 'flask', falla('Mide primero')), chorro(add.reagent, 'balance', falla('En la balanza solo se pesan sólidos.')),
    ...(dirty && dirty !== add.reagent ? [chorro(add.reagent, 'cylinder', falla('Enjuágala con la piseta antes de medir otro reactivo.'))] : []),
  ];
  if (add.tool === 'balanza') return [chorro(add.reagent, 'cylinder', falla('Los sólidos se pesan en la balanza.')), chorro(add.reagent, 'flask', falla('Pesa primero'))];
  return [chorro(add.reagent, 'cylinder', falla('Los indicadores se añaden gota a gota directamente al matraz.')), chorro(add.reagent, 'balance', falla('En la balanza solo se pesan sólidos.'))];
}

const family: StepFamily = ctx => {
  const cases: StepCaseSpec[] = [];
  const add = (name: string, why: string, ops: OpSpec[]) => cases.push({ id: `errores/${name}`, why, ops });

  hoodRecipes.forEach((r, index) => {
    const t = `«${r.title}»`, ids = needed(r);

    // a) Sin protección, con la ventana cerrada y con el mínimo que la guía acepta (90 % exacto).
    add(`${r.id}/sin-proteccion-ventana-cerrada-minimo`, `${t}: intento de coger un frasco sin protección, cada herramienta con la ventana cerrada y, ya abierta, el 90 % exacto de cada cantidad.`, [
      receta(r.id),
      coger(r.adds[0].reagent, { debe: { mensaje: 'Antes de tocar reactivos ponte las gafas y los guantes', actual: 'ppe' } }),
      ...protegerse(), ...aBandeja(...ids), ventana('closed'),
      ...r.adds.flatMap(a => [coger(a.reagent), chorro(a.reagent, target[a.tool], falla('La ventana está cerrada. Súbela a la altura de trabajo para trabajar dentro.')), dejar('hood')]),
      usar('hood-sash', { debe: { mensaje: 'Ventana subida por completo', actual: 'add-0' } }),
      ...con(addAll(r, { factor: 0.9, exact: true }), { hechos: allAdds(r) }),
      guardar(), usarResiduos(), devolverBandeja(),
    ]);

    // b) Herramienta equivocada, probeta sin enjuagar y cantidades de más.
    {
      let dirty: string | null = null;
      const body = r.adds.flatMap((a, i) => {
        const tries = wrongTools(a, dirty);
        const step = addWithTool(a, dirty, { factor: ctx.int(110, 150) / 100, frameMs: 50 });
        dirty = step.dirty;
        return [coger(a.reagent), ...tries, ...con(step.ops, { paso: { clave: `add-${i}`, hecho: true } }), dejar('hood')];
      });
      add(`${r.id}/herramienta-equivocada-sin-enjuagar-exceso`, `${t}: cada reactivo se intenta primero con la herramienta que no es y con la probeta sin enjuagar, y luego se añade entre un 110 % y un 150 %.`, [
        ...protegerse(), receta(r.id), ...aBandeja(...ids),
        ...con(body, { actual: 'save', hechos: allAdds(r) }),
        guardar({ debe: { actual: 'dispose' } }), usarResiduos({ actual: 'fin' }),
      ]);
    }

    // c) Desechar tras el primer reactivo, seguir, y tener que volver a elegir la práctica.
    {
      const first = addWithTool(r.adds[0], null, { exact: true });
      let dirty = first.dirty;
      const rest = r.adds.slice(1).flatMap(a => { const step = addWithTool(a, dirty, { exact: true }); dirty = step.dirty; return [coger(a.reagent), ...step.ops, dejar('hood')]; });
      add(`${r.id}/desechar-a-medias`, `${t}: se desecha tras el primer reactivo (el paso sigue hecho con el matraz vacío), se añade el resto, y se vuelve a elegir la práctica para repetirla entera.`, [
        ...protegerse(), receta(r.id), ...aBandeja(...ids),
        coger(r.adds[0].reagent), ...first.ops, dejar('hood'),
        usarResiduos({ mensaje: 'Viertes la mezcla', hechos: ['add-0'], pendientes: ['dispose'] }),
        ...con(rest, { hechos: allAdds(r), pendientes: ['dispose'] }),
        receta(r.id, { debe: { actual: 'clean', objetivos: ['hood-waste'] } }),
        usarResiduos({ actual: 'add-0' }),
        ...con(addAll(r, { exact: true, dirty }), { actual: 'save' }),
        guardar({ debe: { actual: 'dispose' } }), usarResiduos({ actual: 'fin' }),
      ]);
    }

    // d) Elegirla con el matraz todavía sucio de la práctica anterior de la lista.
    {
      const prev = hoodRecipes[(index + hoodRecipes.length - 1) % hoodRecipes.length];
      add(`${r.id}/tras-otra-practica-sin-desechar`, `${t} elegida con la mezcla de «${prev.title}» aún en el matraz (hecha con vertidos directos): aparece «clean», desechar no cuenta para la nueva y luego se completa con fotogramas de 50 ms.`, [
        ...protegerse(), receta(prev.id), ...aBandeja(...needed(prev)),
        ...con(prev.adds.map(a => verter(a.reagent, a.amount)), { actual: 'save' }),
        receta(r.id, { debe: { actual: 'clean', objetivos: ['hood-waste'], pendientes: ['observe', 'save', 'dispose'] } }),
        usarResiduos({ mensaje: 'Viertes la mezcla', pendientes: ['dispose', 'save'] }),
        devolverBandeja(),
        ...con(aBandeja(...ids), { actual: 'add-0' }),
        ...con(addAll(r, { frameMs: 50 }), { actual: 'save' }),
        guardar({ debe: { actual: 'dispose' } }), usarResiduos({ actual: 'fin' }), devolverBandeja(),
      ]);
    }
  });
  return cases;
};
export default family;
