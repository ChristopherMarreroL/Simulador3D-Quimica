import type { Hand } from '../../src/state/hood';
import type { Jugador } from './jugador';

/**
 * Controles táctiles para teléfonos y tabletas (versión móvil, 24 de noviembre de 2026). No cambian el juego:
 * llaman a las mismas acciones que el teclado y el ratón.
 *  - Palanca izquierda: caminar. Arrastrar el dedo por el resto de la pantalla: mirar.
 *  - USAR = tecla E (coger, verter la probeta, enjuagar, anotar…). VERTER = mantener el clic (llenar, pesar, gotear).
 *  - DEJAR = Q. Las casillas de las manos cambian de mano; MISIONES, PISTAS y PAUSA arriba.
 */
export const esTactil = () => new URLSearchParams(location.search).has('movil') || window.matchMedia('(pointer: coarse)').matches;

/** Reescribe las instrucciones de teclado y ratón con los nombres de los botones táctiles. */
const CAMBIOS: [RegExp, string][] = [
  [/Camina con W A S D y mira (moviendo el|con el) ratón/g, 'Camina con la palanca de la izquierda y mira arrastrando el dedo por la pantalla'],
  [/pulsa la tecla E \(no el clic\)/g, 'toca USAR'],
  [/[Mm]antén pulsado el clic izquierdo/g, 'Mantén el dedo en el botón MANTENER'],
  [/Mantén el clic/g, 'Mantén MANTENER'], [/mantén el clic/g, 'mantén MANTENER'], [/suelta el clic/g, 'suelta el botón'],
  [/[Pp]ulsa la tecla ([12])/g, 'Toca «Mano $1»'], [/Tecla ([12]), luego E/g, 'Mano $1 y USAR'], [/con 1 \/ 2/g, 'con los botones Mano 1 / Mano 2'],
  [/pulsa la tecla E/g, 'toca USAR'], [/pulsa E \(o pulsa N para abrir el cuaderno\)/g, 'toca USAR (o «Cuaderno» arriba)'], [/con N con la mezcla/g, 'con el botón «Cuaderno» con la mezcla'], [/[Pp]ulsa E/g, 'Toca USAR'], [/pulsa Q/g, 'toca DEJAR'],
  [/También puedes pulsar M desde cualquier sitio/g, 'También puedes tocar «Misiones» arriba'], [/Pulsa M /g, 'Toca «Misiones» '], [/o pulsa <b>M<\/b>/g, 'o toca <b>Misiones</b>'], [/\(o pulsa M\)/g, '(o toca «Misiones»)'],
  [/<b>M<\/b> · /g, '<b>Misiones</b> · '], [/ · E( ·|$|<)/g, ' · USAR$1'], [/ · Q( ·|$|<)/g, ' · DEJAR$1'], [/^E · /g, 'USAR · '], [/>E · /g, '>USAR · '], [/^Q · /g, 'DEJAR · '], [/>Q · /g, '>DEJAR · '],
  [/   E · /g, '   USAR · '], [/\(E\)/g, '(USAR)'], [/con Q\b/g, 'con DEJAR'],
];
export const adaptarTexto = (t: string) => CAMBIOS.reduce((s, [de, a]) => s.replace(de, a), t);

export interface AccionesTactiles {
  usar: (pulsado: boolean, tecla: boolean) => void; dejar: () => void; mano: (m: Hand) => void;
  misiones: () => void; cuaderno: () => void; pistas: () => void; pausa: () => void;
}

