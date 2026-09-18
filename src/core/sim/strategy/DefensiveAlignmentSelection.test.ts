import { describe, expect, it } from 'vitest';
import {
  createDefensiveAlignment,
} from './DefensiveAlignment';
import {
  selectDefensiveAlignmentCandidate,
} from './DefensiveAlignmentSelection';

const alignment = (
  shiftPull: boolean,
) => createDefensiveAlignment([
  { playerId: 'p', registeredPosition: 'P', start: { x: 0, z: 18 } },
  { playerId: 'c', registeredPosition: 'C', start: { x: 0, z: -2 } },
  { playerId: '1b', registeredPosition: '1B', start: { x: 18, z: 20 } },
  {
    playerId: '2b',
    registeredPosition: '2B',
    start: shiftPull ? { x: -8, z: 24 } : { x: 8, z: 24 },
  },
  { playerId: '3b', registeredPosition: '3B', start: { x: -20, z: 20 } },
  {
    playerId: 'ss',
    registeredPosition: 'SS',
    start: shiftPull ? { x: -16, z: 27 } : { x: -8, z: 24 },
  },
  {
    playerId: 'lf',
    registeredPosition: 'LF',
    start: shiftPull ? { x: -28, z: 38 } : { x: -30, z: 55 },
  },
  {
    playerId: 'cf',
    registeredPosition: 'CF',
    start: shiftPull ? { x: -12, z: 42 } : { x: 0, z: 60 },
  },
  { playerId: 'rf', registeredPosition: 'RF', start: { x: 30, z: 55 } },
]);

const anchors = {
  pull: { x: -22, z: 38 },
  middle: { x: 0, z: 45 },
  opposite: { x: 22, z: 38 },
} as const;

const neutral = {
  pull: 1 / 3,
  middle: 1 / 3,
  opposite: 1 / 3,
} as const;

const coveragePlayerIds = [
  '1b',
  '2b',
  '3b',
  'ss',
  'lf',
  'cf',
  'rf',
] as const;

describe('DefensiveAlignmentSelection', () => {
  it('selects the pull-shift candidate from a confident pull-heavy scouting estimate', () => {
    const result = selectDefensiveAlignmentCandidate({
      scoutingEstimate: {
        directionDistribution: {
          pull: 0.75,
          middle: 0.15,
          opposite: 0.1,
        },
        trajectoryDistribution: {
          ground: 0.5,
          line: 0.2,
          fly: 0.25,
          popup: 0.05,
        },
        uncertainty: 0.05,
        effectiveSampleSize: 20,
        sampleAgeObservations: 1.5,
        observationCount: 24,
      },
      candidates: [
        { id: 'normal', alignment: alignment(false) },
        { id: 'pull-shift', alignment: alignment(true) },
      ],
      directionAnchors: anchors,
      neutralDirectionDistribution: neutral,
      coveragePlayerIds,
    });

    expect(result.selected.id).toBe('pull-shift');
    expect(result.evaluations[0].expectedNearestDistanceMeters)
      .not.toBeNaN();
  });

  it('blends uncertain scouting back toward neutral instead of treating a weak estimate as truth', () => {
    const confident = selectDefensiveAlignmentCandidate({
      scoutingEstimate: {
        directionDistribution: {
          pull: 0.9,
          middle: 0.05,
          opposite: 0.05,
        },
        trajectoryDistribution: {
          ground: 0.5,
          line: 0.2,
          fly: 0.25,
          popup: 0.05,
        },
        uncertainty: 0,
        effectiveSampleSize: 12,
        sampleAgeObservations: 1,
        observationCount: 12,
      },
      candidates: [
        { id: 'normal', alignment: alignment(false) },
        { id: 'pull-shift', alignment: alignment(true) },
      ],
      directionAnchors: anchors,
      neutralDirectionDistribution: neutral,
      coveragePlayerIds,
    });
    const uncertain = selectDefensiveAlignmentCandidate({
      scoutingEstimate: {
        directionDistribution: {
          pull: 0.9,
          middle: 0.05,
          opposite: 0.05,
        },
        trajectoryDistribution: {
          ground: 0.5,
          line: 0.2,
          fly: 0.25,
          popup: 0.05,
        },
        uncertainty: 1,
        effectiveSampleSize: 0,
        sampleAgeObservations: null,
        observationCount: 0,
      },
      candidates: [
        { id: 'normal', alignment: alignment(false) },
        { id: 'pull-shift', alignment: alignment(true) },
      ],
      directionAnchors: anchors,
      neutralDirectionDistribution: neutral,
      coveragePlayerIds,
    });

    expect(confident.effectiveDirectionDistribution.pull)
      .toBeCloseTo(0.9, 12);
    expect(uncertain.effectiveDirectionDistribution)
      .toEqual(neutral);
    expect(
      uncertain.evaluations.find(
        (entry) => entry.id === 'pull-shift',
      )?.expectedNearestDistanceMeters,
    ).not.toBe(
      confident.evaluations.find(
        (entry) => entry.id === 'pull-shift',
      )?.expectedNearestDistanceMeters,
    );
  });

  it('never mutates the candidate alignment while evaluating strategy', () => {
    const normal = alignment(false);
    const before = structuredClone(normal);

    selectDefensiveAlignmentCandidate({
      scoutingEstimate: {
        directionDistribution: neutral,
        trajectoryDistribution: {
          ground: 0.4,
          line: 0.2,
          fly: 0.3,
          popup: 0.1,
        },
        uncertainty: 0.5,
        effectiveSampleSize: 2,
        sampleAgeObservations: 3,
        observationCount: 4,
      },
      candidates: [{ id: 'normal', alignment: normal }],
      directionAnchors: anchors,
      neutralDirectionDistribution: neutral,
      coveragePlayerIds,
    });

    expect(normal).toEqual(before);
  });

  it('rejects unknown coverage player ids instead of silently changing the evaluated defense', () => {
    expect(() => selectDefensiveAlignmentCandidate({
      scoutingEstimate: {
        directionDistribution: neutral,
        trajectoryDistribution: {
          ground: 0.4,
          line: 0.2,
          fly: 0.3,
          popup: 0.1,
        },
        uncertainty: 0.5,
        effectiveSampleSize: 2,
        sampleAgeObservations: 3,
        observationCount: 4,
      },
      candidates: [{ id: 'normal', alignment: alignment(false) }],
      directionAnchors: anchors,
      neutralDirectionDistribution: neutral,
      coveragePlayerIds: ['ghost'],
    })).toThrow(
      'coveragePlayerIds must exist in every candidate alignment',
    );
  });
});
