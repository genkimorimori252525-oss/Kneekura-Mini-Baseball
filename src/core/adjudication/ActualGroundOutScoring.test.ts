import { describe, expect, it } from 'vitest';
import type { BallWorldMoment } from '../sim/ball/BallWorldContinuation';
import { quantizeEventTick } from '../sim/ExactEventTime';
import { classifyActualGroundOutForOfficialScoring, type ActualGroundOutScoringInput } from './ActualGroundOutScoring';
import { actualGroundOutScoringFixture as fixture } from './ActualGroundOutScoring.test-support';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot,
  recordOnFieldCall, recordReviewDecision } from './PlayAdjudicationLedger';
import { classifyClosedPlayForOfficialScoring, type OfficialFairBallScoringEvidence } from './OfficialScoring';

// Core-only fixtures: contact, territory, race and ledger are processed by their
// real Core functions. Supplied physical histories/end and the assigned call do
// not establish Native ownership, completed producer coverage or a genuine game.
const originTick = 1_000_000, frequency = 1_000_000, horizon = 4;
const moment = (elapsedSeconds: number, x = 0, z = 60): BallWorldMoment => ({
  originTick, elapsedSeconds, ball: { tick: quantizeEventTick(originTick, elapsedSeconds, frequency),
    position: { x, y: 0.036, z }, velocity: { x: 0, y: 0, z: 1 }, spin: { x: 0, y: 0, z: 0 } },
});
const classify = (f: ReturnType<typeof fixture>, evidence = f.evidence) =>
  classifyClosedPlayForOfficialScoring({ kind: 'live_ball', match: f.match,
    timeline: f.timeline, adjudication: f.adjudication, groundOutEvidence: evidence });

