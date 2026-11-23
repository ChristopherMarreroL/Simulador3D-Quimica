import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import cieloUrl from '../../art/terceros/polyhaven/quadrangle_sunny/quadrangle_sunny_2k.hdr?url';
import guillotinaUrl from '../../art/export/SM_Campana_Guillotina.glb?url';
import { ue, type Calidad, PERFILES } from './util';

/**
 * Sala estática con la luz horneada en Blender (art/blender/web_campana_hornear.py): cada malla lleva su mapa de
 * irradiancia en UV1, el color sale de las texturas CC0 con UV0 a escala real y los reflejos de una captura del
 * propio cuarto (como las Reflection Captures de Unreal). No hay luces en tiempo real: el coste de la luz es nulo.
 */
interface DatosEscena {
  luz: { solDireccion: [number, number, number]; hdriFuerza: number; hdriGiroBlenderRad: number; leds: [number, number, number][]; sala: [number, number, number, number, number]; islas: [number, number][]; lavabos: number[] };
  mapas: Record<string, { archivo: string; resolucion: number }>;
}
export interface Escena {
  estaticos: THREE.Object3D;
  /** Mallas que tapan la puntería (paredes, muebles). El vidrio de la guillotina y la encimera no cuentan, como en Unreal. */
  oclusores: THREE.Object3D[];
  guillotina: THREE.Object3D;
  /** Medidas de diseño exportadas por el guion de Blender (cm, ejes de Unreal). */
  datos: { sala: [number, number, number, number, number]; islas: [number, number][]; lavabos: number[] };
  capturarEntorno: (renderer: THREE.WebGLRenderer, escena: THREE.Scene) => void;
}

const BASE = import.meta.env.BASE_URL;
/** Color propio por objeto (lineal). En los que llevan textura multiplica a la textura. */
const ACENTOS: [RegExp, [number, number, number]][] = [
  [/^Taburetes_Asientos/, [0.03, 0.22, 0.62]], [/^Meseta_Cuerpo/, [0.20, 0.42, 0.66]], [/^Altos_Lavabos/, [0.20, 0.42, 0.66]],
  [/^Pared_Trasera$/, [0.62, 1.12, 1.18]], [/^Pared_Izq_Bajo$/, [0.62, 1.12, 1.18]], [/^Puerta_Hoja/, [0.60, 0.34, 0.14]], [/^Escritorio_Tablero/, [0.66, 0.42, 0.20]],
  [/^Papeleras/, [0.05, 0.30, 0.55]], [/^Bombonas$/, [0.10, 0.42, 0.24]], [/^Carrito/, [1.0, 1.0, 1.0]], [/^Dispensadores_Papel/, [0.85, 0.87, 0.9]],
];
/** Irradiancia de Blender («luz difusa», albedo × L) → three.js (albedo × E / π). */
const LM_INTENSIDAD = Math.PI;

function cargarTextura(cargador: THREE.TextureLoader, nombre: string, color: boolean, metros: number, anis: number) {
  const t = cargador.load(`${BASE}texturas/${nombre}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / metros, 1 / metros);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anis;
  return t;
}

/** Quita la irradiancia del entorno (ya está en el mapa de luz) y ocluye sus reflejos donde el mapa está oscuro. */
function soloReflejos(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = s => {
    s.fragmentShader = s.fragmentShader
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>`)
      .replace('void main() {', 'float lmOcc = 1.0;\nvoid main() {');
    s.fragmentShader = s.fragmentShader.replace('#include <lights_fragment_maps>', THREE.ShaderChunk.lights_fragment_maps
      .replace('irradiance += lightMapIrradiance;', 'irradiance += lightMapIrradiance;\n\t\tlmOcc = clamp( dot( lightMapIrradiance, vec3( 0.2126, 0.7152, 0.0722 ) ) * 2.2, 0.0, 1.0 );')
      .replace('iblIrradiance += getIBLIrradiance( geometryNormal );', '#ifndef USE_LIGHTMAP\n\t\t\tiblIrradiance += getIBLIrradiance( geometryNormal );\n\t\t\t#endif')
      .replace('radiance += iblRadiance;', 'radiance += iblRadiance * lmOcc;'));
  };
  m.customProgramCacheKey = () => 'soloReflejos';
}

