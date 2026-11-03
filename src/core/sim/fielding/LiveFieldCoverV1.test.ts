import { describe, expect, it } from 'vitest';
import { LIVE_FIELD_COVER_CALIBRATION_V1, LIVE_FIELD_COVER_POLICY_V1, liveFieldCoverDutyV1, validateLiveFieldCoverPolicyV1 } from './LiveFieldRangeV1';

/** playerId, when he can take the ball in time (null: not in time), when a stab or dive gives him a shot (null: none), time to the bag. */
const c = (playerId: string, inTimeSeconds: number | null, shotSeconds: number | null, baseSeconds: number) => ({ playerId, inTimeSeconds, shotSeconds, baseSeconds });
const duty = (holder: string | null, ...candidates: ReturnType<typeof c>[]) =>
  liveFieldCoverDutyV1({ holder, chaseWindowSeconds: LIVE_FIELD_COVER_CALIBRATION_V1.chaseWindowSeconds, candidates });
const sorted = (xs: readonly string[]) => xs.slice().sort();

describe('field cover V1', () => {
  it('accepts only the exact policy', () => {
    expect(validateLiveFieldCoverPolicyV1(LIVE_FIELD_COVER_POLICY_V1)).toBe(LIVE_FIELD_COVER_POLICY_V1);
    expect(() => validateLiveFieldCoverPolicyV1({ ...LIVE_FIELD_COVER_POLICY_V1, extra: 1 } as never)).toThrow();
    expect(() => validateLiveFieldCoverPolicyV1({ version: 'x', sourceId: 'y' } as never)).toThrow();
  });

  it('on a ball in the hole the pitcher stabs, both men there go, and the second baseman covers second', () => {
    const d = duty(null, c('P', null, .3, 3.3), c('3B', null, 1.7, 3.2), c('SS', 2.2, null, 1.9), c('2B', 3.3, null, 1.9), c('1B', 4.5, null, 3.3));
    expect(sorted(d.chasers)).toEqual(['3B', 'P', 'SS']);
    expect(d.duty).toBe('2B');
  });

  it('up the middle the nearer man goes and the other takes the bag', () => {
    const d = duty(null, c('SS', 1.1, null, 1.4), c('2B', 1.6, null, 1.3), c('P', null, .4, 2.5));
    expect(sorted(d.chasers)).toEqual(['P', 'SS']);
    expect(d.duty).toBe('2B');
  });

  it('sends the pitcher to first on a ball to the right side', () => {
    const d = duty(null, c('1B', 1.2, null, 1.5), c('2B', 1.3, null, 2.6), c('P', null, null, 2.1), c('C', null, null, 4.5));
    expect(sorted(d.chasers)).toEqual(['1B', '2B']);
    expect(d.duty).toBe('P');
  });

  it('follows ability: a second baseman quick enough to share the ball leaves second to the shortstop', () => {
    const slow = duty(null, c('SS', 1.1, null, 1.6), c('2B', 1.6, null, 1.4)), quick = duty(null, c('SS', 1.1, null, 1.6), c('2B', 1.4, null, 1.4));
    expect(slow.duty).toBe('2B');
    expect(quick.duty).toBe(null);
    expect(duty(null, c('SS', 1.1, null, 1.6), c('2B', 1.4, null, 1.4), c('3B', null, null, 2.2)).duty).toBe('3B');
  });

  it('frees an infielder the ball has gone past to cover', () => {
    const d = duty(null, c('CF', 2.6, null, 6), c('SS', null, null, 1.5), c('2B', null, null, 1.7));
    expect(d).toMatchObject({ chasers: ['CF'], duty: 'SS' });
  });

  it('with the ball held, gives the bag to the first man there other than the holder', () => {
    expect(duty('SS', c('SS', 0, null, .2), c('2B', 1, null, .9), c('3B', 2, null, 1.4))).toEqual({ chasers: [], duty: '2B', dutySeconds: .9 });
  });

  it('gives the same answer whatever order the fielders are listed in', () => {
    const list = [c('P', null, .3, 3), c('SS', 2, null, 1.5), c('2B', 2.6, null, 1.5), c('1B', 1, null, 2)];
    expect(duty(null, ...list)).toEqual({ ...duty(null, ...list.slice().reverse()), chasers: expect.any(Array) });
    expect(sorted(duty(null, ...list).chasers)).toEqual(sorted(duty(null, ...list.slice().reverse()).chasers));
  });
});
