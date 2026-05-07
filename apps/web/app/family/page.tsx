'use client';

import { useEffect, useState } from 'react';
import { api, requireAuth } from '../../lib/api';

interface Family {
  id: string;
  name: string;
  invite_code: string;
  invite_expires_at: string | null;
  created_at: string;
  members?: Member[];
}

interface Member {
  user_id: string;
  role: string;
  display_name: string;
  avatar_url: string | null;
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  total_volume: number;
  session_days: number;
}

interface LedgerEntry {
  display_name: string;
  exercise_name: string;
  reps: number;
  weight_kg: number;
  logged_at: string;
}

export default function FamilyPage() {
  const [tab, setTab] = useState<'view' | 'create' | 'join'>('view');
  const [families, setFamilies] = useState<Family[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Create form
  const [familyName, setFamilyName] = useState('');

  // Join form
  const [joinFamilyId, setJoinFamilyId] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // Leaderboard period
  const [period, setPeriod] = useState('weekly');

  useEffect(() => {
    requireAuth();
    setLoading(false);
  }, []);

  async function loadFamily(id: string) {
    try {
      const res = await api<Family>(`/families/${id}`);
      setSelectedFamily(res);
      // Load leaderboard and ledger
      const [lb, lg] = await Promise.all([
        api<LeaderboardEntry[]>(`/families/${id}/leaderboard?period=${period}`).catch(() => []),
        api<LedgerEntry[]>(`/families/${id}/ledger`).catch(() => []),
      ]);
      setLeaderboard(Array.isArray(lb) ? lb : []);
      setLedger(Array.isArray(lg) ? lg : []);
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function createFamily() {
    if (!familyName.trim()) return;
    try {
      const res = await api<Family>('/families', {
        method: 'POST',
        body: { name: familyName.trim() },
      });
      setMsg(`Family "${res.name}" created! Invite code: ${res.invite_code}`);
      setFamilyName('');
      setSelectedFamily(res);
      setFamilies([...families, res]);
      setTab('view');
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function joinFamily() {
    if (!joinFamilyId || !inviteCode) return;
    try {
      await api(`/families/${joinFamilyId}/join`, {
        method: 'POST',
        body: { invite_code: inviteCode },
      });
      setMsg('Joined family successfully!');
      setTab('view');
      await loadFamily(joinFamilyId);
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function removeMember(familyId: string, userId: string) {
    try {
      await api(`/families/${familyId}/members/${userId}`, { method: 'DELETE' });
      if (selectedFamily) await loadFamily(familyId);
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <Main>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Family Training</h1>
      {msg && <p style={{ color: '#5B4FE8', fontSize: '0.875rem', marginBottom: '1rem' }}>{msg}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(['view', 'create', 'join'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setMsg(''); }}
            style={{ ...btnStyle, backgroundColor: tab === t ? '#5B4FE8' : '#1A1A2E', color: tab === t ? '#fff' : '#6B6B8A' }}>
            {t === 'view' ? 'My Family' : t === 'create' ? 'Create' : 'Join'}
          </button>
        ))}
      </div>

      {tab === 'view' && (
        selectedFamily ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontWeight: 600 }}>{selectedFamily.name}</h2>
              <span style={{ color: '#6B6B8A', fontSize: '0.75rem' }}>
                Invite: <span style={{ color: '#5B4FE8', fontFamily: 'monospace' }}>{selectedFamily.invite_code}</span>
              </span>
            </div>

            {/* Members */}
            <div style={{ ...cardStyle, marginBottom: '1rem' }}>
              <h3 style={{ color: '#9B9BB0', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Members</h3>
              {selectedFamily.members?.map(m => (
                <div key={m.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #2D2D44' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{m.display_name}</span>
                    <span style={{ color: '#6B6B8A', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{m.role}</span>
                  </div>
                  {m.role !== 'admin' && (
                    <button onClick={() => removeMember(selectedFamily.id, m.user_id)}
                      style={{ ...btnStyle, color: '#F97316', fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}>Remove</button>
                  )}
                </div>
              ))}
            </div>

            {/* Leaderboard */}
            <div style={{ ...cardStyle, marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ color: '#9B9BB0', fontSize: '0.875rem' }}>Leaderboard</h3>
                <select value={period} onChange={e => { setPeriod(e.target.value); loadFamily(selectedFamily.id); }} style={{ ...inputStyle, width: 'auto' }}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {leaderboard.length === 0 ? (
                <p style={{ color: '#6B6B8A', fontSize: '0.875rem' }}>No data yet. Start logging workouts!</p>
              ) : leaderboard.map((entry, i) => (
                <div key={entry.user_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #2D2D44' }}>
                  <span>
                    <span style={{ color: i === 0 ? '#E8E84F' : '#9B9BB0', fontWeight: i === 0 ? 700 : 400, marginRight: '0.5rem' }}>#{i + 1}</span>
                    {entry.display_name}
                  </span>
                  <span style={{ color: '#5B4FE8', fontWeight: 600 }}>{(entry.total_volume || 0).toFixed(0)} kg &middot; {entry.session_days} days</span>
                </div>
              ))}
            </div>

            {/* Activity Ledger */}
            <div style={cardStyle}>
              <h3 style={{ color: '#9B9BB0', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Recent Activity</h3>
              {ledger.length === 0 ? (
                <p style={{ color: '#6B6B8A', fontSize: '0.875rem' }}>No activity yet.</p>
              ) : ledger.map((entry, i) => (
                <div key={i} style={{ padding: '0.375rem 0', borderBottom: '1px solid #2D2D44', fontSize: '0.8rem' }}>
                  <span style={{ fontWeight: 600 }}>{entry.display_name}</span>{' '}
                  <span style={{ color: '#6B6B8A' }}>{entry.exercise_name}</span>{' '}
                  <span>{entry.reps}x{entry.weight_kg}kg</span>{' '}
                  <span style={{ color: '#6B6B8A', fontSize: '0.7rem' }}>{new Date(entry.logged_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={cardStyle}>
            <p style={{ color: '#6B6B8A' }}>No family selected. Create a new family or join one with an invite code.</p>
            <p style={{ color: '#6B6B8A', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              If you already have a family ID, enter it below to view it.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <input placeholder="Family ID" value={joinFamilyId} onChange={e => setJoinFamilyId(e.target.value)} style={inputStyle} />
              <button onClick={() => joinFamilyId && loadFamily(joinFamilyId)}
                style={{ ...btnStyle, backgroundColor: '#5B4FE8', color: '#fff' }}>View</button>
            </div>
          </div>
        )
      )}

      {tab === 'create' && (
        <div style={cardStyle}>
          <h2 style={{ fontWeight: 600, marginBottom: '1rem' }}>Create a Family Group</h2>
          <p style={{ color: '#6B6B8A', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Create a family to train together and compete on leaderboards. Share the invite code with members.
          </p>
          <label style={labelStyle}>
            Family Name
            <input value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="e.g. The Swole Squad" style={inputStyle} />
          </label>
          <button onClick={createFamily} style={{ ...btnStyle, backgroundColor: '#5B4FE8', color: '#fff', marginTop: '1rem' }}>
            Create Family
          </button>
        </div>
      )}

      {tab === 'join' && (
        <div style={cardStyle}>
          <h2 style={{ fontWeight: 600, marginBottom: '1rem' }}>Join a Family</h2>
          <p style={{ color: '#6B6B8A', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Enter the family ID and invite code shared by a family admin.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={labelStyle}>
              Family ID
              <input value={joinFamilyId} onChange={e => setJoinFamilyId(e.target.value)} placeholder="UUID" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Invite Code
              <input value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="8-character code" style={inputStyle} />
            </label>
            <button onClick={joinFamily} style={{ ...btnStyle, backgroundColor: '#5B4FE8', color: '#fff' }}>
              Join Family
            </button>
          </div>
        </div>
      )}
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>{children}</main>;
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
