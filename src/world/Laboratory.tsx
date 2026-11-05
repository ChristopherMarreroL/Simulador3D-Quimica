import { memo, useMemo, useRef } from 'react';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useLab, guidedIndex } from '../state/lab';
import { items, type ItemId } from '../experiments/definitions';
import { isSurface, itemPosition, surfaceNames } from '../experiments/surfaces';
import { Box, Instrument, Sign, PeriodicPoster } from './Models';
import { Player } from './Player';
import { Sink } from './Sink';
import { PracticeEquipment } from './PracticeEquipment';
import { Ceiling, GraniteMaterial, LabStools, SafetyFixtures, WallCabinets, WorkIslands } from './ReferenceFurnishings';
function sinkCountertop(width: number, depth: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -depth / 2); shape.lineTo(width / 2, -depth / 2); shape.lineTo(width / 2, depth / 2); shape.lineTo(-width / 2, depth / 2); shape.closePath();
  const hole = new THREE.Path(); hole.moveTo(-0.31, -0.28); hole.lineTo(-0.31, 0.28); hole.lineTo(0.31, 0.28); hole.lineTo(0.31, -0.28); hole.closePath(); shape.holes.push(hole);
  return shape;
}
function Bench({ x, z, width, depth, interactive, sink = false }: { x: number; z: number; width: number; depth: number; interactive?: string; sink?: boolean }) {
  const countertop = useMemo(() => sinkCountertop(width, depth), [width, depth]);
  return <group>
    {sink ? <group position={[x, 1, z]} rotation={[-Math.PI / 2, 0, 0]}><mesh castShadow receiveShadow><extrudeGeometry args={[countertop, { depth: 0.16, bevelEnabled: false }]}/><GraniteMaterial/></mesh></group> : <mesh position={[x, 1.08, z]} castShadow receiveShadow userData={{ interactive }}><boxGeometry args={[width, 0.16, depth]}/><GraniteMaterial/></mesh>}
    {sink && <Sink position={[x, 1.16, z]}/>}
    <Box position={[x, 0.55, z]} size={[width - 0.12, 0.82, depth - 0.12]} color="#d2dcd8"/>
    {Array.from({ length: Math.round(width / 0.65) }, (_, i) => <group key={i}><Box position={[x - width / 2 + 0.38 + i * 0.65, 0.57, z + depth / 2 - 0.03]} size={[0.6, 0.81, 0.03]} color="#e4eae6"/><Box position={[x - width / 2 + 0.38 + i * 0.65, 0.85, z + depth / 2]} size={[0.22, 0.025, 0.025]} color="#7a9493"/></group>)}
  </group>;
}
function ReactionEffect() {
  const s = useLab(useShallow(s => ({ reactingAt: s.reactingAt, bicarbonateG: s.bicarbonateG, vinegarMl: s.vinegarMl, pouring: s.pouring }))); const group = useRef<THREE.Group>(null); const foam = useRef<THREE.Mesh>(null); const pour = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) {
      const age = s.reactingAt ? (Date.now() - s.reactingAt) / 1000 : 100;
      const moles = s.bicarbonateG ? Math.min(s.vinegarMl / 1000 * 0.83, s.bicarbonateG / 84.0066) : 0;
      const duration = 5 + moles * 150; const activity = Math.max(0, 1 - age / duration);
      group.current.visible = activity > 0 && moles > 0;
      group.current.children.forEach((bubble, i) => {
        const phase = (clock.elapsedTime * (0.5 + activity) + i * 0.618) % 1;
        bubble.position.set(Math.sin(i * 7.1) * 0.1, 0.06 + phase * 0.44, Math.cos(i * 3.7) * 0.1);
        bubble.scale.setScalar((0.5 + Math.sin(i) * 0.2) * activity * Math.min(1, moles / 0.02));
      });
      if (foam.current) { foam.current.visible = activity > 0 && moles > 0; foam.current.scale.set(1, Math.max(0.05, activity * Math.min(1, moles / 0.02)), 1); }
    }
    if (pour.current) pour.current.rotation.z = -0.85 + Math.sin(clock.elapsedTime * 3) * 0.04;
  });
  return <group position={itemPosition('beaker', 'bench')} userData={{ ignoreRay: true }}>
    <group ref={group}>{Array.from({ length: 30 }, (_, i) => <mesh key={i}><sphereGeometry args={[0.025, 8, 8]}/><meshStandardMaterial color="#f5f7d9" transparent opacity={0.7}/></mesh>)}</group>
    <mesh ref={foam} position={[0, 0.25, 0]}><sphereGeometry args={[0.13, 16, 10]}/><meshStandardMaterial color="#f6efd0" transparent opacity={0.75}/></mesh>
    {s.pouring && <>
      <group ref={pour} position={[-0.28, 0.62, 0]}><Instrument id={s.pouring} castShadow={false}/></group>
      <mesh position={[0, 0.48, 0]}><cylinderGeometry args={[0.009, 0.016, 0.47, 8]}/><meshStandardMaterial color={s.pouring === 'vinegar' ? '#e7c37a' : '#f5f4e8'} transparent opacity={0.8}/></mesh>
    </>}
  </group>;
}
function ObjectiveMarker() {
  const s = useLab(); const ref = useRef<THREE.Group>(null); let id: string | null = null;
  if (s.mode === 'tutorial') id = s.tutorial >= 4 ? 'bench' : s.tutorial >= 2 ? 'beaker' : null;
  if (s.mode === 'guided' && s.activePractice !== 'reaction') id = s.activePractice === 'conductivity' ? 'support-1' : 'support-2';
  else if (s.mode === 'guided') id = ['beaker', 'bench', 'vinegar', 'bench', 'bicarbonate', 'bench', 'bench'][guidedIndex(s)];
  const loc = id && id in items ? s.locations[id as ItemId] : null;
  const p: [number, number, number] = id === 'bench' ? [0.2, 2, -0.5] : id === 'support-1' ? [-2.8, 1.4, 0.8] : id === 'support-2' ? [2.7, 1.4, 2.7] : id && isSurface(loc) ? [...itemPosition(id as ItemId, loc)] : [0, 0, 0];
  if (id !== 'bench') p[1] += 1;
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = p[1] + Math.sin(clock.elapsedTime * 2) * 0.06; });
  return id && <group ref={ref} position={p} userData={{ ignoreRay: true }}>
    <mesh rotation={[0, 0, Math.PI]}><coneGeometry args={[0.08, 0.18, 4]}/><meshBasicMaterial color="#e9bd65"/></mesh>
    <Sign text={isSurface(id) ? surfaceNames[id] : items[id as ItemId].name} position={[0, 0.24, 0]} width={1.2} height={0.2} dark/>
  </group>;
}
function ShadowUpdates() {
  const { gl } = useThree(); const locations = useLab(s => s.locations); const mode = useLab(s => !!s.mode);
  useEffect(() => { gl.shadowMap.autoUpdate = false; gl.shadowMap.needsUpdate = true; return () => { gl.shadowMap.autoUpdate = true; }; }, [gl, locations, mode]);
  return null;
}
function Room() {
  const s = useLab(useShallow(s => ({ mode: s.mode, locations: s.locations, target: s.target, vinegarMl: s.vinegarMl })));
  return <>
    <color attach="background" args={['#c8d9da']}/><fog attach="fog" args={['#c8d9da', 16, 32]}/>
    <ambientLight intensity={0.65}/><hemisphereLight args={['#f1f6ff', '#9f9c87', 1.3]}/>
    <directionalLight position={[5, 3, 1]} intensity={1.8} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-normalBias={0.03}/>
    <Ceiling closed={!!s.mode}/>
    <Box position={[0, -0.08, 0]} size={[12, 0.16, 10]} color="#d7d4c3"/>
    {Array.from({ length: 11 }, (_, i) => <Box key={`v${i}`} position={[-5 + i, 0.004, 0]} size={[0.008, 0.005, 10]} color="#b5b5a6"/>)}
    {Array.from({ length: 9 }, (_, i) => <Box key={`h${i}`} position={[0, 0.004, -4 + i]} size={[12, 0.005, 0.008]} color="#b5b5a6"/>)}
    <Box position={[0, 1.7, -5]} size={[12, 3.4, 0.12]} color="#eeeFE8"/>
    <Box position={[-6, 1.7, 0]} size={[0.12, 3.4, 10]} color="#eeeFE8"/>
    <Box position={[6, 1.7, 0]} size={[0.12, 3.4, 10]} color="#eeeFE8"/>
    {s.mode && <Box position={[0, 1.7, 5]} size={[12, 3.4, 0.12]} color="#e1e9e3"/>}
    <Box position={[0, 0.12, -4.91]} size={[12, 0.24, 0.04]} color="#66847f"/>
    <Sign text="EXPERIMENTA / LABORATORIO DE QUÍMICA" position={[-1.8, 2.9, -4.92]} width={4.9} height={0.38} dark/>
    <WorkIslands/><PracticeEquipment/><LabStools/><WallCabinets/><SafetyFixtures/>
    <Bench x={-3.15} z={-4.1} width={4.3} depth={1} interactive="shelf"/>
    <Sign text="REACTIVOS Y MATERIAL" position={[-3.15, 1.9, -4.91]} width={2.9} height={0.3}/>
    <Box position={[-3.15, 2.15, -4.45]} size={[4.4, 0.08, 0.8]} color="#476a69"/>
    {[-4.8, -3.9, -3, -2.1, -1.4].map((x, i) => <group key={x} position={[x, 2.2, -4.4]} scale={0.7}><Instrument id={i % 2 ? 'vinegar' : 'bicarbonate'}/></group>)}
    <Bench x={4.8} z={-3.6} width={1.8} depth={2}/>
    <Box position={[4.8, 2.65, -3.8]} size={[1.9, 0.45, 2]} color="#7099b1"/>
    <Box position={[4.05, 1.95, -3.8]} size={[0.07, 1, 1.8]} color="#91abaa"/>
    <Box position={[5.55, 1.95, -3.8]} size={[0.07, 1, 1.8]} color="#91abaa"/>
    <mesh position={[4.8, 2.04, -2.82]}><planeGeometry args={[1.45, 0.7]}/><meshPhysicalMaterial color="#c8e0e2" transparent opacity={0.23} side={THREE.DoubleSide} roughness={0.12}/></mesh>
    <Sign text="CAMPANA EXTRACTORA" position={[4.8, 2.65, -2.79]} width={1.55} height={0.23}/>
    <Bench x={-5.1} z={0.5} width={1} depth={2.5} sink/>
    <group position={[5.25, 0, 0.8]} rotation={[0, -Math.PI / 2, 0]}><Bench x={0} z={0} width={4.8} depth={0.95} sink/></group>
    {[0, 2.25].map(z => <group key={z}>
      <mesh position={[5.92, 2.15, z]}><boxGeometry args={[0.03, 1.6, 2]}/><meshStandardMaterial color="#d5e2e4" emissive="#c7dadd" emissiveIntensity={0.38} roughness={0.25}/></mesh>
      {[z - 1, z, z + 1].map(frameZ => <Box key={frameZ} position={[5.88, 2.15, frameZ]} size={[0.07, 1.72, 0.045]} color="#f5f3e9"/>)}
      {[1.32, 2.98].map(y => <Box key={y} position={[5.88, y, z]} size={[0.07, 0.045, 2.08]} color="#f5f3e9"/>)}
    </group>)}
    <Box position={[1.6, 2, -4.9]} size={[2.3, 1.15, 0.04]} color="#f1f6ee" interactive="periodic"/>
    <Sign text="TABLA PERIÓDICA · E" position={[1.6, 2.4, -4.86]} width={2.1} height={0.25}/>
    <PeriodicPoster/>
    <Box position={[-5.9, 1.1, 3.8]} size={[0.1, 1.4, 0.45]} color="#b84739"/>
    <Sign text="SALIDA" position={[4.6, 2.9, -4.91]} width={1.2} height={0.26} dark/>
    {(Object.keys(items) as ItemId[]).map(id => {
      const loc = s.locations[id]; if (!isSurface(loc)) return null;
      return <group key={id} position={itemPosition(id, loc)}><Instrument id={id} highlighted={s.target === id} liquid={id === 'beaker' && s.vinegarMl ? 0.08 + s.vinegarMl / 150 * 0.12 : 0}/></group>;
    })}
    <ReactionEffect/><ObjectiveMarker/><Player/><ShadowUpdates/>
  </>;
}
const cameraOptions = { fov: 60, near: 0.05, far: 50 };
export const Laboratory = memo(function Laboratory() {
  return <Canvas shadows camera={cameraOptions} dpr={[1, 1.5]} gl={{ antialias: true }}><Room/></Canvas>;
});
