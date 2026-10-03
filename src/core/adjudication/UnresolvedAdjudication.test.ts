import { describe, expect, it } from 'vitest';
import { asRuleProfileId } from '../model/RuleProfileRef';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import type { CanonicalPlateAppearanceTimeline } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { NPB_2026_RULE_PROFILE } from '../rules/RuleProfile';
import { openRuleProfileOfficialStateWindow } from './OfficialWindowPolicy';
import {
  closeOfficialPlay, closeOfficialStateWindow, createPlayAdjudicationLedger,
  deriveClosedLiveBallMatchState, getOfficialPlayClosure, getPlayAdjudicationState,
  recordCorrectRuleSnapshot, recordOnFieldCall, recordReviewDecision,
  recordUnresolvedCorrectRuleSnapshot,
  type OfficialGameplayRuling, type PlayAdjudicationLedger,
} from './index';

const ruleProfileId = asRuleProfileId('unresolved-test');
const playEnd = { kind: 'play_end' as const, tick: 500, reason: 'live_action_complete' as const };
const initial = () => createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd });
const unresolved = (evidenceRevision = 1, eventTick = 500) => ({
  eventId: `rule-event-${evidenceRevision}`, tick: eventTick,
  snapshotId: `rule-${evidenceRevision}`, evidenceRevision, reason: 'exact_simultaneity' as const,
});
const out: OfficialGameplayRuling = {
  outsAfter: 2, basesAfter: { first: null, second: null, third: null }, scoredRunnerIds: [],
};
const safe: OfficialGameplayRuling = {
  outsAfter: 1, basesAfter: { first: 'runner', second: null, third: null }, scoredRunnerIds: [],
};
const recordTruth = () => recordUnresolvedCorrectRuleSnapshot(initial(), 0, unresolved());
const call = (basisEvidenceRevision = 1) => ({
  eventId: `call-event-${basisEvidenceRevision}`, tick: 500, callId: `call-${basisEvidenceRevision}`,
  basisSnapshotId: `rule-${basisEvidenceRevision}`, basisEvidenceRevision, ruling: out,
});
const called = () => recordOnFieldCall(recordTruth(), 1, call());
const close = (ledger: PlayAdjudicationLedger) => closeOfficialPlay(ledger, ledger.revision, {
  eventId: 'close-event', closureId: 'closure', tick: 510,
});
const review = (decision: 'confirmed' | 'stands' | 'overturned', basisEvidenceRevision = 1) => ({
  eventId: `review-event-${basisEvidenceRevision}`, tick: 500,
  reviewId: `review-${basisEvidenceRevision}`, callId: 'call-1',
  basisSnapshotId: `rule-${basisEvidenceRevision}`, basisEvidenceRevision,
  decision, replacementRuling: decision === 'overturned' ? safe : null,
});
const evidenceSnapshot = (evidenceRevision = 1) => ({
  snapshotId: `rule-${evidenceRevision}`, evidenceRevision,
  resolution: 'unresolved' as const, reason: 'exact_simultaneity' as const,
});

const physicalTimeline = (): CanonicalPlateAppearanceTimeline => ({
  playId: 7, startedAtTick: 100, lastEventTick: 500, nextSequence: 1,
  status: { kind: 'live_ball_complete', count: { balls: 0, strikes: 0 }, contactTick: 200,
    playEndTick: 500, disposition: { kind: 'fair', fairDeterminationTick: 210 } },
  events: [{ kind: 'LiveBallPlayEnded', tick: 500, sequence: 0, payload: { playEnd } }],
});
const match = (): CanonicalMatchState => ({
  ruleProfileId, inning: 1, half: 'top', outs: 1, balls: 0, strikes: 0,
  bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 7,
});

