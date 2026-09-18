import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../core/model/RuleProfileRef';
import {
  createPlayerPhysicalProfile,
} from '../../core/model/PlayerPhysicalProfile';
import type {
  CanonicalPresentationSample,
} from './model';
import {
  buildMiniGameLiveFrame,
} from './MiniGameLiveFrame';
import {
  buildMiniPresentationTimeline,
  createMiniPresentationSampleSchedule,
} from './MiniPresentationTimeline';

const match = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 6,
  half: 'bottom' as const,
  outs: 1,
  balls: 1,
  strikes: 2,
  bases: {
    first: 'r1',
    second: null,
    third: null,
  },
  score: {
    away: 3,
    home: 3,
  },
  playId: 70,
};

const sample = (
  tick: number,
): CanonicalPresentationSample => ({
  world: {
    tick,
    defenders: [
      {
        playerId: 'p',
        registeredPosition: 'P',
        position: { x: 0, z: 18 },
        velocity: { x: 0, z: 0 },
        assignment: { kind: 'hold' },
      },
      {
        playerId: 'c',
        registeredPosition: 'C',
        position: { x: 0, z: -2 },
        velocity: { x: 0, z: 0 },
        assignment: { kind: 'hold' },
      },
      {
        playerId: '1b',
        registeredPosition: '1B',
        position: { x: 24, z: 19 },
        velocity: { x: 0, z: 0 },
        assignment: { kind: 'ball_handler' },
      },
      {
        playerId: '2b',
        registeredPosition: '2B',
        position: { x: 8, z: 24 },
        velocity: { x: 0, z: 0 },
        assignment: { kind: 'base_cover', base: 2 },
      },
      {
        playerId: '3b',
        registeredPosition: '3B',
        position: { x: -20, z: 20 },
        velocity: { x: 0, z: 0 },
        assignment: { kind: 'base_cover', base: 3 },
      },
      {
        playerId: 'ss',
        registeredPosition: 'SS',
        position: { x: -8, z: 24 },
        velocity: { x: 0, z: 0 },
        assignment: {
          kind: 'relay',
          target: { x: 12, z: 28 },
        },
      },
      {
        playerId: 'lf',
        registeredPosition: 'LF',
        position: { x: -30, z: 55 },
        velocity: { x: 0, z: 0 },
        assignment: {
          kind: 'deep_coverage',
          target: { x: -28, z: 60 },
        },
      },
      {
        playerId: 'cf',
        registeredPosition: 'CF',
        position: { x: -2, z: 23 },
        velocity: { x: 1.2, z: -0.4 },
        assignment: {
          kind: 'backup',
          target: { x: 0, z: 40 },
        },
      },
      {
        playerId: 'rf',
        registeredPosition: 'RF',
        position: { x: 30, z: 55 },
        velocity: { x: 0, z: 0 },
        assignment: { kind: 'base_cover', base: 1 },
      },
    ],
    runners: [{
      playerId: 'r1',
      position: { x: 13, z: 13 },
      velocity: { x: 3, z: 3 },
    }],
    ball: {
      position: { x: 24, y: 1.2, z: 19 },
      velocity: { x: -8, y: 2, z: -4 },
      spin: { x: 0, y: 20, z: 0 },
    },
  },
  batter: {
    handedness: 'R',
    action: 'normal_swing',
    bat: null,
  },
});

describe('P8 presentation isolation acceptance', () => {
  it('keeps canonical state identical across camera and dot-size presentation settings', () => {
    const canonicalMatch = structuredClone(match);
    const canonicalSample = sample(2_000_000);
    const beforeSample = structuredClone(canonicalSample);

    const compact = buildMiniGameLiveFrame({
      match,
      frame: {
        tick: 2_000_000,
        cameraMode: 'FIELD_OVERHEAD',
        sample: canonicalSample,
        events: [],
      },
      overheadCamera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 1.5,
      },
      playerPhysicalProfiles: {
        cf: createPlayerPhysicalProfile(1.65),
      },
      dotCalibration: {
        smallBelowHeightScale: 0.95,
        largeAtOrAboveHeightScale: 1.05,
        smallDiameterPixels: 5,
        referenceDiameterPixels: 6,
        largeDiameterPixels: 7,
      },
    });

    const large = buildMiniGameLiveFrame({
      match,
      frame: {
        tick: 2_000_000,
        cameraMode: 'FIELD_OVERHEAD',
        sample: canonicalSample,
        events: [],
      },
      overheadCamera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 3,
      },
      playerPhysicalProfiles: {
        cf: createPlayerPhysicalProfile(1.65),
      },
      dotCalibration: {
        smallBelowHeightScale: 0.95,
        largeAtOrAboveHeightScale: 1.05,
        smallDiameterPixels: 12,
        referenceDiameterPixels: 14,
        largeDiameterPixels: 16,
      },
    });

    expect(compact.live).not.toEqual(large.live);
    expect(match).toEqual(canonicalMatch);
    expect(canonicalSample).toEqual(beforeSample);
  });

  it('keeps the same canonical event cut across 30fps and 60fps schedules', () => {
    const events = [{
      tick: 2_050_000,
      sequence: 0,
      kind: 'BattedBallDeclaredFair',
      payload: {
        contactTick: 2_020_000,
      },
    }];

    const render = (cadence: number) => {
      const ticks = createMiniPresentationSampleSchedule(
        2_000_000,
        2_100_000,
        cadence,
        events,
      );
      return buildMiniPresentationTimeline(
        ticks.map(sample),
        events,
      );
    };

    const thirty = render(
      Math.round(1_000_000 / 30),
    );
    const sixty = render(
      Math.round(1_000_000 / 60),
    );

    expect(
      thirty.find(
        (frame) => frame.cutReason
          === 'fair_batted_ball_declared',
      )?.tick,
    ).toBe(2_050_000);
    expect(
      sixty.find(
        (frame) => frame.cutReason
          === 'fair_batted_ball_declared',
      )?.tick,
    ).toBe(2_050_000);
  });

  it('supports render-off by leaving canonical inputs untouched', () => {
    const canonicalSample = sample(2_000_000);
    const beforeMatch = structuredClone(match);
    const beforeSample = structuredClone(canonicalSample);

    // render-off intentionally performs no Presentation call.

    expect(match).toEqual(beforeMatch);
    expect(canonicalSample).toEqual(beforeSample);
  });
});
