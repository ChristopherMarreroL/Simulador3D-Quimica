import { hoodRecipes, type RecipeAdd } from '../../../src/experiments/hoodRecipes';
import {
  aBandeja, coger, con, dejar, gotas, llenarProbetaExacto, needed, pesarExacto, protegerse, receta, usarBalanza, usarPiseta, usarProbeta,
} from '../lib/ops';
import type { OpSpec, StepCaseSpec, StepFamily } from '../lib/types';

/**
 * Bordes numéricos del 90 % en las 16 prácticas. La guía da un paso por hecho con `añadido >= cantidad * 0.9`
 * y manda verter con `medido >= cantidad * 0.9`, en coma flotante. Aquí cada herramienta se deja en el
 * umbral exacto (el mismo double que calcula el almacén) o una división de la herramienta por debajo
 * (0,1 mL; 0,01 g; una gota).
 * Ejecutar: STEPS_FAMILY=50-bordes npm run golden:steps   (STEPS_CASE=<texto> filtra lo que imprime)
 */
const threshold = (a: RecipeAdd) => a.amount * 0.9;
const below = (a: RecipeAdd) => a.tool === 'probeta' ? Math.round((threshold(a) - 0.1) * 10) / 10 : a.tool === 'balanza' ? Math.round((threshold(a) - 0.01) * 100) / 100 : Math.ceil(threshold(a)) - 1;

const family: StepFamily = () => {
  const cases: StepCaseSpec[] = [];
  for (const r of hoodRecipes) {
    for (const exact of [false, true]) {
      let dirty: string | null = null;
      const body = r.adds.flatMap((a, i): OpSpec[] => {
        const clave = `add-${i}`;
        const amount = exact ? (a.tool === 'gotero' ? Math.ceil(threshold(a)) : threshold(a)) : below(a);
        if (a.tool === 'gotero') return [coger(a.reagent), ...con(gotas(a.reagent, amount), { paso: { clave, hecho: exact } }), dejar('hood')];
        if (a.tool === 'balanza') return [
          coger(a.reagent),
          ...con(pesarExacto(a.reagent, amount), { paso: { clave, hecho: false, etiqueta: exact ? 'E · Añadir al matraz' : 'Pesa ' } }),
          usarBalanza({ mensaje: 'Añades el sólido', paso: { clave, hecho: exact } }), dejar('hood'),
        ];
        const rinse = dirty && dirty !== a.reagent ? [usarPiseta()] : [];
        dirty = a.reagent;
        return [
          coger(a.reagent), ...rinse,
          ...con(llenarProbetaExacto(a.reagent, amount), { paso: { clave, hecho: false, etiqueta: exact ? 'E · Verter en el matraz' : 'Llena hasta ' } }),
          usarProbeta({ mensaje: 'Viertes', paso: { clave, hecho: exact } }), dejar('hood'),
        ];
      });
      const amounts = r.adds.map(a => exact ? (a.tool === 'gotero' ? Math.ceil(threshold(a)) : threshold(a)) : below(a)).join(' / ');
      cases.push({
        id: `bordes/${r.id}/${exact ? 'justo-el-90' : 'una-division-menos'}`,
        why: exact
          ? `«${r.title}» con cada herramienta en el umbral exacto del 90 % (${amounts}): la guía manda verter o añadir.`
          : `«${r.title}» una división por debajo del 90 % en cada herramienta (${amounts}): la guía sigue pidiendo llenar o pesar y ningún paso «add» queda hecho.`,
        ops: [...protegerse(), receta(r.id), ...aBandeja(...needed(r)), ...body],
      });
    }
  }
  return cases;
};
export default family;
