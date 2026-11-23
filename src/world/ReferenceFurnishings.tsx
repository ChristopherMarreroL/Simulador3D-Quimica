import { useMemo } from 'react';
import * as THREE from 'three';
import { Box, Sign } from './Models';
import { islands, stools } from './layout';

import { materials } from './materials';
import { ContactShadow } from './RoomShell';

/** Polished granite shared by every countertop (see materials.ts). */
export function GraniteMaterial() { return <primitive object={materials.granite} attach="material"/>; }

function CutTop({ w, d, interactive }: { w: number; d: number; interactive?: string }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape(); const x = w / 2, z = d / 2, c = Math.min(w, d) * 0.22;
    s.moveTo(-x + c, -z); s.lineTo(x - c, -z); s.lineTo(x, -z + c); s.lineTo(x, z - c);
    s.lineTo(x - c, z); s.lineTo(-x + c, z); s.lineTo(-x, z - c); s.lineTo(-x, -z + c); s.closePath();
    return s;
  }, [w, d]);
  return <group rotation={[-Math.PI / 2, 0, 0]}>
    <mesh position={[0, 0, 1.015]} castShadow receiveShadow userData={{ interactive }}><extrudeGeometry args={[shape, { depth: 0.14, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.01, bevelThickness: 0.005 }]}/><GraniteMaterial/></mesh>
    <mesh position={[0, 0, 0.98]} material={materials.laminateEdge}><extrudeGeometry args={[shape, { depth: 0.03, bevelEnabled: false }]}/></mesh>
  </group>;
}

function SupportStand() {
  return <group>
    <mesh position={[0, 0.025, 0]} castShadow><cylinderGeometry args={[0.2, 0.23, 0.05, 3]}/><meshStandardMaterial color="#777f7e" metalness={0.7} roughness={0.28}/></mesh>
    <mesh position={[0, 0.38, 0]} castShadow><cylinderGeometry args={[0.012, 0.012, 0.75, 10]}/><meshStandardMaterial color="#a8b8ba" metalness={0.85} roughness={0.2}/></mesh>
    <mesh position={[0.13, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.09, 0.008, 6, 16]}/><meshStandardMaterial color="#a8b8ba" metalness={0.8} roughness={0.25}/></mesh>
  </group>;
}

export function WorkIslands() {
  return <>{islands.map((island, i) => <group key={i} position={[island.x, 0, island.z]}>
    <CutTop w={island.w} d={island.d} interactive={island.interactive}/>
    <mesh position={[0, 0.51, 0]} castShadow><cylinderGeometry args={[0.48, 0.53, 0.97, 8]}/><meshStandardMaterial color="#262e32" roughness={0.45}/></mesh>
    <mesh position={[0, 0.035, 0]} material={materials.steel}><cylinderGeometry args={[0.56, 0.56, 0.07, 8]}/></mesh>
    <ContactShadow position={[0, 0.003, 0]} size={[1.9, 1.9]} opacity={0.7}/>
    <Box position={[0, 0.64, 0.508]} size={[0.84, 0.21, 0.025]} color="#143e49"/>
    <Sign text={i === 0 ? '01 / REACCIONES' : i === 1 ? '02 / CONDUCTIVIDAD' : '03 / CRISTALES'} position={[0, 0.64, 0.524]} width={0.78} height={0.17} dark/>
    <group position={[0, 1.16, -island.d * 0.31]}><SupportStand/></group>
  </group>)}</>;
}

export function LabStools() {
  return <>{stools.map((stool, i) => <group key={i} position={[stool.x, 0, stool.z]} rotation={[0, stool.rotation, 0]}>
    <mesh position={[0, 0.66, 0]} castShadow><cylinderGeometry args={[0.24, 0.24, 0.075, 24]}/><meshStandardMaterial color="#303b3e" roughness={0.6}/></mesh>
    <mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.028, 0.035, 0.64, 12]}/><meshStandardMaterial color="#8b999a" metalness={0.7} roughness={0.3}/></mesh>
    <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.18, 0.012, 6, 24]}/><meshStandardMaterial color="#6f7d7d" metalness={0.7}/></mesh>
    <Box position={[0, 0.95, 0.2]} size={[0.4, 0.19, 0.065]} color="#303b3e"/>
    <Box position={[0.14, 0.78, 0.19]} size={[0.025, 0.35, 0.025]} color="#7f8d8b"/>
    {[0, 1, 2, 3, 4].map(n => <group key={n} rotation={[0, n * Math.PI * 2 / 5, 0]}><Box position={[0, 0.055, 0.14]} size={[0.045, 0.045, 0.3]} color="#364144"/></group>)}
    <ContactShadow position={[0, 0.003, 0]} size={[0.75, 0.75]} opacity={0.55}/>
  </group>)}</>;
}

