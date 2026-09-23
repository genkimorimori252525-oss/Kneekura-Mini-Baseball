import { describe, expect, it } from 'vitest';
import { asRuleProfileId } from '../model/RuleProfileRef';
import { NPB_2026_RULE_PROFILE, type RuleProfile } from '../rules/RuleProfile';
import {
  closeOfficialPlay,
  closeOfficialStateWindow,
  createPlayAdjudicationLedger,
  getOfficialStateWindows,
  recordCorrectRuleSnapshot,
} from './PlayAdjudicationLedger';
import {
  advanceRuleProfileOfficialWindows,
  evaluateRuleProfileOfficialWindowTiming,
  openRuleProfileOfficialStateWindow,
} from './OfficialWindowPolicy';

const profile = NPB_2026_RULE_PROFILE;
const initial = (rules: RuleProfile = profile) => {
  let ledger = createPlayAdjudicationLedger({
    playId: 7,
    ruleProfileId: rules.id,
    playEnd: { kind: 'play_end', tick: 500, reason: 'live_action_complete' },
  });
  ledger = recordCorrectRuleSnapshot(ledger, 0, {
    eventId: 'rule', tick: 501, snapshotId: 'snapshot', evidenceRevision: 1,
    ruling: { outsAfter: 1, basesAfter: { first: null, second: null, third: null }, scoredRunnerIds: [] },
  });
  return ledger;
};

describe('RuleProfile official window policy', () => {
  it('closes an NPB appeal at the next-play fence before official closure', () => {
    const opened = openRuleProfileOfficialStateWindow(initial(), 1, {
      profile, eventId: 'open', tick: 502, windowId: 'appeal-1', windowKind: 'appeal',
    });
    expect(() => closeOfficialPlay(opened, 2, { eventId: 'close', closureId: 'closure', tick: 503 }))
      .toThrow('official-state window remains open');
    const fenced = advanceRuleProfileOfficialWindows(opened, 2, {
      profile, boundary: 'next_play_fence', tick: 503, eventIdPrefix: 'fence', inningEnding: false,
    });
    expect(getOfficialStateWindows(fenced)).toMatchObject([{
      windowId: 'appeal-1', closedAtTick: 503, closeReason: 'next_play_fence',
    }]);
    expect(evaluateRuleProfileOfficialWindowTiming(fenced, profile, 'appeal-1', 503))
      .toBe('simultaneous_unresolved');
    expect(closeOfficialPlay(fenced, 3, { eventId: 'close', closureId: 'closure', tick: 503 }).revision).toBe(4);
    expect(evaluateRuleProfileOfficialWindowTiming(fenced, profile, 'appeal-1', 504)).toBe('expired');
  });

  it('closes an inning-ending appeal when defense leaves the field, but not during a continuing inning', () => {
    const opened = openRuleProfileOfficialStateWindow(initial(), 1, {
      profile, eventId: 'open', tick: 502, windowId: 'appeal-1', windowKind: 'appeal',
    });
    const continuing = advanceRuleProfileOfficialWindows(opened, 2, {
      profile, boundary: 'defense_left_field', tick: 503, eventIdPrefix: 'leave', inningEnding: false,
    });
    expect(continuing).toEqual(opened);
    const inningEnding = advanceRuleProfileOfficialWindows(opened, 2, {
      profile, boundary: 'defense_left_field', tick: 503, eventIdPrefix: 'leave', inningEnding: true,
    });
    expect(getOfficialStateWindows(inningEnding)[0]).toMatchObject({
      closedAtTick: 503, closeReason: 'defense_left_field',
    });
  });

  it('uses the profile same-tick policy and blocks a next play when appeal closure is disabled', () => {
    const alternate: RuleProfile = {
      ...profile, id: asRuleProfileId('alternate-window-rules'),
      appeal: { ...profile.appeal, nextPitchOrPlayClosesWindow: false, sameTickWindowCloseResolution: 'appeal_wins' },
    };
    const opened = openRuleProfileOfficialStateWindow(initial(alternate), 1, {
      profile: alternate, eventId: 'open', tick: 502, windowId: 'appeal-1', windowKind: 'appeal',
    });
    expect(() => advanceRuleProfileOfficialWindows(opened, 2, {
      profile: alternate, boundary: 'next_play_fence', tick: 503, eventIdPrefix: 'fence', inningEnding: false,
    })).toThrow('official-state window remains open under RuleProfile');
    const closed = advanceRuleProfileOfficialWindows(opened, 2, {
      profile: alternate, boundary: 'defense_left_field', tick: 503, eventIdPrefix: 'leave', inningEnding: true,
    });
    expect(evaluateRuleProfileOfficialWindowTiming(closed, alternate, 'appeal-1', 503)).toBe('timely');
    expect(() => evaluateRuleProfileOfficialWindowTiming(closed, profile, 'appeal-1', 503))
      .toThrow('RuleProfile id must match adjudication ledger');
  });

  it('keeps review and challenge unavailable without an explicit profile policy', () => {
    for (const windowKind of ['review', 'challenge'] as const) {
      expect(() => openRuleProfileOfficialStateWindow(initial(), 1, {
        profile, eventId: `open-${windowKind}`, tick: 502, windowId: windowKind, windowKind,
      })).toThrow('official-state window is not configured by RuleProfile');
    }
  });

  it('expires a configured review only after its deadline and blocks the next play beforehand', () => {
    const alternate: RuleProfile = {
      ...profile, id: asRuleProfileId('timed-review-rules'),
      officialWindows: { appeal: { available: true }, review: { available: true, expiresAfterTicks: 3 } },
    };
    const opened = openRuleProfileOfficialStateWindow(initial(alternate), 1, {
      profile: alternate, eventId: 'open', tick: 502, windowId: 'review-1', windowKind: 'review',
    });
    expect(() => advanceRuleProfileOfficialWindows(opened, 2, {
      profile: alternate, boundary: 'next_play_fence', tick: 504, eventIdPrefix: 'fence', inningEnding: false,
    })).toThrow('official-state window remains open under RuleProfile');
    expect(evaluateRuleProfileOfficialWindowTiming(opened, alternate, 'review-1', 505)).toBe('simultaneous_unresolved');
    const expired = advanceRuleProfileOfficialWindows(opened, 2, {
      profile: alternate, boundary: 'next_play_fence', tick: 506, eventIdPrefix: 'fence', inningEnding: false,
    });
    expect(getOfficialStateWindows(expired)[0]).toMatchObject({ closedAtTick: 506, closeReason: 'expired' });
    expect(evaluateRuleProfileOfficialWindowTiming(expired, alternate, 'review-1', 506)).toBe('expired');
    const declined = closeOfficialStateWindow(opened, 2, {
      eventId: 'decline', tick: 503, windowId: 'review-1', reason: 'declined',
    });
    expect(evaluateRuleProfileOfficialWindowTiming(declined, alternate, 'review-1', 505)).toBe('expired');
  });

  it('rejects active ledger properties without invoking caller code', () => {
    let accessed = false;
    const hostile = Object.defineProperty({ ...initial() }, 'ruleProfileId', {
      enumerable: true,
      get() { accessed = true; throw new Error('getter executed'); },
    });
    expect(() => openRuleProfileOfficialStateWindow(hostile, 1, {
      profile, eventId: 'open', tick: 502, windowId: 'appeal-1', windowKind: 'appeal',
    })).toThrow('official window input must not contain accessors');
    expect(accessed).toBe(false);
  });
});
