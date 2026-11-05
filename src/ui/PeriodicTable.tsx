import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { elements, families, matchesElement } from '../experiments/elements';
import { periodicRows } from '../experiments/periodic';
import './periodic.css';
type View = 'family' | 'mass' | 'electronegativity' | 'state';
const number = (n: number | null, unit = '') => n === null ? 'No disponible' : `${n.toLocaleString('es', { maximumFractionDigits: 6 })}${unit ? ` ${unit}` : ''}`;
export function PeriodicTable() {
  const [selected, setSelected] = useState(1), [query, setQuery] = useState(''), [family, setFamily] = useState(''), [view, setView] = useState<View>('family');
  const refs = useRef(new Map<number, HTMLButtonElement>());
  const element = elements[selected - 1];
  const count = elements.filter(e => matchesElement(e, query, family)).length;
  const navigate = (event: KeyboardEvent, row: number, col: number) => {
    const direction = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[event.key];
    if (!direction) return;
    event.preventDefault();
    let r = row + direction[0], c = col + direction[1];
    while (r >= 0 && r < periodicRows.length && c >= 0 && c < 18) {
      const n = periodicRows[r][c];
      if (n) { setSelected(n); refs.current.get(n)?.focus(); return; }
      r += direction[0]; c += direction[1];
    }
  };
  const background = (n: number) => {
    const e = elements[n - 1];
    if (view === 'family') return families[e.family].color;
    if (view === 'state') return e.state.includes('predicho') ? '#dadbd5' : e.state === 'Gas' ? '#bddcd8' : e.state === 'Líquido' ? '#aecddd' : '#dcd0b8';
    const value = view === 'mass' ? e.mass : e.electronegativity;
    return value === null ? '#dadbd5' : `hsl(${185 - value / (view === 'mass' ? 300 : 4) * 145} 42% 78%)`;
  };
  return <div className="periodic-tool">
    <p>Selecciona un elemento para explorar sus propiedades. Usa las flechas del teclado para moverte por la tabla.</p>
    <div className="periodic-toolbar">
      <label>Buscar elemento<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre, símbolo o número…"/></label>
      <label>Familia<select value={family} onChange={e => setFamily(e.target.value)}><option value="">Todas las familias</option>{Object.entries(families).map(([key, f]) => <option key={key} value={key}>{f.name}</option>)}</select></label>
      <label>Colorear por<select value={view} onChange={e => setView(e.target.value as View)}><option value="family">Familia química</option><option value="mass">Masa atómica</option><option value="electronegativity">Electronegatividad</option><option value="state">Estado de referencia</option></select></label>
    </div>
    <div className="periodic-match" role="status">{count} de 118 elementos coinciden {count === 0 && '· Prueba otro nombre o familia.'}<button className="text-button" onClick={() => { setQuery(''); setFamily(''); }}>Restablecer filtros</button></div>
    <div className="periodic-content">
      <div className="periodic-scroll"><div className="periodic-grid interactive-periodic" aria-label="Tabla de los 118 elementos">
        {Array.from({ length: 18 }, (_, i) => <span key={`g${i}`} className="group-number" aria-label={`Grupo ${i + 1}`}>{i + 1}</span>)}
        {periodicRows.flatMap((row, r) => row.map((n, c) => n ? <button key={n} type="button" ref={el => { if (el) refs.current.set(n, el); else refs.current.delete(n); }} tabIndex={n === selected ? 0 : -1} className={`element ${n === selected ? 'chosen' : ''} ${matchesElement(elements[n - 1], query, family) ? '' : 'dimmed'}`} style={{ '--element-bg': background(n) } as CSSProperties} aria-label={`${n} ${elements[n - 1].name} ${elements[n - 1].symbol}`} aria-pressed={n === selected} onClick={() => setSelected(n)} onKeyDown={e => navigate(e, r, c)}>
          <small>{n}</small><strong>{elements[n - 1].symbol}</strong><span>{elements[n - 1].name}</span><small>{view === 'electronegativity' ? number(elements[n - 1].electronegativity) : number(elements[n - 1].mass)}</small>
        </button> : <span key={`${r}-${c}`} className="periodic-gap">{c === 2 && (r === 5 ? '57–71 ↓' : r === 6 ? '89–103 ↓' : '')}</span>))}
      </div><p className="periodic-series">Filas inferiores: lantánidos (período 6) y actínidos (período 7).</p></div>
      <aside className="element-detail" aria-live="polite" aria-label="Propiedades del elemento seleccionado">
        <div className="element-id" style={{ background: families[element.family].color }}><span>{element.number}</span><strong>{element.symbol}</strong><h3>{element.name}</h3><small>{families[element.family].name}</small></div>
        <dl>
          <div><dt>Masa atómica de referencia</dt><dd>{number(element.mass, 'u')}</dd></div>
          <div><dt>Grupo / período</dt><dd>{element.group ?? 'Serie f'} / {element.period}</dd></div>
          <div><dt>Electronegatividad (Pauling)</dt><dd>{number(element.electronegativity)}</dd></div>
          <div><dt>Estado de referencia</dt><dd>{element.state}</dd></div>
          <div><dt>Radio atómico</dt><dd>{number(element.radius, 'pm')}</dd></div>
          <div><dt>Primera ionización</dt><dd>{number(element.ionization, 'eV')}</dd></div>
          <div><dt>Fusión / ebullición</dt><dd>{number(element.melting, 'K')} / {number(element.boiling, 'K')}</dd></div>
          <div><dt>Densidad de referencia</dt><dd>{number(element.density, 'g/cm³')}</dd></div>
          <div className="detail-full"><dt>Configuración electrónica</dt><dd>{element.configuration || 'No disponible'}</dd></div>
          <div className="detail-full"><dt>Estados de oxidación</dt><dd>{element.oxidation || 'No disponible'}</dd></div>
        </dl>
        <a href={`https://pubchem.ncbi.nlm.nih.gov/element/${element.number}`} target="_blank" rel="noreferrer">Consultar {element.name} en PubChem ↗</a>
      </aside>
    </div>
    <div className="periodic-legend">{view === 'family' ? Object.entries(families).map(([key, f]) => <button key={key} className={family === key ? 'active' : ''} onClick={() => setFamily(family === key ? '' : key)}><i style={{ background: f.color }}/>{f.name}</button>) : <span>{view === 'state' ? 'Sólido: arena · Líquido: azul · Gas: verde · Predicho: gris.' : 'La escala de color aumenta con el valor. Gris: dato no disponible.'}</span>}</div>
  </div>;
}
