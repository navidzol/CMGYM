import type {
  MuscleFamily,
  PoolExercise,
  SessionSchedule,
  ScheduleExercise,
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

/**
 * Shuffle array in place (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * SOP Section 6.2: Family Distribution Per Day
 * Across T sessions, every one of the 6 families appears at least once.
 */
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
 * SOP Section 6.3: Time-Filling Algorithm
 * Fill a time budget for a given family from the exercise pool.
 */
function fillTimeForFamily(
  familyCode: MuscleFamily,
  budgetMin: number,
  pools: PoolExercise[],
  restS: number,
): ScheduleExercise[] {
  const familyPool = pools.filter(
    (p) => p.family_code === familyCode && p.type === 'strength'
  );

  if (familyPool.length === 0) return [];

  const budgetS = budgetMin * 60;
  const exercises: ScheduleExercise[] = [];
  let timeUsedS = 0;

  const available = shuffle([...familyPool]);

  for (const ex of available) {
    const sets = DEFAULT_SETS;
    const avgSetDuration = ex.avg_duration_s || DEFAULT_AVG_SET_DURATION_S;
    const timeNeeded = sets * (avgSetDuration + restS);

    if (timeUsedS + timeNeeded <= budgetS) {
      exercises.push({
        exercise_id: ex.id,
        exercise_name: ex.name,
        family_code: familyCode,
        type: 'strength',
        sets,
        reps: DEFAULT_REPS,
        rest_s: restS,
        estimated_duration_s: timeNeeded,
      });
      timeUsedS += timeNeeded;
    } else if (timeUsedS + timeNeeded <= budgetS * (1 + OVERFLOW_TOLERANCE)) {
      // Within 20% overflow tolerance — include and flag
      exercises.push({
        exercise_id: ex.id,
        exercise_name: ex.name,
        family_code: familyCode,
        type: 'strength',
        sets,
        reps: DEFAULT_REPS,
        rest_s: restS,
        estimated_duration_s: timeNeeded,
      });
      timeUsedS += timeNeeded;
      break; // stop after overflow
    } else {
      break; // can't fit anything else
    }
  }

  return exercises;
}

/**
 * Pick a cardio exercise closest to the target duration.
 */
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

/**
 * SOP Section 6: Generate a full week's schedule.
 * Returns an array of SessionSchedule, one per training day.
 */
export function generateWeekSchedule(input: GenerateWeekInput): SessionSchedule[] {
  const {
    sessionsPerWeek,
    sessionDurationMin,
    cardioDurationMin,
    restBetweenSetsS,
    exercisePools,
  } = input;

  const strengthBudgetMin = sessionDurationMin - cardioDurationMin;
  const familyDistribution = distributeFamilies(sessionsPerWeek);

  return familyDistribution.map((dayFamilies) => {
    const timePerFamily = strengthBudgetMin / dayFamilies.length;
    const exercises: ScheduleExercise[] = [];

    for (const family of dayFamilies) {
      const familyExercises = fillTimeForFamily(
        family,
        timePerFamily,
        exercisePools,
        restBetweenSetsS,
      );
      exercises.push(...familyExercises);
    }

    const cardio = pickCardio(exercisePools, cardioDurationMin);

    const totalEstimatedS =
      exercises.reduce((sum, e) => sum + e.estimated_duration_s, 0) +
      (cardio?.estimated_duration_s ?? 0);

    return {
      families: dayFamilies,
      exercises,
      cardio,
      total_estimated_min: Math.round(totalEstimatedS / 60),
    };
  });
}

/**
 * SOP Section 7: Generate a custom session.
 */
export function generateCustomSession(input: GenerateCustomInput): SessionSchedule {
  const {
    selectedFamilies,
    durationMin,
    cardioMin,
    restBetweenSetsS,
    exercisePools,
  } = input;

  const strengthBudget = durationMin - cardioMin;
  const timePerFamily = strengthBudget / selectedFamilies.length;
  const exercises: ScheduleExercise[] = [];

  for (const family of selectedFamilies) {
    const familyExercises = fillTimeForFamily(
      family,
      timePerFamily,
      exercisePools,
      restBetweenSetsS,
    );
    exercises.push(...familyExercises);
  }

  // Redistribute remaining time if a family couldn't fill its budget
  const usedTimeS = exercises.reduce((sum, e) => sum + e.estimated_duration_s, 0);
  const remainingS = strengthBudget * 60 - usedTimeS;

  if (remainingS > 120) {
    // Try to add more exercises from families that have leftover pool
    for (const family of selectedFamilies) {
      const alreadyUsed = new Set(
        exercises.filter((e) => e.family_code === family).map((e) => e.exercise_id)
      );
      const remaining = exercisePools.filter(
        (p) => p.family_code === family && p.type === 'strength' && !alreadyUsed.has(p.id)
      );

      for (const ex of remaining) {
        const timeNeeded = DEFAULT_SETS * ((ex.avg_duration_s || DEFAULT_AVG_SET_DURATION_S) + restBetweenSetsS);
        const currentTotal = exercises.reduce((s, e) => s + e.estimated_duration_s, 0);
        if (currentTotal + timeNeeded <= strengthBudget * 60) {
          exercises.push({
            exercise_id: ex.id,
            exercise_name: ex.name,
            family_code: family,
            type: 'strength',
            sets: DEFAULT_SETS,
            reps: DEFAULT_REPS,
            rest_s: restBetweenSetsS,
            estimated_duration_s: timeNeeded,
          });
        }
      }
    }
  }

  const cardio = cardioMin > 0 ? pickCardio(exercisePools, cardioMin) : null;

  const totalEstimatedS =
    exercises.reduce((sum, e) => sum + e.estimated_duration_s, 0) +
    (cardio?.estimated_duration_s ?? 0);

  return {
    families: selectedFamilies,
    exercises,
    cardio,
    total_estimated_min: Math.round(totalEstimatedS / 60),
  };
}

/**
 * SOP Section 13.3: PR Detection — Epley estimated 1RM
 */
export function calculateEpley1RM(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}
