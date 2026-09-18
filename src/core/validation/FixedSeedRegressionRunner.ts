import {
  canonicalizeEvidence,
  createCanonicalEvidenceFingerprint,
} from './CanonicalEvidenceFingerprint';
import type {
  FixedSeedRegressionCorpus,
  FixedSeedRegressionScenario,
} from './FixedSeedRegressionCorpus';

export type FixedSeedScenarioBuilder = (
  scenario: FixedSeedRegressionScenario,
) => unknown;

export type FixedSeedScenarioBuilderRegistry =
  Readonly<Record<
    string,
    FixedSeedScenarioBuilder | undefined
  >>;

export type RegressionExpectation =
  | 'unfrozen'
  | 'match'
  | 'mismatch';

export type FixedSeedScenarioRunResult =
  Readonly<{
    scenarioId: string;
    scenarioBuilderId: string;
    evidenceClass:
      FixedSeedRegressionScenario['evidenceClass'];
    observedFingerprint: string;
    expectedFingerprint: string | null;
    expectation: RegressionExpectation;
    evidence: unknown;
  }>;

export type FixedSeedCorpusRunResult = Readonly<{
  version: 1;
  scenarios:
    readonly FixedSeedScenarioRunResult[];
  unfrozen: number;
  matched: number;
  mismatched: number;
}>;

const cloneCanonical = <T>(
  value: T,
): T => (
  JSON.parse(
    canonicalizeEvidence(value),
  ) as T
);

const createFingerprintEnvelope = (
  scenario: FixedSeedRegressionScenario,
  evidence: unknown,
): unknown => ({
  version: 1,
  scenarioId: scenario.scenarioId,
  matchSeed: scenario.matchSeed,
  scenarioBuilderId:
    scenario.scenarioBuilderId,
  evidenceClass: scenario.evidenceClass,
  startingMatchState:
    scenario.startingMatchState,
  evidence,
});

const expectationFor = (
  observed: string,
  expected: string | null,
): RegressionExpectation => {
  if (expected === null) {
    return 'unfrozen';
  }

  return observed === expected
    ? 'match'
    : 'mismatch';
};

export const runFixedSeedRegressionCorpus = (
  corpus: FixedSeedRegressionCorpus,
  builders: FixedSeedScenarioBuilderRegistry,
): FixedSeedCorpusRunResult => {
  const scenarios = corpus.scenarios.map(
    (scenario) => {
      const builder =
        builders[scenario.scenarioBuilderId];

      if (builder === undefined) {
        throw new Error(
          'no fixed-seed scenario builder registered for '
          + scenario.scenarioBuilderId,
        );
      }

      const scenarioFingerprintBefore =
        createCanonicalEvidenceFingerprint(
          scenario,
        );
      const evaluationScenario =
        cloneCanonical(scenario);
      const evidence = builder(
        evaluationScenario,
      );

      if (
        createCanonicalEvidenceFingerprint(
          evaluationScenario,
        ) !== scenarioFingerprintBefore
      ) {
        throw new Error(
          'fixed-seed scenario builder must not mutate scenario input',
        );
      }

      const observedFingerprint =
        createCanonicalEvidenceFingerprint(
          createFingerprintEnvelope(
            scenario,
            evidence,
          ),
        );

      return {
        scenarioId: scenario.scenarioId,
        scenarioBuilderId:
          scenario.scenarioBuilderId,
        evidenceClass: scenario.evidenceClass,
        observedFingerprint,
        expectedFingerprint:
          scenario.expectedFingerprint,
        expectation: expectationFor(
          observedFingerprint,
          scenario.expectedFingerprint,
        ),
        evidence,
      };
    },
  );

  return {
    version: 1,
    scenarios,
    unfrozen: scenarios.filter(
      (scenario) => (
        scenario.expectation === 'unfrozen'
      ),
    ).length,
    matched: scenarios.filter(
      (scenario) => (
        scenario.expectation === 'match'
      ),
    ).length,
    mismatched: scenarios.filter(
      (scenario) => (
        scenario.expectation === 'mismatch'
      ),
    ).length,
  };
};