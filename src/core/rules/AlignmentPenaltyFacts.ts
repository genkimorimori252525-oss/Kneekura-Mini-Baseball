export type AlignmentPenaltyInfielderPosition =
  | '1B'
  | '2B'
  | '3B'
  | 'SS';

export type FirstPostPitchInfielderTouchFact = Readonly<{
  kind: 'first_post_pitch_infielder_touch';
  playerId: string;
  registeredPosition: AlignmentPenaltyInfielderPosition;
  tick: number;
}>;

const INFIELD_POSITIONS = new Set<string>([
  '1B',
  '2B',
  '3B',
  'SS',
]);

export const createFirstPostPitchInfielderTouchFact = (
  playerId: string,
  registeredPosition: AlignmentPenaltyInfielderPosition,
  tick: number,
): FirstPostPitchInfielderTouchFact => {
  if (playerId.length === 0) {
    throw new Error('playerId must not be empty');
  }
  if (!INFIELD_POSITIONS.has(registeredPosition)) {
    throw new Error(
      'first post-pitch infielder touch requires 1B, 2B, 3B, or SS',
    );
  }
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(
      'first post-pitch infielder touch tick must be a non-negative safe integer',
    );
  }

  return {
    kind: 'first_post_pitch_infielder_touch',
    playerId,
    registeredPosition,
    tick,
  };
};
