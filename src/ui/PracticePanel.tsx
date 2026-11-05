import { useState } from 'react';
import { usePractices, type PracticeRecord, type PracticeSession } from '../state/practices';
import { useLab } from '../state/lab';
import type { PracticeId } from '../experiments/catalog';
import type { Solution } from '../chemistry/solutions';
const fmt = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 3 });
export function PracticeResult({ session }: { session: PracticeSession | PracticeRecord }) {
  return session.kind === 'conductivity' ? <>
    <div className="practice-result"><span>CONDUCTIVIDAD ESTIMADA</span><strong>{fmt(session.result.microSiemens)} <small>µS/cm</small></strong><p>{session.input.solution === 'salt' ? 'La sal aporta iones móviles: la bombilla se ilumina.' : 'La muestra conduce muy poco: la bombilla permanece apagada.'}</p></div>
    <details><summary>Ver explicación y cálculo</summary><p>En agua, NaCl se disocia en Na⁺ y Cl⁻. La sacarosa se disuelve como moléculas y no aporta iones en este modelo. Se usa la aproximación de dilución ideal a 25 °C: κ ≈ 126,4 × c mS/cm para NaCl, más el fondo del agua pura (0,055 µS/cm). No es una calibración experimental; el brillo representa una escala relativa de conductividad.</p><p>Concentración seleccionada: {session.input.solution === 'water' ? 'agua pura, sin soluto' : `${fmt(session.input.concentration)} mol/L`}. Se omiten impurezas, CO₂ del aire, cambios de temperatura e interacciones entre iones.</p></details>
  </> : <>
    <div className="practice-result"><span>NUEVOS CRISTALES AL EVAPORAR</span><strong>{fmt(session.result.newCrystals)} <small>g de NaCl</small></strong><p>{session.result.newCrystals > 0 ? 'Al disminuir el agua, parte de la sal disuelta vuelve a formar cristales.' : 'No se alcanzó la saturación: aún puede permanecer toda la sal inicial disuelta.'}</p></div>
    <details><summary>Ver explicación y cálculo</summary><p>A 20 °C se aproxima la solubilidad del NaCl a 36 g por cada 100 g de agua. Al preparar: {fmt(session.result.initialDissolved)} g disueltos y {fmt(session.result.initialSolid)} g de sólido sin disolver. Al evaporar {fmt(session.result.evaporatedWater)} g de agua quedan {fmt(session.result.remainingWater)} g de agua, {fmt(session.result.dissolved)} g de sal disuelta y {fmt(session.result.solid)} g de sólido total.</p><p>La sal se conserva: disuelta + sólida = {fmt(session.input.saltG)} g. Los cristales nuevos excluyen el sólido que nunca llegó a disolverse. La animación comprime el tiempo: no calcula una velocidad de evaporación ni una curva de calentamiento. El resultado se evalúa a 20 °C después de enfriar.</p></details>
  </>;
}
export function PracticePanel({ id }: { id: PracticeId }) {
  const p = usePractices(), session = p.sessions[id];
  const [solution, setSolution] = useState<Solution>('salt'), [concentration, setConcentration] = useState(0.01);
  const [water, setWater] = useState(100), [salt, setSalt] = useState(20), [evaporation, setEvaporation] = useState(80);
  const busy = session && ['mixing', 'measuring', 'evaporating'].includes(session.phase);
  const observe = () => {
    p.run(id); useLab.getState().open(null);
    const canvas = document.querySelector('canvas');
    void canvas?.requestPointerLock()?.catch(() => {});
  };
  const prepare = () => id === 'conductivity' ? p.prepareConductivity({ solution, concentration }) : p.prepareDissolution({ waterG: water, saltG: salt, evaporationPercent: evaporation });
  return <div className="practice-panel">
    <p>{id === 'conductivity' ? 'Prepara una muestra, introduce los electrodos y compara la luz de la bombilla. El equipo y los reactivos están en esta mesa.' : 'Prepara agua y sal, observa la disolución y después evapora parte del agua para buscar cristales.'}</p>
    <div className="practice-steps"><span className={session ? 'done' : 'current'}>1 · Preparar</span><span className={session?.phase === 'prepared' ? 'current' : session ? 'done' : ''}>2 · {id === 'conductivity' ? 'Medir' : 'Disolver'}</span><span className={session?.phase === 'done' ? 'done' : session?.phase === 'mixed' ? 'current' : ''}>3 · {id === 'conductivity' ? 'Comparar' : 'Cristalizar'}</span></div>
    <fieldset disabled={!!session} className="practice-inputs"><legend>Cantidades del ensayo</legend>
      {id === 'conductivity' ? <>
        <label>Solución<select value={solution} onChange={e => setSolution(e.target.value as Solution)}><option value="water">Agua pura</option><option value="salt">Cloruro de sodio (NaCl)</option><option value="sugar">Sacarosa (azúcar)</option></select></label>
        <label>Concentración (mol/L)<input type="number" min="0.001" max="0.02" step="0.001" disabled={solution === 'water'} value={concentration} onChange={e => setConcentration(e.target.valueAsNumber)}/></label>
      </> : <>
        <label>Agua (g)<input type="number" min="50" max="150" value={water} onChange={e => setWater(e.target.valueAsNumber)}/></label>
        <label>Sal (g)<input type="number" min="1" max="50" value={salt} onChange={e => setSalt(e.target.valueAsNumber)}/></label>
        <label>Agua a evaporar (%)<input type="number" min="0" max="90" value={evaporation} onChange={e => setEvaporation(e.target.valueAsNumber)}/></label>
      </>}
    </fieldset>
    {!session && <button className="button primary-button" onClick={prepare}>Preparar {id === 'conductivity' ? 'solución' : 'agua y sal'}</button>}
    {session?.phase === 'prepared' && <><p className="practice-hint">La muestra está lista en la mesa.</p><button className="button primary-button" onClick={observe}>{id === 'conductivity' ? 'Introducir electrodos y medir' : 'Añadir sal y agitar'} →</button></>}
    {session?.phase === 'mixed' && session.kind === 'dissolution' && <><p>Se disolvieron {fmt(session.result.initialDissolved)} g; quedaron {fmt(session.result.initialSolid)} g sin disolver.</p><button className="button primary-button" onClick={observe}>Evaporar y observar cristales →</button></>}
    {busy && <p role="status">{session.phase === 'mixing' ? 'Disolviendo la sal…' : session.phase === 'measuring' ? 'Introduciendo los electrodos…' : 'Evaporando agua…'} Puedes observar el equipo en la mesa.</p>}
    {session?.phase === 'done' && <><PracticeResult session={session}/><p className="practice-hint">✓ Ensayo guardado. Pulsa N para escribir tu observación en el cuaderno.</p></>}
    {p.error && <p className="inline-message" role="alert">{p.error}</p>}
    {session && <button className="text-button" onClick={() => p.reset(id)}>Limpiar equipo y preparar otro ensayo</button>}
    <p className="notice">{id === 'conductivity' ? 'Modelo para soluciones diluidas a 25 °C. La bombilla indica una intensidad relativa, no un circuito doméstico real.' : 'Evaporación acelerada con placa virtual. No modela tiempos reales de calentamiento; el equilibrio final corresponde a 20 °C.'} Las prácticas reales requieren supervisión y equipo adecuado.</p>
  </div>;
}
