import { useState, type ReactNode } from 'react';
import { useLab, type RecordEntry } from '../state/lab';
import { usePractices } from '../state/practices';
import { PracticeResult } from './PracticePanel';
import { practiceCatalog } from '../experiments/catalog';
const f = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 2 });
export function Notebook({ reactionDetails }: { reactionDetails: (r: RecordEntry) => ReactNode }) {
  const lab = useLab(), practices = usePractices();
  const [selected, setSelected] = useState(''), [filter, setFilter] = useState('all');
  const records = [
    ...lab.records.map(r => ({ key: `reaction-${r.at}`, kind: 'reaction' as const, at: r.at, title: 'Vinagre + bicarbonato', observation: r.observation, summary: `${f(r.result.co2Moles * 1000)} mmol de CO₂`, materials: `${f(r.input.vinegarMl)} mL de vinagre · ${f(r.input.bicarbonateG)} g de bicarbonato`, details: () => reactionDetails(r), annotate: (text: string) => lab.saveObservation(text, r.at) })),
    ...practices.records.map(r => ({ key: r.id, kind: r.kind, at: r.at, title: practiceCatalog[r.kind].title, observation: r.observation, summary: r.kind === 'conductivity' ? `${f(r.result.microSiemens)} µS/cm` : `${f(r.result.newCrystals)} g de cristales nuevos`, materials: r.kind === 'conductivity' ? `${r.input.solution === 'salt' ? 'NaCl' : r.input.solution === 'sugar' ? 'Sacarosa' : 'Agua pura'}${r.input.solution !== 'water' ? ` · ${f(r.input.concentration)} mol/L` : ''}` : `${f(r.input.waterG)} g de agua · ${f(r.input.saltG)} g de sal`, details: () => <PracticeResult session={r}/>, annotate: (text: string) => practices.annotate(r.id, text) })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30).filter(r => filter === 'all' || r.kind === filter);
  const active = records.find(r => r.key === selected) || records[0];
  return <div className="notebook">
    <div className="notebook-intro"><p>Tus observaciones primero. Los cálculos están dentro de cada ensayo, por si quieres revisarlos.</p><label>Mostrar<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos los experimentos</option><option value="reaction">Vinagre + bicarbonato</option><option value="conductivity">Conductividad</option><option value="dissolution">Disolución y cristalización</option></select></label></div>
    {!active ? <div className="empty-notebook"><span>⌁</span><h3>Aquí empieza tu investigación.</h3><p>Completa un experimento en las mesas. Aquí podrás escribir qué observaste y qué aprendiste.</p></div> : <div className="notebook-layout">
      <nav className="notebook-list" aria-label="Ensayos guardados">{records.map((r, i) => <button key={r.key} className={r.key === active.key ? 'active' : ''} aria-current={r.key === active.key ? 'true' : undefined} onClick={() => setSelected(r.key)}><small>ENSAYO {records.length - i}</small><strong>{r.title}</strong><span>{new Date(r.at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</span></button>)}</nav>
      <article className="notebook-page"><h3>{active.title}</h3><div className="notebook-result"><span>RESULTADO PRINCIPAL</span><strong>{active.summary}</strong></div><p className="notebook-materials">{active.materials}</p><label className="observation">Lo que observé<textarea value={active.observation} placeholder="¿Qué cambió? ¿Qué te llamó la atención? Escribe con tus palabras…" onChange={e => active.annotate(e.target.value)}/></label><small className="note-saved">Se guarda al escribir</small><details className="notebook-calculations"><summary>Ver cantidades, cálculos y explicación</summary>{active.details()}</details></article>
    </div>}
  </div>;
}
