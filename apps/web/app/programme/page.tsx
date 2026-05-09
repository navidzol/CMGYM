'use client';

import { useEffect, useState } from 'react';
import { api, requireAuth } from '../../lib/api';

const FAMILIES = [
  { code: 'F1', name: 'Upper Front', color: '#E84F4F' },
  { code: 'F2', name: 'Upper Back', color: '#4F8DE8' },
  { code: 'F3', name: 'Core Front', color: '#E8A84F' },
  { code: 'F4', name: 'Core Back', color: '#4FE8A8' },
  { code: 'F5', name: 'Lower Front', color: '#A84FE8' },
  { code: 'F6', name: 'Lower Back', color: '#E8E84F' },
];

interface Programme {
  id: string; weeks: number; sessions_per_week: number; session_duration_min: number;
  cardio_duration_min: number; is_active: boolean; created_at: string; sessions?: GeneratedSession[];
}
interface GeneratedSession {
  id: string; week_number: number; day_number: number; session_date: string;
  schedule_json: { families: string[]; exercises: ScheduleExercise[]; cardio: ScheduleExercise | null; total_estimated_min: number; warnings?: any[] };
}
interface ScheduleExercise {
  exercise_id: string; exercise_name: string; family_code: string | null; type: string;
  sets: number; reps: number; rest_s: number; estimated_duration_s: number; injury_warning?: string;
}

