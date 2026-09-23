import { describe, expect, it } from 'vitest';
import { asRuleProfileId } from '../model/RuleProfileRef';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import {
  createCanonicalPlateAppearanceTimeline,
  recordCountedPitch,
  type CanonicalPlateAppearanceTimeline,
} from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  closeOfficialPlay,
  createPlayAdjudicationLedger,
  recordCorrectRuleSnapshot,
} from './PlayAdjudicationLedger';
import {
  activateNextNonLivePlateAppearance,
  confirmDurableClosedNonLiveStateApplication,
  deriveClosedNonLiveMatchState,
} from './NonLiveOfficialApplication';

const ruleProfileId = asRuleProfileId('test-rules');

const baseMatch = (overrides: Partial<CanonicalMatchState> = {}): CanonicalMatchState => ({
  ruleProfileId,
  inning: 4,
  half: 'top',
  outs: 1,
  balls: 0,
  strikes: 2,
  bases: { first: 'r1', second: null, third: 'r3' },
  score: { away: 2, home: 1 },
  playId: 12,
  ...overrides,
});

const strikeoutTimeline = (match: CanonicalMatchState): CanonicalPlateAppearanceTimeline =>
  recordCountedPitch(
    createCanonicalPlateAppearanceTimeline(match, 1000),
    1100,
    { kind: 'swinging_strike' },
  );

const walkTimeline = (match: CanonicalMatchState): CanonicalPlateAppearanceTimeline =>
  recordCountedPitch(
    createCanonicalPlateAppearanceTimeline(match, 2000),
    2100,
    { kind: 'ball' },
  );

const strikeoutLedger = (
  match: CanonicalMatchState,
  outsAfter = match.outs + 1,
) => {
  let ledger = createPlayAdjudicationLedger({
    playId: match.playId,
    ruleProfileId: match.ruleProfileId,
    playEnd: null,
  });
  ledger = recordCorrectRuleSnapshot(ledger, 0, {
    eventId: 'rule-strikeout',
    tick: 1101,
    snapshotId: 'rule-strikeout-1',
    evidenceRevision: 1,
    ruling: {
      outsAfter,
      basesAfter: match.bases,
      scoredRunnerIds: [],
    },
  });
  return closeOfficialPlay(ledger, 1, {
    eventId: 'close-strikeout',
    closureId: 'closure-strikeout',
    tick: 1102,
  });
};

const walkLedger = (match: CanonicalMatchState) => {
  let ledger = createPlayAdjudicationLedger({
    playId: match.playId,
    ruleProfileId: match.ruleProfileId,
    playEnd: null,
  });
  ledger = recordCorrectRuleSnapshot(ledger, 0, {
    eventId: 'rule-walk',
    tick: 2101,
    snapshotId: 'rule-walk-1',
    evidenceRevision: 1,
    ruling: {
      outsAfter: match.outs,
      basesAfter: { first: 'batter', second: 'r1', third: 'r2' },
      scoredRunnerIds: ['r3'],
    },
  });
  return closeOfficialPlay(ledger, 1, {
    eventId: 'close-walk',
    closureId: 'closure-walk',
    tick: 2102,
  });
};

