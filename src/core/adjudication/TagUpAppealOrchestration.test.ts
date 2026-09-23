import { describe, expect, it } from 'vitest';
import { asRuleProfileId } from '../model/RuleProfileRef';
import {
  createDefensiveAppealAttemptFact,
  createFlyBallFirstFielderTouchFact,
  createRunnerBaseDepartureFact,
  createRunnerBaseTouchFact,
} from '../rules/PhysicalRuleFacts';
import { NPB_2026_RULE_PROFILE, type RuleProfile } from '../rules/RuleProfile';
import {
  closeOfficialPlay,
  closeOfficialStateWindow,
  createPlayAdjudicationLedger,
  recordCorrectRuleSnapshot,
  recordOnFieldCall,
} from './PlayAdjudicationLedger';
import { advanceRuleProfileOfficialWindows, openRuleProfileOfficialStateWindow } from './OfficialWindowPolicy';
import { orchestrateTagUpAppealAttempt } from './TagUpAppealOrchestration';

const profile = NPB_2026_RULE_PROFILE;
const ruling = {
  outsAfter: 1,
  basesAfter: { first: 'r1', second: null, third: null },
  scoredRunnerIds: [] as string[],
};
const initial = (rules: RuleProfile = profile) => {
  let ledger = createPlayAdjudicationLedger({
    playId: 7, ruleProfileId: rules.id,
    playEnd: { kind: 'play_end', tick: 500, reason: 'live_action_complete' },
  });
  ledger = recordCorrectRuleSnapshot(ledger, 0, {
    eventId: 'rule-1', tick: 501, snapshotId: 'snapshot-1', evidenceRevision: 1, ruling,
  });
  return openRuleProfileOfficialStateWindow(ledger, 1, {
    profile: rules, eventId: 'open', tick: 502, windowId: 'appeal', windowKind: 'appeal',
  });
};
const evidence = () => ({
  runnerId: 'r1', originBase: 1 as const,
  firstTouch: createFlyBallFirstFielderTouchFact('left-fielder', 200),
  departure: createRunnerBaseDepartureFact('r1', 1, 190),
  retouch: null,
});
const attempt = (tick = 503) =>
  createDefensiveAppealAttemptFact('first-baseman', 'r1', 1, 'tag_up_early_departure', tick);

