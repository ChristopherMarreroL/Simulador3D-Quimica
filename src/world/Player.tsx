import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useLab } from '../state/lab';
import { useHood, type Hand } from '../state/hood';
import { useSettings } from '../state/settings';
import { movePlayer } from './collisions';
import { Instrument } from './Models';
import { GlovedHand, type HandPose } from './Hands';
import { ReagentBottle } from './ReagentBottle';
import { PipetteModel } from './Storage';
import { type ItemId } from '../experiments/definitions';
const forward = new THREE.Vector3(); const side = new THREE.Vector3(); const move = new THREE.Vector3();
const ray = new THREE.Raycaster(); const center = new THREE.Vector2();
const HANDS: Hand[] = ['left', 'right'];
const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));
/** Hand motion only: the camera itself never bobs, so movement stays comfortable and stable. */
interface HandMotion { walk: number; speed: number; yaw: number; pitch: number; swayX: number; swayY: number; reach: Record<Hand, number>; lift: Record<Hand, number>; twist: Record<Hand, number>; held: Record<Hand, string | null> }
export function Player() {
  const { camera, gl, scene } = useThree(); const mode = useLab(s => s.mode);
  const hands = useRef<THREE.Group>(null); const keys = useRef(new Set<string>()); const tick = useRef(0); const streaming = useRef(false); const streamFrom = useRef<string | null>(null);
  const handGroups = useRef<Record<Hand, THREE.Group | null>>({ left: null, right: null });
  const poses = { left: useRef<HandPose>({ grip: 0.2, tilt: -0.85 }), right: useRef<HandPose>({ grip: 0.2, tilt: -0.85 }) };
  const motion = useRef<HandMotion>({ walk: 0, speed: 0, yaw: 0, pitch: 0, swayX: 0, swayY: 0, reach: { left: 0, right: 0 }, lift: { left: 0, right: 0 }, twist: { left: 0, right: 0 }, held: { left: null, right: null } });
  const locations = useLab(s => s.locations); const pouring = useLab(s => s.pouring);
  const places = useHood(s => s.places); const hoodPour = useHood(s => s.pouring); const pipettePlace = useHood(s => s.pipette.place); const gloved = useLab(s => s.ppe.gloves);
  useEffect(() => {
    camera.rotation.order = 'YXZ';
    if (mode) { camera.position.set(0, 1.65, 3.5); camera.rotation.set(0, 0, 0); }
    else { camera.position.set(5.1, 2.9, 4.8); camera.lookAt(-0.8, 1, -1.7); }
    motion.current.yaw = camera.rotation.y; motion.current.pitch = camera.rotation.x;
  // A mode change from tutorial to guided should not teleport the player.
  }, [!!mode, camera]);
  useEffect(() => {
    const stopStream = () => { if (streaming.current) { streaming.current = false; useHood.getState().stopStream(); } };
    const locked = () => { const isLocked = document.pointerLockElement === gl.domElement; useLab.getState().setLocked(isLocked); if (!isLocked) { keys.current.clear(); stopStream(); } };
    // Left click is the primary action (same as E). Held over the flask with a bottle in hand, it pours.
    const press = (e: MouseEvent) => {
      const s = useLab.getState(); if (e.button !== 0 || !s.locked || s.panel) return;
      const hood = useHood.getState(); const held = hood.heldIn(s.hand);
      motion.current.reach[s.hand] = Math.max(motion.current.reach[s.hand], 0.75);
      const streamTarget = s.target === 'hood' ? 'flask' : s.target === 'hood-cylinder' ? 'cylinder' : s.target === 'hood-balance' ? 'balance' : s.target === 'hood-pipette' ? 'pipette' : null;
      if (held && streamTarget) { streamFrom.current = s.target; if (hood.startStream(held, streamTarget)) streaming.current = true; else if (useHood.getState().error) useLab.setState({ message: useHood.getState().error }); return; }
      s.interact();
    };
    const release = (e: MouseEvent) => { if (e.button === 0) stopStream(); };
    const mouse = (e: MouseEvent) => {
      const s = useLab.getState(); if (!s.locked || s.panel) return;
      // Bound isolated pointer-lock spikes, including cursor recapture/wrapping.
      const mx = THREE.MathUtils.clamp(e.movementX, -150, 150), my = THREE.MathUtils.clamp(e.movementY, -150, 150);
      const k = 0.0018 * useSettings.getState().sensitivity;
      camera.rotation.y -= mx * k; camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - my * k, -1.4, 1.4);
      s.progress('look', Math.abs(mx) + Math.abs(my));
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { keys.current.clear(); if (document.pointerLockElement === gl.domElement) document.exitPointerLock(); return; }
      const s = useLab.getState(); if (!s.locked || s.panel || e.repeat) return;
      keys.current.add(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) e.preventDefault();
      if (e.code === 'KeyE' || e.code === 'KeyQ') motion.current.reach[s.hand] = Math.max(motion.current.reach[s.hand], 0.75);
      if (e.code === 'KeyE') s.interact(); if (e.code === 'KeyQ') s.drop();
      if (e.code === 'KeyR' && s.mode !== 'tutorial' && !s.pouring && (s.target === 'bench' || s.target === 'beaker')) s.reset();
      if (e.code === 'Digit1') s.selectHand('left'); if (e.code === 'Digit2') s.selectHand('right');
      if (e.code === 'KeyN' && s.mode !== 'tutorial') s.open('notebook');
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); stopStream(); if (document.pointerLockElement) document.exitPointerLock(); };
    document.addEventListener('pointerlockchange', locked); document.addEventListener('mousemove', mouse); document.addEventListener('keydown', down); document.addEventListener('keyup', up); window.addEventListener('blur', blur);
    document.addEventListener('mousedown', press); document.addEventListener('mouseup', release);
    return () => { stopStream(); document.removeEventListener('pointerlockchange', locked); document.removeEventListener('mousemove', mouse); document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); window.removeEventListener('blur', blur); document.removeEventListener('mousedown', press); document.removeEventListener('mouseup', release); };
  }, [camera, gl]);
  useFrame(({ clock }, delta) => {
    const s = useLab.getState(); const dt = Math.min(delta, 0.06); let speed = 0;
    if (s.mode && s.locked && !s.panel && !s.pouring) {
      const yaw = camera.rotation.y;
      forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)); side.set(Math.cos(yaw), 0, -Math.sin(yaw));
      move.set(0, 0, 0); const k = keys.current;
      if (k.has('KeyW')) move.add(forward); if (k.has('KeyS')) move.sub(forward); if (k.has('KeyD')) move.add(side); if (k.has('KeyA')) move.sub(side);
      move.normalize().multiplyScalar(dt * (k.has('ShiftLeft') ? 3.5 : 2.2));
      const oldX = camera.position.x, oldZ = camera.position.z;
      const next = movePlayer(oldX, oldZ, move.x, move.z);
      camera.position.x = next.x; camera.position.z = next.z;
      const moved = Math.hypot(camera.position.x - oldX, camera.position.z - oldZ);
      speed = dt > 0 ? moved / dt : 0;
      s.progress('move', moved);
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
    if (streaming.current) {
      // Keep pouring only while the flask stays under the crosshair.
      if (!s.locked || s.panel || s.target !== streamFrom.current) { streaming.current = false; useHood.getState().stopStream(); }
      else useHood.getState().streamTick(Math.min(delta, 0.1));
    }
    if (!hands.current) return;
    hands.current.position.copy(camera.position); hands.current.quaternion.copy(camera.quaternion);
    const m = motion.current; const hood = useHood.getState();
    m.speed = damp(m.speed, Math.min(1, speed / 2.2), 8, dt);
    m.walk += dt * (2 + m.speed * 7);
    // Hands trail the view a little when turning, then settle.
    const dYaw = Math.atan2(Math.sin(camera.rotation.y - m.yaw), Math.cos(camera.rotation.y - m.yaw)); const dPitch = camera.rotation.x - m.pitch;
    m.yaw = camera.rotation.y; m.pitch = camera.rotation.x;
    m.swayX = damp(THREE.MathUtils.clamp(m.swayX + dYaw * 0.35, -0.05, 0.05), 0, 6, dt);
    m.swayY = damp(THREE.MathUtils.clamp(m.swayY - dPitch * 0.25, -0.04, 0.04), 0, 6, dt);
    const breathe = Math.sin(clock.elapsedTime * 1.7) * 0.0035;
    for (const h of HANDS) {
      const group = handGroups.current[h]; if (!group) continue;
      const itemHeld = (Object.keys(s.locations) as ItemId[]).find(i => s.locations[i] === h) ?? hood.heldIn(h) ?? (hood.pipette.place === h ? 'pipette' : null);
      if (itemHeld !== m.held[h]) { if (itemHeld) m.reach[h] = 1; m.held[h] = itemHeld ?? null; }
      const pouringHere = (s.pouring && s.locations[s.pouring] === h) || (hood.pouring && hood.places[hood.pouring.reagent] === h);
      m.reach[h] = damp(m.reach[h], 0, 4.5, dt);
      m.lift[h] = damp(m.lift[h], s.hand === h ? 0.022 : 0, 10, dt);
      m.twist[h] = damp(m.twist[h], pouringHere ? 1 : 0, 6, dt);
      const sign = h === 'left' ? -1 : 1; const phase = m.walk + (h === 'left' ? Math.PI : 0);
      const reachCurve = Math.sin(Math.min(1, m.reach[h]) * Math.PI * 0.5);
      group.position.set(
        sign * (0.27 - m.twist[h] * 0.08) + Math.cos(phase) * 0.009 * m.speed + m.swayX,
        -0.25 + m.lift[h] + Math.abs(Math.sin(phase)) * 0.014 * m.speed + breathe + m.swayY + reachCurve * 0.035 + m.twist[h] * 0.05,
        -0.64 - reachCurve * 0.09 - m.twist[h] * 0.06,
      );
      group.rotation.set(-reachCurve * 0.28 + m.twist[h] * 0.15, sign * -m.twist[h] * 0.2, -sign * m.twist[h] * 0.95);
      const pose = poses[h].current;
      pose.grip = damp(pose.grip, itemHeld ? (m.reach[h] > 0.6 ? 0.55 : 1) : m.reach[h] > 0.3 ? 0 : 0.2, 10, dt);
      // Empty hands rest bent forward at the wrist (fingers seen along their length); holding stands them upright.
      pose.tilt = damp(pose.tilt, itemHeld ? -0.12 : -0.85 + reachCurve * 0.3, 8, dt);
    }
  });
  return mode && <group ref={hands} userData={{ ignoreRay: true }}>
    {HANDS.map(h => {
      const id = (Object.keys(locations) as ItemId[]).find(i => locations[i] === h);
      const reagent = (Object.keys(places) as (keyof typeof places)[]).find(r => places[r] === h);
      const inward = h === 'left' ? 1 : -1;
      return <group key={h} ref={g => { handGroups.current[h] = g; }} position={[h === 'left' ? -0.27 : 0.27, -0.25, -0.64]}>
        <GlovedHand left={h === 'left'} pose={poses[h]} gloved={gloved}/>
        {id && pouring !== id && <group position={[inward * 0.075, -0.02, -0.035]} scale={0.6}><Instrument id={id} castShadow={false}/></group>}
        {pipettePlace === h && <group position={[inward * 0.05, -0.14, -0.03]}><PipetteModel/></group>}
        {reagent && hoodPour?.reagent !== reagent && <group position={[inward * 0.05, -0.045, -0.03]} scale={0.72}><ReagentBottle id={reagent} castShadow={false} interactive={false}/></group>}
      </group>;
    })}
  </group>;
}
