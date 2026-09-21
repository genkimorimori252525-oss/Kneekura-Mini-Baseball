import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { applyClubCommand, getClubFinanceSummary, getCurrentClubManager, replayClubEvents, restoreClubState } from './index';
import { closure, command, nextPlan, state, value } from './ClubFixtures.test-support';
import type { ClubOperation, ClubTransitionEvent, ClubWorldState } from './ClubTypes';
function change(operations: readonly ClubOperation[], s = state(), id = 'event-a', day = s.effectiveDay + 1) {
  const r = applyClubCommand(s, { ...command(operations, s, id), effectiveDay: day });
  assert.ok(r.ok, JSON.stringify(r)); return r;
}
function close(s = state()) { return change([closure()], s, 'close'); }
function open(s: ClubWorldState) { const plan = nextPlan(s); return change([{ kind: 'OPEN_SEASON', plan }], s, 'open', plan.startsOnDay); }

describe('club structural history, season lifecycle and replay', () => {
  it('renames without changing club identity, origin or seed metadata', () => {
    const s = state(); const r = change([{ kind: 'RENAME_CLUB', displayName: 'New Name', shortName: 'NN' }], s);
    assert.deepEqual(r.state.identity, s.identity); assert.deepEqual(r.state.initialSeed, s.initialSeed);
    assert.equal(r.state.institutional.brand.brandVersion, 1); assert.equal(r.state.institutional.brand.displayName, 'New Name');
    assert.equal(r.state.revision, 1); assert.equal(r.event.afterRevision, 1);
  });
  it('relocates only the current home, not historical origin or geometry', () => {
    const r = change([{ kind: 'RELOCATE_CLUB', homeCityId: 'city-new' }]);
    assert.equal(r.state.institutional.homeCityId, 'city-new');
    assert.equal(r.state.identity.historicalHomeCityId, 'city-origin');
    assert.equal(r.state.institutional.stadium.geometryRef, 'geometry-a');
  });
  it('owner changes can withdraw backing without creating or removing cash', () => {
    const r = change([{ kind: 'CHANGE_OWNER', owner: { ownerId: 'owner-b', modelRef: 'other-model' }, ownershipBackingCapacity: 0 }]);
    assert.equal(r.state.institutional.capital.ownershipBackingCapacity, 0);
    assert.deepEqual(r.state.live.finance, state().live.finance); assert.equal(r.state.initialSeed.targets.finance, 90);
  });
  it('records governance, facility and stadium changes without touching players', () => {
    const s = state(); const r = change([{ kind: 'REFORM_GOVERNANCE', governanceRef: 'reform-b' },
      { kind: 'UPDATE_FACILITIES', facilities: { ...s.institutional.facilities, academyQuality: 20 } },
      { kind: 'REPLACE_STADIUM', stadium: { ...s.institutional.stadium, stadiumId: 'stadium-b', geometryRef: 'geometry-b', quality: 80 } }]);
    assert.equal(r.state.institutional.governanceRef, 'reform-b'); assert.equal(r.state.institutional.facilities.academyQuality, 20);
    assert.equal(r.state.institutional.stadium.geometryRef, 'geometry-b');
    assert.deepEqual(r.state.live.references.playerClubStateRefs, s.live.references.playerClubStateRefs);
    assert.deepEqual(r.state.live.finance, s.live.finance);
  });
  it('accepts explicit caused structural changes, not an economic-band instruction', () => {
    const s = state(); const r = change([{ kind: 'UPDATE_STRUCTURAL_CAPITAL', capital: { ...s.institutional.capital,
      commercialNetworkCapital: 30 }, structuralRevenueCapacity: 400 }]);
    assert.equal(r.state.institutional.capital.commercialNetworkCapital, 30);
    assert.equal(r.state.institutional.structuralRevenueCapacity, 400); assert.equal(r.state.initialSeed.targets.finance, 90);
    assert.ok(!applyClubCommand(s, { ...command([]), operations: [{ kind: 'SET_ECONOMIC_BAND', band: 'LOW' }] }).ok);
  });
  it('preserves the original opening manager when the current appointment changes', () => {
    const s = state(); const refs = { ...s.live.references, staffRoleLinks: [{ roleId: 'manager-role', roleKind: 'MANAGER' as const,
      personId: 'manager-b', appointmentId: 'appointment-b' }] };
    const r = change([{ kind: 'UPDATE_REFERENCES', references: refs }], s, 'appointment-event');
    assert.deepEqual(value(getCurrentClubManager(r.state)), { managerId: 'manager-b', appointmentId: 'appointment-b' });
    assert.deepEqual(r.state.season.openingManager, { managerId: 'manager-a', appointmentId: 'appointment-a' });
    assert.deepEqual(r.state.live.managerAppointmentEventIds, ['appointment-event']);
    const c = close(r.state); const snapshot = c.event.historySnapshots[0]!;
    assert.deepEqual(snapshot.openingManager, r.state.season.openingManager);
    assert.deepEqual(snapshot.closingManager, value(getCurrentClubManager(r.state)));
    assert.deepEqual(snapshot.managerAppointmentEventIds, ['appointment-event']);
  });
  it('removes a manager appointment without silently using the opening manager as fallback', () => {
    const s = state(); const r = change([{ kind: 'UPDATE_REFERENCES', references: { ...s.live.references, staffRoleLinks: [] } }]);
    assert.equal(value(getCurrentClubManager(r.state)), null);
    assert.notEqual(r.state.season.openingManager, null);
  });
  it('rejects reassigning an existing appointment ID to a different person', () => {
    const s = state(); const refs = { ...s.live.references, staffRoleLinks: [{ ...s.live.references.staffRoleLinks[0]!, personId: 'other' }] };
    const r = applyClubCommand(s, command([{ kind: 'UPDATE_REFERENCES', references: refs }], s));
    assert.ok(!r.ok); assert.equal(r.reason.code, 'STATE_INCONSISTENT');
  });
  it('a standings or current-threat change does not overwrite historical rivalry or manager history', () => {
    const s = state(); const r = change([{ kind: 'UPDATE_REFERENCES', references: { ...s.live.references, standingsRef: 'bottom-finish', competitiveThreatRefs: [] } }]);
    assert.deepEqual(r.state.live.references.rivalryStateRefs, s.live.references.rivalryStateRefs);
    assert.deepEqual(r.state.institutional.capital, s.institutional.capital);
    assert.deepEqual(r.state.live.managerAppointmentEventIds, []);
  });
  it('closes the current period with historical evidence instead of replacing runtime state', () => {
    const s = state(); const r = close(s); const snapshot = r.event.historySnapshots[0]!;
    assert.equal(r.state.season.closureRef, 'season-summary-1');
    assert.equal(snapshot.season, 1); assert.equal(snapshot.finance.cash, 1000);
    assert.equal(snapshot.resultRefs.domesticResultRef, 'official-season-1');
    assert.deepEqual(snapshot.institutional, s.institutional); assert.ok(Object.isFrozen(snapshot.finance));
    assert.ok(!restoreClubState(snapshot).ok);
  });
  it('rejects duplicate closure and payments into an already closed period', () => {
    const s = close().state;
    for (const op of [closure(), { kind: 'DRAW_DEBT' as const, receiptId: 'draw', amount: 1, currency: 'SIM' }]) {
      const r = applyClubCommand(s, command([op], s)); assert.ok(!r.ok); assert.equal(r.reason.code, 'SEASON_CLOSED');
    }
  });
  it('requires closure before a new season can start', () => {
    const s = state(); const plan = nextPlan(s);
    const r = applyClubCommand(s, { ...command([{ kind: 'OPEN_SEASON', plan }], s), effectiveDay: plan.startsOnDay });
    assert.ok(!r.ok); assert.equal(r.reason.code, 'SEASON_NOT_CLOSED');
  });
  it('carries cash, debt, unpaid obligations and their already paid amounts to the next season', () => {
    const s = change([{ kind: 'RECORD_COMMITMENT', commitmentId: 'wage-a', contractRef: 'signed-a', category: 'playerWages', budgetBucket: 'payroll', amount: 300, currency: 'SIM' },
      { kind: 'SETTLE_COMMITMENT', commitmentId: 'wage-a', receiptId: 'payment-1', amount: 100, currency: 'SIM' },
      { kind: 'RECORD_REVENUE', category: 'commercial', receiptId: 'revenue-1', amount: 40, currency: 'SIM' }]).state;
    const c = close(s); const n = open(c.state); const f = n.state.live.finance;
    assert.equal(f.cash, 940); assert.equal(f.debt, 200); assert.equal(f.openingCash, 940);
    assert.equal(f.commitments[0]!.paidBeforeSeason, 100); assert.equal(f.commitments[0]!.paidThisSeason, 0);
    assert.equal(f.receipts.length, 0); assert.equal(f.revenue.commercial, 0);
    const q = value(getClubFinanceSummary(n.state)); assert.equal(q.outstandingCommitments, 200); assert.equal(q.budgetAllocated.payroll, 0);
    const paid = change([{ kind: 'SETTLE_COMMITMENT', commitmentId: 'wage-a', receiptId: 'payment-2', amount: 200, currency: 'SIM' }], n.state, 'pay-next');
    assert.equal(value(getClubFinanceSummary(paid.state)).outstandingCommitments, 0);
    assert.equal(value(getClubFinanceSummary(paid.state)).paidOperatingCosts, 200);
    assert.equal(c.event.historySnapshots[0]!.finance.revenue.commercial, 40);
  });
  it('retires fully settled obligations from current state but retains them in the closed history', () => {
    const s = change([{ kind: 'RECORD_COMMITMENT', commitmentId: 'c', contractRef: 'contract', category: 'staffWages', budgetBucket: 'coaching', amount: 10, currency: 'SIM' },
      { kind: 'SETTLE_COMMITMENT', commitmentId: 'c', receiptId: 'p', amount: 10, currency: 'SIM' }]).state;
    const c = close(s); const n = open(c.state);
    assert.equal(n.state.live.finance.commitments.length, 0);
    assert.equal(c.event.historySnapshots[0]!.finance.commitments.length, 1);
  });
  it('never reseeds or applies automatic decline at season rollover', () => {
    const s = change([{ kind: 'UPDATE_STRUCTURAL_CAPITAL', capital: { ...state().institutional.capital, academyKnowHow: 21 }, structuralRevenueCapacity: 300 }]).state;
    const n = open(close(s).state).state;
    assert.deepEqual(n.initialSeed, s.initialSeed); assert.deepEqual(n.identity, s.identity);
    assert.deepEqual(n.institutional, s.institutional); assert.equal(n.institutional.capital.academyKnowHow, 21);
    assert.equal(n.initialSeed.targets.development, 70);
  });
  it('rejects skipped seasons, a start before closure or a future start beyond the command day', () => {
    const s = close().state; const p = nextPlan(s);
    for (const plan of [{ ...p, season: p.season + 1, financialProfile: { ...p.financialProfile, season: p.season + 1 } },
      { ...p, startsOnDay: s.effectiveDay - 1 }]) {
      assert.ok(!applyClubCommand(s, { ...command([{ kind: 'OPEN_SEASON', plan }], s), effectiveDay: p.startsOnDay }).ok);
    }
    assert.ok(!applyClubCommand(s, command([{ kind: 'OPEN_SEASON', plan: p }], s)).ok);
  });
  it('rejects silently mutated regulation contents under the same pinned version', () => {
    const s = close().state; const p = nextPlan(s); const plan = { ...p, financialProfile: { ...p.financialProfile, hardPayrollCap: 123 } };
    const r = applyClubCommand(s, { ...command([{ kind: 'OPEN_SEASON', plan }], s), effectiveDay: p.startsOnDay });
    assert.ok(!r.ok); assert.equal(r.reason.code, 'PROFILE_VERSION_CONFLICT');
  });
  it('accepts a new regulation version only for the future season without changing the past snapshot', () => {
    const c = close(); const p = nextPlan(c.state); const plan = { ...p, financialProfile: { ...p.financialProfile, version: 'rules-v2', hardPayrollCap: 123 } };
    const n = change([{ kind: 'OPEN_SEASON', plan }], c.state, 'new-rules', p.startsOnDay);
    assert.equal(n.state.season.plan.financialProfile.version, 'rules-v2');
    assert.equal(c.event.historySnapshots[0]!.plan.financialProfile.version, 'rules-v1');
    assert.equal(c.event.historySnapshots[0]!.plan.financialProfile.hardPayrollCap, null);
  });
  it('rejects implicit currency conversion at rollover', () => {
    const c = close(); const p = nextPlan(c.state); const plan = { ...p, financialProfile: { ...p.financialProfile, version: 'rules-v2', currency: 'NEW' } };
    const r = applyClubCommand(c.state, { ...command([{ kind: 'OPEN_SEASON', plan }], c.state), effectiveDay: p.startsOnDay });
    assert.ok(!r.ok); assert.equal(r.reason.code, 'CURRENCY_MISMATCH');
  });
  it('protects state against wrong-club, wrong-career, stale and backdated commands', () => {
    const s = state(); const c = command([{ kind: 'RELOCATE_CLUB', homeCityId: 'new' }], s);
    for (const [patch, code] of [[{ clubId: 'wrong' }, 'WRONG_CLUB'], [{ careerId: 'wrong' }, 'WRONG_CLUB'],
      [{ expectedRevision: 5 }, 'STALE_REVISION'], [{ effectiveDay: 9 }, 'BACKDATED_COMMAND']] as const) {
      const r = applyClubCommand(s, { ...c, ...patch }); assert.ok(!r.ok); assert.equal(r.reason.code, code); assert.equal(r.state, s);
    }
  });
  it('requires causes and nonempty, dense operations without extra authority fields', () => {
    const s = state(); const c = command([{ kind: 'RELOCATE_CLUB', homeCityId: 'new' }], s);
    for (const patch of [{ causeEventIds: [] }, { operations: [] }, { operations: new Array(1) }, { identity: { clubId: 'new' } }]) {
      assert.ok(!applyClubCommand(s, { ...c, ...patch }).ok);
    }
  });
  it('returns NO_CHANGE for an identical rename or references update', () => {
    const s = state();
    for (const op of [{ kind: 'RENAME_CLUB' as const, displayName: 'Test Club', shortName: 'TC' },
      { kind: 'UPDATE_REFERENCES' as const, references: s.live.references }]) {
      const r = applyClubCommand(s, command([op], s)); assert.ok(!r.ok); assert.equal(r.reason.code, 'NO_CHANGE');
    }
  });
  it('does not expose a partial season snapshot if a later command operation fails', () => {
    const s = state(); const r = applyClubCommand(s, command([closure(), { kind: 'DRAW_DEBT', receiptId: 'draw', amount: 1, currency: 'SIM' }], s));
    assert.ok(!r.ok); assert.equal(r.state, s); assert.ok(!('event' in r)); assert.equal(s.season.closureRef, null);
  });
  it('replays accepted events from a JSON checkpoint without external catalogs', () => {
    const initial = state(); const a = change([{ kind: 'RENAME_CLUB', displayName: 'One', shortName: 'O' }], initial, 'e1');
    const b = change([{ kind: 'DRAW_DEBT', receiptId: 'draw', amount: 50, currency: 'SIM' }], a.state, 'e2');
    const c = close(b.state); const n = open(c.state);
    const events = JSON.parse(JSON.stringify([a.event, b.event, c.event, n.event]));
    assert.deepEqual(value(replayClubEvents(value(restoreClubState(JSON.parse(JSON.stringify(initial)))), events)), n.state);
  });
  it('rejects out-of-order or tampered events and never returns partially replayed state', () => {
    const initial = state(); const a = change([{ kind: 'RENAME_CLUB', displayName: 'One', shortName: 'O' }], initial, 'e1');
    const b = change([{ kind: 'DRAW_DEBT', receiptId: 'draw', amount: 50, currency: 'SIM' }], a.state, 'e2');
    assert.ok(!replayClubEvents(initial, [b.event, a.event]).ok);
    assert.ok(!replayClubEvents(initial, [a.event, { ...b.event, afterRevision: 999 }]).ok);
    const bad: ClubTransitionEvent = { ...close(a.state).event, historySnapshots: [] };
    assert.ok(!replayClubEvents(initial, [a.event, bad]).ok);
    assert.ok(!replayClubEvents(initial, new Array(1)).ok);
    assert.equal(initial.revision, 0);
  });
  it('allows empty replay while still validating and detaching the checkpoint', () => {
    const s = state(); const copy = value(replayClubEvents(s, [])); assert.deepEqual(copy, s); assert.notEqual(copy, s);
  });
  it('preserves opaque IDs containing delimiters and rejects revision overflow', () => {
    const s = state(); const refs = { ...s.live.references, competitiveThreatRefs: ['a|b', 'c'] };
    const a = change([{ kind: 'UPDATE_REFERENCES', references: refs }], s);
    const b = change([{ kind: 'UPDATE_REFERENCES', references: { ...refs, competitiveThreatRefs: ['a', 'b|c'] } }], a.state);
    assert.deepEqual(b.state.live.references.competitiveThreatRefs, ['a', 'b|c']);
    const max = value(restoreClubState({ ...s, revision: Number.MAX_SAFE_INTEGER }));
    const r = applyClubCommand(max, command([{ kind: 'RELOCATE_CLUB', homeCityId: 'next' }], max));
    assert.ok(!r.ok); assert.equal(r.reason.code, 'OVERFLOW');
  });
});

