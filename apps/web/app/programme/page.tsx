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
  id: string;
  weeks: number;
  sessions_per_week: number;
  session_duration_min: number;
  cardio_duration_min: number;
  is_active: boolean;
  created_at: string;
  sessions?: GeneratedSession[];
}

interface GeneratedSession {
  id: string;
  week_number: number;
  day_number: number;
  session_date: string;
  schedule_json: {
    families: string[];
    exercises: ScheduleExercise[];
    cardio: ScheduleExercise | null;
    total_estimated_min: number;
  };
}

interface ScheduleExercise {
  exercise_id: string;
  exercise_name: string;
  family_code: string | null;
  type: string;
  sets: number;
  reps: number;
  rest_s: number;
  estimated_duration_s: number;
}

export default function ProgrammePage() {
  const [tab, setTab] = useState<'view' | 'create' | 'custom'>('view');
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [selectedProgramme, setSelectedProgramme] = useState<Programme | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Create form
  const [weeks, setWeeks] = useState(1);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [durationMin, setDurationMin] = useState(50);
  const [cardioMin, setCardioMin] = useState(10);

  // Custom session form
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [customDuration, setCustomDuration] = useState(45);
  const [customCardio, setCustomCardio] = useState(10);

  useEffect(() => { requireAuth(); loadProgrammes(); }, []);

  async function loadProgrammes() {
    setLoading(true);
    try {
      const res = await api<Programme[]>('/programmes');
      setProgrammes(Array.isArray(res) ? res : []);
    } catch { setProgrammes([]); }
    setLoading(false);
  }

  async function viewProgramme(id: string) {
    try {
      const res = await api<Programme>(`/programmes/${id}`);
      setSelectedProgramme(res);
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function createProgramme() {
    setMsg('');
    try {
      const prog = await api<Programme>('/programmes', {
        method: 'POST',
        body: { weeks, sessions_per_week: sessionsPerWeek, session_duration_min: durationMin, cardio_duration_min: cardioMin },
      });
      setMsg('Programme created! Generating sessions...');
      const genRes = await api<{ sessions_generated: number }>(`/programmes/${prog.id}/generate`, { method: 'POST' });
      setMsg(`Programme created with ${genRes.sessions_generated} sessions!`);
      await loadProgrammes();
      await viewProgramme(prog.id);
      setTab('view');
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    }
  }

  async function createCustomSession() {
    if (selectedFamilies.length === 0) { setMsg('Select at least one muscle family'); return; }
    setMsg('');
    try {
      const res = await api<any>('/custom-sessions/generate', {
        method: 'POST',
        body: { selected_families: selectedFamilies, duration_min: customDuration, cardio_min: customCardio },
      });
      // Start workout from custom session
      const workout = await api<any>('/custom-sessions/start', {
        method: 'POST',
        body: { custom_session_id: res.id },
      });
      window.location.href = `/workout?session=${workout.id}`;
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    }
  }

  async function startSession(generatedSessionId: string) {
    try {
      const workout = await api<any>('/sessions', {
        method: 'POST',
        body: { generated_session_id: generatedSessionId, mode: 'standard' },
      });
      window.location.href = `/workout?session=${workout.id}`;
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function deleteProgramme(id: string) {
    try {
      await api(`/programmes/${id}`, { method: 'DELETE' });
      setSelectedProgramme(null);
      await loadProgrammes();
      setMsg('Programme deleted');
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  function toggleFamily(code: string) {
    setSelectedFamilies(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  }

  return (
    <Main>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Programme</h1>
      {msg && <p style={{ color: '#5B4FE8', fontSize: '0.875rem', marginBottom: '1rem' }}>{msg}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(['view', 'create', 'custom'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setMsg(''); }}
            style={{ ...btnStyle, backgroundColor: tab === t ? '#5B4FE8' : '#1A1A2E', color: tab === t ? '#fff' : '#6B6B8A' }}>
            {t === 'view' ? 'My Programmes' : t === 'create' ? 'New Programme' : 'Quick Session'}
          </button>
        ))}
      </div>

      {/* View Tab */}
      {tab === 'view' && (
        loading ? <p style={{ color: '#6B6B8A' }}>Loading...</p> : (
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Programme list */}
            <div style={{ flex: '1', minWidth: '250px' }}>
              {programmes.length === 0 ? (
                <p style={{ color: '#6B6B8A' }}>No programmes yet. Create one to get started.</p>
              ) : programmes.map(p => (
                <div key={p.id} onClick={() => viewProgramme(p.id)}
                  style={{ ...cardStyle, marginBottom: '0.5rem', cursor: 'pointer',
                    border: selectedProgramme?.id === p.id ? '1px solid #5B4FE8' : '1px solid #2D2D44' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 600 }}>{p.sessions_per_week}x/week &middot; {p.session_duration_min}min</p>
                      <p style={{ color: '#6B6B8A', fontSize: '0.75rem' }}>{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    {p.is_active && <span style={{ color: '#4FE8A8', fontSize: '0.75rem', fontWeight: 600 }}>ACTIVE</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Session details */}
            {selectedProgramme && (
              <div style={{ flex: '2', minWidth: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Sessions</h2>
                  <button onClick={() => deleteProgramme(selectedProgramme.id)}
                    style={{ ...btnStyle, color: '#F97316', fontSize: '0.75rem' }}>Delete Programme</button>
                </div>
                {(!selectedProgramme.sessions || selectedProgramme.sessions.length === 0) ? (
                  <p style={{ color: '#6B6B8A' }}>No sessions generated yet.</p>
                ) : selectedProgramme.sessions.map(s => (
                  <div key={s.id} style={{ ...cardStyle, marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <p style={{ fontWeight: 600 }}>Week {s.week_number}, Day {s.day_number}</p>
                        <p style={{ color: '#6B6B8A', fontSize: '0.75rem' }}>{s.session_date} &middot; ~{s.schedule_json.total_estimated_min}min</p>
                      </div>
                      <button onClick={() => startSession(s.id)}
                        style={{ ...btnStyle, backgroundColor: '#5B4FE8', color: '#fff', fontSize: '0.75rem' }}>
                        Start Workout
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      {s.schedule_json.families.map(f => {
                        const fam = FAMILIES.find(x => x.code === f);
                        return <span key={f} style={{ backgroundColor: fam?.color || '#333', color: '#fff', padding: '0.125rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem' }}>{fam?.name || f}</span>;
                      })}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#9B9BB0' }}>
                      {s.schedule_json.exercises.map((ex, i) => (
                        <div key={i} style={{ padding: '0.25rem 0', borderBottom: '1px solid #2D2D44' }}>
                          {ex.exercise_name} — {ex.sets}x{ex.reps}
                        </div>
                      ))}
                      {s.schedule_json.cardio && (
                        <div style={{ padding: '0.25rem 0', color: '#E8A84F' }}>
                          Cardio: {s.schedule_json.cardio.exercise_name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* Create Tab */}
      {tab === 'create' && (
        <div style={cardStyle}>
          <h2 style={{ fontWeight: 600, marginBottom: '1rem' }}>New Programme</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={labelStyle}>
              Weeks
              <input type="number" min={1} max={52} value={weeks} onChange={e => setWeeks(+e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Sessions per week
              <input type="number" min={1} max={7} value={sessionsPerWeek} onChange={e => setSessionsPerWeek(+e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Session duration (min)
              <input type="number" min={15} max={120} value={durationMin} onChange={e => setDurationMin(+e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Cardio duration (min)
              <input type="number" min={0} max={60} value={cardioMin} onChange={e => setCardioMin(+e.target.value)} style={inputStyle} />
            </label>
            <button onClick={createProgramme} style={{ ...btnStyle, backgroundColor: '#5B4FE8', color: '#fff' }}>
              Create & Generate Sessions
            </button>
            <p style={{ color: '#6B6B8A', fontSize: '0.75rem' }}>
              Make sure you have exercises in your pool first. The algorithm will distribute muscle families evenly across sessions.
            </p>
          </div>
        </div>
      )}

      {/* Custom Session Tab */}
      {tab === 'custom' && (
        <div style={cardStyle}>
          <h2 style={{ fontWeight: 600, marginBottom: '1rem' }}>Quick Custom Session</h2>
          <p style={{ color: '#6B6B8A', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Pick muscle families and start a workout immediately.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {FAMILIES.map(f => (
              <button key={f.code} onClick={() => toggleFamily(f.code)}
                style={{
                  ...btnStyle,
                  backgroundColor: selectedFamilies.includes(f.code) ? f.color : '#1A1A2E',
                  color: selectedFamilies.includes(f.code) ? '#fff' : f.color,
                  border: `1px solid ${f.color}`,
                }}>
                {f.name}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <label style={labelStyle}>
              Duration (min)
              <input type="number" min={15} max={120} value={customDuration} onChange={e => setCustomDuration(+e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Cardio (min)
              <input type="number" min={0} max={60} value={customCardio} onChange={e => setCustomCardio(+e.target.value)} style={inputStyle} />
            </label>
          </div>
          <button onClick={createCustomSession} style={{ ...btnStyle, backgroundColor: '#5B4FE8', color: '#fff' }}>
            Generate & Start Workout
          </button>
        </div>
      )}
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>{children}</main>;
}

const inputStyle: React.CSSProperties = {
  padding: '0.625rem',
  backgroundColor: '#0d0d1a',
  color: '#fff',
  border: '1px solid #2D2D44',
  borderRadius: '8px',
  fontSize: '0.875rem',
  outline: 'none',
  width: '100%',
  marginTop: '0.25rem',
};

const btnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  border: '1px solid #2D2D44',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '0.875rem',
  backgroundColor: '#1A1A2E',
  color: '#9B9BB0',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#1A1A2E',
  borderRadius: '12px',
  border: '1px solid #2D2D44',
  padding: '1.5rem',
};

const labelStyle: React.CSSProperties = {
  color: '#9B9BB0',
  fontSize: '0.875rem',
  display: 'flex',
  flexDirection: 'column',
};
