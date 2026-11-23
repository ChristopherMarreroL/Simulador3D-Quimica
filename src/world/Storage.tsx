import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHood } from '../state/hood';
import { cabinets, exhibitGroupColors, exhibits, useStorage, VITRINE, type Exhibit, type StoredKind } from '../state/storage';
import { glass, materials } from './materials';
import { Sign } from './Models';
import { StaticBatch } from './StaticBatch';

/** Designed sizes (not measured): upper cabinet module and the display cabinet on the back wall. */
const W = 0.6, H = 0.7, D = 0.36, Y0 = 1.95;
export const VITRINE_BOX = { x: -0.3, z: -4.75, w: 1.25, d: 0.38 };
const VH = 2.1, VY0 = 0.2;

// Shared materials: equal looks merge into one draw call inside StaticBatch.
const cache = new Map<string, THREE.Material>();
function flat(color: string, roughness = 0.6, metalness = 0, opacity = 1) {
  const key = `${color}|${roughness}|${metalness}|${opacity}`; let m = cache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent: opacity < 1, opacity }); cache.set(key, m); }
  return m;
}
const amber = new THREE.MeshPhysicalMaterial({ color: '#8a4b12', transparent: true, opacity: 0.8, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide });
const white = flat('#f4f3ee', 0.55), porcelain = flat('#f7f5ee', 0.3), black = flat('#1f2629', 0.5), capBlue = flat('#2f6fe0', 0.45), red = flat('#d8342c', 0.4);
const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));

