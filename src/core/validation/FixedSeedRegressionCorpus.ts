import type {
  CanonicalMatchState,
} from '../model/CanonicalMatchState';

export type RegressionEvidenceClass =
  | 'plate_appearance'
  | 'live_ball'
  | 'fielding'
  | 'baserunning'
  | 'rules'
  | 'full_match';

export type FixedSeedRegressionScenario = Readonly<{
  scenarioId: string;
  matchSeed: number;
  startingMatchState: CanonicalMatchState;
  scenarioBuilderId: string;
  evidenceClass: RegressionEvidenceClass;
  expectedFingerprint: string | null;
}>;

export type FixedSeedRegressionCorpus = Readonly<{
  version: 1;
  scenarios: readonly FixedSeedRegressionScenario[];
}>;

const FINGERPRINT_PATTERN = /^[0-9a-f]{16}$/;
const UINT32_MAX = 0xffff_ffff;

const deepFreeze = <T>(
  value: T,
): T => {
  if (
    value === null
    || typeof value !== 'object'
    || Object.isFrozen(value)
  ) {
    return value;
  }

  const record = value as Record<
    string,
    unknown
  >;

  for (const key of Object.keys(record)) {
    deepFreeze(record[key]);
  }

  return Object.freeze(value);
};

const cloneMatchState = (
  state: CanonicalMatchState,
): CanonicalMatchState => ({
  ruleProfileId: state.ruleProfileId,
  inning: state.inning,
  half: state.half,
  outs: state.outs,
  balls: state.balls,
  strikes: state.strikes,
  bases: {
    first: state.bases.first,
    second: state.bases.second,
    third: state.bases.third,
  },
  score: {
    away: state.score.away,
    home: state.score.home,
  },
  playId: state.playId,
});

const validateScenario = (
  scenario: FixedSeedRegressionScenario,
): void => {
  if (scenario.scenarioId.length === 0) {
    throw new Error(
      'scenarioId must not be empty',
    );
  }
  if (
    !Number.isInteger(scenario.matchSeed)
    || scenario.matchSeed < 0
    || scenario.matchSeed > UINT32_MAX
  ) {
    throw new Error(
      'matchSeed must be an unsigned 32-bit integer',
    );
  }
  if (
    !Number.isSafeInteger(
      scenario.startingMatchState.playId,
    )
    || scenario.startingMatchState.playId < 0
  ) {
    throw new Error(
      'startingMatchState.playId must be a non-negative safe integer',
    );
  }
  if (scenario.scenarioBuilderId.length === 0) {
    throw new Error(
      'scenarioBuilderId must not be empty',
    );
  }
  if (
    scenario.expectedFingerprint !== null
    && !FINGERPRINT_PATTERN.test(
      scenario.expectedFingerprint,
    )
  ) {
    throw new Error(
      'expectedFingerprint must be null or a 16-digit lowercase hexadecimal fingerprint',
    );
  }
};

export const createFixedSeedRegressionCorpus = (
  scenarios: readonly FixedSeedRegressionScenario[],
): FixedSeedRegressionCorpus => {
  const seenScenarioIds = new Set<string>();

  for (const scenario of scenarios) {
    validateScenario(scenario);

    if (seenScenarioIds.has(scenario.scenarioId)) {
      throw new Error(
        'fixed-seed scenarioIds must be unique',
      );
    }
    seenScenarioIds.add(scenario.scenarioId);
  }

  return deepFreeze({
    version: 1,
    scenarios: scenarios.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      matchSeed: scenario.matchSeed,
      startingMatchState: cloneMatchState(
        scenario.startingMatchState,
      ),
      scenarioBuilderId:
        scenario.scenarioBuilderId,
      evidenceClass: scenario.evidenceClass,
      expectedFingerprint:
        scenario.expectedFingerprint,
    })),
  });
};