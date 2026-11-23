import { useMemo, useState } from 'react';
import { analyzeMixture, indicatorColor, VESSEL_ML, type SandboxEvent } from '../chemistry/sandbox';
import { amountRange, categoryColors, reagentIds, reagents, type ReagentId } from '../chemistry/reagents';
import { amountText, useHood, type HoodRecord, type SashPosition } from '../state/hood';
import { hoodRecipes, recipeById, toolText } from '../experiments/hoodRecipes';
import { useLab } from '../state/lab';
import './hood.css';

const fmt = (n: number, digits = 2) => n.toLocaleString('es', { maximumFractionDigits: digits });
const kindIcon: Record<SandboxEvent['kind'], string> = { 'neutralización': '⇄', gas: '◌', precipitado: '▼', 'disolución': '△', redox: 'e⁻', 'descomposición': '✺' };
const placeText = { left: 'Mano izquierda', right: 'Mano derecha', hood: 'En la campana', shelf: 'Estantería' } as const;
const sashText: Record<SashPosition, string> = { closed: 'Cerrada', work: 'Trabajo', open: 'Abierta' };

export function EventCard({ e }: { e: SandboxEvent }) {
  return <li className={`hood-event kind-${e.kind}`}>
    <span className="hood-event-icon" aria-hidden>{kindIcon[e.kind]}</span>
    <div><strong>{e.title}</strong><code>{e.equation}</code>
      <small>{fmt(e.extent * 1000, 3)} mmol de reacción · {e.deltaH === null ? 'sin dato de entalpía' : `ΔH° = ${fmt(e.deltaH, 1)} kJ/mol · ${e.heat! >= 0 ? 'libera' : 'absorbe'} ${fmt(Math.abs(e.heat!), 2)} kJ`}{e.gas ? ` · ${fmt(e.gas.mol * 1000, 2)} mmol de gas` : ''}</small>
      <p>{e.note}</p></div>
  </li>;
}

async function relock() {
  const canvas = document.querySelector('canvas');
  try { await canvas?.requestPointerLock(); } catch { /* The pause card offers re-entry. */ }
}

