import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import type {
  PlateAppearanceCommand,
} from './PlateAppearanceCommand';

export type PlateAppearanceCommandIssue = Readonly<{
  code:
    | 'take_with_two_strikes'
    | 'waste_with_three_balls'
    | 'runner_posture_without_baserunner';
  severity: 'warning' | 'no_effect';
  message: string;
}>;

export type PlateAppearanceCommandValidation =
  Readonly<{
    executable: true;
    issues: readonly PlateAppearanceCommandIssue[];
  }>;

const hasAnyBaserunner = (
  match: CanonicalMatchState,
): boolean => (
  match.bases.first !== null
  || match.bases.second !== null
  || match.bases.third !== null
);

export const validatePlateAppearanceCommandContext = (
  match: CanonicalMatchState,
  command: PlateAppearanceCommand,
): PlateAppearanceCommandValidation => {
  const issues: PlateAppearanceCommandIssue[] = [];

  if (
    command.batter.approach === 'take'
    && match.strikes === 2
  ) {
    issues.push({
      code: 'take_with_two_strikes',
      severity: 'warning',
      message:
        'take approach with two strikes can end the plate appearance on a called strike',
    });
  }

  if (
    command.pitcher.aggression === 'waste'
    && match.balls === 3
  ) {
    issues.push({
      code: 'waste_with_three_balls',
      severity: 'warning',
      message:
        'waste pitching with three balls increases the risk of an immediate walk',
    });
  }

  if (
    command.runners.posture !== 'balanced'
    && !hasAnyBaserunner(match)
  ) {
    issues.push({
      code: 'runner_posture_without_baserunner',
      severity: 'no_effect',
      message:
        'runner posture has no current baserunner to influence',
    });
  }

  return {
    executable: true,
    issues,
  };
};
