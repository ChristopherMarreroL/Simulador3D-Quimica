import { useMemo } from 'react';
import * as THREE from 'three';
import { glass, materials } from './materials';
import { ContactShadow, FloorAO } from './RoomShell';

/**
 * Decorative equipment modelled after the reference photos (balances, oven, drying tray, racks, wash
 * bottles, dispensers, outlets, door). They are props: none implements a practice of its own.
 */
type V3 = [number, number, number];
const TOP = 1.16;
function useCanvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, deps: unknown[] = []) {
  return useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; draw(canvas.getContext('2d')!);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
const M = ({ position, rotation, args, material, shadow = true }: { position: V3; rotation?: V3; args: ConstructorParameters<typeof THREE.BoxGeometry>; material: THREE.Material; shadow?: boolean }) =>
  <mesh position={position} rotation={rotation} material={material} castShadow={shadow} receiveShadow><boxGeometry args={args}/></mesh>;
const Cyl = ({ position, rotation, args, material, shadow = true }: { position: V3; rotation?: V3; args: ConstructorParameters<typeof THREE.CylinderGeometry>; material: THREE.Material; shadow?: boolean }) =>
  <mesh position={position} rotation={rotation} material={material} castShadow={shadow}><cylinderGeometry args={args}/></mesh>;

const blueCast = new THREE.MeshStandardMaterial({ color: '#2f5fa8', roughness: 0.45, metalness: 0.2 });
const tealPanel = new THREE.MeshStandardMaterial({ color: '#1f8a8a', roughness: 0.4 });
const creamCap = new THREE.MeshStandardMaterial({ color: '#efe6cc', roughness: 0.5 });
const amber = new THREE.MeshPhysicalMaterial({ color: '#6b3a12', transparent: true, opacity: 0.86, roughness: 0.12, clearcoat: 1 });
const hdpe = new THREE.MeshStandardMaterial({ color: '#f3f2ec', roughness: 0.6, transparent: true, opacity: 0.94 });
const redTip = new THREE.MeshStandardMaterial({ color: '#d8392b', roughness: 0.45 });
const jarLabel = new THREE.MeshStandardMaterial({ color: '#c8873f', roughness: 0.6 });
const extinguisherRed = new THREE.MeshPhysicalMaterial({ color: '#c8231b', roughness: 0.3, clearcoat: 0.8 });
const porcelain = new THREE.MeshPhysicalMaterial({ color: '#fbfbf7', roughness: 0.25, clearcoat: 0.6 });

export function DigitalBalance({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  const screen = useCanvasTexture(256, 96, c => { c.fillStyle = '#b9c7b3'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#20261f'; c.font = 'bold 58px monospace'; c.textAlign = 'right'; c.fillText('0.00 g', 240, 70); });
  return <group position={position} rotation={[0, rotation, 0]}>
    <M position={[0, 0.03, 0]} args={[0.21, 0.06, 0.27]} material={materials.plasticWhite}/>
    <mesh position={[0, 0.045, 0.125]} rotation={[-0.5, 0, 0]} material={materials.plasticWhite}><boxGeometry args={[0.2, 0.05, 0.05]}/></mesh>
    <mesh position={[0, 0.052, 0.142]} rotation={[-0.5, 0, 0]}><planeGeometry args={[0.09, 0.033]}/><meshBasicMaterial map={screen}/></mesh>
    {[-0.07, 0.07].map(x => <Cyl key={x} position={[x, 0.05, 0.14]} rotation={[-0.5 + Math.PI / 2, 0, 0]} args={[0.008, 0.008, 0.006, 12]} material={redTip} shadow={false}/>)}
    <Cyl position={[0, 0.068, -0.02]} args={[0.075, 0.075, 0.006, 32]} material={materials.steel}/>
    <ContactShadow position={[0, 0.002, 0]} size={[0.36, 0.42]} opacity={0.5}/>
  </group>;
}
export function TripleBeamBalance({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <M position={[0, 0.02, 0]} args={[0.48, 0.04, 0.11]} material={blueCast}/>
    <Cyl position={[-0.17, 0.07, 0]} args={[0.012, 0.016, 0.07, 10]} material={materials.steel}/>
    <Cyl position={[-0.17, 0.108, 0]} args={[0.085, 0.085, 0.005, 32]} material={materials.steel}/>
    <M position={[0.06, 0.075, 0]} args={[0.05, 0.07, 0.05]} material={blueCast}/>
    {[0.095, 0.115, 0.135].map((y, i) => <group key={y}><M position={[0.08, y, 0.035]} args={[0.36, 0.008, 0.006]} material={materials.steel} shadow={false}/><M position={[-0.02 + i * 0.07, y + 0.007, 0.035]} args={[0.012, 0.012, 0.01]} material={materials.plasticBlack} shadow={false}/></group>)}
    <M position={[0.255, 0.115, 0.035]} args={[0.006, 0.05, 0.004]} material={materials.plasticBlack} shadow={false}/>
    <ContactShadow position={[0, 0.002, 0]} size={[0.62, 0.24]} opacity={0.5}/>
  </group>;
}
/** Small laboratory drying oven (white cabinet, teal control panel, window, warning labels). */
export function LabOven({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  const panel = useCanvasTexture(256, 64, c => { c.fillStyle = '#16302f'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#ff3b2f'; c.font = 'bold 34px monospace'; c.fillText('105', 18, 44); c.fillStyle = '#ffb02f'; c.fillText('25.0', 140, 44); });
  const labels = useCanvasTexture(64, 256, c => { c.fillStyle = '#ffffff00'; c.clearRect(0, 0, 64, 256); for (let i = 0; i < 4; i++) { c.fillStyle = '#ffd21f'; c.beginPath(); c.moveTo(32, 12 + i * 60); c.lineTo(58, 56 + i * 60); c.lineTo(6, 56 + i * 60); c.closePath(); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#111'; c.font = 'bold 26px Arial'; c.textAlign = 'center'; c.fillText('!', 32, 52 + i * 60); } });
  return <group position={position} rotation={[0, rotation, 0]}>
    <M position={[0, 0.34, 0]} args={[0.56, 0.6, 0.5]} material={materials.laminate}/>
    <M position={[0, 0.06, 0.005]} args={[0.56, 0.12, 0.5]} material={tealPanel}/>
    <mesh position={[-0.08, 0.075, 0.252]}><planeGeometry args={[0.2, 0.05]}/><meshBasicMaterial map={panel} toneMapped={false}/></mesh>
    <M position={[0, 0.37, 0.255]} args={[0.48, 0.48, 0.015]} material={materials.laminate}/>
    <mesh position={[0.02, 0.38, 0.264]}><planeGeometry args={[0.2, 0.27]}/><meshPhysicalMaterial color="#2a3236" roughness={0.08} clearcoat={1} metalness={0.3}/></mesh>
    {[0.3, 0.38, 0.46].map(y => <M key={y} position={[0.02, y, 0.262]} args={[0.18, 0.004, 0.002]} material={materials.steel} shadow={false}/>)}
    <M position={[-0.25, 0.38, 0.27]} args={[0.03, 0.2, 0.03]} material={tealPanel}/>
    <mesh position={[0.281, 0.4, 0.1]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[0.06, 0.24]}/><meshBasicMaterial map={labels} transparent/></mesh>
    <ContactShadow position={[0, 0.002, 0]} size={[0.75, 0.7]} opacity={0.6}/>
  </group>;
}
function Beaker({ position, r = 0.03, h = 0.06, fill = 0 }: { position: V3; r?: number; h?: number; fill?: number }) {
  return <group position={position}>
    <mesh position={[0, h / 2, 0]} material={glass.clear}><cylinderGeometry args={[r, r * 0.96, h, 20, 1, true]}/></mesh>
    <mesh position={[0, 0.002, 0]} material={glass.clear}><cylinderGeometry args={[r * 0.96, r * 0.96, 0.004, 20]}/></mesh>
    {fill > 0 && <mesh position={[0, fill * h / 2, 0]}><cylinderGeometry args={[r * 0.92, r * 0.92, fill * h, 16]}/><meshStandardMaterial color="#d9ecf0" transparent opacity={0.35}/></mesh>}
  </group>;
}
const flaskProfile = [[0.001, 0], [0.04, 0], [0.042, 0.004], [0.04, 0.01], [0.014, 0.08], [0.013, 0.12], [0.016, 0.123]].map(([x, y]) => new THREE.Vector2(x, y));
function Erlenmeyer({ position, scale = 1 }: { position: V3; scale?: number }) {
  return <mesh position={position} scale={scale} material={glass.clear}><latheGeometry args={[flaskProfile, 24]}/></mesh>;
}
export function GraduatedCylinder({ position, h = 0.3 }: { position: V3; h?: number }) {
  return <group position={position}>
    <Cyl position={[0, 0.006, 0]} args={[0.035, 0.035, 0.012, 6]} material={glass.clear} shadow={false}/>
    <mesh position={[0, 0.012 + h / 2, 0]} material={glass.clear}><cylinderGeometry args={[0.017, 0.017, h, 16, 1, true]}/></mesh>
    {Array.from({ length: 8 }, (_, i) => <M key={i} position={[0, 0.04 + i * h / 9, 0.0172]} args={[i % 2 ? 0.006 : 0.012, 0.0015, 0.0005]} material={materials.plasticBlack} shadow={false}/>)}
  </group>;
}
/** White draining tray with clean glassware, as on the perimeter counters of the photos. */
export function DryingTray({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <M position={[0, 0.008, 0]} args={[0.46, 0.016, 0.36]} material={materials.plasticWhite}/>
    {Array.from({ length: 9 }, (_, i) => <M key={i} position={[-0.2 + i * 0.05, 0.018, 0]} args={[0.008, 0.006, 0.32]} material={materials.laminateEdge} shadow={false}/>)}
    <Beaker position={[-0.14, 0.02, -0.08]} r={0.034} h={0.07}/>
    <Beaker position={[-0.06, 0.02, 0.09]} r={0.026} h={0.05}/>
    <Erlenmeyer position={[0.06, 0.02, -0.07]}/>
    <mesh position={[0.15, 0.06, 0.07]} rotation={[Math.PI, 0, 0]} material={glass.clear}><coneGeometry args={[0.04, 0.05, 20, 1, true]}/></mesh>
    <mesh position={[0.15, 0.024, 0.07]} material={glass.clear}><cylinderGeometry args={[0.006, 0.006, 0.03, 8, 1, true]}/></mesh>
    <mesh position={[-0.13, 0.045, 0.11]} rotation={[Math.PI, 0, 0]} material={porcelain} castShadow><sphereGeometry args={[0.045, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]}/></mesh>
    <mesh position={[0.04, 0.03, 0.12]} rotation={[0, 0.4, Math.PI / 2]} material={glass.clear}><cylinderGeometry args={[0.009, 0.009, 0.15, 10, 1, true]}/></mesh>
    <ContactShadow position={[0, 0.002, 0]} size={[0.6, 0.5]} opacity={0.45}/>
  </group>;
}
export function TestTubeRack({ position, rotation = 0, tubes = 6, colors = [] as string[] }: { position: V3; rotation?: number; tubes?: number; colors?: string[] }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    {[0.012, 0.07].map(y => <M key={y} position={[0, y, 0]} args={[0.26, 0.012, 0.07]} material={materials.plasticWhite}/>)}
    {[-0.125, 0.125].map(x => <M key={x} position={[x, 0.04, 0]} args={[0.01, 0.07, 0.07]} material={materials.plasticWhite}/>)}
    {Array.from({ length: tubes }, (_, i) => <group key={i} position={[-0.1 + i * 0.04, 0.02, 0]}>
      <mesh position={[0, 0.06, 0]} material={glass.clear}><cylinderGeometry args={[0.008, 0.008, 0.12, 10, 1, true]}/></mesh>
      {colors[i] && <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.007, 0.007, 0.05, 8]}/><meshStandardMaterial color={colors[i]} transparent opacity={0.85}/></mesh>}
    </group>)}
    <ContactShadow position={[0, 0.002, 0]} size={[0.34, 0.14]} opacity={0.45}/>
  </group>;
}
export function WashBottle({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  const nozzle = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.17, 0), new THREE.Vector3(0, 0.22, 0), new THREE.Vector3(0.03, 0.24, 0), new THREE.Vector3(0.07, 0.22, 0)]), []);
  return <group position={position} rotation={[0, rotation, 0]}>
    <mesh position={[0, 0.075, 0]} material={hdpe} castShadow><cylinderGeometry args={[0.032, 0.036, 0.15, 18]}/></mesh>
    <Cyl position={[0, 0.16, 0]} args={[0.018, 0.022, 0.02, 14]} material={materials.plasticWhite}/>
    <mesh material={hdpe}><tubeGeometry args={[nozzle, 12, 0.004, 6, false]}/></mesh>
    <Cyl position={[0.07, 0.217, 0]} rotation={[0, 0, 1.2]} args={[0.003, 0.005, 0.015, 8]} material={redTip} shadow={false}/>
    <ContactShadow position={[0, 0.002, 0]} size={[0.11, 0.11]}/>
  </group>;
}
/** Small screw-cap jars and bottles grouped along the backsplash. */
export function JarCluster({ position, rotation = 0, seed = 1 }: { position: V3; rotation?: number; seed?: number }) {
  const items = useMemo(() => {
    let s = seed * 97; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    return Array.from({ length: 7 }, (_, i) => ({ x: -0.25 + i * 0.08 + (r() - 0.5) * 0.02, z: (r() - 0.5) * 0.08, kind: r(), h: 0.04 + r() * 0.12 }));
  }, [seed]);
  return <group position={position} rotation={[0, rotation, 0]}>
    {items.map((it, i) => it.kind < 0.45 ? <group key={i} position={[it.x, 0, it.z]}>
      <Cyl position={[0, 0.022, 0]} args={[0.03, 0.03, 0.044, 18]} material={materials.plasticWhite}/>
      <Cyl position={[0, 0.05, 0]} args={[0.032, 0.032, 0.014, 18]} material={creamCap}/>
      <Cyl position={[0, 0.024, 0]} args={[0.0305, 0.0305, 0.016, 18, 1, true]} material={jarLabel} shadow={false}/>
    </group> : <group key={i} position={[it.x, 0, it.z]}>
      <Cyl position={[0, it.h / 2, 0]} args={[0.025, 0.027, it.h, 16]} material={it.kind < 0.75 ? hdpe : amber}/>
      <Cyl position={[0, it.h + 0.012, 0]} args={[0.012, 0.016, 0.024, 12]} material={it.kind < 0.6 ? materials.plasticWhite : materials.plasticBlack}/>
    </group>)}
    <ContactShadow position={[0, 0.002, 0]} size={[0.7, 0.2]} opacity={0.4}/>
  </group>;
}
export function PaperTowel({ position }: { position: V3 }) {
  return <group position={position}>
    <mesh position={[0, 0.12, 0]} castShadow><cylinderGeometry args={[0.065, 0.065, 0.24, 28]}/><meshStandardMaterial color="#fbfbf8" roughness={0.95}/></mesh>
    <mesh position={[0, 0.241, 0]}><cylinderGeometry args={[0.02, 0.02, 0.002, 16]}/><meshStandardMaterial color="#5b4b3a"/></mesh>
    <mesh position={[0.07, 0.07, 0.03]} rotation={[0, 0.6, 0]}><planeGeometry args={[0.12, 0.14]}/><meshStandardMaterial color="#fbfbf8" roughness={0.95} side={THREE.DoubleSide}/></mesh>
    <ContactShadow position={[0, 0.002, 0]} size={[0.2, 0.2]}/>
  </group>;
}
export function RingStand({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <M position={[0, 0.008, 0]} args={[0.2, 0.016, 0.13]} material={materials.plasticBlack}/>
    <Cyl position={[-0.06, 0.32, 0]} args={[0.006, 0.006, 0.62, 10]} material={materials.plasticBlack}/>
    <M position={[-0.02, 0.48, 0]} args={[0.09, 0.018, 0.022]} material={materials.steel}/>
    <M position={[0.03, 0.48, 0]} args={[0.03, 0.04, 0.03]} material={materials.steel}/>
    <ContactShadow position={[0, 0.002, 0]} size={[0.3, 0.22]}/>
  </group>;
}
/** Wall-mounted soap / paper dispenser (dark plastic), mounted with its back on the wall. */
export function Dispenser({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <mesh position={[0, 0, 0.05]} castShadow material={materials.plasticBlack}><boxGeometry args={[0.12, 0.2, 0.1]}/></mesh>
    <mesh position={[0, -0.06, 0.1]} material={materials.plasticBlack}><boxGeometry args={[0.09, 0.07, 0.03]}/></mesh>
  </group>;
}
/** Duplex outlet next to a blank plate, as above every perimeter counter. Faces +z in local space. */
export function Outlet({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  const face = useCanvasTexture(64, 112, c => { c.fillStyle = '#f7f6f1'; c.fillRect(0, 0, 64, 112); c.fillStyle = '#e7e5de'; c.fillRect(10, 12, 44, 36); c.fillRect(10, 62, 44, 36); c.fillStyle = '#2b2b2b'; for (const y of [20, 70]) { c.fillRect(22, y, 4, 12); c.fillRect(38, y, 4, 12); c.fillRect(30, y + 15, 4, 6); } });
  return <group position={position} rotation={[0, rotation, 0]}>
    <mesh position={[0, 0, 0.004]}><boxGeometry args={[0.07, 0.115, 0.008]}/><meshStandardMaterial map={face} roughness={0.5}/></mesh>
    <mesh position={[0.085, 0, 0.004]}><boxGeometry args={[0.07, 0.115, 0.008]}/><meshStandardMaterial color="#f7f6f1" roughness={0.5}/></mesh>
  </group>;
}
export function Extinguisher({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  const hose = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(0.03, 0.56, 0.02), new THREE.Vector3(0.09, 0.45, 0.06), new THREE.Vector3(0.08, 0.2, 0.08), new THREE.Vector3(0.05, 0.12, 0.07)]), []);
  const red = extinguisherRed;
  return <group position={position} rotation={[0, rotation, 0]}>
    <mesh position={[0, 0.3, 0]} material={red} castShadow><cylinderGeometry args={[0.075, 0.075, 0.5, 24]}/></mesh>
    <mesh position={[0, 0.55, 0]} material={red}><sphereGeometry args={[0.075, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]}/></mesh>
    <M position={[0, 0.65, 0]} args={[0.05, 0.06, 0.05]} material={materials.chrome}/>
    <M position={[0.04, 0.68, 0]} args={[0.09, 0.012, 0.02]} material={materials.plasticBlack}/>
    <mesh material={materials.rubber}><tubeGeometry args={[hose, 16, 0.009, 8, false]}/></mesh>
    <M position={[0, 0.3, -0.085]} args={[0.05, 0.12, 0.02]} material={materials.plasticBlack}/>
  </group>;
}

function signTexture(draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; draw(canvas.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** Aluminium-framed glass door with frosted band and long bar handle; signage is generic, not institutional. */
export function EntranceDoor({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  const coat = useMemo(() => signTexture((c, w, h) => {
    c.fillStyle = '#1d2a3f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffffff'; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(w * 0.5, 70); c.lineTo(w * 0.25, 95); c.lineTo(w * 0.18, 260); c.lineTo(w * 0.32, 260); c.lineTo(w * 0.34, 300); c.lineTo(w * 0.66, 300); c.lineTo(w * 0.68, 260); c.lineTo(w * 0.82, 260); c.lineTo(w * 0.75, 95); c.closePath(); c.fill();
    c.fillStyle = '#1d2a3f'; c.fillRect(w * 0.495, 90, 6, 210); c.fillRect(w * 0.38, 190, 34, 6); c.fillRect(w * 0.56, 190, 34, 6);
    c.fillStyle = '#ffffff'; c.font = 'bold 34px Arial'; c.textAlign = 'center'; c.fillText('USO DE BATA', w / 2, 360); c.fillText('OBLIGATORIO', w / 2, 400);
  }, 300, 440), []);
  const push = useMemo(() => signTexture((c, w, h) => {
    c.fillStyle = '#1d2a3f'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.font = 'bold 40px Arial'; c.textAlign = 'center';
    'EMPUJE'.split('').forEach((ch, i) => c.fillText(ch, w / 2, 60 + i * 52));
  }, 80, 360), []);
  const W = 1.05, H = 2.2;
  return <group position={position} rotation={[0, rotation, 0]}>
    {[-1, 1].map(s => <mesh key={s} position={[s * (W / 2 + 0.04), H / 2, 0]} material={materials.aluminium}><boxGeometry args={[0.08, H + 0.08, 0.1]}/></mesh>)}
    <mesh position={[0, H + 0.04, 0]} material={materials.aluminium}><boxGeometry args={[W + 0.16, 0.08, 0.1]}/></mesh>
    {[-1, 1].map(s => <mesh key={`d${s}`} position={[s * (W / 2 - 0.03), H / 2, 0.02]} material={materials.aluminium}><boxGeometry args={[0.06, H - 0.04, 0.05]}/></mesh>)}
    {[0.05, H - 0.05].map(y => <mesh key={y} position={[0, y, 0.02]} material={materials.aluminium}><boxGeometry args={[W, 0.08, 0.05]}/></mesh>)}
    <mesh position={[0, H / 2, 0.02]} material={glass.clear}><boxGeometry args={[W - 0.12, H - 0.16, 0.01]}/></mesh>
    <mesh position={[0, 1.3, 0.027]}><planeGeometry args={[W - 0.12, 0.5]}/><meshStandardMaterial color="#eef3f2" transparent opacity={0.7} roughness={0.6}/></mesh>
    {[0.62, 0.68, 0.74].map(y => <mesh key={y} position={[0, y, 0.027]}><planeGeometry args={[W - 0.12, 0.025]}/><meshStandardMaterial color="#eef3f2" transparent opacity={0.65}/></mesh>)}
    <mesh position={[0.05, 1.35, 0.034]}><planeGeometry args={[0.3, 0.44]}/><meshBasicMaterial map={coat}/></mesh>
    <mesh position={[0.32, 1.48, 0.034]}><planeGeometry args={[0.08, 0.36]}/><meshBasicMaterial map={push}/></mesh>
    <mesh position={[-0.4, 1.05, 0.11]} material={materials.aluminium}><cylinderGeometry args={[0.016, 0.016, 1.7, 14]}/></mesh>
    {[0.25, 1.85].map(y => <mesh key={y} position={[-0.4, y, 0.07]} rotation={[Math.PI / 2, 0, 0]} material={materials.aluminium}><cylinderGeometry args={[0.012, 0.012, 0.08, 10]}/></mesh>)}
    <group position={[W / 2 + 0.28, 1.3, -0.02]}>
      <mesh position={[0, 0.12, 0.01]}><boxGeometry args={[0.07, 0.09, 0.02]}/><meshStandardMaterial color="#1f2937"/></mesh>
      <mesh position={[0, -0.02, 0.01]}><boxGeometry args={[0.06, 0.11, 0.02]}/><meshStandardMaterial color="#262b31"/></mesh>
      <mesh position={[0, -0.02, 0.021]}><circleGeometry args={[0.008, 12]}/><meshBasicMaterial color="#e5484d" toneMapped={false}/></mesh>
    </group>
    <FloorAO x={0} z={0} length={W + 0.2} depth={0.3} fade="+z" opacity={0.4}/>
  </group>;
}
/** Decorative storage bottles (amber glass and white plastic) for the high shelf. */
export function StorageBottles({ position, count = 9, spacing = 0.42 }: { position: V3; count?: number; spacing?: number }) {
  return <group position={position}>{Array.from({ length: count }, (_, i) => {
    const big = i % 3 === 0; const mat = i % 2 ? amber : hdpe; const h = big ? 0.26 : 0.18, r = big ? 0.06 : 0.045;
    return <group key={i} position={[i * spacing - (count - 1) * spacing / 2, 0, (i % 2) * 0.06]}>
      <Cyl position={[0, h / 2, 0]} args={[r, r, h, 18]} material={mat}/>
      <Cyl position={[0, h + 0.02, 0]} args={[r * 0.35, r * 0.55, 0.04, 14]} material={mat}/>
      <Cyl position={[0, h + 0.05, 0]} args={[r * 0.38, r * 0.38, 0.025, 14]} material={i % 4 === 1 ? creamCap : materials.plasticBlack}/>
      <mesh position={[0, h * 0.5, r + 0.001]}><planeGeometry args={[r * 1.3, h * 0.35]}/><meshStandardMaterial color="#f4efe2" roughness={0.8}/></mesh>
      <ContactShadow position={[0, 0.002, 0]} size={[r * 3, r * 3]}/>
    </group>;
  })}</group>;
}
export { TOP };
