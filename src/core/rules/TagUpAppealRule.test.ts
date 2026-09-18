import { describe, expect, it } from 'vitest';
import {
  createDefensiveAppealAttemptFact,
  createFlyBallFirstFielderTouchFact,
  createRunnerBaseDepartureFact,
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import {
  closeAppealWindow,
  createAppealWindow,
} from './AppealWindow';
import { evaluateTagUpCompliance } from './TagUpCompliance';
import { resolveTagUpAppeal } from './TagUpAppealRule';

const violation = () => evaluateTagUpCompliance({
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
});

describe('TagUpAppealRule', () => {
  it('rules the runner out only when an explicit appeal is timely', () => {
    const appeal = createDefensiveAppealAttemptFact(
      'shortstop',
      'runner',
      2,
      'tag_up_early_departure',
      1_300_000,
    );
    const window = closeAppealWindow(
      createAppealWindow(1_000_000),
      1_500_000,
      'next_pitch_or_play',
    );

    expect(resolveTagUpAppeal({
      compliance: violation(),
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

  it('does not create an out after the appeal window has expired', () => {
    expect(resolveTagUpAppeal({
      compliance: violation(),
      appeal: createDefensiveAppealAttemptFact(
        'shortstop',
        'runner',
        2,
        'tag_up_early_departure',
        1_600_000,
      ),
      window: closeAppealWindow(
        createAppealWindow(1_000_000),
        1_500_000,
        'next_pitch_or_play',
      ),
    })).toEqual({
      kind: 'appeal_expired',
      runnerId: 'runner',
      appealedBase: 2,
      appealTick: 1_600_000,
      windowClosedAtTick: 1_500_000,
    });
  });

  it('preserves same-tick appeal and window closing as simultaneous unresolved', () => {
    expect(resolveTagUpAppeal({
      compliance: violation(),
      appeal: createDefensiveAppealAttemptFact(
        'shortstop',
        'runner',
        2,
        'tag_up_early_departure',
        1_500_000,
      ),
      window: closeAppealWindow(
        createAppealWindow(1_000_000),
        1_500_000,
        'next_pitch_or_play',
      ),
    })).toEqual({
      kind: 'simultaneous_unresolved',
      runnerId: 'runner',
      appealedBase: 2,
      tick: 1_500_000,
    });
  });

  it('returns no violation after a valid retouch even if the defense appeals', () => {
    const compliance = evaluateTagUpCompliance({
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
    });

    expect(resolveTagUpAppeal({
      compliance,
      appeal: createDefensiveAppealAttemptFact(
        'shortstop',
        'runner',
        2,
        'tag_up_early_departure',
        1_300_000,
      ),
      window: createAppealWindow(1_000_000),
    })).toEqual({
      kind: 'no_violation',
      runnerId: 'runner',
      appealedBase: 2,
    });
  });

  it('rejects appeals aimed at the wrong runner, base, or reason', () => {
    const window = createAppealWindow(1_000_000);

    expect(() => resolveTagUpAppeal({
      compliance: violation(),
      appeal: createDefensiveAppealAttemptFact(
        'shortstop',
        'other-runner',
        2,
        'tag_up_early_departure',
        1_300_000,
      ),
      window,
    })).toThrow('appeal must target the evaluated runner');

    expect(() => resolveTagUpAppeal({
      compliance: violation(),
      appeal: createDefensiveAppealAttemptFact(
        'shortstop',
        'runner',
        3,
        'tag_up_early_departure',
        1_300_000,
      ),
      window,
    })).toThrow('appeal must target the tag-up origin base');
  });
});
