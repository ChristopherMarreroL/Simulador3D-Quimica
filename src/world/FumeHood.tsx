import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import { analyzeMixture, VESSEL_ML } from '../chemistry/sandbox';
import { reagentIds, reagents } from '../chemistry/reagents';
import { species } from '../chemistry/species';
import { HOOD_TRAY_SLOTS, POUR_MS, useHood, type SashPosition } from '../state/hood';
import { useLab } from '../state/lab';
import { Box, Sign } from './Models';
import { glass } from './materials';
import { HoodTools } from './HoodTools';
import { ReagentBottle } from './ReagentBottle';

/** Designed hood position (shared with the bench and collisions); not measured from the reference photos. */
export const HOOD = { x: 4.8, z: -3.6, top: 1.16 };
const FLASK: [number, number, number] = [0.05, 1.256, 0.15];
const sashBottom: Record<SashPosition, number> = { closed: 1.2, work: 1.62, open: 2.22 };
export const traySlot = (i: number): [number, number, number] => [-0.7 + (i % 4) * 0.13, HOOD.top, i < 4 ? -0.55 : -0.25];

// Erlenmeyer 500 mL drawn at the scene's enlarged instrument scale. Liquid fills a cone frustum up to the neck.
const Y0 = 0.012, Y1 = 0.24, R0 = 0.094, R1 = 0.033, Y_FULL = 0.205;
const radiusAt = (y: number) => R0 + (R1 - R0) * (Math.min(Y1, Math.max(Y0, y)) - Y0) / (Y1 - Y0);
const volumeTo = (y: number) => Math.PI * (Y1 - Y0) / (3 * (R1 - R0)) * (radiusAt(y) ** 3 - R0 ** 3);
const FULL_VOLUME = volumeTo(Y_FULL);
function levelFor(fraction: number) {
  const target = Math.max(0, Math.min(1, fraction)) * FULL_VOLUME;
  const r = Math.cbrt(R0 ** 3 + target * 3 * (R1 - R0) / (Math.PI * (Y1 - Y0)));
  return Y0 + (r - R0) * (Y1 - Y0) / (R1 - R0);
}
const flaskProfile = [[0.001, 0], [0.098, 0], [0.101, 0.008], [0.098, 0.02], [0.037, 0.245], [0.035, 0.32], [0.041, 0.326], [0.04, 0.336], [0.034, 0.336]].map(([x, y]) => new THREE.Vector2(x, y));

function useDisplayTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const draw = (temperature: number, pH: number | null) => {
      const c = canvas.getContext('2d')!;
      c.fillStyle = '#0b1a17'; c.fillRect(0, 0, 256, 128);
      c.fillStyle = '#5dfc9f'; c.font = 'bold 44px monospace'; c.textAlign = 'right';
      c.fillText(`${temperature.toFixed(1).replace('.', ',')}°C`, 244, 54);
      c.fillStyle = '#7fd8ff'; c.font = 'bold 36px monospace';
      c.fillText(pH === null ? 'pH --' : `pH ${pH.toFixed(2).replace('.', ',')}`, 244, 108);
      texture.needsUpdate = true;
    };
    draw(25, null);
    return { texture, draw };
  }, []);
}

