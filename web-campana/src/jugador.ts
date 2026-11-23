import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import manoIUrl from '../../art/export/SM_Hand_L.glb?url';
import manoDUrl from '../../art/export/SM_Hand_R.glb?url';
import { useHood, type Hand } from '../../src/state/hood';
import { useLab } from '../../src/state/lab';
import { clamp, mezclar, OJOS, ue } from './util';

/**
 * Jugador en primera persona, como AExpPersonaje: ojos a 1,65 m, WASD y ratón, Mayús para acelerar, puntería por
 * rayo con alcance limitado y oclusión, y dos manos (art/blender/manos.py) que pasan a guante de nitrilo al ponérselos.
 */
const RADIO = 0.28;
const ALCANCE = 2.3;
// Obstáculos en planta (x, z de three): la estación, el recipiente de residuos y la sala.
const SALA = { x0: -6, x1: 6, z0: -0.46, z1: 8.54 };
// Bancos del fondo con la estación, banco de lavabos y las cuatro mesetas (medidas de art/blender/web_laboratorio_hornear.py).
const ISLAS = [[-3.0, 3.3], [1.5, 3.3], [-3.0, 6.2], [1.5, 6.2]];
const CAJAS = [
  { x0: -4.5, x1: 4.5, z0: -0.46, z1: 0.49 }, { x0: 5.07, x1: 6, z0: 1.1, z1: 6.5 },
  ...ISLAS.map(([x, z]) => ({ x0: x - 1.5, x1: x + 1.5, z0: z - 0.6, z1: z + 0.6 })),
  { x0: -5.6, x1: -2.4, z0: 8.09, z1: 8.54 }, { x0: 4.75, x1: 5.97, z0: 8.09, z1: 8.54 },     // armarios de almacén y de seguridad
  { x0: -0.8, x1: 0.6, z0: 7.24, z1: 8.54 }, { x0: 5.38, x1: 6, z0: 0.3, z1: 0.95 }, { x0: -5.9, x1: -5.22, z0: 4.32, z1: 4.98 },   // escritorio, nevera, carrito
];
const CIRCULOS = [
  { x: 4.8, z: 0.3, r: 0.15 }, { x: -5.25, z: -0.36, r: 0.06 }, { x: 4.5, z: 8.44, r: 0.1 }, { x: -5.83, z: 3.04, r: 0.27 }, { x: 4.9, z: 6.72, r: 0.14 }, { x: 2.68, z: 8.36, r: 0.14 },
  ...ISLAS.flatMap(([x, z]) => [-0.75, 0.75].flatMap(dx => [-0.84, 0.84].map(dz => ({ x: x + dx, z: z + dz, r: 0.17 })))),   // taburetes
];

export class Jugador {
  readonly camara: THREE.PerspectiveCamera;
  readonly anclas: Record<Hand, THREE.Object3D> = { left: new THREE.Object3D(), right: new THREE.Object3D() };
  private manos: Record<Hand, THREE.Group> = { left: new THREE.Group(), right: new THREE.Group() };
  private guante: THREE.MeshStandardMaterial[] = [];
  private guinada: number;
  private cabeceo = -0.08;
  private teclas = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private paso = 0;
  private mirarCerca = false;
  private gesto: Record<Hand, number> = { left: 0, right: 0 };
  sensibilidad = 0.0022;
  vertiendoMano: Hand | null = null;

  constructor(aspecto: number) {
    this.camara = new THREE.PerspectiveCamera(68, aspecto, 0.03, 80);
    // Inicio del jugador de Unreal: (150, 300) mirando a -118°, hacia la estación.
    this.camara.position.copy(ue(400, 770, 0)).setY(OJOS);
    this.guinada = Math.atan2(0.5, 0.87);   // desde la puerta, mirando hacia la campana
    this.camara.rotation.order = 'YXZ';
    this.aplicarVista();
  }

