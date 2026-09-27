import { describe, expect, it } from 'vitest';
import { state } from './ClubFixtures.test-support';
import { applyClubCommand } from './ClubLifecycle';
import { applyReceivedStructuralRevenue } from './ClubStructuralRevenue';
import type { StructuralRevenueClubHistory,
  StructuralRevenuePolicy,
  StructuralRevenueReceiptFact } from './ClubStructuralRevenue';

const policy = { policyId: 'recurring-1', version: 'v1',
  careerId: 'career-a', clubId: 'club-a', season: 1,
  availableAtDay: 10, currency: 'SIM',
  maximumSeasonAmount: 700,
  allowedCategories: ['broadcasting', 'commercial', 'merchandise'] as const };
const fact = { factId: 'receipt-fact-1', careerId: 'career-a',
  clubId: 'club-a', season: 1, category: 'commercial' as const,
  settlementRef: 'sponsor-contract-settlement-1',
  sourceEventId: 'settlement-event-1', receivedAtDay: 11,
  availableAtDay: 12, capacityRevisionAtReceipt: 0,
  amount: 400, currency: 'SIM' };
const apply = (club = state(), source: StructuralRevenueReceiptFact = fact,
  rules: StructuralRevenuePolicy = policy,
  history: StructuralRevenueClubHistory = {
    checkpoint: club, acceptedEvents: [],
  }) =>
  applyReceivedStructuralRevenue(club, source, rules, history);

describe('received structural revenue', () => {
  it('records only an actual settlement fact with policy and capacity provenance', () => {
    const original = state();
    expect(original.live.finance.cash).toBe(1000);
    expect(original.institutional.structuralRevenueCapacity).toBe(800);
    const applied = apply(original);
    expect(applied.state.live.finance.cash).toBe(1400);
    expect(applied.state.live.finance.revenue.commercial).toBe(400);
    expect(applied.state.live.finance.receipts[0]).toMatchObject({
      amount: 400, category: 'commercial', effectiveDay: 12,
      causeEventIds: ['settlement-event-1'],
    });
    expect(applied.basis).toMatchObject({ factId: 'receipt-fact-1',
      settlementRef: 'sponsor-contract-settlement-1',
      sourceEventId: 'settlement-event-1',
      capacityRevision: 0, capacityAtReceipt: 800,
      policyId: 'recurring-1', policyVersion: 'v1', amount: 400 });
  });

  it('prevents replay by receipt period or source event, even with a new fact ID', () => {
    const first = apply();
    expect(() => apply(first.state, fact, policy,
      { checkpoint: state(), acceptedEvents: [first.event] }))
      .toThrow('DUPLICATE_ID');
    expect(() => apply(first.state, { ...fact, factId: 'second-fact' },
      policy, { checkpoint: state(), acceptedEvents: [first.event] }))
      .toThrow('DUPLICATE_ID');
  });

  it('caps cumulative season receipts by policy and observed structural capacity', () => {
    const first = apply();
    const secondFact = { ...fact, factId: 'receipt-fact-2',
      settlementRef: 'sponsor-contract-settlement-2',
      sourceEventId: 'settlement-event-2', receivedAtDay: 13,
      availableAtDay: 13, capacityRevisionAtReceipt: 1,
      amount: 300 };
    const second = apply(first.state, secondFact, policy,
      { checkpoint: state(), acceptedEvents: [first.event] });
    expect(second.state.live.finance.revenue.commercial).toBe(700);
    expect(() => apply(second.state, { ...secondFact,
      factId: 'receipt-fact-3', settlementRef: 'settlement-3',
      sourceEventId: 'settlement-event-3',
      capacityRevisionAtReceipt: 2, amount: 1 }, policy,
      { checkpoint: state(), acceptedEvents: [first.event, second.event] }))
      .toThrow('season limit');
    expect(() => apply(state(), { ...fact, amount: 801 },
      { ...policy, maximumSeasonAmount: 900 })).toThrow('capacity');
  });

  it('uses the historical capacity and rejects unverifiable receipt timing', () => {
    const opening = state();
    const changed = applyClubCommand(opening, { eventId: 'structural-change',
      careerId: opening.careerId, clubId: opening.identity.clubId,
      expectedRevision: opening.revision, effectiveDay: 13,
      causeEventIds: ['commercial-loss'], operations: [{
        kind: 'UPDATE_STRUCTURAL_CAPITAL',
        capital: opening.institutional.capital,
        structuralRevenueCapacity: 200,
      }] });
    if (!changed.ok) throw new Error('fixture change failed');
    const history = { checkpoint: opening, acceptedEvents: [changed.event] };
    const delayed = applyReceivedStructuralRevenue(changed.state,
      fact, policy, history);
    expect(delayed.basis.capacityAtReceipt).toBe(800);
    expect(delayed.state.live.finance.cash).toBe(1400);
    expect(() => applyReceivedStructuralRevenue(changed.state,
      { ...fact, receivedAtDay: 14, availableAtDay: 14,
        capacityRevisionAtReceipt: 0 },
      policy, history)).toThrow('capacity revision');
    expect(() => applyReceivedStructuralRevenue(changed.state,
      fact, { ...policy, availableAtDay: 12 }, history))
      .toThrow('policy');
    expect(() => applyReceivedStructuralRevenue(changed.state,
      fact, policy, { checkpoint: changed.state, acceptedEvents: [] }))
      .toThrow('capacity revision');
  });

  it('rejects category, season, club, currency and non-settlement sources', () => {
    expect(() => apply(state(), { ...fact, category: 'matchday' as never }))
      .toThrow();
    expect(() => apply(state(), { ...fact, season: 2 })).toThrow();
    expect(() => apply(state(), { ...fact, clubId: 'other' })).toThrow();
    expect(() => apply(state(), { ...fact, currency: 'OTHER' })).toThrow();
    expect(() => apply(state(), { ...fact, settlementRef: '' })).toThrow();
  });
});
