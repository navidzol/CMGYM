'use client';

import { useEffect, useState } from 'react';
import { api, requireAuth } from '../../lib/api';

interface User {
  id: string;
  email: string;
  display_name: string;
  unit_pref: string;
}

interface Programme {
  id: string;
  sessions_per_week: number;
  session_duration_min: number;
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
    exercises: { exercise_name: string; sets: number; reps: number; injury_warning?: string }[];
    cardio: { exercise_name: string } | null;
    total_estimated_min: number;
  };
}

interface WorkoutSession {
  id: string;
  started_at: string;
  finished_at: string | null;
  mode: string;
  schedule_json: any;
  session_date: string;
}

interface PR {
  exercise_name: string;
  value: number;
  achieved_at: string;
}

interface PoolEntry {
  id: string;
  exercise_id: string;
  exercise_name: string;
}

const FAMILIES = [
  { code: 'F1', name: 'Upper Front', color: '#E84F4F' },
  { code: 'F2', name: 'Upper Back', color: '#4F8DE8' },
  { code: 'F3', name: 'Core Front', color: '#E8A84F' },
  { code: 'F4', name: 'Core Back', color: '#4FE8A8' },
  { code: 'F5', name: 'Lower Front', color: '#A84FE8' },
  { code: 'F6', name: 'Lower Back', color: '#E8E84F' },
];

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [prs, setPrs] = useState<PR[]>([]);
  const [pool, setPool] = useState<PoolEntry[]>([]);
  const [activeProgramme, setActiveProgramme] = useState<Programme | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [dbSeeded, setDbSeeded] = useState(false);

  // Custom session state
  const [showCustom, setShowCustom] = useState(false);
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [customDuration, setCustomDuration] = useState(45);
  const [customCardio, setCustomCardio] = useState(10);

  useEffect(() => {
    const token = requireAuth();
    Promise.all([
      api<User>('/users/me', { token }),
      api<Programme[]>('/programmes?limit=5', { token }).catch(() => []),
      api<WorkoutSession[]>('/sessions?limit=5', { token }).catch(() => []),
      api<PR[]>('/records?limit=5', { token }).catch(() => []),
      api<PoolEntry[]>('/pools', { token }).catch(() => []),
      api<any>('/exercises?limit=1', { token }).then(r => {
        const list = Array.isArray(r) ? r : (r.data || []);
        return list.length > 0;
      }).catch(() => false),
    ]).then(([u, p, s, r, pl, seeded]) => {
      setUser(u);
      const progs = Array.isArray(p) ? p : [];
      setProgrammes(progs);
      setSessions(Array.isArray(s) ? s : []);
      setPrs(Array.isArray(r) ? r : []);
      setPool(Array.isArray(pl) ? pl : []);
      setDbSeeded(seeded);

      // Load active programme with sessions
      const active = progs.find(p => p.is_active);
      if (active) {
        api<Programme>(`/programmes/${active.id}`, { token })
          .then(full => setActiveProgramme(full))
          .catch(() => setActiveProgramme(active));
      }
    }).catch(() => {
      window.location.href = '/login';
    }).finally(() => setLoading(false));
  }, []);

  async function startSession(generatedSessionId: string) {
    setStarting(true);
    try {
      const workout = await api<any>('/sessions', {
        method: 'POST',
        body: { generated_session_id: generatedSessionId, mode: 'standard' },
      });
      window.location.href = `/workout?session=${workout.id}`;
    } catch (e: any) {
      alert(e.message);
      setStarting(false);
    }
  }

  async function createCustomSession() {
    if (selectedFamilies.length === 0) return;
    setStarting(true);
    try {
      const res = await api<any>('/custom-sessions/generate', {
        method: 'POST',
        body: { selected_families: selectedFamilies, duration_min: customDuration, cardio_min: customCardio },
      });
      const workout = await api<any>('/custom-sessions/start', {
        method: 'POST',
        body: { custom_session_id: res.id },
      });
      window.location.href = `/workout?session=${workout.id}`;
    } catch (e: any) {
      alert(e.message);
      setStarting(false);
    }
  }

  function toggleFamily(code: string) {
    setSelectedFamilies(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  }

  if (loading) return <Main><p style={{ color: 'var(--text-muted)' }}>Loading...</p></Main>;
  if (!user) return null;

  const inProgress = sessions.find(s => !s.finished_at);
  const completedSessions = sessions.filter(s => s.finished_at);

  // Onboarding: determine setup progress
  const setupSteps = [
    { done: dbSeeded, label: 'Seed exercise database', href: '/exercises', desc: 'Import exercises from ExerciseDB so you have workouts to choose from.' },
    { done: pool.length > 0, label: 'Build your exercise pool', href: '/exercises', desc: 'Pick exercises you want in your workouts.' },
    { done: programmes.length > 0, label: 'Create a programme', href: '/programme', desc: 'Set how many days per week and how long each session should be.' },
  ];
  const setupComplete = setupSteps.every(s => s.done);
  const nextStep = setupSteps.find(s => !s.done);

  // Find today's or next upcoming session from active programme
  const today = new Date().toISOString().split('T')[0];
  const todaySession = activeProgramme?.sessions?.find(s => s.session_date === today);
  const upcomingSessions = activeProgramme?.sessions
    ?.filter(s => s.session_date >= today)
    ?.sort((a, b) => a.session_date.localeCompare(b.session_date))
    ?.slice(0, 3) || [];

  return (
    <Main>
      {/* Welcome */}
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
        Welcome back, <span style={{ color: 'var(--accent)' }}>{user.display_name}</span>
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        {setupComplete
          ? (inProgress ? 'You have a workout in progress.' : "Here's what's on your schedule.")
          : 'Let\u2019s get you set up.'}
      </p>

      {/* In-progress workout banner */}
      {inProgress && (
        <a href={`/workout?session=${inProgress.id}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          ...cardStyle, marginBottom: '1.5rem', padding: '1.25rem',
          borderLeft: '4px solid var(--warning)', cursor: 'pointer', textDecoration: 'none', color: 'var(--text-primary)',
        }}>
          <div>
            <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Workout in progress</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Started {new Date(inProgress.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <span style={{
            backgroundColor: 'var(--warning)', color: '#fff', padding: '0.5rem 1.25rem',
            borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem',
          }}>
            Resume
          </span>
        </a>
      )}

      {/* Onboarding steps — shown until setup is complete */}
      {!setupComplete && (
        <div style={{ ...cardStyle, marginBottom: '1.5rem', padding: '1.5rem' }}>
          <h2 style={{ fontWeight: 600, marginBottom: '0.25rem', fontSize: '1rem' }}>Getting started</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
            Complete these steps to generate your first workout programme.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {setupSteps.map((step, i) => (
              <a
                key={i}
                href={step.done ? undefined : step.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.875rem 1rem', borderRadius: '10px',
                  backgroundColor: step.done ? 'rgba(79,232,168,0.08)' : (nextStep === step ? 'rgba(91,79,232,0.08)' : 'var(--bg-input)'),
                  border: nextStep === step ? '1px solid var(--accent)' : '1px solid var(--border)',
                  textDecoration: 'none', color: 'var(--text-primary)',
                  opacity: step.done ? 0.6 : 1,
                  cursor: step.done ? 'default' : 'pointer',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: step.done ? 'var(--accent-secondary)' : (nextStep === step ? 'var(--accent)' : 'var(--bg-card)'),
                  color: step.done || nextStep === step ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.75rem', fontWeight: 700,
                  border: step.done || nextStep === step ? 'none' : '1px solid var(--border)',
                }}>
                  {step.done ? '\u2713' : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem', textDecoration: step.done ? 'line-through' : 'none' }}>
                    {step.label}
                  </p>
                  {!step.done && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.125rem' }}>{step.desc}</p>
                  )}
                </div>
                {nextStep === step && (
                  <span style={{
                    backgroundColor: 'var(--accent)', color: '#fff', padding: '0.375rem 0.875rem',
                    borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
                  }}>
                    Start
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Today's / upcoming workouts — shown after setup */}
      {setupComplete && !inProgress && (
        <>
          {todaySession ? (
            <div style={{ ...cardStyle, marginBottom: '1.5rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>
                    Today's Workout
                  </p>
                  <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                    Week {todaySession.week_number}, Day {todaySession.day_number}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    ~{todaySession.schedule_json.total_estimated_min} min
                  </p>
                </div>
                <button
                  onClick={() => startSession(todaySession.id)}
                  disabled={starting}
                  style={{
                    ...bigBtnStyle, backgroundColor: 'var(--accent)',
                    opacity: starting ? 0.7 : 1, minWidth: '140px',
                  }}
                >
                  {starting ? 'Starting...' : 'Start Workout'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {todaySession.schedule_json.families.map(f => {
                  const fam = FAMILIES.find(x => x.code === f);
                  return (
                    <span key={f} style={{
                      backgroundColor: fam?.color || '#333', color: '#fff',
                      padding: '0.125rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem',
                    }}>
                      {fam?.name || f}
                    </span>
                  );
                })}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {todaySession.schedule_json.exercises.slice(0, 5).map((ex, i) => (
                  <span key={i} style={{ color: ex.injury_warning ? 'var(--warning)' : undefined }}>
                    {ex.exercise_name} ({ex.sets}x{ex.reps}){i < Math.min(todaySession.schedule_json.exercises.length, 5) - 1 ? ' \u00B7 ' : ''}
                  </span>
                ))}
                {todaySession.schedule_json.exercises.length > 5 && (
                  <span style={{ color: 'var(--text-muted)' }}> +{todaySession.schedule_json.exercises.length - 5} more</span>
                )}
              </div>
            </div>
          ) : upcomingSessions.length > 0 ? (
            <div style={{ ...cardStyle, marginBottom: '1.5rem', padding: '1.5rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                Upcoming Sessions
              </p>
              {upcomingSessions.map(s => (
                <div key={s.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.75rem 0', borderBottom: '1px solid var(--border)',
                }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      Week {s.week_number}, Day {s.day_number}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {new Date(s.session_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' \u00B7 ~'}{s.schedule_json.total_estimated_min} min
                    </p>
                  </div>
                  <button onClick={() => startSession(s.id)} disabled={starting}
                    style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff', fontSize: '0.75rem' }}>
                    Start
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...cardStyle, marginBottom: '1.5rem', padding: '1.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>No upcoming scheduled sessions.</p>
              <a href="/programme" style={{ color: 'var(--accent)', fontSize: '0.875rem' }}>
                Create a new programme
              </a>
            </div>
          )}

          {/* Custom session — inline on dashboard */}
          <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
            <button
              onClick={() => setShowCustom(!showCustom)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', width: '100%',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 0, color: 'var(--text-primary)',
              }}
            >
              <span style={{ fontWeight: 600 }}>Custom Session</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {showCustom ? '\u25B2' : '\u25BC'}
              </span>
            </button>
            {showCustom && (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                  Pick muscle groups and start a quick workout.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
                  {FAMILIES.map(f => (
                    <button key={f.code} onClick={() => toggleFamily(f.code)}
                      style={{
                        ...btnStyle, fontSize: '0.75rem', padding: '0.375rem 0.625rem',
                        backgroundColor: selectedFamilies.includes(f.code) ? f.color : 'var(--bg-card)',
                        color: selectedFamilies.includes(f.code) ? '#fff' : f.color,
                        border: `1px solid ${f.color}`,
                      }}>
                      {f.name}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <label style={labelStyle}>
                    Duration
                    <input type="number" min={15} max={120} value={customDuration}
                      onChange={e => setCustomDuration(+e.target.value)}
                      style={{ ...inputStyle, width: '80px' }} />
                  </label>
                  <label style={labelStyle}>
                    Cardio
                    <input type="number" min={0} max={60} value={customCardio}
                      onChange={e => setCustomCardio(+e.target.value)}
                      style={{ ...inputStyle, width: '80px' }} />
                  </label>
                </div>
                <button
                  onClick={createCustomSession}
                  disabled={starting || selectedFamilies.length === 0}
                  style={{
                    ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff',
                    opacity: selectedFamilies.length === 0 ? 0.5 : 1,
                  }}
                >
                  {starting ? 'Starting...' : 'Generate & Start'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Recent activity */}
      {completedSessions.length > 0 && (
        <Section title="Recent Workouts">
          {completedSessions.slice(0, 5).map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <p style={{ fontSize: '0.875rem' }}>{new Date(s.started_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{s.mode} session</p>
              </div>
              <span style={{ color: 'var(--accent-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>Completed</span>
            </div>
          ))}
        </Section>
      )}

      {prs.length > 0 && (
        <Section title="Recent PRs">
          {prs.slice(0, 5).map((pr, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.875rem' }}>{pr.exercise_name}</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{pr.value.toFixed(1)} kg</span>
            </div>
          ))}
          <a href="/progress" style={{ color: 'var(--accent)', fontSize: '0.8rem', display: 'inline-block', marginTop: '0.5rem' }}>
            View all records
          </a>
        </Section>
      )}
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return <main style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>{children}</main>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  borderRadius: '12px',
  border: '1px solid var(--border)',
  padding: '1.25rem',
};

const bigBtnStyle: React.CSSProperties = {
  padding: '0.75rem 1.5rem',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  fontSize: '0.9rem',
  fontWeight: 700,
  cursor: 'pointer',
};

const btnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '0.875rem',
  backgroundColor: 'var(--bg-card)',
  color: 'var(--text-secondary)',
};

const inputStyle: React.CSSProperties = {
  padding: '0.5rem',
  backgroundColor: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  fontSize: '0.875rem',
  outline: 'none',
  marginTop: '0.25rem',
};

const labelStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: '0.8rem',
};
