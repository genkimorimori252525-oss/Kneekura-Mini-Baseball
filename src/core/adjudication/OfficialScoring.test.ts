import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import { asRuleProfileId } from '../model/RuleProfileRef';
import { createPlayEndFact } from '../rules/PhysicalRuleFacts';
import { resolveBatBallContact } from '../sim/contact/BatBallContact';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
  recordCountedPitch,
  recordFairBattedBall,
  recordFoulBattedBall,
  recordLiveBallPlayEnd,
} from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  closeOfficialPlay,
  createPlayAdjudicationLedger,
  recordCorrectRuleSnapshot,
} from './PlayAdjudicationLedger';
import { classifyClosedPlayForOfficialScoring } from './OfficialScoring';

const match = (overrides: Partial<CanonicalMatchState> = {}): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 4, half: 'top', outs: 0, balls: 3, strikes: 0,
  bases: { first: 'r1', second: 'r2', third: 'r3' },
  score: { away: 2, home: 1 }, playId: 12,
  ...overrides,
});

const closed = (
  before: CanonicalMatchState,
  tick: number,
  ruling: { outsAfter: number; basesAfter: CanonicalMatchState['bases']; scoredRunnerIds: string[] },
  playEnd: ReturnType<typeof createPlayEndFact> | null = null,
) => {
  const ledger = createPlayAdjudicationLedger({
    playId: before.playId, ruleProfileId: before.ruleProfileId, playEnd,
  });
  const ruled = recordCorrectRuleSnapshot(ledger, 0, {
    eventId: 'rule', tick: tick + 1, snapshotId: 'snapshot', evidenceRevision: 1, ruling,
  });
  return closeOfficialPlay(ruled, 1, {
    eventId: 'close', closureId: 'closure', tick: tick + 2,
  });
};

