import { describe, expect, it } from 'vitest';
import { createRosterState, RosterValidationError } from './index';
import { rosterFixture } from './RosterTestFixtures';
import type { RosterStateInput } from './index';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function failure(input: RosterStateInput, code: string): void {
  try {
    createRosterState(input);
    expect.fail('invalid roster was accepted');
  } catch (error) {
    expect(error).toBeInstanceOf(RosterValidationError);
    expect((error as RosterValidationError).issue.code).toBe(code);
  }
}

describe('canonical roster snapshot', () => {
  it('supports multiple farm levels rather than one fixed development box', () => {
    const state = createRosterState(rosterFixture());
    expect(state.units.filter(u => u.kind === 'DEVELOPMENT')).toHaveLength(3);
    expect(state.units.filter(u => u.clubId === 'a' && u.kind === 'DEVELOPMENT').map(u => u.developmentLevel)).toEqual([1, 2]);
  });

  it('represents an agreed loan without changing rights or cloning the player', () => {
    const input = rosterFixture();
    const player = { ...input.players[1], assignment: { unitId: 'b-farm', clubId: 'b' } };
    const state = createRosterState({ ...input, players: [input.players[0], player] });
    expect(state.players[1].clubRights.rightsHolderClubId).toBe('a');
    expect(state.players[1].assignment?.clubId).toBe('b');
    expect(state.players).toHaveLength(2);
  });

  it('keeps rehabilitation separate from the assignment and registration', () => {
    const input = rosterFixture();
    const player = { ...input.players[1], availability: { status: 'REHAB' as const, evidenceId: 'rehab-clearance' } };
    const state = createRosterState({ ...input, players: [input.players[0], player] });
    expect(state.players[1].assignment?.unitId).toBe('a-farm-1');
    expect(state.players[1].registrations[0].status).toBe('ACTIVE');
    expect(state.players[1].availability.status).toBe('REHAB');
  });

  it('detaches and recursively freezes input, including historical policy', () => {
    const input = rosterFixture();
    const state = createRosterState(input);
    expect(state.players[0]).not.toBe(input.players[0]);
    expect(state.profiles[0]).not.toBe(input.profiles[0]);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.players[0].clubRights)).toBe(true);
    expect(Object.isFrozen(state.profiles[0].allowedAssignmentKinds)).toBe(true);
    (input.profiles[0] as { activeLimit: number | null }).activeLimit = 100;
    expect(state.profiles[0].activeLimit).toBe(1);
  });

  it('round-trips a saved snapshot without applying new external seeds', () => {
    const state = createRosterState({ ...rosterFixture(), revision: 7, effectiveDay: 32 });
    expect(createRosterState(copy(state))).toEqual(state);
  });

  it('does not retain unknown hidden player payloads in roster references', () => {
    const input = rosterFixture();
    const extra = { ...input.players[0], hiddenPotential: 999 };
    const state = createRosterState({ ...input, players: [extra, input.players[1]] });
    expect(state.players[0]).not.toHaveProperty('hiddenPotential');
  });

  it('rejects duplicate global player references', () => {
    const input = rosterFixture();
    failure({ ...input, players: [...input.players, input.players[0]] }, 'DUPLICATE_ID');
  });

  it('rejects duplicate unit identities', () => {
    const input = rosterFixture();
    failure({ ...input, units: [...input.units, input.units[0]] }, 'DUPLICATE_ID');
  });

  it('rejects two profile versions for the same competition edition', () => {
    const input = rosterFixture();
    failure({ ...input, profiles: [...input.profiles, { ...input.profiles[0], version: '2' }] }, 'DUPLICATE_ID');
  });

  it('rejects assignment references to missing units', () => {
    const input = rosterFixture();
    failure({ ...input, players: [{ ...input.players[0], assignment: { unitId: 'missing', clubId: 'a' } }] }, 'UNKNOWN_UNIT');
  });

  it('rejects a unit whose club disagrees with the assignment', () => {
    const input = rosterFixture();
    failure({ ...input, players: [{ ...input.players[0], assignment: { unitId: 'a-first', clubId: 'b' } }] }, 'ASSIGNMENT_CLUB_MISMATCH');
  });

  it('rejects missing competition profile references', () => {
    const input = rosterFixture();
    failure({ ...input, profiles: [] }, 'UNKNOWN_COMPETITION');
  });

  it('rejects duplicate registrations in the same edition', () => {
    const input = rosterFixture();
    failure({ ...input, players: [{ ...input.players[0], registrations: [input.players[0].registrations[0], input.players[0].registrations[0]] }] }, 'DUPLICATE_ID');
  });

  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid active capacity %s', activeLimit => {
    const input = rosterFixture();
    failure({ ...input, profiles: [{ ...input.profiles[0], activeLimit }, input.profiles[1]] }, 'INVALID_INPUT');
  });

  it('rejects a malformed runtime enum rather than trusting a TypeScript cast', () => {
    const input = copy(rosterFixture());
    (input.units[0] as { kind: string }).kind = 'INJURY_TIER';
    failure(input, 'INVALID_INPUT');
  });

  it('rejects empty identity and unsafe revision', () => {
    failure({ ...rosterFixture(), careerId: ' ' }, 'INVALID_INPUT');
    failure({ ...rosterFixture(), revision: Number.MAX_SAFE_INTEGER + 1 }, 'INVALID_INPUT');
  });
});