export default function ProgrammePage() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [selectedProgramme, setSelectedProgramme] = useState<Programme | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [weeks, setWeeks] = useState(1);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [durationMin, setDurationMin] = useState(50);
  const [cardioMin, setCardioMin] = useState(10);

  useEffect(() => { requireAuth(); loadProgrammes(); }, []);

  async function loadProgrammes() {
    setLoading(true);
    try {
      const res = await api<Programme[]>('/programmes');
      const progs = Array.isArray(res) ? res : [];
      setProgrammes(progs);
      // Auto-select active programme
      const active = progs.find(p => p.is_active);
      if (active) viewProgramme(active.id);
    } catch { setProgrammes([]); }
    setLoading(false);
  }

  async function viewProgramme(id: string) {
    try { const res = await api<Programme>(`/programmes/${id}`); setSelectedProgramme(res); }
    catch (e: any) { setMsg(e.message); }
  }

  async function createProgramme() {
    setMsg(''); setCreating(true);
    try {
      const prog = await api<Programme>('/programmes', {
        method: 'POST', body: { weeks, sessions_per_week: sessionsPerWeek, session_duration_min: durationMin, cardio_duration_min: cardioMin },
      });
      setMsg('Generating sessions...');
      const genRes = await api<{ sessions_generated: number }>(`/programmes/${prog.id}/generate`, { method: 'POST' });
      setMsg(`Created with ${genRes.sessions_generated} sessions!`);
      setShowCreate(false);
      await loadProgrammes();
      await viewProgramme(prog.id);
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    finally { setCreating(false); }
  }

  async function startSession(generatedSessionId: string) {
    try {
      const workout = await api<any>('/sessions', { method: 'POST', body: { generated_session_id: generatedSessionId, mode: 'standard' } });
      window.location.href = `/workout?session=${workout.id}`;
    } catch (e: any) { setMsg(e.message); }
  }

  async function deleteProgramme(id: string) {
    try {
      await api(`/programmes/${id}`, { method: 'DELETE' });
      setSelectedProgramme(null); await loadProgrammes(); setMsg('Programme deleted');
    } catch (e: any) { setMsg(e.message); }
  }

  if (loading) return <Main><p style={{ color: 'var(--text-muted)' }}>Loading...</p></Main>;

  return (
    <Main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.125rem' }}>Programme</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Your training plans and generated sessions.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff' }}>
          {showCreate ? 'Close' : '+ New'}
        </button>
      </div>

      {msg && (
        <div style={{
          backgroundColor: 'rgba(91,79,232,0.1)', border: '1px solid var(--accent)',
          borderRadius: '8px', padding: '0.625rem 1rem', marginBottom: '1rem',
          color: 'var(--accent)', fontSize: '0.85rem',
        }}>
          {msg}
        </div>
      )}

      {/* Create form — expandable */}
      {showCreate && (
        <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <h2 style={{ fontWeight: 600, marginBottom: '1rem', fontSize: '1rem' }}>New Programme</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <label style={labelStyle}>Weeks<input type="number" min={1} max={52} value={weeks} onChange={e => setWeeks(+e.target.value)} style={inputStyle} /></label>
            <label style={labelStyle}>Sessions / week<input type="number" min={1} max={7} value={sessionsPerWeek} onChange={e => setSessionsPerWeek(+e.target.value)} style={inputStyle} /></label>
            <label style={labelStyle}>Duration (min)<input type="number" min={15} max={120} value={durationMin} onChange={e => setDurationMin(+e.target.value)} style={inputStyle} /></label>
            <label style={labelStyle}>Cardio (min)<input type="number" min={0} max={60} value={cardioMin} onChange={e => setCardioMin(+e.target.value)} style={inputStyle} /></label>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
            Make sure you have exercises in your pool first. The algorithm distributes muscle families evenly across sessions.
          </p>
          <button onClick={createProgramme} disabled={creating}
            style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff', opacity: creating ? 0.7 : 1 }}>
            {creating ? 'Creating...' : 'Create & Generate'}
          </button>
        </div>
      )}

      {/* Programme list + detail */}
      {programmes.length === 0 && !showCreate ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No programmes yet</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Create a programme to automatically generate workout sessions based on your exercise pool.
          </p>
          <button onClick={() => setShowCreate(true)} style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff' }}>
            Create Your First Programme
          </button>
        </div>
      ) : programmes.length > 0 && (
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
          {/* Programme list */}
          <div style={{ minWidth: '220px', flex: '0 0 auto' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
              Your Programmes
            </p>
            {programmes.map(p => (
              <div key={p.id} onClick={() => viewProgramme(p.id)}
                style={{
                  ...cardStyle, marginBottom: '0.375rem', cursor: 'pointer', padding: '0.875rem',
                  border: selectedProgramme?.id === p.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.sessions_per_week}x/week \u00B7 {p.session_duration_min}min</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                      {p.weeks} week{p.weeks > 1 ? 's' : ''} \u00B7 {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {p.is_active && (
                    <span style={{
                      color: 'var(--accent-secondary)', fontSize: '0.65rem', fontWeight: 600,
                      backgroundColor: 'rgba(79,232,168,0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px',
                    }}>ACTIVE</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Session detail */}
          {selectedProgramme && (
            <div style={{ flex: '1', minWidth: '300px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Sessions ({selectedProgramme.sessions?.length || 0})
                </p>
                <button onClick={() => deleteProgramme(selectedProgramme.id)}
                  style={{ ...btnStyle, color: 'var(--warning)', fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}>
                  Delete
                </button>
              </div>

              {(!selectedProgramme.sessions || selectedProgramme.sessions.length === 0) ? (
                <p style={{ color: 'var(--text-muted)' }}>No sessions generated.</p>
              ) : selectedProgramme.sessions.map(s => (
                <div key={s.id} style={{ ...cardStyle, marginBottom: '0.5rem', padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Week {s.week_number}, Day {s.day_number}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        {new Date(s.session_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' \u00B7 ~'}{s.schedule_json.total_estimated_min}min
                      </p>
                    </div>
                    <button onClick={() => startSession(s.id)}
                      style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff', fontSize: '0.75rem' }}>
                      Start
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    {s.schedule_json.families.map(f => {
                      const fam = FAMILIES.find(x => x.code === f);
                      return <span key={f} style={{ backgroundColor: fam?.color || '#333', color: '#fff', padding: '0.125rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem' }}>{fam?.name || f}</span>;
                    })}
                  </div>
                  {s.schedule_json.warnings && s.schedule_json.warnings.length > 0 && (
                    <p style={{ color: 'var(--warning)', fontSize: '0.7rem', marginBottom: '0.375rem' }}>
                      Injury warnings: {s.schedule_json.warnings.map((w: any) => w.exercise_name).join(', ')}
                    </p>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {s.schedule_json.exercises.map((ex, i) => (
                      <div key={i} style={{ padding: '0.2rem 0', borderBottom: '1px solid var(--border)', color: ex.injury_warning ? 'var(--warning)' : undefined }}>
                        {ex.exercise_name} \u2014 {ex.sets}x{ex.reps}
                      </div>
                    ))}
                    {s.schedule_json.cardio && (
                      <div style={{ padding: '0.2rem 0', color: '#E8A84F' }}>Cardio: {s.schedule_json.cardio.exercise_name}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>{children}</main>;
}

const inputStyle: React.CSSProperties = {
  padding: '0.625rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', width: '100%', marginTop: '0.25rem',
};
const btnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: '8px',
  cursor: 'pointer', fontSize: '0.875rem', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)',
};
const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '1.25rem',
};
const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column' };
