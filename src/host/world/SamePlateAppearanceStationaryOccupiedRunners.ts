import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import type { SamePaPhysicalFieldRoot } from './SamePlateAppearancePhysicalEpisode';
import type { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
import type { DurableSamePaOccupiedRunnerHold } from './SqliteSamePlateAppearanceOccupiedRunnerHoldStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type SamePaStationaryOccupiedRunners = import('../../core/adjudication/ActualFairCatchScoring').ActualFairCatchStationaryOccupiedRunners;
export type SamePaStationaryHoldBasis = Readonly<{
  source: Pick<DurableSamePaOccupiedRunnerHold['source'], 'sourceId' | 'sourceVersion' | 'playerId' | 'enrollmentReference' | 'coverageThroughTick'>;
  startingBase: DurableSamePaOccupiedRunnerHold['startingBase'];
  setup: Pick<DurableSamePaOccupiedRunnerHold['setup'], 'position'>;
  body: Readonly<{ actor: Pick<DurableSamePaOccupiedRunnerHold['body']['actor'], 'bodyOriginHeightMeters' | 'primitives'> }>;
}>;
/** The Native reader owns the original holds and complete executed prefix.
 * Occupancy alone, a planned hold and touching a base at only the endpoint are
 * insufficient. This projection cannot grant reception, adoption or PlayEnd. */
export const deriveSamePaStationaryOccupiedRunners = (raw: Readonly<{ match: CanonicalMatchState;
  root: SamePaPhysicalFieldRoot; holds: readonly SamePaStationaryHoldBasis[];
  evidence: ReturnType<typeof deriveSamePaFieldRuleEvidence> }>): SamePaStationaryOccupiedRunners | Readonly<{ kind: 'pending'; reason: string }> => {
  const { match, root, holds, evidence } = cloneInert(raw), occupied = Object.entries(match.bases).filter(([, id]) => id !== null);
  if (!occupied.length || occupied.length !== holds.length || new Set(holds.map(h => h.source.playerId)).size !== holds.length)
    throw new Error('stationary occupied proof requires the exact original runner holds');
  const segments = evidence.physical.segments, end = evidence.physical.field.evidence.horizon.elapsedSeconds;
  const runners: SamePaStationaryOccupiedRunners['runners'][number][] = [];
  const close = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b)
    && Math.abs(a-b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 32;
  for (const [base, playerId] of occupied) {
    const hold = holds.find(h => h.source.playerId === playerId);
    const baseNumber: DurableSamePaOccupiedRunnerHold['startingBase'] = ({ first: 1, second: 2, third: 3 } as const)[base as 'first' | 'second' | 'third'];
    if (!hold || hold.startingBase !== baseNumber || json(hold.source.enrollmentReference) !== json(root.lineage.enrollmentReference))
      throw new Error('stationary occupied proof original base or enrollment differs');
    for (const segment of segments) {
      const actors = segment.actors.filter(a => a.playerId === playerId);
      if (actors.length !== 5 || new Set(actors.map(a => a.primitive.role)).size !== 5 || hold.source.coverageThroughTick < root.response.world.flight.initialBall.tick + segment.endElapsedSeconds * root.response.world.parameters.ticksPerSecond)
        return freeze({ kind: 'pending', reason: 'occupied_runner_original_hold_coverage_required' });
      for (const actor of actors) {
        const shape = hold.body.actor.primitives.find(p => p.role === actor.primitive.role);
        if (!shape || shape.radius !== actor.primitive.radius) throw new Error('stationary occupied proof original body differs');
        const state = samplePiecewiseFieldActor(actor, { originTick: segment.originTick, elapsedSeconds: segment.startElapsedSeconds, ball: evidence.physical.field.evidence.horizon.ball });
        const expected = { x: hold.setup.position.x + shape.offset.x, y: hold.body.actor.bodyOriginHeightMeters + shape.offset.y,
          z: hold.setup.position.z + shape.offset.z };
        if ((['x','y','z'] as const).some(k => !close(state.center[k], expected[k]) || state.velocity[k] !== 0 || actor.primitive.acceleration[k] !== 0))
          return freeze({ kind: 'pending', reason: 'occupied_runner_moving_history_consumer_required' });
      }
    }
    const startingBase = base as 'first' | 'second' | 'third', bag = root.geometry.baseGeometry.bases[startingBase];
    const history = deriveBallWorldPlayerBaseContactHistory({ segments, playerId: playerId!, base: bag.region, baseSurfaceHeightMeters: bag.surfaceHeightMeters });
    if (history.startElapsedSeconds !== 0 || history.endElapsedSeconds !== end || !history.contactAtStart || !history.contactAtHorizon
      || history.episodes.length !== 1 || history.events.some(e => e.kind === 'departure'))
      return freeze({ kind: 'pending', reason: 'occupied_runner_original_base_contact_history_required' });
    runners.push({ playerId: playerId!, startingBase, holdReference: reference('world_same_pa_occupied_runner_holds', hold), history });
  }
  return freeze({ kind: 'same_pa_stationary_occupied_runners_v1', runners });
};
