import { describe, expect, it } from 'vitest';
import {
  createPublishedCoefficientRegressionCases,
} from './PublishedBaseballPhysicsValidationCorpus';
import {
  createBaseballPhysicsV1EndToEndCases,
} from './EndToEndBaseballPhysicsValidationCorpus';
import {
  BASEBALL_PHYSICS_V1_RELEASE_CORPUS_VERSION,
  createBaseballPhysicsV1ReleaseValidationCases,
  evaluateBaseballPhysicsV1ReleaseValidationCorpus,
} from './BaseballPhysicsV1ReleaseValidationCorpus';

describe('baseball physics v1 release validation corpus', () => {
  it('requires both source-regression and integrated end-to-end evidence', () => {
    const coefficientCount =
      createPublishedCoefficientRegressionCases()
        .length;
    const endToEndCount =
      createBaseballPhysicsV1EndToEndCases()
        .length;
    const release =
      createBaseballPhysicsV1ReleaseValidationCases();

    expect(release.length)
      .toBe(
        coefficientCount
        + endToEndCount,
      );
  });

  it('is green and deterministic for the production promotion snapshot', () => {
    const first =
      evaluateBaseballPhysicsV1ReleaseValidationCorpus();
    const second =
      evaluateBaseballPhysicsV1ReleaseValidationCorpus();

    expect(first.version)
      .toBe(
        BASEBALL_PHYSICS_V1_RELEASE_CORPUS_VERSION,
      );
    expect(first.passed).toBe(true);
    expect(first.fingerprint)
      .toBe(second.fingerprint);
  });
});
