import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import { asRuleProfileId } from '../model/RuleProfileRef';
import type { BallWorldFirstBaseRaceInput } from '../rules/BallWorldFirstBaseRace';
import type { BallWorldMoment } from '../sim/ball/BallWorldContinuation';
import { resolveBatBallContact } from '../sim/contact/BatBallContact';
import { quantizeEventTick } from '../sim/ExactEventTime';
import { projectActualFairFieldTimeline } from '../sim/plateAppearance/ActualFairFieldTimeline';
import { createCanonicalPlateAppearanceTimeline, recordBatBallContact } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { ActualGroundOutScoringInput } from './ActualGroundOutScoring';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot,
  recordOnFieldCall, type OfficialGameplayRuling } from './PlayAdjudicationLedger';

// Core-only fixtures: contact, territory, race and ledger are processed by their
// real Core functions. Supplied physical histories/end and the assigned call do
// not establish Native ownership, completed producer coverage or a genuine game.
const originTick = 1_000_000, frequency = 1_000_000, horizon = 4;
const moment = (elapsedSeconds: number, x = 0, z = 60): BallWorldMoment => ({
  originTick, elapsedSeconds, ball: { tick: quantizeEventTick(originTick, elapsedSeconds, frequency),
    position: { x, y: 0.036, z }, velocity: { x: 0, y: 0, z: 1 }, spin: { x: 0, y: 0, z: 0 } },
});
const history = (playerId: string, at: number | null): BallWorldFirstBaseRaceInput['runnerHistory'] => ({
  playerId, originTick, ticksPerSecond: frequency, startElapsedSeconds: 0, endElapsedSeconds: horizon,
  contactAtStart: at === 0, contactAtHorizon: at !== null,
  episodes: at === null ? [] : [{ startElapsedSeconds: at, endElapsedSeconds: horizon }],
  events: at === null ? [] : [{ kind: 'touch', originTick, elapsedSeconds: at,
    tick: quantizeEventTick(originTick, at, frequency) }],
});
export const actualGroundOutScoringFixture = (
  outs = 0,
  runnerAt: number | null = 3,
  controlAt: number | null = 2,
  original?: Readonly<{ match: CanonicalMatchState; batterId: string; defenderId: string }>,
) => {
  const match: CanonicalMatchState = original?.match ?? { ruleProfileId: asRuleProfileId('npb-2026'), playId: 7,
    inning: 1, half: 'top', outs, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 } };
  const batterId = original?.batterId ?? 'batter';
  const defenderId = original?.defenderId ?? 'defender';
  const contact = resolveBatBallContact({ tick: originTick, position: { x: 0, y: 1, z: 0.06 },
    velocity: { x: 0, y: -1.5, z: -35 }, spin: { x: 0, y: 0, z: 0 } },
  { pose: { grip: { x: -0.42, y: 1, z: 0 }, tip: { x: 0.42, y: 1, z: 0 } },
    linearVelocity: { x: 0, y: 0, z: 22 }, angularVelocity: { x: 0, y: 0, z: 0 } });
  if (!contact) throw new Error('ground-out fixture bat contact is missing');
  const evidence: ActualGroundOutScoringInput = {
    physical: {
      originalTimeline: recordBatBallContact(createCanonicalPlateAppearanceTimeline(match, 0), contact),
      playEnd: { kind: 'play_end', tick: moment(horizon).ball.tick, reason: 'live_action_complete' },
      field: { baseContacts: [], evidence: {
        batterRunnerId: batterId, defenderIds: [defenderId], originTick, ticksPerSecond: frequency,
        field: { homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: Math.SQRT1_2, z: Math.SQRT1_2 },
          thirdBaseLineUnit: { x: -Math.SQRT1_2, z: Math.SQRT1_2 } },
        bases: { homePlate: { x: 0, z: 0 }, firstBase: { x: 27, z: 27 },
          secondBase: { x: 0, z: 54 }, thirdBase: { x: -27, z: 27 } },
        ballRadiusMeters: 0.036, horizon: moment(horizon), acquisitions: [],
        contacts: [{ moment: moment(1), contacts: [{ kind: 'ground' }] },
          { moment: moment(1.5), contacts: [{ kind: 'actor', playerId: defenderId, role: 'glove' }] }],
      } },
    },
    race: { outsAtStart: match.outs, batterRunnerId: batterId, defenderIds: [defenderId], originTick,
      ticksPerSecond: frequency, horizonElapsedSeconds: horizon, runnerHistory: history(batterId, runnerAt),
      defenders: [{ history: history(defenderId, controlAt), controlledContacts: controlAt === null ? [] : [{
        playerId: defenderId, originTick, elapsedSeconds: controlAt, tick: quantizeEventTick(originTick, controlAt, frequency),
      }] }] },
  };
  const projected = projectActualFairFieldTimeline(evidence.physical);
  if (projected.kind !== 'projected') throw new Error('ground-out fixture projection is missing');
  const close = (ruling: OfficialGameplayRuling = {
    outsAfter: match.outs + 1, basesAfter: match.bases, scoredRunnerIds: [],
  }) => {
    let ledger = createPlayAdjudicationLedger({ playId: match.playId, ruleProfileId: match.ruleProfileId,
      playEnd: evidence.physical.playEnd });
    ledger = recordCorrectRuleSnapshot(ledger, ledger.revision, { eventId: 'oracle-event', tick: 5_000_001,
      snapshotId: 'physical-oracle', evidenceRevision: 1, ruling });
    ledger = recordOnFieldCall(ledger, ledger.revision, { eventId: 'assigned-call-event', tick: 5_000_002,
      callId: 'assigned-call', basisSnapshotId: 'physical-oracle', basisEvidenceRevision: 1, ruling });
    return closeOfficialPlay(ledger, ledger.revision, { eventId: 'closure-event', closureId: 'closure-1', tick: 5_000_003 });
  };
  const request = { match, timeline: projected.timeline, adjudication: close(), evidence };
  return { ...request, close };
};
