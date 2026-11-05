import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useLab } from '../state/lab';
import { movePlayer } from './collisions';
import { Instrument } from './Models';
import { GlovedHand } from './Hands';
import { type ItemId } from '../experiments/definitions';
const forward = new THREE.Vector3(); const side = new THREE.Vector3(); const move = new THREE.Vector3();
const ray = new THREE.Raycaster(); const center = new THREE.Vector2();
export function Player() {
  const { camera, gl, scene } = useThree(); const mode = useLab(s => s.mode);
  const hands = useRef<THREE.Group>(null); const keys = useRef(new Set<string>()); const tick = useRef(0);
  const locations = useLab(s => s.locations); const hand = useLab(s => s.hand); const pouring = useLab(s => s.pouring);
  useEffect(() => {
    camera.rotation.order = 'YXZ';
    if (mode) { camera.position.set(0, 1.65, 3.5); camera.rotation.set(0, 0, 0); }
    else { camera.position.set(5.1, 2.9, 4.8); camera.lookAt(-0.8, 1, -1.7); }
  // A mode change from tutorial to guided should not teleport the player.
  }, [!!mode, camera]);
  useEffect(() => {
    const locked = () => { const isLocked = document.pointerLockElement === gl.domElement; useLab.getState().setLocked(isLocked); if (!isLocked) keys.current.clear(); };
    const mouse = (e: MouseEvent) => {
      const s = useLab.getState(); if (!s.locked || s.panel) return;
      // Bound isolated pointer-lock spikes, including cursor recapture/wrapping.
      const mx = THREE.MathUtils.clamp(e.movementX, -150, 150), my = THREE.MathUtils.clamp(e.movementY, -150, 150);
      camera.rotation.y -= mx * 0.0018; camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - my * 0.0018, -1.4, 1.4);
      s.progress('look', Math.abs(mx) + Math.abs(my));
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { keys.current.clear(); if (document.pointerLockElement === gl.domElement) document.exitPointerLock(); return; }
      const s = useLab.getState(); if (!s.locked || s.panel || e.repeat) return;
      keys.current.add(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) e.preventDefault();
      if (e.code === 'KeyE') s.interact(); if (e.code === 'KeyQ') s.drop();
      if (e.code === 'KeyR' && s.mode !== 'tutorial' && !s.pouring && (s.target === 'bench' || s.target === 'beaker')) s.reset();
      if (e.code === 'Digit1') s.selectHand('left'); if (e.code === 'Digit2') s.selectHand('right');
      if (e.code === 'KeyN' && s.mode !== 'tutorial') s.open('notebook');
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); if (document.pointerLockElement) document.exitPointerLock(); };
    document.addEventListener('pointerlockchange', locked); document.addEventListener('mousemove', mouse); document.addEventListener('keydown', down); document.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { document.removeEventListener('pointerlockchange', locked); document.removeEventListener('mousemove', mouse); document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [camera, gl]);
  useFrame((_, delta) => {
    const s = useLab.getState();
    if (s.mode && s.locked && !s.panel && !s.pouring) {
      const dt = Math.min(delta, 0.06);
      const yaw = camera.rotation.y;
      forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)); side.set(Math.cos(yaw), 0, -Math.sin(yaw));
      move.set(0, 0, 0); const k = keys.current;
      if (k.has('KeyW')) move.add(forward); if (k.has('KeyS')) move.sub(forward); if (k.has('KeyD')) move.add(side); if (k.has('KeyA')) move.sub(side);
      move.normalize().multiplyScalar(dt * (k.has('ShiftLeft') ? 3.5 : 2.2));
      const oldX = camera.position.x, oldZ = camera.position.z;
      const next = movePlayer(oldX, oldZ, move.x, move.z);
      camera.position.x = next.x; camera.position.z = next.z;
      s.progress('move', Math.hypot(camera.position.x - oldX, camera.position.z - oldZ));
      tick.current += delta;
      if (tick.current > 0.07) {
        tick.current = 0; ray.setFromCamera(center, camera); ray.far = 2.7;
        const hits = ray.intersectObjects(scene.children.filter(o => !o.userData.ignoreRay), true);
        let target: string | null = null;
        for (const hit of hits) {
          let obj: THREE.Object3D | null = hit.object; let ignore = false; let id: string | null = null;
          while (obj) { if (obj.userData.ignoreRay) ignore = true; if (obj.userData.interactive) id = obj.userData.interactive; obj = obj.parent; }
          if (ignore) continue;
          target = id; break; // Walls and furniture occlude targets.
        }
        s.setTarget(target);
      }
    }
    if (hands.current) { hands.current.position.copy(camera.position); hands.current.quaternion.copy(camera.quaternion); }
  });
  return mode && <group ref={hands} userData={{ ignoreRay: true }}>
    {(['left', 'right'] as const).map(h => {
      const id = (Object.keys(locations) as ItemId[]).find(i => locations[i] === h); const x = h === 'left' ? -0.3 : 0.3;
      return <group key={h} position={[x, -0.28 + (hand === h ? 0.018 : 0), -0.72]}>
        <GlovedHand left={h === 'left'} holding={!!id}/>
        {id && pouring !== id && <group position={[0, 0.025, -0.08]} scale={0.65}><Instrument id={id} castShadow={false}/></group>}
      </group>;
    })}
  </group>;
}
