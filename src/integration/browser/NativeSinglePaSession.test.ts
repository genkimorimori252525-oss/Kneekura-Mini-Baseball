import { describe, expect, it } from 'vitest';
import { createNativeSinglePaSession } from './NativeSinglePaSession';

const call = (side: 'inside' | 'outside' = 'outside',
  mode: 'challenge' | 'balanced' | 'waste' = 'challenge',
  approach: 'take' | 'aggressive' = 'take') => ({
  pitcher: { attackZone: side, verticalPlan: 'low' as const, aggression: mode },
  batter: { approach, swingBias: 'neutral' as const },
  runners: { posture: 'balanced' as const },
});

describe('browser-safe Native Core one-PA honest integration boundary', () => {
  it('reproduces same physical event and ball source with same seed + command', () => {
    const a = createNativeSinglePaSession(101);
    const b = createNativeSinglePaSession(101);
    const first = a.issue(call());
    expect(first).toEqual(b.issue(call()));
    expect(first.result.authority).toBe('NATIVE_CORE_PHYSICAL_PITCH');
    expect(first.result.samples[0].world.ball).not.toBeNull();
    expect(first.result.events.map(e => e.kind)).toContain('PitchAdjudicated');
    expect(first.result.samples.every(s => s.world.defenders.length === 0)).toBe(true);
    expect(first.phase).not.toBe('batted_ball_pending');
  });

  it('takes revised manager command only on subsequent pitch, then refuses extra pitches after an official terminal', () => {
    const session = createNativeSinglePaSession(4242);
    const first = session.issue(call('outside'));
    const before = JSON.stringify(first.result);
    const second = session.issue(call('inside'));
    expect(second.ordinal).toBe(1);
    expect(second.intendedTarget.x).not.toBe(first.intendedTarget.x);
    expect(JSON.stringify(first.result)).toBe(before);
    // Drive with actual Native strike adjudication, not a scripted third-out.
    let attempts = 2;
    while (session.inspect().phase === 'active' && attempts++ < 10) {
      session.issue(call('outside', 'challenge'));
    }
    expect(['strikeout', 'walk'].includes(session.inspect().phase)).toBe(true);
    expect(() => session.issue(call())).toThrow('no substitute result will be invented');
  });

  it('rejects non-integer seed and cannot pretend to finish a live ball', () => {
    expect(() => createNativeSinglePaSession(1.5)).toThrow('seed must be a safe integer');
    const session = createNativeSinglePaSession(888);
    const result = session.issue(call('inside', 'challenge', 'aggressive'));
    if (result.phase === 'batted_ball_pending') {
      expect(result.result.requiresOfficialLiveBallResolution).toBe(true);
      expect(result.result.nextMatchState).toBeNull();
      expect(() => session.issue(call())).toThrow('no substitute result');
    }
  });
});
