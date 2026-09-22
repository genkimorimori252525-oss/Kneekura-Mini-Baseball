import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import {
  createCanonicalPlateAppearanceTimeline,
  type CanonicalPlateAppearanceTimeline,
} from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  deriveClosedLiveBallMatchState,
  getOfficialPlayClosure,
  type PlayAdjudicationLedger,
} from './PlayAdjudicationLedger';

export type NextLiveBallPlayActivationInput = Readonly<{
  match: CanonicalMatchState;
  physicalTimeline: CanonicalPlateAppearanceTimeline;
  adjudication: PlayAdjudicationLedger;
  nextStartedAtTick: number;
}>;

export type NextLiveBallPlayActivation = Readonly<{
  previousPlayId: number;
  closureId: string;
  nextMatchState: CanonicalMatchState;
  nextTimeline: CanonicalPlateAppearanceTimeline;
}>;

export const activateNextLiveBallPlay = (
  input: NextLiveBallPlayActivationInput,
): NextLiveBallPlayActivation => {
  const closure = getOfficialPlayClosure(input.adjudication);
  if (closure === null) {
    throw new Error('official play must be closed before activating the next play');
  }
  if (!Number.isSafeInteger(input.nextStartedAtTick) || input.nextStartedAtTick < 0) {
    throw new Error('nextStartedAtTick must be a non-negative safe integer tick');
  }
  if (input.nextStartedAtTick < closure.closedAtTick) {
    throw new Error('next play cannot start before OfficialPlayClosure');
  }

  const nextMatchState = deriveClosedLiveBallMatchState(
    input.match,
    input.physicalTimeline,
    input.adjudication,
  );
  const nextTimeline = createCanonicalPlateAppearanceTimeline(
    nextMatchState,
    input.nextStartedAtTick,
  );

  return Object.freeze({
    previousPlayId: input.match.playId,
    closureId: closure.closureId,
    nextMatchState,
    nextTimeline,
  });
};