describe('inline review regressions', () => {
  it('retains structural provenance for decline and repair within one atomic batch even when net state is unchanged', () => {
    const s = state(); const r = applyClubCommand(s, command([
      { kind: 'UPDATE_FACILITIES', facilities: { ...s.institutional.facilities, academyQuality: 10 } },
      { kind: 'UPDATE_FACILITIES', facilities: s.institutional.facilities },
    ], s));
    assert.ok(r.ok); assert.equal(r.state.revision, 1); assert.equal(r.event.command.operations.length, 2);
    assert.deepEqual(r.state.institutional, s.institutional);
  });
  it('rejects receipt ordering that requires negative cash before a later borrowing receipt', () => {
    const r = change([{ kind: 'DRAW_DEBT', receiptId: 'draw', amount: 1000, currency: 'SIM' },
      { kind: 'RECORD_COMMITMENT', commitmentId: 'w', contractRef: 'signed', category: 'playerWages', budgetBucket: 'payroll', amount: 1500, currency: 'SIM' },
      { kind: 'SETTLE_COMMITMENT', commitmentId: 'w', receiptId: 'pay', amount: 1500, currency: 'SIM' }]);
    const copy = JSON.parse(JSON.stringify(r.state)); copy.live.finance.receipts.reverse();
    assert.ok(!restoreClubState(copy).ok);
  });
  it('rejects chronological inversion of period receipts even if final totals still reconcile', () => {
    const a = change([{ kind: 'DRAW_DEBT', receiptId: 'a', amount: 1, currency: 'SIM' }]);
    const b = change([{ kind: 'DRAW_DEBT', receiptId: 'b', amount: 1, currency: 'SIM' }], a.state, 'second');
    const copy = JSON.parse(JSON.stringify(b.state)); copy.live.finance.receipts.reverse();
    assert.ok(!restoreClubState(copy).ok);
  });
  it('does not invoke accessor properties supplied instead of serialized data', () => {
    let invoked = false; const s = state(); const input = { ...s };
    Object.defineProperty(input, 'careerId', { enumerable: true, get() { invoked = true; return 'career-a'; } });
    assert.ok(!restoreClubState(input).ok); assert.equal(invoked, false);
    const operations: unknown[] = []; operations.length = 1;
    Object.defineProperty(operations, 0, { enumerable: true, get() { invoked = true; return closure(); } });
    assert.ok(!applyClubCommand(s, { ...command([]), operations }).ok); assert.equal(invoked, false);
  });
  it('rejects unexpected symbol fields and inherited non-record data', () => {
    assert.ok(!restoreClubState({ ...state(), [Symbol('hidden')]: 1 }).ok);
    assert.ok(!restoreClubState(new Date()).ok);
    for (const input of [null, undefined, 'bad', 1, []]) assert.ok(!restoreClubState(input).ok);
  });
  it('keeps historical snapshots detached through later institutional changes', () => {
    const c = close(); const snapshot = c.event.historySnapshots[0]!;
    const r = change([{ kind: 'CHANGE_OWNER', owner: { ownerId: null, modelRef: 'member-owned' }, ownershipBackingCapacity: 0 }], c.state, 'owner-event');
    assert.equal(snapshot.institutional.owner.ownerId, 'owner-a'); assert.equal(r.state.institutional.owner.ownerId, null);
    assert.deepEqual(snapshot.finance, r.state.live.finance);
  });
  it('permits close and next season open atomically at an explicitly chosen boundary', () => {
    const s = state(); const p = nextPlan(s);
    const r = change([closure(), { kind: 'OPEN_SEASON', plan: p }], s, 'boundary', p.startsOnDay);
    assert.equal(r.state.season.plan.season, 2); assert.equal(r.state.season.closureRef, null);
    assert.equal(r.event.historySnapshots.length, 1); assert.equal(r.event.historySnapshots[0]!.season, 1);
  });
  it('tracks two manager changes in one command without duplicating the event reference', () => {
    const s = state(); const refs = s.live.references;
    const r = change([{ kind: 'UPDATE_REFERENCES', references: { ...refs, staffRoleLinks: [] } },
      { kind: 'UPDATE_REFERENCES', references: { ...refs, staffRoleLinks: [{ roleId: 'm', roleKind: 'MANAGER', personId: 'manager-b', appointmentId: 'b' }] } }]);
    assert.deepEqual(r.state.live.managerAppointmentEventIds, ['event-a']);
    assert.deepEqual(value(getCurrentClubManager(r.state)), { managerId: 'manager-b', appointmentId: 'b' });
  });
  it('does not silently convert positive operating cost into principal debt movement', () => {
    const r = change([{ kind: 'RECORD_COMMITMENT', commitmentId: 'interest', contractRef: 'loan-interest', category: 'debtService', budgetBucket: 'facilities', amount: 10, currency: 'SIM' },
      { kind: 'SETTLE_COMMITMENT', commitmentId: 'interest', receiptId: 'interest-paid', amount: 10, currency: 'SIM' }]);
    assert.equal(r.state.live.finance.debt, 200); assert.equal(value(getClubFinanceSummary(r.state)).paidOperatingCosts, 10);
  });
  it('rejects mutation of a replayed historical closing balance', () => {
    const c = close(); const event = JSON.parse(JSON.stringify(c.event)); event.historySnapshots[0].finance.cash += 1;
    const r = replayClubEvents(state(), [event]); assert.ok(!r.ok); assert.equal(r.reason.code, 'EVENT_MISMATCH');
  });
});

