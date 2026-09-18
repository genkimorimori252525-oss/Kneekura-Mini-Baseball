import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import type { TimedMatchEvent } from '../../core/model/TimedMatchEvent';
import type { Vec3 } from '../../core/model/geometry';

export const MINI_PRESENTATION_CADENCE_MICROS = 55_000 as const;
export const MINI_LOGICAL_WIDTH = 150 as const;
export const MINI_LOGICAL_HEIGHT = 108 as const;
export const MINI_PIXEL_SCALE = 4 as const;

export type BatterHandedness = 'R' | 'L';

export type BatActionType =
  | 'idle'
  | 'normal_swing'
  | 'bunt_show'
  | 'bunt_hold'
  | 'bunt_contact'
  | 'bunt_pullback';

export type BatPose = Readonly<{
  grip: Vec3;
  tip: Vec3;
}>;

export type BatterPresentationState = Readonly<{
  handedness: BatterHandedness;
  action: BatActionType;
  bat: BatPose | null;
}>;

export type PitcherPresentationPose =
  | 'set'
  | 'gather'
  | 'lift'
  | 'stride'
  | 'release'
  | 'finish';

export type CanonicalPresentationSample = Readonly<{
  world: CanonicalWorldSnapshot;
  batter: BatterPresentationState;
  pitcherPose?: PitcherPresentationPose;
}>;

export type MiniCameraMode = 'BATTER_POV' | 'FIELD_OVERHEAD';

export type MiniPresentationFrame = Readonly<{
  tick: number;
  cameraMode: MiniCameraMode;
  sample: CanonicalPresentationSample;
  events: readonly TimedMatchEvent[];
  cutReason?: 'fair_batted_ball_declared';
}>;
