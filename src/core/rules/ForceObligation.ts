import type { BaseOccupancy } from '../model/CanonicalMatchState';
import type { BaseballBase } from './PhysicalRuleFacts';

export type ForceParticipantBase = 0 | 1 | 2 | 3;

export type ForceParticipant = Readonly<{
  runnerId: string;
  startBase: ForceParticipantBase;
  active: boolean;
}>;

export type ForceObligationState = Readonly<{
  batterRunnerId: string;
  participants: readonly ForceParticipant[];
}>;

export type ForceObligation = Readonly<{
  runnerId: string;
  fromBase: ForceParticipantBase;
  targetBase: BaseballBase;
  classification: 'batter_runner_before_first' | 'force';
}>;

const participantFor = (
  runnerId: string,
  startBase: ForceParticipantBase,
): ForceParticipant => ({
  runnerId,
  startBase,
  active: true,
});

export const createInitialForceObligationState = (
  bases: BaseOccupancy,
  batterRunnerId: string,
): ForceObligationState => {
  if (batterRunnerId.length === 0) {
    throw new Error('batterRunnerId must not be empty');
  }

  const participants: ForceParticipant[] = [
    participantFor(batterRunnerId, 0),
  ];

  if (bases.first !== null) {
    participants.push(participantFor(bases.first, 1));
  }
  if (bases.second !== null) {
    participants.push(participantFor(bases.second, 2));
  }
  if (bases.third !== null) {
    participants.push(participantFor(bases.third, 3));
  }

  const ids = participants.map((participant) => participant.runnerId);
  if (new Set(ids).size !== ids.length) {
    throw new Error('force participants must have unique runner ids');
  }

  return {
    batterRunnerId,
    participants,
  };
};

const activeAtBase = (
  state: ForceObligationState,
  base: ForceParticipantBase,
): ForceParticipant | undefined => state.participants.find(
  (participant) => participant.startBase === base && participant.active,
);

export const deriveCurrentForceObligations = (
  state: ForceObligationState,
): readonly ForceObligation[] => {
  const batter = activeAtBase(state, 0);
  if (batter === undefined) {
    return [];
  }

  const obligations: ForceObligation[] = [{
    runnerId: batter.runnerId,
    fromBase: 0,
    targetBase: 1,
    classification: 'batter_runner_before_first',
  }];

  for (const fromBase of [1, 2, 3] as const) {
    const previous = activeAtBase(
      state,
      (fromBase - 1) as ForceParticipantBase,
    );
    const current = activeAtBase(state, fromBase);

    if (previous === undefined || current === undefined) {
      break;
    }

    obligations.push({
      runnerId: current.runnerId,
      fromBase,
      targetBase: (fromBase + 1) as BaseballBase,
      classification: 'force',
    });
  }

  return obligations;
};

export const retireForceParticipant = (
  state: ForceObligationState,
  runnerId: string,
): ForceObligationState => {
  const participant = state.participants.find(
    (candidate) => candidate.runnerId === runnerId,
  );
  if (participant === undefined) {
    throw new Error('cannot retire unknown force participant');
  }

  return {
    batterRunnerId: state.batterRunnerId,
    participants: state.participants.map((candidate) => (
      candidate.runnerId === runnerId
        ? { ...candidate, active: false }
        : candidate
    )),
  };
};
