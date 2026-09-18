import { describe, expect, it } from 'vitest';
import {
  createFlyBallFirstFielderTouchFact,
  createRunnerBaseDepartureFact,
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import { evaluateTagUpCompliance } from './TagUpCompliance';

describe('TagUpCompliance', () => {
  it('allows departure at or after first fielder touch even before secure catch', () => {
    const firstTouch = createFlyBallFirstFielderTouchFact(
      'center-fielder',
      1_000_000,
    );

    expect(evaluateTagUpCompliance({
      runnerId: 'runner',
      originBase: 2,
      firstTouch,
      departure: createRunnerBaseDepartureFact(
        'runner',
        2,
        1_050_000,
      ),
      retouch: null,
    })).toEqual({
      kind: 'compliant',
      runnerId: 'runner',
      originBase: 2,
      basis: 'departed_at_or_after_first_touch',
      firstFielderTouchTick: 1_000_000,
      departureTick: 1_050_000,
      legalAdvanceFromTick: 1_050_000,
    });
  });

  it('treats departure on the exact first-touch tick as compliant', () => {
    expect(evaluateTagUpCompliance({
      runnerId: 'runner',
      originBase: 3,
      firstTouch: createFlyBallFirstFielderTouchFact(
        'left-fielder',
        1_000_000,
      ),
      departure: createRunnerBaseDepartureFact(
        'runner',
        3,
        1_000_000,
      ),
      retouch: null,
    }).kind).toBe('compliant');
  });

  it('marks early departure without a valid retouch as appealable instead of automatic out', () => {
    expect(evaluateTagUpCompliance({
      runnerId: 'runner',
      originBase: 2,
      firstTouch: createFlyBallFirstFielderTouchFact(
        'center-fielder',
        1_000_000,
      ),
      departure: createRunnerBaseDepartureFact(
        'runner',
        2,
        990_000,
      ),
      retouch: null,
    })).toEqual({
      kind: 'appealable_early_departure',
      runnerId: 'runner',
      originBase: 2,
      firstFielderTouchTick: 1_000_000,
      departureTick: 990_000,
      retouchTick: null,
    });
  });

  it('restores compliance when the early runner retouches after first fielder touch', () => {
    expect(evaluateTagUpCompliance({
      runnerId: 'runner',
      originBase: 2,
      firstTouch: createFlyBallFirstFielderTouchFact(
        'center-fielder',
        1_000_000,
      ),
      departure: createRunnerBaseDepartureFact(
        'runner',
        2,
        990_000,
      ),
      retouch: createRunnerBaseTouchFact(
        'runner',
        2,
        1_010_000,
      ),
    })).toEqual({
      kind: 'compliant',
      runnerId: 'runner',
      originBase: 2,
      basis: 'retouched_after_first_touch',
      firstFielderTouchTick: 1_000_000,
      departureTick: 990_000,
      retouchTick: 1_010_000,
      legalAdvanceFromTick: 1_010_000,
    });
  });

  it('keeps a retouch before first fielder touch appealable', () => {
    expect(evaluateTagUpCompliance({
      runnerId: 'runner',
      originBase: 2,
      firstTouch: createFlyBallFirstFielderTouchFact(
        'center-fielder',
        1_000_000,
      ),
      departure: createRunnerBaseDepartureFact(
        'runner',
        2,
        980_000,
      ),
      retouch: createRunnerBaseTouchFact(
        'runner',
        2,
        990_000,
      ),
    }).kind).toBe('appealable_early_departure');
  });

  it('rejects mismatched runner/base facts and impossible retouch chronology', () => {
    const firstTouch = createFlyBallFirstFielderTouchFact(
      'center-fielder',
      1_000_000,
    );

    expect(() => evaluateTagUpCompliance({
      runnerId: 'runner',
      originBase: 2,
      firstTouch,
      departure: createRunnerBaseDepartureFact(
        'other',
        2,
        990_000,
      ),
      retouch: null,
    })).toThrow('departure must belong to the evaluated runner');

    expect(() => evaluateTagUpCompliance({
      runnerId: 'runner',
      originBase: 2,
      firstTouch,
      departure: createRunnerBaseDepartureFact(
        'runner',
        3,
        990_000,
      ),
      retouch: null,
    })).toThrow('departure must belong to the origin base');

    expect(() => evaluateTagUpCompliance({
      runnerId: 'runner',
      originBase: 2,
      firstTouch,
      departure: createRunnerBaseDepartureFact(
        'runner',
        2,
        990_000,
      ),
      retouch: createRunnerBaseTouchFact(
        'runner',
        2,
        980_000,
      ),
    })).toThrow('retouch cannot precede departure');
  });
});
