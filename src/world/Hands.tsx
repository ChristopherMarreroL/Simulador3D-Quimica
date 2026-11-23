import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Animated pose shared with the player: 0 = open hand, 1 = closed around an object. */
export interface HandPose { grip: number; tilt: number }
const nitrile = new THREE.MeshPhysicalMaterial({ color: '#5a82d4', roughness: 0.42, sheen: 0.7, sheenColor: new THREE.Color('#a9bdf0'), sheenRoughness: 0.5, clearcoat: 0.12 });
/** Bare skin until the player puts on nitrile gloves at the protection station. */
const skin = new THREE.MeshPhysicalMaterial({ color: '#d7a382', roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color('#f0c3a6') });
const coat = new THREE.MeshStandardMaterial({ color: '#f5f6f2', roughness: 0.92 });
const coatShade = new THREE.MeshStandardMaterial({ color: '#e4e6e0', roughness: 0.95 });
const palmGeometry = new RoundedBoxGeometry(0.078, 0.09, 0.03, 3, 0.013);
// Index → little finger: phalanx lengths (m), base height offset and radius.
const FINGERS = [
  { x: -0.027, lengths: [0.027, 0.019, 0.016], y: 0.0, r: 0.0088 },
  { x: -0.009, lengths: [0.03, 0.021, 0.017], y: 0.004, r: 0.009 },
  { x: 0.009, lengths: [0.028, 0.02, 0.016], y: 0.002, r: 0.0086 },
  { x: 0.027, lengths: [0.022, 0.016, 0.014], y: -0.006, r: 0.0078 },
];
const capsules = new Map<string, THREE.CapsuleGeometry>();
const capsule = (r: number, l: number) => { const k = `${r}:${l}`; let g = capsules.get(k); if (!g) { g = new THREE.CapsuleGeometry(r, Math.max(0.001, l - r * 2), 4, 10); g.translate(0, l / 2, 0); capsules.set(k, g); } return g; };

/** Finger as a chain of three phalanges; each joint curls towards the palm (local −z). */
function Finger({ spec, sign, joints, material }: { spec: typeof FINGERS[number]; sign: number; joints: (THREE.Group | null)[]; material: THREE.Material }) {
  const [a, b, c] = spec.lengths;
  return <group position={[spec.x * -sign, 0.044 + spec.y, -0.004]} ref={g => { joints[0] = g; }}>
    <mesh geometry={capsule(spec.r, a)} material={material} castShadow={false}/>
    <group position={[0, a, 0]} ref={g => { joints[1] = g; }}>
      <mesh geometry={capsule(spec.r * 0.95, b)} material={material}/>
      <group position={[0, b, 0]} ref={g => { joints[2] = g; }}><mesh geometry={capsule(spec.r * 0.9, c)} material={material}/></group>
    </group>
  </group>;
}

export function GlovedHand({ left, pose, gloved = true }: { left: boolean; pose: MutableRefObject<HandPose>; gloved?: boolean }) {
  const hand = gloved ? nitrile : skin;
  // The thumb sits on the inner side: −x for the right hand and +x for the left (seen from behind).
  const sign = left ? 1 : -1;
  const joints = useMemo(() => FINGERS.map(() => [null, null, null] as (THREE.Group | null)[]), []);
  const thumb = useRef<THREE.Group>(null); const thumbTip = useRef<THREE.Group>(null); const wrist = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = pose.current.grip; const t = clock.elapsedTime;
    joints.forEach((chain, i) => {
      // Relaxed hands keep a small, offset motion; a firm grip removes it and closes every joint.
      const idle = (1 - g) * Math.sin(t * 1.3 + i * 0.8) * 0.06;
      const base = 0.12 + g * 0.95 + idle + i * 0.03 * (1 - g);
      if (chain[0]) { chain[0].rotation.x = -base; chain[0].rotation.z = sign * (i - 1.5) * 0.05 * (1 - g); }
      if (chain[1]) chain[1].rotation.x = -(0.18 + g * 1.15 + idle * 0.6);
      if (chain[2]) chain[2].rotation.x = -(0.1 + g * 0.8);
    });
    if (thumb.current) { thumb.current.rotation.set(-0.35 - g * 0.55, 0, sign * (0.85 - g * 0.5)); }
    if (thumbTip.current) thumbTip.current.rotation.x = -(0.2 + g * 0.6);
    if (wrist.current) {
      // Holding turns the palm inwards so the fingers wrap the object and the thumb stays on the near side.
      const hold = Math.max(0, Math.min(1, (g - 0.3) / 0.7));
      wrist.current.rotation.set(pose.current.tilt, -sign * hold * 1.05, -sign * (pose.current.tilt + 0.12) * 0.25 * (1 - hold), 'YXZ');
    }
  });
  return <group>
    {/* Lab-coat sleeve with a turned cuff. */}
    <mesh position={[0, -0.12, 0.2]} rotation={[-1.13, 0, 0]} material={coat}><cylinderGeometry args={[0.042, 0.07, 0.42, 28]}/></mesh>
    <mesh position={[0, -0.024, 0.028]} rotation={[-1.13, 0, 0]} material={coatShade}><cylinderGeometry args={[0.046, 0.046, 0.03, 28]}/></mesh>
    {/* Glove cuff and wrist. */}
    <mesh position={[0, -0.05, 0.006]} rotation={[-0.35, 0, 0]} material={hand}><cylinderGeometry args={gloved ? [0.03, 0.036, 0.05, 20] : [0.026, 0.029, 0.05, 20]}/></mesh>
    {/* Everything above the wrist bends forward around the wrist pivot. */}
    <group ref={wrist} position={[0, -0.045, 0]}><group position={[0, 0.045, 0]}>
    <mesh geometry={palmGeometry} material={hand}/>
    {FINGERS.map((f, i) => <Finger key={i} spec={f} sign={sign} joints={joints[i]} material={hand}/>)}
    <group ref={thumb} position={[sign * 0.034, -0.018, -0.006]}>
      <mesh geometry={capsule(0.0105, 0.028)} material={hand}/>
      <group ref={thumbTip} position={[0, 0.028, 0]}><mesh geometry={capsule(0.0095, 0.022)} material={hand}/></group>
    </group>
    </group></group>
  </group>;
}
