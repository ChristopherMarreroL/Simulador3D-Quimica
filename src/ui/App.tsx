import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { PeriodicTable } from './PeriodicTable';
import { Notebook } from './Notebook';
import { PracticePanel } from './PracticePanel';
import { practiceCatalog } from '../experiments/catalog';
import { usePractices } from '../state/practices';
import './laboratory-panels.css';
import { isSurface, surfaceNames } from '../experiments/surfaces';
import { Laboratory } from '../world/Laboratory';
import { useLab, guidedIndex, type RecordEntry } from '../state/lab';
import { items, guidedSteps, tutorialSteps, type ItemId } from '../experiments/definitions';
const fmt = (n: number, digits = 3) => n.toLocaleString('es', { maximumFractionDigits: digits });
function Brand() { return <div className="brand"><span className="brand-icon">e<span>3</span></span><span>experimenta<span className="brand-3d">3D</span></span></div>; }
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="scene-error">No se pudo iniciar el entorno 3D. Activa la aceleración gráfica del navegador y vuelve a cargar la página.</div> : this.props.children; }
}
function Welcome() {
  const s = useLab();
  return <div className="welcome">
    <header className="welcome-header"><Brand/><span className="build-tag">PROTOTIPO / 0.1</span></header>
    <main className="welcome-content">
      <div className="eyebrow"><span className="status-dot"/> TU ESPACIO PARA DESCUBRIR</div>
      <h1>La química,<br/>en tus <em>manos.</em></h1>
      <p className="subtitle">Experimenta 3D · Laboratorio Virtual Interactivo.</p>
      <p className="intro">Entra al laboratorio. Explora, prepara una mezcla y descubre la ciencia detrás de cada reacción.</p>
      <div className="mode-options">
        <button className="mode primary" onClick={() => s.start('guided')}><span className="mode-symbol">↗</span><span><strong>Práctica guiada</strong><small>Tu primer experimento, paso a paso</small></span><span className="arrow">→</span></button>
        <button className="mode" onClick={() => s.start('free')}><span className="mode-symbol">⌘</span><span><strong>Laboratorio libre</strong><small>Explora y experimenta a tu ritmo</small></span><span className="arrow">→</span></button>
        <button className="text-button tutorial-link" onClick={() => s.open('experiments')}>Elegir otros experimentos <span>→</span></button>
        <button className="text-button tutorial-link" onClick={() => s.start('tutorial')}>{s.tutorialDone ? 'Repetir tutorial de controles' : 'Primeros pasos · Tutorial interactivo'} <span>↗</span></button>
      </div>
      <p className="desktop-note">W A S D + mouse <span>·</span> Diseñado para computadora</p>
    </main>
    <aside className="preview-label"><span className="status-dot"/> DENTRO DEL LABORATORIO<small>Un espacio propio, inspirado en un laboratorio real</small></aside>
    <div className="experiment-preview"><span className="eyebrow">TU PRIMER EXPERIMENTO</span><div className="formula-preview">NaHCO₃ <span>+</span> CH₃COOH</div><p>Una mezcla. Miles de burbujas.<br/>¿Qué está sucediendo realmente?</p><span className="preview-pill">Ácidos y bases <span>↗</span></span></div>
    <footer className="welcome-footer"><span>OBSERVA. PREGUNTA. EXPERIMENTA.</span><span>Un laboratorio, muchas posibilidades.</span></footer>
  </div>;
}
async function capturePointer() {
  const canvas = document.querySelector('canvas');
  if (!canvas) return;
  try { await canvas.requestPointerLock(); } catch { useLab.setState({ message: 'No se pudo capturar el mouse. Haz clic otra vez en Entrar al laboratorio.' }); }
}
function HUD() {
  const s = useLab(); const sessions = usePractices(p => p.sessions);
  const extra = s.mode === 'guided' && s.activePractice !== 'reaction' ? practiceCatalog[s.activePractice] : null;
  const session = s.activePractice !== 'reaction' ? sessions[s.activePractice] : null;
  const extraIndex = !session ? 0 : session.phase === 'prepared' ? 1 : session.phase === 'done' ? 3 : 2;
  const index = s.mode === 'tutorial' ? s.tutorial : extra ? extraIndex : guidedIndex(s);
  const total = extra ? 4 : 7;
  const extraSteps = [['Busca la mesa ' + extra?.station, 'Sigue la flecha, apunta al equipo y pulsa E para preparar la muestra.'], ['Pon el equipo en marcha', s.activePractice === 'conductivity' ? 'En la mesa, introduce los electrodos para medir.' : 'Añade la sal y agita desde los controles de la mesa.'], ['Observa el experimento', session?.phase === 'mixed' ? 'Vuelve a la mesa y elige evaporar para formar cristales.' : 'Observa la muestra. Vuelve a abrir la mesa con E para continuar.'], ['Escribe lo que aprendiste', 'Abre el cuaderno con N y anota tu observación. Puedes repetir con otras cantidades.']];
  const step = s.mode === 'tutorial' ? tutorialSteps[index] : extra ? extraSteps[index] : guidedSteps[index];
  const targetItem = s.target && s.target in items ? items[s.target as ItemId] : null;
  return <>
    <header className="hud-header"><Brand/><span className="lab-label">{s.mode === 'tutorial' ? 'PRIMEROS PASOS' : s.mode === 'guided' ? 'PRÁCTICA GUIADA' : 'EXPLORACIÓN LIBRE'}</span><button onClick={() => s.open('experiments')}>Experimentos</button><button onClick={() => s.open('notebook')}>Cuaderno <kbd>N</kbd></button><button onClick={s.menu}>Menú</button></header>
    {s.mode !== 'free' && <section className="objective"><div className="eyebrow">{s.mode === 'tutorial' ? 'TUTORIAL' : extra ? extra.title.toUpperCase() : 'VINAGRE + BICARBONATO'} <span>{index + 1} / {total}</span></div><h2>{step[0]}</h2><p>{step[1]}</p><div className="progress"><span style={{ width: `${(index + (extra ? session?.phase === 'done' ? 1 : 0 : s.bicarbonateG ? 1 : 0)) / total * 100}%` }}/></div><span className="destination">↓ Sigue el marcador dorado en la escena</span></section>}
    {s.mode === 'free' && <section className="objective"><div className="eyebrow">LABORATORIO LIBRE</div><h2>Tu mesa, tus preguntas.</h2><p>Recoge el vaso y colócalo en la mesa. Mesa 01: vinagre y bicarbonato. Mesa 02: conductividad. Mesa 03: disolución y cristalización.</p><span className="destination">Apunta a un equipo y pulsa E para abrir su práctica.</span></section>}
    {s.locked && <div className={`crosshair ${s.target ? 'active' : ''}`}/>}
    {s.locked && s.target && <div className="target-card"><kbd>{s.target === 'shelf' ? 'Q' : 'E'}</kbd><div><strong>{targetItem?.name || (isSurface(s.target) ? surfaceNames[s.target] : 'Tabla periódica')}</strong><small>{targetItem?.formula || (isSurface(s.target) ? s.target === 'shelf' ? 'Q · Devolver objeto de la mano seleccionada' : 'E · Abrir práctica / Q · Colocar' : 'Abrir vista ampliada')}</small>{targetItem && <p>{targetItem.description}</p>}{(s.target === 'bench' || s.target === 'beaker') && s.vinegarMl > 0 && <p><kbd>R</kbd> Vaciar y enjuagar vaso · conserva el cuaderno</p>}</div></div>}
    <div className="hands-ui">{(['left', 'right'] as const).map((h, i) => { const id = (Object.keys(items) as ItemId[]).find(id => s.locations[id] === h); return <button className={s.hand === h ? 'selected' : ''} key={h} onClick={() => s.selectHand(h)}><kbd>{i + 1}</kbd><span><small>MANO {h === 'left' ? 'IZQUIERDA' : 'DERECHA'}</small>{id ? items[id].name : 'Libre'}</span></button>; })}</div>
    <div className="controls-strip"><span><kbd>WASD</kbd> Caminar</span><span><kbd>E</kbd> Interactuar</span><span><kbd>Q</kbd> Colocar</span><span><kbd>R</kbd> Vaciar vaso en estación</span><span><kbd>ESC</kbd> Pausa</span></div>
    {s.message && <div className="toast" role="status">{s.message}</div>}
    {!s.locked && !s.panel && !s.pouring && <div className="pause-shade"><section className="pause-card"><span className="eyebrow">{s.pouring ? 'TRANSFERENCIA EN CURSO' : 'LABORATORIO LISTO'}</span><h2>{s.pouring ? 'Observa el vertido' : 'Ponte la bata.'}</h2><p>{s.pouring ? 'El material se transfiere al vaso de precipitados.' : 'Haz clic para controlar la cámara. Escape libera el mouse en cualquier momento.'}</p><button className="button primary-button" onClick={capturePointer}>{s.pouring ? 'Observar de cerca' : 'Entrar al laboratorio'} →</button><button className="text-button" onClick={s.menu}>Volver al inicio</button></section></div>}
  </>;
}
function Results({ record }: { record: RecordEntry }) {
  const { input: i, result: r } = record;
  return <>
    <div className="result-hero"><span>CO₂ TEÓRICO PRODUCIDO</span><strong>{fmt(r.co2Moles * 1000)} <small>mmol</small></strong><p>≈ {fmt(r.co2Litres)} L de gas ideal a 25 °C y 1 atm</p></div>
    <div className="equation">NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂ ↑</div>
    <p>El ácido acético reacciona con el bicarbonato en proporción molar 1:1. Las burbujas aparecen al liberarse dióxido de carbono. El reactivo que se agota primero limita la producción de gas.</p>
    <table><tbody>
      <tr><th>Vinagre · 0,83 mol/L</th><td>{fmt(i.vinegarMl)} mL</td></tr><tr><th>Bicarbonato de sodio</th><td>{fmt(i.bicarbonateG)} g</td></tr>
      <tr><th>Moles iniciales de ácido</th><td>{fmt(r.acidMoles * 1000)} mmol</td></tr><tr><th>Moles iniciales de bicarbonato</th><td>{fmt(r.bicarbonateMoles * 1000)} mmol</td></tr>
      <tr><th>Reactivo limitante</th><td>{r.limiting}</td></tr><tr><th>Ácido en exceso</th><td>{fmt(r.acidRemaining * 1000)} mmol</td></tr><tr><th>Bicarbonato en exceso</th><td>{fmt(r.bicarbonateRemaining * 1000)} mmol</td></tr>
    </tbody></table>
    <details><summary>Cómo se calculó</summary><p>n(ácido) = C × V(L). n(bicarbonato) = m / 84,0066 g·mol⁻¹. n(CO₂) = mínimo de ambos. V = nRT/P, con R = 0,082057 L·atm·mol⁻¹·K⁻¹ y T = 298,15 K.</p></details>
    <p className="notice">Modelo de reacción completa. No incluye CO₂ disuelto, vapor de agua ni cinética experimental. La espuma es una aproximación visual; no mide el volumen de gas. El volumen teórico puede superar la capacidad del vaso porque el gas escapa al ambiente.</p>
  </>;
}
function Panel() {
  const s = useLab(); const [ml, setMl] = useState(50); const [grams, setGrams] = useState(5);
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = panelRef.current;
    root?.querySelector<HTMLButtonElement>('.close')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); useLab.getState().open(null); }
      if (event.key !== 'Tab') return;
      const controls = root?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]),input,select,textarea,summary,a[href]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, [s.panel]);
  const record = s.records.at(-1);
  const held = (id: ItemId) => ['left', 'right'].includes(s.locations[id]);
  return <div className="modal-backdrop"><section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="panel-title" className={`panel ${s.panel === 'periodic' ? 'wide' : s.panel === 'notebook' ? 'notebook-panel' : ''}`}>
    <header className="panel-header"><div><div className="eyebrow">EXPERIMENTA / {s.panel === 'conductivity' ? 'ESTACIÓN 02' : s.panel === 'dissolution' ? 'ESTACIÓN 03' : s.panel === 'notebook' ? 'TUS OBSERVACIONES' : s.panel === 'periodic' ? 'ELEMENTOS' : s.panel === 'experiments' ? 'PRÁCTICAS' : 'ESTACIÓN 01'}</div><h2 id="panel-title">{s.panel === 'station' ? 'Prepara la reacción' : s.panel === 'results' ? 'De la mezcla a los moles.' : s.panel === 'notebook' ? 'Cuaderno de laboratorio' : s.panel === 'experiments' ? 'Elige tu experimento' : s.panel === 'conductivity' || s.panel === 'dissolution' ? practiceCatalog[s.panel].title : 'Tabla periódica'}</h2></div><button aria-label="Cerrar panel" className="close" onClick={() => s.open(null)}>×</button></header>
    {s.panel === 'experiments' && <div className="experiment-picker">
      <p>Elige una práctica. Podrás recorrer libremente el laboratorio y seguir la flecha hasta su mesa.</p>
      <button className="mode" onClick={() => { s.start('guided'); s.selectPractice('reaction'); }}><span className="mode-symbol">01</span><span><strong>Vinagre y bicarbonato</strong><small>Reacción, burbujas y reactivo limitante</small></span><span className="arrow">→</span></button>
      {(['conductivity', 'dissolution'] as const).map(id => <button key={id} className="mode" onClick={() => { s.start('guided'); s.selectPractice(id); }}><span className="mode-symbol">{practiceCatalog[id].station}</span><span><strong>{practiceCatalog[id].title}</strong><small>{practiceCatalog[id].objective}</small></span><span className="arrow">→</span></button>)}
    </div>}
    {s.panel === 'station' && <>
      <p>Reacción disponible: vinagre y bicarbonato. Transporta cada reactivo hasta la mesa para añadirlo al vaso.</p>
      <div className="station-status">{s.locations.beaker === 'bench' ? '✓ Vaso de 250 mL colocado' : '○ Falta colocar el vaso en la mesa'} <span>{s.vinegarMl ? `${fmt(s.vinegarMl)} mL de vinagre` : 'Vaso vacío'}</span></div>
      <div className="reagent-row"><div><span className="eyebrow">CH₃COOH (ac) · 0,83 mol/L</span><h3>Vinagre</h3><small>{held('vinegar') ? '✓ Lo llevas contigo' : 'Recógelo en el estante'}</small></div><label>Cantidad (mL)<input type="number" min="1" max="150" step="1" value={ml} onChange={e => setMl(e.target.valueAsNumber)}/></label><button className="button" disabled={!held('vinegar') || s.locations.beaker !== 'bench' || !!s.vinegarMl || !Number.isFinite(ml) || ml < 1 || ml > 150} onClick={() => s.add('vinegar', ml)}>Verter</button></div>
      <div className="reagent-row"><div><span className="eyebrow">NaHCO₃ (s)</span><h3>Bicarbonato</h3><small>{held('bicarbonate') ? '✓ Lo llevas contigo' : 'Recógelo en el estante'}</small></div><label>Cantidad (g)<input type="number" min="0.01" max="10" step="0.1" value={grams} onChange={e => setGrams(e.target.valueAsNumber)}/></label><button className="button" disabled={!held('bicarbonate') || s.locations.beaker !== 'bench' || !s.vinegarMl || !!s.bicarbonateG || !Number.isFinite(grams) || grams < 0.01 || grams > 10} onClick={() => s.add('bicarbonate', grams)}>Añadir</button></div>
      <p className="notice">Simulación educativa. No ingieras reactivos ni cierres un recipiente que libera gas. Las prácticas reales requieren protección y supervisión.</p>
    </>}
    {s.panel === 'results' && record && <><Results record={record}/><label className="observation">Tu observación<textarea value={record.observation} placeholder="¿Qué observaste? ¿Cómo lo explica la reacción?" onChange={e => s.saveObservation(e.target.value)}/></label></>}
    {s.panel === 'notebook' && <Notebook reactionDetails={r => <Results record={r}/>}/>}
    {(s.panel === 'conductivity' || s.panel === 'dissolution') && <PracticePanel key={s.panel} id={s.panel}/>}
    {s.panel === 'periodic' && <PeriodicTable/>}
    {s.message && <p role="status" className="inline-message">{s.message}</p>}
    <footer className="panel-footer">{['station', 'results'].includes(s.panel || '') && <button className="text-button" onClick={() => { s.reset(); s.open('station'); }}>Vaciar y enjuagar vaso</button>}<button className="button primary-button" onClick={() => s.open(null)}>Volver al laboratorio →</button></footer>
  </section></div>;
}
export function App() {
  const mode = useLab(s => s.mode); const panel = useLab(s => s.panel);
  return <div className={`app ${mode ? 'playing' : ''}`}><div className="scene"><SceneBoundary><Laboratory/></SceneBoundary></div>{mode ? <HUD/> : <Welcome/>}{panel && <Panel/>}</div>;
}