type V3 = [number, number, number];
function Beaker({ p, r, h }: { p: V3; r: number; h: number }) {
  return <group position={p}>
    <mesh position={[0, h / 2, 0]} material={glass.clear}><cylinderGeometry args={[r, r * 0.96, h, 20, 1, true]}/></mesh>
    <mesh position={[0, 0.003, 0]} material={glass.clear}><cylinderGeometry args={[r * 0.96, r * 0.96, 0.006, 20]}/></mesh>
  </group>;
}
function Erlenmeyer({ p, r, h }: { p: V3; r: number; h: number }) {
  return <group position={p}>
    <mesh position={[0, h * 0.36, 0]} material={glass.clear}><cylinderGeometry args={[r * 0.34, r, h * 0.72, 20, 1, true]}/></mesh>
    <mesh position={[0, h * 0.86, 0]} material={glass.clear}><cylinderGeometry args={[r * 0.36, r * 0.34, h * 0.28, 16, 1, true]}/></mesh>
    <mesh position={[0, 0.003, 0]} material={glass.clear}><cylinderGeometry args={[r, r, 0.006, 20]}/></mesh>
  </group>;
}
function Cylinder({ p, r, h }: { p: V3; r: number; h: number }) {
  return <group position={p}>
    <mesh position={[0, h / 2 + 0.008, 0]} material={glass.clear}><cylinderGeometry args={[r, r, h, 14, 1, true]}/></mesh>
    <mesh position={[0, 0.004, 0]} material={glass.clear}><cylinderGeometry args={[r * 2.1, r * 2.1, 0.008, 6]}/></mesh>
  </group>;
}
function Volumetric({ p, r }: { p: V3; r: number }) {
  return <group position={p}>
    <mesh position={[0, r * 0.9, 0]} scale={[1, 0.9, 1]} material={glass.clear}><sphereGeometry args={[r, 18, 12]}/></mesh>
    <mesh position={[0, r * 1.8 + 0.05, 0]} material={glass.clear}><cylinderGeometry args={[r * 0.2, r * 0.2, 0.12, 10, 1, true]}/></mesh>
    <mesh position={[0, r * 1.8 + 0.12, 0]} material={white}><cylinderGeometry args={[r * 0.24, r * 0.18, 0.025, 10]}/></mesh>
  </group>;
}
function TubeRack({ p }: { p: V3 }) {
  return <group position={p}>
    {[0.012, 0.075].map(y => <mesh key={y} position={[0, y, 0]} material={white}><boxGeometry args={[0.22, 0.012, 0.06]}/></mesh>)}
    {[-0.1, 0.1].map(x => <mesh key={x} position={[x, 0.045, 0]} material={white}><boxGeometry args={[0.012, 0.09, 0.06]}/></mesh>)}
    {[-0.075, -0.045, -0.015, 0.015, 0.045, 0.075].map(x => <mesh key={x} position={[x, 0.075, 0]} material={glass.clear}><cylinderGeometry args={[0.008, 0.008, 0.13, 8, 1, true]}/></mesh>)}
  </group>;
}
function Lying({ p, length, r, material, tip }: { p: V3; length: number; r: number; material: THREE.Material; tip?: THREE.Material }) {
  return <group position={p}>
    <mesh rotation={[0, 0, Math.PI / 2]} material={material}><cylinderGeometry args={[r, r, length, 8]}/></mesh>
    {tip && <mesh position={[-length / 2, 0, 0]} material={tip}><sphereGeometry args={[r * 1.6, 8, 6]}/></mesh>}
  </group>;
}
function Jar({ p, r, h, body, cap }: { p: V3; r: number; h: number; body: THREE.Material; cap: THREE.Material }) {
  return <group position={p}>
    <mesh position={[0, h / 2, 0]} material={body}><cylinderGeometry args={[r, r, h, 16]}/></mesh>
    <mesh position={[0, h + 0.012, 0]} material={cap}><cylinderGeometry args={[r * 0.75, r * 0.75, 0.024, 14]}/></mesh>
  </group>;
}
const spread = (n: number, width = 0.44) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * (width / Math.max(1, n - 1)));
/** Glassware of one family on the two shelves of a cabinet. Decorative: it shows what is stored there. */
function Stored({ kind }: { kind: StoredKind }) {
  const lo = Y0 + 0.02, hi = Y0 + 0.37, z = 0.17;
  switch (kind) {
    case 'beaker-s': return <>{spread(5).map(x => <Beaker key={`a${x}`} p={[x, lo, z]} r={0.027} h={0.07}/>)}{spread(6).map(x => <Beaker key={`b${x}`} p={[x, hi, z]} r={0.022} h={0.06}/>)}</>;
    case 'beaker-l': return <>{spread(3).map(x => <Beaker key={`a${x}`} p={[x, lo, z]} r={0.045} h={0.12}/>)}{spread(4).map(x => <Beaker key={`b${x}`} p={[x, hi, z]} r={0.037} h={0.095}/>)}</>;
    case 'erlenmeyer': return <>{spread(3).map(x => <Erlenmeyer key={`a${x}`} p={[x, lo, z]} r={0.052} h={0.18}/>)}{spread(4).map(x => <Erlenmeyer key={`b${x}`} p={[x, hi, z]} r={0.042} h={0.145}/>)}</>;
    case 'cylinder': return <>{spread(4).map(x => <Cylinder key={`a${x}`} p={[x, lo, z]} r={0.016} h={0.25}/>)}{spread(3, 0.2).map(x => <Cylinder key={`b${x}`} p={[x - 0.1, hi, z]} r={0.013} h={0.2}/>)}{spread(3, 0.14).map(x => <Cylinder key={`c${x}`} p={[x + 0.15, hi, z]} r={0.008} h={0.14}/>)}</>;
    case 'volumetric': return <>{spread(3).map(x => <Volumetric key={`a${x}`} p={[x, lo, z]} r={0.042}/>)}{spread(4).map(x => <Volumetric key={`b${x}`} p={[x, hi, z]} r={0.032}/>)}</>;
    case 'tubes': return <><TubeRack p={[-0.13, lo, z]}/><TubeRack p={[0.13, lo, z]}/><TubeRack p={[-0.13, hi, z]}/><TubeRack p={[0.13, hi, z]}/></>;
    case 'funnel': return <>
      {spread(4).map(x => <group key={x} position={[x, lo, z]}><mesh position={[0, 0.03, 0]} material={glass.clear}><cylinderGeometry args={[0.008, 0.045, 0.06, 16, 1, true]}/></mesh><mesh position={[0, 0.09, 0]} material={glass.clear}><cylinderGeometry args={[0.005, 0.006, 0.07, 8, 1, true]}/></mesh></group>)}
      {spread(4).map(x => <mesh key={x} position={[x, hi + 0.006, z]} material={glass.clear}><cylinderGeometry args={[0.048, 0.03, 0.012, 20, 1, true]}/></mesh>)}
    </>;
    case 'pipette': return <>
      <mesh position={[0, lo + 0.012, z]} material={white}><boxGeometry args={[0.5, 0.024, 0.16]}/></mesh>
      {[-0.05, -0.02, 0.01, 0.04].map(dz => <Lying key={dz} p={[0, lo + 0.03, z + dz]} length={0.36} r={0.004} material={glass.clear}/>)}
      {[-0.04, -0.015, 0.01, 0.035, 0.06].map(dz => <Lying key={dz} p={[0, hi + 0.004, z + dz]} length={0.25} r={0.003} material={glass.clear}/>)}
    </>;
    case 'thermometer': return <>
      {[-0.04, -0.01, 0.02].map(dz => <Lying key={dz} p={[0, lo + 0.005, z + dz]} length={0.3} r={0.0035} material={glass.clear} tip={red}/>)}
      {spread(6).map(x => <Jar key={x} p={[x, hi, z]} r={0.018} h={0.06} body={amber} cap={black}/>)}
    </>;
    case 'mortar': return <>
      {spread(3).map(x => <group key={x} position={[x, lo, z]}><mesh position={[0, 0.024, 0]} material={porcelain}><cylinderGeometry args={[0.052, 0.034, 0.048, 20]}/></mesh><mesh position={[0.02, 0.07, 0]} rotation={[0, 0, -0.6]} material={porcelain}><cylinderGeometry args={[0.012, 0.008, 0.11, 10]}/></mesh></group>)}
      {spread(3).map(x => <group key={x} position={[x, hi, z]}><mesh position={[0, 0.008, 0]} material={materials.steel}><cylinderGeometry args={[0.036, 0.04, 0.016, 16]}/></mesh><mesh position={[0, 0.08, 0]} material={materials.steel}><cylinderGeometry args={[0.008, 0.008, 0.13, 10]}/></mesh></group>)}
    </>;
    case 'washbottle': return <>
      {spread(4).map(x => <group key={x} position={[x, lo, z]}><mesh position={[0, 0.065, 0]} material={white}><cylinderGeometry args={[0.036, 0.036, 0.13, 16]}/></mesh><mesh position={[0, 0.15, 0]} material={capBlue}><cylinderGeometry args={[0.012, 0.03, 0.04, 12]}/></mesh><mesh position={[0.025, 0.19, 0]} rotation={[0, 0, -0.9]} material={white}><cylinderGeometry args={[0.003, 0.003, 0.08, 6]}/></mesh></group>)}
      {spread(5).map(x => <Jar key={x} p={[x, hi, z]} r={0.032} h={0.09} body={white} cap={capBlue}/>)}
    </>;
  }
}

