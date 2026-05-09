// WOD (Workout of the Day) format system
// Organizes a flat list of exercises into structured blocks with formats

export type WodFormat = 'standard' | 'for-time' | 'amrap' | 'emom' | 'tabata' | 'superset';

export interface WodBlock {
  format: WodFormat;
  label: string; // e.g. "3 Rounds for Time", "AMRAP 5min"
  rounds: number;
  timeCap?: number; // seconds (for AMRAP, EMOM, Tabata)
  restAfter?: number; // seconds rest after this block
  exercises: WodExercise[];
}

export interface WodExercise {
  exercise_id: string;
  exercise_name: string;
  type: string;
  sets: number;
  reps: number;
  rest_s: number;
  injury_warning?: string;
  duration_s?: number; // for timed exercises (e.g. "1min plank")
}

export interface WodStructure {
  name: string; // e.g. "WOD #1"
  blocks: WodBlock[];
}

export const WOD_FORMATS: { id: WodFormat; name: string; desc: string }[] = [
  { id: 'standard', name: 'Standard', desc: 'One exercise at a time, complete all sets before moving on.' },
  { id: 'for-time', name: 'For Time', desc: 'Complete all rounds as fast as possible. Exercises grouped into circuits.' },
  { id: 'amrap', name: 'AMRAP', desc: 'As Many Rounds As Possible within a time cap.' },
  { id: 'emom', name: 'EMOM', desc: 'Every Minute On the Minute. One exercise per minute.' },
  { id: 'tabata', name: 'Tabata', desc: '20 seconds work / 10 seconds rest for 8 rounds per exercise.' },
  { id: 'superset', name: 'Superset', desc: 'Pair exercises together. Alternate between pairs with minimal rest.' },
];

/**
 * Takes a flat list of exercises and organizes them into WOD blocks
 * based on the selected format.
 */
export function buildWodStructure(
  exercises: WodExercise[],
  format: WodFormat,
): WodStructure {
  if (format === 'standard' || exercises.length === 0) {
    return {
      name: 'Workout',
      blocks: [{
        format: 'standard',
        label: 'Complete each exercise',
        rounds: 1,
        exercises,
      }],
    };
  }

  // Separate strength/compound exercises from accessory/isolation
  const main = exercises.filter(e => e.type === 'strength' || e.type === 'compound');
  const cardio = exercises.filter(e => e.type === 'cardio');
  const all = [...main, ...cardio];

  switch (format) {
    case 'for-time':
      return buildForTime(all);
    case 'amrap':
      return buildAmrap(all);
    case 'emom':
      return buildEmom(all);
    case 'tabata':
      return buildTabata(all);
    case 'superset':
      return buildSuperset(all);
    default:
      return { name: 'Workout', blocks: [{ format: 'standard', label: 'Complete each exercise', rounds: 1, exercises }] };
  }
}

function buildForTime(exercises: WodExercise[]): WodStructure {
  const blocks: WodBlock[] = [];

  if (exercises.length <= 3) {
    blocks.push({
      format: 'for-time',
      label: '3 Rounds for Time',
      rounds: 3,
      exercises,
    });
  } else if (exercises.length <= 6) {
    const mid = Math.ceil(exercises.length / 2);
    blocks.push({
      format: 'for-time',
      label: '3 Rounds for Time',
      rounds: 3,
      exercises: exercises.slice(0, mid),
      restAfter: 120,
    });
    blocks.push({
      format: 'for-time',
      label: '3 Rounds for Time',
      rounds: 3,
      exercises: exercises.slice(mid),
    });
  } else {
    // 7+ exercises: 2 main circuits + superset finisher
    const mainSize = Math.floor((exercises.length - 2) / 2);
    blocks.push({
      format: 'for-time',
      label: '3 Rounds for Time',
      rounds: 3,
      exercises: exercises.slice(0, mainSize),
      restAfter: 120,
    });
    blocks.push({
      format: 'for-time',
      label: '3 Rounds for Time',
      rounds: 3,
      exercises: exercises.slice(mainSize, mainSize * 2),
      restAfter: 120,
    });
    const remaining = exercises.slice(mainSize * 2);
    if (remaining.length > 0) {
      blocks.push({
        format: 'superset',
        label: 'Superset for Quality',
        rounds: 3,
        exercises: remaining,
      });
    }
  }

  return { name: 'WOD', blocks };
}

function buildAmrap(exercises: WodExercise[]): WodStructure {
  const blocks: WodBlock[] = [];

  if (exercises.length <= 4) {
    blocks.push({
      format: 'amrap',
      label: 'AMRAP 12 min',
      rounds: 0, // as many as possible
      timeCap: 720,
      exercises,
    });
  } else {
    const mid = Math.ceil(exercises.length / 2);
    blocks.push({
      format: 'amrap',
      label: 'AMRAP 8 min',
      rounds: 0,
      timeCap: 480,
      exercises: exercises.slice(0, mid),
      restAfter: 120,
    });
    blocks.push({
      format: 'amrap',
      label: 'AMRAP 8 min',
      rounds: 0,
      timeCap: 480,
      exercises: exercises.slice(mid),
    });
  }

  return { name: 'WOD', blocks };
}

function buildEmom(exercises: WodExercise[]): WodStructure {
  // Each exercise gets its own minute. Total rounds = total minutes.
  const totalMinutes = Math.min(exercises.length * 3, 24); // 3 rounds per exercise, cap at 24min
  const roundsPerExercise = Math.floor(totalMinutes / exercises.length);

  return {
    name: 'WOD',
    blocks: [{
      format: 'emom',
      label: `EMOM ${totalMinutes} min`,
      rounds: roundsPerExercise,
      timeCap: totalMinutes * 60,
      exercises: exercises.map(e => ({ ...e, reps: Math.min(e.reps, 12) })),
    }],
  };
}

function buildTabata(exercises: WodExercise[]): WodStructure {
  // Tabata: 20s work / 10s rest, 8 rounds per exercise
  // Group exercises into sets of 2-3 for variety
  const blocks: WodBlock[] = [];
  const chunkSize = Math.min(3, exercises.length);

  for (let i = 0; i < exercises.length; i += chunkSize) {
    const chunk = exercises.slice(i, i + chunkSize);
    blocks.push({
      format: 'tabata',
      label: `Tabata ${Math.floor(i / chunkSize) + 1}`,
      rounds: 8,
      timeCap: chunk.length * 8 * 30, // 30s per round (20 work + 10 rest)
      exercises: chunk,
      restAfter: i + chunkSize < exercises.length ? 60 : undefined,
    });
  }

  return { name: 'WOD', blocks };
}

function buildSuperset(exercises: WodExercise[]): WodStructure {
  const blocks: WodBlock[] = [];

  for (let i = 0; i < exercises.length; i += 2) {
    const pair = exercises.slice(i, i + 2);
    blocks.push({
      format: 'superset',
      label: `Superset ${Math.floor(i / 2) + 1}`,
      rounds: 3,
      exercises: pair,
      restAfter: i + 2 < exercises.length ? 90 : undefined,
    });
  }

  return { name: 'WOD', blocks };
}
