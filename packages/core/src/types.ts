// ══════════════════════════════════════
// CMGYM Core Types
// ══════════════════════════════════════

export type MuscleFamily = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6';

export type ExerciseType = 'strength' | 'cardio' | 'mobility';

export type SessionMode = 'standard' | 'random' | 'custom';

export type TimerMode = 'rest' | 'work' | 'amrap' | 'emom';

export interface Exercise {
  id: string;
  name: string;
  external_id?: string;
  muscle_family_id?: string;
  gif_url?: string;
  video_url?: string;
  instructions_json: string[];
  avg_duration_s: number;
  type: ExerciseType;
  equipment?: string;
  body_part?: string;
  target_muscle?: string;
}

export interface PoolExercise extends Exercise {
  family_code: MuscleFamily | null;
  sort_order: number;
}

export interface Injury {
  body_region: string;
  mode: 'avoid' | 'warn';
}

export interface ScheduleWarning {
  exercise_id: string;
  exercise_name: string;
  reason: string;
}

export interface ScheduleExercise {
  exercise_id: string;
  exercise_name: string;
  family_code: MuscleFamily | null;
  type: ExerciseType;
  sets: number;
  reps: number;
  rest_s: number;
  estimated_duration_s: number;
  injury_warning?: string;
}

export interface SessionSchedule {
  families: MuscleFamily[];
  exercises: ScheduleExercise[];
  cardio: ScheduleExercise | null;
  total_estimated_min: number;
  warnings?: ScheduleWarning[];
}

export interface UserSettings {
  sessions_per_week: number;
  session_duration_min: number;
  cardio_duration_min: number;
  rest_between_sets_s: number;
  auto_rest: boolean;
  timer_sound: 'silent' | 'beep' | 'voice';
  vibration: 'off' | 'light' | 'strong';
  weight_unit: 'kg' | 'lb';
  distance_unit: 'km' | 'mi';
  theme: 'dark' | 'light' | 'system';
}

export interface GenerateWeekInput {
  sessionsPerWeek: number;
  sessionDurationMin: number;
  cardioDurationMin: number;
  restBetweenSetsS: number;
  exercisePools: PoolExercise[];
  userEquipment?: string[];
  injuries?: Injury[];
}

export interface GenerateCustomInput {
  selectedFamilies: MuscleFamily[];
  durationMin: number;
  cardioMin: number;
  restBetweenSetsS: number;
  exercisePools: PoolExercise[];
  userEquipment?: string[];
  injuries?: Injury[];
}
