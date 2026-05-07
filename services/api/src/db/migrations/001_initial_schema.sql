-- FitFlow Initial Schema
-- Implements SOP v2.0 Section 4: Database Schema

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ══════════════════════════════════════
-- Users (extends Supabase Auth)
-- ══════════════════════════════════════
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  unit_pref TEXT NOT NULL DEFAULT 'kg' CHECK (unit_pref IN ('kg', 'lb')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════
-- Muscle Families (fixed taxonomy: F1–F6)
-- ══════════════════════════════════════
CREATE TABLE muscle_families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL CHECK (code IN ('F1','F2','F3','F4','F5','F6')),
  name TEXT NOT NULL,
  colour_hex TEXT NOT NULL,
  icon_url TEXT
);

INSERT INTO muscle_families (code, name, colour_hex) VALUES
  ('F1', 'Upper Front', '#E84F4F'),
  ('F2', 'Upper Back',  '#4F8DE8'),
  ('F3', 'Core Front',  '#E8A84F'),
  ('F4', 'Core Back',   '#4FE8A8'),
  ('F5', 'Lower Front', '#A84FE8'),
  ('F6', 'Lower Back',  '#E8E84F');

-- ══════════════════════════════════════
-- Exercises (cached from ExerciseDB)
-- ══════════════════════════════════════
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  external_id TEXT UNIQUE,
  muscle_family_id UUID REFERENCES muscle_families(id),
  gif_url TEXT,
  video_url TEXT,
  instructions_json JSONB DEFAULT '[]',
  avg_duration_s INTEGER NOT NULL DEFAULT 45,
  type TEXT NOT NULL DEFAULT 'strength' CHECK (type IN ('strength', 'cardio', 'mobility')),
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercises_family ON exercises(muscle_family_id);
CREATE INDEX idx_exercises_type ON exercises(type);
CREATE INDEX idx_exercises_external_id ON exercises(external_id);

-- ══════════════════════════════════════
-- User Settings
-- ══════════════════════════════════════
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sessions_per_week INTEGER NOT NULL DEFAULT 3 CHECK (sessions_per_week BETWEEN 1 AND 7),
  session_duration_min INTEGER NOT NULL DEFAULT 50 CHECK (session_duration_min BETWEEN 15 AND 120),
  cardio_duration_min INTEGER NOT NULL DEFAULT 10,
  rest_between_sets_s INTEGER NOT NULL DEFAULT 90,
  auto_rest BOOLEAN NOT NULL DEFAULT true,
  timer_sound TEXT NOT NULL DEFAULT 'beep' CHECK (timer_sound IN ('silent', 'beep', 'voice')),
  vibration TEXT NOT NULL DEFAULT 'strong' CHECK (vibration IN ('off', 'light', 'strong')),
  weight_unit TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb')),
  distance_unit TEXT NOT NULL DEFAULT 'km' CHECK (distance_unit IN ('km', 'mi')),
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
  reminder_time TIME,
  reminder_days INTEGER DEFAULT 0, -- bitmask: Mon=1, Tue=2, Wed=4, ...
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════
-- Exercise Pools
-- ══════════════════════════════════════
CREATE TABLE exercise_pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'family')),
  owner_id UUID NOT NULL,
  muscle_family_id UUID REFERENCES muscle_families(id), -- NULL = cardio pool
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_type, owner_id, exercise_id)
);

CREATE INDEX idx_exercise_pools_owner ON exercise_pools(owner_type, owner_id);
CREATE INDEX idx_exercise_pools_family ON exercise_pools(muscle_family_id);

-- ══════════════════════════════════════
-- Families
-- ══════════════════════════════════════
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  invite_code TEXT UNIQUE NOT NULL,
  invite_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_id, user_id)
);

CREATE INDEX idx_family_members_user ON family_members(user_id);

-- ══════════════════════════════════════
-- Programmes & Generated Sessions
-- ══════════════════════════════════════
CREATE TABLE generated_programmes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'family')),
  owner_id UUID NOT NULL,
  weeks INTEGER NOT NULL DEFAULT 1,
  sessions_per_week INTEGER NOT NULL,
  session_duration_min INTEGER NOT NULL,
  cardio_duration_min INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_programmes_owner ON generated_programmes(owner_type, owner_id);