function Flask() {
  const mixture = useHood(s => s.mixture); const stirring = useHood(s => s.stirring); const fan = useHood(s => s.fan);
  const pouring = useHood(s => s.pouring);
  const info = useMemo(() => analyzeMixture(mixture), [mixture]);
  const level = levelFor(info.volumeMl / VESSEL_ML);
  const liquidGeometry = useMemo(() => {
    if (level <= Y0 + 0.001) return null;
    const pts = [new THREE.Vector2(0, Y0), new THREE.Vector2(radiusAt(Y0) - 0.005, Y0), new THREE.Vector2(radiusAt(level) - 0.005, level), new THREE.Vector2(0, level)];
    return new THREE.LatheGeometry(pts, 36);
  }, [Math.round(level * 400)]);
  const liquid = useRef<THREE.MeshPhysicalMaterial>(null); const cloud = useRef<THREE.Mesh>(null); const layer = useRef<THREE.Mesh>(null);
  const bubbles = useRef<THREE.Group>(null); const foam = useRef<THREE.Mesh>(null); const fumes = useRef<THREE.Group>(null); const bar = useRef<THREE.Mesh>(null);
  const pourGroup = useRef<THREE.Group>(null); const stream = useRef<THREE.Mesh>(null); const column = useRef<THREE.Mesh>(null); const ring = useRef<THREE.Mesh>(null);
  // Golden ring: shows that holding the click will pour the bottle in the selected hand into the flask.
  const aimed = useLab(l => l.target === 'hood' && l.locked); const hand = useLab(l => l.hand); const places = useHood(h => h.places);
  const canPour = aimed && Object.values(places).includes(hand);
  const targetColor = useMemo(() => new THREE.Color(info.color.color), [info.color.color]);
  const display = useDisplayTexture();
  useEffect(() => { display.draw(info.temperatureC, info.pH); }, [display, info.temperatureC, info.pH]);
  const solidColor = info.solids[0]?.color ?? '#f2f2ee';
  const solidGrams = info.solids.reduce((s, x) => s + x.grams, 0);
  const metals = info.solids.filter(x => ['Zn', 'Mg', 'Fe', 'Cu', 'Ag', 'Pb'].includes(x.id)).slice(0, 3);
  useFrame(({ clock }, delta) => {
    const s = useHood.getState(); const burst = s.burst; const now = Date.now();
    const age = burst ? (now - burst.at) / 1000 : 999;
    const gasLife = burst ? 3 + Math.min(1, burst.gasMol / 0.03) * 12 * Math.max(0.3, burst.vigor) : 0;
    const activity = burst && burst.gasMol > 1e-6 ? Math.max(0, 1 - age / gasLife) : 0;
    const strength = burst ? Math.min(1, burst.gasMol / 0.01) * Math.max(0.25, burst.vigor) : 0;
    if (liquid.current) { liquid.current.color.lerp(targetColor, Math.min(1, delta * 1.6)); liquid.current.opacity += (info.color.opacity - liquid.current.opacity) * Math.min(1, delta * 1.6); }
    if (bubbles.current) {
      bubbles.current.visible = activity > 0 && level > Y0 + 0.01;
      bubbles.current.children.forEach((b, i) => {
        const phase = (clock.elapsedTime * (0.6 + activity * 1.4) + i * 0.618) % 1; const y = Y0 + 0.01 + phase * (level - Y0 - 0.01);
        const r = radiusAt(y) * 0.8 * Math.abs(Math.sin(i * 7.31));
        b.position.set(Math.cos(i * 2.4) * r, y, Math.sin(i * 2.4) * r); b.scale.setScalar((0.6 + (i % 3) * 0.3) * Math.min(1, activity * 1.5 * (0.4 + strength)));
      });
    }
    if (foam.current) {
      const big = burst && burst.vigor >= 0.9 && burst.gasMol > 0.01 ? Math.min(1, burst.gasMol / 0.04) : 0;
      const f = activity * (0.35 + strength * 0.65);
      foam.current.visible = f > 0.03 && level > Y0 + 0.01;
      foam.current.position.y = level;
      foam.current.scale.set(radiusAt(level) * 0.92, 0.012 + f * 0.05 + big * activity * 0.06, radiusAt(level) * 0.92);
      if (column.current) {
        // Vigorous O₂/CO₂ release pushes a foam column up the neck and out of the flask.
        const top = 0.336 + big * activity * 0.2;
        column.current.visible = big * activity > 0.05 && level > Y0 + 0.01;
        column.current.scale.y = Math.max(0.001, top - level); column.current.position.y = level + column.current.scale.y / 2;
      }
    }
    if (cloud.current) {
      const fresh = burst?.solidColor ? Math.max(0, 1 - age / 7) : 0;
      cloud.current.visible = fresh > 0.02 && level > Y0 + 0.01;
      (cloud.current.material as THREE.MeshStandardMaterial).opacity = 0.75 * fresh;
      cloud.current.scale.set(1, Math.max(0.05, (level - Y0) * (0.35 + 0.65 * fresh)), 1);
      cloud.current.position.y = Y0 + cloud.current.scale.y / 2;
    }
    if (layer.current) { layer.current.visible = solidGrams > 0.001; layer.current.scale.y = Math.min(0.05, 0.004 + Math.cbrt(solidGrams) * 0.008); layer.current.position.y = Y0 + layer.current.scale.y / 2; }
    if (bar.current) bar.current.rotation.y += s.stirring ? delta * 14 : 0;
    if (flaskGroup.current) {
      // Emptying into the waste container: lift the flask, carry it over the funnel and tip it.
      const tr = s.transfer?.kind === 'waste' ? Math.min(1, (now - s.transfer.startedAt) / POUR_MS) : 0; const m = tr ? Math.min(1, tr / 0.35) : 0; const e = m * m * (3 - 2 * m);
      flaskGroup.current.position.set(FLASK[0] + e * 0.45, FLASK[1] + e * 0.3, FLASK[2] - e * 0.3); flaskGroup.current.rotation.z = -e * 1.6;
    }
    if (ring.current) { const m = ring.current.material as THREE.MeshBasicMaterial; m.opacity = canPour && !s.pouring ? 0.55 + Math.sin(clock.elapsedTime * 4) * 0.25 : 0; ring.current.visible = m.opacity > 0; }
    if (fumes.current) {
      const hot = Math.max(0, Math.min(1, (info.temperatureC - 40) / 30));
      const intensity = Math.max(activity * strength * 0.8, hot, info.ammoniaSmell ? 0.5 : 0);
      fumes.current.visible = intensity > 0.03;
      fumes.current.children.forEach((m, i) => {
        const t = (clock.elapsedTime * 0.25 + i / fumes.current!.children.length) % 1;
        if (s.fan) m.position.set(Math.sin(i * 3.1 + t * 4) * 0.05 * (1 - t), 0.34 + t * 0.95, -0.15 * t);
        else m.position.set(Math.sin(i * 3.1) * 0.25 * t, 0.34 + t * 0.55, t * 0.9);
        m.scale.setScalar(0.03 + t * 0.09); (m as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.opacity = intensity * 0.32 * (1 - t);
      });
    }
    if (pourGroup.current) {
      const p = s.pouring && (!s.pouring.target || s.pouring.target === 'flask') ? s.pouring : null; pourGroup.current.visible = !!p;
      if (p) { const t = Math.min(1, (now - p.startedAt) / 350); pourGroup.current.rotation.z = -0.25 - t * 0.95 + Math.sin(clock.elapsedTime * 5) * 0.03; }
      if (stream.current) stream.current.visible = !!p && now - p.startedAt > 300 && (p.stream || now - p.startedAt < POUR_MS - 100);
    }
  });
  const pourReagent = pouring ? reagents[pouring.reagent] : null;
  const flaskGroup = useRef<THREE.Group>(null);
  return <group ref={flaskGroup} position={FLASK} userData={{ interactive: 'hood' }}>
    <mesh castShadow material={glass.lab}><latheGeometry args={[flaskProfile, 40]}/></mesh>
    {[0.08, 0.12, 0.16].map(y => <mesh key={y} position={[0, y, 0]} rotation={[0, 0.4, 0]}><torusGeometry args={[radiusAt(y) + 0.003, 0.0012, 4, 24, 0.7]}/><meshBasicMaterial color="#ffffff"/></mesh>)}
    {liquidGeometry && <mesh geometry={liquidGeometry} renderOrder={1}><meshPhysicalMaterial ref={liquid} color={info.color.color} transparent opacity={info.color.opacity} roughness={0.08} clearcoat={0.6} depthWrite={false}/></mesh>}
    <mesh ref={cloud} visible={false} renderOrder={2}><cylinderGeometry args={[0.07, 0.085, 1, 24]}/><meshStandardMaterial color={solidColor} transparent opacity={0} roughness={0.9} depthWrite={false}/></mesh>
    <mesh ref={layer} visible={false}><cylinderGeometry args={[0.088, 0.09, 1, 28]}/><meshStandardMaterial color={solidColor} roughness={0.95}/></mesh>
    {metals.map((m, i) => Array.from({ length: 3 }, (_, j) => <mesh key={`${m.id}-${j}`} position={[Math.cos(i * 2.1 + j * 0.9) * 0.045, Y0 + 0.008, Math.sin(i * 2.1 + j * 0.9) * 0.045]} rotation={[j, i, 0]}><dodecahedronGeometry args={[0.009 + Math.min(0.006, m.grams * 0.003), 0]}/><meshStandardMaterial color={m.color} metalness={0.75} roughness={0.35}/></mesh>))}
    <mesh ref={ring} position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} userData={{ ignoreRay: true }}><ringGeometry args={[0.112, 0.128, 40]}/><meshBasicMaterial color="#f2c14e" transparent opacity={0} toneMapped={false} depthWrite={false}/></mesh>
    <mesh ref={bar} position={[0, Y0 + 0.006, 0]} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.006, 0.04, 4, 8]}/><meshStandardMaterial color="#f7f7f2"/></mesh>
    <group ref={bubbles}>{Array.from({ length: 36 }, (_, i) => <mesh key={i}><sphereGeometry args={[0.0075, 8, 6]}/><meshStandardMaterial color="#ffffff" transparent opacity={0.65} roughness={0.1}/></mesh>)}</group>
    <mesh ref={foam} visible={false}><sphereGeometry args={[1, 18, 10]}/><meshStandardMaterial color="#fbf8ec" roughness={0.9} transparent opacity={0.92}/></mesh>
    <mesh ref={column} visible={false}><cylinderGeometry args={[0.03, 0.034, 1, 16]}/><meshStandardMaterial color="#fbf8ec" roughness={0.9}/></mesh>
    <group ref={fumes} visible={false}>{Array.from({ length: 10 }, (_, i) => <mesh key={i}><sphereGeometry args={[1, 10, 8]}/><meshStandardMaterial color={fan ? '#eef3f2' : '#f2efe6'} transparent opacity={0} depthWrite={false}/></mesh>)}</group>
    <group ref={pourGroup} position={[-0.15, 0.33, 0.02]} visible={false}>
      {pouring && <group position={[0, -0.06, 0]} scale={1.1}><ReagentBottle id={pouring.reagent} interactive={false} castShadow={false}/></group>}
    </group>
    <mesh ref={stream} position={[-0.015, 0.31, 0.01]} visible={false}><cylinderGeometry args={[0.004, 0.007, 0.12, 8]}/><meshStandardMaterial color={pourReagent?.look.contents ?? '#dbeef4'} transparent opacity={pourReagent?.kind === 'solid' ? 1 : 0.75}/></mesh>
    {/* Digital thermometer / pH probe and its display. */}
    <group position={[0.26, -0.096, -0.12]}>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.008, 0.008, 0.6, 10]}/><meshStandardMaterial color="#a9b6b8" metalness={0.8} roughness={0.25}/></mesh>
      <Box position={[-0.09, 0.5, 0.06]} size={[0.2, 0.018, 0.018]} color="#5d6b6e"/>
      <mesh position={[-0.2, 0.33, 0.08]} rotation={[0.12, 0, 0.32]}><cylinderGeometry args={[0.0045, 0.0045, 0.38, 8]}/><meshStandardMaterial color="#2c3a3e" metalness={0.4}/></mesh>
      <Box position={[0.02, 0.03, 0.26]} size={[0.16, 0.06, 0.1]} color="#26343a"/>
      <mesh position={[0.02, 0.065, 0.31]} rotation={[-0.55, 0, 0]}><planeGeometry args={[0.13, 0.065]}/><meshBasicMaterial map={display.texture} toneMapped={false}/></mesh>
    </group>
    {/* Stirrer hot plate. */}
    <group position={[0, -0.096, 0]}>
      <Box position={[0, 0.045, 0]} size={[0.34, 0.09, 0.36]} color="#e8ebe8"/>
      <mesh position={[0, 0.093, 0]}><cylinderGeometry args={[0.135, 0.135, 0.008, 32]}/><meshStandardMaterial color="#f6f6f1" roughness={0.3}/></mesh>
      <Box position={[0, 0.045, 0.181]} size={[0.3, 0.07, 0.004]} color="#2a3a40"/>
      {[-0.08, 0.08].map(x => <mesh key={x} position={[x, 0.045, 0.19]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.018, 0.018, 0.018, 16]}/><meshStandardMaterial color="#d8dcda"/></mesh>)}
      <mesh position={[0, 0.06, 0.185]}><sphereGeometry args={[0.007, 10, 8]}/><meshBasicMaterial color={stirring ? '#43ff8a' : '#3a4a45'} toneMapped={false}/></mesh>
    </group>
  </group>;
}

