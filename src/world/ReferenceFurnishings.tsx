import { useMemo } from 'react';
import * as THREE from 'three';
import { Box, Sign } from './Models';
import { islands, stools } from './layout';

// Deterministic procedural surface: no photos, people, logos or external textures.
const granitePixels = new Uint8Array(128 * 128 * 4);
const granite = new THREE.DataTexture(granitePixels, 128, 128);
let seed = 714;
for (let i = 0; i < 128 * 128; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const v = 37 + (seed >>> 24) * 0.43;
  granitePixels.set([v * 0.94, v, v * 1.04, 255], i * 4);
}
granite.wrapS = granite.wrapT = THREE.RepeatWrapping;
granite.magFilter = THREE.LinearFilter;
granite.minFilter = THREE.LinearMipmapLinearFilter;
granite.generateMipmaps = true; granite.anisotropy = 4;
granite.repeat.set(3, 3); granite.colorSpace = THREE.SRGBColorSpace; granite.needsUpdate = true;

export function GraniteMaterial() { return <meshStandardMaterial map={granite} roughness={0.32} metalness={0.08}/>; }

function CutTop({ w, d, interactive }: { w: number; d: number; interactive?: string }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape(); const x = w / 2, z = d / 2, c = Math.min(w, d) * 0.22;
    s.moveTo(-x + c, -z); s.lineTo(x - c, -z); s.lineTo(x, -z + c); s.lineTo(x, z - c);
    s.lineTo(x - c, z); s.lineTo(-x + c, z); s.lineTo(-x, z - c); s.lineTo(-x, -z + c); s.closePath();
    return s;
  }, [w, d]);
  return <group rotation={[-Math.PI / 2, 0, 0]}>
    <mesh position={[0, 0, 1.015]} castShadow receiveShadow userData={{ interactive }}><extrudeGeometry args={[shape, { depth: 0.14, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.01, bevelThickness: 0.005 }]}/><GraniteMaterial/></mesh>
    <mesh position={[0, 0, 0.98]}><extrudeGeometry args={[shape, { depth: 0.03, bevelEnabled: false }]}/><meshStandardMaterial color="#e2e5df"/></mesh>
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
    <mesh position={[0, 0.035, 0]}><cylinderGeometry args={[0.56, 0.56, 0.07, 8]}/><meshStandardMaterial color="#a2a7a2" metalness={0.4}/></mesh>
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
  </group>)}</>;
}

export function Ceiling({ closed }: { closed: boolean }) {
  return <>
    {closed && <Box position={[0, 3.48, 0]} size={[12, 0.12, 10]} color="#f0efea"/>}
    {[-3.5, 3.5].map(x => <Box key={x} position={[x, 3.28, -0.5]} size={[0.32, 0.22, 8.4]} color="#7099b1"/>)}
    {[-4.7, 3.7].map(z => <Box key={z} position={[0, 3.28, z]} size={[7.3, 0.22, 0.32]} color="#7099b1"/>)}
    {[-2.3, 0, 2.3].flatMap(x => [-3, 0, 2.8].map(z => <group key={`${x}-${z}`} position={[x, 3.34, z]}>
      <Box position={[0, 0, 0]} size={[0.66, 0.055, 0.54]} color="#c7cfca"/>
      <mesh position={[0, -0.031, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[0.58, 0.46]}/><meshBasicMaterial color="#fffaf0"/></mesh>
    </group>))}
  </>;
}

export function WallCabinets() {
  return <group position={[-5.48, 0, 0.5]} rotation={[0, Math.PI / 2, 0]}>
    <Box position={[0, 2.65, 0]} size={[2.5, 0.65, 0.55]} color="#f0efea"/>
    {[-0.93, -0.31, 0.31, 0.93].map(x => <group key={x}><Box position={[x, 2.65, 0.285]} size={[0.6, 0.61, 0.035]} color="#f6f5ed"/><Box position={[x + 0.19, 2.6, 0.32]} size={[0.025, 0.17, 0.025]} color="#81908e"/></group>)}
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
