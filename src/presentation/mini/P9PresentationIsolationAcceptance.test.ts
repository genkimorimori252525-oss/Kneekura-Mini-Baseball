import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../core/model/RuleProfileRef';
import type {
  CanonicalWorldSnapshot,
} from '../../core/model/CanonicalWorldSnapshot';
import type {
  TimedMatchEvent,
} from '../../core/model/TimedMatchEvent';
import {
  createCanonicalEvidenceFingerprint,
} from '../../core/validation/CanonicalEvidenceFingerprint';
import {
  createNaturalReadOnlySnapshot,
} from '../../core/validation/NaturalReadOnlySnapshot';
import {
  buildFieldOverheadRenderState,
} from './FieldOverheadRenderState';
import type {
  CanonicalPresentationSample,
} from './model';

const match = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 6,
  half: 'top' as const,
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
    home: 2,
  },
  playId: 61,
};

const world: CanonicalWorldSnapshot = {
  tick: 5_000_000,
  defenders: [{
    playerId: 'cf',
    registeredPosition: 'CF',
    position: { x: -2, z: 23 },
    velocity: { x: 1.2, z: -0.4 },
    assignment: {
      kind: 'backup',
      target: { x: 0, z: 40 },
    },
  }],
  runners: [{
    playerId: 'r1',
    position: { x: 12, z: 12 },
    velocity: { x: 3, z: 3 },
  }],
  ball: {
    position: { x: 18, y: 2, z: 25 },
    velocity: { x: -5, y: 1, z: 7 },
    spin: { x: 0, y: 18, z: 0 },
  },
};

const events: readonly TimedMatchEvent[] = [{
  tick: 4_900_000,
  sequence: 0,
  kind: 'FixtureEvent',
  payload: {
    result: 'live_ball',
  },
}];

const sample: CanonicalPresentationSample = {
  world,
  batter: {
    handedness: 'R',
    action: 'normal_swing',
    bat: null,
  },
};

const canonicalFingerprint = () => (
  createCanonicalEvidenceFingerprint({
    match,
    world,
    events,
  })
);

describe('P9 Presentation isolation acceptance', () => {
  it('preserves canonical evidence with renderer OFF, Mini, or Natural', () => {
    const rendererOffFingerprint =
      canonicalFingerprint();

    buildFieldOverheadRenderState({
      sample,
      camera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 2,
      },
    });
    const afterMini = canonicalFingerprint();

    const natural = createNaturalReadOnlySnapshot({
      match,
      world,
      events,
      publicMetadata: {
        camera: 'broadcast-3d',
      },
    });
    const afterNatural = canonicalFingerprint();

    expect(afterMini).toBe(rendererOffFingerprint);
    expect(afterNatural).toBe(rendererOffFingerprint);
    expect(natural.sourceFingerprint)
      .toBe(rendererOffFingerprint);
  });

  it('lets Mini camera scale and point diameter calibration change without altering canonical evidence', () => {
    const before = canonicalFingerprint();

    const compact = buildFieldOverheadRenderState({
      sample,
      camera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 75, y: 96 },
        logicalPixelsPerMeter: 1,
      },
      dotCalibration: {
        smallBelowHeightScale: 0.95,
        largeAtOrAboveHeightScale: 1.05,
        smallDiameterPixels: 5,
        referenceDiameterPixels: 6,
        largeDiameterPixels: 7,
      },
    });

    const large = buildFieldOverheadRenderState({
      sample,
      camera: {
        worldOrigin: { x: 0, z: 0 },
        viewportCenter: { x: 150, y: 192 },
        logicalPixelsPerMeter: 4,
      },
      dotCalibration: {
        smallBelowHeightScale: 0.95,
        largeAtOrAboveHeightScale: 1.05,
        smallDiameterPixels: 12,
        referenceDiameterPixels: 14,
        largeDiameterPixels: 16,
      },
    });

    expect(compact.defenders[0].screenPosition)
      .not.toEqual(large.defenders[0].screenPosition);
    expect(compact.defenders[0].diameterPixels)
      .not.toBe(large.defenders[0].diameterPixels);

    expect(canonicalFingerprint()).toBe(before);
  });

  it('lets Natural presentation metadata vary without changing the source fingerprint', () => {
    const first = createNaturalReadOnlySnapshot({
      match,
      world,
      events,
      publicMetadata: {
        modelScale: 1,
        animationStyle: 'realistic',
      },
    });
    const second = createNaturalReadOnlySnapshot({
      match,
      world,
      events,
      publicMetadata: {
        modelScale: 1.2,
        animationStyle: 'stylized',
      },
    });

    expect(first.sourceFingerprint)
      .toBe(second.sourceFingerprint);
    expect(first.sourceFingerprint)
      .toBe(canonicalFingerprint());
  });
});
