import { expect, it } from 'vitest';
import { applyRosterChange } from '../roster/RosterCommands';
import { createRosterState } from '../roster/RosterState';
import { rosterFixture } from '../roster/RosterTestFixtures';
import { deriveRosterDevelopmentCatalyst } from './RosterDevelopmentCatalyst';

it('derives a possible promotion catalyst from an accepted first-team assignment', () => {
  const before = createRosterState(rosterFixture());
  const changed = applyRosterChange(before, { commandId: 'promote-1',
    causeEventId: 'manager-selection-1', expectedRevision: 0,
    effectiveDay: 10, changes: [{ playerId: 'p2',
      assignment: { clubId: 'a', unitId: 'a-first' } }],
  });
  if (!changed.ok) throw new Error(JSON.stringify(changed.rejection));
  const candidate = deriveRosterDevelopmentCatalyst(before,
    changed.state, changed.event, 'p2');
  expect(candidate).toMatchObject({ family: 'PROMOTION_DEMOTION',
    direction: 'PROMOTION', playerId: 'p2', clubId: 'a',
    sourceEventId: changed.event.eventId,
    causeEventId: 'manager-selection-1',
    beforeAssignment: { unitId: 'a-farm-1' },
    afterAssignment: { unitId: 'a-first' } });
  expect(Object.isFrozen(candidate)).toBe(true);
  expect(candidate).not.toHaveProperty('abilityChange');
});

it('does not turn availability or lateral placement into a promotion catalyst', () => {
  const before = createRosterState(rosterFixture());
  const changed = applyRosterChange(before, { commandId: 'lateral-1',
    causeEventId: 'coach-1', expectedRevision: 0,
    effectiveDay: 10, changes: [{ playerId: 'p2',
      assignment: { clubId: 'a', unitId: 'a-farm-2' },
      availability: { status: 'AVAILABLE', evidenceId: 'health-2' } }],
  });
  if (!changed.ok) throw new Error(JSON.stringify(changed.rejection));
  expect(deriveRosterDevelopmentCatalyst(before,
    changed.state, changed.event, 'p2')).toBeNull();
});

it('rejects fabricated transition history and wrong-player attribution', () => {
  const before = createRosterState(rosterFixture());
  const changed = applyRosterChange(before, { commandId: 'demote-1',
    causeEventId: 'manager-selection-2', expectedRevision: 0,
    effectiveDay: 10, changes: [{ playerId: 'p1',
      assignment: { clubId: 'a', unitId: 'a-reserve' } }],
  });
  if (!changed.ok) throw new Error(JSON.stringify(changed.rejection));
  expect(deriveRosterDevelopmentCatalyst(before,
    changed.state, changed.event, 'p1')).toMatchObject({
    direction: 'DEMOTION' });
  expect(deriveRosterDevelopmentCatalyst(before,
    changed.state, changed.event, 'p2')).toBeNull();
  expect(() => deriveRosterDevelopmentCatalyst(before,
    changed.state, { ...changed.event, afterRevision: 5 }, 'p1'))
    .toThrow('roster event');
});
