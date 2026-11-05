import { create } from 'zustand';
import { conductivity, crystallization, type ConductivityInput, type CrystallizationInput } from '../chemistry/solutions';
import type { PracticeId } from '../experiments/catalog';
type SessionBase = { phase: 'prepared' | 'mixing' | 'mixed' | 'measuring' | 'evaporating' | 'done'; startedAt: number };
export type PracticeSession = SessionBase & ({ kind: 'conductivity'; input: ConductivityInput; result: ReturnType<typeof conductivity> } | { kind: 'dissolution'; input: CrystallizationInput; result: ReturnType<typeof crystallization> });
export type PracticeRecord = PracticeSession & { id: string; at: string; observation: string };
const timers: Partial<Record<PracticeId, ReturnType<typeof setTimeout>>> = {};
function save(records: PracticeRecord[]) { try { localStorage.setItem('experimenta.practices.v1', JSON.stringify(records)); } catch { /* Continue in memory. */ } }
function load(): PracticeRecord[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem('experimenta.practices.v1') || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter(r => r && typeof r.id === 'string' && typeof r.at === 'string' && typeof r.observation === 'string' && ['conductivity', 'dissolution'].includes(r.kind) && r.input && r.result).slice(-30);
  } catch { return []; }
}
interface PracticesState {
  sessions: Partial<Record<PracticeId, PracticeSession>>; records: PracticeRecord[]; error: string;
  prepareConductivity: (input: ConductivityInput) => boolean;
  prepareDissolution: (input: CrystallizationInput) => boolean;
  run: (id: PracticeId) => void; reset: (id: PracticeId) => void; cancelPending: () => void;
  annotate: (id: string, observation: string) => void;
}
export const usePractices = create<PracticesState>((set, get) => {
  const prepare = (session: PracticeSession) => { clearTimeout(timers[session.kind]); set({ sessions: { ...get().sessions, [session.kind]: session }, error: '' }); return true; };
  return {
    sessions: {}, records: load(), error: '',
    prepareConductivity: input => { try { return prepare({ kind: 'conductivity', input: { ...input }, result: conductivity(input), phase: 'prepared', startedAt: 0 }); } catch (e) { set({ error: (e as Error).message }); return false; } },
    prepareDissolution: input => { try { return prepare({ kind: 'dissolution', input: { ...input }, result: crystallization(input), phase: 'prepared', startedAt: 0 }); } catch (e) { set({ error: (e as Error).message }); return false; } },
    run: id => {
      const session = get().sessions[id];
      if (!session || !['prepared', 'mixed'].includes(session.phase)) return;
      const phase = id === 'conductivity' ? 'measuring' : session.phase === 'prepared' ? 'mixing' : 'evaporating';
      const active = { ...session, phase, startedAt: Date.now() } as PracticeSession;
      set({ sessions: { ...get().sessions, [id]: active }, error: '' });
      timers[id] = setTimeout(() => {
        if (get().sessions[id] !== active) return;
        const finished = { ...active, phase: phase === 'mixing' ? 'mixed' : 'done' } as PracticeSession;
        const update: Partial<PracticesState> = { sessions: { ...get().sessions, [id]: finished } };
        if (finished.phase === 'done') {
          const at = new Date().toISOString();
          const records = [...get().records, { ...finished, id: `${id}-${Date.now()}-${get().records.length}`, at, observation: '' }].slice(-30);
          save(records); update.records = records;
        }
        set(update);
      }, phase === 'evaporating' ? 3000 : 1800);
    },
    reset: id => { clearTimeout(timers[id]); const sessions = { ...get().sessions }; delete sessions[id]; set({ sessions, error: '' }); },
    cancelPending: () => { for (const id of ['conductivity', 'dissolution'] as const) clearTimeout(timers[id]); set({ sessions: {}, error: '' }); },
    annotate: (id, observation) => { const records = get().records.map(r => r.id === id ? { ...r, observation } : r); save(records); set({ records }); },
  };
});
