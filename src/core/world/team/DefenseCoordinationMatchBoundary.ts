import type { DefenderWorldState } from '../../model/CanonicalWorldSnapshot';
import { applyTeamCoveragePlanToWorld } from '../../sim/fielding/TeamCoverageWorldAdapter';
import { planMiddleInfieldCoordinatedCoverage } from './DefenseCoordinationExecution';
import type { CoordinatedCoveragePlan,
  MiddleInfieldCoverageInput } from './DefenseCoordinationExecution';

/** Values a Match host must supply from its lineup and verified event history. */
export type MiddleInfieldMatchCoverageInput = MiddleInfieldCoverageInput
  & Readonly<{
    worldDefenders: readonly DefenderWorldState[];
    verifiedJointSourceEventIds: readonly string[];
  }>;

export type AppliedMiddleInfieldCoverage = CoordinatedCoveragePlan
  & Readonly<{ defenders: readonly DefenderWorldState[] }>;

/** Applies coordination only to the same nine defenders in the Match world. */
export const applyMiddleInfieldCoordinatedCoverageToMatchWorld = (
  input: MiddleInfieldMatchCoverageInput,
): AppliedMiddleInfieldCoverage => {
  const lineup = new Map(input.worldDefenders.map((defender) =>
    [defender.playerId, defender]));
  if (input.worldDefenders.length !== 9 || lineup.size !== 9
    || input.coverage.defenders.length !== 9
    || input.coverage.defenders.some((defender) =>
      lineup.get(defender.playerId)?.registeredPosition
        !== defender.registeredPosition)
    || input.worldDefenders.some((defender) =>
      !input.roster.players.some((player) =>
        player.playerId === defender.playerId
          && player.assignment?.clubId === input.clubId))) {
    throw new Error('coverage must match the match defensive lineup');
  }

  const coordinated = planMiddleInfieldCoordinatedCoverage(input);
  const verified = new Set(input.verifiedJointSourceEventIds);
  if (coordinated.cue?.sourceEventIds.some((eventId) =>
    !verified.has(eventId))) {
    throw new Error('coordination cue requires every verified joint event');
  }
  const defenders = applyTeamCoveragePlanToWorld(input.worldDefenders,
    coordinated.plan);
  return Object.freeze({ ...coordinated, defenders });
};
