import { reagents, shelfRows } from '../../src/chemistry/reagents';
import { elements, families, matchesElement, normalizeSearch, type ElementData } from '../../src/experiments/elements';
import { periodicRows } from '../../src/experiments/periodic';

/**
 * Tabla periódica interactiva del laboratorio (25 de noviembre de 2026). Usa los mismos datos de los 118 elementos
 * que el prototipo web (src/experiments/elements.ts, instantánea pública de PubChem; procedencia en
 * docs/TABLA_PERIODICA.md). Las ausencias se muestran como «sin dato»: no se inventa ningún valor.
 */
type Modo = 'familia' | 'estado' | 'masa' | 'electronegatividad' | 'fusion';
const MODOS: Record<Modo, string> = { familia: 'Familias', estado: 'Estado a 25 °C', masa: 'Masa atómica', electronegatividad: 'Electronegatividad', fusion: 'Punto de fusión' };
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const num = (v: number | null, d: number, unidad = '') => v === null ? 'sin dato' : `${v.toLocaleString('es', { maximumFractionDigits: d })}${unidad}`;
const ESTADOS: Record<string, string> = { 'Sólido': '#b9c7d8', 'Líquido': '#7fb6ee', 'Gas': '#f0d58a', 'Sólido (predicho)': '#8e97a6', 'Gas (predicho)': '#b9a86e' };

/** Color de la celda según el modo: familia, estado, o una escala de claro a intenso para las propiedades numéricas. */
function colorDe(e: ElementData, modo: Modo): string {
  if (modo === 'familia') return families[e.family]?.color ?? '#9aa3ae';
  if (modo === 'estado') return ESTADOS[e.state] ?? '#5b6370';
  const valor = modo === 'masa' ? e.mass : modo === 'electronegatividad' ? e.electronegativity : e.melting;
  if (valor === null) return '#3a404a';
  const [min, max] = modo === 'masa' ? [1, 295] : modo === 'electronegatividad' ? [0.7, 4] : [0, 3800];
  const t = Math.min(1, Math.max(0, (valor - min) / (max - min)));
  const tono = modo === 'masa' ? 205 : modo === 'electronegatividad' ? 145 : 18;
  return `hsl(${tono} ${45 + t * 35}% ${86 - t * 46}%)`;
}

/** Reactivos de la estantería del laboratorio cuya fórmula contiene el elemento. */
function reactivosCon(simbolo: string) {
  const patron = new RegExp(`${simbolo}(?![a-z])`);
  return shelfRows.flat().map(id => reagents[id]).filter(r => patron.test(r.formula.normalize('NFKD').replace(/[₀-₉]/g, '')));
}

function ficha(e: ElementData) {
  const k = (v: number | null) => v === null ? 'sin dato' : `${num(v, 2)} K (${num(v - 273.15, 1)} °C)`;
  const usados = reactivosCon(e.symbol);
  return `<div class="simbolo" style="background:${colorDe(e, 'familia')}"><small>${e.number}</small><b>${esc(e.symbol)}</b><span>${num(e.mass, 3)}</span></div>
    <h3>${esc(e.name)}</h3><p class="familia">${esc(families[e.family]?.name ?? 'Sin familia asignada')} · ${esc(e.state)}</p>
    <dl>
      <dt>Grupo y periodo</dt><dd>${e.group ?? '—'} · ${e.period}</dd>
      <dt>Configuración electrónica</dt><dd>${esc(e.configuration || 'sin dato')}</dd>
      <dt>Estados de oxidación</dt><dd>${esc(e.oxidation || 'sin dato')}</dd>
      <dt>Electronegatividad (Pauling)</dt><dd>${num(e.electronegativity, 2)}</dd>
      <dt>Radio atómico</dt><dd>${num(e.radius, 0, ' pm')}</dd>
      <dt>Energía de ionización</dt><dd>${num(e.ionization, 3, ' eV')}</dd>
      <dt>Punto de fusión</dt><dd>${k(e.melting)}</dd>
      <dt>Punto de ebullición</dt><dd>${k(e.boiling)}</dd>
      <dt>Densidad</dt><dd>${num(e.density, 5, ' g/cm³')}</dd>
    </dl>
    <div class="en-lab"><b>En este laboratorio</b>${usados.length
      ? `<ul>${usados.map(r => `<li>${esc(r.name)} <span>${esc(r.formula.split(' · ')[0])}</span></li>`).join('')}</ul>`
      : '<p>Ningún reactivo de la estantería lo contiene.</p>'}</div>`;
}

