import { reagents, type ReagentId } from '../../src/chemistry/reagents';
import { categoryColors, reagentIds } from '../../src/chemistry/reagents';
import { hoodRecipes } from '../../src/experiments/hoodRecipes';
import { amountText, useHood, type Hand } from '../../src/state/hood';
import { useLab } from '../../src/state/lab';
import { NOMBRES } from './objetos';
import { explicar, mezclaDeConsulta, NIVELES, parejasQueReaccionan, SUSTANCIAS, type Explicacion } from './explicar';
import type { Guia } from './guia';
import type { Partida } from './partida';
import { montarTabla } from './tabla';
import { adaptarTexto, esTactil } from './tactil';
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
  private cuadernoAbierto = false;
  private pestana: 'ensayos' | 'consulta' | 'sustancias' = 'ensayos';
  private consulta: (ReagentId | '')[] = ['hcl', 'naoh', ''];
  private tablaAbierta = false;
  private tabla: ReturnType<typeof montarTabla> | null = null;
  private misionesDesde = 0;
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
          <li><b>1 / 2</b> mano izquierda / derecha · <b>M</b> misiones · <b>H</b> pistas · <b>N</b> cuaderno · <b>T</b> tabla periódica · <b>clic derecho</b> mirar de cerca</li>
          <li><b>Esc</b> pausa</li>
        </ul>
        <ul class="controles tactiles">
          <li><b>Palanca izquierda</b> caminar · <b>arrastra el dedo</b> por la pantalla para mirar</li>
          <li><b>USAR</b> coger, verter la probeta, anotar · <b>MANTENER</b> llenar, pesar o gotear · <b>DEJAR</b> soltar el frasco</li>
          <li>Apunta con el punto del centro de la pantalla. Arriba: manos, misiones, cuaderno, pistas y pausa.</li>
        </ul>
      </section>
      <section class="misiones tabla-periodica" data-k="tabla" hidden tabindex="-1"></section>
      <section class="misiones cuaderno" data-k="cuaderno" hidden>
        <header><h2>Cuaderno de laboratorio</h2>
          <nav class="pestanas" data-k="pestanas"><button data-p="ensayos">Mis ensayos</button><button data-p="consulta">¿Qué pasa si mezclo…?</button><button data-p="sustancias">Sustancias</button></nav>
          <button data-k="cerrarCuaderno" class="boton secundario">Volver al laboratorio</button></header>
        <div class="lista" data-k="listaCuaderno"></div>
      </section>
      <section class="misiones" data-k="misiones" hidden>
        <header><h2>Tablero de misiones</h2><button data-k="cerrarMisiones" class="boton secundario">Volver al laboratorio</button></header>
        <div class="lista" data-k="listaMisiones"></div>
      </section>
      <section class="pausa" data-k="pausa" hidden>
        <h2>Pausa</h2>
        <button data-k="continuar" class="boton">Continuar</button>
        <button data-k="verMisiones" class="boton secundario">Misiones y mezcla libre</button>
        <button data-k="verCuaderno" class="boton secundario">Cuaderno de laboratorio</button>
        <button data-k="verTabla" class="boton secundario">Tabla periódica</button>
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
    this.el.verCuaderno.addEventListener('click', () => this.abrirCuaderno());
    this.el.verTabla.addEventListener('click', () => this.abrirTabla());
    this.el.cerrarCuaderno.addEventListener('click', () => { this.cuadernoAbierto = false; acciones.empezar(); });
    // Las anotaciones se guardan al escribir, en el mismo almacenamiento que el prototipo web (experimenta.hood.v1).
    this.el.listaCuaderno.addEventListener('input', e => { const t = e.target as HTMLTextAreaElement; if (t.dataset.nota) useHood.getState().annotate(t.dataset.nota, t.value); });
    this.el.pestanas.addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-p]'); if (b) { this.pestana = b.dataset.p as Hud['pestana']; this.pintarCuaderno(); } });
    this.el.listaCuaderno.addEventListener('change', e => { const s = e.target as HTMLSelectElement; if (s.dataset.c) { this.consulta[Number(s.dataset.c)] = s.value as ReagentId | ''; this.pintarCuaderno(); } });
    this.el.listaCuaderno.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-par]');
      if (b) { const [x, y] = b.dataset.par!.split(',') as ReagentId[]; this.consulta = [x, y, '']; this.pestana = 'consulta'; this.pintarCuaderno(); }
    });
    this.el.cerrarMisiones.addEventListener('click', () => { this.misionesAbierto = false; acciones.empezar(); });
    this.el.listaMisiones.addEventListener('click', e => {
      // En táctil, el mismo toque que abre el tablero no debe elegir la misión que queda bajo el dedo.
      if (this.tactil && performance.now() - this.misionesDesde < 450) return;
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-mision]');
      if (!b) return;
      acciones.elegir(b.dataset.mision === 'libre' ? null : b.dataset.mision!);
      this.misionesAbierto = false; acciones.empezar();
    });
    // Versión móvil: cada cuadro se pliega al tocarlo (en ordenador no reciben clics y no cambia nada).
    this.el.tarea.addEventListener('click', () => { if (this.tactil) this.el.tarea.classList.toggle('plegado'); });
    this.el.pista.addEventListener('click', () => { if (this.tactil) this.alternarPistas(); });
    this.el.mensaje.addEventListener('click', () => { if (this.tactil) { this.mensajeDescartado = this.el.mensaje.textContent ?? ''; this.el.mensaje.hidden = true; } });
    (this.el.calidad as HTMLSelectElement).addEventListener('change', e => acciones.calidad((e.target as HTMLSelectElement).value as Calidad));
  }

  /** Solo toca el DOM cuando el contenido cambia (rehacerlo cada fotograma cuesta FPS en equipos modestos). */
  private cache: Record<string, string> = {};
  private tactil = esTactil();
  /** En pantalla táctil las instrucciones nombran los botones en vez de las teclas. */
  private texto(t: string) { return this.tactil ? adaptarTexto(t) : t; }
  private poner(k: string, html: string) { if (this.cache[k] !== html) { this.cache[k] = html; this.el[k].innerHTML = this.texto(html); } }
  progreso(t: string) { this.el.progreso.textContent = t; }
  listo() { this.el.cargando.hidden = true; this.el.portada.hidden = false; }
  /** Abre el tablero de misiones (suelta el ratón para poder elegir). */
  /** Abre la tabla periódica interactiva (118 elementos, ficha, búsqueda y colores por propiedad). */
  abrirTabla() {
    if (!this.tabla) {
      this.tabla = montarTabla(this.el.tabla);
      this.tabla.cerrar.addEventListener('click', () => { this.tablaAbierta = false; this.acciones.empezar(); });
    }
    this.tablaAbierta = true; this.misionesAbierto = false; this.cuadernoAbierto = false;
    this.tabla.mostrar();
    if (document.pointerLockElement) document.exitPointerLock();
    this.pausa(true, false);
    this.el.tabla.focus();
  }
  /** Tarjeta explicada de una mezcla: el conjunto primero, cada sustancia por separado después y los números al final, plegados. */
  private tarjeta(x: Explicacion, cabecera: string, mezcla: string, nota = '') {
    const sello = (n: Explicacion['nivel']) => `<em class="sello ${n}">${NIVELES[n]}</em>`;
    const parrafos = (xs: string[]) => xs.map(t => `<p>${esc(t)}</p>`).join('');
    const d = x.datos;
    return `<article class="mision ensayo"><i>${esc(cabecera)}</i><b>${esc(x.titulo)}</b><span class="mezcla">${esc(mezcla)}</span>
      <section><h5>Qué pasó</h5>${parrafos(x.quePaso)}${x.resultado.length ? `<ul>${x.resultado.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</section>
      <section class="riesgo ${x.nivel}"><h5>¿Es peligroso? ${sello(x.nivel)}</h5><ul>${x.peligro.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>
      <section><h5>¿Es problemático?</h5><p>${esc(x.problema)}</p><p><strong>Cómo se desecha:</strong> ${esc(x.desecho)}</p></section>
      <section><h5>¿Para qué sirve?</h5>${parrafos(x.sirve)}</section>
      <details class="separado"${this.tactil ? '' : ' open'}><summary>Cada sustancia por separado</summary>
        ${x.sustancias.map(s => `<div class="sust"><h6>${esc(s.nombre)} <small>${esc(s.cantidad)}</small> ${sello(s.nivel)}</h6><p><strong>Qué es:</strong> ${esc(s.queEs)}</p><p><strong>Para qué sirve:</strong> ${esc(s.sirve)}</p><p><strong>Riesgo:</strong> ${esc(s.riesgo)}</p></div>`).join('')}
        ${x.productos.map(p => `<div class="sust formado"><h6>Se formó: ${esc(p.nombre)} ${sello(p.nivel)}</h6><p>${esc(p.nota)}</p></div>`).join('')}
      </details>
      ${nota}
      <details><summary>Datos y cálculos del modelo</summary>
        <span>Volumen final: ${fmt(d.volumen)} mL · Temperatura final: ${fmt(d.temperatura)} °C · pH: ${d.pH === null ? '—' : fmt(d.pH, 2)} (0 es muy ácido, 7 neutro, 14 muy básico)</span>
        ${d.solidos.length ? `<span>Sólidos en el fondo: ${esc(d.solidos.join(', '))}</span>` : ''}
        ${d.gases.length ? `<span>Gases desprendidos: ${esc(d.gases.join(', '))}</span>` : ''}
        ${d.ecuaciones.length ? `<span>Ecuaciones químicas:</span>${d.ecuaciones.map(e => `<span class="ecuacion">${esc(e)}</span>`).join('')}` : ''}
      </details></article>`;
  }
  private pintarCuaderno() {
    const lista = this.el.listaCuaderno;
    this.el.pestanas.querySelectorAll<HTMLElement>('[data-p]').forEach(b => b.classList.toggle('activa', b.dataset.p === this.pestana));
    lista.className = `lista ${this.pestana}`;
    const describir = (ads: { reagent: ReagentId; amount: number }[]) => ads.map(a => `${amountText(a.reagent, a.amount)} de ${reagents[a.reagent].name}`).join(' + ');
    let html: string;
    if (this.pestana === 'ensayos') {
      const registros = [...useHood.getState().records].reverse();
      html = registros.length ? registros.map(r => {
        const x = explicar(r.additions);
        const fecha = new Date(r.at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        return this.tarjeta(x, `${fecha} · ${x.mision ? 'Misión' : 'Práctica libre'}`, describir(r.additions),
          `<label class="nota">Tu observación<textarea data-nota="${esc(r.id)}" rows="2" placeholder="Escribe aquí lo que viste…">${esc(r.observation)}</textarea></label>`);
      }).join('') : '<p class="vacio">Todavía no hay ensayos anotados. Haz una mezcla en la campana y anótala: apunta al matraz y pulsa E, o abre el cuaderno con N con la mezcla aún en el matraz. Mientras tanto puedes consultar cualquier mezcla en «¿Qué pasa si mezclo…?» y leer la ficha de cada sustancia.</p>';
    } else if (this.pestana === 'consulta') {
      const opciones = (elegido: string, vacio: boolean) => `${vacio ? '<option value="">(nada más)</option>' : ''}${reagentIds.map(id => `<option value="${id}"${id === elegido ? ' selected' : ''}>${esc(reagents[id].name)}</option>`).join('')}`;
      const ids = this.consulta.filter((id): id is ReagentId => !!id);
      const ads = mezclaDeConsulta(ids);
      html = `<div class="consulta"><p>Elige dos o tres sustancias y lee qué ocurriría, sin tener que hacer la mezcla.</p>
        <div class="selectores"><select data-c="0" aria-label="Primera sustancia">${opciones(this.consulta[0], false)}</select><b>+</b><select data-c="1" aria-label="Segunda sustancia">${opciones(this.consulta[1], false)}</select><b>+</b><select data-c="2" aria-label="Tercera sustancia (opcional)">${opciones(this.consulta[2], true)}</select></div></div>
        ${this.tarjeta(explicar(ads), 'Consulta · cantidades de ejemplo', describir(ads))}
        <p class="vacio">El resultado puede cambiar con otras cantidades: por ejemplo, si sobra ácido o sobra base.</p>`;
    } else {
      const parejas = parejasQueReaccionan();
      html = reagentIds.map(id => {
        const r = reagents[id], f = SUSTANCIAS[id], con = parejas.get(id) ?? [];
        return `<article class="mision ensayo sustancia"><i style="color:${categoryColors[r.category]}">${esc(r.category)}</i><b>${esc(r.name)} <em class="sello ${f.nivel}">${NIVELES[f.nivel]}</em></b>
          <p><strong>Qué es:</strong> ${esc(f.queEs)}</p><p><strong>Para qué sirve:</strong> ${esc(f.sirve)}</p><p><strong>Riesgo:</strong> ${esc(f.riesgo)}</p>
          ${r.kind === 'indicator' ? '<p class="con">No reacciona: solo cambia de color para avisar.</p>' : con.length
            ? `<p class="con"><strong>Reacciona con</strong> (elige una para ver qué pasa):</p><div class="chips">${con.map(o => `<button data-par="${id},${o}">${esc(reagents[o].name)}</button>`).join('')}</div>`
            : '<p class="con">No reacciona con ninguna otra sustancia de la estantería: solo diluye o disuelve.</p>'}</article>`;
      }).join('');
    }
    lista.innerHTML = this.texto(html);
    lista.scrollTop = 0;
  }
  /** Abre el cuaderno: tus ensayos explicados, la consulta de cualquier mezcla y la ficha de cada sustancia. */
  abrirCuaderno() {
    this.cuadernoAbierto = true; this.misionesAbierto = false; this.tablaAbierta = false;
    this.pestana = 'ensayos';
    this.pintarCuaderno();
    if (document.pointerLockElement) document.exitPointerLock();
    this.pausa(true, false);
  }
  abrirMisiones(completadas: Set<string> = this.completadas) {
    this.misionesAbierto = true; this.cuadernoAbierto = false; this.tablaAbierta = false; this.misionesDesde = performance.now();
    const actual = useHood.getState().recipe?.id;
    this.el.listaMisiones.innerHTML = `<button class="mision libre" data-mision="libre"><b>Mezcla libre</b><span>Combina cualquiera de los 27 reactivos y observa qué predice el modelo: color, gas, precipitado, pH y temperatura.</span></button>`
      + hoodRecipes.map(r => `<button class="mision ${completadas.has(r.id) ? 'hecha' : ''} ${actual === r.id ? 'actual' : ''}" data-mision="${r.id}">
        <i>${r.level}${completadas.has(r.id) ? ' · completada ✓' : ''}</i><b>${esc(r.title)}</b><span class="ecuacion">${esc(r.equation)}</span><span>${esc(r.goal)}</span></button>`).join('');
    if (document.pointerLockElement) document.exitPointerLock();
    this.pausa(true, false);
  }
  private completadas = new Set<string>();
  pausa(visible: boolean, primeraVez: boolean) {
    if (!visible) { this.misionesAbierto = false; this.cuadernoAbierto = false; this.tablaAbierta = false; }
    this.el.portada.hidden = !(visible && primeraVez);
    this.el.misiones.hidden = !(visible && !primeraVez && this.misionesAbierto);
    this.el.cuaderno.hidden = !(visible && !primeraVez && this.cuadernoAbierto);
    this.el.tabla.hidden = !(visible && !primeraVez && this.tablaAbierta);
    this.el.pausa.hidden = !(visible && !primeraVez && !this.misionesAbierto && !this.cuadernoAbierto && !this.tablaAbierta);
    this.raiz.classList.toggle('en-pausa', visible);
  }
  fps(texto: string) { this.el.fps.textContent = texto; }

  private pistasVisibles = true;
  private mensajeDescartado = '';
  /** Oculta o muestra de una vez todos los cuadros de texto (botón de la barra táctil). Devuelve si quedan ocultos. */
  alternarCuadros() { return this.raiz.classList.toggle('sin-cuadros'); }
  alternarPistas() { this.pistasVisibles = !this.pistasVisibles; }
  /** Pista del paso actual, señal hacia el objeto y medidor de la cantidad en curso. */
  guiar(g: Guia, senal: { x: number; y: number; fuera: boolean; angulo: number; metros: number } | null, objetivo: string | null) {
    this.poner('pista', this.pistasVisibles
      ? `<h4>Qué hacer ahora <kbd>H</kbd></h4><b>${esc(g.titulo)}</b><ol>${g.lineas.map(l => `<li>${esc(l)}</li>`).join('')}</ol>`
      : this.tactil ? '<h4>Pistas ▸</h4>' : '<h4>Pistas ocultas <kbd>H</kbd></h4>');
    this.el.pista.classList.toggle('plegado', !this.pistasVisibles);
    const ver = !!senal && this.pistasVisibles;
    this.el.senal.hidden = !ver;
    if (ver) {
      this.el.senal.style.transform = `translate(${(senal!.x * window.innerWidth).toFixed(0)}px, ${(senal!.y * window.innerHeight).toFixed(0)}px) translate(-50%, -100%)`;
      this.el.senal.classList.toggle('fuera', senal!.fuera);
      this.el.senalFlecha.style.transform = senal!.fuera ? `rotate(${(senal!.angulo - Math.PI / 2).toFixed(2)}rad)` : '';
      const texto = this.texto(`${g.etiqueta}${senal!.fuera || senal!.metros > 2.5 ? ` · ${senal!.metros.toFixed(0)} m` : ''}`);
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
    if (objetivo === 'amb:tabla') return 'E · abrir la tabla interactiva';
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
        this.el.tarea.innerHTML = this.texto(`<h3>${esc(def.title)}</h3><p class="ecuacion">${esc(def.equation)}</p>
          <div class="barra"><i style="width:${(100 * hechos / pasos.length).toFixed(0)}%"></i></div>
          <ol>${pasos.map((p, i) => `<li class="${p.done ? 'hecho' : i === actual ? 'actual' : ''}"><span>${esc(p.title)}</span>${i === actual ? `<small>${esc(p.detail)}</small>` : ''}</li>`).join('')}</ol>`);
      } else if (partida.modo === 'libre') {
        this.el.tarea.innerHTML = this.texto(`<h3>Mezcla libre</h3>
          <p>Líquidos: mídelos en la <b>probeta</b>. Sólidos: pésalos en la <b>balanza</b>. Indicadores: gotas directas al <b>matraz</b>.</p>
          ${h.mixture.additions.length ? `<ol>${h.mixture.additions.map(a => `<li class="hecho"><span>${esc(amountText(a.reagent, a.amount))} de ${esc(reagents[a.reagent].name)}</span></li>`).join('')}</ol><p>Vacía el matraz en <b>residuos</b> para empezar otra mezcla.</p>` : '<p>El matraz está vacío.</p>'}
          <p><b>M</b> · cambiar a una misión</p>`);
      } else {
        this.el.tarea.innerHTML = this.texto(`<h3>Laboratorio de química</h3><p>1. Ponte <b>gafas y guantes</b> junto a la puerta.</p><p>2. Elige una <b>misión</b> o la <b>mezcla libre</b> en el tablero del fondo, o pulsa <b>M</b>.</p>`);
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

    const mensaje = this.texto(lab.message);
    if (this.el.mensaje.textContent !== mensaje) this.el.mensaje.textContent = mensaje;
    this.el.mensaje.hidden = !lab.message || mensaje === this.mensajeDescartado;

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
