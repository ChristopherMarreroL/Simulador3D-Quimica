import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { analyzeMixture } from '../../src/chemistry/sandbox';
import { categoryColors, reagents, shelfRows, type ReagentId } from '../../src/chemistry/reagents';
import { POUR_MS, useHood, type Hand } from '../../src/state/hood';
import { useLab } from '../../src/state/lab';
import { Liquido, perfil } from './liquido';
import { clamp, mezclar, rotulo, suave, ue } from './util';

/**
 * Objetos del juego, con los mismos identificadores de objetivo que la web y que AExpObjeto en Unreal. Cada fotograma
 * leen la capa de estado (useHood/useLab): dónde está cada frasco, cuánto hay en la probeta y en la balanza, qué hay
 * en el matraz y en qué punto va la transferencia. Aquí no hay química: el aspecto del precipitado sigue a
 * UMezclaComponent. Lo ambiental (mecheros, grifos, ducha, material expuesto) se distingue con el prefijo «amb:».
 */
const modelos = import.meta.glob('../../art/export/SM_*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const url = (nombre: string) => { const u = modelos[`../../art/export/${nombre}.glb`]; if (!u) throw new Error('Falta el modelo ' + nombre); return u; };

export const NOMBRES: Record<string, string> = {
  'reagent-shelf': 'Estantería de reactivos', 'hood-tray': 'Bandeja de la campana', hood: 'Matraz Erlenmeyer de 500 mL',
  'hood-cylinder': 'Probeta de 100 mL', 'hood-balance': 'Balanza con navecilla', 'hood-washbottle': 'Piseta de agua destilada',
  'hood-waste': 'Recipiente de residuos', 'ppe-goggles': 'Gafas de seguridad', 'ppe-gloves': 'Guantes de nitrilo',
  'recipe-board': 'Tablero de misiones', 'amb:ducha': 'Ducha de emergencia y lavaojos', 'amb:extintor': 'Extintor',
  'amb:aire': 'Aire acondicionado', 'amb:material': 'Material de vidrio y porcelana', 'amb:armarios': 'Almacén de material',
  'amb:inflamables': 'Armario de inflamables', 'amb:corrosivos': 'Armario de corrosivos', 'amb:nevera': 'Nevera de reactivos',
  'amb:bombonas': 'Bombonas de gas', 'amb:botiquin': 'Botiquín', 'amb:tabla': 'Tabla periódica',
};

const POS_MATRAZ = ue(-38, 6, 90), POS_PROBETA = ue(-62, 14, 90), POS_PISETA = ue(-80, -12, 90), POS_RESIDUOS = ue(480, 30, 0), POS_BALANZA = ue(-8, 14, 90);
/** Estantería de 4 × 7: la fila 0 de shelfRows (indicadores) va arriba. */
const estante = (id: ReagentId) => { const f = shelfRows.findIndex(r => r.includes(id)), c = shelfRows[f].indexOf(id); return ue(130 + c * 42, -34, 190 - f * 30); };
const bandeja = (i: number) => ue(-10 + (i % 4) * 10.5, i < 4 ? -27 : -17, 91);
const FORMA = { bottle: { alto: 0.18, radio: 0.048, enMano: 0 }, jar: { alto: 0.09, radio: 0.04, enMano: 0.05 }, dropper: { alto: 0.075, radio: 0.028, enMano: 0.06 } } as const;

/** Vidrio barato para PC modestos: casi transparente en el centro y reflectante en el borde (Fresnel), sin pase de transmisión. */
export function vidrio(color: THREE.ColorRepresentation, opacidad = 0.07) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.04, metalness: 0, transparent: true, opacity: opacidad, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 });
  m.onBeforeCompile = s => {
    s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>',
      'float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.5);\n\tdiffuseColor.a = mix(diffuseColor.a, 0.75, fres);\n\t#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'vidrioFresnel';
  return m;
}
const liquidoMat = (color: THREE.ColorRepresentation, opacidad: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.08, transparent: true, opacity: opacidad, depthWrite: false, envMapIntensity: 1.2 });

/** Contorno dorado al apuntar (como M_Exp_Contorno): Fresnel aditivo sobre la misma geometría. */
const contornoMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { t: { value: 0 } },
  vertexShader: 'varying vec3 n; varying vec3 v; void main(){ vec4 p = modelViewMatrix * vec4(position,1.0); n = normalize(normalMatrix * normal); v = -p.xyz; gl_Position = projectionMatrix * p; }',
  fragmentShader: 'uniform float t; varying vec3 n; varying vec3 v; void main(){ float f = pow(1.0 - abs(dot(normalize(n), normalize(v))), 2.2); gl_FragColor = vec4(vec3(1.0, 0.68, 0.18) * f * (0.75 + 0.25 * sin(t * 5.0)), 1.0); }',
});

function sombraTextura() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!; const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(0.55, 'rgba(0,0,0,0.25)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const sombraMat = new THREE.MeshBasicMaterial({ map: sombraTextura(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const sombraGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function sombra(radio: number) {
  const m = new THREE.Mesh(sombraGeo, sombraMat);
  m.scale.setScalar(radio * 2); m.position.y = 0.0015; m.renderOrder = 1; m.userData.sinContorno = true; m.userData.sombra = true;
  return m;
}

interface Objeto { grupo: THREE.Object3D; contorno: THREE.Object3D[]; zona: THREE.Mesh }
export interface DatosLab { islas: [number, number][]; lavabos: number[] }

export class Objetos {
  readonly raiz = new THREE.Group();
  /** Cajas invisibles para la puntería, con `userData.objetivo`. */
  readonly zonas: THREE.Mesh[] = [];
  private objetos = new Map<string, Objeto>();
  private frascos = new Map<ReagentId, THREE.Group>();
  private marcas = new Map<string, THREE.Sprite>();
  private chorro: THREE.Mesh;
  private liquidoProbeta!: Liquido;
  private liquidoMatraz!: Liquido;
  private sedimento!: Liquido;
  private matMatraz = liquidoMat(0xcfe6ee, 0.3);
  private matChorro = liquidoMat(0xe8f2f4, 0.6);
  private probeta = new THREE.Group();
  private matraz = new THREE.Group();
  private piseta = new THREE.Group();
  private gafas = new THREE.Group();
  private guantes = new THREE.Group();
  private navecilla = new THREE.Group();
  private monton!: THREE.Mesh;
  private pantalla!: { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D; texto: string };
  private burbujas!: THREE.Points;
  private llamas: { malla: THREE.Mesh; encendida: boolean }[] = [];
  private grifos: { agua: THREE.Mesh; abierto: boolean }[] = [];
  private ducha!: THREE.Mesh;
  private duchaHasta = 0;
  // Aspecto del precipitado (UMezclaComponent): sólido del modelo = suspensión + sedimento.
  private suspendidoG = 0; private solidoPrevioG = 0;
  analisis = analyzeMixture(useHood.getState().mixture);

