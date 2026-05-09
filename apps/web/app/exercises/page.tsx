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
  const [tab, setTab] = useState<'browse' | 'pool'>('browse');
  const [query, setQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [pool, setPool] = useState<PoolEntry[]>([]);
  const [meta, setMeta] = useState({ page: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [seedStatus, setSeedStatus] = useState('');
  const [msg, setMsg] = useState('');
  const [dbEmpty, setDbEmpty] = useState(false);
  const [seeding, setSeeding] = useState(false);

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
      if (Array.isArray(res)) {
        setExercises(res);
        setMeta({ page, total: res.length });
        setDbEmpty(res.length === 0 && !query && !familyFilter && !typeFilter);
      } else {
        setExercises(res.data || res);
        setMeta(res.meta || { page, total: 0 });
        setDbEmpty((res.data || res).length === 0 && !query && !familyFilter && !typeFilter);
      }
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
      setMsg(`Added "${ex.name}" to your pool`);
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) { setMsg(e.message); }
  }

  async function removeFromPool(id: string) {
    try { await api(`/pools/${id}`, { method: 'DELETE' }); setPool(pool.filter(p => p.id !== id)); }
    catch (e: any) { setMsg(e.message); }
  }

  async function seedExercises() {
    setSeeding(true);
    setSeedStatus('Importing exercises from ExerciseDB... this takes about a minute.');
    try {
      const res = await api<{ exercises_cached: number }>('/exercises/seed', { method: 'POST' });
      setSeedStatus(`Done! Imported ${res.exercises_cached} exercises.`);
      setDbEmpty(false);
      searchExercises();
    } catch (e: any) { setSeedStatus(`Error: ${e.message}`); }
    finally { setSeeding(false); }
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
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) { setMsg(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Main>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Exercises</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
        Browse the database and build your exercise pool for programme generation.
      </p>

      {msg && (
        <div style={{
          backgroundColor: 'rgba(91,79,232,0.1)', border: '1px solid var(--accent)',
          borderRadius: '8px', padding: '0.625rem 1rem', marginBottom: '1rem',
          color: 'var(--accent)', fontSize: '0.85rem',
        }}>
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {(['browse', 'pool'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setMsg(''); }}
            style={{
              padding: '0.5rem 1rem', border: 'none', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.875rem',
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)', fontWeight: tab === t ? 600 : 400,
            }}>
            {t === 'browse' ? 'Browse' : `My Pool (${pool.length})`}
          </button>
        ))}
      </div>

      {/* Empty database — seed prompt */}
      {tab === 'browse' && dbEmpty && !loading && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No exercises in the database yet</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Import exercises from ExerciseDB to get started. This is a one-time setup.
          </p>
          <button onClick={seedExercises} disabled={seeding}
            style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff', padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}>
            {seeding ? 'Importing...' : 'Import Exercise Database'}
          </button>
          {seedStatus && <p style={{ color: 'var(--accent-secondary)', marginTop: '1rem', fontSize: '0.85rem' }}>{seedStatus}</p>}
        </div>
      )}

      {/* Browse tab */}
      {tab === 'browse' && !dbEmpty && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input placeholder="Search by name..." value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchExercises()}
              style={{ ...inputStyle, flex: '1', minWidth: '150px' }} />
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
          </div>

          {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading...</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {exercises.length === 0 && (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem' }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>No exercises match your search.</p>
                  <button onClick={fetchExternal} style={{ ...btnStyle, color: 'var(--accent)', fontSize: '0.8rem' }}>
                    Search ExerciseDB online
                  </button>
                </div>
              )}
              {exercises.map(ex => (
                <div key={ex.id} style={{ ...cardStyle, padding: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {ex.gif_url && <img src={ex.gif_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{ex.name}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{ex.type}{ex.family_name ? ` \u00B7 ${ex.family_name}` : ''}</p>
                    </div>
                    <button onClick={() => addToPool(ex)} style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff', fontSize: '0.75rem', flexShrink: 0 }}>
                      + Pool
                    </button>
                  </div>
                </div>
              ))}
              {meta.total > 20 && (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
                  {meta.page > 1 && <button onClick={() => searchExercises(meta.page - 1)} style={btnStyle}>Prev</button>}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', alignSelf: 'center' }}>Page {meta.page}</span>
                  <button onClick={() => searchExercises(meta.page + 1)} style={btnStyle}>Next</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Pool tab */}
      {tab === 'pool' && (
        loading ? <p style={{ color: 'var(--text-muted)' }}>Loading...</p> : pool.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Your pool is empty</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Your pool is the set of exercises used to generate your workouts.
              Browse the database and add exercises you want included.
            </p>
            <button onClick={() => setTab('browse')} style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff' }}>
              Browse Exercises
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              {pool.length} exercise{pool.length !== 1 ? 's' : ''} in your pool. These are used when generating programmes.
            </p>
            {pool.map(p => (
              <div key={p.id} style={{ ...cardStyle, padding: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.exercise_name}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{p.type}</p>
                  </div>
                  <button onClick={() => removeFromPool(p.id)} style={{ ...btnStyle, color: 'var(--warning)', fontSize: '0.75rem' }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return <main style={{ padding: '2rem', maxWidth: '750px', margin: '0 auto' }}>{children}</main>;
}

const inputStyle: React.CSSProperties = {
  padding: '0.625rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.875rem', outline: 'none',
};
const btnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: '8px',
  cursor: 'pointer', fontSize: '0.875rem', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)',
};
const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '1rem',
};
