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

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const token = requireAuth();
    Promise.all([
      api<User>('/users/me', { token }),
      api<Programme[]>('/programmes?limit=5', { token }).catch(() => []),
      api<WorkoutSession[]>('/sessions?limit=5', { token }).catch(() => []),
      api<PR[]>('/records?limit=5', { token }).catch(() => []),
    ]).then(([u, p, s, r]) => {
      setUser(u);
      setProgrammes(Array.isArray(p) ? p : []);
      setSessions(Array.isArray(s) ? s : []);
      setPrs(Array.isArray(r) ? r : []);
    }).catch(() => {
      window.location.href = '/login';
    }).finally(() => setLoading(false));
  }, []);

  async function quickStart() {
    setStarting(true);
    try {
      const session = await api<any>('/sessions', {
        method: 'POST',
        body: { mode: 'custom' },
      });
      window.location.href = `/workout?session=${session.id}`;
    } catch (e: any) {
      alert(e.message);
      setStarting(false);
    }
  }

  if (loading) return <Main><p style={{ color: 'var(--text-muted)' }}>Loading...</p></Main>;
  if (!user) return null;

  const activeProgramme = programmes.find(p => p.is_active);
  const inProgress = sessions.find(s => !s.finished_at);

  return (
    <Main>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Welcome, <span style={{ color: 'var(--accent)' }}>{user.display_name}</span>
      </h1>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {inProgress ? (
          <a href={`/workout?session=${inProgress.id}`} style={{ ...bigBtnStyle, backgroundColor: 'var(--warning)' }}>
            Resume Workout
          </a>
        ) : (
          <button onClick={quickStart} disabled={starting}
            style={{ ...bigBtnStyle, backgroundColor: 'var(--accent)', opacity: starting ? 0.7 : 1 }}>
            {starting ? 'Starting...' : 'Quick Start Workout'}
          </button>
        )}
        <a href="/programme?tab=custom" style={{ ...bigBtnStyle, backgroundColor: 'var(--accent-secondary)' }}>
          Custom Session
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <ActionCard href="/programme" title="Programme" desc={activeProgramme ? `${activeProgramme.sessions_per_week}x/week active` : 'Create one'} />
        <ActionCard href="/exercises" title="Exercises" desc="Browse & manage pool" />
        <ActionCard href="/progress" title="Progress" desc="PRs & reports" />
        <ActionCard href="/settings" title="Settings" desc="Preferences" />
      </div>

      <Section title="Recent Workouts">
        {sessions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No workouts yet. Hit "Quick Start" above to begin!</p>
        ) : (
          sessions.map(s => (
            <div key={s.id} style={{ ...cardStyle, marginBottom: '0.5rem', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{new Date(s.started_at).toLocaleDateString()}</span>
                <span style={{ color: s.finished_at ? 'var(--accent-secondary)' : 'var(--warning)', fontSize: '0.875rem' }}>
                  {s.finished_at ? 'Completed' : 'In Progress'}
                </span>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{s.mode} session</span>
              {!s.finished_at && (
                <a href={`/workout?session=${s.id}`} style={{ color: 'var(--accent)', fontSize: '0.875rem', marginLeft: '1rem' }}>Resume</a>
              )}
            </div>
          ))
        )}
      </Section>

      <Section title="Recent PRs">
        {prs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No personal records yet. Start logging sets!</p>
        ) : (
          prs.map((pr, i) => (
            <div key={i} style={{ ...cardStyle, marginBottom: '0.5rem', padding: '1rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>{pr.exercise_name}</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{pr.value.toFixed(1)} kg (est. 1RM)</span>
            </div>
          ))
        )}
      </Section>
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>{children}</main>;
}

function ActionCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a href={href} style={{ ...cardStyle, padding: '1.25rem', textDecoration: 'none', color: 'var(--text-primary)', display: 'block' }}>
      <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{title}</p>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{desc}</p>
    </a>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>{title}</h2>
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  borderRadius: '12px',
  border: '1px solid var(--border)',
};

const bigBtnStyle: React.CSSProperties = {
  padding: '1rem 2rem',
  color: '#fff',
  border: 'none',
  borderRadius: '12px',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
  textAlign: 'center',
  flex: '1',
  minWidth: '180px',
  display: 'block',
};
