import type { ActualObservationMoment } from './ActualFieldObservation';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';
import type { SamePaLifecycleCut, SamePaLifecyclePitchReference } from './SamePlateAppearanceLifecycle';
import type { AcceptedSamePaLiveBallAction, SamePaLiveBallOriginals, SamePaLiveBallStateReference } from './SamePlateAppearanceLiveBallStateSource';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import type { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
import type { BaseTouchRegion } from '../../core/sim/running/BaseTouch';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { findBallWorldControlledBaseContacts } from '../../core/sim/ball/BallWorldControlledBaseContacts';
import type { deriveSamePaVenueLegalCoverageFromPair } from './SamePlateAppearanceVenueLegalCoverage';

type Venue = Extract<ReturnType<typeof deriveSamePaVenueLegalCoverageFromPair>, { kind: 'same_pa_venue_legal_coverage_v1' }>;

export type SamePaLiveBallPending = Readonly<{ kind: 'pending'; reason: string }>;
export const samePaLiveBallPending = (reason: string): SamePaLiveBallPending => freeze({ kind: 'pending', reason });
export type SamePaLiveBallPlayProof = Readonly<{ kind: 'original_pitcher_secure_on_plate_v1'; pitcherId: string;
  moment: ActualObservationMoment; plate: Readonly<{ region: BaseTouchRegion; surfaceHeightMeters: number }>;
  baseContactHistory: ReturnType<typeof deriveBallWorldPlayerBaseContactHistory>;
  controlWindow: Readonly<{ playerId: string; startElapsedSeconds: number; endElapsedSeconds: number; endInclusive: boolean }> }>;
export type SamePaLiveBallState = Readonly<{ kind: 'same_pa_live_ball_state_v1'; source: AcceptedSamePaLiveBallAction;
  lineage: SamePaExecutionLineage; originalInputs: SamePaLiveBallOriginals;
  physicalPitchReference: SamePaLifecyclePitchReference; physicalOperationReference: SamePaLifecycleCut['physicalOperationReference'];
  evaluationTick: number; occurredAt: ActualObservationMoment; priorStateReference: SamePaLiveBallStateReference | null;
  state: 'live' | 'dead'; playProof: SamePaLiveBallPlayProof | null; physicalCoverageHash: string; priorHistoryHash: string;
  venuePolicyReference: Venue['policyReference'] | null }>;

/** Only executed coverage after this actual Play matters. Earlier uncertainty
 * remains in the history and cannot prohibit a later, physically valid restart. */
export const deriveSamePaLiveBallPostPlayStatus = (venue: Venue, playedAt: ActualObservationMoment) => {
  if (venue.input.originTick !== playedAt.originTick) throw new Error('live-ball post-Play clock differs');
  const after = (interval: Venue['coverage']['intervals'][number]) => interval.endElapsedSeconds > playedAt.elapsedSeconds;
  const outside = (i: Venue['coverage']['intervals'][number]) => i.classification === 'out_of_play' || i.end.classification === 'out_of_play'
    || i.startElapsedSeconds >= playedAt.elapsedSeconds && i.start.classification === 'out_of_play';
  const ball = venue.coverage.intervals.filter(after);
  const intervals = [...ball, ...venue.carrierCoverage.flatMap(c => c.coverage.intervals.filter(after))];
  // A fielder may legally reach beyond a fence. Outside carried geometry alone
  // does not establish stepping/falling into dead-ball territory.
  const dead = ball.some(i => outside(i) && venue.fieldSegments[i.segmentIndex]?.constraint === 'free');
  if (dead) return freeze({ status: 'dead' as const, reason: 'original_out_of_play_occurrence' });
  if (intervals.some(outside)) return freeze({ status: 'unknown' as const, reason: 'original_carrier_dead_ball_entry_semantics_required' });
  if (intervals.some(i => i.classification === 'unresolved')
    || venue.unresolvedCarrierSpans.some(s => s.endElapsedSeconds > playedAt.elapsedSeconds))
    return freeze({ status: 'unknown' as const, reason: 'original_post_play_legal_coverage_required' });
  return freeze({ status: 'live' as const, reason: null });
};

/** Pure calculation over owner-supplied original physical facts. An intent or
 * nominal location cannot replace secure custody and actual foot contact. */
export const deriveSamePaLiveBallPlayProof = (input: Readonly<{ pitcherId: string;
  field: SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep; evidence: ReturnType<typeof deriveSamePaFieldRuleEvidence>;
  plate: Readonly<{ region: BaseTouchRegion; surfaceHeightMeters: number }> }>): SamePaLiveBallPlayProof | SamePaLiveBallPending => {
  const { field, evidence, plate, pitcherId } = input, motion = field.field.motion, horizon = evidence.physical.field.evidence.horizon;
  if (json(motion.world.moment) !== json(horizon)) throw new Error('live-ball exact physical cut differs');
  if (!motion.cursor || motion.response.kind !== 'carried' || motion.carrierPlayerId !== pitcherId
    || evidence.rule.possessionEvidence.pending.length) return samePaLiveBallPending('original_pitcher_secure_custody_required');
  if (json(motion.cursor) !== json(motion.response.cursor) || json(motion.cursor.moment) !== json(horizon))
    throw new Error('live-ball original pitcher custody cut differs');
  const moment = { originTick: horizon.originTick, elapsedSeconds: horizon.elapsedSeconds, tick: horizon.ball.tick };
  const windows = evidence.physical.controlWindows.filter(w => w.playerId === pitcherId);
  const controlWindow = windows.find(w => w.startElapsedSeconds <= moment.elapsedSeconds
    && (w.endElapsedSeconds > moment.elapsedSeconds || w.endElapsedSeconds === moment.elapsedSeconds && w.endInclusive));
  if (!controlWindow) return samePaLiveBallPending('original_pitcher_current_secure_custody_required');
  const baseContactHistory = deriveBallWorldPlayerBaseContactHistory({ segments: evidence.physical.segments, playerId: pitcherId,
    base: plate.region, baseSurfaceHeightMeters: plate.surfaceHeightMeters });
  findBallWorldControlledBaseContacts({ history: baseContactHistory, controlWindows: windows.map(({ playerId: _, ...w }) => w) });
  if (baseContactHistory.originTick !== moment.originTick || baseContactHistory.endElapsedSeconds !== moment.elapsedSeconds)
    throw new Error('live-ball pitcher plate history cut differs');
  if (!baseContactHistory.contactAtHorizon) return samePaLiveBallPending('original_pitcher_actual_plate_contact_required');
  return freeze({ kind: 'original_pitcher_secure_on_plate_v1', pitcherId, moment, plate, baseContactHistory, controlWindow });
};
