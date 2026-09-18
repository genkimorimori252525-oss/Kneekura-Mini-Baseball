import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  runP9FixedSeedBaseline,
} from './P9FixedSeedBaseline';

const fingerprintsOf = (
  result: ReturnType<
    typeof runP9FixedSeedBaseline
  >,
): readonly string[] => result.scenarios.map(
  (scenario) => scenario.observedFingerprint,
);

describe('P9FixedSeedBaseline', () => {
  it('repeats the same real-Core evidence within one process before any baseline is frozen', () => {
    const first = runP9FixedSeedBaseline();
    const second = runP9FixedSeedBaseline();

    expect(first.unfrozen).toBe(3);
    expect(first.matched).toBe(0);
    expect(first.mismatched).toBe(0);
    expect(fingerprintsOf(first))
      .toEqual(fingerprintsOf(second));

    expect(
      first.scenarios[2].evidence,
    ).toMatchObject({
      appealResult: {
        kind: 'out',
        classification: 'tag_up_appeal',
      },
    });

    console.log(
      'P9_FIXED_SEED_BASELINE '
      + JSON.stringify(
        first.scenarios.map((scenario) => ({
          scenarioId: scenario.scenarioId,
          observedFingerprint:
            scenario.observedFingerprint,
        })),
      ),
    );
  });
});