CREATE TABLE generated_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  programme_id UUID NOT NULL REFERENCES generated_programmes(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  session_date DATE NOT NULL,
  schedule_json JSONB NOT NULL,
  is_random_order BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_generated_sessions_programme ON generated_sessions(programme_id);
CREATE INDEX idx_generated_sessions_date ON generated_sessions(session_date);

-- ══════════════════════════════════════
-- Workout Sessions & Sets (actual logged data)
-- ══════════════════════════════════════
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generated_session_id UUID REFERENCES generated_sessions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  mode TEXT NOT NULL DEFAULT 'standard' CHECK (mode IN ('standard', 'random', 'custom')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workout_sessions_user ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_date ON workout_sessions(started_at);

CREATE TABLE session_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight_kg DECIMAL(7,2),
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
  duration_s INTEGER,
  distance_m DECIMAL(10,2),
  completed_at TIMESTAMPTZ,
  skipped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_sets_workout ON session_sets(workout_session_id);
CREATE INDEX idx_session_sets_exercise ON session_sets(exercise_id);

-- ══════════════════════════════════════
-- Exercise Notes (per user per exercise)
-- ══════════════════════════════════════
CREATE TABLE exercise_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, exercise_id)
);

-- ══════════════════════════════════════
-- Personal Records
-- ══════════════════════════════════════
CREATE TABLE personal_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  metric TEXT NOT NULL DEFAULT 'estimated_1rm',
  value DECIMAL(10,2) NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_set_id UUID REFERENCES session_sets(id),
  UNIQUE(user_id, exercise_id, metric)
);

CREATE INDEX idx_personal_records_user ON personal_records(user_id);

-- ══════════════════════════════════════
-- Family Ledger
-- ══════════════════════════════════════
CREATE TABLE family_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  user_id UUID NOT NULL REFERENCES users(id),
  reps INTEGER,
  weight_kg DECIMAL(7,2),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_family_ledger_family ON family_ledger(family_id);
CREATE INDEX idx_family_ledger_user ON family_ledger(user_id);
CREATE INDEX idx_family_ledger_date ON family_ledger(logged_at);

-- ══════════════════════════════════════
-- Custom Sessions
-- ══════════════════════════════════════
CREATE TABLE custom_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_families TEXT[] NOT NULL, -- array of family codes e.g. {'F1','F3','F5'}
  duration_min INTEGER NOT NULL CHECK (duration_min BETWEEN 15 AND 120),
  cardio_min INTEGER NOT NULL DEFAULT 0,
  schedule_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_custom_sessions_user ON custom_sessions(user_id);

-- ══════════════════════════════════════
-- Row-Level Security Policies
-- ══════════════════════════════════════
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY users_own ON users FOR ALL USING (id = current_setting('app.user_id')::uuid);
CREATE POLICY settings_own ON user_settings FOR ALL USING (user_id = current_setting('app.user_id')::uuid);
CREATE POLICY notes_own ON exercise_notes FOR ALL USING (user_id = current_setting('app.user_id')::uuid);
CREATE POLICY records_own ON personal_records FOR ALL USING (user_id = current_setting('app.user_id')::uuid);
CREATE POLICY sessions_own ON workout_sessions FOR ALL USING (user_id = current_setting('app.user_id')::uuid);
CREATE POLICY custom_sessions_own ON custom_sessions FOR ALL USING (user_id = current_setting('app.user_id')::uuid);

-- Sets: user owns the parent workout session
CREATE POLICY sets_own ON session_sets FOR ALL USING (
  workout_session_id IN (SELECT id FROM workout_sessions WHERE user_id = current_setting('app.user_id')::uuid)
);

-- Exercise pools: user owns their own, or is member of the family
CREATE POLICY pools_own ON exercise_pools FOR ALL USING (
  (owner_type = 'user' AND owner_id = current_setting('app.user_id')::uuid)
  OR
  (owner_type = 'family' AND owner_id IN (
    SELECT family_id FROM family_members WHERE user_id = current_setting('app.user_id')::uuid
  ))
);

-- Family members: can see members of families they belong to
CREATE POLICY family_members_access ON family_members FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = current_setting('app.user_id')::uuid)
);

-- Family ledger: visible to all family members
CREATE POLICY ledger_family_access ON family_ledger FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = current_setting('app.user_id')::uuid)
);
-- Ledger insert: only own entries
CREATE POLICY ledger_insert_own ON family_ledger FOR INSERT WITH CHECK (
  user_id = current_setting('app.user_id')::uuid
);
-- Ledger update/delete: only own entries
CREATE POLICY ledger_modify_own ON family_ledger FOR UPDATE USING (user_id = current_setting('app.user_id')::uuid);
CREATE POLICY ledger_delete_own ON family_ledger FOR DELETE USING (user_id = current_setting('app.user_id')::uuid);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON exercise_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