/** Ceiling fixtures do not cast shadows: they would print dark squares on the walls. */
function Flat({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={position}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={0.7}/></mesh>;
}
/** Lamp panels emit above the lit walls (HDR value 3): white on screen and the only surfaces that bloom in Ultra. */
const lampMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.97, 2.88), toneMapped: false });
export function Ceiling({ closed }: { closed: boolean }) {
  return <>
    {closed && <mesh position={[0, 3.42, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.ceiling}><planeGeometry args={[12, 10]}/></mesh>}
    {[-3.5, 3.5].map(x => <Flat key={x} position={[x, 3.3, -0.5]} size={[0.32, 0.22, 8.4]} color="#6f98b4"/>)}
    {[-4.7, 3.7].map(z => <Flat key={z} position={[0, 3.3, z]} size={[7.3, 0.22, 0.32]} color="#6f98b4"/>)}
    {[-2.3, 0, 2.3].flatMap(x => [-3, 0, 2.8].map(z => <group key={`${x}-${z}`} position={[x, 3.39, z]}>
      <Flat position={[0, 0, 0]} size={[0.64, 0.05, 0.64]} color="#dfe2de"/>
      <mesh position={[0, -0.027, 0]} rotation={[Math.PI / 2, 0, 0]} material={lampMaterial}><planeGeometry args={[0.56, 0.56]}/></mesh>
    </group>))}
    {/* Air-conditioning grilles in the ceiling. */}
    {[[-4.6, 2.4], [4.1, -1.2]].map(([x, z]) => <group key={x} position={[x, 3.405, z]}>
      <Flat position={[0, 0, 0]} size={[0.6, 0.02, 0.6]} color="#e6e8e4"/>
      {Array.from({ length: 6 }, (_, i) => <Flat key={i} position={[0, -0.012, -0.22 + i * 0.088]} size={[0.52, 0.006, 0.03]} color="#b9bdb8"/>)}
    </group>)}
  </>;
}

export function WallCabinets() {
  return <group position={[-5.48, 0, 0.5]} rotation={[0, Math.PI / 2, 0]}>
    <mesh position={[0, 2.65, 0]} material={materials.laminate} castShadow receiveShadow><boxGeometry args={[2.5, 0.65, 0.55]}/></mesh>
    {[-0.93, -0.31, 0.31, 0.93].map(x => <group key={x}><mesh position={[x, 2.65, 0.285]} material={materials.laminate} castShadow><boxGeometry args={[0.6, 0.61, 0.02]}/></mesh><mesh position={[x + 0.24 * (x < 0 ? 1 : -1), 2.4, 0.302]} material={materials.steel}><boxGeometry args={[0.012, 0.12, 0.014]}/></mesh></group>)}
  </group>;
}

export function SafetyFixtures() {
  return <group position={[-5.74, 0, 3.3]} rotation={[0, Math.PI / 2, 0]}>
    <Sign text="LAVAOJOS / EMERGENCIA" position={[0, 1.7, 0]} width={1} height={0.25} dark/>
    <mesh position={[0, 0.5, 0.2]}><cylinderGeometry args={[0.025, 0.025, 0.95, 12]}/><meshStandardMaterial color="#b7c4c4" metalness={0.75} roughness={0.22}/></mesh>
    <mesh position={[0, 0.98, 0.2]}><cylinderGeometry args={[0.2, 0.1, 0.07, 24]}/><meshStandardMaterial color="#b7c4c4" metalness={0.75} roughness={0.22}/></mesh>
    {[-0.09, 0.09].map(x => <mesh key={x} position={[x, 1.05, 0.2]}><sphereGeometry args={[0.035, 12, 8]}/><meshStandardMaterial color="#dcc454"/></mesh>)}
  </group>;
}
