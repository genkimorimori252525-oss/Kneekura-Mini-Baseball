import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import { asRuleProfileId } from '../model/RuleProfileRef';
import { createCanonicalPlateAppearanceTimeline, recordCountedPitch } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from './PlayAdjudicationLedger';
import { activateNextNonLivePlateAppearance, confirmDurableClosedNonLiveStateApplication } from './NextPlayActivation';

const ruleProfileId = asRuleProfileId('test-rules');
const match = (changes: Partial<CanonicalMatchState> = {}): CanonicalMatchState => ({
  ruleProfileId, inning: 1, half: 'top', outs: 1, balls: 3, strikes: 0,
  bases: { first: 'r1', second: 'r2', third: 'r3' },
  score: { away: 0, home: 0 }, playId: 7, ...changes,
});

const closed = (before: CanonicalMatchState, kind: 'walk' | 'strikeout') => {
  const timeline = recordCountedPitch(
    createCanonicalPlateAppearanceTimeline(before, 100),
    101,
    { kind: kind === 'walk' ? 'ball' : 'called_strike' },
  );
  let adjudication = createPlayAdjudicationLedger({ playId: before.playId, ruleProfileId, playEnd: null });
  adjudication = recordCorrectRuleSnapshot(adjudication, 0, {
    eventId: 'rule-event', tick: 102, snapshotId: 'rule-1', evidenceRevision: 1,
    ruling: kind === 'walk'
      ? { outsAfter: before.outs, basesAfter: { first: 'batter', second: 'r1', third: 'r2' }, scoredRunnerIds: ['r3'] }
      : { outsAfter: before.outs + 1, basesAfter: before.bases, scoredRunnerIds: [] },
  });
  adjudication = closeOfficialPlay(adjudication, 1, { eventId: 'close-event', closureId: 'closure-1', tick: 103 });
  return { timeline, adjudication };
};

describe('non-live durable next-play fence', () => {
  it('applies a bases-loaded walk only after closure and durable receipt', () => {
    const before = match();
    const { timeline, adjudication } = closed(before, 'walk');
    const persisted: CanonicalMatchState = {
      ...before, balls: 0, strikes: 0,
      bases: { first: 'batter', second: 'r1', third: 'r2' },
      score: { away: 1, home: 0 }, playId: 8,
    };
    const receipt = confirmDurableClosedNonLiveStateApplication({
      match: before, physicalTimeline: timeline, adjudication, batterRunnerId: 'batter',
      persistedMatchState: persisted, applicationId: 'application-1', durableRevision: 19,
    });
    const result = activateNextNonLivePlateAppearance({
      match: before, physicalTimeline: timeline, adjudication, batterRunnerId: 'batter',
      application: receipt, nextStartedAtTick: 104,
    });
    expect(receipt).toMatchObject({ closureId: 'closure-1', previousPlayId: 7, appliedMatchState: persisted });
    expect(result.nextMatchState).toEqual(persisted);
    expect(result.nextTimeline).toMatchObject({ playId: 8, startedAtTick: 104, status: { kind: 'active' } });
  });

  it('uses the existing strikeout third-out transition after durable application', () => {
    const before = match({ outs: 2, balls: 0, strikes: 2 });
    const { timeline, adjudication } = closed(before, 'strikeout');
    const persisted: CanonicalMatchState = {
      ...before, inning: 1, half: 'bottom', outs: 0, balls: 0, strikes: 0,
      bases: { first: null, second: null, third: null }, playId: 8,
    };
    const receipt = confirmDurableClosedNonLiveStateApplication({
      match: before, physicalTimeline: timeline, adjudication, batterRunnerId: 'batter',
      persistedMatchState: persisted, applicationId: 'application-1', durableRevision: 20,
    });
    expect(activateNextNonLivePlateAppearance({
      match: before, physicalTimeline: timeline, adjudication, batterRunnerId: 'batter',
      application: receipt, nextStartedAtTick: 103,
    }).nextMatchState).toEqual(persisted);
  });

  it('rejects a stored state that differs from the closed non-live result', () => {
    const before = match();
    const { timeline, adjudication } = closed(before, 'walk');
    expect(() => confirmDurableClosedNonLiveStateApplication({
      match: before, physicalTimeline: timeline, adjudication, batterRunnerId: 'batter',
      persistedMatchState: { ...before, playId: 8 }, applicationId: 'application-1', durableRevision: 19,
    })).toThrow('persisted MatchState must match the officially derived state');
  });

  it('rejects closure rulings that disagree with the terminal count result', () => {
    const before = match();
    const { timeline, adjudication } = closed(before, 'walk');
    const wrong = {
      ...adjudication,
      events: adjudication.events.map((event) => event.kind === 'CorrectRuleSnapshotRecorded'
        ? { ...event, snapshot: { ...event.snapshot, ruling: { ...event.snapshot.ruling, outsAfter: 2 } } }
        : event),
    };
    expect(() => confirmDurableClosedNonLiveStateApplication({
      match: before, physicalTimeline: timeline, adjudication: wrong, batterRunnerId: 'batter',
      persistedMatchState: before, applicationId: 'application-1', durableRevision: 19,
    })).toThrow('official non-live ruling does not match the terminal plate appearance');
  });

  it('requires a receipt for the same closure and start at or after closure', () => {
    const before = match();
    const { timeline, adjudication } = closed(before, 'walk');
    const input = { match: before, physicalTimeline: timeline, adjudication, batterRunnerId: 'batter', nextStartedAtTick: 104 };
    expect(() => activateNextNonLivePlateAppearance({ ...input, application: null as any })).toThrow('durable official MatchState application is required');
    const persisted: CanonicalMatchState = {
      ...before, balls: 0, strikes: 0, bases: { first: 'batter', second: 'r1', third: 'r2' },
      score: { away: 1, home: 0 }, playId: 8,
    };
    const receipt = confirmDurableClosedNonLiveStateApplication({
      ...input, persistedMatchState: persisted, applicationId: 'application-1', durableRevision: 19,
    });
    expect(() => activateNextNonLivePlateAppearance({ ...input, application: { ...receipt, closureId: 'other' } })).toThrow('durable application receipt does not match OfficialPlayClosure');
    expect(() => activateNextNonLivePlateAppearance({ ...input, application: receipt, nextStartedAtTick: 102 })).toThrow('next play cannot start before OfficialPlayClosure');
  });

  it('rejects a terminal status that is not backed by the last physical count event', () => {
    const before = match();
    const { adjudication } = closed(before, 'walk');
    const continuing = recordCountedPitch(createCanonicalPlateAppearanceTimeline(before, 100), 101, { kind: 'called_strike' });
    const forged = { ...continuing, status: { kind: 'walk' as const, terminalCount: { balls: 4 as const, strikes: 0 } } };
    expect(() => confirmDurableClosedNonLiveStateApplication({
      match: before, physicalTimeline: forged, adjudication, batterRunnerId: 'batter',
      persistedMatchState: before, applicationId: 'application-1', durableRevision: 19,
    })).toThrow('terminal plate appearance must match its final physical event');
  });

  it('rejects a non-live application before official closure', () => {
    const before = match();
    const { timeline } = closed(before, 'walk');
    const adjudication = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd: null });
    expect(() => confirmDurableClosedNonLiveStateApplication({
      match: before, physicalTimeline: timeline, adjudication, batterRunnerId: 'batter',
      persistedMatchState: before, applicationId: 'application-1', durableRevision: 19,
    })).toThrow('official play must be closed before confirming durable MatchState application');
  });
});
