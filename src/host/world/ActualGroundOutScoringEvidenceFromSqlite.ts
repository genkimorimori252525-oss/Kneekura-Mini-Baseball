import { createRequire } from 'node:module';
import type { OfficialGroundOutScoringEvidence } from '../SqliteOfficialScoringStore';
import type { ActualAdjudicationDb } from './ActualLiveAdjudicationFromSqlite';
import type { ActualLivePlayClosureProposal } from './ActualLivePlayClosureEvidenceFromSqlite';
import { deriveActualLiveClosureAdjudicationWithInputs } from './ActualPostPlayReviewClosureFromSqlite';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { battedWorldFieldGeometry } from './BattedWorldFieldRoot';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { findBallWorldControlledBaseContacts } from '../../core/sim/ball/BallWorldControlledBaseContacts';
import { bindBattedVenuePlayableWalls } from './BattedVenuePlayableWallPolicy';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { withFoulTerminalPriorLiveScope } from './FoulTerminalCompletionAncestryGuard';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Derive the complete physical sidecar on the scorer's own connection. The
 * earlier race remains an authenticated rule basis; histories for scoring are
 * reconstructed through the independently sealed end, including its retained
 * suffix. No caller supplies a runner history or a replacement OUT decision. */
export const deriveActualGroundOutScoringEvidence = (db: ActualAdjudicationDb,
  closure: ActualLivePlayClosureProposal, sourceEventId: string): OfficialGroundOutScoringEvidence => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof DatabaseSync)) throw new Error('ground-out scoring requires a real SQLite connection');
  return withBattedVenueLegalReadSnapshot(db, () => withFoulTerminalPriorLiveScope(db,
    closure.source.sourceId, closure.gameId, closure.playId, () => {
    const { pair } = deriveActualLiveClosureAdjudicationWithInputs(db, closure.source);
    if (!pair || json(pair.value.endReference) !== json(closure.physicalEndReference)
      || json(pair.value.wholeHistoryReference) !== json(closure.wholeHistoryReference)) {
      throw new Error('ground-out scoring original sealed physical end differs');
    }
    const { end, prefix } = pair;
    if (end.gameId !== closure.gameId || end.playId !== closure.playId
      || json(end.playEnd) !== json(closure.application.adjudication.playEnd)) {
      throw new Error('ground-out scoring original play/end identity differs');
    }
    const rule = battedWorldFieldExecutionEvidenceFromSqlite(db).read(end.finalRuleReference.sourceId);
    if (!rule || rule.source.action.kind !== 'first_base_race' || rule.source.action.custodyPolicy !== 'release_exclusive_v1'
      || rule.execution.kind !== 'first_base_race') throw new Error('ground-out scoring requires its owned release-exclusive first-base race');
    const physical = battedWorldFieldPhysicalPrefix({ ...prefix, custodyPolicy: 'release_exclusive_v1' });
    const ball = physical.field.evidence, base = battedWorldFieldGeometry(prefix.baseField).baseGeometry.bases.first;
    const contacts = (playerId: string) => {
      const history = deriveBallWorldPlayerBaseContactHistory({ segments: physical.segments, playerId,
        base: base.region, baseSurfaceHeightMeters: base.surfaceHeightMeters });
      const controlWindows = physical.controlWindows.filter(window => window.playerId === playerId)
        .map(({ playerId: _playerId, ...window }) => window);
      return { history, controlledContacts: findBallWorldControlledBaseContacts({ history, controlWindows }) };
    };
    const venue = rule.source.action.venuePolicy === undefined ? undefined
      : bindBattedVenuePlayableWalls(rule.source.action.venuePolicy, prefix);
    return freeze({ schemaVersion: 1, sourceKind: 'owned_ground_out', sourceEventId, ground: {
      physical: { originalTimeline: end.wholeHistory.originalTimeline, field: physical.field, playEnd: end.playEnd },
      race: { outsAtStart: closure.application.match.outs, batterRunnerId: ball.batterRunnerId, defenderIds: ball.defenderIds,
        originTick: ball.originTick, ticksPerSecond: ball.ticksPerSecond, horizonElapsedSeconds: ball.horizon.elapsedSeconds,
        runnerHistory: contacts(ball.batterRunnerId).history, defenders: ball.defenderIds.map(contacts) },
      ...(physical.possessionEvidence ? { possessionEvidence: physical.possessionEvidence } : {}),
      ...(venue ? { playableWalls: venue.playableWalls } : {}),
    } });
  }));
};
