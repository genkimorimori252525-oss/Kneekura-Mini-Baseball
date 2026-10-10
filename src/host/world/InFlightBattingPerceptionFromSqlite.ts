import type { DatabaseSync } from 'node:sqlite';
import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import { readSamePaOccupiedRunnerHolds } from './SqliteSamePlateAppearanceOccupiedRunnerHoldStore';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { calculateBattingObservation } from '../../core/world/psychology/batting/BattingObservationCalculation';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite,
  readCurrentSamePaLifecycleCalibrationFromSqlite, readSamePaLifecycleCalibrationFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalActionFromSqlite, readCurrentSamePaInFlightCutFromSqlite, readHistoricalSamePaInFlightCutFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from './PlayerBodyCapabilityMaterializationEvidence';
import { assertSamePaOriginalMember } from './SamePlateAppearanceInvocationView';
import { assertBattingAssessmentOwnership } from './BattingAssessmentOwnership';
import { deriveBattingObservationDelivery } from './NativeBattingDelivery';
import { deriveDeliveredBattingObservedMotionForecast } from './NativeBattingPrediction';
import { battingPerceptionTables as tables, type BattingPerceptionKind, type BattingPerceptionRecord } from './NativeBattingPerception';
import type { InFlightBattingPerceptionSource } from './NativeInFlightBattingPerception';
type Pending = Readonly<{ kind: 'pending'; reason: string; missingSourceIds: readonly string[] }>;
const pending = (reason: string, ids: readonly string[] = []): Pending => freeze({ kind: 'pending', reason, missingSourceIds: ids });
const fail = (s: string): never => { throw new Error('in-flight batting ' + s); };
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) fail('original owner, participant or physical cut differs'); };
type Links = Readonly<{
  linked(kind: BattingPerceptionKind, reference: SamePaReference): BattingPerceptionRecord | null;
  observationHead(enrollment: string, pitch: string, player: string): { first_source_id: unknown; last_source_id: unknown } | null;
}>;
/** Invoked only inside the existing Native perception owner's immutable proof.
 * No clock is synthesized: capture/delivery use a normally owned physical cut. */
