import { expect, it } from 'vitest';
import { asRuleProfileId } from '../model/RuleProfileRef';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import type { CanonicalPlateAppearanceTimeline } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  closeOfficialPlay,
  createPlayAdjudicationLedger,
  deriveClosedLiveBallMatchState,
  getPlayAdjudicationState,
  recordCorrectRuleSnapshot,
  type PlayAdjudicationLedger,
} from './PlayAdjudicationLedger';

const ruleProfileId = asRuleProfileId('integrity-rules');
const playEnd = { kind: 'play_end' as const, tick: 50, reason: 'live_action_complete' as const };

const closedLedger = (): PlayAdjudicationLedger => {
  let ledger = createPlayAdjudicationLedger({ playId: 3, ruleProfileId, playEnd });
  ledger = recordCorrectRuleSnapshot(ledger, 0, {
    eventId: 'rule-event',
    tick: 51,
    snapshotId: 'rule-1',
    evidenceRevision: 1,
    ruling: {
      outsAfter: 1,
      basesAfter: { first: 'runner', second: null, third: null },
      scoredRunnerIds: [],
    },
  });
  return closeOfficialPlay(ledger, 1, {
    eventId: 'close-event',
    closureId: 'closure',
    tick: 52,
  });
};

const match = (): CanonicalMatchState => ({
  ruleProfileId,
  inning: 1,
  half: 'top',
  outs: 0,
  balls: 0,
  strikes: 0,
  bases: { first: null, second: null, third: null },
  score: { away: 0, home: 0 },
  playId: 3,
});

const timeline = (): CanonicalPlateAppearanceTimeline => ({
  playId: 3,
  startedAtTick: 10,
  lastEventTick: 50,
  nextSequence: 1,
  status: {
    kind: 'live_ball_complete',
    count: { balls: 0, strikes: 0 },
    contactTick: 20,
    playEndTick: 50,
    disposition: { kind: 'fair', fairDeterminationTick: 21 },
  },
  events: [{
    tick: 50,
    sequence: 0,
    kind: 'LiveBallPlayEnded',
    payload: { playEnd },
  }],
});

it('does not invoke an active ledger events getter while reconstructing adjudication state', () => {
  let called = 0;
  const base = closedLedger();
  const hostile: any = {
    playId: base.playId,
    ruleProfileId: base.ruleProfileId,
    playEnd: base.playEnd,
    revision: base.revision,
  };
  Object.defineProperty(hostile, 'events', {
    enumerable: true,
    get() {
      called += 1;
      return base.events;
    },
  });
  expect(() => getPlayAdjudicationState(hostile)).toThrow();
  expect(called).toBe(0);
});

it('rejects a forged stored closure basis during replay', () => {
  const base = closedLedger();
  const events = base.events.map((event) =>
    event.kind === 'OfficialPlayClosed'
      ? { ...event, basisRulingId: 'forged-ruling' }
      : event,
  );
  expect(() => getPlayAdjudicationState({
    ...base,
    events,
  } as PlayAdjudicationLedger)).toThrow('closure basis does not match final official ruling');
});

it('does not invoke an active MatchState getter at the closed-play application boundary', () => {
  let called = 0;
  const base = match();
  const hostile: any = {
    ruleProfileId: base.ruleProfileId,
    inning: base.inning,
    half: base.half,
    outs: base.outs,
    balls: base.balls,
    strikes: base.strikes,
    bases: base.bases,
    score: base.score,
  };
  Object.defineProperty(hostile, 'playId', {
    enumerable: true,
    get() {
      called += 1;
      return 3;
    },
  });
  expect(() => deriveClosedLiveBallMatchState(hostile, timeline(), closedLedger())).toThrow();
  expect(called).toBe(0);
});

it('does not mutate physical timeline or durable MatchState while deriving the next state', () => {
  const beforeMatch = match();
  const beforeTimeline = timeline();
  const matchJson = JSON.stringify(beforeMatch);
  const timelineJson = JSON.stringify(beforeTimeline);
  const next = deriveClosedLiveBallMatchState(beforeMatch, beforeTimeline, closedLedger());
  expect(next.playId).toBe(4);
  expect(JSON.stringify(beforeMatch)).toBe(matchJson);
  expect(JSON.stringify(beforeTimeline)).toBe(timelineJson);
});
