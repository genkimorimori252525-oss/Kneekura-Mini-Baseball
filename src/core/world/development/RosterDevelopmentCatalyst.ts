import { applyRosterChange } from '../roster/RosterCommands';
import { createRosterState } from '../roster/RosterState';
import type { PlayerAssignment, RosterState,
  RosterTransitionEvent } from '../roster/RosterTypes';
import { identifier } from '../roster/RosterValidation';

export type RosterDevelopmentCatalyst = Readonly<{
  family: 'PROMOTION_DEMOTION';
  direction: 'PROMOTION' | 'DEMOTION';
  careerId: string;
  clubId: string;
  playerId: string;
  occurredAtDay: number;
  sourceEventId: string;
  causeEventId: string;
  beforeAssignment: PlayerAssignment;
  afterAssignment: PlayerAssignment;
}>;
const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** A promotion/demotion is a possible catalyst, never a growth or trait award. */
export const deriveRosterDevelopmentCatalyst = (
  beforeInput: RosterState,
  afterInput: RosterState,
  event: RosterTransitionEvent,
  playerId: string,
): RosterDevelopmentCatalyst | null => {
  identifier(playerId, 'playerId');
  const before = createRosterState(beforeInput);
  const after = createRosterState(afterInput);
  if (event?.type !== 'ROSTER_CHANGED'
    || event.careerId !== before.careerId
    || after.careerId !== before.careerId
    || event.beforeRevision !== before.revision
    || event.afterRevision !== after.revision
    || event.effectiveDay !== after.effectiveDay
    || !Array.isArray(event.changes)
    || event.changes.length === 0) {
    throw new Error('roster event does not match development snapshots');
  }
  const replay = applyRosterChange(before, {
    commandId: event.commandId, causeEventId: event.causeEventId,
    expectedRevision: event.beforeRevision,
    effectiveDay: event.effectiveDay,
    changes: event.changes.map((change) => ({
      playerId: change.playerId,
      assignment: change.after.assignment,
      availability: change.after.availability,
      registrations: change.after.registrations,
    })),
  });
  if (!replay.ok || !same(replay.state, after)
    || !same(replay.event, event)) {
    throw new Error('roster event cannot be replayed');
  }
  const change = event.changes.find((item) =>
    item.playerId === playerId);
  if (!change || !change.before.assignment
    || !change.after.assignment
    || change.before.assignment.clubId
      !== change.after.assignment.clubId) return null;
  const fromUnit = before.units.find((item) =>
    item.unitId === change.before.assignment?.unitId);
  const toUnit = after.units.find((item) =>
    item.unitId === change.after.assignment?.unitId);
  if (!fromUnit || !toUnit
    || (fromUnit.kind === 'FIRST_TEAM')
      === (toUnit.kind === 'FIRST_TEAM')) return null;
  return Object.freeze({ family: 'PROMOTION_DEMOTION',
    direction: toUnit.kind === 'FIRST_TEAM' ? 'PROMOTION' : 'DEMOTION',
    careerId: before.careerId, clubId: toUnit.clubId,
    playerId, occurredAtDay: event.effectiveDay,
    sourceEventId: event.eventId, causeEventId: event.causeEventId,
    beforeAssignment: Object.freeze({ ...change.before.assignment }),
    afterAssignment: Object.freeze({ ...change.after.assignment }),
  });
};
