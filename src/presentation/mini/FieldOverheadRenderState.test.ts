import { describe, expect, it } from 'vitest';
import {
  createPlayerPhysicalProfile,
} from '../../core/model/PlayerPhysicalProfile';
import type {
  CanonicalPresentationSample,
} from './model';
import {
  buildFieldOverheadRenderState,
} from './FieldOverheadRenderState';

const sample: CanonicalPresentationSample = {
  world: {
    tick: 2_000_000,
    defenders: [
      {
        playerId: 'p',
        registeredPosition: 'P',
        position: { x: 0, z: 18 },
        velocity: { x: 0, z: 0 },
        assignment: {
          kind: 'base_cover',
          base: 1,
        },
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
        velocity: { x: -1, z: 0.5 },
        assignment: { kind: 'ball_handler' },
      },
      {
        playerId: '2b',
        registeredPosition: '2B',
        position: { x: 8, z: 24 },
        velocity: { x: 0, z: 0 },
        assignment: {
          kind: 'base_cover',
          base: 2,
        },
      },
      {
        playerId: '3b',
        registeredPosition: '3B',
        position: { x: -20, z: 20 },
        velocity: { x: 0, z: 0 },
        assignment: {
          kind: 'base_cover',
          base: 3,
        },
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
        assignment: { kind: 'hold' },
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
};

const camera = {
  worldOrigin: { x: 0, z: 0 },
  viewportCenter: { x: 75, y: 96 },
  logicalPixelsPerMeter: 2,
} as const;

describe('FieldOverheadRenderState', () => {
  it('projects all nine canonical defenders and preserves their P5 assignments', () => {
    const result = buildFieldOverheadRenderState({
      sample,
      camera,
    });

    expect(result.defenders).toHaveLength(9);

    const cf = result.defenders.find(
      (defender) => defender.playerId === 'cf',
    );
    expect(cf).toEqual({
      playerId: 'cf',
      registeredPosition: 'CF',
      worldPosition: { x: -2, z: 23 },
      screenPosition: {
        x: 71,
        y: 50,
      },
      assignment: {
        kind: 'backup',
        target: { x: 0, z: 40 },
      },
      diameterPixels: 10,
      sizeSource: 'reference',
    });
  });

  it('projects runners and the canonical ball from world coordinates', () => {
    const result = buildFieldOverheadRenderState({
      sample,
      camera,
    });

    expect(result.runners).toEqual([{
      playerId: 'r1',
      worldPosition: { x: 13, z: 13 },
      screenPosition: { x: 101, y: 70 },
      diameterPixels: 10,
      sizeSource: 'reference',
    }]);

    expect(result.ball).toEqual({
      worldPosition: { x: 24, y: 1.2, z: 19 },
      screenPosition: { x: 123, y: 58 },
      altitudeMeters: 1.2,
    });
  });

  it('uses optional physical profile only to derive Presentation dot diameter', () => {
    const baseline = structuredClone(sample);

    const result = buildFieldOverheadRenderState({
      sample,
      camera,
      playerPhysicalProfiles: {
        cf: createPlayerPhysicalProfile({
          heightMeters: 1.65,
        }),
        p: createPlayerPhysicalProfile({
          heightMeters: 1.95,
        }),
      },
    });

    expect(
      result.defenders.find(
        (defender) => defender.playerId === 'cf',
      )?.diameterPixels,
    ).toBe(9);
    expect(
      result.defenders.find(
        (defender) => defender.playerId === 'p',
      )?.diameterPixels,
    ).toBe(11);

    expect(sample).toEqual(baseline);
  });

  it('changes only render sizes when Presentation dot calibration changes', () => {
    const baseline = structuredClone(sample);

    const first = buildFieldOverheadRenderState({
      sample,
      camera,
      playerPhysicalProfiles: {
        cf: createPlayerPhysicalProfile({
          heightMeters: 1.65,
        }),
      },
    });
    const second = buildFieldOverheadRenderState({
      sample,
      camera,
      playerPhysicalProfiles: {
        cf: createPlayerPhysicalProfile({
          heightMeters: 1.65,
        }),
      },
      dotCalibration: {
        smallBelowHeightScale: 0.95,
        largeAtOrAboveHeightScale: 1.05,
        smallDiameterPixels: 5,
        referenceDiameterPixels: 6,
        largeDiameterPixels: 7,
      },
    });

    expect(
      first.defenders.find(
        (defender) => defender.playerId === 'cf',
      )?.screenPosition,
    ).toEqual(
      second.defenders.find(
        (defender) => defender.playerId === 'cf',
      )?.screenPosition,
    );
    expect(
      first.defenders.find(
        (defender) => defender.playerId === 'cf',
      )?.diameterPixels,
    ).toBe(9);
    expect(
      second.defenders.find(
        (defender) => defender.playerId === 'cf',
      )?.diameterPixels,
    ).toBe(5);

    expect(sample).toEqual(baseline);
  });
});
