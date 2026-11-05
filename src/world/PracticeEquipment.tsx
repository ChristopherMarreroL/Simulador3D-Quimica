import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePractices } from '../state/practices';
import { Instrument, Box, Sign } from './Models';
import type { PracticeId } from '../experiments/catalog';
function Equipment({ id, x, z }: { id: PracticeId; x: number; z: number }) {
  const session = usePractices(s => s.sessions[id]);
  const liquid = useRef<THREE.Mesh>(null), crystals = useRef<THREE.Group>(null), electrodes = useRef<THREE.Group>(null), bulb = useRef<THREE.Mesh>(null), steam = useRef<THREE.Group>(null);
  const wire = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(0.46, 0.06, 0), new THREE.Vector3(0.25, 0.035, 0.1), new THREE.Vector3(0.06, 0.46, 0), new THREE.Vector3(0, 0.48, 0)]), []);
  useFrame(() => {
    const phase = session?.phase;
    const progress = session ? Math.min(1, (Date.now() - session.startedAt) / (phase === 'evaporating' ? 3000 : 1800)) : 0;
    let height = 0, solid = 0;
    if (session?.kind === 'conductivity') height = 0.15;
    if (session?.kind === 'dissolution') {
      const p = phase === 'done' ? 1 : phase === 'evaporating' ? progress : 0;
      height = 0.06 + (session.input.waterG - p * session.result.evaporatedWater) / 150 * 0.12;
      solid = phase === 'prepared' ? 0 : phase === 'mixing' ? session.input.saltG * (1 - progress) + session.result.initialSolid * progress : session.result.initialSolid + p * session.result.newCrystals;
    }
    if (liquid.current) { liquid.current.visible = height > 0; liquid.current.scale.y = Math.max(0.001, height); liquid.current.position.y = 0.025 + height / 2; }
    if (crystals.current) { crystals.current.visible = solid > 0.001; crystals.current.scale.setScalar(Math.min(1.5, Math.cbrt(solid / 10))); }
    if (electrodes.current) electrodes.current.position.y = phase === 'done' ? 0.1 : phase === 'measuring' ? 0.4 - progress * 0.3 : 0.4;
    if (bulb.current) { const material = bulb.current.material as THREE.MeshStandardMaterial; const brightness = session?.kind === 'conductivity' && (phase === 'done' || phase === 'measuring' && progress > 0.65) ? session.result.brightness : 0; material.emissiveIntensity = brightness * 2; material.color.set(brightness ? '#ffe28b' : '#a1b8bb'); }
    if (steam.current) { steam.current.visible = phase === 'evaporating'; steam.current.children.forEach((m, i) => { m.position.y = 0.3 + ((Date.now() / 1500 + i * 0.17) % 1) * 0.4; }); }
  });
  return <group position={[x, 1.16, z]} userData={{ interactive: id === 'conductivity' ? 'support-1' : 'support-2' }}>
    {id === 'dissolution' && <><Box position={[-0.12, 0.025, -0.23]} size={[0.45, 0.05, 0.43]} color="#5e7377"/><mesh position={[-0.12, 0.052, -0.23]}><cylinderGeometry args={[0.16, 0.16, 0.006, 24]}/><meshStandardMaterial color="#758385" emissive="#d6683f" emissiveIntensity={session?.phase === 'evaporating' ? 1.1 : 0}/></mesh></>}
    <group position={[-0.12, id === 'dissolution' ? 0.055 : 0, -0.23]}>
      <Instrument id="beaker"/>
      <mesh ref={liquid}><cylinderGeometry args={[0.12, 0.12, 1, 24]}/><meshStandardMaterial color="#8fc4d0" transparent opacity={0.55}/></mesh>
      <group ref={crystals}>{Array.from({ length: 14 }, (_, i) => <mesh key={i} position={[Math.sin(i * 4.2) * 0.075, 0.04 + i % 3 * 0.01, Math.cos(i * 4.2) * 0.075]} rotation={[0, i, 0]}><boxGeometry args={[0.025, 0.025, 0.025]}/><meshStandardMaterial color="#f4f5e9" roughness={0.3}/></mesh>)}</group>
      {id === 'conductivity' && <><group ref={electrodes}>{[-0.05, 0.05].map(dx => <mesh key={dx} position={[dx, 0.22, 0]}><cylinderGeometry args={[0.012, 0.012, 0.44, 10]}/><meshStandardMaterial color="#43565b" metalness={0.6}/></mesh>)}</group><Box position={[0, 0.5, 0]} size={[0.17, 0.04, 0.045]} color="#415e66"/></>}
      <group ref={steam} userData={{ ignoreRay: true }}>{[0, 1, 2].map(i => <mesh key={i} position={[i * 0.025 - 0.025, 0.4, 0]}><sphereGeometry args={[0.04, 8, 8]}/><meshStandardMaterial color="#edf4f2" transparent opacity={0.24}/></mesh>)}</group>
    </group>
    {id === 'conductivity' && <>
      <Box position={[0.35, 0.035, -0.17]} size={[0.26, 0.07, 0.24]} color="#425b61"/>
      <mesh position={[0.35, 0.12, -0.17]}><cylinderGeometry args={[0.035, 0.045, 0.12, 14]}/><meshStandardMaterial color="#859b9e" metalness={0.5}/></mesh>
      <mesh ref={bulb} position={[0.35, 0.23, -0.17]}><sphereGeometry args={[0.09, 20, 16]}/><meshStandardMaterial color="#a1b8bb" emissive="#ffd349" emissiveIntensity={0} roughness={0.2}/></mesh>
      <mesh position={[-0.12, 0, -0.23]}><tubeGeometry args={[wire, 18, 0.006, 6, false]}/><meshStandardMaterial color="#2e454d"/></mesh>
    </>}
    <Sign text={id === 'conductivity' ? 'E / CONDUCTIVIDAD' : 'E / CRISTALIZACIÓN'} position={[0, 0.65, -0.42]} width={0.88} height={0.17} dark/>
  </group>;
}
export function PracticeEquipment() { return <><Equipment id="conductivity" x={-2.8} z={0.8}/><Equipment id="dissolution" x={2.7} z={2.7}/></>; }
