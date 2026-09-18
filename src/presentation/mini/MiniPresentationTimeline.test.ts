import { describe, expect, it } from 'vitest';
import type { CanonicalPresentationSample } from './model';
import {
  buildMiniPresentationTimeline,
  createMiniPresentationSampleSchedule,
} from './MiniPresentationTimeline';

function sample(tick: number): CanonicalPresentationSample {
  return {
    world: { tick, defenders: [], runners: [], ball: null },
    batter: { handedness: 'R', action: 'normal_swing', bat: null },
  };
}

describe('buildMiniPresentationTimeline', () => {
  it('keeps raw BatBallContact pending and hard-cuts only at exact fair declaration tick', () => {
    const before = sample(945_000);
    const contact = sample(1_000_000);
    const fair = sample(1_020_000);
    const after = sample(1_055_000);

    const frames = buildMiniPresentationTimeline(
      [before, contact, fair, after],
      [
        {
          tick: 1_000_000,
          sequence: 0,
          kind: 'BatBallContact',
          payload: { battedBallPendingDisposition: true },
        },
        {
          tick: 1_020_000,
          sequence: 1,
          kind: 'BattedBallDeclaredFair',
          payload: { contactTick: 1_000_000 },
        },
      ],
    );

    expect(frames.map((frame) => [frame.tick, frame.cameraMode])).toEqual([
      [945_000, 'BATTER_POV'],
      [1_000_000, 'BATTER_POV'],
      [1_020_000, 'BATTER_POV'],
      [1_020_000, 'FIELD_OVERHEAD'],
      [1_055_000, 'FIELD_OVERHEAD'],
    ]);
    expect(frames[2].sample).toBe(fair);
    expect(frames[3].sample).toBe(fair);
    expect(frames[3].cutReason).toBe('fair_batted_ball_declared');
  });

  it('supports catcher-eye pitcher POV before the same canonical fair-ball cut', () => {
    const before = sample(945_000);
    const fair = sample(1_020_000);
    const after = sample(1_055_000);

    const frames = buildMiniPresentationTimeline(
      [before, fair, after],
      [{
        tick: 1_020_000,
        sequence: 0,
        kind: 'BattedBallDeclaredFair',
        payload: { contactTick: 1_000_000 },
      }],
      'PITCHER_POV',
    );

    expect(frames.map((frame) => [
      frame.tick,
      frame.cameraMode,
    ])).toEqual([
      [945_000, 'PITCHER_POV'],
      [1_020_000, 'PITCHER_POV'],
      [1_020_000, 'FIELD_OVERHEAD'],
      [1_055_000, 'FIELD_OVERHEAD'],
    ]);
  });

  it('does not cut for raw contact without a fair declaration', () => {
    const contact = sample(1_000_000);
    const frames = buildMiniPresentationTimeline(
      [contact],
      [{
        tick: 1_000_000,
        sequence: 0,
        kind: 'BatBallContact',
        payload: { battedBallPendingDisposition: true },
      }],
    );

    expect(frames).toHaveLength(1);
    expect(frames[0].cameraMode).toBe('BATTER_POV');
  });

  it('refuses to interpolate a missing exact fair-declaration sample', () => {
    expect(() =>
      buildMiniPresentationTimeline(
        [sample(1_000_000), sample(1_055_000)],
        [{
          tick: 1_020_000,
          sequence: 0,
          kind: 'BattedBallDeclaredFair',
          payload: { contactTick: 1_000_000 },
        }],
      ),
    ).toThrow(
      'Missing exact canonical sample for BattedBallDeclaredFair at tick 1020000.',
    );
  });

  it('merges exact canonical event ticks into both 30fps and 60fps presentation schedules', () => {
    const events = [{
      tick: 1_020_000,
      sequence: 0,
      kind: 'BattedBallDeclaredFair',
      payload: { contactTick: 1_000_000 },
    }] as const;

    const thirty = createMiniPresentationSampleSchedule(
      900_000,
      1_100_000,
      Math.round(1_000_000 / 30),
      events,
    );
    const sixty = createMiniPresentationSampleSchedule(
      900_000,
      1_100_000,
      Math.round(1_000_000 / 60),
      events,
    );

    expect(thirty).toContain(1_020_000);
    expect(sixty).toContain(1_020_000);
    expect(thirty[0]).toBe(900_000);
    expect(sixty[0]).toBe(900_000);
    expect(thirty.at(-1)).toBe(1_100_000);
    expect(sixty.at(-1)).toBe(1_100_000);
  });

  it('produces the same canonical camera transition tick at 30fps and 60fps', () => {
    const events = [{
      tick: 1_020_000,
      sequence: 0,
      kind: 'BattedBallDeclaredFair',
      payload: { contactTick: 1_000_000 },
    }] as const;

    const render = (cadence: number) => {
      const ticks = createMiniPresentationSampleSchedule(
        900_000,
        1_100_000,
        cadence,
        events,
      );
      return buildMiniPresentationTimeline(
        ticks.map(sample),
        events,
      );
    };

    const thirty = render(Math.round(1_000_000 / 30));
    const sixty = render(Math.round(1_000_000 / 60));

    expect(
      thirty.find((frame) => frame.cutReason)?.tick,
    ).toBe(1_020_000);
    expect(
      sixty.find((frame) => frame.cutReason)?.tick,
    ).toBe(1_020_000);
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
    expect(frame.sample.world.defenders[0].position).toEqual({
      x: 9.25,
      z: 18.75,
    });
  });
});