export function HoodPanel() {
  const h = useHood(); const lab = useLab();
  const info = useMemo(() => analyzeMixture(h.mixture), [h.mixture]);
  const fill = Math.min(100, info.volumeMl / VESSEL_ML * 100);
  const gasesOut = info.gases.length > 0 || info.ammoniaSmell || info.temperatureC > 45;
  const phChip = info.pH === null ? '#cfd8d6' : indicatorColor('universal', Math.max(0, Math.min(14, info.pH)))!.color;
  return <div className="hood-panel">
    <p className="hood-intro">Mezcla los reactivos que traigas de la estantería midiendo como en un laboratorio real. Cada cambio se calcula con un modelo químico: estequiometría, Ksp, pH y calor de reacción.</p>
    <section className="hood-status" aria-label="Estado del matraz">
      <div className="flask-visual" aria-hidden>
        <div className="flask-liquid" style={{ height: `${fill}%`, background: info.color.color, opacity: info.volumeMl ? Math.max(0.35, info.color.opacity) : 0 }}/>
        {info.solids[0] && <div className="flask-solid" style={{ background: info.solids[0].color }}/>}
        <span>{fmt(info.volumeMl, 0)} / {VESSEL_ML} mL</span>
      </div>
      <dl>
        <div><dt>Temperatura</dt><dd>{fmt(info.temperatureC, 1)} <small>°C</small></dd></div>
        <div><dt>pH</dt><dd><i className="ph-chip" style={{ background: phChip }}/>{info.pH === null ? '—' : fmt(info.pH, 2)}</dd></div>
        <div><dt>Sólidos</dt><dd className="small">{info.solids.length ? info.solids.slice(0, 3).map(s => <span key={s.id} className="solid-tag"><i style={{ background: s.color }}/>{s.label} · {fmt(s.grams, 3)} g</span>) : 'Ninguno'}</dd></div>
        <div><dt>Gases liberados</dt><dd className="small">{info.gases.length ? info.gases.map(g => `${g.label} ${fmt(g.litres * 1000, 0)} mL`).join(' · ') : 'Ninguno'}</dd></div>
      </dl>
    </section>
    {(!h.fan && gasesOut) && <p className="hood-warning" role="alert">⚠ El extractor está apagado y la mezcla desprende gases o vapores. Enciéndelo.</p>}
    {h.sash === 'open' && <p className="hood-warning">⚠ La ventana está subida por completo. Bájala a la altura de trabajo para protegerte la cara.</p>}
    {info.ammoniaSmell && <p className="hood-warning">Olor a amoníaco: el modelo indica NH₃ disuelto en exceso.</p>}

    <h3 className="hood-title">Cómo se trabaja aquí</h3>
    <ul className="hood-howto">
      <li><b>1 · Protección:</b> gafas y guantes de la estación junto a la puerta {lab.ppe.goggles && lab.ppe.gloves ? '✓' : '(aún te faltan)'}.</li>
      <li><b>2 · Líquidos:</b> con el frasco en la mano, mantén el clic sobre la <b>probeta</b> hasta la marca; luego pulsa E en la probeta para verterla en el matraz. Probeta: {h.cylinder.reagent && h.cylinder.ml > 0.05 ? `${fmt(h.cylinder.ml, 1)} mL de ${reagents[h.cylinder.reagent].name}` : h.cylinder.dirty ? `vacía, con restos de ${reagents[h.cylinder.dirty].name} (enjuágala con la piseta)` : 'vacía y limpia'}.</li>
      <li><b>3 · Sólidos:</b> mantén el clic sobre la <b>balanza</b> para añadir con la espátula; E en la balanza lo pasa al matraz. Balanza: {h.balance.reagent && h.balance.grams > 0.001 ? `${h.balance.grams.toFixed(2)} g de ${reagents[h.balance.reagent].name}` : '0,00 g'}.</li>
      <li><b>4 · Indicadores:</b> mantén el clic sobre el matraz: caen gota a gota.</li>
      <li><b>5 · Al terminar:</b> E en el recipiente de <b>residuos</b> vacía el matraz. Nunca al fregadero.</li>
    </ul>
    <button className="button" onClick={() => lab.open('recipes')}>{h.recipe ? 'Ver o cambiar el experimento guiado' : 'Elegir un experimento guiado'}</button>
    {h.error && <p className="inline-message" role="alert">{h.error}</p>}

    <div className="hood-controls">
      <div className="segmented" role="group" aria-label="Ventana de la campana"><span>Ventana</span>{(['closed', 'work', 'open'] as const).map(p => <button key={p} className={h.sash === p ? 'on' : ''} aria-pressed={h.sash === p} onClick={() => h.setSash(p)}>{sashText[p]}</button>)}</div>
      {([['fan', 'Extractor'], ['light', 'Luz'], ['stirring', 'Agitador']] as const).map(([key, text]) => <button key={key} className={`toggle ${h[key] ? 'on' : ''}`} aria-pressed={h[key]} onClick={() => h.toggle(key)}><i/>{text}</button>)}
    </div>

    <h3 className="hood-title">Lo que ocurrió</h3>
    {!h.log.length ? <p className="hood-empty">El matraz está limpio. Empieza vertiendo agua o una disolución.</p> : <ol className="hood-log">{[...h.log].reverse().map(entry => <li key={entry.id}>
      <header><b>+ {amountText(entry.reagent, entry.amount)}</b> {reagents[entry.reagent].name}{Math.abs(entry.deltaT) >= 0.05 && <span className={entry.deltaT > 0 ? 'hot' : 'cold'}>{entry.deltaT > 0 ? '▲' : '▼'} {fmt(Math.abs(entry.deltaT), 1)} °C</span>}</header>
      {entry.events.length ? <ul>{entry.events.map(e => <EventCard key={e.rule} e={e}/>)}</ul> : <p className="hood-empty">{entry.note}</p>}
    </li>)}</ol>}
    {h.mixture.heatUnknown && <p className="notice">Algunas reacciones no tienen entalpía de formación de referencia en las tablas usadas: la temperatura no incluye su calor.</p>}

    <details className="hood-details"><summary>Composición del matraz</summary>
      {info.dissolved.length ? <table><tbody>{info.dissolved.map(d => <tr key={d.id}><th>{d.label} <small>{d.name}</small></th><td>{fmt(d.molarity, 4)} mol/L</td></tr>)}</tbody></table> : <p>Sin especies disueltas relevantes.</p>}
      {info.solids.length > 0 && <table><tbody>{info.solids.map(s => <tr key={s.id}><th>{s.label} <small>{s.name} · {s.colorName}</small></th><td>{fmt(s.grams, 4)} g</td></tr>)}</tbody></table>}
    </details>
    <details className="hood-details"><summary>Cómo calcula el modelo</summary>
      <p>Las reacciones rápidas (ácido–base, gases, redox y desplazamiento de metales según los potenciales estándar) se completan en orden de prioridad. Los sólidos poco solubles siguen su Ksp a 25 °C y pueden precipitar o redisolverse. El pH resuelve el balance de cargas con los sistemas ácido acético, carbonato, amonio, sulfato y hierro(III).</p>
      <p>El calor se obtiene de las entalpías de formación (ΔH°f) y se reparte en la masa del líquido como si fuera agua, sin pérdidas al ambiente. El volumen de gas se calcula como gas ideal a 25 °C y 1 atm. No se simulan velocidades de reacción, actividades iónicas, iones complejos ni cambios de las constantes con la temperatura. Una combinación sin cambios puede reaccionar en la realidad de formas no incluidas.</p>
    </details>
    <p className="notice">Simulación educativa. Varios de estos reactivos son corrosivos o tóxicos: en un laboratorio real se usan con supervisión, gafas, guantes y campana encendida. No mezcles sustancias reales sin un procedimiento aprobado.</p>
    <div className="hood-actions">
      <button className="button primary-button" disabled={!h.mixture.additions.length || !!h.savedAt} onClick={h.save}>{h.savedAt ? '✓ Guardado en el cuaderno' : 'Guardar en el cuaderno'}</button>
      <button className="text-button" disabled={!h.mixture.additions.length || !!h.transfer} onClick={() => { if (h.dispose()) { lab.open(null); void relock(); } }}>Desechar en residuos</button>
      <button className="text-button" disabled={!reagentIds.some(id => h.places[id] === 'hood')} onClick={h.returnAll}>Devolver frascos de la bandeja</button>
    </div>
  </div>;
}

