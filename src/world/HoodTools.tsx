import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { reagents } from '../chemistry/reagents';
import { CYLINDER_ML, PIPETTE_ML, POUR_MS, useHood } from '../state/hood';
import { PipetteModel } from './Storage';
import { glass, materials } from './materials';
import { ReagentBottle } from './ReagentBottle';
import { Sign } from './Models';
import { ContactShadow } from './RoomShell';

/** Hood-local positions (x, z) of the measuring tools; the flask sits at FLASK_XZ on the stirrer. */
export const TOOLS = { cylinder: [-0.32, 0.46], balance: [0.52, 0.6], waste: [0.66, -0.2], washbottle: [-0.58, 0.52], pipette: [0.2, 0.62] } as const;
export const FLASK_XZ = [0.05, 0.15] as const;
const TOP = 1.16;
const TUBE_H = 0.32, TUBE_R = 0.026, FILL_H = 0.29;
const ease = (t: number) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

function useCanvas(w: number, h: number) {
  return useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    return { canvas, texture, ctx: canvas.getContext('2d')! };
  }, [w, h]);
}

/** 100 mL graduated cylinder: fill it from a bottle (hold click), read the mark, then pour it into the flask (E). */
function MeasuringCylinder() {
  const cylinder = useHood(s => s.cylinder); const pouring = useHood(s => s.pouring); const transfer = useHood(s => s.transfer);
  const group = useRef<THREE.Group>(null); const liquid = useRef<THREE.Mesh>(null); const bottle = useRef<THREE.Group>(null); const stream = useRef<THREE.Mesh>(null);
  const marks = useCanvas(64, 512);
  useEffect(() => {
    const { ctx, texture } = marks; ctx.clearRect(0, 0, 64, 512); ctx.fillStyle = '#1d2a30'; ctx.font = 'bold 22px Arial';
    for (let ml = 0; ml <= 100; ml += 5) {
      const y = 500 - ml / 100 * (FILL_H / TUBE_H) * 488; const major = ml % 10 === 0;
      ctx.fillRect(0, y, major ? 30 : 16, major ? 3 : 2);
      if (ml % 20 === 0 && ml) ctx.fillText(String(ml), 33, y + 8);
    }
    texture.needsUpdate = true;
  }, [marks]);
  const contents = cylinder.reagent ? reagents[cylinder.reagent].look.contents : '#d8eef4';
  const filling = pouring?.target === 'cylinder' ? pouring.reagent : null;
  useFrame(({ clock }) => {
    const now = Date.now(); const g = group.current; if (!g) return;
    const base = new THREE.Vector3(TOOLS.cylinder[0], TOP, TOOLS.cylinder[1]);
    let ml = useHood.getState().cylinder.ml;
    if (transfer?.kind === 'cylinder') {
      // Lift, move over the flask mouth, tilt and empty, as a person would do.
      const t = Math.min(1, (now - transfer.startedAt) / POUR_MS); const move = ease(Math.min(1, t / 0.35));
      g.position.set(THREE.MathUtils.lerp(base.x, FLASK_XZ[0] - 0.13, move), TOP + move * 0.33, THREE.MathUtils.lerp(base.z, FLASK_XZ[1] + 0.02, move));
      g.rotation.z = -move * 1.9; ml *= 1 - Math.max(0, (t - 0.4) / 0.6);
    } else { g.position.copy(base); g.rotation.z = 0; }
    if (transfer?.kind === 'rinse') ml = 18 * Math.sin(Math.min(1, (now - transfer.startedAt) / 900) * Math.PI);
    if (liquid.current) { const h = Math.max(0.0005, ml / CYLINDER_ML * FILL_H); liquid.current.scale.y = h; liquid.current.position.y = 0.012 + h / 2; liquid.current.visible = ml > 0.2; }
    if (bottle.current) { bottle.current.visible = !!filling; bottle.current.rotation.z = -1.15 + Math.sin(clock.elapsedTime * 4) * 0.03; }
    if (stream.current) stream.current.visible = !!filling && now - (pouring?.startedAt ?? now) > 300;
  });
  return <>
    <group ref={group} userData={{ interactive: 'hood-cylinder' }}>
      <mesh position={[0, 0.006, 0]} material={glass.clear}><cylinderGeometry args={[0.05, 0.052, 0.012, 6]}/></mesh>
      <mesh position={[0, 0.012 + TUBE_H / 2, 0]} material={glass.lab}><cylinderGeometry args={[TUBE_R, TUBE_R, TUBE_H, 20, 1, true]}/></mesh>
      <mesh position={[TUBE_R * 0.7, TUBE_H + 0.012, 0]} rotation={[0, 0, -0.6]} material={glass.clear}><boxGeometry args={[0.012, 0.006, 0.014]}/></mesh>
      <mesh ref={liquid} visible={false} renderOrder={1}><cylinderGeometry args={[TUBE_R * 0.9, TUBE_R * 0.9, 1, 18]}/><meshPhysicalMaterial color={transfer?.kind === 'rinse' ? '#d8eef4' : contents} transparent opacity={0.78} roughness={0.08} depthWrite={false}/></mesh>
      <mesh position={[0, 0.012 + TUBE_H / 2, TUBE_R + 0.0008]}><planeGeometry args={[0.026, TUBE_H]}/><meshBasicMaterial map={marks.texture} transparent toneMapped={false}/></mesh>
      <ContactShadow position={[0, 0.002, 0]} size={[0.14, 0.14]}/>
    </group>
    <group position={[TOOLS.cylinder[0] - 0.12, TOP + 0.36, TOOLS.cylinder[1]]} ref={bottle} visible={false}>
      {filling && <group position={[0, -0.08, 0]} scale={0.95}><ReagentBottle id={filling} interactive={false} castShadow={false}/></group>}
    </group>
    <mesh ref={stream} position={[TOOLS.cylinder[0], TOP + 0.39, TOOLS.cylinder[1]]} visible={false}><cylinderGeometry args={[0.003, 0.005, 0.07, 8]}/><meshStandardMaterial color={filling ? reagents[filling].look.contents : '#d8eef4'} transparent opacity={0.8}/></mesh>
  </>;
}

