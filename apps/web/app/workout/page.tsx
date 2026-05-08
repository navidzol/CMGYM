'use client';

import { useEffect, useState, useRef } from 'react';
import { api, requireAuth } from '../../lib/api';

interface SessionSet {
  id: string;
  exercise_id: string;
  exercise_name: string;
  exercise_type: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  duration_s: number | null;
  distance_m: number | null;
  completed_at: string | null;
}

interface ScheduleExercise {
  exercise_id: string;
  exercise_name: string;
  type: string;
  sets: number;
  reps: number;
  rest_s: number;
  injury_warning?: string;
}

interface SearchResult {
  id: string;
  name: string;
  type: string;
  gif_url?: string;
}

export default function WorkoutPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [sets, setSets] = useState<SessionSet[]>([]);
  const [schedule, setSchedule] = useState<ScheduleExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [prAlert, setPrAlert] = useState('');

  const [currentExercise, setCurrentExercise] = useState<ScheduleExercise | null>(null);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(0);
  const [rpe, setRpe] = useState<number | undefined>(undefined);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const [restTime, setRestTime] = useState(0);
  const [restTarget, setRestTarget] = useState(90);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    requireAuth();
    const params = new URLSearchParams(window.location.search);
    const id = params.get('session');
    if (id) {
      setSessionId(id);
      loadSession(id);
    } else {
      setLoading(false);
      setMsg('No session ID provided. Go to Dashboard to start a workout.');
    }
  }, []);

  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setRestTime(t => t + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive]);

  async function loadSession(id: string) {
    try {
      const res = await api<any>(`/sessions/${id}`);
      setSession(res);
      const setsRes = await api<SessionSet[]>(`/sessions/${id}/sets`);
      setSets(Array.isArray(setsRes) ? setsRes : []);

      if (res.schedule_json) {
        const sched = typeof res.schedule_json === 'string' ? JSON.parse(res.schedule_json) : res.schedule_json;
        const exercises = sched.exercises || [];
        if (sched.cardio) exercises.push(sched.cardio);
        setSchedule(exercises);
        if (exercises.length > 0) {
          setCurrentExercise(exercises[0]);
          setReps(exercises[0].reps || 10);
          setRestTarget(exercises[0].rest_s || 90);
        }
      }
      if (!res.schedule_json) {
        setShowSearch(true);
      }
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function searchExercises() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api<any>(`/exercises?query=${encodeURIComponent(searchQuery)}&limit=10`);
      const localResults = Array.isArray(res) ? res : (res.data || []);
      if (localResults.length > 0) {
        setSearchResults(localResults);
      } else {
        const ext = await api<any>('/exercises/fetch-external', {
          method: 'POST', body: { name: searchQuery, limit: 10 },
        });
        const extResults = Array.isArray(ext) ? ext : (ext.data || []);
        setSearchResults(extResults);
      }
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setSearching(false);
    }
  }

  function addExerciseToWorkout(ex: SearchResult) {
    const newEx: ScheduleExercise = {
      exercise_id: ex.id, exercise_name: ex.name, type: ex.type || 'strength',
      sets: 3, reps: 10, rest_s: 90,
    };
    setSchedule(prev => [...prev, newEx]);
    setCurrentExercise(newEx);
    setReps(10);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  }

  async function logSet() {
    if (!sessionId || !currentExercise) return;
    const setsForExercise = sets.filter(s => s.exercise_id === currentExercise.exercise_id);
    const setNumber = setsForExercise.length + 1;
    try {
      const body: any = { exercise_id: currentExercise.exercise_id, set_number: setNumber, reps };
      if (currentExercise.type === 'strength' && weight > 0) body.weight_kg = weight;
      if (rpe) body.rpe = rpe;
      const res = await api<any>(`/sessions/${sessionId}/sets`, { method: 'POST', body });
      setSets(prev => [...prev, res]);
      if (res.pr_hit) {
        setPrAlert(`New PR! Est. 1RM: ${res.estimated_1rm?.toFixed(1)} kg`);
        setTimeout(() => setPrAlert(''), 5000);
      }
      setRestTime(0);
      setTimerActive(true);
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function finishWorkout() {
    if (!sessionId) return;
    try {
      await api(`/sessions/${sessionId}`, { method: 'PATCH', body: {} });
      window.location.href = '/dashboard';
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  function selectExercise(ex: ScheduleExercise) {
    setCurrentExercise(ex);
    setReps(ex.reps || 10);
    setRestTarget(ex.rest_s || 90);
    setTimerActive(false);
    setRestTime(0);
  }

  if (loading) return <Main><p style={{ color: 'var(--text-muted)' }}>Loading workout...</p></Main>;
  if (!sessionId) return <Main><p style={{ color: 'var(--text-muted)' }}>{msg}</p><a href="/dashboard" style={{ color: 'var(--accent)' }}>Back to Dashboard</a></Main>;

  return (
    <Main>
      {prAlert && (
        <div style={{ backgroundColor: 'var(--accent)', color: '#fff', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', textAlign: 'center', fontWeight: 700 }}>
          {prAlert}
        </div>
      )}
      {msg && <p style={{ color: 'var(--warning)', fontSize: '0.875rem', marginBottom: '1rem' }}>{msg}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Workout</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setShowSearch(!showSearch)}
            style={{ ...btnStyle, backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
            + Add Exercise
          </button>
          <button onClick={finishWorkout}
            style={{ ...btnStyle, backgroundColor: 'var(--accent-secondary)', color: '#000', fontWeight: 600 }}>
            Finish
          </button>
        </div>
      </div>

      {showSearch && (
        <div style={{ ...cardStyle, marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input placeholder="Search exercises (e.g. bench press, squat...)" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchExercises()}
              style={{ ...inputStyle, flex: 1 }} autoFocus />
            <button onClick={searchExercises} disabled={searching}
              style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff' }}>
              {searching ? '...' : 'Search'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {searchResults.map(ex => (
                <div key={ex.id} onClick={() => addExerciseToWorkout(ex)}
                  style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {ex.gif_url && <img src={ex.gif_url} alt="" style={{ width: 32, height: 32, borderRadius: 4 }} />}
                  <span style={{ fontSize: '0.875rem' }}>{ex.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: 'auto' }}>{ex.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <h2 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Exercises</h2>
          {schedule.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No exercises yet. Use "Add Exercise" above to search and add exercises to your workout.</p>
          )}
          {schedule.map((ex, i) => {
            const setsForEx = sets.filter(s => s.exercise_id === ex.exercise_id);
            const isActive = currentExercise?.exercise_id === ex.exercise_id;
            return (
              <div key={`${ex.exercise_id}-${i}`} onClick={() => selectExercise(ex)}
                style={{
                  ...cardStyle, marginBottom: '0.5rem', cursor: 'pointer',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                  opacity: setsForEx.length >= ex.sets ? 0.5 : 1,
                  borderLeft: ex.injury_warning ? '3px solid var(--warning)' : undefined,
                }}>
                <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{ex.exercise_name}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {setsForEx.length}/{ex.sets} sets &middot; {ex.type}
                </p>
                {ex.injury_warning && (
                  <p style={{ color: 'var(--warning)', fontSize: '0.7rem', marginTop: '0.25rem' }}>{ex.injury_warning}</p>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ flex: '2', minWidth: '300px' }}>
          {timerActive && (
            <div style={{
              ...cardStyle, marginBottom: '1rem', textAlign: 'center',
              borderColor: restTime >= restTarget ? 'var(--accent-secondary)' : 'var(--border)',
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>REST</p>
              <p style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'monospace', color: restTime >= restTarget ? 'var(--accent-secondary)' : 'var(--text-primary)' }}>
                {Math.floor(restTime / 60)}:{String(restTime % 60).padStart(2, '0')}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Target: {restTarget}s</p>
              <button onClick={() => { setTimerActive(false); setRestTime(0); }}
                style={{ ...btnStyle, marginTop: '0.5rem', fontSize: '0.75rem' }}>Skip Rest</button>
            </div>
          )}

          {currentExercise && (
            <div style={cardStyle}>
              <h2 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{currentExercise.exercise_name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Target: {currentExercise.sets} sets x {currentExercise.reps} reps
              </p>

              {sets.filter(s => s.exercise_id === currentExercise.exercise_id).length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Logged sets:</p>
                  {sets.filter(s => s.exercise_id === currentExercise.exercise_id).map(s => (
                    <p key={s.id} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Set {s.set_number}: {s.reps} reps {s.weight_kg ? `@ ${s.weight_kg}kg` : ''} {s.rpe ? `RPE ${s.rpe}` : ''}
                    </p>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <label style={labelStyle}>
                  Reps
                  <input type="number" min={0} value={reps} onChange={e => setReps(+e.target.value)} style={{ ...inputStyle, width: '80px' }} />
                </label>
                {currentExercise.type === 'strength' && (
                  <label style={labelStyle}>
                    Weight (kg)
                    <input type="number" min={0} step={0.5} value={weight} onChange={e => setWeight(+e.target.value)} style={{ ...inputStyle, width: '100px' }} />
                  </label>
                )}
                <label style={labelStyle}>
                  RPE (1-10)
                  <input type="number" min={1} max={10} value={rpe || ''} onChange={e => setRpe(e.target.value ? +e.target.value : undefined)} style={{ ...inputStyle, width: '80px' }} />
                </label>
              </div>

              <button onClick={logSet} style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff', width: '100%', padding: '0.75rem' }}>
                Log Set {sets.filter(s => s.exercise_id === currentExercise.exercise_id).length + 1}
              </button>
            </div>
          )}

          {!currentExercise && schedule.length > 0 && (
            <div style={cardStyle}>
              <p style={{ color: 'var(--text-muted)' }}>Select an exercise from the list to start logging.</p>
            </div>
          )}
        </div>
      </div>
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>{children}</main>;
}

const inputStyle: React.CSSProperties = {
  padding: '0.625rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border)', borderRadius: '8px', fontSize: '1rem', outline: 'none', marginTop: '0.25rem',
};

const btnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: '8px',
  cursor: 'pointer', fontSize: '0.875rem', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '1rem',
};

const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: '0.875rem' };
