import { useMemo } from 'react';
import * as THREE from 'three';
import { Box } from './Models';
export function Sink({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const tap = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, -0.36), new THREE.Vector3(0, 0.22, -0.36), new THREE.Vector3(0, 0.34, -0.25), new THREE.Vector3(0, 0.28, -0.05), new THREE.Vector3(0, 0.21, -0.05),
  ]), []);
  const metal = { color: '#adbfc2', metalness: 0.75, roughness: 0.25 };
  return <group position={position} rotation={[0, rotation, 0]}>
    <Box position={[0, -0.16, 0]} size={[0.6, 0.025, 0.54]} color="#70868a"/>
    {[-1, 1].map(n => <group key={n}>
      <mesh position={[n * 0.3, -0.075, 0]}><boxGeometry args={[0.025, 0.15, 0.58]}/><meshStandardMaterial {...metal}/></mesh>
      <mesh position={[0, -0.075, n * 0.27]}><boxGeometry args={[0.6, 0.15, 0.025]}/><meshStandardMaterial {...metal}/></mesh>
      <mesh position={[n * 0.325, 0.006, 0]}><boxGeometry args={[0.05, 0.018, 0.66]}/><meshStandardMaterial {...metal}/></mesh>
      <mesh position={[0, 0.006, n * 0.3]}><boxGeometry args={[0.6, 0.018, 0.06]}/><meshStandardMaterial {...metal}/></mesh>
    </group>)}
    <mesh position={[0, -0.141, 0]}><cylinderGeometry args={[0.045, 0.045, 0.005, 24]}/><meshStandardMaterial color="#34474b" metalness={0.6}/></mesh>
    <mesh><tubeGeometry args={[tap, 32, 0.018, 10, false]}/><meshStandardMaterial {...metal}/></mesh>
    <mesh position={[0, 0.015, -0.36]}><cylinderGeometry args={[0.04, 0.05, 0.03, 16]}/><meshStandardMaterial {...metal}/></mesh>
    <Box position={[0.09, 0.045, -0.36]} size={[0.12, 0.025, 0.03]} color="#adbfc2"/>
  </group>;
}
