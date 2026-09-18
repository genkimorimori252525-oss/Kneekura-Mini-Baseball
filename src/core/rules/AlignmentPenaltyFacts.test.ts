import { describe, expect, it } from 'vitest';
import {
  createFirstPostPitchInfielderTouchFact,
} from './AlignmentPenaltyFacts';

describe('AlignmentPenaltyFacts', () => {
  it('records the first post-pitch infielder ball touch', () => {
    expect(createFirstPostPitchInfielderTouchFact(
      'ss',
      'SS',
      2_100_000,
    )).toEqual({
      kind: 'first_post_pitch_infielder_touch',
      playerId: 'ss',
      registeredPosition: 'SS',
      tick: 2_100_000,
    });
  });

  it('rejects outfielders because the penalty branch asks for first infielder touch', () => {
    expect(() => createFirstPostPitchInfielderTouchFact(
      'cf',
      'CF' as 'SS',
      2_100_000,
    )).toThrow(
      'first post-pitch infielder touch requires 1B, 2B, 3B, or SS',
    );
  });

  it('rejects invalid identity and tick', () => {
    expect(() => createFirstPostPitchInfielderTouchFact(
      '',
      'SS',
      2_100_000,
    )).toThrow('playerId must not be empty');

    expect(() => createFirstPostPitchInfielderTouchFact(
      'ss',
      'SS',
      -1,
    )).toThrow(
      'first post-pitch infielder touch tick must be a non-negative safe integer',
    );
  });
});
