import { describe, expect, it } from 'vitest';
import { asRuleProfileId } from '../model/RuleProfileRef';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import type { CanonicalPlateAppearanceTimeline } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  closeOfficialPlay,
  closeOfficialStateWindow,
  createPlayAdjudicationLedger,
  deriveClosedLiveBallMatchState,
  getOfficialPlayClosure,
  getPlayAdjudicationState,
  openOfficialStateWindow,
  recordCorrectRuleSnapshot,
  recordOnFieldCall,
  recordReviewDecision,
} from './PlayAdjudicationLedger';

const ruleProfileId = asRuleProfileId('test-rules');

const playEnd = {
  kind: 'play_end' as const,
  tick: 500,
  reason: 'live_action_complete' as const,
};

const match = (): CanonicalMatchState => ({
  ruleProfileId,
  inning: 1,
  half: 'top',
  outs: 1,
  balls: 0,
  strikes: 0,
  bases: { first: 'r1', second: null, third: null },
  score: { away: 0, home: 0 },
  playId: 7,
});

const timeline = (): CanonicalPlateAppearanceTimeline => ({
  playId: 7,
  startedAtTick: 100,
  lastEventTick: 500,
  nextSequence: 2,
  status: {
    kind: 'live_ball_complete',
    count: { balls: 0, strikes: 0 },
    contactTick: 200,
    playEndTick: 500,
    disposition: { kind: 'fair', fairDeterminationTick: 210 },
  },
  events: [{
    tick: 200,
    sequence: 0,
    kind: 'BatBallContact',
    payload: {
      countBefore: { balls: 0, strikes: 0 },
      contact: {
        kind: 'contact',
        tick: 200,
        ballPosition: { x: 0, y: 1, z: 0 },
        ballVelocity: { x: 0, y: 0, z: 1 },
        batPosition: { x: 0, y: 1, z: 0 },
        batVelocity: { x: 1, y: 0, z: 0 },
      } as any,
    },
  }, {
    tick: 500,
    sequence: 1,
    kind: 'LiveBallPlayEnded',
    payload: { playEnd },
  }],
});

const correct = (
  evidenceRevision: number,
  snapshotId = `rule-${evidenceRevision}`,
) => ({
  eventId: `event-rule-${evidenceRevision}`,
  tick: 500 + evidenceRevision,
  snapshotId,
  evidenceRevision,
  ruling: {
    outsAfter: 2,
    basesAfter: { first: null, second: 'r1', third: null },
    scoredRunnerIds: [] as string[],
  },
});