export async function cargarEscena(calidad: Calidad, alProgreso: (t: string) => void): Promise<Escena> {
  const anis = PERFILES[calidad].anisotropia;
  const datos: DatosEscena = await (await fetch(`${BASE}escena/escena.json`)).json();
  const gltf = new GLTFLoader();
  const hdr = new HDRLoader().setDataType(THREE.HalfFloatType);
  const tex = new THREE.TextureLoader();
  alProgreso('Cargando la sala…');
  const [sala, guillotinaGltf] = await Promise.all([
    gltf.loadAsync(`${BASE}escena/sala.glb`), gltf.loadAsync(guillotinaUrl),
  ]);

  // Materiales por nombre, con las texturas de art/blender/web_texturas.py (UV0: 1 unidad = 1 m).
  const T = (n: string, color: boolean, m: number) => cargarTextura(tex, n, color, m, anis);
  const normalDX = (t: THREE.Texture, f: number) => new THREE.Vector2(f, -f);    // mapas DirectX: verde invertido
  const acero = () => new THREE.MeshStandardMaterial({ map: T('acero_c', true, 0.3), roughnessMap: T('acero_r', false, 0.3), normalMap: T('acero_n', false, 0.3), normalScale: normalDX(new THREE.Texture(), 0.5), metalness: 0.55, roughness: 1 });
  const blanco = (rgb: [number, number, number], rug: 'laminado_r' | 'pintado_r') => new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...rgb), roughnessMap: T(rug, false, 0.5), normalMap: T('plastico_n', false, 0.5), normalScale: normalDX(new THREE.Texture(), 0.25), roughness: 1 });
  const liso = (rgb: [number, number, number], rug: number, metal = 0) => new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...rgb), roughness: rug, metalness: metal });
  const materiales: Record<string, () => THREE.Material> = {
    M_Suelo: () => new THREE.MeshStandardMaterial({ map: T('suelo_c', true, 1.5), roughnessMap: T('suelo_r', false, 1.5), normalMap: T('suelo_n', false, 1.5), normalScale: normalDX(new THREE.Texture(), 0.6), roughness: 1 }),
    M_Pared: () => new THREE.MeshStandardMaterial({ map: T('pared_c', true, 2), roughnessMap: T('pared_r', false, 2), normalMap: T('pared_n', false, 2), normalScale: normalDX(new THREE.Texture(), 0.35), roughness: 1 }),
    M_Techo: () => { const off = (t: THREE.Texture) => { t.offset.set(0.30 / 3.6, 0.40 / 3.6); return t; }; return new THREE.MeshStandardMaterial({ map: off(T('techo_c', true, 3.6)), roughnessMap: off(T('techo_r', false, 3.6)), normalMap: off(T('techo_n', false, 3.6)), normalScale: normalDX(new THREE.Texture(), 0.8), roughness: 1 }); },
    M_Granito_AzulPerla: () => new THREE.MeshStandardMaterial({ map: T('granito_c', true, 0.32), roughnessMap: T('granito_r', false, 0.32), roughness: 1 }),
    M_Acero_Satinado: acero,
    M_Laminado_Blanco: () => blanco([0.60, 0.60, 0.58], 'laminado_r'),
    M_Acero_Pintado_Blanco: () => blanco([0.64, 0.65, 0.64], 'pintado_r'),
    M_Resina_Interior: () => liso([0.50, 0.52, 0.51], 0.5),
    M_Aluminio_Anodizado: () => liso([0.80, 0.80, 0.81], 0.35, 0.6),
    M_Marco_Ventana: () => liso([0.70, 0.70, 0.70], 0.35, 0.5),
    M_Plastico_Negro: () => liso([0.022, 0.022, 0.024], 0.45),
    M_Zocalo: () => liso([0.03, 0.032, 0.035], 0.55),
    M_Llave_Azul: () => liso([0.02, 0.10, 0.45], 0.35),
    M_Llave_Amarillo: () => liso([0.75, 0.48, 0.02], 0.35),
    M_Llave_Verde: () => liso([0.02, 0.30, 0.06], 0.35),
    M_Panel_Control: () => liso([0.008, 0.009, 0.011], 0.06),
    M_Puerta: () => liso([0.42, 0.30, 0.20], 0.5),
    M_Tablero: () => liso([0.80, 0.80, 0.80], 0.35),
    M_Residuos: () => liso([0.62, 0.55, 0.20], 0.5),
    M_HDPE: () => liso([0.80, 0.80, 0.78], 0.4),
    M_Seguridad_Amarillo: () => liso([0.80, 0.58, 0.02], 0.4),
    M_Seguridad_Verde: () => liso([0.02, 0.38, 0.14], 0.4),
    M_Rojo: () => liso([0.60, 0.03, 0.02], 0.35),
    M_AC: () => liso([0.72, 0.73, 0.72], 0.4),
    M_Azul_Seguridad: () => liso([0.04, 0.14, 0.42], 0.4),
  };
  const cache = new Map<string, THREE.Material>();
  const lmCache = new Map<string, Promise<THREE.DataTexture>>();
  const pendientes: Promise<unknown>[] = [];
  const oclusores: THREE.Object3D[] = [];
  const estaticos = sala.scene;
  estaticos.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    // El nombre del objeto de Blender es el del nodo padre si el GLB separó la malla por materiales.
    const nombre = datos.mapas[o.name] ? o.name : datos.mapas[o.parent?.name ?? ''] ? o.parent!.name : o.name;
    const info = datos.mapas[nombre];
    const lista = Array.isArray(o.material) ? o.material : [o.material];
    const nuevos = lista.map(m => {
      const base = (m as THREE.Material).name.split('.')[0];
      if (base === 'M_LED_Emisivo') return new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.88).multiplyScalar(2.3) });
      const fabrica = materiales[base];
      const clave = `${base}|${info?.archivo ?? ''}`;
      if (!cache.has(clave)) {
        const mat = (fabrica ? fabrica() : liso([0.5, 0.5, 0.5], 0.5)) as THREE.MeshStandardMaterial;
        if (info) {
          if (!lmCache.has(info.archivo)) lmCache.set(info.archivo, hdr.loadAsync(`${BASE}escena/${info.archivo}`));
          pendientes.push(lmCache.get(info.archivo)!.then(t => { t.channel = 1; t.flipY = false; mat.lightMap = t; mat.lightMapIntensity = LM_INTENSIDAD; mat.needsUpdate = true; }));
          soloReflejos(mat);
        }
        cache.set(clave, mat);
      }
      return cache.get(clave)!;
    });
    // Acentos de color (23 de noviembre de 2026, «más viveza»): se tiñe el color propio y se conserva la luz horneada.
    const tinte = ACENTOS.find(([patron]) => patron.test(nombre))?.[1];
    const teñidos = tinte ? nuevos.map(m => { const c = (m as THREE.MeshStandardMaterial).clone(); (m as THREE.MeshStandardMaterial).onBeforeCompile && (c.onBeforeCompile = (m as THREE.MeshStandardMaterial).onBeforeCompile); c.customProgramCacheKey = (m as THREE.MeshStandardMaterial).customProgramCacheKey; c.color.setRGB(...tinte); return c; }) : nuevos;
    o.material = Array.isArray(o.material) ? teñidos : teñidos[0];
    o.matrixAutoUpdate = false; o.updateMatrix();
    if (!/Encimera|Granito|Bandeja|Ducha_Zona|Lavabos_Cubetas/.test(nombre)) oclusores.push(o);
  });
  alProgreso('Cargando la luz horneada…');
  await Promise.all(pendientes);

  // Guillotina: no se hornea (es translúcida); su marco lo iluminan los reflejos del cuarto.
  const guillotina = guillotinaGltf.scene;
  guillotina.traverse(o => {
    if (o.name.startsWith('UCX_')) { o.visible = false; return; }
    if (!(o instanceof THREE.Mesh)) return;
    const lista = Array.isArray(o.material) ? o.material : [o.material];
    const nuevos = lista.map(m => m.name.startsWith('M_Vidrio')
      ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.02, 0.022, 0.021), roughness: 0.02, metalness: 0, transparent: true, opacity: 0.1, envMapIntensity: 1, depthWrite: false, side: THREE.DoubleSide })
      : (materiales[m.name.split('.')[0]] ?? (() => liso([0.8, 0.8, 0.8], 0.35, 0.6)))());
    o.material = Array.isArray(o.material) ? nuevos : nuevos[0];
  });
  guillotina.traverse(o => { if (o instanceof THREE.Mesh) o.renderOrder = 5; });

  // Exterior por la ventana: el HDRI CC0 sin iluminar, con el mismo giro y la misma fuerza que en el horneado.
  alProgreso('Cargando el cielo…');
  const cielo = await hdr.loadAsync(cieloUrl);
  const ventanaCielo = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { mapa: { value: cielo }, fuerza: { value: datos.luz.hdriFuerza }, giro: { value: datos.luz.hdriGiroBlenderRad } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // Dirección de three (x, y, z) → Blender (x, -z, y); el mundo de Blender busca en R(-giro)·d; lat-long de Blender.
    fragmentShader: `uniform sampler2D mapa; uniform float fuerza; uniform float giro; varying vec3 vDir;
      void main(){ vec3 d = normalize(vec3(vDir.x, -vDir.z, vDir.y)); float c = cos(-giro), s = sin(-giro);
        d = vec3(c*d.x - s*d.y, s*d.x + c*d.y, d.z);
        vec2 uv = vec2(-atan(d.y, d.x) / 6.2831853 + 0.5, atan(d.z, length(d.xy)) / 3.1415927 + 0.5);
        gl_FragColor = vec4(texture2D(mapa, uv).rgb * fuerza, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  ventanaCielo.position.copy(ue(0, 400, 150));
  ventanaCielo.renderOrder = -10;
  estaticos.add(ventanaCielo);

  // Paneles LED del techo (60 × 60 cm, 4000 lm → unos 3800 cd/m²: 5,5 en unidades de Blender), en una sola malla.
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.93, 0.84).multiplyScalar(5.5) });
  const marco = liso([0.85, 0.85, 0.85], 0.4);
  const paneles = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.56, 0.56).rotateX(Math.PI / 2), led, datos.luz.leds.length);
  const marcos = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.012, 0.6), marco, datos.luz.leds.length);
  datos.luz.leds.forEach(([x, y, z], i) => {
    paneles.setMatrixAt(i, new THREE.Matrix4().setPosition(ue(x, y, z - 1.4)));
    marcos.setMatrixAt(i, new THREE.Matrix4().setPosition(ue(x, y, z - 0.5)));
  });
  estaticos.add(marcos, paneles);

  /** Captura de reflejos del propio cuarto (como una Sphere Reflection Capture), una vez tras cargar. */
  const capturarEntorno = (renderer: THREE.WebGLRenderer, escena: THREE.Scene) => {
    const rt = new THREE.WebGLCubeRenderTarget(PERFILES[calidad].entorno, { type: THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(0.05, 60, rt);
    cam.position.copy(ue(-60, 180, 150));
    const antes = escena.environment;
    escena.environment = null;
    cam.update(renderer, escena);
    const pmrem = new THREE.PMREMGenerator(renderer);
    escena.environment = pmrem.fromCubemap(rt.texture).texture;
    pmrem.dispose(); rt.dispose();
    antes?.dispose();
  };
  return { estaticos, oclusores, guillotina, capturarEntorno, datos: datos.luz };
}
