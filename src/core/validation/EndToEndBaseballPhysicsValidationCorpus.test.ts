import { describe, expect, it } from 'vitest';
import {
  BASEBALL_PHYSICS_V1_END_TO_END_CORPUS_VERSION,
  createBaseballPhysicsV1EndToEndCases,
  evaluateBaseballPhysicsV1EndToEndCorpus,
} from './EndToEndBaseballPhysicsValidationCorpus';

describe('baseball physics v1 end-to-end validation corpus', () => {
  it('covers the frozen causal path with explicit empirical or invariant observables', () => {
    expect(
      createBaseballPhysicsV1EndToEndCases()
        .map((entry) => entry.caseId),
    ).toEqual([
      'pitch-path-nathan-2026-spin-decay',
      'game-speed-wood-oblique-contact',
      'batted-flight-nathan-2026-spin-decay',
      'natural-turf-hard-ball-vertical-bounce',
      'ground-no-slip-roll-kinematic-invariant',
      'takashima-2015-rigid-wall-impact',
    ]);
  });

  it('passes every observable at the frozen v1 tolerances', () => {
    const result =
      evaluateBaseballPhysicsV1EndToEndCorpus();

    expect(result.version).toBe(
      BASEBALL_PHYSICS_V1_END_TO_END_CORPUS_VERSION,
    );
    expect(result.passed).toBe(true);
    expect(
      result.cases.every(
        (entry) => entry.passed,
      ),
    ).toBe(true);
  });

  it('has a deterministic evidence fingerprint', () => {
    const first =
      evaluateBaseballPhysicsV1EndToEndCorpus();
    const second =
      evaluateBaseballPhysicsV1EndToEndCorpus();

    expect(first.fingerprint)
      .toBe(second.fingerprint);
    expect(first.cases.map(
      (entry) => entry.fingerprint,
    )).toEqual(
      second.cases.map(
        (entry) => entry.fingerprint,
      ),
    );
  });
});