  private constructor() {
    this.chorro = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0035, 1, 8, 1, true), this.matChorro);
    this.chorro.visible = false; this.chorro.renderOrder = 2;
    this.raiz.add(this.chorro);
  }

  static async crear(datos: DatosLab) {
    const o = new Objetos();
    await o.montar(datos);
    return o;
  }

  private zona(objetivo: string, tam: [number, number, number], centro: THREE.Vector3, padre: THREE.Object3D) {
    const z = new THREE.Mesh(new THREE.BoxGeometry(...tam), new THREE.MeshBasicMaterial({ visible: false }));
    z.position.copy(centro); z.userData.objetivo = objetivo;
    padre.add(z); this.zonas.push(z);
    return z;
  }

  private registrar(objetivo: string, grupo: THREE.Object3D, zona: THREE.Mesh) {
    const contorno: THREE.Object3D[] = [];
    const mallas: THREE.Mesh[] = [];
    grupo.traverse(m => { if (m instanceof THREE.Mesh && m !== zona && !m.userData.sinContorno) mallas.push(m); });
    for (const m of mallas) {
      const c = new THREE.Mesh(m.geometry, contornoMat); c.visible = false; c.renderOrder = 9; c.userData.sinContorno = true;
      m.add(c); contorno.push(c);
    }
    this.objetos.set(objetivo, { grupo, contorno, zona });
  }

  private async montar(datos: DatosLab) {
    const cargador = new GLTFLoader();
    const nombres = ['SM_ReagentBottle_500', 'SM_Cap_GL45', 'SM_Liquid_Bottle500_400mL', 'SM_ReagentJar_250', 'SM_DropperBottle_30', 'SM_Erlenmeyer_500',
      'SM_GradCylinder_100', 'SM_WashBottle_500', 'SM_WeighBoat', 'SM_Bunsen', 'SM_Faucet', 'SM_Beaker_50', 'SM_Beaker_100', 'SM_Beaker_250', 'SM_Beaker_500',
      'SM_Erlenmeyer_250', 'SM_VolFlask_100', 'SM_VolFlask_250', 'SM_GradCylinder_10', 'SM_GradCylinder_50', 'SM_Funnel', 'SM_Mortar', 'SM_Pestle',
      'SM_WatchGlass', 'SM_TestTubeRack', 'SM_TestTube', 'SM_Thermometer', 'SM_StirRod', 'SM_Pipette_10'] as const;
    // Casi todo se carga en su versión ligera (art/blender/web_modelos_ligeros.py); lo que se usa de cerca en la campana, completo.
    const completos = new Set(['SM_Erlenmeyer_500', 'SM_GradCylinder_100', 'SM_WeighBoat', 'SM_Bunsen', 'SM_Faucet']);
    const cargados = await Promise.all(nombres.map(n => cargador.loadAsync(completos.has(n) ? url(n) : `${import.meta.env.BASE_URL}ligeros/${n}.glb`)));
    const glb = Object.fromEntries(nombres.map((n, i) => [n, cargados[i].scene.children[0]])) as Record<typeof nombres[number], THREE.Object3D>;
    const malla = (n: typeof nombres[number]) => { const c = glb[n].clone(true); c.position.set(0, 0, 0); return c; };
    const pintar = (o: THREE.Object3D, mat: THREE.Material, orden = 2) => { o.traverse(m => { if (m instanceof THREE.Mesh) { m.material = mat; m.renderOrder = orden; } }); return o; };
    const claro = vidrio(0xf2f8f8), ambar = vidrio(0x6b3a10, 0.42), graduacion = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
    const tapaMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.03, 0.18, 0.62), roughness: 0.45 });
    const hdpe = new THREE.MeshStandardMaterial({ color: 0xe9ebe6, roughness: 0.38 });
    const negro = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.4 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.3, metalness: 0.85 });
    const porcelana = new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.25 });
    const porNombre: Record<string, THREE.Material> = { M_Graduacion: graduacion, M_Cap_PP_Blue: tapaMat, M_HDPE: hdpe, M_Black: negro, M_Metal: metal, M_Porcelain: porcelana, M_Glass_Amber: ambar };
    const asignar = (o: THREE.Object3D, defecto: THREE.Material = claro) => {
      o.traverse(m => {
        if (!(m instanceof THREE.Mesh)) return;
        const lista = Array.isArray(m.material) ? m.material : [m.material];
        const nuevos = lista.map((x: THREE.Material) => porNombre[x.name] ?? defecto);
        m.material = Array.isArray(m.material) ? nuevos : nuevos[0];
        m.renderOrder = nuevos.some((x: THREE.Material) => x.transparent) ? 3 : 0;
      });
      return o;
    };

    // Los 27 reactivos del modelo: frasco de 500 mL (ámbar si es fotosensible), tarro para sólidos, gotero para indicadores.
    for (const id of shelfRows.flat()) {
      const r = reagents[id]; const f = FORMA[r.look.shape];
      const g = new THREE.Group(); g.name = 'Frasco_' + id; g.userData.forma = r.look.shape;
      if (r.look.shape === 'bottle') {
        g.add(asignar(malla('SM_ReagentBottle_500'), r.look.glass === 'amber' ? ambar : claro));
        const liq = pintar(malla('SM_Liquid_Bottle500_400mL'), liquidoMat(r.look.contents, r.look.glass === 'amber' ? 0.3 : 0.55)); liq.scale.setScalar(0.985); g.add(liq);
        const t = pintar(malla('SM_Cap_GL45'), tapaMat, 0); t.position.y = 0.155; g.add(t);
      } else if (r.look.shape === 'jar') {
        g.add(asignar(malla('SM_ReagentJar_250'), hdpe));
        const banda = new THREE.Mesh(new THREE.CylinderGeometry(0.0312, 0.0312, 0.012, 24, 1, true), new THREE.MeshStandardMaterial({ color: r.look.contents, roughness: 0.6 }));
        banda.position.y = 0.012; g.add(banda);
      } else g.add(asignar(malla('SM_DropperBottle_30'), r.look.glass === 'amber' ? ambar : vidrio(r.look.contents, 0.5)));
      const corto = r.formula.split(' (')[0].split(' · ')[0];
      const lineas = r.kind === 'indicator' ? [r.name.split(' ').slice(-1)[0].slice(0, 12)] : [corto, r.kind === 'solution' ? `${String(r.concentration).replace('.', ',')} M` : r.kind === 'solid' ? 'sólido' : 'destilada'];
      const ancho = Math.min(0.052, f.radio * 1.15), alto = Math.min(0.034, f.alto * 0.42);
      const et = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshStandardMaterial({ map: rotulo(lineas, { alto: Math.round(256 * alto / ancho), fondo: '#f6f5ef', borde: categoryColors[r.category], tam: lineas[0].length > 7 ? 34 : 44 }), roughness: 0.6 }));
      et.position.set(0, f.alto * (r.look.shape === 'bottle' ? 0.42 : 0.5), (r.look.shape === 'bottle' ? 0.0405 : r.look.shape === 'jar' ? 0.0318 : 0.0185)); et.renderOrder = 4; et.userData.sinContorno = true; g.add(et);
      g.add(sombra(f.radio * 1.3));
      const z = this.zona('reagent:' + id, [f.radio * 2, f.alto, f.radio * 2], new THREE.Vector3(0, f.alto / 2, 0), g);
      this.raiz.add(g); this.frascos.set(id, g); this.registrar('reagent:' + id, g, z);
    }

    // Matraz de 500 mL con líquido, sedimento y burbujas.
    this.matraz.position.copy(POS_MATRAZ);
    this.matraz.add(asignar(malla('SM_Erlenmeyer_500')));
    this.liquidoMatraz = new Liquido(perfil('SM_Erlenmeyer_500'), this.matMatraz);
    this.sedimento = new Liquido(perfil('SM_Erlenmeyer_500'), new THREE.MeshStandardMaterial({ color: 0xf4f4ef, roughness: 0.9 }), 0.8);
    this.sedimento.malla.renderOrder = 1;
    const n = 48, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = Math.random(); pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random(); }
    this.burbujas = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.006, transparent: true, opacity: 0.8, depthWrite: false }));
    this.burbujas.userData.semilla = pos.slice(); this.burbujas.visible = false; this.burbujas.renderOrder = 3; this.burbujas.frustumCulled = false;
    this.matraz.add(this.liquidoMatraz.malla, this.sedimento.malla, this.burbujas, sombra(0.09));
    this.registrar('hood', this.matraz, this.zona('hood', [0.13, 0.2, 0.13], new THREE.Vector3(0, 0.1, 0), this.matraz));
    // Probeta de 100 mL y piseta.
    this.probeta.position.copy(POS_PROBETA);
    this.probeta.add(asignar(malla('SM_GradCylinder_100')));
    this.liquidoProbeta = new Liquido(perfil('SM_GradCylinder_100'), liquidoMat(0xe8f1f3, 0.45), 0.4);
    this.probeta.add(this.liquidoProbeta.malla, sombra(0.05));
    this.registrar('hood-cylinder', this.probeta, this.zona('hood-cylinder', [0.09, 0.27, 0.09], new THREE.Vector3(0, 0.13, 0), this.probeta));
    this.piseta.position.copy(POS_PISETA);
    this.piseta.add(asignar(malla('SM_WashBottle_500'), hdpe), sombra(0.06));
    this.registrar('hood-washbottle', this.piseta, this.zona('hood-washbottle', [0.1, 0.22, 0.1], new THREE.Vector3(0, 0.11, 0), this.piseta));
    // Balanza con navecilla y pantalla (lee la capa de estado).
    const balanza = new THREE.Group(); balanza.position.copy(POS_BALANZA);
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.24), new THREE.MeshStandardMaterial({ color: 0xdfe1e3, roughness: 0.35 })); cuerpo.position.y = 0.0225;
    const plato = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.006, 40), metal); plato.position.set(0, 0.052, -0.02);
    const lienzo = document.createElement('canvas'); lienzo.width = 256; lienzo.height = 64;
    this.pantalla = { tex: new THREE.CanvasTexture(lienzo), ctx: lienzo.getContext('2d')!, texto: '' };
    this.pantalla.tex.colorSpace = THREE.SRGBColorSpace;
    const visor = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.022), new THREE.MeshBasicMaterial({ map: this.pantalla.tex })); visor.position.set(0, 0.022, 0.1205); visor.userData.sinContorno = true;
    this.navecilla.add(asignar(malla('SM_WeighBoat'), hdpe));
    this.monton = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
    this.monton.position.y = 0.004; this.monton.userData.sinContorno = true; this.navecilla.add(this.monton);
    this.navecilla.position.set(0, 0.055, -0.02);
    balanza.add(cuerpo, plato, visor, this.navecilla, sombra(0.16));
    this.registrar('hood-balance', balanza, this.zona('hood-balance', [0.2, 0.1, 0.24], new THREE.Vector3(0, 0.05, 0), balanza));

    // Protección junto a la puerta: gafas y caja de guantes.
    this.gafas.position.copy(ue(592, 720, 129));
    const montura = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.17), negro); montura.position.y = 0.03;
    const visorGafas = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.045, 0.16), vidrio(0xdfe8f0, 0.25)); visorGafas.position.set(-0.026, 0.03, 0);
    this.gafas.add(montura, visorGafas);
    this.registrar('ppe-goggles', this.gafas, this.zona('ppe-goggles', [0.14, 0.12, 0.2], new THREE.Vector3(0, 0.04, 0), this.gafas));
    this.guantes.position.copy(ue(592, 770, 129));
    const caja = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.24), new THREE.MeshStandardMaterial({ map: rotulo(['NITRILO · M', 'Guantes de examen'], { fondo: '#e9ecf2', color: '#14306e', tam: 38 }), roughness: 0.7 }));
    caja.position.y = 0.045;
    const asoma = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.1), new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.035, 0.13, 0.55), roughness: 0.42 }));
    asoma.position.set(0, 0.095, 0);
    this.guantes.add(caja, asoma);
    this.registrar('ppe-gloves', this.guantes, this.zona('ppe-gloves', [0.16, 0.14, 0.27], new THREE.Vector3(0, 0.05, 0), this.guantes));
    this.raiz.add(this.matraz, this.probeta, this.piseta, balanza, this.gafas, this.guantes);

    // Zonas de los muebles horneados y de lo ambiental.
    const fijo = (objetivo: string, tam: [number, number, number], centro: THREE.Vector3, padre: THREE.Object3D = this.raiz) => {
      const z = this.zona(objetivo, tam, centro, padre);
      if (!this.objetos.has(objetivo)) this.objetos.set(objetivo, { grupo: padre, contorno: [], zona: z });
    };
    fijo('reagent-shelf', [3.02, 1.26, 0.26], ue(256, -34, 153));
    fijo('hood-tray', [0.42, 0.06, 0.22], ue(5.75, -22, 93));
    fijo('hood-waste', [0.3, 0.46, 0.3], ue(480, 30, 23));
    fijo('recipe-board', [0.96, 0.7, 0.04], ue(510, -44, 160));
    fijo('amb:ducha', [0.5, 2.3, 0.6], ue(-525, -10, 118));
    fijo('amb:extintor', [0.2, 0.6, 0.2], ue(450, 844, 85));
    fijo('amb:aire', [1.0, 0.3, 0.24], ue(-270, -35, 283));
    fijo('amb:aire', [1.0, 0.3, 0.24], ue(-150, 843, 283));
    fijo('amb:material', [3.56, 0.75, 0.3], ue(-270, -32, 172));
    fijo('amb:armarios', [3.2, 2.0, 0.5], ue(-400, 831, 108));
    fijo('amb:inflamables', [0.6, 1.65, 0.5], ue(505, 831, 83));
    fijo('amb:corrosivos', [0.6, 1.65, 0.5], ue(567, 831, 83));
    fijo('amb:nevera', [0.64, 1.8, 0.66], ue(569, 62, 90));
    fijo('amb:bombonas', [0.3, 1.45, 0.6], ue(-583, 304, 72));
    fijo('amb:botiquin', [0.1, 0.32, 0.3], ue(595, 670, 156));
    fijo('amb:tabla', [1.4, 0.82, 0.04], ue(205, 852, 160));

    // Mecheros Bunsen junto a las torretas de gas (dos por meseta) y grifos de los lavabos.
    const llamaMat = () => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { t: { value: 0 } },
      vertexShader: 'uniform float t; varying float h; void main(){ h = uv.y; vec3 p = position; p.x += sin(t * 17.0 + position.y * 60.0) * 0.0025 * uv.y; p.z += cos(t * 13.0 + position.y * 50.0) * 0.0025 * uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'varying float h; void main(){ vec3 c = mix(vec3(0.15, 0.45, 1.6), vec3(0.5, 0.25, 1.0), h); gl_FragColor = vec4(c * (1.0 - h * 0.75), 1.0); }',
    });
    datos.islas.forEach(([cx, cy], i) => [-1, 1].forEach((s, j) => {
      const g = new THREE.Group(); g.position.copy(ue(cx + s * 70 + 16, cy + 22 * (j ? 1 : -1), 90));
      g.add(asignar(malla('SM_Bunsen'), metal), sombra(0.06));
      const llama = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.09, 12, 6, true), llamaMat()); llama.position.y = 0.195; llama.visible = false; llama.userData.sinContorno = true;
      g.add(llama); this.raiz.add(g);
      const id = `amb:mechero:${i * 2 + j}`;
      NOMBRES[id] = 'Mechero Bunsen';
      this.llamas.push({ malla: llama, encendida: false });
      this.registrar(id, g, this.zona(id, [0.1, 0.2, 0.1], new THREE.Vector3(0, 0.1, 0), g));
    }));
    const aguaMat = liquidoMat(0xdcecf2, 0.5);
    datos.lavabos.forEach((y, i) => {
      const g = new THREE.Group(); g.position.copy(ue(586, y, 90)); g.rotation.y = Math.PI;
      g.add(asignar(malla('SM_Faucet'), metal));
      const agua = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.42, 8), aguaMat); agua.position.set(0.14, 0.04, 0); agua.visible = false; agua.userData.sinContorno = true; agua.renderOrder = 2;
      g.add(agua); this.raiz.add(g);
      const id = `amb:grifo:${i}`;
      NOMBRES[id] = 'Lavabo';
      this.grifos.push({ agua, abierto: false });
      this.registrar(id, g, this.zona(id, [0.7, 0.4, 0.6], new THREE.Vector3(0.25, 0.1, 0), g));
    });
    this.ducha = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 2.15, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xdcecf2, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    this.ducha.position.copy(ue(-525, 12, 112)); this.ducha.visible = false; this.ducha.renderOrder = 2;
    this.raiz.add(this.ducha);

    // Material expuesto (ambiental), todo instanciado: una llamada de dibujo por pieza y material, no por objeto,
    // para poder llenar el laboratorio sin que lo pague un PC modesto.
    type Clave = typeof nombres[number];
    const piezas = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; base: THREE.Matrix4; orden: number }[]>();
    const definir = (clave: string, objeto: THREE.Object3D) => {
      objeto.updateMatrixWorld(true);
      const lista: { geo: THREE.BufferGeometry; mat: THREE.Material; base: THREE.Matrix4; orden: number }[] = [];
      objeto.traverse(m => { if (m instanceof THREE.Mesh) lista.push({ geo: m.geometry, mat: m.material as THREE.Material, base: m.matrixWorld.clone(), orden: m.renderOrder }); });
      piezas.set(clave, lista);
    };
    for (const n of nombres) definir(n, asignar(malla(n), n === 'SM_ReagentJar_250' || n === 'SM_WashBottle_500' || n === 'SM_TestTubeRack' || n === 'SM_WeighBoat' ? hdpe : claro));
    definir('frasco-ambar', asignar(malla('SM_ReagentBottle_500'), ambar));
    definir('tapa', pintar(malla('SM_Cap_GL45'), tapaMat, 0));
    const liquidos = ['#eef4f2', '#1f7fe0', '#e8860c', '#7a12a8', '#2fae4c', '#f2d23a', '#d2362a', '#12a8a0', '#e24a8a'];
    liquidos.forEach((c, i) => definir('liquido-' + i, pintar(malla('SM_Liquid_Bottle500_400mL'), liquidoMat(c, 0.6))));
    const geoCaja = new THREE.BoxGeometry(1, 1, 1), geoCil = new THREE.CylinderGeometry(1, 1, 1, 20);
    const liso = (color: THREE.ColorRepresentation, rug = 0.5, metalico = 0) => new THREE.MeshStandardMaterial({ color, roughness: rug, metalness: metalico });
    const prim = (clave: string, geo: THREE.BufferGeometry, mat: THREE.Material) => piezas.set(clave, [{ geo, mat, base: new THREE.Matrix4(), orden: 0 }]);
    prim('caja-blanca', geoCaja, liso(0xe4e6e8, 0.4)); prim('caja-oscura', geoCaja, liso(0x1c1e22, 0.35)); prim('caja-acero', geoCaja, metal); prim('cil-acero', geoCil, metal);
    prim('caja-carton', geoCaja, liso(0x9a7650, 0.8)); prim('caja-azul', geoCaja, liso(0x1f4fa8, 0.6)); prim('caja-roja', geoCaja, liso(0xa82a22, 0.6)); prim('caja-verde', geoCaja, liso(0x2c7a48, 0.6));
    prim('caja-papel', geoCaja, liso(0xf3f1ea, 0.8)); prim('cil-papel', geoCil, liso(0xf3f1ea, 0.85));
    prim('cil-maceta', geoCil, liso(0xb5562e, 0.7)); prim('esf-hojas', new THREE.IcosahedronGeometry(1, 1), liso(0x2f8f3a, 0.75)); prim('esf-hojas2', new THREE.IcosahedronGeometry(1, 1), liso(0x4fae3c, 0.75));

    const colas = new Map<string, THREE.Matrix4[]>();
    const sombrasM: THREE.Matrix4[] = [];
    const cola = (clave: string) => { if (!colas.has(clave)) colas.set(clave, []); return colas.get(clave)!; };
    /** Coloca un modelo (posición en cm de Unreal). `sombra`: radio de la sombra de contacto, 0 para ninguna. */
    const poner = (clave: string, x: number, y: number, z: number, giro = 0, op: { tumbado?: boolean; escala?: number; sombra?: number } = {}) => {
      const pos = ue(x, y, z);
      cola(clave).push(new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, giro, op.tumbado ? Math.PI / 2 : 0)), new THREE.Vector3().setScalar(op.escala ?? 1)));
      const r = op.sombra ?? (op.tumbado ? 0 : 0.075);
      if (r > 0) sombrasM.push(new THREE.Matrix4().compose(pos.clone().setY(pos.y + 0.0015), new THREE.Quaternion(), new THREE.Vector3(r * 2, 1, r * 2)));
    };
    /** Caja o cilindro por sus medidas en cm (centro en x, y; apoyado en z). */
    const bloque = (clave: string, x: number, y: number, z: number, ancho: number, fondo: number, alto: number, giro = 0) => {
      const cil = clave.startsWith('cil-') || clave.startsWith('esf-');
      cola(clave).push(new THREE.Matrix4().compose(ue(x, y, z + alto / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, giro, 0)), new THREE.Vector3(ancho / (cil ? 200 : 100), alto / 100, fondo / (cil ? 200 : 100))));
    };
    const gradilla = (x: number, y: number, z: number, giro = 0) => {
      poner('SM_TestTubeRack', x, y, z, giro, { sombra: 0.13 });
      for (let k = 0; k < 5; k++) { const d = (-7 + k * 3.5); poner('SM_TestTube', x + Math.cos(giro) * d, y - Math.sin(giro) * d, z + 1.2, 0, { sombra: 0 }); }
    };
    const frasco = (x: number, y: number, z: number, i: number) => {
      const amb = i % 3 === 1;
      poner(amb ? 'frasco-ambar' : 'SM_ReagentBottle_500', x, y, z, i * 0.7, { sombra: 0.06 });
      poner('liquido-' + (amb ? 0 : i % liquidos.length), x, y, z, 0, { escala: 0.985, sombra: 0 });
      poner('tapa', x, y, z + 15.5, 0, { sombra: 0 });
    };
    const fila = (lista: Clave[], x0: number, paso: number, y: number, z: number) => lista.forEach((m, i) => m === 'SM_TestTubeRack' ? gradilla(x0 + i * paso, y, z) : poner(m, x0 + i * paso, y, z, i * 1.3));
    // Estantes abiertos y banco izquierdo.
    fila(['SM_Beaker_50', 'SM_Beaker_100', 'SM_Beaker_250', 'SM_Beaker_500', 'SM_Beaker_250', 'SM_Erlenmeyer_250', 'SM_Erlenmeyer_250', 'SM_Beaker_100'], -436, 20, -32, 150);
    fila(['SM_VolFlask_100', 'SM_VolFlask_250', 'SM_VolFlask_250', 'SM_GradCylinder_50', 'SM_GradCylinder_10', 'SM_GradCylinder_50', 'SM_Funnel', 'SM_Funnel'], -258, 20, -32, 150);
    fila(['SM_Mortar', 'SM_Mortar', 'SM_WatchGlass', 'SM_WatchGlass', 'SM_Beaker_500', 'SM_Beaker_500', 'SM_Erlenmeyer_250'], -432, 23, -32, 190);
    fila(['SM_TestTubeRack', 'SM_TestTubeRack', 'SM_TestTubeRack', 'SM_VolFlask_100', 'SM_Beaker_50', 'SM_Beaker_50'], -246, 26, -32, 190);
    fila(['SM_Mortar', 'SM_Beaker_250', 'SM_GradCylinder_50', 'SM_TestTubeRack', 'SM_Erlenmeyer_250', 'SM_VolFlask_250', 'SM_Funnel'], -420, 44, -24, 90);
    poner('SM_Pestle', -420, -24, 93.5, 0, { tumbado: true }); poner('SM_StirRod', -350, 10, 90.4, 0.4, { tumbado: true }); poner('SM_Thermometer', -300, 16, 90.4, -0.2, { tumbado: true });
    /** Placa calefactora con agitador y un vaso encima. */
    const placa = (x: number, y: number, giro = 0) => {
      bloque('caja-blanca', x, y, 90, 20, 22, 7, giro); bloque('caja-oscura', x, y - 1.5, 97, 15, 15, 0.8, giro); bloque('cil-acero', x + Math.sin(giro) * 9.5, y + Math.cos(giro) * 9.5 + 1.6, 92.2, 2.6, 2.6, 2.6, giro);
      poner('SM_Beaker_250', x, y - 1.5, 97.8, giro, { sombra: 0 });
      sombrasM.push(new THREE.Matrix4().compose(ue(x, y, 90.15), new THREE.Quaternion(), new THREE.Vector3(0.36, 1, 0.38)));
    };
    /** Soporte universal con pinza y bureta sobre un matraz. */
    const soporte = (x: number, y: number) => {
      bloque('caja-acero', x, y, 90, 16, 11, 1.2); bloque('cil-acero', x, y - 3.5, 91, 1.2, 1.2, 62); bloque('caja-acero', x + 4.5, y - 3.5, 138, 9, 1.6, 1.6);
      poner('SM_Pipette_10', x + 8.5, y - 3.5, 108, 0, { escala: 1.25, sombra: 0 }); poner('SM_Erlenmeyer_250', x + 8.5, y - 3.5, 91.2, 0.5, { sombra: 0.07 });
      sombrasM.push(new THREE.Matrix4().compose(ue(x, y, 90.15), new THREE.Quaternion(), new THREE.Vector3(0.26, 1, 0.2)));
    };
    placa(-330, 12); placa(-210, 14); placa(-150, 10);
    [-405, -390].forEach(x => bloque('caja-azul', x, 20, 90, 12, 24, 7));
    bloque('cil-papel', -445 + 6, 22, 90, 12, 12, 24); bloque('caja-blanca', -120, 20, 90, 26, 30, 16); bloque('caja-oscura', -120, 34.6, 96, 14, 1, 6);
    // Banco derecho, bajo la estantería de reactivos: material de uso frecuente.
    fila(['SM_Beaker_500', 'SM_Beaker_250', 'SM_GradCylinder_50', 'SM_Funnel', 'SM_WatchGlass'], 120, 34, 22, 90);
    placa(330, 14); gradilla(420, 10, 90, 0.2); poner('SM_WashBottle_500', 395, 28, 90, 1, { sombra: 0.06 });
    // Mesetas: repisa central con frascos y cristalería, soporte con bureta, placa, gradillas y vasos.
    datos.islas.forEach(([cx, cy], i) => {
      for (let k = 0; k < 9; k++) { const x = cx - 108 + k * 26 + (k > 3 ? 8 : 0); frasco(x, cy + (k % 2 ? 3 : -3), 120, k + i * 2); }
      const alta: Clave[] = ['SM_Beaker_250', 'SM_Erlenmeyer_250', 'SM_VolFlask_250', 'SM_Beaker_500', 'SM_VolFlask_100', 'SM_GradCylinder_50', 'SM_Beaker_100', 'SM_Erlenmeyer_250', 'SM_WashBottle_500'];
      alta.forEach((m, k) => poner(m, cx - 108 + k * 26 + (k > 3 ? 8 : 0), cy, 150, k * 1.1 + i));
      soporte(cx - 30, cy - 38); soporte(cx + 96, cy + 42);
      if (i % 2 === 0) placa(cx + 36, cy + 40, Math.PI); else placa(cx - 100, cy + 40, Math.PI);
      gradilla(cx - 110, cy - 34, 90, 0.3); gradilla(cx + 40, cy - 40, 90, -0.2);
      poner('SM_Beaker_250', cx - 20, cy + 32, 90, i); poner('SM_GradCylinder_50', cx + 10, cy - 34, 90); poner('SM_Beaker_100', cx - 60, cy + 38, 90);
      poner('SM_WatchGlass', cx + 62, cy - 30, 90); poner('SM_Mortar', cx + 118, cy - 30, 90, 1); poner('SM_WashBottle_500', cx - 128, cy + 36, 90, 2, { sombra: 0.06 });
      poner('SM_StirRod', cx - 80, cy - 42, 90.4, 0.5, { tumbado: true });
    });
    // Lavabos: pisetas, vasos escurriendo y jabón; carrito; cajas sobre los armarios; escritorio.
    datos.lavabos.forEach(y => {
      poner('SM_WashBottle_500', 588, y - 44, 90, 2, { sombra: 0.06 }); poner('SM_Beaker_500', 560, y + 44, 90, 1); poner('SM_Beaker_250', 545, y + 52, 90, 2); poner('SM_Erlenmeyer_250', 572, y + 58, 90);
      bloque('caja-verde', 590, y + 36, 90, 6, 9, 14); gradilla(552, y - 52, 90, Math.PI / 2);
    });
    fila(['SM_Beaker_500', 'SM_VolFlask_250', 'SM_GradCylinder_50'], 548, 0, 330, 90); poner('SM_Beaker_500', 548, 330, 90); poner('SM_VolFlask_250', 560, 380, 90); poner('SM_GradCylinder_50', 545, 420, 90);
    [0, 1, 2, 3].forEach(k => { poner(k % 2 ? 'SM_Beaker_500' : 'SM_Erlenmeyer_250', -575 + (k % 2) * 34, 448 + (k > 1 ? 30 : 0), 82, k); poner('SM_ReagentJar_250', -572 + (k % 2) * 30, 446 + (k > 1 ? 32 : 0), 30, k, { sombra: 0 }); });
    [[-540, 36, 30, 'caja-carton'], [-498, 40, 26, 'caja-carton'], [-430, 34, 22, 'caja-papel'], [-360, 44, 30, 'caja-carton'], [-300, 36, 24, 'caja-azul'], [-268, 30, 20, 'caja-carton']].forEach(([x, ancho, alto, clave]) => bloque(clave as string, x as number, 832, 208, ancho as number, 30, alto as number));
    [['caja-roja', -66], ['caja-azul', -62.5], ['caja-verde', -59], ['caja-papel', -55.5]].forEach(([clave, x]) => bloque(clave as string, x as number, 838, 75, 3, 20, 26));
    bloque('caja-papel', 30, 810, 75, 22, 30, 0.6, 0.2); bloque('caja-roja', 40, 800, 75.6, 15, 21, 1.6, -0.3);
    bloque('caja-carton', 506, 832, 165, 40, 28, 22); bloque('caja-papel', 566, 832, 165, 30, 26, 14); bloque('caja-blanca', 569, 62, 180, 40, 40, 18);

    // Plantas en los alféizares, el escritorio y junto a los armarios: verde vivo contra el blanco del laboratorio.
    const planta = (x: number, y: number, z: number, t = 1) => {
      bloque('cil-maceta', x, y, z, 11 * t, 11 * t, 9 * t); bloque('esf-hojas', x, y, z + 8 * t, 20 * t, 20 * t, 17 * t); bloque('esf-hojas2', x + 3 * t, y - 2 * t, z + 16 * t, 13 * t, 13 * t, 12 * t);
    };
    [100, 240, 370, 510, 640, 780].forEach((y, i) => planta(-594, y, 90, i % 2 ? 0.8 : 1));
    planta(48, 838, 75, 0.9); planta(-215, 832, 0, 2.6);
    for (const [clave, matrices] of colas) for (const pz of piezas.get(clave) ?? []) {
      const im = new THREE.InstancedMesh(pz.geo, pz.mat, matrices.length);
      matrices.forEach((m, i) => im.setMatrixAt(i, m.clone().multiply(pz.base)));
      im.renderOrder = pz.orden; im.computeBoundingSphere(); im.userData.sinContorno = true;
      this.raiz.add(im);
    }
    const sombras = new THREE.InstancedMesh(sombraGeo, sombraMat, sombrasM.length);
    sombrasM.forEach((m, i) => sombras.setMatrixAt(i, m));
    sombras.renderOrder = 1; sombras.computeBoundingSphere();
    this.raiz.add(sombras);

    // Rótulos, señalización y pósteres.
    const plano = (tex: THREE.Texture, ancho: number, alto: number, pos: THREE.Vector3, giroY: number) => {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
      pl.position.copy(pos); pl.rotation.y = giroY; this.raiz.add(pl);
    };
    const cartel = (lineas: string[], ancho: number, alto: number, pos: THREE.Vector3, giroY: number, op = {}) => plano(rotulo(lineas, { ancho: 512, alto: Math.round(512 * alto / ancho), ...op }), ancho, alto, pos, giroY);
    const lienzo2d = (w: number, h: number, dibujar: (c: CanvasRenderingContext2D) => void) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; dibujar(cv.getContext('2d')!); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx; };
    const verde = { fondo: '#0b7a3b', color: '#ffffff' }, rojo = { fondo: '#b3140f', color: '#ffffff' }, azul = { fondo: '#14509a', color: '#ffffff' }, ambarillo = { fondo: '#f1c40f', color: '#141414' };
    const FRENTE = Math.PI, DERECHA = -Math.PI / 2, IZQUIERDA = Math.PI / 2;
    cartel(['MISIONES', 'Prácticas guiadas y mezcla libre', 'Pulsa E'], 0.9, 0.62, ue(510, -43.8, 160), 0, { tam: 62, fondo: '#f2f3f4', borde: '#30343c' });
    cartel(['PROTECCIÓN OBLIGATORIA', 'Gafas y guantes antes de tocar reactivos'], 0.6, 0.19, ue(599.3, 745, 160), DERECHA, { tam: 44, ...azul });
    cartel(['RESIDUOS', 'QUÍMICOS'], 0.2, 0.12, ue(480, 44.2, 26), 0, { tam: 54, fondo: '#f1e3a0' });
    cartel(['REACTIVOS'], 0.5, 0.07, ue(256, -21.8, 221), 0, { tam: 56, fondo: '#eef0f2' });
    cartel(['DUCHA DE EMERGENCIA', 'Y LAVAOJOS'], 0.62, 0.3, ue(-525, -45.7, 268), 0, { tam: 60, ...verde });
    cartel(['DUCHA DE EMERGENCIA', 'Tira de la palanca roja'], 0.55, 0.22, ue(-599.3, 20, 185), IZQUIERDA, { tam: 46, ...verde });
    cartel(['LAVADO DE MANOS'], 0.6, 0.12, ue(599.3, 380, 238), DERECHA, { tam: 52, ...azul });
    cartel(['EXTINTOR'], 0.26, 0.26, ue(450, 853.4, 150), FRENTE, { tam: 70, ...rojo });
    cartel(['SALIDA'], 0.45, 0.16, ue(350, 853.4, 232), FRENTE, { tam: 90, ...verde });
    cartel(['INFLAMABLES', 'Mantener cerrado'], 0.42, 0.2, ue(505, 808.6, 130), FRENTE, { tam: 60, fondo: '#c81e14', color: '#ffffff' });
    cartel(['CORROSIVOS', 'Ácidos y bases'], 0.42, 0.2, ue(567, 808.6, 130), FRENTE, { tam: 60, fondo: '#f2f3f4', color: '#101418', borde: '#101418' });
    cartel(['GASES A PRESIÓN', 'Bombonas sujetas'], 0.5, 0.2, ue(-599.3, 304, 175), IZQUIERDA, { tam: 50, ...ambarillo });
    cartel(['NEVERA', 'Solo reactivos · No alimentos'], 0.4, 0.18, ue(537.6, 62, 150), DERECHA, { tam: 56, ...azul });
    cartel(['GAS', 'Cierra la llave al terminar'], 0.3, 0.12, ue(-300, 345.2, 135), 0, { tam: 60, ...ambarillo });
    cartel(['ALMACÉN DE MATERIAL'], 0.9, 0.1, ue(-400, 808.6, 196), FRENTE, { tam: 50, fondo: '#eef0f2' });
    plano(lienzo2d(256, 256, c => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#0b7a3b'; c.fillRect(96, 40, 64, 176); c.fillRect(40, 96, 176, 64); }), 0.26, 0.26, ue(590.8, 670, 156), DERECHA);
    // Tabla periódica (esquema de 18 columnas por familias; la interactiva completa está en el prototipo web).
    plano(lienzo2d(1024, 600, c => {
      c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, 1024, 600); c.fillStyle = '#1d1f24'; c.font = '700 40px "Segoe UI", Arial'; c.textAlign = 'center'; c.fillText('TABLA PERIÓDICA DE LOS ELEMENTOS', 512, 50);
      const filas = ['H................He', 'LiBe..........BCNOFNe', 'NaMg..........AlSiPSClAr', 'KCaScTiVCrMnFeCoNiCuZnGaGeAsSeBrKr', 'RbSrYZrNbMoTcRuRhPdAgCdInSnSbTeIXe', 'CsBa*HfTaWReOsIrPtAuHgTlPbBiPoAtRn', 'FrRa*RfDbSgBhHsMtDsRgCnNhFlMcLvTsOg'];
      const color = (col: number, f: number) => col === 0 ? (f === 0 ? '#9fd3a8' : '#f4a48c') : col === 1 ? '#f7cf8a' : col === 17 ? '#b9a7e6' : col === 16 ? '#f2e08a' : col >= 12 ? (f + col > 17 ? '#a9d6c1' : '#9fd3a8') : '#a7c8ee';
      filas.forEach((fila, f) => { const simbolos = fila.match(/[A-Z][a-z]?|\.|\*/g)!; simbolos.forEach((sm, col) => { if (sm === '.') return; const x = 26 + col * 54, y = 80 + f * 62; c.fillStyle = sm === '*' ? '#e3c3e6' : color(col, f); c.fillRect(x, y, 50, 58); c.strokeStyle = '#555'; c.strokeRect(x, y, 50, 58); c.fillStyle = '#1d1f24'; c.font = '600 24px "Segoe UI", Arial'; c.fillText(sm === '*' ? '…' : sm, x + 25, y + 38); }); });
      c.font = '500 20px "Segoe UI", Arial'; c.fillStyle = '#555'; c.fillText('Lantánidos y actínidos (…) no se muestran en este esquema', 512, 560);
    }), 1.4, 0.82, ue(205, 853.4, 160), FRENTE);
    // Normas del laboratorio y pictogramas de peligro.
    plano(lienzo2d(512, 720, c => {
      c.fillStyle = '#f7f7f2'; c.fillRect(0, 0, 512, 720); c.fillStyle = '#14509a'; c.fillRect(0, 0, 512, 84); c.fillStyle = '#fff'; c.font = '700 34px "Segoe UI", Arial'; c.textAlign = 'center'; c.fillText('NORMAS DEL LABORATORIO', 256, 54);
      c.textAlign = 'left'; c.fillStyle = '#1d1f24'; c.font = '500 26px "Segoe UI", Arial';
      ['Gafas, guantes y bata siempre.', 'Pelo recogido y calzado cerrado.', 'No comer ni beber.', 'Lee la etiqueta antes de usar.', 'Mide líquidos en la probeta.', 'Pesa los sólidos en la balanza.', 'Trabaja en la campana.', 'Residuos a su recipiente.', 'Cierra el gas al terminar.', 'Lávate las manos al salir.'].forEach((t, i) => c.fillText(`${i + 1}. ${t}`, 30, 140 + i * 56));
    }), 0.5, 0.7, ue(-599.3, 575, 165), IZQUIERDA);
    plano(lienzo2d(512, 360, c => {
      c.fillStyle = '#f7f7f2'; c.fillRect(0, 0, 512, 360); c.fillStyle = '#1d1f24'; c.font = '700 30px "Segoe UI", Arial'; c.textAlign = 'center'; c.fillText('PICTOGRAMAS DE PELIGRO', 256, 44);
      ['Inflamable', 'Corrosivo', 'Tóxico', 'Comburente', 'Irritante', 'Ambiente'].forEach((t, i) => { const x = 96 + (i % 3) * 160, y = 130 + Math.floor(i / 3) * 140; c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillStyle = '#fff'; c.strokeStyle = '#d2201a'; c.lineWidth = 8; c.fillRect(-38, -38, 76, 76); c.strokeRect(-38, -38, 76, 76); c.restore(); c.fillStyle = '#1d1f24'; c.font = '700 40px "Segoe UI", Arial'; c.fillText('!', x, y + 14); c.font = '500 20px "Segoe UI", Arial'; c.fillText(t, x, y + 76); });
    }), 0.6, 0.42, ue(599.3, 62, 218), DERECHA);
    // Pizarra blanca con la práctica del día (la cara visible la pone la web; el marco está horneado).
    plano(lienzo2d(1024, 500, c => {
      c.fillStyle = '#f6f7f5'; c.fillRect(0, 0, 1024, 500);
      c.fillStyle = '#1f3f8a'; c.font = '600 44px "Segoe Print", "Comic Sans MS", cursive'; c.textAlign = 'left'; c.fillText('Reacciones de precipitación', 40, 70);
      c.fillStyle = '#20242a'; c.font = '500 36px "Segoe Print", "Comic Sans MS", cursive';
      c.fillText('AgNO₃ + NaCl → AgCl ↓ + NaNO₃', 40, 150); c.fillText('Pb(NO₃)₂ + 2 KI → PbI₂ ↓ + 2 KNO₃', 40, 215); c.fillText('Q > Ksp  ⇒  precipita', 40, 290);
      c.fillStyle = '#b3261e'; c.fillText('n = C · V        pH = −log[H⁺]', 40, 370);
      c.fillStyle = '#1b6b3a'; c.font = '500 30px "Segoe Print", "Comic Sans MS", cursive'; c.fillText('Recuerda: gafas, guantes y residuos a su recipiente', 40, 450);
    }), 2.16, 1.06, ue(15, 852.4, 160), FRENTE);
    // Pantalla del ordenador del escritorio y reloj.
    const pantallaPc = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.3), new THREE.MeshBasicMaterial({ map: lienzo2d(512, 288, c => { c.fillStyle = '#10243c'; c.fillRect(0, 0, 512, 288); c.fillStyle = '#e8f0fa'; c.font = '700 44px "Segoe UI", Arial'; c.textAlign = 'center'; c.fillText('Experimenta 3D', 256, 130); c.font = '500 24px "Segoe UI", Arial'; c.fillText('Registro de prácticas', 256, 180); }) }));
    pantallaPc.position.copy(ue(-3, 837.9, 109)); pantallaPc.rotation.y = FRENTE; this.raiz.add(pantallaPc);
    plano(lienzo2d(256, 256, c => { c.clearRect(0, 0, 256, 256); c.fillStyle = '#f7f7f2'; c.beginPath(); c.arc(128, 128, 120, 0, 7); c.fill(); c.lineWidth = 10; c.strokeStyle = '#22252b'; c.stroke(); c.lineWidth = 6; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.beginPath(); c.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); c.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112); c.stroke(); } c.lineWidth = 8; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + 50, 128 - 40); c.moveTo(128, 128); c.lineTo(128 - 20, 128 - 86); c.stroke(); }), 0.34, 0.34, ue(60, -45.7, 275), 0);
    (this.raiz.children.at(-1) as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>).material.transparent = true;

    // Marcas de guía «V» sobre los objetivos del paso actual.
    const marcaTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!; g.fillStyle = '#ffb02e'; g.beginPath(); g.moveTo(8, 14); g.lineTo(56, 14); g.lineTo(32, 54); g.closePath(); g.fill(); g.strokeStyle = '#3a2400'; g.lineWidth = 3; g.stroke(); return new THREE.CanvasTexture(c); })();
    // Tamaño constante en pantalla: la flecha se ve igual de grande desde la otra punta del laboratorio.
    const marcaMat = new THREE.SpriteMaterial({ map: marcaTex, depthTest: false, transparent: true, sizeAttenuation: false });
    for (const id of this.objetos.keys()) {
      if (id.startsWith('amb:')) continue;
      const s = new THREE.Sprite(marcaMat);
      s.scale.setScalar(0.07); s.visible = false; s.renderOrder = 20;
      this.raiz.add(s); this.marcas.set(id, s);
    }
  }

  /** Posición actual del objetivo (centro de su zona), para la guía y el recorrido automático. */
  centro(objetivo: string) {
    const o = this.objetos.get(objetivo);
    return o ? o.zona.getWorldPosition(new THREE.Vector3()) : null;
  }

  /** Punto justo encima del objetivo (para la etiqueta de la guía). */
  encima(objetivo: string) {
    const o = this.objetos.get(objetivo);
    if (!o) return null;
    const p = o.zona.getWorldPosition(new THREE.Vector3());
    p.y += (o.zona.geometry as THREE.BoxGeometry).parameters.height / 2 + 0.2;
    return p;
  }

  /** Interacciones ambientales (sin química): devuelve el mensaje, o null si el objetivo no es ambiental. */
  ambiente(objetivo: string): string | null {
    if (!objetivo.startsWith('amb:')) return null;
    const [, tipo, n] = objetivo.split(':');
    if (tipo === 'mechero') { const l = this.llamas[Number(n)]; l.encendida = !l.encendida; l.malla.visible = l.encendida; return l.encendida ? 'Abres la llave de gas y enciendes el mechero: llama azul. Es ambiental, todavía no calienta mezclas. Apágalo al terminar.' : 'Mechero apagado y llave de gas cerrada.'; }
    if (tipo === 'grifo') { const g = this.grifos[Number(n)]; g.abierto = !g.abierto; g.agua.visible = g.abierto; return g.abierto ? 'Grifo abierto: lávate las manos al terminar cada práctica y siempre antes de salir.' : 'Grifo cerrado.'; }
    if (tipo === 'ducha') { this.duchaHasta = performance.now() + 5000; return 'Ducha de emergencia activada. Ante una salpicadura química: bajo la ducha 15 minutos, o lavaojos con los párpados abiertos, y avisa al responsable.'; }
    if (tipo === 'extintor') return 'Extintor: solo para un conato de incendio y con la salida a tu espalda. Aquí es de exposición.';
    if (tipo === 'aire') return 'Aire acondicionado: mantiene el laboratorio a unos 25 °C, la temperatura de referencia del modelo.';
    if (tipo === 'armarios') return 'Almacén: cristalería de repuesto, papel de filtro y material de limpieza. De exposición.';
    if (tipo === 'inflamables') return 'Armario de seguridad para inflamables (alcoholes, acetona): cerrado y lejos de los mecheros. De exposición.';
    if (tipo === 'corrosivos') return 'Armario para ácidos y bases concentrados, separados entre sí. Aquí se trabaja con disoluciones diluidas. De exposición.';
    if (tipo === 'nevera') return 'Nevera de reactivos: nunca se guardan alimentos en un laboratorio. De exposición.';
    if (tipo === 'bombonas') return 'Bombonas de gas a presión: siempre sujetas a la pared y con el capuchón puesto. De exposición.';
    if (tipo === 'botiquin') return 'Botiquín de primeros auxilios. Ante cualquier accidente, avisa al responsable.';
    if (tipo === 'tabla') return 'Tabla periódica: esquema por familias. La versión interactiva completa está en el prototipo web.';
    if (tipo === 'material') return 'Vasos, matraces, probetas, embudos, morteros y tubos de ensayo: de exposición. El material de trabajo está en la campana.';
    return null;
  }

  private dibujarPantalla(texto: string) {
    if (texto === this.pantalla.texto) return;
    this.pantalla.texto = texto;
    const c = this.pantalla.ctx;
    c.fillStyle = '#0c1410'; c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#8df0a8'; c.font = '600 40px Consolas, monospace'; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText(texto, 244, 34);
    this.pantalla.tex.needsUpdate = true;
  }

  actualizar(t: number, dt: number, anclas: Record<Hand, THREE.Object3D>, objetivo: string | null, marcar: string[], vertiendoMano: Hand | null) {
    const h = useHood.getState(), lab = useLab.getState();
    contornoMat.uniforms.t.value = t;
    for (const [id, o] of this.objetos) for (const c of o.contorno) c.visible = id === objetivo;

    // Frascos: estantería, bandeja (en orden de llegada) o mano.
    let enBandeja = 0;
    for (const [id, g] of this.frascos) {
      const lugar = h.places[id];
      const sombraMalla = g.children.find(c => c.userData.sombra);
      if (lugar === 'left' || lugar === 'right') {
        if (g.parent !== anclas[lugar]) { anclas[lugar].add(g); g.position.set(0, FORMA[g.userData.forma as keyof typeof FORMA].enMano, 0); g.rotation.set(0, 0, 0); }
        if (sombraMalla) sombraMalla.visible = false;
      } else {
        if (g.parent !== this.raiz) { this.raiz.add(g); g.rotation.set(0, 0, 0); }
        g.position.copy(lugar === 'hood' ? bandeja(enBandeja++) : estante(id));
        if (sombraMalla) sombraMalla.visible = true;
      }
    }

    // Probeta, balanza y matraz: lo que marca la capa de estado, y la coreografía de la transferencia en curso.
    const tr = h.transfer;
    const progreso = tr ? clamp((Date.now() - tr.startedAt) / (tr.kind === 'rinse' ? 900 : POUR_MS), 0, 1) : -1;
    let mlProbeta = h.cylinder.ml;
    this.probeta.position.copy(POS_PROBETA); this.probeta.rotation.set(0, 0, 0);
    this.matraz.position.copy(POS_MATRAZ); this.matraz.rotation.set(0, 0, 0);
    this.piseta.position.copy(POS_PISETA); this.piseta.rotation.set(0, 0, 0);
    this.navecilla.position.set(0, 0.055, -0.02); this.navecilla.rotation.set(0, 0, 0);
    let chorroDe: THREE.Vector3 | null = null, chorroA: THREE.Vector3 | null = null;
    let chorroColor = '#e8f2f4';
    if (tr?.kind === 'cylinder') {
      const ida = suave(progreso / 0.3), vuelta = suave((progreso - 0.8) / 0.2), mover = ida * (1 - vuelta);
      const sobre = POS_MATRAZ.clone().add(new THREE.Vector3(-0.07, 0.17, 0));
      this.probeta.position.lerpVectors(POS_PROBETA, sobre, mover);
      this.probeta.rotation.z = -mezclar(0, 1.95, suave((progreso - 0.25) / 0.25)) * (1 - vuelta);
      const vaciado = clamp((progreso - 0.4) / 0.4, 0, 1);
      mlProbeta = h.cylinder.ml * (1 - vaciado);
      if (vaciado > 0 && vaciado < 1) { this.probeta.updateMatrixWorld(); chorroDe = this.probeta.localToWorld(new THREE.Vector3(0, 0.26, 0)); chorroA = POS_MATRAZ.clone().add(new THREE.Vector3(0, 0.05, 0)); }
      if (tr.reagent) chorroColor = reagents[tr.reagent].look.contents;
    } else if (tr?.kind === 'balance') {
      // La navecilla va hasta la boca del matraz y vuelca el sólido.
      const ida = suave(progreso / 0.35), vuelta = suave((progreso - 0.8) / 0.2), mover = ida * (1 - vuelta);
      const destino = this.navecilla.parent!.worldToLocal(POS_MATRAZ.clone().add(new THREE.Vector3(0.05, 0.23, 0)));
      this.navecilla.position.lerp(destino, mover);
      this.navecilla.position.y += Math.sin(mover * Math.PI) * 0.06;
      this.navecilla.rotation.z = mezclar(0, 1.2, suave((progreso - 0.35) / 0.2)) * (1 - vuelta);
    } else if (tr?.kind === 'rinse') {
      const k = Math.sin(progreso * Math.PI);
      this.piseta.position.lerpVectors(POS_PISETA, POS_PROBETA.clone().add(new THREE.Vector3(-0.08, 0.2, -0.02)), k);
      this.piseta.rotation.z = -1.2 * k;
      if (progreso > 0.3 && progreso < 0.7) { this.piseta.updateMatrixWorld(); chorroDe = this.piseta.localToWorld(new THREE.Vector3(0.06, 0.21, 0)); chorroA = this.probeta.localToWorld(new THREE.Vector3(0, 0.2, 0)); }
    } else if (tr?.kind === 'waste') {
      // El matraz se lleva hasta el recipiente de residuos (al fondo a la derecha) y vuelve.
      const ida = suave(progreso / 0.35), vuelta = suave((progreso - 0.8) / 0.2), mover = ida * (1 - vuelta);
      const sobre = POS_RESIDUOS.clone().add(new THREE.Vector3(-0.1, 0.62, 0));
      const medio = POS_MATRAZ.clone().lerp(sobre, 0.5).add(new THREE.Vector3(0, 0.45, 0.5));
      this.matraz.position.copy(mover < 0.5 ? POS_MATRAZ.clone().lerp(medio, mover * 2) : medio.clone().lerp(sobre, mover * 2 - 1));
      this.matraz.rotation.z = -mezclar(0, 2.1, suave((progreso - 0.35) / 0.2)) * (1 - vuelta);
      if (progreso > 0.5 && progreso < 0.8) { this.matraz.updateMatrixWorld(); chorroDe = this.matraz.localToWorld(new THREE.Vector3(0, 0.18, 0)); chorroA = POS_RESIDUOS.clone().add(new THREE.Vector3(0, 0.44, 0)); }
    }
    this.liquidoProbeta.fijar(0, mlProbeta);
    (this.liquidoProbeta.malla.material as THREE.MeshStandardMaterial).color.set(h.cylinder.reagent ? reagents[h.cylinder.reagent].look.contents : '#e8f1f3');
    const gramos = h.balance.grams;
    this.dibujarPantalla(`${gramos.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g`);
    this.monton.visible = gramos > 0.005;
    if (this.monton.visible) {
      this.monton.scale.setScalar(clamp(Math.cbrt(gramos) * 0.75, 0.25, 1.5));
      (this.monton.material as THREE.MeshStandardMaterial).color.set(h.balance.reagent ? reagents[h.balance.reagent].look.contents : '#ffffff');
    }

    // Matraz: volumen, color de la disolución, precipitado (nube que sedimenta) y burbujas de gas.
    this.analisis = analyzeMixture(h.mixture);
    const vol = this.analisis.volumeMl;
    const solido = this.analisis.solids.reduce((s, x) => s + x.grams, 0);
    if (solido > this.solidoPrevioG + 1e-7) this.suspendidoG += solido - this.solidoPrevioG;
    this.suspendidoG = clamp(this.suspendidoG, 0, solido); this.solidoPrevioG = solido;
    if (dt > 0) this.suspendidoG *= Math.exp(-dt / 10);
    const turbidez = vol > 0 ? 1 - Math.exp(-250 * this.suspendidoG / vol) : 0;
    const sedimentoMl = vol > 0 ? Math.min((solido - this.suspendidoG) / 0.1, vol * 0.6) : 0;
    const c = this.analisis.color;
    const intensidad = vol <= 0 || c.color === '#cfe6ee' ? 0 : clamp((c.opacity - 0.2) / 0.72, 0, 1);
    const colorSolido = new THREE.Color(this.analisis.solids[0]?.color ?? '#f2f2ee');
    this.matMatraz.color.set(intensidad > 0 ? c.color : '#e6f0f2').lerp(colorSolido, turbidez);
    this.matMatraz.opacity = clamp(0.22 + 0.6 * intensidad + 0.7 * turbidez, 0, 0.96);
    this.matMatraz.roughness = mezclar(0.08, 0.6, turbidez);
    (this.sedimento.malla.material as THREE.MeshStandardMaterial).color.copy(colorSolido);
    const restante = tr?.kind === 'waste' ? 1 - clamp((progreso - 0.5) / 0.3, 0, 1) : 1;
    this.liquidoMatraz.fijar(Math.max(0, sedimentoMl) * restante, vol * restante);
    this.sedimento.fijar(0, Math.max(0, sedimentoMl) * restante);
    const b = h.burst;
    const edad = b ? (Date.now() - b.at) / 1000 : 99;
    const gas = b && b.gasMol > 0 && edad < 6 && vol > 0 ? clamp(b.vigor, 0.25, 1) * (1 - edad / 6) : 0;
    this.burbujas.visible = gas > 0.02;
    if (this.burbujas.visible) {
      const altura = 0.003 + Math.min(0.14, vol / 500 * 0.11 + 0.012);
      const p = this.burbujas.geometry.getAttribute('position') as THREE.BufferAttribute, semilla = this.burbujas.userData.semilla as Float32Array;
      for (let i = 0; i < p.count; i++) {
        const fase = (semilla[i * 3 + 1] + t * (0.5 + semilla[i * 3] * 0.9)) % 1;
        const radio = 0.042 * (1 - fase * altura / 0.2) * Math.sqrt(semilla[i * 3 + 2]), ang = semilla[i * 3] * 40 + t * 0.5;
        p.setXYZ(i, Math.cos(ang) * radio, 0.004 + fase * altura, Math.sin(ang) * radio);
      }
      p.needsUpdate = true;
      (this.burbujas.material as THREE.PointsMaterial).opacity = 0.9 * gas;
    }

    // Chorro desde el frasco de la mano (mantener el clic) hacia la probeta, la balanza o el matraz.
    if (!chorroDe && h.pouring?.stream && vertiendoMano && (Date.now() - h.pouring.startedAt) > 300) {
      const g = this.frascos.get(h.pouring.reagent);
      const destino = h.pouring.target === 'cylinder' ? this.probeta.localToWorld(new THREE.Vector3(0, 0.26, 0))
        : h.pouring.target === 'balance' ? this.navecilla.localToWorld(new THREE.Vector3(0, 0.01, 0)) : this.matraz.localToWorld(new THREE.Vector3(0, 0.18, 0));
      if (g) { g.updateMatrixWorld(); chorroDe = g.localToWorld(new THREE.Vector3(0, FORMA[g.userData.forma as keyof typeof FORMA].alto, 0)); chorroA = destino; chorroColor = reagents[h.pouring.reagent].look.contents; }
    }
    if (chorroDe && chorroA) {
      const d = chorroA.clone().sub(chorroDe); const largo = d.length();
      this.chorro.position.copy(chorroDe).addScaledVector(d, 0.5);
      this.chorro.scale.set(1, largo, 1);
      this.chorro.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      this.matChorro.color.set(chorroColor);
      this.chorro.visible = true;
    } else this.chorro.visible = false;

    // Protección: lo que ya llevas puesto desaparece del estante. Ambiente: llamas y ducha.
    this.gafas.visible = !lab.ppe.goggles; this.guantes.visible = !lab.ppe.gloves;
    for (const l of this.llamas) if (l.encendida) (l.malla.material as THREE.ShaderMaterial).uniforms.t.value = t;
    this.ducha.visible = performance.now() < this.duchaHasta;

    // Marcas de guía: objetivos del primer paso sin hacer.
    const ids = new Set(marcar);
    for (const [id, s] of this.marcas) {
      const o = this.objetos.get(id)!;
      const enMano = id.startsWith('reagent:') && o.grupo.parent !== this.raiz;
      s.visible = ids.has(id) && !enMano && o.grupo.visible;
      if (s.visible) {
        const p = o.zona.getWorldPosition(new THREE.Vector3());
        const alto = (o.zona.geometry as THREE.BoxGeometry).parameters.height;
        s.position.set(p.x, p.y + alto / 2 + 0.07 + Math.sin(t * 3.5) * 0.02, p.z);
      }
    }
  }

  get suspension() { return this.suspendidoG; }
}
