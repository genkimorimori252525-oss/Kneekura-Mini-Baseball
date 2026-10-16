import type { Vec2, Vec3 } from './geometry';

export type DefensivePosition = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF';

export type DefensiveAssignment =
  | Readonly<{ kind: 'ball_handler' }>
  | Readonly<{ kind: 'base_cover'; base: 1 | 2 | 3 | 4 }>
  | Readonly<{ kind: 'relay'; target: Vec2 }>
  | Readonly<{ kind: 'backup'; target: Vec2 }>
  | Readonly<{ kind: 'deep_coverage'; target: Vec2 }>
  | Readonly<{ kind: 'hold' }>;

export type DefenderWorldState = Readonly<{
  playerId: string;
  registeredPosition: DefensivePosition;
  position: Vec2;
  velocity: Vec2;
  assignment: DefensiveAssignment;
}>;

export type BaserunnerWorldState = Readonly<{
  playerId: string;
  position: Vec2;
  velocity: Vec2;
}>;

export type BallWorldState = Readonly<{
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
}>;

export type CanonicalWorldSnapshot = Readonly<{
  tick: number;
  defenders: readonly DefenderWorldState[];
  runners: readonly BaserunnerWorldState[];
  ball: BallWorldState | null;
}>;
