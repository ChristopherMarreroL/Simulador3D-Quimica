import * as THREE from 'three';
import { useHood } from '../../src/state/hood';
import { useLab } from '../../src/state/lab';
import { cargarEscena } from './escena';
import { calcularGuia } from './guia';
import { Hud } from './hud';
import { Jugador } from './jugador';
import { Objetos } from './objetos';
import { Partida } from './partida';
import { recorrido } from './recorrido';
import { guardarCalidad, leerCalidad, PERFILES } from './util';

const calidad = leerCalidad();
const perfil = PERFILES[calidad];
const parametros = new URLSearchParams(location.search);
const lienzo = document.getElementById('lienzo') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: perfil.msaa, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(perfil.escala * Math.min(window.devicePixelRatio, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Cámara física de Unreal (ISO 400, 1/60 s, f/2,8 con compensación): aquí, AgX y una exposición fija calibrada
// para el interior (unos 500 lx). La viñeta y el grano van en CSS (#pelicula), sin coste de render.
// «Más viveza» (23 de noviembre de 2026): el tono neutro de Khronos conserva la saturación que AgX apagaba.
const tono = parametros.get('tono') ?? 'neutro';
renderer.toneMapping = tono === 'agx' ? THREE.AgXToneMapping : tono === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NeutralToneMapping;
renderer.toneMappingExposure = Number(parametros.get('exposicion') ?? (tono === 'agx' ? 2.2 : tono === 'aces' ? 2.0 : 1.75));

const escena = new THREE.Scene();
escena.background = new THREE.Color(0x0c0e12);
const jugador = new Jugador(window.innerWidth / window.innerHeight);
escena.add(jugador.camara);
const partida = new Partida();
let empezado = false;
const hud = new Hud(document.getElementById('hud')!, calidad, {
  empezar: () => { if (parametros.has('recorrido')) hud.pausa(false, false); else void lienzo.requestPointerLock(); },
  calidad: c => { guardarCalidad(c); const u = new URL(location.href); u.searchParams.delete('calidad'); location.href = u.toString(); },
  reiniciar: () => partida.iniciar(),
  elegir: id => partida.elegir(id),
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  jugador.camara.aspect = window.innerWidth / window.innerHeight;
  jugador.camara.updateProjectionMatrix();
});
document.addEventListener('pointerlockchange', () => {
  const capturado = document.pointerLockElement === lienzo;
  if (capturado) empezado = true;
  hud.pausa(!capturado, !empezado);
  if (!capturado) partida.soltarUsar();
});

let objetivo: string | null = null;
const fps = { cuadros: 0, desde: performance.now(), valor: 0, tiempos: [] as number[] };

async function arrancar() {
  const sala = await cargarEscena(calidad, t => hud.progreso(t));
  escena.add(sala.estaticos, sala.guillotina);
  hud.progreso('Colocando el material…');
  const objetos = await Objetos.crear(sala.datos);
  partida.ambiente = id => objetos.ambiente(id);
  partida.alAbrirMisiones = () => hud.abrirMisiones();
  escena.add(objetos.raiz);
  await jugador.cargarManos();
  // Primera compilación de los materiales y captura de los reflejos del cuarto.
  renderer.compile(escena, jugador.camara);
  sala.capturarEntorno(renderer, escena);
  partida.iniciar();
  jugador.conectar(lienzo, {
    usar: (pulsado, tecla) => { if (pulsado) partida.pulsarUsar(tecla); else partida.soltarUsar(); },
    dejar: () => partida.dejar(),
    mano: m => partida.cambiarMano(m),
    anotar: () => partida.anotar(),
    misiones: () => hud.abrirMisiones(),
    pistas: () => hud.alternarPistas(),
    pausa: () => document.exitPointerLock(),
  });
  hud.listo();

  const reloj = new THREE.Clock();
  const cuadro = () => {
    const dt = Math.min(reloj.getDelta(), 0.1), t = reloj.elapsedTime;
    jugador.vertiendoMano = partida.vertiendo || (useHood.getState().pouring?.stream ?? false) ? useLab.getState().hand : null;
    jugador.actualizar(dt, false);
    jugador.camara.updateMatrixWorld();
    objetivo = jugador.apuntar(objetos.zonas, sala.oclusores);
    partida.apuntar(objetivo);
    partida.avanzar(dt);
    // Guía: flecha sobre el objeto del paso y, si queda fuera de la vista, indicador en el borde de la pantalla.
    const guia = calcularGuia(partida);
    objetos.actualizar(t, dt, jugador.anclas, objetivo, guia.objetivo ? [guia.objetivo] : [], jugador.vertiendoMano);
    const punto = guia.objetivo ? objetos.encima(guia.objetivo) : null;
    let senal: { x: number; y: number; fuera: boolean; angulo: number; metros: number } | null = null;
    if (punto) {
      const cam = jugador.camara;
      const local = punto.clone().applyMatrix4(cam.matrixWorldInverse);
      const ndc = punto.clone().project(cam);
      const fuera = local.z > 0 || Math.abs(ndc.x) > 0.92 || Math.abs(ndc.y) > 0.88;
      const angulo = Math.atan2(-local.y, local.x);            // en pantalla: x a la derecha, y hacia abajo
      const radio = 0.4;
      senal = fuera
        ? { x: 0.5 + Math.cos(angulo) * radio * Math.min(1, window.innerHeight / window.innerWidth * 1.6), y: 0.5 + Math.sin(angulo) * radio, fuera, angulo, metros: cam.position.distanceTo(punto) }
        : { x: ndc.x / 2 + 0.5, y: 0.5 - ndc.y / 2, fuera, angulo, metros: cam.position.distanceTo(punto) };
    }
    hud.actualizar(partida, objetivo, objetos.suspension);
    hud.guiar(guia, senal, objetivo);
    renderer.render(escena, jugador.camara);
    // Medidor de fotogramas (pausa y recorrido automático).
    fps.cuadros++; fps.tiempos.push(dt * 1000); if (fps.tiempos.length > 600) fps.tiempos.shift();
    const ahora = performance.now();
    if (ahora - fps.desde > 1000) {
      fps.valor = fps.cuadros * 1000 / (ahora - fps.desde); fps.cuadros = 0; fps.desde = ahora;
      const info = renderer.info.render;
      hud.fps(`${fps.valor.toFixed(0)} FPS · ${info.calls} llamadas · ${(info.triangles / 1000).toFixed(0)} k triángulos · ${renderer.domElement.width}×${renderer.domElement.height} · calidad ${calidad}`);
    }
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);

  // Ganchos para las pruebas de navegador (tests/) y el recorrido automático (?recorrido).
  Object.assign(window, { __campana: { partida, jugador, objetos, escena, renderer, useHood, useLab, fps, objetivo: () => objetivo, calidad } });
  if (parametros.has('recorrido')) { hud.pausa(false, false); empezado = true; }
  if (parametros.has('recorrido')) void recorrido(partida, jugador, objetos, () => objetivo, fps, parametros.get('recorrido') || 'cloruro-plata');
}

arrancar().catch(e => { console.error(e); hud.progreso('No se pudo cargar el laboratorio: ' + (e as Error).message); });
