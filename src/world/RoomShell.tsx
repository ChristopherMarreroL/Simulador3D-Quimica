import { useMemo } from 'react';
import * as THREE from 'three';
import { aoGradient, glass, materials, radialShadow } from './materials';

/** Soft contact shadow on a horizontal surface: grounds objects without real-time ambient occlusion. */
export function ContactShadow({ position, size, opacity = 0.55 }: { position: [number, number, number]; size: [number, number]; opacity?: number }) {
  return <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1} userData={{ ignoreRay: true }}>
    <planeGeometry args={size}/><meshBasicMaterial map={radialShadow} color="#000000" transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-2}/>
  </mesh>;
}
/** Darkening that fades away from a wall or cabinet base. `fade` is the direction it fades towards. */
export function FloorAO({ x, z, length, depth = 0.45, fade, opacity = 0.8, y = 0.002 }: { x: number; z: number; length: number; depth?: number; fade: '+z' | '-z' | '+x' | '-x'; opacity?: number; y?: number }) {
  const rotation = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[fade];
  const offset = depth / 2; const dir = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[fade];
  return <group position={[x + dir[0] * offset, y, z + dir[1] * offset]} rotation={[0, rotation, 0]} userData={{ ignoreRay: true }}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}><planeGeometry args={[length, depth]}/><meshBasicMaterial map={aoGradient} color="#000000" transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-2}/></mesh>
  </group>;
}
function Slab({ position, size, material = materials.wall }: { position: [number, number, number]; size: [number, number, number]; material?: THREE.Material }) {
  return <mesh position={position} material={material} castShadow receiveShadow><boxGeometry args={size}/></mesh>;
}