describe('strict Core ground-out scoring', () => {
  it.each([0, 1, 2])('preserves the final assigned ruling for an empty-base OUT from %s outs', outs => {
    const f = fixture(outs), before = JSON.stringify(f);
    expect(classify(f)).toEqual({ kind: 'supported', record: {
      playId: 7, closureId: 'closure-1', basisRulingId: 'assigned-call', classification: 'ground_out',
      battingTeam: 'away', runsScored: 0, hitsCredited: 0, errorsCharged: 0,
    } });
    expect(classifyActualGroundOutForOfficialScoring({ match: f.match, timeline: f.timeline,
      adjudication: f.adjudication, evidence: f.evidence }).classification).toBe('ground_out');
    expect(JSON.stringify(f)).toBe(before);
  });

  it('keeps the existing fair-ball result unsupported when the sidecar is absent', () => {
    const f = fixture();
    expect(classifyClosedPlayForOfficialScoring({ kind: 'live_ball', match: f.match,
      timeline: f.timeline, adjudication: f.adjudication })).toMatchObject({ kind: 'unsupported' });
  });

  it.each([[1, 2], [2, 2], [null, null]] as const)(
    'rejects physical SAFE, exact ties and unresolved races even with an official OUT (%s/%s)', (runnerAt, controlAt) => {
      expect(() => classify(fixture(0, runnerAt, controlAt))).toThrow('ground-out scoring');
    });

  it('uses actual time to distinguish opposing orders within one recorded tick', () => {
    expect(classify(fixture(0, 2.0000002, 2.0000001))).toMatchObject({ kind: 'supported' });
    expect(() => classify(fixture(0, 2.0000001, 2.0000002))).toThrow('ground-out scoring');
  });

  it('rejects a final official SAFE despite physical OUT evidence', () => {
    const f = fixture();
    expect(() => classify({ ...f, adjudication: f.close({ outsAfter: 0,
      basesAfter: { first: 'batter', second: null, third: null }, scoredRunnerIds: [] }) }))
      .toThrow('ground-out scoring');
  });

  it('rejects a reviewed SAFE instead of replacing it with the original physical OUT', () => {
    const f = fixture(), out = { outsAfter: 1, basesAfter: f.match.bases, scoredRunnerIds: [] };
    let ledger = createPlayAdjudicationLedger({ playId: f.match.playId, ruleProfileId: f.match.ruleProfileId,
      playEnd: f.evidence.physical.playEnd });
    ledger = recordCorrectRuleSnapshot(ledger, 0, { eventId: 'rule', tick: 5_000_001,
      snapshotId: 'rule', evidenceRevision: 1, ruling: out });
    ledger = recordOnFieldCall(ledger, 1, { eventId: 'call', tick: 5_000_002,
      callId: 'call', basisSnapshotId: 'rule', basisEvidenceRevision: 1, ruling: out });
    ledger = recordReviewDecision(ledger, 2, { eventId: 'review', tick: 5_000_003,
      reviewId: 'review', callId: 'call', basisSnapshotId: 'rule', basisEvidenceRevision: 1,
      decision: 'overturned', replacementRuling: { outsAfter: 0,
        basesAfter: { first: 'batter', second: null, third: null }, scoredRunnerIds: [] } });
    ledger = closeOfficialPlay(ledger, 3, { eventId: 'close', closureId: 'closure-1', tick: 5_000_004 });
    expect(() => classify({ ...f, adjudication: ledger })).toThrow('ground-out scoring');
  });

  it.each(['prior_runner', 'post_runner', 'scored_runner', 'extra_out'] as const)(
    'rejects unsupported official population or outs: %s', kind => {
      const f = fixture();
      const changed = kind === 'prior_runner' ? { ...f, match: { ...f.match,
        bases: { first: 'prior', second: null, third: null } } }
        : { ...f, adjudication: f.close({ outsAfter: kind === 'extra_out' ? 2 : 1,
          basesAfter: { first: kind === 'post_runner' ? 'batter' : null, second: null, third: null },
          scoredRunnerIds: kind === 'scored_runner' ? ['batter'] : [] }) };
      expect(() => classify(changed)).toThrow();
    });

  it.each(['airborne', 'foul', 'later_unknown_surface'] as const)('rejects %s physical evidence', kind => {
    const f = fixture(), original = f.evidence.physical.field.evidence;
    const contacts = kind === 'airborne' ? original.contacts.slice(1)
      : kind === 'foul' ? original.contacts.map(frame => ({ ...frame,
        moment: { ...frame.moment, ball: { ...frame.moment.ball, position: { x: 90, y: 0.036, z: 60 } } } }))
        : [...original.contacts, { moment: moment(3.5), contacts: [{ kind: 'surface' as const, surfaceId: 'unknown-wall' }] }];
    expect(() => classify(f, { ...f.evidence, physical: { ...f.evidence.physical,
      field: { ...f.evidence.physical.field, evidence: { ...original, contacts } } } })).toThrow('ground-out scoring');
  });

  it('preserves possession uncertainty instead of granting an earlier possible control', () => {
    const f = fixture();
    const possessionEvidence = { policy: 'scheduled_capture_confirmation_v1' as const,
      originTick, ticksPerSecond: frequency, throughElapsedSeconds: horizon,
      pending: [{ planSourceId: 'pending-capture', playerId: 'defender', contactElapsedSeconds: 1.5,
        phase: 'fence_pending' as const, earliestPotentialControlElapsedSeconds: 2 }] };
    expect(() => classify(f, { ...f.evidence, possessionEvidence })).toThrow('ground-out scoring');
    expect(classify(f, { ...f.evidence, possessionEvidence: { ...possessionEvidence, pending: [] } }))
      .toMatchObject({ kind: 'supported' });
  });

  it('validates an optional playable-wall policy without assuming an unprovided surface response', () => {
    const f = fixture();
    const playableWalls = { policy: { version: 'grounded_fair_playable_wall_v1' as const,
      ruleProfileId: f.match.ruleProfileId, rulesRevision: '2026', surfaceIds: ['wall'] }, physicalContacts: [] };
    expect(classify(f, { ...f.evidence, playableWalls })).toMatchObject({ kind: 'supported' });
    expect(() => classify(f, { ...f.evidence, playableWalls: {
      ...playableWalls, policy: { ...playableWalls.policy, rulesRevision: 'unaccepted' },
    } })).toThrow();
  });

  it.each(['batter', 'play', 'clock', 'horizon', 'outs', 'end', 'timeline'] as const)(
    'rejects mismatched original %s scope', kind => {
      const f = fixture();
      const evidence: ActualGroundOutScoringInput = kind === 'batter' ? { ...f.evidence, race: { ...f.evidence.race, batterRunnerId: 'other' } }
        : kind === 'clock' ? { ...f.evidence, race: { ...f.evidence.race, originTick: originTick + 1 } }
          : kind === 'horizon' ? { ...f.evidence, race: { ...f.evidence.race, horizonElapsedSeconds: 5 } }
            : kind === 'outs' ? { ...f.evidence, race: { ...f.evidence.race, outsAtStart: 1 } }
              : kind === 'play' ? { ...f.evidence, physical: { ...f.evidence.physical,
                originalTimeline: { ...f.evidence.physical.originalTimeline, playId: 8 } } }
                : kind === 'end' ? { ...f.evidence, physical: { ...f.evidence.physical,
                  playEnd: { ...f.evidence.physical.playEnd, tick: 5_000_001 } } } : f.evidence;
      expect(() => classify(kind === 'timeline' ? { ...f, timeline: { ...f.timeline, startedAtTick: 1 } } : f, evidence)).toThrow();
    });

  it.each(['scorer', 'catch'] as const)('rejects a competing %s evidence format', competing => {
    const f = fixture();
    expect(() => classifyClosedPlayForOfficialScoring({ kind: 'live_ball', match: f.match,
      timeline: f.timeline, adjudication: f.adjudication, groundOutEvidence: f.evidence,
      ...(competing === 'catch' ? { fairCatchEvidence: f.evidence.physical }
        : { scoringEvidence: {} as OfficialFairBallScoringEvidence }) })).toThrow('competing');
  });
});