describe('long-save regression', () => {
  it('carries one obligation through 300 seasons and replays a mid-career checkpoint without reseeding', () => {
    const initial = state(); const events: ClubTransitionEvent[] = [];
    const first = change([{ kind: 'RECORD_COMMITMENT', commitmentId: 'long-obligation', contractRef: 'signed-long',
      category: 'stadiumOperations', budgetBucket: 'facilities', amount: 500, currency: 'SIM' }], initial, 'contract-created');
    let current = first.state; let checkpoint = current; let checkpointOffset = 0;
    for (let season = 1; season <= 300; season += 1) {
      const paid = change([{ kind: 'RECORD_REVENUE', receiptId: 'revenue-' + season, category: 'commercial', amount: 2, currency: 'SIM' },
        { kind: 'SETTLE_COMMITMENT', receiptId: 'payment-' + season, commitmentId: 'long-obligation', amount: 1, currency: 'SIM' }], current, 'payment-event-' + season);
      events.push(paid.event); current = paid.state;
      const closed = change([{ ...closure(), snapshotId: 'history-' + season }], current, 'close-' + season);
      events.push(closed.event); current = closed.state;
      if (season < 300) {
        const plan = nextPlan(current); const opened = change([{ kind: 'OPEN_SEASON', plan }], current, 'open-' + (season + 1), plan.startsOnDay);
        events.push(opened.event); current = opened.state;
      }
      if (season === 150) { checkpoint = value(restoreClubState(JSON.parse(JSON.stringify(current)))); checkpointOffset = events.length; }
    }
    assert.equal(current.season.plan.season, 300); assert.equal(current.live.finance.cash, 1300);
    assert.equal(value(getClubFinanceSummary(current)).outstandingCommitments, 200);
    assert.equal(current.live.finance.commitments[0]!.paidBeforeSeason, 299);
    assert.deepEqual(current.initialSeed, initial.initialSeed); assert.deepEqual(current.institutional, initial.institutional);
    assert.equal(events.filter(e => e.historySnapshots.length > 0).length, 300);
    assert.deepEqual(value(replayClubEvents(checkpoint, events.slice(checkpointOffset))), current);
  });
});
