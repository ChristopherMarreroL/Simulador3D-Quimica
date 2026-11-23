import { reagents, type ReagentId } from '../../src/chemistry/reagents';
import { hoodRecipes } from '../../src/experiments/hoodRecipes';
import { amountText, useHood, type Hand } from '../../src/state/hood';
import { useLab } from '../../src/state/lab';
import { NOMBRES } from './objetos';
import type { Guia } from './guia';
import type { Partida } from './partida';
import { PERFILES, type Calidad } from './util';

/** Interfaz en español: misión y pasos, aviso contextual, manos, mensaje, reacción, resultado, tablero de misiones y pausa. */
const fmt = (v: number, d = 1) => v.toLocaleString('es', { maximumFractionDigits: d, minimumFractionDigits: d });
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export class Hud {
  private raiz: HTMLElement;
  private el: Record<string, HTMLElement> = {};
  private ultimo = '';
  private ultimaReaccion = '';
  private misionesAbierto = false;
  constructor(raiz: HTMLElement, calidad: Calidad, private acciones: { empezar: () => void; calidad: (c: Calidad) => void; reiniciar: () => void; elegir: (id: string | null) => void }) {
    this.raiz = raiz;
    raiz.innerHTML = `
      <div class="mira" data-k="mira"></div>
      <div class="aviso" data-k="aviso"></div>
      <section class="tarea" data-k="tarea"></section>
      <div class="reaccion" data-k="reaccion" hidden></div>
      <section class="pista" data-k="pista"></section>
      <div class="senal" data-k="senal" hidden><i data-k="senalFlecha">▼</i><b data-k="senalTexto"></b></div>
      <div class="medidor" data-k="medidor" hidden></div>
      <div class="mensaje" data-k="mensaje"></div>
      <div class="manos" data-k="manos"></div>
      <div class="pantalla-matraz" data-k="matraz"></div>
      <section class="resultado" data-k="resultado" hidden></section>
      <div class="cargando" data-k="cargando"><div class="marca">Experimenta 3D</div><div data-k="progreso">Preparando el laboratorio…</div></div>
      <section class="portada" data-k="portada" hidden>
        <h1>Experimenta 3D</h1><p class="sub">Laboratorio virtual de química</p>
        <p>16 misiones guiadas y mezcla libre con 27 reactivos</p>
        <button data-k="empezar" class="boton">Entrar al laboratorio</button>
        <ul class="controles">
          <li><b>WASD</b> caminar · <b>Mayús</b> rápido · <b>ratón</b> mirar</li>
          <li><b>E</b> o <b>clic</b> usar · <b>mantener el clic</b> para verter de un frasco · <b>Q</b> dejar</li>
          <li><b>1 / 2</b> mano izquierda / derecha · <b>M</b> misiones · <b>H</b> pistas · <b>N</b> anotar · <b>clic derecho</b> mirar de cerca</li>
          <li><b>Esc</b> pausa</li>
        </ul>
      </section>
      <section class="misiones" data-k="misiones" hidden>
        <header><h2>Tablero de misiones</h2><button data-k="cerrarMisiones" class="boton secundario">Volver al laboratorio</button></header>
        <div class="lista" data-k="listaMisiones"></div>
      </section>
      <section class="pausa" data-k="pausa" hidden>
        <h2>Pausa</h2>
        <button data-k="continuar" class="boton">Continuar</button>
        <button data-k="verMisiones" class="boton secundario">Misiones y mezcla libre</button>
        <label>Calidad gráfica
          <select data-k="calidad">${(Object.keys(PERFILES) as Calidad[]).map(c => `<option value="${c}" ${c === calidad ? 'selected' : ''}>${PERFILES[c].texto}</option>`).join('')}</select>
        </label>
        <button data-k="reiniciar" class="boton secundario">Reiniciar el laboratorio</button>
        <p class="fps" data-k="fps"></p>
      </section>`;
    raiz.querySelectorAll<HTMLElement>('[data-k]').forEach(e => { this.el[e.dataset.k!] = e; });
    this.el.empezar.addEventListener('click', acciones.empezar);
    this.el.continuar.addEventListener('click', acciones.empezar);
    this.el.reiniciar.addEventListener('click', () => { acciones.reiniciar(); acciones.empezar(); });
    this.el.verMisiones.addEventListener('click', () => this.abrirMisiones());
    this.el.cerrarMisiones.addEventListener('click', () => { this.misionesAbierto = false; acciones.empezar(); });
    this.el.listaMisiones.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-mision]');
      if (!b) return;
      acciones.elegir(b.dataset.mision === 'libre' ? null : b.dataset.mision!);
      this.misionesAbierto = false; acciones.empezar();
    });
    (this.el.calidad as HTMLSelectElement).addEventListener('change', e => acciones.calidad((e.target as HTMLSelectElement).value as Calidad));
  }

  /** Solo toca el DOM cuando el contenido cambia (rehacerlo cada fotograma cuesta FPS en equipos modestos). */
  private cache: Record<string, string> = {};
  private poner(k: string, html: string) { if (this.cache[k] !== html) { this.cache[k] = html; this.el[k].innerHTML = html; } }
  progreso(t: string) { this.el.progreso.textContent = t; }
  listo() { this.el.cargando.hidden = true; this.el.portada.hidden = false; }
  /** Abre el tablero de misiones (suelta el ratón para poder elegir). */
  abrirMisiones(completadas: Set<string> = this.completadas) {
    this.misionesAbierto = true;
    const actual = useHood.getState().recipe?.id;
    this.el.listaMisiones.innerHTML = `<button class="mision libre" data-mision="libre"><b>Mezcla libre</b><span>Combina cualquiera de los 27 reactivos y observa qué predice el modelo: color, gas, precipitado, pH y temperatura.</span></button>`
      + hoodRecipes.map(r => `<button class="mision ${completadas.has(r.id) ? 'hecha' : ''} ${actual === r.id ? 'actual' : ''}" data-mision="${r.id}">
        <i>${r.level}${completadas.has(r.id) ? ' · completada ✓' : ''}</i><b>${esc(r.title)}</b><span class="ecuacion">${esc(r.equation)}</span><span>${esc(r.goal)}</span></button>`).join('');
    if (document.pointerLockElement) document.exitPointerLock();
    this.pausa(true, false);
  }
  private completadas = new Set<string>();
  pausa(visible: boolean, primeraVez: boolean) {
    if (!visible) this.misionesAbierto = false;
    this.el.portada.hidden = !(visible && primeraVez);
    this.el.misiones.hidden = !(visible && !primeraVez && this.misionesAbierto);
    this.el.pausa.hidden = !(visible && !primeraVez && !this.misionesAbierto);
    this.raiz.classList.toggle('en-pausa', visible);
  }
  fps(texto: string) { this.el.fps.textContent = texto; }

  private pistasVisibles = true;
  alternarPistas() { this.pistasVisibles = !this.pistasVisibles; }
  /** Pista del paso actual, señal hacia el objeto y medidor de la cantidad en curso. */
  guiar(g: Guia, senal: { x: number; y: number; fuera: boolean; angulo: number; metros: number } | null, objetivo: string | null) {
    this.poner('pista', this.pistasVisibles
      ? `<h4>Qué hacer ahora <kbd>H</kbd></h4><b>${esc(g.titulo)}</b><ol>${g.lineas.map(l => `<li>${esc(l)}</li>`).join('')}</ol>`
      : '<h4>Pistas ocultas <kbd>H</kbd></h4>');
    const ver = !!senal && this.pistasVisibles;
    this.el.senal.hidden = !ver;
    if (ver) {
      this.el.senal.style.transform = `translate(${(senal!.x * window.innerWidth).toFixed(0)}px, ${(senal!.y * window.innerHeight).toFixed(0)}px) translate(-50%, -100%)`;
      this.el.senal.classList.toggle('fuera', senal!.fuera);
      this.el.senalFlecha.style.transform = senal!.fuera ? `rotate(${(senal!.angulo - Math.PI / 2).toFixed(2)}rad)` : '';
      const texto = `${g.etiqueta}${senal!.fuera || senal!.metros > 2.5 ? ` · ${senal!.metros.toFixed(0)} m` : ''}`;
      if (this.el.senalTexto.textContent !== texto) this.el.senalTexto.textContent = texto;
    }
    const m = g.medidor;
    const verMedidor = !!m && (m.valor > 0 || objetivo === g.objetivo);
    this.el.medidor.hidden = !verMedidor;
    if (verMedidor) {
      const pct = Math.min(100, 100 * m!.valor / m!.meta), listo = m!.valor >= m!.meta * 0.9, pasado = m!.valor > m!.meta * 1.25;
      this.poner('medidor', `<b class="${pasado ? 'pasado' : listo ? 'listo' : ''}">${fmt(m!.valor, m!.decimales)} / ${fmt(m!.meta, m!.decimales)} ${m!.unidad}</b><div class="barra"><i style="width:${pct.toFixed(0)}%"></i></div><span>${pasado ? 'Te has pasado, pero puedes seguir' : listo ? 'Cantidad correcta: suelta el clic' : 'Mantén el clic'}</span>`);
    }
  }

  private nombre(objetivo: string) {
    if (objetivo.startsWith('reagent:')) { const r = reagents[objetivo.slice(8) as ReagentId]; return `${r.name} · ${r.formula}`; }
    return NOMBRES[objetivo] ?? objetivo;
  }

  /** Qué hace E sobre el objetivo según la capa de estado (solo texto de ayuda: la acción la decide la capa). */
  private accion(objetivo: string, mano: Hand) {
    const h = useHood.getState();
    const sostiene = h.heldIn(mano);
    const tipo = sostiene ? reagents[sostiene].kind : null;
    if (objetivo === 'recipe-board') return 'E · elegir misión o mezcla libre';
    if (objetivo === 'ppe-goggles') return 'E · ponerte las gafas';
    if (objetivo === 'ppe-gloves') return 'E · ponerte los guantes';
    if (objetivo.startsWith('reagent:')) return sostiene ? 'Q · dejar aquí el frasco de tu mano' : `E · recoger   (${reagents[objetivo.slice(8) as ReagentId].hazard})`;
    if (objetivo === 'reagent-shelf') return sostiene ? 'Q · devolver el frasco a la estantería' : 'Apunta a un frasco y pulsa E';
    if (objetivo === 'hood-tray') return sostiene ? 'Q · dejar el frasco en la bandeja' : '';
    if (objetivo === 'hood-cylinder') {
      const verter = h.cylinder.ml >= 1 ? `E · verter ${fmt(h.cylinder.ml)} mL en el matraz` : '';
      if (sostiene && tipo !== 'solid' && tipo !== 'indicator') return `Mantén el clic · llenar (${fmt(h.cylinder.ml)} mL)${verter ? '   ' + verter : ''}`;
      return verter || 'Vacía: llénala con un frasco de líquido en la mano';
    }
    if (objetivo === 'hood-balance') {
      const anadir = h.balance.grams >= 0.05 ? `E · añadir ${fmt(h.balance.grams, 2)} g al matraz` : '';
      if (sostiene && tipo === 'solid') return `Mantén el clic · pesar (${fmt(h.balance.grams, 2)} g)${anadir ? '   ' + anadir : ''}`;
      return anadir || 'Pesa aquí los sólidos: tarro en la mano y mantén el clic';
    }
    if (objetivo === 'hood-washbottle') return 'E · enjuagar la probeta';
    if (objetivo === 'hood-waste') return 'E · desechar la mezcla del matraz';
    if (objetivo === 'hood') return sostiene && tipo === 'indicator' ? 'Mantén el clic · añadir gotas   E · anotar' : 'E · anotar la observación en el cuaderno';
    if (objetivo.startsWith('amb:mechero')) return 'E · encender o apagar';
    if (objetivo.startsWith('amb:grifo')) return 'E · abrir o cerrar el grifo';
    if (objetivo === 'amb:ducha') return 'E · tirar de la palanca';
    if (objetivo.startsWith('amb:')) return 'E · información';
    return '';
  }

  actualizar(partida: Partida, objetivo: string | null, gramosSuspension: number) {
    const h = useHood.getState(), lab = useLab.getState();
    this.completadas = partida.completadas;
    const mano = lab.hand;
    const accion = objetivo ? this.accion(objetivo, mano) : '';
    this.poner('aviso', objetivo ? `<b>${esc(this.nombre(objetivo))}</b>${accion ? `<span>${esc(accion)}</span>` : ''}` : '');
    this.el.aviso.hidden = !objetivo;
    this.el.mira.classList.toggle('activa', !!objetivo);

    const pasos = partida.pasos();
    const def = partida.practica;
    const clave = JSON.stringify([partida.modo, def?.id, pasos.map(p => [p.title, p.done]), partida.modo === 'libre' ? h.mixture.additions : 0]);
    if (clave !== this.ultimo) {
      this.ultimo = clave;
      if (def) {
        const hechos = pasos.filter(p => p.done).length;
        const actual = pasos.findIndex(p => !p.done);
        this.el.tarea.innerHTML = `<h3>${esc(def.title)}</h3><p class="ecuacion">${esc(def.equation)}</p>
          <div class="barra"><i style="width:${(100 * hechos / pasos.length).toFixed(0)}%"></i></div>
          <ol>${pasos.map((p, i) => `<li class="${p.done ? 'hecho' : i === actual ? 'actual' : ''}"><span>${esc(p.title)}</span>${i === actual ? `<small>${esc(p.detail)}</small>` : ''}</li>`).join('')}</ol>`;
      } else if (partida.modo === 'libre') {
        this.el.tarea.innerHTML = `<h3>Mezcla libre</h3>
          <p>Líquidos: mídelos en la <b>probeta</b>. Sólidos: pésalos en la <b>balanza</b>. Indicadores: gotas directas al <b>matraz</b>.</p>
          ${h.mixture.additions.length ? `<ol>${h.mixture.additions.map(a => `<li class="hecho"><span>${esc(amountText(a.reagent, a.amount))} de ${esc(reagents[a.reagent].name)}</span></li>`).join('')}</ol><p>Vacía el matraz en <b>residuos</b> para empezar otra mezcla.</p>` : '<p>El matraz está vacío.</p>'}
          <p><b>M</b> · cambiar a una misión</p>`;
      } else {
        this.el.tarea.innerHTML = `<h3>Laboratorio de química</h3><p>1. Ponte <b>gafas y guantes</b> junto a la puerta.</p><p>2. Elige una <b>misión</b> o la <b>mezcla libre</b> en el tablero del fondo, o pulsa <b>M</b>.</p>`;
      }
    }

    // Lo que acaba de ocurrir en el matraz, según el modelo.
    const r = partida.reaccion;
    const visible = !!r && performance.now() - r.en < 9000;
    this.el.reaccion.hidden = !visible;
    if (visible && r!.clave !== this.ultimaReaccion) {
      this.ultimaReaccion = r!.clave;
      this.el.reaccion.innerHTML = r!.titulos.length
        ? `<b>${esc(r!.titulos.join(' · '))}</b>${r!.ecuaciones.map(e => `<span class="ecuacion">${esc(e)}</span>`).join('')}<span>${esc(r!.nota)}</span>${Math.abs(r!.deltaT) >= 0.1 ? `<span>${r!.deltaT > 0 ? 'Se calienta' : 'Se enfría'} ${fmt(Math.abs(r!.deltaT))} °C</span>` : ''}`
        : `<b>${esc(r!.cantidad)} de ${esc(r!.reactivo)}</b><span>${esc(r!.nota || 'Sin cambios según el modelo.')}</span>`;
    }

    if (this.el.mensaje.textContent !== lab.message) this.el.mensaje.textContent = lab.message;
    this.el.mensaje.hidden = !lab.message;

    const casilla = (lado: Hand) => {
      const id = h.heldIn(lado);
      return `<div class="mano ${lab.hand === lado ? 'activa' : ''}"><kbd>${lado === 'left' ? 1 : 2}</kbd><span>${lado === 'left' ? 'Izquierda' : 'Derecha'}</span><b>${id ? esc(reagents[id].name) : 'libre'}</b></div>`;
    };
    this.poner('manos', casilla('left') + casilla('right') + `<div class="epp">${lab.ppe.goggles ? '✓' : '·'} Gafas  ${lab.ppe.gloves ? '✓' : '·'} Guantes</div>`);

    // Pantalla del matraz: lo que calcula el modelo para la mezcla actual.
    this.el.matraz.hidden = !h.mixture.additions.length;
    if (h.mixture.additions.length) {
      const a = partida.ultimo!;
      this.poner('matraz', `<b>Matraz</b><span>${fmt(a.volumeMl)} mL · ${fmt(a.temperatureC)} °C</span><span>pH ${a.pH === null ? '—' : fmt(a.pH, 2)}</span>`
        + a.solids.slice(0, 2).map(s => `<span>${esc(s.label)} (s) ${fmt(s.grams, 3)} g${gramosSuspension > 1e-4 ? ' ↓' : ''}</span>`).join('')
        + a.gases.map(g => `<span>${esc(g.label)} (g) ${fmt(g.litres * 1000, 0)} mL</span>`).join(''));
    }

    // Resultado final de la misión con lo que calcula el modelo.
    const completa = partida.completa();
    this.el.resultado.hidden = !completa;
    if (completa && this.el.resultado.dataset.hecho !== def!.id) {
      this.el.resultado.dataset.hecho = def!.id;
      const p = partida.precipitado, a = partida.ultimo;
      this.el.resultado.innerHTML = `<h3>Misión completada · ${esc(def!.title)}</h3>
        <p class="principal">${p ? `${esc(p.nombre)}: <b>${fmt(p.gramos, 4)} g</b> de sólido` : esc(def!.observe)}</p>
        <p>${partida.anadido.map(x => `${esc(x.texto)} de ${esc(x.nombre)}`).join(' + ')}</p>
        ${a ? `<p>Final: pH ${a.pH === null ? '—' : fmt(a.pH, 2)} · ${fmt(a.temperatureC)} °C${a.gases.length ? ' · ' + a.gases.map(g => `${esc(g.label)} ${fmt(g.litres * 1000, 0)} mL`).join(', ') : ''}</p>` : ''}
        <p class="nota">Reglas del modelo: ${esc(partida.reglasDisparadas.join(', ') || '—')}. ${esc(def!.waste)}</p>
        <p class="nota">Pulsa <b>M</b> para elegir otra misión o la mezcla libre.</p>`;
    }
    if (!completa) delete this.el.resultado.dataset.hecho;
  }
}
