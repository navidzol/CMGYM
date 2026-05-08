'use client';

import { useEffect, useState } from 'react';
import { api, requireAuth } from '../../lib/api';

const PALETTES = [
  { id: 'default', name: 'Default', colors: ['#5B4FE8', '#4FE8A8', '#0d0d1a', '#1A1A2E'] },
  { id: 'neon-dream', name: 'Neon Dream', colors: ['#FF3B61', '#FFD24A', '#1C1C1E', '#FF8A00'] },
  { id: 'electric-maximum', name: 'Electric Maximum', colors: ['#00A8FF', '#FF6B6B', '#0B0F14', '#FFA94D'] },
  { id: 'cyber-mint', name: 'Cyber Mint', colors: ['#00E5A8', '#7C5CFF', '#071029', '#00C2FF'] },
  { id: 'solar-pop', name: 'Solar Pop', colors: ['#FFB547', '#FF3EC1', '#101214', '#00D1FF'] },
  { id: 'hyper-drive', name: 'Hyper-Drive', colors: ['#00F2FF', '#FF00FF', '#121212', '#1E1E1E'] },
  { id: 'acid-punch', name: 'Acid Punch', colors: ['#6200EE', '#CCFF00', '#FAFAFA', '#FFFFFF'] },
  { id: 'solar-flare', name: 'Solar Flare', colors: ['#FF4500', '#FFD700', '#004D40', '#00695C'] },
  { id: 'radical-sport', name: 'Radical Sport', colors: ['#2E5BFF', '#FF3D00', '#F4F7FE', '#FFFFFF'] },
];

const ALL_EQUIPMENT = [
  'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'smith machine',
  'resistance band', 'medicine ball', 'stability ball', 'ez barbell',
  'olympic barbell', 'trap bar', 'pull-up bar', 'dip station',
  'bench', 'incline bench', 'decline bench', 'preacher bench',
  'leg press', 'hack squat', 'lat pulldown', 'rowing machine',
  'treadmill', 'stationary bike', 'elliptical', 'jump rope',
  'foam roller', 'ab wheel', 'battle ropes', 'sled',
  'TRX / suspension trainer', 'parallettes', 'rings',
  'beyond power voltra',
];

// When the user selects Voltra, these equipment types are also unlocked
// because the Voltra can simulate cable movements and variable resistance
const VOLTRA_UNLOCKS = ['cable', 'resistance band'];

// Body regions for the muscle diagram - mapped to front/back of body
const MUSCLE_GROUPS = {
  front: [
    { id: 'neck', label: 'Neck', x: 100, y: 42, w: 40, h: 16 },
    { id: 'shoulders', label: 'Shoulders', x: 60, y: 62, w: 120, h: 20 },
    { id: 'chest', label: 'Chest', x: 75, y: 85, w: 90, h: 35 },
    { id: 'upper arms', label: 'Biceps', x: 48, y: 100, w: 28, h: 40 },
    { id: 'upper arms', label: 'Biceps R', x: 164, y: 100, w: 28, h: 40 },
    { id: 'waist', label: 'Abs', x: 85, y: 124, w: 70, h: 45 },
    { id: 'lower arms', label: 'Forearms', x: 38, y: 145, w: 24, h: 40 },
    { id: 'lower arms', label: 'Forearms R', x: 178, y: 145, w: 24, h: 40 },
    { id: 'upper legs', label: 'Quads', x: 78, y: 178, w: 36, h: 55 },
    { id: 'upper legs', label: 'Quads R', x: 126, y: 178, w: 36, h: 55 },
    { id: 'lower legs', label: 'Shins', x: 80, y: 242, w: 30, h: 50 },
    { id: 'lower legs', label: 'Shins R', x: 130, y: 242, w: 30, h: 50 },
  ],
  back: [
    { id: 'neck', label: 'Neck', x: 100, y: 42, w: 40, h: 16 },
    { id: 'shoulders', label: 'Rear Delts', x: 60, y: 62, w: 120, h: 20 },
    { id: 'back', label: 'Upper Back', x: 75, y: 85, w: 90, h: 35 },
    { id: 'upper arms', label: 'Triceps', x: 48, y: 100, w: 28, h: 40 },
    { id: 'upper arms', label: 'Triceps R', x: 164, y: 100, w: 28, h: 40 },
    { id: 'back', label: 'Lower Back', x: 85, y: 124, w: 70, h: 40 },
    { id: 'lower arms', label: 'Forearms', x: 38, y: 145, w: 24, h: 40 },
    { id: 'lower arms', label: 'Forearms R', x: 178, y: 145, w: 24, h: 40 },
    { id: 'upper legs', label: 'Hamstrings', x: 78, y: 178, w: 36, h: 55 },
    { id: 'upper legs', label: 'Hamstrings R', x: 126, y: 178, w: 36, h: 55 },
    { id: 'lower legs', label: 'Calves', x: 80, y: 242, w: 30, h: 50 },
    { id: 'lower legs', label: 'Calves R', x: 130, y: 242, w: 30, h: 50 },
  ],
};