describe('official scoring boundary', () => {
  it('credits a closed bases-loaded walk with its official run and no H/E', () => {
    const before = match();
    const timeline = recordCountedPitch(
      createCanonicalPlateAppearanceTimeline(before, 100), 200, { kind: 'ball' },
    );
    const adjudication = closed(before, 200, {
      outsAfter: 0,
      basesAfter: { first: 'batter', second: 'r1', third: 'r2' },
      scoredRunnerIds: ['r3'],
    });
    expect(classifyClosedPlayForOfficialScoring({
      kind: 'non_live', match: before, timeline, adjudication,
      context: { kind: 'walk', batterRunnerId: 'batter' },
    })).toEqual({
      kind: 'supported',
      record: {
        playId: 12, closureId: 'closure', basisRulingId: 'snapshot',
        classification: 'base_on_balls', battingTeam: 'away',
        runsScored: 1, hitsCredited: 0, errorsCharged: 0,
      },
    });
  });

  it('classifies an officially closed non-live strikeout without guessing a hit or error', () => {
    const before = match({ outs: 1, balls: 0, strikes: 2 });
    const timeline = recordCountedPitch(
      createCanonicalPlateAppearanceTimeline(before, 100), 200, { kind: 'swinging_strike' },
    );
    const adjudication = closed(before, 200, {
      outsAfter: 2, basesAfter: before.bases, scoredRunnerIds: [],
    });
    expect(classifyClosedPlayForOfficialScoring({
      kind: 'non_live', match: before, timeline, adjudication, context: { kind: 'strikeout' },
    })).toMatchObject({
      kind: 'supported', record: {
        classification: 'strikeout', runsScored: 0, hitsCredited: 0, errorsCharged: 0,
      },
    });
    expect(() => classifyClosedPlayForOfficialScoring({
      kind: 'non_live', match: before, timeline,
      adjudication: createPlayAdjudicationLedger({
        playId: before.playId, ruleProfileId: before.ruleProfileId, playEnd: null,
      }),
      context: { kind: 'strikeout' },
    })).toThrow('official play must be closed');
  });

  it('keeps a closed live-ball result explicit when H/E/FC evidence is insufficient', () => {
    const before = match({ balls: 0, bases: { first: null, second: null, third: null } });
    const contact = resolveBatBallContact(
      {
        tick: 150, position: { x: 0, y: 1, z: 0.06 },
        velocity: { x: 0, y: -1.5, z: -35 }, spin: { x: 0, y: 0, z: 0 },
      },
      {
        pose: { grip: { x: -0.42, y: 1, z: 0 }, tip: { x: 0.42, y: 1, z: 0 } },
        linearVelocity: { x: 0, y: 0, z: 22 }, angularVelocity: { x: 0, y: 0, z: 0 },
      },
    );
    if (contact === null) throw new Error('fixture must produce contact');
    const playEnd = createPlayEndFact(500, 'live_action_complete');
    const timeline = recordLiveBallPlayEnd(
      recordFairBattedBall(
        recordBatBallContact(createCanonicalPlateAppearanceTimeline(before, 100), contact), 200,
      ),
      playEnd,
    );
    const adjudication = closed(before, 500, {
      outsAfter: 0, basesAfter: before.bases, scoredRunnerIds: [],
    }, playEnd);
    expect(classifyClosedPlayForOfficialScoring({
      kind: 'live_ball', match: before, timeline, adjudication,
    })).toEqual({
      kind: 'unsupported', playId: 12, closureId: 'closure',
      reason: 'live_ball_hit_error_fielders_choice_not_classified',
    });
  });

  it('scores a caught foul only when the final official ruling retains the batter out', () => {
    const before = match({ outs: 0, balls: 0, strikes: 1 });
    const contact = resolveBatBallContact(
      {
        tick: 150, position: { x: 0, y: 1, z: 0.06 },
        velocity: { x: 0, y: -1.5, z: -35 }, spin: { x: 0, y: 0, z: 0 },
      },
      {
        pose: { grip: { x: -0.42, y: 1, z: 0 }, tip: { x: 0.42, y: 1, z: 0 } },
        linearVelocity: { x: 0, y: 0, z: 22 }, angularVelocity: { x: 0, y: 0, z: 0 },
      },
    );
    if (contact === null) throw new Error('fixture must produce contact');
    const playEnd = createPlayEndFact(500, 'live_action_complete');
    const timeline = recordLiveBallPlayEnd(recordFoulBattedBall(
      recordBatBallContact(createCanonicalPlateAppearanceTimeline(before, 100), contact),
      300, false, { kind: 'caught', batterRunnerId: 'batter',
        firstFielderTouchTick: 250, outTick: 300, secureCatchTick: 300 },
    ), playEnd);
    const official = closed(before, 500, {
      outsAfter: 1,
      basesAfter: { first: 'r1', second: 'r2', third: null },
      scoredRunnerIds: ['r3'],
    }, playEnd);
    expect(classifyClosedPlayForOfficialScoring({
      kind: 'live_ball', match: before, timeline, adjudication: official,
    })).toEqual({ kind: 'supported', record: {
      playId: 12, closureId: 'closure', basisRulingId: 'snapshot',
      classification: 'foul_out', battingTeam: 'away',
      runsScored: 1, hitsCredited: 0, errorsCharged: 0,
    } });

    const overturned = closed(before, 500, {
      outsAfter: 0, basesAfter: before.bases, scoredRunnerIds: [],
    }, playEnd);
    expect(classifyClosedPlayForOfficialScoring({
      kind: 'live_ball', match: before, timeline, adjudication: overturned,
    })).toMatchObject({ kind: 'unsupported',
      reason: 'live_ball_hit_error_fielders_choice_not_classified' });

    const ambiguousOut = closed(before, 500, {
      outsAfter: 1,
      basesAfter: { first: null, second: 'r2', third: 'r3' },
      scoredRunnerIds: [],
    }, playEnd);
    expect(classifyClosedPlayForOfficialScoring({
      kind: 'live_ball', match: before, timeline, adjudication: ambiguousOut,
    })).toMatchObject({ kind: 'unsupported',
      reason: 'live_ball_hit_error_fielders_choice_not_classified' });
  });

  it('uses explicit scorer evidence for fair hit, error and fielder choice', () => {
    const before = match({ outs: 0, balls: 0,
      bases: { first: 'r1', second: null, third: null } });
    const contact = resolveBatBallContact(
      { tick: 150, position: { x: 0, y: 1, z: 0.06 },
        velocity: { x: 0, y: -1.5, z: -35 }, spin: { x: 0, y: 0, z: 0 } },
      { pose: { grip: { x: -0.42, y: 1, z: 0 }, tip: { x: 0.42, y: 1, z: 0 } },
        linearVelocity: { x: 0, y: 0, z: 22 }, angularVelocity: { x: 0, y: 0, z: 0 } },
    );
    if (contact === null) throw new Error('fixture must produce contact');
    const playEnd = createPlayEndFact(500, 'live_action_complete');
    const timeline = recordLiveBallPlayEnd(recordFairBattedBall(recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(before, 100), contact,
    ), 200), playEnd);
    const source = { schemaVersion: 1 as const,
      sourceEventId: 'scorer-source-1',
      sourceKind: 'official_scorer_judgment' as const,
      scorerId: 'scorer-1', ruleProfileId: before.ruleProfileId,
      playId: before.playId,
      closureId: 'closure', basisRulingId: 'snapshot',
      recordedAtTick: 503, contactSequence: 0, fairSequence: 1,
      batterRunnerId: 'batter' };
    const cases = [
      { classification: 'base_hit' as const,
        judgment: { kind: 'base_hit' as const },
        ruling: { outsAfter: 0, basesAfter: {
          first: 'batter', second: 'r1', third: null }, scoredRunnerIds: [] },
        hitsCredited: 1, errorsCharged: 0 },
      { classification: 'reached_on_error' as const,
        judgment: { kind: 'reached_on_error' as const, chargedFielderId: 'fielder-3' },
        ruling: { outsAfter: 0, basesAfter: {
          first: 'batter', second: 'r1', third: null }, scoredRunnerIds: [] },
        hitsCredited: 0, errorsCharged: 1 },
      { classification: 'fielders_choice' as const,
        judgment: { kind: 'fielders_choice' as const, retiredPriorRunnerId: 'r1' },
        ruling: { outsAfter: 1, basesAfter: {
          first: 'batter', second: null, third: null }, scoredRunnerIds: [] },
        hitsCredited: 0, errorsCharged: 0 },
    ];
    for (const item of cases) {
      const adjudication = closed(before, 500, item.ruling, playEnd);
      expect(classifyClosedPlayForOfficialScoring({ kind: 'live_ball',
        match: before, timeline, adjudication,
        scoringEvidence: { ...source, judgment: item.judgment },
      })).toMatchObject({ kind: 'supported', record: {
        classification: item.classification,
        hitsCredited: item.hitsCredited,
        errorsCharged: item.errorsCharged,
      } });
    }
  });

  it('rejects a scorer judgment whose source or final-play facts do not match', () => {
    const before = match({ balls: 0, bases: {
      first: 'r1', second: null, third: null } });
    const contact = resolveBatBallContact(
      { tick: 150, position: { x: 0, y: 1, z: 0.06 },
        velocity: { x: 0, y: -1.5, z: -35 }, spin: { x: 0, y: 0, z: 0 } },
      { pose: { grip: { x: -0.42, y: 1, z: 0 }, tip: { x: 0.42, y: 1, z: 0 } },
        linearVelocity: { x: 0, y: 0, z: 22 }, angularVelocity: { x: 0, y: 0, z: 0 } },
    );
    if (contact === null) throw new Error('fixture must produce contact');
    const playEnd = createPlayEndFact(500, 'live_action_complete');
    const timeline = recordLiveBallPlayEnd(recordFairBattedBall(recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(before, 100), contact,
    ), 200), playEnd);
    const adjudication = closed(before, 500, {
      outsAfter: 1, basesAfter: { first: 'batter', second: null, third: null },
      scoredRunnerIds: [],
    }, playEnd);
    const evidence = { schemaVersion: 1 as const,
      sourceEventId: 'scorer-source-1',
      sourceKind: 'official_scorer_judgment' as const,
      scorerId: 'scorer-1', ruleProfileId: before.ruleProfileId,
      playId: before.playId,
      closureId: 'closure', basisRulingId: 'snapshot',
      recordedAtTick: 503, contactSequence: 0, fairSequence: 1,
      batterRunnerId: 'batter',
      judgment: { kind: 'fielders_choice' as const, retiredPriorRunnerId: 'r1' } };
    expect(() => classifyClosedPlayForOfficialScoring({ kind: 'live_ball',
      match: before, timeline, adjudication,
      scoringEvidence: { ...evidence, fairSequence: 7 },
    })).toThrow('scoring evidence');
    expect(() => classifyClosedPlayForOfficialScoring({ kind: 'live_ball',
      match: before, timeline, adjudication,
      scoringEvidence: { ...evidence,
        ruleProfileId: asRuleProfileId('different-rules') },
    })).toThrow('scoring evidence');
    expect(() => classifyClosedPlayForOfficialScoring({ kind: 'live_ball',
      match: before, timeline, adjudication,
      scoringEvidence: { ...evidence, judgment: {
        kind: 'fielders_choice', retiredPriorRunnerId: 'unknown' } },
    })).toThrow('scoring evidence');
  });
});
