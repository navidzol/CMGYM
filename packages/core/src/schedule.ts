import type {
  MuscleFamily,
  PoolExercise,
  SessionSchedule,
  ScheduleExercise,
  ScheduleWarning,
  Injury,
  GenerateWeekInput,
  GenerateCustomInput,
} from './types.js';
import {
  FAMILY_COUNT,
  DEFAULT_SETS,
  DEFAULT_REPS,
  DEFAULT_REST_S,
  DEFAULT_AVG_SET_DURATION_S,
  OVERFLOW_TOLERANCE,
} from './constants.js';

const ALL_FAMILIES: MuscleFamily[] = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'];

// Map body_part values from ExerciseDB to readable regions for injury matching
const BODY_PART_ALIASES: Record<string, string[]> = {
  chest: ['chest'],
  back: ['back'],
  shoulders: ['shoulders'],
  'upper arms': ['upper arms'],
  'lower arms': ['lower arms', 'forearms'],
  'upper legs': ['upper legs', 'thighs'],
  'lower legs': ['lower legs', 'calves'],
  waist: ['waist', 'core', 'abs'],
  neck: ['neck'],
  cardio: ['cardio'],
};

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function distributeFamilies(sessionsPerWeek: number): MuscleFamily[][] {
  const familiesPerSession = Math.ceil(FAMILY_COUNT / sessionsPerWeek);
  const rotated = [...ALL_FAMILIES];
  shuffle(rotated);

  const distribution: MuscleFamily[][] = [];
  let cursor = 0;

  for (let day = 0; day < sessionsPerWeek; day++) {
    const dayFamilies: MuscleFamily[] = [];
    for (let i = 0; i < familiesPerSession && dayFamilies.length < familiesPerSession; i++) {
      dayFamilies.push(rotated[cursor % FAMILY_COUNT]);
      cursor++;
    }
    distribution.push(dayFamilies);
  }

  return distribution;
}

/**
 * Filter pools by user equipment. If no equipment list provided, return all.
 */
function filterByEquipment(pools: PoolExercise[], userEquipment?: string[]): PoolExercise[] {
  if (!userEquipment || userEquipment.length === 0) return pools;
  const equipSet = new Set(userEquipment.map(e => e.toLowerCase()));
  // Always include body weight exercises
  equipSet.add('body weight');
  return pools.filter(p => !p.equipment || equipSet.has(p.equipment.toLowerCase()));
}

/**
 * Check if an exercise targets an injured body region.
 */
function checkInjury(exercise: PoolExercise, injuries: Injury[]): Injury | null {
  if (!injuries || injuries.length === 0) return null;
  for (const injury of injuries) {
    const region = injury.body_region.toLowerCase();
    // Check body_part match
    if (exercise.body_part && exercise.body_part.toLowerCase() === region) return injury;
    // Check aliases
    for (const [part, aliases] of Object.entries(BODY_PART_ALIASES)) {
      if (aliases.includes(region) && exercise.body_part?.toLowerCase() === part) return injury;
    }
    // Check target_muscle contains the region name
    if (exercise.target_muscle && exercise.target_muscle.toLowerCase().includes(region)) return injury;
  }
  return null;
}

function fillTimeForFamily(
  familyCode: MuscleFamily,
  budgetMin: number,
  pools: PoolExercise[],
  restS: number,
  injuries?: Injury[],
): { exercises: ScheduleExercise[]; warnings: ScheduleWarning[] } {
  const familyPool = pools.filter(
    (p) => p.family_code === familyCode && p.type === 'strength'
  );

  if (familyPool.length === 0) return { exercises: [], warnings: [] };

  const budgetS = budgetMin * 60;
  const exercises: ScheduleExercise[] = [];
  const warnings: ScheduleWarning[] = [];
  let timeUsedS = 0;

  const available = shuffle([...familyPool]);

  for (const ex of available) {
    // Check injury
    const injury = injuries ? checkInjury(ex, injuries) : null;
    if (injury?.mode === 'avoid') continue; // Skip avoided exercises

    const sets = DEFAULT_SETS;
    const avgSetDuration = ex.avg_duration_s || DEFAULT_AVG_SET_DURATION_S;
    const timeNeeded = sets * (avgSetDuration + restS);

    if (timeUsedS + timeNeeded <= budgetS) {
      const schedEx: ScheduleExercise = {
        exercise_id: ex.id,
        exercise_name: ex.name,
        family_code: familyCode,
        type: 'strength',
        sets,
        reps: DEFAULT_REPS,
        rest_s: restS,
        estimated_duration_s: timeNeeded,
      };
      if (injury?.mode === 'warn') {
        schedEx.injury_warning = `Targets injured region: ${injury.body_region}`;
        warnings.push({
          exercise_id: ex.id,
          exercise_name: ex.name,
          reason: `Targets injured region: ${injury.body_region}`,
        });
      }
      exercises.push(schedEx);
      timeUsedS += timeNeeded;
    } else if (timeUsedS + timeNeeded <= budgetS * (1 + OVERFLOW_TOLERANCE)) {
      const schedEx: ScheduleExercise = {
        exercise_id: ex.id,
        exercise_name: ex.name,
        family_code: familyCode,
        type: 'strength',
        sets,
        reps: DEFAULT_REPS,
        rest_s: restS,
        estimated_duration_s: timeNeeded,
      };
      if (injury?.mode === 'warn') {
        schedEx.injury_warning = `Targets injured region: ${injury.body_region}`;
        warnings.push({
          exercise_id: ex.id,
          exercise_name: ex.name,
          reason: `Targets injured region: ${injury.body_region}`,
        });
      }
      exercises.push(schedEx);
      timeUsedS += timeNeeded;
      break;
    } else {
      break;
    }
  }

  return { exercises, warnings };
}

