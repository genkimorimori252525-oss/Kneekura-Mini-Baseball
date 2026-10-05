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

it('replays canonically serialized roster evidence while still rejecting changed event facts', () => {
  const before = createRosterState(rosterFixture());
  const changed = applyRosterChange(before, { commandId: 'native-promotion', causeEventId: 'native-execution',
    expectedRevision: 0, effectiveDay: 10, changes: [{ playerId: 'p2', assignment: { clubId: 'a', unitId: 'a-first' } }] });
  if (!changed.ok) throw new Error(JSON.stringify(changed.rejection));
  const canonicalRoundTrip = <T>(input: T): T => JSON.parse(JSON.stringify(input, (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item)) as T;
  const nativeEvent = canonicalRoundTrip(changed.event);
  expect(JSON.stringify(nativeEvent)).not.toBe(JSON.stringify(changed.event));
  expect(deriveRosterDevelopmentCatalyst(canonicalRoundTrip(before), canonicalRoundTrip(changed.state), nativeEvent, 'p2'))
    .toEqual(deriveRosterDevelopmentCatalyst(before, changed.state, changed.event, 'p2'));
  const forged = { ...nativeEvent, changes: nativeEvent.changes.map(change => ({ ...change,
    before: { ...change.before, availability: { ...change.before.availability, evidenceId: 'forged-before-health' } } })) };
  expect(() => deriveRosterDevelopmentCatalyst(before, changed.state, forged, 'p2')).toThrow('cannot be replayed');
});

it('preserves ordered transition changes when validating roster evidence', () => {
  const before = createRosterState(rosterFixture());
  const changed = applyRosterChange(before, { commandId: 'native-swap', causeEventId: 'native-swap-execution',
    expectedRevision: 0, effectiveDay: 10, changes: [
      { playerId: 'p1', assignment: { clubId: 'a', unitId: 'a-reserve' } },
      { playerId: 'p2', assignment: { clubId: 'a', unitId: 'a-first' } },
    ] });
  if (!changed.ok) throw new Error(JSON.stringify(changed.rejection));
  expect(changed.event.changes).toHaveLength(2);
  expect(() => deriveRosterDevelopmentCatalyst(before, changed.state,
    { ...changed.event, changes: [...changed.event.changes].reverse() }, 'p2')).toThrow('cannot be replayed');
  const registrations = [...changed.event.changes[0].before.registrations];
  registrations.length += 1;
  const sparse = { ...changed.event, changes: changed.event.changes.map((change, index) => index ? change
    : { ...change, before: { ...change.before, registrations } }) };
  expect(() => deriveRosterDevelopmentCatalyst(before, changed.state, sparse, 'p2')).toThrow('cannot be replayed');
  const extra = { ...changed.event, unownedFact: 'forged' };
  expect(() => deriveRosterDevelopmentCatalyst(before, changed.state, extra, 'p2')).toThrow('cannot be replayed');
});