/** Monta la tabla en su panel. Devuelve `mostrar`, que la deja lista cada vez que se abre. */
export function montarTabla(panel: HTMLElement) {
  let modo: Modo = 'familia', elegido = 1, consulta = '', familia = '';
  panel.innerHTML = `
    <header>
      <h2>Tabla periódica</h2>
      <input type="search" data-tp="buscar" placeholder="Buscar: oro, Fe, 47…" aria-label="Buscar elemento" />
      <select data-tp="familia" aria-label="Familia"><option value="">Todas las familias</option>${Object.entries(families).map(([k, f]) => `<option value="${esc(k)}">${esc(f.name)}</option>`).join('')}</select>
      <select data-tp="modo" aria-label="Colorear por">${(Object.keys(MODOS) as Modo[]).map(m => `<option value="${m}">Color: ${MODOS[m]}</option>`).join('')}</select>
      <button data-tp="cerrar" class="boton secundario">Volver al laboratorio</button>
    </header>
    <div class="tp-cuerpo"><div class="tp-rejilla" data-tp="rejilla"></div><aside class="tp-ficha" data-tp="ficha"></aside></div>
    <div class="tp-leyenda" data-tp="leyenda"></div>`;
  const el = (k: string) => panel.querySelector<HTMLElement>(`[data-tp="${k}"]`)!;
  const pintar = () => {
    el('rejilla').innerHTML = periodicRows.map((fila, f) => fila.map((n, c) => {
      if (!n) return `<span class="hueco${f === 5 && c === 2 ? ' serie' : f === 6 && c === 2 ? ' serie' : ''}">${f === 5 && c === 2 ? '57–71' : f === 6 && c === 2 ? '89–103' : ''}</span>`;
      const e = elements[n - 1];
      const coincide = matchesElement(e, consulta, familia);
      return `<button class="tp-celda${n === elegido ? ' elegida' : ''}${coincide ? '' : ' apagada'}" data-n="${n}" style="background:${colorDe(e, modo)}" title="${esc(e.name)}"><small>${n}</small><b>${esc(e.symbol)}</b><span>${esc(e.name)}</span></button>`;
    }).join('') + (f === 6 ? '<span class="separador"></span>' : '')).join('');
    el('ficha').innerHTML = ficha(elements[elegido - 1]);
    el('leyenda').innerHTML = modo === 'familia' ? Object.values(families).map(f => `<span><i style="background:${f.color}"></i>${esc(f.name)}</span>`).join('')
      : modo === 'estado' ? Object.entries(ESTADOS).map(([n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join('')
        : `<span><i style="background:${colorDe({ ...elements[0], mass: 1, electronegativity: 0.7, melting: 0 }, modo)}"></i>menor</span><span><i style="background:${colorDe({ ...elements[0], mass: 295, electronegativity: 4, melting: 3800 }, modo)}"></i>mayor</span><span><i style="background:#3a404a"></i>sin dato</span>`;
  };
  el('rejilla').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-n]'); if (b) { elegido = Number(b.dataset.n); pintar(); } });
  el('buscar').addEventListener('input', e => {
    consulta = (e.target as HTMLInputElement).value;
    // Primero la coincidencia exacta («oro» es Oro, no Boro), luego la que empieza igual y por último la que lo contiene.
    const q = normalizeSearch(consulta), candidatos = elements.filter(x => matchesElement(x, consulta, familia));
    const primero = candidatos.find(x => normalizeSearch(x.name) === q || x.symbol.toLowerCase() === q) ?? candidatos.find(x => normalizeSearch(x.name).startsWith(q)) ?? candidatos[0];
    if (consulta && primero) elegido = primero.number;
    pintar();
  });
  el('familia').addEventListener('change', e => { familia = (e.target as HTMLSelectElement).value; pintar(); });
  el('modo').addEventListener('change', e => { modo = (e.target as HTMLSelectElement).value as Modo; pintar(); });
  // Flechas del teclado para recorrer la tabla.
  panel.addEventListener('keydown', e => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (paso) { elegido = Math.min(118, Math.max(1, elegido + paso)); pintar(); e.preventDefault(); }
  });
  return { mostrar: pintar, cerrar: el('cerrar') };
}

/** Dibuja la tabla completa (118 elementos, colores por familia) para el póster de la pared. */
export function dibujarPoster(c: CanvasRenderingContext2D, ancho: number, alto: number) {
  c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, ancho, alto);
  c.fillStyle = '#1d1f24'; c.textAlign = 'center'; c.font = '700 38px "Segoe UI", Arial';
  c.fillText('TABLA PERIÓDICA DE LOS ELEMENTOS', ancho / 2, 46);
  const cw = (ancho - 40) / 18, ch = 50;
  periodicRows.forEach((fila, f) => fila.forEach((n, col) => {
    if (!n) return;
    const e = elements[n - 1], x = 20 + col * cw, y = 68 + f * ch + (f > 6 ? 16 : 0);
    c.fillStyle = families[e.family]?.color ?? '#c8ccd2'; c.fillRect(x + 1, y + 1, cw - 2, ch - 2);
    c.strokeStyle = '#59606a'; c.lineWidth = 1; c.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
    c.fillStyle = '#1d1f24'; c.font = '600 22px "Segoe UI", Arial'; c.fillText(e.symbol, x + cw / 2, y + 36);
    c.font = '500 11px "Segoe UI", Arial'; c.fillText(String(n), x + cw / 2, y + 14);
  }));
  c.font = '600 20px "Segoe UI", Arial'; c.fillStyle = '#14509a'; c.fillText('Pulsa E para explorarla', ancho / 2, alto - 14);
}
