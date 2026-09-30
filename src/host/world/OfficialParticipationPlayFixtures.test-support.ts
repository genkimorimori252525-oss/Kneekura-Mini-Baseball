import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import type { BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';

const ruleProfileId = asRuleProfileId('test-rules');
export const match = (): CanonicalMatchState => ({
  ruleProfileId, inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
  bases: { first: null, second: null, third: null },
  score: { away: 0, home: 0 }, playId: 7,
});
export const worldSetup = (firstDefenderId = 'home-0'): BetweenPlayWorldSetup => ({
  baseCenters: { first: { x: 27, z: 0 },
    second: { x: 27, z: 27 }, third: { x: 0, z: 27 } },
  defenders: (['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const).map(
    (registeredPosition, index) => ({
      playerId: index === 0 ? firstDefenderId : `home-${index}`, registeredPosition,
      position: { x: index, z: index },
    })),
  activePreviousPlayControllerIds: [],
});
export const timeline = (playId: number, startedAtTick: number,
  endTick: number): CanonicalPlateAppearanceTimeline => {
  const playEnd = { kind: 'play_end' as const, tick: endTick,
    reason: 'live_action_complete' as const };
  return { playId, startedAtTick, lastEventTick: endTick, nextSequence: 1,
    status: { kind: 'live_ball_complete', count: { balls: 0, strikes: 0 },
      contactTick: startedAtTick + 100, playEndTick: endTick,
      disposition: { kind: 'fair', fairDeterminationTick: startedAtTick + 110 } },
    events: [{ tick: endTick, sequence: 0, kind: 'LiveBallPlayEnded',
      payload: { playEnd } }] };
};
export const adjudication = (playId: number, endTick: number,
  closureId: string, outsAfter: number) => {
  const playEnd = { kind: 'play_end' as const, tick: endTick,
    reason: 'live_action_complete' as const };
  let ledger = createPlayAdjudicationLedger({ playId, ruleProfileId, playEnd });
  ledger = recordCorrectRuleSnapshot(ledger, 0, {
    eventId: `rule-${playId}`, tick: endTick + 1,
    snapshotId: `snapshot-${playId}`, evidenceRevision: 1,
    ruling: { outsAfter, basesAfter: { first: null,
      second: null, third: null }, scoredRunnerIds: [] },
  });
  return closeOfficialPlay(ledger, 1, {
    eventId: `close-${playId}`, closureId, tick: endTick + 2,
  });
};
export const applyTwo = (official: SqliteOfficialStateStore, gameId = 'game-1', firstDefenderId = 'home-0') => {
  official.initializeMatch(gameId, match());
  const first = official.applyAndActivate({ kind: 'live_ball',
    matchId: gameId, applicationId: 'application-1',
    expectedDurableRevision: 0, match: match(),
    physicalTimeline: timeline(7, 100, 500),
    adjudication: adjudication(7, 500, 'closure-1', 1),
    nextStartedAtTick: 503, worldSetup: worldSetup(firstDefenderId) });
  const second = official.applyAndActivate({ kind: 'live_ball',
    matchId: gameId, applicationId: 'application-2',
    expectedDurableRevision: 1, match: first.activation.nextMatchState,
    physicalTimeline: timeline(8, 503, 900),
    adjudication: adjudication(8, 900, 'closure-2', 2),
    nextStartedAtTick: 903, worldSetup: worldSetup(firstDefenderId) });
  return { first, second };
};