export function montarTactil(raiz: HTMLElement, lienzo: HTMLElement, jugador: Jugador, acciones: AccionesTactiles) {
  document.body.classList.add('tactil');
  const capa = document.createElement('div');
  capa.className = 'tactil-capa';
  capa.innerHTML = `
    <div class="palanca" data-t="palanca"><i data-t="pomo"></i></div>
    <div class="botones">
      <button data-t="dejar" class="bt pequeno">DEJAR</button>
      <button data-t="verter" class="bt">MANTENER<small>verter · pesar</small></button>
      <button data-t="usar" class="bt principal">USAR</button>
    </div>
    <div class="barra-tactil">
      <button data-t="mano1" class="bt mini">Mano 1</button><button data-t="mano2" class="bt mini">Mano 2</button>
      <button data-t="misiones" class="bt mini">Misiones</button><button data-t="cuaderno" class="bt mini">Cuaderno</button><button data-t="pistas" class="bt mini">Pistas</button><button data-t="pausa" class="bt mini">II</button>
    </div>
    <div class="gira">Gira el teléfono a horizontal para jugar</div>`;
  raiz.append(capa);
  const el = (k: string) => capa.querySelector<HTMLElement>(`[data-t="${k}"]`)!;

  // Palanca de movimiento.
  const palanca = el('palanca'), pomo = el('pomo');
  let idPalanca = -1;
  const moverPalanca = (e: PointerEvent) => {
    const r = palanca.getBoundingClientRect(), radio = r.width / 2;
    let x = (e.clientX - (r.left + radio)) / radio, y = (e.clientY - (r.top + radio)) / radio;
    const largo = Math.hypot(x, y); if (largo > 1) { x /= largo; y /= largo; }
    pomo.style.transform = `translate(${(x * radio * 0.55).toFixed(0)}px, ${(y * radio * 0.55).toFixed(0)}px)`;
    jugador.palanca.set(Math.abs(x) < 0.12 ? 0 : x, Math.abs(y) < 0.12 ? 0 : y);
  };
  palanca.addEventListener('pointerdown', e => { idPalanca = e.pointerId; palanca.setPointerCapture(e.pointerId); moverPalanca(e); e.preventDefault(); });
  palanca.addEventListener('pointermove', e => { if (e.pointerId === idPalanca) moverPalanca(e); });
  const soltarPalanca = (e: PointerEvent) => { if (e.pointerId !== idPalanca) return; idPalanca = -1; jugador.palanca.set(0, 0); pomo.style.transform = ''; };
  palanca.addEventListener('pointerup', soltarPalanca); palanca.addEventListener('pointercancel', soltarPalanca);

  // Mirar arrastrando sobre la escena (cualquier dedo que no esté en un control).
  let idMirar = -1, ux = 0, uy = 0;
  lienzo.addEventListener('pointerdown', e => { if (!jugador.activo || idMirar !== -1) return; idMirar = e.pointerId; ux = e.clientX; uy = e.clientY; lienzo.setPointerCapture(e.pointerId); });
  lienzo.addEventListener('pointermove', e => { if (e.pointerId !== idMirar) return; jugador.girar((e.clientX - ux) * 2.4, (e.clientY - uy) * 2.4); ux = e.clientX; uy = e.clientY; });
  const soltarMirar = (e: PointerEvent) => { if (e.pointerId === idMirar) idMirar = -1; };
  lienzo.addEventListener('pointerup', soltarMirar); lienzo.addEventListener('pointercancel', soltarMirar);

  // Botones. «Mantener» equivale a mantener el clic izquierdo; se suelta al levantar el dedo.
  const toque = (k: string, f: () => void) => el(k).addEventListener('pointerdown', e => { e.preventDefault(); if (jugador.activo) f(); });
  toque('usar', () => acciones.usar(true, true));
  toque('dejar', acciones.dejar);
  toque('mano1', () => acciones.mano('left'));
  toque('mano2', () => acciones.mano('right'));
  toque('misiones', acciones.misiones);
  toque('cuaderno', acciones.cuaderno);
  toque('pistas', acciones.pistas);
  toque('pausa', acciones.pausa);
  const verter = el('verter');
  verter.addEventListener('pointerdown', e => { e.preventDefault(); if (!jugador.activo) return; verter.setPointerCapture(e.pointerId); verter.classList.add('pulsado'); acciones.usar(true, false); });
  const soltarVerter = () => { verter.classList.remove('pulsado'); acciones.usar(false, false); };
  verter.addEventListener('pointerup', soltarVerter); verter.addEventListener('pointercancel', soltarVerter);
  capa.addEventListener('contextmenu', e => e.preventDefault());
  return { marcarMano: (m: Hand) => { el('mano1').classList.toggle('activa', m === 'left'); el('mano2').classList.toggle('activa', m === 'right'); } };
}