function Sash() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const target = sashBottom[useHood.getState().sash];
    ref.current.position.y += (target - ref.current.position.y) * Math.min(1, delta * 4);
  });
  const metal = { color: '#a7b3b5', metalness: 0.75, roughness: 0.28 };
  return <group ref={ref} position={[0, sashBottom.work, 0.985]}>
    <mesh position={[0, 0.43, 0]} userData={{ interactive: 'hood' }}><planeGeometry args={[1.6, 0.84]}/><meshPhysicalMaterial color="#d3ecef" transparent opacity={0.16} roughness={0.03} clearcoat={1} side={THREE.DoubleSide} depthWrite={false}/></mesh>
    {[0, 0.86].map(y => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[1.64, 0.035, 0.035]}/><meshStandardMaterial {...metal}/></mesh>)}
    {[-0.81, 0.81].map(x => <mesh key={x} position={[x, 0.43, 0]}><boxGeometry args={[0.03, 0.88, 0.035]}/><meshStandardMaterial {...metal}/></mesh>)}
    <group userData={{ interactive: 'hood-sash' }}>
      <mesh position={[0, -0.005, 0.045]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.01, 0.01, 1.25, 14]}/><meshStandardMaterial color="#c3ccce" metalness={0.8} roughness={0.25}/></mesh>
      {[-0.58, 0.58].map(x => <Box key={x} position={[x, -0.005, 0.025]} size={[0.03, 0.03, 0.05]} color="#8d999b"/>)}
      <mesh position={[0, 0, 0.04]} visible={false}><boxGeometry args={[1.4, 0.06, 0.08]}/><meshBasicMaterial/></mesh>
    </group>
  </group>;
}