/** Electronic balance with a weighing boat: add solid with the spatula (hold click), then tip it into the flask (E). */
function HoodBalance() {
  const balance = useHood(s => s.balance); const pouring = useHood(s => s.pouring); const transfer = useHood(s => s.transfer);
  const screen = useCanvas(256, 96);
  useEffect(() => {
    const { ctx, texture } = screen; ctx.fillStyle = '#b7c6b0'; ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#1d241c'; ctx.font = 'bold 56px monospace'; ctx.textAlign = 'right'; ctx.fillText(`${balance.grams.toFixed(2)} g`, 244, 68); texture.needsUpdate = true;
  }, [screen, balance.grams]);
  const boat = useRef<THREE.Group>(null); const spatula = useRef<THREE.Group>(null); const jar = useRef<THREE.Group>(null);
  const weighing = pouring?.target === 'balance' ? pouring.reagent : null;
  const color = balance.reagent ? reagents[balance.reagent].look.contents : '#f4f3ee';
  useFrame(({ clock }) => {
    const now = Date.now();
    if (boat.current) {
      if (transfer?.kind === 'balance') {
        const t = Math.min(1, (now - transfer.startedAt) / POUR_MS); const move = ease(Math.min(1, t / 0.35));
        boat.current.position.set(THREE.MathUtils.lerp(0, FLASK_XZ[0] - TOOLS.balance[0] + 0.08, move), 0.085 + move * 0.32, THREE.MathUtils.lerp(0, FLASK_XZ[1] - TOOLS.balance[1], move));
        boat.current.rotation.z = move * 1.3;
      } else { boat.current.position.set(0, 0.085, 0); boat.current.rotation.z = 0; }
    }
    if (spatula.current) { spatula.current.visible = !!weighing; const k = (Math.sin(clock.elapsedTime * 5) + 1) / 2; spatula.current.position.set(-0.1 + k * 0.1, 0.16 + Math.sin(k * Math.PI) * 0.05, 0); spatula.current.rotation.z = -0.4 + k * 0.5; }
    if (jar.current) jar.current.visible = !!weighing;
  });
  const pile = Math.cbrt(Math.max(0, balance.grams)) * 0.012;
  return <group position={[TOOLS.balance[0], TOP, TOOLS.balance[1]]} userData={{ interactive: 'hood-balance' }}>
    <mesh position={[0, 0.03, 0]} material={materials.plasticWhite} castShadow><boxGeometry args={[0.2, 0.06, 0.25]}/></mesh>
    <mesh position={[0, 0.045, 0.115]} rotation={[-0.5, 0, 0]} material={materials.plasticWhite}><boxGeometry args={[0.19, 0.045, 0.05]}/></mesh>
    <mesh position={[0, 0.052, 0.133]} rotation={[-0.5, 0, 0]}><planeGeometry args={[0.09, 0.034]}/><meshBasicMaterial map={screen.texture} toneMapped={false}/></mesh>
    <mesh position={[0, 0.066, -0.02]} material={materials.steel}><cylinderGeometry args={[0.07, 0.07, 0.006, 32]}/></mesh>
    <group ref={boat} position={[0, 0.085, -0.02]}>
      <mesh material={materials.plasticWhite}><boxGeometry args={[0.075, 0.008, 0.075]}/></mesh>
      {balance.grams > 0.01 && <mesh position={[0, 0.004 + pile / 2, 0]}><coneGeometry args={[pile * 1.6, pile, 14]}/><meshStandardMaterial color={color} roughness={0.95}/></mesh>}
    </group>
    <group ref={jar} position={[-0.17, 0.0, -0.02]} visible={false}>{weighing && <ReagentBottle id={weighing} interactive={false} castShadow={false}/>}</group>
    <group ref={spatula} visible={false}>
      <mesh rotation={[0, 0, Math.PI / 2]} material={materials.steel}><cylinderGeometry args={[0.003, 0.003, 0.16, 6]}/></mesh>
      <mesh position={[0.08, 0, 0]} material={materials.steel}><boxGeometry args={[0.02, 0.002, 0.012]}/></mesh>
    </group>
    <ContactShadow position={[0, 0.002, 0]} size={[0.32, 0.38]} opacity={0.5}/>
  </group>;
}

