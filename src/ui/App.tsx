import { cabinets, exhibitGroupColors, exhibits, useStorage } from '../state/storage';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { PeriodicTable } from './PeriodicTable';
import { Notebook } from './Notebook';
import { PracticePanel } from './PracticePanel';
import { HoodPanel, RecipesPanel } from './HoodPanel';
import { recipeById } from '../experiments/hoodRecipes';
import { amountText, CYLINDER_ML, hoodGuidedIndex, recipeSteps, useHood, type Hand } from '../state/hood';
import { categoryColors, reagents, type ReagentId } from '../chemistry/reagents';
import { useSettings } from '../state/settings';
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
const hoodSteps = [
  ['Elige tus reactivos', 'Ve a la estantería junto a la campana. Apunta a un frasco y pulsa E: puedes llevar uno en cada mano.'],
  ['Llévalos a la campana', 'Apunta a la campana: E abre la mesa de mezclas y Q deja el frasco en su bandeja.'],
  ['Mezcla y observa', 'Añade otro reactivo al matraz. Observa burbujas, colores, precipitados y la temperatura.'],
  ['Registra tu hallazgo', 'Guarda la mezcla en el cuaderno desde la campana y escribe lo que observaste.'],
];
type Action = [key: string, label: string];
/** Name, one-line detail and the actions available for the object under the crosshair. */
function targetInfo(target: string, s: ReturnType<typeof useLab.getState>, hood: ReturnType<typeof useHood.getState>, storageOpen: Record<string, boolean> = {}): { title: string; detail: string; actions: Action[]; color?: string } {
  const handName = s.hand === 'left' ? 'izquierda' : 'derecha';
  const heldReagent = hood.heldIn(s.hand);
  const heldItem = (Object.keys(items) as ItemId[]).find(id => s.locations[id] === s.hand);
  const busy = !!heldReagent || !!heldItem || hood.pipette.place === s.hand;
  if (target.startsWith('cabinet:')) {
    const id = target.slice(8); const open = !!storageOpen[id]; const c = cabinets.find(x => x.id === id);
    return { title: c ? 'Gabinete de material' : 'Vitrina de compuestos', detail: c ? c.contents : `${exhibits.length} compuestos de exposición, sin modelo químico.`, actions: [['Clic', open ? 'Cerrar' : 'Abrir']] };
  }
  if (target.startsWith('exhibit:')) {
    const e = exhibits[Number(target.slice(8))];
    return { title: e.name, detail: e.formula, color: exhibitGroupColors[e.group], actions: [['Mira', 'Solo exposición: sin modelo químico']] };
  }
  if (target.startsWith('reagent:')) {
    const r = reagents[target.slice(8) as ReagentId];
    const actions: Action[] = busy ? [['1 · 2', 'Cambia a una mano libre para recogerlo']] : [['Clic', `Recoger con la mano ${handName}`]];
    if (heldReagent && hood.places[r.id] === 'shelf') actions.push(['Q', `Devolver ${reagents[heldReagent].name}`]);
    return { title: r.name, detail: `${r.formula} · ${r.hazard}`, actions, color: categoryColors[r.category] };
  }
  if (target === 'reagent-shelf') return { title: 'Estantería de reactivos', detail: '27 reactivos ordenados por tipo.', actions: heldReagent ? [['Q', `Devolver ${reagents[heldReagent].name}`]] : [['Mira', 'Apunta a un frasco para recogerlo']] };
  if (target === 'ppe-goggles') return { title: 'Gafas de seguridad', detail: 'Protegen los ojos de salpicaduras y vapores.', actions: [s.ppe.goggles ? ['✓', 'Ya las llevas puestas'] : ['Clic', 'Ponértelas']] };
  if (target === 'ppe-gloves') return { title: 'Guantes de nitrilo', detail: 'Obligatorios para manipular reactivos.', actions: [s.ppe.gloves ? ['✓', 'Ya los llevas puestos'] : ['Clic', 'Ponértelos']] };
  if (target === 'recipe-board') return { title: 'Tablero de experimentos', detail: hood.recipe ? `En curso: ${recipeById(hood.recipe.id)?.title}` : '16 prácticas guiadas con flechas', actions: [['Clic', hood.recipe ? 'Cambiar o abandonar el experimento' : 'Elegir un experimento']] };
  if (target === 'hood-cylinder') {
    const c = hood.cylinder; const content = c.reagent && c.ml > 0.05 ? `${c.ml.toLocaleString('es', { maximumFractionDigits: 1 })} mL de ${reagents[c.reagent].name}` : c.dirty ? `Vacía, con restos de ${reagents[c.dirty].name}` : 'Vacía y limpia';
    const liquid = heldReagent && ['solution', 'water'].includes(reagents[heldReagent].kind);
    return { title: 'Probeta graduada · 100 mL', detail: content, actions: [...(liquid ? [['Clic', `Mantén para verter ${reagents[heldReagent!].name} y mira la marca`] as Action] : []), ...(c.ml >= 1 ? [['E', 'Verter la probeta en el matraz'] as Action] : []), ...(!liquid && c.ml < 1 ? [['Mira', 'Trae un líquido de la estantería para medirlo'] as Action] : [])] };
  }
  if (target === 'tool:pipette') return { title: 'Pipeta graduada · 10 mL', detail: 'Mide volúmenes pequeños con más precisión que la probeta.', actions: [busy ? ['1 · 2', 'Cambia a una mano libre'] : ['Clic', `Recoger con la mano ${handName}`]] };
  if (target === 'hood-pipette') {
    const p = hood.pipette; const inHand = p.place === s.hand;
    if (p.place !== 'hood') return { title: 'Soporte para pipeta', detail: inHand ? 'Deja aquí la pipeta para usarla.' : 'Vacío: la pipeta está en el gabinete de pipetas.', actions: [inHand ? ['Clic', 'Colocar la pipeta'] : ['Mira', 'Trae la pipeta de su gabinete']] };
    const content = p.reagent && p.ml > 0.05 ? `${p.ml.toLocaleString('es', { maximumFractionDigits: 1 })} mL de ${reagents[p.reagent].name}` : p.dirty ? `Vacía, con restos de ${reagents[p.dirty].name}` : 'Vacía y limpia';
    const liquid = heldReagent && ['solution', 'water'].includes(reagents[heldReagent].kind);
    return { title: 'Pipeta graduada · 10 mL', detail: content, actions: [...(liquid ? [['Clic', `Mantén para aspirar ${reagents[heldReagent!].name}`] as Action] : []), ...(p.ml >= 0.1 ? [['E', 'Descargar la pipeta en el matraz'] as Action] : []), ...(!liquid && p.ml < 0.1 ? [['Mira', 'Trae un líquido de la estantería para aspirarlo'] as Action] : [])] };
  }
  if (target === 'hood-balance') {
    const b = hood.balance; const solid = heldReagent && reagents[heldReagent].kind === 'solid';
    return { title: 'Balanza con navecilla', detail: b.reagent && b.grams > 0.001 ? `${b.grams.toFixed(2)} g de ${reagents[b.reagent].name}` : 'Tarada a 0,00 g', actions: [...(solid ? [['Clic', `Mantén para añadir ${reagents[heldReagent!].name} con la espátula`] as Action] : []), ...(b.grams >= 0.05 ? [['E', 'Añadir el sólido pesado al matraz'] as Action] : []), ...(!solid && b.grams < 0.05 ? [['Mira', 'Trae un sólido de la estantería para pesarlo'] as Action] : [])] };
  }
  if (target === 'hood-washbottle') return { title: 'Piseta de agua destilada', detail: 'Enjuaga la probeta antes de medir otro reactivo.', actions: [['E', 'Enjuagar la probeta']] };
  if (target === 'hood-waste') return { title: 'Recipiente de residuos', detail: 'Nunca viertas reactivos por el fregadero.', actions: [['E', hood.mixture.additions.length ? 'Vaciar el matraz aquí' : 'El matraz está vacío']] };
  if (target === 'hood') {
    const kind = heldReagent ? reagents[heldReagent].kind : null;
    const actions: Action[] = heldReagent ? [kind === 'indicator' ? ['Clic', `Mantén para añadir gotas de ${reagents[heldReagent].name}`] : ['Mira', kind === 'solid' ? 'Los sólidos se pesan primero en la balanza' : 'Los líquidos se miden primero en la probeta'], ['E', 'Resultados y registro de la mezcla'], ['Q', 'Dejar el frasco en la bandeja']] : [['E', 'Resultados y registro de la mezcla'], ['Mira', 'Mide en la probeta o pesa en la balanza y añádelo aquí']];
    return { title: 'Campana extractora', detail: hood.mixture.additions.length ? `Matraz: ${Math.round(hood.mixture.waterMl)} mL` : 'Matraz de 500 mL sobre el agitador', actions };
  }
  if (target === 'hood-sash') return { title: 'Ventana de la campana', detail: 'Trabaja con la ventana baja: protege tu cara.', actions: [['Clic', hood.sash === 'open' ? 'Bajar a la altura de trabajo' : 'Subir por completo']] };
  const item = target in items ? items[target as ItemId] : null;
  if (item) return { title: item.name, detail: item.formula, actions: [busy ? ['1 · 2', 'Cambia a una mano libre'] : ['Clic', `Recoger con la mano ${handName}`], ...(target === 'beaker' && s.vinegarMl > 0 ? [['R', 'Vaciar y enjuagar el vaso'] as Action] : [])] };
  if (isSurface(target)) {
    const actions: Action[] = target === 'shelf' ? [['Q', 'Devolver el objeto de tu mano']] : [['Clic', target === 'bench' ? 'Abrir la estación' : 'Abrir la práctica'], ['Q', 'Colocar el objeto de tu mano']];
    if (target === 'bench' && s.vinegarMl > 0) actions.push(['R', 'Vaciar y enjuagar el vaso']);
    return { title: surfaceNames[target], detail: '', actions };
  }
  return { title: 'Tabla periódica', detail: '118 elementos con sus propiedades', actions: [['Clic', 'Abrir la tabla']] };
}
const qualityText = { media: 'Media', alta: 'Alta', ultra: 'Ultra' } as const;
function Settings() {
  const q = useSettings();
  return <div className="settings">
    <div className="segmented" role="group" aria-label="Calidad gráfica"><span>Gráficos</span>{(['media', 'alta', 'ultra'] as const).map(v => <button key={v} className={q.quality === v ? 'on' : ''} aria-pressed={q.quality === v} onClick={() => q.setQuality(v)}>{qualityText[v]}</button>)}</div>
    <label>Sensibilidad del mouse <b>{q.sensitivity.toLocaleString('es', { maximumFractionDigits: 1 })}×</b><input type="range" min="0.4" max="2" step="0.1" value={q.sensitivity} onChange={e => q.setSensitivity(e.target.valueAsNumber)}/></label>
    <label className="check"><input type="checkbox" checked={q.showFps} onChange={e => q.setShowFps(e.target.checked)}/> Mostrar FPS</label>
    <small>Ultra añade oclusión ambiental, brillo de luces, vidrio con refracción y sombras de alta resolución. Si va lento, usa Alta o Media.{q.auto ? ' Mientras no elijas, la app baja la calidad sola si detecta pocos FPS.' : ''}</small>
  </div>;
}
/** Frame rate measured from the browser's own animation frames (what the player actually sees). */
function useFps(active: boolean) {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frames = 0, start = performance.now(), raf = 0;
    const tick = (t: number) => { frames++; if (t - start >= 1000) { setFps(Math.round(frames * 1000 / (t - start))); frames = 0; start = t; } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [active]);
  return fps;
}
/** Shows FPS on request and, while quality is automatic, steps down once if the lab runs below ~28 FPS. */
function Performance() {
  const q = useSettings(); const locked = useLab(s => s.locked);
  const fps = useFps(locked && (q.showFps || q.auto));
  const low = useRef(0);
  useEffect(() => {
    if (!q.auto || !locked || !fps) return;
    low.current = fps < 28 ? low.current + 1 : 0;
    if (low.current >= 4 && q.quality !== 'media') {
      const next = q.quality === 'ultra' ? 'alta' : 'media'; low.current = 0;
      q.setQuality(next, false);
      useLab.setState({ message: `Rendimiento bajo (${fps} FPS): la calidad gráfica pasa a ${qualityText[next]}. Puedes cambiarla en la pausa (Escape).` });
    }
  }, [fps]);
  return q.showFps && locked ? <div className="fps">{fps} FPS · {qualityText[q.quality]}</div> : null;
}
function PourGauge() {
  const pouring = useHood(h => h.pouring); const volume = useHood(h => h.mixture.waterMl); const recipe = useHood(h => h.recipe);
  if (!pouring?.stream) return null;
  const r = reagents[pouring.reagent]; const goal = recipeById(recipe?.id)?.adds.find(a => a.reagent === pouring.reagent);
  const where = pouring.target === 'pipette' ? 'Aspirando con la pipeta' : pouring.target === 'cylinder' ? 'Llenando la probeta' : pouring.target === 'balance' ? 'Pesando con la espátula' : 'Añadiendo al matraz';
  const max = pouring.target === 'pipette' ? 10 : pouring.target === 'cylinder' ? CYLINDER_ML : pouring.target === 'balance' ? (r.kind === 'solid' ? r.max : 10) : 500;
  const value = pouring.target === 'flask' ? volume : pouring.amount;
  const near = goal ? Math.abs(pouring.amount - goal.amount) <= goal.amount * 0.1 : false;
  return <div className={`pour-gauge ${near ? 'near' : ''}`} role="status"><span>{where} · {r.name}</span><strong>{amountText(pouring.reagent, Math.round(pouring.amount * (r.kind === 'solid' ? 100 : 10)) / (r.kind === 'solid' ? 100 : 10))}</strong>
    <div className="pour-bar"><i style={{ width: `${Math.min(100, value / max * 100)}%` }}/>{goal && <b style={{ left: `${Math.min(100, goal.amount / max * 100)}%` }}/>}</div>
    <small>{goal ? `Objetivo: ${amountText(goal.reagent, goal.amount)}${near ? ' · ¡suelta ahora!' : ''}` : pouring.target === 'flask' ? `Matraz: ${Math.round(volume)} / 500 mL` : 'Suelta el clic para parar'}</small></div>;
}
/** Checklist of the selected hood experiment; it replaces the generic objective card. */
function RecipeCard() {
  const recipe = useHood(h => h.recipe); const h = useHood(); const ppe = useLab(s => s.ppe);
  const def = recipeById(recipe?.id);
  const steps = def && recipe ? recipeSteps(def, recipe, h, ppe) : [];
  const current = steps.findIndex(st => !st.done);
  useEffect(() => {
    if (def && recipe && steps.length && current < 0 && !recipe.completedAt) {
      useHood.setState({ recipe: { ...recipe, completedAt: Date.now() } });
      useLab.setState({ message: `¡${def.title}: experimento completado! Elige otro en el tablero junto a la campana.` });
    }
  }, [current, def, recipe, steps.length]);
  if (!def || !recipe) return null;
  return <section className="objective recipe-card">
    <div className="eyebrow">EXPERIMENTO GUIADO <span>{current < 0 ? steps.length : current + 1} / {steps.length}</span></div>
    <h2>{def.title}</h2><p className="recipe-eq">{def.equation}</p>
    <ol>{steps.map((st, i) => <li key={st.key} className={st.done ? 'done' : i === current ? 'current' : ''}><span>{st.done ? '✓' : i + 1}</span><div>{st.title}{i === current && <small>{st.detail}</small>}</div></li>)}</ol>
    <div className="progress"><span style={{ width: `${steps.filter(st => st.done).length / steps.length * 100}%` }}/></div>
    <span className="destination">{current < 0 ? '¡Completado! Elige otro en el tablero.' : '↓ Sigue las flechas doradas'}</span>
  </section>;
}
function HoodNotifier() {
  const last = useHood(h => h.log.at(-1)); const streaming = useHood(h => !!h.pouring?.stream);
  useEffect(() => {
    if (!last || streaming || Date.now() - last.at > 60000) return;
    const titles = last.events.map(e => e.title);
    const heat = Math.abs(last.deltaT) >= 0.5 ? ` La temperatura ${last.deltaT > 0 ? 'sube' : 'baja'} ${Math.abs(last.deltaT).toLocaleString('es', { maximumFractionDigits: 1 })} °C.` : '';
    useLab.setState({ message: titles.length ? `+ ${amountText(last.reagent, last.amount)}: ${titles.slice(0, 2).join('. ')}.${heat}` : last.note || 'Mezcla sin cambios visibles.' });
  }, [last, streaming]);
  return null;
}
function HUD() {
  const s = useLab(); const sessions = usePractices(p => p.sessions); const hood = useHood();
  const practice = s.activePractice === 'conductivity' || s.activePractice === 'dissolution' ? s.activePractice : null;
  const hoodTrack = s.mode === 'guided' && s.activePractice === 'hood';
  const extra = s.mode === 'guided' && practice ? practiceCatalog[practice] : null;
  const session = practice ? sessions[practice] : null;
  const extraIndex = !session ? 0 : session.phase === 'prepared' ? 1 : session.phase === 'done' ? 3 : 2;
  const index = s.mode === 'tutorial' ? s.tutorial : hoodTrack ? hoodGuidedIndex(hood) : extra ? extraIndex : guidedIndex(s);
  const total = extra || hoodTrack ? 4 : 7;
  const extraSteps = [['Busca la mesa ' + extra?.station, 'Sigue la flecha, apunta al equipo y pulsa E para preparar la muestra.'], ['Pon el equipo en marcha', s.activePractice === 'conductivity' ? 'En la mesa, introduce los electrodos para medir.' : 'Añade la sal y agita desde los controles de la mesa.'], ['Observa el experimento', session?.phase === 'mixed' ? 'Vuelve a la mesa y elige evaporar para formar cristales.' : 'Observa la muestra. Vuelve a abrir la mesa con E para continuar.'], ['Escribe lo que aprendiste', 'Abre el cuaderno con N y anota tu observación. Puedes repetir con otras cantidades.']];
  const step = s.mode === 'tutorial' ? tutorialSteps[index] : hoodTrack ? hoodSteps[index] : extra ? extraSteps[index] : guidedSteps[index];
  const storageOpen = useStorage(st => st.open);
  const card = s.target ? targetInfo(s.target, s, hood, storageOpen) : null;
  const done = hoodTrack ? !!hood.savedAt : extra ? session?.phase === 'done' : !!s.bicarbonateG;
  return <>
    <header className="hud-header"><Brand/><span className="lab-label">{s.mode === 'tutorial' ? 'PRIMEROS PASOS' : s.mode === 'guided' ? 'PRÁCTICA GUIADA' : 'EXPLORACIÓN LIBRE'}</span><button onClick={() => s.open('experiments')}>Experimentos</button><button onClick={() => s.open('notebook')}>Cuaderno <kbd>N</kbd></button><button onClick={s.menu}>Menú</button></header>
    {hood.recipe && s.mode !== 'tutorial' ? <RecipeCard/> : <>
    {s.mode !== 'free' && <section className="objective"><div className="eyebrow">{s.mode === 'tutorial' ? 'TUTORIAL' : hoodTrack ? 'CAMPANA · MEZCLAS LIBRES' : extra ? extra.title.toUpperCase() : 'VINAGRE + BICARBONATO'} <span>{index + 1} / {total}</span></div><h2>{step[0]}</h2><p>{step[1]}</p><div className="progress"><span style={{ width: `${(index + (s.mode !== 'tutorial' && done ? 1 : 0)) / total * 100}%` }}/></div><span className="destination">↓ Sigue el marcador dorado en la escena</span></section>}
    {s.mode === 'free' && <section className="objective"><div className="eyebrow">LABORATORIO LIBRE</div><h2>Tu mesa, tus preguntas.</h2><p>Mesa 01: vinagre y bicarbonato. Mesa 02: conductividad. Mesa 03: cristalización. Campana: mezcla libremente los 27 reactivos de la estantería del fondo.</p><span className="destination">Apunta a un equipo y pulsa E para abrir su práctica.</span></section>}
    </>}
    {s.locked && s.ppe.goggles && <div className="goggles" aria-hidden/>}
    {s.locked && <div className={`crosshair ${s.target ? 'active' : ''}`}/>}
    {s.locked && card && !hood.pouring?.stream && <div className="target-card prompt"><div><strong>{card.color && <i className="tag" style={{ background: card.color }}/>}{card.title}</strong>{card.detail && <small>{card.detail}</small>}<ul className="prompt-actions">{card.actions.map(([k, l]) => <li key={k + l}><kbd className={k === 'Clic' ? 'mouse' : k === 'Mira' ? 'look' : ''}>{k}</kbd>{l}</li>)}</ul></div></div>}
    {s.locked && <PourGauge/>}
    <div className="hands-ui">{(['left', 'right'] as const).map((h, i) => { const id = (Object.keys(items) as ItemId[]).find(id => s.locations[id] === h); const reagent = hood.heldIn(h as Hand); return <button className={s.hand === h ? 'selected' : ''} key={h} onClick={() => s.selectHand(h)}><kbd>{i + 1}</kbd><span><small>MANO {h === 'left' ? 'IZQUIERDA' : 'DERECHA'}</small>{reagent && <i className="tag" style={{ background: categoryColors[reagents[reagent].category] }}/>}{id ? items[id].name : reagent ? reagents[reagent].name : 'Libre'}</span></button>; })}</div>
    <div className="controls-strip">{([['WASD', 'Caminar'], ['Clic · E', 'Usar'], ...(hood.heldIn('left') || hood.heldIn('right') || Object.values(s.locations).some(l => l === 'left' || l === 'right') ? [['Q', 'Dejar']] : []), ['1 · 2', 'Manos'], ['N', 'Cuaderno'], ...(s.vinegarMl > 0 ? [['R', 'Vaciar vaso']] : []), ['ESC', 'Pausa']] as Action[]).map(([k, l]) => <span key={k}><kbd>{k}</kbd> {l}</span>)}</div>
    {s.message && <div className="toast" role="status">{s.message}</div>}
    <HoodNotifier/><Performance/>
    {!s.locked && !s.panel && !s.pouring && <div className="pause-shade"><section className="pause-card"><span className="eyebrow">{s.pouring ? 'TRANSFERENCIA EN CURSO' : 'LABORATORIO LISTO'}</span><h2>{s.pouring ? 'Observa el vertido' : 'Ponte la bata.'}</h2><p>{s.pouring ? 'El material se transfiere al vaso de precipitados.' : 'Haz clic para controlar la cámara. Escape libera el mouse en cualquier momento.'}</p><button className="button primary-button" onClick={capturePointer}>{s.pouring ? 'Observar de cerca' : 'Entrar al laboratorio'} →</button><button className="text-button" onClick={s.menu}>Volver al inicio</button><Settings/></section></div>}
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
  return <div className="modal-backdrop"><section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="panel-title" className={`panel ${s.panel === 'periodic' ? 'wide' : s.panel === 'notebook' ? 'notebook-panel' : s.panel === 'hood' || s.panel === 'recipes' ? 'hood-wide' : ''}`}>
    <header className="panel-header"><div><div className="eyebrow">EXPERIMENTA / {s.panel === 'conductivity' ? 'ESTACIÓN 02' : s.panel === 'dissolution' ? 'ESTACIÓN 03' : s.panel === 'notebook' ? 'TUS OBSERVACIONES' : s.panel === 'periodic' ? 'ELEMENTOS' : s.panel === 'experiments' ? 'PRÁCTICAS' : s.panel === 'hood' ? 'CAMPANA EXTRACTORA' : s.panel === 'recipes' ? 'TABLERO DE LA CAMPANA' : 'ESTACIÓN 01'}</div><h2 id="panel-title">{s.panel === 'station' ? 'Prepara la reacción' : s.panel === 'results' ? 'De la mezcla a los moles.' : s.panel === 'notebook' ? 'Cuaderno de laboratorio' : s.panel === 'experiments' ? 'Elige tu experimento' : s.panel === 'hood' ? 'Mezclas libres' : s.panel === 'recipes' ? 'Elige un experimento' : s.panel === 'conductivity' || s.panel === 'dissolution' ? practiceCatalog[s.panel].title : 'Tabla periódica'}</h2></div><button aria-label="Cerrar panel" className="close" onClick={() => s.open(null)}>×</button></header>
    {s.panel === 'experiments' && <div className="experiment-picker">
      <p>Elige una práctica. Podrás recorrer libremente el laboratorio y seguir la flecha hasta su mesa.</p>
      <button className="mode" onClick={() => { s.start('guided'); s.selectPractice('reaction'); }}><span className="mode-symbol">01</span><span><strong>Vinagre y bicarbonato</strong><small>Reacción, burbujas y reactivo limitante</small></span><span className="arrow">→</span></button>
      {(['conductivity', 'dissolution'] as const).map(id => <button key={id} className="mode" onClick={() => { s.start('guided'); s.selectPractice(id); }}><span className="mode-symbol">{practiceCatalog[id].station}</span><span><strong>{practiceCatalog[id].title}</strong><small>{practiceCatalog[id].objective}</small></span><span className="arrow">→</span></button>)}
      <button className="mode hood-mode" onClick={() => { s.start('guided'); s.selectPractice('hood'); s.open('recipes'); }}><span className="mode-symbol">⚗</span><span><strong>Campana · experimentos guiados</strong><small>16 prácticas con flechas: elige una y sigue el procedimiento real</small></span><span className="arrow">→</span></button>
      <button className="mode hood-mode" onClick={() => { s.start('guided'); s.selectPractice('hood'); }}><span className="mode-symbol">⌬</span><span><strong>Campana · mezclas libres</strong><small>27 reactivos: combina lo que quieras con el modelo químico</small></span><span className="arrow">→</span></button>
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
    {s.panel === 'hood' && <HoodPanel/>}
    {s.panel === 'recipes' && <RecipesPanel/>}
    {s.message && <p role="status" className="inline-message">{s.message}</p>}
    <footer className="panel-footer">{['station', 'results'].includes(s.panel || '') && <button className="text-button" onClick={() => { s.reset(); s.open('station'); }}>Vaciar y enjuagar vaso</button>}<button className="button primary-button" onClick={() => s.open(null)}>Volver al laboratorio →</button></footer>
  </section></div>;
}
export function App() {
  const mode = useLab(s => s.mode); const panel = useLab(s => s.panel);
  return <div className={`app ${mode ? 'playing' : ''}`}><div className="scene"><SceneBoundary><Laboratory/></SceneBoundary></div>{mode ? <HUD/> : <Welcome/>}{panel && <Panel/>}</div>;
}
