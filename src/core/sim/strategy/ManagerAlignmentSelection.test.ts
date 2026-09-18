import { describe, expect, it } from 'vitest';
import {
  DeterministicRng,
} from '../../rng/DeterministicRng';
import {
  createDefensiveAlignment,
} from './DefensiveAlignment';
import {
  selectDefensiveAlignmentCandidateForManager,
} from './ManagerAlignmentSelection';

const normal = createDefensiveAlignment([
  { playerId: 'p', registeredPosition: 'P', start: { x: 0, z: 18 } },
  { playerId: 'c', registeredPosition: 'C', start: { x: 0, z: -2 } },
  { playerId: '1b', registeredPosition: '1B', start: { x: 18, z: 20 } },
  { playerId: '2b', registeredPosition: '2B', start: { x: 8, z: 24 } },
  { playerId: '3b', registeredPosition: '3B', start: { x: -20, z: 20 } },
  { playerId: 'ss', registeredPosition: 'SS', start: { x: -8, z: 24 } },
  { playerId: 'lf', registeredPosition: 'LF', start: { x: -30, z: 55 } },
  { playerId: 'cf', registeredPosition: 'CF', start: { x: 0, z: 60 } },
  { playerId: 'rf', registeredPosition: 'RF', start: { x: 30, z: 55 } },
]);

const pullShift = createDefensiveAlignment([
  { playerId: 'p', registeredPosition: 'P', start: { x: 0, z: 18 } },
  { playerId: 'c', registeredPosition: 'C', start: { x: 0, z: -2 } },
  { playerId: '1b', registeredPosition: '1B', start: { x: 18, z: 20 } },
  { playerId: '2b', registeredPosition: '2B', start: { x: -8, z: 24 } },
  { playerId: '3b', registeredPosition: '3B', start: { x: -20, z: 20 } },
  { playerId: 'ss', registeredPosition: 'SS', start: { x: -16, z: 27 } },
  { playerId: 'lf', registeredPosition: 'LF', start: { x: -28, z: 38 } },
  { playerId: 'cf', registeredPosition: 'CF', start: { x: -12, z: 42 } },
  { playerId: 'rf', registeredPosition: 'RF', start: { x: 30, z: 55 } },
]);

const baseInput = {
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
    { id: 'normal', alignment: normal },
    { id: 'pull-shift', alignment: pullShift },
  ],
  directionAnchors: {
    pull: { x: -22, z: 38 },
    middle: { x: 0, z: 45 },
    opposite: { x: 22, z: 38 },
  },
  neutralDirectionDistribution: {
    pull: 1 / 3,
    middle: 1 / 3,
    opposite: 1 / 3,
  },
  coveragePlayerIds: [
    '1b',
    '2b',
    '3b',
    'ss',
    'lf',
    'cf',
    'rf',
  ],
} as const;

describe('ManagerAlignmentSelection', () => {
  it('uses zero comparison noise for maximum ability when calibration permits exact comparison', () => {
    const result = selectDefensiveAlignmentCandidateForManager({
      ...baseInput,
      alignmentComparison: 1,
      rng: new DeterministicRng(123),
      calibration: {
        minimumComparisonErrorMeters: 0,
        maximumComparisonErrorMeters: 8,
      },
    });

    expect(result.comparisonErrorScaleMeters).toBe(0);
    expect(result.evaluations.every(
      (entry) => entry.comparisonErrorMeters === 0,
    )).toBe(true);
    expect(result.selected.id).toBe(
      result.objectiveSelection.selected.id,
    );
  });

  it('adds deterministic candidate-comparison error without changing the objective scouting evaluation', () => {
    const run = () => selectDefensiveAlignmentCandidateForManager({
      ...baseInput,
      alignmentComparison: 0.25,
      rng: new DeterministicRng(20260918),
      calibration: {
        minimumComparisonErrorMeters: 0,
        maximumComparisonErrorMeters: 8,
      },
    });

    const first = run();
    const second = run();

    expect(first).toEqual(second);
    expect(first.comparisonErrorScaleMeters).toBe(6);
    expect(first.objectiveSelection.evaluations)
      .toEqual(second.objectiveSelection.evaluations);
    expect(first.evaluations.some(
      (entry) => entry.comparisonErrorMeters !== 0,
    )).toBe(true);
  });

  it('does not mutate candidate alignments or player physics while comparing', () => {
    const beforeNormal = structuredClone(normal);
    const beforeShift = structuredClone(pullShift);

    selectDefensiveAlignmentCandidateForManager({
      ...baseInput,
      alignmentComparison: 0,
      rng: new DeterministicRng(5),
      calibration: {
        minimumComparisonErrorMeters: 0,
        maximumComparisonErrorMeters: 12,
      },
    });

    expect(normal).toEqual(beforeNormal);
    expect(pullShift).toEqual(beforeShift);
  });
});
