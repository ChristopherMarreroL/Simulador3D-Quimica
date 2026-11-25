import { analyzeMixture } from '../../src/chemistry/sandbox';
import { reagents, type ReagentId } from '../../src/chemistry/reagents';
import { recipeById } from '../../src/experiments/hoodRecipes';
import { amountText, recipeSteps, useHood, type Hand, type RecipeStep, type StreamTarget } from '../../src/state/hood';
import { useLab } from '../../src/state/lab';

/**
 * Partida del laboratorio: une las acciones del jugador con la capa de estado validada (src/state/hood.ts y lab.ts,
 * los 197/197 casos de golden/steps.json). Es el mismo traductor que FExpPartida en Unreal (ExpPartida.cpp):
 *  - clic: si la mano activa sostiene un frasco y el objetivo es el matraz ('hood'), la probeta ('hood-cylinder') o
 *    la balanza ('hood-balance'), empieza el chorro (startStream); si no, interact().
 *  - soltar: corta el chorro; también se corta si el objetivo deja el punto de mira.
 *  - Q: drop(). Como en src/world/Player.tsx, la tecla E siempre es interact() (así se vierte la probeta llena o el
 *    sólido pesado con el frasco aún en la mano).
 * Las misiones son las 16 prácticas de src/experiments/hoodRecipes.ts (cada una respaldada por reglas del motor) y el
 * modo libre es la misma capa sin práctica elegida. Aquí no hay química ni reglas de procedimiento propias; lo
 * ambiental (mecheros, grifos, ducha) se delega en la escena y no toca la capa de estado.
 */
type Analisis = ReturnType<typeof analyzeMixture>;
export interface Reaccion { clave: string; en: number; reactivo: string; cantidad: string; titulos: string[]; ecuaciones: string[]; nota: string; deltaT: number }

/** lab.open() suelta el puntero del ratón (la web abre un panel); en el juego la vista sigue capturada, como en Unreal. */
function sinSoltarPuntero<T>(f: () => T): T {
  const original = document.exitPointerLock;
  document.exitPointerLock = () => {};
  try { return f(); } finally { document.exitPointerLock = original; }
}

export class Partida {
  private chorro = false;
  private chorroDesde = '';
  private reglas = new Set<string>();
  ultimo: Analisis | null = null;
  /** 'ninguno' hasta que se elige en el tablero una misión o la mezcla libre. */
  modo: 'ninguno' | 'mision' | 'libre' = 'ninguno';
  reaccion: Reaccion | null = null;
  completadas = new Set<string>();
  /** Interacciones ambientales de la escena (devuelve el mensaje) y apertura del panel de misiones. */
  ambiente: (objetivo: string) => string | null = () => null;
  alAbrirMisiones: () => void = () => {};
  alAbrirTabla: () => void = () => {};

  iniciar() {
    // start() manda al tutorial si no se ha hecho; las mesas del tutorial no están en este laboratorio.
    useLab.setState({ tutorialDone: true });
    sinSoltarPuntero(() => useLab.getState().start('guided'));
    this.chorro = false; this.chorroDesde = ''; this.reglas.clear(); this.ultimo = null; this.modo = 'ninguno'; this.reaccion = null;
    useLab.setState({ message: 'Bienvenido. Ponte gafas y guantes junto a la puerta y elige una misión en el tablero del fondo (o pulsa M).' });
  }

  /** Elige una misión (id de hoodRecipes) o la mezcla libre (null). */
  elegir(id: string | null) {
    useHood.getState().selectRecipe(id);
    this.reglas.clear();
    this.modo = id ? 'mision' : 'libre';
    const def = recipeById(id);
    useLab.setState({ message: def ? `Misión: ${def.title}. Sigue los pasos del panel.` : 'Mezcla libre: lleva frascos a la campana y combina lo que quieras. El modelo te dirá qué ocurre.' });
  }

  get objetivo() { return useLab.getState().target; }
  get mano(): Hand { return useLab.getState().hand; }
  get vertiendo() { return this.chorro; }

  apuntar(id: string | null) { if (useLab.getState().target !== id) useLab.getState().setTarget(id); }

