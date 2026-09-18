import { describe, expect, it } from 'vitest';
import {
  createFlyBallFirstFielderTouchFact,
  createRunnerBaseDepartureFact,
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import { resolveFlyCatch } from './FlyCatchRule';
import { evaluateTagUpCompliance } from './TagUpCompliance';

describe('fly catch -> tag-up compliance vertical slice', () => {
  it('allows a runner to leave after first touch even while the fly is still being secured', () => {
    const firstTouch = createFlyBallFirstFielderTouchFact(
      'center-fielder',
      1_000_000,
    );
    const flyCatch = resolveFlyCatch({
      batterRunnerId: 'batter',
      firstTouch,
      secureCatchTick: 1_150_000,
      firstGroundContactTick: null,
    });

    expect(flyCatch).toMatchObject({
      kind: 'caught',
      outTick: 1_150_000,
      firstFielderTouchTick: 1_000_000,
    });

    const tagUp = evaluateTagUpCompliance({
      runnerId: 'runner-on-third',
      originBase: 3,
      firstTouch,
      departure: createRunnerBaseDepartureFact(
        'runner-on-third',
        3,
        1_050_000,
      ),
      retouch: null,
    });

    expect(tagUp).toEqual({
      kind: 'compliant',
      runnerId: 'runner-on-third',
      originBase: 3,
      basis: 'departed_at_or_after_first_touch',
      firstFielderTouchTick: 1_000_000,
      departureTick: 1_050_000,
      legalAdvanceFromTick: 1_050_000,
    });
  });

  it('leaves an early departure appealable until the runner retouches after first touch', () => {
    const firstTouch = createFlyBallFirstFielderTouchFact(
      'left-fielder',
      2_000_000,
    );
    const departure = createRunnerBaseDepartureFact(
      'runner-on-second',
      2,
      1_990_000,
    );

    const early = evaluateTagUpCompliance({
      runnerId: 'runner-on-second',
      originBase: 2,
      firstTouch,
      departure,
      retouch: null,
    });
    expect(early.kind).toBe('appealable_early_departure');

    const corrected = evaluateTagUpCompliance({
      runnerId: 'runner-on-second',
      originBase: 2,
      firstTouch,
      departure,
      retouch: createRunnerBaseTouchFact(
        'runner-on-second',
        2,
        2_010_000,
      ),
    });
    expect(corrected).toMatchObject({
      kind: 'compliant',
      basis: 'retouched_after_first_touch',
      legalAdvanceFromTick: 2_010_000,
    });
  });
});
