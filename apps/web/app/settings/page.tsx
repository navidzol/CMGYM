'use client';

import { useEffect, useState } from 'react';
import { api, requireAuth } from '../../lib/api';

interface User {
  id: string;
  email: string;
  display_name: string;
  unit_pref: string;
}

interface Settings {
  sessions_per_week: number;
  session_duration_min: number;
  cardio_duration_min: number;
  rest_between_sets_s: number;
  auto_rest: boolean;
  timer_sound: string;
  vibration: string;
  weight_unit: string;
  distance_unit: string;
  theme: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [unitPref, setUnitPref] = useState('kg');

  useEffect(() => {
    requireAuth();
    Promise.all([
      api<User>('/users/me'),
      api<Settings>('/users/me/settings'),
    ]).then(([u, s]) => {
      setUser(u);
      setDisplayName(u.display_name);
      setUnitPref(u.unit_pref);
      setSettings(s);
    }).catch(() => {
      window.location.href = '/login';
    }).finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    try {
      const res = await api<User>('/users/me', {
        method: 'PATCH',
        body: { display_name: displayName, unit_pref: unitPref },
      });
      setUser(res);
      setMsg('Profile saved!');
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    try {
      const res = await api<Settings>('/users/me/settings', {
        method: 'PATCH',
        body: settings,
      });
      setSettings(res);
      setMsg('Settings saved!');
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  if (loading) return <Main><p style={{ color: '#6B6B8A' }}>Loading...</p></Main>;

  return (
    <Main>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Settings</h1>
      {msg && <p style={{ color: '#5B4FE8', fontSize: '0.875rem', marginBottom: '1rem' }}>{msg}</p>}

      {/* Profile */}
      <Section title="Profile">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={labelStyle}>
            Display Name
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Unit Preference
            <select value={unitPref} onChange={e => setUnitPref(e.target.value)} style={inputStyle}>
              <option value="kg">Kilograms (kg)</option>
              <option value="lb">Pounds (lb)</option>
            </select>
          </label>
          <p style={{ color: '#6B6B8A', fontSize: '0.75rem' }}>Email: {user?.email}</p>
          <button onClick={saveProfile} style={{ ...btnStyle, backgroundColor: '#5B4FE8', color: '#fff' }}>
            Save Profile
          </button>
        </div>
      </Section>

      {/* Workout Settings */}
      {settings && (
        <Section title="Workout Preferences">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <label style={labelStyle}>
              Sessions per Week
              <input type="number" min={1} max={7} value={settings.sessions_per_week}
                onChange={e => updateSetting('sessions_per_week', +e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Session Duration (min)
              <input type="number" min={15} max={120} value={settings.session_duration_min}
                onChange={e => updateSetting('session_duration_min', +e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Cardio Duration (min)
              <input type="number" min={0} max={60} value={settings.cardio_duration_min}
                onChange={e => updateSetting('cardio_duration_min', +e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Rest Between Sets (sec)
              <input type="number" min={10} max={600} value={settings.rest_between_sets_s}
                onChange={e => updateSetting('rest_between_sets_s', +e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Timer Sound
              <select value={settings.timer_sound} onChange={e => updateSetting('timer_sound', e.target.value)} style={inputStyle}>
                <option value="silent">Silent</option>
                <option value="beep">Beep</option>
                <option value="voice">Voice</option>
              </select>
            </label>
            <label style={labelStyle}>
              Vibration
              <select value={settings.vibration} onChange={e => updateSetting('vibration', e.target.value)} style={inputStyle}>
                <option value="off">Off</option>
                <option value="light">Light</option>
                <option value="strong">Strong</option>
              </select>
            </label>
            <label style={labelStyle}>
              Weight Unit
              <select value={settings.weight_unit} onChange={e => updateSetting('weight_unit', e.target.value)} style={inputStyle}>
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </label>
            <label style={labelStyle}>
              Distance Unit
              <select value={settings.distance_unit} onChange={e => updateSetting('distance_unit', e.target.value)} style={inputStyle}>
                <option value="km">km</option>
                <option value="mi">mi</option>
              </select>
            </label>
            <label style={labelStyle}>
              Theme
              <select value={settings.theme} onChange={e => updateSetting('theme', e.target.value)} style={inputStyle}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </label>
            <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={settings.auto_rest} onChange={e => updateSetting('auto_rest', e.target.checked)} />
              Auto Rest Timer
            </label>
          </div>
          <button onClick={saveSettings} style={{ ...btnStyle, backgroundColor: '#5B4FE8', color: '#fff', marginTop: '1rem' }}>
            Save Settings
          </button>
        </Section>
      )}
    </Main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
      <h2 style={{ fontWeight: 600, marginBottom: '1rem', color: '#9B9BB0' }}>{title}</h2>
      {children}
    </div>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return <main style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>{children}</main>;
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