describe('tag-up appeal attempt orchestration', () => {
  it('records physical provenance, resolves through RuleEngine and fences closure until new evidence is ruled', () => {
    const { ledger, compliance, result } = orchestrateTagUpAppealAttempt(initial(), 2, {
      profile, eventId: 'attempt-1', windowId: 'appeal', attempt: attempt(), complianceEvidence: evidence(),
    });
    expect(compliance.kind).toBe('appealable_early_departure');
    expect(result).toMatchObject({ kind: 'out', runnerId: 'r1', appealedBase: 1, outTick: 503 });
    expect(ledger.events.at(-1)).toMatchObject({
      kind: 'DefensiveAppealAttemptRecorded', eventId: 'attempt-1', windowId: 'appeal',
      attempt: { defenderId: 'first-baseman', tick: 503 },
      complianceEvidence: { departure: { tick: 190 }, firstTouch: { tick: 200 } },
    });
    const closedWindow = closeOfficialStateWindow(ledger, 3, {
      eventId: 'resolve-window', tick: 504, windowId: 'appeal', reason: 'resolved',
    });
    expect(() => closeOfficialPlay(closedWindow, 4, {
      eventId: 'close', closureId: 'closure', tick: 505,
    })).toThrow('appeal attempt requires a newer correct-rule snapshot');
    const corrected = recordCorrectRuleSnapshot(closedWindow, 4, {
      eventId: 'rule-2', tick: 505, snapshotId: 'snapshot-2', evidenceRevision: 2,
      ruling: { ...ruling, outsAfter: 2, basesAfter: { first: null, second: null, third: null } },
    });
    expect(closeOfficialPlay(corrected, 5, {
      eventId: 'close', closureId: 'closure', tick: 506,
    }).revision).toBe(6);
  });

  it('does not infer an out without a violation or an actual attempt', () => {
    const compliant = { ...evidence(), departure: createRunnerBaseDepartureFact('r1', 1, 201) };
    expect(orchestrateTagUpAppealAttempt(initial(), 2, {
      profile, eventId: 'attempt-1', windowId: 'appeal', attempt: attempt(), complianceEvidence: compliant,
    }).result.kind).toBe('no_violation');
    expect(orchestrateTagUpAppealAttempt(initial(), 2, {
      profile, eventId: 'attempt-1', windowId: 'appeal', attempt: attempt(),
      complianceEvidence: { ...evidence(), retouch: createRunnerBaseTouchFact('r1', 1, 201) },
    }).result.kind).toBe('no_violation');
    expect(initial().events.some((event) => event.kind === 'DefensiveAppealAttemptRecorded')).toBe(false);
  });

  it('reports an attempt after the window closes as expired and records the attempt', () => {
    const closed = closeOfficialStateWindow(initial(), 2, {
      eventId: 'fence', tick: 503, windowId: 'appeal', reason: 'next_play_fence',
    });
    const { ledger, result } = orchestrateTagUpAppealAttempt(closed, 3, {
      profile, eventId: 'late-attempt', windowId: 'appeal', attempt: attempt(504), complianceEvidence: evidence(),
    });
    expect(result).toMatchObject({ kind: 'appeal_expired', windowClosedAtTick: 503 });
    expect(ledger.revision).toBe(4);
  });

  it('preserves NPB same-tick uncertainty at a closure fence', () => {
    const beforeFence = orchestrateTagUpAppealAttempt(initial(), 2, {
      profile, eventId: 'same-tick-attempt', windowId: 'appeal', attempt: attempt(), complianceEvidence: evidence(),
    });
    expect(() => advanceRuleProfileOfficialWindows(beforeFence.ledger, 3, {
      profile, boundary: 'next_play_fence', tick: 503, eventIdPrefix: 'fence', inningEnding: false,
    })).toThrow('same-tick appeal boundary is unresolved');
    const closed = closeOfficialStateWindow(initial(), 2, {
      eventId: 'fence', tick: 503, windowId: 'appeal', reason: 'next_play_fence',
    });
    const unresolved = orchestrateTagUpAppealAttempt(closed, 3, {
      profile, eventId: 'same-tick-attempt', windowId: 'appeal', attempt: attempt(), complianceEvidence: evidence(),
    });
    expect(unresolved.result.kind).toBe('simultaneous_unresolved');
    const corrected = recordCorrectRuleSnapshot(unresolved.ledger, 4, {
      eventId: 'rule-2', tick: 504, snapshotId: 'snapshot-2', evidenceRevision: 2, ruling,
    });
    expect(() => closeOfficialPlay(corrected, 5, {
      eventId: 'close', closureId: 'closure', tick: 505,
    })).toThrow('same-tick appeal requires an explicit on-field call');
    const called = recordOnFieldCall(corrected, 5, {
      eventId: 'call', tick: 505, callId: 'call-1',
      basisSnapshotId: 'snapshot-2', basisEvidenceRevision: 2, ruling,
    });
    expect(closeOfficialPlay(called, 6, {
      eventId: 'close', closureId: 'closure', tick: 506,
    }).revision).toBe(7);
  });

  it('uses an alternate profile to settle same-tick appeal timing', () => {
    for (const [sameTick, expected] of [
      ['appeal_wins', 'out'], ['window_close_wins', 'appeal_expired'],
    ] as const) {
      const alternate: RuleProfile = {
        ...profile, id: asRuleProfileId(`same-tick-${sameTick}`),
        appeal: { ...profile.appeal, sameTickWindowCloseResolution: sameTick },
      };
      const closed = closeOfficialStateWindow(initial(alternate), 2, {
        eventId: 'fence', tick: 503, windowId: 'appeal', reason: 'next_play_fence',
      });
      expect(orchestrateTagUpAppealAttempt(closed, 3, {
        profile: alternate, eventId: 'attempt-1', windowId: 'appeal',
        attempt: attempt(), complianceEvidence: evidence(),
      }).result.kind).toBe(expected);
    }
  });

  it('rejects missing or mismatched provenance before appending any event', () => {
    expect(() => orchestrateTagUpAppealAttempt(initial(), 2, {
      profile, eventId: 'attempt-1', windowId: 'missing', attempt: attempt(), complianceEvidence: evidence(),
    })).toThrow('appeal window does not exist');
    expect(() => orchestrateTagUpAppealAttempt(initial(), 2, {
      profile, eventId: 'attempt-1', windowId: 'appeal',
      attempt: createDefensiveAppealAttemptFact('fielder', 'r2', 1, 'tag_up_early_departure', 503),
      complianceEvidence: evidence(),
    })).toThrow('appeal must target the evaluated runner');
    expect(() => orchestrateTagUpAppealAttempt(initial(), 2, {
      profile: { ...profile, id: asRuleProfileId('other') }, eventId: 'attempt-1',
      windowId: 'appeal', attempt: attempt(), complianceEvidence: evidence(),
    })).toThrow('RuleProfile id must match adjudication ledger');
  });

  it('rejects malformed stored appeal evidence during replay', () => {
    const { ledger } = orchestrateTagUpAppealAttempt(initial(), 2, {
      profile, eventId: 'attempt-1', windowId: 'appeal', attempt: attempt(), complianceEvidence: evidence(),
    });
    const tampered = {
      ...ledger,
      events: ledger.events.map((event) => event.kind === 'DefensiveAppealAttemptRecorded'
        ? { ...event, attempt: { ...event.attempt, runnerId: 'r2' } } : event),
    };
    expect(() => closeOfficialStateWindow(tampered, 3, {
      eventId: 'resolve', tick: 504, windowId: 'appeal', reason: 'resolved',
    })).toThrow('appeal must target the evaluated runner');
  });

  it('rejects a persisted same-tick timing that contradicts the NPB profile', () => {
    const closed = closeOfficialStateWindow(initial(), 2, {
      eventId: 'fence', tick: 503, windowId: 'appeal', reason: 'next_play_fence',
    });
    const { ledger } = orchestrateTagUpAppealAttempt(closed, 3, {
      profile, eventId: 'attempt-1', windowId: 'appeal', attempt: attempt(), complianceEvidence: evidence(),
    });
    const tampered = {
      ...ledger,
      events: ledger.events.map((event) => event.kind === 'DefensiveAppealAttemptRecorded'
        ? { ...event, timing: 'timely' as const } : event),
    };
    expect(() => recordCorrectRuleSnapshot(tampered, 4, {
      eventId: 'rule-2', tick: 504, snapshotId: 'snapshot-2', evidenceRevision: 2, ruling,
    })).toThrow('NPB same-tick appeal must remain unresolved');
  });
});
