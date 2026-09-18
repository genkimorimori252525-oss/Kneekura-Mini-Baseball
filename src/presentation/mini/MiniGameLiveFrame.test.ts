import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../core/model/RuleProfileRef';
import {
  createCanonicalLineScoreSnapshot,
} from '../../core/model/CanonicalLineScoreSnapshot';
import {
  createPlateAppearanceCommand,
} from '../../core/sim/plateAppearance/PlateAppearanceCommand';
import type {
  MiniPresentationFrame,
} from './model';
import {
  buildMiniGameLiveFrame,
} from './MiniGameLiveFrame';


const lineScore = createCanonicalLineScoreSnapshot({
  innings: [
    { inning: 1, awayRuns: 0, homeRuns: 1 },
    { inning: 2, awayRuns: 1, homeRuns: 0 },
    { inning: 3, awayRuns: 0, homeRuns: 0 },
    { inning: 4, awayRuns: 0, homeRuns: 2 },
    { inning: 5, awayRuns: 1, homeRuns: 0 },
  ],
  totals: {
    away: { runs: 2, hits: 5, errors: 0 },
    home: { runs: 3, hits: 6, errors: 1 },
  },
});

const command = createPlateAppearanceCommand({
  pitcher: {
    attackZone: 'outside',
    verticalPlan: 'low',
    aggression: 'balanced',
  },
  batter: {
    approach: 'aggressive',
    swingBias: 'early',
  },
  runners: {
    posture: 'balanced',
  },
});

const match = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 5,
  half: 'top' as const,
  outs: 1,
  balls: 2,
  strikes: 1,
  bases: {
    first: 'r1',
    second: null,
    third: null,
  },
  score: {
    away: 2,
    home: 3,
  },
  playId: 40,
};

const frame: MiniPresentationFrame = {
  tick: 2_000_000,
  cameraMode: 'FIELD_OVERHEAD',
  sample: {
    world: {
      tick: 2_000_000,
      defenders: [{
        playerId: 'cf',
        registeredPosition: 'CF',
        position: { x: -2, z: 23 },
        velocity: { x: 1, z: 0 },
        assignment: {
          kind: 'backup',
          target: { x: 0, z: 40 },
        },
      }],
      runners: [{
        playerId: 'r1',
        position: { x: 13, z: 13 },
        velocity: { x: 3, z: 3 },
      }],
      ball: {
        position: { x: 3, y: 1.5, z: 20 },
        velocity: { x: 1, y: 2, z: 8 },
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
};

describe('MiniGameLiveFrame', () => {
  it('combines one canonical match HUD with one canonical render frame', () => {
    const result = buildMiniGameLiveFrame({
      match,
      frame,
      overheadCamera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
    });

    expect(result.tick).toBe(2_000_000);
    expect(result.hud.count).toEqual({
      balls: 2,
      strikes: 1,
      outs: 1,
    });
    expect(result.hud.bases.first).toEqual({
      occupied: true,
      runnerId: 'r1',
    });
    expect(result.live.cameraMode)
      .toBe('FIELD_OVERHEAD');
  });

  it('combines authoritative R/H/E, handedness badges, and the current plate-appearance command into the same read-only live frame', () => {
    const sourceFrame: MiniPresentationFrame = {
      ...frame,
      sample: {
        ...frame.sample,
        pitcherHandedness: 'L',
      },
    };

    const result = buildMiniGameLiveFrame({
      match,
      lineScore,
      currentCommand: command,
      frame: sourceFrame,
      overheadCamera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
    });

    expect(result.hud.lineScore?.innings).toHaveLength(9);
    expect(result.hud.lineScore?.totals.home).toEqual({
      runs: 3,
      hits: 6,
      errors: 1,
    });
    expect(result.matchup.batter).toEqual({
      role: 'batter',
      handedness: 'R',
      label: '右打',
      accent: 'red',
    });
    expect(result.matchup.pitcher).toEqual({
      role: 'pitcher',
      handedness: 'L',
      label: '左投',
      accent: 'blue',
    });
    expect(result.commandBand).toEqual({
      pitcher: ['外角', '低め', 'バランス'],
      batter: ['積極', '早め'],
      runners: ['標準'],
    });
  });

  it('preserves both source objects exactly', () => {
    const matchBefore = structuredClone(match);
    const frameBefore = structuredClone(frame);

    buildMiniGameLiveFrame({
      match,
      frame,
      overheadCamera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
    });

    expect(match).toEqual(matchBefore);
    expect(frame).toEqual(frameBefore);
  });

  it('rejects an obviously mismatched playId when a frame carries another canonical play event', () => {
    const mismatched: MiniPresentationFrame = {
      ...frame,
      events: [{
        tick: 2_000_000,
        sequence: 0,
        kind: 'FixtureEvent',
        payload: {
          playId: 41,
        },
      }],
    };

    expect(() => buildMiniGameLiveFrame({
      match,
      frame: mismatched,
      overheadCamera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
      eventPlayIdResolver: (event) => (
        typeof event.payload === 'object'
        && event.payload !== null
        && 'playId' in event.payload
          ? (event.payload as { playId: number }).playId
          : null
      ),
    })).toThrow(
      'presentation frame event playId must match CanonicalMatchState.playId',
    );
  });
});
