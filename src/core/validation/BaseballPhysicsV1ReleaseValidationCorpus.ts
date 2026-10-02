import {
  createPublishedCoefficientRegressionCases,
} from './PublishedBaseballPhysicsValidationCorpus';
import {
  createBaseballPhysicsV1EndToEndCases,
} from './EndToEndBaseballPhysicsValidationCorpus';
import {
  evaluatePhysicsValidationCorpus,
  type PhysicsValidationCase,
  type PhysicsValidationCorpusResult,
} from './PhysicsObservableValidation';

export const BASEBALL_PHYSICS_V1_RELEASE_CORPUS_VERSION =
  'baseball-physics-v1-release-validation-v1' as const;

/**
 * Release corpus = source-level coefficient regression + end-to-end path
 * observables. Keeping both prevents a green trajectory test from hiding a
 * changed source coefficient, and prevents a green coefficient table from
 * masquerading as integrated physics validation.
 */
export const createBaseballPhysicsV1ReleaseValidationCases =
  (): readonly PhysicsValidationCase[] =>
    Object.freeze([
      ...createPublishedCoefficientRegressionCases(),
      ...createBaseballPhysicsV1EndToEndCases(),
    ]);

export const evaluateBaseballPhysicsV1ReleaseValidationCorpus =
  (): PhysicsValidationCorpusResult =>
    evaluatePhysicsValidationCorpus(
      BASEBALL_PHYSICS_V1_RELEASE_CORPUS_VERSION,
      createBaseballPhysicsV1ReleaseValidationCases(),
    );