describe('PlayAdjudicationLedger lifecycle', () => {
  it('keeps physical PlayEnd separate from official closure', () => {
    const ledger = createPlayAdjudicationLedger({
      playId: 7,
      ruleProfileId,
      playEnd,
    });
    expect(getPlayAdjudicationState(ledger)).toEqual({
      kind: 'physical_play_ended',
      playEnd,
    });
    expect(() => deriveClosedLiveBallMatchState(match(), timeline(), ledger)).toThrow();
  });

  it('opens official adjudication only after a correct-rule snapshot is recorded', () => {
    const initial = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd });
    const ledger = recordCorrectRuleSnapshot(initial, 0, correct(1));
    const state = getPlayAdjudicationState(ledger);
    expect(state.kind).toBe('official_adjudication_open');
    if (state.kind !== 'official_adjudication_open') return;
    expect(state.latestCorrectRule.snapshotId).toBe('rule-1');
    expect(state.openWindows).toEqual([]);
    expect(ledger.revision).toBe(1);
  });

  it('blocks OfficialPlayClosure while an appeal/review window remains open', () => {
    let ledger = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd });
    ledger = recordCorrectRuleSnapshot(ledger, 0, correct(1));
    ledger = openOfficialStateWindow(ledger, 1, {
      eventId: 'open-appeal',
      tick: 502,
      windowId: 'appeal-1',
      windowKind: 'appeal',
    });
    expect(() => closeOfficialPlay(ledger, 2, {
      eventId: 'close-play',
      closureId: 'closure-1',
      tick: 503,
    })).toThrow('official-state window remains open');

    ledger = closeOfficialStateWindow(ledger, 2, {
      eventId: 'close-appeal',
      tick: 503,
      windowId: 'appeal-1',
      reason: 'resolved',
    });
    ledger = closeOfficialPlay(ledger, 3, {
      eventId: 'close-play',
      closureId: 'closure-1',
      tick: 504,
    });
    expect(getPlayAdjudicationState(ledger).kind).toBe('official_closed');
  });

  it('derives the durable MatchState only from a closure-derived identity ruling', () => {
    let ledger = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd });
    ledger = recordCorrectRuleSnapshot(ledger, 0, correct(1));
    ledger = closeOfficialPlay(ledger, 1, {
      eventId: 'close-play',
      closureId: 'closure-1',
      tick: 502,
    });

    const closure = getOfficialPlayClosure(ledger);
    expect(closure?.finalRuling.source).toBe('correct_rule');
    expect(closure?.officialDelta).toMatchObject({
      outsAfter: 2,
      basesAfter: { first: null, second: 'r1', third: null },
      scoredRunnerIds: [],
      basisEvidenceRevision: 1,
    });

    const next = deriveClosedLiveBallMatchState(match(), timeline(), ledger);
    expect(next).toMatchObject({
      outs: 2,
      balls: 0,
      strikes: 0,
      bases: { first: null, second: 'r1', third: null },
      score: { away: 0, home: 0 },
      playId: 8,
    });
  });

  it('allows an on-field call to differ from correct physical/rule truth without rewriting it', () => {
    let ledger = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd });
    ledger = recordCorrectRuleSnapshot(ledger, 0, correct(1));
    ledger = recordOnFieldCall(ledger, 1, {
      eventId: 'call-event',
      tick: 502,
      callId: 'call-1',
      basisSnapshotId: 'rule-1',
      basisEvidenceRevision: 1,
      ruling: {
        outsAfter: 3,
        basesAfter: { first: null, second: null, third: null },
        scoredRunnerIds: [],
      },
    });
    ledger = closeOfficialPlay(ledger, 2, {
      eventId: 'close-play',
      closureId: 'closure-1',
      tick: 503,
    });

    const closure = getOfficialPlayClosure(ledger)!;
    expect(closure.finalRuling.source).toBe('on_field_call');
    expect(closure.officialDelta.outsAfter).toBe(3);
    expect(getPlayAdjudicationState(ledger).kind).toBe('official_closed');
  });

  it('lets review overturn an on-field call while preserving the call in append-only history', () => {
    let ledger = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd });
    ledger = recordCorrectRuleSnapshot(ledger, 0, correct(1));
    ledger = recordOnFieldCall(ledger, 1, {
      eventId: 'call-event',
      tick: 502,
      callId: 'call-1',
      basisSnapshotId: 'rule-1',
      basisEvidenceRevision: 1,
      ruling: {
        outsAfter: 3,
        basesAfter: { first: null, second: null, third: null },
        scoredRunnerIds: [],
      },
    });
    ledger = recordReviewDecision(ledger, 2, {
      eventId: 'review-event',
      tick: 503,
      reviewId: 'review-1',
      callId: 'call-1',
      basisSnapshotId: 'rule-1',
      basisEvidenceRevision: 1,
      decision: 'overturned',
      replacementRuling: {
        outsAfter: 2,
        basesAfter: { first: null, second: 'r1', third: null },
        scoredRunnerIds: [],
      },
    });
    ledger = closeOfficialPlay(ledger, 3, {
      eventId: 'close-play',
      closureId: 'closure-1',
      tick: 504,
    });

    const closure = getOfficialPlayClosure(ledger)!;
    expect(closure.finalRuling.source).toBe('review');
    expect(closure.finalRuling.basisCallId).toBe('call-1');
    expect(closure.officialDelta.outsAfter).toBe(2);
    expect(ledger.events.some((event) => event.kind === 'OnFieldCallRecorded')).toBe(true);
    expect(ledger.events.some((event) => event.kind === 'ReviewDecisionRecorded')).toBe(true);
  });

  it('requires a fresh official ruling when newer correct-rule evidence supersedes a call', () => {
    let ledger = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd });
    ledger = recordCorrectRuleSnapshot(ledger, 0, correct(1));
    ledger = recordOnFieldCall(ledger, 1, {
      eventId: 'call-event',
      tick: 502,
      callId: 'call-1',
      basisSnapshotId: 'rule-1',
      basisEvidenceRevision: 1,
      ruling: {
        outsAfter: 3,
        basesAfter: { first: null, second: null, third: null },
        scoredRunnerIds: [],
      },
    });
    ledger = recordCorrectRuleSnapshot(ledger, 2, {
      ...correct(2),
      tick: 503,
      ruling: {
        outsAfter: 2,
        basesAfter: { first: null, second: null, third: 'r1' },
        scoredRunnerIds: [],
      },
    });

    expect(() => closeOfficialPlay(ledger, 3, {
      eventId: 'close-play',
      closureId: 'closure-1',
      tick: 504,
    })).toThrow('official ruling is stale');

    ledger = recordReviewDecision(ledger, 3, {
      eventId: 'review-event',
      tick: 504,
      reviewId: 'review-1',
      callId: 'call-1',
      basisSnapshotId: 'rule-2',
      basisEvidenceRevision: 2,
      decision: 'overturned',
      replacementRuling: {
        outsAfter: 2,
        basesAfter: { first: null, second: null, third: 'r1' },
        scoredRunnerIds: [],
      },
    });
    ledger = closeOfficialPlay(ledger, 4, {
      eventId: 'close-play',
      closureId: 'closure-1',
      tick: 505,
    });
    expect(getOfficialPlayClosure(ledger)?.officialDelta.basesAfter.third).toBe('r1');
  });

  it('rejects stale ledger revisions, duplicate event ids and any append after official closure', () => {
    let ledger = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd });
    ledger = recordCorrectRuleSnapshot(ledger, 0, correct(1));
    expect(() => recordCorrectRuleSnapshot(ledger, 0, correct(2))).toThrow('stale adjudication ledger revision');
    expect(() => openOfficialStateWindow(ledger, 1, {
      eventId: 'event-rule-1',
      tick: 502,
      windowId: 'appeal',
      windowKind: 'appeal',
    })).toThrow('adjudication event ids must be unique');

    ledger = closeOfficialPlay(ledger, 1, {
      eventId: 'close-play',
      closureId: 'closure-1',
      tick: 502,
    });
    expect(() => openOfficialStateWindow(ledger, 2, {
      eventId: 'late-event',
      tick: 503,
      windowId: 'late-window',
      windowKind: 'review',
    })).toThrow('official play is already closed');
  });

  it('rejects invalid official gameplay ledgers before closure', () => {
    let ledger = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd });
    expect(() => recordCorrectRuleSnapshot(ledger, 0, {
      ...correct(1),
      ruling: {
        outsAfter: 2,
        basesAfter: { first: 'r1', second: 'r1', third: null },
        scoredRunnerIds: [],
      },
    })).toThrow();
    expect(() => recordCorrectRuleSnapshot(ledger, 0, {
      ...correct(1),
      ruling: {
        outsAfter: 2,
        basesAfter: { first: 'r1', second: null, third: null },
        scoredRunnerIds: ['r1'],
      },
    })).toThrow();
  });
});
