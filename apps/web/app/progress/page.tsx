'use client';

import { useEffect, useState } from 'react';
import { api, requireAuth } from '../../lib/api';

interface PR {
  id: string;
  exercise_name: string;
  metric: string;
  value: number;
  achieved_at: string;
}

interface Report {
  type: string;
  date?: string;
  start_date?: string;
  end_date?: string;
  total_volume_kg: number;
  sessions_completed: number;
  planned_per_week?: number;
  cardio_minutes?: number;
  prs?: PR[];
}

export default function ProgressPage() {
  const [tab, setTab] = useState<'prs' | 'reports'>('prs');
  const [prs, setPrs] = useState<PR[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Report form
  const [reportType, setReportType] = useState('weekly');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    requireAuth();
    loadPRs();
  }, []);

  async function loadPRs() {
    setLoading(true);
    try {
      const res = await api<PR[]>('/records');
      setPrs(Array.isArray(res) ? res : []);
    } catch { setPrs([]); }
    setLoading(false);
  }

  async function loadReport() {
    setMsg('');
    try {
      const res = await api<Report>(`/reports?type=${reportType}&date=${reportDate}`);
      setReport(res);
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <Main>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Progress</h1>
      {msg && <p style={{ color: '#F97316', fontSize: '0.875rem', marginBottom: '1rem' }}>{msg}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(['prs', 'reports'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...btnStyle, backgroundColor: tab === t ? '#5B4FE8' : '#1A1A2E', color: tab === t ? '#fff' : '#6B6B8A' }}>
            {t === 'prs' ? 'Personal Records' : 'Reports'}
          </button>
        ))}
      </div>

      {tab === 'prs' && (
        loading ? <p style={{ color: '#6B6B8A' }}>Loading...</p> : prs.length === 0 ? (
          <p style={{ color: '#6B6B8A' }}>No personal records yet. PRs are automatically detected when you log sets.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {prs.map(pr => (
              <div key={pr.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{pr.exercise_name}</p>
                    <p style={{ color: '#6B6B8A', fontSize: '0.75rem' }}>
                      {pr.metric === 'estimated_1rm' ? 'Estimated 1RM' : pr.metric} &middot; {new Date(pr.achieved_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p style={{ color: '#5B4FE8', fontWeight: 700, fontSize: '1.25rem' }}>
                    {pr.value.toFixed(1)} kg
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'reports' && (
        <>
          <div style={{ ...cardStyle, marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label style={labelStyle}>
                Period
                <select value={reportType} onChange={e => setReportType(e.target.value)} style={inputStyle}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label style={labelStyle}>
                Date
                <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={inputStyle} />
              </label>
              <button onClick={loadReport} style={{ ...btnStyle, backgroundColor: '#5B4FE8', color: '#fff' }}>
                Generate Report
              </button>
            </div>
          </div>

          {report && (
            <div style={cardStyle}>
              <h2 style={{ fontWeight: 600, marginBottom: '1rem' }}>
                {report.type.charAt(0).toUpperCase() + report.type.slice(1)} Report — {report.date || `${report.start_date} to ${report.end_date}`}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                <StatCard label="Total Volume" value={`${(report.total_volume_kg || 0).toFixed(0)} kg`} />
                <StatCard label="Sessions" value={`${report.sessions_completed}`} />
                {report.planned_per_week !== undefined && (
                  <StatCard label="Planned/Week" value={`${report.planned_per_week}`} />
                )}
                {report.cardio_minutes !== undefined && (
                  <StatCard label="Cardio" value={`${(report.cardio_minutes || 0).toFixed(0)} min`} />
                )}
              </div>
              {report.prs && report.prs.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ color: '#9B9BB0', fontSize: '0.875rem', marginBottom: '0.5rem' }}>PRs in this period:</p>
                  {report.prs.map((pr, i) => (
                    <p key={i} style={{ fontSize: '0.8rem', color: '#5B4FE8' }}>
                      {pr.exercise_name}: {pr.value.toFixed(1)} kg
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ backgroundColor: '#0d0d1a', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
      <p style={{ color: '#6B6B8A', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{label}</p>
      <p style={{ fontWeight: 700, fontSize: '1.25rem', color: '#5B4FE8' }}>{value}</p>
    </div>
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
