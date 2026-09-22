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

const closedLedger = () => {
  let ledger = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd });
  ledger = recordCorrectRuleSnapshot(ledger, 0, {
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
  return closeOfficialPlay(ledger, 1, {
    eventId: 'close-event',
    closureId: 'closure-1',
    tick: 502,
  });
};


const applicationReceipt = (
  oldMatch: CanonicalMatchState = match(),
  oldTimeline: CanonicalPlateAppearanceTimeline = timeline(),
  adjudication = closedLedger(),
) => confirmDurableClosedLiveBallStateApplication({
  match: oldMatch,
  physicalTimeline: oldTimeline,
  adjudication,
  persistedMatchState: {
    ...oldMatch,
    outs: 2,
    balls: 0,
    strikes: 0,
    bases: { first: null, second: 'r1', third: null },
    playId: oldMatch.playId + 1,
  },
  applicationId: 'apply-closure-1',
  durableRevision: 1,
});

describe('next live-ball play activation fence', () => {
  it('activates the next timeline only from an officially closed play and durable derived state', () => {
    const result = activateNextLiveBallPlay({
      match: match(),
      physicalTimeline: timeline(),
      adjudication: closedLedger(),
      application: applicationReceipt(),
      nextStartedAtTick: 503,
    });

    expect(result.previousPlayId).toBe(7);
    expect(result.closureId).toBe('closure-1');
    expect(result.nextMatchState).toMatchObject({
      playId: 8,
      outs: 2,
      balls: 0,
      strikes: 0,
      bases: { first: null, second: 'r1', third: null },
    });
    expect(result.nextTimeline).toMatchObject({
      playId: 8,
      startedAtTick: 503,
      lastEventTick: 503,
      nextSequence: 0,
      status: { kind: 'active', count: { balls: 0, strikes: 0 } },
      events: [],
    });
  });

  it('rejects activation before OfficialPlayClosure exists', () => {
    let ledger = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd });
    ledger = recordCorrectRuleSnapshot(ledger, 0, {
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
    expect(() => activateNextLiveBallPlay({
      match: match(),
      physicalTimeline: timeline(),
      adjudication: ledger,
      application: null as any,
      nextStartedAtTick: 503,
    })).toThrow('official play must be closed');
  });

  it('rejects a next-play start tick before the official closure boundary', () => {
    expect(() => activateNextLiveBallPlay({
      match: match(),
      physicalTimeline: timeline(),
      adjudication: closedLedger(),
      application: applicationReceipt(),
      nextStartedAtTick: 501,
    })).toThrow('next play cannot start before OfficialPlayClosure');
  });

  it('does not mutate the old MatchState, physical timeline, or ledger', () => {
    const oldMatch = match();
    const oldTimeline = timeline();
    const ledger = closedLedger();
    const before = JSON.stringify({ oldMatch, oldTimeline, ledger });

    const application = applicationReceipt(oldMatch, oldTimeline, ledger);
    const first = activateNextLiveBallPlay({
      match: oldMatch,
      physicalTimeline: oldTimeline,
      adjudication: ledger,
      application,
      nextStartedAtTick: 503,
    });
    const second = activateNextLiveBallPlay({
      match: oldMatch,
      physicalTimeline: oldTimeline,
      adjudication: ledger,
      application,
      nextStartedAtTick: 503,
    });

    expect(JSON.stringify({ oldMatch, oldTimeline, ledger })).toBe(before);
    expect(second).toEqual(first);
  });
});
