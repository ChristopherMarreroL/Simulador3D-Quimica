import { expect, it } from 'vitest';
import { addReagent, emptyMixture } from '../chemistry/sandbox';
import { amountRange, reagents } from '../chemistry/reagents';
import { hoodRecipes } from './hoodRecipes';

it('cada experimento guiado produce las reacciones que promete con el modelo químico', () => {
  expect(hoodRecipes.length).toBeGreaterThanOrEqual(15);
  for (const recipe of hoodRecipes) {
    let mix = emptyMixture(); const fired = new Set<string>();
    for (const step of recipe.adds) {
      const range = amountRange(reagents[step.reagent]);
      expect(step.amount, `${recipe.id}/${step.reagent}`).toBeGreaterThanOrEqual(range.min);
      expect(step.amount).toBeLessThanOrEqual(range.max);
      const kind = reagents[step.reagent].kind;
      expect(step.tool, `${recipe.id}: herramienta de ${step.reagent}`).toBe(kind === 'solid' ? 'balanza' : kind === 'indicator' ? 'gotero' : 'probeta');
      if (step.tool === 'probeta') expect(step.amount).toBeLessThanOrEqual(100); // fits the 100 mL cylinder
      const out = addReagent(mix, step.reagent, step.amount); mix = out.mixture;
      out.events.forEach(e => fired.add(e.rule));
    }
    for (const rule of recipe.expect) expect(fired, `${recipe.id} debe activar ${rule}`).toContain(rule);
  }
});
