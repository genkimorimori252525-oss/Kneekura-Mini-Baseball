import { describe, expect, it } from 'vitest';
import { asRuleProfileId } from '../model/RuleProfileRef';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import type { CanonicalPlateAppearanceTimeline } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  closeOfficialPlay,
  createPlayAdjudicationLedger,
  recordCorrectRuleSnapshot,
} from './PlayAdjudicationLedger';
import {
  activateNextLiveBallPlay,
  confirmDurableClosedLiveBallStateApplication,
} from './NextPlayActivation';

const ruleProfileId = asRuleProfileId('test-rules');
const playEnd = { kind: 'play_end' as const, tick: 500, reason: 'live_action_complete' as const };

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
  nextSequence: 1,
  status: {
    kind: 'live_ball_complete',
    count: { balls: 0, strikes: 0 },
    contactTick: 200,
    playEndTick: 500,
    disposition: { kind: 'fair', fairDeterminationTick: 210 },
  },
  events: [{
    tick: 500,
    sequence: 0,
    kind: 'LiveBallPlayEnded',
    payload: { playEnd },
  }],
});

const ledger = () => {
  let value = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd });
  value = recordCorrectRuleSnapshot(value, 0, {
    eventId: 'rule-event',
    tick: 501,
    snapshotId: 'rule-1',
    evidenceRevision: 1,
    ruling: {
      outsAfter: 2,
      basesAfter: { first: null, second: 'r1', third: null },
      scoredRunnerIds: [],
    },
  });
  return closeOfficialPlay(value, 1, {
    eventId: 'close-event',
    closureId: 'closure-1',
    tick: 502,
  });
};

describe('durable official state application fence', () => {
  it('confirms a persistence receipt only for the exact derived official MatchState', () => {
    const persisted: CanonicalMatchState = {
      ...match(),
      outs: 2,
      balls: 0,
      strikes: 0,
      bases: { first: null, second: 'r1', third: null },
      playId: 8,
    };
    const receipt = confirmDurableClosedLiveBallStateApplication({
      match: match(),
      physicalTimeline: timeline(),
      adjudication: ledger(),
      persistedMatchState: persisted,
      applicationId: 'apply-closure-1',
      durableRevision: 19,
    });
    expect(receipt).toMatchObject({
      applicationId: 'apply-closure-1',
      closureId: 'closure-1',
      previousPlayId: 7,
      durableRevision: 19,
      appliedMatchState: persisted,
    });
  });

  it('rejects persistence confirmation when the stored MatchState differs from the official delta', () => {
    expect(() => confirmDurableClosedLiveBallStateApplication({
      match: match(),
      physicalTimeline: timeline(),
      adjudication: ledger(),
      persistedMatchState: {
        ...match(),
        outs: 1,
        playId: 8,
      },
      applicationId: 'bad-apply',
      durableRevision: 19,
    })).toThrow('persisted MatchState must match the officially derived state');
  });

  it('does not activate the next timeline from a closure without the matching durable application receipt', () => {
    expect(() => activateNextLiveBallPlay({
      match: match(),
      physicalTimeline: timeline(),
      adjudication: ledger(),
      application: null as any,
      nextStartedAtTick: 503,
    })).toThrow('durable official MatchState application is required');

    const receipt = confirmDurableClosedLiveBallStateApplication({
      match: match(),
      physicalTimeline: timeline(),
      adjudication: ledger(),
      persistedMatchState: {
        ...match(),
        outs: 2,
        balls: 0,
        strikes: 0,
        bases: { first: null, second: 'r1', third: null },
        playId: 8,
      },
      applicationId: 'apply-closure-1',
      durableRevision: 19,
    });
    const result = activateNextLiveBallPlay({
      match: match(),
      physicalTimeline: timeline(),
      adjudication: ledger(),
      application: receipt,
      nextStartedAtTick: 503,
    });
    expect(result.nextMatchState).toEqual(receipt.appliedMatchState);
    expect(result.nextTimeline.playId).toBe(8);
  });

  it('rejects a receipt rebound to another closure identity', () => {
    const receipt = confirmDurableClosedLiveBallStateApplication({
      match: match(),
      physicalTimeline: timeline(),
      adjudication: ledger(),
      persistedMatchState: {
        ...match(),
        outs: 2,
        balls: 0,
        strikes: 0,
        bases: { first: null, second: 'r1', third: null },
        playId: 8,
      },
      applicationId: 'apply-closure-1',
      durableRevision: 19,
    });
    expect(() => activateNextLiveBallPlay({
      match: match(),
      physicalTimeline: timeline(),
      adjudication: ledger(),
      application: { ...receipt, closureId: 'forged-closure' },
      nextStartedAtTick: 503,
    })).toThrow('durable application receipt does not match OfficialPlayClosure');
  });
});
