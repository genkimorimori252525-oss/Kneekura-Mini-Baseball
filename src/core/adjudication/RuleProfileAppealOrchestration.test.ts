import { describe, expect, it } from 'vitest';
import { createDefensiveAppealAttemptFact, createPlayEndFact } from '../rules/PhysicalRuleFacts';
import { NPB_2026_RULE_PROFILE, type RuleProfile } from '../rules/RuleProfile';
import type { TagUpComplianceResult } from '../rules/TagUpCompliance';
import { closeAppealWindow, createAppealWindow } from '../rules/AppealWindow';
import {
  createPlayAdjudicationLedger,
  type PlayAdjudicationLedger,
} from './PlayAdjudicationLedger';
import {
  closeProfileAppealWindowAtBoundary,
  openTagUpAppealWindow,
  recordAndResolveTagUpAppealAttempt,
  resolveTagUpAppealWithProfile,
} from './RuleProfileAppealOrchestration';

const profile = NPB_2026_RULE_PROFILE;
const playEnd = createPlayEndFact(100, 'live_action_complete');

const appealable: TagUpComplianceResult = {
  kind: 'appealable_early_departure',
  runnerId: 'r3',
  originBase: 3,
  firstFielderTouchTick: 80,
  departureTick: 70,
  retouchTick: null,
};

const appeal = (tick = 120) => createDefensiveAppealAttemptFact(
  'lf',
  'r3',
  3,
  'tag_up_early_departure',
  tick,
);

const initialLedger = (): PlayAdjudicationLedger =>
  createPlayAdjudicationLedger({
    playId: 7,
    ruleProfileId: profile.id,
    playEnd,
  });

const openedLedger = (): PlayAdjudicationLedger =>
  openTagUpAppealWindow(initialLedger(), 0, profile, {
    eventId: 'open-appeal',
    windowId: 'appeal-1',
    tick: 100,
  });

const withSameTickPolicy = (
  policy: RuleProfile['appeal']['sameTickWindowCloseResolution'],
): RuleProfile => ({
  ...profile,
  appeal: {
    ...profile.appeal,
    sameTickWindowCloseResolution: policy,
  },
});

