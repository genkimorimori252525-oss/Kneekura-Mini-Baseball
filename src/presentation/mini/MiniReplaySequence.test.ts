import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../core/model/RuleProfileRef';
import {
  resolveRulebookStrikeZoneRegion,
} from '../../core/sim/pitching/RulebookStrikeZone';
import type {
  MiniPresentationFrame,
} from './model';
import {
  buildMiniReplaySequence,
} from './MiniReplaySequence';

const replayStrikeZoneGuide = {
  plateZ: 0,
  region: resolveRulebookStrikeZoneRegion({
    plateCenterX: 0,
    landmarks: {
      shoulderTopY: 1.62,
      uniformPantsTopY: 1.02,
      kneecapBottomY: 0.46,
    },
  }),
} as const;

const match = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 4,
  half: 'top' as const,
  outs: 1,
  balls: 1,
  strikes: 1,
  bases: {
    first: 'r1',
    second: null,
    third: null,
  },
  score: {
    away: 1,
    home: 2,
  },
  playId: 22,
};

const frameAt = (
  tick: number,
  ballX: number,
  cameraMode: 'BATTER_POV' | 'FIELD_OVERHEAD' = 'FIELD_OVERHEAD',
): MiniPresentationFrame => ({
  tick,
  cameraMode,
  sample: {
    world: {
      tick,
      defenders: [{
        playerId: 'cf',
        registeredPosition: 'CF',
        position: { x: -2, z: 23 },
        velocity: { x: 0, z: 0 },
        assignment: { kind: 'hold' },
      }],
      runners: [{
        playerId: 'r1',
        position: { x: 12, z: 12 },
        velocity: { x: 2, z: 2 },
      }],
      ball: {
        position: {
          x: ballX,
          y: 1.5,
          z: 20,
        },
        velocity: { x: 2, y: 1, z: 4 },
        spin: { x: 0, y: 10, z: 0 },
      },
    },
    batter: {
      handedness: 'R',
      action: 'normal_swing',
      bat: null,
    },
  },
  events: [],
});

describe('MiniReplaySequence', () => {
  it('re-renders the supplied canonical frames without recalculating play state', () => {
    const sources = [
      {
        match,
        frame: frameAt(1_000_000, 0),
      },
      {
        match,
        frame: frameAt(1_100_000, 1),
      },
    ] as const;
    const before = structuredClone(sources);

    const result = buildMiniReplaySequence({
      sources,
      overheadCamera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
      maximumBallTrailPoints: 4,
    });

    expect(result).toHaveLength(2);
    expect(result[1].live.cameraMode)
      .toBe('FIELD_OVERHEAD');

    if (
      result[1].live.cameraMode
      !== 'FIELD_OVERHEAD'
    ) {
      throw new Error('fixture must use overhead replay');
    }

    expect(result[1].live.render.ballTrail)
      .toHaveLength(1);
    expect(
      result[1].live.render.ballTrail[0]
        .worldPosition.x,
    ).toBe(0);

    expect(sources).toEqual(before);
  });

  it('allows the canonical same-tick camera-cut pair', () => {
    const tick = 2_000_000;
    const result = buildMiniReplaySequence({
      sources: [
        {
          match,
          frame: frameAt(
            tick,
            2,
            'BATTER_POV',
          ),
          strikeZoneGuide: replayStrikeZoneGuide,
        },
        {
          match,
          frame: frameAt(
            tick,
            2,
            'FIELD_OVERHEAD',
          ),
        },
      ],
      overheadCamera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
    });

    expect(result.map(
      (entry) => entry.live.cameraMode,
    )).toEqual([
      'BATTER_POV',
      'FIELD_OVERHEAD',
    ]);

    if (result[0].live.cameraMode !== 'BATTER_POV') {
      throw new Error('first replay frame must use batter POV');
    }
    expect(result[0].live.render.strikeZoneGuide?.source)
      .toEqual(replayStrikeZoneGuide);
  });

  it('changes only projected render coordinates when replay camera calibration changes', () => {
    const sources = [{
      match,
      frame: frameAt(1_000_000, 3),
    }] as const;
    const before = structuredClone(sources);

    const first = buildMiniReplaySequence({
      sources,
      overheadCamera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 1,
      },
    });
    const second = buildMiniReplaySequence({
      sources,
      overheadCamera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 3,
      },
    });

    if (
      first[0].live.cameraMode
        !== 'FIELD_OVERHEAD'
      || second[0].live.cameraMode
        !== 'FIELD_OVERHEAD'
    ) {
      throw new Error('fixtures must use overhead');
    }

    expect(
      first[0].live.render.ball?.screenPosition,
    ).not.toEqual(
      second[0].live.render.ball?.screenPosition,
    );
    expect(
      first[0].live.render.ball?.worldPosition,
    ).toEqual(
      second[0].live.render.ball?.worldPosition,
    );
    expect(sources).toEqual(before);
  });

  it('rejects replay sources that move backward in canonical time', () => {
    expect(() => buildMiniReplaySequence({
      sources: [
        {
          match,
          frame: frameAt(2_000_000, 1),
        },
        {
          match,
          frame: frameAt(1_000_000, 0),
        },
      ],
      overheadCamera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
    })).toThrow(
      'mini replay source ticks must be non-decreasing',
    );
  });
});