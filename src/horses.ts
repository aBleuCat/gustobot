import horseData from './horses.json' with { type: 'json' };

export interface HorseData {
  name: string;
  value: number;
  spawn?: boolean;
  link?: string;
}

export type HorseValues = Record<string, HorseData>;

export const HORSE_VALUES: HorseValues = horseData as HorseValues;
