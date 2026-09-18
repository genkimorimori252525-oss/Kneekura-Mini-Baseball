import { describe, expect, it } from 'vitest';
import {
  createDefensiveAppealAttemptFact,
  createFlyBallFirstFielderTouchFact,
  createRunnerBaseDepartureFact,
} from './PhysicalRuleFacts';
import {
  closeAppealWindow,
  createAppealWindow,
} from './AppealWindow';
import { evaluateTagUpCompliance } from './TagUpCompliance';
import { resolveTagUpAppeal } from './TagUpAppealRule';

describe('tag-up appeal vertical slice', () => {
  it('turns an early departure into an out only after a timely explicit appeal', () => {
    const firstTouch = createFlyBallFirstFielderTouchFact(
      'center-fielder',
      1_000_000,
    );
    const compliance = evaluateTagUpCompliance({
      runnerId: 'runner',
      originBase: 2,
      firstTouch,
      departure: createRunnerBaseDepartureFact(
        'runner',
        2,
        990_000,
      ),
      retouch: null,
    });

    expect(compliance.kind).toBe('appealable_early_departure');

    const window = closeAppealWindow(
      createAppealWindow(firstTouch.tick),
      1_500_000,
      'next_pitch_or_play',
    );
    const appeal = createDefensiveAppealAttemptFact(
      'shortstop',
      'runner',
      2,
      'tag_up_early_departure',
      1_300_000,
    );

    expect(resolveTagUpAppeal({
      compliance,
      appeal,
      window,
    })).toEqual({
      kind: 'out',
      runnerId: 'runner',
      classification: 'tag_up_appeal',
      appealedBase: 2,
      outTick: 1_300_000,
      appealTick: 1_300_000,
    });
  });
});