function pickCardio(
  pools: PoolExercise[],
  targetDurationMin: number,
): ScheduleExercise | null {
  const cardioPool = pools.filter((p) => p.type === 'cardio');
  if (cardioPool.length === 0) return null;

  const targetS = targetDurationMin * 60;
  const sorted = [...cardioPool].sort(
    (a, b) => Math.abs(a.avg_duration_s - targetS) - Math.abs(b.avg_duration_s - targetS)
  );

  const chosen = sorted[0];
  return {
    exercise_id: chosen.id,
    exercise_name: chosen.name,
    family_code: null,
    type: 'cardio',
    sets: 1,
    reps: 1,
    rest_s: 0,
    estimated_duration_s: targetS,
  };
}

export function generateWeekSchedule(input: GenerateWeekInput): SessionSchedule[] {
  const {
    sessionsPerWeek,
    sessionDurationMin,
    cardioDurationMin,
    restBetweenSetsS,
    exercisePools,
    userEquipment,
    injuries,
  } = input;

  const filteredPools = filterByEquipment(exercisePools, userEquipment);
  const strengthBudgetMin = sessionDurationMin - cardioDurationMin;
  const familyDistribution = distributeFamilies(sessionsPerWeek);

  return familyDistribution.map((dayFamilies) => {
    const timePerFamily = strengthBudgetMin / dayFamilies.length;
    const exercises: ScheduleExercise[] = [];
    const allWarnings: ScheduleWarning[] = [];

    for (const family of dayFamilies) {
      const { exercises: familyExercises, warnings } = fillTimeForFamily(
        family,
        timePerFamily,
        filteredPools,
        restBetweenSetsS,
        injuries,
      );
      exercises.push(...familyExercises);
      allWarnings.push(...warnings);
    }

    const cardio = pickCardio(filteredPools, cardioDurationMin);

    const totalEstimatedS =
      exercises.reduce((sum, e) => sum + e.estimated_duration_s, 0) +
      (cardio?.estimated_duration_s ?? 0);

    const schedule: SessionSchedule = {
      families: dayFamilies,
      exercises,
      cardio,
      total_estimated_min: Math.round(totalEstimatedS / 60),
    };
    if (allWarnings.length > 0) schedule.warnings = allWarnings;
    return schedule;
  });
}

export function generateCustomSession(input: GenerateCustomInput): SessionSchedule {
  const {
    selectedFamilies,
    durationMin,
    cardioMin,
    restBetweenSetsS,
    exercisePools,
    userEquipment,
    injuries,
  } = input;

  const filteredPools = filterByEquipment(exercisePools, userEquipment);
  const strengthBudget = durationMin - cardioMin;
  const timePerFamily = strengthBudget / selectedFamilies.length;
  const exercises: ScheduleExercise[] = [];
  const allWarnings: ScheduleWarning[] = [];

  for (const family of selectedFamilies) {
    const { exercises: familyExercises, warnings } = fillTimeForFamily(
      family,
      timePerFamily,
      filteredPools,
      restBetweenSetsS,
      injuries,
    );
    exercises.push(...familyExercises);
    allWarnings.push(...warnings);
  }

  // Redistribute remaining time
  const usedTimeS = exercises.reduce((sum, e) => sum + e.estimated_duration_s, 0);
  const remainingS = strengthBudget * 60 - usedTimeS;

  if (remainingS > 120) {
    for (const family of selectedFamilies) {
      const alreadyUsed = new Set(
        exercises.filter((e) => e.family_code === family).map((e) => e.exercise_id)
      );
      const remaining = filteredPools.filter(
        (p) => p.family_code === family && p.type === 'strength' && !alreadyUsed.has(p.id)
      );

      for (const ex of remaining) {
        const injury = injuries ? checkInjury(ex, injuries) : null;
        if (injury?.mode === 'avoid') continue;

        const timeNeeded = DEFAULT_SETS * ((ex.avg_duration_s || DEFAULT_AVG_SET_DURATION_S) + restBetweenSetsS);
        const currentTotal = exercises.reduce((s, e) => s + e.estimated_duration_s, 0);
        if (currentTotal + timeNeeded <= strengthBudget * 60) {
          const schedEx: ScheduleExercise = {
            exercise_id: ex.id,
            exercise_name: ex.name,
            family_code: family,
            type: 'strength',
            sets: DEFAULT_SETS,
            reps: DEFAULT_REPS,
            rest_s: restBetweenSetsS,
            estimated_duration_s: timeNeeded,
          };
          if (injury?.mode === 'warn') {
            schedEx.injury_warning = `Targets injured region: ${injury.body_region}`;
            allWarnings.push({
              exercise_id: ex.id,
              exercise_name: ex.name,
              reason: `Targets injured region: ${injury.body_region}`,
            });
          }
          exercises.push(schedEx);
        }
      }
    }
  }

  const cardio = cardioMin > 0 ? pickCardio(filteredPools, cardioMin) : null;

  const totalEstimatedS =
    exercises.reduce((sum, e) => sum + e.estimated_duration_s, 0) +
    (cardio?.estimated_duration_s ?? 0);

  const schedule: SessionSchedule = {
    families: selectedFamilies,
    exercises,
    cardio,
    total_estimated_min: Math.round(totalEstimatedS / 60),
  };
  if (allWarnings.length > 0) schedule.warnings = allWarnings;
  return schedule;
}

export function calculateEpley1RM(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}
