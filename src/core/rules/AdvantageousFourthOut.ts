import type {
  AppealOutScoringResult,
} from './AppealOutScoring';
import type {
  ThirdOutScoringResult,
} from './ThirdOutScoring';

export type ResolvedInningEndingThirdOutScoring = Extract<
  ThirdOutScoringResult,
  { kind: 'resolved' | 'simultaneous_unresolved' }
>;

export type InningEndingRunScoringResult =
  | AppealOutScoringResult
  | ResolvedInningEndingThirdOutScoring;

export type InningEndingScoringOptionSource =
  | 'apparent_third_out'
  | 'sustained_appeal';

export type InningEndingScoringOption = Readonly<{
  optionId: string;
  source: InningEndingScoringOptionSource;
  scoring: InningEndingRunScoringResult;
}>;

export type AdvantageousInningEndingOutResult =
  | Readonly<{
    kind: 'resolved';
    minimumRuns: number;
    advantageousOptions: readonly InningEndingScoringOption[];
  }>
  | Readonly<{
    kind: 'unresolved';
    unresolvedOptions: readonly InningEndingScoringOption[];
  }>;

export const createAppealScoringOption = (
  optionId: string,
  source: InningEndingScoringOptionSource,
  scoring: AppealOutScoringResult,
): InningEndingScoringOption => {
  if (optionId.length === 0) {
    throw new Error('inning-ending scoring option id must not be empty');
  }

  return {
    optionId,
    source,
    scoring,
  };
};


export const createThirdOutScoringOption = (
  optionId: string,
  scoring: ResolvedInningEndingThirdOutScoring,
): InningEndingScoringOption => {
  if (optionId.length === 0) {
    throw new Error('inning-ending scoring option id must not be empty');
  }

  return {
    optionId,
    source: 'apparent_third_out',
    scoring,
  };
};

export const selectAdvantageousInningEndingOut = (
  options: readonly InningEndingScoringOption[],
): AdvantageousInningEndingOutResult => {
  if (options.length < 2) {
    throw new Error(
      'advantageous fourth-out evaluation requires at least two options',
    );
  }

  const ids = options.map((option) => option.optionId);
  if (new Set(ids).size !== ids.length) {
    throw new Error('inning-ending scoring option ids must be unique');
  }

  const unresolvedOptions = options.filter(
    (option) => option.scoring.kind === 'simultaneous_unresolved',
  );
  if (unresolvedOptions.length > 0) {
    return {
      kind: 'unresolved',
      unresolvedOptions,
    };
  }

  const minimumRuns = Math.min(
    ...options.map((option) => option.scoring.scored.length),
  );

  return {
    kind: 'resolved',
    minimumRuns,
    advantageousOptions: options.filter(
      (option) => option.scoring.scored.length === minimumRuns,
    ),
  };
};