describe('RuleProfile appeal orchestration', () => {
  it('records a real physical appeal attempt, resolves existing tag-up rules, and closes the window', () => {
    const result = recordAndResolveTagUpAppealAttempt(
      openedLedger(),
      1,
      profile,
      {
        eventId: 'appeal-event',
        basisPhysicalEventId: 'physical-appeal-1',
        windowId: 'appeal-1',
        appeal: appeal(),
        compliance: appealable,
        resolutionEventId: 'resolve-appeal',
      },
    );

    expect(result.result).toEqual({
      kind: 'out',
      runnerId: 'r3',
      classification: 'tag_up_appeal',
      appealedBase: 3,
      outTick: 120,
      appealTick: 120,
    });
    expect(result.ledger.revision).toBe(3);
    expect(result.ledger.events.map((event) => event.kind)).toEqual([
      'OfficialStateWindowOpened',
      'DefensiveAppealAttemptRecorded',
      'OfficialStateWindowClosed',
    ]);
    expect(result.ledger.events[1]).toMatchObject({
      kind: 'DefensiveAppealAttemptRecorded',
      windowId: 'appeal-1',
      basisPhysicalEventId: 'physical-appeal-1',
      attempt: appeal(),
    });
    expect(result.ledger.events[2]).toMatchObject({
      kind: 'OfficialStateWindowClosed',
      windowId: 'appeal-1',
      reason: 'resolved',
    });
  });

  it('does not infer an appeal: the orchestrator requires an actual DefensiveAppealAttemptFact', () => {
    expect(() => recordAndResolveTagUpAppealAttempt(
      openedLedger(),
      1,
      profile,
      {
        eventId: 'appeal-event',
        basisPhysicalEventId: 'physical-appeal-1',
        windowId: 'appeal-1',
        appeal: null as any,
        compliance: appealable,
        resolutionEventId: 'resolve-appeal',
      },
    )).toThrow();
  });

  it('applies next-play and defense-left-field appeal-window boundaries from RuleProfile', () => {
    const nextPlay = closeProfileAppealWindowAtBoundary(
      openedLedger(),
      1,
      profile,
      {
        eventId: 'next-play-fence',
        windowId: 'appeal-1',
        tick: 130,
        boundary: 'next_pitch_or_play',
        inningEnding: false,
      },
    );
    expect(nextPlay.kind).toBe('closed');
    if (nextPlay.kind === 'closed') {
      expect(nextPlay.ledger.events.at(-1)).toMatchObject({
        kind: 'OfficialStateWindowClosed',
        windowId: 'appeal-1',
        reason: 'next_play_fence',
      });
    }

    const notInningEnding = closeProfileAppealWindowAtBoundary(
      openedLedger(),
      1,
      profile,
      {
        eventId: 'left-field',
        windowId: 'appeal-1',
        tick: 130,
        boundary: 'defense_left_field',
        inningEnding: false,
      },
    );
    expect(notInningEnding.kind).toBe('remains_open');
    expect(notInningEnding.ledger.revision).toBe(1);

    const inningEnding = closeProfileAppealWindowAtBoundary(
      openedLedger(),
      1,
      profile,
      {
        eventId: 'left-field',
        windowId: 'appeal-1',
        tick: 130,
        boundary: 'defense_left_field',
        inningEnding: true,
      },
    );
    expect(inningEnding.kind).toBe('closed');
    if (inningEnding.kind === 'closed') {
      expect(inningEnding.ledger.events.at(-1)).toMatchObject({
        kind: 'OfficialStateWindowClosed',
        reason: 'defense_left_field',
      });
    }
  });

  it('maps exact same-tick appeal/window-close ambiguity through the profile policy', () => {
    const closed = closeAppealWindow(
      createAppealWindow(100),
      120,
      'next_pitch_or_play',
    );

    expect(resolveTagUpAppealWithProfile({
      profile: withSameTickPolicy('unresolved'),
      compliance: appealable,
      appeal: appeal(120),
      window: closed,
    }).kind).toBe('simultaneous_unresolved');

    expect(resolveTagUpAppealWithProfile({
      profile: withSameTickPolicy('appeal_wins'),
      compliance: appealable,
      appeal: appeal(120),
      window: closed,
    }).kind).toBe('out');

    expect(resolveTagUpAppealWithProfile({
      profile: withSameTickPolicy('window_close_wins'),
      compliance: appealable,
      appeal: appeal(120),
      window: closed,
    })).toEqual({
      kind: 'appeal_expired',
      runnerId: 'r3',
      appealedBase: 3,
      appealTick: 120,
      windowClosedAtTick: 120,
    });
  });

  it('rejects a RuleProfile that does not match the adjudication ledger', () => {
    const mismatched: RuleProfile = {
      ...profile,
      id: 'other-rules' as RuleProfile['id'],
    };
    expect(() => openTagUpAppealWindow(
      initialLedger(),
      0,
      mismatched,
      {
        eventId: 'open-appeal',
        windowId: 'appeal-1',
        tick: 100,
      },
    )).toThrow('RuleProfile must match adjudication ledger');
  });

  it('rejects replaying the same physical appeal evidence under a different ledger event id', () => {
    const first = recordAndResolveTagUpAppealAttempt(
      openedLedger(),
      1,
      profile,
      {
        eventId: 'appeal-event',
        basisPhysicalEventId: 'physical-appeal-1',
        windowId: 'appeal-1',
        appeal: appeal(),
        compliance: appealable,
        resolutionEventId: 'resolve-appeal',
      },
    );

    expect(() => recordAndResolveTagUpAppealAttempt(
      first.ledger,
      3,
      profile,
      {
        eventId: 'appeal-event-duplicate',
        basisPhysicalEventId: 'physical-appeal-1',
        windowId: 'appeal-1',
        appeal: appeal(),
        compliance: appealable,
        resolutionEventId: 'resolve-duplicate',
      },
    )).toThrow();
  });
});
