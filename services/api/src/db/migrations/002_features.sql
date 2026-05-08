-- Migration 002: Color palettes, equipment tracking, injury system, user profile fields

-- 1. Add color_palette to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS color_palette TEXT DEFAULT 'default';

-- 2. Add equipment/body_part/target to exercises (from ExerciseDB data)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS body_part TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS target_muscle TEXT;

-- 3. User equipment preferences
CREATE TABLE IF NOT EXISTS user_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  equipment_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, equipment_name)
);
CREATE INDEX IF NOT EXISTS idx_user_equipment_user ON user_equipment(user_id);

-- 4. User injuries
CREATE TABLE IF NOT EXISTS user_injuries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  body_region TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'warn' CHECK (mode IN ('avoid', 'warn')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, body_region)
);
CREATE INDEX IF NOT EXISTS idx_user_injuries_user ON user_injuries(user_id);

-- 5. User profile fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(5,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm DECIMAL(5,1);
