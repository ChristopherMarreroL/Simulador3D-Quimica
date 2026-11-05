import { useMemo } from 'react';
import * as THREE from 'three';
import { items, type ItemId } from '../experiments/definitions';
import { periodicRows, symbols } from '../experiments/periodic';
export function PeriodicPoster() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 720;
    const c = canvas.getContext('2d')!; c.fillStyle = '#f1f6ee'; c.fillRect(0, 0, 1440, 720);
    periodicRows.forEach((row, y) => row.forEach((n, x) => {
      if (!n) return;
      c.fillStyle = [1, 6, 8, 11].includes(n) ? '#cfac63' : '#74a3a5'; c.fillRect(x * 80 + 3, y * 80 + 3, 74, 74);
      c.fillStyle = '#143e49'; c.font = '16px Arial'; c.fillText(String(n), x * 80 + 8, y * 80 + 22);
      c.font = 'bold 31px Arial'; c.fillText(symbols[n - 1], x * 80 + 10, y * 80 + 58);
    }));
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return <mesh position={[1.6, 1.94, -4.855]} userData={{ interactive: 'periodic' }}><planeGeometry args={[2.1, 0.82]}/><meshBasicMaterial map={texture}/></mesh>;
}
export function Sign({ text, position, width = 1.5, height = 0.35, dark = false, rotation = [0, 0, 0] }: { text: string; position: [number, number, number]; width?: number; height?: number; dark?: boolean; rotation?: [number, number, number] }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const c = canvas.getContext('2d')!; c.fillStyle = dark ? '#143e49' : '#edf4f3'; c.fillRect(0, 0, 1024, 256);
    c.fillStyle = dark ? '#f4fbf7' : '#143e49'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '600 68px Arial'; c.fillText(text, 512, 134, 960);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [text, dark]);
  return <mesh position={position} rotation={rotation}><planeGeometry args={[width, height]}/><meshBasicMaterial map={texture} side={THREE.DoubleSide}/></mesh>;
}
export function Box({ position, size, color = '#e1e8e5', interactive }: { position: [number, number, number]; size: [number, number, number]; color?: string; interactive?: string }) {
  return <mesh position={position} castShadow receiveShadow userData={{ interactive }}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={0.65}/></mesh>;
}
export function Instrument({ id, highlighted = false, liquid = 0, castShadow = true }: { id: ItemId; highlighted?: boolean; liquid?: number; castShadow?: boolean }) {
  const isBeaker = id === 'beaker'; const color = items[id].color;
  return <group userData={{ interactive: id }}>
    <mesh position={[0, 0.19, 0]} castShadow={castShadow}><cylinderGeometry args={[isBeaker ? 0.145 : 0.12, isBeaker ? 0.13 : 0.12, 0.38, 32, 1, isBeaker]}/><meshPhysicalMaterial color={isBeaker ? '#d0e8ec' : id === 'vinegar' ? '#80511c' : '#e7f1ee'} transparent opacity={isBeaker ? 0.28 : 0.97} roughness={0.18} metalness={0.05} side={THREE.DoubleSide} emissive={highlighted ? '#39aab4' : '#000000'} emissiveIntensity={0.5}/></mesh>
    {isBeaker ? <>
      <mesh position={[0, 0.015, 0]}><cylinderGeometry args={[0.13, 0.13, 0.025, 32]}/><meshStandardMaterial color="#b5d4db" transparent opacity={0.45}/></mesh>
      <mesh position={[0, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.145, 0.009, 8, 32]}/><meshStandardMaterial color="#c5e1e3"/></mesh>
      {[0.1, 0.17, 0.24, 0.31].map(y => <Box key={y} position={[0.06, y, 0.128]} size={[0.05, 0.006, 0.005]} color="#f5ffff"/>)}
      {liquid > 0 && <mesh position={[0, liquid / 2 + 0.025, 0]}><cylinderGeometry args={[0.126, 0.12, liquid, 32]}/><meshStandardMaterial color="#eac76c" transparent opacity={0.65}/></mesh>}
    </> : <>
      <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.077, 0.077, 0.09, 24]}/><meshStandardMaterial color={color}/></mesh>
      <Sign text={id === 'vinegar' ? 'CH₃COOH' : 'NaHCO₃'} position={[0, 0.23, 0.122]} width={0.21} height={0.095}/>
      <Box position={[0, 0.14, 0.123]} size={[0.18, 0.025, 0.004]} color={color}/>
    </>}
  </group>;
}
