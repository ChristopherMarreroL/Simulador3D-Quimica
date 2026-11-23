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
import { Sink, SINK_HOLE } from './Sink';
import { materials } from './materials';
import { RoomShell, FloorAO, ContactShadow } from './RoomShell';
import { DigitalBalance, DryingTray, EntranceDoor, Extinguisher, GraduatedCylinder, JarCluster, LabOven, Outlet, PaperTowel, RingStand, TestTubeRack, TripleBeamBalance, WashBottle, Dispenser } from './LabProps';
import { PracticeEquipment } from './PracticeEquipment';
import { Ceiling, GraniteMaterial, LabStools, SafetyFixtures, WorkIslands } from './ReferenceFurnishings';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FumeHood, HOOD } from './FumeHood';
import { ReagentShelf, SHELF } from './ReagentShelf';
import { hoodGuidedIndex, useHood } from '../state/hood';
import { useSettings } from '../state/settings';
import { PostEffects } from './PostEffects';
import { StaticBatch } from './StaticBatch';
import { PpeStation, RecipeArrows, RecipeBoard } from './GuideProps';
import { DisplayCabinet, InstrumentCabinets } from './Storage';
/** Image-based reflections from three's procedural room: no external HDR file is downloaded. */
function LabEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env; scene.environmentIntensity = 0.55;
    return () => { scene.environment = null; env.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  return null;
}
function SafetyPoster() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 720;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#f7f8f2'; c.fillRect(0, 0, 1024, 720);
    c.fillStyle = '#143e49'; c.fillRect(0, 0, 1024, 120);
    c.fillStyle = '#ffffff'; c.font = 'bold 54px Arial'; c.fillText('SEGURIDAD EN EL LABORATORIO', 46, 80);
    const rules = [['#1d8f96', 'Gafas', 'Siempre puestas'], ['#2f6fe0', 'Guantes', 'Nitrilo al manipular'], ['#e0483a', 'Bata', 'Cerrada y larga'], ['#f0b429', 'Extractor', 'Encendido en la campana'], ['#2fa36b', 'Residuos', 'Nunca al fregadero'], ['#9a62d8', 'Etiquetas', 'Lee antes de usar']];
    rules.forEach(([color, title, text], i) => {
      const x = 70 + (i % 3) * 320, y = 200 + Math.floor(i / 3) * 250;
      c.fillStyle = color; c.beginPath(); c.arc(x + 60, y + 60, 60, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff'; c.font = 'bold 64px Arial'; c.textAlign = 'center'; c.fillText(String(i + 1), x + 60, y + 82); c.textAlign = 'left';
      c.fillStyle = '#143e49'; c.font = 'bold 36px Arial'; c.fillText(title, x + 135, y + 50);
      c.fillStyle = '#4b6468'; c.font = '25px Arial'; c.fillText(text, x + 135, y + 90, 170);
    });
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return <mesh position={[-5.935, 2.0, -2.2]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[1.25, 0.88]}/><meshStandardMaterial map={texture} roughness={0.8}/></mesh>;
}
function sinkCountertop(width: number, depth: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -depth / 2); shape.lineTo(width / 2, -depth / 2); shape.lineTo(width / 2, depth / 2); shape.lineTo(-width / 2, depth / 2); shape.closePath();
  const h = SINK_HOLE / 2, hole = new THREE.Path(); hole.moveTo(-h, -h); hole.lineTo(-h, h); hole.lineTo(h, h); hole.lineTo(h, -h); hole.closePath(); shape.holes.push(hole);
  return shape;
}
/** Box whose UVs are in metres, so granite and laminate keep a constant real-world scale. */
function worldBox(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) { const [su, sv] = f < 2 ? [d, h] : f < 4 ? [w, d] : [w, h]; for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }
  return g;
}
const pull = new THREE.BoxGeometry(0.14, 0.012, 0.016);
/** Base cabinet with a 4 cm granite top, toe kick, laminate doors with steel pulls and optional backsplash. */
function Bench({ x, z, width, depth, interactive, sink = false, backsplash = false }: { x: number; z: number; width: number; depth: number; interactive?: string; sink?: boolean; backsplash?: boolean }) {
  const countertop = useMemo(() => sinkCountertop(width, depth), [width, depth]);
  const top = useMemo(() => worldBox(width, 0.04, depth), [width, depth]);
  const splash = useMemo(() => worldBox(width, 0.1, 0.02), [width]);
  const doors = Math.max(1, Math.round(width / 0.55)), doorW = (width - 0.04) / doors;
  return <group>
    {sink ? <group position={[x, 1.12, z]} rotation={[-Math.PI / 2, 0, 0]}><mesh castShadow receiveShadow material={materials.granite}><extrudeGeometry args={[countertop, { depth: 0.04, bevelEnabled: false }]}/></mesh></group>
      : <mesh position={[x, 1.14, z]} geometry={top} material={materials.granite} castShadow receiveShadow userData={{ interactive }}/>}
    {sink && <Sink position={[x, 1.16, z]}/>}
    {backsplash && <mesh position={[x, 1.21, z - depth / 2 + 0.01]} geometry={splash} material={materials.granite} receiveShadow/>}
    <StaticBatch>
    <mesh position={[x, 0.61, z - 0.01]} material={materials.laminate} castShadow receiveShadow><boxGeometry args={[width - 0.04, 1.02, depth - 0.06]}/></mesh>
    <mesh position={[x, 0.05, z + depth / 2 - 0.1]} material={materials.plasticBlack}><boxGeometry args={[width - 0.06, 0.1, 0.02]}/></mesh>
    {Array.from({ length: doors }, (_, i) => { const dx = x - width / 2 + 0.02 + doorW * (i + 0.5); return <group key={i}>
      <mesh position={[dx, 0.6, z + depth / 2 - 0.03]} material={materials.laminate} castShadow receiveShadow><boxGeometry args={[doorW - 0.008, 0.92, 0.018]}/></mesh>
      <mesh position={[dx, 1.0, z + depth / 2 - 0.012]} geometry={pull} material={materials.steel}/>
    </group>; })}
    </StaticBatch>
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
  const s = useLab(); const hood = useHood(useShallow(h => ({ places: h.places, mixture: h.mixture, log: h.log }))); const recipeActive = useHood(h => !!h.recipe); const ref = useRef<THREE.Group>(null); let id: string | null = null;
  if (s.mode === 'tutorial') id = s.tutorial >= 4 ? 'bench' : s.tutorial >= 2 ? 'beaker' : null;
  if (s.mode === 'guided' && s.activePractice === 'hood') id = hoodGuidedIndex(hood) === 0 ? 'reagent-shelf' : 'hood';
  else if (s.mode === 'guided' && s.activePractice !== 'reaction') id = s.activePractice === 'conductivity' ? 'support-1' : 'support-2';
  else if (s.mode === 'guided') id = ['beaker', 'bench', 'vinegar', 'bench', 'bicarbonate', 'bench', 'bench'][guidedIndex(s)];
  if (recipeActive && s.activePractice === 'hood') id = null; // the experiment's own arrows take over
  const loc = id && id in items ? s.locations[id as ItemId] : null;
  const fixed: Record<string, [number, number, number]> = { bench: [0.2, 2, -0.5], 'support-1': [-2.8, 2.4, 0.8], 'support-2': [2.7, 2.4, 2.7], 'reagent-shelf': [SHELF.x, 2.45, SHELF.z + 0.55], hood: [HOOD.x, 2.25, HOOD.z + 1.25] };
  const p: [number, number, number] = id && fixed[id] ? [...fixed[id]] : id && isSurface(loc) ? [...itemPosition(id as ItemId, loc)] : [0, 0, 0];
  if (id && !fixed[id]) p[1] += 1;
  const text = id === 'reagent-shelf' ? 'Estantería de reactivos' : id === 'hood' ? 'Campana extractora' : id && isSurface(id) ? surfaceNames[id] : id ? items[id as ItemId].name : '';
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = p[1] + Math.sin(clock.elapsedTime * 2) * 0.06; });
  return id && <group ref={ref} position={p} userData={{ ignoreRay: true }}>
    <mesh rotation={[0, 0, Math.PI]}><coneGeometry args={[0.08, 0.18, 4]}/><meshBasicMaterial color="#e9bd65" toneMapped={false}/></mesh>
    <Sign text={text} position={[0, 0.24, 0]} width={1.2} height={0.2} dark/>
  </group>;
}
function ShadowUpdates() {
  const { gl } = useThree(); const locations = useLab(s => s.locations); const mode = useLab(s => !!s.mode); const places = useHood(s => s.places); const quality = useSettings(q => q.quality);
  useEffect(() => { gl.shadowMap.autoUpdate = false; gl.shadowMap.needsUpdate = true; return () => { gl.shadowMap.autoUpdate = true; }; }, [gl, locations, mode, places, quality]);
  return null;
}
function Room() {
  const s = useLab(useShallow(s => ({ mode: s.mode, locations: s.locations, target: s.target, vinegarMl: s.vinegarMl })));
  const quality = useSettings(q => q.quality); const high = quality !== 'media', ultra = quality === 'ultra';
  return <>
    <color attach="background" args={['#dfe9ec']}/><fog attach="fog" args={['#dfe9ec', 18, 34]}/>
    <LabEnvironment/>
    <ambientLight intensity={0.22}/><hemisphereLight args={['#ffffff', '#cfc8b8', 0.62]}/>
    {/* Overhead key light standing in for the ceiling panels: soft, mostly vertical shadows. */}
    <directionalLight key={`key-${quality}`} position={[1.2, 3.3, 1.6]} intensity={1.7} color="#fffaf0" castShadow shadow-mapSize={ultra ? [4096, 4096] : [2048, 2048]} shadow-camera-left={-7.5} shadow-camera-right={7.5} shadow-camera-top={7.5} shadow-camera-bottom={-7.5} shadow-normalBias={0.03} shadow-radius={4}/>
    {/* Daylight entering through the window openings of the right wall. */}
    <directionalLight key={`sun-${quality}`} position={[12, 5.5, 2.4]} intensity={high ? 3.2 : 1.6} color="#fff1d8" castShadow={high} shadow-mapSize={ultra ? [2048, 2048] : [1024, 1024]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-normalBias={0.04} shadow-radius={3}/>
    <StaticBatch key={`shell-${!!s.mode}`}><Ceiling closed={!!s.mode}/>
    <RoomShell closed={!!s.mode}/></StaticBatch>
    <SafetyPoster/>
    <Sign text="EXPERIMENTA / LABORATORIO DE QUÍMICA" position={[-1.8, 2.9, -4.93]} width={3.6} height={0.28} dark/>
    <WorkIslands/><PracticeEquipment/><StaticBatch><LabStools/><SafetyFixtures/></StaticBatch>
    <InstrumentCabinets/><DisplayCabinet/>
    <Bench x={-3.15} z={-4.1} width={4.3} depth={1} interactive="shelf" backsplash/>
    <StaticBatch>
    <LabOven position={[-4.92, 1.16, -4.28]}/>
    <GraduatedCylinder position={[-1.3, 1.16, -4.42]}/><GraduatedCylinder position={[-1.42, 1.16, -4.38]} h={0.24}/>
    <WashBottle position={[-1.62, 1.16, -4.4]} rotation={0.4}/>
    {[-2.6, -1.25].map(x => <Outlet key={x} position={[x, 1.36, -4.94]}/>)}</StaticBatch>
    <Bench x={HOOD.x} z={HOOD.z} width={1.8} depth={2} interactive="hood"/>
    <FumeHood/><ReagentShelf/><RecipeBoard/><RecipeArrows/>
    <StaticBatch><group position={[-5.1, 0, 0.5]} rotation={[0, Math.PI / 2, 0]}><Bench x={0} z={0} width={2.5} depth={1} sink backsplash/></group>
    <DigitalBalance position={[-5.12, 1.16, 1.38]} rotation={Math.PI / 2}/>
    <TripleBeamBalance position={[-5.2, 1.16, -0.38]} rotation={Math.PI / 2}/>
    <Outlet position={[-5.935, 1.36, 1.25]} rotation={Math.PI / 2}/>
    <group position={[5.25, 0, 0.8]} rotation={[0, -Math.PI / 2, 0]}><Bench x={0} z={0} width={4.8} depth={0.95} sink backsplash/></group>
    <DryingTray position={[5.3, 1.16, 1.62]} rotation={Math.PI / 2}/>
    <TestTubeRack position={[5.38, 1.16, 2.2]} rotation={Math.PI / 2} tubes={6}/>
    <JarCluster position={[5.55, 1.16, -0.1]} rotation={Math.PI / 2} seed={3}/>
    <WashBottle position={[5.45, 1.16, 0.32]} rotation={2.2}/>
    <PaperTowel position={[5.42, 1.16, 2.95]}/>
    <RingStand position={[5.42, 1.16, -1.18]} rotation={Math.PI / 2}/>
    <GraduatedCylinder position={[5.6, 1.16, 2.58]}/><GraduatedCylinder position={[5.6, 1.16, 2.68]} h={0.25}/>
    {[-1.3, 3.5].map(z => <Outlet key={z} position={[5.935, 1.36, z]} rotation={-Math.PI / 2}/>)}
    <Dispenser position={[5.94, 1.62, 1.125]} rotation={-Math.PI / 2}/>
    {/* Floor contact darkening along the cabinet bases. */}
    <FloorAO x={-3.15} z={-3.6} length={4.3} fade="+z" opacity={0.6}/>
    <FloorAO x={HOOD.x} z={HOOD.z + 1} length={1.8} fade="+z" opacity={0.6}/>
    <FloorAO x={-4.6} z={0.5} length={2.5} fade="+x" opacity={0.6}/>
    <FloorAO x={4.775} z={0.8} length={4.8} fade="-x" opacity={0.6}/>
    <FloorAO x={SHELF.x} z={SHELF.z + 0.22} length={1.12} fade="+z" opacity={0.55} depth={0.3}/>
    <Extinguisher position={[-5.86, 0.35, 4.25]} rotation={Math.PI / 2}/></StaticBatch>
    {s.mode && <PpeStation/>}
    {s.mode && <><EntranceDoor position={[-2.4, 0, 4.94]} rotation={Math.PI}/><Sign text="SALIDA" position={[-2.4, 2.48, 4.93]} width={0.5} height={0.16} dark rotation={[0, Math.PI, 0]}/></>}
    <Box position={[1.6, 2, -4.9]} size={[2.3, 1.15, 0.04]} color="#f1f6ee" interactive="periodic"/>
    <Sign text="TABLA PERIÓDICA · E" position={[1.6, 2.4, -4.86]} width={2.1} height={0.25}/>
    <PeriodicPoster/>
    {(Object.keys(items) as ItemId[]).map(id => {
      const loc = s.locations[id]; if (!isSurface(loc)) return null;
      return <group key={id} position={itemPosition(id, loc)}><Instrument id={id} highlighted={s.target === id} liquid={id === 'beaker' && s.vinegarMl ? 0.08 + s.vinegarMl / 150 * 0.12 : 0}/></group>;
    })}
    <ReactionEffect/><ObjectiveMarker/><Player/><ShadowUpdates/>
    {ultra && <PostEffects/>}
  </>;
}
const cameraOptions = { fov: 60, near: 0.05, far: 50 };
const glOptions = { antialias: true };
const onCreated = (state: { gl: THREE.WebGLRenderer; camera: THREE.Camera }) => {
  state.gl.toneMapping = THREE.ACESFilmicToneMapping; state.gl.toneMappingExposure = 1.0;
  // Development only: lets browser checks place the camera and read the state.
  if (import.meta.env.DEV) Object.assign(window, { sceneTest: { getState: () => state }, labTest: useLab });
};
const dprUltra: [number, number] = [1, 1.5], dprHigh: [number, number] = [1, 1.5], dprMedium: [number, number] = [0.85, 1];
export const Laboratory = memo(function Laboratory() {
  const quality = useSettings(q => q.quality);
  return <Canvas shadows camera={cameraOptions} dpr={quality === 'ultra' ? dprUltra : quality === 'alta' ? dprHigh : dprMedium} gl={glOptions} onCreated={onCreated}><Room/></Canvas>;
});
