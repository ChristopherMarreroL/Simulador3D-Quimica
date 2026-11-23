import * as THREE from 'three';
import perfiles from '../../art/export/perfiles_interiores.json';

/**
 * Líquido con el volumen exacto dentro de un recipiente: el perfil interior (radio, altura en mm, desde el fondo) lo
 * exporta art/blender/cristaleria_cloruros.py, el mismo que usa ULiquidoComponent en Unreal. La altura del nivel
 * se obtiene integrando troncos de cono, así que 20 mL en la probeta quedan en la marca de 20 mL.
 */
export type Perfil = [number, number][];
export const perfil = (nombre: keyof typeof perfiles) => perfiles[nombre] as Perfil;

function volumenHasta(p: Perfil, h: number) {
  let v = 0;
  for (let i = 1; i < p.length; i++) {
    const [r0, h0] = p[i - 1], [r1, h1] = p[i];
    if (h1 <= h0) continue;
    const top = Math.min(h, h1);
    if (top <= h0) break;
    const r = r0 + (r1 - r0) * (top - h0) / (h1 - h0);
    v += Math.PI * (top - h0) * (r0 * r0 + r0 * r + r * r) / 3;
    if (h <= h1) break;
  }
  return v / 1000; // mm³ → mL
}

export function alturaPara(p: Perfil, ml: number) {
  const fondo = p[0][1];
  let a = fondo, b = p[p.length - 1][1];
  if (ml <= 0) return fondo;
  if (volumenHasta(p, b) <= ml) return b;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (volumenHasta(p, m) < ml) a = m; else b = m; }
  return (a + b) / 2;
}

function radioEn(p: Perfil, h: number) {
  for (let i = 1; i < p.length; i++) {
    const [r0, h0] = p[i - 1], [r1, h1] = p[i];
    if (h >= h0 && h <= h1 && h1 > h0) return r0 + (r1 - r0) * (h - h0) / (h1 - h0);
  }
  return p[p.length - 1][0];
}

/** Malla de revolución del líquido entre las alturas `desde` y `hasta` (mL). Se rehace solo si cambia el nivel. */
export class Liquido {
  readonly malla: THREE.Mesh;
  private clave = '';
  constructor(private p: Perfil, material: THREE.Material, private reduccion = 0.6) {
    this.malla = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.malla.visible = false;
    this.malla.renderOrder = 2;
    this.malla.userData.sinContorno = true;
  }
  fijar(mlDesde: number, mlHasta: number) {
    const clave = `${mlDesde.toFixed(2)}:${mlHasta.toFixed(2)}`;
    if (clave === this.clave) return;
    this.clave = clave;
    if (mlHasta - mlDesde < 0.05) { this.malla.visible = false; return; }
    const h0 = alturaPara(this.p, mlDesde), h1 = alturaPara(this.p, mlHasta);
    const puntos: THREE.Vector2[] = [new THREE.Vector2(0, h0)];
    const encoge = (r: number) => Math.max(0, r - this.reduccion);   // el líquido no toca la cara interior del vidrio
    puntos.push(new THREE.Vector2(encoge(radioEn(this.p, h0)), h0));
    for (const [r, h] of this.p) if (h > h0 + 0.01 && h < h1 - 0.01) puntos.push(new THREE.Vector2(encoge(r), h));
    puntos.push(new THREE.Vector2(encoge(radioEn(this.p, h1)), h1));
    puntos.push(new THREE.Vector2(0, h1));
    const g = new THREE.LatheGeometry(puntos.map(v => v.multiplyScalar(0.001)), 40);
    this.malla.geometry.dispose();
    this.malla.geometry = g;
    this.malla.visible = true;
  }
}