  pulsarUsar(soloInteractuar = false) {
    const lab = useLab.getState(), hood = useHood.getState();
    const t = lab.target;
    if (t === 'recipe-board') { this.alAbrirMisiones(); return; }
    if (t === 'amb:tabla') { this.alAbrirTabla(); return; }
    if (t?.startsWith('amb:')) { const m = this.ambiente(t); if (m) useLab.setState({ message: m }); return; }
    const sostenido = hood.heldIn(lab.hand);
    const destino: StreamTarget | null = t === 'hood' ? 'flask' : t === 'hood-cylinder' ? 'cylinder' : t === 'hood-balance' ? 'balance' : null;
    if (!soloInteractuar && sostenido && destino) {
      this.chorroDesde = t!;
      if (hood.startStream(sostenido, destino)) this.chorro = true;
      else if (useHood.getState().error) useLab.setState({ message: useHood.getState().error });
      return;
    }
    sinSoltarPuntero(() => useLab.getState().interact());
    if (useLab.getState().panel === 'hood') {
      // La web abre aquí el panel de la campana, cuyo botón «Guardar en el cuaderno» llama a save().
      sinSoltarPuntero(() => useLab.getState().open(null));
      this.anotar();
    }
    this.observar();
  }

  soltarUsar() {
    if (!this.chorro) return;
    this.chorro = false;
    useHood.getState().stopStream();
    this.observar();
  }

  dejar() { this.soltarUsar(); useLab.getState().drop(); }
  cambiarMano(mano: Hand) { this.soltarUsar(); useLab.getState().selectHand(mano); }

  anotar() {
    const hood = useHood.getState();
    if (!hood.mixture.additions.length) { useLab.setState({ message: 'El matraz está vacío. Con un frasco en la mano, mantén el clic sobre la probeta (líquidos), la balanza (sólidos) o el matraz (indicadores).' }); return; }
    hood.save();
    useLab.setState({ message: 'Observación guardada en el cuaderno.' });
  }

  avanzar(segundos: number) {
    if (segundos <= 0) return;
    if (this.chorro) {
      // Como Player.tsx: el chorro sigue solo mientras el destino siga en el punto de mira.
      if (useLab.getState().target !== this.chorroDesde || !useHood.getState().pouring) this.soltarUsar();
      else useHood.getState().streamTick(Math.min(segundos, 0.1));
    }
    this.observar();
    const id = useHood.getState().recipe?.id;
    if (id && this.completa()) this.completadas.add(id);
  }

  private observar() {
    const h = useHood.getState();
    if (h.mixture.additions.length) this.ultimo = analyzeMixture(h.mixture);
    for (const entrada of h.log) for (const e of entrada.events) this.reglas.add(e.rule);
    const u = h.log.at(-1);
    if (u) {
      const clave = `${u.id}:${u.events.length}`;
      if (this.reaccion?.clave !== clave && !h.pouring?.stream) {
        this.reaccion = { clave, en: performance.now(), reactivo: reagents[u.reagent].name, cantidad: amountText(u.reagent, Math.round(u.amount * 100) / 100),
          titulos: u.events.map(e => e.title), ecuaciones: u.events.map(e => e.equation), nota: u.events.length ? u.events[0].note : u.note, deltaT: u.deltaT };
      }
    }
  }

  pasos(): RecipeStep[] {
    const h = useHood.getState();
    const def = recipeById(h.recipe?.id);
    return def && h.recipe ? recipeSteps(def, h.recipe, h, useLab.getState().ppe) : [];
  }
  completa() { const p = this.pasos(); return p.length > 0 && p.every(x => x.done); }
  get practica() { return recipeById(useHood.getState().recipe?.id); }
  get reglasDisparadas() { return [...this.reglas]; }
  /** Gramos y nombre del último precipitado observado (sirve para el resultado después de desechar). */
  get precipitado() { const s = this.ultimo?.solids[0]; return s ? { gramos: s.grams, nombre: s.label } : null; }
  /** Cantidades vertidas en el matraz en esta práctica, por reactivo. */
  get anadido() { const a = useHood.getState().recipe?.added ?? {}; return Object.entries(a).map(([id, v]) => ({ nombre: reagents[id as ReagentId].name, texto: amountText(id as ReagentId, Math.round((v as number) * 100) / 100) })); }
}
