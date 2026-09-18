import { describe, expect, it } from 'vitest';
import type {
  CanonicalMatchState,
} from '../../core/model/CanonicalMatchState';
import {
  asRuleProfileId,
} from '../../core/model/RuleProfileRef';
import {
  createPlayEndFact,
} from '../../core/rules/PhysicalRuleFacts';
import {
  applyResolvedLiveBallPlateAppearanceToMatchState,
} from '../../core/sim/plateAppearance/PlateAppearanceMatchState';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
  recordFairBattedBall,
  recordLiveBallPlayEnd,
} from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type {
  BatBallContactResult,
} from '../../core/sim/contact/BatBallContact';
import type {
  CanonicalPresentationSample,
} from './model';
import {
  buildMiniPresentationTimeline,
  createMiniPresentationSampleSchedule,
} from './MiniPresentationTimeline';

const match: CanonicalMatchState = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 5,
  half: 'top',
  outs: 1,
  balls: 1,
  strikes: 1,
  bases: {
    first: 'r1',
    second: null,
    third: null,
  },
  score: {
    away: 2,
    home: 2,
  },
  playId: 40,
};

const contact: BatBallContactResult = {
  tick: 1_000_000,
  ballCenter: { x: 0, y: 1, z: 0.06 },
  point: { x: 0, y: 1, z: 0.03 },
  batPoint: { x: 0, y: 1, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  segmentT: 0.5,
  exitVelocity: { x: 4, y: 2, z: 24 },
  exitSpin: { x: 0, y: 0, z: 0 },
};

const canonicalPlay = () => {
  let timeline = createCanonicalPlateAppearanceTimeline(
    match,
    900_000,
  );
  timeline = recordBatBallContact(
    timeline,
    contact,
  );
  timeline = recordFairBattedBall(
    timeline,
    1_020_000,
  );

  const playEnd = createPlayEndFact(
    1_100_000,
    'live_action_complete',
  );
  timeline = recordLiveBallPlayEnd(
    timeline,
    playEnd,
  );

  const nextMatchState =
    applyResolvedLiveBallPlateAppearanceToMatchState(
      match,
      timeline,
      {
        playEnd,
        outsAfter: 1,
        basesAfter: {
          first: 'batter',
          second: 'r1',
          third: null,
        },
        scoredRunnerIds: [],
      },
    );

  return {
    timeline,
    nextMatchState,
  };
};

const sample = (
  tick: number,
): CanonicalPresentationSample => ({
  world: {
    tick,
    defenders: [],
    runners: [],
    ball: null,
  },
  batter: {
    handedness: 'R',
    action: 'normal_swing',
    bat: null,
  },
});

describe('P2 presentation cadence acceptance', () => {
  it('keeps canonical events and next MatchState identical across 30fps, 60fps, fast playback, and render-off', () => {
    const canonical = canonicalPlay();
    const baseline = structuredClone(canonical);

    const render = (
      cadenceTicks: number,
    ) => {
      const ticks = createMiniPresentationSampleSchedule(
        900_000,
        1_100_000,
        cadenceTicks,
        canonical.timeline.events,
      );
      return buildMiniPresentationTimeline(
        ticks.map(sample),
        canonical.timeline.events,
      );
    };

    const thirty = render(
      Math.round(1_000_000 / 30),
    );
    const sixty = render(
      Math.round(1_000_000 / 60),
    );
    const fastPlayback = render(
      Math.round(1_000_000 / 15),
    );

    // render-off: intentionally do not create presentation frames.
    const renderOffCanonical = canonical;

    expect(canonical).toEqual(baseline);
    expect(renderOffCanonical).toEqual(baseline);

    expect(
      thirty.find((frame) => frame.cutReason)?.tick,
    ).toBe(1_020_000);
    expect(
      sixty.find((frame) => frame.cutReason)?.tick,
    ).toBe(1_020_000);
    expect(
      fastPlayback.find((frame) => frame.cutReason)?.tick,
    ).toBe(1_020_000);

    expect(canonical.timeline.events)
      .toEqual(baseline.timeline.events);
    expect(canonical.nextMatchState)
      .toEqual(baseline.nextMatchState);
  });

  it('injects every canonical event tick into every presentation cadence schedule', () => {
    const canonical = canonicalPlay();
    const eventTicks = canonical.timeline.events.map(
      (event) => event.tick,
    );

    for (const cadence of [
      Math.round(1_000_000 / 30),
      Math.round(1_000_000 / 60),
      Math.round(1_000_000 / 15),
    ]) {
      const schedule =
        createMiniPresentationSampleSchedule(
          900_000,
          1_100_000,
          cadence,
          canonical.timeline.events,
        );

      for (const eventTick of eventTicks) {
        expect(schedule).toContain(eventTick);
      }
    }
  });
});