export function FumeHood() {
  const h = useHood(useShallow(s => ({ light: s.light, fan: s.fan, places: s.places })));
  const target = useLab(s => s.target);
  const tray = reagentIds.filter(id => h.places[id] === 'hood').slice(0, HOOD_TRAY_SLOTS);
  const enamel = '#eceeea';
  return <group position={[HOOD.x, 0, HOOD.z]}>
    {[-1, 1].map(side => <group key={side}>
      <Box position={[side * 0.86, 1.81, -0.02]} size={[0.08, 1.3, 1.96]} color={enamel} interactive="hood"/>
      <Box position={[side * 0.86, 1.81, 0.955]} size={[0.086, 1.3, 0.045]} color="#1d8f96"/>
      <Box position={[side * 0.815, 1.81, 0.985]} size={[0.012, 1.3, 0.05]} color="#9aa6a8"/>
    </group>)}
    <Box position={[0, 1.81, -0.96]} size={[1.64, 1.3, 0.04]} color="#d3dcda" interactive="hood"/>
    {[1.32, 1.92, 2.36].map(y => <Box key={y} position={[0, y, -0.935]} size={[1.4, 0.028, 0.012]} color="#2a3539"/>)}
    <Box position={[0, 2.685, 0]} size={[1.8, 0.47, 2]} color="#e3e7e5"/>
    <Box position={[0, 2.46, 1.005]} size={[1.8, 0.03, 0.02]} color="#1d8f96"/>
    <mesh position={[0, 2.446, -0.3]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[1.45, 0.32]}/><meshBasicMaterial color={h.light ? '#fff6de' : '#8f9797'} toneMapped={!h.light}/></mesh>
    {h.light && <pointLight position={[0, 2.25, -0.15]} intensity={3.2} distance={3.2} decay={2} color="#fff0d2"/>}
    <mesh position={[0, 3.17, -0.45]}><cylinderGeometry args={[0.17, 0.17, 0.5, 24]}/><meshStandardMaterial color="#b9c5c7" metalness={0.8} roughness={0.3}/></mesh>
    <Sign text="CAMPANA EXTRACTORA" position={[-0.25, 2.7, 1.006]} width={1.05} height={0.17} dark/>
    <group position={[0.6, 2.7, 1.006]}>
      <Box position={[0, 0, -0.005]} size={[0.36, 0.2, 0.012]} color="#1b282c"/>
      <mesh position={[-0.13, 0, 0.003]}><circleGeometry args={[0.028, 20]}/><meshBasicMaterial color={h.fan ? '#38f07f' : '#ff4a3d'} toneMapped={false}/></mesh>
      <Sign text={h.fan ? 'EXTRACCIÓN OK' : 'EXTRACTOR APAGADO'} position={[0.04, 0, 0.004]} width={0.25} height={0.07} dark/>
    </group>
    <Box position={[0, HOOD.top + 0.02, 0.95]} size={[1.66, 0.04, 0.08]} color="#a7b3b5"/>
    <Sash/>
    <Flask/>
    {tray.map((id, i) => <group key={id} position={traySlot(i)}><ReagentBottle id={id} highlighted={target === `reagent:${id}`}/></group>)}
    <HoodTools/>
    <Box position={[0, 0.003, 1.15]} size={[1.8, 0.004, 0.07]} color="#f2c230"/>
    {Array.from({ length: 9 }, (_, i) => <group key={i} position={[-0.8 + i * 0.2, 0.0055, 1.15]} rotation={[0, 0.6, 0]}><Box position={[0, 0, 0]} size={[0.035, 0.002, 0.09]} color="#1f2529"/></group>)}
  </group>;
}
export const solidLabel = (id: keyof typeof species) => species[id].label;
