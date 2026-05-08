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

interface Exercise {
  id: string; name: string; type: string; gif_url?: string;
  family_code?: string; family_name?: string; muscle_family_id?: string;
}

interface PoolEntry {
  id: string; exercise_id: string; exercise_name: string; type: string; muscle_family_id?: string;
}

export default function ExercisesPage() {
  const [tab, setTab] = useState<'browse' | 'pool' | 'seed'>('browse');
  const [query, setQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [pool, setPool] = useState<PoolEntry[]>([]);
  const [meta, setMeta] = useState({ page: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [seedStatus, setSeedStatus] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { requireAuth(); }, []);
  useEffect(() => {
    if (tab === 'browse') searchExercises();
    if (tab === 'pool') loadPool();
  }, [tab]);

  async function searchExercises(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (query) params.set('query', query);
      if (familyFilter) params.set('family', familyFilter);
      if (typeFilter) params.set('type', typeFilter);
      const res = await api<any>(`/exercises?${params}`);
      if (Array.isArray(res)) { setExercises(res); setMeta({ page, total: res.length }); }
      else { setExercises(res.data || res); setMeta(res.meta || { page, total: 0 }); }
    } catch (e: any) { setMsg(e.message); }
    finally { setLoading(false); }
  }

  async function loadPool() {
    setLoading(true);
    try { const res = await api<PoolEntry[]>('/pools'); setPool(Array.isArray(res) ? res : []); }
    catch (e: any) { setMsg(e.message); }
    finally { setLoading(false); }
  }

  async function addToPool(ex: Exercise) {
    try {
      await api('/pools', { method: 'POST', body: { exercise_id: ex.id, muscle_family_id: ex.muscle_family_id || null } });
      setMsg(`Added "${ex.name}" to pool`);
    } catch (e: any) { setMsg(e.message); }
  }

  async function removeFromPool(id: string) {
    try { await api(`/pools/${id}`, { method: 'DELETE' }); setPool(pool.filter(p => p.id !== id)); }
    catch (e: any) { setMsg(e.message); }
  }

  async function seedExercises() {
    setSeedStatus('Seeding exercises from ExerciseDB... this may take a minute.');
    try {
      const res = await api<{ exercises_cached: number }>('/exercises/seed', { method: 'POST' });
      setSeedStatus(`Done! Cached ${res.exercises_cached} exercises.`);
    } catch (e: any) { setSeedStatus(`Error: ${e.message}`); }
  }

  async function fetchExternal() {
    setLoading(true);
    try {
      const body: any = { limit: 20 };
      if (query) body.name = query;
      const res = await api<any>('/exercises/fetch-external', { method: 'POST', body });
      const list = Array.isArray(res) ? res : res.data || [];
      setExercises(list);
      setMsg(`Fetched ${list.length} exercises from ExerciseDB`);
    } catch (e: any) { setMsg(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Main>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Exercises</h1>
      {msg && <p style={{ color: 'var(--accent)', fontSize: '0.875rem', marginBottom: '1rem' }}>{msg}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(['browse', 'pool', 'seed'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setMsg(''); }}
            style={{ ...btnStyle, backgroundColor: tab === t ? 'var(--accent)' : 'var(--bg-card)', color: tab === t ? '#fff' : 'var(--text-muted)' }}>
            {t === 'browse' ? 'Browse' : t === 'pool' ? 'My Pool' : 'Seed DB'}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input placeholder="Search exercises..." value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchExercises()} style={inputStyle} />
            <select value={familyFilter} onChange={e => setFamilyFilter(e.target.value)} style={inputStyle}>
              <option value="">All Families</option>
              {FAMILIES.map(f => <option key={f.code} value={f.code}>{f.name}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={inputStyle}>
              <option value="">All Types</option>
              <option value="strength">Strength</option>
              <option value="cardio">Cardio</option>
              <option value="mobility">Mobility</option>
            </select>
            <button onClick={() => searchExercises()} style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff' }}>Search</button>
            <button onClick={fetchExternal} style={{ ...btnStyle, backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}>Fetch from ExerciseDB</button>
          </div>

          {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading...</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {exercises.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No exercises found. Try seeding the database first.</p>}
              {exercises.map(ex => (
                <div key={ex.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {ex.gif_url && <img src={ex.gif_url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600 }}>{ex.name}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{ex.type}{ex.family_name ? ` - ${ex.family_name}` : ''}</p>
                    </div>
                    <button onClick={() => addToPool(ex)} style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff', fontSize: '0.75rem' }}>+ Pool</button>
                  </div>
                </div>
              ))}
              {meta.total > 20 && (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
                  {meta.page > 1 && <button onClick={() => searchExercises(meta.page - 1)} style={btnStyle}>Prev</button>}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', alignSelf: 'center' }}>Page {meta.page}</span>
                  <button onClick={() => searchExercises(meta.page + 1)} style={btnStyle}>Next</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'pool' && (
        loading ? <p style={{ color: 'var(--text-muted)' }}>Loading...</p> : pool.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Your pool is empty. Browse exercises and add them to your pool for programme generation.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pool.map(p => (
              <div key={p.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{p.exercise_name}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.type}</p>
                  </div>
                  <button onClick={() => removeFromPool(p.id)} style={{ ...btnStyle, color: 'var(--warning)', fontSize: '0.75rem' }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'seed' && (
        <div style={cardStyle}>
          <p style={{ marginBottom: '1rem' }}>Seed the exercise database from ExerciseDB. This fetches all available exercises and caches them locally.</p>
          <button onClick={seedExercises} style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff' }}>Seed All Exercises</button>
          {seedStatus && <p style={{ color: 'var(--accent-secondary)', marginTop: '1rem', fontSize: '0.875rem' }}>{seedStatus}</p>}
        </div>
      )}
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>{children}</main>;
}

const inputStyle: React.CSSProperties = {
  padding: '0.625rem', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)',
  border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.875rem', outline: 'none',
};
const btnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: '8px',
  cursor: 'pointer', fontSize: '0.875rem', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)',
};
const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '1rem',
};
