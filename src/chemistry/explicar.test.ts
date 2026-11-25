import { describe, expect, it } from 'vitest';
import { reagentIds, reagents } from './reagents';
import { rules } from './sandbox';
import { species, speciesIds } from './species';
import { hoodRecipes } from '../experiments/hoodRecipes';
import { explicar, explicarRegla, mezclaDeConsulta, parejasQueReaccionan, PRODUCTOS, SUSTANCIAS } from '../../web-campana/src/explicar';

/** El cuaderno del laboratorio web debe poder explicar todo lo que el modelo puede calcular. */
describe('explicaciones del cuaderno', () => {
  it('cada sustancia de la estantería tiene su ficha', () => {
    for (const id of reagentIds) { const f = SUSTANCIAS[id]; expect(f, id).toBeTruthy(); expect(f.queEs.length, id).toBeGreaterThan(10); expect(f.sirve.length, id).toBeGreaterThan(10); expect(f.riesgo.length, id).toBeGreaterThan(5); }
  });
  it('cada regla del modelo tiene texto propio en los dos sentidos', () => {
    for (const r of rules) {
      const tipos = r.type === 'complete' ? [r.kind] : ['precipitado', 'disolución'] as const;
      for (const kind of tipos) {
        const solido = r.type === 'complete' ? Object.keys(r.products).find(id => species[id as keyof typeof species].phase === 's' && !(id in r.reactants)) : r.solid;
        const p = explicarRegla({ rule: r.id, kind, title: 'SIN TEXTO', solid: solido ? { id: solido as never, mol: 1 } : undefined });
        expect(p.titulo, r.id).not.toContain('SIN TEXTO'); expect(p.paso, r.id).not.toContain('SIN TEXTO'); expect(p.sirve.length, r.id).toBeGreaterThan(10);
        expect(p.paso, r.id).not.toMatch(/undefined|otro metal/);
      }
    }
  });
  it('cada gas y cada sólido que puede aparecer tiene su nota', () => {
    const reactivos = new Set(reagentIds.map(id => { const r = reagents[id]; return r.kind === 'solid' ? r.species : ''; }));
    for (const id of speciesIds) if ((species[id].phase === 'g' || species[id].phase === 's') && !['CaCl2(s)', 'NH4NO3(s)', 'NaHCO3(s)'].includes(id)) expect(PRODUCTOS[id], id).toBeTruthy();
    expect(reactivos.size).toBeGreaterThan(0);
  });
  it('explica las 16 misiones y las reconoce', () => {
    for (const m of hoodRecipes) {
      const e = explicar(m.adds.map(a => ({ reagent: a.reagent, amount: a.amount })));
      expect(e.mision, m.id).toBe(m.id); expect(e.quePaso.length, m.id).toBeGreaterThan(0); expect(e.sirve.length, m.id).toBeGreaterThan(0);
      expect(e.desecho, m.id).toContain(m.waste); expect(e.sustancias.length, m.id).toBe(new Set(m.adds.map(a => a.reagent)).size);
    }
  });
  it('explica todas las parejas y tríos sin fallar ni dejar huecos', () => {
    let n = 0;
    const comprobar = (ids: typeof reagentIds) => {
      const e = explicar(mezclaDeConsulta(ids)); n++;
      const texto = JSON.stringify(e);
      expect(texto, ids.join('+')).not.toMatch(/undefined|NaN|SIN TEXTO/);
      expect(e.titulo.length, ids.join('+')).toBeGreaterThan(3); expect(e.quePaso.length, ids.join('+')).toBeGreaterThan(0);
      expect(e.peligro.length).toBeGreaterThan(0); expect(e.problema.length).toBeGreaterThan(5); expect(e.desecho.length).toBeGreaterThan(5); expect(e.sirve.length).toBeGreaterThan(0);
    };
    for (let i = 0; i < reagentIds.length; i++) { comprobar([reagentIds[i]]); for (let j = i + 1; j < reagentIds.length; j++) { comprobar([reagentIds[i], reagentIds[j]]); for (let k = j + 1; k < reagentIds.length; k++) comprobar([reagentIds[i], reagentIds[j], reagentIds[k]]); } }
    expect(n).toBe(27 + 351 + 2925);
  }, 600000);
  it('casos conocidos', () => {
    const plomo = explicar([{ reagent: 'pbno3', amount: 20 }, { reagent: 'ki', amount: 10 }]);
    expect(plomo.nivel).toBe('alto'); expect(plomo.problema).toContain('plomo'); expect(plomo.desecho).toMatch(/nunca al fregadero/i);
    const sal = explicar([{ reagent: 'nacl', amount: 20 }, { reagent: 'water', amount: 20 }]);
    expect(sal.nivel).toBe('bajo'); expect(sal.titulo).toBe('Una sola sustancia');
    const nada = explicar([{ reagent: 'nacl', amount: 20 }, { reagent: 'ki', amount: 20 }]);
    expect(nada.titulo).toBe('No reaccionan');
    const mg = explicar([{ reagent: 'hcl', amount: 50 }, { reagent: 'mg', amount: 0.5 }]);
    expect(mg.productos.map(p => p.nombre)).toContain('hidrógeno'); expect(mg.nivel).not.toBe('bajo');
    const p = parejasQueReaccionan();
    expect(p.get('agno3')).toContain('nacl'); expect(p.get('nacl')).not.toContain('ki'); expect(p.get('cu')).toContain('agno3'); expect(p.get('cu')).not.toContain('hcl');
  });
});
