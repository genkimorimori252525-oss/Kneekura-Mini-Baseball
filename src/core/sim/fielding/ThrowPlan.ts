import type {
  DefenseContext,
} from './DefenseContext';

export type ProjectedScoringThreat = Readonly<{
  runnerId: string;
  scoreProbability: number;
}>;

export type ThrowPlanCandidate = Readonly<{
  id: string;
  targetBase: 1 | 2 | 3 | 4;
  receiverId: string;
  estimatedCompletionTick: number;
  outProbability: number;
  scoringThreats: readonly ProjectedScoringThreat[];
  expectedExtraBasesAllowed: number;
}>;

export type ThrowPlanEvaluation = Readonly<{
  id: string;
  immediateLossProbability: number;
  criticalScoreSwingProbability: number;
  expectedRunsAllowed: number;
  outProbability: number;
  expectedExtraBasesAllowed: number;
  estimatedCompletionTick: number;
}>;

export type ThrowPlanSelection = Readonly<{
  selected: ThrowPlanCandidate;
  evaluations: readonly ThrowPlanEvaluation[];
}>;

const validateProbability = (
  name: string,
  value: number,
): void => {
  if (
    !Number.isFinite(value)
    || value < 0
    || value > 1
  ) {
    throw new Error(
      `${name} must be finite and within [0, 1]`,
    );
  }
};

const probabilityAtLeastRuns = (
  probabilities: readonly number[],
  requiredRuns: number,
): number => {
  if (requiredRuns <= 0) {
    return 1;
  }
  if (requiredRuns > probabilities.length) {
    return 0;
  }

  let distribution = Array.from(
    { length: probabilities.length + 1 },
    (_, index) => index === 0 ? 1 : 0,
  );

  let processed = 0;
  for (const probability of probabilities) {
    const next = Array.from(
      { length: probabilities.length + 1 },
      () => 0,
    );
    for (
      let runs = 0;
      runs <= processed;
      runs += 1
    ) {
      next[runs] += (
        distribution[runs]
        * (1 - probability)
      );
      next[runs + 1] += (
        distribution[runs]
        * probability
      );
    }
    distribution = next;
    processed += 1;
  }

  return distribution
    .slice(requiredRuns)
    .reduce(
      (total, probability) => (
        total + probability
      ),
      0,
    );
};

const validateCandidate = (
  candidate: ThrowPlanCandidate,
): void => {
  if (candidate.id.length === 0) {
    throw new Error(
      'throw-plan candidate id must not be empty',
    );
  }
  if (
    candidate.targetBase !== 1
    && candidate.targetBase !== 2
    && candidate.targetBase !== 3
    && candidate.targetBase !== 4
  ) {
    throw new Error(
      'throw-plan targetBase must be 1, 2, 3, or 4',
    );
  }
  if (candidate.receiverId.length === 0) {
    throw new Error(
      'throw-plan receiverId must not be empty',
    );
  }
  if (
    !Number.isSafeInteger(
      candidate.estimatedCompletionTick,
    )
    || candidate.estimatedCompletionTick < 0
  ) {
    throw new Error(
      'estimatedCompletionTick must be a non-negative safe integer tick',
    );
  }

  validateProbability(
    'outProbability',
    candidate.outProbability,
  );

  if (
    !Number.isFinite(
      candidate.expectedExtraBasesAllowed,
    )
    || candidate.expectedExtraBasesAllowed < 0
  ) {
    throw new Error(
      'expectedExtraBasesAllowed must be finite and non-negative',
    );
  }

  const runnerIds = new Set<string>();
  for (const threat of candidate.scoringThreats) {
    if (threat.runnerId.length === 0) {
      throw new Error(
        'scoring threat runnerId must not be empty',
      );
    }
    if (runnerIds.has(threat.runnerId)) {
      throw new Error(
        'scoring threat runnerIds must be unique within a candidate',
      );
    }
    runnerIds.add(threat.runnerId);

    validateProbability(
      'scoreProbability',
      threat.scoreProbability,
    );
  }
};

const evaluateCandidate = (
  context: DefenseContext,
  candidate: ThrowPlanCandidate,
): ThrowPlanEvaluation => {
  const scoreProbabilities =
    candidate.scoringThreats.map(
      (threat) => threat.scoreProbability,
    );

  const expectedRunsAllowed =
    scoreProbabilities.reduce(
      (total, probability) => (
        total + probability
      ),
      0,
    );

  const runsToCriticalSwing = Math.max(
    1,
    context.defendingRuns
      - context.battingRuns,
  );

  const criticalScoreSwingProbability =
    probabilityAtLeastRuns(
      scoreProbabilities,
      runsToCriticalSwing,
    );

  const runsToImmediateLoss = Math.max(
    1,
    context.defendingRuns
      - context.battingRuns
      + 1,
  );

  const immediateLossProbability =
    context.walkOffEligible
      ? probabilityAtLeastRuns(
          scoreProbabilities,
          runsToImmediateLoss,
        )
      : 0;

  return {
    id: candidate.id,
    immediateLossProbability,
    criticalScoreSwingProbability,
    expectedRunsAllowed,
    outProbability: candidate.outProbability,
    expectedExtraBasesAllowed:
      candidate.expectedExtraBasesAllowed,
    estimatedCompletionTick:
      candidate.estimatedCompletionTick,
  };
};

const compareEvaluations = (
  first: ThrowPlanEvaluation,
  second: ThrowPlanEvaluation,
): number => (
  first.immediateLossProbability
    - second.immediateLossProbability
  || first.criticalScoreSwingProbability
    - second.criticalScoreSwingProbability
  || first.expectedRunsAllowed
    - second.expectedRunsAllowed
  || second.outProbability
    - first.outProbability
  || first.expectedExtraBasesAllowed
    - second.expectedExtraBasesAllowed
  || first.estimatedCompletionTick
    - second.estimatedCompletionTick
  || first.id.localeCompare(second.id)
);

export const selectThrowPlan = (
  context: DefenseContext,
  candidates: readonly ThrowPlanCandidate[],
): ThrowPlanSelection => {
  if (candidates.length === 0) {
    throw new Error(
      'at least one throw-plan candidate is required',
    );
  }

  const ids = new Set<string>();
  for (const candidate of candidates) {
    validateCandidate(candidate);
    if (ids.has(candidate.id)) {
      throw new Error(
        'throw-plan candidate ids must be unique',
      );
    }
    ids.add(candidate.id);
  }

  const evaluations = candidates.map(
    (candidate) => (
      evaluateCandidate(context, candidate)
    ),
  );
  const ranked = [...evaluations].sort(
    compareEvaluations,
  );
  const selected = candidates.find(
    (candidate) => candidate.id === ranked[0].id,
  );
  if (selected === undefined) {
    throw new Error(
      'selected throw-plan candidate must exist',
    );
  }

  return {
    selected,
    evaluations,
  };
};