  async cargarManos() {
    const cargador = new GLTFLoader();
    const [izq, der] = await Promise.all([cargador.loadAsync(manoIUrl), cargador.loadAsync(manoDUrl)]);
    const piel = new THREE.Color().setRGB(0.48, 0.30, 0.22), bata = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.72, 0.73, 0.74), roughness: 0.92 });
    for (const [lado, gltf] of [['left', izq], ['right', der]] as const) {
      const m = gltf.scene.children[0].clone(true);
      const g = new THREE.MeshStandardMaterial({ color: piel.clone(), roughness: 0.55 });
      this.guante.push(g);
      m.position.set(0, 0, 0);
      m.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        const lista = Array.isArray(o.material) ? o.material : [o.material];
        const nuevos = lista.map((x: THREE.Material) => x.name === 'M_LabCoat' ? bata : g);
        o.material = Array.isArray(o.material) ? nuevos : nuevos[0];
        o.renderOrder = 6;
      });
      const s = lado === 'left' ? -1 : 1;
      // La malla de manos.py tiene la muñeca en el origen y los dedos hacia +X: se gira para que apunten adelante.
      m.rotation.set(0, s > 0 ? Math.PI / 2 : Math.PI / 2, 0);
      this.manos[lado].add(m);
      this.anclas[lado].position.set(-s * 0.035, -0.085, -0.075);
      this.manos[lado].add(this.anclas[lado]);
      this.manos[lado].position.set(s * 0.2, -0.24, -0.36);
      this.camara.add(this.manos[lado]);
    }
  }

  conectar(elemento: HTMLElement, acciones: { usar: (pulsado: boolean, tecla: boolean) => void; dejar: () => void; mano: (m: Hand) => void; anotar: () => void; misiones: () => void; pistas: () => void; pausa: () => void }) {
    document.addEventListener('keydown', e => {
      if (document.pointerLockElement !== elemento) return;
      if (e.repeat) { if (e.code !== 'KeyE') this.teclas.add(e.code); return; }
      this.teclas.add(e.code);
      if (e.code === 'KeyE') acciones.usar(true, true);
      else if (e.code === 'KeyQ') acciones.dejar();
      else if (e.code === 'Digit1') acciones.mano('left');
      else if (e.code === 'Digit2') acciones.mano('right');
      else if (e.code === 'KeyN') acciones.anotar();
      else if (e.code === 'KeyM') acciones.misiones();
      else if (e.code === 'KeyH') acciones.pistas();
      else if (e.code === 'KeyP') acciones.pausa();
    });
    document.addEventListener('keyup', e => { this.teclas.delete(e.code); });
    elemento.addEventListener('mousedown', e => {
      if (document.pointerLockElement !== elemento) return;
      if (e.button === 0) acciones.usar(true, false);
      if (e.button === 2) this.mirarCerca = true;
    });
    document.addEventListener('mouseup', e => { if (e.button === 0) acciones.usar(false, false); if (e.button === 2) this.mirarCerca = false; });
    elemento.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== elemento) return;
      this.guinada -= e.movementX * this.sensibilidad;
      this.cabeceo = clamp(this.cabeceo - e.movementY * this.sensibilidad, -1.45, 1.35);
    });
    window.addEventListener('blur', () => this.teclas.clear());
  }

  private aplicarVista() { this.camara.rotation.set(this.cabeceo, this.guinada, 0); }

  /** Orienta la vista hacia un punto (recorrido automático). */
  mirarA(p: THREE.Vector3) {
    const d = p.clone().sub(this.camara.position);
    this.guinada = Math.atan2(-d.x, -d.z);
    this.cabeceo = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.aplicarVista();
  }
  colocar(x: number, z: number) { this.camara.position.set(x, OJOS, z); }

  private libre(x: number, z: number) {
    if (x < SALA.x0 + RADIO || x > SALA.x1 - RADIO || z < SALA.z0 + RADIO || z > SALA.z1 - RADIO) return false;
    for (const c of CAJAS) if (x > c.x0 - RADIO && x < c.x1 + RADIO && z > c.z0 - RADIO && z < c.z1 + RADIO) {
      const dx = Math.max(c.x0 - x, 0, x - c.x1), dz = Math.max(c.z0 - z, 0, z - c.z1);
      if (dx * dx + dz * dz < RADIO * RADIO) return false;
    }
    for (const c of CIRCULOS) if (Math.hypot(x - c.x, z - c.z) < RADIO + c.r) return false;
    return true;
  }

  actualizar(dt: number, ocupado: boolean) {
    // Movimiento con deslizamiento por los obstáculos, en pasos cortos (sin atravesar ni empujar hacia atrás).
    let ax = 0, az = 0;
    if (!ocupado) {
      if (this.teclas.has('KeyW') || this.teclas.has('ArrowUp')) az -= 1;
      if (this.teclas.has('KeyS') || this.teclas.has('ArrowDown')) az += 1;
      if (this.teclas.has('KeyA') || this.teclas.has('ArrowLeft')) ax -= 1;
      if (this.teclas.has('KeyD') || this.teclas.has('ArrowRight')) ax += 1;
    }
    const largo = Math.hypot(ax, az);
    const velocidad = (this.teclas.has('ShiftLeft') || this.teclas.has('ShiftRight') ? 2.6 : 1.45);
    if (largo > 0) {
      const s = Math.sin(this.guinada), c = Math.cos(this.guinada);
      const vx = (ax * c + az * s) / largo * velocidad * dt, vz = (-ax * s + az * c) / largo * velocidad * dt;
      const pasos = Math.max(1, Math.ceil(Math.hypot(vx, vz) / 0.03));
      const p = this.camara.position;
      for (let i = 0; i < pasos; i++) {
        if (this.libre(p.x + vx / pasos, p.z + vz / pasos)) { p.x += vx / pasos; p.z += vz / pasos; }
        else if (this.libre(p.x + vx / pasos, p.z)) p.x += vx / pasos;
        else if (this.libre(p.x, p.z + vz / pasos)) p.z += vz / pasos;
      }
      this.paso += dt * velocidad * 5.5;
    }
    this.camara.position.y = OJOS + (largo > 0 ? Math.sin(this.paso) * 0.012 : 0);
    this.aplicarVista();
    this.camara.fov = mezclar(this.camara.fov, this.mirarCerca ? 34 : 68, 1 - Math.exp(-dt * 10));
    this.camara.updateProjectionMatrix();

    // Manos: balanceo al caminar, guante tras ponérselo, gesto de verter con la mano que sostiene el frasco.
    const lab = useLab.getState(), hood = useHood.getState();
    const piel = new THREE.Color().setRGB(0.48, 0.30, 0.22), nitrilo = new THREE.Color().setRGB(0.035, 0.13, 0.55);
    this.guante.forEach(g => g.color.copy(lab.ppe.gloves ? nitrilo : piel));
    for (const lado of ['left', 'right'] as const) {
      const s = lado === 'left' ? -1 : 1;
      const sostiene = !!hood.heldIn(lado);
      const objetivoGesto = this.vertiendoMano === lado ? 1 : 0;
      this.gesto[lado] = mezclar(this.gesto[lado], objetivoGesto, 1 - Math.exp(-dt * 8));
      const g = this.gesto[lado];
      const activa = lab.hand === lado;
      const m = this.manos[lado];
      m.position.set(s * mezclar(0.2, 0.08, g), -0.24 + (activa ? 0.02 : 0) + Math.sin(this.paso + (s > 0 ? 0 : Math.PI)) * 0.006 + g * 0.08, mezclar(sostiene ? -0.38 : -0.34, -0.46, g));
      m.rotation.set(g * 0.2, 0, -s * g * 1.9);
    }
  }

  /** Objetivo bajo el punto de mira: primera zona que no tape un oclusor (paredes, muebles). */
  apuntar(zonas: THREE.Object3D[], oclusores: THREE.Object3D[]) {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camara);
    this.raycaster.far = ALCANCE;
    const zonasVisibles = zonas.filter(z => z.visible && z.parent && (z.parent.visible ?? true));
    const golpes = this.raycaster.intersectObjects(zonasVisibles, false);
    if (!golpes.length) return null;
    // La estantería y la bandeja envuelven sus frascos: si el rayo también toca un frasco cerca, manda el frasco.
    const contenedor = (g: THREE.Intersection) => ['reagent-shelf', 'hood-tray'].includes(g.object.userData.objetivo);
    const golpe = contenedor(golpes[0]) ? golpes.find(g => !contenedor(g) && g.distance < golpes[0].distance + 0.3) ?? golpes[0] : golpes[0];
    const muro = this.raycaster.intersectObjects(oclusores, false)[0];
    if (muro && muro.distance + 0.02 < golpe.distance) return null;
    // Una zona de un objeto que está en la mano no cuenta como objetivo.
    let p: THREE.Object3D | null = golpe.object;
    while (p) { if (p === this.anclas.left || p === this.anclas.right) return null; p = p.parent; }
    return golpe.object.userData.objetivo as string;
  }
}
