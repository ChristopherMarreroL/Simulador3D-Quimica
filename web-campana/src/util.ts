import * as THREE from 'three';

/** Posición de Unreal (cm, Z arriba) → three.js (m, Y arriba). Es la misma conversión que hace el GLB de la sala. */
export const ue = (x: number, y: number, z: number) => new THREE.Vector3(x / 100, z / 100, y / 100);

/** Altura de la encimera de la estación (EN 13150, de pie). */
export const ENCIMERA = 0.9;
export const OJOS = 1.65;

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const mezclar = (a: number, b: number, t: number) => a + (b - a) * t;
export const suave = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };

/** Calidad gráfica: los mismos tres niveles que el menú de pausa de Unreal. */
export type Calidad = 'baja' | 'media' | 'alta';
const CLAVE_CALIDAD = 'experimenta.campana.calidad';
export function leerCalidad(defecto: Calidad = 'media'): Calidad {
  const url = new URLSearchParams(location.search).get('calidad');
  if (url === 'baja' || url === 'media' || url === 'alta') return url;
  try { const v = localStorage.getItem(CLAVE_CALIDAD); if (v === 'baja' || v === 'media' || v === 'alta') return v; } catch { /* sin almacenamiento */ }
  return defecto;
}
export function guardarCalidad(c: Calidad) { try { localStorage.setItem(CLAVE_CALIDAD, c); } catch { /* sin almacenamiento */ } }
export const PERFILES: Record<Calidad, { escala: number; msaa: boolean; anisotropia: number; entorno: number; texto: string }> = {
  baja: { escala: 0.75, msaa: false, anisotropia: 2, entorno: 128, texto: 'Baja · 75 % de resolución, sin antialiasing' },
  media: { escala: 1, msaa: true, anisotropia: 4, entorno: 256, texto: 'Media · resolución completa, MSAA' },
  alta: { escala: 1.5, msaa: true, anisotropia: 8, entorno: 256, texto: 'Alta · supermuestreo hasta 1,5×, MSAA' },
};

/** Textura de texto para rótulos (frascos, recipientes, carteles). */
export function rotulo(lineas: string[], opciones: { ancho?: number; alto?: number; fondo?: string; color?: string; tam?: number; borde?: string } = {}) {
  const ancho = opciones.ancho ?? 256, alto = opciones.alto ?? 128;
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho; lienzo.height = alto;
  const c = lienzo.getContext('2d')!;
  c.fillStyle = opciones.fondo ?? '#f4f2ea'; c.fillRect(0, 0, ancho, alto);
  if (opciones.borde) { c.strokeStyle = opciones.borde; c.lineWidth = 6; c.strokeRect(5, 5, ancho - 10, alto - 10); }
  c.fillStyle = opciones.color ?? '#1d1f24'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const tam = opciones.tam ?? 34;
  lineas.forEach((l, i) => {
    c.font = `${i === 0 ? 700 : 500} ${i === 0 ? tam : tam * 0.68}px "Segoe UI", Arial, sans-serif`;
    c.fillText(l, ancho / 2, alto / 2 + (i - (lineas.length - 1) / 2) * tam * 1.05);
  });
  const t = new THREE.CanvasTexture(lienzo);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