/** Labelled waste container with funnel: E empties the flask into it. */
function WasteJug() {
  return <group position={[TOOLS.waste[0], TOP, TOOLS.waste[1]]} userData={{ interactive: 'hood-waste' }}>
    <mesh position={[0, 0.11, 0]} castShadow><cylinderGeometry args={[0.075, 0.08, 0.22, 24]}/><meshStandardMaterial color="#e9e7df" roughness={0.55}/></mesh>
    <mesh position={[0, 0.25, 0]} material={materials.plasticBlack}><coneGeometry args={[0.07, 0.07, 20, 1, true]}/></mesh>
    <mesh position={[0, 0.215, 0]} material={materials.plasticBlack}><cylinderGeometry args={[0.012, 0.012, 0.04, 10]}/></mesh>
    <mesh position={[0, 0.12, 0.0805]}><planeGeometry args={[0.1, 0.07]}/><meshStandardMaterial color="#f2c230" roughness={0.7}/></mesh>
    <Sign text="RESIDUOS" position={[0, 0.13, 0.0815]} width={0.09} height={0.025} dark/>
    <ContactShadow position={[0, 0.002, 0]} size={[0.22, 0.22]}/>
  </group>;
}

/** Wash bottle (piseta) of distilled water: E rinses the graduated cylinder. */
function Piseta() {
  const transfer = useHood(s => s.transfer); const ref = useRef<THREE.Group>(null);
  const nozzle = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.17, 0), new THREE.Vector3(0, 0.22, 0), new THREE.Vector3(0.03, 0.24, 0), new THREE.Vector3(0.07, 0.22, 0)]), []);
  useFrame(() => { if (ref.current) ref.current.rotation.z = transfer?.kind === 'rinse' ? -0.7 * Math.sin(Math.min(1, (Date.now() - transfer.startedAt) / 900) * Math.PI) : 0; });
  return <group position={[TOOLS.washbottle[0], TOP, TOOLS.washbottle[1]]} userData={{ interactive: 'hood-washbottle' }}>
    <group ref={ref}>
      <mesh position={[0, 0.075, 0]} castShadow><cylinderGeometry args={[0.032, 0.036, 0.15, 18]}/><meshStandardMaterial color="#f3f2ec" roughness={0.6} transparent opacity={0.94}/></mesh>
      <mesh position={[0, 0.16, 0]} material={materials.plasticWhite}><cylinderGeometry args={[0.018, 0.022, 0.02, 14]}/></mesh>
      <mesh><tubeGeometry args={[nozzle, 12, 0.004, 6, false]}/><meshStandardMaterial color="#f3f2ec"/></mesh>
      <mesh position={[0, 0.08, 0.0362]}><planeGeometry args={[0.05, 0.04]}/><meshStandardMaterial color="#4bb3dd"/></mesh>
    </group>
    <ContactShadow position={[0, 0.002, 0]} size={[0.11, 0.11]}/>
  </group>;
}

