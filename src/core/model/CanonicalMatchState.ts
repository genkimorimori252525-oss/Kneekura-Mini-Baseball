export type HalfInning = 'top' | 'bottom';

export type BaseOccupancy = Readonly<{
  first: string | null;
  second: string | null;
  third: string | null;
}>;

export type CanonicalMatchState = Readonly<{
  inning: number;
  half: HalfInning;
  outs: number;
  balls: number;
  strikes: number;
  bases: BaseOccupancy;
  score: Readonly<{ away: number; home: number }>;
  playId: number;
}>;
