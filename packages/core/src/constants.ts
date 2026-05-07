import type { MuscleFamily } from './types.js';

export const MUSCLE_FAMILIES: { code: MuscleFamily; name: string; colour: string }[] = [
  { code: 'F1', name: 'Upper Front', colour: '#E84F4F' },
  { code: 'F2', name: 'Upper Back', colour: '#4F8DE8' },
  { code: 'F3', name: 'Core Front', colour: '#E8A84F' },
  { code: 'F4', name: 'Core Back', colour: '#4FE8A8' },
  { code: 'F5', name: 'Lower Front', colour: '#A84FE8' },
  { code: 'F6', name: 'Lower Back', colour: '#E8E84F' },
];

export const FAMILY_COUNT = 6;

export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = 10;
export const DEFAULT_REST_S = 90;
export const DEFAULT_AVG_SET_DURATION_S = 45;

export const OVERFLOW_TOLERANCE = 0.2; // 20% bin-packing tolerance

export const COLOURS = {
  brand: '#5B4FE8',
  teal: '#0ABFBC',
  bg0: '#0D0D1A',
  bg1: '#1A1A2E',
  bg2: '#2D2D44',
  muted: '#6B6B8A',
  orange: '#F97316',
  green: '#22C55E',
} as const;
