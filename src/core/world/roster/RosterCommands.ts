import type {
  PlayerClubState, PlayerRosterChange, RosterChangeCommand, RosterChangeResult,
  RosterState, RosterTransitionEvent,
} from './RosterTypes';
import { createRosterState } from './RosterState';
import {
  array, copyAssignment, copyAvailability, copyRegistrations, freeze, identifier, invalid,
  nonnegativeInteger, object, onlyKeys, RosterValidationError, unique,
} from './RosterValidation';

function copyChange(value: unknown): PlayerRosterChange {
  const v = object(value, 'change');
  onlyKeys(v, ['playerId', 'assignment', 'availability', 'registrations'], 'change');
  if (!('assignment' in v || 'availability' in v || 'registrations' in v)) invalid('change');
  return {
    playerId: identifier(v.playerId, 'change.playerId'),
    ...('assignment' in v ? { assignment: copyAssignment(v.assignment) } : {}),
    ...('availability' in v ? { availability: copyAvailability(v.availability) } : {}),
    ...('registrations' in v ? { registrations: copyRegistrations(v.registrations) } : {}),
  };
}
function copyCommand(value: unknown): RosterChangeCommand {
  const v = object(value, 'command');
  onlyKeys(v, ['commandId', 'causeEventId', 'expectedRevision', 'effectiveDay', 'changes'], 'command');
  const changes = array(v.changes, 'command.changes').map(copyChange);
  if (changes.length === 0) invalid('command.changes');
  unique(changes.map(change => change.playerId), 'command.changes.playerId');
  return {
    commandId: identifier(v.commandId, 'commandId'),
    causeEventId: identifier(v.causeEventId, 'causeEventId'),
    expectedRevision: nonnegativeInteger(v.expectedRevision, 'expectedRevision'),
    effectiveDay: nonnegativeInteger(v.effectiveDay, 'effectiveDay'),
    changes,
  };
}

function changePlayer(player: PlayerClubState, change: PlayerRosterChange): PlayerClubState {
  if ('assignment' in change) {
    const destination = change.assignment;
    const currentClub = player.assignment?.clubId ?? player.clubRights.rightsHolderClubId;
    // Ending an external assignment also requires its transaction owner. Without this
    // guard, external -> unassigned -> rights-holder would silently terminate a loan.
    const endsExternal = destination === null && player.assignment !== null
      && player.assignment.clubId !== player.clubRights.rightsHolderClubId;
    if (endsExternal || (destination && destination.clubId !== currentClub)) {
      throw new RosterValidationError({ code: 'EXTERNAL_TRANSACTION_REQUIRED', playerId: player.playerId });
    }
  }
  const registrations = [...player.registrations];
  for (const update of change.registrations ?? []) {
    const index = registrations.findIndex(entry => entry.competitionEditionId === update.competitionEditionId);
    if (index === -1) registrations.push(update);
    else registrations[index] = update;
  }
  return {
    playerId: player.playerId,
    clubRights: player.clubRights,
    assignment: 'assignment' in change ? change.assignment! : player.assignment,
    registrations,
    availability: change.availability ?? player.availability,
  };
}

/**
 * Trusted domain input only: the owning services supply medical/registration evidence.
 * Atomic in memory; the host still needs a compare-and-swap + transactional persistence
 * of the returned snapshot and event. Rejections do not fabricate a world event.
 */
export function applyRosterChange(state: RosterState, command: RosterChangeCommand): RosterChangeResult {
  try {
    const request = copyCommand(command);
    if (request.expectedRevision !== state.revision) {
      throw new RosterValidationError({ code: 'STALE_REVISION', field: 'expectedRevision' });
    }
    if (request.effectiveDay < state.effectiveDay) {
      throw new RosterValidationError({ code: 'BACKDATED_COMMAND', field: 'effectiveDay' });
    }
    const players = new Map(state.players.map(player => [player.playerId, player]));
    for (const change of request.changes) {
      const player = players.get(change.playerId);
      if (!player) throw new RosterValidationError({ code: 'UNKNOWN_PLAYER', playerId: change.playerId });
      players.set(player.playerId, changePlayer(player, change));
    }
    const afterPlayers = [...players.values()];
    if (JSON.stringify(afterPlayers) === JSON.stringify(state.players)) {
      throw new RosterValidationError({ code: 'NO_CHANGE' });
    }
    // Capacity is checked once over the final batch, never against intermediate swaps.
    const next = createRosterState({
      ...state, players: afterPlayers, revision: state.revision + 1, effectiveDay: request.effectiveDay,
    });
    const event: RosterTransitionEvent = freeze({
      type: 'ROSTER_CHANGED',
      eventId: `roster:${JSON.stringify([state.careerId, next.revision])}`,
      careerId: state.careerId,
      commandId: request.commandId,
      causeEventId: request.causeEventId,
      effectiveDay: request.effectiveDay,
      beforeRevision: state.revision,
      afterRevision: next.revision,
      changes: state.players.flatMap((before, index) => {
        const after = next.players[index];
        return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ playerId: before.playerId, before, after }];
      }),
    });
    return Object.freeze({ ok: true, state: next, event });
  } catch (error) {
    if (!(error instanceof RosterValidationError)) throw error;
    return Object.freeze({ ok: false, state, rejection: error.issue });
  }
}