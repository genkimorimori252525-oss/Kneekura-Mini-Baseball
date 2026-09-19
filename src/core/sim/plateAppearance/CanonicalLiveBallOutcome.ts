import type {
  BaseOccupancy,
} from '../../model/CanonicalMatchState';
import type {
  PlayEndFact,
} from '../../rules/PhysicalRuleFacts';
import type {
  ResolvedLiveBallPlateAppearance,
} from './PlateAppearanceMatchState';

export type SupportedOfficialLiveBallClassification =
  | 'batter_runner_out_before_first';

export type CanonicalOfficialLiveBallOutcome =
  | Readonly<{
      kind: 'supported';
      classification: SupportedOfficialLiveBallClassification;
    }>
  | Readonly<{
      kind: 'unsupported';
      reason:
        | 'play_not_terminal'
        | 'official_scoring_not_implemented';
    }>;

export type CanonicalLiveBallFinalResult = Readonly<{
  playEnd: PlayEndFact;
  outsAfter: number;
  basesAfter: BaseOccupancy;
  scoredRunnerIds: readonly string[];
  officialOutcome: CanonicalOfficialLiveBallOutcome;
}>;

export const createCanonicalLiveBallFinalResult = (
  resolution: ResolvedLiveBallPlateAppearance,
  officialOutcome: CanonicalOfficialLiveBallOutcome,
): CanonicalLiveBallFinalResult => ({
  playEnd: resolution.playEnd,
  outsAfter: resolution.outsAfter,
  basesAfter: resolution.basesAfter,
  scoredRunnerIds: [...resolution.scoredRunnerIds],
  officialOutcome,
});