export const deriveInFlightBattingPerception = (db: DatabaseSync, source: InFlightBattingPerceptionSource, current: boolean, links: Links): BattingPerceptionRecord | Pending => {
  const b = (current ? readCurrentSamePaLifecycleViewFromSqlite : readHistoricalSamePaLifecycleViewFromSqlite)(db, source.viewReference);
  const member = b.members.find(m => m.playerId === source.member.playerId), lineage = b.view.lineage;
  if (!member || b.actor.binding.playerId !== member.playerId) return fail('original batter missing'); same(member, source.member);
  const model = (pin: SamePaReference<'world_player_batting_models'>) => {
    const owner = playerBattingModelEvidenceFromSqlite(db), value = owner.read(pin.sourceId); if (!value) return fail('normal batting model missing');
    same(reference(pin.owner, value), pin); same(value.person, b.actor.person);
    if (value.source.careerId !== lineage.careerId || value.source.playerId !== member.playerId || value.source.acceptedAtDay > b.actor.binding.gameDay) return fail('normal model scope or day differs');
    if (current) same(owner.selectAtDay(lineage.careerId, member.playerId, b.actor.binding.gameDay), value);
    return value;
  };
  if (source.capability === 'owned_in_flight_batting_posture_v1') {
    assertBattingAssessmentOwnership(db, tables.posture, source);
    const action = readSamePaPhysicalActionFromSqlite(db, source.actionReference), nominal = model(source.modelReference), g = source.geometry;
    same(action.source.viewReference, source.viewReference); same(action.lineage, lineage); same(action.source.batterModelReference, source.modelReference);
    same(action.physicalWorld, b.view.cut.physicalWorld); same(action.bodyCut, b.view.cut.bodyCut);
    if (!['retained_take', 'foul_reset_ready'].includes(b.view.cut.stage)) return fail('posture must precede this pitch launch');
    if (g.startedAtTick !== action.bodyCut.completedAtTick || g.ticksPerSecond !== 1_000_000 || g.plateZ !== action.source.nominalPitch.batter.plateZ
      || nominal.observationCalibration.values.calibration.memoryDecayParameters.ticksPerSecond !== g.ticksPerSecond
      || nominal.predictionCalibration.values.parameters.ticksPerSecond !== g.ticksPerSecond) return fail('posture original clock or geometry differs');
    same(g.strikeZone, action.source.nominalPitch.batter.strikeZone);
    if ([...action.physicalWorld.runners, ...action.physicalWorld.defenders].some(d => d.velocity.x !== 0 || d.velocity.z !== 0)) return pending('owned_moving_body_cut_required');
    if (action.physicalWorld.runners.length && action.bodyCut.origin === 'foul_reset') return pending('occupied_runner_reset_command_required');
    const originals = readSamePaOriginalParticipants(db, b.actor), holds = readSamePaOccupiedRunnerHolds(db, b.actor,
      lineage.enrollmentReference, source.occupiedRunnerHoldReferences, g.startedAtTick, g.validUntilTick);
    same(source.sceneBodyReferences.map(r => r.playerId).sort(), originals.filter(p => p.role !== 'batter').map(p => p.binding.playerId).sort());
    const owner = playerBodyCapabilityMaterializationEvidenceFromSqlite(db), sceneBodies = source.sceneBodyReferences.map(pin => {
      const body = owner.read(pin.bodyReference.sourceId); if (!body) return null; same(reference(pin.bodyReference.owner, body), pin.bodyReference);
      const participant = originals.find(p => p.binding.playerId === pin.playerId)!; same(body.person, participant.person);
      if (participant.role === 'runner') same(pin.bodyReference, holds.find(h => h.source.playerId === pin.playerId)!.source.bodyReference);
      if (body.source.playerId !== pin.playerId || body.source.careerId !== lineage.careerId || body.source.atDay > b.actor.binding.gameDay
        || !(participant.role === 'runner' ? body.source.role === 'runner' : ['defender', 'pitcher'].includes(body.source.role))) return fail('normal scene body scope or day differs'); return body;
    });
    if (sceneBodies.some(v => v === null)) return pending('original_scene_body_missing', source.sceneBodyReferences.filter((_, i) => sceneBodies[i] === null).map(r => r.bodyReference.sourceId));
    return freeze({ kind: 'batting_invocation_posture', source, lineage, physicalPitchSourceId: action.physicalPitchSourceId, model: nominal, sceneBodies: sceneBodies as NonNullable<typeof sceneBodies[number]>[] });
  }
  if (b.view.cut.stage !== 'in_flight' || b.view.cut.physicalPitchReference.owner !== 'pa_physical_v1_launches'
    || !['pa_physical_v1_launches', 'pa_physical_v1_cuts'].includes(b.view.cut.physicalOperationReference.owner)) return pending('owned_uncommitted_in_flight_cut_required');
  const physicalReference = b.view.cut.physicalOperationReference as import('./NativeInFlightBattingPerception').InFlightBattingCutReference;
  const cut = (current ? readCurrentSamePaInFlightCutFromSqlite : readHistoricalSamePaInFlightCutFromSqlite)(db, physicalReference);
  same(cut.lineage, lineage); same(cut.physicalPitchReference, b.view.cut.physicalPitchReference); same(cut.evaluationTick, b.view.cut.evaluationTick);
  if (cut.stage !== 'in_flight') return pending('owned_uncommitted_in_flight_cut_required');
  if (source.capability === 'owned_in_flight_batting_observation_v1') {
    same(source.physicalPitchReference, cut.physicalPitchReference); same(source.physicalOperationReference, physicalReference);
    if (source.observedTick !== cut.evaluationTick) return fail('capture time is not the owned physical cut');
    const posture = links.linked('posture', source.postureReference);
    if (!posture) return pending('original_posture_missing', [source.postureReference.sourceId]);
    if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1') return fail('per-pitch original posture differs');
    same(posture.lineage, lineage); assertSamePaOriginalMember(posture.source.member, source.member);
    same(posture.source.actionReference, reference('pa_physical_v1_action_plans', cut.action));
    if (posture.physicalPitchSourceId !== cut.physicalPitchReference.sourceId) return fail('posture belongs to another pitch');
    const g = posture.source.geometry;
    if (cut.evaluationTick < g.startedAtTick || cut.evaluationTick > g.validUntilTick) return pending('owned_current_batting_posture_unavailable');
    const calibration = (current ? readCurrentSamePaLifecycleCalibrationFromSqlite : readSamePaLifecycleCalibrationFromSqlite)(db, source.calibrationReference), c = calibration.source;
    if (c.route !== 'batter_observation' || c.response.kind !== 'accepted_execution_values_v1') return fail('sensory calibration domain differs');
    same(c.member, member); same(c.viewReference, source.viewReference); same(c.nominalReference, posture.source.modelReference); model(posture.source.modelReference);
    const previous = source.previousObservationReference === null ? null : links.linked('observation', source.previousObservationReference);
    if (source.previousObservationReference && !previous) return pending('previous_observation_missing', [source.previousObservationReference.sourceId]);
    if (previous) {
      if (previous.kind !== 'batting_observation' || previous.source.capability !== 'owned_in_flight_batting_observation_v1') return fail('previous capture owner differs');
      same(previous.source.postureReference, source.postureReference); same(previous.source.physicalPitchReference, source.physicalPitchReference);
      if (previous.source.observedTick >= source.observedTick) return fail('capture chronology differs');
    }
    const head = links.observationHead(lineage.enrollmentReference.sourceId, cut.physicalPitchReference.sourceId, member.playerId);
    if (current && (head?.last_source_id ?? null) !== (previous?.source.sourceId ?? null)) return fail('capture must extend the current sensory head');
    if (!current && previous === null && head && head.first_source_id !== source.sourceId) return fail('another sensory origin exists');
    const eventSequence = (previous?.kind === 'batting_observation' ? previous.eventSequence : 0) + 1;
    if (!Number.isSafeInteger(eventSequence)) return fail('sensory sequence overflow');
    const occluders = posture.sceneBodies.flatMap(body => {
      const player = [...cut.physicalWorld.defenders, ...cut.physicalWorld.runners].find(d => d.playerId === body.source.playerId); if (!player) return fail('starting-world scene participant missing');
      if (player.velocity.x !== 0 || player.velocity.z !== 0) return fail('moving defender requires owned body trajectory');
      return body.actor.primitives.map(p => ({ center: { x: player.position.x + p.offset.x, y: body.actor.bodyOriginHeightMeters + p.offset.y, z: player.position.z + p.offset.z }, radiusMeters: p.radius }));
    });
    const seed = new SeedRoot(cut.action.source.nominalPitch.delivery.matchSeed).streamSeed(b.actor.match.playId, 'perception', json(['owned_in_flight_batting_observation_v1', posture.source.sourceId, cut.physicalPitchReference, source.observedTick]));
    const result = calculateBattingObservation({ nominalValues: posture.model.observationCalibration.values, effectiveValues: c.response.values,
      input: { observedTick: cut.evaluationTick, deliveryCutTick: cut.evaluationTick, ticksPerSecond: g.ticksPerSecond, seed,
        observer: { position: g.eyePosition, forward: g.observerForward, velocity: { x: 0, y: 0, z: 0 } }, target: { position: cut.ball.position, velocity: cut.ball.velocity },
        occluders, attention: g.attention, lastObservedTick: previous?.kind === 'batting_observation' ? previous.lastCapturedTick : null } });
    if (!result.ok) return fail('sensory Core rejected: ' + result.reason.path);
    return freeze({ kind: 'batting_observation', source, lineage, physicalPitchSourceId: cut.physicalPitchReference.sourceId, modelReference: posture.source.modelReference, eventSequence,
      lastCapturedTick: result.value.sample?.observedAt ?? (previous?.kind === 'batting_observation' ? previous.lastCapturedTick : null),
      physicalCutHash: hash({ physicalOperationReference: physicalReference, ball: cut.ball, bodyCut: cut.bodyCut, scene: posture.sceneBodies.map(body => reference('world_player_body_materializations', body)) }), calculation: result.value });
  }
  if (source.capability === 'owned_in_flight_batting_observation_delivery_v1') {
    same(source.physicalPitchReference, cut.physicalPitchReference); same(source.physicalOperationReference, physicalReference);
    const capture = links.linked('observation', source.observationReference);
    if (!capture) return pending('original_capture_missing', [source.observationReference.sourceId]);
    if (capture.kind !== 'batting_observation' || capture.source.capability !== 'owned_in_flight_batting_observation_v1') return fail('original in-flight capture differs');
    same(capture.lineage, lineage); same(capture.source.physicalPitchReference, cut.physicalPitchReference); assertSamePaOriginalMember(capture.source.member, member);
    const capturedCut = readHistoricalSamePaInFlightCutFromSqlite(db, capture.source.physicalOperationReference);
    if (cut.record.operationOrdinal <= capturedCut.record.operationOrdinal || cut.evaluationTick <= capture.source.observedTick) return pending('later_owned_physical_cut_required');
    const calibration = (current ? readCurrentSamePaLifecycleCalibrationFromSqlite : readSamePaLifecycleCalibrationFromSqlite)(db, source.calibrationReference), c = calibration.source;
    if (c.route !== 'batter_observation' || c.response.kind !== 'accepted_execution_values_v1') return fail('retention calibration domain differs');
    same(c.member, member); same(c.viewReference, source.viewReference); same(c.nominalReference, capture.modelReference); model(capture.modelReference);
    const delivery = deriveBattingObservationDelivery(capture.calculation, capture.calculation.nominalValues.calibration.memoryDecayParameters,
      c.response.values.calibration.memoryDecayParameters, cut.evaluationTick);
    if (delivery.kind === 'pending') return pending(delivery.reason);
    return freeze({ kind: 'batting_observation_delivery', source, lineage, physicalPitchSourceId: capture.physicalPitchSourceId, physicalPitchReference: source.physicalPitchReference,
      originalCaptureHash: hash(capture), eventSequence: capture.eventSequence, delivery, temporalCut: { kind: 'owned_in_flight_delivery_cut_v1', fromTick: capture.source.observedTick,
        throughTick: cut.evaluationTick, originalWorldHash: cut.bodyCut.originalWorldHash, physicalOperationReference: physicalReference } });
  }
  if (source.capability === 'owned_in_flight_batting_observed_prediction_v1') {
    const capture = links.linked('observation', source.observationReference), delivered = links.linked('delivery', source.deliveryReference);
    if (!capture || !delivered) return pending('original_capture_or_delivery_missing', [source.observationReference.sourceId, source.deliveryReference.sourceId]);
    if (capture.kind !== 'batting_observation' || capture.source.capability !== 'owned_in_flight_batting_observation_v1' || delivered.kind !== 'batting_observation_delivery'
      || delivered.source.capability !== 'owned_in_flight_batting_observation_delivery_v1') return fail('original in-flight sensory owners differ');
    same(capture.lineage, lineage); same(delivered.lineage, lineage); assertSamePaOriginalMember(capture.source.member, member); assertSamePaOriginalMember(delivered.source.member, member);
    same(capture.source.physicalPitchReference, cut.physicalPitchReference); same(delivered.physicalPitchReference, cut.physicalPitchReference);
    same(delivered.source.observationReference, source.observationReference); same(delivered.originalCaptureHash, hash(capture)); same(capture.modelReference, source.modelReference);
    const parameter = model(source.modelReference).predictionCalibration;
    same(source.predictionParameterReference, { sourceId: parameter.sourceId, sourceVersion: parameter.sourceVersion, sourceHash: hash(parameter) });
    const forecast = deriveDeliveredBattingObservedMotionForecast(capture.calculation, delivered.delivery, parameter.values, cut.evaluationTick);
    if (forecast.kind === 'pending') return pending(forecast.reason);
    return freeze({ kind: 'batting_observed_prediction', source, lineage, physicalPitchSourceId: cut.physicalPitchReference.sourceId, physicalPitchReference: cut.physicalPitchReference, forecast });
  }
  const prediction = links.linked('prediction', source.predictionReference);
  if (!prediction) return pending('original_prediction_missing', [source.predictionReference.sourceId]);
  if (prediction.kind !== 'batting_observed_prediction' || prediction.source.capability !== 'owned_in_flight_batting_observed_prediction_v1') return fail('in-flight prediction owner differs');
  assertBattingAssessmentOwnership(db, tables.assessment, source); same(prediction.lineage, lineage); assertSamePaOriginalMember(prediction.source.member, member);
  same(prediction.physicalPitchReference, cut.physicalPitchReference); same(prediction.source.modelReference, source.modelReference); same(prediction.source.observationReference, source.observationCutReference);
  if (prediction.forecast.availableTick > cut.evaluationTick) return fail('score prediction not yet available'); model(source.modelReference);
  return freeze({ kind: 'batting_score_assessment', source, lineage, physicalPitchSourceId: cut.physicalPitchReference.sourceId,
    prediction: { predictionId: prediction.source.sourceId, observedTick: prediction.forecast.observedTick, availableTick: prediction.forecast.availableTick,
      validUntilTick: prediction.forecast.validUntilTick, trajectory: prediction.forecast.trajectory, swingScore: source.score } });
};
