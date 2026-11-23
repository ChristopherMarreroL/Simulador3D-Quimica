import * as THREE from 'three';
import { reagents, type ReagentId } from '../../src/chemistry/reagents';
import { hoodRecipes, recipeById } from '../../src/experiments/hoodRecipes';
import { useHood } from '../../src/state/hood';
import { useLab } from '../../src/state/lab';
import type { Jugador } from './jugador';
import type { Objetos } from './objetos';
import type { Partida } from './partida';

/**
 * Recorrido automático (?recorrido=<id>[,<id>…] o ?recorrido=todas), como -ExpRecorrido en Unreal: el jugador se
 * coloca, mira cada objetivo y la puntería real (rayo + oclusión) tiene que encontrarlo antes de pulsar. Juega las
 * misiones pedidas con la herramienta de cada paso (probeta, balanza o gotero), prueba lo ambiental (mechero, grifo,
 * ducha) y al final mide los FPS 20 s en una vista general. Deja el resultado en window.__campana.recorrido.
 */
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function recorrido(partida: Partida, jugador: Jugador, objetos: Objetos, objetivo: () => string | null, fps: { tiempos: number[] }, cuales: string) {
  const registro: string[] = [];
  const inicio = performance.now();
  const ganchos = (window as unknown as { __campana: Record<string, unknown> }).__campana;
  /** Pausa breve con nombre para que la prueba de navegador haga su captura. */
  const hito = async (nombre: string, vista?: [number, number, number, number, number]) => {
    if (vista) { jugador.colocar(vista[0], vista[1]); jugador.mirarA(new THREE.Vector3(vista[2], vista[3], vista[4])); }
    ganchos.hito = nombre; await esperar(1600);
  };
  /** Colocarse frente al objetivo (a un brazo de distancia del mueble) y esperar a que la puntería lo encuentre. */
  const ir = async (id: string, vale: (o: string | null) => boolean = o => o === id) => {
    const c = objetos.centro(id);
    if (!c) throw new Error('Sin objetivo ' + id);
    // Fondo (estación, estantería, tablero, residuos): de frente; protección: desde el pasillo de la puerta.
    if (id.startsWith('ppe-')) jugador.colocar(5.0, c.z);
    else if (id === 'hood-waste') jugador.colocar(4.8, 1.02);
    else if (id.startsWith('amb:grifo')) jugador.colocar(4.7, c.z);
    else if (id.startsWith('amb:mechero')) { const centro = c.z < 4.75 ? 3.3 : 6.2; jugador.colocar(c.x + 0.3, c.z + Math.sign(c.z - centro) * 1.0); }   // del lado del mechero: la repisa central tapa el otro
    else if (id === 'amb:ducha') jugador.colocar(-5.0, 1.2);
    else jugador.colocar(THREE.MathUtils.clamp(c.x, -4.2, 5.4), c.z < 0.5 ? 0.98 : c.z + 1);
    jugador.mirarA(c);
    for (let i = 0; i < 30 && !vale(objetivo()); i++) await esperar(50);
    if (!vale(objetivo())) throw new Error(`La puntería no encuentra ${id}; apunta a ${objetivo()}`);
  };
  const usar = async (id: string) => { await ir(id); partida.pulsarUsar(true); registro.push(`${id}: ${useLab.getState().message}`); await esperar(120); };
  const libre = async () => { await esperar(80); while (useHood.getState().transfer) await esperar(40); await esperar(150); };
  const mantener = async (id: string, hasta: () => boolean) => {
    await ir(id);
    partida.pulsarUsar();
    if (!partida.vertiendo) throw new Error(`No empieza a verter sobre ${id}: ${useLab.getState().message}`);
    while (!hasta() && useHood.getState().pouring) await esperar(16);
    partida.soltarUsar();
  };
  const devolver = async () => {
    await ir('reagent-shelf', o => o === 'reagent-shelf' || (!!o && o.startsWith('reagent:')));
    partida.dejar();
  };

  const mision = async (id: string, conHitos: boolean) => {
    const def = recipeById(id);
    if (!def) throw new Error('Misión desconocida ' + id);
    await ir('recipe-board'); partida.pulsarUsar(true); await esperar(250);
    const boton = document.querySelector<HTMLElement>(`[data-mision="${id}"]`);
    if (!boton) throw new Error('El tablero no lista ' + id);
    if (conHitos) await hito('02_tablero_misiones');
    boton.click(); await esperar(150);
    if (useHood.getState().recipe?.cleanNeeded) { await usar('hood-waste'); await libre(); }
    for (const [i, add] of def.adds.entries()) {
      const h = () => useHood.getState();
      if (h().heldIn('right') !== add.reagent) {
        if (h().heldIn('right')) await devolver();
        await usar(`reagent:${add.reagent}`);
      }
      if (add.tool === 'probeta') {
        if (h().cylinder.dirty && h().cylinder.dirty !== add.reagent) { await usar('hood-washbottle'); await libre(); }
        if (conHitos && i === 0) await hito('03_frasco_en_mano', [-0.2, 1.05, -0.5, 1.0, 0.1]);
        await mantener('hood-cylinder', () => h().cylinder.ml >= add.amount);
        await ir('hood-cylinder'); partida.pulsarUsar(true);
        if (conHitos && i === 0) { await esperar(800); ganchos.hito = '04_vertiendo_probeta'; }
        await libre();
      } else if (add.tool === 'balanza') {
        await mantener('hood-balance', () => h().balance.grams >= add.amount);
        if (conHitos) await hito('05_balanza', [-0.1, 0.95, -0.1, 0.98, 0.14]);
        await ir('hood-balance'); partida.pulsarUsar(true); await libre();
      } else {
        const antes = h().recipe?.added[add.reagent] ?? 0;
        await mantener('hood', () => (h().recipe?.added[add.reagent] ?? 0) - antes >= add.amount);
      }
      registro.push(`${id} · ${reagents[add.reagent].name}: ${(h().recipe?.added[add.reagent] ?? 0).toFixed(2)}`);
    }
    if (useHood.getState().heldIn('right')) await devolver();
    if (conHitos) await hito('06_reaccion', [-0.25, 0.9, -0.38, 1.12, 0.06]);
    await usar('hood');
    if (conHitos) { await esperar(6000); await hito('07_reposo', [-0.25, 0.9, -0.38, 1.12, 0.06]); }
    const analisis = partida.ultimo;
    await usar('hood-waste'); await libre();
    const esperadas = def.expect.every(r => partida.reglasDisparadas.includes(r));
    return { id, completa: partida.completa(), reglas: partida.reglasDisparadas, esperadas, anadido: partida.anadido,
      pH: analisis?.pH ?? null, temperaturaC: analisis?.temperatureC ?? null, solidos: analisis?.solids.map(s => `${s.label} ${s.grams.toFixed(4)} g`) ?? [], gases: analisis?.gases.map(g => `${g.label} ${(g.litres * 1000).toFixed(0)} mL`) ?? [] };
  };

  try {
    await esperar(800);
    await hito('01_entrada');
    await usar('ppe-goggles'); await usar('ppe-gloves');
    const ids = cuales === 'todas' ? hoodRecipes.map(r => r.id) : cuales.split(',');
    const misiones = [];
    for (const [i, id] of ids.entries()) misiones.push(await mision(id, i === 0));
    // Mezcla libre: una combinación sin misión y otra sin regla en el modelo.
    document.querySelector<HTMLElement>('[data-mision="libre"]') ?? (await ir('recipe-board'), partida.pulsarUsar(true), await esperar(200));
    document.querySelector<HTMLElement>('[data-mision="libre"]')!.click(); await esperar(150);
    const verter = async (reactivo: ReagentId, ml: number) => {
      await usar(`reagent:${reactivo}`);
      if (useHood.getState().cylinder.dirty && useHood.getState().cylinder.dirty !== reactivo) { await usar('hood-washbottle'); await libre(); }
      await mantener('hood-cylinder', () => useHood.getState().cylinder.ml >= ml);
      await ir('hood-cylinder'); partida.pulsarUsar(true); await libre(); await devolver();
    };
    await verter('cuso4', 20); await verter('naoh', 20);
    await hito('08_mezcla_libre', [-0.25, 0.9, -0.38, 1.12, 0.06]);
    const libreResultado = { modo: partida.modo, reglas: partida.reglasDisparadas, solidos: partida.ultimo?.solids.map(s => `${s.label} ${s.grams.toFixed(4)} g`) ?? [], reaccion: partida.reaccion?.titulos ?? [] };
    await usar('hood-waste'); await libre();
    // Ambiente: mechero, grifo y ducha de emergencia.
    await usar('amb:mechero:1'); await hito('09_mechero', [-1.5, 4.7, -2.14, 1.05, 3.52]);
    await usar('amb:grifo:0'); await hito('10_lavabo', [4.3, 2.9, 5.6, 1.0, 2.0]);
    await usar('amb:ducha'); await hito('11_ducha', [-3.6, 2.2, -5.25, 1.25, 0.1]);
    const resultado = { completa: misiones.every(m => m.completa && m.esperadas), segundos: (performance.now() - inicio) / 1000, misiones, libre: libreResultado, registro, fps: 0, p95ms: 0 };
    await hito('12_vista_general', [5.2, 8.0, -1.5, 1.0, 1.5]);
    await hito('13_desde_ventanas', [-5.2, 7.9, 2.0, 1.1, 1.0]);
    // Medición en la vista más cargada: todo el laboratorio desde la puerta.
    jugador.colocar(5.2, 8.0); jugador.mirarA(new THREE.Vector3(-1.5, 1.0, 1.5));
    await esperar(3000);
    fps.tiempos.length = 0;
    await esperar(20000);
    const t = [...fps.tiempos].sort((a, b) => a - b);
    resultado.fps = 1000 / (t.reduce((s, x) => s + x, 0) / t.length);
    resultado.p95ms = t[Math.floor(t.length * 0.95)];
    ganchos.recorrido = resultado;
    console.log('RECORRIDO_OK', JSON.stringify(resultado));
  } catch (e) {
    ganchos.recorrido = { error: (e as Error).message, registro };
    console.error('RECORRIDO_ERROR', (e as Error).message, registro);
  }
}