// Only the settings keys the API accepts
const SETTINGS_KEYS = [
  'sessions_per_week', 'session_duration_min', 'cardio_duration_min',
  'rest_between_sets_s', 'auto_rest', 'timer_sound', 'vibration',
  'weight_unit', 'distance_unit', 'theme', 'color_palette',
] as const;

interface User {
  id: string; email: string; display_name: string; unit_pref: string;
  gender: string | null; date_of_birth: string | null; weight_kg: number | null; height_cm: number | null;
}

interface Settings {
  sessions_per_week: number; session_duration_min: number; cardio_duration_min: number;
  rest_between_sets_s: number; auto_rest: boolean; timer_sound: string; vibration: string;
  weight_unit: string; distance_unit: string; theme: string; color_palette: string;
  [key: string]: any; // allow extra keys from API response, we'll strip them on save
}

interface Injury { id: string; body_region: string; mode: 'avoid' | 'warn'; }

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [unitPref, setUnitPref] = useState('kg');
  const [gender, setGender] = useState<string>('');
  const [dob, setDob] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');

  const [userEquipment, setUserEquipment] = useState<string[]>([]);
  const [equipLoading, setEquipLoading] = useState(false);

  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front');
  const [injuryGender, setInjuryGender] = useState<'male' | 'female'>('male');

  useEffect(() => {
    requireAuth();
    Promise.all([
      api<User>('/users/me'),
      api<Settings>('/users/me/settings'),
      api<any>('/users/me/equipment').then(r => {
        const arr = Array.isArray(r) ? r : (r?.data || []);
        return arr.map((e: any) => e.equipment_name);
      }),
      api<any>('/users/me/injuries').then(r => Array.isArray(r) ? r : (r?.data || [])),
    ]).then(([u, s, equip, inj]) => {
      setUser(u);
      setDisplayName(u.display_name);
      setUnitPref(u.unit_pref);
      setGender(u.gender || '');
      setDob(u.date_of_birth || '');
      setWeightKg(u.weight_kg ? String(u.weight_kg) : '');
      setHeightCm(u.height_cm ? String(u.height_cm) : '');
      setSettings(s);
      setUserEquipment(Array.isArray(equip) ? equip : []);
      setInjuries(Array.isArray(inj) ? inj : []);
      if (u.gender === 'female') setInjuryGender('female');
    }).catch(() => {
      window.location.href = '/login';
    }).finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    try {
      const body: any = { display_name: displayName, unit_pref: unitPref };
      if (gender) body.gender = gender; else body.gender = null;
      if (dob) body.date_of_birth = dob;
      if (weightKg) body.weight_kg = parseFloat(weightKg); else body.weight_kg = null;
      if (heightCm) body.height_cm = parseFloat(heightCm); else body.height_cm = null;
      const res = await api<User>('/users/me', { method: 'PATCH', body });
      setUser(res);
      setMsg('Profile saved!');
    } catch (e: any) { setMsg(e.message); }
  }

  async function saveSettings() {
    if (!settings) return;
    // Only send the keys the API schema accepts
    const payload: any = {};
    for (const key of SETTINGS_KEYS) {
      if (settings[key] !== undefined) payload[key] = settings[key];
    }
    try {
      const res = await api<Settings>('/users/me/settings', { method: 'PATCH', body: payload });
      setSettings(res);
      document.documentElement.setAttribute('data-palette', settings.color_palette || 'default');
      localStorage.setItem('cmgym_palette', settings.color_palette || 'default');
      setMsg('Settings saved!');
    } catch (e: any) { setMsg(e.message); }
  }

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  function selectPalette(id: string) {
    updateSetting('color_palette', id);
    document.documentElement.setAttribute('data-palette', id);
    localStorage.setItem('cmgym_palette', id);
  }

  // Equipment
  function toggleEquipment(name: string) {
    setUserEquipment(prev => {
      const next = prev.includes(name) ? prev.filter(e => e !== name) : [...prev, name];
      // If Voltra is added, auto-add its unlocked equipment types
      if (name === 'beyond power voltra' && !prev.includes(name)) {
        for (const unlock of VOLTRA_UNLOCKS) {
          if (!next.includes(unlock)) next.push(unlock);
        }
      }
      return next;
    });
  }
  function selectAllEquipment() { setUserEquipment([...ALL_EQUIPMENT]); }
  function deselectAllEquipment() { setUserEquipment([]); }

  async function saveEquipment() {
    setEquipLoading(true);
    try {
      await api('/users/me/equipment', { method: 'PUT', body: { equipment: userEquipment } });
      setMsg('Equipment saved!');
    } catch (e: any) { setMsg(e.message); }
    finally { setEquipLoading(false); }
  }

  // Injuries — tap on body region to cycle
  async function toggleInjury(region: string) {
    const existing = injuries.find(i => i.body_region === region);
    if (!existing) {
      // none -> warn
      try {
        const res = await api<Injury>('/users/me/injuries', { method: 'POST', body: { body_region: region, mode: 'warn' } });
        setInjuries([...injuries, res]);
      } catch (e: any) { setMsg(e.message); }
    } else if (existing.mode === 'warn') {
      // warn -> avoid
      try {
        const res = await api<Injury>('/users/me/injuries', { method: 'POST', body: { body_region: region, mode: 'avoid' } });
        setInjuries(injuries.map(i => i.body_region === region ? res : i));
      } catch (e: any) { setMsg(e.message); }
    } else {
      // avoid -> none (remove)
      try {
        await api(`/users/me/injuries/${existing.id}`, { method: 'DELETE' });
        setInjuries(injuries.filter(i => i.body_region !== region));
      } catch (e: any) { setMsg(e.message); }
    }
  }

  function getInjuryColor(region: string): string {
    const inj = injuries.find(i => i.body_region === region);
    if (!inj) return 'var(--border)';
    if (inj.mode === 'warn') return '#F59E0B';
    return '#EF4444';
  }

  function getInjuryFill(region: string): string {
    const inj = injuries.find(i => i.body_region === region);
    if (!inj) return 'rgba(100,100,150,0.15)';
    if (inj.mode === 'warn') return 'rgba(245,158,11,0.3)';
    return 'rgba(239,68,68,0.3)';
  }

  function getAge(): number | null {
    if (!dob) return null;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  function getBMI(): string | null {
    if (!weightKg || !heightCm) return null;
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm) / 100;
    if (h <= 0) return null;
    return (w / (h * h)).toFixed(1);
  }

  if (loading) return <Main><p style={{ color: 'var(--text-muted)' }}>Loading...</p></Main>;

  const age = getAge();
  const bmi = getBMI();

  return (
    <Main>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Settings</h1>
      {msg && <p style={{ color: 'var(--accent)', fontSize: '0.875rem', marginBottom: '1rem' }}>{msg}</p>}

      {/* Color Palette */}
      <Section title="Color Palette">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {PALETTES.map(p => (
            <div key={p.id} onClick={() => selectPalette(p.id)}
              style={{
                cursor: 'pointer', borderRadius: '10px', padding: '0.75rem',
                border: (settings?.color_palette || 'default') === p.id ? '2px solid var(--accent)' : '2px solid var(--border)',
                backgroundColor: p.colors[2],
              }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '0.5rem' }}>
                {p.colors.map((c, i) => (
                  <div key={i} style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: c, border: '1px solid rgba(255,255,255,0.2)' }} />
                ))}
              </div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: p.colors[0] }}>{p.name}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Profile */}
      <Section title="Profile">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <label style={labelStyle}>Display Name
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>Unit Preference
            <select value={unitPref} onChange={e => setUnitPref(e.target.value)} style={inputStyle}>
              <option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option>
            </select>
          </label>
          <label style={labelStyle}>Gender
            <select value={gender} onChange={e => setGender(e.target.value)} style={inputStyle}>
              <option value="">Not set</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </select>
          </label>
          <label style={labelStyle}>Date of Birth
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>Weight ({unitPref})
            <input type="number" step="0.1" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="e.g. 75" style={inputStyle} />
          </label>
          <label style={labelStyle}>Height (cm)
            <input type="number" step="0.1" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="e.g. 178" style={inputStyle} />
          </label>
        </div>
        {(age !== null || bmi !== null) && (
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {age !== null && <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Age: <strong>{age}</strong></span>}
            {bmi !== null && <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>BMI: <strong>{bmi}</strong></span>}
          </div>
        )}
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>Email: {user?.email}</p>
        <button onClick={saveProfile} style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff', marginTop: '1rem' }}>Save Profile</button>
      </Section>

      {/* Available Equipment */}
      <Section title="Available Equipment">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          Select the equipment you have access to. Generated workouts will only include exercises for your available equipment.
          Body weight exercises are always included.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button onClick={selectAllEquipment} style={{ ...btnStyle, fontSize: '0.75rem' }}>Select All</button>
          <button onClick={deselectAllEquipment} style={{ ...btnStyle, fontSize: '0.75rem' }}>Deselect All</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {ALL_EQUIPMENT.map(eq => {
            const selected = userEquipment.includes(eq);
            const isVoltra = eq === 'beyond power voltra';
            return (
              <button key={eq} onClick={() => toggleEquipment(eq)}
                style={{
                  ...btnStyle, fontSize: '0.75rem', padding: '0.375rem 0.625rem',
                  backgroundColor: selected ? (isVoltra ? '#7C5CFF' : 'var(--accent)') : 'var(--bg-card)',
                  color: selected ? '#fff' : 'var(--text-secondary)',
                  border: selected ? `1px solid ${isVoltra ? '#7C5CFF' : 'var(--accent)'}` : '1px solid var(--border)',
                }}>
                {eq}
              </button>
            );
          })}
        </div>
        {userEquipment.includes('beyond power voltra') && (
          <p style={{ color: 'var(--accent-secondary)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Voltra detected — cable and resistance band exercises are also unlocked.
          </p>
        )}
        <button onClick={saveEquipment} disabled={equipLoading}
          style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff', marginTop: '1rem' }}>
          {equipLoading ? 'Saving...' : 'Save Equipment'}
        </button>
      </Section>

      {/* Injury Management */}
      <Section title="Injury Management">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
          Tap a muscle group on the body to cycle:
          <span style={{ color: 'var(--text-secondary)' }}> none </span>
          <span style={{ color: '#F59E0B' }}> warn </span>
          <span style={{ color: '#EF4444' }}> avoid </span>
          none
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '1rem' }}>
          Warn: exercises are included but flagged. Avoid: exercises are excluded from generated workouts.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button onClick={() => setInjuryGender('male')}
            style={{ ...btnStyle, backgroundColor: injuryGender === 'male' ? 'var(--accent)' : 'var(--bg-card)', color: injuryGender === 'male' ? '#fff' : 'var(--text-muted)', fontSize: '0.75rem' }}>
            Male
          </button>
          <button onClick={() => setInjuryGender('female')}
            style={{ ...btnStyle, backgroundColor: injuryGender === 'female' ? 'var(--accent)' : 'var(--bg-card)', color: injuryGender === 'female' ? '#fff' : 'var(--text-muted)', fontSize: '0.75rem' }}>
            Female
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setBodyView('front')}
            style={{ ...btnStyle, backgroundColor: bodyView === 'front' ? 'var(--accent)' : 'var(--bg-card)', color: bodyView === 'front' ? '#fff' : 'var(--text-muted)', fontSize: '0.75rem' }}>
            Front
          </button>
          <button onClick={() => setBodyView('back')}
            style={{ ...btnStyle, backgroundColor: bodyView === 'back' ? 'var(--accent)' : 'var(--bg-card)', color: bodyView === 'back' ? '#fff' : 'var(--text-muted)', fontSize: '0.75rem' }}>
            Back
          </button>
        </div>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {/* SVG Body Diagram */}
          <div style={{ position: 'relative' }}>
            <svg width="240" height="310" viewBox="0 0 240 310">
              {/* Body outline */}
              <defs>
                <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--text-muted)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="var(--text-muted)" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* Head */}
              <ellipse cx="120" cy="25" rx="22" ry="24" fill="url(#bodyGrad)" stroke="var(--border)" strokeWidth="1" />

              {/* Torso */}
              <path d={injuryGender === 'male'
                ? "M75,58 Q60,60 55,80 L48,140 L55,170 L80,175 L90,178 L120,180 L150,178 L160,175 L185,170 L192,140 L185,80 Q180,60 165,58 L145,55 Q120,52 95,55 Z"
                : "M78,58 Q62,62 58,82 L52,120 Q55,140 60,155 L68,170 L82,178 L100,180 L120,182 L140,180 L158,178 L172,170 L180,155 Q185,140 188,120 L182,82 Q178,62 162,58 L145,55 Q120,52 95,55 Z"
              } fill="url(#bodyGrad)" stroke="var(--border)" strokeWidth="1" />

              {/* Arms */}
              <path d="M55,80 Q42,95 38,130 Q34,155 30,185 L42,188 Q46,158 50,140 L55,105" fill="url(#bodyGrad)" stroke="var(--border)" strokeWidth="1" />
              <path d="M185,80 Q198,95 202,130 Q206,155 210,185 L198,188 Q194,158 190,140 L185,105" fill="url(#bodyGrad)" stroke="var(--border)" strokeWidth="1" />

              {/* Legs */}
              <path d="M90,178 L82,230 L78,280 L74,305 L110,305 L108,280 L110,230 L118,180" fill="url(#bodyGrad)" stroke="var(--border)" strokeWidth="1" />
              <path d="M150,178 L158,230 L162,280 L166,305 L130,305 L132,280 L130,230 L122,180" fill="url(#bodyGrad)" stroke="var(--border)" strokeWidth="1" />

              {/* Clickable muscle regions */}
              {MUSCLE_GROUPS[bodyView].map((mg, i) => (
                <g key={`${mg.id}-${i}`} onClick={() => toggleInjury(mg.id)} style={{ cursor: 'pointer' }}>
                  <rect
                    x={mg.x} y={mg.y} width={mg.w} height={mg.h} rx="6"
                    fill={getInjuryFill(mg.id)}
                    stroke={getInjuryColor(mg.id)}
                    strokeWidth="1.5"
                    opacity="0.85"
                  />
                  <text
                    x={mg.x + mg.w / 2} y={mg.y + mg.h / 2 + 3}
                    textAnchor="middle" fill="var(--text-primary)"
                    fontSize="7" fontWeight="500"
                  >
                    {mg.label.replace(' R', '')}
                  </text>
                </g>
              ))}

              {/* View label */}
              <text x="120" y="308" textAnchor="middle" fill="var(--text-muted)" fontSize="9">
                {bodyView === 'front' ? 'FRONT' : 'BACK'}
              </text>
            </svg>
          </div>

          {/* Legend + active injuries list */}
          <div style={{ minWidth: '180px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Legend</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'rgba(100,100,150,0.15)', border: '1px solid var(--border)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No injury</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'rgba(245,158,11,0.3)', border: '1px solid #F59E0B' }} />
              <span style={{ fontSize: '0.75rem', color: '#F59E0B' }}>Warn (flag exercises)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'rgba(239,68,68,0.3)', border: '1px solid #EF4444' }} />
              <span style={{ fontSize: '0.75rem', color: '#EF4444' }}>Avoid (exclude exercises)</span>
            </div>

            {injuries.length > 0 && (
              <>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.375rem' }}>Active Injuries</p>
                {injuries.map(inj => (
                  <div key={inj.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.375rem 0.5rem', marginBottom: '0.25rem', borderRadius: '6px',
                    backgroundColor: inj.mode === 'warn' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${inj.mode === 'warn' ? '#F59E0B' : '#EF4444'}`,
                  }}>
                    <span style={{ fontSize: '0.8rem', color: inj.mode === 'warn' ? '#F59E0B' : '#EF4444', textTransform: 'capitalize' }}>
                      {inj.body_region}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{inj.mode}</span>
                  </div>
                ))}
              </>
            )}
            {injuries.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No injuries set. Tap a body region to mark it.</p>
            )}
          </div>
        </div>
      </Section>

      {/* Workout Settings */}
      {settings && (
        <Section title="Workout Preferences">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <label style={labelStyle}>Sessions per Week
              <input type="number" min={1} max={7} value={settings.sessions_per_week}
                onChange={e => updateSetting('sessions_per_week', +e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>Session Duration (min)
              <input type="number" min={15} max={120} value={settings.session_duration_min}
                onChange={e => updateSetting('session_duration_min', +e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>Cardio Duration (min)
              <input type="number" min={0} max={60} value={settings.cardio_duration_min}
                onChange={e => updateSetting('cardio_duration_min', +e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>Rest Between Sets (sec)
              <input type="number" min={10} max={600} value={settings.rest_between_sets_s}
                onChange={e => updateSetting('rest_between_sets_s', +e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>Timer Sound
              <select value={settings.timer_sound} onChange={e => updateSetting('timer_sound', e.target.value)} style={inputStyle}>
                <option value="silent">Silent</option><option value="beep">Beep</option><option value="voice">Voice</option>
              </select>
            </label>
            <label style={labelStyle}>Vibration
              <select value={settings.vibration} onChange={e => updateSetting('vibration', e.target.value)} style={inputStyle}>
                <option value="off">Off</option><option value="light">Light</option><option value="strong">Strong</option>
              </select>
            </label>
            <label style={labelStyle}>Weight Unit
              <select value={settings.weight_unit} onChange={e => updateSetting('weight_unit', e.target.value)} style={inputStyle}>
                <option value="kg">kg</option><option value="lb">lb</option>
              </select>
            </label>
            <label style={labelStyle}>Distance Unit
              <select value={settings.distance_unit} onChange={e => updateSetting('distance_unit', e.target.value)} style={inputStyle}>
                <option value="km">km</option><option value="mi">mi</option>
              </select>
            </label>
            <label style={labelStyle}>Theme
              <select value={settings.theme} onChange={e => updateSetting('theme', e.target.value)} style={inputStyle}>
                <option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option>
              </select>
            </label>
            <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={settings.auto_rest} onChange={e => updateSetting('auto_rest', e.target.checked)} />
              Auto Rest Timer
            </label>
          </div>
          <button onClick={saveSettings} style={{ ...btnStyle, backgroundColor: 'var(--accent)', color: '#fff', marginTop: '1rem' }}>
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
      <h2 style={{ fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>{title}</h2>
      {children}
    </div>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return <main style={{ padding: '2rem', maxWidth: '750px', margin: '0 auto' }}>{children}</main>;
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
  backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '1.5rem',
};
const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', flexDirection: 'column' };
