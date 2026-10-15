import { describe, expect, it } from 'vitest';
import { createRosterState, applyRosterChange, evaluateRosterParticipation, getClubRoster } from './index';
import type { RosterChangeCommand, RosterState } from './index';
import { rosterFixture } from './RosterTestFixtures';

function command(changes: RosterChangeCommand['changes'], expectedRevision = 0): RosterChangeCommand {
  return { commandId: 'command-1', causeEventId: 'decision-1', expectedRevision, effectiveDay: 1, changes };
}
const active = { competitionEditionId: 'league-2026', clubId: 'a', status: 'ACTIVE' as const, eligibility: 'ELIGIBLE' as const, evidenceId: 'register-p2' };
const gate = (state: RosterState, playerId = 'p1', competitionEditionId = 'league-2026', clubId = 'a') => evaluateRosterParticipation(state, { playerId, clubId, competitionEditionId });

describe('headless roster changes', () => {
  it('promotes a player without fabricating first-team registration or altering rights', () => {
    const state = createRosterState(rosterFixture());
    const result = applyRosterChange(state, command([{ playerId: 'p2', assignment: { unitId: 'a-first', clubId: 'a' } }]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[1].clubRights).toEqual(state.players[1].clubRights);
    expect(result.state.players[1].registrations).toEqual(state.players[1].registrations);
    expect(gate(result.state, 'p2').reasons.map(r => r.code)).toContain('NOT_REGISTERED');
    expect(state.players[1].assignment?.unitId).toBe('a-farm-1');
  });

  it('swaps active registration atomically at a full roster limit', () => {
    const state = createRosterState(rosterFixture());
    const result = applyRosterChange(state, command([
      { playerId: 'p2', assignment: { unitId: 'a-first', clubId: 'a' }, registrations: [active] },
      { playerId: 'p1', assignment: { unitId: 'a-reserve', clubId: 'a' }, registrations: [{ ...active, status: 'INACTIVE', evidenceId: 'deregister-p1' }] },
    ]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(gate(result.state, 'p2').eligible).toBe(true);
    expect(gate(result.state, 'p1').eligible).toBe(false);
    expect(result.state.revision).toBe(1);
    expect(result.event.causeEventId).toBe('decision-1');
    expect(result.event.beforeRevision).toBe(0);
    expect(result.event.afterRevision).toBe(1);
    expect(result.event.changes).toHaveLength(2);
    expect(result.state.players[1].registrations).toHaveLength(2);
    expect(Object.isFrozen(result.event.changes[0].after)).toBe(true);
  });

  it('rejects over-capacity without applying any part of a multi-player command', () => {
    const state = createRosterState(rosterFixture());
    const result = applyRosterChange(state, command([
      { playerId: 'p1', availability: { status: 'INJURED', evidenceId: 'injury' } },
      { playerId: 'p2', registrations: [active] },
    ]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection.code).toBe('ACTIVE_LIMIT_EXCEEDED');
    expect(result.state).toBe(state);
    expect(result.state.players[0].availability.status).toBe('AVAILABLE');
    expect(result).not.toHaveProperty('event');
  });

  it('rejects stale repeated requests with no second event', () => {
    const state = createRosterState(rosterFixture());
    const request = command([{ playerId: 'p2', assignment: { unitId: 'a-farm-2', clubId: 'a' } }]);
    const first = applyRosterChange(state, request);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const repeated = applyRosterChange(first.state, request);
    expect(repeated.ok).toBe(false);
    if (repeated.ok) return;
    expect(repeated.rejection.code).toBe('STALE_REVISION');
    expect(repeated.state).toBe(first.state);
  });

  it('rejects backdated changes', () => {
    const state = createRosterState({ ...rosterFixture(), effectiveDay: 20 });
    const result = applyRosterChange(state, command([{ playerId: 'p1', availability: { status: 'INJURED', evidenceId: 'injury' } }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('BACKDATED_COMMAND');
  });

  it('returns a structured no-change reason instead of creating artificial history', () => {
    const state = createRosterState(rosterFixture());
    const result = applyRosterChange(state, command([{ playerId: 'p1', assignment: { unitId: 'a-first', clubId: 'a' } }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('NO_CHANGE');
  });

  it('does not invent a loan or transfer while moving between clubs', () => {
    const state = createRosterState(rosterFixture());
    const result = applyRosterChange(state, command([{ playerId: 'p2', assignment: { unitId: 'b-farm', clubId: 'b' } }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('EXTERNAL_TRANSACTION_REQUIRED');
  });

  it('allows local assignment changes at an already-authorized loan destination', () => {
    const input = rosterFixture();
    const state = createRosterState({ ...input, players: [{ ...input.players[1], assignment: { unitId: 'b-farm', clubId: 'b' } }] });
    const result = applyRosterChange(state, command([{ playerId: 'p2', assignment: { unitId: 'b-first', clubId: 'b' } }]));
    expect(result.ok).toBe(true);
    expect(result.state.players[0].clubRights.rightsHolderClubId).toBe('a');
  });

  it('rejects missing players and duplicate changes rather than last-write-wins', () => {
    const state = createRosterState(rosterFixture());
    const unknown = applyRosterChange(state, command([{ playerId: 'missing', assignment: null }]));
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.rejection.code).toBe('UNKNOWN_PLAYER');
    const duplicate = applyRosterChange(state, command([{ playerId: 'p1', assignment: null }, { playerId: 'p1', assignment: null }]));
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.rejection.code).toBe('DUPLICATE_ID');
  });

  it('does not allow immutable policy or rights to be smuggled into a command', () => {
    const state = createRosterState(rosterFixture());
    const illicit = { ...command([{ playerId: 'p1', assignment: null }]), profiles: [] };
    const result = applyRosterChange(state, illicit);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('INVALID_INPUT');
  });

  it('is deterministic and does not retain caller-owned command objects', () => {
    const state = createRosterState(rosterFixture());
    const request = command([{ playerId: 'p2', assignment: { unitId: 'a-farm-2', clubId: 'a' } }]);
    const first = applyRosterChange(state, request);
    expect(first).toEqual(applyRosterChange(state, request));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    (request.changes[0].assignment as { unitId: string }).unitId = 'corrupted';
    expect(first.state.players[1].assignment?.unitId).toBe('a-farm-2');
    expect(first.event.changes[0].after.assignment?.unitId).toBe('a-farm-2');
  });
});

describe('renderer-neutral roster participation gate', () => {
  it('accepts healthy active eligible assignment under the pinned edition policy', () => {
    const result = gate(createRosterState(rosterFixture()));
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.profile?.version).toBe('1');
    expect(result.scope).toBe('ROSTER_ONLY');
  });

  it.each(['INJURED', 'UNAVAILABLE'] as const)('does not make %s players healthy through a promotion', status => {
    const state = createRosterState(rosterFixture());
    const result = applyRosterChange(state, command([{ playerId: 'p1', availability: { status, evidenceId: 'health-event' } }]));
    expect(result.ok).toBe(true);
    expect(gate(result.state).reasons.map(r => r.code)).toContain('PLAYER_UNAVAILABLE');
    expect(result.state.players[0].registrations[0].status).toBe('ACTIVE');
  });

  it('permits rehab games only in a policy that allows them', () => {
    const state = createRosterState(rosterFixture());
    const result = applyRosterChange(state, command([
      { playerId: 'p1', availability: { status: 'REHAB', evidenceId: 'rehab-1' } },
      { playerId: 'p2', availability: { status: 'REHAB', evidenceId: 'rehab-2' } },
    ]));
    expect(gate(result.state).reasons.map(r => r.code)).toContain('REHAB_NOT_PERMITTED');
    expect(gate(result.state, 'p2', 'reserve-2026').eligible).toBe(true);
  });

  it('reports pending eligibility independently of active registration', () => {
    const state = createRosterState(rosterFixture());
    const result = applyRosterChange(state, command([{ playerId: 'p1', registrations: [{ ...active, eligibility: 'PENDING' }] }]));
    expect(gate(result.state).reasons.map(r => r.code)).toContain('REGISTRATION_NOT_ELIGIBLE');
  });

  it('never lets contract rights substitute for assignment or competition registration', () => {
    const state = createRosterState(rosterFixture());
    expect(gate(state, 'p2').eligible).toBe(false);
    expect(gate(state, 'p1', 'reserve-2026').eligible).toBe(false);
    expect(gate(state, 'p1', 'league-2026', 'b').eligible).toBe(false);
  });

  it('returns reasons for unknown references without throwing or falling back', () => {
    const state = createRosterState(rosterFixture());
    expect(gate(state, 'absent').reasons.map(r => r.code)).toContain('UNKNOWN_PLAYER');
    expect(gate(state, 'p1', 'absent').reasons.map(r => r.code)).toContain('UNKNOWN_COMPETITION');
  });

  it('lists assigned players separately from held rights, with no UI or hidden skills', () => {
    const input = rosterFixture();
    const state = createRosterState({ ...input, players: [input.players[0], { ...input.players[1], assignment: { unitId: 'b-farm', clubId: 'b' } }] });
    const a = getClubRoster(state, 'a');
    const b = getClubRoster(state, 'b');
    expect(a.rightsHeldPlayerIds).toEqual(['p1', 'p2']);
    expect(a.assignedPlayerIds).toEqual(['p1']);
    expect(b.assignedPlayerIds).toEqual(['p2']);
    expect(b.rightsHeldPlayerIds).toEqual([]);
    expect(a.revision).toBe(0);
  });
});