/** 10 mL graduated pipette, drawn upright with its tip at the origin. `fill` (0–1) shows the liquid column. */
export function PipetteModel({ fill = 0, color = '#d8eef4' }: { fill?: number; color?: string }) {
  return <group>
    <mesh position={[0, 0.02, 0]} material={glass.clear}><cylinderGeometry args={[0.0045, 0.0015, 0.04, 8, 1, true]}/></mesh>
    <mesh position={[0, 0.19, 0]} material={glass.clear}><cylinderGeometry args={[0.0045, 0.0045, 0.3, 8, 1, true]}/></mesh>
    <mesh position={[0, 0.352, 0]} material={capBlue}><cylinderGeometry args={[0.006, 0.006, 0.024, 8]}/></mesh>
    {[0.1, 0.16, 0.22, 0.28].map(y => <mesh key={y} position={[0, y, 0]} material={black}><cylinderGeometry args={[0.0048, 0.0048, 0.0015, 8]}/></mesh>)}
    {fill > 0.01 && <mesh position={[0, 0.04 + fill * 0.14, 0]}><cylinderGeometry args={[0.0036, 0.0036, fill * 0.28, 8]}/><meshStandardMaterial color={color} transparent opacity={0.85} roughness={0.15}/></mesh>}
  </group>;
}
/** The pipette the player can take: it lies in front of the stored ones while it is in its cabinet. */
function StoredPipette() {
  const stored = useHood(s => s.pipette.place === 'cabinet');
  return stored ? <group position={[-0.17, Y0 + 0.045, 0.3]} rotation={[0, 0, -Math.PI / 2]} userData={{ interactive: 'tool:pipette' }}>
    <PipetteModel/>
    <mesh visible={false} position={[0, 0.18, 0]}><boxGeometry args={[0.03, 0.38, 0.03]}/></mesh>
  </group> : null;
}