export function HoodRecordDetails({ record }: { record: HoodRecord }) {
  return <div className="hood-record">
    <p>pH final {record.pH === null ? '—' : fmt(record.pH, 2)} · {fmt(record.temperatureC, 1)} °C · {fmt(record.volumeMl, 0)} mL{record.solids.length ? ` · sólidos: ${record.solids.join(', ')}` : ''}{record.gases.length ? ` · gases: ${record.gases.map(g => `${g.label} ${fmt(g.mol * 1000, 2)} mmol`).join(', ')}` : ''}</p>
    <ol>{record.log.map((l, i) => <li key={i}><b>+ {amountText(l.reagent, l.amount)} {reagents[l.reagent]?.name}</b>{l.titles.length ? <ul>{l.titles.map((t, j) => <li key={j}>{t}<code>{l.equations[j]}</code></li>)}</ul> : <span> · sin cambios</span>}</li>)}</ol>
  </div>;
}

/** Chooser for the guided hood experiments: equation, materials with the tool for each amount, safety and waste. */
export function RecipesPanel() {
  const h = useHood(); const lab = useLab();
  const start = (id: string) => { h.selectRecipe(id); lab.open(null); useLab.setState({ message: 'Experimento elegido: sigue las flechas doradas y la lista de pasos.' }); void relock(); };
  return <div className="recipes-panel">
    <p className="recipes-intro">Elige un experimento. Aparecerán flechas doradas sobre cada cosa que necesitas: primero la protección, luego los frascos, la probeta o la balanza, el matraz y los residuos. Cada uno se comprueba con el modelo químico.</p>
    {h.recipe && <p className="hood-warning">En curso: <b>{recipeById(h.recipe.id)?.title}</b>. <button className="text-button" onClick={() => h.selectRecipe(null)}>Abandonar este experimento</button></p>}
    <div className="recipe-grid">{hoodRecipes.map(r => <article key={r.id} className={`recipe-item ${h.recipe?.id === r.id ? 'active' : ''}`}>
      <header><h3>{r.title}</h3><span className="level">{r.level}</span></header>
      <code>{r.equation}</code>
      <p>{r.goal}</p>
      <ul>{r.adds.map((a, i) => <li key={i}><i style={{ background: categoryColors[reagents[a.reagent].category] }}/>{amountText(a.reagent, a.amount)} de {reagents[a.reagent].name} · {toolText[a.tool]}</li>)}</ul>
      <p className="safety">⚠ {r.safety}</p>
      <button className="button primary-button" onClick={() => start(r.id)}>{h.recipe?.id === r.id ? 'Continuar' : 'Empezar'} →</button>
    </article>)}</div>
  </div>;
}
