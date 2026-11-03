import { describe, expect, it } from 'vitest';
import { LIVE_FIELD_COVER_POLICY_V1, liveFieldCoverDutyV1, liveFieldCoverOrderV1, validateLiveFieldCoverPolicyV1 } from './LiveFieldRangeV1';

const c = (playerId: string, ballSeconds: number | null, baseSeconds: number) => ({ playerId, ballSeconds, baseSeconds });

describe('field cover V1', () => {
  it('accepts only the exact policy', () => {
    expect(validateLiveFieldCoverPolicyV1(LIVE_FIELD_COVER_POLICY_V1)).toBe(LIVE_FIELD_COVER_POLICY_V1);
    expect(() => validateLiveFieldCoverPolicyV1({ ...LIVE_FIELD_COVER_POLICY_V1, extra: 1 } as never)).toThrow();
    expect(() => validateLiveFieldCoverPolicyV1({ version: 'x', sourceId: 'y' } as never)).toThrow();
  });

  it('gives second to whoever gets there first, where the fixed order would send the shortstop', () => {
    // A grounder to the right side. The shortstop is shaded toward third, a little further from the bag.
    expect(liveFieldCoverOrderV1(2, 6)[0]).toBe('SS');
    const duty = liveFieldCoverDutyV1({ holder: null, candidates: [c('1B', 1.1, 3.4), c('2B', 1.6, 1.9), c('SS', 2.6, 2.2), c('P', 2.0, 2.9)] });
    expect(duty).toEqual({ chaser: '1B', duty: '2B', dutySeconds: 1.9 });
  });

  it('never gives the bag to the man taking the ball, even when he is nearest to it', () => {
    const duty = liveFieldCoverDutyV1({ holder: null, candidates: [c('2B', 1.0, 1.2), c('SS', 2.0, 1.8)] });
    expect(duty).toMatchObject({ chaser: '2B', duty: 'SS' });
  });

  it('lets an outfielder be the man taking the ball, so an infielder it went past can cover', () => {
    const duty = liveFieldCoverDutyV1({ holder: null, candidates: [c('CF', 2.4, 6), c('SS', 3.1, 1.5), c('2B', 3.0, 1.7)] });
    expect(duty).toMatchObject({ chaser: 'CF', duty: 'SS' });
  });

  it('excludes the holder, and with the ball held nobody else counts as taking it', () => {
    const duty = liveFieldCoverDutyV1({ holder: 'SS', candidates: [c('SS', 0, .2), c('2B', 1, .9), c('3B', 2, 1.4)] });
    expect(duty).toEqual({ chaser: null, duty: '2B', dutySeconds: .9 });
  });

  it('follows speed: the same alignment with a slower second baseman sends the shortstop', () => {
    const duty = liveFieldCoverDutyV1({ holder: null, candidates: [c('1B', 1.1, 3.4), c('2B', 1.9, 2.4), c('SS', 2.6, 2.2)] });
    expect(duty.duty).toBe('SS');
  });

  it('breaks an exact tie by id, so every look gives the same answer', () => {
    const a = liveFieldCoverDutyV1({ holder: null, candidates: [c('P', 1, 3), c('SS', 2, 1.5), c('2B', 2, 1.5)] }),
      b = liveFieldCoverDutyV1({ holder: null, candidates: [c('2B', 2, 1.5), c('SS', 2, 1.5), c('P', 1, 3)] });
    expect(a).toEqual(b);
    expect(a.duty).toBe('2B');
  });
});