/** Glass door with a laminate frame. It swings around its hinge when its cabinet is toggled open. */
function Door({ id, hinge, w, h, flip = false }: { id: string; hinge: V3; w: number; h: number; flip?: boolean }) {
  const ref = useRef<THREE.Group>(null); const s = flip ? -1 : 1;
  useFrame((_, delta) => {
    const g = ref.current; if (!g) return;
    const target = useStorage.getState().open[id] ? -s * 1.75 : 0;
    if (Math.abs(g.rotation.y - target) > 0.001) g.rotation.y = damp(g.rotation.y, target, 9, Math.min(delta, 0.06));
  });
  const rail = 0.035;
  return <group ref={ref} position={hinge} userData={{ interactive: `cabinet:${id}` }}>
    {[rail / 2, w - rail / 2].map(x => <mesh key={x} position={[s * x, 0, 0]} material={materials.laminate}><boxGeometry args={[rail, h, 0.018]}/></mesh>)}
    {[-1, 1].map(v => <mesh key={v} position={[s * w / 2, v * (h - rail) / 2, 0]} material={materials.laminate}><boxGeometry args={[w - rail * 2, rail, 0.018]}/></mesh>)}
    <mesh position={[s * w / 2, 0, 0]} material={glass.clear}><boxGeometry args={[w - rail * 2, h - rail * 2, 0.004]}/></mesh>
    <mesh position={[s * (w - rail / 2), -h * 0.28, 0.016]} material={materials.steel}><boxGeometry args={[0.012, 0.12, 0.014]}/></mesh>
  </group>;
}

function CabinetRun({ wall, position, rotation = 0 }: { wall: 'back' | 'left'; position: V3; rotation?: number }) {
  const list = cabinets.filter(c => c.wall === wall); const total = list.length * W;
  const xs = list.map((_, i) => -total / 2 + W * (i + 0.5));
  return <group position={position} rotation={[0, rotation, 0]}>
    <StaticBatch>
      <mesh position={[0, Y0 + H / 2, 0.01]} material={materials.laminate} receiveShadow><boxGeometry args={[total, H, 0.02]}/></mesh>
      {[Y0 + 0.01, Y0 + 0.36, Y0 + H - 0.01].map(y => <mesh key={y} position={[0, y, D / 2]} material={materials.laminate} castShadow receiveShadow><boxGeometry args={[total, 0.02, D - 0.02]}/></mesh>)}
      {[...xs.map(x => x - W / 2), total / 2].map(x => <mesh key={x} position={[x, Y0 + H / 2, D / 2]} material={materials.laminate} castShadow><boxGeometry args={[0.02, H, D - 0.02]}/></mesh>)}
      <mesh position={[0, Y0 - 0.075, D - 0.02]} material={materials.laminate}><boxGeometry args={[total, 0.15, 0.02]}/></mesh>
      {list.map((c, i) => <group key={c.id} position={[xs[i], 0, 0]}><Stored kind={c.kind}/></group>)}
    </StaticBatch>
    {list.map((c, i) => <group key={c.id}>
      <Door id={c.id} hinge={[xs[i] - W / 2 + 0.012, Y0 + H / 2, D + 0.002]} w={W - 0.024} h={H - 0.02}/>
      {c.kind === 'pipette' && <group position={[xs[i], 0, 0]}><StoredPipette/></group>}
      <group userData={{ interactive: `cabinet:${c.id}` }}><Sign text={c.title} position={[xs[i], Y0 - 0.075, D - 0.008]} width={0.56} height={0.13} dark/></group>
    </group>)}
  </group>;
}
/** Upper cabinets of the U: back wall (above the long bench) and left wall (above the sink bench). */
export function InstrumentCabinets() {
  return <>
    <CabinetRun wall="back" position={[-3.15, 0, -4.94]}/>
    <CabinetRun wall="left" position={[-5.94, 0, 0.5]} rotation={Math.PI / 2}/>
  </>;
}

