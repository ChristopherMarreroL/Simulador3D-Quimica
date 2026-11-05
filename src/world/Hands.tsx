export function GlovedHand({ left, holding }: { left: boolean; holding: boolean }) {
  const sign = left ? 1 : -1;
  return <group>
    <mesh position={[0, -0.11, 0.2]} rotation={[-1.13, 0, 0]}><cylinderGeometry args={[0.043, 0.075, 0.42, 24]}/><meshStandardMaterial color="#f0f2ed" roughness={0.8}/></mesh>
    <mesh position={[0, -0.016, 0.025]} rotation={[-1.13, 0, 0]}><cylinderGeometry args={[0.037, 0.043, 0.055, 20]}/><meshStandardMaterial color="#d7e3df"/></mesh>
    <mesh position={[0, 0.018, -0.005]} scale={[0.043, 0.056, 0.025]}><sphereGeometry args={[1, 20, 16]}/><meshStandardMaterial color="#a8cdd0" roughness={0.65}/></mesh>
    {[-0.027, -0.009, 0.009, 0.027].map((x, i) => <mesh key={x} position={[x, 0.064 - Math.abs(i - 1.5) * 0.004, holding ? -0.035 : -0.023]} rotation={[holding ? 1.15 : 0.6, 0, 0]}><capsuleGeometry args={[0.009, 0.037, 4, 10]}/><meshStandardMaterial color="#a8cdd0" roughness={0.65}/></mesh>)}
    <mesh position={[sign * 0.043, 0.024, -0.025]} rotation={[0.5, 0, sign * -0.7]}><capsuleGeometry args={[0.012, 0.032, 4, 10]}/><meshStandardMaterial color="#a8cdd0" roughness={0.65}/></mesh>
  </group>;
}
