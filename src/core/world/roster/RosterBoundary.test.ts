import { describe, expect, it } from 'vitest';
import {
  applyRosterChange, createRosterState, evaluateRosterParticipation, RosterValidationError,
} from './index';
import type { RosterChangeCommand, RosterParticipationQuery, RosterStateInput } from './index';
import { rosterFixture } from './RosterTestFixtures';

const command = (changes: RosterChangeCommand['changes']): RosterChangeCommand => ({
  commandId: 'boundary', causeEventId: 'decision', expectedRevision: 0, effectiveDay: 1, changes,
});

describe('roster transaction ownership boundary', () => {
  it('rejects new registration at an unrelated club', () => {
    const state = createRosterState(rosterFixture());
    const registration = { ...state.players[0].registrations[0], clubId: 'b' };
    const result = applyRosterChange(state, command([{ playerId: 'p2', registrations: [registration] }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('EXTERNAL_TRANSACTION_REQUIRED');
    expect(result.state).toBe(state);
  });

  it('does not rebind an existing registration to another club', () => {
    const state = createRosterState(rosterFixture());
    const registration = { ...state.players[0].registrations[0], clubId: 'b' };
    const result = applyRosterChange(state, command([{ playerId: 'p1', registrations: [registration] }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('EXTERNAL_TRANSACTION_REQUIRED');
  });

  it('does not terminate a loan through an intermediate unassigned state', () => {
    const input = rosterFixture();
    const state = createRosterState({ ...input, players: [{ ...input.players[1], assignment: { unitId: 'b-farm', clubId: 'b' } }] });
    const result = applyRosterChange(state, command([{ playerId: 'p2', assignment: null }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('EXTERNAL_TRANSACTION_REQUIRED');
    expect(result.state).toBe(state);
  });

  it('allows a new edition registration at an already-agreed external destination', () => {
    const input = rosterFixture();
    const state = createRosterState({ ...input, players: [{ ...input.players[1], assignment: { unitId: 'b-first', clubId: 'b' } }] });
    const registration = { ...input.players[0].registrations[0], clubId: 'b' };
    const result = applyRosterChange(state, command([{ playerId: 'p2', registrations: [registration] }]));
    expect(result.ok).toBe(true);
    expect(result.state.players[0].clubRights.rightsHolderClubId).toBe('a');
    expect(evaluateRosterParticipation(result.state, { playerId: 'p2', clubId: 'b', competitionEditionId: 'league-2026' }).eligible).toBe(true);
  });

  it('counts active capacity per club rather than over the whole league', () => {
    const input = rosterFixture();
    const state = createRosterState({ ...input, players: [input.players[0], {
      ...input.players[1], assignment: { unitId: 'b-first', clubId: 'b' },
      registrations: [{ ...input.players[0].registrations[0], clubId: 'b' }],
    }] });
    expect(state.players).toHaveLength(2);
    expect(state.profiles[0].activeLimit).toBe(1);
  });
});

describe('runtime malformed-input boundary', () => {
  it.each(['players', 'units', 'profiles'] as const)('rejects holes in snapshot %s with a structured issue', field => {
    const input = { ...rosterFixture(), [field]: Array(1) } as RosterStateInput;
    try { createRosterState(input); expect.fail('accepted sparse input'); }
    catch (error) {
      expect(error).toBeInstanceOf(RosterValidationError);
      expect((error as RosterValidationError).issue.code).toBe('INVALID_INPUT');
    }
  });

  it('rejects a sparse command batch without throwing or changing state', () => {
    const state = createRosterState(rosterFixture());
    const result = applyRosterChange(state, command(Array(1)));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('INVALID_INPUT');
    expect(result.state).toBe(state);
  });

  it.each([null, undefined, {}, { changes: [] }])('rejects malformed commands %s', value => {
    const state = createRosterState(rosterFixture());
    const result = applyRosterChange(state, value as unknown as RosterChangeCommand);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('INVALID_INPUT');
    expect(result.state).toBe(state);
  });

  it('rejects mutation of rights embedded in a valid player change', () => {
    const state = createRosterState(rosterFixture());
    const illicit = { playerId: 'p1', assignment: null, clubRights: { rightsHolderClubId: 'b', contractId: 'x' } };
    const result = applyRosterChange(state, command([illicit]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('INVALID_INPUT');
  });

  it('rejects overflow before revision/event identity can lose precision', () => {
    const state = createRosterState({ ...rosterFixture(), revision: Number.MAX_SAFE_INTEGER });
    const request = { ...command([{ playerId: 'p1', assignment: null }]), expectedRevision: state.revision };
    const result = applyRosterChange(state, request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('INVALID_INPUT');
    expect(result.state).toBe(state);
  });

  it('returns structured rejection for malformed participation queries', () => {
    const state = createRosterState(rosterFixture());
    const result = evaluateRosterParticipation(state, null as unknown as RosterParticipationQuery);
    expect(result.eligible).toBe(false);
    expect(result.reasons[0].code).toBe('INVALID_INPUT');
  });
});