/** Pipette stand: empty until the pipette is brought from its cabinet. Hold click with a bottle to draw liquid; E delivers it. */
function PipetteStand() {
  const pipette = useHood(s => s.pipette); const transfer = useHood(s => s.transfer); const tube = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = tube.current; if (!g) return;
    if (transfer?.kind === 'pipette') {
      // Lift it out of the stand, carry it over the flask mouth and let it drain.
      const t = Math.min(1, (Date.now() - transfer.startedAt) / POUR_MS); const move = ease(Math.min(1, t / 0.35));
      g.position.set(THREE.MathUtils.lerp(0, FLASK_XZ[0] - TOOLS.pipette[0], move), 0.03 + move * 0.3, THREE.MathUtils.lerp(0, FLASK_XZ[1] - TOOLS.pipette[1], move));
    } else g.position.set(0, 0.03, 0);
  });
  const draining = transfer?.kind === 'pipette' ? 1 - Math.max(0, (Date.now() - transfer.startedAt) / POUR_MS - 0.4) / 0.6 : 1;
  return <group position={[TOOLS.pipette[0], TOP, TOOLS.pipette[1]]} userData={{ interactive: 'hood-pipette' }}>
    <mesh position={[0, 0.01, 0]} material={materials.plasticBlack} castShadow><cylinderGeometry args={[0.045, 0.05, 0.02, 20]}/></mesh>
    <mesh position={[0.03, 0.16, 0]} material={materials.steel}><cylinderGeometry args={[0.004, 0.004, 0.3, 8]}/></mesh>
    <mesh position={[0.015, 0.27, 0]} material={materials.steel}><boxGeometry args={[0.036, 0.008, 0.02]}/></mesh>
    {/* Invisible volume so the thin stand is easy to aim at. */}
    <mesh visible={false} position={[0, 0.2, 0]}><boxGeometry args={[0.1, 0.4, 0.08]}/></mesh>
    {pipette.place === 'hood' && <group ref={tube} position={[0, 0.03, 0]}><PipetteModel fill={Math.max(0, draining) * pipette.ml / PIPETTE_ML} color={pipette.reagent ? reagents[pipette.reagent].look.contents : '#d8eef4'}/></group>}
    <ContactShadow position={[0, 0.002, 0]} size={[0.13, 0.13]}/>
  </group>;
}

export function HoodTools() { return <><MeasuringCylinder/><HoodBalance/><WasteJug/><Piseta/><PipetteStand/></>; }
