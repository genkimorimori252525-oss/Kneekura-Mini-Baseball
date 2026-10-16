import { describe, expect, it } from 'vitest';
import type { CanonicalPresentationSample } from './model';
import { buildMiniPresentationTimeline } from './MiniPresentationTimeline';

function sample(tick: number): CanonicalPresentationSample {
  return {
    world: { tick, defenders: [], runners: [], ball: null },
    batter: { handedness: 'R', action: 'normal_swing', bat: null },
  };
}

describe('buildMiniPresentationTimeline', () => {
  it('hard-cuts at the exact live BatBallContact tick using the same canonical sample', () => {
    const before = sample(945_000);
    const contact = sample(1_000_000);
    const after = sample(1_055_000);

    const frames = buildMiniPresentationTimeline(
      [before, contact, after],
      [{ tick: 1_000_000, sequence: 0, kind: 'BatBallContact', payload: { liveBattedBall: true } }],
    );

    expect(frames.map((frame) => [frame.tick, frame.cameraMode])).toEqual([
      [945_000, 'BATTER_POV'],
      [1_000_000, 'BATTER_POV'],
      [1_000_000, 'FIELD_OVERHEAD'],
      [1_055_000, 'FIELD_OVERHEAD'],
    ]);
    expect(frames[1].sample).toBe(contact);
    expect(frames[2].sample).toBe(contact);
    expect(frames[2].cutReason).toBe('live_batted_ball_contact');
  });

  it('does not cut for a non-live contact', () => {
    const contact = sample(1_000_000);
    const frames = buildMiniPresentationTimeline(
      [contact],
      [{ tick: 1_000_000, sequence: 0, kind: 'BatBallContact', payload: { liveBattedBall: false } }],
    );

    expect(frames).toHaveLength(1);
    expect(frames[0].cameraMode).toBe('BATTER_POV');
  });

  it('refuses to interpolate a missing exact live-contact sample', () => {
    expect(() =>
      buildMiniPresentationTimeline(
        [sample(945_000), sample(1_055_000)],
        [{ tick: 1_000_000, sequence: 0, kind: 'BatBallContact', payload: { liveBattedBall: true } }],
      ),
    ).toThrow('Missing exact canonical sample for live BatBallContact at tick 1000000.');
  });

  it('preserves arbitrary canonical defender positions instead of replacing them', () => {
    const shifted: CanonicalPresentationSample = {
      world: {
        tick: 0,
        defenders: [
          {
            playerId: 'ss',
            registeredPosition: 'SS',
            position: { x: 9.25, z: 18.75 },
            velocity: { x: 0, z: 0 },
            assignment: { kind: 'hold' },
          },
        ],
        runners: [],
        ball: null,
      },
      batter: { handedness: 'L', action: 'bunt_show', bat: null },
    };

    const [frame] = buildMiniPresentationTimeline([shifted], []);
    expect(frame.sample).toBe(shifted);
    expect(frame.sample.world.defenders[0].position).toEqual({ x: 9.25, z: 18.75 });
  });
});
