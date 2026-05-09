'use client';

import { useEffect, useState } from 'react';
import { api, requireAuth } from '../../lib/api';

interface Family { id: string; name: string; invite_code: string; invite_expires_at: string | null; created_at: string; members?: Member[]; my_role?: string; }
interface Member { user_id: string; role: string; display_name: string; avatar_url: string | null; }
interface LeaderboardEntry { user_id: string; display_name: string; total_volume: number; session_days: number; }
interface LedgerEntry { display_name: string; exercise_name: string; reps: number; weight_kg: number; logged_at: string; }

export default function FamilyPage() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [joinFamilyId, setJoinFamilyId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [period, setPeriod] = useState('weekly');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => {
    requireAuth();
    loadFamilies();
  }, []);

  async function loadFamilies() {
    try {
      const res = await api<Family[]>('/families');
      const list = Array.isArray(res) ? res : [];
      setFamilies(list);
      // Auto-select first family
      if (list.length > 0) {
        await loadFamily(list[0].id);
      }
    } catch { setFamilies([]); }
    setLoading(false);
  }

  async function loadFamily(id: string) {
    try {
      const res = await api<Family>(`/families/${id}`);
      setSelectedFamily(res);
      const [lb, lg] = await Promise.all([
        api<LeaderboardEntry[]>(`/families/${id}/leaderboard?period=${period}`).catch(() => []),
        api<LedgerEntry[]>(`/families/${id}/ledger`).catch(() => []),
      ]);
      setLeaderboard(Array.isArray(lb) ? lb : []);
      setLedger(Array.isArray(lg) ? lg : []);
    } catch (e: any) { setMsg(e.message); }
  }

  async function createFamily() {
    if (!familyName.trim()) return;
    try {
      const res = await api<Family>('/families', { method: 'POST', body: { name: familyName.trim() } });
      setMsg(`Family "${res.name}" created!`);
      setFamilyName('');
      setShowCreate(false);
      await loadFamilies();
    } catch (e: any) { setMsg(e.message); }
  }

  async function joinFamily() {
    if (!joinFamilyId || !inviteCode) return;
    try {
      await api(`/families/${joinFamilyId}/join`, { method: 'POST', body: { invite_code: inviteCode } });
      setMsg('Joined family!');
      setShowJoin(false);
      setJoinFamilyId('');
      setInviteCode('');
      await loadFamilies();
    } catch (e: any) { setMsg(e.message); }
  }

  async function removeMember(familyId: string, userId: string) {
    try {
      await api(`/families/${familyId}/members/${userId}`, { method: 'DELETE' });
      if (selectedFamily) await loadFamily(familyId);
    } catch (e: any) { setMsg(e.message); }
  }

  if (loading) return <Main><p style={{ color: 'var(--text-muted)' }}>Loading...</p></Main>;

  return (
    <Main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.125rem' }}>Family</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Train together, compete on leaderboards.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <button onClick={() => { setShowCreate(!showCreate); setShowJoin(false); }}
            style={{ ...btnStyle, backgroundColor: showCreate ? 'var(--accent)' : 'var(--bg-card)', color: showCreate ? '#fff' : 'var(--text-secondary)', fontSize: '0.8rem' }}>
            Create
          </button>
          <button onClick={() => { setShowJoin(!showJoin); setShowCreate(false); }}
            style={{ ...btnStyle, backgroundColor: showJoin ? 'var(--accent)' : 'var(--bg-card)', color: showJoin ? '#fff' : 'var(--text-secondary)', fontSize: '0.8rem' }}>
            Join
          </button>
        </div>
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

      {/* Create inline */}
      {showCreate && (
        <div style={{ ...cardStyle, marginBottom: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            Create a family to train together and compete on leaderboards.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input value={familyName} onChange={e => setFamilyName(e.target.value)}
              placeholder="Family name" style={{ ...inputStyle, flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && createFamily()} />
            <button onClick={createFamily} style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff' }}>
              Create
            </button>
          </div>
        </div>
      )}

      {/* Join inline */}
      {showJoin && (
        <div style={{ ...cardStyle, marginBottom: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            Enter the family ID and invite code shared by a family admin.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input value={joinFamilyId} onChange={e => setJoinFamilyId(e.target.value)}
              placeholder="Family ID (UUID)" style={inputStyle} />
            <input value={inviteCode} onChange={e => setInviteCode(e.target.value)}
              placeholder="Invite code (8 characters)" style={inputStyle} />
            <button onClick={joinFamily} style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff' }}>
              Join Family
            </button>
          </div>
        </div>
      )}

      {/* No families */}
      {families.length === 0 && !showCreate && !showJoin && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No family yet</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Create a family group or join one with an invite code to start training together.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button onClick={() => setShowCreate(true)} style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff' }}>
              Create Family
            </button>
            <button onClick={() => setShowJoin(true)} style={btnStyle}>
              Join Family
            </button>
          </div>
        </div>
      )}

      {/* Family switcher (if multiple) + detail */}
      {families.length > 0 && (
        <>
          {families.length > 1 && (
            <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem', overflowX: 'auto' }}>
              {families.map(f => (
                <button key={f.id} onClick={() => loadFamily(f.id)}
                  style={{
                    ...btnStyle, fontSize: '0.8rem', whiteSpace: 'nowrap',
                    backgroundColor: selectedFamily?.id === f.id ? 'var(--accent)' : 'var(--bg-card)',
                    color: selectedFamily?.id === f.id ? '#fff' : 'var(--text-muted)',
                  }}>
                  {f.name}
                </button>
              ))}
            </div>
          )}

          {selectedFamily && (
            <>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontWeight: 600 }}>{selectedFamily.name}</h2>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  Invite: <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{selectedFamily.invite_code}</span>
                </span>
              </div>

              {/* Members */}
              <div style={{ ...cardStyle, marginBottom: '1rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
                  Members ({selectedFamily.members?.length || 0})
                </p>
                {selectedFamily.members?.map(m => (
                  <div key={m.user_id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.5rem 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{m.display_name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: '0.5rem' }}>{m.role}</span>
                    </div>
                    {m.role !== 'admin' && (
                      <button onClick={() => removeMember(selectedFamily.id, m.user_id)}
                        style={{ ...btnStyle, color: 'var(--warning)', fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Leaderboard */}
              <div style={{ ...cardStyle, marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Leaderboard</p>
                  <select value={period} onChange={e => { setPeriod(e.target.value); loadFamily(selectedFamily.id); }}
                    style={{ ...inputStyle, width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                    <option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                  </select>
                </div>
                {leaderboard.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No activity yet this period.</p>
                ) : leaderboard.map((entry, i) => (
                  <div key={entry.user_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span>
                      <span style={{ color: i === 0 ? 'var(--accent-secondary)' : 'var(--text-secondary)', fontWeight: i === 0 ? 700 : 400, marginRight: '0.5rem' }}>#{i + 1}</span>
                      {entry.display_name}
                    </span>
                    <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem' }}>
                      {(entry.total_volume || 0).toFixed(0)} kg \u00B7 {entry.session_days}d
                    </span>
                  </div>
                ))}
              </div>

              {/* Recent Activity */}
              <div style={cardStyle}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
                  Recent Activity
                </p>
                {ledger.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No activity yet.</p>
                ) : ledger.slice(0, 20).map((entry, i) => (
                  <div key={i} style={{ padding: '0.375rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 600 }}>{entry.display_name}</span>{' '}
                    <span style={{ color: 'var(--text-muted)' }}>{entry.exercise_name}</span>{' '}
                    <span>{entry.reps}x{entry.weight_kg}kg</span>{' '}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                      {new Date(entry.logged_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return <main style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>{children}</main>;
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