/** Bright exterior seen through the windows (sky, trees and a neighbouring building), drawn procedurally. */
function OutsideView() {
  const texture = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 768; const x = c.getContext('2d')!;
    const sky = x.createLinearGradient(0, 0, 0, 768); sky.addColorStop(0, '#8fbfe6'); sky.addColorStop(0.5, '#cfe3f3'); sky.addColorStop(0.72, '#eef4f5'); sky.addColorStop(1, '#f3f1ea');
    x.fillStyle = sky; x.fillRect(0, 0, 2048, 768);
    let seed = 3; const r = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    x.filter = 'blur(10px)';
    for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.35})`; x.beginPath(); x.ellipse(r() * 2048, 50 + r() * 230, 70 + r() * 170, 12 + r() * 30, 0, 0, Math.PI * 2); x.fill(); }
    // Distant hills and buildings, slightly hazy.
    x.filter = 'blur(3px)';
    x.fillStyle = '#b9c9c4'; x.beginPath(); x.moveTo(0, 520); for (let i = 0; i <= 20; i++) x.lineTo(i * 103, 470 - Math.sin(i * 0.9) * 30 - r() * 25); x.lineTo(2048, 768); x.lineTo(0, 768); x.fill();
    for (const [bx, bw, bh] of [[260, 180, 120], [520, 120, 170], [1500, 260, 150]]) { x.fillStyle = '#d7d3c9'; x.fillRect(bx, 520 - bh, bw, bh); x.fillStyle = '#b8c4ca'; for (let j = 0; j < bh / 30 - 1; j++) for (let k = 0; k < bw / 34; k++) x.fillRect(bx + 10 + k * 34, 535 - bh + j * 30, 18, 14); }
    x.filter = 'none';
    // Near building across the courtyard.
    const wall = x.createLinearGradient(1100, 0, 1820, 0); wall.addColorStop(0, '#e2ddd2'); wall.addColorStop(1, '#cfc9bc');
    x.fillStyle = wall; x.fillRect(1100, 280, 720, 360); x.fillStyle = '#bdb6a8'; x.fillRect(1100, 280, 720, 16);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) { const g = x.createLinearGradient(0, 330 + j * 95, 0, 390 + j * 95); g.addColorStop(0, '#8fa8b8'); g.addColorStop(1, '#c4d3da'); x.fillStyle = g; x.fillRect(1130 + i * 76, 330 + j * 95, 48, 58); x.fillStyle = '#f2efe8'; x.fillRect(1128 + i * 76, 388 + j * 95, 52, 4); }
    // Trees and palms with soft shading.
    const tree = (tx: number, ty: number, s2: number, hue: number) => { const g = x.createRadialGradient(tx - s2 * 0.3, ty - s2 * 0.4, s2 * 0.1, tx, ty, s2); g.addColorStop(0, `hsl(${hue},38%,52%)`); g.addColorStop(1, `hsl(${hue},40%,30%)`); x.fillStyle = g; x.beginPath(); x.ellipse(tx, ty, s2, s2 * 0.82, 0, 0, Math.PI * 2); x.fill(); };
    for (let i = 0; i < 34; i++) tree(r() * 2048, 560 + r() * 90, 40 + r() * 80, 95 + r() * 25);
    const palm = (px: number, base: number, h: number) => {
      x.strokeStyle = '#7b6a55'; x.lineWidth = 9; x.beginPath(); x.moveTo(px, base); x.quadraticCurveTo(px + 18, base - h / 2, px + 8, base - h); x.stroke();
      for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; x.strokeStyle = `hsl(${100 + k * 3},40%,${30 + k % 3 * 6}%)`; x.lineWidth = 7; x.beginPath(); x.moveTo(px + 8, base - h); x.quadraticCurveTo(px + 8 + Math.cos(a) * 60, base - h - 30 + Math.sin(a) * 10, px + 8 + Math.cos(a) * 110, base - h + 40 + Math.abs(Math.sin(a)) * 30); x.stroke(); }
    };
    palm(380, 660, 300); palm(900, 650, 250); palm(1980, 660, 320);
    x.fillStyle = '#c9c4b7'; x.fillRect(0, 650, 2048, 118); x.fillStyle = '#b4ae9f'; x.fillRect(0, 650, 2048, 6);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return <mesh position={[8.6, 2.1, 1]} rotation={[0, -Math.PI / 2, 0]} userData={{ ignoreRay: true }}><planeGeometry args={[16, 6]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>;
}

/** White aluminium sliding window, as in the reference photos: frame, mullion, two panes and a sill. */
function SlidingWindow({ z, width, bottom, top }: { z: number; width: number; bottom: number; top: number }) {
  const h = top - bottom, y = (bottom + top) / 2, frame = materials.aluminium;
  return <group position={[5.96, y, z]}>
    {[-1, 1].map(s => <mesh key={`v${s}`} position={[0, 0, s * width / 2]} material={frame}><boxGeometry args={[0.09, h + 0.06, 0.05]}/></mesh>)}
    {[-1, 1].map(s => <mesh key={`h${s}`} position={[0, s * h / 2, 0]} material={frame}><boxGeometry args={[0.09, 0.05, width + 0.06]}/></mesh>)}
    <mesh position={[-0.01, 0, 0]} material={frame}><boxGeometry args={[0.06, h, 0.04]}/></mesh>
    {[-1, 1].map(s => <mesh key={`p${s}`} position={[s * 0.012, 0, s * width / 4]} material={glass.clear}><boxGeometry args={[0.006, h - 0.04, width / 2 - 0.02]}/></mesh>)}
    <mesh position={[-0.07, -h / 2 - 0.02, 0]} material={materials.wall}><boxGeometry args={[0.12, 0.03, width + 0.1]}/></mesh>
  </group>;
}
export const WINDOWS = [{ z: 0, width: 2 }, { z: 2.25, width: 2 }];
const WIN_BOTTOM = 1.5, WIN_TOP = 2.9;

export function RoomShell({ closed }: { closed: boolean }) {
  const T = 0.12, H = 3.4;
  return <>
    <mesh position={[0, -0.08, 0]} receiveShadow material={materials.floor}><boxGeometry args={[12, 0.16, 10]}/></mesh>
    <Slab position={[0, H / 2, -5]} size={[12, H, T]}/>
    <Slab position={[-6, H / 2, 0]} size={[T, H, 10]}/>
    {/* Right wall with real openings so daylight and the exterior come through the windows. */}
    <Slab position={[6, WIN_BOTTOM / 2, 0]} size={[T, WIN_BOTTOM, 10]}/>
    <Slab position={[6, (WIN_TOP + H) / 2, 0]} size={[T, H - WIN_TOP, 10]}/>
    {[[-5, -1], [1, 1.25], [3.25, 5]].map(([a, b]) => <Slab key={a} position={[6, (WIN_BOTTOM + WIN_TOP) / 2, (a + b) / 2]} size={[T, WIN_TOP - WIN_BOTTOM, b - a]}/>)}
    {WINDOWS.map(w => <SlidingWindow key={w.z} z={w.z} width={w.width} bottom={WIN_BOTTOM} top={WIN_TOP}/>)}
    <OutsideView/>
    {closed && <Slab position={[0, H / 2, 5]} size={[12, H, T]}/>}
    {/* Ambient-occlusion strips where walls meet the floor. */}
    <FloorAO x={0} z={-4.94} length={11.9} fade="+z"/>
    <FloorAO x={-5.94} z={0} length={9.9} fade="+x"/>
    <FloorAO x={5.94} z={0} length={9.9} fade="-x"/>
    {closed && <FloorAO x={0} z={4.94} length={11.9} fade="-z"/>}
  </>;
}