describe('non-live official application', () => {
  it('carries a strikeout through closure, durable receipt and next plate appearance', () => {
    const before = baseMatch();
    const timeline = strikeoutTimeline(before);
    const adjudication = strikeoutLedger(before);

    const derived = deriveClosedNonLiveMatchState({
      match: before,
      timeline,
      adjudication,
      context: { kind: 'strikeout' },
    });
    expect(derived).toEqual({
      ...before,
      outs: 2,
      balls: 0,
      strikes: 0,
      playId: 13,
    });

    const receipt = confirmDurableClosedNonLiveStateApplication({
      match: before,
      timeline,
      adjudication,
      context: { kind: 'strikeout' },
      persistedMatchState: derived,
      applicationId: 'apply-strikeout',
      durableRevision: 22,
    });

    const activated = activateNextNonLivePlateAppearance({
      match: before,
      timeline,
      adjudication,
      context: { kind: 'strikeout' },
      application: receipt,
      nextStartedAtTick: 1103,
    });
    expect(activated.nextMatchState).toEqual(derived);
    expect(activated.nextTimeline).toMatchObject({
      playId: 13,
      startedAtTick: 1103,
      status: { kind: 'active', count: { balls: 0, strikes: 0 } },
    });
  });

  it('uses existing walk forced advancement and scoring under the same durable fence', () => {
    const before = baseMatch({
      half: 'bottom',
      outs: 2,
      balls: 3,
      strikes: 1,
      bases: { first: 'r1', second: 'r2', third: 'r3' },
    });
    const timeline = walkTimeline(before);
    const adjudication = walkLedger(before);
    const derived = deriveClosedNonLiveMatchState({
      match: before,
      timeline,
      adjudication,
      context: { kind: 'walk', batterRunnerId: 'batter' },
    });

    expect(derived).toMatchObject({
      outs: 2,
      bases: { first: 'batter', second: 'r1', third: 'r2' },
      score: { away: 2, home: 2 },
      playId: 13,
    });

    const receipt = confirmDurableClosedNonLiveStateApplication({
      match: before,
      timeline,
      adjudication,
      context: { kind: 'walk', batterRunnerId: 'batter' },
      persistedMatchState: derived,
      applicationId: 'apply-walk',
      durableRevision: 23,
    });
    expect(receipt.closureId).toBe('closure-walk');
  });

  it('rejects a closed ruling that disagrees with the existing strikeout rule path', () => {
    const before = baseMatch();
    expect(() => deriveClosedNonLiveMatchState({
      match: before,
      timeline: strikeoutTimeline(before),
      adjudication: strikeoutLedger(before, before.outs),
      context: { kind: 'strikeout' },
    })).toThrow('OfficialPlayClosure does not match the canonical non-live rule result');
  });

  it('rejects using a physical PlayEnd ledger as a non-live closure', () => {
    const before = baseMatch();
    const playEnd = { kind: 'play_end' as const, tick: 1100, reason: 'live_action_complete' as const };
    let adjudication = createPlayAdjudicationLedger({
      playId: before.playId,
      ruleProfileId: before.ruleProfileId,
      playEnd,
    });
    adjudication = recordCorrectRuleSnapshot(adjudication, 0, {
      eventId: 'rule-live',
      tick: 1101,
      snapshotId: 'rule-live-1',
      evidenceRevision: 1,
      ruling: {
        outsAfter: 2,
        basesAfter: before.bases,
        scoredRunnerIds: [],
      },
    });
    adjudication = closeOfficialPlay(adjudication, 1, {
      eventId: 'close-live',
      closureId: 'closure-live',
      tick: 1102,
    });

    expect(() => deriveClosedNonLiveMatchState({
      match: before,
      timeline: strikeoutTimeline(before),
      adjudication,
      context: { kind: 'strikeout' },
    })).toThrow('non-live official application requires playEnd: null');
  });

  it('rejects an OfficialPlayClosure that predates the terminal non-live timeline event', () => {
    const before = baseMatch();
    const terminalTimeline = strikeoutTimeline(before);
    let adjudication = createPlayAdjudicationLedger({
      playId: before.playId,
      ruleProfileId: before.ruleProfileId,
      playEnd: null,
    });
    adjudication = recordCorrectRuleSnapshot(adjudication, 0, {
      eventId: 'rule-early',
      tick: 10,
      snapshotId: 'rule-early-1',
      evidenceRevision: 1,
      ruling: {
        outsAfter: before.outs + 1,
        basesAfter: before.bases,
        scoredRunnerIds: [],
      },
    });
    adjudication = closeOfficialPlay(adjudication, 1, {
      eventId: 'close-early',
      closureId: 'closure-early',
      tick: 11,
    });

    expect(() => deriveClosedNonLiveMatchState({
      match: before,
      timeline: terminalTimeline,
      adjudication,
      context: { kind: 'strikeout' },
    })).toThrow('OfficialPlayClosure cannot precede the terminal non-live timeline event');
  });

  it('does not allow a walk context to reinterpret a strikeout timeline', () => {
    const before = baseMatch();
    expect(() => deriveClosedNonLiveMatchState({
      match: before,
      timeline: strikeoutTimeline(before),
      adjudication: strikeoutLedger(before),
      context: { kind: 'walk', batterRunnerId: 'batter' },
    })).toThrow('non-live application context must match the terminal timeline');
  });
});
