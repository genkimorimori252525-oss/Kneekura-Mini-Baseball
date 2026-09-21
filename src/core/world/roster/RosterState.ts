import type { RosterState, RosterStateInput } from './RosterTypes';
import {
  array, copyPlayer, copyProfile, copyUnit, freeze, identifier,
  nonnegativeInteger, object, RosterValidationError, unique,
} from './RosterValidation';

/** Hydrate a trusted saved/world snapshot; not an authorization or recruitment API. */
export function createRosterState(input: RosterStateInput): RosterState {
  const v = object(input, 'roster');
  const state: RosterState = {
    careerId: identifier(v.careerId, 'careerId'),
    revision: v.revision === undefined ? 0 : nonnegativeInteger(v.revision, 'revision'),
    effectiveDay: v.effectiveDay === undefined ? 0 : nonnegativeInteger(v.effectiveDay, 'effectiveDay'),
    profiles: array(v.profiles, 'profiles').map(copyProfile),
    units: array(v.units, 'units').map(copyUnit),
    players: array(v.players, 'players').map(copyPlayer),
  };
  unique(state.players.map(p => p.playerId), 'players.playerId');
  unique(state.units.map(u => u.unitId), 'units.unitId');
  unique(state.profiles.map(p => p.competitionEditionId), 'profiles.competitionEditionId');
  const units = new Map(state.units.map(unit => [unit.unitId, unit]));
  const profiles = new Map(state.profiles.map(profile => [profile.competitionEditionId, profile]));
  const activeCounts = new Map<string, Map<string, number>>();
  for (const player of state.players) {
    if (player.assignment !== null) {
      const unit = units.get(player.assignment.unitId);
      if (!unit) throw new RosterValidationError({ code: 'UNKNOWN_UNIT', playerId: player.playerId });
      if (unit.clubId !== player.assignment.clubId) {
        throw new RosterValidationError({ code: 'ASSIGNMENT_CLUB_MISMATCH', playerId: player.playerId });
      }
    }
    for (const registration of player.registrations) {
      const edition = registration.competitionEditionId;
      const profile = profiles.get(edition);
      if (!profile) throw new RosterValidationError({ code: 'UNKNOWN_COMPETITION', playerId: player.playerId, competitionEditionId: edition });
      if (registration.status !== 'ACTIVE') continue;
      const counts = activeCounts.get(edition) ?? new Map<string, number>();
      const count = (counts.get(registration.clubId) ?? 0) + 1;
      counts.set(registration.clubId, count);
      activeCounts.set(edition, counts);
      if (profile.activeLimit !== null && count > profile.activeLimit) {
        throw new RosterValidationError({
          code: 'ACTIVE_LIMIT_EXCEEDED', competitionEditionId: edition,
          clubId: registration.clubId, limit: profile.activeLimit, actual: count,
        });
      }
    }
  }
  return freeze(state);
}