describe('unresolved correct-rule evidence', () => {
  it('replays explicitly unresolved truth without inventing a gameplay ruling', () => {
    const ledger = { ...initial(), revision: 1, events: [{
      kind: 'UnresolvedCorrectRuleSnapshotRecorded', eventId: 'rule-event-1', tick: 500,
      snapshot: evidenceSnapshot(),
    }] } as PlayAdjudicationLedger;
    expect(getPlayAdjudicationState(ledger)).toEqual({
      kind: 'official_adjudication_open', playEnd, latestCorrectRule: evidenceSnapshot(),
      calls: [], reviews: [], openWindows: [],
    });
    expect(() => close(ledger)).toThrow('unresolved correct-rule evidence requires an explicit on-field call');
  });

  it('exports an additive recording API that leaves unresolved closure blocked', () => {
    expect(recordUnresolvedCorrectRuleSnapshot).toBeTypeOf('function');
    const ledger = recordTruth();
    expect(ledger.events).toEqual([{
      kind: 'UnresolvedCorrectRuleSnapshotRecorded', eventId: 'rule-event-1', tick: 500,
      snapshot: evidenceSnapshot(),
    }]);
    expect(() => close(ledger)).toThrow('unresolved correct-rule evidence requires an explicit on-field call');
    expect(getOfficialPlayClosure(ledger)).toBeNull();
  });

  it('admits insufficient-evidence truth with no supplied official ruling', () => {
    const ledger = recordUnresolvedCorrectRuleSnapshot(initial(), 0, {
      ...unresolved(), reason: 'insufficient_evidence',
    });
    expect(getPlayAdjudicationState(ledger)).toMatchObject({
      latestCorrectRule: { resolution: 'unresolved', reason: 'insufficient_evidence' },
    });
    expect(() => close(ledger)).toThrow('unresolved correct-rule evidence');
  });

  it('derives official state from a separately bound call while preserving the original truth and physical bytes', () => {
    const truth = recordTruth();
    const truthJson = JSON.stringify(truth);
    const beforeMatch = match();
    const timeline = physicalTimeline();
    const beforeJson = JSON.stringify({ beforeMatch, timeline });
    const ledger = close(recordOnFieldCall(truth, 1, call()));
    expect(getOfficialPlayClosure(ledger)?.finalRuling).toEqual({
      rulingId: 'call-1', source: 'on_field_call', basisEvidenceRevision: 1,
      basisSnapshotId: 'rule-1', basisCallId: 'call-1', basisReviewId: null, gameplay: out,
    });
    expect(ledger.events[0]).toEqual(truth.events[0]);
    expect(JSON.stringify(truth)).toBe(truthJson);
    expect(deriveClosedLiveBallMatchState(beforeMatch, timeline, ledger)).toMatchObject({
      playId: 8, outs: 2, bases: out.basesAfter,
    });
    expect(JSON.stringify({ beforeMatch, timeline })).toBe(beforeJson);
    expect(ledger.events.map(({ kind, tick }) => [kind, tick])).toEqual([
      ['UnresolvedCorrectRuleSnapshotRecorded', 500], ['OnFieldCallRecorded', 500], ['OfficialPlayClosed', 510],
    ]);
    expect(getOfficialPlayClosure(JSON.parse(JSON.stringify(ledger)))).toEqual(getOfficialPlayClosure(ledger));
  });

  it.each(['confirmed', 'stands', 'overturned'] as const)('preserves unresolved truth and original call when review is %s', (decision) => {
    const before = called();
    const beforeBytes = JSON.stringify(before.events);
    const ledger = close(recordReviewDecision(before, 2, review(decision)));
    expect(JSON.stringify(ledger.events.slice(0, 2))).toBe(beforeBytes);
    expect(getOfficialPlayClosure(ledger)?.finalRuling).toEqual({
      rulingId: 'review-1', source: 'review', basisEvidenceRevision: 1,
      basisSnapshotId: 'rule-1', basisCallId: 'call-1', basisReviewId: 'review-1',
      gameplay: decision === 'overturned' ? safe : out,
    });
    expect(ledger.events[2]).toMatchObject({ kind: 'ReviewDecisionRecorded',
      review: { decision, replacementRuling: decision === 'overturned' ? safe : null } });
  });

  it.each(['call', 'review'] as const)('stales an old %s when a newer unresolved snapshot arrives and accepts a fresh review basis', (previous) => {
    let ledger = called();
    if (previous === 'review') ledger = recordReviewDecision(ledger, ledger.revision, review('stands'));
    ledger = recordUnresolvedCorrectRuleSnapshot(ledger, ledger.revision, unresolved(2));
    expect(() => close(ledger)).toThrow('official ruling is stale');
    expect(() => recordOnFieldCall(ledger, ledger.revision, { ...call(), eventId: 'stale-call', callId: 'stale' }))
      .toThrow('on-field call must bind the latest correct-rule snapshot');
    expect(() => recordReviewDecision(ledger, ledger.revision, { ...review('stands'), eventId: 'stale-review', reviewId: 'stale' }))
      .toThrow('review must bind the latest correct-rule snapshot');
    ledger = recordReviewDecision(ledger, ledger.revision, review('stands', 2));
    expect(getOfficialPlayClosure(close(ledger))?.finalRuling).toMatchObject({
      source: 'review', basisSnapshotId: 'rule-2', basisEvidenceRevision: 2, gameplay: out,
    });
  });

  it('does not revive resolved fallback when newer unresolved truth supersedes a resolved snapshot', () => {
    const resolved = recordCorrectRuleSnapshot(initial(), 0, {
      eventId: 'old-rule-event', tick: 500, snapshotId: 'rule-0', evidenceRevision: 0, ruling: safe,
    });
    const ledger = recordUnresolvedCorrectRuleSnapshot(resolved, 1, unresolved());
    expect(() => close(ledger)).toThrow('unresolved correct-rule evidence');
    const resolvedAgain = recordCorrectRuleSnapshot(ledger, 2, {
      eventId: 'new-resolved', tick: 500, snapshotId: 'rule-2', evidenceRevision: 2, ruling: safe,
    });
    expect(getOfficialPlayClosure(close(resolvedAgain))?.finalRuling.source).toBe('correct_rule');
  });

  it('stales an unresolved-basis call when newer resolved evidence arrives', () => {
    const ledger = recordCorrectRuleSnapshot(called(), 2, {
      eventId: 'new-resolved', tick: 500, snapshotId: 'rule-2', evidenceRevision: 2, ruling: safe,
    });
    expect(() => close(ledger)).toThrow('official ruling is stale');
    const fresh = recordOnFieldCall(ledger, 3, call(2));
    expect(getOfficialPlayClosure(close(fresh))?.finalRuling).toMatchObject({
      source: 'on_field_call', basisSnapshotId: 'rule-2', gameplay: out,
    });
  });

  it.each(['appeal', 'review', 'challenge'] as const)('keeps an explicitly configured open %s window blocking closure', (windowKind) => {
    const profile = { ...NPB_2026_RULE_PROFILE, id: ruleProfileId,
      officialWindows: { appeal: { available: true }, review: { available: true }, challenge: { available: true } } };
    let ledger = openRuleProfileOfficialStateWindow(called(), 2, {
      profile, eventId: 'open', tick: 500, windowId: 'window', windowKind,
    });
    expect(() => close(ledger)).toThrow('official-state window remains open');
    ledger = closeOfficialStateWindow(ledger, 3, {
      eventId: 'close-window', tick: 500, windowId: 'window', reason: 'resolved',
    });
    expect(getOfficialPlayClosure(close(ledger))?.finalRuling.source).toBe('on_field_call');
  });

  it('does not enable review or challenge in the NPB profile', () => {
    const ledger = recordUnresolvedCorrectRuleSnapshot(createPlayAdjudicationLedger({
      playId: 7, ruleProfileId: NPB_2026_RULE_PROFILE.id, playEnd,
    }), 0, unresolved());
    for (const windowKind of ['review', 'challenge'] as const) {
      expect(() => openRuleProfileOfficialStateWindow(ledger, 1, {
        profile: NPB_2026_RULE_PROFILE, eventId: 'open', tick: 500, windowId: 'window', windowKind,
      })).toThrow('official-state window is not configured by RuleProfile');
    }
  });

  it('shares snapshot ID and evidence-revision uniqueness across both variants', () => {
    const ledger = recordTruth();
    expect(() => recordUnresolvedCorrectRuleSnapshot(ledger, 1, {
      ...unresolved(2), snapshotId: 'rule-1',
    })).toThrow('correct-rule snapshot ids must be unique');
    expect(() => recordCorrectRuleSnapshot(ledger, 1, {
      ...unresolved(2), snapshotId: 'rule-1', ruling: safe,
    })).toThrow('correct-rule snapshot ids must be unique');
    expect(() => recordUnresolvedCorrectRuleSnapshot(ledger, 1, {
      ...unresolved(2), evidenceRevision: 1,
    })).toThrow('correct-rule evidence revision must increase monotonically');
    expect(() => recordCorrectRuleSnapshot(ledger, 1, {
      ...unresolved(2), evidenceRevision: 1, ruling: safe,
    })).toThrow('correct-rule evidence revision must increase monotonically');
  });

  it('enforces existing revision, event identity, tick and closed-ledger fences', () => {
    const ledger = recordTruth();
    expect(() => recordUnresolvedCorrectRuleSnapshot(ledger, 0, unresolved(2))).toThrow('stale adjudication ledger revision');
    expect(() => recordUnresolvedCorrectRuleSnapshot(ledger, 1, { ...unresolved(2), eventId: 'rule-event-1' }))
      .toThrow('adjudication event ids must be unique');
    expect(() => recordUnresolvedCorrectRuleSnapshot(initial(), 0, unresolved(1, 499)))
      .toThrow('adjudication event ticks must be monotonic');
    expect(() => recordUnresolvedCorrectRuleSnapshot(close(called()), 3, unresolved(2, 511)))
      .toThrow('official play is already closed');
  });

  it('rejects a fabricated unresolved fallback closure during replay', () => {
    const ledger = recordTruth();
    expect(() => getOfficialPlayClosure({ ...ledger, revision: 2, events: [...ledger.events, {
      kind: 'OfficialPlayClosed', eventId: 'forged-close', tick: 510, closureId: 'forged',
      basisRulingId: 'rule-1', basisEvidenceRevision: 1,
    }] })).toThrow('unresolved correct-rule evidence requires an explicit on-field call');
  });

  it('rejects invalid unresolved reasons and a smuggled gameplay ruling at recording and replay', () => {
    for (const [extra, error] of [[{ reason: 'safe' }, 'unknown unresolved correct-rule reason'],
      [{ ruling: safe }, 'unresolved correct-rule snapshot must not supply a ruling']] as const) {
      expect(() => recordUnresolvedCorrectRuleSnapshot(initial(), 0, { ...unresolved(), ...extra } as any)).toThrow(error);
      expect(() => getPlayAdjudicationState({ ...initial(), revision: 1, events: [{
        kind: 'UnresolvedCorrectRuleSnapshotRecorded', eventId: 'rule-event-1', tick: 500,
        snapshot: { ...evidenceSnapshot(), ...extra },
      }] } as any)).toThrow(error);
    }
    expect(() => getPlayAdjudicationState({ ...initial(), revision: 1, events: [{
      kind: 'UnresolvedCorrectRuleSnapshotRecorded', eventId: 'rule-event-1', tick: 500,
      snapshot: { ...evidenceSnapshot(), resolution: 'resolved' },
    }] } as any)).toThrow('correct-rule resolution must be unresolved');
  });

  it('never executes active unresolved input or replay getters', () => {
    let accesses = 0;
    const request = { ...unresolved(), get reason() { accesses += 1; return 'exact_simultaneity'; } };
    expect(() => recordUnresolvedCorrectRuleSnapshot(initial(), 0, request as any)).toThrow('must not contain active properties');
    const snapshot = { ...evidenceSnapshot(), get reason() { accesses += 1; return 'exact_simultaneity'; } };
    expect(() => getPlayAdjudicationState({ ...initial(), revision: 1, events: [{
      kind: 'UnresolvedCorrectRuleSnapshotRecorded', eventId: 'rule-event-1', tick: 500, snapshot,
    }] } as any)).toThrow('must not contain active properties');
    expect(accesses).toBe(0);
  });

  it('keeps the existing resolved ledger, open state, and closure bytes unchanged', () => {
    const resolved = recordCorrectRuleSnapshot(initial(), 0, {
      eventId: 'resolved', tick: 500, snapshotId: 'resolved-rule', evidenceRevision: 1, ruling: safe,
    });
    const snapshot = { snapshotId: 'resolved-rule', evidenceRevision: 1, ruling: safe };
    expect(JSON.stringify(resolved)).toBe(JSON.stringify({ ...initial(), revision: 1,
      events: [{ kind: 'CorrectRuleSnapshotRecorded', eventId: 'resolved', tick: 500, snapshot }] }));
    expect(JSON.stringify(getPlayAdjudicationState(resolved))).toBe(JSON.stringify({
      kind: 'official_adjudication_open', playEnd, latestCorrectRule: snapshot, calls: [], reviews: [], openWindows: [],
    }));
    const finalRuling = { rulingId: 'resolved-rule', source: 'correct_rule', basisEvidenceRevision: 1,
      basisSnapshotId: 'resolved-rule', basisCallId: null, basisReviewId: null, gameplay: safe };
    expect(JSON.stringify(getOfficialPlayClosure(close(resolved)))).toBe(JSON.stringify({
      closureId: 'closure', playId: 7, closedAtTick: 510, playEnd, finalRuling,
      officialDelta: { ...safe, basisEvidenceRevision: 1, basisRulingId: 'resolved-rule' }, openWindows: [],
    }));
  });
});
