import { useMemo } from 'react';
import * as THREE from 'three';
import { materials } from './materials';
const bowl = new THREE.MeshStandardMaterial({ color: '#8c969a', metalness: 0.75, roughness: 0.42, envMapIntensity: 0.6 });

/** Square counter opening shared by the countertop geometry and the sink (bench-local metres). */
export const SINK_HOLE = 0.46;
const RIM = 0.54, DEPTH = 0.19;

function CrossHandle({ x }: { x: number }) {
  return <group position={[x, 0.03, -0.31]}>
    <mesh material={materials.chrome}><cylinderGeometry args={[0.018, 0.022, 0.04, 16]}/></mesh>
    {[0, 1, 2, 3].map(i => <mesh key={i} position={[Math.cos(i * Math.PI / 2) * 0.026, 0.026, Math.sin(i * Math.PI / 2) * 0.026]} rotation={[0, -i * Math.PI / 2, Math.PI / 2]} material={materials.chrome}><capsuleGeometry args={[0.006, 0.03, 4, 8]}/></mesh>)}
    <mesh position={[0, 0.03, 0]} material={materials.chrome}><sphereGeometry args={[0.012, 12, 8]}/></mesh>
  </group>;
}

/** Drop-in square stainless sink with a chrome gooseneck faucet and two cross handles (as in the photos). */
export function Sink({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const neck = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.02, -0.31), new THREE.Vector3(0, 0.2, -0.31), new THREE.Vector3(0, 0.3, -0.24), new THREE.Vector3(0, 0.29, -0.13), new THREE.Vector3(0, 0.21, -0.08),
  ]), []);
  return <group position={position} rotation={[0, rotation, 0]}>
    {/* Rim sitting on the granite. */}
    {[-1, 1].map(s => <group key={s}>
      <mesh position={[s * (RIM / 2 - (RIM - SINK_HOLE) / 4), 0.004, 0]} material={materials.steel} receiveShadow><boxGeometry args={[(RIM - SINK_HOLE) / 2, 0.008, RIM]}/></mesh>
      <mesh position={[0, 0.004, s * (RIM / 2 - (RIM - SINK_HOLE) / 4)]} material={materials.steel} receiveShadow><boxGeometry args={[SINK_HOLE, 0.008, (RIM - SINK_HOLE) / 2]}/></mesh>
      {/* Bowl walls, slightly inset under the rim. */}
      <mesh position={[s * (SINK_HOLE / 2 - 0.006), -DEPTH / 2, 0]} material={bowl} receiveShadow><boxGeometry args={[0.012, DEPTH, SINK_HOLE - 0.01]}/></mesh>
      <mesh position={[0, -DEPTH / 2, s * (SINK_HOLE / 2 - 0.006)]} material={bowl} receiveShadow><boxGeometry args={[SINK_HOLE - 0.01, DEPTH, 0.012]}/></mesh>
    </group>)}
    <mesh position={[0, -DEPTH, 0]} material={bowl} receiveShadow><boxGeometry args={[SINK_HOLE - 0.01, 0.01, SINK_HOLE - 0.01]}/></mesh>
    <mesh position={[0, -DEPTH + 0.006, 0]}><cylinderGeometry args={[0.045, 0.045, 0.004, 24]}/><meshStandardMaterial color="#9aa3a6" metalness={0.9} roughness={0.25}/></mesh>
    <mesh position={[0, -DEPTH + 0.008, 0]}><cylinderGeometry args={[0.03, 0.03, 0.004, 20]}/><meshStandardMaterial color="#1e2326" metalness={0.4} roughness={0.6}/></mesh>
    {/* Faucet deck and gooseneck. */}
    <mesh position={[0, 0.012, -0.31]} material={materials.chrome}><boxGeometry args={[0.26, 0.012, 0.05]}/></mesh>
    <mesh material={materials.chrome} castShadow><tubeGeometry args={[neck, 40, 0.012, 12, false]}/></mesh>
    <mesh position={[0, 0.205, -0.08]} material={materials.chrome}><cylinderGeometry args={[0.014, 0.012, 0.018, 12]}/></mesh>
    <mesh position={[0, 0.04, -0.31]} material={materials.chrome}><cylinderGeometry args={[0.02, 0.024, 0.05, 16]}/></mesh>
    <CrossHandle x={-0.1}/><CrossHandle x={0.1}/>
  </group>;
}