const COLS = 6, ROWS = 5, CELL_W = 256, CELL_H = 128;
let labelMaterial: THREE.MeshStandardMaterial | null = null;
/** One label sheet and one material for every exhibit: the labels merge into a single mesh. */
function exhibitLabels() {
  if (labelMaterial) return labelMaterial;
  const canvas = document.createElement('canvas'); canvas.width = COLS * CELL_W; canvas.height = ROWS * CELL_H;
  const c = canvas.getContext('2d')!;
  exhibits.forEach((e, i) => {
    const x = (i % COLS) * CELL_W, y = Math.floor(i / COLS) * CELL_H;
    c.fillStyle = '#fbfaf4'; c.fillRect(x, y, CELL_W, CELL_H);
    c.fillStyle = exhibitGroupColors[e.group]; c.fillRect(x, y, CELL_W, 24); c.fillRect(x, y + CELL_H - 8, CELL_W, 8);
    c.fillStyle = '#ffffff'; c.font = 'bold 15px Arial'; c.textBaseline = 'middle'; c.fillText(e.group.toUpperCase(), x + 10, y + 13);
    c.fillStyle = '#14323b'; c.font = 'bold 24px Arial'; c.textBaseline = 'alphabetic';
    const lines: string[] = [''];
    for (const w of e.name.split(' ')) { const next = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${w}` : w; if (c.measureText(next).width > CELL_W - 20 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = next; }
    lines.slice(0, 2).forEach((line, j) => c.fillText(line, x + 10, y + 52 + j * 26, CELL_W - 20));
    c.fillStyle = '#4b6468'; c.font = '17px Arial'; c.fillText(e.formula, x + 10, y + 108, CELL_W - 20);
  });
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  labelMaterial = new THREE.MeshStandardMaterial({ map, roughness: 0.7 });
  return labelMaterial;
}
function labelGeometry(i: number, w: number, h: number) {
  const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv;
  const u0 = (i % COLS) / COLS, v1 = 1 - Math.floor(i / COLS) / ROWS, du = 1 / COLS, dv = 1 / ROWS;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * du, v1 - dv + uv.getY(k) * dv);
  return g;
}
function ExhibitBottle({ exhibit, index }: { exhibit: Exhibit; index: number }) {
  const solid = exhibit.kind === 'solido', dropper = exhibit.kind === 'indicador';
  const r = solid ? 0.05 : dropper ? 0.032 : 0.045, h = solid ? 0.11 : dropper ? 0.09 : 0.15;
  const body = exhibit.amber ? amber : glass.clear; const cap = flat(exhibitGroupColors[exhibit.group], 0.45);
  const label = useMemo(() => labelGeometry(index, r * 1.75, r * 0.92), [index, r]);
  const fill = solid ? h * 0.6 : h * 0.72;
  return <group>
    <mesh position={[0, h / 2, 0]} material={body}><cylinderGeometry args={[r, r, h, 18, 1, true]}/></mesh>
    <mesh position={[0, fill / 2 + 0.006, 0]} material={flat(exhibit.contents, solid ? 0.9 : 0.15, 0, solid ? 1 : 0.85)}><cylinderGeometry args={[r * 0.9, r * 0.9, fill, 14]}/></mesh>
    {!solid && !dropper && <mesh position={[0, h + 0.014, 0]} material={body}><cylinderGeometry args={[0.02, r, 0.028, 16, 1, true]}/></mesh>}
    <mesh position={[0, h + (solid ? 0.016 : dropper ? 0.02 : 0.045), 0]} material={dropper ? black : cap}><cylinderGeometry args={solid ? [r + 0.003, r + 0.003, 0.032, 18] : dropper ? [0.02, 0.022, 0.04, 12] : [0.024, 0.024, 0.036, 14]}/></mesh>
    {dropper && <mesh position={[0, h + 0.055, 0]} scale={[1, 1.4, 1]} material={cap}><sphereGeometry args={[0.016, 10, 8]}/></mesh>}
    <mesh position={[0, h * 0.5, r + 0.0015]} geometry={label} material={exhibitLabels()}/>
  </group>;
}
/** Display cabinet with common laboratory compounds that have no chemical model: they are read, not mixed. */
export function DisplayCabinet() {
  const { w, d } = VITRINE_BOX; const shelves = [1.82, 1.47, 1.12, 0.77, 0.42];
  const rows = useMemo(() => {
    const of = (k: Exhibit['kind']) => exhibits.map((e, i) => ({ e, i })).filter(x => x.e.kind === k);
    const liquids = of('liquido'), solids = of('solido');
    return [of('indicador'), liquids.slice(0, 6), liquids.slice(6), solids.slice(0, 7), solids.slice(7)];
  }, []);
  const placed = rows.flatMap((row, j) => row.map((x, k) => ({ ...x, p: [(k - (row.length - 1) / 2) * Math.min(0.19, (w - 0.16) / row.length), shelves[j] + 0.012, d * 0.5] as V3 })));
  return <group position={[VITRINE_BOX.x, 0, -4.94]}>
    <StaticBatch>
      <mesh position={[0, VY0 + VH / 2, 0.01]} material={materials.laminate} receiveShadow><boxGeometry args={[w, VH, 0.02]}/></mesh>
      {[-1, 1].map(s => <mesh key={s} position={[s * (w / 2 - 0.012), VY0 + VH / 2, d / 2]} material={materials.laminate} castShadow receiveShadow><boxGeometry args={[0.024, VH, d]}/></mesh>)}
      {[VY0 + 0.012, ...shelves, VY0 + VH - 0.012].map(y => <mesh key={y} position={[0, y, d / 2]} material={materials.laminate} castShadow receiveShadow><boxGeometry args={[w - 0.048, 0.024, d - 0.03]}/></mesh>)}
      <mesh position={[0, VY0 / 2, d / 2 - 0.02]} material={materials.plasticBlack}><boxGeometry args={[w - 0.04, VY0, d - 0.06]}/></mesh>
      <mesh position={[0, VY0 + VH + 0.07, d / 2]} material={materials.laminate}><boxGeometry args={[w, 0.14, d]}/></mesh>
      {placed.map(x => <group key={x.i} position={x.p}><ExhibitBottle exhibit={x.e} index={x.i}/></group>)}
    </StaticBatch>
    {/* Invisible volumes: the merged bottles cannot carry a target, so these answer the crosshair. */}
    {placed.map(x => <mesh key={x.i} visible={false} position={[x.p[0], x.p[1] + 0.1, x.p[2]]} userData={{ interactive: `exhibit:${x.i}` }}><cylinderGeometry args={[0.058, 0.058, 0.22, 8]}/></mesh>)}
    <Door id={VITRINE} hinge={[-w / 2 + 0.006, VY0 + VH / 2, d + 0.002]} w={w / 2 - 0.008} h={VH - 0.02}/>
    <Door id={VITRINE} hinge={[w / 2 - 0.006, VY0 + VH / 2, d + 0.002]} w={w / 2 - 0.008} h={VH - 0.02} flip/>
    <group userData={{ interactive: `cabinet:${VITRINE}` }}><Sign text="VITRINA DE COMPUESTOS" position={[0, VY0 + VH + 0.07, d + 0.002]} width={w - 0.1} height={0.12} dark/></group>
  </group>;
}
